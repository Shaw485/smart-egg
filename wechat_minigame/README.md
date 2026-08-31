# 怪奇之原 · 微信小游戏版（v185）

这是与网页和 Android 构建隔离的微信小游戏工程。当前同步网页正式主线 v185，共 20 个关卡；首页“创造秘境”入口已下线，已有自定义关卡数据仍保留在本机存储中，没有删除，后续可以通过统一功能开关恢复。

## 正确导入方式

1. 在微信开发者工具选择“小游戏”，导入本目录：`/Users/bytedance/Documents/trae_projects/game/wechat_minigame`。
2. 不要使用 `/Users/bytedance/WeChatProjects/minigame-1`；那是开发者工具创建的飞机示例工程。
3. 当前 `project.config.json` 已配置《怪奇之原》的正式小游戏 AppID：`wx6f83b5cdbf65041b`；本机当前登录账号已确认具有该 AppID 的管理权限，后台名称为“怪奇之原”。换电脑或换账号后仍应再次核对右侧“基本信息”。
4. 基础库使用 `3.17.1`，画面为横屏。打开工程后先点“编译”，再进行预览和真机调试。
5. 当前项目未接业务服务器，20 关和运行模块全部内嵌在主包中。

## 当前验收范围

- 首页只显示“踏上旅途”，不显示“创造秘境”；调试入口、关卡码入口和自定义试玩路径同样受功能开关保护。
- 创造秘境关闭时不会注册关卡码系统键盘桥，也不会读取剪贴板；旧自定义数据仍原样保留。
- 主线共 20 关，选关页分 3 页：1–8、9–16、17–20；触屏横滑、鼠标拖动和方向键均可翻页。
- 通关后自动进入下一关，最后一关进入完成页；暂停后可以继续、重来或回到主线选关。
- 触屏支持移动和跳跃多指同时按住；开发者工具支持 `A` 左移、`D` 右移、`空格` 跳跃，`Shift` 用于需要按住空白区域的冻结机制。
- 第 2 关箱子旁不会被纠正到屏幕左侧；第 7、9 关长距离奔跑参照物连续；第 10 关可拖“路”成桥；第 11 关箱子侧面不可穿、顶部可站；第 14 关高塔间距可跳通。
- 首页右上角日志按钮可导出诊断日志；在微信环境会优先写入用户目录并调用分享能力，不可分享时复制到剪贴板。
- 真机音频采用稳定的 `InnerAudioContext` 回退；即使音频创建、加载或播放失败，也只记录音频错误，不会中断物理循环或把游戏切成卡死状态。
- 微信横屏逻辑高度固定为 `1080`，逻辑宽度按安全区宽高比在 `1920–2880` 之间计算；19.5:9、20:9 等宽屏会显示更宽的地图，不再把 1920 画面强行拉满，也不会横向拉伸人物、门、平台或 UI。
- 单屏关只延展最外侧地面的真实绘制与碰撞边缘，内部坑宽、出生点、门和机关坐标不变；多屏关继续按每屏 1920 计算。极端超宽屏在 2880 以外使用深青灰底与柔和边缘，并禁止柔边区域响应游戏触控。
- 网页和 Android 版本仍固定使用 `1920×1080`；本次响应式规则只在 `__wxMiniGame` 环境生效。

## 从网页主线同步

微信运行文件必须由同步脚本生成，不要直接手改 `js/smart-egg-game.js`：

```bash
node wechat_minigame/tools/sync-web-runtime.js
node wechat_minigame/tools/sync-web-runtime.js --check
```

脚本会同步网页游戏逻辑、20 关离线包、碰撞模块和正式机制模块，并注入微信隔离环境、内嵌关卡冷启动及系统键盘适配。每个同步文件都会输出带时间、模块、字节数和 SHA-256 的结构化诊断记录；`--check` 只校验、不写文件。

## 自动验证

```bash
node --check wechat_minigame/js/smart-egg-game.js
node wechat_minigame/tests/smoke-test.js
node wechat_minigame/tests/responsive-viewport-test.js
```

冒烟测试固定检查：v185 适配层、20/20 关卡内嵌、创造秘境不可达且数据未清理、三页选关、冷启动无致命错误、A/D/空格/Shift、10 项输入回归、辅助模块同源、稳定 InnerAudio 播放/销毁以及包含故障恢复信息的原生日志导出。响应式矩阵测试覆盖 16:9、19.5:9、20:9、安全区偏移与 DPR 3、窄横屏 contain、极端超宽柔边、输入坐标换算和无横向拉伸；冒烟测试另外核对单屏地面外边延展、内部断崖不变及三屏地图仍为 5760 宽。

