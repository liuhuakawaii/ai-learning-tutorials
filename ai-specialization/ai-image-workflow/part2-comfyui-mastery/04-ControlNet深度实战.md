# 第 10 课：ControlNet 深度实战 — 精确控制图像生成

## 场景引入

文生图最大的问题是"不可控"——你写了一段 prompt，但生成的构图、姿态、透视完全靠运气。图生图和 Inpainting 解决了部分问题，但它们对原图的依赖太强，自由度不够。

ControlNet 的出现彻底改变了这个局面。它允许你用**结构化的控制信号**（边缘图、深度图、姿态骨架、法线图）精确控制生成结果，同时保留 Diffusion 模型的创造性和多样性。

本课将系统讲解 ControlNet 的原理、各种预处理器的选择、以及在 ComfyUI 中的实战工作流。

## 学习目标

完成本课后，你将能够：
1. 理解 ControlNet 的架构原理
2. 掌握 Canny、Depth、OpenPose、Normal 四种核心预处理器
3. 在 ComfyUI 中搭建 ControlNet 工作流
4. 理解多 ControlNet 叠加的控制策略
5. 掌握 ControlNet 权重和时机参数的调优

## 一、ControlNet 架构原理

### 1.1 核心思想

```
ControlNet 的核心思想：

  标准 Diffusion：
    噪声 + 文本条件 → U-Net → 去噪结果
    问题：无法精确控制空间结构

  ControlNet 增强：
    噪声 + 文本条件 + 控制信号 → U-Net + ControlNet → 去噪结果
    控制信号告诉模型"结构在哪里"

  ┌─────────────────────────────────────────────────────┐
  │                ControlNet 架构                        │
  │                                                       │
  │  输入图像 → [预处理器] → 控制信号                       │
  │                              │                        │
  │                              ▼                        │
  │                        ┌──────────┐                   │
  │                        │ControlNet│                   │
  │                        │ 编码器   │                   │
  │                        └────┬─────┘                   │
  │                             │                         │
  │  U-Net 的每个中间层 ←───────┤  注入控制信号             │
  │  (通过零卷积连接)            │                         │
  │                             │                         │
  └─────────────────────────────────────────────────────┘

  零卷积（Zero Convolution）：
    初始权重为零的 1×1 卷积
    训练开始时 ControlNet 不影响 U-Net 输出
    随着训练进行，逐步学习注入控制信号
```

### 1.2 预处理器类型

```python
"""
ControlNet 预处理器分类

结构控制类：
  Canny        → 边缘检测（最通用）
  Depth        → 深度图（控制空间关系）
  Normal       → 法线图（控制表面朝向）
  Lineart      → 线稿（插画/动漫常用）
  MLSD         → 直线检测（建筑/室内设计）

姿态控制类：
  OpenPose     → 人体姿态骨架
  DWPose       → 更精确的姿态检测（手部+面部）
  DensePose    → 密集姿态（全身表面映射）

语义控制类：
  Segmentation → 语义分割图
  Shuffle      → 内容重排（风格迁移）
  Reference    → 参考图（风格/内容参考）

Tile 控制类：
  Tile         → 超分辨率/细节增强
  IP-Adapter   → 图像风格注入（后续课程详解）
"""
```

## 二、核心预处理器实战

### 2.1 Canny 边缘检测

```python
def canny_preprocess(image, low_threshold=100, high_threshold=200):
    """
    Canny 边缘检测

    参数：
      low_threshold  → 低阈值（控制弱边缘保留）
      high_threshold → 高阈值（控制强边缘提取）

    调参指南：
      建筑/产品：low=100, high=200（清晰边缘）
      人像/艺术：low=50, high=150（保留更多细节）
      简笔画：low=200, high=300（只保留主要轮廓）
    """
    import cv2
    import numpy as np

    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    else:
        gray = image

    edges = cv2.Canny(gray, low_threshold, high_threshold)
    return edges

def canny_config_guide():
    """Canny 阈值配置指南"""
    return {
        "精确复制": {"low": 100, "high": 200, "use_case": "产品图、建筑"},
        "艺术创作": {"low": 50, "high": 100, "use_case": "保留细节纹理"},
        "极简轮廓": {"low": 200, "high": 300, "use_case": "简笔画、logo"},
        "人像": {"low": 80, "high": 160, "use_case": "保留面部细节"}
    }
```

### 2.2 深度图

