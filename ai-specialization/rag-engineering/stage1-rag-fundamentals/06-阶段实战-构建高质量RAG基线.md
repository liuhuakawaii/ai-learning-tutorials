# 阶段实战：构建高质量 RAG 基线

> Stage 1 · Capstone | 前置：Lesson 1-5 完成 | 时长：90 分钟

把前面五课的知识串成一个能跑的系统。交付标准：给定文档，系统能准确回答相关问题，并且有量化的质量指标作为基线。

## 你要完成的事

- 搭建从文档摄入到回答生成的完整 pipeline
- 建立评估基线（检索质量 + 生成质量）
- 记录每个设计决策的理由

## 1. 配置与文档摄入

```python
# config.py
from dataclasses import dataclass

@dataclass
class RAGConfig:
    chunk_size: int = 512
    chunk_overlap: int = 64
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    milvus_uri: str = "http://localhost:19530"
    collection_name: str = "rag_baseline"
    top_k: int = 5
    llm_model: str = "gpt-4o-mini"
```

参数集中管理，后面做对比实验只改配置。

```python
# ingest.py
from pathlib import Path
from openai import OpenAI
from pymilvus import MilvusClient
from config import RAGConfig

client = OpenAI()

def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
    """递归字符分块"""
    separators = ["\n\n", "\n", "。", ".", " "]
    chunks, current = [], ""
    for sep in separators:
        for part in text.split(sep):
            if len(current) + len(part) + len(sep) <= chunk_size:
                current += (sep if current else "") + part
            else:
                if current:
                    chunks.append(current)
                current = part
        if chunks:
            break
    if current:
        chunks.append(current)
    # 处理 overlap
    if overlap > 0 and len(chunks) > 1:
        overlapped = [chunks[0]]
        for i in range(1, len(chunks)):
            overlapped.append(chunks[i-1][-overlap:] + chunks[i])
        chunks = overlapped
    return chunks

def ingest(config: RAGConfig, doc_dir: str):
    milvus = MilvusClient(uri=config.milvus_uri)
    if milvus.has_collection(config.collection_name):
        milvus.drop_collection(config.collection_name)
    milvus.create_collection(
        collection_name=config.collection_name,
        dimension=config.embedding_dim,
        metric_type="COSINE"
    )

    docs = list(Path(doc_dir).glob("**/*.md"))
    all_chunks = []
    for path in docs:
        text = path.read_text(encoding="utf-8")
        for chunk in chunk_text(text, config.chunk_size, config.chunk_overlap):
            all_chunks.append({"text": chunk, "source": path.name})

    # 批量 embedding 并存储
    for i in range(0, len(all_chunks), 100):
        batch = all_chunks[i:i+100]
        vectors = client.embeddings.create(
            model=config.embedding_model,
            input=[c["text"] for c in batch]
        ).data
        milvus.insert(
            collection_name=config.collection_name,
            data=[{"text": c["text"], "source": c["source"], "vector": v.embedding}
                  for c, v in zip(batch, vectors)]
        )
    print(f"摄入完成: {len(docs)} 文档, {len(all_chunks)} chunk")
```

## 2. 查询与生成

```python
# query.py
from openai import OpenAI
from pymilvus import MilvusClient
from config import RAGConfig

client = OpenAI()

def rag_query(query: str, config: RAGConfig) -> dict:
    milvus = MilvusClient(uri=config.milvus_uri)

    # 检索
    vector = client.embeddings.create(
        model=config.embedding_model, input=query
    ).data[0].embedding
    results = milvus.search(
        collection_name=config.collection_name,
        data=[vector], limit=config.top_k,
        output_fields=["text", "source"]
    )
    contexts = [{"text": r["entity"]["text"], "source": r["entity"]["source"]}
                for r in results[0]]

    # 生成
    context_text = "\n\n---\n\n".join(c["text"] for c in contexts)
    answer = client.chat.completions.create(
        model=config.llm_model,
        messages=[{"role": "user", "content":
            f"基于以下文档回答。如果没有相关信息，请说明。\n\n{context_text}\n\n问题：{query}"}],
        temperature=0.0
    ).choices[0].message.content

    return {"query": query, "answer": answer, "contexts": contexts}
```

## 3. 评估

```python
# evaluate.py
import json
from config import RAGConfig
from query import rag_query

def evaluate(eval_path: str, config: RAGConfig):
    with open(eval_path, "r", encoding="utf-8") as f:
        eval_data = json.load(f)

    recall_hits = 0
    correct = 0

    for item in eval_data:
        result = rag_query(item["question"], config)

        # 检索评估：关键信息是否出现在检索结果中
        retrieved_text = " ".join(c["text"] for c in result["contexts"])
        if item["answer_keyword"].lower() in retrieved_text.lower():
            recall_hits += 1

        # 生成评估：用 LLM 判断
        judge = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content":
                f"判断回答是否正确。只回答"正确"或"错误"。\n"
                f"问题: {item['question']}\n参考: {item['reference_answer']}\n"
                f"回答: {result['answer']}"}],
            temperature=0.0, max_tokens=10
        )
        if "正确" in judge.choices[0].message.content:
            correct += 1

    n = len(eval_data)
    print(f"Recall@{config.top_k}: {recall_hits}/{n} = {recall_hits/n:.0%}")
    print(f"准确率: {correct}/{n} = {correct/n:.0%}")
```

评估数据集至少 20 个问答对，每个要有 `answer_keyword` 和 `reference_answer`：

```json
[
  {"question": "退货的时间限制是多少天？", "answer_keyword": "7天",
   "reference_answer": "退货需在收到商品后7天内申请", "category": "退货"},
  {"question": "退款到账需要多久？", "answer_keyword": "3个工作日",
   "reference_answer": "退款将在3个工作日内到账", "category": "退款"}
]
```

## 4. 跑起来，记录基线

```bash
python ingest.py
python query.py   # 试一个查询
python evaluate.py  # 跑完整评估
```

记录基线数据，后面每课优化都要和这个数字对比。

## 练习

### 练习一：调整 chunk_size 做对比

把 `chunk_size` 分别改成 256、512、1024，重新摄入并评估。记录三组 Recall@5。

思考：chunk 越大信息越多，但语义越分散。你观察到的拐点在哪？

### 练习二：添加查询改写

在 retrieve 前加一步 LLM 查询改写，对比有无改写的 Recall@5 差异。

### 练习三：分析失败案例

挑出 3 个回答错误的案例，逐个分析：检索结果里有没有正确文档？如果有，是生成问题；如果没有，是检索或分块问题。

---

## 参考答案

### 练习一

典型结果：chunk_size=256 时很多答案被截断到多个 chunk，Recall 低；512 是平衡点；1024 可能因语义稀释导致 Recall 下降。具体拐点取决于文档结构，关键是自己跑数据。

### 练习三

失败分析模板：检索到的 top-5 里有没有包含答案关键词的 chunk？如果有 → 生成问题（prompt 没引导 LLM 引用）；如果没有 → 检查文档是否被摄入、分块是否截断了关键信息。
