# AI Learning Tutorials

> AI 辅助生成的系统化学习教程合集

## 简介

这个仓库存放了我利用 AI 生成的各类技术学习教程。课程主要面向已有前端基础的学习者，帮助你从零补齐后端开发、数据采集、AI 应用、性能工程与部署能力。仓库包含一条完整的 **AI 工程师学习路径**（7 门课程 + 毕业项目，共 231 课时），以及多门基础技能和工程实践课程，共 **35 门课程、1123 课时**。所有重点课程都配有贯穿式 final project / project kit，方便边学边验证。

## 目录结构

```
ai-learning-tutorials/
├── ai-path/                           # AI 工程师学习路径（核心路线）
│   ├── 01-ai-app/                     # AI 应用开发基础（35课时）
│   ├── 02-ai-agent-engineer/          # AI Agent 全栈工程师（52课时）
│   ├── 03-llm-eval/                   # LLM 评估与可观测性（30课时）
│   ├── 04-multi-agent/                # 多 Agent 编排（30课时）
│   ├── 05-mcp-dev/                    # MCP 协议深度开发（24课时）
│   ├── 06-llm-finetuning/             # 开源模型部署与微调（30课时）
│   ├── 07-multimodal-ai/              # 多模态 AI 应用（30课时）
│   └── graduation-project/            # 毕业项目：AI 数据分析平台
│
├── ai-specialization/                 # AI 专项进阶
│   ├── prompt-engineering/            # Prompt Engineering 深度课（30课时）
│   ├── rag-engineering/               # RAG 工程化（30课时）
│   ├── ai-security/                   # AI 安全与对抗（30课时）
│   ├── ai-coding-engineering/         # AI 编程工程（34课时）
│   └── ai-product/                    # AI 产品化实战（30课时）
│
├── frontend/                          # 前端方向
│   ├── nextjs-fullstack/              # Next.js 全栈产品（35课时）
│   ├── frontend-performance/          # 前端性能工程（35课时）
│   ├── graphics-shader/               # 3D 图形学与 Shader（47课时）
│   ├── react-native/                  # React Native 移动端（30课时）
│   ├── webassembly/                   # WebAssembly 高性能 Web 开发（30课时）
│   ├── browser-extension/             # 浏览器扩展开发（30课时）
│   ├── audio-video-engineering/       # 音视频工程（30课时）
│   └── motion-design/                 # 技术动画与动效（30课时）
│
├── backend/                           # 后端方向
│   ├── nodejs-backend/                # 全栈后端开发（32课时）
│   ├── typescript-engineering/        # TypeScript 工程化（30课时）
│   ├── python-spider/                 # Python 爬虫（34课时）
│   └── python-automation/             # Python 自动化脚本（30课时）
│
├── devops/                            # 工程与运维
│   ├── docker-cicd/                   # Docker 与 CI/CD（35课时）
│   ├── kubernetes-cloud/              # 云原生与 Kubernetes（30课时）
│   ├── testing-qa/                    # 测试与质量保障（30课时）
│   ├── system-design/                 # 系统设计与架构（30课时）
│   ├── lowcode-platform/              # 低代码/无代码平台（30课时）
│   ├── workflow-automation/           # 自动化工作流（30课时）
│   └── engineering-leadership/        # 工程管理与技术领导力（30课时）
│
├── data/                              # 数据方向
│   ├── data-product/                  # 数据产品化（35课时）
│   └── search-engine/                 # 搜索引擎工程（30课时）
│
├── README.md
├── AGENTS.md
└── COURSE_DESIGN_REVIEW.md
```

## 教程列表

### AI 工程师学习路径

系统化的 AI 工程师成长路线，7 门课程 + 毕业项目，详见 [ai-path/](./ai-path/)

