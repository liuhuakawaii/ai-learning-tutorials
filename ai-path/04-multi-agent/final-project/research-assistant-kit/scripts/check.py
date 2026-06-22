"""验证 research-assistant-kit 的目录结构。"""
import sys
from pathlib import Path

REQUIRED_FILES = [
    "src/main.py",
    "src/agents/searcher.py",
    "src/agents/analyzer.py",
    "src/agents/writer.py",
    "src/agents/reviewer.py",
    "src/graph.py",
    "src/memory.py",
    "data/sample_results.json",
    "scripts/check.py",
    "requirements.txt",
    "reports/stage1-orchestration.md",
    "reports/stage2-langgraph.md",
    "reports/stage3-communication.md",
    "reports/stage4-human-loop.md",
    "reports/stage5-production.md",
]

def main():
    kit_root = Path(__file__).resolve().parent.parent
    errors = []
    for rel in REQUIRED_FILES:
        if not (kit_root / rel).exists():
            errors.append(f"缺失: {rel}")

    if errors:
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)
    print("  ✓ research-assistant-kit 结构验证通过")
    sys.exit(0)

if __name__ == "__main__":
    main()
