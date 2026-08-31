'use strict';

/*
 * 怪奇之原微信小游戏兼容层 v185
 *
 * 游戏本体以 1080 高的逻辑 Canvas 绘制；微信宽屏会横向扩展地图而不拉伸元素。本文件把微信小游戏的
 * Canvas、触摸、存储、音频、生命周期、键盘和日志文件接口映射成游戏
 * 本体原来使用的浏览器接口。现有网页与 Android 版本不需要改动。
 */
(function installWechatAdapter() {
  if (typeof wx === 'undefined') {
    throw new Error('wechat-adapter.js 必须在微信小游戏环境中运行');
  }

  const gameGlobal = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
  const CREATOR_MODE_ENABLED = false;

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

  const ADAPTER_LOG_MAX = 200;
  const ADAPTER_LOG_SESSION_ID = 'se-wx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const ADAPTER_LOG_STARTED_AT = new Date().toISOString();
  const ADAPTER_FAULT_KEY = 'smart_egg_adapter_last_fault_v1';
  let adapterLogSequence = 0;
  const adapterDiagnostics = [];
  const adapterFaultJournal = { lastFault:null };
  try {
    const storedAdapterFault = wx.getStorageSync(ADAPTER_FAULT_KEY);
    if (storedAdapterFault) adapterFaultJournal.lastFault = JSON.parse(String(storedAdapterFault));
  } catch (_) {}
  const adapterLogModules = new Map([
    ['runtime', true], ['viewport', true], ['feature', true], ['input', false],
    ['audio-core', true], ['audio', false], ['storage', true], ['network', true], ['export', true]
  ]);
  function mapEntriesToObject(map) {
    const out = {};
    map.forEach(function (value, key) { out[key] = value; });
    return out;
  }
  function isSensitiveAdapterKey(key) {
    const normalized = String(key || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    return /(password|passphrase|secret|token|authorization|cookie|privatekey|apikey|clientsecret|appsecret)/.test(normalized);
  }
  function redactAdapterString(value) {
    return String(value)
      .replace(/-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/gi, '[REDACTED_PEM]')
      .replace(/((?:authorization|cookie)\s*[:=]\s*)(?:Basic|Bearer)?\s*[^\r\n]+/gi, '$1[REDACTED]')
      .replace(/((?:"|'|\b)?(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|password|passphrase|secret|app[_-]?secret|client[_-]?secret|api[_-]?key|private[_-]?key)(?:"|'|\b)?\s*[:=]\s*["']?)[^"'&,}\s]+/gi, '$1[REDACTED]')
      .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]');
  }
  function redactAdapterContext(value, depth) {
    const level = depth || 0;
    if (level > 5) return '[depth-limited]';
    if (Array.isArray(value)) return value.slice(0, 100).map(function (item) { return redactAdapterContext(item, level + 1); });
    if (typeof value === 'string') return redactAdapterString(value);
    if (!value || typeof value !== 'object') return value;
    const clean = {};
    Object.keys(value).forEach(function (key) {
      clean[key] = isSensitiveAdapterKey(key) ? '[REDACTED]' : redactAdapterContext(value[key], level + 1);
    });
    return clean;
  }
  function adapterLog(moduleName, eventName, context, level) {
    const normalizedModule = String(moduleName || 'runtime');
    if (adapterLogModules.get(normalizedModule) === false) return null;
    const entry = {
      seq: ++adapterLogSequence,
      at: new Date().toISOString(),
      sessionId: ADAPTER_LOG_SESSION_ID,
      module: 'wechat-adapter:' + normalizedModule,
      level: level || 'info',
      event: String(eventName || 'event'),
      context: redactAdapterContext(context || {}, 0)
    };
    adapterDiagnostics.push(entry);
    if (adapterDiagnostics.length > ADAPTER_LOG_MAX) adapterDiagnostics.shift();
    if (normalizedModule === 'audio-core' && entry.level === 'error') {
      adapterFaultJournal.lastFault = entry;
      try { wx.setStorageSync(ADAPTER_FAULT_KEY, JSON.stringify(entry)); } catch (_) {}
    }
    if (entry.level === 'error') console.error('[wechat-adapter]', JSON.stringify(entry));
    return entry;
  }
  installOwnProperty(browserWindow, '__SMART_EGG_ADAPTER_DIAGNOSTICS__', adapterDiagnostics);
  installOwnProperty(browserWindow, '__SMART_EGG_ADAPTER_FAULT_JOURNAL__', adapterFaultJournal);
  installOwnProperty(browserWindow, '__SMART_EGG_ADAPTER_LOG_CONFIG__', {
    maxEntries: ADAPTER_LOG_MAX,
    productionVerbose: false,
    sessionId: ADAPTER_LOG_SESSION_ID,
    startedAt: ADAPTER_LOG_STARTED_AT,
    getModules: function () { return mapEntriesToObject(adapterLogModules); },
    setModule: function (moduleName, enabled) {
      const normalizedModule = String(moduleName || 'runtime');
      if (!adapterLogModules.has(normalizedModule)) return { module:normalizedModule, enabled:false, known:false };
      adapterLogModules.set(normalizedModule, !!enabled);
      return { module:normalizedModule, enabled:!!enabled, known:true };
    },
    find: function (moduleName, keyword) {
      const moduleFilter = moduleName ? 'wechat-adapter:' + String(moduleName) : '';
      const query = String(keyword || '').toLowerCase();
      return adapterDiagnostics.filter(function (entry) {
        if (moduleFilter && entry.module !== moduleFilter) return false;
        if (!query) return true;
        return entry.event.toLowerCase().indexOf(query) >= 0
          || JSON.stringify(entry.context || {}).toLowerCase().indexOf(query) >= 0;
      });
    },
    redact: function (context) { return redactAdapterContext(context, 0); }
  });
  adapterLog('runtime', 'adapter-session-start', {
    version: 185,
    creatorMode: CREATOR_MODE_ENABLED,
    retention: { type: 'memory-ring', maxEntries: ADAPTER_LOG_MAX },
    productionDefaults: mapEntriesToObject(adapterLogModules)
  });

  const screenCanvas = wx.createCanvas();
  const screenContext = screenCanvas.getContext('2d');
  const gameCanvas = wx.createCanvas();
  createEventTarget(gameCanvas);
  gameCanvas.style = gameCanvas.style || {};

  let windowInfo = {};
  let viewportDpr = 1;
  let displayRect = { left: 0, top: 0, width: 1, height: 1, right: 1, bottom: 1 };
  const VIEWPORT_BASE_WIDTH = 1920;
  const VIEWPORT_LOGICAL_HEIGHT = 1080;
  const VIEWPORT_MAX_WIDTH = 2880;
  let logicalViewport = null;

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
    const safeAspect = safeWidth / safeHeight;
    if (!logicalViewport) {
      const requestedWidth = Math.round(VIEWPORT_LOGICAL_HEIGHT * safeAspect);
      const logicalWidth = Math.max(VIEWPORT_BASE_WIDTH, Math.min(VIEWPORT_MAX_WIDTH, requestedWidth));
      logicalViewport = {
        schemaVersion: 1,
        strategy: 'extend-horizontal-v1',
        baseWidth: VIEWPORT_BASE_WIDTH,
        logicalWidth,
        logicalHeight: VIEWPORT_LOGICAL_HEIGHT,
        sidePad: Math.max(0, (logicalWidth - VIEWPORT_BASE_WIDTH) / 2),
        requestedWidth,
        aspectMode: requestedWidth < VIEWPORT_BASE_WIDTH
          ? 'narrow-contain'
          : (requestedWidth > VIEWPORT_MAX_WIDTH ? 'ultrawide-edge-extension' : 'horizontal-map-extension')
      };
    }
    const scale = Math.min(
      safeWidth / logicalViewport.logicalWidth,
      safeHeight / logicalViewport.logicalHeight
    );
    const drawWidth = logicalViewport.logicalWidth * scale;
    const drawHeight = logicalViewport.logicalHeight * scale;
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
    const viewportSnapshot = Object.assign({}, logicalViewport, {
      window: { width, height, dpr },
      safeArea: { left:safeLeft, top:safeTop, width:safeWidth, height:safeHeight },
      safeAspect:Number(safeAspect.toFixed(5)),
      displayRect: { left, top, width:drawWidth, height:drawHeight },
      gutters: {
        left:Math.max(0, left), right:Math.max(0, width-left-drawWidth),
        top:Math.max(0, top), bottom:Math.max(0, height-top-drawHeight)
      }
    });
    installOwnProperty(root, '__SMART_EGG_VIEWPORT__', viewportSnapshot);
    installOwnProperty(browserWindow, '__SMART_EGG_VIEWPORT__', viewportSnapshot);
    adapterLog('viewport', 'viewport-updated', {
      width, height, dpr,
      safeArea: { left:safeLeft, top:safeTop, width:safeWidth, height:safeHeight },
      safeAspect:Number(safeAspect.toFixed(5)),
      logicalWidth:logicalViewport.logicalWidth,
      logicalHeight:logicalViewport.logicalHeight,
      sidePad:logicalViewport.sidePad,
      aspectMode:logicalViewport.aspectMode,
      displayRect: { left, top, width:drawWidth, height:drawHeight },
      gutters:viewportSnapshot.gutters
    });
  }

  gameCanvas.getBoundingClientRect = function () {
    return Object.assign({}, displayRect, { x: displayRect.left, y: displayRect.top });
  };

  function presentFrame() {
    const dpr = viewportDpr;
    const destLeft = Math.round(displayRect.left * dpr);
    const destTop = Math.round(displayRect.top * dpr);
    const destWidth = Math.round(displayRect.width * dpr);
    const destHeight = Math.round(displayRect.height * dpr);
    const destRight = destLeft + destWidth;
    screenContext.setTransform(1, 0, 0, 1, 0, 0);
    // 真正超宽或安全区外侧只保留柔和的深青灰底；再把游戏画面的边缘像素向外延展，
    // 避免纯黑硬切。主画面本身仍按同一比例绘制，绝不横向拉伸。
    screenContext.fillStyle = '#2b3d42';
    screenContext.fillRect(0, 0, screenCanvas.width, screenCanvas.height);
    if (gameCanvas.width > 0 && gameCanvas.height > 0 && destHeight > 0) {
      if (destLeft > 0) {
        screenContext.drawImage(gameCanvas, 0, 0, Math.min(4, gameCanvas.width), gameCanvas.height,
          0, destTop, destLeft, destHeight);
        const leftFade = screenContext.createLinearGradient(0, 0, destLeft, 0);
        leftFade.addColorStop(0, 'rgba(30,45,50,.78)');
        leftFade.addColorStop(1, 'rgba(30,45,50,0)');
        screenContext.fillStyle = leftFade;
        screenContext.fillRect(0, destTop, destLeft, destHeight);
      }
      if (destRight < screenCanvas.width) {
        screenContext.drawImage(gameCanvas, Math.max(0, gameCanvas.width - 4), 0,
          Math.min(4, gameCanvas.width), gameCanvas.height,
          destRight, destTop, screenCanvas.width - destRight, destHeight);
        const rightFade = screenContext.createLinearGradient(destRight, 0, screenCanvas.width, 0);
        rightFade.addColorStop(0, 'rgba(30,45,50,0)');
        rightFade.addColorStop(1, 'rgba(30,45,50,.78)');
        screenContext.fillStyle = rightFade;
        screenContext.fillRect(destRight, destTop, screenCanvas.width - destRight, destHeight);
      }
    }
    screenContext.drawImage(
      gameCanvas,
      0, 0, gameCanvas.width, gameCanvas.height,
      destLeft, destTop, destWidth, destHeight
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

  function storageKeyForLog(key) {
    const normalized = String(key);
    return isSensitiveAdapterKey(normalized) ? '[REDACTED_KEY]' : normalized.slice(0, 120);
  }
  const localStorageObject = {
    getItem: function (key) {
      try {
        const value = wx.getStorageSync(String(key));
        const normalized = value === '' || typeof value === 'undefined' ? null : String(value);
        adapterLog('storage', 'read', {
          key: storageKeyForLog(key), found: normalized !== null, bytes: normalized === null ? 0 : normalized.length
        });
        return normalized;
      } catch (error) {
        adapterLog('storage', 'read-failed', {
          key: storageKeyForLog(key), message: String(error && error.message || error)
        }, 'error');
        return null;
      }
    },
    setItem: function (key, value) {
      const normalizedValue = String(value);
      try {
        wx.setStorageSync(String(key), normalizedValue);
        adapterLog('storage', 'write-success', { key: storageKeyForLog(key), bytes: normalizedValue.length });
      } catch (error) {
        adapterLog('storage', 'write-failed', {
          key: storageKeyForLog(key), bytes: normalizedValue.length, message: String(error && error.message || error)
        }, 'error');
        throw error;
      }
    },
    removeItem: function (key) {
      try {
        wx.removeStorageSync(String(key));
        adapterLog('storage', 'remove-success', { key: storageKeyForLog(key) });
      } catch (error) {
        adapterLog('storage', 'remove-failed', {
          key: storageKeyForLog(key), message: String(error && error.message || error)
        }, 'error');
        throw error;
      }
    },
    clear: function () {
      try {
        wx.clearStorageSync();
        adapterLog('storage', 'clear-success', {});
      } catch (error) {
        adapterLog('storage', 'clear-failed', { message: String(error && error.message || error) }, 'error');
        throw error;
      }
    },
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

  function logAudioFailure(eventName, context, level) {
    const normalizedLevel = level || 'error';
    adapterLog('audio-core', eventName, context, normalizedLevel);
  }

  function initializeInnerAudioOptions() {
    const requested = { obeyMuteSwitch:false, mixWithOther:true };
    if (typeof wx.setInnerAudioOption !== 'function') {
      logAudioFailure('inner-audio-option-unavailable', {
        requested,
        reason:'setInnerAudioOption-api-unavailable'
      }, 'warn');
      return;
    }
    let settled = false;
    function succeed() {
      if (settled) return;
      settled = true;
      adapterLog('audio-core', 'inner-audio-option-ready', requested);
      adapterLog('audio', 'inner-audio-option-ready', requested);
    }
    function fail(error) {
      if (settled) return;
      settled = true;
      const message = String(error && (error.errMsg || error.message) || error);
      const devtoolsUnsupported = /开发者工具暂时不支持|devtools.*not support/i.test(message);
      logAudioFailure('inner-audio-option-failed', {
        requested,
        message,
        expectedOnDevtools:devtoolsUnsupported
      }, devtoolsUnsupported ? 'warn' : 'error');
    }
    try {
      const result = wx.setInnerAudioOption({
        obeyMuteSwitch:requested.obeyMuteSwitch,
        mixWithOther:requested.mixWithOther,
        success:succeed,
        fail:fail
      });
      if (result && typeof result.then === 'function') result.then(succeed).catch(fail);
    } catch (error) {
      fail(error);
    }
  }
  initializeInnerAudioOptions();

  function FallbackAudioContext() {
    this.state = 'running';
    this.destination = {};
  }
  Object.defineProperty(FallbackAudioContext.prototype, 'currentTime', {
    get: function () { return Date.now() / 1000; }
  });
  FallbackAudioContext.prototype.resume = function () {
    this.state = 'running';
    adapterLog('audio', 'context-resumed', { implementation:'inner-audio-fallback' });
    return Promise.resolve();
  };
  FallbackAudioContext.prototype.suspend = function () {
    this.state = 'suspended';
    adapterLog('audio', 'context-suspended', { implementation:'inner-audio-fallback' });
    return Promise.resolve();
  };
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
        if (context.state !== 'running') {
          adapterLog('audio', 'tone-skipped', { reason:'context-not-running', state:context.state });
          adapterLog('audio-core', 'tone-skipped', { reason:'context-not-running', state:context.state }, 'warn');
          return;
        }
        if (typeof wx.createInnerAudioContext !== 'function') {
          logAudioFailure('tone-skipped', { reason:'inner-audio-api-unavailable' });
          return;
        }
        const frequency = Math.max(55, this.frequency.peak || this.frequency.value || 440);
        const bases = [110, 440, 880];
        let base = bases[0];
        for (const candidate of bases) {
          if (Math.abs(Math.log(frequency / candidate)) < Math.abs(Math.log(frequency / base))) base = candidate;
        }
        const delay = Math.max(0, (this._startAt - context.currentTime) * 1000);
        const duration = Math.max(40, ((Number(when) || this._startAt + 0.2) - this._startAt) * 1000);
        const gain = this._gain && this._gain.gain ? this._gain.gain.peak : 0.05;
        adapterLog('audio', 'tone-scheduled', {
          frequency:Math.round(frequency), base, delayMs:Math.round(delay), durationMs:Math.round(duration), gain:Number(gain.toFixed(4))
        });
        setTimeout(function () {
          const asset = 'assets/tone-' + base + '.wav';
          let audio = null;
          let playRequested = false;
          let playbackConfirmed = false;
          let destroyed = false;
          let cleanupTimer = 0;
          let loadWatchdog = 0;
          let supportsOnPlay = false;
          function clearTimer(timer) {
            if (timer) clearTimeout(timer);
          }
          function cleanup(reason, stopFirst) {
            if (destroyed) return;
            destroyed = true;
            clearTimer(cleanupTimer);
            clearTimer(loadWatchdog);
            function cleanupStep(method, args) {
              if (!audio || typeof audio[method] !== 'function') return;
              try {
                audio[method].apply(audio, args || []);
              } catch (error) {
                logAudioFailure('tone-cleanup-failed', {
                  asset, reason, playbackConfirmed, stage:method,
                  message:String(error && (error.errMsg || error.message) || error)
                });
              }
            }
            cleanupStep('offCanplay', [handleCanplay]);
            cleanupStep('offPlay', [handlePlay]);
            cleanupStep('offEnded', [handleEnded]);
            cleanupStep('offStop', [handleStop]);
            cleanupStep('offError', [handleError]);
            if (stopFirst && playbackConfirmed) cleanupStep('stop');
            cleanupStep('destroy');
            adapterLog('audio', 'tone-destroyed', { asset, reason, playbackConfirmed });
          }
          function scheduleCleanup() {
            if (destroyed || cleanupTimer) return;
            cleanupTimer = setTimeout(function () {
              cleanup('duration-elapsed', true);
            }, duration + 80);
          }
          function handlePlay() {
            if (destroyed || playbackConfirmed) return;
            try {
              playbackConfirmed = true;
              clearTimer(loadWatchdog);
              loadWatchdog = 0;
              const playbackRate = Number(audio && audio.playbackRate);
              adapterLog('audio', 'tone-play', {
                asset,
                playbackRate:Number.isFinite(playbackRate) ? Number(playbackRate.toFixed(3)) : null
              });
              scheduleCleanup();
            } catch (error) {
              logAudioFailure('tone-playback-handler-failed', {
                asset,
                message:String(error && (error.errMsg || error.message) || error)
              });
              cleanup('playback-handler-failed', false);
            }
          }
          function handleCanplay() {
            if (destroyed || playRequested) return;
            playRequested = true;
            try {
              audio.play();
              adapterLog('audio', 'tone-play-requested', { asset });
              if (!supportsOnPlay) handlePlay();
            } catch (error) {
              logAudioFailure('tone-play-failed', {
                asset, stage:'play-call',
                message:String(error && (error.errMsg || error.message) || error)
              });
              cleanup('play-call-failed', false);
            }
          }
          function handleEnded() {
            cleanup('ended', false);
          }
          function handleStop() {
            cleanup('stopped', false);
          }
          function handleError(error) {
            logAudioFailure('tone-failed', {
              asset,
              stage:playbackConfirmed ? 'playback' : (playRequested ? 'play-request' : 'load'),
              message:String(error && (error.errMsg || error.message) || error)
            });
            cleanup('error', false);
          }
          try {
            audio = wx.createInnerAudioContext({ useWebAudioImplement:false });
            if (!audio) throw new Error('createInnerAudioContext returned no context');
            audio.autoplay = false;
            audio.loop = false;
            // 兼容旧基础库；新基础库以 setInnerAudioOption 的全局配置为准。
            audio.obeyMuteSwitch = false;
            audio.volume = Math.max(0, Math.min(1, gain * 2.2));
            audio.playbackRate = Math.max(0.5, Math.min(2, frequency / base));
            // 必须先注册事件，再设置 src；本地资源可能很快进入 canplay。
            if (typeof audio.onCanplay === 'function') audio.onCanplay(handleCanplay);
            supportsOnPlay = typeof audio.onPlay === 'function';
            if (supportsOnPlay) audio.onPlay(handlePlay);
            if (typeof audio.onEnded === 'function') audio.onEnded(handleEnded);
            if (typeof audio.onStop === 'function') audio.onStop(handleStop);
            if (typeof audio.onError === 'function') audio.onError(handleError);
            loadWatchdog = setTimeout(function () {
              if (destroyed || playbackConfirmed) return;
              logAudioFailure('tone-load-timeout', {
                asset, timeoutMs:10000, playRequested
              });
              cleanup('load-timeout', false);
            }, 10000);
            audio.src = asset;
            if (typeof audio.onCanplay !== 'function') handleCanplay();
          } catch (error) {
            logAudioFailure('tone-create-failed', {
              asset,
              message:String(error && (error.errMsg || error.message) || error)
            });
            cleanup('create-failed', false);
          }
        }, delay);
      }
    };
  };

  function WechatAudioContext() {
    const context = { implementation:'inner-audio-fallback', webAudioBypassed:true };
    adapterLog('audio-core', 'context-created', context);
    adapterLog('audio', 'context-created', context);
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
  // 只有在真实游戏显示区域内开始的手指，才属于游戏输入。手指开始后即使移出画面，
  // 仍继续转发 move/end/cancel，确保方向键和按住机制一定能收到松手，不会卡住。
  const forwardedTouchIds = new Set();
  function touchInsideDisplay(touch) {
    return Number.isFinite(Number(touch.clientX)) && Number.isFinite(Number(touch.clientY))
      && touch.clientX >= displayRect.left && touch.clientX <= displayRect.right
      && touch.clientY >= displayRect.top && touch.clientY <= displayRect.bottom;
  }
  function forwardTouch(type, nativeEvent) {
    const nativeTouches = Array.from(nativeEvent.touches || []).map(normalizeTouch);
    const nativeChangedTouches = Array.from(nativeEvent.changedTouches || nativeEvent.touches || []).map(normalizeTouch);
    const rejectedStarts = [];
    let changedTouches;
    if (type === 'touchstart') {
      changedTouches = nativeChangedTouches.filter(function (touch) {
        if (!touchInsideDisplay(touch)) {
          rejectedStarts.push({ id:touch.identifier, x:touch.clientX, y:touch.clientY });
          return false;
        }
        forwardedTouchIds.add(touch.identifier);
        return true;
      });
    } else {
      changedTouches = nativeChangedTouches.filter(function (touch) {
        return forwardedTouchIds.has(touch.identifier);
      });
    }
    const endingIds = new Set((type === 'touchend' || type === 'touchcancel')
      ? changedTouches.map(function (touch) { return touch.identifier; }) : []);
    const touches = nativeTouches.filter(function (touch) {
      return forwardedTouchIds.has(touch.identifier) && !endingIds.has(touch.identifier);
    });
    if (rejectedStarts.length) {
      adapterLog('viewport', 'touch-start-outside-display', {
        rejected:rejectedStarts.slice(0, 5),
        displayRect:{ left:displayRect.left, top:displayRect.top, right:displayRect.right, bottom:displayRect.bottom }
      });
    }
    // 事件只涉及安全区外的新手指时，不把它伪装成游戏触摸；已有的游戏手指保持原状态。
    if (!changedTouches.length) return;
    if (adapterLogModules.get('input') !== false) {
      adapterLog('input', type, {
        activeCount:touches.length,
        changed:changedTouches.slice(0, 5).map(function (touch) {
          return { id:touch.identifier, x:touch.clientX, y:touch.clientY };
        })
      });
    }
    const event = new MiniEvent(type, { touches, changedTouches, timeStamp: Date.now() });
    gameCanvas.dispatchEvent(event);
    if (type === 'touchstart') documentObject.dispatchEvent(new MiniEvent('pointerdown', { touches, changedTouches }));
    if (type === 'touchend' || type === 'touchcancel') {
      changedTouches.forEach(function (touch) { forwardedTouchIds.delete(touch.identifier); });
    }
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
    if (key === 'Shift') return 'ShiftLeft';
    if (key === ' ' || key === 'Spacebar' || key === 'Space') return 'Space';
    if (key === 'ArrowLeft' || key === 'Left') return 'ArrowLeft';
    if (key === 'ArrowRight' || key === 'Right') return 'ArrowRight';
    if (key === 'ArrowUp' || key === 'Up') return 'ArrowUp';
    const keyCode = Number(nativeEvent && (nativeEvent.keyCode || nativeEvent.which));
    return ({ 16: 'ShiftLeft', 32: 'Space', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 65: 'KeyA', 68: 'KeyD', 87: 'KeyW' })[keyCode] || '';
  }
  function keyboardKeyFromCode(code, nativeEvent) {
    if (nativeEvent && nativeEvent.key != null) return String(nativeEvent.key);
    return ({ KeyA: 'a', KeyD: 'd', KeyW: 'w', ShiftLeft: 'Shift', ShiftRight: 'Shift', Space: ' ', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp' })[code] || code;
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
    if (adapterLogModules.get('input') !== false) {
      adapterLog('input', 'keyboard-' + type, {
        code, repeat:event.repeat,
        modifiers:{ alt:event.altKey, ctrl:event.ctrlKey, meta:event.metaKey, shift:event.shiftKey }
      });
    }
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
    adapterLog('runtime', hidden ? 'app-hide' : 'app-show', { visibilityState:documentObject.visibilityState });
    documentObject.dispatchEvent(new MiniEvent('visibilitychange'));
    if (hidden) {
      forwardedTouchIds.clear();
      browserWindow.dispatchEvent(new MiniEvent('blur'));
    }
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
      adapterLog('network', 'status-change', {
        connected:navigatorObject.onLine, networkType:String(result.networkType || 'unknown')
      });
      browserWindow.dispatchEvent(new MiniEvent(result.isConnected ? 'online' : 'offline'));
    });
  }
  if (typeof wx.onError === 'function') {
    wx.onError(function (message) {
      adapterLog('runtime', 'host-error', { message:String(message) }, 'error');
      browserWindow.dispatchEvent(new MiniEvent('error', { message: String(message), filename: '', lineno: 0, colno: 0 }));
    });
  }
  if (typeof wx.onUnhandledRejection === 'function') {
    wx.onUnhandledRejection(function (event) {
      adapterLog('runtime', 'host-unhandled-rejection', {
        message:String(event && event.reason && (event.reason.message || event.reason) || 'unknown')
      }, 'error');
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
  if (CREATOR_MODE_ENABLED) {
    installOwnProperty(browserWindow, '__wxPromptLevelCode', promptLevelCode);
  } else {
    adapterLog('feature', 'creator-code-input-bridge-disabled', {
      enabled: false,
      clipboardReadRegistered: false,
      keyboardRegistered: false,
      localData: 'preserved'
    });
  }

  const androidLogExporter = {
    exportLog: function (filename, text) {
      const fs = wx.getFileSystemManager();
      const base = wx.env && wx.env.USER_DATA_PATH ? wx.env.USER_DATA_PATH : '';
      const path = base + '/' + String(filename).replace(/[\\/:*?"<>|]/g, '-');
      const sourceText = String(text);
      const bytes = sourceText.length;
      let mergeFailureLogged = false;
      function mergeCurrentAdapterLogs() {
        try {
          const report = JSON.parse(sourceText);
          if (report && report.format === 'smart-egg-diagnostic-log') {
            report.adapterLogs = adapterDiagnostics.slice();
            return JSON.stringify(report, null, 2);
          }
        } catch (error) {
          if (!mergeFailureLogged) {
            mergeFailureLogged = true;
            adapterLog('export', 'diagnostic-merge-skipped', {
              filename:filename, reason:'invalid-json', message:String(error && error.message || error)
            }, 'warn');
          }
        }
        return sourceText;
      }
      adapterLog('export', 'write-request', { filename: filename, bytes: bytes });
      function copyFallback(reason) {
        if (typeof wx.setClipboardData !== 'function') {
          adapterLog('export', 'clipboard-fallback-unavailable', { filename: filename, reason: reason }, 'error');
          return;
        }
        adapterLog('export', 'clipboard-fallback-start', { filename:filename, reason:reason });
        const clipboardText = mergeCurrentAdapterLogs();
        wx.setClipboardData({
          data: clipboardText,
          success: function () {
            adapterLog('export', 'clipboard-fallback-success', { filename: filename, bytes: clipboardText.length, reason: reason });
            wx.showToast({ title: '日志已复制', icon: 'success' });
          },
          fail: function (error) {
            adapterLog('export', 'clipboard-fallback-failed', {
              filename: filename,
              reason: reason,
              message: String(error && error.errMsg || error)
            }, 'error');
          }
        });
      }
      function shareOrFallback() {
        if (typeof wx.shareFileMessage === 'function') {
          wx.shareFileMessage({
            filePath: path,
            fileName: filename,
            success: function () { adapterLog('export', 'share-success', { filename: filename }); },
            fail: function (error) {
              adapterLog('export', 'share-failed', {
                filename: filename,
                message: String(error && error.errMsg || error)
              }, 'error');
              copyFallback('share-failed');
            }
          });
        } else {
          copyFallback('share-api-unavailable');
        }
      }
      const firstWriteText = mergeCurrentAdapterLogs();
      fs.writeFile({
        filePath: path,
        data: firstWriteText,
        encoding: 'utf8',
        success: function () {
          adapterLog('export', 'write-success', { filename: filename, bytes: bytes });
          const finalizedText = mergeCurrentAdapterLogs();
          fs.writeFile({
            filePath:path,
            data:finalizedText,
            encoding:'utf8',
            success:shareOrFallback,
            fail:function (error) {
              adapterLog('export', 'write-finalize-failed', {
                filename:filename, bytes:finalizedText.length, message:String(error && error.errMsg || error)
              }, 'error');
              shareOrFallback();
            }
          });
        },
        fail: function (error) {
          adapterLog('export', 'write-failed', {
            filename: filename,
            bytes: bytes,
            message: String(error && error.errMsg || error)
          }, 'error');
          copyFallback('write-failed');
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
    version: 185,
    screenCanvas,
    gameCanvas,
    getDisplayRect: function () { return Object.assign({}, displayRect); },
    getViewport: function () { return Object.assign({}, browserWindow.__SMART_EGG_VIEWPORT__ || {}); },
    clientToLogical: function (clientX, clientY) {
      if (!displayRect.width || !displayRect.height) return null;
      const x = (Number(clientX) - displayRect.left) * (logicalViewport.logicalWidth / displayRect.width);
      const y = (Number(clientY) - displayRect.top) * (logicalViewport.logicalHeight / displayRect.height);
      if (x < 0 || y < 0 || x > logicalViewport.logicalWidth || y > logicalViewport.logicalHeight) return null;
      return { x, y };
    },
    presentFrame,
    updateViewport
  };
  installOwnProperty(root, '__SMART_EGG_WECHAT_BRIDGE__', wechatBridge);
  installOwnProperty(browserWindow, '__SMART_EGG_WECHAT_BRIDGE__', wechatBridge);
  adapterLog('runtime', 'adapter-ready', {
    version:wechatBridge.version,
    displayRect:wechatBridge.getDisplayRect(),
    input:{ touch:true, keyboard:true },
    creatorMode:CREATOR_MODE_ENABLED
  });
})();
