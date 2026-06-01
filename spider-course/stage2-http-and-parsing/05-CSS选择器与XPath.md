# 第五课：CSS 选择器与 XPath

> **课程定位：** 第二阶段 · HTTP 与网页解析 · 第五课时
> **前置知识：** BeautifulSoup 基础用法（第四课）、HTML 标签与属性
> **预计时长：** 60 分钟

---

**完成本课学习后，你将能够：**

1. 熟练使用各类 CSS 选择器精确定位网页元素
2. 理解 CSS 选择器在 BeautifulSoup 中的用法
3. 掌握 XPath 的基本语法和常用表达式
4. 使用 lxml.etree 执行 XPath 查询
5. 根据场景选择 CSS 选择器或 XPath
6. 从浏览器 DevTools 中复制选择器和 XPath

---

## 一、CSS 选择器深入

### 1.1 回顾：前端同学的老朋友

如果你写过 CSS 或用过 `document.querySelector()`，那 CSS 选择器你已经很熟了。BeautifulSoup 的 `select()` 方法使用完全相同的语法。

```
┌──────────────────────────────────────────────────────────┐
│  JavaScript vs BeautifulSoup 对照                        │
│                                                          │
│  // JavaScript                                           │
│  document.querySelector('.card')                         │
│  document.querySelectorAll('.card .title')               │
│                                                          │
│  # Python BeautifulSoup                                  │
│  soup.select_one('.card')                                │
│  soup.select('.card .title')                             │
│                                                          │
│  → 选择器语法完全一样！                                   │
└──────────────────────────────────────────────────────────┘
```

### 1.2 基础选择器

```python
from bs4 import BeautifulSoup

html = """
<div id="app">
    <header class="top-bar">
        <h1 class="logo">MySite</h1>
        <nav class="menu">
            <a href="/" class="nav-link active">首页</a>
            <a href="/about" class="nav-link">关于</a>
            <a href="/contact" class="nav-link">联系</a>
        </nav>
    </header>
    <main class="content">
        <section id="hero" class="section highlight">
            <h2>欢迎来到本站</h2>
            <p class="description">这是一个示例页面</p>
        </section>
        <section id="features" class="section">
            <div class="feature" data-index="1"><h3>速度快</h3></div>
            <div class="feature" data-index="2"><h3>安全可靠</h3></div>
            <div class="feature" data-index="3"><h3>易于使用</h3></div>
        </section>
    </main>
</div>
"""
soup = BeautifulSoup(html, 'lxml')

# 标签选择器
soup.select('h1')           # 所有 <h1>

# 类选择器
soup.select('.nav-link')    # 所有 class 含 nav-link 的元素

# ID 选择器
soup.select('#hero')        # id="hero" 的元素

# 标签 + 类组合
soup.select('a.nav-link')   # class 为 nav-link 的 <a> 标签
```

### 1.3 关系选择器

```
┌──────────────────────────────────────────────────────────┐
│  关系选择器示意图                                          │
│                                                          │
│           <div class="parent">                           │
│          ┌────────┼────────┐                             │
│     <span>    <div class="child">    <em>                │
│                  │                                       │
│           ┌──────┼──────┐                                │
│         <p>    <a>    <span>                             │
│                                                          │
│  div > p        直接子元素 p（只找一层）                   │
│  div p          所有后代 p（找所有层）                     │
│  div + span     div 后紧邻的 span                        │
│  div ~ em       div 之后所有的 em 兄弟                    │
└──────────────────────────────────────────────────────────┘
```

```python
soup.select('nav .nav-link')      # 后代：nav 里面所有的 .nav-link
soup.select('nav > a')            # 子元素：nav 的直接子 <a>
soup.select('.logo + nav')        # 相邻兄弟：紧跟 .logo 后面的 nav
soup.select('#hero ~ section')    # 通用兄弟：#hero 之后的所有 section
```

### 1.4 属性选择器与伪类

