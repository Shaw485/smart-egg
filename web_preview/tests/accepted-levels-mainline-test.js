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
const shrinkLevel = bundle[14];
const tunnel = shrinkLevel.shrink_tunnel;
const tunnelLeft = tunnel.x;
const tunnelRight = tunnel.x + tunnel.w;
const tunnelClearance = tunnel.ground_top - (tunnel.y + tunnel.h);
assert.ok(tunnel.w > 630, '第15关墙体必须比旧版更宽');
assert.ok(tunnel.h <= 120, '第15关墙体本身不得高于未缩小人物的碰撞高度');
assert.ok(tunnelClearance < 120 && tunnelClearance > 120 * .62,
  '第15关通道净空必须只允许缩小人物通过');
assert.strictEqual(mechanics.sideBlock(tunnelLeft-50, tunnelLeft+10, 40, tunnelLeft, tunnelRight, true).blocked, true,
  '未缩小时必须被低通道阻挡');
assert.strictEqual(mechanics.sideBlock(tunnelLeft-50, tunnelLeft+10, 40, tunnelLeft, tunnelRight, false).blocked, false,
  '缩小后必须能通过低通道');
assert.strictEqual(mechanics.sideBlock(tunnelLeft-30, tunnelLeft-15, 40*.62, tunnelLeft, tunnelRight, true, true).blocked, true,
  '缩小人物跳起后与墙体垂直重叠时，必须被墙侧挡住，不能斜向穿过墙底');
const embeddedFullPlayer = mechanics.sideBlock(820, 820, 40, tunnelLeft, tunnelRight, true, true);
assert.strictEqual(embeddedFullPlayer.blocked, true,
  '未缩小人物即使因旧帧状态进入墙体范围，也必须被实体墙推出，不能继续穿过');
assert.strictEqual(embeddedFullPlayer.side, 'left-overlap');
const playerStandingOnTunnel = mechanics.sideBlock(900, 900, 40, tunnelLeft, tunnelRight, true, false);
assert.strictEqual(playerStandingOnTunnel.blocked, false,
  '人物站在墙顶时只有边界接触，下一帧不能被横向推出');
const smallHalfH = 60 * .62;
const smallCenterOffsetY = 60 - smallHalfH;
const tunnelBottomHit = mechanics.solidVerticalBlock({
  previousY:810+smallCenterOffsetY, nextY:720+smallCenterOffsetY,
  centerX:900, halfW:40*.62, halfH:smallHalfH,
  velocityY:-900, obstacle:{x:tunnel.x,y:tunnel.y,w:tunnel.w,h:tunnel.h}
});
assert.strictEqual(tunnelBottomHit.blocked, true, '缩小人物从通道内起跳也必须撞到墙底，不能穿模');
assert.strictEqual(tunnelBottomHit.side, 'bottom');
assert.strictEqual(tunnelBottomHit.y-smallHalfH, tunnel.y+tunnel.h,
  '缩小人物撞墙底后的物理头顶必须贴合墙底，不得悬空或压入墙体');
