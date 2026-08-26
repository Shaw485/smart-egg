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
global.GameGlobal = global;
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
  assert.strictEqual(global.__SMART_EGG_WECHAT_BRIDGE__.version, 160);
  assert.strictEqual(Object.keys(global.__SMART_EGG_LEVELS__).length, 7);
  assert.ok(global.__debug, 'game debug API should be installed');
  assert.strictEqual(global.__debug.getState(), 'menu');
  assert.ok(callbacks.touchstart && callbacks.touchend && callbacks.touchcancel);
  assert.ok(callbacks.raf, 'game should schedule its first frame');
  callbacks.raf(Date.now());
  callbacks.touchstart({
    touches: [{ identifier: 1, clientX: 437, clientY: 463 }],
    changedTouches: [{ identifier: 1, clientX: 437, clientY: 463 }]
  });
  callbacks.touchend({ touches: [], changedTouches: [{ identifier: 1, clientX: 437, clientY: 463 }] });
  assert.strictEqual(global.__debug.getState(), 'levelSelect', 'screen touch should map to the start button');
  global.__debug.setState('menu');
  const inputResults = await global.__debug.runInputRegressionTests();
  assert.strictEqual(inputResults.filter(result => result.status !== 'PASS').length, 0);
  console.log('微信小游戏冒烟测试通过：适配层、7关数据、游戏本体与 10 项输入回归均正常。');
  process.exit(0);
}, 80);
