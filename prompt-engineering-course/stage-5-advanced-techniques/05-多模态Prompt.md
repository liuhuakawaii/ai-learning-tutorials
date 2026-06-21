# 05 - 多模态 Prompt

> **课程定位**：Stage 5 高级技巧 · 第 5 课
> **前置要求**：完成 Stage 1-4，熟悉 OpenAI/Claude API 调用
> **预计时间**：90 分钟

---

## 学习目标

1. 理解多模态 Prompt 的核心概念
2. 掌握 GPT-4 Vision 和 Claude Vision 的使用方法
3. 实现图片分析和视觉推理
4. 构建多模态 Prompt Pipeline
5. 掌握多模态场景的最佳实践

---

## 1. 什么是多模态 Prompt？

多模态 Prompt 是指同时包含文本和非文本（图片、音频、视频等）输入的提示词。

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    多模态 Prompt 架构                                        ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   ┌─────────────────────────────────────────────────────────────────────┐  ║
║   │                      多模态输入                                      │  ║
║   │                                                                     │  ║
║   │   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐       │  ║
║   │   │  文本    │   │  图片    │   │  音频    │   │  视频    │       │  ║
║   │   │  (Text)  │   │  (Image) │   │  (Audio) │   │  (Video) │       │  ║
║   │   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘       │  ║
║   │        │              │              │              │              │  ║
║   │        └──────────────┼──────────────┼──────────────┘              │  ║
║   │                       ▼              ▼                              │  ║
║   │              ┌──────────────────────────────┐                      │  ║
║   │              │       多模态 LLM             │                      │  ║
║   │              │  (GPT-4V / Claude Vision)    │                      │  ║
║   │              └──────────────┬───────────────┘                      │  ║
║   │                             │                                      │  ║
║   │                             ▼                                      │  ║
║   │                    ┌─────────────────┐                             │  ║
║   │                    │   多模态输出    │                             │  ║
║   │                    └─────────────────┘                             │  ║
║   └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║   应用场景：                                                                ║
║   - 图片理解与描述                                                          ║
║   - OCR 文字识别                                                            ║
║   - 图表数据分析                                                            ║
║   - 视觉问答 (VQA)                                                          ║
║   - 文档解析                                                                ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 1.1 多模态模型对比

| 特性 | GPT-4 Vision | Claude 3 Vision | Gemini Pro Vision |
|------|--------------|-----------------|-------------------|
| 图片输入 | ✓ | ✓ | ✓ |
| 图片 URL | ✓ | ✓ | ✓ |
| Base64 | ✓ | ✓ | ✓ |
| 多图理解 | ✓ | ✓ | ✓ |
| 高分辨率 | ✓ | ✓ | ✓ |
| 价格 | 中 | 中 | 低 |

---

## 2. GPT-4 Vision 使用

### 2.1 基础图片分析

```python
import openai
import base64
import requests
from typing import List, Dict, Optional
from pathlib import Path

client = openai.OpenAI()

def analyze_image_with_url(
    image_url: str,
    prompt: str,
    model: str = "gpt-4o"
) -> str:
    """使用 URL 分析图片"""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url,
                            "detail": "high"  # low, high, auto
                        }
                    }
                ]
            }
        ],
        max_tokens=1000
    )

    return response.choices[0].message.content


def analyze_image_with_base64(
    image_path: str,
    prompt: str,
    model: str = "gpt-4o"
) -> str:
    """使用 Base64 编码分析本地图片"""
    # 读取图片并编码为 Base64
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    # 获取图片类型
    ext = Path(image_path).suffix.lower()
    mime_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }
    mime_type = mime_types.get(ext, "image/jpeg")

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_data}",
                            "detail": "high"
                        }
                    }
                ]
            }
        ],
        max_tokens=1000
    )

    return response.choices[0].message.content


# 使用示例
if __name__ == "__main__":
    # 使用 URL
    url_result = analyze_image_with_url(
        image_url="https://example.com/image.jpg",
        prompt="请详细描述这张图片的内容。"
    )
    print("URL 分析结果:", url_result)

    # 使用本地文件
    local_result = analyze_image_with_base64(
        image_path="path/to/local/image.jpg",
        prompt="这张图片中有什么文字？"
    )
    print("本地分析结果:", local_result)
```

### 2.2 多图对比分析

```python
def compare_images(
    image_urls: List[str],
    prompt: str,
    model: str = "gpt-4o"
) -> str:
    """对比分析多张图片"""
    content = [{"type": "text", "text": prompt}]

    for i, url in enumerate(image_urls):
        content.append({
            "type": "image_url",
            "image_url": {
                "url": url,
                "detail": "high"
            }
        })

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "user", "content": content}
        ],
        max_tokens=1500
    )

    return response.choices[0].message.content


# 使用示例
comparison_result = compare_images(
    image_urls=[
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg"
    ],
    prompt="请对比这两张图片的异同点，从颜色、构图、内容三个方面分析。"
)
print(comparison_result)
```

