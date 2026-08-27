(function () {
  'use strict';

  const VERSION = 3;
  const W = 1920;
  const H = 1080;
  const GROUND_Y = 790;
  const UI_Y = 830;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const logger = new window.SmartEggDemoLogger({ version: VERSION, maxEntries: 900, minLevel: 'info' });
  ['runtime', 'state', 'input', 'mechanic', 'render'].forEach(function (name) { logger.setModule(name, true); });

  const LEVELS = [
    { id: 8, title: '日影无声', mechanic: 'shadow', hint: '真正先到门口的，也许不是你。' },
    { id: 9, title: '等风来', mechanic: 'stillness', hint: '有时越着急，远方就越远。' },
    { id: 10, title: '纸上有路', mechanic: 'word_bridge', hint: '有些话，不只是说说而已。' },
    { id: 11, title: '痕迹未散', mechanic: 'persistent_reset', hint: '每次点击重来，箱子都会留下。多重来几次，把它们变成楼梯。' },
    { id: 12, title: '远方未远', mechanic: 'drag_world', hint: '远方不一定需要一步步抵达。' }
  ];

  let levelIndex = 0;
  let level = LEVELS[0];
  let frame = 0;
  let lastTime = performance.now();
  let levelStartedAt = lastTime;
  let gameStatus = 'playing';
  let hintVisible = false;
  let successAt = 0;
  let pointerDrag = null;
  let persistentBoxes = 1;
  const heldKeys = new Set();
  const heldControls = new Map();

  const player = { x: 350, y: GROUND_Y - 55, w: 70, h: 110, vx: 0, vy: 0, onGround: true, facing: 1 };
  const state = {
    sunX: 880,
    shadowTipX: 0,
    shadowHold: 0,
    unlocked: false,
    stillTime: 0,
    stillDoorX: 1510,
    wordPlaced: false,
    wordPos: { x: 0, y: 0 },
    mapOffset: 0,
    cameraX: 0
  };

  const HIT = {
    hint: { x: 285, y: 40, w: 92, h: 92 },
    reset: { x: 395, y: 40, w: 92, h: 92 },
    left: { x: 120, y: 895, w: 180, h: 135 },
    right: { x: 330, y: 895, w: 180, h: 135 },
    jump: { x: 1615, y: 895, w: 185, h: 135 },
    next: { x: 1020, y: 650, w: 260, h: 92 },
    replay: { x: 640, y: 650, w: 260, h: 92 }
  };

  function log(module, event, context, levelName) {
    return logger.log(module, event, Object.assign({ frame: frame, level: level.id, status: gameStatus }, context || {}), levelName);
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
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function resetPlayer() {
    player.x = level.mechanic === 'drag_world' ? 420 : 350;
    player.y = GROUND_Y - player.h / 2;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    heldControls.clear();
  }

  function enterLevel(nextIndex, reason) {
    levelIndex = (nextIndex + LEVELS.length) % LEVELS.length;
    level = LEVELS[levelIndex];
    gameStatus = 'playing';
    hintVisible = false;
    successAt = 0;
    levelStartedAt = performance.now();
    pointerDrag = null;
    state.sunX = 880;
    state.shadowTipX = 0;
    state.shadowHold = 0;
    state.unlocked = false;
    state.stillTime = 0;
    state.stillDoorX = 1510;
    state.wordPlaced = false;
    state.wordPos = { x: 0, y: 0 };
    state.mapOffset = 0;
    state.cameraX = 0;
    persistentBoxes = 1;
    resetPlayer();
    log('state', 'level-enter', { reason: reason || 'direct', mechanic: level.mechanic, title: level.title });
  }

  function restart(reason) {
    if (level.mechanic === 'persistent_reset' && gameStatus === 'playing') {
      const before = persistentBoxes;
      persistentBoxes = Math.min(3, persistentBoxes + 1);
      resetPlayer();
      log('mechanic', 'persistent-reset', { before: before, after: persistentBoxes, preserved: true, reason: reason });
      tone(180, .08);
      return;
    }
    const current = levelIndex;
    enterLevel(current, reason || 'restart');
    tone(180, .08);
  }

  function complete(reason) {
    if (gameStatus !== 'playing') return;
    gameStatus = 'success';
    successAt = performance.now();
    heldControls.clear();
    log('state', 'level-complete', { reason: reason, elapsed_ms: Math.round(successAt - levelStartedAt) });
    tone(660, .11);
    setTimeout(function () { tone(880, .14); }, 120);
  }

  let audioContext = null;
  function tone(frequency, duration) {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(.05, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      log('runtime', 'audio-failed', { message: error && error.message }, 'warn');
    }
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
    if (gameStatus !== 'playing' || !player.onGround) return;
    player.vy = -900;
    player.onGround = false;
    log('input', 'jump', { source: source, x: Math.round(player.x), y: Math.round(player.y) });
    tone(360, .06);
  }

  function wordHomeRect() {
    ctx.save();
    ctx.font = '800 58px "PingFang SC", sans-serif';
    const prefix = '纸上有';
    const total = ctx.measureText(prefix + '路').width;
    const start = W / 2 - total / 2;
    const prefixWidth = ctx.measureText(prefix).width;
    const wordWidth = ctx.measureText('路').width;
    ctx.restore();
    return { x: start + prefixWidth - 8, y: 62, w: wordWidth + 16, h: 75 };
  }

  function onPointerDown(event) {
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (gameStatus === 'success') {
      if (inside(point, HIT.next)) enterLevel(levelIndex + 1, 'success-next');
      else if (inside(point, HIT.replay)) enterLevel(levelIndex, 'success-replay');
      return;
    }
    if (point.x > 1660 && point.y > 185 && point.y < 575) {
      const slot = Math.floor((point.y - 185) / 76);
      if (slot >= 0 && slot < LEVELS.length) enterLevel(slot, 'side-selector');
      return;
    }
    if (inside(point, HIT.hint)) {
      hintVisible = !hintVisible;
      log('state', 'hint-toggle', { visible: hintVisible });
      tone(520, .05);
      return;
    }
    if (inside(point, HIT.reset)) {
      restart('button');
      return;
    }
    const control = controlForPoint(point);
    if (control) {
      heldControls.set(event.pointerId, control);
      if (control === 'jump') tryJump('pointer');
      log('input', 'control-down', { pointer_id: event.pointerId, control: control });
      return;
    }
    if (level.mechanic === 'shadow') {
      const dx = point.x - state.sunX;
      const dy = point.y - 205;
      if (dx * dx + dy * dy < 95 * 95) {
        pointerDrag = { type: 'sun', id: event.pointerId };
        log('mechanic', 'sun-drag-start', { x: Math.round(state.sunX) });
        return;
      }
    }
    if (level.mechanic === 'word_bridge' && !state.wordPlaced && inside(point, wordHomeRect())) {
      pointerDrag = { type: 'word', id: event.pointerId };
      state.wordPos = point;
      log('mechanic', 'word-drag-start', { token: '路' });
      return;
    }
    if (level.mechanic === 'drag_world' && point.y < UI_Y) {
      pointerDrag = { type: 'world', id: event.pointerId, lastX: point.x };
      log('mechanic', 'world-drag-start', { map_offset: Math.round(state.mapOffset) });
    }
  }

  function onPointerMove(event) {
    if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
    const point = pointFromEvent(event);
    if (pointerDrag.type === 'sun') {
      state.sunX = clamp(point.x, 90, 1510);
    } else if (pointerDrag.type === 'word') {
      state.wordPos = point;
    } else if (pointerDrag.type === 'world') {
      const delta = point.x - pointerDrag.lastX;
      pointerDrag.lastX = point.x;
      state.mapOffset = clamp(state.mapOffset + delta, -2900, 0);
    }
  }

  function onPointerUp(event) {
    const point = pointFromEvent(event);
    const releasedControl = heldControls.get(event.pointerId);
    heldControls.delete(event.pointerId);
    if (releasedControl) log('input', 'control-up', { pointer_id: event.pointerId, control: releasedControl });
    if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
    if (pointerDrag.type === 'word') {
      const accepted = point.x > 700 && point.x < 1210 && point.y > 560 && point.y < 790;
      state.wordPlaced = accepted;
      if (accepted) {
        state.wordPos = { x: 950, y: 700 };
        tone(610, .08);
      }
      log('mechanic', 'word-drop', { accepted: accepted, x: Math.round(point.x), y: Math.round(point.y) });
    } else if (pointerDrag.type === 'sun') {
      log('mechanic', 'sun-drag-end', { x: Math.round(state.sunX), shadow_tip_x: Math.round(state.shadowTipX) });
    } else if (pointerDrag.type === 'world') {
      log('mechanic', 'world-drag-end', { map_offset: Math.round(state.mapOffset), door_screen_x: Math.round(3500 + state.mapOffset) });
    }
    pointerDrag = null;
  }

  window.addEventListener('keydown', function (event) {
    const code = event.code || '';
    if (['KeyA', 'KeyD', 'KeyW', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyR'].includes(code)) event.preventDefault();
    if (event.repeat) return;
    heldKeys.add(code);
    log('input', 'key-down', { code: code });
    if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') tryJump('keyboard:' + code);
    if (code === 'KeyR') restart('keyboard');
  });
  window.addEventListener('keyup', function (event) {
    heldKeys.delete(event.code || '');
    log('input', 'key-up', { code: event.code || '' });
  });
  window.addEventListener('blur', function () {
    heldKeys.clear();
    heldControls.clear();
    pointerDrag = null;
    log('input', 'all-input-reset', { reason: 'window-blur' });
  });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  function floorsForLevel() {
    if (level.mechanic === 'word_bridge') {
      const floors = [
        { x: 0, y: GROUND_Y, w: 720, h: 80 },
        { x: 1180, y: GROUND_Y, w: 740, h: 80 }
      ];
      if (state.wordPlaced) floors.push({ x: 720, y: 690, w: 460, h: 55, word: true });
      return floors;
    }
    if (level.mechanic === 'persistent_reset') {
      const floors = [{ x: 0, y: GROUND_Y, w: W, h: 80 }, { x: 1260, y: 370, w: 500, h: 55 }];
      const steps = [
        { x: 730, y: 685, w: 210, h: 105 },
        { x: 920, y: 580, w: 210, h: 105 },
        { x: 1110, y: 475, w: 210, h: 105 }
      ];
      return floors.concat(steps.slice(0, persistentBoxes));
    }
    if (level.mechanic === 'stillness') {
      return [{ x: -1000000, y: GROUND_Y, w: 2000000, h: 80 }];
    }
    return [{ x: 0, y: GROUND_Y, w: W, h: 80 }];
  }

  function updatePlayer(dt) {
    if (gameStatus !== 'playing') return;
    const direction = (rightHeld() ? 1 : 0) - (leftHeld() ? 1 : 0);
    player.vx = direction * 310;
    if (direction) player.facing = direction;
    player.x += player.vx * dt;
    player.x = level.mechanic === 'stillness'
      ? Math.max(55, player.x)
      : clamp(player.x, 55, W - 55);
    player.vy = Math.min(1200, player.vy + 1900 * dt);
    const previousBottom = player.y + player.h / 2;
    player.y += player.vy * dt;
    player.onGround = false;
    const nextBottom = player.y + player.h / 2;
    const floors = floorsForLevel();
    const landingCandidates = [];
    for (const floor of floors) {
      const overlapsX = player.x + player.w / 2 > floor.x && player.x - player.w / 2 < floor.x + floor.w;
      if (overlapsX && player.vy >= 0 && previousBottom <= floor.y + 8 && nextBottom >= floor.y) {
        landingCandidates.push(floor);
      }
    }
    if (landingCandidates.length) {
      const landing = landingCandidates.reduce(function (best, floor) { return floor.y < best.y ? floor : best; });
      player.y = landing.y - player.h / 2;
      player.vy = 0;
      player.onGround = true;
    }
    if (level.mechanic === 'stillness') {
      const targetCameraX = Math.max(0, player.x - 420);
      state.cameraX += (targetCameraX - state.cameraX) * Math.min(1, dt * 7);
    }
    if (player.y > H + 160) {
      log('state', 'player-fell', { x: Math.round(player.x), y: Math.round(player.y) }, 'warn');
      resetPlayer();
      tone(120, .12);
    }
  }

  function updateMechanic(dt) {
    if (gameStatus !== 'playing') return;
    if (level.mechanic === 'shadow') {
      state.shadowTipX = clamp(player.x + (player.x - state.sunX) * 1.75, 30, W - 30);
      const touching = Math.abs(state.shadowTipX - 820) < 78;
      state.shadowHold = touching ? state.shadowHold + dt : Math.max(0, state.shadowHold - dt * 2);
      if (!state.unlocked && state.shadowHold > .65) {
        state.unlocked = true;
        log('mechanic', 'shadow-switch-unlocked', { sun_x: Math.round(state.sunX), shadow_tip_x: Math.round(state.shadowTipX) });
        tone(740, .13);
      }
      if (state.unlocked && Math.abs(player.x - 1540) < 85) complete('shadow-door');
    } else if (level.mechanic === 'stillness') {
      const active = leftHeld() || rightHeld() || jumpHeld() || Math.abs(player.vy) > 30;
      if (active) {
        if (state.stillTime > .1) log('mechanic', 'stillness-broken', { held_seconds: Number(state.stillTime.toFixed(2)) });
        state.stillTime = 0;
        const direction = (rightHeld() ? 1 : 0) - (leftHeld() ? 1 : 0);
        if (direction) state.stillDoorX += direction * 310 * dt;
        state.stillDoorX = Math.max(player.x + 520, state.stillDoorX);
      } else {
        state.stillTime += dt;
        if (state.stillTime > 2.2) state.stillDoorX += (player.x + 135 - state.stillDoorX) * Math.min(1, dt * 1.35);
        if (state.stillTime > 3 && Math.abs(state.stillDoorX - (player.x + 135)) < 22) complete('waited-without-input');
      }
    } else if (level.mechanic === 'word_bridge') {
      if (state.wordPlaced && Math.abs(player.x - 1535) < 90) complete('word-became-bridge');
    } else if (level.mechanic === 'persistent_reset') {
      if (persistentBoxes >= 3 && player.y < 360 && player.x > 1430) complete('persistent-box-stair');
    } else if (level.mechanic === 'drag_world') {
      const doorScreenX = 3500 + state.mapOffset;
      if (doorScreenX > 0 && doorScreenX < W && Math.abs(player.x - doorScreenX) < 85) complete('dragged-world-to-player');
    }
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

  function drawBackdrop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    gradient.addColorStop(0, '#79c8d1');
    gradient.addColorStop(.52, '#f0bd79');
    gradient.addColorStop(1, '#d27d70');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    // 影子机关本身已有可拖动太阳；该关隐藏装饰太阳，避免画面出现两个太阳。
    if (level.mechanic !== 'shadow') {
      ctx.fillStyle = 'rgba(255,240,189,.9)';
      ctx.beginPath(); ctx.arc(1510, 175, 72, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.62)';
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

  function drawGround(floor) {
    ctx.fillStyle = floor.word ? '#fff0bd' : '#687a58';
    ctx.fillRect(floor.x, floor.y, floor.w, floor.y >= GROUND_Y ? H - floor.y : floor.h);
    ctx.fillStyle = floor.word ? '#e5bd66' : '#d2d879';
    ctx.fillRect(floor.x, floor.y, floor.w, 16);
    ctx.strokeStyle = '#17343a';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(floor.x, floor.y); ctx.lineTo(floor.x + floor.w, floor.y); ctx.stroke();
    if (floor.word) {
      ctx.fillStyle = '#17343a'; ctx.font = '900 80px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('路', floor.x + floor.w / 2, floor.y + floor.h / 2 - 5);
    }
  }

  function drawPlayer() {
    const moving = Math.abs(player.vx) > 1;
    const bob = moving ? Math.sin(frame * .32) * 4 : 0;
    const x = player.x, y = player.y + bob;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(player.facing, 1);
    ctx.strokeStyle = '#17343a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = '#d94b54';
    ctx.beginPath(); ctx.moveTo(-18, -25); ctx.quadraticCurveTo(-68 - (moving ? 18 : 0), 12, -48, 55); ctx.quadraticCurveTo(-24, 43, 2, 25); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0bd';
    ctx.beginPath(); ctx.arc(0, -34, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b3c2f';
    ctx.beginPath(); ctx.moveTo(-34, -42); ctx.quadraticCurveTo(-16, -87, 25, -66); ctx.lineTo(34, -38); ctx.quadraticCurveTo(8, -56, -34, -42); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#278a88'; roundedRect(-32, -8, 64, 58, 8, '#278a88', '#17343a', 7);
    ctx.beginPath(); ctx.moveTo(-14, 48); ctx.lineTo(-18 + (moving ? Math.sin(frame * .32) * 12 : 0), 72); ctx.moveTo(14, 48); ctx.lineTo(18 - (moving ? Math.sin(frame * .32) * 12 : 0), 72); ctx.stroke();
    ctx.restore();
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
    if (open) { ctx.fillStyle = 'rgba(255,240,189,.75)'; ctx.fillRect(-50, 145, 100, 62); }
    ctx.restore();
  }

  function drawCrate(floor) {
    ctx.fillStyle = '#a96642';
    ctx.fillRect(floor.x, floor.y, floor.w, floor.h);
    ctx.strokeStyle = '#17343a'; ctx.lineWidth = 7; ctx.strokeRect(floor.x, floor.y, floor.w, floor.h);
    ctx.beginPath(); ctx.moveTo(floor.x + 14, floor.y + 14); ctx.lineTo(floor.x + floor.w - 14, floor.y + floor.h - 14); ctx.moveTo(floor.x + floor.w - 14, floor.y + 14); ctx.lineTo(floor.x + 14, floor.y + floor.h - 14); ctx.stroke();
  }

  function drawMechanic() {
    if (level.mechanic === 'shadow') {
      const switchOn = state.unlocked || Math.abs(state.shadowTipX - 820) < 78;
      const sunGlow = ctx.createRadialGradient(state.sunX, 205, 10, state.sunX, 205, 105);
      sunGlow.addColorStop(0, '#fff0bd'); sunGlow.addColorStop(1, 'rgba(255,240,189,0)');
      ctx.fillStyle = sunGlow; ctx.beginPath(); ctx.arc(state.sunX, 205, 110, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f3cf66'; ctx.strokeStyle = '#17343a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(state.sunX, 205, 55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // 影子必须在缩放后的手机/电脑画面中仍清晰可见，不能和地面描边重合。
      ctx.save();
      ctx.fillStyle = 'rgba(23,52,58,.36)';
      ctx.strokeStyle = 'rgba(23,52,58,.62)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(player.x - 24, GROUND_Y - 3);
      ctx.lineTo(player.x + 24, GROUND_Y - 3);
      ctx.lineTo(state.shadowTipX + 34, GROUND_Y - 28);
      ctx.lineTo(state.shadowTipX - 34, GROUND_Y - 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      roundedRect(765, GROUND_Y - 16, 110, 24, 9, switchOn ? '#f3cf66' : '#435654', '#17343a', 5);
      drawDoor(1540, GROUND_Y, state.unlocked);
    } else if (level.mechanic === 'stillness') {
      drawDoor(state.stillDoorX, GROUND_Y, state.stillTime > 2.2);
      for (let x = Math.floor((state.cameraX - 180) / 210) * 210; x < state.cameraX + W + 180; x += 210) {
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x - 10, GROUND_Y - 22); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x + 13, GROUND_Y - 18); ctx.stroke();
      }
      if (state.stillTime > .3) {
        const dots = Math.min(3, Math.floor(state.stillTime));
        ctx.fillStyle = '#fff0bd'; ctx.font = '800 42px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('·'.repeat(dots), state.stillDoorX, GROUND_Y - 255);
      }
    } else if (level.mechanic === 'word_bridge') {
      drawDoor(1535, GROUND_Y, state.wordPlaced);
      if (pointerDrag && pointerDrag.type === 'word') {
        roundedRect(state.wordPos.x - 52, state.wordPos.y - 52, 104, 104, 18, '#fff0bd', '#17343a', 6);
        ctx.fillStyle = '#17343a'; ctx.font = '900 66px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('路', state.wordPos.x, state.wordPos.y);
      }
    } else if (level.mechanic === 'persistent_reset') {
      const boxFloors = floorsForLevel().slice(2);
      boxFloors.forEach(drawCrate);
      drawDoor(1515, 370, persistentBoxes >= 3);
    } else if (level.mechanic === 'drag_world') {
      ctx.save();
      ctx.translate(state.mapOffset, 0);
      for (let x = 700; x < 3900; x += 330) {
        ctx.strokeStyle = '#17343a'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x - 12, GROUND_Y - 26); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x + 17, GROUND_Y - 20); ctx.stroke();
      }
      drawDoor(3500, GROUND_Y, 3500 + state.mapOffset < 1800);
      ctx.restore();
    }
  }

  function drawTopUI() {
    roundedRect(52, 38, 205, 96, 18, '#fff0bd', '#17343a', 6);
    ctx.fillStyle = '#17343a'; ctx.font = '800 42px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('第 ' + level.id + ' 关', 154, 86);
    roundedRect(HIT.hint.x, HIT.hint.y, HIT.hint.w, HIT.hint.h, 18, '#fff0bd', '#17343a', 6);
    ctx.fillStyle = '#17343a';
    ctx.font = '900 58px sans-serif'; ctx.fillText('?', HIT.hint.x + HIT.hint.w / 2, HIT.hint.y + HIT.hint.h / 2 + 2);
    roundedRect(HIT.reset.x, HIT.reset.y, HIT.reset.w, HIT.reset.h, 18, '#fff0bd', '#17343a', 6);
    ctx.fillStyle = '#17343a';
    ctx.font = '800 50px sans-serif'; ctx.fillText('↻', HIT.reset.x + HIT.reset.w / 2, HIT.reset.y + HIT.reset.h / 2 + 1);

    ctx.fillStyle = '#17343a'; ctx.font = '800 58px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (level.mechanic === 'word_bridge') {
      const home = wordHomeRect();
      const prefixWidth = ctx.measureText('纸上有').width;
      ctx.fillText('纸上有', home.x + 8 - prefixWidth / 2, 120);
      if (!state.wordPlaced && !(pointerDrag && pointerDrag.type === 'word')) ctx.fillText('路', home.x + home.w / 2, 120);
    } else {
      ctx.fillText(level.title, W / 2, 120);
    }

    LEVELS.forEach(function (candidate, index) {
      const y = 195 + index * 76;
      roundedRect(1740, y, 92, 58, 14, index === levelIndex ? '#f3cf66' : 'rgba(255,240,189,.78)', '#17343a', 4);
      ctx.fillStyle = '#17343a'; ctx.font = '800 25px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(String(candidate.id), 1786, y + 29);
    });
  }

  function drawControls() {
    ctx.fillStyle = '#687a58'; ctx.fillRect(0, UI_Y, W, H - UI_Y);
    ctx.fillStyle = '#d2d879'; ctx.fillRect(0, UI_Y, W, 14);
    const controls = [[HIT.left, '‹'], [HIT.right, '›'], [HIT.jump, '⌃']];
    controls.forEach(function (entry) {
      const rect = entry[0];
      roundedRect(rect.x, rect.y, rect.w, rect.h, 28, '#17343a', '#e5bd66', 5);
      ctx.fillStyle = '#fff0bd'; ctx.font = '900 104px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(entry[1], rect.x + rect.w / 2, rect.y + rect.h / 2 - 6);
    });
  }

  function drawHint() {
    if (!hintVisible) return;
    roundedRect(530, 205, 860, 170, 28, 'rgba(255,240,189,.97)', '#17343a', 7);
    ctx.fillStyle = '#17343a'; ctx.font = '700 40px "PingFang SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(level.hint, W / 2, 290);
  }

  function drawSuccess() {
    if (gameStatus !== 'success') return;
    ctx.fillStyle = 'rgba(25,23,36,.58)'; ctx.fillRect(0, 0, W, H);
    roundedRect(475, 320, 970, 470, 36, '#fff0bd', '#17343a', 9);
    ctx.fillStyle = '#17343a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 78px "PingFang SC", sans-serif'; ctx.fillText('脑洞正确', W / 2, 445);
    ctx.font = '600 32px "PingFang SC", sans-serif'; ctx.fillText('第 ' + level.id + ' 关 · ' + level.title, W / 2, 530);
    roundedRect(HIT.replay.x, HIT.replay.y, HIT.replay.w, HIT.replay.h, 20, '#e7c66d', '#17343a', 6);
    roundedRect(HIT.next.x, HIT.next.y, HIT.next.w, HIT.next.h, 20, '#278a88', '#17343a', 6);
    ctx.fillStyle = '#17343a'; ctx.font = '800 34px "PingFang SC", sans-serif'; ctx.fillText('再玩一次', HIT.replay.x + HIT.replay.w / 2, HIT.replay.y + HIT.replay.h / 2);
    ctx.fillStyle = '#fff0bd'; ctx.fillText(levelIndex === LEVELS.length - 1 ? '回到第8关' : '下一关', HIT.next.x + HIT.next.w / 2, HIT.next.y + HIT.next.h / 2);
  }

  function render() {
    drawBackdrop();
    if (level.mechanic === 'stillness') {
      ctx.save();
      ctx.translate(-state.cameraX, 0);
    }
    floorsForLevel().forEach(function (floor, index) {
      if (level.mechanic === 'persistent_reset' && index >= 2) return;
      if (level.mechanic === 'stillness') drawGround({ x: state.cameraX - 200, y: floor.y, w: W + 400, h: floor.h });
      else drawGround(floor);
    });
    drawMechanic();
    drawPlayer();
    if (level.mechanic === 'stillness') ctx.restore();
    drawTopUI();
    drawControls();
    drawHint();
    drawSuccess();
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
    log('runtime', 'log-export', { entries: logger.entries.length });
    logger.download('smart-egg-brainstorm-v3-level-' + level.id + '.json');
  });
  window.addEventListener('error', function (event) {
    log('runtime', 'uncaught-error', { message: event.message, file: event.filename, line: event.lineno }, 'error');
  });
  window.addEventListener('unhandledrejection', function (event) {
    log('runtime', 'unhandled-rejection', { reason: event.reason && (event.reason.message || String(event.reason)) }, 'error');
  });

  window.__brainstormDemo = {
    VERSION: VERSION,
    levels: LEVELS.map(function (item) { return Object.assign({}, item); }),
    getState: function () {
      return {
        level: level.id,
        status: gameStatus,
        player: Object.assign({}, player),
        mechanic: Object.assign({}, state),
        persistentBoxes: persistentBoxes
      };
    },
    enterLevelById: function (id) {
      const index = LEVELS.findIndex(function (item) { return item.id === Number(id); });
      if (index >= 0) enterLevel(index, 'debug-api');
    },
    restart: function () { restart('debug-api'); },
    logs: logger
  };

  resize();
  window.addEventListener('resize', resize);
  log('runtime', 'boot', { version: VERSION, levels: LEVELS.map(function (item) { return item.id; }), backend: { mode: 'offline-prototype', requests: 'none' } });
  enterLevel(0, 'boot');
  requestAnimationFrame(tick);
})();
