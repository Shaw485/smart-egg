# 网页主线调试说明

## 关卡与版本

- 网页主线当前为代码版本 `v187`，共 20 个正式关卡。
- 原主线第 14 关（评审编号 15「一笔成路」）已删除；保留的评审编号 13、17、24、28、30、35、36、41 按顺序成为主线第 13–20 关。
- 第 8–12 关依次为影子机关、静止追门、标题拖字成桥、重来保留箱子、拖动世界。
- 第 13–20 关依次为：双向同时按住生桥、反向控制高塔、点击人物缩小、按住空白冻结尖刺、背对门等待、人物与门同步跳跃、点击草切换地面、来回擦除墙壁。新的第 14 关要在左右反向的情况下沿十层变化路线向上跳：路线既有折返，也有连续同向两次。每层升高200像素，从真实出生点到第一层的水平中心距为350像素，后续普通平台为360–400像素，最后一跳到终点为380像素；人物站立时与上层平台保留28像素净空。终点在初始首屏上方，约到第七层才会看见门。
- 正式关卡数据位于 `../godot_project/levels/level_0.json` 至 `level_19.json`，离线包位于 `../godot_project/levels/levels_bundle.js`。
- `index.html` 的脚本与样式缓存参数已同步为 `v187`。
- 上线版本已关闭首页“创造秘境”入口，并在调试接口、关卡码入口、自定义试玩和逐帧状态边界做统一拦截；创造模式代码与 `smart_egg_creator_levels_v1` 本地数据完整保留，没有删除或覆盖。恢复时需同时启用网页运行时与微信适配构建开关，并运行同步检查。
- `?screen=levelSelect` 可从独立试玩页安全返回完整主线选关页；不带该参数时仍从首页启动。
- 首页正式标题与浏览器窗口标题统一为“怪奇之原”；运行时诊断导出中的 `branding.title` 可核对当前品牌标题。
- 主线选关页每页固定最多 `4 列 × 2 排`，第 1 页为 1–8 关、第 2 页为 9–16 关、第 3 页为 17–20 关。手机左右滑动、电脑按住鼠标横向拖动，或使用键盘左右方向键均可翻页；轻触/单击仍进入对应关卡。暂停返回选关会保留当前关所在页。

## 网站改动记录

网页版首页左上角提供“改动记录”入口。该入口只在网页首页显示；进入选关或关卡后自动隐藏，Android 包和微信小游戏也不会显示。弹窗内容实时读取项目根目录的 `../改动记事本.md`，因此后续只需继续维护这一份记录，刷新网站或点击“刷新记录”即可同步，不要再复制一份网页专用文案。

弹窗支持按版本、关卡或功能搜索。Markdown 会先做 HTML 转义，再渲染标题、列表、引用和行内代码；读取失败不会阻断游戏，只会显示错误状态及原始记事本链接。网站需要从项目根目录启动本地服务，若直接用 `file://` 打开，浏览器会因本地文件安全策略拒绝读取记事本。

改动记录使用独立 `website:changelog` 诊断模块，生产默认只在内存保留最多 100 条低频事件，详细日志默认关闭，也不会保存搜索原文。浏览器控制台可用：

```js
__SMART_EGG_CHANGELOG__.getState()
__SMART_EGG_CHANGELOG__.refresh()
__SMART_EGG_CHANGELOG__.diagnostics.setEnabled(true)
__SMART_EGG_CHANGELOG__.diagnostics.list()
__SMART_EGG_CHANGELOG__.diagnostics.find('load-failed')
```

专项验证命令：`node web_preview/tests/changelog-website-test.js`。

## v186 微信小游戏原生比例与精确宽地图

v186 只在微信小游戏环境启用响应式逻辑视口：逻辑高度固定为 `1080`，逻辑宽度严格按设备安全区宽高比计算，宽屏不再设置 `2880` 上限。16:9 继续使用 1920 宽；19.5:9、20:9 及更宽设备按其真实比例展示恰好所需的地图宽度。人物、门、台阶、箱子与操作按钮仍使用原有逻辑尺寸，渲染和触控都保持统一比例，不做横向拉伸。网页和 Android 版本继续使用固定 `1920×1080`，既有画面与操作坐标不变。

