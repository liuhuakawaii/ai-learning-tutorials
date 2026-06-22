# 第2课：Transform - 清洗、去重、标准化

> **课程定位**：掌握数据清洗的核心技术，把原始数据变成高质量数据
> **前置知识**：第1课（Extract）
> **预计时长**：60 分钟

---

## 场景引入

你从三个招聘网站拉回来的原始数据终于入库了，兴冲冲地跑了个查询："北京 3-5 年经验的前端平均薪资多少？"结果发现薪资字段有的是"20K-35K·14薪"，有的是"￥8000-12000/月"，有的干脆是"面议"；经验字段有人写"3年"，有人写"3-5年"，还有人写"应届生"。三个来源的数据格式完全不同，根本没法直接做统计分析。这就是 Transform 要解决的问题——把"方言"统一成"普通话"。

---

## 学习目标

完成本课学习后，你将能够：

1. 实现常见的数据清洗操作
2. 设计数据去重策略
3. 标准化字段格式和枚举值
4. 处理缺失值和异常值
5. 设计可复用的转换管道

---

## 一、Transform 的定位

### 1.1 在 ETL 中的角色

```
┌──────────────────────────────────────────────────────────────┐
│                    Transform 的职责                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Extract（提取）→ Transform（转换）→ Load（加载）            │
│       │                  │                  │                │
│       │              本课重点              │                │
│       ▼                  ▼                  ▼                │
│   原始数据  ──→    清洗、转换    ──→    高质量数据            │
│                                                              │
│   核心任务：                                                   │
│   ├── 清洗：去除噪声、修正错误                               │
│   ├── 去重：识别和处理重复数据                               │
│   ├── 标准化：统一格式、统一枚举                             │
│   └── 转换：计算派生字段、拆分合并                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、数据清洗

### 2.1 字符串清洗

```python
import re
from typing import Optional

class StringCleaner:
    """字符串清洗器"""
    
    @staticmethod
    def strip(text: Optional[str]) -> Optional[str]:
        """去除首尾空白"""
        if text is None:
            return None
        return text.strip()
    
    @staticmethod
    def normalize_whitespace(text: Optional[str]) -> Optional[str]:
        """标准化空白字符"""
        if text is None:
            return None
        # 多个空格合并为一个
        return re.sub(r'\s+', ' ', text).strip()
    
    @staticmethod
    def remove_special_chars(text: Optional[str], keep_chars: str = "") -> Optional[str]:
        """移除特殊字符"""
        if text is None:
            return None
        pattern = f'[^\\w\\s{re.escape(keep_chars)}]'
        return re.sub(pattern, '', text)
    
    @staticmethod
    def normalize_unicode(text: Optional[str]) -> Optional[str]:
        """标准化 Unicode 字符"""
        if text is None:
            return None
        import unicodedata
        return unicodedata.normalize('NFKC', text)

# 使用示例
cleaner = StringCleaner()
print(cleaner.strip("  hello  "))  # "hello"
print(cleaner.normalize_whitespace("hello   world"))  # "hello world"
```

### 2.2 数值清洗

```python
from decimal import Decimal, InvalidOperation
from typing import Union

class NumericCleaner:
    """数值清洗器"""
    
    @staticmethod
    def to_decimal(value: Union[str, int, float, None]) -> Optional[Decimal]:
        """转换为 Decimal"""
        if value is None:
            return None
        
        if isinstance(value, (int, float)):
            return Decimal(str(value))
        
        if isinstance(value, str):
            # 移除货币符号
            cleaned = re.sub(r'[￥$€¥,]', '', value.strip())
            try:
                return Decimal(cleaned)
            except InvalidOperation:
                return None
        
        return None
    
    @staticmethod
    def to_int(value: Union[str, float, None]) -> Optional[int]:
        """转换为整数"""
        if value is None:
            return None
        
        if isinstance(value, int):
            return value
        
        if isinstance(value, float):
            return int(value)
        
        if isinstance(value, str):
            # 移除非数字字符
            cleaned = re.sub(r'[^\d.-]', '', value.strip())
            try:
                return int(float(cleaned))
            except ValueError:
                return None
        
        return None
    
    @staticmethod
    def clamp(value: Optional[float], min_val: float, max_val: float) -> Optional[float]:
        """限制数值范围"""
        if value is None:
            return None
        return max(min_val, min(value, max_val))

# 使用示例
numeric = NumericCleaner()
print(numeric.to_decimal("￥8999.00"))  # Decimal('8999.00')
print(numeric.to_int("约100人"))  # 100
print(numeric.clamp(150, 0, 100))  # 100
```

### 2.3 日期时间清洗

```python
from datetime import datetime, date
from typing import Optional, Union

