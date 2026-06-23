# 02 - SQLCoder 实战：开源 NL2SQL 模型的部署与调优

> 当 GPT-4 的 API 账单让你肉疼时，开源 NL2SQL 模型可能是更好的选择。

## 课程信息

| 项目 | 内容 |
|------|------|
| 所属阶段 | Part 2: AI 驱动的图表生成 |
| 前置课程 | 01-NL2SQL原理 |
| 预计时长 | 2.5 小时 |
| 难度等级 | ⭐⭐⭐⭐ |

## 场景引入

上节课我们用 OpenAI API 实现了一个 NL2SQL 系统。它能工作，但有几个现实问题：

**成本问题**：每次查询都要调用 GPT-4 API，一个中等规模的企业每天可能有上万次查询。按 GPT-4o 的定价（输入 $2.5/百万 token），一个包含完整 Schema 和 Few-shot 示例的 Prompt 大约消耗 2000 token，一天下来光 NL2SQL 就要花 $150+。

**隐私问题**：很多企业的数据库 Schema 包含业务敏感信息（表名就能暴露业务模型），把 Schema 发送到外部 API 存在数据合规风险。

**延迟问题**：API 调用需要网络往返，通常 1-3 秒。对于对话式 BI 场景，用户期望的是"说完就看到结果"，3 秒的等待是不可接受的。

**SQLCoder** 是 Defog.ai 开源的 NL2SQL 专用模型，在 Spider 基准上的执行准确率接近 GPT-4，但可以本地部署，解决上面所有问题。本节课会带你从模型选型到部署调优，完整走一遍。

## 学习目标

完成本节课后，你将能够：

1. 理解 SQLCoder 的模型架构和不同版本的区别
2. 掌握 SQLCoder 的三种部署方式：vLLM、Ollama、TGI
3. 学会构造高质量的 Few-shot 示例
4. 了解 LoRA 微调的原理和在 NL2SQL 场景下的实践方法
5. 理解执行准确率（EX）和逻辑准确率（EM）的区别和适用场景
6. 动手部署 SQLCoder 并通过 API 调用

## 核心概念

### 1. SQLCoder 模型架构与版本

SQLCoder 不是从零训练的模型，而是在已有的代码生成模型基础上，用 NL2SQL 数据集微调得到的。它的核心思路是：**既然大模型已经学会了 SQL 语法，那只需要教它"如何根据 Schema 把自然语言映射到正确的 SQL"**。

