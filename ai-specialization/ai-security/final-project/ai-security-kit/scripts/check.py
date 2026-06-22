#!/usr/bin/env python3
"""AI Security Scanner - 主入口脚本"""

import click
import json
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from scanner.engine import ScanEngine
from reporters.html import HTMLReporter


@click.group()
def cli():
    """AI Security Scanner - AI 安全扫描工具"""
    pass


@cli.command()
@click.option("--target", "-t", required=True, help="扫描目标路径")
@click.option("--output", "-o", default="scan-results.json", help="输出文件")
@click.option("--config", "-c", default=None, help="配置文件")
@click.option("--verbose", "-v", is_flag=True, help="详细输出")
def scan(target, output, config, verbose):
    """执行安全扫描"""
    click.echo(f"开始扫描: {target}")

    engine = ScanEngine(config_path=config)
    results = engine.scan(target, verbose=verbose)

    with open(output, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    click.echo(f"扫描完成，结果已保存到: {output}")
    click.echo(f"发现 {results.get('total_findings', 0)} 个问题")


@cli.command()
@click.option("--input", "-i", "input_file", required=True, help="扫描结果文件")
@click.option("--output", "-o", default="report.html", help="报告输出文件")
@click.option("--format", "-f", "fmt", default="html", help="报告格式 (html/json)")
def report(input_file, output, fmt):
    """生成安全报告"""
    click.echo(f"生成报告: {input_file}")

    with open(input_file, "r", encoding="utf-8") as f:
        results = json.load(f)

    if fmt == "html":
        reporter = HTMLReporter()
        reporter.generate(results, output)
    else:
        with open(output, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

    click.echo(f"报告已生成: {output}")


@cli.command()
@click.option("--target", "-t", required=True, help="目标 URL")
def test(target):
    """运行安全测试"""
    click.echo(f"运行安全测试: {target}")

    from scanner.runtime import RuntimeScanner
    scanner = RuntimeScanner()
    results = scanner.test(target)

    click.echo(f"测试完成，发现 {len(results)} 个问题")


if __name__ == "__main__":
    cli()
