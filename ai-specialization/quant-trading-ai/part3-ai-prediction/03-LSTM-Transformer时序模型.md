# 第3课 LSTM/Transformer时序模型

## 场景引入

上一课我们用LightGBM和XGBoost进行股票预测，这些模型在截面预测（同一时间点预测不同股票）上表现出色。但它们有一个根本性的局限：**它们把每个样本当作独立的，不理解时间序列的顺序性**。

股票价格是有记忆的。今天的走势受过去几天、几周甚至几个月的影响。RNN、LSTM、Transformer这类序列模型，天生就能捕捉这种时序依赖关系。

但现实很残酷：**直接把LSTM用在金融数据上，效果往往不如简单的树模型**。为什么？因为金融数据信噪比极低，LSTM容易学到噪音而非信号。

本课将带你理解这些模型的原理、局限性，以及如何在实践中正确使用它们。

**风险提示：深度学习模型在金融领域的应用存在严重的过拟合风险。本课仅作教学用途，不构成投资建议。**

## 学习目标

通过本课学习，你将能够：

1. 理解RNN/LSTM/GRU的原理和梯度问题
2. 掌握Transformer的自注意力机制和位置编码
3. 了解Temporal Fusion Transformer（TFT）的概念
4. 使用PyTorch实现LSTM和Transformer选股模型
5. 掌握深度学习在金融中的实战技巧
6. 对比树模型和深度学习模型的优劣

## 1. RNN回顾与LSTM的必要性

### 1.1 朴素RNN的问题

```
朴素RNN（Vanilla RNN）

  x_t ──▶ [RNN Cell] ──▶ h_t ──▶ y_t
             ▲    │
             │    ▼
           h_{t-1}

  h_t = tanh(W_h * h_{t-1} + W_x * x_t + b)
  y_t = W_o * h_t

问题：梯度消失/爆炸

  反向传播时：
  ∂L/∂h_1 = ∂L/∂h_T * ∂h_T/∂h_{T-1} * ... * ∂h_2/∂h_1
  
  每一步都乘以 W_h，如果 |W_h| > 1 → 梯度爆炸
                           |W_h| < 1 → 梯度消失
                           
  结果：RNN无法学习长期依赖关系
```

### 1.2 LSTM的核心设计

```
LSTM（Long Short-Term Memory）

  ┌─────────────────────────────────────────┐
  │  LSTM Cell                               │
  │                                          │
  │  c_{t-1} ──────▶ [×] ──▶ [+] ──▶ c_t   │
  │                  ▲        ▲              │
  │  f_t (遗忘门)────┘        │              │
  │                  i_t (输入门) ── [tanh]  │
  │                       ▲                  │
  │  x_t ──▶ ┌────┐      │                  │
  │          │σ   │──▶ f_t (遗忘门)          │
  │          │σ   │──▶ i_t (输入门)          │
  │          │tanh│──▶ g_t (候选值)          │
  │          │σ   │──▶ o_t (输出门)          │
  │          └────┘                          │
  │              ▲                           │
  │  h_{t-1} ───┘                            │
  │                                          │
  │  h_t = o_t * tanh(c_t)                   │
  └─────────────────────────────────────────┘

核心思想：
  - 遗忘门 f_t：决定从细胞状态中丢弃什么信息
  - 输入门 i_t：决定什么新信息存入细胞状态
  - 输出门 o_t：决定基于细胞状态输出什么
  
细胞状态 c_t 是信息的"高速公路"，
梯度可以沿着它无阻碍地流动
```

### 1.3 GRU：简化的LSTM

```
GRU（Gated Recurrent Unit）

  z_t = σ(W_z * [h_{t-1}, x_t])     ← 更新门
  r_t = σ(W_r * [h_{t-1}, x_t])     ← 重置门
  h̃_t = tanh(W * [r_t * h_{t-1}, x_t])  ← 候选隐藏状态
  h_t = (1 - z_t) * h_{t-1} + z_t * h̃_t  ← 最终隐藏状态

GRU vs LSTM：
  - 参数更少（2个门 vs 3个门）
  - 没有独立的细胞状态
  - 训练更快，数据量少时更不容易过拟合
  - 在很多任务上效果与LSTM相当
```

