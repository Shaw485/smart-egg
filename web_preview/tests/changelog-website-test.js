'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const index = fs.readFileSync(path.join(root, 'web_preview/index.html'), 'utf8');
const style = fs.readFileSync(path.join(root, 'web_preview/style.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'web_preview/changelog.js'), 'utf8');
const notebook = fs.readFileSync(path.join(root, '改动记事本.md'), 'utf8');

assert.match(index, /id="changelog-open"[^>]*>改动记录<\/button>/);
assert.match(index, /id="changelog-open"[^>]*aria-controls="changelog-dialog"[^>]*aria-expanded="false"/);
assert.match(index, /id="changelog-dialog"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(index, /id="changelog-search"[^>]*type="search"/);
assert.match(index, /changelog\.js\?v=188/);
assert.ok(index.indexOf('game.js?v=188') < index.indexOf('changelog.js?v=188'),
  '改动记录入口应在游戏运行时之后初始化，以便仅在首页显示');

assert.match(style, /\.changelog-dialog\s*\{/);
assert.match(style, /body\.android-app \.changelog-open/);
assert.match(style, /@media \(max-width: 760px\), \(max-height: 620px\)/);

assert.match(script, /const SOURCE_PATH = '\.\.\/改动记事本\.md'/);
assert.match(script, /fetch\(source\.href, \{ cache:'no-store' \}\)/);
assert.match(script, /module: 'website:changelog'/);
assert.match(script, /const DIAGNOSTIC_LIMIT = 100/);
assert.match(script, /'load-success'/);
assert.match(script, /'load-failed'/);
assert.match(script, /window\.__SMART_EGG_CHANGELOG__/);
assert.match(script, /!window\.__wxMiniGame/);
assert.match(script, /function isEligibleWebMenu\(\)/);
assert.match(script, /'dialog-open-blocked'/);
assert.match(script, /openButton\.addEventListener\('keydown', stopGameKeyboard\)/);
assert.match(script, /dialog\.addEventListener\('keydown'/);
assert.match(script, /queryLength:query\.length/);
assert.doesNotMatch(script, /__SMART_EGG_CHANGELOG_DIAGNOSTICS__/,
  '不能暴露可被外部改写的诊断原数组');
assert.doesNotMatch(script, /context:\s*\{[^}]*query:/s,
  '搜索诊断只能记录长度和结果数，不能保存用户输入的原文');

assert.match(notebook, /^## 网站改动记录同步 — 2026-09-01/m);
assert.match(notebook, /^## Web \/ 微信小游戏 v188/m);
assert.ok(notebook.indexOf('## Web / 微信小游戏 v188') < notebook.indexOf('## Web / 微信小游戏 v187'),
  'v188 正式记录必须排在 v187 之前');
assert.ok(notebook.indexOf('## 网站改动记录同步') < notebook.indexOf('## Web / 微信小游戏 v186'),
  '网站同步功能本身也必须出现在网站读取的最新记录中');
assert.ok(notebook.indexOf('## Web / 微信小游戏 v186') < notebook.indexOf('## Web / 微信小游戏 v185'),
  '网站读取的源记录必须保持最新版本在前');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor() {
    this.hidden = true;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.disabled = false;
    this.classList = new FakeClassList();
    this.listeners = {};
    this.attributes = {};
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  focus() {}
}

async function runBehaviorTest() {
  const ids = [
    'changelog-open', 'changelog-dialog', 'changelog-close', 'changelog-refresh',
    'changelog-search', 'changelog-status', 'changelog-content'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement()]));
  const body = { classList:new FakeClassList() };
  const documentListeners = {};
  const document = {
    body,
    getElementById(id) { return elements[id] || null; },
    addEventListener(type, listener) { documentListeners[type] = listener; }
  };
  const window = {
    location:{ href:'http://127.0.0.1:8765/web_preview/' },
    __debug:{ getState:() => 'menu' },
    setInterval() { return 1; }
  };
  const markdown = '# 测试记录\n\n## 最新版本\n\n- **完成**\n- <script>danger()</script>\n\n## 旧版本\n\n- 历史';
  let fetchCalls = 0;
  const context = {
    window,
    document,
    URL,
    Date,
    console:{ info() {}, error() {} },
    performance:{ now:() => 1 },
    setTimeout(callback) { callback(); },
    fetch:async () => {
      fetchCalls += 1;
      return { ok:true, text:async () => markdown };
    }
  };

  vm.runInNewContext(script, context, { filename:'changelog.js' });
  const api = window.__SMART_EGG_CHANGELOG__;
  assert.ok(api, '应向网页调试环境暴露独立改动记录接口');
  await api.refresh();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(api.getState())), { loaded:true, releases:2, open:false });
  assert.match(elements['changelog-content'].innerHTML, /<strong>完成<\/strong>/);
  assert.match(elements['changelog-content'].innerHTML, /&lt;script&gt;danger\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(elements['changelog-content'].innerHTML, /<script>/);
  assert.strictEqual(api.diagnostics.find('load-success').length, 1);

  const stopped = { count:0 };
  elements['changelog-open'].listeners.keydown({ stopPropagation() { stopped.count += 1; } });
  elements['changelog-open'].listeners.keyup({ stopPropagation() { stopped.count += 1; } });
  assert.strictEqual(stopped.count, 2, '入口的键盘事件必须在到达游戏全局快捷键前停止冒泡');

  elements['changelog-search'].value = '不存在';
  elements['changelog-search'].listeners.input();
  assert.match(elements['changelog-content'].innerHTML, /没有找到匹配的改动记录/);

  const fetchesBeforeBlockedOpen = fetchCalls;
  window.__debug.getState = () => 'levelSelect';
  elements['changelog-open'].listeners.click();
  assert.strictEqual(elements['changelog-dialog'].hidden, true, '离开首页后即使程序化点击也不能打开');
  body.classList.add('android-app');
  window.__debug.getState = () => 'menu';
  elements['changelog-open'].listeners.click();
  window.__wxMiniGame = true;
  body.classList.remove('android-app');
  elements['changelog-open'].listeners.click();
  assert.strictEqual(fetchCalls, fetchesBeforeBlockedOpen, 'Android、微信或非首页状态不能请求网页改动记录');
  window.__wxMiniGame = false;
  window.__debug.getState = () => 'menu';

  context.fetch = async () => { throw new Error('simulated offline'); };
  await api.refresh();
  assert.strictEqual(api.getState().loaded, false);
  assert.strictEqual(api.diagnostics.find('load-failed').length, 1);
  assert.ok(elements['changelog-status'].classList.contains('is-error'));
  assert.ok(api.diagnostics.list().every(entry => entry.module === 'website:changelog'));
  assert.strictEqual(api.diagnostics.maxEntries, 100);
  const diagnosticSnapshot = api.diagnostics.list();
  diagnosticSnapshot[0].event = 'tampered';
  diagnosticSnapshot[0].context.injected = true;
  assert.notStrictEqual(api.diagnostics.list()[0].event, 'tampered', '诊断快照不能修改内部事件');
  assert.strictEqual(api.diagnostics.list()[0].context.injected, undefined, '诊断快照上下文也必须是副本');

  let releaseDeferred;
  fetchCalls = 0;
  context.fetch = () => {
    fetchCalls += 1;
    return new Promise(resolve => { releaseDeferred = () => resolve({ ok:true, text:async () => markdown }); });
  };
  const firstRefresh = api.refresh();
  const secondRefresh = api.refresh();
  assert.strictEqual(fetchCalls, 1, '加载中重复刷新必须复用同一个请求');
  releaseDeferred();
  await Promise.all([firstRefresh, secondRefresh]);

  context.fetch = async () => ({ ok:true, text:async () => markdown });
  for (let index = 0; index < 105; index += 1) await api.refresh();
  assert.strictEqual(api.diagnostics.list().length, 100, '诊断环形缓冲必须严格限制为100条');
}

runBehaviorTest().then(() => {
  console.log('网站改动记录测试通过：入口仅在网页首页显示，内容来自单一改动记事本；加载、搜索、安全转义、刷新及独立诊断均已实际验证。');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
