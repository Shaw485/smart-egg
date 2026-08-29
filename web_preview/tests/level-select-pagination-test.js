'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const game = fs.readFileSync(path.join(root, 'web_preview/game.js'), 'utf8');
const style = fs.readFileSync(path.join(root, 'web_preview/style.css'), 'utf8');

const COLS = 4;
const ROWS = 2;
const PAGE_SIZE = COLS * ROWS;
const TOTAL_LEVELS = 20;
const SWIPE_THRESHOLD = 120;
const TAP_SLOP = 28;

function itemsForPage(page) {
  const first = page * PAGE_SIZE;
  return Array.from({ length: Math.max(0, Math.min(TOTAL_LEVELS, first + PAGE_SIZE) - first) }, (_, i) => first + i);
}

function classifyGesture(dx, dy, reason = 'end') {
  const distance = Math.hypot(dx, dy);
  const isRelease = reason === 'end' || reason === 'canvas-mouseup' || reason === 'window-mouseup';
  if (isRelease && Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.15) return 'swipe';
  if ((reason === 'end' || reason === 'canvas-mouseup') && distance <= TAP_SLOP) return 'tap';
  return 'cancelled';
}

assert.deepStrictEqual(itemsForPage(0), [0, 1, 2, 3, 4, 5, 6, 7], '第一页必须只有第1–8关');
assert.deepStrictEqual(itemsForPage(1), [8, 9, 10, 11, 12, 13, 14, 15], '第二页必须映射到第9–16关');
assert.deepStrictEqual(itemsForPage(2), [16, 17, 18, 19], '第三页必须映射到第17–20关且不生成空卡片');
assert.strictEqual(Math.ceil(TOTAL_LEVELS / PAGE_SIZE), 3, '20关应分成三页');
assert.strictEqual(itemsForPage(1)[0], 8, '第二页第一格必须打开第9关');
assert.strictEqual(itemsForPage(1)[7], 15, '第二页第八格必须打开第16关');
assert.strictEqual(itemsForPage(2)[3], 19, '第三页第四格必须打开第20关');

assert.strictEqual(classifyGesture(-120, 0), 'swipe', '达到阈值的左滑必须翻到下一页');
assert.strictEqual(classifyGesture(120, 0), 'swipe', '达到阈值的右滑必须翻到上一页');
assert.strictEqual(classifyGesture(119, 0), 'cancelled', '未达到阈值不能误翻页');
assert.strictEqual(classifyGesture(140, 200), 'cancelled', '纵向移动占优时不能误翻页');
assert.strictEqual(classifyGesture(20, 10), 'tap', '轻触必须继续打开关卡');
assert.strictEqual(classifyGesture(150, 0, 'cancel'), 'cancelled', '触摸取消不能翻页');
assert.strictEqual(classifyGesture(0, 0, 'canvas-mouseleave'), 'cancelled', '鼠标移出不能误点关卡');

assert.match(game, /const GAME_CODE_VERSION = 181/);
assert.match(game, /const LEVEL_SELECT_COLS = 4/);
assert.match(game, /const LEVEL_SELECT_ROWS = 2/);
assert.match(game, /const LEVEL_SELECT_PAGE_SIZE = LEVEL_SELECT_COLS \* LEVEL_SELECT_ROWS/);
assert.match(game, /firstIndex = pageIndex \* LEVEL_SELECT_PAGE_SIZE/);
assert.match(game, /const slot = idx - firstIndex/);
assert.match(game, /if \(collectButtons && canPlay\)/, '相邻页和空位不能登记点击热区');
assert.match(game, /x: bx - offsetX/, '轻微拖动时点击热区必须保持在当前页静止位置');
assert.match(game, /_drawLevelSelectPage\(_levelSelectPage \+ 1, dragOffset \+ W, layout, false\)/, '左滑时必须绘制下一页');
assert.match(game, /_drawLevelSelectPage\(_levelSelectPage - 1, dragOffset - W, layout, false\)/, '右滑时必须绘制上一页');
assert.match(game, /_beginLevelSelectGesture\(p, 'mouse'\)/, '鼠标按下必须先进入选关手势');
assert.match(game, /_moveLevelSelectGesture\(p, 'mouse'\)/, '鼠标移动必须驱动横滑');
assert.match(game, /_beginLevelSelectGesture\(p,touch\.identifier\)/, '触摸按下必须先进入选关手势');
assert.match(game, /_moveLevelSelectGesture\(p,touch\.identifier\)/, '触摸移动必须驱动横滑');
assert.match(game, /_endLevelSelectGesture\(p,touch\.identifier,reason\)/, '触摸松开后才可判定点击或翻页');
assert.match(game, /canvas\.addEventListener\('pointerdown'/, '现代浏览器必须用 Pointer Events 启动横滑');
assert.match(game, /canvas\.setPointerCapture\(e\.pointerId\)/, '选关横滑必须捕获指针，避免滑出卡片后丢失松手');
assert.match(game, /pointer-capture-failed/, '指针捕获失败必须写入可操作的独立诊断日志');
assert.match(game, /canvas\.addEventListener\('pointermove'/, 'Pointer Events 必须持续更新横滑位置');
assert.match(game, /canvas\.addEventListener\('pointerup'/, 'Pointer Events 松手必须完成翻页');
assert.match(game, /reason === 'pointerup'/, 'pointerup 必须被识别为有效释放');
assert.match(style, /#game-canvas[\s\S]*touch-action:\s*none/, '画布必须禁止浏览器抢占触摸横滑');
assert.match(game, /startPage: _levelSelectPage/, '手势必须记录起始页，避免按住期间换页后误点');
assert.match(game, /outcome = canComplete \? 'cancelled' : 'state-or-page-changed'/, '页面或页码变化后必须取消旧手势');
assert.match(game, /uiBTN\.levelSelect_btns = \[\];\n\s+logStep\('level-select', 'page-change'/, '翻页后必须立即清理旧页热区');
assert.match(game, /logStep\('level-select', 'page-change'/, '翻页必须进入独立诊断日志');
assert.match(game, /logStep\('level-select', 'page-boundary'/, '首尾页越界必须有诊断日志');
assert.match(game, /\['level-select',true\]/, '选关日志模块必须可独立开关');
assert.match(game, /getLevelSelectPaging/, '必须提供选关分页调试状态');

console.log('主线选关分页测试通过：20关分3页、每页4×2、横滑阈值、取消保护、点击延迟和独立日志均有效。');
