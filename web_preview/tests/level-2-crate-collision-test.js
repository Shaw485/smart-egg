'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const collision = require('../physics-collision.js');
const level = JSON.parse(fs.readFileSync(path.join(root, 'godot_project/levels/level_1.json'), 'utf8'));
const gameSource = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'web_preview/index.html'), 'utf8');
const debugGuide = fs.readFileSync(path.join(root, 'web_preview/README.md'), 'utf8');

const HALF_W = 40;
const HALF_H = 60;
const ground = level.platforms.find(platform => platform.kind === 'ground');
const groundTop = ground.y - ground.h / 2;

// 精确复现旧 bug：人物在箱子旁 x≈750，脚底只深入地面 1px。
// 旧算法会按地面左边界把人物塞到 x=-40；新算法必须保留横向位置。
const nearCrate = collision.resolveHorizontalPlatformCollision({
  previousX: 750,
  nextX: 756,
  playerY: groundTop - HALF_H + 1,
  halfW: HALF_W,
  halfH: HALF_H,
  vx: 360,
  platform: ground
});
assert.strictEqual(nearCrate.blocked, false);
assert.strictEqual(nearCrate.reason, 'top-surface-contact');
assert.strictEqual(nearCrate.legacyResolvedX, -40);
assert.ok(Math.abs(nearCrate.legacyResolvedX - 756) > 700, '必须覆盖第二关从箱子旁瞬移到屏幕最左端的旧故障');

// 连续三秒向右移动并交替制造 0–3px 的脚底误差，人物必须始终单调向右，
// 不能只修好单帧后在后续帧再次复发。
let simulatedX = 600;
for (let frame = 0; frame < 180; frame += 1) {
  const nextX = simulatedX + 5;
  const result = collision.resolveHorizontalPlatformCollision({
    previousX: simulatedX,
    nextX,
    playerY: groundTop - HALF_H + (frame % 4),
    halfW: HALF_W,
    halfH: HALF_H,
    vx: 300,
    platform: ground
  });
  assert.strictEqual(result.blocked, false, `第 ${frame} 帧不应把地面误判成横向墙`);
  simulatedX = nextX;
}
assert.strictEqual(simulatedX, 1500, '连续推行模拟必须稳定越过箱子区域');

// 真正从台阶左侧撞入仍须正常阻挡，不能因修复而穿墙。
const leftStep = level.platforms.find(platform => platform.kind === 'step_left');
const stepLeft = leftStep.x - leftStep.w / 2;
const sideHit = collision.resolveHorizontalPlatformCollision({
  previousX: stepLeft - HALF_W - 4,
  nextX: stepLeft - HALF_W + 4,
  playerY: leftStep.y,
  halfW: HALF_W,
  halfH: HALF_H,
  vx: 360,
  platform: leftStep
});
assert.strictEqual(sideHit.blocked, true);
assert.strictEqual(sideHit.side, 'left');
assert.strictEqual(sideHit.x, stepLeft - HALF_W);

// 脚底轻擦平台顶面由 Y 方向处理，不得横向纠正到平台边缘。
const stepTop = leftStep.y - leftStep.h / 2;
const topContact = collision.resolveHorizontalPlatformCollision({
  previousX: leftStep.x,
  nextX: leftStep.x + 4,
  playerY: stepTop - HALF_H + 1,
  halfW: HALF_W,
  halfH: HALF_H,
  vx: 360,
  platform: leftStep
});
assert.strictEqual(topContact.blocked, false);
assert.strictEqual(topContact.reason, 'top-surface-contact');

assert.match(gameSource, /horizontal-snap-prevented/);
assert.match(gameSource, /horizontal-platform-block/);
assert.match(gameSource, /resolveHorizontalPlatformCollision/);
assert.match(indexSource, /physics-collision\.js\?v=178/);
assert.match(debugGuide, /horizontal-snap-prevented/);

console.log('第二关箱子旁横向碰撞回归测试通过：旧的 x=-40 瞬移已被阻止，真实侧墙仍会阻挡。');
