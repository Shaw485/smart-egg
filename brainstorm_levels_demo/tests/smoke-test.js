'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const loggerSource = fs.readFileSync(path.join(root, 'logger.js'), 'utf8');

assert.match(html, /logger\.js\?v=9/);
assert.match(html, /game\.js\?v=9/);
assert.match(game, /id: 8, title: '日影无声', mechanic: 'shadow'/);
assert.match(game, /id: 9, title: '等风来', mechanic: 'stillness'/);
assert.match(game, /id: 10, title: '纸上有路', mechanic: 'word_bridge'/);
assert.match(game, /id: 11, title: '痕迹未散', mechanic: 'persistent_reset'/);
assert.match(game, /id: 12, title: '远方未远', mechanic: 'drag_world'/);
assert.match(game, /heldKeys\.has\('KeyA'\)/);
assert.match(game, /heldKeys\.has\('KeyD'\)/);
assert.match(game, /heldKeys\.has\('Space'\)/);
assert.match(game, /cameraX/);
assert.match(game, /Math\.max\(55, player\.x\)/);
assert.match(game, /landingCandidates\.reduce/);
assert.match(game, /连续点击顶部重来按钮两次，让三只箱子依次留下形成楼梯/);
assert.match(game, /function enterLevel[\s\S]*hintVisible = false/);
assert.doesNotMatch(game, /远处安静得看不见尽头/);
assert.match(game, /if \(level\.mechanic !== 'shadow'\)/);
assert.match(game, /state\.shadowTipX \+ 34, GROUND_Y - 28/);
assert.match(game, /纯线条问号/);
assert.match(game, /ctx\.bezierCurveTo\(qx \+ 20/);
assert.match(game, /明确的手绘回转箭头/);
assert.match(game, /-Math\.PI \* \.35, Math\.PI \* 1\.25/);
assert.match(game, /ctx\.moveTo\(rx - 16, ry - 15\)/);
assert.match(game, /sunX: 100/);
assert.match(game, /sunMoved: false/);
assert.match(game, /state\.sunMoved && Math\.abs\(state\.shadowTipX - 820\) < 78/);
assert.match(game, /sun-drag-armed/);
assert.match(game, /pause: \{ x: 505, y: 40/);
assert.match(game, /function drawPause\(\)/);
assert.match(game, /回到主线选关/);
assert.match(game, /screen=levelSelect/);
assert.match(game, /mainline=v169/);
assert.match(game, /pause-return-mainline-selection/);
assert.match(game, /hint-auto-close-for-gesture/);
assert.match(game, /requestedLevelId/);
assert.match(game, /'startup-query'/);
assert.match(game, /dropZone = \{ x: 630, y: 460, w: 640, h: 390 \}/);
assert.match(game, /x: 720, y: GROUND_Y, w: 460, h: 55, word: true/);
assert.doesNotMatch(game, /point\.y > 560 && point\.y < 790/);
assert.match(game, /拖动天空中的太阳，让人物的影子压住地面机关/);
assert.match(game, /松开所有方向和跳跃按键，原地不动约 2 秒/);
assert.doesNotMatch(game, /side-selector/);
assert.doesNotMatch(game, /roundedRect\(1740, y, 92, 58/);

const sandbox = {
  console: { info() {}, warn() {}, error() {} },
  performance: { now: () => 12 },
  module: { exports: {} },
  exports: {},
  globalThis: null
};
sandbox.globalThis = sandbox;
vm.runInNewContext(loggerSource, sandbox, { filename: 'logger.js' });
const DemoLogger = sandbox.module.exports.DemoLogger;
const logger = new DemoLogger({ version: 9, maxEntries: 100, minLevel: 'info' });
logger.setModule('input', true);
logger.log('input', 'key-down', { code: 'KeyA', token: 'must-not-leak' });
assert.strictEqual(logger.entries.length, 1);
assert.strictEqual(logger.entries[0].context.token, '[redacted]');
logger.setModule('input', false);
logger.log('input', 'key-up', { code: 'KeyA' });
assert.strictEqual(logger.entries.length, 1);

console.log('第8–12关试玩冒烟测试通过：暂停返回主线、第8关拖太阳及第10关齐平文字桥均已覆盖。');
