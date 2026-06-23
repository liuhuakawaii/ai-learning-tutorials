# 课时 9：Schema Linking——让 AI 理解数据库结构的关键技术

## 场景引入

你在上一课时中用 SQLCoder 成功把自然语言转成了 SQL，但遇到一个尴尬的问题：公司数据库有 200 多张表、3000 多个列，用户问"上个月华东区的销售额是多少"，模型生成的 SQL 引用了 `sales_amount` 列——但数据库里这个字段叫 `order_total`，真正的 `sales_amount` 是一个视图字段，早就废弃了。

这不是模型能力的问题，而是**模型根本不知道你的数据库长什么样**。

NL2SQL 系统中，把用户的问题正确映射到数据库的表名、列名和具体值，这个过程叫 **Schema Linking**。它是 NL2SQL 从"能用"到"可靠"的关键瓶颈。即使是最强的大模型，在没有正确 Schema 信息的情况下，也会产生大量"幻觉 SQL"——引用不存在的表、拼错列名、混淆相似字段。

本课时将深入讲解 Schema Linking 的原理、方法和工程实现，帮助你构建一个真正能落地的 NL2SQL 系统。

## 学习目标

完成本课时后，你将能够：

1. 理解 Schema Linking 在 NL2SQL 管道中的位置和作用
2. 区分表级、列级、值级三个层次的 Schema Linking
3. 实现基于规则、基于模型和混合方法的 Schema Linking
4. 使用向量化方法构建高效的 Schema 检索系统
5. 设计动态 Schema 压缩策略，减少 token 消耗
6. 构建一个完整的 Schema Linking Pipeline

## 核心概念

### 1. 为什么 Schema Linking 是瓶颈

NL2SQL 系统的标准流程是：

```
用户问题 → Schema Linking → Prompt 构建 → LLM → SQL
```

Schema Linking 的质量直接决定后续生成 SQL 的准确性。研究表明（BIRD-SQL 基准测试，2024），Schema Linking 错误导致的 SQL 失败占比超过 **35%**，远高于 SQL 语法错误和逻辑错误。

问题的根源在于三个"不匹配"：

```
┌─────────────────────────────────────────────────────────┐
│                    三个不匹配                            │
├──────────────────┬──────────────────┬───────────────────┤
│   命名不匹配      │   粒度不匹配      │   值域不匹配      │
│                  │                  │                   │
│ 用户说"销售额"    │ 用户说"区域"      │ 用户说"华东"      │
│ DB 里叫          │ DB 里可能是       │ DB 里存的是        │
│ order_total      │ province + city  │ "east_china"      │
│                  │ 的组合            │                   │
└──────────────────┴──────────────────┴───────────────────┘
```

### 2. Schema Linking 的三个层次

Schema Linking 不是一个单一步骤，而是三个递进的层次：

```
┌────────────────────────────────────────────────────────┐
│                 Schema Linking 三层次                    │
│                                                        │
│  Level 1: 表级 Linking                                 │
│  ┌──────────────────────────────────┐                  │
│  │ 用户问题 → 哪些表是相关的？        │                  │
│  │ 例： "销售额" → orders, sales    │                  │
│  └──────────────────────────────────┘                  │
│                    ↓                                   │
│  Level 2: 列级 Linking                                 │
│  ┌──────────────────────────────────┐                  │
│  │ 相关表 → 哪些列是需要的？          │                  │
│  │ 例： "销售额" → order_total,     │                  │
│  │       discount_amount            │                  │
│  └──────────────────────────────────┘                  │
│                    ↓                                   │
│  Level 3: 值级 Linking                                 │
│  ┌──────────────────────────────────┐                  │
│  │ 相关列 → WHERE 条件中的具体值？    │                  │
│  │ 例： "华东" → region = 'east'    │                  │
│  └──────────────────────────────────┘                  │
└────────────────────────────────────────────────────────┘
```

每一层解决不同粒度的问题。实际系统中，三层通常是串联执行的：先筛选表，再筛选列，最后匹配值。

### 3. 主流方法对比

Schema Linking 的方法可以分为三大类：

| 方法 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 基于规则 | 关键词匹配、同义词表、正则表达式 | 速度快、可控、无额外成本 | 覆盖率低、维护成本高 |
| 基于模型 | 用 LLM 或小模型做实体识别和链接 | 理解语义、泛化能力强 | 成本高、速度慢、可能幻觉 |
| 混合方法 | 规则做初筛 + 模型做精排 | 平衡成本和效果 | 工程复杂度高 |

