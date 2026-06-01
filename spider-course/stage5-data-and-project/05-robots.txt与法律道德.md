# 第5课：robots.txt 与法律道德

> **课程定位：** 第五阶段 · 数据存储与综合项目 · 第 5 课时
> **前置知识：** Scrapy 框架基础、HTTP 请求与响应、数据存储方案（第 1-4 课）
> **预计时长：** 70 分钟

---

完成本课学习后，你将能够：

1. 理解 robots.txt 的作用和基本语法规则
2. 手动阅读并解析 robots.txt 文件内容
3. 使用 Python 的 `urllib.robotparser` 模块程序化检查爬取权限
4. 了解与爬虫相关的法律框架（版权法、计算机欺诈法、隐私法规）
5. 理解网站服务条款（ToS）对爬虫行为的约束
6. 掌握道德爬取的核心原则并应用于实际项目
7. 实现合理的速率限制策略
8. 区分安全可爬取数据与敏感数据
9. 通过案例分析建立合规爬取的判断能力

---

## 一、什么是 robots.txt？——网站的"访客须知"

### 1.1 从现实世界理解 robots.txt

想象你去一个大型商场，入口处有一块告示牌：

```
┌──────────────────────────────────────────────────────────────┐
│  🏢 XX 商场 · 访客须知                                        │
│                                                              │
│  ✅ 所有人：可以进入 1-3 楼公共区域                              │
│  ✅ 会员：可以进入 4 楼 VIP 区                                 │
│  ❌ 所有人：禁止进入 B1 员工通道                                │
│  ❌ 所有人：禁止进入 5 楼办公区                                 │
│                                                              │
│  每分钟最多通过 10 人，谢谢配合！                                │
└──────────────────────────────────────────────────────────────┘
```

**robots.txt 就是网站写给爬虫的"访客须知"。** 它告诉爬虫：哪些页面可以爬，哪些不可以爬，爬取速度应该是多少。

```
┌──────────────────────────────────────────────────────────────┐
│  robots.txt 在网站中的位置                                     │
│                                                              │
│  https://example.com/            ← 网站首页                   │
│  https://example.com/about       ← 关于页面                   │
│  https://example.com/robots.txt  ← 就在这里！永远在根目录       │
│                                                              │
│  ┌──────────┐         ┌──────────────┐                       │
│  │  爬虫    │──请求──→│ robots.txt   │                       │
│  │          │←─规则──│ "你可以爬这些"│                       │
│  └──────────┘         └──────────────┘                       │
│       │                                                     │
│       │ 按照规则爬取                                          │
│       ▼                                                     │
│  ┌──────────────────────────────┐                           │
│  │  网站的各个页面               │                           │
│  │  ├── /products  ✅ 可以爬     │                           │
│  │  ├── /public    ✅ 可以爬     │                           │
│  │  ├── /admin     ❌ 不可以爬   │                           │
│  │  └── /user-data ❌ 不可以爬   │                           │
│  └──────────────────────────────┘                           │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 robots.txt 的基本语法

一个典型的 robots.txt 长这样：

```
# 这是注释，爬虫会忽略这一行

# 适用于所有爬虫的规则
User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /public/
Crawl-delay: 10

# 专门针对 Google 爬虫的规则
User-agent: Googlebot
Allow: /
Crawl-delay: 5

