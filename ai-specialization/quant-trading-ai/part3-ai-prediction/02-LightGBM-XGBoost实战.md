# 第2课 LightGBM/XGBoost实战

## 场景引入

在多因子选股策略中，我们用线性方法（IC加权）来组合因子。但现实中，因子与收益率之间的关系往往是**非线性**的：低PE可能是好的，但低到离谱的PE（比如2倍）可能意味着隐藏的风险。动量因子在牛市和熊市中的效果也完全不同。

树模型（Tree-based Models）天然擅长捕捉这种非线性关系和交互效应。在量化投资领域，LightGBM和XGBoost是最常用的机器学习模型，它们在各类量化竞赛和实际生产中都有出色表现。

**风险提示：机器学习模型在金融领域的应用存在过拟合风险。本课代码仅作教学用途，不构成投资建议。**

## 学习目标

通过本课学习，你将能够：

1. 理解梯度提升树的原理及其在金融中的优势
2. 掌握XGBoost与LightGBM的核心差异和选型依据
3. 构建面向量化投资的特征工程流水线
4. 使用时间序列交叉验证避免前视偏差
5. 进行超参数调优和特征重要性分析
6. 使用SHAP解释模型预测

## 1. 为什么树模型适合金融预测

### 1.1 金融数据的特殊性

```
金融数据的特征
┌─────────────────────────────────────────────────────┐
│ 1. 信噪比极低                                        │
│    噪音 ████████████████████████████████ 95%+        │
│    信号 ████ <5%                                     │
│                                                     │
│ 2. 非线性关系                                        │
│    因子A ────┐                                       │
│              ├────▶ 收益率（非线性组合）               │
│    因子B ────┘                                       │
│                                                     │
│ 3. 交互效应                                          │
│    PE低 + ROE高 → 好股票                              │
│    PE低 + ROE低 → 可能是价值陷阱                       │
│                                                     │
│ 4. 时变性                                            │
│    2023年有效因子 ≠ 2025年有效因子                     │
│                                                     │
│ 5. 截面异质性                                        │
│    大盘股规律 ≠ 小盘股规律                             │
└─────────────────────────────────────────────────────┘
```

### 1.2 树模型 vs 线性模型

```
模型对比

线性模型：
  y = w1*x1 + w2*x2 + w3*x3
  ├── 优点：简单、可解释、不容易过拟合
  └── 缺点：无法捕捉非线性和交互效应

决策树：
  if x1 > 0.5:
      if x2 > 0.3:
          return 0.08  # 高收益
      else:
          return 0.02
  else:
      return -0.01
  ├── 优点：自动捕捉非线性和交互
  └── 缺点：单棵树容易过拟合

梯度提升树（GBDT）：
  预测 = 树1 + 树2 + ... + 树N
  ├── 优点：集成多棵树，泛化能力强
  ├── 自动处理非线性、交互、缺失值
  └── 缺点：训练较慢、需要调参
```

## 2. 梯度提升理论基础

### 2.1 核心思想

```
梯度提升（Gradient Boosting）核心思想

第1步：用一个简单模型预测（如均值）
  预测值 ŷ₁ = 0.001
  残差 r₁ = y - ŷ₁

第2步：用一棵新树拟合残差
  树2预测残差 r̂₁ = 0.003
  新预测 ŷ₂ = ŷ₁ + η * r̂₁ = 0.001 + 0.1 * 0.003

第3步：继续拟合新的残差
  树3预测残差 r̂₂
  新预测 ŷ₃ = ŷ₂ + η * r̂₂

...重复N轮...

最终预测 = Σ η * 树_i

其中 η 是学习率（learning rate），控制每棵树的贡献
```

### 2.2 XGBoost vs LightGBM