2025 年的主流方案是**混合方法**：先用向量检索快速缩小范围，再用 LLM 做精确判断。

### 4. 向量化 Schema 检索

核心思想：把数据库的表名、列名、甚至列的样本值都转成向量，用户问题也转成向量，然后通过相似度匹配找到最相关的 schema 元素。

```
┌─────────────────────────────────────────────────────────┐
│                向量化 Schema 检索流程                      │
│                                                         │
│  预处理阶段（离线）：                                      │
│  ┌─────────┐    ┌─────────────┐    ┌──────────────┐     │
│  │ 表名/列名 │ →  │ 文本描述拼接  │ →  │ Embedding    │     │
│  │ 注释/样本 │    │             │    │ 向量数据库    │     │
│  └─────────┘    └─────────────┘    └──────────────┘     │
│                                                         │
│  查询阶段（在线）：                                        │
│  ┌─────────┐    ┌─────────────┐    ┌──────────────┐     │
│  │ 用户问题  │ →  │ Embedding   │ →  │ 相似度检索    │     │
│  └─────────┘    └─────────────┘    │ Top-K 结果   │     │
│                                     └──────────────┘     │
└─────────────────────────────────────────────────────────┘
```

关键设计决策：**怎么拼接描述文本**。一个好的描述不仅包含列名，还包含：
- 列的数据类型
- 列的中文注释（如果有）
- 列的枚举值或样本值
- 所属表的上下文

### 5. 动态 Schema 压缩

大模型的 context window 有限，一个真实的数据库 schema 可能有几万个 token。即使有 128K 的窗口，把全部 schema 塞进去也会：
- 浪费 token（增加成本）
- 降低模型注意力（"大海捞针"效应）
- 超出小模型的窗口限制

动态 Schema 压缩的目标是：**只保留与当前问题相关的 schema 信息**。

```
完整 Schema（3000+ 列，约 50000 tokens）
         │
         ▼ Schema Linking
相关 Schema（20-50 列，约 2000 tokens）
         │
         ▼ 动态压缩
精简 Schema（5-15 列，约 500 tokens）
         │
         ▼
    填入 Prompt
```

## 完整示例：实现一个 Schema Linking Pipeline

接下来我们实现一个完整的 Schema Linking Pipeline，包含向量化检索和 LLM 精排两个阶段。

### 环境准备

```bash
pip install openai chromadb pydantic rich sqlalchemy
```

### 第一步：定义数据模型

```python
"""
schema_linking/models.py
Schema Linking 的数据模型定义
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ColumnInfo:
    """数据库列的完整信息"""
    table_name: str
    column_name: str
    data_type: str
    comment: str = ""
    sample_values: list[str] = field(default_factory=list)
    is_primary_key: bool = False
    is_foreign_key: bool = False
    foreign_key_ref: Optional[str] = None

    @property
    def full_name(self) -> str:
        return f"{self.table_name}.{self.column_name}"

    def to_description(self) -> str:
        """生成用于 embedding 的文本描述"""
        parts = [
            f"表: {self.table_name}",
            f"列: {self.column_name}",
            f"类型: {self.data_type}",
        ]
        if self.comment:
            parts.append(f"说明: {self.comment}")
        if self.sample_values:
            samples = ", ".join(str(v) for v in self.sample_values[:5])
            parts.append(f"示例值: {samples}")
        if self.is_primary_key:
            parts.append("主键")
        if self.is_foreign_key and self.foreign_key_ref:
            parts.append(f"外键引用: {self.foreign_key_ref}")
        return " | ".join(parts)


@dataclass
class LinkingResult:
    """Schema Linking 的结果"""
    question: str
    matched_columns: list[tuple[ColumnInfo, float]]  # (列信息, 相似度分数)
    matched_tables: list[tuple[str, float]]  # (表名, 相似度分数)
    matched_values: dict[str, list[str]]  # 列名 -> 匹配到的值

    def get_schema_subset(self, threshold: float = 0.5) -> list[ColumnInfo]:
        """获取超过阈值的列信息子集"""
        return [
            col for col, score in self.matched_columns
            if score >= threshold
        ]

    def to_prompt_schema(self, threshold: float = 0.5) -> str:
        """生成可直接放入 prompt 的 schema 描述"""
        columns = self.get_schema_subset(threshold)
        if not columns:
            return "未找到匹配的数据库结构信息。"

        tables: dict[str, list[ColumnInfo]] = {}
        for col in columns:
            tables.setdefault(col.table_name, []).append(col)

        lines = []
        for table_name, cols in tables.items():
            lines.append(f"表 {table_name}:")
            for col in cols:
                desc = f"  - {col.column_name} ({col.data_type})"
                if col.comment:
                    desc += f" -- {col.comment}"
                if col.sample_values:
                    samples = ", ".join(str(v) for v in col.sample_values[:3])
                    desc += f" [示例: {samples}]"
                lines.append(desc)
            lines.append("")

        return "\n".join(lines)
```

