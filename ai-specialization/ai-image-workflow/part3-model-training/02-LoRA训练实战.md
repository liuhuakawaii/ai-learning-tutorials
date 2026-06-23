# 第 2 课：LoRA 训练实战 — 从数学原理到生产部署

## 场景引入

你已经按照上一课的方法，准备好了 30 张品牌风格图片和对应的高质量标注。数据集干净、结构正确、caption 精准。现在面对 kohya-ss sd-scripts 的训练命令和几十个参数，你发现一个更棘手的问题：这些参数到底该怎么设？

`network_dim` 设 32 还是 128？`learning_rate` 用 1e-4 还是 5e-5？`network_alpha` 和 `network_dim` 的关系是什么？`num_epochs` 设多少才能既学到风格又不过拟合？

这些问题不能靠"试"来解决——训练一次 SDXL LoRA 在 4090 上要跑 1-3 小时，在 3060 上可能要 8 小时以上。盲目试错的代价太高了。你需要理解每个参数背后的数学含义，才能做出合理的判断。

本课将从 LoRA 的数学原理讲起，逐步带你完成从配置到训练到评估的全流程。学完这节课，你不仅能跑通训练，更能解释每一个参数选择的理由。

## 学习目标

完成本课后，你将能够：
1. 解释 LoRA 低秩分解的数学原理和工程意义
2. 配置 kohya-ss sd-scripts 的完整训练参数
3. 理解 SDXL LoRA、SD1.5 LoRA 和 FLUX LoRA 的训练差异
4. 制定合理的 checkpoint 保存和模型评估策略
5. 诊断和解决常见的训练问题（过拟合、欠拟合、模式崩塌）

## 一、LoRA 的数学原理

### 1.1 低秩分解：用小矩阵逼近大矩阵

LoRA（Low-Rank Adaptation）的核心思想来自线性代数中的低秩矩阵分解。对于一个预训练好的权重矩阵 $W_0 \in \mathbb{R}^{d \times k}$，LoRA 将微调后的权重表示为：

```
W = W₀ + ΔW = W₀ + B·A

其中:
  W₀ ∈ R^(d×k)    原始预训练权重（冻结，不更新）
  B  ∈ R^(d×r)     低秩矩阵（可训练）
  A  ∈ R^(r×k)     低秩矩阵（可训练）
  r  << min(d,k)   秩（rank），远小于原始维度
```

这个分解的精妙之处在于：假设微调需要的权重变化量 $\Delta W$ 实际上是一个低秩矩阵——即它的大部分信息可以用远小于原始维度的秩来近似表达。

```
┌─────────────────────────────────────────────────────┐
│              LoRA 低秩分解示意图                      │
│                                                     │
│  原始权重 W₀          LoRA 分支 ΔW = B · A          │
│  (冻结)               (可训练)                       │
│                                                     │
│  ┌─────────┐          ┌───┐   ┌───────────┐        │
│  │         │          │   │   │           │        │
│  │  d × k  │          │d×r│ × │   r × k   │        │
│  │         │          │   │   │           │        │
│  │ (768×768│          │768│   │  32 × 768 │        │
│  │  =590K  │          │×32│   │  =24K     │        │
│  │ params) │          │   │   │           │        │
│  │         │          │   │   │           │        │
│  └─────────┘          └───┘   └───────────┘        │
│                                                     │
│  可训练参数: 0         可训练参数: 768×32 + 32×768    │
│                         = 24,576 + 24,576           │
│                         = 49,152 (约 50K)           │
│                                                     │
│  对比全量微调: 590K → 50K, 参数量减少 91.5%          │
└─────────────────────────────────────────────────────┘
```

用代码来展示这个过程：

```python
import torch
import torch.nn as nn
import math

class LoRALinear(nn.Module):
    """LoRA 线性层：在原始线性层上添加低秩适配"""

    def __init__(
        self,
        original_layer: nn.Linear,
        rank: int = 32,
        alpha: float = 32.0,
        dropout: float = 0.0,
    ):
        super().__init__()
        self.original_layer = original_layer
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank  # 缩放因子

        in_features = original_layer.in_features
        out_features = original_layer.out_features

        # A 矩阵: 降维 (k -> r), 用高斯初始化
        self.lora_A = nn.Parameter(
            torch.empty(rank, in_features)
        )
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))

        # B 矩阵: 升维 (r -> d), 初始化为零
        # 这样训练开始时 ΔW = B·A = 0, 不影响预训练权重
        self.lora_B = nn.Parameter(
            torch.zeros(out_features, rank)
        )

        self.dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

        # 冻结原始权重
        self.original_layer.weight.requires_grad = False
        if self.original_layer.bias is not None:
            self.original_layer.bias.requires_grad = False

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 原始前向传播 + LoRA 分支
        original_output = self.original_layer(x)

        # LoRA 分支: x → dropout → A → B → scale
        lora_output = self.lora_B @ (self.lora_A @ self.dropout(x).T)
        lora_output = lora_output.T * self.scaling

        return original_output + lora_output

    def merge_weights(self):
        """将 LoRA 权重合并到原始层（推理时使用，消除额外计算开销）"""
        with torch.no_grad():
            # ΔW = B · A · scaling
            delta_w = self.lora_B @ self.lora_A * self.scaling
            self.original_layer.weight += delta_w

    @property
    def num_trainable_params(self) -> int:
        return self.lora_A.numel() + self.lora_B.numel()

# 示例：对比参数量
original = nn.Linear(768, 768)
lora_layer = LoRALinear(original, rank=32)

print(f"原始层参数量:     {original.weight.numel():,}")  # 589,824
print(f"LoRA 可训练参数:  {lora_layer.num_trainable_params:,}")  # 49,152
print(f"参数量占比:       {lora_layer.num_trainable_params / original.weight.numel() * 100:.1f}%")
# 输出: 参数量占比: 8.3%
```

