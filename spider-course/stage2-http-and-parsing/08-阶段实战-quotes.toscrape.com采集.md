# 第八课：阶段实战——quotes.toscrape.com 全站采集

> **课程定位：** 第二阶段 · HTTP 与网页解析 · 第八课时
> **前置知识：** requests 请求、BeautifulSoup 解析、CSS 选择器、数据导出（CSV/JSON）
> **预计时长：** 70 分钟

---

完成本课学习后，你将能够：

1. 使用浏览器开发者工具分析目标网站的页面结构
2. 编写 requests + BeautifulSoup 代码解析单页数据
3. 提取名言文本、作者信息和标签列表
4. 实现翻页逻辑，跟随"Next"按钮采集全部页面
5. 将采集数据整合为字典列表并导出为 CSV 和 JSON
6. 添加错误处理和进度日志，让爬虫更健壮
7. 按功能模块拆分代码，养成良好的代码组织习惯

---

## 一、认识我们的靶场

### 1.1 quotes.toscrape.com 是什么？

这是一个专门为爬虫学习者搭建的练习网站，上面有大量名言、作者和标签数据。它完全合法，允许爬取，而且故意设置了分页、翻页按钮等结构，非常适合练习。

网站地址：`https://quotes.toscrape.com/`

```
  网站结构概览：

  ┌─────────────────────────────────────────────────────────┐
  │  quotes.toscrape.com                                    │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │  ┌─────────────────────────────────────────────────┐    │
  │  │  "The world as we have created it is a process  │    │
  │  │   of our thinking. It cannot be changed without  │    │
  │  │   changing our thinking."                        │    │
  │  │                      by Albert Einstein          │    │
  │  │                      Tags: change, deep-thoughts │    │
  │  └─────────────────────────────────────────────────┘    │
  │                                                         │
  │  ┌─────────────────────────────────────────────────┐    │
  │  │  "It is our choices, Harry, that show what we   │    │
  │  │   truly are, far more than our abilities."      │    │
  │  │                      by J.K. Rowling             │    │
  │  │                      Tags: abilities, choices    │    │
  │  └─────────────────────────────────────────────────┘    │
  │                                                         │
  │  ┌──────────┐                                          │
  │  │ Next →   │  ← 点击翻页                              │
  │  └──────────┘                                          │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

### 1.2 项目目标

我们要完成以下任务：

我们要完成以下任务：

1. 采集所有页面的名言数据（文本、作者、标签）
2. 实现自动翻页，直到没有"Next"按钮为止
3. 导出为 CSV 和 JSON 两种格式
4. 添加错误处理和进度日志
5. 代码按功能模块拆分

---

## 二、用开发者工具分析页面结构

### 2.1 打开 DevTools

在浏览器中打开 `https://quotes.toscrape.com/`，按 `F12` 打开开发者工具，切换到 **Elements**（元素）面板。

### 2.2 分析一条名言的 HTML 结构

用元素选择器（左上角的箭头图标）点击一条名言，你会看到类似这样的 HTML：

```html
<div class="quote" itemscope="" itemtype="http://schema.org/CreativeWork">
    <span class="text" itemprop="text">
        "The world as we have created it is a process of our thinking.
        It cannot be changed without changing our thinking."
    </span>
    <span>by <small class="author" itemprop="author">Albert Einstein</small>
        <a href="/author/Albert-Einstein">(about)</a>
    </span>
    <div class="tags">
        Tags:
        <a class="tag" href="/tag/change/page/1/">change</a>
        <a class="tag" href="/tag/deep-thoughts/page/1/">deep-thoughts</a>
    </div>
</div>
```

```
  HTML 结构分析：

  div.quote                          ← 每条名言的容器
  ├── span.text                      ← 名言文本
  ├── span
  │   └── small.author               ← 作者名字
  └── div.tags                       ← 标签容器
      ├── a.tag                      ← 标签 1
      ├── a.tag                      ← 标签 2
      └── ...

  翻页按钮：

  nav                                ← 导航栏
  └── ul.pager
      └── li.next
          └── a[href]                ← "Next" 按钮，href 指向下一页
```

### 2.3 分析翻页结构

滚动到页面底部，找到"Next →"按钮：

```html
<nav>
    <ul class="pager">
        <li class="next">
            <a href="/page/2/">Next <span aria-hidden="true">&rarr;</span></a>
        </li>
    </ul>
</nav>
```