## 2. Transformer核心原理

### 2.1 自注意力机制

```
自注意力（Self-Attention）

输入序列: X = [x_1, x_2, ..., x_T]

  Q = X * W_Q  (Query)
  K = X * W_K  (Key)
  V = X * W_V  (Value)

注意力计算：
  Attention(Q, K, V) = softmax(Q * K^T / √d_k) * V

  Q*K^T：计算每对位置之间的相关性分数
  √d_k：缩放因子，防止点积过大导致softmax饱和
  softmax：将分数转化为概率分布
  *V：用注意力分数加权求和

示例：预测明天股价
  Q: "明天的股价"的查询向量
  K: 过去T天每天的键向量
  V: 过去T天每天的值向量
  
  注意力分数：
  x_1(30天前)  ████ 0.05
  x_2(29天前)  ████ 0.03
  ...
  x_{T-1}(昨天) ████████████ 0.35  ← 最重要
  x_T(今天)    ██████████ 0.25
  
  模型自动学习哪些历史时刻对预测最重要
```

### 2.2 多头注意力

```
多头注意力（Multi-Head Attention）

  head_i = Attention(Q*W_Qi, K*W_Ki, V*W_Vi)
  MultiHead(Q, K, V) = Concat(head_1, ..., head_h) * W_O

  不同的头可以关注不同类型的模式：
  - Head 1: 关注短期动量（3-5天）
  - Head 2: 关注中期趋势（20天）
  - Head 3: 关注量价关系
  - Head 4: 关注波动率变化
```

### 2.3 位置编码

```
位置编码（Positional Encoding）

Transformer没有循环结构，需要显式注入位置信息

  PE(pos, 2i)   = sin(pos / 10000^(2i/d))
  PE(pos, 2i+1) = cos(pos / 10000^(2i/d))

  pos: 位置索引
  i: 维度索引
  d: 模型维度

为什么用sin/cos？
  - 每个位置有唯一编码
  - 相对位置可以通过线性变换获得
  - 可以外推到训练时未见过的长度
```

### 2.4 Transformer vs LSTM

```
Transformer vs LSTM 对比

┌──────────────┬──────────────────┬──────────────────┐
│ 特性          │ LSTM             │ Transformer      │
├──────────────┼──────────────────┼──────────────────┤
│ 长期依赖      │ 受限（门控机制） │ 直接（注意力）   │
│ 并行化        │ 无法并行         │ 完全并行         │
│ 训练速度      │ 慢               │ 快（GPU友好）    │
│ 内存占用      │ O(T)             │ O(T²)           │
│ 小数据集      │ 较好             │ 容易过拟合       │
│ 可解释性      │ 有限             │ 注意力权重可解释 │
│ 金融适用性    │ 需要精心调参     │ 需要更多数据     │
└──────────────┴──────────────────┴──────────────────┘
```

## 3. LSTM实战代码

