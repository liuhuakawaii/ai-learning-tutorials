# 第1课：Scrapy 架构与入门

> **课程定位：** 第四阶段 · Scrapy 框架与工程化 · 第 1 课时
> **前置知识：** Python 基础语法、HTTP 协议基础、requests 与 BeautifulSoup 基本用法
> **预计时长：** 60 分钟

---

## 场景引入

你之前用 requests + BeautifulSoup 写了几个爬虫脚本，跑得也还行。但当产品经理说"把这 50 个商品页的数据全部抓下来"，你发现自己要手动管并发、写重试、处理异常、存数据，每个脚本都在重复同样的脏活。代码越写越长，bug 越来越多，维护起来像在补一件千疮百孔的衣服。这时候你开始想：有没有一个框架，把这些通用的东西都封装好，让我只专注于"爬什么、怎么解析"？

---

完成本课学习后，你将能够：

1. 理解 Scrapy 是什么，以及它解决了哪些手工爬虫的痛点
2. 说出 Scrapy 六大核心组件的名称和各自职责
3. 使用 `scrapy startproject` 创建一个完整的项目结构
4. 编写并运行第一个 Spider
5. 使用 Scrapy Shell 进行交互式调试
6. 理解 settings.py 中常用配置项的作用

---

## 一、Scrapy 是什么

### 1.1 一句话介绍

Scrapy 是 Python 生态中最流行的**爬虫框架**。它帮你把爬虫开发中重复的脏活累活（发请求、管调度、处理异常、存数据）全部封装好了，你只需要专注于**写爬取逻辑**。

### 1.2 工厂流水线的类比

想象你开了一家"数据采集工厂"：

```
┌─────────────────────────────────────────────────────────────────┐
│                    你的数据采集工厂                              │
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│   │  原料仓库  │───→│  生产车间  │───→│  质检部门  │───→│  成品仓库  │ │
│   │ (URL队列) │    │ (下载页面) │    │(提取数据) │    │(保存数据) │ │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│        ▲               │               │               │       │
│        │               ▼               ▼               ▼       │
│        │          ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│        └──────────│  调度中心  │   │  中间件   │   │  管道处理  │   │
│                   │ (Scheduler)│   │(Middleware)│   │(Pipeline)│   │
│                   └──────────┘   └──────────┘   └──────────┘   │
│                                                                 │
│              ┌────────────────────────────────┐                 │
│              │        引擎 (Engine)            │                 │
│              │    统一指挥，协调所有部门         │                 │
│              └────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

用 requests + BeautifulSoup 写爬虫，就像**手工作坊**——你得自己去仓库拿原料、自己加工、自己质检、自己打包。效率低，容易出错，而且规模一扩大就忙不过来。

用 Scrapy，就像**全自动流水线**——每个环节都有专门的机器负责，你只需要告诉流水线"我要什么样的产品"。

### 1.3 Scrapy vs 手工爬虫对比

| 对比项 | requests + BS4 | Scrapy |
|--------|---------------|--------|
| 请求管理 | 手动管理，需自己写重试逻辑 | 自动调度，内置重试 |
| 并发控制 | 需自己用 asyncio/threading | 内置异步，开箱即用 |
| 数据管道 | 手动写保存逻辑 | Pipeline 组件化 |
| 中间件 | 自己封装 | 插件式中间件系统 |
| 调试工具 | print 大法 | Scrapy Shell |
| 项目结构 | 随意组织 | 标准化目录结构 |
| 适用场景 | 简单脚本、一次性任务 | 中大型爬虫项目 |

---

## 二、Scrapy 六大核心组件

### 2.1 组件总览

```
┌─────────────────────────────────────────────────────────────┐
│                        Scrapy 架构图                        │
│                                                             │
│  ┌─────────┐         ┌──────────────────┐                   │
│  │  Spider  │────────→│     Engine       │                   │
│  │ (爬虫)   │←────────│     (引擎)       │                   │
│  └─────────┘         └───────┬──────────┘                   │
│       │                      │                              │
│       │                      │ ① 调度请求                   │
│       │                      ▼                              │
│       │              ┌───────────────┐                      │
│       │              │   Scheduler   │                      │
│       │              │   (调度器)     │                      │
│       │              └───────┬───────┘                      │
│       │                      │ ② 返回下一个请求              │
│       │                      ▼                              │
│       │              ┌───────────────┐                      │
│       │              │  Downloader   │                      │
│       │              │  (下载器)      │                      │
│       │              └───────┬───────┘                      │
│       │                      │ ③ 返回 Response              │
│       │                      ▼                              │
│       │              ┌───────────────┐                      │
│       │  ④ 解析数据   │   Middleware  │                      │
│       ←──────────────│  (中间件)      │                      │
│       │              └───────────────┘                      │
│       │                                                     │
│       │ ⑤ yield Item                                       │
│       ▼                                                     │
│  ┌─────────┐                                                │
│  │Pipeline │──→ ⑥ 保存数据                                  │
│  │ (管道)   │                                                │
│  └─────────┘                                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 逐个击破

