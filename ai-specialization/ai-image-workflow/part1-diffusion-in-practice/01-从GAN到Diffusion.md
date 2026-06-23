# 第 1 课：从 GAN 到 Diffusion — 图像生成范式的演进

## 场景引入

2014 年，Ian Goodfellow 提出 GAN（生成对抗网络），一夜之间让 AI 生成图像从"模糊马赛克"变成了"勉强能看"。此后八年，GAN 几乎垄断了图像生成领域——StyleGAN 生成的人脸骗过了人类，CycleGAN 让照片变成了莫奈的画。

但到了 2022 年，Stable Diffusion 横空出世，几个月内用户破亿。为什么 Diffusion Model 能取代 GAN 成为主流？这不仅仅是技术迭代，更是一次生成范式的根本转变。

本课将带你从工程实践的角度理解这个转变——不是为了考试背概念，而是为了在实际项目中做出正确的技术选型。

## 学习目标

完成本课后，你将能够：
1. 解释 GAN 和 Diffusion Model 的核心工作原理
2. 对比两种范式在训练稳定性、生成质量、可控性上的差异
3. 理解 Diffusion Model 为何在 2022 年后成为主流
4. 在项目场景中做出 GAN vs Diffusion 的技术选型

## 一、GAN 的核心思想：以假乱真的博弈

### 1.1 对抗训练的基本结构

GAN 的核心思想极其优雅：训练两个网络互相博弈。

```
┌─────────────────────────────────────────────────┐
│                  GAN 训练循环                      │
│                                                   │
│   随机噪声 z ──→ [Generator] ──→ 生成图像          │
│                                      │            │
│                                      ▼            │
│                              [Discriminator]      │
│                                  │    │           │
│                           真实图像┘    │           │
│                                      ▼            │
│                              真/假判断             │
│                                      │            │
│                    ┌─────────────────┤            │
│                    ▼                 ▼            │
│            更新 Generator     更新 Discriminator   │
└─────────────────────────────────────────────────┘
```

Generator（生成器）的目标是生成足以骗过 Discriminator 的图像；Discriminator（判别器）的目标是准确区分真实图像和生成图像。两者在对抗中共同进步。

用代码来表达这个核心逻辑：

```python
import torch
import torch.nn as nn

class SimpleGenerator(nn.Module):
    def __init__(self, latent_dim=128, output_channels=3):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(latent_dim, 256 * 8 * 8),
            nn.Unflatten(1, (256, 8, 8)),
            nn.ConvTranspose2d(256, 128, 4, stride=2, padding=1),  # 16x16
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.ConvTranspose2d(128, 64, 4, stride=2, padding=1),   # 32x32
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.ConvTranspose2d(64, 3, 4, stride=2, padding=1),     # 64x64
            nn.Tanh()
        )

    def forward(self, z):
        return self.network(z)

class SimpleDiscriminator(nn.Module):
    def __init__(self, input_channels=3):
        super().__init__()
        self.network = nn.Sequential(
            nn.Conv2d(input_channels, 64, 4, stride=2, padding=1),  # 32x32
            nn.LeakyReLU(0.2),
            nn.Conv2d(64, 128, 4, stride=2, padding=1),             # 16x16
            nn.BatchNorm2d(128),
            nn.LeakyReLU(0.2),
            nn.Conv2d(128, 256, 4, stride=2, padding=1),            # 8x8
            nn.BatchNorm2d(256),
            nn.LeakyReLU(0.2),
            nn.Flatten(),
            nn.Linear(256 * 8 * 8, 1),
            nn.Sigmoid()
        )

    def forward(self, image):
        return self.network(image)

def train_gan_step(generator, discriminator, real_images, batch_size=32):
    """单步 GAN 训练 — 展示对抗博弈的核心逻辑"""
    latent_dim = 128
    criterion = nn.BCELoss()
    optim_g = torch.optim.Adam(generator.parameters(), lr=2e-4, betas=(0.5, 0.999))
    optim_d = torch.optim.Adam(discriminator.parameters(), lr=2e-4, betas=(0.5, 0.999))

    real_label = torch.ones(batch_size, 1)
    fake_label = torch.zeros(batch_size, 1)

    # ── 训练 Discriminator：让它更擅长区分真假 ──
    optim_d.zero_grad()

    # 真实图像应该被判为真
    real_output = discriminator(real_images)
    loss_d_real = criterion(real_output, real_label)

    # 生成图像应该被判为假
    noise = torch.randn(batch_size, latent_dim)
    fake_images = generator(noise).detach()  # detach 避免梯度回传到 Generator
    fake_output = discriminator(fake_images)
    loss_d_fake = criterion(fake_output, fake_label)

    loss_d = loss_d_real + loss_d_fake
    loss_d.backward()
    optim_d.step()

    # ── 训练 Generator：让它更擅长骗过 Discriminator ──
    optim_g.zero_grad()
    noise = torch.randn(batch_size, latent_dim)
    fake_images = generator(noise)
    fake_output = discriminator(fake_images)
    loss_g = criterion(fake_output, real_label)  # Generator 希望被判为真
    loss_g.backward()
    optim_g.step()

    return loss_d.item(), loss_g.item()
```