# 网站地图位置
Sitemap: https://example.com/sitemap.xml
```

让我们逐个理解每条指令：

```
┌──────────────────────────────────────────────────────────────┐
│  robots.txt 指令速查表                                        │
├──────────────┬───────────────────────────────────────────────┤
│  指令         │  含义                                         │
├──────────────┼───────────────────────────────────────────────┤
│  User-agent  │  这条规则适用于哪个爬虫（* 表示所有爬虫）        │
│  Disallow    │  不允许爬取的路径（以该路径开头的所有页面）       │
│  Allow       │  允许爬取的路径（覆盖 Disallow 的例外规则）     │
│  Crawl-delay │  请求间隔（秒），建议爬虫多久发一次请求          │
│  Sitemap     │  网站地图的 URL，帮助爬虫发现更多页面            │
└──────────────┴───────────────────────────────────────────────┘
```

**生活类比：** 把 robots.txt 想象成餐厅的"菜单说明"：
- `User-agent` = 这份菜单是给谁看的（普通顾客 / VIP / 外卖骑手）
- `Allow` = 推荐菜品（你可以点这些）
- `Disallow` = 已售罄 / 不对外供应（你不能点这些）
- `Crawl-delay` = 每位顾客用餐间隔 30 分钟（不要一窝蜂来）
- `Sitemap` = 完整菜单目录（想要更多菜品信息，看这里）

### 1.3 路径匹配规则详解

robots.txt 的路径匹配遵循"前缀匹配"规则——以指定路径开头的 URL 都会被匹配到：

```
┌──────────────────────────────────────────────────────────────┐
│  路径匹配示例                                                  │
│                                                              │
│  Disallow: /admin                                            │
│                                                              │
│  匹配 ✅：                                                    │
│  ├── https://example.com/admin                               │
│  ├── https://example.com/admin/login                         │
│  ├── https://example.com/admin/users/123                     │
│  └── https://example.com/admin/settings                      │
│                                                              │
│  不匹配 ❌：                                                  │
│  ├── https://example.com/administration   （不是 /admin 开头）│
│  └── https://example.com/blog/admin-post  （路径中间不算）     │
│                                                              │
│  ────────────────────────────────────────────                │
│                                                              │
│  Disallow: /                                                │
│                                                              │
│  匹配所有路径！等于"不允许爬任何页面"                           │
│                                                              │
│  ────────────────────────────────────────────                │
│                                                              │
│  Disallow:  （空值）                                          │
│                                                              │
│  什么都不禁止，等于"可以爬所有页面"                             │
└──────────────────────────────────────────────────────────────┘
```

### 1.4 Allow 和 Disallow 的优先级

当 Allow 和 Disallow 冲突时，**谁的路径更长（更具体），谁优先**：

```
┌──────────────────────────────────────────────────────────────┐
│  优先级规则：更具体的路径胜出                                   │
│                                                              │
│  User-agent: *                                               │
│  Disallow: /products/                                        │
│  Allow: /products/new-arrivals/                              │
│                                                              │
│  结果：                                                       │
│  ├── /products/old/           ❌ 被 Disallow 匹配             │
│  ├── /products/electronics/   ❌ 被 Disallow 匹配             │
│  └── /products/new-arrivals/  ✅ Allow 更长，优先匹配          │
│                                                              │
│  ────────────────────────────────────────────                │
│                                                              │
│  生活类比：                                                    │
│  物业说"小区所有区域禁止遛狗"（Disallow: /）                    │
│  但又说"中心花园可以遛狗"（Allow: /garden/）                   │
│  更具体的规则优先 → 你可以在花园遛狗 🐕                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、程序化读取 robots.txt

### 2.1 手动读取 robots.txt

在写代码之前，先学会手动查看。任何网站的 robots.txt 都可以通过在域名后加 `/robots.txt` 访问：

```python
import requests

# 直接请求 robots.txt
response = requests.get("https://books.toscrape.com/robots.txt")
print(response.text)
```

输出示例：

```
# robots.txt for books.toscrape.com
User-agent: *
Disallow: /catalogue/
Allow: /catalogue/category/books_1/
Crawl-delay: 5
```

**生活类比：** 手动读 robots.txt 就像在餐厅门口看"营业须知"公告牌。内容就那么几条规则，肉眼就能看明白。

### 2.2 使用 urllib.robotparser 模块

Python 标准库自带了 `urllib.robotparser` 模块，专门用来解析和检查 robots.txt：

```python
from urllib.robotparser import RobotFileParser

# 创建解析器并加载 robots.txt
rp = RobotFileParser()
rp.set_url("https://books.toscrape.com/robots.txt")
rp.read()

# 检查是否允许某个爬虫访问某个 URL
can_fetch = rp.can_fetch("*", "https://books.toscrape.com/catalogue/page-2.html")
print(f"可以爬取吗？{can_fetch}")  # True 或 False

# 检查另一个 URL
can_fetch_admin = rp.can_fetch("*", "https://books.toscrape.com/admin/")
print(f"可以爬取 admin 吗？{can_fetch_admin}")
```

### 2.3 封装一个实用的检查函数

在实际项目中，我们通常会封装一个工具函数来方便地检查任意网站的爬取权限：

```python
from urllib.robotparser import RobotFileParser
from urllib.parse import urlparse

def check_can_scrape(url, user_agent="*"):
    """
    检查指定 URL 是否允许被爬取

    参数：
        url: 要检查的完整 URL
        user_agent: 爬虫标识，默认为 *

    返回：
        bool: True 表示允许，False 表示禁止
    """
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

    rp = RobotFileParser()
    rp.set_url(robots_url)

    try:
        rp.read()
        return rp.can_fetch(user_agent, url)
    except Exception as e:
        # 无法获取 robots.txt（404、超时等）
        # 一般约定：没有 robots.txt = 默认允许
        print(f"⚠ 无法获取 {robots_url}: {e}")
        return True


# 使用示例
urls_to_check = [
    "https://books.toscrape.com/",
    "https://books.toscrape.com/catalogue/page-2.html",
    "https://quotes.toscrape.com/",
]

for url in urls_to_check:
    result = check_can_scrape(url)
    status = "✅ 可以爬" if result else "❌ 禁止爬"
    print(f"{status} → {url}")
```

**生活类比：** 这就像你在出门前，先用手机查一下目的地的"开放时间"和"进入要求"。不用亲自跑到门口看告示牌，程序帮你自动检查了。

### 2.4 获取 Crawl-delay 信息

除了检查是否允许爬取，我们还可以提取 Crawl-delay 值来设置合理的请求间隔：

```python
from urllib.robotparser import RobotFileParser

rp = RobotFileParser()
rp.set_url("https://books.toscrape.com/robots.txt")
rp.read()

# 获取特定爬虫的 crawl_delay（Python 3.6+）
delay = rp.crawl_delay("*")
if delay:
    print(f"建议的请求间隔：{delay} 秒")
else:
    print("未指定 Crawl-delay，使用默认间隔（建议 2-5 秒）")
```

### 2.5 Scrapy 中自动遵守 robots.txt

如果你使用 Scrapy 框架，它内置了自动遵守 robots.txt 的功能，只需要在 `settings.py` 中开启：

```python
# settings.py

# ✅ 正确：开启 robots.txt 遵守（Scrapy 默认就是 True）
ROBOTSTXT_OBEY = True

# ❌ 错误：关闭 robots.txt 遵守，可能违反网站规定
# ROBOTSTXT_OBEY = False
```

开启后，Scrapy 会自动：
1. 在爬取前先请求目标网站的 robots.txt
2. 解析规则并缓存
3. 自动跳过被禁止的 URL
4. 在日志中记录被过滤的请求

---

## 三、法律框架——爬虫的"红线"在哪里

### 3.1 法律风险总览

作为爬虫开发者，你需要了解几个主要的法律风险领域：

```
┌──────────────────────────────────────────────────────────────┐
│  爬虫相关法律风险地图                                          │
│                                                              │
│  ┌─────────────────┐                                        │
│  │  版权法           │  复制受版权保护的内容                     │
│  │  Copyright Law   │  （文章、图片、数据库）                   │
│  └────────┬────────┘                                        │
│           │                                                  │
│  ┌────────▼────────┐                                        │
│  │  计算机欺诈法     │  未经授权访问计算机系统                   │
│  │  CFAA (美国)     │  绕过安全措施获取数据                     │
│  └────────┬────────┘                                        │
│           │                                                  │
│  ┌────────▼────────┐                                        │
│  │  隐私法规         │  收集个人隐私数据                        │
│  │  GDPR / 个保法   │  未获得用户同意                          │
│  └────────┬────────┘                                        │
│           │                                                  │
│  ┌────────▼────────┐                                        │
│  │  服务条款违反      │  违反网站 ToS                           │
│  │  ToS Violation   │  商业用途限制                           │
│  └─────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 版权法（Copyright Law）

```
┌──────────────────────────────────────────────────────────────┐
│  版权法与爬虫                                                  │
│                                                              │
│  ❌ 受版权保护，不应直接复制：                                   │
│  ├── 完整的文章内容                                           │
│  ├── 图片、视频、音频                                         │
│  ├── 数据库的整体编排（sui generis 权利）                      │
│  └── 软件代码                                                │
│                                                              │
│  ✅ 通常不受版权保护：                                         │
│  ├── 事实性数据（价格、日期、名称）                             │
│  ├── 公开的 URL 和链接                                       │
│  └── 数据的"结构"而非"内容"                                   │
│                                                              │
│  关键原则：                                                    │
│  "事实不受版权保护，但表达事实的方式受保护"                      │
│  ——你可以记录"苹果股价 150 美元"这个事实                        │
│  ——但不能复制别人撰写的关于股价的分析文章                       │
└──────────────────────────────────────────────────────────────┘
```

**生活类比：** 版权法就像食物配方的保护。可口可乐的配方是受保护的（你不能原样复制），但"碳酸饮料含糖、碳酸水、咖啡因"这些事实任何人都能说。你可以用公开数据做自己的分析，但不能照搬别人的文章。

### 3.3 计算机欺诈与滥用法（CFAA）

CFAA 是美国的法律，但它对全球互联网行业都有参考意义：

```
┌──────────────────────────────────────────────────────────────┐
│  CFAA 与爬虫的边界                                             │
│                                                              │
│  ❌ 违反 CFAA 的行为：                                         │
│  ├── 破解密码或验证码后访问                                    │
│  ├── 利用漏洞获取非公开数据                                    │
│  ├── 绕过 IP 封锁继续访问                                     │
│  └── 使用窃取的登录凭证                                       │
│                                                              │
│  ✅ 通常不违反 CFAA：                                         │
│  ├── 访问公开的、无需登录的页面                                │
│  ├── 按照 robots.txt 规则爬取                                 │
│  └── 模拟正常浏览器行为                                       │
│                                                              │
│  ┌─────────────────────────────────────┐                     │
│  │  核心判断标准：                       │                     │
│  │  "是否突破了某种访问控制措施？"        │                     │
│  │                                      │                     │
│  │  公开网页 → 没有访问控制 → 不违反     │                     │
│  │  需要登录 → 有访问控制 → 需谨慎      │                     │
│  │  有验证码 → 有访问控制 → 高风险      │                     │
│  └─────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 隐私法规：GDPR 与个人信息保护法

```
┌──────────────────────────────────────────────────────────────┐
│  隐私法规速览                                                  │
│                                                              │
│  GDPR（欧盟通用数据保护条例）                                   │
│  ├── 适用于：任何处理欧盟居民数据的组织                         │
│  ├── 个人数据：姓名、邮箱、IP 地址、设备 ID 等                  │
│  ├── 核心原则：最小化收集、合法基础、用户同意                    │
│  └── 违规后果：最高 2000 万欧元或全球营收 4%                    │
│                                                              │
│  中国《个人信息保护法》                                         │
│  ├── 适用于：在中国境内处理个人信息                             │
│  ├── 个人信息：以电子方式记录的各种信息                         │
│  ├── 核心原则：知情同意、最小必要、目的限制                     │
│  └── 违规后果：最高 5000 万元或上年营收 5%                     │
│                                                              │
│  ❌ 绝对不要爬取：                                             │
│  ├── 用户的手机号、身份证号、银行卡号                          │
│  ├── 未公开的个人社交动态                                      │
│  ├── 个人健康、医疗记录                                        │
│  └── 个人位置轨迹数据                                         │
│                                                              │
│  ✅ 通常安全的数据：                                           │
│  ├── 公开的商品信息（名称、价格、评分）                         │
│  ├── 公开的公司信息（名称、地址、电话）                         │
│  └── 公开的新闻、公告                                         │
└──────────────────────────────────────────────────────────────┘
```

**生活类比：** 隐私法规就像小区的隐私保护规定。你可以在小区门口观察人流量（公开数据），但不能跟踪某个住户的行踪（个人数据），更不能翻别人家的垃圾（私人信息）。

---

## 四、服务条款（ToS）——网站的"使用规则"

### 4.1 什么是服务条款

服务条款（Terms of Service，简称 ToS）是网站与用户之间的"合同"。当你访问网站时，就默认接受了这些条款。

```
┌──────────────────────────────────────────────────────────────┐
│  ToS 中与爬虫相关的常见条款                                     │
│                                                              │
│  ┌─────────────────────────────────────────────┐             │
│  │  "禁止使用自动化工具访问或收集本站数据"       │             │
│  │  "禁止大量复制、下载本站内容"                 │             │
│  │  "禁止将本站数据用于商业目的"                 │             │
│  │  "违反上述条款将封禁账户并追究法律责任"       │             │
│  └─────────────────────────────────────────────┘             │
│                                                              │
│  ⚠ 注意：                                                     │
│  即使 robots.txt 允许你爬取某些页面，                            │
│  ToS 仍然可能禁止你这样做。                                     │
│  两个规则需要同时遵守！                                         │
│                                                              │
│  ┌──────────┐     ┌──────────┐     ┌──────────────┐          │
│  │robots.txt│ AND │   ToS    │ AND │  法律法规     │          │
│  │  允许？   │     │  允许？   │     │  允许？       │          │
│  └─────┬────┘     └─────┬────┘     └──────┬───────┘          │
│        │                │                  │                  │
│        └────────────────┼──────────────────┘                  │
│                         ▼                                     │
│              三者都允许才能安全爬取                              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 如何查找网站的 ToS

```python
# 服务条款通常在这些位置
tos_locations = [
    "https://example.com/terms",
    "https://example.com/terms-of-service",
    "https://example.com/tos",
    "https://example.com/legal/terms",
    "https://example.com/terms-and-conditions",
    # 页面底部通常有链接
]
```

**生活类比：** ToS 就像餐厅的"用餐须知"（虽然是小字印刷的）。大多数人都不看，但一旦违反，餐厅有权请你离开。爬虫也一样——你不看 ToS，网站就有权封你 IP 甚至起诉你。

---

## 五、道德爬取原则——做一个"好人"爬虫

### 5.1 黄金法则

```
┌──────────────────────────────────────────────────────────────┐
│  道德爬取六大黄金法则                                           │
│                                                              │
│  1️⃣  遵守 robots.txt                                         │
│     网站明确告诉你规则，请尊重它们                               │
│                                                              │
│  2️⃣  控制爬取频率                                             │
│     不要给服务器造成过大压力，模拟正常用户行为                     │
│                                                              │
│  3️⃣  限制数据范围                                             │
│     只采集你需要的数据，不要"能爬的都爬"                         │
│                                                              │
│  4️⃣  标明身份                                                 │
│     设置有意义的 User-Agent，让网站管理员能找到你                 │
│                                                              │
│  5️⃣  尊重数据所有权                                           │
│     不要将他人的数据据为己有或用于非法用途                       │
│                                                              │
│  6️⃣  及时响应投诉                                             │
│     如果网站要求你停止，请立即停止                               │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 速率限制最佳实践

```python
import time
import random
import requests

# ❌ 错误：无间隔连续请求
for page in range(1, 100):
    response = requests.get(f"https://example.com/page/{page}")
    # 服务器：救命啊！

# ✅ 正确：有礼貌的请求间隔
for page in range(1, 100):
    response = requests.get(f"https://example.com/page/{page}")
    # 处理数据...
    time.sleep(random.uniform(1, 3))  # 随机等待 1-3 秒

# ✅ 更好：根据服务器响应动态调整
def polite_request(url, default_delay=2):
    """有礼貌的请求函数"""
    response = requests.get(url, headers={
        "User-Agent": "MyScraper/1.0 (contact@example.com)"  # 标明身份
    })

    if response.status_code == 429:  # Too Many Requests
        # 服务器说"你太频繁了"，等待更长时间
        retry_after = int(response.headers.get("Retry-After", 60))
        print(f"⚠ 被限速了，等待 {retry_after} 秒...")
        time.sleep(retry_after)
    elif response.status_code == 200:
        # 正常响应，按默认间隔等待
        time.sleep(default_delay)
    else:
        # 其他错误
        print(f"请求失败：{response.status_code}")
        time.sleep(default_delay * 2)  # 出错时多等一会儿

    return response
```

### 5.3 设置有意义的 User-Agent

```python
import requests

# ❌ 错误：不设置 UA 或使用默认的 Python-requests/xxx
headers_bad = {
    "User-Agent": "python-requests/2.28.0"
    # 网站一看就知道是爬虫，容易被封
}

# ❌ 错误：伪装成 Chrome 浏览器
headers_fake = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
    # 虽然能用，但不够诚实，出问题时网站找不到你
}

# ✅ 正确：使用有意义的 UA，标明项目和联系方式
headers_good = {
    "User-Agent": "BookPriceMonitor/1.0 (contact@mycompany.com)"
    # 网站管理员知道你是谁，有事可以直接联系你
}

response = requests.get("https://books.toscrape.com/", headers=headers_good)
```

**生活类比：** 去别人家做客，你应该按门铃、自我介绍，而不是翻墙进去。有意义的 User-Agent 就是你的"自我介绍"——让主人知道来者何人。

---

## 六、安全可爬取 vs 敏感数据

### 6.1 数据安全分类表

```
┌──────────────────────────────────────────────────────────────┐
│  数据安全分类                                                  │
│                                                              │
│  🟢 通常安全（可爬取）                                        │
│  ├── 公开的商品名称、价格、评分                                │
│  ├── 公开的公司名称、地址、电话                                │
│  ├── 公开的新闻标题、摘要                                     │
│  ├── 公开的天气、天气预报                                     │
│  └── 用于学习练习的模拟网站                                   │
│                                                              │
│  🟡 需要谨慎                                                  │
│  ├── 需要登录才能访问的数据                                    │
│  ├── 带有版权的文章全文                                        │
│  ├── 用户公开的个人主页信息                                    │
│  └── 大规模商业数据采集                                       │
│                                                              │
│  🔴 高风险（不应爬取）                                        │
│  ├── 个人身份信息（身份证、手机号、银行卡）                     │
│  ├── 私密通讯内容（私信、邮件）                                │
│  ├── 需要付费购买的数据                                       │
│  ├── 受密码保护的数据                                         │
│  └── 通过绕过反爬措施获取的数据                                │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 判断清单

在决定爬取某个网站之前，用这个清单做一个快速判断：

```python
def should_i_scrape(url):
    """
    爬取前的合规检查清单（伪代码，仅供思路参考）
    """
    checklist = {
        "1. 是否查看了 robots.txt？": False,
        "2. robots.txt 是否允许爬取该路径？": False,
        "3. 是否阅读了服务条款？": False,
        "4. ToS 是否禁止自动化采集？": False,
        "5. 要爬取的数据是否包含个人信息？": False,
        "6. 是否会侵犯版权？": False,
        "7. 是否设置了合理的请求间隔？": False,
        "8. 是否设置了有意义的 User-Agent？": False,
        "9. 爬取规模是否合理？": False,
        "10. 是否有合法的使用目的？": False,
    }

    # 如果第 4、5、6 项为"是"，则不应该爬取
    # 如果其他项为"否"，则需要先补上

    return checklist
```

---

## 七、案例分析——真实世界的教训

### 7.1 hiQ vs LinkedIn（2019-2022）

```
┌──────────────────────────────────────────────────────────────┐
│  案例：hiQ Labs vs LinkedIn                                    │
│                                                              │
│  背景：                                                       │
│  hiQ 是一家数据分析公司，它爬取 LinkedIn 上的公开用户资料        │
│  （不需要登录就能看到的信息），用于分析员工流动趋势               │
│                                                              │
│  ┌──────────┐          ┌──────────────┐                      │
│  │  hiQ     │──爬取──→│  LinkedIn    │                      │
│  │  (原告)  │          │  (被告)      │                      │
│  └──────────┘          └──────────────┘                      │
│                                                              │
│  LinkedIn 的立场：                                            │
│  "hiQ 违反了我们的 ToS，应该被禁止"                            │
│                                                              │
│  hiQ 的立场：                                                 │
│  "这些是公开数据，不登录就能看到，我们有权爬取"                  │
│                                                              │
│  法院判决（简化）：                                            │
│  ✅ 爬取公开数据（无需登录即可访问的页面）通常不违反 CFAA         │
│  ⚠  但这不意味着可以不受限制地爬取                             │
│  ⚠  其他法律（版权、隐私）仍然适用                              │
│                                                              │
│  对爬虫开发者的启示：                                           │
│  1. 公开数据 ≠ 可以随意爬取                                    │
│  2. ToS 仍然是重要的约束                                       │
│  3. 即使合法，也要注意道德和礼仪                                │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 其他典型案例

