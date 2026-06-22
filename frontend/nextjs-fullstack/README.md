# 从零到一：Next.js 全栈产品实战课程

> 面向前端开发者的全栈产品课：用 Next.js App Router、TypeScript、Prisma、PostgreSQL 和现代部署流程做一个真实 SaaS 产品。

## 适合谁

- 已会 React，希望能独立做完整产品
- 想掌握 Next.js App Router、服务端渲染、Server Actions 和数据库
- 想做作品集、工具站、内部系统或小型 SaaS

## 学完能做什么

- 独立搭建 Next.js 全栈项目
- 设计页面、组件、数据模型和接口边界
- 实现登录、权限、订阅、上传、邮件、后台管理
- 做性能优化、安全加固和部署上线

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js App Router |
| 语言 | TypeScript |
| 样式 | TailwindCSS |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 认证 | Auth.js 或自建 Session |
| 表单 | React Hook Form + Zod |
| 支付 | Stripe 思路 |
| 部署 | Vercel / Docker |

## 贯穿项目

本课程使用 `Micro SaaS Starter` 作为贯穿项目。仓库提供一个 scaffold，用于统一路由结构、Prisma 模型、权限矩阵和阶段验收：

```bash
cd nextjs-fullstack-course/final-project/micro-saas-starter-scaffold
npm run check
```

这个 scaffold 不是完整安装版 SaaS，而是课程的“骨架锚点”。你会在五个阶段逐步把它扩成可运行产品。

## 学习路线

### 第一阶段：App Router 基础

1. Next.js 与传统 React SPA 的区别
2. 路由、布局、模板与页面组织
3. Server Components 与 Client Components
4. 数据获取、缓存和重新验证
5. 表单提交与 Server Actions
6. 错误页、加载态、空状态
7. 阶段实战：内容管理面板

### 第二阶段：数据、认证与权限

1. PostgreSQL 与 Prisma 项目初始化
2. 数据建模：User、Project、Member、Plan
3. 登录注册与 Session
4. 权限模型：owner、admin、member
5. 表单验证：Zod schema 与错误展示
6. 文件上传与对象存储
7. 阶段实战：团队项目管理系统

### 第三阶段：产品工作流

1. Dashboard 信息架构
2. 搜索、筛选、排序、分页
3. 通知、邮件和邀请流程
4. 订阅与套餐设计
5. 后台管理与审计日志
6. 可复用业务组件
7. 阶段实战：SaaS 工作台 MVP

### 第四阶段：性能、安全与体验

1. 首屏性能和流式渲染
2. 图片、字体、脚本优化
3. 缓存策略与数据一致性
4. CSRF、XSS、权限绕过防护
5. 无障碍、键盘操作和表单体验
6. 错误监控与用户反馈
7. 阶段实战：性能与安全审查

### 第五阶段：部署与运营

1. 环境变量与密钥管理
2. 数据库迁移与种子数据
3. Vercel 部署流程
4. Docker 部署流程
5. 日志、监控、告警
6. 灰度发布与回滚
7. 阶段实战：正式上线 checklist

## 最终项目

**Micro SaaS Starter：可订阅的 AI 工具站**

功能包括：

- 登录注册、团队空间、角色权限
- 项目/文档管理
- AI 功能调用记录
- 订阅套餐与用量限制
- 管理后台、审计日志、部署上线

详情见 [最终项目说明](final-project/项目说明.md)。

## 学习建议

1. 不要把 Next.js 当成“React 加路由”，它是全栈框架。
2. 每个业务动作都要想清楚：谁能做、做完数据怎么变、失败怎么恢复。
3. 先做朴素可维护的产品，再加动画和复杂视觉。

## 参考官方文档

- Next.js App Router：https://nextjs.org/docs/app
- Next.js Getting Started：https://nextjs.org/docs/app/getting-started

