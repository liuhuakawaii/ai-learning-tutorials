"""图片处理器。"""
from pathlib import Path


class VisionRouter:
    def __init__(self, mock: bool = False):
        self.mock = mock

    def analyze(self, image_path: str) -> str:
        if self.mock:
            return f"[Mock 图片分析] 检测到图片: {Path(image_path).name}，内容为示例场景。"
        raise NotImplementedError("需要接入 Vision API (GPT-4o / Claude Vision)")

    def ocr(self, image_path: str) -> str:
        if self.mock:
            return "[Mock OCR] 示例提取文字"
        raise NotImplementedError("需要接入 OCR API")
