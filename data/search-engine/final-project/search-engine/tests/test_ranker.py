"""排序器单元测试

测试 Ranker 类的各项功能：
- LTR 模型的训练和预测
- 特征提取
- 端到端检索排序流程
- 重排序功能
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.indexer import InvertedIndex
from core.ranker import Ranker
from core.retriever import Retriever
from models.ltr import LTRModel, FeatureExtractor
from models.vector_search import VectorIndex


class TestFeatureExtractor:
    """特征提取器测试类"""

    def setup_method(self):
        self.extractor = FeatureExtractor()

    def test_query_features(self):
        """测试查询特征提取"""
        features = self.extractor.extract_query_features(["搜索引擎", "原理"])
        assert features.shape == (5,)
        assert features[0] > 0  # 查询长度 > 0
        assert features[1] == 2  # 词项数 = 2

    def test_query_features_empty(self):
        """测试空查询的特征提取"""
        features = self.extractor.extract_query_features([])
        assert features.shape == (5,)

    def test_doc_features(self):
        """测试文档特征提取"""
        meta = {
            "doc_length": 100,
            "title_length": 20,
            "pagerank": 0.5,
            "freshness": 0.8,
            "click_rate": 0.1,
        }
        features = self.extractor.extract_doc_features(meta)
        assert features.shape == (10,)
        assert features[0] == 100  # doc_length
        assert features[1] == 20   # title_length

    def test_doc_features_defaults(self):
        """测试文档特征的默认值"""
        features = self.extractor.extract_doc_features({})
        assert features.shape == (10,)
        assert np.all(features == 0)

    def test_interaction_features(self):
        """测试交互特征提取"""
        features = self.extractor.extract_interaction_features(
            query_terms=["搜索", "引擎"],
            doc_text="这是一个搜索引擎系统的文档内容",
            doc_title="搜索引擎入门",
            bm25_score=2.5,
            vector_score=0.8,
        )
        assert features.shape == (10,)
        assert features[0] == 2.5  # bm25_score
        assert features[1] == 0.8  # vector_score

    def test_all_features(self):
        """测试完整特征提取"""
        features = self.extractor.extract_all_features(
            query_terms=["搜索"],
            doc_text="搜索引擎文档",
            doc_title="搜索技术",
            doc_meta={"doc_length": 50},
            bm25_score=1.5,
            vector_score=0.9,
        )
        assert features.shape == (25,)  # 5 + 10 + 10 = 25


class TestLTRModel:
    """LTR 模型测试类"""

    def setup_method(self):
        self.model = LTRModel()

    def test_train_and_predict(self):
        """测试模型训练和预测"""
        # 生成训练数据
        np.random.seed(42)
        X = np.random.randn(100, 25).astype(np.float32)
        y = np.random.randint(0, 5, 100).astype(np.float32)
        qid = np.repeat(np.arange(10), 10)

        self.model.train(X, y, qid)
        predictions = self.model.predict(X[:10])
        assert predictions.shape == (10,)

    def test_predict_single(self):
        """测试单样本预测"""
        # 先用合成数据训练
        np.random.seed(42)
        X = np.random.randn(50, 25).astype(np.float32)
        y = np.random.rand(50).astype(np.float32)
        self.model.train(X, y)

        score = self.model.predict_single(
            query_terms=["搜索"],
            doc_text="搜索引擎文档内容",
            doc_title="搜索技术",
        )
        assert isinstance(score, float)

    def test_train_without_group(self):
        """测试无分组的训练"""
        X = np.random.randn(50, 25).astype(np.float32)
        y = np.random.rand(50).astype(np.float32)
        self.model.train(X, y)
        predictions = self.model.predict(X[:5])
        assert predictions.shape == (5,)


class TestRanker:
    """排序器测试类"""

    def setup_method(self):
        """初始化排序器及其依赖组件"""
        self.index = InvertedIndex()

        docs = {
            "doc1": {"title": "搜索引擎原理详解", "content": "搜索引擎通过倒排索引和排序算法实现信息检索"},
            "doc2": {"title": "机器学习基础教程", "content": "机器学习通过数据驱动的方式自动学习模式"},
            "doc3": {"title": "深度学习与NLP", "content": "深度学习在自然语言处理领域取得了重大突破"},
            "doc4": {"title": "搜索引擎优化指南", "content": "SEO 技术帮助网站在搜索引擎中获得更好的排名"},
        }
        for doc_id, doc in docs.items():
            self.index.add_document(doc_id, doc)

        vector_index = VectorIndex()
        texts = [d["title"] + " " + d["content"] for d in docs.values()]
        vector_index.build(texts, list(docs.keys()))

        retriever = Retriever(index=self.index, vector_index=vector_index)

        # 训练一个简单的 LTR 模型
        ltr_model = LTRModel()
        np.random.seed(42)
        X = np.random.randn(50, 25).astype(np.float32)
        y = np.random.rand(50).astype(np.float32)
        ltr_model.train(X, y)

        self.ranker = Ranker(retriever=retriever, ltr_model=ltr_model)

    def test_rank_basic(self):
        """测试基本排序功能"""
        results = self.ranker.rank("搜索引擎", mode="bm25", top_k=3, use_ltr=False)
        assert len(results) > 0
        for doc_id, score in results:
            assert isinstance(doc_id, str)
            assert isinstance(score, (float, np.floating))

    def test_rank_with_ltr(self):
        """测试带 LTR 精排的排序"""
        results = self.ranker.rank("搜索引擎", mode="bm25", top_k=3, use_ltr=True)
        assert len(results) > 0

    def test_rank_hybrid_mode(self):
        """测试混合检索模式的排序"""
        results = self.ranker.rank("搜索引擎", mode="hybrid", top_k=3, use_ltr=False)
        assert len(results) > 0

    def test_rerank(self):
        """测试重排序功能"""
        # 先获取候选文档
        candidates = self.ranker.retriever.bm25_search("搜索引擎", top_k=5)
        assert len(candidates) > 0

        # 准备文档信息
        doc_texts = {}
        doc_titles = {}
        for doc_id, _ in candidates:
            doc = self.index.get_document(doc_id)
            if doc:
                doc_texts[doc_id] = doc.get("content", "")
                doc_titles[doc_id] = doc.get("title", "")

        # 重排序
        reranked = self.ranker.rerank(
            query="搜索引擎",
            candidates=candidates,
            doc_texts=doc_texts,
            doc_titles=doc_titles,
            top_k=3,
        )
        assert len(reranked) <= 3
        for doc_id, score in reranked:
            assert isinstance(doc_id, str)
            assert isinstance(score, (float, np.floating))

    def test_rank_top_k(self):
        """测试 top_k 限制"""
        results = self.ranker.rank("搜索引擎", mode="bm25", top_k=1, use_ltr=False)
        assert len(results) <= 1
