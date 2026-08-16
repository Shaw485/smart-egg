# 《大聪明脑洞蛋》Godot 4.x 使用指南
（面向新手小白 · 手把手教学）

---

## 📋 你需要先准备什么

### 1. 下载 Godot 4.x 编辑器
| 步骤 | 操作 | 截图提示 |
|------|------|----------|
| 1 | 打开官网 https://godotengine.org/download | 点击蓝色大按钮「Download」 |
| 2 | 选择 **Godot 4.x**（推荐 4.2 或更高稳定版） | 不要下 Godot 3.x，语法不一样 |
| 3 | 下载 macOS 版本：`Godot_v4.x-stable_macos.universal.zip` | `.universal` 支持 Intel 和 Apple Silicon |
| 4 | 解压 zip，把 `Godot.app` 拖到「应用程序」文件夹 | 和装其他 Mac App 一样 |
| 5 | 首次打开可能提示「无法验证开发者」 | 右键点 App → 打开 → 弹窗里再点「打开」 |

> 💡 **什么是 Godot？** 一个免费开源的游戏引擎（类似 Unity，但更轻量、不用付费），PRD 明确指定用它。你现在下载的是「编辑器」，用来打开我们的工程文件。

---

## 🚀 第一步：打开我们的 Godot 工程

### 步骤详解（跟着点，不要漏）

1. 打开 Godot.app，会看到「项目管理器」窗口
2. 右上角点击 **「导入」** 按钮（不是「新建」！）
3. 在弹出的文件选择框里，导航到这个文件夹：
   ```
   /Users/bytedance/Documents/trae_projects/game/godot_project
   ```
4. 选中里面的 **`project.godot`** 文件，点「打开」
5. 项目管理器里会出现一行「大聪明脑洞蛋」，**双击它** 进入编辑器

> ✅ 成功标志：编辑器窗口左上角显示 `1920 × 1080`，中间有空白场景，底部有 `Output` 面板没有红色错误。

---

## 🎮 第二步：运行游戏（F5 快捷键）

### 怎么运行
- 方法 A（最快）：**按键盘 F5**
- 方法 B：点右上角那个 ▶️ 「播放」按钮（三角形图标）

### 运行后会看到什么
1. 弹出一个 1920×1080 的横屏游戏窗口
2. **主菜单页**：
   - 两行投影大字：「大聪明」+「脑洞蛋」
   - 中间一个超大圆角贴纸风按钮：「开始游戏」
   - 点击它 → 进入第 1 关

3. **第 1 关《进门就过关了!》**：
   - 操作（PRD 教学关设计）：
     - `← →` 或 `A / D` = 左右移动
     - `空格` 或 `↑` 或 `W` = 跳跃
   - 正解路径（所见即所得，为后续反套路铺垫）：
     1. 从左下角起点向右走
     2. 跳上第一级台阶（中间那个矮平台）
     3. 再跳上第二级台阶（右边那个高平台）
     4. 走进右上角写着 EXIT 的门 → 自动通关

4. **通关页**：
   - 「🎉 恭喜通关！」大字
   - 「再玩一次」按钮 → 点击重来

> 🐛 如果运行报错，截图底部 Output 面板的红色文字，发给开发排查。

---

## 🧱 工程目录结构（加关 / 改图 前先看懂）

```
godot_project/
├── project.godot          ← 工程配置文件（分辨率/Autoload/输入映射），一般不用动
├── levels/                ← ✨ 数据驱动：加关只改这里 ✨
│   └── level_0.json       ← 第 1 关完整配置（平台/门/装饰的坐标和尺寸）
├── scenes/                ← 4 个场景模板（相当于预制体 Prefab）
│   ├── Player.tscn        ← 玩家蛋蛋（含胶囊碰撞体 + Player.gd 脚本）
│   ├── Platform.tscn      ← 平台 / 地面（静态碰撞体）
│   ├── Door.tscn          ← 门（Area2D 检测进入）
│   └── Main.tscn          ← 主场景（包含菜单层 + UI 层）
└── scripts/               ← 10 个 GDScript 脚本（游戏逻辑）
    ├── GameManager.gd     ← 全局状态机（菜单/选关/游戏中/暂停/通关）
    ├── SaveManager.gd     ← 存档读写（解锁到第几关、总脑洞数）
    ├── LevelLoader.gd     ← 读 JSON → 生成关卡物体的核心加载器
    ├── UIManager.gd       ← 贴纸风 UI 绘制（顶栏/底栏/状态栏）
    ├── Player.gd          ← 玩家物理 + 手绘蛋蛋绘制
    ├── Platform.gd        ← 平台贴纸风绘制
    ├── Door.gd            ← 门碰撞检测 + EXIT 标签绘制
    ├── DoodleDecor.gd     ← 4 种装饰：文字/云气泡/箭头/终点旗
    ├── Main.gd            ← 主场景调度（键盘→玩家操作）
    └── MenuController.gd  ← 主菜单 GUI + 开始按钮点击
```

---

## ➕ 第三步：怎么加第 2 关（数据驱动！只加 JSON）

### 核心原则（PRD 设计）
> 加关 = 复制 `level_0.json` → 改名叫 `level_1.json` → 改里面的坐标 → 搞定！**不用改一行 GDScript。**

### 手把手操作

#### 步骤 1：复制 JSON 模板
在 Finder 里找到：
```
godot_project/levels/level_0.json
```
按 `Command + D` 复制一份，重命名为：
```
level_1.json
```

