"""测试公共配置 - pytest fixtures"""

import os
import shutil
import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def tmp_dir():
    """创建临时测试目录，测试结束后自动清理"""
    d = tempfile.mkdtemp(prefix="toolbox_test_")
    yield Path(d)
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def sample_files(tmp_dir):
    """在临时目录中创建一批示例文件"""
    files = []
    for name in ["report.txt", "photo.jpg", "data.csv", "archive.zip", "notes.txt"]:
        p = tmp_dir / name
        p.write_text(f"测试内容: {name}", encoding="utf-8")
        files.append(p)
    return files


@pytest.fixture
def default_config():
    """返回最小可用配置"""
    return {
        "app": {"name": "toolbox", "log_level": "INFO"},
        "file_ops": {
            "organize_rules": {
                "documents": [".txt", ".csv", ".json", ".pdf"],
                "images": [".jpg", ".png", ".gif"],
                "archives": [".zip", ".tar", ".gz"],
            },
            "clean_older_than_days": 30,
        },
        "web_monitor": {
            "timeout": 10,
            "user_agent": "ToolboxTest/1.0",
            "notify": {"email": {}, "webhook_url": ""},
        },
        "sys_inspect": {
            "cpu_threshold": 80,
            "memory_threshold": 85,
            "disk_threshold": 90,
        },
        "report": {"output_dir": "./output", "mailer": {}},
    }
