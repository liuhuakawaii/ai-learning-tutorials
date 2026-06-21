# Lesson 6: 阶段实战 - 构建高质量 RAG 基线

```
╔══════════════════════════════════════════════════════════════╗
║  Stage 1 · Lesson 6                                         ║
║  阶段实战 - 构建高质量 RAG 基线                                ║
║  预计时间: 90 分钟                                            ║
╚══════════════════════════════════════════════════════════════╝
```

## 前置要求

- 完成 [Lesson 1-5](./01-RAG架构回顾.md)
- 了解 Python 异步编程基础
- 已配置 OpenAI API Key

## 学习目标

完成本课后，你将能够：

1. **整合 Stage 1 全部知识**：将文档解析、分块、Embedding、向量数据库串联为完整系统
2. **构建生产级 RAG 管道**：实现从文档摄入到回答生成的完整流程
3. **评估基线质量**：使用自动化指标衡量 RAG 系统的检索和生成质量
4. **记录优化决策**：理解每个设计选择的权衡，形成可复现的优化记录

---

## 1. 系统架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                  高质量 RAG 基线系统架构                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    文档摄入管道                             │  │
│  │                                                           │  │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐  │  │
│  │  │ 文档    │   │ 解析    │   │ 分块    │   │ Embed   │  │  │
│  │  │ 加载    │──▶│ 清洗    │──▶│ 策略    │──▶│ 向量化  │  │  │
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────┘  │  │
│  │                                                           │  │
│  │  支持格式: PDF, Markdown, TXT, DOCX                       │  │
│  │  分块策略: 递归字符分块 + 重叠窗口                          │  │
│  │  Embedding: text-embedding-3-small (1536维)               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    向量存储层                               │  │
│  │                                                           │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │  │
│  │  │ ChromaDB    │   │   Qdrant    │   │   Milvus    │    │  │
│  │  │ (本地开发)   │   │  (中等规模)  │   │  (大规模)   │    │  │
│  │  └─────────────┘   └─────────────┘   └─────────────┘    │  │
│  │                                                           │  │
│  │  元数据: source, chunk_id, page, doc_type, timestamp      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    检索与生成层                             │  │
│  │                                                           │  │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐  │  │
│  │  │ 查询    │   │ 向量    │   │ 重排序  │   │ LLM     │  │  │
│  │  │ 预处理  │──▶│ 检索    │──▶│ Rerank  │──▶│ 生成    │  │  │
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────┘  │  │
│  │                                                           │  │
│  │  Top-K: 5-10    Rerank: Cohere/Cross-encoder              │  │
│  │  Prompt: 结构化模板 + 引用标注                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    评估层                                   │  │
│  │                                                           │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │  │
│  │  │ 检索质量    │   │ 生成质量    │   │ 端到端      │    │  │
│  │  │ Recall@K    │   │ Faithfulness│   │ Answer      │    │  │
│  │  │ MRR         │   │ Relevance   │   │ Correctness │    │  │
│  │  └─────────────┘   └─────────────┘   └─────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 完整 RAG 系统实现

以下是完整的 RAG 基线系统代码，约 200 行，涵盖从文档摄入到生成的全流程。

### 2.1 依赖安装

```bash
pip install openai chromadb tiktoken python-dotenv
```

### 2.2 配置管理

