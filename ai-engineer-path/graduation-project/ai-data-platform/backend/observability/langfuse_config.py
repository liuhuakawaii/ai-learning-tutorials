"""Langfuse 可观测性配置。

学员需要根据 03-llm-eval-course 的知识完成实现。

用法:
    from backend.observability.langfuse_config import get_langfuse_handler
    # 然后在 LangChain 调用中传入 callbacks=[handler]
"""
import os

LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY", "")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY", "")
LANGFUSE_HOST = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")


def is_langfuse_configured() -> bool:
    return bool(LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY)


def get_langfuse_handler():
    """获取 Langfuse 回调处理器。未配置时返回 None。"""
    if not is_langfuse_configured():
        return None
    try:
        from langfuse.callback import CallbackHandler
        return CallbackHandler(
            public_key=LANGFUSE_PUBLIC_KEY,
            secret_key=LANGFUSE_SECRET_KEY,
            host=LANGFUSE_HOST,
        )
    except ImportError:
        return None


if __name__ == "__main__":
    if is_langfuse_configured():
        print("Langfuse 已配置")
        print(f"  Host: {LANGFUSE_HOST}")
    else:
        print("Langfuse 未配置")
        print("请设置环境变量: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY")
        print("或参考 03-llm-eval-course 第四阶段课程")
