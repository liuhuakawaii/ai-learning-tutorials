# Learning-to-Rank：让机器学习排序

## 场景引入

上一课我们实现了基于规则的排序系统，手动设定文本相关性、质量、时效、热度四个因子的权重。但手动调权存在根本性局限：线性组合无法捕获因子间的复杂交互，人工调权效率低，无法充分利用海量标注数据。

Learning-to-Rank（LTR）用机器学习模型自动学习最优排序函数，是现代搜索引擎排序的核心技术。Google、Bing、百度的搜索排序都基于 LTR。2000 年代中期，微软研究院的 Chris Burges 等人提出了 RankNet，开启了 LTR 的研究热潮。此后 LambdaRank、LambdaMART 等算法相继出现，逐渐成为工业界标准。

LTR 之所以能取代手动调权，核心原因有两个：第一，机器学习模型可以捕获特征之间的非线性交互（比如"BM25 高且 PageRank 低"可能意味着关键词堆砌），而线性加权做不到；第二，LTR 可以利用海量的用户点击数据和人工标注数据，从中自动学习最优的排序函数，比人工调参效率高得多。

## 学习目标

1. 理解 LTR 的三种范式：Pointwise、Pairwise、Listwise
2. 掌握 RankNet、LambdaRank 的核心思想
3. 使用 LightGBM 实现 LambdaMART 排序模型
4. 理解不同 LTR 方法的适用场景
5. 掌握 LTR 训练数据的构建方法和评估流程

## 1. LTR 基本框架

LTR 将排序转化为机器学习问题：构造训练数据（每个样本是 (查询, 文档) 对 + 人工标注），提取特征，训练模型，在线预测。

```python
from dataclasses import dataclass
from typing import List


@dataclass
class LabeledDocument:
    query_id: str
    doc_id: str
    relevance: int          # 0-4 相关性等级
    features: List[float]   # 特征向量
```

### 1.1 相关性标注体系

工业界常用的标注体系是多级相关性：

| 等级 | 含义 | 示例 |
|------|------|------|
| 0 | 不相关 | 搜索"蓝牙耳机"返回"蓝牙音箱" |
| 1 | 边缘相关 | 搜索"蓝牙耳机"返回"耳机发展历史" |
| 2 | 部分相关 | 搜索"蓝牙耳机"返回"耳机推荐"（未特指蓝牙） |
| 3 | 相关 | 搜索"蓝牙耳机"返回"蓝牙耳机选购指南" |
| 4 | 高度相关 | 搜索"蓝牙耳机"返回"2024 年蓝牙耳机排行榜" |

标注质量直接决定 LTR 模型的效果。工业界通常采用多人标注取众数的方式减少标注噪声。

### 1.2 训练数据构建

```python
import numpy as np
import random

random.seed(42)
np.random.seed(42)


def build_ltr_training_data(n_queries=200, n_features=10, max_docs_per_query=20):
    """构建 LTR 训练数据。

    模拟真实场景：每个查询有不同数量的候选文档，
    每个文档有特征向量和人工标注的相关性等级。
    """
    X_list, y_list, groups = [], [], []
    for _ in range(n_queries):
        n_docs = random.randint(5, max_docs_per_query)
        features = np.random.randn(n_docs, n_features)
        # 模拟真实相关性：前几个特征的加权和决定相关性
        true_weights = np.random.randn(n_features)
        raw_scores = features @ true_weights
        relevance = np.clip(np.round(raw_scores * 2 + 2), 0, 4).astype(int)
        X_list.append(features)
        y_list.append(relevance)
        groups.append(n_docs)
    return np.vstack(X_list), np.concatenate(y_list), groups
```

**group 信息的重要性**：group 数组记录每个查询有多少个候选文档。LTR 训练时必须知道哪些文档属于同一个查询，因为排序是在查询维度上进行的。如果把不同查询的文档混在一起，模型无法学习到正确的排序关系。

## 2. Pointwise 方法

