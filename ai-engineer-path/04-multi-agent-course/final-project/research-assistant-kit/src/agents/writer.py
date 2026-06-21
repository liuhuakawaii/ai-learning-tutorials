"""写作 Agent：负责将分析结果组织成研究报告。"""


class WriterAgent:
    def __init__(self, mock: bool = False):
        self.mock = mock

    def run(self, topic: str, insights: list[str]) -> str:
        if self.mock:
            return self._mock_write(topic, insights)
        return self._live_write(topic, insights)

    def _mock_write(self, topic: str, insights: list[str]) -> str:
        lines = [f"# {topic} 研究报告\n"]
        lines.append("## 核心洞察\n")
        for i, insight in enumerate(insights, 1):
            lines.append(f"{i}. {insight}")
        lines.append("\n## 结论\n")
        lines.append(f"共收集 {len(insights)} 条洞察。")
        return "\n".join(lines)

    def _live_write(self, topic: str, insights: list[str]) -> str:
        raise NotImplementedError("Live 写作需要接入 LLM API")
