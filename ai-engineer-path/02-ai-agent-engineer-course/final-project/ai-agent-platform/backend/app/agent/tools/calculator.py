from app.agent.engine import ToolDefinition


class CalculatorTool:
    @staticmethod
    def get_definition() -> ToolDefinition:
        return ToolDefinition(
            name="calculator",
            description="执行数学计算",
            parameters={
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "数学表达式，如 2+3*4",
                    },
                },
                "required": ["expression"],
            },
            handler="calculator",
        )

    @staticmethod
    async def execute(expression: str) -> str:
        try:
            allowed_chars = set("0123456789+-*/.() ")
            if not all(c in allowed_chars for c in expression):
                return "Error: 表达式包含不允许的字符"
            result = eval(expression, {"__builtins__": {}})
            return f"计算结果：{expression} = {result}"
        except Exception as e:
            return f"计算错误：{e}"
