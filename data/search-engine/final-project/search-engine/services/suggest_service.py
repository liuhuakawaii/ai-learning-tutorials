"""搜索建议服务模块

提供搜索框的自动补全和纠错功能，包括：
- 前缀匹配建议
- 拼写纠错
- 热门搜索词推荐
- 搜索历史联想
"""

import logging
from collections import Counter
from typing import Any, Dict, List, Optional

from config.settings import settings
from core.tokenizer import Tokenizer

logger = logging.getLogger(__name__)

try:
    from elasticsearch import Elasticsearch
    HAS_ELASTICSEARCH = True
except ImportError:
    HAS_ELASTICSEARCH = False


class SuggestService:
    """搜索建议服务

    为搜索框提供自动补全、纠错和热门推荐功能。

    用法示例：
        service = SuggestService()
        suggestions = service.suggest("搜索引擎")
        corrections = service.correct("搜所引擎")
    """

    def __init__(
        self,
        es_client: Optional[Any] = None,
        tokenizer: Optional[Tokenizer] = None,
    ):
        """初始化建议服务

        Args:
            es_client: Elasticsearch 客户端
            tokenizer: 分词器实例
        """
        self._es = es_client
        self.tokenizer = tokenizer or Tokenizer()

        # 内存中的搜索历史和热门词（生产环境应使用 Redis）
        self._search_history: Counter = Counter()
        self._popular_queries: List[str] = [
            "搜索引擎", "机器学习", "深度学习", "自然语言处理",
            "推荐系统", "分布式系统", "微服务架构", "数据库优化",
        ]

        if self._es is None and HAS_ELASTICSEARCH:
            try:
                self._es = Elasticsearch(
                    hosts=settings.elasticsearch.hosts,
                    request_timeout=settings.elasticsearch.request_timeout,
                )
            except Exception as e:
                logger.warning(f"无法连接 Elasticsearch: {e}")

    def suggest(
        self,
        prefix: str,
        index_name: Optional[str] = None,
        field: str = "title.suggest",
        size: int = 10,
    ) -> List[str]:
        """前缀匹配建议

        根据用户输入的前缀，返回匹配的搜索建议。

        Args:
            prefix: 用户输入的前缀文本
            index_name: 索引名称
            field: 用于建议的字段
            size: 返回建议数量

        Returns:
            建议词列表
        """
        if not prefix or not prefix.strip():
            return self.get_popular_queries(size)

        suggestions = []

        # 从 Elasticsearch 获取建议
        if self._es is not None:
            name = index_name or settings.elasticsearch.index_name
            try:
                body = {
                    "suggest": {
                        "title_suggest": {
                            "prefix": prefix.strip(),
                            "completion": {
                                "field": field,
                                "size": size,
                            },
                        }
                    }
                }
                response = self._es.search(index=name, body=body)
                for option in response["suggest"]["title_suggest"][0]["options"]:
                    suggestions.append(option["text"])
            except Exception:
                # completion suggester 不可用时，降级到 match 查询
                try:
                    body = {
                        "query": {
                            "match_phrase_prefix": {
                                "title": {"query": prefix.strip(), "max_expansions": 10}
                            }
                        },
                        "size": size,
                        "_source": ["title"],
                    }
                    response = self._es.search(index=name, body=body)
                    for hit in response["hits"]["hits"]:
                        title = hit["_source"].get("title", "")
                        if title and title not in suggestions:
                            suggestions.append(title)
                except Exception as e:
                    logger.warning(f"ES 建议查询失败: {e}")

        # 补充：从搜索历史中匹配
        for query, count in self._search_history.most_common(100):
            if prefix in query and query not in suggestions:
                suggestions.append(query)
            if len(suggestions) >= size:
                break

        return suggestions[:size]

    def correct(
        self,
        query: str,
        index_name: Optional[str] = None,
    ) -> Optional[str]:
        """拼写纠错

        使用 ES 的 phrase suggester 进行拼写纠错。

        Args:
            query: 用户输入的查询
            index_name: 索引名称

        Returns:
            纠正后的文本，无需纠正则返回 None
        """
        if self._es is None:
            return None

        name = index_name or settings.elasticsearch.index_name
        try:
            body = {
                "suggest": {
                    "text": query,
                    "phrase_suggestion": {
                        "phrase": {
                            "field": "title",
                            "size": 1,
                            "direct_generator": [{
                                "field": "title",
                                "suggest_mode": "popular",
                            }],
                        }
                    },
                }
            }
            response = self._es.search(index=name, body=body)
            suggestions = response["suggest"]["phrase_suggestion"][0]["options"]
            if suggestions:
                corrected = suggestions[0]["text"]
                if corrected != query:
                    return corrected
        except Exception as e:
            logger.debug(f"拼写纠错失败: {e}")

        return None

    def record_search(self, query: str) -> None:
        """记录搜索历史

        Args:
            query: 用户搜索的查询文本
        """
        self._search_history[query.strip()] += 1

    def get_popular_queries(self, size: int = 10) -> List[str]:
        """获取热门搜索词

        Args:
            size: 返回数量

        Returns:
            热门搜索词列表
        """
        # 合并预设热门词和实际搜索历史
        history_top = [q for q, _ in self._search_history.most_common(size)]
        combined = []
        for q in history_top + self._popular_queries:
            if q not in combined:
                combined.append(q)
            if len(combined) >= size:
                break
        return combined

    def get_suggestions_by_tokens(
        self, query: str, size: int = 10
    ) -> List[str]:
        """基于分词的建议

        将查询分词后，为每个词项生成建议，适合长查询的局部补全。

        Args:
            query: 查询文本
            size: 返回数量

        Returns:
            建议列表
        """
        tokens = self.tokenizer.tokenize(query)
        if not tokens:
            return self.get_popular_queries(size)

        # 对最后一个词项做前缀建议
        last_token = tokens[-1]
        prefix_query = "".join(tokens[:-1]) + last_token

        suggestions = self.suggest(prefix_query, size=size)
        return suggestions