**关键发现：** 下一页的 URL 在 `<a>` 标签的 `href` 属性中。如果没有 `li.next`，说明已经是最后一页。

### 2.4 确定 CSS 选择器

```
  ┌──────────────────┬──────────────────────────────────────┐
  │   要提取的内容   │   CSS 选择器                         │
  ├──────────────────┼──────────────────────────────────────┤
  │   所有名言块     │   div.quote                          │
  │   名言文本       │   span.text                          │
  │   作者           │   small.author                       │
  │   标签列表       │   div.tags a.tag                     │
  │   下一页按钮     │   li.next a                          │
  └──────────────────┴──────────────────────────────────────┘
```

---

## 三、第一步：解析单页数据

### 3.1 发送请求并解析

```python
import requests
from bs4 import BeautifulSoup

url = 'https://quotes.toscrape.com/'

# 发送请求
response = requests.get(url)
response.encoding = 'utf-8'

# 解析页面
soup = BeautifulSoup(response.text, 'html.parser')

# 查看页面标题，确认请求成功
print('页面标题:', soup.title.string)
```

### 3.2 提取一条名言

```python
# 找到第一条名言
first_quote = soup.select_one('div.quote')

# 提取文本
text = first_quote.select_one('span.text').get_text()
print('名言:', text)

# 提取作者
author = first_quote.select_one('small.author').get_text()
print('作者:', author)

# 提取标签
tags = [tag.get_text() for tag in first_quote.select('div.tags a.tag')]
print('标签:', tags)
```

输出示例：

```
名言: "The world as we have created it is a process of our thinking. It cannot be changed without changing our thinking."
作者: Albert Einstein
标签: ['change', 'deep-thoughts', 'thinking', 'world']
```

### 3.3 提取一页所有名言

```python
quotes = soup.select('div.quote')   # 选择所有名言块

for quote in quotes:
    text = quote.select_one('span.text').get_text()
    author = quote.select_one('small.author').get_text()
    tags = [tag.get_text() for tag in quote.select('div.tags a.tag')]
    print(f'{author}: {text[:30]}... [{", ".join(tags)}]')
```

```
  单页采集流程：

  ┌──────────┐     ┌──────────────┐     ┌──────────────┐
  │  请求页面 │────→│  解析 HTML   │────→│  遍历名言块  │
  └──────────┘     └──────────────┘     └──────────────┘
                                               │
                                               ▼
                                       ┌──────────────┐
                                       │  提取数据     │
                                       │  text/author │
                                       │  /tags       │
                                       └──────────────┘
```

---

## 四、第二步：实现翻页逻辑

### 4.1 翻页的思路

```
  翻页流程：

  ┌──────────────┐
  │  从第1页开始  │
  └──────┬───────┘
         ▼
  ┌──────────────┐     否
  │ 有Next按钮吗？├──────────────┐
  └──────┬───────┘              │
         │ 是                   ▼
         ▼               ┌──────────────┐
  ┌──────────────┐       │  采集完毕！   │
  │  解析当前页   │       └──────────────┘
  │  提取数据     │
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │  找到Next链接 │
  │  请求下一页   │
  └──────┬───────┘
         │
         └──→ 回到"有Next按钮吗？"
```

### 4.2 翻页代码

```python
import requests
from bs4 import BeautifulSoup

base_url = 'https://quotes.toscrape.com'
url = '/page/1/'

while url:
    full_url = base_url + url
    print(f'正在采集: {full_url}')

    response = requests.get(full_url)
    soup = BeautifulSoup(response.text, 'html.parser')

    # 采集当前页数据...
    quotes = soup.select('div.quote')
    for quote in quotes:
        text = quote.select_one('span.text').get_text()
        author = quote.select_one('small.author').get_text()
        tags = [t.get_text() for t in quote.select('div.tags a.tag')]
        # 存储到列表...

    # 查找下一页链接
    next_btn = soup.select_one('li.next a')
    if next_btn:
        url = next_btn['href']    # 例如 '/page/2/'
    else:
        url = None                # 没有下一页了
        print('所有页面采集完毕！')
```

---

## 五、第三步：整合数据并导出

### 5.1 拆分函数

把前面的代码拆分成独立的函数，每个函数只做一件事：

