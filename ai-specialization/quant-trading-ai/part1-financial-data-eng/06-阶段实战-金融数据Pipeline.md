# 06 阶段实战：金融数据 Pipeline

## 从一份"脏数据"开始

你拿到一份 A 股日线数据准备回测，第一眼就发现问题：

```python
import pandas as pd
import numpy as np
from pathlib import Path
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('pipeline')

np.random.seed(42)

def generate_dirty_data():
    n = 500
    dates = pd.bdate_range('2022-01-01', periods=n)
    close = 50 * np.cumprod(1 + np.random.normal(0.0002, 0.02, n))
    volume = np.random.randint(1_000_000, 30_000_000, n).astype(float)
    close[50:53] = np.nan          # 缺失值
    close[200] = 0                 # 价格为0
    close[300] = -5.0              # 负价格
    volume[250:255] = 0            # 停牌
    close[350] = close[349] * 1.15 # 涨幅超限
    high = close * 1.02
    low = close * 0.98
    high[400] = close[400] * 0.95  # 高低价反转
    low[400] = close[400] * 1.05
    dates_dup = list(dates[:150]) + [dates[149]] + list(dates[150:])
    close_dup = np.concatenate([close[:150], [close[149]], close[150:]])
    return pd.DataFrame({'symbol': 'T001', 'date': dates_dup[:len(close_dup)],
                         'open': close_dup * 1.001, 'high': high[:len(close_dup)],
                         'low': low[:len(close_dup)], 'close': close_dup,
                         'volume': volume[:len(close_dup)]})

dirty = generate_dirty_data()
print(f"数据量: {len(dirty)} 行")
print(f"缺失值: {dirty[['close']].isnull().sum().sum()}")
print(f"重复行: {dirty.duplicated(subset=['symbol','date']).sum()}")
print(f"价格<=0: {(dirty['close']<=0).sum()}")
```

## Pipeline：分层清洗

```python
@dataclass
class PipelineConfig:
    max_pct_change: float = 0.11
    min_price: float = 0.01
    output_dir: str = './data'

class DataCleaner:
    def __init__(self, config=None):
        self.config = config or PipelineConfig()

    def run(self, df):
        logger.info(f"开始清洗: {len(df)} 行")
        result = df.copy()
        result = self._fix_types(result)
        result = self._remove_duplicates(result)
        result = self._fix_anomalies(result)
        result = self._fill_missing(result)
        result = self._add_derived(result)
        logger.info(f"清洗完成: {len(df)} → {len(result)} 行")
        return result

    def _fix_types(self, df):
        df['date'] = pd.to_datetime(df['date'])
        for c in ['open','high','low','close','volume']:
            df[c] = pd.to_numeric(df[c], errors='coerce')
        return df

    def _remove_duplicates(self, df):
        before = len(df)
        df = df.drop_duplicates(subset=['symbol','date'], keep='last')
        if before - len(df) > 0:
            logger.info(f"删除重复行: {before - len(df)}")
        return df

    def _fix_anomalies(self, df):
        invalid = df['close'] <= self.config.min_price
        if invalid.any():
            df.loc[invalid, ['open','high','low','close']] = np.nan
            logger.info(f"标记无效价格: {invalid.sum()}")
        inv_hl = df['high'] < df['low']
        if inv_hl.any():
            df.loc[inv_hl, ['high','low']] = df.loc[inv_hl, ['low','high']].values
            logger.info(f"修正高低价反转: {inv_hl.sum()}")
        return df

    def _fill_missing(self, df):
        for c in ['open','high','low','close']:
            df[c] = df.groupby('symbol')[c].ffill()
        df['volume'] = df['volume'].fillna(0)
        return df

    def _add_derived(self, df):
        df = df.sort_values(['symbol','date'])
        df['return'] = df.groupby('symbol')['close'].pct_change()
        df['is_suspended'] = df['volume'] == 0
        return df

cleaner = DataCleaner()
cleaned = cleaner.run(dirty)
```

## 因子计算

