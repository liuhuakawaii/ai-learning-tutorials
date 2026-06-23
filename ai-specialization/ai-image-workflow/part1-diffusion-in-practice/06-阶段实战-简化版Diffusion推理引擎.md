# 第 6 课：阶段实战 — 从零实现简化版 Diffusion 推理引擎

## 场景引入

前面 5 课我们拆解了 Diffusion 的数学原理、Stable Diffusion 的架构、采样器的设计、以及 prompt 工程的技巧。现在是时候把这些知识串起来了——**从零实现一个简化版的 Diffusion 推理引擎**。

这不是一个玩具 demo。这个引擎将包含完整的推理流水线：噪声调度、去噪采样、文本条件注入、CFG 引导。完成后你将真正理解 Stable Diffusion 在"跑一张图"时每一步做了什么。

## 学习目标

完成本课后，你将能够：
1. 从零实现 DDPM 采样器
2. 实现带 CFG 引导的条件采样
3. 实现多种采样器（Euler、DPM-Solver++）
4. 构建完整的推理流水线并验证正确性
5. 通过性能分析理解各组件的计算开销

## 一、项目结构设计

```
diffusion-engine/
├── engine/
│   ├── __init__.py
│   ├── noise_schedule.py      # 噪声调度器
│   ├── samplers.py            # 采样器实现
│   ├── pipeline.py            # 推理流水线
│   └── utils.py               # 工具函数
├── tests/
│   ├── test_schedule.py       # 调度器测试
│   ├── test_samplers.py       # 采样器测试
│   └── test_pipeline.py       # 流水线测试
├── demo.py                    # 演示脚本
└── requirements.txt
```

## 二、噪声调度器

### 2.1 基础调度器

```python
# engine/noise_schedule.py
import torch
import numpy as np
from typing import Optional

class NoiseSchedule:
    """
    噪声调度器：定义前向扩散过程中每一步添加多少噪声

    核心参数：
      beta_t: 第 t 步的噪声方差
      alpha_t = 1 - beta_t: 第 t 步的信号保留比例
      alpha_bar_t = prod(alpha_0..t): 累积信号保留比例
    """

    def __init__(self, num_timesteps: int = 1000, beta_start: float = 0.0001,
                 beta_end: float = 0.02, schedule: str = "linear",
                 device: str = "cuda"):
        self.num_timesteps = num_timesteps
        self.device = device

        if schedule == "linear":
            betas = torch.linspace(beta_start, beta_end, num_timesteps)
        elif schedule == "cosine":
            betas = self._cosine_schedule(num_timesteps)
        elif schedule == "sqrt":
            betas = self._sqrt_schedule(num_timesteps, beta_start, beta_end)
        else:
            raise ValueError(f"Unknown schedule: {schedule}")

        alphas = 1.0 - betas
        alphas_cumprod = torch.cumprod(alphas, dim=0)
        alphas_cumprod_prev = torch.cat([
            torch.tensor([1.0]), alphas_cumprod[:-1]
        ])

        self.betas = betas.to(device)
        self.alphas = alphas.to(device)
        self.alphas_cumprod = alphas_cumprod.to(device)
        self.alphas_cumprod_prev = alphas_cumprod_prev.to(device)

        # 预计算常用量
        self.sqrt_alphas_cumprod = torch.sqrt(alphas_cumprod).to(device)
        self.sqrt_one_minus_alphas_cumprod = torch.sqrt(1.0 - alphas_cumprod).to(device)
        self.sqrt_recip_alphas = torch.sqrt(1.0 / alphas).to(device)

        # 后验分布参数（DDPM 采样需要）
        posterior_variance = (
            betas * (1.0 - alphas_cumprod_prev) / (1.0 - alphas_cumprod)
        )
        self.posterior_variance = posterior_variance.to(device)

    def _cosine_schedule(self, T: int, s: float = 0.008) -> torch.Tensor:
        """余弦调度：在首尾保留更多信号"""
        steps = torch.arange(T + 1, dtype=torch.float64) / T
        alpha_bar = torch.cos((steps + s) / (1 + s) * np.pi / 2) ** 2
        alpha_bar = alpha_bar / alpha_bar[0]
        betas = 1 - (alpha_bar[1:] / alpha_bar[:-1])
        return torch.clamp(betas, 0.0001, 0.9999).float()

    def _sqrt_schedule(self, T: int, beta_start: float, beta_end: float) -> torch.Tensor:
        """平方根调度"""
        steps = torch.arange(T, dtype=torch.float64) / T
        betas = (torch.sqrt(steps) * (beta_end - beta_start) + beta_start) ** 2
        return betas.float()

    def add_noise(self, x0: torch.Tensor, noise: torch.Tensor,
                  t: torch.Tensor) -> torch.Tensor:
        """
        前向加噪：x_t = sqrt(alpha_bar_t) * x0 + sqrt(1 - alpha_bar_t) * noise

        这是 DDPM 的核心公式之一。
        """
        sqrt_alpha = self.sqrt_alphas_cumprod[t].view(-1, 1, 1, 1)
        sqrt_one_minus_alpha = self.sqrt_one_minus_alphas_cumprod[t].view(-1, 1, 1, 1)
        return sqrt_alpha * x0 + sqrt_one_minus_alpha * noise

    def get_snr(self) -> torch.Tensor:
        """计算信噪比 SNR = alpha_bar / (1 - alpha_bar)"""
        return self.alphas_cumprod / (1.0 - self.alphas_cumprod)
```

