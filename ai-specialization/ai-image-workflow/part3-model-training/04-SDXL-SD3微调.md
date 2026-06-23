# 第 4 课：SDXL/SD3 微调 — 从 SD1.5 迁移到新一代架构

## 场景引入

你的团队已经用 SD 1.5 成功训练了十几个 LoRA，积累了丰富的经验。现在公司决定升级到 SDXL，因为 1024×1024 的生成质量对品牌营销素材至关重要。你满怀信心地把之前 SD 1.5 的训练参数复制过来，改了一下模型路径，点击开始训练。

结果：显存直接爆了。好不容易调低 batch size 跑起来，loss 曲线又完全不收敛。你开始怀疑人生——之前的经验怎么全不管用了？

这不是你一个人的困境。SDXL 和 SD3 的架构变化远不止"模型变大了"这么简单。双文本编码器、refiner model、offset noise、DiT 架构、三重编码器——每一个变化都意味着训练策略需要相应调整。本课将带你逐一理解这些架构差异，掌握新一代模型的微调要领。

## 学习目标

完成本课后，你将能够：
1. 理解 SDXL 相对于 SD 1.5 的架构变化及其对训练的影响
2. 配置 SDXL LoRA 训练的完整参数
3. 理解 SD3/3.5 的 DiT 架构和 MMDiT 注意力机制
4. 掌握 FLUX.1 的 LoRA 训练方法
5. 运用显存优化技术在消费级显卡上训练大模型

## 一、SDXL 架构变化：不只是"更大的 SD 1.5"

### 1.1 SDXL vs SD 1.5 架构对比

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SD 1.5 架构                                      │
│                                                                     │
│  Prompt ──→ [CLIP ViT-L/14] ──→ text_emb [77, 768]                │
│                                        │                            │
│  Noise ──→ [U-Net 860M] ←────────────┘                            │
│                │                                                    │
│                ▼                                                    │
│         [VAE Decoder] ──→ 512×512 图像                             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    SDXL 架构                                        │
│                                                                     │
│  Prompt ──→ [CLIP ViT-L/14] ──→ text_emb_1 [77, 768]             │
│         └─→ [OpenCLIP ViT-bigG] → text_emb_2 [77, 1280]           │
│                                        │                            │
│  原始分辨率 ──→ [Micro-conditioning] ──→ │                          │
│  裁剪参数   ──→                        │                            │
│                                        ▼                            │
│  Noise ──→ [U-Net 2.6B] ←────────────┘                            │
│                │                                                    │
│                ▼                                                    │
│         [Base 生成 1024×1024]                                       │
│                │                                                    │
│                ▼                                                    │
│         [Refiner U-Net] ──→ 细节增强                                │
│                │                                                    │
│                ▼                                                    │
│         [VAE Decoder] ──→ 1024×1024 图像                           │
└─────────────────────────────────────────────────────────────────────┘
```

SDXL 的变化不是简单的参数量增加，而是在多个维度上的系统性升级。理解这些变化对训练的影响，是成功微调的前提。

### 1.2 双文本编码器：语义理解的双重保险

SD 1.5 只用一个 CLIP 文本编码器，SDXL 同时使用两个：

- **CLIP ViT-L/14**：768 维，擅长理解具体物体和动作
- **OpenCLIP ViT-bigG/14**：1280 维，擅长理解抽象风格和氛围

两个编码器的输出被拼接（concatenate）后送入 U-Net。这意味着 SDXL 对 Prompt 的理解更全面——它既能理解"a red car on a street"这样的具体描述，也能理解"cinematic lighting, moody atmosphere"这样的风格描述。

对训练的影响：你的 caption 质量更重要了。SDXL 能捕捉到 caption 中更细微的语义差异，好的标注能让模型学到更精确的特征对应关系。

### 1.3 Micro-conditioning：SDXL 的隐藏条件

SDXL 引入了一个 SD 1.5 没有的机制：**微条件注入（micro-conditioning）**。它把原始图像尺寸和裁剪参数作为额外条件注入 U-Net：

```python
class MicroConditioning:
    """SDXL 的微条件注入

    将原始图像尺寸和裁剪坐标编码为向量，
    与时间步嵌合并注入 U-Net。
    这让模型知道当前生成的图像"本来应该是什么尺寸"，
    从而更好地处理不同宽高比。
    """

    @staticmethod
    def encode(original_size: tuple[int, int],
               crop_coords: tuple[int, int],
               target_size: tuple[int, int]) -> dict:
        """编码微条件参数

        Args:
            original_size: 原始图像尺寸 (w, h)，如 (1024, 1024)
            crop_coords: 裁剪坐标 (top, left)，如 (0, 0)
            target_size: 目标生成尺寸 (w, h)
        Returns:
            包含 original_size、crop_coords、target_size 的字典
        """
        return {
            "original_size": original_size,
            "crop_coords_top_left": crop_coords,
            "target_size": target_size,
        }

# 训练时，这些条件应该反映真实的图片属性
# 如果你的图片都是 1024x1024 无裁剪，那么：
micro_cond = MicroConditioning.encode(
    original_size=(1024, 1024),
    crop_coords=(0, 0),
    target_size=(1024, 1024),
)
```

这个机制在训练时很容易被忽略，但它的影响不小。如果你的训练图片有不同的原始尺寸和裁剪方式，正确设置这些参数能帮助模型更好地学习多分辨率生成。

### 1.4 Offset Noise：被低估的训练技巧

SDXL 训练中默认启用了 **offset noise**，这是一个看似微小但影响显著的技术：

```
标准 Diffusion 训练：
  噪声 ε ~ N(0, 1)  （标准正态分布）
  每个像素独立加噪

Offset Noise 训练：
  噪声 ε ~ N(0, 1) + offset
  offset = 0.1 × N(0, 1)  （整张图共享的偏移量）
  效果：噪声在整张图上有统一的亮度偏移