### 第二步：构建 Schema 索引

```python
"""
schema_linking/indexer.py
将数据库 schema 信息索引到向量数据库
"""

import chromadb
from chromadb.config import Settings
from openai import OpenAI

from models import ColumnInfo


class SchemaIndexer:
    """将数据库 schema 信息向量化并存入 ChromaDB"""

    def __init__(
        self,
        collection_name: str = "schema_columns",
        embedding_model: str = "text-embedding-3-small",
    ):
        self.client = chromadb.Client(Settings(anonymized_telemetry=False))
        self.openai_client = OpenAI()
        self.embedding_model = embedding_model
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def _get_embedding(self, text: str) -> list[float]:
        """获取文本的 embedding 向量"""
        response = self.openai_client.embeddings.create(
            model=self.embedding_model,
            input=text,
        )
        return response.data[0].embedding

    def index_columns(self, columns: list[ColumnInfo]) -> None:
        """批量索引列信息"""
        documents = []
        embeddings = []
        ids = []
        metadatas = []

        for col in columns:
            doc_text = col.to_description()
            embedding = self._get_embedding(doc_text)

            documents.append(doc_text)
            embeddings.append(embedding)
            ids.append(col.full_name)
            metadatas.append({
                "table_name": col.table_name,
                "column_name": col.column_name,
                "data_type": col.data_type,
                "comment": col.comment,
                "is_primary_key": col.is_primary_key,
            })

        self.collection.upsert(
            documents=documents,
            embeddings=embeddings,
            ids=ids,
            metadatas=metadatas,
        )
        print(f"已索引 {len(columns)} 个列")

    def search(
        self,
        query: str,
        n_results: int = 20,
        table_filter: str | None = None,
    ) -> list[tuple[str, float, dict]]:
        """搜索与查询最相关的列"""
        query_embedding = self._get_embedding(query)

        where_filter = None
        if table_filter:
            where_filter = {"table_name": table_filter}

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )

        matches = []
        for i in range(len(results["ids"][0])):
            col_id = results["ids"][0][i]
            distance = results["distances"][0][i]
            metadata = results["metadatas"][0][i]
            # ChromaDB 余弦距离: 0 = 完全相同, 2 = 完全不同
            similarity = 1 - distance
            matches.append((col_id, similarity, metadata))

        return matches
```

### 第三步：实现 LLM 精排器

```python
"""
schema_linking/reranker.py
使用 LLM 对初步检索结果进行精排
"""

import json
from openai import OpenAI
from models import ColumnInfo, LinkingResult


class LLMReranker:
    """使用 LLM 对 Schema Linking 结果进行精排"""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.client = OpenAI()
        self.model = model

    def rerank(
        self,
        question: str,
        candidates: list[ColumnInfo],
        top_k: int = 15,
    ) -> LinkingResult:
        """对候选列进行精排，返回最终的 linking 结果"""

        # 构建候选列的描述
        candidate_desc = []
        for i, col in enumerate(candidates):
            desc = f"[{i}] {col.full_name} ({col.data_type})"
            if col.comment:
                desc += f" -- {col.comment}"
            if col.sample_values:
                samples = ", ".join(str(v) for v in col.sample_values[:3])
                desc += f" [示例: {samples}]"
            candidate_desc.append(desc)

        prompt = f"""你是一个数据库 Schema Linking 专家。
给定用户的问题和数据库列的候选列表，请判断哪些列与问题最相关。

用户问题: {question}

候选列:
{chr(10).join(candidate_desc)}

请返回一个 JSON 对象，包含以下字段:
- "relevant_columns": 最相关的列索引列表，按相关性从高到低排序
- "relevant_tables": 涉及的表名列表
- "reasoning": 简要说明你的判断依据

只返回 JSON，不要其他内容。"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)

        # 构建返回结果
        matched_columns = []
        for idx in result.get("relevant_columns", [])[:top_k]:
            if 0 <= idx < len(candidates):
                matched_columns.append((candidates[idx], 0.95))

        matched_tables = [
            (t, 0.95) for t in result.get("relevant_tables", [])
        ]

        return LinkingResult(
            question=question,
            matched_columns=matched_columns,
            matched_tables=matched_tables,
            matched_values={},
        )
```

