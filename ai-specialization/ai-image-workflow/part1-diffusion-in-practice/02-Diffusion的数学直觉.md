# 第 2 课：Diffusion 的数学直觉 — 不推公式，理解本质

## 场景引入

上一课我们了解了 Diffusion Model 的基本思想：加噪 → 学去噪 → 生成图像。但当你真正开始调参、选择采样器、或者理解 LoRA 训练原理时，会发现一堆数学符号挡在面前——β_t、α_t、ε_θ、v-prediction……

很多人在这里卡住：要么硬背公式（用时就忘），要么跳过数学（踩坑无数）。本课的目标是第三条路：**建立直觉**。我们不推导严格的数学证明，而是通过可视化和类比，让你真正"感受到"这些公式在做什么。

## 学习目标

完成本课后，你将能够：
1. 理解前向扩散过程的马尔可夫链结构
2. 解释 α_t、β_t、ᾱ_t 的物理含义
3. 理解三种预测目标（noise/x₀/v-prediction）的区别与适用场景
4. 掌握 DDPM 采样的核心公式
5. 在实践中根据这些直觉做出正确决策

## 一、前向过程：图像如何变成噪声

### 1.1 马尔可夫链视角

前向扩散是一个马尔可夫过程——每一步只依赖上一步的状态：

```
x₀ → x₁ → x₂ → ... → x_T
 │     │     │           │
 加噪  加噪  加噪       加噪

每一步：x_t = √(1-β_t) * x_{t-1} + √(β_t) * ε

其中 β_t 是噪声强度（很小的数，如 0.0001 到 0.02）
```

类比：想象你在往一杯清水里逐滴滴墨水。每一滴墨水让水变黑一点点。β_t 就是每滴墨水的浓度。

### 1.2 关键参数的直觉

```python
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

def visualize_noise_schedule():
    """可视化噪声调度参数的含义"""
    timesteps = 1000

    # 线性调度
    betas = torch.linspace(0.0001, 0.02, timesteps)
    alphas = 1.0 - betas
    alpha_cumprod = torch.cumprod(alphas, dim=0)

    fig, axes = plt.subplots(2, 2, figsize=(12, 10))

    # β_t：每步添加的噪声强度
    axes[0, 0].plot(betas.numpy())
    axes[0, 0].set_title('β_t: 每步噪声强度')
    axes[0, 0].set_xlabel('时间步 t')
    axes[0, 0].set_ylabel('β_t')
    axes[0, 0].annotate('噪声强度线性增长\n前几步几乎不加噪\n后几步大幅加噪',
                        xy=(500, 0.01), fontsize=10,
                        bbox=dict(boxstyle='round', facecolor='yellow', alpha=0.5))

    # α_t：每步保留的信号比例
    axes[0, 1].plot(alphas.numpy())
    axes[0, 1].set_title('α_t = 1 - β_t: 每步信号保留比例')
    axes[0, 1].set_xlabel('时间步 t')
    axes[0, 1].set_ylabel('α_t')

    # ᾱ_t：累积信号保留比例（核心参数）
    axes[1, 0].plot(alpha_cumprod.numpy())
    axes[1, 0].set_title('ᾱ_t = ∏α_s: 累积信号保留比例（最重要）')
    axes[1, 0].set_xlabel('时间步 t')
    axes[1, 0].set_ylabel('ᾱ_t')
    axes[1, 0].annotate('ᾱ_t 决定了 x_t 中\n还剩多少原始图像信号',
                        xy=(500, 0.5), fontsize=10,
                        bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.5))

    # 信噪比 SNR
    snr = 10 * torch.log10(alpha_cumprod / (1 - alpha_cumprod))
    axes[1, 1].plot(snr.numpy())
    axes[1, 1].set_title('信噪比 SNR (dB)')
    axes[1, 1].set_xlabel('时间步 t')
    axes[1, 1].set_ylabel('SNR (dB)')
    axes[1, 1].axhline(y=0, color='r', linestyle='--', alpha=0.5)
    axes[1, 1].annotate('SNR=0 时信号=噪声\n此时图像已经面目全非',
                        xy=(500, 0), fontsize=10,
                        bbox=dict(boxstyle='round', facecolor='lightcoral', alpha=0.5))

    plt.tight_layout()
    plt.savefig('noise_schedule_visualization.png', dpi=100)
    print("可视化已保存到 noise_schedule_visualization.png")

visualize_noise_schedule()
```

