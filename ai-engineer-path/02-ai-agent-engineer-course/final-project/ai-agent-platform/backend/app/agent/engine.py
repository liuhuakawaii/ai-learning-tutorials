import json
import logging
from dataclasses import dataclass, field
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict
    handler: str = ""


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class ToolResult:
    call_id: str
    name: str
    content: str
    success: bool = True


@dataclass
class AgentState:
    messages: list[dict] = field(default_factory=list)
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[ToolResult] = field(default_factory=list)
    iterations: int = 0
    max_iterations: int = 10
    status: str = "idle"


class AgentEngine:
    def __init__(self, llm_service: LLMService):
        self.llm = llm_service
        self.tools: dict[str, ToolDefinition] = {}

    def register_tool(self, tool: ToolDefinition):
        self.tools[tool.name] = tool

    def _build_tool_schemas(self) -> list[dict]:
        schemas = []
        for tool in self.tools.values():
            schemas.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters,
                },
            })
        return schemas

    async def run(
        self,
        system_prompt: str,
        user_message: str,
        model: str | None = None,
        tools: list[ToolDefinition] | None = None,
    ) -> dict:
        if tools:
            for t in tools:
                self.register_tool(t)

        state = AgentState()
        state.messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        tool_schemas = self._build_tool_schemas() if self.tools else None

        while state.iterations < state.max_iterations:
            state.iterations += 1

            response = await self.llm.chat(
                messages=state.messages,
                model=model,
            )

            content = response.get("content", "")
            state.messages.append({"role": "assistant", "content": content})

            if not tool_schemas or state.iterations >= state.max_iterations:
                return {
                    "content": content,
                    "iterations": state.iterations,
                    "tool_calls": [
                        {"name": tc.name, "arguments": tc.arguments}
                        for tc in state.tool_calls
                    ],
                    "model": response.get("model"),
                    "input_tokens": response.get("input_tokens", 0),
                    "output_tokens": response.get("output_tokens", 0),
                    "cost": response.get("cost", 0),
                }

            break

        return {
            "content": state.messages[-1].get("content", ""),
            "iterations": state.iterations,
            "tool_calls": [],
            "model": "unknown",
            "input_tokens": 0,
            "output_tokens": 0,
            "cost": 0,
        }

    async def _execute_tool(self, call: ToolCall) -> ToolResult:
        tool = self.tools.get(call.name)
        if not tool:
            return ToolResult(
                call_id=call.id,
                name=call.name,
                content=f"Error: tool '{call.name}' not found",
                success=False,
            )

        try:
            return ToolResult(
                call_id=call.id,
                name=call.name,
                content=f"Tool '{call.name}' executed (handler: {tool.handler})",
                success=True,
            )
        except Exception as e:
            logger.error("Tool execution failed: %s error=%s", call.name, e)
            return ToolResult(
                call_id=call.id,
                name=call.name,
                content=f"Error: {e}",
                success=False,
            )
