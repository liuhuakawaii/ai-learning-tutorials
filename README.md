# AI Learning Tutorials

> AI 辅助生成的系统化学习教程合集

## 简介

这个仓库存放了我利用 AI 生成的各类技术学习教程。当前课程主要面向已有前端基础的学习者，帮助你从零补齐后端开发、数据采集、AI 应用、性能工程与部署能力。仓库不再只保留 Markdown 讲义，也为重点课程补了贯穿式 final project / project kit，方便边学边验证。

## 教程列表

| 教程 | 主题 | 内容 | 状态 |
|------|------|------|------|
| [ai-agent-engineer-course](./ai-agent-engineer-course/) | AI Agent 全栈工程师 | Vue 3 + FastAPI + RAG + Agent + 工作流 + MCP + 生产部署，52 课时 + 毕业项目 | 已完成 |
| [backend-course](./backend-course/) | 全栈后端开发 | Node.js + Express + PostgreSQL + Docker，32 课时 + 完整项目 | 已完成 |
| [spider-course](./spider-course/) | Python 爬虫 | Python + requests + Playwright + Scrapy，29 课时 + 综合项目 | 进行中 |
| [ai-app-course](./ai-app-course/) | AI 应用开发 | 大模型 API + RAG + 工具调用 + Agent + AI 知识工作台 | 规划完成 |
| [nextjs-fullstack-course](./nextjs-fullstack-course/) | Next.js 全栈产品 | App Router + Prisma + PostgreSQL + Auth + SaaS 产品 | 规划完成 |
| [data-product-course](./data-product-course/) | 数据产品化 | ETL + FastAPI + Dashboard + 自动化数据产品 | 规划完成 |
| [docker-cicd-course](./docker-cicd-course/) | Docker 与 CI/CD | Docker + Compose + GitHub Actions + 云部署 | 规划完成 |
| [frontend-performance-course](./frontend-performance-course/) | 前端性能工程 | Core Web Vitals + React/Next 优化 + 性能监控 | 规划完成 |

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

也可以直接进入某门课的 final project：

```bash
cd frontend-performance-course/final-project/performance-rescue-demo
pnpm check

cd ai-app-course/final-project/ai-knowledge-workspace-kit
npm run check
npm run ingest
npm run eval
```
