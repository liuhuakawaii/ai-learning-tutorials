# 05 - 层级检索（Hierarchical Retrieval）

> Stage 3 Lesson 5 | 前置要求：Lesson 04 完成 | 时长：50 分钟

```
╔══════════════════════════════════════════════════════════════╗
║          层级检索: 从粗到细的逐层筛选                          ║
║                                                              ║
║    "先看森林，再看树木，最后看叶片"                            ║
╚══════════════════════════════════════════════════════════════╝
```

## 场景引入

你的企业知识库有 10 万份文档，直接对全量文档做向量检索的延迟已经超过了 500ms，而且返回的结果质量在下降——太多"大致相关"的文档淹没了真正精确的答案。你需要一种"先粗筛再精排"的策略：先快速定位到最可能相关的文档集合，再在这个小范围内做精细检索。层级检索通过构建文档摘要索引、章节索引和段落索引的多层结构，实现了从粗到细的逐层筛选。

## 🎯 学习目标

完成本课后，你将能够：

1. 理解层级索引的结构与优势
2. 实现文档级 / 章节级 / 块级的多层检索
3. 构建 RAPTOR 风格的树状摘要检索
4. 针对长文档场景优化检索效果

---

## 1. 为什么需要层级检索？

### 1.1 扁平检索的局限

传统 RAG 将文档切分成固定大小的块，所有块处于同一层级：

```
  扁平检索的问题
  ══════════════

  文档 ──► 切块 ──► 全部混在一个向量空间 ──► 检索

  ┌──────────────────────────────────────────────┐
  │              扁平向量空间                      │
  │                                              │
  │   [chunk_1] [chunk_2] [chunk_3] [chunk_4]   │
  │   [chunk_5] [chunk_6] [chunk_7] [chunk_8]   │
  │   [chunk_9] [chunk_10] [chunk_11] [chunk_12] │
  │                                              │
  │   所有块平等竞争，无层次结构                   │
  └──────────────────────────────────────────────┘

  问题：
  → "这篇论文的结论是什么？" 需要找到结论段落，但语义相近的块太多
  → "总结第3章" 需要先定位第3章，再找到所有属于它的块
  → 长文档（100+页）切出数百个块，检索精度急剧下降
```

**核心痛点**：

- **缺乏上下文**：每个块是孤立的，丢失了文档的组织结构
- **全局问题难回答**：如"总结全文"需要聚合大量块，效果差
- **长文档检索退化**：块数量过多时，top-k 只能覆盖冰山一角

### 1.2 层级检索的核心思想

> **构建多层级索引，从粗粒度到细粒度逐层缩小范围，
> 先定位"在哪一章"，再定位"在哪一段"，最后找到"哪个句子"。**

```
  层级检索 vs 扁平检索
  ════════════════════

  扁平检索:
  问题 ──► 在 N 个块中直接搜索 top-k ──► 结果

  层级检索:
  问题 ──► 在文档级索引中定位 ──► 在章节级索引中细化 ──► 在块级索引中精确匹配
               粗筛                    中筛                     精筛
           (10 个文档)            (3 个章节)              (5 个块)
```

---

## 2. 层级索引结构

### 2.1 三层索引架构

```
  层级索引结构
  ════════════

                    ┌─────────────────┐
                    │    文档级索引     │  ← 最粗粒度
                    │  Document Level  │     摘要向量
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ 章节级索引 │   │ 章节级索引 │   │ 章节级索引 │  ← 中粒度
        │ Section 1 │   │ Section 2 │   │ Section 3 │     标题+摘要向量
        └─────┬────┘   └─────┬────┘   └─────┬────┘
              │              │              │
         ┌────┼────┐    ┌───┼────┐    ┌────┼────┐
         ▼    ▼    ▼    ▼   ▼    ▼    ▼    ▼    ▼
       [C1] [C2] [C3] [C4][C5] [C6] [C7] [C8] [C9]  ← 最细粒度
                                                     Chunk Level
                                                     原始文本向量

  检索路径:
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ 文档筛选  │────►│ 章节筛选  │────►│ 块检索   │────► 最终结果
  │ top-3 doc │     │ top-2 sec │     │ top-5 chk │
  └──────────┘     └──────────┘     └──────────┘
```

