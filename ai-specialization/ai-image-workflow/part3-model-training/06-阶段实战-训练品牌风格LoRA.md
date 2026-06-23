# 第 20 课：阶段实战 — 训练品牌风格 LoRA

潮牌 "VOID" 的创始人找到你。品牌以黑白灰为主色调，大量使用几何切割、高对比度光影、工业质感金属纹理。需求：训练一个 LoRA，让设计团队能快速生成符合品牌调性的营销素材。

你拿到 100 张品牌历史设计图。创始人要求："生成出来的东西，客户一眼能认出是 VOID 的。"

这节课从需求分析到训练到部署，走完整个流程。

## 品牌风格定义

训练前必须精确定义你要学的风格。模糊的定义 = 模糊的结果。

```
VOID 风格定义：

色彩：黑色 #1A1A1A、白色 #F5F5F5、灰色 #8A8A8A、金属银 #C0C0C0
      高对比度、低饱和度

构图：大量留白、几何切割（锐角三角形）、网格化排版、极简

质感：工业金属纹理、拉丝金属、混凝土、玻璃反射

字体：无衬线粗体、大写英文、字母间距大

氛围：冷峻、克制、未来感、高端
```

## 数据准备 Pipeline

```python
import shutil
import json
from pathlib import Path
from PIL import Image
import imagehash

class BrandDataPipeline:
    def __init__(self, brand_name: str, raw_dir: str, output_dir: str):
        self.brand = brand_name
        self.raw = Path(raw_dir)
        self.out = Path(output_dir)
        self.report = {"brand": brand_name, "stages": {}}

    def step1_filter(self, min_res=512):
        """初筛：分辨率、格式、大小"""
        valid, rejected = [], {"low_res": 0, "bad_format": 0}
        for p in self.raw.rglob("*"):
            if p.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
                continue
            try:
                with Image.open(p) as img:
                    w, h = img.size
                    if min(w, h) < min_res:
                        rejected["low_res"] += 1
                        continue
                    valid.append(p)
            except Exception:
                rejected["bad_format"] += 1
        self.report["stages"]["filter"] = {"valid": len(valid), "rejected": rejected}
        return valid

    def step2_dedup(self, images, threshold=6):
        """感知哈希去重"""
        hashes, unique = [], []
        for p in images:
            try:
                with Image.open(p) as img:
                    h = imagehash.phash(img, hash_size=16)
                    if not any(h - e <= threshold for e in hashes):
                        hashes.append(h)
                        unique.append(p)
            except Exception:
                continue
        self.report["stages"]["dedup"] = {"input": len(images), "output": len(unique)}
        return unique

    def step3_resize(self, images, target=1024):
        """统一尺寸"""
        resized = self.out / "resized"
        resized.mkdir(parents=True, exist_ok=True)
        for p in images:
            with Image.open(p) as img:
                w, h = img.size
                scale = max(target / w, target / h)
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
                left, top = (img.size[0] - target) // 2, (img.size[1] - target) // 2
                img = img.crop((left, top, left + target, top + target))
                img.save(resized / f"{p.stem}.png", "PNG")
        return resized

    def step4_caption(self, image_dir):
        """自动标注 + 风格描述"""
        cap_dir = self.out / "captions"
        cap_dir.mkdir(parents=True, exist_ok=True)
        trigger = f"{self.brand}_style"
        style = "high contrast black and white, geometric cuts, industrial metal texture, minimalist composition, futuristic aesthetic"

        for img in sorted(image_dir.glob("*.png")):
            # 实际应用 BLIP + WD Tagger，这里简化
            caption = f"{trigger}, {style}"
            (cap_dir / f"{img.stem}.txt").write_text(caption, encoding="utf-8")
        return cap_dir

    def step5_organize(self, image_dir, caption_dir, repeats=10):
        """组织 kohya-ss 数据集格式"""
        trigger = f"{self.brand}_style"
        train_dir = self.out / "train" / "img" / f"{repeats}_{trigger}"
        train_dir.mkdir(parents=True, exist_ok=True)

        for img in image_dir.glob("*.png"):
            shutil.copy2(img, train_dir / img.name)
        for cap in caption_dir.glob("*.txt"):
            shutil.copy2(cap, train_dir / cap.name)

        toml = f"""[[datasets]]
resolution = 1024
batch_size = 1
enable_bucket = true
bucket_reso_steps = 64
min_bucket_reso = 768
max_bucket_reso = 1024

[[datasets.subsets]]
image_dir = "{train_dir.as_posix()}"
num_repeats = {repeats}
shuffle_caption = true
keep_tokens = 1
caption_extension = ".txt"
flip_aug = true
color_aug = false
"""
        (self.out / "train" / "dataset.toml").write_text(toml, encoding="utf-8")
        return train_dir

    def run(self):
        imgs = self.step1_filter()
        unique = self.step2_dedup(imgs)
        resized = self.step3_resize(unique)
        caps = self.step4_caption(resized)
        self.step5_organize(resized, caps)
        (self.out / "report.json").write_text(
            json.dumps(self.report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Pipeline 完成: {len(unique)} 张图进入训练集")


pipeline = BrandDataPipeline("void", "./raw_brand_images", "./void_lora_dataset")
pipeline.run()
```

