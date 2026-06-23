# 第六课：模型集成与 Stacking——单个模型不够稳健

## 场景引入

你花了一个月时间精心训练了一个 LightGBM 模型，回测 Sharpe 比率 2.1，你觉得已经很好了。但换了一段市场数据后，Sharpe 掉到了 0.3。你又训练了一个 LSTM 模型，在某些市场环境下表现优异，但在另一些环境下却大幅亏损。

这就是单模型的困境：**没有任何一个模型能在所有市场环境下都表现良好**。正如投资界那句老话——"不要把所有鸡蛋放在一个篮子里"，模型也需要分散化。

模型集成（Ensemble）通过组合多个模型的预测来提高稳健性。本课将带你从 Bagging、Boosting 到 Stacking，构建完整的模型集成框架，并引入 regime-based 动态权重调整，让你的策略在不同市场环境下都能保持稳定。

> **风险提示**：模型集成可以降低单模型风险，但无法消除系统性风险。过度复杂的集成框架可能引入新的过拟合问题。本课内容仅供学习，不构成投资建议。

## 学习目标

完成本课后，你将能够：

1. 理解偏差-方差分解，知道为什么需要集成
2. 区分 Bagging、Boosting、Stacking 的适用场景
3. 实现完整的 Stacking 集成框架
4. 设计 regime-based 动态权重调整机制
5. 建立模型版本管理的最佳实践

## 一、偏差-方差分解——为什么需要集成？

### 1.1 核心概念

```
模型误差 = 偏差² + 方差 + 不可约噪声

偏差 (Bias):
  模型预测的期望值与真实值的差距
  高偏差 → 欠拟合 → 模型太简单

方差 (Variance):
  模型预测值在不同训练集上的波动
  高方差 → 过拟合 → 模型太复杂

不可约噪声 (Irreducible Noise):
  数据本身的随机性，无法通过模型消除

┌─────────────────────────────────────────────────┐
│           模型复杂度 vs 误差                      │
│                                                  │
│  误差 │                                           │
│       │  ╲  偏差²                    ╱  方差       │
│       │   ╲                        ╱              │
│       │    ╲        ╱╲            ╱               │
│       │     ╲      ╱  ╲  总误差  ╱                │
│       │      ╲    ╱    ╲───────╱                 │
│       │       ╲──╱                               │
│       │        最优复杂度                          │
│       └──────────────────────────── 复杂度         │
└─────────────────────────────────────────────────┘

集成学习的核心思想:
  - Bagging: 降低方差（多个高方差模型取平均）
  - Boosting: 降低偏差（逐步修正前序模型的错误）
  - Stacking: 同时降低偏差和方差（用元模型组合基模型）
```

### 1.2 金融场景下的偏差-方差权衡

```python
"""
偏差-方差分解实验——理解为什么单模型在金融场景下不稳定
"""

import numpy as np
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import BaggingRegressor, GradientBoostingRegressor


def generate_financial_data(n_samples: int = 1000, n_features: int = 20, noise: float = 0.3):
    """
    生成模拟金融数据

    特点:
    - 非平稳: 均值和方差随时间变化
    - 噪声大: 信噪比远低于图像/NLP
    - 结构性变化: 存在 regime 切换
    """
    np.random.seed(42)
    X = np.random.randn(n_samples, n_features)

    # 真实信号: 部分特征有预测能力
    true_signal = 0.3 * X[:, 0] + 0.2 * X[:, 1] - 0.15 * X[:, 2] + 0.1 * X[:, 3] * X[:, 4]

    # 加入 regime 切换
    regime = np.sin(np.arange(n_samples) * 2 * np.pi / 252) > 0
    true_signal = true_signal * (1 + 0.5 * regime)

    # 加入噪声
    y = true_signal + noise * np.random.randn(n_samples)
    return X, y, true_signal


def bias_variance_decomposition(X, y, model_class, n_bootstrap: int = 100):
    """
    偏差-方差分解

    通过多次 bootstrap 采样，计算模型的偏差和方差
    """
    n_samples = len(X)
    predictions = np.zeros((n_bootstrap, n_samples))

    for i in range(n_bootstrap):
        # Bootstrap 采样
        indices = np.random.choice(n_samples, size=n_samples, replace=True)
        X_boot, y_boot = X[indices], y[indices]

        # 训练模型
        model = model_class()
        model.fit(X_boot, y_boot)
        predictions[i] = model.predict(X)

    # 计算偏差和方差
    mean_pred = np.mean(predictions, axis=0)
    bias_sq = np.mean((mean_pred - y) ** 2)
    variance = np.mean(np.var(predictions, axis=0))

    return {
        "bias_squared": round(bias_sq, 4),
        "variance": round(variance, 4),
        "total_error": round(bias_sq + variance, 4),
    }


def compare_models():
    """对比不同模型的偏差-方差特性"""
    X, y, true_signal = generate_financial_data()

    models = {
        "浅层决策树 (高偏差低方差)": lambda: DecisionTreeRegressor(max_depth=3),
        "深层决策树 (低偏差高方差)": lambda: DecisionTreeRegressor(max_depth=20),
        "Bagging (降低方差)": lambda: BaggingRegressor(n_estimators=50, random_state=42),
        "Boosting (降低偏差)": lambda: GradientBoostingRegressor(n_estimators=50, max_depth=3),
    }

    print("=" * 60)
    print("偏差-方差分解对比")
    print("=" * 60)

    for name, model_fn in models.items():
        result = bias_variance_decomposition(X, y, model_fn)
        print(f"\n{name}:")
        print(f"  偏差²: {result['bias_squared']}")
        print(f"  方差: {result['variance']}")
        print(f"  总误差: {result['total_error']}")


if __name__ == "__main__":
    compare_models()
```

