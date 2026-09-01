'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const adapterSource = fs.readFileSync(path.resolve(__dirname, '../js/wechat-adapter.js'), 'utf8');
const gameSource = fs.readFileSync(path.resolve(__dirname, '../js/smart-egg-game.js'), 'utf8');
const menuHelpersStart = gameSource.indexOf('    function _currentViewportUiSnapshot()');
const menuHelpersEnd = gameSource.indexOf('    window.__debug.getMenuDiagnosticLayout', menuHelpersStart);
assert.ok(menuHelpersStart >= 0 && menuHelpersEnd > menuHelpersStart,
  'responsive test must execute the production menu diagnostic and version badge helpers');
const menuHelpersSource = gameSource.slice(menuHelpersStart, menuHelpersEnd);

function bootAdapter(windowInfo, menuButtonApi) {
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
  if (menuButtonApi !== undefined) {
    wx.getMenuButtonBoundingClientRect = typeof menuButtonApi === 'function'
      ? menuButtonApi
      : () => JSON.parse(JSON.stringify(menuButtonApi));
  }
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

function evaluateProductionMenuUi(viewport) {
  const snapshot = JSON.parse(JSON.stringify(viewport));
  const sandbox = {
    window:{
      __SMART_EGG_VIEWPORT__:snapshot,
      __SMART_EGG_WECHAT_BRIDGE__:{ getViewport:() => snapshot }
    },
    W:viewport.logicalWidth,
    H:viewport.logicalHeight,
    VIEWPORT_SAFE_INSETS:snapshot.logicalSafeInsets || { left:0, right:0, top:0, bottom:0 },
    WECHAT_VIEWPORT:null,
    JSON,
    Object,
    Number,
    Math
  };
  vm.createContext(sandbox);
  vm.runInContext(`${menuHelpersSource}\n`+
    'globalThis.__menuUiResult = {'+
      'menu:_computeMenuDiagnosticLayout(), badge:_versionBadgeRect()'+
    '};', sandbox, { filename:'smart-egg-game-menu-layout.js' });
  return JSON.parse(JSON.stringify(sandbox.__menuUiResult));
}

function normalizeRect(rect) {
  return {
    x:Number(rect.x != null ? rect.x : rect.left),
    y:Number(rect.y != null ? rect.y : rect.top),
    w:Number(rect.w != null ? rect.w : rect.width),
    h:Number(rect.h != null ? rect.h : rect.height)
  };
}

function rectsOverlap(a, b) {
  const first = normalizeRect(a);
  const second = normalizeRect(b);
  return first.x < second.x + second.w && first.x + first.w > second.x
    && first.y < second.y + second.h && first.y + first.h > second.y;
}

function assertMenuUiSafe(viewport, expectedCandidate, label) {
  const ui = evaluateProductionMenuUi(viewport);
  const { menu, badge } = ui;
  assert.strictEqual(menu.candidate, expectedCandidate, `${label}: menu layout candidate`);
  assert.deepStrictEqual(menu.hitRect, menu.visualRect,
    `${label}: the production draw rect and click hit rect must be identical`);
  assert.strictEqual(menu.overlap, false, `${label}: log export button must avoid the system capsule`);
  assert.ok(menu.visualRect.x >= menu.safeBounds.x
    && menu.visualRect.y >= menu.safeBounds.y
    && menu.visualRect.x + menu.visualRect.w <= menu.safeBounds.x + menu.safeBounds.w
    && menu.visualRect.y + menu.visualRect.h <= menu.safeBounds.y + menu.safeBounds.h,
  `${label}: log export button must remain fully inside the logical safe bounds`);
  if (viewport.logicalSystemMenuButton) {
    const capsule = normalizeRect(viewport.logicalSystemMenuButton);
    const expandedCapsule = {
      x:capsule.x-menu.clearance,
      y:capsule.y-menu.clearance,
      w:capsule.w+menu.clearance*2,
      h:capsule.h+menu.clearance*2
    };
    assert.strictEqual(rectsOverlap(menu.visualRect, expandedCapsule), false,
      `${label}: log export button must keep the configured clearance from the system capsule`);
    assert.strictEqual(rectsOverlap(badge, capsule), false,
      `${label}: version badge must never overlap the system capsule`);
  }
  assert.ok(badge.x >= viewport.logicalSafeInsets.left
    && badge.x + badge.w <= viewport.logicalWidth - viewport.logicalSafeInsets.right
    && badge.y >= viewport.logicalSafeInsets.top
    && badge.y + badge.h <= viewport.logicalHeight - viewport.logicalSafeInsets.bottom,
  `${label}: version badge must remain visible inside the logical safe area`);
  return ui;
}

function roundedRect(rect) {
  return Object.fromEntries(['left','top','width','height','right','bottom'].map(key => [key, Math.round(rect[key] * 1000) / 1000]));
}

const matrix = [
  {
    name:'16:9',
    info:{ windowWidth:1280, windowHeight:720, pixelRatio:1 },
    menuButton:{ left:1120, top:16, width:132, height:54 },
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
    menuButton:{ left:2148, top:24, width:222, height:80 },
    logicalWidth:2400,
    rect:{ left:0, top:0, width:2400, height:1080, right:2400, bottom:1080 },
    mode:'horizontal-map-extension'
  },
  {
    name:'2403x1080-asymmetric-safe-area-dpr3',
    info:{
      windowWidth:2403, windowHeight:1080, pixelRatio:3,
      safeArea:{ left:104, top:0, right:2403, bottom:1080, width:2299, height:1080 }
    },
    logicalWidth:2403,
    rect:{ left:0, top:0, width:2403, height:1080, right:2403, bottom:1080 },
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
  const runtime = bootAdapter(entry.info, entry.menuButton);
  const viewport = runtime.bridge.getViewport();
  assert.strictEqual(runtime.bridge.version, 191, `${entry.name}: bridge version`);
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

  if (entry.name === '2403x1080-asymmetric-safe-area-dpr3') {
    assert.deepStrictEqual(Object.fromEntries(['left','right','top','bottom']
      .map(key => [key, viewport.safeInsets[key]])), { left:104, right:0, top:0, bottom:0 },
      'safe area must remain available for UI avoidance without shrinking the map');
    assert.deepStrictEqual(Object.fromEntries(['left','right','top','bottom']
      .map(key => [key, viewport.logicalSafeInsets[key]])), { left:104, right:0, top:0, bottom:0 },
      'safe insets must also be exposed in logical coordinates for game UI placement');
    assert.strictEqual(viewport.layoutSource, 'full-window',
      'the full physical window, not safeArea, must determine the visible map width');
    assert.strictEqual(viewport.gutters.left, 0,
      'the asymmetric left safe area must not become a black render gutter');
    assert.ok(runtime.bridge.clientToLogical(10, 540),
      'rendered map inside the left safe inset must stay part of the logical world');
    const forwarded = { touchstart:[], touchmove:[], touchend:[], touchcancel:[] };
    for (const type of Object.keys(forwarded)) {
      runtime.gameCanvas.addEventListener(type, event => forwarded[type].push(event));
    }
    const outsideStart = { identifier:41, clientX:10, clientY:540 };
    runtime.callbacks.touchstart({ touches:[outsideStart], changedTouches:[outsideStart] });
    assert.strictEqual(forwarded.touchstart.length, 1,
      'a touch in the full rendered map must reach gameplay even when safeArea starts farther right');

    const insideStart = { identifier:42, clientX:100, clientY:540 };
    runtime.callbacks.touchstart({ touches:[insideStart], changedTouches:[insideStart] });
    assert.strictEqual(forwarded.touchstart.length, 2,
      'a touch beginning inside the real game rect must reach gameplay');
    const movedOutside = { identifier:42, clientX:-10, clientY:540 };
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
    const rejectedB = { identifier:52, clientX:-10, clientY:600 };
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
  if (entry.menuButton) {
    const physicalMenuButton = {
      left:entry.menuButton.left,
      top:entry.menuButton.top,
      width:entry.menuButton.width,
      height:entry.menuButton.height,
      right:entry.menuButton.left+entry.menuButton.width,
      bottom:entry.menuButton.top+entry.menuButton.height
    };
    const display = runtime.bridge.getDisplayRect();
    const logicalMenuButton = {
      left:Number(((physicalMenuButton.left-display.left)*viewport.logicalWidth/display.width).toFixed(3)),
      top:Number(((physicalMenuButton.top-display.top)*viewport.logicalHeight/display.height).toFixed(3)),
      width:Number((physicalMenuButton.width*viewport.logicalWidth/display.width).toFixed(3)),
      height:Number((physicalMenuButton.height*viewport.logicalHeight/display.height).toFixed(3))
    };
    logicalMenuButton.right = Number((logicalMenuButton.left+logicalMenuButton.width).toFixed(3));
    logicalMenuButton.bottom = Number((logicalMenuButton.top+logicalMenuButton.height).toFixed(3));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(viewport.systemMenuButton)), physicalMenuButton,
      `${entry.name}: physical capsule rect must be preserved for diagnostics`);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(viewport.logicalSystemMenuButton)), logicalMenuButton,
      `${entry.name}: capsule rect must be converted into the logical game coordinate space`);
    assert.strictEqual(viewport.systemMenuButtonSource, 'getMenuButtonBoundingClientRect',
      `${entry.name}: capsule source must record the successful WeChat API`);
    assertMenuUiSafe(viewport, 'top-left', entry.name);
  }
}

