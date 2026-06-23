# 第2课：NeRF 原理与实践——神经辐射场的数学直觉与工程实现

## 场景引入

假设你手头有一个精美的手办，想在电脑里拥有它的数字副本。你拿起手机围绕它拍了50张照片，然后打开一个3D重建软件——几小时后，你可以在屏幕上从任意角度查看这个手办，包括那些你没拍到的角度，甚至能看到光线在它表面的反射。

这就是NeRF（Neural Radiance Fields，神经辐射场）的核心能力：从一组2D照片中重建出完整的3D场景，允许从任意新视角渲染出照片级真实感的图像。

在NeRF之前，从多张照片重建3D场景的传统方法——多视角立体视觉（MVS）——面临一个根本性的困难：它依赖于图像之间的像素级特征匹配，当场景包含无纹理区域（白墙）、重复纹理（瓷砖）或复杂光学效果（玻璃、金属高光）时，匹配算法会频繁失败。重建结果往往是带噪声的点云或粗糙的网格，离照片级真实感差距甚远。

2020年，UC Berkeley的Ben Mildenhall等人发表的NeRF论文彻底改变了这个局面。它的核心洞察令人意外地简洁：不显式重建几何，而是用一个神经网络学会"从空间中任意一点、沿任意方向看过去是什么颜色"。这个思路绕开了传统方法的匹配难题，用一个5层MLP就能表达包含精确反射、折射、半透明的完整场景。

但NeRF的代价同样明显：一个场景需要数小时训练，渲染一帧需要数秒。理解这个tradeoff——质量与速度的取舍——是理解后续所有3D生成技术（Instant-NGP、3DGS等）的关键前提。

## 学习目标

完成本课后，你将能够：

1. 解释体渲染（Volume Rendering）的物理基础，推导离散体渲染方程
2. 说明NeRF为什么需要位置编码，以及位置编码的数学原理
3. 描述NeRF的MLP网络结构设计及其物理含义
4. 理解分层采样（Hierarchical Sampling）如何提升采样效率
5. 使用nerfstudio完成从数据采集到NeRF训练到新视角渲染的完整流程
6. 分析NeRF的局限性，并说明Instant-NGP和Mip-NeRF的核心改进思路

## 核心概念

### 一、体渲染：NeRF的物理基础

NeRF的渲染方法不是传统图形学的光栅化（将三角面投影到屏幕），而是体渲染（Volume Rendering）——一种来自科学可视化的技术，最初用于渲染烟雾、云层、医学CT扫描。

体渲染的核心思想：一条从相机出发穿过场景的光线，其最终颜色由沿光线路径上所有粒子的累积贡献决定。

```
  相机
    \
     \  光线 r(t) = o + t·d
      \
       ●----●----●----●----●→  远处
      t0   t1   t2   t3   t4
       ↑    ↑    ↑    ↑
      每个点有颜色c和密度σ

  体渲染方程（连续形式）：
  C(r) = ∫[t_n → t_f] T(t) · σ(r(t)) · c(r(t), d) dt

  其中：
  T(t) = exp(-∫[t_n → t] σ(r(s)) ds)  透射率
  σ(r(t))                              位置r(t)处的密度
  c(r(t), d)                           从方向d观察时的颜色
```

这个方程的物理含义：光线穿过介质时，每到达一个点，有一定概率被粒子吸收或散射。透射率T(t)表示光线"活着"到达该点的概率——如果前面的区域密度很高，大部分光线已被吸收，后面区域的贡献就很小。

实际计算中用离散采样近似连续积分：

```
  C(r) ≈ Σ[i=1→N] T_i · α_i · c_i

  其中：
  α_i = 1 - exp(-σ_i · δ_i)       第i个采样点的不透明度
  T_i = Π[j=1→i-1] (1 - α_j)      累积透射率（前面点未被吸收的概率）
  δ_i = t_{i+1} - t_i              相邻采样点间距

  计算过程（前→后）：
  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
  │ α₁  │→ │ α₂  │→ │ α₃  │→ │ α₄  │
  │ T₁=1│  │T₂=1-α₁│ │T₃=T₂(1-α₂)│ │T₄=...│
  │ w₁  │  │ w₂  │  │ w₃  │  │ w₄  │
  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘
     ↓        ↓        ↓        ↓
  C = w₁·c₁ + w₂·c₂ + w₃·c₃ + w₄·c₄
  其中 w_i = T_i · α_i
```

