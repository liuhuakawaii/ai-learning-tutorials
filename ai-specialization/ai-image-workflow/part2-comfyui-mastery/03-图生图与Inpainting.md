# 第 9 课：图生图与 Inpainting — 局部重绘与风格迁移

## 场景引入

文生图解决了"从无到有"的问题，但实际工作中更常见的需求是"在已有图像上做修改"：

- 电商产品图需要更换背景，但保持产品不变
- 人像照片需要修改表情或发型
- 老照片修复需要填补缺失区域
- 设计稿需要在特定区域添加元素

这些场景需要图生图（Image-to-Image）和 Inpainting（局部重绘）技术。本课将系统讲解这两种技术在 ComfyUI 中的实现方式。

## 学习目标

完成本课后，你将能够：
1. 理解图生图的 denoise 参数控制机制
2. 实现 Inpainting 局部重绘工作流
3. 掌握蒙版（Mask）的创建和使用
4. 理解 Outpainting（画布扩展）的实现
5. 构建风格迁移工作流

## 一、图生图基础

### 1.1 Denoise 的物理含义

```
图生图的核心参数：denoise（去噪强度）

  denoise = 0.0：完全保留原图，什么都不改
  denoise = 0.3：保留 70% 原图结构，轻微修改
  denoise = 0.5：平衡原图和新内容
  denoise = 0.7：大幅修改，保留大致构图
  denoise = 1.0：完全忽略原图，等同于文生图

  数学原理：
    x_t = √(ᾱ_t) · x0 + √(1-ᾱ_t) · ε
    denoise 决定了从哪个 t 开始去噪：
      denoise=1.0 → 从 t=T（纯噪声）开始
      denoise=0.5 → 从 t=T/2（半噪声）开始
      denoise=0.0 → 从 t=0（原图）开始

  ┌─────────────────────────────────────┐
  │  denoise 与起始时间步的关系            │
  │                                      │
  │  1.0 ──→ ████████████████████  全噪声 │
  │  0.8 ──→ ████████████████░░░░  80%噪  │
  │  0.5 ──→ ██████████░░░░░░░░░░  50%噪  │
  │  0.3 ──→ ██████░░░░░░░░░░░░░░  30%噪  │
  │  0.0 ──→ ░░░░░░░░░░░░░░░░░░░░  原图   │
  └─────────────────────────────────────┘
```

### 1.2 图生图工作流

```python
import json

def create_img2img_workflow():
    """图生图工作流"""
    workflow = {
        # 加载模型
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}
        },
        # 加载输入图像
        "2": {
            "class_type": "LoadImage",
            "inputs": {"image": "input_photo.png"}
        },
        # 编码图像到潜空间
        "3": {
            "class_type": "VAEEncode",
            "inputs": {
                "pixels": ["2", 0],  # IMAGE
                "vae": ["1", 2]      # VAE
            }
        },
        # 正向条件
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "oil painting style, impressionist, "
                        "thick brush strokes, vibrant colors",
                "clip": ["1", 1]
            }
        },
        # 负向条件
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "blurry, low quality, distorted",
                "clip": ["1", 1]
            }
        },
        # KSampler（关键：denoise < 1.0）
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["4", 0],
                "negative": ["5", 0],
                "latent_image": ["3", 0],  # 编码后的潜变量
                "seed": 42,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 0.6  # 保留 40% 原图结构
            }
        },
        # 解码
        "7": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["1", 2]}
        },
        # 保存
        "8": {
            "class_type": "SaveImage",
            "inputs": {"images": ["7", 0], "filename_prefix": "img2img"}
        }
    }
    return workflow
```

## 二、Inpainting 局部重绘

### 2.1 蒙版（Mask）的概念

