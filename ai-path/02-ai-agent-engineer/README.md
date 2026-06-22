# AI Agent 全栈工程师实战课程

> 从零构建企业级 AI Agent 平台：Vue 3 + FastAPI + RAG + Agent + 工作流 + MCP + 生产部署。不是概念 PPT，是每一行代码都能跑的硬核实战。

## 前置要求

- **必修前置**：[01-ai-app-course](../01-ai-app-course/)（AI 应用开发基础）
- **技术基础**：熟悉 TypeScript/JavaScript，了解 HTTP 和 API 调用
- **建议**：有 Vue 或 React 开发经验

## 这门课解决什么问题

你可能已经会写前端页面，也调过大模型 API 拼过几个 demo。但企业要的不是 demo——他们要的是：

- 一个能跑在生产环境的 Agent 平台，不是 Jupyter Notebook 里的玩具
- 一套 Skill 体系，让业务人员能配置、能组合、能复用
- 一个可视化工作流引擎，让非开发人员也能编排 AI 任务
- 一套完整的可观测性，出了问题能查、能回溯、能优化

这门课就是带你从 "会调 API" 到 "能交付企业级 AI Agent 平台" 的完整路径。

## 适合谁

- 有 1-3 年开发经验，熟悉 Vue 或 React，想转型 AI 全栈
- 做过 AI demo，但不知道怎么做成产品级系统
- 想进入 AI Agent / LLM 应用开发领域，需要一套完整的能力体系
- 准备面试 AI 全栈工程师岗位，需要项目经验和实战能力

## 学完能做什么

- 独立开发完整的 AI Agent 平台前端（Chat UI、配置页、工作流编辑器、运营看板）
- 用 FastAPI 构建企业级后端（API 设计、数据库建模、任务调度、系统集成）
- 实现 RAG 知识库（文档解析、向量检索、引用溯源、质量优化）
- 设计 Agent 工具体系（API Skills、Workflow Skills、Script Skills、MCP Tools）
- 构建可视化工作流引擎（DAG 编排、条件分支、人工审批、并行执行）
- 落地企业级能力（权限、审计、监控、成本控制、灰度发布）
- 理解并实践 Context 数据闭环（采集、标注、回流、优化）

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端 | Vue 3 + TypeScript + Naive UI | 企业级中后台首选 |
| 前端备选 | React + TypeScript + Ant Design | 课程提供 React 版代码 |
| 后端 | FastAPI + Python 3.12 | 高性能异步 API 框架 |
| 数据库 | PostgreSQL 16 + pgvector | 关系型 + 向量检索一体化 |
| 缓存 | Redis 7 | 会话缓存、限流、消息队列 |
| AI API | OpenAI / Claude / 国产大模型 | 多模型适配，不绑死一家 |
| Agent 框架 | LangGraph + OpenAI Agents SDK | 主流 Agent 编排方案 |
| MCP | Model Context Protocol | 工具协议标准 |
| RAG | LlamaIndex / 自研 Pipeline | 灵活可替换 |
| 工作流 | 自研 DAG 引擎 | 可视化编排核心 |
| 部署 | Docker + Docker Compose | 一键启动开发环境 |
| 监控 | LangSmith / Langfuse | LLM 可观测性 |
| 协作 | Claude Code / Codex | AI 辅助开发（课程全程使用） |

## 学习路线

```
阶段 1          阶段 2          阶段 3          阶段 4
全栈基础        LLM 核心能力     知识库与 RAG     Agent 架构
Vue3+FastAPI    多轮对话/流式    文档解析/向量     工具/状态机/记忆
    │               │               │               │
    └───────────────┴───────────────┴───────────────┘
                        │
                        ▼
阶段 5              阶段 6              阶段 7              阶段 8
工作流引擎          企业级能力           生产部署            毕业项目
DAG编排/可视化      权限/审计/监控       Docker/CI/CD        AI Agent 平台
    │                   │                   │                   │
    └───────────────────┴───────────────────┴───────────────────┘
```

### 第一阶段：全栈基础——让系统先跑起来（7 课时）

> 目标：用 Vue 3 + FastAPI + PostgreSQL 搭建一个可运行的 AI 应用骨架

1. [课程导览与环境搭建](./stage1-fullstack-foundations/01-课程导览与环境搭建.md)——为什么是这个技术栈
2. [FastAPI 后端从零开始](./stage1-fullstack-foundations/02-FastAPI后端从零开始.md)——路由、模型、数据库
3. [PostgreSQL 与 SQLAlchemy](./stage1-fullstack-foundations/03-PostgreSQL与SQLAlchemy.md)——数据建模与迁移
4. [Vue 3 + TypeScript 前端工程](./stage1-fullstack-foundations/04-Vue3与TypeScript前端工程.md)——组件、状态、路由
5. [前后端联调](./stage1-fullstack-foundations/05-前后端联调.md)——API 对接、错误处理、加载状态
6. [Redis 缓存与会话管理](./stage1-fullstack-foundations/06-Redis缓存与会话管理.md)——为什么需要 Redis
7. [**阶段实战：AI 应用骨架搭建**](./stage1-fullstack-foundations/07-阶段实战-AI应用骨架搭建.md)

