# 阶段实战——搭建端到端训练 Pipeline

> 课型：项目推进课
> 目标：一条命令，从原始数据到可部署模型

## 当前卡点

数据处理、训练配置、模型合并、量化导出——每个环节单独都会了，但串成一个自动化系统还是会手忙脚乱。新数据来了要手动跑处理，改了配置忘了同步到代码，导出的模型格式对不上部署工具。

你需要一个 Pipeline：改配置就能跑不同的实验，不需要改代码。

## 整体架构

```
原始数据 → 数据处理 → 训练 → 评估 → 合并 → 量化 → 导出
```

每个环节是独立模块，通过配置文件串联。评估不达标就停止，不会浪费时间做后续步骤。

## 配置文件

一个 YAML 文件定义整个实验：

```yaml
# config.yaml
model:
  name: "Qwen/Qwen2.5-7B-Instruct"
  torch_dtype: "bfloat16"

data:
  train_path: "data/train.json"
  eval_path: "data/eval.json"
  max_length: 512

lora:
  r: 16
  alpha: 32
  target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"]
  dropout: 0.05

training:
  epochs: 3
  batch_size: 4
  gradient_accumulation: 4
  learning_rate: 2e-4
  warmup_ratio: 0.1

eval:
  min_accuracy: 0.7

output:
  lora_dir: "./output/lora"
  merged_dir: "./output/merged"
  gguf_path: "./output/model.gguf"

quantize:
  enabled: true
  method: "Q4_K_M"
```

## 核心模块

### 数据处理

```python
from datasets import load_dataset
from transformers import AutoTokenizer

def process_data(config: dict, tokenizer) -> dict:
    dataset = load_dataset("json", data_files={
        "train": config["data"]["train_path"],
        "eval": config["data"]["eval_path"],
    })

    def format_sample(example):
        text = f"### 指令：{example['instruction']}\n### 回答：{example['output']}"
        tokenized = tokenizer(
            text, truncation=True,
            max_length=config["data"]["max_length"],
            padding="max_length",
        )
        tokenized["labels"] = tokenized["input_ids"].copy()
        return tokenized

    return {
        "train": dataset["train"].map(format_sample, remove_columns=dataset["train"].column_names),
        "eval": dataset["eval"].map(format_sample, remove_columns=dataset["eval"].column_names),
    }
```

### 训练

```python
from transformers import AutoModelForCausalLM, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model
import torch

def train_model(config: dict, dataset: dict, tokenizer) -> str:
    model = AutoModelForCausalLM.from_pretrained(
        config["model"]["name"],
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )

    lora_config = LoraConfig(
        r=config["lora"]["r"],
        lora_alpha=config["lora"]["alpha"],
        target_modules=config["lora"]["target_modules"],
        lora_dropout=config["lora"]["dropout"],
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    training_args = TrainingArguments(
        output_dir=config["output"]["lora_dir"],
        num_train_epochs=config["training"]["epochs"],
        per_device_train_batch_size=config["training"]["batch_size"],
        gradient_accumulation_steps=config["training"]["gradient_accumulation"],
        learning_rate=config["training"]["learning_rate"],
        warmup_ratio=config["training"]["warmup_ratio"],
        lr_scheduler_type="cosine",
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_steps=10,
        bf16=True,
        load_best_model_at_end=True,
    )

    trainer = Trainer(
        model=model, args=training_args,
        train_dataset=dataset["train"], eval_dataset=dataset["eval"],
    )
    trainer.train()
    model.save_pretrained(config["output"]["lora_dir"])
    return config["output"]["lora_dir"]
```

### 评估

```python
import json

def evaluate_model(config: dict, lora_path: str, tokenizer) -> dict:
    from peft import PeftModel

    base = AutoModelForCausalLM.from_pretrained(
        config["model"]["name"],
        torch_dtype=torch.bfloat16, device_map="auto", trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(base, lora_path)
    model.eval()

    with open(config["data"]["eval_path"]) as f:
        test_data = json.load(f)

    correct = 0
    for item in test_data:
        prompt = f"### 指令：{item['instruction']}\n### 回答："
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=256, temperature=0)
        predicted = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        if item["output"].strip() in predicted.strip():
            correct += 1

    return {"accuracy": correct / len(test_data), "correct": correct, "total": len(test_data)}
```

### 合并与量化