```
Inpainting 的核心：蒙版控制

  原图：                    蒙版：
  ┌─────────────────┐     ┌─────────────────┐
  │                 │     │                 │
  │    ┌───────┐    │     │    ┌───────┐    │
  │    │ 人脸  │    │     │    │███████│    │
  │    │       │    │     │    │███████│    │
  │    └───────┘    │     │    └───────┘    │
  │                 │     │                 │
  └─────────────────┘     └─────────────────┘

  蒙版白色区域 = 需要重绘的区域
  蒙版黑色区域 = 保持不变的区域

  Inpainting 的工作方式：
    1. 将原图编码到潜空间
    2. 在蒙版区域注入噪声
    3. 只对蒙版区域执行去噪
    4. 蒙版外的区域保持原样
```

### 2.2 Inpainting 工作流

```python
def create_inpainting_workflow():
    """Inpainting 局部重绘工作流"""
    workflow = {
        # 加载 Inpainting 专用模型（如果有）
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": "sd-v1-5-inpainting.safetensors"
            }
        },
        # 加载原图
        "2": {
            "class_type": "LoadImage",
            "inputs": {"image": "original.png"}
        },
        # 创建蒙版（从图像的 alpha 通道或单独的蒙版图）
        "3": {
            "class_type": "LoadImage",
            "inputs": {"image": "mask.png"}
        },
        # 将蒙版转换为正确的格式
        "4": {
            "class_type": "ImageToMask",
            "inputs": {
                "image": ["3", 0],
                "channel": "red"  # 使用红色通道作为蒙版
            }
        },
        # 编码原图（带蒙版）
        "5": {
            "class_type": "VAEEncodeForInpaint",
            "inputs": {
                "pixels": ["2", 0],
                "vae": ["1", 2],
                "mask": ["4", 0],
                "grow_mask_by": 6  # 蒙版扩展像素数（混合边缘）
            }
        },
        # 正向条件
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "a happy smile, detailed face, natural skin",
                "clip": ["1", 1]
            }
        },
        # 负向条件
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "deformed, distorted, bad anatomy, blurry",
                "clip": ["1", 1]
            }
        },
        # 采样（denoise=1.0，因为蒙版区域需要完全重绘）
        "8": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
                "seed": 42,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0
            }
        },
        # 解码
        "9": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["8", 0], "vae": ["1", 2]}
        },
        # 保存
        "10": {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": "inpaint"}
        }
    }
    return workflow
```

### 2.3 蒙版扩展与羽化

```python
"""
蒙版处理技巧

1. grow_mask_by（蒙版扩展）：
   将蒙版边界向外扩展 N 个像素
   目的：避免重绘区域与原图之间出现明显的接缝
   推荐值：4-12 像素

2. 羽化（Feathering）：
   在蒙版边界创建渐变过渡
   ComfyUI 使用 "Mask Smooth" 节点实现
   推荐：先扩展再羽化

3. 反转蒙版：
   使用 "InvertMask" 节点
   场景：想保留蒙版区域，修改其他区域

处理流程：
  原始蒙版 → 扩展(6px) → 羽化(3px) → 送入 Inpainting

ComfyUI 节点链：
  LoadImage → ImageToMask → GrowMask → MaskSmooth → VAEEncodeForInpaint
"""
```

## 三、Outpainting 画布扩展

### 3.1 Outpainting 原理

```
Outpainting：向外扩展图像

  原图（512×512）：           扩展后（768×768）：
  ┌─────────────┐           ┌───────────────────┐
  │             │           │  ░░░░░░░░░░░░░░░░  │
  │             │           │  ░░░░░░░░░░░░░░░░  │
  │   原始图像   │    →      │  ░░┌─────────┐░░░  │
  │             │           │  ░░│ 原始图像 │░░░  │
  │             │           │  ░░└─────────┘░░░  │
  │             │           │  ░░░░░░░░░░░░░░░░  │
  └─────────────┘           └───────────────────┘

  ░░ = 需要生成的区域（蒙版）

  实现方式：
  1. 创建更大的空白画布
  2. 将原图放在中心
  3. 创建蒙版标记空白区域
  4. 用 Inpainting 生成空白区域
```

