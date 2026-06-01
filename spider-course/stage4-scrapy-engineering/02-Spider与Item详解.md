# 第2课：Spider 与 Item 详解

> **课程定位：** 第四阶段 · Scrapy 框架与工程化 · 第 2 课时
> **前置知识：** Scrapy 基本架构、第一个 Spider 的编写与运行、Scrapy Shell 基本操作
> **预计时长：** 60 分钟

---

完成本课学习后，你将能够：

1. 掌握 Spider 类的核心属性：`name`、`allowed_domains`、`start_urls`、`parse()`
2. 区分三种 Spider 类型的适用场景
3. 熟练使用 Request 和 Response 对象进行页面跳转和数据提取
4. 理解 yield 的 Generator 机制（从 JS 开发者视角）
5. 使用 Item 和 ItemLoader 规范化数据结构
6. 编写一个完整的多页面爬虫项目

---

## 一、Spider 类核心属性

### 1.1 Spider 的四大属性

每个 Spider 类都必须定义以下四个核心成员：

```python
import scrapy

class BookSpider(scrapy.Spider):
    name = "books"                                    # ① 爬虫名称（唯一标识）
    allowed_domains = ["books.toscrape.com"]          # ② 允许的域名列表
    start_urls = ["http://books.toscrape.com/"]       # ③ 起始 URL 列表

    def parse(self, response):                        # ④ 默认回调方法
        pass
```

逐个理解：

```
┌───────────────┬─────────────────────────────────────────────────┐
│  name         │  爬虫的"身份证"，全局唯一                        │
│               │  运行命令：scrapy crawl {name}                   │
│               │  命名建议：小写 + 下划线，如 "book_spider"        │
├───────────────┼─────────────────────────────────────────────────┤
│ allowed_      │  安全围栏，防止爬虫跑到别的网站去                 │
│ domains       │  如果请求的 URL 不在此列表中，请求会被过滤        │
│               │  不要加 http:// 前缀                              │
├───────────────┼─────────────────────────────────────────────────┤
│ start_urls    │  爬虫的"出发点"                                  │
│               │  Scrapy 自动为列表中每个 URL 创建 GET 请求        │
│               │  响应会自动传给 parse() 方法                     │
├───────────────┼─────────────────────────────────────────────────┤
│ parse()       │  默认的回调函数                                  │
│               │  接收 Response 对象，负责解析页面                 │
│               │  可以 yield Item（数据）或 Request（新请求）      │
└───────────────┴─────────────────────────────────────────────────┘
```

### 1.2 allowed_domains 的坑

```python
# ❌ 常见错误：加了 http:// 前缀 → 过滤掉所有请求
allowed_domains = ["http://books.toscrape.com"]
# ❌ 常见错误：加了路径 → 域名不该包含路径
allowed_domains = ["books.toscrape.com/catalogue"]
# ✅ 正确：只写纯域名
allowed_domains = ["books.toscrape.com"]
```

> 🤝 **前端类比：** `allowed_domains` 就像 CORS 策略——只允许访问白名单内的域名，防止你的爬虫"越界"。

---

## 二、三种 Spider 类型

### 2.1 类型对比

```
┌──────────────────┬────────────────────┬──────────────────────────┐
│  scrapy.Spider   │ 通用爬虫            │ 最基础，自己处理一切      │
│                  │ 简单列表页+详情页    │ 灵活度最高               │
├──────────────────┼────────────────────┼──────────────────────────┤
│  CrawlSpider     │ 自动跟进链接        │ 用 Rule 定义爬取规则      │
│                  │ 站点级全站爬取       │ 自动提取链接、自动翻页    │
├──────────────────┼────────────────────┼──────────────────────────┤
│  XMLFeedSpider   │ XML/CSV/RSS 源     │ 专门处理结构化 Feed 数据  │
│                  │ 订阅源爬取          │ 内置迭代器解析            │
└──────────────────┴────────────────────┴──────────────────────────┘
```

### 2.2 scrapy.Spider —— 最常用

