"""扫描引擎核心"""

from typing import Dict, List, Optional
from pathlib import Path
import json

from detectors.code import CodeDetector
from detectors.config import ConfigDetector


class ScanEngine:
    """扫描引擎"""

    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self.code_detector = CodeDetector()
        self.config_detector = ConfigDetector()

    def _load_config(self, config_path: Optional[str]) -> Dict:
        if config_path and Path(config_path).exists():
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def scan(self, target_path: str, verbose: bool = False) -> Dict:
        """执行完整扫描"""
        target = Path(target_path)
        findings = []

        if verbose:
            print(f"扫描目标: {target}")

        # 代码扫描
        if target.is_dir():
            code_findings = self.code_detector.scan_directory(target)
            findings.extend(code_findings)

            if verbose:
                print(f"代码扫描发现: {len(code_findings)} 个问题")

        # 配置扫描
        config_findings = self.config_detector.scan(target)
        findings.extend(config_findings)

        if verbose:
            print(f"配置扫描发现: {len(config_findings)} 个问题")

        # 生成结果
        results = {
            "target": str(target),
            "total_findings": len(findings),
            "findings": findings,
            "summary": self._generate_summary(findings)
        }

        return results

    def _generate_summary(self, findings: List[Dict]) -> Dict:
        severity_count = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        category_count = {}

        for finding in findings:
            severity = finding.get("severity", "low")
            severity_count[severity] = severity_count.get(severity, 0) + 1

            category = finding.get("category", "other")
            category_count[category] = category_count.get(category, 0) + 1

        return {
            "by_severity": severity_count,
            "by_category": category_count
        }
