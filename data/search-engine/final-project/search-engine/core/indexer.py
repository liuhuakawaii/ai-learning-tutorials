"""倒排索引模块

实现搜索引擎的核心数据结构——倒排索引，支持：
- 文档的增删改查
- 倒排索引的构建与维护
- 词项-文档映射（posting list）
- 索引持久化（JSON 格式）
- 文档频率（DF）和词频（TF）统计
"""

import json
import math
import os
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

from core.tokenizer import Tokenizer


@dataclass
class PostingEntry:
    """倒排索引中的一个 posting 条目

    记录某个词项在某篇文档中出现的信息，包括词频和位置列表。

    Attributes:
        doc_id: 文档 ID
        term_freq: 词项在文档中出现的次数
        positions: 词项在文档中出现的位置列表
        field_boost: 字段权重（标题 vs 正文）
    """
    doc_id: str
    term_freq: int
    positions: List[int] = field(default_factory=list)
    field_boost: float = 1.0


class InvertedIndex:
    """倒排索引

    核心数据结构，维护 词项 → posting list 的映射关系。
    支持增量构建、文档删除、持久化加载。

    用法示例：
        index = InvertedIndex()
        index.add_document("doc1", {"title": "搜索引擎", "content": "搜索引擎是..."})
        results = index.search("搜索引擎")
    """

    def __init__(self, tokenizer: Optional[Tokenizer] = None):
        """初始化倒排索引

        Args:
            tokenizer: 分词器实例，为空则创建默认分词器
        """
        self.tokenizer = tokenizer or Tokenizer()

        # 核心数据结构：词项 → [PostingEntry, ...]
        self._index: Dict[str, List[PostingEntry]] = defaultdict(list)

        # 文档存储：doc_id → 原始文档内容
        self._documents: Dict[str, Dict[str, str]] = {}

        # 文档长度：doc_id → 文档词项总数
        self._doc_lengths: Dict[str, int] = {}

        # 词项文档频率：词项 → 出现该词项的文档数
        self._doc_freq: Dict[str, int] = defaultdict(int)

        # 全局统计
        self._total_docs: int = 0
        self._total_terms: int = 0

    @property
    def total_docs(self) -> int:
        """索引中的文档总数"""
        return self._total_docs

    @property
    def avg_doc_length(self) -> float:
        """平均文档长度（词项数）"""
        if self._total_docs == 0:
            return 0.0
        return self._total_terms / self._total_docs

    def get_doc_freq(self, term: str) -> int:
        """获取词项的文档频率

        Args:
            term: 词项

        Returns:
            包含该词项的文档数量
        """
        return self._doc_freq.get(term, 0)

    def get_doc_length(self, doc_id: str) -> int:
        """获取文档长度

        Args:
            doc_id: 文档 ID

        Returns:
            文档的词项总数
        """
        return self._doc_lengths.get(doc_id, 0)

    def get_document(self, doc_id: str) -> Optional[Dict[str, str]]:
        """获取原始文档内容

        Args:
            doc_id: 文档 ID

        Returns:
            文档内容字典，不存在则返回 None
        """
        return self._documents.get(doc_id)

    def add_document(self, doc_id: str, document: Dict[str, str]) -> None:
        """添加文档到索引

        对文档各字段进行分词，构建倒排索引条目。
        如果文档已存在，先删除旧索引再重新添加。

        Args:
            doc_id: 文档唯一标识
            document: 文档内容字典，如 {"title": "...", "content": "..."}
        """
        # 如果文档已存在，先删除旧索引
        if doc_id in self._documents:
            self.remove_document(doc_id)

        self._documents[doc_id] = document

        # 对各字段分词并构建索引
        all_positions: List[str] = []
        for field_name, field_text in document.items():
            tokens = self.tokenizer.tokenize(field_text)
            # 字段权重：标题权重高于正文
            boost = 2.0 if field_name == "title" else 1.0

            position = 0
            for token in tokens:
                # 记录 posting 条目
                entry = PostingEntry(
                    doc_id=doc_id,
                    term_freq=0,  # 先设为 0，后面统一计算
                    positions=[position],
                    field_boost=boost,
                )
                # 查找是否已有该文档的 posting
                existing = [
                    e for e in self._index[token] if e.doc_id == doc_id
                ]
                if existing:
                    existing[0].term_freq += 1
                    existing[0].positions.append(position)
                    existing[0].field_boost = max(existing[0].field_boost, boost)
                else:
                    entry.term_freq = 1
                    self._index[token].append(entry)
                    self._doc_freq[token] += 1

                all_positions.append(token)
                position += 1

        # 更新文档长度和全局统计
        doc_len = len(all_positions)
        self._doc_lengths[doc_id] = doc_len
        self._total_docs += 1
        self._total_terms += doc_len

    def remove_document(self, doc_id: str) -> bool:
        """从索引中删除文档

        Args:
            doc_id: 要删除的文档 ID

        Returns:
            删除成功返回 True，文档不存在返回 False
        """
        if doc_id not in self._documents:
            return False

        # 从 posting list 中移除该文档的条目
        terms_to_update = []
        for term, postings in self._index.items():
            self._index[term] = [p for p in postings if p.doc_id != doc_id]
            if not self._index[term]:
                terms_to_update.append(term)

        # 清理空 posting list 和更新文档频率
        for term in terms_to_update:
            del self._index[term]
            self._doc_freq.pop(term, None)

        # 更新全局统计
        doc_len = self._doc_lengths.pop(doc_id, 0)
        self._total_terms -= doc_len
        self._total_docs -= 1
        del self._documents[doc_id]

        return True

    def get_postings(self, term: str) -> List[PostingEntry]:
        """获取词项的 posting list

        Args:
            term: 词项

        Returns:
            该词项对应的 posting 条目列表
        """
        return self._index.get(term, [])

    def get_all_terms(self) -> Set[str]:
        """获取索引中的所有词项

        Returns:
            所有词项的集合
        """
        return set(self._index.keys())

    def boolean_search(
        self, query: str, operator: str = "AND"
    ) -> List[str]:
        """布尔检索

        支持 AND、OR、NOT 三种布尔操作符。

        Args:
            query: 查询文本
            operator: 布尔操作符，可选 "AND"、"OR"、"NOT"

        Returns:
            匹配的文档 ID 列表
        """
        tokens = self.tokenizer.tokenize(query)
        if not tokens:
            return []

        # 收集每个词项对应的文档 ID 集合
        token_doc_sets: List[Set[str]] = []
        for token in tokens:
            doc_ids = {p.doc_id for p in self.get_postings(token)}
            token_doc_sets.append(doc_ids)

        if not token_doc_sets:
            return []

        if operator == "AND":
            # AND：取交集
            result = token_doc_sets[0]
            for doc_set in token_doc_sets[1:]:
                result = result & doc_set
            return sorted(result)

        elif operator == "OR":
            # OR：取并集
            result: Set[str] = set()
            for doc_set in token_doc_sets:
                result = result | doc_set
            return sorted(result)

        elif operator == "NOT":
            # NOT：从第一个词项的结果中排除后续词项的结果
            if len(token_doc_sets) < 2:
                return sorted(token_doc_sets[0])
            result = token_doc_sets[0]
            for doc_set in token_doc_sets[1:]:
                result = result - doc_set
            return sorted(result)

        return []

    def save(self, path: str) -> None:
        """将索引持久化到 JSON 文件

        Args:
            path: 保存路径
        """
        data = {
            "documents": self._documents,
            "doc_lengths": self._doc_lengths,
            "doc_freq": dict(self._doc_freq),
            "total_docs": self._total_docs,
            "total_terms": self._total_terms,
            "postings": {},
        }

        # 序列化 posting list
        for term, postings in self._index.items():
            data["postings"][term] = [
                {
                    "doc_id": p.doc_id,
                    "term_freq": p.term_freq,
                    "positions": p.positions,
                    "field_boost": p.field_boost,
                }
                for p in postings
            ]

        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self, path: str) -> None:
        """从 JSON 文件加载索引

        Args:
            path: 索引文件路径
        """
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._documents = data["documents"]
        self._doc_lengths = data["doc_lengths"]
        self._doc_freq = defaultdict(int, data["doc_freq"])
        self._total_docs = data["total_docs"]
        self._total_terms = data["total_terms"]

        # 反序列化 posting list
        self._index = defaultdict(list)
        for term, postings in data["postings"].items():
            self._index[term] = [
                PostingEntry(**entry) for entry in postings
            ]
