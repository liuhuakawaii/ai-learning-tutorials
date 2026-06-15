import time
import logging
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

PROVIDER_PRICING = {
    "openai": {
        "gpt-4o": {"input": 2.5, "output": 10.0},
        "gpt-4o-mini": {"input": 0.15, "output": 0.6},
        "gpt-4-turbo": {"input": 10.0, "output": 30.0},
        "gpt-3.5-turbo": {"input": 0.5, "output": 1.5},
    },
    "anthropic": {
        "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},
        "claude-3-5-haiku-20241022": {"input": 0.8, "output": 4.0},
    },
}


class LLMService:
    def __init__(self):
        self.providers: dict[str, AsyncOpenAI] = {}

        if settings.OPENAI_API_KEY:
            self.providers["openai"] = AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_BASE_URL,
            )

        if settings.ANTHROPIC_API_KEY:
            self.providers["anthropic"] = AsyncOpenAI(
                api_key=settings.ANTHROPIC_API_KEY,
                base_url=settings.ANTHROPIC_BASE_URL,
            )

        self.default_provider = settings.DEFAULT_LLM_PROVIDER
        self.default_model = settings.DEFAULT_MODEL

    def _resolve_provider_and_model(self, model: str | None = None) -> tuple[str, str, AsyncOpenAI | None]:
        if model and "/" in model:
            provider, model_name = model.split("/", 1)
            client = self.providers.get(provider)
            return provider, model_name, client

        provider = self.default_provider
        model_name = model or self.default_model
        client = self.providers.get(provider)
        return provider, model_name, client

    async def chat(
        self,
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> dict:
        provider, model_name, client = self._resolve_provider_and_model(model)

        if not client:
            return self._mock_response(messages[-1]["content"], provider, model_name)

        start = time.perf_counter()
        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as e:
            logger.error("LLM call failed: provider=%s model=%s error=%s", provider, model_name, e)
            return self._mock_response(messages[-1]["content"], provider, model_name, error=str(e))

        latency = int((time.perf_counter() - start) * 1000)
        usage = response.usage

        return {
            "content": response.choices[0].message.content,
            "model": response.model,
            "provider": provider,
            "input_tokens": usage.prompt_tokens if usage else 0,
            "output_tokens": usage.completion_tokens if usage else 0,
            "cost": self._calculate_cost(provider, model_name, usage.prompt_tokens if usage else 0, usage.completion_tokens if usage else 0),
            "latency_ms": latency,
        }

    async def stream_chat(self, messages: list[dict], model: str | None = None, temperature: float = 0.7, max_tokens: int = 4096):
        provider, model_name, client = self._resolve_provider_and_model(model)

        if not client:
            yield f"[Mock] 收到消息：{messages[-1]['content']}"
            return

        try:
            stream = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                stream=True,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error("LLM stream failed: provider=%s model=%s error=%s", provider, model_name, e)
            yield f"[Error] LLM 调用失败: {e}"

    def _mock_response(self, message: str, provider: str = "mock", model: str = "mock", error: str | None = None) -> dict:
        if error:
            content = f"[Error] LLM 调用失败（{provider}/{model}）: {error}"
        else:
            content = f"收到你的消息：「{message}」。这是模拟回复，配置 API_KEY 和 BASE_URL 后可使用真实 LLM。"
        return {
            "content": content,
            "model": model,
            "provider": provider,
            "input_tokens": 0,
            "output_tokens": 0,
            "cost": 0.0,
            "latency_ms": 0,
        }

    def _calculate_cost(self, provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
        pricing = PROVIDER_PRICING.get(provider, {}).get(model)
        if not pricing:
            return 0.0
        return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000

    def get_available_models(self) -> list[dict]:
        models = []
        for provider, client in self.providers.items():
            for model_name, pricing in PROVIDER_PRICING.get(provider, {}).items():
                models.append({
                    "provider": provider,
                    "model": model_name,
                    "id": f"{provider}/{model_name}",
                    "pricing": pricing,
                })
        return models
