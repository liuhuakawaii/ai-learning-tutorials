"""多模态 RAG：图文混合检索与生成。"""


class MultimodalRAG:
    def __init__(self, mock: bool = False):
        self.mock = mock
        self.index: list[dict] = []

    def add_text(self, text: str, metadata: dict = None):
        self.index.append({"type": "text", "content": text, "metadata": metadata or {}})

    def add_image(self, image_path: str, description: str = "", metadata: dict = None):
        self.index.append({
            "type": "image",
            "path": image_path,
            "description": description,
            "metadata": metadata or {},
        })

    def search(self, query: str, top_k: int = 3) -> list[dict]:
        if self.mock:
            return self.index[:top_k]
        raise NotImplementedError("需要接入 CLIP / ColPali 向量检索")

    def query(self, question: str) -> str:
        results = self.search(question)
        if self.mock:
            contexts = [r.get("content", r.get("description", "")) for r in results]
            return f"[Mock RAG 回答] 基于 {len(results)} 条检索结果回答：{' | '.join(contexts)}"
        raise NotImplementedError("需要接入多模态 LLM")
