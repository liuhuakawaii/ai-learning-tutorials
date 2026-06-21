# 02 - GraphRAG 知识图谱增强

> Stage 3 Lesson 2 | 前置要求：Lesson 01 完成 | 时长：60 分钟

```
╔══════════════════════════════════════════════════════════════╗
║          GraphRAG: 用知识图谱连接世界的碎片                   ║
║                                                              ║
║    "向量检索找到相似的句子，图谱检索找到相关的关系"           ║
╚══════════════════════════════════════════════════════════════╝
```

## 🎯 学习目标

完成本课后，你将能够：

1. 理解 GraphRAG 的整体架构和设计思想
2. 使用 LLM 从非结构化文本中抽取实体和关系
3. 使用 NetworkX 构建和操作知识图谱
4. 实现社区检测和图聚类
5. 对比 Local Search 和 Global Search 两种图检索策略

---

## 1. 为什么需要 GraphRAG？

### 1.1 向量检索的局限

传统向量检索基于语义相似度，擅长找"说同样话题"的段落，但在以下场景力不从心：

```
  向量检索的盲区
  ══════════════

  问题: "A 公司的 CEO 毕业于哪所大学？"

  向量检索结果:
  ┌──────────────────────────────────────────────────┐
  │ [相似度 0.92] A 公司是一家科技巨头...              │  ← 说了公司，没提CEO
  │ [相似度 0.89] A 公司的营收去年增长了 30%...       │  ← 无关信息
  │ [相似度 0.85] B 大学是世界顶尖学府...             │  ← 说了大学，没提关系
  └──────────────────────────────────────────────────┘

  图谱检索结果:
  ┌──────────────────────────────────────────────────┐
  │ A公司 ──[CEO]──► 张三 ──[毕业于]──► B大学         │  ← 精准命中!
  └──────────────────────────────────────────────────┘
```

### 1.2 GraphRAG 的核心思想

GraphRAG 由 Microsoft Research (2024) 提出，核心流程：

1. **从文本中抽取知识图谱**（实体、关系、社区）
2. **构建层级化社区摘要**（从局部到全局）
3. **利用图结构增强检索**（Local Search / Global Search）

```
  GraphRAG Pipeline
  ═════════════════

  ┌───────────────────────────────────────────────────────────────┐
  │                    GraphRAG 完整管道                          │
  │                                                               │
  │   原始文档                                                    │
  │      │                                                        │
  │      ▼                                                        │
  │   ┌─────────────────┐                                        │
  │   │  实体/关系抽取    │ ◄── LLM 提取                          │
  │   └────────┬────────┘                                        │
  │            │                                                  │
  │            ▼                                                  │
  │   ┌─────────────────┐                                        │
  │   │  知识图谱构建    │ ◄── NetworkX                          │
  │   └────────┬────────┘                                        │
  │            │                                                  │
  │            ▼                                                  │
  │   ┌─────────────────┐    ┌─────────────────┐                │
  │   │  社区检测        │───►│  社区摘要生成    │ ◄── LLM        │
  │   └────────┬────────┘    └────────┬────────┘                │
  │            │                      │                          │
  │            ▼                      ▼                          │
  │   ┌─────────────┐    ┌─────────────────┐                    │
  │   │ Local Search │    │  Global Search   │                    │
  │   │ (实体级检索)  │    │  (社区级检索)    │                    │
  │   └──────┬──────┘    └────────┬────────┘                    │
  │          │                    │                              │
  │          └────────┬───────────┘                              │
  │                   ▼                                          │
  │          ┌─────────────────┐                                 │
  │          │   答案生成       │                                 │
  │          └─────────────────┘                                 │
  └───────────────────────────────────────────────────────────────┘
```

---

## 2. 实体与关系抽取

### 2.1 LLM 抽取策略

```python
"""
GraphRAG 知识图谱增强实现
Stage 3 - Lesson 02
"""

import os
import json
from typing import TypedDict
from dataclasses import dataclass, field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

os.environ["OPENAI_API_KEY"] = "your-api-key-here"

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)


@dataclass
class Entity:
    """知识图谱实体"""
    name: str
    entity_type: str
    description: str = ""
    properties: dict = field(default_factory=dict)


@dataclass
class Relationship:
    """知识图谱关系"""
    source: str
    target: str
    relation_type: str
    description: str = ""
    weight: float = 1.0


@dataclass
class ExtractionResult:
    """抽取结果"""
    entities: list[Entity]
    relationships: list[Relationship]
```