### 二、NeRF的核心设计

#### 2.1 五维输入到颜色密度的映射

NeRF的关键洞察：用一个神经网络来参数化"从位置到（颜色，密度）"的映射。

```
  F_θ: (x, y, z, θ, φ) → (r, g, b, σ)
       ↑ 3D位置 + 2D观察方向    ↑ 颜色 + 密度

  神经网络充当了一个"连续的3D数据库"
  可以在任意位置、任意方向查询颜色和密度
```

为什么需要观察方向作为输入？因为真实世界物体有视角相关的效果——一个光滑的金属球从不同角度看颜色不同（高光位置移动）。如果只输入位置，网络只能学到视角无关的漫反射颜色，无法表达高光、反射等效果。

#### 2.2 位置编码（Positional Encoding）

直接将3D坐标输入MLP会遇到一个严重问题：神经网络对低频信号的学习能力强于高频信号。这意味着网络能学会"这里有一个大的红色球体"，但很难学会"球体表面有细微的划痕纹理"。

NeRF通过位置编码将低维输入映射到高维空间：

```
  γ(p) = (sin(2⁰πp), cos(2⁰πp), sin(2¹πp), cos(2¹πp), ...,
          sin(2^(L-1)πp), cos(2^(L-1)πp))

  对于3D位置 p=(x,y,z)，L=10 → 编码后维度 = 3 × 2 × 10 = 60
  对于2D方向 d=(θ,φ)，  L=4  → 编码后维度 = 2 × 2 × 4  = 16

  原理：傅里叶特征
  ┌─────────────────────────────────────────────┐
  │ 低频sin/cos → 捕捉大的结构变化（球体轮廓）    │
  │ 中频sin/cos → 捕捉中等细节（表面凹凸）        │
  │ 高频sin/cos → 捕捉细微纹理（划痕、文字）      │
  │                                              │
  │ 叠加不同频率 → 网络同时学习粗粒度和细粒度信息  │
  └─────────────────────────────────────────────┘
```

位置编码的本质是把空间坐标"展开"成不同频率的正弦余弦分量。这类似于傅里叶变换的思路——任何信号都可以分解为不同频率的正弦波叠加。通过提供多个频率的分量，网络不需要自己学习频率分解，只需学习每个频率分量的权重。

#### 2.3 MLP网络结构

```
  输入：γ(x,y,z) [60维]  γ(θ,φ) [16维]
         │                    │
         ▼                    │
  ┌─────────────────────┐     │
  │  全连接层 256维 + ReLU│     │
  ├─────────────────────┤     │
  │  全连接层 256维 + ReLU│     │
  ├─────────────────────┤     │
  │  全连接层 256维 + ReLU│     │
  ├─────────────────────┤     │
  │  全连接层 256维 + ReLU│     │
  ├─────────────────────┤     │
  │  密度 σ [1维] + ReLU │     │
  │  特征向量 [256维]    │─────┘
  ├─────────────────────┤
  │  全连接层 128维 + ReLU│
  ├─────────────────────┤
  │  颜色 (r,g,b) [3维]  │
  │  + Sigmoid           │
  └─────────────────────┘

  设计要点：
  1. 密度σ只依赖位置，不依赖方向（物体密度是固有属性）
  2. 颜色c同时依赖位置和方向（视角相关外观）
  3. 网络先预测密度和特征，再用特征+方向预测颜色
```

这个设计有深刻的物理含义：密度（一个点是否被物质占据）是场景的固有属性，不随观察方向变化；而颜色（该点散射出的光）取决于你从哪个角度看。网络结构本身就编码了这个物理先验。

