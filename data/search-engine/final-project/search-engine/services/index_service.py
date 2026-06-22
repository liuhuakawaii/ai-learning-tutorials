"""索引服务模块

提供索引的管理功能，包括：
- 创建/删除 Elasticsearch 索引
- 配置索引 Mapping（含中文分词器设置）
- 批量文档导入
- 索引统计信息查询
"""

import logging
from typing import Any, Dict, List, Optional

from config.settings import settings

logger = logging.getLogger(__name__)

# 尝试导入 elasticsearch
try:
    from elasticsearch import Elasticsearch
    from elasticsearch.helpers import bulk
    HAS_ELASTICSEARCH = True
except ImportError:
    HAS_ELASTICSEARCH = False
    logger.warning("elasticsearch 未安装，索引服务将使用内存模式")


# 默认中文索引 Mapping
DEFAULT_MAPPING = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "analyzer": {
                "ik_max": {
                    "type": "custom",
                    "tokenizer": "ik_max_word",
                },
                "ik_smart": {
                    "type": "custom",
                    "tokenizer": "ik_smart",
                },
            }
        },
    },
    "mappings": {
        "properties": {
            "title": {
                "type": "text",
                "analyzer": "ik_max",
                "search_analyzer": "ik_smart",
                "boost": 2.0,
            },
            "content": {
                "type": "text",
                "analyzer": "ik_max",
                "search_analyzer": "ik_smart",
            },
            "url": {"type": "keyword"},
            "category": {"type": "keyword"},
            "tags": {"type": "keyword"},
            "publish_time": {"type": "date"},
            "click_count": {"type": "integer"},
            "quality_score": {"type": "float"},
        }
    },
}


class IndexService:
    """索引服务

    管理 Elasticsearch 索引的生命周期，包括创建、删除、Mapping 配置和数据导入。

    用法示例：
        service = IndexService()
        service.create_index("my_index")
        service.bulk_index("my_index", documents)
    """

    def __init__(self, es_client: Optional[Any] = None):
        """初始化索引服务

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

    def create_index(
        self,
        index_name: Optional[str] = None,
        mapping: Optional[Dict] = None,
    ) -> bool:
        """创建 Elasticsearch 索引

        Args:
            index_name: 索引名称，默认从配置读取
            mapping: 自定义 Mapping，为空则使用默认中文 Mapping

        Returns:
            创建成功返回 True
        """
        name = index_name or settings.elasticsearch.index_name
        body = mapping or DEFAULT_MAPPING

        if self._es is None:
            logger.warning("ES 客户端不可用，跳过索引创建")
            return False

        try:
            if self._es.indices.exists(index=name):
                logger.info(f"索引 {name} 已存在，跳过创建")
                return True

            self._es.indices.create(index=name, body=body)
            logger.info(f"索引 {name} 创建成功")
            return True
        except Exception as e:
            logger.error(f"创建索引 {name} 失败: {e}")
            return False

    def delete_index(self, index_name: Optional[str] = None) -> bool:
        """删除索引

        Args:
            index_name: 索引名称，默认从配置读取

        Returns:
            删除成功返回 True
        """
        name = index_name or settings.elasticsearch.index_name

        if self._es is None:
            logger.warning("ES 客户端不可用，跳过索引删除")
            return False

        try:
            if not self._es.indices.exists(index=name):
                logger.info(f"索引 {name} 不存在，跳过删除")
                return True

            self._es.indices.delete(index=name)
            logger.info(f"索引 {name} 已删除")
            return True
        except Exception as e:
            logger.error(f"删除索引 {name} 失败: {e}")
            return False

    def bulk_index(
        self,
        documents: List[Dict[str, Any]],
        index_name: Optional[str] = None,
        batch_size: int = 500,
    ) -> Dict[str, int]:
        """批量导入文档

        Args:
            documents: 文档列表，每个文档是一个字典
            index_name: 索引名称，默认从配置读取
            batch_size: 每批处理的文档数

        Returns:
            {"success": 成功数, "failed": 失败数}
        """
        name = index_name or settings.elasticsearch.index_name

        if self._es is None:
            logger.warning("ES 客户端不可用，跳过批量导入")
            return {"success": 0, "failed": len(documents)}

        actions = []
        for doc in documents:
            action = {
                "_index": name,
                "_source": doc,
            }
            if "id" in doc:
                action["_id"] = doc.pop("id")
            actions.append(action)

        try:
            success, errors = bulk(self._es, actions, chunk_size=batch_size)
            if errors:
                logger.warning(f"批量导入部分失败: {len(errors)} 条")
            return {"success": success, "failed": len(errors) if errors else 0}
        except Exception as e:
            logger.error(f"批量导入失败: {e}")
            return {"success": 0, "failed": len(documents)}

    def get_index_stats(self, index_name: Optional[str] = None) -> Dict:
        """获取索引统计信息

        Args:
            index_name: 索引名称，默认从配置读取

        Returns:
            索引统计信息字典
        """
        name = index_name or settings.elasticsearch.index_name

        if self._es is None:
            return {"status": "unavailable", "reason": "ES 客户端不可用"}

        try:
            stats = self._es.indices.stats(index=name)
            return {
                "doc_count": stats["_all"]["primaries"]["docs"]["count"],
                "store_size": stats["_all"]["primaries"]["store"]["size_in_bytes"],
                "index_name": name,
                "status": "available",
            }
        except Exception as e:
            return {"status": "error", "reason": str(e)}

    def refresh_index(self, index_name: Optional[str] = None) -> bool:
        """刷新索引（使新写入的文档可搜索）

        Args:
            index_name: 索引名称

        Returns:
            刷新成功返回 True
        """
        name = index_name or settings.elasticsearch.index_name
        if self._es is None:
            return False
        try:
            self._es.indices.refresh(index=name)
            return True
        except Exception as e:
            logger.error(f"刷新索引失败: {e}")
            return False
