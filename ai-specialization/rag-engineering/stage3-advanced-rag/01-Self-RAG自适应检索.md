# Self-RAG：当检索反而帮了倒忙

> Stage 3 · Lesson 1 | 前置：Stage 2 完成 | 时长：55 分钟

你的 RAG 系统对每个问题都执行检索。数据显示，有 30% 的查询其实不需要检索——"你好""谢谢""帮我总结上面的内容"这类问题，强行检索反而引入无关文档，增加延迟。更糟的是，有时候检索到了看似相关但实际包含错误信息的文档，LLM 照单全收，生成了误导性回答。

Self-RAG 的核心思想：让模型自己决定什么时候该检索、什么时候不该检索，以及检索到的内容是否真的可信。

## 你要解决的问题

- 什么情况下检索是有害的
- 如何让模型自主判断是否需要检索
- 如何评估检索结果的质量，丢弃低质量结果

## 1. 先看一个检索帮倒忙的例子

```python
from openai import OpenAI
from pymilvus import MilvusClient

client = OpenAI()
milvus = MilvusClient(uri="http://localhost:19530")

# 这个问题不需要检索
query = "2 + 2 等于几"

# 但 RAG 系统还是去检索了
response = client.embeddings.create(model="text-embedding-3-small", input=query)
vector = response.data[0].embedding

results = milvus.search(
    collection_name="knowledge_base",
    data=[vector],
    limit=3,
    output_fields=["text"]
)

# 检索结果可能包含：数学教材片段、计算器使用指南...
# 这些都不需要，LLM 本身就能回答
for r in results[0]:
    print(r["entity"]["text"][:100])
```

问题不只是浪费了一次检索调用。如果检索到的文档里有错误信息（比如"2+2=5"是个梗），LLM 可能会被误导。

## 2. Self-RAG 的反思 token 机制

Self-RAG 在生成过程中插入特殊的"反思 token"，让模型在关键节点做判断：

```text
用户提问
  │
  ▼
[Retrieve?] ── No ──▶ 直接生成答案（不检索）
  │
  Yes
  ▼
执行检索
  │
  ▼
[IsRel?] ── Irrelevant ──▶ 丢弃检索结果，重新生成或再检索
  │
  Relevant
  ▼
生成答案
  │
  ▼
[IsSup?] ── Not Supported ──▶ 答案没有依据，标记为低可信度
  │
  Supported
  ▼
[IsUse?] ── 评估答案是否有用
  │
  ▼
返回最终答案 + 可信度标记
```

四个反思 token 的含义：

- **Retrieve**：这个问题需要检索吗？
- **IsRel**：检索结果和问题相关吗？
- **IsSup**：生成的答案被检索结果支持吗？
- **IsUse**：这个答案对用户有用吗？

## 3. 实现一个简化版 Self-RAG

