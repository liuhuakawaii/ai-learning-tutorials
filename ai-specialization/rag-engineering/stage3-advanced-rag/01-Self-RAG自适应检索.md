# 01 - Self-RAG 自适应检索

> Stage 3 Lesson 1 | 前置要求：Stage 2 完成 | 时长：55 分钟

```
╔══════════════════════════════════════════════════════════╗
║            Self-RAG: 让模型自己决定何时检索               ║
║                                                          ║
║   "不是所有问题都需要检索，也不是所有检索都有用"          ║
╚══════════════════════════════════════════════════════════╝
```

## 场景引入

你的 RAG 系统对每个用户问题都执行检索，但数据显示有 30% 的查询其实不需要检索——比如"你好""谢谢""帮我总结一下上面的内容"这类问题，强行检索反而会引入无关文档，增加延迟和成本。更糟糕的是，有时候检索到了看似相关但实际包含错误信息的文档，LLM 照单全收导致生成了误导性回答。你需要系统具备"自主判断"能力：知道什么时候该检索、什么时候不该检索，以及检索到的内容是否真的可信。

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

## 5. 常见误区

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

## 工程建议

1. **Self-RAG 的反思标记需要针对你的领域微调**：通用的反思标记（如 ISREL、ISSUP）在特定领域可能判断不准。建议用你自己的业务数据微调反思判断模块，尤其是相关性和支持度的判断。
2. **设置检索回退机制**：Self-RAG 可能判断不需要检索但实际需要，或判断需要检索但检索结果质量差。系统应有回退策略——当生成的回答置信度低于阈值时，强制执行检索并重新生成。
3. **监控"不检索"决策的准确率**：记录模型决定不检索的案例中，有多少是正确的。如果误判率超过 10%，说明反思模块需要调整或微调。
4. **Self-RAG 适合对回答质量要求高的场景**：如果延迟是首要考虑，传统 RAG 更合适；如果回答的准确性和可信度是核心要求，Self-RAG 的额外延迟是值得的。

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

---

## 参考答案

### 练习 1：扩展反思 Token（基础）

**思路**：设计一个评估 prompt，让 LLM 判断答案是否完整覆盖了问题的所有子问题或所有方面。然后将该评估函数集成到 SelfRAG 管道的生成步骤之后，在 [IsUse] 之前执行。

**答案**：

```python
# ============================================================
# 反思 Token: [IsComplete] - 答案完整性评估
# ============================================================

completeness_prompt = ChatPromptTemplate.from_template(
    """你是一个答案完整性评估器。判断生成的答案是否完整回答了问题的所有部分。

用户问题: {question}

生成的答案: {answer}

请评估完整性，只回答以下之一:
- [Complete]: 答案完整回答了问题的所有部分
- [Partial]: 答案只回答了问题的部分内容
- [Incomplete]: 答案遗漏了问题的关键部分"""
)

completeness_chain = completeness_prompt | llm | StrOutputParser()


def assess_completeness(question: str, answer: str) -> str:
    """评估答案是否完整回答了问题"""
    result = completeness_chain.invoke(
        {"question": question, "answer": answer}
    ).strip()
    if "Complete" in result and "Incomplete" not in result and "Partial" not in result:
        return "complete"
    elif "Partial" in result:
        return "partial"
    return "incomplete"


# 集成到 SelfRAG 管道
class SelfRAGWithCompleteness(SelfRAG):
    """带完整性评估的 Self-RAG"""

    def run(self, question: str) -> SelfRAGResult:
        need_retrieve = should_retrieve(question)

        if not need_retrieve:
            answer = self.generate_chain.invoke({
                "context": "",
                "question": question,
            })
            completeness = assess_completeness(question, answer)
            utility = assess_utility(question, answer)
            return SelfRAGResult(
                question=question,
                answer=answer,
                retrieved=False,
                utility=utility,
                metadata={"completeness": completeness},
            )

        docs = self.retriever.invoke(question)
        context = "\n\n".join([doc.page_content for doc in docs])

        relevance = assess_relevance(question, context)
        if relevance == "irrelevant":
            answer = self.generate_chain.invoke({"context": "", "question": question})
        else:
            answer = self.generate_chain.invoke({"context": context, "question": question})

        support = assess_support(context, answer)
        completeness = assess_completeness(question, answer)
        utility = assess_utility(question, answer)

        # 如果不完整，尝试用更详细的上下文重新生成
        if completeness == "incomplete" and relevance == "relevant":
            more_docs = self.retriever.invoke(question)  # 可扩展为增大 k
            richer_context = "\n\n".join([doc.page_content for doc in more_docs])
            answer = self.generate_chain.invoke({
                "context": richer_context,
                "question": question,
            })
            completeness = assess_completeness(question, answer)
            utility = assess_utility(question, answer)

        return SelfRAGResult(
            question=question,
            answer=answer,
            retrieved=True,
            relevance=relevance,
            support=support,
            utility=utility,
            context=context,
            metadata={"completeness": completeness},
        )
```

