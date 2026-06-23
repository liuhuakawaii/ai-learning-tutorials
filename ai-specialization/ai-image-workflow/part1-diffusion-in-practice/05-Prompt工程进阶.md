# 第 5 课：Prompt 工程进阶 — 从写描述到精确控制

## 场景引入

你已经能用 Stable Diffusion 生成不错的图像了，但很快会遇到这些痛点：

- 写了很长的 prompt，结果模型只关注了前几个词，后面的细节全被忽略
- 想让画面中同时出现两个人，结果它们的脸融在了一起
- 想生成某种特定风格，但不管怎么写 prompt 都是"AI 味"
- 负提示词写了"bad quality"但图像质量并没有明显改善

这些问题的根源不是模型不行，而是 prompt 的写法不对。Prompt 工程不是文学创作——它有明确的结构、权重机制和技巧。本课将教你从"写描述"进化到"精确控制"。

## 学习目标

完成本课后，你将能够：
1. 理解 CLIP Text Encoder 的 token 化机制及其对 prompt 的影响
2. 掌握 prompt 权重语法和分步提示（Prompt Scheduling）
3. 设计有效的负提示词策略
4. 针对不同风格（写实、插画、动漫）构建 prompt 模板
5. 理解 SDXL / SD3 / FLUX 的 prompt 差异

## 一、Prompt 的底层机制

### 1.1 CLIP 的 Token 化

Stable Diffusion 使用 CLIP Text Encoder 将文本转换为向量。理解它的 token 化机制是掌握 prompt 工程的基础。

```python
from transformers import CLIPTokenizer

def analyze_tokenization(prompt):
    """分析 prompt 的 token 化结果"""
    tokenizer = CLIPTokenizer.from_pretrained(
        "openai/clip-vit-large-patch14"
    )

    # Token 化
    tokens = tokenizer.tokenize(prompt)
    token_ids = tokenizer.encode(prompt)

    print(f"原始 prompt: {prompt}")
    print(f"Token 数量: {len(tokens)}")
    print(f"Token 列表: {tokens}")
    print(f"Token IDs: {token_ids}")
    print(f"最大长度限制: 77 tokens")

    # 超出 77 token 的部分会被截断！
    if len(tokens) > 77:
        print("⚠️ 警告：prompt 超出 77 token 限制，末尾内容将被忽略")

    return tokens, token_ids

# 示例
analyze_tokenization(
    "a beautiful sunset over the ocean, golden hour, "
    "photorealistic, 8k uhd, cinematic lighting, "
    "detailed clouds, reflection on water"
)
```

关键限制：
- CLIP 的最大上下文长度是 **77 个 token**
- 一个英文单词通常被拆成 1-3 个 token
- 中文效率更低：一个汉字可能占 2-3 个 token
- **超出 77 token 的部分会被直接截断**

### 1.2 Token 位置的重要性

CLIP 使用因果注意力掩码（causal attention mask），这意味着**靠前的 token 对生成结果的影响更大**。

```
Token 位置影响力：

  位置 1-10：  ★★★★★  核心主题（必须放最重要的描述）
  位置 11-30： ★★★★   风格和质量修饰语
  位置 31-50： ★★★    细节补充
  位置 51-77： ★★     微调和额外细节
  位置 77+：   ✗      被截断，完全无效

正确做法：
  "a red sports car, studio lighting, product photography"
   ↑核心主题        ↑风格          ↑质量修饰

错误做法：
  "product photography of a studio with professional lighting
   and a background showing a beautiful red sports car"
   ↑风格词占了前面    ↑核心主题被挤到后面
```

### 1.3 SDXL / SD3 / FLUX 的 Prompt 差异

