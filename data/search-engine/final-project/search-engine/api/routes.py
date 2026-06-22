"""API 路由定义

定义搜索引擎的所有 HTTP 接口，包括：
- 搜索接口（全文搜索、布尔搜索、混合搜索）
- 索引管理接口（创建/删除索引、导入文档）
- 搜索建议接口（自动补全、纠错、热门搜索）
- 系统管理接口（健康检查、统计信息）
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(tags=["搜索引擎"])


# ============ 请求/响应模型 ============

class SearchRequest(BaseModel):
    """搜索请求"""
    query: str = Field(..., description="搜索查询文本", min_length=1)
    mode: str = Field("hybrid", description="检索模式: bm25 / vector / hybrid")
    filters: Optional[Dict[str, Any]] = Field(None, description="过滤条件")
    page: int = Field(1, description="页码", ge=1)
    page_size: int = Field(10, description="每页大小", ge=1, le=100)
    highlight: bool = Field(True, description="是否高亮")
    sort: Optional[str] = Field(None, description="排序方式，如 publish_time:desc")


class DocumentRequest(BaseModel):
    """文档导入请求"""
    id: str = Field(..., description="文档 ID")
    title: str = Field(..., description="文档标题")
    content: str = Field(..., description="文档正文")
    category: Optional[str] = Field(None, description="分类")
    tags: Optional[List[str]] = Field(None, description="标签列表")
    url: Optional[str] = Field(None, description="文档链接")


class BulkDocumentRequest(BaseModel):
    """批量文档导入请求"""
    documents: List[DocumentRequest] = Field(..., description="文档列表")


class SearchResponse(BaseModel):
    """搜索响应"""
    hits: List[Dict[str, Any]] = Field(default_factory=list, description="搜索结果")
    total: int = Field(0, description="总结果数")
    took_ms: int = Field(0, description="耗时（毫秒）")
    query: str = Field("", description="原始查询")
    mode: str = Field("hybrid", description="检索模式")


class SuggestRequest(BaseModel):
    """搜索建议请求"""
    prefix: str = Field(..., description="输入前缀", min_length=1)
    size: int = Field(10, description="返回数量", ge=1, le=50)


# ============ 搜索接口 ============

@router.post("/search", response_model=SearchResponse, summary="全文搜索")
async def search(request: SearchRequest):
    """执行全文搜索

    支持 BM25、向量和混合三种检索模式，可选高亮和过滤。
    """
    from services.search_service import SearchService
    service = SearchService()

    result = service.search(
        query=request.query,
        filters=request.filters,
        highlight=request.highlight,
        from_=(request.page - 1) * request.page_size,
        size=request.page_size,
        sort=request.sort,
    )

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return SearchResponse(
        hits=result["hits"],
        total=result["total"],
        took_ms=result["took_ms"],
        query=request.query,
        mode=request.mode,
    )


@router.get("/search/simple", summary="简单搜索（GET 方式）")
async def simple_search(
    q: str = Query(..., description="搜索查询", min_length=1),
    mode: str = Query("hybrid", description="检索模式"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
):
    """简单搜索接口，方便直接在浏览器中测试"""
    from services.search_service import SearchService
    service = SearchService()

    result = service.search(
        query=q,
        from_=(page - 1) * size,
        size=size,
    )

    return {
        "query": q,
        "mode": mode,
        "hits": result["hits"],
        "total": result["total"],
        "took_ms": result["took_ms"],
    }


@router.post("/search/boolean", summary="布尔搜索")
async def boolean_search(
    q: str = Query(..., description="查询文本"),
    operator: str = Query("AND", description="布尔操作符: AND / OR / NOT"),
):
    """布尔检索接口

    支持 AND（交集）、OR（并集）、NOT（差集）三种布尔操作。
    """
    from core.indexer import InvertedIndex
    index = InvertedIndex()
    # 这里需要已加载索引数据，实际使用时从持久化存储加载
    results = index.boolean_search(q, operator=operator)
    return {"query": q, "operator": operator, "doc_ids": results, "count": len(results)}


# ============ 索引管理接口 ============

@router.post("/index/create", summary="创建索引")
async def create_index(index_name: Optional[str] = None):
    """创建 Elasticsearch 索引"""
    from services.index_service import IndexService
    service = IndexService()
    success = service.create_index(index_name)
    if not success:
        raise HTTPException(status_code=500, detail="索引创建失败")
    return {"status": "ok", "message": f"索引 {index_name or 'default'} 创建成功"}


@router.delete("/index/{index_name}", summary="删除索引")
async def delete_index(index_name: str):
    """删除指定索引"""
    from services.index_service import IndexService
    service = IndexService()
    success = service.delete_index(index_name)
    if not success:
        raise HTTPException(status_code=500, detail="索引删除失败")
    return {"status": "ok", "message": f"索引 {index_name} 已删除"}


@router.post("/index/documents", summary="批量导入文档")
async def bulk_index_documents(request: BulkDocumentRequest):
    """批量导入文档到索引"""
    from services.index_service import IndexService
    service = IndexService()
    docs = [doc.dict() for doc in request.documents]
    result = service.bulk_index(docs)
    return {"status": "ok", "result": result}


@router.get("/index/stats", summary="索引统计")
async def index_stats(index_name: Optional[str] = None):
    """获取索引统计信息"""
    from services.index_service import IndexService
    service = IndexService()
    return service.get_index_stats(index_name)


# ============ 搜索建议接口 ============

@router.post("/suggest", summary="搜索建议")
async def suggest(request: SuggestRequest):
    """获取搜索建议（自动补全）"""
    from services.suggest_service import SuggestService
    service = SuggestService()
    suggestions = service.suggest(request.prefix, size=request.size)
    return {"prefix": request.prefix, "suggestions": suggestions}


@router.get("/suggest/hot", summary="热门搜索")
async def hot_queries(size: int = Query(10, ge=1, le=50)):
    """获取热门搜索词"""
    from services.suggest_service import SuggestService
    service = SuggestService()
    queries = service.get_popular_queries(size)
    return {"hot_queries": queries}


@router.post("/suggest/correct", summary="拼写纠错")
async def correct_query(q: str = Query(..., description="待纠错的查询")):
    """拼写纠错"""
    from services.suggest_service import SuggestService
    service = SuggestService()
    corrected = service.correct(q)
    return {"original": q, "corrected": corrected}


# ============ 系统管理接口 ============

@router.get("/health", summary="健康检查")
async def health_check():
    """服务健康检查"""
    return {"status": "healthy", "service": "搜索引擎"}


@router.get("/info", summary="系统信息")
async def system_info():
    """获取系统信息"""
    from config.settings import settings
    return {
        "elasticsearch_hosts": settings.elasticsearch.hosts,
        "index_name": settings.elasticsearch.index_name,
        "bm25_k1": settings.bm25.k1,
        "bm25_b": settings.bm25.b,
        "vector_model": settings.vector_search.model_name,
        "hybrid_bm25_weight": settings.hybrid.bm25_weight,
        "hybrid_vector_weight": settings.hybrid.vector_weight,
    }