```python
def should_retrieve(query: str) -> bool:
    """判断是否需要检索"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""判断以下问题是否需要外部知识才能准确回答。

问题：{query}

如果问题涉及事实、数据、具体流程、专业知识，回答"需要"。
如果问题是问候、数学计算、通用常识、上下文引用，回答"不需要"。

只回答"需要"或"不需要"。"""
        }],
        temperature=0.0,
        max_tokens=10
    )
    return "需要" in response.choices[0].message.content

def assess_relevance(query: str, retrieved_texts: list[str]) -> list[bool]:
    """评估每个检索结果是否相关"""
    results = []
    for text in retrieved_texts:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"判断以下文档是否和问题相关。只回答"相关"或"不相关"。\n\n问题：{query}\n\n文档：{text[:500]}"
            }],
            temperature=0.0,
            max_tokens=10
        )
        results.append("相关" in response.choices[0].message.content)
    return results

def assess_support(answer: str, contexts: list[str]) -> str:
    """评估答案是否被检索结果支持"""
    combined_context = "\n\n".join(contexts[:3])
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"""判断以下答案是否有文档支持。

答案：{answer}

文档：{combined_context}

回答 "充分支持"、"部分支持" 或 "无支持"。"""
        }],
        temperature=0.0,
        max_tokens=10
    )
    return response.choices[0].message.content

def self_rag_query(query: str) -> dict:
    """完整的 Self-RAG 流程"""
    result = {"query": query, "retrieved": False, "relevance": [], "support": "N/A"}

    # Step 1: 判断是否需要检索
    if not should_retrieve(query):
        # 直接生成
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": query}],
            temperature=0.0
        )
        result["answer"] = response.choices[0].message.content
        result["method"] = "direct"
        return result

    # Step 2: 执行检索
    result["retrieved"] = True
    response = client.embeddings.create(model="text-embedding-3-small", input=query)
    vector = response.data[0].embedding
    search_results = milvus.search(
        collection_name="knowledge_base",
        data=[vector],
        limit=5,
        output_fields=["text"]
    )
    texts = [r["entity"]["text"] for r in search_results[0]]

    # Step 3: 评估相关性，过滤不相关结果
    relevance = assess_relevance(query, texts)
    result["relevance"] = relevance
    relevant_texts = [t for t, r in zip(texts, relevance) if r]

    if not relevant_texts:
        # 所有检索结果都不相关，降级为直接回答
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": query}],
            temperature=0.0
        )
        result["answer"] = response.choices[0].message.content
        result["method"] = "fallback_direct"
        return result

    # Step 4: 基于相关结果生成答案
    context = "\n\n".join(relevant_texts[:3])
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "user",
            "content": f"基于以下文档回答问题。如果文档中没有相关信息，请说明。\n\n文档：{context}\n\n问题：{query}"
        }],
        temperature=0.0
    )
    answer = response.choices[0].message.content

    # Step 5: 评估答案支持度
    support = assess_support(answer, relevant_texts)
    result["answer"] = answer
    result["support"] = support
    result["method"] = "rag_with_assessment"

    return result
```

## 4. 测试不同场景

```python
test_cases = [
    # 不需要检索
    "你好",
    "123 * 456 等于多少",
    "帮我总结上面的对话",

    # 需要检索
    "如何申请退货",
    "RTX 4090 的功耗是多少",
    "Python 3.12 有什么新特性",
]

for query in test_cases:
    result = self_rag_query(query)
    print(f"\n查询: {query}")
    print(f"是否检索: {result['retrieved']}")
    print(f"方法: {result['method']}")
    print(f"答案: {result['answer'][:100]}")
```

## 5. 成本与收益

Self-RAG 的代价是多次 LLM 调用（判断是否检索、评估相关性、评估支持度）。在不需要检索的问题上，它省去了检索成本但增加了判断成本。在需要检索的问题上，它增加了评估成本但提高了答案质量。

```text
场景                    Naive RAG     Self-RAG
────────────────────────────────────────────────
不需要检索的问题         检索+生成      判断+直接生成
延迟: ~1500ms           延迟: ~800ms
可能被误导              不会被误导

需要检索+结果相关        检索+生成      判断+检索+评估+生成
延迟: ~1500ms           延迟: ~2500ms
直接使用结果             过滤低质量结果
```

Self-RAG 不是免费的午餐。是否引入取决于你的查询中有多少是不需要检索的，以及检索结果的质量波动有多大。

## 练习

### 练习一：实现检索重试

当所有检索结果都被标记为"不相关"时，当前实现是降级为直接回答。改为重试检索：用改写后的查询重新检索一次。

```python
def retry_with_rewrite(query: str) -> list[dict]:
    # 用 LLM 改写查询
    # 重新检索
    # 再次评估相关性
    pass
```

### 练习二：统计反思 token 的分布

跑 50 个查询，统计：
- 多少比例跳过了检索
- 需要检索的查询中，多少比例的结果被过滤
- 答案支持度的分布（充分支持 / 部分支持 / 无支持）

这些数据决定 Self-RAG 在你的场景下是否值得引入。

---

## 参考答案

### 练习二

典型分布（取决于知识库质量）：

```text
跳过检索: 25-35%
  - 问候语、简单计算、上下文引用

需要检索: 65-75%
  - 其中 80-90% 结果相关
  - 10-20% 结果不相关（需要过滤或重试）

支持度分布:
  - 充分支持: 60-70%
  - 部分支持: 20-25%
  - 无支持: 5-10%
```

如果"无支持"比例超过 15%，说明检索质量有问题，应该优先优化检索而不是加 Self-RAG。
