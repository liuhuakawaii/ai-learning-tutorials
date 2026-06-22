"""多 Agent 研究助手入口。

用法:
    python src/main.py --mock
    python src/main.py --topic "LLM Agent 2025 trends"
"""
import argparse
import json
from pathlib import Path

from agents.searcher import SearchAgent
from agents.analyzer import AnalyzerAgent
from agents.writer import WriterAgent
from agents.reviewer import ReviewerAgent
from graph import build_graph

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def main():
    parser = argparse.ArgumentParser(description="多 Agent 研究助手")
    parser.add_argument("--topic", type=str, default="LLM Agent 发展趋势")
    parser.add_argument("--mock", action="store_true", help="使用 Mock 模式")
    args = parser.parse_args()

    print(f"研究主题: {args.topic}")
    print(f"模式: {'Mock' if args.mock else 'Live'}")
    print("=" * 50)

    graph = build_graph(mock=args.mock)
    result = graph.invoke({"topic": args.topic, "mock": args.mock})

    print("\n" + "=" * 50)
    print("研究报告:")
    print("-" * 50)
    print(result.get("report", "未生成报告"))


if __name__ == "__main__":
    main()
