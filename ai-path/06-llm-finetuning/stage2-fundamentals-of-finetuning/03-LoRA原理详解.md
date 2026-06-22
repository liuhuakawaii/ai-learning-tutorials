# 第 3 课：LoRA 原理详解——低秩适配的数学直觉与工程优势

> **课程定位**：理解 LoRA 微调的核心原理，为实战打下理论基础
> **前置知识**：第 1 课（为什么微调）、第 2 课（微调方法全景）
> **预计时长**：45 分钟

---

## 场景引入

你用 LoRA 微调了一个 7B 模型，但效果不理想——Loss 下降很慢，生成质量也不如预期。同事说"把 r 调大一点"，你调到 64 后反而过拟合了。又有人说"alpha 设成 2r"，你照做了但没什么改善。问题的根源是你不理解 LoRA 的数学原理，不知道每个参数背后的意义。盲目调参就像蒙眼开车，必须先理解原理才能有效调优。

---

## 学习目标

完成本课学习后，你将能够：

1. 用自己的话解释 LoRA 的数学原理
2. 理解"低秩"为什么能工作
3. 说出 LoRA 四个关键参数的含义和调优方向
4. 对比 LoRA 与全量微调、Prefix Tuning 的差异
5. 配置一个合理的 LoRA 参数组合

---

## 一、从全量微调到 LoRA

### 1.1 全量微调的问题

```
全量微调 = 训练模型的所有参数

以 Qwen2.5-7B 为例：
  参数量：7,000,000,000（70 亿）
  每个参数用 float16 存储：2 字节
  仅模型权重就占：14 GB

  训练时还需要：
  - 优化器状态（Adam 需要 2 倍参数量）：28 GB
  - 梯度：14 GB
  - 激活值缓存：数 GB

  总计：需要 60-80 GB 显存
  ─────────────────────────────────
  结论：消费级 GPU（8-12 GB）根本跑不动
```

### 1.2 核心洞察：微调不需要改变所有参数

```
┌─────────────────────────────────────────────────────────────────┐
│                    一个关键观察                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  预训练模型已经学到了丰富的通用知识（语言、逻辑、常识）             │
│  微调只需要"调整"模型的行为方式，而不是"重学"所有知识               │
│                                                                 │
│  类比：                                                         │
│  - 全量微调 ≈ 重新装修整套房子（费时费力）                         │
│  - LoRA    ≈ 只换几件家具和窗帘（快速改变风格）                    │
│                                                                 │
│  数学表达：                                                     │
│  微调后的权重 W' = W + ΔW                                       │
│  其中 ΔW 是"调整量"，通常比 W 小得多                              │
│                                                                 │
│  LoRA 的假设：ΔW 是低秩的（可以用两个小矩阵相乘来近似）            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、LoRA 的数学原理

### 2.1 低秩分解

```
原始权重矩阵：W ∈ R^(d × d)

  以 Qwen2.5-7B 的注意力层为例：
  d = 4096（隐藏层维度）
  W 的参数量 = 4096 × 4096 = 16,777,216（约 1600 万）

LoRA 的做法：
  不直接训练 ΔW（1600 万参数）
  而是分解为两个小矩阵：

  ΔW = B × A

  其中：
  A ∈ R^(r × d)    r × 4096
  B ∈ R^(d × r)    4096 × r
  r << d           r 通常取 8、16、32

  当 r = 16 时：
  A 的参数量 = 16 × 4096 = 65,536
  B 的参数量 = 4096 × 16 = 65,536
  总参数 = 131,072（约 13 万）

  压缩比 = 13 万 / 1600 万 ≈ 0.8%
  ─────────────────────────────────
  只需训练 0.8% 的参数！
```

### 2.2 前向传播

```
┌─────────────────────────────────────────────────────────────────┐
│                    LoRA 前向传播                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  输入 x                                                         │
│    │                                                           │
│    ├──────────────────┐                                         │
│    │                  │                                         │
│    ▼                  ▼                                         │
│  ┌─────┐          ┌─────┐                                      │
│  │  W  │          │ LoRA│                                      │
│  │(冻结)│          │(可训)│                                      │
│  └──┬──┘          └──┬──┘                                      │
│     │                │                                         │
│     │    ┌───┐       │                                         │
│     │    │ A │ ←─────┘  (r × d 矩阵)                           │
│     │    └─┬─┘                                                 │
│     │      │                                                   │
│     │    ┌───┐                                                 │
│     │    │ B │  (d × r 矩阵)                                   │
│     │    └─┬─┘                                                 │
│     │      │                                                   │
│     │    × (alpha / r)  ← 缩放因子                              │
│     │      │                                                   │
│     ▼      ▼                                                   │
│    ┌────────────┐                                              │
│    │  W·x + B·A·x │  = 最终输出                                 │
│    └────────────┘                                              │
│                                                                 │
│  训练时：只更新 A 和 B，W 不变                                    │
│  推理时：W' = W + (alpha/r)·B·A，合并后无额外计算                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 为什么低秩能工作？