class DateTimeCleaner:
    """日期时间清洗器"""
    
    # 常见日期格式
    DATE_FORMATS = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y年%m月%d日",
        "%d/%m/%Y",
        "%m/%d/%Y",
    ]
    
    DATETIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y/%m/%d %H:%M:%S",
        "%Y年%m月%d日 %H:%M:%S",
    ]
    
    @classmethod
    def parse_date(cls, value: Union[str, None]) -> Optional[date]:
        """解析日期"""
        if value is None:
            return None
        
        if isinstance(value, date):
            return value
        
        if isinstance(value, datetime):
            return value.date()
        
        value = str(value).strip()
        
        for fmt in cls.DATE_FORMATS:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        
        return None
    
    @classmethod
    def parse_datetime(cls, value: Union[str, None]) -> Optional[datetime]:
        """解析日期时间"""
        if value is None:
            return None
        
        if isinstance(value, datetime):
            return value
        
        value = str(value).strip()
        
        for fmt in cls.DATETIME_FORMATS:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        
        return None
    
    @staticmethod
    def format_date(dt: Optional[date], fmt: str = "%Y-%m-%d") -> Optional[str]:
        """格式化日期"""
        if dt is None:
            return None
        return dt.strftime(fmt)

# 使用示例
dt_cleaner = DateTimeCleaner()
print(dt_cleaner.parse_date("2024年1月15日"))  # date(2024, 1, 15)
print(dt_cleaner.parse_datetime("2024-01-15T08:30:00"))  # datetime(2024, 1, 15, 8, 30)
```

---

## 三、数据去重

### 3.1 去重策略

```
┌──────────────────────────────────────────────────────────────┐
│                    去重策略                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  策略 1：完全去重                                              │
│  ├── 判断标准：所有字段完全相同                              │
│  ├── 适用场景：数据完全重复                                  │
│  └── 实现：drop_duplicates()                                 │
│                                                              │
│  策略 2：基于唯一标识去重                                      │
│  ├── 判断标准：主键或唯一标识相同                            │
│  ├── 适用场景：同一实体多次采集                              │
│  └── 实现：基于主键去重                                      │
│                                                              │
│  策略 3：基于业务规则去重                                      │
│  ├── 判断标准：业务定义的相似度                              │
│  ├── 适用场景：近似重复数据                                  │
│  └── 实现：自定义去重逻辑                                    │
│                                                              │
│  策略 4：时间戳去重                                            │
│  ├── 判断标准：同一实体保留最新数据                          │
│  ├── 适用场景：数据有更新                                    │
│  └── 实现：按时间排序后去重                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 去重实现

```python
import pandas as pd
from typing import List, Optional, Dict, Any

class Deduplicator:
    """去重器"""
    
    @staticmethod
    def exact_dedup(data: pd.DataFrame) -> pd.DataFrame:
        """完全去重"""
        return data.drop_duplicates()
    
    @staticmethod
    def key_dedup(
        data: pd.DataFrame,
        key_columns: List[str],
        keep: str = "first"
    ) -> pd.DataFrame:
        """基于唯一标识去重"""
        return data.drop_duplicates(subset=key_columns, keep=keep)
    
    @staticmethod
    def latest_dedup(
        data: pd.DataFrame,
        key_columns: List[str],
        time_column: str
    ) -> pd.DataFrame:
        """保留最新数据"""
        # 按时间降序排序
        sorted_data = data.sort_values(time_column, ascending=False)
        # 保留每组的第一条（最新的）
        return sorted_data.drop_duplicates(subset=key_columns, keep="first")
    
    @staticmethod
    def fuzzy_dedup(
        data: pd.DataFrame,
        columns: List[str],
        threshold: float = 0.8
    ) -> pd.DataFrame:
        """模糊去重（基于相似度）"""
        # 简化实现：基于字符串相似度
        from difflib import SequenceMatcher
        
        def is_similar(row1, row2):
            for col in columns:
                str1 = str(row1.get(col, ""))
                str2 = str(row2.get(col, ""))
                ratio = SequenceMatcher(None, str1, str2).ratio()
                if ratio < threshold:
                    return False
            return True
        
        # 标记重复行
        to_drop = set()
        records = data.to_dict('records')
        
        for i in range(len(records)):
            if i in to_drop:
                continue
            for j in range(i + 1, len(records)):
                if j in to_drop:
                    continue
                if is_similar(records[i], records[j]):
                    to_drop.add(j)
        
        return data.drop(data.index[list(to_drop)])

# 使用示例
dedup = Deduplicator()

# 基于 job_id 去重
df_unique = dedup.key_dedup(df, key_columns=["job_id"])

# 保留最新的采集数据
df_latest = dedup.latest_dedup(
    df,
    key_columns=["job_id"],
    time_column="crawl_time"
)
```