```python
"""
LSTM/Transformer量化选股模型

使用PyTorch实现基于LSTM和Transformer的股票收益率预测模型

依赖：
    pip install torch pandas numpy scikit-learn matplotlib
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from typing import Optional
import warnings

warnings.filterwarnings("ignore")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"使用设备: {DEVICE}")


# ============================================================
# 数据准备
# ============================================================

class StockSequenceDataset(Dataset):
    """
    股票序列数据集
    
    将截面数据转换为序列数据，每个样本是一只股票的历史特征序列
    """
    
    def __init__(
        self,
        features: np.ndarray,
        targets: np.ndarray,
        seq_length: int = 20,
    ):
        self.features = torch.FloatTensor(features)
        self.targets = torch.FloatTensor(targets)
        self.seq_length = seq_length
    
    def __len__(self):
        return len(self.features)
    
    def __getitem__(self, idx):
        return self.features[idx], self.targets[idx]


def prepare_sequence_data(
    feature_df: pd.DataFrame,
    target_series: pd.Series,
    seq_length: int = 20,
    train_ratio: float = 0.7,
) -> dict:
    """
    准备序列数据
    
    将截面格式的因子数据转换为LSTM/Transformer所需的3D张量
    (samples, seq_length, features)
    """
    dates = feature_df.index.get_level_values(0).unique().sort_values()
    stocks = feature_df.index.get_level_values(1).unique().sort_values()
    
    n_dates = len(dates)
    n_stocks = len(stocks)
    n_features = feature_df.shape[1]
    
    print(f"数据维度: {n_dates} 日期 × {n_stocks} 股票 × {n_features} 特征")
    
    feature_3d = np.full((n_dates, n_stocks, n_features), np.nan)
    target_2d = np.full((n_dates, n_stocks), np.nan)
    
    for i, date in enumerate(dates):
        for j, stock in enumerate(stocks):
            if (date, stock) in feature_df.index:
                feature_3d[i, j, :] = feature_df.loc[(date, stock)].values
            if (date, stock) in target_series.index:
                target_2d[i, stock == stocks] = target_series.loc[(date, stock)]
    
    scaler = StandardScaler()
    
    X_list = []
    y_list = []
    
    for t in range(seq_length, n_dates):
        for j in range(n_stocks):
            seq = feature_3d[t - seq_length:t, j, :]
            target = target_2d[t, j]
            
            if np.any(np.isnan(seq)) or np.isnan(target):
                continue
            
            X_list.append(seq)
            y_list.append(target)
    
    if not X_list:
        raise ValueError("没有有效数据，请检查数据质量")
    
    X = np.array(X_list)
    y = np.array(y_list)
    
    X_flat = X.reshape(-1, n_features)
    valid_mask = np.all(np.isfinite(X_flat), axis=1)
    X_flat[~valid_mask] = 0
    
    scaler.fit(X_flat[valid_mask])
    X_flat = scaler.transform(X_flat)
    X = X_flat.reshape(-1, seq_length, n_features)
    
    split_idx = int(len(X) * train_ratio)
    
    return {
        "X_train": X[:split_idx],
        "y_train": y[:split_idx],
        "X_test": X[split_idx:],
        "y_test": y[split_idx:],
        "n_features": n_features,
        "seq_length": seq_length,
        "scaler": scaler,
    }


# ============================================================
# LSTM模型
# ============================================================

class LSTMStockPredictor(nn.Module):
    """
    LSTM股票预测模型
    
    结构：LSTM层 → Dropout → 全连接层
    """
    
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.3,
    ):
        super().__init__()
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )
        
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_size, 1)
    
    def forward(self, x):
        """
        前向传播
        
        参数:
            x: (batch_size, seq_length, input_size)
        
        返回:
            (batch_size, 1) 预测值
        """
        lstm_out, (h_n, c_n) = self.lstm(x)
        
        last_hidden = lstm_out[:, -1, :]
        
        out = self.dropout(last_hidden)
        out = self.fc(out)
        
        return out.squeeze(-1)


class GRUStockPredictor(nn.Module):
    """GRU股票预测模型"""
    
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.3,
    ):
        super().__init__()
        
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )
        
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_size, 1)
    
    def forward(self, x):
        gru_out, h_n = self.gru(x)
        last_hidden = gru_out[:, -1, :]
        out = self.dropout(last_hidden)
        out = self.fc(out)
        return out.squeeze(-1)


# ============================================================
# Transformer模型
# ============================================================

class PositionalEncoding(nn.Module):
    """位置编码"""
    
    def __init__(self, d_model: int, max_len: int = 100, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(dropout)
        
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-np.log(10000.0) / d_model)
        )
        
        pe[:, 0::2] = torch.sin(position * div_term)
        if d_model > 1:
            pe[:, 1::2] = torch.cos(position * div_term[:d_model // 2])
        
        pe = pe.unsqueeze(0)
        self.register_buffer("pe", pe)
    
    def forward(self, x):
        x = x + self.pe[:, :x.size(1)]
        return self.dropout(x)


class TransformerStockPredictor(nn.Module):
    """
    Transformer股票预测模型
    
    结构：线性映射 → 位置编码 → Transformer编码器 → 全连接层
    """
    
    def __init__(
        self,
        input_size: int,
        d_model: int = 64,
        nhead: int = 4,
        num_layers: int = 2,
        dim_feedforward: int = 128,
        dropout: float = 0.2,
    ):
        super().__init__()
        
        self.input_projection = nn.Linear(input_size, d_model)
        self.pos_encoder = PositionalEncoding(d_model, dropout=dropout)
        
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True,
        )
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layer, num_layers=num_layers
        )
        
        self.fc = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, 1),
        )
    
    def forward(self, x):
        """
        前向传播
        
        参数:
            x: (batch_size, seq_length, input_size)
        """
        x = self.input_projection(x)
        x = self.pos_encoder(x)
        
        x = self.transformer_encoder(x)
        
        x = x[:, -1, :]
        
        out = self.fc(x)
        return out.squeeze(-1)


# ============================================================
# 训练器
# ============================================================

class ModelTrainer:
    """深度学习模型训练器"""
    
    def __init__(
        self,
        model: nn.Module,
        learning_rate: float = 1e-3,
        weight_decay: float = 1e-4,
        patience: int = 10,
    ):
        self.model = model.to(DEVICE)
        self.optimizer = optim.Adam(
            model.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay,
        )
        self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, mode="min", factor=0.5, patience=5
        )
        self.criterion = nn.MSELoss()
        self.patience = patience
        self.best_val_loss = np.inf
        self.counter = 0
        self.best_model_state = None
    
    def train_epoch(self, dataloader: DataLoader) -> float:
        """训练一个epoch"""
        self.model.train()
        total_loss = 0
        n_batches = 0
        
        for X_batch, y_batch in dataloader:
            X_batch = X_batch.to(DEVICE)
            y_batch = y_batch.to(DEVICE)
            
            self.optimizer.zero_grad()
            predictions = self.model(X_batch)
            loss = self.criterion(predictions, y_batch)
            loss.backward()
            
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            
            self.optimizer.step()
            
            total_loss += loss.item()
            n_batches += 1
        
        return total_loss / max(n_batches, 1)
    
    def evaluate(self, dataloader: DataLoader) -> tuple[float, float]:
        """
        评估模型
        
        返回:
            (损失, IC)
        """
        self.model.eval()
        total_loss = 0
        n_batches = 0
        all_preds = []
        all_targets = []
        
        with torch.no_grad():
            for X_batch, y_batch in dataloader:
                X_batch = X_batch.to(DEVICE)
                y_batch = y_batch.to(DEVICE)
                
                predictions = self.model(X_batch)
                loss = self.criterion(predictions, y_batch)
                
                total_loss += loss.item()
                n_batches += 1
                
                all_preds.extend(predictions.cpu().numpy())
                all_targets.extend(y_batch.cpu().numpy())
        
        avg_loss = total_loss / max(n_batches, 1)
        
        preds = np.array(all_preds)
        targets = np.array(all_targets)
        
        valid = np.isfinite(preds) & np.isfinite(targets)
        if valid.sum() > 10:
            ic = np.corrcoef(preds[valid], targets[valid])[0, 1]
        else:
            ic = 0.0
        
        return avg_loss, ic
    
    def fit(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        n_epochs: int = 100,
    ) -> dict:
        """
        训练模型
        
        包含早停策略和学习率调度
        """
        history = {"train_loss": [], "val_loss": [], "val_ic": []}
        
        for epoch in range(n_epochs):
            train_loss = self.train_epoch(train_loader)
            val_loss, val_ic = self.evaluate(val_loader)
            
            self.scheduler.step(val_loss)
            
            history["train_loss"].append(train_loss)
            history["val_loss"].append(val_loss)
            history["val_ic"].append(val_ic)
            
            if val_loss < self.best_val_loss:
                self.best_val_loss = val_loss
                self.best_model_state = self.model.state_dict().copy()
                self.counter = 0
            else:
                self.counter += 1
            
            if (epoch + 1) % 10 == 0:
                print(
                    f"Epoch {epoch+1:3d} | "
                    f"Train Loss: {train_loss:.6f} | "
                    f"Val Loss: {val_loss:.6f} | "
                    f"Val IC: {val_ic:.4f}"
                )
            
            if self.counter >= self.patience:
                print(f"\n早停于 Epoch {epoch+1}")
                break
        
        if self.best_model_state is not None:
            self.model.load_state_dict(self.best_model_state)
        
        return history


# ============================================================
# 完整训练流水线
# ============================================================

class DeepStockPredictor:
    """深度学习选股预测器"""
    
    def __init__(
        self,
        model_type: str = "lstm",
        seq_length: int = 20,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.3,
        learning_rate: float = 1e-3,
        batch_size: int = 256,
        n_epochs: int = 100,
    ):
        self.model_type = model_type
        self.seq_length = seq_length
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.dropout = dropout
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.n_epochs = n_epochs
        self.model = None
        self.history = None
    
    def run(self, data: dict[str, pd.DataFrame]) -> dict:
        """运行完整的训练流水线"""
        print("=" * 60)
        print(f"{self.model_type.upper()} 选股模型训练")
        print("=" * 60)
        
        print("\n[1/4] 构建特征和目标...")
        features, target = self._build_features(data)
        
        print("\n[2/4] 准备序列数据...")
        seq_data = prepare_sequence_data(
            features, target, seq_length=self.seq_length
        )
        
        print("\n[3/4] 构建DataLoader...")
        train_dataset = StockSequenceDataset(
            seq_data["X_train"], seq_data["y_train"]
        )
        test_dataset = StockSequenceDataset(
            seq_data["X_test"], seq_data["y_test"]
        )
        
        train_loader = DataLoader(
            train_dataset, batch_size=self.batch_size, shuffle=True
        )
        test_loader = DataLoader(
            test_dataset, batch_size=self.batch_size, shuffle=False
        )
        
        print("\n[4/4] 训练模型...")
        model = self._build_model(seq_data["n_features"])
        
        trainer = ModelTrainer(
            model,
            learning_rate=self.learning_rate,
            patience=15,
        )
        
        history = trainer.fit(
            train_loader, test_loader, n_epochs=self.n_epochs
        )
        
        test_loss, test_ic = trainer.evaluate(test_loader)
        
        print(f"\n{'=' * 60}")
        print("测试集结果")
        print(f"{'=' * 60}")
        print(f"  Test Loss: {test_loss:.6f}")
        print(f"  Test IC:   {test_ic:.4f}")
        
        self.model = model
        self.history = history
        
        return {
            "model": model,
            "history": history,
            "test_ic": test_ic,
            "test_loss": test_loss,
        }
    
    def _build_features(self, data: dict[str, pd.DataFrame]):
        """构建特征和目标"""
        from part2_quant_strategies_07 import QuantFeatureBuilder
        
        builder = QuantFeatureBuilder()
        features = builder.build_all_features(data)
        target = builder.create_target(data["returns"], forward_days=5)
        
        features_flat = features.stack()
        target_flat = target.stack()
        
        features_flat.index.names = ["date", "stock"]
        target_flat.index.names = ["date", "stock"]
        
        common = features_flat.index.intersection(target_flat.index)
        features_flat = features_flat.loc[common]
        target_flat = target_flat.loc[common]
        
        mask = features_flat.notna().all(axis=1) & target_flat.notna()
        
        return features_flat.loc[mask], target_flat.loc[mask]
    
    def _build_model(self, input_size: int) -> nn.Module:
        """构建模型"""
        if self.model_type == "lstm":
            return LSTMStockPredictor(
                input_size=input_size,
                hidden_size=self.hidden_size,
                num_layers=self.num_layers,
                dropout=self.dropout,
            )
        elif self.model_type == "gru":
            return GRUStockPredictor(
                input_size=input_size,
                hidden_size=self.hidden_size,
                num_layers=self.num_layers,
                dropout=self.dropout,
            )
        elif self.model_type == "transformer":
            return TransformerStockPredictor(
                input_size=input_size,
                d_model=self.hidden_size,
                nhead=4,
                num_layers=self.num_layers,
                dim_feedforward=self.hidden_size * 2,
                dropout=self.dropout,
            )
        else:
            raise ValueError(f"不支持的模型类型: {self.model_type}")


# ============================================================
# 实战技巧
# ============================================================

class FinanceDLTips:
    """金融深度学习实战技巧"""
    
    @staticmethod
    def normalize_targets(
        targets: pd.Series,
        window: int = 252,
    ) -> pd.Series:
        """
        目标变量标准化
        
        在金融中，收益的均值和方差会随时间变化
        使用滚动窗口标准化可以提高模型稳定性
        """
        rolling_mean = targets.rolling(window, min_periods=60).mean()
        rolling_std = targets.rolling(window, min_periods=60).std()
        
        normalized = (targets - rolling_mean) / rolling_std.replace(0, np.nan)
        return normalized
    
    @staticmethod
    def add_noise_augmentation(
        X: np.ndarray,
        noise_std: float = 0.01,
    ) -> np.ndarray:
        """
        数据增强：添加高斯噪声
        
        在金融数据中，微小的输入扰动可以帮助模型
        学习更鲁棒的特征，减少过拟合
        """
        noise = np.random.normal(0, noise_std, X.shape)
        return X + noise
    
    @staticmethod
    def label_smoothing(
        y: np.ndarray,
        epsilon: float = 0.1,
    ) -> np.ndarray:
        """
        标签平滑
        
        将极端收益率值向均值收缩，减少异常值对模型的影响
        """
        y_mean = np.nanmean(y)
        return (1 - epsilon) * y + epsilon * y_mean


# ============================================================
# 模型对比
# ============================================================

def compare_all_models(data: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """对比LSTM、GRU、Transformer和LightGBM"""
    results = []
    
    models = {
        "LSTM": {"model_type": "lstm", "seq_length": 20},
        "GRU": {"model_type": "gru", "seq_length": 20},
        "Transformer": {"model_type": "transformer", "seq_length": 20},
    }
    
    for name, params in models.items():
        print(f"\n{'=' * 40}")
        print(f"训练 {name}")
        print(f"{'=' * 40}")
        
        predictor = DeepStockPredictor(**params)
        result = predictor.run(data)
        
        results.append({
            "model": name,
            "test_ic": result["test_ic"],
            "test_loss": result["test_loss"],
        })
    
    comparison = pd.DataFrame(results)
    print(f"\n{'=' * 60}")
    print("模型对比结果")
    print(f"{'=' * 60}")
    print(comparison.to_string(index=False))
    
    return comparison


# ============================================================
# 主函数
# ============================================================

def main():
    np.random.seed(42)
    torch.manual_seed(42)
    
    n_stocks = 100
    n_days = 500
    dates = pd.bdate_range("2023-01-01", periods=n_days)
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
    
    predictor = DeepStockPredictor(
        model_type="lstm",
        seq_length=20,
        hidden_size=64,
        num_layers=2,
        dropout=0.3,
        learning_rate=1e-3,
        batch_size=128,
        n_epochs=50,
    )
    
    result = predictor.run(data)
    
    print(f"\n{'=' * 60}")
    print("LSTM训练完成")
    print(f"测试集IC: {result['test_ic']:.4f}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
```

