"""文本处理器。"""


class TextRouter:
    def __init__(self, mock: bool = False):
        self.mock = mock

    def generate(self, prompt: str) -> str:
        if self.mock:
            return f"[Mock 回答] 关于「{prompt[:30]}」的分析结果：这是一个多模态输入的处理示例。"
        raise NotImplementedError("需要接入 LLM API")
