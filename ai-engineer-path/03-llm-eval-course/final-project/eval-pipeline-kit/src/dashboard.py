"""Streamlit 评估 Dashboard。

用法:
    streamlit run src/dashboard.py
"""
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def main():
    try:
        import streamlit as st
        import pandas as pd
    except ImportError:
        print("请先安装依赖: pip install streamlit pandas")
        return

    st.title("LLM 评估 Dashboard")

    ds_path = DATA_DIR / "golden_dataset.json"
    if not ds_path.exists():
        st.error("未找到 golden_dataset.json")
        return

    dataset = json.loads(ds_path.read_text(encoding="utf-8"))
    df = pd.DataFrame(dataset)

    st.subheader("评估数据集概览")
    st.metric("样本数", len(df))
    st.dataframe(df[["question", "expected_answer"]].head(10))

    st.subheader("Mock 评估结果")
    df["mock_score"] = [0.8, 0.6, 0.9, 0.7, 0.85][: len(df)]
    st.bar_chart(df.set_index("question")["mock_score"])

    st.subheader("成本统计（Mock）")
    col1, col2, col3 = st.columns(3)
    col1.metric("总 Token", "12,345")
    col2.metric("API 调用", "47 次")
    col3.metric("估算费用", "$0.23")


if __name__ == "__main__":
    main()
