# 阶段实战：books.toscrape.com 全站采集

## 项目目标

前六课学了动态渲染、Playwright、反爬机制、请求头策略、登录态管理。现在把它们组合：分析网站结构、逐层采集分类→列表→详情页、处理翻页、错误重试、数据导出，保证程序足够"礼貌"。

目标：**采集全站所有书籍的完整信息**，按分类组织，导出 CSV 和 JSON。

## 数据字段

| 字段 | 说明 |
|------|------|
| title | 书名 |
| price | 价格（含税） |
| rating | 评分（1-5） |
| availability | 库存状态 |
| upc | 产品编码 |
| category | 所属分类 |
| description | 书籍描述 |
| url | 详情页链接 |

## 网站结构

```
首页 → 左侧栏分类列表（50 个分类）
分类页 → 书籍列表（每页 20 本）+ Next 翻页
详情页 → 书名、价格、库存、星级、UPC、描述
```

## 完整代码

```python
"""
books.toscrape.com 全站采集器
依赖: pip install requests beautifulsoup4
"""
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import csv, json, os, time
from datetime import datetime

BASE_URL = 'https://books.toscrape.com/'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                  'AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
}
MAX_RETRIES = 3
RETRY_DELAY = 2
REQUEST_DELAY = 0.3
OUTPUT_DIR = 'output'
RATING_MAP = {'One': 1, 'Two': 2, 'Three': 3, 'Four': 4, 'Five': 5}


def create_session():
    session = requests.Session()
    session.headers.update(HEADERS)
    return session

def fetch_page(session, url):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(url, timeout=10)
            response.encoding = 'utf-8'
            if response.status_code == 200:
                return BeautifulSoup(response.text, 'html.parser')
            print(f'    [重试 {attempt}/{MAX_RETRIES}] 状态码: {response.status_code}')
        except requests.RequestException as e:
            print(f'    [重试 {attempt}/{MAX_RETRIES}] 异常: {e}')
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY)
    print(f'    [失败] {url}')
    return None


def get_categories(session):
    soup = fetch_page(session, BASE_URL)
    if not soup:
        return []
    categories = []
    for a in soup.select('div.side_categories ul.nav-list li ul li a'):
        categories.append({
            'name': a.get_text(strip=True),
            'url': urljoin(BASE_URL, a['href']),
        })
    return categories


def get_books_from_list_page(session, url, category_name):
    soup = fetch_page(session, url)
    if not soup:
        return [], None
    books = []
    for article in soup.select('article.product_pod'):
        title = article.select_one('h3 a')['title']
        detail_url = urljoin(url, article.select_one('h3 a')['href'])
        price = article.select_one('p.price_color').get_text(strip=True)
        star_tag = article.select_one('p.star-rating')
        rating_word = ''
        if star_tag:
            classes = [c for c in star_tag['class'] if c != 'star-rating']
            rating_word = classes[0] if classes else ''
        books.append({
            'title': title, 'price': price,
            'rating_word': rating_word, 'detail_url': detail_url,
            'category': category_name,
        })
    next_btn = soup.select_one('li.next a')
    next_url = None
    if next_btn:
        next_url = url.rsplit('/', 1)[0] + '/' + next_btn['href']
    return books, next_url

def get_all_books_in_category(session, category):
    all_books, url, page_num = [], category['url'], 1
    while url:
        books, next_url = get_books_from_list_page(session, url, category['name'])
        if not books:
            break
        all_books.extend(books)
        print(f'    第 {page_num} 页: {len(books)} 本（累计 {len(all_books)}）')
        url = next_url
        page_num += 1
        if url:
            time.sleep(REQUEST_DELAY)
    return all_books


def get_book_detail(session, detail_url):
    soup = fetch_page(session, detail_url)
    if not soup:
        return None
    title = soup.select_one('h1').get_text(strip=True)
    price_text = soup.select_one('p.price_color').get_text(strip=True)
    stock_tag = soup.select_one('p.instock availability')
    availability = stock_tag.get_text(strip=True) if stock_tag else 'Unknown'
    star_tag = soup.select_one('p.star-rating')
    rating_word = ''
    if star_tag:
        classes = [c for c in star_tag['class'] if c != 'star-rating']
        rating_word = classes[0] if classes else ''
    table_data = {}
    for row in soup.select('table.table-striped tr'):
        table_data[row.select_one('th').get_text(strip=True)] = \
            row.select_one('td').get_text(strip=True)
    desc_tag = soup.select_one('#product_description ~ p')
    return {
        'title': title, 'price': price_text, 'availability': availability,
        'rating_word': rating_word, 'rating': RATING_MAP.get(rating_word, 0),
        'upc': table_data.get('UPC', ''),
        'price_excl_tax': table_data.get('Price (excl. tax)', ''),
        'price_incl_tax': table_data.get('Price (incl. tax)', ''),
        'tax': table_data.get('Tax', ''),
        'num_reviews': table_data.get('Number of reviews', '0'),
        'description': desc_tag.get_text(strip=True) if desc_tag else '',
        'url': detail_url,
    }


def save_to_csv(data, filepath):
    if not data:
        return
    fieldnames = [
        'category', 'title', 'price', 'rating', 'availability',
        'upc', 'price_excl_tax', 'price_incl_tax', 'tax',
        'num_reviews', 'description', 'url'
    ]
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for book in data:
            writer.writerow(book)
    print(f'  CSV 已保存: {filepath}（共 {len(data)} 条）')

def save_to_json(data, filepath):
    organized = {}
    for book in data:
        cat = book.get('category', '未分类')
        organized.setdefault(cat, []).append(
            {k: v for k, v in book.items() if k != 'detail_url'}
        )
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(organized, f, ensure_ascii=False, indent=2)
    total = sum(len(v) for v in organized.values())
    print(f'  JSON 已保存: {filepath}（共 {total} 条，{len(organized)} 个分类）')


def print_summary(data):
    categories = {}
    for book in data:
        categories.setdefault(book.get('category', ''), []).append(book)
    ratings = [b['rating'] for b in data if b.get('rating', 0) > 0]
    avg = sum(ratings) / len(ratings) if ratings else 0
    print(f'\n总书籍数: {len(data)} | 分类数量: {len(categories)} | 平均评分: {avg:.2f}')


def main():
    print('=' * 55)
    print('  books.toscrape.com 全站采集器')
    print(f'  开始时间: {datetime.now():%Y-%m-%d %H:%M:%S}')
    print('=' * 55)

    session = create_session()

    print('\n[1/3] 获取书籍分类...')
    categories = get_categories(session)
    print(f'  共找到 {len(categories)} 个分类')
    if not categories:
        return []

    # 测试时限制分类数量：categories = categories[:3]

    print(f'\n[2/3] 采集书籍详情...')
    all_books = []
    for idx, category in enumerate(categories, 1):
        print(f'\n  [{idx}/{len(categories)}] 分类: {category["name"]}')
        books = get_all_books_in_category(session, category)
        print(f'    列表完成，{len(books)} 本，开始采集详情...')
        for b_idx, book in enumerate(books, 1):
            detail = get_book_detail(session, book['detail_url'])
            if detail:
                detail['category'] = category['name']
                all_books.append(detail)
            if b_idx % 20 == 0:
                print(f'    详情进度: {b_idx}/{len(books)}')
            time.sleep(REQUEST_DELAY)
        print(f'    分类完成，总累计: {len(all_books)} 本')

    if all_books:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        print(f'\n[3/3] 导出数据...')
        save_to_csv(all_books, os.path.join(OUTPUT_DIR, f'books_{ts}.csv'))
        save_to_json(all_books, os.path.join(OUTPUT_DIR, f'books_{ts}.json'))
        print_summary(all_books)

    print(f'\n结束时间: {datetime.now():%Y-%m-%d %H:%M:%S}')
    return all_books

if __name__ == '__main__':
    data = main()
```

