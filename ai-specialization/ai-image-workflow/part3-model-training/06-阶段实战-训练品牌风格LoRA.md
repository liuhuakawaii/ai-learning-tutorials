# 第 6 课：阶段实战 — 训练品牌风格 LoRA

## 场景引入

潮牌 "VOID" 的创始人找到你。品牌以黑白灰为主色调，大量使用几何切割、高对比度光影、工业质感的金属纹理，搭配极简排版。创始人希望训练一个 LoRA 模型，让设计团队能快速生成符合品牌调性的营销素材——社交媒体图、产品展示、场景渲染——而不需要每次都从零设计。

你拿到了 100 张品牌历史设计图，涵盖了海报、产品图、社交媒体素材。创始人的要求很简单："生成出来的东西，客户一眼就能认出是 VOID 的。"

这是 Part 3 的阶段实战课。我们将从需求分析开始，经历数据准备、训练配置、训练执行、评估优化、集成部署的完整流程，把前 5 课学到的所有知识串联成一条可复用的工程 pipeline。

## 学习目标

完成本课后，你将能够：
1. 从品牌需求出发规划 LoRA 训练项目
2. 执行完整的数据准备到训练到部署流程
3. 在训练过程中进行实时监控和参数调整
4. 使用定量和定性指标评估训练结果
5. 将训练好的 LoRA 集成到 ComfyUI 工作流中

## 一、需求分析与项目规划

### 1.1 品牌风格定义

训练品牌风格 LoRA 的第一步不是准备数据，而是**精确定义你要学的风格**。模糊的风格定义会导致模糊的训练结果。

```
VOID 品牌风格定义：

色彩：
  - 主色调: 黑色 (#1A1A1A), 白色 (#F5F5F5), 灰色 (#8A8A8A)
  - 强调色: 金属银 (#C0C0C0), 偶尔的深红 (#8B0000)
  - 特征: 高对比度、低饱和度

构图：
  - 大量留白
  - 几何切割（锐角三角形、不规则四边形）
  - 网格化排版
  - 极简主义，元素少而精

质感：
  - 工业金属纹理
  - 拉丝金属表面
  - 混凝土质感
  - 玻璃反射

字体：
  - 无衬线粗体
  - 大写英文字母
  - 字母间距大

氛围：
  - 冷峻、克制
  - 未来感、科技感
  - 高端、奢侈
```

这个定义将指导后续的数据筛选、标注策略和评估标准。

### 1.2 项目时间线

```
┌─────────────────────────────────────────────────────────────┐
│              VOID 品牌 LoRA 训练项目时间线                    │
│                                                             │
│  Day 1: 需求确认与数据收集                                    │
│  ├── 确认风格定义（与创始人对齐）                              │
│  ├── 收集 100 张品牌历史设计图                                │
│  └── 初步筛选，剔除明显不符合的图片                            │
│                                                             │
│  Day 2: 数据清洗与标注                                        │
│  ├── 分辨率统一、去重                                        │
│  ├── 自动标注 (BLIP-2 + WD Tagger)                          │
│  ├── 人工审查与修正                                          │
│  └── 组织 kohya-ss 目录结构                                  │
│                                                             │
│  Day 3-4: 训练与监控                                         │
│  ├── 第一轮训练（保守参数，快速验证）                          │
│  ├── 中间 checkpoint 评估                                    │
│  ├── 参数调整                                                │
│  └── 第二轮训练（优化参数）                                   │
│                                                             │
│  Day 5: 评估与部署                                           │
│  ├── 定量评估 (CLIP Score, FID)                              │
│  ├── 定性评估 (视觉检查, A/B 测试)                            │
│  ├── 选择最优 checkpoint                                     │
│  └── ComfyUI 工作流集成                                      │
└─────────────────────────────────────────────────────────────┘
```

## 二、数据准备 Pipeline

### 2.1 数据采集与初筛

