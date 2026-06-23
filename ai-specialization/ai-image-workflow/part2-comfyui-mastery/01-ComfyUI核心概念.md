# 第 7 课：ComfyUI 核心概念 — 节点式工作流的基础

## 场景引入

你已经理解了 Diffusion 的原理，也用过 AUTOMATIC1111 WebUI 这样的工具。但当你需要构建复杂的图像处理流程——比如先用 ControlNet 控制构图，再用 IP-Adapter 注入风格，最后做超分辨率——你会发现 WebUI 的线性界面开始捉襟见肘。

ComfyUI 用节点图（Node Graph）的方式重新定义了图像生成工作流。每个节点做一件事，节点之间通过连线传递数据，整个流程一目了然。这不仅是界面的改变，更是思维方式的升级——从"填表单"变成"搭流水线"。

本课将带你理解 ComfyUI 的核心架构，为后续的工作流搭建打下坚实基础。

## 学习目标

完成本课后，你将能够：
1. 理解 ComfyUI 的节点、连接、执行图架构
2. 解释 ComfyUI 的惰性执行和缓存机制
3. 掌握 ComfyUI 的数据类型系统
4. 理解 Prompt → Conditioning → Latent → Image 的数据流
5. 能够阅读和理解 ComfyUI 工作流的 JSON 格式

## 一、ComfyUI 的架构哲学

### 1.1 为什么是节点图

```
WebUI（线性界面）的问题：

  ┌──────────────────────────────────────┐
  │  Prompt: [________________]          │
  │  Negative: [______________]          │
  │  Sampler: [Euler      ▼]            │
  │  Steps: [20___________]              │
  │  CFG: [7.0___________]              │
  │  Size: [512 x 512____]              │
  │  ControlNet: [___________]          │
  │  [Generate]                          │
  └──────────────────────────────────────┘

  问题：
  - 参数越多，界面越复杂
  - 无法表达分支、合并、循环
  - 无法复用中间结果
  - 无法可视化数据流向

ComfyUI（节点图）的解法：

  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │Load Model│───→│  KSampler│───→│ VAE Decode│
  └──────────┘    └─────┬────┘    └──────────┘
       ┌──────────┐    │
       │CLIP Encode│───→│
       └──────────┘    │
                       │
  ┌──────────┐    ┌────▼─────┐
  │Load Image│───→│ControlNet│
  └──────────┘    └──────────┘

  优势：
  - 每个节点职责单一
  - 数据流向清晰可见
  - 支持任意拓扑（分支、合并、循环）
  - 中间结果自动缓存
```

### 1.2 核心数据流

```
ComfyUI 的核心数据流：

  ┌─────────┐     ┌──────────┐     ┌─────────────┐
  │  Model   │────→│          │     │   Latent     │
  └─────────┘     │          │     │   (潜变量)    │
                  │          │     └──────┬──────┘
  ┌─────────┐     │ KSampler │            │
  │  CLIP    │────→│          │     ┌──────▼──────┐
  │(文本编码) │     │  (采样器) │────→│  VAE Decode  │
  └─────────┘     │          │     │  (解码器)    │
                  │          │     └──────┬──────┘
  ┌─────────┐     │          │            │
  │  VAE    │────→│          │     ┌──────▼──────┐
  └─────────┘     └──────────┘     │    Image     │
                                    │  (最终图像)   │
                                    └─────────────┘

核心数据类型：
  MODEL        → U-Net 模型
  CLIP         → 文本编码器
  VAE          → 图像编解码器
  CONDITIONING → 文本条件（正/负）
  LATENT       → 潜空间张量
  IMAGE        → 像素空间图像
  MASK         → 蒙版（用于 inpainting）
```

## 二、节点（Node）

### 2.1 节点的结构

每个 ComfyUI 节点由三部分组成：

```
┌──────────────────────────────────┐
│  节点标题：KSampler               │
│──────────────────────────────────│
│  输入（左侧）：                    │
│    ● model       (MODEL)         │
│    ● positive    (CONDITIONING)  │
│    ● negative    (CONDITIONING)  │
│    ● latent      (LATENT)        │
│    ┈ seed        (INT)           │
│    ┈ steps       (INT)           │
│    ┈ cfg         (FLOAT)         │
│    ┈ sampler     (ENUM)          │
│    ┈ scheduler   (ENUM)          │
│    ┈ denoise     (FLOAT)         │
│──────────────────────────────────│
│  输出（右侧）：                    │
│    ● LATENT ─────────────────→   │
└──────────────────────────────────┘

输入类型：
  ● 实心圆 = 必须连接（数据依赖）
  ┈ 空心圆 = 可选参数（有默认值）

输出类型：
  ● 实心圆 = 输出数据（可连接多个下游节点）
```

