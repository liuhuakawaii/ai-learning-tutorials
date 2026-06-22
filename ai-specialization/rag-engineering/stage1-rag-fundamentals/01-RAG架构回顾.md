# Lesson 1: RAG 架构回顾

```
╔══════════════════════════════════════════════════════════════╗
║  Stage 1 · Lesson 1                                         ║
║  RAG 架构回顾                                                ║
║  预计时间: 45 分钟                                            ║
╚══════════════════════════════════════════════════════════════╝
```

## 前置要求

- Python 基础编程能力
- 了解 LLM API 的基本使用（如 OpenAI ChatCompletion）
- 了解基本的文本处理概念

## 场景引入

你所在的团队刚上线了一个基于 LLM 的智能客服系统。上线第一天就收到大量投诉：用户问"如何退货"，系统却回答了"如何下单"的内容；用户问最新的促销活动，系统完全答不上来，因为模型的训练数据截止到半年前。团队意识到，仅靠 LLM 本身的知识远远不够，需要让它能够"查阅"最新的业务文档。这就是 RAG 要解决的核心问题——让 LLM 在回答之前先检索相关知识，确保回答既准确又有时效性。

## 学习目标

完成本课后，你将能够：

1. **理解三种 RAG 范式**：Naive RAG、Advanced RAG、Modular RAG 的区别与适用场景
2. **掌握三阶段流水线**：索引（Indexing）、检索（Retrieval）、生成（Generation）
3. **识别常见失败模式**：了解 RAG 系统中最常见的问题及其根因
4. **对比 RAG 与微调**：在不同场景下做出正确的技术选型

---

## 1. 什么是 RAG？

RAG（Retrieval-Augmented Generation，检索增强生成）是一种将外部知识库与大语言模型结合的技术架构。它的核心思想是：**在生成回答之前，先从知识库中检索相关文档，然后将这些文档作为上下文提供给 LLM**。

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG 核心思想                               │
│                                                             │
│   用户提问 ──▶ 检索相关文档 ──▶ 文档 + 问题 ──▶ LLM 生成回答  │
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │ "什么是   │    │ 找到3篇  │    │ 根据以下  │             │
│   │  RAG?"   │───▶│ 相关文档 │───▶│ 文档回答  │──▶ 答案     │
│   └──────────┘    └──────────┘    └──────────┘             │
└─────────────────────────────────────────────────────────────┘
```

**为什么需要 RAG？**

- LLM 的知识截止到训练数据，无法获取最新信息
- LLM 可能产生幻觉（Hallucination），生成虚假信息
- 企业私有数据不在 LLM 的训练集中
- 微调成本高，且难以实时更新知识

---

## 2. 三种 RAG 范式

### 2.1 Naive RAG（朴素 RAG）

最简单的 RAG 实现，流程固定：查询 → 检索 → 生成。

```
┌─────────────────────────────────────────────────────────────┐
│                      Naive RAG 流程                          │
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │  用户    │    │ 向量    │    │  Top-K  │    │  LLM    │  │
│  │  查询    │───▶│ 检索    │───▶│  文档   │───▶│  生成    │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                             │
│  特点: 简单直接，但存在检索质量依赖、上下文窗口浪费等问题       │
└─────────────────────────────────────────────────────────────┘
```

**优点：** 实现简单，快速上手
**缺点：** 检索精度依赖 embedding 质量，无法处理复杂查询

### 2.2 Advanced RAG（进阶 RAG）

在 Naive RAG 基础上，增加了预检索和后检索优化。

```
┌─────────────────────────────────────────────────────────────┐
│                    Advanced RAG 流程                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 预检索优化                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │    │
│  │  │ 查询重写 │  │ 查询扩展 │  │ 查询路由 │          │    │
│  │  └──────────┘  └──────────┘  └──────────┘          │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 检索阶段                              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │    │
│  │  │ 混合检索 │  │ 元数据过滤│  │ 重排序   │          │    │
│  │  └──────────┘  └──────────┘  └──────────┘          │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 后检索优化                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │    │
│  │  │ 文档压缩 │  │ 上下文   │  │ 答案验证 │          │    │
│  │  │          │  │ 融合     │  │          │          │    │
│  │  └──────────┘  └──────────┘  └──────────┘          │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          ▼                                  │
│                    ┌──────────┐                             │
│                    │ LLM 生成 │                             │
│                    └──────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Modular RAG（模块化 RAG）