**引擎（Engine）—— 工厂厂长**

引擎是整个框架的中枢，负责控制数据流在所有组件之间的流动。你不需要直接操作引擎，它在幕后默默工作。

**调度器（Scheduler）—— 原料仓库管理员**

调度器接收引擎发来的请求，排好队，去重，然后按顺序交给下载器。就像仓库管理员整理订单、去重、排队发货。

```python
# 调度器做的事情（简化理解）
queue = []          # 请求队列
seen = set()        # 去重集合

def add_request(request):
    url = request.url
    if url not in seen:     # ✅ 去重：同一个 URL 不重复请求
        seen.add(url)
        queue.append(request)

def next_request():
    return queue.pop(0)     # 按顺序取出下一个请求
```

**下载器（Downloader）—— 快递员**

下载器负责发送 HTTP 请求并获取响应。它是真正和网络打交道的组件。

**爬虫（Spider）—— 产品经理 + 质检员**

Spider 是你写代码最多的组件。你在这里定义：
- 要爬哪些 URL
- 怎么解析页面
- 提取什么数据
- 是否要跟踪新的链接

**管道（Pipeline）—— 打包发货员**

Pipeline 负责处理 Spider 提取出来的数据——清洗、验证、存储到数据库或文件。

**中间件（Middleware）—— 安检通道**

中间件可以在请求发出前和响应返回后插入自定义逻辑，比如：
- 添加清晰的 User-Agent、配置授权代理
- 处理 Cookie
- 处理重定向
- 过滤异常响应

---

## 三、安装与创建项目

### 3.1 安装 Scrapy

```bash
# 使用 pip 安装
pip install scrapy

# 验证安装是否成功
scrapy version
# 输出类似：Scrapy 2.11.x
```

> 💡 **前端同学注意：** 安装 Scrapy 类似于 `npm install -g create-react-app`，它会同时安装所有依赖包。

### 3.2 创建项目

```bash
# 创建一个名为 myspider 的爬虫项目
scrapy startproject myspider

# 进入项目目录
cd myspider
```

### 3.3 项目目录结构

```
myspider/                    ← 项目根目录
├── scrapy.cfg               ← 部署配置文件（类似 package.json 的 scripts 部分）
└── myspider/                ← Python 包目录
    ├── __init__.py
    ├── items.py             ← 定义数据结构（类似 TypeScript 接口）
    ├── middlewares.py        ← 自定义中间件
    ├── pipelines.py         ← 数据处理管道
    ├── settings.py          ← 项目配置（类似 .env 或 config.js）
    └── spiders/             ← 爬虫文件存放目录
        └── __init__.py
```

每个文件的职责：

```
┌──────────────┬───────────────────────────────────────────┐
│    文件       │              职责                         │
├──────────────┼───────────────────────────────────────────┤
│ scrapy.cfg   │ 项目部署配置，一般不用改                    │
│ items.py     │ 定义你要爬取的数据结构                      │
│ middlewares  │ 编写请求/响应的中间处理逻辑                  │
│ pipelines.py │ 定义数据的清洗和存储逻辑                    │
│ settings.py  │ 配置并发数、延迟、下载器等全局参数           │
│ spiders/     │ 放你的爬虫文件，一个文件一个爬虫             │
└──────────────┴───────────────────────────────────────────┘
```

> 🤝 **类比前端项目：** 这个结构就像 React 项目的 `src/` 目录——`components/`、`services/`、`utils/`、`config/` 各司其职。

---

## 四、第一个 Spider

### 4.1 创建爬虫文件

在 `myspider/spiders/` 目录下创建 `quotes_spider.py`：

