# 03 OCR 与文档图片——从图片中提取文字和表格

> OCR 让 AI 能从图片中提取文字和表格数据。

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

## 小结

```
本课核心要点：

1. 用 Vision API 实现 OCR
2. 支持文字和表格提取
3. 支持文档结构化解析
4. 批量处理和质量优化

下一课：图表理解——让 AI 解读柱状图、折线图、流程图。
```

---

## 练习

1. **OCR 题**：从图片中提取文字。

2. **表格题**：从图片中提取表格数据。

3. **文档题**：解析一个文档图片。