将 RAG 系统拆分为可组合的模块，支持灵活编排。

```
┌─────────────────────────────────────────────────────────────┐
│                    Modular RAG 架构                          │
│                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│   │ 路由模块 │  │ 检索模块 │  │ 重排模块 │  │ 生成模块 │      │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘      │
│        │            │            │            │             │
│   ┌────┴────┐  ┌────┴────┐  ┌────┴────┐  ┌────┴────┐      │
│   │自适应   │  │多路检索 │  │交叉编码 │  │引用生成 │      │
│   │路由     │  │融合     │  │器重排   │  │验证     │      │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
│                                                             │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│   │记忆模块 │  │ 缓存模块│  │评估模块 │  │反馈模块 │      │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
│                                                             │
│   特点: 模块可插拔、可替换、可组合，支持复杂工作流              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. RAG 三阶段流水线

### 3.1 阶段一：索引（Indexing）

```
原始文档 ──▶ 文档解析 ──▶ 文本分块 ──▶ Embedding ──▶ 向量存储
```

索引阶段负责将原始文档转换为可检索的向量表示：

1. **文档解析**：从 PDF、Word、HTML 等格式中提取文本
2. **文本分块**：将长文档切分为合适大小的片段
3. **Embedding**：将文本转换为高维向量
4. **向量存储**：将向量存入向量数据库

### 3.2 阶段二：检索（Retrieval）

```
用户查询 ──▶ 查询处理 ──▶ 向量检索 ──▶ 重排序 ──▶ 相关文档
```

检索阶段负责根据用户查询找到最相关的文档：

1. **查询处理**：查询重写、扩展、分解
2. **向量检索**：在向量数据库中搜索相似向量
3. **重排序**：对检索结果进行精细排序
4. **过滤**：根据元数据过滤结果

### 3.3 阶段三：生成（Generation）

```
相关文档 + 用户查询 ──▶ Prompt 构建 ──▶ LLM 生成 ──▶ 答案 + 引用
```

生成阶段负责基于检索结果生成回答：

1. **Prompt 构建**：将检索文档和查询组合成 prompt
2. **LLM 生成**：调用 LLM 生成回答
3. **后处理**：添加引用、验证答案、格式化输出

---

## 4. 常见失败模式

```
┌─────────────────────────────────────────────────────────────┐
│                  RAG 常见失败模式                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 检索失败                                                │
│     ├── 语义不匹配：查询和文档用词不同但含义相同              │
│     ├── 关键信息丢失：分块切断了关键上下文                    │
│     └── Top-K 不足：返回结果太少，遗漏关键文档               │
│                                                             │
│  2. 生成失败                                                │
│     ├── 幻觉：LLM 编造了文档中不存在的信息                   │
│     ├── 忽略上下文：LLM 没有参考检索到的文档                 │
│     └── 信息过载：上下文太长，关键信息被淹没                  │
│                                                             │
│  3. 系统失败                                                │
│     ├── 延迟过高：检索+生成耗时太长                          │
│     ├── 成本失控：token 使用量超出预算                        │
│     └── 数据过时：知识库没有及时更新                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. RAG vs Fine-tuning vs Prompt Engineering

| 维度 | RAG | Fine-tuning | Prompt Engineering |
|------|-----|-------------|-------------------|
| **知识更新** | 实时更新，修改知识库即可 | 需要重新训练 | 无法添加新知识 |
| **成本** | 中等（向量数据库 + 检索） | 高（训练资源） | 低（仅 prompt） |
| **准确性** | 高（有引用来源） | 中等（可能过拟合） | 低（依赖 LLM 内部知识） |
| **可解释性** | 高（可追溯来源） | 低（黑盒） | 低 |
| **适用场景** | 知识密集型问答 | 风格/格式调整 | 简单任务 |
| **延迟** | 中等（检索 + 生成） | 低（仅生成） | 低（仅生成） |
| **幻觉控制** | 好（有事实依据） | 中等 | 差 |
| **实现复杂度** | 中等 | 高 | 低 |

