# 第3课：Pipeline 数据处理

> **课程定位：** 第四阶段 · Scrapy 框架与工程化 · 第 3 课时
> **前置知识：** 掌握 Scrapy Spider 编写、Item 定义、Selector 数据提取
> **预计时长：** 55 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 Pipeline 在 Scrapy 数据流中的角色与职责
2. 编写自定义 Pipeline 类，实现 `open_spider()`、`close_spider()`、`process_item()` 方法
3. 通过 `ITEM_PIPELINES` 配置控制多个 Pipeline 的执行顺序与优先级
4. 在 Pipeline 中完成数据清洗、字段验证与类型转换
5. 使用 `DropItem` 丢弃不合格的数据项
6. 实现 JSON、CSV、数据库等多种持久化存储 Pipeline
7. 组合多个 Pipeline 协同工作，构建完整的数据处理链

---

## 一、Pipeline 是什么——质量控制站的比喻

### 1.1 从前端视角理解 Pipeline

作为前端开发者，你一定熟悉 Express/Koa 中的中间件（Middleware）。请求经过一层层中间件，每一层做一件事：解析 Cookie、记录日志、权限校验……最终到达路由处理函数。

Scrapy 的 Pipeline 和这个思路非常像，只不过它处理的不是 HTTP 请求，而是**爬取到的数据**。

```
┌─────────────────────────────────────────────────────────┐
│                    Scrapy 数据流向                        │
│                                                         │
│  网站服务器 ──→ 下载器 ──→ Spider（解析）                 │
│                              │                          │
│                              ▼                          │
│                         ┌─────────┐                     │
│                         │  Item   │  （原始数据）         │
│                         └────┬────┘                     │
│                              │                          │
│                              ▼                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Pipeline 处理链                       │   │
│  │                                                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │   │
│  │  │ 清洗数据  │→│ 验证字段  │→│ 存入数据库      │  │   │
│  │  │ 优先级300 │  │ 优先级400 │  │ 优先级500      │  │   │
│  │  └──────────┘  └──────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                              │                          │
│                              ▼                          │
│                      最终存储（DB/文件）                  │
└─────────────────────────────────────────────────────────┘
```

### 1.2 生活中的类比

想象你在一家电商仓库工作。商品从供应商送到仓库后，不会直接发给顾客，而是要经过一条流水线：

- **第一道工序**：质检员检查商品有没有破损（数据验证）
- **第二道工序**：贴标签、分类（数据清洗与格式化）
- **第三道工序**：扫码入库（持久化存储）

这条流水线就是 Pipeline。每道工序是一个 Pipeline 类，商品（Item）依次通过每道工序，任何一道工序都可以决定"这个商品不合格，扔掉"。

---

## 二、Pipeline 类的核心方法

### 2.1 三个固定方法

每个 Pipeline 类可以实现三个方法，Scrapy 会在合适的时机自动调用它们：

```
┌─────────────────────────────────────────────────────────┐
│                  Pipeline 生命周期                        │
│                                                         │
│  爬虫启动                                                │
│    │                                                    │
│    ▼                                                    │
│  open_spider(spider)    ← 初始化资源（打开文件/连接DB）    │
│    │                                                    │
│    ▼                                                    │
│  ┌─────────────────────────────────────┐                │
│  │  process_item(item, spider)         │  ← 每个Item    │
│  │  process_item(item, spider)         │    都会调用一次  │
│  │  process_item(item, spider)         │                │
│  │  ...                                │                │
│  └─────────────────────────────────────┘                │
│    │                                                    │
│    ▼                                                    │
│  close_spider(spider)   ← 释放资源（关闭文件/断开连接）    │
│    │                                                    │
│    ▼                                                    │
│  爬虫结束                                                │
└─────────────────────────────────────────────────────────┘
```

下面是一个最简示例：

```python
import scrapy

class LogPipeline:
    """最简单的 Pipeline——只负责打印日志"""

    def open_spider(self, spider):
        """爬虫启动时调用，适合做初始化"""
        spider.logger.info("=== 爬虫启动了，Pipeline 准备就绪 ===")

    def close_spider(self, spider):
        """爬虫关闭时调用，适合做清理"""
        spider.logger.info("=== 爬虫结束了，Pipeline 清理资源 ===")

    def process_item(self, item, spider):
        """每获取到一个 Item 就调用一次，核心处理逻辑在这里"""
        spider.logger.info(f"收到数据: {item['title']}")
        return item  # ⚠️ 必须返回 item 或抛出 DropItem
```

### 2.2 process_item 的返回值规则

`process_item()` 有且仅有两种合法返回方式：

```python
# ✅ 正确：返回 item，传递给下一个 Pipeline
def process_item(self, item, spider):
    item['title'] = item['title'].strip()
    return item

# ✅ 正确：抛出 DropItem，丢弃这个 item（后续 Pipeline 不会收到它）
from scrapy.exceptions import DropItem

def process_item(self, item, spider):
    if not item.get('price'):
        raise DropItem("缺少价格信息，丢弃")
    return item

# ❌ 错误：返回 None（Scrapy 会报错）
def process_item(self, item, spider):
    print(item)
    # 忘记 return item，返回了 None

# ❌ 错误：不处理也不返回
def process_item(self, item, spider):
    pass  # 什么都没做，也没返回
```

记住这个规则：**返回 item = 放行，抛出 DropItem = 拦截**。

---

## 三、Pipeline 优先级与排序

### 3.1 ITEM_PIPELINES 配置

在 `settings.py` 中通过 `ITEM_PIPELINES` 字典配置启用哪些 Pipeline 以及它们的执行顺序：

```python
# settings.py

ITEM_PIPELINES = {
    # 格式: '项目名.pipelines.类名': 优先级数字
    'myproject.pipelines.CleanPipeline':     300,  # 先执行：清洗
    'myproject.pipelines.ValidatePipeline':  400,  # 再执行：验证
    'myproject.pipelines.SavePipeline':      500,  # 最后执行：存储
}
```

### 3.2 优先级规则

**数字越小，优先级越高，越先执行。**

```
┌───────────────────────────────────────────────────────┐
│              Pipeline 执行顺序                          │
│                                                       │
│   优先级 300        优先级 400       优先级 500         │
│  ┌──────────┐     ┌──────────┐    ┌──────────┐       │
│  │  Clean    │────→│ Validate │───→│   Save   │       │
│  │  清洗数据  │     │  验证数据  │    │  存储数据  │       │
│  └──────────┘     └──────────┘    └──────────┘       │
│       │                 │                               │
│   数字小 = 先跑      数字大 = 后跑                        │
│                                                       │
│   类比：优先级就是排队号码，号小的先办事                    │
└───────────────────────────────────────────────────────┘
```

这和 CSS 的 `z-index` 有点像——数字决定顺序，只不过 CSS 是谁在上面显示，Pipeline 是谁先执行。

### 3.3 禁用 Pipeline

把优先级设为 `None` 即可禁用，不需要注释掉或删除代码：

```python
ITEM_PIPELINES = {
    'myproject.pipelines.CleanPipeline':     300,
    'myproject.pipelines.ValidatePipeline':  None,  # 暂时禁用验证
    'myproject.pipelines.SavePipeline':      500,
}
```

---

## 四、数据清洗实战

### 4.1 清洗 Pipeline 长什么样

数据清洗是最常见的 Pipeline 用途。从网页上抓来的数据往往"不干净"：有多余空格、HTML 标签残留、格式不统一……

```python
class CleanPipeline:
    """数据清洗 Pipeline——给数据"洗个澡" """

    def process_item(self, item, spider):
        # 1. 去除字符串字段首尾空白
        for field in ['title', 'author', 'description']:
            if field in item and isinstance(item[field], str):
                item[field] = item[field].strip()

        # 2. 统一价格格式：字符串 → 浮点数
        if 'price' in item:
            price_str = item['price']
            # 去掉货币符号和千分位逗号
            price_str = price_str.replace('¥', '').replace('$', '')
            price_str = price_str.replace(',', '').strip()
            try:
                item['price'] = float(price_str)
            except ValueError:
                item['price'] = 0.0

        # 3. 统一评分格式：确保是整数
        if 'rating' in item:
            try:
                item['rating'] = int(item['rating'])
            except (ValueError, TypeError):
                item['rating'] = 0

        return item
```

### 4.2 清洗前后对比

```
┌─────────────────────────────────────────────────────────┐
│                    清洗前 vs 清洗后                        │
│                                                         │
│  清洗前（原始抓取）:                                       │
│  ┌─────────────────────────────────────────────┐        │
│  │ title:  "  深入浅出Python  "                  │        │
│  │ price:  "¥ 79.00"                           │        │
│  │ rating: "4.5"                                │        │
│  │ author: " 张三 "                              │        │
│  └─────────────────────────────────────────────┘        │
│                       │                                  │
│                       ▼                                  │
│              CleanPipeline 处理                           │
│                       │                                  │
│                       ▼                                  │
│  清洗后（Pipeline输出）:                                   │
│  ┌─────────────────────────────────────────────┐        │
│  │ title:  "深入浅出Python"                      │        │
│  │ price:  79.0          ← 变成浮点数            │        │
│  │ rating: 4             ← 变成整数              │        │
│  │ author: "张三"                               │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

---

## 五、数据验证与丢弃

### 5.1 为什么要验证

不是所有抓到的数据都是有效的。可能某个页面结构不一样，导致字段缺失；也可能抓到了广告内容混在里面。验证 Pipeline 的职责就是：**不合格的 item，直接扔掉。**

```python
from scrapy.exceptions import DropItem

class ValidatePipeline:
    """数据验证 Pipeline——质量检查员"""

    def process_item(self, item, spider):
        # 必须有标题
        if not item.get('title'):
            raise DropItem(f"缺少标题，丢弃: {item}")

        # 价格必须大于0
        if item.get('price', 0) <= 0:
            raise DropItem(f"价格无效({item.get('price')})，丢弃: {item['title']}")

        # 标题长度不能太短（可能是抓到了空元素）
        if len(item['title']) < 2:
            raise DropItem(f"标题太短，可能是无效数据: {item['title']}")

        spider.logger.debug(f"验证通过: {item['title']}")
        return item
```

### 5.2 DropItem 的工作机制

当你在某个 Pipeline 中抛出 `DropItem` 时，Scrapy 会：

1. 这个 Item **不会**传递给后续的 Pipeline
2. Scrapy 会在统计信息中记录 `item_dropped_count`
3. DropItem 的消息会被记录到日志中

```
┌───────────────────────────────────────────────────────────┐
│                   DropItem 流程示意                         │
│                                                           │
│   Item 进入                                                │
│      │                                                    │
│      ▼                                                    │
│  ┌──────────┐                                             │
│  │ 清洗Pipeline│  正常通过，return item                     │
│  └─────┬────┘                                             │
│        │                                                  │
│        ▼                                                  │
│  ┌──────────┐                                             │
│  │ 验证Pipeline│  发现问题！raise DropItem                  │
│  └─────┬────┘                                             │
│        │                                                  │
│        ✖──── Item 到此为止，不再往下传递                     │
│                                                           │
│        ╳  ┌──────────┐                                    │
│           │ 存储Pipeline│  收不到这个 Item 了               │
│           └──────────┘                                    │
└───────────────────────────────────────────────────────────┘
```

---

## 六、数据存储 Pipeline

### 6.1 存储为 JSON 文件

```python
import json

class JsonWriterPipeline:
    """将数据存储为 JSON 文件"""

    def open_spider(self, spider):
        self.file = open('output.json', 'w', encoding='utf-8')
        self.file.write('[\n')  # JSON 数组开始
        self.first_item = True

    def close_spider(self, spider):
        self.file.write('\n]')  # JSON 数组结束
        self.file.close()

    def process_item(self, item, spider):
        # 如果不是第一个 item，先加逗号分隔
        if not self.first_item:
            self.file.write(',\n')
        self.first_item = False

        # 将 item 转为 JSON 字符串写入
        line = json.dumps(dict(item), ensure_ascii=False, indent=2)
        self.file.write(line)
        return item
```

### 6.2 存储为 CSV 文件

```python
import csv

class CsvWriterPipeline:
    """将数据存储为 CSV 文件"""

    def open_spider(self, spider):
        self.file = open('output.csv', 'w', newline='', encoding='utf-8-sig')
        self.writer = None  # 延迟初始化，等拿到第一个 item 再写表头

    def close_spider(self, spider):
        self.file.close()

    def process_item(self, item, spider):
        # 第一个 item 到来时，用它的 keys 作为 CSV 表头
        if self.writer is None:
            self.writer = csv.DictWriter(self.file, fieldnames=item.keys())
            self.writer.writeheader()

        self.writer.writerow(item)
        return item
```

### 6.3 存储到数据库（SQLite 示例）

```python
import sqlite3

class SQLitePipeline:
    """将数据存储到 SQLite 数据库"""

    def open_spider(self, spider):
        self.conn = sqlite3.connect('books.db')
        self.cursor = self.conn.cursor()
        # 创建表（如果不存在）
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT,
                price REAL,
                rating INTEGER
            )
        ''')
        self.conn.commit()

    def close_spider(self, spider):
        self.conn.close()

    def process_item(self, item, spider):
        self.cursor.execute(
            'INSERT INTO books (title, author, price, rating) VALUES (?, ?, ?, ?)',
            (item.get('title'), item.get('author'), item.get('price'), item.get('rating'))
        )
        self.conn.commit()
        return item
```

### 6.4 三种存储方式对比

```
┌───────────────────────────────────────────────────────────┐
│                   存储方式对比                              │
│                                                           │
│  ┌──────────┬──────────┬──────────┬───────────┐           │
│  │   方式    │   优点    │   缺点    │  适用场景   │          │
│  ├──────────┼──────────┼──────────┼───────────┤           │
│  │  JSON    │ 可读性好   │ 文件大时   │ 小规模数据  │          │
│  │          │ 格式灵活   │ 读取慢     │ 配置/调试   │          │
│  ├──────────┼──────────┼──────────┼───────────┤           │
│  │  CSV     │ 体积小    │ 不支持嵌套  │ 表格型数据  │          │
│  │          │ Excel兼容  │ 类型信息丢失│ 数据分析    │          │
│  ├──────────┼──────────┼──────────┼───────────┤           │
│  │  数据库   │ 查询快    │ 配置复杂   │ 大规模数据  │          │
│  │          │ 支持索引   │ 需要额外服务│ 正式项目    │          │
│  └──────────┴──────────┴──────────┴───────────┘           │
└───────────────────────────────────────────────────────────┘
```

---

## 七、多个 Pipeline 协同工作

### 7.1 完整的 Pipeline 链

在实际项目中，我们通常会组合多个 Pipeline 形成一条完整的处理链：

```python
# pipelines.py —— 一个完整的数据处理方案

import json
import sqlite3
from scrapy.exceptions import DropItem


class CleanPipeline:
    """第 1 道工序：清洗数据（优先级 300）"""
    def process_item(self, item, spider):
        # 去空白、转类型
        if 'title' in item and isinstance(item['title'], str):
            item['title'] = item['title'].strip()
        if 'price' in item:
            try:
                item['price'] = float(
                    str(item['price']).replace('¥', '').replace(',', '').strip()
                )
            except ValueError:
                item['price'] = 0.0
        return item


class ValidatePipeline:
    """第 2 道工序：验证数据（优先级 400）"""
    def process_item(self, item, spider):
        if not item.get('title'):
            raise DropItem("缺少标题")
        if item.get('price', 0) <= 0:
            raise DropItem(f"价格无效: {item['title']}")
        return item


class DuplicatesPipeline:
    """第 3 道工序：去重（优先级 450）"""
    def __init__(self):
        self.seen_titles = set()

    def process_item(self, item, spider):
        title = item['title']
        if title in self.seen_titles:
            raise DropItem(f"重复数据: {title}")
        self.seen_titles.add(title)
        return item


class JsonSavePipeline:
    """第 4a 道工序：保存为 JSON（优先级 500）"""
    def open_spider(self, spider):
        self.file = open('books.json', 'w', encoding='utf-8')
        self.items = []

    def close_spider(self, spider):
        json.dump(self.items, self.file, ensure_ascii=False, indent=2)
        self.file.close()

    def process_item(self, item, spider):
        self.items.append(dict(item))
        return item


class SQLiteSavePipeline:
    """第 4b 道工序：保存到数据库（优先级 600）"""
    def open_spider(self, spider):
        self.conn = sqlite3.connect('books.db')
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT, author TEXT,
                price REAL, rating INTEGER
            )
        ''')
        self.conn.commit()

    def close_spider(self, spider):
        self.conn.close()

    def process_item(self, item, spider):
        self.cursor.execute(
            'INSERT INTO books (title, author, price, rating) VALUES (?,?,?,?)',
            (item.get('title'), item.get('author'),
             item.get('price'), item.get('rating'))
        )
        self.conn.commit()
        return item
```

对应的 `settings.py` 配置：

```python
ITEM_PIPELINES = {
    'myproject.pipelines.CleanPipeline':        300,
    'myproject.pipelines.ValidatePipeline':     400,
    'myproject.pipelines.DuplicatesPipeline':   450,
    'myproject.pipelines.JsonSavePipeline':     500,
    'myproject.pipelines.SQLiteSavePipeline':   600,
}
```

### 7.2 数据在 Pipeline 链中的流转

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Spider 产出 Item                                               │
│    │                                                            │
│    ▼                                                            │
│  CleanPipeline (300)                                            │
│    │  "  深入浅出Python  "  →  "深入浅出Python"                   │
│    │  "¥ 79.00"           →  79.0                               │
│    ▼                                                            │
│  ValidatePipeline (400)                                         │
│    │  title 非空? ✅                                             │
│    │  price > 0?  ✅                                             │
│    ▼                                                            │
│  DuplicatesPipeline (450)                                       │
│    │  "深入浅出Python" 第一次出现? ✅ 放行                         │
│    │  "深入浅出Python" 第二次出现? ✖ DropItem                     │
│    ▼                                                            │
│  JsonSavePipeline (500)                                         │
│    │  写入 books.json                                           │
│    ▼                                                            │
│  SQLiteSavePipeline (600)                                       │
│    │  写入 books.db                                             │
│    ▼                                                            │
│  处理完毕                                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 八、前端开发者对比：Express 中间件 vs Scrapy Pipeline

如果你有 Express 开发经验，这张对比表能帮你快速建立对应关系：

```
┌───────────────────────────────────────────────────────────────┐
│              Express Middleware vs Scrapy Pipeline             │
│                                                               │
│  ┌────────────────────┬────────────────────────┐              │
│  │   Express 中间件    │   Scrapy Pipeline      │              │
│  ├────────────────────┼────────────────────────┤              │
│  │ 处理 HTTP 请求/响应  │ 处理 Item 数据         │              │
│  │ next() 传递给下一层  │ return item 传递       │              │
│  │ 不调用 next() 阻断  │ raise DropItem 丢弃    │              │
│  │ app.use() 注册     │ ITEM_PIPELINES 配置     │              │
│  │ 顺序由代码位置决定   │ 顺序由优先级数字决定     │              │
│  │ req/res 对象       │ item + spider 对象      │              │
│  │ 一个请求经过所有中间件│ 一个 Item 经过所有管道   │              │
│  └────────────────────┴────────────────────────┘              │
│                                                               │
│  Express 示例:                                                │
│  app.use(cors());        // 第 1 层                           │
│  app.use(bodyParser);    // 第 2 层                           │
│  app.use(auth);          // 第 3 层                           │
│                                                               │
│  Scrapy 示例:                                                 │
│  ITEM_PIPELINES = {                                           │
│    'Clean':     300,   // 第 1 层                             │
│    'Validate':  400,   // 第 2 层                             │
│    'Save':      500,   // 第 3 层                             │
│  }                                                            │
└───────────────────────────────────────────────────────────────┘
```

核心思想是一样的：**链式处理，每层专注一件事**。

---

## 九、动手练习

### 练习 1：编写价格清洗 Pipeline

编写一个 `PriceCleanPipeline`，要求：
- 去除价格字段中的货币符号（¥、$、€）
- 去除千分位逗号
- 统一转换为 `float` 类型
- 如果转换失败，设置默认值为 `0.0`

```python
# 参考框架
class PriceCleanPipeline:
    def process_item(self, item, spider):
        # 你的代码写在这里
        ...
        return item
```

### 练习 2：编写数据验证 Pipeline 并丢弃无效数据

编写一个 `BookValidatePipeline`，要求：
- 标题（title）不能为空
- 价格（price）必须大于 0
- 评分（rating）必须在 1-5 之间
- 不满足条件的 Item 使用 `DropItem` 丢弃，并记录日志

### 练习 3：搭建完整的 Pipeline 链

创建三个 Pipeline 组成一条处理链：
1. `CleanPipeline`（优先级 300）：清洗字符串字段，转换价格和评分类型
2. `ValidatePipeline`（优先级 400）：验证数据完整性
3. `JsonSavePipeline`（优先级 500）：保存到 JSON 文件

在 `settings.py` 中正确配置 `ITEM_PIPELINES`，运行爬虫验证整条链是否正常工作。

---

## 小结

本课的核心知识点：

1. **Pipeline 是 Scrapy 的数据处理管道**，Item 从 Spider 产出后依次经过各个 Pipeline 处理
2. **三个核心方法**：`open_spider()` 初始化、`process_item()` 处理每个 Item、`close_spider()` 清理资源
3. **优先级数字越小越先执行**，通过 `ITEM_PIPELINES` 字典配置
4. **`process_item()` 必须返回 item 或抛出 DropItem**，返回 None 会导致错误
5. **DropItem 用于丢弃不合格数据**，被丢弃的 Item 不会传递给后续 Pipeline
6. **多个 Pipeline 各司其职**：清洗、验证、去重、存储分别放在不同 Pipeline 中
7. **存储方式灵活**：JSON 适合调试，CSV 适合分析，数据库适合正式项目

---

## 下一课预告

数据处理搞定了，但你有没有想过：Scrapy 是怎么管理 HTTP 请求的？为什么有时候请求失败了会自动重试？怎么给请求设置代理和随机 User-Agent？

下一课《中间件与去重》将带你深入 Scrapy 的请求处理机制，学习 Spider Middleware 和 Downloader Middleware 两大中间件系统，以及 Scrapy 内置的请求去重原理。这些是让你的爬虫更健壮、更不容易被反爬的关键技能。