```python
# config.py
import os
from dataclasses import dataclass, field
from typing import List

@dataclass
class RAGConfig:
    # Embedding 配置
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536

    # 分块配置
    chunk_size: int = 512
    chunk_overlap: int = 64
    separators: List[str] = field(
        default_factory=lambda: ["\n\n", "\n", "。", "！", "？", ".", " "]
    )

    # 向量数据库配置
    vector_db: str = "chromadb"  # chromadb | qdrant | milvus
    collection_name: str = "rag_baseline"
    persist_dir: str = "./chroma_data"

    # 检索配置
    top_k: int = 5
    similarity_threshold: float = 0.3

    # 生成配置
    llm_model: str = "gpt-4o-mini"
    max_tokens: int = 1024
    temperature: float = 0.1

    # Prompt 模板
    system_prompt: str = """你是一个专业的问答助手。根据提供的参考资料回答用户问题。

规则:
1. 只基于参考资料回答，不要编造信息
2. 如果参考资料不足以回答，明确说明
3. 在回答中标注信息来源，格式: [来源: 文档名]
4. 保持回答简洁准确"""

    user_prompt_template: str = """参考资料:
{context}

用户问题: {question}

请基于参考资料回答:"""
```

### 2.3 文档解析与分块

```python
# ingestion.py
import re
from pathlib import Path
from typing import List, Dict
from dataclasses import dataclass

@dataclass
class Document:
    content: str
    metadata: dict

@dataclass
class Chunk:
    text: str
    metadata: dict

def load_documents(path: str) -> List[Document]:
    """加载目录下所有支持格式的文档"""
    docs = []
    path = Path(path)

    for file_path in path.rglob("*"):
        if file_path.suffix in [".md", ".txt"]:
            text = file_path.read_text(encoding="utf-8")
            docs.append(Document(
                content=text,
                metadata={
                    "source": file_path.name,
                    "path": str(file_path),
                    "type": file_path.suffix,
                }
            ))
        elif file_path.suffix == ".pdf":
            try:
                import fitz  # PyMuPDF
                pdf = fitz.open(str(file_path))
                for page_num, page in enumerate(pdf):
                    text = page.get_text()
                    if text.strip():
                        docs.append(Document(
                            content=text,
                            metadata={
                                "source": file_path.name,
                                "path": str(file_path),
                                "type": ".pdf",
                                "page": page_num + 1,
                            }
                        ))
            except ImportError:
                print(f"跳过 PDF: {file_path.name} (需要安装 PyMuPDF)")

    return docs


def recursive_split(
    text: str,
    chunk_size: int,
    chunk_overlap: int,
    separators: List[str]
) -> List[str]:
    """递归字符分块，按分隔符层级切分"""
    if len(text) <= chunk_size:
        return [text.strip()] if text.strip() else []

    for sep in separators:
        if sep in text:
            parts = text.split(sep)
            chunks = []
            current = ""

            for part in parts:
                if len(current) + len(part) + len(sep) <= chunk_size:
                    current += (sep if current else "") + part
                else:
                    if current:
                        chunks.append(current.strip())
                    current = part

            if current:
                chunks.append(current.strip())

            # 处理重叠
            if chunk_overlap > 0 and len(chunks) > 1:
                overlapped = [chunks[0]]
                for i in range(1, len(chunks)):
                    prev_tail = chunks[i - 1][-chunk_overlap:]
                    overlapped.append(prev_tail + sep + chunks[i])
                return [c for c in overlapped if c]

            return [c for c in chunks if c]

    # 兜底：按字符硬切
    return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size - chunk_overlap)]


def chunk_documents(
    documents: List[Document],
    chunk_size: int = 512,
    chunk_overlap: int = 64,
    separators: List[str] = None
) -> List[Chunk]:
    """对文档列表进行分块"""
    if separators is None:
        separators = ["\n\n", "\n", "。", "！", "？", ".", " "]

    all_chunks = []

    for doc in documents:
        text_chunks = recursive_split(
            doc.content, chunk_size, chunk_overlap, separators
        )

        for i, chunk_text in enumerate(text_chunks):
            if len(chunk_text.strip()) < 10:  # 过短的块跳过
                continue

            all_chunks.append(Chunk(
                text=chunk_text,
                metadata={
                    **doc.metadata,
                    "chunk_id": i,
                    "chunk_size": len(chunk_text),
                }
            ))

    return all_chunks
```

### 2.4 Embedding 与向量存储

