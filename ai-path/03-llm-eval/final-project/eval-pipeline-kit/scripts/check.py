"""验证 eval-pipeline-kit 的目录结构和必需文件。"""
import sys
from pathlib import Path

REQUIRED_FILES = [
    "src/eval_pipeline.py",
    "src/ragas_eval.py",
    "src/dashboard.py",
    "data/golden_dataset.json",
    "data/rag_samples.json",
    "scripts/check.py",
    "requirements.txt",
    "reports/stage1-eval-basics.md",
    "reports/stage2-rag-eval.md",
    "reports/stage3-agent-eval.md",
    "reports/stage4-observability.md",
    "reports/stage5-continuous-eval.md",
]

REQUIRED_KEYS_IN_DATASET = ["question", "expected_answer", "context"]

def main():
    kit_root = Path(__file__).resolve().parent.parent
    errors = []

    for rel in REQUIRED_FILES:
        p = kit_root / rel
        if not p.exists():
            errors.append(f"缺失: {rel}")

    ds_path = kit_root / "data" / "golden_dataset.json"
    if ds_path.exists():
        import json
        ds = json.loads(ds_path.read_text(encoding="utf-8"))
        if not isinstance(ds, list) or len(ds) == 0:
            errors.append("golden_dataset.json 应为非空数组")
        else:
            for key in REQUIRED_KEYS_IN_DATASET:
                if key not in ds[0]:
                    errors.append(f"golden_dataset.json 首条缺少字段: {key}")

    if errors:
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)
    print("  ✓ eval-pipeline-kit 结构验证通过")
    sys.exit(0)

if __name__ == "__main__":
    main()
