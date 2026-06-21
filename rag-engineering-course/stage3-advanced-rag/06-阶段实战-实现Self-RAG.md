# 06 - 阶段实战：实现完整的 Self-RAG 系统

> Stage 3 Capstone | 前置要求：Lesson 01-05 完成 | 时长：90 分钟

```
╔══════════════════════════════════════════════════════════════╗
║          阶段实战: 从零构建生产级 Self-RAG                     ║
║                                                              ║
║    "理论学百遍，不如动手写一遍"                               ║
╚══════════════════════════════════════════════════════════════╝
```

## 🎯 学习目标

完成本实战后，你将能够：

1. 构建一个完整的 Self-RAG 系统（含全部反思机制）
2. 集成反思评估器（相关性、支持度、有用性）
3. 与 Baseline RAG 做系统化对比
4. 添加可观测性（日志、指标、可视化）

---

## 1. 项目架构

```
  Self-RAG 系统架构
  ═════════════════

  ┌─────────────────────────────────────────────────────────┐
  │                    Self-RAG Pipeline                     │
  │                                                         │
  │  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
  │  │ 路由决策  │──►│ 检索引擎  │──►│ 相关性   │            │
  │  │ Retrieve? │   │ Retriever│   │ 评估器   │            │
  │  └──────────┘   └──────────┘   └─────┬────┘            │
  │       │                               │                 │
  │       │ No                            ▼ Relevant        │
  │       │                        ┌──────────┐            │
  │       ▼                        │ 答案生成  │            │
  │  ┌──────────┐                  └─────┬────┘            │
  │  │ 直接生成  │                        │                 │
  │  └─────┬────┘                        ▼                 │
  │        │                   ┌──────────┐                │
  │        │                   │ 支持度    │                │
  │        │                   │ 评估器    │                │
  │        │                   └─────┬────┘                │
  │        │                         │                     │
  │        ▼                         ▼                     │
  │  ┌──────────┐            ┌──────────┐                  │
  │  │ 有用性    │◄───────────│ 答案重写  │                  │
  │  │ 评估器    │            │ (如需)    │                  │
  │  └─────┬────┘            └──────────┘                  │
  │        │                                               │
  │        ▼                                               │
  │  ┌──────────────────────────────────────────┐          │
  │  │              Observability                │          │
  │  │  日志 / 指标追踪 / 可视化仪表盘           │          │
  │  └──────────────────────────────────────────┘          │
  └─────────────────────────────────────────────────────────┘
```

---

## 2. 完整实现

### 2.1 环境与依赖

```python
"""
Self-RAG 完整实现
Stage 3 - Capstone Project

依赖安装:
pip install langchain langchain-openai langchain-community chromadb
"""

import os
import json
import time
from enum import Enum
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter

os.environ["OPENAI_API_KEY"] = "your-api-key-here"
```

### 2.2 数据结构定义

```python
class RetrieveDecision(Enum):
    YES = "yes"
    NO = "no"

class RelevanceGrade(Enum):
    RELEVANT = "relevant"
    IRRELEVANT = "irrelevant"
    AMBIGUOUS = "ambiguous"

class SupportGrade(Enum):
    FULL = "fully_supported"
    PARTIAL = "partially_supported"
    NO_SUPPORT = "no_support"

@dataclass
class ReflectionResult:
    retrieve_decision: RetrieveDecision = RetrieveDecision.YES
    relevance: RelevanceGrade = RelevanceGrade.AMBIGUOUS
    support: SupportGrade = SupportGrade.NO_SUPPORT
    usefulness: int = 0  # 1-5
    reasoning: str = ""

@dataclass
class SelfRAGResult:
    answer: str
    reflection: ReflectionResult
    retrieved_docs: list[Document] = field(default_factory=list)
    latency_ms: float = 0.0
    metadata: dict = field(default_factory=dict)

@dataclass
class ObservabilityLog:
    """可观测性日志"""
    timestamp: str
    query: str
    retrieve_decision: str
    relevance: str
    support: str
    usefulness: int
    latency_ms: float
    doc_count: int
```

### 2.3 反思评估器