```python
import scrapy

class BookSpider(scrapy.Spider):
    name = "books"
    start_urls = ["http://books.toscrape.com/"]

    def parse(self, response):
        for book in response.css("article.product_pod"):
            yield {
                "title": book.css("h3 a::attr(title)").get(),
                "price": book.css("p.price_color::text").get(),
            }
        # 手动处理翻页
        next_page = response.css("li.next a::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)
```

### 2.3 CrawlSpider —— 自动化链接跟踪

```python
from scrapy.spiders import CrawlSpider, Rule
from scrapy.linkextractors import LinkExtractor

class BookCrawlSpider(CrawlSpider):
    name = "books_crawl"
    start_urls = ["http://books.toscrape.com/"]
    rules = (
        Rule(LinkExtractor(restrict_css="div.side_categories")),     # 跟进分类
        Rule(LinkExtractor(restrict_css="article.product_pod h3"),
             callback="parse_book"),                                  # 处理书本
    )
    def parse_book(self, response):
        yield {"title": response.css("h1::text").get(),
               "price": response.css("p.price_color::text").get()}
```

> 💡 **选择建议：** 初学者先掌握 `scrapy.Spider`，绝大多数场景用它就够了。

---

## 三、Request 与 Response 对象

### 3.1 创建 Request

Scrapy 会自动为 `start_urls` 创建 Request，你也可以手动创建来跟进链接：

```python
def parse(self, response):
    for book in response.css("article.product_pod"):
        detail_url = book.css("h3 a::attr(href)").get()

        # ✅ 方法一：response.follow（推荐，自动处理相对路径）
        yield response.follow(detail_url, callback=self.parse_detail)

        # ✅ 方法二：scrapy.Request（需要完整 URL）
        full_url = response.urljoin(detail_url)
        yield scrapy.Request(url=full_url, callback=self.parse_detail)
```

### 3.2 Request 的常用参数

```python
yield scrapy.Request(
    url="http://books.toscrape.com/catalogue/page-2.html",
    callback=self.parse,          # 回调函数
    method="GET",                 # HTTP 方法，默认 GET
    headers={"User-Agent": "..."}, # 自定义请求头
    meta={"page": 2},             # 传递额外数据（非常常用！）
    errback=self.handle_error,    # 错误回调（像 .catch）
)
```

### 3.3 meta 的妙用

`meta` 是在不同回调函数之间传递数据的"快递单"：

```python
def parse(self, response):
    for book in response.css("article.product_pod"):
        yield response.follow(
            book.css("h3 a::attr(href)").get(),
            callback=self.parse_detail,
            meta={"title": book.css("h3 a::attr(title)").get()},  # 带到详情页
        )

def parse_detail(self, response):
    title = response.meta["title"]  # ✅ 从 meta 中取出
    yield {"title": title, "price": response.css("p.price_color::text").get()}
```

> 🤝 **前端类比：** `meta` 就像 React 通过 props 向子组件传递数据，或者 Vue 中 `router.push({ query: { id: 1 } })` 的参数。

### 3.4 Response 对象

```python
# ─── 基本属性 ───
response.url           # 当前页面 URL
response.status        # HTTP 状态码（如 200）
response.text          # 响应体文本（HTML）

# ─── 选择器方法 ───
response.css("div.quote")                    # CSS 选择器
response.xpath("//div[@class='quote']")       # XPath 选择器
response.css("a::attr(href)").get()           # 提取属性值
response.css("p::text").getall()              # 提取所有匹配文本

# ─── 链接提取 ───
response.follow(url, callback=self.parse)     # 跟进链接（推荐）
response.urljoin(relative_url)                # 相对路径转绝对路径
```

---

## 四、yield 的 Generator 机制

### 4.1 从 JavaScript 视角理解 yield

```javascript
// JavaScript 的 Generator（你可能用过）
function* gen() { yield 1; yield 2; yield 3; }
gen().next(); // { value: 1, done: false }
```

```python
# Python 的 yield（原理完全一样）
def gen(): yield 1; yield 2; yield 3
next(gen())  # 1
```

### 4.2 在 Scrapy 中的作用

Scrapy 引擎会收集所有 `yield` 出来的对象，并自动分发：

