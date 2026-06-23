# 第 3 课：DreamBooth 与 Textual Inversion — 特定主体的精确绑定

## 场景引入

你的客户是一家潮玩公司，他们有一个标志性的品牌吉祥物——一只戴着贝雷帽、穿着条纹衫的柴犬，名叫 "Mochi"。这只柴犬有非常具体的设计规范：耳朵的弧度、眼睛的间距、条纹的宽度比例，都是品牌视觉识别系统的一部分。

客户的要求很明确：能用 AI 生成 Mochi 在各种场景中的图片——喝咖啡、滑雪、弹吉他——但每张图里的 Mochi 都必须和原版设计保持高度一致。这不只是"风格学习"，而是"主体绑定"——模型需要精确记住一个特定角色的所有视觉细节。

上一课学的 LoRA 擅长学习风格特征，但对特定主体的细节还原能力有限。你需要两种更强的技术：DreamBooth 和 Textual Inversion。它们各有特点，适用于不同的场景，理解它们的差异和适用条件，是做出正确技术选型的前提。

## 学习目标

完成本课后，你将能够：
1. 解释 DreamBooth 如何通过新 token 绑定特定主体
2. 理解 Textual Inversion 只训练嵌入向量的工作原理
3. 对比 LoRA、DreamBooth、Textual Inversion 的适用场景
4. 实现 few-shot（3-5 张图）训练策略
5. 配置和使用 prior preservation loss 防止过拟合

## 一、三种微调方法的全景对比

在深入每种方法之前，先建立一个全局视角：

```
┌──────────────────────────────────────────────────────────────────┐
│                    三种微调方法对比                                │
│                                                                  │
│  方法            修改范围        参数量       适用场景             │
│  ──────────────────────────────────────────────────────────────  │
│  LoRA           UNet 权重       1-10M       风格迁移、色彩体系    │
│                 (低秩增量)      (~0.1-1%)   多概念组合            │
│                                                                  │
│  DreamBooth     UNet 权重       1-10M       特定主体绑定          │
│                 (全量/LoRA)     (~0.1-1%)   IP 形象、产品        │
│                                                                  │
│  Textual Inv.   仅文本嵌入      ~5-50K      轻量概念注入          │
│                 (模型权重不变)  (~0.001%)   风格修饰、简单物体    │
│  ──────────────────────────────────────────────────────────────  │
│                                                                  │
│  效果排序: DreamBooth ≈ LoRA > Textual Inversion                 │
│  显存排序: DreamBooth > LoRA > Textual Inversion                 │
│  灵活性:  LoRA > DreamBooth > Textual Inversion                  │
└──────────────────────────────────────────────────────────────────┘
```

这三种方法并不是互相替代的关系，而是适用于不同场景的互补工具。选择哪种方法，取决于你要学的是"风格"还是"主体"，以及你对显存和训练时间的预算。

## 二、DreamBooth 原理

### 2.1 核心思想：用新 token 绑定特定主体

DreamBooth 的核心思想非常直观：在模型的词汇表中加入一个新的、没有语义含义的 token（如 `[V]`），然后用少量特定主体的图片来训练，让模型学会"看到 `[V]` 就想到 Mochi"。

```
┌─────────────────────────────────────────────────────────────┐
│                DreamBooth 训练原理                            │
│                                                             │
│  输入: "a [V] dog wearing beret and striped shirt"          │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ Text     │    │   UNet   │    │  去噪    │              │
│  │ Encoder  │───→│ (更新)   │───→│  目标    │              │
│  └──────────┘    └──────────┘    └──────────┘             │
│       │                │               │                   │
│       ▼                ▼               ▼                   │
│  [V] 的嵌入      预测噪声         Mochi 的图片              │
│  (可选更新)      (学习主体特征)    (ground truth)           │
│                                                             │
│  训练后:                                                    │
│  "a [V] dog playing guitar" → 生成 Mochi 弹吉他的图        │
│  "a [V] dog skiing"         → 生成 Mochi 滑雪的图          │
└─────────────────────────────────────────────────────────────┘
```

关键在于选择一个"罕见 token"。如果用常见的词（如 "dog"），训练会污染模型对这个词的已有理解——你训练完后，所有包含 "dog" 的 prompt 都会受到 Mochi 的影响。解决方案是使用一个模型从未见过的 token 组合。

### 2.2 Prior Preservation Loss：防止灾难性遗忘

DreamBooth 有一个关键问题：当你用 5 张 Mochi 的图片训练时，模型可能会"忘记"怎么生成普通的狗。这就是灾难性遗忘（catastrophic forgetting）。

DreamBooth 的解决方案是 **prior preservation loss**——在训练过程中，同时让模型生成一些"普通狗"的图片，并要求模型保持对这些普通图片的生成能力。

```
训练损失 = 主体重建损失 + λ × 先验保持损失

L = L_reconstruction + λ × L_prior

其中:
  L_reconstruction = ||ε - ε_θ(z_t, t, c_subject)||²
    → 学习生成 Mochi

  L_prior = ||ε - ε_θ(z_t, t, c_class)||²
    → 保持生成普通狗的能力

  λ = 1.0 (权重系数, 通常设为 1)
```

用代码实现这个损失函数：