**选型建议：**
- 需要最新知识 → RAG
- 需要特定风格/格式 → Fine-tuning
- 简单任务、预算有限 → Prompt Engineering
- 企业知识库问答 → RAG（首选）

---

## 6. 代码实战

### 6.1 使用 LangChain 构建基础 RAG

```python
"""
LangChain 基础 RAG 实现
演示索引、检索、生成三个阶段
"""

from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain.chains import RetrievalQA

# ========== 阶段一：索引 ==========

# 1. 加载文档
loader = TextLoader("knowledge_base.txt", encoding="utf-8")
documents = loader.load()

# 2. 文本分块
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,        # 每个块最大 500 字符
    chunk_overlap=50,      # 块之间重叠 50 字符
    separators=["\n\n", "\n", "。", "，", " "]  # 中文分隔符
)
chunks = text_splitter.split_documents(documents)
print(f"文档被切分为 {len(chunks)} 个块")

# 3. 创建向量数据库
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db"  # 持久化存储
)

# ========== 阶段二：检索 ==========

# 创建检索器
retriever = vectorstore.as_retriever(
    search_type="similarity",  # 相似度检索
    search_kwargs={"k": 3}     # 返回 Top 3
)

# ========== 阶段三：生成 ==========

# 创建 QA 链
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",  # 将所有文档拼接后传入
    retriever=retriever,
    return_source_documents=True  # 返回源文档
)

# 查询
result = qa_chain.invoke({"query": "什么是 RAG?"})
print(f"回答: {result['result']}")
print(f"来源: {[doc.metadata for doc in result['source_documents']]}")
```

### 6.2 使用 LlamaIndex 构建基础 RAG

```python
"""
LlamaIndex 基础 RAG 实现
演示从文档加载到查询的完整流程
"""

from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core.node_parser import SentenceSplitter
from llama_index.llms.openai import OpenAI

# ========== 阶段一：索引 ==========

# 1. 加载文档
documents = SimpleDirectoryReader(
    input_dir="./knowledge_base",
    recursive=True
).load_data()
print(f"加载了 {len(documents)} 个文档")

# 2. 配置分块器
node_parser = SentenceSplitter(
    chunk_size=500,
    chunk_overlap=50
)

# 3. 创建索引（自动完成分块、embedding、存储）
index = VectorStoreIndex.from_documents(
    documents,
    transformations=[node_parser],
    show_progress=True
)

# ========== 阶段二 & 三：检索 + 生成 ==========

# 创建查询引擎
query_engine = index.as_query_engine(
    similarity_top_k=3,  # 返回 Top 3
    llm=OpenAI(model="gpt-4o-mini", temperature=0)
)

# 查询
response = query_engine.query("什么是 RAG?")
print(f"回答: {response.response}")
print(f"来源节点: {[node.metadata for node in response.source_nodes]}")
```

---

## 7. 常见误区

