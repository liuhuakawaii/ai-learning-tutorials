# 第2课：Playwright 入门

> **课程定位：** 第三阶段 · 动态网页与反爬 · 第 2 课时
> **前置知识：** 动态渲染原理、requests 库使用、Python 基础语法
> **预计时长：** 60 分钟

---

## 场景引入

上一课你明白了动态网页的原理——数据由 JavaScript 渲染，requests 只能拿到空壳。那怎么办？总不能每次都手动打开浏览器复制粘贴吧。你需要一个"自动化助手"：它能帮你启动浏览器、打开网页、等 JS 执行完、把渲染后的内容交给你。这就是浏览器自动化工具做的事情。市面上有 Selenium、Puppeteer、Playwright 等选择，该学哪个？怎么装？怎么用？这节课从零开始搞定它。

---

## 学习目标

完成本课学习后，你将能够：

1. 说明为什么选择 Playwright 而不是 Selenium
2. 安装 Playwright 并下载浏览器二进制文件
3. 用 sync_playwright 启动 Chromium 浏览器
4. 打开页面、导航到指定 URL
5. 获取渲染后的完整页面内容
6. 使用等待机制确保元素加载完成
7. 在 headless 和 headed 模式之间切换
8. 对元素进行点击、填写、输入等交互操作
9. 截取页面截图
10. 正确关闭浏览器释放资源

---

## 一、为什么选 Playwright？

### 1.1 浏览器自动化工具对比

```
Python 浏览器自动化工具对比：

┌──────────────┬──────────┬──────────┬──────────┬──────────────┐
│  工具         │  年代     │  速度     │  API 设计 │  维护状态     │
├──────────────┼──────────┼──────────┼──────────┼──────────────┤
│  Selenium     │  2004    │  ★★★☆☆  │  ★★★☆☆  │  持续维护     │
│  Puppeteer    │  2017    │  ★★★★☆  │  ★★★★☆  │  仅 JS/Node  │
│  Playwright ★ │  2020    │  ★★★★★  │  ★★★★★  │  微软积极维护 │
│  requests-html│  2018    │  ★★★☆☆  │  ★★★☆☆  │  基本停更     │
└──────────────┴──────────┴──────────┴──────────┴──────────────┘

Playwright 的核心优势：
  ✅ 原生支持 Chromium、Firefox、WebKit 三大引擎
  ✅ 自动等待机制（不用手动写 sleep/wait）
  ✅ 支持同步和异步两种 API
  ✅ 内置截图、录屏、网络拦截功能
  ✅ 微软维护，更新频繁，文档完善
```

**生活类比：** 如果 Selenium 是手动挡老式汽车（功能齐全但操作繁琐），Puppeteer 是电动自行车（轻便但只能跑一种路），那 Playwright 就是新款电动汽车——速度快、操作简单、还能适应各种路况（支持多种浏览器）。

### 1.2 Playwright vs Selenium 代码对比

```python
# ── Selenium 写法（步骤多，容易出错） ──
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = webdriver.Chrome()
driver.get("https://example.com")
# 手动等待元素出现
element = WebDriverWait(driver, 10).until(
    EC.presence_of_element_located((By.CSS_SELECTOR, ".product-list"))
)
print(element.text)
driver.quit()  # 别忘了关闭！


# ── Playwright 写法（简洁直观） ──
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")
    # 自动等待！不需要手动写 WebDriverWait
    page.wait_for_selector(".product-list")
    print(page.query_selector(".product-list").inner_text())
    browser.close()  # 或者用 with 语句自动关闭
```

### 1.3 前端开发者看 Playwright

```
你可能已经熟悉的工具：           Playwright 的对应关系：

  Puppeteer (Node.js)      →    Playwright 是同一作者的新作品
                                API 设计非常相似

  document.querySelector() →    page.query_selector()
  element.textContent      →    element.inner_text()
  element.click()          →    element.click()
  page.waitForSelector()   →    page.wait_for_selector()
  page.screenshot()        →    page.screenshot()

  核心区别：Puppeteer 只支持 Chromium，Playwright 支持三大引擎
```

---

## 二、安装 Playwright

### 2.1 安装 Python 包

```bash
# 第一步：安装 Playwright 的 Python 包
pip install playwright

# 第二步：下载浏览器二进制文件（这一步很重要！）
playwright install

# 这个命令会下载 Chromium、Firefox、WebKit 三个浏览器
# 下载文件比较大（几百 MB），第一次需要等一会儿
# 之后不需要再下载

# 如果只需要 Chromium，可以只下载一个（更快）：
playwright install chromium

# 验证安装是否成功
python -c "from playwright.sync_api import sync_playwright; print('安装成功！')"
```