| 序号 | 课程 | 主题 | 课时 | 状态 |
|------|------|------|------|------|
| 01 | [ai-app](./ai-path/01-ai-app/) | AI 应用开发基础 | 35 | 已完成 |
| 02 | [ai-agent-engineer](./ai-path/02-ai-agent-engineer/) | AI Agent 全栈工程师 | 52 | 已完成 |
| 03 | [llm-eval](./ai-path/03-llm-eval/) | LLM 评估与可观测性 | 30 | 已完成 |
| 04 | [multi-agent](./ai-path/04-multi-agent/) | 多 Agent 编排 | 30 | 已完成 |
| 05 | [mcp-dev](./ai-path/05-mcp-dev/) | MCP 协议深度开发 | 24 | 已完成 |
| 06 | [llm-finetuning](./ai-path/06-llm-finetuning/) | 开源模型部署与微调 | 30 | 已完成 |
| 07 | [multimodal-ai](./ai-path/07-multimodal-ai/) | 多模态 AI 应用 | 30 | 已完成 |
| - | [graduation-project](./ai-path/graduation-project/) | AI 数据分析平台 | 4 周 | 已完成 |

### AI 专项进阶

| 课程 | 主题 | 内容 | 状态 |
|------|------|------|------|
| [prompt-engineering](./ai-specialization/prompt-engineering/) | Prompt Engineering | 结构化 Prompt / 测试 / 生产级 / 高级技巧，30 课时 | 已完成 |
| [rag-engineering](./ai-specialization/rag-engineering/) | RAG 工程化 | 检索优化 / GraphRAG / Agentic RAG / 生产部署，30 课时 | 已完成 |
| [ai-security](./ai-specialization/ai-security/) | AI 安全与对抗 | Prompt 注入 / 越狱 / 红队测试 / 安全工程，30 课时 | 已完成 |
| [ai-coding-engineering](./ai-specialization/ai-coding-engineering/) | AI 编程工程 | Cursor / Copilot / Prompt for Code / 团队规范，34 课时 | 已完成 |
| [ai-product](./ai-specialization/ai-product/) | AI 产品化实战 | 从想法到上线的 AI 产品全流程，30 课时 | 已完成 |

### 前端方向

| 课程 | 主题 | 内容 | 状态 |
|------|------|------|------|
| [nextjs-fullstack](./frontend/nextjs-fullstack/) | Next.js 全栈产品 | App Router + Prisma + PostgreSQL + Auth + SaaS 产品，35 课时 | 已完成 |
| [frontend-performance](./frontend/frontend-performance/) | 前端性能工程 | Core Web Vitals + React/Next 优化 + 性能监控，35 课时 | 已完成 |
| [graphics-shader](./frontend/graphics-shader/) | 3D 图形学与 Shader | WebGL / Three.js / GLSL / 创意编码，47 课时 | 已完成 |
| [react-native](./frontend/react-native/) | React Native 移动端 | Expo / 导航 / 原生模块 / AI 集成 / 发布增长，30 课时 | 已完成 |
| [ar-vr-xr](./frontend/ar-vr-xr/) | AR/VR/XR 空间计算 | WebXR / Three.js / AR 开发 / VR 开发 / 空间应用，30 课时 | 已完成 |
| [webassembly](./frontend/webassembly/) | WebAssembly 高性能 Web 开发 | Rust + WASM / SIMD / 多线程 / WASI / 组件模型，30 课时 | 已完成 |
| [motion-design](./frontend/motion-design/) | 技术动画与动效 | CSS 动画 / GSAP / Three.js / 粒子系统 / 性能优化，30 课时 | 已完成 |
| [browser-extension](./frontend/browser-extension/) | 浏览器扩展开发 | Manifest V3 / AI 扩展 / 跨浏览器 / 商业化，30 课时 | 已完成 |
| [audio-video-engineering](./frontend/audio-video-engineering/) | 音视频工程 | Web Audio / 视频处理 / 流媒体 / WebRTC / 生产级应用，30 课时 | 已完成 |