```python
"""
brand_data_pipeline.py
品牌风格 LoRA 数据准备 Pipeline

从原始品牌素材到 kohya-ss 训练数据的完整流程。
"""

import shutil
import json
from pathlib import Path
from PIL import Image
import imagehash

class BrandDataPipeline:
    """品牌数据准备 Pipeline"""

    def __init__(self, brand_name: str, raw_dir: str, output_dir: str):
        self.brand_name = brand_name
        self.raw_dir = Path(raw_dir)
        self.output_dir = Path(output_dir)
        self.report = {
            "brand": brand_name,
            "stages": {},
        }

    def step1_collect_and_filter(self, min_resolution: int = 512) -> list[Path]:
        """Step 1: 收集并初筛图片"""
        print("=" * 60)
        print("Step 1: 收集与初筛")
        print("=" * 60)

        valid_images = []
        rejected = {"low_res": 0, "bad_format": 0, "too_small": 0}

        for img_path in self.raw_dir.rglob("*"):
            if img_path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
                continue

            try:
                with Image.open(img_path) as img:
                    w, h = img.size
                    if min(w, h) < min_resolution:
                        rejected["low_res"] += 1
                        continue
                    if w * h < 500_000:  # 小于 0.5MP
                        rejected["too_small"] += 1
                        continue
                    valid_images.append(img_path)
            except Exception:
                rejected["bad_format"] += 1

        print(f"  原始图片: {len(valid_images) + sum(rejected.values())} 张")
        print(f"  通过筛选: {len(valid_images)} 张")
        print(f"  拒绝原因: 分辨率低={rejected['low_res']}, "
              f"格式错误={rejected['bad_format']}, 太小={rejected['too_small']}")

        self.report["stages"]["collect"] = {
            "valid": len(valid_images),
            "rejected": rejected,
        }
        return valid_images

    def step2_deduplicate(self, images: list[Path], threshold: int = 6) -> list[Path]:
        """Step 2: 感知哈希去重"""
        print(f"\n{'='*60}")
        print("Step 2: 去重")
        print("=" * 60)

        hashes = []
        unique_images = []

        for img_path in images:
            try:
                with Image.open(img_path) as img:
                    h = imagehash.phash(img, hash_size=16)
                    is_dup = False
                    for existing_h in hashes:
                        if h - existing_h <= threshold:
                            is_dup = True
                            break
                    if not is_dup:
                        hashes.append(h)
                        unique_images.append(img_path)
            except Exception:
                continue

        removed = len(images) - len(unique_images)
        print(f"  输入: {len(images)} 张")
        print(f"  去重后: {len(unique_images)} 张 (移除 {removed} 张)")

        self.report["stages"]["dedup"] = {
            "input": len(images),
            "output": len(unique_images),
            "removed": removed,
        }
        return unique_images

    def step3_resize_and_crop(self, images: list[Path], target_size: int = 1024) -> Path:
        """Step 3: 统一尺寸"""
        print(f"\n{'='*60}")
        print("Step 3: 统一尺寸到 {target_size}×{target_size}")
        print("=" * 60)

        resized_dir = self.output_dir / "resized"
        resized_dir.mkdir(parents=True, exist_ok=True)

        for img_path in images:
            with Image.open(img_path) as img:
                w, h = img.size
                scale = max(target_size / w, target_size / h)
                new_w, new_h = int(w * scale), int(h * scale)
                img = img.resize((new_w, new_h), Image.LANCZOS)

                left = (new_w - target_size) // 2
                top = (new_h - target_size) // 2
                img = img.crop((left, top, left + target_size, top + target_size))

                output_path = resized_dir / f"{img_path.stem}.png"
                img.save(output_path, "PNG")

        count = len(list(resized_dir.glob("*.png")))
        print(f"  输出: {count} 张 ({target_size}×{target_size})")
        self.report["stages"]["resize"] = {"count": count, "target": target_size}
        return resized_dir

    def step4_auto_caption(self, image_dir: Path) -> Path:
        """Step 4: 自动标注"""
        print(f"\n{'='*60}")
        print("Step 4: 自动标注")
        print("=" * 60)

        caption_dir = self.output_dir / "captions"
        caption_dir.mkdir(parents=True, exist_ok=True)

        # 品牌风格描述模板
        # 根据 VOID 的风格定义定制
        style_descriptors = [
            "high contrast black and white",
            "geometric cuts",
            "industrial metal texture",
            "minimalist composition",
            "futuristic aesthetic",
            "brushed metal surface",
            "concrete texture",
            "glass reflection",
            "bold sans-serif typography",
        ]

        trigger_word = f"{self.brand_name}_style"

        for img_path in sorted(image_dir.glob("*.png")):
            # 这里简化处理，实际应使用 BLIP-2 + WD Tagger
            # 参考第 1 课的 AutoCaptioner 实现
            caption = f"{trigger_word}, {', '.join(style_descriptors[:5])}"

            caption_path = caption_dir / f"{img_path.stem}.txt"
            caption_path.write_text(caption, encoding="utf-8")

        count = len(list(caption_dir.glob("*.txt")))
        print(f"  标注完成: {count} 张")
        print(f"  触发词: {trigger_word}")
        self.report["stages"]["caption"] = {"count": count, "trigger_word": trigger_word}
        return caption_dir

    def step5_organize_dataset(self, image_dir: Path, caption_dir: Path, repeats: int = 10):
        """Step 5: 组织 kohya-ss 数据集格式"""
        print(f"\n{'='*60}")
        print("Step 5: 组织训练数据集")
        print("=" * 60)

        trigger_word = f"{self.brand_name}_style"
        train_img_dir = self.output_dir / "train" / "img" / f"{repeats}_{trigger_word}"
        train_img_dir.mkdir(parents=True, exist_ok=True)

        # 复制图片
        for img_path in image_dir.glob("*.png"):
            shutil.copy2(img_path, train_img_dir / img_path.name)

        # 复制标注
        for cap_path in caption_dir.glob("*.txt"):
            shutil.copy2(cap_path, train_img_dir / cap_path.name)

        # 生成 dataset.toml
        toml_content = f"""# VOID 品牌风格 LoRA 数据集配置
# 自动生成

[[datasets]]
resolution = 1024
batch_size = 1
enable_bucket = true
bucket_reso_steps = 64
min_bucket_reso = 768
max_bucket_reso = 1024

[[datasets.subsets]]
image_dir = "{train_img_dir.as_posix()}"
num_repeats = {repeats}
shuffle_caption = true
keep_tokens = 1
caption_extension = ".txt"
is_reg = false
flip_aug = true
color_aug = false
"""
        toml_path = self.output_dir / "train" / "dataset.toml"
        toml_path.write_text(toml_content, encoding="utf-8")

        count = len(list(train_img_dir.glob("*.png")))
        print(f"  训练图片: {count} 张 (每 epoch 重复 {repeats} 次)")
        print(f"  数据集配置: {toml_path}")
        self.report["stages"]["organize"] = {
            "image_count": count,
            "repeats": repeats,
            "dataset_toml": str(toml_path),
        }

    def run_full_pipeline(self):
        """执行完整 Pipeline"""
        print(f"品牌风格 LoRA 数据准备 Pipeline")
        print(f"品牌: {self.brand_name}")
        print(f"输入: {self.raw_dir}")
        print(f"输出: {self.output_dir}")
        print()

        # 执行各步骤
        images = self.step1_collect_and_filter()
        unique = self.step2_deduplicate(images)
        resized_dir = self.step3_resize_and_crop(unique)
        caption_dir = self.step4_auto_caption(resized_dir)
        self.step5_organize_dataset(resized_dir, caption_dir)

        # 保存报告
        report_path = self.output_dir / "pipeline_report.json"
        report_path.write_text(
            json.dumps(self.report, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        print(f"\n{'='*60}")
        print("Pipeline 完成!")
        print(f"报告: {report_path}")
        print(f"{'='*60}")

        return self.report


# 运行 Pipeline
pipeline = BrandDataPipeline(
    brand_name="void",
    raw_dir="./raw_brand_images",
    output_dir="./void_lora_dataset",
)
pipeline.run_full_pipeline()
```

### 2.2 人工审查清单

自动处理完成后，人工审查是必不可少的环节：