```
安装过程示意图：

  pip install playwright
         │
         ▼
  ┌─────────────────────────────────┐
  │  安装 Python 包                  │
  │  playwright-x.x.x               │
  │  下载的是"遥控器"                │
  └──────────────┬──────────────────┘
                 │
                 ▼
  playwright install
                 │
                 ▼
  ┌─────────────────────────────────┐
  │  下载浏览器二进制文件             │
  │  ├── chromium-xxxx/             │ ← 约 200MB
  │  ├── firefox-xxxx/              │ ← 约 200MB
  │  └── webkit-xxxx/               │ ← 约 100MB
  │  下载的是"遥控器要控制的机器"    │
  └─────────────────────────────────┘

  两者缺一不可！
  只装包不装浏览器 → 程序会报错：BrowserType.launch: Executable doesn't exist
```

### 2.2 三种浏览器引擎

```
┌──────────────┬──────────────────────────────────────────────┐
│  浏览器引擎   │  说明                                         │
├──────────────┼──────────────────────────────────────────────┤
│  Chromium    │  基于 Google Chrome，最常用                    │
│             │  和你平时用的 Chrome 几乎一样                   │
│             │  推荐作为默认选择                               │
├──────────────┼──────────────────────────────────────────────┤
│  Firefox     │  Mozilla 的浏览器                              │
│             │  适合做跨浏览器兼容性验证                       │
│             │  可用于排查不同渲染引擎下的页面差异             │
├──────────────┼──────────────────────────────────────────────┤
│  WebKit      │  Apple Safari 的内核                           │
│             │  可以模拟 Safari 浏览器环境                     │
│             │  较少使用                                      │
└──────────────┴──────────────────────────────────────────────┘

  绝大多数情况下，用 Chromium 就够了。
  如果页面在不同浏览器中表现不一致，可以用 Firefox 或 WebKit 做兼容性排查。
```

---

## 三、启动浏览器——Hello Playwright

### 3.1 最简单的示例

```python
from playwright.sync_api import sync_playwright

# sync_playwright 是同步版本的入口
# 如果你熟悉 async/await，也可以用 async_playwright
with sync_playwright() as p:
    # ① 启动浏览器（默认 headless 模式）
    browser = p.chromium.launch()

    # ② 创建一个新页面（就像浏览器里开了一个新标签页）
    page = browser.new_page()

    # ③ 导航到目标 URL
    page.goto("https://quotes.toscrape.com")

    # ④ 获取页面标题
    print(f"页面标题: {page.title()}")

    # ⑤ 获取渲染后的完整 HTML
    html = page.content()
    print(f"HTML 长度: {len(html)} 字符")

    # ⑥ 关闭浏览器
    browser.close()
```

```
程序执行流程：

  Python 脚本
       │
       ▼
  ┌─────────────────┐
  │  launch()       │  启动 Chromium 浏览器进程
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  new_page()     │  打开一个新标签页
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  goto(url)      │  浏览器访问指定 URL
  │                 │  （等待页面加载完成）
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  page.content() │  获取渲染后的完整 HTML
  │                 │  （JS 已经执行完毕！）
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  browser.close()│  关闭浏览器进程
  └─────────────────┘
```

### 3.2 用 with 语句自动管理资源

```python
from playwright.sync_api import sync_playwright

# ❌ 不推荐：手动管理，容易忘记关闭
p = sync_playwright().start()
browser = p.chromium.launch()
page = browser.new_page()
page.goto("https://example.com")
# 如果中间出异常，下面的代码不会执行，浏览器进程就泄漏了
browser.close()
p.stop()

# ✅ 推荐：用 with 语句，自动关闭
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")
    # 无论是否出异常，with 块结束时都会自动清理
    browser.close()
```

**生活类比：** `with` 语句就像酒店的自动退房——你不需要记得去前台退房卡，离开房间时系统自动帮你处理。`with sync_playwright()` 保证浏览器进程不会因为你的疏忽而残留在内存里。

---

## 四、Headless vs Headed 模式

### 4.1 两种模式的区别

```
┌──────────────┬────────────────────────┬────────────────────────┐
│  对比项       │  Headless 模式         │  Headed 模式           │
├──────────────┼────────────────────────┼────────────────────────┤
│  是否显示窗口 │  不显示（后台运行）     │  显示浏览器窗口         │
│  速度         │  更快                  │  较慢                  │
│  资源占用     │  更少                  │  更多                  │
│  适用场景     │  生产环境/批量爬取      │  开发调试/观察行为      │
│  默认行为     │  Playwright 默认       │  需要手动开启           │
└──────────────┴────────────────────────┴────────────────────────┘
```

