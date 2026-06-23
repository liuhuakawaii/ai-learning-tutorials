# 第三课：Python 2 到 Python 3 迁移——跨越语言版本的断层

## 场景引入

你的公司有一个运行了八年的数据处理系统，核心代码 4 万行 Python 2.7。系统稳定运行多年，但 Python 2.7 已于 2020 年 1 月 1 日正式停止维护。安全补丁不再发布，越来越多的第三方库放弃了 Python 2 支持——`pandas 1.5+`、`requests 2.28+`、`scikit-learn 1.0+` 全部要求 Python 3.8 以上。

你尝试直接在 Python 3 下运行现有代码，结果满屏的 `SyntaxError` 和 `TypeError`：

```python
# Python 2 正常运行的代码
print "Total records:", count
result = map(process, records)
file = open('data.csv', 'rb')
keys = user_config.keys()
assert isinstance(x, (int, long))
```

```bash
# Python 3 下全部报错
SyntaxError: Missing parentheses in call to 'print'
TypeError: 'map' object is not subscriptable
UnicodeDecodeError: 'ascii' codec can't decode byte...
```

Python 2 到 3 的迁移是所有语言版本升级中最痛苦的一次。它不是简单的语法变化，而是**语言核心设计哲学的转变**：字符串从字节优先变为 Unicode 优先，整数除法行为改变，迭代器替代列表成为默认行为，print 从语句变成函数。这些变化影响面极广，几乎每一行代码都可能受影响。

本课将系统讲解 Python 2 到 3 迁移的完整路径，从自动工具到手动处理边界情况。

## 学习目标

完成本课学习后，你将能够：

1. 理解 Python 2 和 Python 3 之间的核心差异，不只是语法层面
2. 使用 `2to3`、`futurize`、`modernize` 等自动转换工具
3. 处理字符串/字节、整数除法、迭代器等高危迁移点
4. 通过 `__future__` 导入实现渐进式迁移
5. 建立双版本兼容策略和测试保障
6. 处理第三方库的版本兼容问题

## 核心概念

### 一、断崖式升级的本质

Python 2 到 3 不是通常意义上的"版本升级"，而是一次**故意打破向后兼容**的重构。Guido van Rossum 做这个决定是为了清除语言历史中积累的设计债务。

```
Python 2 到 3 的五大核心变化：

┌─────────────────────────────────────────────────────────┐
│                    影响范围对比                           │
├──────────────┬────────────────┬─────────────────────────┤
│   变化领域     │   影响行数占比   │   自动工具处理率         │
├──────────────┼────────────────┼─────────────────────────┤
│ 字符串/字节    │    ~30%        │    低（需人工判断）       │
│ print 语句     │    ~15%        │    高（几乎 100%）       │
│ 整数除法       │    ~10%        │    中（需上下文分析）     │
│ 迭代器/视图    │    ~20%        │    中（需理解使用意图）   │
│ 异常语法       │    ~5%         │    高（格式固定）         │
├──────────────┼────────────────┼─────────────────────────┤
│ 其他零散变化    │    ~20%        │    变化较大              │
└──────────────┴────────────────┴─────────────────────────┘
```

理解这个影响分布是制定迁移策略的前提。字符串相关的变化最为棘手，因为它不是语法问题，而是**语义问题**——同一个 `str` 类型在 Python 2 和 3 中含义完全不同。

### 二、字符串模型的根本转变

这是迁移中最难的部分。Python 2 的 `str` 是字节串，`unicode` 是文本串。Python 3 颠倒了这个设计：`str` 是文本串（Unicode），`bytes` 是字节串。

```
Python 2 字符串模型：
  str  →  bytes (字节序列)
  unicode  →  文本 (Unicode 字符)

  混用时的隐式转换：
  'hello' + u'world'  →  Python 2 自动将 str 转为 unicode
  (如果 str 包含非 ASCII 字节，触发 UnicodeDecodeError)

Python 3 字符串模型：
  str  →  文本 (Unicode 字符)
  bytes  →  bytes (字节序列)
  bytearray  →  可变字节序列

  混用时的显式报错：
  'hello' + b'world'  →  TypeError: can only concatenate str to str
  (必须显式编码/解码：'hello' + b'world'.decode('utf-8'))
```