### 1.2 Rank 的工程含义

Rank（秩）是 LoRA 最重要的超参数。它决定了 LoRA 分支的"表达能力"——rank 越高，能表示的权重变化越复杂，但参数量也越大。

```
Rank    参数量(每层)    表达能力        适用场景
──────────────────────────────────────────────────
4       ~6K            低             简单风格,色彩调整
8       ~12K           中低           轻度风格迁移
16      ~25K           中             多数风格 LoRA
32      ~49K           中高           复杂风格/多概念
64      ~98K           高             高度细节还原
128     ~196K          很高           角色/IP 训练
256     ~392K          非常高          复杂多概念(慎用)
```

一个关键的直觉：rank=16 意味着 LoRA 只需要 16 个"基向量"就能线性组合出你需要的权重变化。对于风格学习这种相对单一的特征，16-32 通常足够了。但如果需要学习一个角色的多种姿态、表情、服装变化，可能需要更高的 rank。

### 1.3 network_alpha 的作用

`network_alpha` 是一个容易被忽视但很重要的参数。它控制 LoRA 分支输出的缩放因子：

```
scaling = alpha / rank

最终输出 = 原始输出 + LoRA 分支输出 × scaling
```

如果 `alpha = rank`（比如都设为 32），scaling = 1，LoRA 分支的输出不做缩放。
如果 `alpha < rank`（比如 alpha=16, rank=32），scaling = 0.5，LoRA 分支的输出被缩小。

**为什么需要这个缩放？** 当 rank 较高时，B 和 A 矩阵的乘积可能会产生较大的值，导致 LoRA 分支的输出"盖过"原始权重。通过设置 `alpha < rank`，可以抑制这种效应。

经验法则：将 `network_alpha` 设为 `rank` 的一半或相等值。

## 二、参数量与训练方法对比

### 2.1 Full Finetune vs LoRA vs DreamBooth

```
┌──────────────────────────────────────────────────────────┐
│              三种微调方法对比                               │
│                                                          │
│  方法           参数量      显存需求    训练时间   效果      │
│  ─────────────────────────────────────────────────────── │
│  Full Finetune  全部        24GB+       12h+     最佳     │
│                 (~1B)       (SDXL)      (3090)           │
│                                                          │
│  LoRA           0.1-1%      8-12GB      1-3h     优秀     │
│                 (~1-10M)    (SDXL)      (4090)           │
│                                                          │
│  DreamBooth     0.1-1%      12-16GB     2-4h     优秀     │
│                 (~1-10M)    (SDXL)      (4090)   (主体)   │
│                                                          │
│  Textual Inv.   ~0.001%     8GB         0.5-1h   良好     │
│                 (~5K)       (SDXL)      (4090)   (有限)   │
└──────────────────────────────────────────────────────────┘
```

Full Finetune 更新模型的所有参数，效果最好但代价极高。SDXL 有约 2.6B 参数，全量微调需要 24GB+ 显存，训练时间以小时计。LoRA 只训练约 0.1-1% 的参数，显存需求降低到 8-12GB，训练时间缩短到 1-3 小时，而效果通常能达到全量微调的 90-95%。

这就是 LoRA 在社区流行的根本原因：它让消费级显卡（甚至 8GB 的 4060）也能训练高质量的定制模型。

## 三、kohya-ss sd-scripts 训练流程

### 3.1 环境搭建

kohya-ss sd-scripts 是目前社区最主流的 SD/SDXL/FLUX LoRA 训练工具。2025 年的最新版本已经支持 SDXL、SD3、FLUX.1 等多个架构。