**要点**：
- [IsComplete] 评估答案是否覆盖问题的所有子部分，与 [IsUse] 关注"有用程度"互补
- 完整性不达标时应尝试扩大检索范围重新生成，而非直接放弃
- 评估 prompt 需要明确定义 Complete/Partial/Incomplete 三种状态的边界，避免 LLM 判断模糊

---

### 练习 2：多策略检索（进阶）

**思路**：实现语义检索和关键词检索两个 Retriever 类，再用一个 MultiStrategyRetriever 包装它们，先尝试语义检索，评估相关性不达标时自动切换到关键词检索，并记录每次策略选择的日志。

**答案**：

```python
from dataclasses import dataclass, field
from typing import Protocol
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever


class BaseRetriever(Protocol):
    def invoke(self, query: str) -> list[Document]: ...


class SemanticRetriever:
    """语义检索器：基于向量相似度"""

    def __init__(self, vectorstore, k: int = 5):
        self.vectorstore = vectorstore
        self.k = k

    def invoke(self, query: str) -> list[Document]:
        return self.vectorstore.similarity_search(query, k=self.k)


class KeywordRetriever:
    """关键词检索器：基于 BM25"""

    def __init__(self, documents: list[Document], k: int = 5):
        self.retriever = BM25Retriever.from_documents(documents, k=k)

    def invoke(self, query: str) -> list[Document]:
        return self.retriever.invoke(query)


@dataclass
class RetrievalLog:
    query: str
    strategy_used: str
    relevance: str
    doc_count: int


class MultiStrategyRetriever:
    """多策略检索器：自动选择最佳策略"""

    def __init__(
        self,
        semantic_retriever: SemanticRetriever,
        keyword_retriever: KeywordRetriever,
    ):
        self.semantic = semantic_retriever
        self.keyword = keyword_retriever
        self.logs: list[RetrievalLog] = []

    def invoke(self, query: str) -> list[Document]:
        # 策略 1: 语义检索
        docs = self.semantic.invoke(query)
        context = "\n\n".join([d.page_content for d in docs])
        relevance = assess_relevance(query, context)

        if relevance == "relevant":
            self.logs.append(RetrievalLog(
                query=query,
                strategy_used="semantic",
                relevance=relevance,
                doc_count=len(docs),
            ))
            return docs

        # 策略 2: 关键词检索（语义检索不相关时回退）
        print(f"⚠️ 语义检索结果不相关，切换到关键词检索: {query}")
        docs = self.keyword.invoke(query)
        context = "\n\n".join([d.page_content for d in docs])
        relevance = assess_relevance(query, context)

        self.logs.append(RetrievalLog(
            query=query,
            strategy_used="keyword",
            relevance=relevance,
            doc_count=len(docs),
        ))

        return docs

    def print_log_summary(self):
        """打印策略选择日志"""
        print(f"\n📊 策略选择日志 (共 {len(self.logs)} 次检索):")
        for log in self.logs:
            print(f"  [{log.strategy_used:8s}] {log.relevance:10s} | {log.query}")


# 使用示例
all_docs = [Document(page_content="RAG 结合了检索和生成...")]
semantic = SemanticRetriever(vectorstore, k=5)
keyword = KeywordRetriever(all_docs, k=5)
multi = MultiStrategyRetriever(semantic, keyword)

results = multi.invoke("什么是 RAG？")
multi.print_log_summary()
```