### 1.2 GAN 的工程痛点

理论上 GAN 很优雅，但在实际工程中，它有几个致命问题：

**模式崩塌（Mode Collapse）**：Generator 找到一种能骗过 Discriminator 的输出后，就只生成类似的图像，丧失多样性。想象你训练一个生成猫图的 GAN，结果它只生成橘猫——因为橘猫恰好能骗过当前的 Discriminator。

**训练不稳定**：两个网络的平衡非常脆弱。Discriminator 太强，Generator 拿不到有效梯度；Generator 太强，Discriminator 被带偏。工程中经常遇到 loss 震荡不收敛的情况。

**难以控制生成内容**：GAN 的输入是随机噪声向量，你很难精确控制"生成一张红色背景、穿蓝色西装的人像"。虽然有条件 GAN，但控制粒度有限。

```
GAN 的工程困境：

训练稳定性    ████████░░░░░░░░  不稳定，需要精细调参
模式多样性    ██████░░░░░░░░░░  容易模式崩塌
可控生成      ████░░░░░░░░░░░░  条件控制粒度粗
图像质量      ████████████░░░░  质量好但上限受限
训练效率      ██████████░░░░░░  中等
```

## 二、Diffusion Model 的核心思想：去噪即生成

### 2.1 从噪声中恢复图像

Diffusion Model 的思路完全不同。它不搞对抗，而是学习一个更简单的任务：**给图像加噪，然后学会去噪**。

前向过程（加噪）：逐步给图像添加高斯噪声，直到变成纯噪声。

```
原始图像 → 加噪 → 加噪 → 加噪 → ... → 纯噪声
  x₀    →  x₁  →  x₂  →  x₃  → ... →  x_T

每一步：x_t = √(α_t) * x_{t-1} + √(1-α_t) * ε
其中 ε ~ N(0, I)，α_t 是预定义的噪声调度
```

反向过程（去噪）：训练一个网络，学习从 x_t 预测 x_{t-1}，即逐步去除噪声。

```
纯噪声 → 去噪 → 去噪 → 去噪 → ... → 生成图像
  x_T  → x_{T-1} → x_{T-2} → ... →  x₀

网络学习的目标：预测每一步添加的噪声 ε
损失函数：L = ||ε - ε_θ(x_t, t)||²
```

这个思路的精妙之处在于：生成图像被分解成了 T 个简单的去噪步骤，每一步都是一个相对容易的学习问题。

### 2.2 用代码理解前向扩散

