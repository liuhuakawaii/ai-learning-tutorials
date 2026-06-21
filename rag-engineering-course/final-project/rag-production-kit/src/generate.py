"""生成模块

基于检索结果生成答案，支持流式输出。

使用方法:
    python src/generate.py --query "什么是 RAG?" --stream
"""

import argparse
import logging
from typing import Generator, Optional

logger = logging.getLogger(__name__)


class RAGGenerator:
    """RAG 生成器"""

    SYSTEM_PROMPT = """你是一个有帮助的 AI 助手。基于以下检索到的上下文来回答用户的问题。

规则:
1. 只基于提供的上下文回答，不要编造信息
2. 如果上下文中没有相关信息，明确说明
3. 引用来源时标注出处
4. 回答要简洁准确

上下文:
{context}"""

    def __init__(self, model: str = "gpt-4o-mini", temperature: float = 0.1):
        self.model = model
        self.temperature = temperature

    def _build_context(self, search_results: list) -> str:
        """构建上下文字符串"""
        context_parts = []
        for i, result in enumerate(search_results, 1):
            source = result.metadata.get("source", "未知来源")
            context_parts.append(f"[{i}] (来源: {source})\n{result.content}")
        return "\n\n---\n\n".join(context_parts)

    def generate(
        self,
        query: str,
        search_results: list,
        stream: bool = False,
    ) -> str | Generator[str, None, None]:
        """生成答案"""
        from openai import OpenAI

        client = OpenAI()
        context = self._build_context(search_results)
        system_message = self.SYSTEM_PROMPT.format(context=context)

        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": query},
        ]

        if stream:
            return self._stream_generate(client, messages)
        else:
            return self._generate_sync(client, messages)

    def _generate_sync(self, client, messages: list) -> str:
        """同步生成"""
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
        )
        return response.choices[0].message.content

    def _stream_generate(self, client, messages: list) -> Generator[str, None, None]:
        """流式生成"""
        stream = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
            stream=True,
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


def format_answer(answer: str, sources: list) -> str:
    """格式化答案，包含来源引用"""
    formatted = f"{answer}\n\n---\n\n**来源:**\n"
    for i, source in enumerate(sources, 1):
        source_name = source.metadata.get("source", "未知来源")
        formatted += f"[{i}] {source_name}\n"
    return formatted


def main():
    parser = argparse.ArgumentParser(description="生成工具")
    parser.add_argument("--query", required=True, help="查询内容")
    parser.add_argument("--stream", action="store_true", help="流式输出")
    parser.add_argument("--model", default="gpt-4o-mini", help="模型名称")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    # Placeholder: in production, use actual retrieval results
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    from retrieve import SearchResult
    mock_results = [
        SearchResult(
            content="RAG (Retrieval-Augmented Generation) 是一种结合检索和生成的 AI 技术。",
            score=0.95,
            metadata={"source": "rag_intro.md"},
        ),
    ]

    generator = RAGGenerator(model=args.model)

    if args.stream:
        print(f"\n查询: {args.query}\n")
        print("答案: ", end="", flush=True)
        for token in generator.generate(args.query, mock_results, stream=True):
            print(token, end="", flush=True)
        print()
    else:
        answer = generator.generate(args.query, mock_results)
        print(f"\n查询: {args.query}")
        print(f"\n答案:\n{format_answer(answer, mock_results)}")


if __name__ == "__main__":
    main()