Pointwise 把排序看作回归或分类问题，对每个 (query, doc) 对独立预测相关性。

```python
from sklearn.ensemble import GradientBoostingRegressor


X_train = np.array([
    [0.8, 0.6, 0.9, 0.1],  # BM25高, 质量高, 时效新, 热度低
    [0.3, 0.7, 0.5, 0.8],  # BM25低, 质量中, 时效中, 热度高
])
y_train = np.array([4, 2])

model = GradientBoostingRegressor(n_estimators=100, max_depth=4)
model.fit(X_train, y_train)
```

**Pointwise 的问题**：只关心单个文档的预测误差，不关心文档之间的相对顺序。两个文档的预测分数可能只差 0.01，但在排序中先后位置至关重要。

### 2.1 Pointwise 的数学本质

Pointwise 的损失函数是标准的回归损失（MSE）或分类损失（交叉熵）：

$$L = \sum_{(q, d)} \ell(f(q, d), y_{q,d})$$

其中 $f(q, d)$ 是模型对 (查询, 文档) 对的预测分数，$y_{q,d}$ 是真实标签。

这个损失函数的问题在于：它对所有文档一视同仁。一个预测误差为 0.1 的文档和一个预测误差也为 0.1 的文档贡献相同的损失，即使前者排在第 1 位而后者排在第 100 位。在排序场景中，头部位置的错误代价远大于尾部。

### 2.2 Pointwise 的适用场景

尽管有上述局限，Pointwise 在以下场景仍然有用：

- **标注数据稀疏**：当只有少量标注数据时，Pointwise 可以利用更多训练样本（每个文档对都是一个样本）
- **绝对分数有意义**：当需要预测"这个文档的相关性是 3.5 分"而非仅仅是排序时
- **作为基线模型**：快速验证特征和数据质量，再切换到更复杂的 Pairwise/Listwise 方法

## 3. Pairwise 方法

Pairwise 关注文档对之间的相对顺序，核心思想是预测"文档 A 是否应该排在文档 B 前面"。

### 3.1 RankNet

RankNet 将排序转化为二分类：给定文档对 (A, B)，预测 A 排在 B 前面的概率。

```python
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def ranknet_loss(scores_a, scores_b, label_ab):
    """RankNet 交叉熵损失。label_ab=1 表示 A 应排在 B 前"""
    diff = scores_a - scores_b
    p_ab = sigmoid(diff)
    loss = -label_ab * np.log(p_ab + 1e-10) - (1 - label_ab) * np.log(1 - p_ab + 1e-10)
    return loss
```

梯度推导：对 $s_a$ 求导得到 $\frac{\partial L}{\partial s_a} = \sigma(s_a - s_b) - y$。如果 A 应排在 B 前但分数低于 B，梯度为负，推动增大 A 的分数。

### 3.2 RankNet 的训练过程

```python
import torch
import torch.nn as nn


class RankNetModel(nn.Module):
    """RankNet 排序模型，使用两层全连接网络。"""

    def __init__(self, input_dim=10, hidden_dim=32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, x):
        return self.net(x).squeeze(-1)


def train_ranknet(X, y, groups, n_epochs=100, lr=0.001):
    """训练 RankNet 模型。

    从同一查询中采样文档对，用 RankNet 损失训练。
    """
    model = RankNetModel(X.shape[1])
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    # 构建文档对
    pairs = []
    offset = 0
    for n_docs in groups:
        indices = list(range(offset, offset + n_docs))
        for i in indices:
            for j in indices:
                if y[i] > y[j]:
                    pairs.append((i, j, 1))
                elif y[i] < y[j]:
                    pairs.append((i, j, 0))
        offset += n_docs

    X_tensor = torch.FloatTensor(X)
    for epoch in range(n_epochs):
        total_loss = 0.0
        random.shuffle(pairs)
        for i, j, label in pairs:
            s_i = model(X_tensor[i:i+1])
            s_j = model(X_tensor[j:j+1])
            diff = s_i - s_j
            p = torch.sigmoid(diff)
            loss = -(label * torch.log(p + 1e-10) +
                     (1 - label) * torch.log(1 - p + 1e-10))
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        if (epoch + 1) % 20 == 0:
            print(f"Epoch {epoch+1}: loss = {total_loss / len(pairs):.6f}")

    return model
```

