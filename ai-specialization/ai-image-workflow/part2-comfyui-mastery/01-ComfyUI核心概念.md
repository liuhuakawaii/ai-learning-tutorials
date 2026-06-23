# 第 7 课：ComfyUI 核心概念 — 节点式工作流引擎

你已经能用 Stable Diffusion 生成图片了，但当你需要构建复杂流程——先用 ControlNet 控制构图，再用 IP-Adapter 注入风格，最后做超分辨率——WebUI 的线性界面开始捉襟见肘。参数越来越多，流程越来越复杂，你想要的是"看到数据怎么流动"而不是"在一堆表单里找参数"。

ComfyUI 用节点图（Node Graph）重新定义了图像生成工作流。这节课从工程角度理解它的架构：节点是什么、数据怎么流动、执行引擎怎么调度、工作流文件怎么组织。

## 节点图 vs 线性界面

WebUI 的问题不在功能不够，而在界面表达力有限。当你的流程有分支、合并、条件判断时，线性表单无法表达这些关系。

```
WebUI 线性界面：

  Prompt: [________________]
  Sampler: [Euler      ▼]
  Steps: [20___________]
  ControlNet: [___________]
  [Generate]

  问题：无法表达"先分割 → 再 inpaint → 再超分"这种多步流程
  无法复用中间结果，无法可视化数据流向

ComfyUI 节点图：

  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │Load Model│───→│ KSampler │───→│VAEDecode │───→ SaveImage
  └──────────┘    └────┬─────┘    └──────────┘
  ┌──────────┐         │
  │CLIP Encode│────────┘
  └──────────┘
  ┌──────────┐    ┌──────────┐
  │Load Image│───→│ControlNet│───→ (连接到 KSampler)
  └──────────┘    └──────────┘

  优势：每个节点职责单一，数据流向清晰，支持任意拓扑
```

## 核心数据类型

ComfyUI 的所有数据都通过类型化的连线传递。理解这些类型是搭建工作流的基础：

```python
COMFYUI_DATA_TYPES = {
    "MODEL":        "U-Net 模型，去噪网络",
    "CLIP":         "文本编码器，将 prompt 转为向量",
    "VAE":          "图像编解码器，像素空间 ↔ 潜空间",
    "CONDITIONING": "文本条件，分为 positive 和 negative",
    "LATENT":       "潜空间张量，4 通道、1/8 分辨率",
    "IMAGE":        "像素空间图像，[B, H, W, C] 格式",
    "MASK":         "蒙版，用于 inpainting 和区域控制",
}
```

数据流的核心路径：

```
Prompt → CLIPTextEncode → CONDITIONING ─┐
MODEL ──────────────────────────────────┤
VAE ────────────────────────────────────┼→ KSampler → LATENT → VAEDecode → IMAGE
LATENT (EmptyLatentImage 或 LoadImage) ─┘
```

`CONDITIONING` 分为 positive 和 negative，分别对应"想要什么"和"不想要什么"。KSampler 把所有条件汇聚在一起执行去噪。

## 节点的结构

每个节点由三部分组成：输入（左侧）、参数、输出（右侧）。

```
┌──────────────────────────────────────┐
│  KSampler                            │
│──────────────────────────────────────│
│  ● model        (MODEL)        必须  │
│  ● positive     (CONDITIONING) 必须  │
│  ● negative     (CONDITIONING) 必须  │
│  ● latent_image (LATENT)       必须  │
│  ○ seed         (INT)          可选  │
│  ○ steps        (INT)          可选  │
│  ○ cfg          (FLOAT)        可选  │
│  ○ sampler_name (ENUM)         可选  │
│  ○ denoise      (FLOAT)        可选  │
│──────────────────────────────────────│
│  ● LATENT ──────────────────────→   │
└──────────────────────────────────────┘

● 实心圆 = 必须连接（数据依赖）
○ 空心圆 = 可选参数（有默认值）
```

`denoise` 参数控制去噪强度：`1.0` 是从纯噪声开始（文生图），`0.75` 保留 25% 输入图像（轻度图生图），`0.25` 保留 75%（微调）。

## 执行引擎：惰性执行 + 自动缓存

ComfyUI 使用惰性执行策略：只有当输出节点（如 SaveImage）需要某个数据时，才会触发上游节点的计算。

```python
def topological_sort(nodes, connections):
    """ComfyUI 执行引擎的核心：拓扑排序"""
    in_degree = {n: 0 for n in nodes}
    for src, dst in connections:
        in_degree[dst] += 1

    queue = [n for n in nodes if in_degree[n] == 0]
    order = []

    while queue:
        node = queue.pop(0)
        order.append(node)
        for src, dst in connections:
            if src == node:
                in_degree[dst] -= 1
                if in_degree[dst] == 0:
                    queue.append(dst)

    return order
```

缓存机制：
- 每个节点的输出都会被缓存，缓存键 = 节点类型 + 所有输入的哈希值 + 参数值
- 任何输入或参数变化都会导致缓存失效
- 缓存层级：内存缓存（最快）→ 磁盘缓存 → 重新计算（最慢）
- `seed` 的 `control_after_generate` 参数控制缓存行为：`fixed` 保持缓存，`increment` seed 递增导致缓存失效