### 4.2 切换模式

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    # ── Headless 模式（默认，不显示窗口）──
    browser = p.chromium.launch(headless=True)
    # headless=True 是默认值，可以省略

    # ── Headed 模式（显示浏览器窗口，方便调试）──
    browser = p.chromium.launch(headless=False)
    # 你会看到一个浏览器窗口弹出来，自动化操作在窗口中实时执行

    page = browser.new_page()
    page.goto("https://quotes.toscrape.com")

    # 在 headed 模式下，你可以看到：
    # - 页面加载过程
    # - 元素高亮
    # - 自动滚动
    # - 点击操作
    # 非常适合调试！

    browser.close()
```

**生活类比：** Headless 模式就像后台播放视频——程序在默默干活，你看不到过程，但结果是一样的。Headed 模式就像前台播放——你能看到每一步在做什么，方便排查问题。

> **调试技巧：** 开发阶段用 headed 模式观察自动化行为是否正确，确认无误后切换到 headless 模式提高效率。

---

## 五、页面导航与内容获取

### 5.1 导航到 URL

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()

    # ── 基本导航 ──
    page.goto("https://quotes.toscrape.com")
    # goto() 会等待页面"加载完成"（默认等到 load 事件触发）

    # ── 带超时的导航 ──
    page.goto("https://example.com", timeout=30000)  # 最多等 30 秒（单位：毫秒）

    # ── 等待不同的加载状态 ──
    page.goto("https://example.com", wait_until="domcontentloaded")
    # wait_until 选项：
    # "load"              → 默认，等待 load 事件（图片等资源加载完）
    # "domcontentloaded"  → 等待 DOM 解析完成（更快）
    # "networkidle"       → 等待网络空闲（所有请求完成）
    # "commit"            → 等待收到第一个字节（最快）

    browser.close()
```

### 5.2 获取页面内容

```python
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://quotes.toscrape.com/js/")
    # 注意：这个页面是 JS 渲染的，requests 拿不到内容
    # 但 Playwright 可以！

    # ── 获取完整 HTML ──
    full_html = page.content()
    # 返回渲染后的完整 HTML（JS 已经执行完毕）
    # 可以用 BeautifulSoup 解析
    soup = BeautifulSoup(full_html, "html.parser")
    quotes = soup.select(".quote .text")
    for q in quotes:
        print(q.text)

    # ── 获取页面标题 ──
    title = page.title()
    print(f"标题: {title}")

    # ── 获取当前 URL ──
    print(f"当前 URL: {page.url}")
    # 如果页面发生了重定向，这里显示的是最终的 URL

    browser.close()
```

### 5.3 用 CSS 选择器直接提取文本

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://quotes.toscrape.com/js/")

    # ── 选择单个元素 ──
    element = page.query_selector(".quote .text")
    if element:
        print(element.inner_text())  # 获取元素的文本内容

    # ── 选择多个元素 ──
    elements = page.query_selector_all(".quote .text")
    for el in elements:
        print(el.inner_text())

    # ── 获取元素的属性值 ──
    link = page.query_selector(".quote a")
    if link:
        href = link.get_attribute("href")
        print(f"链接: {href}")

    # ── inner_text vs inner_html vs text_content ──
    el = page.query_selector(".quote")
    if el:
        print(el.inner_text())     # 可见文本（类似 JS 的 innerText）
        print(el.inner_html())     # 内部 HTML（类似 innerHTML）
        print(el.text_content())   # 所有文本内容（包括隐藏的）

    browser.close()
```

```
三种文本获取方法的区别：

  假设元素是：<div class="quote">
                <span class="text">"Life is short"</span>
                <span style="display:none">隐藏内容</span>
              </div>

  ┌────────────────┬──────────────────────────────────────┐
  │  方法           │  返回内容                             │
  ├────────────────┼──────────────────────────────────────┤
  │  inner_text()  │  "Life is short"                     │
  │               │  （只返回可见文本，不含隐藏元素）       │
  ├────────────────┼──────────────────────────────────────┤
  │  inner_html()  │  <span class="text">"Life is short"  │
  │               │  </span><span style="display:none">   │
  │               │  隐藏内容</span>                       │
  │               │  （返回内部的完整 HTML）                │
  ├────────────────┼──────────────────────────────────────┤
  │  text_content()│  "Life is short隐藏内容"              │
  │               │  （返回所有文本，包括隐藏元素的）       │
  └────────────────┴──────────────────────────────────────┘

  爬虫中常用 inner_text()——它返回的就是用户在页面上能看到的文字。
