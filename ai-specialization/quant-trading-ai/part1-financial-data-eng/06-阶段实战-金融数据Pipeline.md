# 阶段实战：金融数据 Pipeline

> 整合前 5 课知识，构建一个完整的 A 股数据采集、清洗、存储、因子计算 Pipeline。

## 场景引入

经过前 5 课的学习，你已经掌握了：

- 量化交易的完整链路（第 1 课）
- 金融数据采集的工程实践（第 2 课）
- 数据清洗与对齐的方法（第 3 课）
- 时序数据的存储方案（第 4 课）
- 因子数据管道的构建（第 5 课）

现在，是时候把这些知识整合成一个**完整的、可运行的、生产级的**金融数据 Pipeline 了。

本课的目标是构建这样一个系统：每天自动采集 A 股行情数据，清洗入库，计算因子，输出可供策略使用的因子数据。整个过程全自动运行，异常时发送告警。

## 学习目标

完成本课后，你将能够：

1. 设计模块化的数据 Pipeline 架构
2. 实现数据采集、清洗、存储、因子计算的完整流程
3. 添加调度和监控机制
4. 处理生产环境中的异常和降级策略

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    金融数据 Pipeline 架构                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      调度层 (Scheduler)                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │ │
│  │  │ 定时触发  │  │ 手动触发  │  │ 依赖检查  │  │ 重试策略  │     │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      采集层 (Collector)                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │ │
│  │  │ AKShare  │  │ 限频控制  │  │ 断点续传  │  │ 增量采集  │     │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      清洗层 (Cleaner)                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │ │
│  │  │ 缺失值   │  │ 异常值   │  │ 复权处理  │  │ 质量校验  │     │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      存储层 (Storage)                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │ │
│  │  │ Parquet  │  │ 缓存管理  │  │ 版本控制  │  │ 生命周期  │     │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      计算层 (Factor)                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │ │
│  │  │ DAG 调度  │  │ 增量计算  │  │ 质量监控  │  │ 结果输出  │     │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      监控层 (Monitor)                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │ │
│  │  │ 日志记录  │  │ 异常告警  │  │ 指标统计  │  │ 健康检查  │     │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 项目结构

```
stock-pipeline/
├── config.py              # 配置管理
├── collector.py           # 数据采集模块
├── cleaner.py             # 数据清洗模块
├── storage.py             # 存储模块
├── factor.py              # 因子计算模块
├── pipeline.py            # Pipeline 主流程
├── monitor.py             # 监控与告警
├── scheduler.py           # 调度器
├── main.py                # 入口文件
├── data/                  # 数据目录
│   ├── raw/               # 原始数据
│   ├── cleaned/           # 清洗后数据
│   └── factors/           # 因子数据
├── logs/                  # 日志目录
└── reports/               # 报告目录
```

## 代码实现

### 配置管理

```python
"""
config.py - 配置管理
"""
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class PipelineConfig:
    """Pipeline 配置"""

    # 数据采集
    stock_list: list[str] = field(default_factory=lambda: [
        "000001", "000002", "600000", "600036", "601318",
    ])
    start_date: str = "20200101"
    max_calls_per_minute: int = 20
    max_retries: int = 3

    # 数据存储
    data_dir: str = "./data"
    raw_dir: str = "./data/raw"
    cleaned_dir: str = "./data/cleaned"
    factor_dir: str = "./data/factors"

    # 因子计算
    factor_cache_dir: str = "./data/factor_cache"
    force_recompute: bool = False

    # 监控
    log_dir: str = "./logs"
    report_dir: str = "./reports"
    alert_log: str = "./logs/alerts.log"

    # 调度
    daily_run_time: str = "18:00"  # 每日运行时间（收盘后）
    retry_interval: int = 300  # 重试间隔（秒）

    def __post_init__(self):
        """创建必要的目录"""
        for dir_path in [
            self.raw_dir, self.cleaned_dir, self.factor_dir,
            self.log_dir, self.report_dir, self.factor_cache_dir,
        ]:
            Path(dir_path).mkdir(parents=True, exist_ok=True)
```

### 监控模块

