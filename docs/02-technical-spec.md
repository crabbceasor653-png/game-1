# 02 - 技术规范

## 技术栈

- 原生 HTML
- 原生 CSS
- 原生 JavaScript ES Modules
- 不引入运行时依赖
- 不需要构建工具也可以启动

## 文件职责

- `index.html`：页面骨架和 UI 容器。
- `styles.css`：视觉系统、布局、响应式规则。
- `src/main.js`：游戏主循环、状态机、实体更新、渲染和交互。
- `scripts/dev-server.mjs`：本地静态服务器。
- `scripts/devlog.mjs`：开发日志生成与追加。
- `scripts/browser-smoke.mjs`：本地静态服务 + Headless 浏览器冒烟验证。

## 状态机

- `title`：标题界面。
- `playing`：正常游玩。
- `upgrading`：选择升级。
- `paused`：暂停。
- `gameover`：结算。

状态切换规则：

- `title -> playing`：点击开始或按回车。
- `playing -> upgrading`：经验满后暂停并弹出选择。
- `playing -> paused`：按暂停键。
- `paused -> playing`：继续或再次按暂停键。
- `playing -> gameover`：生命值归零。
- `gameover -> playing`：重开。

## 数据模型

- 玩家：位置、速度、生命、经验、等级、分数、火力、穿透、护盾、吸附范围、相位护盾、再生计数。
- 技能：`skillCharge`、`skillChargeMax`、`starburstTimer`、`starburstFireTimer`、`magneticSurgeTimer`。
- 敌人：类型、位置、速度、生命、接触伤害。
- 子弹：位置、速度、伤害、穿透、寿命。
- 掉落物：位置、速度、价值、吸附状态。
- 粒子：位置、速度、颜色、寿命。
- 升级：id、名称、描述、等级、上限、效果。

## 难度基准

- 新开局玩家生命为 7，移动速度为 225，经验吸附半径为 125。
- 刷怪速率使用 `clamp(0.5 + time * 0.02, 0.5, 3.4)`。
- 同屏敌人上限为 72。
- Runner 约 35 秒后进入刷怪池，Brute 约 80 秒后进入刷怪池。
- 敌人生命成长每 120 秒增加 1。
- 初始升级经验为 10，后续曲线保持早期更快升级。

## 五经验技能

- 每拾取 1 个怪兽掉落经验球，`skillCharge + 1`。
- `skillCharge` 达到 5 时自动释放 `星环齐射`。
- `星环齐射`持续 3 秒，每 0.16 秒向 360° 发射 20 发子弹。
- 技能激活中再次满 5 时延长剩余时间，最高 4.5 秒。
- HUD 必须显示 `Skill 0/5` 到 `Skill 5/5`，激活时显示倒计时。

## 渲染与循环

- 使用 `requestAnimationFrame`。
- 以时间增量驱动更新。
- 更新顺序：输入 -> 角色 -> 敌人 -> 子弹 -> 掉落物 -> 粒子 -> 碰撞 -> 状态结算 -> 渲染。
- Canvas 按设备像素比缩放。

## 输入

- 键盘：WASD / 方向键移动。
- 鼠标：按住拖动进行转向和位移。
- 触屏：按住拖动进行转向和位移。
- 所有输入都不依赖额外插件。

## 存储

- `localStorage.neon-loop.highScore`
- `localStorage.neon-loop.settings`

## 音频

- 使用 Web Audio API 合成简单提示音。
- 首次用户交互后再创建音频上下文。
- 静音状态必须持久化。

## 性能与兼容

- 常见桌面和移动浏览器可用。
- 目标帧率优先，避免重度滤镜和昂贵的每帧分配。
- 代码要能在无构建环境下直接读懂和修改。

## 自动验证

- `npm run smoke` 必须在本机可用浏览器存在时通过。
- 冒烟测试覆盖启动、开始游戏、键盘移动、鼠标拖动、自动刷怪、自动射击、升级、暂停、失败、最高分持久化和移动端尺寸基础布局。
- 浏览器路径可通过 `BROWSER_PATH` 覆盖。
