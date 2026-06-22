# 03 QLoRA 微调——4-bit 量化 + LoRA，在 8GB 显存上微调 7B 模型

> QLoRA 让消费级硬件也能微调大模型。

## 场景引入

你有一张 RTX 3060 12GB，想微调一个 7B 模型。用普通 LoRA 加载模型就要 14GB 显存，直接 OOM。减 batch_size？减到 1 还是不够。用更小的模型？效果差太多。这时 QLoRA 出现了——它把模型量化到 4-bit 再加 LoRA，7B 模型只需 6GB 显存，你的 12GB 卡绰绰有余。但量化会不会影响效果？配置和普通 LoRA 有什么不同？

---

## 学习目标

- 掌握 QLoRA 的配置和使用方法
- 理解 4-bit 量化的原理
- 学会在有限资源下进行微调

---

## 一、QLoRA 配置

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

# 1. 4-bit 量化配置
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True
)

# 2. 加载量化模型
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-7B",
    quantization_config=bnb_config,
    device_map="auto"
)

# 3. 准备模型
model = prepare_model_for_kbit_training(model)

# 4. LoRA 配置
lora_config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

# 5. 应用 LoRA
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
```

---

## 二、显存对比

```
显存对比：

| 方法 | 7B 模型显存 | 13B 模型显存 |
|------|------------|-------------|
| Full FT | 60GB | 120GB |
| LoRA | 16GB | 32GB |
| QLoRA | 6GB | 12GB |

QLoRA 优势：
- 7B 模型只需 6GB 显存
- RTX 3060 12GB 即可微调
- 效果接近 LoRA
```

---

## 三、完整训练代码

```python
from trl import SFTTrainer
from transformers import TrainingArguments

training_args = TrainingArguments(
    output_dir="./output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    fp16=True,
    logging_steps=10,
    save_strategy="epoch",
    warmup_ratio=0.1,
    optim="paged_adamw_8bit"  # 8-bit 优化器
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    tokenizer=tokenizer,
    max_seq_length=2048
)

trainer.train()
```

---

## 四、性能优化

```
QLoRA 性能优化：

1. 梯度检查点
   - 减少显存占用
   - training.gradient_checkpointing = True

2. 8-bit 优化器
   - 减少优化器状态显存
   - optim="paged_adamw_8bit"

3. 梯度累积
   - 模拟更大 batch_size
   - gradient_accumulation_steps=4
```

---

## 五、效果对比

```python
def compare_lora_qlora():
    """对比 LoRA 和 QLoRA 效果"""
    
    # LoRA 结果
    lora_result = evaluate_model(lora_model)
    
    # QLoRA 结果
    qlora_result = evaluate_model(qlora_model)
    
    print(f"LoRA: {lora_result}")
    print(f"QLoRA: {qlora_result}")
    # 通常差距在 1-2% 以内
```

---

## 常见误区

1. **量化后忘记调用 prepare_model_for_kbit_training**：这是 QLoRA 必须的步骤，不调用会导致梯度计算错误。很多新手直接在量化模型上加 LoRA，训练时 Loss 不下降。

2. **认为 QLoRA 效果一定差**：在大多数任务上，QLoRA 和 LoRA 的效果差距在 1-2% 以内。对于资源受限的场景，这点差距完全可以接受。

3. **QLoRA 用 float32 计算**：QLoRA 的 `bnb_4bit_compute_dtype` 应该设为 `float16` 或 `bfloat16`，用 float32 会显著增加计算开销且不提升效果。

4. **忽略双重量化**：`bnb_4bit_use_double_quant=True` 可以进一步减少显存占用（约节省 0.4GB/7B），几乎不影响质量，应该默认开启。

---

## 工程建议

1. **QLoRA 是消费级硬件的首选**：RTX 3060 12GB 就能微调 7B 模型，RTX 4090 24GB 能微调 14B 模型。不需要 A100 也能做微调。

2. **搭配 paged_adamw_8bit 优化器**：8-bit 优化器可以进一步减少优化器状态的显存占用，和 QLoRA 配合使用效果最佳。

3. **gradient_checkpointing 必开**：QLoRA 场景下开启 gradient_checkpointing 可以额外节省 30-40% 的显存，代价是训练速度降低约 20%。

4. **先用 QLoRA 验证再升级 LoRA**：如果不确定微调是否有效，先用 QLoRA 快速验证。确认方向正确后，再考虑是否升级到 LoRA 或全量微调。

---

## 小结

```
本课核心要点：