```python
class ReflectionEngine:
    """反思评估引擎"""

    def __init__(self, llm: ChatOpenAI):
        self.llm = llm

    def should_retrieve(self, query: str) -> RetrieveDecision:
        """判断是否需要检索"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个 RAG 路由决策器。
判断以下用户问题是否需要检索外部文档来回答。

- 如果问题是常识性、简单数学、问候语，输出 "no"
- 如果问题需要专业知识、最新信息、特定文档内容，输出 "yes"

只输出 "yes" 或 "no"，不要解释。"""),
            ("human", "{query}"),
        ])
        chain = prompt | self.llm
        result = chain.invoke({"query": query}).content.strip().lower()
        return RetrieveDecision.YES if "yes" in result else RetrieveDecision.NO

    def assess_relevance(self, query: str, doc_content: str) -> RelevanceGrade:
        """评估检索结果的相关性"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个相关性评估器。
判断以下文档内容是否与用户问题相关。

输出格式（只输出标签，不要解释）:
- "relevant" - 文档直接包含答案或相关信息
- "irrelevant" - 文档与问题无关
- "ambiguous" - 文档可能相关，但不确定"""),
            ("human", "问题: {query}\n\n文档: {doc_content}"),
        ])
        chain = prompt | self.llm
        result = chain.invoke({
            "query": query, "doc_content": doc_content[:1500]
        }).content.strip().lower()

        if "relevant" in result and "irrelevant" not in result:
            return RelevanceGrade.RELEVANT
        elif "irrelevant" in result:
            return RelevanceGrade.IRRELEVANT
        return RelevanceGrade.AMBIGUOUS

    def assess_support(self, answer: str, context: str) -> SupportGrade:
        """评估答案是否被检索内容支持"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """你是一个事实核查器。
判断以下答案是否被提供的上下文完全支持。

输出格式（只输出标签）:
- "fully_supported" - 答案中的每个事实都有上下文依据
- "partially_supported" - 部分有依据，部分来自模型推理
- "no_support" - 答案缺乏上下文依据"""),
            ("human", "答案: {answer}\n\n上下文: {context}"),
        ])
        chain = prompt | self.llm
        result = chain.invoke({
            "answer": answer, "context": context[:2000]
        }).content.strip().lower()

        if "fully" in result:
            return SupportGrade.FULL
        elif "partially" in result:
            return SupportGrade.PARTIAL
        return SupportGrade.NO_SUPPORT

    def assess_usefulness(self, query: str, answer: str) -> int:
        """评估答案对用户的有用性 (1-5)"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", """评估以下答案对用户问题的有用性。
输出 1-5 的数字（只输出数字）:
5 = 完美回答
4 = 很有帮助
3 = 基本回答了
2 = 有些帮助但不够
1 = 没有帮助"""),
            ("human", "问题: {query}\n\n答案: {answer}"),
        ])
        chain = prompt | self.llm
        result = chain.invoke({
            "query": query, "answer": answer
        }).content.strip()
        try:
            score = int(result[0])
            return max(1, min(5, score))
        except (ValueError, IndexError):
            return 3
```

### 2.4 核心 Pipeline

