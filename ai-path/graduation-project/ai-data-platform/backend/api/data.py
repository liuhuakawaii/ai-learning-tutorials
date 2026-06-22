from fastapi import APIRouter, HTTPException, UploadFile, File
import pandas as pd
import sqlite3
import json
from pathlib import Path

from backend.config import DB_PATH

router = APIRouter()


@router.get("/databases")
async def list_databases():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    result = []
    for (table_name,) in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        result.append({"name": table_name, "rows": count})
    
    conn.close()
    return {"databases": result}


@router.get("/query")
async def execute_query(sql: str):
    try:
        conn = sqlite3.connect(str(DB_PATH))
        df = pd.read_sql_query(sql, conn)
        conn.close()
        return {
            "columns": df.columns.tolist(),
            "data": df.to_dict(orient="records"),
            "total": len(df),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        content = await file.read()
        
        if file.filename.endswith(".csv"):
            df = pd.read_csv(pd.io.common.BytesIO(content))
        elif file.filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(pd.io.common.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式")
        
        table_name = Path(file.filename).stem.replace(" ", "_")
        conn = sqlite3.connect(str(DB_PATH))
        df.to_sql(table_name, conn, if_exists="replace", index=False)
        conn.close()
        
        return {
            "message": f"文件已上传并导入到表 {table_name}",
            "table": table_name,
            "rows": len(df),
            "columns": df.columns.tolist(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
