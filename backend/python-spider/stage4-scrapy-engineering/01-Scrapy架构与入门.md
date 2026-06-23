# Scrapy 架构与入门

## 手工爬虫的痛点

你之前用 requests + BeautifulSoup 写了几个爬虫脚本，跑得还行。但当需求变成"把 50 个商品页的数据全部抓下来"，你发现自己要手动管并发、写重试、处理异常、存数据，每个脚本都在重复同样的脏活。代码越写越长，bug 越来越多。

有没有一个框架，把这些通用的东西都封装好，让你只专注于"爬什么、怎么解析"？

## Scrapy 是什么

Scrapy 是 Python 生态中最流行的爬虫框架。它把发请求、管调度、处理异常、存数据全部封装好，你只需要写爬取逻辑。

用 requests + BeautifulSoup 写爬虫，像手工作坊——自己去仓库拿原料、自己加工、自己质检。用 Scrapy，像全自动流水线——每个环节有专门的机器负责。

| 对比项 | requests + BS4 | Scrapy |
|--------|---------------|--------|
| 请求管理 | 手动写重试逻辑 | 自动调度，内置重试 |
| 并发控制 | 自己用 asyncio/threading | 内置异步 |
| 数据管道 | 手动写保存逻辑 | Pipeline 组件化 |
| 调试工具 | print | Scrapy Shell |
| 适用场景 | 简单脚本 | 中大型项目 |

## 六大核心组件

```
Spider（爬虫）→ Engine（引擎）→ Scheduler（调度器）→ Downloader（下载器）
                                    ↓
                              Spider 解析数据
                                    ↓
                              Pipeline（管道）→ 保存数据
```

- **Spider**：你写代码最多的地方。定义要爬什么 URL、怎么解析、提取什么数据
- **Engine**：中枢，协调所有组件
- **Scheduler**：接收请求、排好队、去重
- **Downloader**：发送 HTTP 请求获取响应
- **Pipeline**：处理提取出来的数据——清洗、验证、存储
- **Middleware**：在请求发出前和响应返回后插入自定义逻辑

## 创建项目

```bash
pip install scrapy
scrapy startproject myspider
cd myspider
```

项目结构：

```
myspider/
├── scrapy.cfg
└── myspider/
    ├── items.py          # 数据结构
    ├── middlewares.py     # 中间件
    ├── pipelines.py      # 数据管道
    ├── settings.py       # 配置
    └── spiders/          # 爬虫文件
```

## 第一个 Spider

```python
# myspider/spiders/quotes_spider.py
import scrapy

class QuotesSpider(scrapy.Spider):
    name = "quotes"
    allowed_domains = ["quotes.toscrape.com"]
    start_urls = ["http://quotes.toscrape.com/"]

    def parse(self, response):
        for quote in response.css("div.quote"):
            yield {
                "text": quote.css("span.text::text").get(),
                "author": quote.css("small.author::text").get(),
                "tags": quote.css("div.tags a.tag::text").getall(),
            }
```

运行：

```bash
scrapy crawl quotes
scrapy crawl quotes -o quotes.json
```

`yield` 逐条返回数据，Scrapy 引擎自动收集并交给 Pipeline。

## Scrapy Shell：调试利器

Scrapy Shell 是爬虫版的浏览器 Console——交互式测试选择器，不用每次运行整个爬虫：

```bash
scrapy shell "http://quotes.toscrape.com/"
```

```python
>>> response.css("title::text").get()
'Quotes to Scrape'

>>> response.css("span.text::text").get()
'"The world as we have created it..."'

>>> response.css("li.next a::attr(href)").get()
'/page/2/'
```

先在 Shell 里把选择器调通，再搬到 Spider 文件里。这比反复运行爬虫调试效率高 10 倍。

## 翻页

```python
def parse(self, response):
    for quote in response.css("div.quote"):
        yield {
            "text": quote.css("span.text::text").get(),
            "author": quote.css("small.author::text").get(),
        }

    next_page = response.css("li.next a::attr(href)").get()
    if next_page:
        yield response.follow(next_page, callback=self.parse)
```

`response.follow()` 自动处理相对路径，`callback=self.parse` 实现循环。

## settings.py 关键配置

```python
ROBOTSTXT_OBEY = True              # 遵守 robots.txt
CONCURRENT_REQUESTS = 16           # 并发请求数
DOWNLOAD_DELAY = 1                 # 下载延迟（秒）
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml",
    "User-Agent": "MyLearningSpider/1.0 (contact@example.com)",
}
ITEM_PIPELINES = {
    "myspider.pipelines.MyspiderPipeline": 300,
}
```

默认的 `CONCURRENT_REQUESTS=16` 和 `DOWNLOAD_DELAY=0` 对真实网站太激进，必须调低。

## 踩坑提醒

**一上来就学 CrawlSpider**：Rule 配置出错很难调试。先掌握 `scrapy.Spider`。

**在 Spider 里写保存逻辑**：Spider 只管解析，存储交给 Pipeline。

**忽略 settings.py**：不改配置直接跑等于对目标站点发起 DDoS。

## 练习

### 练习一：创建第一个 Scrapy 项目

创建项目，编写 Spider 爬取 quotes.toscrape.com，保存为 JSON。

### 练习二：使用 Scrapy Shell

启动 Shell，测试 CSS 选择器提取标题、名言、作者、下一页链接。

### 练习三：支持翻页

在 parse 中找到下一页链接，用 `response.follow()` 循环，确认爬取 100 条名言。

---

## 参考答案

### 练习一

```python
import scrapy

class QuotesSpider(scrapy.Spider):
    name = "quotes"
    start_urls = ["http://quotes.toscrape.com/"]

    def parse(self, response):
        for quote in response.css("div.quote"):
            yield {
                "text": quote.css("span.text::text").get(),
                "author": quote.css("small.author::text").get(),
                "tags": quote.css("div.tags a.tag::text").getall(),
            }
```

```bash
scrapy crawl quotes -o quotes.json
```

### 练习三

```python
def parse(self, response):
    for quote in response.css("div.quote"):
        yield {
            "text": quote.css("span.text::text").get(),
            "author": quote.css("small.author::text").get(),
        }
    next_page = response.css("li.next a::attr(href)").get()
    if next_page:
        yield response.follow(next_page, callback=self.parse)
```

```bash
scrapy crawl quotes -o all_quotes.json
# 预期：100 条名言
```