### 2.2 内置节点分类

```python
"""
ComfyUI 内置节点分类

加载类（Loaders）：
  CheckpointLoaderSimple  → 加载 SD 模型
  LoraLoader              → 加载 LoRA 权重
  CLIPTextEncode          → 文本编码
  LoadImage               → 加载图像
  VAELoader               → 加载 VAE

采样类（Sampling）：
  KSampler                → 核心采样器
  KSamplerAdvanced        → 高级采样器（支持 start_at/end_at）
  SamplerCustom           → 自定义采样流程

潜空间操作（Latent）：
  EmptyLatentImage        → 创建空潜变量
  LatentUpscale           → 潜空间放大
  LatentComposite         → 潜空间合成
  LatentCrop              → 潜空间裁剪

图像操作（Image）：
  ImageScale              → 图像缩放
  ImageBlend              → 图像混合
  ImageRotate             → 图像旋转
  SaveImage               → 保存图像

控制类（ControlNet）：
  ControlNetLoader        → 加载 ControlNet 模型
  ControlNetApply         → 应用 ControlNet
  ControlNetApplyAdvanced → 高级应用（多 ControlNet）

条件操作（Conditioning）：
  ConditioningCombine     → 合并多个条件
  ConditioningSetArea     → 区域条件
  ConditioningConcat      → 条件拼接
"""
```

## 三、执行引擎

### 3.1 惰性执行（Lazy Execution）

ComfyUI 使用惰性执行策略：只有当输出节点（如 SaveImage）需要某个数据时，才会触发上游节点的计算。

```
惰性执行的工作原理：

  假设你有这个工作流：
    LoadModel → KSampler → SaveImage
    LoadModel → KSampler2 → PreviewImage（未连接到 Save）

  执行时：
    1. 从 SaveImage 开始反向遍历
    2. 发现需要 KSampler 的输出
    3. KSampler 需要 LoadModel 的输出
    4. 触发 LoadModel → KSampler → SaveImage 链

  KSampler2 和 PreviewImage 不会被执行（没有输出节点需要它们）

  这意味着：
  - 你可以自由添加"预览"节点而不影响性能
  - 修改下游节点不会触发上游重新计算（如果缓存命中）
```

### 3.2 缓存机制

```python
"""
ComfyUI 的缓存策略

1. 节点输出缓存：
   每个节点的输出都会被缓存。
   如果节点的输入和参数没有变化，直接返回缓存结果。

2. 缓存键（Cache Key）：
   由节点类型 + 所有输入的哈希值 + 参数值组成
   任何一个变化都会导致缓存失效

3. 缓存层级：
   内存缓存（最快） → 磁盘缓存 → 重新计算（最慢）

4. 手动缓存控制：
   Prompt 节点的 "control_after_generate" 参数：
     - "fixed"：保持缓存
     - "increment"：seed 递增，缓存失效
     - "randomize"：随机 seed，缓存失效

缓存对工作流设计的影响：
  - 将不常变化的节点放在工作流上游（如模型加载）
  - 将频繁调整的节点放在下游（如采样参数）
  - 使用 "Cache Backend Data" 节点手动控制大型模型的缓存
"""
```

### 3.3 执行图的拓扑排序

```python
def topological_sort(nodes, connections):
    """
    ComfyUI 执行引擎的核心算法：拓扑排序

    将 DAG（有向无环图）转换为线性执行序列。
    确保每个节点在执行时，其所有输入已经就绪。
    """
    # 计算每个节点的入度
    in_degree = {node: 0 for node in nodes}
    for src, dst in connections:
        in_degree[dst] += 1

    # 找到所有入度为 0 的节点（叶子节点）
    queue = [n for n in nodes if in_degree[n] == 0]
    execution_order = []

    while queue:
        node = queue.pop(0)
        execution_order.append(node)

        # 将依赖此节点的后续节点入度减 1
        for src, dst in connections:
            if src == node:
                in_degree[dst] -= 1
                if in_degree[dst] == 0:
                    queue.append(dst)

    return execution_order

# 示例：Stable Diffusion 基础工作流的执行顺序
# CheckpointLoader → CLIPTextEncode × 2 → KSampler → VAEDecode → SaveImage
```

## 四、工作流文件格式