```python
class SelfRAGPipeline:
    """完整的 Self-RAG Pipeline"""

    def __init__(
        self,
        llm: ChatOpenAI,
        embeddings: OpenAIEmbeddings,
        vectorstore: Optional[Chroma] = None,
    ):
        self.llm = llm
        self.embeddings = embeddings
        self.vectorstore = vectorstore
        self.reflection = ReflectionEngine(llm)
        self.logs: list[ObservabilityLog] = []

    def ingest(self, documents: list[Document]):
        """构建向量数据库"""
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=50
        )
        chunks = splitter.split_documents(documents)
        self.vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            collection_name="self_rag_capstone",
        )
        print(f"✅ 已索引 {len(chunks)} 个文档块")

    def retrieve(self, query: str, k: int = 5) -> list[Document]:
        """检索相关文档"""
        if not self.vectorstore:
            return []
        return self.vectorstore.similarity_search(query, k=k)

    def generate(self, query: str, context: str = "") -> str:
        """生成答案"""
        if context:
            prompt = ChatPromptTemplate.from_messages([
                ("system", "你是一个有帮助的 AI 助手。基于以下上下文回答问题。如果上下文不够，请说明。"),
                ("human", "上下文:\n{context}\n\n问题: {query}"),
            ])
            chain = prompt | self.llm
            return chain.invoke({"context": context, "query": query}).content
        else:
            prompt = ChatPromptTemplate.from_messages([
                ("system", "你是一个有帮助的 AI 助手。基于你的知识直接回答问题。"),
                ("human", "{query}"),
            ])
            chain = prompt | self.llm
            return chain.invoke({"query": query}).content

    def run(self, query: str, top_k: int = 5) -> SelfRAGResult:
        """
        执行完整的 Self-RAG 流程

        流程:
        1. 决定是否检索
        2. 如需检索，评估相关性
        3. 基于上下文生成答案
        4. 评估支持度和有用性
        5. 如果不支持，尝试重写或直接生成
        """
        start_time = time.time()
        reflection = ReflectionResult()
        retrieved_docs = []

        # Step 1: 是否需要检索？
        reflection.retrieve_decision = self.reflection.should_retrieve(query)

        if reflection.retrieve_decision == RetrieveDecision.YES and self.vectorstore:
            # Step 2: 检索
            retrieved_docs = self.retrieve(query, k=top_k)

            if retrieved_docs:
                # Step 3: 评估相关性
                context = "\n\n".join([d.page_content for d in retrieved_docs])
                reflection.relevance = self.reflection.assess_relevance(
                    query, context
                )

                if reflection.relevance == RelevanceGrade.RELEVANT:
                    # Step 4: 基于上下文生成
                    answer = self.generate(query, context)
                else:
                    # 检索结果不相关，回退到直接生成
                    answer = self.generate(query)
            else:
                answer = self.generate(query)
        else:
            # 不需要检索，直接生成
            answer = self.generate(query)

        # Step 5: 评估支持度
        context = "\n\n".join([d.page_content for d in retrieved_docs]) if retrieved_docs else ""
        if context:
            reflection.support = self.reflection.assess_support(answer, context)
        else:
            reflection.support = SupportGrade.NO_SUPPORT

        # Step 6: 评估有用性
        reflection.usefulness = self.reflection.assess_usefulness(query, answer)

        # 如果支持度低但有用性高，说明模型推理能力强
        # 如果支持度低且有用性低，尝试重新生成
        if (reflection.support == SupportGrade.NO_SUPPORT
                and reflection.usefulness <= 2
                and reflection.retrieve_decision == RetrieveDecision.YES):
            answer = self.generate(query)  # 回退到纯模型回答
            reflection.usefulness = self.reflection.assess_usefulness(query, answer)

        latency = (time.time() - start_time) * 1000

        # 记录可观测性日志
        log = ObservabilityLog(
            timestamp=datetime.now().isoformat(),
            query=query,
            retrieve_decision=reflection.retrieve_decision.value,
            relevance=reflection.relevance.value,
            support=reflection.support.value,
            usefulness=reflection.usefulness,
            latency_ms=round(latency, 2),
            doc_count=len(retrieved_docs),
        )
        self.logs.append(log)

        return SelfRAGResult(
            answer=answer,
            reflection=reflection,
            retrieved_docs=retrieved_docs,
            latency_ms=round(latency, 2),
            metadata={"log_index": len(self.logs) - 1},
        )
```

### 2.5 Baseline RAG 对比器

```python
class BaselineRAGPipeline:
    """朴素 RAG（用于对比）"""

    def __init__(self, llm: ChatOpenAI, embeddings: OpenAIEmbeddings):
        self.llm = llm
        self.embeddings = embeddings
        self.vectorstore: Optional[Chroma] = None

    def ingest(self, documents: list[Document]):
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=50
        )
        chunks = splitter.split_documents(documents)
        self.vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            collection_name="baseline_rag",
        )

    def run(self, query: str, top_k: int = 5) -> dict:
        """朴素 RAG：无条件检索 + 生成"""
        start_time = time.time()
        docs = self.vectorstore.similarity_search(query, k=top_k)
        context = "\n\n".join([d.page_content for d in docs])
        prompt = ChatPromptTemplate.from_messages([
            ("system", "基于以下上下文回答问题。"),
            ("human", "上下文:\n{context}\n\n问题: {query}"),
        ])
        chain = prompt | self.llm
        answer = chain.invoke({"context": context, "query": query}).content
        latency = (time.time() - start_time) * 1000
        return {"answer": answer, "latency_ms": round(latency, 2), "doc_count": len(docs)}
```