```bash
# 克隆仓库
git clone https://github.com/kohya-ss/sd-scripts.git
cd sd-scripts

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖（2025 版本要求 PyTorch 2.x）
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt

# 验证安装
python -c "import torch; print(f'PyTorch {torch.__version__}, CUDA: {torch.cuda.is_available()}')"
```

### 3.2 SDXL LoRA 训练命令

以下是一个经过验证的 SDXL LoRA 训练配置，适合风格学习任务：

```bash
# train_sdxl_lora.sh
# SDXL LoRA 风格训练脚本

accelerate launch --num_cpu_threads_per_process 1 sdxl_train_network.py \
    --pretrained_model_name_or_path="stabilityai/stable-diffusion-xl-base-1.0" \
    --train_data_dir="./train_data/img" \
    --reg_data_dir="./train_data/reg/1_reg_image" \
    --output_dir="./output" \
    --output_name="brand_style_lora" \
    --save_model_as="safetensors" \
    --resolution="1024,1024" \
    --train_batch_size=2 \
    --max_train_epochs=10 \
    --learning_rate=1e-4 \
    --unet_lr=1e-4 \
    --text_encoder_lr=5e-5 \
    --network_module="networks.lora" \
    --network_dim=32 \
    --network_alpha=16 \
    --network_train_unet_only \
    --mixed_precision="bf16" \
    --save_precision="bf16" \
    --save_every_n_epochs=2 \
    --optimizer_type="AdamW8bit" \
    --lr_scheduler="cosine_with_restarts" \
    --lr_warmup_steps=100 \
    --max_token_length=225 \
    --caption_extension=".txt" \
    --shuffle_caption \
    --keep_tokens=1 \
    --enable_bucket \
    --min_bucket_reso=512 \
    --max_bucket_reso=1536 \
    --bucket_reso_steps=64 \
    --noise_offset=0.05 \
    --lowram \
    --cache_latents \
    --cache_latents_to_disk \
    --gradient_checkpointing \
    --xformers
```

### 3.3 关键参数详解

让我逐个解释每个关键参数的选择理由：

**learning_rate=1e-4, unet_lr=1e-4, text_encoder_lr=5e-5**

学习率是最敏感的参数。UNet 的学习率设为 1e-4 是 SDXL LoRA 的经验最优值——太大会导致训练不稳定，太小会学不到特征。Text encoder 的学习率设为 UNet 的一半（5e-5），因为 text encoder 对学习率更敏感，过高的学习率会破坏已有的文本理解能力。

```python
def compute_learning_rate_schedule(
    base_lr: float,
    warmup_steps: int,
    total_steps: int,
    scheduler: str = "cosine_with_restarts"
):
    """计算学习率调度（可视化辅助理解）"""
    import math

    schedule = []
    for step in range(total_steps):
        # Warmup 阶段：线性增长
        if step < warmup_steps:
            lr = base_lr * (step / warmup_steps)
        else:
            # Cosine 阶段：余弦衰减
            progress = (step - warmup_steps) / (total_steps - warmup_steps)
            lr = base_lr * 0.5 * (1 + math.cos(math.pi * progress))

        schedule.append(lr)

    return schedule

# 可视化
schedule = compute_learning_rate_schedule(
    base_lr=1e-4,
    warmup_steps=100,
    total_steps=1000
)

print("学习率调度曲线 (前 200 步):")
for step in [0, 25, 50, 75, 100, 150, 200]:
    bar = "█" * int(schedule[step] * 50000)
    print(f"  Step {step:4d}: lr={schedule[step]:.6f} {bar}")
```

**network_dim=32, network_alpha=16**

rank=32 是风格 LoRA 的"甜点"——表达能力足够学习复杂的风格特征，同时参数量可控（约 50K 参数/层）。alpha=16（rank 的一半）提供了适度的缩放，防止 LoRA 分支的输出过大。

**train_batch_size=2**

Batch size 影响梯度的稳定性和显存占用。SDXL 训练时，batch_size=2 在 12GB 显存的显卡上是安全的选择。更大的 batch size 需要更多显存，但梯度更稳定。

**save_every_n_epochs=2**

每 2 个 epoch 保存一次 checkpoint。这是为了在训练完成后可以选择最佳的 checkpoint——如果第 4 个 epoch 的效果比第 10 个好（后者可能过拟合了），你可以选择第 4 个。

**noise_offset=0.05**

Noise offset 是一种训练技巧，在标准的扩散噪声上加一个微小的偏移。这有助于模型学习更丰富的暗部和亮部细节，对风格学习有正面效果。

## 四、SDXL vs SD1.5 vs FLUX 的训练差异

### 4.1 三种架构的关键区别

