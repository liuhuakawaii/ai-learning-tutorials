# AI Learning Tutorials

> AI 辅助生成的系统化学习教程合集

## 简介

这个仓库存放了我利用 AI 生成的各类技术学习教程。课程主要面向已有前端基础的学习者，帮助你从零补齐后端开发、数据采集、AI 应用、性能工程与部署能力。仓库包含一条完整的 **AI 工程师学习路径**（7 门课程 + 毕业项目，共 231 课时），以及多门基础技能和工程实践课程。所有重点课程都配有贯穿式 final project / project kit，方便边学边验证。

## 教程列表

### AI 工程师学习路径

系统化的 AI 工程师成长路线，7 门课程 + 毕业项目，详见 [ai-engineer-path/](./ai-engineer-path/)

| 序号 | 课程 | 主题 | 课时 | 状态 |
|------|------|------|------|------|
| 01 | [ai-app-course](./ai-engineer-path/01-ai-app-course/) | AI 应用开发基础 | 35 | 规划完成 |
| 02 | [ai-agent-engineer-course](./ai-engineer-path/02-ai-agent-engineer-course/) | AI Agent 全栈工程师 | 52 | 已完成 |
| 03 | [llm-eval-course](./ai-engineer-path/03-llm-eval-course/) | LLM 评估与可观测性 | 30 | 规划完成 |
| 04 | [multi-agent-course](./ai-engineer-path/04-multi-agent-course/) | 多 Agent 编排 | 30 | 规划完成 |
| 05 | [mcp-dev-course](./ai-engineer-path/05-mcp-dev-course/) | MCP 协议深度开发 | 24 | 规划完成 |
| 06 | [llm-finetuning-course](./ai-engineer-path/06-llm-finetuning-course/) | 开源模型部署与微调 | 30 | 规划完成 |
| 07 | [multimodal-ai-course](./ai-engineer-path/07-multimodal-ai-course/) | 多模态 AI 应用 | 30 | 规划完成 |
| - | [graduation-project](./ai-engineer-path/graduation-project/) | AI 数据分析平台 | 4 周 | 进行中 |

### 基础技能课程

| 教程 | 主题 | 内容 | 状态 |
|------|------|------|------|
| [backend-course](./backend-course/) | 全栈后端开发 | Node.js + Express + PostgreSQL + Docker，32 课时 + 完整项目 | 已完成 |
| [nextjs-fullstack-course](./nextjs-fullstack-course/) | Next.js 全栈产品 | App Router + Prisma + PostgreSQL + Auth + SaaS 产品 | 规划完成 |
| [frontend-performance-course](./frontend-performance-course/) | 前端性能工程 | Core Web Vitals + React/Next 优化 + 性能监控 | 规划完成 |

### 工程实践课程

| 教程 | 主题 | 内容 | 状态 |
|------|------|------|------|
| [docker-cicd-course](./docker-cicd-course/) | Docker 与 CI/CD | Docker + Compose + GitHub Actions + 云部署 | 规划完成 |
| [data-product-course](./data-product-course/) | 数据产品化 | ETL + FastAPI + Dashboard + 自动化数据产品 | 规划完成 |
| [spider-course](./spider-course/) | Python 爬虫 | Python + requests + Playwright + Scrapy，29 课时 + 综合项目 | 进行中 |

### 专项进阶课程

| 教程 | 主题 | 内容 | 状态 |
|------|------|------|------|
| [ai-coding-engineering-course](./ai-coding-engineering-course/) | AI 编程工程 | Cursor / Copilot / Prompt for Code / 团队规范，34 课时 | 规划完成 |
| [prompt-engineering-course](./prompt-engineering-course/) | Prompt Engineering 深度课 | 结构化 Prompt / 测试 / 生产级 / 高级技巧，30 课时 | 规划完成 |
| [ai-security-course](./ai-security-course/) | AI 安全与对抗 | Prompt 注入 / 越狱 / 红队测试 / 安全工程，30 课时 | 规划完成 |
| [rag-engineering-course](./rag-engineering-course/) | RAG 工程化 | 检索优化 / GraphRAG / Agentic RAG / 生产部署，30 课时 | 规划完成 |

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
cd backend-course
# 按 README.md 中的学习路线开始
```

AI 工程师学习路径：

```bash
cd ai-engineer-path
# 按路径总览的推荐顺序学习
# 必修：01 → 02 → 03，然后按兴趣选修 04-07
```

也可以直接进入某门课的 final project：

```bash
cd frontend-performance-course/final-project/performance-rescue-demo
pnpm check

cd ai-engineer-path/01-ai-app-course/final-project/ai-knowledge-workspace-kit
npm run check
npm run ingest
npm run ask
npm run eval
```
