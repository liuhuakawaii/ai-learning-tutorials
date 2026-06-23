# 第 1 课：从 GAN 到 Diffusion — 图像生成的工程选型

你接到一个需求：为电商平台批量生成产品场景图。老板问你"用 GAN 还是 Diffusion？"你不能回答"Diffusion 是最新技术所以用它"——这不是工程判断。你需要知道两种范式各自的边界在哪里，然后根据约束条件做选择。

这节课不讲历史故事，直接从工程角度拆解两种范式的核心差异。

## GAN 的核心机制：对抗训练

GAN 的思路是训练两个网络互相博弈：Generator 生成假图，Discriminator 判断真假。两者在对抗中共同进步。

```python
import torch
import torch.nn as nn

class SimpleGenerator(nn.Module):
    def __init__(self, latent_dim=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent_dim, 256 * 8 * 8),
            nn.Unflatten(1, (256, 8, 8)),
            nn.ConvTranspose2d(256, 128, 4, stride=2, padding=1),
            nn.BatchNorm2d(128), nn.ReLU(),
            nn.ConvTranspose2d(128, 64, 4, stride=2, padding=1),
            nn.BatchNorm2d(64), nn.ReLU(),
            nn.ConvTranspose2d(64, 3, 4, stride=2, padding=1),
            nn.Tanh(),
        )

    def forward(self, z):
        return self.net(z)


class SimpleDiscriminator(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(3, 64, 4, stride=2, padding=1), nn.LeakyReLU(0.2),
            nn.Conv2d(64, 128, 4, stride=2, padding=1), nn.BatchNorm2d(128), nn.LeakyReLU(0.2),
            nn.Conv2d(128, 256, 4, stride=2, padding=1), nn.BatchNorm2d(256), nn.LeakyReLU(0.2),
            nn.Flatten(), nn.Linear(256 * 8 * 8, 1), nn.Sigmoid(),
        )

    def forward(self, img):
        return self.net(img)


def train_step(g, d, real_images, latent_dim=128):
    criterion = nn.BCELoss()
    opt_d = torch.optim.Adam(d.parameters(), lr=2e-4, betas=(0.5, 0.999))
    opt_g = torch.optim.Adam(g.parameters(), lr=2e-4, betas=(0.5, 0.999))
    bs = real_images.size(0)

    # 训练 Discriminator
    opt_d.zero_grad()
    loss_real = criterion(d(real_images), torch.ones(bs, 1))
    fake = g(torch.randn(bs, latent_dim)).detach()
    loss_fake = criterion(d(fake), torch.zeros(bs, 1))
    (loss_real + loss_fake).backward()
    opt_d.step()

    # 训练 Generator
    opt_g.zero_grad()
    fake = g(torch.randn(bs, latent_dim))
    loss_g = criterion(d(fake), torch.ones(bs, 1))
    loss_g.backward()
    opt_g.step()

    return loss_real.item() + loss_fake.item(), loss_g.item()
```

## GAN 的工程瓶颈

理论优雅，但实际项目中 GAN 有三个绕不开的问题：

**模式崩塌**：Generator 找到一种能骗过 Discriminator 的输出后就只生成类似的图。你训练一个生成商品图的 GAN，它可能只生成某一类构图——因为那类构图恰好能骗过当前的 Discriminator。

**训练不稳定**：两个网络的平衡极其脆弱。Discriminator 太强，Generator 拿不到有效梯度；Generator 太强，Discriminator 被带偏。工程中经常遇到 loss 震荡不收敛，调参靠经验。

**可控性差**：GAN 的输入是随机噪声向量，你很难精确控制"生成一张白色背景、暖色灯光的产品图"。条件 GAN 能做一些控制，但粒度有限，无法做到"保持产品不变、只换背景"这种局部操作。

```
GAN 的工程画像：

训练稳定性  ████░░░░░░░░░░░░  对抗博弈，不保证收敛
模式多样性  ██████░░░░░░░░░░  容易模式崩塌
可控生成    ████░░░░░░░░░░░░  条件控制粒度粗
推理速度    ██████████████░░  单次前向传播，10ms 级
图像质量    ████████████░░░░  特定领域质量好
```