```
┌─────────────────────────────────────────────────────────────┐
│              SD1.5 vs SDXL vs FLUX.1 训练对比                │
│                                                             │
│  特性           SD1.5        SDXL         FLUX.1            │
│  ──────────────────────────────────────────────────────────│
│  基础分辨率     512×512      1024×1024    1024×1024         │
│  参数量         860M         2.6B         12B               │
│  显存需求       6-8GB        10-12GB      16-24GB           │
│  训练时间       30min-1h     1-3h         2-6h              │
│  Text Encoder   CLIP(1)      CLIP(2)+T5   T5-XXL+CLIP      │
│  推荐 rank      16-32        16-64        16-32             │
│  推荐 lr        1e-4         1e-4         5e-5              │
│  合并方式       单文件合并    单文件合并   diffusers 格式    │
│  ──────────────────────────────────────────────────────────│
│  适用场景       快速原型      生产主力    高质量/新架构      │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 FLUX.1 LoRA 训练要点

FLUX.1 是 Black Forest Labs（Stable Diffusion 核心团队出走后创建）发布的新架构。它的参数量达到了 12B，是 SDXL 的近 5 倍，但 LoRA 训练的显存需求仍然可以控制在消费级显卡范围内。

```bash
# train_flux_lora.sh
# FLUX.1 LoRA 训练脚本（kohya-ss sd-scripts 2025 版）

accelerate launch --num_cpu_threads_per_process 1 flux_train_network.py \
    --pretrained_model_name_or_path="black-forest-labs/FLUX.1-dev" \
    --train_data_dir="./train_data/img" \
    --output_dir="./output_flux" \
    --output_name="brand_style_flux_lora" \
    --save_model_as="safetensors" \
    --resolution="1024,1024" \
    --train_batch_size=1 \
    --max_train_epochs=6 \
    --learning_rate=5e-5 \
    --unet_lr=5e-5 \
    --text_encoder_lr=0 \
    --network_module="networks.lora_flux" \
    --network_dim=16 \
    --network_alpha=8 \
    --mixed_precision="bf16" \
    --save_precision="bf16" \
    --save_every_n_epochs=2 \
    --optimizer_type="AdamW8bit" \
    --lr_scheduler="cosine_with_restarts" \
    --lr_warmup_steps=50 \
    --caption_extension=".txt" \
    --shuffle_caption \
    --keep_tokens=1 \
    --enable_bucket \
    --cache_latents \
    --cache_latents_to_disk \
    --gradient_checkpointing \
    --t5xxl_max_token_length=512 \
    --ae="black-forest-labs/FLUX.1-dev"  # FLUX 使用独立的 AutoEncoder
```

FLUX 训练的关键差异：

1. **学习率更低**（5e-5 vs 1e-4）：FLUX 的参数量更大，需要更小的学习率来避免破坏预训练知识
2. **Rank 更保守**（16 vs 32）：FLUX 本身表达能力很强，较低的 rank 就能学到足够的风格特征
3. **不训练 text encoder**：FLUX 使用 T5-XXL 作为 text encoder，这个模型太大（4.7B 参数），训练它的 LoRA 会显著增加显存需求，而且对风格学习的帮助有限
4. **Batch size 通常为 1**：FLUX 的显存占用大，batch_size=1 是安全的选择

## 五、训练过程监控与 Checkpoint 策略

### 5.1 训练监控指标

训练过程中需要关注几个关键指标来判断训练状态：

```python
"""
训练日志分析工具
解析 kohya-ss 输出的训练日志，判断训练状态
"""
import re
from pathlib import Path

def parse_training_log(log_path: Path) -> dict:
    """解析 kohya-ss 训练日志"""
    loss_pattern = re.compile(
        r"epoch\s+(\d+)/(\d+)\s+.*?loss:\s+([\d.]+)"
    )

    epochs = []
    losses = []

    with open(log_path, "r") as f:
        for line in f:
            match = loss_pattern.search(line)
            if match:
                epoch = int(match.group(1))
                loss = float(match.group(3))
                epochs.append(epoch)
                losses.append(loss)

    return {"epochs": epochs, "losses": losses}

