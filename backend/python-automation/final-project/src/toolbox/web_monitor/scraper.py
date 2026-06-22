"""网页抓取器 - 使用 requests + BeautifulSoup 抓取网页内容"""

import hashlib
from typing import Any

import requests
from bs4 import BeautifulSoup


def scrape_page(
    url: str,
    selector: str | None = None,
    timeout: int = 10,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """抓取指定 URL 的页面内容。

    Args:
        url: 目标网址
        selector: CSS 选择器，为 None 则提取全文
        timeout: 请求超时时间（秒）
        requests: 自定义请求头

    Returns:
        {"url": 原始URL, "title": 页面标题, "items": 提取内容列表, "hash": 内容哈希}
    """
    default_headers = {"User-Agent": "Toolbox/1.0"}
    if headers:
        default_headers.update(headers)

    resp = requests.get(url, timeout=timeout, headers=default_headers)
    resp.raise_for_status()
    resp.encoding = resp.apparent_encoding

    soup = BeautifulSoup(resp.text, "html.parser")
    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    items: list[str] = []
    if selector:
        elements = soup.select(selector)
        items = [el.get_text(strip=True) for el in elements]
    else:
        items = [soup.get_text(strip=True)[:5000]]

    content_hash = hashlib.md5(resp.text.encode()).hexdigest()

    return {
        "url": url,
        "title": title,
        "items": items,
        "hash": content_hash,
        "status_code": resp.status_code,
    }