```python
import torch
import numpy as np

class NoiseScheduler:
    """噪声调度器 — 控制加噪和去噪的过程"""

    def __init__(self, num_timesteps=1000, beta_start=0.0001, beta_end=0.02):
        self.num_timesteps = num_timesteps
        # 线性噪声调度：beta 从 0.0001 线性增长到 0.02
        self.betas = torch.linspace(beta_start, beta_end, num_timesteps)
        self.alphas = 1.0 - self.betas
        self.alpha_cumprod = torch.cumprod(self.alphas, dim=0)  # ᾱ_t
        self.sqrt_alpha_cumprod = torch.sqrt(self.alpha_cumprod)
        self.sqrt_one_minus_alpha_cumprod = torch.sqrt(1.0 - self.alpha_cumprod)

    def add_noise(self, original_image, noise, timestep):
        """前向过程：给原始图像加噪

        数学公式：x_t = √(ᾱ_t) * x_0 + √(1-ᾱ_t) * ε
        这个公式可以直接从 x_0 跳到任意时间步，不需要逐步加噪
        """
        sqrt_alpha = self.sqrt_alpha_cumprod[timestep].reshape(-1, 1, 1, 1)
        sqrt_one_minus_alpha = self.sqrt_one_minus_alpha_cumprod[timestep].reshape(-1, 1, 1, 1)
        return sqrt_alpha * original_image + sqrt_one_minus_alpha * noise

    def sample_step(self, model_output, timestep, current_sample):
        """反向过程的单步去噪"""
        beta_t = self.betas[timestep]
        alpha_t = self.alphas[timestep]
        alpha_cumprod_t = self.alpha_cumprod[timestep]

        # 预测的 x_0
        pred_original = (
            current_sample - torch.sqrt(1 - alpha_cumprod_t) * model_output
        ) / torch.sqrt(alpha_cumprod_t)

        # 计算前一步的均值
        pred_mean = (
            torch.sqrt(alpha_t) * (1 - alpha_cumprod_t / alpha_t) * current_sample
            + torch.sqrt(alpha_cumprod_t / alpha_t) * beta_t * pred_original
        ) / (1 - alpha_cumprod_t / alpha_t)

        if timestep > 0:
            noise = torch.randn_like(current_sample)
            return pred_mean + torch.sqrt(beta_t) * noise
        return pred_mean


def demonstrate_forward_diffusion():
    """演示前向扩散过程 — 看看图像如何逐渐变成噪声"""
    scheduler = NoiseScheduler(num_timesteps=1000)

    # 模拟一张 64x64 的图像
    original = torch.randn(1, 3, 64, 64)  # 假设是归一化后的图像

    print("前向扩散过程：图像逐渐变成噪声")
    print("=" * 50)

    for t in [0, 99, 249, 499, 749, 999]:
        noise = torch.randn_like(original)
        noisy_image = scheduler.add_noise(original, noise, t)

        # 计算信噪比（SNR）
        signal_power = scheduler.alpha_cumprod[t]
        noise_power = 1 - scheduler.alpha_cumprod[t]
        snr = 10 * torch.log10(signal_power / noise_power)

        print(f"t={t:4d} | ᾱ_t={scheduler.alpha_cumprod[t]:.4f} | "
              f"SNR={snr.item():.1f}dB | "
              f"信号占比={'█' * int(signal_power * 20)}{'░' * (20 - int(signal_power * 20))}")

demonstrate_forward_diffusion()
```

运行输出（示意）：
```
前向扩散过程：图像逐渐变成噪声
==================================================
t=   0 | ᾱ_t=0.9999 | SNR=40.0dB | 信号占比=████████████████████
t=  99 | ᾱ_t=0.8822 | SNR=8.7dB  | 信号占比=█████████████████░░░
t= 249 | ᾱ_t=0.5985 | SNR=3.8dB  | 信号占比=████████████░░░░░░░░
t= 499 | ᾱ_t=0.2051 | SNR=-4.9dB | 信号占比=████░░░░░░░░░░░░░░░░
t= 749 | ᾱ_t=0.0253 | SNR=-14.0dB| 信号占比=█░░░░░░░░░░░░░░░░░░░
t= 999 | ᾱ_t=0.0001 | SNR=-38.0dB| 信号占比=░░░░░░░░░░░░░░░░░░░░
```

这个输出直观展示了前向扩散的过程：图像信号逐渐被噪声淹没。当 t=999 时，图像几乎完全变成了高斯噪声。

## 三、关键对比：为什么 Diffusion 赢了

### 3.1 训练稳定性

GAN 的训练是两个网络的博弈，本质上是一个 minimax 问题，数学上不保证收敛。而 Diffusion Model 的训练是单网络的均方误差回归，优化目标清晰，训练过程稳定。

```python
# GAN 的损失函数：对抗博弈
# min_G max_D E[log D(x)] + E[log(1 - D(G(z)))]
# → 两个网络互相"拆台"，训练动态复杂

# Diffusion 的损失函数：简单回归
# L = E[||ε - ε_θ(x_t, t)||²]
# → 单一网络，单一目标，标准梯度下降
```