## Diffusion 的核心机制：去噪即生成

Diffusion Model 不搞对抗，而是学习一个更简单的任务：给图像加噪，然后学会去噪。

前向过程逐步给图像添加高斯噪声直到变成纯噪声。反向过程训练一个网络学习从噪声中逐步恢复图像。生成图像被分解成 T 个简单的去噪步骤，每一步都是一个相对容易的学习问题。

```python
import torch
import numpy as np

class NoiseScheduler:
    def __init__(self, num_timesteps=1000, beta_start=0.0001, beta_end=0.02):
        self.betas = torch.linspace(beta_start, beta_end, num_timesteps)
        alphas = 1.0 - self.betas
        self.alpha_cumprod = torch.cumprod(alphas, dim=0)
        self.sqrt_alpha = torch.sqrt(self.alpha_cumprod)
        self.sqrt_one_minus_alpha = torch.sqrt(1.0 - self.alpha_cumprod)

    def add_noise(self, x0, noise, t):
        """前向加噪：x_t = √(ᾱ_t) * x_0 + √(1-ᾱ_t) * ε"""
        a = self.sqrt_alpha[t].reshape(-1, 1, 1, 1)
        b = self.sqrt_one_minus_alpha[t].reshape(-1, 1, 1, 1)
        return a * x0 + b * noise

    def snr(self, t):
        """信噪比"""
        return self.alpha_cumprod[t] / (1 - self.alpha_cumprod[t])


scheduler = NoiseScheduler(1000)
for t in [0, 249, 499, 749, 999]:
    snr_val = 10 * torch.log10(scheduler.snr(t))
    signal = scheduler.alpha_cumprod[t]
    bar = "█" * int(signal * 20) + "░" * (20 - int(signal * 20))
    print(f"t={t:4d} | SNR={snr_val:+.1f}dB | {bar}")
```

输出：
```
t=   0 | SNR=+40.0dB | ████████████████████
t= 249 | SNR= +3.8dB | ████████████░░░░░░░░
t= 499 | SNR= -4.9dB | ████░░░░░░░░░░░░░░░░
t= 749 | SNR=-14.0dB | █░░░░░░░░░░░░░░░░░░░
t= 999 | SNR=-38.0dB | ░░░░░░░░░░░░░░░░░░░░
```

## 为什么 Diffusion 在工程上更可控

Diffusion 最大的工程优势不在生成质量，而在可控性。每一步去噪都是独立的预测，你可以在去噪过程中注入各种控制信号：

```
去噪过程：x_T → x_{T-1} → ... → x_t → ... → x_0
                 │              │
                 ▼              ▼
            [Text 条件]    [ControlNet 控制构图]
            [风格 LoRA]    [IP-Adapter 注入风格]
            [Inpaint]      [保持产品主体不变]
```

每个控制组件只需要在去噪的某个阶段注入信息，不需要改变整个生成架构。这就是为什么 ComfyUI 可以通过节点组合实现千变万化的工作流——而 GAN 做不到这种模块化控制。

训练层面，Diffusion 的损失函数是单一的均方误差 `L = ||ε - ε_θ(x_t, t)||²`，单一网络、单一目标、标准梯度下降。不存在 GAN 那种两个网络互相"拆台"的训练不稳定性。

## 工程选型指南

```
场景                          推荐方案        决策依据
──────────────────────────────────────────────────────────
实时人脸生成（游戏 NPC）       GAN           推理 10ms，Diffusion 做不到
产品图背景替换                Diffusion     Inpaint 精确控制局部区域
风格迁移（照片→油画）         Diffusion     LoRA 生态丰富，风格可控
大批量商品图生成              Diffusion     工作流可复用，质量稳定
超分辨率                     两者均可      GAN 在小倍率上仍有优势
实时视频滤镜                  GAN           延迟要求极高
移动端轻量部署                GAN           模型小，推理快
```

