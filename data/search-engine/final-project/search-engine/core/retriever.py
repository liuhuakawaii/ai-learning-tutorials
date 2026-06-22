"""检索器模块

整合 BM25、向量检索和混合检索能力，提供统一的检索接口。

支持三种检索模式：
- BM25 检索：基于词频-逆文档频率的经典检索
- 向量检索：基于语义相似度的检索
- 混合检索：融合 BM25 和向量检索结果，使用 RRF（Reciprocal Rank Fusion）算法
"""

from typing import Dict, List, Optional, Tuple

from config.settings import settings
from core.indexer import InvertedIndex
from models.bm25 import BM25
from models.vector_search import VectorIndex


class Retriever:
    """多策略检索器

    封装 BM25 和向量检索，提供统一的检索接口。
    支持纯 BM25、纯向量、混合检索三种模式。

    用法示例：
        retriever = Retriever(index=inverted_index, vector_index=vec_index)
        results = retriever.hybrid_search("搜索引擎原理", top_k=10)
    """

    def __init__(
        self,
        index: Optional[InvertedIndex] = None,
        vector_index: Optional[VectorIndex] = None,
        bm25_model: Optional[BM25] = None,
    ):
        """初始化检索器

        Args:
            index: 倒排索引实例
            vector_index: 向量索引实例
            bm25_model: BM25 模型实例
        """
        self.index = index or InvertedIndex()
        self.vector_index = vector_index
        self.bm25 = bm25_model or BM25()

    def bm25_search(
        self, query: str, top_k: int = 10
    ) -> List[Tuple[str, float]]:
        """BM25 检索

        基于倒排索引和 BM25 算法进行检索。

        Args:
            query: 查询文本
            top_k: 返回前 K 个结果

        Returns:
            [(doc_id, bm25_score), ...] 按得分降序排列
        """
        query_terms = self.index.tokenizer.tokenize(query)
        if not query_terms:
            return []

        # 收集候选文档（所有包含至少一个查询词项的文档）
        candidate_ids: set = set()
        for term in query_terms:
            for posting in self.index.get_postings(term):
                candidate_ids.add(posting.doc_id)

        if not candidate_ids:
            return []

        # 构建每个文档的词频字典
        doc_term_freqs_map: Dict[str, Dict[str, int]] = {}
        for doc_id in candidate_ids:
            dtf: Dict[str, int] = {}
            for term in query_terms:
                for posting in self.index.get_postings(term):
                    if posting.doc_id == doc_id:
                        dtf[term] = posting.term_freq
                        break
            doc_term_freqs_map[doc_id] = dtf

        # 构建文档频率字典
        doc_freqs = {term: self.index.get_doc_freq(term) for term in query_terms}
        doc_lengths = {
            doc_id: self.index.get_doc_length(doc_id) for doc_id in candidate_ids
        }

        # 计算 BM25 分数
        results = self.bm25.batch_score(
            query_terms=query_terms,
            candidate_doc_ids=list(candidate_ids),
            doc_term_freqs_map=doc_term_freqs_map,
            doc_lengths=doc_lengths,
            total_docs=self.index.total_docs,
            doc_freqs=doc_freqs,
        )

        return results[:top_k]

    def vector_search(
        self, query: str, top_k: int = 10
    ) -> List[Tuple[str, float]]:
        """向量语义检索

        基于 FAISS 向量索引进行语义相似度检索。

        Args:
            query: 查询文本
            top_k: 返回前 K 个结果

        Returns:
            [(doc_id, similarity_score), ...] 按相似度降序排列
        """
        if self.vector_index is None:
            return []
        return self.vector_index.search(query, top_k=top_k)

    def hybrid_search(
        self,
        query: str,
        top_k: int = 10,
        bm25_weight: Optional[float] = None,
        vector_weight: Optional[float] = None,
        rrf_k: Optional[int] = None,
    ) -> List[Tuple[str, float]]:
        """混合检索（BM25 + 向量 + RRF 融合）

        使用 Reciprocal Rank Fusion (RRF) 算法融合 BM25 和向量检索的结果。
        RRF 公式：score(d) = Σ 1 / (k + rank_i(d))

        Args:
            query: 查询文本
            top_k: 返回前 K 个结果
            bm25_weight: BM25 权重，默认从配置读取
            vector_weight: 向量检索权重，默认从配置读取
            rrf_k: RRF 参数 k，默认从配置读取

        Returns:
            [(doc_id, rrf_score), ...] 按融合分数降序排列
        """
        cfg = settings.hybrid
        bw = bm25_weight if bm25_weight is not None else cfg.bm25_weight
        vw = vector_weight if vector_weight is not None else cfg.vector_weight
        k = rrf_k if rrf_k is not None else cfg.rrf_k

        # 获取两个检索器的结果
        bm25_results = self.bm25_search(query, top_k=top_k * 3)
        vector_results = self.vector_search(query, top_k=top_k * 3)

        # 使用 RRF 融合
        rrf_scores: Dict[str, float] = {}

        for rank, (doc_id, _) in enumerate(bm25_results):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + bw / (k + rank + 1)

        for rank, (doc_id, _) in enumerate(vector_results):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + vw / (k + rank + 1)

        # 按 RRF 分数降序排列
        sorted_results = sorted(
            rrf_scores.items(), key=lambda x: x[1], reverse=True
        )
        return sorted_results[:top_k]

    def search(
        self,
        query: str,
        mode: str = "hybrid",
        top_k: int = 10,
        **kwargs,
    ) -> List[Tuple[str, float]]:
        """统一检索入口

        Args:
            query: 查询文本
            mode: 检索模式，可选 "bm25"、"vector"、"hybrid"
            top_k: 返回前 K 个结果
            **kwargs: 传递给具体检索方法的额外参数

        Returns:
            [(doc_id, score), ...] 按分数降序排列

        Raises:
            ValueError: 不支持的检索模式
        """
        if mode == "bm25":
            return self.bm25_search(query, top_k=top_k)
        elif mode == "vector":
            return self.vector_search(query, top_k=top_k)
        elif mode == "hybrid":
            return self.hybrid_search(query, top_k=top_k, **kwargs)
        else:
            raise ValueError(f"不支持的检索模式: {mode}，可选 bm25/vector/hybrid")