#### 2.4 分层采样（Hierarchical Sampling）

均匀采样效率低下——如果场景大部分区域是空白的空气中，在这些区域采样纯粹是浪费计算。NeRF使用分层采样来解决这个问题：

```
  第一轮：粗采样（64个点，均匀分布）
  → 用粗网络预测密度 → 得到光线上的密度分布

  根据密度分布构建概率密度函数：
  w_i = T_i · α_i / Σ(T_i · α_i)  → 归一化为概率

  第二轮：细采样（128个点，按概率密度分布采样）
  → 密度高的区域采样更密集，空白区域几乎不采样

  ──────────────────────────────────────────
  空气   │  物体表面  │   空气
         │ ████████   │
  均匀采样: ● ● ● ● ● │ ● ● ● ● ● │ ● ● ● ● ●  (浪费)
  分层采样:           │●●●●●●●●●●●●│             (高效)
  ──────────────────────────────────────────
```

### 三、NeRF的改进：从慢到快

#### 3.1 Instant-NGP：多分辨率哈希编码

NeRF最致命的缺点是训练慢——一个场景需要数小时。Instant-NGP（NVIDIA 2022）将训练时间从小时级压缩到秒级。

核心创新：用多分辨率哈希编码替代位置编码+MLP的方案。

```
  NeRF:        位置 → 位置编码(60维) → 8层MLP → (颜色, 密度)
                       固定频率            ~100万参数

  Instant-NGP: 位置 → 16级哈希表查找 → 2层小MLP → (颜色, 密度)
                       O(1)查找操作      ~6万参数

  哈希表设计：
  - 16个分辨率层级：16³, 32³, ..., 512³
  - 每层哈希表存储特征向量（如8维）
  - 查询时在每层做三线性插值 → 拼接所有层级特征 → 喂入小MLP

  结果：训练速度提升1000倍（小时→秒），渲染速度提升10-100倍
```

#### 3.2 Mip-NeRF与Zip-NeRF

```
  NeRF ──→ Mip-NeRF（2021，抗锯齿）
  │         将点采样改为锥体采样，一次性考虑一个区域
  │         类比：2D中一个像素 vs mipmap中一个区域
  │
  └──→ Instant-NGP（2022，加速）──→ Zip-NeRF（2023，速度+质量）
              哈希编码加速                     结合两者优势
```

### 四、NeRF的局限性

**训练慢**：即使Instant-NGP将训练压缩到秒级，每个新场景仍需单独优化。不适合"拍一张照片立刻生成3D"的场景。

**渲染速度**：原始NeRF渲染需要沿每条光线进行多次MLP推理（200万像素×128次推理=2.56亿次），很难达到实时渲染（60FPS）。

**难以编辑**：NeRF将场景编码为神经网络权重，很难进行"移动这个物体""改变材质"等编辑操作。

**内存占用**：每个场景需要一个独立的模型，无法像Mesh那样高效压缩和传输。

这些局限性正是3D Gaussian Splatting得以崛起的原因——它用完全不同的思路解决了速度瓶颈。我们将在下一课详细探讨。

## 完整可运行代码示例

### 用PyTorch实现简化版NeRF

以下代码实现了NeRF的核心组件：位置编码、MLP网络、体渲染。虽然简化了采样策略，但完整展示了NeRF的数据流。