```
直觉理解：

  模型在预训练时学到了一个巨大的权重矩阵 W
  微调只需要"调整"这个矩阵的一小部分"方向"

  数学上：
  - ΔW 的奇异值分布通常衰减很快
  - 前几个奇异值就包含了绝大部分信息
  - 用低秩矩阵近似 ΔW 是合理的

  实验证据：
  ┌────────────────────────────────────────────┐
  │  LoRA 论文数据（GPT-3 175B）               │
  ├────────────────────────────────────────────┤
  │  r=4  → 效果 ≈ 全量微调的 95%              │
  │  r=8  → 效果 ≈ 全量微调的 97%              │
  │  r=64 → 效果 ≈ 全量微调的 99%              │
  │                                            │
  │  结论：很小的 r 就能捕获大部分调整量         │
  └────────────────────────────────────────────┘
```

---

## 三、关键参数详解

### 3.1 r（秩）——LoRA 的"容量"

```
r 控制 LoRA 的表达能力：

  r = 4   → 参数最少，训练最快，效果上限最低
  r = 8   → 常用起点，性价比高
  r = 16  → 推荐值，效果和效率的平衡点
  r = 32  → 复杂任务用，参数量翻倍
  r = 64  → 接近全量微调，除非必要不推荐
  r = 128 → 通常没必要，不如直接全量微调

参数量与 r 的关系：
  参数量 = 2 × r × d（d 是隐藏层维度）

  以 d=4096 为例：
  ┌──────┬──────────────┬───────────────┐
  │  r   │  参数量       │  占全量比例    │
  ├──────┼──────────────┼───────────────┤
  │  4   │  32,768      │  0.2%         │
  │  8   │  65,536      │  0.4%         │
  │  16  │  131,072     │  0.8%         │
  │  32  │  262,144     │  1.6%         │
  │  64  │  524,288     │  3.1%         │
  └──────┴──────────────┴───────────────┘

经验法则：
  简单任务（分类、情感分析）→ r=8
  中等任务（问答、摘要）→ r=16
  复杂任务（代码生成、推理）→ r=32-64
```

### 3.2 alpha（缩放因子）——LoRA 的"影响力"

```
alpha 控制 LoRA 对原始权重的影响程度：

  实际缩放 = alpha / r

  例：r=16, alpha=32 → 缩放 = 32/16 = 2.0
  例：r=16, alpha=64 → 缩放 = 64/16 = 4.0

  缩放越大 → LoRA 的影响越强 → 学习速度越快
  缩放太大 → 可能破坏预训练知识 → 效果下降

推荐配置：
  alpha = 2 × r（最常用）
  alpha = r（保守）
  alpha = 4 × r（激进，适合数据量大的场景）

  ┌──────────────────────────────────────┐
  │  常见组合：                           │
  │  r=8,  alpha=16  → 保守入门           │
  │  r=16, alpha=32  → 推荐默认           │
  │  r=32, alpha=64  → 复杂任务           │
  │  r=16, alpha=64  → 数据量大时         │
  └──────────────────────────────────────┘
```

### 3.3 target_modules——LoRA 放在哪里

```
Transformer 中可以加 LoRA 的模块：

  ┌─────────────────────────────────────────────┐
  │  Transformer Block                           │
  │  ┌─────────────────────────────────────┐    │
  │  │  Multi-Head Attention                │    │
  │  │  ├── q_proj  ← 最常加 LoRA          │    │
  │  │  ├── k_proj  ← 常加 LoRA            │    │
  │  │  ├── v_proj  ← 最常加 LoRA          │    │
  │  │  └── o_proj  ← 常加 LoRA            │    │
  │  └─────────────────────────────────────┘    │
  │  ┌─────────────────────────────────────┐    │
  │  │  Feed-Forward Network                │    │
  │  │  ├── gate_proj  ← 可选              │    │
  │  │  ├── up_proj    ← 可选              │    │
  │  │  └── down_proj  ← 可选              │    │
  │  └─────────────────────────────────────┘    │
  └─────────────────────────────────────────────┘

配置策略：
  最小配置：["q_proj", "v_proj"]
    → 参数最少，适合快速实验

  推荐配置：["q_proj", "v_proj", "k_proj", "o_proj"]
    → 效果和效率的平衡

  最大配置：所有线性层
    → 效果最好，参数最多

  经验：先用推荐配置，效果不够再扩展
```

