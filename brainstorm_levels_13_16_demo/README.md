# 《怪奇之原》第 13、15 关独立试玩

这是完全独立于 `web_preview` 主线的第二轮脑洞关卡体验页。它不会读取或改写主线存档、创造模式关卡或进度，也不会发起网络请求。

## 启动与单关复现

从仓库根目录启动本地静态服务：

```bash
python3 -m http.server 8765
```

访问：

- 选关页：`http://localhost:8765/brainstorm_levels_13_16_demo/`
- 单关入口：在地址后加 `?level=13` 或 `?level=15`

## 操作

- 移动：`A / D`、方向键，或画面左下角按钮
- 跳跃：空格、`W`、上方向键，或画面右下角按钮
- 重来：`R` 或顶部回转箭头
- 暂停：`P`、`Esc` 或顶部暂停按钮
- 提示：顶部问号；每次进关和重来都默认关闭

两关的具体做法只写在各关提示按钮中：第 13 关支持键盘双键和触屏双指；第 15 关支持一条连续指针轨迹。第 15 关不会在场景中显示起点、终点或画笔引导，失败反馈也只描述结果，不直接揭示完整解法。

## 日志与独立调试

右上角“诊断日志”会导出 JSON。日志只保存在当前页面内存中，最多 1000 条，刷新后自动清空；不会上传后端。

模块可独立开关：

- `runtime`：启动、未捕获异常、运行环境
- `state`：进关、提示、暂停、重来、通关、返回
- `input`：键盘、触点、虚拟按键与输入清理
- `gesture`：连续轨迹起止与拒绝原因
- `mechanic:level13`、`mechanic:level15`：每关专属状态变化
- `physics`：坠落等物理诊断，默认关闭以避免噪声
- `render`：画布尺寸及绘制异常
- `export`：日志导出动作

浏览器控制台可使用：

```js
__brainstormRound2.getState()
__brainstormRound2.enterLevelById(15)
__brainstormRound2.restart()
__brainstormRound2.showSelection()
__brainstormRound2.setLogModule('physics', true)
__brainstormRound2.setLogModule('mechanic:level15', false)
__brainstormRound2.setLogLevel('debug')
__brainstormRound2.logs.snapshot()
```

日志包含时间、会话/追踪 ID、模块、级别、事件、当前关卡和非敏感上下文。`password`、`token`、`secret`、`authorization`、`cookie`、`session_key`、`openid` 等字段自动脱敏，字符串和嵌套深度也有限制。

## 验证

```bash
node --check brainstorm_levels_13_16_demo/game.js
node --check brainstorm_levels_13_16_demo/logger.js
node --check brainstorm_levels_13_16_demo/logic.js
node brainstorm_levels_13_16_demo/tests/smoke-test.js
```

生产式默认设置只保留有意义的操作与状态日志，关闭高频物理日志。发生问题时先按模块开启，再复现一次并导出 JSON。