### 4.1 JSON 结构

```python
import json

def analyze_workflow(workflow_path):
    """分析 ComfyUI 工作流的 JSON 结构"""
    with open(workflow_path, 'r', encoding='utf-8') as f:
        workflow = json.load(f)

    # ComfyUI 工作流有两种格式：
    # 1. API 格式（节点 ID 为键，直接可执行）
    # 2. UI 格式（包含节点位置、颜色等 UI 信息）

    if "nodes" in workflow:
        # UI 格式
        print(f"节点数量: {len(workflow['nodes'])}")
        for node in workflow['nodes']:
            print(f"  [{node['id']}] {node['type']} @ ({node['pos'][0]}, {node['pos'][1]})")
    else:
        # API 格式
        print(f"节点数量: {len(workflow)}")
        for node_id, node_data in workflow.items():
            print(f"  [{node_id}] {node_data['class_type']}")
            for input_name, input_value in node_data.get('inputs', {}).items():
                if isinstance(input_value, list):
                    print(f"    {input_name} ← 连接到节点 {input_value[0]}")
                else:
                    print(f"    {input_name} = {input_value}")
```

### 4.2 工作流的导入导出

```python
"""
ComfyUI 工作流的两种格式

1. API 格式（.json）：
   - 纯数据，不含 UI 信息
   - 用于 API 调用和自动化
   - 结构：{ "node_id": { "class_type": ..., "inputs": ... } }

2. UI 格式（.json 或嵌入 PNG 的 metadata）：
   - 包含节点位置、颜色、分组等 UI 信息
   - 用于 ComfyUI 编辑器中加载
   - 结构：{ "nodes": [...], "links": [...], "groups": [...] }

导出工作流：
  - API 格式：菜单 → Save (API Format)
  - UI 格式：菜单 → Save → 保存为 .json
  - 嵌入 PNG：生成的图像自动包含工作流 metadata

导入工作流：
  - 拖拽 .json 文件到 ComfyUI 画布
  - 从 PNG 图像中加载：拖拽图像到画布（如果包含 metadata）
"""
```

## 五、常用节点详解

### 5.1 CheckpointLoaderSimple

```python
"""
CheckpointLoaderSimple：加载 Stable Diffusion 模型

输出：
  MODEL  → U-Net（去噪网络）
  CLIP   → 文本编码器（通常有两个输出，用于正/负提示词）
  VAE    → 图像编解码器

常见 checkpoint：
  SD 1.5: v1-5-pruned-emaonly.safetensors
  SDXL:   sd_xl_base_1.0.safetensors
  SD 3:   sd3_medium.safetensors
  FLUX:   flux1-dev.safetensors

文件位置：ComfyUI/models/checkpoints/
"""
```

### 5.2 CLIPTextEncode

```python
"""
CLIPTextEncode：将文本转换为条件向量

输入：
  text  → 提示词文本
  CLIP  → 文本编码器（来自 CheckpointLoader）

输出：
  CONDITIONING → 条件张量

重要限制：
  - SD 1.5/SDXL：最大 77 token
  - SD 3/FLUX（使用 T5）：更长上下文
  - 超出部分被截断

技巧：
  - 可以串联两个 CLIPTextEncode 节点
  - 第一个用于核心描述，第二个用于风格修饰
  - 用 ConditioningCombine 节点合并
"""
```

### 5.3 KSampler

```python
"""
KSampler：核心采样节点

输入参数：
  model         → U-Net 模型
  positive      → 正向条件
  negative      → 负向条件
  latent_image  → 初始潜变量（噪声）
  seed          → 随机种子
  steps         → 采样步数
  cfg           → CFG Scale
  sampler_name  → 采样器名称
  scheduler     → 调度器名称
  denoise       → 去噪强度（1.0=完全去噪，<1.0=图生图）

输出：
  LATENT → 去噪后的潜变量

denoise 参数的含义：
  1.0   → 从纯噪声开始（文生图）
  0.75  → 保留 25% 的输入图像（轻度图生图）
  0.5   → 保留 50% 的输入图像（中度图生图）
  0.25  → 保留 75% 的输入图像（微调）
"""
```

## 六、ComfyUI 安装与配置

### 6.1 环境搭建