### 3.4 dropout——防过拟合

```
LoRA 的 dropout 在训练时随机"关闭"一部分 LoRA 参数：

  dropout = 0.0  → 不使用，适合数据量大的场景
  dropout = 0.05 → 推荐默认值
  dropout = 0.1  → 数据量小时使用

  数据量 vs dropout 建议：
  ┌──────────────────┬───────────┐
  │  训练样本数       │  dropout  │
  ├──────────────────┼───────────┤
  │  < 1000          │  0.1      │
  │  1000 - 10000    │  0.05     │
  │  > 10000         │  0.0      │
  └──────────────────┴───────────┘
```

---

## 四、LoRA vs 其他方法

```
┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│  方法         │ 可训参数  │ 显存需求  │ 效果     │ 灵活性   │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│  全量微调     │ 100%     │ 极高     │ 最好     │ 低       │
│  LoRA        │ 0.1-3%   │ 低       │ 接近全量 │ 高       │
│  QLoRA       │ 0.1-3%   │ 极低     │ 略低于LoRA│ 高      │
│  Prefix Tuning│ <0.1%   │ 极低     │ 较差     │ 中       │
│  Adapter     │ 1-5%     │ 中       │ 接近全量 │ 中       │
└──────────────┴──────────┴──────────┴──────────┴──────────┘

LoRA 的独特优势：
  1. 合并后无推理延迟（Prefix Tuning 有额外开销）
  2. 可以叠加多个 LoRA（一个基座 + 多个领域适配器）
  3. 可以热切换（不同任务加载不同 LoRA）
  4. 与量化兼容（QLoRA = 4-bit 量化 + LoRA）
```

---

## 五、完整代码示例

### 5.1 基础 LoRA 配置

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, TaskType

# 加载基座模型
model_name = "Qwen/Qwen2.5-7B"
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# LoRA 配置
lora_config = LoraConfig(
    r=16,                              # 秩
    lora_alpha=32,                     # 缩放因子
    target_modules=[                   # 目标模块
        "q_proj", "v_proj", "k_proj", "o_proj"
    ],
    lora_dropout=0.05,                 # Dropout
    bias="none",                       # 不训练偏置
    task_type=TaskType.CAUSAL_LM,      # 任务类型
)

# 应用 LoRA
model = get_peft_model(model, lora_config)

# 查看可训练参数量
model.print_trainable_parameters()
# 输出示例：
# trainable params: 13,107,200 || all params: 7,614,939,136 || trainable%: 0.1721
```

### 5.2 不同 r 的对比实验

```python
import time
from peft import LoraConfig, get_peft_model

def count_trainable(model):
    return sum(p.numel() for p in model.parameters() if p.requires_grad)

# 测试不同 r 值
for r in [4, 8, 16, 32, 64]:
    config = LoraConfig(
        r=r,
        lora_alpha=2*r,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        lora_dropout=0.05,
        task_type=TaskType.CAUSAL_LM,
    )

    # 注意：实际使用时需要重新加载模型
    # 这里仅演示参数量计算
    lora_model = get_peft_model(model, config)
    trainable = count_trainable(lora_model)
    total = sum(p.numel() for p in lora_model.parameters())

    print(f"r={r:3d} | 可训参数: {trainable:>12,} | 占比: {trainable/total*100:.2f}%")
```

---

## 六、常见误区

```
错误 1：r 设得太大
  症状：训练效果反而下降，或与全量微调无差异
  原因：r 太大破坏了低秩假设，且容易过拟合
  解决：从 r=8 开始，逐步增加，找到效果拐点

错误 2：alpha 和 r 的比例不当
  症状：训练 loss 不下降，或下降后反弹
  原因：缩放因子太大或太小
  解决：先用 alpha = 2*r，再微调

错误 3：target_modules 选错
  症状：训练后效果没有变化
  原因：LoRA 没有加到正确的模块上
  解决：确认模型架构中有哪些线性层，用 model.print_trainable_parameters() 检查

错误 4：忘记设置 task_type
  症状：运行时报错或输出异常
  原因：不同任务类型的前向传播逻辑不同
  解决：因果语言模型用 TaskType.CAUSAL_LM

错误 5：学习率与 LoRA 不匹配
  症状：loss 震荡或不收敛
  原因：LoRA 的学习率通常比全量微调高
  解决：LoRA 推荐 1e-4 到 3e-4，比全量微调高 1-2 个数量级
