# 第七课：阶段实战——books.toscrape.com 全站采集

> **课程定位：** 第三阶段 · 动态网页与反爬 · 第七课时
> **前置知识：** requests 请求、BeautifulSoup 解析、CSS 选择器、分页处理、数据导出、Session 管理
> **预计时长：** 80 分钟

---

完成本课学习后，你将能够：

1. 分析一个多层级网站的整体结构（首页 → 分类 → 书籍列表 → 书籍详情）
2. 从分类页面提取所有书籍分类及其 URL
3. 在每个分类内实现分页翻页，采集全部书籍列表
4. 深入书籍详情页提取完整信息（价格、库存、评分、UPC、描述等）
5. 将英文星级文字（如 "Three"）转换为数字评分
6. 设计合理的嵌套数据结构，按分类组织数据
7. 将数据导出为 CSV 和 JSON 格式，正确处理编码
8. 为爬虫添加错误处理、重试机制和进度日志

---

## 一、认识我们的靶场

### 1.1 books.toscrape.com 是什么？

这是专门为爬虫学习者搭建的练习网站，模拟了一个网上书店。它完全合法，允许爬取，而且设计了多层页面结构——首页、分类页、书籍列表页、书籍详情页——非常适合练习完整的爬虫项目。

网站地址：`https://books.toscrape.com/`

```
  网站结构全景图：

  ┌─────────────────────────────────────────────────────────────┐
  │  books.toscrape.com                                          │
  │                                                              │
  │  ┌───────────────────────────────────────────────────────┐   │
  │  │  首页 (index.html)                                     │   │
  │  │  ├── 左侧栏：书籍分类列表（Travel, Mystery, ...）       │   │
  │  │  └── 主体：书籍列表（每页 20 本）+ 分页导航              │   │
  │  └───────────────────────────────────────────────────────┘   │
  │                                                              │
  │  ┌───────────────────────────────────────────────────────┐   │
  │  │  分类页 (catalogue/category/books/travel_2/index.html) │   │
  │  │  ├── 该分类下的书籍列表                                 │   │
  │  │  └── 分页：Next 按钮翻页                                │   │
  │  └───────────────────────────────────────────────────────┘   │
  │                                                              │
  │  ┌───────────────────────────────────────────────────────┐   │
  │  │  详情页 (catalogue/a-light-in-the-attic_1000/...)      │   │
  │  │  ├── 书名、价格、库存状态、星级评分                      │   │
  │  │  ├── 产品信息表（UPC、价格含税/不含税、税率等）         │   │
  │  │  └── 书籍描述                                           │   │
  │  └───────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────┘
```

### 1.2 项目目标与数据字段

我们的目标是：**采集全站所有书籍的完整信息**，按分类组织，导出为 CSV 和 JSON。

```
  ┌──────────────────┬──────────────────────────────────────┐
  │   字段            │   说明                                │
  ├──────────────────┼──────────────────────────────────────┤
  │  title           │  书名                                 │
  │  price           │  价格（含税）                         │
  │  availability    │  库存状态（In stock / Out of stock）  │
  │  rating          │  评分（1-5 的数字）                   │
  │  upc             │  产品编码（唯一标识）                 │
  │  price_excl_tax  │  不含税价格                           │
  │  price_incl_tax  │  含税价格                             │
  │  tax             │  税额                                 │
  │  num_reviews     │  评论数量                             │
  │  description     │  书籍描述                             │
  │  category        │  所属分类                             │
  │  url             │  详情页链接                           │
  └──────────────────┴──────────────────────────────────────┘
```

---

## 二、分析网站结构

### 2.1 首页结构

在浏览器中打开 `https://books.toscrape.com/`，按 F12 打开 DevTools。

```
  div.container                   ← 页面容器
  └── div.row
      ├── aside.col-sm-3          ← 左侧栏（分类列表）
      │   └── div.side_categories
      │       └── ul.nav-list > li > ul
      │           └── li > a[href]  ← 每个分类的链接
      │
      └── section.col-sm-9        ← 主体内容
          └── ol.row              ← 书籍列表
              └── li > article.product_pod
                  ├── h3 > a[title]     ← 书名
                  ├── p.price_color     ← 价格
                  └── p.star-rating     ← 星级（class 中有评分词）
```