```
┌─────────────────────────────────────────────────────────┐
│                    SQLCoder 技术栈                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  基座模型                                                 │
│  ├── SQLCoder-7B  →  基于 StarCoder-15B 微调             │
│  ├── SQLCoder-15B →  基于 StarCoder-15B 微调（更大规模）  │
│  └── SQLCoder-34B →  基于 CodeLlama-34B 微调             │
│                                                         │
│  训练数据                                                 │
│  ├── Spider 数据集 (10K+ 样本)                           │
│  ├── BIRD 数据集 (12K+ 样本)                             │
│  ├── 自有合成数据 (Defog 内部生成)                        │
│  └── 人工标注的私有数据集                                 │
│                                                         │
│  关键技术                                                 │
│  ├── Schema-aware 训练：在输入中包含完整 Schema           │
│  ├── 多轮对话格式：支持追问和修正                         │
│  └── 指令微调：遵循用户指定的输出格式                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

版本对比：

| 模型 | 参数量 | 基座模型 | Spider EX | 延迟(单卡) | 显存需求 |
|------|--------|----------|-----------|-----------|---------|
| SQLCoder-7B | 7B | StarCoder-7B | 82.0% | ~0.5s | 16GB |
| SQLCoder-15B | 15B | StarCoder-15B | 85.5% | ~1.0s | 32GB |
| SQLCoder-34B | 34B | CodeLlama-34B | 87.6% | ~1.5s | 64GB |

**选型建议**：7B 版本适合开发测试和简单查询场景；15B 是性价比最优的选择；34B 在复杂查询（多表 JOIN、子查询、CTE）上有明显优势，但需要更多 GPU 资源。

### 2. 本地部署方案对比

SQLCoder 有三种主流的部署方式，各有适用场景：

```
┌──────────────────────────────────────────────────────────────┐
│                      部署方案对比                              │
├──────────┬──────────────┬──────────────┬─────────────────────┤
│          │    vLLM       │    Ollama     │        TGI          │
├──────────┼──────────────┼──────────────┼─────────────────────┤
│ 定位     │ 高性能推理    │ 本地体验优先  │ 生产级服务          │
│ 吞吐量   │ 高(连续批处理)│ 中            │ 高(连续批处理)      │
│ 延迟     │ 低            │ 中            │ 低                  │
│ 量化     │ AWQ/GPTQ     │ GGUF         │ GPTQ/AWQ/BitsAndBytes│
│ API 格式 │ OpenAI 兼容   │ Ollama 原生   │ 自定义 + OpenAI 兼容 │
│ 适用场景 │ 生产部署      │ 开发测试      │ 生产部署(HuggingFace)│
│ 学习曲线 │ 中            │ 低            │ 高                  │
│ 社区活跃 │ 高            │ 高            │ 高                  │
└──────────┴──────────────┴──────────────┴─────────────────────┘
```

### 3. Few-shot 示例的构造方法

Few-shot 示例是提升 NL2SQL 准确率最有效的手段之一。但"有效"的前提是示例的质量够高。

**好的 Few-shot 示例应该满足以下条件**：

```
┌─────────────────────────────────────────────────────────┐
│              高质量 Few-shot 示例的特征                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 覆盖目标查询的模式                                    │
│     → 如果用户常问聚合查询，示例中应该有聚合               │
│     → 如果用户常问多表 JOIN，示例中应该有 JOIN            │
│                                                         │
│  2. 使用目标数据库的 Schema                               │
│     → 不要用 Spider 的示例去处理你的业务数据库             │
│     → 表名、列名、数据值都应该来自真实数据库               │
│                                                         │
│  3. 包含业务术语映射                                      │
│     → "退货" → status = 'returned'                      │
│     → "华东区" → region = '华东'                        │
│     → "本月" → WHERE order_date >= 月初                 │
│                                                         │
│  4. 难度递进                                              │
│     → 从简单单表查询开始                                  │
│     → 逐步增加 JOIN、子查询、窗口函数                     │
│                                                         │
│  5. 3-5 个即可，不是越多越好                              │
│     → 太多会占用上下文窗口                                │
│     → 太多会引入噪声，模型可能学到不相关的模式             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4. 模型微调：LoRA 适配

当 Few-shot 示例不够用时（比如你的数据库 Schema 非常特殊，或者业务逻辑很复杂），就需要微调。

LoRA（Low-Rank Adaptation）是目前最流行的参数高效微调方法。它的核心思想是：**不修改原始模型的权重，而是在旁边加一个小的"适配器"**。

```
原始模型权重 W (冻结，不更新)
    │
    ├── W (原始路径)
    │
    └── ΔW = A × B (LoRA 适配器，只训练这部分)
         │
         ├── A: d × r 矩阵 (降维)
         └── B: r × d 矩阵 (升维)
              其中 r << d (通常 r=8 或 16)
```

对于 SQLCoder 这样的 7B-34B 模型，全量微调需要 64GB+ 显存。而 LoRA 只需要训练原始参数量的 0.1%-1%，一张 A100 甚至 4090 就能完成。

### 5. 评估指标详解

NL2SQL 的评估有两个核心指标，理解它们的区别对优化方向至关重要：

**执行准确率（Execution Accuracy, EX）**：

```
生成的 SQL 执行后的结果 == 标准答案 SQL 执行后的结果 → 正确

优点：
- 允许等价 SQL 写法（如 INNER JOIN vs WHERE 子查询）
- 最贴近实际使用场景

缺点：
- 无法区分"恰好结果正确"和"逻辑正确"
- 对空结果集的查询评估不准确
```

**逻辑准确率（Exact Match, EM）**：

```
生成的 SQL 的抽象语法树 == 标准答案 SQL 的抽象语法树 → 正确

优点：
- 严格评估 SQL 的逻辑正确性
- 不受数据内容影响

缺点：
- 等价 SQL 写法会被判错
- 对大小写、空格等格式敏感（通常会做归一化）
```