```python
class FactorCalculator:
    def compute_all(self, df):
        df = df.copy()
        df['momentum_20d'] = df['close'] / df['close'].shift(20) - 1
        df['momentum_60d'] = df['close'] / df['close'].shift(60) - 1
        df['volatility_20d'] = df['return'].rolling(20).std() * np.sqrt(252)
        for w in [5, 10, 20, 60]:
            df[f'ma_dev_{w}d'] = (df['close'] - df['close'].rolling(w).mean()) / df['close'].rolling(w).mean()
        df['volume_ratio_20d'] = df['volume'] / df['volume'].rolling(20).mean()
        delta = df['close'].diff()
        gain = delta.where(delta>0,0).rolling(14).mean()
        loss = (-delta.where(delta<0,0)).rolling(14).mean()
        df['rsi_14'] = 1 - 1/(1 + gain/(loss+1e-10))
        return df

calc = FactorCalculator()
factors = calc.compute_all(cleaned)
print(f"因子列: {[c for c in factors.columns if c.startswith(('momentum','vol','ma_','volume_r','rsi'))]}")
```

## 质量报告与存储

```python
def quality_report(original, cleaned, factors):
    report = {
        '原始行数': len(original), '清洗后行数': len(cleaned),
        '数据完整率': f"{cleaned['close'].notna().mean():.2%}",
        '停牌天数': cleaned['is_suspended'].sum(),
    }
    for col in ['momentum_20d','volatility_20d','rsi_14']:
        if col in factors.columns:
            report[f'{col} 有效率'] = f"{factors[col].notna().mean():.2%}"
    return report

report = quality_report(dirty, cleaned, factors)
print("\n质量报告:")
for k, v in report.items(): print(f"  {k}: {v}")

def save_output(cleaned, factors, output_dir='./data'):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    cleaned.to_parquet(Path(output_dir)/'cleaned.parquet', index=False)
    factors.to_parquet(Path(output_dir)/'factors.parquet', index=False)
    print(f"数据已保存到 {output_dir}")
```

## 完整 Pipeline

```python
class StockPipeline:
    def __init__(self, config=None):
        self.config = config or PipelineConfig()
        self.cleaner = DataCleaner(self.config)
        self.factor_calc = FactorCalculator()

    def run(self, raw_data):
        cleaned = self.cleaner.run(raw_data)
        factors = self.factor_calc.compute_all(cleaned)
        report = quality_report(raw_data, cleaned, factors)
        save_output(cleaned, factors, self.config.output_dir)
        return {'cleaned': cleaned, 'factors': factors, 'report': report}

pipeline = StockPipeline()
result = pipeline.run(dirty)
print("\n最终报告:")
for k, v in result['report'].items(): print(f"  {k}: {v}")
```

## 生产环境的额外考量

- **调度**：收盘后自动运行，失败时重试。简单用 `schedule`，复杂用 Airflow
- **限频**：免费数据源有调用限制，采集 5000 只股票需要控制速率
- **告警**：Pipeline 失败时发送通知，不要等第二天才发现数据没更新
- **多数据源容灾**：主数据源挂了自动切换备用源

这些都不是算法问题，而是工程问题。但任何一个处理不好，都会让策略在关键时刻掉链子。

## 练习

### 练习一：多股票支持

修改 Pipeline 支持同时处理多只股票（按 symbol 列区分）。

### 练习二：增量更新

实现 `run_incremental()`：只采集最近 N 天数据，与历史数据合并，避免全量重算。

---

## 参考答案

### 练习一

```python
def run_multi_stock(self, raw_data):
    results = {}
    for symbol in raw_data['symbol'].unique():
        stock = raw_data[raw_data['symbol'] == symbol].copy()
        results[symbol] = {'cleaned': self.cleaner.run(stock),
                           'factors': self.factor_calc.compute_all(self.cleaner.run(stock))}
    all_cleaned = pd.concat([v['cleaned'] for v in results.values()])
    all_factors = pd.concat([v['factors'] for v in results.values()])
    return {'cleaned': all_cleaned, 'factors': all_factors}
```

### 练习二

```python
def run_incremental(self, new_data, existing_path):
    existing = pd.read_parquet(existing_path)
    new_only = new_data[new_data['date'] > existing['date'].max()]
    if new_only.empty:
        return {'cleaned': existing}
    cleaned_new = self.cleaner.run(new_only)
    merged = pd.concat([existing, cleaned_new]).drop_duplicates(subset=['symbol','date'], keep='last')
    merged = merged.sort_values(['symbol','date'])
    return {'cleaned': merged, 'factors': self.factor_calc.compute_all(merged)}
```
