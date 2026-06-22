"""HTML 报告生成器"""

from typing import Dict, List
from pathlib import Path
from datetime import datetime


class HTMLReporter:
    """HTML 报告生成器"""

    def __init__(self, template_dir: str = None):
        self.template_dir = template_dir or Path(__file__).parent.parent.parent / "reports" / "templates"

    def generate(self, scan_results: Dict, output_path: str):
        """生成 HTML 报告"""
        html = self._render_report(scan_results)

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(html, encoding="utf-8")

    def _render_report(self, results: Dict) -> str:
        """渲染报告"""
        summary = results.get("summary", {})
        findings = results.get("findings", [])
        severity_count = summary.get("by_severity", {})

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 安全扫描报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }}
        .header h1 {{ margin: 0 0 10px 0; }}
        .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }}
        .summary-card {{ background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .summary-card h3 {{ margin: 0 0 10px 0; color: #666; font-size: 14px; }}
        .summary-card .value {{ font-size: 32px; font-weight: bold; }}
        .critical {{ color: #dc3545; }}
        .high {{ color: #fd7e14; }}
        .medium {{ color: #ffc107; }}
        .low {{ color: #28a745; }}
        .findings {{ background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }}
        .finding {{ padding: 15px 20px; border-bottom: 1px solid #eee; }}
        .finding:last-child {{ border-bottom: none; }}
        .finding-header {{ display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }}
        .severity-badge {{ padding: 3px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; color: white; }}
        .severity-badge.critical {{ background: #dc3545; }}
        .severity-badge.high {{ background: #fd7e14; }}
        .severity-badge.medium {{ background: #ffc107; color: #333; }}
        .severity-badge.low {{ background: #28a745; }}
        .finding-meta {{ color: #666; font-size: 13px; }}
        .code-snippet {{ background: #f8f9fa; padding: 10px; border-radius: 5px; margin-top: 10px; font-family: monospace; font-size: 13px; overflow-x: auto; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AI 安全扫描报告</h1>
            <p>扫描时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p>扫描目标: {results.get('target', 'N/A')}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>总问题数</h3>
                <div class="value">{results.get('total_findings', 0)}</div>
            </div>
            <div class="summary-card">
                <h3>严重</h3>
                <div class="value critical">{severity_count.get('critical', 0)}</div>
            </div>
            <div class="summary-card">
                <h3>高危</h3>
                <div class="value high">{severity_count.get('high', 0)}</div>
            </div>
            <div class="summary-card">
                <h3>中危</h3>
                <div class="value medium">{severity_count.get('medium', 0)}</div>
            </div>
            <div class="summary-card">
                <h3>低危</h3>
                <div class="value low">{severity_count.get('low', 0)}</div>
            </div>
        </div>
        
        <div class="findings">
            <h2 style="padding: 20px; margin: 0; border-bottom: 1px solid #eee;">发现详情</h2>
"""

        for finding in findings:
            severity = finding.get("severity", "low")
            html += f"""
            <div class="finding">
                <div class="finding-header">
                    <span class="severity-badge {severity}">{severity.upper()}</span>
                    <strong>{finding.get('rule_name', 'Unknown')}</strong>
                </div>
                <div class="finding-meta">
                    文件: {finding.get('file', 'N/A')} | 行: {finding.get('line', 'N/A')} | 规则: {finding.get('rule_id', 'N/A')}
                </div>
                <p>{finding.get('description', '')}</p>
"""

            if finding.get("code_snippet"):
                html += f'                <div class="code-snippet">{finding["code_snippet"]}</div>\n'

            html += "            </div>\n"

        html += """
        </div>
    </div>
</body>
</html>"""

        return html