### 后端方向

| 课程 | 主题 | 内容 | 状态 |
|------|------|------|------|
| [nodejs-backend](./backend/nodejs-backend/) | 全栈后端开发 | Node.js + Express + PostgreSQL + Docker，32 课时 | 已完成 |
| [typescript-engineering](./backend/typescript-engineering/) | TypeScript 工程化 | 类型系统 / 设计模式 / Monorepo / 测试体系 / 生产架构，30 课时 | 已完成 |
| [python-spider](./backend/python-spider/) | Python 爬虫 | Python + requests + Playwright + Scrapy，34 课时 | 已完成 |
| [python-automation](./backend/python-automation/) | Python 自动化脚本 | 文件处理 + Web 自动化 + 系统监控 + 真实项目，30 课时 | 已完成 |

### 工程与运维

| 课程 | 主题 | 内容 | 状态 |
|------|------|------|------|
| [docker-cicd](./devops/docker-cicd/) | Docker 与 CI/CD | Docker + Compose + GitHub Actions + 云部署，35 课时 | 已完成 |
| [kubernetes-cloud](./devops/kubernetes-cloud/) | 云原生与 Kubernetes | 容器编排 / Helm / GitOps / 可观测性 / Service Mesh，30 课时 | 已完成 |
| [testing-qa](./devops/testing-qa/) | 测试与质量保障 | Vitest / Playwright / Mock / 覆盖率 / 变异测试 / CI 流水线，30 课时 | 已完成 |
| [system-design](./devops/system-design/) | 系统设计与架构 | 需求分析 / 数据库选型 / 分布式系统 / 微服务 / 真实案例，30 课时 | 已完成 |
| [workflow-automation](./devops/workflow-automation/) | 自动化工作流 | n8n / AI 工作流 / 企业集成 / 监控告警 / 规模化部署，30 课时 | 已完成 |
| [lowcode-platform](./devops/lowcode-platform/) | 低代码/无代码平台 | 数据建模 / 应用搭建 / AI 集成 / 自定义组件 / 企业级部署，30 课时 | 已完成 |
| [engineering-leadership](./devops/engineering-leadership/) | 工程管理与技术领导力 | 管理转型 / 团队建设 / 技术战略 / 执行交付 / 职业成长，30 课时 | 已完成 |

### 数据方向

| 课程 | 主题 | 内容 | 状态 |
|------|------|------|------|
| [data-product](./data/data-product/) | 数据产品化 | ETL + FastAPI + Dashboard + 自动化数据产品，35 课时 | 已完成 |
| [search-engine](./data/search-engine/) | 搜索引擎工程 | 倒排索引 / BM25 / 向量检索 / Elasticsearch / LTR，30 课时 | 已完成 |

## 特点

- **前端友好**：默认你已有 HTML/CSS/JavaScript 基础，从后端和爬虫的第一性原理讲起
- **体系完整**：清晰的学习路线和阶段划分
- **讲义配套代码**：课程中的代码用于配合讲解和练习；可运行或可检查项目见各课程的 `final-project`
- **实战驱动**：每阶段有练习、报告或验收清单，最终产出实际项目
- **可验证**：新增 project kit 都提供 `check` 脚本，部分课程还提供本地服务、ETL、LHCI 或 eval

## 使用方式

```bash
git clone <repo-url>
cd ai-learning-tutorials
cd backend/nodejs-backend
# 按 README.md 中的学习路线开始
```

AI 工程师学习路径：

```bash
cd ai-path
# 按路径总览的推荐顺序学习
# 必修：01 → 02 → 03，然后按兴趣选修 04-07
```

也可以直接进入某门课的 final project：

```bash
cd frontend/frontend-performance/final-project/performance-rescue-demo
pnpm check

cd ai-path/01-ai-app/final-project/ai-knowledge-workspace-kit
npm run check
npm run ingest
npm run ask
npm run eval
```