def diagnose_training(log_data: dict) -> list[str]:
    """根据训练指标诊断问题"""
    losses = log_data["losses"]
    diagnoses = []

    if len(losses) < 3:
        return ["数据点不足，无法诊断"]

    # 检查 loss 是否在下降
    first_third = losses[:len(losses)//3]
    last_third = losses[len(losses)//3:]

    avg_first = sum(first_third) / len(first_third)
    avg_last = sum(last_third) / len(last_third)

    if avg_last > avg_first:
        diagnoses.append("⚠️ Loss 在上升，可能是学习率过高或数据有问题")

    if avg_last / avg_first < 0.3:
        diagnoses.append("⚠️ Loss 下降过快（下降 >70%），可能过拟合")

    # 检查 loss 是否震荡
    if len(losses) > 5:
        recent_losses = losses[-5:]
        variance = sum((l - sum(recent_losses)/5)**2 for l in recent_losses) / 5
        if variance > 0.01:
            diagnoses.append("⚠️ Loss 震荡严重，建议降低学习率")

    # 检查 loss 是否趋于平稳
    if len(losses) > 10:
        last_10 = losses[-10:]
        if max(last_10) - min(last_10) < 0.005:
            diagnoses.append("✅ Loss 已收敛，可以停止训练")

    if not diagnoses:
        diagnoses.append("✅ 训练状态正常")

    return diagnoses

# 使用示例
log_data = parse_training_log(Path("./training.log"))
diagnoses = diagnose_training(log_data)

print("训练诊断结果:")
for d in diagnoses:
    print(f"  {d}")
```

### 5.2 Checkpoint 保存策略

```
┌─────────────────────────────────────────────────────────────┐
│              Checkpoint 保存策略                             │
│                                                             │
│  Epoch:  1    2    3    4    5    6    7    8    9    10    │
│          │    │    │    │    │    │    │    │    │    │     │
│  Loss:  0.12 0.09 0.07 0.06 0.05 0.05 0.04 0.04 0.04 0.04│
│          │         │         │         │              │     │
│  Save:   ✓    ·    ✓    ·    ✓    ·    ✓    ·    ·    ✓    │
│                                                             │
│  评估:   ──────┬──────────┬──────────┬──────────┬──────     │
│                │          │          │          │           │
│  建议:    可能欠拟合  最佳候选  开始收敛  可能过拟合 最终模型  │
│                                                             │
│  最终选择: Epoch 4 或 5 的 checkpoint                        │
└─────────────────────────────────────────────────────────────┘
```

每 2 个 epoch 保存一次 checkpoint 的策略让你可以在训练结束后选择最佳模型。判断标准：

1. **Loss 曲线**：选择 loss 开始趋于平稳的 checkpoint
2. **生成质量**：用固定的 prompt 生成图片，选择视觉效果最好的
3. **过拟合检测**：如果后期的 checkpoint 生成的图片和训练集过于相似，说明过拟合了

```python
def select_best_checkpoint(
    checkpoint_dir: Path,
    test_prompts: list[str],
    base_model: str = "stabilityai/stable-diffusion-xl-base-1.0"
) -> Path:
    """通过生成样张选择最佳 checkpoint"""
    import torch
    from diffusers import StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(
        base_model, torch_dtype=torch.float16
    ).to("cuda")

    checkpoints = sorted(checkpoint_dir.glob("*.safetensors"))
    results = {}

    for ckpt_path in checkpoints:
        print(f"评估 checkpoint: {ckpt_path.name}")

        # 加载 LoRA
        pipe.load_lora_weights(ckpt_path)

        scores = []
        for prompt in test_prompts:
            image = pipe(
                prompt=prompt,
                num_inference_steps=25,
                guidance_scale=7.5,
            ).images[0]
            # 保存样张供人工评估
            sample_dir = checkpoint_dir / "samples" / ckpt_path.stem
            sample_dir.mkdir(parents=True, exist_ok=True)
            safe_name = prompt[:30].replace(" ", "_")
            image.save(sample_dir / f"{safe_name}.png")

        pipe.unload_lora_weights()
        results[ckpt_path.name] = scores

    return results

# 使用示例
test_prompts = [
    "morandi_brand_style, a minimalist poster design",
    "morandi_brand_style, a social media graphic with muted tones",
    "morandi_brand_style, an abstract composition with soft lighting",
]
# 生成样张后人工评估，选择最佳 checkpoint
```

## 六、完整的 Python 训练脚本

虽然 kohya-ss 提供了命令行工具，但理解底层的训练循环对调试和定制至关重要：

```python
"""
sdxl_lora_training.py
SDXL LoRA 训练的核心循环（简化版，展示关键逻辑）
依赖: torch, diffusers, transformers, peft
"""
import torch
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from pathlib import Path
from diffusers import AutoencoderKL, UNet2DConditionModel, DDPMScheduler
from transformers import CLIPTextModel, CLIPTokenizer, CLIPTextModelWithProjection
from peft import LoraConfig, get_peft_model
from tqdm import tqdm

class LoRAFineTuningDataset(Dataset):
    """训练数据集：加载图片和 caption，编码为 latent"""

    def __init__(self, image_dir: Path, tokenizer, vae, size=1024):
        self.samples = []
        self.tokenizer = tokenizer
        self.vae = vae
        self.size = size

        # 收集所有图片-caption对
        img_dir = Path(image_dir)
        for img_path in img_dir.glob("*.png"):
            cap_path = img_dir / f"{img_path.stem}.txt"
            if cap_path.exists():
                self.samples.append((img_path, cap_path))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, cap_path = self.samples[idx]

        # 加载图片并预处理
        image = Image.open(img_path).convert("RGB")
        image = image.resize((self.size, self.size), Image.LANCZOS)
        image_tensor = torch.tensor(
            [list(image.getdata())],
            dtype=torch.float32
        ).reshape(3, self.size, self.size) / 127.5 - 1.0

        # 编码 caption
        caption = cap_path.read_text(encoding="utf-8").strip()
        text_inputs = self.tokenizer(
            caption,
            padding="max_length",
            max_length=77,
            truncation=True,
            return_tensors="pt",
        )

        return {
            "pixel_values": image_tensor,
            "input_ids": text_inputs.input_ids[0],
            "caption": caption,
        }

def train_lora_sdxl(
    model_path: str,
    train_data_dir: str,
    output_dir: str,
    rank: int = 32,
    alpha: float = 16,
    learning_rate: float = 1e-4,
    num_epochs: int = 10,
    batch_size: int = 2,
):
    """SDXL LoRA 训练主函数"""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # 加载 SDXL 组件
    print("加载模型组件...")
    vae = AutoencoderKL.from_pretrained(
        model_path, subfolder="vae", torch_dtype=torch.float16
    ).to(device)

    unet = UNet2DConditionModel.from_pretrained(
        model_path, subfolder="unet", torch_dtype=torch.float16
    ).to(device)

    tokenizer = CLIPTokenizer.from_pretrained(model_path, subfolder="tokenizer")
    text_encoder = CLIPTextModel.from_pretrained(
        model_path, subfolder="text_encoder", torch_dtype=torch.float16
    ).to(device)

    noise_scheduler = DDPMScheduler.from_pretrained(
        model_path, subfolder="scheduler"
    )

    # 配置 LoRA
    print(f"配置 LoRA: rank={rank}, alpha={alpha}")
    lora_config = LoraConfig(
        r=rank,
        lora_alpha=alpha,
        target_modules=["to_q", "to_k", "to_v", "to_out.0"],
        lora_dropout=0.05,
        bias="none",
    )

    unet = get_peft_model(unet, lora_config)
    unet.print_trainable_parameters()

    # 冻结其他组件
    vae.requires_grad_(False)
    text_encoder.requires_grad_(False)

    # 准备数据集
    print("准备数据集...")
    dataset = LoRAFineTuningDataset(
        image_dir=Path(train_data_dir),
        tokenizer=tokenizer,
        vae=vae,
    )
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    # 优化器
    optimizer = torch.optim.AdamW(
        unet.parameters(),
        lr=learning_rate,
        weight_decay=0.01,
        betas=(0.9, 0.999),
    )

    # 训练循环
    print(f"开始训练: {num_epochs} epochs, {len(dataset)} samples")
    global_step = 0

    for epoch in range(num_epochs):
        unet.train()
        epoch_loss = 0.0

        pbar = tqdm(dataloader, desc=f"Epoch {epoch+1}/{num_epochs}")
        for batch in pbar:
            # 将图片编码为 latent
            with torch.no_grad():
                latents = vae.encode(
                    batch["pixel_values"].to(device, dtype=torch.float16)
                ).latent_dist.sample() * 0.13025

            # 随机采样噪声和时间步
            noise = torch.randn_like(latents)
            timesteps = torch.randint(
                0, noise_scheduler.config.num_train_timesteps,
                (latents.shape[0],), device=device
            )

            # 加噪
            noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)

            # 获取文本嵌入
            with torch.no_grad():
                encoder_output = text_encoder(
                    batch["input_ids"].to(device)
                )
                text_embeddings = encoder_output[0]

            # 预测噪声
            noise_pred = unet(
                noisy_latents,
                timesteps,
                encoder_hidden_states=text_embeddings,
            ).sample

            # 计算损失
            loss = torch.nn.functional.mse_loss(
                noise_pred.float(), noise.float()
            )

            # 反向传播
            loss.backward()
            torch.nn.utils.clip_grad_norm_(unet.parameters(), 1.0)
            optimizer.step()
            optimizer.zero_grad()

            epoch_loss += loss.item()
            global_step += 1
            pbar.set_postfix(loss=f"{loss.item():.4f}")

        avg_loss = epoch_loss / len(dataloader)
        print(f"Epoch {epoch+1} 平均 loss: {avg_loss:.4f}")

        # 每 2 个 epoch 保存
        if (epoch + 1) % 2 == 0:
            save_path = output_path / f"brand_style_epoch{epoch+1}.safetensors"
            unet.save_pretrained(save_path)
            print(f"Checkpoint 保存: {save_path}")

    # 保存最终模型
    final_path = output_path / "brand_style_final.safetensors"
    unet.save_pretrained(final_path)
    print(f"训练完成! 最终模型: {final_path}")

if __name__ == "__main__":
    train_lora_sdxl(
        model_path="stabilityai/stable-diffusion-xl-base-1.0",
        train_data_dir="./train_data/img/10_morandi_brand_style",
        output_dir="./output",
        rank=32,
        alpha=16,
        learning_rate=1e-4,
        num_epochs=10,
        batch_size=2,
    )
```

## 常见误区

### 误区一：Rank 越大效果越好

Rank 决定了 LoRA 的参数量和表达能力，但更大的 rank 不等于更好的效果。rank=256 的 LoRA 有 392K 参数/层，对于简单的风格学习来说参数量过大，容易过拟合——模型会把训练集的每张图片的细节都记住，但丧失了泛化能力。经验上，风格学习用 16-32，角色学习用 32-64，复杂的多概念学习才需要 128+。

### 误区二：Learning Rate 和 Batch Size 无关

这两个参数是耦合的。如果你把 batch_size 从 2 改为 4，有效学习率翻倍了——因为每个 step 看到了双倍的数据，梯度更"准确"。一个常用的规则是：batch_size 翻倍时，learning_rate 也应该翻倍（线性缩放规则）。但 SDXL 训练中，这个规则的适用范围有限，不建议 batch_size 超过 4。

### 误区三：训练越多 epoch 越好

过拟合是 LoRA 训练最常见的问题。当 epoch 超过一定数量后，loss 可能还在下降（因为模型在记忆训练集），但生成质量已经开始退化——表现为生成图片和训练集高度相似，或者在使用不同 prompt 时风格不稳定。通常 5-10 个 epoch 是安全区间，具体取决于数据量和 rank。

### 误区四：不需要正则化图片

正则化图片（regularization images）不是可选的。没有正则化图片时，模型会把触发词和训练集的具体内容绑定（比如你的 20 张图都是女性肖像，模型就认为触发词="女性"）。加入正则化图片后，模型被迫在"通用图片分布"和"你的风格特征"之间找到平衡，从而学到纯粹的风格而非内容。

## 小结

本课完成了从 LoRA 数学到实战训练的完整旅程：

- **数学原理**：LoRA 通过低秩分解 W = W₀ + BA，将可训练参数量减少到原始的 0.1-1%
- **参数选择**：rank=16-32 适合风格学习，learning_rate=1e-4（SDXL）/5e-5（FLUX），alpha=rank/2
- **训练流程**：kohya-ss sd-scripts 提供了完整的训练工具链，配合 dataset.toml 精确控制数据行为
- **架构差异**：SDXL 是当前主力，FLUX 是未来方向，SD1.5 适合快速原型
- **监控策略**：每 2 epoch 保存 checkpoint，通过 loss 曲线和样张评估选择最佳模型

## 练习

### 练习一：参数计算

假设你有一个 SDXL UNet 层的权重矩阵 W ∈ R^(1280×1280)，计算以下配置的 LoRA 可训练参数量：
1. rank=16, alpha=16
2. rank=32, alpha=16
3. rank=64, alpha=32

比较三种配置的参数量和 scaling factor。

### 练习二：训练配置设计

你要训练一个 FLUX.1 LoRA 来学习一个插画师的风格（30 张图片，偏日系水彩风格）。设计完整的训练配置，包括：rank、alpha、learning_rate、batch_size、num_epochs，并解释每个选择的理由。

### 练习三：过拟合诊断

以下是一组训练 loss 数据，请判断训练状态并给出建议：

```
Epoch 1:  loss=0.1200
Epoch 2:  loss=0.0890
Epoch 3:  loss=0.0650
Epoch 4:  loss=0.0480
Epoch 5:  loss=0.0350
Epoch 6:  loss=0.0280
Epoch 7:  loss=0.0230
Epoch 8:  loss=0.0195
Epoch 9:  loss=0.0170
Epoch 10: loss=0.0155
```

---

## 参考答案

### 练习一

**思路**：LoRA 每层的可训练参数 = A 矩阵参数 + B 矩阵参数 = rank×k + d×rank。Scaling factor = alpha / rank。

**答案**：

```python
def compute_lora_params(d: int, k: int, rank: int, alpha: float):
    """计算 LoRA 可训练参数量"""
    params_a = rank * k       # A 矩阵: rank × k
    params_b = d * rank       # B 矩阵: d × rank
    total = params_a + params_b
    scaling = alpha / rank
    original = d * k
    ratio = total / original * 100

    return {
        "rank": rank,
        "alpha": alpha,
        "scaling": scaling,
        "params_a": params_a,
        "params_b": params_b,
        "total_params": total,
        "original_params": original,
        "ratio_percent": ratio,
    }

d, k = 1280, 1280
configs = [
    {"rank": 16, "alpha": 16},
    {"rank": 32, "alpha": 16},
    {"rank": 64, "alpha": 32},
]

for cfg in configs:
    result = compute_lora_params(d, k, cfg["rank"], cfg["alpha"])
    print(f"rank={result['rank']:3d}, alpha={result['alpha']:4.0f} | "
          f"参数量: {result['total_params']:>8,} | "
          f"占比: {result['ratio_percent']:5.1f}% | "
          f"scaling: {result['scaling']:.2f}")
```

输出：

```
rank= 16, alpha=  16 | 参数量:   40,960 | 占比:   2.5% | scaling: 1.00
rank= 32, alpha=  16 | 参数量:   81,920 | 占比:   5.0% | scaling: 0.50
rank= 64, alpha=  32 | 参数量:  163,840 | 占比:  10.0% | scaling: 0.50
```

**要点**：
- rank 翻倍时，参数量也翻倍（线性关系）
- rank=32, alpha=16 和 rank=64, alpha=32 的 scaling factor 相同（都是 0.5），但后者参数量是前者的两倍
- 选择配置时，先确定需要的表达能力（rank），再根据训练稳定性调整 alpha

### 练习二

**思路**：日系水彩风格的特点是色彩柔和、笔触细腻、边界模糊，这些特征相对单一，不需要很高的 rank。FLUX 的参数量大，学习率应偏低。

**答案**：

```python
flux_config = {
    "model": "black-forest-labs/FLUX.1-dev",
    "rank": 16,           # 水彩风格特征相对单一, rank=16 足够
    "alpha": 8,           # alpha = rank/2, 提供适度缩放
    "learning_rate": 5e-5, # FLUX 参数量大(12B), 学习率偏低
    "unet_lr": 5e-5,      # UNet 学习率与总学习率一致
    "text_encoder_lr": 0,  # 不训练 text encoder (T5-XXL 太大)
    "batch_size": 1,       # FLUX 显存占用大, batch_size=1
    "num_epochs": 6,       # 30 张图, 6 epoch 约 180 步, 安全区间
    "scheduler": "cosine_with_restarts",
    "warmup_steps": 20,
}
```

理由逐条解释：
1. **rank=16**：日系水彩的核心特征是色彩和笔触，不需要很高的复杂度。如果学习多风格（写实+水彩+赛博朋克），才需要提高到 32-64
2. **alpha=8**：alpha/rank = 0.5，防止 LoRA 分支输出过大，保持训练稳定
3. **lr=5e-5**：FLUX 的预训练更充分（12B 参数在更大规模数据上训练），需要更小的步长来避免破坏已有知识
4. **不训练 text encoder**：FLUX 的 T5-XXL text encoder 有 4.7B 参数，训练它会增加约 8GB 显存需求，且对风格学习帮助有限
5. **batch_size=1**：FLUX 的单张图显存占用约 16-20GB（含梯度），batch_size=1 在 24GB 显卡上是安全的
6. **num_epochs=6**：30 张图 × 6 epoch = 180 步。经验上，200 步以内是风格学习的安全区间

**要点**：
- FLUX 和 SDXL 的参数选择逻辑不同，不能直接套用 SDXL 的配置
- 数据量少时（30 张），epoch 数不宜过多，否则容易过拟合
- 训练后用 5-10 个不同 prompt 测试，确认风格一致性

### 练习三

**思路**：分析 loss 下降速度、是否仍在下降、是否有过拟合迹象。

**答案**：

```
诊断分析：

1. Loss 下降趋势:
   Epoch 1→5:  0.1200 → 0.0350, 下降 70.8%  (快速下降, 正常)
   Epoch 5→10: 0.0350 → 0.0155, 下降 55.7%  (仍在下降但速度放缓)

2. Loss 下降速度变化:
   早期平均下降率: ~17%/epoch
   后期平均下降率: ~11%/epoch
   → 速度放缓但仍为正, 模型仍在学习

3. 过拟合风险评估:
   最终 loss 0.0155 — 对于 1024×1024 的 SDXL 训练来说, 这个值偏低
   Loss 没有出现"先降后升"的典型过拟合曲线
   → 没有明显过拟合, 但已接近过拟合边缘

建议:
- 最佳 checkpoint: Epoch 6-7 的 checkpoint
  (loss 已经较低, 但还没有过度拟合训练集)
- 如果选择 Epoch 10, 需要用非训练集的 prompt 仔细验证泛化能力
- 下次训练可以考虑:
  1. 减少到 8 个 epoch
  2. 或者增加正则化图片的比例
  3. 或者降低 learning_rate 到 8e-5
```

**要点**：
- Loss 下降不是唯一指标——需要结合生成样张的质量来判断
- "loss 低但生成质量差"是过拟合的典型表现
- 选择 checkpoint 时倾向于"loss 已收敛但未过度拟合"的点
- 实际项目中，建议每个 epoch 都用固定 prompt 生成样张，建立视觉评估基准