```python
def depth_estimation_methods():
    """深度图估计方法对比"""
    return {
        "MiDaS": {
            "精度": "中等",
            "速度": "快",
            "特点": "相对深度，适合一般场景",
            "comfyui_node": "MiDaS-DepthMapPreprocessor"
        },
        "ZoeDepth": {
            "精度": "高",
            "速度": "中等",
            "特点": "绝对深度，室内场景优秀",
            "comfyui_node": "Zoe-DepthMapPreprocessor"
        },
        "DepthAnything": {
            "精度": "很高",
            "速度": "中等",
            "特点": "2024 年 SOTA，泛化能力强",
            "comfyui_node": "DepthAnythingV2Preprocessor"
        },
        "Marigold": {
            "精度": "极高",
            "速度": "慢",
            "特点": "基于 Diffusion 的深度估计",
            "comfyui_node": "MarigoldDepthPreprocessor"
        }
    }
```

### 2.3 OpenPose 姿态检测

```python
"""
OpenPose 姿态检测

关键点定义（COCO 18 点）：
  0: 鼻子      1: 左眼      2: 右眼
  3: 左耳      4: 右耳      5: 左肩
  6: 右肩      7: 左肘      8: 右肘
  9: 左手腕    10: 右手腕   11: 左髋
  12: 右髋     13: 左膝     14: 右膝
  15: 左脚踝   16: 右脚踝

DWPose 扩展点：
  17-22: 左手 5 指关键点
  23-28: 右手 5 指关键点
  29-68: 面部 42 个关键点

使用场景：
  OpenPose  → 一般人体姿态控制
  DWPose    → 需要精确手部/面部控制
  DensePose → 需要全身表面映射（换装等）
"""
```

## 三、ComfyUI ControlNet 工作流

### 3.1 基础 ControlNet 工作流

```python
import json

def create_controlnet_workflow(control_type="canny"):
    """基础 ControlNet 工作流"""
    preprocessor_map = {
        "canny": "CannyEdgePreprocessor",
        "depth": "DepthAnythingV2Preprocessor",
        "openpose": "OpenPosePreprocessor",
        "lineart": "LineArtPreprocessor",
        "normal": "BAE-NormalMapPreprocessor"
    }

    controlnet_model_map = {
        "canny": "control_v11p_sd15_canny.safetensors",
        "depth": "control_v11f1p_sd15_depth.safetensors",
        "openpose": "control_v11p_sd15_openpose.safetensors",
        "lineart": "control_v11p_sd15_lineart.safetensors",
        "normal": "control_v11p_sd15_normalbae.safetensors"
    }

    workflow = {
        # 加载模型
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}
        },
        # 加载 ControlNet 模型
        "2": {
            "class_type": "ControlNetLoader",
            "inputs": {
                "control_net_name": controlnet_model_map[control_type]
            }
        },
        # 加载输入图像
        "3": {
            "class_type": "LoadImage",
            "inputs": {"image": "reference.png"}
        },
        # 预处理器
        "4": {
            "class_type": preprocessor_map[control_type],
            "inputs": {
                "image": ["3", 0],
                **({"low_threshold": 100, "high_threshold": 200}
                   if control_type == "canny" else {})
            }
        },
        # 正向条件
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "a beautiful landscape, photorealistic, 8k",
                "clip": ["1", 1]
            }
        },
        # 负向条件
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "blurry, low quality, distorted",
                "clip": ["1", 1]
            }
        },
        # 应用 ControlNet
        "7": {
            "class_type": "ControlNetApplyAdvanced",
            "inputs": {
                "positive": ["5", 0],
                "negative": ["6", 0],
                "control_net": ["2", 0],
                "image": ["4", 0],       # 预处理后的控制图
                "strength": 1.0,          # ControlNet 强度
                "start_percent": 0.0,     # 开始生效的时间步
                "end_percent": 1.0        # 停止生效的时间步
            }
        },
        # 空白潜变量
        "8": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 512, "batch_size": 1}
        },
        # 采样
        "9": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["7", 0],
                "negative": ["7", 1],
                "latent_image": ["8", 0],
                "seed": 42,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0
            }
        },
        # 解码
        "10": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["9", 0], "vae": ["1", 2]}
        },
        # 保存
        "11": {
            "class_type": "SaveImage",
            "inputs": {"images": ["10", 0], "filename_prefix": "controlnet"}
        }
    }
    return workflow
```

### 3.2 Strength 和 Timing 参数

