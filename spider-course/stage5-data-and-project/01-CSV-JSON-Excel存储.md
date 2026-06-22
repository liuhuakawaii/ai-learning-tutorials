# 第1课：CSV、JSON 与 Excel 存储深入

> **课程定位：** 第五阶段 · 数据存储与综合项目 · 第 1 课时
> **前置知识：** Python 基础语法、csv/json 模块基础用法、爬虫数据提取与清洗
> **预计时长：** 60 分钟

---

## 场景引入

你花了两天时间写了一个爬虫，成功从电商网站抓下来 5000 条商品数据。老板说"发我一份 Excel"，你信心满满地把数据存成 CSV 发过去——结果老板打开一看，中文全是乱码。你换成 JSON 发给前端同事，他说"嵌套太深，我还要自己解析标签列表"。这时候你意识到：存储格式不是随便选的，不同场景需要不同的方案。

---

## 学习目标

完成本课学习后，你将能够：

1. 掌握 CSV 的高级用法：自定义分隔符、quoting 控制、UTF-8-SIG 编码确保 Excel 兼容
2. 熟练使用 JSON 的嵌套结构存储、`ensure_ascii`/`indent`/`sort_keys` 参数的精确控制
3. 使用 openpyxl 库创建 Excel 工作簿、写入数据、设置单元格格式
4. 根据数据特征和使用场景，快速判断应该选择 CSV、JSON 还是 Excel
5. 从三种格式的文件中正确读回数据并还原类型
6. 处理大文件场景：流式写入 CSV、JSON Lines 格式
7. 将爬取的数据分别以三种格式持久化存储

---

## 一、CSV 深入——不只是逗号分隔

### 1.1 编码问题：为什么推荐 UTF-8-SIG

你在第二阶段学过 CSV 的基本写入，但可能已经踩过这个坑：写出来的 CSV 用记事本打开没问题，用 Excel 打开中文全变乱码。

```
  ┌───────────────────────────────────────────────────────────┐
  │                    编码问题示意                              │
  │                                                           │
  │  Python 写入 UTF-8 编码的 CSV:                             │
  │  ┌─────────────────────────────────────┐                  │
  │  │ 姓名,城市,年龄                       │                  │
  │  │ 张三,北京,28                         │                  │
  │  └─────────────────────────────────────┘                  │
  │       │                                                   │
  │       ▼                                                   │
  │  记事本/VS Code 打开 → ✅ 正常显示（它们识别 UTF-8）         │
  │  Excel 打开         → ❌ 乱码（Excel 默认用系统编码 GBK）    │
  │                                                           │
  │  解决方案：用 UTF-8-SIG（带 BOM 头的 UTF-8）                │
  │  ┌─────────────────────────────────────┐                  │
  │  │ [BOM头] 姓名,城市,年龄               │                  │
  │  │ 张三,北京,28                         │                  │
  │  └─────────────────────────────────────┘                  │
  │       │                                                   │
  │       ▼                                                   │
  │  Excel 打开 → ✅ 正常显示（BOM 头告诉 Excel "我是 UTF-8"）  │
  └───────────────────────────────────────────────────────────┘
```

BOM（Byte Order Mark）是文件开头的几个特殊字节（`\xef\xbb\xbf`），就像给文件贴了个标签："我是 UTF-8 编码的"。Excel 看到这个标签就知道怎么解码了。

```python
import csv

data = [
    {'书名': 'Python编程从入门到实践', '作者': 'Eric Matthes', '价格': 89.0},
    {'书名': '深入理解计算机系统', '作者': 'Randal E. Bryant', '价格': 139.0},
]

# ✅ 正确：用 utf-8-sig 编码，Excel 打开不乱码
with open('books.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=['书名', '作者', '价格'])
    writer.writeheader()
    writer.writerows(data)

# ❌ 错误：用 utf-8 编码，Excel 打开中文变乱码
with open('books_bad.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['书名', '作者', '价格'])
    writer.writeheader()
    writer.writerows(data)
```

