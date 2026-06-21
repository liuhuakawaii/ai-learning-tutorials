# 01 - Self-RAG 自适应检索

> Stage 3 Lesson 1 | 前置要求：Stage 2 完成 | 时长：55 分钟

```
╔══════════════════════════════════════════════════════════╗
║            Self-RAG: 让模型自己决定何时检索               ║
║                                                          ║
║   "不是所有问题都需要检索，也不是所有检索都有用"          ║
╚══════════════════════════════════════════════════════════╝
```

## 🎯 学习目标

完成本课后，你将能够：

1. 理解 Self-RAG 的反思 token（Reflection Tokens）机制
2. 实现 Retrieve/No-Retrieve 自适应决策
3. 构建相关性评估器（Relevance Assessor）和正确性评估器（Support Assessor）
4. 对比 Naive RAG、Adaptive RAG 与 Self-RAG 的差异
5. 用代码实现一个完整的 Self-RAG 系统

---

## 1. 为什么需要 Self-RAG？

### 1.1 Naive RAG 的困境

传统 RAG（Naive RAG）存在几个核心问题：

```
  Naive RAG 的问题
  ════════════════

  用户提问 ──► 无条件检索 ──► 检索结果可能无关 ──► 强制使用结果生成
      │              │                │                    │
      ▼              ▼                ▼                    ▼
  "你好"        检索维基百科      返回不相关片段        生成胡言乱语
  "2+2=?"       检索数学教材      返回正确但不必要      增加延迟和成本
  "法国首都?"   检索地理文档      返回过多信息          答案被稀释
```

**核心痛点**：

- **无差别检索**：不管问题是否需要外部知识，都执行检索
- **无质量评估**：检索到的内容不管好坏，都直接塞给 LLM
- **无正确性校验**：生成的答案是否被检索结果支持，无从得知

### 1.2 Self-RAG 的核心思想

Self-RAG（Self-Reflective RAG）由 Asai et al. (2023) 提出，核心思想是：

> **让语言模型通过特殊的"反思 token"来自主决定何时检索、如何评估检索结果、
> 以及生成的答案是否得到支持。**

```
  Self-RAG vs Naive RAG
  ═════════════════════

  Naive RAG:
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  检索?    │───►│  生成    │───►│  输出    │
  │  总是!   │    │          │    │          │
  └──────────┘    └──────────┘    └──────────┘

  Self-RAG:
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │ 需要检索? │───►│ 检索相关? │───►│ 答案支持? │───►│ 有用?    │
  │ [Retrieve]│    │[Relevant] │    │ [Support] │    │[Utility] │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
       │               │               │               │
       ▼               ▼               ▼               ▼
    Yes/No          Score           Score           Score
```

---

## 2. Self-RAG 的反思 Token 机制

### 2.1 四类反思 Token

Self-RAG 定义了四类特殊的反思 token，模型在生成过程中会输出这些 token 来进行自我评估：

```
  ┌─────────────────────────────────────────────────────────┐
  │                   Reflection Tokens                     │
  ├──────────────┬──────────────────────────────────────────┤
  │ Token 类型    │ 作用                                     │
  ├──────────────┼──────────────────────────────────────────┤
  │ [Retrieve]   │ 决定是否需要检索外部知识                   │
  │              │ → 输出 Yes / No                           │
  ├──────────────┼──────────────────────────────────────────┤
  │ [IsRel]      │ 评估检索到的段落是否与问题相关              │
  │              │ → 输出 Relevant / Irrelevant / Ambiguous  │
  ├──────────────┼──────────────────────────────────────────┤
  │ [IsSup]      │ 评估生成的答案是否被检索内容支持            │
  │              │ → 输出 Fully / Partially / No Support     │
  ├──────────────┼──────────────────────────────────────────┤
  │ [IsUse]      │ 评估生成的答案对用户是否有用                │
  │              │ → 输出 5 级评分 (1-5)                     │
  └──────────────┴──────────────────────────────────────────┘
```

### 2.2 Self-RAG 完整流程