```python
"""
nerf_minimal.py
简化版NeRF实现，包含位置编码、MLP和体渲染的核心逻辑。
用于理解NeRF的原理，不包含完整的训练流程。
"""

import torch
import torch.nn as nn
import numpy as np
import math


class PositionalEncoding(nn.Module):
    """
    位置编码层：将低维坐标映射到高维傅里叶特征空间。

    γ(p) = (sin(2⁰πp), cos(2⁰πp), ..., sin(2^(L-1)πp), cos(2^(L-1)πp))
    """

    def __init__(self, input_dim: int, num_freqs: int = 10):
        super().__init__()
        self.input_dim = input_dim
        self.num_freqs = num_freqs
        freqs = 2.0 ** torch.arange(num_freqs).float()
        self.register_buffer("freqs", freqs)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        encoded = [x]
        for freq in self.freqs:
            encoded.append(torch.sin(freq * math.pi * x))
            encoded.append(torch.cos(freq * math.pi * x))
        return torch.cat(encoded, dim=-1)

    @property
    def output_dim(self) -> int:
        return self.input_dim * (1 + 2 * self.num_freqs)


class NeRFMLP(nn.Module):
    """
    NeRF核心MLP网络。

    输入：位置编码后的5D坐标 (γ(xyz), γ(θφ))
    输出：颜色 (r,g,b) + 密度 σ

    设计要点：
    - 密度σ只依赖位置（物理先验：密度是固有属性）
    - 颜色c同时依赖位置和方向（视角相关外观）
    """

    def __init__(self, pos_freqs: int = 10, dir_freqs: int = 4, hidden_dim: int = 256):
        super().__init__()
        self.pos_enc = PositionalEncoding(3, pos_freqs)   # 3D位置→60维
        self.dir_enc = PositionalEncoding(2, dir_freqs)   # 2D方向→16维

        pos_dim = self.pos_enc.output_dim
        dir_dim = self.dir_enc.output_dim

        # 前8层：位置编码 → 密度σ + 特征向量
        self.layers = nn.Sequential(
            nn.Linear(pos_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
        )
        self.density_head = nn.Linear(hidden_dim, 1)
        self.feature_layer = nn.Linear(hidden_dim, hidden_dim)

        # 后半部分：特征+方向 → 颜色
        self.color_layers = nn.Sequential(
            nn.Linear(hidden_dim + dir_dim, 128), nn.ReLU(),
            nn.Linear(128, 3), nn.Sigmoid(),
        )

    def forward(
        self, positions: torch.Tensor, directions: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        参数:
            positions: [N, 3] 3D位置
            directions: [N, 2] 观察方向 (θ, φ)
        返回:
            colors: [N, 3] RGB颜色 ∈ [0,1]
            densities: [N, 1] 体密度 ≥ 0
        """
        pos_enc = self.pos_enc(positions)
        dir_enc = self.dir_enc(directions)

        h = self.layers(pos_enc)
        densities = torch.relu(self.density_head(h))
        features = self.feature_layer(h)

        colors = self.color_layers(torch.cat([features, dir_enc], dim=-1))
        return colors, densities


def volume_render(
    colors: torch.Tensor,
    densities: torch.Tensor,
    deltas: torch.Tensor,
    bg_color: torch.Tensor | None = None,
) -> torch.Tensor:
    """
    体渲染：沿光线积分，将采样点的颜色和密度合成为像素颜色。

    C(r) = Σ T_i · α_i · c_i
    其中 α_i = 1 - exp(-σ_i · δ_i), T_i = Π(1 - α_j)

    参数:
        colors: [N_samples, 3] 每个采样点的颜色
        densities: [N_samples, 1] 每个采样点的密度
        deltas: [N_samples] 相邻采样点间距
        bg_color: [3] 背景色，None则用白色
    """
    if bg_color is None:
        bg_color = torch.ones(3, device=colors.device)

    # 计算不透明度
    alpha = 1.0 - torch.exp(-densities.squeeze(-1) * deltas)

    # 计算累积透射率（从前往后的连乘）
    transmittance = torch.cumprod(
        torch.cat([torch.ones(1, device=alpha.device), 1.0 - alpha + 1e-10]), dim=0
    )[:-1]

    # 每个点的贡献权重
    weights = transmittance * alpha

    # 加权求和得到像素颜色
    pixel_color = (weights.unsqueeze(-1) * colors).sum(dim=0)

    # 加上背景色的贡献
    bg_weight = 1.0 - weights.sum()
    pixel_color = pixel_color + bg_weight * bg_color

    return pixel_color


def render_rays(
    model: NeRFMLP,
    origins: torch.Tensor,
    directions: torch.Tensor,
    near: float = 0.1,
    far: float = 5.0,
    num_samples: int = 64,
) -> torch.Tensor:
    """
    渲染一条光线：在光线上采样点，查询MLP，体渲染合成。

    参数:
        model: NeRF MLP网络
        origins: [3] 光线起点（相机位置）
        directions: [3] 光线方向
        near/far: 近远裁剪面
        num_samples: 采样点数
    """
    # 在光线上均匀采样
    t_vals = torch.linspace(near, far, num_samples, device=origins.device)
    deltas = t_vals[1:] - t_vals[:-1]
    deltas = torch.cat([deltas, torch.tensor([1e10], device=deltas.device)])

    # 计算采样点3D坐标
    points = origins + t_vals.unsqueeze(-1) * directions  # [N, 3]

    # 将方向从笛卡尔坐标转为球坐标 (θ, φ)
    dirs_norm = directions / (directions.norm() + 1e-10)
    theta = torch.acos(torch.clamp(dirs_norm[2], -1, 1))
    phi = torch.atan2(dirs_norm[1], dirs_norm[0])
    dir_2d = torch.stack([theta, phi]).unsqueeze(0).expand(num_samples, -1)

    # MLP查询
    colors, densities = model(points, dir_2d)

    # 体渲染
    pixel_color = volume_render(colors, densities, deltas)
    return pixel_color


def demo_nerf_forward():
    """演示NeRF前向传播：从一条光线到一个像素颜色。"""
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = NeRFMLP(pos_freqs=10, dir_freqs=4, hidden_dim=128).to(device)

    origin = torch.tensor([0.0, 0.0, 2.0], device=device)
    direction = torch.tensor([0.1, 0.05, -1.0], device=device)

    pixel = render_rays(model, origin, direction, near=0.1, far=5.0, num_samples=64)

    print(f"模型参数量: {sum(p.numel() for p in model.parameters()):,}")
    print(f"像素颜色 (R,G,B): {pixel.detach().cpu().numpy().round(3)}")
    print(f"颜色范围: [{pixel.min().item():.3f}, {pixel.max().item():.3f}]")


if __name__ == "__main__":
    demo_nerf_forward()
```