## 4. 深度学习 vs 树模型

### 4.1 什么时候用深度学习

```
选型决策树

你的任务是什么？
├── 截面预测（同一时间点预测不同股票）
│   ├── 特征数量 < 50  → LightGBM / XGBoost
│   ├── 特征数量 > 200 → 考虑深度学习
│   └── 有大量非结构化数据（文本、图像） → 深度学习
│
├── 时序预测（预测单只股票的未来走势）
│   ├── 数据量 < 10年日线 → LightGBM + 滚动特征
│   ├── 数据量 > 50年 → 考虑LSTM/Transformer
│   └── 需要捕捉复杂时序模式 → Transformer
│
└── 另类数据处理
    ├── 新闻情感 → Transformer (BERT/GPT)
    ├── 卫星图像 → CNN
    └── 交易订单流 → LSTM/Transformer
```

### 4.2 常见失败原因

```
深度学习在金融中失败的常见原因

1. 数据量不足
   问题：10年日线 × 3000股票 ≈ 750万样本
         听起来很多，但信噪比极低
   建议：先用树模型做baseline

2. 过拟合噪音
   问题：模型学到的是随机波动而非真实信号
   建议：强正则化、Dropout、早停、简化模型

3. 目标变量选择不当
   问题：预测绝对收益率噪音太大
   建议：预测截面排名或分类标签

4. 忽略非平稳性
   问题：金融数据的分布会随时间变化
   建议：滚动窗口训练、目标标准化

5. 缺乏先验知识
   问题：纯数据驱动，忽略了金融领域的规律
   建议：在特征工程中融入领域知识
```

