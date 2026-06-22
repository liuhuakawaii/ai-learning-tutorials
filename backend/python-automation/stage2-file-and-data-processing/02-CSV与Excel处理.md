# CSV 与 Excel 处理

## 场景引入

公司有 12 个分店，每个分店每月生成一份销售 Excel 文件。月底你需要把这 12 份文件合并成一份汇总表，计算各分店的总销售额、平均客单价，还要做数据清洗（去重、修正格式错误的日期）。手动操作要花一整天，用 Python 几分钟就能搞定。

## 学习目标

- 掌握 `csv` 模块的基础读写
- 掌握 `pandas` 读写 CSV 和 Excel 文件
- 了解 `openpyxl` 精细控制 Excel 样式
- 能进行常见的数据清洗操作（去重、类型转换、缺失值处理）
- 能编写合并多个 Excel 文件的脚本

## csv 模块基础

```python
import csv

# 读取（推荐 DictReader，按列名访问）
with open("sales.csv", "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(row["产品"], row["数量"])

# 写入（推荐 DictWriter）
with open("output.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["姓名", "年龄"])
    writer.writeheader()
    writer.writerow({"姓名": "张三", "年龄": 28})
```

**注意**：`newline=""` 是 Windows 下的关键参数，不加会导致写入时多出空行。

## pandas 读写 CSV

```python
import pandas as pd

# 读取
df = pd.read_csv("sales.csv")
df = pd.read_csv("data.csv", encoding="gbk", sep="\t")
df = pd.read_csv("big.csv", usecols=["日期", "产品", "金额"])
df = pd.read_csv("orders.csv", dtype={"订单号": str, "数量": int})

# 写入
df.to_csv("output.csv", index=False, encoding="utf-8-sig")
# index=False 不写行索引；utf-8-sig 确保 Excel 打开中文不乱码
```

## pandas 读写 Excel

```python
import pandas as pd

# 读取
df = pd.read_excel("sales.xlsx", sheet_name="Sheet1")
sheets = pd.read_excel("report.xlsx", sheet_name=None)  # 读所有 sheet

# 写入多个 sheet
with pd.ExcelWriter("report.xlsx", engine="openpyxl") as writer:
    df_sales.to_excel(writer, sheet_name="销售", index=False)
    df_profit.to_excel(writer, sheet_name="利润", index=False)
```

## openpyxl 精细控制 Excel

pandas 擅长数据处理，控制样式需要用 `openpyxl`。

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = Workbook()
ws = wb.active
ws.title = "销售汇总"

ws.append(["分店", "月份", "销售额", "利润"])
ws.append(["北京店", "2024-01", 125000, 32000])

# 表头样式
for cell in ws[1]:
    cell.font = Font(bold=True, size=11, color="FFFFFF")
    cell.fill = PatternFill(start_color="4472C4", fill_type="solid")
    cell.alignment = Alignment(horizontal="center")

# 列宽与数字格式
ws.column_dimensions["A"].width = 12
for row in ws.iter_rows(min_row=2, min_col=3, max_col=4):
    for cell in row:
        cell.number_format = "#,##0"

# 边框
thin = Border(left=Side(style="thin"), right=Side(style="thin"),
              top=Side(style="thin"), bottom=Side(style="thin"))
for row in ws.iter_rows():
    for cell in row:
        cell.border = thin

wb.save("styled_report.xlsx")
```

### 读取并修改现有 Excel

```python
from openpyxl import load_workbook

wb = load_workbook("report.xlsx")
ws = wb.active

for row in ws.iter_rows(min_row=2, values_only=True):
    name, month, sales = row
    print(f"{name}: {sales}")

ws.append(["广州店", "2024-01", 156000])
wb.save("report_updated.xlsx")
```

## 数据清洗

```python
import pandas as pd

df = pd.read_csv("orders.csv")

# 去重
df = df.drop_duplicates()
df = df.drop_duplicates(subset=["订单号"], keep="last")