```
XGBoost vs LightGBM 核心差异

┌──────────────┬────────────────────┬────────────────────┐
│ 特性          │ XGBoost            │ LightGBM           │
├──────────────┼────────────────────┼────────────────────┤
│ 树生长策略    │ Level-wise         │ Leaf-wise          │
│              │ （逐层生长）        │ （逐叶生长）        │
├──────────────┼────────────────────┼────────────────────┤
│ 直方图优化    │ 近似算法           │ GOSS + EFB         │
│              │                    │ 更快更省内存        │
├──────────────┼────────────────────┼────────────────────┤
│ 分类特征处理  │ 需要One-Hot编码    │ 原生支持类别特征    │
├──────────────┼────────────────────┼────────────────────┤
│ 训练速度      │ 较快               │ 更快（2-10倍）     │
├──────────────┼────────────────────┼────────────────────┤
│ 内存占用      │ 较大               │ 更小               │
├──────────────┼────────────────────┼────────────────────┤
│ 过拟合风险    │ 较低（逐层正则）    │ 较高（需控制叶数）  │
└──────────────┴────────────────────┴────────────────────┘

Leaf-wise生长策略示意：

Level-wise（XGBoost）：
        □            每层所有节点都分裂
       / \           深度受限时可能浪费
      □   □          在低增益节点上
     /\   /\
    □  □ □  □

Leaf-wise（LightGBM）：
        □            每次选择增益最大的叶节点分裂
       / \           效率更高，但需要限制最大叶数
      □   □          防止过拟合
         / \
        □   □
```

## 3. 特征工程

### 3.1 特征分类

```
量化投资特征工程
├── 价格特征
│   ├── 收益率（1/5/10/20/60日）
│   ├── 价格相对位置（相对20/60/120日均线）
│   ├── 价格波动率（5/20/60日标准差）
│   └── 价格偏度/峰度
├── 成交量特征
│   ├── 量比（当日成交量/过去均量）
│   ├── 量价背离
│   └── 换手率统计
├── 技术指标
│   ├── RSI / MACD / KDJ
│   ├── 布林带位置
│   └── ATR / ADX
├── 截面特征
│   ├── 行业内排名
│   ├── 全市场分位数
│   └── 同类股票相对强弱
├── 基本面特征
│   ├── 估值指标（EP/BP/SP）
│   ├── 质量指标（ROE/ROA/毛利率）
│   └── 成长指标（营收增速/利润增速）
└── 交互特征
    ├── 因子A × 因子B
    ├── 因子A / 因子B
    └── 因子A的行业内标准化
```

### 3.2 特征构建代码