---

## 四、数据标准化

### 4.1 枚举值标准化

```python
from typing import Dict, Optional

class EnumNormalizer:
    """枚举值标准化器"""
    
    def __init__(self, mapping: Dict[str, Dict[str, str]]):
        """
        mapping: {
            "field_name": {
                "原始值1": "标准值",
                "原始值2": "标准值",
            }
        }
        """
        self.mapping = mapping
    
    def normalize(self, field_name: str, value: Optional[str]) -> Optional[str]:
        """标准化枚举值"""
        if value is None:
            return None
        
        if field_name not in self.mapping:
            return value
        
        field_mapping = self.mapping[field_name]
        
        # 精确匹配
        if value in field_mapping:
            return field_mapping[value]
        
        # 模糊匹配
        value_lower = value.lower().strip()
        for key, normalized in field_mapping.items():
            if key.lower() in value_lower or value_lower in key.lower():
                return normalized
        
        return value  # 无法匹配时返回原值

# 使用示例
normalizer = EnumNormalizer({
    "experience": {
        "应届": "不限",
        "1年以下": "1-3年",
        "1-3年": "1-3年",
        "3-5年": "3-5年",
        "5-10年": "5-10年",
        "10年以上": "10年以上",
        "不限": "不限",
    },
    "education": {
        "大专": "大专",
        "本科": "本科",
        "硕士": "硕士",
        "博士": "博士",
        "不限": "不限",
    }
})

print(normalizer.normalize("experience", "应届"))  # "不限"
print(normalizer.normalize("experience", "1年以下"))  # "1-3年"
```

### 4.2 单位标准化

```python
from decimal import Decimal
from typing import Optional, Tuple

class UnitNormalizer:
    """单位标准化器"""
    
    @staticmethod
    def salary_to_monthly(
        amount: Optional[Decimal],
        unit: Optional[str]
    ) -> Optional[Decimal]:
        """薪资统一转换为月"""
        if amount is None:
            return None
        
        if unit is None:
            return amount
        
        unit = unit.lower().strip()
        
        # 年薪 → 月薪
        if "年" in unit:
            return amount / 12
        
        # 日薪 → 月薪（按22个工作日）
        if "日" in unit or "天" in unit:
            return amount * 22
        
        # 时薪 → 月薪（按8小时 * 22天）
        if "时" in unit or "小时" in unit:
            return amount * 8 * 22
        
        # 已经是月薪
        return amount
    
    @staticmethod
    def parse_salary_range(
        salary_str: Optional[str]
    ) -> Tuple[Optional[Decimal], Optional[Decimal], Optional[str]]:
        """解析薪资范围"""
        if salary_str is None:
            return None, None, None
        
        salary_str = salary_str.strip()
        
        # 匹配 "20K-35K·14薪" 模式
        match = re.search(r'(\d+)[Kk]?\s*[-~]\s*(\d+)[Kk]?(?:[·*](\d+)薪)?', salary_str)
        if match:
            min_salary = Decimal(match.group(1)) * 1000
            max_salary = Decimal(match.group(2)) * 1000
            months = int(match.group(3)) if match.group(3) else 12
            return min_salary, max_salary, f"{months}薪"
        
        # 匹配 "面议" 模式
        if "面议" in salary_str:
            return None, None, "面议"
        
        return None, None, None
```

### 4.3 地址标准化

```python
from typing import Dict, Optional, Tuple

class AddressNormalizer:
    """地址标准化器"""
    
    # 城市映射
    CITY_MAPPING = {
        "北京": "北京市",
        "上海": "上海市",
        "广州": "广州市",
        "深圳": "深圳市",
        "杭州": "杭州市",
        # ... 更多城市
    }
    
    @classmethod
    def normalize_city(cls, city: Optional[str]) -> Optional[str]:
        """标准化城市名称"""
        if city is None:
            return None
        
        city = city.strip()
        
        # 精确匹配
        if city in cls.CITY_MAPPING:
            return cls.CITY_MAPPING[city]
        
        # 模糊匹配
        for key, normalized in cls.CITY_MAPPING.items():
            if key in city or city in key:
                return normalized
        
        return city
    
    @staticmethod
    def parse_address(address: Optional[str]) -> Dict[str, Optional[str]]:
        """解析地址"""
        if address is None:
            return {"province": None, "city": None, "district": None}
        
        result = {"province": None, "city": None, "district": None}
        
        # 简单的地址解析逻辑
        parts = address.split()
        if len(parts) >= 1:
            result["city"] = parts[0]
        if len(parts) >= 2:
            result["district"] = parts[1]
        
        return result
```

