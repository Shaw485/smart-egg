(function (root) {
    'use strict';

    const ACCEPTED_REVIEW_IDS = Object.freeze([13, 15, 17, 24, 28, 30, 35, 36, 41]);

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

    function sideBlock(previousX, nextX, halfW, left, right, enabled) {
        if (!enabled) return { blocked:false, x:nextX, side:null };
        if (previousX + halfW <= left + 8 && nextX + halfW > left) {
            return { blocked:true, x:left - halfW, side:'left' };
        }
        if (previousX - halfW >= right - 8 && nextX - halfW < right) {
            return { blocked:true, x:right + halfW, side:'right' };
        }
        return { blocked:false, x:nextX, side:null };
    }

    function eraseProgress(current, distance) {
        return clamp((Number(current) || 0) + Math.max(0, Number(distance) || 0) / 950, 0, 1);
    }

    const api = Object.freeze({
        ACCEPTED_REVIEW_IDS,
        validateInkStroke,
        advanceHold,
        sideBlock,
        eraseProgress,
        strokeLength
    });

    root.SmartEggAcceptedMechanics = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