const leftCapsuleRuntime = bootAdapter({
  windowWidth:2400,
  windowHeight:1080,
  pixelRatio:1,
  safeArea:{ left:104, top:0, right:2400, bottom:1080, width:2296, height:1080 }
}, { left:120, top:24, width:222, height:80 });
const leftCapsuleViewport = leftCapsuleRuntime.bridge.getViewport();
const leftCapsuleUi = assertMenuUiSafe(leftCapsuleViewport, 'top-right', '20:9 left-side capsule');
assert.ok(leftCapsuleUi.menu.visualRect.x > leftCapsuleViewport.logicalSystemMenuButton.right,
  '20:9 left-side capsule: log export button must move to the opposite side of the screen');
assert.ok(leftCapsuleUi.badge.x >= leftCapsuleViewport.logicalSystemMenuButton.right+16,
  '20:9 left-side capsule: version badge must keep its 16px gap after the capsule');

const fallbackWindowInfo = { windowWidth:2400, windowHeight:1080, pixelRatio:1 };
const fallbackCases = [
  {
    name:'invalid capsule API rect',
    menuButton:{ left:2148, top:24, width:0, height:80 },
    source:'invalid-rect',
    warning:false
  },
  {
    name:'throwing capsule API',
    menuButton:() => { throw new Error('synthetic capsule failure'); },
    source:'api-error',
    warning:true
  }
];
for (const entry of fallbackCases) {
  const runtime = bootAdapter(fallbackWindowInfo, entry.menuButton);
  const viewport = runtime.bridge.getViewport();
  assert.strictEqual(viewport.systemMenuButton, null, `${entry.name}: invalid physical rect must not leak`);
  assert.strictEqual(viewport.logicalSystemMenuButton, null, `${entry.name}: invalid logical rect must not leak`);
  assert.strictEqual(viewport.systemMenuButtonSource, entry.source,
    `${entry.name}: fallback reason must remain actionable in diagnostics`);
  const warnings = runtime.gameWindow.__SMART_EGG_ADAPTER_LOG_CONFIG__.find('viewport', 'menu-button-read-failed');
  assert.strictEqual(warnings.length > 0, entry.warning,
    `${entry.name}: only thrown API failures should produce a warning record`);
  if (entry.warning) {
    assert.ok(warnings.some(item => item.context && item.context.message === 'synthetic capsule failure'),
      `${entry.name}: warning must preserve the non-sensitive failure cause`);
  }
  const ui = assertMenuUiSafe(viewport, 'top-left', entry.name);
  assert.strictEqual(ui.menu.capsuleRect, null,
    `${entry.name}: production layout must safely fall back when no usable capsule exists`);
  assert.strictEqual(ui.menu.capsuleSource, entry.source,
    `${entry.name}: production layout export must include the capsule fallback source`);
}

assert.ok([
  'const { x:logX, y:logY, w:logW, h:logH } = diagnosticLayout.visualRect;',
  'uiBTN.exportLog = Object.assign({}, diagnosticLayout.hitRect,',
  'if (inRect(p, uiBTN.exportLog)) {',
  'const versionRect = _versionBadgeRect();'
].every(fragment => gameSource.includes(fragment)),
'production drawing, click dispatch, export hitbox and version badge must all consume the tested layout helpers');

console.log('微信响应式视口测试通过：宽高比、安全区、左右胶囊、异常 API、日志热区与版本徽标均安全适配。');