1. QLoRA = 4-bit 量化 + LoRA
2. 7B 模型只需 6GB 显存
3. 效果接近 LoRA，差距很小
4. 适合消费级硬件

---

**下一课**: [04 训练超参数——Learning Rate / Epoch / Batch Size / LoRA Rank 调优](./04-训练超参数.md)
```

---

## 练习

1. **QLoRA 题**：用 QLoRA 微调一个模型。

2. **显存题**：对比不同方法的显存占用。

3. **效果题**：对比 LoRA 和 QLoRA 的效果差异。

---

## 参考答案

### 练习一：用 QLoRA 微调一个模型

**思路**：QLoRA 的关键区别在于模型加载时使用 4-bit 量化配置，以及调用 `prepare_model_for_kbit_training`。相比普通 LoRA，只需额外加 BitsAndBytesConfig 和准备步骤。

**答案**：
```python
"""QLoRA 微调完整流程"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer
from datasets import load_dataset

# 1. 4-bit 量化配置
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True
)

# 2. 加载量化模型
model_name = "Qwen/Qwen2.5-7B"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)

# 3. 准备模型（QLoRA 必须步骤）
model = prepare_model_for_kbit_training(model)

# 4. LoRA 配置
lora_config = LoraConfig(
    r=16, lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05, bias="none", task_type="CAUSAL_LM"
)
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

# 5. 加载数据
dataset = load_dataset("json", data_files="training_data.json")

# 6. 训练（注意用 paged_adamw_8bit 优化器）
training_args = TrainingArguments(
    output_dir="./output_qlora",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    warmup_ratio=0.1,
    fp16=True,
    optim="paged_adamw_8bit",
    gradient_checkpointing=True,
    logging_steps=10,
    save_strategy="epoch",
    report_to="none",
)

trainer = SFTTrainer(
    model=model, args=training_args,
    train_dataset=dataset["train"],
    tokenizer=tokenizer, max_seq_length=2048
)

trainer.train()
trainer.save_model("./output_qlora/final")
print("QLoRA 训练完成")
```

**要点**：
- `prepare_model_for_kbit_training` 是必须步骤，不调用会导致梯度计算错误、Loss 不下降
- `optim="paged_adamw_8bit"` 和 `gradient_checkpointing=True` 应该同时开启以节省显存
- 常见错误：忘记调用 `prepare_model_for_kbit_training`，或在量化模型上用普通 AdamW 优化器导致 OOM

### 练习二：对比不同方法的显存占用

**思路**：分别用 Full FT、LoRA、QLoRA 加载同一模型，用 `torch.cuda.memory_allocated()` 记录显存使用，量化对比三种方法的显存差异。

**答案**：
```python
"""对比不同微调方法的显存占用"""
import torch
import gc

def get_gpu_memory():
    """获取当前 GPU 显存使用（GB）"""
    return torch.cuda.memory_allocated(0) / 1024**3

def clear_gpu():
    """清理 GPU 显存"""
    gc.collect()
    torch.cuda.empty_cache()

model_name = "Qwen/Qwen2.5-7B"
results = {}

# 1. 测试 Full Fine-tuning 显存
clear_gpu()
print("测试 Full Fine-tuning...")
model_ft = AutoModelForCausalLM.from_pretrained(
    model_name, torch_dtype=torch.float16, device_map="auto"
)
results["Full FT (加载)"] = get_gpu_memory()
# 模拟训练状态（实际训练会更高）
for param in model_ft.parameters():
    param.requires_grad_(True)
results["Full FT (可训练)"] = get_gpu_memory()
del model_ft
clear_gpu()

# 2. 测试 LoRA 显存
clear_gpu()
print("测试 LoRA...")
model_lora = AutoModelForCausalLM.from_pretrained(
    model_name, torch_dtype=torch.float16, device_map="auto"
)
lora_config = LoraConfig(r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"])
model_lora = get_peft_model(model_lora, lora_config)
results["LoRA (r=16)"] = get_gpu_memory()
del model_lora
clear_gpu()

# 3. 测试 QLoRA 显存
clear_gpu()
print("测试 QLoRA...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True, bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True
)
model_qlora = AutoModelForCausalLM.from_pretrained(
    model_name, quantization_config=bnb_config, device_map="auto"
)
model_qlora = prepare_model_for_kbit_training(model_qlora)
model_qlora = get_peft_model(model_qlora, lora_config)
results["QLoRA (4-bit)"] = get_gpu_memory()

# 打印对比
print("\n显存占用对比：")
print("-" * 40)
for method, mem in results.items():
    print(f"  {method}: {mem:.1f} GB")
```

**要点**：
- Full FT 需要保存所有参数的梯度和优化器状态，显存约为模型大小的 3-4 倍
- QLoRA 相比 LoRA 节省约 60% 显存，主要来自 4-bit 量化模型权重
- 常见错误：只对比模型加载显存，不算优化器和梯度的开销，低估实际训练显存需求

### 练习三：对比 LoRA 和 QLoRA 的效果差异

**思路**：用相同数据、相同超参数分别训练 LoRA 和 QLoRA，用相同的测试问题评估输出质量，对比 Loss 曲线和推理结果。

**答案**：
```python
"""对比 LoRA 和 QLoRA 效果"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training, PeftModel
from trl import SFTTrainer
from datasets import load_dataset

