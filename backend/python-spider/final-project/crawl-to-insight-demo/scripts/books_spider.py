"""
Scrapy Spider 示例。

演示如何将静态采集逻辑迁移到 Scrapy 框架。
运行前需要启动本地 HTTP 服务器来提供 fixtures：

    python -m http.server 8080 --directory fixtures

然后运行：

    scrapy runspider scripts/books_spider.py -o output/books-scrapy.json

"""
import scrapy


class BooksSpider(scrapy.Spider):
    """采集书籍列表的 Scrapy Spider。"""

    name = "books"
    start_urls = ["http://localhost:8080/page-1.html"]

    custom_settings = {
        "USER_AGENT": "Mozilla/5.0 (compatible; BooksCrawler/1.0)",
        "DOWNLOAD_DELAY": 0.5,
        "ROBOTSTXT_OBEY": True,
        "LOG_LEVEL": "INFO",
    }

    def parse(self, response):
        """解析书籍列表页。"""
        for article in response.css("article.book"):
            yield {
                "id": article.attrib.get("data-id", ""),
                "title": article.css("h2::text").get("").strip(),
                "price": self._parse_price(article.css(".price::text").get("")),
                "rating": float(article.css(".rating::text").get("0")),
                "detailPath": article.css(".detail::attr(href)").get(""),
                "sourceUrl": response.url,
            }

        # 翻页：跟随"下一页"链接
        next_link = response.css("a.next::attr(href)").get()
        if next_link:
            yield response.follow(next_link, self.parse)

    @staticmethod
    def _parse_price(text: str) -> int:
        """提取价格数字。"""
        try:
            return int(text.replace("¥", "").strip())
        except ValueError:
            return 0


# 如果直接运行此文件
if __name__ == "__main__":
    from scrapy.crawler import CrawlerProcess

    process = CrawlerProcess(settings={
        "USER_AGENT": "Mozilla/5.0 (compatible; BooksCrawler/1.0)",
        "DOWNLOAD_DELAY": 0.5,
        "ROBOTSTXT_OBEY": True,
        "LOG_LEVEL": "INFO",
        "FEEDS": {
            "../output/books-scrapy.json": {"format": "json"},
        },
    })
    process.crawl(BooksSpider)
    process.start()