### 第二阶段：LLM 核心能力——让应用会说话（7 课时）

> 目标：实现完整的多轮对话、流式响应和 Prompt 工程体系

1. [大模型 API 深度解析](./stage2-llm-core-capabilities/01-大模型API深度解析.md)——请求生命周期与 token 经济学
2. [多轮对话架构](./stage2-llm-core-capabilities/02-多轮对话架构.md)——消息模型、上下文窗口、历史压缩
3. [流式响应](./stage2-llm-core-capabilities/03-流式响应.md)——SSE 协议、前端渲染、中断与恢复
4. [Prompt 工程](./stage2-llm-core-capabilities/04-Prompt工程.md)——System Prompt 设计、Few-shot、CoT
5. [结构化输出](./stage2-llm-core-capabilities/05-结构化输出.md)——JSON Schema、Pydantic 校验、类型安全
6. [多模型适配层](./stage2-llm-core-capabilities/06-多模型适配层.md)——OpenAI / Claude / 国产模型统一接口
7. [**阶段实战：智能客服对话系统**](./stage2-llm-core-capabilities/07-阶段实战-智能客服对话系统.md)

### 第三阶段：知识库与 RAG——让应用有记忆（7 课时）

> 目标：构建企业级 RAG 知识库，支持文档问答、引用溯源

1. [RAG 第一性原理](./stage3-rag-and-knowledge/01-RAG第一性原理.md)——为什么模型需要检索增强
2. [文档解析 Pipeline](./stage3-rag-and-knowledge/02-文档解析Pipeline.md)——PDF / Word / Markdown / 网页
3. [文本切分策略](./stage3-rag-and-knowledge/03-文本切分策略.md)——chunk 大小、重叠、语义切分
4. [向量数据库实战](./stage3-rag-and-knowledge/04-向量数据库实战.md)——pgvector、Embedding、索引优化
5. [检索策略](./stage3-rag-and-knowledge/05-检索策略.md)——相似度、混合检索、重排序
6. [引用溯源与幻觉检测](./stage3-rag-and-knowledge/06-引用溯源与幻觉检测.md)——回答必须能回到原文
7. [**阶段实战：企业知识库问答系统**](./stage3-rag-and-knowledge/07-阶段实战-企业知识库问答系统.md)

### 第四阶段：Agent 架构——让应用能自主行动（8 课时）

> 目标：设计完整的 Agent 工具体系、状态管理和多 Agent 协作

1. [Agent 设计哲学](./stage4-agent-architecture/01-Agent设计哲学.md)——ReAct、Plan-and-Execute、工具增强
2. [工具（Tool）设计规范](./stage4-agent-architecture/02-工具设计规范.md)——输入 Schema、输出协议、错误边界
3. [Function Calling 实战](./stage4-agent-architecture/03-Function-Calling实战.md)——从 API 定义到模型调用的完整链路
4. [MCP 协议深度解析](./stage4-agent-architecture/04-MCP协议深度解析.md)——为什么 MCP 是工具生态的未来
5. [Agent 状态机](./stage4-agent-architecture/05-Agent状态机.md)——生命周期、持久化、断点恢复
6. [短期记忆与长期记忆](./stage4-agent-architecture/06-短期记忆与长期记忆.md)——上下文管理、会话摘要、用户画像
7. [多 Agent 协作](./stage4-agent-architecture/07-多Agent协作.md)——角色分工、消息传递、冲突解决
8. [**阶段实战：AI 研究助手 Agent**](./stage4-agent-architecture/08-阶段实战-AI研究助手Agent.md)

### 第五阶段：工作流引擎——让复杂任务可编排（8 课时）

> 目标：构建可视化 DAG 工作流引擎，支持条件分支、并行、审批

1. [工作流引擎设计](./stage5-workflow-engine/01-工作流引擎设计.md)——DAG 模型、节点类型、边的语义
2. [可视化编辑器](./stage5-workflow-engine/02-可视化编辑器.md)——Vue Flow / X6 实战、拖拽、连线、配置
3. [执行引擎](./stage5-workflow-engine/03-执行引擎.md)——拓扑排序、状态管理、错误处理、重试机制
4. [条件分支与循环](./stage5-workflow-engine/04-条件分支与循环.md)——if/else、foreach、while、break
5. [人工审批节点](./stage5-workflow-engine/05-人工审批节点.md)——等待、通知、超时、委托
6. [并行执行与汇聚](./stage5-workflow-engine/06-并行执行与汇聚.md)——扇出/扇入、结果聚合、失败策略
7. [Skill 体系设计](./stage5-workflow-engine/07-Skill体系设计.md)——API Skill、Script Skill、Workflow Skill、MCP Skill
8. [**阶段实战：可视化工作流编排引擎**](./stage5-workflow-engine/08-阶段实战-可视化工作流编排引擎.md)

### 第六阶段：企业级能力——让系统能上生产（8 课时）

