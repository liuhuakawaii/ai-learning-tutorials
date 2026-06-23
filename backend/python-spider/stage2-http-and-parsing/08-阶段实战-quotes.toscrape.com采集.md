# 阶段实战：quotes.toscrape.com 全站采集

## 项目目标

前七课学了 HTTP、requests、HTML 结构、BeautifulSoup、CSS 选择器、分页策略、数据导出。这些知识点像散落的乐高积木，现在拼成完整作品。

以 `quotes.toscrape.com` 这个专为爬虫学习者搭建的网站为靶场，完成全站采集：分析页面结构、编写解析代码、实现自动翻页、导出 CSV 和 JSON，加上错误处理和进度日志。

## 分析页面结构

用 DevTools Elements 面板查看 HTML：

```
div.quote                          ← 每条名言的容器
├── span.text                      ← 名言文本
├── span
│   └── small.author               ← 作者名字
└── div.tags                       ← 标签容器
    ├── a.tag                      ← 标签 1
    └── a.tag                      ← 标签 2

翻页按钮：
nav > ul.pager > li.next > a[href]  ← "Next" 按钮
```

CSS 选择器：

| 要提取的内容 | CSS 选择器 |
|---|---|
| 所有名言块 | `div.quote` |
| 名言文本 | `span.text` |
| 作者 | `small.author` |
| 标签列表 | `div.tags a.tag` |
| 下一页按钮 | `li.next a` |

## 完整代码

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
MAX_RETRIES = 3
RETRY_DELAY = 2
REQUEST_DELAY = 0.5
OUTPUT_DIR = 'output'


# ==================== 请求模块 ====================
def fetch_page(url):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, headers=HEADERS, timeout=10)
            response.encoding = 'utf-8'
            if response.status_code == 200:
                return BeautifulSoup(response.text, 'html.parser')
            print(f'  第 {attempt} 次请求失败，状态码: {response.status_code}')
        except requests.RequestException as e:
            print(f'  第 {attempt} 次请求异常: {e}')
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY)
    return None


# ==================== 解析模块 ====================
def parse_quotes(soup):
    results = []
    for div in soup.select('div.quote'):
        text = div.select_one('span.text').get_text()
        author = div.select_one('small.author').get_text()
        tags = [tag.get_text() for tag in div.select('div.tags a.tag')]
        results.append({'text': text, 'author': author, 'tags': tags})
    return results

def get_next_url(soup):
    next_btn = soup.select_one('li.next a')
    if next_btn:
        return BASE_URL + next_btn['href']
    return None


# ==================== 导出模块 ====================
def save_to_csv(data, filepath):
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['text', 'author', 'tags'])
        writer.writeheader()
        for item in data:
            writer.writerow({
                'text': item['text'],
                'author': item['author'],
                'tags': ', '.join(item['tags']),
            })
    print(f'CSV 已保存: {filepath}（共 {len(data)} 条）')

def save_to_json(data, filepath):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'JSON 已保存: {filepath}（共 {len(data)} 条）')


# ==================== 分析模块 ====================
def analyze_data(data):
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
        print(f'\n第 {page_num} 页: {url}')
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
        save_to_csv(all_quotes, os.path.join(OUTPUT_DIR, f'quotes_{timestamp}.csv'))
        save_to_json(all_quotes, os.path.join(OUTPUT_DIR, f'quotes_{timestamp}.json'))
        analyze_data(all_quotes)
    else:
        print('\n未采集到任何数据')

    print(f'\n结束时间: {datetime.now():%Y-%m-%d %H:%M:%S}')
    return all_quotes

if __name__ == '__main__':
    data = main()
```

## 代码结构

```
main()
├── fetch_page()       请求+重试
├── parse_quotes()     解析名言块
├── get_next_url()     获取翻页链接
├── save_to_csv/json() 导出数据
└── analyze_data()     数据统计
```

按功能拆分，每个函数只做一件事。后续扩展（加数据库导出、加命令行参数）只需新增模块。

## 运行效果

```
第 1 页: https://quotes.toscrape.com/page/1/
  采集 10 条，累计 10 条
第 2 页: https://quotes.toscrape.com/page/2/
  采集 10 条，累计 20 条
...
第 10 页: https://quotes.toscrape.com/page/10/
  采集 10 条，累计 100 条

CSV 已保存: output/quotes_20260601_143022.csv（共 100 条）
JSON 已保存: output/quotes_20260601_143022.json（共 100 条）
```

## 踩坑提醒

**所有代码写在一个函数里**：超过 100 行就难以维护。按功能拆分。

**不加错误处理**：网络请求随时可能超时。不加 try/except 和重试，爬虫跑几分钟就崩是常态。

**忽略礼貌爬取**：不设延迟连续请求、不带 User-Agent，可能被封禁。

**只做采集不做验证**：爬完不检查数量是否正确、字段是否完整。用 Counter 做快速验证。

## 练习

### 练习一：运行完整代码

保存为 `quotes_spider.py`，运行确认采集 100 条名言，CSV 和 JSON 文件正常。

### 练习二：增加数据字段

点击作者名进入详情页，增加出生日期、出生地点、简介。提示：用 `author_cache` 缓存避免重复请求。

### 练习三：添加命令行参数

用 `argparse` 支持 `--pages 3`（限制页数）、`--format csv`（导出格式）、`--output mydata`（文件名前缀）。

---

## 参考答案

### 练习二

```python
def get_author_details(soup):
    born_date = soup.select_one('.author-born-date')
    born_location = soup.select_one('.author-born-location')
    return {
        'born_date': born_date.get_text().strip() if born_date else '',
        'born_location': born_location.get_text().strip() if born_location else '',
    }

# 在 main() 中，遍历每条名言时：
author_cache = {}
for div in soup.select('div.quote'):
    author = div.select_one('small.author').get_text()
    if author not in author_cache:
        about_link = div.select_one('a[href*="/author/"]')
        if about_link:
            author_soup = fetch_page(BASE_URL + about_link['href'])
            author_cache[author] = get_author_details(author_soup)
            time.sleep(0.5)
```

### 练习三

```python
import argparse

parser = argparse.ArgumentParser(description='quotes.toscrape.com 全站采集器')
parser.add_argument('--pages', type=int, default=0, help='采集页数，0=全部')
parser.add_argument('--format', choices=['csv', 'json', 'both'], default='both')
parser.add_argument('--output', type=str, default='quotes')
args = parser.parse_args()

# 在循环中检查：
if args.pages > 0 and page_num > args.pages:
    break
```