```python
import scrapy


class QuotesSpider(scrapy.Spider):
    """爬取 quotes.toscrape.com 的名言"""

    # 爬虫名称，运行时用 scrapy crawl quotes 来调用
    name = "quotes"

    # 允许爬取的域名（防止爬到其他网站去）
    allowed_domains = ["quotes.toscrape.com"]

    # 起始 URL 列表，Scrapy 会自动从这里开始爬
    start_urls = ["http://quotes.toscrape.com/"]

    def parse(self, response):
        """默认的回调方法，处理下载器返回的响应"""

        # 遍历每一个名言区块
        for quote in response.css("div.quote"):
            # 提取名言文本
            text = quote.css("span.text::text").get()
            # 提取作者
            author = quote.css("small.author::text").get()
            # 提取标签
            tags = quote.css("div.tags a.tag::text").getall()

            # ✅ 使用 yield 逐条返回数据（后面会详细讲为什么用 yield）
            yield {
                "text": text,
                "author": author,
                "tags": tags,
            }
```

### 4.2 运行爬虫

```bash
# 在项目根目录下运行
scrapy crawl quotes

# 想把结果保存到 JSON 文件？
scrapy crawl quotes -o quotes.json

# 保存为 CSV？
scrapy crawl quotes -o quotes.csv
```

运行后的日志长这样：

```
2026-06-01 10:00:00 [scrapy.utils.log] Scrapy 2.11.x started
2026-06-01 10:00:00 [scrapy.core.engine] Spider opened
2026-06-01 10:00:01 [scrapy.core.engine] Crawled (200) <GET http://quotes.toscrape.com/>
2026-06-01 10:00:01 [scrapy.core.scraper] Scraped from <200 http://quotes.toscrape.com/>
{'text': '"The world as we have created it...', 'author': 'Albert Einstein', 'tags': ['change', 'deep-thoughts']}
...
2026-06-01 10:00:02 [scrapy.core.engine] Closing spider (finished)
```

### 4.3 等等，yield 是什么？

如果你写过 JavaScript，你可能更熟悉 `return`。Python 的 `yield` 和 `return` 的区别：

```javascript
// ❌ JavaScript 的 return：一次性返回所有结果
function getQuotes() {
    const results = [];
    for (const quote of quotes) {
        results.push(quote);
    }
    return results;  // 一次性返回整个数组
}
```

```python
# ✅ Python 的 yield：逐个返回结果（生成器）
def get_quotes(self, response):
    for quote in response.css("div.quote"):
        yield {                          # 每提取一条就返回一条
            "text": quote.css("span.text::text").get(),
            "author": quote.css("small.author::text").get(),
        }
    # 不需要自己创建列表，yield 会自动逐个"吐出"数据
```

> 🎯 **关键区别：** `return` 像是一次性把快递全部打包发出；`yield` 像是每打包好一个就立刻发出。Scrapy 的引擎会监听这些 `yield` 出来的数据，逐条交给 Pipeline 处理。

---

## 五、Scrapy Shell：你的调试利器

### 5.1 为什么需要 Scrapy Shell

前端开发中，你在浏览器里按 F12 打开 DevTools，可以在 Console 里实时测试 CSS 选择器和 JavaScript 代码。

Scrapy Shell 就是爬虫版的浏览器 Console——你可以交互式地测试选择器，不用每次都运行整个爬虫。

### 5.2 启动 Scrapy Shell

```bash
# 启动 Shell 并自动请求一个 URL
scrapy shell "http://quotes.toscrape.com/"
```

启动后你会看到一个交互式 Python 环境：

```
[s] Available Scrapy objects:
[s]   scrapy scrapy module
[s]   crawler <scrapy.crawler.Crawler object>
[s]   item {}
[s]   request <GET http://quotes.toscrape.com/>
[s]   response <200 http://quotes.toscrape.com/>
[s]   spider <DefaultSpider 'default' at 0x...>
[s] Useful shortcuts:
[s]   fetch(url)      # 重新请求一个新 URL
[s]   view(response)  # 在浏览器中打开响应页面
```

### 5.3 在 Shell 中测试选择器

```python
# 查看页面标题
>>> response.css("title::text").get()
'Quotes to Scrape'

# 提取第一条名言
>>> response.css("span.text::text").get()
'"The world as we have created it is a process of our thinking..."

# 提取所有作者
>>> response.css("small.author::text").getall()
['Albert Einstein', 'J.K. Rowling', ...]

# 提取所有标签
>>> response.css("div.tags a.tag::text").getall()
['change', 'deep-thoughts', 'thinking', ...]

# 用 XPath 也可以
>>> response.xpath("//span[@class='text']/text()").getall()
```

### 5.4 用 fetch() 切换页面

