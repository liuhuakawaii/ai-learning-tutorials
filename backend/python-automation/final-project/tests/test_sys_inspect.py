"""系统巡检模块测试"""

from unittest.mock import patch, MagicMock

import pytest

from toolbox.sys_inspect.monitor import collect_metrics, snapshot
from toolbox.sys_inspect.checker import check_thresholds
from toolbox.sys_inspect.reporter import generate_report


class TestMonitor:
    """资源监控测试"""

    @patch("toolbox.sys_inspect.monitor.psutil")
    def test_collect_metrics(self, mock_psutil):
        """采集指标返回正确结构"""
        mock_mem = MagicMock()
        mock_mem.percent = 55.0
        mock_mem.used = 4 * 1024 ** 3
        mock_mem.total = 8 * 1024 ** 3

        mock_disk = MagicMock()
        mock_disk.percent = 60.0
        mock_disk.used = 200 * 1024 ** 3
        mock_disk.total = 500 * 1024 ** 3

        mock_psutil.cpu_percent.return_value = 35.0
        mock_psutil.virtual_memory.return_value = mock_mem
        mock_psutil.disk_usage.return_value = mock_disk

        metrics = collect_metrics(interval=0, count=3)
        assert len(metrics) == 3
        assert "cpu_percent" in metrics[0]
        assert "memory_percent" in metrics[0]
        assert "disk_percent" in metrics[0]

    @patch("toolbox.sys_inspect.monitor.psutil")
    def test_snapshot(self, mock_psutil):
        """系统快照包含完整字段"""
        mock_mem = MagicMock()
        mock_mem.percent = 50.0
        mock_mem.used = 4 * 1024 ** 3
        mock_mem.total = 8 * 1024 ** 3

        mock_disk = MagicMock()
        mock_disk.percent = 55.0
        mock_disk.used = 100 * 1024 ** 3
        mock_disk.total = 500 * 1024 ** 3

        mock_psutil.cpu_percent.return_value = 25.0
        mock_psutil.cpu_count.return_value = 8
        mock_psutil.virtual_memory.return_value = mock_mem
        mock_psutil.disk_usage.return_value = mock_disk
        mock_psutil.boot_time.return_value = 1700000000
        mock_psutil.pids.return_value = [1, 2, 3]

        data = snapshot()
        assert "cpu_percent" in data
        assert "cpu_count" in data
        assert "memory_percent" in data
        assert "process_count" in data


class TestChecker:
    """阈值检查测试"""

    @patch("toolbox.sys_inspect.checker.psutil")
    def test_all_normal(self, mock_psutil):
        """所有指标正常时无告警"""
        mock_mem = MagicMock()
        mock_mem.percent = 50.0

        mock_disk = MagicMock()
        mock_disk.percent = 60.0

        mock_psutil.cpu_percent.return_value = 30.0
        mock_psutil.virtual_memory.return_value = mock_mem
        mock_psutil.disk_usage.return_value = mock_disk

        alerts = check_thresholds(cpu_threshold=80, memory_threshold=85, disk_threshold=90)
        assert len(alerts) == 0

    @patch("toolbox.sys_inspect.checker.psutil")
    def test_cpu_alert(self, mock_psutil):
        """CPU 超阈值时产生告警"""
        mock_mem = MagicMock()
        mock_mem.percent = 50.0

        mock_disk = MagicMock()
        mock_disk.percent = 60.0

        mock_psutil.cpu_percent.return_value = 95.0
        mock_psutil.virtual_memory.return_value = mock_mem
        mock_psutil.disk_usage.return_value = mock_disk

        alerts = check_thresholds(cpu_threshold=80)
        assert len(alerts) == 1
        assert alerts[0]["resource"] == "cpu"

    @patch("toolbox.sys_inspect.checker.psutil")
    def test_multiple_alerts(self, mock_psutil):
        """多项指标超阈值时产生多条告警"""
        mock_mem = MagicMock()
        mock_mem.percent = 90.0

        mock_disk = MagicMock()
        mock_disk.percent = 95.0

        mock_psutil.cpu_percent.return_value = 85.0
        mock_psutil.virtual_memory.return_value = mock_mem
        mock_psutil.disk_usage.return_value = mock_disk

        alerts = check_thresholds(cpu_threshold=80, memory_threshold=85, disk_threshold=90)
        assert len(alerts) == 3


class TestReporter:
    """报告生成测试"""

    @patch("toolbox.sys_inspect.reporter.snapshot")
    def test_text_report(self, mock_snapshot):
        """文本报告包含关键字段"""
        mock_snapshot.return_value = {
            "timestamp": "2025-01-01T00:00:00",
            "cpu_percent": 25.0,
            "cpu_count": 8,
            "memory_percent": 50.0,
            "memory_used_mb": 4096.0,
            "memory_total_mb": 8192.0,
            "disk_percent": 55.0,
            "disk_used_gb": 100.0,
            "disk_total_gb": 500.0,
            "process_count": 120,
            "boot_time": "2025-01-01T00:00:00",
        }

        report = generate_report("text")
        assert "CPU" in report
        assert "内存" in report
        assert "磁盘" in report

    @patch("toolbox.sys_inspect.reporter.snapshot")
    def test_json_report(self, mock_snapshot):
        """JSON 报告可解析"""
        import json
        mock_snapshot.return_value = {
            "timestamp": "2025-01-01T00:00:00",
            "cpu_percent": 25.0,
            "cpu_count": 8,
            "memory_percent": 50.0,
            "memory_used_mb": 4096.0,
            "memory_total_mb": 8192.0,
            "disk_percent": 55.0,
            "disk_used_gb": 100.0,
            "disk_total_gb": 500.0,
            "process_count": 120,
            "boot_time": "2025-01-01T00:00:00",
        }

        report = generate_report("json")
        data = json.loads(report)
        assert "cpu_percent" in data

    @patch("toolbox.sys_inspect.reporter.snapshot")
    def test_html_report(self, mock_snapshot):
        """HTML 报告包含标签"""
        mock_snapshot.return_value = {
            "timestamp": "2025-01-01T00:00:00",
            "cpu_percent": 25.0,
            "cpu_count": 8,
            "memory_percent": 50.0,
            "memory_used_mb": 4096.0,
            "memory_total_mb": 8192.0,
            "disk_percent": 55.0,
            "disk_used_gb": 100.0,
            "disk_total_gb": 500.0,
            "process_count": 120,
            "boot_time": "2025-01-01T00:00:00",
        }

        report = generate_report("html")
        assert "<html" in report
        assert "系统巡检报告" in report
