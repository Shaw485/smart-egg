'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const gameSource = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'web_preview/index.html'), 'utf8');
const debugGuide = fs.readFileSync(path.join(root, 'web_preview/README.md'), 'utf8');

assert.match(gameSource, /const GAME_CODE_VERSION = 166/);
assert.match(indexSource, /game\.js\?v=166/);
assert.match(gameSource, /const TOTAL_LEVELS = 12/);
assert.match(gameSource, /_updateNewLevelMechanics\(dt\)/);
assert.match(gameSource, /persistent-crate-land/);
assert.match(gameSource, /staticLandingCandidates\.reduce/);
assert.match(gameSource, /_shadowTipX\+34,842/);
assert.match(gameSource, /_shadowSunMoved && Math\.abs\(_shadowTipX-cfg\.x\)<78/);
assert.match(gameSource, /shadow-drag-armed/);
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
assert.strictEqual(levels[0].sun.x, 100, '第8关太阳必须从左侧开始');
const initialShadowTip = levels[0].spawn.x + (levels[0].spawn.x - levels[0].sun.x) * 1.75;
assert.ok(Math.abs(initialShadowTip - levels[0].shadow_switch.x) >= 78, '第8关初始影子不能压住机关');
assert.ok(levels[1].world_size.w >= 1000000, '第9关逻辑宽度应足够大');
assert.match(levels[3].description.hint_l1, /重来.*箱子/);
assert.strictEqual(levels[3].crates.length, 3);
assert.ok(levels[3].crates.every(crate => crate.static_platform));
assert.ok(!JSON.stringify(levels[4]).includes('远处安静得看不见尽头'));

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'godot_project/levels/levels_bundle.js'), 'utf8'), sandbox);
assert.deepStrictEqual(Object.keys(sandbox.window.__SMART_EGG_LEVELS__), Array.from({length:12}, (_,i)=>String(i)));
for (let index = 7; index <= 11; index += 1) {
  const jsonLevel = JSON.parse(fs.readFileSync(path.join(root, `godot_project/levels/level_${index}.json`), 'utf8'));
  delete jsonLevel.$schema;
  jsonLevel.description = { hint_l1: jsonLevel.description.hint_l1 };
  assert.strictEqual(
    JSON.stringify(sandbox.window.__SMART_EGG_LEVELS__[index]),
    JSON.stringify(jsonLevel),
    `离线关卡包的 level_${index} 必须与正式 JSON 完全一致`
  );
}

console.log('主线第8–12关冒烟测试通过：第8关强制拖动太阳、无限第9关、第11关稳定箱子与第12关文案删除均已验证。');