```python
"""
ComfyUI 安装步骤

1. 克隆仓库：
   git clone https://github.com/comfyanonymous/ComfyUI
   cd ComfyUI

2. 安装依赖：
   pip install -r requirements.txt

3. 下载模型：
   # 将 checkpoint 放入 models/checkpoints/
   # 将 VAE 放入 models/vae/
   # 将 ControlNet 放入 models/controlnet/
   # 将 LoRA 放入 models/loras/

4. 启动：
   python main.py
   # 默认端口：http://127.0.0.1:8188

5. 命令行参数：
   --listen 0.0.0.0    # 允许外部访问
   --port 8188         # 指定端口
   --gpu-only          # 强制使用 GPU
   --cpu               # 使用 CPU（调试用）
   --highvram          # 不卸载模型到 CPU（大显存）
   --lowvram           # 低显存模式
   --preview-method auto  # 启用预览
"""
```

### 6.2 目录结构

```
ComfyUI/
├── main.py                    # 入口文件
├── server.py                  # HTTP/WebSocket 服务器
├── execution.py               # 执行引擎
├── folder_paths.py            # 路径管理
├── comfy/                     # 核心库
│   ├── model_management.py    # 模型管理
│   ├── samplers.py            # 采样器实现
│   ├── sd.py                  # SD 模型加载
│   └── ...
├── nodes.py                   # 内置节点定义
├── custom_nodes/              # 自定义节点目录
│   ├── ComfyUI-Manager/       # 节点管理器
│   ├── ComfyUI-Impact-Pack/   # Impact 扩展
│   └── ...
├── models/
│   ├── checkpoints/           # SD 模型
│   ├── controlnet/            # ControlNet 模型
│   ├── loras/                 # LoRA 权重
│   ├── vae/                   # VAE 模型
│   ├── upscale_models/        # 超分模型
│   └── embeddings/            # Textual Inversion
├── input/                     # 输入图像
├── output/                    # 输出图像
└── custom_nodes/              # 自定义节点
```

## 七、常见误区

### 误区一：ComfyUI 比 WebUI 更难

ComfyUI 的学习曲线确实更陡，但一旦理解了节点思维，它比 WebUI 更直观。WebUI 需要你在一堆参数中找关系，ComfyUI 把关系画在了图上。

### 误区二：每个节点都要手动配置

ComfyUI 支持"模板工作流"——保存常用的工作流配置，下次直接加载。大多数时候你只需要修改 prompt 和 seed。

### 误区三：缓存总是有效

如果上游节点的任何一个输入变化（包括隐藏参数），缓存就会失效。频繁修改 prompt 会导致 CLIP 编码器重新计算，但不会触发模型重新加载。

### 误区四：节点越多越好

过多的节点会增加维护成本和调试难度。好的工作流应该简洁清晰——能用 5 个节点完成的事，不要用 10 个。

## 八、小结

1. **ComfyUI 是节点式工作流引擎**，核心思想是"每个节点做一件事，通过连线传递数据"
2. **核心数据类型**：MODEL、CLIP、VAE、CONDITIONING、LATENT、IMAGE、MASK
3. **惰性执行 + 自动缓存** = 高效的计算资源利用
4. **工作流文件是 JSON 格式**，支持导入导出和 PNG 嵌入
5. **理解数据流**是掌握 ComfyUI 的关键：Prompt → Conditioning → Latent → Image

## 练习

### 练习一：工作流 JSON 解析

编写一个 Python 脚本，解析 ComfyUI 工作流的 API 格式 JSON，输出节点依赖图和建议的执行顺序。

### 练习二：自定义节点清单

列出 ComfyUI 中你认为最常用的 10 个节点，说明每个节点的输入、输出和典型用途。

---

## 参考答案

### 练习一

**思路**：解析 API 格式的 JSON，建立节点间的依赖关系，然后做拓扑排序。

**答案**：