### 2.2 各层级存储内容

```
  ┌──────────────┬───────────────────────────────────────┐
  │ 层级          │ 存储内容                               │
  ├──────────────┼───────────────────────────────────────┤
  │ 文档级        │ 文档摘要向量 + 元数据（标题、作者、日期） │
  │ (Document)    │ 用于快速定位"哪些文档可能有答案"         │
  ├──────────────┼───────────────────────────────────────┤
  │ 章节级        │ 章节标题向量 + 章节摘要                  │
  │ (Section)     │ 用于定位"文档中的哪个部分"               │
  ├──────────────┼───────────────────────────────────────┤
  │ 块级          │ 原始文本块向量 + 块内容                  │
  │ (Chunk)       │ 用于精确匹配"具体答案"                  │
  └──────────────┴───────────────────────────────────────┘
```

---

## 3. 代码实现：多层级索引

### 3.1 环境准备

```python
"""
层级检索系统实现
Stage 3 - Lesson 05
"""

import os
from typing import Optional
from dataclasses import dataclass, field
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter

os.environ["OPENAI_API_KEY"] = "your-api-key-here"

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
```

### 3.2 多层级索引构建器

```python
@dataclass
class HierarchicalIndex:
    """三层层级索引"""
    doc_store: Chroma          # 文档级
    section_store: Chroma      # 章节级
    chunk_store: Chroma        # 块级
    doc_summaries: dict = field(default_factory=dict)
    section_summaries: dict = field(default_factory=dict)


def generate_summary(text: str, level: str) -> str:
    """使用 LLM 生成摘要"""
    prompt = ChatPromptTemplate.from_messages([
        ("system", "你是一个文档摘要专家。请用 2-3 句话概括以下内容的要点。"),
        ("human", f"请为以下{level}内容生成摘要：\n\n{text[:3000]}"),
    ])
    chain = prompt | llm
    return chain.invoke({}).content


def build_hierarchical_index(documents: list[Document]) -> HierarchicalIndex:
    """
    构建三层层级索引

    流程:
    1. 按文档生成摘要 → 文档级索引
    2. 按章节切分 → 生成章节摘要 → 章节级索引
    3. 按块切分 → 块级索引
    """
    # === 第1层：文档级 ===
    doc_summaries = {}
    doc_summary_docs = []
    for i, doc in enumerate(documents):
        summary = generate_summary(doc.page_content, "文档")
        doc_summaries[i] = summary
        doc_summary_docs.append(Document(
            page_content=summary,
            metadata={"doc_id": i, "source": doc.metadata.get("source", "")},
        ))

    doc_store = Chroma.from_documents(
        documents=doc_summary_docs,
        embedding=embeddings,
        collection_name="hier_docs",
    )

    # === 第2层：章节级 ===
    section_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        separators=["\n## ", "\n### ", "\n\n", "\n"],
    )
    section_summaries = {}
    section_docs = []
    section_id = 0
    for doc_idx, doc in enumerate(documents):
        sections = section_splitter.split_documents([doc])
        for sec in sections:
            summary = generate_summary(sec.page_content, "章节")
            section_summaries[section_id] = summary
            section_docs.append(Document(
                page_content=summary,
                metadata={"doc_id": doc_idx, "section_id": section_id},
            ))
            section_id += 1

    section_store = Chroma.from_documents(
        documents=section_docs,
        embedding=embeddings,
        collection_name="hier_sections",
    )

    # === 第3层：块级 ===
    chunk_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
    )
    chunk_docs = chunk_splitter.split_documents(documents)
    for i, chunk in enumerate(chunk_docs):
        chunk.metadata["chunk_id"] = i

    chunk_store = Chroma.from_documents(
        documents=chunk_docs,
        embedding=embeddings,
        collection_name="hier_chunks",
    )

    return HierarchicalIndex(
        doc_store=doc_store,
        section_store=section_store,
        chunk_store=chunk_store,
        doc_summaries=doc_summaries,
        section_summaries=section_summaries,
    )
```

### 3.3 层级检索器

