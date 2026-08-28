(function (root) {
  'use strict';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function nextDualHold(current, leftHeld, rightHeld, dt, required) {
    const target = required || 1;
    return leftHeld && rightHeld ? clamp(current + dt, 0, target) : 0;
  }

  function spreadWidth(leftX, rightX, minWidth, maxWidth) {
    return clamp(rightX - leftX, minWidth, maxWidth);
  }

  function strokeLength(points) {
    let length = 0;
    for (let index = 1; index < points.length; index += 1) {
      const dx = points[index].x - points[index - 1].x;
      const dy = points[index].y - points[index - 1].y;
      length += Math.hypot(dx, dy);
    }
    return length;
  }

  function validateStroke(points, options) {
    const opts = Object.assign({
      startMinX: 590,
      startMaxX: 735,
      endMinX: 1185,
      endMaxX: 1330,
      minY: 650,
      maxY: 815,
      minLength: 500,
      maxLength: 860,
      maxBacktrack: 90
    }, options || {});
    if (!Array.isArray(points) || points.length < 4) return { valid: false, reason: 'too-few-points', length: 0 };
    const first = points[0];
    const last = points[points.length - 1];
    const length = strokeLength(points);
    if (first.x < opts.startMinX || first.x > opts.startMaxX) return { valid: false, reason: 'wrong-start', length: length };
    if (last.x < opts.endMinX || last.x > opts.endMaxX) return { valid: false, reason: 'wrong-end', length: length };
    if (length < opts.minLength) return { valid: false, reason: 'too-short', length: length };
    if (length > opts.maxLength) return { valid: false, reason: 'ink-exhausted', length: length };
    let farthestX = first.x;
    for (const point of points) {
      if (point.y < opts.minY || point.y > opts.maxY) return { valid: false, reason: 'outside-canvas-band', length: length };
      if (point.x < farthestX - opts.maxBacktrack) return { valid: false, reason: 'backtracked-too-far', length: length };
      farthestX = Math.max(farthestX, point.x);
    }
    return { valid: true, reason: 'connected', length: length };
  }

  function loadingProgress(x, minX, maxX) {
    const ratio = clamp((x - minX) / Math.max(1, maxX - minX), 0, 1);
    return Math.round(43 + ratio * 57);
  }

  const api = { clamp, nextDualHold, spreadWidth, strokeLength, validateStroke, loadingProgress };
  root.GuaiqiRoundTwoLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