实际评估中，**EX 比 EM 更重要**。因为用户关心的是"查询结果对不对"，而不是"SQL 写法和标准答案一不一样"。

## 代码示例

### 方案一：使用 vLLM 部署 SQLCoder

vLLM 是目前性能最好的开源 LLM 推理引擎，支持连续批处理（Continuous Batching），能显著提升吞吐量。

```bash
# 安装 vLLM
pip install vllm

# 启动 SQLCoder-7B 服务（OpenAI 兼容 API）
python -m vllm.entrypoints.openai.api_server \
    --model defog/sqlcoder-7b-2 \
    --dtype auto \
    --api-key your-api-key \
    --port 8000 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.9
```

启动后，你会得到一个 OpenAI 兼容的 API 端点，可以直接用 OpenAI SDK 调用：

```python
"""
sqlcoder_vllm_client.py - 通过 vLLM 部署的 SQLCoder 客户端

使用方式：
    1. 先启动 vLLM 服务（见上方命令）
    2. 运行本脚本
"""

from openai import OpenAI

# 连接到本地 vLLM 服务
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="your-api-key"  # 与启动时设置的一致
)


def build_sqlcoder_prompt(
    user_question: str,
    schema_ddl: str,
    few_shot_examples: list[dict] | None = None
) -> str:
    """
    构建 SQLCoder 专用的 Prompt。
    
    SQLCoder 使用特定的 Prompt 格式，不是 ChatML。
    它期望的输入格式是：
    ### Task
    Generate a SQL query...
    
    ### Database Schema
    CREATE TABLE ...
    
    ### Question
    用户问题
    
    ### Answer
    (模型从这里开始生成)
    """
    prompt_parts = [
        "### Task\n"
        "Generate a SQL query to answer the following question.\n"
        "Use the provided database schema.\n",
        f"### Database Schema\n{schema_ddl}\n",
    ]
    
    # 添加 Few-shot 示例
    if few_shot_examples:
        prompt_parts.append("### Examples\n")
        for i, example in enumerate(few_shot_examples, 1):
            prompt_parts.append(
                f"Question: {example['question']}\n"
                f"SQL: {example['sql']}\n"
            )
    
    prompt_parts.append(f"### Question\n{user_question}\n")
    prompt_parts.append("### Answer\n")
    
    return "\n".join(prompt_parts)


def generate_sql_with_sqlcoder(
    user_question: str,
    schema_ddl: str,
    few_shot_examples: list[dict] | None = None,
    temperature: float = 0.0
) -> str:
    """调用 SQLCoder 生成 SQL。"""
    prompt = build_sqlcoder_prompt(
        user_question=user_question,
        schema_ddl=schema_ddl,
        few_shot_examples=few_shot_examples
    )
    
    response = client.completions.create(
        model="defog/sqlcoder-7b-2",
        prompt=prompt,
        temperature=temperature,
        max_tokens=512,
        stop=["\n\n", "###"]  # 遇到空行或下一个 section 时停止
    )
    
    sql = response.choices[0].text.strip()
    
    # 清理可能的前缀
    if sql.startswith("```sql"):
        sql = sql[6:]
    if sql.endswith("```"):
        sql = sql[:-3]
    
    return sql.strip()


# ============================================================
# 使用示例
# ============================================================

SCHEMA_DDL = """
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    amount REAL,
    region TEXT,
    status TEXT,
    order_date TEXT
);

CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    product_name TEXT,
    category_id INTEGER,
    price REAL,
    cost REAL
);

CREATE TABLE categories (
    category_id INTEGER PRIMARY KEY,
    category_name TEXT
);

CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    customer_name TEXT,
    vip_level TEXT,
    registered_date TEXT
);
"""