```
┌─────────────────────────────────────────────────────────────┐
│                    常见错误 TOP 5                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ❌ 错误 1: 分块大小设置不当                                  │
│     ✓ 正确: 根据文档类型和 LLM 上下文窗口调整                 │
│                                                             │
│  ❌ 错误 2: 忽略 chunk_overlap                                │
│     ✓ 正确: 设置 10-20% 的重叠，避免信息断裂                  │
│                                                             │
│  ❌ 错误 3: 直接用原始查询检索                                │
│     ✓ 正确: 对查询进行改写、扩展，提升召回率                   │
│                                                             │
│  ❌ 错误 4: 不做重排序                                        │
│     ✓ 正确: 使用 cross-encoder 对结果重排序                   │
│                                                             │
│  ❌ 错误 5: 忽略元数据                                        │
│     ✓ 正确: 保留文档来源、时间等元数据，支持过滤               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 工程建议

1. **先跑通 Naive RAG 再优化**：不要一开始就追求 Advanced RAG 的所有特性。先用最简单的流程验证数据质量和检索效果，再逐步加入查询改写、重排序等优化手段。
2. **建立评估基线**：在做任何优化之前，先用一组固定的测试问题记录 Recall@5 和答案质量分数。后续每一步优化都要与基线对比，避免"优化了 A 但搞砸了 B"的情况。
3. **分层设计故障处理**：检索阶段可能返回空结果或低相关结果，生成阶段可能产生幻觉。每一层都需要独立的降级策略，而不是假设上游总是正常工作。
4. **监控 token 消耗**：RAG 系统的成本主要来自 Embedding 调用和 LLM 生成。建议在生产环境中记录每次查询的输入 token 数、输出 token 数和响应延迟，及时发现成本异常。

---

## 9. 本课总结

```
┌─────────────────────────────────────────────────────────────┐
│                      Lesson 1 总结                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ RAG 三种范式:                                            │
│     - Naive RAG: 简单直接，适合快速原型                       │
│     - Advanced RAG: 预检索+后检索优化，适合生产环境            │
│     - Modular RAG: 模块化架构，适合复杂系统                   │
│                                                             │
│  ✅ 三阶段流水线:                                            │
│     - 索引: 文档解析 → 分块 → Embedding → 存储               │
│     - 检索: 查询处理 → 向量检索 → 重排序 → 过滤              │
│     - 生成: Prompt 构建 → LLM 生成 → 后处理                  │
│                                                             │
│  ✅ 常见失败模式:                                            │
│     - 检索失败: 语义不匹配、分块切断上下文                    │
│     - 生成失败: 幻觉、忽略上下文                             │
│     - 系统失败: 延迟、成本、数据过时                          │
│                                                             │
│  ✅ RAG vs Fine-tuning:                                      │
│     - 知识密集型 → RAG                                       │
│     - 风格调整 → Fine-tuning                                 │
│     - 简单任务 → Prompt Engineering                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. 练习题

### 练习 1：理解 RAG 范式
画出 Naive RAG 和 Advanced RAG 的流程图，标注每个阶段的输入和输出。思考：在什么场景下 Naive RAG 就足够了？

### 练习 2：实现基础 RAG
使用 LangChain 或 LlamaIndex，对你自己的文档（可以是任意 txt 文件）构建一个基础 RAG 系统。尝试调整 `chunk_size` 和 `k` 值，观察对结果的影响。

### 练习 3：失败模式分析
给定以下 RAG 系统的错误日志，分析可能的失败原因并提出改进方案：
```
用户问题: "公司的年假政策是什么？"
检索结果: [关于公司文化的文档, 关于办公环境的文档, 关于员工手册的文档]
LLM 回答: "根据文档，公司注重员工的工作生活平衡..."
实际答案: 应该检索到《员工手册》中关于年假的具体条款
```

---

## 下一课

👉 [Lesson 2: 文档解析进阶 - 表格与图片](./02-文档解析进阶-表格与图片.md)

---

## 参考答案

### 练习 1：理解 RAG 范式

**思路**：Naive RAG 是最简单的线性流程，适合快速验证想法；Advanced RAG 在检索前后各加了优化层，适合生产环境提升质量。关键区别在于是否有查询预处理和后检索优化。

**答案**：

Naive RAG 流程图：
```
用户查询 ──▶ 向量检索 ──▶ Top-K 文档 ──▶ LLM 生成 ──▶ 回答
```

Advanced RAG 流程图：
```
用户查询 ──▶ 查询重写/扩展 ──▶ 向量检索 ──▶ 重排序 ──▶ 文档压缩 ──▶ LLM 生成 ──▶ 回答
```

Naive RAG 足够的场景：
- 内部 FAQ 系统：问题和文档用词高度一致，语义歧义少
- 快速原型验证：需要在几小时内验证 RAG 方案是否可行
- 文档量小（<100 篇）且查询简单的场景
- 对回答质量要求不高的 Demo 或概念验证