---

## 五、缺失值处理

### 5.1 处理策略

```
┌──────────────────────────────────────────────────────────────┐
│                    缺失值处理策略                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  策略 1：删除                                                  │
│  ├── 删除包含缺失值的行                                      │
│  ├── 适用：缺失比例低、数据量大                              │
│  └── 注意：可能丢失有用信息                                  │
│                                                              │
│  策略 2：填充默认值                                            │
│  ├── 用固定值填充（如 0、""、"未知"）                        │
│  ├── 适用：有合理的默认值                                    │
│  └── 注意：可能引入偏差                                      │
│                                                              │
│  策略 3：填充统计值                                            │
│  ├── 用均值、中位数、众数填充                                │
│  ├── 适用：数值型字段                                        │
│  └── 注意：可能影响分布                                      │
│                                                              │
│  策略 4：前向/后向填充                                         │
│  ├── 用前一个或后一个值填充                                  │
│  ├── 适用：时间序列数据                                      │
│  └── 注意：可能传播错误                                      │
│                                                              │
│  策略 5：标记为缺失                                            │
│  ├── 保留 NULL，不做填充                                     │
│  ├── 适用：缺失本身就是信息                                  │
│  └── 注意：下游需要处理 NULL                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 实现代码

```python
import pandas as pd
from typing import Any, Dict, Optional

class MissingValueHandler:
    """缺失值处理器"""
    
    @staticmethod
    def drop_rows(data: pd.DataFrame, columns: Optional[List[str]] = None) -> pd.DataFrame:
        """删除包含缺失值的行"""
        return data.dropna(subset=columns)
    
    @staticmethod
    def fill_default(data: pd.DataFrame, defaults: Dict[str, Any]) -> pd.DataFrame:
        """填充默认值"""
        return data.fillna(defaults)
    
    @staticmethod
    def fill_mean(data: pd.DataFrame, columns: List[str]) -> pd.DataFrame:
        """填充均值"""
        result = data.copy()
        for col in columns:
            if col in result.columns:
                result[col] = result[col].fillna(result[col].mean())
        return result
    
    @staticmethod
    def fill_median(data: pd.DataFrame, columns: List[str]) -> pd.DataFrame:
        """填充中位数"""
        result = data.copy()
        for col in columns:
            if col in result.columns:
                result[col] = result[col].fillna(result[col].median())
        return result
    
    @staticmethod
    def fill_mode(data: pd.DataFrame, columns: List[str]) -> pd.DataFrame:
        """填充众数"""
        result = data.copy()
        for col in columns:
            if col in result.columns:
                mode_value = result[col].mode()
                if not mode_value.empty:
                    result[col] = result[col].fillna(mode_value[0])
        return result

# 使用示例
handler = MissingValueHandler()

# 删除关键字段缺失的行
df_clean = handler.drop_rows(df, columns=["job_id", "title"])

# 填充默认值
df_filled = handler.fill_default(df, {
    "experience": "未知",
    "education": "未知",
    "salary_avg": 0
})

# 数值字段填充中位数
df_filled = handler.fill_median(df, ["salary_min", "salary_max"])
```

---

## 六、异常值处理

### 6.1 异常值检测

```python
import numpy as np
from typing import List, Tuple

class OutlierDetector:
    """异常值检测器"""
    
    @staticmethod
    def iqr_method(
        data: pd.Series,
        factor: float = 1.5
    ) -> Tuple[pd.Series, float, float]:
        """IQR 方法检测异常值"""
        q1 = data.quantile(0.25)
        q3 = data.quantile(0.75)
        iqr = q3 - q1
        
        lower_bound = q1 - factor * iqr
        upper_bound = q3 + factor * iqr
        
        outlier_mask = (data < lower_bound) | (data > upper_bound)
        
        return outlier_mask, lower_bound, upper_bound
    
    @staticmethod
    def zscore_method(
        data: pd.Series,
        threshold: float = 3.0
    ) -> Tuple[pd.Series, pd.Series]:
        """Z-score 方法检测异常值"""
        mean = data.mean()
        std = data.std()
        
        z_scores = (data - mean) / std
        outlier_mask = abs(z_scores) > threshold
        
        return outlier_mask, z_scores
    
    @staticmethod
    def range_method(
        data: pd.Series,
        min_val: Optional[float] = None,
        max_val: Optional[float] = None
    ) -> pd.Series:
        """范围方法检测异常值"""
        outlier_mask = pd.Series(False, index=data.index)
        
        if min_val is not None:
            outlier_mask = outlier_mask | (data < min_val)
        
        if max_val is not None:
            outlier_mask = outlier_mask | (data > max_val)
        
        return outlier_mask
