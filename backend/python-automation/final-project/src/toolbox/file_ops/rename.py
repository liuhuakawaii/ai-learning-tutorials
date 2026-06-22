"""批量重命名 - 按模式重命名目录中的文件"""

import os
from pathlib import Path


def batch_rename(
    directory: str,
    pattern: str,
    ext_filter: str | None = None,
    start_index: int = 1,
) -> int:
    """批量重命名文件。

    Args:
        directory: 目标目录路径
        pattern: 重命名模式，支持 {n} 占位符（序号）和 {orig}（原文件名）
                 例如: "IMG_{n:04d}" → IMG_0001.jpg, IMG_0002.jpg
        ext_filter: 仅处理指定扩展名（如 ".jpg"）
        start_index: 起始序号

    Returns:
        重命名的文件数量
    """
    dir_path = Path(directory)
    if not dir_path.is_dir():
        raise FileNotFoundError(f"目录不存在: {directory}")

    # 收集需要重命名的文件
    files = sorted(
        f for f in dir_path.iterdir()
        if f.is_file() and (ext_filter is None or f.suffix.lower() == ext_filter.lower())
    )

    # 第一遍：生成临时名称，避免冲突
    rename_plan: list[tuple[Path, Path]] = []
    for idx, file_path in enumerate(files, start=start_index):
        new_name = pattern.format(n=idx, orig=file_path.stem)
        new_name = f"{new_name}{file_path.suffix}"
        temp_path = file_path.parent / f".tmp_rename_{idx}_{new_name}"
        final_path = file_path.parent / new_name
        rename_plan.append((file_path, temp_path, final_path))  # type: ignore[misc]

    # 第一遍：重命名为临时文件
    for original, temp, _ in rename_plan:
        original.rename(temp)

    # 第二遍：临时文件重命名为最终名称
    for _, temp, final in rename_plan:
        temp.rename(final)

    return len(files)
