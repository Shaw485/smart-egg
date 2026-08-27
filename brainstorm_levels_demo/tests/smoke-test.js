'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const loggerSource = fs.readFileSync(path.join(root, 'logger.js'), 'utf8');

assert.match(html, /logger\.js\?v=1/);
assert.match(html, /game\.js\?v=1/);
assert.match(game, /id: 8, title: '日影无声', mechanic: 'shadow'/);
assert.match(game, /id: 9, title: '等风来', mechanic: 'stillness'/);
assert.match(game, /id: 10, title: '纸上有路', mechanic: 'word_bridge'/);
assert.match(game, /id: 11, title: '痕迹未散', mechanic: 'persistent_reset'/);
assert.match(game, /id: 12, title: '远方未远', mechanic: 'drag_world'/);
assert.match(game, /heldKeys\.has\('KeyA'\)/);
assert.match(game, /heldKeys\.has\('KeyD'\)/);
assert.match(game, /heldKeys\.has\('Space'\)/);

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
const logger = new DemoLogger({ version: 1, maxEntries: 100, minLevel: 'info' });
logger.setModule('input', true);
logger.log('input', 'key-down', { code: 'KeyA', token: 'must-not-leak' });
assert.strictEqual(logger.entries.length, 1);
assert.strictEqual(logger.entries[0].context.token, '[redacted]');
logger.setModule('input', false);
logger.log('input', 'key-up', { code: 'KeyA' });
assert.strictEqual(logger.entries.length, 1);

console.log('第8–12关试玩冒烟测试通过：5种机制、键盘控制、日志过滤与敏感字段脱敏均已覆盖。');