```python
class HierarchicalRetriever:
    """从粗到细的层级检索器"""

    def __init__(self, index: HierarchicalIndex):
        self.index = index

    def retrieve(
        self,
        query: str,
        top_docs: int = 3,
        top_sections: int = 5,
        top_chunks: int = 5,
    ) -> list[Document]:
        """
        三层逐级检索

        1. 文档级：找到最相关的 top_docs 个文档
        2. 章节级：在这些文档的章节中找 top_sections 个
        3. 块级：在这些章节的块中找 top_chunks 个
        """
        # 第1层：文档级粗筛
        doc_results = self.index.doc_store.similarity_search(
            query, k=top_docs
        )
        relevant_doc_ids = {d.metadata["doc_id"] for d in doc_results}

        # 第2层：章节级中筛
        section_results = self.index.section_store.similarity_search(
            query, k=top_sections * 2  # 多取一些，后面过滤
        )
        relevant_sections = [
            s for s in section_results
            if s.metadata["doc_id"] in relevant_doc_ids
        ][:top_sections]
        relevant_section_ids = {s.metadata["section_id"] for s in relevant_sections}

        # 第3层：块级精筛
        chunk_results = self.index.chunk_store.similarity_search(
            query, k=top_chunks * 3  # 多取，后面按章节过滤
        )
        # 这里简化处理：直接返回 top_chunks 个块
        # 实际项目中可以按 section 归属进一步过滤
        final_chunks = chunk_results[:top_chunks]

        return final_chunks
```

### 3.4 使用示例

```python
# 构建索引
documents = [
    Document(page_content="...很长的技术文档...", metadata={"source": "tech_report.pdf"}),
    Document(page_content="...产品说明书...", metadata={"source": "product_manual.pdf"}),
]

index = build_hierarchical_index(documents)

# 层级检索
retriever = HierarchicalRetriever(index)
results = retriever.retrieve("什么是向量数据库的索引优化？")

for doc in results:
    print(f"[{doc.metadata['source']}] {doc.page_content[:100]}...")
```

---

## 4. RAPTOR 风格树状检索

### 4.1 RAPTOR 核心思想

RAPTOR（Recursive Abstractive Processing for Tree-Organized Retrieval）由 Stanford 提出，
核心是**自底向上递归摘要，构建树状索引**：

```
  RAPTOR 树状结构
  ═══════════════

  Level 3 (根):    ┌──────────────────────────────┐
                   │  全文摘要: 本文研究了...       │
                   └──────────────┬───────────────┘
                                  │
  Level 2:         ┌──────────────┼──────────────┐
                   ▼              ▼              ▼
              ┌─────────┐   ┌─────────┐   ┌─────────┐
              │ 摘要 A   │   │ 摘要 B   │   │ 摘要 C   │
              │ 第1-3章  │   │ 第4-6章  │   │ 第7-9章  │
              └────┬────┘   └────┬────┘   └────┬────┘
                   │              │              │
  Level 1:    ┌────┼────┐   ┌────┼────┐   ┌────┼────┐
              ▼    ▼    ▼   ▼    ▼    ▼   ▼    ▼    ▼
            [C1] [C2] [C3][C4] [C5] [C6][C7] [C8] [C9]

  Level 0 (叶):    原始文本块

  检索时所有层级的节点都在同一个向量空间中竞争
  → 高层节点适合回答概括性问题
  → 低层节点适合回答细节问题
```

### 4.2 RAPTOR 实现

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter


