'use strict';

/*
 * Smart Egg 微信小游戏兼容层 v160
 *
 * 游戏本体只在一个 1920×1080 Canvas 上绘制。本文件把微信小游戏的
 * Canvas、触摸、存储、音频、生命周期、键盘和日志文件接口映射成游戏
 * 本体原来使用的浏览器接口。现有网页与 Android 版本不需要改动。
 */
(function installWechatAdapter() {
  if (typeof wx === 'undefined') {
    throw new Error('wechat-adapter.js 必须在微信小游戏环境中运行');
  }

  const root = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
  root.window = root;
  root.globalThis = root;
  root.__wxMiniGame = true;

  function createEventTarget(target) {
    const listeners = Object.create(null);
    target.addEventListener = function (type, listener) {
      if (!listener) return;
      (listeners[type] || (listeners[type] = [])).push(listener);
    };
    target.removeEventListener = function (type, listener) {
      const list = listeners[type];
      if (!list) return;
      const index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    };
    target.dispatchEvent = function (event) {
      if (!event || !event.type) return true;
      if (!event.target) event.target = target;
      event.currentTarget = target;
      const list = (listeners[event.type] || []).slice();
      for (const listener of list) {
        try { listener.call(target, event); }
        catch (error) { setTimeout(function () { throw error; }, 0); }
      }
      return !event.defaultPrevented;
    };
    target.__listeners = listeners;
    return target;
  }

  function MiniEvent(type, init) {
    this.type = type;
    Object.assign(this, init || {});
    this.defaultPrevented = false;
  }
  MiniEvent.prototype.preventDefault = function () { this.defaultPrevented = true; };
  MiniEvent.prototype.stopPropagation = function () {};
  // 小游戏事件对象需要可写 target/currentTarget；不要沿用宿主里只读的 DOM Event。
  root.Event = MiniEvent;
  root.KeyboardEvent = MiniEvent;

  createEventTarget(root);

  const screenCanvas = wx.createCanvas();
  const screenContext = screenCanvas.getContext('2d');
  const gameCanvas = wx.createCanvas();
  createEventTarget(gameCanvas);
  gameCanvas.style = gameCanvas.style || {};

  let windowInfo = {};
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

    root.innerWidth = width;
    root.innerHeight = height;
    root.devicePixelRatio = dpr;
    root.screen = { width, height, availWidth: safeWidth, availHeight: safeHeight };
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
    const dpr = root.devicePixelRatio || 1;
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

  root.requestAnimationFrame = function (callback) {
    return nativeRequestAnimationFrame(function (time) {
      callback(time);
      presentFrame();
    });
  };
  root.cancelAnimationFrame = nativeCancelAnimationFrame;

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
  root.document = documentObject;

  root.location = {
    href: 'wxgame://smart-egg/',
    protocol: 'wxgame:',
    search: '',
    hash: '',
    reload: function () {}
  };

  if (!root.URLSearchParams) {
    root.URLSearchParams = function (query) {
      const values = Object.create(null);
      String(query || '').replace(/^\?/, '').split('&').forEach(function (pair) {
        if (!pair) return;
        const parts = pair.split('=');
        values[decodeURIComponent(parts[0])] = decodeURIComponent(parts.slice(1).join('=') || '');
      });
      this.get = function (key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; };
    };
  }

  if (!root.performance) root.performance = { now: function () { return Date.now(); } };

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
  try {
    Object.defineProperty(root, 'navigator', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: navigatorObject
    });
  } catch (_) {
    Object.assign(root.navigator || {}, navigatorObject);
  }

  root.localStorage = {
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

  root.fetch = function () {
    return Promise.reject(new Error('微信小游戏本地关卡使用 levels.js 内嵌数据，不使用 fetch'));
  };
  root.alert = function (message) {
    wx.showModal({ title: '提示', content: String(message), showCancel: false });
  };

  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  if (!root.btoa) {
    root.btoa = function (input) {
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
  if (!root.atob) {
    root.atob = function (input) {
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

  if (!root.TextEncoder) {
    root.TextEncoder = function () {};
    root.TextEncoder.prototype.encode = function (text) {
      const encoded = unescape(encodeURIComponent(String(text)));
      const bytes = new Uint8Array(encoded.length);
      for (let i = 0; i < encoded.length; i++) bytes[i] = encoded.charCodeAt(i);
      return bytes;
    };
  }
  if (!root.TextDecoder) {
    root.TextDecoder = function () {};
    root.TextDecoder.prototype.decode = function (bytes) {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      }
      return decodeURIComponent(escape(binary));
    };
  }

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
  root.AudioContext = WechatAudioContext;
  root.webkitAudioContext = WechatAudioContext;

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

  function setVisibility(hidden) {
    documentObject.hidden = hidden;
    documentObject.visibilityState = hidden ? 'hidden' : 'visible';
    documentObject.dispatchEvent(new MiniEvent('visibilitychange'));
    if (hidden) root.dispatchEvent(new MiniEvent('blur'));
  }
  wx.onHide(function () { setVisibility(true); });
  wx.onShow(function () { setVisibility(false); });
  if (typeof wx.onWindowResize === 'function') {
    wx.onWindowResize(function () {
      updateViewport();
      root.dispatchEvent(new MiniEvent('resize'));
    });
  }
  if (typeof wx.onNetworkStatusChange === 'function') {
    wx.onNetworkStatusChange(function (result) {
      root.navigator.onLine = !!result.isConnected;
      root.dispatchEvent(new MiniEvent(result.isConnected ? 'online' : 'offline'));
    });
  }
  if (typeof wx.onError === 'function') {
    wx.onError(function (message) {
      root.dispatchEvent(new MiniEvent('error', { message: String(message), filename: '', lineno: 0, colno: 0 }));
    });
  }
  if (typeof wx.onUnhandledRejection === 'function') {
    wx.onUnhandledRejection(function (event) {
      root.dispatchEvent(new MiniEvent('unhandledrejection', { reason: event && event.reason }));
    });
  }

  root.__wxPromptLevelCode = function (onSubmit) {
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

  root.AndroidLogExporter = {
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

  root.__SMART_EGG_WECHAT_BRIDGE__ = {
    version: 160,
    screenCanvas,
    gameCanvas,
    getDisplayRect: function () { return Object.assign({}, displayRect); },
    presentFrame,
    updateViewport
  };
})();