## 标注审查

自动标注需要人工审查。关键检查点：

```python
def review_captions(caption_dir: str):
    """审查标注质量"""
    issues = []
    for cap_path in sorted(Path(caption_dir).glob("*.txt")):
        caption = cap_path.read_text(encoding="utf-8")
        entry = {"file": cap_path.stem, "issues": []}

        if not caption.startswith("void_style"):
            entry["issues"].append("触发词不在开头")

        vague = ["nice", "good", "beautiful", "pretty"]
        for w in vague:
            if w in caption.lower():
                entry["issues"].append(f"模糊描述: '{w}'")

        style_kw = ["contrast", "geometric", "metal", "minimal"]
        found = sum(1 for k in style_kw if k in caption.lower())
        if found < 2:
            entry["issues"].append(f"风格关键词不足 ({found}/{len(style_kw)})")

        if entry["issues"]:
            issues.append(entry)

    print(f"审查: {len(issues)} 个标注需要修正")
    return issues
```

## 训练配置

```python
from dataclasses import dataclass

@dataclass
class VoidLoRAConfig:
    base_model: str = "stabilityai/stable-diffusion-xl-base-1.0"
    rank: int = 32           # 30 张图，rank 32 是安全选择
    alpha: int = 32
    learning_rate: float = 1e-4
    text_encoder_lr: float = 5e-5  # 保护语义理解能力
    max_epochs: int = 10     # 30 张 × 10 重复 = 300 步/epoch，10 epoch = 3000 步
    optimizer: str = "AdamW8bit"
    lr_scheduler: str = "cosine_with_restarts"
    lr_warmup_steps: int = 100
    mixed_precision: str = "bf16"
    gradient_checkpointing: bool = True
    cache_latents: bool = True
    save_every_n_epochs: int = 2
    output_dir: str = "./output/void_lora"

    def to_kohya_args(self) -> list:
        return [
            "--pretrained_model_name_or_path", self.base_model,
            "--output_dir", self.output_dir,
            "--output_name", "void_brand_style",
            "--save_every_n_epochs", str(self.save_every_n_epochs),
            "--network_module", "networks.lora",
            "--network_dim", str(self.rank),
            "--network_alpha", str(self.alpha),
            "--learning_rate", str(self.learning_rate),
            "--unet_lr", str(self.learning_rate),
            "--text_encoder_lr", str(self.text_encoder_lr),
            "--lr_scheduler", self.lr_scheduler,
            "--lr_warmup_steps", str(self.lr_warmup_steps),
            "--optimizer_type", self.optimizer,
            "--max_train_epochs", str(self.max_epochs),
            "--train_batch_size", "1",
            "--seed", "42",
            "--clip_skip", "2",
            "--resolution", "1024",
            "--enable_bucket",
            "--bucket_reso_steps", "64",
            "--min_bucket_reso", "768",
            "--max_bucket_reso", "1024",
            "--mixed_precision", self.mixed_precision,
            "--full_bf16",
            "--gradient_checkpointing",
            "--cache_latents",
            "--noise_offset", "0.1",
            "--flip_aug",
            "--dataset_config", "./void_lora_dataset/train/dataset.toml",
        ]

    def generate_script(self) -> str:
        args = " \\\n  ".join(self.to_kohya_args())
        return f"""#!/bin/bash
echo "VOID 品牌 LoRA 训练"
echo "rank={self.rank}, lr={self.learning_rate}, epochs={self.max_epochs}"
nvidia-smi --query-gpu=name,memory.free --format=csv
accelerate launch --num_cpu_threads_per_process=1 sdxl_train_network.py \\
  {args}
echo "训练完成!"
"""
```

## 训练监控

```python
import math, random

class TrainingMonitor:
    def __init__(self):
        self.history = []
        self.alerts = []

    def check(self, step, train_loss, val_loss=None):
        self.history.append({"step": step, "train": train_loss, "val": val_loss})

        if train_loss > 1.0:
            self.alerts.append(f"Step {step}: Loss 爆炸 ({train_loss:.4f})")

        if len(self.history) > 20:
            recent = [h["train"] for h in self.history[-20:]]
            var = sum((x - sum(recent)/len(recent))**2 for x in recent) / len(recent)
            if var > 0.01:
                self.alerts.append(f"Step {step}: Loss 震荡 (var={var:.4f})")

        if val_loss and len(self.history) > 50:
            t = [h["train"] for h in self.history[-50:]]
            v = [h["val"] for h in self.history[-50:] if h["val"]]
            if v and t[-1] < t[0] and v[-1] > v[0]:
                self.alerts.append(f"Step {step}: 过拟合")

    def best_checkpoint(self):
        vals = [(h["step"], h["val"]) for h in self.history if h["val"]]
        return min(vals, key=lambda x: x[1])[0] if vals else None
```