class RAPTORIndex:
    """RAPTOR 风格的树状摘要索引"""

    def __init__(self, max_levels: int = 3):
        self.max_levels = max_levels
        self.all_nodes: list[Document] = []  # 所有层级的节点

    def build(self, documents: list[Document]) -> Chroma:
        """构建 RAPTOR 树"""
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=50
        )
        # Level 0: 原始块
        current_level = splitter.split_documents(documents)
        for doc in current_level:
            doc.metadata["level"] = 0
        self.all_nodes.extend(current_level)

        # 逐层向上摘要
        for level in range(1, self.max_levels + 1):
            if len(current_level) <= 1:
                break

            # 每 3-5 个节点合并摘要
            grouped = self._group_nodes(current_level, group_size=4)
            next_level = []
            for group in grouped:
                combined_text = "\n\n".join([d.page_content for d in group])
                summary = self._summarize(combined_text, level)
                summary_doc = Document(
                    page_content=summary,
                    metadata={
                        "level": level,
                        "child_count": len(group),
                        "type": "summary",
                    },
                )
                next_level.append(summary_doc)
                self.all_nodes.append(summary_doc)

            current_level = next_level

        # 所有节点放入同一个向量空间
        vectorstore = Chroma.from_documents(
            documents=self.all_nodes,
            embedding=embeddings,
            collection_name="raptor_tree",
        )
        return vectorstore

    def _group_nodes(self, nodes: list, group_size: int) -> list[list]:
        """将节点分组"""
        groups = []
        for i in range(0, len(nodes), group_size):
            groups.append(nodes[i:i + group_size])
        return groups

    def _summarize(self, text: str, level: int) -> str:
        """递归摘要"""
        prompt = ChatPromptTemplate.from_messages([
            ("system", f"你正在构建第 {level} 层摘要。请用简洁的语言概括以下内容。"),
            ("human", text[:4000]),
        ])
        chain = prompt | llm
        return chain.invoke({}).content


# 使用
raptor = RAPTORIndex(max_levels=3)
raptor_store = raptor.build(documents)

# 检索时，高层节点（概括性）和低层节点（细节）同台竞争
results = raptor_store.similarity_search("文档的核心结论是什么？", k=5)
```

---

## 5. 对比：扁平检索 vs 层级检索

```
  ┌──────────────────┬──────────────────────┬──────────────────────────┐
  │ 维度              │ 扁平检索              │ 层级检索                  │
  ├──────────────────┼──────────────────────┼──────────────────────────┤
  │ 索引结构          │ 单层向量空间           │ 多层向量空间              │
  ├──────────────────┼──────────────────────┼──────────────────────────┤
  │ 构建成本          │ 低（一次切块+嵌入）    │ 高（多次嵌入+摘要生成）    │
  ├──────────────────┼──────────────────────┼──────────────────────────┤
  │ 存储开销          │ 1x                   │ 1.5x ~ 3x（含摘要节点）   │
  ├──────────────────┼──────────────────────┼──────────────────────────┤
  │ 全局问题回答      │ 差（需聚合大量块）     │ 好（高层摘要直接回答）     │
  ├──────────────────┼──────────────────────┼──────────────────────────┤
  │ 细节问题回答      │ 好（直接匹配）         │ 好（底层块精确匹配）       │
  ├──────────────────┼──────────────────────┼──────────────────────────┤
  │ 长文档支持        │ 差（块数过多退化）     │ 好（逐层缩小范围）         │
  ├──────────────────┼──────────────────────┼──────────────────────────┤
  │ 上下文完整性      │ 丢失文档结构           │ 保留层级关系              │
  ├──────────────────┼──────────────────────┼──────────────────────────┤
  │ 适用场景          │ 短文档、简单问答       │ 长文档、复杂分析           │
  └──────────────────┴──────────────────────┴──────────────────────────┘
```

---

## 6. 常见误区

### ❌ 错误 1：层级过多导致摘要失真

```
问题：设置了 5+ 层递归摘要，高层摘要已经丢失关键信息。

解决方案：通常 2-3 层足够，每层摘要应保留关键实体和数字。
```

### ❌ 错误 2：粗筛阶段遗漏重要文档

```
问题：文档级摘要质量差，导致正确文档在第一层就被过滤掉了。

解决方案：
- 提高粗筛的 top-k（宁可多选，不可遗漏）
- 使用多个检索路径（摘要 + 标题 + 关键词）做融合
```

### ❌ 错误 3：忽略块之间的父子关系

```
问题：层级索引只做了检索，但返回结果时没有附带上下文。

解决方案：检索到块后，返回其所属章节的摘要作为上下文前缀。
```

### ❌ 错误 4：RAPTOR 树构建时分组不合理

```
问题：固定分组大小，导致语义不相关的块被合并摘要。