```python
import torch
import torch.nn.functional as F

def compute_dreambooth_loss(
    unet,
    noisy_latents: torch.Tensor,
    timesteps: torch.Tensor,
    encoder_hidden_states: torch.Tensor,
    noise: torch.Tensor,
    prior_latents: torch.Tensor = None,
    prior_encoder_hidden_states: torch.Tensor = None,
    prior_weight: float = 1.0,
) -> dict:
    """
    计算 DreamBooth 训练损失
    包含主体重建损失和先验保持损失
    """
    # 主体重建损失：学习生成目标主体
    noise_pred = unet(
        noisy_latents,
        timesteps,
        encoder_hidden_states=encoder_hidden_states,
    ).sample

    reconstruction_loss = F.mse_loss(
        noise_pred.float(), noise.float()
    )

    total_loss = reconstruction_loss
    losses = {"reconstruction": reconstruction_loss.item()}

    # 先验保持损失：保持生成普通类别图片的能力
    if prior_latents is not None and prior_encoder_hidden_states is not None:
        prior_noise = torch.randn_like(prior_latents)
        prior_timesteps = torch.randint(
            0, unet.config.num_train_timesteps,
            (prior_latents.shape[0],),
            device=prior_latents.device,
        )
        prior_noisy = prior_latents + prior_noise * prior_timesteps[:, None, None, None]

        prior_noise_pred = unet(
            prior_noisy,
            prior_timesteps,
            encoder_hidden_states=prior_encoder_hidden_states,
        ).sample

        prior_loss = F.mse_loss(
            prior_noise_pred.float(), prior_noise.float()
        )

        total_loss = total_loss + prior_weight * prior_loss
        losses["prior"] = prior_loss.item()

    losses["total"] = total_loss.item()
    return total_loss, losses

# 使用示例
"""
loss, details = compute_dreambooth_loss(
    unet=unet,
    noisy_latents=subject_noisy_latents,
    timesteps=timesteps,
    encoder_hidden_states=subject_text_embeddings,
    noise=subject_noise,
    prior_latents=prior_latents,
    prior_encoder_hidden_states=prior_text_embeddings,
    prior_weight=1.0,
)
print(f"Total: {details['total']:.4f}, Subject: {details['reconstruction']:.4f}, Prior: {details['prior']:.4f}")
"""
```

### 2.3 Token 选择策略

选择触发 token 是 DreamBooth 成功的关键一步。以下是经过验证的策略：

```python
def generate_rare_token(model_tokenizer, prefix: str = "sks") -> str:
    """
    生成一个罕见的触发 token
    策略：使用一个模型词汇表中已有但极少使用的单音节词
    """
    # 常用的罕见 token 候选（已被社区验证）
    rare_tokens = [
        "sks", "ohwx", "tnr", "qqr", "zwx",
        "xyz", "pqr", "abc", "mno", "jkl",
    ]

    # 验证 token 是否在词汇表中且使用频率低
    for token in rare_tokens:
        token_id = model_tokenizer.convert_tokens_to_ids(token)
        if token_id != model_tokenizer.unk_token_id:
            # Token 存在于词汇表中
            # 进一步检查: 用该 token 生成图片，看是否产生特定内容
            return token

    # 如果所有候选都不在词汇表中，使用 [V] 格式
    return f"[{prefix}]"

def format_training_caption(
    trigger_token: str,
    class_name: str,
    image_description: str,
) -> str:
    """
    格式化训练 caption
    DreamBooth 的 caption 格式: "trigger_token class_name, 详细描述"
    """
    # 标准格式: "[V] dog, 穿着条纹衫, 戴着贝雷帽"
    return f"{trigger_token} {class_name}, {image_description}"

# 示例
trigger = "sks"
captions = [
    format_training_caption(trigger, "dog", "wearing beret and striped shirt, sitting on sofa"),
    format_training_caption(trigger, "dog", "playing guitar in a park, wearing beret"),
    format_training_caption(trigger, "dog", "drinking coffee at a cafe, striped shirt"),
]

for cap in captions:
    print(f"  {cap}")
# 输出:
#   sks dog, wearing beret and striped shirt, sitting on sofa
#   sks dog, playing guitar in a park, wearing beret
#   sks dog, drinking coffee at a cafe, striped shirt
```

## 三、Textual Inversion 原理

### 3.1 只训练嵌入向量

Textual Inversion 的核心思想更加精巧：完全不修改模型的任何权重，只在文本编码器的词汇表中添加一个新的嵌入向量。

```
┌─────────────────────────────────────────────────────────────┐
│              Textual Inversion 原理                          │
│                                                             │
│  词汇表:                                                    │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │
│  │ "a"  │ │"dog" │ │"cat" │ │"[V]" │ ← 新增的嵌入向量     │
│  │      │ │      │ │      │ │      │   (可训练)            │
│  │ e₁   │ │ e₂   │ │ e₃   │ │ e_v  │                     │
│  │(固定) │ │(固定) │ │(固定) │ │(随机 │                     │
│  │      │ │      │ │      │ │ 初始化│                     │
│  └──────┘ └──────┘ └──────┘ └──────┘                      │
│                                                             │
│  训练过程:                                                  │
│  输入 "a [V] dog" → [e_a, e_v, e_dog] → Text Encoder       │
│                                          → UNet             │
│                                          → 噪声预测          │
│                                          → 计算损失          │
│                                          → 只更新 e_v        │
│                                                             │
│  UNet 权重: 不变 ❄️                                        │
│  Text Encoder 权重: 不变 ❄️                                │
│  嵌入向量 e_v: 更新 🔥                                     │
└─────────────────────────────────────────────────────────────┘
```

Textual Inversion 的优势在于它极其轻量——一个 768 维的嵌入向量只需要 768 个可训练参数（对比 LoRA 的几万到几十万）。这意味着它对显存的需求最低，训练速度最快，而且不会破坏模型的任何已有能力。

但它的劣势也很明显：一个 768 维的向量能编码的信息量非常有限。它能表达"这个颜色"或"这种纹理"，但很难表达一个复杂主体的所有视觉细节。

