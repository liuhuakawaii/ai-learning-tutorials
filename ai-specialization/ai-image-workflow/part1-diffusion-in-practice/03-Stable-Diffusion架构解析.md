# 第 3 课：Stable Diffusion 架构解析 — Latent Diffusion 的工程智慧

## 场景引入

上一课我们理解了 Diffusion 的数学原理，但有一个关键问题没有解决：直接在像素空间做扩散，计算量大得惊人。一张 512×512 的 RGB 图像有 786,432 个像素，每一步去噪都要处理这么大的向量——这意味着巨大的显存占用和极慢的推理速度。

Stable Diffusion 的核心创新不是发明了新的 Diffusion 算法，而是找到了一个工程上的巧妙解法：**在压缩的潜空间（Latent Space）中做扩散**。这个思路将计算量降低了 4-16 倍，让消费级显卡也能运行高质量的图像生成。

本课将完整拆解 Stable Diffusion 的三大组件，让你真正理解它为什么这样设计。

## 学习目标

完成本课后，你将能够：
1. 解释 Latent Diffusion 的核心思想及其工程优势
2. 理解 VAE、U-Net、Text Encoder 三大组件的作用
3. 理解 Cross-Attention 机制如何实现文本控制
4. 对比 SD 1.5、SDXL、SD3 的架构差异
5. 为后续的 LoRA 训练、ComfyUI 工作流打下架构基础

## 一、Latent Diffusion：核心创新

### 1.1 为什么需要潜空间

直接在像素空间做 Diffusion 的问题：

```
像素空间 Diffusion：
  输入：512 × 512 × 3 = 786,432 维
  U-Net 参数量：~860M
  单步推理：~1.5GB 显存
  1000 步采样：~30 秒（RTX 3090）

潜空间 Diffusion（Stable Diffusion）：
  输入：64 × 64 × 4 = 16,384 维（降低 48 倍！）
  U-Net 参数量：~860M（参数量相同，但处理的张量小得多）
  单步推理：~0.3GB 显存
  1000 步采样：~5 秒（RTX 3090）
```

核心思路：先用一个预训练的 VAE（变分自编码器）将图像压缩到潜空间，在潜空间中做扩散，最后再用 VAE 解码回像素空间。

### 1.2 完整流程图

```
┌─────────────────────────────────────────────────────────────┐
│                 Stable Diffusion 推理流程                      │
│                                                               │
│  ┌──────────┐                                                │
│  │ 文本提示  │                                                │
│  └────┬─────┘                                                │
│       ▼                                                      │
│  ┌──────────────┐    ┌──────────┐                            │
│  │ Text Encoder │───→│ Cross    │                            │
│  │ (CLIP/T5)   │    │ Attention│                            │
│  └──────────────┘    └────┬─────┘                            │
│                           │                                  │
│  随机噪声 ──→ ┌───────────▼───────────┐ ──→ 去噪潜变量       │
│               │      U-Net            │                      │
│               │  (去噪网络)           │                      │
│               │  + 时间步嵌入         │                      │
│               │  + 文本条件注入       │                      │
│               └───────────────────────┘                      │
│                           │                                  │
│                           ▼                                  │
│               ┌───────────────────────┐                      │
│               │    VAE Decoder        │                      │
│               │  (潜空间→像素空间)    │                      │
│               └───────────┬───────────┘                      │
│                           ▼                                  │
│                     最终生成图像                              │
└─────────────────────────────────────────────────────────────┘
```

## 二、组件一：VAE — 空间压缩器

### 2.1 VAE 的结构

