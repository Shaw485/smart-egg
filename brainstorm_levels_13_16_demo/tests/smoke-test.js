'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const loggerSource = fs.readFileSync(path.join(root, 'logger.js'), 'utf8');
const logic = require(path.join(root, 'logic.js'));

assert.match(html, /logger\.js\?v=1[\s\S]*logic\.js\?v=1[\s\S]*game\.js\?v=1/);
assert.doesNotMatch(html, /src="\.\.\//);
assert.doesNotMatch(html, /href="\.\.\//);
assert.match(game, /id: 13,[\s\S]*title: '进退之间'[\s\S]*mechanic: 'dual_bridge'/);
assert.match(game, /id: 14,[\s\S]*title: '薄处有光'[\s\S]*mechanic: 'spread_crack'/);
assert.match(game, /id: 15,[\s\S]*title: '一笔成路'[\s\S]*mechanic: 'ink_path'/);
assert.match(game, /id: 16,[\s\S]*title: '请稍候'[\s\S]*mechanic: 'fake_loading'/);
assert.match(game, /hintVisible = false/);
assert.match(game, /回到试验选关/);
assert.match(game, /返回主线选关/);
assert.match(game, /heldKeys\.has\('KeyA'\)/);
assert.match(game, /heldKeys\.has\('KeyD'\)/);
assert.match(game, /heldKeys\.has\('Space'\)/);
assert.match(game, /mechanic:level13/);
assert.match(game, /mechanic:level14/);
assert.match(game, /mechanic:level15/);
assert.match(game, /mechanic:level16/);
assert.match(game, /logger\.setModule\('physics', false\)/);
assert.match(game, /crack-touch-pair-cancelled/);
assert.match(game, /finger-released-before-both-sides-ready/);
assert.doesNotMatch(game, /localStorage|fetch\(|XMLHttpRequest|WebSocket/);

assert.strictEqual(logic.nextDualHold(0, true, false, 5, 1), 0);
assert.strictEqual(logic.nextDualHold(0.4, true, true, 0.3, 1), 0.7);
assert.strictEqual(logic.nextDualHold(0.9, true, true, 0.2, 1), 1);
assert.strictEqual(logic.nextDualHold(0.9, false, true, 0.01, 1), 0);
assert.strictEqual(logic.spreadWidth(890, 1030, 20, 360), 140);
assert.strictEqual(logic.spreadWidth(700, 1200, 20, 360), 360);

const validStroke = [
  { x: 650, y: 780 },
  { x: 820, y: 765 },
  { x: 1010, y: 775 },
  { x: 1240, y: 785 }
];
const validResult = logic.validateStroke(validStroke);
assert.strictEqual(validResult.valid, true);
assert.strictEqual(validResult.reason, 'connected');
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
assert.strictEqual(logic.loadingProgress(560, 560, 1430), 43);
assert.strictEqual(logic.loadingProgress(1430, 560, 1430), 100);
assert.strictEqual(logic.loadingProgress(840, 840, 1430), 43);
assert.strictEqual(logic.loadingProgress(1430, 840, 1430), 100);

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
testLogger.setModule('mechanic:level14', true);
testLogger.setLevel('warn');
testLogger.log('mechanic:level14', 'filtered-info', {});
testLogger.log('mechanic:level14', 'kept-warning', {}, 'warn');
assert.strictEqual(testLogger.entries.length, 2);
assert.strictEqual(testLogger.snapshot().privacy.sensitive_fields_redacted, true);

console.log('第13–16关独立试玩冒烟测试通过：四关逻辑、桌面/触控入口、暂停返回、日志分模块与脱敏均已覆盖。');