```

---

## 工程建议

1. **从 r=16, alpha=32 开始**：这是经过大量实验验证的默认配置，适用于大多数任务。只有在效果不满足需求时才考虑调整。

2. **先加注意力层的 LoRA**：target_modules 优先选 `["q_proj", "v_proj", "k_proj", "o_proj"]`，这是效果最好的最小配置。如果效果不够再扩展到 FFN 层。

3. **用 model.print_trainable_parameters() 验证配置**：每次修改 LoRA 配置后，务必检查可训练参数量是否符合预期。参数量异常（太多或太少）通常意味着配置有误。

4. **LoRA 适配器可以版本管理**：一个基座模型可以训练多个 LoRA 适配器（不同领域、不同任务），每个适配器只有几十 MB，便于存储和切换。

---

## 小结

```
本课核心要点：

1. LoRA 通过低秩分解（ΔW = B × A）减少可训练参数到 0.1-3%
2. 四个关键参数：r（容量）、alpha（影响力）、target_modules（位置）、dropout（防过拟合）
3. 推荐起点：r=16, alpha=32, target=["q_proj","v_proj","k_proj","o_proj"]
4. 工程优势：合并后无延迟、可叠加、可热切换、与量化兼容
5. 参数调优原则：从小到大，观察效果拐点

---

**下一课**: [04 数据准备——训练数据格式、清洗、去重、质量控制](./04-数据准备.md)
```

---

## 练习

1. **计算题**：假设模型隐藏层维度 d=4096，计算 r=8 和 r=32 时的 LoRA 参数量，并与全量微调对比。

2. **配置题**：你有一个文本分类任务，训练数据 500 条，显存 8GB。请给出 LoRA 的完整配置（r、alpha、target_modules、dropout），并解释为什么这样配置。

3. **实验题**：使用 `model.print_trainable_parameters()` 分别查看 target_modules 为 `["q_proj", "v_proj"]` 和 `["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` 时的可训参数量差异。

---

## 参考答案

### 练习一：计算题

**思路**：根据 LoRA 参数量公式 `参数量 = 2 × r × d × num_layers` 计算不同 r 值下的参数量，并与全量微调对比。

**答案**：

```
已知条件：
  模型隐藏层维度 d = 4096
  以 Qwen2.5-7B 为例，有 32 层 Transformer Block
  每层有 4 个线性层加 LoRA（q_proj, v_proj, k_proj, o_proj）

计算公式：
  单个 LoRA 模块参数量 = 2 × r × d（矩阵 A 和 B 各 r×d 个参数）
  每层参数量 = 4 × 2 × r × d = 8 × r × d
  总参数量 = 8 × r × d × num_layers

r = 8 时：
  单模块参数量 = 2 × 8 × 4096 = 65,536
  每层参数量 = 4 × 65,536 = 262,144
  总参数量 = 262,144 × 32 = 8,388,608（约 840 万）
  占全量比例 = 8,388,608 / 7,000,000,000 ≈ 0.12%

r = 32 时：
  单模块参数量 = 2 × 32 × 4096 = 262,144
  每层参数量 = 4 × 262,144 = 1,048,576
  总参数量 = 1,048,576 × 32 = 33,554,432（约 3360 万）
  占全量比例 = 33,554,432 / 7,000,000,000 ≈ 0.48%

对比：
  ┌────────────┬──────────────┬──────────────┬──────────────┐
  │  方法       │  参数量       │  占全量比例    │  显存（约）   │
  ├────────────┼──────────────┼──────────────┼──────────────┤
  │  全量微调   │  7,000,000,000│  100%        │  60-80 GB    │
  │  LoRA r=8  │  8,388,608   │  0.12%       │  16-18 GB    │
  │  LoRA r=32 │  33,554,432  │  0.48%       │  18-22 GB    │
  └────────────┴──────────────┴──────────────┴──────────────┘

结论：
  r 从 8 增加到 32，参数量增加 4 倍，但仍然不到全量微调的 0.5%。
  LoRA 的参数效率极高，这也是它能在消费级 GPU 上运行的关键原因。
```

**要点**：
- 参数量与 r 成线性关系，r 翻倍则参数量翻倍
- 即使 r=64，LoRA 参数量也仅为全量微调的约 2%
- 常见错误：只计算单层参数量忘记乘以层数——总参数量 = 单层参数量 × 层数

### 练习二：配置题

**思路**：根据任务类型（简单分类）、数据量（500 条）和显存（8GB）三个约束条件，给出合理的 LoRA 配置。

**答案**：

```python
from peft import LoraConfig, TaskType

# 场景分析：
# 1. 任务类型：文本分类（简单任务）
# 2. 数据量：500 条（小数据集，容易过拟合）
# 3. 显存：8GB（有限，需要控制参数量）

lora_config = LoraConfig(
    r=8,                                    # 秩：简单分类任务 r=8 足够
    lora_alpha=16,                          # 缩放因子：alpha = 2 × r = 16
    target_modules=["q_proj", "v_proj"],    # 目标模块：最小配置，减少参数量
    lora_dropout=0.1,                       # Dropout：数据量小（500条），设为 0.1 防过拟合
    bias="none",                            # 不训练偏置：减少参数
    task_type=TaskType.SEQ_CLS,             # 任务类型：序列分类
)

# 理由说明：
# 1. r=8：文本分类是简单任务，不需要大容量的 LoRA
#    - r=8 的参数量约为 r=16 的一半，在小数据集上更不容易过拟合
#
# 2. alpha=16（2×r）：保持标准的缩放比例
#    - 缩放 = alpha/r = 2.0，是经过验证的默认值
#
# 3. target_modules=["q_proj", "v_proj"]：最小配置
#    - 显存只有 8GB，需要尽量减少参数量
#    - q_proj 和 v_proj 是对输出影响最大的模块
#    - 先用最小配置，效果不够再扩展到 k_proj、o_proj
#
# 4. dropout=0.1：数据量小需要强正则化
#    - 500 条数据很容易过拟合
#    - 0.1 的 dropout 可以有效防止过拟合
#
# 5. task_type=TaskType.SEQ_CLS：
#    - 文本分类任务使用 SEQ_CLS，不是 CAUSAL_LM
#    - 这决定了模型头部的结构和损失函数
```

**要点**：
- 数据量小时优先防过拟合：小 r、高 dropout、少 target_modules
- 显存有限时优先减少 target_modules，而不是降低 r——r 决定表达能力，target_modules 决定参数量
- 常见错误：小数据集用大 r（如 r=64）——参数量过大必然过拟合，500 条数据用 r=8 足够

### 练习三：实验题

**思路**：用代码实际对比两种 target_modules 配置的可训参数量差异，理解不同配置对参数量的影响。

**答案**：

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, TaskType

model_name = "Qwen/Qwen2.5-7B"

# 加载基座模型（每次实验需要重新加载）
def load_model():
    model = AutoModelForCausalLM.from_pretrained(
        model_name, torch_dtype="auto", device_map="auto", trust_remote_code=True
    )
    return model

# 配置 1：最小配置
config_minimal = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)

