"""代码扫描检测器"""

import re
from typing import List, Dict
from pathlib import Path


class CodeDetector:
    """代码安全检测器"""

    def __init__(self):
        self.rules = self._load_rules()

    def _load_rules(self) -> List[Dict]:
        return [
            {
                "id": "HARDCODED_SECRET",
                "name": "硬编码凭证",
                "severity": "high",
                "pattern": r"(?:api_key|secret|password|token)\s*=\s*['\"][^'\"]+['\"]",
                "description": "检测到硬编码的密钥或密码"
            },
            {
                "id": "UNSAFE_PROMPT",
                "name": "不安全的 Prompt 构造",
                "severity": "high",
                "pattern": r"f['\"].*\{.*user.*\}.*['\"]",
                "description": "使用 f-string 直接拼接用户输入到 Prompt"
            },
            {
                "id": "SQL_INJECTION",
                "name": "SQL 注入风险",
                "severity": "critical",
                "pattern": r"execute\(f['\"].*\{",
                "description": "检测到字符串拼接的 SQL 查询"
            },
            {
                "id": "COMMAND_INJECTION",
                "name": "命令注入风险",
                "severity": "critical",
                "pattern": r"os\.(system|popen|exec)\(",
                "description": "检测到直接执行系统命令"
            },
            {
                "id": "MISSING_VALIDATION",
                "name": "缺少输入验证",
                "severity": "medium",
                "pattern": r"request\.(args|form|json)\.get\(",
                "description": "检测到用户输入处理但缺少验证"
            }
        ]

    def scan_file(self, file_path: Path) -> List[Dict]:
        """扫描单个文件"""
        findings = []

        try:
            content = file_path.read_text(encoding="utf-8")
            lines = content.split("\n")

            for line_num, line in enumerate(lines, 1):
                for rule in self.rules:
                    if re.search(rule["pattern"], line, re.I):
                        findings.append({
                            "file": str(file_path),
                            "line": line_num,
                            "rule_id": rule["id"],
                            "rule_name": rule["name"],
                            "severity": rule["severity"],
                            "category": "code",
                            "description": rule["description"],
                            "code_snippet": line.strip()[:100]
                        })
        except Exception as e:
            findings.append({
                "file": str(file_path),
                "line": 0,
                "rule_id": "FILE_ERROR",
                "rule_name": "文件读取错误",
                "severity": "low",
                "category": "code",
                "description": f"无法读取文件: {str(e)}"
            })

        return findings

    def scan_directory(self, dir_path: Path, extensions: List[str] = None) -> List[Dict]:
        """扫描目录"""
        if extensions is None:
            extensions = [".py", ".js", ".ts"]

        findings = []
        for ext in extensions:
            for file_path in dir_path.rglob(f"*{ext}"):
                # 跳过常见忽略目录
                if any(p in str(file_path) for p in ["__pycache__", "node_modules", ".git"]):
                    continue
                findings.extend(self.scan_file(file_path))

        return findings
