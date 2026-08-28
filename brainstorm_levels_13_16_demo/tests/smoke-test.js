'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const loggerSource = fs.readFileSync(path.join(root, 'logger.js'), 'utf8');
const logic = require(path.join(root, 'logic.js'));

function functionBody(source, functionName, nextFunctionName) {
  const start = source.indexOf('function ' + functionName + '(');
  const end = nextFunctionName ? source.indexOf('function ' + nextFunctionName + '(', start + 1) : source.length;
  assert.notStrictEqual(start, -1, '缺少函数：' + functionName);
  assert.notStrictEqual(end, -1, '无法确定函数结束位置：' + functionName);
  return source.slice(start, end);
}

assert.match(html, /第13与15关试玩/);
assert.match(html, /aria-label="怪奇之原第13关与第15关独立试玩"/);
assert.match(html, /style\.css\?v=2/);
assert.match(html, /logger\.js\?v=2[\s\S]*logic\.js\?v=2[\s\S]*game\.js\?v=2/);
assert.doesNotMatch(html, /src="\.\.\//);
assert.doesNotMatch(html, /href="\.\.\//);
assert.doesNotMatch(html, /14|16/);
assert.doesNotMatch(readme, /\?level=14|\?level=16|mechanic:level14|mechanic:level16/);

assert.match(game, /id: 13,[\s\S]*title: '进退之间'[\s\S]*mechanic: 'dual_bridge'/);
assert.match(game, /id: 15,[\s\S]*title: '一笔成路'[\s\S]*mechanic: 'ink_path'/);
const levelRegistry = game.slice(game.indexOf('const LEVELS = ['), game.indexOf('\n  ];', game.indexOf('const LEVELS = [')) + 5);
const enabledLogModules = game.slice(game.indexOf('const logger ='), game.indexOf("logger.setModule('physics'"));
assert.doesNotMatch(levelRegistry, /id:\s*14\b|id:\s*16\b/);
assert.doesNotMatch(levelRegistry, /mechanic:\s*'spread_crack'|mechanic:\s*'fake_loading'/);
assert.doesNotMatch(enabledLogModules, /mechanic:level14|mechanic:level16/);
assert.match(game, /hintVisible = false/);
assert.match(game, /回到试验选关/);
assert.match(game, /返回主线选关/);
assert.match(game, /heldKeys\.has\('KeyA'\)/);
assert.match(game, /heldKeys\.has\('KeyD'\)/);
assert.match(game, /heldKeys\.has\('Space'\)/);
assert.match(game, /mechanic:level13/);
assert.match(game, /mechanic:level15/);
assert.match(game, /logger\.setModule\('physics', false\)/);
assert.match(game, /第 13、15 关独立体验/);
assert.match(game, /试玩 v2/);
assert.doesNotMatch(game, /第 13[–-]16 关独立体验|试玩 v1/);
assert.doesNotMatch(game, /localStorage|fetch\(|XMLHttpRequest|WebSocket/);

const level15Definition = game.match(/\{\s*id:\s*15,[\s\S]*?\n\s*\}/);
assert(level15Definition, '缺少第15关定义');
assert.doesNotMatch(level15Definition[0], /左|右|起笔|松手|墨量|画笔/);

const startInk = functionBody(game, 'startInkStroke', 'updateInkStroke');
const finishInk = functionBody(game, 'finishInkStroke', 'onPointerDown');
assert.doesNotMatch(startInk, /要从左|起笔|画笔|墨量/);
assert.doesNotMatch(finishInk, /要从左|碰到右|朝右|起笔|松手|墨量|画笔/);

const drawInk = functionBody(game, 'drawInkMechanic', 'drawTopUI');
assert.doesNotMatch(drawInk, /setLineDash|\[18,\s*14\]|moveTo\(610,\s*760\)|moveTo\(1200,\s*760\)/);
assert.match(drawInk, /inkBridge/);
assert.match(game, /const INK_SURFACE_Y = GROUND_Y/);
assert.match(game, /floors\.push\(\{ x: 650, y: INK_SURFACE_Y, w: 620,[^}]*special: 'ink'/);
assert.match(drawInk, /moveTo\(650, INK_SURFACE_Y\)[\s\S]*lineTo\(1270, INK_SURFACE_Y\)/);

const drawGround = functionBody(game, 'drawGround', 'drawDoor');
assert.match(drawGround, /special\s*===\s*['"]ink['"]/);
assert.match(drawGround, /return/);
assert.doesNotMatch(drawGround, /special\s*===\s*['"]ink['"]\s*\?\s*['"]#fff0bd/);

assert.strictEqual(logic.nextDualHold(0, true, false, 5, 1), 0);
assert.strictEqual(logic.nextDualHold(0.4, true, true, 0.3, 1), 0.7);
assert.strictEqual(logic.nextDualHold(0.9, true, true, 0.2, 1), 1);
assert.strictEqual(logic.nextDualHold(0.9, false, true, 0.01, 1), 0);
assert.deepStrictEqual(Object.keys(logic).sort(), ['clamp', 'nextDualHold', 'strokeLength', 'validateStroke']);

const validStroke = [
  { x: 650, y: 780 },
  { x: 820, y: 765 },
  { x: 1010, y: 775 },
  { x: 1240, y: 785 }
];
const validResult = logic.validateStroke(validStroke);
assert.strictEqual(validResult.valid, true);
assert.strictEqual(validResult.reason, 'connected');
assert.strictEqual(logic.strokeLength([{ x: 0, y: 0 }, { x: 3, y: 4 }]), 5);
assert.strictEqual(logic.validateStroke([{ x: 800, y: 780 }, { x: 1240, y: 780 }]).reason, 'too-few-points');
const overBudget = [
  { x: 650, y: 780 },
  { x: 720, y: 650 },
  { x: 840, y: 810 },
  { x: 960, y: 650 },
  { x: 1080, y: 810 },
  { x: 1240, y: 780 }
];
assert.strictEqual(logic.validateStroke(overBudget).reason, 'ink-exhausted');

const sandbox = {
  console: { info() {}, warn() {}, error() {} },
  performance: { now: () => 100 },
  module: { exports: {} },
  exports: {},
  globalThis: null
};
sandbox.globalThis = sandbox;
vm.runInNewContext(loggerSource, sandbox, { filename: 'logger.js' });
const RoundTwoLogger = sandbox.module.exports.RoundTwoLogger;
const testLogger = new RoundTwoLogger({ version: 'test', maxEntries: 100, minLevel: 'info' });
testLogger.setModule('mechanic:level13', true);
testLogger.log('mechanic:level13', 'test-sensitive-redaction', {
  token: 'must-not-leak',
  authorization: 'Bearer must-not-leak',
  nested: { openid: 'must-not-leak', safe: 'kept' }
});
assert.strictEqual(testLogger.entries.length, 1);
assert.strictEqual(testLogger.entries[0].context.token, '[redacted]');
assert.strictEqual(testLogger.entries[0].context.authorization, '[redacted]');
assert.strictEqual(testLogger.entries[0].context.nested.openid, '[redacted]');
assert.strictEqual(testLogger.entries[0].context.nested.safe, 'kept');
testLogger.setModule('mechanic:level13', false);
testLogger.log('mechanic:level13', 'disabled-event', {});
assert.strictEqual(testLogger.entries.length, 1);
testLogger.setModule('mechanic:level15', true);
testLogger.setLevel('warn');
testLogger.log('mechanic:level15', 'filtered-info', {});
testLogger.log('mechanic:level15', 'kept-warning', {}, 'warn');
assert.strictEqual(testLogger.entries.length, 2);
assert.strictEqual(testLogger.snapshot().privacy.sensitive_fields_redacted, true);

console.log('第13、15关独立试玩冒烟测试通过：关卡收敛、隐晦提示、墨桥层级、桌面/触控入口与日志隔离均已覆盖。');
