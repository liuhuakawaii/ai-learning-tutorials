# 第 6 课：阶段实战 — 从零搭建简化版 Diffusion 推理引擎

前面 5 课拆解了 Diffusion 的数学原理、Stable Diffusion 的架构、采样器和 Prompt 工程。现在要把这些知识串起来——从零实现一个能跑通的 Diffusion 推理引擎。

这个引擎包含完整的推理流水线：噪声调度、去噪采样、CFG 引导、文本条件注入。用 Mock U-Net 做测试，但架构设计与真实 Stable Diffusion 一致。完成后你能看清"跑一张图"时每一步做了什么。

## 项目结构

```
diffusion-engine/
├── engine/
│   ├── __init__.py
│   ├── noise_schedule.py      # 噪声调度器
│   ├── samplers.py            # 采样器
│   └── pipeline.py            # 推理流水线
├── tests/
│   └── test_pipeline.py       # 测试
└── demo.py                    # 演示
```

## 噪声调度器

调度器定义了"从干净到噪声"的数学路径。`α_t` 是每步信号保留比例，`ᾱ_t` 是累积信号保留比例。

```python
# engine/noise_schedule.py
import torch
import numpy as np

class NoiseSchedule:
    def __init__(self, num_timesteps=1000, schedule="linear", device="cpu"):
        self.T = num_timesteps
        self.device = device

        if schedule == "linear":
            betas = torch.linspace(1e-4, 0.02, num_timesteps)
        elif schedule == "cosine":
            steps = torch.arange(num_timesteps + 1, dtype=torch.float64) / num_timesteps
            ac = torch.cos((steps + 0.008) / 1.008 * np.pi / 2) ** 2
            ac = ac / ac[0]
            betas = 1 - (ac[1:] / ac[:-1])
            betas = torch.clamp(betas, 1e-4, 0.9999).float()
        else:
            raise ValueError(f"Unknown schedule: {schedule}")

        alphas = 1.0 - betas
        ac = torch.cumprod(alphas, dim=0)
        ac_prev = torch.cat([torch.tensor([1.0]), ac[:-1]])

        self.betas = betas.to(device)
        self.alphas = alphas.to(device)
        self.alphas_cumprod = ac.to(device)
        self.alphas_cumprod_prev = ac_prev.to(device)
        self.sqrt_ac = torch.sqrt(ac).to(device)
        self.sqrt_one_minus_ac = torch.sqrt(1.0 - ac).to(device)
        self.posterior_var = (betas * (1 - ac_prev) / (1 - ac)).to(device)

    def add_noise(self, x0, noise, t):
        """前向加噪：x_t = √(ᾱ_t) * x0 + √(1-ᾱ_t) * noise"""
        a = self.sqrt_ac[t].view(-1, 1, 1, 1)
        b = self.sqrt_one_minus_ac[t].view(-1, 1, 1, 1)
        return a * x0 + b * noise

    def get_snr(self):
        return self.alphas_cumprod / (1.0 - self.alphas_cumprod)
```

## 采样器实现

采样器用数值方法逆向求解去噪路径。不同采样器是精度和速度的权衡。

