(function () {
  'use strict';

  const VERSION = 'round2-v2';
  const W = 1920;
  const H = 1080;
  const GROUND_Y = 790;
  const INK_SURFACE_Y = GROUND_Y;
  const UI_Y = 870;
  const logic = window.GuaiqiRoundTwoLogic;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const logger = new window.GuaiqiRoundTwoLogger({ version: VERSION, maxEntries: 1000, minLevel: 'info' });
  ['runtime', 'state', 'input', 'gesture', 'render', 'export', 'mechanic:level13', 'mechanic:level15'].forEach(function (name) { logger.setModule(name, true); });
  logger.setModule('physics', false);

  const LEVELS = [
    {
      id: 13,
      title: '进退之间',
      mechanic: 'dual_bridge',
      teaser: '相反的方向，也会在中间相遇。',
      hint: '同时按住左、右按钮约一秒，让两股力量在断口中间相遇。'
    },
    {
      id: 15,
      title: '一笔成路',
      mechanic: 'ink_path',
      teaser: '空白处，也许并不是真的空。',
      hint: '空白并不一定无路。'
    }
  ];

  const HIT = {
    hint: { x: 285, y: 40, w: 92, h: 92 },
    reset: { x: 395, y: 40, w: 92, h: 92 },
    pause: { x: 505, y: 40, w: 92, h: 92 },
    left: { x: 120, y: 895, w: 180, h: 135 },
    right: { x: 330, y: 895, w: 180, h: 135 },
    jump: { x: 1615, y: 895, w: 185, h: 135 },
    pauseBack: { x: 570, y: 575, w: 350, h: 96 },
    pauseResume: { x: 1000, y: 575, w: 350, h: 96 },
    successSelect: { x: 525, y: 650, w: 280, h: 92 },
    successReplay: { x: 820, y: 650, w: 280, h: 92 },
    successNext: { x: 1115, y: 650, w: 280, h: 92 },
    selectBack: { x: 710, y: 920, w: 500, h: 92 }
  };

  const heldKeys = new Set();
  const heldControls = new Map();
  const pointerModes = new Map();
  const activePointers = new Map();
  let screen = 'select';
  let status = 'select';
  let currentIndex = 0;
  let level = null;
  let frame = 0;
  let lastTime = performance.now();
  let levelStartedAt = lastTime;
  let hintVisible = false;
  let successAt = 0;
  let audioContext = null;

  const player = { x: 350, y: GROUND_Y - 72, w: 70, h: 144, vx: 0, vy: 0, onGround: true, facing: 1 };
  const state = createMechanicState();

  function createMechanicState() {
    return {
      dualHold: 0,
      dualStarted: false,
      dualMilestone: 0,
      bridgeBuilt: false,
      inkPath: [],
      inkBridge: false,
      inkError: '',
      inkErrorUntil: 0
    };
  }

  function resetMechanicState() {
    const fresh = createMechanicState();
    Object.keys(fresh).forEach(function (key) { state[key] = fresh[key]; });
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

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    log('render', 'resize', { dpr: dpr, backing_w: canvas.width, backing_h: canvas.height }, 'debug');
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  }
  function inside(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
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
    if (stroke) { ctx.lineWidth = lineWidth || 4; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function tone(frequency, duration, volume) {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(volume || .05, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      log('runtime', 'audio-failed', { message: error && error.message }, 'warn');
    }
  }

  function clearLiveInput(reason) {
    heldKeys.clear();
    heldControls.clear();
    pointerModes.clear();
    activePointers.clear();
    log('input', 'all-input-reset', { reason: reason });
  }

  function resetPlayer() {
    player.w = 70;
    player.h = 144;
    player.x = 350;
    player.y = GROUND_Y - player.h / 2;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.facing = 1;
    heldControls.clear();
  }

  function selectCards() {
    return LEVELS.map(function (item, index) {
      const column = index % 2;
      return { level: item, index: index, x: 335 + column * 650, y: 365, w: 600, h: 235 };
    });
  }

  function enterSelection(reason) {
    clearLiveInput('enter-selection');
    screen = 'select';
    status = 'select';
    level = null;
    hintVisible = false;
    log('state', 'selection-enter', { reason: reason || 'direct', available_levels: LEVELS.map(function (item) { return item.id; }) });
  }

  function enterLevel(index, reason) {
    currentIndex = logic.clamp(index, 0, LEVELS.length - 1);
    level = LEVELS[currentIndex];
    screen = 'level';
    status = 'playing';
    hintVisible = false;
    successAt = 0;
    levelStartedAt = performance.now();
    clearLiveInput('level-enter');
    resetMechanicState();
    resetPlayer();
    const terrain = terrainLayout();
    log('state', 'level-enter', { reason: reason || 'direct', title: level.title });
    log('render', 'drop-terrain-layout', {
      style: 'high-cliff-v2',
      gaps: terrain.gaps.map(function (gap) { return { left: gap.left, right: gap.right, width: gap.right - gap.left }; }),
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
    successAt = performance.now();
    clearLiveInput('level-complete');
    log('state', 'level-complete', { reason: reason, elapsed_ms: Math.round(successAt - levelStartedAt) });
    tone(660, .11);
    setTimeout(function () { tone(880, .14); }, 120);
  }

  function returnToMainline() {
    log('state', 'return-mainline-selection', { target: '../web_preview/index.html?mainline=v172&screen=levelSelect' });
    window.location.href = '../web_preview/index.html?mainline=v172&screen=levelSelect';
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

  function tryJump(source) {
    if (status !== 'playing' || !player.onGround) return false;
    player.vy = -900;
    player.onGround = false;
    log('input', 'jump', { source: source, x: Math.round(player.x), y: Math.round(player.y) });
    tone(360, .06);
    return true;
  }

  function closeHintForGesture(gesture) {
    if (!hintVisible) return;
    hintVisible = false;
    log('state', 'hint-auto-close-for-gesture', { gesture: gesture });
  }

  function startInkStroke(event, point) {
    const allowedStart = point.x >= 585 && point.x <= 740 && point.y >= 640 && point.y <= 820;
    if (!allowedStart) {
      log('gesture', 'ink-start-rejected', { x: Math.round(point.x), y: Math.round(point.y), reason: 'outside-start-zone' }, 'warn');
      return false;
    }
    closeHintForGesture('ink-stroke');
    const mode = { type: 'ink', points: [point], length: 0, overBudgetLogged: false };
    pointerModes.set(event.pointerId, mode);
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
      tone(135, .07);
    }
  }

  function finishInkStroke(event) {
    const mode = pointerModes.get(event.pointerId);
    if (!mode || mode.type !== 'ink') return;
    const result = logic.validateStroke(mode.points);
    log('gesture', 'ink-stroke-end', {
      accepted: result.valid,
      reason: result.reason,
      length: Math.round(result.length),
      point_count: mode.points.length,
      start: mode.points[0],
      end: mode.points[mode.points.length - 1]
    }, result.valid ? 'info' : 'warn');
    if (result.valid) {
      state.inkPath = mode.points.slice();
      state.inkBridge = true;
      state.inkError = '';
      log('mechanic:level15', 'ink-bridge-created', { x: 650, y: GROUND_Y, width: 620, settled_from_length: Math.round(result.length) });
      tone(620, .1);
    } else {
      state.inkPath = mode.points.slice();
      state.inkBridge = false;
      state.inkError = '这道痕迹还站不住。';
      state.inkErrorUntil = performance.now() + 1600;
      tone(150, .1);
    }
  }

  function onPointerDown(event) {
    const point = pointFromEvent(event);
    activePointers.set(event.pointerId, point);
    try { canvas.setPointerCapture(event.pointerId); } catch (error) { log('input', 'pointer-capture-failed', { message: error.message }, 'warn'); }

    if (screen === 'select') {
      const card = selectCards().find(function (item) { return inside(point, item); });
      if (card) {
        pointerModes.set(event.pointerId, { type: 'select-card', index: card.index, start: point });
        log('input', 'selection-card-down', { level_id: card.level.id, pointer_type: event.pointerType });
      } else if (inside(point, HIT.selectBack)) {
        pointerModes.set(event.pointerId, { type: 'mainline-back' });
      }
      return;
    }

    if (status === 'success') {
      if (inside(point, HIT.successSelect)) enterSelection('success-select');
      else if (inside(point, HIT.successReplay)) enterLevel(currentIndex, 'success-replay');
      else if (inside(point, HIT.successNext)) {
        if (currentIndex < LEVELS.length - 1) enterLevel(currentIndex + 1, 'success-next');
        else enterSelection('success-finished-all');
      }
      return;
    }
    if (status === 'paused') {
      if (inside(point, HIT.pauseBack)) enterSelection('pause-back');
      else if (inside(point, HIT.pauseResume) || inside(point, HIT.pause)) setPaused(false, 'pause-resume-button');
      return;
    }
    if (inside(point, HIT.hint)) {
      hintVisible = !hintVisible;
      log('state', 'hint-toggle', { visible: hintVisible });
      tone(520, .05);
      return;
    }
    if (inside(point, HIT.reset)) { restart('top-button'); return; }
    if (inside(point, HIT.pause)) { setPaused(true, 'top-button'); return; }

    const control = controlForPoint(point);
    if (control) {
      heldControls.set(event.pointerId, control);
      pointerModes.set(event.pointerId, { type: 'control', control: control });
      if (control === 'jump') tryJump('pointer');
      log('input', 'control-down', { pointer_id: event.pointerId, pointer_type: event.pointerType, control: control });
      return;
    }

    if (level.mechanic === 'ink_path' && point.y < UI_Y) startInkStroke(event, point);
  }

  function onPointerMove(event) {
    const point = pointFromEvent(event);
    activePointers.set(event.pointerId, point);
    const mode = pointerModes.get(event.pointerId);
    if (!mode || status !== 'playing') return;
    if (mode.type === 'ink') updateInkStroke(event, point);
  }

  function onPointerUp(event) {
    const point = pointFromEvent(event);
    const mode = pointerModes.get(event.pointerId);
    const releasedControl = heldControls.get(event.pointerId);
    heldControls.delete(event.pointerId);
    activePointers.delete(event.pointerId);
    if (releasedControl) log('input', 'control-up', { pointer_id: event.pointerId, control: releasedControl });
    if (mode && mode.type === 'select-card' && screen === 'select') {
      const card = selectCards()[mode.index];
      const drift = Math.hypot(point.x - mode.start.x, point.y - mode.start.y);
      if (inside(point, card) && drift < 35) enterLevel(mode.index, 'selection-card');
      else log('input', 'selection-card-cancelled', { level_id: card.level.id, drift: Math.round(drift) });
    } else if (mode && mode.type === 'mainline-back' && screen === 'select' && inside(point, HIT.selectBack)) {
      returnToMainline();
    } else if (mode && mode.type === 'ink') {
      finishInkStroke(event);
    }
    pointerModes.delete(event.pointerId);
  }

  window.addEventListener('keydown', function (event) {
    const code = event.code || '';
    if (['KeyA', 'KeyD', 'KeyW', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyR', 'KeyP', 'Escape'].includes(code)) event.preventDefault();
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

  function floorsForLevel() {
    if (!level) return [];
    if (level.mechanic === 'dual_bridge') {
      const floors = [{ x: 0, y: GROUND_Y, w: 720, h: 80 }, { x: 1200, y: GROUND_Y, w: 720, h: 80 }];
      if (state.bridgeBuilt) floors.push({ x: 720, y: GROUND_Y, w: 480, h: 55, special: 'dual' });
      return floors;
    }
    if (level.mechanic === 'ink_path') {
      const floors = [{ x: 0, y: GROUND_Y, w: 650, h: 80 }, { x: 1270, y: GROUND_Y, w: 650, h: 80 }];
      if (state.inkBridge) floors.push({ x: 650, y: INK_SURFACE_Y, w: 620, h: 24, special: 'ink' });
      return floors;
    }
    return [{ x: 0, y: GROUND_Y, w: W, h: 80 }];
  }

  function updatePlayer(dt) {
    if (!level || status !== 'playing') return;
    const direction = (rightHeld() ? 1 : 0) - (leftHeld() ? 1 : 0);
    player.vx = direction * 310;
    if (direction) player.facing = direction;
    player.x += player.vx * dt;
    player.x = logic.clamp(player.x, 55, W - 55);
    player.vy = Math.min(1200, player.vy + 1900 * dt);
    const previousBottom = player.y + player.h / 2;
    player.y += player.vy * dt;
    player.onGround = false;
    const nextBottom = player.y + player.h / 2;
    const landingCandidates = [];
    floorsForLevel().forEach(function (floor) {
      const overlapX = player.x + player.w / 2 > floor.x && player.x - player.w / 2 < floor.x + floor.w;
      if (overlapX && player.vy >= 0 && previousBottom <= floor.y + 8 && nextBottom >= floor.y) landingCandidates.push(floor);
    });
    if (landingCandidates.length) {
      const landing = landingCandidates.reduce(function (best, floor) { return floor.y < best.y ? floor : best; });
      player.y = landing.y - player.h / 2;
      player.vy = 0;
      player.onGround = true;
    }
    if (player.y > H + 140) {
      log('physics', 'player-fell', { x: Math.round(player.x), y: Math.round(player.y), mechanic_preserved: true }, 'warn');
      resetPlayer();
      tone(120, .12);
    }
  }

  function updateMechanic(dt) {
    if (!level || status !== 'playing') return;
    if (level.mechanic === 'dual_bridge') {
      const both = leftHeld() && rightHeld();
      const before = state.dualHold;
      state.dualHold = logic.nextDualHold(state.dualHold, leftHeld(), rightHeld(), dt, 1);
      if (both && !state.dualStarted && !state.bridgeBuilt) {
        state.dualStarted = true;
        log('mechanic:level13', 'dual-hold-start', { required_seconds: 1, input_sources: { keyboard: Array.from(heldKeys), touch_count: heldControls.size } });
      }
      if (!both && state.dualStarted && !state.bridgeBuilt) {
        log('mechanic:level13', 'dual-hold-cancelled', { held_seconds: Number(before.toFixed(2)) });
        state.dualStarted = false;
        state.dualMilestone = 0;
      }
      const milestone = Math.floor(state.dualHold * 4) * 25;
      if (milestone > state.dualMilestone && milestone < 100) {
        state.dualMilestone = milestone;
        log('mechanic:level13', 'dual-hold-progress', { percent: milestone, held_seconds: Number(state.dualHold.toFixed(2)) });
      }
      if (!state.bridgeBuilt && state.dualHold >= 1) {
        state.bridgeBuilt = true;
        state.dualStarted = false;
        state.dualMilestone = 100;
        log('mechanic:level13', 'dual-bridge-created', { x: 720, y: GROUND_Y, width: 480, hold_seconds: 1 });
        tone(620, .12);
      }
      if (state.bridgeBuilt && player.x > 1540) complete('crossed-dual-bridge');
    } else if (level.mechanic === 'ink_path') {
      if (state.inkBridge && player.x > 1540) complete('crossed-drawn-path');
    }
  }

  function drawBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    gradient.addColorStop(0, '#79c8d1');
    gradient.addColorStop(.54, '#f0bd79');
    gradient.addColorStop(1, '#d27d70');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,240,189,.9)';
    ctx.beginPath(); ctx.arc(1550, 175, 72, 0, Math.PI * 2); ctx.fill();
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

  function terrainLayout() {
    const grounds = floorsForLevel().filter(function (floor) { return !floor.special; }).slice().sort(function (a, b) { return a.x - b.x; });
    const gaps = [];
    for (let index = 0; index < grounds.length - 1; index += 1) {
      const left = grounds[index].x + grounds[index].w;
      const right = grounds[index + 1].x;
      if (right - left > 20) gaps.push({ left: left, right: right, top: Math.min(grounds[index].y, grounds[index + 1].y) });
    }
    return { grounds: grounds, gaps: gaps };
  }

  function drawDropTerrain() {
    terrainLayout().gaps.forEach(function (gap) {
      const shade = ctx.createLinearGradient(0, gap.top, 0, UI_Y + 18);
      shade.addColorStop(0, 'rgba(23,52,58,.65)');
      shade.addColorStop(.45, 'rgba(22,39,42,.9)');
      shade.addColorStop(1, 'rgba(18,25,31,.98)');
      ctx.save();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(gap.left, gap.top + 5);
      ctx.lineTo(gap.right, gap.top + 5);
      // 深色区域向两侧岩壁下方延伸，由后绘制的地面遮住，避免露出背景色细缝。
      ctx.lineTo(gap.right + 22, gap.top + 35);
      ctx.lineTo(gap.right + 32, UI_Y + 18);
      ctx.lineTo(gap.left - 32, UI_Y + 18);
      ctx.lineTo(gap.left - 22, gap.top + 35);
      ctx.closePath();
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = 'rgba(214,222,191,.1)';
      ctx.beginPath();
      ctx.ellipse((gap.left + gap.right) / 2, UI_Y + 6, (gap.right - gap.left) * .42, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawGround(floor) {
    if (floor.special === 'ink') return;
    if (floor.special) {
      ctx.save();
      ctx.fillStyle = '#e7c66d';
      ctx.strokeStyle = '#17343a';
      ctx.lineWidth = 5;
      roundedRect(floor.x, floor.y, floor.w, floor.h, 10, '#e7c66d', '#17343a', 5);
      ctx.fillStyle = '#f3d273';
      ctx.fillRect(floor.x + 8, floor.y + 6, floor.w - 16, 10);
      ctx.restore();
      return;
    }
    const layout = terrainLayout();
    const leftCliff = layout.gaps.some(function (gap) { return Math.abs(gap.right - floor.x) < 1; });
    const rightCliff = layout.gaps.some(function (gap) { return Math.abs(gap.left - (floor.x + floor.w)) < 1; });
    const bottom = UI_Y + 22;
    const makePath = function () {
      ctx.beginPath();
      ctx.moveTo(floor.x, floor.y);
      ctx.lineTo(floor.x + floor.w, floor.y);
      if (rightCliff) {
        ctx.lineTo(floor.x + floor.w, floor.y + 18);
        ctx.lineTo(floor.x + floor.w - 8, floor.y + 42);
        ctx.lineTo(floor.x + floor.w + 2, floor.y + 68);
        ctx.lineTo(floor.x + floor.w - 12, bottom);
      } else ctx.lineTo(floor.x + floor.w, bottom);
      if (leftCliff) {
        ctx.lineTo(floor.x + 12, bottom);
        ctx.lineTo(floor.x - 2, floor.y + 68);
        ctx.lineTo(floor.x + 8, floor.y + 42);
        ctx.lineTo(floor.x, floor.y + 18);
      } else ctx.lineTo(floor.x, bottom);
      ctx.closePath();
    };
    const fill = ctx.createLinearGradient(0, floor.y, 0, bottom);
    fill.addColorStop(0, '#6f8060');
    fill.addColorStop(.35, '#596957');
    fill.addColorStop(1, '#3e4946');
    ctx.fillStyle = fill;
    makePath();
    ctx.fill();
    ctx.save();
    makePath();
    ctx.clip();
    ctx.fillStyle = '#83975e';
    ctx.fillRect(floor.x, floor.y, floor.w, 18);
    ctx.fillStyle = '#d2d879';
    ctx.fillRect(floor.x, floor.y, floor.w, 7);
    ctx.restore();
    ctx.strokeStyle = '#17343a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(floor.x, floor.y); ctx.lineTo(floor.x + floor.w, floor.y); ctx.stroke();
    if (leftCliff) {
      ctx.beginPath(); ctx.moveTo(floor.x, floor.y + 16); ctx.lineTo(floor.x + 8, floor.y + 42); ctx.lineTo(floor.x - 2, floor.y + 68); ctx.lineTo(floor.x + 12, bottom); ctx.stroke();
    }
    if (rightCliff) {
      ctx.beginPath(); ctx.moveTo(floor.x + floor.w, floor.y + 16); ctx.lineTo(floor.x + floor.w - 8, floor.y + 42); ctx.lineTo(floor.x + floor.w + 2, floor.y + 68); ctx.lineTo(floor.x + floor.w - 12, bottom); ctx.stroke();
    }
  }

  function drawDoor(x, platformY, open) {
    const y = platformY - 220;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#17343a'; ctx.lineWidth = 9; ctx.lineJoin = 'round';
    ctx.fillStyle = open ? '#f3d273' : '#2f7775';
    ctx.beginPath(); ctx.moveTo(-70, 210); ctx.lineTo(-70, 80); ctx.quadraticCurveTo(0, -25, 70, 80); ctx.lineTo(70, 210); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e5bd66'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 95, 27, 0, Math.PI * 2); ctx.moveTo(-40, 95); ctx.lineTo(40, 95); ctx.moveTo(0, 55); ctx.lineTo(0, 135); ctx.stroke();
    if (open) { ctx.fillStyle = 'rgba(255,240,189,.72)'; ctx.fillRect(-50, 145, 100, 62); }
    ctx.restore();
  }

  function drawPlayer() {
    const moving = Math.abs(player.vx) > 1;
    const bob = moving ? Math.sin(frame * .32) * 4 : 0;
    ctx.save();
    ctx.translate(player.x, player.y + bob);
    ctx.scale(player.facing, 1);
    ctx.strokeStyle = '#17343a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = '#d94b54';
    ctx.beginPath(); ctx.moveTo(-18, -25); ctx.quadraticCurveTo(-68 - (moving ? 18 : 0), 12, -48, 55); ctx.quadraticCurveTo(-24, 43, 2, 25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0bd';
    ctx.beginPath(); ctx.arc(0, -34, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b3c2f';
    ctx.beginPath(); ctx.moveTo(-34, -42); ctx.quadraticCurveTo(-16, -87, 25, -66); ctx.lineTo(34, -38); ctx.quadraticCurveTo(8, -56, -34, -42); ctx.fill(); ctx.stroke();
    roundedRect(-32, -8, 64, 58, 8, '#278a88', '#17343a', 7);
    ctx.beginPath(); ctx.moveTo(-14, 48); ctx.lineTo(-18 + (moving ? Math.sin(frame * .32) * 12 : 0), 72); ctx.moveTo(14, 48); ctx.lineTo(18 - (moving ? Math.sin(frame * .32) * 12 : 0), 72); ctx.stroke();
    ctx.restore();
  }

  function drawDualMechanic() {
    drawDoor(1580, GROUND_Y, state.bridgeBuilt);
    if (!state.bridgeBuilt) {
      const progress = state.dualHold;
      if (progress > 0) {
        ctx.save();
        ctx.strokeStyle = '#f3d273'; ctx.lineWidth = 16; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(720, GROUND_Y + 4);
        ctx.quadraticCurveTo(800, 720, 720 + 240 * progress, GROUND_Y - 12);
        ctx.moveTo(1200, GROUND_Y + 4);
        ctx.quadraticCurveTo(1120, 720, 1200 - 240 * progress, GROUND_Y - 12);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#fff0bd'; ctx.font = '800 34px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(Math.round(progress * 100) + '%', 960, 700);
      }
    } else {
      ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4;
      for (let x = 760; x < 1180; x += 70) {
        ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 14); ctx.lineTo(x + 28, GROUND_Y + 36); ctx.stroke();
      }
    }
  }

  function drawInkMechanic() {
    drawDoor(1580, GROUND_Y, state.inkBridge);
    let livePath = null;
    pointerModes.forEach(function (mode) { if (mode.type === 'ink') livePath = mode.points; });
    const path = livePath || (!state.inkBridge && performance.now() < state.inkErrorUntil ? state.inkPath : null);
    if (path && path.length > 1) {
      ctx.save();
      ctx.strokeStyle = livePath && logic.strokeLength(path) > 860 ? '#d94b54' : '#17343a';
      ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
      for (let index = 1; index < path.length; index += 1) ctx.lineTo(path[index].x, path[index].y);
      ctx.stroke(); ctx.restore();
    }
    if (state.inkBridge) {
      // 成功后的手势沉到统一实体面：顶边与碰撞共用 INK_SURFACE_Y，人物脚底不会再陷进原始轨迹。
      ctx.save();
      ctx.fillStyle = '#17343a';
      ctx.strokeStyle = '#0e2529';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(650, INK_SURFACE_Y);
      ctx.lineTo(1270, INK_SURFACE_Y);
      ctx.lineTo(1262, INK_SURFACE_Y + 22);
      ctx.bezierCurveTo(1090, INK_SURFACE_Y + 17, 825, INK_SURFACE_Y + 28, 658, INK_SURFACE_Y + 21);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,189,.24)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(674, INK_SURFACE_Y + 9); ctx.bezierCurveTo(860, INK_SURFACE_Y + 4, 1070, INK_SURFACE_Y + 12, 1244, INK_SURFACE_Y + 8); ctx.stroke();
      ctx.restore();
    }
    if (state.inkError && performance.now() < state.inkErrorUntil) {
      roundedRect(700, 620, 520, 76, 18, 'rgba(217,75,84,.92)', '#17343a', 5);
      ctx.fillStyle = '#fff0bd'; ctx.font = '700 30px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(state.inkError, 960, 658);
    }
  }

  function drawTopUI() {
    roundedRect(52, 38, 205, 96, 18, '#fff0bd', '#17343a', 6);
    ctx.fillStyle = '#17343a'; ctx.font = '800 42px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('第 ' + level.id + ' 关', 154, 86);
    roundedRect(HIT.hint.x, HIT.hint.y, HIT.hint.w, HIT.hint.h, 18, '#fff0bd', '#17343a', 6);
    const qx = HIT.hint.x + HIT.hint.w / 2;
    const qy = HIT.hint.y + HIT.hint.h / 2;
    ctx.save(); ctx.strokeStyle = '#17343a'; ctx.fillStyle = '#17343a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(qx - 16, qy - 17); ctx.bezierCurveTo(qx - 12, qy - 35, qx + 20, qy - 34, qx + 20, qy - 12); ctx.bezierCurveTo(qx + 20, qy + 1, qx + 1, qy + 2, qx, qy + 15); ctx.stroke();
    ctx.beginPath(); ctx.arc(qx, qy + 29, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    roundedRect(HIT.reset.x, HIT.reset.y, HIT.reset.w, HIT.reset.h, 18, '#fff0bd', '#17343a', 6);
    const rx = HIT.reset.x + HIT.reset.w / 2;
    const ry = HIT.reset.y + HIT.reset.h / 2;
    ctx.save(); ctx.strokeStyle = '#17343a'; ctx.fillStyle = '#17343a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(rx + 2, ry + 3, 25, -Math.PI * .35, Math.PI * 1.25, false); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx - 16, ry - 15); ctx.lineTo(rx - 37, ry - 8); ctx.lineTo(rx - 23, ry + 7); ctx.closePath(); ctx.fill(); ctx.restore();
    roundedRect(HIT.pause.x, HIT.pause.y, HIT.pause.w, HIT.pause.h, 18, '#fff0bd', '#17343a', 6);
    const px = HIT.pause.x + HIT.pause.w / 2;
    const py = HIT.pause.y + HIT.pause.h / 2;
    roundedRect(px - 19, py - 28, 13, 56, 5, '#17343a'); roundedRect(px + 6, py - 28, 13, 56, 5, '#17343a');
    ctx.fillStyle = '#17343a'; ctx.font = '800 58px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(level.title, W / 2, 120);
    roundedRect(1735, 40, 135, 48, 14, 'rgba(23,52,58,.88)', '#e5bd66', 3);
    ctx.fillStyle = '#fff0bd'; ctx.font = '700 19px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('试玩 v2', 1802, 64);
  }

  function drawControls() {
    ctx.fillStyle = '#687a58'; ctx.fillRect(0, UI_Y, W, H - UI_Y);
    ctx.fillStyle = '#d2d879'; ctx.fillRect(0, UI_Y, W, 14);
    [[HIT.left, '‹', 'left'], [HIT.right, '›', 'right'], [HIT.jump, '⌃', 'jump']].forEach(function (entry) {
      const rect = entry[0];
      const held = controlHeld(entry[2]);
      roundedRect(rect.x, rect.y, rect.w, rect.h, 28, held ? '#2f7775' : '#17343a', '#e5bd66', 5);
      ctx.fillStyle = '#fff0bd'; ctx.font = '900 104px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(entry[1], rect.x + rect.w / 2, rect.y + rect.h / 2 - 6);
    });
  }

  function wrapText(text, centerX, startY, maxWidth, lineHeight) {
    const chars = Array.from(text);
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
    roundedRect(470, 190, 980, 210, 28, 'rgba(255,240,189,.97)', '#17343a', 7);
    ctx.fillStyle = '#17343a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 36px "PingFang SC", sans-serif'; ctx.fillText('提示', W / 2, 240);
    ctx.font = '700 31px "PingFang SC", sans-serif'; wrapText(level.hint, W / 2, 315, 860, 44);
  }

  function drawPause() {
    if (status !== 'paused') return;
    ctx.fillStyle = 'rgba(25,23,36,.64)'; ctx.fillRect(0, 0, W, H);
    roundedRect(475, 265, 970, 500, 36, '#fff0bd', '#17343a', 9);
    ctx.fillStyle = '#17343a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 70px "PingFang SC", sans-serif'; ctx.fillText('已暂停', W / 2, 395);
    ctx.font = '600 30px "PingFang SC", sans-serif'; ctx.fillText('关卡状态会保留', W / 2, 475);
    roundedRect(HIT.pauseBack.x, HIT.pauseBack.y, HIT.pauseBack.w, HIT.pauseBack.h, 22, '#fff0bd', '#17343a', 6);
    roundedRect(HIT.pauseResume.x, HIT.pauseResume.y, HIT.pauseResume.w, HIT.pauseResume.h, 22, '#e7c66d', '#17343a', 6);
    ctx.fillStyle = '#17343a'; ctx.font = '800 30px "PingFang SC", sans-serif';
    ctx.fillText('回到试验选关', HIT.pauseBack.x + HIT.pauseBack.w / 2, HIT.pauseBack.y + HIT.pauseBack.h / 2);
    ctx.fillText('返回游戏', HIT.pauseResume.x + HIT.pauseResume.w / 2, HIT.pauseResume.y + HIT.pauseResume.h / 2);
  }

  function drawSuccess() {
    if (status !== 'success') return;
    ctx.fillStyle = 'rgba(25,23,36,.58)'; ctx.fillRect(0, 0, W, H);
    roundedRect(420, 300, 1080, 500, 36, '#fff0bd', '#17343a', 9);
    ctx.fillStyle = '#17343a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 78px "PingFang SC", sans-serif'; ctx.fillText('脑洞正确', W / 2, 420);
    ctx.font = '600 32px "PingFang SC", sans-serif'; ctx.fillText('第 ' + level.id + ' 关 · ' + level.title, W / 2, 520);
    roundedRect(HIT.successSelect.x, HIT.successSelect.y, HIT.successSelect.w, HIT.successSelect.h, 20, '#fff0bd', '#17343a', 6);
    roundedRect(HIT.successReplay.x, HIT.successReplay.y, HIT.successReplay.w, HIT.successReplay.h, 20, '#e7c66d', '#17343a', 6);
    roundedRect(HIT.successNext.x, HIT.successNext.y, HIT.successNext.w, HIT.successNext.h, 20, '#278a88', '#17343a', 6);
    ctx.font = '800 28px "PingFang SC", sans-serif'; ctx.fillStyle = '#17343a';
    ctx.fillText('试验选关', 665, 696); ctx.fillText('再玩一次', 960, 696);
    ctx.fillStyle = '#fff0bd'; ctx.fillText(currentIndex === LEVELS.length - 1 ? '完成试玩' : '下一关', 1255, 696);
  }

  function drawSelection() {
    drawBackdrop();
    ctx.fillStyle = 'rgba(255,240,189,.86)';
    roundedRect(500, 45, 920, 140, 40, 'rgba(255,240,189,.82)', '#17343a', 7);
    ctx.fillStyle = '#17343a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 58px "PingFang SC", sans-serif'; ctx.fillText('新关卡试玩 · 第二轮', W / 2, 94);
    ctx.font = '600 27px "PingFang SC", sans-serif'; ctx.fillText('第 13、15 关独立体验，不改动当前主线', W / 2, 148);
    selectCards().forEach(function (card) {
      roundedRect(card.x, card.y, card.w, card.h, 28, 'rgba(255,240,189,.94)', '#17343a', 7);
      roundedRect(card.x + 30, card.y + 30, 105, 105, 24, card.index % 2 ? '#e7c66d' : '#79c8d1', '#17343a', 5);
      ctx.fillStyle = '#17343a'; ctx.font = '900 43px sans-serif'; ctx.fillText(String(card.level.id), card.x + 82, card.y + 82);
      ctx.textAlign = 'left'; ctx.font = '900 42px "PingFang SC", sans-serif'; ctx.fillText(card.level.title, card.x + 170, card.y + 70);
      ctx.font = '600 25px "PingFang SC", sans-serif'; ctx.fillStyle = '#435654'; ctx.fillText(card.level.teaser, card.x + 170, card.y + 125);
      ctx.font = '700 23px "PingFang SC", sans-serif'; ctx.fillStyle = '#2f7775'; ctx.fillText('点击试玩', card.x + 170, card.y + 172);
      ctx.textAlign = 'center';
    });
    roundedRect(HIT.selectBack.x, HIT.selectBack.y, HIT.selectBack.w, HIT.selectBack.h, 22, '#fff0bd', '#17343a', 6);
    ctx.fillStyle = '#17343a'; ctx.font = '800 30px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('返回主线选关', W / 2, HIT.selectBack.y + HIT.selectBack.h / 2);
    roundedRect(1735, 40, 135, 48, 14, 'rgba(23,52,58,.88)', '#e5bd66', 3);
    ctx.fillStyle = '#fff0bd'; ctx.font = '700 19px sans-serif'; ctx.fillText('试玩 v2', 1802, 64);
  }

  function renderLevel() {
    drawBackdrop();
    drawDropTerrain();
    floorsForLevel().forEach(drawGround);
    if (level.mechanic === 'dual_bridge') drawDualMechanic();
    else if (level.mechanic === 'ink_path') drawInkMechanic();
    drawPlayer();
    drawTopUI();
    drawControls();
    drawHint();
    drawSuccess();
    drawPause();
  }

  function render() {
    if (screen === 'select') drawSelection();
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
      log('render', 'frame-error', { message: error && error.message, stack: error && error.stack }, 'error');
    }
    requestAnimationFrame(tick);
  }

  document.getElementById('download-logs').addEventListener('click', function () {
    log('export', 'log-export', { entries: logger.entries.length, filename_scope: level ? 'level-' + level.id : 'selection' });
    logger.download('guaiqi-round2-' + (level ? 'level-' + level.id : 'selection') + '.json');
  });
  window.addEventListener('error', function (event) {
    log('runtime', 'uncaught-error', { message: event.message, file: event.filename, line: event.lineno }, 'error');
  });
  window.addEventListener('unhandledrejection', function (event) {
    log('runtime', 'unhandled-rejection', { reason: event.reason && (event.reason.message || String(event.reason)) }, 'error');
  });

  window.__brainstormRound2 = {
    VERSION: VERSION,
    levels: LEVELS.map(function (item) { return Object.assign({}, item); }),
    getState: function () {
      return {
        screen: screen,
        status: status,
        level: level ? level.id : null,
        player: Object.assign({}, player),
        mechanic: JSON.parse(JSON.stringify(state)),
        inputs: { keys: Array.from(heldKeys), controls: Array.from(heldControls.values()), pointers: activePointers.size }
      };
    },
    enterLevelById: function (id) {
      const index = LEVELS.findIndex(function (item) { return item.id === Number(id); });
      if (index >= 0) enterLevel(index, 'debug-api');
      return index >= 0;
    },
    restart: function () { restart('debug-api'); },
    showSelection: function () { enterSelection('debug-api'); },
    setLogModule: function (name, enabled) { logger.setModule(name, enabled); },
    setLogLevel: function (name) { logger.setLevel(name); },
    logs: logger
  };

  resize();
  window.addEventListener('resize', resize);
  const startupParams = new URLSearchParams(location.search);
  const requestedLevel = Number(startupParams.get('level'));
  const requestedIndex = LEVELS.findIndex(function (item) { return item.id === requestedLevel; });
  log('runtime', 'boot', {
    version: VERSION,
    levels: LEVELS.map(function (item) { return item.id; }),
    requested_level: Number.isFinite(requestedLevel) ? requestedLevel : null,
    resolved_screen: requestedIndex >= 0 ? 'level' : 'selection',
    backend: { mode: 'offline-prototype', requests: 'none', persistence: 'none' },
    logging: { max_entries: logger.maxEntries, physics_default_enabled: false, export_available: true }
  });
  if (startupParams.has('level') && requestedIndex < 0) {
    log('state', 'invalid-level-request', { requested_level: requestedLevel, supported_levels: LEVELS.map(function (item) { return item.id; }), fallback: 'selection' }, 'warn');
  }
  if (requestedIndex >= 0) enterLevel(requestedIndex, 'startup-query');
  else enterSelection('boot');
  requestAnimationFrame(tick);
})();