```python
"""
monitor.py - 监控与告警
"""
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional


class PipelineMonitor:
    """Pipeline 监控器"""

    def __init__(self, log_dir: str = "./logs", alert_log: str = "./logs/alerts.log"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # 配置日志
        self.logger = logging.getLogger("pipeline")
        self.logger.setLevel(logging.INFO)

        # 文件日志
        log_file = self.log_dir / f"pipeline_{datetime.now():%Y%m%d}.log"
        fh = logging.FileHandler(log_file, encoding="utf-8")
        fh.setLevel(logging.INFO)

        # 控制台日志
        ch = logging.StreamHandler()
        ch.setLevel(logging.INFO)

        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        fh.setFormatter(formatter)
        ch.setFormatter(formatter)

        self.logger.addHandler(fh)
        self.logger.addHandler(ch)

        # 告警日志
        self.alert_log = Path(alert_log)

        # 运行统计
        self.stats: dict = {
            "start_time": None,
            "end_time": None,
            "stages": {},
            "errors": [],
            "warnings": [],
        }

    def start_pipeline(self):
        """记录 Pipeline 开始"""
        self.stats["start_time"] = datetime.now()
        self.logger.info("=" * 60)
        self.logger.info("Pipeline 开始运行")
        self.logger.info("=" * 60)

    def end_pipeline(self, status: str = "SUCCESS"):
        """记录 Pipeline 结束"""
        self.stats["end_time"] = datetime.now()
        duration = (
            self.stats["end_time"] - self.stats["start_time"]
        ).total_seconds()

        self.logger.info("=" * 60)
        self.logger.info(f"Pipeline 运行完成: {status}")
        self.logger.info(f"总耗时: {duration:.1f} 秒")
        self.logger.info("=" * 60)

        if self.stats["errors"]:
            self.logger.warning(f"错误数: {len(self.stats['errors'])}")

    def start_stage(self, stage_name: str):
        """记录阶段开始"""
        self.stats["stages"][stage_name] = {
            "start_time": datetime.now(),
            "status": "RUNNING",
        }
        self.logger.info(f"--- 阶段开始: {stage_name} ---")

    def end_stage(self, stage_name: str, status: str = "SUCCESS", details: str = ""):
        """记录阶段结束"""
        if stage_name in self.stats["stages"]:
            stage = self.stats["stages"][stage_name]
            stage["end_time"] = datetime.now()
            stage["status"] = status
            duration = (stage["end_time"] - stage["start_time"]).total_seconds()

            self.logger.info(
                f"--- 阶段完成: {stage_name} | {status} | {duration:.1f}s ---"
            )
            if details:
                self.logger.info(f"  {details}")

    def log_error(self, message: str, stage: str = ""):
        """记录错误"""
        self.stats["errors"].append({
            "time": datetime.now().isoformat(),
            "stage": stage,
            "message": message,
        })
        self.logger.error(f"[{stage}] {message}")

    def log_warning(self, message: str, stage: str = ""):
        """记录警告"""
        self.stats["warnings"].append({
            "time": datetime.now().isoformat(),
            "stage": stage,
            "message": message,
        })
        self.logger.warning(f"[{stage}] {message}")

    def send_alert(self, message: str, level: str = "WARN"):
        """发送告警"""
        alert_entry = (
            f"[{level}] {datetime.now():%Y-%m-%d %H:%M:%S}\n"
            f"{message}\n---\n"
        )
        with open(self.alert_log, "a", encoding="utf-8") as f:
            f.write(alert_entry)

        self.logger.warning(f"告警已发送: {message[:50]}...")

    def get_summary(self) -> dict:
        """获取运行摘要"""
        return {
            "start_time": str(self.stats["start_time"]),
            "end_time": str(self.stats["end_time"]),
            "stages": {
                name: stage["status"]
                for name, stage in self.stats["stages"].items()
            },
            "errors": len(self.stats["errors"]),
            "warnings": len(self.stats["warnings"]),
        }
```

### 完整 Pipeline 主流程

