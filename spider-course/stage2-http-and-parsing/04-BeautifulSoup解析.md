# 第四课：BeautifulSoup 解析

> **课程定位：** 第二阶段 · HTTP 与网页解析 · 第四课时
> **前置知识：** Python 基础语法、HTML 标签结构、requests 库基本用法
> **预计时长：** 55 分钟

---

**完成本课学习后，你将能够：**

1. 安装并正确导入 BeautifulSoup 库
2. 创建 BeautifulSoup 对象并选择合适的解析器
3. 使用 `find()` 和 `find_all()` 精确定位网页元素
4. 遍历 DOM 树的父子、兄弟节点关系
5. 提取标签中的文本内容和属性值
6. 使用 CSS 选择器高效选取元素
7. 处理结构不规范的 HTML 文档

---

## 一、初识 BeautifulSoup：你的网页"瑞士军刀"

### 1.1 为什么需要 BeautifulSoup？

在前端开发中，你用 JavaScript 操作 DOM 时，有 `document.getElementById()`、`document.querySelector()` 这些现成的 API。但 Python 拿到的只是一大段 HTML **字符串**——它不知道什么是标签、什么是属性、什么是嵌套关系。

**生活类比：** 想象你收到一封全是文字的信，没有任何段落分隔。BeautifulSoup 就像一个助手，帮你把信拆成段落、标注重点、理清结构。

```
┌─────────────────────────────────────────────────────┐
│  Python 爬虫的工作流程                                │
│                                                     │
│  requests 发请求  ──→  拿到 HTML 字符串               │
│                            │                        │
│                            ▼                        │
│                    BeautifulSoup 解析                │
│                            │                        │
│                            ▼                        │
│                    提取结构化数据 → 保存到文件/数据库  │
└─────────────────────────────────────────────────────┘
```

如果你之前用过正则表达式来解析 HTML，赶紧停下来！正则解析 HTML 是出了名的脆弱——标签多嵌套几层就崩了。BeautifulSoup 专门为这件事而生。

### 1.2 安装与导入

```bash
# 安装库本体和推荐的解析器
pip install beautifulsoup4 lxml
```

```python
from bs4 import BeautifulSoup
# 注意：包名是 beautifulsoup4，但导入时用 bs4
# 就像 npm 里 @babel/core，import 时用具体模块
```

### 1.3 解析器的选择

```
┌──────────────┬──────────────┬──────────────┬────────────┐
│    解析器     │    速度      │   容错性     │    推荐     │
├──────────────┼──────────────┼──────────────┼────────────┤
│  lxml        │  ★★★★★      │  ★★★★       │  ✅ 首选   │
│  html.parser │  ★★★         │  ★★★        │  无需安装   │
│  html5lib    │  ★★          │  ★★★★★      │  极烂HTML时 │
└──────────────┴──────────────┴──────────────┴────────────┘
```

```python
html = "<p>Hello <b>World</b></p>"

# ❌ 不推荐：不指定解析器，会报警告
soup = BeautifulSoup(html)

# ✅ 推荐：明确指定 lxml 解析器
soup = BeautifulSoup(html, 'lxml')
```

**生活类比：** 解析器就像翻译官。同一份文件，不同的翻译官速度和准确度不一样。`lxml` 就是那个又快又靠谱的翻译官。

---

## 二、创建 BeautifulSoup 对象

```python
from bs4 import BeautifulSoup

html_doc = """
<html>
<head><title>我的第一个网页</title></head>
<body>
    <h1 class="title">欢迎</h1>
    <div id="content">
        <p>这是第一段</p>
        <p>这是第二段，包含一个<a href="https://example.com">链接</a></p>
    </div>
    <ul class="list">
        <li>苹果</li><li>香蕉</li><li>橘子</li>
    </ul>
</body>
</html>
"""

soup = BeautifulSoup(html_doc, 'lxml')
print(soup.prettify())  # 打印格式化后的 HTML
```

从文件解析：

```python
with open("page.html", "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, 'lxml')
```

创建好 `soup` 对象后，你就拥有了一棵完整的 DOM 树：