### 3.2 生成可控性

这是 Diffusion Model 最大的工程优势。由于每一步去噪都是一个独立的预测，你可以在去噪过程中插入各种控制信号：

```
Diffusion 的可控性来源：

┌──────────────────────────────────────────────┐
│  去噪过程                                      │
│  x_T → x_{T-1} → ... → x_t → ... → x_0       │
│         │              │                       │
│         ▼              ▼                       │
│    [Text条件]     [ControlNet]                  │
│    [风格LoRA]     [IP-Adapter]                  │
│    [Inpaint]      [空间布局]                    │
└──────────────────────────────────────────────┘
```

每个控制组件只需要在去噪的某个阶段注入信息，不需要改变整个生成架构。这就是为什么 ComfyUI 可以通过节点组合实现千变万化的图像生成工作流。

### 3.3 工程选型指南

```
场景                          推荐方案        原因
─────────────────────────────────────────────────────
实时人脸生成（游戏NPC）        GAN           推理速度快，10ms 级
产品图背景替换                 Diffusion     可控性强，支持 Inpaint
风格迁移（照片→油画）          Diffusion     模型生态丰富
超分辨率                       两者均可      GAN 在小倍率上仍有优势
大批量商品图生成               Diffusion     工作流可复用，质量稳定
实时视频滤镜                   GAN/LightDiff  延迟要求极高
艺术创作/设计探索              Diffusion     可控性+多样性
```

## 四、2024-2025 年的技术前沿

### 4.1 从 SD 1.5 到 SD3/FLUX

Diffusion Model 自身也在快速迭代：

- **SD 1.5（2022.10）**：U-Net 架构，CLIP 文本编码器，512×512
- **SDXL（2023.7）**：双 U-Net，双 CLIP+OpenCLIP，1024×1024
- **SD3（2024.6）**：MMDiT 架构，三文本编码器（CLIP×2+T5），DiT 范式
- **FLUX（2024.8）**：Black Forest Labs 出品，DiT 架构，12B 参数，生成质量接近 Midjourney

### 4.2 GAN 并没有死

值得注意的是，GAN 在特定领域依然活跃：

- **实时生成**：GAN 的单次前向传播速度优势明显
- **轻量部署**：手机端人脸编辑、实时滤镜
- **StyleGAN3**：在人脸、汽车等特定类别上仍有顶级质量
- **混合架构**：一些新方法将 GAN 的解码器嵌入 Diffusion 流程

## 五、常见误区

### 误区一："Diffusion 比 GAN 慢，所以 GAN 更好"

推理速度确实是一个差异，但需要看具体场景。在工程实践中，图像生成的质量和可控性往往比速度更重要。而且随着蒸馏技术（如 LCM、Turbo）的发展，Diffusion 的推理速度已经大幅提升。

### 误区二："GAN 已经过时了"

GAN 在实时场景和特定领域仍有不可替代的优势。技术选型应该基于具体需求，而非追逐热点。

### 误区三："Diffusion 的数学很复杂，不需要理解"

你不需要推导每一个公式，但理解"加噪-去噪"的基本框架，以及 α_t、β_t 这些参数的物理含义，对于后续学习采样器、LoRA 训练等内容至关重要。

## 六、小结

本课的核心要点：

1. **GAN 的本质**是两个网络的对抗博弈，优雅但训练不稳定
2. **Diffusion 的本质**是学习去噪，简单但需要多步迭代
3. **Diffusion 胜出的原因**：训练稳定、可控性强、生态丰富
4. **GAN 并未消亡**，在实时场景和特定领域仍有优势
5. **技术选型**应基于具体场景需求，而非追逐热点

## 练习

### 练习一：概念辨析

解释为什么 Diffusion Model 的训练比 GAN 更稳定。从优化目标的角度分析。

### 练习二：场景选型

你的项目需要为电商平台生成 10 万张产品图，每张图需要替换背景并保持产品主体不变。你会选择 GAN 还是 Diffusion？说明理由。

### 练习三：代码实践

修改 `NoiseScheduler` 类，实现余弦噪声调度（cosine schedule）替代线性调度，并对比两种调度在 t=500 时的信噪比差异。

---