## 二、Bagging、Boosting 与 Stacking

### 2.1 三种集成方法对比

```
Bagging (Bootstrap Aggregating):
  ┌──────────────────────────────────────┐
  │  训练集 1 → 模型 1 → 预测 1         │
  │  训练集 2 → 模型 2 → 预测 2         │
  │  训练集 3 → 模型 3 → 预测 3         │
  │           ...                        │
  │  最终预测 = 平均(预测1, 预测2, ...)  │
  └──────────────────────────────────────┘
  核心: 平均降低方差，适合高方差模型
  代表: Random Forest

Boosting:
  ┌──────────────────────────────────────┐
  │  模型 1 → 残差 1 → 模型 2 → 残差 2  │
  │  → 模型 3 → ... → 最终预测           │
  │                                      │
  │  每个模型修正前序模型的错误            │
  └──────────────────────────────────────┘
  核心: 逐步降低偏差，适合高偏差模型
  代表: XGBoost, LightGBM, CatBoost

Stacking:
  ┌──────────────────────────────────────┐
  │  Layer 0 (基模型):                    │
  │    LightGBM → 预测 A                 │
  │    LSTM → 预测 B                      │
  │    Random Forest → 预测 C             │
  │                                      │
  │  Layer 1 (元模型):                    │
  │    输入: [预测A, 预测B, 预测C]        │
  │    Ridge → 最终预测                   │
  └──────────────────────────────────────┘
  核心: 学习如何组合不同模型的预测
  优势: 可以融合异构模型（树模型 + 神经网络）
```

### 2.2 完整 Stacking 集成框架