```
                        用户问题
                           │
                           ▼
                  ┌─────────────────┐
                  │  [Retrieve] 决策 │
                  │  需要检索吗?     │
                  └────────┬────────┘
                     Yes   │   No
              ┌────────────┘   └────────────┐
              ▼                             ▼
     ┌─────────────────┐          ┌─────────────────┐
     │  检索外部文档     │          │  直接生成答案    │
     └────────┬────────┘          │  (内部知识)      │
              │                   └────────┬────────┘
              ▼                            │
     ┌─────────────────┐                   │
     │  [IsRel] 评估    │                   │
     │  段落相关吗?      │                   │
     └────────┬────────┘                   │
         Relevant                         │
              │                           │
              ▼                           │
     ┌─────────────────┐                   │
     │  基于段落生成答案 │◄──────────────────┘
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │  [IsSup] 评估    │
     │  答案被支持吗?    │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │  [IsUse] 评估    │
     │  答案有用吗?      │
     └────────┬────────┘
              │
              ▼
         最终输出
```

---

## 3. 代码实现：Self-RAG 系统

### 3.1 环境准备

```python
"""
Self-RAG 自适应检索系统实现
Stage 3 - Lesson 01
"""

import os
from typing import Literal, TypedDict
from dataclasses import dataclass, field
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser

os.environ["OPENAI_API_KEY"] = "your-api-key-here"

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
```

### 3.2 构建向量数据库

```python
def build_vectorstore(documents: list[Document]) -> Chroma:
    """构建向量数据库"""
    vectorstore = Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        collection_name="self_rag_demo",
    )
    return vectorstore


# 示例文档
sample_docs = [
    Document(
        page_content="Python 是一种高级编程语言，由 Guido van Rossum 于 1991 年创建。",
        metadata={"source": "python_intro.md"},
    ),
    Document(
        page_content="Python 支持多种编程范式，包括面向对象、函数式和过程式编程。",
        metadata={"source": "python_paradigms.md"},
    ),
    Document(
        page_content="机器学习是人工智能的一个子领域，使计算机能够从数据中学习。",
        metadata={"source": "ml_intro.md"},
    ),
    Document(
        page_content="深度学习使用多层神经网络来处理复杂的模式识别任务。",
        metadata={"source": "deep_learning.md"},
    ),
    Document(
        page_content="RAG（检索增强生成）结合了信息检索和文本生成技术。",
        metadata={"source": "rag_intro.md"},
    ),
]

vectorstore = build_vectorstore(sample_docs)
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
```

### 3.3 实现反思 Token 评估器

