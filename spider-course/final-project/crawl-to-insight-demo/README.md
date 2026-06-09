# Crawl To Insight Demo

这是爬虫课程的离线贯穿项目。它用本地 HTML fixtures 练习解析、分页、去重和导出，避免外部网站变动、网络失败或合规边界不清。

## 运行

```bash
npm run check
npm run crawl
```

输出：

- `output/books.json`
- `output/books.csv`

## 课程映射

- 第一阶段：用文件读写和异常处理整理 `fixtures/`
- 第二阶段：解析 HTML、提取字段、翻页、导出
- 第三阶段：把同样字段映射到 Playwright 动态页面采集
- 第四阶段：迁移为 Scrapy Spider + Item + Pipeline
- 第五阶段：写入 SQLite，补 API 和合规报告
