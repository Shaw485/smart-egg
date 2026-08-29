# 网页主线调试说明

## 关卡与版本

- 网页主线当前为代码版本 `v179`，共 20 个正式关卡。
- 原主线第 14 关（评审编号 15「一笔成路」）已删除；保留的评审编号 13、17、24、28、30、35、36、41 按顺序成为主线第 13–20 关。
- 第 8–12 关依次为影子机关、静止追门、标题拖字成桥、重来保留箱子、拖动世界。
- 第 13–20 关依次为：双向同时按住生桥、反向控制阶梯、点击人物缩小、按住空白冻结尖刺、背对门等待、人物与门同步跳跃、点击草切换地面、来回擦除墙壁。新的第 14 关要在左右反向的情况下连续跳上三层阶梯，再进入右上终点门。
- 正式关卡数据位于 `../godot_project/levels/level_0.json` 至 `level_19.json`，离线包位于 `../godot_project/levels/levels_bundle.js`。
- `index.html` 的脚本与样式缓存参数已同步为 `v179`。
- `?screen=levelSelect` 可从独立试玩页安全返回完整主线选关页；不带该参数时仍从首页启动。
- 首页正式标题与浏览器窗口标题统一为“怪奇之原”；运行时诊断导出中的 `branding.title` 可核对当前品牌标题。
- 主线选关页每页固定最多 `4 列 × 2 排`，第 1 页为 1–8 关、第 2 页为 9–16 关、第 3 页为 17–20 关。手机左右滑动、电脑按住鼠标横向拖动，或使用键盘左右方向键均可翻页；轻触/单击仍进入对应关卡。暂停返回选关会保留当前关所在页。

## 日志与独立调试

首页右上角的日志按钮可以导出 JSON。每条记录包含时间、帧号、会话标识、模块、事件和必要的非敏感状态；当前网页版本没有服务端业务请求，运行时会明确记录关卡数据来自离线包或本地 JSON。

主线断崖与掉落口统一使用 `vertical-shaft-v1` 垂直深坑视觉：第 4 关、第 10 关以及未来由分段地面自然形成的断口都会自动生效。坑口左右黑色轮廓从碰撞顶面垂直延伸到底部，坑体继续伸出画面；该升级不修改关卡平台数据或碰撞几何。每次加载关卡时，`render/drop-terrain-layout` 会记录地面段数、识别到的断口数、视觉样式版本及 `collisionGeometryChanged: false`；可只筛选 `render` 模块独立排查视觉布局，且不会逐帧重复写入。

第 8 关会在玩家真实拖动太阳至少 12 个逻辑像素时记录 `mechanic/shadow-drag-armed`；未达到该阈值时，即使走路令影尖经过机关也不会累计开门时间。`__debug.getMechanicState().shadow.moved` 可单独检查该状态。

主线通关会先保存当前关和下一关解锁状态，再计算自动跳转；有下一关时直接进入，不返回选关页，正式主线最后一关则进入完成页。每次决策记录 `state/mainline-auto-next-decision`，可核对 `unlocked_before`、`unlocked_after`、下一关文件可用性及最终结果。

第 7 关无限奔跑时，草、地面裂纹和浅色地面斑块使用世界坐标向反方向滚动，三层远山按不同速度产生视差；加载时记录 `render/infinite-parallax-config`，便于只筛选 `render` 模块确认参照物配置。第 8 关游戏画面隐藏通用背景右上太阳，仅保留左上可拖动的机关太阳。

每次进入关卡、重来或进入下一关都会把提示恢复为默认关闭，并记录 `state/help-default-closed`；其中 `previousVisible` 可确认是否关闭了上一关遗留的提示。

第 9 关停止操作后，门以 `approach_offset=55` 靠近人物。门首次进入真实通关碰撞面积时记录 `mechanic/stillness-door-overlap-ready`，包含 `overlap`、`threshold`、人物与门坐标，便于独立判断“视觉上贴近”和“物理上可通关”是否一致。

第 10 关按住标题中的“路”字时会记录 `mechanic/word-drag-start`；若提示正开着，会先记录 `state/help-auto-close-for-gesture` 并在同一次按下开始拖拽。放下时 `mechanic/word-drop` 会记录屏幕/世界坐标、目标区域与拒绝原因；成功后 `mechanic/word-bridge-created` 会记录两岸、地面顶和桥面几何。桥面由两岸数据计算并与地面齐平。

