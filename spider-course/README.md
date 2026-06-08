# 从零到一：Python 爬虫实战课程

> 以合规练习站为实战目标，从 Python 基础到完整数据采集系统的完整学习路径

## 适合谁

- 有 JavaScript/TypeScript 基础的前端开发者
- 想学习数据采集但不知从何入手
- 想掌握 Python 这门"第二语言"
- 对自动化、数据分析感兴趣

## 学完能做什么

- 独立编写爬虫采集任意静态/动态网页数据
- 使用 Scrapy 框架构建工程化的采集系统
- 理解常见反爬机制，并用限速、重试、登录态管理等合规方式提升采集稳定性
- 将采集数据清洗后存入数据库，通过 API 对外展示

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.10+ |
| HTTP 请求 | requests |
| 静态解析 | BeautifulSoup4、lxml |
| 动态渲染 | Playwright |
| 爬虫框架 | Scrapy |
| 数据存储 | CSV、JSON、SQLite |
| 数据清洗 | pandas |

## 学习路线图

```
┌──────────────────────────────────────────────────────────────────┐
│                    Python 爬虫学习路线                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  第一阶段：Python 基础与环境（1-2 周）                             │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                    │
│  │01│→│02│→│03│→│04│→│05│→│06│→│07│                    │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                    │
│  为什么  环境  基础  字符串 函数  文件  阶段                       │
│  用Python 搭建  语法  数据  模块  异常  实战                       │
│                                                                  │
│  第二阶段：HTTP 与网页解析（2-3 周）                               │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐            │
│  │01│→│02│→│03│→│04│→│05│→│06│→│07│→│08│            │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘            │
│  HTTP   requests HTML  BS4   CSS  分页  数据  阶段               │
│  DevTools 入门  结构  解析  XPath 翻页  导出  实战               │
│                                                                  │
│  第三阶段：动态网页与合规采集（2-3 周）                              │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                  │
│  │01│→│02│→│03│→│04│→│05│→│06│→│07│                  │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                  │
│  动态   Play-  浏览器 反爬  请求  验证码 阶段                     │
│  渲染   wright  自动化 机制  策略  登录态 实战                     │
│                                                                  │
│  第四阶段：Scrapy 框架与工程化（2-3 周）                           │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                        │
│  │01│→│02│→│03│→│04│→│05│→│06│                        │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                        │
│  Scrapy  Spider Pipeline 中间件 限速  阶段                       │
│  架构    Item   数据处理 去重  增量  实战                         │
│                                                                  │
│  第五阶段：数据存储与综合项目（2-3 周）                             │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                        │
│  │01│→│02│→│03│→│04│→│05│→│06│                        │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                        │
│  CSV   SQLite 数据  API  法律  综合                              │
│  JSON  存储   清洗  采集 道德  实战                              │
│                                                                  │
│  综合项目：数据采集 + 后端接口 + 前端展示面板                       │
│  ┌───────────────────────────────────────────┐                  │
│  │ Scrapy 采集 → SQLite 存储 → Flask API → Web 面板 │          │
│  └───────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

## 课程目录

### 第一阶段：Python 基础与环境

1. [为什么用 Python 写爬虫](stage1-python-basics/01-为什么用Python写爬虫.md) — 语言选择与生态优势
2. [Python 环境搭建](stage1-python-basics/02-Python环境搭建.md) — 安装、pip、虚拟环境
3. [基础语法速览](stage1-python-basics/03-基础语法速览.md) — 变量、条件、循环
4. [字符串与数据结构](stage1-python-basics/04-字符串与数据结构.md) — str、list、dict、set
5. [函数与模块](stage1-python-basics/05-函数与模块.md) — 定义函数、导入模块
6. [文件与异常处理](stage1-python-basics/06-文件与异常处理.md) — 读写文件、try/except
7. [阶段实战：批量文件整理工具](stage1-python-basics/07-阶段实战-批量文件整理工具.md) — 综合练习

### 第二阶段：HTTP 与网页解析

1. [HTTP 协议与 DevTools](stage2-http-and-parsing/01-HTTP协议与DevTools.md) — 请求/响应、抓包
2. [requests 库入门](stage2-http-and-parsing/02-requests库入门.md) — GET/POST、参数、响应
3. [HTML 结构速览](stage2-http-and-parsing/03-HTML结构速览.md) — 标签、属性、DOM 树
4. [BeautifulSoup 解析](stage2-http-and-parsing/04-BeautifulSoup解析.md) — 查找、提取、遍历
5. [CSS 选择器与 XPath](stage2-http-and-parsing/05-CSS选择器与XPath.md) — 精准定位元素
6. [分页与翻页策略](stage2-http-and-parsing/06-分页与翻页策略.md) — URL 参数、按钮翻页
7. [数据导出基础](stage2-http-and-parsing/07-数据导出基础.md) — CSV、JSON 写入
8. [阶段实战：quotes.toscrape.com 采集](stage2-http-and-parsing/08-阶段实战-quotes.toscrape.com采集.md) — 综合练习

### 第三阶段：动态网页与合规采集

1. [动态渲染原理](stage3-dynamic-and-anti-crawl/01-动态渲染原理.md) — CSR vs SSR、JS 渲染
2. [Playwright 入门](stage3-dynamic-and-anti-crawl/02-Playwright入门.md) — 安装、启动、基本操作
3. [浏览器自动化实战](stage3-dynamic-and-anti-crawl/03-浏览器自动化实战.md) — 点击、滚动、等待
4. [常见反爬机制](stage3-dynamic-and-anti-crawl/04-常见反爬机制.md) — User-Agent、频率、IP 限制
5. [请求头与请求策略](stage3-dynamic-and-anti-crawl/05-请求头伪装与代理池.md) — Headers、延迟、重试
6. [验证码与登录态处理](stage3-dynamic-and-anti-crawl/06-验证码与登录态处理.md) — Cookie、Session、手动介入
7. [阶段实战：books.toscrape.com 全站采集](stage3-dynamic-and-anti-crawl/07-阶段实战-books.toscrape.com全站采集.md) — 综合练习

### 第四阶段：Scrapy 框架与工程化

1. [Scrapy 架构与入门](stage4-scrapy-engineering/01-Scrapy架构与入门.md) — 架构、创建项目、运行
2. [Spider 与 Item 详解](stage4-scrapy-engineering/02-Spider与Item详解.md) — 爬虫定义、数据模型
3. [Pipeline 数据处理](stage4-scrapy-engineering/03-Pipeline数据处理.md) — 清洗、验证、存储
4. [中间件与去重](stage4-scrapy-engineering/04-中间件与去重.md) — 下载中间件、去重过滤器
5. [限速、重试与增量爬取](stage4-scrapy-engineering/05-限速重试与增量爬取.md) — 礼貌爬取策略
6. [阶段实战：新闻聚合采集器](stage4-scrapy-engineering/06-阶段实战-新闻聚合采集器.md) — 综合练习

### 第五阶段：数据存储与综合项目

1. [CSV、JSON、Excel 存储](stage5-data-and-project/01-CSV-JSON-Excel存储.md) — 文件存储方案
2. [SQLite 数据库存储](stage5-data-and-project/02-SQLite数据库存储.md) — 关系型数据库入门
3. [数据清洗实战](stage5-data-and-project/03-数据清洗实战.md) — pandas 清洗技巧
4. [API 采集技巧](stage5-data-and-project/04-API采集技巧.md) — JSON API、分页、认证
5. [robots.txt 与法律道德](stage5-data-and-project/05-robots.txt与法律道德.md) — 合规爬取
6. [综合实战：数据采集与展示系统](stage5-data-and-project/06-综合实战-数据采集与展示系统.md) — 完整项目

## 学习建议

1. **按顺序学习**：每个课时都建立在前一个的基础上
2. **动手敲代码**：不要复制粘贴，亲手敲每一行代码
3. **完成练习**：每个课时末尾的练习是巩固知识的关键
4. **阶段实战必做**：每阶段末尾的实战是检验学习成果的最佳方式
5. **善用 DevTools**：浏览器开发者工具是爬虫工程师的"显微镜"
6. **尊重目标网站**：遵守 robots.txt，控制爬取频率，不滥用数据