### 2.2 实体抽取 Prompt

```python
ENTITY_EXTRACTION_PROMPT = ChatPromptTemplate.from_template(
    """你是一个专业的知识图谱实体和关系抽取系统。
从以下文本中抽取所有重要的实体及其关系。

文本:
{text}

请以 JSON 格式输出，格式如下:
{{
    "entities": [
        {{
            "name": "实体名称",
            "type": "实体类型(人物/组织/地点/技术/概念/事件)",
            "description": "一句话描述"
        }}
    ],
    "relationships": [
        {{
            "source": "源实体名称",
            "target": "目标实体名称",
            "type": "关系类型",
            "description": "关系描述"
        }}
    ]
}}

注意:
1. 实体名称要标准化（同一实体保持一致）
2. 关系类型要简洁明了
3. 不要遗漏重要实体和关系
4. 只输出 JSON，不要其他内容"""
)


def extract_entities_and_relations(text: str) -> ExtractionResult:
    """从文本中抽取实体和关系"""
    chain = ENTITY_EXTRACTION_PROMPT | llm | StrOutputParser()
    result = chain.invoke({"text": text})

    # 清理 JSON 输出
    result = result.strip()
    if result.startswith("```"):
        result = result.split("\n", 1)[1]
        result = result.rsplit("```", 1)[0]

    data = json.loads(result)

    entities = [
        Entity(
            name=e["name"],
            entity_type=e["type"],
            description=e.get("description", ""),
        )
        for e in data.get("entities", [])
    ]

    relationships = [
        Relationship(
            source=r["source"],
            target=r["target"],
            relation_type=r["type"],
            description=r.get("description", ""),
        )
        for r in data.get("relationships", [])
    ]

    return ExtractionResult(entities=entities, relationships=relationships)
```

---

## 3. 知识图谱构建

### 3.1 使用 NetworkX 构建图谱

```python
import networkx as nx
import matplotlib.pyplot as plt


