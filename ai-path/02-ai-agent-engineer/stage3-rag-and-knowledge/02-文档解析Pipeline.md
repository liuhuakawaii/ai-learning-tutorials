# 02 文档解析 Pipeline

> 垃圾进，垃圾出——文档解析质量直接决定 RAG 的上限。

## 场景引入

公司有上千份内部文档，格式五花八门——PDF 扫描件、带复杂表格的 Word、多层级标题的 Markdown、还有各种网页链接。你上传了一份产品手册 PDF 到 RAG 系统，结果检索出来的内容全是乱码，表格数据完全丢失。文档解析的质量直接决定了后续所有环节的上限。

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

---

## 参考答案

### 练习 1

**思路**：基于课程中的 `BaseDocumentParser` 基类，分别实现四种格式的解析器。关键是处理每种格式的特殊难点：PDF 的多栏布局、Word 的表格、网页的噪声、Markdown 的层级结构。

**答案**：

```python
# backend/app/services/document/parsers.py
import fitz
from docx import Document
from bs4 import BeautifulSoup
from readability import Document as ReadabilityDocument
import re
from pathlib import Path
from .base import BaseDocumentParser, ParsedDocument


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
            pages.append({"page": page_num + 1, "content": text})
        title = doc.metadata.get("title") or "Untitled"
        return ParsedDocument(
            title=title, content=full_text, chunks=[],
            metadata={"source": file_path, "format": "pdf", "pages": pages},
            page_count=len(doc),
        )


class WordParser(BaseDocumentParser):
    def supported_extensions(self) -> list[str]:
        return [".docx", ".doc"]

    async def parse(self, file_path: str) -> ParsedDocument:
        doc = Document(file_path)
        content_parts = []
        for para in doc.paragraphs:
            if para.text.strip():
                content_parts.append(para.text)
        for table in doc.tables:
            rows = []
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                rows.append(" | ".join(cells))
            content_parts.append("\n".join(rows))
        return ParsedDocument(
            title=doc.core_properties.title or "Untitled",
            content="\n\n".join(content_parts), chunks=[],
            metadata={"source": file_path, "format": "docx"},
            page_count=0,
        )


class MarkdownParser(BaseDocumentParser):
    def supported_extensions(self) -> list[str]:
        return [".md", ".markdown"]

    async def parse(self, file_path: str) -> ParsedDocument:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        match = re.match(r"^#\s+(.+)$", content, re.MULTILINE)
        title = match.group(1).strip() if match else "Untitled"
        return ParsedDocument(
            title=title, content=content, chunks=[],
            metadata={"source": file_path, "format": "markdown"},
            page_count=1,
        )


class WebParser(BaseDocumentParser):
    def supported_extensions(self) -> list[str]:
        return []

    async def parse(self, url: str) -> ParsedDocument:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
        readable = ReadabilityDocument(response.text)
        soup = BeautifulSoup(readable.summary(), "html.parser")
        text = soup.get_text(separator="\n", strip=True)
        return ParsedDocument(
            title=readable.title(), content=text, chunks=[],
            metadata={"source": url, "format": "web"}, page_count=1,
        )
```

**要点**：
- PDF 解析用 PyMuPDF（fitz），它能处理大多数 PDF，但扫描件需要额外走 OCR
- Word 解析必须同时处理段落和表格，只解析段落会丢失表格数据
- 网页解析必须先用 readability 提取正文，再用 BeautifulSoup 去 HTML 标签
- 常见错误：直接用 `soup.get_text()` 解析网页，导航栏和广告全部混入正文

### 练习 2

**思路**：收集四类典型测试文档，验证各解析器的输出质量。重点检查：表格是否完整保留、图片是否处理、标题层级是否正确、噪声是否去除。

**答案**：

