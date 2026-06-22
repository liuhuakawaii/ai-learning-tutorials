"""向量语义检索模块

基于 FAISS 实现向量检索，支持：
- 文本向量化（sentence-transformers）
- 向量索引构建（FAISS Flat / IVF）
- 语义相似度检索
- 向量索引持久化

当没有安装 faiss/sentence-transformers 时，提供基于 numpy 的降级实现。
"""

import logging
import os
import pickle
from typing import Dict, List, Optional, Tuple

import numpy as np

from config.settings import settings

logger = logging.getLogger(__name__)

# 尝试导入 faiss，不可用时使用 numpy 降级
try:
    import faiss
    HAS_FAISS = True
except ImportError:
    HAS_FAISS = False
    logger.warning("faiss 未安装，将使用 numpy 实现向量检索")

# 尝试导入 sentence-transformers
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False
    logger.warning("sentence-transformers 未安装，将使用随机向量模拟")


class VectorIndex:
    """FAISS 向量索引

    封装 FAISS 的向量索引能力，支持 flat 和 IVF 两种索引类型。
    flat 索引适合小规模数据（<10万），IVF 适合大规模数据。

    用法示例：
        index = VectorIndex(dimension=768)
        texts = ["搜索引擎", "信息检索", "机器学习"]
        index.build(texts)
        results = index.search("搜索技术", top_k=2)
    """

    def __init__(
        self,
        dimension: Optional[int] = None,
        index_type: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        """初始化向量索引

        Args:
            dimension: 向量维度，默认从配置读取
            index_type: 索引类型 "flat" 或 "ivf"，默认从配置读取
            model_name: sentence-transformers 模型名，默认从配置读取
        """
        cfg = settings.vector_search
        self.dimension = dimension or cfg.dimension
        self.index_type = index_type or cfg.index_type
        self.model_name = model_name or cfg.model_name

        self._model: Optional[SentenceTransformer] = None
        self._index = None
        self._doc_ids: List[str] = []
        self._doc_texts: Dict[str, str] = {}

    def _get_model(self) -> Optional[SentenceTransformer]:
        """懒加载 sentence-transformers 模型"""
        if self._model is None and HAS_SENTENCE_TRANSFORMERS:
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def encode(self, texts: List[str]) -> np.ndarray:
        """将文本编码为向量

        优先使用 sentence-transformers，不可用时生成确定性伪向量。

        Args:
            texts: 文本列表

        Returns:
            向量矩阵 (n, dimension)
        """
        model = self._get_model()
        if model is not None:
            return model.encode(texts, normalize_embeddings=True)

        # 降级方案：基于文本哈希生成确定性伪向量
        vectors = []
        for text in texts:
            seed = hash(text) % (2**31)
            rng = np.random.RandomState(seed)
            vec = rng.randn(self.dimension).astype(np.float32)
            vec = vec / np.linalg.norm(vec)
            vectors.append(vec)
        return np.array(vectors, dtype=np.float32)

    def build(
        self,
        texts: List[str],
        doc_ids: Optional[List[str]] = None,
    ) -> None:
        """构建向量索引

        Args:
            texts: 文档文本列表
            doc_ids: 文档 ID 列表，为空则自动生成
        """
        if doc_ids is None:
            doc_ids = [f"doc_{i}" for i in range(len(texts))]

        self._doc_ids = doc_ids
        self._doc_texts = dict(zip(doc_ids, texts))

        # 编码为向量
        vectors = self.encode(texts).astype(np.float32)

        # 构建 FAISS 索引
        if HAS_FAISS:
            if self.index_type == "ivf" and len(texts) > 100:
                # IVF 索引适合大规模数据
                nlist = min(int(np.sqrt(len(texts))), 256)
                quantizer = faiss.IndexFlatIP(self.dimension)
                self._index = faiss.IndexIVFFlat(
                    quantizer, self.dimension, nlist, faiss.METRIC_INNER_PRODUCT
                )
                self._index.train(vectors)
                self._index.add(vectors)
            else:
                # Flat 索引：精确搜索
                self._index = faiss.IndexFlatIP(self.dimension)
                self._index.add(vectors)
        else:
            # 降级：存储原始向量，用 numpy 计算
            self._index = vectors

    def search(
        self, query: str, top_k: Optional[int] = None
    ) -> List[Tuple[str, float]]:
        """语义检索

        Args:
            query: 查询文本
            top_k: 返回前 K 个结果，默认从配置读取

        Returns:
            [(doc_id, similarity_score), ...] 按相似度降序排列
        """
        if self._index is None:
            return []

        if top_k is None:
            top_k = settings.vector_search.top_k

        query_vec = self.encode([query]).astype(np.float32)

        if HAS_FAISS:
            scores, indices = self._index.search(query_vec, min(top_k, len(self._doc_ids)))
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx < 0 or idx >= len(self._doc_ids):
                    continue
                results.append((self._doc_ids[idx], float(score)))
            return results
        else:
            # numpy 降级：计算余弦相似度
            stored_vectors = self._index
            similarities = stored_vectors @ query_vec.T
            similarities = similarities.flatten()
            top_indices = np.argsort(similarities)[::-1][:top_k]
            return [
                (self._doc_ids[i], float(similarities[i]))
                for i in top_indices
                if i < len(self._doc_ids)
            ]

    def save(self, directory: str) -> None:
        """保存向量索引到磁盘

        Args:
            directory: 保存目录
        """
        os.makedirs(directory, exist_ok=True)

        # 保存 FAISS 索引
        if HAS_FAISS and self._index is not None:
            faiss.write_index(self._index, os.path.join(directory, "faiss.index"))
        else:
            np.save(os.path.join(directory, "vectors.npy"), self._index)

        # 保存元数据
        with open(os.path.join(directory, "meta.pkl"), "wb") as f:
            pickle.dump({
                "doc_ids": self._doc_ids,
                "doc_texts": self._doc_texts,
                "dimension": self.dimension,
                "index_type": self.index_type,
            }, f)

    def load(self, directory: str) -> None:
        """从磁盘加载向量索引

        Args:
            directory: 索引目录
        """
        # 加载元数据
        with open(os.path.join(directory, "meta.pkl"), "rb") as f:
            meta = pickle.load(f)
            self._doc_ids = meta["doc_ids"]
            self._doc_texts = meta["doc_texts"]
            self.dimension = meta["dimension"]
            self.index_type = meta["index_type"]

        # 加载索引
        faiss_path = os.path.join(directory, "faiss.index")
        numpy_path = os.path.join(directory, "vectors.npy")

        if HAS_FAISS and os.path.exists(faiss_path):
            self._index = faiss.read_index(faiss_path)
        elif os.path.exists(numpy_path):
            self._index = np.load(numpy_path)