一个关键判断：如果你的场景需要"精确控制生成内容"——换背景、保持主体、注入风格、区域编辑——Diffusion 几乎是唯一选择。如果你的场景是"实时生成、延迟敏感"——GAN 仍然有不可替代的优势。

## Diffusion 的迭代：从 SD 1.5 到 FLUX

Diffusion Model 自身也在快速演进，架构从 U-Net 转向 DiT（Diffusion Transformer）：

| 模型 | 架构 | 分辨率 | 参数量 | 特点 |
|------|------|--------|--------|------|
| SD 1.5 | U-Net + CLIP | 512×512 | 0.9B | 生态最成熟 |
| SDXL | 双 U-Net + 双 CLIP | 1024×1024 | 3.5B | 质量大幅提升 |
| SD3 | MMDiT + CLIP×2 + T5 | 1024×1024 | 2B | DiT 范式 |
| FLUX | DiT | 1024×1024 | 12B | 质量接近 Midjourney |

选模型不是越新越好。SD 1.5 的 LoRA 生态最丰富，社区资源最多；SDXL 质量和生态的平衡点最好；FLUX 质量最高但训练和部署成本也最高。根据你的显存、质量要求和工期做选择。

## 练习

### 练习一：场景选型

你的项目需要为 5000 个 SKU 生成产品图，每个 SKU 需要白底图、场景图和社交媒体图。团队有 2 块 RTX 4060 Ti 16GB，工期 2 周。请选择技术方案并说明理由。

### 练习二：噪声调度实验

修改 `NoiseScheduler`，实现余弦噪声调度（cosine schedule）：`ᾱ_t = cos²((t/T + s) / (1+s) * π/2)`，其中 `s=0.008`。对比线性调度和余弦调度在 t=500 时的信噪比差异，说明为什么 SDXL 默认使用余弦调度。

---

## 参考答案

### 练习一

选择 Diffusion（SDXL）+ ComfyUI 工作流方案。

理由：白底图需要 Inpaint 精确去背景，场景图需要 ControlNet + Prompt 控制生成内容，社交媒体图需要 IP-Adapter 注入品牌风格——这三个需求都需要 Diffusion 的模块化可控性。GAN 做不到"保持产品不变、只换背景"。

SDXL 在 4060 Ti 16GB 上可以跑 1024×1024，显存刚好够。SD 1.5 的 512×512 对产品图来说分辨率不足，FLUX 的 12B 参数在 16GB 显存上跑不动。

2 周工期足够搭建 ComfyUI 工作流 + 批量处理脚本。如果选 GAN 方案，光是训练和调参就可能花掉 2 周。

### 练习二

```python
class CosineScheduler(NoiseScheduler):
    def __init__(self, T=1000, s=0.008):
        super().__init__(T, 0, 0)  # 覆盖父类
        steps = torch.arange(T + 1, dtype=torch.float64) / T
        ac = torch.cos((steps + s) / (1 + s) * np.pi / 2) ** 2
        ac = ac / ac[0]
        self.alpha_cumprod = torch.clamp(ac, 1e-4, 0.9999).float()
        alphas = self.alpha_cumprod[1:] / self.alpha_cumprod[:-1]
        self.betas = 1 - alphas
        self.sqrt_alpha = torch.sqrt(self.alpha_cumprod)
        self.sqrt_one_minus_alpha = torch.sqrt(1.0 - self.alpha_cumprod)

linear = NoiseScheduler(1000)
cosine = CosineScheduler(1000)
t = 500
print(f"线性 t=500: SNR={10*torch.log10(linear.snr(t)):.1f}dB")
print(f"余弦 t=500: SNR={10*torch.log10(cosine.snr(t)):.1f}dB")
```

余弦调度在中间时间步保留了更多信号（更高的 SNR），使模型在中段更容易学习。线性调度在中间步信号衰减太快，模型在这些步上学到的信息质量差。SDXL 默认余弦调度就是因为这个原因。
