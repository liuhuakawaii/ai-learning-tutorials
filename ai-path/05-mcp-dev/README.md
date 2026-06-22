# 从零到一：MCP 协议深度开发实战课程

> 掌握 Model Context Protocol 的协议细节与工程实践，成为 AI 工具生态的建设者

## 前置要求

- **必修前置**：[02-ai-agent-engineer-course](../02-ai-agent-engineer-course/)
- **技术基础**：Python 3.12 或 TypeScript，了解 Function Calling 概念
- **建议**：有开发 API 或 SDK 的经验

## 适合谁

- 学完了 02-ai-agent-engineer-course、想深入 MCP 协议的开发者
- 需要为内部系统（数据库、API、文件系统）开发 MCP Server 的工程师
- 想让 AI Agent 安全访问外部工具和数据的技术负责人
- 对 AI 工具生态和协议标准感兴趣的技术架构师

## 学完能做什么

- 深入理解 MCP 协议的设计哲学、消息格式和传输机制
- 开发生产级 MCP Server（支持 Tool / Resource / Prompt 三种原语）
- 实现 MCP Client，将 MCP 工具集成到 Agent 系统中
- 掌握 MCP 的安全模型：认证、授权、速率限制、输入校验
- 为内部系统（数据库、REST API、文件系统）开发 MCP 适配层

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.12 / TypeScript |
| 协议 | MCP (Model Context Protocol) |
| 传输 | stdio / SSE / Streamable HTTP |
| AI API | OpenAI / Claude |
| 工具 | MCP SDK (Python / TypeScript) |
| 安全 | OAuth 2.1 / API Key / mTLS |
| 测试 | MCP Inspector / 自定义测试框架 |
| 部署 | Docker + Docker Compose |

## 学习路线

### 第 1 阶段：MCP 协议深度解析（6 课时）

> 从协议层面理解 MCP，而不只是会调 API

1. MCP 设计哲学 — 为什么需要标准化的工具协议，USB 类比的深入解读
2. 协议架构 — Host / Client / Server 三层模型与消息流
3. 消息格式详解 — JSON-RPC 2.0 在 MCP 中的应用
4. 传输层 — stdio / SSE / Streamable HTTP 的选型与实现
5. 能力协商 — Client 与 Server 的能力发现与协商机制
6. 阶段实战：用原始 HTTP 请求实现一个最小 MCP 通信（不用 SDK）

### 第 2 阶段：自定义 Server 开发（6 课时）

> 掌握 MCP Server 的三种核心原语开发

1. Tool 开发 — 从需求分析到 Tool 实现的完整流程
2. Resource 开发 — 让 AI 访问结构化数据（数据库、API、文件）
3. Prompt Template — 在 Server 端管理可复用的 Prompt 模板
4. 多原语组合 — 一个 Server 同时提供 Tool + Resource + Prompt
5. 错误处理 — MCP Server 的异常处理、超时、降级策略
6. 阶段实战：为 PostgreSQL 数据库开发一个完整的 MCP Server

### 第 3 阶段：高级 MCP 模式（6 课时）

> 超越基础 CRUD，实现复杂的 MCP 工具生态

1. 动态 Tool 注册 — 运行时根据上下文动态暴露 Tool
2. 流式响应 — 长时间运行 Tool 的进度通知与流式输出
3. 嵌套调用 — Tool 内部调用其他 Tool 的编排模式
4. 批量操作 — 高效处理批量请求的 MCP 模式
5. 状态管理 — 有状态 Server 的设计与会话管理
6. 阶段实战：开发一个支持动态 Tool 的智能 API Gateway MCP Server

### 第 4 阶段：MCP 生态集成（6 课时）

> 将 MCP 融入现有的 AI 应用和 Agent 系统

1. Client 开发 — 实现自己的 MCP Client SDK
2. Agent 集成 — 将 MCP Tool 接入 LangGraph / OpenAI Agents SDK
3. 安全模型 — 认证（OAuth 2.1）、授权、速率限制、输入校验
4. 多 Server 管理 — 一个 Agent 连接多个 MCP Server 的架构
5. 社区生态 — 使用和贡献开源 MCP Server（filesystem / github / slack）
6. 阶段实战：构建一个多 MCP Server 的 Agent 系统并完成安全审计

### 最终项目

详见 [final-project/项目说明.md](./final-project/项目说明.md)

开发一套企业内部 MCP 工具集：数据库查询 Server + REST API 适配 Server + 文件系统 Server，集成到 Agent 系统中，含完整的安全认证和权限控制。

## 学习建议

1. **先学完 02 课程**：本课程假设你已了解 Agent 和基本的工具调用概念
2. **用 MCP Inspector 调试**：官方调试工具是开发 MCP Server 的必备利器
3. **关注安全**：MCP Server 暴露的是真实系统能力，安全设计不能跳过
4. **阅读协议规范**：[spec.modelcontextprotocol.io](https://spec.modelcontextprotocol.io) 是最权威的参考

## 参考官方文档

- [MCP 协议规范](https://spec.modelcontextprotocol.io)
- [MCP 官方文档](https://modelcontextprotocol.io)
- [Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk)
- [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Server 示例库](https://github.com/modelcontextprotocol/servers)