### 2.2 调度器可视化

```python
# tests/test_schedule.py
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from engine.noise_schedule import NoiseSchedule

def visualize_schedules():
    """对比不同噪声调度的特性"""
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    schedules = ["linear", "cosine", "sqrt"]

    for schedule_name in schedules:
        ns = NoiseSchedule(num_timesteps=1000, schedule=schedule_name)

        # α_bar_t
        axes[0, 0].plot(ns.alphas_cumprod.cpu().numpy(), label=schedule_name)
        # β_t
        axes[0, 1].plot(ns.betas.cpu().numpy(), label=schedule_name)
        # SNR (对数尺度)
        snr = ns.get_snr()
        axes[1, 0].plot(torch.log10(snr + 1e-10).cpu().numpy(), label=schedule_name)
        # 后验方差
        axes[1, 1].plot(ns.posterior_variance.cpu().numpy(), label=schedule_name)

    titles = ["ᾱ_t (累积信号)", "β_t (每步噪声)", "log₁₀(SNR)", "后验方差"]
    for ax, title in zip(axes.flat, titles):
        ax.set_title(title)
        ax.set_xlabel("时间步 t")
        ax.legend()
        ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig("tests/schedule_comparison.png", dpi=150)
    plt.close()
    print("调度对比图已保存到 tests/schedule_comparison.png")

if __name__ == "__main__":
    visualize_schedules()
```

## 三、采样器实现

### 3.1 DDPM 采样器

```python
# engine/samplers.py
import torch
import torch.nn as nn
from abc import ABC, abstractmethod
from typing import Callable, Optional, Dict, Any
from .noise_schedule import NoiseSchedule

class BaseSampler(ABC):
    """采样器基类"""

    def __init__(self, schedule: NoiseSchedule):
        self.schedule = schedule

    @abstractmethod
    def step(self, model_output: torch.Tensor, t: int,
             x_t: torch.Tensor, **kwargs) -> torch.Tensor:
        """执行一步采样"""
        pass

    @torch.no_grad()
    def sample(self, model: Callable, shape: tuple,
               conditioning: Optional[torch.Tensor] = None,
               num_steps: Optional[int] = None,
               guidance_scale: float = 7.5,
               eta: float = 0.0,
               device: str = "cuda",
               verbose: bool = True) -> torch.Tensor:
        """完整采样流程"""
        x = torch.randn(shape, device=device)
        timesteps = num_steps or self.schedule.num_timesteps

        for t_idx in reversed(range(timesteps)):
            t = torch.full((shape[0],), t_idx, device=device, dtype=torch.long)

            # CFG 引导
            if conditioning is not None and guidance_scale > 1.0:
                noise_cond = model(x, t, conditioning)
                noise_uncond = model(x, t, torch.zeros_like(conditioning))
                model_output = noise_uncond + guidance_scale * (noise_cond - noise_uncond)
            else:
                model_output = model(x, t, conditioning)

            x = self.step(model_output, t_idx, x, eta=eta)

            if verbose and t_idx % 50 == 0:
                print(f"  Step {t_idx}/{timesteps}")

        return x


class DDPMSampler(BaseSampler):
    """DDPM 采样器：原始去噪扩散概率模型"""

    def step(self, model_output: torch.Tensor, t: int,
             x_t: torch.Tensor, **kwargs) -> torch.Tensor:
        """
        DDPM 单步更新：
        x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (beta_t/sqrt(1-alpha_bar_t)) * eps) + sigma_t * z
        """
        s = self.schedule
        beta_t = s.betas[t]
        alpha_t = s.alphas[t]
        alpha_bar_t = s.alphas_cumprod[t]

        # 预测的噪声
        eps_pred = model_output

        # 计算去噪后的均值
        coeff1 = 1.0 / torch.sqrt(alpha_t)
        coeff2 = beta_t / torch.sqrt(1.0 - alpha_bar_t)
        mean = coeff1 * (x_t - coeff2 * eps_pred)

        # 添加随机噪声（t=0 时不加）
        if t > 0:
            noise = torch.randn_like(x_t)
            sigma_t = torch.sqrt(s.posterior_variance[t])
            x_prev = mean + sigma_t * noise
        else:
            x_prev = mean

        return x_prev


class DDIMSampler(BaseSampler):
    """DDIM 采样器：确定性加速采样"""

    def step(self, model_output: torch.Tensor, t: int,
             x_t: torch.Tensor, eta: float = 0.0, **kwargs) -> torch.Tensor:
        """
        DDIM 单步更新（eta=0 时完全确定性）
        """
        s = self.schedule
        alpha_bar_t = s.alphas_cumprod[t]
        alpha_bar_prev = s.alphas_cumprod_prev[t]

        eps_pred = model_output

        # 预测 x0
        x0_pred = (x_t - torch.sqrt(1 - alpha_bar_t) * eps_pred) / torch.sqrt(alpha_bar_t)
        x0_pred = torch.clamp(x0_pred, -1.0, 1.0)

        # 计算方向
        sigma_t = eta * torch.sqrt(
            (1 - alpha_bar_prev) / (1 - alpha_bar_t)
        ) * torch.sqrt(1 - alpha_bar_t / alpha_bar_prev)

        dir_xt = torch.sqrt(1 - alpha_bar_prev - sigma_t ** 2) * eps_pred

        if t > 0:
            noise = torch.randn_like(x_t)
            x_prev = torch.sqrt(alpha_bar_prev) * x0_pred + dir_xt + sigma_t * noise
        else:
            x_prev = torch.sqrt(alpha_bar_prev) * x0_pred + dir_xt

        return x_prev
```

