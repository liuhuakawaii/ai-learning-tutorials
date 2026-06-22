"""GGUF 导出脚本。

将微调后的 LoRA 权重合并到基础模型并导出为 GGUF 格式。

用法:
    python src/export_gguf.py --model ./output --quantize Q4_K_M
"""
import argparse
from pathlib import Path


def export_gguf(model_path: str, quantize: str):
    print(f"基础模型路径: {model_path}")
    print(f"量化级别: {quantize}")
    print("=" * 50)

    print("步骤 1: 加载基础模型和 LoRA 权重...")
    print("  (实际运行需要 transformers + peft)")

    print("步骤 2: 合并 LoRA 权重到基础模型...")
    print("  model = model.merge_and_unload()")

    print("步骤 3: 导出为 GGUF 格式...")
    print("  (需要 llama.cpp 的 convert 脚本)")

    output_dir = Path(model_path) / "gguf"
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n导出目录: {output_dir}")
    print(f"量化级别: {quantize}")
    print("\n导出完成（Mock）。实际运行需要 GPU 环境。")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="./output")
    parser.add_argument("--quantize", default="Q4_K_M", choices=["Q4_K_M", "Q5_K_M", "Q8_0"])
    args = parser.parse_args()
    export_gguf(args.model, args.quantize)


if __name__ == "__main__":
    main()