const tunnelTopLanding = mechanics.solidVerticalBlock({
  previousY:580, nextY:620, centerX:900, halfW:40, halfH:60,
  velocityY:700, obstacle:{x:tunnel.x,y:tunnel.y,w:tunnel.w,h:tunnel.h}
});
assert.strictEqual(tunnelTopLanding.blocked, true, '人物从上方落下必须站在墙顶，墙要进入实体碰撞层');
assert.strictEqual(tunnelTopLanding.side, 'top');
assert.strictEqual(tunnelTopLanding.onGround, true);
// 集成复现：缩小人物从墙左侧同时右移和起跳。即使头顶先越过墙底、X 在后续帧
// 才进入墙体范围，侧面碰撞也必须在身体垂直重叠时拦住，不能斜向钻进实体墙。
{
  const dt = 1 / 60;
  const halfW = 40 * .62;
  const halfH = 60 * .62;
  const offsetY = 60 - halfH;
  let x = tunnelLeft - 40;
  let y = 810;
  let vy = -1080;
  let penetrated = false;
  for (let frame = 0; frame < 16; frame += 1) {
    const previousX = x;
    const previousCenterY = y + offsetY;
    const shapeTop = previousCenterY - halfH;
    const shapeBottom = previousCenterY + halfH;
    const verticalOverlap = shapeBottom > tunnel.y && shapeTop < tunnel.y + tunnel.h;
    const horizontal = mechanics.sideBlock(
      previousX, previousX + 300 * dt, halfW,
      tunnelLeft, tunnelRight, verticalOverlap, verticalOverlap
    );
    x = horizontal.x;
    const nextY = y + vy * dt;
    const vertical = mechanics.solidVerticalBlock({
      previousY:previousCenterY,
      nextY:nextY+offsetY,
      centerX:x,
      halfW,
      halfH,
      velocityY:vy,
      obstacle:{x:tunnel.x,y:tunnel.y,w:tunnel.w,h:tunnel.h}
    });
    y = vertical.blocked ? vertical.y-offsetY : nextY;
    if (vertical.blocked) vy = 0;
    else vy += 2400 * dt;
    const currentTop = y + offsetY - halfH;
    const currentBottom = y + offsetY + halfH;
    const overlapsWall = x + halfW > tunnelLeft && x - halfW < tunnelRight
      && currentBottom > tunnel.y && currentTop < tunnel.y + tunnel.h;
    if (overlapsWall) penetrated = true;
  }
  assert.strictEqual(penetrated, false,
    '缩小人物斜向起跳的逐帧轨迹不能进入墙体实体范围');
}
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
assert.match(index, /accepted-mechanics\.js\?v=192/);
assert.match(game, /function _shrinkTunnelGeometry/);
assert.match(game, /shrink-tunnel-config/);
assert.match(game, /solidVerticalBlock/);
assert.match(game, /shrink-tunnel-vertical-block/);
assert.match(game, /shrink-tunnel-side-block/);
assert.match(game, /const tunnelVerticalOverlap=/,
  '墙体侧面阻挡必须先验证垂直重叠，人物站墙顶时不能被推出');
assert.match(game, /function _shrinkTunnelPlayerShape/,
  '缩小状态必须复用统一碰撞形状，避免水平和垂直判定坐标漂移');
assert.match(game, /const tunnelCollisionCenterOffsetY = tunnelPlayerShape\.centerOffsetY/,
  '缩小碰撞体必须与绘制共用脚底锚点');
assert.match(game, /player-size-toggle-rejected/,
  '通道内净空不足时必须拒绝恢复全尺寸，不能把人物横向瞬移出墙体');

const reverseLevel = bundle[13];
assert.strictEqual(reverseLevel.source_review_id, 17, '原第15关必须顺排为新的第14关');
const reverseSteps = reverseLevel.platforms
  .filter(platform => /^reverse_step_\d+$/.test(platform.kind))
  .sort((a, b) => Number(a.kind.split('_').pop()) - Number(b.kind.split('_').pop()));
assert.strictEqual(reverseSteps.length, 10, '反向控制关必须包含十层变化路线阶梯');
assert.strictEqual(reverseLevel.expand_up, true, '高塔路线必须启用纵向镜头');
assert.strictEqual(reverseLevel.map_extent.up, 2, '高塔路线必须开放两屏上方地图');
assert.strictEqual(reverseLevel.world_size.h, 3240, '高塔路线世界高度必须扩展为三屏');
const reverseGround = reverseLevel.platforms.find(platform => platform.kind === 'ground');
const reverseGoal = reverseLevel.platforms.find(platform => platform.kind === 'reverse_goal_step');
const reverseSpawn = {
  kind: 'spawn',
  x: reverseLevel.spawn.x,
  y: reverseGround.y - reverseGround.h / 2,
  w: 0,
  h: 0
};
const reverseRoute = [reverseSpawn, ...reverseSteps, reverseGoal]
  .map(platform => ({ ...platform, top: platform.y - platform.h / 2 }));