> 目标：加入权限、审计、监控、成本控制等企业级能力

1. [认证与授权](./stage6-enterprise-features/01-认证与授权.md)——JWT、RBAC、组织空间、API Key 管理
2. [Skill 权限控制](./stage6-enterprise-features/02-Skill权限控制.md)——作用域、审批流、沙箱执行
3. [审计日志](./stage6-enterprise-features/03-审计日志.md)——操作记录、合规追溯、数据血缘
4. [LLM 可观测性](./stage6-enterprise-features/04-LLM可观测性.md)——LangSmith / Langfuse 集成、Trace、成本统计
5. [Context 数据闭环](./stage6-enterprise-features/05-Context数据闭环.md)——采集、标注、回流、自动优化
6. [安全防线](./stage6-enterprise-features/06-安全防线.md)——提示注入防御、越权检索、敏感信息过滤
7. [性能优化](./stage6-enterprise-features/07-性能优化.md)——缓存策略、连接池、异步任务、限流降级
8. [**阶段实战：运营看板与监控系统**](./stage6-enterprise-features/08-阶段实战-运营看板与监控系统.md)

### 第七阶段：生产部署——让系统跑在线上（7 课时）

> 目标：完成容器化部署、CI/CD 流水线和线上运维

1. [Docker 容器化](./stage7-production-deployment/01-Docker容器化.md)——多阶段构建、镜像优化、安全扫描
2. [Docker Compose 编排](./stage7-production-deployment/02-Docker-Compose编排.md)——开发环境一键启动
3. [数据库运维](./stage7-production-deployment/03-数据库运维.md)——迁移、备份、主从复制、连接管理
4. [CI/CD 流水线](./stage7-production-deployment/04-CICD流水线.md)——GitHub Actions、自动测试、自动部署
5. [反向代理与 HTTPS](./stage7-production-deployment/05-反向代理与HTTPS.md)——Nginx / Caddy 配置
6. [线上监控与告警](./stage7-production-deployment/06-线上监控与告警.md)——Prometheus + Grafana、日志聚合
7. [**阶段实战：生产级部署与上线清单**](./stage7-production-deployment/07-阶段实战-生产级部署与上线清单.md)

### 第八阶段：毕业项目——AI Agent 平台（综合实战）

> 目标：整合所有阶段所学，构建一个完整的 AI Agent 平台

- Agent 配置与管理——创建、编辑、发布、版本控制
- Skill 市场——浏览、安装、配置、组合
- 对话系统——多轮对话、流式响应、上下文管理
- 知识库管理——上传、索引、检索、质量监控
- 工作流编排——可视化编辑、调试、执行、日志
- 运营看板——用量统计、成本分析、用户反馈

详见 [毕业项目说明](final-project/项目说明.md)

## 学习建议

1. **先跑通，再理解**。每节课的代码先跑起来，再回头理解为什么这么设计。
2. **不要跳过错误处理**。企业级系统和 demo 的最大区别就是错误处理。
3. **用 AI 辅助开发**。课程全程鼓励使用 Claude Code / Codex，这是真实工作方式。
4. **保留每阶段的代码**。毕业项目需要整合前面所有阶段的成果。
5. **关注"为什么"**。技术选型背后有 trade-off，理解 why 比记住 how 更重要。
6. **动手改造**。每节课的练习不只是完成作业，要加入自己的想法。

## 课程目录

> 课时文件已全部创建，格式为 `NN-中文标题.md`。

| 阶段 | 目录 | 课时 | 状态 |
|------|------|------|------|
| 阶段 1 | [stage1-fullstack-foundations](./stage1-fullstack-foundations/) | 7 | 已完成 |
| 阶段 2 | [stage2-llm-core-capabilities](./stage2-llm-core-capabilities/) | 7 | 已完成 |
| 阶段 3 | [stage3-rag-and-knowledge](./stage3-rag-and-knowledge/) | 7 | 已完成 |
| 阶段 4 | [stage4-agent-architecture](./stage4-agent-architecture/) | 8 | 已完成 |
| 阶段 5 | [stage5-workflow-engine](./stage5-workflow-engine/) | 8 | 已完成 |
| 阶段 6 | [stage6-enterprise-features](./stage6-enterprise-features/) | 8 | 已完成 |
| 阶段 7 | [stage7-production-deployment](./stage7-production-deployment/) | 7 | 已完成 |
| 阶段 8 | [final-project](./final-project/) | 综合实战 | 已完成 |

**总计：52 课时 + 1 个毕业项目**

## 参考资料

- FastAPI 官方文档：https://fastapi.tiangolo.com/
- Vue 3 官方文档：https://vuejs.org/guide/
- PostgreSQL 文档：https://www.postgresql.org/docs/
- pgvector 文档：https://github.com/pgvector/pgvector
- OpenAI API 文档：https://platform.openai.com/docs/
- LangGraph 文档：https://langchain-ai.github.io/langgraph/
- MCP 协议规范：https://modelcontextprotocol.io/
- LangSmith 文档：https://docs.smith.langchain.com/