### 第四步：值级 Linking

```python
"""
schema_linking/value_linker.py
值级 Schema Linking：匹配 WHERE 条件中的具体值
"""

import re
from sqlalchemy import create_engine, text


class ValueLinker:
    """值级 Schema Linking：在数据库中搜索匹配的值"""

    def __init__(self, database_url: str):
        self.engine = create_engine(database_url)

    def search_values(
        self,
        column: str,
        query_value: str,
        table: str,
        top_k: int = 5,
    ) -> list[str]:
        """在指定列中搜索与查询值最匹配的实际值"""

        # 策略 1：精确匹配（不区分大小写）
        exact_sql = text(f"""
            SELECT DISTINCT {column}
            FROM {table}
            WHERE LOWER(CAST({column} AS TEXT)) = LOWER(:query)
            LIMIT :limit
        """)

        with self.engine.connect() as conn:
            result = conn.execute(
                exact_sql, {"query": query_value, "limit": top_k}
            )
            exact_matches = [row[0] for row in result]

        if exact_matches:
            return [str(v) for v in exact_matches]

        # 策略 2：模糊匹配
        fuzzy_sql = text(f"""
            SELECT DISTINCT {column}
            FROM {table}
            WHERE LOWER(CAST({column} AS TEXT)) LIKE LOWER(:pattern)
            LIMIT :limit
        """)

        with self.engine.connect() as conn:
            result = conn.execute(
                fuzzy_sql,
                {"pattern": f"%{query_value}%", "limit": top_k},
            )
            fuzzy_matches = [row[0] for row in result]

        if fuzzy_matches:
            return [str(v) for v in fuzzy_matches]

        # 策略 3：编辑距离排序（适用于短文本列）
        sample_sql = text(f"""
            SELECT DISTINCT {column}
            FROM {table}
            WHERE {column} IS NOT NULL
            LIMIT 1000
        """)

        with self.engine.connect() as conn:
            result = conn.execute(sample_sql)
            all_values = [str(row[0]) for row in result]

        # 简单编辑距离排序
        scored = []
        query_lower = query_value.lower()
        for v in all_values:
            v_lower = v.lower()
            # 计算最长公共子串长度
            common_len = self._longest_common_substring(query_lower, v_lower)
            score = common_len / max(len(query_lower), len(v_lower))
            if score > 0.3:
                scored.append((v, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [v for v, _ in scored[:top_k]]

    @staticmethod
    def _longest_common_substring(s1: str, s2: str) -> int:
        """计算最长公共子串长度"""
        m, n = len(s1), len(s2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        max_len = 0
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if s1[i - 1] == s2[j - 1]:
                    dp[i][j] = dp[i - 1][j - 1] + 1
                    max_len = max(max_len, dp[i][j])
        return max_len
```

### 第五步：组装完整 Pipeline

