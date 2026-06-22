"""数据清洗 - 清理过期文件和临时文件"""

import os
import time
from datetime import datetime, timedelta
from pathlib import Path


def clean_old_files(
    directory: str,
    older_than_days: int = 30,
    dry_run: bool = False,
    extensions: list[str] | None = None,
) -> dict:
    """清理超过指定天数的文件。

    Args:
        directory: 目标目录
        older_than_days: 清理多少天前的文件
        dry_run: 仅预览，不实际删除
        extensions: 仅清理指定扩展名（如 [".log", ".tmp"]）

    Returns:
        {"count": 删除数量, "size_bytes": 释放字节, "size_human": 可读大小, "files": 文件列表}
    """
    dir_path = Path(directory)
    if not dir_path.is_dir():
        raise FileNotFoundError(f"目录不存在: {directory}")

    cutoff = time.time() - older_than_days * 86400
    cleaned_files: list[dict] = []

    for file_path in dir_path.rglob("*"):
        if not file_path.is_file():
            continue

        # 按扩展名过滤
        if extensions and file_path.suffix.lower() not in extensions:
            continue

        mtime = file_path.stat().st_mtime
        if mtime >= cutoff:
            continue

        size = file_path.stat().st_size
        cleaned_files.append({
            "path": str(file_path),
            "size": size,
            "modified": datetime.fromtimestamp(mtime).isoformat(),
        })

        if not dry_run:
            file_path.unlink()

    total_size = sum(f["size"] for f in cleaned_files)

    return {
        "count": len(cleaned_files),
        "size_bytes": total_size,
        "size_human": _human_readable_size(total_size),
        "files": cleaned_files,
    }


def _human_readable_size(size_bytes: int) -> str:
    """将字节数转换为可读格式"""
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"