```

为什么需要 offset noise？在标准训练中，模型很难学到"整张图偏暗"或"整张图偏亮"的全局特征。offset noise 让模型在训练中见到更多"全局亮度变化"的样本，从而在推理时能更好地控制整体色调。

对训练的影响：如果你用 SDXL 的训练脚本但关闭了 offset noise，模型在生成暗调或亮调图片时会表现不佳。大多数 SDXL 训练框架默认开启，但值得确认。

## 二、SDXL LoRA 训练实战

### 2.1 分辨率桶排序（Resolution Bucketing）

SDXL 支持多分辨率训练，但不是简单地把所有图片缩放到同一尺寸。它使用**分辨率桶排序**：按宽高比把图片分到不同的"桶"中，每个桶内的图片尺寸相同。

```python
import math

class ResolutionBucketManager:
    """SDXL 分辨率桶排序管理器

    SDXL 的 bucket 策略：按 64 像素为步长，
    在 512-1536 范围内生成所有可能的宽高比组合。
    每张图片被分配到最接近其原始宽高比的桶中。
    """

    def __init__(self, base_resolution=1024, step=64, min_res=512, max_res=1536):
        self.base_resolution = base_resolution
        self.step = step
        self.min_res = min_res
        self.max_res = max_res
        self.buckets = self._generate_buckets()

    def _generate_buckets(self) -> list[tuple[int, int]]:
        """生成所有有效的分辨率桶"""
        buckets = []
        base_pixels = self.base_resolution ** 2  # 1024*1024 = 1,048,576

        for h in range(self.min_res, self.max_res + 1, self.step):
            # 根据目标像素数计算对应的宽度
            w = round(math.sqrt(base_pixels * (h / self.base_resolution)))
            # 对齐到 step 的倍数
            w = max(self.min_res, min(self.max_res, round(w / self.step) * self.step))
            if (w, h) not in buckets:
                buckets.append((w, h))

        return buckets

    def find_best_bucket(self, width: int, height: int) -> tuple[int, int]:
        """为给定图片找到最佳匹配的桶"""
        aspect_ratio = width / height
        best_bucket = None
        best_diff = float("inf")

        for bw, bh in self.buckets:
            bucket_ar = bw / bh
            diff = abs(math.log(aspect_ratio) - math.log(bucket_ar))
            if diff < best_diff:
                best_diff = diff
                best_bucket = (bw, bh)

        return best_bucket

    def describe(self):
        """打印所有桶信息"""
        print(f"分辨率桶排序配置:")
        print(f"  基础分辨率: {self.base_resolution}")
        print(f"  步长: {self.step}")
        print(f"  范围: {self.min_res} - {self.max_res}")
        print(f"  桶数量: {len(self.buckets)}")
        print()
        for i, (w, h) in enumerate(self.buckets):
            ar = w / h
            print(f"  桶 {i:2d}: {w:4d}×{h:4d}  (宽高比 {ar:.3f})")

# 使用示例
bucket_mgr = ResolutionBucketManager()
bucket_mgr.describe()

# 查找最佳桶
print("\n查找示例:")
test_cases = [(1920, 1080), (1080, 1920), (1024, 1024), (768, 512)]
for w, h in test_cases:
    best = bucket_mgr.find_best_bucket(w, h)
    print(f"  {w}×{h} → 桶 {best[0]}×{best[1]}")
```

桶排序的好处是：不同宽高比的图片都能以接近原始比例的方式训练，不需要暴力裁剪或拉伸。但代价是 batch 内的图片尺寸可能不一致，需要 padding，这会浪费一些计算。

### 2.2 SDXL LoRA 完整训练配置

以下是基于 kohya-ss sd-scripts 的 SDXL LoRA 训练配置：

```python
"""
sdxl_lora_train_config.py
SDXL LoRA 训练配置生成器

生成 kohya-ss 兼容的 TOML 配置文件，
包含所有 SDXL 特有的训练参数。
"""

from pathlib import Path
from dataclasses import dataclass, field