```
┌──────────────────────────────────────────────────────────┐
│                    模型 Prompt 对比                        │
├─────────────┬────────────────┬────────────────────────────┤
│ 模型         │ Text Encoder   │ Prompt 特点                │
├─────────────┼────────────────┼────────────────────────────┤
│ SD 1.5       │ CLIP ViT-L/14  │ 77 token，逗号分隔有效     │
│ SDXL         │ CLIP ViT-L/14  │ 支持正/负双 prompt         │
│              │ + OpenCLIP ViT │ 正 prompt 描述内容         │
│              │                │ refiner prompt 描述风格    │
│ SD 3         │ CLIP ViT-L/14  │ 三编码器架构               │
│              │ + OpenCLIP     │ 自然语言理解更强           │
│              │ + T5-XXL       │ T5 支持更长的 prompt       │
│ FLUX.1       │ CLIP ViT-L/14  │ 自然语言优先               │
│              │ + T5-XXL       │ 可以写完整句子             │
│              │                │ 不需要逗号分隔技巧         │
└─────────────┴────────────────┴────────────────────────────┘
```

## 二、Prompt 权重控制

### 2.1 权重语法

```python
"""
Prompt 权重语法对照表（AUTOMATIC1111 / ComfyUI 兼容）

语法                        │ 效果
────────────────────────────┼──────────────────────
(word:1.5)                  │ 将 "word" 的权重提升到 1.5 倍
(word:0.5)                  │ 将 "word" 的权重降低到 0.5 倍
((word))                    │ 等价于 (word:1.21)（每层括号 ×1.1）
(((word)))                  │ 等价于 (word:1.331)
[word]                      │ 等价于 (word:0.9091)（降低 10%）
(word|word)                 │ 权重交替：奇数步用第一个，偶数步用第二个
(from:to:step)              │ 在第 step 步切换权重

权重范围建议：
  0.5-0.8  → 轻微抑制
  0.8-1.0  → 正常偏低
  1.0-1.3  → 正常（默认值）
  1.3-1.7  → 强调
  1.7-2.0  → 非常强调（可能产生伪影）
  >2.0     → 过度强调（几乎必然产生伪影）
"""
```

### 2.2 权重交替与时间步调度

```python
def prompt_scheduling_demo():
    """
    Prompt Scheduling：在采样的不同阶段使用不同的 prompt

    用途：
    - 前期（高噪声）：确定整体构图和大结构
    - 后期（低噪声）：添加细节和精细纹理

    ComfyUI 节点：Prompt Schedule / Conditioning Combine
    """
    # 示例：先确定构图，再添加细节
    schedule = {
        # 前 60% 步数：定义整体场景
        "0.0-0.6": "a woman standing in a garden, full body shot",
        # 后 40% 步数：添加细节
        "0.6-1.0": "detailed facial features, silk dress texture, "
                   "individual flower petals, photorealistic skin"
    }

    # 示例：风格融合
    style_blend = {
        # 前半段：油画风格
        "0.0-0.5": "oil painting style, thick brush strokes",
        # 后半段：水彩风格
        "0.5-1.0": "watercolor style, translucent layers, soft edges"
    }

    return schedule, style_blend
```

## 三、负提示词策略

### 3.1 负提示词的工作原理

负提示词通过 Classifier-Free Guidance 的反向操作起作用：在无条件预测方向上"远离"负提示词描述的内容。

```python
def cfg_with_negative_prompt(model, x, t, positive, negative, guidance_scale):
    """带负提示词的 CFG"""
    noise_positive = model(x, t, positive)
    noise_negative = model(x, t, negative)

    # 核心公式：从负方向向正方向外推
    noise_guided = noise_negative + guidance_scale * (
        noise_positive - noise_negative
    )
    return noise_guided

# 数学直觉：
# 当 guidance_scale > 1 时，生成结果会：
#   1. 靠近 positive prompt 描述的内容
#   2. 远离 negative prompt 描述的内容
```

### 3.2 通用负提示词模板

