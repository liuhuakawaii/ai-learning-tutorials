# 06 阶段实战——用 LoRA 微调 Qwen2.5-7B，对比三组超参数的效果

> 一次完整的微调实验，重点是学会对比不同配置。

你已经搭好了环境，也跑通了第一次微调。但现在有个问题：你不知道你的超参数选得对不对。

LoRA rank 用 8 还是 32？learning rate 用 2e-4 还是 1e-5？训练 3 个 epoch 还是 5 个？这些参数怎么选？答案是：**跑实验对比**。

这节课不是教你"最佳参数"（不存在最佳参数），而是教你**怎么系统地做对比实验**。

---

## 实验设计

我们要对比三组配置：

```
配置 A（保守）：r=8, lr=1e-4, epochs=2
配置 B（中等）：r=16, lr=2e-4, epochs=3
配置 C（激进）：r=32, lr=5e-4, epochs=5
```

评估维度：
- 训练 loss 曲线
- 评估集准确率
- 推理速度（微调后是否变慢）
- 显存占用

---

## Step 1：准备数据

```python
from datasets import load_dataset
from transformers import AutoTokenizer

model_name = "Qwen/Qwen2.5-7B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)

# 加载数据集
dataset = load_dataset("json", data_files={
    "train": "train.json",
    "eval": "eval.json",
})

def format_sample(example):
    """格式化为模型输入"""
    if example.get("input"):
        text = f"### 指令：{example['instruction']}\n### 输入：{example['input']}\n### 回答：{example['output']}"
    else:
        text = f"### 指令：{example['instruction']}\n### 回答：{example['output']}"

    tokenized = tokenizer(
        text,
        truncation=True,
        max_length=512,
        padding="max_length",
    )
    tokenized["labels"] = tokenized["input_ids"].copy()
    return tokenized

tokenized_train = dataset["train"].map(format_sample, remove_columns=dataset["train"].column_names)
tokenized_eval = dataset["eval"].map(format_sample, remove_columns=dataset["eval"].column_names)
```

---

## Step 2：定义训练函数

```python
from transformers import AutoModelForCausalLM, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model
import torch

def train_with_config(config_name: str, r: int, lr: float, epochs: int):
    """用指定配置训练一个 LoRA 模型"""

    print(f"\n{'='*50}")
    print(f"实验 {config_name}: r={r}, lr={lr}, epochs={epochs}")
    print(f"{'='*50}")

    # 加载基座模型
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )

    # LoRA 配置
    lora_config = LoraConfig(
        r=r,
        lora_alpha=r * 2,  # 通常 lora_alpha = 2 * r
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05,
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 训练参数
    output_dir = f"./results/{config_name}"
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=lr,
        warmup_ratio=0.1,
        lr_scheduler_type="cosine",
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_steps=10,
        bf16=True,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
    )

    # 训练
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_train,
        eval_dataset=tokenized_eval,
    )

    trainer.train()

    # 保存
    model.save_pretrained(f"{output_dir}/lora")
    print(f"模型已保存到 {output_dir}/lora")

    return trainer
```

---

## Step 3：跑三组实验

```python
# 实验 A：保守配置
trainer_a = train_with_config("A_conservative", r=8, lr=1e-4, epochs=2)

# 清理显存
del trainer_a
torch.cuda.empty_cache()

# 实验 B：中等配置
trainer_b = train_with_config("B_moderate", r=16, lr=2e-4, epochs=3)

del trainer_b
torch.cuda.empty_cache()

# 实验 C：激进配置
trainer_c = train_with_config("C_aggressive", r=32, lr=5e-4, epochs=5)
```

每组实验结束后记录：
- 训练时间
- 显存峰值
- 最终 eval loss

---

## Step 4：对比评估

```python
from peft import PeftModel

def evaluate_model(lora_path: str, test_data: list[dict]) -> dict:
    """评估微调后的模型"""
    base = AutoModelForCausalLM.from_pretrained(
        model_name, torch_dtype=torch.bfloat16, device_map="auto", trust_remote_code=True
    )
    model = PeftModel.from_pretrained(base, lora_path)
    model.eval()

    correct = 0
    total = len(test_data)

    for item in test_data:
        prompt = f"### 指令：{item['instruction']}\n### 回答："
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=256, temperature=0)

        predicted = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)

        if item["output"].strip() in predicted.strip():
            correct += 1

    return {"accuracy": correct / total, "correct": correct, "total": total}

# 加载评估数据
with open("eval.json") as f:
    eval_data = json.load(f)

# 评估三组实验
results = {}
for name, path in [
    ("A_conservative", "./results/A_conservative/lora"),
    ("B_moderate", "./results/B_moderate/lora"),
    ("C_aggressive", "./results/C_aggressive/lora"),
]:
    results[name] = evaluate_model(path, eval_data)
    print(f"{name}: 准确率 {results[name]['accuracy']:.2%}")
```

---

## Step 5：生成对比报告

```python
def generate_comparison_report(results: dict, training_info: dict) -> str:
    """生成对比报告"""
    report = """# LoRA 超参数对比实验报告

| 配置 | r | lr | epochs | 准确率 | 训练时间 | 显存峰值 |
|------|---|-----|--------|--------|---------|---------|
"""
    for name, res in results.items():
        info = training_info.get(name, {})
        report += f"| {name} | {info.get('r', '-')} | {info.get('lr', '-')} | {info.get('epochs', '-')} "
        report += f"| {res['accuracy']:.2%} | {info.get('time', '-')} | {info.get('mem', '-')} |\n"

    report += """
## 分析

- r 越大，可训练参数越多，拟合能力越强，但过拟合风险也越高
- lr 越大，收敛越快，但可能不稳定
- epochs 越多，训练越充分，但过拟合风险越高

## 结论

根据实验结果选择最优配置。如果 B 和 C 差距不大，优先选 B（参数少、训练快）。
"""
    return report

report = generate_comparison_report(results, training_info)
with open("comparison_report.md", "w") as f:
    f.write(report)
print(report)
```

