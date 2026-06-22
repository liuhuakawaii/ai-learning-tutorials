"""检索模块

支持向量检索、关键词检索和混合检索。

使用方法:
    python src/retrieve.py --query "什么是 RAG?" --mode hybrid --top-k 5
"""

import argparse
import logging
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class SearchResult:
    """检索结果"""

    def __init__(self, content: str, score: float, metadata: dict):
        self.content = content
        self.score = score
        self.metadata = metadata

    def __repr__(self):
        return f"SearchResult(score={self.score:.4f}, content={self.content[:50]}...)"


class BaseRetriever(ABC):
    """检索器基类"""

    @abstractmethod
    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        raise NotImplementedError


class VectorRetriever(BaseRetriever):
    """向量检索器"""

    def __init__(self, collection_name: str = "default"):
        self.collection_name = collection_name
        self._client = None
        self._embedder = None

    def _get_embedder(self):
        if self._embedder is None:
            from openai import OpenAI
            self._embedder = OpenAI()
        return self._embedder

    def _embed(self, text: str) -> list[float]:
        client = self._get_embedder()
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        query_vector = self._embed(query)
        # Placeholder: connect to actual vector DB
        # In production, query Qdrant/Milvus/etc.
        logger.info(f"向量检索: query='{query}', top_k={top_k}")
        return []


class BM25Retriever(BaseRetriever):
    """BM25 关键词检索器"""

    def __init__(self, corpus: list[str] = None):
        self.corpus = corpus or []
        self._bm25 = None

    def _build_index(self, documents: list[str]):
        from rank_bm25 import BM25Okapi
        tokenized = [doc.lower().split() for doc in documents]
        self._bm25 = BM25Okapi(tokenized)
        self.corpus = documents

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        if self._bm25 is None:
            logger.warning("BM25 索引未建立")
            return []

        tokenized_query = query.lower().split()
        scores = self._bm25.get_scores(tokenized_query)
        top_indices = scores.argsort()[-top_k:][::-1]

        results = []
        for idx in top_indices:
            if scores[idx] > 0:
                results.append(SearchResult(
                    content=self.corpus[idx],
                    score=float(scores[idx]),
                    metadata={"method": "bm25", "index": int(idx)},
                ))
        return results


class HybridRetriever(BaseRetriever):
    """混合检索器 (向量 + BM25)"""

    def __init__(
        self,
        vector_weight: float = 0.7,
        bm25_weight: float = 0.3,
    ):
        self.vector_weight = vector_weight
        self.bm25_weight = bm25_weight
        self.vector_retriever = VectorRetriever()
        self.bm25_retriever = BM25Retriever()

    def reciprocal_rank_fusion(
        self,
        results_list: list[list[SearchResult]],
        k: int = 60,
    ) -> list[SearchResult]:
        """RRF 融合算法"""
        scores = {}
        for results in results_list:
            for rank, result in enumerate(results):
                key = result.content
                if key not in scores:
                    scores[key] = {"score": 0, "result": result}
                scores[key]["score"] += 1 / (k + rank + 1)

        sorted_results = sorted(
            scores.values(),
            key=lambda x: x["score"],
            reverse=True,
        )
        return [
            SearchResult(
                content=item["result"].content,
                score=item["score"],
                metadata={**item["result"].metadata, "method": "hybrid_rrf"},
            )
            for item in sorted_results
        ]

    def search(self, query: str, top_k: int = 5) -> list[SearchResult]:
        vector_results = self.vector_retriever.search(query, top_k=top_k * 2)
        bm25_results = self.bm25_retriever.search(query, top_k=top_k * 2)

        fused = self.reciprocal_rank_fusion([vector_results, bm25_results])
        return fused[:top_k]


class Reranker:
    """重排序器"""

    def __init__(self, model: str = "rerank-multilingual-v3.0"):
        self.model = model

    def rerank(
        self,
        query: str,
        results: list[SearchResult],
        top_k: int = 5,
    ) -> list[SearchResult]:
        """对检索结果进行重排序"""
        # Placeholder: integrate Cohere or cross-encoder
        # In production, call reranking API
        logger.info(f"重排序: {len(results)} 个结果 -> top {top_k}")
        return results[:top_k]


def main():
    parser = argparse.ArgumentParser(description="检索工具")
    parser.add_argument("--query", required=True, help="查询内容")
    parser.add_argument("--mode", default="hybrid", choices=["vector", "bm25", "hybrid"])
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if args.mode == "vector":
        retriever = VectorRetriever()
    elif args.mode == "bm25":
        retriever = BM25Retriever()
    else:
        retriever = HybridRetriever()

    results = retriever.search(args.query, top_k=args.top_k)

    print(f"\n查询: {args.query}")
    print(f"模式: {args.mode}")
    print(f"结果 ({len(results)}):")
    for i, r in enumerate(results, 1):
        print(f"  {i}. [{r.score:.4f}] {r.content[:100]}...")


if __name__ == "__main__":
    main()
