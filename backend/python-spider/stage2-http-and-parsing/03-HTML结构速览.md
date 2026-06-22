# 第3课：HTML 结构速览

> **课程定位：** 第二阶段 · HTTP 与网页解析 · 第 3 课时
> **前置知识：** HTTP 协议基础、requests 库基本用法
> **预计时长：** 50 分钟

---

## 场景引入

你用 requests 成功抓取了一个网页，拿到了几千行的 HTML 文本。但看着满屏的尖括号和标签，你完全不知道目标数据藏在哪里。你想提取所有商品的名称和价格，可这些信息混杂在一堆 div、span、a 标签里，毫无规律可言。

问题的根源在于：你不理解 HTML 的结构。HTML 不是随机的文本，而是一棵有层级关系的"树"——每个标签都有自己的位置、属性和含义。只有读懂了这棵树的结构，你才能精准定位到目标数据。这一课我们就来搞清楚 HTML 到底长什么样。

---

完成本课学习后，你将能够：

1. 用建筑蓝图类比解释 HTML 的作用
2. 画出 HTML 文档的基本结构（html、head、body）
3. 说出 15 种常见 HTML 标签的用途
4. 解释 class、id、href、src、data-* 等常见属性的含义
5. 画出 DOM 树的层级结构图
6. 理解标签嵌套和父子关系
7. 使用 DevTools 的 Elements 面板检查 HTML 结构
8. 说明理解 HTML 对爬虫开发的重要性
9. 区分语义化标签和非语义化标签

---

## 一、HTML 是什么？——建筑蓝图类比

### 1.1 从一栋房子说起

如果把一个网页比作一栋房子：

```
┌─────────────────────────────────────────────────────────┐
│  一栋房子（网页）的构成                                    │
│                                                         │
│  HTML  = 建筑蓝图（结构）     → 哪里是墙、门、窗、楼梯     │
│  CSS   = 装修设计方案（样式） → 墙刷什么颜色、地板什么材质 │
│  JS    = 智能家居系统（行为） → 自动开关灯、感应门         │
│                                                         │
│  爬虫要做的：                                            │
│  读懂蓝图（HTML），找到你要的房间（数据），把东西搬走       │
└─────────────────────────────────────────────────────────┘
```

**生活类比：** HTML 就像一份快递清单——它告诉你"这个包裹里有什么东西、每样东西放在哪个位置"。你不需要关心包裹好不好看（CSS），也不需要关心怎么拆包裹（JS），你只需要知道东西在哪（HTML 结构），然后精准地取出来。

### 1.2 为什么爬虫必须懂 HTML？

```python
# 你用 requests 发了一个 GET 请求，拿到了一堆 HTML 文本：
response = requests.get("https://www.example.com")
html = response.text
# html 可能有几千行，类似：
# "<!DOCTYPE html><html><head>...</head><body><div class='product'>..."
# "<h2>iPhone 15</h2><span class='price'>7999</span></div>...</body></html>"

# 问题：怎么从几千行 HTML 中精准提取"iPhone 15"和"7999"？
# 答案：理解 HTML 的标签结构和属性，才能"定位"到目标数据
```

---

## 二、HTML 文档的基本结构

### 2.1 一个最小的 HTML 文档

```html
<!DOCTYPE html>          <!-- 声明：这是一个 HTML5 文档 -->
<html lang="zh-CN">      <!-- 根元素，所有内容都包在这里面 -->
<head>                    <!-- 头部：放给浏览器看的"元信息" -->
    <meta charset="UTF-8">
    <title>我的网页</title>
</head>
<body>                    <!-- 身体：放给用户看的"页面内容" -->
    <h1>你好，世界！</h1>
    <p>这是我的第一个网页。</p>
</body>
</html>
```

### 2.2 结构图解