model_name = "Qwen/Qwen2.5-7B"
dataset = load_dataset("json", data_files="training_data.json")
tokenizer = AutoTokenizer.from_pretrained(model_name)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

lora_config = LoraConfig(
    r=16, lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05, bias="none", task_type="CAUSAL_LM"
)

training_args = TrainingArguments(
    output_dir="./output_compare",
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    warmup_ratio=0.1,
    fp16=True,
    logging_steps=10,
    save_strategy="no",
    report_to="none",
)

test_questions = ["什么是合同？", "什么是违约责任？", "什么是诉讼时效？"]

# 训练 LoRA
print("训练 LoRA...")
model_lora = AutoModelForCausalLM.from_pretrained(model_name, torch_dtype=torch.float16, device_map="auto")
model_lora = get_peft_model(model_lora, lora_config)
trainer_lora = SFTTrainer(model=model_lora, args=training_args, train_dataset=dataset["train"], tokenizer=tokenizer, max_seq_length=512)
result_lora = trainer_lora.train()
lora_loss = result_lora.training_loss

# 训练 QLoRA
print("训练 QLoRA...")
bnb_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True)
model_qlora = AutoModelForCausalLM.from_pretrained(model_name, quantization_config=bnb_config, device_map="auto")
model_qlora = prepare_model_for_kbit_training(model_qlora)
model_qlora = get_peft_model(model_qlora, lora_config)
trainer_qlora = SFTTrainer(model=model_qlora, args=training_args, train_dataset=dataset["train"], tokenizer=tokenizer, max_seq_length=512)
result_qlora = trainer_qlora.train()
qlora_loss = result_qlora.training_loss

# 对比结果
print("\n效果对比：")
print(f"  LoRA 最终 Loss: {lora_loss:.4f}")
print(f"  QLoRA 最终 Loss: {qlora_loss:.4f}")
print(f"  差距: {abs(lora_loss - qlora_loss):.4f}")
print(f"  通常差距在 1-2% 以内，QLoRA 完全可用")
```

**要点**：
- 在大多数任务上，QLoRA 和 LoRA 的效果差距在 1-2% 以内，QLoRA 是资源受限场景的首选
- 对比时必须用相同的数据、超参数和测试问题，否则对比没有意义
- 常见错误：用不同的数据量或 epochs 对比，得出"QLoRA 效果差"的错误结论
