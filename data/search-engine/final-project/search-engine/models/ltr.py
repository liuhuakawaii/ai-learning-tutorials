"""Learning-to-Rank 排序模型

实现基于 LightGBM 的 LambdaMART 排序算法，支持：
- 特征工程（查询特征、文档特征、交互特征）
- 模型训练与预测
- 模型持久化
- 在线推理

特征体系包含 25 维特征：
- 查询侧特征（5维）：查询长度、查询词项数、是否包含数字、是否包含英文、查询熵
- 文档侧特征（10维）：文档长度、标题长度、PageRank、新鲜度、点击率等
- 查询-文档交互特征（10维）：BM25 分数、TF-IDF 分数、标题匹配、覆盖率等
"""

import logging
import os
import pickle
from typing import Dict, List, Optional, Tuple

import numpy as np

from config.settings import settings

logger = logging.getLogger(__name__)

# 尝试导入 LightGBM
try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False
    logger.warning("lightgbm 未安装，LTR 模型将使用简化线性模型")


class FeatureExtractor:
    """LTR 特征提取器

    从查询和文档中提取排序所需的特征向量。
    """

    def __init__(self):
        self._feature_dim = settings.ltr.feature_dim

    def extract_query_features(self, query_terms: List[str]) -> np.ndarray:
        """提取查询侧特征

        Args:
            query_terms: 查询词项列表

        Returns:
            查询特征向量 (5,)
        """
        query_text = "".join(query_terms)
        features = [
            len(query_text),                           # 查询字符长度
            len(query_terms),                          # 查询词项数
            float(any(c.isdigit() for c in query_text)),  # 是否包含数字
            float(any(c.isascii() and c.isalpha() for c in query_text)),  # 是否包含英文
            self._text_entropy(query_text),            # 查询文本熵
        ]
        return np.array(features, dtype=np.float32)

    def extract_doc_features(
        self, doc_meta: Dict[str, float]
    ) -> np.ndarray:
        """提取文档侧特征

        Args:
            doc_meta: 文档元数据字典，包含以下可选字段：
                - doc_length: 文档长度
                - title_length: 标题长度
                - pagerank: PageRank 值
                - freshness: 新鲜度（时间戳或衰减因子）
                - click_rate: 点击率
                - dwell_time: 平均停留时间
                - bounce_rate: 跳出率
                - num_links: 链接数
                - num_images: 图片数
                - is_official: 是否官方文档

        Returns:
            文档特征向量 (10,)
        """
        features = [
            doc_meta.get("doc_length", 0),
            doc_meta.get("title_length", 0),
            doc_meta.get("pagerank", 0.0),
            doc_meta.get("freshness", 0.0),
            doc_meta.get("click_rate", 0.0),
            doc_meta.get("dwell_time", 0.0),
            doc_meta.get("bounce_rate", 0.0),
            doc_meta.get("num_links", 0),
            doc_meta.get("num_images", 0),
            float(doc_meta.get("is_official", False)),
        ]
        return np.array(features, dtype=np.float32)

    def extract_interaction_features(
        self,
        query_terms: List[str],
        doc_text: str,
        doc_title: str,
        bm25_score: float = 0.0,
        vector_score: float = 0.0,
    ) -> np.ndarray:
        """提取查询-文档交互特征

        Args:
            query_terms: 查询词项列表
            doc_text: 文档正文
            doc_title: 文档标题
            bm25_score: BM25 检索分数
            vector_score: 向量检索分数

        Returns:
            交互特征向量 (10,)
        """
        query_set = set(query_terms)
        doc_tokens = set(doc_text)
        title_tokens = set(doc_title)

        # 查询词项在文档中的覆盖率
        matched_in_doc = query_set & doc_tokens
        matched_in_title = query_set & title_tokens

        coverage_doc = len(matched_in_doc) / max(len(query_set), 1)
        coverage_title = len(matched_in_title) / max(len(query_set), 1)

        features = [
            bm25_score,                                  # BM25 分数
            vector_score,                                # 向量相似度分数
            coverage_doc,                                # 正文覆盖率
            coverage_title,                              # 标题覆盖率
            float(len(matched_in_doc)),                  # 正文匹配词数
            float(len(matched_in_title)),                # 标题匹配词数
            len(doc_text),                               # 文档长度
            len(doc_title),                              # 标题长度
            self._query_doc_similarity(query_terms, doc_text),  # 词项重叠比
            float(bool(matched_in_title)),               # 标题是否完全匹配,
        ]
        return np.array(features, dtype=np.float32)

    def extract_all_features(
        self,
        query_terms: List[str],
        doc_text: str,
        doc_title: str,
        doc_meta: Optional[Dict[str, float]] = None,
        bm25_score: float = 0.0,
        vector_score: float = 0.0,
    ) -> np.ndarray:
        """提取全部特征并拼接

        Args:
            query_terms: 查询词项列表
            doc_text: 文档正文
            doc_title: 文档标题
            doc_meta: 文档元数据
            bm25_score: BM25 分数
            vector_score: 向量分数

        Returns:
            完整特征向量 (25,)
        """
        qf = self.extract_query_features(query_terms)
        df = self.extract_doc_features(doc_meta or {})
        intf = self.extract_interaction_features(
            query_terms, doc_text, doc_title, bm25_score, vector_score
        )
        return np.concatenate([qf, df, intf])

    def _text_entropy(self, text: str) -> float:
        """计算文本的信息熵"""
        if not text:
            return 0.0
        freq: Dict[str, int] = {}
        for ch in text:
            freq[ch] = freq.get(ch, 0) + 1
        total = len(text)
        entropy = 0.0
        for count in freq.values():
            p = count / total
            if p > 0:
                entropy -= p * np.log2(p)
        return entropy

    def _query_doc_similarity(
        self, query_terms: List[str], doc_text: str
    ) -> float:
        """计算查询与文档的词项重叠比"""
        if not query_terms:
            return 0.0
        query_set = set(query_terms)
        doc_set = set(doc_text)
        overlap = len(query_set & doc_set)
        return overlap / len(query_set)