```python
"""
ControlNet 的两个关键参数

1. Strength（强度）：
   控制 ControlNet 对生成结果的影响程度
   1.0 = 完全遵循控制信号
   0.5 = 部分遵循，允许更多创意自由
   0.0 = 完全忽略控制信号

   ┌────────────────────────────────────┐
   │  Strength 对结果的影响              │
   │                                     │
   │  1.0  ──→ 精确复制控制图结构         │
   │  0.8  ──→ 大致遵循，细节有变化       │
   │  0.5  ──→ 保留大结构，创意空间大     │
   │  0.3  ──→ 轻微影响，主要靠 prompt   │
   │  0.0  ──→ 完全忽略 ControlNet       │
   └────────────────────────────────────┘

2. Timing（start_percent / end_percent）：
   控制 ControlNet 在采样的哪些阶段生效

   start_percent=0.0, end_percent=1.0 → 全程生效
   start_percent=0.0, end_percent=0.5 → 只在前半段生效
   start_percent=0.3, end_percent=1.0 → 只在后半段生效

   工程直觉：
     前半段（高噪声）→ 控制整体构图和大结构
     后半段（低噪声）→ 控制细节和纹理

   常用配置：
     构图控制：start=0.0, end=0.8（后期放松控制）
     细节控制：start=0.2, end=1.0（前期让模型自由发挥）
     平衡控制：start=0.0, end=1.0（全程控制）
"""
```

## 四、多 ControlNet 叠加

### 4.1 组合策略

```
多 ControlNet 组合示例：

  场景：生成一个人站在特定建筑前的照片
    ControlNet 1：Depth（控制空间关系和透视）
    ControlNet 2：OpenPose（控制人物姿态）
    ControlNet 3：Canny（控制建筑细节）

  数据流：
    ┌──────────┐
    │  Depth   │──→ strength=0.8, start=0.0, end=1.0
    └──────────┘
    ┌──────────┐
    │ OpenPose │──→ strength=0.9, start=0.0, end=0.8
    └──────────┘
    ┌──────────┐
    │  Canny   │──→ strength=0.6, start=0.0, end=0.6
    └──────────┘
          │
          ▼
    ┌──────────┐
    │Conditioning│ → KSampler → 最终图像
    │ Combine   │
    └──────────┘

  权重分配原则：
    主要控制（如人物姿态）：strength 0.8-1.0
    次要控制（如空间关系）：strength 0.5-0.8
    辅助控制（如细节纹理）：strength 0.3-0.6
```

### 4.2 ComfyUI 多 ControlNet 连接

```python
def create_multi_controlnet_workflow():
    """多 ControlNet 叠加工作流"""
    workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}
        },
        # ControlNet 模型加载
        "2": {
            "class_type": "ControlNetLoader",
            "inputs": {"control_net_name": "control_v11f1p_sd15_depth.safetensors"}
        },
        "3": {
            "class_type": "ControlNetLoader",
            "inputs": {"control_net_name": "control_v11p_sd15_openpose.safetensors"}
        },
        # 输入图像
        "4": {"class_type": "LoadImage", "inputs": {"image": "scene.png"}},
        "5": {"class_type": "LoadImage", "inputs": {"image": "pose.png"}},

        # 预处理
        "6": {
            "class_type": "DepthAnythingV2Preprocessor",
            "inputs": {"image": ["4", 0]}
        },
        "7": {
            "class_type": "OpenPosePreprocessor",
            "inputs": {"image": ["5", 0]}
        },

        # 正向条件
        "8": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "a person standing in a modern building, "
                        "photorealistic, natural lighting",
                "clip": ["1", 1]
            }
        },
        "9": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "blurry, low quality, distorted",
                "clip": ["1", 1]
            }
        },

        # 第一个 ControlNet
        "10": {
            "class_type": "ControlNetApplyAdvanced",
            "inputs": {
                "positive": ["8", 0],
                "negative": ["9", 0],
                "control_net": ["2", 0],
                "image": ["6", 0],
                "strength": 0.8,
                "start_percent": 0.0,
                "end_percent": 1.0
            }
        },
        # 第二个 ControlNet（连接到第一个的输出）
        "11": {
            "class_type": "ControlNetApplyAdvanced",
            "inputs": {
                "positive": ["10", 0],
                "negative": ["10", 1],
                "control_net": ["3", 0],
                "image": ["7", 0],
                "strength": 0.9,
                "start_percent": 0.0,
                "end_percent": 0.8
            }
        },

        # 采样
        "12": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 768, "batch_size": 1}
        },
        "13": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["11", 0],
                "negative": ["11", 1],
                "latent_image": ["12", 0],
                "seed": 42,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0
            }
        },
        "14": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["13", 0], "vae": ["1", 2]}
        },
        "15": {
            "class_type": "SaveImage",
            "inputs": {"images": ["14", 0], "filename_prefix": "multi_cn"}
        }
    }
    return workflow
```

