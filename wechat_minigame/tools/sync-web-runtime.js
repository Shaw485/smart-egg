'use strict';

// 将网页正式主线确定性地同步为微信小游戏运行文件。
// 该脚本只复制同源逻辑，并注入必要的微信隔离窗口、内嵌关卡与键盘适配。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '../..');
const webGamePath = path.join(projectRoot, 'web_preview/game.js');
const wechatRoot = path.join(projectRoot, 'wechat_minigame');
const wechatAdapterPath = path.join(wechatRoot, 'js/wechat-adapter.js');
const checkOnly = process.argv.includes('--check');

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`同步锚点缺失：${label}`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`同步锚点不唯一：${label}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

const preamble = `    const _platformGlobal = typeof GameGlobal !== 'undefined' ? GameGlobal : globalThis;
    const _platformWindow = _platformGlobal.window || _platformGlobal;
    const _wechatEnv = _platformWindow.__SMART_EGG_WECHAT_ENV__ || _platformGlobal.__SMART_EGG_WECHAT_ENV__;
    const window = _wechatEnv ? _wechatEnv.window : _platformWindow;
    const document = _wechatEnv ? _wechatEnv.document : window.document;
    const location = _wechatEnv ? _wechatEnv.location : window.location;
    const navigator = _wechatEnv ? _wechatEnv.navigator : window.navigator;
    const localStorage = _wechatEnv ? _wechatEnv.localStorage : window.localStorage;
    const performance = _wechatEnv ? _wechatEnv.performance : window.performance;
    const fetch = _wechatEnv ? _wechatEnv.fetch : window.fetch.bind(window);
    const alert = _wechatEnv ? _wechatEnv.alert : window.alert.bind(window);
    const URLSearchParams = _wechatEnv ? _wechatEnv.URLSearchParams : window.URLSearchParams;
    const btoa = _wechatEnv ? _wechatEnv.btoa : window.btoa.bind(window);
    const atob = _wechatEnv ? _wechatEnv.atob : window.atob.bind(window);
    const TextEncoder = _wechatEnv ? _wechatEnv.TextEncoder : window.TextEncoder;
    const TextDecoder = _wechatEnv ? _wechatEnv.TextDecoder : window.TextDecoder;
    const requestAnimationFrame = _wechatEnv
        ? _wechatEnv.requestAnimationFrame
        : window.requestAnimationFrame.bind(window);
    const Event = _wechatEnv ? _wechatEnv.Event : window.Event;
    const KeyboardEvent = _wechatEnv ? _wechatEnv.KeyboardEvent : window.KeyboardEvent;
`;

let game = fs.readFileSync(webGamePath, 'utf8');
if (!/const GAME_CODE_VERSION = 187/.test(game)) throw new Error('网页主线不是预期的 v187，停止同步');
if (!/const CREATOR_MODE_ENABLED = false/.test(game)) throw new Error('创造秘境尚未下线，停止同步');
const wechatAdapter = fs.readFileSync(wechatAdapterPath, 'utf8');
if (!/const CREATOR_MODE_ENABLED = false/.test(wechatAdapter)) {
  throw new Error('微信适配层创造秘境开关未同步下线，停止同步');
}

game = replaceOnce(game, '(() => {\n    const canvas', `(() => {\n${preamble}    const canvas`, '微信隔离环境头部');
game = replaceOnce(game, 'window.location.reload(true);', 'location.reload(true);', '微信缓存刷新');
game = replaceOnce(
  game,
  'viewport: { width: innerWidth, height: innerHeight }',
  'viewport: { width: window.innerWidth, height: window.innerHeight }',
  '微信视口'
);
game = replaceOnce(
  game,
  "        if(!_codeDialog)return;\n        _codeDialog.hidden=false;_codeInput.value='';_codeError.textContent='';",
  "        if(window.__wxMiniGame&&typeof window.__wxPromptLevelCode==='function'){\n" +
    "            window.__wxPromptLevelCode(raw=>{\n" +
    "                _codeInput.value=String(raw||'');\n" +
    "                _submitCodeInput();\n" +
    "            });\n" +
    "            logStep('creator','share-code-input-open',{keyboard_focus:true,platform:'wechat-minigame'});\n" +
    "            return;\n" +
    "        }\n" +
    "        if(!_codeDialog)return;\n" +
    "        _codeDialog.hidden=false;_codeInput.value='';_codeError.textContent='';",
  '微信关卡码键盘'
);
game = replaceOnce(
  game,
  "            try {\n                const url = '../godot_project/levels/level_' + i + '.json?v=' + GAME_CODE_VERSION;",
  "            if (window.__wxMiniGame) {\n" +
    "                _cachedLevels[i] = _makeLevelFallback(i);\n" +
    "                logStep('level-load', 'probe-missing-inline-level', { idx:i, source:'wechat-package', available:false });\n" +
    "                continue;\n" +
    "            }\n" +
    "            try {\n                const url = '../godot_project/levels/level_' + i + '.json?v=' + GAME_CODE_VERSION;",
  '微信探测缺失关卡'
);
game = replaceOnce(
  game,
  "    async function loadLevelData() {\n        try {",
  "    async function loadLevelData() {\n" +
    "        if (window.__wxMiniGame && window.__SMART_EGG_LEVELS__ && window.__SMART_EGG_LEVELS__[0]) {\n" +
    "            levelData = JSON.parse(JSON.stringify(window.__SMART_EGG_LEVELS__[0]));\n" +
    "            logStep('level-load', 'loadLevelData-inline', { level:0, source:'levels.js' });\n" +
    "            return;\n" +
    "        }\n" +
    "        try {",
  '微信冷启动内嵌关卡'
);

const files = [
  { source: path.join(projectRoot, 'godot_project/levels/levels_bundle.js'), target: path.join(wechatRoot, 'js/levels.js') },
  { source: path.join(projectRoot, 'web_preview/physics-collision.js'), target: path.join(wechatRoot, 'js/physics-collision.js') },
  { source: path.join(projectRoot, 'web_preview/accepted-mechanics.js'), target: path.join(wechatRoot, 'js/accepted-mechanics.js') },
  { source: path.join(projectRoot, 'web_preview/assets/bgm-wilds-ambient.wav'), target: path.join(wechatRoot, 'assets/bgm-wilds-ambient.wav') }
];

const writes = [{ target:path.join(wechatRoot, 'js/smart-egg-game.js'), content:game }];
for (const file of files) writes.push({ target:file.target, content:fs.readFileSync(file.source) });

for (const file of writes) {
  const expected = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
  if (checkOnly) {
    if (!fs.existsSync(file.target)) throw new Error(`同步目标缺失：${path.relative(projectRoot, file.target)}`);
    const actual = fs.readFileSync(file.target);
    if (!actual.equals(expected)) throw new Error(`同步目标已落后：${path.relative(projectRoot, file.target)}`);
  } else {
    fs.mkdirSync(path.dirname(file.target), { recursive:true });
    fs.writeFileSync(file.target, expected);
  }
  const sha256 = crypto.createHash('sha256').update(expected).digest('hex');
  console.log(JSON.stringify({
    at:new Date().toISOString(), module:'wechat-sync', level:'info', event:checkOnly?'file-verified':'file-synced',
    file:path.relative(projectRoot, file.target), bytes:expected.length, sha256
  }));
}

console.log(JSON.stringify({
  at:new Date().toISOString(), module:'wechat-sync', level:'info', event:checkOnly?'sync-check-complete':'sync-complete',
  codeVersion:187, levels:20, creatorMode:false
}));