### 1.3 直接跳步公式

前向过程有一个非常重要的性质——可以直接从 x₀ 跳到任意 x_t，不需要逐步加噪：

```
x_t = √(ᾱ_t) * x₀ + √(1-ᾱ_t) * ε

其中：
- √(ᾱ_t) * x₀  → 原始图像的"残影"，随 t 增大而减弱
- √(1-ᾱ_t) * ε → 添加的噪声，随 t 增大而增强
- 两者之和始终是标准正态分布的缩放
```

这个公式是训练 Diffusion Model 的基础——它让我们可以随机采样时间步 t，一步到位地构造训练数据。

## 二、反向过程：从噪声恢复图像

### 2.1 为什么反向过程可行

前向过程是已知的（我们自己加的噪声），但反向过程需要学习。关键洞察是：当 β_t 足够小时，反向过程也是高斯分布，只需要学习均值和方差。

```
前向：q(x_t | x_{t-1}) = N(x_t; √(1-β_t)x_{t-1}, β_t I)   → 已知
反向：p(x_{t-1} | x_t) = N(x_{t-1}; μ_θ(x_t, t), Σ_θ(x_t, t)) → 需要学习
```

神经网络的任务就是预测 μ_θ（均值）和 Σ_θ（方差）。实践中，方差通常用预设值，网络只预测均值。

### 2.2 三种预测目标的直觉

网络可以学习预测不同的东西，但它们在数学上是等价的：

```python
def demonstrate_prediction_targets():
    """展示三种预测目标的等价性"""
    # 假设的已知量
    x_0 = torch.randn(1, 3, 64, 64)      # 原始图像
    epsilon = torch.randn_like(x_0)       # 添加的噪声
    t = 500                                # 时间步
    alpha_cumprod_t = 0.5                  # 假设 ᾱ_500 = 0.5

    # x_t 的构造
    x_t = torch.sqrt(alpha_cumprod_t) * x_0 + torch.sqrt(1 - alpha_cumprod_t) * epsilon

    # ── 目标 1：预测噪声 ε ──
    # 网络输入 x_t，输出预测的噪声
    predicted_epsilon = epsilon  # 理想情况
    predicted_x0_from_eps = (x_t - torch.sqrt(1 - alpha_cumprod_t) * predicted_epsilon) / torch.sqrt(alpha_cumprod_t)

    # ── 目标 2：直接预测 x₀ ──
    # 网络输入 x_t，输出预测的原始图像
    predicted_x0 = x_0  # 理想情况
    predicted_eps_from_x0 = (x_t - torch.sqrt(alpha_cumprod_t) * predicted_x0) / torch.sqrt(1 - alpha_cumprod_t)

    # ── 目标 3：预测 v ──
    # v = √(ᾱ_t) * ε - √(1-ᾱ_t) * x₀
    v = torch.sqrt(alpha_cumprod_t) * epsilon - torch.sqrt(1 - alpha_cumprod_t) * x_0
    predicted_v = v  # 理想情况
    predicted_x0_from_v = torch.sqrt(alpha_cumprod_t) * x_t - torch.sqrt(1 - alpha_cumprod_t) * predicted_v
    predicted_eps_from_v = torch.sqrt(1 - alpha_cumprod_t) * x_t + torch.sqrt(alpha_cumprod_t) * predicted_v

    print("三种预测目标的等价性验证：")
    print(f"  从 ε 预测 x₀ 的误差: {(predicted_x0_from_eps - x_0).abs().mean():.6f}")
    print(f"  从 x₀ 预测 ε 的误差: {(predicted_eps_from_x0 - epsilon).abs().mean():.6f}")
    print(f"  从 v 预测 x₀ 的误差:  {(predicted_x0_from_v - x_0).abs().mean():.6f}")
    print(f"  从 v 预测 ε 的误差:   {(predicted_eps_from_v - epsilon).abs().mean():.6f}")

demonstrate_prediction_targets()
```