```python
# 请求另一个页面
>>> fetch("http://quotes.toscrape.com/page/2/")

# 现在 response 变成新页面了
>>> response.css("span.text::text").get()
'"It is our choices, Harry, that show what we truly are...'
```

> 💡 **调试流程建议：** 先在 Scrapy Shell 里把选择器调通，确认能正确提取数据，再把代码搬到 Spider 文件里。这就像前端开发时先在 Console 里试 API 调用，确认没问题再写到代码里。

---

## 六、settings.py 配置详解

### 6.1 核心配置项

```python
# ============== 基础配置 ==============

# 项目名称（类似 package.json 的 name）
BOT_NAME = "myspider"

# 是否遵守 robots.txt 协议
# ✅ 默认开启：真实目标站点应先尊重 robots.txt 和服务条款
ROBOTSTXT_OBEY = True

# 并发请求数（同时派出几个"快递员"）
CONCURRENT_REQUESTS = 16        # 默认 16，真实站点应按承载能力调低

# 下载延迟（每个请求之间等多久，单位：秒）
DOWNLOAD_DELAY = 1              # 礼貌爬虫，每秒最多请求 1 次

# ============== 请求头配置 ==============

# 默认请求头（建议设置一个正常的 User-Agent）
DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "User-Agent": "MyLearningSpider/1.0 (contact@example.com)",
}

# ============== 管道配置 ==============

# 数字越小，优先级越高
ITEM_PIPELINES = {
    "myspider.pipelines.MyspiderPipeline": 300,
}
```

### 6.2 配置对照表

```
┌─────────────────────┬──────────────┬──────────────────────────┐
│      配置项          │    默认值     │          作用             │
├─────────────────────┼──────────────┼──────────────────────────┤
│ ROBOTSTXT_OBEY      │ True         │ 是否遵守 robots.txt      │
│ CONCURRENT_REQUESTS │ 16           │ 最大并发请求数            │
│ DOWNLOAD_DELAY      │ 0            │ 下载延迟（秒）            │
│ DOWNLOAD_TIMEOUT    │ 180          │ 下载超时时间（秒）         │
│ RETRY_ENABLED       │ True         │ 是否启用重试              │
│ RETRY_TIMES         │ 2            │ 重试次数                  │
│ LOG_LEVEL           │ DEBUG        │ 日志级别                  │
│ FEED_EXPORT_ENCODING│ utf-8        │ 导出文件编码              │
└─────────────────────┴──────────────┴──────────────────────────┘
```

---

## 七、实战对比：手工爬虫 vs Scrapy

让我们用同一个任务对比两种方式，感受 Scrapy 的优势。

**任务：** 爬取 `http://quotes.toscrape.com/` 的所有名言。

### 7.1 手工 requests + BS4 方式

```python
import requests
from bs4 import BeautifulSoup

# ❌ 手工爬虫：需要自己管理一切
def scrape_quotes():
    results = []
    url = "http://quotes.toscrape.com/"
    page = 1

    while url:
        # 自己发送请求
        response = requests.get(url)
        # 自己检查状态码
        if response.status_code != 200:
            print(f"请求失败: {response.status_code}")
            break
        # 自己解析 HTML
        soup = BeautifulSoup(response.text, "html.parser")

        for quote in soup.select("div.quote"):
            text = quote.select_one("span.text").get_text()
            author = quote.select_one("small.author").get_text()
            results.append({"text": text, "author": author})

        # 自己处理翻页
        next_btn = soup.select_one("li.next a")
        if next_btn:
            url = f"http://quotes.toscrape.com{next_btn['href']}"
            page += 1
        else:
            url = None

    # 自己保存文件
    import json
    with open("quotes.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"共爬取 {len(results)} 条名言")
```

### 7.2 Scrapy 方式

```python
import scrapy

# ✅ Scrapy：只需关注核心逻辑
class QuotesSpider(scrapy.Spider):
    name = "quotes"
    start_urls = ["http://quotes.toscrape.com/"]

    def parse(self, response):
        # 解析当前页的名言
        for quote in response.css("div.quote"):
            yield {
                "text": quote.css("span.text::text").get(),
                "author": quote.css("small.author::text").get(),
            }

        # 自动翻页（Scrapy 自动管理请求队列）
        next_page = response.css("li.next a::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)
```

运行命令：

```bash
scrapy crawl quotes -o quotes.json
```

对比一下，Scrapy 方式省去了：
- 手动发送请求和检查状态码
- 手动管理翻页循环
- 手动保存文件
- 手动处理异常和重试
- 手动控制并发和延迟