### 2.2 详情页结构

```
  ┌──────────────────┬──────────────────────────────────────────┐
  │   数据字段        │   CSS 选择器                              │
  ├──────────────────┼──────────────────────────────────────────┤
  │   书名            │   h1                                     │
  │   价格            │   p.price_color                          │
  │   库存状态        │   p.instock availability                 │
  │   星级评分        │   p.star-rating（class 中的单词）         │
  │   产品信息表      │   table.table-striped tr                 │
  │   描述            │   #product_description ~ p               │
  └──────────────────┴──────────────────────────────────────────┘

  产品信息表中每行的结构：
  <tr><th>UPC</th><td>a897fe39b1053632</td></tr>
  <tr><th>Price (excl. tax)</th><td>51.77</td></tr>
  <tr><th>Number of reviews</th><td>0</td></tr>
```

---

## 三、采集分类列表

```python
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = 'https://books.toscrape.com/'

def get_categories(session):
    """获取所有书籍分类及其 URL"""
    response = session.get(BASE_URL)
    soup = BeautifulSoup(response.text, 'html.parser')

    categories = []
    for a in soup.select('div.side_categories ul.nav-list li ul li a'):
        name = a.get_text(strip=True)
        categories.append({
            'name': name,
            'url': urljoin(BASE_URL, a['href']),
        })
    return categories

# 测试
session = requests.Session()
categories = get_categories(session)
print(f'共找到 {len(categories)} 个分类')
# 输出：共找到 50 个分类
```

---

## 四、采集分类内的书籍列表（含翻页）

### 4.1 单页列表提取

```python
def get_books_from_list_page(session, url, category_name):
    """从列表页提取书籍基本信息和详情链接"""
    soup = fetch_page(session, url)  # fetch_page 带重试，后面定义
    if not soup:
        return [], None

    books = []
    for article in soup.select('article.product_pod'):
        title = article.select_one('h3 a')['title']
        detail_url = urljoin(url, article.select_one('h3 a')['href'])
        price = article.select_one('p.price_color').get_text(strip=True)

        # 从 class 中提取星级文字，例如 class="star-rating Three"
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

    # 获取下一页 URL
    next_btn = soup.select_one('li.next a')
    next_url = None
    if next_btn:
        base = url.rsplit('/', 1)[0] + '/'
        next_url = base + next_btn['href']

    return books, next_url
```

### 4.2 分类内翻页循环

```python
def get_all_books_in_category(session, category):
    """采集一个分类下的所有书籍列表"""
    all_books = []
    url = category['url']
    page_num = 1

    while url:
        books, next_url = get_books_from_list_page(session, url, category['name'])
        if not books:
            break
        all_books.extend(books)
        print(f'    第 {page_num} 页: {len(books)} 本（累计 {len(all_books)}）')
        url = next_url
        page_num += 1

    return all_books
```

```
  分类内翻页流程：

  ┌──────────────┐
  │  进入分类页   │
  └──────┬───────┘
         ▼
  ┌──────────────┐     ┌──────────────┐
  │  提取当前页   │────→│  存入列表     │
  │  书籍数据     │     └──────────────┘
  └──────┬───────┘
         ▼
  ┌──────────────┐     否    ┌──────────────┐
  │  有 Next 按钮 ├──────────→│  分类采集完毕  │
  └──────┬───────┘           └──────────────┘
         │ 是
         ▼
  ┌──────────────┐
  │  请求下一页   │──→ 回到"提取当前页"
  └──────────────┘
```

---

## 五、采集书籍详情页

### 5.1 提取详情数据