**代码设计说明**：

1. `PositionalEncoding` 将输入坐标通过不同频率的sin/cos编码到高维空间，这是NeRF能学习高频细节的关键
2. `NeRFMLP` 的网络结构遵循原始论文的设计——密度只依赖位置，颜色同时依赖位置和方向
3. `volume_render` 实现了离散体渲染方程，前向累积透射率、计算每个点的贡献权重
4. `render_rays` 将完整的光线渲染流程串联：采样→MLP查询→体渲染

### 使用nerfstudio训练真实场景

nerfstudio是NeRF领域最成熟的工程框架，支持多种NeRF变体。以下是从手机拍摄到训练到渲染的完整流程。

```bash
# 第一步：环境安装
conda create -n nerfstudio python=3.10 -y
conda activate nerfstudio
pip install torch==2.1.2 torchvision==0.16.2 --index-url https://download.pytorch.org/whl/cu118
pip install nerfstudio

# 第二步：数据准备（从手机视频提取帧+COLMAP相机标定）
ns-process-data video \
  --data ./my_video.mp4 \
  --output-dir ./my_scene \
  --num-frames-target 100

# 第三步：训练NeRF（instant-ngp方法，速度最快）
ns-train instant-ngp \
  --data ./my_scene \
  --output-dir ./outputs \
  --max-num-iterations 20000

# 第四步：评估质量
ns-eval \
  --load-config outputs/.../config.yml \
  --output-path eval_results.json

# 第五步：渲染视频
ns-render camera-path \
  --load-config outputs/.../config.yml \
  --output-path renders/output.mp4

# 第六步：导出点云
ns-export pointcloud \
  --load-config outputs/.../config.yml \
  --output-dir exports/pointcloud
```

**数据采集建议**：