**文档对数量爆炸问题**：一个有 N 个文档的查询可以产生 $O(N^2)$ 个文档对。如果每个查询平均有 20 个文档，就是 190 个文档对。这使得 Pairwise 方法在大规模数据上训练较慢。实际工程中通常只采样部分文档对进行训练。

### 3.3 LambdaRank

RankNet 平等对待所有文档对，但把一个相关文档从第 100 名提升到第 10 名，比从第 10 名提升到第 1 名更有价值。LambdaRank 在梯度上乘以 NDCG 变化量：

```python
def compute_dcg_delta(rel_a, rel_b, rank_a, rank_b):
    """交换 A、B 位置后 NDCG 的变化量。

    这个变化量用于缩放 RankNet 的梯度，使得对排序质量影响大的文档对
    获得更大的梯度更新。
    """
    gain_a = (2**rel_a - 1) / math.log2(rank_a + 1)
    gain_b = (2**rel_b - 1) / math.log2(rank_b + 1)
    gain_a_at_b = (2**rel_a - 1) / math.log2(rank_b + 1)
    gain_b_at_a = (2**rel_b - 1) / math.log2(rank_a + 1)
    return abs(gain_a_at_b + gain_b_at_a - gain_a - gain_b)
```

**LambdaRank 的核心洞察**：不是所有文档对都同等重要。一个高相关文档从第 10 名升到第 1 名带来的 NDCG 提升，远大于从第 100 名升到第 90 名。LambdaRank 通过在梯度上乘以 NDCG 变化量，让模型把更多注意力放在"对排序质量影响大"的文档对上。

### 3.4 LambdaRank 的梯度

LambdaRank 的梯度可以写成：

$$\lambda_{ij} = \frac{\partial C}{\partial s_i} = -\frac{1}{1 + e^{s_i - s_j}} |\Delta \text{NDCG}_{ij}|$$

其中 $\Delta \text{NDCG}_{ij}$ 是交换文档 i 和 j 的位置后 NDCG 的变化量。这个梯度同时考虑了排序错误的程度（sigmoid 项）和排序错误的代价（NDCG 变化项）。

## 4. Listwise 方法

Listwise 直接在整个排序列表层面定义损失函数。LambdaMART 结合了 LambdaRank 梯度和梯度提升树（GBDT），是工业界最常用的 LTR 算法。

### 4.1 LambdaMART 的优势

LambdaMART 之所以成为工业界首选，有几个关键原因：

1. **树模型天然处理特征交互**：GBDT 的每棵树自动学习特征的分裂组合，无需手动构造交叉特征
2. **不需要特征归一化**：树模型基于特征值排序做分裂，不受特征量纲影响
3. **直接优化排序指标**：LambdaRank 梯度确保模型关注排序质量而非预测精度
4. **推理速度快**：树模型的推理是简单的条件判断，比神经网络快得多
5. **可解释性好**：可以输出特征重要性，理解模型决策

### 4.2 ListNet 简介

ListNet 是另一种 Listwise 方法，它将排序列表转化为概率分布，用 KL 散度作为损失函数：

```python
def listnet_loss(predicted_scores, true_relevance):
    """ListNet 损失函数的简化实现。

    将分数转化为概率分布（softmax），然后用交叉熵衡量预测分布和真实分布的差异。
    """
    # 预测分数的概率分布
    pred_probs = np.exp(predicted_scores) / np.sum(np.exp(predicted_scores))
    # 真实相关性的概率分布
    true_probs = np.exp(true_relevance) / np.sum(np.exp(true_relevance))
    # 交叉熵损失
    loss = -np.sum(true_probs * np.log(pred_probs + 1e-10))
    return loss
```