有限单屏关只把最左、最右的真实地面和世界边界延展到设备所需宽度，人物出生点、门、机关和内部断崖坐标保持不变；例如第 4 关的内部坑宽不会因手机变宽而改变。多屏地图仍按每屏基准宽 `1920` 计算，避免把三屏地图误扩为三倍设备宽度。Canvas 只做一次完整等比绘制，不再复制最边缘像素，也不使用模糊、渐变或拖长边缘；安全区外只显示统一深青灰安全底色。

响应式诊断使用独立的 `viewport` 日志模块。`__debug.getViewportLayout()` 返回安全区策略、逻辑尺寸、Canvas backing size、世界边界和当前相机；`__debug.inspectLevelViewport(level)` 可在不修改原始关卡的情况下对比适配前后地面、人物、门和相机起点。微信适配层还可通过 `__SMART_EGG_WECHAT_BRIDGE__.getViewport()` 和 `clientToLogical()` 核对物理坐标映射。`wechat_minigame/tests/responsive-viewport-test.js` 覆盖 16:9、19.5:9、20:9、带偏移安全区与 DPR 3、窄横屏 contain 以及 32:9 超宽精确地图；每个矩阵都固定验证只有一次完整画面绘制，没有边缘复制。微信冒烟测试同时固定校验单屏外边延展、内部坑不变和三屏地图仍为 5760 宽。

## v187 连续背景音乐

v187 修复 v186 为消除周期点声而把背景音乐整体关闭的问题。Web 与微信小游戏现在共用同一份原创 `assets/bgm-wilds-ambient.wav`：运行时只维持一个连续循环实例，不再用短音符或定时器拼接旋律。音轨首尾已按同一相位生成，可无缝循环；旧的 380ms 点状音序仍永久禁用，跳跃、落地、敲门、开锁和通关动作音继续走独立音效通道，不会被背景音乐实例替代。

浏览器和小游戏都只在第一次真实点击、触摸或键盘操作后启动音乐，满足平台自动播放限制。游戏暂停、页面切到后台或小游戏隐藏时暂停但保留播放位置；返回游戏或回到前台时从原位置继续。退出页面或销毁运行环境时会停止并清理唯一实例，重复输入不会创建叠加音乐。默认背景音量独立设置为较低档位，动作音仍保持清晰。

Web 播放请求使用代次标识，暂停、隐藏或销毁后的迟到 Promise 不会覆盖当前状态。微信真机严格等待资源 `canplay` 后再播放；加载或启动超时会释放异常实例，允许下一次交互自动重建。旧实例即使在释放后又送达排队事件，也会因实例身份不匹配而被忽略。

背景音乐使用 `audio` 日志模块记录 `bgm-load-start`、`bgm-ready`、`bgm-play-request`、`bgm-playing`、`bgm-paused`、`bgm-resumed`、`bgm-play-rejected`、`bgm-media-error` 和 `bgm-destroyed` 等低频生命周期事件，不逐帧或逐音符刷日志。`__debug.getAudioDiagnostics()` 与首页导出的诊断包可查看音轨是否已激活、当前状态、音量、播放位置、资源名和最后一次错误；动作音请求继续单独记录，便于分别排查背景音乐与操作音效。

## 日志与独立调试

首页右上角的日志按钮可以导出 JSON。每条记录包含时间、帧号、会话标识、模块、事件和必要的非敏感状态；当前网页版本没有服务端业务请求，运行时会明确记录关卡数据来自离线包或本地 JSON。

v184 增加跨重开的精简故障记录：持续保存 `previousFault`、`lastFault`，每条故障中的 `lastAction` 是故障前最后一次有效操作；每个故障只附带有上限的最近 10 帧、80 条日志与输入状态，不保存无限历史或文本输入内容。发生无法现场导出日志的卡死或异常后，重新打开游戏，再点击首页右上角日志按钮，导出的诊断包仍会携带上次会话的异常和最后动作，便于区分音频、输入与物理状态问题。

主线断崖与掉落口统一使用 `vertical-shaft-v1` 垂直深坑视觉：第 4 关、第 10 关以及未来由分段地面自然形成的断口都会自动生效。坑口左右黑色轮廓从碰撞顶面垂直延伸到底部，坑体继续伸出画面；网页和 Android 不修改关卡碰撞几何，微信宽屏只扩展最外侧地面边缘，内部坑宽仍不变。每次加载关卡时，`render/drop-terrain-layout` 会记录地面段数、识别到的断口数、视觉样式版本、`collisionGeometryChanged` 及 `collisionGeometryScope`；可只筛选 `render` 模块独立排查视觉布局，且不会逐帧重复写入。