```
┌─────────────────────────────────────────────┐
│  <!DOCTYPE html>                             │  ← 文档类型声明
├─────────────────────────────────────────────┤
│  <html>                                      │  ← 根元素
│  ├── <head>                                  │  ← 头部（浏览器看的）
│  │   ├── <meta charset="UTF-8">             │  ← 编码声明
│  │   ├── <title>我的网页</title>             │  ← 浏览器标签页标题
│  │   ├── <link rel="stylesheet" href="..."> │  ← 引入 CSS
│  │   └── <script src="..."></script>        │  ← 引入 JS
│  │                                           │
│  └── <body>                                  │  ← 身体（用户看的）
│      ├── <h1>标题</h1>                       │
│      ├── <p>段落</p>                         │
│      ├── <a href="...">链接</a>              │
│      ├── <img src="..." alt="...">           │
│      └── <div>容器</div>                     │
│  </html>                                     │
└─────────────────────────────────────────────┘
```

```python
# 对爬虫来说：
# <head> 里的信息可以帮助你了解页面的编码、标题等元数据
# <body> 里的信息才是你要抓取的主要内容
# 但有时候 <head> 里也有有用的 meta 标签（如 og:title、description）
```

---

## 三、常见 HTML 标签——认识"建筑材料"

### 3.1 常用标签速查表

```
┌─────────────────┬───────────────────────────────────────────────────┐
│  标签            │  用途和说明                                       │
├─────────────────┼───────────────────────────────────────────────────┤
│  <div>           │  通用容器，没有语义含义，纯用来包裹和分组          │
│  <span>          │  行内容器，通常用来包裹一小段文字做样式处理        │
│  <p>             │  段落，表示一个文本段落                            │
│  <a>             │  链接，href 属性指定目标地址                       │
│  <img>           │  图片，src 属性指定图片地址，alt 是替代文字        │
│  <h1>~<h6>       │  标题，h1 最大最重要，h6 最小                     │
│  <ul> / <ol>     │  无序列表 / 有序列表                              │
│  <li>            │  列表项，必须放在 ul 或 ol 里面                    │
│  <table>         │  表格容器                                         │
│  <tr>            │  表格行                                           │
│  <td>            │  表格单元格                                       │
│  <th>            │  表格表头单元格（加粗居中）                        │
│  <form>          │  表单容器，用来包裹输入控件                        │
│  <input>         │  输入框，type 属性决定类型（text/password/...）    │
│  <button>        │  按钮                                             │
│  <header>        │  页眉（语义化标签）                               │
│  <footer>        │  页脚（语义化标签）                               │
│  <nav>           │  导航栏（语义化标签）                             │
│  <article>       │  文章内容（语义化标签）                           │
│  <section>       │  内容分区（语义化标签）                           │
└─────────────────┴───────────────────────────────────────────────────┘
```

### 3.2 重点标签详解

```html
<!-- 1. div —— 最常用的容器 -->
<!-- 就像一个透明收纳盒，把相关的东西放在一起 -->
<div class="product-card">
    <h2>商品名称</h2>
    <p>商品描述...</p>
    <span class="price">¥99</span>
</div>

<!-- 2. a —— 超链接 -->
<!-- href 就是"跳转到哪里" -->
<a href="https://www.example.com" target="_blank">点击查看详情</a>
<!-- target="_blank" 表示在新标签页打开 -->

<!-- 3. img —— 图片 -->
<!-- src 是图片地址，alt 是图片加载失败时显示的文字 -->
<img src="photo.jpg" alt="风景照片" width="300" height="200">

<!-- 4. ul/li —— 列表 -->
<ul>
    <li>苹果</li>
    <li>香蕉</li>
    <li>橘子</li>
</ul>

<!-- 5. table —— 表格 -->
<table>
    <tr><th>姓名</th><th>年龄</th><th>城市</th></tr>  <!-- 表头行 -->
    <tr><td>张三</td><td>25</td><td>北京</td></tr>      <!-- 数据行 -->
    <tr><td>李四</td><td>30</td><td>上海</td></tr>      <!-- 数据行 -->
</table>

<!-- 6. form/input/button —— 表单 -->
<form action="/login" method="POST">
    <input type="text" name="username" placeholder="请输入用户名">
    <input type="password" name="password" placeholder="请输入密码">
    <button type="submit">登录</button>
</form>
```

```python
# 对爬虫的意义：
# <a href="...">  →  爬虫可以从这里提取链接，继续爬取更多页面
# <img src="..."> →  爬虫可以从这里提取图片地址，下载图片
# <table>         →  表格数据结构化程度高，最容易爬取
# <form>          →  爬虫可以模拟表单提交（如登录、搜索）
```