---

## 3. Claude Vision 使用

### 3.1 Anthropic API 调用

```python
import anthropic
import base64
from pathlib import Path

anthropic_client = anthropic.Anthropic()

def analyze_image_claude(
    image_path: str,
    prompt: str,
    model: str = "claude-3-opus-20240229"
) -> str:
    """使用 Claude 分析图片"""
    # 读取图片
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    # 获取媒体类型
    ext = Path(image_path).suffix.lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }
    media_type = media_types.get(ext, "image/jpeg")

    response = anthropic_client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    )

    return response.content[0].text


def analyze_image_claude_url(
    image_url: str,
    prompt: str,
    model: str = "claude-3-opus-20240229"
) -> str:
    """使用 URL 让 Claude 分析图片"""
    # 下载图片
    response = requests.get(image_url)
    image_data = base64.standard_b64encode(response.content).decode("utf-8")

    # 推断媒体类型
    content_type = response.headers.get("content-type", "image/jpeg")

    response = anthropic_client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": content_type,
                            "data": image_data
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    )

    return response.content[0].text


# 使用示例
claude_result = analyze_image_claude(
    image_path="path/to/image.jpg",
    prompt="请分析这张图片中的数据图表，提取关键数据点。"
)
print(claude_result)
```

---

## 4. 多模态 Prompt 设计技巧

### 4.1 结构化视觉 Prompt

```python
class VisualPromptDesigner:
    """视觉 Prompt 设计器"""

    @staticmethod
    def ocr_prompt(languages: List[str] = None) -> str:
        """OCR 文字识别 Prompt"""
        lang_str = "、".join(languages) if languages else "中文和英文"
        return f"""请识别图片中的所有文字。

要求：
1. 识别语言：{lang_str}
2. 保持原始排版格式
3. 标注不确定的字符（用 [?] 表示）
4. 如果有表格，转换为 Markdown 表格格式

输出格式：
## 识别结果
[识别的文字内容]

## 不确定字符
[列出不确定的字符及其位置]
"""

    @staticmethod
    def data_chart_prompt() -> str:
        """数据分析图表 Prompt"""
        return """请分析这张数据图表。

要求：
1. 识别图表类型（柱状图、折线图、饼图等）
2. 提取所有数据点
3. 分析数据趋势和规律
4. 给出数据洞察

输出格式：
## 图表类型
[图表类型]

## 数据提取
[表格形式的数据]

## 趋势分析
[数据趋势描述]

## 关键洞察
[2-3 条关键发现]
"""

    @staticmethod
    def object_detection_prompt() -> str:
        """物体检测 Prompt"""
        return """请识别图片中的所有物体。

要求：
1. 列出所有可识别的物体
2. 标注每个物体的位置（上/中/下，左/中/右）
3. 估计物体的大小（大/中/小）
4. 描述物体之间的空间关系

输出格式：
## 物体列表
1. [物体名称] - 位置: [位置]，大小: [大小]
2. ...

## 空间关系
[描述物体之间的位置关系]
"""

    @staticmethod
    def scene_understanding_prompt() -> str:
        """场景理解 Prompt"""
        return """请深入理解这张图片的场景。

分析维度：
1. 场景类型：这是什么场景？（室内/室外/工作/生活等）
2. 时间信息：可能是什么时间段？（白天/晚上/季节等）
3. 人物活动：图中有人吗？在做什么？
4. 情感氛围：图片传达什么情感？
5. 故事推测：可能发生什么故事？

请按以上维度逐一分析。"""


class MultimodalPipeline:
    """多模态处理 Pipeline"""

    def __init__(self, model: str = "gpt-4o"):
        self.model = model
        self.designer = VisualPromptDesigner()

    def process_image(
        self,
        image_source: str,
        task_type: str,
        custom_prompt: str = None
    ) -> Dict:
        """处理图片"""
        # 选择 Prompt
        if custom_prompt:
            prompt = custom_prompt
        elif task_type == "ocr":
            prompt = self.designer.ocr_prompt()
        elif task_type == "chart":
            prompt = self.designer.data_chart_prompt()
        elif task_type == "detection":
            prompt = self.designer.object_detection_prompt()
        elif task_type == "scene":
            prompt = self.designer.scene_understanding_prompt()
        else:
            prompt = "请详细描述这张图片。"

        # 判断输入类型
        if image_source.startswith(("http://", "https://")):
            result = analyze_image_with_url(image_source, prompt, self.model)
        else:
            result = analyze_image_with_base64(image_source, prompt, self.model)

        return {
            "task_type": task_type,
            "image_source": image_source,
            "prompt": prompt,
            "result": result
        }

    def batch_process(
        self,
        images: List[Dict[str, str]]
    ) -> List[Dict]:
        """批量处理图片"""
        results = []
        for img_info in images:
            result = self.process_image(
                image_source=img_info["source"],
                task_type=img_info.get("task_type", "describe"),
                custom_prompt=img_info.get("prompt")
            )
            results.append(result)
        return results


# 使用示例
if __name__ == "__main__":
    pipeline = MultimodalPipeline(model="gpt-4o")

    # OCR 任务
    ocr_result = pipeline.process_image(
        image_source="https://example.com/document.jpg",
        task_type="ocr"
    )
    print("OCR 结果:", ocr_result["result"])

    # 数据图表分析
    chart_result = pipeline.process_image(
        image_source="path/to/chart.png",
        task_type="chart"
    )
    print("图表分析:", chart_result["result"])

    # 批量处理
    batch_results = pipeline.batch_process([
        {"source": "https://example.com/img1.jpg", "task_type": "scene"},
        {"source": "https://example.com/img2.jpg", "task_type": "detection"},
    ])
```

