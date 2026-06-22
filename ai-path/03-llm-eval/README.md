# 从零到一：LLM 评估与可观测性实战课程

> 学会科学地衡量 AI 应用质量，让你的 Agent 和 RAG 系统从"能用"变成"好用"

## 前置要求

- **必修前置**：[01-ai-app-course](../01-ai-app-course/) + [02-ai-agent-engineer-course](../02-ai-agent-engineer-course/)
- **技术基础**：Python 3.12，了解 RAG 和 Agent 的基本概念
- **建议**：已完成前两门课的 final project

## 适合谁

- 学完 AI 应用开发课程、想验证和提升产品质量的开发者
- 正在做 RAG / Agent 项目但不知道怎么衡量效果的团队
- 想从"凭感觉调 Prompt"升级到"数据驱动优化"的工程师
- 负责 AI 产品质检、需要建立评估体系的技术负责人

## 学完能做什么

- 为 RAG 系统搭建完整的检索质量 + 回答质量评估 pipeline
- 为 Agent 系统设计行为追踪、成功率、幻觉率等核心指标
- 使用 Langfuse / Braintrust 等平台搭建可观测性 dashboard
- 建立持续评估机制：自动化 eval + 人工标注 + A/B 测试
- 能够用数据说服团队"这个 Prompt 改动确实有效"

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.12 / TypeScript |
| AI API | OpenAI / Claude（复用前两课的 API 调用） |
| 评估框架 | DeepEval / RAGAS / promptfoo |
| 可观测性 | Langfuse / LangSmith / Braintrust |
| 数据 | PostgreSQL + DuckDB（分析） |
| 可视化 | Streamlit / Next.js Dashboard |
| 测试 | pytest / vitest |

## 学习路线

### 第 1 阶段：评估基础（6 课时）

> 掌握 LLM 评估的核心概念和基本工具

1. 为什么需要评估 — AI 应用质量的挑战与评估思维
2. 评估指标体系 — 回答质量、延迟、成本、安全性的量化方法
3. 自动化评估入门 — 用 LLM-as-Judge 实现自动打分
4. 评估数据集构建 — Golden Dataset 的设计与管理
5. 对比评估方法 — Pairwise / Rating / Binary 分类与适用场景
6. 阶段实战：为一个简单 QA 应用搭建基础评估 pipeline

### 第 2 阶段：RAG 系统评估（6 课时）

> 深入评估检索增强生成的每个环节

1. RAG 评估全景 — 检索质量与生成质量的分离评估思路
2. 检索评估指标 — Context Precision / Recall / Relevancy 的计算
3. 生成评估指标 — Faithfulness / Answer Relevancy / Hallucination 检测
4. RAGAS 实战 — 用 RAGAS 框架评估你的 RAG pipeline
5. 端到端评估 — 从用户提问到最终回答的全链路质量度量
6. 阶段实战：为 01-ai-app-course 的知识工作台搭建 RAG 评估套件

### 第 3 阶段：Agent 系统评估（6 课时）

> 解决 Agent 评估的特殊挑战：非确定性、多步骤、工具调用

1. Agent 评估的特殊性 — 为什么传统测试方法不够用
2. 工具调用评估 — 准确率、参数正确性、调用效率
3. 多步推理评估 — 任务完成率、步骤合理性、回退处理
4. 安全性评估 — 越狱检测、输出安全、权限边界
5. 成本与延迟分析 — Token 消耗追踪、调用链路耗时优化
6. 阶段实战：为 02-ai-agent-engineer-course 的 Agent 平台搭建评估体系

### 第 4 阶段：可观测性平台（6 课时）

> 搭建生产级的 AI 应用监控与追踪系统

1. 可观测性三支柱 — Logs / Traces / Metrics 在 AI 应用中的应用
2. Langfuse 快速上手 — 从 SDK 集成到第一个 dashboard
3. 调用链路追踪 — 从用户输入到模型输出的全链路可视化
4. 成本监控 — Token 消耗、API 调用次数、费用预警
5. 质量 dashboard — 实时展示评估指标、趋势、异常告警
6. 阶段实战：搭建一个完整的 AI 应用可观测性平台

### 第 5 阶段：持续评估与优化（6 课时）

> 建立"评估 → 发现问题 → 优化 → 再验证"的闭环

1. CI/CD 集成 — 在部署流水线中加入自动化 eval 门禁
2. A/B 测试框架 — Prompt / 模型 / 参数的对比实验设计
3. 人工标注系统 — 标注任务管理、标注员一致性、反馈回路
4. 回归测试 — 确保优化不引入新问题的策略
5. 评估驱动优化 — 用评估数据指导 Prompt 工程和 RAG 调优
6. 阶段实战：建立完整的持续评估与优化闭环

### 最终项目

详见 [final-project/项目说明.md](./final-project/项目说明.md)

为前两门课程的项目搭建一套完整的评估与可观测性系统，包含自动化 eval、质量 dashboard、成本监控、A/B 测试。

## 学习建议

1. **先学完前两门课**：本课程的评估对象直接来自 01 和 02 课程的产出
2. **每阶段产出评估报告**：不只是写代码，要能解读评估数据并给出优化建议
3. **用真实数据评估**：不要只用 toy dataset，用自己的业务数据跑评估
4. **关注成本**：评估本身也有 API 成本，学会在评估质量和成本间取舍

## 参考官方文档

- [DeepEval 文档](https://docs.confident-ai.com/)
- [RAGAS 文档](https://docs.ragas.io/)
- [Langfuse 文档](https://langfuse.com/docs)
- [Braintrust 文档](https://braintrust.dev/docs)
- [promptfoo 文档](https://www.promptfoo.dev/docs/)