### 3.2 Euler 采样器

```python
class EulerSampler(BaseSampler):
    """Euler 采样器：一阶 ODE 求解器"""

    def __init__(self, schedule: NoiseSchedule, use_karras: bool = True):
        super().__init__(schedule)
        self.use_karras = use_karras

    def step(self, model_output: torch.Tensor, t: int,
             x_t: torch.Tensor, sigma_curr: float = None,
             sigma_next: float = None, **kwargs) -> torch.Tensor:
        """
        Euler 单步：x_{t-1} = x_t + dt * model_output

        当 use_karras=True 时使用 Karras 噪声调度
        """
        if sigma_curr is not None and sigma_next is not None:
            dt = sigma_next - sigma_curr
            return x_t + dt * model_output
        else:
            # 简化版：使用线性调度
            s = self.schedule
            sigma_t = torch.sqrt((1 - s.alphas_cumprod[t]) / s.alphas_cumprod[t])
            if t > 0:
                sigma_prev = torch.sqrt(
                    (1 - s.alphas_cumprod[t - 1]) / s.alphas_cumprod[t - 1]
                )
            else:
                sigma_prev = torch.tensor(0.0)

            dt = sigma_prev - sigma_t
            return x_t + dt * model_output


class DPMPlusPlus2MSampler(BaseSampler):
    """DPM-Solver++ 二阶采样器"""

    def __init__(self, schedule: NoiseSchedule):
        super().__init__(schedule)
        self.model_cache = []

    def step(self, model_output: torch.Tensor, t: int,
             x_t: torch.Tensor, **kwargs) -> torch.Tensor:
        """DPM-Solver++ 二阶更新"""
        s = self.schedule
        self.model_cache.append(model_output.clone())

        # 计算 log-SNR
        alpha_bar_t = s.alphas_cumprod[t]
        lambda_t = 0.5 * torch.log(alpha_bar_t / (1 - alpha_bar_t))

        if t > 0:
            alpha_bar_prev = s.alphas_cumprod[t - 1]
            lambda_prev = 0.5 * torch.log(alpha_bar_prev / (1 - alpha_bar_prev))
        else:
            lambda_prev = torch.tensor(20.0)  # 接近纯信号

        h = lambda_prev - lambda_t  # 步长（log-SNR 空间）

        if len(self.model_cache) >= 2 and t > 0:
            # 二阶：利用历史信息做更高精度外推
            D1 = self.model_cache[-1]
            D2 = self.model_cache[-2]
            r = h / (self._prev_h or h)
            # DPM-Solver++ 二阶更新公式
            x_prev = (
                torch.sqrt(alpha_bar_prev / alpha_bar_t) * x_t
                - torch.sqrt(1 - alpha_bar_prev) * (
                    (1 - 1 / (2 * r)) * D1 + (1 / (2 * r)) * D2
                ) * (torch.exp(-h) - 1)
            )
        else:
            # 一阶回退
            x_prev = (
                torch.sqrt(alpha_bar_prev / alpha_bar_t) * x_t
                - torch.sqrt(1 - alpha_bar_prev) * model_output
                * (torch.exp(-h) - 1)
            )

        self._prev_h = h
        return x_prev
```