```python
def fetch_page(url):
    """请求页面并返回 BeautifulSoup 对象，失败返回 None"""
    try:
        response = requests.get(url, timeout=10)
        response.encoding = 'utf-8'
        if response.status_code == 200:
            return BeautifulSoup(response.text, 'html.parser')
        else:
            print(f'⚠️ 请求失败，状态码: {response.status_code}')
            return None
    except requests.RequestException as e:
        print(f'⚠️ 请求异常: {e}')
        return None


def parse_quotes(soup):
    """从页面中提取所有名言数据，返回字典列表"""
    results = []
    for div in soup.select('div.quote'):
        text = div.select_one('span.text').get_text()
        author = div.select_one('small.author').get_text()
        tags = [tag.get_text() for tag in div.select('div.tags a.tag')]
        results.append({'text': text, 'author': author, 'tags': tags})
    return results


def get_next_url(soup, base_url):
    """获取下一页的完整 URL，没有下一页返回 None"""
    next_btn = soup.select_one('li.next a')
    if next_btn:
        return base_url + next_btn['href']
    return None
```

### 5.2 导出函数

```python
def save_to_csv(data, filename):
    """将数据保存为 CSV 文件，tags 列表转为逗号分隔的字符串"""
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['text', 'author', 'tags'])
        writer.writeheader()
        for item in data:
            writer.writerow({
                'text': item['text'],
                'author': item['author'],
                'tags': ', '.join(item['tags']),   # 列表转字符串
            })
    print(f'✅ CSV 已保存: {filename}（共 {len(data)} 条）')


def save_to_json(data, filename):
    """将数据保存为 JSON 文件"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'✅ JSON 已保存: {filename}（共 {len(data)} 条）')
```

### 5.3 主流程

```python
def main():
    base_url = 'https://quotes.toscrape.com'
    all_quotes = []
    page_num = 1
    url = base_url + '/page/1/'

    while url:
        print(f'正在采集第 {page_num} 页: {url}')
        soup = fetch_page(url)
        if soup is None:
            break
        quotes = parse_quotes(soup)
        all_quotes.extend(quotes)
        print(f'  本页 {len(quotes)} 条，累计 {len(all_quotes)} 条')
        url = get_next_url(soup, base_url)
        page_num += 1
        time.sleep(0.5)   # 礼貌延迟

    # 导出数据
    if all_quotes:
        os.makedirs('output', exist_ok=True)
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        save_to_csv(all_quotes, f'output/quotes_{ts}.csv')
        save_to_json(all_quotes, f'output/quotes_{ts}.json')

    return all_quotes


if __name__ == '__main__':
    data = main()
```

---

## 六、运行效果

运行完整代码后，你会看到逐页采集的日志：

```
==================================================
  quotes.toscrape.com 全站采集器
  开始时间: 2026-06-01 14:30:22
==================================================

📄 第 1 页: https://quotes.toscrape.com/page/1/
  采集 10 条，累计 10 条
📄 第 2 页: https://quotes.toscrape.com/page/2/
  采集 10 条，累计 20 条
...
📄 第 10 页: https://quotes.toscrape.com/page/10/
  采集 10 条，累计 100 条

✅ CSV 已保存: output/quotes_20260601_143022.csv（共 100 条）
✅ JSON 已保存: output/quotes_20260601_143022.json（共 100 条）
```

CSV 文件中 `tags` 用逗号分隔的字符串表示，JSON 文件则保留了原始的列表结构。

---

## 七、代码优化与进阶

### 7.1 重试机制

网络请求随时可能失败，加上重试逻辑可以让爬虫更健壮。在 `fetch_page` 中加入 `for attempt in range(1, max_retries + 1)` 循环，每次失败后 `time.sleep(delay)` 再重试，超过最大次数返回 `None`。

### 7.2 请求头设置

加上 User-Agent，让请求明确表达客户端能力和任务来源：

```python
HEADERS = {
    'User-Agent': 'QuotesLearningScraper/1.0 (+mailto:contact@example.com)'
}
response = requests.get(url, headers=HEADERS, timeout=10)
```

### 7.3 统计分析

采集完成后，用 `collections.Counter` 对数据做简单分析：

```python
from collections import Counter

def analyze_data(data):
    """对采集数据进行简单统计"""
    authors = [item['author'] for item in data]
    all_tags = []
    for item in data:
        all_tags.extend(item['tags'])

    print(f'  总名言数: {len(data)}')
    print(f'  作者数量: {len(set(authors))}')
    print('\n  名言最多的作者 TOP 5：')
    for author, count in Counter(authors).most_common(5):
        print(f'    {author}: {count} 条')
    print('\n  最热门的标签 TOP 10：')
    for tag, count in Counter(all_tags).most_common(10):
        print(f'    {tag}: {count} 次')
```