```python
class CaptionReviewTool:
    """标注审查工具

    帮助快速审查和修正自动标注的质量。
    输出审查报告，标记需要修正的项目。
    """

    def __init__(self, image_dir: str, caption_dir: str):
        self.image_dir = Path(image_dir)
        self.caption_dir = Path(caption_dir)
        self.reviews = []

    def review_batch(self) -> list[dict]:
        """批量审查标注质量"""
        issues = []

        for cap_path in sorted(self.caption_dir.glob("*.txt")):
            caption = cap_path.read_text(encoding="utf-8")
            img_path = self.image_dir / f"{cap_path.stem}.png"

            entry = {
                "file": cap_path.stem,
                "caption": caption,
                "issues": [],
            }

            # 检查常见问题
            # 1. 触发词是否在最前面
            if not caption.startswith("void_style"):
                entry["issues"].append("触发词不在 caption 开头")

            # 2. 是否有模糊描述
            vague_words = ["nice", "good", "beautiful", "pretty", "cool"]
            for word in vague_words:
                if word in caption.lower():
                    entry["issues"].append(f"包含模糊描述: '{word}'")

            # 3. 风格关键词是否充足
            style_keywords = ["contrast", "geometric", "metal", "minimal", "industrial"]
            found = sum(1 for kw in style_keywords if kw in caption.lower())
            if found < 2:
                entry["issues"].append(f"风格关键词不足 (仅找到 {found}/{len(style_keywords)})")

            # 4. Caption 长度检查
            if len(caption) < 20:
                entry["issues"].append("Caption 过短")
            elif len(caption) > 300:
                entry["issues"].append("Caption 过长，可能包含过多无关描述")

            if entry["issues"]:
                issues.append(entry)

        # 打印审查报告
        total = len(list(self.caption_dir.glob("*.txt")))
        problem_count = len(issues)

        print(f"标注审查报告")
        print(f"{'='*60}")
        print(f"总标注数: {total}")
        print(f"有问题: {problem_count} ({problem_count/total*100:.0f}%)")
        print()

        for entry in issues:
            print(f"  {entry['file']}:")
            print(f"    Caption: {entry['caption'][:80]}...")
            for issue in entry["issues"]:
                print(f"    ⚠ {issue}")
            print()

        return issues

    def suggest_fixes(self, issues: list[dict]) -> dict:
        """为每个问题提供修正建议"""
        fixes = {}
        for entry in issues:
            file_fixes = []
            for issue in entry["issues"]:
                if "触发词" in issue:
                    file_fixes.append("将 'void_style' 移到 caption 最前面")
                elif "模糊描述" in issue:
                    file_fixes.append("替换模糊词为具体视觉特征描述")
                elif "风格关键词" in issue:
                    file_fixes.append("添加: high contrast, geometric cuts, industrial texture")
                elif "过短" in issue:
                    file_fixes.append("补充风格描述和场景描述")
                elif "过长" in issue:
                    file_fixes.append("精简内容描述，保留风格特征和核心元素")
            fixes[entry["file"]] = file_fixes
        return fixes


# 使用示例
reviewer = CaptionReviewTool(
    image_dir="./void_lora_dataset/resized",
    caption_dir="./void_lora_dataset/captions",
)
issues = reviewer.review_batch()
fixes = reviewer.suggest_fixes(issues)
```

## 三、训练配置与执行

### 3.1 训练配置

```python
"""
train_void_lora.py
VOID 品牌风格 LoRA 训练脚本

基于 kohya-ss sd-scripts 的 SDXL LoRA 训练。
"""

from dataclasses import dataclass

@dataclass
class VoidLoRAConfig:
    """VOID 品牌 LoRA 训练配置"""

    # ── 模型 ──
    base_model: str = "stabilityai/stable-diffusion-xl-base-1.0"
    # 选择 SDXL 而非 SD3/FLUX 的原因：
    # 1. 生态最成熟，社区资源多
    # 2. 1024×1024 足够品牌素材需求
    # 3. 12GB 显存可训练（RTX 4070 Ti）

    # ── LoRA ──
    rank: int = 32
    alpha: int = 32
    # 30 张去重后的图，rank 32 是安全选择
    # rank 64 可能过拟合，rank 16 可能欠拟合

    # ── 学习率 ──
    learning_rate: float = 1e-4
    text_encoder_lr: float = 5e-5
    # SDXL 推荐值
    # text_encoder_lr 更低，保护语义理解能力

    # ── 训练轮次 ──
    max_epochs: int = 10
    # 30 张图 × 10 重复 = 300 步/epoch
    # 10 epochs = 3000 总步数
    # 对于风格 LoRA，这个步数通常足够

    # ── 优化器 ──
    optimizer: str = "AdamW8bit"
    # AdamW8bit 在 12GB 显存上是最佳选择

    # ── 学习率调度 ──
    lr_scheduler: str = "cosine_with_restarts"
    lr_warmup_steps: int = 100
    lr_restart_count: int = 1
    # cosine_with_restarts 帮助跳出局部最优

    # ── 显存优化 ──
    mixed_precision: str = "bf16"
    gradient_checkpointing: bool = True
    cache_latents: bool = True

    # ── 正则化 ──
    dropout: float = 0.05
    caption_dropout: float = 0.05
    # 低 dropout，因为数据量不大，过拟合风险中等

    # ── 保存 ──
    save_every_n_epochs: int = 2
    output_dir: str = "./output/void_lora"

    def to_kohya_args(self) -> list[str]:
        """生成 kohya-ss 训练命令行参数"""
        args = [
            "--pretrained_model_name_or_path", self.base_model,
            "--output_dir", self.output_dir,
            "--output_name", "void_brand_style",
            "--save_every_n_epochs", str(self.save_every_n_epochs),
            "--save_model_as", "safetensors",

            # LoRA
            "--network_module", "networks.lora",
            "--network_dim", str(self.rank),
            "--network_alpha", str(self.alpha),

            # 学习率
            "--learning_rate", str(self.learning_rate),
            "--unet_lr", str(self.learning_rate),
            "--text_encoder_lr", str(self.text_encoder_lr),
            "--lr_scheduler", self.lr_scheduler,
            "--lr_warmup_steps", str(self.lr_warmup_steps),

            # 优化器
            "--optimizer_type", self.optimizer,

            # 训练
            "--max_train_epochs", str(self.max_epochs),
            "--train_batch_size", "1",
            "--seed", "42",
            "--clip_skip", "2",

            # 分辨率
            "--resolution", "1024",
            "--enable_bucket",
            "--bucket_reso_steps", "64",
            "--min_bucket_reso", "768",
            "--max_bucket_reso", "1024",

            # 显存优化
            "--mixed_precision", self.mixed_precision,
            "--full_bf16",
            "--gradient_checkpointing",
            "--cache_latents",

            # SDXL 特有
            "--noise_offset", "0.1",

            # 数据增强
            "--flip_aug",
            "--caption_dropout_rate", str(self.caption_dropout),

            # 数据集
            "--dataset_config", "./void_lora_dataset/train/dataset.toml",
        ]
        return args

    def generate_train_script(self) -> str:
        """生成完整的训练脚本"""
        args = " \\\n  ".join(self.to_kohya_args())
        script = f"""#!/bin/bash
# VOID 品牌风格 LoRA 训练脚本
# 基于 kohya-ss sd-scripts

# 环境检查
echo "=========================================="
echo "VOID 品牌风格 LoRA 训练"
echo "=========================================="
echo "基模型: {self.base_model}"
echo "LoRA rank: {self.rank}, alpha: {self.alpha}"
echo "学习率: {self.learning_rate}"
echo "训练轮次: {self.max_epochs}"
echo "优化器: {self.optimizer}"
echo "=========================================="

# 确认 GPU 状态
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv

# 开始训练
accelerate launch --num_cpu_threads_per_process=1 \\
  sdxl_train_network.py \\
  {args}

echo "训练完成!"
"""
        return script


# 生成配置和脚本
config = VoidLoRAConfig()
script = config.generate_train_script()

# 保存脚本
from pathlib import Path
Path("./train_void_lora.sh").write_text(script, encoding="utf-8")
print("训练脚本已生成: ./train_void_lora.sh")
print("\n脚本内容预览:")
print(script)
```

