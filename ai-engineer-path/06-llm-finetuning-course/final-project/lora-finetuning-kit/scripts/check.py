"""验证 lora-finetuning-kit 的目录结构。"""
import sys
from pathlib import Path

REQUIRED_FILES = [
    "src/prepare_data.py",
    "src/train_lora.py",
    "src/evaluate.py",
    "src/export_gguf.py",
    "configs/lora_config.yaml",
    "data/raw/sample_legal_qa.jsonl",
    "scripts/check.py",
    "requirements.txt",
    "reports/stage1-local-deploy.md",
    "reports/stage2-data-prep.md",
    "reports/stage3-lora-training.md",
    "reports/stage4-pipeline.md",
    "reports/stage5-eval-deploy.md",
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
    print("  ✓ lora-finetuning-kit 结构验证通过")
    sys.exit(0)

if __name__ == "__main__":
    main()