---

## 四、HTML 属性——标签的"附加信息"

### 4.1 常见属性速查

```
┌─────────────────┬───────────────────────────────────────────────────┐
│  属性            │  用途和说明                                       │
├─────────────────┼───────────────────────────────────────────────────┤
│  class           │  CSS 类名，一个元素可以有多个（空格分隔）          │
│  id              │  唯一标识符，一个页面中 id 应该是唯一的            │
│  href            │  <a> 标签的目标链接地址                           │
│  src             │  资源地址（图片、脚本、视频等）                    │
│  alt             │  图片替代文字（加载失败或屏幕阅读器使用）          │
│  title           │  鼠标悬停时显示的提示文字                         │
│  data-*          │  自定义数据属性（爬虫的重要数据来源！）            │
│  type            │  元素类型（input 的 text/password/submit 等）     │
│  name            │  表单字段名称（提交时用的 key）                    │
│  value           │  表单字段的值                                     │
│  placeholder     │  输入框的占位提示文字                             │
└─────────────────┴───────────────────────────────────────────────────┘
```

### 4.2 class 和 id——爬虫定位的核心

```html
<!-- class：可以重复使用，一个元素可以有多个 class -->
<div class="card">卡片1</div>
<div class="card">卡片2</div>
<div class="card featured">卡片3（有两个 class）</div>

<!-- id：必须唯一，一个页面只能有一个相同的 id -->
<div id="header">页面头部</div>
<div id="main-content">主要内容</div>
<div id="footer">页面底部</div>
```

```python
# 对爬虫来说，class 和 id 是定位元素的主要依据：

# 通过 class 找所有商品卡片
# CSS 选择器：.product-card
# 找到所有 class 包含 "product-card" 的元素

# 通过 id 找特定区域
# CSS 选择器：#main-content
# 找到 id 为 "main-content" 的那个唯一元素

# 后面的课程会详细教你怎么用这些选择器提取数据
```

### 4.3 data-* 自定义属性——隐藏的数据宝藏

```html
<!-- data-* 属性用来在标签上存储自定义数据 -->
<div class="product" data-id="12345" data-price="99.9" data-category="electronics">
    <h3>无线耳机</h3>
    <span>¥99.9</span>
</div>
```

```python
# 为什么 data-* 对爬虫很重要？
# 很多网站把关键数据藏在 data-* 属性里，页面上不直接显示
# 比如商品 ID、库存状态、分类信息等
# 从 data-* 取数据比解析文字更方便、更准确

# 提取方式（后面课程会详细讲）：
# element.get("data-id")       → "12345"
# element.get("data-price")    → "99.9"
```

---

## 五、DOM 树——网页的"家谱图"

### 5.1 什么是 DOM？

DOM（Document Object Model，文档对象模型）是浏览器把 HTML 解析成的一棵树形结构。每一个 HTML 标签都是树上的一个"节点"。

```
DOM 树结构图：

                        <html>
                       ╱      ╲
                  <head>       <body>
                 ╱    ╲        ╱    ╲
            <meta>  <title>  <h1>   <div>
                              │     ╱    ╲
                            "标题" <p>   <ul>
                                    │    ╱  ╲
                                  "段落" <li> <li>
                                         │    │
                                       "苹果" "香蕉"
```

### 5.2 父子、兄弟、祖先、后代

```
用一个实际的例子来理解关系：

<div id="container">            ← 祖先
    <h1>商品列表</h1>            ← container 的子节点（child）
    <div class="product">       ← container 的子节点
        <h2>iPhone 15</h2>      ← product 的子节点，container 的后代
        <p class="price">       ← product 的子节点
            ¥7999
        </p>
        <a href="/buy">购买</a>  ← product 的子节点
    </div>
</div>

关系说明：
┌──────────────┬──────────────────────────────────────┐
│  术语         │  说明                                 │
├──────────────┼──────────────────────────────────────┤
│  父节点       │  直接包裹你的那个节点                  │
│              │  <div class="product"> 的父是 container│
│  子节点       │  直接被你包裹的节点                    │
│              │  container 的子是 h1 和 product        │
│  兄弟节点     │  有同一个父节点的节点                  │
│              │  h1 和 product 是兄弟                  │
│  祖先节点     │  父节点的父节点的父节点...             │
│              │  price 的祖先是 product 和 container   │
│  后代节点     │  所有被你包裹的节点（子、孙、曾孙...）  │
│              │  container 的后代是里面所有节点         │
└──────────────┴──────────────────────────────────────┘
```

