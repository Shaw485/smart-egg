'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const gameSource = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'web_preview/index.html'), 'utf8');
const debugGuide = fs.readFileSync(path.join(root, 'web_preview/README.md'), 'utf8');

assert.match(gameSource, /const GAME_CODE_VERSION = 168/);
assert.match(indexSource, /game\.js\?v=168/);
assert.match(gameSource, /const TOTAL_LEVELS = 12/);
assert.match(gameSource, /_updateNewLevelMechanics\(dt\)/);
assert.match(gameSource, /persistent-crate-land/);
assert.match(gameSource, /staticLandingCandidates\.reduce/);
assert.match(gameSource, /_shadowTipX\+34,842/);
assert.match(gameSource, /_shadowSunMoved && Math\.abs\(_shadowTipX-cfg\.x\)<78/);
assert.match(gameSource, /shadow-drag-armed/);
assert.match(gameSource, /requestedScreen === 'levelSelect'/);
assert.match(gameSource, /'startup-route'/);
assert.match(gameSource, /_sceneGestureBlockedByUI\(p\)/);
assert.match(gameSource, /scene-gesture-bypassed-ui/);
assert.match(gameSource, /help-default-closed/);
assert.match(gameSource, /stillness-door-overlap-ready/);
assert.ok(gameSource.includes("'日影无声'") && gameSource.includes("'远方未远'"));
assert.match(gameSource, /window\._setLogModule/);
assert.match(gameSource, /\['physics',\s*location\.search\.includes\('verbose=1'\)\]/);
assert.match(debugGuide, /input.*physics.*collide.*mechanic.*storage.*runtime/s);
assert.match(debugGuide, /最多 10000 条/);

const levels = [];
for (let index = 7; index <= 11; index += 1) {
  const filename = path.join(root, 'godot_project/levels/level_' + index + '.json');
  const level = JSON.parse(fs.readFileSync(filename, 'utf8'));
  assert.strictEqual(level.id, index);
  assert.ok(Array.isArray(level.platforms) && level.platforms.length > 0);
  assert.ok(Array.isArray(level.doors) && level.doors.some(door => door.is_goal));
  assert.ok(level.description && level.description.hint_l1);
  levels.push(level);
}

assert.strictEqual(levels[1].infinite_horizontal, true, '第9关必须是无限横向地图');
assert.strictEqual(levels[1].approach_offset, 55, '第9关门的最终中心距离必须留出可靠通关余量');
assert.strictEqual(levels[0].sun.x, 100, '第8关太阳必须从左侧开始');
const initialShadowTip = levels[0].spawn.x + (levels[0].spawn.x - levels[0].sun.x) * 1.75;
assert.ok(Math.abs(initialShadowTip - levels[0].shadow_switch.x) >= 78, '第8关初始影子不能压住机关');
assert.ok(levels[1].world_size.w >= 1000000, '第9关逻辑宽度应足够大');
assert.match(levels[0].description.hint_l1, /拖动.*太阳.*影子.*机关/);
assert.match(levels[1].description.hint_l1, /松开.*原地不动约 2 秒.*继续不动/);
assert.match(levels[2].description.hint_l1, /“路”字.*两块地面/);
assert.match(levels[3].description.hint_l1, /重来.*箱子/);
assert.match(levels[4].description.hint_l1, /场景空白处.*向左拖动.*地图/);
assert.strictEqual(levels[3].crates.length, 3);
assert.ok(levels[3].crates.every(crate => crate.static_platform));
assert.ok(!JSON.stringify(levels[4]).includes('远处安静得看不见尽头'));

// 第9关可达性回归：静止后门必须真正进入通关碰撞阈值，不能只在视觉上靠近。
const stillLevel = levels[1];
const stillPlayer = { x: stillLevel.spawn.x, y: stillLevel.spawn.y, w: 80, h: 120 };
const stillDoor = stillLevel.doors.find(door => door.is_goal);
let simulatedDoorX = stillDoor.x;
let simulatedIdle = 0;
for (let frame = 0; frame < 60 * 10; frame += 1) {
  const dt = 1 / 60;
  simulatedIdle += dt;
  if (simulatedIdle > stillLevel.idle_delay) {
    simulatedDoorX += (stillPlayer.x + stillLevel.approach_offset - simulatedDoorX) * Math.min(1, dt * 1.35);
  }
}
const overlapW = Math.max(0,
  Math.min(stillPlayer.x + stillPlayer.w / 2, simulatedDoorX + stillDoor.w / 2) -
  Math.max(stillPlayer.x - stillPlayer.w / 2, simulatedDoorX - stillDoor.w / 2)
);
const overlapH = Math.max(0,
  Math.min(stillPlayer.y + stillPlayer.h / 2, stillDoor.y + stillDoor.h / 2) -
  Math.max(stillPlayer.y - stillPlayer.h / 2, stillDoor.y - stillDoor.h / 2)
);
const simulatedOverlap = overlapW * overlapH;
const requiredOverlap = stillPlayer.w * stillPlayer.h * 0.5;
assert.ok(simulatedOverlap >= requiredOverlap,
  `第9关静止等待后必须能通关：overlap=${simulatedOverlap}, threshold=${requiredOverlap}`);

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'godot_project/levels/levels_bundle.js'), 'utf8'), sandbox);
assert.deepStrictEqual(Object.keys(sandbox.window.__SMART_EGG_LEVELS__), Array.from({length:12}, (_,i)=>String(i)));
function normalizeLevelForBundle(level) {
  function stripComments(value) {
    if (Array.isArray(value)) return value.map(stripComments);
    if (!value || typeof value !== 'object') return value;
    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'comment' || key === '$schema') continue;
      result[key] = stripComments(child);
    }
    return result;
  }
  const normalized = stripComments(level);
  normalized.description = { hint_l1: level.description.hint_l1 };
  return normalized;
}
for (let index = 0; index <= 11; index += 1) {
  const jsonLevel = JSON.parse(fs.readFileSync(path.join(root, `godot_project/levels/level_${index}.json`), 'utf8'));
  assert.strictEqual(
    JSON.stringify(sandbox.window.__SMART_EGG_LEVELS__[index]),
    JSON.stringify(normalizeLevelForBundle(jsonLevel)),
    `离线关卡包的 level_${index} 必须与正式 JSON 完全一致`
  );
}

console.log('主线关卡冒烟测试通过：提示具体且默认关闭，第9关静止后可达通关阈值，全部12关离线包与JSON一致。');