```

### 6.2 异常值处理

```python
from typing import Literal

class OutlierHandler:
    """异常值处理器"""
    
    @staticmethod
    def remove(data: pd.DataFrame, outlier_mask: pd.Series) -> pd.DataFrame:
        """删除异常值"""
        return data[~outlier_mask]
    
    @staticmethod
    def clip(
        data: pd.DataFrame,
        column: str,
        lower: Optional[float] = None,
        upper: Optional[float] = None
    ) -> pd.DataFrame:
        """截断异常值"""
        result = data.copy()
        result[column] = result[column].clip(lower=lower, upper=upper)
        return result
    
    @staticmethod
    def replace_with_nan(data: pd.DataFrame, outlier_mask: pd.Series) -> pd.DataFrame:
        """替换为 NaN"""
        result = data.copy()
        result[outlier_mask] = np.nan
        return result
    
    @staticmethod
    def replace_with_median(data: pd.DataFrame, column: str, outlier_mask: pd.Series) -> pd.DataFrame:
        """替换为中位数"""
        result = data.copy()
        median_val = result[column].median()
        result.loc[outlier_mask, column] = median_val
        return result

# 使用示例
detector = OutlierDetector()
handler = OutlierHandler()

# 检测薪资异常
outlier_mask, lower, upper = detector.iqr_method(df["salary_avg"])

# 处理异常值：截断到合理范围
df_clean = handler.clip(df, "salary_avg", lower=0, upper=100000)
```

---

## 七、转换管道

### 7.1 管道设计

```python
from typing import List, Callable, Any
import pandas as pd

class TransformPipeline:
    """转换管道"""
    
    def __init__(self):
        self.steps: List[Callable] = []
    
    def add_step(self, func: Callable, **kwargs) -> 'TransformPipeline':
        """添加转换步骤"""
        self.steps.append((func, kwargs))
        return self
    
    def execute(self, data: pd.DataFrame) -> pd.DataFrame:
        """执行管道"""
        result = data.copy()
        
        for func, kwargs in self.steps:
            result = func(result, **kwargs)
        
        return result

# 使用示例
pipeline = TransformPipeline()

# 添加清洗步骤
pipeline.add_step(StringCleaner.strip, columns=["title", "company"])
pipeline.add_step(NumericCleaner.clean_salary, column="salary")
pipeline.add_step(EnumNormalizer.normalize, mapping=enum_mapping)
pipeline.add_step(MissingValueHandler.fill_default, defaults=defaults)
pipeline.add_step(Deduplicator.key_dedup, key_columns=["job_id"])

# 执行管道
df_clean = pipeline.execute(df_raw)
```

### 7.2 完整的转换类

```python
from dataclasses import dataclass
from typing import Dict, Any, Optional
import pandas as pd

@dataclass
class TransformConfig:
    """转换配置"""
    # 字符串清洗
    strip_columns: List[str] = None
    
    # 数值转换
    numeric_columns: Dict[str, str] = None  # column -> type
    
    # 日期转换
    date_columns: Dict[str, str] = None  # column -> format
    
    # 枚举标准化
    enum_mapping: Dict[str, Dict[str, str]] = None
    
    # 缺失值填充
    fill_defaults: Dict[str, Any] = None
    
    # 去重配置
    dedup_keys: List[str] = None
    dedup_time_column: Optional[str] = None

class DataTransformer:
    """数据转换器"""
    
    def __init__(self, config: TransformConfig):
        self.config = config
        self.string_cleaner = StringCleaner()
        self.numeric_cleaner = NumericCleaner()
        self.date_cleaner = DateTimeCleaner()
        self.deduplicator = Deduplicator()
        self.missing_handler = MissingValueHandler()
    
    def transform(self, data: pd.DataFrame) -> pd.DataFrame:
        """执行转换"""
        result = data.copy()
        
        # 1. 字符串清洗
        if self.config.strip_columns:
            for col in self.config.strip_columns:
                if col in result.columns:
                    result[col] = result[col].apply(self.string_cleaner.strip)
        
        # 2. 数值转换
        if self.config.numeric_columns:
            for col, dtype in self.config.numeric_columns.items():
                if col in result.columns:
                    if dtype == "decimal":
                        result[col] = result[col].apply(self.numeric_cleaner.to_decimal)
                    elif dtype == "int":
                        result[col] = result[col].apply(self.numeric_cleaner.to_int)
        
        # 3. 日期转换
        if self.config.date_columns:
            for col, fmt in self.config.date_columns.items():
                if col in result.columns:
                    result[col] = result[col].apply(self.date_cleaner.parse_date)
        
        # 4. 枚举标准化
        if self.config.enum_mapping:
            normalizer = EnumNormalizer(self.config.enum_mapping)
            for field_name in self.config.enum_mapping:
                if field_name in result.columns:
                    result[field_name] = result[field_name].apply(
                        lambda x: normalizer.normalize(field_name, x)
                    )
        
        # 5. 缺失值填充
        if self.config.fill_defaults:
            result = self.missing_handler.fill_default(result, self.config.fill_defaults)
        
        # 6. 去重
        if self.config.dedup_keys:
            if self.config.dedup_time_column:
                result = self.deduplicator.latest_dedup(
                    result,
                    self.config.dedup_keys,
                    self.config.dedup_time_column
                )
            else:
                result = self.deduplicator.key_dedup(result, self.config.dedup_keys)
        
        return result