### 3.2 训练监控

```python
class TrainingMonitor:
    """训练实时监控器

    监控训练过程中的关键指标，
    在出现异常时及时报警。
    """

    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.loss_history = []
        self.alerts = []

    def check_loss(self, step: int, train_loss: float, val_loss: float | None = None):
        """检查 loss 是否正常"""
        self.loss_history.append({
            "step": step,
            "train_loss": train_loss,
            "val_loss": val_loss,
        })

        # 检查 loss 爆炸
        if train_loss > 1.0:
            self.alerts.append({
                "step": step,
                "type": "loss_explosion",
                "message": f"⚠ Loss 爆炸: {train_loss:.4f} > 1.0",
                "action": "建议降低学习率或检查数据",
            })

        # 检查 loss 震荡
        if len(self.loss_history) > 20:
            recent = [h["train_loss"] for h in self.loss_history[-20:]]
            variance = sum((x - sum(recent)/len(recent))**2 for x in recent) / len(recent)
            if variance > 0.01:
                self.alerts.append({
                    "step": step,
                    "type": "loss_oscillation",
                    "message": f"⚠ Loss 震荡: 方差={variance:.4f}",
                    "action": "建议降低学习率或增加 warmup",
                })

        # 检查过拟合
        if val_loss is not None and len(self.loss_history) > 50:
            recent_train = [h["train_loss"] for h in self.loss_history[-50:]]
            recent_val = [h["val_loss"] for h in self.loss_history[-50:] if h["val_loss"]]
            if recent_val:
                train_trend = recent_train[-1] - recent_train[0]
                val_trend = recent_val[-1] - recent_val[0]
                if train_trend < -0.01 and val_trend > 0.01:
                    self.alerts.append({
                        "step": step,
                        "type": "overfitting",
                        "message": f"⚠ 过拟合: train loss 下降但 val loss 上升",
                        "action": "建议使用较早的 checkpoint 或增加正则化",
                    })

    def print_status(self):
        """打印当前训练状态"""
        if not self.loss_history:
            print("暂无训练数据")
            return

        latest = self.loss_history[-1]
        print(f"\n训练状态 (Step {latest['step']})")
        print(f"  Train Loss: {latest['train_loss']:.4f}")
        if latest["val_loss"]:
            print(f"  Val Loss:   {latest['val_loss']:.4f}")

        if self.alerts:
            print(f"\n  警报 ({len(self.alerts)}):")
            for alert in self.alerts[-3:]:  # 只显示最近 3 条
                print(f"    {alert['message']}")
                print(f"    → {alert['action']}")
        else:
            print("  ✓ 训练正常")

    def find_best_checkpoint(self) -> int | None:
        """找到最优 checkpoint"""
        val_steps = [
            (h["step"], h["val_loss"])
            for h in self.loss_history
            if h["val_loss"] is not None
        ]
        if not val_steps:
            return None
        return min(val_steps, key=lambda x: x[1])[0]


# 使用示例
monitor = TrainingMonitor("./output/void_lora")

# 模拟训练过程
import random, math
for step in range(200):
    base_loss = 0.12 * math.exp(-step / 150)
    train_loss = base_loss + random.gauss(0, 0.003)
    val_loss = base_loss * 1.1 + random.gauss(0, 0.005) if step % 10 == 0 else None

    monitor.check_loss(step, max(0, train_loss), val_loss)

    if step % 50 == 0:
        monitor.print_status()

# 最终状态
print("\n" + "=" * 60)
print("训练结束")
monitor.print_status()
best_step = monitor.find_best_checkpoint()
if best_step:
    print(f"\n最优 checkpoint: step {best_step}")
```

## 四、评估与优化

### 4.1 定量评估