```python
# embedding.py
import numpy as np
from openai import OpenAI
from typing import List

class EmbeddingService:
    def __init__(self, model: str = "text-embedding-3-small"):
        self.client = OpenAI()
        self.model = model

    def embed(self, texts: List[str], batch_size: int = 100) -> List[List[float]]:
        """批量生成 embedding"""
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = self.client.embeddings.create(
                model=self.model,
                input=batch
            )
            embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(embeddings)

        return all_embeddings

    def embed_query(self, query: str) -> List[float]:
        """单条查询 embedding"""
        response = self.client.embeddings.create(
            model=self.model,
            input=[query]
        )
        return response.data[0].embedding
```

```python
# vector_store.py
import chromadb
from typing import List, Dict, Optional

class ChromaVectorStore:
    def __init__(self, collection_name: str, persist_dir: str = "./chroma_data"):
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def add(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: List[Dict]
    ):
        """添加向量到集合"""
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

    def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        where: Optional[Dict] = None
    ) -> Dict:
        """向量搜索"""
        kwargs = {
            "query_embeddings": [query_embedding],
            "n_results": top_k,
            "include": ["documents", "metadatas", "distances"]
        }
        if where:
            kwargs["where"] = where

        results = self.collection.query(**kwargs)

        return {
            "documents": results["documents"][0],
            "metadatas": results["metadatas"][0],
            "distances": results["distances"][0],
        }

    def count(self) -> int:
        return self.collection.count()
```

### 2.5 检索与生成

```python
# rag_pipeline.py
from typing import List, Dict, Optional
from openai import OpenAI

class RAGPipeline:
    def __init__(
        self,
        embedding_service,
        vector_store,
        config
    ):
        self.embedder = embedding_service
        self.store = vector_store
        self.config = config
        self.llm = OpenAI()

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        filter_metadata: Optional[Dict] = None
    ) -> List[Dict]:
        """检索相关文档块"""
        k = top_k or self.config.top_k
        query_embedding = self.embedder.embed_query(query)

        results = self.store.search(
            query_embedding=query_embedding,
            top_k=k,
            where=filter_metadata
        )

        # 过滤低分结果
        filtered = []
        for doc, meta, dist in zip(
            results["documents"],
            results["metadatas"],
            results["distances"]
        ):
            similarity = 1 - dist  # cosine distance -> similarity
            if similarity >= self.config.similarity_threshold:
                filtered.append({
                    "text": doc,
                    "metadata": meta,
                    "similarity": round(similarity, 4),
                })

        return filtered

    def generate(self, query: str, context_docs: List[Dict]) -> str:
        """基于检索结果生成回答"""
        # 构建上下文
        context_parts = []
        for i, doc in enumerate(context_docs):
            source = doc["metadata"].get("source", "unknown")
            context_parts.append(
                f"[{i + 1}] (来源: {source}, 相似度: {doc['similarity']})\n{doc['text']}"
            )

        context = "\n\n".join(context_parts)

        # 调用 LLM
        response = self.llm.chat.completions.create(
            model=self.config.llm_model,
            messages=[
                {"role": "system", "content": self.config.system_prompt},
                {
                    "role": "user",
                    "content": self.config.user_prompt_template.format(
                        context=context,
                        question=query
                    )
                }
            ],
            max_tokens=self.config.max_tokens,
            temperature=self.config.temperature,
        )

        return response.choices[0].message.content

    def query(
        self,
        question: str,
        top_k: Optional[int] = None,
        filter_metadata: Optional[Dict] = None
    ) -> Dict:
        """端到端 RAG 查询"""
        # 检索
        retrieved_docs = self.retrieve(question, top_k, filter_metadata)

        if not retrieved_docs:
            return {
                "answer": "抱歉，未找到相关信息来回答您的问题。",
                "sources": [],
                "retrieved_count": 0,
            }

        # 生成
        answer = self.generate(question, retrieved_docs)

        return {
            "answer": answer,
            "sources": [
                {
                    "text": doc["text"][:200] + "...",
                    "source": doc["metadata"].get("source", "unknown"),
                    "similarity": doc["similarity"],
                }
                for doc in retrieved_docs
            ],
            "retrieved_count": len(retrieved_docs),
        }
```