```python
"""
pipeline.py - Pipeline 主流程
整合采集、清洗、存储、因子计算的完整流程
"""
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Optional
from pathlib import Path
import time
import json
import logging

from config import PipelineConfig
from monitor import PipelineMonitor


class StockDataCollector:
    """数据采集模块"""

    def __init__(self, config: PipelineConfig, monitor: PipelineMonitor):
        self.config = config
        self.monitor = monitor
        self.logger = logging.getLogger("pipeline.collector")

    def collect_stock_list(self) -> list[str]:
        """获取股票列表"""
        self.logger.info(f"使用配置的股票列表: {len(self.config.stock_list)} 只")
        return self.config.stock_list

    def collect_daily_data(
        self,
        symbol: str,
        start_date: str,
        end_date: str,
    ) -> Optional[pd.DataFrame]:
        """
        采集单只股票日线数据

        实际生产中使用 AKShare，这里用模拟数据演示
        """
        try:
            # 模拟数据生成（实际应调用 AKShare）
            dates = pd.bdate_range(
                start=pd.to_datetime(start_date, format="%Y%m%d"),
                end=pd.to_datetime(end_date, format="%Y%m%d"),
            )

            np.random.seed(hash(symbol) % 2**32)
            base_price = np.random.uniform(10, 100)
            returns = np.random.normal(0.0002, 0.02, len(dates))
            prices = base_price * np.cumprod(1 + returns)

            df = pd.DataFrame({
                "symbol": symbol,
                "date": dates,
                "open": prices * (1 + np.random.uniform(-0.01, 0.01, len(dates))),
                "high": prices * (1 + np.random.uniform(0, 0.03, len(dates))),
                "low": prices * (1 - np.random.uniform(0, 0.03, len(dates))),
                "close": prices,
                "volume": np.random.randint(1_000_000, 10_000_000, len(dates)),
                "amount": prices * np.random.randint(1_000_000, 10_000_000, len(dates)),
            })

            self.logger.info(f"采集 {symbol}: {len(df)} 条记录")
            return df

        except Exception as e:
            self.monitor.log_error(f"采集 {symbol} 失败: {e}", stage="collector")
            return None

    def collect_all(
        self, symbols: list[str], start_date: str, end_date: str
    ) -> pd.DataFrame:
        """批量采集所有股票数据"""
        all_data = []

        for i, symbol in enumerate(symbols, 1):
            self.logger.info(f"进度: {i}/{len(symbols)} - {symbol}")
            df = self.collect_daily_data(symbol, start_date, end_date)
            if df is not None:
                all_data.append(df)

            # 限频控制
            if i % self.config.max_calls_per_minute == 0:
                self.logger.info("触发限频，等待 60 秒")
                time.sleep(1)  # 演示用短等待，实际应为 60 秒

        if all_data:
            return pd.concat(all_data, ignore_index=True)
        return pd.DataFrame()


class DataCleaner:
    """数据清洗模块"""

    def __init__(self, config: PipelineConfig, monitor: PipelineMonitor):
        self.config = config
        self.monitor = monitor
        self.logger = logging.getLogger("pipeline.cleaner")

    def clean(self, df: pd.DataFrame) -> pd.DataFrame:
        """执行数据清洗"""
        if df.empty:
            return df

        self.logger.info(f"开始清洗: {len(df)} 行")
        result = df.copy()

        # Step 1: 类型转换
        result["date"] = pd.to_datetime(result["date"])
        numeric_cols = ["open", "high", "low", "close", "volume", "amount"]
        for col in numeric_cols:
            if col in result.columns:
                result[col] = pd.to_numeric(result[col], errors="coerce")

        # Step 2: 去重
        before = len(result)
        result = result.drop_duplicates(subset=["symbol", "date"], keep="last")
        dup_count = before - len(result)
        if dup_count > 0:
            self.logger.info(f"删除重复行: {dup_count}")

        # Step 3: 处理停牌（成交量为 0）
        suspension_mask = result["volume"] == 0
        if suspension_mask.any():
            count = suspension_mask.sum()
            self.logger.info(f"处理停牌日: {count} 条")
            result.loc[suspension_mask, ["open", "high", "low", "close"]] = (
                result.loc[suspension_mask].groupby("symbol")[["open", "high", "low", "close"]].ffill()
            )
            result.loc[suspension_mask, "volume"] = 0
            result.loc[suspension_mask, "amount"] = 0

        # Step 4: 处理缺失值
        price_cols = ["open", "high", "low", "close"]
        for col in price_cols:
            missing = result[col].isna().sum()
            if missing > 0:
                result[col] = result.groupby("symbol")[col].ffill()
                self.logger.info(f"前向填充 {col}: {missing} 个缺失值")

        # Step 5: 校验价格逻辑
        invalid_high_low = result["high"] < result["low"]
        if invalid_high_low.any():
            count = invalid_high_low.sum()
            self.logger.warning(f"修正最高价<最低价: {count} 条")
            result.loc[invalid_high_low, ["high", "low"]] = (
                result.loc[invalid_high_low, ["low", "high"]].values
            )

        # Step 6: 计算收益率
        result = result.sort_values(["symbol", "date"])
        result["pct_change"] = result.groupby("symbol")["close"].pct_change() * 100

        # Step 7: 标记异常值
        result["is_outlier"] = (
            result["pct_change"].abs() > 11
        )  # A 股涨跌停 ±10%

        outlier_count = result["is_outlier"].sum()
        if outlier_count > 0:
            self.logger.warning(f"标记异常涨跌幅: {outlier_count} 条")

        self.logger.info(f"清洗完成: {len(result)} 行")
        return result


class DataStorage:
    """数据存储模块"""

    def __init__(self, config: PipelineConfig, monitor: PipelineMonitor):
        self.config = config
        self.monitor = monitor
        self.logger = logging.getLogger("pipeline.storage")

    def save_raw(self, df: pd.DataFrame, symbol: str):
        """保存原始数据"""
        path = Path(self.config.raw_dir) / f"{symbol}.parquet"
        df.to_parquet(path, index=False)
        self.logger.info(f"保存原始数据: {path}")

    def save_cleaned(self, df: pd.DataFrame, symbol: str):
        """保存清洗后数据"""
        path = Path(self.config.cleaned_dir) / f"{symbol}.parquet"
        df.to_parquet(path, index=False)
        self.logger.info(f"保存清洗数据: {path}")

    def save_factor(self, df: pd.DataFrame, factor_name: str):
        """保存因子数据"""
        path = Path(self.config.factor_dir) / f"{factor_name}.parquet"
        df.to_parquet(path, index=False)
        self.logger.info(f"保存因子数据: {path}")

    def load_cleaned(self, symbol: str) -> Optional[pd.DataFrame]:
        """加载清洗后数据"""
        path = Path(self.config.cleaned_dir) / f"{symbol}.parquet"
        if path.exists():
            return pd.read_parquet(path)
        return None

    def load_factor(self, factor_name: str) -> Optional[pd.DataFrame]:
        """加载因子数据"""
        path = Path(self.config.factor_dir) / f"{factor_name}.parquet"
        if path.exists():
            return pd.read_parquet(path)
        return None

    def save_metadata(self, metadata: dict):
        """保存元数据"""
        path = Path(self.config.data_dir) / "metadata.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)


class FactorCalculator:
    """因子计算模块"""

    def __init__(self, config: PipelineConfig, monitor: PipelineMonitor):
        self.config = config
        self.monitor = monitor
        self.logger = logging.getLogger("pipeline.factor")

    def compute_momentum(self, df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
        """计算动量因子"""
        result = df[["symbol", "date", "close"]].copy()
        result[f"momentum_{window}d"] = result.groupby("symbol")["close"].transform(
            lambda x: x / x.shift(window) - 1
        )
        return result.dropna()

    def compute_volatility(self, df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
        """计算波动率因子"""
        result = df[["symbol", "date", "close"]].copy()
        result["daily_return"] = result.groupby("symbol")["close"].pct_change()
        result[f"volatility_{window}d"] = result.groupby("symbol")[
            "daily_return"
        ].transform(lambda x: x.rolling(window).std())
        return result[["symbol", "date", f"volatility_{window}d"]].dropna()

    def compute_volume_ratio(self, df: pd.DataFrame, window: int = 20) -> pd.DataFrame:
        """计算成交量比率因子"""
        result = df[["symbol", "date", "volume"]].copy()
        result[f"volume_ratio_{window}d"] = result.groupby("symbol")[
            "volume"
        ].transform(lambda x: x / x.rolling(window).mean())
        return result[["symbol", "date", f"volume_ratio_{window}d"]].dropna()

    def compute_all(self, df: pd.DataFrame) -> dict[str, pd.DataFrame]:
        """计算所有因子"""
        factors = {}

        self.logger.info("计算动量因子...")
        factors["momentum_20d"] = self.compute_momentum(df, window=20)

        self.logger.info("计算波动率因子...")
        factors["volatility_20d"] = self.compute_volatility(df, window=20)

        self.logger.info("计算成交量比率因子...")
        factors["volume_ratio_20d"] = self.compute_volume_ratio(df, window=20)

        # 计算复合因子
        self.logger.info("计算复合因子...")
        merged = (
            factors["momentum_20d"]
            .merge(factors["volatility_20d"], on=["symbol", "date"])
            .merge(factors["volume_ratio_20d"], on=["symbol", "date"])
        )

        # 标准化
        for col in ["momentum_20d", "volatility_20d", "volume_ratio_20d"]:
            merged[f"{col}_zscore"] = merged.groupby("date")[col].transform(
                lambda x: (x - x.mean()) / x.std()
            )

        merged["composite"] = (
            merged["momentum_20d_zscore"]
            / merged["volatility_20d_zscore"].abs()
            * merged["volume_ratio_20d_zscore"]
        )

        factors["composite"] = merged[["symbol", "date", "composite"]].dropna()

        for name, data in factors.items():
            self.logger.info(f"因子 {name}: {len(data)} 行")

        return factors


class StockPipeline:
    """金融数据 Pipeline 主类"""

    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()
        self.monitor = PipelineMonitor(
            log_dir=self.config.log_dir,
            alert_log=self.config.alert_log,
        )

        self.collector = StockDataCollector(self.config, self.monitor)
        self.cleaner = DataCleaner(self.config, self.monitor)
        self.storage = DataStorage(self.config, self.monitor)
        self.factor_calc = FactorCalculator(self.config, self.monitor)

    def run(
        self,
        symbols: Optional[list[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        """
        运行完整 Pipeline

        Args:
            symbols: 股票列表（默认使用配置）
            start_date: 开始日期（默认使用配置）
            end_date: 结束日期（默认今天）
        """
        if symbols is None:
            symbols = self.config.stock_list
        if start_date is None:
            start_date = self.config.start_date
        if end_date is None:
            end_date = datetime.now().strftime("%Y%m%d")

        self.monitor.start_pipeline()

        try:
            # Stage 1: 数据采集
            self.monitor.start_stage("数据采集")
            raw_data = self.collector.collect_all(symbols, start_date, end_date)
            if raw_data.empty:
                raise RuntimeError("数据采集失败：无有效数据")
            self.monitor.end_stage(
                "数据采集",
                details=f"共 {len(raw_data)} 行, {raw_data['symbol'].nunique()} 只股票",
            )

            # Stage 2: 数据清洗
            self.monitor.start_stage("数据清洗")
            cleaned_data = self.cleaner.clean(raw_data)
            self.monitor.end_stage(
                "数据清洗",
                details=f"清洗后 {len(cleaned_data)} 行",
            )

            # Stage 3: 数据存储
            self.monitor.start_stage("数据存储")
            for symbol in cleaned_data["symbol"].unique():
                symbol_data = cleaned_data[cleaned_data["symbol"] == symbol]
                self.storage.save_cleaned(symbol_data, symbol)
            self.monitor.end_stage(
                "数据存储",
                details=f"保存 {cleaned_data['symbol'].nunique()} 只股票数据",
            )

            # Stage 4: 因子计算
            self.monitor.start_stage("因子计算")
            factors = self.factor_calc.compute_all(cleaned_data)
            for factor_name, factor_data in factors.items():
                self.storage.save_factor(factor_data, factor_name)
            self.monitor.end_stage(
                "因子计算",
                details=f"计算 {len(factors)} 个因子",
            )

            # Stage 5: 保存元数据
            self.monitor.start_stage("保存元数据")
            metadata = {
                "run_time": datetime.now().isoformat(),
                "symbols": symbols,
                "date_range": f"{start_date} ~ {end_date}",
                "raw_rows": len(raw_data),
                "cleaned_rows": len(cleaned_data),
                "factors": list(factors.keys()),
            }
            self.storage.save_metadata(metadata)
            self.monitor.end_stage("保存元数据")

            self.monitor.end_pipeline("SUCCESS")

        except Exception as e:
            self.monitor.log_error(f"Pipeline 执行失败: {e}", stage="main")
            self.monitor.end_pipeline("FAILED")
            raise

        return self.monitor.get_summary()

    def run_daily(self):
        """每日增量运行"""
        # 获取最新交易日
        end_date = datetime.now().strftime("%Y%m%d")

        # 增量采集最近 5 天数据（覆盖可能的延迟）
        from datetime import timedelta
        start_date = (datetime.now() - timedelta(days=5)).strftime("%Y%m%d")

        self.monitor.logger.info(f"每日增量运行: {start_date} ~ {end_date}")
        return self.run(start_date=start_date, end_date=end_date)


def main():
    """运行完整 Pipeline"""
    # 配置
    config = PipelineConfig(
        stock_list=["000001", "000002", "600000", "600036", "601318"],
        start_date="20230101",
    )

    # 创建并运行 Pipeline
    pipeline = StockPipeline(config)
    summary = pipeline.run(end_date="20231231")

    # 输出结果
    print("\n" + "=" * 60)
    print("Pipeline 运行结果")
    print("=" * 60)
    for key, value in summary.items():
        print(f"  {key}: {value}")

    # 读取因子数据示例
    momentum = pipeline.storage.load_factor("momentum_20d")
    if momentum is not None:
        print(f"\n动量因子示例:")
        print(momentum.head(10).to_string(index=False))


if __name__ == "__main__":
    main()
```