@dataclass
class SDXLTrainingConfig:
    """SDXL LoRA 训练配置"""

    # ── 基础设置 ──
    pretrained_model: str = "stabilityai/stable-diffusion-xl-base-1.0"
    output_dir: str = "./output/sdxl_lora"
    output_name: str = "brand_style_lora"
    save_every_n_epochs: int = 2

    # ── LoRA 参数 ──
    network_module: str = "networks.lora"
    lora_rank: int = 32                    # LoRA 秩，16-64 常见
    lora_alpha: int = 32                   # 缩放因子，通常等于 rank
    lora_dropout: float = 0.05             # Dropout 防过拟合

    # ── 训练超参 ──
    learning_rate: float = 1e-4            # SDXL 推荐 1e-4（比 SD1.5 低）
    unet_lr: float = 1e-4                  # U-Net 学习率
    text_encoder_lr: float = 5e-5          # 文本编码器学习率（比 U-Net 低一半）
    lr_scheduler: str = "cosine_with_restarts"
    lr_warmup_steps: int = 100
    max_train_epochs: int = 10
    train_batch_size: int = 1              # SDXL 显存大，batch size 通常较小

    # ── 优化器 ──
    optimizer_type: str = "AdamW8bit"      # 8bit Adam 节省显存
    adam_beta1: float = 0.9
    adam_beta2: float = 0.999
    adam_weight_decay: float = 0.01
    max_grad_norm: float = 1.0             # 梯度裁剪

    # ── SDXL 特有 ──
    resolution: int = 1024                 # SDXL 基础分辨率
    enable_bucket: bool = True             # 启用分辨率桶排序
    bucket_reso_steps: int = 64
    min_bucket_reso: int = 512
    max_bucket_reso: int = 1536
    offset_noise: bool = True              # SDXL 默认开启
    offset_noise_val: float = 0.1          # offset noise 强度

    # ── 显存优化 ──
    mixed_precision: str = "bf16"          # bf16 比 fp16 数值更稳定
    gradient_checkpointing: bool = True    # 必须开启，否则显存不够
    cache_latents: bool = True             # 预计算并缓存 VAE latent
    cache_latents_to_disk: bool = True     # 大数据集时缓存到磁盘

    # ── 正则化 ──
    prior_loss_weight: float = 1.0         # 正则化图片的 loss 权重
    network_alpha: float = 16              # LoRA alpha（影响缩放）

    # ── 数据集 ──
    dataset_config: str = "./dataset.toml"
    caption_dropout_rate: float = 0.05     # 随机丢弃 caption 的概率
    caption_tag_dropout_rate: float = 0.05 # 随机丢弃标签的概率

    def generate_toml(self) -> str:
        """生成 kohya-ss 兼容的 TOML 配置"""
        config = f"""# SDXL LoRA 训练配置
# 自动生成 — 基于 SDXLTrainingConfig

# 基础模型
pretrained_model_name_or_path = "{self.pretrained_model}"

# 输出
output_dir = "{self.output_dir}"
output_name = "{self.output_name}"
save_every_n_epochs = {self.save_every_n_epochs}
save_model_as = "safetensors"

# LoRA 配置
network_module = "{self.network_module}"
network_dim = {self.lora_rank}
network_alpha = {self.network_alpha}
network_args = ["loraplus_lr_ratio=16"]

# 训练参数
learning_rate = {self.learning_rate}
unet_lr = {self.unet_lr}
text_encoder_lr = {self.text_encoder_lr}
lr_scheduler = "{self.lr_scheduler}"
lr_scheduler_num_cycles = 1
lr_warmup_steps = {self.lr_warmup_steps}

# 优化器
optimizer_type = "{self.optimizer_type}"
optimizer_args = ["beta1={self.adam_beta1}", "beta2={self.adam_beta2}", "weight_decay={self.adam_weight_decay}"]
max_grad_norm = {self.max_grad_norm}

# 训练设置
max_train_epochs = {self.max_train_epochs}
train_batch_size = {self.train_batch_size}
seed = 42
clip_skip = 2

# 分辨率与桶排序
resolution = {self.resolution}
enable_bucket = true
bucket_reso_steps = {self.bucket_reso_steps}
min_bucket_reso = {self.min_bucket_reso}
max_bucket_reso = {self.max_bucket_reso}
bucket_no_upscale = false

# SDXL 微条件
# offset noise 通过 noise_offset 参数控制
noise_offset = {0.1 if self.offset_noise else 0.0}

# 显存优化
mixed_precision = "{self.mixed_precision}"
full_bf16 = {"true" if self.mixed_precision == "bf16" else "false"}
gradient_checkpointing = {"true" if self.gradient_checkpointing else "false"}
cache_latents = {"true" if self.cache_latents else "false"}
cache_latents_to_disk = {"true" if self.cache_latents_to_disk else "false"}

# 数据增强
caption_dropout_rate = {self.caption_dropout_rate}
caption_tag_dropout_rate = {self.caption_tag_dropout_rate}

# 正则化
prior_loss_weight = {self.prior_loss_weight}

# 日志
logging_dir = "{self.output_dir}/logs"
log_prefix = "sdxl_lora"
"""
        return config

    def save(self, path: str):
        """保存配置到文件"""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(self.generate_toml(), encoding="utf-8")
        print(f"配置已保存到: {path}")


# 使用示例
config = SDXLTrainingConfig(
    lora_rank=32,
    learning_rate=1e-4,
    max_train_epochs=10,
    mixed_precision="bf16",
)
config.save("./sdxl_lora_config.toml")
print("\n生成的配置：")
print(config.generate_toml())
```

注意几个关键参数的选择：

- **`learning_rate = 1e-4`**：SDXL 的 U-Net 更大，学习率要比 SD 1.5 低（SD 1.5 常用 5e-4 到 1e-3）
- **`text_encoder_lr = 5e-5`**：文本编码器的学习率应该更低，防止破坏预训练的语义理解
- **`mixed_precision = "bf16"`**：bf16 的动态范围比 fp16 大，在 SDXL 的大模型上数值更稳定
- **`gradient_checkpointing = true`**：SDXL 的 U-Net 有 2.6B 参数，不开这个 24GB 显存都不够

## 三、SD3/3.5：DiT 架构的范式转变

### 3.1 从 U-Net 到 DiT

SD3 做了一个大胆的决定：**彻底抛弃 U-Net，改用 Diffusion Transformer（DiT）**。这不是简单的"把 CNN 换成 Transformer"，而是架构哲学的根本转变。

```
┌──────────────────────────────────────────────────────────────┐
│                SD3 DiT 架构 (MMDiT)                          │
│                                                              │
│  ┌──────────┐   ┌──────────────┐                            │
│  │ CLIP×2   │──→│ Text Emb     │──→ [77, 2048]              │
│  │ T5-XXL   │──→│ (三重拼接)    │──→ [任意长, 4096]          │
│  └──────────┘   └──────┬───────┘                            │
│                        │                                     │
│  ┌─────────────────────▼───────────────────────────────┐    │
│  │              MMDiT Block × N                         │    │
│  │                                                      │    │
│  │  图像 Patch ──→ [Patch Embed] ──→ img_tokens         │    │
│  │                                      │               │    │
│  │  img_tokens ──┐                      │               │    │
│  │               ├→ [Joint Self-Attn] ──┤               │    │
│  │  txt_tokens ──┘                      │               │    │
│  │                                      ▼               │    │
│  │  img_tokens ──→ [AdaLN] ──→ [FFN] ──→ img_out       │    │
│  │  txt_tokens ──→ [AdaLN] ──→ [FFN] ──→ txt_out       │    │
│  └──────────────────────────────────────────────────────┘    │
│                        │                                     │
│                        ▼                                     │
│              [Final Layer] ──→ 预测噪声                      │
│                                                              │
│  关键区别：                                                   │
│  - U-Net 的 skip connection 消失了                           │
│  - 文本和图像在同一个 Attention 层中联合处理                    │
│  - 使用 AdaLN (Adaptive Layer Norm) 替代 Cross-Attention     │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 三重文本编码器的代价

SD3 使用三个文本编码器：

| 编码器 | 维度 | Token 数 | 显存占用 | 作用 |
|--------|------|----------|----------|------|
| CLIP ViT-L/14 | 768 | 77 | ~0.5GB | 物体识别 |
| OpenCLIP ViT-bigG | 1280 | 77 | ~1.2GB | 风格理解 |
| T5-XXL | 4096 | 无限 | ~10GB | 长文本理解 |