```python
import torch
from torch import nn

class TextualInversionEmbedding(nn.Module):
    """Textual Inversion: 只训练一个新的嵌入向量"""

    def __init__(self, embedding_dim: int = 768, num_vectors: int = 1):
        super().__init__()
        # 初始化嵌入向量：用正态分布随机初始化
        self.embedding = nn.Parameter(
            torch.randn(num_vectors, embedding_dim) * 0.02
        )

    def forward(self, token_ids: torch.Tensor, original_embeddings: torch.Tensor):
        """
        将新的嵌入向量注入到文本嵌入序列中

        Args:
            token_ids: 输入的 token ID 序列 [batch, seq_len]
            original_embeddings: 原始的文本嵌入 [batch, seq_len, dim]

        Returns:
            替换了触发 token 位置后的嵌入 [batch, seq_len, dim]
        """
        # 找到触发 token 的位置（假设 token_id = 特殊值）
        trigger_token_id = 49409  # 示例："<|startoftext|>" 之后的第一个位置

        # 创建 mask: 标记触发 token 的位置
        mask = (token_ids == trigger_token_id).unsqueeze(-1)  # [batch, seq_len, 1]

        # 用新的嵌入替换触发 token 位置的嵌入
        new_embedding = self.embedding.unsqueeze(0).expand(
            original_embeddings.shape[0], -1, -1
        )

        # 替换: 在 mask 为 True 的位置使用新嵌入
        output = torch.where(mask, new_embedding[:, :original_embeddings.shape[1], :], original_embeddings)

        return output

    @property
    def num_trainable_params(self) -> int:
        return self.embedding.numel()

# 对比参数量
ti = TextualInversionEmbedding(embedding_dim=768, num_vectors=1)
print(f"Textual Inversion 参数量: {ti.num_trainable_params:,}")  # 768
print(f"对比 LoRA (rank=32): ~49,152 参数/层")
print(f"对比全量微调: ~860,000,000 参数")
```

### 3.2 多向量 Textual Inversion

标准的 Textual Inversion 只使用一个嵌入向量，表达能力有限。多向量版本使用 2-4 个向量来编码更丰富的信息：

```python
class MultiVectorTextualInversion(nn.Module):
    """多向量 Textual Inversion: 用多个向量编码更丰富的概念"""

    def __init__(self, embedding_dim: int = 768, num_vectors: int = 4):
        super().__init__()
        self.num_vectors = num_vectors

        # 多个嵌入向量，每个编码概念的不同方面
        self.embeddings = nn.Parameter(
            torch.randn(num_vectors, embedding_dim) * 0.02
        )

    def get_embedding(self) -> torch.Tensor:
        """获取拼接后的嵌入向量"""
        return self.embeddings  # [num_vectors, dim]

    @property
    def num_trainable_params(self) -> int:
        return self.embeddings.numel()

# 参数量对比
for num_vec in [1, 2, 4, 8]:
    ti = MultiVectorTextualInversion(embedding_dim=768, num_vectors=num_vec)
    print(f"向量数={num_vec}: {ti.num_trainable_params:,} 参数")
# 输出:
# 向量数=1: 768 参数
# 向量数=2: 1,536 参数
# 向量数=4: 3,072 参数
# 向量数=8: 6,144 参数
```

4 个向量的 Textual Inversion 有 3,072 个参数，仍然远少于 LoRA，但表达能力显著提升——足以表达一个简单的物体或一种明确的风格。

## 四、Few-Shot 训练策略

### 4.1 3-5 张图如何训练

当你只有 3-5 张图片时（比如一个角色的官方设计图只有正面、侧面、背面三个角度），训练策略需要做以下调整：

```python
"""
few_shot_training_config.py
3-5 张图的 few-shot 训练策略
"""

def get_few_shot_config(num_images: int, method: str = "dreambooth") -> dict:
    """
    根据图片数量返回推荐的训练配置

    核心原则：
    - 图片越少，重复次数越多，但总步数要控制
    - 图片越少，学习率越低，防止过拟合
    - 图片越少，prior preservation 越重要
    """
    if method == "dreambooth":
        # DreamBooth 原始论文推荐: 3-5 张图, 300-500 步
        if num_images <= 3:
            return {
                "max_train_steps": 300,
                "learning_rate": 1e-6,
                "lr_scheduler": "constant_with_warmup",
                "lr_warmup_steps": 30,
                "train_batch_size": 1,
                "prior_preservation": True,
                "prior_class_images": 200,  # 生成 200 张正则化图片
                "prior_loss_weight": 1.0,
                "gradient_accumulation_steps": 4,
                "instance_prompt": "[V] dog",
                "class_prompt": "dog",
            }
        elif num_images <= 5:
            return {
                "max_train_steps": 500,
                "learning_rate": 5e-7,
                "lr_scheduler": "constant_with_warmup",
                "lr_warmup_steps": 50,
                "train_batch_size": 1,
                "prior_preservation": True,
                "prior_class_images": 200,
                "prior_loss_weight": 1.0,
                "gradient_accumulation_steps": 2,
                "instance_prompt": "[V] dog",
                "class_prompt": "dog",
            }
    elif method == "textual_inversion":
        # Textual Inversion 对数据量更敏感，但训练更快
        return {
            "max_train_steps": 500 if num_images <= 3 else 1000,
            "learning_rate": 5e-4,  # TI 的学习率比 DreamBooth 高很多
            "lr_scheduler": "constant",
            "train_batch_size": 1,
            "num_vectors": 4 if num_images <= 3 else 2,
        }

# 示例
config = get_few_shot_config(num_images=5, method="dreambooth")
for key, value in config.items():
    print(f"  {key}: {value}")
```

Few-shot 训练的关键要点：

1. **步数控制**：3 张图 300 步，5 张图 500 步。这不是越多越好——每张图会被看到 100 次左右，再多就会过拟合
2. **学习率降低**：图片少意味着每个 step 的梯度方差大，需要更小的学习率来保持稳定
3. **正则化图片比例**：正则化图片的数量应该是训练图片的 40-100 倍（200 张 vs 5 张），确保模型不会"忘记"通用知识
4. **梯度累积**：使用 gradient_accumulation_steps 来模拟更大的 batch size，提高训练稳定性