```
┌───────────────────────────────────────────────────────────┐
│  parse() 函数中 yield 的对象去向：                        │
│                                                           │
│    yield { "title": "书1" } ──→ Pipeline 处理数据         │
│    yield Request(url=...)  ──→ Scheduler 加入请求队列     │
│                                                           │
│  引擎自动判断：Item → Pipeline，Request → Scheduler       │
└───────────────────────────────────────────────────────────┘
```

### 4.3 yield vs return 的对比

```python
# ❌ 使用 return：只能返回一次，无法同时 yield Request
def parse(self, response):
    results = []
    for quote in response.css("div.quote"):
        results.append({"text": quote.css("span.text::text").get()})
    return results  # 一次性返回，无法兼顾翻页

# ✅ 使用 yield：逐条返回，Item 和 Request 可以混合
def parse(self, response):
    for quote in response.css("div.quote"):
        yield {"text": quote.css("span.text::text").get()}     # → Pipeline
    next_page = response.css("li.next a::attr(href)").get()
    if next_page:
        yield response.follow(next_page, callback=self.parse)  # → Scheduler
```

> 🔑 **核心要点：** 一个回调函数可以同时 `yield` Item（数据）和 Request（请求），引擎自动分发到正确组件。

---

## 五、Item 类：规范化数据结构

### 5.1 为什么需要 Item

```python
# ❌ 直接 yield 字典的问题
def parse(self, response):
    yield {
        "title": response.css("h1::text").get(),
        "priec": response.css("p.price_color::text").get(),  # 拼写错误！
    }
```

Item 就像 TypeScript 的接口——给数据定义一个"类型契约"：

```typescript
// TypeScript 开发者很熟悉这种模式
interface Book {
    title: string;
    price: string;
    author?: string;
}
```

### 5.2 定义与使用 Item

```python
# items.py
import scrapy

class BookItem(scrapy.Item):
    """书本数据结构（类似 TypeScript 接口）"""
    title = scrapy.Field()          # 书名
    price = scrapy.Field()          # 价格
    author = scrapy.Field()         # 作者
    rating = scrapy.Field()         # 评分
```

```python
# spiders/books.py
from myspider.items import BookItem

def parse_detail(self, response):
    item = BookItem()
    item["title"] = response.css("h1::text").get()
    item["price"] = response.css("p.price_color::text").get()
    yield item
```

Item 支持像字典一样操作：`item["title"]` 赋值和取值，`dict(item)` 转为普通字典。但访问未定义的字段会抛出 `KeyError`。

> 🤝 **前端类比：** Item = TypeScript Interface + Class。它既定义了数据结构（像 interface），又提供了实例方法（像 class）。

---

## 六、ItemLoader：智能数据提取

### 6.1 手动清洁 vs ItemLoader

手动提取时你需要自己去空格、去货币符号、转换类型，代码又臭又长。ItemLoader 把这些清洁工作变成声明式的：

```python
from scrapy.loader import ItemLoader
from myspider.items import BookItem

def parse_detail(self, response):
    loader = ItemLoader(item=BookItem(), response=response)
    loader.add_css("title", "h1::text")
    loader.add_css("price", "p.price_color::text", re=r"[0-9.]+")
    loader.add_css("description", "#product_description ~ p::text")
    return loader.load_item()
```

### 6.3 常用处理器（Processor）

```python
from scrapy.loader.processors import TakeFirst, MapCompose, Join

# TakeFirst()：取第一个值。["Python", "第二行"] → "Python"
# MapCompose()：依次执行多个函数。" £51.77 " → strip → replace → "51.77"
# Join()：列表连接。["tag1", "tag2"] → "tag1, tag2"
```

### 6.4 自定义 ItemLoader

```python
from scrapy.loader import ItemLoader
from scrapy.loader.processors import TakeFirst, MapCompose

class BookItemLoader(ItemLoader):
    default_output_processor = TakeFirst()
    title_in = MapCompose(str.strip)
    price_in = MapCompose(str.strip, lambda x: float(x.replace("£", "")))
```

---

## 七、Callback 回调函数模式

### 7.1 多层回调的页面跳转

实际爬虫中，经常需要"列表页 → 详情页"的多层跳转：

