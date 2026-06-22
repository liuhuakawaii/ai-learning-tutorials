"""配置扫描检测器"""

from typing import List, Dict
from pathlib import Path
import json


class ConfigDetector:
    """配置安全检测器"""

    def __init__(self):
        self.sensitive_patterns = [
            "api_key",
            "secret",
            "password",
            "token",
            "private_key"
        ]

    def scan(self, target_path: Path) -> List[Dict]:
        """扫描配置文件"""
        findings = []
        config_files = self._find_config_files(target_path)

        for config_file in config_files:
            findings.extend(self._scan_config_file(config_file))

        return findings

    def _find_config_files(self, target_path: Path) -> List[Path]:
        """查找配置文件"""
        config_files = []
        patterns = ["*.json", "*.yaml", "*.yml", "*.env", "*.ini", "*.toml"]

        for pattern in patterns:
            if target_path.is_dir():
                config_files.extend(target_path.rglob(pattern))
            elif target_path.match(pattern):
                config_files.append(target_path)

        return config_files

    def _scan_config_file(self, file_path: Path) -> List[Dict]:
        """扫描配置文件"""
        findings = []

        try:
            content = file_path.read_text(encoding="utf-8")

            # 检查敏感信息
            for pattern in self.sensitive_patterns:
                if pattern.lower() in content.lower():
                    findings.append({
                        "file": str(file_path),
                        "line": 0,
                        "rule_id": "CONFIG_SENSITIVE",
                        "rule_name": "配置中的敏感信息",
                        "severity": "high",
                        "category": "config",
                        "description": f"配置文件中包含敏感字段: {pattern}"
                    })

            # 检查 .env 文件
            if file_path.name == ".env":
                findings.append({
                    "file": str(file_path),
                    "line": 0,
                    "rule_id": "ENV_FILE",
                    "rule_name": "环境变量文件",
                    "severity": "medium",
                    "category": "config",
                    "description": "检测到 .env 文件，请确保不要提交到版本控制"
                })

        except Exception:
            pass

        return findings