```python
# ============================================================
# 反思 Token 1: [Retrieve] - 是否需要检索
# ============================================================

retrieve_prompt = ChatPromptTemplate.from_template(
    """你是一个智能检索决策系统。根据用户的问题，判断是否需要检索外部知识。

以下情况需要检索 [Yes]:
- 问题涉及具体事实、数据、日期
- 问题需要最新信息
- 问题涉及专业领域知识
- 问题需要引用来源

以下情况不需要检索 [No]:
- 简单问候或闲聊
- 常识性问题（如 2+2=?）
- 模型已经有足够知识的问题
- 创意写作或假设性问题

用户问题: {question}

请只回答 [Yes] 或 [No]。"""
)

retrieve_chain = retrieve_prompt | llm | StrOutputParser()


def should_retrieve(question: str) -> bool:
    """判断是否需要检索"""
    result = retrieve_chain.invoke({"question": question}).strip()
    return "[Yes]" in result or "Yes" in result


# ============================================================
# 反思 Token 2: [IsRel] - 检索结果相关性评估
# ============================================================

relevance_prompt = ChatPromptTemplate.from_template(
    """你是一个检索结果相关性评估器。判断检索到的段落是否与用户问题相关。

用户问题: {question}

检索到的段落:
{context}

请评估相关性，只回答以下之一:
- [Relevant]: 段落与问题直接相关，包含有用信息
- [Irrelevant]: 段落与问题无关
- [Ambiguous]: 段落可能相关但信息不够明确"""
)

relevance_chain = relevance_prompt | llm | StrOutputParser()


def assess_relevance(question: str, context: str) -> str:
    """评估检索结果的相关性"""
    result = relevance_chain.invoke(
        {"question": question, "context": context}
    ).strip()
    if "[Relevant]" in result:
        return "relevant"
    elif "[Irrelevant]" in result:
        return "irrelevant"
    return "ambiguous"


# ============================================================
# 反思 Token 3: [IsSup] - 答案支持度评估
# ============================================================

support_prompt = ChatPromptTemplate.from_template(
    """你是一个答案支持度评估器。判断生成的答案是否被检索到的内容所支持。

检索内容:
{context}

生成的答案:
{answer}

请评估支持度，只回答以下之一:
- [Fully Supported]: 答案完全由检索内容支持
- [Partially Supported]: 答案部分由检索内容支持
- [No Support]: 答案没有被检索内容支持，可能是幻觉"""
)

support_chain = support_prompt | llm | StrOutputParser()


def assess_support(context: str, answer: str) -> str:
    """评估答案是否被检索内容支持"""
    result = support_chain.invoke(
        {"context": context, "answer": answer}
    ).strip()
    if "Fully" in result:
        return "fully_supported"
    elif "Partially" in result:
        return "partially_supported"
    return "no_support"


# ============================================================
# 反思 Token 4: [IsUse] - 答案有用性评估
# ============================================================

utility_prompt = ChatPromptTemplate.from_template(
    """你是一个答案质量评估器。评估生成的答案对用户的有用程度。

用户问题: {question}
生成的答案: {answer}

请给出 1-5 的评分:
- [5]: 非常有用，直接回答了问题
- [4]: 比较有用，基本回答了问题
- [3]: 一般有用，部分回答了问题
- [2]: 用处不大，没有直接回答问题
- [1]: 完全无用，答非所问

请只回答评分，如 [4]。"""
)

utility_chain = utility_prompt | llm | StrOutputParser()


def assess_utility(question: str, answer: str) -> int:
    """评估答案有用性"""
    result = utility_chain.invoke(
        {"question": question, "answer": answer}
    ).strip()
    for score in range(5, 0, -1):
        if f"[{score}]" in result:
            return score
    return 3  # 默认中等评分
```

### 3.4 完整 Self-RAG 管道

```python
@dataclass
class SelfRAGResult:
    """Self-RAG 运行结果"""
    question: str
    answer: str
    retrieved: bool
    relevance: str = ""
    support: str = ""
    utility: int = 0
    context: str = ""


class SelfRAG:
    """
    Self-RAG 自适应检索系统

    核心流程:
    1. [Retrieve] 判断是否需要检索
    2. 如果需要，检索并评估相关性 [IsRel]
    3. 生成答案
    4. 评估答案支持度 [IsSup]
    5. 评估答案有用性 [IsUse]
    """

    def __init__(self, retriever, llm):
        self.retriever = retriever
        self.llm = llm
        self.generate_prompt = ChatPromptTemplate.from_template(
            """基于以下上下文信息回答用户问题。如果上下文为空，则使用你的内部知识。

上下文:
{context}

用户问题: {question}

请直接回答问题，不要提及上下文的存在。"""
        )
        self.generate_chain = self.generate_prompt | llm | StrOutputParser()

    def run(self, question: str) -> SelfRAGResult:
        """运行 Self-RAG 管道"""
        # Step 1: [Retrieve] 决策
        need_retrieve = should_retrieve(question)

        if not need_retrieve:
            # 不需要检索，直接生成
            answer = self.generate_chain.invoke({
                "context": "",
                "question": question,
            })
            utility = assess_utility(question, answer)
            return SelfRAGResult(
                question=question,
                answer=answer,
                retrieved=False,
                utility=utility,
            )

        # Step 2: 检索
        docs = self.retriever.invoke(question)
        context = "\n\n".join([doc.page_content for doc in docs])

        # Step 3: [IsRel] 相关性评估
        relevance = assess_relevance(question, context)

        if relevance == "irrelevant":
            # 检索结果不相关，回退到内部知识
            answer = self.generate_chain.invoke({
                "context": "",
                "question": question,
            })
            return SelfRAGResult(
                question=question,
                answer=answer,
                retrieved=True,
                relevance=relevance,
                utility=assess_utility(question, answer),
                context=context,
            )

        # Step 4: 基于上下文生成答案
        answer = self.generate_chain.invoke({
            "context": context,
            "question": question,
        })

        # Step 5: [IsSup] 支持度评估
        support = assess_support(context, answer)

        # Step 6: [IsUse] 有用性评估
        utility = assess_utility(question, answer)

        return SelfRAGResult(
            question=question,
            answer=answer,
            retrieved=True,
            relevance=relevance,
            support=support,
            utility=utility,
            context=context,
        )

    def pretty_print(self, result: SelfRAGResult):
        """美化输出结果"""
        print("=" * 60)
        print(f"  问题: {result.question}")
        print(f"  检索: {'✅ Yes' if result.retrieved else '❌ No'}")
        if result.relevance:
            emoji = {"relevant": "✅", "irrelevant": "❌", "ambiguous": "⚠️"}
            print(f"  相关性: {emoji.get(result.relevance, '?')} {result.relevance}")
        if result.support:
            emoji = {
                "fully_supported": "✅",
                "partially_supported": "⚠️",
                "no_support": "❌",
            }
            print(f"  支持度: {emoji.get(result.support, '?')} {result.support}")
        print(f"  有用性: {'⭐' * result.utility} ({result.utility}/5)")
        print("-" * 60)
        print(f"  答案: {result.answer}")
        print("=" * 60)
```