```python
"""
schema_linking/pipeline.py
完整的 Schema Linking Pipeline
"""

from models import ColumnInfo, LinkingResult
from indexer import SchemaIndexer
from reranker import LLMReranker
from value_linker import ValueLinker


class SchemaLinkingPipeline:
    """完整的 Schema Linking Pipeline：向量检索 + LLM 精排 + 值匹配"""

    def __init__(
        self,
        database_url: str,
        embedding_model: str = "text-embedding-3-small",
        rerank_model: str = "gpt-4o-mini",
    ):
        self.indexer = SchemaIndexer(embedding_model=embedding_model)
        self.reranker = LLMReranker(model=rerank_model)
        self.value_linker = ValueLinker(database_url)
        self._columns_cache: dict[str, ColumnInfo] = {}

    def load_schema(self, columns: list[ColumnInfo]) -> None:
        """加载并索引数据库 schema"""
        self._columns_cache = {col.full_name: col for col in columns}
        self.indexer.index_columns(columns)
        print(f"已加载 {len(columns)} 个列的 schema 信息")

    def link(self, question: str, top_k: int = 15) -> LinkingResult:
        """执行完整的 Schema Linking 流程"""

        # 第一阶段：向量粗筛（召回 Top 30）
        print("阶段 1: 向量检索...")
        raw_matches = self.indexer.search(question, n_results=30)

        # 重建 ColumnInfo 对象
        candidates = []
        for col_id, similarity, metadata in raw_matches:
            if col_id in self._columns_cache:
                candidates.append(self._columns_cache[col_id])
            else:
                # 从 metadata 重建
                candidates.append(ColumnInfo(
                    table_name=metadata["table_name"],
                    column_name=metadata["column_name"],
                    data_type=metadata["data_type"],
                    comment=metadata.get("comment", ""),
                ))

        print(f"  向量检索召回 {len(candidates)} 个候选列")

        # 第二阶段：LLM 精排
        print("阶段 2: LLM 精排...")
        result = self.reranker.rerank(question, candidates, top_k=top_k)
        print(f"  精排后保留 {len(result.matched_columns)} 个列")

        # 第三阶段：值级 Linking（如果问题中有明显的实体值）
        print("阶段 3: 值级 Linking...")
        entity_values = self._extract_entity_candidates(question)
        for col_info, _ in result.matched_columns:
            if col_info.data_type in ("VARCHAR", "TEXT", "CHAR", "STRING"):
                for entity in entity_values:
                    matches = self.value_linker.search_values(
                        col_info.column_name,
                        entity,
                        col_info.table_name,
                        top_k=3,
                    )
                    if matches:
                        result.matched_values.setdefault(
                            col_info.full_name, []
                        ).extend(matches)

        if result.matched_values:
            print(f"  值级匹配完成，涉及 {len(result.matched_values)} 个列")

        return result

    @staticmethod
    def _extract_entity_candidates(question: str) -> list[str]:
        """从问题中提取可能的实体值（简化版）"""
        # 提取引号中的内容
        quoted = re.findall(r'[""「」『』](.+?)[""「」『』]', question)

        # 提取中文词组（2-6字）
        import jieba
        words = jieba.cut(question)
        chinese_entities = [
            w for w in words
            if 2 <= len(w) <= 6
            and not all(c in "的是在有不了人这中大为上个" for c in w)
        ]

        return list(set(quoted + chinese_entities))


# 使用示例
if __name__ == "__main__":
    import re

    # 模拟数据库 schema
    sample_columns = [
        ColumnInfo(
            table_name="orders",
            column_name="order_id",
            data_type="INT",
            comment="订单唯一标识",
            is_primary_key=True,
        ),
        ColumnInfo(
            table_name="orders",
            column_name="order_total",
            data_type="DECIMAL",
            comment="订单总金额（含折扣）",
            sample_values=["299.00", "1580.50", "42.00"],
        ),
        ColumnInfo(
            table_name="orders",
            column_name="region",
            data_type="VARCHAR",
            comment="销售区域",
            sample_values=["华东", "华北", "华南", "西南"],
        ),
        ColumnInfo(
            table_name="orders",
            column_name="order_date",
            data_type="DATE",
            comment="下单日期",
            sample_values=["2025-01-15", "2025-03-22"],
        ),
        ColumnInfo(
            table_name="products",
            column_name="product_id",
            data_type="INT",
            comment="商品唯一标识",
            is_primary_key=True,
        ),
        ColumnInfo(
            table_name="products",
            column_name="product_name",
            data_type="VARCHAR",
            comment="商品名称",
            sample_values=["iPhone 16", "MacBook Pro", "AirPods Pro"],
        ),
        ColumnInfo(
            table_name="products",
            column_name="category",
            data_type="VARCHAR",
            comment="商品类目",
            sample_values=["手机", "电脑", "配件"],
        ),
    ]

    # 初始化 pipeline（注意：实际运行需要数据库连接和 API Key）
    # pipeline = SchemaLinkingPipeline(database_url="postgresql://...")
    # pipeline.load_schema(sample_columns)
    # result = pipeline.link("上个月华东区的销售额是多少？")
    # print(result.to_prompt_schema())

    # 演示：直接使用模型生成 prompt schema
    result = LinkingResult(
        question="上个月华东区的销售额是多少？",
        matched_columns=[
            (sample_columns[1], 0.95),  # order_total
            (sample_columns[2], 0.92),  # region
            (sample_columns[3], 0.88),  # order_date
        ],
        matched_tables=[("orders", 0.95)],
        matched_values={"orders.region": ["华东"]},
    )

    print("=== 生成的 Prompt Schema ===")
    print(result.to_prompt_schema())
    print("\n=== 值级匹配结果 ===")
    for col, values in result.matched_values.items():
        print(f"  {col}: {values}")
```

### 运行效果

