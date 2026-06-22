# 06 - 阶段实战：实现完整的 Self-RAG 系统

> Stage 3 Capstone | 前置要求：Lesson 01-05 完成 | 时长：90 分钟

```
╔══════════════════════════════════════════════════════════════╗
║          阶段实战: 从零构建生产级 Self-RAG                     ║
║                                                              ║
║    "理论学百遍，不如动手写一遍"                               ║
╚══════════════════════════════════════════════════════════════╝
```

## 场景引入

经过前面五节课的学习，你已经了解了 Self-RAG 的判断机制、知识图谱的关系推理、Agentic RAG 的多步规划、多模态 RAG 的图文检索和层级检索的逐层筛选。现在面临一个现实挑战：如何把这些高级技术整合成一个真正可运行的系统？你的团队需要一个能自主判断是否检索、能处理图文混合文档、能在大规模知识库上高效检索的完整方案，并且要有评估数据证明它比基线 RAG 更好。

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

## 4. 常见误区

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

## 工程建议

1. **分阶段集成，不要一步到位**：先实现基础 Self-RAG（判断是否检索+判断相关性），确认效果后再逐步加入知识图谱、多模态和层级检索。每一步都用评估指标验证增量效果。
2. **建立完整的评估流水线**：除了 Recall@K 和答案正确率，还要评估检索决策准确率、多模态查询的单独表现、层级检索的延迟节省等维度。
3. **为每种高级功能设置降级开关**：如果知识图谱服务挂了，系统应该自动降级到纯向量检索；如果多模态模型超时，应该只用文本检索。每个高级功能都应该是可独立关闭的。
4. **文档化每个技术选型的理由**：为什么选 Self-RAG 而不是 CRAG？为什么用两层层级而不是三层？三个月后当你回顾这些决策时，文档记录会帮你快速理解当时的权衡。

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

---

## 参考答案

### 练习 1：扩展反思维度

**思路**：在现有 4 类反思基础上，新增时效性评估器（判断答案中的信息是否过时）和一致性评估器（多次生成答案是否一致），集成到 Pipeline 中，在支持度评估之后执行。

**答案**：

```python
from enum import Enum
import time


class TimelinessGrade(Enum):
    UP_TO_DATE = "up_to_date"
    POSSIBLY_OUTDATED = "possibly_outdated"
    OUTDATED = "outdated"


class ConsistencyGrade(Enum):
    CONSISTENT = "consistent"
    PARTIALLY_CONSISTENT = "partially_consistent"
    INCONSISTENT = "inconsistent"


class ExtendedReflectionEngine(ReflectionEngine):
    """扩展反思维块：增加时效性和一致性评估"""

    def assess_timeliness(self, answer: str, context: str) -> TimelinessGrade:
        """评估答案中的信息是否过时"""
        prompt = ChatPromptTemplate.from_template(
            """判断以下答案中的信息是否可能过时。

检索上下文:
{context}

生成的答案:
{answer}

请评估:
- [UpToDate]: 答案中的信息是最新的
- [PossiblyOutdated]: 答案中部分信息可能已过时（如版本号、统计数据）
- [Outdated]: 答案中的信息明显过时（如提到已废弃的技术）

只回答以上标签之一。"""
        )
        chain = prompt | self.llm
        result = chain.invoke({"answer": answer, "context": context}).content.strip()
        if "Outdated" in result and "Possibly" not in result and "UpToDate" not in result:
            return TimelinessGrade.OUTDATED
        if "PossiblyOutdated" in result:
            return TimelinessGrade.POSSIBLY_OUTDATED
        return TimelinessGrade.UP_TO_DATE

    def assess_consistency(self, question: str, n_samples: int = 3) -> ConsistencyGrade:
        """多次生成答案，评估一致性"""
        answers = []
        for _ in range(n_samples):
            prompt = ChatPromptTemplate.from_template("{question}")
            chain = prompt | self.llm
            answer = chain.invoke({"question": question}).content
            answers.append(answer)

        # 用 LLM 判断答案一致性
        answers_text = "\n".join([f"答案 {i+1}: {a}" for i, a in enumerate(answers)])
        judge_prompt = ChatPromptTemplate.from_template(
            """判断以下 {n} 个答案是否一致。

{answers}

请评估:
- [Consistent]: 所有答案表达相同的核心信息
- [PartiallyConsistent]: 核心信息一致但细节有差异
- [Inconsistent]: 答案之间存在矛盾或重大差异

只回答以上标签之一。"""
        )
        chain = judge_prompt | self.llm
        result = chain.invoke({
            "n": n_samples,
            "answers": answers_text,
        }).content.strip()

        if "Inconsistent" in result:
            return ConsistencyGrade.INCONSISTENT
        if "PartiallyConsistent" in result:
            return ConsistencyGrade.PARTIALLY_CONSISTENT
        return ConsistencyGrade.CONSISTENT


class ExtendedSelfRAGPipeline(SelfRAGPipeline):
    """扩展 Self-RAG Pipeline：集成时效性和一致性评估"""

    def __init__(self, llm, embeddings, vectorstore=None):
        super().__init__(llm, embeddings, vectorstore)
        self.extended_reflection = ExtendedReflectionEngine(llm)

    def run(self, query: str, top_k: int = 5) -> SelfRAGResult:
        """执行扩展 Self-RAG 流程"""
        result = super().run(query, top_k)

        # Step 7: 时效性评估（仅对有检索上下文的答案）
        context = "\n\n".join([d.page_content for d in result.retrieved_docs])
        if context:
            timeliness = self.extended_reflection.assess_timeliness(result.answer, context)
        else:
            timeliness = TimelinessGrade.UP_TO_DATE  # 无上下文时无法判断

        # Step 8: 一致性评估（对有用性低的答案做验证）
        if result.reflection.usefulness <= 2:
            consistency = self.extended_reflection.assess_consistency(query)
        else:
            consistency = ConsistencyGrade.CONSISTENT  # 高有用性跳过一致性检查

        # 更新 metadata
        result.metadata["timeliness"] = timeliness.value
        result.metadata["consistency"] = consistency.value

        return result


# 使用示例
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

ext_rag = ExtendedSelfRAGPipeline(llm, embeddings)
ext_rag.ingest(documents)

result = ext_rag.run("Python 的最新版本是什么？")
print(f"时效性: {result.metadata['timeliness']}")
print(f"一致性: {result.metadata['consistency']}")
```