```python
"""
LightGBM/XGBoost量化选股实战

依赖：
    pip install pandas numpy lightgbm xgboost scikit-learn shap matplotlib
"""

import pandas as pd
import numpy as np
from typing import Optional
import warnings

warnings.filterwarnings("ignore")


# ============================================================
# 第一部分：特征工程
# ============================================================

class QuantFeatureBuilder:
    """量化特征构建器"""
    
    def build_all_features(
        self, data: dict[str, pd.DataFrame]
    ) -> pd.DataFrame:
        """
        构建全部特征
        
        参数:
            data: 包含returns, volume, turnover, pe, pb, roe等的字典
        
        返回:
            MultiIndex DataFrame（日期, 股票代码）-> 特征值
        """
        returns = data["returns"]
        volume = data.get("volume", None)
        turnover = data.get("turnover", None)
        
        features = {}
        
        features.update(self._price_features(returns))
        
        if volume is not None:
            features.update(self._volume_features(volume, returns))
        
        if turnover is not None:
            features.update(self._turnover_features(turnover))
        
        features.update(self._cross_sectional_features(returns))
        
        if "pe" in data:
            features["ep"] = 1.0 / data["pe"].replace(0, np.nan)
            features["bp"] = 1.0 / data["pb"].replace(0, np.nan)
        if "roe" in data:
            features["roe"] = data["roe"]
        
        feature_df = pd.concat(features.values(), keys=features.keys(), axis=1)
        
        return feature_df
    
    def _price_features(self, returns: pd.DataFrame) -> dict[str, pd.DataFrame]:
        """价格类特征"""
        features = {}
        
        for period in [1, 5, 10, 20, 60]:
            features[f"ret_{period}d"] = returns.rolling(period).apply(
                lambda x: (1 + x).prod() - 1, raw=True
            )
        
        for window in [5, 20, 60]:
            features[f"vol_{window}d"] = returns.rolling(window).std() * np.sqrt(252)
        
        for window in [20, 60]:
            roll_max = returns.rolling(window).max()
            roll_min = returns.rolling(window).min()
            features[f"price_pos_{window}d"] = (returns - roll_min) / (
                roll_max - roll_min
            ).replace(0, np.nan)
        
        features["skew_20d"] = returns.rolling(20).skew()
        features["kurt_20d"] = returns.rolling(20).kurt()
        
        return features
    
    def _volume_features(
        self, volume: pd.DataFrame, returns: pd.DataFrame
    ) -> dict[str, pd.DataFrame]:
        """成交量特征"""
        features = {}
        
        features["volume_ratio_5d"] = volume / volume.rolling(5).mean()
        features["volume_ratio_20d"] = volume / volume.rolling(20).mean()
        features["volume_std_20d"] = volume.rolling(20).std() / volume.rolling(
            20
        ).mean()
        
        def rolling_corr(x, y, window=20):
            result = pd.DataFrame(index=x.index, columns=x.columns)
            for col in x.columns:
                result[col] = x[col].rolling(window).corr(y[col])
            return result
        
        features["price_volume_corr"] = rolling_corr(returns, volume, 20)
        
        return features
    
    def _turnover_features(
        self, turnover: pd.DataFrame
    ) -> dict[str, pd.DataFrame]:
        """换手率特征"""
        features = {}
        
        features["turnover_avg_5d"] = turnover.rolling(5).mean()
        features["turnover_avg_20d"] = turnover.rolling(20).mean()
        features["turnover_std_20d"] = turnover.rolling(20).std()
        features["turnover_ratio"] = turnover / turnover.rolling(20).mean()
        
        return features
    
    def _cross_sectional_features(
        self, returns: pd.DataFrame
    ) -> dict[str, pd.DataFrame]:
        """截面特征"""
        features = {}
        
        for window in [5, 20, 60]:
            cumulative = returns.rolling(window).apply(
                lambda x: (1 + x).prod() - 1, raw=True
            )
            features[f"cs_rank_{window}d"] = cumulative.rank(axis=1, pct=True)
            features[f"cs_zscore_{window}d"] = (
                cumulative.sub(cumulative.mean(axis=1), axis=0)
            ).div(cumulative.std(axis=1), axis=0)
        
        return features
    
    def create_target(
        self,
        returns: pd.DataFrame,
        forward_days: int = 5,
        method: str = "return",
    ) -> pd.DataFrame:
        """
        创建预测目标
        
        参数:
            returns: 日收益率
            forward_days: 未来N天
            method: 'return'（收益率）或 'rank'（排名）
        """
        if method == "return":
            target = returns.rolling(forward_days).apply(
                lambda x: (1 + x).prod() - 1, raw=True
            ).shift(-forward_days)
        else:
            fwd_ret = returns.rolling(forward_days).apply(
                lambda x: (1 + x).prod() - 1, raw=True
            ).shift(-forward_days)
            target = fwd_ret.rank(axis=1, pct=True)
        
        return target


# ============================================================
# 第二部分：时间序列交叉验证
# ============================================================

class TimeSeriesCV:
    """
    时间序列交叉验证
    
    扩展窗口（Expanding Window）方式
    """
    
    def __init__(
        self,
        n_splits: int = 5,
        train_size: int = 504,
        test_size: int = 63,
        gap: int = 5,
    ):
        self.n_splits = n_splits
        self.train_size = train_size
        self.test_size = test_size
        self.gap = gap
    
    def split(self, dates: pd.DatetimeIndex):
        """
        生成训练/测试索引
        
        训练集和测试集之间有gap天的间隔，避免信息泄露
        """
        n = len(dates)
        
        for i in range(self.n_splits):
            test_end = n - i * self.test_size
            test_start = test_end - self.test_size
            train_end = test_start - self.gap
            train_start = max(0, train_end - self.train_size)
            
            if train_start < 0 or train_end <= train_start:
                continue
            
            train_idx = list(range(train_start, train_end))
            test_idx = list(range(test_start, test_end))
            
            yield train_idx, test_idx
    
    def get_n_splits(self):
        return self.n_splits


# ============================================================
# 第三部分：模型训练
# ============================================================

class TreeModelTrainer:
    """树模型训练器"""
    
    def __init__(
        self,
        model_type: str = "lightgbm",
        params: Optional[dict] = None,
    ):
        self.model_type = model_type
        self.params = params or self._default_params()
        self.model = None
    
    def _default_params(self) -> dict:
        if self.model_type == "lightgbm":
            return {
                "objective": "regression",
                "metric": "mse",
                "boosting_type": "gbdt",
                "num_leaves": 31,
                "learning_rate": 0.05,
                "feature_fraction": 0.8,
                "bagging_fraction": 0.8,
                "bagging_freq": 5,
                "min_child_samples": 50,
                "reg_alpha": 0.1,
                "reg_lambda": 0.1,
                "n_estimators": 500,
                "verbose": -1,
                "n_jobs": -1,
            }
        else:
            return {
                "objective": "reg:squarederror",
                "max_depth": 6,
                "learning_rate": 0.05,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "min_child_weight": 50,
                "reg_alpha": 0.1,
                "reg_lambda": 0.1,
                "n_estimators": 500,
                "verbosity": 0,
                "n_jobs": -1,
            }
    
    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
    ):
        """训练模型"""
        if self.model_type == "lightgbm":
            import lightgbm as lgb
            
            self.model = lgb.LGBMRegressor(**self.params)
            
            fit_params = {}
            if X_val is not None and y_val is not None:
                fit_params["eval_set"] = [(X_val, y_val)]
                fit_params["callbacks"] = [
                    lgb.early_stopping(50, verbose=False),
                    lgb.log_evaluation(0),
                ]
            
            self.model.fit(X_train, y_train, **fit_params)
        
        else:
            import xgboost as xgb
            
            self.model = xgb.XGBRegressor(**self.params)
            
            fit_params = {}
            if X_val is not None and y_val is not None:
                fit_params["eval_set"] = [(X_val, y_val)]
                fit_params["verbose"] = False
            
            self.model.fit(X_train, y_train, **fit_params)
        
        return self.model
    
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """预测"""
        if self.model is None:
            raise ValueError("模型未训练")
        return self.model.predict(X)
    
    def get_feature_importance(self, feature_names: list[str]) -> pd.Series:
        """获取特征重要性"""
        importance = self.model.feature_importances_
        return pd.Series(importance, index=feature_names).sort_values(ascending=False)


# ============================================================
# 第四部分：超参数调优
# ============================================================

class HyperparameterTuner:
    """超参数调优器"""
    
    def __init__(
        self,
        model_type: str = "lightgbm",
        n_trials: int = 50,
    ):
        self.model_type = model_type
        self.n_trials = n_trials
        self.best_params = None
        self.best_score = -np.inf
    
    def tune(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        cv: TimeSeriesCV,
    ) -> dict:
        """
        随机搜索调优
        
        参数:
            X: 特征矩阵
            y: 目标变量
            cv: 时间序列交叉验证器
        
        返回:
            最优参数字典
        """
        param_space = self._get_param_space()
        best_score = -np.inf
        best_params = None
        
        for trial in range(self.n_trials):
            params = self._sample_params(param_space)
            
            scores = []
            for train_idx, val_idx in cv.split(X.index):
                X_train = X.iloc[train_idx]
                y_train = y.iloc[train_idx]
                X_val = X.iloc[val_idx]
                y_val = y.iloc[val_idx]
                
                trainer = TreeModelTrainer(self.model_type, params)
                trainer.train(X_train, y_train, X_val, y_val)
                
                pred = trainer.predict(X_val)
                ic = np.corrcoef(pred, y_val.values)[0, 1]
                if np.isfinite(ic):
                    scores.append(ic)
            
            if not scores:
                continue
            
            mean_score = np.mean(scores)
            
            if mean_score > best_score:
                best_score = mean_score
                best_params = params
                print(f"Trial {trial+1}: IC = {mean_score:.4f} (new best)")
            elif (trial + 1) % 10 == 0:
                print(f"Trial {trial+1}: IC = {mean_score:.4f}")
        
        self.best_params = best_params
        self.best_score = best_score
        
        print(f"\n最优IC: {best_score:.4f}")
        print(f"最优参数: {best_params}")
        
        return best_params
    
    def _get_param_space(self) -> dict:
        if self.model_type == "lightgbm":
            return {
                "num_leaves": [15, 31, 63, 127],
                "learning_rate": [0.01, 0.03, 0.05, 0.1],
                "feature_fraction": [0.6, 0.7, 0.8, 0.9],
                "bagging_fraction": [0.6, 0.7, 0.8, 0.9],
                "min_child_samples": [20, 50, 100, 200],
                "reg_alpha": [0, 0.01, 0.1, 1.0],
                "reg_lambda": [0, 0.01, 0.1, 1.0],
                "n_estimators": [300, 500, 800],
            }
        else:
            return {
                "max_depth": [3, 4, 5, 6, 7],
                "learning_rate": [0.01, 0.03, 0.05, 0.1],
                "subsample": [0.6, 0.7, 0.8, 0.9],
                "colsample_bytree": [0.6, 0.7, 0.8, 0.9],
                "min_child_weight": [20, 50, 100],
                "reg_alpha": [0, 0.01, 0.1, 1.0],
                "reg_lambda": [0, 0.01, 0.1, 1.0],
                "n_estimators": [300, 500, 800],
            }
    
    def _sample_params(self, param_space: dict) -> dict:
        params = {}
        base = {
            "objective": "regression" if self.model_type == "lightgbm" else "reg:squarederror",
            "metric": "mse" if self.model_type == "lightgbm" else None,
            "boosting_type": "gbdt" if self.model_type == "lightgbm" else None,
            "verbose": -1 if self.model_type == "lightgbm" else 0,
            "n_jobs": -1,
        }
        
        for k, v in base.items():
            if v is not None:
                params[k] = v
        
        for key, values in param_space.items():
            params[key] = np.random.choice(values)
        
        return params


# ============================================================
# 第五部分：SHAP解释
# ============================================================

class ModelExplainer:
    """模型解释器"""
    
    def __init__(self, model, feature_names: list[str]):
        self.model = model
        self.feature_names = feature_names
    
    def calculate_shap(self, X: pd.DataFrame, n_samples: int = 500) -> pd.DataFrame:
        """
        计算SHAP值
        
        SHAP（SHapley Additive exPlanations）基于博弈论，
        计算每个特征对预测结果的边际贡献
        """
        import shap
        
        if len(X) > n_samples:
            X_sample = X.sample(n_samples, random_state=42)
        else:
            X_sample = X
        
        if hasattr(self.model, "get_booster"):
            explainer = shap.TreeExplainer(self.model)
        else:
            explainer = shap.TreeExplainer(self.model)
        
        shap_values = explainer.shap_values(X_sample)
        
        shap_df = pd.DataFrame(
            shap_values,
            columns=self.feature_names,
            index=X_sample.index,
        )
        
        return shap_df
    
    def plot_shap_summary(self, shap_df: pd.DataFrame, top_n: int = 20) -> None:
        """绘制SHAP摘要图"""
        try:
            import shap
            import matplotlib.pyplot as plt
            
            mean_abs_shap = shap_df.abs().mean().sort_values(ascending=False)
            top_features = mean_abs_shap.head(top_n).index
            
            print(f"\nTop {top_n} 特征SHAP值:")
            for feat in top_features:
                print(f"  {feat:30s}  SHAP = {mean_abs_shap[feat]:.6f}")
            
            plt.rcParams["font.sans-serif"] = ["SimHei", "Microsoft YaHei"]
            plt.rcParams["axes.unicode_minus"] = False
            
            fig, ax = plt.subplots(figsize=(10, 8))
            y_pos = range(len(top_features))
            ax.barh(y_pos, mean_abs_shap[top_features].values, color="steelblue")
            ax.set_yticks(y_pos)
            ax.set_yticklabels(top_features)
            ax.set_xlabel("平均|SHAP值|")
            ax.set_title("特征重要性（SHAP）")
            ax.invert_yaxis()
            plt.tight_layout()
            plt.savefig("shap_importance.png", dpi=150, bbox_inches="tight")
            plt.show()
            
        except ImportError:
            print("需要安装shap和matplotlib来绘制图表")


# ============================================================
# 第六部分：完整训练流水线
# ============================================================

class MLStockPredictor:
    """机器学习选股预测器"""
    
    def __init__(
        self,
        model_type: str = "lightgbm",
        params: Optional[dict] = None,
    ):
        self.feature_builder = QuantFeatureBuilder()
        self.trainer = TreeModelTrainer(model_type, params)
        self.cv = TimeSeriesCV(
            n_splits=5, train_size=504, test_size=63, gap=5
        )
        self.explainer = None
    
    def run_pipeline(self, data: dict[str, pd.DataFrame]) -> dict:
        """运行完整的训练流水线"""
        print("=" * 60)
        print("ML选股模型训练流水线")
        print("=" * 60)
        
        print("\n[1/5] 构建特征...")
        features = self.feature_builder.build_all_features(data)
        print(f"  特征数量: {features.shape[1]}")
        print(f"  数据形状: {features.shape}")
        
        print("\n[2/5] 构建目标变量...")
        target = self.feature_builder.create_target(
            data["returns"], forward_days=5, method="return"
        )
        
        print("\n[3/5] 数据对齐与清洗...")
        X, y = self._align_and_clean(features, target)
        print(f"  有效样本: {len(X)}")
        
        print("\n[4/5] 时间序列交叉验证...")
        cv_results = self._cross_validate(X, y)
        
        print("\n[5/5] 训练最终模型...")
        final_model = self._train_final(X, y)
        
        self.explainer = ModelExplainer(
            final_model, list(X.columns)
        )
        
        return {
            "cv_results": cv_results,
            "feature_importance": self.trainer.get_feature_importance(
                list(X.columns)
            ),
            "model": final_model,
        }
    
    def _align_and_clean(
        self, features: pd.DataFrame, target: pd.DataFrame
    ) -> tuple[pd.DataFrame, pd.Series]:
        """对齐特征和目标，处理缺失值"""
        features_flat = features.stack()
        target_flat = target.stack()
        
        features_flat.index.names = ["date", "stock"]
        target_flat.index.names = ["date", "stock"]
        
        common_idx = features_flat.index.intersection(target_flat.index)
        X = features_flat.loc[common_idx]
        y = target_flat.loc[common_idx]
        
        mask = X.notna().all(axis=1) & y.notna()
        X = X.loc[mask]
        y = y.loc[mask]
        
        return X, y
    
    def _cross_validate(self, X: pd.DataFrame, y: pd.Series) -> pd.DataFrame:
        """交叉验证"""
        results = []
        
        for fold, (train_idx, test_idx) in enumerate(self.cv.split(X.index)):
            X_train = X.iloc[train_idx]
            y_train = y.iloc[train_idx]
            X_test = X.iloc[test_idx]
            y_test = y.iloc[test_idx]
            
            X_tr, X_val = X_train.iloc[:-63], X_train.iloc[-63:]
            y_tr, y_val = y_train.iloc[:-63], y_train.iloc[-63:]
            
            trainer = TreeModelTrainer(
                self.trainer.model_type, self.trainer.params
            )
            trainer.train(X_tr, y_tr, X_val, y_val)
            
            pred = trainer.predict(X_test)
            
            ic = np.corrcoef(pred, y_test.values)[0, 1]
            
            pred_series = pd.Series(pred, index=y_test.index)
            
            if isinstance(y_test.index, pd.MultiIndex):
                dates = y_test.index.get_level_values(0).unique()
                daily_ics = []
                for date in dates:
                    mask = y_test.index.get_level_values(0) == date
                    if mask.sum() > 30:
                        day_ic = np.corrcoef(
                            pred[mask], y_test[mask].values
                        )[0, 1]
                        if np.isfinite(day_ic):
                            daily_ics.append(day_ic)
                
                ic_mean = np.mean(daily_ics) if daily_ics else ic
                ic_std = np.std(daily_ics) if daily_ics else 0
            else:
                ic_mean = ic
                ic_std = 0
            
            results.append({
                "fold": fold,
                "train_size": len(X_train),
                "test_size": len(X_test),
                "ic": ic_mean,
                "ic_std": ic_std,
                "ir": ic_mean / ic_std if ic_std > 0 else 0,
            })
            
            print(f"  Fold {fold}: IC = {ic_mean:.4f}, "
                  f"IR = {ic_mean/ic_std if ic_std > 0 else 0:.2f}")
        
        results_df = pd.DataFrame(results)
        print(f"\n  平均IC: {results_df['ic'].mean():.4f}")
        print(f"  平均IR: {results_df['ir'].mean():.2f}")
        
        return results_df
    
    def _train_final(self, X: pd.DataFrame, y: pd.Series):
        """训练最终模型（使用全部数据）"""
        n_val = min(126, len(X) // 5)
        X_train, X_val = X.iloc[:-n_val], X.iloc[-n_val:]
        y_train, y_val = y.iloc[:-n_val], y.iloc[-n_val:]
        
        model = self.trainer.train(X_train, y_train, X_val, y_val)
        
        pred = self.trainer.predict(X_val)
        val_ic = np.corrcoef(pred, y_val.values)[0, 1]
        print(f"  验证集IC: {val_ic:.4f}")
        
        return model


# ============================================================
# 第七部分：XGBoost与LightGBM对比
# ============================================================

def compare_models(data: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """对比LightGBM和XGBoost的表现"""
    results = []
    
    for model_type in ["lightgbm", "xgboost"]:
        print(f"\n{'=' * 40}")
        print(f"训练 {model_type.upper()}")
        print(f"{'=' * 40}")
        
        predictor = MLStockPredictor(model_type=model_type)
        pipeline_result = predictor.run_pipeline(data)
        
        cv = pipeline_result["cv_results"]
        results.append({
            "model": model_type,
            "mean_ic": cv["ic"].mean(),
            "mean_ir": cv["ir"].mean(),
            "ic_std": cv["ic"].std(),
        })
    
    comparison = pd.DataFrame(results)
    print(f"\n{'=' * 40}")
    print("模型对比结果")
    print(f"{'=' * 40}")
    print(comparison.to_string(index=False))
    
    return comparison


# ============================================================
# 主函数
# ============================================================

def main():
    np.random.seed(42)
    
    n_stocks = 200
    n_days = 750
    dates = pd.bdate_range("2022-01-01", periods=n_days)
    stock_codes = [f"{i:06d}" for i in range(1, n_stocks + 1)]
    
    market_ret = np.random.normal(0.0003, 0.012, n_days)
    
    returns_data = np.zeros((n_days, n_stocks))
    for i in range(n_stocks):
        beta = np.random.uniform(0.6, 1.4)
        idio = np.random.uniform(0.015, 0.04)
        returns_data[:, i] = beta * market_ret + np.random.normal(0, idio, n_days)
    
    returns = pd.DataFrame(returns_data, index=dates, columns=stock_codes)
    
    data = {
        "returns": returns,
        "volume": pd.DataFrame(
            np.random.exponential(1e6, (n_days, n_stocks)),
            index=dates, columns=stock_codes,
        ),
        "turnover": pd.DataFrame(
            np.random.exponential(0.03, (n_days, n_stocks)),
            index=dates, columns=stock_codes,
        ),
        "pe": pd.DataFrame(
            np.random.uniform(5, 100, (n_days, n_stocks)),
            index=dates, columns=stock_codes,
        ),
        "pb": pd.DataFrame(
            np.random.uniform(0.5, 10, (n_days, n_stocks)),
            index=dates, columns=stock_codes,
        ),
        "roe": pd.DataFrame(
            np.random.normal(0.12, 0.08, (n_days, n_stocks)),
            index=dates, columns=stock_codes,
        ),
    }
    
    predictor = MLStockPredictor(model_type="lightgbm")
    result = predictor.run_pipeline(data)
    
    print(f"\n{'=' * 60}")
    print("特征重要性 Top 10")
    print(f"{'=' * 60}")
    fi = result["feature_importance"].head(10)
    for feat, imp in fi.items():
        print(f"  {feat:30s}  {imp}")
    
    print("\n训练完成！")


if __name__ == "__main__":
    main()
```