### 5.3 嵌套规则

```html
<!-- ✅ 正确：先开后关，后开先关 -->
<div>
    <p><span>文字</span></p>
</div>

<!-- ❌ 错误：交叉嵌套 -->
<div><p><span>文字</p></span></div>
<!-- p 先关了但 span 还没关，结构就乱了 -->

# 记忆口诀："先开后关，后开先关"
# 就像叠放碗碟——先放的在最下面，取的时候先取最上面的
```

---

## 六、语义化标签 vs 非语义化标签

### 6.1 什么是语义化？

```
┌─────────────────────────────────────────────────────────────────┐
│  非语义化（div + span 打天下）                                    │
│                                                                 │
│  <div id="header">                                              │
│      <div class="nav">...</div>                                 │
│  </div>                                                         │
│  <div id="content">                                             │
│      <div class="article">...</div>                             │
│  </div>                                                         │
│  <div id="footer">...</div>                                     │
│                                                                 │
│  问题：到处都是 div，看不出哪里是什么                              │
├─────────────────────────────────────────────────────────────────┤
│  语义化（用有意义的标签）                                         │
│                                                                 │
│  <header>                                                       │
│      <nav>...</nav>                                             │
│  </header>                                                      │
│  <main>                                                         │
│      <article>...</article>                                     │
│  </main>                                                        │
│  <footer>...</footer>                                           │
│                                                                 │
│  优点：一眼就能看出页面结构                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 常见语义化标签

```
┌─────────────────┬──────────────────────────────────────────┐
│  语义化标签       │  含义                                    │
├─────────────────┼──────────────────────────────────────────┤
│  <header>        │  页面或区块的头部                         │
│  <footer>        │  页面或区块的底部                         │
│  <nav>           │  导航链接区域                             │
│  <main>          │  页面的主要内容（一个页面只有一个）       │
│  <article>       │  独立的内容块（文章、博客帖子、评论等）   │
│  <section>       │  内容的主题分区                           │
│  <aside>         │  侧边栏或与主内容关联不大的内容           │
│  <figure>        │  独立的媒体内容（图、表、代码等）         │
│  <figcaption>    │  figure 的标题                           │
│  <time>          │  日期/时间                                │
│  <mark>          │  高亮/标记的文字                          │
└─────────────────┴──────────────────────────────────────────┘

# 对爬虫来说：语义化标签能帮你更精准地定位数据
# 比如 <article> 一找一个准，而 <div class="content"> 可能匹配到好几个
# 但现实是很多网站不用语义化标签，两种情况都要会处理
```

---

## 七、用 DevTools 检查 HTML 结构

### 7.1 打开 Elements 面板

```
操作步骤：
1. 打开 Chrome 浏览器
2. 按 F12 打开 DevTools
3. 点击 "Elements"（元素）标签
4. 你会看到当前页面的完整 HTML 源码
5. 鼠标悬停在某个标签上，页面中对应的元素会高亮
6. 点击标签前的三角箭头 ▶ 可以展开/折叠子节点
```

### 7.2 Elements 面板详解

```
┌─────────────────────────────────────────────────────────────┐
│  Elements 面板                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  左侧：DOM 树                                               │
│  ┌──────────────────────────────────────────────┐          │
│  │ ▼ <html lang="zh-CN">                         │          │
│  │   ▼ <head>                                    │          │
│  │     <meta charset="UTF-8">                   │          │
│  │     <title>商品列表</title>                   │          │
│  │   ▶ <body>                                    │          │
│  │     ▼ <div class="product-card">             │          │
│  │       <h2 class="product-name">iPhone 15</h2>│          │
│  │       <span class="price">¥7999</span>       │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  右侧：选中元素的样式、属性、事件监听器等信息                  │
│  可以查看 computed 样式、修改属性值实时预览                    │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 常用调试技巧