ListNet 的问题在于 softmax 在长列表上计算开销大，且对异常值敏感。实际工程中 LambdaMART 更常用。

## 5. LightGBM 实现 LambdaMART

```python
import lightgbm as lgb


def generate_training_data(n_queries=100, n_features=10, max_docs=20):
    np.random.seed(42)
    X_list, y_list, groups = [], [], []
    for _ in range(n_queries):
        n_docs = np.random.randint(5, max_docs + 1)
        features = np.random.randn(n_docs, n_features)
        true_w = np.random.randn(n_features)
        relevance = np.clip(np.round(features @ true_w * 2 + 2), 0, 4).astype(int)
        X_list.append(features)
        y_list.append(relevance)
        groups.append(n_docs)
    return np.vstack(X_list), np.concatenate(y_list), groups


def train_lambda_mart():
    X, y, groups = generate_training_data()
    split = len(groups) // 2
    train_groups, val_groups = groups[:split], groups[split:]
    train_size = sum(train_groups)

    train_set = lgb.Dataset(X[:train_size], label=y[:train_size], group=train_groups)
    val_set = lgb.Dataset(X[train_size:], label=y[train_size:], group=val_groups,
                          reference=train_set)

    params = {
        "objective": "lambdarank", "metric": "ndcg",
        "ndcg_eval_at": [5, 10], "learning_rate": 0.05,
        "num_leaves": 31, "min_data_in_leaf": 20,
        "feature_fraction": 0.8, "verbose": -1,
    }

    model = lgb.train(params, train_set, num_boost_round=200,
                      valid_sets=[val_set],
                      callbacks=[lgb.early_stopping(20), lgb.log_evaluation(50)])
    return model


model = train_lambda_mart()
```

### 5.1 预测与评估

```python
def evaluate_ndcg(predictions, labels, groups, k=10):
    """评估排序模型的 NDCG@k。

    Args:
        predictions: 模型预测分数
        labels: 真实相关性标签
        groups: 每个查询的文档数量
        k: 截断位置

    Returns:
        平均 NDCG@k
    """
    scores, offset = [], 0
    for n_docs in groups:
        preds = predictions[offset:offset+n_docs]
        labs = labels[offset:offset+n_docs]
        order = np.argsort(-preds)
        sorted_labs = labs[order]

        dcg = sum((2**r - 1) / math.log2(i+2) for i, r in enumerate(sorted_labs[:k]))
        idcg = sum((2**r - 1) / math.log2(i+2) for i, r in enumerate(sorted(labs, reverse=True)[:k]))
        scores.append(dcg / idcg if idcg > 0 else 0)
        offset += n_docs

    avg = np.mean(scores)
    print(f"平均 NDCG@{k} = {avg:.4f}")
    return avg
```

### 5.2 超参调优

LambdaMART 的关键超参及其影响：

| 超参 | 含义 | 典型范围 | 影响 |
|------|------|----------|------|
| num_leaves | 每棵树的最大叶子数 | 15-127 | 越大模型越复杂，容易过拟合 |
| learning_rate | 学习率 | 0.01-0.1 | 越小泛化越好，但需要更多轮数 |
| min_data_in_leaf | 叶子节点最少样本数 | 10-100 | 越大正则化越强 |
| feature_fraction | 每棵树使用的特征比例 | 0.5-1.0 | 小于 1 可防止过拟合 |
| num_boost_round | 迭代轮数 | 100-1000 | 配合 early_stopping 使用 |