```

---

## 常见误区

- **清洗时直接丢弃"脏数据"**：看到格式不对就删掉，可能丢失有价值的记录。应该先尝试修复，修复不了再隔离，而不是直接删除。
- **去重只用 `drop_duplicates()`**：完全去重只能处理所有字段完全相同的记录。实际业务中，同一职位在不同时间采集的数据字段可能略有不同，需要基于业务主键 + 时间戳做去重。
- **标准化映射表写死在代码里**：枚举值的映射关系应该配置化（JSON/YAML/数据库），方便运营人员维护，而不是硬编码在 Python 代码中。
- **忽略缺失值的业务含义**：薪资字段为空不代表数据有问题，可能就是"面议"。盲目填充 0 或均值会产生误导，应该区分"数据缺失"和"业务上的空值"。

---

## 工程建议

1. **转换管道要可测试、可回放**：每个清洗步骤设计为纯函数（输入 DataFrame，输出 DataFrame），方便单独测试和排查哪一步出了问题。
2. **保留清洗前后的对比日志**：记录"改了什么、改了多少、从什么改成什么"，方便审计和回溯。比如"将 1523 条记录的 experience 字段从'应届'改为'不限'"。
3. **标准化规则要版本化管理**：映射表和清洗规则随业务变化会频繁更新，建议用 Git 管理配置文件，或存到数据库并记录变更历史。
4. **大数据量下优先用向量化操作**：`pandas` 的 `str.contains()`、`map()`、`apply()` 性能差异很大。能用向量化操作就不要逐行遍历，万级数据差距不明显，百万级差距可以到 100 倍。

---

## 动手练习

### 练习一：实现薪资清洗

实现一个薪资清洗函数，处理以下格式：

```python
test_data = [
    "20K-35K·14薪",
    "￥8000-12000/月",
    "面议",
    "15-25万/年",
    None
]

# 输出：(min_salary, max_salary, unit)
```

### 练习二：实现去重逻辑

实现一个去重函数，要求：

1. 基于 job_id 去重
2. 保留最新的数据
3. 记录被去重的数据

### 练习三：设计转换管道

设计一个完整的转换管道，包含：

1. 字符串清洗
2. 数值转换
3. 枚举标准化
4. 缺失值处理
5. 去重

---

## 小结

本课的核心要点：

1. **字符串清洗**：去除空白、标准化、特殊字符处理
2. **数值清洗**：类型转换、单位统一、范围限制
3. **日期清洗**：多格式解析、标准化输出
4. **去重策略**：完全去重、键去重、时间戳去重
5. **标准化**：枚举值、单位、地址
6. **缺失值处理**：删除、填充默认值、填充统计值
7. **异常值处理**：IQR、Z-score、范围检测
8. **转换管道**：组合多个转换步骤，实现可复用

---

## 下一课预告

下一课我们将学习 **Load - 入库、更新、幂等**，把清洗后的数据写入数据库，并确保重复执行不会产生重复数据。

---

## 参考答案

### 练习一

**思路**：薪资清洗需要处理多种格式（"20K-35K·14薪"、"￥8000-12000/月"、"15-25万/年"、"面议"、None），核心是用正则表达式匹配不同模式，提取最小值、最大值和单位，然后统一转换为月薪数值。

**答案**：

```python
import re
from decimal import Decimal
from typing import Optional, Tuple


