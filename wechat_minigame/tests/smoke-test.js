'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const bgmAmbientPath = path.join(projectRoot, 'wechat_minigame/assets/bgm-wilds-ambient.wav');
const jumpActionPath = path.join(projectRoot, 'wechat_minigame/assets/sfx-jump-action.wav');
const doorKnockPath = path.join(projectRoot, 'wechat_minigame/assets/sfx-door-knock.wav');
assert.ok(fs.existsSync(bgmAmbientPath) && fs.statSync(bgmAmbientPath).size > 1000,
  '微信包必须包含独立、连续的旷野环境背景音乐');
assert.ok(fs.existsSync(jumpActionPath) && fs.statSync(jumpActionPath).size > 1000,
  '微信包必须包含独立的跳跃动作音效采样');
assert.ok(fs.existsSync(doorKnockPath) && fs.statSync(doorKnockPath).size > 1000,
  '微信包必须包含独立的木质敲门音效采样');
assert.strictEqual(
  fs.readFileSync(path.join(projectRoot, 'wechat_minigame/js/levels.js'), 'utf8'),
  fs.readFileSync(path.join(projectRoot, 'godot_project/levels/levels_bundle.js'), 'utf8'),
  '微信关卡包必须与网页20关离线包逐字一致'
);
assert.strictEqual(
  fs.readFileSync(path.join(projectRoot, 'wechat_minigame/js/physics-collision.js'), 'utf8'),
  fs.readFileSync(path.join(projectRoot, 'web_preview/physics-collision.js'), 'utf8'),
  '微信碰撞模块必须与网页同源'
);
assert.strictEqual(
  fs.readFileSync(path.join(projectRoot, 'wechat_minigame/js/accepted-mechanics.js'), 'utf8'),
  fs.readFileSync(path.join(projectRoot, 'web_preview/accepted-mechanics.js'), 'utf8'),
  '微信评审机制模块必须与网页同源'
);

function contextStub() {
  return new Proxy({
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => ({}),
    measureText: text => ({ width: String(text).length * 20 })
  }, {
    get(target, key) {
      if (!(key in target)) target[key] = function () {};
      return target[key];
    },
    set(target, key, value) { target[key] = value; return true; }
  });
}

function canvasStub() {
  return {
    width: 1280,
    height: 720,
    getContext: () => contextStub(),
    requestAnimationFrame: callback => { callbacks.raf = callback; return 1; },
    cancelAnimationFrame: () => {}
  };
}