## 四、完整推理流水线

### 4.1 Pipeline 实现

```python
# engine/pipeline.py
import torch
import time
from typing import Optional, Dict, List, Tuple
from .noise_schedule import NoiseSchedule
from .samplers import (
    BaseSampler, DDPMSampler, DDIMSampler,
    EulerSampler, DPMPlusPlus2MSampler
)

class DiffusionPipeline:
    """
    简化版 Diffusion 推理流水线

    完整流程：
    1. 编码文本 → 条件向量
    2. 生成随机噪声
    3. 逐步去噪（带 CFG 引导）
    4. 解码潜变量 → 图像
    """

    SAMPLER_REGISTRY = {
        "ddpm": DDPMSampler,
        "ddim": DDIMSampler,
        "euler": EulerSampler,
        "dpm++_2m": DPMPlusPlus2MSampler,
    }

    def __init__(
        self,
        unet: torch.nn.Module,
        vae_encoder: Optional[torch.nn.Module] = None,
        vae_decoder: Optional[torch.nn.Module] = None,
        text_encoder: Optional[torch.nn.Module] = None,
        num_timesteps: int = 1000,
        schedule_type: str = "linear",
        device: str = "cuda"
    ):
        self.unet = unet
        self.vae_encoder = vae_encoder
        self.vae_decoder = vae_decoder
        self.text_encoder = text_encoder
        self.device = device

        self.schedule = NoiseSchedule(
            num_timesteps=num_timesteps,
            schedule=schedule_type,
            device=device
        )

    def encode_text(self, prompt: str) -> torch.Tensor:
        """文本编码：prompt → conditioning tensor"""
        if self.text_encoder is None:
            # 模拟编码（用于测试）
            return torch.randn(1, 77, 768, device=self.device)
        tokens = self.text_encoder.tokenize(prompt)
        return self.text_encoder(tokens.to(self.device))

    def encode_image(self, image: torch.Tensor) -> torch.Tensor:
        """图像编码：像素空间 → 潜空间"""
        if self.vae_encoder is None:
            # 模拟：直接下采样
            return torch.nn.functional.interpolate(
                image, scale_factor=0.125, mode='bilinear'
            )
        return self.vae_encoder(image)

    def decode_latent(self, latent: torch.Tensor) -> torch.Tensor:
        """潜变量解码：潜空间 → 像素空间"""
        if self.vae_decoder is None:
            return torch.nn.functional.interpolate(
                latent, scale_factor=8, mode='bilinear'
            )
        return self.vae_decoder(latent)

    @torch.no_grad()
    def __call__(
        self,
        prompt: str,
        negative_prompt: str = "",
        height: int = 512,
        width: int = 512,
        num_inference_steps: int = 20,
        guidance_scale: float = 7.5,
        sampler_name: str = "dpm++_2m",
        seed: Optional[int] = None,
        num_images: int = 1,
        verbose: bool = True
    ) -> Dict[str, any]:
        """
        执行完整的推理流程

        Returns:
            {
                "images": List[Tensor],      # 生成的图像
                "latents": List[Tensor],     # 中间潜变量
                "metadata": Dict             # 生成参数
            }
        """
        start_time = time.time()

        # 1. 设置随机种子
        if seed is not None:
            torch.manual_seed(seed)
            if torch.cuda.is_available():
                torch.cuda.manual_seed(seed)

        # 2. 编码文本
        if verbose:
            print(f"[Pipeline] 编码文本: '{prompt[:50]}...'")
        conditioning = self.encode_text(prompt)
        uncond = self.encode_text(negative_prompt) if negative_prompt else torch.zeros_like(conditioning)

        # 3. 初始化噪声
        latent_h = height // 8
        latent_w = width // 8
        latents = torch.randn(
            num_images, 4, latent_h, latent_w,
            device=self.device
        )

        # 4. 创建采样器
        sampler_cls = self.SAMPLER_REGISTRY.get(sampler_name)
        if sampler_cls is None:
            raise ValueError(f"Unknown sampler: {sampler_name}")
        sampler = sampler_cls(self.schedule)

        # 5. 执行采样
        if verbose:
            print(f"[Pipeline] 开始采样: {sampler_name}, {num_inference_steps} 步")

        # 扩展 conditioning 以支持 CFG
        conditioning_expanded = conditioning.expand(num_images, -1, -1)
        uncond_expanded = uncond.expand(num_images, -1, -1)

        # 自定义采样循环（带 CFG）
        timesteps = list(reversed(range(num_inference_steps)))
        intermediate_latents = []

        for i, t_idx in enumerate(timesteps):
            t = torch.full((num_images,), t_idx, device=self.device, dtype=torch.long)

            # CFG：同时计算有条件和无条件预测
            noise_cond = self.unet(latents, t, conditioning_expanded)
            noise_uncond = self.unet(latents, t, uncond_expanded)
            noise_guided = noise_uncond + guidance_scale * (noise_cond - noise_uncond)

            # 采样步进
            latents = sampler.step(noise_guided, t_idx, latents)
            intermediate_latents.append(latents.clone())

            if verbose and (i + 1) % 5 == 0:
                print(f"  Step {i+1}/{len(timesteps)}")

        # 6. 解码潜变量
        if verbose:
            print("[Pipeline] 解码潜变量...")
        images = self.decode_latent(latents)

        # 后处理：归一化到 [0, 1]
        images = (images + 1) / 2
        images = torch.clamp(images, 0, 1)

        elapsed = time.time() - start_time
        if verbose:
            print(f"[Pipeline] 完成! 耗时: {elapsed:.2f}s")

        return {
            "images": [img for img in images],
            "latents": intermediate_latents,
            "metadata": {
                "prompt": prompt,
                "negative_prompt": negative_prompt,
                "sampler": sampler_name,
                "steps": num_inference_steps,
                "cfg_scale": guidance_scale,
                "seed": seed,
                "elapsed": elapsed
            }
        }
```