```python
# 属性选择器
soup.select('a[href]')              # 有 href 属性的 <a>
soup.select('a[href^="/"]')         # href 以 / 开头
soup.select('a[href$=".pdf"]')      # href 以 .pdf 结尾
soup.select('a[href*="about"]')     # href 包含 "about"
soup.select('[data-index="2"]')     # data-index 等于 2

# 伪类选择器
soup.select('li:first-child')       # 第一个子元素
soup.select('li:last-child')        # 最后一个子元素
soup.select('div.feature:nth-child(2)')  # 第 2 个子元素
soup.select('tr:nth-child(odd)')    # 奇数行
```

### 1.5 选择器组合技巧

```python
# 逗号分隔：同时匹配多种选择器（"或"）
headings = soup.select('h1, h2, h3')

# 链式调用：在结果中继续查找
for section in soup.select('section'):
    p = section.select_one('p.description')
    if p:
        print(p.get_text(strip=True))

# 多条件组合
soup.select('a.nav-link[href^="/"]')  # class + 属性同时匹配
```

---

## 二、XPath 基础：另一种强大的选择方式

### 2.1 什么是 XPath？

XPath（XML Path Language）是一种在 XML/HTML 文档中查找信息的语言。就像你在电脑上用路径找文件一样，XPath 用路径表达式在 DOM 树中找元素。

```
┌──────────────────────────────────────────────────────────┐
│  文件系统路径 vs XPath                                    │
│                                                          │
│  文件系统:  C:/Users/Desktop/file.txt                     │
│  XPath:     /html/body/div/p                              │
│                                                          │
│  都是用"路径"来定位目标！                                  │
└──────────────────────────────────────────────────────────┘
```

### 2.2 为什么要学 XPath？

```
┌─────────────────────────────┬─────────────────────────────┐
│      CSS 选择器              │         XPath                │
├─────────────────────────────┼─────────────────────────────┤
│  语法简洁，前端同学熟悉       │  功能更强大                  │
│  只能"向下"查找              │  可以向上、向下、任意方向     │
│  不能按文本内容查找          │  可以按文本内容精确匹配       │
│  不能做数值比较              │  可以用 position() 等函数    │
│  BeautifulSoup 和浏览器支持  │  lxml 原生支持，Scrapy 推荐  │
└─────────────────────────────┴─────────────────────────────┘
```

**生活类比：** CSS 选择器像"在通讯录里按分组找人"，XPath 像"按姓名、电话、地址任意条件组合找人"。

---

## 三、XPath 语法详解

### 3.1 基本路径表达式

```
┌──────────────┬──────────────────────────────────────────┐
│   表达式      │   含义                                   │
├──────────────┼──────────────────────────────────────────┤
│   /          │   从根节点开始（绝对路径）                 │
│   //         │   从当前节点选择所有匹配的节点             │
│   .          │   当前节点                                │
│   ..         │   父节点                                  │
│   @          │   选取属性                                │
└──────────────┴──────────────────────────────────────────┘
```

```python
from lxml import etree

html = """
<html><body>
    <div id="app">
        <ul class="menu">
            <li><a href="/home">首页</a></li>
            <li><a href="/news">新闻</a></li>
            <li><a href="/about">关于</a></li>
        </ul>
        <div class="content">
            <h2>最新新闻</h2>
            <article><h3>标题一</h3><p>内容一</p></article>
            <article><h3>标题二</h3><p>内容二</p></article>
        </div>
    </div>
</body></html>
"""

tree = etree.HTML(html)
```

### 3.2 常用路径表达式

```python
tree.xpath('//a')                          # 所有 <a> 标签
tree.xpath('/html/body/div')               # 绝对路径
tree.xpath('//div[@id="app"]//a')          # #app 下所有链接
tree.xpath('//ul[@class="menu"]/li')       # menu 的直接子 li
```

### 3.3 谓语（条件过滤）

```python
tree.xpath('//li[1]')                      # 第一个 li（从 1 开始！）
tree.xpath('//li[last()]')                 # 最后一个 li
tree.xpath('//li[position()<3]')           # 前两个
tree.xpath('//a[@href]')                   # 有 href 属性的 a
tree.xpath('//a[@href="/home"]')           # href 等于 /home
tree.xpath('//div[contains(@class, "content")]')  # class 包含 content
tree.xpath('//a[starts-with(@href, "/")]') # href 以 / 开头
```