## 4. 常见误区

### 误区一：使用随机交叉验证

**错误做法**：使用sklearn的KFold进行随机分割。

**问题**：金融数据有时间序列特性，随机分割会导致未来数据泄露到训练集。

**正确做法**：使用时间序列交叉验证（TimeSeriesCV），确保训练集始终在测试集之前。

### 误区二：特征中包含未来信息

**错误做法**：使用当天的收盘价计算技术指标作为当天的特征。

**问题**：当天收盘价在交易时段内是逐步形成的，盘中不可能知道最终收盘价。

**正确做法**：所有特征必须使用T-1日或更早的数据。

### 误区三：忽略特征的截面标准化

**错误做法**：直接使用原始特征值训练模型。

**问题**：不同股票的PE绝对值差异很大，模型会学到"PE高的股票更好"而非"PE相对低的股票更好"。

**正确做法**：在截面（同一日期）内对特征进行排名或Z-Score标准化。

### 误区四：过度依赖单一评价指标

**错误做法**：只看IC，不看IC的稳定性（IR）和分层单调性。

**正确做法**：综合评价IC均值、IR、分层回测的单调性、换手率等指标。

### 误区五：忽略模型的时变性

**错误做法**：训练一个模型用到底。

**正确做法**：定期重新训练模型（如每季度），或者使用滚动窗口持续更新。