### 2.6 运行与对比

```python
# === 初始化 ===
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# 准备文档
documents = [
    Document(
        page_content="Python 是一种广泛使用的高级编程语言。它由 Guido van Rossum 于 1991 年首次发布。Python 的设计哲学强调代码的可读性和简洁性。",
        metadata={"source": "python_intro.md"},
    ),
    Document(
        page_content="向量数据库是专门用于存储和检索高维向量的数据库系统。常见的向量数据库包括 Pinecone、Weaviate、Milvus 和 Chroma。",
        metadata={"source": "vector_db.md"},
    ),
    Document(
        page_content="RAG（检索增强生成）是一种将信息检索与大语言模型结合的技术。它通过检索外部知识来增强模型的回答能力，减少幻觉。",
        metadata={"source": "rag_intro.md"},
    ),
]

# 构建两个 Pipeline
self_rag = SelfRAGPipeline(llm, embeddings)
self_rag.ingest(documents)

baseline_rag = BaselineRAGPipeline(llm, embeddings)
baseline_rag.ingest(documents)

# === 测试用例 ===
test_queries = [
    "你好",                    # 不需要检索
    "Python 是谁创建的？",      # 需要检索
    "RAG 技术有什么优势？",      # 需要检索
    "今天天气怎么样？",          # 不需要检索，也无法回答
]

print("=" * 60)
print("Self-RAG vs Baseline RAG 对比")
print("=" * 60)

for query in test_queries:
    print(f"\n📝 问题: {query}")
    print("-" * 40)

    # Self-RAG
    sr = self_rag.run(query)
    print(f"[Self-RAG]")
    print(f"  检索决策: {sr.reflection.retrieve_decision.value}")
    print(f"  相关性: {sr.reflection.relevance.value}")
    print(f"  支持度: {sr.reflection.support.value}")
    print(f"  有用性: {sr.reflection.usefulness}/5")
    print(f"  延迟: {sr.latency_ms}ms")
    print(f"  答案: {sr.answer[:100]}...")

    # Baseline RAG
    br = baseline_rag.run(query)
    print(f"[Baseline RAG]")
    print(f"  延迟: {br['latency_ms']}ms")
    print(f"  答案: {br['answer'][:100]}...")
```

---

## 3. 可观测性模块

### 3.1 指标统计

```python
class ObservabilityDashboard:
    """可观测性仪表盘"""

    def __init__(self, logs: list[ObservabilityLog]):
        self.logs = logs

    def summary(self) -> dict:
        """汇总统计"""
        if not self.logs:
            return {"error": "无日志数据"}

        total = len(self.logs)
        retrieve_yes = sum(1 for l in self.logs if l.retrieve_decision == "yes")
        relevant = sum(1 for l in self.logs if l.relevance == "relevant")
        fully_supported = sum(1 for l in self.logs if l.support == "fully_supported")
        avg_usefulness = sum(l.usefulness for l in self.logs) / total
        avg_latency = sum(l.latency_ms for l in self.logs) / total

        return {
            "总查询数": total,
            "检索率": f"{retrieve_yes/total*100:.1f}%",
            "相关率": f"{relevant/total*100:.1f}%" if retrieve_yes > 0 else "N/A",
            "完全支持率": f"{fully_supported/total*100:.1f}%",
            "平均有用性": f"{avg_usefulness:.1f}/5",
            "平均延迟": f"{avg_latency:.0f}ms",
        }

    def print_report(self):
        """打印报告"""
        stats = self.summary()
        print("\n" + "=" * 50)
        print("📊 Self-RAG 可观测性报告")
        print("=" * 50)
        for key, value in stats.items():
            print(f"  {key}: {value}")

    def export_json(self, path: str):
        """导出为 JSON"""
        data = {
            "summary": self.summary(),
            "logs": [
                {
                    "timestamp": l.timestamp,
                    "query": l.query,
                    "retrieve": l.retrieve_decision,
                    "relevance": l.relevance,
                    "support": l.support,
                    "usefulness": l.usefulness,
                    "latency_ms": l.latency_ms,
                }
                for l in self.logs
            ],
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ 日志已导出至 {path}")


# 使用
dashboard = ObservabilityDashboard(self_rag.logs)
dashboard.print_report()
dashboard.export_json("self_rag_report.json")
```