三重编码器的优势是理解能力极强，但代价是**巨大的显存占用**。仅加载三个文本编码器就需要约 12GB 显存，加上 DiT 本身，全量训练需要 40GB+ 的显存。

这就是为什么 SD3 的 LoRA 训练通常**只训练 DiT 部分，冻结文本编码器**——文本编码器的参数量太大，微调的性价比很低。

### 3.3 SD3 LoRA 训练的特殊之处

```python
"""
sd3_lora_train_config.py
SD3 LoRA 训练配置

SD3 训练与 SDXL 的关键差异：
1. Attention 层结构不同（Joint Self-Attention vs Cross-Attention）
2. 显存需求更高（三重编码器 + DiT）
3. 学习率策略需要调整（DiT 对学习率更敏感）
"""

from dataclasses import dataclass

@dataclass
class SD3TrainingConfig:
    """SD3 LoRA 训练配置"""

    # ── 基础设置 ──
    pretrained_model: str = "stabilityai/stable-diffusion-3-medium"
    output_dir: str = "./output/sd3_lora"
    output_name: str = "sd3_brand_lora"

    # ── LoRA 参数 ──
    # SD3 的 DiT 结构与 U-Net 不同，attention 层在 Joint Self-Attention 中
    network_dim: int = 16                  # SD3 推荐更小的 rank（16-32）
    network_alpha: int = 16                # alpha 通常等于 rank
    # SD3 LoRA 的目标模块
    # DiT 的 attention 层名称与 U-Net 不同
    lora_target_modules: str = "to_q,to_k,to_v,to_out.0"

    # ── 训练超参 ──
    learning_rate: float = 5e-5            # SD3 推荐更低的学习率
    lr_scheduler: str = "cosine_with_restarts"
    lr_warmup_steps: int = 50
    max_train_epochs: int = 10
    train_batch_size: int = 1              # SD3 显存需求更大

    # ── 优化器 ──
    optimizer_type: str = "Prodigy"        # Prodigy 对 SD3 效果更好
    # Prodigy 是自适应学习率优化器，能自动调整 lr
    # 对 SD3 这种对 lr 敏感的模型特别有用
    prodigy_decouple: bool = True
    prodigy_use_bias_correction: bool = True
    prodigy_safeguard_warmup: bool = True

    # ── 显存优化（SD3 必须）──
    mixed_precision: str = "bf16"
    gradient_checkpointing: bool = True    # 必须
    cache_latents: bool = True
    sdpa: bool = True                      # 使用 SDPA 注意力，比默认实现省显存

    # ── 分辨率 ──
    resolution: int = 1024
    enable_bucket: bool = True
    bucket_reso_steps: int = 64
    min_bucket_reso: int = 512
    max_bucket_reso: int = 1536

    # ── 特殊设置 ──
    # SD3 使用 Flow Matching 而非传统 DDPM 的 noise schedule
    # 这意味着 loss 的含义与 SD 1.5/SDXL 不同
    weighting_scheme: str = "sigma_sqrt"   # Flow Matching 的加权策略
    logit_mean: float = 0.0                # logit-normal 分布的均值
    logit_std: float = 1.0                 # logit-normal 分布的标准差
    mode_scale: float = 1.29              # 模式缩放因子

    # ── 文本编码器 ──
    # 冻结所有文本编码器，只训练 DiT
    # 微调 T5-XXL 需要 40GB+ 显存，对消费级硬件不现实
    train_text_encoder: bool = False

    def generate_toml(self) -> str:
        config = f"""# SD3 LoRA 训练配置
pretrained_model_name_or_path = "{self.pretrained_model}"
output_dir = "{self.output_dir}"
output_name = "{self.output_name}"

# LoRA
network_module = "networks.lora"
network_dim = {self.network_dim}
network_alpha = {self.network_alpha}
network_args = ["loraplus_lr_ratio=16"]
# SD3 的 attention 模块名称
{f'lora_target_modules = "{self.lora_target_modules}"' if self.lora_target_modules else ''}

# 训练
learning_rate = {self.learning_rate}
lr_scheduler = "{self.lr_scheduler}"
lr_warmup_steps = {self.lr_warmup_steps}
max_train_epochs = {self.max_train_epochs}
train_batch_size = {self.train_batch_size}

# 优化器
optimizer_type = "{self.optimizer_type}"
optimizer_args = [
    "decouple={str(self.prodigy_decouple).lower()}",
    "use_bias_correction={str(self.prodigy_use_bias_correction).lower()}",
    "safeguard_warmup={str(self.prodigy_safeguard_warmup).lower()}"
]

# 显存优化
mixed_precision = "{self.mixed_precision}"
full_bf16 = {"true" if self.mixed_precision == "bf16" else "false"}
gradient_checkpointing = true
cache_latents = true
sdpa = {"true" if self.sdpa else "false"}

# 分辨率
resolution = {self.resolution}
enable_bucket = true
bucket_reso_steps = {self.bucket_reso_steps}
min_bucket_reso = {self.min_bucket_reso}
max_bucket_reso = {self.max_bucket_reso}

# Flow Matching 参数
weighting_scheme = "{self.weighting_scheme}"
logit_mean = {self.logit_mean}
logit_std = {self.logit_std}
mode_scale = {self.mode_scale}

# 文本编码器冻结
train_text_encoder = {"true" if self.train_text_encoder else "false"}

seed = 42
"""
        return config

    def save(self, path: str):
        from pathlib import Path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(self.generate_toml(), encoding="utf-8")
        print(f"配置已保存到: {path}")

# 使用示例
config = SD3TrainingConfig()
config.save("./sd3_lora_config.toml")
```

### 3.4 SD3 的 Flow Matching

SD3 使用 **Flow Matching** 替代传统的 DDPM noise schedule。这对训练的影响是：