---

## 八、动手练习

### 练习 1：创建你的第一个 Scrapy 项目

**步骤：**

1. 运行 `scrapy startproject myquotes` 创建项目
2. 在 `spiders/` 目录下创建 `quotes_spider.py`
3. 编写 Spider 代码爬取 `http://quotes.toscrape.com/`
4. 运行爬虫并将结果保存为 `quotes.json`

**预期结果：** 得到一个包含 10 条名言的 JSON 文件。

### 练习 2：使用 Scrapy Shell 调试

**步骤：**

1. 启动 Scrapy Shell 请求 `http://quotes.toscrape.com/`
2. 用 CSS 选择器提取页面标题
3. 提取所有名言的文本和作者
4. 提取"下一页"按钮的链接
5. 把调试好的选择器写到 Spider 里

**提示：** 就像你在 Chrome DevTools 的 Console 里用 `document.querySelector()` 测试选择器一样。

### 练习 3：扩展 Spider 支持翻页

**步骤：**

1. 在 Spider 的 `parse` 方法中找到"下一页"链接
2. 使用 `yield response.follow()` 请求下一页
3. 让 `callback` 指向 `self.parse` 实现循环
4. 运行爬虫，确认爬取了所有页面的数据（共 100 条名言）

---

## 常见误区

- **一上来就学 CrawlSpider**：初学者觉得 CrawlSpider "自动跟进链接"很酷，但它的 Rule 配置一旦出错很难调试。先掌握 `scrapy.Spider`，能手动控制一切之后再考虑 CrawlSpider。
- **把 `start_urls` 当成唯一入口**：`start_urls` 只是 `start_requests()` 的快捷写法。当你需要 POST 请求、带 Cookie、或动态生成 URL 时，应该重写 `start_requests()` 方法。
- **在 Spider 里写保存逻辑**：有人在 `parse()` 方法里直接 `open()` 文件写数据。这违反了关注点分离原则——Spider 只管解析，存储交给 Pipeline。
- **忽略 settings.py 的配置**：默认的 `CONCURRENT_REQUESTS=16` 和 `DOWNLOAD_DELAY=0` 对真实网站来说太激进，不改配置直接跑等于对目标站点发起 DDoS。

---

## 工程建议

- **先用 Scrapy Shell 验证选择器，再写代码**：在 Shell 里把 CSS/XPath 调通，确认能正确提取数据后，再搬到 Spider 文件里。这比反复运行整个爬虫调试效率高 10 倍。
- **从一开始就遵守 robots.txt**：设置 `ROBOTSTXT_OBEY = True`，这是底线。如果目标站点明确禁止爬取，应该申请授权或改用官方 API，而不是绕过限制。
- **给项目起一个有意义的 BOT_NAME**：不要用默认的 `myspider`，改成能体现项目用途的名字（如 `price_monitor`），方便日志排查和多项目管理。
- **养成看日志的习惯**：Scrapy 的日志系统非常完善，运行结束后关注 `item_scraped_count`、`retry/max_retries`、`response_status_count` 等统计项，能帮你快速定位问题。

---

## 九、小结

本课我们学习了以下内容：

- **Scrapy 是什么：** Python 爬虫框架，像工厂流水线一样自动化数据采集
- **六大核心组件：** Engine（引擎）、Scheduler（调度器）、Downloader（下载器）、Spider（爬虫）、Pipeline（管道）、Middleware（中间件）
- **项目结构：** `startproject` 创建标准目录，各文件各司其职
- **第一个 Spider：** 定义 `name`、`start_urls`、`parse()` 三要素
- **运行方式：** `scrapy crawl spider_name -o output.json`
- **Scrapy Shell：** 交互式调试工具，前端同学的"爬虫版 DevTools"
- **yield 关键字：** 逐条返回数据，Scrapy 引擎自动收集处理
- **settings.py：** 配置并发、延迟、请求头等全局参数

> 🔑 **核心记忆：** Scrapy 的数据流路径是 `Spider → Engine → Scheduler → Downloader → Engine → Spider → Pipeline`，理解这条链路是后续学习的基础。

---

## 下一课预告

下一课我们将深入学习 **Spider 与 Item 的详细用法**——包括不同类型的 Spider、Request/Response 对象的高级用法、yield 的 Generator 机制，以及如何用 Item 和 ItemLoader 来规范数据结构。这是写好 Scrapy 爬虫的核心技能，敬请期待！