```
  推荐的拍摄方式（围绕物体一圈，俯视图）：

        相机位置示意
              北
              |
         ●    ●    ●
        /    |    \
      ●      物体     ●
        \    |    /
         ●    ●    ●
              |
              南

  - 拍摄30-100张照片
  - 相邻照片有60%-80%重叠
  - 覆盖所有角度，包括俯视和仰视
  - 光照条件保持一致
  - 避免纯色无纹理表面（COLMAP无法匹配特征）
```

## 常见误区

### 误区一："NeRF就是3D重建"

NeRF的核心能力是新视角合成（Novel View Synthesis），而不是显式的3D重建。它学会的是"从任意角度看这个场景是什么样的"，而不是"这个场景的几何形状是什么"。虽然可以从NeRF中提取深度图和点云，但质量不如专门的3D重建方法。

### 误区二："Instant-NGP完全解决了NeRF的速度问题"

Instant-NGP将训练速度提升了1000倍，但渲染速度仍然受限于逐光线的MLP推理。即使使用Instant-NGP，渲染一帧720p图像通常需要0.1-1秒，远达不到实时渲染（60FPS）。如果你的场景需要实时交互，3D Gaussian Splatting是更好的选择。

### 误区三："训练NeRF需要专业设备"

不需要。nerfstudio支持直接用手机拍摄视频作为输入，配合COLMAP自动进行相机标定。对于中小场景，用iPhone拍摄30-100张照片就能训练出不错的效果。关键是拍摄时缓慢移动、保证重叠度、场景有足够纹理。

### 误区四："更多训练图像一定带来更好的效果"

图像有冗余。对于简单物体，50张均匀分布的视角就足够了。如果照片中有大量重复视角，不仅不会提升质量，反而可能因过拟合导致其他视角质量下降。关键是视角覆盖的多样性，而非数量。

### 误区五："NeRF和体渲染是一回事"

体渲染是图形学中渲染半透明介质的经典技术，早在NeRF之前就存在。NeRF的创新是用神经网络来参数化体渲染所需的密度和颜色场——把体渲染从"已知3D数据→渲染图像"变成了"学习3D数据→渲染图像"。

## 小结与练习

### 小结

本课从体渲染的物理基础出发，一步步拆解了NeRF的原理：

- 体渲染方程描述了光线穿过介质时的累积颜色，是NeRF的数学基础
- NeRF用MLP参数化从5D坐标（位置+方向）到颜色和密度的映射
- 位置编码（傅里叶特征）解决了网络难以学习高频细节的问题
- 网络结构编码了物理先验：密度是固有属性，颜色是视角相关的
- 分层采样将计算集中在光线穿过物体的区域，避免浪费
- Instant-NGP通过多分辨率哈希编码将训练速度提升1000倍
- NeRF的根本局限在于渲染速度和可编辑性，催生了3DGS等后续突破

下一课我们将学习3D Gaussian Splatting——它用显式高斯椭球替代隐式MLP，实现了100+FPS的实时渲染。

### 练习

#### 练习一：体渲染方程手算

给定一条光线上三个采样点，密度分别为σ₁=0.5, σ₂=1.0, σ₃=0.3，颜色分别为红色(1,0,0)、绿色(0,1,0)、蓝色(0,0,1)，采样间距δ=1.0。请手动计算最终的像素颜色C。

#### 练习二：位置编码维度验证

对于3D位置p=(x,y,z)，L=10；对于2D方向d=(θ,φ)，L=4。请验证位置编码后的总维度为76维，并解释为什么位置编码用更高的L值而方向编码用更低的L值。

#### 练习三：nerfstudio实践

使用nerfstudio完成以下任务：
1. 用手机对一个桌面物体拍摄50张照片
2. 用ns-process-data处理数据
3. 用nerfacto方法训练NeRF
4. 评估训练结果的PSNR指标（目标>25dB）
5. 渲染一个360度环绕视频

记录过程中遇到的问题和解决方法。

---

## 参考答案

### 练习一

**思路**：根据体渲染的离散公式，逐步计算每个采样点的不透明度和累积透射率。

**答案**：

