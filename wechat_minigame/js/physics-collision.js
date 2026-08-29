(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SmartEggPhysicsCollision = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function rectVsRect(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    /**
     * A platform is a horizontal wall only when the player crossed one of its
     * side edges during this X step. Pre-existing overlap with the same wide
     * ground segment must never teleport the player to that segment's far edge.
     */
    function resolveHorizontalPlatformCollision(options) {
        const previousX = Number(options.previousX);
        const nextX = Number(options.nextX);
        const playerY = Number(options.playerY);
        const halfW = Number(options.halfW);
        const halfH = Number(options.halfH);
        const vx = Number(options.vx);
        const platform = options.platform || {};
        const platformX = Number(platform.x);
        const platformY = Number(platform.y);
        const platformW = Number(platform.w);
        const platformH = Number(platform.h);
        const edgeTolerance = Number.isFinite(options.edgeTolerance) ? Math.max(0, options.edgeTolerance) : 2;
        const topTolerance = Number.isFinite(options.topTolerance) ? Math.max(0, options.topTolerance) : 4;

        const values = [previousX, nextX, playerY, halfW, halfH, vx, platformX, platformY, platformW, platformH];
        if (values.some(value => !Number.isFinite(value)) || halfW <= 0 || halfH <= 0 || platformW <= 0 || platformH <= 0) {
            return { blocked: false, reason: 'invalid-geometry' };
        }

        const left = platformX - platformW / 2;
        const top = platformY - platformH / 2;
        const right = left + platformW;
        const legacyResolvedX = vx > 0 ? left - halfW : right + halfW;
        const overlaps = rectVsRect(
            nextX - halfW, playerY - halfH, halfW * 2, halfH * 2,
            left, top, platformW, platformH
        );
        if (!overlaps || vx === 0) return { blocked: false, reason: overlaps ? 'stationary' : 'no-overlap' };

        // Feet grazing a platform top are handled by the Y pass. Treating that
        // contact as a side wall caused the level-2 far-left snap.
        if (playerY + halfH <= top + topTolerance) {
            return { blocked: false, reason: 'top-surface-contact', legacyResolvedX };
        }

        const previousLeft = previousX - halfW;
        const previousRight = previousX + halfW;
        if (vx > 0 && previousRight <= left + edgeTolerance) {
            return { blocked: true, x: left - halfW, side: 'left', reason: 'crossed-left-edge' };
        }
        if (vx < 0 && previousLeft >= right - edgeTolerance) {
            return { blocked: true, x: right + halfW, side: 'right', reason: 'crossed-right-edge' };
        }

        return {
            blocked: false,
            reason: 'preexisting-horizontal-overlap',
            legacyResolvedX
        };
    }

    return { rectVsRect, resolveHorizontalPlatformCollision };
});
