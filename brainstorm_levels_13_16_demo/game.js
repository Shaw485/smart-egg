(function () {
  'use strict';

  const VERSION = 'review-13-42-v1';
  const W = 1920;
  const H = 1080;
  const GROUND_Y = 790;
  const UI_Y = 870;
  const STORAGE_KEY = 'guaiqi-level-review-13-42-v1';
  const LEVELS = window.GuaiqiReviewLevels || [];
  const logic = window.GuaiqiRoundTwoLogic;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const logger = new window.GuaiqiRoundTwoLogger({ version: VERSION, maxEntries: 1500, minLevel: 'info' });

  [
    'runtime', 'state', 'ui', 'input', 'gesture', 'render', 'review', 'storage', 'export', 'audio',
    'mechanic:bridge', 'mechanic:door', 'mechanic:timing', 'mechanic:direction',
    'mechanic:drag', 'mechanic:password', 'mechanic:platform', 'mechanic:transform',
    'mechanic:sound', 'mechanic:erase'
  ].forEach(function (name) { logger.setModule(name, true); });
  logger.setModule('physics', false);

  const HIT = {
    hint: { x: 260, y: 38, w: 86, h: 86 },
    reset: { x: 360, y: 38, w: 86, h: 86 },
    pause: { x: 460, y: 38, w: 86, h: 86 },
    accept: { x: 1510, y: 42, w: 174, h: 70 },
    discard: { x: 1698, y: 42, w: 174, h: 70 },
    left: { x: 120, y: 895, w: 180, h: 135 },
    right: { x: 330, y: 895, w: 180, h: 135 },
    jump: { x: 1615, y: 895, w: 185, h: 135 },
    pauseResume: { x: 785, y: 580, w: 350, h: 96 }
  };

  const heldKeys = new Set();
  const heldControls = new Map();
  const pointerModes = new Map();
  const activePointers = new Map();
  let screen = 'level';
  let status = 'playing';
  let currentIndex = 0;
  let level = null;
  let frame = 0;
  let lastTime = performance.now();
  let levelStartedAt = lastTime;
  let hintVisible = false;
  let audioContext = null;
  let review = loadReview();

  const player = {
    x: 350, y: GROUND_Y - 72, w: 70, h: 144,
    vx: 0, vy: 0, onGround: true, onFloorType: 'ground', facing: 1, jumpCount: 0
  };
  const state = {};

  function createMechanicState() {
    return {
      bridgeBuilt: false,
      dualHold: 0,
      dualStarted: false,
      inkPath: [],
      inkBridge: false,
      inkErrorUntil: 0,
      doorX: 1580,
      doorY: GROUND_Y,
      doorOpen: false,
      doorHeld: false,
      doorVY: 0,
      doorMoving: false,
      waitTime: 0,
      sunX: 1535,
      sunY: 180,
      wordX: 950,
      wordY: 330,
      knocks: 0,
      knockFlashUntil: 0,
      flowerRemaining: [3, 1, 2, 5],
      flowerFlashUntil: [0, 0, 0, 0],
      blockHitLock: -1,
      passwordInput: '',
      keyCollected: false,
      keyX: 1080,
      keyHeld: false,
      platformX: 650,
      platformDX: 0,
      cloudY: 575,
      cloudHold: false,
      cloudHoldTime: 0,
      decoyTouched: false,
      titleX: W / 2,
      titleY: 95,
      freeze: false,
      faceTime: 0,
      groundPhase: 0,
      boxX: 980,
      gravityFlipped: false,
      soundSequence: [],
      soundFlash: -1,
      soundFlashUntil: 0,
      wallErase: 0,
      startVisited: false,
      movingDoorLocked: false,
      lastMechanicMilestone: -1,
      toast: '',
      toastUntil: 0
    };
  }

  function resetMechanicState() {
    const fresh = createMechanicState();
    Object.keys(state).forEach(function (key) { delete state[key]; });
    Object.assign(state, fresh);
    if (level && level.mechanic === 'runaway_door') state.doorX = 1430;
    if (level && level.mechanic === 'drag_door') state.doorX = 1660;
    if (level && level.mechanic === 'flee_key') state.keyX = 1260;
  }

  function safeReviewShape(value) {
    const raw = value && typeof value === 'object' ? value : {};
    const decisions = raw.decisions && typeof raw.decisions === 'object' ? raw.decisions : {};
    const clean = {};
    LEVELS.forEach(function (item) {
      const entry = decisions[item.id];
      if (!entry || (entry.decision !== 'accept' && entry.decision !== 'discard')) return;
      clean[item.id] = {
        id: item.id,
        decision: entry.decision,
        mechanic: item.mechanic,
        creator: item.creator.slice(),
        completed: Boolean(entry.completed),
        elapsed_ms: Math.max(0, Number(entry.elapsed_ms) || 0),
        decided_at: String(entry.decided_at || '')
      };
    });
    return { schema: 'guaiqi-level-review-v1', version: VERSION, decisions: clean };
  }

  function loadReview() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return safeReviewShape(stored ? JSON.parse(stored) : null);
    } catch (error) {
      logger.log('storage', 'review-load-failed', {
        operation: 'localStorage.getItem/JSON.parse',
        message: error && error.message,
        fallback: 'empty-review'
      }, 'warn');
      return safeReviewShape(null);
    }
  }

  function saveReview() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(review));
      log('storage', 'review-save-success', { decided_count: Object.keys(review.decisions).length });
      return true;
    } catch (error) {
      log('storage', 'review-save-failed', { operation: 'localStorage.setItem', message: error && error.message }, 'error');
      return false;
    }
  }

  function log(module, event, context, levelName) {
    return logger.log(module, event, Object.assign({
      frame: frame,
      screen: screen,
      status: status,
      level: level ? level.id : null,
      mechanic: level ? level.mechanic : null
    }, context || {}), levelName);
  }

  function roundedRect(x, y, w, h, radius, fill, stroke, lineWidth) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 4; ctx.stroke(); }
  }

  function clamp(value, min, max) {
    return logic && logic.clamp ? logic.clamp(value, min, max) : Math.max(min, Math.min(max, value));
  }

  function inside(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function near(point, x, y, rx, ry) {
    return Math.abs(point.x - x) <= (rx || 70) && Math.abs(point.y - y) <= (ry || rx || 70);
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    log('render', 'resize', { dpr: dpr, backing_w: canvas.width, backing_h: canvas.height }, 'debug');
  }

  function tone(frequency, duration, volume) {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(volume || .055, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
      log('audio', 'tone-play', { frequency: frequency, duration_ms: Math.round(duration * 1000) }, 'debug');
    } catch (error) {
      log('audio', 'tone-failed', { operation: 'WebAudio tone', message: error && error.message }, 'warn');
    }
  }

  function clearLiveInput(reason) {
    heldKeys.clear();
    heldControls.clear();
    pointerModes.clear();
    activePointers.clear();
    state.doorHeld = false;
    state.keyHeld = false;
    state.cloudHold = false;
    state.freeze = false;
    log('input', 'all-input-reset', { reason: reason });
  }

  function resetPlayer() {
    player.w = 70;
    player.h = 144;
    player.x = level && level.mechanic === 'start_backward' ? 430 : 350;
    player.y = GROUND_Y - player.h / 2;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.onFloorType = 'ground';
    player.facing = 1;
    player.jumpCount = 0;
  }

  function firstUndecidedIndex() {
    return logic.nextUndecidedIndex(LEVELS, review.decisions);
  }

  function enterLevel(index, reason) {
    currentIndex = clamp(index, 0, LEVELS.length - 1);
    level = LEVELS[currentIndex];
    screen = 'level';
    status = 'playing';
    hintVisible = false;
    levelStartedAt = performance.now();
    clearLiveInput('level-enter');
    resetMechanicState();
    resetPlayer();
    log('state', 'level-enter', {
      reason: reason || 'review-sequence',
      review_index: currentIndex,
      remaining: LEVELS.length - Object.keys(review.decisions).length,
      creator_mechanics: level.creator
    });
    log('render', 'drop-terrain-layout', {
      style: 'high-cliff-v3',
      gaps: terrainLayout().gaps,
      collision_geometry_changed: false
    });
  }

  function restart(reason) {
    if (!level) return;
    const id = level.id;
    enterLevel(currentIndex, reason || 'restart');
    log('state', 'level-restarted', { level_id: id, reason: reason || 'restart' });
    tone(180, .08);
  }

  function setPaused(paused, source) {
    if (!level || status === 'success') return;
    status = paused ? 'paused' : 'playing';
    hintVisible = false;
    clearLiveInput(paused ? 'pause-open' : 'pause-resume');
    log('state', paused ? 'playing-to-paused' : 'paused-to-playing', { source: source });
    tone(paused ? 260 : 420, .05);
  }

  function complete(reason) {
    if (status !== 'playing') return;
    status = 'success';
    clearLiveInput('level-complete');
    log('state', 'level-complete', { reason: reason, elapsed_ms: Math.round(performance.now() - levelStartedAt) });
    tone(660, .11);
    setTimeout(function () { tone(880, .14); }, 120);
  }

  function recordDecision(decision, source) {
    if (!level || screen !== 'level' || review.decisions[level.id]) return;
    const entry = {
      id: level.id,
      decision: decision,
      mechanic: level.mechanic,
      creator: level.creator.slice(),
      completed: status === 'success',
      elapsed_ms: Math.round(performance.now() - levelStartedAt),
      decided_at: new Date().toISOString()
    };
    review.decisions[level.id] = entry;
    log('review', 'level-decision', {
      decision: decision,
      source: source,
      completed: entry.completed,
      elapsed_ms: entry.elapsed_ms,
      creator_mechanics: entry.creator
    });
    saveReview();
    tone(decision === 'accept' ? 720 : 170, .11);
    const next = firstUndecidedIndex();
    if (next < 0) {
      screen = 'summary';
      status = 'summary';
      level = null;
      clearLiveInput('review-complete');
      log('review', 'review-batch-complete', reviewSummary());
    } else {
      enterLevel(next, 'decision-' + decision);
    }
  }

  function reviewSummary() {
    return logic.summarizeReview(LEVELS, review.decisions);
  }

  function toast(message, duration) {
    state.toast = message;
    state.toastUntil = performance.now() + (duration || 1200);
  }

  function controlForPoint(point) {
    if (inside(point, HIT.left)) return 'left';
    if (inside(point, HIT.right)) return 'right';
    if (inside(point, HIT.jump)) return 'jump';
    return '';
  }

  function controlHeld(name) {
    for (const value of heldControls.values()) if (value === name) return true;
    return false;
  }

  function leftHeld() { return heldKeys.has('KeyA') || heldKeys.has('ArrowLeft') || controlHeld('left'); }
  function rightHeld() { return heldKeys.has('KeyD') || heldKeys.has('ArrowRight') || controlHeld('right'); }
  function jumpHeld() { return heldKeys.has('Space') || heldKeys.has('KeyW') || heldKeys.has('ArrowUp') || controlHeld('jump'); }
  function freezeHeld() { return heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight') || state.freeze; }

  function movementDirection() {
    let direction = (rightHeld() ? 1 : 0) - (leftHeld() ? 1 : 0);
    if (level && level.mechanic === 'reverse_controls') direction *= -1;
    return direction;
  }

  function tryJump(source) {
    if (!level || screen !== 'level' || status !== 'playing') return false;
    const maxJumps = level.mechanic === 'double_jump' ? 2 : 1;
    if (!player.onGround && player.jumpCount >= maxJumps) return false;
    const gravityUp = level.mechanic === 'gravity_flip' && state.gravityFlipped;
    player.vy = gravityUp ? 900 : -900;
    player.onGround = false;
    player.jumpCount += 1;
    if (level.mechanic === 'door_jumps' && !state.movingDoorLocked) state.doorVY = -880;
    log('input', 'jump', { source: source, jump_count: player.jumpCount, gravity_up: gravityUp });
    tone(360, .06);
    return true;
  }

  function doorRect() {
    const x = state.doorX;
    const platformY = state.doorY;
    return { x: x - 78, y: platformY - 230, w: 156, h: 230 };
  }

  function keypadRects() {
    const rects = [];
    for (let digit = 1; digit <= 9; digit += 1) {
      const index = digit - 1;
      rects.push({ digit: String(digit), x: 760 + (index % 3) * 135, y: 315 + Math.floor(index / 3) * 100, w: 115, h: 82 });
    }
    rects.push({ digit: '0', x: 760, y: 615, w: 250, h: 82 });
    rects.push({ digit: 'back', x: 1030, y: 615, w: 250, h: 82 });
    return rects;
  }

  function flowerBlocks() {
    return [600, 840, 1080, 1320].map(function (x, index) { return { x: x, y: 545, w: 120, h: 95, index: index }; });
  }

  function startInkStroke(event, point) {
    if (!(point.x >= 570 && point.x <= 730 && point.y >= 625 && point.y <= 825)) {
      log('gesture', 'ink-start-rejected', { x: Math.round(point.x), y: Math.round(point.y), reason: 'outside-left-bank' }, 'warn');
      return false;
    }
    hintVisible = false;
    pointerModes.set(event.pointerId, { type: 'ink', points: [point], length: 0, overBudgetLogged: false });
    log('gesture', 'ink-stroke-start', { x: Math.round(point.x), y: Math.round(point.y), max_length: 860 });
    return true;
  }

  function updateInkStroke(event, point) {
    const mode = pointerModes.get(event.pointerId);
    if (!mode || mode.type !== 'ink') return;
    const previous = mode.points[mode.points.length - 1];
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance < 8) return;
    mode.points.push(point);
    mode.length += distance;
    if (mode.length > 860 && !mode.overBudgetLogged) {
      mode.overBudgetLogged = true;
      log('gesture', 'ink-budget-exceeded', { length: Math.round(mode.length), max_length: 860 }, 'warn');
    }
  }

  function finishInkStroke(event) {
    const mode = pointerModes.get(event.pointerId);
    if (!mode || mode.type !== 'ink') return;
    const result = logic.validateStroke(mode.points);
    log('gesture', 'ink-stroke-end', { accepted: result.valid, reason: result.reason, length: Math.round(result.length), point_count: mode.points.length }, result.valid ? 'info' : 'warn');
    state.inkPath = mode.points.slice();
    if (result.valid) {
      state.inkBridge = true;
      log('mechanic:bridge', 'ink-bridge-created', { x: 650, y: GROUND_Y, width: 620 });
      tone(620, .1);
    } else {
      state.inkBridge = false;
      state.inkErrorUntil = performance.now() + 1400;
      toast('这道痕迹还站不住。', 1400);
      tone(145, .09);
    }
  }

  function registerMechanicPointerDown(event, point) {
    const mechanic = level.mechanic;
    if (mechanic === 'ink_path') return startInkStroke(event, point);
    if (mechanic === 'runaway_door' && inside(point, doorRect())) {
      state.doorHeld = true;
      pointerModes.set(event.pointerId, { type: 'hold-door' });
      log('mechanic:door', 'runaway-door-held', { door_x: Math.round(state.doorX) });
      return true;
    }
    if (mechanic === 'shadow_sun' && near(point, state.sunX, state.sunY, 90, 90)) {
      pointerModes.set(event.pointerId, { type: 'drag-sun', offsetX: state.sunX - point.x, offsetY: state.sunY - point.y });
      log('mechanic:drag', 'sun-drag-start', { x: Math.round(state.sunX), y: Math.round(state.sunY) });
      return true;
    }
    if (mechanic === 'word_bridge' && near(point, state.wordX, state.wordY, 95, 70)) {
      pointerModes.set(event.pointerId, { type: 'drag-word', offsetX: state.wordX - point.x, offsetY: state.wordY - point.y });
      log('mechanic:drag', 'word-drag-start', { x: Math.round(state.wordX), y: Math.round(state.wordY) });
      return true;
    }
    if (mechanic === 'knock_twice' && inside(point, doorRect())) {
      const closeEnough = Math.abs(player.x - state.doorX) < 230;
      state.knockFlashUntil = performance.now() + 420;
      tone(105, .13, .09);
      if (closeEnough) state.knocks = Math.min(2, state.knocks + 1);
      log('mechanic:door', 'door-knock', { close_enough: closeEnough, counted_knocks: state.knocks, distance: Math.round(Math.abs(player.x - state.doorX)) });
      if (state.knocks >= 2) state.doorOpen = true;
      return true;
    }
    if (mechanic === 'flower_password' && state.flowerRemaining.every(function (count) { return count === 0; }) && Math.abs(player.x - state.doorX) < 330) {
      const key = keypadRects().find(function (item) { return inside(point, item); });
      if (key) {
        if (key.digit === 'back') state.passwordInput = state.passwordInput.slice(0, -1);
        else if (state.passwordInput.length < 4) state.passwordInput += key.digit;
        log('mechanic:password', 'keypad-input', { action: key.digit === 'back' ? 'backspace' : 'digit', input_length: state.passwordInput.length });
        tone(key.digit === 'back' ? 170 : 450 + Number(key.digit || 0) * 15, .045);
        if (state.passwordInput.length === 4) {
          if (state.passwordInput === '3125') {
            state.doorOpen = true;
            log('mechanic:password', 'password-accepted', { digits: 4 });
            tone(760, .12);
          } else {
            log('mechanic:password', 'password-rejected', { digits: 4 }, 'warn');
            state.passwordInput = '';
            toast('顺序不对。', 900);
          }
        }
        return true;
      }
    }
    if (mechanic === 'shrink_tunnel' && near(point, player.x, player.y, 75, 95)) {
      const feet = player.y + player.h / 2;
      const becomingSmall = player.h > 100;
      player.h = becomingSmall ? 84 : 144;
      player.w = becomingSmall ? 48 : 70;
      player.y = feet - player.h / 2;
      log('mechanic:transform', 'player-size-toggle', { small: becomingSmall, width: player.w, height: player.h });
      tone(becomingSmall ? 620 : 300, .07);
      return true;
    }
    if (mechanic === 'cloud_hold' && near(point, 960, state.cloudY, 160, 55)) {
      state.cloudHold = true;
      pointerModes.set(event.pointerId, { type: 'hold-cloud' });
      log('mechanic:platform', 'cloud-hold-start', { y: Math.round(state.cloudY) });
      return true;
    }
    if (mechanic === 'decoy_door') {
      const leftDoor = { x: 1160, y: GROUND_Y - 220, w: 150, h: 220 };
      if (inside(point, leftDoor)) {
        state.decoyTouched = true;
        state.doorOpen = true;
        state.doorX = 1580;
        log('mechanic:door', 'decoy-mark-touched', { real_door_x: state.doorX });
        tone(540, .09);
        return true;
      }
    }
    if (mechanic === 'title_platform' && near(point, state.titleX, state.titleY, 220, 65)) {
      pointerModes.set(event.pointerId, { type: 'drag-title', offsetX: state.titleX - point.x, offsetY: state.titleY - point.y });
      log('mechanic:drag', 'title-drag-start', { x: Math.round(state.titleX), y: Math.round(state.titleY) });
      return true;
    }
    if (mechanic === 'freeze_spikes' && point.y < UI_Y) {
      state.freeze = true;
      pointerModes.set(event.pointerId, { type: 'freeze-world' });
      log('mechanic:timing', 'hazards-freeze-start', { input: event.pointerType });
      return true;
    }
    if (mechanic === 'drag_door' && inside(point, doorRect())) {
      pointerModes.set(event.pointerId, { type: 'drag-door', offsetX: state.doorX - point.x });
      log('mechanic:drag', 'door-drag-start', { door_x: Math.round(state.doorX) });
      return true;
    }
    if (mechanic === 'door_jumps' && inside(point, doorRect()) && state.doorY < GROUND_Y - 45) {
      state.movingDoorLocked = true;
      state.doorOpen = true;
      state.doorVY = 0;
      log('mechanic:door', 'airborne-door-locked', { door_y: Math.round(state.doorY) });
      tone(700, .1);
      return true;
    }
    if (mechanic === 'ground_swap' && point.y > 700 && point.y < UI_Y) {
      if (point.x > 560 && point.x < 760) state.groundPhase = 0;
      else if (point.x > 1160 && point.x < 1380) state.groundPhase = 1;
      else return false;
      log('mechanic:platform', 'ground-phase-change', { phase: state.groundPhase, source_x: Math.round(point.x) });
      tone(state.groundPhase ? 540 : 380, .07);
      return true;
    }
    if (mechanic === 'flee_key' && near(point, state.keyX, GROUND_Y - 95, 70, 90)) {
      state.keyHeld = true;
      pointerModes.set(event.pointerId, { type: 'hold-key' });
      log('mechanic:drag', 'flee-key-held', { key_x: Math.round(state.keyX) });
      return true;
    }
    if (mechanic === 'gravity_flip' && near(point, 1450, 190, 80, 80)) {
      state.gravityFlipped = !state.gravityFlipped;
      player.onGround = false;
      player.vy = state.gravityFlipped ? -120 : 120;
      log('mechanic:transform', 'gravity-flipped', { direction: state.gravityFlipped ? 'up' : 'down' });
      tone(state.gravityFlipped ? 660 : 260, .12);
      return true;
    }
    if (mechanic === 'sound_order') {
      const stones = [700, 960, 1220];
      const index = stones.findIndex(function (x) { return near(point, x, GROUND_Y - 35, 90, 70); });
      if (index >= 0) {
        const frequencies = [330, 220, 440];
        tone(frequencies[index], .18, .08);
        state.soundFlash = index;
        state.soundFlashUntil = performance.now() + 330;
        const target = [1, 0, 2];
        state.soundSequence = logic.advanceSequence(state.soundSequence, index, target);
        log('mechanic:sound', 'tone-stone', { stone: index, frequency: frequencies[index], correct_prefix_length: state.soundSequence.length });
        if (state.soundSequence.length === 3) state.doorOpen = true;
        return true;
      }
    }
    if (mechanic === 'erase_wall' && point.x >= 870 && point.x <= 1050 && point.y >= 430 && point.y <= GROUND_Y) {
      pointerModes.set(event.pointerId, { type: 'erase-wall', last: point });
      log('mechanic:erase', 'wall-erase-start', { progress: Number(state.wallErase.toFixed(2)) });
      return true;
    }
    return false;
  }

  function onPointerDown(event) {
    const point = pointFromEvent(event);
    activePointers.set(event.pointerId, point);
    try { canvas.setPointerCapture(event.pointerId); } catch (error) { log('input', 'pointer-capture-failed', { message: error.message }, 'warn'); }

    if (screen === 'summary') return;
    if (inside(point, HIT.accept)) { recordDecision('accept', 'canvas-button'); return; }
    if (inside(point, HIT.discard)) { recordDecision('discard', 'canvas-button'); return; }
    if (status === 'paused') {
      if (inside(point, HIT.pauseResume) || inside(point, HIT.pause)) setPaused(false, 'pause-resume-button');
      return;
    }
    if (inside(point, HIT.hint)) {
      hintVisible = !hintVisible;
      log('ui', 'hint-toggle', { visible: hintVisible });
      tone(520, .05);
      return;
    }
    if (inside(point, HIT.reset)) { restart('top-button'); return; }
    if (inside(point, HIT.pause)) { setPaused(true, 'top-button'); return; }
    if (status !== 'playing') return;

    const control = controlForPoint(point);
    if (control) {
      heldControls.set(event.pointerId, control);
      pointerModes.set(event.pointerId, { type: 'control', control: control });
      if (control === 'jump') tryJump('pointer');
      log('input', 'control-down', { pointer_id: event.pointerId, pointer_type: event.pointerType, control: control });
      return;
    }
    registerMechanicPointerDown(event, point);
  }

  function onPointerMove(event) {
    const point = pointFromEvent(event);
    activePointers.set(event.pointerId, point);
    const mode = pointerModes.get(event.pointerId);
    if (!mode || status !== 'playing') return;
    if (mode.type === 'ink') updateInkStroke(event, point);
    else if (mode.type === 'drag-sun') {
      state.sunX = clamp(point.x + mode.offsetX, 250, 1680);
      state.sunY = clamp(point.y + mode.offsetY, 145, 420);
    } else if (mode.type === 'drag-word') {
      state.wordX = clamp(point.x + mode.offsetX, 120, 1800);
      state.wordY = clamp(point.y + mode.offsetY, 170, 825);
      if (state.wordX > 690 && state.wordX < 1230 && state.wordY > 670) state.bridgeBuilt = true;
    } else if (mode.type === 'drag-title') {
      state.titleX = clamp(point.x + mode.offsetX, 260, 1660);
      state.titleY = clamp(point.y + mode.offsetY, 90, 820);
      if (state.titleX > 690 && state.titleX < 1230 && state.titleY > 675) state.bridgeBuilt = true;
    } else if (mode.type === 'drag-door') {
      state.doorX = clamp(point.x + mode.offsetX, 230, 1740);
      state.doorOpen = Math.abs(state.doorX - player.x) < 260;
    } else if (mode.type === 'erase-wall') {
      const distance = Math.hypot(point.x - mode.last.x, point.y - mode.last.y);
      mode.last = point;
      state.wallErase = clamp(state.wallErase + distance / 950, 0, 1);
      if (state.wallErase >= 1) state.doorOpen = true;
    }
  }

  function onPointerUp(event) {
    const mode = pointerModes.get(event.pointerId);
    const releasedControl = heldControls.get(event.pointerId);
    heldControls.delete(event.pointerId);
    activePointers.delete(event.pointerId);
    if (releasedControl) log('input', 'control-up', { pointer_id: event.pointerId, control: releasedControl });
    if (mode && mode.type === 'ink') finishInkStroke(event);
    if (mode && mode.type === 'hold-door') {
      state.doorHeld = false;
      log('mechanic:door', 'runaway-door-released', { door_x: Math.round(state.doorX) });
    }
    if (mode && mode.type === 'hold-key') {
      state.keyHeld = false;
      log('mechanic:drag', 'flee-key-released', { key_x: Math.round(state.keyX) });
    }
    if (mode && mode.type === 'hold-cloud') {
      state.cloudHold = false;
      log('mechanic:platform', 'cloud-hold-end', { held_seconds: Number(state.cloudHoldTime.toFixed(2)), y: Math.round(state.cloudY) });
    }
    if (mode && mode.type === 'freeze-world') {
      state.freeze = false;
      log('mechanic:timing', 'hazards-freeze-end', {});
    }
    if (mode && mode.type === 'drag-sun') log('mechanic:drag', 'sun-drag-end', { x: Math.round(state.sunX), y: Math.round(state.sunY), door_open: state.doorOpen });
    if (mode && mode.type === 'drag-word') log('mechanic:drag', 'word-drag-end', { x: Math.round(state.wordX), y: Math.round(state.wordY), bridge: state.bridgeBuilt });
    if (mode && mode.type === 'drag-title') log('mechanic:drag', 'title-drag-end', { x: Math.round(state.titleX), y: Math.round(state.titleY), bridge: state.bridgeBuilt });
    if (mode && mode.type === 'drag-door') log('mechanic:drag', 'door-drag-end', { x: Math.round(state.doorX), door_open: state.doorOpen });
    if (mode && mode.type === 'erase-wall') log('mechanic:erase', 'wall-erase-end', { progress: Number(state.wallErase.toFixed(2)), erased: state.wallErase >= 1 });
    pointerModes.delete(event.pointerId);
  }

  window.addEventListener('keydown', function (event) {
    const code = event.code || '';
    if (['KeyA', 'KeyD', 'KeyW', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyR', 'KeyP', 'Escape', 'ShiftLeft', 'ShiftRight'].includes(code)) event.preventDefault();
    if (event.repeat) return;
    if ((code === 'KeyP' || code === 'Escape') && screen === 'level' && (status === 'playing' || status === 'paused')) {
      setPaused(status !== 'paused', 'keyboard:' + code);
      return;
    }
    if (screen !== 'level' || status !== 'playing') return;
    heldKeys.add(code);
    log('input', 'key-down', { code: code });
    if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') tryJump('keyboard:' + code);
    if (code === 'KeyR') restart('keyboard');
    if (level.mechanic === 'flower_password' && /^Digit[0-9]$/.test(code) && state.flowerRemaining.every(function (count) { return count === 0; })) {
      const digit = code.slice(-1);
      if (state.passwordInput.length < 4) state.passwordInput += digit;
      log('mechanic:password', 'keyboard-digit', { input_length: state.passwordInput.length });
      if (state.passwordInput.length === 4) {
        if (state.passwordInput === '3125') state.doorOpen = true;
        else { state.passwordInput = ''; toast('顺序不对。', 900); }
      }
    }
    if (level.mechanic === 'sound_order' && /^Digit[1-3]$/.test(code)) {
      const stones = [700, 960, 1220];
      registerMechanicPointerDown({ pointerId: -1, pointerType: 'keyboard' }, { x: stones[Number(code.slice(-1)) - 1], y: GROUND_Y - 35 });
    }
  });

  window.addEventListener('keyup', function (event) {
    const code = event.code || '';
    heldKeys.delete(code);
    if (screen === 'level') log('input', 'key-up', { code: code });
  });
  window.addEventListener('blur', function () { clearLiveInput('window-blur'); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) clearLiveInput('document-hidden'); });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  function gapFloors(leftEdge, rightEdge, bridge) {
    const floors = [
      { x: 0, y: GROUND_Y, w: leftEdge, h: UI_Y - GROUND_Y + 24, type: 'ground' },
      { x: rightEdge, y: GROUND_Y, w: W - rightEdge, h: UI_Y - GROUND_Y + 24, type: 'ground' }
    ];
    if (bridge) floors.push(Object.assign({ x: leftEdge, y: GROUND_Y, w: rightEdge - leftEdge, h: 28, type: 'bridge', special: 'bridge' }, bridge === true ? {} : bridge));
    return floors;
  }

  function floorsForLevel() {
    if (!level) return [];
    const mechanic = level.mechanic;
    if (mechanic === 'dual_bridge') return gapFloors(720, 1200, state.bridgeBuilt);
    if (mechanic === 'ink_path') return gapFloors(650, 1270, state.inkBridge ? { type: 'ink', special: 'ink', h: 24 } : false);
    if (mechanic === 'word_bridge' || mechanic === 'title_platform') return gapFloors(650, 1270, state.bridgeBuilt);
    if (mechanic === 'jump_bridge') return gapFloors(650, 1270, jumpHeld() ? { type: 'jump-bridge', special: 'bridge' } : false);
    if (mechanic === 'invisible_bridge') return gapFloors(650, 1270, { type: 'invisible', special: 'invisible', h: 20 });
    if (mechanic === 'passenger_platform') return gapFloors(650, 1270, { x: state.platformX, w: 260, y: 748, h: 28, type: 'passenger', special: 'platform' }).filter(function (floor, index) { return index < 2 || true; });
    if (mechanic === 'double_jump') {
      return gapFloors(650, 1270, false);
    }
    if (mechanic === 'ground_swap') {
      return gapFloors(620, 1300, false).concat(state.groundPhase === 0 ? [{ x: 620, y: GROUND_Y, w: 350, h: 24, type: 'phase-a', special: 'platform' }] : [{ x: 950, y: GROUND_Y, w: 350, h: 24, type: 'phase-b', special: 'platform' }]);
    }
    if (mechanic === 'cloud_hold') {
      return [{ x: 0, y: GROUND_Y, w: W, h: 104, type: 'ground' }, { x: 835, y: state.cloudY, w: 250, h: 26, type: 'cloud', special: 'cloud' }, { x: 1350, y: 525, w: 420, h: 28, type: 'high', special: 'platform' }];
    }
    if (mechanic === 'push_box') {
      return [{ x: 0, y: GROUND_Y, w: W, h: 104, type: 'ground' }, { x: state.boxX - 65, y: GROUND_Y - 100, w: 130, h: 100, type: 'box', special: 'box' }, { x: 1450, y: 620, w: 350, h: 28, type: 'high', special: 'platform' }];
    }
    return [{ x: 0, y: GROUND_Y, w: W, h: 104, type: 'ground' }];
  }

  function terrainLayout() {
    const solids = floorsForLevel().filter(function (floor) { return floor.type === 'ground'; }).slice().sort(function (a, b) { return a.x - b.x; });
    const gaps = [];
    for (let index = 0; index < solids.length - 1; index += 1) {
      const left = solids[index].x + solids[index].w;
      const right = solids[index + 1].x;
      if (right - left > 20) gaps.push({ left: left, right: right, top: Math.min(solids[index].y, solids[index + 1].y), width: right - left });
    }
    return { grounds: solids, gaps: gaps };
  }

  function hitFlowerBlock(previousTop, nextTop) {
    if (level.mechanic !== 'flower_password' || player.vy >= 0) return;
    const block = flowerBlocks().find(function (item) {
      const bottom = item.y + item.h;
      const overlapX = player.x + player.w / 2 > item.x && player.x - player.w / 2 < item.x + item.w;
      return overlapX && previousTop >= bottom - 6 && nextTop <= bottom;
    });
    if (!block || state.blockHitLock === block.index) return;
    state.blockHitLock = block.index;
    player.y = block.y + block.h + player.h / 2;
    player.vy = 120;
    if (state.flowerRemaining[block.index] > 0) {
      state.flowerRemaining[block.index] -= 1;
      state.flowerFlashUntil[block.index] = performance.now() + 560;
      log('mechanic:password', 'flower-revealed', { block: block.index, remaining_hidden_hits: state.flowerRemaining[block.index] });
      tone(580 + block.index * 45, .07);
    } else {
      log('mechanic:password', 'empty-block-hit', { block: block.index });
      tone(150, .05);
    }
  }

  function resolveHorizontalObstacles(previousX) {
    if (level.mechanic === 'shrink_tunnel' && player.h > 100) {
      const leftWall = 710;
      const rightWall = 1320;
      if (previousX < leftWall && player.x + player.w / 2 > leftWall) player.x = leftWall - player.w / 2;
      if (previousX > rightWall && player.x - player.w / 2 < rightWall) player.x = rightWall + player.w / 2;
    }
    if (level.mechanic === 'erase_wall' && state.wallErase < 1) {
      const wallLeft = 900;
      const wallRight = 1020;
      if (previousX < wallLeft && player.x + player.w / 2 > wallLeft) player.x = wallLeft - player.w / 2;
      if (previousX > wallRight && player.x - player.w / 2 < wallRight) player.x = wallRight + player.w / 2;
    }
    if (level.mechanic === 'push_box') {
      const boxLeft = state.boxX - 65;
      const boxRight = state.boxX + 65;
      const playerBottom = player.y + player.h / 2;
      if (playerBottom > GROUND_Y - 100) {
        if (player.vx > 0 && previousX + player.w / 2 <= boxLeft + 12 && player.x + player.w / 2 > boxLeft) {
          const pushed = clamp(state.boxX + (player.x + player.w / 2 - boxLeft), 760, 1540);
          state.boxX = pushed;
          player.x = state.boxX - 65 - player.w / 2;
        } else if (player.vx < 0 && previousX - player.w / 2 >= boxRight - 12 && player.x - player.w / 2 < boxRight) {
          const pushed = clamp(state.boxX - (boxRight - (player.x - player.w / 2)), 760, 1540);
          state.boxX = pushed;
          player.x = state.boxX + 65 + player.w / 2;
        }
      }
    }
  }

  function updatePlayer(dt) {
    if (!level || status !== 'playing') return;
    const previousX = player.x;
    const direction = movementDirection();
    player.vx = direction * 315;
    if (direction) player.facing = direction;
    let carry = 0;
    if (level.mechanic === 'passenger_platform' && player.onFloorType === 'passenger') carry = state.platformDX;
    player.x += player.vx * dt + carry;
    player.x = clamp(player.x, 48, W - 48);
    resolveHorizontalObstacles(previousX);

    const gravityUp = level.mechanic === 'gravity_flip' && state.gravityFlipped;
    const gravity = gravityUp ? -1900 : 1900;
    player.vy = clamp(player.vy + gravity * dt, -1250, 1250);
    const previousBottom = player.y + player.h / 2;
    const previousTop = player.y - player.h / 2;
    player.y += player.vy * dt;
    const nextBottom = player.y + player.h / 2;
    const nextTop = player.y - player.h / 2;
    player.onGround = false;
    player.onFloorType = '';

    if (gravityUp) {
      const ceilingY = 250;
      if (player.vy <= 0 && previousTop >= ceilingY - 8 && nextTop <= ceilingY) {
        player.y = ceilingY + player.h / 2;
        player.vy = 0;
        player.onGround = true;
        player.onFloorType = 'ceiling';
        player.jumpCount = 0;
      }
    } else {
      hitFlowerBlock(previousTop, nextTop);
      const landingCandidates = [];
      floorsForLevel().forEach(function (floor) {
        const overlapX = player.x + player.w / 2 > floor.x && player.x - player.w / 2 < floor.x + floor.w;
        if (overlapX && player.vy >= 0 && previousBottom <= floor.y + 9 && nextBottom >= floor.y) landingCandidates.push(floor);
      });
      if (landingCandidates.length) {
        const landing = landingCandidates.reduce(function (best, floor) { return floor.y < best.y ? floor : best; });
        player.y = landing.y - player.h / 2;
        player.vy = 0;
        player.onGround = true;
        player.onFloorType = landing.type || 'ground';
        player.jumpCount = 0;
        state.blockHitLock = -1;
      }
    }

    if (level.mechanic === 'shadow_key' && !state.keyCollected && Math.abs(player.x - 930) < 55) {
      state.keyCollected = true;
      state.doorOpen = true;
      log('mechanic:door', 'shadow-key-collected', { x: Math.round(player.x) });
      tone(720, .1);
    }
    if (level.mechanic === 'flee_key' && !state.keyCollected && Math.abs(player.x - state.keyX) < 58 && state.keyHeld) {
      state.keyCollected = true;
      state.doorOpen = true;
      log('mechanic:door', 'flee-key-collected', { x: Math.round(state.keyX) });
      tone(720, .1);
    }
    if (level.mechanic === 'freeze_spikes' && !freezeHeld() && player.x > 760 && player.x < 1300) {
      const dangerous = Math.sin(frame * .15) > -.25;
      if (dangerous) {
        log('physics', 'spike-contact-reset', { x: Math.round(player.x), frozen: false }, 'warn');
        resetPlayer();
        tone(110, .1);
      }
    }
    if (player.y > H + 150 || player.y < -170) {
      log('physics', 'player-out-of-bounds', { x: Math.round(player.x), y: Math.round(player.y), gravity_up: gravityUp }, 'warn');
      resetPlayer();
      tone(120, .12);
    }
  }

  function markMilestone(module, name, value, total) {
    const percent = Math.floor(clamp(value / total, 0, 1) * 4) * 25;
    if (percent <= state.lastMechanicMilestone || percent >= 100) return;
    state.lastMechanicMilestone = percent;
    log(module, name, { percent: percent, value: Number(value.toFixed(2)), target: total });
  }

  function updateMechanic(dt) {
    if (!level || status !== 'playing') return;
    const mechanic = level.mechanic;
    const direction = movementDirection();

    if (mechanic === 'dual_bridge') {
      const both = leftHeld() && rightHeld();
      state.dualHold = logic.nextHold(state.dualHold, both, dt, 1, 1.8);
      if (both && !state.dualStarted) {
        state.dualStarted = true;
        log('mechanic:bridge', 'dual-hold-start', { required_seconds: 1 });
      }
      if (!both && state.dualStarted && !state.bridgeBuilt) {
        state.dualStarted = false;
        state.lastMechanicMilestone = -1;
        log('mechanic:bridge', 'dual-hold-cancel', { held_seconds: Number(state.dualHold.toFixed(2)) });
      }
      markMilestone('mechanic:bridge', 'dual-hold-progress', state.dualHold, 1);
      if (!state.bridgeBuilt && state.dualHold >= 1) {
        state.bridgeBuilt = true;
        log('mechanic:bridge', 'dual-bridge-created', { x: 720, width: 480 });
        tone(620, .12);
      }
      state.doorOpen = state.bridgeBuilt;
    } else if (mechanic === 'runaway_door') {
      const distance = state.doorX - player.x;
      state.doorMoving = false;
      if (!state.doorHeld && Math.abs(distance) < 480 && direction !== 0) {
        const desired = direction * 315;
        state.doorX = clamp(state.doorX + desired * dt, 150, 1885);
        state.doorMoving = true;
      }
      state.doorOpen = state.doorHeld && Math.abs(state.doorX - player.x) < 170;
    } else if (mechanic === 'ink_path') {
      state.doorOpen = state.inkBridge;
    } else if (mechanic === 'silent_wait') {
      const nearDoor = Math.abs(player.x - state.doorX) < 250;
      const still = direction === 0 && player.onGround && Math.abs(player.vx) < 1;
      state.waitTime = logic.nextHold(state.waitTime, nearDoor && still, dt, 2.1, 2.5);
      markMilestone('mechanic:timing', 'silence-progress', state.waitTime, 2.1);
      if (state.waitTime >= 2.1) state.doorOpen = true;
    } else if (mechanic === 'reverse_controls') {
      state.doorOpen = true;
    } else if (mechanic === 'shadow_sun') {
      const aligned = logic.isSunAligned(state.sunX, state.sunY);
      if (aligned !== state.doorOpen) log('mechanic:drag', 'shadow-alignment-change', { aligned: aligned, sun_x: Math.round(state.sunX), sun_y: Math.round(state.sunY) });
      state.doorOpen = aligned;
    } else if (mechanic === 'word_bridge' || mechanic === 'title_platform') {
      state.doorOpen = state.bridgeBuilt;
    } else if (mechanic === 'knock_twice') {
      state.doorOpen = state.knocks >= 2;
    } else if (mechanic === 'flower_password') {
      // 开门由密码输入处理。
    } else if (mechanic === 'shadow_key') {
      state.doorOpen = state.keyCollected;
    } else if (mechanic === 'passenger_platform') {
      const before = state.platformX;
      const playerOnPlatform = player.onFloorType === 'passenger';
      if (playerOnPlatform && direction === 0) state.platformX = clamp(state.platformX + 140 * dt, 650, 1010);
      else if (!playerOnPlatform) state.platformX = clamp(state.platformX - 80 * dt, 650, 1010);
      state.platformDX = state.platformX - before;
      state.doorOpen = state.platformX > 980;
    } else if (mechanic === 'shrink_tunnel') {
      state.doorOpen = player.h < 100;
    } else if (mechanic === 'cloud_hold') {
      const before = state.cloudY;
      if (state.cloudHold) {
        state.cloudHoldTime += dt;
        state.cloudY = clamp(state.cloudY + 185 * dt, 575, 735);
      } else {
        state.cloudY = clamp(state.cloudY - 150 * dt, 525, 735);
      }
      const dy = state.cloudY - before;
      if (player.onFloorType === 'cloud') player.y += dy;
      state.doorOpen = true;
    } else if (mechanic === 'decoy_door') {
      state.doorOpen = state.decoyTouched;
    } else if (mechanic === 'freeze_spikes') {
      state.doorOpen = true;
    } else if (mechanic === 'double_jump') {
      state.doorOpen = true;
    } else if (mechanic === 'face_away') {
      const close = Math.abs(player.x - state.doorX) < 235;
      if (close && player.facing < 0 && direction === 0) state.faceTime = clamp(state.faceTime + dt, 0, 1.2);
      else state.faceTime = Math.max(0, state.faceTime - dt * 2);
      markMilestone('mechanic:direction', 'face-away-progress', state.faceTime, 1.2);
      if (state.faceTime >= 1.2) state.doorOpen = true;
    } else if (mechanic === 'drag_door') {
      state.doorOpen = Math.abs(state.doorX - player.x) < 260;
    } else if (mechanic === 'invisible_bridge') {
      state.doorOpen = true;
    } else if (mechanic === 'mirror_world') {
      state.doorOpen = true;
    } else if (mechanic === 'jump_bridge') {
      state.doorOpen = jumpHeld();
    } else if (mechanic === 'door_jumps') {
      if (!state.movingDoorLocked) {
        state.doorVY = Math.min(1100, state.doorVY + 1850 * dt);
        state.doorY += state.doorVY * dt;
        if (state.doorY >= GROUND_Y) { state.doorY = GROUND_Y; state.doorVY = 0; }
      }
    } else if (mechanic === 'ground_swap') {
      state.doorOpen = state.groundPhase === 1;
    } else if (mechanic === 'flee_key') {
      if (!state.keyCollected && !state.keyHeld && Math.abs(state.keyX - player.x) < 420 && direction !== 0) {
        state.keyX = clamp(state.keyX + direction * 315 * dt, 720, 1650);
      }
      state.doorOpen = state.keyCollected;
    } else if (mechanic === 'push_box') {
      state.doorOpen = state.boxX > 1350;
    } else if (mechanic === 'gravity_flip') {
      state.doorOpen = state.gravityFlipped;
    } else if (mechanic === 'sound_order') {
      state.doorOpen = state.soundSequence.length === 3;
    } else if (mechanic === 'erase_wall') {
      state.doorOpen = state.wallErase >= 1;
    } else if (mechanic === 'start_backward') {
      if (!state.startVisited && player.x < 85) {
        state.startVisited = true;
        state.doorOpen = true;
        log('mechanic:direction', 'start-edge-visited', { x: Math.round(player.x) });
        tone(700, .1);
      }
    }

    let reached = false;
    if (mechanic === 'runaway_door' || mechanic === 'drag_door') reached = state.doorOpen && Math.abs(player.x - state.doorX) < 115;
    else if (mechanic === 'mirror_world') reached = state.doorOpen && player.x > 1510;
    else if (mechanic === 'cloud_hold' || mechanic === 'push_box') reached = state.doorOpen && player.x > 1510 && player.y < 680;
    else if (mechanic === 'gravity_flip') reached = state.doorOpen && player.x > 1510 && player.y < 380;
    else reached = state.doorOpen && player.x > 1510;
    if (reached) complete('door-reached:' + mechanic);
  }

  function drawBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    gradient.addColorStop(0, '#79c8d1');
    gradient.addColorStop(.54, '#f0bd79');
    gradient.addColorStop(1, '#d27d70');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    if (!level || (level.mechanic !== 'shadow_sun' && level.mechanic !== 'gravity_flip')) {
      ctx.fillStyle = 'rgba(255,240,189,.9)';
      ctx.beginPath(); ctx.arc(1550, 175, 72, 0, Math.PI * 2); ctx.fill();
    }
    [[330,160,120],[690,225,80],[1250,120,110]].forEach(function (cloud) {
      roundedRect(cloud[0], cloud[1], cloud[2], 28, 20, 'rgba(255,255,255,.55)');
    });
    ctx.fillStyle = '#655e76';
    ctx.beginPath();
    ctx.moveTo(0, 580); ctx.lineTo(230, 420); ctx.lineTo(410, 570); ctx.lineTo(670, 380); ctx.lineTo(890, 575); ctx.lineTo(1190, 405); ctx.lineTo(1460, 575); ctx.lineTo(1710, 430); ctx.lineTo(W, 565); ctx.lineTo(W, GROUND_Y); ctx.lineTo(0, GROUND_Y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3e5b55';
    ctx.beginPath();
    ctx.moveTo(0, 650); ctx.quadraticCurveTo(260, 585, 520, 660); ctx.quadraticCurveTo(830, 590, 1120, 675); ctx.quadraticCurveTo(1500, 590, W, 665); ctx.lineTo(W, GROUND_Y); ctx.lineTo(0, GROUND_Y); ctx.closePath(); ctx.fill();
  }

  function drawDropTerrain() {
    terrainLayout().gaps.forEach(function (gap) {
      const shade = ctx.createLinearGradient(0, gap.top, 0, UI_Y + 20);
      shade.addColorStop(0, 'rgba(23,52,58,.75)');
      shade.addColorStop(.5, 'rgba(20,35,40,.95)');
      shade.addColorStop(1, '#111a20');
      ctx.save();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(gap.left - 24, gap.top + 3);
      ctx.lineTo(gap.right + 24, gap.top + 3);
      ctx.lineTo(gap.right + 36, UI_Y + 28);
      ctx.lineTo(gap.left - 36, UI_Y + 28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function drawGround(floor) {
    if (floor.special === 'invisible' || floor.special === 'ink' || floor.special === 'box') return;
    if (floor.special) {
      const color = floor.special === 'cloud' ? 'rgba(241,246,222,.9)' : floor.type === 'jump-bridge' ? '#79c8d1' : '#e7c66d';
      roundedRect(floor.x, floor.y, floor.w, floor.h, 12, color, '#17343a', 5);
      return;
    }
    const layout = terrainLayout();
    const leftCliff = layout.gaps.some(function (gap) { return Math.abs(gap.right - floor.x) < 1; });
    const rightCliff = layout.gaps.some(function (gap) { return Math.abs(gap.left - (floor.x + floor.w)) < 1; });
    const bottom = UI_Y + 24;
    const path = function () {
      ctx.beginPath();
      ctx.moveTo(floor.x, floor.y);
      ctx.lineTo(floor.x + floor.w, floor.y);
      if (rightCliff) {
        ctx.lineTo(floor.x + floor.w - 4, floor.y + 24);
        ctx.lineTo(floor.x + floor.w + 8, floor.y + 51);
        ctx.lineTo(floor.x + floor.w - 12, bottom);
      } else ctx.lineTo(floor.x + floor.w, bottom);
      if (leftCliff) {
        ctx.lineTo(floor.x + 12, bottom);
        ctx.lineTo(floor.x - 8, floor.y + 51);
        ctx.lineTo(floor.x + 4, floor.y + 24);
      } else ctx.lineTo(floor.x, bottom);
      ctx.closePath();
    };
    const fill = ctx.createLinearGradient(0, floor.y, 0, bottom);
    fill.addColorStop(0, '#71815f'); fill.addColorStop(.36, '#566756'); fill.addColorStop(1, '#3e4946');
    ctx.fillStyle = fill; path(); ctx.fill();
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = '#83975e'; ctx.fillRect(floor.x, floor.y, floor.w, 18);
    ctx.fillStyle = '#d2d879'; ctx.fillRect(floor.x, floor.y, floor.w, 7);
    ctx.restore();
    ctx.strokeStyle = '#17343a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(floor.x, floor.y); ctx.lineTo(floor.x + floor.w, floor.y); ctx.stroke();
    if (leftCliff) { ctx.beginPath(); ctx.moveTo(floor.x + 4, floor.y + 21); ctx.lineTo(floor.x - 8, floor.y + 51); ctx.lineTo(floor.x + 12, bottom); ctx.stroke(); }
    if (rightCliff) { ctx.beginPath(); ctx.moveTo(floor.x + floor.w - 4, floor.y + 21); ctx.lineTo(floor.x + floor.w + 8, floor.y + 51); ctx.lineTo(floor.x + floor.w - 12, bottom); ctx.stroke(); }
  }

  function drawDoor(x, platformY, open, options) {
    const opts = options || {};
    const y = platformY - 220;
    ctx.save();
    ctx.translate(x, y);
    if (opts.mirror) ctx.scale(-1, 1);
    if (opts.upsideDown) { ctx.translate(0, 220); ctx.scale(1, -1); }
    ctx.strokeStyle = '#17343a'; ctx.lineWidth = 9; ctx.lineJoin = 'round';
    ctx.fillStyle = open ? '#f3d273' : '#2f7775';
    ctx.beginPath(); ctx.moveTo(-70, 210); ctx.lineTo(-70, 80); ctx.quadraticCurveTo(0, -25, 70, 80); ctx.lineTo(70, 210); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e5bd66'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 95, 27, 0, Math.PI * 2); ctx.moveTo(-40, 95); ctx.lineTo(40, 95); ctx.moveTo(0, 55); ctx.lineTo(0, 135); ctx.stroke();
    if (open) { ctx.fillStyle = 'rgba(255,240,189,.75)'; ctx.fillRect(-50, 145, 100, 62); }
    if (opts.feet) {
      ctx.strokeStyle = '#17343a'; ctx.lineWidth = 8;
      const stride = Math.sin(frame * .35) * 18;
      ctx.beginPath(); ctx.moveTo(-28, 210); ctx.lineTo(-30 + stride, 229); ctx.moveTo(28, 210); ctx.lineTo(30 - stride, 229); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const moving = Math.abs(player.vx) > 1;
    const bob = moving ? Math.sin(frame * .32) * 4 : 0;
    const scale = player.h < 100 ? .6 : 1;
    const visualX = level && level.mechanic === 'mirror_world' ? W - player.x : player.x;
    const visualFacing = level && level.mechanic === 'mirror_world' ? -player.facing : player.facing;
    ctx.save();
    ctx.translate(visualX, player.y + bob);
    if (level && level.mechanic === 'gravity_flip' && state.gravityFlipped) ctx.scale(1, -1);
    ctx.scale(visualFacing * scale, scale);
    ctx.strokeStyle = '#17343a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = '#d94b54';
    ctx.beginPath(); ctx.moveTo(-18, -25); ctx.quadraticCurveTo(-68 - (moving ? 18 : 0), 12, -48, 55); ctx.quadraticCurveTo(-24, 43, 2, 25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0bd'; ctx.beginPath(); ctx.arc(0, -34, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b3c2f'; ctx.beginPath(); ctx.moveTo(-34, -42); ctx.quadraticCurveTo(-16, -87, 25, -66); ctx.lineTo(34, -38); ctx.quadraticCurveTo(8, -56, -34, -42); ctx.fill(); ctx.stroke();
    roundedRect(-32, -8, 64, 58, 8, '#278a88', '#17343a', 7);
    ctx.beginPath(); ctx.moveTo(-14, 48); ctx.lineTo(-18 + (moving ? Math.sin(frame * .32) * 12 : 0), 72); ctx.moveTo(14, 48); ctx.lineTo(18 - (moving ? Math.sin(frame * .32) * 12 : 0), 72); ctx.stroke();
    ctx.restore();
  }

  function drawInkPath() {
    let livePath = null;
    pointerModes.forEach(function (mode) { if (mode.type === 'ink') livePath = mode.points; });
    const path = livePath || (!state.inkBridge && performance.now() < state.inkErrorUntil ? state.inkPath : null);
    if (path && path.length > 1) {
      ctx.save(); ctx.strokeStyle = '#17343a'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
      for (let index = 1; index < path.length; index += 1) ctx.lineTo(path[index].x, path[index].y);
      ctx.stroke(); ctx.restore();
    }
    if (state.inkBridge) {
      ctx.save(); ctx.fillStyle = '#17343a'; ctx.strokeStyle = '#0e2529'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(650, GROUND_Y); ctx.lineTo(1270, GROUND_Y); ctx.lineTo(1262, GROUND_Y + 22); ctx.bezierCurveTo(1090, GROUND_Y + 17, 825, GROUND_Y + 28, 658, GROUND_Y + 21); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  function drawKey(x, y, shadowOnly) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = shadowOnly ? 'rgba(23,52,58,.72)' : '#e5bd66';
    ctx.fillStyle = shadowOnly ? 'rgba(23,52,58,.48)' : '#fff0bd';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(-22, 0, 20, 0, Math.PI * 2); ctx.moveTo(-2, 0); ctx.lineTo(58, 0); ctx.lineTo(58, 22); ctx.moveTo(30, 0); ctx.lineTo(30, 18); ctx.stroke();
    if (!shadowOnly) { ctx.beginPath(); ctx.arc(-22, 0, 8, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawFlower(x, y, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.translate(x, y);
    ctx.strokeStyle = '#17343a'; ctx.fillStyle = '#f3d273'; ctx.lineWidth = 4;
    for (let i = 0; i < 6; i += 1) {
      ctx.save(); ctx.rotate(i * Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, -13, 7, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#d94b54'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawMechanic() {
    const mechanic = level.mechanic;
    if (mechanic === 'dual_bridge') {
      drawDoor(1580, GROUND_Y, state.doorOpen);
      if (!state.bridgeBuilt && state.dualHold > 0) {
        ctx.save(); ctx.strokeStyle = '#f3d273'; ctx.lineWidth = 16; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(720, GROUND_Y + 4); ctx.quadraticCurveTo(800, 720, 720 + 240 * state.dualHold, GROUND_Y - 12); ctx.moveTo(1200, GROUND_Y + 4); ctx.quadraticCurveTo(1120, 720, 1200 - 240 * state.dualHold, GROUND_Y - 12); ctx.stroke(); ctx.restore();
      }
    } else if (mechanic === 'runaway_door') {
      drawDoor(state.doorX, GROUND_Y, state.doorOpen, { feet: state.doorMoving });
    } else if (mechanic === 'ink_path') {
      drawInkPath(); drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'silent_wait') {
      drawDoor(1580, GROUND_Y, state.doorOpen);
      if (state.waitTime > 0) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,240,189,.8)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(1580, 495, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.waitTime / 2.1); ctx.stroke(); ctx.restore();
      }
    } else if (mechanic === 'shadow_sun') {
      const shadowX = 1580 - (state.sunX - 960) * .42;
      ctx.save(); ctx.fillStyle = 'rgba(23,52,58,.36)'; ctx.beginPath(); ctx.ellipse(shadowX, GROUND_Y - 8, 130, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.fillStyle = '#f3d273'; ctx.strokeStyle = '#17343a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(state.sunX, state.sunY, 66, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'word_bridge') {
      if (!state.bridgeBuilt) {
        ctx.fillStyle = '#17343a'; ctx.font = '900 110px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('路', state.wordX, state.wordY);
      }
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'knock_twice') {
      drawDoor(1580, GROUND_Y, state.doorOpen);
      if (performance.now() < state.knockFlashUntil) {
        ctx.fillStyle = '#17343a'; ctx.font = '900 70px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('咚', 1410, 520);
      }
    } else if (mechanic === 'flower_password') {
      flowerBlocks().forEach(function (block) {
        roundedRect(block.x, block.y, block.w, block.h, 15, '#fff0bd', '#17343a', 6);
        ctx.fillStyle = '#17343a'; ctx.font = '800 52px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', block.x + block.w / 2, block.y + block.h / 2);
        if (performance.now() < state.flowerFlashUntil[block.index]) drawFlower(block.x + block.w / 2, block.y - 38, 1);
      });
      drawDoor(1580, GROUND_Y, state.doorOpen);
      if (state.flowerRemaining.every(function (count) { return count === 0; }) && Math.abs(player.x - state.doorX) < 330 && !state.doorOpen) drawKeypad();
    } else if (mechanic === 'shadow_key') {
      if (!state.keyCollected) {
        drawKey(930, 520, false);
        drawKey(930, GROUND_Y - 22, true);
      }
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'passenger_platform') {
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'shrink_tunnel') {
      ctx.save(); ctx.fillStyle = '#596957'; ctx.strokeStyle = '#17343a'; ctx.lineWidth = 7;
      roundedRect(700, 585, 630, 100, 10, '#596957', '#17343a', 7);
      ctx.fillStyle = '#fff0bd'; ctx.font = '700 28px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('低处无风', 1015, 642); ctx.restore();
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'cloud_hold') {
      ctx.save(); ctx.fillStyle = 'rgba(245,249,229,.92)'; ctx.strokeStyle = '#17343a'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(960, state.cloudY, 128, 38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      drawDoor(1580, 525, state.doorOpen);
    } else if (mechanic === 'decoy_door') {
      drawDoor(1235, GROUND_Y, false);
      drawDoor(1580, GROUND_Y, state.doorOpen);
      ctx.save(); ctx.strokeStyle = state.decoyTouched ? '#e5bd66' : 'rgba(229,189,102,.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(1218, 605); ctx.lineTo(1252, 639); ctx.moveTo(1252, 605); ctx.lineTo(1218, 639); ctx.stroke(); ctx.restore();
    } else if (mechanic === 'title_platform') {
      if (!state.bridgeBuilt) {
        ctx.fillStyle = '#17343a'; ctx.font = '900 62px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(level.title, state.titleX, state.titleY);
      }
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'freeze_spikes') {
      const frozen = freezeHeld();
      for (let x = 780; x <= 1280; x += 70) {
        const rise = frozen ? 12 : 30 + (Math.sin(frame * .15 + x) + 1) * 28;
        ctx.fillStyle = frozen ? '#79c8d1' : '#d94b54'; ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x - 25, GROUND_Y); ctx.lineTo(x, GROUND_Y - rise); ctx.lineTo(x + 25, GROUND_Y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      drawDoor(1580, GROUND_Y, true);
    } else if (mechanic === 'double_jump') {
      drawDoor(1580, GROUND_Y, true);
    } else if (mechanic === 'face_away') {
      drawDoor(1580, GROUND_Y, state.doorOpen);
      if (state.faceTime > 0) {
        ctx.fillStyle = 'rgba(255,240,189,.75)'; ctx.beginPath(); ctx.arc(1580, 505, 12 + 22 * state.faceTime / 1.2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (mechanic === 'drag_door') {
      drawDoor(state.doorX, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'invisible_bridge') {
      drawDoor(1580, GROUND_Y, true);
    } else if (mechanic === 'mirror_world') {
      ctx.save(); ctx.globalAlpha = .24; ctx.strokeStyle = '#fff0bd'; ctx.lineWidth = 4; ctx.setLineDash([20, 18]); ctx.beginPath(); ctx.moveTo(W / 2, 175); ctx.lineTo(W / 2, GROUND_Y); ctx.stroke(); ctx.restore();
      drawDoor(W - 1580, GROUND_Y, true, { mirror: true });
    } else if (mechanic === 'jump_bridge') {
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'door_jumps') {
      drawDoor(1580, state.doorY, state.doorOpen);
    } else if (mechanic === 'ground_swap') {
      drawDoor(1580, GROUND_Y, state.doorOpen);
      drawGrassSwitch(665, GROUND_Y - 8, state.groundPhase === 0);
      drawGrassSwitch(1240, GROUND_Y - 8, state.groundPhase === 1);
    } else if (mechanic === 'flee_key') {
      if (!state.keyCollected) drawKey(state.keyX, GROUND_Y - 95, false);
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'push_box') {
      ctx.save(); ctx.translate(state.boxX, GROUND_Y - 50); roundedRect(-65, -50, 130, 100, 8, '#a3653e', '#17343a', 7); ctx.strokeStyle = '#e5bd66'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-50, -40); ctx.lineTo(50, 40); ctx.moveTo(50, -40); ctx.lineTo(-50, 40); ctx.stroke(); ctx.restore();
      drawDoor(1620, 620, state.doorOpen);
    } else if (mechanic === 'gravity_flip') {
      ctx.save(); ctx.fillStyle = '#f5df8d'; ctx.strokeStyle = '#17343a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(1450, 190, 62, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#596957'; ctx.fillRect(0, 220, W, 30); ctx.fillStyle = '#d2d879'; ctx.fillRect(0, 244, W, 6);
      drawDoor(1580, 470, state.doorOpen, { upsideDown: true });
    } else if (mechanic === 'sound_order') {
      [700, 960, 1220].forEach(function (x, index) {
        const active = state.soundFlash === index && performance.now() < state.soundFlashUntil;
        roundedRect(x - 70, GROUND_Y - 70, 140, 60, 25, active ? '#f3d273' : '#596957', '#17343a', 6);
        ctx.strokeStyle = '#e5bd66'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, GROUND_Y - 40, 15 + index * 3, 0, Math.PI * 2); ctx.stroke();
      });
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'erase_wall') {
      if (state.wallErase < 1) {
        ctx.save(); ctx.globalAlpha = Math.max(.12, 1 - state.wallErase); ctx.fillStyle = '#655e76'; ctx.strokeStyle = '#17343a'; ctx.lineWidth = 8; roundedRect(900, 410, 120, 380, 8, '#655e76', '#17343a', 8); ctx.restore();
      }
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else if (mechanic === 'start_backward') {
      ctx.save(); ctx.strokeStyle = state.startVisited ? '#e5bd66' : '#17343a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(70, GROUND_Y - 25, 28, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      drawDoor(1580, GROUND_Y, state.doorOpen);
    } else {
      drawDoor(1580, GROUND_Y, state.doorOpen || mechanic === 'reverse_controls');
    }
  }

  function drawGrassSwitch(x, y, active) {
    ctx.save(); ctx.strokeStyle = active ? '#f3d273' : '#17343a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 24, y - 54); ctx.moveTo(x, y); ctx.lineTo(x, y - 67); ctx.moveTo(x, y); ctx.lineTo(x + 27, y - 48); ctx.stroke(); ctx.restore();
  }

  function drawKeypad() {
    roundedRect(700, 235, 640, 505, 28, 'rgba(255,240,189,.98)', '#17343a', 8);
    ctx.fillStyle = '#17343a'; ctx.font = '800 34px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state.passwordInput.padEnd(4, '·'), 1020, 278);
    keypadRects().forEach(function (key) {
      roundedRect(key.x, key.y, key.w, key.h, 16, '#fff0bd', '#17343a', 5);
      ctx.fillStyle = '#17343a'; ctx.font = '800 38px sans-serif'; ctx.fillText(key.digit === 'back' ? '←' : key.digit, key.x + key.w / 2, key.y + key.h / 2);
    });
  }

  function drawIconButton(rect, type) {
    roundedRect(rect.x, rect.y, rect.w, rect.h, 18, '#fff0bd', '#17343a', 6);
    const x = rect.x + rect.w / 2;
    const y = rect.y + rect.h / 2;
    ctx.save(); ctx.strokeStyle = '#17343a'; ctx.fillStyle = '#17343a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (type === 'hint') {
      ctx.beginPath(); ctx.moveTo(x - 15, y - 16); ctx.bezierCurveTo(x - 10, y - 33, x + 20, y - 31, x + 19, y - 10); ctx.bezierCurveTo(x + 18, y + 2, x + 1, y + 3, x, y + 14); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y + 27, 5, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'reset') {
      ctx.beginPath(); ctx.arc(x + 2, y + 2, 24, -Math.PI * .35, Math.PI * 1.25, false); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 15, y - 14); ctx.lineTo(x - 35, y - 7); ctx.lineTo(x - 22, y + 7); ctx.closePath(); ctx.fill();
    } else if (type === 'pause') {
      roundedRect(x - 18, y - 27, 12, 54, 4, '#17343a'); roundedRect(x + 6, y - 27, 12, 54, 4, '#17343a');
    }
    ctx.restore();
  }

  function drawTopUI() {
    roundedRect(50, 38, 190, 88, 18, '#fff0bd', '#17343a', 6);
    ctx.fillStyle = '#17343a'; ctx.font = '800 39px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('第 ' + level.id + ' 关', 145, 82);
    drawIconButton(HIT.hint, 'hint'); drawIconButton(HIT.reset, 'reset'); drawIconButton(HIT.pause, 'pause');
    if (level.mechanic !== 'title_platform') {
      ctx.fillStyle = '#17343a'; ctx.font = '900 54px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(level.title, 910, 105);
    }
    const decided = Object.keys(review.decisions).length;
    roundedRect(1255, 43, 228, 66, 17, 'rgba(23,52,58,.86)', '#e5bd66', 4);
    ctx.fillStyle = '#fff0bd'; ctx.font = '700 24px "PingFang SC", sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('已评审 ' + decided + ' / 30', 1369, 76);
    drawReviewButton(HIT.accept, '加入主关', '#278a88');
    drawReviewButton(HIT.discard, '抛弃', '#d94b54');
  }

  function drawReviewButton(rect, label, fill) {
    roundedRect(rect.x, rect.y, rect.w, rect.h, 18, fill, '#17343a', 6);
    ctx.fillStyle = '#fff0bd'; ctx.font = '800 27px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  function drawControls() {
    ctx.fillStyle = '#687a58'; ctx.fillRect(0, UI_Y, W, H - UI_Y);
    ctx.fillStyle = '#d2d879'; ctx.fillRect(0, UI_Y, W, 14);
    [[HIT.left, '‹', 'left'], [HIT.right, '›', 'right'], [HIT.jump, '⌃', 'jump']].forEach(function (entry) {
      const rect = entry[0];
      const held = controlHeld(entry[2]);
      roundedRect(rect.x, rect.y, rect.w, rect.h, 28, held ? '#2f7775' : '#17343a', '#e5bd66', 5);
      ctx.fillStyle = '#fff0bd'; ctx.font = '900 104px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(entry[1], rect.x + rect.w / 2, rect.y + rect.h / 2 - 6);
    });
  }

  function wrapText(text, centerX, startY, maxWidth, lineHeight) {
    const chars = Array.from(text || '');
    let line = '';
    const lines = [];
    chars.forEach(function (char) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = char; }
      else line = test;
    });
    if (line) lines.push(line);
    const top = startY - (lines.length - 1) * lineHeight / 2;
    lines.forEach(function (item, index) { ctx.fillText(item, centerX, top + index * lineHeight); });
  }

  function drawHint() {
    if (!hintVisible) return;
    roundedRect(470, 165, 980, 205, 28, 'rgba(255,240,189,.97)', '#17343a', 7);
    ctx.fillStyle = '#17343a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 35px "PingFang SC", sans-serif'; ctx.fillText('提示', W / 2, 215);
    ctx.font = '700 30px "PingFang SC", sans-serif'; wrapText(level.hint, W / 2, 292, 850, 43);
  }

  function drawPause() {
    if (status !== 'paused') return;
    ctx.fillStyle = 'rgba(25,23,36,.64)'; ctx.fillRect(0, 0, W, H);
    roundedRect(560, 305, 800, 410, 36, '#fff0bd', '#17343a', 9);
    ctx.fillStyle = '#17343a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 68px "PingFang SC", sans-serif'; ctx.fillText('已暂停', W / 2, 415);
    ctx.font = '600 28px "PingFang SC", sans-serif'; ctx.fillText('这一关的状态会保留', W / 2, 505);
    roundedRect(HIT.pauseResume.x, HIT.pauseResume.y, HIT.pauseResume.w, HIT.pauseResume.h, 22, '#e7c66d', '#17343a', 6);
    ctx.font = '800 31px "PingFang SC", sans-serif'; ctx.fillText('继续试玩', W / 2, HIT.pauseResume.y + HIT.pauseResume.h / 2);
  }

  function drawSuccessRibbon() {
    if (status !== 'success') return;
    roundedRect(660, 145, 600, 90, 25, 'rgba(255,240,189,.96)', '#17343a', 7);
    ctx.fillStyle = '#17343a'; ctx.font = '900 37px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('脑洞正确 · 请选择加入或抛弃', W / 2, 190);
  }

  function drawToast() {
    if (!state.toast || performance.now() >= state.toastUntil) return;
    roundedRect(700, 660, 520, 76, 18, 'rgba(217,75,84,.93)', '#17343a', 5);
    ctx.fillStyle = '#fff0bd'; ctx.font = '700 30px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state.toast, 960, 698);
  }

  function renderLevel() {
    drawBackdrop();
    drawDropTerrain();
    floorsForLevel().forEach(drawGround);
    drawMechanic();
    drawPlayer();
    drawTopUI();
    drawControls();
    drawHint();
    drawToast();
    drawSuccessRibbon();
    drawPause();
  }

  function drawSummary() {
    drawBackdrop();
    const summary = reviewSummary();
    ctx.fillStyle = 'rgba(57,47,70,.42)'; ctx.fillRect(0, 0, W, H);
    roundedRect(250, 120, 1420, 790, 42, 'rgba(255,240,189,.97)', '#17343a', 9);
    ctx.fillStyle = '#17343a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 70px "PingFang SC", sans-serif'; ctx.fillText('30 关评审完成', W / 2, 225);
    ctx.font = '700 32px "PingFang SC", sans-serif'; ctx.fillText('告诉 Codex：“开始处理评审结果”', W / 2, 310);
    roundedRect(355, 380, 560, 370, 30, 'rgba(39,138,136,.14)', '#278a88', 6);
    roundedRect(1005, 380, 560, 370, 30, 'rgba(217,75,84,.12)', '#d94b54', 6);
    ctx.fillStyle = '#278a88'; ctx.font = '900 42px "PingFang SC", sans-serif'; ctx.fillText('加入主关 · ' + summary.accepted.length, 635, 440);
    ctx.fillStyle = '#d94b54'; ctx.fillText('抛弃 · ' + summary.discarded.length, 1285, 440);
    ctx.fillStyle = '#17343a'; ctx.font = '700 29px "PingFang SC", sans-serif';
    wrapText(summary.accepted.length ? summary.accepted.join('、') : '无', 635, 575, 470, 42);
    wrapText(summary.discarded.length ? summary.discarded.join('、') : '无', 1285, 575, 470, 42);
    ctx.font = '600 24px "PingFang SC", sans-serif'; ctx.fillText('结果已保存在本机；统一处理前不会改动主线关卡。', W / 2, 835);
  }

  function render() {
    if (screen === 'summary') drawSummary();
    else renderLevel();
  }

  function tick(now) {
    const dt = Math.min(.033, Math.max(.001, (now - lastTime) / 1000));
    lastTime = now;
    frame += 1;
    try {
      updatePlayer(dt);
      updateMechanic(dt);
      render();
    } catch (error) {
      log('render', 'frame-error', { operation: 'animation-frame', message: error && error.message, stack: error && error.stack }, 'error');
    }
    requestAnimationFrame(tick);
  }

  document.getElementById('download-logs').addEventListener('click', function () {
    log('export', 'log-export', { entries: logger.entries.length, review: reviewSummary() });
    logger.download('guaiqi-review-' + (level ? 'level-' + level.id : 'summary') + '.json');
  });

  window.addEventListener('error', function (event) {
    log('runtime', 'uncaught-error', { message: event.message, file: event.filename, line: event.lineno }, 'error');
  });
  window.addEventListener('unhandledrejection', function (event) {
    log('runtime', 'unhandled-rejection', { reason: event.reason && (event.reason.message || String(event.reason)) }, 'error');
  });

  window.__guaiqiReview = {
    VERSION: VERSION,
    levels: LEVELS.map(function (item) { return Object.assign({}, item, { creator: item.creator.slice() }); }),
    getState: function () {
      return {
        screen: screen,
        status: status,
        level: level ? level.id : null,
        review: reviewSummary(),
        player: Object.assign({}, player),
        mechanic: JSON.parse(JSON.stringify(state)),
        inputs: { keys: Array.from(heldKeys), controls: Array.from(heldControls.values()), pointers: activePointers.size }
      };
    },
    getReviewResult: function () { return JSON.parse(JSON.stringify(review)); },
    enterLevelById: function (id) {
      const index = LEVELS.findIndex(function (item) { return item.id === Number(id); });
      if (index >= 0) enterLevel(index, 'debug-api');
      return index >= 0;
    },
    restart: function () { restart('debug-api'); },
    setLogModule: function (name, enabled) { logger.setModule(name, enabled); },
    setLogLevel: function (name) { logger.setLevel(name); },
    logs: logger
  };

  resize();
  window.addEventListener('resize', resize);
  const startupParams = new URLSearchParams(location.search);
  const requestedLevel = Number(startupParams.get('level'));
  const requestedIndex = LEVELS.findIndex(function (item) { return item.id === requestedLevel; });
  const nextReviewIndex = firstUndecidedIndex();
  log('runtime', 'boot', {
    version: VERSION,
    level_range: [13, 42],
    level_count: LEVELS.length,
    decided_count: Object.keys(review.decisions).length,
    requested_level: Number.isFinite(requestedLevel) ? requestedLevel : null,
    backend: { mode: 'offline-review', network_requests: 'none', persistence: 'localStorage-decisions' },
    logging: { max_entries: logger.maxEntries, min_level: logger.minLevel, physics_default_enabled: false, sensitive_fields_redacted: true }
  });
  if (nextReviewIndex < 0 && requestedIndex < 0) {
    screen = 'summary'; status = 'summary'; level = null;
  } else if (requestedIndex >= 0) enterLevel(requestedIndex, 'startup-query');
  else enterLevel(nextReviewIndex, 'resume-first-undecided');
  requestAnimationFrame(tick);
})();