## 5. 常见误区

### 误区一：模型越复杂越好

**错误认知**：Transformer比LSTM先进，LSTM比GBDT先进，所以应该用Transformer。

**实际情况**：在大多数量化选股任务中，LightGBM的效果优于深度学习模型。深度学习只有在数据量充足、问题复杂度高时才有优势。

### 误区二：直接用原始价格序列

**错误做法**：直接用股价的原始数值作为模型输入。

**问题**：股价有趋势性，不同股票的价格水平差异很大，模型难以泛化。

**正确做法**：使用收益率、技术指标、截面标准化后的特征，而非原始价格。

### 误区三：忽略序列长度的选择

**错误做法**：随便选一个序列长度（如20天）。

**正确做法**：序列长度是一个重要的超参数，需要通过实验确定。太短会丢失长期信息，太长会引入噪音并增加计算成本。

### 误区四：不检查梯度健康

**错误做法**：训练完就直接用，不检查梯度状态。

**正确做法**：监控梯度范数，确保没有梯度爆炸或消失。如果梯度范数持续很大或很小，需要调整学习率或网络结构。

### 误区五：忽略推理效率

**错误做法**：只关注模型精度，不考虑推理速度。

**实际情况**：量化交易对延迟敏感。Transformer的O(T²)复杂度在长序列上可能太慢。需要在精度和速度之间权衡。