解决方案：先做聚类（如 KMeans），再对同一簇内的节点做摘要。
```

---

## 工程建议

1. **摘要层的质量决定检索精度**：文档摘要是层级检索的第一道关卡。如果摘要不够准确或信息量不足，正确的文档可能在第一层就被过滤掉了。建议用 LLM 生成高质量摘要，而不是简单截取前几段。
2. **根据数据规模决定层级数量**：文档量少于 1000 份时，两层（摘要→段落）通常足够。文档量超过 10 万份时，考虑三层（摘要→章节→段落）甚至四层结构。
3. **层级索引的构建要离线完成**：构建摘要索引和章节索引是计算密集型操作，应该在离线批处理中完成，不要在查询时实时构建。
4. **设置每层的候选数量上限**：摘要层返回 Top-20，章节层返回 Top-10，段落层返回 Top-5。这些参数需要根据你的数据特征调优，但先用这些默认值建立基线。

---

## 📝 本课总结

```
  层级检索要点
  ════════════

  1. 核心思想：从粗到细逐层筛选，兼顾全局和细节
  2. 三层索引：文档级（摘要） → 章节级（标题+摘要） → 块级（原文）
  3. RAPTOR：自底向上递归摘要，所有层级节点在同一空间竞争
  4. 长文档场景收益最大，短文档不一定值得额外构建成本
  5. 粗筛宁宽勿窄，避免在第一层丢失正确答案
```

---

## 🏋️ 练习

### 练习 1：基础层级索引

使用本课代码，对一份 10 页以上的 PDF 文档构建三层索引。
对比扁平检索和层级检索在同一组问题上的表现差异。

### 练习 2：RAPTOR 聚类增强

在 RAPTOR 实现中加入 KMeans 聚类步骤：
- 对 Level 0 的块做嵌入
- 用 KMeans 分成 k 个簇
- 对每个簇内的块做摘要生成 Level 1
- 对比聚类分组 vs 固定分组的检索效果

### 练习 3：混合检索策略

实现一个混合策略：
- 概括性问题（"总结全文"）→ 使用高层节点
- 细节问题（"某个具体参数"）→ 使用底层节点
- 用 LLM 判断问题类型，路由到不同层级的检索结果

---

## 参考答案

### 练习 1：基础层级索引

**思路**：使用课程中的三层索引代码处理一份长 PDF，分别用扁平检索和层级检索回答同一组问题，对比两者的召回率和答案质量差异。

**答案**：

```python
import fitz  # PyMuPDF
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


def load_pdf_as_documents(pdf_path: str) -> list[Document]:
    """加载 PDF 为 Document 列表"""
    doc = fitz.open(pdf_path)
    documents = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text().strip()
        if text:
            documents.append(Document(
                page_content=text,
                metadata={"source": pdf_path, "page": page_num + 1},
            ))
    doc.close()
    return documents


# 加载文档
documents = load_pdf_as_documents("long_technical_report.pdf")
print(f"加载了 {len(documents)} 页文档")

# === 方案 1: 扁平检索 ===
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
flat_chunks = splitter.split_documents(documents)
flat_store = Chroma.from_documents(flat_chunks, embeddings, collection_name="flat")

# === 方案 2: 层级检索 ===
hier_index = build_hierarchical_index(documents)
hier_retriever = HierarchicalRetriever(hier_index)

# 测试问题
test_questions = [
    "这份报告的核心结论是什么？",           # 概括性问题
    "第 3 章中提到的具体性能参数是多少？",    # 细节问题
    "报告中提到了哪些技术方案的对比？",       # 中等粒度
    "作者对未来趋势的预测是什么？",          # 概括性
    "表格 2 中的数据分别是多少？",           # 细节
]

print("\n" + "=" * 70)
print("📊 扁平检索 vs 层级检索 对比")
print("=" * 70)