## 5. 小结

本课我们学习了：

1. **树模型的优势**：天然处理非线性、交互效应、缺失值
2. **XGBoost vs LightGBM**：Leaf-wise更高效但需防过拟合
3. **特征工程**：价格、成交量、技术指标、截面特征
4. **时间序列CV**：扩展窗口，避免前视偏差
5. **超参数调优**：随机搜索+时间序列CV
6. **SHAP解释**：理解模型预测的驱动因素

## 练习

### 练习一：添加行业特征

在特征工程中添加行业相对特征：计算每只股票在所属行业内的因子排名，作为新的特征输入模型。

### 练习二：实现早停策略

修改代码，实现基于验证集IC的早停策略：当验证集IC连续N轮不提升时停止训练，防止过拟合。

### 练习三：模型融合

实现一个简单的模型融合策略：将LightGBM和XGBoost的预测按IC_IR加权组合，比较融合后与单模型的表现差异。

---

## 参考答案

### 练习一

**思路**：在特征构建阶段，获取行业映射信息，然后在截面内按行业分组计算排名。

**答案**：

```python
def build_industry_rank_features(
    factors: dict[str, pd.DataFrame],
    industry_map: pd.Series,
) -> dict[str, pd.DataFrame]:
    """构建行业内排名特征"""
    features = {}
    
    for factor_name, factor_df in factors.items():
        rank_df = factor_df.copy()
        
        for date in factor_df.index:
            row = factor_df.loc[date].dropna()
            stocks = row.index
            ind = industry_map.reindex(stocks)
            
            df = pd.DataFrame({"value": row, "industry": ind})
            industry_rank = df.groupby("industry")["value"].rank(pct=True)
            rank_df.loc[date, stocks] = industry_rank.values
        
        features[f"{factor_name}_ind_rank"] = rank_df
    
    return features
```

