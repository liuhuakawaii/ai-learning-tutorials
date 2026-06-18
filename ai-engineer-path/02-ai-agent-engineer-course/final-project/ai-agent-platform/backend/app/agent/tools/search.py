from app.agent.engine import ToolDefinition


class SearchTool:
    @staticmethod
    def get_definition() -> ToolDefinition:
        return ToolDefinition(
            name="search",
            description="搜索互联网获取信息",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词",
                    },
                },
                "required": ["query"],
            },
            handler="search",
        )

    @staticmethod
    async def execute(query: str) -> str:
        return f"搜索结果（模拟）：关于「{query}」的相关信息。实际使用时请接入 Tavily/Serper 等搜索 API。"