```
=== 生成的 Prompt Schema ===
表 orders:
  - order_total (DECIMAL) -- 订单总金额（含折扣） [示例: 299.00, 1580.50, 42.00]
  - region (VARCHAR) -- 销售区域 [示例: 华东, 华北, 华南]
  - order_date (DATE) -- 下单日期 [示例: 2025-01-15, 2025-03-22]

=== 值级匹配结果 ===
  orders.region: ['华东']
```

### 第六步：集成到 NL2SQL 流程

```python
"""
schema_linking/nl2sql_integration.py
将 Schema Linking 集成到完整的 NL2SQL 流程中
"""

from openai import OpenAI
from pipeline import SchemaLinkingPipeline
from models import ColumnInfo


class NL2SQLWithSchemaLinking:
    """集成 Schema Linking 的 NL2SQL 系统"""

    def __init__(self, database_url: str):
        self.pipeline = SchemaLinkingPipeline(database_url=database_url)
        self.llm = OpenAI()

    def load_schema(self, columns: list[ColumnInfo]) -> None:
        self.pipeline.load_schema(columns)

    def query(self, question: str) -> str:
        """完整的 NL2SQL 流程"""

        # Step 1: Schema Linking
        linking_result = self.pipeline.link(question)
        schema_text = linking_result.to_prompt_schema(threshold=0.5)

        # Step 2: 构建 prompt
        prompt = f"""你是一个 SQL 专家。根据以下数据库结构信息，将用户的自然语言问题转换为 SQL。

数据库结构:
{schema_text}

{self._format_value_hints(linking_result)}

用户问题: {question}

请生成可直接执行的 SQL 语句。只返回 SQL，不要其他内容。"""

        # Step 3: 生成 SQL
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )

        return response.choices[0].message.content

    @staticmethod
    def _format_value_hints(result) -> str:
        """格式化值级匹配的提示信息"""
        if not result.matched_values:
            return ""

        hints = ["值匹配提示:"]
        for col, values in result.matched_values.items():
            for v in values:
                hints.append(f"  - 用户提到的值 '{v}' 对应 {col} 列")

        return "\n".join(hints)
```

## 常见误区

### 误区 1：把全部 schema 塞进 prompt

很多人直接用 `SHOW TABLES` 和 `DESCRIBE TABLE` 获取全部 schema，然后拼接到 prompt 里。当表少于 10 张时这没问题，但真实业务数据库通常有几百张表，这样做会：
- 浪费大量 token（一个中等数据库的 schema 就有 3-5 万 token）
- 降低模型准确率（无关信息会干扰模型判断）
- 超出小模型的上下文窗口

### 误区 2：只做表级 Linking，忽略列级和值级

只告诉模型"这个查询涉及 orders 表"是不够的。一个 orders 表可能有 50 个列，模型需要知道具体用哪些列。特别是当列名有歧义时（比如 `amount` 是原价还是实付价），列级 Linking 的注释信息至关重要。

### 误区 3：忽视值级 Linking 的重要性

用户说"华东"，数据库里存的是 `east_china`；用户说"张三"，数据库里存的是 `张三丰`。没有值级 Linking，生成的 SQL WHERE 条件就会用错误的值，导致查询结果为空。

### 误区 4：embedding 模型选择不当

不要用通用的 embedding 模型做 Schema Linking。数据库的列名、表名通常是缩写或专业术语，通用模型的语义空间可能无法正确表达。建议：
- 优先使用 `text-embedding-3-large` 等高质量模型
- 如果预算有限，可以用 `text-embedding-3-small`，但要配合 reranker
- 考虑用数据库的注释和样本来丰富 embedding 的输入文本

## 小结

本课时的核心要点：

1. **Schema Linking 是 NL2SQL 的关键瓶颈**：超过 35% 的 SQL 错误源于 schema 链接失败
2. **三层递进**：表级 → 列级 → 值级，逐层缩小范围
3. **混合方法最有效**：向量检索做粗筛（快），LLM 做精排（准）
4. **动态压缩减少 token**：从 5 万 token 压缩到 500 token，成本降低 99%
5. **值级 Linking 不可忽视**：实体值的精确匹配直接影响 WHERE 条件的正确性

Schema Linking 做好了，NL2SQL 的准确率可以提升 15-25 个百分点。这是一个投入产出比极高的优化方向。

## 练习

### 练习一：改进向量化 Schema 检索

当前的 SchemaIndexer 只使用列的基本信息做 embedding。请改进 `to_description` 方法，加入更多的上下文信息（如关联表的信息、列的统计特征等），并比较改进前后的检索效果。