VAE 由编码器和解码器组成。编码器将图像压缩到潜空间，解码器将潜变量还原为图像。

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class VAEEncoder(nn.Module):
    """VAE 编码器 — 将图像压缩到潜空间

    输入：512 × 512 × 3 的图像
    输出：64 × 64 × 4 的潜变量（空间压缩 8 倍，通道从 3 变 4）
    """
    def __init__(self, in_channels=3, latent_channels=4, base_channels=128):
        super().__init__()
        self.encoder = nn.Sequential(
            # 逐步下采样：512 → 256 → 128 → 64
            nn.Conv2d(in_channels, base_channels, 3, 1, 1),        # 512x512
            nn.SiLU(),
            nn.Conv2d(base_channels, base_channels, 3, 2, 1),      # 256x256
            nn.SiLU(),
            nn.Conv2d(base_channels, base_channels * 2, 3, 1, 1),
            nn.SiLU(),
            nn.Conv2d(base_channels * 2, base_channels * 2, 3, 2, 1),  # 128x128
            nn.SiLU(),
            nn.Conv2d(base_channels * 2, base_channels * 4, 3, 1, 1),
            nn.SiLU(),
            nn.Conv2d(base_channels * 4, base_channels * 4, 3, 2, 1),  # 64x64
            nn.SiLU(),
            nn.Conv2d(base_channels * 4, latent_channels, 3, 1, 1),    # 64x64x4
        )
        # 输出均值和方差（用于重参数化）
        self.to_mean = nn.Conv2d(latent_channels, latent_channels, 1)
        self.to_logvar = nn.Conv2d(latent_channels, latent_channels, 1)

    def forward(self, x):
        features = self.encoder(x)
        mean = self.to_mean(features)
        logvar = self.to_logvar(features)
        # 重参数化技巧：z = mean + std * ε
        std = torch.exp(0.5 * logvar)
        noise = torch.randn_like(std)
        latent = mean + std * noise
        # 缩放因子（SD 使用的特殊处理）
        return latent * 0.18215, mean, logvar
```

### 2.2 缩放因子的工程意义

注意代码中的 `* 0.18215`。这是 Stable Diffusion 的一个工程细节：

```
VAE 编码后的潜变量方差较大（约 5.5）
直接在这样的尺度上做扩散会导致数值不稳定
乘以 0.18215（≈ 1/5.5）将潜变量缩放到方差 ≈ 1
这样 Diffusion 的训练和推理都在标准正态分布附近进行
```

这个细节在加载预训练模型权重时很重要——如果你用自己训练的 VAE，需要确保缩放因子一致。

## 三、组件二：U-Net — 去噪核心

### 3.1 U-Net 的结构

U-Net 是整个 Stable Diffusion 中最核心、参数最多的组件。它接收含噪潜变量和条件信息，输出预测的噪声。

```
U-Net 结构示意图（SD 1.5）：

输入: noisy_latent (64×64×4) + timestep + text_embedding

┌─────────────────────────────────────────────────────┐
│                    Down Block 1                      │
│              64×64×320 → 64×64×320                   │
│                     │                                │
│              ┌──────┤ skip connection                │
│              │      ▼                                │
│              │  Down Block 2                          │
│              │  32×32×640 → 32×32×640                │
│              │      │                                │
│              │ ┌────┤ skip connection                │
│              │ │    ▼                                │
│              │ │  Down Block 3                        │
│              │ │  16×16×1280 → 16×16×1280            │
│              │ │      │                              │
│              │ │ ┌────┤ skip connection              │
│              │ │ │    ▼                              │
│              │ │ │  Middle Block                      │
│              │ │ │  8×8×1280 → 8×8×1280              │
│              │ │ │    │                              │
│              │ │ │    ▼                              │
│              │ │ └──→ Up Block 3                     │
│              │ │     16×16×1280 + 16×16×1280         │
│              │ │         │                           │
│              │ └──────→ Up Block 2                   │
│              │        32×32×640 + 32×32×640          │
│              │            │                          │
│              └────────→ Up Block 1                   │
│                     64×64×320 + 64×64×320            │
│                          │                           │
│                          ▼                           │
│                    Output Conv                        │
│                    64×64×4                           │
└─────────────────────────────────────────────────────┘

参数量分布：
  Down Blocks:  ~310M
  Middle Block: ~130M
  Up Blocks:    ~420M
  总计:         ~860M
