# 《怪奇之原》第 13–42 关连续评审

这是独立于 `web_preview` 主线的 30 关试玩评审页。它不会修改主线关卡、创造模式、Android 或微信小游戏文件，也不发起网络请求。

## 评审流程

1. 页面从第 13 关开始，或从上次未评审的第一关继续。
2. 试玩后点击右上角“加入主关”或“抛弃”。两种选择都会自动进入下一关。
3. 不提供上一关、下一关、跳过或暂不决定，避免评审状态含糊。
4. 第 42 关决定完成后显示加入/抛弃汇总，并提示用户让 Codex 统一处理。
5. 结果只保存在浏览器本机 `localStorage` 的 `guaiqi-level-review-13-42-v1`，主线合并前不改动正式关卡。

每关均在 `levels.js` 保存 `creator` 能力标签。最终加入主线时，可据此同步相应新机制到创造模式。

## 启动

从仓库根目录运行：

```bash
python3 -m http.server 8765
```

访问 `http://localhost:8765/brainstorm_levels_13_16_demo/`。目录名保留旧试玩路径以免已有链接失效；实际内容已升级为第 13–42 关评审版。

开发复现可在地址后加 `?level=13` 至 `?level=42`，该入口只改变当前显示关卡，不会自动生成评审选择。

## 操作

- 移动：`A / D`、方向键，或画面左下角按钮
- 跳跃：空格、`W`、上方向键，或画面右下角按钮
- 重来：`R` 或顶部回转箭头
- 暂停：`P`、`Esc` 或顶部暂停按钮
- 第 28 关冻结：按住画面空白处；电脑也可按住 `Shift`
- 第 21 关密码：触屏数字键盘；电脑也可使用数字键
- 提示：顶部问号；每次进入和重来都默认关闭

## 关卡机制

30 关各有独立机制键，覆盖双键蓄力、逃跑元素、画路、静止计时、反向控制、拖太阳、文字实体、敲门、记忆密码、影子道具、载人平台、角色缩放、长按云、真假门、标题平台、冻结机关、二段跳、朝向条件、拖动终点、隐形平台、镜像坐标、临时桥、动作跟随、地形切换、逃跑钥匙、推箱垫脚、重力翻转、音高顺序、擦除墙体和折返顺序。

难度不按编号递增。每关仅验证一个主要脑洞，允许用户按喜好加入或抛弃。

## 日志与独立调试

右上角“诊断日志”导出 JSON。日志只保存在当前页面内存，最多 1500 条，刷新后清空；评审选择单独本地持久化，不上传后端。

日志模块可独立启用、关闭和过滤：

- `runtime`：启动、未捕获异常与运行模式
- `state`、`ui`：进关、重来、暂停、提示、通关
- `input`、`gesture`：键盘、多触点、拖动、绘制和输入清理
- `review`、`storage`：加入/抛弃、批次完成与本地保存成功/失败
- `mechanic:bridge`、`mechanic:door`、`mechanic:timing`、`mechanic:direction`
- `mechanic:drag`、`mechanic:password`、`mechanic:platform`、`mechanic:transform`
- `mechanic:sound`、`mechanic:erase`：各类玩法状态变化
- `physics`：坠落、尖刺和越界，默认关闭以避免高频噪声
- `render`：画布尺寸、断崖布局和绘制异常
- `audio`、`export`：音效与日志导出

控制台调试接口：

```js
__guaiqiReview.getState()
__guaiqiReview.getReviewResult()
__guaiqiReview.enterLevelById(28)
__guaiqiReview.restart()
__guaiqiReview.setLogModule('physics', true)
__guaiqiReview.setLogModule('mechanic:sound', false)
__guaiqiReview.setLogLevel('debug')
__guaiqiReview.logs.snapshot()
```

日志包含时间、会话/追踪 ID、运行侧、模块、级别、事件、当前关卡和非敏感上下文。`password`、`token`、`secret`、`authorization`、`cookie`、`session_key`、`openid` 等字段自动脱敏。生产式默认级别为 `info`，高频物理和调试日志默认关闭。

## 验证

```bash
node --check brainstorm_levels_13_16_demo/game.js
node --check brainstorm_levels_13_16_demo/levels.js
node --check brainstorm_levels_13_16_demo/logger.js
node --check brainstorm_levels_13_16_demo/logic.js
node brainstorm_levels_13_16_demo/tests/smoke-test.js
```

测试覆盖 30 个连续编号和独立机制、创造模式元数据、加入/抛弃持久化、无跳关流程、输入方式、墨路层级、统一断崖、模块开关、日志脱敏与内存上限。