# 类型转换
df["单价"] = pd.to_numeric(df["单价"], errors="coerce")
df["日期"] = pd.to_datetime(df["日期"], format="%Y/%m/%d", errors="coerce")

# 缺失值处理
df.isnull().sum()                    # 查看缺失值
df = df.dropna(subset=["姓名"])      # 删除特定列缺失的行
df["年龄"] = df["年龄"].fillna(df["年龄"].mean())  # 用均值填充
df["城市"] = df["城市"].fillna("未知")               # 用固定值填充
df["销售额"] = df["销售额"].ffill()                  # 用前一个值填充
```

## 完整示例：合并多个 Excel 并生成汇总

```python
import pandas as pd
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def merge_excel_files(input_dir: str, output_file: str) -> None:
    source = Path(input_dir)
    all_dfs = []

    for file in sorted(source.glob("*.xlsx")):
        try:
            df = pd.read_excel(file, engine="openpyxl")
            df["来源文件"] = file.name
            all_dfs.append(df)
            print(f"已读取: {file.name} ({len(df)} 行)")
        except Exception as e:
            print(f"跳过 {file.name}: {e}")

    if not all_dfs:
        print("没有找到可读取的 Excel 文件")
        return

    merged = pd.concat(all_dfs, ignore_index=True)
    merged = merged.drop_duplicates()

    # 数值列统计
    numeric_cols = merged.select_dtypes(include=["number"]).columns.tolist()
    summary = merged.groupby("分店")[numeric_cols].agg(["sum", "mean", "count"]).round(2)

    # 写入
    with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
        merged.to_excel(writer, sheet_name="明细", index=False)
        summary.to_excel(writer, sheet_name="汇总")

    # 美化
    wb = load_workbook(output_file)
    hfont = Font(bold=True, color="FFFFFF")
    hfill = PatternFill(start_color="4472C4", fill_type="solid")
    border = Border(left=Side(style="thin"), right=Side(style="thin"),
                    top=Side(style="thin"), bottom=Side(style="thin"))
    for ws in wb.worksheets:
        for cell in ws[1]:
            cell.font = hfont
            cell.fill = hfill
        for row in ws.iter_rows():
            for cell in row:
                cell.border = border
        for col_idx in range(1, ws.max_column + 1):
            col_letter = get_column_letter(col_idx)
            max_len = max(len(str(c.value or "")) for c in ws[col_letter])
            ws.column_dimensions[col_letter].width = min(max_len + 4, 30)

    wb.save(output_file)
    print(f"\n汇总完成: {output_file}, 共 {len(merged)} 行")

if __name__ == "__main__":
    merge_excel_files("D:/data/monthly_reports", "D:/data/annual_summary.xlsx")
```

## 常见误区

### 1. CSV 编码问题

```python
# ❌ 中文 CSV 用默认编码可能报错
df = pd.read_csv("data.csv")
# ✅ 先尝试 utf-8，失败再试 gbk
try:
    df = pd.read_csv("data.csv", encoding="utf-8")
except UnicodeDecodeError:
    df = pd.read_csv("data.csv", encoding="gbk")
```

### 2. Excel 大数精度丢失

```python
# ❌ 大整数被转为 float
df = pd.read_excel("data.xlsx")["订单号"]  # 1234567890123456 -> 1.23e+15
# ✅ 指定 dtype 为 str
df = pd.read_excel("data.xlsx", dtype={"订单号": str})
```

### 3. 忘记 index=False

```python
# ❌ 写 CSV 时多出一列索引
df.to_csv("output.csv")
# ✅
df.to_csv("output.csv", index=False)
```

### 4. 写 Excel 覆盖已有 sheet

```python
# ❌ 直接写入覆盖整个文件
df.to_excel("report.xlsx")
# ✅ 用 ExcelWriter 追加
with pd.ExcelWriter("report.xlsx", engine="openpyxl", mode="a") as writer:
    df.to_excel(writer, sheet_name="新数据")
