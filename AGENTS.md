# AGENTS.md

## 工作总则

1. 先读 `docs/README.md`，再按顺序读相关标准文件。
2. 任何实现都以 `docs/` 为准；若文档与代码冲突，先修文档或同步更新文档。
3. 每次开始工作前，先更新当天的 `devlogs/YYYY-MM-DD.md`。
4. 每次结束工作后，再补一次日志，写清完成事项、待办事项、阻塞项和关键决策。
5. 新增文件前，先确认它能在 `docs/04-implementation-plan.md` 或 `docs/06-devlog-format.md` 中找到依据。
6. 这个项目保持纯前端，不引入后端、账号、数据库或联网依赖。
7. 需要调整范围时，先改 `docs/`，再改代码。

## 标准路径

- `docs/README.md`：文档入口与阅读顺序
- `docs/01-requirements.md`：游戏需求、范围、非目标、成功标准
- `docs/02-technical-spec.md`：技术架构、状态机、数据流、存储、音频
- `docs/03-design-spec.md`：视觉风格、布局、色彩、字体、交互规范
- `docs/04-implementation-plan.md`：执行步骤、依赖关系、落地顺序
- `docs/05-acceptance-criteria.md`：验收清单、测试场景、性能阈值
- `docs/06-devlog-format.md`：开发日志模板与写入规则
- `devlogs/YYYY-MM-DD.md`：每日开发日志
- `scripts/dev-server.mjs`：本地静态开发服务器
- `scripts/devlog.mjs`：创建和追加当日日志
- `scripts/browser-smoke.mjs`：无依赖浏览器冒烟测试

## 执行流程

1. 查看当前仓库状态和最新日志。
2. 按文档定义的优先级推进任务。
3. 修改代码前先确认对应文档是否需要同步更新。
4. 实现后做本地验证，再把结果写回日志。
5. 如果发现需求缺失，先补 `docs/`，不要直接靠猜。

## 验证命令

- `node --check src/main.js`
- `node --check scripts/dev-server.mjs`
- `node --check scripts/devlog.mjs`
- `node --check scripts/browser-smoke.mjs`
- `npm run smoke`