```python
import json
from collections import defaultdict

def parse_workflow(workflow_path):
    """解析 ComfyUI API 格式工作流"""
    with open(workflow_path, 'r', encoding='utf-8') as f:
        workflow = json.load(f)

    nodes = {}
    dependencies = defaultdict(set)

    for node_id, node_data in workflow.items():
        class_type = node_data.get("class_type", "Unknown")
        inputs = node_data.get("inputs", {})

        nodes[node_id] = {
            "type": class_type,
            "inputs": {},
            "params": {}
        }

        for input_name, input_value in inputs.items():
            if isinstance(input_value, list) and len(input_value) == 2:
                # 连接引用：[source_node_id, output_index]
                source_id = str(input_value[0])
                nodes[node_id]["inputs"][input_name] = f"node_{source_id}"
                dependencies[node_id].add(source_id)
            else:
                nodes[node_id]["params"][input_name] = input_value

    # 拓扑排序
    in_degree = {nid: 0 for nid in nodes}
    for nid, deps in dependencies.items():
        in_degree[nid] = len(deps)

    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    execution_order = []

    while queue:
        nid = queue.pop(0)
        execution_order.append(nid)
        for other_nid, deps in dependencies.items():
            if nid in deps:
                in_degree[other_nid] -= 1
                if in_degree[other_nid] == 0:
                    queue.append(other_nid)

    # 输出结果
    print("=" * 50)
    print(f"工作流节点数量: {len(nodes)}")
    print("=" * 50)

    print("\n节点详情:")
    for nid in execution_order:
        node = nodes[nid]
        print(f"\n  节点 {nid}: {node['type']}")
        if node['inputs']:
            for inp, src in node['inputs'].items():
                print(f"    输入 {inp} ← {src}")
        if node['params']:
            for param, val in node['params'].items():
                print(f"    参数 {param} = {val}")

    print(f"\n建议执行顺序: {' → '.join(execution_order)}")

    return nodes, execution_order

# 使用示例
# parse_workflow("my_workflow_api.json")
```

**要点**：
- API 格式的输入引用格式为 `[node_id, output_index]`
- 拓扑排序确保每个节点在执行时其依赖已就绪
- 如果出现环，说明工作流设计有误（ComfyUI 不支持循环）

### 练习二

**思路**：按功能分类列出最常用的节点，说明其核心输入输出。

**答案**：

```python
ESSENTIAL_NODES = {
    "1. CheckpointLoaderSimple": {
        "功能": "加载 Stable Diffusion 模型",
        "输入": [],
        "输出": ["MODEL", "CLIP", "VAE"],
        "用途": "每个工作流的起点，加载基础模型"
    },
    "2. CLIPTextEncode": {
        "功能": "将文本编码为条件向量",
        "输入": ["text (STRING)", "CLIP"],
        "输出": ["CONDITIONING"],
        "用途": "将 prompt 转换为模型能理解的向量"
    },
    "3. EmptyLatentImage": {
        "功能": "创建空白潜变量",
        "输入": ["width (INT)", "height (INT)", "batch_size (INT)"],
        "输出": ["LATENT"],
        "用途": "文生图的起点，定义输出尺寸"
    },
    "4. KSampler": {
        "功能": "核心采样器",
        "输入": ["MODEL", "positive", "negative", "LATENT"],
        "输出": ["LATENT"],
        "用途": "执行去噪采样，生成潜变量"
    },
    "5. VAEDecode": {
        "功能": "潜变量解码为图像",
        "输入": ["samples (LATENT)", "VAE"],
        "输出": ["IMAGE"],
        "用途": "将潜空间结果转换为可见图像"
    },
    "6. VAEEncode": {
        "功能": "图像编码为潜变量",
        "输入": ["pixels (IMAGE)", "VAE"],
        "输出": ["LATENT"],
        "用途": "图生图时将输入图像编码到潜空间"
    },
    "7. LoadImage": {
        "功能": "加载输入图像",
        "输入": ["image (STRING)"],
        "输出": ["IMAGE", "MASK"],
        "用途": "图生图、ControlNet、Inpainting 的输入"
    },
    "8. ImageScale": {
        "功能": "缩放图像",
        "输入": ["IMAGE", "width", "height", "upscale_method"],
        "输出": ["IMAGE"],
        "用途": "调整输出尺寸，超分前的预处理"
    },
    "9. SaveImage": {
        "功能": "保存图像到磁盘",
        "输入": ["IMAGE", "filename_prefix"],
        "输出": [],
        "用途": "工作流的终点，保存结果"
    },
    "10. PreviewImage": {
        "功能": "临时预览图像",
        "输入": ["IMAGE"],
        "输出": [],
        "用途": "调试时查看中间结果，不保存到磁盘"
    }
}

for name, info in ESSENTIAL_NODES.items():
    print(f"\n{name}")
    print(f"  功能: {info['功能']}")
    print(f"  输入: {', '.join(info['输入'])}")
    print(f"  输出: {', '.join(info['输出'])}")
    print(f"  用途: {info['用途']}")
```

**要点**：
- 这 10 个节点覆盖了 90% 的基础工作流需求
- CheckpointLoader 是唯一的"三合一"输出节点（MODEL + CLIP + VAE）
- KSampler 是工作流的核心，所有条件都在这里汇聚
- SaveImage 和 PreviewImage 是工作流的终点
