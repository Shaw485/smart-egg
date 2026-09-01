'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const adapterSource = fs.readFileSync(path.resolve(__dirname, '../js/wechat-adapter.js'), 'utf8');

function bootAdapter(windowInfo) {
  const canvases = [];
  const callbacks = {};

  function createContext() {
    const operations = [];
    const context = {
      operations,
      fillStyle: '',
      setTransform() {},
      fillRect(...args) { operations.push({ type:'fillRect', args, fillStyle:this.fillStyle }); },
      drawImage(...args) { operations.push({ type:'drawImage', args }); },
      createLinearGradient(...args) {
        const stops = [];
        return { args, stops, addColorStop(offset, color) { stops.push({ offset, color }); } };
      },
      createRadialGradient() { return { addColorStop() {} }; },
      measureText(text) { return { width:String(text).length * 20 }; }
    };
    return new Proxy(context, {
      get(target, key) {
        if (!(key in target)) target[key] = function () {};
        return target[key];
      }
    });
  }

  function createCanvas() {
    const context = createContext();
    const canvas = {
      width:1280,
      height:720,
      context,
      getContext:() => context,
      requestAnimationFrame:() => 1,
      cancelAnimationFrame() {}
    };
    canvases.push(canvas);
    return canvas;
  }

  const wx = {
    createCanvas,
    getWindowInfo:() => JSON.parse(JSON.stringify(windowInfo)),
    getAppBaseInfo:() => ({ SDKVersion:'test', language:'zh_CN' }),
    getDeviceInfo:() => ({ platform:'devtools' }),
    getStorageSync:() => '',
    setStorageSync() {},
    removeStorageSync() {},
    clearStorageSync() {},
    onTouchStart:fn => { callbacks.touchstart=fn; },
    onTouchMove:fn => { callbacks.touchmove=fn; },
    onTouchEnd:fn => { callbacks.touchend=fn; },
    onTouchCancel:fn => { callbacks.touchcancel=fn; },
    onHide:fn => { callbacks.hide=fn; },
    onShow:fn => { callbacks.show=fn; },
    onWindowResize:fn => { callbacks.resize=fn; },
    showModal() {},
    setClipboardData() {},
    getFileSystemManager:() => ({ writeFile() {} }),
    env:{ USER_DATA_PATH:'/tmp' }
  };
  const sandbox = {
    wx,
    console:{ log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    Map,
    Set,
    WeakSet,
    Promise,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    TypeError,
    Uint8Array,
    TextEncoder,
    TextDecoder
  };
  sandbox.GameGlobal = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(adapterSource, sandbox, { filename:'wechat-adapter.js' });
  return {
    bridge:sandbox.__SMART_EGG_WECHAT_BRIDGE__,
    gameWindow:sandbox.__SMART_EGG_WECHAT_ENV__.window,
    screenCanvas:canvases[0],
    gameCanvas:canvases[1],
    callbacks
  };
}

function roundedRect(rect) {
  return Object.fromEntries(['left','top','width','height','right','bottom'].map(key => [key, Math.round(rect[key] * 1000) / 1000]));
}

const matrix = [
  {
    name:'16:9',
    info:{ windowWidth:1280, windowHeight:720, pixelRatio:1 },
    logicalWidth:1920,
    rect:{ left:0, top:0, width:1280, height:720, right:1280, bottom:720 },
    mode:'horizontal-map-extension'
  },
  {
    name:'19.5:9',
    info:{ windowWidth:2340, windowHeight:1080, pixelRatio:1 },
    logicalWidth:2340,
    rect:{ left:0, top:0, width:2340, height:1080, right:2340, bottom:1080 },
    mode:'horizontal-map-extension'
  },
  {
    name:'20:9',
    info:{ windowWidth:2400, windowHeight:1080, pixelRatio:1 },
    logicalWidth:2400,
    rect:{ left:0, top:0, width:2400, height:1080, right:2400, bottom:1080 },
    mode:'horizontal-map-extension'
  },
  {
    name:'safe-area-offset-dpr3',
    info:{
      windowWidth:2400, windowHeight:1120, pixelRatio:3,
      safeArea:{ left:30, top:20, right:2370, bottom:1100, width:2340, height:1080 }
    },
    logicalWidth:2340,
    rect:{ left:30, top:20, width:2340, height:1080, right:2370, bottom:1100 },
    mode:'horizontal-map-extension'
  },
  {
    name:'narrow-contain',
    info:{ windowWidth:1920, windowHeight:1200, pixelRatio:1 },
    logicalWidth:1920,
    rect:{ left:0, top:60, width:1920, height:1080, right:1920, bottom:1140 },
    mode:'narrow-contain'
  },
  {
    name:'ultrawide-exact-map',
    info:{ windowWidth:3840, windowHeight:1080, pixelRatio:1 },
    logicalWidth:3840,
    rect:{ left:0, top:0, width:3840, height:1080, right:3840, bottom:1080 },
    mode:'horizontal-map-extension'
  }
];

for (const entry of matrix) {
  const runtime = bootAdapter(entry.info);
  const viewport = runtime.bridge.getViewport();
  assert.strictEqual(runtime.bridge.version, 187, `${entry.name}: bridge version`);
  assert.strictEqual(viewport.logicalWidth, entry.logicalWidth, `${entry.name}: logical width`);
  assert.strictEqual(viewport.logicalHeight, 1080, `${entry.name}: logical height`);
  assert.strictEqual(viewport.aspectMode, entry.mode, `${entry.name}: aspect mode`);
  assert.deepStrictEqual(roundedRect(runtime.bridge.getDisplayRect()), entry.rect, `${entry.name}: display rect`);
  assert.strictEqual(runtime.screenCanvas.width, entry.info.windowWidth * entry.info.pixelRatio, `${entry.name}: screen backing width`);
  assert.strictEqual(runtime.screenCanvas.height, entry.info.windowHeight * entry.info.pixelRatio, `${entry.name}: screen backing height`);

  const rect = runtime.bridge.getDisplayRect();
  const topLeft = runtime.bridge.clientToLogical(rect.left, rect.top);
  const bottomRight = runtime.bridge.clientToLogical(rect.right, rect.bottom);
  assert.ok(topLeft && Math.abs(topLeft.x) < 1e-9 && Math.abs(topLeft.y) < 1e-9,
    `${entry.name}: client top-left must map to logical origin`);
  assert.ok(bottomRight && Math.abs(bottomRight.x-entry.logicalWidth) < 1e-9 && Math.abs(bottomRight.y-1080) < 1e-9,
    `${entry.name}: client bottom-right must map to logical edge`);

  runtime.gameCanvas.width = entry.logicalWidth;
  runtime.gameCanvas.height = 1080;
  runtime.bridge.presentFrame();
  const drawOperations = runtime.screenCanvas.context.operations.filter(operation => operation.type === 'drawImage');
  assert.strictEqual(drawOperations.length, 1,
    `${entry.name}: game frame must be drawn exactly once without copied or blurred edge strips`);
  const mainDraw = drawOperations.at(-1);
  assert.ok(mainDraw, `${entry.name}: main frame must be presented`);
  const [, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight] = mainDraw.args;
  assert.deepStrictEqual([sourceX,sourceY,sourceWidth,sourceHeight], [0,0,entry.logicalWidth,1080],
    `${entry.name}: full logical canvas must be used`);
  assert.ok(Math.abs(destWidth/sourceWidth-destHeight/sourceHeight) < 1e-9,
    `${entry.name}: presentation must remain uniform without horizontal stretching`);
  assert.deepStrictEqual([destX,destY,destWidth,destHeight], [
    Math.round(entry.rect.left*entry.info.pixelRatio),
    Math.round(entry.rect.top*entry.info.pixelRatio),
    Math.round(entry.rect.width*entry.info.pixelRatio),
    Math.round(entry.rect.height*entry.info.pixelRatio)
  ], `${entry.name}: physical destination rect`);
  assert.ok(runtime.screenCanvas.context.operations.some(operation =>
    operation.type === 'fillRect' && operation.fillStyle === '#2b3d42'
  ), `${entry.name}: outside-safe-area matte must be natural blue-grey, never pure black`);

  if (entry.name === 'safe-area-offset-dpr3') {
    assert.strictEqual(runtime.bridge.clientToLogical(10, 540), null,
      'unsafe-area matte must not become an interactive region');
    const forwarded = { touchstart:[], touchmove:[], touchend:[], touchcancel:[] };
    for (const type of Object.keys(forwarded)) {
      runtime.gameCanvas.addEventListener(type, event => forwarded[type].push(event));
    }
    const outsideStart = { identifier:41, clientX:10, clientY:540 };
    runtime.callbacks.touchstart({ touches:[outsideStart], changedTouches:[outsideStart] });
    assert.strictEqual(forwarded.touchstart.length, 0,
      'a touch beginning outside the safe display rect must never reach gameplay');
    assert.ok(runtime.gameWindow.__SMART_EGG_ADAPTER_LOG_CONFIG__
      .find('viewport', 'touch-start-outside-display').length > 0,
    'a rejected gutter touch must leave an independently filterable viewport diagnostic');

    const insideStart = { identifier:42, clientX:100, clientY:540 };
    runtime.callbacks.touchstart({ touches:[insideStart], changedTouches:[insideStart] });
    assert.strictEqual(forwarded.touchstart.length, 1,
      'a touch beginning inside the real game rect must reach gameplay');
    const movedOutside = { identifier:42, clientX:10, clientY:540 };
    runtime.callbacks.touchmove({ touches:[movedOutside], changedTouches:[movedOutside] });
    runtime.callbacks.touchend({ touches:[], changedTouches:[movedOutside] });
    assert.strictEqual(forwarded.touchmove.length, 1,
      'an accepted finger must continue receiving move after leaving the rect');
    assert.strictEqual(forwarded.touchend.length, 1,
      'an accepted finger must receive end outside the rect so held controls cannot stick');
    runtime.callbacks.touchmove({ touches:[movedOutside], changedTouches:[movedOutside] });
    assert.strictEqual(forwarded.touchmove.length, 1,
      'a released identifier must no longer be forwarded');

    const acceptedA = { identifier:51, clientX:700, clientY:600 };
    const rejectedB = { identifier:52, clientX:10, clientY:600 };
    runtime.callbacks.touchstart({ touches:[acceptedA], changedTouches:[acceptedA] });
    const startsBeforeRejectedSecondFinger = forwarded.touchstart.length;
    runtime.callbacks.touchstart({ touches:[acceptedA,rejectedB], changedTouches:[rejectedB] });
    assert.strictEqual(forwarded.touchstart.length, startsBeforeRejectedSecondFinger,
      'an outside second finger must not disturb or create an event for an accepted first finger');
    runtime.callbacks.touchmove({ touches:[acceptedA], changedTouches:[acceptedA] });
    runtime.callbacks.touchend({ touches:[], changedTouches:[acceptedA] });
    assert.strictEqual(forwarded.touchend.at(-1).changedTouches[0].identifier, 51,
      'the accepted first finger must still release after an outside second finger is ignored');

    const acceptedC = { identifier:53, clientX:800, clientY:650 };
    const acceptedD = { identifier:54, clientX:2300, clientY:650 };
    runtime.callbacks.touchstart({ touches:[acceptedC,acceptedD], changedTouches:[acceptedC,acceptedD] });
    runtime.callbacks.touchend({ touches:[acceptedD], changedTouches:[acceptedC] });
    assert.deepStrictEqual(Array.from(forwarded.touchend.at(-1).touches, touch => touch.identifier), [54],
      'ending one accepted finger must leave the other accepted finger active');
    runtime.callbacks.touchcancel({ touches:[], changedTouches:[acceptedD] });
    assert.strictEqual(forwarded.touchcancel.at(-1).changedTouches[0].identifier, 54,
      'touchcancel must release the remaining accepted finger');
    const movesBeforeCancelledReuse = forwarded.touchmove.length;
    runtime.callbacks.touchmove({ touches:[acceptedD], changedTouches:[acceptedD] });
    assert.strictEqual(forwarded.touchmove.length, movesBeforeCancelledReuse,
      'a cancelled identifier must no longer be forwarded');
  }
  assert.strictEqual(runtime.gameWindow.__SMART_EGG_ADAPTER_LOG_CONFIG__.getModules().viewport, true,
    `${entry.name}: viewport diagnostics must be independently enabled`);
  assert.ok(runtime.gameWindow.__SMART_EGG_ADAPTER_LOG_CONFIG__.find('viewport', 'viewport-updated').length > 0,
    `${entry.name}: viewport calculation must be logged`);
}

console.log('微信响应式视口测试通过：常见宽高比、安全区、DPR3、窄屏与超宽精确地图均保持等比且不复制边缘。');