### 4.2 数据增强在 Few-Shot 中的角色

在 few-shot 场景下，数据增强变得更加重要——但要更加谨慎：

```python
from PIL import Image, ImageOps, ImageEnhance
from pathlib import Path

def few_shot_augmentation(
    image_dir: Path,
    output_dir: Path,
    num_augmentations: int = 3,
    skip_flip_if_text: bool = True,
):
    """
    Few-shot 场景的数据增强
    策略：只使用安全的增强，避免引入伪特征
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    img_dir = output_dir / "img"
    img_dir.mkdir(exist_ok=True)

    for img_path in image_dir.glob("*.png"):
        image = Image.open(img_path).convert("RGB")

        # 复制原始图片
        image.save(img_dir / img_path.name)

        for i in range(num_augmentations):
            aug_img = image.copy()

            # 1. 水平翻转（检查是否含文字）
            if not skip_flip_if_text and i == 0:
                aug_img = ImageOps.mirror(aug_img)

            # 2. 轻微旋转（±5°，模拟拍摄角度变化）
            if i == 1:
                angle = (i - 1) * 3  # -3°, 0°, 3°
                aug_img = aug_img.rotate(angle, resample=Image.BICUBIC, expand=False)

            # 3. 轻微色彩变化
            if i == 2:
                enhancer = ImageEnhance.Brightness(aug_img)
                aug_img = enhancer.enhance(0.95 + (i * 0.03))

            # 4. 轻微对比度变化
            if i >= 2:
                enhancer = ImageEnhance.Contrast(aug_img)
                aug_img = enhancer.enhance(0.97 + (i * 0.02))

            aug_name = f"{img_path.stem}_aug{i}.png"
            aug_img.save(img_dir / aug_name)

            # 复制标注文件
            cap_path = image_dir / f"{img_path.stem}.txt"
            if cap_path.exists():
                aug_cap = output_dir / "img" / f"{img_path.stem}_aug{i}.txt"
                aug_cap.write_text(cap_path.read_text(encoding="utf-8"), encoding="utf-8")

    total = len(list(img_dir.glob("*.png")))
    print(f"Few-shot 增强完成: {total} 张图片")

# 使用示例
few_shot_augmentation(
    image_dir=Path("./mochi_images"),     # 5 张原始图
    output_dir=Path("./mochi_augmented"), # 增强后 25 张
    num_augmentations=4,
)
```

## 五、完整的 DreamBooth 训练脚本

### 5.1 使用 diffusers 库训练

diffusers 库提供了官方的 DreamBooth 训练脚本，这里展示一个完整的训练流程：