```
已知：σ₁=0.5, σ₂=1.0, σ₃=0.3, δ=1.0

步骤1：计算不透明度
  α₁ = 1 - exp(-0.5×1.0) = 1 - 0.6065 = 0.3935
  α₂ = 1 - exp(-1.0×1.0) = 1 - 0.3679 = 0.6321
  α₃ = 1 - exp(-0.3×1.0) = 1 - 0.7408 = 0.2592

步骤2：计算累积透射率
  T₁ = 1.0
  T₂ = 1 - α₁ = 0.6065
  T₃ = (1 - α₁)(1 - α₂) = 0.6065 × 0.3679 = 0.2231

步骤3：计算贡献权重
  w₁ = T₁·α₁ = 1.0 × 0.3935 = 0.3935
  w₂ = T₂·α₂ = 0.6065 × 0.6321 = 0.3833
  w₃ = T₃·α₃ = 0.2231 × 0.2592 = 0.0578

步骤4：加权求和
  C = 0.3935×(1,0,0) + 0.3833×(0,1,0) + 0.0578×(0,0,1)
    = (0.3935, 0.3833, 0.0578)

  偏红绿色，蓝色分量很小
  总权重：0.8346（剩余0.1654为背景色贡献）
```

**要点**：
- 不透明度α不是密度σ，关系是 α = 1 - exp(-σ·δ)
- 累积透射率是连乘关系，前面的高密度点会大幅减少后面的贡献
- 第三个采样点密度不低，但因累积透射率已很小，贡献被大幅衰减

### 练习二

**思路**：位置编码的输出维度公式。

**答案**：

```
位置编码维度 = input_dim × (1 + 2 × L)

3D位置 (x,y,z)，L=10：
  维度 = 3 × (1 + 2×10) = 3 × 21 = 63
  （原始3维 + 10个频率的sin + 10个频率的cos，每组3维）

2D方向 (θ,φ)，L=4：
  维度 = 2 × (1 + 2×4) = 2 × 9 = 18
  （原始2维 + 4个频率的sin + 4个频率的cos，每组2维）

总维度 = 63 + 18 = 81

注：原始NeRF论文中不保留原始坐标，此时维度为3×20+2×8=76。
两种实现都是正确的，区别在于是否将原始坐标也输入网络。
```

为什么位置用更高L值：
- 位置变化范围大（场景可能跨越数米），需要更多频率分量来捕捉不同尺度的细节
- 方向变化范围小（单位球面上），且视角相关的变化通常比较平缓（高光渐变），不需要太多高频分量
- 高频分量过多会引入噪声，论文中L=10和L=4是实验得到的最优值

### 练习三

**思路**：按nerfstudio工作流程逐步执行。

**答案**：

```bash
# 1. 数据采集
# 用iPhone围绕一个杯子拍摄50张照片
# 放在有纹理的桌面上（纯色桌面COLMAP可能无法匹配）

# 2. 数据处理
ns-process-data images \
  --data ./cup_photos \
  --output-dir ./cup_scene

# 3. 训练（nerfacto在细节上比instant-ngp更好）
ns-train nerfacto \
  --data ./cup_scene \
  --output-dir ./cup_outputs \
  --max-num-iterations 15000

# 4. 评估
ns-eval \
  --load-config ./cup_outputs/.../config.yml \
  --output-path ./cup_eval.json

# 5. 渲染视频
ns-render dataset \
  --load-config ./cup_outputs/.../config.yml \
  --output-path ./cup_360.mp4
```

常见问题及解决：
- COLMAP失败：图片模糊或场景无纹理。解决：重拍时保持手机稳定，确保背景有纹理
- 训练loss不收敛：相机参数错误。解决：检查transforms.json中的相机参数
- 渲染有黑色区域：视角没被训练图像覆盖。解决：增加拍摄角度覆盖

**要点**：
- 数据质量决定了NeRF的上限，垃圾数据无法训练出好效果
- PSNR > 25dB通常表示效果可用，> 30dB表示效果优秀
- nerfacto比instant-ngp在细节上更好，但训练更慢