### 3.4 文本相关函数

```python
tree.xpath('//h2/text()')                  # ['最新新闻']
tree.xpath('string(//div[@class="content"])')  # 所有后代文本拼接
tree.xpath('//h3[contains(text(), "标题")]')   # 文本包含"标题"
tree.xpath('//a[text()="首页"]')           # 文本精确匹配
```

```
┌──────────────────────────────────────────────────────────┐
│  text() vs string() 区别                                  │
│                                                          │
│  <div>Hello <span>World</span></div>                     │
│                                                          │
│  //div/text()      → ["Hello "]  （只取直接文本）          │
│  string(//div)     → "Hello World" （所有后代文本拼接）    │
│                                                          │
│  text() = 只看"亲生的"文本                                │
│  string() = 把全家人的文本都收集起来                      │
└──────────────────────────────────────────────────────────┘
```

### 3.5 逻辑运算与通配符

```python
# and / or
tree.xpath('//a[@class="link" and @href="/home"]')
tree.xpath('//h2 | //h3')                  # 选取所有 h2 和 h3

# not()
tree.xpath('//li[not(@class)]')            # 没有 class 的 li

# 通配符
tree.xpath('//div/*')                      # div 的所有子元素
tree.xpath('//*[@*]')                      # 有任意属性的元素
```

---

## 四、使用 lxml 执行 XPath

### 4.1 基本用法

```python
from lxml import etree

tree = etree.HTML("<div><p>Hello</p></div>")
result = tree.xpath('//p/text()')
print(result)  # ['Hello']
```

### 4.2 完整示例：解析文章列表

```python
html = """
<div class="article-list">
    <article class="post" data-id="1001">
        <h2 class="title"><a href="/post/1001">Python 装饰器</a></h2>
        <div class="meta">
            <span class="author">张三</span>
            <time class="date">2024-10-15</time>
            <span class="views">阅读 3200</span>
        </div>
        <p class="summary">装饰器是 Python 中最优雅的特性之一...</p>
    </article>
    <article class="post" data-id="1002">
        <h2 class="title"><a href="/post/1002">前端的爬虫之路</a></h2>
        <div class="meta">
            <span class="author">李四</span>
            <time class="date">2024-10-12</time>
            <span class="views">阅读 5800</span>
        </div>
        <p class="summary">从前端到爬虫，思维方式的转变...</p>
    </article>
</div>
"""

tree = etree.HTML(html)
articles = tree.xpath('//article[@class="post"]')

for article in articles:
    data_id = article.xpath('./@data-id')[0]
    title = article.xpath('.//h2/a/text()')[0]
    link = article.xpath('.//h2/a/@href')[0]
    author = article.xpath('.//span[@class="author"]/text()')[0]
    tags = article.xpath('.//span[@class="views"]/text()')[0]

    print(f"[{data_id}] {title} | {author} | {tags}")
```

注意 XPath 中的 `.` 代表"当前节点"。循环体内用 `.//` 表示"在当前文章内查找"，用 `//` 则在整个文档中查找。

### 4.3 BeautifulSoup vs lxml

```
┌──────────────────────────────────────────────────────────┐
│  BeautifulSoup vs lxml 选择                               │
│                                                          │
│  BeautifulSoup:                                          │
│    ✅ 支持 CSS 选择器 (select)                            │
│    ✅ 容错性好                                            │
│    ❌ 不直接支持 XPath                                    │
│    → 适合简单场景，前端同学友好                            │
│                                                          │
│  lxml:                                                    │
│    ✅ 原生支持 XPath                                      │
│    ✅ 速度快                                               │
│    ✅ Scrapy 默认引擎                                     │
│    → 适合复杂场景和大规模爬取                              │
│                                                          │
│  建议：简单任务用 BS4，复杂任务用 lxml                     │
└──────────────────────────────────────────────────────────┘
```