const reversePlayerHalfWidth = 40;
const reverseHorizontalSpeed = 300;
const reverseJumpVelocity = 1080;
const reverseGravityHalf = 2000 / 2;
for (let index = 1; index < reverseRoute.length; index += 1) {
  const rise = reverseRoute[index - 1].top - reverseRoute[index].top;
  assert.strictEqual(rise, 200,
    `反向阶梯第${index}段的高度差必须在单次跳跃范围内`);
  const standingClearance = rise - reverseRoute[index].h - 120;
  assert.ok(standingClearance >= 24,
    `反向阶梯第${index}段站立净空不得小于24像素，避免跳起被上层平台顶回`);
  const horizontalCenterGap = Math.abs(reverseRoute[index].x - reverseRoute[index - 1].x);
  const minimumSafeGap = index === 1 ? 350 : 360;
  assert.ok(horizontalCenterGap >= minimumSafeGap && horizontalCenterGap <= 400,
    `反向阶梯第${index}段水平中心距必须保持在${minimumSafeGap}–400像素`);
  if (index === reverseRoute.length - 1) {
    assert.ok(horizontalCenterGap >= 380, '最后一跳到终点平台的水平中心距不得小于380像素');
  }
  const edgeGap = index === 1
    ? horizontalCenterGap - reverseRoute[index].w / 2 - reversePlayerHalfWidth
    : horizontalCenterGap - reverseRoute[index - 1].w / 2 - reverseRoute[index].w / 2;
  assert.ok(edgeGap > 0, `反向阶梯第${index}段起跳平台与上层平台不得水平重叠`);
  const projectedOverlapTime = edgeGap / reverseHorizontalSpeed;
  const verticalRiseAtOverlap = reverseJumpVelocity * projectedOverlapTime
    - reverseGravityHalf * projectedOverlapTime * projectedOverlapTime;
  assert.ok(verticalRiseAtOverlap >= rise,
    `反向阶梯第${index}段首次水平进入上层投影时仅上升${verticalRiseAtOverlap.toFixed(2)}像素，仍会撞到平台底面`);
}
const horizontalDirections = reverseRoute.slice(2).map((platform, index) =>
  platform.x < reverseRoute[index + 1].x ? 'left' : 'right');
assert.deepStrictEqual(horizontalDirections, ['left','right','right','left','left','right','left','right','left','right'],
  '路线应同时包含折返和连续同向跳跃，不能只做机械左右交替');
const maxJumpRise = (1080 * 1080) / (2 * 2000);
assert.ok(200 < maxJumpRise && 400 > maxJumpRise,
  '每层200像素应可单跳到达，同时不能直接跳过两层');
assert.ok(reverseLevel.doors[0].y + reverseLevel.doors[0].h / 2 <= 0,
  '终点门必须完全位于初始首屏上方');
const cameraMinY = -reverseLevel.map_extent.up * 1080;
const cameraAtTop = platformTop => Math.max(cameraMinY, Math.min(0, (platformTop - 60) - 810));
const doorBottom = reverseLevel.doors[0].y + reverseLevel.doors[0].h / 2;
assert.ok(doorBottom - cameraAtTop(reverseSteps[5].y - reverseSteps[5].h / 2) <= 0,
  '完成前六层时仍不能看到终点门');
assert.ok(doorBottom - cameraAtTop(reverseSteps[6].y - reverseSteps[6].h / 2) > 0,
  '完成第七层后终点门才应开始进入画面');
const finalStep = reverseRoute[reverseRoute.length - 1];
assert.strictEqual(reverseLevel.doors[0].y + reverseLevel.doors[0].h / 2, finalStep.top,
  '终点门底部必须贴合最高平台顶面');
const finalPlayerY = finalStep.top - 60;
const finalCameraY = Math.max(cameraMinY, Math.min(0, finalPlayerY - 810));
assert.ok(reverseLevel.doors[0].y - finalCameraY > 0 && reverseLevel.doors[0].y - finalCameraY < 1080,
  '登上高层后纵向镜头必须能看见终点门');
assert.match(game, /reverse-climb-route-config/);
assert.match(game, /minHeadClearance/,
  '反向高塔路线日志必须记录最小站立净空，便于独立排查被平台顶回');
assert.match(game, /minProjectionClearance/,
  '反向高塔路线日志必须记录首次进入上层投影时的最小动态净空');
assert.ok(!Object.values(bundle).some(level => level.source_review_id === 15), '评审编号15对应的原第14关必须从主线删除');

for (const moduleName of [
  'mechanic:bridge', 'mechanic:gesture', 'mechanic:transform', 'mechanic:world', 'mechanic:hazard',
  'mechanic:direction', 'mechanic:door', 'mechanic:terrain', 'mechanic:erase'
]) {
  assert.ok(game.includes(`['${moduleName}',true]`), `${moduleName} 日志模块必须可独立开关`);
  assert.ok(guide.includes(moduleName), `${moduleName} 必须写入调试文档`);
}
assert.match(game, /reviewSourceId/);
assert.match(game, /total_levels: TOTAL_LEVELS/);

console.log('评审关卡调整测试通过：原第14关已删除，其余8关连续重排，新的第14关包含净空安全的十层变化路线高塔。');