#### 步骤 2：打开 level_1.json 修改内容
用任何代码编辑器（VS Code / 文本编辑都行）打开，修改以下字段：

| 字段 | 改什么 | 示例 |
|------|--------|------|
| `id` | 改成 1（每关 +1） | `"id": 1` |
| `name` | 第 2 关的标题 | `"name": "我就不进门!"` |
| `type` | tutorial→normal | `"type": "normal"` |
| `spawn` | 玩家出生点坐标 `{x, y}` | `{"x": 220, "y": 850}` |
| `platforms` | 平台数组，每个 = `{x, y, w, h}` | 想放几块放几块 |
| `doors` | 门数组，**必须有一个 `is_goal: true`** 作为通关门 | 看下面示例 |
| `decor` | 装饰数组（可选）：提示文字/云/箭头/旗 | 可不填 `[]` |

#### 步骤 3：保存 JSON → 告诉 GameManager 有新关了
打开 `godot_project/scripts/GameManager.gd`，找到：
```gdscript
const LEVEL_COUNT := 1    # 改成 2！
```
改完按 `Command + S` 保存。

#### 步骤 4：重新运行 F5，第 2 关已解锁！

### 💡 坐标系统说明（新手必看）
- Godot 的坐标系：**左上角是 (0, 0)**，X 向右增大，Y 向下增大（和数学坐标系不一样！）
- 我们的画布是 1920×1080：
  - 最左 X=0，最右 X=1920
  - 最顶 Y=0，最底 Y=1080
- `platform.x, platform.y` 是平台 **中心点**
  - 例：主地面 `x=320, y=1020, w=1360, h=120`
  - 实际左边缘 = 320 - 1360/2 = -360（超出画面左边一点没问题）
  - 实际上边缘 = 1020 - 120/2 = 960
  - 实际下边缘 = 1020 + 120/2 = 1080（正好贴画面底部）

---

## 📱 第四步：打包成 Android App（横屏）

### 4.1 准备 Android 导出模板
1. Godot 编辑器菜单：**Editor → Manage Export Templates**
2. 点「下载并安装」（几百 MB，下载一次就行）

### 4.2 配置 Android SDK（一次性操作）
1. 下载 Android Studio：https://developer.android.com/studio
2. 安装完打开，More Actions → SDK Manager → 安装：
   - Android SDK Platform 33（或最新）
   - Android SDK Build-Tools
   - NDK（Side by side）
3. 回到 Godot：Editor → Editor Settings → Export → Android：
   - 设置 `Android SDK Path`：一般是 `~/Library/Android/sdk`
   - Debug Keystore 会自动生成

### 4.3 添加 Android 导出配置
1. 菜单：**Project → Export**
2. 点「添加…」→ 选「Android」
3. 右侧选项卡：
   - **Application**：
     - Package Name = `com.bytedance.brain.egg`（随便写，反向域名格式）
     - Name = `大聪明脑洞蛋`
     - Icon = 自己找一张 1024×1024 的 PNG 拖进去
   - **Display**：
     - Orientation = **Landscape**（横屏！PRD 要求）
     - Resolution = 1920 × 1080（或用 viewport 设置）
4. 点「Export Project」→ 选保存位置 → 生成 `.apk`

### 4.4 安装到手机
1. 安卓手机打开「开发者选项 → USB 调试」
2. USB 连电脑
3. 终端执行：
   ```bash
   adb install /path/to/大聪明脑洞蛋.apk
   ```
4. 手机桌面会出现图标 → 点开就能横屏玩

---

## 🌐 Web 预览版怎么用（不用开 Godot）

不想开 Godot Editor 的话，直接用浏览器玩 Web 版本：

### 方法 A：我已经启动好 HTTP 服务器了
打开浏览器访问：
```
http://localhost:8765/web_preview/index.html
```

### 方法 B：自己启动服务器（如果上面链接打不开）
打开「终端」App，执行：
```bash
cd /Users/bytedance/Documents/trae_projects/game
python3 -m http.server 8765
```
然后浏览器打开上面的地址。

### 操作方法
- 电脑：`← →` 移动，`空格` 跳跃
- 手机：屏幕底部三个大黑按钮 = ◀ ▶ ▲

---

## 🔧 常见问题 FAQ

**Q1：双击 project.godot 后 Godot 报错「缺少脚本」？**
→ 检查 `godot_project/scripts/` 文件夹下 10 个 .gd 文件是否都在。

**Q2：按 F5 后玩家不会动？**
→ 确认焦点在游戏窗口里（点一下窗口再按方向键）。

**Q3：玩家掉下去出画面了？**
→ level_x.json 的主地面平台没放对位置，检查 platform.y 是否接近 1020（贴底）。

**Q4：改了 JSON 没效果？**
→ Godot 重新运行（关了再 F5），或 Web 版强制刷新浏览器 `Cmd + Shift + R`。

**Q5：贴纸风 / 投影字 / 顶栏按钮 / 底部操作键显示不对？**
→ 打开 `UIManager.gd`（Godot版）或 `game.js`（Web版），检查 draw 函数的坐标和尺寸。

---

## 📚 想深入学习 Godot？
- 官方文档（中文）：https://docs.godotengine.org/zh-cn/stable/
- B站搜「Godot 4 教程」，推荐 GODOT公开课 系列
- CharacterBody2D 移动教程：搜关键字 `move_and_slide`