```python
"""
evaluate_void_lora.py
VOID LoRA 评估脚本
"""

class VoidLoRAEvaluator:
    """VOID 品牌 LoRA 综合评估器"""

    # 标准测试 prompt 集
    TEST_PROMPTS = [
        "void_style, product photography of a luxury watch, dark background, dramatic lighting",
        "void_style, fashion editorial, model in black outfit, geometric shadows",
        "void_style, interior design, concrete walls, metal furniture, minimalist",
        "void_style, social media post, brand logo, high contrast black and white",
        "void_style, tech product showcase, smartphone on metal surface, studio lighting",
        "void_style, urban architecture, glass and steel building, overcast sky",
        "void_style, packaging design, matte black box, silver embossing",
        "void_style, abstract geometric composition, triangles and circles, monochrome",
    ]

    def __init__(self, device: str = "cuda"):
        self.device = device
        self.clip_eval = CLIPScoreEvaluator(device=device)

    def generate_test_images(self, pipe, output_dir: str, num_per_prompt: int = 3):
        """生成测试图片"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        for i, prompt in enumerate(self.TEST_PROMPTS):
            for j in range(num_per_prompt):
                image = pipe(
                    prompt=prompt,
                    negative_prompt="colorful, saturated, cartoon, anime, illustration",
                    num_inference_steps=25,
                    guidance_scale=7.5,
                    width=1024,
                    height=1024,
                    generator=torch.Generator(device=self.device).manual_seed(42 + j),
                ).images[0]

                filename = f"test_{i:02d}_{j:02d}.png"
                image.save(output_path / filename)
                print(f"  生成: {filename}")

    def evaluate_style_adherence(self, image_dir: str) -> dict:
        """评估风格遵循度"""
        print("\n风格遵循度评估")
        print("=" * 60)

        # VOID 风格的关键词
        style_keywords = [
            "high contrast", "black and white", "geometric",
            "minimalist", "industrial", "metal",
            "dark", "monochrome", "sharp",
        ]

        results = {}
        image_path = Path(image_dir)

        for img_file in sorted(image_path.glob("*.png")):
            # 使用 CLIP 计算图片与风格关键词的匹配度
            img = Image.open(img_file).convert("RGB")
            prompt_idx = int(img_file.stem.split("_")[1])
            original_prompt = self.TEST_PROMPTS[prompt_idx]

            # CLIP Score against original prompt
            clip_score = self.clip_eval.score_single(img, original_prompt)

            results[img_file.name] = {
                "clip_score": round(clip_score, 3),
                "prompt": original_prompt,
            }

        # 统计
        scores = [r["clip_score"] for r in results.values()]
        stats = {
            "mean": round(sum(scores) / len(scores), 3),
            "std": round((sum((s - sum(scores)/len(scores))**2 for s in scores) / len(scores))**0.5, 3),
            "min": round(min(scores), 3),
            "max": round(max(scores), 3),
        }

        print(f"\nCLIP Score 统计:")
        print(f"  平均: {stats['mean']}")
        print(f"  标准差: {stats['std']}")
        print(f"  最低: {stats['min']}")
        print(f"  最高: {stats['max']}")

        # 判断
        if stats["mean"] >= 28:
            print("\n✓ 风格遵循度: 良好")
        elif stats["mean"] >= 25:
            print("\n△ 风格遵循度: 一般，建议增加训练轮次或调整数据")
        else:
            print("\n✗ 风格遵循度: 较差，需要检查数据质量和训练配置")

        return {"scores": results, "stats": stats}

    def evaluate_consistency(self, image_dir: str) -> dict:
        """评估生成一致性"""
        print("\n生成一致性评估")
        print("=" * 60)

        image_path = Path(image_dir)
        # 按 prompt 分组
        groups = {}
        for img_file in sorted(image_path.glob("*.png")):
            prompt_idx = int(img_file.stem.split("_")[1])
            if prompt_idx not in groups:
                groups[prompt_idx] = []
            groups[prompt_idx].append(str(img_file))

        consistency_eval = StyleConsistencyEvaluator(device=self.device)

        results = {}
        for prompt_idx, img_paths in groups.items():
            if len(img_paths) < 2:
                continue
            lpips = consistency_eval.compute_pairwise_lpips(img_paths)
            results[prompt_idx] = {
                "lpips": round(lpips, 4),
                "num_images": len(img_paths),
                "prompt": self.TEST_PROMPTS[prompt_idx][:50],
            }
            print(f"  Prompt {prompt_idx}: LPIPS={lpips:.4f} ({len(img_paths)} 张)")

        avg_lpips = sum(r["lpips"] for r in results.values()) / len(results)
        print(f"\n平均 LPIPS: {avg_lpips:.4f}")

        if avg_lpips < 0.3:
            print("✓ 生成一致性: 良好")
        elif avg_lpips < 0.5:
            print("△ 生成一致性: 一般")
        else:
            print("✗ 生成一致性: 较差，可能过拟合")

        return results

    def full_evaluation(self, image_dir: str) -> dict:
        """执行完整评估"""
        print("=" * 60)
        print("VOID 品牌 LoRA 综合评估")
        print("=" * 60)

        results = {
            "style_adherence": self.evaluate_style_adherence(image_dir),
            "consistency": self.evaluate_consistency(image_dir),
        }

        # 综合判断
        clip_mean = results["style_adherence"]["stats"]["mean"]
        avg_lpips = sum(
            r["lpips"] for r in results["consistency"].values()
        ) / len(results["consistency"])

        print(f"\n{'='*60}")
        print("综合评估结果")
        print("=" * 60)
        print(f"  CLIP Score (对齐度): {clip_mean:.3f}")
        print(f"  LPIPS (一致性):      {avg_lpips:.4f}")

        # 综合评分
        score = 0
        if clip_mean >= 28:
            score += 40
        elif clip_mean >= 25:
            score += 25
        if avg_lpips < 0.3:
            score += 30
        elif avg_lpips < 0.5:
            score += 20
        # 风格关键词检查 + 30 分（人工）
        score += 25  # 假设人工评估给 25/30

        if score >= 80:
            grade = "A - 可以部署"
        elif score >= 60:
            grade = "B - 需要微调"
        else:
            grade = "C - 需要重新训练"

        print(f"\n  综合评分: {score}/100")
        print(f"  等级: {grade}")

        results["overall"] = {"score": score, "grade": grade}
        return results
```

### 4.2 迭代优化策略

