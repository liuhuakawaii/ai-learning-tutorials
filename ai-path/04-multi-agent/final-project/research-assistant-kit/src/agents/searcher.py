"""搜索 Agent：负责收集与主题相关的信息。"""
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


class SearchAgent:
    def __init__(self, mock: bool = False):
        self.mock = mock

    def run(self, topic: str) -> list[dict]:
        if self.mock:
            return self._mock_search(topic)
        return self._live_search(topic)

    def _mock_search(self, topic: str) -> list[dict]:
        sample_path = Path(__file__).resolve().parent.parent.parent / "data" / "sample_results.json"
        if sample_path.exists():
            return json.loads(sample_path.read_text(encoding="utf-8"))
        return [{"title": f"关于 {topic} 的搜索结果", "snippet": "Mock 搜索内容", "url": "https://example.com"}]

    def _live_search(self, topic: str) -> list[dict]:
        raise NotImplementedError("Live 搜索需要接入搜索 API")