```
传统 DDPM (SD 1.5/SDXL):
  x_t = √(α_t) × x_0 + √(1-α_t) × ε
  预测目标: 噪声 ε
  Loss: MSE(predicted_noise, actual_noise)

Flow Matching (SD3):
  x_t = (1-t) × x_0 + t × ε     （线性插值）
  预测目标: 速度场 v = ε - x_0
  Loss: MSE(predicted_velocity, actual_velocity)
```

Flow Matching 的好处是训练更稳定，收敛更快。但预测目标从"噪声"变成了"速度"，这意味着 SD3 的 loss 数值和 SDXL 不在同一尺度上，不能直接比较。

## 四、FLUX.1 微调

### 4.1 FLUX.1 架构简介

FLUX.1 由 Stability AI 的前核心团队创建，是目前（2025-2026 年）最强的开源图像生成模型之一：

```
FLUX.1 dev 架构:
  ┌──────────────────────────────────────────┐
  │  文本编码器: T5-XXL (主要) + CLIP ViT-L   │
  │  生成模型: DiT (类似 SD3，但更大)          │
  │  参数量: ~12B                             │
  │  分辨率: 1024×1024 (支持更大)             │
  │  许可证: FLUX.1 [dev] 非商业开源           │
  │           FLUX.1 [schnell] Apache 2.0     │
  └──────────────────────────────────────────┘
```

FLUX.1 的 LoRA 训练与 SD3 类似，但有几个关键差异：

1. **guidance 参数**：FLUX.1 使用 classifier-free guidance 内嵌到模型中，训练时需要设置 `guidance_scale`
2. **模型更大**：12B 参数，显存需求比 SD3 更高
3. **T5 编码器更重要**：FLUX.1 主要依赖 T5-XXL 理解文本

### 4.2 FLUX.1 LoRA 训练配置

```python
"""
flux_lora_train_config.py
FLUX.1 LoRA 训练配置

FLUX.1 训练的核心挑战是显存管理。
12B 参数 + T5-XXL = 至少 24GB 显存（使用各种优化后）。
"""

@dataclass
class FLUXTrainingConfig:
    """FLUX.1 LoRA 训练配置"""

    # ── 基础设置 ──
    pretrained_model: str = "black-forest-labs/FLUX.1-dev"
    output_dir: str = "./output/flux_lora"
    output_name: str = "flux_brand_lora"

    # ── LoRA 参数 ──
    network_dim: int = 16                  # FLUX.1 推荐 rank 16-32
    network_alpha: int = 8                 # alpha 通常设为 rank 的一半
    # FLUX.1 的 attention 层命名
    lora_target_modules: str = "to_q,to_k,to_v,to_out.0,add_q_proj,add_k_proj,add_v_proj,to_add_out"

    # ── 训练超参 ──
    learning_rate: float = 5e-5            # FLUX.1 对 lr 非常敏感
    lr_scheduler: str = "constant_with_warmup"  # cosine 可能导致不稳定
    lr_warmup_steps: int = 100
    max_train_epochs: int = 6
    train_batch_size: int = 1

    # ── 优化器 ──
    optimizer_type: str = "AdamW8bit"
    adam_weight_decay: float = 0.01

    # ── 显存优化（FLUX.1 必须全部开启）──
    mixed_precision: str = "bf16"
    gradient_checkpointing: bool = True
    cache_latents: bool = True
    # FLUX.1 特有：T5 编码器缓存
    cache_text_encoder_outputs: bool = True  # 预计算 T5 输出，节省推理时显存
    # CPU offload：把不活跃的模型组件放到 CPU
    offload_optimizer: bool = True           # 优化器状态 offload 到 CPU

    # ── 分辨率 ──
    resolution: int = 1024
    enable_bucket: bool = True

    # ── FLUX.1 特有参数 ──
    guidance_scale: float = 3.5            # FLUX.1 的 guidance 参数
    # FLUX.1 内嵌了 guidance，训练时需要与推理时一致

    # ── T5 编码器设置 ──
    t5xxl_max_token_length: int = 512      # T5 最大 token 长度
    # 不需要设太大，512 通常够用
    # 设太大会增加 T5 编码的显存和时间

    def generate_toml(self) -> str:
        config = f"""# FLUX.1 LoRA 训练配置
pretrained_model_name_or_path = "{self.pretrained_model}"
output_dir = "{self.output_dir}"
output_name = "{self.output_name}"

# LoRA
network_module = "networks.lora"
network_dim = {self.network_dim}
network_alpha = {self.network_alpha}
lora_target_modules = "{self.lora_target_modules}"

# 训练
learning_rate = {self.learning_rate}
lr_scheduler = "{self.lr_scheduler}"
lr_warmup_steps = {self.lr_warmup_steps}
max_train_epochs = {self.max_train_epochs}
train_batch_size = {self.train_batch_size}
optimizer_type = "{self.optimizer_type}"

# 显存优化
mixed_precision = "{self.mixed_precision}"
gradient_checkpointing = true
cache_latents = true
cache_text_encoder_outputs = {"true" if self.cache_text_encoder_outputs else "false"}

# 分辨率
resolution = {self.resolution}
enable_bucket = {"true" if self.enable_bucket else "false"}

# FLUX.1 特有
guidance_scale = {self.guidance_scale}
t5xxl_max_token_length = {self.t5xxl_max_token_length}

seed = 42
"""
        return config
```

## 五、显存优化技术

### 5.1 显存占用分析

```
模型          参数量    bf16 原始占用    优化后占用     推荐 GPU
─────────────────────────────────────────────────────────────
SD 1.5        860M     ~1.7GB         ~3GB (训练)    8GB+
SDXL          2.6B     ~5.2GB         ~8GB (训练)    12GB+
SD3           2B+编码器  ~14GB         ~12GB (训练)   16GB+
FLUX.1        12B+编码器 ~24GB         ~18GB (训练)   24GB+

优化手段：
  gradient_checkpointing:  -30~50% 显存，+20~30% 训练时间
  bf16 mixed precision:    -50% 显存
  AdamW8bit:               -50% 优化器显存
  cache_latents:           -15~20% 显存
  offload_optimizer:       -30~40% 显存，+10% 训练时间
```

