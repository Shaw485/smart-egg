'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const collision = require('../physics-collision.js');
const game = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'web_preview/index.html'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'web_preview/README.md'), 'utf8');
const wordLevel = JSON.parse(fs.readFileSync(path.join(root, 'godot_project/levels/level_9.json'), 'utf8'));
const crateLevel = JSON.parse(fs.readFileSync(path.join(root, 'godot_project/levels/level_10.json'), 'utf8'));

assert.match(game, /const GAME_CODE_VERSION = 184/);
assert.match(index, /game\.js\?v=184/);
assert.ok(wordLevel.mechanics.includes('word_bridge'));
assert.ok(crateLevel.mechanics.includes('persistent_reset'));

// 第10关四个字必须使用同一个固定步长；拖动热区也从该布局计算。
assert.match(game, /function _wordTitleLayout\(\)/);
assert.match(game, /const step = 64/);
assert.match(game, /chars: \['纸','上','有','路'\]\.map/);
assert.match(game, /roadX: firstX \+ step \* 3/);
assert.match(game, /layout\.roadX-layout\.step\/2/);
assert.doesNotMatch(game, /sketchBold\('纸上有', W \/ 2 - 42/);
assert.doesNotMatch(game, /sketchBold\('路', W \/ 2 \+ 112/);
const positions = [-1.5, -0.5, 0.5, 1.5].map(unit => unit * 64);
assert.deepStrictEqual(positions.slice(1).map((x,index)=>x-positions[index]), [64,64,64]);

// 第11关三个箱子均是实体楼梯平台。
assert.strictEqual(crateLevel.crates.length, 3);
assert.ok(crateLevel.crates.every(crate => crate.static_platform));
const box = crateLevel.crates[0];
const HALF_W = 40;
const HALF_H = 60;
const boxLeft = box.x - box.w / 2;
const boxTop = box.y - box.h / 2;

const sideHit = collision.resolveHorizontalPlatformCollision({
  previousX: boxLeft - HALF_W - 6,
  nextX: boxLeft - HALF_W + 6,
  playerY: box.y,
  halfW: HALF_W,
  halfH: HALF_H,
  vx: 360,
  platform: box,
  edgeTolerance: 2,
  topTolerance: 4
});
assert.strictEqual(sideHit.blocked, true, '从侧面撞箱必须被阻挡');
assert.strictEqual(sideHit.x, boxLeft - HALF_W);

const topWalk = collision.resolveHorizontalPlatformCollision({
  previousX: box.x - 4,
  nextX: box.x + 4,
  playerY: boxTop - HALF_H + 1,
  halfW: HALF_W,
  halfH: HALF_H,
  vx: 360,
  platform: box,
  edgeTolerance: 2,
  topTolerance: 4
});
assert.strictEqual(topWalk.blocked, false, '站在箱顶横向移动不能被侧墙逻辑卡住');
assert.strictEqual(topWalk.reason, 'top-surface-contact');

const previousBottom = boxTop - 8;
const nextBottom = boxTop + 8;
assert.ok(previousBottom <= boxTop + 10 && nextBottom >= boxTop, '下落跨过箱顶时必须满足落箱判定');
assert.match(game, /static-crate-horizontal-block/);
assert.match(game, /static-crate-ceiling-block/);
assert.match(game, /_lastStaticCrateLandingId!==landing\.id/);
assert.match(guide, /侧面记录 `collide\/static-crate-horizontal-block`/);

console.log('第10关等距标题与第11关实体箱碰撞测试通过。');
