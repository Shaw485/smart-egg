'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
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
  getWindowInfo: () => ({ windowWidth: 1280, windowHeight: 720, pixelRatio: 1 }),
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
    let errorHandler = null;
    let source = '';
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
      onError(handler) {
        operations.push('onError');
        errorHandler = handler;
      },
      play() { operations.push('play'); },
      stop() { operations.push('stop'); },
      destroy() { operations.push('destroy'); },
      emitError(error) { if (errorHandler) errorHandler(error); }
    };
    Object.defineProperty(instance, 'src', {
      enumerable: true,
      configurable: true,
      get: () => source,
      set: value => {
        source = String(value);
        operations.push('src');
        // 模拟资源已经就绪：若监听器在 src 之前注册，会立即收到 canplay；
        // 若顺序反了则故意不补发，用来锁定真机“偶发无声”的竞态。
        if (canplayHandler) canplayHandler();
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
  assert.strictEqual(global.__SMART_EGG_WECHAT_BRIDGE__.version, 184);
  assert.strictEqual(Object.keys(global.__SMART_EGG_LEVELS__).length, 20);
  assert.deepStrictEqual(Object.keys(global.__SMART_EGG_LEVELS__).map(Number), Array.from({ length:20 }, (_, index) => index));
  assert.ok(gameWindow.__debug, 'game debug API should be installed');
  assert.strictEqual(gameWindow.__debug.VERSION, 184);
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
    mixWithOther: innerAudioOptionCalls[0].mixWithOther
  }, {
    obeyMuteSwitch: false,
    mixWithOther: true
  }, 'wechat audio policy must play through the hardware mute switch and coexist with other audio');
  const adapterRuntimeLogs = adapterLogControl.find('runtime', '');
  assert.ok(adapterRuntimeLogs.some(entry => entry.event === 'adapter-session-start')
    && adapterRuntimeLogs.some(entry => entry.event === 'adapter-ready'),
    'adapter runtime module must diagnose the session start and ready path');
  assert.ok(adapterRuntimeLogs.every((entry, index, entries) =>
    entry.sessionId === adapterLogControl.sessionId
    && Number.isInteger(entry.seq)
    && (index === 0 || entry.seq > entries[index - 1].seq)
  ), 'adapter diagnostics must carry one session id and increasing sequence numbers');
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
  callbacks.hide();
  callbacks.show();
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
    touches: [{ identifier: 1, clientX: 640, clientY: 463 }],
    changedTouches: [{ identifier: 1, clientX: 640, clientY: 463 }]
  });
  callbacks.touchend({ touches: [], changedTouches: [{ identifier: 1, clientX: 640, clientY: 463 }] });
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
    && /smart-egg-log-v184-/.test(lastFileWrite.filePath),
  '当前这次日志必须写入微信用户目录');
  const exportedReport = JSON.parse(lastFileWrite.data);
  assert.deepStrictEqual(exportedReport.previousFault, previousFaultFixture,
    '最终诊断包必须携带上次会话恢复出的 previousFault');
  assert.deepStrictEqual(exportedReport.lastFault, lastFaultFixture,
    '最终诊断包必须携带当前可用的 lastFault');
  assert.ok(Array.isArray(exportedReport.adapterLogs) && exportedReport.adapterLogs.length > 0,
    '导出的诊断包必须包含微信适配层日志');
  assert.ok(exportedReport.adapterLogs.some(entry => entry.event === 'write-request')
    && exportedReport.adapterLogs.some(entry => entry.event === 'write-success'),
    '最终写入的诊断包必须包含本次导出的请求和文件写入成功事件');
  const exportLog = gameWindow._findLogs('native-export-dispatched', 'export').at(-1);
  assert.ok(exportLog && exportLog.kv.platform === 'wechat-minigame');

  // 真机首跳故障注入：音频节点任一步抛错都只能让音频静默降级，不能再把
  // physicsStep 切到 fatal 或打断后续 RAF。
  gameWindow.__debug.loadLevelAndStart();
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
  console.log('微信小游戏冒烟测试通过：v184适配层、20关、创造秘境下线、A/D/空格/Shift、音频核心诊断、故障恢复日志与输入回归均正常。');
  process.exit(0);
}, 80);