### 3.5 运行 Self-RAG

```python
def main():
    """运行 Self-RAG 演示"""
    self_rag = SelfRAG(retriever=retriever, llm=llm)

    questions = [
        "你好，最近怎么样？",           # 不需要检索
        "Python 是谁创建的？",          # 需要检索
        "什么是 RAG 技术？",            # 需要检索
        "2 + 2 等于多少？",             # 不需要检索
        "深度学习和机器学习的关系是什么？",  # 需要检索
    ]

    for q in questions:
        result = self_rag.run(q)
        self_rag.pretty_print(result)
        print()


if __name__ == "__main__":
    main()
```

---

## 4. 对比分析

### Naive RAG vs Adaptive RAG vs Self-RAG

```
  三种 RAG 架构对比
  ═════════════════

  Naive RAG:          Adaptive RAG:        Self-RAG:
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │ 检索      │        │ 检索?    │        │ 检索?    │
  │ (总是)    │        │ (分类器) │        │ (反思)   │
  └────┬─────┘        └────┬─────┘        └────┬─────┘
       ▼                   ▼                   ▼
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │ 生成      │        │ 生成      │        │ 相关?    │
  │ (无评估)  │        │          │        │ (评估)   │
  └────┬─────┘        └────┬─────┘        └────┬─────┘
       ▼                   ▼                   ▼
  ┌──────────┐        ┌──────────┐        ┌──────────┐
  │ 输出      │        │ 输出      │        │ 支持?    │
  │          │        │          │        │ (校验)   │
  └──────────┘        └──────────┘        └────┬─────┘
                                               ▼
                                          ┌──────────┐
                                          │ 有用?    │
                                          │ (评分)   │
                                          └────┬─────┘
                                               ▼
                                          ┌──────────┐
                                          │ 输出      │
                                          └──────────┘
```

| 维度 | Naive RAG | Adaptive RAG | Self-RAG |
|------|-----------|--------------|----------|
| **检索决策** | 总是检索 | 基于分类器 | 模型自决策（反思 token） |
| **质量评估** | 无 | 无 | 多维度评估（相关性/支持度/有用性） |
| **幻觉检测** | 无 | 无 | 通过 [IsSup] 检测 |
| **实现复杂度** | ⭐ 低 | ⭐⭐ 中 | ⭐⭐⭐ 高 |
| **答案质量** | 中等 | 较好 | 最优 |
| **延迟** | 固定（含检索） | 动态 | 动态（可能跳过检索） |
| **适用场景** | 简单问答 | 生产环境 | 高质量要求场景 |
| **训练需求** | 无需训练 | 需要分类器 | 需要反思 token 训练 |

---

## 5. 常见错误与陷阱

### ❌ 错误 1：反思 token 评估过于严格