```

### 3.2 ResBlock 与时间步嵌入

U-Net 的每个 block 由多个 ResBlock 组成，每个 ResBlock 都接收时间步嵌入作为调制信号：

```python
class ResBlock(nn.Module):
    """残差块 — U-Net 的基本构建单元

    时间步嵌入通过 scale 和 shift 注入，让网络知道
    当前应该执行"轻度微调"还是"大幅重建"
    """
    def __init__(self, in_channels, out_channels, time_emb_dim=1280):
        super().__init__()
        self.norm1 = nn.GroupNorm(32, in_channels)
        self.conv1 = nn.Conv2d(in_channels, out_channels, 3, padding=1)

        # 时间步嵌入的投影层
        self.time_proj = nn.Sequential(
            nn.SiLU(),
            nn.Linear(time_emb_dim, out_channels * 2),  # scale 和 shift
        )

        self.norm2 = nn.GroupNorm(32, out_channels)
        self.conv2 = nn.Conv2d(out_channels, out_channels, 3, padding=1)

        # 残差连接（如果通道数不同需要投影）
        self.skip_conv = nn.Conv2d(in_channels, out_channels, 1) if in_channels != out_channels else nn.Identity()

    def forward(self, x, time_emb):
        residual = self.skip_conv(x)

        h = self.norm1(x)
        h = F.silu(h)
        h = self.conv1(h)

        # 注入时间步信息：对特征图做 scale 和 shift
        time_emb = self.time_proj(time_emb)
        scale, shift = time_emb.chunk(2, dim=-1)
        h = self.norm2(h)
        h = h * (1 + scale[:, :, None, None]) + shift[:, :, None, None]
        h = F.silu(h)
        h = self.conv2(h)

        return h + residual
```

## 四、组件三：文本条件注入

### 4.1 Cross-Attention 机制

文本条件通过 Cross-Attention 机制注入 U-Net。这是 Stable Diffusion 实现"文生图"的关键。

```python
class CrossAttention(nn.Module):
    """交叉注意力 — 文本条件注入的核心机制

    Query 来自图像特征，Key 和 Value 来自文本嵌入
    这意味着：图像的每个位置"查询"文本中与其相关的信息
    """
    def __init__(self, query_dim, context_dim, heads=8, dim_head=64):
        super().__init__()
        inner_dim = dim_head * heads
        self.heads = heads
        self.scale = dim_head ** -0.5

        self.to_q = nn.Linear(query_dim, inner_dim, bias=False)
        self.to_k = nn.Linear(context_dim, inner_dim, bias=False)
        self.to_v = nn.Linear(context_dim, inner_dim, bias=False)
        self.to_out = nn.Linear(inner_dim, query_dim)

    def forward(self, x, context=None):
        """x: 图像特征 [B, H*W, C]
           context: 文本嵌入 [B, seq_len, dim]，默认使用 x 作为 context（自注意力）
        """
        if context is None:
            context = x  # 自注意力

        q = self.to_q(x)
        k = self.to_k(context)
        v = self.to_v(context)

        # 多头注意力
        B, N, C = q.shape
        q = q.view(B, N, self.heads, -1).transpose(1, 2)  # [B, heads, N, dim]
        k = k.view(B, -1, self.heads, -1).transpose(1, 2)
        v = v.view(B, -1, self.heads, -1).transpose(1, 2)

        # 注意力计算
        attn = (q @ k.transpose(-2, -1)) * self.scale
        attn = attn.softmax(dim=-1)

        out = (attn @ v).transpose(1, 2).reshape(B, N, -1)
        return self.to_out(out)
```

### 4.2 文本编码器的演进

```
模型版本    文本编码器                    最大 Token 数    上下文维度
────────────────────────────────────────────────────────────────────
SD 1.5     CLIP ViT-L/14                 77              768
SD 2.1     OpenCLIP ViT-H/14             77              1024
SDXL       CLIP ViT-L + OpenCLIP ViT-bigG  77+77=154    768+1280=2048
SD3        CLIP ViT-L + OpenCLIP ViT-bigG  77+77+无限    2048+4096
           + T5-XXL (可选)
FLUX       T5-XXL + CLIP ViT-L           无限+77         4096+768
```

CLIP 的 77 个 token 限制意味着你的 Prompt 超过约 75 个英文单词后，多余的部分会被截断。这就是为什么 Prompt Engineering 中强调"把重要的词放在前面"。

## 五、架构演进：从 SD 1.5 到 SD3

### 5.1 SD 1.5 vs SDXL

```
              SD 1.5              SDXL