> **生活类比：** UTF-8-SIG 就像国际快递上的"报关单"——包裹内容没变，但多了一张单子告诉海关"里面是什么"。没有报关单，海关（Excel）可能把你的东西认错。

### 1.2 自定义分隔符

逗号不是唯一的选择。有时候数据本身包含逗号（比如地址"北京市, 朝阳区"），用逗号做分隔符就会出问题。这时候可以换成制表符（`\t`）、分号（`;`）等。

```python
import csv

data = [
    {'姓名': '张三', '地址': '北京市, 朝阳区', '年龄': 28},
    {'姓名': '李四', '地址': '上海市, 浦东新区', '年龄': 32},
]

# 用制表符分隔（TSV 格式），避免地址中的逗号干扰
with open('data.tsv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=['姓名', '地址', '年龄'], delimiter='\t')
    writer.writeheader()
    writer.writerows(data)

# 用分号分隔（欧洲常用的 CSV 变体）
with open('data_semicolon.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=['姓名', '地址', '年龄'], delimiter=';')
    writer.writeheader()
    writer.writerows(data)
```

```
  常见分隔符对比：

  ┌──────────┬───────────────────────────────────────────────┐
  │  分隔符   │  适用场景                                     │
  ├──────────┼───────────────────────────────────────────────┤
  │  , 逗号   │  最通用，英文数据首选                          │
  │  \t 制表符│  数据含逗号时用，Excel 默认能识别               │
  │  ; 分号   │  欧洲地区常用（他们用逗号表示小数点）           │
  │  | 竖线   │  数据含逗号和制表符时的备选                     │
  └──────────┴───────────────────────────────────────────────┘
```

### 1.3 Quoting 控制：处理字段中的特殊字符

如果字段内容包含分隔符本身、换行符或引号，CSV 模块需要知道怎么处理。`quoting` 参数就是干这个的。

```python
import csv

data = [
    {'产品': '编程入门课', '描述': '适合零基础, 包含Python和JS', '价格': '99元'},
    {'产品': '数据分析课', '描述': '用Python做数据分析\n含实战项目', '价格': '199元'},
]

# 默认行为：只在需要时加引号（字段含分隔符或换行符时）
with open('quote_minimal.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=['产品', '描述', '价格'],
                            quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    writer.writerows(data)

# 所有字段都加引号（整齐，但文件稍大）
with open('quote_all.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=['产品', '描述', '价格'],
                            quoting=csv.QUOTE_ALL)
    writer.writeheader()
    writer.writerows(data)
```

```
  quoting 参数一览：

  ┌──────────────────┬─────────────────────────────────────────┐
  │  quoting 值       │  效果                                   │
  ├──────────────────┼─────────────────────────────────────────┤
  │  QUOTE_MINIMAL   │  只在必要时加引号（默认）                 │
  │  QUOTE_ALL       │  所有字段都加引号                        │
  │  QUOTE_NONNUMERIC│  非数字字段加引号                        │
  │  QUOTE_NONE      │  不加引号（用 escapechar 转义特殊字符）   │
  └──────────────────┴─────────────────────────────────────────┘
```

### 1.4 读回 CSV 数据并还原类型

CSV 读出来的所有值都是字符串。你需要手动转换类型。

```python
import csv

with open('books.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    books = []
    for row in reader:
        # 手动转换类型
        row['价格'] = float(row['价格'])
        books.append(row)

print(books[0]['价格'])      # 89.0（浮点数，不再是字符串）
print(type(books[0]['价格']))  # <class 'float'>
```

---

## 二、JSON 深入——结构化数据的利器

### 2.1 嵌套结构存储

爬虫抓到的数据往往不是扁平的。比如一本书有多个评论，一个商品有多个规格参数。JSON 天然支持这种嵌套结构。

```python
import json

books = [
    {
        '书名': 'Python编程',
        '作者': '张三',
        '价格': 79.0,
        '标签': ['Python', '入门', '编程'],
        '评论': [
            {'用户': '读者A', '评分': 5, '内容': '非常棒的入门书'},
            {'用户': '读者B', '评分': 4, '内容': '例子很实用'},
        ],
        '出版社': {
            '名称': '人民邮电出版社',
            '城市': '北京'
        }
    }
]

with open('books_nested.json', 'w', encoding='utf-8') as f:
    json.dump(books, f, ensure_ascii=False, indent=2)
```

```
  JSON 嵌套结构示意：

  ┌─────────────────────────────────────────────────┐
  │  books (数组)                                    │
  │  ┌─────────────────────────────────────────────┐│
  │  │  book[0] (对象)                              ││
  │  │  ├── 书名: "Python编程"                      ││
  │  │  ├── 作者: "张三"                            ││
  │  │  ├── 价格: 79.0                              ││
  │  │  ├── 标签: ["Python", "入门", "编程"]  ← 数组 ││
  │  │  ├── 评论:                           ← 数组  ││
  │  │  │   ├── { 用户: "读者A", 评分: 5 }   ← 对象  ││
  │  │  │   └── { 用户: "读者B", 评分: 4 }   ← 对象  ││
  │  │  └── 出版社:                         ← 对象  ││
  │  │      ├── 名称: "人民邮电出版社"               ││
  │  │      └── 城市: "北京"                        ││
  │  └─────────────────────────────────────────────┘│
  └─────────────────────────────────────────────────┘
```

对比一下：如果用 CSV 存储同样的数据，标签和评论只能变成一坨字符串，读回来还得自己解析，既麻烦又容易出错。

### 2.2 三个关键参数详解

`json.dump()` 和 `json.dumps()` 有三个参数你会反复用到：

```python
import json

data = {'书名': 'Python编程', '作者': '张三', '价格': 79.0}

# 参数 1：ensure_ascii —— 控制中文是否转义
# ❌ 默认 True，中文变成 \uXXXX
print(json.dumps(data))
# {"书名": "\u0050\u0079\u0074\u0068\u006f\u006e\u7f16\u7a0b", ...}

# ✅ 设为 False，中文正常显示
print(json.dumps(data, ensure_ascii=False))
# {"书名": "Python编程", "作者": "张三", "价格": 79.0}

# 参数 2：indent —— 控制缩进
# 适合人类阅读（调试、查看文件）
print(json.dumps(data, ensure_ascii=False, indent=2))
# {
#   "书名": "Python编程",
#   "作者": "张三",
#   "价格": 79.0
# }

# 适合程序传输（体积小，不换行）
print(json.dumps(data, ensure_ascii=False, indent=None))

# 参数 3：sort_keys —— 字段按字母排序
print(json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2))
# {
#   "价格": 79.0,
#   "书名": "Python编程",
#   "作者": "张三"
# }
```

```
  三个参数速查：

  ┌────────────────┬──────────┬──────────────────────────────┐
  │  参数           │  默认值   │  什么时候改                    │
  ├────────────────┼──────────┼──────────────────────────────┤
  │  ensure_ascii  │  True    │  有中文时必须设为 False        │
  │  indent        │  None    │  写文件时设 2，传输时用 None   │
  │  sort_keys     │  False   │  需要对比两个 JSON 时设为 True │
  └────────────────┴──────────┴──────────────────────────────┘
```

### 2.3 读回 JSON 数据

```python
import json

# 从文件读取
with open('books_nested.json', 'r', encoding='utf-8') as f:
    books = json.load(f)

# 访问嵌套数据
print(books[0]['书名'])                # Python编程
print(books[0]['标签'][0])             # Python
print(books[0]['评论'][0]['内容'])      # 非常棒的入门书
print(books[0]['出版社']['名称'])       # 人民邮电出版社

# 从字符串解析
json_str = '{"书名": "Python编程", "价格": 79.0}'
book = json.loads(json_str)
print(book['书名'])  # Python编程
```

---

## 三、Excel 存储——用 openpyxl 打造专业报表

### 3.1 为什么还需要 Excel

CSV 能用 Excel 打开，但它毕竟只是纯文本——没有单元格格式、没有多 Sheet、没有公式。当你的数据需要发给运营、产品或老板看时，一份格式精美的 Excel 明显更有说服力。

```
  ┌───────────────────────────────────────────────────────────┐
  │                    CSV vs Excel                            │
  │                                                           │
  │  ┌───────────────┬───────────────────┬─────────────────┐  │
  │  │               │       CSV         │     Excel       │  │
  │  ├───────────────┼───────────────────┼─────────────────┤  │
  │  │  文件体积      │  小（纯文本）      │  大（二进制）    │  │
  │  │  多 Sheet      │  ❌ 不支持         │  ✅ 支持        │  │
  │  │  单元格格式    │  ❌ 没有           │  ✅ 字体/颜色等  │  │
  │  │  公式计算      │  ❌ 不支持         │  ✅ 支持        │  │
  │  │  Python 依赖   │  内置模块          │  需装 openpyxl  │  │
  │  │  大数据量      │  ✅ 读写快         │  ⚠️ 较慢       │  │
  │  └───────────────┴───────────────────┴─────────────────┘  │
  └───────────────────────────────────────────────────────────┘
```

### 3.2 安装 openpyxl

```bash
pip install openpyxl
```

openpyxl 是 Python 操作 Excel（`.xlsx` 格式）最常用的库。它不支持老版 `.xls` 格式，但 `.xlsx` 是现在 Excel 的标准格式，够用了。

### 3.3 创建工作簿并写入数据

```python
from openpyxl import Workbook

# 创建工作簿
wb = Workbook()

# 获取默认的活动 Sheet
ws = wb.active
ws.title = '书籍数据'  # 重命名 Sheet

# 写入表头
headers = ['书名', '作者', '价格', '评分']
ws.append(headers)  # append 会自动换行

# 写入数据行
data = [
    ['Python编程从入门到实践', 'Eric Matthes', 89.0, 4.8],
    ['深入理解计算机系统', 'Randal E. Bryant', 139.0, 4.9],
    ['JavaScript高级程序设计', 'Matt Frisbie', 129.0, 4.7],
]

for row in data:
    ws.append(row)

# 保存文件
wb.save('books.xlsx')
print('Excel 文件已保存！')
```

```
  工作簿结构：

  ┌─────────────────────────────────────────────────────────┐
  │  Workbook (工作簿)                                       │
  │  ┌───────────────────────────────────────────────────┐  │
  │  │  Sheet: "书籍数据"                                  │  │
  │  │  ┌──────┬──────────────┬──────────┬──────┬──────┐  │  │
  │  │  │  行  │     A        │    B     │  C   │  D   │  │  │
  │  │  ├──────┼──────────────┼──────────┼──────┼──────┤  │  │
  │  │  │  1   │  书名         │  作者    │ 价格  │ 评分 │  │  │
  │  │  │  2   │  Python编程   │ Eric    │ 89.0 │ 4.8  │  │  │
  │  │  │  3   │  深入理解...   │ Randal  │139.0 │ 4.9  │  │  │
  │  │  │  4   │  JS高级...    │ Matt    │129.0 │ 4.7  │  │  │
  │  │  └──────┴──────────────┴──────────┴──────┴──────┘  │  │
  │  └───────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────┘
```

### 3.4 单元格格式化

```python
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, numbers

wb = Workbook()
ws = wb.active
ws.title = '书籍数据'

# 写入表头
headers = ['书名', '作者', '价格', '评分']
ws.append(headers)

# 格式化表头行
header_font = Font(name='微软雅黑', size=12, bold=True, color='FFFFFF')
header_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
header_align = Alignment(horizontal='center', vertical='center')

for cell in ws[1]:  # ws[1] 表示第一行
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_align

# 写入数据
data = [
    ['Python编程从入门到实践', 'Eric Matthes', 89.0, 4.8],
    ['深入理解计算机系统', 'Randal E. Bryant', 139.0, 4.9],
    ['JavaScript高级程序设计', 'Matt Frisbie', 129.0, 4.7],
]

for row_data in data:
    ws.append(row_data)

# 格式化数据区域
for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=3, max_col=3):
    for cell in row:
        cell.number_format = '¥#,##0.00'  # 价格格式：¥89.00

for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=4, max_col=4):
    for cell in row:
        cell.number_format = '0.0'  # 评分格式：保留一位小数

# 设置列宽
ws.column_dimensions['A'].width = 30
ws.column_dimensions['B'].width = 20
ws.column_dimensions['C'].width = 12
ws.column_dimensions['D'].width = 10

wb.save('books_formatted.xlsx')
print('格式化 Excel 已保存！')
```

### 3.5 多 Sheet 写入

```python
from openpyxl import Workbook

wb = Workbook()

# Sheet 1：书籍数据
ws1 = wb.active
ws1.title = '书籍'
ws1.append(['书名', '价格'])
ws1.append(['Python编程', 89.0])
ws1.append(['JS高级', 129.0])

# Sheet 2：评论数据
ws2 = wb.create_sheet('评论')
ws2.append(['书名', '用户', '评分', '内容'])
ws2.append(['Python编程', '读者A', 5, '非常好的入门书'])
ws2.append(['Python编程', '读者B', 4, '例子很实用'])

# Sheet 3：统计汇总
ws3 = wb.create_sheet('统计')
ws3.append(['指标', '数值'])
ws3.append(['总书籍数', 2])
ws3.append(['平均价格', 109.0])

wb.save('multi_sheet.xlsx')
print('多 Sheet Excel 已保存！')
```

### 3.6 从 Excel 读回数据

```python
from openpyxl import load_workbook

wb = load_workbook('books_formatted.xlsx')
ws = wb.active

# 方式 1：按行遍历
for row in ws.iter_rows(values_only=True):
    print(row)
# ('书名', '作者', '价格', '评分')
# ('Python编程从入门到实践', 'Eric Matthes', 89.0, 4.8)
# ...

# 方式 2：按单元格访问
print(ws['A1'].value)  # 书名
print(ws['C2'].value)  # 89.0

# 方式 3：读取为字典列表（跳过表头行）
headers = [cell.value for cell in ws[1]]
books = []
for row in ws.iter_rows(min_row=2, values_only=True):
    books.append(dict(zip(headers, row)))

print(books[0])  # {'书名': 'Python编程...', '作者': 'Eric Matthes', ...}
```

---

## 四、格式选择指南——CSV vs JSON vs Excel

### 4.1 决策流程图

```
                        你的数据要怎么用？
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        给人看/汇报       程序读取/API      数据分析
              │               │               │
              ▼               ▼               ▼
        ┌─────────┐    数据有嵌套？      ┌─────────┐
        │  Excel  │       │              │  pandas │
        │ (.xlsx) │    ┌──┴──┐           │ 读CSV最  │
        └─────────┘    是    否          │ 方便     │
                        │     │          └─────────┘
                        ▼     ▼
                   ┌────────┐ ┌────────┐
                   │  JSON  │ │  CSV   │
                   │(.json) │ │ (.csv) │
                   └────────┘ └────────┘
```

### 4.2 场景速查表

```
  ┌───────────────────────────┬──────┬──────┬───────┐
  │  场景                      │ CSV  │ JSON │ Excel │
  ├───────────────────────────┼──────┼──────┼───────┤
  │  数据是扁平表格             │  ✅  │  ✅  │  ✅   │
  │  数据有嵌套结构             │  ❌  │  ✅  │  ⚠️   │
  │  给运营/老板看              │  ⚠️  │  ❌  │  ✅   │
  │  传给前端页面展示           │  ⚠️  │  ✅  │  ❌   │
  │  大数据量（>10万行）        │  ✅  │  ✅  │  ⚠️   │
  │  需要公式/图表              │  ❌  │  ❌  │  ✅   │
  │  用 pandas 做分析           │  ✅  │  ✅  │  ✅   │
  │  配置文件/API 传输          │  ❌  │  ✅  │  ❌   │
  │  追加写入（增量数据）        │  ✅  │  ⚠️  │  ⚠️   │
  ├───────────────────────────┼──────┼──────┼───────┤
  │  ✅ 最佳选择  ⚠️ 可以但不理想  ❌ 不适合         │
  └───────────────────────────┴──────┴──────┴───────┘
```

> **一句话总结：** 扁平表格用 CSV，嵌套数据用 JSON，给人看用 Excel。

---

## 五、大文件处理

### 5.1 问题：内存撑不住

假设你爬了 100 万条数据，全部加载到内存再写文件？内存直接爆掉。

```
  ┌───────────────────────────────────────────────────────────┐
  │                   内存问题示意                              │
  │                                                           │
  │  错误做法：全部加载到内存                                    │
  │  ┌─────────────────────────────────────┐                  │
  │  │  100万条数据 → 全部存入列表 → 一次性写入 │  内存: 💥💥💥   │
  │  └─────────────────────────────────────┘                  │
  │                                                           │
  │  正确做法：流式处理，来一条写一条                             │
  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐                                    │
  │  │1 │→│2 │→│3 │→│4 │→ ... → 写入文件    内存: 😊          │
  │  └──┘ └──┘ └──┘ └──┘                                    │
  └───────────────────────────────────────────────────────────┘
```

### 5.2 流式写入 CSV

CSV 天然适合流式写入——每条数据就是一行，写完就释放。

```python
import csv

def stream_write_csv(data_iterator, filename, fieldnames):
    """流式写入 CSV，data_iterator 是一个生成器"""
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        count = 0
        for item in data_iterator:
            writer.writerow(item)  # 写一条，内存里只保留一条
            count += 1
    print(f'共写入 {count} 条数据')

# 模拟爬虫数据生成器（实际中可能是从网络逐条获取）
def crawl_data():
    for i in range(1000000):
        yield {'id': i, 'title': f'商品{i}', 'price': i * 1.5}

# 流式写入，内存占用极低
stream_write_csv(crawl_data(), 'huge_data.csv', ['id', 'title', 'price'])
```

### 5.3 JSON Lines 格式

标准 JSON 格式（一个大数组）必须等所有数据写完才能关闭数组括号，不方便流式写入。JSON Lines（`.jsonl`）解决了这个问题——每行是一个独立的 JSON 对象。

```
  标准 JSON vs JSON Lines：

  标准 JSON（data.json）：
  ┌──────────────────────────────────┐
  │ [                                │
  │   {"id": 1, "title": "商品1"},   │
  │   {"id": 2, "title": "商品2"},   │
  │   ...                            │
  │ ]                                │  ← 必须有 ] 关闭数组
  └──────────────────────────────────┘

  JSON Lines（data.jsonl）：
  ┌──────────────────────────────────┐
  │ {"id": 1, "title": "商品1"}      │  ← 每行独立
  │ {"id": 2, "title": "商品2"}      │  ← 每行独立
  │ {"id": 3, "title": "商品3"}      │  ← 每行独立
  └──────────────────────────────────┘  ← 无需关闭括号
```

```python
import json

def stream_write_jsonl(data_iterator, filename):
    """流式写入 JSON Lines"""
    with open(filename, 'w', encoding='utf-8') as f:
        count = 0
        for item in data_iterator:
            line = json.dumps(item, ensure_ascii=False)
            f.write(line + '\n')
            count += 1
    print(f'共写入 {count} 条数据')

# 读取 JSON Lines
def read_jsonl(filename):
    """逐行读取 JSON Lines，返回生成器"""
    with open(filename, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)

# 使用
for item in read_jsonl('data.jsonl'):
    print(item['title'])
```

> **生活类比：** 标准 JSON 像一本装订好的书，你必须从第一页翻到最后一页；JSON Lines 像一叠散装的卡片，每张卡片独立，你可以一张一张地处理。

---

## 六、实战：爬虫数据的三种格式存储

把前面学的所有内容串起来，写一个完整的示例——同一份爬虫数据分别存为 CSV、JSON 和 Excel。

```python
import csv
import json
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from datetime import datetime

# 模拟爬取到的数据
scraped_books = [
    {
        '书名': 'Python编程从入门到实践',
        '作者': 'Eric Matthes',
        '价格': 89.0,
        '评分': 4.8,
        '标签': ['Python', '入门', '编程'],
    },
    {
        '书名': '深入理解计算机系统',
        '作者': 'Randal E. Bryant',
        '价格': 139.0,
        '评分': 4.9,
        '标签': ['计算机系统', '底层', '经典'],
    },
    {
        '书名': 'JavaScript高级程序设计',
        '作者': 'Matt Frisbie',
        '价格': 129.0,
        '评分': 4.7,
        '标签': ['JavaScript', '前端', '进阶'],
    },
]


# ========== 1. 存为 CSV ==========
def save_to_csv(books, filename):
    """存为 CSV（标签用逗号拼接成字符串）"""
    fieldnames = ['书名', '作者', '价格', '评分', '标签']
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for book in books:
            row = book.copy()
            row['标签'] = ', '.join(row['标签'])  # 列表 → 字符串
            writer.writerow(row)
    print(f'CSV 已保存: {filename}')


# ========== 2. 存为 JSON ==========
def save_to_json(books, filename):
    """存为 JSON（保留完整嵌套结构）"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
    print(f'JSON 已保存: {filename}')


# ========== 3. 存为 Excel ==========
def save_to_excel(books, filename):
    """存为 Excel（带格式化）"""
    wb = Workbook()
    ws = wb.active
    ws.title = '书籍数据'

    # 表头
    headers = ['书名', '作者', '价格', '评分', '标签']
    ws.append(headers)

    # 表头样式
    for cell in ws[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill(start_color='4472C4', end_color='4472C4',
                                fill_type='solid')
        cell.alignment = Alignment(horizontal='center')

    # 数据
    for book in books:
        ws.append([
            book['书名'],
            book['作者'],
            book['价格'],
            book['评分'],
            ', '.join(book['标签']),
        ])

    # 列宽
    ws.column_dimensions['A'].width = 30
    ws.column_dimensions['B'].width = 22
    ws.column_dimensions['C'].width = 10
    ws.column_dimensions['D'].width = 8
    ws.column_dimensions['E'].width = 25

    wb.save(filename)
    print(f'Excel 已保存: {filename}')


# 执行三种存储
save_to_csv(scraped_books, 'books.csv')
save_to_json(scraped_books, 'books.json')
save_to_excel(scraped_books, 'books.xlsx')
```

---

## 七、动手练习

### 练习 1：CSV 高级写入

编写一个函数，将以下爬虫数据写入 CSV 文件：

- 使用分号 `;` 作为分隔符
- 使用 `utf-8-sig` 编码
- 使用 `QUOTE_NONNUMERIC` 模式（非数字字段加引号）

```python
data = [
    {'标题': 'Python教程, 入门篇', '价格': 59.9, '分类': '编程'},
    {'标题': 'JS实战; 前端开发', '价格': 79.0, '分类': '前端'},
]
```

### 练习 2：JSON 嵌套数据读写

将下面的嵌套数据写入 JSON 文件，然后读取并打印所有评分大于 4.7 的书名：

```python
books = [
    {'书名': 'Python编程', '评论': [{'用户': 'A', '评分': 5}, {'用户': 'B', '评分': 4}]},
    {'书名': 'JS高级', '评论': [{'用户': 'C', '评分': 4.8}, {'用户': 'D', '评分': 4.9}]},
]
```

提示：需要计算每本书的平均评分。

### 练习 3：Excel 报表生成

使用 openpyxl 创建一个"爬虫采集报告.xlsx"，包含两个 Sheet：

- Sheet 1 "数据明细"：包含爬取的 5 条数据，表头加粗、蓝底白字
- Sheet 2 "统计"：包含总条数、平均价格、最高评分

---

## 常见误区