```python
# engine/samplers.py
import torch
from abc import ABC, abstractmethod

class BaseSampler(ABC):
    def __init__(self, schedule):
        self.s = schedule

    @abstractmethod
    def step(self, model_output, t, x_t, **kwargs):
        pass

    @torch.no_grad()
    def sample(self, model, shape, conditioning=None, steps=None,
               cfg_scale=7.5, device="cpu", verbose=True):
        x = torch.randn(shape, device=device)
        T = steps or self.s.T

        for t_idx in reversed(range(T)):
            t = torch.full((shape[0],), t_idx, device=device, dtype=torch.long)

            if conditioning is not None and cfg_scale > 1.0:
                noise_c = model(x, t, conditioning)
                noise_u = model(x, t, torch.zeros_like(conditioning))
                output = noise_u + cfg_scale * (noise_c - noise_u)
            else:
                output = model(x, t, conditioning)

            x = self.step(output, t_idx, x)

            if verbose and t_idx % 50 == 0:
                print(f"  Step {t_idx}/{T}")

        return x


class DDPMSampler(BaseSampler):
    def step(self, model_output, t, x_t, **kwargs):
        s = self.s
        coeff1 = 1.0 / torch.sqrt(s.alphas[t])
        coeff2 = s.betas[t] / torch.sqrt(1.0 - s.alphas_cumprod[t])
        mean = coeff1 * (x_t - coeff2 * model_output)

        if t > 0:
            sigma = torch.sqrt(s.posterior_var[t])
            return mean + sigma * torch.randn_like(x_t)
        return mean


class DDIMSampler(BaseSampler):
    def step(self, model_output, t, x_t, eta=0.0, **kwargs):
        s = self.s
        ac_t = s.alphas_cumprod[t]
        ac_prev = s.alphas_cumprod_prev[t]

        x0_pred = (x_t - torch.sqrt(1 - ac_t) * model_output) / torch.sqrt(ac_t)
        x0_pred = x0_pred.clamp(-1, 1)

        sigma = eta * torch.sqrt((1 - ac_prev) / (1 - ac_t)) * torch.sqrt(1 - ac_t / ac_prev)
        dir_xt = torch.sqrt(1 - ac_prev - sigma ** 2) * model_output

        if t > 0:
            return torch.sqrt(ac_prev) * x0_pred + dir_xt + sigma * torch.randn_like(x_t)
        return torch.sqrt(ac_prev) * x0_pred + dir_xt


class EulerSampler(BaseSampler):
    def step(self, model_output, t, x_t, **kwargs):
        s = self.s
        sigma_t = torch.sqrt((1 - s.alphas_cumprod[t]) / s.alphas_cumprod[t])
        if t > 0:
            sigma_prev = torch.sqrt((1 - s.alphas_cumprod[t-1]) / s.alphas_cumprod[t-1])
        else:
            sigma_prev = torch.tensor(0.0, device=x_t.device)
        dt = sigma_prev - sigma_t
        return x_t + dt * model_output
```

## 完整推理流水线

Pipeline 将所有组件串联：文本编码 → 噪声生成 → 逐步去噪（带 CFG） → 潜变量解码。

```python
# engine/pipeline.py
import torch
import time

class DiffusionPipeline:
    SAMPLERS = {
        "ddpm": DDPMSampler,
        "ddim": DDIMSampler,
        "euler": EulerSampler,
    }

    def __init__(self, unet, vae_decoder=None, text_encoder=None,
                 num_timesteps=1000, schedule_type="linear", device="cpu"):
        self.unet = unet
        self.vae_decoder = vae_decoder
        self.text_encoder = text_encoder
        self.device = device
        self.schedule = NoiseSchedule(num_timesteps, schedule_type, device)

    def encode_text(self, prompt):
        if self.text_encoder is None:
            return torch.randn(1, 77, 768, device=self.device)
        return self.text_encoder(prompt)

    def decode_latent(self, latent):
        if self.vae_decoder is None:
            return torch.nn.functional.interpolate(latent, scale_factor=8, mode='bilinear')
        return self.vae_decoder(latent)

    @torch.no_grad()
    def __call__(self, prompt, negative_prompt="", height=512, width=512,
                 steps=20, cfg_scale=7.5, sampler_name="euler", seed=None,
                 num_images=1, verbose=True):
        start = time.time()

        if seed is not None:
            torch.manual_seed(seed)

        cond = self.encode_text(prompt)
        uncond = self.encode_text(negative_prompt) if negative_prompt else torch.zeros_like(cond)

        latent = torch.randn(num_images, 4, height // 8, width // 8, device=self.device)

        sampler_cls = self.SAMPLERS[sampler_name]
        sampler = sampler_cls(self.schedule)

        if verbose:
            print(f"[Pipeline] {sampler_name}, {steps} steps, cfg={cfg_scale}")

        cond = cond.expand(num_images, -1, -1)
        uncond = uncond.expand(num_images, -1, -1)

        for t_idx in reversed(range(steps)):
            t = torch.full((num_images,), t_idx, device=self.device, dtype=torch.long)
            noise_c = self.unet(latent, t, cond)
            noise_u = self.unet(latent, t, uncond)
            guided = noise_u + cfg_scale * (noise_c - noise_u)
            latent = sampler.step(guided, t_idx, latent)

        images = self.decode_latent(latent)
        images = torch.clamp((images + 1) / 2, 0, 1)

        elapsed = time.time() - start
        if verbose:
            print(f"[Pipeline] Done in {elapsed:.2f}s")

        return {
            "images": [img for img in images],
            "metadata": {
                "prompt": prompt, "sampler": sampler_name,
                "steps": steps, "cfg": cfg_scale, "seed": seed,
                "elapsed": elapsed,
            },
        }
```

