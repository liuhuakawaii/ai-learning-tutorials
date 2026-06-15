# 01 RAG 第一性原理

> RAG 不是"给模型加个搜索"——是让 AI 从"凭记忆回答"变成"查资料回答"。

## 学习目标

- 理解 RAG 的本质和解决的问题
- 掌握 RAG 架构的核心组件
- 理解 RAG 与微调的适用场景
- 设计企业级 RAG 系统的架构

## 前置要求

- 已完成阶段 1-2，理解 LLM API 和对话系统
- 了解向量和相似度的基本概念

## 为什么需要 RAG

大模型有两个致命缺陷：

1. **知识截止**：训练数据有截止日期，不知道最新信息
2. **幻觉**：不确定时会编造看似合理的答案

RAG（Retrieval-Augmented Generation）的核心思想：**先检索，再生成**。

```
用户问题 → 检索相关文档 → 把文档 + 问题一起给 LLM → LLM 基于文档生成回答
```

### RAG vs 微调

| 维度 | RAG | 微调 |
|------|-----|------|
| 知识更新 | 更新文档即可 | 需要重新训练 |
| 成本 | 低（只需要向量数据库） | 高（GPU、数据标注） |
| 可解释性 | 高（能引用原文） | 低（黑盒） |
| 适用场景 | 知识问答、文档检索 | 风格调整、特定任务 |
| 数据安全 | 数据留在本地 | 数据可能泄露到模型 |

**结论**：企业知识库问答首选 RAG，只有在需要调整模型行为风格时才考虑微调。

## RAG 架构

```
┌─────────────────────────────────────────────────┐
│                  RAG Pipeline                    │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ 文档处理  │ →  │ 向量存储  │ →  │ 检索生成  │  │
│  │ Pipeline  │    │ Database  │    │ Pipeline  │  │
│  └──────────┘    └──────────┘    └──────────┘  │
│                                                  │
│  1. 解析文档      2. 存储向量     3. 检索相关    │
│  3. 切分文本      4. 建立索引     4. 组装 Prompt │
│  5. 生成 Embedding                5. 调用 LLM   │
└─────────────────────────────────────────────────┘
```

### 核心组件

1. **文档加载器**：解析 PDF/Word/网页等格式
2. **文本切分器**：将长文档切成小块
3. **Embedding 模型**：将文本转为向量
4. **向量数据库**：存储和检索向量
5. **检索器**：根据问题检索相关文档
6. **生成器**：基于检索结果生成回答

## RAG 质量评估

```python
class RAGEvaluator:
    """RAG 质量评估"""
    
    async def evaluate(self, test_cases: list[dict]) -> dict:
        results = []
        for case in test_cases:
            # 检索相关文档
            retrieved = await self.retriever.search(case["question"], top_k=5)
            
            # 生成回答
            answer = await self.generator.generate(case["question"], retrieved)
            
            # 评估
            results.append({
                "question": case["question"],
                "retrieval_score": self._eval_retrieval(retrieved, case["relevant_docs"]),
                "answer_score": self._eval_answer(answer, case["expected_answer"]),
                "faithfulness": self._eval_faithfulness(answer, retrieved),
            })
        
        return {
            "avg_retrieval_score": sum(r["retrieval_score"] for r in results) / len(results),
            "avg_answer_score": sum(r["answer_score"] for r in results) / len(results),
            "avg_faithfulness": sum(r["faithfulness"] for r in results) / len(results),
        }
    
    def _eval_faithfulness(self, answer: str, contexts: list[str]) -> float:
        """评估回答的忠实度——回答是否基于检索到的文档"""
        # 简单实现：检查回答中的关键信息是否出现在上下文中
        # 生产环境应该用 LLM 做更精确的评估
        ...
```

## 练习

### 练习 1：RAG vs 直接回答

对比同一个问题在有 RAG 和没有 RAG 时的回答质量：

1. 准备 10 个关于"星辰科技产品"的问题
2. 不用 RAG，直接问 LLM（它会编造）
3. 用 RAG，先检索产品文档再问 LLM
4. 对比回答的准确性和可靠性

### 练习 2：架构设计

为你熟悉的业务场景设计 RAG 架构：

1. 数据源是什么？（文档、数据库、网页）
2. 怎么切分文本？
3. 用什么 Embedding 模型？
4. 怎么评估检索质量？

## 本节要点

- RAG = Retrieval + Augmented + Generation，核心是"先查资料再回答"
- RAG 比微调更适合企业知识库场景：成本低、更新快、可解释
- RAG 质量取决于三个环节：文档处理、检索质量、生成质量
- 评估是持续优化的基础，必须建立评估体系

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 检索不到相关内容 | 切分粒度太大或太小 | 调整 chunk size |
| 回答不引用文档 | Prompt 没要求引用 | 在 System Prompt 中强调 |
| 检索延迟太高 | 向量索引没优化 | 用 HNSW 索引 |
| 回答质量不稳定 | 没有评估体系 | 建立自动化评估 |