```python
"""
负提示词策略：按场景分类

通用质量负提示词（几乎所有场景都适用）：
  "lowres, bad anatomy, bad hands, text, error, missing fingers,
   extra digit, fewer digits, cropped, worst quality, low quality,
   normal quality, jpeg artifacts, signature, watermark, username"

写实人像专用：
  "deformed, distorted, disfigured, poorly drawn, bad anatomy,
   wrong anatomy, extra limb, missing limb, floating limbs,
   mutated hands and fingers, out of focus, long neck, long body,
   disgusting, poorly drawn face, clone, morbid"

产品摄影专用：
  "blurry, noisy, grainy, distorted product, wrong proportions,
   unnatural lighting, color cast, chromatic aberration,
   lens flare, overexposed, underexposed"

注意：
  - 负提示词不是越长越好
  - 过于具体的负描述可能"反向激活"（模型反而生成它）
  - 建议控制在 30-50 token 以内
"""
```

### 3.3 何时使用负提示词

```
场景分析：

  需要负提示词的场景：
    ✅ 人像生成（避免变形手指、多余肢体）
    ✅ 文字生成（避免乱码文字）
    ✅ 需要高质量输出（避免低质量伪影）

  不需要负提示词的场景：
    ❌ SDXL / SD3（内置了更好的质量控制）
    ❌ Turbo/LCM 模型（4 步采样下负提示词效果微弱）
    ❌ 概念艺术（负提示词会限制创意多样性）

  SDXL 的做法：
    使用 "Negative Prompt" 字段时，实际上是在 refiner 的
    prompt 中写入负向描述，而不是真正的负提示词机制。
    SDXL 的质量主要靠 base prompt 的措辞控制。
```

## 四、风格化 Prompt 模板

### 4.1 写实摄影风格

```python
REALISTIC_TEMPLATE = """
{subject}, {action}, {setting},
professional photography, {lighting} lighting,
shot on {camera} with {lens} lens,
{color_grade} color grading,
{resolution}, {detail_level}

示例：
  a young woman, reading a book in a café,
  professional photography, soft natural window lighting,
  shot on Sony A7III with 85mm f/1.4 lens,
  warm amber color grading,
  8k uhd, highly detailed skin texture
"""
```

### 4.2 插画与概念艺术

```python
ILLUSTRATION_TEMPLATE = """
{subject}, {style} illustration,
{artist_reference} style,
{color_palette} color palette,
{composition} composition,
{medium} medium

示例：
  a mystical forest with floating islands,
  fantasy illustration,
  in the style of Studio Ghibli and Moebius,
  rich teal and golden amber color palette,
  rule of thirds composition with leading lines,
  digital painting with watercolor textures
"""
```

### 4.3 动漫风格

```python
ANIME_TEMPLATE = """
{character_description},
{anime_style} anime style,
{quality_tags},
{scene_description}

质量标签体系（按优先级排序）：
  第一梯队（必须）：masterpiece, best quality, highly detailed
  第二梯队（风格）：anime style, cel shading, vibrant colors
  第三梯队（细节）：beautiful eyes, detailed hair, dynamic pose
  第四梯队（场景）：detailed background, atmospheric lighting

示例：
  1girl, silver hair, blue eyes, school uniform,
  dynamic running pose, wind in hair,
  anime style, cel shading, vibrant colors,
  masterpiece, best quality, highly detailed,
  cherry blossom trees in background, golden hour lighting
"""
```

## 五、高级技巧

### 5.1 BREAK 关键词

```python
"""
BREAK 关键词的作用：

CLIP 的文本编码是分块处理的（每 77 token 一块）。
当 prompt 超过 77 token 时，后续内容会被截断。
BREAK 关键词强制将后续内容放到新的 77-token 块中编码。

语法示例（AUTOMATIC1111 WebUI）：
  "a beautiful woman, long hair, blue eyes, smile BREAK
   detailed skin texture, natural lighting, photorealistic BREAK
   8k uhd, professional photography, depth of field"

ComfyUI 中的实现方式：
  使用 ConditioningCombine 节点将多个 conditioning 连接
  或使用 Long CLIP 编码器（支持更长上下文）
"""
```