```
┌───────────────────────────────────────────────────┐
│                    [html]                          │
│                   /      \                         │
│              [head]      [body]                    │
│                |        /   |   \                  │
│            [title]   [h1] [div]  [ul]              │
│              |         |   / \    /|\              │
│         "我的第一个" "欢迎" [p] [p] [li][li][li]    │
└───────────────────────────────────────────────────┘
```

---

## 三、查找元素：find() 与 find_all()

### 3.1 find()：找一个元素

`find()` 返回**第一个**匹配的元素，找不到返回 `None`。

```python
# 找第一个 <p> 标签
first_p = soup.find('p')
print(first_p.text)  # 输出：这是第一段

# 按 class 找（注意用 class_，因为 class 是 Python 关键字）
title = soup.find('h1', class_='title')
print(title.text)  # 输出：欢迎

# 按 id 找
content = soup.find('div', id='content')
```

**重要提醒：** `class` 是 Python 保留字，所以 BeautifulSoup 用 `class_` 来匹配 CSS 类名。

### 3.2 find_all()：找所有匹配元素

`find_all()` 返回一个**列表**，包含所有匹配的元素。找不到返回空列表 `[]`。

```python
# 找所有 <li> 标签
all_li = soup.find_all('li')
for li in all_li:
    print(li.text)
# 输出：苹果、香蕉、橘子

# 常用参数
first_two = soup.find_all('li', limit=2)           # 只找前 2 个
headings = soup.find_all(['h1', 'h2', 'h3'])       # 同时匹配多种标签
result = soup.find_all('div', attrs={'id': 'main'}) # 用 attrs 参数

# 正则匹配标签名
import re
all_h = soup.find_all(re.compile('^h'))             # 所有 h 标签
```

### 3.3 find() vs find_all() 对比

```
┌─────────────┬──────────────────────┬─────────────────────┐
│             │      find()          │     find_all()      │
├─────────────┼──────────────────────┼─────────────────────┤
│  返回值     │  单个 Tag 对象        │  列表（ResultSet）    │
│  找不到时   │  None                │  空列表 []           │
│  典型用途   │  找标题、找容器       │  遍历列表项、表格行   │
│  类比 JS    │  querySelector()     │  querySelectorAll()  │
└─────────────┴──────────────────────┴─────────────────────┘
```

---

## 四、遍历 DOM 树：父子兄弟关系

```python
# 父节点
link = soup.find('a')
print(link.parent.name)             # 输出：p

# 子节点
content_div = soup.find('div', id='content')
for child in content_div.children:  # 迭代器，节省内存
    if child.name:                  # 过滤掉纯文本节点
        print(child.name, child.text)

# 兄弟节点
first_p = soup.find('p')
# 注意：相邻兄弟之间有换行符 \n，也是节点
print(first_p.find_next_sibling('p').text)  # 直接找下一个 <p>
```

```
┌──────────────────────────────────────────────┐
│  DOM 树遍历方向示意图                          │
│                                              │
│              ┌─────┐                         │
│              │ 父亲 │  ← parent              │
│              └──┬──┘                         │
│      ┌──────────┼──────────┐                 │
│   ┌──┴──┐    ┌──┴──┐    ┌──┴──┐             │
│   │ 大哥 │    │ 我  │    │ 弟弟 │             │
│   └─────┘    └─────┘    └─────┘             │
│  ← prev_     children    → next_            │
│  sibling       ↓        sibling              │
│             (向下看)                          │
└──────────────────────────────────────────────┘
```

---

## 五、获取文本与属性

### 5.1 获取文本：三种方式

```python
tag = soup.find('p')  # 假设 <p>这是<b>第一</b>段</p>

# .text 和 .get_text() —— 获取所有子孙文本，拼在一起
print(tag.text)                       # 这是第一段
print(tag.get_text(strip=True))       # 去除前后空白（推荐）
print(tag.get_text(separator='|'))    # 用 | 分隔各段文本

# .string —— 只在子节点只有一个文本节点时有效
print(tag.string)                     # None（有嵌套的 <b>）

simple_tag = soup.find('title')
print(simple_tag.string)              # 我的第一个网页（有效）
```