### 2.6 主程序入口

```python
# main.py
from config import RAGConfig
from ingestion import load_documents, chunk_documents
from embedding import EmbeddingService
from vector_store import ChromaVectorStore
from rag_pipeline import RAGPipeline

def build_rag_system(docs_path: str, config: RAGConfig = None):
    """构建完整的 RAG 系统"""
    if config is None:
        config = RAGConfig()

    print("=" * 50)
    print("构建 RAG 基线系统")
    print("=" * 50)

    # 1. 加载文档
    print("\n[1/4] 加载文档...")
    documents = load_documents(docs_path)
    print(f"  加载了 {len(documents)} 个文档")

    # 2. 分块
    print("\n[2/4] 文档分块...")
    chunks = chunk_documents(
        documents,
        chunk_size=config.chunk_size,
        chunk_overlap=config.chunk_overlap,
        separators=config.separators
    )
    print(f"  生成了 {len(chunks)} 个文档块")
    print(f"  平均块大小: {sum(len(c.text) for c in chunks) / len(chunks):.0f} 字符")

    # 3. Embedding + 存储
    print("\n[3/4] 生成 Embedding 并存储...")
    embedder = EmbeddingService(model=config.embedding_model)
    store = ChromaVectorStore(
        collection_name=config.collection_name,
        persist_dir=config.persist_dir
    )

    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        texts = [c.text for c in batch]
        embeddings = embedder.embed(texts)
        ids = [f"chunk_{i + j}" for j in range(len(batch))]
        metadatas = [c.metadata for c in batch]

        store.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )
        print(f"  已处理 {min(i + batch_size, len(chunks))}/{len(chunks)}")

    print(f"  向量库总条数: {store.count()}")

    # 4. 构建 Pipeline
    print("\n[4/4] 初始化 RAG Pipeline...")
    pipeline = RAGPipeline(
        embedding_service=embedder,
        vector_store=store,
        config=config
    )

    print("\n" + "=" * 50)
    print("RAG 基线系统构建完成!")
    print("=" * 50)

    return pipeline


if __name__ == "__main__":
    config = RAGConfig(
        chunk_size=512,
        chunk_overlap=64,
        top_k=5,
    )

    pipeline = build_rag_system("./docs", config)

    # 测试查询
    result = pipeline.query("什么是 RAG?")
    print(f"\n问题: 什么是 RAG?")
    print(f"回答: {result['answer']}")
    print(f"参考来源: {len(result['sources'])} 个")
    for src in result["sources"]:
        print(f"  - {src['source']} (相似度: {src['similarity']})")
```

---

## 3. 评估系统

### 3.1 评估指标

```
┌─────────────────────────────────────────────────────────────────┐
│                    RAG 评估指标体系                               │
│                                                                 │
│  ┌─────────────────────┐   ┌─────────────────────┐             │
│  │    检索质量指标       │   │    生成质量指标       │             │
│  ├─────────────────────┤   ├─────────────────────┤             │
│  │ Recall@K: 前K个结果  │   │ Faithfulness: 回答   │             │
│  │ 中包含正确答案的     │   │ 是否忠于检索到的     │             │
│  │ 比例                │   │ 参考资料             │             │
│  │                     │   │                     │             │
│  │ MRR: 第一个正确     │   │ Relevance: 回答     │             │
│  │ 结果的排名倒数      │   │ 是否切题             │             │
│  │                     │   │                     │             │
│  │ Precision@K: 前K   │   │ Completeness: 回答  │             │
│  │ 个结果中正确的比例  │   │ 是否完整             │             │
│  └─────────────────────┘   └─────────────────────┘             │
│                                                                 │
│  ┌─────────────────────────────────────────────┐               │
│  │              端到端指标                       │               │
│  ├─────────────────────────────────────────────┤               │
│  │ Answer Correctness: 最终答案是否正确          │               │
│  │ Response Time: 端到端响应时间                 │               │
│  │ Cost per Query: 每次查询的 API 成本           │               │
│  └─────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 评估代码实现

```python
# evaluation.py
import time
import numpy as np
from typing import List, Dict, Tuple
from dataclasses import dataclass