```
┌──────────────────────────────────────────────────────────────┐
│  parse()         →  parse_category()     →  parse_detail()   │
│    │                  │                       │              │
│    │ ① 请求分类页      │ ② 请求书本详情         │ ③ 提取数据   │
│    ├──→ GET /categories ├──→ GET /book/1        │              │
│    │                  │ ④ 翻页→ GET /page-2 ──→ parse_category│
└──────────────────────────────────────────────────────────────┘
```

```python
class BookSpider(scrapy.Spider):
    name = "books"
    start_urls = ["http://books.toscrape.com/"]

    def parse(self, response):
        for cat in response.css("div.side_categories ul.nav ul li a"):
            yield response.follow(cat, callback=self.parse_category)

    def parse_category(self, response):
        category = response.css("h1::text").get("")
        for book in response.css("article.product_pod h3 a"):
            yield response.follow(book, callback=self.parse_detail,
                                  meta={"category": category})
        next_page = response.css("li.next a::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse_category)

    def parse_detail(self, response):
        yield {
            "title": response.css("h1::text").get(),
            "price": response.css("p.price_color::text").get(),
            "category": response.meta.get("category", "未知"),
        }
```

### 7.2 errback 错误回调

就像 Promise 的 `.catch()`，可以用 `errback` 参数指定错误处理函数：`scrapy.Request(url=..., callback=self.parse_detail, errback=self.handle_error)`。错误时 Scrapy 会传入一个 `failure` 对象。

---

## 八、综合实战：books.toscrape.com 完整爬虫

把前面学到的所有知识整合到一个完整的项目中。

### 8.1 项目结构

```
bookspider/
├── scrapy.cfg
└── bookspider/
    ├── items.py          ← 数据结构定义
    ├── pipelines.py      ← 数据保存逻辑
    ├── settings.py       ← 项目配置
    └── spiders/
        └── books.py      ← 爬虫代码
```

### 8.2 items.py

```python
import scrapy

class BookItem(scrapy.Item):
    title = scrapy.Field()        # 书名
    price = scrapy.Field()        # 价格
    price_num = scrapy.Field()    # 价格（纯数字）
    rating = scrapy.Field()       # 评分（1-5）
    description = scrapy.Field()  # 描述
    upc = scrapy.Field()          # 商品编码
    category = scrapy.Field()     # 所属分类
    url = scrapy.Field()          # 详情页 URL
```

### 8.3 spiders/books.py

```python
import re
import scrapy
from bookspider.items import BookItem

class BooksSpider(scrapy.Spider):
    name = "books"
    allowed_domains = ["books.toscrape.com"]
    start_urls = ["http://books.toscrape.com/"]
    RATING_MAP = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}

    def parse(self, response):
        for cat_link in response.css("div.side_categories ul.nav ul li a"):
            yield response.follow(
                cat_link, callback=self.parse_category,
                meta={"category": cat_link.css("::text").get("").strip()},
            )

    def parse_category(self, response):
        category = response.meta.get("category", "未知")
        for book in response.css("article.product_pod"):
            yield response.follow(
                book.css("h3 a::attr(href)").get(),
                callback=self.parse_detail,
                meta={"category": category},
            )
        next_page = response.css("li.next a::attr(href)").get()
        if next_page:
            yield response.follow(
                next_page, callback=self.parse_category,
                meta={"category": category},
            )

    def parse_detail(self, response):
        item = BookItem()
        item["title"] = response.css("h1::text").get()
        item["url"] = response.url
        item["category"] = response.meta.get("category", "未知")
        price_text = response.css("p.price_color::text").get("£0")
        item["price"] = price_text
        item["price_num"] = self._num(price_text)
        rc = response.css("p.star-rating::attr(class)").get("")
        item["rating"] = self.RATING_MAP.get(rc.split()[-1].lower(), 0) if rc else 0
        t = response.css("table.table-striped tr")
        item["upc"] = self._cell(t, 0)
        item["availability"] = self._cell(t, 5)
        item["description"] = response.css("#product_description ~ p::text").get("暂无")
        yield item

    def _num(self, text):
        m = re.search(r"[\d.]+", text)
        return float(m.group()) if m else 0.0

    def _cell(self, rows, idx):
        try: return rows[idx].css("td::text").get()
        except (IndexError, TypeError): return None
```