```python
"""
Stacking 集成框架——完整的训练与预测流程
支持异构模型组合、交叉验证生成元特征、动态权重调整
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from sklearn.linear_model import Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
from typing import Callable
import warnings
warnings.filterwarnings("ignore")


class StackingEnsemble:
    """
    Stacking 集成框架

    架构:
    Layer 0: 多个基模型（可以是不同类型）
    Layer 1: 元模型（学习如何组合基模型的预测）

    关键设计:
    1. 使用时间序列交叉验证生成元特征，避免信息泄露
    2. 元模型选择简单模型（Ridge），防止过度拟合
    3. 支持动态权重调整（基于近期表现）
    """

    def __init__(
        self,
        base_models: dict,
        meta_model=None,
        n_splits: int = 5,
        use_original_features: bool = False,
    ):
        """
        参数:
            base_models: {"model_name": model_instance} 基模型字典
            meta_model: 元模型，默认使用 Ridge
            n_splits: 交叉验证折数
            use_original_features: 是否将原始特征也传入元模型
        """
        self.base_models = base_models
        self.meta_model = meta_model or Ridge(alpha=1.0)
        self.n_splits = n_splits
        self.use_original_features = use_original_features
        self.fitted_base_models = {}
        self.meta_feature_names = list(base_models.keys())
        self.is_fitted = False

    def _generate_meta_features(self, X: np.ndarray, y: np.ndarray) -> np.ndarray:
        """
        使用时间序列交叉验证生成元特征

        关键: 每个样本的元特征只由不包含该样本的模型预测生成
        → 避免信息泄露
        """
        n_samples = len(X)
        n_models = len(self.base_models)
        meta_features = np.zeros((n_samples, n_models))

        tscv = TimeSeriesSplit(n_splits=self.n_splits)

        for fold_idx, (train_idx, val_idx) in enumerate(tscv.split(X)):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train = y[train_idx]

            for model_idx, (name, model) in enumerate(self.base_models.items()):
                # 克隆模型（避免修改原始模型）
                from sklearn.base import clone
                fold_model = clone(model)
                fold_model.fit(X_train, y_train)
                meta_features[val_idx, model_idx] = fold_model.predict(X_val)

        return meta_features

    def fit(self, X: np.ndarray, y: np.ndarray):
        """
        训练 Stacking 集成

        步骤:
        1. 生成元特征（通过交叉验证）
        2. 训练元模型
        3. 在全量数据上重新训练所有基模型
        """
        # Step 1: 生成元特征
        meta_features = self._generate_meta_features(X, y)

        # Step 2: 训练元模型
        if self.use_original_features:
            meta_input = np.hstack([meta_features, X])
        else:
            meta_input = meta_features

        self.meta_model.fit(meta_input, y)

        # Step 3: 在全量数据上重新训练基模型
        self.fitted_base_models = {}
        for name, model in self.base_models.items():
            from sklearn.base import clone
            fitted = clone(model)
            fitted.fit(X, y)
            self.fitted_base_models[name] = fitted

        self.is_fitted = True

        # 输出元特征的预测质量
        meta_pred = self.meta_model.predict(meta_input)
        meta_rmse = np.sqrt(mean_squared_error(y, meta_pred))
        print(f"Stacking 训练完成，元模型 RMSE: {meta_rmse:.4f}")

        # 输出各基模型在交叉验证中的表现
        for i, name in enumerate(self.base_models.keys()):
            model_rmse = np.sqrt(mean_squared_error(y, meta_features[:, i]))
            print(f"  基模型 {name} CV RMSE: {model_rmse:.4f}")

        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        """使用 Stacking 集成进行预测"""
        if not self.is_fitted:
            raise RuntimeError("模型尚未训练，请先调用 fit()")

        # 获取各基模型的预测
        meta_features = np.zeros((len(X), len(self.fitted_base_models)))
        for i, (name, model) in enumerate(self.fitted_base_models.items()):
            meta_features[:, i] = model.predict(X)

        # 元模型组合
        if self.use_original_features:
            meta_input = np.hstack([meta_features, X])
        else:
            meta_input = meta_features

        return self.meta_model.predict(meta_input)

    def get_model_weights(self) -> dict:
        """获取元模型学到的各基模型权重"""
        if hasattr(self.meta_model, "coef_"):
            coefs = self.meta_model.coef_[:len(self.base_models)]
            return dict(zip(self.base_models.keys(), coefs.round(4)))
        return {}


class RegimeBasedEnsemble:
    """
    基于市场状态的动态集成

    核心思想: 不同市场环境下，不同模型的表现差异很大
    → 识别当前市场状态，动态调整模型权重

    市场状态划分:
    - 趋势上涨 (uptrend)
    - 趋势下跌 (downtrend)
    - 高波动震荡 (high_vol)
    - 低波动横盘 (low_vol)
    """

    def __init__(self, models: dict, lookback_window: int = 60):
        self.models = models
        self.lookback_window = lookback_window
        self.regime_weights = {}
        self.performance_history = {name: [] for name in models}

    def detect_regime(self, returns: np.ndarray) -> str:
        """
        检测当前市场状态

        使用简单的规则:
        - 均值 > 0 且 趋势明显 → uptrend
        - 均值 < 0 且 趋势明显 → downtrend
        - 波动率高 → high_vol
        - 其他 → low_vol
        """
        if len(returns) < self.lookback_window:
            return "low_vol"

        recent = returns[-self.lookback_window:]
        mean_return = np.mean(recent)
        volatility = np.std(recent)
        trend_strength = abs(mean_return) / (volatility + 1e-10)

        # 计算滚动均值的趋势
        ma_short = np.mean(recent[-20:])
        ma_long = np.mean(recent[-60:]) if len(recent) >= 60 else mean_return

        if trend_strength > 0.5 and ma_short > ma_long:
            return "uptrend"
        elif trend_strength > 0.5 and ma_short < ma_long:
            return "downtrend"
        elif volatility > np.std(returns) * 1.5:
            return "high_vol"
        else:
            return "low_vol"

    def update_performance(self, model_name: str, actual_return: float, predicted_return: float):
        """更新模型在当前 regime 下的表现"""
        error = abs(actual_return - predicted_return)
        self.performance_history[model_name].append(error)

    def get_dynamic_weights(self, returns: np.ndarray) -> dict:
        """
        根据当前市场状态计算动态权重

        权重计算: 使用近期表现的倒数
        → 表现越好（误差越小），权重越高
        """
        regime = self.detect_regime(returns)
        weights = {}

        for name in self.models:
            history = self.performance_history[name]
            if len(history) < 10:
                weights[name] = 1.0 / len(self.models)
            else:
                recent_errors = history[-self.lookback_window:]
                avg_error = np.mean(recent_errors)
                # 误差越小，权重越大
                weights[name] = 1.0 / (avg_error + 1e-10)

        # 归一化
        total = sum(weights.values())
        weights = {k: v / total for k, v in weights.items()}

        self.regime_weights[regime] = weights
        return weights


def build_trading_stacking():
    """构建量化交易的 Stacking 集成"""
    np.random.seed(42)
    n_samples = 1000
    n_features = 15
    X = np.random.randn(n_samples, n_features)
    y = 0.3 * X[:, 0] + 0.2 * X[:, 1] - 0.1 * X[:, 2] + 0.05 * np.random.randn(n_samples)

    # 划分训练集和测试集
    split = int(n_samples * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    # 定义基模型
    base_models = {
        "ridge": Ridge(alpha=1.0),
        "rf": RandomForestRegressor(n_estimators=50, max_depth=5, random_state=42),
        "rf_deep": RandomForestRegressor(n_estimators=50, max_depth=15, random_state=42),
    }

    # 训练 Stacking
    ensemble = StackingEnsemble(base_models, n_splits=5)
    ensemble.fit(X_train, y_train)

    # 预测
    predictions = ensemble.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    print(f"\n测试集 RMSE: {rmse:.4f}")
    print(f"模型权重: {ensemble.get_model_weights()}")

    # 对比单模型
    print("\n单模型对比:")
    for name, model in base_models.items():
        from sklearn.base import clone
        m = clone(model)
        m.fit(X_train, y_train)
        pred = m.predict(X_test)
        single_rmse = np.sqrt(mean_squared_error(y_test, pred))
        print(f"  {name}: RMSE = {single_rmse:.4f}")


if __name__ == "__main__":
    build_trading_stacking()
```