### 4.2 推理性能分析

```python
# engine/utils.py
import torch
import time
from typing import Dict, List
from contextlib import contextmanager

@contextmanager
def timer(name: str, results: Dict):
    """计时上下文管理器"""
    start = time.perf_counter()
    yield
    elapsed = time.perf_counter() - start
    results[name] = elapsed
    print(f"  {name}: {elapsed:.3f}s")

def profile_pipeline(pipeline, prompt: str, steps_list: List[int],
                     sampler_list: List[str]) -> Dict:
    """
    性能分析：对比不同配置的推理时间

    用途：
    1. 找出瓶颈（U-Net 推理占比最大？VAE 解码？）
    2. 评估不同采样器的速度差异
    3. 确定最佳步数组合
    """
    results = []

    for sampler in sampler_list:
        for steps in steps_list:
            timings = {}

            with timer("text_encoding", timings):
                conditioning = pipeline.encode_text(prompt)

            with timer("sampling", timings):
                pipeline(
                    prompt=prompt,
                    num_inference_steps=steps,
                    sampler_name=sampler,
                    verbose=False
                )

            total = sum(timings.values())
            results.append({
                "sampler": sampler,
                "steps": steps,
                "total": round(total, 3),
                **{k: round(v, 3) for k, v in timings.items()}
            })

    return results
```

## 五、验证与测试

### 5.1 单元测试