### 5.2 AND 语法与多区域控制

```python
"""
AND 语法：在同一画面中控制不同区域

ComfyUI 实现方式：
  1. 使用 ConditioningArea 节点定义区域
  2. 为每个区域分配独立的 prompt
  3. 将多个 conditioning 合并

场景示例：左侧是白天，右侧是夜晚
  区域1（左半）：prompt="daytime scene, bright sunlight"
                 area=(0, 0, 0.5, 1.0)
  区域2（右半）：prompt="night scene, moonlight, stars"
                 area=(0.5, 0, 1.0, 1.0)
  合并后输入采样器

这比用 prompt 描述 "left side daytime right side nighttime" 效果好得多。
"""
```

### 5.3 Prompt 压缩与优化

```python
def optimize_prompt(prompt, max_tokens=75):
    """
    Prompt 优化策略：在有限 token 内最大化信息密度

    原则：
    1. 核心主题放在最前面
    2. 删除冗余修饰词
    3. 用具体词汇替代抽象描述
    4. 合并同义描述
    """
    optimizations = [
        # 删除冗余
        ("very very beautiful", "stunning"),
        ("a lot of details", "intricate details"),
        ("really high quality", "masterpiece"),

        # 具体化
        ("nice lighting", "Rembrandt lighting"),
        ("good composition", "rule of thirds"),
        ("pretty colors", "vibrant complementary colors"),

        # 合并同义
        ("8k, 4k, high resolution, ultra hd", "8k uhd"),
        ("detailed, intricate, fine details", "intricate details"),
    ]

    optimized = prompt
    for old, new in optimizations:
        optimized = optimized.replace(old, new)

    return optimized
```

## 六、常见误区

### 误区一：Prompt 越长越好

CLIP 的有效上下文只有 77 token。超出部分要么被截断，要么需要 BREAK 分块——但分块后的信息融合效果远不如在 77 token 内组织好。

### 误区二：负提示词"low quality"万能

在 SD 1.5 中，负提示词确实有效。但在 SDXL 和 SD3 中，质量控制更多依赖正提示词的措辞和模型本身的能力。过度依赖负提示词反而会导致画面"过度干净"，失去自然感。

### 误区三：权重越高效果越强

权重超过 1.7 后几乎必然产生伪影。如果某个元素需要极高权重才能出现，说明 prompt 的组织方式有问题——应该把该元素移到更靠前的位置，而不是加大权重。

### 误区四：所有模型通用一套 Prompt

SD 1.5 依赖逗号分隔的标签式 prompt；SDXL 需要更自然的描述；SD3 和 FLUX 可以理解完整的自然语言句子。用错了 prompt 风格，效果会大打折扣。

## 七、小结

1. **理解 token 化机制**是 prompt 工程的基础——77 token 限制、位置重要性
2. **核心描述靠前放**，风格和质量修饰在中间，细节补充在后面
3. **权重控制要克制**，1.0-1.3 是安全范围，超过 1.7 必然出伪影
4. **负提示词是辅助手段**，不是万能药
5. **不同模型需要不同的 prompt 策略**，SDXL/SD3/FLUX 的理解能力递增

## 练习

### 练习一：Prompt 位置实验

编写一个实验，将同一个描述词分别放在 prompt 的开头、中间和末尾，生成三张图像，观察模型对不同位置的关注程度。

### 练习二：风格 Prompt 模板库

为以下五种风格各写一个可复用的 prompt 模板：写实人像、产品摄影、动漫角色、概念艺术、极简设计。每个模板包含正提示词和负提示词。

---

## 参考答案

### 练习一

**思路**：固定 seed，将测试词放在 prompt 的三个位置，观察生成结果的差异。

**答案**：

