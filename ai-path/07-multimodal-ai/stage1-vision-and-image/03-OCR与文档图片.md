# 03 OCR 与文档图片——从图片中提取文字和表格

> OCR 让 AI 能从图片中提取文字和表格数据。

## 场景引入

你的公司每天收到数百张合同扫描件和发票照片，财务团队需要手动从中提取金额、日期、公司名称等关键信息，不仅耗时而且容易出错。你接到任务要构建一个自动化 OCR 系统，但测试后发现：拍照角度倾斜导致文字变形、表格线条和文字粘连、扫描件分辨率不一、手写批注和印刷文字混在一起——这些真实场景的复杂度远超 demo 级别的"从清晰图片提取文字"。

## 学习目标

- 掌握 OCR 的使用方法
- 实现文字和表格提取
- 学会处理各种文档图片

---

## 一、文字提取

```python
def extract_text_from_image(image_url: str) -> str:
    """从图片提取文字"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "请提取这张图片中的所有文字，保持原始格式"},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ]
    )
    return response.choices[0].message.content
```

---

## 二、表格提取

```python
def extract_table_from_image(image_url: str) -> list:
    """从图片提取表格"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "请提取这张图片中的表格，以 JSON 格式输出"},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)
```

---

## 三、文档解析

```python
def parse_document_image(image_url: str) -> dict:
    """解析文档图片"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": """请解析这张文档图片，提取：
1. 标题
2. 正文内容
3. 表格数据（如有）
4. 关键信息

请以 JSON 格式输出。"""},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)
```

---

## 四、批量处理

```python
def batch_ocr(image_urls: list) -> list:
    """批量 OCR"""
    results = []
    
    for url in image_urls:
        text = extract_text_from_image(url)
        results.append({"url": url, "text": text})
    
    return results
```

---

## 五、质量优化

```
OCR 质量优化：

1. 图片预处理
   - 调整亮度和对比度
   - 去噪
   - 纠正倾斜

2. 分块处理
   - 大图片分块识别
   - 拼接结果

3. 后处理
   - 纠正识别错误
   - 格式化输出
```

---

## 常见误区

1. **认为 Vision API 的 OCR 能替代专业 OCR 工具**：大模型的 OCR 在简单场景下表现不错，但在低质量扫描件、手写文字、复杂表格等场景下，专业 OCR（如 Azure Document Intelligence）的准确率更高。
2. **忽略图片预处理的重要性**：直接把倾斜、模糊的原图扔给 API，识别效果会大打折扣，倾斜校正、去噪、二值化等预处理步骤不可省略。
3. **不做结果校验就入库**：OCR 结果必然存在错误，关键字段（金额、日期、合同号）必须做格式校验和人工抽检。
4. **一次性处理整页大图**：整页图片分辨率高、token 消耗大，且模型注意力容易分散，建议先裁剪区域再识别。

## 工程建议

1. **建立预处理 Pipeline**：倾斜校正 → 去噪 → 二值化 → 分辨率标准化，用 OpenCV 或 Pillow 自动化处理。
2. **关键字段用正则校验**：金额格式（`^\d+\.\d{2}$`）、日期格式（`^\d{4}-\d{2}-\d{2}$`）、合同号等必须做正则匹配校验。
3. **混合方案降低成本**：简单文字用 Tesseract 等免费 OCR，复杂表格和手写用大模型 API，按难度分级处理。
4. **保留原始图片和 OCR 结果的关联**：存储时同时保存原始图片路径和 OCR 结果，方便后续人工复核和模型迭代。

## 小结

```
本课核心要点：

1. 用 Vision API 实现 OCR
2. 支持文字和表格提取
3. 支持文档结构化解析
4. 批量处理和质量优化

---

**下一课**: [04 图表理解——让 AI 解读柱状图、折线图、流程图](./04-图表理解.md)
```

---

## 练习

1. **OCR 题**：从图片中提取文字。

2. **表格题**：从图片中提取表格数据。