const callbacks = {};
const storageCalls = { set:[], remove:[], clear:0 };
const previousFaultFixture = {
  id: 'fault-previous-test',
  sessionId: 'session-previous-test',
  kind: 'frame-stall',
  levelIndex: 0,
  frame: 41,
  lastAction: 'jump',
  at: '2026-08-31T12:00:00.000Z'
};
const lastFaultFixture = {
  id: 'fault-last-test',
  sessionId: 'session-last-test',
  kind: 'unhandled-rejection',
  levelIndex: 0,
  frame: 42,
  message: 'simulated recovered fault',
  at: '2026-08-31T12:00:01.000Z'
};
const storageValues = new Map([
  ['smart_egg_fault_journal_v1', JSON.stringify({
    schemaVersion: 1,
    previousFault: previousFaultFixture,
    lastFault: lastFaultFixture
  })]
]);
let clipboardWrites = 0;
let clipboardReads = 0;
let keyboardShows = 0;
let modalShows = 0;
let lastFileWrite = null;
let clipboardWriteFails = false;
const innerAudioOptionCalls = [];
const innerAudioInstances = [];
let innerAudioCanplayMode = 'sync';
let innerAudioAutoplayMode = 'native';
let innerAudioProgressMode = 'advancing';
const hostDocumentListeners = Object.create(null);
global.GameGlobal = global;
const readonlyHostDocument = Object.freeze({
  host: 'wechat-document',
  addEventListener: (type, listener) => {
    (hostDocumentListeners[type] || (hostDocumentListeners[type] = [])).push(listener);
  },
  removeEventListener: () => {}
});
const readonlyHostLocation = Object.freeze({ href: 'wechat-host:///' });
const readonlyHostNavigator = Object.freeze({ userAgent: 'wechat-host' });
const readonlyHostAddEventListener = function () {};
const readonlyHostDispatchEvent = function () { return true; };
const readonlyHostRequestAnimationFrame = function () { return 987; };
const readonlyHostAlert = function () {};
const readonlyHostAudioContext = function HostAudioContext() {};
const windowInfoFixture = {
  windowWidth: 2403,
  windowHeight: 1080,
  pixelRatio: 1,
  safeArea: { left:104, top:0, right:2403, bottom:1080, width:2299, height:1080 }
};
const menuButtonRectFixture = {
  left:2148, top:24, right:2370, bottom:104, width:222, height:80
};
// 微信基础库 3.17.x 的 Window 对象以只读 getter 暴露这两个别名。
// 兼容层必须复用它们，不能在严格模式里直接赋值。
Object.defineProperty(global, 'window', {
  configurable: false,
  enumerable: true,
  get: () => global
});
Object.defineProperty(global, 'globalThis', {
  configurable: false,
  enumerable: true,
  get: () => global
});
Object.defineProperty(global, 'document', {
  configurable: false,
  enumerable: true,
  get: () => readonlyHostDocument
});
Object.defineProperty(global, 'location', {
  configurable: false,
  enumerable: true,
  get: () => readonlyHostLocation
});
Object.defineProperty(global, 'navigator', {
  configurable: false,
  enumerable: true,
  get: () => readonlyHostNavigator
});
for (const [key, value] of Object.entries({
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  screen: Object.freeze({ width: 1280, height: 720 })
})) {
  Object.defineProperty(global, key, {
    configurable: false,
    enumerable: true,
    get: () => value
  });
}
for (const [key, value] of Object.entries({
  addEventListener: readonlyHostAddEventListener,
  removeEventListener: function () {},
  dispatchEvent: readonlyHostDispatchEvent,
  requestAnimationFrame: readonlyHostRequestAnimationFrame,
  cancelAnimationFrame: function () {},
  alert: readonlyHostAlert,
  AudioContext: readonlyHostAudioContext,
  webkitAudioContext: readonlyHostAudioContext
})) {
  Object.defineProperty(global, key, {
    configurable: false,
    enumerable: true,
    get: () => value
  });
}
global.wx = {
  createCanvas: canvasStub,
  getWindowInfo: () => Object.assign({}, windowInfoFixture, {
    safeArea:Object.assign({}, windowInfoFixture.safeArea)
  }),
  getMenuButtonBoundingClientRect: () => Object.assign({}, menuButtonRectFixture),
  getAppBaseInfo: () => ({ SDKVersion: 'test', language: 'zh_CN' }),
  getDeviceInfo: () => ({ platform: 'devtools' }),
  getStorageSync: key => storageValues.has(String(key)) ? storageValues.get(String(key)) : '',
  setStorageSync: (key, value) => {
    storageCalls.set.push({ key, value });
    storageValues.set(String(key), value);
  },
  removeStorageSync: key => {
    storageCalls.remove.push(key);
    storageValues.delete(String(key));
  },
  clearStorageSync: () => {
    storageCalls.clear += 1;
    storageValues.clear();
  },
  setInnerAudioOption: options => {
    innerAudioOptionCalls.push(Object.assign({}, options));
    if (options && typeof options.success === 'function') options.success();
  },
  createInnerAudioContext: () => {
    const operations = [];
    let canplayHandler = null;
    let playHandler = null;
    let pauseHandler = null;
    let endedHandler = null;
    let stopHandler = null;
    let errorHandler = null;
    let timeUpdateHandler = null;
    let waitingHandler = null;
    let source = '';
    let currentTimeBase = 0;
    let playStartedAt = 0;
    function liveCurrentTime() {
      return currentTimeBase + (innerAudioProgressMode === 'advancing' && instance.playing && playStartedAt
        ? (Date.now() - playStartedAt) / 1000 : 0);
    }
    function commitCurrentTime() {
      currentTimeBase = liveCurrentTime();
      playStartedAt = 0;
    }
    const instance = {
      operations,
      autoplay: false,
      loop: false,
      obeyMuteSwitch: true,
      volume: 1,
      playbackRate: 1,
      onCanplay(handler) {
        operations.push('onCanplay');
        canplayHandler = handler;
      },
      offCanplay(handler) {
        operations.push('offCanplay');
        if (!handler || canplayHandler === handler) canplayHandler = null;
      },
      onPlay(handler) {
        operations.push('onPlay');
        playHandler = handler;
      },
      offPlay(handler) {
        operations.push('offPlay');
        if (!handler || playHandler === handler) playHandler = null;
      },
      onPause(handler) {
        operations.push('onPause');
        pauseHandler = handler;
      },
      offPause(handler) {
        operations.push('offPause');
        if (!handler || pauseHandler === handler) pauseHandler = null;
      },
      onEnded(handler) {
        operations.push('onEnded');
        endedHandler = handler;
      },
      offEnded(handler) {
        operations.push('offEnded');
        if (!handler || endedHandler === handler) endedHandler = null;
      },
      onStop(handler) {
        operations.push('onStop');
        stopHandler = handler;
      },
      offStop(handler) {
        operations.push('offStop');
        if (!handler || stopHandler === handler) stopHandler = null;
      },
      onError(handler) {
        operations.push('onError');
        errorHandler = handler;
      },
      offError(handler) {
        operations.push('offError');
        if (!handler || errorHandler === handler) errorHandler = null;
      },
      onTimeUpdate(handler) {
        operations.push('onTimeUpdate');
        timeUpdateHandler = handler;
      },
      offTimeUpdate(handler) {
        operations.push('offTimeUpdate');
        if (!handler || timeUpdateHandler === handler) timeUpdateHandler = null;
      },
      onWaiting(handler) {
        operations.push('onWaiting');
        waitingHandler = handler;
      },
      offWaiting(handler) {
        operations.push('offWaiting');
        if (!handler || waitingHandler === handler) waitingHandler = null;
      },
      play() {
        operations.push('play');
        if (!instance.playing) playStartedAt = Date.now();
        instance.playing = true;
        if (playHandler) playHandler();
        setTimeout(() => {
          if (innerAudioProgressMode === 'advancing' && instance.playing && timeUpdateHandler) timeUpdateHandler();
        }, 30);
      },
      pause() {
        operations.push('pause');
        commitCurrentTime();
        instance.playing = false;
        if (pauseHandler) pauseHandler();
      },
      stop() {
        operations.push('stop');
        commitCurrentTime();
        instance.playing = false;
        if (stopHandler) stopHandler();
      },
      destroy() {
        operations.push('destroy');
        commitCurrentTime();
        instance.playing = false;
      },
      get currentTime() { return liveCurrentTime(); },
      get duration() { return 16; },
      get paused() { return !instance.playing; },
      playing: false,
      snapshotCanplayHandler() { return canplayHandler; },
      snapshotErrorHandler() { return errorHandler; },
      emitCanplay() { if (canplayHandler) canplayHandler(); },
      emitPause() {
        commitCurrentTime();
        instance.playing = false;
        if (pauseHandler) pauseHandler();
      },
      emitEnded() { if (endedHandler) endedHandler(); },
      emitError(error) { if (errorHandler) errorHandler(error); },
      emitWaiting() { if (waitingHandler) waitingHandler(); }
    };
    Object.defineProperty(instance, 'src', {
      enumerable: true,
      configurable: true,
      get: () => source,
      set: value => {
        source = String(value);
        operations.push('src');
        // 真机长音轨可能先通过 autoplay 进入 onPlay，却漏发/迟发 canplay。
        // 模拟器必须覆盖这条真实启动路径，不能只靠测试主动 emitCanplay。
        if (instance.autoplay && innerAudioAutoplayMode === 'native') instance.play();
        // 模拟资源已经就绪：若监听器在 src 之前注册，会立即收到 canplay；
        // 若顺序反了则故意不补发，用来锁定真机“偶发无声”的竞态。
        if (canplayHandler && innerAudioCanplayMode === 'sync') canplayHandler();
      }
    });
    innerAudioInstances.push(instance);
    return instance;
  },
  onTouchStart: fn => { callbacks.touchstart = fn; },
  onTouchMove: fn => { callbacks.touchmove = fn; },
  onTouchEnd: fn => { callbacks.touchend = fn; },
  onTouchCancel: fn => { callbacks.touchcancel = fn; },
  onHide: fn => { callbacks.hide = fn; },
  onShow: fn => { callbacks.show = fn; },
  onAudioInterruptionBegin: fn => { callbacks.audioInterruptionBegin = fn; },
  onAudioInterruptionEnd: fn => { callbacks.audioInterruptionEnd = fn; },
  onWindowResize: fn => { callbacks.resize = fn; },
  onNetworkStatusChange: fn => { callbacks.network = fn; },
  onError: fn => { callbacks.error = fn; },
  onUnhandledRejection: fn => { callbacks.rejection = fn; },
  onKeyboardConfirm: () => {},
  onKeyboardComplete: () => {},
  offKeyboardConfirm: () => {},
  offKeyboardComplete: () => {},
  showKeyboard: () => { keyboardShows += 1; },
  hideKeyboard: () => {},
  getClipboardData: options => { clipboardReads += 1; options.fail(); },
  setClipboardData: options => {
    clipboardWrites += 1;
    if (clipboardWriteFails) options.fail && options.fail({ errMsg:'simulated-clipboard-failure' });
    else options.success && options.success();
  },
  showToast: () => {},
  showModal: () => { modalShows += 1; },
  getFileSystemManager: () => ({
    writeFile: options => {
      lastFileWrite = { filePath:options.filePath, data:options.data, encoding:options.encoding };
      options.success();
    }
  }),
  env: { USER_DATA_PATH: '/tmp' }
};

const nativeObjectFromEntries = Object.fromEntries;
Object.fromEntries = undefined;
require('../game.js');