## 运行方式

```bash
# 1. 安装依赖
pip install pandas numpy pyarrow

# 2. 运行 Pipeline
python main.py

# 3. 查看输出
ls data/cleaned/     # 清洗后的数据
ls data/factors/     # 因子数据
ls logs/             # 运行日志
```

## 常见误区

### 误区一：不做异常处理

生产环境中的数据采集随时可能失败（网络中断、API 故障）。Pipeline 必须有完善的异常处理和重试机制，不能因为一只股票的数据问题导致整个流程中断。

### 误区二：不记录运行日志

Pipeline 运行后不记录任何日志，出问题时无法排查。应该记录每个阶段的开始时间、结束时间、数据量、异常信息。

### 误区三：不做数据校验

采集和清洗后不校验数据质量，直接入库。应该在每个阶段后都做数据校验，发现问题及时告警。

### 误区四：硬编码配置

把股票列表、日期范围等硬编码在代码中。应该使用配置文件或环境变量管理，方便切换不同环境。

## 小结

本课整合了前 5 课的知识，构建了完整的金融数据 Pipeline：

1. **模块化架构**：采集、清洗、存储、因子计算、监控各司其职
2. **配置管理**：所有参数集中在配置文件中管理
3. **异常处理**：完善的重试、降级、告警机制
4. **监控日志**：记录每个阶段的运行状态和异常信息
5. **增量运行**：支持每日增量更新，避免全量重算

## 练习

### 练习一：扩展 Pipeline

在本课的 Pipeline 基础上，添加以下功能：
1. 支持从 AKShare 采集真实数据（替换模拟数据）
2. 添加数据质量校验阶段
3. 生成每日运行报告（HTML 格式）

### 练习二：定时调度

使用 schedule 库实现定时调度：
1. 每天 18:00 自动运行 Pipeline
2. 运行失败时自动重试（最多 3 次）
3. 运行结果发送通知

### 练习三：多数据源支持

扩展采集模块，支持多个数据源：
1. AKShare 作为主数据源
2. Tushare 作为备用数据源
3. 当主数据源失败时自动切换到备用数据源

---

## 参考答案

### 练习一

**思路**：用 AKShare 替换模拟数据，添加质量校验阶段，生成 HTML 报告。

**答案**：

```python
import akshare as ak


class RealStockDataCollector(StockDataCollector):
    """真实数据采集器（使用 AKShare）"""

    def collect_daily_data(
        self, symbol: str, start_date: str, end_date: str
    ) -> Optional[pd.DataFrame]:
        try:
            self.monitor.logger.info(f"从 AKShare 采集 {symbol}...")
            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period="daily",
                start_date=start_date,
                end_date=end_date,
                adjust="qfq",
            )

            if df is None or df.empty:
                return None

            # 标准化列名
            column_mapping = {
                "日期": "date", "开盘": "open", "收盘": "close",
                "最高": "high", "最低": "low", "成交量": "volume",
                "成交额": "amount", "涨跌幅": "pct_change",
            }
            df = df.rename(columns=column_mapping)
            df["symbol"] = symbol
            df["date"] = pd.to_datetime(df["date"])

            self.logger.info(f"采集 {symbol}: {len(df)} 条")
            return df

        except Exception as e:
            self.monitor.log_error(f"采集 {symbol} 失败: {e}")
            return None


class DataQualityChecker:
    """数据质量校验"""

    def check(self, df: pd.DataFrame) -> dict:
        report = {
            "total_rows": len(df),
            "symbols": df["symbol"].nunique(),
            "date_range": f"{df['date'].min()} ~ {df['date'].max()}",
            "missing_values": df.isnull().sum().to_dict(),
            "duplicates": df.duplicated(subset=["symbol", "date"]).sum(),
            "outliers": (df["pct_change"].abs() > 11).sum() if "pct_change" in df.columns else 0,
            "status": "PASS",
        }

        if report["duplicates"] > 0 or report["outliers"] > 0:
            report["status"] = "WARN"

        return report


def generate_html_report(summary: dict, quality_report: dict, output_path: str):
    """生成 HTML 报告"""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Pipeline 运行报告</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 20px; }}
            .section {{ margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }}
            .success {{ color: green; }}
            .warning {{ color: orange; }}
            .error {{ color: red; }}
            table {{ border-collapse: collapse; width: 100%; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
            th {{ background-color: #f5f5f5; }}
        </style>
    </head>
    <body>
        <h1>Pipeline 运行报告</h1>
        <div class="section">
            <h2>运行摘要</h2>
            <table>
                <tr><th>项目</th><th>值</th></tr>
                <tr><td>运行时间</td><td>{summary.get('start_time', 'N/A')}</td></tr>
                <tr><td>状态</td><td class="success">{summary.get('status', 'N/A')}</td></tr>
            </table>
        </div>
        <div class="section">
            <h2>数据质量</h2>
            <table>
                <tr><th>指标</th><th>值</th></tr>
                <tr><td>总行数</td><td>{quality_report.get('total_rows', 0)}</td></tr>
                <tr><td>股票数</td><td>{quality_report.get('symbols', 0)}</td></tr>
                <tr><td>重复行</td><td>{quality_report.get('duplicates', 0)}</td></tr>
                <tr><td>异常值</td><td>{quality_report.get('outliers', 0)}</td></tr>
            </table>
        </div>
    </body>
    </html>
    """

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
```