## 三、模型版本管理

### 3.1 为什么需要模型版本管理？

```
模型版本管理的必要性:

场景 1: 策略突然失效
  → 需要回溯到上一个有效版本
  → 没有版本管理 = 无法回溯

场景 2: 多人协作
  → 团队成员各自训练模型
  → 没有版本管理 = 混乱

场景 3: 合规审计
  → 监管要求说明策略逻辑
  → 没有版本管理 = 无法解释

模型版本管理要素:
  1. 模型文件: 序列化的模型权重
  2. 训练配置: 超参数、特征列表、数据范围
  3. 评估指标: 训练集/验证集/测试集的各项指标
  4. 数据快照: 训练数据的哈希值（确保可复现）
  5. 元数据: 训练时间、作者、用途说明
```

### 3.2 模型版本管理实现

```python
"""
模型版本管理——轻量级实现
"""

import json
import hashlib
import pickle
import os
from datetime import datetime
from typing import Any


class ModelVersionManager:
    """模型版本管理器"""

    def __init__(self, model_dir: str = "./model_versions"):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)

    def save_model(
        self,
        model: Any,
        model_name: str,
        version: str,
        config: dict,
        metrics: dict,
        data_hash: str = "",
        description: str = "",
    ) -> str:
        """
        保存模型版本

        参数:
            model: 训练好的模型对象
            model_name: 模型名称
            version: 版本号
            config: 训练配置（超参数等）
            metrics: 评估指标
            data_hash: 训练数据的哈希值
            description: 版本描述
        """
        version_dir = os.path.join(self.model_dir, model_name, version)
        os.makedirs(version_dir, exist_ok=True)

        # 保存模型文件
        model_path = os.path.join(version_dir, "model.pkl")
        with open(model_path, "wb") as f:
            pickle.dump(model, f)

        # 保存元数据
        metadata = {
            "model_name": model_name,
            "version": version,
            "timestamp": datetime.now().isoformat(),
            "config": config,
            "metrics": metrics,
            "data_hash": data_hash,
            "description": description,
            "model_file": model_path,
        }
        metadata_path = os.path.join(version_dir, "metadata.json")
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        return version_dir

    def load_model(self, model_name: str, version: str) -> tuple:
        """加载指定版本的模型"""
        version_dir = os.path.join(self.model_dir, model_name, version)

        metadata_path = os.path.join(version_dir, "metadata.json")
        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        model_path = os.path.join(version_dir, "model.pkl")
        with open(model_path, "rb") as f:
            model = pickle.load(f)

        return model, metadata

    def list_versions(self, model_name: str) -> list:
        """列出模型的所有版本"""
        model_dir = os.path.join(self.model_dir, model_name)
        if not os.path.exists(model_dir):
            return []

        versions = []
        for version in sorted(os.listdir(model_dir)):
            metadata_path = os.path.join(model_dir, version, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path, "r", encoding="utf-8") as f:
                    metadata = json.load(f)
                versions.append(metadata)

        return versions

    def get_best_version(self, model_name: str, metric: str = "sharpe_ratio") -> dict:
        """获取指定指标最优的版本"""
        versions = self.list_versions(model_name)
        if not versions:
            return {}

        best = max(versions, key=lambda v: v["metrics"].get(metric, float("-inf")))
        return best

    @staticmethod
    def compute_data_hash(data: np.ndarray) -> str:
        """计算数据的哈希值，用于确保可复现性"""
        return hashlib.md5(data.tobytes()).hexdigest()[:16]


def example_model_versioning():
    """模型版本管理示例"""
    manager = ModelVersionManager("./model_versions")

    # 模拟保存不同版本
    from sklearn.linear_model import Ridge

    np.random.seed(42)
    X_train = np.random.randn(100, 10)
    y_train = X_train[:, 0] * 0.3 + np.random.randn(100) * 0.1

    # 版本 1: alpha=1.0
    model_v1 = Ridge(alpha=1.0)
    model_v1.fit(X_train, y_train)
    manager.save_model(
        model=model_v1,
        model_name="ridge_predictor",
        version="v1.0",
        config={"alpha": 1.0, "features": ["f1", "f2", "f3"]},
        metrics={"rmse": 0.12, "sharpe_ratio": 1.5, "max_drawdown": 0.08},
        data_hash=ModelVersionManager.compute_data_hash(X_train),
        description="初始版本，使用 Ridge 回归",
    )

    # 版本 2: alpha=0.1
    model_v2 = Ridge(alpha=0.1)
    model_v2.fit(X_train, y_train)
    manager.save_model(
        model=model_v2,
        model_name="ridge_predictor",
        version="v2.0",
        config={"alpha": 0.1, "features": ["f1", "f2", "f3", "f4"]},
        metrics={"rmse": 0.10, "sharpe_ratio": 1.8, "max_drawdown": 0.12},
        data_hash=ModelVersionManager.compute_data_hash(X_train),
        description="降低正则化强度，增加特征",
    )

    # 获取最优版本
    best = manager.get_best_version("ridge_predictor", metric="sharpe_ratio")
    print(f"最优版本: {best['version']}")
    print(f"  Sharpe: {best['metrics']['sharpe_ratio']}")
    print(f"  描述: {best['description']}")

    # 列出所有版本
    versions = manager.list_versions("ridge_predictor")
    print(f"\n所有版本:")
    for v in versions:
        print(f"  {v['version']}: Sharpe={v['metrics']['sharpe_ratio']}, "
              f"RMSE={v['metrics']['rmse']}")


if __name__ == "__main__":
    example_model_versioning()
```

## 四、常见误区

### 误区一：基模型越多越好

基模型数量增加到一定程度后，集成效果的提升会趋于平缓，但计算成本和过拟合风险会持续增加。通常 3-5 个差异化的基模型就够了。

### 误区二：基模型应该同质化

Stacking 的核心优势在于组合异构模型。如果所有基模型都是 Random Forest 的变体，集成效果有限。应该组合不同类型的模型：线性模型 + 树模型 + 神经网络。

### 误区三：元模型用复杂模型

元模型应该尽可能简单（Ridge、Lasso），因为元模型的训练数据是基模型的预测，样本量小、维度低。用复杂模型容易过拟合。

### 误区四：忽略模型相关性

```
模型相关性对集成效果的影响:

高相关模型集成:          低相关模型集成:
  模型A 预测: ↑            模型A 预测: ↑
  模型B 预测: ↑            模型B 预测: ↓
  模型C 预测: ↑            模型C 预测: ↑
  集成结果: ↑              集成结果: ↑ (更稳健)

  → 错误也相似              → 错误互相抵消
  → 集成效果有限            → 集成效果显著

选择基模型的原则:
  1. 类型不同: 线性 + 树 + 神经网络
  2. 特征不同: 价格特征 + 文本特征 + 另类数据
  3. 时间尺度不同: 日频 + 周频 + 月频
```