**要点**：
- 时效性评估需要对比答案与上下文中的时间信息，如果上下文本身就过时了，应该在检索阶段过滤旧文档
- 一致性评估涉及多次 LLM 调用，成本较高，所以只对有用性评分低（≤2）的答案触发，避免浪费
- 新增的反思维度应记录到 ObservabilityLog 中，便于后续分析哪类问题最容易出现时效性或一致性问题

---

### 练习 2：优化路由决策

**思路**：先用 prompt-based 路由器建立基线，收集其预测结果作为标注数据，再用这些数据训练一个轻量级分类器（如逻辑回归），对比两种方案的准确率和延迟。

**答案**：

```python
import time
from dataclasses import dataclass
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import numpy as np


@dataclass
class RoutingTestCase:
    question: str
    needs_retrieval: bool  # ground truth


class PromptBasedRouter:
    """基于 Prompt 的路由决策器（基线）"""

    def __init__(self, llm):
        self.llm = llm

    def predict(self, question: str) -> bool:
        prompt = ChatPromptTemplate.from_template(
            """判断以下问题是否需要从外部知识库检索才能准确回答。

问题: {question}

需要检索: 涉及具体事实、数据、专业术语、特定事件等
不需要检索: 通用知识、数学计算、代码生成、问候等

请只回答 [Yes] 或 [No]。"""
        )
        chain = prompt | self.llm
        result = chain.invoke({"question": question}).content.strip()
        return "[Yes]" in result or "Yes" in result

    def evaluate(self, test_cases: list[RoutingTestCase]) -> dict:
        """评估 prompt 路由器"""
        predictions = []
        latencies = []
        for tc in test_cases:
            start = time.time()
            pred = self.predict(tc.question)
            latencies.append((time.time() - start) * 1000)
            predictions.append(pred)

        ground_truth = [tc.needs_retrieval for tc in test_cases]
        accuracy = accuracy_score(ground_truth, predictions)

        return {
            "accuracy": accuracy,
            "avg_latency_ms": np.mean(latencies),
            "predictions": predictions,
        }


class ClassifierRouter:
    """基于分类器的路由决策器"""

    def __init__(self, embeddings):
        self.embeddings = embeddings
        self.model = LogisticRegression(max_iter=1000)
        self.is_trained = False

    def train(self, questions: list[str], labels: list[bool]):
        """用标注数据训练分类器"""
        # 生成问题的嵌入向量
        vectors = self.embeddings.embed_documents(questions)
        X = np.array(vectors)
        y = np.array(labels)

        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        self.model.fit(X_train, y_train)
        self.is_trained = True

        val_pred = self.model.predict(X_val)
        val_accuracy = accuracy_score(y_val, val_pred)
        print(f"分类器验证准确率: {val_accuracy:.1%}")
        return val_accuracy

    def predict(self, question: str) -> bool:
        """预测是否需要检索"""
        if not self.is_trained:
            raise RuntimeError("请先调用 train() 训练模型")

        vector = self.embeddings.embed_query(question)
        prediction = self.model.predict([vector])[0]
        return bool(prediction)

    def evaluate(self, test_cases: list[RoutingTestCase]) -> dict:
        """评估分类器路由器"""
        predictions = []
        latencies = []
        for tc in test_cases:
            start = time.time()
            pred = self.predict(tc.question)
            latencies.append((time.time() - start) * 1000)
            predictions.append(pred)

        ground_truth = [tc.needs_retrieval for tc in test_cases]
        accuracy = accuracy_score(ground_truth, predictions)

        return {
            "accuracy": accuracy,
            "avg_latency_ms": np.mean(latencies),
            "predictions": predictions,
        }


def build_routing_test_set() -> list[RoutingTestCase]:
    """构建 50 个测试问题"""
    return [
        # 需要检索 (25 个)
        RoutingTestCase("Python 是谁在哪一年创建的？", True),
        RoutingTestCase("GPT-4 的参数量是多少？", True),
        RoutingTestCase("RAG 技术的核心论文是哪篇？", True),
        RoutingTestCase("Chroma 和 Pinecone 的区别是什么？", True),
        RoutingTestCase("LangChain 的最新版本号是多少？", True),
        RoutingTestCase("Transformer 架构是哪年提出的？", True),
        RoutingTestCase("FAISS 支持哪些索引类型？", True),
        RoutingTestCase("CLIP 模型的训练数据集是什么？", True),
        RoutingTestCase("OpenAI 的 API 定价策略是什么？", True),
        RoutingTestCase("向量数据库 Milvus 的部署要求是什么？", True),
        RoutingTestCase("Hugging Face 上最受欢迎的模型是什么？", True),
        RoutingTestCase("PyTorch 2.0 引入了哪些新特性？", True),
        RoutingTestCase("BERT 和 GPT 的架构区别是什么？", True),
        RoutingTestCase("LoRA 微调的原理是什么？", True),
        RoutingTestCase("RLHF 的训练流程是怎样的？", True),
        RoutingTestCase("Docker 的核心概念有哪些？", True),
        RoutingTestCase("Kubernetes 的 Pod 是什么？", True),
        RoutingTestCase("Redis 支持哪些数据结构？", True),
        RoutingTestCase("PostgreSQL 和 MySQL 的区别？", True),
        RoutingTestCase("GraphQL 和 REST API 的优劣？", True),
        RoutingTestCase("BERT 模型的最大输入长度是多少？", True),
        RoutingTestCase("Sentence-BERT 的训练目标是什么？", True),
        RoutingTestCase("Weaviate 支持哪些向量索引算法？", True),
        RoutingTestCase("LlamaIndex 和 LangChain 的定位区别？", True),
        RoutingTestCase("Anthropic 的 Claude 模型有哪些版本？", True),
        # 不需要检索 (25 个)
        RoutingTestCase("你好，今天过得怎么样？", False),
        RoutingTestCase("2 + 3 * 4 等于多少？", False),
        RoutingTestCase("写一个 Python 冒泡排序", False),
        RoutingTestCase("什么是递归？", False),
        RoutingTestCase("把这句话翻译成英文：人工智能很有趣", False),
        RoutingTestCase("解释什么是哈希表", False),
        RoutingTestCase("写一首关于秋天的诗", False),
        RoutingTestCase("TCP 三次握手的过程", False),
        RoutingTestCase("什么是面向对象编程？", False),
        RoutingTestCase("解释 HTTP 状态码的含义", False),
        RoutingTestCase("写一个快速排序算法", False),
        RoutingTestCase("什么是 RESTful API？", False),
        RoutingTestCase("解释 CSS 盒模型", False),
        RoutingTestCase("写一个二叉树遍历", False),
        RoutingTestCase("什么是进程和线程的区别？", False),
        RoutingTestCase("解释 Git 的 merge 和 rebase", False),
        RoutingTestCase("什么是设计模式？", False),
        RoutingTestCase("写一个链表反转", False),
        RoutingTestCase("什么是数据库事务？", False),
        RoutingTestCase("解释什么是中间件", False),
        RoutingTestCase("什么是微服务架构？", False),
        RoutingTestCase("写一个斐波那契数列", False),
        RoutingTestCase("什么是单元测试？", False),
        RoutingTestCase("解释什么是依赖注入", False),
        RoutingTestCase("什么是 CI/CD？", False),
    ]


# === 运行对比 ===
test_cases = build_routing_test_set()

# Prompt-based 路由器
prompt_router = PromptBasedRouter(llm)
prompt_results = prompt_router.evaluate(test_cases)

# 分类器路由器（用 prompt 路由器的预测结果作为训练数据）
train_questions = [tc.question for tc in test_cases]
train_labels = [tc.needs_retrieval for tc in test_cases]

clf_router = ClassifierRouter(embeddings)
clf_router.train(train_questions, train_labels)
clf_results = clf_router.evaluate(test_cases)

# 打印对比报告
print("\n" + "=" * 60)
print("📊 路由决策器对比报告")
print("=" * 60)
print(f"{'指标':<20} {'Prompt-based':<20} {'Classifier':<20}")
print("-" * 60)
print(f"{'准确率':<20} {prompt_results['accuracy']:.1%}{'':<14} {clf_results['accuracy']:.1%}")
print(f"{'平均延迟(ms)':<20} {prompt_results['avg_latency_ms']:.0f}{'':<16} {clf_results['avg_latency_ms']:.1f}")
print("=" * 60)
```