### 练习二：实现基于规则的 Schema Linker

在向量检索之前，先实现一个基于规则的 Schema Linker，用于处理常见的命名模式（如 `user_name` → 用户名、`created_at` → 创建时间）。这个规则层可以作为向量检索的补充。

### 练习三：评估 Schema Linking 效果

设计一个评估方案，衡量 Schema Linking 的准确率。你需要：
1. 准备 20 个自然语言问题及其对应的正确 schema 列
2. 运行 Schema Linking Pipeline
3. 计算 Precision、Recall 和 F1 Score
4. 分析错误案例，找出改进方向

---

## 参考答案

### 练习一

**思路**：在 `to_description` 方法中加入关联表信息和列的统计特征，可以提供更丰富的语义上下文。

**答案**：

```python
@dataclass
class ColumnInfo:
    # ... 原有字段 ...
    related_tables: list[str] = field(default_factory=list)
    value_distribution: dict[str, int] = field(default_factory=dict)  # 值 -> 出现次数
    null_ratio: float = 0.0  # 空值比例
    distinct_count: int = 0  # 去重值数量

    def to_description(self) -> str:
        parts = [
            f"表: {self.table_name}",
            f"列: {self.column_name}",
            f"类型: {self.data_type}",
        ]
        if self.comment:
            parts.append(f"说明: {self.comment}")
        if self.sample_values:
            samples = ", ".join(str(v) for v in self.sample_values[:5])
            parts.append(f"示例值: {samples}")
        if self.related_tables:
            parts.append(f"关联表: {', '.join(self.related_tables)}")
        if self.distinct_count > 0:
            parts.append(f"唯一值数量: {self.distinct_count}")
        if self.value_distribution:
            top_values = sorted(
                self.value_distribution.items(),
                key=lambda x: x[1],
                reverse=True,
            )[:5]
            dist_str = ", ".join(f"{k}({v})" for k, v in top_values)
            parts.append(f"主要值: {dist_str}")
        if self.is_primary_key:
            parts.append("主键")
        if self.is_foreign_key and self.foreign_key_ref:
            parts.append(f"外键引用: {self.foreign_key_ref}")
        return " | ".join(parts)
```

**要点**：
- 加入关联表信息可以帮助模型理解表间关系
- 值分布信息有助于模型判断列的语义（如高基数列通常是 ID，低基数列通常是枚举）
- 空值比例可以帮助模型决定是否需要 LEFT JOIN

### 练习二

**思路**：建立一套命名模式映射表，用正则匹配和关键词匹配来处理常见的列名模式。

**答案**：

```python
import re
from models import ColumnInfo


class RuleBasedSchemaLinker:
    """基于规则的 Schema Linker"""

    # 命名模式映射：正则 -> (语义标签, 置信度)
    NAMING_PATTERNS = [
        (r".*_id$", "标识符", 0.9),
        (r".*_name$", "名称", 0.9),
        (r".*_date$", "日期", 0.9),
        (r".*_time$", "时间", 0.9),
        (r".*_at$", "时间戳", 0.8),
        (r".*_count$", "数量", 0.8),
        (r".*_amount$", "金额", 0.9),
        (r".*_price$", "价格", 0.9),
        (r".*_total$", "合计", 0.8),
        (r".*_status$", "状态", 0.8),
        (r".*_type$", "类型", 0.7),
        (r"is_.*", "布尔标志", 0.8),
        (r"has_.*", "布尔标志", 0.8),
        (r"created_.*", "创建时间", 0.9),
        (r"updated_.*", "更新时间", 0.9),
    ]

    # 关键词到列的映射
    KEYWORD_MAPPING = {
        "销售额": ["amount", "total", "revenue", "sales"],
        "用户": ["user", "customer", "member"],
        "订单": ["order", "purchase"],
        "商品": ["product", "item", "goods"],
        "日期": ["date", "time", "created", "updated"],
        "区域": ["region", "area", "zone", "district"],
        "数量": ["count", "quantity", "qty", "number"],
    }

    def match(
        self,
        question: str,
        columns: list[ColumnInfo],
    ) -> list[tuple[ColumnInfo, float]]:
        """基于规则匹配列"""
        results = []
        question_lower = question.lower()

        for col in columns:
            score = 0.0

            # 规则 1：列名直接出现在问题中
            if col.column_name.lower() in question_lower:
                score = max(score, 0.95)

            # 规则 2：注释中的关键词出现在问题中
            if col.comment:
                comment_words = set(col.comment)
                question_words = set(question)
                overlap = len(comment_words & question_words)
                if overlap > 0:
                    score = max(score, min(0.9, overlap * 0.2))

            # 规则 3：关键词映射匹配
            for keyword, patterns in self.KEYWORD_MAPPING.items():
                if keyword in question:
                    for pattern in patterns:
                        if pattern in col.column_name.lower():
                            score = max(score, 0.85)
                        if col.comment and pattern in col.comment.lower():
                            score = max(score, 0.8)

            # 规则 4：命名模式匹配
            for pattern, label, confidence in self.NAMING_PATTERNS:
                if re.match(pattern, col.column_name, re.IGNORECASE):
                    # 如果问题中包含对应的语义标签
                    if label in question:
                        score = max(score, confidence)

            if score > 0.3:
                results.append((col, score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results
```