## 测试验证

用 Mock U-Net 验证流水线各组件的正确性：

```python
# tests/test_pipeline.py
import torch
import sys
sys.path.insert(0, "..")

from engine.noise_schedule import NoiseSchedule
from engine.samplers import DDPMSampler, DDIMSampler, EulerSampler
from engine.pipeline import DiffusionPipeline


class MockUNet(torch.nn.Module):
    def __init__(self, in_ch=4, out_ch=4, cond_dim=768):
        super().__init__()
        self.conv = torch.nn.Conv2d(in_ch, out_ch, 3, padding=1)
        self.cond_proj = torch.nn.Linear(cond_dim, out_ch)

    def forward(self, x, t, cond):
        noise = self.conv(x)
        bias = self.cond_proj(cond.mean(dim=1))
        return noise + bias.view(-1, noise.shape[1], 1, 1)


def test_noise_schedule():
    ns = NoiseSchedule(1000)
    assert (ns.alphas_cumprod[1:] <= ns.alphas_cumprod[:-1]).all(), "ᾱ_t 应单调递减"
    assert ns.alphas_cumprod[0] > 0.99
    assert ns.alphas_cumprod[-1] < 0.01

    x0 = torch.randn(2, 4, 8, 8)
    noise = torch.randn_like(x0)
    x_t = ns.add_noise(x0, noise, torch.tensor([500, 800]))
    assert x_t.shape == x0.shape
    print("✓ NoiseSchedule 测试通过")


def test_samplers():
    ns = NoiseSchedule(20, device="cpu")
    model = MockUNet().eval()
    x = torch.randn(1, 4, 8, 8)
    cond = torch.randn(1, 77, 768)

    for Cls in [DDPMSampler, DDIMSampler, EulerSampler]:
        sampler = Cls(ns)
        out = model(x, torch.tensor([10]), cond)
        x_prev = sampler.step(out, 10, x)
        assert x_prev.shape == x.shape
    print("✓ Sampler 测试通过")


def test_pipeline():
    model = MockUNet().eval()
    pipe = DiffusionPipeline(unet=model, num_timesteps=20, device="cpu")

    result = pipe(
        prompt="a test image", height=64, width=64,
        steps=5, cfg_scale=7.0, sampler_name="euler", seed=42, verbose=False,
    )
    assert len(result["images"]) == 1
    assert "metadata" in result
    print("✓ Pipeline 测试通过")


def test_batch():
    model = MockUNet().eval()
    pipe = DiffusionPipeline(unet=model, num_timesteps=20, device="cpu")
    result = pipe(prompt="batch test", height=64, width=64, steps=5,
                  num_images=4, verbose=False)
    assert len(result["images"]) == 4
    print("✓ Batch 生成测试通过")


if __name__ == "__main__":
    test_noise_schedule()
    test_samplers()
    test_pipeline()
    test_batch()
    print("\n🎉 全部测试通过")
```

## 性能分析

```python
# demo.py
import time
from tests.test_pipeline import MockUNet
from engine.pipeline import DiffusionPipeline

def compare_samplers():
    model = MockUNet().eval()
    pipe = DiffusionPipeline(unet=model, num_timesteps=20, device="cpu")

    for name in ["euler", "ddim", "ddpm"]:
        result = pipe(prompt="benchmark", height=64, width=64,
                      steps=10, sampler_name=name, seed=42, verbose=False)
        print(f"  {name}: {result['metadata']['elapsed']:.3f}s")

def compare_steps():
    model = MockUNet().eval()
    pipe = DiffusionPipeline(unet=model, num_timesteps=20, device="cpu")

    for steps in [5, 10, 20]:
        result = pipe(prompt="benchmark", height=64, width=64,
                      steps=steps, sampler_name="euler", seed=42, verbose=False)
        print(f"  steps={steps}: {result['metadata']['elapsed']:.3f}s")

if __name__ == "__main__":
    print("采样器对比:")
    compare_samplers()
    print("\n步数对比:")
    compare_steps()
```

