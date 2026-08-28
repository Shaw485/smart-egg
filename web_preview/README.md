# 网页主线调试说明

## 关卡与版本

- 网页主线当前为代码版本 `v173`，共 12 关。
- 第 8–12 关依次为影子机关、静止追门、标题拖字成桥、重来保留箱子、拖动世界。
- 正式关卡数据位于 `../godot_project/levels/level_0.json` 至 `level_11.json`，离线包位于 `../godot_project/levels/levels_bundle.js`。
- `index.html` 的脚本与样式缓存参数已同步为 `v173`。
- `?screen=levelSelect` 可从独立试玩页安全返回完整主线选关页；不带该参数时仍从首页启动。
- 首页正式标题与浏览器窗口标题统一为“怪奇之原”；运行时诊断导出中的 `branding.title` 可核对当前品牌标题。
- 主线选关页每页固定最多 `4 列 × 2 排`，第 1 页为 1–8 关，第 2 页为 9–12 关。手机左右滑动、电脑按住鼠标横向拖动，或使用键盘左右方向键均可翻页；轻触/单击仍进入对应关卡。进入第 9–12 关后再从暂停页返回选关，会保留在第 2 页。

## 日志与独立调试

首页右上角的日志按钮可以导出 JSON。每条记录包含时间、帧号、会话标识、模块、事件和必要的非敏感状态；当前网页版本没有服务端业务请求，运行时会明确记录关卡数据来自离线包或本地 JSON。

主线断崖与掉落口统一使用 `vertical-shaft-v1` 垂直深坑视觉：第 4 关、第 10 关以及未来由分段地面自然形成的断口都会自动生效。坑口左右黑色轮廓从碰撞顶面垂直延伸到底部，坑体继续伸出画面；该升级不修改关卡平台数据或碰撞几何。每次加载关卡时，`render/drop-terrain-layout` 会记录地面段数、识别到的断口数、视觉样式版本及 `collisionGeometryChanged: false`；可只筛选 `render` 模块独立排查视觉布局，且不会逐帧重复写入。

第 8 关会在玩家真实拖动太阳至少 12 个逻辑像素时记录 `mechanic/shadow-drag-armed`；未达到该阈值时，即使走路令影尖经过机关也不会累计开门时间。`__debug.getMechanicState().shadow.moved` 可单独检查该状态。

每次进入关卡、重来或进入下一关都会把提示恢复为默认关闭，并记录 `state/help-default-closed`；其中 `previousVisible` 可确认是否关闭了上一关遗留的提示。

第 9 关停止操作后，门以 `approach_offset=55` 靠近人物。门首次进入真实通关碰撞面积时记录 `mechanic/stillness-door-overlap-ready`，包含 `overlap`、`threshold`、人物与门坐标，便于独立判断“视觉上贴近”和“物理上可通关”是否一致。

第 10 关按住标题中的“路”字时会记录 `mechanic/word-drag-start`；若提示正开着，会先记录 `state/help-auto-close-for-gesture` 并在同一次按下开始拖拽。放下时 `mechanic/word-drop` 会记录屏幕/世界坐标、目标区域与拒绝原因；成功后 `mechanic/word-bridge-created` 会记录两岸、地面顶和桥面几何。桥面由两岸数据计算并与地面齐平。

`tests/mainline-function-parity-test.js` 是 UI 改版的功能守恒检查：固定验证首页、主线选关、暂停返回、创造模式、编辑器撤销与移动、键盘控制、日志导出及提示跨关复位仍然存在。`tests/levels-8-12-smoke-test.js` 会模拟第 9 关静止等待，并校验第 10 关自然落点、桥两端及桥面高度，同时核对全部 12 关 JSON 与离线包一致。

第 12 关的全景拖拽会先调用 `_sceneGestureBlockedByUI(p)`；提示、重来、暂停以及提示/成功/死亡弹层区域会记录 `mechanic/scene-gesture-bypassed-ui` 并交还旧 UI 点击处理，避免新增手势吞掉原按钮。

选关分页使用独立的 `level-select` 日志模块，记录 `gesture-start`、`gesture-end`、`page-change`、`page-boundary` 和多指忽略状态。它不会逐帧记录移动过程，避免拖动时产生大量日志。可独立查看或关闭：

```js
_findLogs('', 'level-select')
_setLogModule('level-select', false)
_setLogModule('level-select', true)
```

`tests/level-select-pagination-test.js` 固定检查每页 8 关、第二页索引映射、横滑阈值、取消保护、相邻页无点击热区和鼠标/触摸接线。浏览器验收还应真实完成左滑到第 2 页、点击第 9 关、暂停返回第 2 页和右滑回第 1 页。

日志模块可分别启停，默认关闭逐帧 `physics` 噪声日志。需要排查物理过程时，可以在地址后追加 `?verbose=1`，或在控制台单独开启：

```js
__debug.getMechanicState()
_tailLogs(80)
_findLogs('persistent', 'mechanic')
_setLogModule('collide', false)
_setLogModule('physics', true)
_logModuleStatus()
__debug.exportLog()
```

主要模块：

- `input`：键盘、鼠标、触摸和失焦清理。
- `physics`：位置与速度快照，默认关闭。
- `collide`：地面、平台、门和箱子碰撞。
- `mechanic`：每关特殊机关及其状态变化。
- `storage`：存档、创造模式和关卡码。
- `runtime`：启动、资源、音频及异常。

日志只保存在当前浏览器会话的内存中，最多 10000 条；导出后可用于复现。不要把密码、令牌、授权头或个人敏感信息写入日志上下文。