```
技巧1：快速定位元素 → 右键页面元素 → "检查" → 自动跳转到对应 HTML
技巧2：复制 CSS 选择器 → 右键标签 → Copy → Copy selector
技巧3：复制 XPath → 右键标签 → Copy → Copy XPath
技巧4：修改 HTML 实时预览 → 双击标签/文字直接修改（仅本地，刷新恢复）
技巧5：搜索内容 → Elements 面板中按 Ctrl+F，可搜文字、标签名、class
```

```python
# 🔥 爬虫开发的标准流程：
# 1. 在浏览器中找到你要抓的数据
# 2. 右键 → 检查，定位到对应的 HTML 标签
# 3. 观察它的标签名、class、id、data-* 等属性
# 4. 总结规律（比如所有商品都有 class="product-card"）
# 5. 写 Python 代码，用选择器提取所有匹配的元素
# 这个流程后面课程会反复练习
```

---

## 八、一个完整的 HTML 实例分析

### 8.1 实际网页结构（精简示例）

```html
<!-- 一个商品列表页面的核心结构 -->
<header class="site-header">
    <nav class="main-nav">
        <ul>
            <li><a href="/home">首页</a></li>
            <li><a href="/products">商品</a></li>
        </ul>
    </nav>
</header>

<main class="content">
    <h1>热门商品</h1>
    <div class="product-list">
        <!-- 商品卡片 1 -->
        <div class="product-card" data-id="1001" data-category="phone">
            <img src="/images/iphone15.jpg" alt="iPhone 15">
            <h2 class="product-name">iPhone 15</h2>
            <p class="product-desc">苹果最新款智能手机</p>
            <span class="price">¥7999</span>
            <a href="/product/1001" class="btn-detail">查看详情</a>
        </div>
        <!-- 商品卡片 2、3 结构完全相同，只是数据不同 -->
        <!-- ... -->
    </div>
</main>

<footer class="site-footer">
    <p>&copy; 2026 示例商城</p>
</footer>
```

### 8.2 爬虫视角分析

```python
# 从爬虫角度，我们需要关注的信息：

# 1. 商品信息在 class="product-card" 的 div 里
#    → 选择器：.product-card（每个商品一个 div，结构相同）

# 2. 商品名称在 class="product-name" 的 h2 里
#    → 选择器：.product-name → "iPhone 15"、"MacBook Pro" 等

# 3. 价格在 class="price" 的 span 里
#    → 选择器：.price → "¥7999"、"¥14999" 等

# 4. 商品 ID 在 data-id 属性里
#    → 选择器：[data-id] → "1001"、"1002" 等

# 5. 详情页链接在 class="btn-detail" 的 a 标签的 href 里
#    → 选择器：a.btn-detail → "/product/1001" 等

# 6. 图片地址在 img 标签的 src 属性里
#    → 选择器：.product-card img → "/images/iphone15.jpg" 等

# 发现规律了吗？所有商品卡片结构一模一样
# 这就是爬虫最喜欢的数据格式——重复结构 = 批量提取
```

### 8.3 DOM 树图解

```
<body>
├── <header class="site-header">
│   └── <nav class="main-nav">
│       └── <ul>
│           ├── <li><a href="/home">首页</a></li>
│           └── <li><a href="/products">商品</a></li>
│
├── <main class="content">
│   ├── <h1>热门商品</h1>
│   └── <div class="product-list">
│       ├── <div class="product-card" data-id="1001">  ← ★ 要抓的
│       │   ├── <img src="iphone15.jpg">               ← ★ 图片
│       │   ├── <h2 class="product-name">iPhone 15</h2>← ★ 商品名
│       │   ├── <span class="price">¥7999</span>       ← ★ 价格
│       │   └── <a href="/product/1001">查看详情</a>    ← ★ 链接
│       │
│       ├── <div class="product-card" data-id="1002">  ← 结构相同
│       │   └── ...
│       │
│       └── <div class="product-card" data-id="1003">  ← 结构相同
│           └── ...
│
└── <footer class="site-footer">
    └── <p>© 2026 示例商城...</p>
```

每个 `.product-card` 的内部结构完全一致，这就是爬虫批量提取的基础。

---

## 九、动手练习

