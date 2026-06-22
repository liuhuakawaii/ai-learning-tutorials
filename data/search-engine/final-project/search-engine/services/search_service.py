"""搜索服务模块

提供核心搜索功能，包括：
- 基于 Elasticsearch 的全文搜索
- 搜索结果高亮
- 多条件过滤（分类、标签、时间范围等）
- 搜索结果聚合
- 搜索日志记录
"""

import logging
from typing import Any, Dict, List, Optional

from config.settings import settings

logger = logging.getLogger(__name__)

# 尝试导入 elasticsearch
try:
    from elasticsearch import Elasticsearch
    HAS_ELASTICSEARCH = True
except ImportError:
    HAS_ELASTICSEARCH = False
    logger.warning("elasticsearch 未安装，搜索服务将使用内存模式")


class SearchService:
    """搜索服务

    基于 Elasticsearch 实现全文搜索，支持高亮、过滤、聚合等功能。

    用法示例：
        service = SearchService()
        results = service.search("搜索引擎", filters={"category": "技术"})
    """

    def __init__(self, es_client: Optional[Any] = None):
        """初始化搜索服务

        Args:
            es_client: Elasticsearch 客户端实例，为空则自动创建
        """
        self._es = es_client
        if self._es is None and HAS_ELASTICSEARCH:
            try:
                self._es = Elasticsearch(
                    hosts=settings.elasticsearch.hosts,
                    request_timeout=settings.elasticsearch.request_timeout,
                    max_retries=settings.elasticsearch.max_retries,
                )
            except Exception as e:
                logger.warning(f"无法连接 Elasticsearch: {e}")

    @property
    def es_client(self) -> Optional[Any]:
        """获取 Elasticsearch 客户端"""
        return self._es

    def search(
        self,
        query: str,
        index_name: Optional[str] = None,
        filters: Optional[Dict[str, Any]] = None,
        highlight: bool = True,
        from_: int = 0,
        size: int = 10,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """执行搜索

        Args:
            query: 搜索查询文本
            index_name: 索引名称，默认从配置读取
            filters: 过滤条件字典，支持以下字段：
                - category: 分类
                - tags: 标签列表
                - date_from: 起始日期
                - date_end: 结束日期
            highlight: 是否启用高亮
            from_: 分页起始位置
            size: 每页大小
            sort: 排序方式，如 "publish_time:desc"

        Returns:
            搜索结果字典，包含 hits、total、took_ms 等
        """
        name = index_name or settings.elasticsearch.index_name

        if self._es is None:
            return {"hits": [], "total": 0, "took_ms": 0, "error": "ES 不可用"}

        # 构建查询 DSL
        must_clause = {
            "multi_match": {
                "query": query,
                "fields": ["title^3", "content", "tags^2"],
                "type": "best_fields",
                "fuzziness": "AUTO",
            }
        }

        # 构建过滤条件
        filter_clauses = []
        if filters:
            if "category" in filters:
                filter_clauses.append({"term": {"category": filters["category"]}})
            if "tags" in filters:
                tags = filters["tags"]
                if isinstance(tags, str):
                    tags = [tags]
                filter_clauses.append({"terms": {"tags": tags}})
            if "date_from" in filters or "date_end" in filters:
                range_filter: Dict[str, Any] = {}
                if "date_from" in filters:
                    range_filter["gte"] = filters["date_from"]
                if "date_end" in filters:
                    range_filter["lte"] = filters["date_end"]
                filter_clauses.append({"range": {"publish_time": range_filter}})

        # 组装完整查询
        body: Dict[str, Any] = {
            "query": {
                "bool": {
                    "must": [must_clause],
                    "filter": filter_clauses,
                }
            },
            "from": from_,
            "size": size,
        }

        # 高亮配置
        if highlight:
            body["highlight"] = {
                "fields": {
                    "title": {"pre_tags": ["<em>"], "post_tags": ["</em>"]},
                    "content": {
                        "pre_tags": ["<em>"],
                        "post_tags": ["</em>"],
                        "fragment_size": 150,
                        "number_of_fragments": 3,
                    },
                }
            }

        # 排序
        if sort:
            field_name, order = sort.split(":")
            body["sort"] = [{field_name: {"order": order}}]

        try:
            response = self._es.search(index=name, body=body)

            hits = []
            for hit in response["hits"]["hits"]:
                result = {
                    "id": hit["_id"],
                    "score": hit["_score"],
                    "source": hit["_source"],
                }
                if "highlight" in hit:
                    result["highlight"] = hit["highlight"]
                hits.append(result)

            return {
                "hits": hits,
                "total": response["hits"]["total"]["value"],
                "took_ms": response["took"],
            }
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return {"hits": [], "total": 0, "took_ms": 0, "error": str(e)}

    def aggregate(
        self,
        field: str,
        index_name: Optional[str] = None,
        query: Optional[str] = None,
        size: int = 20,
    ) -> List[Dict[str, Any]]:
        """聚合查询

        对指定字段进行 terms 聚合，返回 Top N 的词项及其文档数。

        Args:
            field: 聚合字段名
            index_name: 索引名称
            query: 可选的查询过滤
            size: 返回聚合结果数

        Returns:
            [{"key": "xxx", "doc_count": N}, ...]
        """
        name = index_name or settings.elasticsearch.index_name

        if self._es is None:
            return []

        body: Dict[str, Any] = {
            "size": 0,
            "aggs": {
                "top_terms": {
                    "terms": {"field": field, "size": size}
                }
            },
        }

        if query:
            body["query"] = {"match": {"_all": query}}

        try:
            response = self._es.search(index=name, body=body)
            buckets = response["aggregations"]["top_terms"]["buckets"]
            return [{"key": b["key"], "doc_count": b["doc_count"]} for b in buckets]
        except Exception as e:
            logger.error(f"聚合查询失败: {e}")
            return []

    def log_search(self, query: str, results_count: int, user_id: str = "") -> None:
        """记录搜索日志

        用于后续的搜索分析和 LTR 模型训练。

        Args:
            query: 搜索查询
            results_count: 结果数量
            user_id: 用户 ID
        """
        logger.info(
            f"搜索日志 | query={query} | results={results_count} | user={user_id}"
        )