@dataclass
class EvalCase:
    question: str
    expected_answer: str
    expected_sources: List[str]  # 应该检索到的文档来源

@dataclass
class EvalResult:
    recall_at_k: float
    mrr: float
    answer_relevance: float
    latency_ms: float
    cost_usd: float


class RAGEvaluator:
    def __init__(self, pipeline):
        self.pipeline = pipeline

    def evaluate_retrieval(
        self,
        query: str,
        expected_sources: List[str],
        top_k: int = 5
    ) -> Tuple[float, float]:
        """评估检索质量"""
        results = self.pipeline.retrieve(query, top_k=top_k)

        retrieved_sources = [
            r["metadata"].get("source", "") for r in results
        ]

        # Recall@K
        hits = sum(
            1 for src in expected_sources
            if any(src in r for r in retrieved_sources)
        )
        recall = hits / len(expected_sources) if expected_sources else 0

        # MRR (Mean Reciprocal Rank)
        mrr = 0
        for expected in expected_sources:
            for rank, retrieved in enumerate(retrieved_sources):
                if expected in retrieved:
                    mrr = max(mrr, 1.0 / (rank + 1))
                    break

        return recall, mrr

    def evaluate_answer_quality(
        self,
        question: str,
        expected_answer: str,
        generated_answer: str
    ) -> float:
        """评估答案质量（使用 LLM 自动评估）"""
        eval_prompt = f"""评估以下回答的质量。

问题: {question}
期望答案: {expected_answer}
生成答案: {generated_answer}

请从 1-5 分评估答案质量:
- 5分: 完全正确且完整
- 4分: 基本正确，略有遗漏
- 3分: 部分正确
- 2分: 大部分不正确
- 1分: 完全不正确

只输出数字分数:"""

        response = self.pipeline.llm.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": eval_prompt}],
            max_tokens=10,
            temperature=0,
        )

        try:
            score = float(response.choices[0].message.content.strip())
            return min(max(score, 1), 5) / 5.0  # 归一化到 0-1
        except ValueError:
            return 0.0

    def run_evaluation(self, test_cases: List[EvalCase]) -> EvalResult:
        """运行完整评估"""
        recalls = []
        mrrs = []
        relevances = []
        latencies = []
        total_cost = 0

        for case in test_cases:
            start = time.time()

            # 检索评估
            recall, mrr = self.evaluate_retrieval(
                case.question, case.expected_sources
            )
            recalls.append(recall)
            mrrs.append(mrr)

            # 端到端查询
            result = self.pipeline.query(case.question)
            latency = (time.time() - start) * 1000
            latencies.append(latency)

            # 答案质量评估
            relevance = self.evaluate_answer_quality(
                case.question, case.expected_answer, result["answer"]
            )
            relevances.append(relevance)

        return EvalResult(
            recall_at_k=np.mean(recalls),
            mrr=np.mean(mrrs),
            answer_relevance=np.mean(relevances),
            latency_ms=np.mean(latencies),
            cost_usd=total_cost,
        )
```

### 3.3 运行评估

```python
# run_eval.py
from evaluation import RAGEvaluator, EvalCase