```python
# tests/test_pipeline.py
import torch
import sys
sys.path.insert(0, "..")

from engine.noise_schedule import NoiseSchedule
from engine.samplers import DDPMSampler, DDIMSampler, EulerSampler
from engine.pipeline import DiffusionPipeline

class MockUNet(torch.nn.Module):
    """模拟 U-Net，用于测试流水线"""

    def __init__(self, in_channels=4, out_channels=4, cond_dim=768):
        super().__init__()
        self.conv = torch.nn.Conv2d(in_channels, out_channels, 3, padding=1)
        self.cond_proj = torch.nn.Linear(cond_dim, out_channels)

    def forward(self, x, t, conditioning):
        # 简单的噪声预测（不做真实的去噪）
        noise = self.conv(x)
        # 混入条件信息
        cond_bias = self.cond_proj(conditioning.mean(dim=1))
        noise = noise + cond_bias.view(-1, noise.shape[1], 1, 1)
        return noise

def test_noise_schedule():
    """测试噪声调度器的数学性质"""
    ns = NoiseSchedule(num_timesteps=1000)

    # 测试 1：alpha_bar 单调递减
    assert (ns.alphas_cumprod[1:] <= ns.alphas_cumprod[:-1]).all(), \
        "alpha_bar 应该单调递减"

    # 测试 2：alpha_bar[0] 接近 1（第一步几乎不加噪）
    assert ns.alphas_cumprod[0] > 0.99, \
        f"alpha_bar[0] 应接近 1，实际为 {ns.alphas_cumprod[0]}"

    # 测试 3：alpha_bar[-1] 接近 0（最后一步接近纯噪声）
    assert ns.alphas_cumprod[-1] < 0.01, \
        f"alpha_bar[-1] 应接近 0，实际为 {ns.alphas_cumprod[-1]}"

    # 测试 4：add_noise 正确性
    x0 = torch.randn(2, 4, 8, 8, device="cpu")
    noise = torch.randn_like(x0)
    t = torch.tensor([500, 800])
    x_t = ns.add_noise(x0, noise, t)

    # x_t 应该介于 x0 和 noise 之间
    assert x_t.shape == x0.shape, "add_noise 输出形状应与输入相同"

    print("✅ 噪声调度器测试全部通过")

def test_samplers():
    """测试各采样器的基本功能"""
    ns = NoiseSchedule(num_timesteps=20, device="cpu")
    model = MockUNet()
    model.eval()

    x_t = torch.randn(1, 4, 8, 8)
    conditioning = torch.randn(1, 77, 768)

    for SamplerClass in [DDPMSampler, DDIMSampler, EulerSampler]:
        sampler = SamplerClass(ns)
        # 测试单步
        model_output = model(x_t, torch.tensor([10]), conditioning)
        x_prev = sampler.step(model_output, 10, x_t)
        assert x_prev.shape == x_t.shape, \
            f"{SamplerClass.__name__} 输出形状错误"

    print("✅ 采样器测试全部通过")

def test_pipeline():
    """测试完整流水线"""
    model = MockUNet()
    model.eval()

    pipeline = DiffusionPipeline(
        unet=model,
        num_timesteps=20,
        device="cpu"
    )

    result = pipeline(
        prompt="a test image",
        height=64,
        width=64,
        num_inference_steps=5,
        guidance_scale=7.0,
        sampler_name="euler",
        seed=42,
        verbose=False
    )

    assert len(result["images"]) == 1
    assert result["images"][0].shape == (3, 64, 64) or \
           result["images"][0].shape[0] in [3, 4]
    assert "metadata" in result

    print("✅ 流水线测试通过")

if __name__ == "__main__":
    test_noise_schedule()
    test_samplers()
    test_pipeline()
    print("\n🎉 所有测试通过!")
```

### 5.2 演示脚本

```python
# demo.py
"""
简化版 Diffusion 推理引擎演示

运行方式：
  python demo.py --mode basic
  python demo.py --mode compare_samplers
  python demo.py --mode profile
"""
import argparse
import torch
from engine.pipeline import DiffusionPipeline
from engine.utils import profile_pipeline

def demo_basic():
    """基础演示：单张图像生成"""
    # 注意：使用 MockUNet 进行演示
    # 真实场景替换为预训练的 Stable Diffusion UNet
    from tests.test_pipeline import MockUNet

    model = MockUNet()
    model.eval()

    pipeline = DiffusionPipeline(
        unet=model,
        num_timesteps=20,
        device="cpu"
    )

    result = pipeline(
        prompt="a beautiful sunset over mountains",
        negative_prompt="blurry, low quality",
        height=256,
        width=256,
        num_inference_steps=10,
        guidance_scale=7.5,
        sampler_name="euler",
        seed=42
    )

    print(f"\n生成完成!")
    print(f"  图像数量: {len(result['images'])}")
    print(f"  图像形状: {result['images'][0].shape}")
    print(f"  耗时: {result['metadata']['elapsed']:.2f}s")

def demo_compare_samplers():
    """对比不同采样器"""
    from tests.test_pipeline import MockUNet

    model = MockUNet()
    pipeline = DiffusionPipeline(unet=model, num_timesteps=20, device="cpu")

    samplers = ["euler", "ddim", "ddpm"]
    for sampler in samplers:
        print(f"\n{'='*40}")
        print(f"采样器: {sampler}")
        result = pipeline(
            prompt="test",
            num_inference_steps=10,
            sampler_name=sampler,
            seed=42,
            verbose=False
        )
        print(f"  耗时: {result['metadata']['elapsed']:.2f}s")

def main():
    parser = argparse.ArgumentParser(description="Diffusion Engine Demo")
    parser.add_argument("--mode", default="basic",
                       choices=["basic", "compare_samplers", "profile"])
    args = parser.parse_args()

    if args.mode == "basic":
        demo_basic()
    elif args.mode == "compare_samplers":
        demo_compare_samplers()

if __name__ == "__main__":
    main()
```