FEW_SHOT_EXAMPLES = [
    {
        "question": "总共有多少订单？",
        "sql": "SELECT COUNT(*) AS total_orders FROM orders;"
    },
    {
        "question": "每个品类的平均订单金额是多少？",
        "sql": """SELECT c.category_name, AVG(o.amount) AS avg_amount
FROM orders o
JOIN products p ON o.product_id = p.product_id
JOIN categories c ON p.category_id = c.category_id
GROUP BY c.category_name;"""
    },
    {
        "question": "华东区上个月退货的订单有哪些？",
        "sql": """SELECT order_id, amount, order_date
FROM orders
WHERE region = '华东'
  AND status = 'returned'
  AND order_date >= date('now', 'start of month', '-1 month')
  AND order_date < date('now', 'start of month');"""
    }
]


if __name__ == "__main__":
    question = "哪个品类的利润率最高？请列出前5个。"
    
    sql = generate_sql_with_sqlcoder(
        user_question=question,
        schema_ddl=SCHEMA_DDL,
        few_shot_examples=FEW_SHOT_EXAMPLES
    )
    
    print(f"问题: {question}")
    print(f"生成的 SQL:\n{sql}")
```

### 方案二：使用 Ollama 部署（最简单）

Ollama 是最适合本地开发测试的方案，一行命令就能启动。

```bash
# 安装 Ollama（如果还没有）
# macOS / Linux:
curl -fsSL https://ollama.ai/install.sh | sh

# 拉取 SQLCoder 模型
ollama pull sqlcoder:7b

# 启动服务（默认在 11434 端口）
ollama serve
```

```python
"""
sqlcoder_ollama_client.py - 通过 Ollama 调用 SQLCoder

适合本地开发测试，不需要 GPU 服务器。
"""

import requests
import json


def query_sqlcoder_ollama(
    user_question: str,
    schema_ddl: str,
    few_shot_examples: list[dict] | None = None,
    model: str = "sqlcoder:7b"
) -> str:
    """通过 Ollama API 调用 SQLCoder。"""
    
    # 构建 Prompt
    prompt = f"""### Task
Generate a SQL query to answer the following question.
Use the provided database schema.

### Database Schema
{schema_ddl}

"""
    
    if few_shot_examples:
        prompt += "### Examples\n"
        for example in few_shot_examples:
            prompt += f"Question: {example['question']}\nSQL: {example['sql']}\n"
        prompt += "\n"
    
    prompt += f"### Question\n{user_question}\n\n### Answer\n"
    
    # 调用 Ollama API
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.0,
                "num_predict": 512
            }
        }
    )
    
    result = response.json()
    sql = result["response"].strip()
    
    # 清理输出
    if sql.startswith("```sql"):
        sql = sql[6:]
    if sql.endswith("```"):
        sql = sql[:-3]
    
    return sql.strip()


if __name__ == "__main__":
    SCHEMA = """
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    amount REAL,
    region TEXT,
    status TEXT,
    order_date TEXT
);
"""
    
    question = "华东区上个月的总销售额是多少？"
    sql = query_sqlcoder_ollama(question, SCHEMA)
    print(f"问题: {question}")
    print(f"SQL: {sql}")
```

### 方案三：LoRA 微调 SQLCoder

当通用模型在你的特定数据库上表现不够好时，LoRA 微调是最有效的提升方式。

```python
"""
sqlcoder_lora_finetune.py - 使用 LoRA 微调 SQLCoder

前置条件：
- 安装: pip install transformers peft accelerate datasets bitsandbytes
- GPU: 至少 24GB 显存（7B 模型 + LoRA）
- 数据: 准备好 NL2SQL 训练数据（JSON 格式）
"""

import json
import torch
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer


# ============================================================
# 第一步：准备训练数据
# ============================================================