---

## 八、完整最终代码

把前面所有模块整合在一起，下面是你可以直接复制运行的完整版本：

```python
"""
quotes.toscrape.com 全站采集器
依赖: pip install requests beautifulsoup4
"""
import requests
from bs4 import BeautifulSoup
import csv, json, os, time
from datetime import datetime
from collections import Counter

# ==================== 配置 ====================
BASE_URL = 'https://quotes.toscrape.com'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) '
                  'Chrome/120.0.0.0 Safari/537.36'
}
MAX_RETRIES = 3          # 最大重试次数
RETRY_DELAY = 2          # 重试间隔（秒）
REQUEST_DELAY = 0.5      # 请求间隔（秒），礼貌爬取
OUTPUT_DIR = 'output'    # 输出目录

# ==================== 请求模块 ====================
def fetch_page(url):
    """请求页面，带重试机制"""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, headers=HEADERS, timeout=10)
            response.encoding = 'utf-8'
            if response.status_code == 200:
                return BeautifulSoup(response.text, 'html.parser')
            else:
                print(f'  ⚠️ 第 {attempt} 次请求失败，状态码: {response.status_code}')
        except requests.RequestException as e:
            print(f'  ⚠️ 第 {attempt} 次请求异常: {e}')
        if attempt < MAX_RETRIES:
            print(f'  等待 {RETRY_DELAY} 秒后重试...')
            time.sleep(RETRY_DELAY)
    print(f'  ❌ 请求最终失败: {url}')
    return None

# ==================== 解析模块 ====================
def parse_quotes(soup):
    """从页面中提取所有名言数据"""
    results = []
    for div in soup.select('div.quote'):
        text = div.select_one('span.text').get_text()
        author = div.select_one('small.author').get_text()
        tags = [tag.get_text() for tag in div.select('div.tags a.tag')]
        results.append({'text': text, 'author': author, 'tags': tags})
    return results

def get_next_url(soup):
    """获取下一页的 URL"""
    next_btn = soup.select_one('li.next a')
    if next_btn:
        return BASE_URL + next_btn['href']
    return None

# ==================== 导出模块 ====================
def save_to_csv(data, filepath):
    """导出为 CSV 文件"""
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['text', 'author', 'tags'])
        writer.writeheader()
        for item in data:
            writer.writerow({
                'text': item['text'],
                'author': item['author'],
                'tags': ', '.join(item['tags']),
            })
    print(f'✅ CSV 已保存: {filepath}（共 {len(data)} 条）')

def save_to_json(data, filepath):
    """导出为 JSON 文件"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'✅ JSON 已保存: {filepath}（共 {len(data)} 条）')

# ==================== 分析模块 ====================
def analyze_data(data):
    """对采集数据进行简单统计"""
    authors = [item['author'] for item in data]
    all_tags = []
    for item in data:
        all_tags.extend(item['tags'])
    print(f'  总名言数: {len(data)}')
    print(f'  作者数量: {len(set(authors))}')
    print('\n  名言最多的作者 TOP 5：')
    for author, count in Counter(authors).most_common(5):
        print(f'    {author}: {count} 条')
    print('\n  最热门的标签 TOP 10：')
    for tag, count in Counter(all_tags).most_common(10):
        print(f'    {tag}: {count} 次')

# ==================== 主流程 ====================
def main():
    all_quotes = []
    page_num = 1
    url = BASE_URL + '/page/1/'

    print('=' * 50)
    print('  quotes.toscrape.com 全站采集器')
    print(f'  开始时间: {datetime.now():%Y-%m-%d %H:%M:%S}')
    print('=' * 50)

    while url:
        print(f'\n📄 第 {page_num} 页: {url}')
        soup = fetch_page(url)
        if soup is None:
            print('  页面请求失败，停止采集')
            break
        quotes = parse_quotes(soup)
        all_quotes.extend(quotes)
        print(f'  采集 {len(quotes)} 条，累计 {len(all_quotes)} 条')
        url = get_next_url(soup)
        page_num += 1
        if url:
            time.sleep(REQUEST_DELAY)

    if all_quotes:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        csv_path = os.path.join(OUTPUT_DIR, f'quotes_{timestamp}.csv')
        json_path = os.path.join(OUTPUT_DIR, f'quotes_{timestamp}.json')
        print(f'\n{"=" * 50}\n  导出数据\n{"=" * 50}')
        save_to_csv(all_quotes, csv_path)
        save_to_json(all_quotes, json_path)
        print(f'\n{"=" * 50}\n  📊 数据统计\n{"=" * 50}')
        analyze_data(all_quotes)
    else:
        print('\n⚠️ 未采集到任何数据')

    print(f'\n{"=" * 50}')
    print(f'  结束时间: {datetime.now():%Y-%m-%d %H:%M:%S}')
    print(f'{"=" * 50}')
    return all_quotes

if __name__ == '__main__':
    data = main()
```