这意味着：修改下游节点不会触发上游重新计算。你可以自由调整采样参数而不需要重新加载模型。

## 工作流 JSON 格式

ComfyUI 工作流有两种格式：

```python
import json

def parse_workflow(path):
    with open(path, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    if "nodes" in wf:
        # UI 格式：包含节点位置、颜色等 UI 信息
        # 用于 ComfyUI 编辑器中加载
        for node in wf['nodes']:
            print(f"  [{node['id']}] {node['type']} @ ({node['pos'][0]}, {node['pos'][1]})")
    else:
        # API 格式：纯数据，用于 API 调用和自动化
        # 结构：{ "node_id": { "class_type": ..., "inputs": ... } }
        for nid, data in wf.items():
            print(f"  [{nid}] {data['class_type']}")
            for name, val in data.get('inputs', {}).items():
                if isinstance(val, list):
                    print(f"    {name} ← node {val[0]}")
                else:
                    print(f"    {name} = {val}")
```

API 格式的输入引用格式为 `[source_node_id, output_index]`。例如 `["1", 0]` 表示连接到节点 1 的第 0 个输出。

## 最常用的 10 个节点

```python
ESSENTIAL_NODES = {
    "CheckpointLoaderSimple": "加载 SD 模型，输出 MODEL + CLIP + VAE",
    "CLIPTextEncode":         "文本 → CONDITIONING，最大 77 token",
    "EmptyLatentImage":       "创建空白 LATENT，定义输出尺寸",
    "KSampler":               "核心采样器，汇聚所有条件执行去噪",
    "VAEDecode":              "LATENT → IMAGE，潜空间解码",
    "VAEEncode":              "IMAGE → LATENT，图生图时编码输入",
    "LoadImage":              "加载输入图像，输出 IMAGE + MASK",
    "ImageScale":             "缩放图像，超分前的预处理",
    "SaveImage":              "保存图像到磁盘，工作流终点",
    "PreviewImage":           "临时预览，调试时查看中间结果",
}
```

这 10 个节点覆盖 90% 的基础工作流。CheckpointLoader 是唯一的"三合一"输出节点，KSampler 是工作流的核心汇聚点。

## 安装与目录结构

```bash
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install -r requirements.txt

# 下载模型到对应目录
# models/checkpoints/   → SD 模型
# models/controlnet/    → ControlNet 模型
# models/loras/         → LoRA 权重
# models/vae/           → VAE 模型
# models/upscale_models/ → 超分模型

python main.py                    # 默认 http://127.0.0.1:8188
python main.py --listen 0.0.0.0   # 允许外部访问
python main.py --lowvram          # 低显存模式
python main.py --cpu              # CPU 调试模式
```

关键目录：

```
ComfyUI/
├── main.py              # 入口
├── execution.py         # 执行引擎（拓扑排序 + 缓存）
├── nodes.py             # 内置节点定义
├── custom_nodes/        # 自定义节点（ComfyUI Manager 等）
├── models/              # 模型文件
├── input/               # 输入图像
└── output/              # 输出图像
```

## 练习

### 练习一：工作流 JSON 解析器

编写 Python 脚本解析 ComfyUI API 格式的 JSON 文件，输出节点依赖图和拓扑排序后的执行顺序。如果检测到环，报错提示。

### 练习二：搭建基础文生图工作流

在 ComfyUI 中手动搭建一个基础文生图工作流（CheckpointLoader → CLIPTextEncode × 2 → KSampler → VAEDecode → SaveImage），导出 API 格式 JSON，然后用练习一的脚本解析它。

---

## 参考答案

### 练习一

```python
import json
from collections import defaultdict

def parse_and_sort(workflow_path):
    with open(workflow_path, 'r', encoding='utf-8') as f:
        wf = json.load(f)

    nodes = {}
    deps = defaultdict(set)

    for nid, data in wf.items():
        nodes[nid] = data.get("class_type", "Unknown")
        for val in data.get("inputs", {}).values():
            if isinstance(val, list) and len(val) == 2:
                deps[nid].add(str(val[0]))

    # 拓扑排序
    in_deg = {nid: len(deps[nid]) for nid in nodes}
    queue = [n for n, d in in_deg.items() if d == 0]
    order = []

    while queue:
        n = queue.pop(0)
        order.append(n)
        for other, d in deps.items():
            if n in d:
                in_deg[other] -= 1
                if in_deg[other] == 0:
                    queue.append(other)

    if len(order) != len(nodes):
        raise ValueError("工作流中存在环")

    print("执行顺序:")
    for nid in order:
        print(f"  {nid}: {nodes[nid]}")

    return order

# parse_and_sort("my_workflow_api.json")
```

### 练习二

在 ComfyUI 中拖拽节点并连线，然后通过菜单 Save (API Format) 导出。典型的 API 格式：

```json
{
  "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"}},
  "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "a cat", "clip": ["1", 1]}},
  "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "blurry", "clip": ["1", 1]}},
  "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},
  "5": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0], "seed": 42, "steps": 20, "cfg": 7.0, "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0}},
  "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
  "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "output"}}
}
```

解析后的执行顺序：`1 → 2 → 3 → 4 → 5 → 6 → 7`。节点 2、3、4 互不依赖可以并行，但 5 依赖它们全部。
