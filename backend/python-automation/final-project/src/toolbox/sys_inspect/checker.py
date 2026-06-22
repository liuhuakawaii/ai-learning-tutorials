"""阈值检查 - 检测系统资源是否超过安全阈值"""

from typing import Any

import psutil


def check_thresholds(
    cpu_threshold: int = 80,
    memory_threshold: int = 85,
    disk_threshold: int = 90,
) -> list[dict[str, Any]]:
    """检查系统资源是否超过阈值。

    Args:
        cpu_threshold: CPU 使用率阈值（%）
        memory_threshold: 内存使用率阈值（%）
        disk_threshold: 磁盘使用率阈值（%）

    Returns:
        告警列表，每项包含 level、resource、value、threshold、message
        空列表表示一切正常
    """
    alerts: list[dict[str, Any]] = []

    # CPU 检查
    cpu_percent = psutil.cpu_percent(interval=1)
    if cpu_percent > cpu_threshold:
        alerts.append({
            "level": "warning",
            "resource": "cpu",
            "value": cpu_percent,
            "threshold": cpu_threshold,
            "message": f"CPU 使用率 {cpu_percent}% 超过阈值 {cpu_threshold}%",
        })

    # 内存检查
    mem = psutil.virtual_memory()
    if mem.percent > memory_threshold:
        alerts.append({
            "level": "warning",
            "resource": "memory",
            "value": mem.percent,
            "threshold": memory_threshold,
            "message": f"内存使用率 {mem.percent}% 超过阈值 {memory_threshold}%",
        })

    # 磁盘检查
    disk = psutil.disk_usage("/")
    if disk.percent > disk_threshold:
        alerts.append({
            "level": "critical",
            "resource": "disk",
            "value": disk.percent,
            "threshold": disk_threshold,
            "message": f"磁盘使用率 {disk.percent}% 超过阈值 {disk_threshold}%",
        })

    return alerts


def list_top_processes(n: int = 10) -> list[dict[str, Any]]:
    """列出占用资源最多的前 N 个进程。

    Returns:
        进程列表，每项包含 pid、name、cpu_percent、memory_percent
    """
    procs: list[dict[str, Any]] = []
    for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
        try:
            info = proc.info
            procs.append(info)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    procs.sort(key=lambda p: p.get("cpu_percent", 0) or 0, reverse=True)
    return procs[:n]