**三种目标的选择**：

```
预测目标    适用场景                      直觉理解
─────────────────────────────────────────────────────────
ε (噪声)    SD 1.5/2.1 默认              "告诉我加了什么噪声"
x₀ (图像)   早期 DDPM，适合理解           "告诉我原图长什么样"
v (速度)    SDXL 默认，训练更稳定         "告诉我信号和噪声的混合方向"
```

v-prediction 的好处是：当 t 接近 T 时，x₀ 的信息几乎为零，预测 x₀ 很困难；而 v 在整个时间范围内都有稳定的信号。

## 三、训练过程：网络在学什么

### 3.1 训练循环的完整代码

```python
import torch
import torch.nn as nn

class DiffusionTrainer:
    """Diffusion Model 训练器 — 展示训练的核心逻辑"""

    def __init__(self, model, noise_scheduler, prediction_target='epsilon'):
        self.model = model
        self.scheduler = noise_scheduler
        self.prediction_target = prediction_target

    def training_step(self, clean_images):
        """单步训练：
        1. 随机采样时间步 t
        2. 随机生成噪声 ε
        3. 构造 x_t = √(ᾱ_t) * x₀ + √(1-ᾱ_t) * ε
        4. 让网络预测目标
        5. 计算损失
        """
        batch_size = clean_images.shape[0]
        device = clean_images.device

        # 1. 随机采样时间步（每个样本独立）
        timesteps = torch.randint(
            0, self.scheduler.num_timesteps, (batch_size,), device=device
        )

        # 2. 随机生成噪声
        noise = torch.randn_like(clean_images)

        # 3. 构造含噪图像 x_t
        noisy_images = self.scheduler.add_noise(clean_images, noise, timesteps)

        # 4. 网络预测
        model_output = self.model(noisy_images, timesteps)

        # 5. 根据预测目标计算损失
        if self.prediction_target == 'epsilon':
            target = noise
        elif self.prediction_target == 'x0':
            target = clean_images
        elif self.prediction_target == 'v':
            alpha = self.scheduler.sqrt_alpha_cumprod[timesteps].reshape(-1, 1, 1, 1)
            sqrt_one_minus_alpha = self.scheduler.sqrt_one_minus_alpha_cumprod[timesteps].reshape(-1, 1, 1, 1)
            target = alpha * noise - sqrt_one_minus_alpha * clean_images

        loss = nn.functional.mse_loss(model_output, target)
        return loss
```

### 3.2 训练中的时间步嵌入

网络需要知道当前处于哪个时间步，因为不同时间步的任务难度完全不同：

```python
class TimestepEmbedding(nn.Module):
    """时间步嵌入 — 将离散时间步转化为网络可用的连续向量

    使用正弦位置编码（和 Transformer 一样），因为：
    1. 相邻时间步的嵌入应该相似（连续性）
    2. 不同时间步的嵌入应该有区分度（可分辨性）
    """

    def __init__(self, dim=256):
        super().__init__()
        self.dim = dim
        self.mlp = nn.Sequential(
            nn.Linear(dim, dim * 4),
            nn.GELU(),
            nn.Linear(dim * 4, dim),
        )

    def forward(self, timesteps):
        half_dim = self.dim // 2
        # 正弦编码的频率：从高频到低频
        frequencies = torch.exp(
            torch.arange(half_dim, device=timesteps.device, dtype=torch.float32)
            * -(torch.log(torch.tensor(10000.0)) / half_dim)
        )
        # 时间步 × 频率 → 正弦和余弦
        arguments = timesteps[:, None].float() * frequencies[None, :]
        embedding = torch.cat([torch.cos(arguments), torch.sin(arguments)], dim=-1)
        return self.mlp(embedding)
```

时间步嵌入的直觉：t=0 的嵌入告诉网络"几乎不需要去噪，只需微调"；t=999 的嵌入告诉网络"全是噪声，需要大胆重建"。

## 四、采样过程：从噪声生成图像

### 4.1 DDPM 采样算法