3. **文档题**：解析一个文档图片。

---

## 参考答案

### 练习一：OCR 题

**思路**：使用 Vision API 从图片中提取文字，结合预处理和后处理提高识别准确率。

**答案**：
```python
import base64
import re
from openai import OpenAI
from PIL import Image, ImageEnhance

client = OpenAI()


def preprocess_image(image_path: str, output_path: str = "preprocessed.png") -> str:
    """图片预处理：提高 OCR 准确率"""
    img = Image.open(image_path)
    
    # 转灰度
    img = img.convert("L")
    
    # 增强对比度
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)
    
    # 增强锐度
    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(2.0)
    
    # 调整分辨率（太低影响识别，太高浪费 token）
    width, height = img.size
    if width < 1000:
        scale = 1000 / width
        img = img.resize((int(width * scale), int(height * scale)))
    
    img.save(output_path)
    return output_path


def extract_text_from_image(image_path: str, preprocess: bool = True) -> str:
    """从图片中提取文字"""
    
    if preprocess:
        image_path = preprocess_image(image_path)
    
    with open(image_path, "rb") as f:
        image_base64 = base64.b64encode(f.read()).decode()
    
    prompt = """请提取这张图片中的所有文字，要求：
1. 保持原始文字的排版格式（换行、缩进）
2. 逐字准确识别，不要推测或补充
3. 无法确认的文字用 [?] 标记
4. 如果有表格，用 Markdown 表格格式输出"""
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}", "detail": "high"}}
            ]
        }]
    )
    
    text = response.choices[0].message.content
    
    # 后处理：清理多余空行
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text


if __name__ == "__main__":
    text = extract_text_from_image("document_scan.jpg")
    print(text)
```

**要点**：
- 预处理（灰度化、增强对比度、调整分辨率）能显著提高 OCR 准确率
- 使用 `"detail": "high"` 获取更高分辨率的识别，但 token 消耗增加
- 对无法确认的文字要求模型用 `[?]` 标记，而不是猜测
- 常见错误：直接把低质量扫描件扔给 API，不做任何预处理，识别效果很差

### 练习二：表格题

**思路**：从图片中提取表格数据，输出为结构化的 JSON 格式，便于后续入库和分析。

**答案**：
```python
import base64
import json
from openai import OpenAI

client = OpenAI()


def extract_table_from_image(image_path: str) -> dict:
    """从图片中提取表格数据"""
    
    with open(image_path, "rb") as f:
        image_base64 = base64.b64encode(f.read()).decode()
    
    prompt = """请提取这张图片中的表格数据，以 JSON 格式输出。

输出格式：
{
  "table_title": "表格标题（如有）",
  "headers": ["列名1", "列名2", "列名3"],
  "rows": [
    ["第一行数据1", "第一行数据2", "第一行数据3"],
    ["第二行数据1", "第二行数据2", "第二行数据3"]
  ],
  "notes": "表格注释或脚注（如有）"
}

要求：
- 准确提取每个单元格的数据
- 数字保持原始格式（不要自动转换类型）
- 合并单元格的内容在对应行重复填写
- 无法识别的单元格填 null"""
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}", "detail": "high"}}
            ]
        }],
        response_format={"type": "json_object"}
    )
    
    table_data = json.loads(response.choices[0].message.content)
    
    # 输出为 Markdown 表格
    print(f"表格标题: {table_data.get('table_title', '无')}\n")
    headers = table_data.get("headers", [])
    if headers:
        print("| " + " | ".join(headers) + " |")
        print("| " + " | ".join(["---"] * len(headers)) + " |")
        for row in table_data.get("rows", []):
            print("| " + " | ".join(str(cell) for cell in row) + " |")
    
    return table_data


def validate_table_data(table_data: dict) -> list[str]:
    """校验表格数据的完整性"""
    issues = []
    
    headers = table_data.get("headers", [])
    rows = table_data.get("rows", [])
    
    # 检查列数一致性
    expected_cols = len(headers)
    for i, row in enumerate(rows):
        if len(row) != expected_cols:
            issues.append(f"第 {i+1} 行列数不匹配：期望 {expected_cols} 列，实际 {len(row)} 列")
    
    # 检查空值
    for i, row in enumerate(rows):
        for j, cell in enumerate(row):
            if cell is None or cell == "":
                issues.append(f"第 {i+1} 行第 {j+1} 列为空")
    
    if issues:
        print("数据质量问题:")
        for issue in issues:
            print(f"  ⚠️ {issue}")
    else:
        print("✓ 表格数据校验通过")
    
    return issues


if __name__ == "__main__":
    table_data = extract_table_from_image("financial_table.png")
    validate_table_data(table_data)
```

