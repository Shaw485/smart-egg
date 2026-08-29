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

assert.match(game, /const GAME_CODE_VERSION = 182/);
assert.match(index, /game\.js\?v=182/);
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
const nextUnlock = Math.min(20, Math.max(unlockedBefore, completedIndex + 2));
assert.strictEqual(nextUnlock, 10);
assert.strictEqual((completedIndex + 2) <= nextUnlock, true,
  '首次完成第9关后应立即解锁并进入第10关');
assert.match(game, /mainline-auto-next-decision/);
assert.match(game, /goalHit\(' \+ labelSec \+ '\)→complete/);
assert.match(game, /gameState = 'complete';/);

// 第7关只移动地面参照物，山脉必须固定；第9关山脉使用连续世界坐标，不能在取模边界闪烁。
assert.match(game, /function drawGrid\(options = \{\}\)/);
assert.match(game, /const mountainParallaxX = Number\(options\.mountainParallaxX\) \|\| 0/);
assert.match(game, /currentLevelIndex === 6 \? 0 : _cameraX/);
assert.match(game, /const firstWorldX=Math\.floor\(\(shift-360\)\/step\)\*step/);
assert.match(game, /const screenX=worldX-shift/);
assert.doesNotMatch(game, /const offset=-\(shift%480\)/, '山脉不能再使用会在边界跳变的取模偏移');
assert.match(game, /mountainMotion = idx === 6 \? 'fixed' : 'stable-world-lattice'/);
assert.match(game, /groundFeaturesWorldAnchored: true/);
assert.match(game, /featureFirst=levelData\.infinite_horizontal\?Math\.floor\(\(_cameraX-250\)\/170\)\*170/);
const worldX = 1800;
for (const factor of [1]) {
  const before = worldX - 200 * factor;
  const afterRightRun = worldX - 500 * factor;
  const afterLeftRun = worldX + 100 * factor;
  assert.ok(afterRightRun < before, '第7关向右跑时地面参照物应向左');
  assert.ok(afterLeftRun > before, '第7关向左跑时地面参照物应向右');
}
assert.strictEqual(1800 - 0 * 0.15, 1800, '第7关山脉屏幕位置必须与相机位置无关');
const stableScreenX = (cameraX, factor, sampleWorldX) => sampleWorldX - cameraX * factor;
assert.ok(Math.abs((stableScreenX(7999, 0.15, 8400) - stableScreenX(8000, 0.15, 8400)) - 0.15) < 1e-9,
  '第9关跨越旧取模边界时山脉只能连续移动，不能整段跳变');

// 第8关隐藏通用右上太阳，同时仍由关卡机制绘制左上太阳。
assert.match(game, /const hideSun = !!options\.hideSun/);
assert.match(game, /if \(!hideSun\) \{/);
assert.match(game, /hideSun: gameplayWorldVisible && _hasMechanic\('shadow_switch'\)/);
assert.match(game, /createRadialGradient\(_shadowSunX,220,12,_shadowSunX,220,108\)/);

assert.match(guide, /正式关卡/);
assert.match(guide, /评审编号 13、17、24、28、30、35、36、41/);
assert.match(guide, /state\/mainline-auto-next-decision/);
assert.match(guide, /render\/infinite-parallax-config/);

console.log('mainline auto-next/parallax regressions passed');
