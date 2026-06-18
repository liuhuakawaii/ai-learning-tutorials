from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import json

from backend.agents.orchestrator import run_analysis

router = APIRouter()


class EvalCase(BaseModel):
    question: str
    expected_sql: Optional[str] = None
    expected_answer_contains: Optional[str] = None


class EvalRequest(BaseModel):
    cases: list[EvalCase]


class EvalResult(BaseModel):
    total: int
    passed: int
    failed: int
    details: list[dict]


@router.post("/run", response_model=EvalResult)
async def run_evaluation(request: EvalRequest):
    results = []
    passed = 0
    failed = 0
    
    for case in request.cases:
        try:
            result = await run_analysis(case.question)
            
            sql_match = True
            if case.expected_sql:
                sql_match = case.expected_sql.lower() in result["sql"].lower()
            
            content_match = True
            if case.expected_answer_contains:
                content_match = case.expected_answer_contains in result["report"]
            
            case_passed = sql_match and content_match
            
            if case_passed:
                passed += 1
            else:
                failed += 1
            
            results.append({
                "question": case.question,
                "passed": case_passed,
                "sql": result["sql"],
                "sql_match": sql_match,
                "content_match": content_match,
            })
        except Exception as e:
            failed += 1
            results.append({
                "question": case.question,
                "passed": False,
                "error": str(e),
            })
    
    return EvalResult(
        total=len(request.cases),
        passed=passed,
        failed=failed,
        details=results,
    )


@router.get("/metrics")
async def get_metrics():
    return {
        "metrics": [
            {"name": "SQL 准确率", "description": "生成的 SQL 是否正确"},
            {"name": "分析质量", "description": "分析结果是否有价值"},
            {"name": "报告完整性", "description": "报告是否包含关键信息"},
        ]
    }