**要点**：
- 表格提取要求模型理解单元格的行列关系，prompt 中要明确输出格式
- 数字类型要保持字符串格式，避免精度丢失（如"1,234.56"被转为 1234.56）
- 必须做列数一致性校验，模型有时会漏掉某列或多出某列
- 常见错误：不校验提取结果的结构完整性，直接入库导致数据错位

### 练习三：文档题

**思路**：解析完整的文档图片，提取标题、正文、表格、关键信息等结构化数据。

**答案**：
```python
import base64
import json
from openai import OpenAI

client = OpenAI()


def parse_document_image(image_path: str) -> dict:
    """解析文档图片，提取结构化信息"""
    
    with open(image_path, "rb") as f:
        image_base64 = base64.b64encode(f.read()).decode()
    
    prompt = """请全面解析这张文档图片，提取以下结构化信息：

{
  "document_type": "文档类型（如：发票、合同、报告、简历等）",
  "title": "文档标题",
  "metadata": {
    "date": "日期（如有）",
    "author": "作者/签发人（如有）",
    "serial_number": "编号（如有）"
  },
  "sections": [
    {
      "heading": "段落标题",
      "content": "段落内容"
    }
  ],
  "tables": [
    {
      "title": "表格标题",
      "headers": ["列名1", "列名2"],
      "rows": [["数据1", "数据2"]]
    }
  ],
  "key_info": {
    "amount": "金额（如有）",
    "parties": ["相关方1", "相关方2"],
    "deadline": "截止日期（如有）"
  },
  "annotations": "手写批注内容（如有）"
}

要求：
- 准确提取，不要推测不存在的信息
- 无法确认的字段填 null
- 手写内容和印刷内容分别标注"""
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}", "detail": "high"}}
            ]
        }],
        response_format={"type": "json_object"}
    )
    
    doc = json.loads(response.choices[0].message.content)
    
    # 输出解析结果
    print(f"文档类型: {doc.get('document_type', '未知')}")
    print(f"标题: {doc.get('title', '无')}")
    
    if doc.get("metadata"):
        meta = doc["metadata"]
        print(f"日期: {meta.get('date', '未知')}")
        print(f"编号: {meta.get('serial_number', '未知')}")
    
    if doc.get("sections"):
        print(f"\n正文段落: {len(doc['sections'])} 个")
        for sec in doc["sections"]:
            print(f"  [{sec.get('heading', '无标题')}] {sec['content'][:50]}...")
    
    if doc.get("tables"):
        print(f"\n表格: {len(doc['tables'])} 个")
    
    if doc.get("key_info"):
        print(f"\n关键信息: {json.dumps(doc['key_info'], ensure_ascii=False)}")
    
    return doc


if __name__ == "__main__":
    doc = parse_document_image("contract_scan.jpg")
    
    with open("parsed_document.json", "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
```

**要点**：
- 文档解析的 prompt 要覆盖所有可能的信息类型（标题、正文、表格、元数据、批注）
- 区分印刷文字和手写批注，两者的识别难度和处理方式不同
- 关键信息（金额、日期、编号）提取后要单独校验格式
- 常见错误：把整页大图直接丢给 API，不区分区域，导致模型注意力分散、识别率下降