在真实 Stable Diffusion 模型上，瓶颈在 U-Net 推理（占 90%+ 时间）。采样器选择影响不大，但步数选择直接影响总时间——DPM-Solver++ 用 20 步就能达到 DDPM 1000 步的质量。

## 练习

### 练习一：实现 DPM-Solver++ 二阶采样器

基于 `BaseSampler`，实现 DPM-Solver++ 二阶采样器。核心思路：在 log-SNR 空间做二阶外推，利用前两步的模型输出做更高精度的预测。对比 Euler 和 DPM-Solver++ 在 10 步和 20 步下的生成质量。

### 练习二：批量推理优化

修改 `DiffusionPipeline.__call__`，让多个 prompt 的 latent 和 conditioning 拼成 batch，一次 U-Net 调用处理。对比 batch=1 和 batch=4 的吞吐量。

---

## 参考答案

### 练习一

```python
class DPMPlusPlus2MSampler(BaseSampler):
    def __init__(self, schedule):
        super().__init__(schedule)
        self.cache = []
        self.prev_h = None

    def step(self, model_output, t, x_t, **kwargs):
        s = self.s
        self.cache.append(model_output.clone())

        ac_t = s.alphas_cumprod[t]
        lambda_t = 0.5 * torch.log(ac_t / (1 - ac_t))

        if t > 0:
            ac_prev = s.alphas_cumprod[t - 1]
            lambda_prev = 0.5 * torch.log(ac_prev / (1 - ac_prev))
        else:
            ac_prev = torch.tensor(1.0)
            lambda_prev = torch.tensor(20.0)

        h = lambda_prev - lambda_t

        if len(self.cache) >= 2 and t > 0 and self.prev_h is not None:
            D1, D2 = self.cache[-1], self.cache[-2]
            r = h / self.prev_h
            x_prev = (
                torch.sqrt(ac_prev / ac_t) * x_t
                - torch.sqrt(1 - ac_prev) * ((1 + 1/(2*r)) * D1 - 1/(2*r) * D2)
                * (torch.exp(-h) - 1)
            )
        else:
            x_prev = (
                torch.sqrt(ac_prev / ac_t) * x_t
                - torch.sqrt(1 - ac_prev) * model_output * (torch.exp(-h) - 1)
            )

        self.prev_h = h
        return x_prev
```

DPM-Solver++ 在 log-SNR 空间做高阶外推，比 Euler 的一阶近似更精确。10 步时 Euler 可能看到明显的伪影，DPM-Solver++ 仍然能保持不错的质量。

### 练习二

```python
@torch.no_grad()
def batch_call(self, prompts, height=512, width=512, steps=20,
               cfg_scale=7.5, sampler_name="euler", seed=None):
    bs = len(prompts)
    if seed is not None:
        torch.manual_seed(seed)

    conds = torch.cat([self.encode_text(p) for p in prompts])
    unconds = torch.zeros_like(conds)

    latent = torch.randn(bs, 4, height // 8, width // 8, device=self.device)
    sampler = self.SAMPLERS[sampler_name](self.schedule)

    for t_idx in reversed(range(steps)):
        t = torch.full((bs,), t_idx, device=self.device, dtype=torch.long)
        nc = self.unet(latent, t, conds)
        nu = self.unet(latent, t, unconds)
        guided = nu + cfg_scale * (nc - nu)
        latent = sampler.step(guided, t_idx, latent)

    images = self.decode_latent(latent)
    return {"images": [img for img in torch.clamp((images + 1) / 2, 0, 1)]}
```

GPU 并行的核心：batch_size 从 1 到 4 时，U-Net 推理时间不会线性增长。在真实 SD 模型上，batch=4 的吞吐量通常是 batch=1 的 2-3 倍。瓶颈在于显存——batch 过大会 OOM。
