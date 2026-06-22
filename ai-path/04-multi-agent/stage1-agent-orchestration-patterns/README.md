# 第 1 阶段：Agent 编排模式

> 理解多 Agent 系统的核心设计模式

## 学习目标

- 理解单 Agent 的局限性和多 Agent 协作的价值
- 掌握 Supervisor / Sequential / Parallel / Hierarchical 四种核心编排模式
- 学会根据任务特征选择合适的编排模式
- 能够用纯 Python 实现多 Agent 编排的最小原型

## 课时安排

| 序号 | 主题 | 预计时长 |
|------|------|----------|
| 01 | 从单 Agent 到多 Agent — 为什么需要多个 Agent 协作 | 2h |
| 02 | 编排模式概览 — Supervisor / Sequential / Parallel / Hierarchical | 2h |
| 03 | Supervisor 模式 — 一个管理者调度多个专家 Agent | 3h |
| 04 | Sequential Pipeline — 按顺序传递的链式 Agent 工作流 | 3h |
| 05 | Parallel Fan-out — 并行执行后聚合的 Map-Reduce 模式 | 3h |
| 06 | 阶段实战：用纯 Python 实现一个多 Agent 编排的最小原型 | 4h |

## 验收标准

- [ ] 能画出四种编排模式的架构图并解释适用场景
- [ ] 用纯 Python 实现至少两种编排模式
- [ ] 完成一个包含 3 个 Agent 的编排原型并成功运行