```

## 工程建议

1. **小文件用 `csv` 模块**：零依赖，速度快
2. **数据分析用 `pandas`**：功能强大，处理大数据集效率高
3. **样式控制用 `openpyxl`**：精细控制单元格格式
4. **CSV 输出用 `utf-8-sig` 编码**：确保 Excel 打开中文不乱码
5. **大 Excel 用 `openpyxl.read_only` 模式**：内存效率更高

## 小结

本节学习了 Python 处理 CSV 和 Excel 的完整链路：`csv` 模块做基础读写、`pandas` 做数据处理和分析、`openpyxl` 做精细样式控制。掌握数据清洗技能（去重、类型转换、缺失值处理）是自动化处理表格数据的关键。

## 练习

### 练习一：CSV 数据统计

读取一个 CSV 文件，统计每列的数据类型、非空值数量、唯一值数量，输出一份数据概览报告。

### 练习二：Excel 多 sheet 合并

给定一个包含多个 sheet 的 Excel 文件，将所有 sheet 合并为一个 DataFrame（各 sheet 列名可能不完全一致）。

### 练习三：自动生成月报

读取销售明细 CSV（日期、产品、数量、单价），按月汇总销售额，生成带图表的 Excel 月报。

---

## 参考答案

### 练习一

**思路**：用 pandas 读取 CSV，遍历每列统计基本信息。

**答案**：

```python
import pandas as pd

def data_overview(csv_file: str) -> None:
    df = pd.read_csv(csv_file)
    print(f"数据集: {csv_file}")
    print(f"行数: {df.shape[0]}, 列数: {df.shape[1]}\n")
    print(f"{'列名':<15} {'类型':<12} {'非空':<8} {'唯一值':<8}")
    print("-" * 50)
    for col in df.columns:
        dtype = str(df[col].dtype)
        non_null = df[col].notna().sum()
        unique = df[col].nunique()
        print(f"{col:<15} {dtype:<12} {non_null:<8} {unique:<8}")
```

**要点**：`notna().sum()` 统计非空值；`nunique()` 统计唯一值。

### 练习二

**思路**：读取所有 sheet，用 `concat` 合并，自动对齐列名。

**答案**：

```python
import pandas as pd

def merge_sheets(excel_file: str, output_file: str) -> None:
    sheets = pd.read_excel(excel_file, sheet_name=None)
    all_dfs = []
    for name, df in sheets.items():
        df["来源sheet"] = name
        all_dfs.append(df)
    merged = pd.concat(all_dfs, ignore_index=True, sort=False)
    merged.to_excel(output_file, index=False)
    print(f"合并完成: {len(merged)} 行")
```

**要点**：`sheet_name=None` 返回所有 sheet 字典；`sort=False` 保持原始列顺序。

### 练习三

**思路**：读取 CSV，按月分组汇总，用 openpyxl 添加图表。

**答案**：

```python
import pandas as pd
from openpyxl import load_workbook
from openpyxl.chart import BarChart, Reference

def generate_monthly_report(csv_file: str, output_file: str) -> None:
    df = pd.read_csv(csv_file)
    df["日期"] = pd.to_datetime(df["日期"])
    df["月份"] = df["日期"].dt.to_period("M").astype(str)
    df["销售额"] = df["数量"] * df["单价"]
    monthly = df.groupby("月份")["销售额"].sum().reset_index()

    with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="明细", index=False)
        monthly.to_excel(writer, sheet_name="月度汇总", index=False)

    wb = load_workbook(output_file)
    ws = wb["月度汇总"]
    chart = BarChart()
    chart.title = "月度销售额"
    data = Reference(ws, min_col=2, min_row=1, max_row=len(monthly) + 1)
    cats = Reference(ws, min_col=1, min_row=2, max_row=len(monthly) + 1)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    ws.add_chart(chart, "D2")
    wb.save(output_file)
```

**要点**：`dt.to_period("M")` 将日期转为月份分组；`openpyxl.chart` 直接在 Excel 中插入图表。