### 8.4 pipelines.py 与 settings.py

```python
# pipelines.py
class BookspiderPipeline:
    def open_spider(self, spider):
        self.items = []

    def process_item(self, item, spider):
        item["title"] = item.get("title", "").strip()
        item["expensive"] = (item.get("price_num") or 0) > 100
        self.items.append(dict(item))
        return item

    def close_spider(self, spider):
        spider.logger.info(f"共爬取 {len(self.items)} 本书")
```

```python
# settings.py（关键配置）
BOT_NAME = "bookspider"
ROBOTSTXT_OBEY = False
CONCURRENT_REQUESTS = 4
DOWNLOAD_DELAY = 1
ITEM_PIPELINES = {"bookspider.pipelines.BookspiderPipeline": 300}
LOG_LEVEL = "INFO"
```

### 8.5 运行项目

```bash
scrapy crawl books                  # 运行爬虫
scrapy crawl books -o books.json    # 输出到 JSON
scrapy crawl books -o books.csv     # 输出到 CSV
```

---

## 九、动手练习

### 练习 1：创建 BookItem 并运行爬虫

**步骤：**

1. 使用 `scrapy startproject bookspider` 创建项目
2. 在 `items.py` 中定义 `BookItem` 类
3. 在 `spiders/` 下创建 `books.py`，实现 `BooksSpider`
4. 运行爬虫，将结果保存到 `books.json`
5. 验证 JSON 文件中包含完整的书本数据

**预期结果：** 得到一个包含 1000 本书数据的 JSON 文件。

### 练习 2：使用 meta 传递分类信息

**步骤：**

1. 修改 Spider，在 `parse()` 中提取所有分类名称和链接
2. 通过 `meta` 把分类名称传递给 `parse_detail` 回调
3. 在 `parse_detail` 中把分类信息存入 Item
4. 运行爬虫，验证每本书都带有正确的分类信息

### 练习 3：使用 ItemLoader 优化数据提取

**步骤：**

1. 在 `items.py` 中为 `BookItem` 创建自定义 `BookItemLoader`
2. 配置处理器：`title_in = MapCompose(str.strip)`，`price_in = MapCompose(str.strip, extract_number)`
3. 在 Spider 中用 ItemLoader 替代手动赋值
4. 对比使用前后的代码量差异

---

## 十、小结

本课我们深入学习了 Scrapy 的核心组件：

- **Spider 四大属性：** `name`（标识）、`allowed_domains`（域名白名单）、`start_urls`（起始 URL）、`parse()`（回调函数）
- **三种 Spider 类型：** `scrapy.Spider`（通用）、`CrawlSpider`（自动链接跟踪）、`XMLFeedSpider`（结构化数据源）
- **Request 对象：** 用 `response.follow()` 或 `scrapy.Request()` 创建请求，`callback` 指定回调，`meta` 传递上下文数据
- **Response 对象：** 提供 `.css()`、`.xpath()` 选择器方法，以及 `.url`、`.status`、`.text` 等属性
- **yield 机制：** 与 JavaScript Generator 原理相同，可以同时 yield Item 和 Request，引擎自动分发处理
- **Item 类：** 像 TypeScript 接口一样定义数据结构，防止字段拼写错误，支持字典操作
- **ItemLoader：** 提供声明式的数据提取方式，通过 Processor 链式处理数据清洗
- **回调模式：** `parse → parse_category → parse_detail` 多层回调实现列表页到详情页的跳转

> 🔑 **核心记忆：** Scrapy 的开发模式是"定义结构（Item）→ 编写爬虫（Spider）→ 处理数据（Pipeline）"。先想清楚你要什么数据，再决定怎么爬。

---

## 下一课预告

下一课我们将学习 **Scrapy 中间件与请求定制**——包括下载中间件、爬虫中间件的原理和用法，如何随机切换 User-Agent、使用代理 IP、处理 Cookie 和登录态，以及如何应对反爬机制。这是让你的爬虫从"能用"到"好用"的关键一步！
