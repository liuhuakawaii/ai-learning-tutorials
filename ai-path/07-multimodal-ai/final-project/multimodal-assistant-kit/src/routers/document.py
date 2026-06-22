"""文档处理器。"""
from pathlib import Path


class DocumentRouter:
    def __init__(self, mock: bool = False):
        self.mock = mock

    def parse(self, document_path: str) -> str:
        if self.mock:
            return f"[Mock 文档解析] 从 {Path(document_path).name} 提取了文本内容和表格数据。"
        raise NotImplementedError("需要接入 Unstructured / Docling")

    def extract_tables(self, document_path: str) -> list[dict]:
        if self.mock:
            return [{"headers": ["列1", "列2"], "rows": [["值1", "值2"]]}]
        raise NotImplementedError("需要接入表格提取 API")
