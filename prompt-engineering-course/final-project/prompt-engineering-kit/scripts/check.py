"""项目完整性检查脚本 — 验证 Prompt Engineering Toolkit 的模块和结构."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

CHECKS_PASSED = 0
CHECKS_FAILED = 0


def check(description: str, condition: bool) -> None:
    global CHECKS_PASSED, CHECKS_FAILED
    if condition:
        CHECKS_PASSED += 1
        print(f"  ✅ {description}")
    else:
        CHECKS_FAILED += 1
        print(f"  ❌ {description}")


def check_file_structure() -> None:
    print("\n📁 文件结构检查")
    check("src/ 目录存在", SRC.is_dir())
    check("src/__init__.py 存在", (SRC / "__init__.py").is_file())
    check("template_engine/ 目录存在", (SRC / "template_engine").is_dir())
    check("testing/ 目录存在", (SRC / "testing").is_dir())
    check("optimizer/ 目录存在", (SRC / "optimizer").is_dir())
    check("monitor/ 目录存在", (SRC / "monitor").is_dir())

    for module in ["template_engine", "testing", "optimizer", "monitor"]:
        check(f"{module}/__init__.py 存在", (SRC / module / "__init__.py").is_file())

    expected_files = [
        "template_engine/parser.py",
        "template_engine/renderer.py",
        "template_engine/variables.py",
        "testing/runner.py",
        "testing/evaluator.py",
        "testing/reporter.py",
        "optimizer/analyzer.py",
        "optimizer/suggester.py",
        "monitor/tracker.py",
        "monitor/dashboard.py",
    ]
    for f in expected_files:
        check(f"src/{f} 存在", (SRC / f).is_file())

    check("templates/ 目录存在", (ROOT / "templates").is_dir())
    check("reports/ 目录存在", (ROOT / "reports").is_dir())
    check("requirements.txt 存在", (ROOT / "requirements.txt").is_file())
    check("README.md 存在", (ROOT / "README.md").is_file())
    check(".gitignore 存在", (ROOT / ".gitignore").is_file())


def check_imports() -> None:
    print("\n📦 模块导入检查")
    sys.path.insert(0, str(SRC.parent))

    modules_to_check = [
        ("src.template_engine", ["PromptParser", "PromptRenderer", "Variable", "VariableRegistry"]),
        ("src.testing", ["TestRunner", "TestCase", "TestSuite", "Evaluator", "Reporter"]),
        ("src.optimizer", ["PromptAnalyzer", "AnalysisReport", "Suggester", "Suggestion"]),
        ("src.monitor", ["Tracker", "TrackRecord", "Dashboard"]),
    ]

    for module_path, expected_names in modules_to_check:
        try:
            mod = __import__(module_path, fromlist=expected_names)
            check(f"导入 {module_path} 成功", True)
            for name in expected_names:
                has_attr = hasattr(mod, name)
                check(f"  {module_path}.{name} 可用", has_attr)
        except ImportError as e:
            check(f"导入 {module_path} 失败: {e}", False)


def check_template_engine() -> None:
    print("\n🔧 模板引擎功能检查")
    try:
        from src.template_engine import PromptParser, PromptRenderer, Variable, VariableRegistry

        parser = PromptParser()
        template = "你是{{ role }}。请{{ task }}。输出格式：{{ format }}"
        parsed = parser.parse(template, name="test")
        check("解析器提取变量", set(parsed.variables) == {"role", "task", "format"})
        check("解析器识别必填变量", len(parsed.required_variables) == 3)

        renderer = PromptRenderer(strict=False)
        result = renderer.render(template, {"role": "助手", "task": "总结", "format": "列表"})
        check("渲染器输出正确", "助手" in result.content and "总结" in result.content)

        var = Variable(name="test", type="string", required=True, min_length=1)
        ok, _ = var.validate_value("hello")
        check("变量验证通过", ok)
        ok, err = var.validate_value("")
        check("变量验证拒绝空值", not ok)

        registry = VariableRegistry()
        registry.register(var)
        check("变量注册表工作", registry.get("test") is not None)

    except Exception as e:
        check(f"模板引擎功能测试失败: {e}", False)


def check_testing() -> None:
    print("\n🧪 测试模块功能检查")
    try:
        from src.testing import TestRunner, TestCase, TestSuite, Evaluator, Reporter

        def mock_execute(prompt: str, variables: dict) -> str:
            return "test output"

        runner = TestRunner(execute_fn=mock_execute)
        suite = TestSuite(name="test_suite")
        suite.add_case(TestCase(id="t1", name="test1", prompt="hello", expected_output="test output"))

        result = runner.run_suite(suite)
        check("测试运行器工作", result.total == 1)
        check("测试结果正确", result.results[0].status.value == "passed")

        evaluator = Evaluator()
        eval_result = evaluator.evaluate("hello", "hello")
        check("评估器精确匹配", eval_result.passed)

        eval_result = evaluator.evaluate("hello world", "hello", {"match_type": "contains"})
        check("评估器包含匹配", eval_result.passed)

        reporter = Reporter(output_dir=ROOT / "reports")
        md = reporter.generate_markdown(result)
        check("报告生成器工作", len(md) > 0)

    except Exception as e:
        check(f"测试模块功能测试失败: {e}", False)


def check_optimizer() -> None:
    print("\n📊 优化器功能检查")
    try:
        from src.optimizer import PromptAnalyzer, Suggester

        analyzer = PromptAnalyzer()
        report = analyzer.analyze("You are a helpful assistant. Please summarize the following text in bullet points.")
        check("分析器生成报告", report is not None)
        check("分析器计算 Token", report.token_estimate > 0)
        check("分析器评分", 0 <= report.overall_score <= 1)

        suggester = Suggester()
        plan = suggester.generate_plan(report)
        check("建议器生成计划", plan is not None)
        check("建议非空", len(plan.suggestions) > 0)

    except Exception as e:
        check(f"优化器功能测试失败: {e}", False)


def check_monitor() -> None:
    print("\n📈 监控模块功能检查")
    try:
        from src.monitor import Tracker, Dashboard, AlertRule, AlertSeverity

        tracker = Tracker()
        tracker.record("p1", "gpt-4o", 100, 50, 200.0, True)
        tracker.record("p1", "gpt-4o", 120, 60, 350.0, True)
        tracker.record("p1", "gpt-4o", 110, 55, 180.0, False, error="timeout")

        summary = tracker.get_summary("p1")
        check("追踪器记录工作", summary["total_calls"] == 3)
        check("追踪器成功率", abs(summary["success_rate"] - 2 / 3) < 0.01)

        triggered = []
        tracker.add_alert_rule(AlertRule(
            name="high_latency",
            condition="latency_ms",
            threshold=300.0,
            severity=AlertSeverity.WARNING,
            callback=lambda n, v, s: triggered.append(n),
        ))
        tracker.record("p1", "gpt-4o", 100, 50, 500.0, True)
        check("告警规则触发", len(triggered) > 0)

        dashboard = Dashboard(tracker)
        output = dashboard.render_summary("p1")
        check("仪表盘渲染", len(output) >= 0)

        trend = tracker.get_trend("p1", "latency_ms")
        check("趋势数据", len(trend.values) > 0)

    except Exception as e:
        check(f"监控模块功能测试失败: {e}", False)


def main() -> None:
    print("=" * 50)
    print("  Prompt Engineering Toolkit — 完整性检查")
    print("=" * 50)

    check_file_structure()
    check_imports()
    check_template_engine()
    check_testing()
    check_optimizer()
    check_monitor()

    print("\n" + "=" * 50)
    print(f"  结果: {CHECKS_PASSED} 通过, {CHECKS_FAILED} 失败")
    print("=" * 50)

    sys.exit(1 if CHECKS_FAILED > 0 else 0)


if __name__ == "__main__":
    main()
