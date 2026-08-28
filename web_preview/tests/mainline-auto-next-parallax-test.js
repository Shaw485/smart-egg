'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const game = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'web_preview/index.html'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'web_preview/README.md'), 'utf8');
const level7 = JSON.parse(fs.readFileSync(path.join(root, 'godot_project/levels/level_6.json'), 'utf8'));
const level8 = JSON.parse(fs.readFileSync(path.join(root, 'godot_project/levels/level_7.json'), 'utf8'));

assert.match(game, /const GAME_CODE_VERSION = 176/);
assert.match(index, /game\.js\?v=176/);
assert.strictEqual(level7.infinite_horizontal, true, '第7关应保持无限横向');
assert.ok(level7.mechanics.includes('hold_to_stop'), '第7关应保留按住门停止机制');
assert.ok(level8.mechanics.includes('shadow_switch'), '第8关应保留光影机关');
assert.strictEqual(level8.sun.x, 100, '第8关只保留左上机关太阳的初始位置');

// 回归首次通关新关卡：必须先更新解锁进度，再判断能否自动进入下一关。
const unlockAssignment = game.indexOf('_progress.unlocked = nextUnlock;');
const nextUnlockedCheck = game.indexOf('const nUnlocked = (nxt + 1) <= _progress.unlocked;', unlockAssignment);
const nextDecision = game.indexOf('const hasNext   = !overflow && nAvail && nUnlocked;', nextUnlockedCheck);
assert.ok(unlockAssignment >= 0 && unlockAssignment < nextUnlockedCheck && nextUnlockedCheck < nextDecision,
  '自动下一关必须在保存新解锁值后再作判断');
const completedIndex = 8;
const unlockedBefore = 9;
const nextUnlock = Math.min(12, Math.max(unlockedBefore, completedIndex + 2));
assert.strictEqual(nextUnlock, 10);
assert.strictEqual((completedIndex + 2) <= nextUnlock, true,
  '首次完成第9关后应立即解锁并进入第10关');
assert.match(game, /mainline-auto-next-decision/);
assert.match(game, /goalHit\(' \+ labelSec \+ '\)→complete/);
assert.match(game, /gameState = 'complete';/);

// 第7关参照物必须使用相机/世界坐标；人物右跑时所有参照物屏幕坐标变小。
assert.match(game, /function drawGrid\(options = \{\}\)/);
assert.match(game, /const shift=parallaxX\*factor/);
assert.match(game, /groundFeaturesWorldAnchored: true/);
assert.match(game, /featureFirst=levelData\.infinite_horizontal\?Math\.floor\(\(_cameraX-250\)\/170\)\*170/);
const worldX = 1800;
for (const factor of [0.06, 0.105, 0.15, 1]) {
  const before = worldX - 200 * factor;
  const afterRightRun = worldX - 500 * factor;
  const afterLeftRun = worldX + 100 * factor;
  assert.ok(afterRightRun < before, `factor ${factor}: 向右跑时参照物应向左`);
  assert.ok(afterLeftRun > before, `factor ${factor}: 向左跑时参照物应向右`);
}

// 第8关隐藏通用右上太阳，同时仍由关卡机制绘制左上太阳。
assert.match(game, /const hideSun = !!options\.hideSun/);
assert.match(game, /if \(!hideSun\) \{/);
assert.match(game, /hideSun: gameplayWorldVisible && _hasMechanic\('shadow_switch'\)/);
assert.match(game, /createRadialGradient\(_shadowSunX,220,12,_shadowSunX,220,108\)/);

assert.match(guide, /正式关卡/);
assert.match(guide, /第 13–42 关仍在独立连续评审池/);
assert.match(guide, /state\/mainline-auto-next-decision/);
assert.match(guide, /render\/infinite-parallax-config/);

console.log('mainline auto-next/parallax regressions passed');
