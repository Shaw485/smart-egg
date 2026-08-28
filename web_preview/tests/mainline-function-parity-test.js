'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const game = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'web_preview/index.html'), 'utf8');

// UI 和关卡可以继续扩展，但旧主线的入口、模式和关键返回路径不得被裁掉。
const requiredFunctions = [
  'drawMenu',
  'drawLevelSelect',
  'drawCreatorList',
  'drawCreatorEditor',
  'drawGameplayMessage',
  'drawBottomControls',
  'exportDiagnosticLog'
];
for (const name of requiredFunctions) {
  assert.match(game, new RegExp('function\\s+' + name + '\\s*\\('), `缺少主线核心函数 ${name}`);
}

assert.match(game, /let gameState = 'menu'/, '启动入口必须保留首页');
assert.match(game, /const GAME_TITLE = '怪奇之原'/, '首页正式标题必须保持为“怪奇之原”');
assert.match(game, /sketchBold\(GAME_TITLE, W \/ 2, H \* 0\.34, 120\)/, '首页标题必须单行居中绘制');
assert.match(index, /<title>怪奇之原 · F4 旷野版<\/title>/, '浏览器窗口标题必须与正式游戏名一致');
assert.match(game, /gameState = 'levelSelect'/, '必须保留主线选关页');
assert.match(game, /gameState='creatorList'/, '必须保留创造模式列表页');
assert.match(game, /gameState='creatorEdit'/, '必须保留关卡编辑器页');
assert.match(game, /gameState = wasPaused \? 'playing' : 'paused'/, '必须保留顶部暂停按钮');
assert.match(game, /gameState = _playingCustom \? 'creatorList' : 'levelSelect'/, '暂停返回必须按主线\/创造模式回到正确列表');
assert.match(game, /_creatorHistory\.pop\(\)/, '编辑器撤销功能必须保留');
assert.match(game, /_creatorSelected/, '编辑器元素选择\/移动功能必须保留');
assert.match(game, /menu-export-log-click/, '日志导出功能必须保留');
assert.match(game, /_sceneGestureBlockedByUI\(p\)/, '新增场景拖拽不能吞掉旧顶部按钮');
assert.match(game, /scene-gesture-bypassed-ui/, '场景手势绕过 UI 时必须有可诊断日志');
assert.match(game, /visibleWordHandle/, '第10关提示开启时必须允许从可见的“路”字开始拖拽');
assert.match(game, /showSuccess \|\| showDead/, '成功和死亡弹层仍必须阻断场景拖拽');
assert.match(game, /function loadLevelAndStart\(\) \{\s*const helpWasVisible = helpVisible;\s*helpVisible = false;/s,
  '每次进入、重来或切换关卡时提示必须默认关闭');
assert.match(game, /help-default-closed/, '提示自动关闭必须留下状态日志');
assert.match(game, /KeyA/);
assert.match(game, /KeyD/);
assert.match(game, /Space/);
assert.match(game, /requestedScreen === 'levelSelect'/, '试玩页返回必须能直达完整主线选关页');

console.log('主线功能守恒测试通过：首页、选关、暂停返回、创造模式、编辑器、控制与日志均保留。');
