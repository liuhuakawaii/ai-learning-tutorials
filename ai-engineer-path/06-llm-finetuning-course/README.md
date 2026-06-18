# 从零到一：开源模型部署与微调实战课程

> 从 API 调用者变成模型驾驭者，掌握本地部署和微调开源大模型的完整技能

## 适合谁

- 一直用 API 调用大模型、想了解模型底层原理的开发者
- 需要用领域数据微调模型以提升业务效果的团队
- 想降低 AI 应用成本、考虑本地部署模型的技术负责人
- 对 LLM 底层技术（训练、推理、量化）感兴趣、想深入 AI infra 的工程师

## 学完能做什么

- 用 Ollama / vLLM / llama.cpp 在本地部署和运行开源大模型
- 理解 LoRA / QLoRA 微调原理，能用领域数据微调 7B-14B 模型
- 掌握模型量化技术（GGUF / GPTQ / AWQ），在消费级硬件上运行大模型
- 搭建完整的训练 pipeline：数据准备 → 训练 → 评估 → 部署
- 做出合理的 build vs buy 决策：什么时候用 API、什么时候用本地模型

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.12 |
| 模型 | Llama 3 / Qwen 2.5 / Mistral / DeepSeek |
| 推理 | Ollama / vLLM / llama.cpp |
| 训练 | Hugging Face Transformers / PEFT / TRL |
| 数据 | Hugging Face Datasets / pandas |
| 量化 | GGUF / GPTQ / AWQ / bitsandbytes |
| 评估 | lm-eval-harness / MMLU / 自定义 eval |
| 部署 | Docker + OpenAI 兼容 API |
| 硬件 | NVIDIA GPU（最低 8GB VRAM）/ Apple Silicon |

## 学习路线

### 第 1 阶段：本地模型部署（6 课时）

> 在本地环境跑起来开源大模型

1. 开源模型生态 — Llama / Qwen / Mistral / DeepSeek 的选型指南
2. Ollama 快速上手 — 一行命令运行本地大模型
3. llama.cpp 深入 — GGUF 格式、量化级别、推理参数调优
4. vLLM 生产部署 — 高性能推理引擎的配置与优化
5. OpenAI 兼容 API — 让本地模型接入现有的 AI 应用（零改代码）
6. 阶段实战：在本地部署一个 OpenAI 兼容的模型服务并接入 01 课程项目

### 第 2 阶段：微调基础（6 课时）

> 理解微调的核心概念和准备工作

1. 为什么微调 — Prompt Engineering vs RAG vs Fine-tuning 的选型
2. 微调方法全景 — Full Fine-tuning / LoRA / QLoRA / Prefix Tuning
3. LoRA 原理详解 — 低秩适配的数学直觉与工程优势
4. 数据准备 — 训练数据格式、清洗、去重、质量控制
5. 指令微调数据 — Alpaca / ShareGPT 格式的数据构造方法
6. 阶段实战：为一个垂直领域（如法律/医疗/电商）构造微调数据集

### 第 3 阶段：LoRA / QLoRA 实战（6 课时）

> 动手微调一个属于自己的大模型

1. 环境搭建 — CUDA / PyTorch / Transformers / PEFT 的正确安装
2. 第一次微调 — 用 LoRA 微调 Qwen2.5-7B 的完整流程
3. QLoRA 微调 — 4-bit 量化 + LoRA，在 8GB 显存上微调 7B 模型
4. 训练超参数 — Learning Rate / Epoch / Batch Size / LoRA Rank 调优
5. 训练监控 — Loss 曲线解读、过拟合检测、训练中断恢复
6. 阶段实战：用领域数据完成一次完整的 LoRA 微调并对比效果

### 第 4 阶段：训练 Pipeline（6 课时）

> 从一次性实验到可重复的训练流水线

1. 数据 Pipeline — 自动化数据收集、清洗、格式化的流水线
2. 训练配置管理 — 用 YAML 配置文件管理实验参数
3. 分布式训练 — 多 GPU 训练的配置与常见问题
4. 模型合并 — LoRA 权重与基础模型的合并导出
5. 模型量化导出 — 将微调模型导出为 GGUF / GPTQ 格式
6. 阶段实战：搭建一个端到端的训练 Pipeline（数据 → 训练 → 导出）

### 第 5 阶段：评估与部署（6 课时）

> 科学评估微调效果并部署到生产

1. 通用基准评估 — MMLU / HellaSwag / ARC 等基准测试
2. 领域评估 — 针对微调任务设计专属评估数据集
3. 对比评估 — 微调模型 vs 基础模型 vs API 模型的多维度对比
4. 模型部署 — 用 vLLM 部署微调模型并提供 OpenAI 兼容 API
5. 成本分析 — API 调用 vs 本地部署的 TCO 对比与决策框架
6. 阶段实战：完成微调模型的评估报告并部署到生产环境

### 最终项目

详见 [final-project/项目说明.md](./final-project/项目说明.md)

选择一个垂直领域，完成完整的微调流程：数据收集 → 数据清洗 → LoRA 微调 → 评估对比 → 量化导出 → 部署上线，产出评估报告和部署文档。

## 学习建议

1. **GPU 准备**：至少 8GB VRAM（推荐 RTX 3060 12GB 或更高），Apple Silicon Mac 也可以
2. **先理解原理**：不要直接跑脚本，理解 LoRA 的数学原理才能调好超参数
3. **数据质量 > 数据数量**：1000 条高质量数据胜过 10000 条低质量数据
4. **用 03 课程评估微调效果**：微调是否有效需要用系统化的评估方法验证
5. **做好成本记录**：记录每次实验的 GPU 时间、Token 消耗，培养成本意识

## 参考官方文档

- [Hugging Face Transformers](https://huggingface.co/docs/transformers/)
- [PEFT (Parameter-Efficient Fine-Tuning)](https://huggingface.co/docs/peft/)
- [TRL (Transformer Reinforcement Learning)](https://huggingface.co/docs/trl/)
- [Ollama 文档](https://ollama.ai/)
- [vLLM 文档](https://docs.vllm.ai/)
- [llama.cpp](https://github.com/ggerganov/llama.cpp)