```python
from peft import PeftModel

def merge_lora(config: dict, lora_path: str) -> str:
    base = AutoModelForCausalLM.from_pretrained(config["model"]["name"], torch_dtype="auto")
    model = PeftModel.from_pretrained(base, lora_path)
    merged = model.merge_and_unload()

    merged_path = config["output"]["merged_dir"]
    merged.save_pretrained(merged_path)
    tokenizer = AutoTokenizer.from_pretrained(config["model"]["name"], trust_remote_code=True)
    tokenizer.save_pretrained(merged_path)
    return merged_path

def quantize_gguf(config: dict, model_path: str):
    import subprocess
    subprocess.run([
        "python", "convert_hf_to_gguf.py", model_path,
        "--outfile", config["output"]["gguf_path"],
        "--outtype", config["quantize"]["method"],
    ], check=True)
```

## 串联运行

```python
# run_pipeline.py
import yaml
from transformers import AutoTokenizer

def main():
    with open("config.yaml") as f:
        config = yaml.safe_load(f)

    tokenizer = AutoTokenizer.from_pretrained(
        config["model"]["name"], trust_remote_code=True
    )

    print("Step 1: 数据处理")
    dataset = process_data(config, tokenizer)

    print("Step 2: 训练")
    lora_path = train_model(config, dataset, tokenizer)

    print("Step 3: 评估")
    eval_results = evaluate_model(config, lora_path, tokenizer)
    print(f"准确率: {eval_results['accuracy']:.2%}")

    if eval_results["accuracy"] < config["eval"]["min_accuracy"]:
        print("不达标，停止")
        return

    print("Step 4: 合并 LoRA")
    merged_path = merge_lora(config, lora_path)

    if config.get("quantize", {}).get("enabled", False):
        print("Step 5: 量化")
        quantize_gguf(config, merged_path)

    print("Pipeline 完成")

if __name__ == "__main__":
    main()
```

```bash
python run_pipeline.py
```

## 断点续跑

Pipeline 在第 3 步失败了，修复后应该从第 3 步继续，而不是从头开始：

```python
import json
from pathlib import Path

STATE_FILE = "pipeline_state.json"

def load_state() -> dict:
    if Path(STATE_FILE).exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {}

def save_state(state: dict):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def run_with_checkpoint(config, tokenizer):
    state = load_state()

    if "data_processed" not in state:
        dataset = process_data(config, tokenizer)
        save_state({**state, "data_processed": True})
    else:
        print("数据处理已完成，跳过")

    if "trained" not in state:
        lora_path = train_model(config, dataset, tokenizer)
        save_state({**state, "trained": True, "lora_path": lora_path})
    else:
        lora_path = state["lora_path"]

    # ... 后续步骤同理
```

## 容易犯的错

**Pipeline 没有幂等性**。重复运行产生重复数据或覆盖已有结果。每一步都应该支持幂等执行。

**所有步骤串行执行**。数据处理和模型评估可以并行时就并行，缩短总耗时。

**硬编码路径和参数**。Pipeline 中的文件路径、模型名称、参数都应该是可配置的。换个环境就要改代码的 Pipeline 不是真正的 Pipeline。

**Pipeline 失败后没有通知**。后台运行的 Pipeline 失败了但没人知道。配置失败告警，至少写个日志。

## 练习

### 练习一：搭建你的 Pipeline

用上面的代码，为你的数据集搭建完整的 Pipeline。先用小参数快速验证（epochs=1, batch_size=2），确认能跑通后再用正式参数。

### 练习二：添加断点续跑

实现 checkpoint 机制。关键：用状态文件记录每步的完成状态和输出路径，失败后重新运行时跳过已完成的步骤。

```python
# 你的实现
# 要求：支持从任意步骤恢复，不重复执行已完成的步骤
```

### 练习三：生成实验报告

扩展 Pipeline，每次运行后自动生成一份 Markdown 报告：

```python
def generate_pipeline_report(config: dict, eval_results: dict, state: dict) -> str:
    """生成报告，包含：配置摘要、评估结果、达标判断、各步骤状态"""
    # 你的实现
    # 报告要面向决策者——先说结论（达标/不达标），再给数据支撑
    pass
```

---

## 参考答案

### 练习一

config.yaml 中的路径要和实际文件对应。训练参数先用小值快速验证，确认 Pipeline 能跑通后再用正式参数。常见坑：tokenizer 的 `trust_remote_code` 要和模型加载时一致，否则 special tokens 处理会出问题。

### 练习二

```python
def run_step(state: dict, step_name: str, fn, save_keys: dict = None):
    if step_name in state:
        print(f"{step_name} 已完成，跳过")
        return state[step_name].get("result")

    result = fn()
    state[step_name] = {"done": True, "result": result}
    if save_keys:
        state[step_name].update(save_keys)
    save_state(state)
    return result
```

### 练习三

报告应该面向决策者——先说结论（达标/不达标），再给数据支撑。数字本身没有意义，分析才有价值。比如不要只写"准确率 72%"，要写"准确率 72%，超过阈值 70%，但余量较小，建议在下一轮实验中增加训练数据量"。