for q in test_questions:
    print(f"\n❓ 问题: {q}")
    print("-" * 50)

    # 扁平检索
    flat_results = flat_store.similarity_search(q, k=5)
    flat_context = "\n---\n".join([d.page_content[:200] for d in flat_results])

    # 层级检索
    hier_results = hier_retriever.retrieve(q, top_docs=2, top_sections=3, top_chunks=5)
    hier_context = "\n---\n".join([d.page_content[:200] for d in hier_results])

    # 用 LLM 评估哪个更好
    eval_prompt = ChatPromptTemplate.from_template(
        """比较两种检索结果对问题的回答质量。

问题: {question}

检索结果 A (扁平检索):
{context_a}

检索结果 B (层级检索):
{context_b}

哪个结果更可能包含完整的答案？只回答 A 或 B，并简要说明原因。"""
    )
    chain = eval_prompt | llm
    comparison = chain.invoke({
        "question": q,
        "context_a": flat_context,
        "context_b": hier_context,
    }).content
    print(f"  对比结果: {comparison}")
```

**要点**：
- 概括性问题（如"核心结论"）层级检索明显优于扁平检索，因为高层摘要直接包含了全文概括
- 细节问题两者表现接近，但层级检索通过先定位文档再定位章节再定位段落，减少了噪声干扰
- 建议至少用 10 页以上的 PDF 测试，短文档中扁平检索已经足够好，层级检索的优势不明显

---

### 练习 2：RAPTOR 聚类增强

**思路**：在 RAPTOR 的 Level 0 块嵌入后，用 KMeans 聚类替代固定分组，使同一语义簇的块被合并摘要，避免语义不相关的内容被混在一起。

**答案**：

```python
from sklearn.cluster import KMeans
import numpy as np


class RAPTORWithClustering(RAPTORIndex):
    """带 KMeans 聚类的 RAPTOR 索引"""

    def __init__(self, max_levels: int = 3, n_clusters_ratio: float = 0.25):
        super().__init__(max_levels)
        self.n_clusters_ratio = n_clusters_ratio  # 每层聚类数 = 节点数 * ratio

    def build(self, documents: list[Document]) -> Chroma:
        """构建带聚类的 RAPTOR 树"""
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=50
        )
        # Level 0: 原始块
        current_level = splitter.split_documents(documents)
        for doc in current_level:
            doc.metadata["level"] = 0
        self.all_nodes.extend(current_level)

        # 逐层向上摘要
        for level in range(1, self.max_levels + 1):
            if len(current_level) <= 1:
                break

            # 对当前层做嵌入
            texts = [d.page_content for d in current_level]
            embeddings_matrix = embeddings.embed_documents(texts)
            embeddings_array = np.array(embeddings_matrix)

            # KMeans 聚类
            n_clusters = max(2, int(len(current_level) * self.n_clusters_ratio))
            n_clusters = min(n_clusters, len(current_level))
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = kmeans.fit_predict(embeddings_array)

            # 按簇分组
            clusters: dict[int, list[Document]] = {}
            for idx, label in enumerate(labels):
                clusters.setdefault(label, []).append(current_level[idx])

            # 对每个簇生成摘要
            next_level = []
            for cluster_id, group in clusters.items():
                combined_text = "\n\n".join([d.page_content for d in group])
                summary = self._summarize(combined_text, level)
                summary_doc = Document(
                    page_content=summary,
                    metadata={
                        "level": level,
                        "child_count": len(group),
                        "cluster_id": int(cluster_id),
                        "type": "summary",
                    },
                )
                next_level.append(summary_doc)
                self.all_nodes.append(summary_doc)

            current_level = next_level

        # 所有节点放入同一个向量空间
        vectorstore = Chroma.from_documents(
            documents=self.all_nodes,
            embedding=embeddings,
            collection_name="raptor_clustered",
        )
        return vectorstore


# 使用示例
raptor = RAPTORWithClustering(max_levels=3, n_clusters_ratio=0.25)
raptor_store = raptor.build(documents)

# 对比测试
test_queries = [
    "这份文档的核心结论是什么？",   # 概括性
    "第三章提到的具体数据是多少？",  # 细节性
    "文档中提到了哪些技术方案？",   # 列举性
]

for q in test_queries:
    results = raptor_store.similarity_search(q, k=5)
    print(f"\n问题: {q}")
    for r in results:
        level = r.metadata.get("level", 0)
        print(f"  [Level {level}] {r.page_content[:100]}...")