```python
def create_outpainting_workflow():
    """Outpainting 画布扩展工作流"""
    workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "sd-v1-5-inpainting.safetensors"}
        },
        "2": {
            "class_type": "LoadImage",
            "inputs": {"image": "original.png"}
        },
        # 图像缩放（保持比例，适应新画布）
        "3": {
            "class_type": "ImageScale",
            "inputs": {
                "image": ["2", 0],
                "upscale_method": "lanczos",
                "width": 512,
                "height": 512,
                "crop": "disabled"
            }
        },
        # 创建扩展后的空白画布
        "4": {
            "class_type": "EmptyImage",
            "inputs": {
                "width": 768,
                "height": 768,
                "batch_size": 1,
                "color": 0  # 黑色
            }
        },
        # 将原图合成到画布中心
        "5": {
            "class_type": "ImageCompositeMasked",
            "inputs": {
                "destination": ["4", 0],
                "source": ["3", 0],
                "x": 128,  # 居中偏移
                "y": 128,
                "resize_source": False
            }
        },
        # 创建蒙版（标记需要生成的区域）
        "6": {
            "class_type": "SolidMask",
            "inputs": {
                "value": 1.0,  # 白色（需要生成）
                "width": 768,
                "height": 768
            }
        },
        # 在中心区域创建"不需要生成"的蒙版
        "7": {
            "class_type": "SolidMask",
            "inputs": {
                "value": 0.0,  # 黑色（保持原图）
                "width": 512,
                "height": 512
            }
        },
        # 合成蒙版
        "8": {
            "class_type": "CompositeMasked",
            "inputs": {
                "destination": ["6", 0],
                "source": ["7", 0],
                "x": 128,
                "y": 128
            }
        },
        # 正向条件
        "9": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "seamless continuation of the scene, "
                        "consistent style and lighting",
                "clip": ["1", 1]
            }
        },
        "10": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "seams, artifacts, inconsistent style",
                "clip": ["1", 1]
            }
        },
        # Inpainting
        "11": {
            "class_type": "VAEEncodeForInpaint",
            "inputs": {
                "pixels": ["5", 0],
                "vae": ["1", 2],
                "mask": ["8", 0],
                "grow_mask_by": 10
            }
        },
        "12": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["9", 0],
                "negative": ["10", 0],
                "latent_image": ["11", 0],
                "seed": 42,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0
            }
        },
        "13": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["12", 0], "vae": ["1", 2]}
        },
        "14": {
            "class_type": "SaveImage",
            "inputs": {"images": ["13", 0], "filename_prefix": "outpaint"}
        }
    }
    return workflow
```

## 四、风格迁移

### 4.1 基于图生图的风格迁移

```python
"""
风格迁移工作流设计

策略一：低 denoise + 风格 prompt
  适用：保留原图构图，只改变风格
  denoise: 0.3-0.5
  prompt: 描述目标风格

策略二：ControlNet + 风格 prompt
  适用：精确保留构图，自由控制风格
  使用 ControlNet（Canny/Depth）提取结构
  denoise: 1.0（完全重绘）

策略三：IP-Adapter + 风格参考图
  适用：参考另一张图的风格
  用风格参考图驱动生成
  可以同时保持内容和风格

选择指南：
  快速风格迁移 → 策略一
  精确控制 → 策略二
  参考特定风格 → 策略三
"""
```

### 4.2 风格迁移参数表

```python
STYLE_TRANSFER_CONFIGS = {
    "油画": {
        "prompt": "oil painting, thick brush strokes, impasto texture, "
                  "rich colors, impressionist style",
        "denoise": 0.55,
        "cfg": 8.0
    },
    "水彩": {
        "prompt": "watercolor painting, translucent washes, "
                  "soft edges, wet-on-wet technique",
        "denoise": 0.50,
        "cfg": 7.0
    },
    "动漫": {
        "prompt": "anime style, cel shading, vibrant colors, "
                  "clean lines, detailed eyes",
        "denoise": 0.65,
        "cfg": 9.0
    },
    "素描": {
        "prompt": "pencil sketch, graphite drawing, "
                  "detailed shading, cross-hatching",
        "denoise": 0.60,
        "cfg": 7.5
    },
    "像素画": {
        "prompt": "pixel art, 16-bit style, retro game aesthetic, "
                  "limited color palette",
        "denoise": 0.70,
        "cfg": 8.5
    }
}
```