def prepare_training_data(data_path: str, schema_ddl: str) -> Dataset:
    """
    加载并格式化训练数据。
    
    数据格式要求（JSON 文件）：
    [
        {
            "question": "查询华东区的订单总数",
            "sql": "SELECT COUNT(*) FROM orders WHERE region = '华东'"
        },
        ...
    ]
    """
    with open(data_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    
    # 转换为 SQLCoder 的 Prompt 格式
    formatted_data = []
    for item in raw_data:
        text = (
            f"### Task\n"
            f"Generate a SQL query to answer the following question.\n\n"
            f"### Database Schema\n{schema_ddl}\n\n"
            f"### Question\n{item['question']}\n\n"
            f"### Answer\n{item['sql']}"
        )
        formatted_data.append({"text": text})
    
    return Dataset.from_list(formatted_data)


# ============================================================
# 第二步：配置量化和 LoRA
# ============================================================

def create_lora_config() -> LoraConfig:
    """
    创建 LoRA 配置。
    
    关键参数说明：
    - r: LoRA 的秩，越大拟合能力越强，但参数量也越大
        - 8：适合简单场景
        - 16：通用推荐
        - 32：复杂场景，需要更多训练数据
    - lora_alpha: 缩放因子，通常设为 r 的 2 倍
    - target_modules: 应用 LoRA 的层
        - q_proj, v_proj: Attention 的 Query 和 Value（最小配置）
        - 再加 k_proj, o_proj: 更完整的 Attention 适配
        - 再加 gate_proj, up_proj, down_proj: MLP 层也适配（效果最好但参数更多）
    """
    return LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj"
        ],
        bias="none"
    )


def create_quantization_config() -> BitsAndBytesConfig:
    """
    4-bit 量化配置，减少显存占用。
    
    7B 模型全精度需要 ~28GB 显存，4-bit 量化后只需要 ~7GB。
    加上 LoRA 参数和优化器状态，总共约 12-14GB。
    """
    return BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True
    )


# ============================================================
# 第三步：训练
# ============================================================

def finetune_sqlcoder(
    model_name: str = "defog/sqlcoder-7b-2",
    train_data_path: str = "train_data.json",
    schema_ddl: str = "",
    output_dir: str = "./sqlcoder-lora-output",
    num_epochs: int = 3,
    batch_size: int = 4,
    learning_rate: float = 2e-4
):
    """执行 LoRA 微调。"""
    
    # 加载分词器
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    
    # 加载模型（4-bit 量化）
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=create_quantization_config(),
        device_map="auto",
        trust_remote_code=True
    )
    
    # 应用 LoRA
    lora_config = create_lora_config()
    model = get_peft_model(model, lora_config)
    
    # 打印可训练参数量
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"可训练参数: {trainable_params:,} / {total_params:,} "
          f"({100 * trainable_params / total_params:.2f}%)")
    
    # 准备数据
    dataset = prepare_training_data(train_data_path, schema_ddl)
    
    # 训练参数
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=num_epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=4,
        learning_rate=learning_rate,
        weight_decay=0.01,
        warmup_ratio=0.1,
        lr_scheduler_type="cosine",
        logging_steps=10,
        save_strategy="epoch",
        fp16=True,
        optim="paged_adamw_8bit",
        gradient_checkpointing=True,
        report_to="none"
    )
    
    # 开始训练
    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=2048,
        tokenizer=tokenizer
    )
    
    trainer.train()
    
    # 保存 LoRA 权重
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"LoRA 权重已保存到: {output_dir}")


# ============================================================
# 第四步：评估
# ============================================================

def evaluate_model(
    model_path: str,
    test_data_path: str,
    schema_ddl: str,
    db_path: str
) -> dict:
    """
    评估微调后的模型。
    
    返回指标：
    - EX (Execution Accuracy): 执行准确率
    - EM (Exact Match): 逻辑准确率
    - 总测试样本数
    """
    import sqlite3
    
    # 加载微调后的模型
    from peft import PeftModel
    
    base_model = AutoModelForCausalLM.from_pretrained(
        "defog/sqlcoder-7b-2",
        device_map="auto",
        trust_remote_code=True
    )
    model = PeftModel.from_pretrained(base_model, model_path)
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    
    # 加载测试数据
    with open(test_data_path, "r", encoding="utf-8") as f:
        test_data = json.load(f)
    
    conn = sqlite3.connect(db_path)
    
    correct_ex = 0
    correct_em = 0
    total = len(test_data)
    
    for item in test_data:
        question = item["question"]
        gold_sql = item["sql"]
        
        # 生成 SQL
        prompt = (
            f"### Task\nGenerate a SQL query to answer the following question.\n\n"
            f"### Database Schema\n{schema_ddl}\n\n"
            f"### Question\n{question}\n\n### Answer\n"
        )
        
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.0,
                do_sample=False
            )
        pred_sql = tokenizer.decode(
            outputs[0][inputs["input_ids"].shape[1]:],
            skip_special_tokens=True
        ).strip()
        
        # EX: 执行准确率
        try:
            gold_result = conn.execute(gold_sql).fetchall()
            pred_result = conn.execute(pred_sql).fetchall()
            if set(gold_result) == set(pred_result):
                correct_ex += 1
        except Exception:
            pass
        
        # EM: 逻辑准确率（简化版：归一化后直接比较）
        def normalize_sql(sql):
            return " ".join(sql.lower().split()).rstrip(";")
        
        if normalize_sql(pred_sql) == normalize_sql(gold_sql):
            correct_em += 1
    
    conn.close()
    
    return {
        "total": total,
        "EX": correct_ex / total if total > 0 else 0,
        "EM": correct_em / total if total > 0 else 0,
        "EX_count": correct_ex,
        "EM_count": correct_em
    }