```python
import asyncio
from pathlib import Path

TEST_DOCS = {
    "pdf_with_table": "tests/docs/product_spec.pdf",
    "word_with_image": "tests/docs/company_intro.docx",
    "markdown_hierarchical": "tests/docs/api_reference.md",
    "web_with_nav": "https://example.com/product-page",
}

async def test_parse_quality():
    factory = DocumentParserFactory()
    results = {}

    for name, path in TEST_DOCS.items():
        doc = await factory.parse(path)
        results[name] = {
            "title": doc.title,
            "content_length": len(doc.content),
            "has_table_content": " | " in doc.content,
            "has_headings": bool(re.search(r"^#{1,3}\s", doc.content, re.MULTILINE)),
            "page_count": doc.page_count,
        }
        # 基本断言
        assert len(doc.content) > 100, f"{name}: 内容太短，解析可能失败"
        assert doc.title != "Untitled" or name == "web_with_nav", f"{name}: 标题提取失败"

    for name, info in results.items():
        print(f"[{name}] 长度={info['content_length']}, 页数={info['page_count']}")

asyncio.run(test_parse_quality())
```

**要点**：
- 包含表格的 PDF：检查表格数据是否以文本形式保留，而非乱码
- 包含图片的 Word：纯文本解析会丢失图片内容，需要 OCR 或跳过
- 多层级标题的 Markdown：验证标题提取正则能捕获各级标题
- 有导航栏的网页：readability 提取后应只保留正文，不含导航和广告
- 常见错误：只测一种格式就认为解析器"能用"，忽略了边界情况

### 练习 3

**思路**：实现一个异步批量解析服务，核心是用队列管理解析任务，前端通过轮询或 WebSocket 获取进度。

**答案**：

```python
# backend/app/services/document/batch_parser.py
import asyncio
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime

class ParseStatus(str, Enum):
    PENDING = "pending"
    PARSING = "parsing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class ParseTask:
    task_id: str
    file_path: str
    status: ParseStatus = ParseStatus.PENDING
    result: dict | None = None
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

class BatchParserService:
    def __init__(self, parser_factory):
        self.factory = parser_factory
        self.tasks: dict[str, ParseTask] = {}

    async def submit(self, file_paths: list[str]) -> list[str]:
        task_ids = []
        for path in file_paths:
            task_id = str(uuid.uuid4())
            self.tasks[task_id] = ParseTask(task_id=task_id, file_path=path)
            task_ids.append(task_id)
        asyncio.create_task(self._process_batch(task_ids))
        return task_ids

    async def _process_batch(self, task_ids: list[str]):
        for tid in task_ids:
            task = self.tasks[tid]
            task.status = ParseStatus.PARSING
            try:
                doc = await self.factory.parse(task.file_path)
                task.status = ParseStatus.COMPLETED
                task.result = {"title": doc.title, "content_length": len(doc.content)}
            except Exception as e:
                task.status = ParseStatus.FAILED
                task.error = str(e)

    def get_status(self, task_id: str) -> dict | None:
        task = self.tasks.get(task_id)
        if not task:
            return None
        return {
            "task_id": task.task_id,
            "status": task.status.value,
            "result": task.result,
            "error": task.error,
        }
```

**要点**：
- 用 `asyncio.create_task` 异步执行解析，不阻塞前端请求
- 每个任务有独立状态，前端可以轮询 `/parse/status/{task_id}` 获取进度
- 生产环境建议用 Redis 或数据库存储任务状态，而非内存 dict（重启会丢）
- 常见错误：同步解析大文件导致请求超时；没有错误处理导致单个文件失败阻塞整个批次

## 工程建议

- PDF 解析优先用 PyMuPDF，扫描件走 OCR 流水线（Tesseract + 语言检测），不要试图用同一个解析器处理所有 PDF
- 网页解析一定要先用 readability 提取正文，再去掉 HTML 标签，否则导航栏和广告会污染检索结果
- 解析过程要记录元数据（来源、页码、格式），这些元数据在后续检索过滤和引用溯源时至关重要
- 生产环境建议异步解析 + 状态追踪，大文件解析可能耗时数十秒，不能阻塞用户请求

## 本节要点

- 文档解析是 RAG 的第一步，质量直接决定后续所有环节
- 不同格式需要不同的解析策略，PDF 是最难的
- 网页解析需要去除噪声（导航、广告、页脚）
- 统一接口让后续切分和向量化不需要关心文档格式

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| PDF 解析乱码 | 编码问题或扫描件 | 检测编码，扫描件用 OCR |
| Word 表格丢失 | 只解析了段落 | 额外处理表格 |
| 网页内容噪声大 | 没用 readability | 先用 readability 提取正文 |
| 中文乱码 | 文件编码不是 UTF-8 | 用 chardet 检测编码 |