# 配置 2：最大配置（所有线性层）
config_full = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type=TaskType.CAUSAL_LM,
)

# 实验
print("=" * 60)
for name, config in [("最小配置", config_minimal), ("最大配置", config_full)]:
    model = load_model()
    peft_model = get_peft_model(model, config)

    trainable = sum(p.numel() for p in peft_model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in peft_model.parameters())

    print(f"\n{name}：")
    print(f"  target_modules: {config.target_modules}")
    peft_model.print_trainable_parameters()
    print(f"  可训参数: {trainable:,}")
    print(f"  总参数: {total:,}")
    print(f"  占比: {trainable/total*100:.4f}%")

    del model, peft_model

# 预期输出示例：
# ============================================================
#
# 最小配置：
#   target_modules: ['q_proj', 'v_proj']
#   trainable params: 6,553,600 || all params: 7,614,939,136 || trainable%: 0.0861
#   可训参数: 6,553,600
#   总参数: 7,614,939,136
#   占比: 0.0861%
#
# 最大配置：
#   target_modules: ['q_proj', 'v_proj', 'k_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
#   trainable params: 20,185,088 || all params: 7,628,571,648 || trainable%: 0.2646
#   可训参数: 20,185,088
#   总参数: 7,628,571,648
#   占比: 0.2646%
```

预期结果分析：

| 配置 | target_modules | 可训参数 | 占比 |
|------|---------------|---------|------|
| 最小 | q_proj, v_proj（2个） | ~6.5M | ~0.09% |
| 最大 | 全部 7 个线性层 | ~20M | ~0.26% |

差异分析：
- 最大配置的可训参数约为最小配置的 3 倍
- 主要增量来自 FFN 层（gate_proj, up_proj, down_proj），这三个层的参数量与注意力层相当
- 即使是最大配置，可训参数也仅占总参数的 0.26%

**要点**：
- target_modules 从 2 个扩展到 7 个，参数量增加约 3 倍，但占比仍然很低
- FFN 层（gate_proj, up_proj, down_proj）的参数量和注意力层相当
- 常见错误：不调用 `print_trainable_parameters()` 验证配置——配置写错（如模块名拼写错误）会导致 LoRA 实际没有生效