```

---

## 六、等待机制——Playwright 的杀手锏

### 6.1 为什么需要等待？

```
动态页面的加载是"渐进式"的：

  时间线：
  ─────┼──────┼──────┼──────┼──────┼──────→ 时间
       │      │      │      │      │
    页面开始  HTML   JS 文件  API    数据渲染
    加载     解析完  下载完   返回    到页面

  问题：你在哪个时间点提取数据？
  - 太早：数据还没渲染到页面上
  - 太晚：浪费时间

  Playwright 的解决方案：智能等待
  - 自动等待元素出现在 DOM 中
  - 自动等待元素变为可见
  - 自动等待元素可以交互
```

### 6.2 wait_for_selector() 等待特定元素

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://spa5.scrape.center/")

    # ── 等待特定选择器的元素出现 ──
    page.wait_for_selector(".book-item")
    # Playwright 会一直等到页面上出现 .book-item 元素
    # 默认超时 30 秒

    # ── 带超时的等待 ──
    page.wait_for_selector(".book-item", timeout=10000)  # 最多等 10 秒

    # ── 等待元素可见 ──
    page.wait_for_selector(".book-item", state="visible")
    # state 选项：
    # "attached"  → 元素出现在 DOM 中（不管是否可见）
    # "visible"   → 元素可见（默认）
    # "hidden"    → 元素隐藏
    # "detached"  → 元素从 DOM 中移除

    # 等待之后再提取数据
    items = page.query_selector_all(".book-item")
    for item in items:
        title = item.query_selector("h2")
        if title:
            print(title.inner_text())

    browser.close()
```

**生活类比：** `wait_for_selector()` 就像在餐厅等位——你告诉服务员"有空位了叫我"（等待选择器出现），然后你可以安心玩手机，不用一直盯着看。Playwright 会在元素出现的那一刻通知你的代码继续执行。

### 6.3 等待页面加载状态

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()

    page.goto("https://example.com", wait_until="domcontentloaded")

    # ── 等待网络空闲 ──
    page.wait_for_load_state("networkidle")
    # 等待所有网络请求完成（500ms 内没有新的网络请求）
    # 适合等待 AJAX 数据加载完成

    # ── 等待 DOM 解析完成 ──
    page.wait_for_load_state("domcontentloaded")

    # ── 等待所有资源加载完 ──
    page.wait_for_load_state("load")

    browser.close()
```

```
三种加载状态的对比：

  ┌───────────────────┬────────────────────────────────────────┐
  │  加载状态          │  触发时机                               │
  ├───────────────────┼────────────────────────────────────────┤
  │  domcontentloaded │  HTML 解析完成，DOM 树构建完毕           │
  │                   │  此时 JS 可以操作 DOM 了                 │
  │                   │  图片等外部资源可能还没加载完            │
  ├───────────────────┼────────────────────────────────────────┤
  │  load             │  页面所有资源加载完成（图片、CSS、字体）  │
  │                   │  window.onload 事件触发                  │
  │                   │  但 AJAX 请求可能还在进行中              │
  ├───────────────────┼────────────────────────────────────────┤
  │  networkidle      │  500ms 内没有任何网络请求                │
  │                   │  说明页面"安静下来"了                    │
  │                   │  适合等待动态数据加载完成                │
  │                   │  ⚠ 某些页面永远不会 idle（轮询等）      │
  └───────────────────┴────────────────────────────────────────┘

  推荐策略：
  - 抓静态内容 → "domcontentloaded"（最快）
  - 等图片加载 → "load"
  - 等 AJAX 数据 → "networkidle" 或 wait_for_selector()
```

### 6.4 wait_for_function() 等待自定义条件

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")

    # ── 等待页面上某个元素的文本变成特定内容 ──
    page.wait_for_function(
        "document.querySelector('.status').innerText === '加载完成'"
    )

    # ── 等待列表元素数量超过 10 个 ──
    page.wait_for_function(
        "document.querySelectorAll('.item').length > 10"
    )

    # ── 等待某个全局变量被赋值 ──
    page.wait_for_function("window.__DATA__ !== undefined")

    browser.close()
```

---

## 七、元素交互——点击、填写、输入

