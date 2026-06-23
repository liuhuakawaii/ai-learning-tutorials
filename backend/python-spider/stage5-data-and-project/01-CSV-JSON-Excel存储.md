# CSV、JSON 与 Excel 存储

## 存储格式选错的代价

你花了两天写爬虫，抓下来 5000 条商品数据。老板说"发我一份 Excel"，你把数据存成 CSV 发过去——结果老板打开一看，中文全是乱码。你换成 JSON 发给前端同事，他说"嵌套太深，我还要自己解析标签列表"。

存储格式不是随便选的，不同场景需要不同方案。

## CSV：不只是逗号分隔

### 编码问题

用 `utf-8` 写的 CSV，记事本打开没问题，Excel 打开中文全变乱码。原因：Excel 默认用系统编码（GBK）解析。

解决方案：用 `utf-8-sig`（带 BOM 头的 UTF-8）。BOM 是文件开头的特殊字节，告诉 Excel "我是 UTF-8 编码"。

```python
import csv

data = [
    {'书名': 'Python编程', '作者': '张三', '价格': 89.0},
    {'书名': '深入理解计算机系统', '作者': 'Randal', '价格': 139.0},
]

# ✅ utf-8-sig，Excel 打开不乱码
with open('books.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=['书名', '作者', '价格'])
    writer.writeheader()
    writer.writerows(data)
```

### 自定义分隔符

数据本身包含逗号时，用制表符或分号：

```python
with open('data.tsv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=['姓名', '地址'], delimiter='\t')
    writer.writeheader()
    writer.writerows(data)
```

### Quoting 控制

字段内容包含分隔符或换行符时：

```python
# 只在必要时加引号（默认）
writer = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_MINIMAL)
# 所有字段都加引号
writer = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_ALL)
# 非数字字段加引号
writer = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_NONNUMERIC)
```

### 读回数据

CSV 读出来的所有值都是字符串，需要手动转换类型：

```python
with open('books.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        row['价格'] = float(row['价格'])
```

## JSON：结构化数据的利器

### 嵌套结构

爬虫数据往往不是扁平的。JSON 天然支持嵌套：

```python
import json

books = [{
    '书名': 'Python编程',
    '标签': ['Python', '入门'],
    '评论': [
        {'用户': '读者A', '评分': 5},
        {'用户': '读者B', '评分': 4},
    ],
    '出版社': {'名称': '人民邮电出版社', '城市': '北京'}
}]

with open('books.json', 'w', encoding='utf-8') as f:
    json.dump(books, f, ensure_ascii=False, indent=2)
```

用 CSV 存同样的数据，标签和评论只能变成一坨字符串。

### 三个关键参数

```python
# ensure_ascii=False：中文正常显示（默认 True 会转义为 \uXXXX）
json.dumps(data, ensure_ascii=False)

# indent=2：格式化输出，方便人类阅读
json.dumps(data, ensure_ascii=False, indent=2)

# sort_keys=True：字段按字母排序，方便对比两个 JSON
json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2)
```

## Excel：用 openpyxl 打造报表

CSV 能用 Excel 打开，但没有单元格格式、多 Sheet、公式。给运营或老板看时，格式精美的 Excel 更有说服力。

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
ws = wb.active
ws.title = '书籍数据'

headers = ['书名', '作者', '价格', '评分']
ws.append(headers)

# 表头样式
for cell in ws[1]:
    cell.font = Font(bold=True, color='FFFFFF')
    cell.fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
    cell.alignment = Alignment(horizontal='center')

# 数据
data = [
    ['Python编程', 'Eric Matthes', 89.0, 4.8],
    ['深入理解计算机系统', 'Randal', 139.0, 4.9],
]
for row in data:
    ws.append(row)

# 价格列格式
for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=3, max_col=3):
    for cell in row:
        cell.number_format = '¥#,##0.00'

ws.column_dimensions['A'].width = 30
wb.save('books.xlsx')
```

## 格式选择指南

```
数据要怎么用？
├── 给人看/汇报 → Excel
├── 程序读取/API
│   ├── 有嵌套 → JSON
│   └── 扁平表格 → CSV
└── 数据分析 → pandas 读 CSV 最方便
```

一句话：扁平表格用 CSV，嵌套数据用 JSON，给人看用 Excel。

## 大文件处理

数据量超过几万行，全部加载到内存再写文件会爆。用流式处理：

```python
import csv, json

# 流式写入 CSV
def stream_write_csv(data_iterator, filename, fieldnames):
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for item in data_iterator:
            writer.writerow(item)  # 写一条，内存里只保留一条

# JSON Lines：每行一个独立 JSON 对象
def stream_write_jsonl(data_iterator, filename):
    with open(filename, 'w', encoding='utf-8') as f:
        for item in data_iterator:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
```

标准 JSON 必须等所有数据写完才能关闭数组括号；JSON Lines 每行独立，支持追加和流式读写。

## 练习

### 练习一：CSV 高级写入

用分号分隔、utf-8-sig 编码、QUOTE_NONNUMERIC 模式写入包含逗号和分号的数据。

### 练习二：JSON 嵌套数据读写

将嵌套数据写入 JSON，读取并筛选平均评分大于 4.7 的书名。

### 练习三：Excel 报表

创建"爬虫采集报告.xlsx"，Sheet1 数据明细（表头蓝底白字），Sheet2 统计（总条数、平均价格、最高评分）。

---

## 参考答案

### 练习一

```python
import csv

data = [
    {'标题': 'Python教程, 入门篇', '价格': 59.9, '分类': '编程'},
    {'标题': 'JS实战; 前端开发', '价格': 79.0, '分类': '前端'},
]

with open('advanced.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=['标题', '价格', '分类'],
                            delimiter=';', quoting=csv.QUOTE_NONNUMERIC)
    writer.writeheader()
    writer.writerows(data)
```

### 练习二

```python
import json

books = [
    {'书名': 'Python编程', '评论': [{'评分': 5}, {'评分': 4}]},
    {'书名': 'JS高级', '评论': [{'评分': 4.8}, {'评分': 4.9}]},
]

with open('books.json', 'w', encoding='utf-8') as f:
    json.dump(books, f, ensure_ascii=False, indent=2)

with open('books.json', 'r', encoding='utf-8') as f:
    loaded = json.load(f)

for book in loaded:
    reviews = book.get('评论', [])
    if reviews:
        avg = sum(r['评分'] for r in reviews) / len(reviews)
        if avg > 4.7:
            print(f"{book['书名']}: {avg:.1f}")
```

### 练习三

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

wb = Workbook()
ws1 = wb.active
ws1.title = '数据明细'
ws1.append(['名称', '价格', '评分'])
for cell in ws1[1]:
    cell.font = Font(bold=True, color='FFFFFF')
    cell.fill = PatternFill(start_color='4472C4', fill_type='solid')
ws1.append(['Python教程', 59.9, 4.8])

ws2 = wb.create_sheet('统计')
ws2.append(['指标', '数值'])
ws2.append(['总条数', 1])
ws2.append(['平均价格', 59.9])

wb.save('report.xlsx')
```