## 日志与独立调试

运行日志采用结构化事件，包含时间、等级、模块、事件、会话及非敏感上下文。主运行时日志为内存环形缓冲，最多 10000 条；高频 `physics` 模块在生产默认关闭，避免影响帧率。密码、令牌、授权头、Cookie、私钥等字段会递归脱敏，错误文本中的 Bearer、Token 查询参数与 JWT 也会脱敏。

可在开发者工具调试控制台中使用：

```js
_logModuleStatus()                         // 查看各模块开关
_setLogModule('input', false)              // 独立关闭输入日志
_setLogModule('collide', true)             // 独立开启碰撞日志
_setLogModule('viewport', true)            // 独立开启主运行时视口日志
_findLogs('', 'level-load')                // 只筛选关卡加载
_findLogs('', 'viewport')                  // 只筛选逻辑视口和地图适配
_findLogs('error')                         // 筛选错误事件
__debug.getViewportLayout()                // 当前逻辑视口、世界边界、相机与 backing size
__debug.inspectLevelViewport(__SMART_EGG_LEVELS__[3]) // 对比关卡适配前后，原数据不被修改
_exportLogs()                              // 导出完整诊断包
```

主要模块包括 `runtime`、`viewport`、`feature`、`state`、`input`、`level-load`、`collide`、`audio`、`storage`、`network`、`export` 和各 `mechanic:*` 子模块。微信适配层另保留最多 200 条 `wechat-adapter:*` 日志，并随诊断包一起导出；每条带独立 `sessionId` 和递增 `seq`。通过 `__SMART_EGG_ADAPTER_LOG_CONFIG__.getModules()`、`.setModule('viewport', false)` 和 `.find('viewport', 'viewport-updated')` 可独立开关及筛选安全区、逻辑尺寸、显示区域和边缘策略；其他模块也可使用相同方式单独调试。低频、可执行的 `audio-core` 生命周期与失败日志在生产默认开启；高频 `input`、`audio` 详情在生产默认关闭，需要复现时分别执行 `.setModule('input', true)` 或 `.setModule('audio', true)`。`runtime`、`viewport`、`feature`、`storage`、`network`、`export` 同样默认开启。复现完成后关闭高频模块；不要在日志里手工附加 AppSecret、AccessToken、用户隐私或其他敏感信息。

v184 会持久化精简的 `previousFault` 和 `lastFault`，每条故障中的 `lastAction` 记录故障前最后动作；完整逐帧日志仍只保存在有上限的内存环形缓冲中。若真机已经卡住、来不及手动导出，直接关闭并重新打开游戏，在首页右上角点击日志导出，新的诊断包会带回上次会话的异常与最后动作。

## 工程结构

- `game.js`：微信小游戏入口和加载顺序。
- `js/wechat-adapter.js`：微信 Canvas、触控、键盘、音频、存储、生命周期和日志导出适配。
- `js/levels.js`：20 个正式关卡的内嵌离线数据。
- `js/physics-collision.js`：主线碰撞模块。
- `js/accepted-mechanics.js`：第 13–20 关正式机制模块。
- `js/smart-egg-game.js`：由同步脚本生成的 v185 微信运行时。
- `tools/sync-web-runtime.js`：确定性同步与一致性检查。
- `tests/smoke-test.js`：微信隔离环境启动和功能回归。
- `tests/responsive-viewport-test.js`：安全区比例、逻辑宽度、等比呈现、输入换算和超宽柔边矩阵回归。

## 正式上线前仍需人工完成

- 使用正式账号重新编译，核对 AppID `wx6f83b5cdbf65041b` 与后台主体一致。
- 在至少一台 iOS 和一台 Android 真机完成 20 关抽样、触控组合、音频、横屏、安全区和日志导出检查。
- 至少用一台 16:9 和一台 19.5:9/20:9 设备核对人物、门、按钮绝对大小一致，宽屏只增加左右地图；检查带刘海安全区的显示边界和触控坐标，并在可用条件下抽查极端超宽柔边。
- 第一关先移动两步再跳跃，确认人物继续响应且物理帧持续推进；在设备无声或模拟音频失败时，确认游戏仍可移动和跳跃、不会卡死。
- 制造或保留一次可识别异常后重开游戏，从首页右上角导出日志，确认同时包含 `previousFault`、`lastFault` 和其中的 `lastAction`。
- 核对小程序名称、图标、隐私声明、类目、备案/版号及审核材料是否与后台一致。
- 通过“预览”验证后再点“上传”；本次代码准备不会自动执行上传或提交审核。