## 五、高级 Inpainting 技巧

### 5.1 分区域 Inpainting

```python
def create_multi_region_inpainting():
    """
    分区域 Inpainting：不同区域使用不同的 prompt

    场景：同时修改背景和人物服装，但使用不同的描述
    """
    workflow = {
        # ... 模型加载、图像加载 ...

        # 区域 1：背景
        "region1_mask": {
            "class_type": "LoadImage",
            "inputs": {"image": "background_mask.png"}
        },
        "region1_prompt": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "tropical beach, sunset, palm trees",
                "clip": ["loader", 1]
            }
        },

        # 区域 2：服装
        "region2_mask": {
            "class_type": "LoadImage",
            "inputs": {"image": "clothing_mask.png"}
        },
        "region2_prompt": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "elegant red evening dress, silk fabric",
                "clip": ["loader", 1]
            }
        },

        # 使用 ConditioningSetArea 分配区域条件
        # 每个区域的条件只在对应蒙版内生效
    }
    return workflow
```

### 5.2 Inpainting 模型选择

```python
"""
Inpainting 模型对比

1. 专用 Inpainting 模型（sd-v1-5-inpainting.safetensors）：
   优势：对蒙版边缘处理更好，融合更自然
   劣势：模型选择少，通常是 SD 1.5 架构
   推荐场景：精确的局部重绘

2. 标准模型 + VAEEncodeForInpaint：
   优势：可以使用任意模型（SDXL、SD3、FLUX）
   劣势：蒙版边缘可能有接缝
   推荐场景：使用特定模型时

3. 标准模型 + ControlNet Inpaint：
   优势：结合 ControlNet 的结构控制
   劣势：配置更复杂
   推荐场景：需要保持结构的重绘

选择建议：
  SD 1.5 → 使用专用 Inpainting 模型
  SDXL   → 标准模型 + VAEEncodeForInpaint
  SD3/FLUX → 标准模型 + ControlNet
"""
```

## 六、常见误区

### 误区一：denoise 越低越好

denoise 过低（<0.2）会导致新内容与原图风格不融合，看起来像"贴上去的"。建议从 0.4 开始调整。

### 误区二：蒙版边缘不需要处理

蒙版边缘的处理是 Inpainting 质量的关键。必须使用 grow_mask_by 扩展蒙版，并做羽化过渡。

### 误区三：任何模型都能做 Inpainting

标准模型在 Inpainting 时效果不如专用模型。如果使用 SD 1.5，强烈建议使用专用 Inpainting checkpoint。

### 误区四：Outpainting 可以无限扩展

每次扩展都会引入新的生成区域，多次扩展后质量会显著下降。建议每次扩展不超过原图尺寸的 50%。

## 七、小结

1. **图生图的核心是 denoise 参数**，控制原图保留和新内容生成的平衡
2. **Inpainting 使用蒙版控制重绘区域**，蒙版扩展和羽化是质量关键
3. **Outpainting 是 Inpainting 的特殊应用**，通过画布扩展实现
4. **风格迁移有三种策略**：低 denoise、ControlNet、IP-Adapter
5. **选择合适的模型**能显著提升 Inpainting 质量

## 练习

### 练习一：denoise 实验

使用同一张输入图像，分别用 denoise=0.2, 0.4, 0.6, 0.8 生成四张图，对比原图保留程度和风格变化。

### 练习二：Inpainting 工作流

搭建一个完整的人像 Inpainting 工作流：加载人像照片，创建面部蒙版，用 Inpainting 修改表情。

---

## 参考答案

### 练习一

**思路**：固定所有参数，只改变 denoise 值，生成对比图。

**答案**：

