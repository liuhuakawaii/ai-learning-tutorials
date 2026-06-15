# AI Agent Platform - 毕业项目

企业级 AI Agent 平台，整合课程所有阶段所学。

## 快速启动

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 编辑 .env，填入你的 API Key 和 BASE_URL
# OPENAI_API_KEY=sk-your-key
# OPENAI_BASE_URL=https://api.openai.com/v1  # 或你的代理地址

# 3. 启动所有服务
docker compose up -d

# 4. 访问
# 前端: http://localhost:3000
# 后端 API: http://localhost:8000/docs
# 监控（可选）: docker compose --profile monitoring up -d
# Grafana: http://localhost:3001
```

## 环境变量配置

### AI 模型配置（核心）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENAI_API_KEY` | OpenAI API Key | （必填） |
| `OPENAI_BASE_URL` | OpenAI API 地址 | `https://api.openai.com/v1` |
| `ANTHROPIC_API_KEY` | Anthropic API Key | （可选） |
| `ANTHROPIC_BASE_URL` | Anthropic API 地址 | `https://api.anthropic.com` |
| `DEFAULT_LLM_PROVIDER` | 默认 LLM 提供商 | `openai` |
| `DEFAULT_MODEL` | 默认模型 | `gpt-4o-mini` |

**支持自定义 BASE_URL**：可使用国内代理、私有部署、Azure OpenAI 等兼容接口。

示例配置：
```bash
# 使用 OpenAI 官方
OPENAI_BASE_URL=https://api.openai.com/v1

# 使用国内代理
OPENAI_BASE_URL=https://your-proxy.com/v1

# 使用 Azure OpenAI
OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment/

# 使用兼容 OpenAI 接口的其他服务（如 DeepSeek、Moonshot 等）
OPENAI_BASE_URL=https://api.deepseek.com/v1
DEFAULT_MODEL=deepseek-chat
```

### 模型调用格式

在 API 中可以使用 `provider/model` 格式指定模型：
- `openai/gpt-4o` - 使用 OpenAI 的 gpt-4o
- `anthropic/claude-sonnet-4-20250514` - 使用 Anthropic 的 Claude
- 直接写模型名 `gpt-4o-mini` - 使用默认 provider

### 其他配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql+asyncpg://agent:agent123@localhost:5432/agent_platform` |
| `REDIS_URL` | Redis 连接串 | `redis://localhost:6379/0` |
| `SECRET_KEY` | JWT 签名密钥 | `dev-secret-key-change-in-production` |
| `POSTGRES_PASSWORD` | 数据库密码 | `agent123` |
| `REDIS_PASSWORD` | Redis 密码 | `redis123` |

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Naive UI |
| 后端 | FastAPI + SQLAlchemy 2.0 + Pydantic |
| 数据库 | PostgreSQL 16 + pgvector |
| 缓存 | Redis 7 |
| AI | OpenAI / Claude / 国产模型（支持自定义 BASE_URL） |
| Agent | 自研 Agent 引擎（ReAct + 工具调用） |
| RAG | 自研 RAG Pipeline（文档解析 → 切分 → 检索 → 问答） |
| 工作流 | 自研 DAG 引擎（拓扑排序 + 条件分支） |
| 部署 | Docker + Docker Compose + Nginx |
| 监控 | Prometheus + Grafana + Langfuse |

## 项目结构

```
ai-agent-platform/
├── backend/
│   ├── app/
│   │   ├── api/v1/            # API 路由（auth/chat/agents/knowledge/workflows/skills/stats）
│   │   ├── core/              # 核心（config/database/security/redis）
│   │   ├── models/            # SQLAlchemy 数据模型
│   │   ├── services/          # LLM 服务（多模型适配 + BASE_URL）
│   │   ├── agent/             # Agent 引擎（ReAct 循环 + 工具体系）
│   │   │   └── tools/         # 内置工具（search/calculator）
│   │   ├── rag/               # RAG Pipeline（文档切分 + 检索问答）
│   │   └── workflow/          # 工作流引擎（DAG 拓扑排序执行）
│   ├── alembic/               # 数据库迁移
│   ├── alembic.ini
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/               # API 封装（含所有模块）
│   │   ├── views/             # 页面（Chat/Agents/Knowledge/Workflows/Skills/Settings）
│   │   ├── stores/            # Pinia 状态管理（7 个 Store）
│   │   ├── layouts/           # 布局
│   │   └── router/            # 路由
│   └── Dockerfile
├── nginx/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## 核心功能

### 已实现

1. **用户认证**：注册、登录、JWT 令牌
2. **对话系统**：多轮对话、流式输出、消息持久化、会话管理
3. **Agent 管理**：CRUD、发布、版本控制、System Prompt 配置
4. **知识库管理**：知识库 CRUD、文档上传/删除、RAG 问答
5. **工作流管理**：工作流 CRUD、DAG 执行、JSON 编辑
6. **Skill 市场**：4 种类型（API/Script/Workflow/MCP）、启停控制
7. **运营统计**：用量概览、按日统计、模型维度统计
8. **多模型支持**：OpenAI/Anthropic 统一接口、自定义 BASE_URL
9. **Agent 引擎**：ReAct 循环、工具注册/调用
10. **RAG Pipeline**：文档切分、检索问答、引用溯源
11. **工作流引擎**：拓扑排序、节点执行、错误处理
12. **Redis 集成**：缓存服务、会话缓存、限流器
13. **设置页面**：模型配置展示、系统信息

### API 端点

| 模块 | 端点 | 说明 |
|------|------|------|
| 认证 | `POST /api/v1/auth/register` | 注册 |
| 认证 | `POST /api/v1/auth/login` | 登录 |
| 认证 | `GET /api/v1/auth/me` | 当前用户 |
| 对话 | `GET /api/v1/chat/sessions` | 会话列表 |
| 对话 | `POST /api/v1/chat/sessions` | 创建会话 |
| 对话 | `POST /api/v1/chat/sessions/{id}/messages` | 发送消息 |
| 对话 | `POST /api/v1/chat/sessions/{id}/messages/stream` | 流式消息 |
| 对话 | `DELETE /api/v1/chat/sessions/{id}` | 删除会话 |
| 对话 | `GET /api/v1/chat/models` | 可用模型列表 |
| Agent | `GET/POST /api/v1/agents` | Agent CRUD |
| Agent | `POST /api/v1/agents/{id}/publish` | 发布 Agent |
| 知识库 | `GET/POST /api/v1/knowledge` | 知识库 CRUD |
| 知识库 | `POST /api/v1/knowledge/{id}/documents` | 上传文档 |
| 知识库 | `POST /api/v1/knowledge/{id}/query` | RAG 问答 |
| 工作流 | `GET/POST /api/v1/workflows` | 工作流 CRUD |
| 工作流 | `POST /api/v1/workflows/{id}/execute` | 执行工作流 |
| Skill | `GET/POST /api/v1/skills` | Skill CRUD |
| Skill | `POST /api/v1/skills/{id}/test` | 测试 Skill |
| 统计 | `GET /api/v1/stats/overview` | 运营概览 |
| 统计 | `GET /api/v1/stats/usage` | 用量统计 |
| 统计 | `GET /api/v1/stats/models` | 模型统计 |