### 7.1 点击操作

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://quotes.toscrape.com/login")

    # ── 点击元素 ──
    # Playwright 会自动等待元素可点击（可见、未被遮挡）
    page.click("input[type='submit']")
    # 等同于：
    # element = page.query_selector("input[type='submit']")
    # element.click()

    # ── 点击文本内容匹配的元素 ──
    page.click("text=Login")
    # 点击包含 "Login" 文字的元素

    # ── 精确文本匹配 ──
    page.click("text='Login'")
    # 只匹配完全等于 "Login" 的元素

    browser.close()
```

### 7.2 填写表单

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://quotes.toscrape.com/login")

    # ── fill()：清空后填入内容（推荐）──
    page.fill("input[name='username']", "admin")
    page.fill("input[name='password']", "admin")
    # fill() 会先清空输入框，再填入新内容

    # ── type()：逐字符输入（模拟真人打字）──
    page.type("input[name='username']", "admin", delay=100)
    # delay=100 表示每个字符间隔 100 毫秒
    # 适合需要模拟真人输入的场景

    # ── 清空输入框 ──
    page.fill("input[name='username']", "")
    # 或者
    page.evaluate("document.querySelector('input[name=username]').value = ''")

    # ── 提交表单 ──
    page.click("input[type='submit']")

    browser.close()
```

```
fill() vs type() 的区别：

  ┌──────────────┬────────────────────────┬────────────────────────┐
  │  对比项       │  fill()                │  type()                │
  ├──────────────┼────────────────────────┼────────────────────────┤
  │  速度         │  快（一次性填入）       │  慢（逐字符输入）       │
  │  是否清空     │  自动清空原有内容       │  追加到已有内容后面     │
  │  触发事件     │  触发 input/change      │  触发 keydown/press/   │
  │              │                        │  input/keyup/change    │
  │  适用场景     │  大多数表单填写         │  需要模拟真人打字       │
  │  推荐度       │  ★★★★★               │  ★★★☆☆               │
  └──────────────┴────────────────────────┴────────────────────────┘
```

### 7.3 其他常用交互

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com")

    # ── 选择下拉框 ──
    page.select_option("select#category", "electronics")
    # 或按值选择
    page.select_option("select#category", value="electronics")
    # 或按文本选择
    page.select_option("select#category", label="电子产品")

    # ── 勾选复选框 ──
    page.check("input[name='agree']")
    # 取消勾选
    page.uncheck("input[name='agree']")

    # ── 上传文件 ──
    page.set_input_files("input[type='file']", "path/to/file.jpg")

    # ── 执行 JavaScript ──
    result = page.evaluate("() => document.title")
    # 也可以传参
    result = page.evaluate(
        "(x) => x * 2",
        21
    )
    print(result)  # 42

    # ── 滚动页面 ──
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    # 滚动到页面底部

    browser.close()
```

---

## 八、截图功能

### 8.1 页面截图

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://quotes.toscrape.com")

    # ── 整页截图 ──
    page.screenshot(path="page_full.png", full_page=True)
    # full_page=True 会截取整个页面（包括滚动区域）
    # 如果不加 full_page，只截取可视区域

    # ── 可视区域截图 ──
    page.screenshot(path="page_viewport.png")
    # 只截取当前浏览器窗口看到的部分

    # ── 元素截图 ──
    element = page.query_selector(".quote")
    if element:
        element.screenshot(path="quote.png")
        # 只截取特定元素的区域

    # ── 指定图片格式 ──
    page.screenshot(path="page.jpg", type="jpeg")
    # 支持 png（默认）和 jpeg

    browser.close()
```

**生活类比：** 截图功能就像给页面"拍照"——`full_page=True` 是拍全景照（整个页面），不加是拍当前视野的照片（可视区域），元素截图是"特写"（只拍某个元素）。

---

## 九、与 Puppeteer 的对比（给 Node.js 开发者）

```
Puppeteer (JavaScript) vs Playwright (Python) 对照：

  ┌────────────────────────────┬──────────────────────────────────┐
  │  Puppeteer (JS)            │  Playwright (Python)             │
  ├────────────────────────────┼──────────────────────────────────┤
  │  const browser =           │  browser =                       │
  │    await puppeteer.launch()│    p.chromium.launch()           │
  ├────────────────────────────┼──────────────────────────────────┤
  │  const page =              │  page =                          │
  │    await browser.newPage() │    browser.new_page()            │
  ├────────────────────────────┼──────────────────────────────────┤
  │  await page.goto(url)      │  page.goto(url)                  │
  ├────────────────────────────┼──────────────────────────────────┤
  │  await page.content()      │  page.content()                  │
  ├────────────────────────────┼──────────────────────────────────┤
  │  await page.waitFor        │  page.wait_for                   │
  │    Selector('.item')       │    _selector('.item')            │
  ├────────────────────────────┼──────────────────────────────────┤
  │  await page.$eval          │  page.eval_on_selector           │
  │    ('.item', e =>          │    ('.item',                     │
  │     e.textContent)         │     'e => e.textContent')        │
  ├────────────────────────────┼──────────────────────────────────┤
  │  await page.screenshot     │  page.screenshot                 │
  │    ({path: 'a.png'})       │    (path='a.png')                │
  ├────────────────────────────┼──────────────────────────────────┤
  │  await browser.close()     │  browser.close()                 │
  └────────────────────────────┴──────────────────────────────────┘

  核心差异：
  1. JS 版用 async/await，Python 同步版不用
  2. JS 版只能控制 Chromium，Python 版支持三大引擎
  3. Python 版的 API 命名用了下划线风格（snake_case）
```