### 练习1：用 DevTools 分析真实网页

```
目标：用 Elements 面板分析一个真实网页的结构
步骤：
1. 打开 https://news.ycombinator.com（Hacker News）
2. 按 F12 → Elements 面板，找到新闻标题的 HTML 标签
3. 记录：标题用什么标签？有什么 class/id？链接在哪个属性里？
4. 总结：所有新闻标题是否用了相同的标签和 class？
```

### 练习2：画出一个页面的 DOM 树

```
目标：手动画出一个简单页面的 DOM 树
步骤：
1. 打开 https://example.com（页面非常简单）
2. 在 Elements 面板中展开所有节点
3. 画出 DOM 树结构，标注标签名和 class/id
4. 要求至少画到 3 层嵌套深度
```

### 练习3：定位目标数据

```
目标：模拟爬虫开发的"定位"流程
步骤：
1. 打开 https://quotes.toscrape.com（练习爬虫用的网站）
2. 用 DevTools 找到每一条名言（quote）的 HTML 结构
3. 记录：名言文字、作者名、标签分别用什么标签和 class？
4. 思考：要提取所有名言，用什么选择器？
5. 额外挑战：找到"下一页"按钮的 href
```

---

## 常见误区

- **以为 class 是唯一的。** class 可以被多个元素共用，一个元素也可以有多个 class（空格分隔）。爬虫中用 class 定位时，可能匹配到多个元素，需要结合标签名或其他属性缩小范围。
- **忽略 data-* 属性。** 很多网站把关键数据（商品 ID、库存状态、分类信息）藏在 `data-*` 属性里，页面上不直接显示。只看文本内容会漏掉这些"隐藏宝藏"。
- **分不清 parent/child/sibling 关系。** DOM 树的层级关系是后续 BeautifulSoup 和 XPath 解析的基础。搞混父子兄弟关系，写出来的选择器就会选错元素。
- **把 DevTools 显示的 HTML 等同于源代码。** DevTools Elements 面板显示的是浏览器渲染后的 DOM（JavaScript 可能已经修改过），和你用 requests 拿到的源代码可能不一样。要获取原始 HTML，应该看 Network 面板的 Response。

---

## 工程建议

- **用 DevTools 右键"检查"定位元素，再用 Ctrl+F 搜索验证选择器。** 在 Elements 面板中按 Ctrl+F，可以搜索文字、标签名、class 名，快速确认你的选择器是否能匹配到目标元素。
- **优先用 class 和语义化标签定位，少依赖层级和位置。** class 和语义化标签（article、nav、header）更稳定，网页改版时不容易失效；而依赖父子层级的选择器稍微改一下结构就断了。
- **养成画 DOM 树草图的习惯。** 遇到复杂页面时，先在纸上画出目标数据的 DOM 结构，标注标签名、class、id，再写代码。这比直接看代码猜结构高效得多。
- **注意 HTML 编码声明。** 用 requests 抓取页面后，先检查 `<meta charset="UTF-8">` 或响应头中的编码信息，确保用正确的编码解析 HTML，否则中文会变成乱码。

---

## 小结

本课的核心知识点：

1. **HTML 是网页的"骨架"**，爬虫的核心任务就是从 HTML 中提取数据
2. **文档结构**：`<!DOCTYPE html>` → `<html>` → `<head>`（元信息）+ `<body>`（页面内容）
3. **常见标签**：div、span、p、a、img、h1-h6、ul/ol/li、table/tr/td/th、form/input/button
4. **class 和 id 是爬虫定位元素的核心依据**，class 可重复，id 必须唯一
5. **data-\* 属性是隐藏的数据宝藏**，很多网站把关键数据存在这里
6. **DOM 树的父子、兄弟、祖先、后代关系**是解析 HTML 的基础
7. **嵌套规则：先开后关，后开先关**
8. **语义化标签**（header、nav、article、section 等）能帮你更精准地定位数据
9. **DevTools Elements 面板**是分析 HTML 结构的利器，右键"检查"是最常用的入口

> **前端开发者的优势：** 你已经天天和 HTML 打交道了。现在你只需要把视角从"写 HTML"切换到"读 HTML、找数据"——你对标签、属性、DOM 结构的理解，会让你在爬虫开发中比纯后端开发者更有优势。

