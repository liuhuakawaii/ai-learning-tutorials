# 01 RAG 第一性原理

> RAG 不是"给模型加个搜索"——是让 AI 从"凭记忆回答"变成"查资料回答"。

你负责的客服机器人上线后频繁"编造"产品信息——用户问"星辰科技的专业版多少钱"，模型自信地回答了一个不存在的价格。产品经理要求回答必须引用官方文档原文。你需要一种机制，让模型在回答前先查阅真实资料。

## 为什么大模型会"编"

大模型的训练数据有截止日期，而且它无法区分"我知道"和"我不知道"。当你问一个它不确定的问题，它不会说"我不知道"，而是会生成一个看起来合理的答案——这就是幻觉（hallucination）。

幻觉不是 bug，是模型的工作方式。模型本质上是一个概率生成器，它生成"最可能的下一个 token"，而不是"最正确的答案"。

## RAG 的核心思想

RAG（Retrieval-Augmented Generation）的思路很直接：**先检索，再生成**。

```
用户问题 → 检索相关文档 → 把文档 + 问题一起给 LLM → LLM 基于文档生成回答
```

这就像开卷考试和闭卷考试的区别。闭卷考试（纯 LLM）靠记忆，记错了就答错。开卷考试（RAG）可以翻书，答案有据可查。

## RAG vs 微调

很多人分不清什么时候用 RAG、什么时候用微调。核心区别：

- **RAG** 改变的是模型的"输入"——给它更多参考资料
- **微调** 改变的是模型的"参数"——让它学会新的行为模式

企业知识库问答首选 RAG：成本低（只需要向量数据库）、更新快（换文档就行）、可解释（能引用原文）。微调只在需要调整模型行为风格时才考虑——比如让客服说话更像公司风格。

## RAG Pipeline

一个完整的 RAG 流程包含三个阶段：

**索引阶段**（离线）：文档解析 → 文本切分 → 生成 Embedding → 存入向量数据库

**检索阶段**（在线）：用户问题 → 生成问题的 Embedding → 向量相似度检索 → 返回 Top-K 文档

**生成阶段**（在线）：把检索到的文档和用户问题一起给 LLM → LLM 基于文档生成回答

```python
# 简化的 RAG 流程
async def rag_answer(question: str, knowledge_base_id: str) -> str:
    # 1. 检索
    docs = await vector_store.search(question, knowledge_base_id, top_k=5)
    
    # 2. 构建 Prompt
    context = "\n\n".join(f"[{i+1}] {doc.content}" for i, doc in enumerate(docs))
    prompt = f"""请基于以下参考资料回答问题。如果参考资料中没有相关信息，请说"我找不到相关信息"。

参考资料：
{context}

问题：{question}"""
    
    # 3. 生成
    response = await llm.chat([{"role": "user", "content": prompt}], model="gpt-4o")
    return response.content
```

## 为什么直接对比很重要

建议你亲手做一个对比实验。准备 10 个关于"星辰科技产品"的问题（这个公司不存在于训练数据中），分别用纯 LLM 和 RAG 回答。你会看到：

- 纯 LLM 会编造价格、功能、成立日期
- RAG 基于真实文档回答，准确性大幅提升
- 但 RAG 也有边界——如果检索不到相关文档，LLM 仍可能编造

这个实验的价值在于让你直观感受 RAG 的收益和边界，而不是停留在概念层面。

## RAG 质量的三个环节

RAG 的回答质量取决于三个环节，任何一个出问题都会影响最终结果：

**文档处理质量**：文档解析是否完整？切分是否合理？太大的 chunk 检索不精确，太小的 chunk 丢失上下文。

**检索质量**：检索到的文档是否真的相关？纯向量检索可能漏掉关键词匹配的结果，混合检索（向量 + BM25）通常更好。

**生成质量**：LLM 是否真的基于检索结果回答？有时候 LLM 会忽略检索结果，用自己的"记忆"回答。Prompt 里要明确要求"基于参考资料回答"。

## 练习

### 练习 1：RAG vs 直接回答

构造一个 LLM 无法正确回答的领域（比如虚构的"星辰科技产品"），准备产品文档，对比有 RAG 和没有 RAG 的回答质量：

```python
PRODUCT_DOCS = [
    "星辰科技专业版定价为 299 元/月，支持最多 50 个用户。",
    "星辰科技基础版定价为 99 元/月，支持最多 10 个用户。",
    "星辰科技企业版定价为 999 元/月，不限用户数。",
]

async def ask_without_rag(question):
    # 直接问 LLM，不给参考资料
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": question}],
    )
    return response.choices[0].message.content

async def ask_with_rag(question, docs):
    # 先检索，再生成
    context = "\n".join(f"[{i+1}] {doc}" for i, doc in enumerate(docs))
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"基于以下资料回答：\n{context}"},
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content
```

问"星辰科技专业版多少钱？"，无 RAG 会编造价格，有 RAG 能正确回答 299 元/月。

### 练习 2：设计你的 RAG 架构

为你熟悉的业务场景设计 RAG 架构：
1. 数据源是什么？（PDF、Word、数据库、网页）
2. 怎么切分文本？（按段落？按固定长度？按语义？）
3. 用什么 Embedding 模型？（OpenAI 的还是开源的？）
4. 怎么评估检索质量？（Recall@5？准确率？）

把设计写成文档——阶段 3 的后续课程会逐步实现这些组件。

## 关键判断

- **RAG 不是万能的。** 如果文档本身有错误，RAG 会忠实传播错误。垃圾进，垃圾出。
- **Embedding 模型的选择影响巨大。** 中文场景用 text-embedding-3-small 效果不错，有隐私要求用 BGE 本地部署。
- **评估体系必须从第一天建立。** 不评估就不知道好不好，不知道好不好就没法优化。
