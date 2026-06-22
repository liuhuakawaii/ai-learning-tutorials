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