这个转变影响了所有涉及 I/O 的代码：文件读写、网络请求、数据库交互、序列化/反序列化。Python 2 里"碰巧能跑"的字节和文本混用代码，在 Python 3 下会立即报错。

### 三、整数除法的行为变化

Python 2 中 `/` 对整数做地板除（截断），Python 3 中 `/` 做真除法（返回浮点数）。

```
Python 2:
  7 / 2  →  3       (地板除)
  7 // 2 →  3       (显式地板除)

Python 3:
  7 / 2  →  3.5     (真除法)
  7 // 2 →  3       (显式地板除)
```

这个变化看似简单，但影响面超出预期。大量算法代码隐式依赖整数除法的截断行为——像素坐标计算、分页逻辑、二分查找的中点计算等。

### 四、迭代器替代列表

Python 3 将 `map()`、`filter()`、`range()`、`dict.keys()`、`dict.values()`、`dict.items()` 等从返回列表改为返回迭代器或视图对象。这是为了减少内存占用，但破坏了依赖列表行为的代码。

### 五、渐进式迁移路径

通过 `__future__` 导入可以在 Python 2 中逐步引入 Python 3 行为：

```
渐进式迁移时间线：

阶段 1（准备期）：添加 __future__ 导入
  from __future__ import print_function
  from __future__ import unicode_literals
  from __future__ import division
  from __future__ import absolute_import

阶段 2（兼容期）：使用 six 库处理版本差异
  import six
  if six.PY3:
      text_type = str
  else:
      text_type = unicode

阶段 3（切换期）：移除兼容代码，全面 Python 3
  删除所有 six 引用
  删除 __future__ 导入
  使用 Python 3 原生语法
```

## 完整代码示例

### 示例一：print 语句到函数

**迁移前：Python 2 print 语句**

```python
# legacy_report.py - Python 2
import sys

def generate_report(data, output_file):
    """生成数据报告"""
    print "Generating report..."
    print "Total records:", len(data)
    
    for i, record in enumerate(data):
        print "Processing record %d of %d" % (i + 1, len(data))
        
        if record.get('score', 0) < 0:
            print >> sys.stderr, "Warning: negative score in record", record['id']
            continue
        
        print record['id'], record['name'], record['score']
    
    print "Report saved to", output_file
    print >> output_file, "--- End of Report ---"
```

**迁移后：Python 3 print 函数**

```python
# modern_report.py - Python 3
import sys

def generate_report(data, output_file):
    """生成数据报告"""
    print("Generating report...")
    print(f"Total records: {len(data)}")
    
    for i, record in enumerate(data):
        print(f"Processing record {i + 1} of {len(data)}")
        
        if record.get('score', 0) < 0:
            print(f"Warning: negative score in record {record['id']}", 
                  file=sys.stderr)
            continue
        
        print(record['id'], record['name'], record['score'])
    
    print(f"Report saved to {output_file}")
    print("--- End of Report ---", file=output_file)
```

`print >> sys.stderr` 语法在 Python 2 中用于输出到标准错误流。Python 3 中用 `print(..., file=sys.stderr)` 实现。同时将字符串格式化从 `%` 迁移到 f-string，这是 Python 3.6+ 的最佳实践。

### 示例二：字符串和字节处理

**迁移前：Python 2 的字符串混用**