setTimeout(async () => {
  assert.strictEqual(global.__wxMiniGame, true);
  assert.strictEqual(global.window, global, 'readonly host window alias must be preserved');
  assert.strictEqual(global.document, readonlyHostDocument, 'readonly host document must not be overwritten');
  assert.strictEqual(global.location, readonlyHostLocation, 'readonly host location must not be overwritten');
  assert.strictEqual(global.navigator, readonlyHostNavigator, 'readonly host navigator must not be mutated');
  assert.strictEqual(global.innerWidth, 1280, 'readonly host viewport must be preserved');
  assert.strictEqual(global.addEventListener, readonlyHostAddEventListener, 'host event methods must be preserved for DevTools handshakes');
  assert.strictEqual(global.dispatchEvent, readonlyHostDispatchEvent, 'host dispatchEvent must not be replaced');
  assert.strictEqual(global.requestAnimationFrame, readonlyHostRequestAnimationFrame, 'host RAF must not be replaced');
  assert.strictEqual(global.alert, readonlyHostAlert, 'host alert signal must not be replaced');
  assert.strictEqual(global.AudioContext, readonlyHostAudioContext, 'host audio constructor must not be replaced');
  const gameWindow = global.__SMART_EGG_WECHAT_ENV__.window;
  assert.notStrictEqual(gameWindow, global, 'game browser shims must live on an isolated compatibility window');
  assert.ok(gameWindow.document.getElementById('game-canvas'));
  assert.strictEqual(gameWindow.navigator.userAgent, 'WeChatMiniGame/test');
  assert.strictEqual(global.__SMART_EGG_WECHAT_BRIDGE__.version, 192);
  assert.strictEqual(Object.keys(global.__SMART_EGG_LEVELS__).length, 20);
  assert.deepStrictEqual(Object.keys(global.__SMART_EGG_LEVELS__).map(Number), Array.from({ length:20 }, (_, index) => index));
  assert.ok(gameWindow.__debug, 'game debug API should be installed');
  assert.strictEqual(gameWindow.__debug.VERSION, 192);
  assert.strictEqual(gameWindow.__debug.getState(), 'menu');
  assert.deepStrictEqual(gameWindow.__debug.getFeatures(), { creatorMode:{ enabled:false, localData:'preserved' } });
  assert.strictEqual(gameWindow.__debug.setState('creatorList'), 'menu', 'disabled creator route must be blocked');
  assert.strictEqual(gameWindow.__debug.getState(), 'menu');
  assert.strictEqual(gameWindow.__wxPromptLevelCode, undefined,
    'disabled creator mode must not register the clipboard/keyboard level-code bridge');
  assert.strictEqual(clipboardReads, 0, 'disabled creator mode must not read clipboard data');
  assert.strictEqual(keyboardShows, 0, 'disabled creator mode must not open the level-code keyboard');
  assert.strictEqual(storageCalls.remove.includes('smart_egg_creator_levels_v1'), false, 'creator data must not be deleted');
  assert.strictEqual(storageCalls.clear, 0, 'offline mode must not clear storage');
  const viewport = gameWindow.__debug.getViewportLayout();
  assert.deepStrictEqual({
    baseWidth:viewport.baseWidth,
    viewWidth:viewport.viewWidth,
    viewHeight:viewport.viewHeight,
    sidePad:viewport.sidePad,
    strategy:viewport.strategy,
    backingSize:viewport.backingSize
  }, {
    baseWidth:1920,
    viewWidth:2403,
    viewHeight:1080,
    sidePad:241.5,
    strategy:'extend-horizontal-full-window-v3',
    backingSize:{width:1682,height:756,renderScale:0.7}
  }, '2403×1080 非对称安全区必须按完整窗口横向扩图且 Canvas 继续等比缩放');
  assert.deepStrictEqual(viewport.safeInsets, { left:104, right:0, top:0, bottom:0 },
    '安全区只避让关键 UI，不得缩短真实地图');
  const adapterViewport = global.__SMART_EGG_WECHAT_BRIDGE__.getViewport();
  assert.deepStrictEqual(adapterViewport.systemMenuButton, menuButtonRectFixture,
    '微信系统胶囊物理矩形必须进入视口诊断');
  assert.deepStrictEqual(adapterViewport.logicalSystemMenuButton, menuButtonRectFixture,
    '完整窗口一比一显示时，系统胶囊逻辑矩形必须保持一致');
  const menuDiagnosticLayout = gameWindow.__debug.getMenuDiagnosticLayout();
  assert.strictEqual(menuDiagnosticLayout.candidate, 'top-left',
    '首页日志按钮必须优先放在安全区左上角，远离微信右上角胶囊');
  assert.strictEqual(menuDiagnosticLayout.overlap, false,
    '首页日志按钮不得与微信系统胶囊碰撞');
  assert.ok(menuDiagnosticLayout.visualRect.x >= adapterViewport.logicalSafeInsets.left
    && menuDiagnosticLayout.visualRect.x + menuDiagnosticLayout.visualRect.w
      <= adapterViewport.logicalWidth - adapterViewport.logicalSafeInsets.right,
  '首页日志按钮必须完整落在逻辑安全区内');
  callbacks.raf(Date.now());
  const renderedExportRect = gameWindow.__debug.getMenuExportRect();
  assert.deepStrictEqual(
    {x:renderedExportRect.x,y:renderedExportRect.y,w:renderedExportRect.w,h:renderedExportRect.h},
    menuDiagnosticLayout.visualRect,
    '日志按钮绘制矩形与实际触控热区必须完全一致'
  );
  assert.ok(gameWindow._findLogs('menu-diagnostic-layout', 'viewport').some(entry =>
    entry.kv.candidate === 'top-left' && entry.kv.overlap === false
  ), '主运行时必须记录一次可筛选的日志按钮安全布局证据');
  assert.deepStrictEqual(global.__SMART_EGG_WECHAT_BRIDGE__.getDisplayRect(), {
    left:0, top:0, width:2403, height:1080, right:2403, bottom:1080
  }, '2403×1080 完整窗口应被真实地图填满，左侧 104 像素不得成为黑边');
  const level1Viewport = gameWindow.__debug.inspectLevelViewport(global.__SMART_EGG_LEVELS__[0]);
  assert.deepStrictEqual(level1Viewport.after.grounds[0], { left:-241.5, right:2161.5, w:2403, h:440 },
    '单屏完整地面必须向两侧扩展真实碰撞区域');
  assert.deepStrictEqual(level1Viewport.before.spawn, level1Viewport.after.spawn,
    '扩宽地图不得移动或缩放人物出生点');
  assert.deepStrictEqual(level1Viewport.before.doors, level1Viewport.after.doors,
    '扩宽地图不得移动或缩放门');
  assert.strictEqual(level1Viewport.cameraStart, -241.5,
    '宽屏单屏关首帧相机必须直接对齐扩展后的左边缘');
  const cliffViewport = gameWindow.__debug.inspectLevelViewport(global.__SMART_EGG_LEVELS__[3]);
  assert.deepStrictEqual(cliffViewport.after.grounds.map(ground => [ground.left, ground.right]), [
    [-241.5,600], [1080,2161.5]
  ], '断崖只扩外边，内部 600–1080 坑宽必须保持不变');
  const longViewport = gameWindow.__debug.inspectLevelViewport(global.__SMART_EGG_LEVELS__[11]);
  assert.strictEqual(longViewport.bounds.maxX, 5760,
    '三屏关世界宽必须继续按 3×1920 计算，不能变成 3×设备视口');
  assert.strictEqual(longViewport.singleHorizontal, false);
  const idleLegsA = gameWindow.__debug.getFantasyLegPose({ onGround:true, walking:false, walkT:0, vy:0, bob:0 });
  const idleLegsB = gameWindow.__debug.getFantasyLegPose({ onGround:true, walking:false, walkT:2.4, vy:0, bob:0 });
  assert.deepStrictEqual(idleLegsA, idleLegsB, '待机腿姿不能冻结在上一次随机跨步帧');
  const walkBob = -3.2;
  const walkLegs = gameWindow.__debug.getFantasyLegPose({ onGround:true, walking:true, walkT:Math.PI/2, vy:0, bob:walkBob });
  assert.ok(walkLegs.left.foot[1] + walkBob < 84, '行走时前腿应自然抬脚');
  assert.ok(Math.abs(walkLegs.right.foot[1] + walkBob - 84) < 1e-9, '行走支撑脚必须继续贴地');
  const risingLegsA = gameWindow.__debug.getFantasyLegPose({ onGround:false, walking:false, walkT:0, vy:-600, bob:0 });
  const risingLegsB = gameWindow.__debug.getFantasyLegPose({ onGround:false, walking:false, walkT:2.8, vy:-600, bob:0 });
  assert.deepStrictEqual(risingLegsA, risingLegsB, '跳跃腿姿必须由垂直速度决定，不能沿用行走相位');
  const fallingLegs = gameWindow.__debug.getFantasyLegPose({ onGround:false, walking:false, walkT:1.1, vy:900, bob:0 });
  assert.ok(fallingLegs.left.foot[1] > risingLegsA.left.foot[1], '下落阶段双腿应逐渐伸展准备落地');
  const adapterLogControl = gameWindow.__SMART_EGG_ADAPTER_LOG_CONFIG__;
  assert.ok(adapterLogControl && adapterLogControl.getModules().export,
    'wechat adapter logs must expose independent module controls');
  assert.ok(/^se-wx-/.test(adapterLogControl.sessionId),
    'wechat adapter logs must expose a per-run session id');
  assert.strictEqual(adapterLogControl.getModules().input, false,
    'high-frequency adapter input logs must be disabled in production');
  assert.strictEqual(adapterLogControl.getModules().audio, false,
    'verbose adapter audio logs must be disabled in production');
  assert.strictEqual(adapterLogControl.getModules()['audio-core'], true,
    'low-volume audio lifecycle and failure diagnostics must stay enabled in production');
  assert.ok(innerAudioOptionCalls.length > 0,
    'wechat audio policy must be configured before the first sound is requested');
  assert.deepStrictEqual({
    obeyMuteSwitch: innerAudioOptionCalls[0].obeyMuteSwitch,
    mixWithOther: innerAudioOptionCalls[0].mixWithOther,
    speakerOn: innerAudioOptionCalls[0].speakerOn
  }, {
    obeyMuteSwitch: false,
    mixWithOther: true,
    speakerOn: true
  }, 'wechat audio policy must play through the hardware mute switch and the speaker');
  const adapterRuntimeLogs = adapterLogControl.find('runtime', '');
  assert.ok(adapterRuntimeLogs.some(entry => entry.event === 'adapter-session-start')
    && adapterRuntimeLogs.some(entry => entry.event === 'adapter-ready'),
    'adapter runtime module must diagnose the session start and ready path');
  assert.ok(adapterRuntimeLogs.every((entry, index, entries) =>
    entry.sessionId === adapterLogControl.sessionId
    && Number.isInteger(entry.seq)
    && (index === 0 || entry.seq > entries[index - 1].seq)
  ), 'adapter diagnostics must carry one session id and increasing sequence numbers');
  const viewportLogs = adapterLogControl.find('viewport', 'viewport-updated');
  assert.ok(viewportLogs.some(entry => entry.context.logicalWidth === 2403
    && entry.context.logicalHeight === 1080
    && entry.context.sidePad === 241.5
    && entry.context.layoutSource === 'full-window'
    && entry.context.safeInsets.left === 104
    && entry.context.gutters.left === 0
    && entry.context.aspectMode === 'horizontal-map-extension'),
  'viewport module must independently diagnose safe area, logical size and extension strategy');
  assert.deepStrictEqual(adapterLogControl.redact({ nested:{ secret:'hide', cookie:'hide', safe:3 } }),
    { nested:{ secret:'[REDACTED]', cookie:'[REDACTED]', safe:3 } },
    'wechat adapter logs must recursively redact sensitive fields');
  const adapterSensitiveMatrix = adapterLogControl.redact({
    token:'leak-token', access_token:'leak-access', appSecret:'leak-app', apiKey:'leak-api',
    private_key:'leak-private', authorizationHeader:'Basic leak-basic', safe:'visible'
  });
  for (const key of ['token','access_token','appSecret','apiKey','private_key','authorizationHeader']) {
    assert.strictEqual(adapterSensitiveMatrix[key], '[REDACTED]', `adapter sensitive key ${key} must be redacted`);
  }
  assert.strictEqual(adapterSensitiveMatrix.safe, 'visible');
  const adapterSensitiveMessage = adapterLogControl.redact({
    message:'token: leak-colon Cookie: sid=leak-cookie\nAuthorization: Basic leak-basic\n{"access_token":"leak-json"}\n-----BEGIN PRIVATE KEY-----\nleak-pem\n-----END PRIVATE KEY-----'
  }).message;
  for (const secret of ['leak-colon','leak-cookie','leak-basic','leak-json','leak-pem']) {
    assert.ok(!adapterSensitiveMessage.includes(secret), `adapter error string must redact ${secret}`);
  }
  const adapterExportLogsBeforeMute = adapterLogControl.find('export', '').length;
  adapterLogControl.setModule('export', false);
  gameWindow.AndroidLogExporter.exportLog('muted-export-test.json', '{}');
  assert.strictEqual(adapterLogControl.find('export', '').length, adapterExportLogsBeforeMute,
    'muted adapter export module must suppress only export diagnostics');
  assert.strictEqual(adapterLogControl.setModule('export', true).enabled, true,
    'adapter export diagnostics must be independently restorable');
  gameWindow.localStorage.setItem('diagnostic-test', 'ok');
  assert.ok(adapterLogControl.find('storage', 'write-success').some(entry =>
    entry.context.key === 'diagnostic-test' && entry.context.bytes === 2
  ), 'adapter storage module must diagnose non-sensitive mutation metadata');
  gameWindow.localStorage.removeItem('diagnostic-test');
  assert.ok(adapterLogControl.find('storage', 'remove-success').some(entry =>
    entry.context.key === 'diagnostic-test'
  ), 'adapter storage module must diagnose removal without recording values');
  const normalStorageSetter = global.wx.setStorageSync;
  global.wx.setStorageSync = () => { throw new Error('simulated-storage-write-failure'); };
  assert.throws(() => gameWindow.localStorage.setItem('diagnostic-failure', 'value'), /simulated-storage-write-failure/,
    'storage failures must remain visible to the caller');
  assert.ok(adapterLogControl.find('storage', 'write-failed').some(entry =>
    entry.context.key === 'diagnostic-failure' && entry.level === 'error'
  ), 'adapter storage failure must produce an actionable diagnostic');
  global.wx.setStorageSync = normalStorageSetter;
  const adapterAudio = new gameWindow.AudioContext();
  assert.ok(adapterAudio && adapterLogControl.find('audio-core', 'context-created').length > 0,
    'audio-core must diagnose implementation selection without enabling verbose audio logs');
  const audioCountBeforeBgmProbe = innerAudioInstances.length;
  innerAudioCanplayMode = 'manual';
  gameWindow.document.dispatchEvent(new gameWindow.Event('pointerdown'));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.strictEqual(innerAudioInstances.length, audioCountBeforeBgmProbe + 1,
    'first real pointer interaction must create exactly one long-lived BGM InnerAudio instance');
  const bgmAudioInstance = innerAudioInstances[audioCountBeforeBgmProbe];
  assert.strictEqual(bgmAudioInstance.src, 'assets/bgm-wilds-ambient.wav',
    'BGM must use the authored continuous ambient track instead of periodic tone assets');
  assert.strictEqual(bgmAudioInstance.loop, true,
    'continuous ambient BGM must use the native loop flag');
  assert.strictEqual(bgmAudioInstance.autoplay, false,
    'BGM must not rely on device-specific autoplay semantics');
  assert.strictEqual(bgmAudioInstance.operations.includes('play'), true,
    'the first real interaction must call native play directly even while canplay is delayed or missing');
  assert.strictEqual(gameWindow.__SMART_EGG_BGM__.getState().state, 'play-signaled',
    'onPlay must be recorded as a signal until currentTime progression proves playback');
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.strictEqual(gameWindow.__SMART_EGG_BGM__.getState().state, 'playing-verified',
    'the first timeupdate must promote BGM to verified playback');
  assert.strictEqual(gameWindow.__SMART_EGG_BGM__.getState().assetProfile.revision, 'phone-audible-v191',
    'BGM diagnostics must identify the phone-audible asset revision');
  const bgmPlayCountBeforeLateCanplay = bgmAudioInstance.operations.filter(operation => operation === 'play').length;
  bgmAudioInstance.emitCanplay();
  innerAudioCanplayMode = 'sync';
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.strictEqual(bgmAudioInstance.playing, true,
    'the BGM instance must actually enter playback after the first interaction');
  assert.strictEqual(bgmAudioInstance.operations.filter(operation => operation === 'play').length,
    bgmPlayCountBeforeLateCanplay,
    'late canplay after direct playback must not restart or layer the BGM');
  assert.ok(bgmAudioInstance.operations.indexOf('onCanplay') >= 0
    && bgmAudioInstance.operations.indexOf('onCanplay') < bgmAudioInstance.operations.indexOf('src')
    && bgmAudioInstance.operations.indexOf('play') > bgmAudioInstance.operations.indexOf('src'),
  'BGM must register readiness before src and invoke direct play after assigning src');
  const repeatedTouch = { identifier: 91, clientX: 40, clientY: 540 };
  gameWindow.document.dispatchEvent(new gameWindow.Event('pointerdown'));
  callbacks.touchstart({ touches:[repeatedTouch], changedTouches:[repeatedTouch] });
  callbacks.touchend({ touches:[], changedTouches:[repeatedTouch] });
  gameWindow.document.dispatchEvent(new gameWindow.KeyboardEvent('keydown', { code:'KeyQ', key:'q' }));
  gameWindow.document.dispatchEvent(new gameWindow.KeyboardEvent('keyup', { code:'KeyQ', key:'q' }));
  await new Promise(resolve => setTimeout(resolve, 900));
  assert.strictEqual(innerAudioInstances.length, audioCountBeforeBgmProbe + 1,
    'repeated pointer/touch/keydown and three old 380ms periods must not create duplicate BGM or periodic tone instances');
  assert.strictEqual(bgmAudioInstance.operations.filter(operation => operation === 'play').length, 1,
    'duplicate start requests must not restart or layer the already-playing BGM');
  assert.ok(!bgmAudioInstance.operations.includes('stop') && !bgmAudioInstance.operations.includes('destroy'),
    'the single BGM instance must stay alive during normal foreground playback');
  const bgmPlayCountBeforeEndedFallback = bgmAudioInstance.operations.filter(operation => operation === 'play').length;
  bgmAudioInstance.emitEnded();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.strictEqual(bgmAudioInstance.operations.filter(operation => operation === 'play').length,
    bgmPlayCountBeforeEndedFallback + 1,
    'unexpected native ended must explicitly restart the requested loop as a device fallback');
  assert.strictEqual(bgmAudioInstance.playing, true,
    'manual ended fallback must leave the BGM playing');
  assert.strictEqual(gameWindow.__debug.getAudioDiagnostics().bgmEnabled, true,
    'production diagnostics must state that the continuous BGM is enabled');
  const oscillator = adapterAudio.createOscillator();
  const gain = adapterAudio.createGain();
  oscillator.connect(gain);
  oscillator.start(adapterAudio.currentTime);
  oscillator.stop(adapterAudio.currentTime + 0.04);
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.ok(innerAudioInstances.length > 0,
    'fallback WebAudio oscillator must create a WeChat InnerAudio instance');
  const audioInstance = innerAudioInstances[innerAudioInstances.length - 1];
  const onCanplayIndex = audioInstance.operations.indexOf('onCanplay');
  const srcIndex = audioInstance.operations.indexOf('src');
  const playIndex = audioInstance.operations.indexOf('play');
  const stopIndex = audioInstance.operations.indexOf('stop');
  const destroyIndex = audioInstance.operations.indexOf('destroy');
  assert.ok(onCanplayIndex >= 0 && srcIndex >= 0 && onCanplayIndex < srcIndex,
    'InnerAudio onCanplay listener must be registered before src to avoid missing an immediately-ready resource');
  assert.ok(playIndex > srcIndex,
    'an immediately-ready InnerAudio resource must actually play');
  assert.ok(stopIndex > playIndex && destroyIndex > stopIndex,
    'short-lived InnerAudio playback must stop and destroy its native resource');
  assert.strictEqual(audioInstance.obeyMuteSwitch, false,
    'each fallback InnerAudio instance must not re-enable the hardware mute switch');
  const actionOscillator = adapterAudio.createOscillator();
  const actionGain = adapterAudio.createGain();
  actionOscillator.__smartEggSample = 'jump-action';
  actionOscillator.connect(actionGain);
  actionOscillator.start(adapterAudio.currentTime);
  actionOscillator.stop(adapterAudio.currentTime + 0.22);
  await new Promise(resolve => setTimeout(resolve, 360));
  const actionAudioInstance = innerAudioInstances[innerAudioInstances.length - 1];
  assert.strictEqual(actionAudioInstance.src, 'assets/sfx-jump-action.wav',
    'jump oscillator must route only to the dedicated physical-action sample');
  assert.strictEqual(actionAudioInstance.playbackRate, 1,
    'dedicated action sample must keep its authored playback rate');
  const knockOscillator = adapterAudio.createOscillator();
  const knockGain = adapterAudio.createGain();
  innerAudioCanplayMode = 'manual';
  innerAudioAutoplayMode = 'native';
  knockOscillator.__smartEggSample = 'door-knock';
  knockOscillator.connect(knockGain);
  knockOscillator.start(adapterAudio.currentTime);
  knockOscillator.stop(adapterAudio.currentTime + 0.24);
  await new Promise(resolve => setTimeout(resolve, 380));
  const knockAudioInstance = innerAudioInstances[innerAudioInstances.length - 1];
  assert.strictEqual(knockAudioInstance.src, 'assets/sfx-door-knock.wav',
    '第5关敲门必须路由到独立木质敲门采样，不能继续复用合成低频提示音');
  assert.strictEqual(knockAudioInstance.playbackRate, 1,
    '敲门采样必须保持作者设定的自然速度');
  assert.strictEqual(knockAudioInstance.autoplay, true,
    '敲门采样必须通过原生 autoplay/onPlay 主动启动，不能把 canplay 当成唯一门槛');
  assert.ok(knockAudioInstance.operations.includes('play'),
    '即使真机漏发 canplay，敲门采样也必须经 autoplay 实际播放');
  innerAudioCanplayMode = 'sync';
  assert.strictEqual(bgmAudioInstance.playing, true,
    'short jump SFX playback must not pause or replace the long-lived BGM instance');
  assert.ok(!bgmAudioInstance.operations.includes('stop') && !bgmAudioInstance.operations.includes('destroy'),
    'short jump SFX cleanup must never stop or destroy the BGM instance');
  const bgmPlayCountBeforeUnexpectedPause = bgmAudioInstance.operations.filter(operation => operation === 'play').length;
  bgmAudioInstance.emitPause();
  await new Promise(resolve => setTimeout(resolve, 45));
  assert.strictEqual(bgmAudioInstance.playing, true,
    'an unexpected native pause caused by device audio policy must immediately resume the same BGM instance');
  assert.strictEqual(bgmAudioInstance.operations.filter(operation => operation === 'play').length,
    bgmPlayCountBeforeUnexpectedPause + 1,
    'unexpected native pause recovery must issue exactly one same-instance replay');
  assert.strictEqual(gameWindow.__SMART_EGG_BGM__.getState().unexpectedPauseCount, 1,
    'BGM diagnostics must count unexpected native pauses independently');
  assert.ok(adapterLogControl.find('audio-core', 'bgm-unexpected-pause-recovery').some(entry =>
    entry.level === 'warn'
    && entry.context.likelyCause === 'native-audio-mutual-exclusion-or-device-policy'
  ), 'exportable audio-core logs must explain native-policy pause recovery');
  const audioCountBeforeLifecycle = innerAudioInstances.length;
  const bgmPlayCountBeforeResume = bgmAudioInstance.operations.filter(operation => operation === 'play').length;
  callbacks.hide();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.strictEqual(bgmAudioInstance.playing, false,
    'app hide must pause the continuous BGM');
  assert.ok(bgmAudioInstance.operations.includes('pause')
    && !bgmAudioInstance.operations.includes('destroy'),
  'app hide must preserve the same BGM instance for a later resume');
  callbacks.show();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.strictEqual(innerAudioInstances.length, audioCountBeforeLifecycle,
    'app show must resume the existing BGM instance instead of creating a replacement');
  assert.strictEqual(innerAudioInstances[audioCountBeforeBgmProbe], bgmAudioInstance,
    'BGM object identity must survive an app hide/show cycle');
  assert.strictEqual(bgmAudioInstance.operations.filter(operation => operation === 'play').length,
    bgmPlayCountBeforeResume + 1,
    'app show must issue exactly one resume play on the preserved BGM instance');
  assert.strictEqual(bgmAudioInstance.playing, true,
    'the preserved BGM instance must be playing after app show');
  callbacks.audioInterruptionBegin();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.strictEqual(bgmAudioInstance.playing, false,
    'system audio interruption must pause the existing BGM instance');
  callbacks.audioInterruptionEnd();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.strictEqual(bgmAudioInstance.playing, true,
    'system audio interruption end must resume the existing BGM instance');
  gameWindow.__debug.setState('paused');
  callbacks.raf(Date.now());
  await new Promise(resolve => setTimeout(resolve, 10));
  const bgmPlayCountWhilePaused = bgmAudioInstance.operations.filter(operation => operation === 'play').length;
  callbacks.hide();
  callbacks.show();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.strictEqual(bgmAudioInstance.playing, false,
    'app show must not restart BGM while the in-game pause menu remains open');
  assert.strictEqual(bgmAudioInstance.operations.filter(operation => operation === 'play').length, bgmPlayCountWhilePaused,
    'paused game plus hide/show must not issue a hidden duplicate resume');
  gameWindow.__debug.setState('playing');
  callbacks.raf(Date.now() + 16);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.strictEqual(bgmAudioInstance.playing, true,
    'leaving the in-game pause state must resume the preserved BGM instance');
  gameWindow.__debug.setState('menu');
  callbacks.raf(Date.now() + 32);
  const staleCanplay = bgmAudioInstance.snapshotCanplayHandler();
  const staleError = bgmAudioInstance.snapshotErrorHandler();
  assert.ok(staleCanplay && staleError,
    'BGM mock must capture old native callbacks for stale-event isolation testing');
  gameWindow.__SMART_EGG_BGM__.destroy('stale-callback-regression');
  innerAudioAutoplayMode = 'ignored';
  gameWindow.document.dispatchEvent(new gameWindow.Event('pointerdown'));
  await new Promise(resolve => setTimeout(resolve, 40));
  innerAudioAutoplayMode = 'native';
  const rebuiltBgmAudioInstance = innerAudioInstances[innerAudioInstances.length - 1];
  assert.notStrictEqual(rebuiltBgmAudioInstance, bgmAudioInstance,
    'destroy followed by a new interaction must rebuild one fresh BGM instance');
  assert.strictEqual(rebuiltBgmAudioInstance.playing, true,
    'rebuilt BGM instance must play before stale callbacks are injected');
  staleCanplay();
  staleError({ errMsg:'late-error-from-released-instance' });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.strictEqual(rebuiltBgmAudioInstance.playing, true,
    'queued canplay/error from a released instance must not stop or mutate the rebuilt BGM');
  assert.ok(['play-signaled','playing-verified'].includes(gameWindow.__SMART_EGG_BGM__.getState().state),
    'controller state must remain actively playing after stale native callbacks from an old instance');
  assert.ok(!rebuiltBgmAudioInstance.operations.includes('destroy'),
    'stale old-instance error must never destroy the current BGM instance');
  gameWindow.__SMART_EGG_BGM__.destroy('progress-stall-regression');
  innerAudioProgressMode = 'stalled';
  gameWindow.document.dispatchEvent(new gameWindow.Event('pointerdown'));
  await new Promise(resolve => setTimeout(resolve, 2250));
  const stalledBgmState = gameWindow.__SMART_EGG_BGM__.getState();
  assert.strictEqual(stalledBgmState.state, 'progress-stalled',
    'onPlay without currentTime progress must be diagnosed as stalled instead of falsely reported as playing');
  assert.strictEqual(stalledBgmState.lastError, 'playback-progress-stalled');
  assert.ok(adapterLogControl.find('audio-core', 'bgm-progress-stalled').some(entry =>
    entry.level === 'error' && entry.context.delta === 0
  ), 'progress-stalled failure must remain filterable in exported audio-core diagnostics');
  innerAudioProgressMode = 'advancing';
  gameWindow.document.dispatchEvent(new gameWindow.Event('pointerdown'));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.strictEqual(gameWindow.__SMART_EGG_BGM__.getState().state, 'playing-verified',
    'a later real interaction must rebuild and verify BGM after a progress stall');
  const clipboardWritesBeforeMenuExport = clipboardWrites;
  const safeExportRect = gameWindow.__debug.getMenuExportRect();
  const safeExportTouch = {
    identifier:191,
    clientX:safeExportRect.x + safeExportRect.w / 2,
    clientY:safeExportRect.y + safeExportRect.h / 2
  };
  callbacks.touchstart({ touches:[safeExportTouch], changedTouches:[safeExportTouch] });
  callbacks.touchend({ touches:[], changedTouches:[safeExportTouch] });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.strictEqual(clipboardWrites, clipboardWritesBeforeMenuExport + 1,
    '安全区内的日志按钮中心必须能实际触发一次微信日志导出');
  assert.ok(gameWindow._findLogs('menu-export-log-click', 'input').some(entry =>
    entry.kv.candidate === 'top-left' && entry.kv.overlap === false
  ), '日志导出点击记录必须包含安全布局与胶囊避让证据');
  const networkLogsBeforeMute = adapterLogControl.find('network', 'status-change').length;
  adapterLogControl.setModule('network', false);
  callbacks.network({ isConnected:false, networkType:'none' });
  assert.strictEqual(adapterLogControl.find('network', 'status-change').length, networkLogsBeforeMute,
    'disabled adapter network module must suppress only network diagnostics');
  adapterLogControl.setModule('network', true);
  callbacks.network({ isConnected:true, networkType:'wifi' });
  assert.ok(adapterLogControl.find('runtime', 'app-hide').length > 0
    && adapterLogControl.find('runtime', 'app-show').length > 0
    && adapterLogControl.find('network', 'status-change').length === networkLogsBeforeMute + 1,
    'adapter runtime and network modules must independently diagnose lifecycle and connectivity');
  const paging = gameWindow.__debug.getLevelSelectPaging();
  assert.strictEqual(paging.pageSize, 8);
  assert.strictEqual(paging.pageCount, 3);
  const logModules = gameWindow.__debug.getLogModules();
  assert.strictEqual(logModules.feature, true);
  assert.strictEqual(logModules['level-load'], true);
  assert.strictEqual(logModules.physics, false, 'verbose physics logs must stay disabled in production');
  const blockedFeatureLogs = () => gameWindow._findLogs('creator-mode-route-blocked', 'feature').length;
  const featureBeforeDisabledProbe = blockedFeatureLogs();
  gameWindow.__debug.setLogModule('feature', false);
  gameWindow.__debug.setState('creatorList');
  assert.strictEqual(blockedFeatureLogs(), featureBeforeDisabledProbe,
    'disabled feature module must suppress only feature diagnostics');
  gameWindow.__debug.setLogModule('feature', true);
  gameWindow.__debug.setState('creatorList');
  assert.strictEqual(blockedFeatureLogs(), featureBeforeDisabledProbe + 1,
    're-enabled feature module must resume feature diagnostics');
  const redacted = gameWindow.__debug.redactLogContext({
    safe:'visible', nested:{
      password:'do-not-log', accessToken:'do-not-log', token:'do-not-log', access_token:'do-not-log',
      appSecret:'do-not-log', apiKey:'do-not-log', private_key:'do-not-log', authorizationHeader:'do-not-log', count:2
    }
  });
  assert.deepStrictEqual(redacted, {
    safe:'visible', nested:{
      password:'[REDACTED]', accessToken:'[REDACTED]', token:'[REDACTED]', access_token:'[REDACTED]',
      appSecret:'[REDACTED]', apiKey:'[REDACTED]', private_key:'[REDACTED]', authorizationHeader:'[REDACTED]', count:2
    }
  }, 'nested sensitive fields must be redacted without hiding safe context');
  const runtimeSensitiveMessage = gameWindow.__debug.redactLogContext({
    message:'token: leak-runtime Cookie: sid=leak-cookie\nAuthorization: Basic leak-basic\n{"apiKey":"leak-json"}'
  }).message;
  for (const secret of ['leak-runtime','leak-cookie','leak-basic','leak-json']) {
    assert.ok(!runtimeSensitiveMessage.includes(secret), `runtime error string must redact ${secret}`);
  }
  assert.strictEqual(gameWindow._findLogs('', 'fatal').length, 0, 'normal cold start must not emit fatal logs');
  const probeLog = gameWindow._findLogs('probe-available-levels', 'level-load').at(-1);
  assert.ok(probeLog && probeLog.kv.available_count === 20 && probeLog.kv.missing_count === 0,
    'cold start must discover all 20 inline levels');
  assert.ok(callbacks.touchstart && callbacks.touchend && callbacks.touchcancel);
  assert.ok(callbacks.raf, 'game should schedule its first frame');
  callbacks.raf(Date.now());
  adapterLogControl.setModule('input', true);
  callbacks.touchstart({
    touches: [{ identifier: 1, clientX: 1200, clientY: 694 }],
    changedTouches: [{ identifier: 1, clientX: 1200, clientY: 694 }]
  });
  callbacks.touchend({ touches: [], changedTouches: [{ identifier: 1, clientX: 1200, clientY: 694 }] });
  assert.strictEqual(gameWindow.__debug.getState(), 'levelSelect', 'screen touch should map to the start button');
  assert.ok(adapterLogControl.find('input', 'touchstart').length > 0
    && adapterLogControl.find('input', 'touchend').length > 0,
    'adapter input module must diagnose touch actions when explicitly enabled');
  gameWindow.__debug.setState('playing');
  const hostKey = (type, init) => {
    const event = Object.assign({ type, preventDefault: () => {} }, init);
    for (const listener of (hostDocumentListeners[type] || []).slice()) listener(event);
  };
  hostKey('keydown', { code: 'KeyD', key: 'd' });
  hostKey('keydown', { key: ' ', keyCode: 32 });
  let desktopInput = gameWindow.__debug.getInputSnapshot();
  assert.ok(desktopInput.input.right, 'host KeyD should move right in DevTools');
  assert.ok(desktopInput.input.jumpHeld && desktopInput.input.jumpPressed, 'host Space should jump while KeyD remains held');
  hostKey('keyup', { key: ' ', keyCode: 32 });
  desktopInput = gameWindow.__debug.getInputSnapshot();
  assert.ok(desktopInput.input.right && !desktopInput.input.jumpHeld, 'releasing Space must not stop held KeyD movement');
  hostKey('keyup', { code: 'KeyD', key: 'd' });
  desktopInput = gameWindow.__debug.getInputSnapshot();
  assert.ok(!desktopInput.input.right, 'releasing host KeyD should stop right movement');
  hostKey('keydown', { key: 'Shift', keyCode: 16 });
  assert.strictEqual(gameWindow.__debug.getMechanicState().acceptedReview.frozen, true,
    'host Shift must support desktop testing of the freeze mechanic');
  hostKey('keyup', { key: 'Shift', keyCode: 16 });
  assert.strictEqual(gameWindow.__debug.getMechanicState().acceptedReview.frozen, false);
  assert.ok(adapterLogControl.find('input', 'keyboard-keydown').some(entry => entry.context.code === 'KeyD')
    && adapterLogControl.find('input', 'keyboard-keyup').some(entry => entry.context.code === 'KeyD'),
    'adapter input module must diagnose desktop key transitions when explicitly enabled');
  adapterLogControl.setModule('input', false);
  gameWindow.__debug.setState('menu');
  const inputResults = await gameWindow.__debug.runInputRegressionTests();
  assert.strictEqual(inputResults.filter(result => result.status !== 'PASS').length, 0);
  const normalFileSystemManager = global.wx.getFileSystemManager;
  global.wx.getFileSystemManager = () => ({
    writeFile: options => options.fail({ errMsg:'simulated-write-failure' })
  });
  gameWindow.AndroidLogExporter.exportLog('diagnostic-failure-test.json', '{}');
  assert.ok(modalShows > 0, 'native export failure must be visible to the tester');
  const adapterFailure = gameWindow.__SMART_EGG_ADAPTER_DIAGNOSTICS__.find(entry =>
    entry.module === 'wechat-adapter:export' && entry.event === 'write-failed'
  );
  assert.ok(adapterFailure && adapterFailure.level === 'error',
    'native export failure must produce an actionable adapter diagnostic');
  global.wx.getFileSystemManager = normalFileSystemManager;

  global.wx.shareFileMessage = options => options.fail({ errMsg:'simulated-share-failure' });
  gameWindow.AndroidLogExporter.exportLog('diagnostic-share-failure-test.json', '{}');
  assert.ok(adapterLogControl.find('export', 'share-failed').length > 0,
    'share failure must be diagnosed');
  assert.ok(adapterLogControl.find('export', 'clipboard-fallback-success').some(entry =>
    entry.context.reason === 'share-failed'
  ), 'share failure must fall back to clipboard with a reason');
  delete global.wx.shareFileMessage;

  clipboardWriteFails = true;
  gameWindow.AndroidLogExporter.exportLog('diagnostic-clipboard-failure-test.json', '{}');
  assert.ok(adapterLogControl.find('export', 'clipboard-fallback-failed').length > 0,
    'clipboard write failure must be diagnosed');
  clipboardWriteFails = false;

  const normalClipboardWriter = global.wx.setClipboardData;
  delete global.wx.setClipboardData;
  gameWindow.AndroidLogExporter.exportLog('diagnostic-no-clipboard-api-test.json', '{}');
  assert.ok(adapterLogControl.find('export', 'clipboard-fallback-unavailable').length > 0,
    'missing clipboard API must be diagnosed');
  global.wx.setClipboardData = normalClipboardWriter;

  const clipboardWritesBeforeFinalExport = clipboardWrites;
  gameWindow.__debug.exportLog();
  assert.strictEqual(clipboardWrites, clipboardWritesBeforeFinalExport + 1,
    '当前这次日志导出必须完成微信剪贴板后备');
  assert.ok(lastFileWrite && lastFileWrite.encoding === 'utf8'
    && /smart-egg-log-v192-/.test(lastFileWrite.filePath),
  '当前这次日志必须写入微信用户目录');
  const exportedReport = JSON.parse(lastFileWrite.data);
  assert.deepStrictEqual(exportedReport.previousFault, previousFaultFixture,
    '最终诊断包必须携带上次会话恢复出的 previousFault');
  assert.deepStrictEqual(exportedReport.lastFault, lastFaultFixture,
    '最终诊断包必须携带当前可用的 lastFault');
  assert.ok(Array.isArray(exportedReport.adapterLogs) && exportedReport.adapterLogs.length > 0,
    '导出的诊断包必须包含微信适配层日志');
  assert.strictEqual(exportedReport.runtime.audio.backgroundMusic.assetProfile.revision,
    'phone-audible-v191', '导出日志必须能识别当前手机可听 BGM 资源版本');
  assert.strictEqual(typeof exportedReport.runtime.audio.backgroundMusic.progressVerified, 'boolean',
    '导出日志必须明确报告原生播放进度是否得到验证');
  assert.ok(Object.prototype.hasOwnProperty.call(exportedReport.runtime.audio.backgroundMusic, 'lastProgressDelta')
    && Object.prototype.hasOwnProperty.call(exportedReport.runtime.audio.backgroundMusic, 'lifecyclePaused')
    && Object.prototype.hasOwnProperty.call(exportedReport.runtime.audio.backgroundMusic, 'audioPolicy'),
  '导出日志必须包含播放进度、生命周期和全局音频策略以定位无声原因');
  assert.ok(exportedReport.adapterLogs.some(entry => entry.event === 'bgm-diagnostic-captured'),
    '点击导出时必须先抓取一次 BGM 原生状态快照');
  assert.ok(exportedReport.adapterLogs.some(entry => entry.event === 'write-request')
    && exportedReport.adapterLogs.some(entry => entry.event === 'write-success'),
    '最终写入的诊断包必须包含本次导出的请求和文件写入成功事件');
  const exportLog = gameWindow._findLogs('native-export-dispatched', 'export').at(-1);
  assert.ok(exportLog && exportLog.kv.platform === 'wechat-minigame');

  // 真机首跳故障注入：音频节点任一步抛错都只能让音频静默降级，不能再把
  // physicsStep 切到 fatal 或打断后续 RAF。
  gameWindow.__debug.loadLevelAndStart();
  callbacks.raf(Date.now() + 8);
  const controlRects = gameWindow.__debug.getControlRects();
  for (const [name, rect] of Object.entries(controlRects)) {
    assert.ok(rect, `${name} 控制按钮必须完成布局`);
    assert.strictEqual(gameWindow.__debug.isSceneGestureBlockedByUI({
      x:rect.x + rect.w / 2,
      y:rect.y + rect.h / 2
    }), true, `场景拖拽不能抢走 ${name} 控制按钮`);
  }
  const jumpPlayer = gameWindow.__debug.getPlayer();
  jumpPlayer.onGround = true;
  gameWindow.__debug.__setAudioContextForTest({
    state: 'running',
    currentTime: 0,
    destination: {},
    createOscillator() { throw new Error('simulated-partial-webaudio-node-failure'); },
    createGain() { throw new Error('gain-should-not-be-reached'); }
  });
  const frameBeforeAudioFault = gameWindow.__debug.getFrame();
  hostKey('keydown', { key:' ', keyCode:32 });
  callbacks.raf(Date.now() + 16);
  hostKey('keyup', { key:' ', keyCode:32 });
  assert.ok(gameWindow.__debug.getFrame() > frameBeforeAudioFault,
    'audio failure during the first jump must not stop the RAF chain');
  assert.strictEqual(gameWindow.__debug.getState(), 'playing',
    'audio failure during jump must never turn the game into a fatal/frozen state');
  assert.ok(gameWindow.__debug.getPlayer().vy < 0,
    'jump physics must still fire when its sound effect fails');
  const injectedAudioFailure = gameWindow._findLogs('audio-failure', 'audio').at(-1);
  assert.ok(injectedAudioFailure
    && injectedAudioFailure.kv.message.includes('simulated-partial-webaudio-node-failure'),
    'audio failure must remain actionable in the diagnostic log');
  assert.ok(gameWindow.__debug.getFaultJournal().lastFault
    && gameWindow.__debug.getFaultJournal().lastFault.reason === 'audio-failure',
    'audio failure must persist so it can be exported after a restart');
  gameWindow.__debug.__setAudioContextForTest(null);

  const sequenceBeforeRetentionProbe = gameWindow.__SMART_EGG_ADAPTER_DIAGNOSTICS__.at(-1).seq;
  for (let index = 0; index < 220; index++) gameWindow.localStorage.getItem('ring-retention-probe');
  assert.strictEqual(gameWindow.__SMART_EGG_ADAPTER_DIAGNOSTICS__.length, 200,
    'adapter diagnostics must retain only the newest 200 entries');
  assert.ok(gameWindow.__SMART_EGG_ADAPTER_DIAGNOSTICS__[0].seq > sequenceBeforeRetentionProbe,
    'adapter diagnostics ring must evict old entries rather than growing without bound');
  Object.fromEntries = nativeObjectFromEntries;
  console.log('微信小游戏冒烟测试通过：v192手机可听背景音乐、播放进度诊断、系统胶囊安全区与20关主线均正常。');
  process.exit(0);
}, 80);