### 4.2 高级视觉推理

```python
class AdvancedVisualReasoning:
    """高级视觉推理"""

    def __init__(self, model: str = "gpt-4o"):
        self.model = model

    def chain_of_thought_visual(
        self,
        image_source: str,
        question: str
    ) -> str:
        """使用 CoT 进行视觉推理"""
        prompt = f"""请一步步推理来回答关于这张图片的问题。

问题：{question}

请按以下步骤推理：

Step 1: 描述图片中的关键元素
[列出图片中的主要元素]

Step 2: 分析元素之间的关系
[描述元素之间的关系]

Step 3: 基于关系进行推理
[进行逻辑推理]

Step 4: 得出结论
[给出最终答案]

请严格按照以上步骤进行推理。"""

        if image_source.startswith(("http://", "https://")):
            return analyze_image_with_url(image_source, prompt, self.model)
        else:
            return analyze_image_with_base64(image_source, prompt, self.model)

    def visual_qa_with_context(
        self,
        image_source: str,
        question: str,
        context: str = None
    ) -> str:
        """带上下文的视觉问答"""
        prompt = f"""请基于图片内容回答问题。"""

        if context:
            prompt += f"""

背景信息：
{context}"""

        prompt += f"""

问题：{question}

要求：
1. 答案必须基于图片内容
2. 如果图片中没有相关信息，请说明
3. 引用图片中的具体细节支持你的答案"""

        if image_source.startswith(("http://", "https://")):
            return analyze_image_with_url(image_source, prompt, self.model)
        else:
            return analyze_image_with_base64(image_source, prompt, self.model)

    def multi_step_visual_analysis(
        self,
        image_source: str
    ) -> Dict:
        """多步骤视觉分析"""
        results = {}

        # 步骤 1: 基础描述
        results["description"] = self._get_basic_description(image_source)

        # 步骤 2: 细节提取
        results["details"] = self._extract_details(image_source)

        # 步骤 3: 情感分析
        results["sentiment"] = self._analyze_sentiment(image_source)

        # 步骤 4: 综合洞察
        results["insights"] = self._generate_insights(results)

        return results

    def _get_basic_description(self, image_source: str) -> str:
        """获取基础描述"""
        return self._analyze(image_source, "请简要描述这张图片的主要内容。")

    def _extract_details(self, image_source: str) -> str:
        """提取细节"""
        return self._analyze(
            image_source,
            "请详细列出图片中的所有细节，包括颜色、形状、文字、数字等。"
        )

    def _analyze_sentiment(self, image_source: str) -> str:
        """情感分析"""
        return self._analyze(
            image_source,
            "这张图片传达了什么情感或氛围？请解释原因。"
        )

    def _generate_insights(self, results: Dict) -> str:
        """生成综合洞察"""
        prompt = f"""基于以下图片分析结果，生成综合洞察：

## 基础描述
{results['description']}

## 细节信息
{results['details']}

## 情感分析
{results['sentiment']}

请生成 3-5 条关键洞察，每条洞察包含：
1. 发现
2. 意义
3. 可能的应用"""

        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        return response.choices[0].message.content

    def _analyze(self, image_source: str, prompt: str) -> str:
        """分析图片"""
        if image_source.startswith(("http://", "https://")):
            return analyze_image_with_url(image_source, prompt, self.model)
        else:
            return analyze_image_with_base64(image_source, prompt, self.model)
```