### 5.2 显存优化实战脚本

```python
"""
memory_optimization.py
显存优化工具集

提供梯度检查点、混合精度、优化器选择等显存优化功能。
"""

import torch
import gc

class MemoryProfiler:
    """显存分析器"""

    @staticmethod
    def get_gpu_memory() -> dict:
        """获取当前 GPU 显存使用情况"""
        if not torch.cuda.is_available():
            return {"error": "CUDA 不可用"}

        return {
            "allocated_gb": round(torch.cuda.memory_allocated() / 1e9, 2),
            "reserved_gb": round(torch.cuda.memory_reserved() / 1e9, 2),
            "max_allocated_gb": round(torch.cuda.max_memory_allocated() / 1e9, 2),
            "total_gb": round(torch.cuda.get_device_properties(0).total_mem / 1e9, 2),
        }

    @staticmethod
    def print_memory_status(label: str = ""):
        """打印当前显存状态"""
        mem = MemoryProfiler.get_gpu_memory()
        if "error" in mem:
            print(f"[{label}] {mem['error']}")
            return

        usage_pct = (mem["allocated_gb"] / mem["total_gb"]) * 100
        print(f"[{label}] 显存: {mem['allocated_gb']:.1f}/{mem['total_gb']:.1f} GB "
              f"({usage_pct:.0f}%) | 峰值: {mem['max_allocated_gb']:.1f} GB")

    @staticmethod
    def clear_cache():
        """清理 GPU 缓存"""
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.reset_peak_memory_stats()
        print("显存缓存已清理")


class GradientCheckpointingManager:
    """梯度检查点管理器

    原理：前向传播时不保存中间激活值，
    反向传播时重新计算。用时间换空间。
    """

    @staticmethod
    def enable_for_unet(unet):
        """为 U-Net 启用梯度检查点"""
        if hasattr(unet, "enable_gradient_checkpointing"):
            unet.enable_gradient_checkpointing()
            print("✓ U-Net 梯度检查点已启用")
        else:
            # 手动为每个 block 启用
            for name, module in unet.named_modules():
                if hasattr(module, "gradient_checkpointing"):
                    module.gradient_checkpointing = True
            print("✓ U-Net 梯度检查点已手动启用")

    @staticmethod
    def enable_for_dit(dit_model):
        """为 DiT 启用梯度检查点"""
        if hasattr(dit_model, "enable_gradient_checkpointing"):
            dit_model.enable_gradient_checkpointing()
            print("✓ DiT 梯度检查点已启用")
        else:
            print("⚠ 模型不支持梯度检查点")


class OptimizerFactory:
    """优化器工厂

    根据显存预算选择最合适的优化器。
    """

    @staticmethod
    def create(optimizer_type: str, params, lr: float, **kwargs):
        """创建优化器

        Args:
            optimizer_type: 优化器类型
            params: 模型参数
            lr: 学习率
            **kwargs: 额外参数
        """
        if optimizer_type == "AdamW":
            return torch.optim.AdamW(
                params, lr=lr,
                betas=kwargs.get("betas", (0.9, 0.999)),
                weight_decay=kwargs.get("weight_decay", 0.01),
            )

        elif optimizer_type == "AdamW8bit":
            try:
                import bitsandbytes as bnb
                return bnb.optim.AdamW8bit(
                    params, lr=lr,
                    betas=kwargs.get("betas", (0.9, 0.999)),
                    weight_decay=kwargs.get("weight_decay", 0.01),
                )
            except ImportError:
                print("⚠ bitsandbytes 未安装，回退到 AdamW")
                return OptimizerFactory.create("AdamW", params, lr, **kwargs)

        elif optimizer_type == "Prodigy":
            try:
                import prodigyopt
                return prodigyopt.Prodigy(
                    params, lr=lr,
                    decouple=kwargs.get("decouple", True),
                    use_bias_correction=kwargs.get("use_bias_correction", True),
                    safeguard_warmup=kwargs.get("safeguard_warmup", True),
                )
            except ImportError:
                print("⚠ prodigyopt 未安装，回退到 AdamW8bit")
                return OptimizerFactory.create("AdamW8bit", params, lr, **kwargs)

        elif optimizer_type == "Lion":
            try:
                import lion_pytorch
                return lion_pytorch.Lion(
                    params, lr=lr,
                    weight_decay=kwargs.get("weight_decay", 0.01),
                )
            except ImportError:
                print("⚠ lion_pytorch 未安装，回退到 AdamW")
                return OptimizerFactory.create("AdamW", params, lr, **kwargs)

        else:
            raise ValueError(f"不支持的优化器类型: {optimizer_type}")


def compare_optimizers_memory():
    """对比不同优化器的显存占用"""
    print("优化器显存占用对比（SDXL U-Net 2.6B 参数，bf16）")
    print("=" * 60)

    # 理论计算
    param_gb = 2.6 * 2  # 2.6B params × 2 bytes (bf16)

    optimizers = {
        "AdamW": {
            "state": "2 × 参数量（m 和 v）",
            "state_gb": param_gb * 2,
            "precision": "fp32",
        },
        "AdamW8bit": {
            "state": "2 × 参数量（8bit 量化）",
            "state_gb": param_gb * 2 * 0.25,  # 8bit = 1 byte vs 4 bytes
            "precision": "8bit",
        },
        "Prodigy": {
            "state": "2 × 参数量 + 自适应状态",
            "state_gb": param_gb * 2 * 0.25 + 0.5,
            "precision": "8bit",
        },
    }

    for name, info in optimizers.items():
        total = param_gb + info["state_gb"]
        print(f"\n{name}:")
        print(f"  模型参数: {param_gb:.1f} GB")
        print(f"  优化器状态: {info['state_gb']:.1f} GB ({info['state']})")
        print(f"  总计: {total:.1f} GB")

compare_optimizers_memory()
```

## 六、常见误区

### 误区一：SD 1.5 的参数可以直接迁移到 SDXL

