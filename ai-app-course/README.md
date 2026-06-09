# 从零到一：AI 应用开发实战课程

> 面向前端开发者的 AI 产品工程课：从大模型 API 基础，到 RAG、工具调用、Agent 工作流，再到可上线的 AI 助手产品。

## 适合谁

- 有 React / TypeScript / HTTP 基础，想把 AI 能力做成真实产品
- 做过前端页面，但不熟悉大模型 API、RAG、工具调用和 AI 产品评估
- 想做个人知识库、文档问答、AI 工作台、智能客服、研究助手等项目

## 学完能做什么

- 使用大模型 API 构建稳定的文本生成、结构化输出和多轮对话
- 构建基于文件、网页和数据库的 RAG 知识库
- 设计工具调用、任务编排和 Agent 工作流
- 为 AI 应用加入权限、日志、成本控制、评估和安全边界
- 独立上线一个可演示、可迭代的 AI 知识工作台

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端 | Next.js / React / TypeScript |
| AI API | OpenAI Responses API、工具调用、结构化输出 |
| Agent | OpenAI Agents SDK 思路、工具编排、任务状态 |
| RAG | Embeddings、向量检索、文件切分、重排策略 |
| 数据 | PostgreSQL / pgvector 或轻量向量库 |
| 后端 | Next.js Route Handlers 或 Node.js 服务 |
| 质量 | Evals、日志、成本统计、失败回放 |
| 部署 | Vercel / Docker / 云数据库 |

## 贯穿项目

本课程使用 `AI Knowledge Workspace` 作为贯穿项目。为了让学习过程可验证，仓库提供一个离线 project kit：

```bash
cd ai-app-course/final-project/ai-knowledge-workspace-kit
npm run check
npm run ingest
npm run ask -- "为什么回答必须带引用"
npm run eval
```

这个 kit 先用本地 Markdown 资料练习文档切分、检索、引用、拒答和评估。接入真实 OpenAI Responses API、流式响应、工具调用和用户系统，是后续阶段的扩展任务。

## 学习路线

### 第一阶段：大模型 API 基础

1. AI 应用到底是什么：Prompt、上下文、模型、工具、状态
2. API Key、SDK、环境变量与请求生命周期
3. 文本生成：输入、输出、温度、长度、错误处理
4. 多轮对话：会话状态、消息压缩、历史裁剪
5. 结构化输出：JSON Schema、类型校验、Zod 对接
6. 流式响应：前端体验、取消请求、错误恢复
7. 阶段实战：AI 写作助手

### 第二阶段：RAG 与知识库

1. RAG 的本质：为什么模型需要检索
2. 文档上传：PDF、Markdown、网页内容的解析策略
3. 文本切分：chunk 大小、重叠、元数据设计
4. Embeddings 与向量检索：相似度、召回、过滤
5. 引用与溯源：回答必须能回到原文
6. 检索质量优化：query rewrite、rerank、混合检索
7. 阶段实战：个人文档问答系统

### 第三阶段：工具调用与 Agent 工作流

1. 工具调用的设计：输入 schema、输出协议、错误边界
2. 常用工具：搜索、数据库查询、文件读写、日历任务
3. 多步骤任务：计划、执行、观察、修正
4. Agent 状态机：pending、running、blocked、done、failed
5. 人工确认：高风险操作必须停下来等用户
6. 多 Agent 协作：研究、执行、审查的职责拆分
7. 阶段实战：AI 研究助手

### 第四阶段：产品化工程

1. 用户系统：登录、配额、组织空间
2. 会话管理：收藏、归档、分享、搜索
3. 文件知识库：上传、索引、重新索引、删除
4. 成本控制：token 统计、缓存、限流、降级
5. 安全边界：提示注入、越权检索、敏感信息过滤
6. 可观测性：日志、trace、失败样本、用户反馈
7. 阶段实战：AI 知识工作台 MVP

### 第五阶段：评估、上线与迭代

1. AI 应用为什么必须评估
2. 构建测试集：事实性、格式、拒答、引用质量
3. 自动评估：规则评估、模型评估、人工抽检
4. Prompt 版本管理：变更记录、回滚、灰度
5. 线上监控：延迟、成本、失败率、用户满意度
6. 部署上线：环境变量、密钥、数据库、队列
7. 阶段实战：生产级发布清单

## 最终项目

**AI Knowledge Workspace：个人知识工作台**

核心功能：

- 上传 PDF / Markdown / 网页链接并建立知识库
- 支持带引用的问答、总结、对比、生成行动清单
- 支持工具调用：保存笔记、生成任务、查询历史
- 支持流式响应、会话管理、配额限制和错误恢复
- 支持评估集、日志追踪和成本统计

详情见 [最终项目说明](final-project/项目说明.md)。

## 学习建议

1. 不要只学 Prompt，要把 AI 当成产品系统：输入、检索、工具、状态、评估缺一不可。
2. 每个阶段都要保留失败样本，AI 应用的能力来自持续修正。
3. 先做小而完整的闭环，再扩展复杂 Agent。
4. 凡是会写入、删除、发送、支付、授权的工具调用，都必须设计人工确认。

## 参考官方文档

- OpenAI API 工具与 Responses / Agents / File Search 文档：https://developers.openai.com/api/docs/guides/tools
- Next.js App Router 文档：https://nextjs.org/docs/app