第 8 关会在玩家真实拖动太阳至少 12 个逻辑像素时记录 `mechanic/shadow-drag-armed`；未达到该阈值时，即使走路令影尖经过机关也不会累计开门时间。`__debug.getMechanicState().shadow.moved` 可单独检查该状态。

主线通关会先保存当前关和下一关解锁状态，再计算自动跳转；有下一关时直接进入，不返回选关页，正式主线最后一关则进入完成页。每次决策记录 `state/mainline-auto-next-decision`，可核对 `unlocked_before`、`unlocked_after`、下一关文件可用性及最终结果。

第 7 关无限奔跑时，只有草、地面裂纹和浅色地面斑块使用世界坐标向反方向滚动，三层远山固定不动。第 9 关的远山仍有轻微视差，但改用连续世界坐标格点生成，不再在旧取模边界整段跳变或闪烁。加载无限关卡时会记录一次 `render/infinite-parallax-config`；其中 `mountainMotion` 为 `fixed` 或 `stable-world-lattice`，可只筛选 `render` 模块确认当前配置。第 8 关游戏画面隐藏通用背景右上太阳，仅保留左上可拖动的机关太阳。

如果选关页仍显示 12 关，先核对右上角代码版本是否为 `v186`，并确认本地服务根目录是本仓库而不是旧试玩目录；当前正式关卡应显示 `0 / 20`，三页分别为 1–8、9–16、17–20。关卡加载日志 `level-load/probe-available-levels` 的 `available_count` 和 `missing_count` 可独立确认20个离线关卡是否全部加载。

每次进入关卡、重来或进入下一关都会把提示恢复为默认关闭，并记录 `state/help-default-closed`；其中 `previousVisible` 可确认是否关闭了上一关遗留的提示。

第 9 关停止操作后，门以 `approach_offset=55` 靠近人物。门首次进入真实通关碰撞面积时记录 `mechanic/stillness-door-overlap-ready`，包含 `overlap`、`threshold`、人物与门坐标，便于独立判断“视觉上贴近”和“物理上可通关”是否一致。

第 10 关按住标题中的“路”字时会记录 `mechanic/word-drag-start`；若提示正开着，会先记录 `state/help-auto-close-for-gesture` 并在同一次按下开始拖拽。放下时 `mechanic/word-drop` 会记录屏幕/世界坐标、目标区域与拒绝原因；成功后 `mechanic/word-bridge-created` 会记录两岸、地面顶和桥面几何。桥面由两岸数据计算并与地面齐平。

第 10 关标题“纸上有路”使用固定等距四字布局；“路”仍是独立可拖对象，但未操作前与其他三字字距完全一致。第 11 关楼梯箱与平台处于同一碰撞层：侧面记录 `collide/static-crate-horizontal-block`，底部记录 `collide/static-crate-ceiling-block`，顶面首次接触记录 `collide/persistent-crate-land`；人物不能穿箱，但可以站上并沿箱顶移动。

第 14 关进入时记录 `mechanic:direction/reverse-climb-route-config`，一次性包含十层平台及终点平台的世界坐标、平台高度、每段 `left/right` 方向、`segments`（`rise`、`centerSpan`、`edgeGap`、`timeToProjection`、`riseAtProjection`、`projectionClearance`）、`motionConstants`、各段 `headClearances`、`minHeadClearance`、`minProjectionClearance`、纵向镜头最小坐标和 `doorInitiallyVisible:false`。v182 的最小站立净空应为28像素；可只开启 `mechanic:direction` 模块排查“跳起被上层平台顶回”及首次进入上层投影时的动态安全，无需打开逐帧物理日志。运行中的普通跳跃与碰撞继续分别使用 `input`、`collide` 模块。

`tests/mainline-function-parity-test.js` 是 UI 与上线功能守恒检查：固定验证首页、主线选关、暂停返回、键盘控制、日志导出及提示跨关复位仍然存在，同时验证创造秘境入口不可达、调试路径受保护、本地数据键保留。`tests/levels-8-12-smoke-test.js` 会模拟第 9 关静止等待，并校验第 10 关自然落点、桥两端及桥面高度，同时核对全部 20 关 JSON 与离线包一致。`tests/accepted-levels-mainline-test.js` 固定验证删除结果、8 个评审来源顺序、新第 14 关十层变化高塔路线、200像素层高、至少24像素站立净空、真实出生点首跳350像素、后续普通平台360–400像素及终点至少380像素的水平中心距、第七层门进入画面、单层可达但不可隔层跳、存档迁移和分模块日志。水平间距以真实碰撞顺序模拟为依据，不只依赖静态站立净空。

