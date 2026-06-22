"""LangGraph 工作流定义。

定义搜索 → 分析 → 写作 → 审核的多 Agent 流程。
"""
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END

from agents.searcher import SearchAgent
from agents.analyzer import AnalyzerAgent
from agents.writer import WriterAgent
from agents.reviewer import ReviewerAgent


class ResearchState(TypedDict):
    topic: str
    mock: bool
    search_results: list[dict]
    insights: list[str]
    report: str
    review: dict


def build_graph(mock: bool = False):
    searcher = SearchAgent(mock=mock)
    analyzer = AnalyzerAgent(mock=mock)
    writer = WriterAgent(mock=mock)
    reviewer = ReviewerAgent(mock=mock)

    def search_node(state: ResearchState) -> dict:
        results = searcher.run(state["topic"])
        return {"search_results": results}

    def analyze_node(state: ResearchState) -> dict:
        insights = analyzer.run(state["search_results"])
        return {"insights": insights}

    def write_node(state: ResearchState) -> dict:
        report = writer.run(state["topic"], state["insights"])
        return {"report": report}

    def review_node(state: ResearchState) -> dict:
        review = reviewer.run(state["report"])
        return {"review": review}

    def should_continue(state: ResearchState) -> str:
        if state.get("review", {}).get("approved", False):
            return "end"
        return "rewrite"

    g = StateGraph(ResearchState)
    g.add_node("search", search_node)
    g.add_node("analyze", analyze_node)
    g.add_node("write", write_node)
    g.add_node("review", review_node)

    g.set_entry_point("search")
    g.add_edge("search", "analyze")
    g.add_edge("analyze", "write")
    g.add_edge("write", "review")
    g.add_conditional_edges("review", should_continue, {"end": END, "rewrite": "write"})

    return g.compile()