class LTRModel:
    """Learning-to-Rank 模型

    基于 LightGBM LambdaMART 实现排序模型的训练和预测。
    当 LightGBM 不可用时，降级为线性模型。

    用法示例：
        model = LTRModel()
        model.train(X_train, y_train, qid_train)
        predictions = model.predict(X_test)
    """

    def __init__(self, feature_dim: Optional[int] = None):
        """初始化 LTR 模型

        Args:
            feature_dim: 特征维度
        """
        self.feature_dim = feature_dim or settings.ltr.feature_dim
        self.model = None
        self._weights: Optional[np.ndarray] = None
        self.feature_extractor = FeatureExtractor()

    def train(
        self,
        X: np.ndarray,
        y: np.ndarray,
        qid: Optional[np.ndarray] = None,
    ) -> None:
        """训练排序模型

        Args:
            X: 特征矩阵 (n_samples, feature_dim)
            y: 相关性标签 (n_samples,)
            qid: 查询分组 ID (n_samples,)，用于 LambdaMART 的分组
        """
        if HAS_LIGHTGBM:
            # 使用 LightGBM LambdaMART
            params = {
                "objective": "lambdarank",
                "metric": "ndcg",
                "ndcg_eval_at": [5, 10],
                "learning_rate": settings.ltr.learning_rate,
                "num_leaves": 31,
                "min_data_in_leaf": 10,
                "feature_fraction": 0.8,
                "bagging_fraction": 0.8,
                "bagging_freq": 5,
                "verbose": -1,
            }

            # 构建 LightGBM 数据集
            if qid is not None:
                # 按 qid 分组统计每组的文档数
                unique_qids = np.unique(qid)
                group = [np.sum(qid == q) for q in unique_qids]
                train_set = lgb.Dataset(X, label=y, group=group)
            else:
                train_set = lgb.Dataset(X, label=y)

            self.model = lgb.train(
                params,
                train_set,
                num_boost_round=settings.ltr.num_trees,
            )
            logger.info("LightGBM LambdaMART 模型训练完成")
        else:
            # 降级方案：简单线性模型
            self._weights = np.linalg.lstsq(X, y, rcond=None)[0]
            logger.info("线性排序模型训练完成（LightGBM 不可用）")

    def predict(self, X: np.ndarray) -> np.ndarray:
        """预测排序分数

        Args:
            X: 特征矩阵 (n_samples, feature_dim)

        Returns:
            排序分数 (n_samples,)
        """
        if self.model is not None:
            return self.model.predict(X)
        elif self._weights is not None:
            return X @ self._weights
        else:
            raise RuntimeError("模型未训练，请先调用 train()")

    def predict_single(
        self,
        query_terms: List[str],
        doc_text: str,
        doc_title: str,
        doc_meta: Optional[Dict[str, float]] = None,
        bm25_score: float = 0.0,
        vector_score: float = 0.0,
    ) -> float:
        """预测单个查询-文档对的排序分数

        Args:
            query_terms: 查询词项列表
            doc_text: 文档正文
            doc_title: 文档标题
            doc_meta: 文档元数据
            bm25_score: BM25 分数
            vector_score: 向量分数

        Returns:
            排序分数
        """
        features = self.feature_extractor.extract_all_features(
            query_terms, doc_text, doc_title, doc_meta, bm25_score, vector_score
        )
        features = features.reshape(1, -1)
        return float(self.predict(features)[0])

    def save(self, path: Optional[str] = None) -> None:
        """保存模型到文件

        Args:
            path: 保存路径，默认从配置读取
        """
        save_path = path or settings.ltr.model_path
        os.makedirs(os.path.dirname(save_path) or ".", exist_ok=True)

        data = {
            "feature_dim": self.feature_dim,
            "weights": self._weights,
        }
        if HAS_LIGHTGBM and self.model is not None:
            data["lgb_model"] = self.model

        with open(save_path, "wb") as f:
            pickle.dump(data, f)
        logger.info(f"LTR 模型已保存到 {save_path}")

    def load(self, path: Optional[str] = None) -> None:
        """从文件加载模型

        Args:
            path: 模型文件路径，默认从配置读取
        """
        load_path = path or settings.ltr.model_path
        with open(load_path, "rb") as f:
            data = pickle.load(f)

        self.feature_dim = data["feature_dim"]
        self._weights = data.get("weights")
        if "lgb_model" in data:
            self.model = data["lgb_model"]
        logger.info(f"LTR 模型已从 {load_path} 加载")