```python
# data_loader.py - Python 2
import csv
import json
import urllib2

def load_user_data(url, local_cache):
    """从 URL 或本地缓存加载用户数据"""
    try:
        response = urllib2.urlopen(url)
        raw_data = response.read()
        # Python 2: raw_data 是 str (字节)，json.loads 也能处理
        users = json.loads(raw_data)
    except urllib2.URLError:
        with open(local_cache, 'r') as f:
            users = json.load(f)
    
    # 处理用户名中的特殊字符
    for user in users:
        if isinstance(user['name'], unicode):
            user['display_name'] = user['name'].encode('utf-8')
        else:
            user['display_name'] = user['name']
        
        # 字符串拼接
        user['search_key'] = user['name'].lower() + '_' + str(user['id'])
    
    return users

def write_csv(users, filename):
    """写入 CSV 文件"""
    with open(filename, 'wb') as f:
        writer = csv.writer(f)
        writer.writerow(['ID', 'Name', 'Display Name'])
        for user in users:
            writer.writerow([user['id'], user['name'], 
                           user['display_name']])
```

**迁移后：Python 3 的明确字节/文本分离**

```python
# data_loader.py - Python 3
import csv
import json
from urllib.request import urlopen
from urllib.error import URLError

def load_user_data(url, local_cache):
    """从 URL 或本地缓存加载用户数据"""
    try:
        response = urlopen(url)
        raw_data = response.read()
        # Python 3: raw_data 是 bytes，需要 decode
        users = json.loads(raw_data.decode('utf-8'))
    except URLError:
        with open(local_cache, 'r', encoding='utf-8') as f:
            users = json.load(f)
    
    for user in users:
        # Python 3: str 就是 Unicode，不需要 encode
        user['display_name'] = user['name']
        user['search_key'] = f"{user['name'].lower()}_{user['id']}"
    
    return users

def write_csv(users, filename):
    """写入 CSV 文件"""
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['ID', 'Name', 'Display Name'])
        for user in users:
            writer.writerow([user['id'], user['name'], 
                           user['display_name']])
```

关键变化：`urllib2` 变为 `urllib.request` + `urllib.error`；文件读写需要显式指定 `encoding`；`csv.writer` 要求文本模式（`'w'`）而非字节模式（`'wb'`）；字节数据需要 `.decode()` 才能传给 `json.loads`。

### 示例三：整数除法和迭代器

**迁移前：Python 2**

```python
# pagination.py - Python 2
def paginate(items, page_size):
    """分页逻辑"""
    total_pages = len(items) / page_size  # Python 2: 整数除法
    if len(items) % page_size > 0:
        total_pages += 1
    
    current_page = 1
    start = (current_page - 1) * page_size
    end = start + page_size
    
    # range 返回列表
    page_numbers = range(1, total_pages + 1)
    
    # map 返回列表
    page_labels = map(lambda p: "Page %d" % p, page_numbers)
    
    # dict.keys() 返回列表
    config = {'sort': 'name', 'order': 'asc', 'filter': 'active'}
    config_keys = config.keys()
    config_copy = config_keys  # 可以直接当列表用
    
    return {
        'items': items[start:end],
        'total_pages': total_pages,
        'labels': page_labels,
        'config_keys': config_copy,
    }
```

**迁移后：Python 3**

```python
# pagination.py - Python 3
from math import ceil

def paginate(items, page_size):
    """分页逻辑"""
    total_pages = ceil(len(items) / page_size)  # 显式向上取整
    
    current_page = 1
    start = (current_page - 1) * page_size
    end = start + page_size
    
    # range 返回 range 对象（惰性）
    page_numbers = range(1, total_pages + 1)
    
    # map 返回迭代器，需要显式转为列表
    page_labels = list(f"Page {p}" for p in page_numbers)
    
    # dict.keys() 返回视图对象
    config = {'sort': 'name', 'order': 'asc', 'filter': 'active'}
    config_keys = list(config.keys())  # 需要显式转为列表
    
    return {
        'items': items[start:end],
        'total_pages': total_pages,
        'labels': page_labels,
        'config_keys': config_keys,
    }
```

使用 `math.ceil` 替代手动的除法 + 余数判断，更清晰地表达"向上取整"的意图。`map()` 返回迭代器，如果后续代码需要索引访问或多次遍历，需要 `list()` 转换。

