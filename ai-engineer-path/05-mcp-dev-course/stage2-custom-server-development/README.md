# 第 2 阶段：自定义 Server 开发

> 掌握 MCP Server 的三种核心原语开发

## 学习目标

- 掌握 MCP Server 的三种核心原语：Tool / Resource / Prompt
- 学会为数据库、API、文件系统等后端系统开发 MCP Server
- 理解 MCP Server 的错误处理、超时、降级策略
- 能够开发一个功能完整的 PostgreSQL MCP Server

## 课时安排

| 序号 | 主题 | 预计时长 |
|------|------|----------|
| 01 | Tool 开发 — 从需求分析到 Tool 实现的完整流程 | 3h |
| 02 | Resource 开发 — 让 AI 访问结构化数据（数据库、API、文件） | 3h |
| 03 | Prompt Template — 在 Server 端管理可复用的 Prompt 模板 | 2h |
| 04 | 多原语组合 — 一个 Server 同时提供 Tool + Resource + Prompt | 3h |
| 05 | 错误处理 — MCP Server 的异常处理、超时、降级策略 | 3h |
| 06 | 阶段实战：为 PostgreSQL 数据库开发一个完整的 MCP Server | 4h |

## 验收标准

- [ ] 开发的 MCP Server 支持 Tool + Resource + Prompt 三种原语
- [ ] PostgreSQL MCP Server 能执行查询、获取表结构、管理数据
- [ ] 通过 MCP Inspector 验证所有功能正常