### 3.2 可视化反思决策流

```
  Self-RAG 决策流可视化
  ═════════════════════

  Query: "Python 是谁创建的？"
  ┌──────────────────────────────────────────────────┐
  │ [Retrieve?] ──► YES                              │
  │     │                                            │
  │     ▼                                            │
  │ [检索 5 个文档]                                    │
  │     │                                            │
  │     ▼                                            │
  │ [Relevant?] ──► RELEVANT                         │
  │     │                                            │
  │     ▼                                            │
  │ [生成答案] ──► "Python 由 Guido van Rossum 创建"  │
  │     │                                            │
  │     ▼                                            │
  │ [Supported?] ──► FULLY_SUPPORTED                 │
  │     │                                            │
  │     ▼                                            │
  │ [Useful?] ──► 5/5                                │
  │                                                │
  │ 延迟: 1250ms │ 文档数: 5                          │
  └──────────────────────────────────────────────────┘

  Query: "你好"
  ┌──────────────────────────────────────────────────┐
  │ [Retrieve?] ──► NO                               │
  │     │                                            │
  │     ▼                                            │
  │ [直接生成] ──► "你好！有什么可以帮助你的吗？"      │
  │     │                                            │
  │     ▼                                            │
  │ [Useful?] ──► 4/5                                │
  │                                                │
  │ 延迟: 380ms │ 文档数: 0                           │
  └──────────────────────────────────────────────────┘
```

---

## 4. 常见错误

### ❌ 错误 1：反思评估的 LLM 调用过多

```
问题：每个查询需要 4-5 次 LLM 调用（路由+相关性+支持度+有用性），
     延迟和成本翻倍。

解决方案：
- 对简单查询跳过部分评估（如不需要检索则跳过相关性）
- 使用更小的模型做评估（gpt-4o-mini 做评估，gpt-4o 做生成）
- 缓存相似查询的评估结果
```

### ❌ 错误 2：评估器与生成器用同一模型导致"自己评自己"

```
问题：评估器倾向于给生成器高分（模型倾向一致性）。

解决方案：
- 评估用不同 temperature 或不同模型
- 引入规则校验（如答案中是否有上下文中不存在的实体）
- 用人类标注数据校准评估器阈值
```

### ❌ 错误 3：忽略了"不需要检索"的场景

```
问题：所有查询都走检索流程，浪费资源且可能引入噪声。

解决方案：路由决策器是 Self-RAG 的核心价值之一，务必调优。
用测试集验证路由准确率。
```

### ❌ 错误 4：没有设置回退机制

```
问题：检索结果不相关时，系统卡住或输出垃圾。

解决方案：始终保留回退路径 —— 检索失败则用纯模型回答。
记录回退频率，如果过高说明索引质量有问题。
```

---

## 📝 本课总结

```
  Self-RAG 实战要点
  ═════════════════

  1. Self-RAG 核心：4 类反思 token（Retrieve/Relevant/Support/Useful）
  2. 完整 Pipeline：路由 → 检索 → 评估 → 生成 → 校验 → 回退
  3. 对比 Baseline RAG：Self-RAG 在不需要检索时更快，需要检索时更准
  4. 可观测性：记录每一步的决策，用于调优和问题排查
  5. 生产建议：用小模型做评估、保留回退路径、监控回退频率
```

---

## 🏋️ 练习

### 练习 1：扩展反思维度

在现有 4 类反思基础上，增加以下评估维度：
- **时效性评估**：答案中的信息是否过时？
- **一致性评估**：多次生成的答案是否一致？
- 实现对应的评估器并集成到 Pipeline 中。

### 练习 2：优化路由决策

用一个包含 50 个问题的测试集（25 个需要检索，25 个不需要），
优化路由决策器的准确率：
- 当前基线：用 prompt 判断
- 进阶方案：用少量标注数据训练一个分类器
- 对比两种方案的准确率和延迟

### 练习 3：端到端评估框架

构建一个自动化评估框架：
```python
# 输入：测试集（问题 + 期望答案 + 是否需要检索）
# 输出：评估报告
#   - 路由准确率
#   - 答案准确率（ROUGE / 人工评分）
#   - 支持度分布
#   - 延迟分布
#   - Self-RAG vs Baseline RAG 对比表
```