---

## 训练过程中的常见问题

**loss 不下降**：
- learning rate 太小 → 调大 10 倍试试
- 数据格式不对 → 检查 tokenizer 的输出是否正确
- 模型没有正确加载 LoRA → 检查 `get_peft_model` 是否成功

**loss 震荡剧烈**：
- learning rate 太大 → 减小 5-10 倍
- batch size 太小 → 增大 gradient_accumulation_steps
- 数据有噪声 → 检查数据质量

**过拟合（eval loss 上升）**：
- epochs 太多 → 减少 epoch 数
- r 太大 → 减小 rank
- 数据量太少 → 增加数据或做数据增强

**OOM（显存不足）**：
- 减小 per_device_train_batch_size
- 减小 r（rank 越大，可训练参数越多，显存越大）
- 用 QLoRA（4-bit 量化 + LoRA）

---

## 容易犯的错

**只跑一组实验就下结论**。超参数之间有交互作用，r=8 配 lr=1e-4 效果好，不代表 r=16 配 lr=1e-4 也好。至少跑 2-3 组对比。

**评估指标太单一**。只看 loss 不够，还要看实际任务的准确率。loss 下降不代表模型在你的任务上变好了。

**不记录实验配置**。跑完实验忘了用的什么参数，无法复现。每次实验都要记录完整的配置。

**一次改太多参数**。同时改 r、lr、epochs，不知道是哪个参数导致了效果变化。每次只改一个变量。

---

## 练习

### 练习一：跑对比实验

用上面的代码，对你的数据集跑三组对比实验。记录每组的：
- 训练 loss 曲线
- eval loss 曲线
- 最终准确率
- 训练时间
- 显存峰值

```python
# 你的实验代码
# 修改 train_with_config 中的参数
# 记录结果到 comparison_report.md
```

### 练习二：loss 曲线分析

写一个脚本，从 Trainer 的日志中提取 loss 数据并绘图：

```python
import matplotlib.pyplot as plt

def plot_training_curves(trainer_state_path: str):
    """从 trainer_state.json 绘制训练曲线"""
    import json

    with open(trainer_state_path) as f:
        state = json.load(f)

    train_steps = []
    train_losses = []
    eval_steps = []
    eval_losses = []

    for log in state["log_history"]:
        if "loss" in log:
            train_steps.append(log["step"])
            train_losses.append(log["loss"])
        if "eval_loss" in log:
            eval_steps.append(log["step"])
            eval_losses.append(log["eval_loss"])

    plt.figure(figsize=(10, 6))
    plt.plot(train_steps, train_losses, label="Train Loss")
    plt.plot(eval_steps, eval_losses, label="Eval Loss")
    plt.xlabel("Step")
    plt.ylabel("Loss")
    plt.legend()
    plt.title("Training Curves")
    plt.savefig("training_curves.png")
    plt.show()

# 对三组实验分别绘图
for name in ["A_conservative", "B_moderate", "C_aggressive"]:
    plot_training_curves(f"./results/{name}/checkpoint-final/trainer_state.json")
```

### 练习三：超参数搜索

写一个简单的网格搜索脚本，自动尝试不同配置：

```python
import itertools

def grid_search():
    """简单的超参数网格搜索"""
    param_grid = {
        "r": [8, 16],
        "lr": [1e-4, 2e-4, 5e-4],
        "epochs": [2, 3],
    }

    results = []
    for r, lr, epochs in itertools.product(
        param_grid["r"], param_grid["lr"], param_grid["epochs"]
    ):
        config_name = f"r{r}_lr{lr}_e{epochs}"
        print(f"\nRunning: {config_name}")

        try:
            trainer = train_with_config(config_name, r, lr, epochs)
            eval_result = trainer.evaluate()

            results.append({
                "config": config_name,
                "r": r, "lr": lr, "epochs": epochs,
                "eval_loss": eval_result["eval_loss"],
            })
        except Exception as e:
            print(f"Failed: {e}")
            results.append({
                "config": config_name,
                "r": r, "lr": lr, "epochs": epochs,
                "error": str(e),
            })

        torch.cuda.empty_cache()

    # 找最优配置
    valid_results = [r for r in results if "eval_loss" in r]
    best = min(valid_results, key=lambda x: x["eval_loss"])
    print(f"\n最优配置: {best['config']} (eval_loss={best['eval_loss']:.4f})")

    return results
```

---

## 参考答案

### 练习一

关键观察点：
- 如果配置 C 的 eval loss 在后期上升，说明过拟合
- 如果配置 A 的 eval loss 还在下降，说明训练不够，需要更多 epoch
- 如果三组的准确率差距 < 2%，选训练最快、参数最少的那组

### 练习二

loss 曲线的解读：
- train loss 持续下降但 eval loss 上升 → 过拟合
- train loss 和 eval loss 都不下降 → 学习率太小或数据有问题
- loss 震荡剧烈 → 学习率太大或 batch size 太小

### 练习三

网格搜索的注意事项：
- 实验数 = r 的选择数 × lr 的选择数 × epochs 的选择数
- 2×3×2 = 12 组实验，每组可能需要 10-30 分钟
- 先用小规模数据（100 条）快速筛选，再用完整数据验证最优配置
