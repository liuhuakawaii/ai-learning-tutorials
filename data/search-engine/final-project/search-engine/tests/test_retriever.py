"""检索器单元测试

测试 Retriever 类的各项功能：
- BM25 检索
- 向量检索
- 混合检索（RRF 融合）
- 统一检索入口
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.indexer import InvertedIndex
from core.retriever import Retriever
from models.bm25 import BM25
from models.vector_search import VectorIndex


class TestRetriever:
    """检索器测试类"""

    def setup_method(self):
        """每个测试方法执行前的初始化"""
        self.index = InvertedIndex()

        # 添加示例文档
        docs = {
            "doc1": {"title": "搜索引擎原理", "content": "搜索引擎是信息检索系统的核心，通过倒排索引实现快速检索"},
            "doc2": {"title": "机器学习入门", "content": "机器学习是人工智能的重要分支，通过数据驱动的方式学习模式"},
            "doc3": {"title": "深度学习与自然语言处理", "content": "深度学习在自然语言处理领域取得了巨大突破"},
            "doc4": {"title": "搜索引擎优化", "content": "SEO 搜索引擎优化是提升网站在搜索引擎中排名的技术"},
            "doc5": {"title": "分布式搜索引擎", "content": "Elasticsearch 是基于 Lucene 的分布式搜索引擎"},
        }
        for doc_id, doc in docs.items():
            self.index.add_document(doc_id, doc)

        # 创建向量索引
        self.vector_index = VectorIndex()
        texts = [d["title"] + " " + d["content"] for d in docs.values()]
        doc_ids = list(docs.keys())
        self.vector_index.build(texts, doc_ids)

        self.retriever = Retriever(
            index=self.index,
            vector_index=self.vector_index,
        )

    def test_bm25_search(self):
        """测试 BM25 检索"""
        results = self.retriever.bm25_search("搜索引擎", top_k=5)
        assert len(results) > 0
        # 结果应为 (doc_id, score) 元组列表
        for doc_id, score in results:
            assert isinstance(doc_id, str)
            assert isinstance(score, float)
        # 结果应按分数降序排列
        scores = [s for _, s in results]
        assert scores == sorted(scores, reverse=True)

    def test_bm25_search_empty_query(self):
        """测试空查询的 BM25 检索"""
        results = self.retriever.bm25_search("", top_k=5)
        assert results == []

    def test_bm25_search_no_match(self):
        """测试无匹配的 BM25 检索"""
        results = self.retriever.bm25_search("量子计算 超导体", top_k=5)
        # 可能返回空或少量结果
        assert isinstance(results, list)

    def test_vector_search(self):
        """测试向量语义检索"""
        results = self.retriever.vector_search("搜索技术", top_k=5)
        assert len(results) > 0
        for doc_id, score in results:
            assert isinstance(doc_id, str)
            assert isinstance(score, float)

    def test_vector_search_empty(self):
        """测试空查询的向量检索"""
        results = self.retriever.vector_search("", top_k=5)
        # 空查询可能返回空或随机结果
        assert isinstance(results, list)

    def test_hybrid_search(self):
        """测试混合检索（RRF 融合）"""
        results = self.retriever.hybrid_search("搜索引擎", top_k=5)
        assert len(results) > 0
        for doc_id, score in results:
            assert isinstance(doc_id, str)
            assert isinstance(score, float)
        # 混合检索的分数是 RRF 分数，应按降序排列
        scores = [s for _, s in results]
        assert scores == sorted(scores, reverse=True)

    def test_hybrid_search_custom_weights(self):
        """测试自定义权重的混合检索"""
        results = self.retriever.hybrid_search(
            "搜索引擎",
            top_k=5,
            bm25_weight=0.7,
            vector_weight=0.3,
        )
        assert len(results) > 0

    def test_search_bm25_mode(self):
        """测试统一入口的 BM25 模式"""
        results = self.retriever.search("搜索引擎", mode="bm25", top_k=5)
        assert len(results) > 0

    def test_search_vector_mode(self):
        """测试统一入口的向量模式"""
        results = self.retriever.search("搜索技术", mode="vector", top_k=5)
        assert len(results) > 0

    def test_search_hybrid_mode(self):
        """测试统一入口的混合模式"""
        results = self.retriever.search("搜索引擎", mode="hybrid", top_k=5)
        assert len(results) > 0

    def test_search_invalid_mode(self):
        """测试无效的检索模式"""
        try:
            self.retriever.search("搜索引擎", mode="invalid")
            assert False, "应抛出 ValueError"
        except ValueError as e:
            assert "不支持" in str(e)

    def test_search_top_k(self):
        """测试 top_k 参数限制结果数量"""
        results = self.retriever.bm25_search("搜索引擎", top_k=2)
        assert len(results) <= 2

    def test_search_without_vector_index(self):
        """测试无向量索引时的向量检索"""
        retriever = Retriever(index=self.index, vector_index=None)
        results = retriever.vector_search("搜索引擎", top_k=5)
        assert results == []

    def test_hybrid_without_vector_index(self):
        """测试无向量索引时的混合检索"""
        retriever = Retriever(index=self.index, vector_index=None)
        results = retriever.hybrid_search("搜索引擎", top_k=5)
        # 应该只返回 BM25 的结果
        assert len(results) > 0