```python
def tune_lambda_mart(X, y, groups, n_trials=20):
    """网格搜索 LambdaMART 超参。"""
    from itertools import product

    split = len(groups) // 2
    train_groups, val_groups = groups[:split], groups[split:]
    train_size = sum(train_groups)

    train_set = lgb.Dataset(X[:train_size], label=y[:train_size], group=train_groups)
    val_set = lgb.Dataset(X[train_size:], label=y[train_size:], group=val_groups,
                          reference=train_set)

    best_ndcg, best_params = 0, {}
    for nl, lr, mdil in product([15, 31, 63], [0.01, 0.05, 0.1], [10, 20, 50]):
        params = {"objective": "lambdarank", "metric": "ndcg", "ndcg_eval_at": [10],
                  "num_leaves": nl, "learning_rate": lr, "min_data_in_leaf": mdil, "verbose": -1}
        m = lgb.train(params, train_set, num_boost_round=200, valid_sets=[val_set],
                      callbacks=[lgb.early_stopping(20), lgb.log_evaluation(0)])
        ndcg = m.best_score["valid_0"]["ndcg@10"]
        if ndcg > best_ndcg:
            best_ndcg, best_params = ndcg, {"num_leaves": nl, "learning_rate": lr, "min_data_in_leaf": mdil}
        print(f"num_leaves={nl}, lr={lr}, min_data={mdil} -> NDCG@10={ndcg:.4f}")

    print(f"\n最优: NDCG@10={best_ndcg:.4f}, 参数={best_params}")
    return best_ndcg, best_params
```

## 6. 三种范式对比

| 维度 | Pointwise | Pairwise | Listwise |
|------|-----------|----------|----------|
| 优化目标 | 单文档预测误差 | 文档对顺序正确率 | 整个列表排序质量 |
| 代表算法 | GBRank | RankNet, LambdaRank | ListNet, LambdaMART |
| 优点 | 实现简单 | 关注相对顺序 | 直接优化排序指标 |
| 缺点 | 忽略排序关系 | 文档对数量爆炸 | 实现复杂度高 |
| 训练样本数 | N 个文档 | O(N²) 对 | N 个列表 |
| 工业界常用度 | 低 | 中 | 高 |

### 6.1 如何选择 LTR 方法

```
数据量小（< 1000 查询）→ Pointwise（样本利用效率高）
中等数据量 → Pairwise（RankNet 或 LambdaRank）
大规模数据 → LambdaMART（工业界首选）
需要深度语义理解 → BERT-based LTR（如 monoBERT、cross-encoder）
```

## 7. LTR 的训练数据质量

训练数据质量是 LTR 效果的关键瓶颈。常见的数据质量问题包括：

### 7.1 标注一致性

```python
def compute_annotation_agreement(annotations_by_annotator):
    """计算标注者之间的一致性（Cohen's Kappa）。"""
    from collections import Counter

    all_pairs = []
    for query_annotations in zip(*annotations_by_annotator):
        for i in range(len(query_annotations)):
            for j in range(i + 1, len(query_annotations)):
                all_pairs.append((query_annotations[i], query_annotations[j]))

    agree = sum(1 for a, b in all_pairs if a == b)
    total = len(all_pairs)
    observed_agreement = agree / total if total > 0 else 0

    # 计算期望一致性
    all_labels = [l for pair in all_pairs for l in pair]
    label_counts = Counter(all_labels)
    n = len(all_labels)
    expected = sum((c / n) ** 2 for c in label_counts.values())

    kappa = (observed_agreement - expected) / (1 - expected) if expected < 1 else 0
    return kappa
```

Kappa 值的解读：
- 0.8-1.0：几乎完全一致
- 0.6-0.8：高度一致
- 0.4-0.6：中等一致
- < 0.4：一致性差，需要优化标注规范

### 7.2 标注偏差来源

1. **位置偏差**：标注者倾向于给排在前面的文档更高分数
2. **锚定效应**：看到第一个文档后，后续标注会受其影响
3. **疲劳效应**：长时间标注后质量下降
4. **领域知识差异**：不同标注者对同一查询的理解不同

## 8. 常见误区

1. **混淆三种范式**：Pointwise 独立看每个文档，Pairwise 看文档对，Listwise 看整个列表
2. **认为 LambdaMART 一定最优**：数据量小时 Pointwise 可能更稳定
3. **忽视 group 信息**：LightGBM 训练 LTR 必须正确设置 group，否则不知道哪些文档属于同一查询
4. **用随机划分而非按查询划分**：同一查询的文档不能同时出现在训练集和验证集
5. **忽视标注质量**：标注噪声会直接影响模型效果，投入标注质量比增加标注数量更值得
6. **只看 NDCG 不看线上指标**：离线 NDCG 提升不一定转化为线上指标提升

