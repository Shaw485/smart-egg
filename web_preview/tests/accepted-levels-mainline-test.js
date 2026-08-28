'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const mechanics = require('../accepted-mechanics.js');

const root = path.resolve(__dirname, '../..');
const game = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'web_preview/index.html'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'web_preview/README.md'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'godot_project/levels/levels_bundle.js'), 'utf8'), sandbox);

const acceptedReviewIds = [13, 15, 17, 24, 28, 30, 35, 36, 41];
const expectedTypes = [
  'dual_bridge', 'ink_path', 'reverse_controls', 'shrink_tunnel', 'freeze_spikes',
  'face_away', 'door_jumps', 'ground_swap', 'erase_wall'
];
assert.deepStrictEqual(Array.from(mechanics.ACCEPTED_REVIEW_IDS), acceptedReviewIds);

const bundle = sandbox.window.__SMART_EGG_LEVELS__;
assert.deepStrictEqual(Object.keys(bundle), Array.from({ length: 21 }, (_, index) => String(index)));
for (let offset = 0; offset < acceptedReviewIds.length; offset += 1) {
  const mainlineIndex = 12 + offset;
  const level = bundle[mainlineIndex];
  assert.strictEqual(level.id, mainlineIndex, `主线第${mainlineIndex + 1}关编号必须连续`);
  assert.strictEqual(level.source_review_id, acceptedReviewIds[offset], `主线第${mainlineIndex + 1}关评审来源错误`);
  assert.strictEqual(level.type, expectedTypes[offset]);
  assert.ok(level.mechanics.includes(expectedTypes[offset]));
  assert.ok(level.name && level.description.hint_l1.length >= 20);
  assert.ok(level.platforms.length > 0);
  assert.ok(level.doors.some(door => door.is_goal));
}

let hold = 0;
for (let frame = 0; frame < 60; frame += 1) hold = mechanics.advanceHold(hold, true, 1 / 60, 1);
assert.ok(hold >= .99, '双键持续约1秒必须能建桥');
hold = mechanics.advanceHold(hold, false, .25, 1);
assert.ok(hold < .6, '中途松开必须明显衰减，不能误判完成');

const validStroke = [
  { x: 640, y: 820 }, { x: 800, y: 790 }, { x: 980, y: 780 },
  { x: 1160, y: 800 }, { x: 1280, y: 820 }
];
assert.strictEqual(mechanics.validateInkStroke(validStroke).valid, true, '连接两岸的一笔必须有效');
assert.strictEqual(mechanics.validateInkStroke(validStroke.slice(0, 3)).valid, false, '未画到右岸不能建桥');
assert.strictEqual(mechanics.sideBlock(650, 720, 40, 710, 1320, true).blocked, true, '未缩小时必须被低通道阻挡');
assert.strictEqual(mechanics.sideBlock(650, 720, 40, 710, 1320, false).blocked, false, '缩小后必须能通过低通道');
assert.strictEqual(mechanics.eraseProgress(.9, 100), 1, '擦除进度必须封顶为1');

assert.match(game, /const TOTAL_LEVELS = 21/);
assert.match(game, /expanded-mainline-v178/, '旧存档必须迁移到扩展后的主线');
assert.match(game, /source_review_id/);
assert.match(game, /_acceptedDualHold/);
assert.match(game, /validateInkStroke/);
assert.match(game, /reverse_controls/);
assert.match(game, /shrink_tunnel/);
assert.match(game, /freeze_spikes/);
assert.match(game, /face_away/);
assert.match(game, /door_jumps/);
assert.match(game, /for \(const d of doors\) \{\s+const dx = d\.x - d\.w \/ 2, dy = d\.y - d\.h \/ 2;\s+const distX = Math\.abs\(player\.x - d\.x\);/,
  '门跳跃的通关距离必须在实际判定循环内计算，不能引用前一轮循环的局部变量');
assert.match(game, /ground_swap/);
assert.match(game, /erase_wall/);
assert.match(index, /accepted-mechanics\.js\?v=178/);

for (const moduleName of [
  'mechanic:bridge', 'mechanic:gesture', 'mechanic:transform', 'mechanic:hazard',
  'mechanic:direction', 'mechanic:door', 'mechanic:terrain', 'mechanic:erase'
]) {
  assert.ok(game.includes(`['${moduleName}',true]`), `${moduleName} 日志模块必须可独立开关`);
  assert.ok(guide.includes(moduleName), `${moduleName} 必须写入调试文档`);
}
assert.match(game, /reviewSourceId/);
assert.match(game, /total_levels: TOTAL_LEVELS/);

console.log('评审关卡合并测试通过：9个入选机制已按评审顺序成为主线第13–21关，交互校验、存档迁移和独立日志均有效。');
