from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json

from backend.agents.orchestrator import run_analysis
from backend.config import DB_PATH
import sqlite3

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    query: str
    sql: str
    query_result: str
    analysis: str
    visualization: str
    report: str


@router.post("/analyze", response_model=ChatResponse)
async def analyze(request: ChatRequest):
    try:
        result = await run_analysis(request.message)
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables")
async def get_tables():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    conn.close()
    return {"tables": tables}


@router.get("/tables/{table_name}/schema")
async def get_table_schema(table_name: str):
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [
        {
            "name": col[1],
            "type": col[2],
            "notnull": bool(col[3]),
            "default": col[4],
            "pk": bool(col[5]),
        }
        for col in cursor.fetchall()
    ]
    conn.close()
    return {"table": table_name, "columns": columns}


@router.get("/tables/{table_name}/data")
async def get_table_data(table_name: str, limit: int = 100):
    import pandas as pd
    conn = sqlite3.connect(str(DB_PATH))
    df = pd.read_sql_query(f"SELECT * FROM {table_name} LIMIT {limit}", conn)
    conn.close()
    return {
        "table": table_name,
        "data": df.to_dict(orient="records"),
        "total": len(df),
    }