### 示例四：异常处理语法

**迁移前：Python 2**

```python
# error_handler.py - Python 2
def process_batch(records):
    results = []
    for record in records:
        try:
            result = transform(record)
            results.append(result)
        except (ValueError, TypeError), e:
            # Python 2 的 except 语法
            log_error("Failed: %s" % str(e))
            continue
        except Exception, e:
            # 捕获所有异常
            log_error("Unexpected: %s" % str(e))
            raise
    return results
```

**迁移后：Python 3**

```python
# error_handler.py - Python 3
def process_batch(records):
    results = []
    for record in records:
        try:
            result = transform(record)
            results.append(result)
        except (ValueError, TypeError) as e:
            # Python 3 使用 as 关键字
            log_error(f"Failed: {e}")
            continue
        except Exception as e:
            log_error(f"Unexpected: {e}")
            raise
    return results
```

### 示例五：使用 2to3 自动转换

`2to3` 是 Python 自带的迁移工具，能自动处理大部分语法变化：

```bash
# 预览转换结果（不修改原文件）
2to3 --no-diffs -w legacy_module.py

# 使用特定修复器
2to3 -f print -f except -f has_key legacy_module.py

# 批量转换整个目录
2to3 -w -n src/

# 列出所有可用的修复器
2to3 -l
```

常用修复器列表：

| 修复器 | 处理内容 |
|--------|---------|
| `print` | `print` 语句 → `print()` 函数 |
| `except` | `except X, e` → `except X as e` |
| `has_key` | `dict.has_key(k)` → `k in dict` |
| `dict` | `dict.iteritems()` → `dict.items()` |
| `raw_input` | `raw_input()` → `input()` |
| `range` | `xrange()` → `range()` |
| `unicode` | `unicode()` → `str()` |
| `long` | `long()` → `int()` |
| `division` | 添加 `from __future__ import division` |
| `import` | 修复 `urllib2`、`ConfigParser` 等模块重命名 |

### 示例六：使用 six 实现双版本兼容

当需要同时支持 Python 2 和 3（过渡期），`six` 库是标准选择：

```python
# compat_utils.py
import six
import sys

# 字符串类型兼容
if six.PY3:
    text_type = str
    binary_type = bytes
    string_types = (str,)
else:
    text_type = unicode
    binary_type = str
    string_types = (str, unicode)

def ensure_text(value, encoding='utf-8'):
    """确保值为文本类型"""
    if isinstance(value, bytes):
        return value.decode(encoding)
    if isinstance(value, text_type):
        return value
    raise TypeError(f"Expected str or bytes, got {type(value)}")

def ensure_bytes(value, encoding='utf-8'):
    """确保值为字节类型"""
    if isinstance(value, text_type):
        return value.encode(encoding)
    if isinstance(value, bytes):
        return value
    raise TypeError(f"Expected str or bytes, got {type(value)}")

# 使用 six 的兼容写法
@six.python_2_unicode_compatible
class UserRecord:
    def __init__(self, name, email):
        self.name = name
        self.email = email
    
    def __str__(self):
        return f"{self.name} <{self.email}>"
    
    # 使用 six 的 metaclass 兼容语法
    # Python 2 和 3 的 metaclass 语法不同
    pass

# 字典操作兼容
def get_dict_items(d):
    """兼容 Python 2/3 的字典迭代"""
    return six.iteritems(d)

# 过滤器兼容
def filter_records(records, predicate):
    """兼容 Python 2/3 的 filter"""
    return list(filter(predicate, records))
```

### 示例七：迁移验证测试

