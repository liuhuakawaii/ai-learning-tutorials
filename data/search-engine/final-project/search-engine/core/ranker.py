"""排序器模块

整合 BM25、向量检索和 LTR 模型，提供端到端的检索排序管线。

排序流程：
1. 检索阶段（Retriever）：快速召回候选文档
2. 粗排阶段（BM25 + 向量）：对候选文档初步排序
3. 精排阶段（LTR）：使用 Learning-to-Rank 模型精细排序
"""

from typing import Dict, List, Optional, Tuple

from core.retriever import Retriever
from models.ltr import LTRModel


class Ranker:
    """排序器

    将检索结果通过 LTR 模型进行重排序，提升搜索质量。

    用法示例：
        ranker = Ranker(retriever=retriever, ltr_model=ltr_model)
        results = ranker.rank("搜索引擎原理", top_k=10)
    """

    def __init__(
        self,
        retriever: Optional[Retriever] = None,
        ltr_model: Optional[LTRModel] = None,
    ):
        """初始化排序器

        Args:
            retriever: 检索器实例
            ltr_model: LTR 排序模型实例
        """
        self.retriever = retriever or Retriever()
        self.ltr_model = ltr_model or LTRModel()

    def rerank(
        self,
        query: str,
        candidates: List[Tuple[str, float]],
        doc_texts: Optional[Dict[str, str]] = None,
        doc_titles: Optional[Dict[str, str]] = None,
        doc_metas: Optional[Dict[str, Dict[str, float]]] = None,
        top_k: int = 10,
    ) -> List[Tuple[str, float]]:
        """使用 LTR 模型对候选文档重排序

        Args:
            query: 查询文本
            candidates: 候选文档列表 [(doc_id, retrieval_score), ...]
            doc_texts: 文档正文 {doc_id: text}
            doc_titles: 文档标题 {doc_id: title}
            doc_metas: 文档元数据 {doc_id: meta_dict}
            top_k: 返回前 K 个结果

        Returns:
            [(doc_id, ltr_score), ...] 按 LTR 分数降序排列
        """
        if not candidates:
            return []

        query_terms = self.retriever.index.tokenizer.tokenize(query)

        scored_docs = []
        for doc_id, retrieval_score in candidates:
            doc_text = (doc_texts or {}).get(doc_id, "")
            doc_title = (doc_titles or {}).get(doc_id, "")
            doc_meta = (doc_metas or {}).get(doc_id, {})

            ltr_score = self.ltr_model.predict_single(
                query_terms=query_terms,
                doc_text=doc_text,
                doc_title=doc_title,
                doc_meta=doc_meta,
                bm25_score=retrieval_score,
            )
            scored_docs.append((doc_id, ltr_score))

        scored_docs.sort(key=lambda x: x[1], reverse=True)
        return scored_docs[:top_k]

    def rank(
        self,
        query: str,
        mode: str = "hybrid",
        top_k: int = 10,
        use_ltr: bool = True,
        **kwargs,
    ) -> List[Tuple[str, float]]:
        """端到端检索排序

        完整的检索排序流程：召回 → 粗排 → 精排。

        Args:
            query: 查询文本
            mode: 检索模式 ("bm25", "vector", "hybrid")
            top_k: 返回前 K 个结果
            use_ltr: 是否使用 LTR 精排
            **kwargs: 传递给检索器的额外参数

        Returns:
            [(doc_id, score), ...] 按最终分数降序排列
        """
        # 第一步：检索召回
        candidates = self.retriever.search(
            query=query, mode=mode, top_k=top_k * 3, **kwargs
        )

        if not use_ltr:
            return candidates[:top_k]

        # 第二步：LTR 精排
        doc_texts = {}
        doc_titles = {}
        for doc_id, _ in candidates:
            doc = self.retriever.index.get_document(doc_id)
            if doc:
                doc_texts[doc_id] = doc.get("content", "")
                doc_titles[doc_id] = doc.get("title", "")

        reranked = self.rerank(
            query=query,
            candidates=candidates,
            doc_texts=doc_texts,
            doc_titles=doc_titles,
            top_k=top_k,
        )

        return reranked