---

## 五、CSS 选择器 vs XPath：如何选择？

### 5.1 对比总结

```
┌────────────────────┬──────────────────────┬──────────────────────┐
│       能力          │    CSS 选择器         │       XPath          │
├────────────────────┼──────────────────────┼──────────────────────┤
│  向下查找后代       │  ✅ div p            │  ✅ //div//p         │
│  直接子元素        │  ✅ div > p           │  ✅ //div/p          │
│  兄弟元素          │  ✅ div + p, div ~ p  │  ✅ //div/following  │
│  按属性查找        │  ✅ [attr="val"]      │  ✅ [@attr="val"]    │
│  按文本查找        │  ❌ 不支持            │  ✅ [text()="xxx"]   │
│  向上查找父元素    │  ❌ 不支持            │  ✅ //p/parent::div  │
│  按位置查找        │  ⚠️ :nth-child()     │  ✅ [position()]     │
│  函数支持          │  ❌ 无               │  ✅ contains()等     │
│  语法简洁度        │  ✅ 更简洁            │  ⚠️ 稍冗长           │
│  学习门槛(前端)    │  ✅ 已经会了          │  ⚠️ 需要新学          │
└────────────────────┴──────────────────────┴──────────────────────┘
```

### 5.2 使用场景建议

```
┌──────────────────────────────────────────────────────────┐
│  选择器选择决策树                                          │
│                                                          │
│  需要按文本内容查找？                                      │
│    ├── 是 → 用 XPath                                      │
│    └── 否 → 需要向上查找父元素？                           │
│              ├── 是 → 用 XPath                            │
│              └── 否 → 用 CSS 选择器（前端同学已会）        │
│                                                          │
│  实际项目经验：                                            │
│  • 80% 的场景用 CSS 选择器就够了                           │
│  • 需要文本匹配或向上查找时用 XPath                        │
│  • Scrapy 项目中两种都常用                                 │
└──────────────────────────────────────────────────────────┘
```

---

## 六、DevTools 实用技巧

### 6.1 在浏览器中复制选择器

```
操作步骤：
1. 打开浏览器 DevTools（F12）
2. 用元素选择工具（左上角箭头图标）点击目标元素
3. 在 Elements 面板中右键该元素
4. 选择 "Copy" → "Copy selector"  → 得到 CSS 选择器
5. 选择 "Copy" → "Copy XPath"     → 得到 XPath 表达式
```

```
┌──────────────────────────────────────────────────────────┐
│  DevTools 复制结果示例                                     │
│                                                          │
│  Copy selector:                                          │
│    #app > main > section:nth-child(2) > div.feature      │
│                                                          │
│  Copy XPath:                                              │
│    //*[@id="app"]/main/section[2]/div[1]                 │
│                                                          │
│  ⚠️ DevTools 生成的选择器往往太精确、太冗长               │
│  → 通常需要手动简化，用更通用的 class 或结构              │
└──────────────────────────────────────────────────────────┘
```

### 6.2 在 DevTools 中测试选择器

```javascript
// 测试 CSS 选择器
document.querySelectorAll('.product-card')
document.querySelector('#main .title')

// 测试 XPath
$x('//div[@class="product-card"]')
$x('//h2/text()')
```

先在浏览器里验证选择器能选到目标元素，再写到 Python 代码里。

### 6.3 简化 DevTools 生成的选择器

```python
# DevTools 生成的（太长太脆弱）:
# #app > div.content-wrapper > div.main > section:nth-child(3) > div > h3

# 手动简化后（更通用更稳定）:
# .product-section h3
```

**原则：** 选择器越短越好，但要能唯一定位到目标。优先用 class 和语义化标签，少用层级和 `:nth-child()`。

---

## 七、实战：用 XPath 提取嵌套数据

