"""文档摄入模块

负责文档的解析、分块、向量化和存储。

使用方法:
    python src/ingest.py --input data/sample/ --strategy recursive --chunk-size 512
"""

import argparse
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class DocumentChunk:
    """文档分块"""

    def __init__(
        self,
        content: str,
        metadata: dict,
        chunk_id: Optional[str] = None,
    ):
        self.content = content
        self.metadata = metadata
        self.chunk_id = chunk_id or self._generate_id()

    def _generate_id(self) -> str:
        import hashlib
        return hashlib.md5(self.content.encode()).hexdigest()[:12]


class DocumentParser:
    """文档解析器"""

    SUPPORTED_EXTENSIONS = {".pdf", ".md", ".html", ".txt", ".docx"}

    def parse(self, file_path: Path) -> list[dict]:
        """解析文档，返回结构化内容"""
        ext = file_path.suffix.lower()
        if ext == ".pdf":
            return self._parse_pdf(file_path)
        elif ext == ".md":
            return self._parse_markdown(file_path)
        elif ext == ".html":
            return self._parse_html(file_path)
        elif ext == ".txt":
            return self._parse_text(file_path)
        elif ext == ".docx":
            return self._parse_docx(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _parse_pdf(self, file_path: Path) -> list[dict]:
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        pages = []
        for i, page in enumerate(reader.pages):
            pages.append({
                "content": page.extract_text(),
                "metadata": {"source": str(file_path), "page": i + 1},
            })
        return pages

    def _parse_markdown(self, file_path: Path) -> list[dict]:
        content = file_path.read_text(encoding="utf-8")
        return [{"content": content, "metadata": {"source": str(file_path)}}]

    def _parse_html(self, file_path: Path) -> list[dict]:
        from bs4 import BeautifulSoup
        html = file_path.read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text(separator="\n", strip=True)
        return [{"content": text, "metadata": {"source": str(file_path)}}]

    def _parse_text(self, file_path: Path) -> list[dict]:
        content = file_path.read_text(encoding="utf-8")
        return [{"content": content, "metadata": {"source": str(file_path)}}]

    def _parse_docx(self, file_path: Path) -> list[dict]:
        from docx import Document
        doc = Document(str(file_path))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        content = "\n\n".join(paragraphs)
        return [{"content": content, "metadata": {"source": str(file_path)}}]


class ChunkingStrategy:
    """分块策略基类"""

    def chunk(self, documents: list[dict]) -> list[DocumentChunk]:
        raise NotImplementedError


class RecursiveChunking(ChunkingStrategy):
    """递归分块策略"""

    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk(self, documents: list[dict]) -> list[DocumentChunk]:
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )
        chunks = []
        for doc in documents:
            texts = splitter.split_text(doc["content"])
            for i, text in enumerate(texts):
                chunk = DocumentChunk(
                    content=text,
                    metadata={**doc["metadata"], "chunk_index": i},
                )
                chunks.append(chunk)
        return chunks


class SemanticChunking(ChunkingStrategy):
    """语义分块策略"""

    def __init__(self, threshold: float = 0.5):
        self.threshold = threshold

    def chunk(self, documents: list[dict]) -> list[DocumentChunk]:
        # Placeholder for semantic chunking implementation
        # In production, use embedding similarity to split at topic boundaries
        raise NotImplementedError("语义分块需要实现嵌入相似度计算")


def ingest_directory(
    input_dir: Path,
    strategy: str = "recursive",
    chunk_size: int = 512,
    chunk_overlap: int = 50,
) -> list[DocumentChunk]:
    """摄入目录中的所有文档"""
    parser = DocumentParser()

    if strategy == "recursive":
        chunker = RecursiveChunking(chunk_size, chunk_overlap)
    elif strategy == "semantic":
        chunker = SemanticChunking()
    else:
        raise ValueError(f"未知的分块策略: {strategy}")

    all_chunks = []
    for file_path in input_dir.rglob("*"):
        if file_path.suffix.lower() in DocumentParser.SUPPORTED_EXTENSIONS:
            logger.info(f"解析文件: {file_path}")
            try:
                docs = parser.parse(file_path)
                chunks = chunker.chunk(docs)
                all_chunks.extend(chunks)
                logger.info(f"  -> 生成 {len(chunks)} 个分块")
            except Exception as e:
                logger.error(f"  -> 解析失败: {e}")

    logger.info(f"总计生成 {len(all_chunks)} 个分块")
    return all_chunks


def main():
    parser = argparse.ArgumentParser(description="文档摄入工具")
    parser.add_argument("--input", required=True, help="输入目录")
    parser.add_argument("--strategy", default="recursive", choices=["recursive", "semantic"])
    parser.add_argument("--chunk-size", type=int, default=512)
    parser.add_argument("--chunk-overlap", type=int, default=50)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    input_dir = Path(args.input)
    if not input_dir.exists():
        print(f"错误: 目录 {input_dir} 不存在")
        return

    chunks = ingest_directory(input_dir, args.strategy, args.chunk_size, args.chunk_overlap)
    print(f"\n摄入完成: {len(chunks)} 个分块")


if __name__ == "__main__":
    main()
