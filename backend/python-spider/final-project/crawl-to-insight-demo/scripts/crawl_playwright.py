"""
Playwright 动态采集脚本。

用 Playwright 加载本地 HTML fixtures 并提取书籍数据，
演示动态渲染页面的采集方式（与静态 requests 解析对比）。

用法:
    python scripts/crawl_playwright.py
"""
import json
import asyncio
from pathlib import Path
from datetime import datetime

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("请先安装 Playwright: pip install playwright && playwright install chromium")
    exit(1)


FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


async def crawl_page(page, file_path: Path) -> list[dict]:
    """从单个 HTML 文件中提取书籍数据。"""
    url = f"file://{file_path.resolve()}"
    await page.goto(url)

    books = []
    articles = await page.query_selector_all("article.book")

    for article in articles:
        book_id = await article.get_attribute("data-id")
        title = await (await article.query_selector("h2")).inner_text()
        price_text = await (await article.query_selector(".price")).inner_text()
        rating_text = await (await article.query_selector(".rating")).inner_text()
        detail_el = await article.query_selector(".detail")
        detail_path = await detail_el.get_attribute("href") if detail_el else ""

        books.append({
            "id": book_id,
            "title": title.strip(),
            "price": int(price_text.replace("¥", "").strip()),
            "rating": float(rating_text.strip()),
            "detailPath": detail_path,
            "sourceFile": file_path.name,
            "crawledAt": datetime.now().isoformat(),
        })

    return books


async def crawl_pagination(page, start_file: Path) -> list[dict]:
    """演示翻页采集：从起始页开始，跟随"下一页"链接。"""
    all_books = []
    current_file = start_file

    while current_file and current_file.exists():
        print(f"  采集: {current_file.name}")
        books = await crawl_page(page, current_file)
        all_books.extend(books)

        # 查找"下一页"链接
        url = f"file://{current_file.resolve()}"
        await page.goto(url)
        next_link = await page.query_selector("a.next")
        if next_link:
            href = await next_link.get_attribute("href")
            current_file = current_file.parent / href
        else:
            current_file = None

    return all_books


async def main():
    print("Playwright 动态采集演示")
    print("=" * 40)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # 方式 1：逐文件采集
        print("\n方式 1：逐文件采集")
        all_books = []
        for html_file in sorted(FIXTURES_DIR.glob("*.html")):
            books = await crawl_page(page, html_file)
            all_books.extend(books)
            print(f"  {html_file.name}: 提取 {len(books)} 本书")

        # 方式 2：翻页采集
        print("\n方式 2：翻页采集")
        start_file = FIXTURES_DIR / "page-1.html"
        paginated_books = await crawl_pagination(page, start_file)
        print(f"  翻页采集共 {len(paginated_books)} 本书")

        await browser.close()

    # 去重
    seen = set()
    unique_books = []
    for book in all_books:
        if book["id"] not in seen:
            seen.add(book["id"])
            unique_books.append(book)

    # 导出
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_DIR / "books-playwright.json", "w", encoding="utf-8") as f:
        json.dump(unique_books, f, ensure_ascii=False, indent=2)

    print(f"\n共采集 {len(unique_books)} 本唯一书籍")
    print(f"输出: {OUTPUT_DIR / 'books-playwright.json'}")


if __name__ == "__main__":
    asyncio.run(main())
