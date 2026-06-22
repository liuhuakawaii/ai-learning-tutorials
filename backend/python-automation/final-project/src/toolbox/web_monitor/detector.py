"""变更检测器 - 监控网页内容是否发生变化"""

import hashlib
import time
from pathlib import Path

import requests

# 存储上次抓取的哈希值
_HASH_STORE: dict[str, str] = {}


def detect_changes(
    url: str,
    selector: str | None = None,
    interval: int = 300,
    config: dict | None = None,
) -> bool:
    """检测目标 URL 内容是否与上次不同。

    首次调用会记录当前内容哈希并返回 False；
    后续调用与缓存哈希对比，不同则返回 True。

    Args:
        url: 目标网址
        selector: CSS 选择器
        interval: 保留参数，供外部定时调用参考
        config: web_monitor 配置

    Returns:
        True 表示内容发生变化
    """
    timeout = (config or {}).get("timeout", 10)
    user_agent = (config or {}).get("user_agent", "Toolbox/1.0")

    resp = requests.get(url, timeout=timeout, headers={"User-Agent": user_agent})
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding

    # 对比内容
    content = resp.text
    if selector:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content, "html.parser")
        elements = soup.select(selector)
        content = "".join(el.get_text() for el in elements)

    current_hash = hashlib.md5(content.encode()).hexdigest()
    previous_hash = _HASH_STORE.get(url)

    _HASH_STORE[url] = current_hash

    if previous_hash is None:
        return False  # 首次记录，不算变更

    return current_hash != previous_hash


def get_stored_hash(url: str) -> str | None:
    """获取已缓存的 URL 内容哈希"""
    return _HASH_STORE.get(url)


def clear_store() -> None:
    """清空哈希缓存"""
    _HASH_STORE.clear()