## 五、ControlNet 版本与模型选择

### 5.1 版本对比

```python
"""
ControlNet 版本演进

v1.0（2023.02）：
  首个公开版本，支持 Canny/Depth/OpenPose 等
  每种控制类型需要单独的模型

v1.1（2023.07）：
  新增更多预处理器（Lineart/MLSD/Normal 等）
  质量和一致性显著提升

SDXL ControlNet（2023.11）：
  适配 SDXL 架构
  更大的控制粒度

ControlNet Union（2024）：
  单个模型支持多种控制类型
  无需切换模型即可使用不同预处理器

FLUX ControlNet（2024-2025）：
  适配 FLUX.1 架构
  更强的控制能力和泛化性

模型文件命名规则：
  control_v11p_sd15_canny.safetensors
  │       │   │    │     │
  │       │   │    │     └─ 控制类型
  │       │   │    └─── SD 1.5
  │       │   └──── p=普通, f=精细化
  │       └──── v11=版本1.1
  └──── ControlNet 前缀
"""
```

### 5.2 SDXL ControlNet 差异

```python
"""
SDXL ControlNet 与 SD 1.5 的差异

1. 模型更大：
   SD 1.5 ControlNet ~1.4GB
   SDXL ControlNet ~2.5GB

2. 预处理分辨率：
   SD 1.5：512×512
   SDXL：1024×1024（需要更高分辨率的控制图）

3. 效果差异：
   SDXL 的 ControlNet 控制精度更高
   但对预处理器的输出质量要求也更高

4. 推荐配置：
   SDXL + ControlNet 强度：0.6-0.8（比 SD 1.5 略低）
   SDXL + 步数：25-30（比 SD 1.5 略多）
"""
```

## 六、常见误区

### 误区一：Strength 越高越好

Strength=1.0 会导致生成结果过度依赖控制图，失去自然感。建议从 0.7 开始调整，找到控制力和自然感的平衡。

### 误区二：预处理器参数不用调

Canny 的阈值、Depth 的精度对最终结果影响巨大。同一张图用不同参数预处理，生成结果可能完全不同。

### 误区三：多 ControlNet 一定比单个好

过多的 ControlNet 会相互冲突。建议最多同时使用 2-3 个，且它们的控制目标应该正交（一个控制结构，一个控制姿态）。

### 误区四：ControlNet 可以替代 prompt

ControlNet 控制的是空间结构，prompt 控制的是内容和风格。两者互补，不能替代。

## 七、小结

1. **ControlNet 通过零卷积将控制信号注入 U-Net**，实现精确的空间控制
2. **五种核心预处理器**：Canny（边缘）、Depth（深度）、OpenPose（姿态）、Normal（法线）、Lineart（线稿）
3. **Strength 控制影响程度，Timing 控制生效阶段**
4. **多 ControlNet 叠加**需要合理分配权重和时机
5. **不同模型版本**（SD 1.5/SDXL/FLUX）需要对应的 ControlNet 模型

## 练习

### 练习一：Canny 参数实验

使用同一张图像，分别用 Canny 的三组阈值（精确复制、艺术创作、极简轮廓）生成图像，对比控制效果。

### 练习二：双 ControlNet 工作流

搭建一个 Depth + OpenPose 双 ControlNet 工作流，生成一个站在特定场景中的人物。

---

## 参考答案

### 练习一

**思路**：固定 seed 和 prompt，只改变 Canny 阈值，生成三组对比图。

**答案**：

