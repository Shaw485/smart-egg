'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const levels = require(path.join(root, 'levels.js'));
const loggerSource = fs.readFileSync(path.join(root, 'logger.js'), 'utf8');
const logic = require(path.join(root, 'logic.js'));

function functionBody(source, functionName, nextFunctionName) {
  const start = source.indexOf('function ' + functionName + '(');
  const end = nextFunctionName ? source.indexOf('function ' + nextFunctionName + '(', start + 1) : source.length;
  assert.notStrictEqual(start, -1, '缺少函数：' + functionName);
  assert.notStrictEqual(end, -1, '无法确定函数结束位置：' + functionName);
  return source.slice(start, end);
}

assert.match(html, /第13–42关连续评审/);
assert.match(html, /aria-label="怪奇之原第13关至第42关连续试玩评审"/);
assert.match(html, /style\.css\?v=6/);
assert.match(html, /logger\.js\?v=6[\s\S]*logic\.js\?v=6[\s\S]*levels\.js\?v=6[\s\S]*game\.js\?v=6/);
assert.doesNotMatch(html, /src="\.\.\//);

assert.strictEqual(levels.length, 30);
assert.deepStrictEqual(levels.map(level => level.id), Array.from({ length: 30 }, (_, index) => index + 13));
assert.deepStrictEqual(levels.map(level => level.title), [
  '进退之间', '保持距离', '一笔成路', '风停之后', '方向借走了', '日影无声', '路在字里', '守门人的礼仪', '花之暗号', '钥匙的影子',
  '别急着走', '小一点', '云不肯落', '两扇都像', '题目落地', '屏住一下', '第二口气', '别看它', '终点太远', '无形之上',
  '镜中方向', '抬脚成桥', '同频的门', '地面换班', '胆小的钥匙', '箱子不只是箱子', '月亮在脚下', '三声之后', '墙也会忘', '先回到开始'
], '画面直接显示的关卡标题不得随提示改写而变化');
assert.strictEqual(new Set(levels.map(level => level.mechanic)).size, 30, '30关机制键必须互不重复');
levels.forEach(level => {
  assert(level.title.length >= 3, '关卡标题过短：' + level.id);
  assert(level.teaser.length >= 8, '关卡引子过短：' + level.id);
  assert(level.hint.length >= 22, '提示必须具体说明操作：' + level.id);
  assert(/[按点拖走跳松擦划移推顶]/.test(level.hint), '提示必须包含可执行动作：' + level.id);
  assert(Array.isArray(level.creator) && level.creator.length >= 1, '缺少创造模式元数据：' + level.id);
  assert(game.includes("mechanic === '" + level.mechanic + "'") || game.includes("mechanic === \"" + level.mechanic + "\""), '游戏引擎未接入机制：' + level.mechanic);
});

const level15 = levels.find(level => level.id === 15);
assert(level15);
assert.match(level15.hint, /左岸.*右岸.*松开/);
assert.doesNotMatch(level15.hint, /画笔|虚线/);
const drawInk = functionBody(game, 'drawInkPath', 'drawKey');
assert.doesNotMatch(drawInk, /setLineDash|虚线|画笔/);
assert.match(drawInk, /moveTo\(650, GROUND_Y\)[\s\S]*lineTo\(1270, GROUND_Y\)/);
assert.match(game, /type: 'ink', special: 'ink', h: 24/);

assert.match(game, /const STORAGE_KEY = 'guaiqi-level-review-13-42-v1'/);
assert.match(game, /function recordDecision\(decision, source\)/);
assert.match(game, /decision === 'accept'/);
assert.match(game, /recordDecision\('discard', 'canvas-button'\)/);
assert.match(game, /firstUndecidedIndex\(\)/);
assert.match(game, /screen = 'summary'/);
assert.match(game, /30 关评审完成/);
assert.match(game, /开始处理评审结果/);
assert.doesNotMatch(game, /上一关|下一关|暂不决定|跳过本关|修改选择/);
assert.match(game, /localStorage\.getItem\(STORAGE_KEY\)/);
assert.match(game, /localStorage\.setItem\(STORAGE_KEY/);
assert.doesNotMatch(game, /fetch\(|XMLHttpRequest|WebSocket/);

assert.match(game, /heldKeys\.has\('KeyA'\)/);
assert.match(game, /heldKeys\.has\('KeyD'\)/);
assert.match(game, /heldKeys\.has\('Space'\)/);
assert.match(game, /heldKeys\.has\('ShiftLeft'\)/);
assert.match(game, /canvas\.addEventListener\('pointerdown'/);
assert.match(game, /canvas\.addEventListener\('pointermove'/);
assert.match(game, /canvas\.addEventListener\('pointerup'/);
assert.match(game, /hintVisible = false/);
assert.match(game, /startupParams\.get\('hint'\) === '1'/);
assert.match(game, /hint-auto-open-debug/);

const renderLevel = functionBody(game, 'renderLevel', 'drawSummary');
assert.match(renderLevel, /drawDropTerrain\(\)[\s\S]*floorsForLevel\(\)\.forEach\(drawGround\)[\s\S]*drawMechanic\(\)[\s\S]*drawPlayer\(\)/);
assert.match(game, /style: 'vertical-shaft-v1'/);
assert.match(game, /collision_geometry_changed: false/);
assert.match(game, /visual_sidewalls: 'vertical'/);
assert.match(game, /extends_below_canvas: true/);
assert.match(game, /controls_cutout_preserved: true/);
const dropTerrain = functionBody(game, 'drawDropTerrain', 'drawDropTerrainControlCutout');
assert.match(dropTerrain, /moveTo\(gap\.left, gap\.top \+ 3\)[\s\S]*lineTo\(gap\.right, bottom\)[\s\S]*lineTo\(gap\.left, bottom\)/);
const controlCutout = functionBody(game, 'drawDropTerrainControlCutout', 'drawGround');
assert.match(controlCutout, /fillRect\(gap\.left, UI_Y, gap\.right - gap\.left/);
assert.match(controlCutout, /moveTo\(gap\.left, gap\.top\)[\s\S]*lineTo\(gap\.left, bottom\)[\s\S]*moveTo\(gap\.right, gap\.top\)[\s\S]*lineTo\(gap\.right, bottom\)/);
assert.match(renderLevel, /drawControls\(\)[\s\S]*drawDropTerrainControlCutout\(\)/);

['runtime', 'state', 'ui', 'input', 'gesture', 'render', 'review', 'storage', 'export', 'audio', 'mechanic:bridge', 'mechanic:door', 'mechanic:password', 'mechanic:erase'].forEach(moduleName => {
  assert(game.includes("'" + moduleName + "'"), '缺少日志模块：' + moduleName);
});
assert.match(game, /logger\.setModule\('physics', false\)/);
assert.match(game, /maxEntries: 1500/);
assert.match(game, /sensitive_fields_redacted: true/);

assert.strictEqual(logic.nextDualHold(0, true, false, 5, 1), 0);
assert.strictEqual(logic.nextDualHold(0.4, true, true, 0.3, 1), 0.7);
assert.strictEqual(logic.strokeLength([{ x: 0, y: 0 }, { x: 3, y: 4 }]), 5);
const validStroke = [{ x: 650, y: 780 }, { x: 820, y: 765 }, { x: 1010, y: 775 }, { x: 1240, y: 785 }];
assert.strictEqual(logic.validateStroke(validStroke).valid, true);
assert.strictEqual(logic.nextUndecidedIndex(levels, { 13: { decision: 'accept' }, 14: { decision: 'discard' } }), 2);
assert.strictEqual(logic.nextUndecidedIndex(levels, Object.fromEntries(levels.map(level => [level.id, { decision: 'accept' }]))), -1);
assert.deepStrictEqual(logic.summarizeReview(levels.slice(0, 3), {
  13: { decision: 'accept' }, 14: { decision: 'discard' }, 15: { decision: 'accept' }
}), { total: 3, decided: 3, accepted: [13, 15], discarded: [14] });
assert.strictEqual(logic.nextHold(0.4, true, 0.3, 1, 2), 0.7);
assert.strictEqual(logic.nextHold(0.4, false, 0.3, 1, 2), 0);
assert.strictEqual(logic.isSunAligned(900, 250), true);
assert.strictEqual(logic.isSunAligned(1200, 250), false);
assert.deepStrictEqual(logic.advanceSequence([], 1, [1, 0, 2]), [1]);
assert.deepStrictEqual(logic.advanceSequence([1], 2, [1, 0, 2]), []);
assert.deepStrictEqual(logic.advanceSequence([1], 0, [1, 0, 2]), [1, 0]);

const sandbox = {
  console: { info() {}, warn() {}, error() {} },
  performance: { now: () => 100 },
  module: { exports: {} },
  exports: {},
  globalThis: null
};
sandbox.globalThis = sandbox;
vm.runInNewContext(loggerSource, sandbox, { filename: 'logger.js' });
const ReviewLogger = sandbox.module.exports.RoundTwoLogger;
const testLogger = new ReviewLogger({ version: 'test', maxEntries: 100, minLevel: 'info' });
testLogger.setModule('review', true);
testLogger.log('review', 'redaction-check', {
  token: 'must-not-leak',
  authorization: 'Bearer must-not-leak',
  nested: { openid: 'must-not-leak', safe: 'kept' }
});
assert.strictEqual(testLogger.entries[0].context.token, '[redacted]');
assert.strictEqual(testLogger.entries[0].context.authorization, '[redacted]');
assert.strictEqual(testLogger.entries[0].context.nested.openid, '[redacted]');
assert.strictEqual(testLogger.entries[0].context.nested.safe, 'kept');
testLogger.setModule('review', false);
testLogger.log('review', 'disabled-event', {});
assert.strictEqual(testLogger.entries.length, 1);
testLogger.setModule('storage', true);
testLogger.setLevel('warn');
testLogger.log('storage', 'filtered-info', {});
testLogger.log('storage', 'kept-warning', {}, 'warn');
assert.strictEqual(testLogger.entries.length, 2);
assert.strictEqual(testLogger.snapshot().retention.max_entries, 100);
assert.strictEqual(testLogger.snapshot().privacy.sensitive_fields_redacted, true);

console.log('第13–42关连续评审冒烟测试通过：30个独立机制、加入/抛弃持久化、无跳关流程、触控/键盘、断崖渲染与模块日志均已覆盖。');