```python
def ddpm_sample(model, scheduler, shape, device):
    """DDPM 采样：从纯噪声逐步生成图像

    核心循环：
    for t = T-1, T-2, ..., 0:
        1. 网络预测噪声
        2. 计算 x_{t-1} 的均值
        3. 添加随机噪声（最后一步除外）
    """
    # 从纯噪声开始
    x_t = torch.randn(shape, device=device)

    for t in reversed(range(scheduler.num_timesteps)):
        t_batch = torch.full((shape[0],), t, device=device, dtype=torch.long)

        # 网络预测噪声
        predicted_noise = model(x_t, t_batch)

        # 计算均值（简化版，省略方差处理）
        beta_t = scheduler.betas[t]
        alpha_t = scheduler.alphas[t]
        alpha_cumprod_t = scheduler.alpha_cumprod[t]

        # 从预测的噪声反推 x_0
        predicted_x0 = (
            x_t - torch.sqrt(1 - alpha_cumprod_t) * predicted_noise
        ) / torch.sqrt(alpha_cumprod_t)

        # 计算前一步的均值
        mean = (
            torch.sqrt(alpha_t) * (1 - alpha_cumprod_t / alpha_t) * x_t
            + torch.sqrt(alpha_cumprod_t / alpha_t) * beta_t * predicted_x0
        ) / (1 - alpha_cumprod_t / alpha_t)

        # 添加噪声（最后一步不加）
        if t > 0:
            noise = torch.randn_like(x_t)
            x_t = mean + torch.sqrt(beta_t) * noise
        else:
            x_t = mean

    return x_t
```

### 4.2 采样速度的关键洞察

DDPM 需要 1000 步采样，每一步都要运行一次神经网络前向传播。这是工程上的主要瓶颈。

为什么需要这么多步？因为数学推导假设了 β_t 足够小（小到反向过程可以近似为高斯分布）。如果我们增大 β_t（减少总步数），每一步的近似误差会累积。

```
采样步数 vs 质量的 tradeoff：

1000 步  ████████████████████  最高质量，但很慢（~30s）
 200 步  ████████████████░░░░  质量下降不明显（~6s）
  50 步  ████████████░░░░░░░░  开始出现 artifacts
  20 步  ████████░░░░░░░░░░░░  质量明显下降
   5 步  ████░░░░░░░░░░░░░░░░  基本不可用（DDPM）
```

这就是为什么需要更好的采样器——下一课的主题。

## 五、常见误区

### 误区一："α_t 和 ᾱ_t 是一回事"

α_t 是单步的信号保留比例（如 0.9999），ᾱ_t 是从 0 到 t 的累积乘积。ᾱ_t 决定了 x_t 中还剩多少原始图像信息，是训练和采样中最核心的参数。

### 误区二："预测噪声和预测图像是等价的，所以选哪个都一样"

数学上等价，但数值性质不同。在高噪声区域（t 接近 T），预测噪声更容易；在低噪声区域（t 接近 0），预测图像更稳定。v-prediction 是一种折中，SDXL 采用它是因为训练更稳定。

### 误区三："理解数学不重要，会调参就行"

当你遇到生成图像模糊、色彩偏移、细节丢失等问题时，不理解数学原理就只能盲目试错。比如，理解了 ᾱ_t 的含义，你就知道为什么在高噪声阶段应该用较大的 CFG scale。

## 六、小结

本课的核心要点：

1. **前向扩散**：图像 → 噪声，由 ᾱ_t 控制信号衰减速度
2. **反向扩散**：噪声 → 图像，网络学习预测噪声/图像/v
3. **三种预测目标**数学等价但数值性质不同，v-prediction 在 SDXL 上表现最好
4. **训练核心**：随机采样 t → 加噪 → 预测 → MSE 损失
5. **采样瓶颈**：DDPM 需要很多步，需要更好的采样器

## 练习

### 练习一：参数直觉

假设 ᾱ_t = 0.25，计算此时的信噪比（SNR），并解释这个 SNR 值意味着什么。

### 练习二：训练实现

编写一个完整的训练循环，在 MNIST 数据集上训练一个简化版的 Diffusion Model（使用简单的 MLP 而非 U-Net），观察 100 个 epoch 后的生成效果。

### 练习三：预测目标对比

在相同的模型架构下，分别用 epsilon-prediction 和 v-prediction 训练 50 步，对比两者的训练 loss 曲线。哪种目标收敛更快？