if __name__ == "__main__":
    # 示例：执行微调
    SCHEMA_DDL = """
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    amount REAL,
    region TEXT,
    status TEXT,
    order_date TEXT
);
CREATE TABLE products (
    product_id INTEGER PRIMARY KEY,
    product_name TEXT,
    category_id INTEGER,
    price REAL
);
"""
    
    finetune_sqlcoder(
        model_name="defog/sqlcoder-7b-2",
        train_data_path="train_data.json",
        schema_ddl=SCHEMA_DDL,
        output_dir="./sqlcoder-lora-output",
        num_epochs=3,
        batch_size=4
    )
```

## 常见误区

### 误区一：盲目选择最大的模型

很多人觉得模型越大越好。但 SQLCoder-34B 需要 64GB 显存，推理延迟是 7B 的 3 倍。如果你的查询以简单单表查询为主，7B 模型的准确率已经够用（82% vs 87.6%），但成本和延迟只有 34B 的 1/3。

**正确做法**：先用小模型跑通流程，根据实际准确率决定是否需要升级。

### 误区二：Few-shot 示例直接从 Spider 数据集复制

Spider 的 Schema 和你的业务数据库完全不同。用 Spider 的示例去教模型，等于让它学了一堆不相关的表名和列名。

**正确做法**：Few-shot 示例必须使用你自己数据库的 Schema 和业务术语。

### 误区三：忽略 Prompt 格式的兼容性

不同的模型有不同的 Prompt 格式要求。SQLCoder 使用 `### Task / ### Schema / ### Question / ### Answer` 格式，如果你用 ChatML 格式（`<|im_start|>system`），效果会大打折扣。

**正确做法**：查阅模型文档，严格按照推荐的 Prompt 格式构建输入。

### 误区四：微调时数据量越大越好

NL2SQL 微调的质量比数量更重要。100 条高质量、覆盖多样查询模式的数据，比 1000 条重复的简单查询效果好。

**正确做法**：确保训练数据覆盖目标场景的所有查询模式（单表、多表 JOIN、聚合、子查询、窗口函数等）。

## 小结与练习

### 小结

本节课我们学习了：

1. **SQLCoder 的定位**：开源 NL2SQL 专用模型，在准确率和成本之间取得平衡
2. **三种部署方式**：vLLM（高性能）、Ollama（简单易用）、TGI（生产级）
3. **Few-shot 构造**：覆盖查询模式、使用目标 Schema、包含业务映射、3-5 个即可
4. **LoRA 微调**：参数高效，适合适配特定数据库的 Schema 和业务逻辑
5. **评估指标**：EX（执行准确率）比 EM（逻辑准确率）更贴近实际需求

### 练习

#### 练习一：部署对比测试

分别用 vLLM 和 Ollama 部署 SQLCoder-7B，对同一个 NL2SQL 测试集（至少 20 个问题）进行评测，记录：

1. 两种方案的平均响应延迟
2. 两种方案的执行准确率（EX）
3. 哪些问题在两种方案下结果不一致？分析原因

#### 练习二：Few-shot 示例优化

准备两组 Few-shot 示例：

- A 组：从 Spider 数据集随机选取的通用示例
- B 组：使用你自己数据库 Schema 构造的专用示例