第 12 关的全景拖拽会先调用 `_sceneGestureBlockedByUI(p)`；提示、重来、暂停以及提示/成功/死亡弹层区域会记录 `mechanic/scene-gesture-bypassed-ui` 并交还旧 UI 点击处理，避免新增手势吞掉原按钮。

v186 中第 12 关的门在玩家尚未拖动地面时始终保持在当前视野右侧之外，人物无论走多远都不会把门走进画面。拖动必须从脚下真实地面起手；天空、人物或门上的拖动会记录 `mechanic:world/world-drag-rejected` 且不累计，底部左右/跳跃按钮始终优先作为控制输入，不会被拖地手势抢占。向左拖地时草皮、裂纹和土层斑块会一起移动，累计达到 720 个逻辑像素后门才会在人物前方出现；过程分别记录 `world-drag-start`、`world-drag-end` 和 `world-door-found`，配置日志明确写入 `walkingCanRevealDoor:false`。`__debug.isDragWorldGroundPoint(p)` 可检查起手点，`__debug.isSceneGestureBlockedByUI(p)` 可核对控制区保护，`__debug.getMechanicState().dragWorld` 可查看累计距离、是否发现门及地面视觉偏移。

第 15 关缩小通道改为 820 像素宽、112 像素高；视觉墙体与侧面/顶部碰撞统一读取同一份 `shrink_tunnel` 几何。墙体比旧版更宽，但高度低于正常人物 120 像素碰撞高度，因此正常状态被挡住，缩小后 74.4 像素高度可以通过。进入关卡会记录 `mechanic:transform/shrink-tunnel-config`，包含墙体范围、净空和两种状态是否可通过。

v186 停用旧的循环音符序列，避免真机反复出现像故障的点状声；v187 在保持旧 380ms 音序永久禁用的前提下，以单一连续无缝音轨恢复背景音乐。跳跃仍使用独立的短促发力/衣料动作音 `sfx-jump-action.wav`，不复用背景音乐、敲门或落地音色。人物裤腿向下延长，步行改为支撑脚贴地、摆动脚抬起的交替姿态，跳跃按上升、顶点和下降阶段独立调整双腿，不再冻结在某个走路帧。

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
- `storage`：本地存档读写；当前创造秘境已下线且不会写入其旧数据。
- `feature`：功能开关状态与被拦截的创造模式残留路径。
- `creator`：保留的创造模式内部诊断；上线状态下正常不会产生日志。
- `runtime`：启动、资源、音频及异常。
- `viewport`：微信安全区、逻辑宽高、Canvas backing size、地图外边延展、世界边界和相机起点；可独立启停与筛选。
- `mechanic:world`：第 12 关拖动地面、累计位移、门保持不可见和发现门的状态。
- `mechanic:bridge`：第 13 关双键生桥的开始、取消和完成。
- `mechanic:gesture`：保留给旧自定义关卡码的一笔手势诊断，正式主线已不再使用。
- `mechanic:transform`：第 15 关人物缩小状态。
- `mechanic:hazard`：第 16 关尖刺冻结与接触复位。
- `mechanic:direction`：第 17 关朝向与背对计时。
- `mechanic:door`：第 18 关门跳跃及空中锁定。
- `mechanic:terrain`：第 19 关道路阶段切换。
- `mechanic:erase`：第 20 关擦除手势、距离和完成度。

上述子模块均可用 `_setLogModule('mechanic:bridge', false)` 形式独立关闭，或用 `_findLogs('', 'mechanic:bridge')` 单独筛选。每次进入第 13–20 关还会在状态上下文记录 `reviewSourceId`，便于从正式编号反查原评审关。v178 存档会把原第 14 关从完成记录中移除，并把其后的编号向前迁移一次；结果记录在 `progress/loadProgress-success` 的 `source_revision`、`target_revision`、`unlocked_before`、`unlocked_after` 与 `migration` 字段。

完整运行日志只保存在当前浏览器会话的内存中，最多 10000 条；只有带有上限的 `previousFault`、`lastFault`、其中的 `lastAction` 与最近诊断证据跨重开保留。导出后可用于复现。不要把密码、令牌、授权头或个人敏感信息写入日志上下文。