# 准备测试用例
test_cases = [
    EvalCase(
        question="什么是 RAG?",
        expected_answer="RAG 是检索增强生成技术，通过在生成前检索相关文档来增强 LLM 的回答。",
        expected_sources=["rag_intro.pdf", "rag_overview.md"],
    ),
    EvalCase(
        question="HNSW 索引的原理是什么?",
        expected_answer="HNSW 是分层可导航小世界图索引，通过多层图结构实现高效的近似最近邻搜索。",
        expected_sources=["vector_db_guide.pdf"],
    ),
    EvalCase(
        question="如何选择合适的 chunk size?",
        expected_answer="Chunk size 通常在 256-1024 token 之间，需要平衡上下文完整性和检索精度。",
        expected_sources=["chunking_strategy.md"],
    ),
]

# 运行评估
evaluator = RAGEvaluator(pipeline)
result = evaluator.run_evaluation(test_cases)

print("=" * 50)
print("RAG 基线评估结果")
print("=" * 50)
print(f"Recall@5:       {result.recall_at_k:.2%}")
print(f"MRR:            {result.mrr:.2%}")
print(f"答案质量:       {result.answer_relevance:.2%}")
print(f"平均延迟:       {result.latency_ms:.0f} ms")
```

---

## 4. 优化决策记录

在构建 RAG 基线时，每个环节都有多种选择。以下是我们的决策及其理由：

```
┌─────────────────────────────────────────────────────────────────┐
│                    设计决策记录                                   │
│                                                                 │
│  ┌───────────────┬─────────────────┬─────────────────────────┐  │
│  │    环节        │    选择          │    理由                 │  │
│  ├───────────────┼─────────────────┼─────────────────────────┤  │
│  │ 分块大小      │ 512 token       │ 平衡上下文完整性与       │  │
│  │               │                 │ 检索精度                 │  │
│  ├───────────────┼─────────────────┼─────────────────────────┤  │
│  │ 分块重叠      │ 64 token        │ 防止语义断裂，           │  │
│  │               │                 │ 不过大以节省存储         │  │
│  ├───────────────┼─────────────────┼─────────────────────────┤  │
│  │ Embedding     │ text-embedding  │ 性价比最优，             │  │
│  │ 模型          │ -3-small        │ 1536维足够               │  │
│  ├───────────────┼─────────────────┼─────────────────────────┤  │
│  │ 向量数据库    │ ChromaDB        │ 零配置，适合本地开发     │  │
│  │               │                 │ 生产环境可切换           │  │
│  ├───────────────┼─────────────────┼─────────────────────────┤  │
│  │ 距离度量      │ Cosine          │ 对归一化向量最优，       │  │
│  │               │                 │ 与 OpenAI 兼容           │  │
│  ├───────────────┼─────────────────┼─────────────────────────┤  │
│  │ Top-K         │ 5               │ 平衡上下文窗口占用       │  │
│  │               │                 │ 与信息覆盖               │  │
│  ├───────────────┼─────────────────┼─────────────────────────┤  │
│  │ LLM 模型      │ gpt-4o-mini     │ 成本低，速度快，         │  │
│  │               │                 │ 质量足够基线             │  │
│  ├───────────────┼─────────────────┼─────────────────────────┤  │
│  │ Temperature   │ 0.1             │ 保证回答稳定性，         │  │
│  │               │                 │ 减少随机性               │  │
│  └───────────────┴─────────────────┴─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. 常见错误与避坑指南

### 错误 1: 分块过小导致上下文丢失

```python
# ❌ 错误：chunk_size=100，语义严重断裂
chunks = chunk_documents(docs, chunk_size=100, chunk_overlap=10)

# ✅ 正确：根据内容类型调整
# 技术文档: 512-1024 token
# 对话记录: 按轮次分块
# 表格数据: 按行/按块分块
chunks = chunk_documents(docs, chunk_size=512, chunk_overlap=64)
```

### 错误 2: 不做查询预处理