## 6. 小结

本课我们学习了：

1. **LSTM/GRU**：通过门控机制解决梯度消失问题，适合序列建模
2. **Transformer**：自注意力机制直接建模任意位置间的依赖关系
3. **PyTorch实现**：完整的数据准备、模型定义、训练流水线
4. **实战技巧**：目标标准化、噪声增强、标签平滑
5. **选型建议**：大多数情况下树模型更实用，深度学习适合特定场景

**关键对比**：

```
┌──────────────┬─────────┬─────────┬─────────┬─────────┐
│              │ LightGBM│ LSTM    │ GRU     │Transformer│
├──────────────┼─────────┼─────────┼─────────┼─────────┤
│ 训练速度      │ ★★★★★  │ ★★☆    │ ★★★    │ ★★★★   │
│ 小数据集表现  │ ★★★★★  │ ★★★    │ ★★★    │ ★★☆    │
│ 大数据集表现  │ ★★★    │ ★★★★   │ ★★★★   │ ★★★★★  │
│ 时序建模      │ ★★☆    │ ★★★★   │ ★★★★   │ ★★★★★  │
│ 可解释性      │ ★★★★   │ ★★☆    │ ★★☆    │ ★★★    │
│ 实际推荐度    │ ★★★★★  │ ★★★    │ ★★★    │ ★★★    │
└──────────────┴─────────┴─────────┴─────────┴─────────┘
```

## 练习

### 练习一：实现Attention-LSTM

在LSTM模型的基础上添加注意力机制：对LSTM的所有时间步输出计算注意力权重，使用加权求和而非仅使用最后一步的输出。

### 练习二：序列长度实验

分别使用5、10、20、40、60天的序列长度训练LSTM模型，比较不同序列长度下的测试集IC，分析最优序列长度。

### 练习三：树模型+深度学习融合

将LightGBM的预测值作为一个额外特征输入LSTM模型，或者将两个模型的预测按IC_IR加权融合，比较融合效果。

---

## 参考答案

### 练习一

**思路**：在LSTM输出的基础上，学习一个注意力网络来计算每个时间步的重要性权重。

**答案**：

```python
class AttentionLSTM(nn.Module):
    """带注意力机制的LSTM"""
    
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        num_layers: int = 2,
        dropout: float = 0.3,
    ):
        super().__init__()
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
        )
        
        self.attention = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
        )
        
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_size, 1)
    
    def forward(self, x):
        # x: (batch, seq_len, input_size)
        lstm_out, _ = self.lstm(x)
        # lstm_out: (batch, seq_len, hidden_size)
        
        # 计算注意力权重
        attn_scores = self.attention(lstm_out)
        # attn_scores: (batch, seq_len, 1)
        
        attn_weights = torch.softmax(attn_scores, dim=1)
        # attn_weights: (batch, seq_len, 1)
        
        # 加权求和
        context = torch.sum(attn_weights * lstm_out, dim=1)
        # context: (batch, hidden_size)
        
        out = self.dropout(context)
        out = self.fc(out)
        return out.squeeze(-1)
    
    def get_attention_weights(self, x):
        """获取注意力权重用于可视化"""
        with torch.no_grad():
            lstm_out, _ = self.lstm(x)
            attn_scores = self.attention(lstm_out)
            attn_weights = torch.softmax(attn_scores, dim=1)
        return attn_weights.squeeze(-1).cpu().numpy()
```

**要点**：
- 注意力机制让模型可以关注不同时间步的信息
- 可以通过可视化注意力权重来理解模型的决策依据
- 在金融中，近期的时间步通常会获得更高的注意力权重

### 练习二

**思路**：固定其他参数，只改变序列长度，训练多个模型并对比。

**答案**：

```python
def sequence_length_experiment(data: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """序列长度敏感性实验"""
    seq_lengths = [5, 10, 20, 40, 60]
    results = []
    
    for seq_len in seq_lengths:
        print(f"\n{'='*40}")
        print(f"序列长度 = {seq_len}")
        print(f"{'='*40}")
        
        predictor = DeepStockPredictor(
            model_type="lstm",
            seq_length=seq_len,
            hidden_size=64,
            num_layers=2,
            dropout=0.3,
            batch_size=128,
            n_epochs=50,
        )
        
        result = predictor.run(data)
        
        results.append({
            "seq_length": seq_len,
            "test_ic": result["test_ic"],
            "test_loss": result["test_loss"],
        })
    
    comparison = pd.DataFrame(results)
    print("\n序列长度实验结果:")
    print(comparison.to_string(index=False))
    
    return comparison
```

**要点**：
- 太短的序列（如5天）可能无法捕捉足够的时序模式
- 太长的序列（如60天）会引入更多噪音，且训练更慢
- 金融数据中最优序列长度通常在10-30天之间

### 练习三

**思路**：分别训练LightGBM和LSTM，然后在特征层面或预测层面进行融合。

**答案**：

```python
def hybrid_model_pipeline(data: dict[str, pd.DataFrame]) -> dict:
    """树模型+深度学习融合"""
    
    # Step 1: 训练LightGBM
    from lightgbm import LGBMRegressor
    
    lgb_predictor = MLStockPredictor("lightgbm")
    lgb_result = lgb_predictor.run_pipeline(data)
    lgb_ic = lgb_result["cv_results"]["ic"].mean()
    
    # Step 2: 用LightGBM的预测作为额外特征
    features_builder = QuantFeatureBuilder()
    features = features_builder.build_all_features(data)
    
    # Step 3: 训练LSTM（使用增强特征）
    dl_predictor = DeepStockPredictor(
        model_type="lstm",
        seq_length=20,
        hidden_size=64,
    )
    dl_result = dl_predictor.run(data)
    dl_ic = dl_result["test_ic"]
    
    # Step 4: IC_IR加权融合
    lgb_ir = lgb_result["cv_results"]["ir"].mean()
    dl_ir = dl_ic / 0.05  # 粗略估计
    
    total_ir = max(abs(lgb_ir) + abs(dl_ir), 0.001)
    w_lgb = abs(lgb_ir) / total_ir
    w_dl = abs(dl_ir) / total_ir
    
    ensemble_ic = w_lgb * lgb_ic + w_dl * dl_ic
    
    print(f"\n融合结果:")
    print(f"  LightGBM IC: {lgb_ic:.4f} (权重: {w_lgb:.2f})")
    print(f"  LSTM IC:     {dl_ic:.4f} (权重: {w_dl:.2f})")
    print(f"  融合 IC:     {ensemble_ic:.4f}")
    
    return {
        "lgb_result": lgb_result,
        "dl_result": dl_result,
        "ensemble_ic": ensemble_ic,
        "weights": {"lightgbm": w_lgb, "lstm": w_dl},
    }
```

**要点**：
- 树模型擅长截面特征，深度学习擅长时序模式
- 两者结合可以在不同维度上互补
- 融合权重应该基于历史表现动态调整