---

## 十、完整实战示例：抓取 JS 渲染的名言网站

```python
"""
实战：用 Playwright 抓取 JS 渲染的名言网站
对比 requests 只能拿到空壳的问题
"""
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

def scrape_quotes():
    """抓取 quotes.toscrape.com/js/ 的名言数据"""
    with sync_playwright() as p:
        # 启动浏览器（headless 模式）
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 访问 JS 渲染版本的名言网站
        url = "https://quotes.toscrape.com/js/"
        print(f"正在访问: {url}")
        page.goto(url, wait_until="networkidle")

        # 获取渲染后的 HTML
        html = page.content()
        print(f"HTML 长度: {len(html)} 字符")

        # 用 BeautifulSoup 解析
        soup = BeautifulSoup(html, "html.parser")
        quotes = soup.select(".quote")

        print(f"\n共找到 {len(quotes)} 条名言：\n")

        for i, quote in enumerate(quotes, 1):
            text = quote.select_one(".text")
            author = quote.select_one(".author")
            tags = quote.select(".tag")

            if text and author:
                print(f"【{i}】{text.text}")
                print(f"    —— {author.text}")
                if tags:
                    tag_list = [t.text for t in tags]
                    print(f"    标签: {', '.join(tag_list)}")
                print()

        browser.close()

if __name__ == "__main__":
    scrape_quotes()
```

```
运行结果预期：

  正在访问: https://quotes.toscrape.com/js/
  HTML 长度: 8234 字符

  共找到 10 条名言：

  【1】"The world as we have created it is a process of our thinking...
      —— Albert Einstein
      标签: change, deep-thoughts, thinking, world

  【2】"It is our choices, Harry, that show what we truly are...
      —— J.K. Rowling
      标签: abilities, choices

  ...
```

```
对比实验：

  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  用 requests：                                              │
  │  response.text → "<div id="container"></div>"               │
  │                  HTML 里什么都没有！                         │
  │                                                             │
  │  用 Playwright：                                            │
  │  page.content() → 完整的 HTML，包含所有名言数据              │
  │                   JS 已经执行，数据已渲染到页面               │
  │                                                             │
  │  这就是浏览器自动化的价值！                                  │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

---

## 十一、动手练习

### 练习 1：用 Playwright 抓取动态页面标题

```python
"""
目标：对比 requests 和 Playwright 获取动态页面的差异
步骤：
1. 分别用 requests 和 Playwright 访问 https://spa5.scrape.center/
2. 对比两种方式获取到的 HTML 内容
3. 验证 Playwright 能获取到渲染后的完整内容
"""
import requests
from playwright.sync_api import sync_playwright

url = "https://spa5.scrape.center/"

# 方式1：requests
r = requests.get(url)
print(f"requests 获取的 HTML 长度: {len(r.text)}")
print(f"requests 能找到 'book' 关键词: {'book' in r.text.lower()}")

# 方式2：Playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(url, wait_until="networkidle")

    html = page.content()
    print(f"\nPlaywright 获取的 HTML 长度: {len(html)}")
    print(f"Playwright 能找到 'book' 关键词: {'book' in html.lower()}")

    # 提取数据
    items = page.query_selector_all(".book-item")
    print(f"找到 {len(items)} 本书")

    browser.close()