- **CSV 用 `utf-8` 编码就够了**：很多开发者直接用 `utf-8` 写 CSV，结果用 Excel 打开中文全变乱码。正确做法是用 `utf-8-sig`，它会在文件头部写入 BOM 标记，Excel 识别后就不会乱码。
- **JSON 文件越大越好管理**：标准 JSON 格式必须整体读写，当数据量超过几万条时，内存和读写速度都会成为瓶颈。大数据量应该用 JSON Lines（`.jsonl`）格式，支持逐行流式处理。
- **Excel 适合存储大量数据**：Excel（`.xlsx`）是二进制格式，读写速度远慢于 CSV 和 JSON，超过 10 万行性能会明显下降。Excel 适合做报表展示，不适合做数据存储。
- **CSV 读出来的数据类型是正确的**：CSV 是纯文本格式，所有值读出来都是字符串。数字需要手动 `float()` / `int()` 转换，布尔值需要自己判断，否则后续计算会出错。

---

## 工程建议

- **格式选择三原则**：程序间传输用 JSON（结构化、可嵌套），大数据量导出用 CSV（体积小、流式写入），给人看/汇报用 Excel（格式美观、支持公式图表）。
- **写 CSV 时养成习惯用 `utf-8-sig`**：除非你确定数据只在 Linux 环境下使用，否则一律用 `utf-8-sig` 编码。这是一个几乎零成本的防御性措施。
- **大数据场景提前规划流式处理**：如果数据量可能超过 1 万条，从一开始就用生成器 + 逐条写入的模式，而不是先攒到列表里再一次性写入。内存峰值可以降低一个数量级。
- **Excel 报表做好格式预设**：给表头加粗加底色、价格列设置货币格式、评分列限制小数位数。这些细节会让报表直接可用，减少返工。

---

## 小结

本课的核心知识点：

1. **CSV 编码**：给 Excel 用选 `utf-8-sig`，自定义分隔符用 `delimiter` 参数，特殊字符用 `quoting` 控制
2. **JSON 参数**：`ensure_ascii=False` 保留中文，`indent=2` 格式化输出，`sort_keys=True` 排序字段
3. **Excel 操作**：`openpyxl` 的 `Workbook` 创建、`append` 写行、`Font`/`PatternFill` 格式化
4. **格式选择**：扁平表格用 CSV，嵌套数据用 JSON，给人看/汇报用 Excel
5. **类型还原**：CSV 读出来全是字符串，需要手动 `float()`/`int()` 转换
6. **大文件处理**：CSV 流式 `writerow`，JSON 用 `.jsonl` 格式逐行写入
7. **JSON Lines**：每行一个独立 JSON 对象，支持追加、流式读写，是大 JSON 文件的替代方案

```
  本课知识地图：

  ┌─────────────────────────────────────────────────────────┐
  │              数据存储三件套                               │
  ├──────────────┬──────────────────┬───────────────────────┤
  │   CSV 深入    │   JSON 深入       │   Excel (openpyxl)   │
  │              │                  │                       │
  │  UTF-8-SIG   │  ensure_ascii    │  Workbook 创建        │
  │  delimiter   │  indent          │  append 写入          │
  │  quoting     │  sort_keys       │  Font/Fill 格式化     │
  │  流式写入     │  JSON Lines      │  多 Sheet             │
  │  类型还原     │  嵌套结构         │  读取 load_workbook   │
  └──────────────┴──────────────────┴───────────────────────┘
```

---

## 下一课预告

文件存储搞定后，你可能会想：数据量再大一些、需要频繁查询和更新怎么办？JSON 和 CSV 虽然方便，但想查"价格大于 100 的所有书籍"还得全部加载到内存再过滤，效率太低。

下一课《SQLite 数据库存储》将带你进入数据库的世界。你将学习如何用 Python 内置的 `sqlite3` 模块创建数据库、建表、增删改查，以及如何把 SQLite 集成到 Scrapy Pipeline 中。别担心——SQLite 不需要安装任何服务器，一个文件就是一个数据库，非常适合爬虫项目。
