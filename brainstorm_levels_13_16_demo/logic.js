(function (root) {
  'use strict';

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function nextDualHold(current, leftHeld, rightHeld, dt, required) {
    const target = required || 1;
    return leftHeld && rightHeld ? clamp(current + dt, 0, target) : 0;
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

  function nextUndecidedIndex(levels, decisions) {
    const catalog = Array.isArray(levels) ? levels : [];
    const resolved = decisions && typeof decisions === 'object' ? decisions : {};
    return catalog.findIndex(function (level) { return !resolved[level.id]; });
  }

  function summarizeReview(levels, decisions) {
    const accepted = [];
    const discarded = [];
    (Array.isArray(levels) ? levels : []).forEach(function (level) {
      const entry = decisions && decisions[level.id];
      if (!entry) return;
      if (entry.decision === 'accept') accepted.push(level.id);
      else if (entry.decision === 'discard') discarded.push(level.id);
    });
    return { total: Array.isArray(levels) ? levels.length : 0, decided: accepted.length + discarded.length, accepted: accepted, discarded: discarded };
  }

  function nextHold(current, active, dt, target, decay) {
    const limit = Math.max(0, Number(target) || 0);
    const step = Math.max(0, Number(dt) || 0);
    return active ? clamp(current + step, 0, limit) : clamp(current - step * (decay == null ? 1 : decay), 0, limit);
  }

  function isSunAligned(x, y) {
    return x > 720 && x < 1040 && y < 330;
  }

  function advanceSequence(current, input, target) {
    const prefix = Array.isArray(current) ? current.slice() : [];
    const goal = Array.isArray(target) ? target : [];
    const expected = goal[prefix.length];
    if (input === expected) return prefix.concat(input);
    return input === goal[0] ? [input] : [];
  }

  const api = { clamp, nextDualHold, strokeLength, validateStroke, nextUndecidedIndex, summarizeReview, nextHold, isSunAligned, advanceSequence };
  root.GuaiqiRoundTwoLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
