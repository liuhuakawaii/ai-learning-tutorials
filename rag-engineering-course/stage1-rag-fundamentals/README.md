# Stage 1: RAG 基础回顾与进阶

```
╔══════════════════════════════════════════════════════════════════╗
║                    RAG Engineering Course                       ║
║                   Stage 1: RAG 基础回顾与进阶                    ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐       ║
║   │ Lesson1 │──▶│ Lesson2 │──▶│ Lesson3 │──▶│ Lesson4 │       ║
║   │ RAG回顾  │   │ 文档解析 │   │ 分块策略 │   │Embedding│       ║
║   └─────────┘   └─────────┘   └─────────┘   └────┬────┘       ║
║                                                    │             ║
║                    ┌─────────┐   ┌─────────┐      │             ║
║                    │ Lesson6 │◀──│ Lesson5 │◀─────┘             ║
║                    │ 阶段实战 │   │ 向量数据库│                    ║
║                    └─────────┘   └─────────┘                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

## 课程定位

Stage 1 是整个 RAG Engineering 课程的基础阶段。本阶段将带你从 RAG 的基本概念出发，系统性地掌握构建高质量 RAG 系统所需的每一个核心组件。

**前置要求：**
- Python 基础编程能力
- 了解 LLM API 的基本使用（如 OpenAI API）
- 基本的命令行操作能力

**预计学习时间：** 5-6 小时

## 学习目标

完成 Stage 1 后，你将能够：

1. 理解 RAG 的三种范式（Naive / Advanced / Modular）及其适用场景
2. 掌握文档解析的核心技术，处理表格、图片等复杂文档
3. 根据业务场景选择合适的分块策略
4. 评估和选择 Embedding 模型
5. 对比主流向量数据库并做出技术选型
6. 独立构建一个完整的高质量 RAG 基线系统

## 课程大纲

| 序号 | 课程 | 主题 | 预计时间 |
|------|------|------|----------|
| 01 | [RAG 架构回顾](./01-RAG架构回顾.md) | Naive vs Advanced vs Modular RAG、三阶段流水线、常见失败模式 | 45 分钟 |
| 02 | [文档解析进阶 - 表格与图片](./02-文档解析进阶-表格与图片.md) | PDF/HTML/Excel 表格解析、图片提取、多模态文档处理 | 50 分钟 |
| 03 | [分块策略深度](./03-分块策略深度.md) | 递归分块、语义分块、文档级分块、元数据增强 | 50 分钟 |
| 04 | [Embedding 模型选型](./04-Embedding模型选型.md) | 模型架构、评测指标、主流模型对比、微调策略 | 50 分钟 |
| 05 | [向量数据库对比](./05-向量数据库对比.md) | Milvus/Qdrant/Weaviate/Pinecone/ChromaDB、索引算法、元数据过滤 | 50 分钟 |
| 06 | [阶段实战 - 构建高质量 RAG 基线](./06-阶段实战-构建高质量RAG基线.md) | 整合所有组件、构建完整系统、评估基线、文档化决策 | 90 分钟 |

## 学习建议

```
┌──────────────────────────────────────────────────────────────┐
│                      学习路径建议                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 按顺序学习：Lesson 1-6 有递进关系                         │
│  2. 动手实践：每个 Lesson 都有代码示例和练习题                  │
│  3. 记录笔记：记录你的理解和疑问                               │
│  4. 完成练习：每课 3 道练习题是巩固知识的关键                   │
│  5. 阶段实战：Lesson 6 是综合项目，务必完成                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 环境准备

```bash
# 创建虚拟环境
python -m venv rag-course-env
source rag-course-env/bin/activate  # Linux/Mac
# rag-course-env\Scripts\activate   # Windows

# 安装核心依赖
pip install langchain langchain-openai llama-index
pip install pymupdf unstructured python-docx
pip install sentence-transformers
pip install chromadb qdrant-client pymilvus
pip install openai cohere
pip install pandas numpy matplotlib
```

## 课程系列导航

- **Stage 1: RAG 基础回顾与进阶** ← 你在这里
- [Stage 2: 检索优化](../stage2-retrieval-optimization/) ✅
- [Stage 3: 高级 RAG 架构](../stage3-advanced-rag/) ✅
- [Stage 4: RAG 生产化](../stage4-rag-production/) ✅
- [Stage 5: RAG 评估与持续优化](../stage5-evaluation/) ✅