──────────────────────────────────────────────────
默认分辨率    512×512             1024×1024
U-Net 参数    860M               2.6B
文本编码器    CLIP ViT-L          CLIP + OpenCLIP
条件注入      Cross-Attn only     Cross-Attn + Refiner
VAE 通道      4                   4（但精度更高）
采样步数      20-50               20-40
```

SDXL 的主要改进：
1. 更大的 U-Net（更多 attention 层，更多通道）
2. 双文本编码器（更强的语义理解）
3. 微条件注入（图像尺寸、裁剪参数作为额外条件）
4. 两阶段生成（Base + Refiner）

### 5.2 SD3 的架构革命：MMDiT

SD3 弃用了 U-Net，改用 **MMDiT（Multimodal Diffusion Transformer）**：

```
SD 1.5/SDXL: U-Net + Cross-Attention
  图像特征 → Self-Attn → Cross-Attn(文本) → FFN
  文本和图像在不同的注意力路径中处理

SD3: MMDiT
  [图像特征; 文本特征] → Joint Self-Attention → FFN
  文本和图像在同一个注意力层中联合处理
```

MMDiT 的优势：
- 文本和图像的交互更深入、更细粒度
- 不再受 77 token 限制（T5 编码器支持无限长度）
- 架构更统一，更容易扩展

## 六、常见误区

### 误区一："VAE 只是一个简单的压缩器"

VAE 不仅做空间压缩，还定义了一个连续的、平滑的潜空间。这个潜空间的性质直接影响 LoRA 训练和图像插值的效果。SD 1.5 和 SDXL 的 VAE 在潜空间分布上有显著差异，混用会导致图像质量下降。

### 误区二："U-Net 是图像生成的核心，文本编码器不重要"

恰恰相反。文本编码器决定了模型对 Prompt 的理解能力。SDXL 比 SD 1.5 质量提升的最大贡献者之一就是更强的文本编码器组合。FLUX 使用 T5-XXL 作为主编码器，文本理解能力大幅领先。

### 误区三："SD3 用了 Transformer，U-Net 就完全没用了"

目前（2025 年），SDXL（U-Net 架构）仍然是社区最活跃的模型，拥有最多的 LoRA 和 ControlNet 资源。SD3/FLUX 的生态还在建设中。在工程选型中，SDXL 仍是性价比最高的选择。

## 七、小结

本课的核心要点：

1. **Latent Diffusion** 的核心创新：在压缩的潜空间中做扩散，计算量降低 48 倍
2. **VAE** 负责像素空间 ↔ 潜空间的转换，缩放因子 0.18215 很关键
3. **U-Net** 是去噪核心，通过 ResBlock 注入时间步，通过 Cross-Attention 注入文本
4. **文本编码器**决定了模型的理解能力，77 token 限制是 Prompt 工程的约束
5. **架构演进**：SD 1.5 → SDXL（更大 U-Net）→ SD3（MMDiT 范式转变）

## 练习

### 练习一：显存计算

计算 SD 1.5 在 512×512 分辨率下，单步推理的显存占用（假设 float16 精度）。分别计算 VAE 编码、U-Net 前向传播、VAE 解码三个阶段的显存需求。

### 练习二：Cross-Attention 实验

修改 CrossAttention 的代码，实现一个只关注文本前 5 个 token 的版本（模拟"重要词放在前面"的效果）。对比完整的 Cross-Attention，生成结果有何差异？

### 练习三：架构对比

画出 SD 1.5 和 SD3 的数据流图，标注每个组件的输入输出维度。重点标出两者在条件注入方式上的差异。

---

## 参考答案

### 练习一

**思路**：从数据类型大小和张量维度入手计算。

**答案**：

```python
def calculate_memory_usage():
    """计算 SD 1.5 单步推理的显存占用"""
    bytes_per_element = 2  # float16

    # ── VAE 编码阶段 ──
    input_image = 512 * 512 * 3 * bytes_per_element      # 1.5 MB
    latent_tensor = 64 * 64 * 4 * bytes_per_element       # 32 KB
    vae_encoder_params = 34_000_000 * bytes_per_element    # 68 MB

    # ── U-Net 前向传播（显存占用最大）──
    unet_params = 860_000_000 * bytes_per_element          # 1.72 GB
    # 中间特征图（峰值）
    peak_activation = 64 * 64 * 1280 * 4 * bytes_per_element  # ~260 MB per tensor
    # 加上 skip connection 保存的特征
    skip_connections = sum([
        64*64*320, 64*64*320, 32*32*640, 32*32*640,
        16*16*1280, 16*16*1280, 8*8*1280
    ]) * bytes_per_element  # ~150 MB

    # ── VAE 解码阶段 ──
    vae_decoder_params = 49_000_000 * bytes_per_element    # 98 MB
    output_image = 512 * 512 * 3 * bytes_per_element       # 1.5 MB

    print("SD 1.5 单步推理显存占用（float16）：")
    print(f"  VAE 编码器参数: {vae_encoder_params/1e6:.1f} MB")
    print(f"  U-Net 参数:     {unet_params/1e9:.2f} GB")
    print(f"  U-Net 中间特征: ~{(peak_activation*8 + skip_connections)/1e6:.0f} MB")
    print(f"  VAE 解码器参数: {vae_decoder_params/1e6:.1f} MB")
    print(f"  总计: ~{(unet_params + peak_activation*8 + skip_connections + vae_decoder_params)/1e9:.1f} GB")

