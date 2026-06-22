# Stage 3: 高级 RAG 架构

> 从基础检索增强生成迈向生产级高级 RAG 系统

```
╔══════════════════════════════════════════════════════════════════╗
║                    RAG Engineering Course                       ║
║                                                                  ║
║  Stage 1: Foundations        ✅ Complete                        ║
║  Stage 2: Core RAG Pipeline  ✅ Complete                        ║
║  Stage 3: Advanced RAG       ◀◀◀ YOU ARE HERE                  ║
║  Stage 4: Production RAG     🔲 Locked                          ║
╚══════════════════════════════════════════════════════════════════╝
```

## 📋 Stage 3 概览

Stage 3 聚焦于**高级 RAG 架构**，涵盖六大核心主题。每一课都深入一个前沿技术方向，
帮助你从"能跑通的 RAG"进阶到"智能、鲁棒、可扩展的 RAG"。

### 前置要求

- ✅ 完成 Stage 2（核心 RAG 管道）
- ✅ 熟悉向量检索、嵌入模型、基本 LLM 调用
- ✅ 了解 LangChain / LlamaIndex 基本用法

---

## 📚 课程目录

| # | 课程 | 时长 | 核心主题 |
|---|------|------|----------|
| 01 | [Self-RAG 自适应检索](./01-Self-RAG自适应检索.md) | 55 min | 反思 token、自适应检索决策、相关性/正确性评估 |
| 02 | [GraphRAG 知识图谱增强](./02-GraphRAG知识图谱增强.md) | 60 min | 实体/关系抽取、图谱构建、社区检测、图检索 |
| 03 | [Agentic RAG 智能检索](./03-Agentic-RAG智能检索.md) | 55 min | Agent 驱动检索、工具调用、多步推理、错误恢复 |
| 04 | [多模态 RAG](./04-多模态RAG.md) | 50 min | 图文嵌入、跨模态检索、多模态生成 |
| 05 | [层级检索 HIERARCHICAL](./05-层级检索HIERARCHICAL.md) | 50 min | 多级索引、RAPTOR 树、长文档处理 |
| 06 | [阶段实战：实现 Self-RAG](./06-阶段实战-实现Self-RAG.md) | 90 min | 完整 Self-RAG 系统实战 |

---

## 🗺️ 学习路线图

```
                    Stage 3: 高级 RAG 架构
                    ══════════════════════

    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │   01 Self-RAG ◄──── 自适应检索决策                   │
    │        │                                            │
    │        ▼                                            │
    │   02 GraphRAG ◄──── 知识图谱增强                     │
    │        │                                            │
    │        ▼                                            │
    │   03 Agentic RAG ◄──── 智能 Agent 检索               │
    │        │                                            │
    │        ▼                                            │
    │   04 多模态 RAG ◄──── 图文混合检索                    │
    │        │                                            │
    │        ▼                                            │
    │   05 层级检索 ◄──── 多级索引结构                      │
    │        │                                            │
    │        ▼                                            │
    │   06 阶段实战 ◄──── Self-RAG 完整实现                 │
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

---

## 🎯 Stage 3 学习目标

完成 Stage 3 后，你将能够：

1. **理解并实现 Self-RAG**：掌握反思 token 机制，构建自适应检索系统
2. **构建 GraphRAG 管道**：从非结构化文本抽取知识图谱，实现图检索增强问答
3. **开发 Agentic RAG**：利用 LangGraph 构建 Agent 驱动的多步推理检索系统
4. **实现多模态 RAG**：处理图文混合数据，实现跨模态检索与生成
5. **设计层级检索**：构建多级索引，高效处理长文档
6. **独立完成实战项目**：从零实现一个完整的 Self-RAG 系统

---

## 🛠️ 环境准备

```bash
# 创建虚拟环境
python -m venv stage3-env
source stage3-env/bin/activate  # Linux/Mac
# stage3-env\Scripts\activate   # Windows

# 安装核心依赖
pip install langchain langchain-openai langchain-community
pip install llama-index llama-index-embeddings-openai
pip install networkx matplotlib
pip install transformers torch
pip install langgraph
pip install openai chromadb
pip install Pillow requests
```

---

## 📖 推荐阅读

- [Self-RAG: Learning to Retrieve, Generate, and Critique](https://arxiv.org/abs/2310.11511)
- [From Local to Global: A Graph RAG Approach](https://arxiv.org/abs/2404.16130)
- [RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval](https://arxiv.org/abs/2401.18059)
- [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)

---

> 💡 **提示**：每课都包含动手代码示例，建议边学边练，逐课完成。