```

### 练习 2：等待元素并提取数据

```python
"""
目标：练习 wait_for_selector 和元素提取
步骤：
1. 访问一个动态加载的页面
2. 使用 wait_for_selector 等待目标元素出现
3. 提取元素的文本内容和属性
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://spa5.scrape.center/")

    # 等待书本列表加载
    page.wait_for_selector(".book-item", timeout=10000)

    # 提取第一本书的信息
    first_book = page.query_selector(".book-item")
    if first_book:
        title_el = first_book.query_selector("h2")
        price_el = first_book.query_selector(".price")

        if title_el:
            print(f"书名: {title_el.inner_text()}")
        if price_el:
            print(f"价格: {price_el.inner_text()}")

        # 获取封面图片的 src
        img_el = first_book.query_selector("img")
        if img_el:
            img_src = img_el.get_attribute("src")
            print(f"封面图: {img_src}")

    browser.close()
```

### 练习 3：headed 模式调试与截图

```python
"""
目标：练习 headed 模式调试和截图功能
步骤：
1. 用 headed 模式启动浏览器（可以看到操作过程）
2. 访问目标页面并等待加载
3. 截取整个页面的截图
4. 截取某个特定元素的截图
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    # headed 模式：可以看到浏览器窗口
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    page.goto("https://quotes.toscrape.com")
    page.wait_for_load_state("networkidle")

    # 整页截图
    page.screenshot(path="quotes_full.png", full_page=True)
    print("整页截图已保存: quotes_full.png")

    # 元素截图
    first_quote = page.query_selector(".quote")
    if first_quote:
        first_quote.screenshot(path="first_quote.png")
        print("第一条名言截图已保存: first_quote.png")

    browser.close()
    print("浏览器已关闭")
```

---

## 常见误区

- **只装了 pip 包没装浏览器**：`pip install playwright` 只装了 Python 包，必须再执行 `playwright install` 下载浏览器二进制文件，否则运行时会报 `Executable doesn't exist`。
- **用 `time.sleep()` 代替等待机制**：Playwright 的 `wait_for_selector()` 和 `wait_for_load_state()` 是智能等待，比固定 sleep 更快更可靠。用 sleep 不仅浪费时间，还可能因为页面加载慢而抓到空数据。
- **忘记关闭浏览器导致进程泄漏**：不用 `with` 语句管理 `sync_playwright()`，程序异常退出时 Chromium 进程会残留在内存里，多次运行后吃光系统资源。
- **headless 和 headed 模式下页面表现不一致**：某些网站会检测 `navigator.webdriver` 属性，headless 模式更容易被识别。开发阶段用 headed 模式调试没问题，但要注意最终部署时两者的差异。

---

## 工程建议

- **始终用 `with` 语句管理资源**：`with sync_playwright() as p:` 保证浏览器进程在任何情况下都能正确关闭，避免资源泄漏。
- **开发用 headed，生产用 headless**：headed 模式能看到浏览器操作过程，方便调试选择器和等待逻辑；确认无误后切到 headless 模式提高效率。
- **优先用 `page.content()` + BeautifulSoup**：对于已有 BeautifulSoup 代码的项目，拿到渲染后的 HTML 直接复用解析逻辑最省事；新项目可以直接用 Playwright 的 `query_selector` API。
- **合理设置 `wait_until` 参数**：抓静态内容用 `domcontentloaded`（最快），等图片用 `load`，等 AJAX 数据用 `networkidle` 或 `wait_for_selector()`。

---

## 小结

本课的核心知识点：

1. **Playwright 是目前最好的 Python 浏览器自动化工具**，比 Selenium 更快、API 更友好，由微软积极维护
2. **安装需要两步**：`pip install playwright` 安装 Python 包，`playwright install` 下载浏览器二进制文件
3. **三种浏览器引擎**：Chromium（最常用）、Firefox、WebKit，默认使用 Chromium
4. **`sync_playwright()` 是同步版本的入口**，推荐用 `with` 语句自动管理资源
5. **`page.goto()` 导航到 URL**，`wait_until` 参数控制等待策略（domcontentloaded / load / networkidle）
6. **`page.content()` 获取渲染后的完整 HTML**，这是 Playwright 的核心价值——JS 已经执行完毕
7. **等待机制是 Playwright 的杀手锏**：`wait_for_selector()` 自动等待元素出现，不用手动写 sleep
8. **元素交互操作**：`fill()` 填写表单、`click()` 点击、`type()` 模拟打字、`select_option()` 选择下拉框
9. **Headless 模式**适合生产环境，**headed 模式**适合开发调试
10. **截图功能**支持整页截图、可视区域截图、元素截图

> **前端开发者的优势：** 如果你用过 Puppeteer，Playwright 的 API 对你来说几乎是无缝迁移——同一个作者，相似的设计理念，只是语言从 JS 变成了 Python，功能从只支持 Chromium 扩展到了三大引擎。你之前写的 `page.waitForSelector()` 现在变成了 `page.wait_for_selector()`，逻辑完全一样。

---