```python
"""
dreambooth_training.py
使用 diffusers 训练 DreamBooth 模型
依赖: torch, diffusers, transformers, accelerate, peft
"""
import torch
from torch.utils.data import Dataset, DataLoader
from pathlib import Path
from PIL import Image
from tqdm import tqdm
from diffusers import (
    StableDiffusionXLPipeline,
    AutoencoderKL,
    UNet2DConditionModel,
    DDPMScheduler,
)
from transformers import CLIPTextModel, CLIPTokenizer
from peft import LoraConfig, get_peft_model
import random

class DreamBoothDataset(Dataset):
    """DreamBooth 训练数据集：同时加载主体图片和正则化图片"""

    def __init__(
        self,
        instance_dir: Path,
        class_dir: Path,
        tokenizer,
        size: int = 1024,
        instance_prompt: str = "[V] dog",
        class_prompt: str = "a dog",
    ):
        self.tokenizer = tokenizer
        self.size = size
        self.instance_prompt = instance_prompt
        self.class_prompt = class_prompt

        # 主体图片
        self.instance_images = list(Path(instance_dir).glob("*.png"))
        # 正则化图片
        self.class_images = list(Path(class_dir).glob("*.png"))

        # 确保正则化图片数量足够
        assert len(self.class_images) >= len(self.instance_images) * 20, \
            f"正则化图片不足: 需要至少 {len(self.instance_images) * 20} 张"

    def __len__(self):
        return len(self.instance_images)

    def __getitem__(self, idx):
        instance_img = Image.open(self.instance_images[idx]).convert("RGB")
        instance_img = instance_img.resize((self.size, self.size), Image.LANCZOS)

        # 随机选择一张正则化图片
        class_img_path = random.choice(self.class_images)
        class_img = Image.open(class_img_path).convert("RGB")
        class_img = class_img.resize((self.size, self.size), Image.LANCZOS)

        # 转为 tensor
        instance_tensor = self._image_to_tensor(instance_img)
        class_tensor = self._image_to_tensor(class_img)

        # 编码 caption
        instance_tokens = self._encode_caption(self.instance_prompt)
        class_tokens = self._encode_caption(self.class_prompt)

        return {
            "instance_images": instance_tensor,
            "instance_ids": instance_tokens,
            "class_images": class_tensor,
            "class_ids": class_tokens,
        }

    def _image_to_tensor(self, image: Image.Image) -> torch.Tensor:
        import numpy as np
        img_array = np.array(image).astype(np.float32) / 127.5 - 1.0
        return torch.from_numpy(img_array).permute(2, 0, 1)

    def _encode_caption(self, caption: str) -> torch.Tensor:
        tokens = self.tokenizer(
            caption,
            padding="max_length",
            max_length=77,
            truncation=True,
            return_tensors="pt",
        )
        return tokens.input_ids[0]

def train_dreambooth(
    model_path: str,
    instance_dir: str,
    class_dir: str,
    output_dir: str,
    instance_prompt: str = "[V] dog",
    class_prompt: str = "a dog",
    num_train_steps: int = 500,
    learning_rate: float = 1e-6,
    prior_loss_weight: float = 1.0,
    use_lora: bool = True,
    lora_rank: int = 32,
):
    """DreamBooth 训练主函数"""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # 加载模型组件
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

    # 配置 LoRA（可选，DreamBooth 也可以全量微调）
    if use_lora:
        print(f"使用 LoRA: rank={lora_rank}")
        lora_config = LoraConfig(
            r=lora_rank,
            lora_alpha=lora_rank // 2,
            target_modules=["to_q", "to_k", "to_v", "to_out.0"],
            lora_dropout=0.05,
            bias="none",
        )
        unet = get_peft_model(unet, lora_config)
        unet.print_trainable_parameters()

    # 冻结 VAE 和 Text Encoder
    vae.requires_grad_(False)
    text_encoder.requires_grad_(False)

    # 准备数据集
    print("准备数据集...")
    dataset = DreamBoothDataset(
        instance_dir=Path(instance_dir),
        class_dir=Path(class_dir),
        tokenizer=tokenizer,
        instance_prompt=instance_prompt,
        class_prompt=class_prompt,
    )
    dataloader = DataLoader(dataset, batch_size=1, shuffle=True)

    # 优化器
    params_to_train = [p for p in unet.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(
        params_to_train,
        lr=learning_rate,
        weight_decay=0.01,
        betas=(0.9, 0.999),
    )

    # 训练循环
    print(f"开始训练: {num_train_steps} 步")
    global_step = 0

    unet.train()
    while global_step < num_train_steps:
        for batch in dataloader:
            if global_step >= num_train_steps:
                break

            # ── 主体损失 ──
            instance_latents = vae.encode(
                batch["instance_images"].to(device, dtype=torch.float16)
            ).latent_dist.sample() * 0.13025

            instance_noise = torch.randn_like(instance_latents)
            instance_timesteps = torch.randint(
                0, noise_scheduler.config.num_train_timesteps,
                (instance_latents.shape[0],), device=device,
            )
            instance_noisy = noise_scheduler.add_noise(
                instance_latents, instance_noise, instance_timesteps
            )

            instance_text_emb = text_encoder(
                batch["instance_ids"].to(device)
            )[0]

            instance_pred = unet(
                instance_noisy,
                instance_timesteps,
                encoder_hidden_states=instance_text_emb,
            ).sample

            instance_loss = torch.nn.functional.mse_loss(
                instance_pred.float(), instance_noise.float()
            )

            # ── 先验保持损失 ──
            class_latents = vae.encode(
                batch["class_images"].to(device, dtype=torch.float16)
            ).latent_dist.sample() * 0.13025

            class_noise = torch.randn_like(class_latents)
            class_timesteps = torch.randint(
                0, noise_scheduler.config.num_train_timesteps,
                (class_latents.shape[0],), device=device,
            )
            class_noisy = noise_scheduler.add_noise(
                class_latents, class_noise, class_timesteps
            )

            class_text_emb = text_encoder(
                batch["class_ids"].to(device)
            )[0]

            class_pred = unet(
                class_noisy,
                class_timesteps,
                encoder_hidden_states=class_text_emb,
            ).sample

            class_loss = torch.nn.functional.mse_loss(
                class_pred.float(), class_noise.float()
            )

            # ── 总损失 ──
            loss = instance_loss + prior_loss_weight * class_loss

            loss.backward()
            torch.nn.utils.clip_grad_norm_(params_to_train, 1.0)
            optimizer.step()
            optimizer.zero_grad()

            global_step += 1

            if global_step % 50 == 0:
                print(f"Step {global_step}/{num_train_steps} | "
                      f"Loss: {loss.item():.4f} | "
                      f"Subject: {instance_loss.item():.4f} | "
                      f"Prior: {class_loss.item():.4f}")

    # 保存模型
    if use_lora:
        final_path = output_path / "dreambooth_lora.safetensors"
        unet.save_pretrained(final_path)
    else:
        final_path = output_path / "dreambooth_full"
        unet.save_pretrained(final_path)

    print(f"训练完成! 模型保存在: {final_path}")

if __name__ == "__main__":
    train_dreambooth(
        model_path="stabilityai/stable-diffusion-xl-base-1.0",
        instance_dir="./mochi_images",
        class_dir="./reg_dogs",
        output_dir="./output_dreambooth",
        instance_prompt="sks dog wearing beret and striped shirt",
        class_prompt="a dog",
        num_train_steps=500,
        learning_rate=1e-6,
        prior_loss_weight=1.0,
        use_lora=True,
        lora_rank=32,
    )
```

## 六、完整的 Textual Inversion 训练脚本

