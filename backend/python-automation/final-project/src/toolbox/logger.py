"""日志配置 - 统一的日志管理模块"""

import logging
import sys
from pathlib import Path


def setup_logger(
    level: str = "INFO",
    log_file: str | None = None,
    name: str = "toolbox",
) -> logging.Logger:
    """初始化并返回 logger 实例。

    Args:
        level: 日志级别（DEBUG / INFO / WARNING / ERROR）
        log_file: 日志文件路径，为 None 则仅输出到控制台
        name: logger 名称

    Returns:
        配置好的 logging.Logger 实例
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # 避免重复添加 handler
    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)-7s %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 控制台输出
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 文件输出
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger
