# 阶段实战：数据清洗 Pipeline

## 问题背景

你收到一批来自不同系统的数据文件：销售部的 CSV、财务部的 Excel、运营部的 JSON。编码不同、列名不统一、数据格式各异。需要清洗、整合、验证，输出干净的数据集和质量报告。

## Pipeline 设计

```
输入 → 读取 → 编码检测 → 列名标准化 → 类型转换 → 去重 → 缺失值处理 → 验证 → 输出
```

每个阶段是独立函数，Pipeline 负责串联。先定义配置和数据模型：

```python
from dataclasses import dataclass, field
from typing import Any
from pathlib import Path

@dataclass
class PipelineConfig:
    input_paths: list[str]
    output_path: str
    report_path: str
    drop_duplicates: bool = True
    duplicate_subset: list[str] | None = None
    fill_na_strategy: dict[str, Any] = field(default_factory=dict)
    type_mapping: dict[str, str] = field(default_factory=dict)
    column_mapping: dict[str, str] = field(default_factory=dict)
    validation_rules: dict[str, callable] = field(default_factory=dict)

@dataclass
class QualityReport:
    total_rows: int = 0
    rows_after_dedup: int = 0
    duplicates_removed: int = 0
    missing_values: dict[str, int] = field(default_factory=dict)
    type_conversions: dict[str, int] = field(default_factory=dict)
    validation_errors: dict[str, int] = field(default_factory=dict)
    files_processed: list[str] = field(default_factory=list)
    encoding_detected: dict[str, str] = field(default_factory=dict)
```

## 编码检测与文件读取

中文环境常见编码：UTF-8、GBK、GB2312。逐个尝试直到成功：

```python
import json
import pandas as pd

def detect_encoding(file_path: str) -> str:
    for enc in ["utf-8", "utf-8-sig", "gbk", "gb2312", "gb18030", "latin-1"]:
        try:
            with open(file_path, "r", encoding=enc) as f:
                f.read(4096)
            return enc
        except (UnicodeDecodeError, UnicodeError):
            continue
    return "latin-1"

def read_file(file_path: str) -> pd.DataFrame:
    suffix = Path(file_path).suffix.lower()
    encoding = detect_encoding(file_path)
    if suffix == ".csv":
        return pd.read_csv(file_path, encoding=encoding)
    elif suffix in (".xls", ".xlsx"):
        return pd.read_excel(file_path, engine="openpyxl")
    elif suffix == ".json":
        with open(file_path, "r", encoding=encoding) as f:
            data = json.load(f)
        return pd.json_normalize(data) if isinstance(data, list) else pd.DataFrame([data])
    raise ValueError(f"不支持的格式: {suffix}")
```

## 数据处理函数

```python
import re

def standardize_columns(df: pd.DataFrame, mapping: dict[str, str]) -> pd.DataFrame:
    df = df.rename(columns=mapping)
    df.columns = [re.sub(r"\s+", "_", c.strip().lower()) for c in df.columns]
    return df

def convert_types(df: pd.DataFrame, type_map: dict[str, str], report: QualityReport) -> pd.DataFrame:
    for col, target in type_map.items():
        if col not in df.columns:
            continue
        before = df[col].isna().sum()
        if target == "numeric":
            df[col] = pd.to_numeric(df[col], errors="coerce")
        elif target == "datetime":
            df[col] = pd.to_datetime(df[col], errors="coerce")
        elif target == "string":
            df[col] = df[col].astype(str).str.strip()
        elif target == "int":
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
        after = df[col].isna().sum()
        if after > before:
            report.type_conversions[col] = after - before
    return df

def remove_duplicates(df: pd.DataFrame, subset: list[str] | None, report: QualityReport) -> pd.DataFrame:
    before = len(df)
    df = df.drop_duplicates(subset=subset, keep="first").reset_index(drop=True)
    report.duplicates_removed = before - len(df)
    report.rows_after_dedup = len(df)
    return df

def handle_missing(df: pd.DataFrame, strategy: dict[str, Any], report: QualityReport) -> pd.DataFrame:
    report.missing_values = {k: v for k, v in df.isnull().sum().to_dict().items() if v > 0}
    for col, method in strategy.items():
        if col not in df.columns:
            continue
        if method == "drop":
            df = df.dropna(subset=[col])
        elif method == "mean":
            df[col] = df[col].fillna(df[col].mean())
        elif method == "median":
            df[col] = df[col].fillna(df[col].median())
        elif method == "ffill":
            df[col] = df[col].ffill()
        elif isinstance(method, (str, int, float)):
            df[col] = df[col].fillna(method)
    return df
```

