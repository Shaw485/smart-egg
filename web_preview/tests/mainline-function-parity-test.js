'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const game = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'web_preview/index.html'), 'utf8');

// UI 和关卡可以继续扩展。创造秘境本期正式下线，但代码与本地数据必须保留以便恢复。
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
assert.match(game, /const CREATOR_MODE_ENABLED = false/, '上线版本必须关闭创造秘境功能开关');
const drawMenuSource = game.slice(game.indexOf('function drawMenu()'), game.indexOf('function _newCreatorDraft()'));
assert.doesNotMatch(drawMenuSource, /创造秘境/, '首页不应再显示创造秘境入口');
assert.match(drawMenuSource, /uiBTN\.creator = null/, '首页每帧都必须清空旧创造模式热区');
assert.match(game, /creator-mode-route-blocked/, '被关闭的创造模式路径必须留下可诊断日志');
assert.match(game, /function _enforceCreatorModeOffline\(source\)/, '必须在运行时拦截残留创造模式状态');
assert.match(game, /v === 'creatorList' \|\| v === 'creatorEdit'/, '调试接口也不能绕过下线开关');
assert.match(game, /const CREATOR_LS_KEY = 'smart_egg_creator_levels_v1'/, '必须保留既有创造模式本地数据键');
assert.doesNotMatch(game, /removeItem\(CREATOR_LS_KEY\)/, '下线不能删除玩家原有创造模式数据');
assert.match(game, /gameState = wasPaused \? 'playing' : 'paused'/, '必须保留顶部暂停按钮');
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

assert.match(game, /function\s+drawFantasyDropTerrain\s*\(/, '必须保留共享断崖\/掉落地形绘制函数');
const dropTerrainCall = game.indexOf('drawFantasyDropTerrain();');
const platformCallAfterDropTerrain = game.indexOf('drawFantasyPlatforms();', dropTerrainCall);
assert.ok(dropTerrainCall >= 0 && platformCallAfterDropTerrain > dropTerrainCall,
  '断崖深度必须先于平台绘制，避免覆盖平台顶面和碰撞落脚线');
assert.match(game, /drop-terrain-layout/, '断崖布局必须提供 render 模块诊断事件');
assert.match(game, /style: 'vertical-shaft-v1'/, '主线断崖必须使用垂直深坑样式');
assert.match(game, /ctx\.lineTo\(gap\.right,bottom\)[\s\S]*ctx\.lineTo\(gap\.left,bottom\)/, '坑体左右边界必须垂直延伸到底部');
assert.match(game, /\[\[x,y\],\[x,y\+h\]\]/, '左侧断崖必须使用垂直黑色轮廓');
assert.match(game, /\[\[x\+w,y\],\[x\+w,y\+h\]\]/, '右侧断崖必须使用垂直黑色轮廓');
assert.match(game, /collisionGeometryChanged:\s*!!levelData\._adaptiveViewportApplied/,
  '断崖日志必须区分固定网页几何与微信宽屏外缘扩展');
assert.match(game, /collisionGeometryScope:\s*levelData\._adaptiveViewportApplied \? 'outer-ground-edges-only' : 'none'/,
  '宽屏适配只能声明修改最外侧地面边界，不能误报内部坑形变化');
assert.match(game, /visualSidewalls:\s*'vertical'/, '日志必须记录断崖侧壁为垂直样式');
assert.match(game, /extendsBelowViewport:\s*true/, '日志必须记录坑体延伸到视口外');

console.log('主线功能守恒测试通过：首页、选关、暂停返回、控制与日志保留；创造秘境入口下线且本地数据保留。');