```python
# Naive RAG 示例：3 行核心代码
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)
result = qa_chain.invoke({"query": "用户问题"})
```

**要点**：
- Naive RAG 是"查询→检索→生成"的线性管道，没有预处理和后处理优化
- Advanced RAG 增加了查询改写、混合检索、重排序、文档压缩等优化步骤
- 选型取决于数据规模、查询复杂度和质量要求——小规模简单场景用 Naive RAG 即可

---

### 练习 2：实现基础 RAG

**思路**：使用 LangChain 的 `RecursiveCharacterTextSplitter` 和 `Chroma` 构建完整 RAG 管道。重点观察 chunk_size 和 k 值对检索结果的影响——chunk_size 越大上下文越完整但检索越粗，k 值越大召回越多但可能引入噪声。

**答案**：

```python
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain.chains import RetrievalQA

# 1. 加载文档
loader = TextLoader("my_document.txt", encoding="utf-8")
documents = loader.load()

# 2. 分块（尝试不同参数）
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50,
    separators=["\n\n", "\n", "。", "，", " "]
)
chunks = text_splitter.split_documents(documents)

# 3. 创建向量库
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = Chroma.from_documents(chunks, embeddings)

# 4. 检索 + 生成
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
qa = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=vectorstore.as_retriever(search_kwargs={"k": 3}),
    return_source_documents=True
)

# 5. 测试不同参数组合
for chunk_size in [200, 500, 1000]:
    for k in [1, 3, 5]:
        # 重新分块和索引
        splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=50)
        docs = splitter.split_documents(documents)
        vs = Chroma.from_documents(docs, embeddings)
        result = vs.as_retriever(search_kwargs={"k": k}).invoke("你的测试问题")
        print(f"chunk_size={chunk_size}, k={k}: 找到 {len(result)} 个文档")
```

**要点**：
- chunk_size 从 200 增加到 1000 时，检索到的内容更完整但精度可能下降
- k 值增大能提高召回率，但过多无关文档会干扰 LLM 生成
- 建议先用 chunk_size=500、k=3 作为基线，再根据实际效果微调

---

### 练习 3：失败模式分析

**思路**：从错误日志看，检索阶段返回了相关度较低的文档（公司文化、办公环境），而真正包含年假政策的《员工手册》没有被检索到。这是典型的"语义不匹配"失败模式——用户的查询用词（"年假政策"）和文档中的表述可能不同。

**答案**：

失败原因分析：
1. **检索失败（主因）**：查询"年假政策"与文档中"带薪休假制度""年假天数规定"等表述存在语义差距，embedding 模型未能捕捉到这种关联
2. **分块问题**：《员工手册》中关于年假的条款可能被切分到不同块中，单独的块缺乏"年假政策"的完整语义
3. **Top-K 不足**：k=3 可能不够，相关文档排在第 4-5 位被截断

改进方案：

```python
# 方案 1：查询改写 — 扩展同义词
def rewrite_query(query: str) -> list[str]:
    synonyms = {
        "年假": ["带薪休假", "年休假", "假期", "休假制度"],
        "政策": ["规定", "制度", "条款", "办法"],
    }
    expanded = [query]
    for key, values in synonyms.items():
        if key in query:
            for v in values:
                expanded.append(query.replace(key, v))
    return expanded

# 方案 2：增大 k 值 + 重排序
retriever = vectorstore.as_retriever(search_kwargs={"k": 10})

# 方案 3：添加元数据过滤 — 优先搜索《员工手册》
retriever = vectorstore.as_retriever(
    search_kwargs={"k": 5, "filter": {"source": "员工手册.pdf"}}
)
```

**要点**：
- 语义不匹配是 RAG 最常见的检索失败模式，查询改写能有效缓解
- 元数据过滤（指定文档来源）是最直接的解决方案
- 建立评估基线：用已知正确答案的查询测试检索效果，量化 Recall@K