## 下一课预告

学会了 Playwright 的基本用法之后，下一课我们将进入实战环节。你将学到如何处理无限滚动加载、如何点击页面元素触发数据加载、如何处理弹窗和多标签页、如何下载文件，以及如何将 requests 和 Playwright 结合使用（用 Playwright 拦截 API 请求，再用 requests 高速抓取）。这些都是真实爬虫项目中会遇到的高频场景。

---

## 参考答案

### 练习 1

**思路**：分别用 `requests` 和 Playwright 访问同一个动态页面，对比获取到的 HTML 内容。`requests` 只能拿到空壳 HTML，Playwright 能拿到 JS 渲染后的完整内容。

**答案**：
```python
import requests
from playwright.sync_api import sync_playwright

url = "https://spa5.scrape.center/"

# 方式1：requests
r = requests.get(url)
print(f"requests 获取的 HTML 长度: {len(r.text)}")
print(f"requests 能找到 'book' 关键词: {'book' in r.text.lower()}")

# 方式2：Playwright
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(url, wait_until="networkidle")

    html = page.content()
    print(f"\nPlaywright 获取的 HTML 长度: {len(html)}")
    print(f"Playwright 能找到 'book' 关键词: {'book' in html.lower()}")

    items = page.query_selector_all(".book-item")
    print(f"找到 {len(items)} 本书")

    browser.close()
```

**要点**：
- `requests` 获取的 HTML 通常只有几百字符（空壳），Playwright 获取的 HTML 有数万字符（包含完整内容）
- 动态页面的数据由 JavaScript 渲染，`requests` 不会执行 JS，所以拿不到数据
- `wait_until="networkidle"` 确保所有 AJAX 请求完成后再获取 HTML
- 这个对比实验是理解"为什么需要浏览器自动化"的最直观方式

### 练习 2

**思路**：使用 `wait_for_selector` 等待目标元素出现，然后用 `query_selector` 提取元素的文本和属性。Playwright 的自动等待机制会一直等到元素可见为止。

**答案**：
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://spa5.scrape.center/")

    # 等待书本列表加载
    page.wait_for_selector(".book-item", timeout=10000)

    # 提取第一本书的信息
    first_book = page.query_selector(".book-item")
    if first_book:
        title_el = first_book.query_selector("h2")
        price_el = first_book.query_selector(".price")

        if title_el:
            print(f"书名: {title_el.inner_text()}")
        if price_el:
            print(f"价格: {price_el.inner_text()}")

        # 获取封面图片的 src
        img_el = first_book.query_selector("img")
        if img_el:
            img_src = img_el.get_attribute("src")
            print(f"封面图: {img_src}")

    # 提取所有书籍的标题
    all_books = page.query_selector_all(".book-item")
    print(f"\n共 {len(all_books)} 本书：")
    for book in all_books[:5]:
        title = book.query_selector("h2")
        if title:
            print(f"  - {title.inner_text()}")

    browser.close()
```

**要点**：
- `wait_for_selector` 会自动等待元素出现在 DOM 中并变为可见，比 `time.sleep` 更可靠
- `query_selector` 返回单个元素，`query_selector_all` 返回元素列表
- `inner_text()` 获取可见文本，`get_attribute()` 获取元素属性值
- 设置 `timeout=10000` 防止无限等待，超时后会抛出异常

### 练习 3

**思路**：用 `headless=False` 启动浏览器（headed 模式），可以看到浏览器窗口中的操作过程。访问页面后用 `page.screenshot()` 截取整页和元素截图。

**答案**：
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    # headed 模式：可以看到浏览器窗口
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    page.goto("https://quotes.toscrape.com")
    page.wait_for_load_state("networkidle")

    # 整页截图
    page.screenshot(path="quotes_full.png", full_page=True)
    print("整页截图已保存: quotes_full.png")

    # 元素截图
    first_quote = page.query_selector(".quote")
    if first_quote:
        first_quote.screenshot(path="first_quote.png")
        print("第一条名言截图已保存: first_quote.png")

    # 可视区域截图（不加 full_page）
    page.screenshot(path="quotes_viewport.png")
    print("可视区域截图已保存: quotes_viewport.png")

    browser.close()
    print("浏览器已关闭")
```

**要点**：
- `headless=False` 让浏览器窗口可见，方便观察自动化操作过程
- `full_page=True` 截取整个页面（包括滚动区域），不加则只截取可视区域
- 元素截图（`element.screenshot()`）可以只截取特定区域，适合制作缩略图
- headed 模式适合开发调试，确认无误后切换到 headless 模式提高效率