---

## 5. 多模态应用场景

### 5.1 文档解析

```python
class DocumentParser:
    """文档解析器"""

    def __init__(self, model: str = "gpt-4o"):
        self.model = model

    def parse_document(self, image_path: str) -> Dict:
        """解析文档图片"""
        # 提取文字
        ocr_prompt = """请提取文档中的所有文字，保持原始格式。

特别注意：
1. 标题层级
2. 列表编号
3. 表格结构
4. 页眉页脚

请使用 Markdown 格式输出。"""

        text_content = analyze_image_with_base64(
            image_path, ocr_prompt, self.model
        )

        # 分析文档结构
        structure_prompt = """请分析这个文档的结构：

1. 文档类型（报告/发票/合同/简历等）
2. 主要章节
3. 关键信息字段
4. 文档日期（如果有）

请以 JSON 格式输出。"""

        structure = analyze_image_with_base64(
            image_path, structure_prompt, self.model
        )

        return {
            "text_content": text_content,
            "structure": structure
        }

    def parse_table(self, image_path: str) -> str:
        """解析表格"""
        prompt = """请将图片中的表格转换为 Markdown 表格格式。

要求：
1. 保持所有行列
2. 对齐列标题
3. 处理合并单元格
4. 保留数值精度"""

        return analyze_image_with_base64(image_path, prompt, self.model)


# 使用示例
parser = DocumentParser()
result = parser.parse_document("path/to/document.jpg")
print("文档内容:", result["text_content"])
print("文档结构:", result["structure"])
```

### 5.2 图片内容生成

```python
class ImageContentGenerator:
    """图片内容生成器"""

    def __init__(self, model: str = "gpt-4o"):
        self.model = model

    def generate_alt_text(
        self,
        image_path: str,
        max_length: int = 100
    ) -> str:
        """生成图片替代文本（无障碍访问）"""
        prompt = f"""请为这张图片生成替代文本（alt text），用于无障碍访问。

要求：
1. 简洁明了，不超过 {max_length} 个字符
2. 描述图片的主要内容
3. 包含关键信息
4. 避免冗余描述

请直接输出替代文本，不要添加其他说明。"""

        return analyze_image_with_base64(image_path, prompt, self.model)

    def generate_social_media_caption(
        self,
        image_path: str,
        platform: str = "instagram"
    ) -> str:
        """生成社交媒体文案"""
        prompt = f"""请为这张图片生成 {platform} 文案。

要求：
1. 吸引眼球的开头
2. 描述图片内容
3. 包含情感元素
4. 适当使用 emoji
5. 提供 5-10 个相关标签

请按以下格式输出：
[文案内容]

标签：#标签1 #标签2 ..."""

        return analyze_image_with_base64(image_path, prompt, self.model)

    def generate_product_description(
        self,
        image_path: str
    ) -> str:
        """生成产品描述"""
        prompt = """请根据产品图片生成详细的产品描述。

要求：
1. 产品名称
2. 外观描述（颜色、材质、尺寸）
3. 功能特点
4. 适用场景
5. 卖点总结

请使用专业的电商文案风格。"""

        return analyze_image_with_base64(image_path, prompt, self.model)
```

---

## 6. 常见错误

| 错误 | 正确做法 |
|------|----------|
| 图片分辨率太低 | 使用高分辨率图片，至少 512x512 |
| Prompt 过于模糊 | 提供具体的分析指令和输出格式 |
| 不处理 API 错误 | 添加重试机制和错误处理 |
| 忽略 Token 限制 | 控制图片大小和 Prompt 长度 |
| 单一任务重复调用 | 批量处理提高效率 |

---

## 7. 本节小结

多模态 Prompt 是 AI 应用的重要方向：

1. **图片分析**：GPT-4 Vision 和 Claude Vision 的使用
2. **Prompt 设计**：OCR、图表分析、物体检测等专用 Prompt
3. **高级推理**：CoT 视觉推理、多步骤分析
4. **应用场景**：文档解析、内容生成、无障碍访问
5. **最佳实践**：高分辨率、明确指令、错误处理

---

## 练习

### 练习 1：基础图片分析
使用 GPT-4 Vision 分析一张包含文字的图片，提取所有文字内容。

### 练习 2：多图对比
上传两张相似的图片，让模型找出它们的异同点。

### 练习 3：文档解析 Pipeline
构建一个完整的文档解析 Pipeline，能够自动识别文档类型并提取结构化信息。

---

> **下一课**：[06 - 阶段实战：高级 Prompt 综合应用](./06-阶段实战-高级Prompt综合应用.md)