```

**要点**：
- `n_clusters_ratio` 控制聚类粒度，0.25 表示每层节点数约为上层的 1/4，可根据文档结构调整
- 聚类分组比固定分组的优势在于：语义相近的块会被合并，摘要质量更高，检索时更精准
- 每个摘要节点的 metadata 中记录 `cluster_id` 和 `child_count`，便于调试和回溯

---

### 练习 3：混合检索策略

**思路**：用 LLM 判断问题的粒度类型（概括性/细节性），路由到不同层级的检索结果。概括性问题使用高层摘要节点，细节性问题使用底层原文节点，混合问题同时检索多层结果。

**答案**：

```python
from typing import Literal
from langchain_core.documents import Document


class HybridHierarchicalRetriever:
    """混合层级检索器：根据问题类型路由到不同层级"""

    def __init__(self, raptor_store: Chroma, llm):
        self.raptor_store = raptor_store
        self.llm = llm

    def retrieve(self, query: str, top_k: int = 5) -> list[Document]:
        """根据问题类型选择检索层级"""
        query_type = self._classify_query(query)
        print(f"问题类型: {query_type}")

        if query_type == "summary":
            return self._retrieve_by_level(query, target_levels=[2, 3], top_k=top_k)
        elif query_type == "detail":
            return self._retrieve_by_level(query, target_levels=[0], top_k=top_k)
        else:
            # 混合：从所有层级检索，按相关性排序
            return self._retrieve_all_levels(query, top_k=top_k)

    def _classify_query(
        self, query: str
    ) -> Literal["summary", "detail", "mixed"]:
        """判断问题的粒度类型"""
        prompt = ChatPromptTemplate.from_template(
            """判断以下问题的粒度类型:
- summary: 需要全文概括、整体趋势、核心结论（如"总结全文"、"主要发现是什么"）
- detail: 需要具体数据、某个参数、特定事实（如"表格 3 的数据"、"第几页提到"）
- mixed: 需要既有概括又有具体信息（如"技术方案的优缺点对比"）

问题: {query}

只回答 summary、detail 或 mixed。"""
        )
        chain = prompt | self.llm
        result = chain.invoke({"query": query}).content.strip().lower()
        if result in ("summary", "detail", "mixed"):
            return result
        return "mixed"

    def _retrieve_by_level(
        self, query: str, target_levels: list[int], top_k: int
    ) -> list[Document]:
        """检索指定层级的节点"""
        results = self.raptor_store.similarity_search(query, k=top_k * 3)
        filtered = [
            r for r in results
            if r.metadata.get("level", 0) in target_levels
        ][:top_k]
        if not filtered:
            return results[:top_k]
        return filtered

    def _retrieve_all_levels(self, query: str, top_k: int) -> list[Document]:
        """从所有层级检索，按相关性混合排序"""
        return self.raptor_store.similarity_search(query, k=top_k)

    def query(self, question: str) -> str:
        """端到端查询：检索 + 生成"""
        docs = self.retrieve(question)
        context = "\n\n".join([
            f"[Level {d.metadata.get('level', 0)}] {d.page_content}"
            for d in docs
        ])
        prompt = ChatPromptTemplate.from_template(
            "基于以下检索结果回答问题。结果来自不同层级的摘要和原文。\n\n"
            "检索结果:\n{context}\n\n问题: {question}\n\n请给出准确的回答:"
        )
        chain = prompt | self.llm
        return chain.invoke({"context": context, "question": question}).content


# 使用示例
raptor = RAPTORIndex(max_levels=3)
raptor_store = raptor.build(documents)

retriever = HybridHierarchicalRetriever(raptor_store, llm)

# 概括性问题 → 高层节点
print(retriever.query("这份报告的核心结论是什么？"))

# 细节问题 → 底层节点
print(retriever.query("表 2 中第 3 行的性能指标是多少？"))

# 混合问题 → 多层融合
print(retriever.query("比较文档中提到的三种技术方案的优缺点"))
```

**要点**：
- 问题分类的 prompt 要给出明确的例子（如"总结全文"是 summary，"表格数据"是 detail），否则 LLM 判断不稳定
- `_retrieve_by_level` 多取 3 倍候选再按层级过滤，避免过滤后结果不足 top_k
- 混合问题不硬分层级，让所有层级节点同台竞争，由向量相似度自然决定排序
