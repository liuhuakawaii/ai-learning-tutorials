# 从零到一：多 Agent 编排实战课程

> 从单 Agent 到多 Agent 协作，掌握企业级 AI Agent 编排的核心模式

## 适合谁

- 学完了 02-ai-agent-engineer-course、想进一步提升 Agent 能力的开发者
- 需要让多个 AI Agent 协作完成复杂任务的团队
- 对 LangGraph、CrewAI 等多 Agent 框架感兴趣的技术人员
- 想了解 Human-in-the-loop 审批流设计的产品工程师

## 学完能做什么

- 掌握 Supervisor / Hierarchical / Debate 等主流多 Agent 编排模式
- 用 LangGraph 构建复杂的多 Agent 工作流
- 设计 Agent 间的通信协议、共享记忆、冲突解决机制
- 实现 Human-in-the-loop 审批流，让人类在关键节点介入
- 部署和监控生产级多 Agent 系统

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.12 |
| Agent 框架 | LangGraph / CrewAI / AutoGen |
| AI API | OpenAI / Claude |
| 通信 | Redis Pub/Sub / 内部消息队列 |
| 状态管理 | PostgreSQL + Redis |
| 监控 | LangSmith / Langfuse（复用 03 课程） |
| 前端 | Streamlit / Next.js（审批面板） |
| 部署 | Docker + Docker Compose |

## 学习路线

### 第 1 阶段：Agent 编排模式（6 课时）

> 理解多 Agent 系统的核心设计模式

1. 从单 Agent 到多 Agent — 为什么需要多个 Agent 协作
2. 编排模式概览 — Supervisor / Sequential / Parallel / Hierarchical
3. Supervisor 模式 — 一个管理者调度多个专家 Agent
4. Sequential Pipeline — 按顺序传递的链式 Agent 工作流
5. Parallel Fan-out — 并行执行后聚合的 Map-Reduce 模式
6. 阶段实战：用纯 Python 实现一个多 Agent 编排的最小原型

### 第 2 阶段：LangGraph 多 Agent 实战（6 课时）

> 用 LangGraph 构建生产级多 Agent 系统

1. LangGraph 核心概念 — State / Node / Edge / Conditional Edge
2. 构建第一个多 Agent 图 — 用 LangGraph 实现 Supervisor 模式
3. 子图与嵌套 — 让 Agent 自身也是一个 LangGraph 图
4. 状态管理 — Agent 间共享状态的设计与实现
5. 错误处理与重试 — Agent 失败时的降级和恢复策略
6. 阶段实战：用 LangGraph 构建一个多 Agent 研究助手

### 第 3 阶段：通信与记忆（6 课时）

> 解决多 Agent 系统中的核心难题

1. Agent 通信模式 — 直接调用 / 消息传递 / 共享黑板
2. 短期记忆 — 会话上下文在 Agent 间的传递策略
3. 长期记忆 — 跨会话的知识持久化与检索
4. 共享工作空间 — Agent 间的文件/数据共享机制
5. 冲突解决 — 多个 Agent 给出不同结果时的仲裁策略
6. 阶段实战：为多 Agent 系统实现完整的通信与记忆层

### 第 4 阶段：人机协作（6 课时）

> 让人类在关键节点介入，而不是完全放手

1. Human-in-the-loop 设计哲学 — 什么环节需要人类介入
2. 审批节点实现 — 在 LangGraph 中添加人工审批 gate
3. 异步审批流 — 长时间运行任务的人工介入机制
4. 反馈回路 — 人类反馈如何影响 Agent 后续行为
5. 审批面板开发 — 构建一个可视化的审批 UI
6. 阶段实战：实现一个带审批流的多 Agent 内容生成系统

### 第 5 阶段：生产级多 Agent 系统（6 课时）

> 从原型到生产的关键跨越

1. 可观测性 — 多 Agent 系统的追踪、日志、指标设计（复用 03 课程）
2. 性能优化 — 并发控制、Token 预算、调用限流
3. 测试策略 — 多 Agent 系统的单元测试 / 集成测试 / 端到端测试
4. 部署架构 — 容器化部署、服务发现、负载均衡
5. 安全边界 — Agent 权限隔离、输出审核、越权防护
6. 阶段实战：将多 Agent 系统部署到生产环境并完成压力测试

### 最终项目

详见 [final-project/项目说明.md](./final-project/项目说明.md)

构建一个多 Agent 研究助手：搜索 Agent 收集信息 → 分析 Agent 提取洞察 → 写作 Agent 生成报告 → 审核 Agent 质量把关，含人类审批节点。

## 学习建议

1. **先学完 02 课程**：本课程假设你已掌握单 Agent 开发
2. **从最简单的模式开始**：先用纯 Python 实现，再用框架，理解原理比会用工具重要
3. **关注成本**：多 Agent 系统的 Token 消耗是单 Agent 的数倍，学会控制预算
4. **用 03 课程的评估方法**：多 Agent 系统更需要系统化的评估

## 参考官方文档

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/)
- [CrewAI 文档](https://docs.crewai.com/)
- [AutoGen 文档](https://microsoft.github.io/autogen/)
- [OpenAI Agents SDK](https://platform.openai.com/docs/guides/agents-sdk)