**要点**：
- 行业内排名消除了行业间的系统性差异
- PE在银行业和科技业的绝对水平完全不同，行业内排名更有意义
- 这个特征可以作为市值中性化的补充

### 练习二

**思路**：在训练过程中监控验证集IC，记录历史最优值，当连续N轮没有提升时提前停止。

**答案**：

```python
class EarlyStoppingCallback:
    """基于验证集IC的早停策略"""
    
    def __init__(self, patience: int = 20, min_delta: float = 0.0001):
        self.patience = patience
        self.min_delta = min_delta
        self.best_ic = -np.inf
        self.counter = 0
        self.best_iteration = 0
    
    def __call__(self, env):
        """LightGBM回调函数"""
        eval_result = env.evaluation_result_list
        if not eval_result:
            return
        
        val_ic = eval_result[0][2]
        
        if val_ic > self.best_ic + self.min_delta:
            self.best_ic = val_ic
            self.counter = 0
            self.best_iteration = env.iteration
        else:
            self.counter += 1
        
        if self.counter >= self.patience:
            env.model.stop_training = True

def train_with_early_stopping(
    X_train, y_train, X_val, y_val, patience=20
):
    """带早停的LightGBM训练"""
    import lightgbm as lgb
    
    params = {
        "objective": "regression",
        "metric": "mse",
        "num_leaves": 31,
        "learning_rate": 0.05,
        "verbose": -1,
    }
    
    train_data = lgb.Dataset(X_train, y_train)
    val_data = lgb.Dataset(X_val, y_val, reference=train_data)
    
    callbacks = [
        lgb.early_stopping(patience, verbose=False),
        lgb.log_evaluation(50),
    ]
    
    model = lgb.train(
        params, train_data,
        valid_sets=[val_data],
        num_boost_round=1000,
        callbacks=callbacks,
    )
    
    return model
```

