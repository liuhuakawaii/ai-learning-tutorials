"""系统资源监控 - 采集 CPU、内存、磁盘等指标"""

import time
from datetime import datetime
from typing import Any

import psutil


def collect_metrics(interval: float = 1.0, count: int = 10) -> list[dict[str, Any]]:
    """周期性采集系统资源指标。

    Args:
        interval: 采集间隔（秒）
        count: 采集次数

    Returns:
        指标列表，每项包含 cpu_percent、memory_percent、disk_percent 等
    """
    metrics: list[dict[str, Any]] = []

    # 首次调用初始化 CPU 测量
    psutil.cpu_percent(interval=None)

    for _ in range(count):
        cpu = psutil.cpu_percent(interval=interval)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        metrics.append({
            "timestamp": datetime.now().isoformat(),
            "cpu_percent": cpu,
            "memory_percent": mem.percent,
            "memory_used_mb": round(mem.used / (1024 * 1024), 1),
            "memory_total_mb": round(mem.total / (1024 * 1024), 1),
            "disk_percent": disk.percent,
            "disk_used_gb": round(disk.used / (1024 ** 3), 1),
            "disk_total_gb": round(disk.total / (1024 ** 3), 1),
        })

    return metrics


def snapshot() -> dict[str, Any]:
    """获取当前系统快照（单次采集）"""
    cpu = psutil.cpu_percent(interval=1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    boot_time = datetime.fromtimestamp(psutil.boot_time())

    return {
        "timestamp": datetime.now().isoformat(),
        "cpu_percent": cpu,
        "cpu_count": psutil.cpu_count(),
        "memory_percent": mem.percent,
        "memory_used_mb": round(mem.used / (1024 * 1024), 1),
        "memory_total_mb": round(mem.total / (1024 * 1024), 1),
        "disk_percent": disk.percent,
        "disk_used_gb": round(disk.used / (1024 ** 3), 1),
        "disk_total_gb": round(disk.total / (1024 ** 3), 1),
        "boot_time": boot_time.isoformat(),
        "process_count": len(psutil.pids()),
    }