```python
# test_migration.py
import pytest
import sys
import json
from io import StringIO, BytesIO

class TestMigrationCompatibility:
    """验证迁移后代码的正确性"""
    
    def test_string_handling(self):
        """验证字符串类型正确性"""
        text = "Hello, 世界"
        binary = text.encode('utf-8')
        
        assert isinstance(text, str)
        assert isinstance(binary, bytes)
        
        # 反向转换
        decoded = binary.decode('utf-8')
        assert decoded == text
    
    def test_integer_division(self):
        """验证除法行为"""
        assert 7 / 2 == 3.5       # 真除法
        assert 7 // 2 == 3        # 地板除
        assert -7 // 2 == -4      # 向负无穷取整
        
        # 分页计算
        items = 13
        page_size = 5
        from math import ceil
        assert ceil(items / page_size) == 3
    
    def test_dict_operations(self):
        """验证字典视图行为"""
        config = {'a': 1, 'b': 2, 'c': 3}
        
        keys = config.keys()
        assert not isinstance(keys, list)
        
        # 视图支持迭代和成员检测
        assert 'a' in keys
        assert list(keys) == ['a', 'b', 'c']
    
    def test_map_filter_returns_iterator(self):
        """验证 map/filter 返回迭代器"""
        data = [1, 2, 3, 4, 5]
        
        mapped = map(lambda x: x * 2, data)
        assert not isinstance(mapped, list)
        assert list(mapped) == [2, 4, 6, 8, 10]
        
        filtered = filter(lambda x: x > 3, data)
        assert not isinstance(filtered, list)
        assert list(filtered) == [4, 5]
    
    def test_file_io_encoding(self):
        """验证文件 I/O 编码行为"""
        content = "测试内容 with émojis 🎉"
        
        # 写入文本文件
        with open('test_output.txt', 'w', encoding='utf-8') as f:
            f.write(content)
        
        # 读取文本文件
        with open('test_output.txt', 'r', encoding='utf-8') as f:
            loaded = f.read()
        
        assert loaded == content
        
        # 清理
        import os
        os.remove('test_output.txt')
    
    def test_exception_chaining(self):
        """验证异常链行为"""
        try:
            try:
                raise ValueError("原始错误")
            except ValueError:
                raise RuntimeError("包装错误")
        except RuntimeError as e:
            assert str(e) == "包装错误"
            assert isinstance(e.__cause__, ValueError) or \
                   isinstance(e.__context__, ValueError)
```

## 常见误区

### 误区一：直接用 Python 3 运行 Python 2 代码

"先跑一下看看报什么错再修"——这在小项目里勉强可行，在大项目里是灾难。Python 2 代码在 Python 3 下的错误是级联的：一个字符串问题可能导致下游几十个函数报错。正确的做法是先用 `2to3` 或 `futurize` 做静态转换，再用测试验证。

### 误区二：只关注语法，忽略语义

`print` 语句转函数很容易，但字符串从字节到 Unicode 的变化是语义层面的。`'hello'` 在 Python 2 中是 5 个字节，在 Python 3 中是 5 个 Unicode 字符。对于纯 ASCII 内容没有区别，但涉及中文、日文、emoji 时完全不同。

### 误区三：认为 six 库解决了所有问题

`six` 只处理了 API 差异，没有处理语义差异。字节/文本混用的问题不会因为 `import six` 就消失。真正的兼容需要在代码中明确每个字符串变量是"文本"还是"字节"。

### 误区四：忽略第三方库的版本约束

你的代码迁移完了，但依赖的库可能还没有。特别是 C 扩展库（如早期版本的 `numpy`、`PIL`），它们的 Python 3 版本可能有不同的安装方式或 API 变化。迁移前必须检查所有依赖的 Python 3 兼容性。

### 误区五：一次性全量切换

对于超过 1 万行的项目，一次性切换风险极高。正确做法是通过 `__future__` 导入和 `six` 库实现渐进式迁移，让代码在两个版本上都能运行，逐步切换。

## 小结

Python 2 到 3 迁移的核心难点不在语法，在于字符串/字节模型的根本改变。迁移策略可以总结为：

