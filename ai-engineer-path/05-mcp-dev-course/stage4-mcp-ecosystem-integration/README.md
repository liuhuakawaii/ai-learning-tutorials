# 第 4 阶段：MCP 生态集成

> 将 MCP 融入现有的 AI 应用和 Agent 系统

## 学习目标

- 学会实现自己的 MCP Client SDK
- 掌握将 MCP Tool 接入 LangGraph / OpenAI Agents SDK 的方法
- 理解 MCP 的安全模型：OAuth 2.1 / API Key / mTLS
- 能够构建一个多 MCP Server 的 Agent 系统

## 课时安排

| 序号 | 主题 | 预计时长 |
|------|------|----------|
| 01 | Client 开发 — 实现自己的 MCP Client SDK | 3h |
| 02 | Agent 集成 — 将 MCP Tool 接入 LangGraph / OpenAI Agents SDK | 3h |
| 03 | 安全模型 — 认证（OAuth 2.1）、授权、速率限制、输入校验 | 3h |
| 04 | 多 Server 管理 — 一个 Agent 连接多个 MCP Server 的架构 | 3h |
| 05 | 社区生态 — 使用和贡献开源 MCP Server（filesystem / github / slack） | 2h |
| 06 | 阶段实战：构建一个多 MCP Server 的 Agent 系统并完成安全审计 | 4h |

## 验收标准

- [ ] 自实现的 MCP Client 能与标准 MCP Server 通信
- [ ] Agent 系统能同时连接 3+ 个 MCP Server
- [ ] 通过安全审计：认证、授权、输入校验全部到位
