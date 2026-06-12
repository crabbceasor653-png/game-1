# 06 - 开发日志格式

## 文件命名

- 使用 `devlogs/YYYY-MM-DD.md`。
- 每天一个文件。
- 同一天的内容只追加，不覆盖历史。

## 推荐结构

```md
# YYYY-MM-DD

## 09:30 - Session start
- Completed:
- In progress:
- To do:
- Blockers:
- Decisions:
- Verification:
```

## 写入规则

- 每次开工先写一条。
- 每次收工再写一条。
- 语言要短，尽量写事实，不写空话。
- 完成事项、待办事项、阻塞项、关键决策都要保留。

## 自动化约定

- 优先使用 `node scripts/devlog.mjs` 生成或追加当日日志。
- 如果脚本不可用，也要手动维护同样结构的 Markdown。