```python
import json

def denoise_experiment():
    """denoise 消融实验"""
    base_workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}
        },
        "2": {
            "class_type": "LoadImage",
            "inputs": {"image": "test_input.png"}
        },
        "3": {
            "class_type": "VAEEncode",
            "inputs": {"pixels": ["2", 0], "vae": ["1", 2]}
        },
        "4": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "oil painting, impressionist style, vibrant colors",
                "clip": ["1", 1]
            }
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "blurry, low quality",
                "clip": ["1", 1]
            }
        }
    }

    denoise_values = [0.2, 0.4, 0.6, 0.8]
    workflows = {}

    for i, d in enumerate(denoise_values):
        wf = dict(base_workflow)
        wf[f"sampler_{i}"] = {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["4", 0],
                "negative": ["5", 0],
                "latent_image": ["3", 0],
                "seed": 42,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": d
            }
        }
        wf[f"decode_{i}"] = {
            "class_type": "VAEDecode",
            "inputs": {"samples": [f"sampler_{i}", 0], "vae": ["1", 2]}
        }
        wf[f"save_{i}"] = {
            "class_type": "SaveImage",
            "inputs": {
                "images": [f"decode_{i}", 0],
                "filename_prefix": f"denoise_{d}"
            }
        }
        workflows[d] = wf

    return workflows

# 生成实验工作流
workflows = denoise_experiment()
for d, wf in workflows.items():
    with open(f"workflows/denoise_{d}.json", "w") as f:
        json.dump(wf, f, indent=2)
    print(f"denoise={d} 工作流已保存")
```

**要点**：
- denoise=0.2：原图保留约 80%，风格变化微弱
- denoise=0.4：开始有明显的风格变化，但构图完全保留
- denoise=0.6：风格变化显著，构图大致保留
- denoise=0.8：大幅变化，可能丢失原图重要细节

### 练习二

**思路**：使用 LoadImage 加载人像，用 ImageToMask 或手动蒙版标记面部区域，执行 Inpainting。

**答案**：

```python
import json

def portrait_inpainting_workflow():
    """人像 Inpainting 工作流"""
    workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "sd-v1-5-inpainting.safetensors"}
        },
        "2": {
            "class_type": "LoadImage",
            "inputs": {"image": "portrait.png"}
        },
        "3": {
            "class_type": "LoadImage",
            "inputs": {"image": "face_mask.png"}
        },
        "4": {
            "class_type": "ImageToMask",
            "inputs": {
                "image": ["3", 0],
                "channel": "red"
            }
        },
        "5": {
            "class_type": "GrowMask",
            "inputs": {
                "mask": ["4", 0],
                "expand": 8,
                "tapered_corners": True
            }
        },
        "6": {
            "class_type": "VAEEncodeForInpaint",
            "inputs": {
                "pixels": ["2", 0],
                "vae": ["1", 2],
                "mask": ["5", 0],
                "grow_mask_by": 6
            }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "a genuine happy smile, natural expression, "
                        "detailed skin texture, photorealistic",
                "clip": ["1", 1]
            }
        },
        "8": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "deformed, distorted, bad anatomy, blurry, "
                        "uncanny valley, plastic skin",
                "clip": ["1", 1]
            }
        },
        "9": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["7", 0],
                "negative": ["8", 0],
                "latent_image": ["6", 0],
                "seed": 42,
                "steps": 25,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0
            }
        },
        "10": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["9", 0], "vae": ["1", 2]}
        },
        "11": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["10", 0],
                "filename_prefix": "portrait_inpaint"
            }
        }
    }
    return workflow

workflow = portrait_inpainting_workflow()
with open("workflows/portrait_inpaint.json", "w") as f:
    json.dump(workflow, f, indent=2)
print("人像 Inpainting 工作流已保存")
```

**要点**：
- 使用专用 Inpainting 模型获得更好的边缘融合
- GrowMask 扩展蒙版避免接缝
- prompt 需要描述目标表情的细节
- 负提示词排除常见的 Inpainting 伪影
