"""多模态 AI 助手入口。

用法:
    python src/main.py --mock
    python src/main.py --input "这是一张图片" --image data/sample.jpg
    python src/main.py --input "这是文档" --document data/sample.pdf
"""
import argparse
from gateway import MultimodalGateway


def main():
    parser = argparse.ArgumentParser(description="多模态 AI 助手")
    parser.add_argument("--input", type=str, default="你好")
    parser.add_argument("--image", type=str, help="图片路径")
    parser.add_argument("--audio", type=str, help="音频路径")
    parser.add_argument("--document", type=str, help="文档路径")
    parser.add_argument("--mock", action="store_true")
    args = parser.parse_args()

    gateway = MultimodalGateway(mock=args.mock)

    print(f"输入: {args.input}")
    if args.image:
        print(f"图片: {args.image}")
    if args.audio:
        print(f"音频: {args.audio}")
    if args.document:
        print(f"文档: {args.document}")

    print("=" * 50)

    result = gateway.process(
        text=args.input,
        image_path=args.image,
        audio_path=args.audio,
        document_path=args.document,
    )

    print("\n输出:")
    print("-" * 50)
    print(result["text"])
    if result.get("metadata"):
        print(f"\n元数据: {result['metadata']}")


if __name__ == "__main__":
    main()