这是最常见的错误。SDXL 的 U-Net 是 SD 1.5 的 3 倍大，学习率需要相应降低。直接用 SD 1.5 的学习率（1e-3）训练 SDXL 会导致 loss 震荡甚至发散。经验法则是：SDXL 的学习率应该是 SD 1.5 的 1/5 到 1/10。

### 误区二：SD3 的显存需求和 SDXL 差不多

差很多。SD3 的三重文本编码器本身就需要约 12GB 显存，加上 DiT 模型，即使使用所有优化手段，至少需要 16GB 显存。如果你只有 12GB 的显卡，考虑只训练 SDXL 的 LoRA，或者使用 SD3 的量化版本。

### 误区三：Offset noise 不重要，可以关掉

Offset noise 对 SDXL 的训练质量有显著影响，特别是在生成全局色调一致的图片时。关闭 offset noise 后，模型在生成纯色背景、暗调场景时容易出现色块和噪点。这个参数几乎不增加训练成本，没有理由关掉。

### 误区四：SD3 的 rank 应该和 SDXL 一样大

SD3 的 DiT 结构与 U-Net 不同，它对 LoRA rank 的敏感度更高。rank 太大（如 128）在 SD3 上更容易过拟合，而且显存占用会飙升。SD3 推荐 rank 16-32，而 SDXL 可以用 32-64。

### 误区五：FLUX.1 训练和 SD3 几乎一样

虽然两者都基于 DiT，但 FLUX.1 的 guidance 内嵌机制、更大的模型尺寸、以及 T5 编码器的主导地位，使得训练策略有明显差异。特别是学习率——FLUX.1 比 SD3 更敏感，推荐从 1e-5 开始尝试。

## 小结

本课的核心要点：

- **SDXL 的关键变化**：双文本编码器、micro-conditioning、offset noise、分辨率桶排序。这些变化要求训练参数全面调整，不能直接复用 SD 1.5 的配置。
- **SD3 的范式转变**：DiT 替代 U-Net、MMDiT 联合注意力、三重文本编码器、Flow Matching。架构差异意味着训练策略的根本性改变。
- **FLUX.1 的特殊性**：guidance 内嵌、12B 参数、T5 主导。需要更保守的学习率和更精细的显存管理。
- **显存优化是必修课**：gradient checkpointing、bf16、AdamW8bit、cache_latents，这些技术组合使用才能在消费级显卡上训练大模型。

选择哪个模型取决于你的需求：SDXL 生态最成熟、资源最多；SD3 质量更高但训练门槛也更高；FLUX.1 质量最好但显存需求最大。

## 练习

### 练习一：SDXL 训练配置

为一个品牌风格 LoRA 配置 SDXL 训练任务。数据集有 30 张 1024×1024 的图片，你的显卡是 RTX 4070 Ti（12GB 显存）。生成完整的 TOML 配置文件，并说明每个关键参数的选择理由。

### 练习二：Optimizer 对比实验

使用同一数据集，分别用 AdamW8bit 和 Prodigy 训练 SDXL LoRA（其他参数相同），对比：
1. 训练速度（每步耗时）
2. 显存占用
3. Loss 曲线形状
4. 最终生成质量

### 练习三：显存优化挑战

在 8GB 显存的显卡（如 RTX 4060）上训练 SDXL LoRA。列出你会使用的所有优化技术，计算优化后的理论显存占用，判断是否可行。

---

## 参考答案

### 练习一

**思路**：12GB 显存训练 SDXL 需要全面的显存优化。关键是在不牺牲训练质量的前提下，把显存控制在 12GB 以内。

**答案**：

```toml
# SDXL LoRA 训练配置 — RTX 4070 Ti (12GB)
pretrained_model_name_or_path = "stabilityai/stable-diffusion-xl-base-1.0"
output_dir = "./output/brand_lora"
output_name = "brand_style_sdxl"
save_every_n_epochs = 2
save_model_as = "safetensors"

# LoRA — rank 32 是 12GB 显存的安全上限
network_module = "networks.lora"
network_dim = 32
network_alpha = 32

# 学习率 — SDXL 推荐值，比 SD 1.5 低一个数量级
learning_rate = 1e-4
unet_lr = 1e-4
text_encoder_lr = 5e-5          # 文本编码器更低，保护语义理解
lr_scheduler = "cosine_with_restarts"
lr_warmup_steps = 60            # 总步数少，warmup 也相应少
max_train_epochs = 10
train_batch_size = 1            # 12GB 只能 batch_size=1
gradient_accumulation_steps = 4 # 用梯度累积模拟 batch_size=4

# 优化器
optimizer_type = "AdamW8bit"    # 比标准 AdamW 节省约 4GB 显存

# 显存优化 — 全部开启
mixed_precision = "bf16"
gradient_checkpointing = true   # 节省约 30% 显存
cache_latents = true            # 预计算 latent，节省 VAE 推理显存
cache_latents_to_disk = true    # 30 张图的 latent 可以缓存到磁盘

# 分辨率
resolution = 1024
enable_bucket = true
bucket_reso_steps = 64
min_bucket_reso = 768           # 30 张图都是 1024 左右，缩小范围
max_bucket_reso = 1024

# SDXL 特有
noise_offset = 0.1              # offset noise，不要关

# 数据集
caption_dropout_rate = 0.05
prior_loss_weight = 1.0

seed = 42
```

**参数选择理由**：
- `network_dim = 32`：30 张图数据量不大，rank 32 足够，再大容易过拟合
- `text_encoder_lr = 5e-5`：文本编码器的预训练知识很重要，低学习率防止破坏
- `batch_size = 1 + gradient_accumulation = 4`：12GB 显存只能 batch_size=1，用梯度累积弥补
- `cache_latents_to_disk = true`：30 张图的 latent 很小，缓存到磁盘完全可行

**要点**：
- 12GB 显存训练 SDXL 是可行的，但需要所有优化手段配合
- gradient_checkpointing 是最关键的优化，能节省约 3GB 显存
- 学习率的选择比显存优化更重要——错的学习率会让训练完全失败

### 练习二

**思路**：AdamW8bit 是 AdamW 的 8bit 量化版本，节省显存但可能损失精度。Prodigy 是自适应学习率优化器，能自动调整 lr，对超参不敏感。

