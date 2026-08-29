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

const acceptedReviewIds = [13, 17, 24, 28, 30, 35, 36, 41];
const expectedTypes = [
  'dual_bridge', 'reverse_controls', 'shrink_tunnel', 'freeze_spikes',
  'face_away', 'door_jumps', 'ground_swap', 'erase_wall'
];
assert.deepStrictEqual(Array.from(mechanics.ACCEPTED_REVIEW_IDS), acceptedReviewIds);

const bundle = sandbox.window.__SMART_EGG_LEVELS__;
assert.deepStrictEqual(Object.keys(bundle), Array.from({ length: 20 }, (_, index) => String(index)));
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
assert.strictEqual(mechanics.validateInkStroke(validStroke).valid, true, '保留的通用手势工具仍须稳定，避免旧自定义关卡失效');
assert.strictEqual(mechanics.validateInkStroke(validStroke.slice(0, 3)).valid, false, '通用手势工具仍须拒绝未完成路径');
assert.strictEqual(mechanics.sideBlock(650, 720, 40, 710, 1320, true).blocked, true, '未缩小时必须被低通道阻挡');
assert.strictEqual(mechanics.sideBlock(650, 720, 40, 710, 1320, false).blocked, false, '缩小后必须能通过低通道');
assert.strictEqual(mechanics.eraseProgress(.9, 100), 1, '擦除进度必须封顶为1');
const migratedProgress = mechanics.migrateProgressForRemovedLevel({
  unlocked: 17,
  completed: Array.from({ length: 16 }, (_, index) => index),
  mainline_revision: 178
}, 20, 179, 13);
assert.strictEqual(migratedProgress.unlocked, 16, '删除原第14关后，后续解锁上限必须只前移一次');
assert.deepStrictEqual(migratedProgress.completed, Array.from({ length: 15 }, (_, index) => index),
  '删除关完成记录必须移除，其后完成编号必须连续前移');
const migratedAgain = mechanics.migrateProgressForRemovedLevel(migratedProgress, 20, 179, 13);
assert.strictEqual(migratedAgain.unlocked, 16, '同一存档迁移不得在每次启动时重复减一');
assert.deepStrictEqual(migratedAgain.completed, migratedProgress.completed);

assert.match(game, /const TOTAL_LEVELS = 20/);
assert.match(game, /removed-level-14-v179/, 'v178 存档必须迁移并跳过已删除的原第14关');
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
assert.match(index, /accepted-mechanics\.js\?v=181/);

const reverseLevel = bundle[13];
assert.strictEqual(reverseLevel.source_review_id, 17, '原第15关必须顺排为新的第14关');
const reverseSteps = reverseLevel.platforms
  .filter(platform => /^reverse_step_\d+$/.test(platform.kind))
  .sort((a, b) => Number(a.kind.split('_').pop()) - Number(b.kind.split('_').pop()));
assert.strictEqual(reverseSteps.length, 10, '反向控制关必须包含十层左右交错阶梯');
assert.strictEqual(reverseLevel.expand_up, true, '高塔路线必须启用纵向镜头');
assert.strictEqual(reverseLevel.map_extent.up, 2, '高塔路线必须开放两屏上方地图');
assert.strictEqual(reverseLevel.world_size.h, 3240, '高塔路线世界高度必须扩展为三屏');
const reverseGround = reverseLevel.platforms.find(platform => platform.kind === 'ground');
const reverseGoal = reverseLevel.platforms.find(platform => platform.kind === 'reverse_goal_step');
const reverseRoute = [reverseGround, ...reverseSteps, reverseGoal]
  .map(platform => ({ ...platform, top: platform.y - platform.h / 2 }));
for (let index = 1; index < reverseRoute.length; index += 1) {
  const rise = reverseRoute[index - 1].top - reverseRoute[index].top;
  assert.ok(rise > 0 && rise <= 165,
    `反向阶梯第${index}段的高度差必须在单次跳跃范围内`);
}
const horizontalDirections = reverseRoute.slice(2).map((platform, index) =>
  platform.x < reverseRoute[index + 1].x ? 'left' : 'right');
assert.deepStrictEqual(horizontalDirections, ['left','right','left','right','left','right','left','right','left','right'],
  '从第一层开始必须严格左右交错跳跃');
const maxJumpRise = (1080 * 1080) / (2 * 2000);
assert.ok(165 < maxJumpRise && 330 > maxJumpRise,
  '每层165像素应可单跳到达，同时不能直接跳过两层');
assert.ok(reverseLevel.doors[0].y + reverseLevel.doors[0].h / 2 <= 0,
  '终点门必须完全位于初始首屏上方');
const cameraMinY = -reverseLevel.map_extent.up * 1080;
const cameraAtTop = platformTop => Math.max(cameraMinY, Math.min(0, (platformTop - 60) - 810));
const doorBottom = reverseLevel.doors[0].y + reverseLevel.doors[0].h / 2;
assert.ok(doorBottom - cameraAtTop(reverseSteps[4].y - reverseSteps[4].h / 2) <= 0,
  '完成前五层时仍不能看到终点门');
assert.ok(doorBottom - cameraAtTop(reverseSteps[5].y - reverseSteps[5].h / 2) > 0,
  '完成第六层后终点门才应开始进入画面');
const finalStep = reverseRoute[reverseRoute.length - 1];
assert.strictEqual(reverseLevel.doors[0].y + reverseLevel.doors[0].h / 2, finalStep.top,
  '终点门底部必须贴合最高平台顶面');
const finalPlayerY = finalStep.top - 60;
const finalCameraY = Math.max(cameraMinY, Math.min(0, finalPlayerY - 810));
assert.ok(reverseLevel.doors[0].y - finalCameraY > 0 && reverseLevel.doors[0].y - finalCameraY < 1080,
  '登上高层后纵向镜头必须能看见终点门');
assert.match(game, /reverse-climb-route-config/);
assert.ok(!Object.values(bundle).some(level => level.source_review_id === 15), '评审编号15对应的原第14关必须从主线删除');

for (const moduleName of [
  'mechanic:bridge', 'mechanic:gesture', 'mechanic:transform', 'mechanic:hazard',
  'mechanic:direction', 'mechanic:door', 'mechanic:terrain', 'mechanic:erase'
]) {
  assert.ok(game.includes(`['${moduleName}',true]`), `${moduleName} 日志模块必须可独立开关`);
  assert.ok(guide.includes(moduleName), `${moduleName} 必须写入调试文档`);
}
assert.match(game, /reviewSourceId/);
assert.match(game, /total_levels: TOTAL_LEVELS/);

console.log('评审关卡调整测试通过：原第14关已删除，其余8关连续重排，新的第14关包含十层左右交错高塔阶梯。');