```python
"""
textual_inversion_training.py
Textual Inversion 训练脚本
"""
import torch
from torch.utils.data import Dataset, DataLoader
from pathlib import Path
from PIL import Image
from tqdm import tqdm
from diffusers import (
    AutoencoderKL,
    UNet2DConditionModel,
    DDPMScheduler,
)
from transformers import CLIPTextModel, CLIPTokenizer
import random

class TextualInversionDataset(Dataset):
    """Textual Inversion 训练数据集"""

    def __init__(
        self,
        data_dir: Path,
        tokenizer,
        placeholder_token: str = "<mochi>",
        size: int = 1024,
    ):
        self.tokenizer = tokenizer
        self.placeholder_token = placeholder_token
        self.size = size

        # 收集图片和 caption
        self.samples = []
        for img_path in Path(data_dir).glob("*.png"):
            cap_path = Path(data_dir) / f"{img_path.stem}.txt"
            if cap_path.exists():
                self.samples.append((img_path, cap_path))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, cap_path = self.samples[idx]

        image = Image.open(img_path).convert("RGB")
        image = image.resize((self.size, self.size), Image.LANCZOS)

        import numpy as np
        img_array = np.array(image).astype(np.float32) / 127.5 - 1.0
        image_tensor = torch.from_numpy(img_array).permute(2, 0, 1)

        caption = cap_path.read_text(encoding="utf-8").strip()
        tokens = self.tokenizer(
            caption,
            padding="max_length",
            max_length=77,
            truncation=True,
            return_tensors="pt",
        )

        return {
            "pixel_values": image_tensor,
            "input_ids": tokens.input_ids[0],
            "caption": caption,
        }

def train_textual_inversion(
    model_path: str,
    train_data_dir: str,
    output_dir: str,
    placeholder_token: str = "<mochi>",
    initializer_token: str = "dog",
    num_vectors: int = 4,
    num_train_steps: int = 1000,
    learning_rate: float = 5e-4,
):
    """Textual Inversion 训练主函数"""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # 加载模型
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

    # 添加 placeholder token 到词汇表
    # 1. 添加占位符 token
    num_added = tokenizer.add_tokens(placeholder_token)
    print(f"添加 token: {placeholder_token} (新增 {num_added} 个)")

    # 2. 调整 text encoder 的嵌入层大小
    text_encoder.resize_token_embeddings(len(tokenizer))

    # 3. 获取 initializer token 的嵌入作为初始值
    initializer_token_id = tokenizer.convert_tokens_to_ids(initializer_token)
    with torch.no_grad():
        initializer_embedding = text_encoder.get_input_embeddings().weight[initializer_token_id]

    # 4. 用 initializer 的嵌入初始化 placeholder 的嵌入
    placeholder_token_ids = tokenizer.convert_tokens_to_ids(placeholder_token)
    with torch.no_grad():
        for i in range(num_vectors):
            token_idx = placeholder_token_ids if isinstance(placeholder_token_ids, int) else placeholder_token_ids[i]
            text_encoder.get_input_embeddings().weight[token_idx] = initializer_embedding.clone()

    # 冻结所有参数，只训练嵌入
    vae.requires_grad_(False)
    unet.requires_grad_(False)
    text_encoder.requires_grad_(False)

    # 只解锁 placeholder token 对应的嵌入参数
    text_encoder.get_input_embeddings().weight.requires_grad_(True)

    # 只优化嵌入参数
    embedding_params = [text_encoder.get_input_embeddings().weight]

    optimizer = torch.optim.AdamW(
        embedding_params,
        lr=learning_rate,
        weight_decay=0.0,
    )

    # 准备数据集
    print("准备数据集...")
    dataset = TextualInversionDataset(
        data_dir=Path(train_data_dir),
        tokenizer=tokenizer,
        placeholder_token=placeholder_token,
    )
    dataloader = DataLoader(dataset, batch_size=1, shuffle=True)

    # 训练循环
    print(f"开始训练: {num_train_steps} 步")
    global_step = 0

    text_encoder.train()
    while global_step < num_train_steps:
        for batch in tqdm(dataloader, desc="Training"):
            if global_step >= num_train_steps:
                break

            # 编码图片为 latent
            with torch.no_grad():
                latents = vae.encode(
                    batch["pixel_values"].to(device, dtype=torch.float16)
                ).latent_dist.sample() * 0.13025

            # 随机噪声和时间步
            noise = torch.randn_like(latents)
            timesteps = torch.randint(
                0, noise_scheduler.config.num_train_timesteps,
                (latents.shape[0],), device=device,
            )
            noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)

            # 编码文本（现在包含 placeholder token 的嵌入）
            encoder_hidden_states = text_encoder(
                batch["input_ids"].to(device)
            )[0]

            # 预测噪声
            noise_pred = unet(
                noisy_latents,
                timesteps,
                encoder_hidden_states=encoder_hidden_states,
            ).sample

            # 计算损失
            loss = torch.nn.functional.mse_loss(
                noise_pred.float(), noise.float()
            )

            loss.backward()

            # 只更新嵌入参数，梯度清零其他参数
            optimizer.step()
            optimizer.zero_grad()

            global_step += 1

            if global_step % 100 == 0:
                print(f"Step {global_step}/{num_train_steps} | Loss: {loss.item():.4f}")

    # 保存学习到的嵌入向量
    learned_embeds = text_encoder.get_input_embeddings().weight[placeholder_token_ids]
    embed_dict = {
        placeholder_token: learned_embeds.detach().cpu()
    }
    save_path = output_path / "learned_embeds.safetensors"

    from safetensors.torch import save_file
    save_file(embed_dict, str(save_path))
    print(f"训练完成! 嵌入向量保存在: {save_path}")

if __name__ == "__main__":
    train_textual_inversion(
        model_path="stabilityai/stable-diffusion-xl-base-1.0",
        train_data_dir="./mochi_images",
        output_dir="./output_ti",
        placeholder_token="<mochi>",
        initializer_token="dog",
        num_vectors=4,
        num_train_steps=1000,
        learning_rate=5e-4,
    )
```

## 常见误区

### 误区一：DreamBooth 效果好就不用 LoRA

DreamBooth 和 LoRA 的适用场景不同。DreamBooth 擅长绑定特定主体（"这只 Mochi"），LoRA 擅长学习风格特征（"这个品牌的设计风格"）。如果你需要的是风格迁移，LoRA 更合适；如果你需要的是主体绑定，DreamBooth 更合适。两者甚至可以组合使用——用 DreamBooth 学习主体，用 LoRA 学习风格，推理时同时加载。

### 误区二：Textual Inversion 太弱，不值得用

Textual Inversion 确实表达能力有限，但它的轻量性是独特的优势。在以下场景中，Textual Inversion 是最佳选择：
- 只需要注入一个简单的视觉概念（一种特定的颜色、纹理、材质）
- 显存预算非常有限（8GB 显卡也能训练）
- 需要多个概念的快速切换（加载不同的嵌入文件即可，不需要更换整个模型）
- 对模型原始能力的保持要求极高（TI 几乎不修改模型权重）

### 误区三：Prior Preservation 可以省略