**要点**：
- AKShare 的列名是中文，需要标准化
- 质量校验在清洗阶段之后执行
- HTML 报告便于在浏览器中查看

### 练习二

**思路**：使用 schedule 库实现定时调度，添加重试和通知机制。

**答案**：

```python
import schedule
import time
import smtplib
from email.mime.text import MIMEText


class PipelineScheduler:
    """Pipeline 调度器"""

    def __init__(
        self,
        pipeline: StockPipeline,
        run_time: str = "18:00",
        max_retries: int = 3,
    ):
        self.pipeline = pipeline
        self.run_time = run_time
        self.max_retries = max_retries

    def start(self):
        """启动调度器"""
        schedule.every().day.at(self.run_time).do(self._run_with_retry)

        self.pipeline.monitor.logger.info(
            f"调度器已启动，每天 {self.run_time} 运行"
        )

        while True:
            schedule.run_pending()
            time.sleep(60)

    def _run_with_retry(self):
        """带重试的运行"""
        for attempt in range(1, self.max_retries + 1):
            try:
                self.pipeline.monitor.logger.info(
                    f"第 {attempt} 次尝试运行 Pipeline"
                )
                summary = self.pipeline.run_daily()
                self._send_notification(summary)
                return

            except Exception as e:
                self.pipeline.monitor.log_error(
                    f"第 {attempt} 次运行失败: {e}"
                )
                if attempt < self.max_retries:
                    wait = self.pipeline.config.retry_interval * attempt
                    self.pipeline.monitor.logger.info(f"等待 {wait} 秒后重试")
                    time.sleep(wait)
                else:
                    self.pipeline.monitor.send_alert(
                        f"Pipeline 运行失败（已重试 {self.max_retries} 次）",
                        level="ERROR",
                    )

    def _send_notification(self, summary: dict):
        """发送运行结果通知"""
        status = "成功" if summary.get("status") != "FAILED" else "失败"
        message = f"Pipeline 运行{status}\n"
        for key, value in summary.items():
            message += f"  {key}: {value}\n"

        self.pipeline.monitor.logger.info(f"通知: {message}")
```

**要点**：
- schedule 库实现简单的定时调度
- 重试间隔递增（指数退避）
- 运行结果通过通知发送

### 练习三

**思路**：定义数据源接口，实现多数据源切换。

**答案**：

```python
from abc import ABC, abstractmethod


class DataSourceAdapter(ABC):
    """数据源适配器接口"""

    @abstractmethod
    def fetch_daily(
        self, symbol: str, start_date: str, end_date: str
    ) -> Optional[pd.DataFrame]:
        ...

    @abstractmethod
    def is_available(self) -> bool:
        ...


class AKShareAdapter(DataSourceAdapter):
    """AKShare 数据源"""

    def fetch_daily(
        self, symbol: str, start_date: str, end_date: str
    ) -> Optional[pd.DataFrame]:
        import akshare as ak
        df = ak.stock_zh_a_hist(
            symbol=symbol, period="daily",
            start_date=start_date, end_date=end_date, adjust="qfq",
        )
        if df is not None:
            df = df.rename(columns={
                "日期": "date", "开盘": "open", "收盘": "close",
                "最高": "high", "最低": "low", "成交量": "volume",
            })
            df["symbol"] = symbol
        return df

    def is_available(self) -> bool:
        try:
            import akshare as ak
            ak.stock_zh_a_spot_em()
            return True
        except Exception:
            return False


class TushareAdapter(DataSourceAdapter):
    """Tushare 数据源（备用）"""

    def __init__(self, token: str):
        self.token = token

    def fetch_daily(
        self, symbol: str, start_date: str, end_date: str
    ) -> Optional[pd.DataFrame]:
        import tushare as ts
        pro = ts.pro_api(self.token)
        ts_code = f"{symbol}.SZ" if symbol.startswith("0") else f"{symbol}.SH"
        df = pro.daily(ts_code=ts_code, start_date=start_date, end_date=end_date)
        if df is not None:
            df = df.rename(columns={
                "trade_date": "date", "open": "open", "close": "close",
                "high": "high", "low": "low", "vol": "volume",
            })
            df["symbol"] = symbol
        return df

    def is_available(self) -> bool:
        try:
            import tushare as ts
            pro = ts.pro_api(self.token)
            pro.trade_cal(exchange="SSE", start_date="20240101", end_date="20240101")
            return True
        except Exception:
            return False


class MultiSourceCollector:
    """多数据源采集器"""

    def __init__(self, primary: DataSourceAdapter, fallback: DataSourceAdapter):
        self.primary = primary
        self.fallback = fallback

    def fetch_daily(
        self, symbol: str, start_date: str, end_date: str
    ) -> Optional[pd.DataFrame]:
        # 优先使用主数据源
        if self.primary.is_available():
            try:
                df = self.primary.fetch_daily(symbol, start_date, end_date)
                if df is not None and not df.empty:
                    return df
            except Exception as e:
                logging.warning(f"主数据源失败: {e}")

        # 切换到备用数据源
        logging.info(f"切换到备用数据源采集 {symbol}")
        if self.fallback.is_available():
            return self.fallback.fetch_daily(symbol, start_date, end_date)

        return None
```

**要点**：
- 主数据源失败时自动切换到备用
- `is_available` 方法检查数据源是否可用
- 统一的数据格式方便后续处理
