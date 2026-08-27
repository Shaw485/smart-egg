'use strict';

const assert = require('assert');

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
  getStorageSync: () => '',
  setStorageSync: () => {},
  removeStorageSync: () => {},
  clearStorageSync: () => {},
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
  showKeyboard: () => {},
  hideKeyboard: () => {},
  getClipboardData: options => options.fail(),
  setClipboardData: options => options.success && options.success(),
  showToast: () => {},
  showModal: () => {},
  getFileSystemManager: () => ({ writeFile: options => options.success() }),
  env: { USER_DATA_PATH: '/tmp' }
};

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
  assert.strictEqual(global.__SMART_EGG_WECHAT_BRIDGE__.version, 163);
  assert.strictEqual(Object.keys(global.__SMART_EGG_LEVELS__).length, 7);
  assert.ok(gameWindow.__debug, 'game debug API should be installed');
  assert.strictEqual(gameWindow.__debug.getState(), 'menu');
  assert.ok(callbacks.touchstart && callbacks.touchend && callbacks.touchcancel);
  assert.ok(callbacks.raf, 'game should schedule its first frame');
  callbacks.raf(Date.now());
  callbacks.touchstart({
    touches: [{ identifier: 1, clientX: 437, clientY: 463 }],
    changedTouches: [{ identifier: 1, clientX: 437, clientY: 463 }]
  });
  callbacks.touchend({ touches: [], changedTouches: [{ identifier: 1, clientX: 437, clientY: 463 }] });
  assert.strictEqual(gameWindow.__debug.getState(), 'levelSelect', 'screen touch should map to the start button');
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
  gameWindow.__debug.setState('menu');
  const inputResults = await gameWindow.__debug.runInputRegressionTests();
  assert.strictEqual(inputResults.filter(result => result.status !== 'PASS').length, 0);
  console.log('微信小游戏冒烟测试通过：适配层、7关数据、A/D/空格实体键盘与 10 项输入回归均正常。');
  process.exit(0);
}, 80);