## 9. 工程建议

1. **从 LambdaMART 开始**：LightGBM 和 XGBoost 都原生支持，是最成熟的 LTR 算法
2. **特征比模型更重要**：好的特征工程往往比换模型带来更大提升
3. **按查询划分数据集**：避免同一查询的文档跨训练/验证集
4. **构建多阶段排序**：第一阶段简单模型快速筛选，第二阶段复杂 LTR 精排
5. **定期重训练**：用户行为和内容都在变化，模型需要定期用新数据重训练
6. **保留特征版本**：每次修改特征集都要记录版本，便于回溯和对比

## 小结

本课介绍了 LTR 三种范式：Pointwise 简单但忽略排序关系，Pairwise 关注文档对顺序，Listwise 直接优化排序指标。LambdaMART 是工业界主流选择，LightGBM 通过设置 `objective="lambdarank"` 即可训练。下一课我们将深入学习搜索特征工程。

## 练习

### 练习一：RankNet 训练

用 PyTorch 实现简单的 RankNet 模型，包含前向传播、RankNet 损失和参数更新。

### 练习二：LambdaMART 调参

调整 `num_leaves`、`learning_rate`、`min_data_in_leaf`，观察 NDCG@10 变化，记录最优组合。

### 练习三：Pointwise vs Pairwise 对比

用 GBDT（Pointwise）和 LightGBM LambdaMART 分别训练，比较 NDCG@5 差异。

### 练习四：训练数据质量分析

实现一个函数，检测训练数据中的异常查询（如所有文档相关性相同的查询、只有 1 个文档的查询），并分析其对模型效果的影响。

### 练习五：LTR 模型诊断

实现一个诊断工具：对每个查询计算模型的 NDCG@5，找出 NDCG 最低的 10 个查询，分析其特征分布和标注情况，定位模型的薄弱环节。

---

## 参考答案

### 练习一

**思路**：定义两层全连接网络作为打分模型，用交叉熵损失训练文档对。

```python
import torch
import torch.nn as nn

class RankNet(nn.Module):
    def __init__(self, dim=10, hidden=32):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(dim, hidden), nn.ReLU(), nn.Linear(hidden, 1))

    def forward(self, x):
        return self.net(x).squeeze(-1)

model = RankNet()
opt = torch.optim.Adam(model.parameters(), lr=0.01)
X_a = torch.randn(100, 10)
X_b = torch.randn(100, 10)
labels = (X_a[:, 0] > X_b[:, 0]).float()

for epoch in range(100):
    s_a, s_b = model(X_a), model(X_b)
    loss = -(labels * torch.log(torch.sigmoid(s_a - s_b) + 1e-10)
             + (1 - labels) * torch.log(1 - torch.sigmoid(s_a - s_b) + 1e-10)).mean()
    opt.zero_grad(); loss.backward(); opt.step()
```

**要点**：RankNet 损失本质是二元交叉熵，输入是两个文档的分数差。训练时要注意文档对的采样策略——只采样相关性不同的文档对，避免无意义的训练。

### 练习二

**思路**：网格搜索不同参数组合，记录每组的 NDCG@10。

```python
from itertools import product

best_ndcg, best_params = 0, {}
for nl, lr, mdil in product([15, 31, 63], [0.01, 0.05, 0.1], [10, 20, 50]):
    params = {"objective": "lambdarank", "metric": "ndcg", "ndcg_eval_at": [10],
              "num_leaves": nl, "learning_rate": lr, "min_data_in_leaf": mdil, "verbose": -1}
    m = lgb.train(params, train_set, num_boost_round=200, valid_sets=[val_set],
                  callbacks=[lgb.early_stopping(20), lgb.log_evaluation(0)])
    ndcg = m.best_score["valid_0"]["ndcg@10"]
    if ndcg > best_ndcg:
        best_ndcg, best_params = ndcg, {"num_leaves": nl, "learning_rate": lr, "min_data_in_leaf": mdil}
```

