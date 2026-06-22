"""验证 multimodal-assistant-kit 的目录结构。"""
import sys
from pathlib import Path

REQUIRED_FILES = [
    "src/main.py",
    "src/gateway.py",
    "src/routers/text.py",
    "src/routers/vision.py",
    "src/routers/voice.py",
    "src/routers/document.py",
    "src/rag/multimodal.py",
    "src/output/renderer.py",
    "scripts/check.py",
    "requirements.txt",
    "reports/stage1-vision.md",
    "reports/stage2-voice.md",
    "reports/stage3-document.md",
    "reports/stage4-multimodal-rag.md",
    "reports/stage5-integration.md",
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
    print("  ✓ multimodal-assistant-kit 结构验证通过")
    sys.exit(0)

if __name__ == "__main__":
    main()
