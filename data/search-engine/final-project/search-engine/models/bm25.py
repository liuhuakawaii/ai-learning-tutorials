"""BM25 检索模型

实现经典的 BM25（Best Matching 25）排序算法，用于基于词频-逆文档频率的文档检索。

BM25 公式：
    score(q, d) = Σ IDF(qi) * (f(qi, d) * (k1 + 1)) / (f(qi, d) + k1 * (1 - b + b * |d| / avgdl))

其中：
    - IDF(qi) = log((N - n(qi) + 0.5) / (n(qi) + 0.5) + 1)
    - f(qi, d) 是词项 qi 在文档 d 中的词频
    - |d| 是文档长度
    - avgdl 是平均文档长度
    - k1 和 b 是可调参数
"""

import math
from typing import Dict, List, Optional, Tuple

from config.settings import BM25Config, settings


class BM25:
    """BM25 排序模型

    经典的概率检索模型，通过词频、逆文档频率和文档长度归一化
    来计算查询与文档的相关性得分。

    参数说明：
    - k1：控制词频饱和度，值越大，高频词的影响越大（典型值 1.2-2.0）
    - b：控制文档长度归一化程度，0 表示不归一化，1 表示完全归一化（典型值 0.75）

    用法示例：
        bm25 = BM25(k1=1.5, b=0.75)
        scores = bm25.score(query_terms, doc_term_freqs, doc_lengths, avgdl, total_docs, doc_freqs)
    """

    def __init__(
        self,
        k1: Optional[float] = None,
        b: Optional[float] = None,
        avgdl: Optional[float] = None,
        config: Optional[BM25Config] = None,
    ):
        """初始化 BM25 模型

        Args:
            k1: 词频饱和参数，默认从配置读取
            b: 文档长度归一化参数，默认从配置读取
            avgdl: 平均文档长度，默认从配置读取
            config: BM25 配置对象，优先级低于直接传入的参数
        """
        cfg = config or settings.bm25
        self.k1 = k1 if k1 is not None else cfg.k1
        self.b = b if b is not None else cfg.b
        self.avgdl = avgdl if avgdl is not None else cfg.avgdl

    def idf(self, doc_freq: int, total_docs: int) -> float:
        """计算逆文档频率（IDF）

        使用 Robertson-Sparck Jones 公式：
        IDF = log((N - n + 0.5) / (n + 0.5) + 1)

        Args:
            doc_freq: 包含该词项的文档数
            total_docs: 文档总数

        Returns:
            IDF 值
        """
        numerator = total_docs - doc_freq + 0.5
        denominator = doc_freq + 0.5
        return math.log(numerator / denominator + 1.0)

    def term_score(
        self,
        term_freq: int,
        doc_freq: int,
        total_docs: int,
        doc_length: int,
    ) -> float:
        """计算单个词项对文档的 BM25 得分

        Args:
            term_freq: 词项在文档中的词频
            doc_freq: 包含该词项的文档数
            total_docs: 文档总数
            doc_length: 文档长度（词项数）

        Returns:
            该词项的 BM25 得分
        """
        idf_value = self.idf(doc_freq, total_docs)
        tf_component = (term_freq * (self.k1 + 1)) / (
            term_freq + self.k1 * (1 - self.b + self.b * doc_length / self.avgdl)
        )
        return idf_value * tf_component

    def score(
        self,
        query_terms: List[str],
        doc_term_freqs: Dict[str, int],
        doc_length: int,
        total_docs: int,
        doc_freqs: Dict[str, int],
    ) -> float:
        """计算查询对单个文档的 BM25 总分

        对查询中的每个词项，计算其对文档的得分并累加。

        Args:
            query_terms: 查询词项列表
            doc_term_freqs: 文档中各词项的词频字典
            doc_length: 文档长度
            total_docs: 文档总数
            doc_freqs: 各词项的文档频率字典

        Returns:
            查询对该文档的 BM25 总分
        """
        score_sum = 0.0
        for term in query_terms:
            if term not in doc_term_freqs:
                continue
            df = doc_freqs.get(term, 0)
            tf = doc_term_freqs[term]
            score_sum += self.term_score(tf, df, total_docs, doc_length)
        return score_sum

    def batch_score(
        self,
        query_terms: List[str],
        candidate_doc_ids: List[str],
        doc_term_freqs_map: Dict[str, Dict[str, int]],
        doc_lengths: Dict[str, int],
        total_docs: int,
        doc_freqs: Dict[str, int],
    ) -> List[Tuple[str, float]]:
        """批量计算多个文档的 BM25 得分

        Args:
            query_terms: 查询词项列表
            candidate_doc_ids: 候选文档 ID 列表
            doc_term_freqs_map: 每个文档的词频字典 {doc_id: {term: freq}}
            doc_lengths: 每个文档的长度 {doc_id: length}
            total_docs: 文档总数
            doc_freqs: 各词项的文档频率字典

        Returns:
            [(doc_id, score), ...] 按得分降序排列
        """
        results = []
        for doc_id in candidate_doc_ids:
            dtf = doc_term_freqs_map.get(doc_id, {})
            dl = doc_lengths.get(doc_id, 0)
            s = self.score(query_terms, dtf, dl, total_docs, doc_freqs)
            results.append((doc_id, s))
        results.sort(key=lambda x: x[1], reverse=True)
        return results
