"""巡检报告生成 - 将系统指标输出为文本、HTML 或 JSON 格式"""

import json
from datetime import datetime
from typing import Any

import psutil

from toolbox.sys_inspect.monitor import snapshot


def generate_report(output_format: str = "text") -> str:
    """生成系统巡检报告。

    Args:
        output_format: 输出格式 - "text" / "html" / "json"

    Returns:
        格式化后的报告字符串
    """
    data = snapshot()

    if output_format == "json":
        return json.dumps(data, ensure_ascii=False, indent=2)
    elif output_format == "html":
        return _render_html(data)
    else:
        return _render_text(data)


def _render_text(data: dict[str, Any]) -> str:
    """渲染纯文本报告"""
    lines = [
        "=" * 50,
        "  系统巡检报告",
        f"  生成时间: {data['timestamp']}",
        "=" * 50,
        "",
        f"  CPU:      {data['cpu_percent']}%  ({data['cpu_count']} 核)",
        f"  内存:     {data['memory_percent']}%  ({data['memory_used_mb']}/{data['memory_total_mb']} MB)",
        f"  磁盘:     {data['disk_percent']}%  ({data['disk_used_gb']}/{data['disk_total_gb']} GB)",
        f"  进程数:   {data['process_count']}",
        f"  启动时间: {data['boot_time']}",
        "",
        "=" * 50,
    ]
    return "\n".join(lines)


def _render_html(data: dict[str, Any]) -> str:
    """渲染 HTML 报告"""
    return f"""<!DOCTYPE html>
<html lang="zh">
<head><meta charset="utf-8"><title>系统巡检报告</title></head>
<body>
<h1>系统巡检报告</h1>
<p>生成时间: {data['timestamp']}</p>
<table border="1" cellpadding="8">
  <tr><td>CPU</td><td>{data['cpu_percent']}% ({data['cpu_count']} 核)</td></tr>
  <tr><td>内存</td><td>{data['memory_percent']}% ({data['memory_used_mb']}/{data['memory_total_mb']} MB)</td></tr>
  <tr><td>磁盘</td><td>{data['disk_percent']}% ({data['disk_used_gb']}/{data['disk_total_gb']} GB)</td></tr>
  <tr><td>进程数</td><td>{data['process_count']}</td></tr>
  <tr><td>启动时间</td><td>{data['boot_time']}</td></tr>
</table>
</body></html>"""