第 10 关标题“纸上有路”使用固定等距四字布局；“路”仍是独立可拖对象，但未操作前与其他三字字距完全一致。第 11 关楼梯箱与平台处于同一碰撞层：侧面记录 `collide/static-crate-horizontal-block`，底部记录 `collide/static-crate-ceiling-block`，顶面首次接触记录 `collide/persistent-crate-land`；人物不能穿箱，但可以站上并沿箱顶移动。

`tests/mainline-function-parity-test.js` 是 UI 改版的功能守恒检查：固定验证首页、主线选关、暂停返回、创造模式、编辑器撤销与移动、键盘控制、日志导出及提示跨关复位仍然存在。`tests/levels-8-12-smoke-test.js` 会模拟第 9 关静止等待，并校验第 10 关自然落点、桥两端及桥面高度，同时核对全部 20 关 JSON 与离线包一致。`tests/accepted-levels-mainline-test.js` 固定验证删除结果、8 个评审来源顺序、新第 14 关三层阶梯、存档迁移和分模块日志。

第 12 关的全景拖拽会先调用 `_sceneGestureBlockedByUI(p)`；提示、重来、暂停以及提示/成功/死亡弹层区域会记录 `mechanic/scene-gesture-bypassed-ui` 并交还旧 UI 点击处理，避免新增手势吞掉原按钮。

第二关箱子附近的横向碰撞由独立纯逻辑模块 `physics-collision.js` 处理。人物只有在本帧真正越过平台左/右侧边时才会被阻挡；人物已经站在宽地面上、脚底轻微接触平台顶面或因浮点误差下沉时，不再按整块地面的远端坐标纠正。若系统拦截了旧算法会产生的大幅横向传送，会在 `collide/horizontal-snap-prevented` 中记录原坐标、保留坐标、被拒绝的旧坐标、平台类型和关卡编号；真实侧墙阻挡记录为 `collide/horizontal-platform-block`。两类日志受 `collide` 模块开关控制，防瞬移事件对同一平台最多每秒一条。

`tests/level-2-crate-collision-test.js` 使用第二关真实地面和台阶尺寸复现“箱子旁下沉 1px 后从 x≈750 瞬移至 x=-40”，并同时验证修复后不会瞬移、真正的平台侧墙仍可阻挡、平台顶面接触不会误判。

选关分页使用独立的 `level-select` 日志模块，记录 `gesture-start`、`gesture-end`、`page-change`、`page-boundary` 和多指忽略状态。它不会逐帧记录移动过程，避免拖动时产生大量日志。可独立查看或关闭：

选关画布同时使用 Pointer Events 指针捕获与旧 mouse/touch 后备监听，并设置 `touch-action: none`，避免手机、内置浏览器或触控板把横滑抢成页面手势。日志里的 `pointer: pointer:<id>` 表示统一指针路径；`gesture-end.outcome` 应为 `page-change`，若为 `cancelled` 可结合 `dx/dy/reason` 独立排查。

```js
_findLogs('', 'level-select')
_setLogModule('level-select', false)
_setLogModule('level-select', true)
```

`tests/level-select-pagination-test.js` 固定检查 20 关分成三页、每页最多 8 关、各页索引映射、横滑阈值、取消保护、相邻页无点击热区和鼠标/触摸接线。浏览器验收还应真实完成连续左滑到第 3 页、点击第 17 关、暂停返回第 3 页和右滑回前页。

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
- `mechanic:bridge`：第 13 关双键生桥的开始、取消和完成。
- `mechanic:gesture`：保留给旧自定义关卡码的一笔手势诊断，正式主线已不再使用。
- `mechanic:transform`：第 15 关人物缩小状态。
- `mechanic:hazard`：第 16 关尖刺冻结与接触复位。
- `mechanic:direction`：第 17 关朝向与背对计时。
- `mechanic:door`：第 18 关门跳跃及空中锁定。
- `mechanic:terrain`：第 19 关道路阶段切换。
- `mechanic:erase`：第 20 关擦除手势、距离和完成度。

上述子模块均可用 `_setLogModule('mechanic:bridge', false)` 形式独立关闭，或用 `_findLogs('', 'mechanic:bridge')` 单独筛选。每次进入第 13–20 关还会在状态上下文记录 `reviewSourceId`，便于从正式编号反查原评审关。v178 存档会把原第 14 关从完成记录中移除，并把其后的编号向前迁移一次；结果记录在 `progress/loadProgress-success` 的 `source_revision`、`target_revision`、`unlocked_before`、`unlocked_after` 与 `migration` 字段。

日志只保存在当前浏览器会话的内存中，最多 10000 条；导出后可用于复现。不要把密码、令牌、授权头或个人敏感信息写入日志上下文。