```python
class LoRAOptimizer:
    """LoRA 迭代优化策略"""

    @staticmethod
    def diagnose_and_recommend(eval_results: dict, training_config: dict) -> dict:
        """根据评估结果诊断问题并推荐优化方案"""
        recommendations = []

        clip_score = eval_results.get("style_adherence", {}).get("stats", {}).get("mean", 0)
        avg_lpips = 0
        consistency = eval_results.get("consistency", {})
        if consistency:
            lpips_values = [r.get("lpips", 0) for r in consistency.values()]
            avg_lpips = sum(lpips_values) / len(lpips_values) if lpips_values else 0

        # 诊断 1: CLIP Score 低 → 模型没学到风格
        if clip_score < 25:
            recommendations.append({
                "issue": "风格学习不足 (CLIP Score < 25)",
                "causes": [
                    "训练轮次不够",
                    "学习率太低",
                    "数据质量差或标注不准确",
                    "LoRA rank 太小",
                ],
                "actions": [
                    "增加 3-5 个 epoch",
                    "将学习率提高到 2e-4",
                    "检查并改善标注质量",
                    "将 rank 从 32 提高到 48",
                ],
                "priority": "高",
            })

        # 诊断 2: LPIPS 高 → 生成不稳定
        if avg_lpips > 0.5:
            recommendations.append({
                "issue": f"生成一致性差 (LPIPS={avg_lpips:.3f})",
                "causes": [
                    "过拟合",
                    "数据量太少",
                    "LoRA rank 太大",
                ],
                "actions": [
                    "使用较早的 checkpoint",
                    "减少 2-3 个 epoch",
                    "降低 rank 到 16",
                    "增加数据增强",
                ],
                "priority": "高",
            })

        # 诊断 3: CLIP Score 中等但一致性好
        if 25 <= clip_score < 28 and avg_lpips < 0.3:
            recommendations.append({
                "issue": "风格学习中等，但生成稳定",
                "causes": [
                    "数据中风格特征不够鲜明",
                    "标注中风格关键词不够精确",
                ],
                "actions": [
                    "改善标注：增加更多风格描述词",
                    "在 caption 中把风格词放在更前面",
                    "考虑补充 10-20 张更典型的品牌图",
                ],
                "priority": "中",
            })

        if not recommendations:
            recommendations.append({
                "issue": "模型表现良好",
                "causes": [],
                "actions": [
                    "可以部署到生产环境",
                    "建议保留当前 checkpoint 作为基线",
                ],
                "priority": "低",
            })

        # 打印诊断报告
        print("\n诊断报告")
        print("=" * 60)
        for rec in recommendations:
            print(f"\n问题: {rec['issue']} (优先级: {rec['priority']})")
            if rec["causes"]:
                print("可能原因:")
                for cause in rec["causes"]:
                    print(f"  - {cause}")
            print("建议操作:")
            for action in rec["actions"]:
                print(f"  → {action}")

        return recommendations


# 完整评估流程
evaluator = VoidLoRAEvaluator(device="cuda")

# 假设已生成测试图片
# evaluator.generate_test_images(pipe, "./test_void_lora")

# 评估
results = evaluator.full_evaluation("./test_void_lora")

# 诊断
optimizer = LoRAOptimizer()
recommendations = optimizer.diagnose_and_recommend(
    results,
    training_config={"rank": 32, "lr": 1e-4, "epochs": 10},
)
```

## 五、ComfyUI 工作流集成

### 5.1 LoRA 加载与参数调优

```python
"""
comfyui_integration.py
将训练好的 LoRA 集成到 ComfyUI 工作流

生成 ComfyUI 工作流 JSON 和使用指南。
"""

import json

class ComfyUIWorkflowBuilder:
    """ComfyUI 工作流构建器"""

    @staticmethod
    def build_lora_workflow(
        lora_path: str,
        base_model: str = "sd_xl_base_1.0.safetensors",
        lora_strength: float = 0.8,
        negative_prompt: str = "colorful, saturated, cartoon, anime, illustration, low quality",
    ) -> dict:
        """构建包含 LoRA 的 ComfyUI 工作流

        Args:
            lora_path: LoRA 文件路径
            base_model: 基模型文件名
            lora_strength: LoRA 强度 (0.0-1.0)
            negative_prompt: 负面提示词
        """
        workflow = {
            "1": {
                "class_type": "CheckpointLoaderSimple",
                "inputs": {
                    "ckpt_name": base_model,
                },
            },
            "2": {
                "class_type": "LoraLoader",
                "inputs": {
                    "model": ["1", 0],
                    "clip": ["1", 1],
                    "lora_name": lora_path,
                    "strength_model": lora_strength,
                    "strength_clip": lora_strength,
                },
            },
            "3": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "clip": ["2", 1],
                    "text": "void_style, product photography, dramatic lighting, dark background",
                },
            },
            "4": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "clip": ["2", 1],
                    "text": negative_prompt,
                },
            },
            "5": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                    "width": 1024,
                    "height": 1024,
                    "batch_size": 1,
                },
            },
            "6": {
                "class_type": "KSampler",
                "inputs": {
                    "model": ["2", 0],
                    "positive": ["3", 0],
                    "negative": ["4", 0],
                    "latent_image": ["5", 0],
                    "seed": 42,
                    "steps": 25,
                    "cfg": 7.5,
                    "sampler_name": "euler_ancestral",
                    "scheduler": "normal",
                    "denoise": 1.0,
                },
            },
            "7": {
                "class_type": "VAEDecode",
                "inputs": {
                    "samples": ["6", 0],
                    "vae": ["1", 2],
                },
            },
            "8": {
                "class_type": "SaveImage",
                "inputs": {
                    "images": ["7", 0],
                    "filename_prefix": "void_brand",
                },
            },
        }
        return workflow

    @staticmethod
    def generate_usage_guide(lora_name: str) -> str:
        """生成使用指南"""
        guide = f"""# {lora_name} 使用指南

## 安装

1. 将 LoRA 文件放入 ComfyUI 的 `models/loras/` 目录
2. 重启 ComfyUI 或刷新模型列表

## 推荐参数

### LoRA 强度
- 产品展示: 0.7-0.8 (风格明显但不过度)
- 社交媒体: 0.8-0.9 (风格强烈)
- 概念探索: 0.5-0.7 (风格柔和)

### Prompt 格式
```
void_style, [场景描述], [风格修饰词]
```

示例:
```
void_style, luxury watch on concrete surface, dramatic side lighting, high contrast
void_style, fashion model in black coat, geometric shadows, industrial backdrop
void_style, tech product packaging, matte black finish, silver accents, studio lighting
```

### 负面提示词
```
colorful, saturated, cartoon, anime, illustration, low quality, blurry, watermark
```

### 采样器设置
- 采样器: euler_ancestral 或 dpmpp_2m
- 调度器: normal
- 步数: 20-30
- CFG: 7.0-8.0

## 常见问题

### Q: 生成的图风格不够强？
A: 增加 LoRA 强度到 0.85-0.95，或在 prompt 中加强风格描述

### Q: 生成的图有伪影？
A: 降低 LoRA 强度到 0.6-0.7，或减少训练步数

### Q: 想要更柔和的风格？
A: 使用较早的 checkpoint（如 epoch 6 而不是 epoch 10），或降低 LoRA 强度
"""
        return guide


# 使用示例
builder = ComfyUIWorkflowBuilder()

# 生成工作流
workflow = builder.build_lora_workflow(
    lora_path="void_brand_style.safetensors",
    lora_strength=0.8,
)

# 保存工作流
workflow_json = json.dumps(workflow, indent=2)
Path("./comfyui_void_workflow.json").write_text(workflow_json, encoding="utf-8")
print("ComfyUI 工作流已保存: comfyui_void_workflow.json")

# 生成使用指南
guide = builder.generate_usage_guide("VOID Brand Style LoRA")
Path("./VOID_LoRA_使用指南.md").write_text(guide, encoding="utf-8")
print("使用指南已保存: VOID_LoRA_使用指南.md")
```

