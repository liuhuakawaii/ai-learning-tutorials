"""搜索引擎全局配置模块

集中管理 Elasticsearch 连接、分词器、检索参数、排序参数等配置项。
所有配置均可通过环境变量覆盖，方便在不同部署环境中切换。
"""

import os
from dataclasses import dataclass, field
from typing import List


@dataclass
class ElasticsearchConfig:
    """Elasticsearch 连接配置"""
    hosts: List[str] = field(default_factory=lambda: [
        os.getenv("ES_HOST", "http://localhost:9200")
    ])
    username: str = os.getenv("ES_USERNAME", "")
    password: str = os.getenv("ES_PASSWORD", "")
    index_name: str = os.getenv("ES_INDEX", "documents")
    request_timeout: int = int(os.getenv("ES_TIMEOUT", "30"))
    max_retries: int = int(os.getenv("ES_MAX_RETRIES", "3"))


@dataclass
class TokenizerConfig:
    """分词器配置"""
    dict_path: str = os.getenv("TOKENIZER_DICT", "")
    user_dict_path: str = os.getenv("TOKENIZER_USER_DICT", "")
    stop_words: List[str] = field(default_factory=lambda: [
        "的", "了", "在", "是", "我", "有", "和", "就",
        "不", "人", "都", "一", "一个", "上", "也", "很",
        "到", "说", "要", "去", "你", "会", "着", "没有",
        "看", "好", "自己", "这",
    ])


@dataclass
class BM25Config:
    """BM25 检索参数配置"""
    k1: float = float(os.getenv("BM25_K1", "1.5"))
    b: float = float(os.getenv("BM25_B", "0.75"))
    avgdl: float = float(os.getenv("BM25_AVGDL", "100.0"))


@dataclass
class VectorSearchConfig:
    """向量检索配置"""
    model_name: str = os.getenv("VECTOR_MODEL", "shibing624/text2vec-base-chinese")
    dimension: int = int(os.getenv("VECTOR_DIM", "768"))
    index_type: str = os.getenv("VECTOR_INDEX_TYPE", "flat")
    top_k: int = int(os.getenv("VECTOR_TOP_K", "100"))


@dataclass
class HybridConfig:
    """混合检索配置"""
    bm25_weight: float = float(os.getenv("HYBRID_BM25_WEIGHT", "0.5"))
    vector_weight: float = float(os.getenv("HYBRID_VECTOR_WEIGHT", "0.5"))
    rrf_k: int = int(os.getenv("HYBRID_RRF_K", "60"))


@dataclass
class LTRConfig:
    """Learning-to-Rank 配置"""
    model_path: str = os.getenv("LTR_MODEL_PATH", "models/ltr_model.pkl")
    feature_dim: int = int(os.getenv("LTR_FEATURE_DIM", "25"))
    num_trees: int = int(os.getenv("LTR_NUM_TREES", "100"))
    learning_rate: float = float(os.getenv("LTR_LR", "0.1"))


@dataclass
class ServerConfig:
    """FastAPI 服务配置"""
    host: str = os.getenv("APP_HOST", "0.0.0.0")
    port: int = int(os.getenv("APP_PORT", "8000"))
    workers: int = int(os.getenv("APP_WORKERS", "4"))
    debug: bool = os.getenv("APP_DEBUG", "false").lower() == "true"


@dataclass
class Settings:
    """搜索引擎全局配置聚合"""
    elasticsearch: ElasticsearchConfig = field(default_factory=ElasticsearchConfig)
    tokenizer: TokenizerConfig = field(default_factory=TokenizerConfig)
    bm25: BM25Config = field(default_factory=BM25Config)
    vector_search: VectorSearchConfig = field(default_factory=VectorSearchConfig)
    hybrid: HybridConfig = field(default_factory=HybridConfig)
    ltr: LTRConfig = field(default_factory=LTRConfig)
    server: ServerConfig = field(default_factory=ServerConfig)


# 全局单例配置实例
settings = Settings()
