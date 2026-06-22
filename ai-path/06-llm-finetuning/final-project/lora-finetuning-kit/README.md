# LoRA Fine-tuning Kit

LoRA 微调练习工具包。包含数据准备、训练、评估、导出的完整 pipeline。

## 快速开始

```bash
pip install -r requirements.txt
python scripts/check.py
python src/prepare_data.py
python src/train_lora.py --config configs/lora_config.yaml
python src/evaluate.py
```

## 目录结构

```
lora-finetuning-kit/
├── src/
│   ├── prepare_data.py      # 数据清洗与格式转换
│   ├── train_lora.py        # LoRA 训练脚本
│   ├── evaluate.py          # 评估对比脚本
│   └── export_gguf.py       # GGUF 导出脚本
├── configs/
│   └── lora_config.yaml     # 训练超参数配置
├── data/
│   ├── raw/                 # 原始数据
│   └── processed/           # 清洗后数据
├── scripts/
│   └── check.py             # 结构验证
├── reports/
│   ├── stage1-local-deploy.md
│   ├── stage2-data-prep.md
│   ├── stage3-lora-training.md
│   ├── stage4-pipeline.md
│   └── stage5-eval-deploy.md
└── requirements.txt
```

## 硬件要求

- 最低：8GB VRAM（RTX 3060 / Apple Silicon 16GB）
- 推荐：12GB+ VRAM（RTX 3060 12GB / RTX 4070）