### 5.2 参数调优参考

```
LoRA 强度对生成效果的影响：

强度    效果                              适用场景
────────────────────────────────────────────────────
0.3    风格几乎不可见                      不推荐
0.5    轻微风格化，保留基模型大部分特征      概念探索、风格混合
0.7    明显风格化，细节保留好               产品展示、广告素材
0.8    强烈风格化，最佳平衡点               品牌营销、社交媒体
0.9    非常强烈的风格，可能牺牲细节          风格化艺术
1.0    最大风格强度，可能出现伪影            不推荐

推荐工作流：
1. 先用 0.8 生成一组图，评估风格强度
2. 如果风格太弱，逐步提高到 0.85, 0.9
3. 如果出现伪影，降低到 0.75, 0.7
4. 找到"风格明显且无伪影"的甜点
```

## 六、常见误区

### 误区一：数据集越多越好，先把所有品牌图都丢进去

100 张品牌历史设计图中，可能有 30 张是早期风格不成熟的、20 张是与其他品牌联名的混合风格、10 张是低分辨率的截图。全部丢进去会让模型学到"不一致的品牌风格"。数据筛选的质量比数量重要得多——50 张风格一致的图，效果远好于 100 张风格混杂的图。

### 误区二：训练轮次越多，风格学得越充分

风格 LoRA 的训练轮次有一个最优区间。太少（3-5 epoch）学不到风格特征，太多（20+ epoch）会过拟合到训练数据的具体内容。对于 30-50 张图的数据集，8-12 个 epoch 通常是最佳范围。超过这个范围，模型会开始"背"训练图而不是"学"风格。

### 误区三：训练完就可以直接用，不需要评估

不评估就部署是最危险的做法。一个过拟合的 LoRA 在某些 prompt 下可能生成非常好的图，但在其他 prompt 下完全崩溃。没有评估，你不知道模型的"能力边界"在哪里。10 分钟的评估可以避免在生产环境中出现质量问题。

### 误区四：LoRA 强度越高越好

LoRA 强度不是越高越好的旋钮。强度过高会导致两个问题：（1）风格过于强烈，生成的图看起来不自然；（2）与基模型的特征冲突，产生伪影。最佳强度通常在 0.7-0.85 之间，需要根据具体场景微调。

### 误区五：一次训练就能得到满意的结果

品牌风格 LoRA 通常需要 2-3 轮迭代优化。第一轮用保守参数快速验证方向是否正确，第二轮根据评估结果调整参数，第三轮精细打磨。期望一次训练就得到完美结果是不现实的。

## 小结

本课完成了一个真实的品牌风格 LoRA 训练项目：

- **需求分析**：精确定义品牌风格是训练成功的前提。模糊的定义 = 模糊的结果
- **数据准备**：采集、筛选、去重、标注、人工审查，每一步都影响最终质量
- **训练配置**：根据数据量和显存选择合适的 rank、学习率、优化器
- **训练监控**：实时监控 loss 和关键指标，及时发现问题
- **评估优化**：定量（CLIP Score、LPIPS）+ 定性（视觉检查）综合评估
- **集成部署**：ComfyUI 工作流集成和参数调优指南

整个流程的核心原则：**先定义清楚"好"是什么标准，再去追求它**。没有明确的风格定义和评估标准，训练就是盲目的。

## 练习

### 练习一：完整项目实战

按照本课的流程，为自己喜欢的一种视觉风格训练一个 LoRA：
1. 选择一种明确的风格（如：赛博朋克、水彩画、像素艺术等）
2. 收集 30-50 张该风格的图片
3. 执行完整的数据准备 pipeline
4. 训练 LoRA 并进行评估
5. 将 LoRA 集成到 ComfyUI 并生成一组测试图

### 练习二：参数调优实验

使用同一数据集，训练 3 个不同配置的 LoRA：
1. rank=16, lr=1e-4（保守配置）
2. rank=32, lr=1e-4（标准配置）
3. rank=48, lr=5e-5（精细配置）

对比三者的 CLIP Score 和视觉质量，找出最优配置。

### 练习三：评估报告

对你训练的 LoRA 撰写一份正式的评估报告，包含：
1. 数据集描述（数量、来源、筛选标准）
2. 训练配置摘要
3. Loss 曲线分析
4. CLIP Score 统计
5. 视觉检查结果（附示例图）
6. 结论与改进建议

---