**答案**：

```python
"""
练习二：对比 AdamW8bit 和 Prodigy 优化器
"""
import torch
import time
from pathlib import Path

def train_lora_with_optimizer(
    optimizer_type: str,
    dataset_path: str,
    output_dir: str,
    num_epochs: int = 5,
):
    """用指定优化器训练 LoRA 并记录指标"""
    # 注意：这里用伪代码模拟实际训练过程
    # 实际使用时需要调用 kohya-ss 的训练脚本

    metrics = {
        "optimizer": optimizer_type,
        "loss_history": [],
        "memory_usage": [],
        "time_per_step": [],
    }

    # 模拟训练循环
    steps_per_epoch = 30  # 30 张图，batch_size=1
    total_steps = steps_per_epoch * num_epochs

    print(f"\n{'='*50}")
    print(f"优化器: {optimizer_type}")
    print(f"总步数: {total_steps}")
    print(f"{'='*50}")

    # 模拟 loss 曲线
    import random
    base_loss = 0.15
    for step in range(total_steps):
        # 模拟不同优化器的 loss 行为
        if optimizer_type == "AdamW8bit":
            # AdamW8bit: 需要仔细调 lr，loss 可能震荡
            loss = base_loss * (0.98 ** (step / 30)) + random.gauss(0, 0.005)
            mem_gb = 8.5 + random.uniform(-0.2, 0.2)
            step_time = 1.2 + random.uniform(-0.1, 0.1)
        elif optimizer_type == "Prodigy":
            # Prodigy: 自适应 lr，loss 更平滑
            loss = base_loss * (0.97 ** (step / 30)) + random.gauss(0, 0.002)
            mem_gb = 9.0 + random.uniform(-0.2, 0.2)  # Prodigy 状态稍大
            step_time = 1.3 + random.uniform(-0.1, 0.1)  # 计算开销稍高

        metrics["loss_history"].append(loss)
        metrics["memory_usage"].append(mem_gb)
        metrics["time_per_step"].append(step_time)

        if step % 30 == 0:
            print(f"  Step {step:3d}: loss={loss:.4f}, mem={mem_gb:.1f}GB, "
                  f"time={step_time:.2f}s/step")

    # 汇总
    avg_mem = sum(metrics["memory_usage"]) / len(metrics["memory_usage"])
    avg_time = sum(metrics["time_per_step"]) / len(metrics["time_per_step"])
    final_loss = sum(metrics["loss_history"][-10:]) / 10

    print(f"\n汇总:")
    print(f"  最终 loss (平均后10步): {final_loss:.4f}")
    print(f"  平均显存: {avg_mem:.1f} GB")
    print(f"  平均步时: {avg_time:.2f} s")
    print(f"  总训练时间: {avg_time * total_steps / 60:.1f} 分钟")

    return metrics

# 运行对比
adam_metrics = train_lora_with_optimizer("AdamW8bit", "./train_data", "./output_adam")
prodigy_metrics = train_lora_with_optimizer("Prodigy", "./train_data", "./output_prodigy")

# 对比表
print("\n" + "=" * 60)
print("对比结果")
print("=" * 60)
print(f"{'指标':<20} {'AdamW8bit':<15} {'Prodigy':<15}")
print("-" * 50)
print(f"{'最终 loss':<20} {adam_metrics['loss_history'][-1]:<15.4f} {prodigy_metrics['loss_history'][-1]:<15.4f}")
print(f"{'平均显存 (GB)':<20} {sum(adam_metrics['memory_usage'])/len(adam_metrics['memory_usage']):<15.1f} {sum(prodigy_metrics['memory_usage'])/len(prodigy_metrics['memory_usage']):<15.1f}")
```

**要点**：
- Prodigy 的自适应学习率让 loss 曲线更平滑，不需要精细调参
- AdamW8bit 显存略小（少 0.5GB），但需要手动调学习率
- 对于 SD3 和 FLUX.1，Prodigy 通常是更好的选择，因为这些模型对学习率非常敏感
- 对于 SDXL，AdamW8bit 足够，因为 SDXL 的训练相对稳定

### 练习三

**思路**：8GB 显存训练 SDXL 是一个极端场景，需要所有优化手段配合，甚至可能需要牺牲一些训练灵活性。

**答案**：

```
8GB 显存训练 SDXL LoRA 的优化方案：

显存预算分析：
  SDXL U-Net (bf16):     5.2 GB
  VAE + CLIP (bf16):     1.5 GB
  ────────────────────────────
  模型加载:               6.7 GB
  剩余:                   1.3 GB  ← 不够！

必须的优化：
1. gradient_checkpointing:   -2.0 GB → U-Net 前向不保存中间激活
2. cache_latents:            -0.5 GB → 不需要每次运行 VAE 编码
3. AdamW8bit:                -2.0 GB → 优化器状态用 8bit 量化
4. train_batch_size = 1:     最小 batch
5. 冻结文本编码器:            -1.0 GB → 不训练 CLIP，不保存梯度

优化后：
  U-Net (bf16):            5.2 GB
  gradient checkpointing:  前向时临时分配 ~1.5 GB（峰值）
  AdamW8bit 状态:          1.3 GB
  VAE latent 缓存:         0.2 GB
  ────────────────────────────
  峰值约:                  8.2 GB  ← 勉强可行

额外建议：
- resolution 降到 768（省约 30% 计算量）
- 使用 kohya-ss 的 --full_bf16 避免 fp32 混合
- 关闭所有日志和可视化
- 训练时关闭桌面应用，释放 GPU 显存

结论：8GB 显存可以训练 SDXL LoRA，但非常紧张。
建议升级到 12GB 或使用云 GPU。
```

**要点**：
- gradient_checkpointing 是最关键的优化，必须开启
- 冻结文本编码器能节省约 1GB 显存，但会降低训练质量
- 8GB 是 SDXL 训练的绝对下限，不推荐生产使用
- 如果只有 8GB，考虑训练 SD 1.5 的 LoRA，质量损失不大但训练轻松很多
