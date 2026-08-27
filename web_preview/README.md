# 网页主线调试说明

## 关卡与版本

- 网页主线当前为代码版本 `v166`，共 12 关。
- 第 8–12 关依次为影子机关、静止追门、标题拖字成桥、重来保留箱子、拖动世界。
- 正式关卡数据位于 `../godot_project/levels/level_0.json` 至 `level_11.json`，离线包位于 `../godot_project/levels/levels_bundle.js`。
- `index.html` 的脚本与样式缓存参数已同步为 `v166`。

## 日志与独立调试

首页右上角的日志按钮可以导出 JSON。每条记录包含时间、帧号、会话标识、模块、事件和必要的非敏感状态；当前网页版本没有服务端业务请求，运行时会明确记录关卡数据来自离线包或本地 JSON。

第 8 关会在玩家真实拖动太阳至少 12 个逻辑像素时记录 `mechanic/shadow-drag-armed`；未达到该阈值时，即使走路令影尖经过机关也不会累计开门时间。`__debug.getMechanicState().shadow.moved` 可单独检查该状态。

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