```
┌──────────────────────────────────────────────────────┐
│  .text vs .string 区别                                │
│                                                      │
│  <p>这是<b>重要的</b>内容</p>                          │
│  .text    → "这是重要的内容"  （所有文本拼起来）         │
│  .string  → None             （有多个子节点）          │
│                                                      │
│  <title>简单标题</title>                              │
│  .text    → "简单标题"                                │
│  .string  → "简单标题"  （只有一个子节点，结果一样）     │
│                                                      │
│  建议：日常用 .get_text(strip=True) 就够了             │
└──────────────────────────────────────────────────────┘
```

### 5.2 获取属性

```python
link = soup.find('a')

# ❌ 危险：属性不存在时会抛 KeyError
# print(link['target'])             # KeyError!

# ✅ 安全：用 .get() 方法
print(link.get('href'))             # https://example.com
print(link.get('target'))           # None（不报错）
print(link.get('target', '_self'))  # 带默认值

# 获取所有属性（返回字典）
print(link.attrs)                   # {'href': 'https://example.com'}
```

**给前端同学的提示：** `.get()` 就像 JS 里的可选链 `?.`，属性不存在时不会报错。

---

## 六、CSS 选择器：前端同学的主场

### 6.1 select() 与 select_one()

如果你熟悉 CSS 选择器，那恭喜——这部分你已经会了 90%。

```python
# select_one() —— 等价于 document.querySelector()
title = soup.select_one('h1.title')

# select() —— 等价于 document.querySelectorAll()
items = soup.select('ul.list li')
for item in items:
    print(item.text)  # 苹果、香蕉、橘子

# 用 #id 选择器
content = soup.select_one('#content')
```

### 6.2 常用 CSS 选择器对照

```
┌─────────────────────────┬───────────────────────────────┐
│     CSS 选择器           │     BeautifulSoup 写法         │
├─────────────────────────┼───────────────────────────────┤
│  div                    │  soup.select('div')           │
│  .classname             │  soup.select('.classname')    │
│  #idname                │  soup.select('#idname')       │
│  div.class              │  soup.select('div.class')     │
│  div > p（直接子元素）    │  soup.select('div > p')      │
│  div p（所有后代）        │  soup.select('div p')        │
│  div + p（下一个兄弟）    │  soup.select('div + p')      │
│  a[href="url"]          │  soup.select('a[href="url"]') │
│  a[href^="https"]       │  soup.select('a[href^="https"]')│
│  a[href$=".pdf"]        │  soup.select('a[href$=".pdf"]') │
└─────────────────────────┴───────────────────────────────┘
```

```python
# 组合使用
results = soup.select('h1, h2, h3')               # 逗号 = "或"
links = soup.select('a[href*="example"]')          # 属性包含
files = soup.select('a[href$=".pdf"]')             # 属性结尾
```

---

## 七、实战演练：解析商品列表页

```python
from bs4 import BeautifulSoup

html = """
<div class="search-results">
    <div class="product-card" data-id="101">
        <h3 class="product-name">无线蓝牙鼠标</h3>
        <span class="price">¥ 89.00</span>
        <span class="sales">已售 2.3 万件</span>
        <a href="/product/101" class="detail-link">查看详情</a>
    </div>
    <div class="product-card" data-id="102">
        <h3 class="product-name">青轴机械键盘</h3>
        <span class="price">¥ 299.00</span>
        <span class="sales">已售 5800 件</span>
        <a href="/product/102" class="detail-link">查看详情</a>
    </div>
</div>
"""

soup = BeautifulSoup(html, 'lxml')
products = soup.select('.product-card')

for product in products:
    product_id = product.get('data-id')
    name = product.select_one('.product-name').get_text(strip=True)
    price = product.select_one('.price').get_text(strip=True)
    sales = product.select_one('.sales').get_text(strip=True)
    link = product.select_one('.detail-link').get('href')
    print(f"[{product_id}] {name} | {price} | {sales} | {link}")
```

输出：

```
[101] 无线蓝牙鼠标 | ¥ 89.00 | 已售 2.3 万件 | /product/101
[102] 青轴机械键盘 | ¥ 299.00 | 已售 5800 件 | /product/102
```

**小提示：** `select()` 和 `find_all()` 可以混用。先 `find()` 定位容器，再 `select()` 查找子元素。

---

## 八、处理不规范的 HTML

### 8.1 BeautifulSoup 的容错能力

网页上的 HTML 经常有各种问题：标签没闭合、属性没加引号、嵌套顺序错误。好消息是 BeautifulSoup + lxml 非常"宽容"。