## 六、常见误区

### 误区一：跳过噪声调度直接写采样器

噪声调度是采样的基础。不同调度器（linear vs cosine vs karras）会显著影响生成质量。理解 α_t、ᾱ_t 的物理含义后，调参才有方向。

### 误区二：CFG 引导放在采样器内部

CFG 引导应该在流水线层面实现，而不是嵌入采样器。这样可以灵活切换不同的引导策略（标准 CFG、Dynamic Thresholding、CFG++），而不需要修改采样器代码。

### 误区三：只测试一张图就认为引擎正确

必须用多种 prompt、多种 seed、多种步数组合测试。特别注意边界条件：步数=1、步数=1000、CFG=1.0、空 prompt 等。

## 七、小结

1. **噪声调度器**定义了"从干净到噪声"的数学路径，α_t 和 ᾱ_t 是核心参数
2. **采样器**用数值方法逆向求解这条路径，不同采样器是精度和速度的权衡
3. **CFG 引导**在流水线层面实现，与采样器解耦
4. **完整流水线** = 文本编码 → 噪声生成 → 逐步去噪 → 潜变量解码
5. **单元测试**是验证正确性的唯一可靠手段

## 练习

### 练习一：实现 UniPC 采样器

基于 `BaseSampler` 基类，实现 UniPC（Unified Predictor-Corrector）采样器的简化版本。要求支持 2 阶预测器和 1 阶校正器。

### 练习二：批量推理优化

修改 `DiffusionPipeline.__call__` 方法，使其支持将多个 prompt 的推理 batch 在一起（共享 U-Net 推理），比较 batch=1 和 batch=4 的吞吐量差异。

---

## 参考答案

### 练习一

**思路**：UniPC 的核心是"先预测后校正"。预测器用多步历史做外推，校正器用模型在预测点处的输出修正误差。

**答案**：

```python
class UniPCSampler(BaseSampler):
    """UniPC 采样器：统一预测-校正框架（简化版）"""

    def __init__(self, schedule: NoiseSchedule, order: int = 2):
        super().__init__(schedule)
        self.order = order
        self.model_outputs = []
        self.prev_timesteps = []

    def step(self, model_output: torch.Tensor, t: int,
             x_t: torch.Tensor, **kwargs) -> torch.Tensor:
        s = self.schedule
        self.model_outputs.append(model_output.clone())
        self.prev_timesteps.append(t)

        alpha_bar_t = s.alphas_cumprod[t]
        lambda_t = 0.5 * torch.log(alpha_bar_t / (1 - alpha_bar_t))

        if t > 0:
            alpha_bar_prev = s.alphas_cumprod[t - 1]
        else:
            alpha_bar_prev = torch.tensor(1.0)
        lambda_prev = 0.5 * torch.log(alpha_bar_prev / (1 - alpha_bar_prev + 1e-10))

        h = lambda_prev - lambda_t

        # 预测器（Predictor）
        if len(self.model_outputs) >= 2 and self.order >= 2:
            D1 = self.model_outputs[-1]
            D2 = self.model_outputs[-2]
            h_prev = self._prev_h if hasattr(self, '_prev_h') else h
            r = h / (h_prev + 1e-10)

            # 二阶预测
            x0_pred = (
                (1 + 1 / (2 * r)) * self._predict_x0(x_t, D1, alpha_bar_t)
                - (1 / (2 * r)) * self._predict_x0(x_t, D2, alpha_bar_t)
            )
        else:
            x0_pred = self._predict_x0(x_t, model_output, alpha_bar_t)

        # 校正器（Corrector）
        x_pred = self._x_from_x0(x_t, x0_pred, alpha_bar_t, alpha_bar_prev)

        # 一阶校正：用模型在预测点处的输出修正
        if self.order >= 2:
            # 用预测的 x_pred 重新计算模型输出（实际需要额外一次推理）
            # 简化版：直接用当前输出做一步校正
            x_corrected = self._corrector_step(
                x_pred, x_t, x0_pred, alpha_bar_prev, alpha_bar_t, model_output
            )
            x_prev = x_corrected
        else:
            x_prev = x_pred

        self._prev_h = h
        return x_prev

    def _predict_x0(self, x_t, eps_pred, alpha_bar_t):
        """从 x_t 和预测噪声计算 x0"""
        return (x_t - torch.sqrt(1 - alpha_bar_t) * eps_pred) / torch.sqrt(alpha_bar_t)

    def _x_from_x0(self, x_t, x0_pred, alpha_bar_t, alpha_bar_prev):
        """从预测的 x0 计算 x_{t-1}"""
        return torch.sqrt(alpha_bar_prev) * x0_pred + torch.sqrt(1 - alpha_bar_prev) * (
            (x_t - torch.sqrt(alpha_bar_t) * x0_pred) / torch.sqrt(1 - alpha_bar_t)
        )

    def _corrector_step(self, x_pred, x_t, x0_pred, alpha_bar_prev, alpha_bar_t, eps_pred):
        """校正步：利用模型输出修正预测误差"""
        # 简化校正：混合预测值和模型直接估计
        eps_from_x0 = (x_t - torch.sqrt(alpha_bar_t) * x0_pred) / torch.sqrt(1 - alpha_bar_t)
        eps_corrected = 0.5 * (eps_pred + eps_from_x0)
        x_corrected = (
            torch.sqrt(alpha_bar_prev) * x0_pred
            + torch.sqrt(1 - alpha_bar_prev) * eps_corrected
        )
        return x_corrected
```