**要点**：
- 规则方法速度快，适合做第一层过滤
- 规则需要根据实际数据库的命名规范持续维护
- 规则的置信度应该低于模型方法，以便在冲突时让模型优先

### 练习三

**思路**：构建一个标准测试集，用 Precision、Recall、F1 三个指标来评估 Schema Linking 的效果。

**答案**：

```python
"""
schema_linking/evaluation.py
Schema Linking 效果评估
"""

from dataclasses import dataclass
from models import ColumnInfo, LinkingResult


@dataclass
class EvalCase:
    """评估用例"""
    question: str
    expected_columns: list[str]  # 期望的列全名列表，如 ["orders.order_total", "orders.region"]


@dataclass
class EvalResult:
    """评估结果"""
    precision: float
    recall: float
    f1: float
    error_cases: list[dict]


def evaluate_schema_linking(
    pipeline,
    test_cases: list[EvalCase],
    threshold: float = 0.5,
) -> EvalResult:
    """评估 Schema Linking 的效果"""

    total_precision = 0.0
    total_recall = 0.0
    error_cases = []

    for case in test_cases:
        # 运行 Schema Linking
        result = pipeline.link(case.question)

        # 获取预测的列（超过阈值的）
        predicted = set(
            col.full_name
            for col, score in result.matched_columns
            if score >= threshold
        )
        expected = set(case.expected_columns)

        # 计算 Precision 和 Recall
        if predicted:
            precision = len(predicted & expected) / len(predicted)
        else:
            precision = 0.0

        if expected:
            recall = len(predicted & expected) / len(expected)
        else:
            recall = 1.0

        total_precision += precision
        total_recall += recall

        # 记录错误案例
        if precision < 1.0 or recall < 1.0:
            error_cases.append({
                "question": case.question,
                "expected": sorted(expected),
                "predicted": sorted(predicted),
                "missing": sorted(expected - predicted),
                "extra": sorted(predicted - expected),
            })

    n = len(test_cases)
    avg_precision = total_precision / n
    avg_recall = total_recall / n
    f1 = (
        2 * avg_precision * avg_recall / (avg_precision + avg_recall)
        if (avg_precision + avg_recall) > 0
        else 0.0
    )

    return EvalResult(
        precision=avg_precision,
        recall=avg_recall,
        f1=f1,
        error_cases=error_cases,
    )


# 测试集示例
test_cases = [
    EvalCase(
        question="上个月华东区的销售额是多少？",
        expected_columns=["orders.order_total", "orders.region", "orders.order_date"],
    ),
    EvalCase(
        question="哪个商品卖得最好？",
        expected_columns=["products.product_name", "orders.order_id"],
    ),
    EvalCase(
        question="张三的订单总金额",
        expected_columns=["orders.order_total", "customers.customer_name"],
    ),
    EvalCase(
        question="本月新增了多少用户？",
        expected_columns=["users.created_at", "users.user_id"],
    ),
    EvalCase(
        question="手机类目的平均价格是多少？",
        expected_columns=["products.price", "products.category"],
    ),
]

# 运行评估
# result = evaluate_schema_linking(pipeline, test_cases)
# print(f"Precision: {result.precision:.2%}")
# print(f"Recall: {result.recall:.2%}")
# print(f"F1: {result.f1:.2%}")
# print(f"错误案例数: {len(result.error_cases)}")
```

**要点**：
- 测试集应该覆盖各种类型的问题（聚合、筛选、排序、多表关联）
- 重点关注 Recall（不遗漏重要列），因为遗漏比冗余的后果更严重
- 错误案例分析是改进的关键：找出哪些类型的列最容易被遗漏