```python
import torch
from diffusers import StableDiffusionXLPipeline

def position_experiment():
    """测试 prompt 中不同位置的描述词对生成结果的影响"""
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16
    ).to("cuda")

    # 测试词："red dress"
    base_prompt = "a woman standing in a park, natural lighting, photorealistic"
    test_word = "red dress"

    prompts = {
        "front": f"{test_word}, {base_prompt}",
        "middle": "a woman, " + test_word + ", standing in a park, photorealistic",
        "end": f"{base_prompt}, wearing {test_word}"
    }

    seed = 42
    for position, prompt in prompts.items():
        generator = torch.Generator("cuda").manual_seed(seed)
        image = pipe(
            prompt=prompt,
            num_inference_steps=25,
            generator=generator,
            guidance_scale=7.0
        ).images[0]
        image.save(f"position_{position}.png")
        print(f"位置: {position}")
        print(f"  Prompt: {prompt}")
        print(f"  预期: {'front' 位置红色连衣裙最明显，'end' 位置可能被忽略'}")

position_experiment()
```

**要点**：
- "front" 位置的描述词对生成结果影响最强
- "end" 位置的描述词可能被截断或权重减弱
- 关键元素应放在 prompt 的前 10 个 token 内

### 练习二

**思路**：每个风格模板需要包含：主体描述占位符、风格关键词、质量修饰语、负提示词。

**答案**：

```python
STYLE_TEMPLATES = {
    "realistic_portrait": {
        "positive": (
            "portrait of {subject}, {expression} expression, "
            "professional photography, {lighting} lighting, "
            "shot on Canon EOS R5 with 85mm f/1.2 lens, "
            "shallow depth of field, natural skin texture, "
            "8k uhd, highly detailed"
        ),
        "negative": (
            "deformed, distorted, bad anatomy, extra limbs, "
            "floating limbs, mutated hands, blurry, noisy, "
            "cartoon, anime, painting, illustration"
        )
    },
    "product_photography": {
        "positive": (
            "{product} on {surface} surface, "
            "professional product photography, "
            "three-point studio lighting, "
            "clean background, centered composition, "
            "accurate colors, sharp focus, 8k uhd"
        ),
        "negative": (
            "blurry, noisy, distorted, wrong proportions, "
            "unnatural shadows, color cast, chromatic aberration, "
            "text, watermark, low quality"
        )
    },
    "anime_character": {
        "positive": (
            "{character_description}, "
            "anime style, cel shading, vibrant colors, "
            "masterpiece, best quality, highly detailed, "
            "beautiful eyes, detailed hair, {pose} pose, "
            "{background} background"
        ),
        "negative": (
            "lowres, bad anatomy, bad hands, text, error, "
            "missing fingers, fewer digits, worst quality, "
            "low quality, blurry, realistic, photographic"
        )
    },
    "concept_art": {
        "positive": (
            "{scene_description}, "
            "concept art, digital painting, "
            "in the style of {artist_reference}, "
            "{color_palette} color palette, "
            "detailed environment, atmospheric perspective, "
            "trending on ArtStation"
        ),
        "negative": (
            "photograph, realistic, 3d render, blurry, "
            "low detail, simple background, flat colors"
        )
    },
    "minimalist_design": {
        "positive": (
            "{subject}, minimalist design, "
            "clean composition, ample negative space, "
            "limited color palette of {colors}, "
            "geometric shapes, modern aesthetic, "
            "vector art style, flat design"
        ),
        "negative": (
            "complex, busy, noisy, detailed textures, "
            "realistic, photographic, gradients, 3d, shadows"
        )
    }
}

# 使用示例
for style, template in STYLE_TEMPLATES.items():
    print(f"\n{'='*50}")
    print(f"风格: {style}")
    print(f"正提示词: {template['positive']}")
    print(f"负提示词: {template['negative']}")
```

**要点**：
- 写实类避免 "cartoon, anime, painting" 等非写实关键词
- 动漫类需要 "masterpiece, best quality" 等质量标签
- 产品摄影强调灯光和清晰度
- 概念艺术需要艺术家参考和色彩方案
