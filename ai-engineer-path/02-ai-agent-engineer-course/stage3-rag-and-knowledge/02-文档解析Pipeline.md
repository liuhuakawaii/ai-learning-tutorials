# 02 文档解析 Pipeline

> 垃圾进，垃圾出——文档解析质量直接决定 RAG 的上限。

## 学习目标

- 实现多格式文档解析（PDF、Word、Markdown、网页）
- 理解不同格式的解析难点和最佳实践
- 设计可扩展的文档处理 Pipeline

## 前置要求

- 已完成阶段 3 第 1 课
- Python 文件处理基础

## 文档解析的挑战

企业文档格式五花八门：

| 格式 | 挑战 | 解决方案 |
|------|------|----------|
| PDF | 表格、图片、多栏布局 | PyMuPDF + Unstructured |
| Word | 格式复杂、嵌套表格 | python-docx |
| Markdown | 格式最友好 | 直接解析 |
| 网页 | 噪声多（导航、广告） | BeautifulSoup + 正文提取 |
| 扫描件 | 纯图片 | OCR（Tesseract） |

## 统一文档接口

```python
# backend/app/services/document/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class DocumentChunk:
    """文档切片"""
    content: str              # 文本内容
    metadata: dict            # 元数据（来源、页码、章节等）
    chunk_index: int          # 切片序号

@dataclass
class ParsedDocument:
    """解析后的文档"""
    title: str
    content: str              # 完整文本
    chunks: list[DocumentChunk]
    metadata: dict            # 文档级元数据
    page_count: int

class BaseDocumentParser(ABC):
    """文档解析器基类"""
    
    @abstractmethod
    async def parse(self, file_path: str) -> ParsedDocument:
        """解析文档"""
        ...
    
    @abstractmethod
    def supported_extensions(self) -> list[str]:
        """支持的文件扩展名"""
        ...
```

## PDF 解析

```python
# backend/app/services/document/pdf_parser.py
import fitz  # PyMuPDF

class PDFParser(BaseDocumentParser):
    def supported_extensions(self) -> list[str]:
        return [".pdf"]
    
    async def parse(self, file_path: str) -> ParsedDocument:
        doc = fitz.open(file_path)
        
        full_text = ""
        pages = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            full_text += text + "\n\n"
            pages.append({
                "page": page_num + 1,
                "content": text,
            })
        
        return ParsedDocument(
            title=self._extract_title(doc),
            content=full_text,
            chunks=[],  # 切分在下一步做
            metadata={
                "source": file_path,
                "format": "pdf",
                "pages": pages,
            },
            page_count=len(doc),
        )
    
    def _extract_title(self, doc) -> str:
        """从 PDF 提取标题"""
        if doc.metadata and doc.metadata.get("title"):
            return doc.metadata["title"]
        # 尝试从第一页提取
        first_page = doc[0]
        text = first_page.get_text("text").strip()
        first_line = text.split("\n")[0].strip()
        return first_line[:100] if first_line else "Untitled"
```

## Word 解析

```python
# backend/app/services/document/word_parser.py
from docx import Document

class WordParser(BaseDocumentParser):
    def supported_extensions(self) -> list[str]:
        return [".docx", ".doc"]
    
    async def parse(self, file_path: str) -> ParsedDocument:
        doc = Document(file_path)
        
        content_parts = []
        for para in doc.paragraphs:
            if para.text.strip():
                content_parts.append(para.text)
        
        # 处理表格
        for table in doc.tables:
            table_text = self._table_to_text(table)
            content_parts.append(table_text)
        
        full_text = "\n\n".join(content_parts)
        
        return ParsedDocument(
            title=doc.core_properties.title or "Untitled",
            content=full_text,
            chunks=[],
            metadata={
                "source": file_path,
                "format": "docx",
                "author": doc.core_properties.author,
            },
            page_count=0,
        )
    
    def _table_to_text(self, table) -> str:
        """将表格转为文本"""
        rows = []
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            rows.append(" | ".join(cells))
        return "\n".join(rows)
```

## 网页解析

```python
# backend/app/services/document/web_parser.py
from bs4 import BeautifulSoup
import httpx
from readability import Document as ReadabilityDocument

class WebParser(BaseDocumentParser):
    def supported_extensions(self) -> list[str]:
        return []  # URL 没有扩展名
    
    async def parse(self, url: str) -> ParsedDocument:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
        
        # 用 readability 提取正文（去除导航、广告等噪声）
        readable = ReadabilityDocument(response.text)
        title = readable.title()
        html_content = readable.summary()
        
        # 转为纯文本
        soup = BeautifulSoup(html_content, "html.parser")
        text = soup.get_text(separator="\n", strip=True)
        
        return ParsedDocument(
            title=title,
            content=text,
            chunks=[],
            metadata={
                "source": url,
                "format": "web",
            },
            page_count=1,
        )
```

## Markdown 解析

```python
# backend/app/services/document/markdown_parser.py
import re

class MarkdownParser(BaseDocumentParser):
    def supported_extensions(self) -> list[str]:
        return [".md", ".markdown"]
    
    async def parse(self, file_path: str) -> ParsedDocument:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        title = self._extract_title(content)
        
        return ParsedDocument(
            title=title,
            content=content,
            chunks=[],
            metadata={
                "source": file_path,
                "format": "markdown",
            },
            page_count=1,
        )
    
    def _extract_title(self, content: str) -> str:
        """提取 Markdown 标题"""
        match = re.match(r"^#\s+(.+)$", content, re.MULTILINE)
        return match.group(1).strip() if match else "Untitled"
```

## 文档解析器工厂

```python
# backend/app/services/document/parser_factory.py
class DocumentParserFactory:
    """文档解析器工厂"""
    
    def __init__(self):
        self.parsers: list[BaseDocumentParser] = [
            PDFParser(),
            WordParser(),
            MarkdownParser(),
            WebParser(),
        ]
    
    def get_parser(self, file_path: str) -> BaseDocumentParser:
        """根据文件扩展名获取解析器"""
        ext = Path(file_path).suffix.lower()
        
        for parser in self.parsers:
            if ext in parser.supported_extensions():
                return parser
        
        raise ValueError(f"Unsupported file format: {ext}")
    
    async def parse(self, file_path: str) -> ParsedDocument:
        parser = self.get_parser(file_path)
        return await parser.parse(file_path)
```

## 练习

### 练习 1：多格式解析

实现以下格式的解析器：

1. PDF（用 PyMuPDF）
2. Word（用 python-docx）
3. Markdown
4. 网页（用 readability + BeautifulSoup）

### 练习 2：解析质量测试

收集不同格式的测试文档，验证解析质量：

1. 包含表格的 PDF
2. 包含图片的 Word
3. 多层级标题的 Markdown
4. 有导航栏和广告的网页

### 练习 3：批量解析

实现批量文档上传和解析：

1. 支持多文件上传
2. 异步解析（不阻塞前端）
3. 解析状态追踪

## 本节要点

- 文档解析是 RAG 的第一步，质量直接决定后续所有环节
- 不同格式需要不同的解析策略，PDF 是最难的
- 网页解析需要去除噪声（导航、广告、页脚）
- 统一接口让后续切分和向量化不需要关心文档格式

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| PDF 解析乱码 | 编码问题或扫描件 | 检测编码，扫描件用 OCR |
| Word 表格丢失 | 只解析了段落 | 额外处理表格 |
| 网页内容噪声大 | 没用 readability | 先用 readability 提取正文 |
| 中文乱码 | 文件编码不是 UTF-8 | 用 chardet 检测编码 |
