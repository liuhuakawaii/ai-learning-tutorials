"""MCP Server 骨架：文件系统 MCP Server。

学员需要根据 05-mcp-dev-course 的知识完成实现。
"""
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def list_files(subdir: str = "") -> str:
    target = DATA_DIR / subdir
    if not target.exists():
        return f"目录不存在: {subdir}"
    files = [f.name for f in target.iterdir()]
    return "\n".join(files)


def read_file(filepath: str) -> str:
    target = DATA_DIR / filepath
    if not target.exists():
        return f"文件不存在: {filepath}"
    return target.read_text(encoding="utf-8")


if __name__ == "__main__":
    print("文件系统 MCP Server 骨架")
    print(f"数据目录: {DATA_DIR}")
    print("可用操作: list_files, read_file")
    print("请根据 05-mcp-dev-course 课程完成 MCP Server 实现")
