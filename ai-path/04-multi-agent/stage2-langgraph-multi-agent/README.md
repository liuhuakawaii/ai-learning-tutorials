# 第 2 阶段：LangGraph 多 Agent 实战

> 用 LangGraph 构建生产级多 Agent 系统

## 学习目标

- 掌握 LangGraph 的核心概念：State / Node / Edge / Conditional Edge
- 学会用 LangGraph 实现 Supervisor 模式的多 Agent 系统
- 理解子图嵌套、状态管理、错误处理等高级特性
- 能够构建一个完整的多 Agent 研究助手

## 课时安排

| 序号 | 主题 | 预计时长 |
|------|------|----------|
| 01 | LangGraph 核心概念 — State / Node / Edge / Conditional Edge | 3h |
| 02 | 构建第一个多 Agent 图 — 用 LangGraph 实现 Supervisor 模式 | 3h |
| 03 | 子图与嵌套 — 让 Agent 自身也是一个 LangGraph 图 | 3h |
| 04 | 状态管理 — Agent 间共享状态的设计与实现 | 3h |
| 05 | 错误处理与重试 — Agent 失败时的降级和恢复策略 | 2h |
| 06 | 阶段实战：用 LangGraph 构建一个多 Agent 研究助手 | 4h |

## 验收标准

- [ ] 用 LangGraph 实现一个包含 3+ Agent 的 Supervisor 系统
- [ ] 实现子图嵌套，至少一个 Agent 内部有自己的工作流
- [ ] 研究助手能完成"搜索 → 分析 → 总结"的完整流程