**要点**：
- Prompt-based 路由器的优势是零样本、无需训练数据，但延迟高（每次需 LLM 调用），适合冷启动阶段
- 分类器路由器延迟极低（向量嵌入 + 逻辑回归），但需要标注数据训练，适合生产环境
- 训练数据可以用 prompt 路由器的预测结果作为初始标注，再人工校正错误样本逐步提升质量

---

### 练习 3：端到端评估框架

**思路**：构建一个完整的评估框架，接受测试集输入，自动运行 Self-RAG 和 Baseline RAG，计算路由准确率、答案准确率（ROUGE）、支持度分布、延迟分布，生成结构化的对比报告。

**答案**：

```python
import json
import time
from dataclasses import dataclass, field
from collections import Counter


@dataclass
class E2ETestCase:
    question: str
    expected_answer: str
    needs_retrieval: bool
    category: str = "general"


@dataclass
class E2EResult:
    question: str
    expected: str
    self_rag_answer: str
    baseline_answer: str
    self_rag_latency: float
    baseline_latency: float
    self_rag_retrieve_decision: str
    self_rag_support: str
    self_rag_usefulness: int


class E2EEvaluator:
    """端到端评估框架"""

    def __init__(self, self_rag: SelfRAGPipeline, baseline_rag: BaselineRAGPipeline, llm):
        self.self_rag = self_rag
        self.baseline_rag = baseline_rag
        self.llm = llm
        self.results: list[E2EResult] = []

    def run(self, test_cases: list[E2ETestCase]) -> dict:
        """运行完整评估"""
        print(f"🚀 开始评估 ({len(test_cases)} 个测试用例)")

        for i, tc in enumerate(test_cases):
            print(f"  [{i+1}/{len(test_cases)}] {tc.question[:40]}...")

            # Self-RAG
            sr = self.self_rag.run(tc.question)

            # Baseline RAG
            br = self.baseline_rag.run(tc.question)

            self.results.append(E2EResult(
                question=tc.question,
                expected=tc.expected_answer,
                self_rag_answer=sr.answer,
                baseline_answer=br["answer"],
                self_rag_latency=sr.latency_ms,
                baseline_latency=br["latency_ms"],
                self_rag_retrieve_decision=sr.reflection.retrieve_decision.value,
                self_rag_support=sr.reflection.support.value,
                self_rag_usefulness=sr.reflection.usefulness,
            ))

        return self._generate_report(test_cases)

    def _compute_rouge_l(self, reference: str, hypothesis: str) -> float:
        """计算 ROUGE-L 分数"""
        ref_tokens = list(reference)
        hyp_tokens = list(hypothesis)

        # LCS 计算
        m, n = len(ref_tokens), len(hyp_tokens)
        if m == 0 or n == 0:
            return 0.0

        dp = [[0] * (n + 1) for _ in range(m + 1)]
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if ref_tokens[i - 1] == hyp_tokens[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1] + 1
                else:
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

        lcs_len = dp[m][n]
        precision = lcs_len / n
        recall = lcs_len / m
        if precision + recall == 0:
            return 0.0
        return 2 * precision * recall / (precision + recall)

    def _generate_report(self, test_cases: list[E2ETestCase]) -> dict:
        """生成评估报告"""
        # 路由准确率
        correct_routes = 0
        for r, tc in zip(self.results, test_cases):
            predicted_needs = r.self_rag_retrieve_decision == "yes"
            if predicted_needs == tc.needs_retrieval:
                correct_routes += 1
        route_accuracy = correct_routes / len(test_cases)

        # 答案准确率（ROUGE-L）
        sr_rouge_scores = []
        br_rouge_scores = []
        for r in self.results:
            sr_rouge_scores.append(self._compute_rouge_l(r.expected, r.self_rag_answer))
            br_rouge_scores.append(self._compute_rouge_l(r.expected, r.baseline_answer))
        sr_avg_rouge = sum(sr_rouge_scores) / len(sr_rouge_scores)
        br_avg_rouge = sum(br_rouge_scores) / len(br_rouge_scores)

        # 支持度分布
        support_dist = Counter(r.self_rag_support for r in self.results)

        # 延迟分布
        sr_latencies = [r.self_rag_latency for r in self.results]
        br_latencies = [r.baseline_latency for r in self.results]

        report = {
            "路由准确率": f"{route_accuracy:.1%}",
            "Self-RAG 平均 ROUGE-L": f"{sr_avg_rouge:.3f}",
            "Baseline 平均 ROUGE-L": f"{br_avg_rouge:.3f}",
            "支持度分布": dict(support_dist),
            "Self-RAG 平均延迟": f"{sum(sr_latencies)/len(sr_latencies):.0f}ms",
            "Baseline 平均延迟": f"{sum(br_latencies)/len(br_latencies):.0f}ms",
            "Self-RAG P50 延迟": f"{sorted(sr_latencies)[len(sr_latencies)//2]:.0f}ms",
            "Self-RAG P95 延迟": f"{sorted(sr_latencies)[int(len(sr_latencies)*0.95)]:.0f}ms",
            "有用性分布": dict(Counter(r.self_rag_usefulness for r in self.results)),
        }

        self._print_report(report)
        return report

    def _print_report(self, report: dict):
        """打印评估报告"""
        print("\n" + "=" * 60)
        print("📊 Self-RAG 端到端评估报告")
        print("=" * 60)

        print(f"\n🎯 路由准确率: {report['路由准确率']}")

        print(f"\n📝 答案质量 (ROUGE-L):")
        print(f"  Self-RAG:  {report['Self-RAG 平均 ROUGE-L']}")
        print(f"  Baseline:  {report['Baseline 平均 ROUGE-L']}")

        print(f"\n🔍 支持度分布:")
        for grade, count in report["支持度分布"].items():
            print(f"  {grade}: {count}")

        print(f"\n⏱️ 延迟:")
        print(f"  Self-RAG 平均:  {report['Self-RAG 平均延迟']}")
        print(f"  Baseline 平均:  {report['Baseline 平均延迟']}")
        print(f"  Self-RAG P50:   {report['Self-RAG P50 延迟']}")
        print(f"  Self-RAG P95:   {report['Self-RAG P95 延迟']}")

        print(f"\n⭐ 有用性分布:")
        for score, count in sorted(report["有用性分布"].items()):
            print(f"  {score}/5: {count} 个")

        print("=" * 60)

    def export_json(self, path: str):
        """导出详细结果为 JSON"""
        data = [
            {
                "question": r.question,
                "expected": r.expected,
                "self_rag_answer": r.self_rag_answer,
                "baseline_answer": r.baseline_answer,
                "self_rag_latency_ms": r.self_rag_latency,
                "baseline_latency_ms": r.baseline_latency,
                "retrieve_decision": r.self_rag_retrieve_decision,
                "support": r.self_rag_support,
                "usefulness": r.self_rag_usefulness,
            }
            for r in self.results
        ]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ 详细结果已导出至 {path}")


# 使用示例
test_cases = [
    E2ETestCase("你好", "问候回复", False, "greeting"),
    E2ETestCase("Python 是谁创建的？", "Guido van Rossum", True, "factual"),
    E2ETestCase("RAG 技术有什么优势？", "减少幻觉、增强准确性", True, "conceptual"),
    E2ETestCase("2+2 等于几？", "4", False, "math"),
    E2ETestCase("什么是向量数据库？", "存储高维向量的数据库", True, "conceptual"),
]

evaluator = E2EEvaluator(self_rag, baseline_rag, llm)
report = evaluator.run(test_cases)
evaluator.export_json("e2e_evaluation.json")
```

**要点**：
- ROUGE-L 基于最长公共子序列，适合评估中文答案的覆盖度，比精确匹配更灵活
- 路由准确率是 Self-RAG 的核心指标：如果路由决策错误，后续所有反思评估都建立在错误前提上
- P95 延迟比平均延迟更重要：它反映了最坏情况下的用户体验，如果 P95 过高需要考虑设置超时和回退策略
