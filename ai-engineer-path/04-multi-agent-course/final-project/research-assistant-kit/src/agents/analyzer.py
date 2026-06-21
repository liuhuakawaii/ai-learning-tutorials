"""分析 Agent：负责从搜索结果中提取关键洞察。"""


class AnalyzerAgent:
    def __init__(self, mock: bool = False):
        self.mock = mock

    def run(self, search_results: list[dict]) -> list[str]:
        if self.mock:
            return self._mock_analyze(search_results)
        return self._live_analyze(search_results)

    def _mock_analyze(self, results: list[dict]) -> list[str]:
        insights = []
        for r in results:
            insights.append(f"洞察: {r.get('title', 'N/A')} — {r.get('snippet', '')[:50]}")
        return insights

    def _live_analyze(self, results: list[dict]) -> list[str]:
        raise NotImplementedError("Live 分析需要接入 LLM API")