class KnowledgeGraph:
    """知识图谱管理器"""

    def __init__(self):
        self.graph = nx.DiGraph()
        self.entities: dict[str, Entity] = {}

    def add_entity(self, entity: Entity):
        """添加实体"""
        if entity.name in self.entities:
            # 合并信息
            existing = self.entities[entity.name]
            if entity.description:
                existing.description = entity.description
        else:
            self.entities[entity.name] = entity
            self.graph.add_node(
                entity.name,
                entity_type=entity.entity_type,
                description=entity.description,
            )

    def add_relationship(self, rel: Relationship):
        """添加关系"""
        self.graph.add_edge(
            rel.source,
            rel.target,
            relation_type=rel.relation_type,
            description=rel.description,
            weight=rel.weight,
        )

    def build_from_extraction(self, extraction: ExtractionResult):
        """从抽取结果构建图谱"""
        for entity in extraction.entities:
            self.add_entity(entity)
        for rel in extraction.relationships:
            self.add_relationship(rel)

    def build_from_documents(self, documents: list[str]):
        """从多个文档构建图谱"""
        for doc in documents:
            extraction = extract_entities_and_relations(doc)
            self.build_from_extraction(extraction)

    def get_entity_neighbors(self, entity_name: str, depth: int = 1) -> dict:
        """获取实体的邻居节点"""
        if entity_name not in self.graph:
            return {"error": f"Entity '{entity_name}' not found"}

        neighbors = {"outgoing": [], "incoming": []}

        # 出边（该实体作为主体）
        for _, target, data in self.graph.out_edges(entity_name, data=True):
            neighbors["outgoing"].append({
                "target": target,
                "relation": data.get("relation_type", "related"),
            })

        # 入边（该实体作为客体）
        for source, _, data in self.graph.in_edges(entity_name, data=True):
            neighbors["incoming"].append({
                "source": source,
                "relation": data.get("relation_type", "related"),
            })

        return neighbors

    def find_paths(self, source: str, target: str) -> list[list[str]]:
        """查找两个实体之间的路径"""
        try:
            paths = list(nx.all_simple_paths(
                self.graph, source, target, cutoff=3
            ))
            return paths
        except (nx.NetworkXError, nx.NodeNotFound):
            return []

    def visualize(self, figsize=(12, 8)):
        """可视化知识图谱"""
        plt.figure(figsize=figsize)
        pos = nx.spring_layout(self.graph, k=2, iterations=50)

        # 节点颜色映射
        type_colors = {
            "人物": "#FF6B6B",
            "组织": "#4ECDC4",
            "地点": "#45B7D1",
            "技术": "#96CEB4",
            "概念": "#FFEAA7",
            "事件": "#DDA0DD",
        }

        node_colors = []
        for node in self.graph.nodes():
            entity_type = self.graph.nodes[node].get("entity_type", "概念")
            node_colors.append(type_colors.get(entity_type, "#CCCCCC"))

        nx.draw_networkx_nodes(
            self.graph, pos, node_color=node_colors,
            node_size=2000, alpha=0.9,
        )
        nx.draw_networkx_labels(
            self.graph, pos, font_size=10, font_family="sans-serif",
        )
        nx.draw_networkx_edges(
            self.graph, pos, edge_color="#888888",
            arrows=True, arrowsize=20,
        )

        # 边标签
        edge_labels = {
            (u, v): d.get("relation_type", "")
            for u, v, d in self.graph.edges(data=True)
        }
        nx.draw_networkx_edge_labels(self.graph, pos, edge_labels)

        plt.title("Knowledge Graph", fontsize=16)
        plt.axis("off")
        plt.tight_layout()
        plt.savefig("knowledge_graph.png", dpi=150, bbox_inches="tight")
        plt.show()

    def get_stats(self) -> dict:
        """获取图谱统计信息"""
        return {
            "num_entities": self.graph.number_of_nodes(),
            "num_relationships": self.graph.number_of_edges(),
            "entity_types": dict(
                self._count_entity_types()
            ),
            "avg_degree": (
                sum(dict(self.graph.degree()).values())
                / max(self.graph.number_of_nodes(), 1)
            ),
        }

    def _count_entity_types(self):
        """统计实体类型分布"""
        from collections import Counter
        types = Counter()
        for _, data in self.graph.nodes(data=True):
            types[data.get("entity_type", "未知")] += 1
        return types
```

---

## 4. 社区检测与摘要

### 4.1 社区检测

```python
from networkx.algorithms import community


class CommunityDetector:
    """社区检测器"""

    def __init__(self, graph: KnowledgeGraph):
        self.kg = graph
        self.communities: list[set] = []
        self.community_summaries: dict[int, str] = {}

    def detect_communities(self) -> list[set]:
        """检测图中的社区（使用 Louvain 算法的变体）"""
        # 将有向图转为无向图进行社区检测
        undirected = self.kg.graph.to_undirected()

        # 使用 greedy modularity 社区检测
        communities_gen = community.greedy_modularity_communities(undirected)
        self.communities = [frozenset(c) for c in communities_gen]

        print(f"检测到 {len(self.communities)} 个社区")
        for i, comm in enumerate(self.communities):
            print(f"  社区 {i}: {', '.join(sorted(comm))}")

        return self.communities

    def get_community_subgraph(self, community_id: int) -> nx.DiGraph:
        """获取社区子图"""
        if community_id >= len(self.communities):
            raise ValueError(f"社区 ID {community_id} 不存在")

        nodes = self.communities[community_id]
        return self.kg.graph.subgraph(nodes).copy()

    def generate_community_summary(self, community_id: int) -> str:
        """使用 LLM 生成社区摘要"""
        subgraph = self.get_community_subgraph(community_id)

        # 收集社区内的实体和关系
        entities_info = []
        for node in subgraph.nodes():
            node_data = subgraph.nodes[node]
            entities_info.append(
                f"- {node} ({node_data.get('entity_type', '未知')})"
            )

        relations_info = []
        for u, v, data in subgraph.edges(data=True):
            relations_info.append(
                f"- {u} --[{data.get('relation_type', '相关')}]--> {v}"
            )

        context = (
            "实体:\n" + "\n".join(entities_info) +
            "\n\n关系:\n" + "\n".join(relations_info)
        )

        summary_prompt = ChatPromptTemplate.from_template(
            """你是一个知识图谱社区摘要生成器。
请根据以下社区中的实体和关系，生成一段简洁的社区摘要。

社区信息:
{context}

要求:
1. 概括这个社区的主要主题
2. 列出关键实体和它们之间的核心关系
3. 用 2-3 句话总结

摘要:"""
        )

        chain = summary_prompt | llm | StrOutputParser()
        summary = chain.invoke({"context": context})
        self.community_summaries[community_id] = summary
        return summary

    def generate_all_summaries(self) -> dict[int, str]:
        """为所有社区生成摘要"""
        for i in range(len(self.communities)):
            self.generate_community_summary(i)
        return self.community_summaries