def parse_salary(salary_str: Optional[str]) -> Tuple[Optional[Decimal], Optional[Decimal], Optional[str]]:
    """解析薪资字符串

    Args:
        salary_str: 薪资字符串

    Returns:
        (min_salary, max_salary, unit) 元组，月薪数值
    """
    if salary_str is None:
        return None, None, None

    salary_str = salary_str.strip()

    if not salary_str or salary_str == "面议":
        return None, None, "面议"

    # 模式1: "20K-35K·14薪" 或 "20k-35k*14薪"
    match = re.search(r'(\d+)[Kk]\s*[-~]\s*(\d+)[Kk](?:[·*×](\d+)薪)?', salary_str)
    if match:
        min_val = Decimal(match.group(1)) * 1000
        max_val = Decimal(match.group(2)) * 1000
        months = int(match.group(3)) if match.group(3) else 12
        # 转换为月薪
        return min_val * months / 12, max_val * months / 12, f"{months}薪"

    # 模式2: "￥8000-12000/月" 或 "8000-12000元/月"
    match = re.search(r'[￥¥]?\s*(\d+)\s*[-~]\s*(\d+)\s*[/每]?月', salary_str)
    if match:
        return Decimal(match.group(1)), Decimal(match.group(2)), "月薪"

    # 模式3: "15-25万/年"
    match = re.search(r'(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)\s*万?\s*[/每]?年', salary_str)
    if match:
        min_val = Decimal(match.group(1)) * 10000 / 12
        max_val = Decimal(match.group(2)) * 10000 / 12
        return min_val, max_val, "年薪"

    # 模式4: 纯数字 "8000-12000"
    match = re.search(r'(\d+)\s*[-~]\s*(\d+)', salary_str)
    if match:
        return Decimal(match.group(1)), Decimal(match.group(2)), "未知"

    return None, None, None


# 测试
test_data = [
    "20K-35K·14薪",
    "￥8000-12000/月",
    "面议",
    "15-25万/年",
    None
]

for item in test_data:
    result = parse_salary(item)
    print(f"{str(item):20s} -> min={result[0]}, max={result[1]}, unit={result[2]}")

# 输出:
# 20K-35K·14薪         -> min=23333.33333333333333333333333, max=40833.33333333333333333333333, unit=14薪
# ￥8000-12000/月      -> min=8000, max=12000, unit=月薪
# 面议                 -> min=None, max=None, unit=面议
# 15-25万/年           -> min=12500.00000000000000000000000, max=20833.33333333333333333333333, unit=年薪
# None                 -> min=None, max=None, unit=None
```

**要点**：
- 用正则分组提取数值，`match.group(3)` 处理可选的"N薪"部分
- 年薪和"N薪"模式都需要除以 12 转换为月薪，保持单位统一
- "面议"和 None 是业务上的正常值，不应视为错误数据

### 练习二

**思路**：去重的核心是基于业务主键（job_id）识别重复记录，保留最新的一条。需要按时间降序排序后去重，同时记录被去重掉的数据以便审计。

**答案**：

```python
import pandas as pd
from typing import Dict, List, Tuple