用相同的 10 个测试问题，对比两组的准确率差异。

#### 练习三：LoRA 超参数实验

对以下超参数进行对比实验：

- LoRA rank: 8 vs 16 vs 32
- 学习率: 1e-4 vs 2e-4 vs 5e-4
- 训练轮数: 2 vs 3 vs 5

记录每个配置的验证集 EX 指标，找到最优组合。

---

## 参考答案

### 练习一

**思路**：部署对比需要控制变量——同一个模型、同一组测试数据、同样的 Prompt 格式，只改变推理引擎。

**答案**：

```python
"""
benchmark_comparison.py - vLLM vs Ollama 对比测试
"""

import time
import sqlite3
import json
from openai import OpenAI


def benchmark_vllm(questions: list[dict], schema_ddl: str) -> dict:
    """使用 vLLM 进行基准测试。"""
    client = OpenAI(base_url="http://localhost:8000/v1", api_key="test")
    
    results = []
    for item in questions:
        prompt = (
            f"### Task\nGenerate a SQL query.\n\n"
            f"### Database Schema\n{schema_ddl}\n\n"
            f"### Question\n{item['question']}\n\n### Answer\n"
        )
        
        start = time.time()
        response = client.completions.create(
            model="defog/sqlcoder-7b-2",
            prompt=prompt,
            temperature=0.0,
            max_tokens=512
        )
        latency = time.time() - start
        
        pred_sql = response.choices[0].text.strip()
        results.append({
            "question": item["question"],
            "pred_sql": pred_sql,
            "gold_sql": item["sql"],
            "latency": latency
        })
    
    return compute_metrics(results)


def benchmark_ollama(questions: list[dict], schema_ddl: str) -> dict:
    """使用 Ollama 进行基准测试。"""
    import requests
    
    results = []
    for item in questions:
        prompt = (
            f"### Task\nGenerate a SQL query.\n\n"
            f"### Database Schema\n{schema_ddl}\n\n"
            f"### Question\n{item['question']}\n\n### Answer\n"
        )
        
        start = time.time()
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "sqlcoder:7b",
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.0}
            }
        )
        latency = time.time() - start
        
        pred_sql = response.json()["response"].strip()
        results.append({
            "question": item["question"],
            "pred_sql": pred_sql,
            "gold_sql": item["sql"],
            "latency": latency
        })
    
    return compute_metrics(results)


def compute_metrics(results: list[dict]) -> dict:
    """计算 EX 和延迟指标。"""
    conn = sqlite3.connect(":memory:")
    # 这里需要实际创建数据库表并插入数据
    
    total = len(results)
    correct_ex = 0
    total_latency = 0
    
    for r in results:
        total_latency += r["latency"]
        # 简化：只比较 SQL 文本归一化后的结果
        def normalize(sql):
            return " ".join(sql.lower().split()).rstrip(";")
        if normalize(r["pred_sql"]) == normalize(r["gold_sql"]):
            correct_ex += 1
    
    conn.close()
    
    return {
        "total": total,
        "EX": correct_ex / total,
        "avg_latency": total_latency / total,
        "total_latency": total_latency
    }
```

**要点**：
- vLLM 的连续批处理在批量请求时优势明显，单条请求差异不大
- Ollama 的首次请求会有模型加载延迟，预热后会改善
- 准确率应该完全一致（同一个模型、同样的 Prompt），差异可能来自采样参数

### 练习二

**思路**：对比实验的关键是控制变量。两组示例的格式、数量应该一致，只改变内容。

**答案**：