```python
# 星级文字 → 数字映射
RATING_MAP = {'One': 1, 'Two': 2, 'Three': 3, 'Four': 4, 'Five': 5}


def get_book_detail(session, detail_url):
    """从详情页提取完整信息"""
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

    # 解析产品信息表
    table_data = {}
    for row in soup.select('table.table-striped tr'):
        th = row.select_one('th').get_text(strip=True)
        td = row.select_one('td').get_text(strip=True)
        table_data[th] = td

    desc_tag = soup.select_one('#product_description ~ p')
    description = desc_tag.get_text(strip=True) if desc_tag else ''

    return {
        'title': title,
        'price': price_text,
        'availability': availability,
        'rating_word': rating_word,
        'rating': RATING_MAP.get(rating_word, 0),
        'upc': table_data.get('UPC', ''),
        'price_excl_tax': table_data.get('Price (excl. tax)', ''),
        'price_incl_tax': table_data.get('Price (incl. tax)', ''),
        'tax': table_data.get('Tax', ''),
        'num_reviews': table_data.get('Number of reviews', '0'),
        'description': description,
        'url': detail_url,
    }
```

### 5.2 星级转换示意

```
  网站显示          HTML class              转换结果
  ★☆☆☆☆    →    star-rating One      →    1
  ★★☆☆☆    →    star-rating Two      →    2
  ★★★☆☆    →    star-rating Three    →    3
  ★★★★☆    →    star-rating Four     →    4
  ★★★★★    →    star-rating Five     →    5
```

---

## 六、完整最终代码

下面是整合了前面所有模块的完整代码，包含请求重试、数据导出、统计分析，可直接复制运行：

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

# ==================== 配置 ====================
BASE_URL = 'https://books.toscrape.com/'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                  'AppleWebKit/537.36 (KHTML, like Gecko) '
                  'Chrome/120.0.0.0 Safari/537.36'
}
MAX_RETRIES = 3
RETRY_DELAY = 2
REQUEST_DELAY = 0.3
OUTPUT_DIR = 'output'
RATING_MAP = {'One': 1, 'Two': 2, 'Three': 3, 'Four': 4, 'Five': 5}


# ==================== 请求模块 ====================
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


# ==================== 分类采集 ====================
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


# ==================== 列表采集 ====================
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


# ==================== 详情采集 ====================
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


# ==================== 导出模块 ====================
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


# ==================== 统计模块 ====================
def print_summary(data):
    categories = {}
    for book in data:
        categories.setdefault(book.get('category', ''), []).append(book)
    ratings = [b['rating'] for b in data if b.get('rating', 0) > 0]
    avg = sum(ratings) / len(ratings) if ratings else 0
    print(f'\n{"=" * 55}')
    print(f'  采集统计')
    print(f'{"=" * 55}')
    print(f'  总书籍数: {len(data)}')
    print(f'  分类数量: {len(categories)}')
    print(f'  平均评分: {avg:.2f}')


# ==================== 主流程 ====================
def main():
    print('=' * 55)
    print('  books.toscrape.com 全站采集器')
    print(f'  开始时间: {datetime.now():%Y-%m-%d %H:%M:%S}')
    print('=' * 55)

    session = create_session()

    # 第一步：获取分类
    print('\n[1/3] 获取书籍分类...')
    categories = get_categories(session)
    print(f'  共找到 {len(categories)} 个分类')
    if not categories:
        print('  获取分类失败，退出')
        return []

    # 第二步：采集详情
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

    # 第三步：导出
    if all_books:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        print(f'\n[3/3] 导出数据...')
        save_to_csv(all_books, os.path.join(OUTPUT_DIR, f'books_{ts}.csv'))
        save_to_json(all_books, os.path.join(OUTPUT_DIR, f'books_{ts}.json'))
        print_summary(all_books)

    print(f'\n{"=" * 55}')
    print(f'  结束时间: {datetime.now():%Y-%m-%d %H:%M:%S}')
    print(f'{"=" * 55}')
    return all_books


if __name__ == '__main__':
    data = main()
```

### 代码结构总览

```
  main()
  ├── [1] get_categories()              获取 50 个分类
  ├── [2] 遍历分类 → 翻页列表 → 逐本详情
  │       get_all_books_in_category()    分类内翻页
  │       get_book_detail()              详情页提取
  ├── [3] save_to_csv() + save_to_json() 导出数据
  │       print_summary()                统计分析
  └── 辅助: create_session() / fetch_page() / RATING_MAP