```
┌──────────────────────────────────────────────────────────────┐
│  更多案例警示                                                  │
│                                                              │
│  Case 1: 爬虫导致网站崩溃                                     │
│  ├── 某公司爬虫每秒发送数千请求，导致目标网站宕机               │
│  ├── 结果：被起诉并赔偿数万美元                                │
│  └── 教训：必须设置合理的速率限制                              │
│                                                              │
│  Case 2: 爬取个人信息出售                                     │
│  ├── 某公司爬取社交媒体上的个人信息并打包出售                   │
│  ├── 结果：违反 GDPR，被罚款数千万欧元                        │
│  └── 教训：个人隐私数据绝对不能碰                              │
│                                                              │
│  Case 3: 学术爬虫引发争议                                     │
│  ├── 研究人员爬取某平台数据用于学术研究                        │
│  ├── 平台起诉，但法院认为学术用途属合理使用                     │
│  └── 教训：使用目的很重要，但仍然建议提前获得授权               │
│                                                              │
│  ┌─────────────────────────────────────────────┐             │
│  │  总结：                                      │             │
│  │  合法 ≠ 无风险                               │             │
│  │  技术上能爬 ≠ 应该爬                         │             │
│  │  别人在爬 ≠ 你也可以爬                       │             │
│  └─────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

---

## 八、综合示例：合规爬虫模板

把前面学到的所有知识整合到一个实用的模板中：

```python
"""
合规爬虫模板
整合 robots.txt 检查、速率限制、身份标识、错误处理
"""
import time
import random
import requests
from urllib.robotparser import RobotFileParser
from urllib.parse import urlparse


class EthicalScraper:
    """道德爬虫基类"""

    def __init__(self, user_agent="EthicalScraper/1.0 (your@email.com)", default_delay=2):
        self.user_agent = user_agent
        self.default_delay = default_delay
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": self.user_agent})
        self._robots_cache = {}  # 缓存 robots.txt 解析结果

    def _get_robots_parser(self, url):
        """获取并缓存 robots.txt 解析器"""
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"

        if base_url not in self._robots_cache:
            rp = RobotFileParser()
            rp.set_url(f"{base_url}/robots.txt")
            try:
                rp.read()
                self._robots_cache[base_url] = rp
            except Exception:
                # robots.txt 不存在或无法访问，默认允许
                self._robots_cache[base_url] = None

        return self._robots_cache[base_url]

    def can_fetch(self, url):
        """检查是否允许爬取该 URL"""
        rp = self._get_robots_parser(url)
        if rp is None:
            return True  # 没有 robots.txt，默认允许
        return rp.can_fetch(self.user_agent, url)

    def get_crawl_delay(self, url):
        """获取推荐的爬取间隔"""
        rp = self._get_robots_parser(url)
        if rp:
            delay = rp.crawl_delay(self.user_agent)
            if delay:
                return max(delay, self.default_delay)
        return self.default_delay

    def fetch(self, url, **kwargs):
        """
        合规地请求一个 URL

        自动检查 robots.txt、应用速率限制、处理错误
        """
        # 第一步：检查 robots.txt
        if not self.can_fetch(url):
            print(f"❌ robots.txt 禁止爬取：{url}")
            return None

        # 第二步：应用速率限制
        delay = self.get_crawl_delay(url)
        jitter = random.uniform(0.5, 1.5)  # 添加随机抖动
        time.sleep(delay * jitter)

        # 第三步：发送请求
        try:
            response = self.session.get(url, timeout=10, **kwargs)

            # 处理 429 Too Many Requests
            if response.status_code == 429:
                retry_after = int(response.headers.get("Retry-After", 60))
                print(f"⚠ 被限速，等待 {retry_after} 秒...")
                time.sleep(retry_after)
                response = self.session.get(url, timeout=10, **kwargs)

            return response

        except requests.RequestException as e:
            print(f"❌ 请求失败：{url} → {e}")
            return None


# 使用示例
if __name__ == "__main__":
    scraper = EthicalScraper(
        user_agent="MyBookScraper/1.0 (student@learning.com)",
        default_delay=2
    )

    url = "https://books.toscrape.com/"
    print(f"正在检查 {url} 的爬取权限...")

    if scraper.can_fetch(url):
        print("✅ 允许爬取，开始请求...")
        response = scraper.fetch(url)
        if response:
            print(f"✅ 请求成功，状态码：{response.status_code}")
            print(f"   页面大小：{len(response.text)} 字符")
    else:
        print("❌ robots.txt 禁止爬取该 URL")
