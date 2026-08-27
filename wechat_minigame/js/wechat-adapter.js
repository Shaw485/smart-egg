'use strict';

/*
 * Smart Egg 微信小游戏兼容层 v163
 *
 * 游戏本体只在一个 1920×1080 Canvas 上绘制。本文件把微信小游戏的
 * Canvas、触摸、存储、音频、生命周期、键盘和日志文件接口映射成游戏
 * 本体原来使用的浏览器接口。现有网页与 Android 版本不需要改动。
 */
(function installWechatAdapter() {
  if (typeof wx === 'undefined') {
    throw new Error('wechat-adapter.js 必须在微信小游戏环境中运行');
  }

  const gameGlobal = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;

  function readProperty(target, key) {
    try { return target && target[key]; }
    catch (_) { return undefined; }
  }

  function keepOrInstallProperty(target, key, value) {
    const current = readProperty(target, key);
    if (current !== undefined && current !== null) return current;
    try {
      target[key] = value;
      return readProperty(target, key) || value;
    } catch (_) {}
    try {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
      return value;
    } catch (_) {
      return current;
    }
  }

  function installOwnProperty(target, key, value) {
    try {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
      return value;
    } catch (_) {
      try { target[key] = value; } catch (_) {}
      return readProperty(target, key);
    }
  }

  // 新版基础库把 GameGlobal 实现成 Window，window/globalThis 是只读 getter。
  // 复用宿主对象即可，不能再用严格模式直接覆盖这两个别名。
  const hostWindow = readProperty(gameGlobal, 'window');
  const root = hostWindow && (typeof hostWindow === 'object' || typeof hostWindow === 'function')
    ? hostWindow
    : gameGlobal;
  keepOrInstallProperty(gameGlobal, 'window', root);
  keepOrInstallProperty(gameGlobal, 'globalThis', root);
  keepOrInstallProperty(root, 'window', root);
  keepOrInstallProperty(root, 'globalThis', root);
  keepOrInstallProperty(root, '__wxMiniGame', true);

  function createEventTarget(target) {
    const listeners = Object.create(null);
    installOwnProperty(target, 'addEventListener', function (type, listener) {
      if (!listener) return;
      (listeners[type] || (listeners[type] = [])).push(listener);
    });
    installOwnProperty(target, 'removeEventListener', function (type, listener) {
      const list = listeners[type];
      if (!list) return;
      const index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    });
    installOwnProperty(target, 'dispatchEvent', function (event) {
      if (!event || !event.type) return true;
      if (!event.target) event.target = target;
      event.currentTarget = target;
      const list = (listeners[event.type] || []).slice();
      for (const listener of list) {
        try { listener.call(target, event); }
        catch (error) { setTimeout(function () { throw error; }, 0); }
      }
      return !event.defaultPrevented;
    });
    installOwnProperty(target, '__listeners', listeners);
    return target;
  }

  function MiniEvent(type, init) {
    this.type = type;
    Object.assign(this, init || {});
    this.defaultPrevented = false;
  }
  MiniEvent.prototype.preventDefault = function () { this.defaultPrevented = true; };
  MiniEvent.prototype.stopPropagation = function () {};
  // 游戏使用独立的兼容窗口，不覆盖微信宿主 Window 的事件与动画方法；
  // 开发者工具依赖这些宿主方法完成 MAIN_PACKAGE_LOADED 启动握手。
  const browserWindow = createEventTarget(Object.create(root));
  installOwnProperty(browserWindow, 'window', browserWindow);
  installOwnProperty(browserWindow, 'globalThis', browserWindow);
  installOwnProperty(browserWindow, '__wxMiniGame', true);
  installOwnProperty(browserWindow, 'Event', MiniEvent);
  installOwnProperty(browserWindow, 'KeyboardEvent', MiniEvent);
  installOwnProperty(browserWindow, 'setInterval', function () { return setInterval.apply(null, arguments); });
  installOwnProperty(browserWindow, 'clearInterval', function () { return clearInterval.apply(null, arguments); });

  const screenCanvas = wx.createCanvas();
  const screenContext = screenCanvas.getContext('2d');
  const gameCanvas = wx.createCanvas();
  createEventTarget(gameCanvas);
  gameCanvas.style = gameCanvas.style || {};

  let windowInfo = {};
  let viewportDpr = 1;
  let displayRect = { left: 0, top: 0, width: 1, height: 1, right: 1, bottom: 1 };

  function readWindowInfo() {
    if (typeof wx.getWindowInfo === 'function') return wx.getWindowInfo();
    if (typeof wx.getSystemInfoSync === 'function') return wx.getSystemInfoSync();
    return { windowWidth: 1280, windowHeight: 720, pixelRatio: 1 };
  }

  function updateViewport() {
    windowInfo = readWindowInfo() || {};
    const width = Math.max(1, windowInfo.windowWidth || windowInfo.screenWidth || 1280);
    const height = Math.max(1, windowInfo.windowHeight || windowInfo.screenHeight || 720);
    const dpr = Math.max(1, windowInfo.pixelRatio || 1);
    viewportDpr = dpr;
    const safe = windowInfo.safeArea || { left: 0, top: 0, right: width, bottom: height, width, height };
    const safeLeft = Number.isFinite(safe.left) ? safe.left : 0;
    const safeTop = Number.isFinite(safe.top) ? safe.top : 0;
    const safeWidth = Math.max(1, safe.width || ((safe.right || width) - safeLeft));
    const safeHeight = Math.max(1, safe.height || ((safe.bottom || height) - safeTop));
    const scale = Math.min(safeWidth / 1920, safeHeight / 1080);
    const drawWidth = 1920 * scale;
    const drawHeight = 1080 * scale;
    const left = safeLeft + (safeWidth - drawWidth) / 2;
    const top = safeTop + (safeHeight - drawHeight) / 2;

    installOwnProperty(browserWindow, 'innerWidth', width);
    installOwnProperty(browserWindow, 'innerHeight', height);
    installOwnProperty(browserWindow, 'devicePixelRatio', dpr);
    installOwnProperty(browserWindow, 'screen', { width, height, availWidth: safeWidth, availHeight: safeHeight });
    screenCanvas.width = Math.round(width * dpr);
    screenCanvas.height = Math.round(height * dpr);
    displayRect = {
      left, top, width: drawWidth, height: drawHeight,
      right: left + drawWidth, bottom: top + drawHeight
    };
  }

  gameCanvas.getBoundingClientRect = function () {
    return Object.assign({}, displayRect, { x: displayRect.left, y: displayRect.top });
  };

  function presentFrame() {
    const dpr = viewportDpr;
    screenContext.setTransform(1, 0, 0, 1, 0, 0);
    screenContext.fillStyle = '#221d2c';
    screenContext.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
    screenContext.drawImage(
      gameCanvas,
      0, 0, gameCanvas.width, gameCanvas.height,
      Math.round(displayRect.left * dpr), Math.round(displayRect.top * dpr),
      Math.round(displayRect.width * dpr), Math.round(displayRect.height * dpr)
    );
  }

  updateViewport();

  const nativeRequestAnimationFrame = typeof screenCanvas.requestAnimationFrame === 'function'
    ? screenCanvas.requestAnimationFrame.bind(screenCanvas)
    : function (callback) { return setTimeout(function () { callback(Date.now()); }, 16); };
  const nativeCancelAnimationFrame = typeof screenCanvas.cancelAnimationFrame === 'function'
    ? screenCanvas.cancelAnimationFrame.bind(screenCanvas)
    : clearTimeout;

  installOwnProperty(browserWindow, 'requestAnimationFrame', function (callback) {
    return nativeRequestAnimationFrame(function (time) {
      callback(time);
      presentFrame();
    });
  });
  installOwnProperty(browserWindow, 'cancelAnimationFrame', nativeCancelAnimationFrame);

  function ClassList(element) { this.element = element; }
  ClassList.prototype._list = function () {
    return String(this.element.className || '').split(/\s+/).filter(Boolean);
  };
  ClassList.prototype.contains = function (name) { return this._list().indexOf(name) >= 0; };
  ClassList.prototype.add = function (name) {
    const list = this._list();
    if (list.indexOf(name) < 0) list.push(name);
    this.element.className = list.join(' ');
  };
  ClassList.prototype.remove = function (name) {
    this.element.className = this._list().filter(function (item) { return item !== name; }).join(' ');
  };

  function FakeElement(tagName) {
    createEventTarget(this);
    this.tagName = String(tagName || 'div').toUpperCase();
    this.hidden = true;
    this.value = '';
    this.textContent = '';
    this.className = '';
    this.classList = new ClassList(this);
    this.style = {};
    this.children = [];
  }
  FakeElement.prototype.appendChild = function (child) { this.children.push(child); return child; };
  FakeElement.prototype.remove = function () {};
  FakeElement.prototype.select = function () {};
  FakeElement.prototype.click = function () { this.dispatchEvent(new MiniEvent('click')); };
  FakeElement.prototype.focus = function () {};
  FakeElement.prototype.blur = function () { if (typeof wx.hideKeyboard === 'function') wx.hideKeyboard(); };

  const body = new FakeElement('body');
  // 复用游戏本体的原生全屏分支：不扣除网页底部提示栏，并降低离屏画布像素量。
  body.className = 'wechat-minigame android-app';
  const elements = {
    'game-canvas': gameCanvas,
    'level-code-dialog': new FakeElement('div'),
    'level-code-input': new FakeElement('textarea'),
    'level-code-error': new FakeElement('div'),
    'level-code-cancel': new FakeElement('button'),
    'level-code-submit': new FakeElement('button'),
    'hint-bar': new FakeElement('div')
  };
  const documentObject = createEventTarget({
    body,
    hidden: false,
    visibilityState: 'visible',
    getElementById: function (id) { return elements[id] || null; },
    createElement: function (tagName) { return new FakeElement(tagName); },
    execCommand: function () { return false; }
  });
  installOwnProperty(browserWindow, 'document', documentObject);

  const locationObject = {
    href: 'wxgame://smart-egg/',
    protocol: 'wxgame:',
    search: '',
    hash: '',
    reload: function () {}
  };
  installOwnProperty(browserWindow, 'location', locationObject);

  let URLSearchParamsObject = readProperty(root, 'URLSearchParams');
  if (!URLSearchParamsObject) {
    URLSearchParamsObject = function (query) {
      const values = Object.create(null);
      String(query || '').replace(/^\?/, '').split('&').forEach(function (pair) {
        if (!pair) return;
        const parts = pair.split('=');
        values[decodeURIComponent(parts[0])] = decodeURIComponent(parts.slice(1).join('=') || '');
      });
      this.get = function (key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; };
    };
  }
  installOwnProperty(browserWindow, 'URLSearchParams', URLSearchParamsObject);

  const performanceObject = readProperty(root, 'performance') || { now: function () { return Date.now(); } };
  installOwnProperty(browserWindow, 'performance', performanceObject);

  const appInfo = typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo() : {};
  const deviceInfo = typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo() : windowInfo;
  const navigatorObject = {
    onLine: true,
    userAgent: 'WeChatMiniGame/' + (appInfo.SDKVersion || 'unknown'),
    platform: deviceInfo.platform || deviceInfo.system || 'wechat',
    language: appInfo.language || 'zh_CN',
    clipboard: {
      writeText: function (text) {
        return new Promise(function (resolve, reject) {
          wx.setClipboardData({ data: String(text), success: resolve, fail: reject });
        });
      }
    }
  };
  installOwnProperty(browserWindow, 'navigator', navigatorObject);

  const localStorageObject = {
    getItem: function (key) {
      try {
        const value = wx.getStorageSync(String(key));
        return value === '' || typeof value === 'undefined' ? null : String(value);
      } catch (_) { return null; }
    },
    setItem: function (key, value) { wx.setStorageSync(String(key), String(value)); },
    removeItem: function (key) { wx.removeStorageSync(String(key)); },
    clear: function () { wx.clearStorageSync(); }
  };
  installOwnProperty(browserWindow, 'localStorage', localStorageObject);

  const fetchObject = function () {
    return Promise.reject(new Error('微信小游戏本地关卡使用 levels.js 内嵌数据，不使用 fetch'));
  };
  installOwnProperty(browserWindow, 'fetch', fetchObject);
  const alertObject = function (message) {
    wx.showModal({ title: '提示', content: String(message), showCancel: false });
  };

  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let btoaObject = readProperty(root, 'btoa');
  if (!btoaObject) {
    btoaObject = function (input) {
      let output = '', index = 0;
      const text = String(input);
      while (index < text.length) {
        const a = text.charCodeAt(index++) & 255;
        const hasB = index < text.length;
        const b = hasB ? text.charCodeAt(index++) & 255 : 0;
        const hasC = index < text.length;
        const c = hasC ? text.charCodeAt(index++) & 255 : 0;
        output += base64Chars[a >> 2];
        output += base64Chars[((a & 3) << 4) | (b >> 4)];
        output += hasB ? base64Chars[((b & 15) << 2) | (c >> 6)] : '=';
        output += hasC ? base64Chars[c & 63] : '=';
      }
      return output;
    };
  }
  installOwnProperty(browserWindow, 'btoa', btoaObject);
  let atobObject = readProperty(root, 'atob');
  if (!atobObject) {
    atobObject = function (input) {
      const text = String(input).replace(/[^A-Za-z0-9+/=]/g, '');
      let output = '', index = 0;
      while (index < text.length) {
        const a = base64Chars.indexOf(text[index++]);
        const b = base64Chars.indexOf(text[index++]);
        const c = base64Chars.indexOf(text[index++]);
        const d = base64Chars.indexOf(text[index++]);
        output += String.fromCharCode((a << 2) | (b >> 4));
        if (c !== 64 && c >= 0) output += String.fromCharCode(((b & 15) << 4) | (c >> 2));
        if (d !== 64 && d >= 0) output += String.fromCharCode(((c & 3) << 6) | d);
      }
      return output;
    };
  }
  installOwnProperty(browserWindow, 'atob', atobObject);

  let TextEncoderObject = readProperty(root, 'TextEncoder');
  if (!TextEncoderObject) {
    TextEncoderObject = function () {};
    TextEncoderObject.prototype.encode = function (text) {
      const encoded = unescape(encodeURIComponent(String(text)));
      const bytes = new Uint8Array(encoded.length);
      for (let i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i);
      return bytes;
    };
  }
  installOwnProperty(browserWindow, 'TextEncoder', TextEncoderObject);
  let TextDecoderObject = readProperty(root, 'TextDecoder');
  if (!TextDecoderObject) {
    TextDecoderObject = function () {};
    TextDecoderObject.prototype.decode = function (bytes) {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      }
      return decodeURIComponent(escape(binary));
    };
  }
  installOwnProperty(browserWindow, 'TextDecoder', TextDecoderObject);

  function AudioParam(value) {
    this.value = value || 0;
    this.peak = Math.max(0, this.value);
    this.hasScheduledValue = false;
  }
  AudioParam.prototype.setValueAtTime = function (value) {
    this.value = value;
    if (!this.hasScheduledValue) this.peak = Math.max(0, value);
    else this.peak = Math.max(this.peak, value);
    this.hasScheduledValue = true;
  };
  AudioParam.prototype.exponentialRampToValueAtTime = function (value) {
    this.value = value;
    this.peak = Math.max(this.peak, value);
    this.hasScheduledValue = true;
  };

  function FallbackAudioContext() {
    this.state = 'running';
    this.destination = {};
  }
  Object.defineProperty(FallbackAudioContext.prototype, 'currentTime', {
    get: function () { return Date.now() / 1000; }
  });
  FallbackAudioContext.prototype.resume = function () { this.state = 'running'; return Promise.resolve(); };
  FallbackAudioContext.prototype.suspend = function () { this.state = 'suspended'; return Promise.resolve(); };
  FallbackAudioContext.prototype.createGain = function () {
    return {
      gain: new AudioParam(0.0001),
      connect: function (target) { return target; }
    };
  };
  FallbackAudioContext.prototype.createOscillator = function () {
    const context = this;
    return {
      type: 'sine',
      frequency: new AudioParam(440),
      _gain: null,
      _startAt: context.currentTime,
      connect: function (target) { this._gain = target; return target; },
      start: function (when) { this._startAt = Number(when) || context.currentTime; },
      stop: function (when) {
        if (context.state !== 'running' || typeof wx.createInnerAudioContext !== 'function') return;
        const frequency = Math.max(55, this.frequency.peak || this.frequency.value || 440);
        const bases = [110, 440, 880];
        let base = bases[0];
        for (const candidate of bases) {
          if (Math.abs(Math.log(frequency / candidate)) < Math.abs(Math.log(frequency / base))) base = candidate;
        }
        const delay = Math.max(0, (this._startAt - context.currentTime) * 1000);
        const duration = Math.max(40, ((Number(when) || this._startAt + 0.2) - this._startAt) * 1000);
        const gain = this._gain && this._gain.gain ? this._gain.gain.peak : 0.05;
        setTimeout(function () {
          const audio = wx.createInnerAudioContext();
          audio.autoplay = false;
          audio.loop = false;
          audio.obeyMuteSwitch = true;
          audio.volume = Math.max(0, Math.min(1, gain * 2.2));
          audio.playbackRate = Math.max(0.5, Math.min(2, frequency / base));
          audio.src = 'assets/tone-' + base + '.wav';
          if (typeof audio.onCanplay === 'function') {
            let started = false;
            audio.onCanplay(function () { if (!started) { started = true; audio.play(); } });
          } else audio.play();
          setTimeout(function () {
            try { audio.stop(); audio.destroy(); } catch (_) {}
          }, duration + 80);
        }, delay);
      }
    };
  };

  function WechatAudioContext() {
    if (typeof wx.createWebAudioContext === 'function') return wx.createWebAudioContext();
    return new FallbackAudioContext();
  }
  installOwnProperty(browserWindow, 'AudioContext', WechatAudioContext);
  installOwnProperty(browserWindow, 'webkitAudioContext', WechatAudioContext);

  function normalizeTouch(touch, fallbackId) {
    return {
      identifier: touch.identifier == null ? fallbackId : touch.identifier,
      clientX: touch.clientX == null ? touch.x : touch.clientX,
      clientY: touch.clientY == null ? touch.y : touch.clientY,
      pageX: touch.pageX == null ? touch.x : touch.pageX,
      pageY: touch.pageY == null ? touch.y : touch.pageY
    };
  }
  function forwardTouch(type, nativeEvent) {
    const touches = Array.from(nativeEvent.touches || []).map(normalizeTouch);
    const changedTouches = Array.from(nativeEvent.changedTouches || nativeEvent.touches || []).map(normalizeTouch);
    const event = new MiniEvent(type, { touches, changedTouches, timeStamp: Date.now() });
    gameCanvas.dispatchEvent(event);
    if (type === 'touchstart') documentObject.dispatchEvent(new MiniEvent('pointerdown', { touches, changedTouches }));
  }
  wx.onTouchStart(function (event) { forwardTouch('touchstart', event); });
  if (typeof wx.onTouchMove === 'function') wx.onTouchMove(function (event) { forwardTouch('touchmove', event); });
  wx.onTouchEnd(function (event) { forwardTouch('touchend', event); });
  wx.onTouchCancel(function (event) { forwardTouch('touchcancel', event); });

  // 微信小游戏本体运行在隔离的浏览器兼容环境中。开发者工具的实体键盘
  // 事件仍由宿主 Window/document 接收，因此需要只读监听并转发给游戏文档。
  // 不覆盖宿主事件方法，避免再次破坏开发者工具的启动与热更新握手。
  const forwardedNativeKeyboardEvents = typeof WeakSet === 'function' ? new WeakSet() : null;
  function normalizeKeyboardCode(nativeEvent) {
    const rawCode = String(nativeEvent && nativeEvent.code || '');
    if (rawCode) return rawCode;
    const key = String(nativeEvent && nativeEvent.key || '');
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'a') return 'KeyA';
    if (lowerKey === 'd') return 'KeyD';
    if (lowerKey === 'w') return 'KeyW';
    if (key === ' ' || key === 'Spacebar' || key === 'Space') return 'Space';
    if (key === 'ArrowLeft' || key === 'Left') return 'ArrowLeft';
    if (key === 'ArrowRight' || key === 'Right') return 'ArrowRight';
    if (key === 'ArrowUp' || key === 'Up') return 'ArrowUp';
    const keyCode = Number(nativeEvent && (nativeEvent.keyCode || nativeEvent.which));
    return ({ 32: 'Space', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 65: 'KeyA', 68: 'KeyD', 87: 'KeyW' })[keyCode] || '';
  }
  function keyboardKeyFromCode(code, nativeEvent) {
    if (nativeEvent && nativeEvent.key != null) return String(nativeEvent.key);
    return ({ KeyA: 'a', KeyD: 'd', KeyW: 'w', Space: ' ', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp' })[code] || code;
  }
  function forwardKeyboard(type, nativeEvent) {
    if (!nativeEvent) nativeEvent = {};
    if (forwardedNativeKeyboardEvents && (typeof nativeEvent === 'object' || typeof nativeEvent === 'function')) {
      if (forwardedNativeKeyboardEvents.has(nativeEvent)) return;
      forwardedNativeKeyboardEvents.add(nativeEvent);
    }
    const code = normalizeKeyboardCode(nativeEvent);
    if (!code) return;
    const event = new MiniEvent(type, {
      code,
      key: keyboardKeyFromCode(code, nativeEvent),
      keyCode: Number(nativeEvent.keyCode || nativeEvent.which) || 0,
      which: Number(nativeEvent.which || nativeEvent.keyCode) || 0,
      repeat: !!nativeEvent.repeat,
      altKey: !!nativeEvent.altKey,
      ctrlKey: !!nativeEvent.ctrlKey,
      metaKey: !!nativeEvent.metaKey,
      shiftKey: !!nativeEvent.shiftKey,
      bubbles: true,
      cancelable: true,
      timeStamp: Number(nativeEvent.timeStamp) || Date.now()
    });
    event.preventDefault = function () {
      this.defaultPrevented = true;
      if (typeof nativeEvent.preventDefault === 'function') nativeEvent.preventDefault();
    };
    documentObject.dispatchEvent(event);
  }
  function registerKeyboardTarget(target) {
    if (!target || target === browserWindow || target === documentObject || typeof target.addEventListener !== 'function') return;
    try {
      target.addEventListener('keydown', function (event) { forwardKeyboard('keydown', event); });
      target.addEventListener('keyup', function (event) { forwardKeyboard('keyup', event); });
    } catch (_) {}
  }
  registerKeyboardTarget(readProperty(root, 'document'));
  registerKeyboardTarget(root);
  // 部分微信开发者工具版本只把实体键盘事件派发给原生显示画布，
  // 因此也监听 screenCanvas 及其 ownerDocument。重复事件由 WeakSet 去重。
  registerKeyboardTarget(screenCanvas);
  registerKeyboardTarget(readProperty(screenCanvas, 'ownerDocument'));
  // 兼容未来或特定平台基础库直接提供的键盘监听接口。
  if (typeof wx.onKeyDown === 'function') wx.onKeyDown(function (event) { forwardKeyboard('keydown', event); });
  if (typeof wx.onKeyUp === 'function') wx.onKeyUp(function (event) { forwardKeyboard('keyup', event); });

  function setVisibility(hidden) {
    documentObject.hidden = hidden;
    documentObject.visibilityState = hidden ? 'hidden' : 'visible';
    documentObject.dispatchEvent(new MiniEvent('visibilitychange'));
    if (hidden) browserWindow.dispatchEvent(new MiniEvent('blur'));
  }
  wx.onHide(function () { setVisibility(true); });
  wx.onShow(function () { setVisibility(false); });
  if (typeof wx.onWindowResize === 'function') {
    wx.onWindowResize(function () {
      updateViewport();
      browserWindow.dispatchEvent(new MiniEvent('resize'));
    });
  }
  if (typeof wx.onNetworkStatusChange === 'function') {
    wx.onNetworkStatusChange(function (result) {
      navigatorObject.onLine = !!result.isConnected;
      browserWindow.dispatchEvent(new MiniEvent(result.isConnected ? 'online' : 'offline'));
    });
  }
  if (typeof wx.onError === 'function') {
    wx.onError(function (message) {
      browserWindow.dispatchEvent(new MiniEvent('error', { message: String(message), filename: '', lineno: 0, colno: 0 }));
    });
  }
  if (typeof wx.onUnhandledRejection === 'function') {
    wx.onUnhandledRejection(function (event) {
      browserWindow.dispatchEvent(new MiniEvent('unhandledrejection', { reason: event && event.reason }));
    });
  }

  const promptLevelCode = function (onSubmit) {
    let finished = false;
    let defaultValue = '';
    function cleanup() {
      if (typeof wx.offKeyboardConfirm === 'function') wx.offKeyboardConfirm(confirmHandler);
      if (typeof wx.offKeyboardComplete === 'function') wx.offKeyboardComplete(completeHandler);
    }
    function finish(value) {
      if (finished) return;
      finished = true;
      cleanup();
      if (typeof wx.hideKeyboard === 'function') wx.hideKeyboard();
      onSubmit(String(value || ''));
    }
    function confirmHandler(event) { finish(event && event.value); }
    function completeHandler(event) {
      if (!finished && event && event.value) finish(event.value);
      else cleanup();
    }
    function openKeyboard() {
      wx.onKeyboardConfirm(confirmHandler);
      if (typeof wx.onKeyboardComplete === 'function') wx.onKeyboardComplete(completeHandler);
      wx.showKeyboard({
        defaultValue,
        maxLength: 5000,
        multiple: false,
        confirmHold: false,
        confirmType: 'done',
        success: function () {
          wx.showToast({ title: '粘贴关卡码后点完成', icon: 'none', duration: 1800 });
        },
        fail: function () {
          cleanup();
          wx.showModal({ title: '无法打开键盘', content: '请重试输入关卡码。', showCancel: false });
        }
      });
    }
    if (typeof wx.getClipboardData === 'function') {
      wx.getClipboardData({
        success: function (result) {
          const value = String((result && result.data) || '').trim();
          if (value.indexOf('SE1-') === 0) defaultValue = value;
          openKeyboard();
        },
        fail: openKeyboard
      });
    } else openKeyboard();
  };
  installOwnProperty(browserWindow, '__wxPromptLevelCode', promptLevelCode);

  const androidLogExporter = {
    exportLog: function (filename, text) {
      const fs = wx.getFileSystemManager();
      const base = wx.env && wx.env.USER_DATA_PATH ? wx.env.USER_DATA_PATH : '';
      const path = base + '/' + String(filename).replace(/[\\/:*?"<>|]/g, '-');
      fs.writeFile({
        filePath: path,
        data: String(text),
        encoding: 'utf8',
        success: function () {
          if (typeof wx.shareFileMessage === 'function') {
            wx.shareFileMessage({ filePath: path, fileName: filename });
          } else {
            wx.setClipboardData({
              data: String(text),
              success: function () { wx.showToast({ title: '日志已复制', icon: 'success' }); }
            });
          }
        },
        fail: function (error) {
          wx.showModal({ title: '日志导出失败', content: String(error && error.errMsg || error), showCancel: false });
        }
      });
    }
  };
  installOwnProperty(browserWindow, 'AndroidLogExporter', androidLogExporter);

  const wechatEnvironment = {
    window: browserWindow,
    document: documentObject,
    location: locationObject,
    navigator: navigatorObject,
    localStorage: localStorageObject,
    performance: performanceObject,
    fetch: fetchObject,
    alert: alertObject,
    URLSearchParams: URLSearchParamsObject,
    btoa: btoaObject,
    atob: atobObject,
    TextEncoder: TextEncoderObject,
    TextDecoder: TextDecoderObject,
    requestAnimationFrame: browserWindow.requestAnimationFrame,
    cancelAnimationFrame: browserWindow.cancelAnimationFrame,
    Event: MiniEvent,
    KeyboardEvent: MiniEvent
  };
  installOwnProperty(root, '__SMART_EGG_WECHAT_ENV__', wechatEnvironment);
  installOwnProperty(browserWindow, '__SMART_EGG_WECHAT_ENV__', wechatEnvironment);

  const wechatBridge = {
    version: 163,
    screenCanvas,
    gameCanvas,
    getDisplayRect: function () { return Object.assign({}, displayRect); },
    presentFrame,
    updateViewport
  };
  installOwnProperty(root, '__SMART_EGG_WECHAT_BRIDGE__', wechatBridge);
  installOwnProperty(browserWindow, '__SMART_EGG_WECHAT_BRIDGE__', wechatBridge);
})();
