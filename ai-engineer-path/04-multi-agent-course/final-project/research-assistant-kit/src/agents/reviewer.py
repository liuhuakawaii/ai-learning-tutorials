"""审核 Agent：负责审查报告质量。"""


class ReviewerAgent:
    def __init__(self, mock: bool = False):
        self.mock = mock

    def run(self, report: str) -> dict:
        if self.mock:
            return self._mock_review(report)
        return self._live_review(report)

    def _mock_review(self, report: str) -> dict:
        word_count = len(report)
        return {
            "approved": word_count > 50,
            "score": min(10, word_count // 20),
            "feedback": "报告内容基本完整" if word_count > 50 else "报告内容过短，需要补充",
        }

    def _live_review(self, report: str) -> dict:
        raise NotImplementedError("Live 审核需要接入 LLM API")