```

**生活类比：** 这个模板就像一个"有教养的访客"——进门先看规则，自我介绍，走路不发出太大声响，不会霸占别人家的沙发。这样的访客，谁都欢迎。

---

## 动手练习

### 练习 1：解析 robots.txt

访问 `https://quotes.toscrape.com/robots.txt`，使用 Python 读取并回答以下问题：

```
任务：
1. 该网站允许哪些路径被爬取？
2. 是否指定了 Crawl-delay？值是多少？
3. 编写代码检查以下 URL 是否可以爬取：
   - https://quotes.toscrape.com/
   - https://quotes.toscrape.com/page/2/
   - https://quotes.toscrape.com/login
```

参考代码框架：

```python
from urllib.robotparser import RobotFileParser

rp = RobotFileParser()
rp.set_url("https://quotes.toscrape.com/robots.txt")
rp.read()

# 在这里编写你的检查代码
# 提示：使用 rp.can_fetch("*", url) 来检查
```

### 练习 2：构建合规爬虫

使用本课学到的 `EthicalScraper` 类模板，完成以下任务：

```
任务：
1. 实例化 EthicalScraper，设置有意义的 User-Agent
2. 爬取 books.toscrape.com 的前 3 页数据
3. 提取每本书的标题和价格
4. 每次请求前打印"正在检查 robots.txt..."
5. 记录并输出总共用了多少时间

提示：
- 使用 BeautifulSoup 解析页面
- 注意每页的 URL 格式：/catalogue/page-1.html, /catalogue/page-2.html 等
```

### 练习 3：法律风险评估

```
任务：对以下场景进行法律风险评估，给出"安全 / 需谨慎 / 高风险"的判断，并说明理由。

场景 A：爬取某电商平台的公开商品价格，用于比价工具
场景 B：爬取某社交平台的用户手机号码，用于电话营销
场景 C：爬取某新闻网站的文章全文，用于自己的新闻聚合 App
场景 D：爬取政府公开数据网站的企业注册信息，用于数据分析
场景 E：绕过某付费墙网站的技术限制，爬取付费文章
```

---

## 小结

```
┌──────────────────────────────────────────────────────────────┐
│  本课核心知识点                                                │
│                                                              │
│  robots.txt 基础                                             │
│  ├── 网站写给爬虫的"访客须知"                                  │
│  ├── 核心指令：User-agent、Allow、Disallow、Crawl-delay      │
│  ├── 路径匹配规则：前缀匹配，更具体的路径优先                   │
│  └── Python 标准库 urllib.robotparser 可以程序化检查           │
│                                                              │
│  法律框架                                                     │
│  ├── 版权法：事实数据 vs 受保护的表达                          │
│  ├── CFAA：是否突破了访问控制措施                              │
│  ├── 隐私法规：个人数据绝对不能碰                              │
│  └── 服务条款：即使 robots.txt 允许，ToS 也可能禁止            │
│                                                              │
│  道德爬取                                                     │
│  ├── 遵守 robots.txt                                         │
│  ├── 控制爬取频率（1-5 秒间隔 + 随机抖动）                     │
│  ├── 设置有意义的 User-Agent                                  │
│  ├── 只采集必要数据                                           │
│  └── 及时响应投诉                                             │
│                                                              │
│  记住：                                                       │
│  ├── 合法 ≠ 无风险                                           │
│  ├── 技术上能爬 ≠ 应该爬                                     │
│  └── 三重检查：robots.txt + ToS + 法律法规                    │
└──────────────────────────────────────────────────────────────┘
```

**一句话总结：** 爬虫如同驾车——技术上你能让车开到 200km/h，但你必须遵守限速、看红绿灯、注意行人。做一个有责任感的爬虫开发者，不仅能保护自己，也是对整个行业的贡献。

---

## 下一课预告

恭喜你学完了爬虫的法律与道德知识！在下一课——**综合实战：数据采集与展示系统**中，我们将把整个课程所学的知识融会贯通，构建一个完整的数据采集与展示系统：

- Scrapy 爬虫采集书籍数据
- SQLite 存储采集结果
- Flask API 对外提供数据接口
- 前端页面展示和搜索数据

从爬取到展示，一个完整的数据管道等你来搭建！