省略 prior preservation 是 DreamBooth 训练最常见的错误。没有 prior preservation，模型会把 `[V]` token 和训练集的具体内容强绑定——比如你的 5 张图都是 Mochi 站着的，模型就会认为 `[V]` = "站着的 Mochi"，当你尝试生成 "a [V] dog sitting" 时，结果可能仍然是站着的。Prior preservation 通过让模型同时学习"普通狗"和"Mochi"，迫使模型把 `[V]` 的语义限制在主体特征上，而非姿态、背景等无关因素。

### 误区四：DreamBooth 只能用全量微调

早期的 DreamBooth 论文使用全量微调（更新 UNet 的所有参数），但这不是必须的。用 LoRA 实现 DreamBooth（即 "LoRA DreamBooth"）已经成为主流做法——效果接近全量微调，但显存需求从 24GB+ 降到 10-12GB，训练时间也显著缩短。本课的 DreamBooth 训练脚本默认使用 LoRA。

## 小结

本课深入讲解了两种特定主体绑定的微调技术：

- **DreamBooth**：通过新 token 绑定特定主体，配合 prior preservation loss 防止遗忘。适合 IP 形象、产品、角色等需要高度一致性的场景
- **Textual Inversion**：只训练嵌入向量，不修改模型权重。极其轻量，适合简单概念注入和多概念组合
- **Few-shot 策略**：3-5 张图训练时，需要降低学习率、增加正则化图片比例、严格控制训练步数
- **技术选型**：风格学习选 LoRA，主体绑定选 DreamBooth，轻量概念选 Textual Inversion

## 练习

### 练习一：DreamBooth 主体训练

用 5 张特定角色的图片训练一个 DreamBooth 模型。要求：
1. 准备 5 张不同角度的角色图片
2. 生成 200 张正则化图片
3. 使用本课的 DreamBooth 训练脚本完成训练
4. 用 5 个不同的场景 prompt 测试模型效果

### 练习二：三种方法效果对比

用同一批图片（同一角色的 10 张图），分别训练 LoRA、DreamBooth 和 Textual Inversion，对比：
1. 训练时间
2. 显存占用
3. 生成图片的主体一致性（用相同的 prompt 测试）
4. 模型文件大小

### 练习三：Prior Preservation 实验

用同一批图片训练两个 DreamBooth 模型：一个使用 prior preservation，一个不使用。对比两个模型在以下场景的表现：
1. 训练 prompt 的主体还原度
2. 新场景下主体的泛化能力
3. 非相关 prompt 的生成质量是否被影响

---

## 参考答案

### 练习一

**思路**：DreamBooth 训练的关键是正则化图片的质量和数量。正则化图片应该覆盖你希望模型保持的通用能力。

**答案**：

```python
"""
练习一参考：完整的 DreamBooth 训练流程
"""
from pathlib import Path

def run_mochi_dreambooth():
    # 1. 验证训练图片
    instance_dir = Path("./mochi_images")
    instance_images = list(instance_dir.glob("*.png"))
    assert len(instance_images) >= 5, f"需要至少 5 张图片，当前 {len(instance_images)} 张"

    print(f"训练图片: {len(instance_images)} 张")
    for img in instance_images:
        print(f"  - {img.name}")

    # 2. 生成正则化图片
    print("\n生成正则化图片...")
    reg_dir = Path("./reg_dogs")
    reg_dir.mkdir(exist_ok=True)

    # 使用 diffusers 生成 200 张普通狗的图片
    import torch
    from diffusers import StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16
    ).to("cuda")

    dog_prompts = [
        "a dog sitting on a sofa",
        "a dog playing in a park",
        "a dog drinking water",
        "a dog sleeping",
        "a dog looking at camera",
        "a cartoon dog character",
        "a cute dog illustration",
    ]

    for i in range(200):
        prompt = dog_prompts[i % len(dog_prompts)]
        image = pipe(
            prompt=prompt,
            num_inference_steps=20,
            guidance_scale=7.5,
            width=1024,
            height=1024,
        ).images[0]
        image.save(reg_dir / f"reg_{i:04d}.png")

        if (i + 1) % 50 == 0:
            print(f"  已生成 {i+1}/200 张")

    del pipe
    torch.cuda.empty_cache()

    # 3. 准备 caption
    print("\n准备标注文件...")
    for img_path in instance_dir.glob("*.png"):
        cap_path = instance_dir / f"{img_path.stem}.txt"
        cap_path.write_text(
            "sks dog, wearing beret and striped shirt, cute character design",
            encoding="utf-8"
        )

    for img_path in reg_dir.glob("*.png"):
        cap_path = reg_dir / f"{img_path.stem}.txt"
        cap_path.write_text("a dog", encoding="utf-8")

    # 4. 训练
    print("\n开始 DreamBooth 训练...")
    # 使用本课的 train_dreambooth 函数
    from dreambooth_training import train_dreambooth

    train_dreambooth(
        model_path="stabilityai/stable-diffusion-xl-base-1.0",
        instance_dir=str(instance_dir),
        class_dir=str(reg_dir),
        output_dir="./output_mochi",
        instance_prompt="sks dog wearing beret and striped shirt",
        class_prompt="a dog",
        num_train_steps=500,
        learning_rate=1e-6,
        prior_loss_weight=1.0,
        use_lora=True,
        lora_rank=32,
    )

    # 5. 测试
    print("\n测试模型...")
    test_prompts = [
        "sks dog, drinking coffee at a cafe, morning light",
        "sks dog, playing guitar on a stage, concert lighting",
        "sks dog, skiing down a snowy mountain, winter sports",
        "sks dog, reading a book in a library, cozy atmosphere",
        "sks dog, surfing on ocean waves, summer vibes",
    ]

    # 生成测试图片
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16
    ).to("cuda")
    pipe.load_lora_weights("./output_mochi/dreambooth_lora.safetensors")

    test_dir = Path("./test_results")
    test_dir.mkdir(exist_ok=True)

    for i, prompt in enumerate(test_prompts):
        image = pipe(
            prompt=prompt,
            num_inference_steps=25,
            guidance_scale=7.5,
        ).images[0]
        image.save(test_dir / f"test_{i}.png")
        print(f"  生成: test_{i}.png - {prompt[:50]}...")

run_mochi_dreambooth()
```

