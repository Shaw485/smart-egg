(function (root) {
    'use strict';

    const ACCEPTED_REVIEW_IDS = Object.freeze([13, 17, 24, 28, 30, 35, 36, 41]);

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, Number(value) || 0));
    }

    function strokeLength(points) {
        let total = 0;
        for (let index = 1; index < (points || []).length; index++) {
            total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
        }
        return total;
    }

    function validateInkStroke(points) {
        const safe = Array.isArray(points) ? points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)) : [];
        const length = strokeLength(safe);
        if (safe.length < 4) return { valid:false, reason:'too-few-points', length };
        const start = safe[0];
        const end = safe[safe.length - 1];
        if (start.x < 540 || start.x > 760 || start.y < 600 || start.y > 875) {
            return { valid:false, reason:'start-outside-left-bank', length };
        }
        if (end.x < 1190 || end.x > 1390 || end.y < 600 || end.y > 875) {
            return { valid:false, reason:'end-outside-right-bank', length };
        }
        if (length < 520) return { valid:false, reason:'stroke-too-short', length };
        if (length > 1100) return { valid:false, reason:'stroke-too-long', length };
        return { valid:true, reason:'banks-connected', length };
    }

    function advanceHold(current, active, dt, targetSeconds) {
        const target = Math.max(0.05, Number(targetSeconds) || 1);
        return active
            ? clamp(current + Math.max(0, Number(dt) || 0), 0, target)
            : clamp(current - Math.max(0, Number(dt) || 0) * 1.8, 0, target);
    }

    function sideBlock(previousX, nextX, halfW, left, right, enabled, verticalOverlap) {
        if (!enabled) return { blocked:false, x:nextX, side:null };
        // 侧面阻挡只在人物与墙体的垂直区间真正重叠时生效。人物落在墙顶时
        // 两个边界只是接触，不应在下一帧被横向推出。
        if (verticalOverlap === false) return { blocked:false, x:nextX, side:null };
        if (previousX + halfW <= left + 8 && nextX + halfW > left) {
            return { blocked:true, x:left - halfW, side:'left' };
        }
        if (previousX - halfW >= right - 8 && nextX - halfW < right) {
            return { blocked:true, x:right + halfW, side:'right' };
        }
        // 旧版本只拦截“从边界外跨入”的一帧；人物若先从墙底向上穿入，下一帧
        // 已经处在墙的水平范围内，就再也不会命中边界。仅在调用方确认垂直方向
        // 仍有实体重叠时按最近一侧推出；站在墙顶或位于墙底通道时不会触发。
        if (nextX + halfW > left && nextX - halfW < right) {
            const midpoint = (left + right) / 2;
            return nextX <= midpoint
                ? { blocked:true, x:left - halfW, side:'left-overlap' }
                : { blocked:true, x:right + halfW, side:'right-overlap' };
        }
        return { blocked:false, x:nextX, side:null };
    }

    // 低矮墙体不仅要在左右方向挡住未缩小人物，也必须参与上下方向碰撞。
    // 这样人物从墙下起跳会撞到墙底，从上方落下会站在墙顶，不能再穿模。
    function solidVerticalBlock(options) {
        const source = options && typeof options === 'object' ? options : {};
        const previousY = Number(source.previousY);
        const nextY = Number(source.nextY);
        const centerX = Number(source.centerX);
        const halfW = Math.max(0, Number(source.halfW) || 0);
        const halfH = Math.max(0, Number(source.halfH) || 0);
        const velocityY = Number(source.velocityY) || 0;
        const obstacle = source.obstacle || {};
        const left = Number(obstacle.x);
        const top = Number(obstacle.y);
        const width = Math.max(0, Number(obstacle.w) || 0);
        const height = Math.max(0, Number(obstacle.h) || 0);
        if (source.enabled === false || ![previousY, nextY, centerX, left, top].every(Number.isFinite)
            || halfW <= 0 || halfH <= 0 || width <= 0 || height <= 0) {
            return { blocked:false, y:nextY, side:null, onGround:false };
        }
        const right = left + width;
        const bottom = top + height;
        const overlapsX = centerX + halfW > left && centerX - halfW < right;
        if (!overlapsX) return { blocked:false, y:nextY, side:null, onGround:false };

        const previousTop = previousY - halfH;
        const previousBottom = previousY + halfH;
        const nextTop = nextY - halfH;
        const nextBottom = nextY + halfH;
        const tolerance = Math.max(0, Number(source.tolerance) || 8);
        if (velocityY < 0 && previousTop >= bottom - tolerance && nextTop < bottom) {
            return { blocked:true, y:bottom + halfH, side:'bottom', onGround:false };
        }
        if (velocityY >= 0 && previousBottom <= top + tolerance && nextBottom > top) {
            return { blocked:true, y:top - halfH, side:'top', onGround:true };
        }
        return { blocked:false, y:nextY, side:null, onGround:false };
    }

    function eraseProgress(current, distance) {
        return clamp((Number(current) || 0) + Math.max(0, Number(distance) || 0) / 950, 0, 1);
    }

    function migrateProgressForRemovedLevel(progress, totalLevels, targetRevision, removedIndex) {
        const parsed = progress && typeof progress === 'object' ? progress : {};
        const total = Math.max(1, Math.floor(Number(totalLevels) || 1));
        const target = Math.max(1, Math.floor(Number(targetRevision) || 1));
        const removed = Math.max(0, Math.floor(Number(removedIndex) || 0));
        const sourceRevision = Number(parsed.mainline_revision) || 0;
        const sourceCompleted = (Array.isArray(parsed.completed) ? parsed.completed : [])
            .map(Number)
            .filter(index => Number.isInteger(index) && index >= 0);
        const remap = index => index === removed ? null : (index > removed ? index - 1 : index);
        const remapped = sourceRevision < target
            ? sourceCompleted.map(remap).filter(index => index !== null)
            : sourceCompleted;
        const completed = Array.from(new Set(remapped.filter(index => index < total))).sort((a, b) => a - b);
        let contiguousCompleted = 0;
        while (completed.includes(contiguousCompleted)) contiguousCompleted += 1;
        const rawUnlocked = Number.isFinite(Number(parsed.unlocked)) ? Math.floor(Number(parsed.unlocked)) : 1;
        const storedUnlocked = sourceRevision < target && rawUnlocked > removed + 1 ? rawUnlocked - 1 : rawUnlocked;
        return {
            unlocked: Math.max(1, Math.min(total, Math.max(storedUnlocked, contiguousCompleted + 1))),
            completed,
            mainline_revision: target,
            source_revision: sourceRevision,
            migrated: sourceRevision < target
        };
    }

    const api = Object.freeze({
        ACCEPTED_REVIEW_IDS,
        validateInkStroke,
        advanceHold,
        sideBlock,
        solidVerticalBlock,
        eraseProgress,
        migrateProgressForRemovedLevel,
        strokeLength
    });

    root.SmartEggAcceptedMechanics = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