---

## 参考答案

### 练习一

**思路**：SNR = 信号功率 / 噪声功率，在 Diffusion 的语境下就是 ᾱ_t / (1-ᾱ_t)。

**答案**：

```
SNR = ᾱ_t / (1 - ᾱ_t) = 0.25 / 0.75 = 1/3 ≈ 0.333
SNR_dB = 10 * log10(1/3) ≈ -4.77 dB
```

SNR = 1/3 意味着此时噪声功率是信号功率的 3 倍。图像已经被噪声严重淹没，但仍有 25% 的原始信号残留在 x_t 中。

这个时间步大约在 t=500（对于 1000 步线性调度），是训练的关键转折点——网络需要同时利用信号残影和语义知识来恢复图像。

**要点**：
- SNR > 0 dB：信号强于噪声，去噪相对容易
- SNR = 0 dB：信号等于噪声，图像已面目全非
- SNR < 0 dB：噪声主导，网络需要更多"想象力"

### 练习二

**思路**：使用最简单的 MLP 架构，在 MNIST 上验证 Diffusion 的基本原理。

**答案**：

```python
import torch
import torch.nn as nn
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

class SimpleDiffusionMLP(nn.Module):
    """简化版 Diffusion Model — 用 MLP 替代 U-Net"""
    def __init__(self, image_dim=784, time_dim=128, hidden_dim=512):
        super().__init__()
        self.time_embed = nn.Sequential(
            nn.Linear(1, time_dim),
            nn.SiLU(),
            nn.Linear(time_dim, time_dim),
        )
        self.network = nn.Sequential(
            nn.Linear(image_dim + time_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, image_dim),
        )

    def forward(self, x_t, t):
        t_emb = self.time_embed(t.float().unsqueeze(-1) / 1000)
        x = torch.cat([x_t, t_emb], dim=-1)
        return self.network(x)

# 训练
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = SimpleDiffusionMLP().to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
scheduler = NoiseScheduler(1000)

transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,)),  # 归一化到 [-1, 1]
])
dataset = datasets.MNIST('./data', train=True, download=True, transform=transform)
dataloader = DataLoader(dataset, batch_size=128, shuffle=True)

for epoch in range(100):
    total_loss = 0
    for images, _ in dataloader:
        images = images.view(images.size(0), -1).to(device)  # 展平

        t = torch.randint(0, 1000, (images.size(0),), device=device)
        noise = torch.randn_like(images)
        x_t = scheduler.add_noise(images, noise, t)

        predicted = model(x_t, t)
        loss = nn.functional.mse_loss(predicted, noise)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    if (epoch + 1) % 20 == 0:
        print(f"Epoch {epoch+1}, Loss: {total_loss / len(dataloader):.4f}")
```

**要点**：
- MLP 只能生成 28×28 的小图，但足以验证原理
- 训练 100 步后 loss 应该明显下降
- 生成质量取决于模型容量和训练步数

### 练习三

**思路**：修改 `DiffusionTrainer` 的 `prediction_target` 参数，记录两种目标的 loss 曲线。

**答案**：

```python
def compare_prediction_targets():
    """对比 epsilon-prediction 和 v-prediction 的训练动态"""
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    results = {}
    for target in ['epsilon', 'v']:
        model = SimpleDiffusionMLP().to(device)
        optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
        scheduler = NoiseScheduler(1000)
        trainer = DiffusionTrainer(model, scheduler, prediction_target=target)

        losses = []
        for epoch in range(50):
            epoch_loss = 0
            for images, _ in dataloader:
                images = images.view(images.size(0), -1).to(device)
                loss = trainer.training_step(images)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()
            losses.append(epoch_loss / len(dataloader))
        results[target] = losses
        print(f"{target}: final loss = {losses[-1]:.4f}")

    return results
```

通常 v-prediction 在训练早期 loss 下降更快，因为它的目标在不同时间步的尺度更一致。

**要点**：
- v-prediction 的 loss 曲线更平滑
- epsilon-prediction 在高噪声时间步可能 loss 波动较大
- 两种目标最终生成质量相近，但 v-prediction 训练更稳定