### 练习三

**思路**：分别训练两个模型，用历史IC_IR作为权重进行融合。

**答案**：

```python
def model_ensemble(
    data: dict[str, pd.DataFrame],
    lgb_params: dict = None,
    xgb_params: dict = None,
) -> dict:
    """LightGBM + XGBoost模型融合"""
    
    predictor_lgb = MLStockPredictor("lightgbm", lgb_params)
    result_lgb = predictor_lgb.run_pipeline(data)
    cv_lgb = result_lgb["cv_results"]
    ir_lgb = cv_lgb["ir"].mean()
    
    predictor_xgb = MLStockPredictor("xgboost", xgb_params)
    result_xgb = predictor_xgb.run_pipeline(data)
    cv_xgb = result_xgb["cv_results"]
    ir_xgb = cv_xgb["ir"].mean()
    
    total_ir = max(ir_lgb + ir_xgb, 0.001)
    w_lgb = max(ir_lgb, 0) / total_ir
    w_xgb = max(ir_xgb, 0) / total_ir
    
    print(f"\n融合权重: LightGBM={w_lgb:.2f}, XGBoost={w_xgb:.2f}")
    
    ensemble_ic = w_lgb * cv_lgb["ic"].mean() + w_xgb * cv_xgb["ic"].mean()
    
    return {
        "lgb_result": result_lgb,
        "xgb_result": result_xgb,
        "weights": {"lightgbm": w_lgb, "xgboost": w_xgb},
        "ensemble_ic": ensemble_ic,
    }
```

**要点**：
- 模型融合的前提是两个模型的预测有一定差异性
- 用IC_IR加权比等权更合理，因为给予了稳定模型更高权重
- 如果两个模型高度相关，融合效果有限