## 关键设计

**Session 复用连接**：减少 TCP 握手开销。

**星级转换**：`RATING_MAP` 将英文单词（One/Two/Three）转为 1-5 数字。

**分类内翻页**：检查 `li.next a` 是否存在，获取 `href` 继续请求。翻页 URL 是相对路径，需要拼接 base URL。

**CSV 用 utf-8-sig**：Excel 打开不乱码。

**先用少量分类测试**：`categories = categories[:3]`，确认无误后再全量运行。

## 踩坑提醒

**详情页和列表页选择器不同**：列表页信息精简，详情页才有 UPC、税率、描述。不能混用。

**忘了处理相对路径**：`urljoin()` 是必须的。

**一上来就全量运行**：先测试 3 个分类，确认逻辑正确。

## 练习

### 练习一：运行完整代码

先用前 3 个分类测试，确认 CSV 和 JSON 正确，再全量运行。

### 练习二：添加统计分析

全站平均价格、最贵/最便宜各 5 本、每个分类平均评分排名。注意价格字段带 `£` 符号需要清洗。

### 练习三：断点续爬

每采集完一个分类保存进度到 `progress.json`。重启时跳过已完成的分类，全部完成后删除进度文件。

---

## 参考答案

### 练习二

```python
def print_summary(data):
    prices = []
    for book in data:
        price_str = book.get('price', '0').replace('£', '').replace(',', '')
        try:
            prices.append((float(price_str), book['title']))
        except ValueError:
            pass
    prices.sort(reverse=True)
    print(f'\n最贵的 5 本:')
    for price, title in prices[:5]:
        print(f'  £{price:.2f} - {title}')
```

### 练习三

```python
import json, os

PROGRESS_FILE = 'progress.json'

def save_progress(done_categories, all_books):
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump({'done': list(done_categories), 'books': all_books}, f, ensure_ascii=False)

def load_progress():
    if not os.path.exists(PROGRESS_FILE):
        return set(), []
    with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return set(data.get('done', [])), data.get('books', [])

# 在 main() 中：
done_categories, all_books = load_progress()
for category in categories:
    if category['name'] in done_categories:
        continue
    # ... 采集逻辑 ...
    done_categories.add(category['name'])
    save_progress(done_categories, all_books)
if os.path.exists(PROGRESS_FILE):
    os.remove(PROGRESS_FILE)
```