### 代码结构总览

```
  ┌─────────────────────────────────────────────────┐
  │                   main() 主流程                  │
  ├─────────────┬──────────────┬────────────────────┤
  │ fetch_page  │ parse_quotes │ get_next_url       │
  │ 请求+重试   │ 解析名言块   │ 获取翻页链接       │
  ├─────────────┴──────────────┴────────────────────┤
  │              all_quotes 列表                     │
  ├─────────────┬──────────────┬────────────────────┤
  │ save_to_csv │ save_to_json │ analyze_data       │
  │ CSV 导出    │ JSON 导出    │ 数据统计           │
  └─────────────┴──────────────┴────────────────────┘
```

---

## 九、知识回顾：我们用到了哪些技能？

这个实战项目综合运用了第一阶段和第二阶段学到的多项技能：

| 阶段 | 技能 | 本项目中的应用 |
|------|------|---------------|
| 第一阶段 | Python 变量、列表、字典 | 存储 URL 和采集数据 |
| 第一阶段 | for 循环、列表推导式 | 遍历名言块、提取标签 |
| 第一阶段 | 函数定义、f-string | 模块化代码、日志输出 |
| 第二阶段 | HTTP 基础、requests | GET 请求、超时、异常处理 |
| 第二阶段 | BeautifulSoup、CSS 选择器 | `div.quote`、`span.text`、`li.next a` |
| 第二阶段 | 数据导出 | `csv.DictWriter`、`json.dump` |

---

## 十、动手练习

### 练习一：运行完整代码

将第八节的完整代码保存为 `quotes_spider.py`，运行它，确认能采集到全部 100 条名言，并在 `output` 目录下找到 CSV 和 JSON 文件。

**检查清单：** 程序运行无报错、共采集 100 条名言、CSV 文件可用 Excel 正常打开、JSON 文件中文正常显示。

### 练习二：增加数据字段

点击某个作者名字进入详情页，分析其 HTML 结构，尝试在采集数据中增加作者出生日期（`born_date`）、出生地点（`born_location`）和简介（`description`）。

**提示：** 每条名言下方有 `(about)` 链接指向作者详情页，你需要提取该链接的 `href`，请求详情页后再提取额外信息。

### 练习三：添加命令行参数

使用 `argparse` 模块（标准库）让脚本支持从命令行传入参数：

```bash
python quotes_spider.py                  # 默认采集
python quotes_spider.py --pages 3        # 只采集前3页
python quotes_spider.py --format csv     # 只导出 CSV
python quotes_spider.py --output mydata  # 自定义输出文件名前缀
```

---

## 小结

本课的核心收获：

1. **分析网站结构**：用浏览器 DevTools 查看 HTML，确定 CSS 选择器
2. **单页数据提取**：`div.quote` -> `span.text` / `small.author` / `a.tag`
3. **翻页逻辑**：检查 `li.next a` 是否存在，获取 `href` 继续请求
4. **数据整合**：用列表 + 字典存储结构化数据
5. **双重导出**：CSV（给 Excel 用）+ JSON（保留完整结构）
6. **健壮性**：重试机制、礼貌延迟、错误处理
7. **代码组织**：按功能拆分为 fetch / parse / save / analyze 模块

```
  quotes_spider.py
  ├── 配置区（URL、Headers、参数）
  ├── fetch_page()       ← 请求模块
  ├── parse_quotes()     ← 解析模块
  ├── get_next_url()     ← 翻页模块
  ├── save_to_csv/json() ← 导出模块
  ├── analyze_data()     ← 数据统计
  └── main()             ← 主流程
```

---

## 下一课预告

恭喜你完成了第二阶段的实战项目！你现在已经具备了从发送请求、解析页面到数据导出的完整能力。接下来我们将进入**第三阶段：动态网页与合规采集**，学习如何处理 JavaScript 动态渲染页面、使用 Playwright 自动化浏览器，以及用限速、重试和登录态管理让采集过程更稳定。敬请期待！