```python
import json

def canny_experiment():
    """Canny 阈值实验"""
    configs = {
        "precise": {"low": 100, "high": 200, "label": "精确复制"},
        "artistic": {"low": 50, "high": 100, "label": "艺术创作"},
        "minimal": {"low": 200, "high": 300, "label": "极简轮廓"}
    }

    base_workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}
        },
        "2": {
            "class_type": "ControlNetLoader",
            "inputs": {"control_net_name": "control_v11p_sd15_canny.safetensors"}
        },
        "3": {
            "class_type": "LoadImage",
            "inputs": {"image": "test_scene.png"}
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "a beautiful scene, photorealistic, detailed",
                "clip": ["1", 1]
            }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "blurry, low quality",
                "clip": ["1", 1]
            }
        },
        "8": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 512, "batch_size": 1}
        }
    }

    for name, cfg in configs.items():
        wf = dict(base_workflow)
        wf["4"] = {
            "class_type": "CannyEdgePreprocessor",
            "inputs": {
                "image": ["3", 0],
                "low_threshold": cfg["low"],
                "high_threshold": cfg["high"]
            }
        }
        wf["7"] = {
            "class_type": "ControlNetApplyAdvanced",
            "inputs": {
                "positive": ["5", 0],
                "negative": ["6", 0],
                "control_net": ["2", 0],
                "image": ["4", 0],
                "strength": 0.8,
                "start_percent": 0.0,
                "end_percent": 1.0
            }
        }
        wf["9"] = {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["7", 0],
                "negative": ["7", 1],
                "latent_image": ["8", 0],
                "seed": 42,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0
            }
        }
        wf["10"] = {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["9", 0], "vae": ["1", 2]}
        }
        wf["11"] = {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["10", 0],
                "filename_prefix": f"canny_{name}"
            }
        }

        with open(f"workflows/canny_{name}.json", "w") as f:
            json.dump(wf, f, indent=2)
        print(f"{cfg['label']} 工作流已保存")

canny_experiment()
```

**要点**：
- 精确复制模式保留最多边缘信息，生成结果最忠实于原图
- 极简模式只保留主要轮廓，给模型最大自由度
- 实际使用中需要根据具体图像调整阈值

### 练习二

**思路**：分别加载 Depth 和 OpenPose 的 ControlNet，串联应用。

**答案**：

```python
import json

def dual_controlnet_workflow():
    """Depth + OpenPose 双 ControlNet 工作流"""
    workflow = {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}
        },
        "2": {
            "class_type": "ControlNetLoader",
            "inputs": {"control_net_name": "control_v11f1p_sd15_depth.safetensors"}
        },
        "3": {
            "class_type": "ControlNetLoader",
            "inputs": {"control_net_name": "control_v11p_sd15_openpose.safetensors"}
        },
        "4": {"class_type": "LoadImage", "inputs": {"image": "scene.png"}},
        "5": {"class_type": "LoadImage", "inputs": {"image": "pose_ref.png"}},
        "6": {
            "class_type": "DepthAnythingV2Preprocessor",
            "inputs": {"image": ["4", 0]}
        },
        "7": {
            "class_type": "OpenPosePreprocessor",
            "inputs": {"image": ["5", 0]}
        },
        "8": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "a woman standing in a garden, natural lighting, "
                        "photorealistic, detailed clothing",
                "clip": ["1", 1]
            }
        },
        "9": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "deformed, blurry, low quality",
                "clip": ["1", 1]
            }
        },
        # Depth ControlNet
        "10": {
            "class_type": "ControlNetApplyAdvanced",
            "inputs": {
                "positive": ["8", 0],
                "negative": ["9", 0],
                "control_net": ["2", 0],
                "image": ["6", 0],
                "strength": 0.7,
                "start_percent": 0.0,
                "end_percent": 1.0
            }
        },
        # OpenPose ControlNet
        "11": {
            "class_type": "ControlNetApplyAdvanced",
            "inputs": {
                "positive": ["10", 0],
                "negative": ["10", 1],
                "control_net": ["3", 0],
                "image": ["7", 0],
                "strength": 0.9,
                "start_percent": 0.0,
                "end_percent": 0.8
            }
        },
        "12": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 768, "batch_size": 1}
        },
        "13": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["11", 0],
                "negative": ["11", 1],
                "latent_image": ["12", 0],
                "seed": 42,
                "steps": 25,
                "cfg": 7.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0
            }
        },
        "14": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["13", 0], "vae": ["1", 2]}
        },
        "15": {
            "class_type": "SaveImage",
            "inputs": {"images": ["14", 0], "filename_prefix": "dual_cn"}
        }
    }
    return workflow

wf = dual_controlnet_workflow()
with open("workflows/dual_controlnet.json", "w") as f:
    json.dump(wf, f, indent=2)
print("双 ControlNet 工作流已保存")
```

**要点**：
- Depth 控制空间关系（strength=0.7，稍低以允许风格自由）
- OpenPose 控制人物姿态（strength=0.9，高以精确复制姿态）
- OpenPose 的 end_percent=0.8，后期让模型自由处理细节
