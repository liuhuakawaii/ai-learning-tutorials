# 第 3 阶段：LoRA / QLoRA 实战

> 动手微调一个属于自己的大模型

## 学习目标

- 搭建完整的微调开发环境（CUDA / PyTorch / Transformers / PEFT）
- 掌握 LoRA 和 QLoRA 微调的完整流程
- 学会调优训练超参数（Learning Rate / Epoch / Batch Size / LoRA Rank）
- 能够监控训练过程并检测过拟合

## 课时安排

| 序号 | 主题 | 预计时长 |
|------|------|----------|
| 01 | 环境搭建 — CUDA / PyTorch / Transformers / PEFT 的正确安装 | 3h |
| 02 | 第一次微调 — 用 LoRA 微调 Qwen2.5-7B 的完整流程 | 4h |
| 03 | QLoRA 微调 — 4-bit 量化 + LoRA，在 8GB 显存上微调 7B 模型 | 3h |
| 04 | 训练超参数 — Learning Rate / Epoch / Batch Size / LoRA Rank 调优 | 3h |
| 05 | 训练监控 — Loss 曲线解读、过拟合检测、训练中断恢复 | 2h |
| 06 | 阶段实战：用领域数据完成一次完整的 LoRA 微调并对比效果 | 4h |

## 验收标准

- [ ] 成功完成一次 LoRA 微调并保存 adapter 权重
- [ ] 能通过 Loss 曲线判断训练状态（欠拟合/正常/过拟合）
- [ ] 微调模型在领域任务上的表现优于基础模型