## 评估

```python
TEST_PROMPTS = [
    "void_style, product photography of a luxury watch, dark background",
    "void_style, fashion editorial, model in black outfit, geometric shadows",
    "void_style, interior design, concrete walls, metal furniture",
    "void_style, tech product showcase, smartphone on metal surface",
    "void_style, packaging design, matte black box, silver embossing",
]

def evaluate_lora(pipe, output_dir: str):
    """生成测试图并评估风格遵循度"""
    from pathlib import Path
    import torch

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    for i, prompt in enumerate(TEST_PROMPTS):
        for j in range(3):
            img = pipe(
                prompt=prompt,
                negative_prompt="colorful, saturated, cartoon, low quality",
                num_inference_steps=25, guidance_scale=7.5,
                width=1024, height=1024,
                generator=torch.Generator("cuda").manual_seed(42 + j),
            ).images[0]
            img.save(out / f"test_{i:02d}_{j:02d}.png")

    # CLIP Score 评估
    from transformers import CLIPProcessor, CLIPModel
    clip = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    proc = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

    scores = []
    for img_file in sorted(out.glob("*.png")):
        img = Image.open(img_file).convert("RGB")
        idx = int(img_file.stem.split("_")[1])
        inputs = proc(text=[TEST_PROMPTS[idx]], images=img, return_tensors="pt")
        with torch.no_grad():
            score = clip(**inputs).logits_per_image.item()
        scores.append(score)

    avg = sum(scores) / len(scores)
    print(f"CLIP Score: {avg:.1f}")
    if avg >= 28:
        print("✓ 风格遵循度: 良好")
    elif avg >= 25:
        print("△ 风格遵循度: 一般，建议增加训练轮次")
    else:
        print("✗ 风格遵循度: 差，检查数据质量")
```

## ComfyUI 集成

```python
import json

def build_lora_workflow(lora_path, strength=0.8):
    return {
        "1": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}},
        "2": {"class_type": "LoraLoader",
              "inputs": {"model": ["1", 0], "clip": ["1", 1],
                         "lora_name": lora_path,
                         "strength_model": strength, "strength_clip": strength}},
        "3": {"class_type": "CLIPTextEncode",
              "inputs": {"clip": ["2", 1],
                         "text": "void_style, product photography, dramatic lighting"}},
        "4": {"class_type": "CLIPTextEncode",
              "inputs": {"clip": ["2", 1],
                         "text": "colorful, saturated, cartoon, low quality"}},
        "5": {"class_type": "EmptyLatentImage",
              "inputs": {"width": 1024, "height": 1024, "batch_size": 1}},
        "6": {"class_type": "KSampler",
              "inputs": {"model": ["2", 0], "positive": ["3", 0],
                         "negative": ["4", 0], "latent_image": ["5", 0],
                         "seed": 42, "steps": 25, "cfg": 7.5,
                         "sampler_name": "euler_ancestral", "denoise": 1.0}},
        "7": {"class_type": "VAEDecode",
              "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {"class_type": "SaveImage",
              "inputs": {"images": ["7", 0], "filename_prefix": "void"}},
    }

workflow = build_lora_workflow("void_brand_style.safetensors")
json.dump(workflow, open("comfyui_void.json", "w"), indent=2)
```

LoRA 强度参考：0.5 概念探索，0.7 产品展示，0.8 品牌营销（最佳平衡），0.9 风格化艺术，1.0 不推荐。

## 迭代优化

训练通常需要 2-3 轮。第一轮保守参数验证方向，第二轮根据评估调整，第三轮精细打磨。

常见问题诊断：
- CLIP Score < 25 → 训练不足，增加 epoch 或提高 lr
- LPIPS > 0.5 → 过拟合，用较早的 checkpoint 或降低 rank
- 风格不强但稳定 → 补充更典型的风格图，改善标注

## 练习

### 练习一：完整实战

为一种视觉风格（赛博朋克/水彩画/像素艺术）训练 LoRA：收集 30-50 张图，执行完整 pipeline，训练并评估，集成到 ComfyUI。

### 练习二：参数对比

同一数据集，训练 3 个配置：rank=16/lr=1e-4、rank=32/lr=1e-4、rank=48/lr=5e-5。对比 CLIP Score 和一致性。

---

## 参考答案

### 练习一

以赛博朋克为例：风格定义（霓虹蓝/粉、暗色调、密集城市建筑、雨天反射），标注强调霓虹色调和暗色背景，负面提示词排除"明亮、自然光、田园"。rank=32, lr=1e-4, 10 epoch 是安全起点。

### 练习二

典型结果：rank16 CLIP=26.8 LPIPS=0.22（风格弱但稳定），rank32 CLIP=29.1 LPIPS=0.28（最佳平衡），rank48 CLIP=30.5 LPIPS=0.38（风格强但一致性下降）。推荐 rank32——更大的 rank 需要更低的 lr，否则过拟合风险高。