**要点**：
- UniPC 的预测器利用多步历史做高阶外推，类似多步 Adams 方法
- 校正器通过在预测点处重新评估模型来修正误差
- 简化版省略了完整的 Λ 校正，实际实现参考原论文

### 练习二

**思路**：将多个 prompt 的 latent 和 conditioning batch 在一起，一次 U-Net 调用处理多个样本。

**答案**：

```python
@torch.no_grad()
def batch_call(
    self,
    prompts: List[str],
    height: int = 512,
    width: int = 512,
    num_inference_steps: int = 20,
    guidance_scale: float = 7.5,
    sampler_name: str = "euler",
    seed: Optional[int] = None,
    verbose: bool = True
) -> Dict:
    """批量推理：多个 prompt 共享 U-Net 调用"""
    batch_size = len(prompts)

    if seed is not None:
        torch.manual_seed(seed)

    # 批量编码文本
    conditionings = torch.cat([self.encode_text(p) for p in prompts])
    unconds = torch.zeros_like(conditionings)

    # 初始化噪声（batch 维度 = batch_size）
    latent_h, latent_w = height // 8, width // 8
    latents = torch.randn(batch_size, 4, latent_h, latent_w, device=self.device)

    sampler_cls = self.SAMPLER_REGISTRY[sampler_name]
    sampler = sampler_cls(self.schedule)

    timesteps = list(reversed(range(num_inference_steps)))

    for t_idx in timesteps:
        t = torch.full((batch_size,), t_idx, device=self.device, dtype=torch.long)

        # 一次 U-Net 调用处理整个 batch
        noise_cond = self.unet(latents, t, conditionings)
        noise_uncond = self.unet(latents, t, unconds)
        noise_guided = noise_uncond + guidance_scale * (noise_cond - noise_uncond)

        latents = sampler.step(noise_guided, t_idx, latents)

    images = self.decode_latent(latents)
    images = torch.clamp((images + 1) / 2, 0, 1)

    return {"images": [img for img in images]}

# 性能对比
def benchmark_batch():
    from tests.test_pipeline import MockUNet
    import time

    model = MockUNet()
    pipeline = DiffusionPipeline(unet=model, num_timesteps=20, device="cpu")

    prompts = ["a cat", "a dog", "a bird", "a fish"]

    # 逐个推理
    start = time.time()
    for p in prompts:
        pipeline(prompt=p, num_inference_steps=10, verbose=False)
    serial_time = time.time() - start

    # 批量推理
    start = time.time()
    pipeline.batch_call(prompts, num_inference_steps=10, verbose=False)
    batch_time = time.time() - start

    print(f"逐个推理: {serial_time:.2f}s")
    print(f"批量推理: {batch_time:.2f}s")
    print(f"加速比: {serial_time / batch_time:.1f}x")
```

**要点**：
- 批量推理的核心优势是 GPU 并行——batch_size 从 1 到 4 时，推理时间不会线性增长
- 在真实 SD 模型中，batch=4 的吞吐量通常是 batch=1 的 2-3 倍
- 注意显存限制：batch 过大会导致 OOM