calculate_memory_usage()
```

输出约 2.3 GB，实际运行中由于框架开销、梯度缓存等因素，真实显存占用约 4-6 GB。

**要点**：
- U-Net 参数占了绝大部分显存
- 中间特征图的显存占用不可忽视
- float16 比 float32 节省一半显存

### 练习二

**思路**：在注意力计算后，对文本 token 维度做 mask。

**答案**：

```python
class LimitedCrossAttention(CrossAttention):
    """只关注文本前 N 个 token 的交叉注意力"""

    def __init__(self, query_dim, context_dim, heads=8, dim_head=64, max_text_tokens=5):
        super().__init__(query_dim, context_dim, heads, dim_head)
        self.max_text_tokens = max_text_tokens

    def forward(self, x, context=None):
        if context is None:
            context = x

        q = self.to_q(x)
        k = self.to_k(context)
        v = self.to_v(context)

        B, N, C = q.shape
        q = q.view(B, N, self.heads, -1).transpose(1, 2)
        k = k.view(B, -1, self.heads, -1).transpose(1, 2)
        v = v.view(B, -1, self.heads, -1).transpose(1, 2)

        attn = (q @ k.transpose(-2, -1)) * self.scale

        # Mask 掉超过 max_text_tokens 的位置
        if context.shape[1] > self.max_text_tokens:
            mask = torch.ones(attn.shape[-1], device=attn.device) * float('-inf')
            mask[:self.max_text_tokens] = 0
            attn = attn + mask[None, None, None, :]

        attn = attn.softmax(dim=-1)
        out = (attn @ v).transpose(1, 2).reshape(B, N, -1)
        return self.to_out(out)
```

效果差异：只关注前 5 个 token 意味着模型只理解 Prompt 的前几个词，后面的描述被忽略。这会导致生成图像只反映 Prompt 的开头部分。

**要点**：
- Prompt 中越靠前的词影响力越大
- 这解释了为什么 Prompt Engineering 强调"重要的描述放在前面"
- SD 的 77 token 限制不只是截断，后面的 token 注意力权重也确实更低

### 练习三

**思路**：重点对比 U-Net + Cross-Attention vs MMDiT 的数据流。

**答案**：

```
SD 1.5 数据流：
┌──────────┐     ┌──────────┐
│ 文本输入  │────→│ CLIP     │──→ text_emb [77, 768]
└──────────┘     └──────────┘         │
                                      │ Cross-Attention
┌──────────┐     ┌──────────┐         │
│ 噪声输入  │────→│ U-Net    │←────────┘
└──────────┘     └──────────┘         │
      ↑                               │
      └───────── 逐步去噪 ←───────────┘

SD3 数据流：
┌──────────┐     ┌──────────┐
│ 文本输入  │────→│ CLIP×2   │──→ text_emb_1 [77, 2048]
│          │     │ + T5     │──→ text_emb_2 [任意长, 4096]
└──────────┘     └──────────┘         │
                                      │ Joint Self-Attention
┌──────────┐     ┌──────────┐         │
│ 噪声输入  │────→│ MMDiT    │←────────┘
└──────────┘     └──────────┘         │
      ↑                               │
      └───────── 逐步去噪 ←───────────┘

关键差异：
- SD1.5: 文本通过 Cross-Attention "侧面"注入，文本和图像独立处理
- SD3:   文本和图像在同一个 Attention 层中"面对面"交互
```

**要点**：
- MMDiT 的联合注意力让文本-图像交互更深入
- SD3 的文本不再受 77 token 限制
- U-Net 的 skip connection 在 MMDiT 中被替代为更简单的残差连接