```

---

## 5. 图检索：Local Search vs Global Search

### 5.1 Local Search（局部检索）

Local Search 从特定实体出发，沿着图的边探索其局部邻域：

```
  Local Search 流程
  ════════════════

  问题: "张三的工作经历？"
            │
            ▼
     ┌──────────────┐
     │ 识别关键实体   │  → "张三"
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │ 从张三出发     │
     │ 遍历邻居节点   │
     └──────┬───────┘
            │
            ▼
  ┌─────────────────────────────────┐
  │  张三 ──[就职于]──► A公司       │
  │  张三 ──[毕业于]──► B大学       │
  │  张三 ──[负责]──► X项目         │
  │  A公司 ──[位于]──► 北京         │
  └─────────────────────────────────┘
            │
            ▼
     组合上下文生成答案
```

### 5.2 Global Search（全局检索）

Global Search 利用社区摘要，回答需要全局视角的问题：

```
  Global Search 流程
  ═════════════════

  问题: "AI 行业的整体发展趋势？"
            │
            ▼
     ┌──────────────┐
     │ 遍历所有社区   │
     │ 摘要          │
     └──────┬───────┘
            │
            ▼
  ┌─────────────────────────────────┐
  │ 社区0: "大模型竞争格局..."      │
  │ 社区1: "AI 芯片供应链..."       │
  │ 社区2: "AI 应用落地..."         │
  │ 社区3: "AI 监管政策..."         │
  └─────────────────────────────────┘
            │
            ▼
     聚合所有社区信息
     生成全局性答案
```

### 5.3 代码实现

```python
class GraphRetriever:
    """图检索器 - 支持 Local 和 Global 检索"""

    def __init__(
        self,
        kg: KnowledgeGraph,
        detector: CommunityDetector,
        llm,
    ):
        self.kg = kg
        self.detector = detector
        self.llm = llm

    def local_search(self, question: str, top_k: int = 5) -> str:
        """局部检索：从实体出发，探索局部邻域"""
        # Step 1: 从问题中识别关键实体
        entities = self._extract_entities_from_question(question)

        if not entities:
            return "未找到相关实体，无法进行局部检索。"

        # Step 2: 从每个实体出发，收集邻域信息
        context_parts = []
        for entity_name in entities:
            if entity_name not in self.kg.graph:
                continue

            neighbors = self.kg.get_entity_neighbors(entity_name)

            entity_info = f"【{entity_name}】\n"

            # 出边关系
            for rel in neighbors["outgoing"][:top_k]:
                entity_info += (
                    f"  → {rel['relation']} → {rel['target']}\n"
                )

            # 入边关系
            for rel in neighbors["incoming"][:top_k]:
                entity_info += (
                    f"  ← {rel['relation']} ← {rel['source']}\n"
                )

            context_parts.append(entity_info)

        if not context_parts:
            return "未找到相关信息。"

        context = "\n".join(context_parts)

        # Step 3: 基于图谱上下文生成答案
        return self._generate_answer(question, context, "local")

    def global_search(self, question: str) -> str:
        """全局检索：利用社区摘要回答全局性问题"""
        # Step 1: 确保社区摘要已生成
        if not self.detector.community_summaries:
            self.detector.generate_all_summaries()

        # Step 2: 收集所有社区摘要
        summaries = []
        for cid, summary in self.detector.community_summaries.items():
            summaries.append(f"社区 {cid}:\n{summary}")

        context = "\n\n".join(summaries)

        # Step 3: 基于全局摘要生成答案
        return self._generate_answer(question, context, "global")

    def _extract_entities_from_question(self, question: str) -> list[str]:
        """从问题中提取实体名称"""
        entity_names = list(self.kg.entities.keys())

        extract_prompt = ChatPromptTemplate.from_template(
            """从以下问题中提取实体名称。
可选实体列表: {entities}

问题: {question}

请只输出匹配到的实体名称，用逗号分隔。
如果没有匹配到任何实体，输出"无"。"""
        )

        chain = extract_prompt | self.llm | StrOutputParser()
        result = chain.invoke({
            "entities": ", ".join(entity_names),
            "question": question,
        })

        if "无" in result:
            return []

        return [name.strip() for name in result.split(",") if name.strip()]

    def _generate_answer(
        self, question: str, context: str, search_type: str,
    ) -> str:
        """基于图谱上下文生成答案"""
        type_desc = "局部实体关系" if search_type == "local" else "全局社区摘要"

        prompt = ChatPromptTemplate.from_template(
            """你是一个知识图谱问答系统。
基于以下{type_desc}信息回答用户问题。

图谱信息:
{context}

用户问题: {question}

请基于图谱信息给出准确、详细的回答。如果图谱信息不足，请明确指出。"""
        )

        chain = prompt | self.llm | StrOutputParser()
        return chain.invoke({
            "type_desc": type_desc,
            "context": context,
            "question": question,
        })
