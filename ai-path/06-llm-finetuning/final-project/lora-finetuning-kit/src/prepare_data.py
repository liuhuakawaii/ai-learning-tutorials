"""数据清洗与格式转换。

用法:
    python src/prepare_data.py
    python src/prepare_data.py --input data/raw/sample_legal_qa.jsonl --format alpaca
"""
import json
import argparse
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def load_raw_data(path: Path) -> list[dict]:
    data = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            data.append(json.loads(line.strip()))
    return data


def clean_data(data: list[dict]) -> list[dict]:
    cleaned = []
    seen = set()
    for item in data:
        question = item.get("question", "").strip()
        answer = item.get("answer", "").strip()
        if not question or not answer:
            continue
        if question in seen:
            continue
        seen.add(question)
        cleaned.append({"question": question, "answer": answer})
    return cleaned


def to_alpaca_format(data: list[dict]) -> list[dict]:
    return [
        {
            "instruction": item["question"],
            "input": "",
            "output": item["answer"],
        }
        for item in data
    ]


def to_sharegpt_format(data: list[dict]) -> list[dict]:
    return [
        {
            "conversations": [
                {"from": "human", "value": item["question"]},
                {"from": "gpt", "value": item["answer"]},
            ]
        }
        for item in data
    ]


def save_jsonl(data: list[dict], path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DATA_DIR / "raw" / "sample_legal_qa.jsonl")
    parser.add_argument("--format", choices=["alpaca", "sharegpt"], default="alpaca")
    parser.add_argument("--split-ratio", type=float, default=0.9)
    args = parser.parse_args()

    print(f"加载数据: {args.input}")
    raw = load_raw_data(args.input)
    print(f"原始数据: {len(raw)} 条")

    cleaned = clean_data(raw)
    print(f"清洗后: {len(cleaned)} 条")

    if args.format == "alpaca":
        formatted = to_alpaca_format(cleaned)
    else:
        formatted = to_sharegpt_format(cleaned)

    split = int(len(formatted) * args.split_ratio)
    train, val = formatted[:split], formatted[split:]

    save_jsonl(train, DATA_DIR / "processed" / "train.jsonl")
    save_jsonl(val, DATA_DIR / "processed" / "val.jsonl")
    print(f"已保存: train={len(train)}, val={len(val)}")


if __name__ == "__main__":
    main()