---

## 下一课预告

下一课我们将正式学习如何用 Python 解析 HTML——用 BeautifulSoup 库把上一课学到的 HTML 知识转化为实际的数据提取能力。你会学会用 CSS 选择器、find/find_all 方法精准定位 HTML 元素，并提取其中的文字、属性和链接。有了 HTML 结构的基础知识，下一课的学习将会非常顺畅。

---

## 参考答案

### 练习一

**思路**：用 DevTools 的 Elements 面板检查 Hacker News 的 HTML 结构，找到新闻标题对应的标签、class/id 和链接属性。

**答案**：

操作步骤：
1. 打开 https://news.ycombinator.com，按 F12 打开 DevTools
2. 点击左上角的元素选择工具，点击任意一条新闻标题
3. 在 Elements 面板中观察，会发现结构类似：

```html
<tr class="athing" id="40412345">
    <td class="title">
        <span class="rank">1.</span>
        <span class="titleline">
            <a href="https://example.com/article">新闻标题文字</a>
            <span class="sitebit comhead"> (<a href="from?site=example.com">example.com</a>)</span>
        </span>
    </td>
</tr>
```

观察结论：
- 每条新闻是一个 `<tr class="athing">` 元素，有唯一的 `id` 属性
- 标题链接在 `<span class="titleline">` 内的 `<a>` 标签中
- 链接地址在 `<a>` 标签的 `href` 属性中
- 所有新闻标题使用了相同的标签结构和 class，可以批量提取

**要点**：
- class="athing" 和 class="titleline" 是批量定位的关键
- 链接可能是外部链接（href 直接是 URL）或内部链接（href 是相对路径）
- Hacker News 结构简洁，是练习 HTML 分析的好靶场

### 练习二

**思路**：用 DevTools 展开 example.com 的所有节点，按照父子关系逐层画出 DOM 树。

**答案**：

example.com 的 DOM 树结构（简化版）：

```
<!DOCTYPE html>
└── <html>
    ├── <head>
    │   ├── <meta charset="utf-8">
    │   ├── <title>Example Domain</title>
    │   └── <style>...</style>
    └── <body>
        ├── <h1>Example Domain</h1>
        ├── <p>此域名用于说明文档中的示例...</p>
        └── <p>
            └── <a href="https://www.iana.org/domains/example">更多信息...</a>
        </p>
    </body>
</html>
```

层级说明：
- 第1层：`<html>` 是根元素
- 第2层：`<head>` 和 `<body>` 是 html 的直接子节点
- 第3层：`<h1>`、`<p>` 是 body 的直接子节点
- 第4层：`<a>` 是 `<p>` 的子节点

**要点**：
- example.com 结构非常简单，适合练习画 DOM 树
- 注意区分 head（元信息）和 body（页面内容）
- 嵌套深度从根节点开始计算，html 是第 0 层或第 1 层

### 练习三

**思路**：在 quotes.toscrape.com 上用 DevTools 定位名言、作者和标签的 HTML 结构，总结选择器规律。

**答案**：

HTML 结构分析：

```html
<div class="quote">
    <span class="text" content="true">"The world as we have created it is a process of our thinking..."</span>
    <span>by <small class="author">Albert Einstein</small></span>
    <div class="tags">
        Tags:
        <a class="tag" href="/tag/change/page/1/">change</a>
        <a class="tag" href="/tag/deep-thoughts/page/1/">deep-thoughts</a>
    </div>
</div>
```

定位总结：
- 名言文字：`.text`（class="text" 的 span）
- 作者名：`.author`（class="author" 的 small 标签）
- 标签：`.tag`（class="tag" 的 a 标签）
- 每条名言容器：`.quote`（class="quote" 的 div）
- 下一页按钮：`li.next > a`（class="next" 的 li 内的 a 标签，href 属性是下一页地址）

**要点**：
- quotes.toscrape.com 是专门为爬虫练习设计的网站，结构清晰规律
- 所有名言卡片结构一致，可以用 `.quote` 批量定位
- "下一页"按钮的 href 是相对路径，需要拼接 base_url
- class 是最常用的定位依据，语义化标签（如 article）能更精准定位