`convert_types` 中用 `errors="coerce"` 把无法转换的值变成 NaN，通过前后差值记录转换异常数量。

## 验证与报告

```python
def validate_data(df: pd.DataFrame, rules: dict[str, callable], report: QualityReport) -> pd.DataFrame:
    error_mask = pd.Series(False, index=df.index)
    for col, rule in rules.items():
        if col not in df.columns:
            continue
        try:
            invalid = ~df[col].apply(rule).fillna(True)
            if invalid.sum() > 0:
                report.validation_errors[col] = int(invalid.sum())
            error_mask = error_mask | invalid
        except Exception as e:
            print(f"验证规则 {col} 失败: {e}")
    return df[~error_mask].copy()

def generate_report(report: QualityReport, output_path: str) -> None:
    lines = [
        "=" * 50, "数据清洗质量报告", "=" * 50,
        f"处理文件数: {len(report.files_processed)}",
    ]
    for f in report.files_processed:
        lines.append(f"  - {f} (编码: {report.encoding_detected.get(f, '未知')})")
    lines += ["", f"原始总行数: {report.total_rows}", f"去重后行数: {report.rows_after_dedup}",
              f"移除重复: {report.duplicates_removed} 行"]
    if report.missing_values:
        lines.append("\n缺失值统计:")
        for col, n in sorted(report.missing_values.items(), key=lambda x: -x[1]):
            lines.append(f"  {col}: {n}")
    if report.type_conversions:
        lines.append("\n类型转换异常:")
        for col, n in report.type_conversions.items():
            lines.append(f"  {col}: {n} 个值无法转换")
    if report.validation_errors:
        lines.append("\n验证失败:")
        for col, n in report.validation_errors.items():
            lines.append(f"  {col}: {n} 行不通过")
    text = "\n".join(lines)
    print(text)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
```

## Pipeline 主类

```python
class DataCleaningPipeline:
    def __init__(self, config: PipelineConfig):
        self.config = config
        self.report = QualityReport()

    def run(self) -> pd.DataFrame:
        all_dfs = []
        for path in self.config.input_paths:
            enc = detect_encoding(path)
            self.report.encoding_detected[path] = enc
            self.report.files_processed.append(path)
            all_dfs.append(read_file(path))
            print(f"读取: {path} (编码: {enc})")

        df = pd.concat(all_dfs, ignore_index=True)
        self.report.total_rows = len(df)

        if self.config.column_mapping:
            df = standardize_columns(df, self.config.column_mapping)
        if self.config.type_mapping:
            df = convert_types(df, self.config.type_mapping, self.report)
        if self.config.drop_duplicates:
            df = remove_duplicates(df, self.config.duplicate_subset, self.report)
        if self.config.fill_na_strategy:
            df = handle_missing(df, self.config.fill_na_strategy, self.report)
        if self.config.validation_rules:
            df = validate_data(df, self.config.validation_rules, self.report)

        output = Path(self.config.output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        if output.suffix == ".csv":
            df.to_csv(output, index=False, encoding="utf-8-sig")
        elif output.suffix in (".xls", ".xlsx"):
            df.to_excel(output, index=False)
        elif output.suffix == ".json":
            df.to_json(output, orient="records", force_ascii=False, indent=2)

        generate_report(self.report, self.config.report_path)
        print(f"输出: {output}, {len(df)} 行")
        return df
```

## 使用示例

