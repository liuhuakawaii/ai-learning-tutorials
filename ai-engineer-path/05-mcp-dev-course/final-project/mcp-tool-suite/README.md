# MCP Tool Suite

MCP Server 开发练习工具包。包含数据库查询、REST API 适配、文件系统三个 MCP Server 骨架。

## 快速开始

```bash
npm install
npm run check
npm run build
npm run inspector
```

## 目录结构

```
mcp-tool-suite/
├── src/
│   ├── db-server/           # 数据库查询 MCP Server
│   │   └── index.ts
│   ├── api-server/          # REST API 适配 MCP Server
│   │   └── index.ts
│   ├── fs-server/           # 文件系统 MCP Server
│   │   └── index.ts
│   └── shared/
│       └── auth.ts          # 共享认证模块
├── scripts/
│   └── check.cjs            # 结构验证
├── reports/
│   ├── stage1-protocol.md
│   ├── stage2-server-dev.md
│   ├── stage3-advanced.md
│   └── stage4-integration.md
├── package.json
└── tsconfig.json
```

## 学习路径

1. 阶段一：阅读协议消息格式，用原始 HTTP 实现 MCP 通信
2. 阶段二：开发 `db-server`，实现 Tool/Resource/Prompt 三种原语
3. 阶段三：扩展 `api-server`，实现动态 Tool 注册
4. 阶段四：集成到 Agent 系统，完成安全审计
