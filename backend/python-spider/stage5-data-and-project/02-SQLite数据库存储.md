# 第2课：SQLite 数据库存储

> **课程定位：** 第五阶段 · 数据存储与综合项目 · 第 2 课时
> **前置知识：** Python 基础语法、csv/json 文件存储、Scrapy Pipeline 基础
> **预计时长：** 60 分钟

---

## 场景引入

你的爬虫跑了一晚上，抓了 3 万条商品数据存成 JSON 文件。产品经理说"帮我查一下价格大于 100 且评分 4 星以上的商品"，你写了个 Python 脚本把整个 JSON 文件加载到内存里循环过滤——等了 15 秒才出结果。第二天他说"把这批商品的价格更新一下"，你又得读取、修改、重写整个文件。这时候你该考虑用数据库了。

---

## 学习目标

完成本课学习后，你将能够：

1. 理解 SQLite 的定位：轻量级、文件型、零配置的关系型数据库
2. 使用 Python 内置的 `sqlite3` 模块连接数据库、创建表、执行 SQL
3. 熟练编写 INSERT、SELECT、UPDATE、DELETE 四种 CRUD 操作
4. 使用参数化查询防止 SQL 注入攻击
5. 为爬虫数据设计合理的数据库表结构（Schema）
6. 使用索引加速查询
7. 将 SQLite 集成到 Scrapy Pipeline 中

---

## 一、SQLite 是什么——Excel 表格的"升级版"

### 1.1 用 Excel 理解数据库

如果你用过 Excel，你已经理解了数据库的大部分概念。把它们做个对照：

```
  ┌────────────────────┬────────────────────────────────────┐
  │    Excel 概念       │    数据库概念                       │
  ├────────────────────┼────────────────────────────────────┤
  │  一个 .xlsx 文件    │  一个数据库（Database）             │
  │  一个 Sheet         │  一张表（Table）                    │
  │  表头行             │  列定义（Column / Field）           │
  │  一行数据           │  一条记录（Row / Record）           │
  │  筛选/排序          │  SELECT + WHERE + ORDER BY         │
  │  VLOOKUP           │  JOIN 关联查询                      │
  │  数据透视表         │  GROUP BY 聚合统计                  │
  └────────────────────┴────────────────────────────────────┘
```

### 1.2 SQLite 的三大特点

```
  ┌───────────────────────────────────────────────────────────┐
  │                    SQLite 特点                              │
  │                                                           │
  │  ┌─────────────────────────────────────────────────────┐  │
  │  │  1. 轻量级                                          │  │
  │  │     整个数据库引擎不到 1MB，Python 内置自带           │  │
  │  │     不需要安装、不需要配置、pip 都不用装              │  │
  │  └─────────────────────────────────────────────────────┘  │
  │                                                           │
  │  ┌─────────────────────────────────────────────────────┐  │
  │  │  2. 文件型                                          │  │
  │  │     一个 .db 文件就是整个数据库                       │  │
  │  │     复制文件 = 备份数据库，发送文件 = 共享数据         │  │
  │  │     不像 MySQL 需要运行一个服务进程                   │  │
  │  └─────────────────────────────────────────────────────┘  │
  │                                                           │
  │  ┌─────────────────────────────────────────────────────┐  │
  │  │  3. 零配置                                          │  │
  │  │     不需要创建用户、设置密码、配置端口                │  │
  │  │     import sqlite3 就能用                            │  │
  │  └─────────────────────────────────────────────────────┘  │
  └───────────────────────────────────────────────────────────┘
```

> **生活类比：** SQLite 就像一个笔记本——打开就能写，合上就能带走。MySQL/PostgreSQL 像一个档案室——需要钥匙、管理员、固定的房间。

### 1.3 什么时候用什么数据库

```
  ┌────────────────────────────────────────────────────────────────┐
  │                    数据库选型指南                                │
  │                                                                │
  │  你的项目规模？                                                 │
  │        │                                                       │
  │   ┌────┴─────────────────────────────────────────┐             │
  │   ▼                                              ▼             │
  │  个人/小型项目                              团队/生产环境        │
  │  单机运行、数据量 < 100万                      多人并发访问       │
  │   │                                              │             │
  │   ▼                                              ▼             │
  │  ┌──────────┐                            需要高并发？            │
  │  │  SQLite  │                                   │              │
  │  │  就够了  │                            ┌──────┴──────┐       │
  │  └──────────┘                            ▼             ▼       │
  │                                    ┌──────────┐ ┌───────────┐  │
  │                                    │  MySQL   │ │PostgreSQL │  │
  │                                    │ Web 首选  │ │ 复杂查询  │  │
  │                                    └──────────┘ └───────────┘  │
  └────────────────────────────────────────────────────────────────┘

  对爬虫项目来说：SQLite 是最佳起步选择。
  数据量不大、单机运行、不需要装额外软件。
  等项目长大了再迁移到 MySQL 也不迟——SQL 语法几乎一样。
```

---

## 二、sqlite3 基础操作

### 2.1 连接数据库

```python
import sqlite3

# 连接数据库（文件不存在会自动创建）
conn = sqlite3.connect('spider_data.db')

# 创建游标（用来执行 SQL）
cursor = conn.cursor()

# 用完记得关闭
cursor.close()
conn.close()
```

```
  连接流程：

  ┌──────────┐     connect()      ┌──────────┐
  │  Python  │ ─────────────────→ │  .db 文件 │
  │  程序    │                    │  数据库   │
  └────┬─────┘                    └──────────┘
       │
       │  cursor()
       ▼
  ┌──────────┐
  │  Cursor  │  ← 通过游标执行 SQL
  │  游标     │
  └──────────┘
```

> **生活类比：** `connect()` 是打开笔记本，`cursor()` 是拿起笔，`execute()` 是写字，`close()` 是合上笔记本。

### 2.2 用 with 语句自动管理连接

每次都手动 `close()` 太麻烦，还容易忘。用 `with` 语句自动管理：

```python
import sqlite3

# ✅ 推荐：with 语句自动提交和关闭
with sqlite3.connect('spider_data.db') as conn:
    cursor = conn.cursor()
    cursor.execute('CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT)')
    # with 块结束时自动 commit 和 close

# ❌ 不推荐：手动管理，容易忘记 close
conn = sqlite3.connect('spider_data.db')
cursor = conn.cursor()
cursor.execute('...')
# 如果中间出异常，close() 可能不会执行
conn.close()
```

---

## 三、创建表——定义数据结构

### 3.1 CREATE TABLE 语法

```python
import sqlite3

with sqlite3.connect('spider_data.db') as conn:
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS books (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            title    TEXT    NOT NULL,
            author   TEXT,
            price    REAL,
            rating   INTEGER,
            url      TEXT    UNIQUE,
            created  TEXT    DEFAULT (datetime('now', 'localtime'))
        )
    ''')
    print('表创建成功！')
```

```
  表结构图示：

  books 表
  ┌────┬──────────────┬──────────┬───────┬────────┬──────────────────┬───────────────┐
  │ id │    title     │  author  │ price │ rating │       url        │    created    │
  ├────┼──────────────┼──────────┼───────┼────────┼──────────────────┼───────────────┤
  │ 1  │ Python编程   │ 张三     │ 89.0  │   4    │ https://.../1    │ 2026-06-01... │
  │ 2  │ JS高级       │ 李四     │ 129.0 │   5    │ https://.../2    │ 2026-06-01... │
  │ 3  │ CSS揭秘      │ 王五     │ 69.0  │   4    │ https://.../3    │ 2026-06-01... │
  └────┴──────────────┴──────────┴───────┴────────┴──────────────────┴───────────────┘
    ↑         ↑            ↑        ↑       ↑           ↑                  ↑
  自增主键   非空文本      文本      实数    整数       唯一约束           默认当前时间
```

### 3.2 SQLite 常用数据类型

```
  ┌─────────────┬──────────────────────────────────────────────┐
  │  SQLite 类型  │  说明                                        │
  ├─────────────┼──────────────────────────────────────────────┤
  │  INTEGER    │  整数，适合 id、评分、数量                     │
  │  REAL       │  浮点数，适合价格、百分比                      │
  │  TEXT        │  文本，适合标题、URL、描述                    │
  │  BLOB       │  二进制数据，适合图片、文件                    │
  │  NULL       │  空值                                        │
  └─────────────┴──────────────────────────────────────────────┘

  注意：SQLite 的类型是"宽松"的，你可以在 INTEGER 列存字符串。
  但为了数据质量，建议遵守类型约定。
```

### 3.3 约束条件

```sql
-- NOT NULL: 该列不能为空
title TEXT NOT NULL

-- UNIQUE: 该列值不能重复
url TEXT UNIQUE

-- DEFAULT: 设置默认值
created TEXT DEFAULT (datetime('now', 'localtime'))

-- PRIMARY KEY AUTOINCREMENT: 自增主键
id INTEGER PRIMARY KEY AUTOINCREMENT

-- 组合使用
price REAL NOT NULL DEFAULT 0.0
```

---

## 四、CRUD——增删改查四大操作

### 4.1 INSERT——插入数据

```python
import sqlite3

with sqlite3.connect('spider_data.db') as conn:
    cursor = conn.cursor()

    # 插入单条数据
    cursor.execute(
        'INSERT INTO books (title, author, price, rating, url) VALUES (?, ?, ?, ?, ?)',
        ('Python编程从入门到实践', 'Eric Matthes', 89.0, 4, 'https://example.com/1')
    )

    # 插入多条数据
    books_data = [
        ('深入理解计算机系统', 'Randal E. Bryant', 139.0, 5, 'https://example.com/2'),
        ('JavaScript高级程序设计', 'Matt Frisbie', 129.0, 4, 'https://example.com/3'),
        ('CSS揭秘', 'Lea Verou', 69.0, 5, 'https://example.com/4'),
    ]
    cursor.executemany(
        'INSERT INTO books (title, author, price, rating, url) VALUES (?, ?, ?, ?, ?)',
        books_data
    )

    # 别忘了 commit！否则数据不会真正写入文件
    conn.commit()
    print(f'插入了 {cursor.rowcount} 条数据')
```

```
  INSERT 流程：

  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │  准备数据    │────→│  execute()  │────→│  commit()   │
  │  (Python)   │     │  执行SQL    │     │  确认写入    │
  └─────────────┘     └─────────────┘     └─────────────┘
                                            ↑
                                      不调用 commit()
                                      数据只在内存中，
                                      关闭连接就丢失！
```

> **重要提醒：** `execute()` 之后必须 `commit()`，否则数据只在内存里，不会写入 .db 文件。这是新手最容易犯的错。

### 4.2 SELECT——查询数据

```python
import sqlite3

with sqlite3.connect('spider_data.db') as conn:
    # 让查询结果返回字典而不是元组
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 查询所有数据
    cursor.execute('SELECT * FROM books')
    all_books = cursor.fetchall()
    for book in all_books:
        print(dict(book))  # {'id': 1, 'title': 'Python编程...', ...}

    # 条件查询
    cursor.execute('SELECT title, price FROM books WHERE price > ?', (100,))
    expensive = cursor.fetchall()
    for book in expensive:
        print(f'{book["title"]}: ¥{book["price"]}')

    # 模糊查询
    cursor.execute("SELECT * FROM books WHERE title LIKE ?", ('%Python%',))
    python_books = cursor.fetchall()

    # 排序 + 限制数量
    cursor.execute('SELECT * FROM books ORDER BY price DESC LIMIT 3')
    top3 = cursor.fetchall()

    # 聚合统计
    cursor.execute('SELECT COUNT(*) as count, AVG(price) as avg_price FROM books')
    stats = cursor.fetchone()
    print(f'共 {stats["count"]} 本书，平均价格 ¥{stats["avg_price"]:.2f}')
```

```
  SELECT 结果集：

  fetchall() → 返回所有行（列表）
  fetchone() → 返回一行（元组/字典）
  fetchmany(n) → 返回前 n 行

  ┌───────────────────────────────────────────────────────────┐
  │  cursor.execute('SELECT * FROM books WHERE price > 100')  │
  │                                                           │
  │  结果集:                                                   │
  │  ┌────┬──────────────────────┬──────────┬───────┐         │
  │  │ id │        title         │  author  │ price │         │
  │  ├────┼──────────────────────┼──────────┼───────┤         │
  │  │ 2  │ 深入理解计算机系统    │ Randal   │ 139.0 │         │
  │  │ 3  │ JS高级程序设计        │ Matt     │ 129.0 │         │
  │  └────┴──────────────────────┴──────────┴───────┘         │
  └───────────────────────────────────────────────────────────┘
```

### 4.3 UPDATE——更新数据

```python
import sqlite3

with sqlite3.connect('spider_data.db') as conn:
    cursor = conn.cursor()

    # 更新单条记录
    cursor.execute(
        'UPDATE books SET price = ? WHERE url = ?',
        (99.0, 'https://example.com/1')
    )

    # 批量更新：所有评分低于 3 的设为 3
    cursor.execute(
        'UPDATE books SET rating = ? WHERE rating < ?',
        (3, 3)
    )

    conn.commit()
    print(f'更新了 {cursor.rowcount} 条记录')
```

### 4.4 DELETE——删除数据

```python
import sqlite3

with sqlite3.connect('spider_data.db') as conn:
    cursor = conn.cursor()

    # 删除特定记录
    cursor.execute('DELETE FROM books WHERE url = ?', ('https://example.com/4',))

    # 删除所有价格为 0 的记录（可能是抓取失败的）
    cursor.execute('DELETE FROM books WHERE price = ?', (0,))

    conn.commit()
    print(f'删除了 {cursor.rowcount} 条记录')
```

```
  CRUD 四大操作速查：

  ┌──────────┬──────────────────────────────────────────────┐
  │  操作     │  SQL                                          │
  ├──────────┼──────────────────────────────────────────────┤
  │  增 Create │  INSERT INTO 表 (列...) VALUES (值...)       │
  │  查 Read   │  SELECT 列... FROM 表 WHERE 条件             │
  │  改 Update │  UPDATE 表 SET 列=值 WHERE 条件              │
  │  删 Delete │  DELETE FROM 表 WHERE 条件                   │
  └──────────┴──────────────────────────────────────────────┘
```

---

## 五、参数化查询——防止 SQL 注入

### 5.1 什么是 SQL 注入

SQL 注入是最常见的 Web 安全漏洞之一。作为爬虫开发者，虽然你主要写的是数据存储代码，但理解这个概念很重要。

```
  SQL 注入攻击示意：

  ┌───────────────────────────────────────────────────────────┐
  │                                                           │
  │  正常输入: title = "Python编程"                             │
  │                                                           │
  │  拼接后的 SQL:                                              │
  │  SELECT * FROM books WHERE title = 'Python编程'            │
  │  → 正常查询 ✅                                             │
  │                                                           │
  │  恶意输入: title = "'; DROP TABLE books; --"               │
  │                                                           │
  │  拼接后的 SQL:                                              │
  │  SELECT * FROM books WHERE title = ''; DROP TABLE books;--'│
  │                          ↑              ↑                  │
  │                       正常查询结束    删除整个表！            │
  │  → 数据全没了 ❌                                            │
  └───────────────────────────────────────────────────────────┘
```

### 5.2 用参数化查询防御

```python
import sqlite3

title_input = "'; DROP TABLE books; --"  # 模拟恶意输入

with sqlite3.connect('spider_data.db') as conn:
    cursor = conn.cursor()

    # ❌ 错误：用字符串拼接（危险！）
    sql = f"SELECT * FROM books WHERE title = '{title_input}'"
    print(sql)
    # SELECT * FROM books WHERE title = ''; DROP TABLE books; --'
    # → SQL 注入成功，表被删除

    # ✅ 正确：用参数化查询（安全！）
    cursor.execute("SELECT * FROM books WHERE title = ?", (title_input,))
    # SQLite 会自动转义特殊字符，把整个输入当作一个值
    # → 安全，不会执行恶意 SQL
```

```
  参数化查询原理：

  ┌───────────────────────────────────────────────────────────┐
  │                                                           │
  │  你写的代码:                                                │
  │  cursor.execute("SELECT * FROM books WHERE title = ?",    │
  │                 ("'; DROP TABLE books; --",))              │
  │                                                           │
  │  SQLite 内部处理:                                           │
  │  1. 先解析 SQL 结构 → "查询 books 表，条件是 title 等于某值" │
  │  2. 再把参数值安全地填入 → 整个恶意字符串被当作一个普通值     │
  │  3. 不会把它当作 SQL 代码执行                               │
  │                                                           │
  │  就像：你告诉快递员"把这个包裹送给张三"                      │
  │  包裹上写什么内容，快递员不会去执行它                        │
  └───────────────────────────────────────────────────────────┘
```

> **铁律：** 永远用 `?` 占位符，永远不要用字符串拼接构建 SQL。

---

## 六、为爬虫数据设计表结构

### 6.1 Schema 设计思路

爬虫抓到的数据通常是字典或 Item 对象。设计表结构时，你需要考虑：

```
  ┌───────────────────────────────────────────────────────────┐
  │              Schema 设计思考流程                            │
  │                                                           │
  │  1. 有哪些字段？                                           │
  │     爬取的每个 Item 有哪些 key？                           │
  │                                                           │
  │  2. 用什么类型？                                           │
  │     文本 → TEXT，数字 → INTEGER/REAL，时间 → TEXT          │
  │                                                           │
  │  3. 哪些字段不能空？                                       │
  │     比如 title 通常 NOT NULL                              │
  │                                                           │
  │  4. 哪些字段要唯一？                                       │
  │     比如 url 应该 UNIQUE（防止重复入库）                    │
  │                                                           │
  │  5. 需要哪些索引？                                         │
  │     经常 WHERE 的字段加索引                                │
  │                                                           │
  │  6. 有关联关系吗？                                         │
  │     比如书和评论是一对多关系                                │
  └───────────────────────────────────────────────────────────┘
```

### 6.2 单表设计示例

```python
import sqlite3

def create_books_table(db_path='spider_data.db'):
    """创建书籍表"""
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                title     TEXT    NOT NULL,
                author    TEXT,
                price     REAL    DEFAULT 0.0,
                rating    INTEGER DEFAULT 0,
                url       TEXT    UNIQUE,
                tags      TEXT,
                created   TEXT    DEFAULT (datetime('now', 'localtime')),
                updated   TEXT    DEFAULT (datetime('now', 'localtime'))
            )
        ''')
        # 为经常查询的字段创建索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_books_title ON books(title)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_books_author ON books(author)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_books_price ON books(price)')
        print('books 表和索引创建成功')
```

### 6.3 多表设计示例（一对多关系）

一本书有多个评论，如果把评论塞进 books 表的一列里（像 JSON 那样），查询起来很不方便。更好的做法是分成两张表。

```python
import sqlite3

def create_tables(db_path='spider_data.db'):
    """创建书籍表和评论表"""
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        # 书籍表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                title     TEXT    NOT NULL,
                author    TEXT,
                price     REAL    DEFAULT 0.0,
                rating    INTEGER DEFAULT 0,
                url       TEXT    UNIQUE,
                created   TEXT    DEFAULT (datetime('now', 'localtime'))
            )
        ''')

        # 评论表（通过 book_id 关联书籍）
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reviews (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id   INTEGER NOT NULL,
                username  TEXT,
                rating    INTEGER,
                content   TEXT,
                created   TEXT    DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (book_id) REFERENCES books(id)
            )
        ''')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_reviews_book_id ON reviews(book_id)')
        print('books 和 reviews 表创建成功')
```

```
  一对多关系图示：

  books 表                           reviews 表
  ┌────┬──────────────┬───────┐     ┌────┬─────────┬──────────┬──────────┐
  │ id │    title     │ price │     │ id │ book_id │ username │ content  │
  ├────┼──────────────┼───────┤     ├────┼─────────┼──────────┼──────────┤
  │ 1  │ Python编程   │ 89.0  │←──┐ │ 1  │    1    │  读者A   │ 非常好   │
  │ 2  │ JS高级       │ 129.0 │   │ │ 2  │    1    │  读者B   │ 很实用   │
  └────┴──────────────┴───────┘   │ │ 3  │    2    │  读者C   │ 经典     │
                                  │ └────┴─────────┴──────────┴──────────┘
                                  │          ↑
                              book_id 是外键，关联到 books.id
```

---

## 七、索引——查询加速器

### 7.1 什么是索引

没有索引时，SQLite 查找数据就像从一本书的第一页翻到最后一页去找一个词——全表扫描。有了索引，就像翻到书最后的"索引页"，直接定位到页码。

```
  ┌───────────────────────────────────────────────────────────┐
  │                   索引的作用                                │
  │                                                           │
  │  没有索引（全表扫描）：                                      │
  │  SELECT * FROM books WHERE author = '张三'                 │
  │  → 逐行检查：第1行？不是。第2行？不是。...第10000行？是！     │
  │  → 检查了 10000 行 ❌                                       │
  │                                                           │
  │  有索引：                                                   │
  │  SELECT * FROM books WHERE author = '张三'                 │
  │  → 索引说：'张三' 在第 847 行 → 直接跳到第 847 行            │
  │  → 只检查了 1 行 ✅                                         │
  └───────────────────────────────────────────────────────────┘
```

### 7.2 创建和使用索引

```python
import sqlite3

with sqlite3.connect('spider_data.db') as conn:
    cursor = conn.cursor()

    # 为单列创建索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_price ON books(price)')

    # 为多列创建联合索引（适合经常一起 WHERE 的字段）
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_author_price ON books(author, price)')

    # 查看表的所有索引
    cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='books'")
    indexes = cursor.fetchall()
    for idx in indexes:
        print(idx[0])
```

### 7.3 索引的代价

索引不是越多越好。索引会占用额外的存储空间，而且每次 INSERT/UPDATE 时需要同步更新索引。

```
  ┌───────────────────────────────────────────────────────────┐
  │                索引使用的经验法则                            │
  │                                                           │
  │  ✅ 应该加索引的字段：                                      │
  │     - 经常出现在 WHERE 条件中的字段                         │
  │     - 经常用于 ORDER BY 排序的字段                          │
  │     - 经常用于 JOIN 关联的外键字段                          │
  │                                                           │
  │  ❌ 不应该加索引的字段：                                    │
  │     - 很少用于查询条件的字段                                │
  │     - 值几乎都相同的字段（比如"状态"只有 0 和 1）            │
  │     - 频繁更新的字段（每次更新都要维护索引）                  │
  │                                                           │
  │  对爬虫来说：                                               │
  │     - url（唯一且经常查询）→ UNIQUE 约束自带索引            │
  │     - title（经常搜索）→ 建议加索引                         │
  │     - price（经常筛选范围）→ 建议加索引                     │
  │     - created（偶尔查询）→ 可以不加                         │
  └───────────────────────────────────────────────────────────┘
```

---

## 八、集成到 Scrapy Pipeline

### 8.1 完整的 SQLite Pipeline

```python
import sqlite3


class SQLitePipeline:
    """将爬取数据存入 SQLite 数据库"""

    def open_spider(self, spider):
        """爬虫启动时：连接数据库，创建表"""
        db_path = spider.settings.get('SQLITE_DB_PATH', 'spider_data.db')
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                title     TEXT    NOT NULL,
                author    TEXT,
                price     REAL    DEFAULT 0.0,
                rating    INTEGER DEFAULT 0,
                url       TEXT    UNIQUE,
                created   TEXT    DEFAULT (datetime('now', 'localtime'))
            )
        ''')
        self.cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_books_title ON books(title)'
        )
        self.conn.commit()
        spider.logger.info('SQLite 数据库连接成功')

    def close_spider(self, spider):
        """爬虫结束时：关闭数据库连接"""
        self.conn.close()
        spider.logger.info('SQLite 数据库连接关闭')

    def process_item(self, item, spider):
        """每条数据到来时：插入数据库"""
        try:
            self.cursor.execute('''
                INSERT OR IGNORE INTO books (title, author, price, rating, url)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                item.get('title', ''),
                item.get('author', ''),
                item.get('price', 0.0),
                item.get('rating', 0),
                item.get('url', ''),
            ))
            self.conn.commit()
        except sqlite3.Error as e:
            spider.logger.error(f'数据库写入失败: {e}')

        return item
```

### 2.2 settings.py 配置

```python
# settings.py

ITEM_PIPELINES = {
    'myproject.pipelines.CleanPipeline':     300,
    'myproject.pipelines.ValidatePipeline':  400,
    'myproject.pipelines.SQLitePipeline':    500,
}

# 自定义配置：数据库文件路径
SQLITE_DB_PATH = 'books.db'
```

### 8.3 批量插入优化

每次 `execute()` 都 `commit()` 效率很低。更好的做法是攒一批再提交。

```python
import sqlite3


class BatchSQLitePipeline:
    """批量插入优化版 SQLite Pipeline"""

    def __init__(self):
        self.batch_size = 100  # 每 100 条提交一次
        self.buffer = []

    def open_spider(self, spider):
        self.conn = sqlite3.connect('spider_data.db')
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                title     TEXT    NOT NULL,
                author    TEXT,
                price     REAL    DEFAULT 0.0,
                rating    INTEGER DEFAULT 0,
                url       TEXT    UNIQUE,
                created   TEXT    DEFAULT (datetime('now', 'localtime'))
            )
        ''')
        self.conn.commit()

    def close_spider(self, spider):
        # 爬虫结束时，把缓冲区剩余数据提交
        self._flush()
        self.conn.close()

    def process_item(self, item, spider):
        self.buffer.append((
            item.get('title', ''),
            item.get('author', ''),
            item.get('price', 0.0),
            item.get('rating', 0),
            item.get('url', ''),
        ))
        # 缓冲区满了就批量提交
        if len(self.buffer) >= self.batch_size:
            self._flush()
        return item

    def _flush(self):
        """将缓冲区数据批量写入数据库"""
        if not self.buffer:
            return
        self.cursor.executemany('''
            INSERT OR IGNORE INTO books (title, author, price, rating, url)
            VALUES (?, ?, ?, ?, ?)
        ''', self.buffer)
        self.conn.commit()
        self.buffer.clear()
```

```
  批量插入 vs 逐条插入：

  ┌───────────────────────────────────────────────────────────┐
  │                                                           │
  │  逐条插入（100条数据 = 100次 commit）：                     │
  │  exec → commit → exec → commit → exec → commit → ...     │
  │  ⏱️ 耗时：约 500ms                                        │
  │                                                           │
  │  批量插入（100条数据 = 1次 commit）：                       │
  │  exec → exec → exec → ... → commit（一次提交）             │
  │  ⏱️ 耗时：约 20ms                                         │
  │                                                           │
  │  性能差距：25 倍！                                          │
  └───────────────────────────────────────────────────────────┘
```

---

## 九、SQLite vs JSON 文件存储

### 9.1 对比

```
  ┌────────────────────────────────────────────────────────────────┐
  │              SQLite vs JSON 文件存储                             │
  │                                                                │
  │  ┌──────────────────┬─────────────────┬─────────────────────┐  │
  │  │                  │    JSON 文件     │      SQLite         │  │
  │  ├──────────────────┼─────────────────┼─────────────────────┤  │
  │  │  查询效率         │  慢（全部加载）   │  快（索引+SQL）     │  │
  │  │  筛选数据         │  Python 循环过滤  │  WHERE 条件直接查   │  │
  │  │  更新单条         │  读取→修改→重写   │  UPDATE 直接改      │  │
  │  │  去重             │  需要自己写逻辑   │  UNIQUE 约束自动    │  │
  │  │  统计聚合         │  Python 计算      │  COUNT/AVG/SUM     │  │
  │  │  数据量           │  < 1万条合适     │  < 100万条都行      │  │
  │  │  可读性           │  ✅ 文本可直接看   │  ⚠️ 需要工具查看    │  │
  │  │  与前端对接       │  ✅ 直接用        │  ⚠️ 需要转换       │  │
  │  │  并发写入         │  ❌ 不安全        │  ✅ 支持            │  │
  │  └──────────────────┴─────────────────┴─────────────────────┘  │
  └────────────────────────────────────────────────────────────────┘
```

### 9.2 同一个查询的代码对比

假设要查询"价格大于 100 且评分大于 4 的书籍"：

```python
# ===== JSON 文件方式 =====
import json

with open('books.json', 'r', encoding='utf-8') as f:
    books = json.load(f)  # 全部加载到内存

# Python 循环过滤
results = [b for b in books if b['price'] > 100 and b['rating'] > 4]

# ===== SQLite 方式 =====
import sqlite3

with sqlite3.connect('books.db') as conn:
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM books WHERE price > ? AND rating > ?',
        (100, 4)
    )
    results = [dict(row) for row in cursor.fetchall()]
```

数据量小的时候差别不大。但当数据量到 10 万条时，JSON 需要全部加载到内存再过滤，SQLite 有索引的话直接定位，差距会非常明显。

---

## 十、动手练习

### 练习 1：基本 CRUD 操作

创建一个 `students.db` 数据库，包含 `students` 表（id, name, age, score），然后：

1. 插入 5 条学生数据
2. 查询所有 score > 80 的学生
3. 将 name 为"张三"的 score 更新为 95
4. 删除 age < 18 的记录
5. 查询剩余记录数

### 练习 2：参数化查询练习

编写一个函数 `search_books(db_path, keyword)`，接收数据库路径和搜索关键词，使用参数化查询在 books 表的 title 字段中进行模糊搜索，返回匹配结果列表。

要求：
- 必须使用 `?` 占位符，禁止字符串拼接
- 返回结果为字典列表

### 练习 3：Scrapy Pipeline 实战

为你的爬虫项目编写一个完整的 `SQLitePipeline`，要求：

- 爬虫启动时自动创建表和索引
- 使用 `INSERT OR IGNORE` 防止重复插入
- 实现批量提交（每 50 条 commit 一次）
- 爬虫结束时打印统计信息：共插入多少条，跳过多少条

---

## 常见误区

- **`execute()` 之后不需要 `commit()`**：这是新手最常犯的错误。`execute()` 只是把 SQL 送到内存中的数据库，`commit()` 才是真正写入 `.db` 文件。忘记 commit，关掉连接后数据就丢了。
- **用字符串拼接 SQL 更灵活**：直接用 f-string 拼接 SQL 看起来简单，但会导致 SQL 注入漏洞。永远用 `?` 占位符做参数化查询，这是铁律，没有例外。
- **索引越多查询越快**：索引确实能加速查询，但每次 INSERT/UPDATE 都要同步更新索引，写入性能会下降。只给真正频繁查询的字段加索引，不要滥用。
- **SQLite 不适合生产环境**：SQLite 能处理百万级数据、支持并发读取，对于单机应用和中小型项目完全够用。只有在需要多机并发写入时才需要考虑 MySQL/PostgreSQL。

---

## 工程建议

- **用 `with` 语句管理数据库连接**：`with sqlite3.connect(db) as conn` 能在异常发生时自动提交或回滚，避免连接泄漏。比手动 `try/finally/close` 更简洁安全。
- **批量操作用 `executemany` + 攒批提交**：逐条 `execute` + `commit` 的性能比批量提交慢 10 倍以上。建议每 100-500 条数据提交一次，或在 Pipeline 的 `close_spider` 中提交剩余数据。
- **设计表结构时加上 `created_at` 和 `updated_at` 时间戳**：这两个字段在排查问题、做增量更新、数据审计时非常有用，几乎零成本但收益巨大。
- **用 `INSERT OR IGNORE` 处理重复数据**：配合 `UNIQUE` 约束（比如 URL 字段），可以优雅地跳过已存在的记录，不需要额外写去重逻辑。

---

## 小结

本课的核心知识点：

1. **SQLite 定位**：轻量级、文件型、零配置的关系型数据库，Python 内置自带，非常适合爬虫项目
2. **核心流程**：`connect()` 连接 → `cursor()` 创建游标 → `execute()` 执行 SQL → `commit()` 提交 → `close()` 关闭
3. **CRUD 操作**：INSERT 插入、SELECT 查询、UPDATE 更新、DELETE 删除，配合 `?` 参数化查询
4. **参数化查询**：永远用 `?` 占位符，永远不要字符串拼接 SQL，这是防止 SQL 注入的铁律
5. **表结构设计**：根据爬取数据的字段设计列，用 NOT NULL/UNIQUE/DEFAULT 约束保证数据质量
6. **索引加速**：为经常查询的字段创建索引，但不要滥用——索引有维护成本
7. **Scrapy 集成**：在 Pipeline 的 `open_spider` 中建表，`process_item` 中插入，`close_spider` 中关闭连接
8. **批量优化**：攒一批数据再 `commit()`，性能比逐条提交提升 10 倍以上

```
  本课知识地图：

  ┌─────────────────────────────────────────────────────────┐
  │              SQLite 数据库存储                            │
  ├──────────────┬──────────────────┬───────────────────────┤
  │   基础操作    │   设计与优化      │   Scrapy 集成         │
  │              │                  │                       │
  │  connect()   │  Schema 设计      │  SQLitePipeline      │
  │  execute()   │  数据类型         │  open_spider         │
  │  commit()    │  约束条件         │  process_item        │
  │  fetchall()  │  索引             │  close_spider        │
  │  参数化查询   │  一对多关系       │  批量提交优化         │
  └──────────────┴──────────────────┴───────────────────────┘
```

---

## 下一课预告

数据存储的两大招——文件存储和数据库存储——你都学会了。但你有没有想过，当爬取规模变大、目标网站变多时，手动管理爬虫会变得很痛苦：今天爬这个网站，明天爬那个网站，每个网站的规则都不一样，怎么统一管理？

下一课《数据清洗实战》将继续处理“数据入库前后是否干净”的问题。你将学习如何用字符串处理、正则表达式和 pandas 清洗标题、价格、评分、日期等字段，为后续 API 采集和综合项目打好数据质量基础。
---

## 参考答案

### 练习一

**思路**：使用 `sqlite3.connect()` 创建数据库，通过 `CREATE TABLE` 建表，然后依次执行 INSERT、SELECT、UPDATE、DELETE 操作。注意每次修改操作后要 `commit()`。

**答案**：

```python
import sqlite3

with sqlite3.connect('students.db') as conn:
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name  TEXT    NOT NULL,
            age   INTEGER,
            score REAL
        )
    ''')

    students = [
        ('张三', 20, 85),
        ('李四', 19, 92),
        ('王五', 17, 78),
        ('赵六', 21, 88),
        ('钱七', 16, 95),
    ]
    cursor.executemany(
        'INSERT INTO students (name, age, score) VALUES (?, ?, ?)',
        students
    )
    conn.commit()
    print(f'插入了 {cursor.rowcount} 条数据')

    cursor.execute('SELECT * FROM students WHERE score > ?', (80,))
    high_scores = cursor.fetchall()
    print('\nscore > 80 的学生：')
    for s in high_scores:
        print(f'  {s}')

    cursor.execute(
        'UPDATE students SET score = ? WHERE name = ?',
        (95, '张三')
    )
    conn.commit()
    print(f'\n更新了 {cursor.rowcount} 条记录')

    cursor.execute('DELETE FROM students WHERE age < ?', (18,))
    conn.commit()
    print(f'删除了 {cursor.rowcount} 条记录')

    cursor.execute('SELECT COUNT(*) FROM students')
    count = cursor.fetchone()[0]
    print(f'\n剩余记录数: {count}')

    cursor.execute('SELECT * FROM students')
    for s in cursor.fetchall():
        print(f'  {s}')
```

**要点**：
- `executemany()` 可以一次性插入多条数据，比循环 `execute()` 更高效
- 每次 INSERT/UPDATE/DELETE 后必须 `commit()`，否则数据不会写入文件
- `?` 占位符用于参数化查询，防止 SQL 注入
- `fetchall()` 返回所有结果，`fetchone()` 返回一条结果

### 练习二

**思路**：编写一个接收数据库路径和关键词的函数，使用 `LIKE` 模糊查询配合 `?` 参数化查询，将结果转换为字典列表返回。

**答案**：

```python
import sqlite3


def search_books(db_path, keyword):
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM books WHERE title LIKE ?",
            (f'%{keyword}%',)
        )
        results = [dict(row) for row in cursor.fetchall()]
    return results


if __name__ == '__main__':
    with sqlite3.connect('test_books.db') as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                price REAL
            )
        ''')
        cursor.executemany(
            'INSERT OR IGNORE INTO books (title, price) VALUES (?, ?)',
            [
                ('Python编程从入门到实践', 89.0),
                ('深入理解计算机系统', 139.0),
                ('Python机器学习', 99.0),
                ('JavaScript高级程序设计', 129.0),
            ]
        )
        conn.commit()

    results = search_books('test_books.db', 'Python')
    print(f'找到 {len(results)} 本包含 Python 的书籍：')
    for book in results:
        print(f"  {book['title']} - {book['price']}")
```

**要点**：
- `LIKE` 配合 `%` 通配符实现模糊搜索，`%keyword%` 表示包含关键词
- 必须用 `?` 占位符传递参数，不能直接拼接 SQL
- `conn.row_factory = sqlite3.Row` 让查询结果可以用列名访问，转字典更方便
- 返回字典列表比返回元组列表更易用

### 练习三

**思路**：在 `open_spider` 中建表和索引，`process_item` 中用 `INSERT OR IGNORE` 插入数据并攒批，`close_spider` 中提交剩余数据并打印统计。

**答案**：

```python
import sqlite3


class SQLitePipeline:
    def __init__(self):
        self.batch_size = 50
        self.buffer = []
        self.inserted_count = 0
        self.skipped_count = 0

    @classmethod
    def from_crawler(cls, crawler):
        db_path = crawler.settings.get('SQLITE_DB_PATH', 'spider_data.db')
        pipeline = cls()
        pipeline.db_path = db_path
        return pipeline

    def open_spider(self, spider):
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                title     TEXT    NOT NULL,
                author    TEXT,
                price     REAL    DEFAULT 0.0,
                rating    INTEGER DEFAULT 0,
                url       TEXT    UNIQUE,
                created   TEXT    DEFAULT (datetime('now', 'localtime'))
            )
        ''')
        self.cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_books_title ON books(title)'
        )
        self.cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_books_price ON books(price)'
        )
        self.conn.commit()
        spider.logger.info('SQLite Pipeline 已启动')

    def close_spider(self, spider):
        self._flush()
        self.conn.close()
        spider.logger.info(
            f'SQLite Pipeline 已关闭。'
            f'共插入 {self.inserted_count} 条，'
            f'跳过 {self.skipped_count} 条'
        )

    def process_item(self, item, spider):
        self.buffer.append((
            item.get('title', ''),
            item.get('author', ''),
            item.get('price', 0.0),
            item.get('rating', 0),
            item.get('url', ''),
        ))
        if len(self.buffer) >= self.batch_size:
            self._flush()
        return item

    def _flush(self):
        if not self.buffer:
            return
        for record in self.buffer:
            try:
                self.cursor.execute('''
                    INSERT OR IGNORE INTO books
                    (title, author, price, rating, url)
                    VALUES (?, ?, ?, ?, ?)
                ''', record)
                if self.cursor.rowcount > 0:
                    self.inserted_count += 1
                else:
                    self.skipped_count += 1
            except sqlite3.Error:
                self.skipped_count += 1
        self.conn.commit()
        self.buffer.clear()
```

```python
# settings.py
ITEM_PIPELINES = {
    'myproject.pipelines.SQLitePipeline': 500,
}
SQLITE_DB_PATH = 'books.db'
```

**要点**：
- `INSERT OR IGNORE` 配合 `UNIQUE` 约束自动跳过重复数据，不需要手动判断
- 批量提交（每 50 条一次）比逐条提交性能提升 10 倍以上
- `close_spider` 中调用 `_flush()` 确保缓冲区剩余数据不丢失
- `from_crawler` 是 Scrapy 推荐的从 settings 获取配置的方式