1. **准备阶段**：运行 `python -3` 检查 Python 2 代码中的兼容性警告
2. **自动转换**：使用 `2to3` 或 `futurize` 处理语法级变化
3. **手动处理**：字符串/字节、文件 I/O、第三方库适配
4. **测试保障**：建立完整的测试用例，覆盖字符串处理和边界情况
5. **渐进发布**：先在非生产环境验证，逐步扩大覆盖范围

## 练习

### 练习一：字符串转换

以下 Python 2 代码读取配置文件并处理。请将其迁移为 Python 3 代码：

```python
# config_reader.py - Python 2
import ConfigParser

def load_config(filepath):
    config = ConfigParser.ConfigParser()
    config.read(filepath)
    
    result = {}
    for section in config.sections():
        result[section] = {}
        for key, value in config.items(section):
            if isinstance(value, str):
                result[section][key] = value.decode('utf-8')
            else:
                result[section][key] = value
    
    return result

def format_config(config):
    lines = []
    for section, items in config.iteritems():
        lines.append("[%s]" % section)
        for key in items.keys():
            lines.append("%s = %s" % (key, items[key]))
    return "\n".join(lines)
```

### 练习二：迁移计划制定

你接手一个 2 万行的 Python 2 Web 服务（Flask 0.12 + SQLAlchemy 1.1 + Celery 4.0）。请制定迁移计划，包括：需要升级的依赖版本、迁移顺序、风险点和验证策略。

---

## 参考答案

### 练习一

**思路**：主要处理 `ConfigParser` 模块重命名、`iteritems` 替换、字节/文本处理简化。

**答案**：

```python
# config_reader.py - Python 3
import configparser

def load_config(filepath):
    config = configparser.ConfigParser()
    config.read(filepath, encoding='utf-8')
    
    result = {}
    for section in config.sections():
        result[section] = {}
        for key, value in config.items(section):
            # Python 3: configparser 返回的已经是 str
            result[section][key] = value
    
    return result

def format_config(config):
    lines = []
    for section, items in config.items():
        lines.append(f"[{section}]")
        for key in items:
            lines.append(f"{key} = {items[key]}")
    return "\n".join(lines)
```

**要点**：
- `ConfigParser` 模块在 Python 3 中改名为 `configparser`（小写）
- `config.items()` 在 Python 3 中替代 `config.iteritems()`
- `configparser` 在 Python 3 中返回 `str`，不需要手动 `.decode('utf-8')`
- `items.keys()` 可以简化为 `items`（直接迭代字典）

### 练习二

**思路**：分阶段迁移，先依赖后代码，先外围后核心。

**答案**：

迁移计划（建议总周期 4-6 周）：

**第一周：依赖升级（在 Python 2.7 下）**
- Flask 0.12 → Flask 1.1.x（最后一个支持 Python 2 的版本）
- SQLAlchemy 1.1 → SQLAlchemy 1.3.x
- Celery 4.0 本身支持 Python 3，无需升级版本
- 运行完整测试，确保升级后的依赖在 Python 2 下正常工作

**第二周：代码准备**
- 在 Python 2 下运行 `python -3 app.py`，修复所有 DeprecationWarning
- 添加 `from __future__ import` 导入到所有模块
- 使用 `futurize` 自动转换语法级问题
- 引入 `six` 库处理版本差异

**第三周：核心逻辑迁移**
- 处理字符串/字节问题（数据库连接的编码配置、文件上传处理）
- 处理 `dict.iteritems()`、`map()`、`filter()` 返回值
- 处理异常语法

**第四周：测试与切换**
- 在 Python 3 下运行完整测试
- 修复所有测试失败
- 在预发布环境验证

**风险点**：
- Flask 0.12 的 Jinja2 模板中如果有 Python 2 特定语法需要同步修改
- SQLAlchemy 的 `Text` 类型在 Python 2/3 下的编码行为不同
- Celery 任务的序列化方式（pickle vs JSON）在版本切换时可能出问题

**验证策略**：
- 单元测试覆盖率 > 80%
- 集成测试覆盖所有 API 端点
- 预发布环境运行 48 小时
- 准备 Python 2 回滚方案
