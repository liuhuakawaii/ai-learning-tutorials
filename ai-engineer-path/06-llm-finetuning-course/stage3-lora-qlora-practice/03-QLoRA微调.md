# 03 QLoRA 微调——4-bit 量化 + LoRA，在 8GB 显存上微调 7B 模型

> QLoRA 让消费级硬件也能微调大模型。

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
