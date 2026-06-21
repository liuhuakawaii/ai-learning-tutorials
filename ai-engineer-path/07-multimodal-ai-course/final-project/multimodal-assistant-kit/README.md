# Multimodal AI Assistant Kit

多模态 AI 助手练习工具包。支持文本、图片、语音、文档四种输入，集成多模态 RAG。

## 快速开始

```bash
pip install -r requirements.txt
python scripts/check.py
python src/main.py --mock
```

## 目录结构

```
multimodal-assistant-kit/
├── src/
│   ├── main.py              # 入口
│   ├── gateway.py           # 多模态输入网关
│   ├── routers/
│   │   ├── text.py          # 文本处理
│   │   ├── vision.py        # 图片处理
│   │   ├── voice.py         # 语音处理
│   │   └── document.py      # 文档处理
│   ├── rag/
│   │   └── multimodal.py    # 多模态 RAG
│   └── output/
│       └── renderer.py      # 多模态输出渲染
├── data/
│   ├── sample.jpg           # 示例图片
│   └── sample.pdf           # 示例文档
├── scripts/
│   └── check.py             # 结构验证
├── reports/
│   ├── stage1-vision.md
│   ├── stage2-voice.md
│   ├── stage3-document.md
│   ├── stage4-multimodal-rag.md
│   └── stage5-integration.md
└── requirements.txt
```