```python
messy_html = """
<div>
    <p>第一段没有闭合标签
    <p>第二段也没有
    <span class=没有引号>内容</span>
    <img src=test.jpg>
    <b><i>嵌套顺序反了</b></i>
</div>
"""

soup = BeautifulSoup(messy_html, 'lxml')
print(soup.prettify())  # 自动修复！
```

### 8.2 编码问题处理

```python
import requests
response = requests.get("https://example.com")

# ❌ 可能乱码
soup = BeautifulSoup(response.text, 'lxml')

# ✅ 让 BeautifulSoup 自动检测编码
soup = BeautifulSoup(response.content, 'lxml')
# response.content 是 bytes 类型，BS4 会自动判断编码

# ✅ 也可以手动指定
soup = BeautifulSoup(response.content, 'lxml', from_encoding='utf-8')
```

---

## 九、动手练习

### 练习一：解析新闻列表

```python
news_html = """
<div class="news-list">
    <article class="news-item">
        <h2><a href="/news/001">Python 3.13 正式发布</a></h2>
        <span class="date">2024-10-01</span>
    </article>
    <article class="news-item">
        <h2><a href="/news/002">AI 编程助手大比拼</a></h2>
        <span class="date">2024-09-28</span>
    </article>
    <article class="news-item">
        <h2><a href="/news/003">前端框架 2024 年度报告</a></h2>
        <span class="date">2024-09-25</span>
    </article>
</div>
"""
```

要求：输出每条新闻的序号、标题、链接、发布日期。分别用 `find_all()` 和 `select()` 两种方式实现。

### 练习二：提取表格数据

```python
table_html = """
<table class="score-table">
    <thead><tr><th>姓名</th><th>语文</th><th>数学</th><th>英语</th></tr></thead>
    <tbody>
        <tr><td>小明</td><td>92</td><td>88</td><td>95</td></tr>
        <tr><td>小红</td><td>85</td><td>96</td><td>90</td></tr>
        <tr><td>小刚</td><td>78</td><td>92</td><td>86</td></tr>
    </tbody>
</table>
"""
```

要求：提取所有学生的姓名和总分，找出总分最高的学生。

### 练习三：安全获取属性

```python
link_html = """
<div class="links">
    <a href="https://python.org" target="_blank">Python 官网</a>
    <a href="/docs/guide">使用指南</a>
    <a>没有链接的 a 标签</a>
    <a href="" class="empty">空链接</a>
</div>
"""
```

要求：提取所有有效链接（href 以 http 或 / 开头）。注意处理没有 href 属性和 href 为空的情况。

---

## 十、小结

```
┌──────────────────────────────────────────────────────────┐
│  本课核心知识点回顾                                        │
│                                                          │
│  1. BeautifulSoup 需要配合解析器使用，推荐 lxml             │
│  2. find() 找一个，find_all() 找所有                       │
│  3. .get_text(strip=True) 是提取文本的最佳方式              │
│  4. .get('href') 比 ['href'] 更安全                       │
│  5. select() 支持 CSS 选择器，前端同学上手最快               │
│  6. BeautifulSoup 能自动修复不规范的 HTML                   │
│  7. class_ 带下划线，因为 class 是 Python 关键字            │
│                                                          │
│  快速记忆：                                                │
│  ┌─────────────────┬──────────────────────┐              │
│  │   你想做什么      │   用什么方法          │              │
│  ├─────────────────┼──────────────────────┤              │
│  │  找一个元素       │  find() / select_one()│             │
│  │  找多个元素       │  find_all() / select()│             │
│  │  拿文本          │  .get_text(strip=True)│             │
│  │  拿属性          │  .get('attr')         │             │
│  │  拿父/子/兄弟    │  .parent / .children  │             │
│  └─────────────────┴──────────────────────┘              │
└──────────────────────────────────────────────────────────┘
```

---

## 下一课预告

下一课我们将深入学习 **CSS 选择器与 XPath**——两种更强大的元素定位方式。你会掌握在浏览器 DevTools 中直接复制选择器/XPath 的技巧，以及如何用 lxml 的 XPath 引擎处理复杂的网页结构。对于前端同学来说，CSS 选择器部分会非常亲切；而 XPath 则会打开一扇新的大门。
