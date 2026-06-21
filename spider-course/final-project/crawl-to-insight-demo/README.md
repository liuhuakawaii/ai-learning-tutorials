# Crawl To Insight Demo

这是爬虫课程的离线贯穿项目。它用本地 HTML fixtures 练习解析、分页、去重和导出，避免外部网站变动、网络失败或合规边界不清。

## 运行

### 静态采集（第二阶段）

```bash
npm run check
npm run crawl
```

输出：`output/books.json`、`output/books.csv`

### Playwright 动态采集（第三阶段）

```bash
pip install -r requirements.txt
playwright install chromium
python scripts/crawl_playwright.py
```

输出：`output/books-playwright.json`

### Scrapy 工程化采集（第四阶段）

先启动本地 HTTP 服务器提供 fixtures：

```bash
python -m http.server 8080 --directory fixtures
```

然后运行 Spider：

```bash
scrapy runspider scripts/books_spider.py -o output/books-scrapy.json
```

## 课程映射

- 第一阶段：用文件读写和异常处理整理 `fixtures/`
- 第二阶段：`scripts/crawl-fixtures.js` — 正则解析、翻页、去重、导出
- 第三阶段：`scripts/crawl_playwright.py` — Playwright 动态渲染、元素定位、翻页
- 第四阶段：`scripts/books_spider.py` — Scrapy Spider、CSS 选择器、自动翻页
- 第五阶段：写入 SQLite，补 API 和合规报告