**要点**：`num_leaves` 控制树复杂度，`learning_rate` 越小泛化通常更好，`min_data_in_leaf` 是正则化参数。实际工程中建议用 Optuna 等贝叶斯优化工具代替网格搜索，效率更高。

### 练习三

**思路**：在同一数据集上分别训练 Pointwise GBDT 和 LambdaMART，用相同指标评估。

```python
from sklearn.ensemble import GradientBoostingRegressor

# Pointwise
pw = GradientBoostingRegressor(n_estimators=100, max_depth=4)
pw.fit(X_train, y_train)
pw_ndcg = evaluate_ndcg(pw.predict(X_val), y_val, val_groups)

# LambdaMART
lm = lgb.train(params, train_set, num_boost_round=100, valid_sets=[val_set],
               callbacks=[lgb.early_stopping(20), lgb.log_evaluation(0)])
lm_ndcg = evaluate_ndcg(lm.predict(X_val), y_val, val_groups)

print(f"Pointwise: {pw_ndcg:.4f}, LambdaMART: {lm_ndcg:.4f}")
```

**要点**：LambdaMART 直接优化排序指标，通常优于 Pointwise，差距在大规模数据上更明显。Pointwise 的优势在于实现简单、训练快，适合作为基线。

### 练习四

**思路**：检测异常查询并分析其特征。

```python
def detect_anomalous_queries(groups, labels, min_docs=2, min_label_variance=0.1):
    """检测训练数据中的异常查询。"""
    anomalies = []
    offset = 0
    for qid, n_docs in enumerate(groups):
        query_labels = labels[offset:offset + n_docs]
        # 只有 1 个文档的查询
        if n_docs < min_docs:
            anomalies.append((qid, "too_few_docs", n_docs))
        # 所有文档相关性相同的查询
        elif np.std(query_labels) < min_label_variance:
            anomalies.append((qid, "no_label_variation", query_labels.tolist()))
        # 相关性分布极端（全部 0 或全部 4）
        elif np.all(query_labels == 0) or np.all(query_labels == 4):
            anomalies.append((qid, "extreme_labels", query_labels.tolist()))
        offset += n_docs
    return anomalies
```

**要点**：异常查询会引入噪声。所有文档相关性相同的查询不提供排序信号，应该过滤掉。实际工程中还会检测标注者一致性低的查询。

### 练习五

**思路**：逐查询计算 NDCG，找出最差的查询并分析。

```python
def diagnose_model(model, X, y, groups, feature_names, k=5):
    """模型诊断工具，找出排序效果最差的查询。"""
    preds = model.predict(X)
    query_scores = []
    offset = 0
    for qid, n_docs in enumerate(groups):
        p = preds[offset:offset + n_docs]
        l = y[offset:offset + n_docs]
        order = np.argsort(-p)
        sorted_labs = l[order]
        dcg = sum((2**r - 1) / math.log2(i + 2) for i, r in enumerate(sorted_labs[:k]))
        idcg = sum((2**r - 1) / math.log2(i + 2) for i, r in enumerate(sorted(l, reverse=True)[:k]))
        ndcg = dcg / idcg if idcg > 0 else 0
        query_scores.append((qid, ndcg, X[offset:offset + n_docs], l))
        offset += n_docs

    # 找出最差的查询
    worst = sorted(query_scores, key=lambda x: x[1])[:10]
    for qid, ndcg, feats, labs in worst:
        print(f"查询 {qid}: NDCG@{k}={ndcg:.4f}, 文档数={len(labs)}, 标签分布={np.bincount(labs.astype(int))}")
```

**要点**：诊断工具帮助发现模型的薄弱环节。常见问题包括：某些查询类型的特征缺失、标注数据集中在头部查询导致长尾效果差等。