```python
# ❌ 错误做法：只要不是 fully_supported 就丢弃答案
if support != "fully_supported":
    answer = regenerate()  # 可能陷入无限循环

# ✅ 正确做法：设置合理的阈值和重试上限
def generate_with_retry(question, context, max_retries=2):
    for attempt in range(max_retries):
        answer = generate(question, context)
        support = assess_support(context, answer)
        if support in ("fully_supported", "partially_supported"):
            return answer
    return answer  # 达到重试上限，返回最后一次结果
```

### ❌ 错误 2：忽略 [Retrieve] 为 No 的情况

```python
# ❌ 错误做法：总是执行检索
def run(question):
    docs = retriever.invoke(question)  # 浪费资源
    return generate(question, docs)

# ✅ 正确做法：先判断是否需要检索
def run(question):
    if should_retrieve(question):
        docs = retriever.invoke(question)
    else:
        docs = []
    return generate(question, docs)
```

### ❌ 错误 3：单次检索结果不佳就放弃

```python
# ❌ 错误做法：只检索一次
docs = retriever.invoke(question)
relevance = assess_relevance(question, docs)
if relevance == "irrelevant":
    return "无法回答"  # 太快放弃

# ✅ 正确做法：尝试不同的检索策略
def retrieve_with_fallback(question):
    # 策略 1: 语义检索
    docs = semantic_retriever.invoke(question)
    if assess_relevance(question, docs) == "relevant":
        return docs

    # 策略 2: 关键词检索
    docs = keyword_retriever.invoke(question)
    if assess_relevance(question, docs) == "relevant":
        return docs

    # 策略 3: 查询改写后检索
    rewritten = rewrite_query(question)
    docs = semantic_retriever.invoke(rewritten)
    return docs
```

---

## 📝 本课小结

```
  Self-RAG 核心要点
  ═════════════════

  ┌─────────────────────────────────────────────────────┐
  │  1. Self-RAG 让模型自主决定何时检索                   │
  │     → 避免不必要的检索，节省成本和延迟                │
  │                                                     │
  │  2. 四类反思 Token 实现多维度质量控制                 │
  │     → [Retrieve] [IsRel] [IsSup] [IsUse]           │
  │                                                     │
  │  3. 相关性评估过滤低质量检索结果                      │
  │     → 不相关的段落不参与答案生成                      │
  │                                                     │
  │  4. 支持度评估检测幻觉                               │
  │     → 答案必须有检索内容支撑                         │
  │                                                     │
  │  5. 有用性评估确保答案质量                            │
  │     → 多维评分驱动答案优化                           │
  └─────────────────────────────────────────────────────┘
```

---

## 🏋️ 练习题

### 练习 1：扩展反思 Token（基础）

为 Self-RAG 添加一个新的反思 token `[IsComplete]`，用于评估答案是否完整回答了问题的所有部分。

**要求**：
- 设计评估 prompt
- 实现 `assess_completeness()` 函数
- 将其集成到 SelfRAG 管道中

### 练习 2：多策略检索（进阶）

实现一个带有多策略回退的检索器，当语义检索结果不相关时，自动切换到关键词检索。

**要求**：
- 实现 `SemanticRetriever` 和 `KeywordRetriever`
- 实现 `MultiStrategyRetriever`，自动选择最佳策略
- 添加策略选择的日志记录

### 练习 3：Self-RAG 评估框架（挑战）

构建一个评估框架，对比 Self-RAG 和 Naive RAG 在以下维度的表现：

**要求**：
- 准备 20 个测试问题（涵盖需要检索和不需要检索的场景）
- 评估指标：准确率、幻觉率、平均延迟、平均 token 消耗
- 生成对比报告

```python
# 评估框架骨架
class SelfRAGEvaluator:
    def __init__(self, self_rag, naive_rag):
        self.self_rag = self_rag
        self.naive_rag = naive_rag

    def evaluate(self, test_cases: list[dict]) -> dict:
        """运行评估并返回对比结果"""
        results = {
            "self_rag": {"accuracy": 0, "hallucination": 0, "latency": 0},
            "naive_rag": {"accuracy": 0, "hallucination": 0, "latency": 0},
        }
        # TODO: 实现评估逻辑
        return results
```

---

> 📌 **下一课**：[02 - GraphRAG 知识图谱增强](./02-GraphRAG知识图谱增强.md) — 用知识图谱增强检索能力