```python
# ❌ 错误：直接使用用户原始输入
result = pipeline.query("额。。。那个。。。我想问下RAG是啥？")

# ✅ 正确：清理查询文本
def clean_query(query: str) -> str:
    import re
    query = re.sub(r'[。，、！？,.!?]+$', '', query.strip())
    query = re.sub(r'\s+', ' ', query)
    return query

result = pipeline.query(clean_query("额。。。那个。。。我想问下RAG是啥？"))
```

### 错误 3: 忽略 embedding 成本

```python
# ❌ 错误：每次查询都重新 embedding 所有文档
# 百万文档 = $20+ 每次全量

# ✅ 正确：增量更新，只 embedding 新文档
existing_ids = set(store.get_all_ids())
new_chunks = [c for c in chunks if c.id not in existing_ids]
if new_chunks:
    embeddings = embedder.embed([c.text for c in new_chunks])
    store.add(new_chunks, embeddings)
```

### 错误 4: 不处理空结果

```python
# ❌ 错误：假设检索总有结果
answer = generate(query, retrieve(query))  # 空结果时 prompt 异常

# ✅ 正确：处理空结果
docs = retrieve(query)
if not docs:
    return "未找到相关信息，请尝试换个问法。"
answer = generate(query, docs)
```

### 错误 5: 评估用例太少

```python
# ❌ 错误：只用 3 个用例评估
test_cases = [EvalCase("什么是RAG?", "...", ["doc1"])]

# ✅ 正确：至少 20-50 个多样化用例
# 覆盖: 简单问题、复杂问题、多文档问题、无答案问题
test_cases = load_eval_dataset("eval_cases.json")  # 至少 20 条
```

---

## 6. 总结

```
┌─────────────────────────────────────────────────────────────────┐
│                    Stage 1 知识整合                               │
│                                                                 │
│  本课将 Stage 1 所学整合为完整的 RAG 基线:                        │
│                                                                 │
│  Lesson 1: RAG 架构 ──▶ 理解整体流程                             │
│  Lesson 2: 文档解析 ──▶ 处理 PDF/表格/图片                       │
│  Lesson 3: 分块策略 ──▶ 递归分块 + 重叠窗口                      │
│  Lesson 4: Embedding ──▶ 选择合适的模型                          │
│  Lesson 5: 向量数据库 ──▶ ChromaDB 本地开发                      │
│  Lesson 6: 基线实战 ──▶ 整合 + 评估 + 优化                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  下一步优化方向 (Stage 2 预告):                           │    │
│  │                                                         │    │
│  │  • 查询改写 (Query Rewriting)                           │    │
│  │  • 混合检索 (Hybrid Search: BM25 + 向量)                │    │
│  │  • 重排序 (Reranking)                                   │    │
│  │  • 自适应检索 (Self-RAG, CRAG)                          │    │
│  │  • 多模态 RAG (图文混合)                                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. 练习

### 练习 1: 构建你自己的 RAG 系统

使用本课代码，针对你自己的文档集构建 RAG 系统：
- 准备至少 10 个文档（PDF/Markdown/TXT）
- 运行完整的摄入管道
- 测试 5 个真实问题
- 记录系统的 Recall@5 和平均延迟

### 练习 2: 分块策略对比实验

在你的文档集上对比以下分块策略的效果：
- 固定大小分块 (chunk_size=256, 512, 1024)
- 递归分块（本课实现）
- 按语义分块（使用 embedding 相似度断点）

评估标准：对 10 个测试问题的 Recall@5

### 练习 3: 构建评估数据集

为你自己的领域构建一个 RAG 评估数据集：
- 至少 25 个问答对
- 覆盖简单问题 (10)、复杂问题 (10)、无答案问题 (5)
- 记录每个问题的期望来源文档
- 编写脚本自动运行评估并输出报告

---

> **恭喜完成 Stage 1!** 🎉
>
> 你已经掌握了 RAG 系统的核心组件。进入 Stage 2 将学习高级检索策略与系统优化。
>
> [返回课程主页](./README.md)
