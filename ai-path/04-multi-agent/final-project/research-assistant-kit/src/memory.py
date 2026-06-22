"""Agent 记忆管理。

短期记忆：会话内消息历史（内存）
长期记忆：跨会话知识持久化（SQLite）
"""
import sqlite3
import json
from pathlib import Path
from datetime import datetime


class ShortTermMemory:
    """会话内消息历史。"""

    def __init__(self):
        self.messages: list[dict] = []

    def add(self, role: str, content: str):
        self.messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
        })

    def get_history(self, last_n: int = 10) -> list[dict]:
        return self.messages[-last_n:]

    def clear(self):
        self.messages.clear()


class LongTermMemory:
    """跨会话知识持久化（SQLite）。"""

    def __init__(self, db_path: str = "memory.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    key TEXT,
                    value TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)

    def store(self, session_id: str, key: str, value: str):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO memories (session_id, key, value) VALUES (?, ?, ?)",
                (session_id, key, value),
            )

    def retrieve(self, key: str, limit: int = 5) -> list[str]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT value FROM memories WHERE key = ? ORDER BY created_at DESC LIMIT ?",
                (key, limit),
            ).fetchall()
            return [r[0] for r in rows]
