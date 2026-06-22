"""文件分类整理 - 按扩展名、日期或大小自动归档"""

import os
import shutil
from datetime import datetime
from pathlib import Path


# 默认扩展名分组
DEFAULT_GROUPS = {
    "documents": {".txt", ".csv", ".json", ".xlsx", ".xls", ".pdf", ".doc", ".docx"},
    "images": {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp"},
    "archives": {".zip", ".tar", ".gz", ".rar", ".7z"},
    "audio": {".mp3", ".wav", ".flac", ".aac"},
    "video": {".mp4", ".avi", ".mkv", ".mov"},
}


def _get_group_for_ext(ext: str, config: dict | None = None) -> str:
    """根据扩展名返回分组名称"""
    rules = (config or {}).get("file_ops", {}).get("organize_rules", {})
    if rules:
        for group, extensions in rules.items():
            if ext.lower() in extensions:
                return group
    for group, extensions in DEFAULT_GROUPS.items():
        if ext.lower() in extensions:
            return group
    return "others"


def organize_files(
    directory: str,
    group_by: str = "ext",
    config: dict | None = None,
) -> dict:
    """将目录中的文件按规则整理到子目录。

    Args:
        directory: 待整理的目录路径
        group_by: 分类依据 - "ext"（扩展名）/ "date"（修改日期）/ "size"（文件大小）
        config: 工具箱配置

    Returns:
        {"total": 整理文件数, "groups": {组名: 文件列表}}
    """
    dir_path = Path(directory)
    if not dir_path.is_dir():
        raise FileNotFoundError(f"目录不存在: {directory}")

    groups: dict[str, list[str]] = {}
    total = 0

    for file_path in dir_path.iterdir():
        if not file_path.is_file():
            continue

        # 确定目标子目录
        if group_by == "ext":
            group_name = _get_group_for_ext(file_path.suffix, config)
        elif group_by == "date":
            mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            group_name = mtime.strftime("%Y-%m")
        elif group_by == "size":
            size_mb = file_path.stat().st_size / (1024 * 1024)
            if size_mb < 1:
                group_name = "small"
            elif size_mb < 10:
                group_name = "medium"
            else:
                group_name = "large"
        else:
            group_name = "others"

        # 创建子目录并移动文件
        target_dir = dir_path / group_name
        target_dir.mkdir(exist_ok=True)
        target_path = target_dir / file_path.name

        # 处理同名文件
        if target_path.exists():
            stem = file_path.stem
            suffix = file_path.suffix
            counter = 1
            while target_path.exists():
                target_path = target_dir / f"{stem}_{counter}{suffix}"
                counter += 1

        shutil.move(str(file_path), str(target_path))
        groups.setdefault(group_name, []).append(file_path.name)
        total += 1

    return {"total": total, "groups": groups}