```

---

## 6. 完整 GraphRAG 系统

```python
class GraphRAG:
    """
    完整的 GraphRAG 系统

    流程: 文档 → 实体抽取 → 图谱构建 → 社区检测 → 图检索 → 答案生成
    """

    def __init__(self, llm):
        self.llm = llm
        self.kg = KnowledgeGraph()
        self.detector = CommunityDetector(self.kg)
        self.retriever = None

    def build(self, documents: list[str]):
        """从文档构建知识图谱"""
        print("📊 Step 1: 抽取实体和关系...")
        for i, doc in enumerate(documents):
            print(f"  处理文档 {i+1}/{len(documents)}...")
            extraction = extract_entities_and_relations(doc)
            self.kg.build_from_extraction(extraction)

        stats = self.kg.get_stats()
        print(f"  ✅ 抽取完成: {stats['num_entities']} 实体, "
              f"{stats['num_relationships']} 关系")

        print("\n🔍 Step 2: 检测社区...")
        self.detector.detect_communities()

        print("\n📝 Step 3: 生成社区摘要...")
        self.detector.generate_all_summaries()

        print("\n🔧 Step 4: 初始化检索器...")
        self.retriever = GraphRetriever(
            kg=self.kg,
            detector=self.detector,
            llm=self.llm,
        )

        print("\n✅ GraphRAG 构建完成!")

    def query(self, question: str, search_type: str = "auto") -> str:
        """查询 GraphRAG"""
        if self.retriever is None:
            raise RuntimeError("请先调用 build() 构建图谱")

        if search_type == "auto":
            search_type = self._decide_search_type(question)

        if search_type == "local":
            return self.retriever.local_search(question)
        else:
            return self.retriever.global_search(question)

    def _decide_search_type(self, question: str) -> str:
        """自动判断使用哪种检索策略"""
        classify_prompt = ChatPromptTemplate.from_template(
            """判断以下问题应该使用哪种检索策略:

问题: {question}

策略说明:
- local: 针对特定实体的具体问题（如"某人的工作经历"）
- global: 针对全局性、总结性问题（如"行业整体趋势"）

请只回答 [local] 或 [global]。"""
        )

        chain = classify_prompt | self.llm | StrOutputParser()
        result = chain.invoke({"question": question}).strip()

        return "global" if "global" in result else "local"


# 使用示例
def main():
    """GraphRAG 使用演示"""
    documents = [
        "OpenAI 是一家人工智能研究公司，由 Sam Altman 领导。"
        "GPT-4 是 OpenAI 最新的大语言模型。",

        "Google DeepMind 在 AI 领域也有重要贡献，"
        "Gemini 是其旗舰模型。Demis Hassabis 是 DeepMind 的 CEO。",

        "Meta AI 开源了 LLaMA 模型系列，推动了开源 AI 的发展。"
        "Yann LeCun 是 Meta 的首席 AI 科学家。",

        "AI 芯片市场由 NVIDIA 主导，其 GPU 是训练大模型的核心硬件。"
        "Jensen Huang 是 NVIDIA 的创始人兼 CEO。",
    ]

    graph_rag = GraphRAG(llm=llm)
    graph_rag.build(documents)

    # 局部检索
    print("\n" + "=" * 60)
    answer = graph_rag.query("Sam Altman 和哪些公司有关？")
    print(f"问题: Sam Altman 和哪些公司有关？")
    print(f"答案: {answer}")

    # 全局检索
    print("\n" + "=" * 60)
    answer = graph_rag.query("AI 行业的竞争格局如何？")
    print(f"问题: AI 行业的竞争格局如何？")
    print(f"答案: {answer}")