## 小结与练习

### 本课要点

1. 偏差-方差分解揭示了模型误差的来源，集成学习通过组合降低总误差
2. Bagging 降方差、Boosting 降偏差、Stacking 同时降低两者
3. Stacking 使用交叉验证生成元特征，避免信息泄露
4. Regime-based 动态权重让集成在不同市场环境下自适应
5. 模型版本管理是生产环境的必备基础设施

### 练习一：实现加权平均 Stacking

修改 StackingEnsemble，支持使用加权平均作为元模型（不训练 Ridge，直接用各基模型在验证集上的表现计算权重）。

### 练习二：实现 Regime 检测器

基于滚动均值、波动率、成交量等指标，实现一个更精细的市场状态检测器，支持至少 4 种市场状态。

---

## 参考答案

### 练习一

**思路**：用各基模型在交叉验证中的表现（如 RMSE 的倒数）作为权重，替代 Ridge 元模型。

**答案**：

```python
class WeightedAverageEnsemble(StackingEnsemble):
    """加权平均 Stacking——用表现计算权重"""

    def fit(self, X: np.ndarray, y: np.ndarray):
        meta_features = self._generate_meta_features(X, y)

        # 用各基模型在验证集上的 RMSE 倒数作为权重
        weights = []
        for i in range(meta_features.shape[1]):
            rmse = np.sqrt(mean_squared_error(y, meta_features[:, i]))
            weights.append(1.0 / (rmse + 1e-10))

        total = sum(weights)
        self.model_weights = {name: w / total for name, w in zip(self.base_models.keys(), weights)}

        # 全量训练基模型
        self.fitted_base_models = {}
        for name, model in self.base_models.items():
            from sklearn.base import clone
            fitted = clone(model)
            fitted.fit(X, y)
            self.fitted_base_models[name] = fitted

        self.is_fitted = True
        print(f"加权平均权重: {self.model_weights}")
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("模型尚未训练")

        predictions = np.zeros(len(X))
        for name, model in self.fitted_base_models.items():
            predictions += self.model_weights[name] * model.predict(X)
        return predictions
```

**要点**：
- 加权平均不需要训练元模型，更简单
- 权重基于验证集表现，天然防止过拟合
- 适合基模型数量较少的场景

### 练习二

**思路**：结合多个技术指标（均线、波动率、成交量变化率）构建更精细的 regime 检测器。

**答案**：

```python
class AdvancedRegimeDetector:
    """多指标市场状态检测器"""

    def __init__(self, lookback: int = 60):
        self.lookback = lookback

    def detect(self, returns: np.ndarray, volumes: np.ndarray = None) -> str:
        if len(returns) < self.lookback:
            return "unknown"

        recent = returns[-self.lookback:]

        # 指标 1: 趋势方向与强度
        ma20 = np.mean(recent[-20:])
        ma60 = np.mean(recent)
        trend = ma20 - ma60

        # 指标 2: 波动率
        vol = np.std(recent)
        vol_percentile = vol / (np.std(returns) + 1e-10)

        # 指标 3: 成交量变化（如果提供）
        vol_trend = 0
        if volumes is not None and len(volumes) >= self.lookback:
            vol_recent = volumes[-self.lookback:]
            vol_trend = np.mean(vol_recent[-20:]) / (np.mean(vol_recent) + 1e-10) - 1

        # 指标 4: 偏度（尾部风险）
        skewness = float(pd.Series(recent).skew())

        # 综合判断
        if trend > 0.001 and vol_percentile < 1.2:
            return "uptrend_low_vol"
        elif trend > 0.001 and vol_percentile >= 1.2:
            return "uptrend_high_vol"
        elif trend < -0.001 and vol_percentile < 1.2:
            return "downtrend_low_vol"
        elif trend < -0.001 and vol_percentile >= 1.2:
            return "downtrend_high_vol"
        elif vol_percentile > 1.5:
            return "crisis"
        else:
            return "sideways"
```

**要点**：
- 融合多个维度的指标（趋势、波动、成交量、尾部风险）
- 输出更细粒度的状态标签（6 种 vs 4 种）
- 可以与 RegimeBasedEnsemble 结合使用