```

---

## 七、运行效果

运行完整代码后，你将看到逐页采集的日志：

```
  =======================================================
    books.toscrape.com 全站采集器
    开始时间: 2026-06-01 15:00:00
  =======================================================

  [1/3] 获取书籍分类...
    共找到 50 个分类

  [2/3] 采集书籍详情...

    [1/50] 分类: Travel
      第 1 页: 1 本（累计 1）
      列表完成，共 11 本，开始采集详情...
      分类完成，总累计: 11 本

    [2/50] 分类: Mystery
      第 1 页: 20 本（累计 20）
      ...
      列表完成，共 162 本，开始采集详情...
      详情进度: 20/162
      ...
      分类完成，总累计: 173 本

    ...（省略中间分类）

  [3/3] 导出数据...
    CSV 已保存: output/books_20260601_150000.csv（共 1000 条）
    JSON 已保存: output/books_20260601_150000.json（共 1000 条，50 个分类）

    总书籍数: 1000 | 分类数量: 50 | 平均评分: 2.92

  结束时间: 2026-06-01 15:45:00
```

全站约 1000 本书。建议先用少量分类测试，确认无误后再全量运行。

---

## 八、知识回顾：三个阶段的技能串联

```
  第一阶段 Python 基础：
    变量/字典/列表 → 存储数据 | 函数/f-string → 模块化代码 | 文件读写 → 导出

  第二阶段 HTTP 与网页解析：
    requests → 发请求 | BeautifulSoup + CSS 选择器 → 解析页面
    分页处理 → li.next a | csv/json → 数据导出

  第三阶段 进阶技术：
    Session → 统一请求会话 | 重试机制 → 自动恢复
    礼貌爬取 → 请求间隔 | 多层页面 → 首页→分类→列表→详情
```

---

## 九、动手练习

### 练习一：运行完整代码

将第八节的完整代码保存为 `books_spider.py`。为了节省时间，先只采集前 3 个分类做测试：

```python
# 在 main() 中临时修改，只采集前 3 个分类
categories = categories[:3]  # 测试用
```

**检查清单：** 程序运行无报错、CSV 文件 Excel 可正常打开、JSON 按分类组织、每本书有 12 个字段。

### 练习二：添加统计分析

在 `print_summary()` 中增加以下功能：

```python
# 提示：价格字段带货币符号，需要清洗后再转数字
# price_clean = float(book['price'].replace('', '').replace('', ''))
```

1. 全站平均价格
2. 最贵和最便宜的各 5 本书
3. 每个分类的平均评分排名

### 练习三：添加断点续爬

为爬虫增加断点续爬功能：每采集完一个分类保存进度到 `progress.json`，记录已完成的分类名和已采集的数据。程序重启时检测进度文件，跳过已完成的分类，全部完成后删除进度文件。

---

## 小结

本课的核心收获：

1. **多层网站分析**：首页 → 分类 → 列表 → 详情，逐层深入
2. **分类采集**：从侧边栏 `ul.nav-list` 提取所有分类链接
3. **列表翻页**：在每个分类内用 `li.next a` 实现翻页
4. **详情提取**：从产品信息表获取 UPC、价格、税率等结构化数据
5. **星级转换**：`RATING_MAP` 将英文单词转为 1-5 数字
6. **数据组织**：CSV 扁平导出 + JSON 按分类嵌套导出
7. **健壮性**：重试机制、错误处理、`utf-8-sig` 编码

```
  项目代码结构总结：

  books_spider.py
  ├── 配置区（URL、Headers、延迟参数）
  ├── create_session()            创建请求会话
  ├── fetch_page()                带重试的页面请求
  ├── get_categories()            获取分类列表
  ├── get_books_from_list_page()  列表页书籍提取
  ├── get_all_books_in_category() 分类内翻页采集
  ├── get_book_detail()           详情页数据提取
  ├── save_to_csv() / save_to_json()  数据导出
  ├── print_summary()             统计分析
  └── main()                      主流程
```

---

## 下一课预告

恭喜你完成了第三阶段的实战项目！你现在已经能够独立完成一个多层级网站的全站采集了。接下来我们将进入 **第四阶段：Scrapy 框架与工程化**，学习使用专业的爬虫框架 Scrapy 来重构我们的代码。Scrapy 提供了请求调度、数据管道、中间件等企业级功能，能让你的爬虫更高效、更可维护。从"手工爬虫"到"工程化爬虫"，这是一个质的飞跃。我们下阶段见！