## 参考答案

### 练习一

**思路**：从优化目标的数学性质入手，对比两者的学习信号。

**答案**：

GAN 的优化目标是一个 minimax 博弈问题：
- Generator 想最小化 `log(1 - D(G(z)))`
- Discriminator 想最大化 `log D(x) + log(1 - D(G(z)))`
- 两个目标互相冲突，优化过程类似"追尾巴"，不保证收敛
- 梯度信号依赖于 Discriminator 的质量，如果 Discriminator 太弱或太强，Generator 都学不到有用信息

Diffusion Model 的优化目标是单一的均方误差：
- `L = E[||ε - ε_θ(x_t, t)||²]`
- 只有一个网络、一个损失函数、一个优化方向
- 梯度信号直接来自噪声预测误差，信号质量稳定
- 数学上是标准的凸优化问题，收敛性有保证

**要点**：
- GAN 训练不稳定的根本原因是对抗博弈的非稳态性
- Diffusion 训练稳定的根源是将生成问题转化为回归问题

### 练习二

**思路**：从可控性、批量效率、质量一致性三个维度分析。

**答案**：

选择 Diffusion Model，理由如下：

1. **可控性**：需要精确保持产品主体不变，Diffusion 的 Inpaint 技术可以精确控制生成区域，GAN 难以做到像素级的局部控制
2. **质量一致性**：10 万张图需要稳定的质量，GAN 的模式崩塌风险会导致部分图片质量异常
3. **工作流复用**：Diffusion 可以构建 ComfyUI 工作流，一次配置批量运行
4. **背景多样性**：通过 Prompt 控制可以轻松生成不同场景的背景

具体方案：使用产品图作为 Inpaint 的 mask 区域外的参考，结合 ControlNet 保持产品轮廓，用不同 Prompt 生成多样化背景。

**要点**：
- 大批量生产场景下，工作流的可复用性比单张图的生成速度更重要
- Inpaint + ControlNet 的组合是产品图处理的标准方案

### 练习三

**思路**：余弦调度使用余弦函数而非线性插值来定义噪声水平，在中间时间步有更好的信噪比过渡。

**答案**：

```python
class CosineNoiseScheduler(NoiseScheduler):
    """余弦噪声调度器"""

    def __init__(self, num_timesteps=1000, s=0.008):
        super().__init__(num_timesteps)
        self.num_timesteps = num_timesteps

        # 余弦调度：ᾱ_t = cos²((t/T + s) / (1+s) * π/2)
        steps = torch.arange(num_timesteps + 1, dtype=torch.float64) / num_timesteps
        alpha_cumprod = torch.cos((steps + s) / (1 + s) * torch.pi / 2) ** 2
        alpha_cumprod = alpha_cumprod / alpha_cumprod[0]  # 归一化

        # 裁剪防止数值问题
        self.alpha_cumprod = torch.clamp(alpha_cumprod, 0.0001, 0.9999).float()
        self.alphas = self.alpha_cumprod[1:] / self.alpha_cumprod[:-1]
        self.betas = 1 - self.alphas
        self.sqrt_alpha_cumprod = torch.sqrt(self.alpha_cumprod)
        self.sqrt_one_minus_alpha_cumprod = torch.sqrt(1.0 - self.alpha_cumprod)

# 对比
linear = NoiseScheduler(1000)
cosine = CosineNoiseScheduler(1000)

t = 500
print(f"线性调度 t=500: ᾱ_t={linear.alpha_cumprod[t]:.4f}, "
      f"SNR={10*torch.log10(linear.alpha_cumprod[t]/(1-linear.alpha_cumprod[t])):.1f}dB")
print(f"余弦调度 t=500: ᾱ_t={cosine.alpha_cumprod[t]:.4f}, "
      f"SNR={10*torch.log10(cosine.alpha_cumprod[t]/(1-cosine.alpha_cumprod[t])):.1f}dB")
```

余弦调度在中间时间步保留了更多信号（更高的 SNR），这使得模型在中段更容易学习，通常能获得更好的生成质量。

**要点**：
- 余弦调度是 SDXL 和后续模型的默认选择
- 噪声调度的选择直接影响模型在不同时间步的学习效率
- `s` 参数控制起始偏移，通常设为 0.008