**要点**：
- 语义检索优先，BM25 关键词检索作为回退策略，两者互补覆盖不同查询模式
- 每次检索都记录策略、相关性和文档数，便于后续分析哪种策略更有效
- 回退触发条件基于 [IsRel] 评估结果，而不是简单的空结果判断

---

### 练习 3：Self-RAG 评估框架（挑战）

**思路**：构建一个评估框架，准备涵盖检索和非检索场景的测试用例，分别对 Self-RAG 和 Naive RAG 运行测试，统计准确率、幻觉率、平均延迟和 token 消耗，最后生成对比报告。

**答案**：

```python
import time
from dataclasses import dataclass, field


@dataclass
class TestCase:
    question: str
    expected_answer: str
    needs_retrieval: bool
    category: str = "general"


@dataclass
class EvalResult:
    answer: str
    is_correct: bool
    has_hallucination: bool
    latency_ms: float
    token_count: int


class SelfRAGEvaluator:
    """Self-RAG 评估框架"""

    def __init__(self, self_rag: SelfRAG, naive_rag_retriever, llm):
        self.self_rag = self_rag
        self.naive_retriever = naive_rag_retriever
        self.llm = llm

    def build_test_cases(self) -> list[TestCase]:
        """构建 20 个测试问题"""
        return [
            # 需要检索的问题 (10 个)
            TestCase("Python 是谁创建的？", "Guido van Rossum", True, "factual"),
            TestCase("什么是 RAG 技术？", "检索增强生成", True, "conceptual"),
            TestCase("向量数据库有哪些常见产品？", "Pinecone, Weaviate, Milvus, Chroma", True, "factual"),
            TestCase("LangChain 框架的核心功能是什么？", "构建 LLM 应用", True, "conceptual"),
            TestCase("TensorFlow 和 PyTorch 有什么区别？", "两者的架构和生态差异", True, "comparison"),
            TestCase("知识图谱在 RAG 中的作用是什么？", "增强关系推理", True, "conceptual"),
            TestCase("CLIP 模型的工作原理是什么？", "文本和图像映射到同一向量空间", True, "conceptual"),
            TestCase("GPT-4 的主要能力提升有哪些？", "多模态、推理能力提升", True, "factual"),
            TestCase("什么是向量嵌入？", "将文本映射为高维向量", True, "conceptual"),
            TestCase("FAISS 是什么？它的用途是什么？", "Facebook 的向量检索库", True, "factual"),
            # 不需要检索的问题 (10 个)
            TestCase("你好，最近怎么样？", "问候回复", False, "greeting"),
            TestCase("2 + 2 等于多少？", "4", False, "math"),
            TestCase("请用 Python 写一个 Hello World", "print('Hello World')", False, "coding"),
            TestCase("将这句话翻译成英文：今天天气很好", "The weather is nice today", False, "translation"),
            TestCase("20 乘以 30 等于多少？", "600", False, "math"),
            TestCase("写一首关于春天的五言绝句", "四句五言诗", False, "creative"),
            TestCase("什么是递归？请简单解释", "函数调用自身的编程技术", False, "conceptual"),
            TestCase("JSON 的全称是什么？", "JavaScript Object Notation", False, "factual"),
            TestCase("排序算法有哪些常见类型？", "冒泡、快排、归并等", False, "conceptual"),
            TestCase("解释一下什么是 HTTP 协议", "超文本传输协议", False, "conceptual"),
        ]

    def _run_naive_rag(self, question: str) -> dict:
        """运行朴素 RAG"""
        start = time.time()
        docs = self.naive_retriever.invoke(question)
        context = "\n".join([d.page_content for d in docs])
        prompt = ChatPromptTemplate.from_template(
            "基于以下上下文回答问题:\n{context}\n\n问题: {question}"
        )
        chain = prompt | self.llm
        answer = chain.invoke({"context": context, "question": question}).content
        latency = (time.time() - start) * 1000
        return {
            "answer": answer,
            "latency_ms": round(latency, 2),
            "token_count": len(answer) // 2,  # 粗略估算
        }

    def _judge_answer(self, question: str, expected: str, answer: str) -> dict:
        """用 LLM 判断答案正确性和幻觉"""
        judge_prompt = ChatPromptTemplate.from_template(
            """判断以下答案的质量。

问题: {question}
期望答案要点: {expected}
实际答案: {answer}

请回答 JSON 格式:
{{"is_correct": true/false, "has_hallucination": true/false}}"""
        )
        chain = judge_prompt | self.llm
        result = chain.invoke({
            "question": question,
            "expected": expected,
            "answer": answer,
        }).content
        import json
        try:
            data = json.loads(result)
            return data
        except json.JSONDecodeError:
            return {"is_correct": False, "has_hallucination": True}

    def evaluate(self, test_cases: list[TestCase] = None) -> dict:
        """运行评估并返回对比结果"""
        if test_cases is None:
            test_cases = self.build_test_cases()

        self_rag_results: list[EvalResult] = []
        naive_rag_results: list[EvalResult] = []

        for tc in test_cases:
            # Self-RAG
            sr = self.self_rag.run(tc.question)
            sr_judge = self._judge_answer(tc.question, tc.expected_answer, sr.answer)
            self_rag_results.append(EvalResult(
                answer=sr.answer,
                is_correct=sr_judge.get("is_correct", False),
                has_hallucination=sr_judge.get("has_hallucination", True),
                latency_ms=sr.latency_ms,
                token_count=len(sr.answer) // 2,
            ))

            # Naive RAG
            nr = self._run_naive_rag(tc.question)
            nr_judge = self._judge_answer(tc.question, tc.expected_answer, nr["answer"])
            naive_rag_results.append(EvalResult(
                answer=nr["answer"],
                is_correct=nr_judge.get("is_correct", False),
                has_hallucination=nr_judge.get("has_hallucination", True),
                latency_ms=nr["latency_ms"],
                token_count=nr["token_count"],
            ))

        def calc_metrics(results: list[EvalResult]) -> dict:
            total = len(results)
            return {
                "accuracy": sum(1 for r in results if r.is_correct) / total,
                "hallucination_rate": sum(1 for r in results if r.has_hallucination) / total,
                "avg_latency_ms": sum(r.latency_ms for r in results) / total,
                "avg_tokens": sum(r.token_count for r in results) / total,
            }

        return {
            "self_rag": calc_metrics(self_rag_results),
            "naive_rag": calc_metrics(naive_rag_results),
        }

    def print_report(self, results: dict):
        """打印对比报告"""
        sr = results["self_rag"]
        nr = results["naive_rag"]
        print("\n" + "=" * 60)
        print("📊 Self-RAG vs Naive RAG 评估报告")
        print("=" * 60)
        print(f"{'指标':<20} {'Self-RAG':<15} {'Naive RAG':<15}")
        print("-" * 50)
        print(f"{'准确率':<20} {sr['accuracy']:.1%}{'':<9} {nr['accuracy']:.1%}")
        print(f"{'幻觉率':<20} {sr['hallucination_rate']:.1%}{'':<9} {nr['hallucination_rate']:.1%}")
        print(f"{'平均延迟(ms)':<20} {sr['avg_latency_ms']:.0f}{'':<11} {nr['avg_latency_ms']:.0f}")
        print(f"{'平均 Token':<20} {sr['avg_tokens']:.0f}{'':<11} {nr['avg_tokens']:.0f}")
        print("=" * 60)
```

**要点**：
- 测试用例需覆盖需要检索和不需要检索两种场景，比例各占 50%，才能全面评估路由决策的准确性
- 答案正确性和幻觉检测用 LLM 做自动评判（LLM-as-Judge），比字符串匹配更灵活但需要校准
- 报告中 Self-RAG 应在不需要检索的场景延迟更低（跳过检索），在需要检索的场景准确率更高（反思过滤）
