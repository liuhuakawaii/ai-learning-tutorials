import logging
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)

RAG_SYSTEM_PROMPT = """你是一个基于知识库的问答助手。请根据提供的参考资料回答用户的问题。

规则：
1. 只基于提供的参考资料回答，不要编造信息
2. 如果参考资料中没有相关信息，明确说明
3. 回答时引用来源，格式：[来源: 文档名]
4. 保持回答简洁准确"""


class RAGPipeline:
    def __init__(self, llm_service: LLMService):
        self.llm = llm_service

    async def query(
        self,
        question: str,
        context: list[dict] | None = None,
        model: str | None = None,
    ) -> dict:
        if not context:
            context = []

        context_text = self._build_context(context)

        messages = [
            {"role": "system", "content": RAG_SYSTEM_PROMPT},
            {"role": "user", "content": f"参考资料：\n{context_text}\n\n问题：{question}"},
        ]

        response = await self.llm.chat(messages=messages, model=model)

        return {
            "answer": response.get("content", ""),
            "sources": [c.get("filename", "unknown") for c in context],
            "confidence": 0.8 if context else 0.2,
            "model": response.get("model"),
            "input_tokens": response.get("input_tokens", 0),
            "output_tokens": response.get("output_tokens", 0),
            "cost": response.get("cost", 0),
        }

    def _build_context(self, context: list[dict]) -> str:
        if not context:
            return "（无参考资料）"

        parts = []
        for i, c in enumerate(context, 1):
            filename = c.get("filename", "unknown")
            content = c.get("content", "")
            score = c.get("score", 0)
            parts.append(f"[{i}] 来源: {filename} (相关度: {score:.2f})\n{content}")

        return "\n\n".join(parts)


class DocumentChunker:
    def __init__(self, chunk_size: int = 500, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk_text(self, text: str, metadata: dict | None = None) -> list[dict]:
        metadata = metadata or {}
        chunks = []

        paragraphs = text.split("\n\n")
        current_chunk = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(current_chunk) + len(para) > self.chunk_size and current_chunk:
                chunks.append({
                    "content": current_chunk.strip(),
                    "metadata": {**metadata, "chunk_index": len(chunks)},
                })
                words = current_chunk.split()
                overlap_words = words[-self.overlap:] if len(words) > self.overlap else words
                current_chunk = " ".join(overlap_words) + "\n\n" + para
            else:
                current_chunk += ("\n\n" if current_chunk else "") + para

        if current_chunk.strip():
            chunks.append({
                "content": current_chunk.strip(),
                "metadata": {**metadata, "chunk_index": len(chunks)},
            })

        return chunks