```python
def main():
    config = PipelineConfig(
        input_paths=["data/sales.csv", "data/finance.xlsx", "data/ops.json"],
        output_path="output/clean_data.csv",
        report_path="output/quality_report.txt",
        drop_duplicates=True,
        duplicate_subset=["订单号"],
        column_mapping={"订单编号": "订单号", "客户名称": "客户", "金额（元）": "金额"},
        type_mapping={"金额": "numeric", "数量": "int", "日期": "datetime"},
        fill_na_strategy={"金额": "median", "客户": "未知", "数量": 0},
        validation_rules={
            "金额": lambda x: x > 0 if pd.notna(x) else False,
            "数量": lambda x: x > 0 if pd.notna(x) else False,
            "订单号": lambda x: bool(re.match(r"^[A-Z]{2,3}-\d{6}$", str(x))) if pd.notna(x) else False,
        },
    )
    result = DataCleaningPipeline(config).run()
    print(f"最终: {len(result)} 行, {len(result.columns)} 列")
```

## 踩坑提醒

**不检测编码直接读取**：GBK 文件用 UTF-8 读会报错。先调 `detect_encoding()`。

**去重后忘记重置索引**：`drop_duplicates()` 后加 `.reset_index(drop=True)`。

**验证规则写得太严格**：要求金额必须是整数，排除了合法的 0.5 元。

**覆盖原始数据**：清洗后的数据应另存，不要覆盖原始文件。

## 练习

### 练习一：扩展 Pipeline 支持数据合并

添加 `merge_rules` 配置，支持将多个输入文件按指定列合并（类似 SQL JOIN）。

### 练习二：添加数据转换函数

添加 `transform_functions` 配置，支持对特定列应用自定义转换（如手机号加 `+86` 前缀，金额分转元）。

### 练习三：实现增量清洗

修改 Pipeline 支持增量模式：只处理新增数据，追加到已有输出文件。

---

## 参考答案

### 练习一

```python
@dataclass
class MergeRule:
    right_file: str
    on: str | list[str]
    how: str = "left"

def apply_merge_rules(df: pd.DataFrame, rules: list[MergeRule]) -> pd.DataFrame:
    for rule in rules:
        right = read_file(rule.right_file)
        df = df.merge(right, on=rule.on, how=rule.how, suffixes=("", "_right"))
    return df
```

`how` 参数对应 SQL JOIN 类型；`suffixes` 处理同名列。

### 练习二

```python
def apply_transforms(df: pd.DataFrame, transforms: dict[str, callable]) -> pd.DataFrame:
    for col, func in transforms.items():
        if col in df.columns:
            df[col] = df[col].apply(func)
    return df

# 使用示例
transform_functions = {
    "手机号": lambda x: f"+86{x}" if pd.notna(x) and not str(x).startswith("+") else x,
    "金额": lambda x: x / 100 if pd.notna(x) else x,
}
```

每个函数内部要处理 NaN；转换失败不应中断 Pipeline。

### 练习三

```python
def incremental_clean(config: PipelineConfig, key_columns: list[str]) -> pd.DataFrame:
    output_path = Path(config.output_path)
    existing = read_file(str(output_path)) if output_path.exists() else pd.DataFrame()
    existing_keys = set(existing[key_columns].apply(tuple, axis=1)) if not existing.empty else set()

    new_data = pd.concat([read_file(p) for p in config.input_paths], ignore_index=True)
    if config.column_mapping:
        new_data = standardize_columns(new_data, config.column_mapping)
    new_data["_key"] = new_data[key_columns].apply(tuple, axis=1)
    truly_new = new_data[~new_data["_key"].isin(existing_keys)].drop(columns=["_key"])

    if truly_new.empty:
        return existing

    report = QualityReport()
    report.total_rows = len(truly_new)
    if config.type_mapping:
        truly_new = convert_types(truly_new, config.type_mapping, report)
    truly_new = remove_duplicates(truly_new, config.duplicate_subset, report)
    if config.fill_na_strategy:
        truly_new = handle_missing(truly_new, config.fill_na_strategy, report)

    result = pd.concat([existing, truly_new], ignore_index=True) if not existing.empty else truly_new
    result.to_csv(output_path, index=False, encoding="utf-8-sig")
    return result
```

用 key_columns 组合判断新数据；增量模式只清洗新数据；首次运行处理全量。