def deduplicate_jobs(
    df: pd.DataFrame,
    key_column: str = "job_id",
    time_column: str = "crawl_time"
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """基于 job_id 去重，保留最新数据

    Args:
        df: 原始数据
        key_column: 去重键列
        time_column: 时间列（用于判断新旧）

    Returns:
        (去重后的数据, 被去重的数据)
    """
    if df.empty:
        return df, df

    # 确保时间列是 datetime 类型
    if time_column in df.columns:
        df = df.copy()
        df[time_column] = pd.to_datetime(df[time_column], errors="coerce")

    # 按时间降序排序，保留每组第一条（最新的）
    if time_column in df.columns:
        sorted_df = df.sort_values(time_column, ascending=False)
    else:
        sorted_df = df

    # 标记重复行（keep='first' 保留第一条，即最新的）
    duplicated_mask = sorted_df.duplicated(subset=[key_column], keep="first")

    # 分离去重数据和被去重数据
    unique_data = sorted_df[~duplicated_mask].copy()
    removed_data = sorted_df[duplicated_mask].copy()

    # 添加去重标记
    if not removed_data.empty:
        removed_data["dedup_reason"] = "同 job_id 存在更新记录"

    # 重置索引
    unique_data = unique_data.reset_index(drop=True)
    removed_data = removed_data.reset_index(drop=True)

    return unique_data, removed_data


# 测试数据
data = pd.DataFrame([
    {"job_id": "J001", "title": "前端开发", "salary": "20K", "crawl_time": "2024-01-10 08:00:00"},
    {"job_id": "J002", "title": "后端开发", "salary": "25K", "crawl_time": "2024-01-10 09:00:00"},
    {"job_id": "J001", "title": "前端开发", "salary": "22K", "crawl_time": "2024-01-15 10:00:00"},
    {"job_id": "J003", "title": "产品经理", "salary": "30K", "crawl_time": "2024-01-11 08:00:00"},
    {"job_id": "J002", "title": "后端开发", "salary": "28K", "crawl_time": "2024-01-16 11:00:00"},
])

unique_df, removed_df = deduplicate_jobs(data)

print("去重后数据:")
print(unique_df[["job_id", "title", "salary", "crawl_time"]])
print(f"\n被去重数据 ({len(removed_df)} 条):")
print(removed_df[["job_id", "title", "salary", "crawl_time", "dedup_reason"]])
```

**要点**：
- 先按时间降序排序，再用 `drop_duplicates(keep="first")` 保留最新记录
- 被去重的数据单独保存，附带去重原因，方便后续审计
- 时间列需要先转为 datetime 类型，否则排序结果可能不符合预期

### 练习三

**思路**：转换管道的核心是将多个清洗步骤串联成管道，每个步骤是纯函数（输入 DataFrame，输出 DataFrame），支持链式调用和单独测试。

**答案**：

```python
import pandas as pd
import re
from typing import List, Callable, Dict, Any, Optional
from decimal import Decimal


class TransformPipeline:
    """转换管道"""

    def __init__(self):
        self.steps: List[tuple] = []
        self.change_log: List[Dict] = []

    def add_step(self, name: str, func: Callable, **kwargs) -> "TransformPipeline":
        """添加转换步骤"""
        self.steps.append((name, func, kwargs))
        return self

    def execute(self, data: pd.DataFrame) -> pd.DataFrame:
        """执行管道"""
        result = data.copy()

        for name, func, kwargs in self.steps:
            before_count = len(result)
            result = func(result, **kwargs)
            after_count = len(result)

            self.change_log.append({
                "step": name,
                "before_count": before_count,
                "after_count": after_count,
                "changed": before_count - after_count
            })

        return result

    def get_change_log(self) -> List[Dict]:
        """获取变更日志"""
        return self.change_log


def step_strip_strings(df: pd.DataFrame, columns: List[str]) -> pd.DataFrame:
    """步骤：字符串清洗"""
    result = df.copy()
    for col in columns:
        if col in result.columns:
            result[col] = result[col].astype(str).str.strip()
    return result


def step_normalize_salary(df: pd.DataFrame) -> pd.DataFrame:
    """步骤：薪资标准化"""
    result = df.copy()
    if "salary" in result.columns:
        result["salary_min"] = result["salary"].apply(lambda x: parse_salary(x)[0] if pd.notna(x) else None)
        result["salary_max"] = result["salary"].apply(lambda x: parse_salary(x)[1] if pd.notna(x) else None)
    return result


def step_normalize_enum(
    df: pd.DataFrame,
    column: str,
    mapping: Dict[str, str]
) -> pd.DataFrame:
    """步骤：枚举标准化"""
    result = df.copy()
    if column in result.columns:
        result[column] = result[column].map(mapping).fillna(result[column])
    return result


def step_fill_missing(
    df: pd.DataFrame,
    defaults: Dict[str, Any]
) -> pd.DataFrame:
    """步骤：缺失值填充"""
    return df.fillna(defaults)


def step_deduplicate(
    df: pd.DataFrame,
    key_columns: List[str],
    time_column: Optional[str] = None
) -> pd.DataFrame:
    """步骤：去重"""
    if time_column and time_column in df.columns:
        sorted_df = df.sort_values(time_column, ascending=False)
        return sorted_df.drop_duplicates(subset=key_columns, keep="first")
    return df.drop_duplicates(subset=key_columns)


# 使用示例
pipeline = TransformPipeline()
pipeline.add_step("字符串清洗", step_strip_strings, columns=["title", "company", "city"])
pipeline.add_step("薪资标准化", step_normalize_salary)
pipeline.add_step("经验枚举标准化", step_normalize_enum, column="experience", mapping={
    "应届": "不限", "1年以下": "1-3年", "1-3年": "1-3年", "3-5年": "3-5年"
})
pipeline.add_step("缺失值填充", step_fill_missing, defaults={"experience": "未知", "education": "未知"})
pipeline.add_step("去重", step_deduplicate, key_columns=["job_id"], time_column="crawl_time")

# 执行
df_clean = pipeline.execute(df_raw)

# 查看变更日志
for log in pipeline.get_change_log():
    print(f"{log['step']}: {log['before_count']} -> {log['after_count']} (变化: {log['changed']})")
```

**要点**：
- 每个步骤是纯函数，输入 DataFrame 返回 DataFrame，方便单独测试
- `change_log` 记录每步前后记录数变化，方便排查哪一步丢数据
- 管道支持链式 `add_step()` 调用，也可以通过配置文件动态组装步骤