## 参考答案

### 练习一

**思路**：选择一种风格明确、数据容易获取的视觉风格。赛博朋克是一个好选择——特征鲜明（霓虹灯、暗色调、高对比度），网上有大量参考图。

**答案**：

```python
"""
练习一：赛博朋克风格 LoRA 训练
"""

# Step 1: 风格定义
cyberpunk_style = {
    "色彩": ["霓虹蓝 #00FFFF", "霓虹粉 #FF1493", "深紫 #1A0033", "暗黑 #0D0D0D"],
    "构图": ["低角度仰拍", "密集的城市建筑", "雨天反射", "烟雾/蒸汽"],
    "质感": ["霓虹灯光晕", "湿润的街道表面", "全息投影", "CRT 扫描线"],
    "氛围": ["未来都市", "高科技低生活", "黑暗压抑", "科技感"],
}

# Step 2: 数据准备
pipeline = BrandDataPipeline(
    brand_name="cyberpunk",
    raw_dir="./raw_cyberpunk_images",
    output_dir="./cyberpunk_lora_dataset",
)
pipeline.run_full_pipeline()

# Step 3: 训练配置
config = SDXLTrainingConfig(
    lora_rank=32,
    learning_rate=1e-4,
    max_train_epochs=10,
    mixed_precision="bf16",
)
config.save("./cyberpunk_train_config.toml")

# Step 4: 训练（使用 kohya-ss）
# python sdxl_train_network.py --dataset_config ./cyberpunk_lora_dataset/train/dataset.toml ...

# Step 5: 评估
evaluator = VoidLoRAEvaluator(device="cuda")
# 修改 TEST_PROMPTS 为赛博朋克相关
evaluator.TEST_PROMPTS = [
    "cyberpunk_style, neon-lit street at night, rainy, reflections on wet pavement",
    "cyberpunk_style, futuristic cityscape, towering skyscrapers, holographic billboards",
    "cyberpunk_style, cybernetic character, glowing eyes, dark alley",
    "cyberpunk_style, tech marketplace, vendors with neon signs, crowded",
]
results = evaluator.full_evaluation("./test_cyberpunk_lora")
```

**要点**：
- 风格定义越具体，训练效果越好
- 赛博朋克的霓虹色调和暗色背景是核心特征，标注中要强调
- 负面提示词要排除"明亮、自然光、田园"等与风格矛盾的元素

### 练习二

**思路**：控制变量法，只改变 rank 和 lr，其他参数完全一致。

**答案**：

```python
"""
练习二：参数调优实验
"""

configs = [
    {"name": "保守", "rank": 16, "lr": 1e-4, "alpha": 16},
    {"name": "标准", "rank": 32, "lr": 1e-4, "alpha": 32},
    {"name": "精细", "rank": 48, "lr": 5e-5, "alpha": 48},
]

# 模拟评估结果
results = {
    "保守 (rank16)": {"clip": 26.8, "lpips": 0.22, "note": "风格稍弱但稳定"},
    "标准 (rank32)": {"clip": 29.1, "lpips": 0.28, "note": "最佳平衡"},
    "精细 (rank48)": {"clip": 30.5, "lpips": 0.38, "note": "风格强但一致性下降"},
}

print("参数调优实验结果")
print("=" * 60)
print(f"{'配置':<20} {'CLIP Score':<12} {'LPIPS':<10} {'备注'}")
print("-" * 60)
for name, r in results.items():
    print(f"{name:<20} {r['clip']:<12.1f} {r['lpips']:<10.3f} {r['note']}")

print("\n推荐: 标准配置 (rank32, lr=1e-4)")
print("理由: CLIP Score 和 LPIPS 的综合表现最好")
print("      rank48 虽然 CLIP 更高，但 LPIPS 上升说明过拟合风险")
```

**要点**：
- rank 和 lr 是互相影响的，更大的 rank 需要更低的 lr
- 不能只看 CLIP Score，需要同时考虑一致性（LPIPS）
- 30 张图的数据集，rank 32 是性价比最高的选择

### 练习三

**思路**：评估报告需要结构化、数据化、有结论。

**答案**：

```markdown
# VOID 品牌风格 LoRA 评估报告

## 1. 项目概述
- 品牌: VOID (潮牌)
- 目标: 训练品牌风格 LoRA，用于批量生成营销素材
- 基模型: SDXL 1.0
- 训练日期: 2026-06-20

## 2. 数据集
- 数量: 50 张（从 100 张原始图筛选）
- 筛选标准: 分辨率≥512, 风格一致, 无重复
- 来源: 品牌历史设计稿
- 标注: BLIP-2 + WD Tagger + 人工审查

## 3. 训练配置
- LoRA rank: 32, alpha: 32
- 学习率: 1e-4 (U-Net), 5e-5 (Text Encoder)
- 优化器: AdamW8bit
- 训练轮次: 10
- 总步数: 3000

## 4. Loss 曲线分析
- Train Loss: 0.15 → 0.04 (下降 73%)
- Val Loss: 0.15 → 0.06 (下降 60%)
- 过拟合检测: 无过拟合
- 最优 checkpoint: epoch 8

## 5. 定量评估
- CLIP Score: 29.1 ± 3.2 (良好)
- LPIPS 一致性: 0.28 (良好)

## 6. 视觉检查
- 风格一致性: ✓ 色调、构图、质感均符合品牌调性
- 内容准确性: ✓ 主体生成正确，细节清晰
- 伪影检测: △ 部分图有轻微色块，降低 LoRA 强度到 0.75 可解决

## 7. 结论
- 模型质量: B+ (良好，可部署)
- 推荐 LoRA 强度: 0.75-0.80
- 改进建议: 补充 10 张金属质感特写图，增强材质学习

## 8. 部署建议
- ComfyUI 工作流: 已生成，LoRA 强度默认 0.8
- 适用场景: 产品展示、社交媒体、品牌海报
- 不适用场景: 需要彩色的场景、需要写实风格的场景
```

**要点**：
- 评估报告需要数据支撑，不能只有主观判断
- 要明确指出模型的适用场景和不适用场景
- 改进建议要具体可执行，不能泛泛而谈
