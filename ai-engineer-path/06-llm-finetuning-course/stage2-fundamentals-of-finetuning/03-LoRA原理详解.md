# 03 LoRA 原理详解——低秩适配的数学直觉与工程优势

> LoRA 是目前最流行的微调方法。理解它的原理能帮你更好地调参。

## 学习目标

- 深入理解 LoRA 的数学原理
- 掌握 LoRA 的关键参数和调优方法
- 理解 LoRA 的工程优势

---

## 一、LoRA 数学原理

```
LoRA 核心思想：

原始权重：W ∈ R^(d×d)
LoRA 分解：ΔW = B × A

其中：
- A ∈ R^(r×d) 随机初始化
- B ∈ R^(d×r) 初始化为 0
- r << d（低秩）

前向传播：
h = W·x + ΔW·x = W·x + B·A·x

训练时：
- 冻结 W
- 只训练 A 和 B

推理时：
- W' = W + B·A
- 无额外延迟
```

---

## 二、关键参数

```
LoRA 关键参数：

1. r（秩）
   - 控制 LoRA 的表达能力
   - 越大效果越好，但参数越多
   - 推荐：8-64

2. alpha（缩放因子）
   - 控制 LoRA 的影响程度
   - 通常设为 r 的倍数
   - 推荐：16-128

3. target_modules
   - 应用 LoRA 的模块
   - 通常包括：q_proj, v_proj, k_proj, o_proj
   - 可以扩展到其他层

4. dropout
   - LoRA 的 dropout
   - 防止过拟合
   - 推荐：0.05-0.1
```

---

## 三、LoRA 配置

```python
from peft import LoraConfig, get_peft_model

# LoRA 配置
lora_config = LoraConfig(
    r=16,                    # 秩
    lora_alpha=32,           # 缩放因子
    target_modules=[         # 目标模块
        "q_proj", "v_proj", "k_proj", "o_proj"
    ],
    lora_dropout=0.05,       # Dropout
    bias="none",             # 偏置
    task_type="CAUSAL_LM"    # 任务类型
)

# 应用 LoRA
model = get_peft_model(base_model, lora_config)

# 查看可训练参数
model.print_trainable_parameters()
```

---

## 四、参数调优

```
参数调优建议：

1. 秩 r
   - 从小开始（8）
   - 逐步增加
   - 效果不再提升时停止

2. 缩放因子 alpha
   - 通常设为 2*r
   - 可以调整影响程度

3. 目标模块
   - 默认：注意力层
   - 扩展：全连接层
   - 更多模块 → 更好效果

4. 学习率
   - LoRA 学习率可以更高
   - 推荐：1e-4 到 3e-4
```

---

## 五、工程优势

```
LoRA 工程优势：

1. 参数效率
   - 可训练参数 < 1%
   - 存储空间小
   - 传输方便

2. 训练效率
   - 内存占用低
   - 训练速度快
   - 适合消费级硬件

3. 灵活性
   - 可以叠加多个 LoRA
   - 可以热切换 LoRA
   - 支持多任务

4. 部署便利
   - 合并后无额外延迟
   - 可以动态加载
   - 支持量化
```

---

## 小结

```
本课核心要点：

1. LoRA 通过低秩分解减少可训练参数
2. 关键参数：r、alpha、target_modules
3. 参数调优从小到大，逐步优化
4. 工程优势：效率高、灵活性好、部署方便

下一课：数据准备——训练数据格式、清洗、去重、质量控制。
```

---

## 练习

1. **原理题**：解释 LoRA 的数学原理。

2. **配置题**：为你的任务配置 LoRA 参数。

3. **调优题**：尝试不同的 LoRA 参数组合。
