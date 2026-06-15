# 阶段 4：Agent 架构——让应用能自主行动

## 阶段目标

设计完整的 Agent 工具体系、状态管理、记忆系统和多 Agent 协作机制。让 AI 不只是"回答问题"，而是"完成任务"。

## 课时安排

| 课时 | 文件 | 主题 | 预计时间 |
|------|------|------|----------|
| 1 | [01-Agent设计哲学.md](./01-Agent设计哲学.md) | ReAct、Plan-and-Execute、工具增强、设计范式对比 | 3h |
| 2 | [02-工具设计规范.md](./02-工具设计规范.md) | 输入 Schema、输出协议、错误边界、幂等性 | 3h |
| 3 | [03-Function-Calling实战.md](./03-Function-Calling实战.md) | 从 API 定义到模型调用的完整链路 | 3h |
| 4 | [04-MCP协议深度解析.md](./04-MCP协议深度解析.md) | 协议规范、Server/Client 实现、工具注册与发现 | 4h |
| 5 | [05-Agent状态机.md](./05-Agent状态机.md) | 生命周期、持久化、断点恢复、错误回滚 | 3h |
| 6 | [06-短期记忆与长期记忆.md](./06-短期记忆与长期记忆.md) | 上下文管理、会话摘要、用户画像、向量记忆 | 3h |
| 7 | [07-多Agent协作.md](./07-多Agent协作.md) | 角色分工、消息传递、冲突解决、监督者模式 | 4h |
| 8 | [08-阶段实战-AI研究助手Agent.md](./08-阶段实战-AI研究助手Agent.md) | 完整 Agent 系统 | 5h |

## 实战任务

构建 **AI 研究助手 Agent**：

- 多工具调用：搜索、数据库查询、文件操作、API 调用
- MCP 工具集成：标准协议接入外部工具
- Agent 状态机：支持暂停、恢复、人工确认
- 短期记忆（会话内）+ 长期记忆（跨会话）
- 多 Agent 协作：研究员 Agent + 审核员 Agent + 写手 Agent
- 工具调用链路追踪和调试界面

## 验收标准

- [ ] Agent 能根据任务自动选择和调用工具
- [ ] MCP Server 可以被标准 MCP Client 发现和调用
- [ ] Agent 状态机支持 pause / resume / human-in-the-loop
- [ ] 记忆系统能跨会话保持用户偏好和历史上下文
- [ ] 多 Agent 协作能完成复杂研究任务（搜索 → 分析 → 报告）
- [ ] 工具调用链路完整可观测，出错能定位到具体工具和参数

## 技术栈

| 组件 | 技术 |
|------|------|
| Agent 框架 | LangGraph / OpenAI Agents SDK |
| MCP | MCP Python SDK / TypeScript SDK |
| 工具注册 | 自研 Tool Registry |
| 状态管理 | LangGraph State / 自研状态机 |
| 记忆系统 | PostgreSQL + pgvector + Redis |
| 搜索工具 | Tavily / Serper / 自研爬虫 |