if __name__ == "__main__":
    main()
```

---

## 7. 对比分析

### Vector RAG vs GraphRAG

| 维度 | Vector RAG | GraphRAG |
|------|-----------|----------|
| **索引结构** | 向量（嵌入空间） | 知识图谱（实体-关系网络） |
| **检索方式** | 语义相似度 | 图遍历 + 社区聚合 |
| **擅长场景** | 文本相似度匹配 | 多跳推理、关系查询 |
| **全局理解** | 弱（依赖 top-k） | 强（社区摘要） |
| **构建成本** | 低（只需嵌入） | 高（需实体抽取 + 社区检测） |
| **存储开销** | 中等 | 较大（图 + 摘要） |
| **更新难度** | 简单（增量嵌入） | 复杂（需重建子图） |
| **适用数据** | 通用文本 | 关系密集型文本 |

---

## 8. 常见错误与陷阱

### ❌ 错误 1：实体名称不标准化

```python
# ❌ 错误：同一个实体有多个名字
entities = ["OpenAI", "open ai", "OPENAI", "Open AI"]

# ✅ 正确：实体名称标准化
def normalize_entity_name(name: str) -> str:
    """标准化实体名称"""
    name = name.strip()
    name = name.title()  # 首字母大写
    # 可以添加更多标准化规则
    return name
```

### ❌ 错误 2：忽略图的稀疏性

```python
# ❌ 错误：假设图总是连通的
path = nx.shortest_path(graph, source, target)  # 可能报错

# ✅ 正确：处理不连通的情况
def safe_find_path(graph, source, target):
    if not nx.has_path(graph, source, target):
        return None
    return nx.shortest_path(graph, source, target)
```

### ❌ 错误 3：社区摘要过于冗长

```python
# ❌ 错误：让 LLM 自由发挥
prompt = "请生成社区摘要"  # 可能生成很长的内容

# ✅ 正确：限制摘要长度
prompt = "请用 2-3 句话（不超过 100 字）概括社区主题"
```

---

## 📝 本课小结

```
  GraphRAG 核心要点
  ═════════════════

  ┌─────────────────────────────────────────────────────┐
  │  1. GraphRAG 用知识图谱增强检索                     │
  │     → 擅长关系查询和多跳推理                        │
  │                                                     │
  │  2. LLM 驱动实体/关系抽取                           │
  │     → 从非结构化文本构建结构化图谱                   │
  │                                                     │
  │  3. 社区检测实现层级化组织                           │
  │     → 社区摘要支持全局检索                          │
  │                                                     │
  │  4. Local Search 处理实体级问题                      │
  │     → 从实体出发遍历邻居                            │
  │                                                     │
  │  5. Global Search 处理全局性问题                     │
  │     → 聚合社区摘要生成答案                          │
  └─────────────────────────────────────────────────────┘
```

---

## 🏋️ 练习题

### 练习 1：实体类型扩展（基础）

扩展现有的实体类型，添加"产品"、"技术标准"、"法律法规"三种类型，并为每种类型设计特定的抽取 prompt。

### 练习 2：图谱持久化（进阶）

实现知识图谱的持久化存储，支持：
- 将图谱保存到 JSON 文件
- 从 JSON 文件加载图谱
- 增量更新（添加新文档时只更新受影响的子图）

### 练习 3：混合检索（挑战）

实现一个 HybridGraphRAG，结合向量检索和图检索：
- 对于简单事实问题，优先使用 Local Search
- 对于复杂推理问题，使用图路径推理
- 对于模糊问题，结合向量检索和图检索的结果

---

> 📌 **下一课**：[03 - Agentic RAG 智能检索](./03-Agentic-RAG智能检索.md) — 用 Agent 驱动智能检索