```python
# A 组：Spider 通用示例（不推荐）
FEW_SHOT_GENERIC = [
    {
        "question": "How many singers are there?",
        "sql": "SELECT COUNT(*) FROM singer;"
    },
    {
        "question": "What are the names of all stadiums?",
        "sql": "SELECT name FROM stadium;"
    },
    {
        "question": "Find the average age of all singers.",
        "sql": "SELECT AVG(age) FROM singer;"
    }
]

# B 组：业务专用示例（推荐）
FEW_SHOT_BUSINESS = [
    {
        "question": "华东区有多少订单？",
        "sql": "SELECT COUNT(*) FROM orders WHERE region = '华东';"
    },
    {
        "question": "每个品类的平均订单金额是多少？",
        "sql": """SELECT c.category_name, AVG(o.amount)
FROM orders o
JOIN products p ON o.product_id = p.product_id
JOIN categories c ON p.category_id = c.category_id
GROUP BY c.category_name;"""
    },
    {
        "question": "上个月退货率最高的产品是什么？",
        "sql": """SELECT p.product_name,
    CAST(SUM(CASE WHEN o.status = 'returned' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) AS return_rate
FROM orders o
JOIN products p ON o.product_id = p.product_id
WHERE o.order_date >= date('now', 'start of month', '-1 month')
  AND o.order_date < date('now', 'start of month')
GROUP BY p.product_name
ORDER BY return_rate DESC
LIMIT 1;"""
    }
]

# 对比测试
for label, examples in [("通用示例", FEW_SHOT_GENERIC), ("专用示例", FEW_SHOT_BUSINESS)]:
    print(f"\n--- {label} ---")
    for question in TEST_QUESTIONS:
        sql = generate_sql_with_sqlcoder(
            question, SCHEMA_DDL, few_shot_examples=examples
        )
        print(f"Q: {question}")
        print(f"SQL: {sql}\n")
```

**要点**：
- 通用示例中的英文表名会让模型困惑，因为你的数据库是中文列名
- 专用示例中的业务术语映射（如"退货率"→ `status = 'returned'`）能显著提升准确率
- 预期 B 组的准确率比 A 组高 15-30 个百分点

### 练习三

**思路**：超参数搜索需要系统性地遍历配置组合，记录每个组合的指标。

**答案**：

```python
"""
lora_hyperparam_search.py - LoRA 超参数网格搜索
"""

EXPERIMENT_CONFIGS = [
    {"r": 8,  "lr": 1e-4, "epochs": 2},
    {"r": 8,  "lr": 2e-4, "epochs": 3},
    {"r": 8,  "lr": 5e-4, "epochs": 5},
    {"r": 16, "lr": 1e-4, "epochs": 3},
    {"r": 16, "lr": 2e-4, "epochs": 3},
    {"r": 16, "lr": 5e-4, "epochs": 5},
    {"r": 32, "lr": 1e-4, "epochs": 2},
    {"r": 32, "lr": 2e-4, "epochs": 3},
    {"r": 32, "lr": 5e-4, "epochs": 5},
]


def run_experiments(configs: list[dict], base_config: dict):
    """运行所有实验配置。"""
    results = []
    
    for i, config in enumerate(configs):
        print(f"\n{'='*50}")
        print(f"实验 {i+1}/{len(configs)}: r={config['r']}, "
              f"lr={config['lr']}, epochs={config['epochs']}")
        print(f"{'='*50}")
        
        output_dir = f"./experiment_r{config['r']}_lr{config['lr']}"
        
        # 执行微调
        finetune_sqlcoder(
            model_name=base_config["model_name"],
            train_data_path=base_config["train_data"],
            schema_ddl=base_config["schema_ddl"],
            output_dir=output_dir,
            num_epochs=config["epochs"],
            batch_size=base_config["batch_size"],
            learning_rate=config["lr"]
        )
        
        # 评估
        metrics = evaluate_model(
            model_path=output_dir,
            test_data_path=base_config["test_data"],
            schema_ddl=base_config["schema_ddl"],
            db_path=base_config["db_path"]
        )
        
        results.append({
            "config": config,
            "metrics": metrics
        })
        
        print(f"EX: {metrics['EX']:.2%}, EM: {metrics['EM']:.2%}")
    
    # 找到最优配置
    best = max(results, key=lambda x: x["metrics"]["EX"])
    print(f"\n最优配置: {best['config']}")
    print(f"最优 EX: {best['metrics']['EX']:.2%}")
    
    return results
```

**要点**：
- rank=16 + lr=2e-4 + epochs=3 通常是不错的起点
- 如果训练数据少于 200 条，rank 不要超过 16，否则容易过拟合
- 学习率过高（5e-4）在小数据集上容易导致训练不稳定