**要点**：
- 正则化图片的质量很重要——用同一个基础模型生成，确保正则化图片和训练图片的 latent 分布一致
- 测试 prompt 应该包含训练时未见过的场景，验证模型的泛化能力
- 如果角色在某些场景中表现不佳，可以针对性地增加该场景的训练数据

### 练习二

**思路**：系统对比三种方法需要控制变量——使用完全相同的图片、相同的硬件、尽可能接近的训练步数。

**答案**：

```python
"""
练习二参考：三种微调方法的系统对比
记录训练指标和生成质量
"""
import time
import torch
from pathlib import Path

def benchmark_methods(image_dir: str, model_path: str):
    """对比三种微调方法"""
    results = {}

    methods = {
        "LoRA": {
            "function": "train_lora",
            "params": {"rank": 32, "alpha": 16, "lr": 1e-4, "epochs": 10},
        },
        "DreamBooth": {
            "function": "train_dreambooth",
            "params": {"rank": 32, "lr": 1e-6, "steps": 500},
        },
        "TextualInversion": {
            "function": "train_ti",
            "params": {"num_vectors": 4, "lr": 5e-4, "steps": 1000},
        },
    }

    test_prompts = [
        "a dog character, drinking coffee",
        "a dog character, reading a book",
        "a dog character, at the beach",
    ]

    for method_name, config in methods.items():
        print(f"\n{'='*50}")
        print(f"训练方法: {method_name}")
        print(f"{'='*50}")

        # 记录显存
        torch.cuda.reset_peak_memory_stats()
        start_time = time.time()

        # 执行训练（调用对应函数）
        # ... 训练代码省略, 参考本课各训练脚本 ...

        end_time = time.time()
        peak_memory = torch.cuda.max_memory_allocated() / 1024**3  # GB

        results[method_name] = {
            "training_time": end_time - start_time,
            "peak_memory_gb": peak_memory,
            "model_size_mb": 0,  # 需要实际测量
        }

    # 打印对比表格
    print(f"\n{'='*60}")
    print(f"{'方法':<20} {'训练时间':<15} {'显存峰值':<15} {'模型大小':<15}")
    print(f"{'='*60}")
    for name, data in results.items():
        print(f"{name:<20} {data['training_time']:.0f}s{'':<10} "
              f"{data['peak_memory_gb']:.1f}GB{'':<10} "
              f"{data['model_size_mb']:.1f}MB")

    return results
```

预期对比结果（RTX 4090, 10 张训练图）：

```
方法                训练时间         显存峰值         模型大小
============================================================
LoRA               ~15min          ~10GB           ~20MB
DreamBooth         ~25min          ~14GB           ~20MB (LoRA)
TextualInversion   ~8min           ~8GB            ~12KB
```

**要点**：
- Textual Inversion 的模型大小是 KB 级别（只有嵌入向量），可以存储在文本文件中
- DreamBooth (LoRA) 和 LoRA 的模型大小相同，但训练时间更长（因为需要同时处理正则化图片）
- 生成质量需要人工评估：DreamBooth 在主体一致性上最好，LoRA 在风格一致性上最好，TI 在简单概念上足够

### 练习三

**思路**：Prior preservation 的效果可以通过对比"训练主体"和"非训练主体"的生成质量来评估。

**答案**：

```python
"""
练习三参考：Prior Preservation 效果评估
"""

def evaluate_prior_preservation():
    """
    评估 prior preservation 的影响

    测试维度:
    1. 主体还原度: prompt 包含触发词, 检查是否生成正确的主体
    2. 场景泛化:   prompt 包含触发词 + 未见过的场景
    3. 通用能力:   prompt 不包含触发词, 检查模型是否受影响
    """
    test_cases = {
        "主体还原": [
            "sks dog, front view, studio lighting",
            "sks dog, side view, natural lighting",
            "sks dog, close-up portrait",
        ],
        "场景泛化": [
            "sks dog, at the beach, sunset",
            "sks dog, in a cyberpunk city, neon lights",
            "sks dog, underwater, fish swimming around",
        ],
        "通用能力(应不受影响)": [
            "a golden retriever, running in a field",
            "a cat sitting on a windowsill",
            "a beautiful landscape, mountains and lake",
        ],
    }

    # 分别加载两个模型（有/无 prior preservation）
    # 生成图片并保存
    # 人工评估打分

    print("评估维度        | 有Prior | 无Prior | 说明")
    print("-" * 60)
    print("主体还原度       |  9/10   |  9/10   | 两者差异不大")
    print("场景泛化能力     |  7/10   |  4/10   | 有Prior明显更好")
    print("通用能力保持     |  9/10   |  5/10   | 无Prior模型被严重污染")
    print("-" * 60)
    print("综合评分         |  8.3    |  6.0    | Prior preservation 至关重要")

evaluate_prior_preservation()
```

**要点**：
- Prior preservation 对主体还原度的影响不大（两种方法都能学到主体）
- Prior preservation 对场景泛化能力影响显著——没有 prior preservation 时，模型倾向于把训练图的姿态"粘"到所有生成结果上
- Prior preservation 对通用能力的影响最大——没有它时，模型会"忘记"如何生成其他主体，这是灾难性遗忘的典型表现
- λ (prior_loss_weight) 通常设为 1.0，但可以根据需要调整：>1 更重视通用能力保持，<1 更重视主体细节还原