```python
from lxml import etree

html = """
<ul class="tree">
    <li class="cat" data-id="1"><span>电子产品</span>
        <ul><li class="leaf" data-id="11"><span>iPhone</span></li>
            <li class="leaf" data-id="12"><span>Samsung</span></li></ul></li>
    <li class="cat" data-id="2"><span>图书</span>
        <ul><li class="leaf" data-id="21"><span>编程</span></li>
            <li class="leaf" data-id="22"><span>文学</span></li></ul></li>
</ul>
"""

tree = etree.HTML(html)
leaves = tree.xpath('//li[@class="leaf"]')

for leaf in leaves:
    leaf_id = leaf.xpath('./@data-id')[0]
    leaf_name = leaf.xpath('.//span/text()')[0]
    # 向上查找所属分类（XPath 独特优势！CSS 选择器做不到）
    parent = leaf.xpath('./ancestor::li[@class="cat"][1]')
    parent_name = parent[0].xpath('.//span/text()')[0] if parent else "未知"
    print(f"{parent_name} → {leaf_name} (ID: {leaf_id})")
```

输出：电子产品 → iPhone、电子产品 → Samsung、图书 → 编程、图书 → 文学。`ancestor::` 可以向上查找祖先节点。

---

## 八、动手练习

### 练习一：CSS 选择器挑战

给定一个包含导航栏和商品列表的 HTML（自行构造或参考课程示例），写出 CSS 选择器完成：
1. 选中当前激活的导航项（class 含 active）
2. 选中所有有下级菜单的链接（class 含 has-sub）
3. 选中所有打折商品的价格（class 含 sale）
4. 选中特定 data-category 下的商品链接
5. 选中在新窗口打开的链接（target="_blank"）

### 练习二：XPath 文本匹配

给定一个 FAQ 页面 HTML（包含问题和答案），用 XPath 完成：
1. 找到包含特定关键词的问题标题（用 `contains(text(), "...")`)
2. 找到答案中包含特定文本的问题
3. 用位置索引找到第 N 个问答对

### 练习三：混合使用

自行构造一个商品评论区 HTML，尝试：
1. 用 CSS 选择器定位评论列表容器
2. 用 XPath 提取用户名、评分、评论内容
3. 思考哪种选择器在这个场景下更方便

---

## 九、小结

```
┌──────────────────────────────────────────────────────────┐
│  本课核心知识点回顾                                        │
│                                                          │
│  CSS 选择器：                                              │
│  1. select() / select_one() 使用 CSS 选择器语法            │
│  2. 标签、类、ID、属性、关系选择器全覆盖                    │
│  3. 前端同学的天然优势，上手最快                            │
│                                                          │
│  XPath：                                                   │
│  1. 用 // 从任意位置开始查找                               │
│  2. 用 @ 选取属性，text() 选取文本                         │
│  3. 用 [] 做条件过滤，支持位置和逻辑运算                    │
│  4. 独特优势：可向上查找（ancestor）、按文本匹配            │
│                                                          │
│  选择策略：                                                │
│  • 简单场景 → CSS 选择器                                   │
│  • 需要文本匹配/向上查找 → XPath                           │
│  • DevTools 复制后要手动简化                               │
│                                                          │
│  常用速查：                                                │
│  ┌──────────────────┬──────────────────────────┐         │
│  │  CSS              │  XPath                   │         │
│  ├──────────────────┼──────────────────────────┤         │
│  │  div.class        │  //div[@class="class"]   │         │
│  │  #id              │  //*[@id="id"]           │         │
│  │  div > p          │  //div/p                 │         │
│  │  div p            │  //div//p                │         │
│  │  a[href="url"]    │  //a[@href="url"]        │         │
│  │  (无对应)         │  //a[text()="xxx"]       │         │
│  │  (无对应)         │  //p/..  (父元素)         │         │
│  └──────────────────┴──────────────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

---

## 下一课预告

下一课我们将学习 **分页与翻页策略**——当目标数据分布在多个页面时，如何自动翻页并采集所有内容。你会掌握 URL 参数翻页、按钮翻页、无限滚动等多种模式的处理方法，还会学到断点续爬、错误重试等实用技巧。这是从"单页爬虫"迈向"全站爬虫"的关键一步。
