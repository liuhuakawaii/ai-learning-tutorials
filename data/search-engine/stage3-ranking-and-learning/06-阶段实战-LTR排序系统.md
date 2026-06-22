# 阶段实战：构建完整的 LTR 排序系统

## 场景引入

前五课我们分别学习了排序基础、Learning-to-Rank、特征工程、点击模型和个性化排序。本课将这些知识整合，构建一个端到端的 LTR 排序系统：从原始数据出发，完成特征提取、模型训练、在线预测和效果评估的全流程。

在工业界，一个完整的 LTR 系统通常包含以下组件：

1. **数据层**：文档库、查询日志、人工标注
2. **特征层**：特征提取 Pipeline、特征缓存、特征监控
3. **模型层**：模型训练、超参调优、模型版本管理
4. **服务层**：在线预测、A/B 测试框架
5. **评估层**：离线指标、在线指标、人工评估

本课将逐步构建这些组件，最终形成一个可运行的 LTR 排序系统。

## 学习目标

1. 设计并实现完整的 LTR 排序 Pipeline
2. 从零构建训练数据集（特征提取 + 标签生成）
3. 训练和调优 LambdaMART 排序模型
4. 实现在线预测服务和完整评估体系
5. 理解模型保存、加载和增量更新

## 1. 数据准备

数据是 LTR 系统的基础。我们需要三类数据：文档库（候选文档）、查询集（用户查询）和标注数据（查询-文档相关性）。

```python
import random, math, time
import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Tuple
from collections import defaultdict

random.seed(42); np.random.seed(42)


@dataclass
class Document:
    doc_id: str; title: str; body: str; url: str
    page_rank: float; publish_time_days_ago: float
    domain_authority: float; content_quality: float; category: str


@dataclass
class QueryRecord:
    query_id: str; query_text: str; query_type: str; frequency: int


@dataclass
class Annotation:
    query_id: str; doc_id: str; relevance: int  # 0-4


def build_corpus(n=500):
    """构建模拟文档库。"""
    categories = ["科技", "购物", "美食", "旅行", "健康"]
    templates = {
        "科技": [("Python 编程入门教程", "Python 是一门简洁优雅的编程语言..."),
                 ("机器学习实战指南", "本文从实际案例出发讲解核心算法..."),
                 ("深度学习框架对比", "TensorFlow、PyTorch、JAX 各有优劣...")],
        "购物": [("蓝牙耳机推荐 2024", "经过实测对比以下几款性价比最高..."),
                 ("机械键盘选购指南", "不同轴体手感差异很大...")],
        "美食": [("红烧肉的家常做法", "选五花肉切块先煸炒上色再慢炖..."),
                 ("减脂餐食谱大全", "高蛋白低脂肪的一周食谱...")],
    }
    docs = []
    for i in range(n):
        cat = random.choice(categories)
        t_list = templates.get(cat, templates["科技"])
        title, body = random.choice(t_list)
        docs.append(Document(f"doc_{i}", f"{title}({i})", body, f"https://example.com/{cat}/{i}",
                             random.uniform(1, 9), random.uniform(0, 365),
                             random.uniform(3, 9), random.uniform(0.3, 1.0), cat))
    return docs


def build_queries(n=100):
    """构建模拟查询集。"""
    pool = [("Python 教程", "informational"), ("机器学习入门", "informational"),
            ("买蓝牙耳机", "transactional"), ("红烧肉做法", "informational"),
            ("旅游攻略", "informational"), ("机械键盘推荐", "transactional")]
    return [QueryRecord(f"q_{i}", *random.choice(pool), random.randint(10, 10000))
            for i in range(n)]


def build_annotations(queries, docs, n=3000):
    """构建模拟标注数据。

    标注逻辑：查询词与文档标题重叠越多，相关性越高。
    高质量文档获得额外加成。
    """
    anns = []
    for _ in range(n):
        q, d = random.choice(queries), random.choice(docs)
        overlap = len(set(q.query_text.lower().split()) & set(d.title.lower().split()))
        rel = {0: random.choice([0,0,0,1]), 1: random.choice([1,2,3]),
               2: random.choice([3,4])}.get(min(overlap, 2), 0)
        if d.content_quality > 0.8: rel = min(rel + 1, 4)
        anns.append(Annotation(q.query_id, d.doc_id, rel))
    return anns
```

### 1.1 数据质量检查

```python
def check_data_quality(queries, docs, annotations):
    """检查数据质量，返回问题列表。"""
    issues = []

    # 检查标注分布
    rel_dist = defaultdict(int)
    for a in annotations:
        rel_dist[a.relevance] += 1
    total = len(annotations)
    if rel_dist[0] / total > 0.8:
        issues.append(f"标注严重不均衡：{rel_dist[0]/total:.1%} 标签为 0")

    # 检查查询覆盖
    annotated_queries = set(a.query_id for a in annotations)
    all_queries = set(q.query_id for q in queries)
    uncovered = all_queries - annotated_queries
    if uncovered:
        issues.append(f"有 {len(uncovered)} 个查询没有标注数据")

    # 检查文档覆盖
    annotated_docs = set(a.doc_id for a in annotations)
    all_docs = set(d.doc_id for d in docs)
    uncovered_docs = all_docs - annotated_docs
    if uncovered_docs:
        issues.append(f"有 {len(uncovered_docs)} 个文档没有标注数据")

    # 检查每个查询的标注数量
    q_ann_counts = defaultdict(int)
    for a in annotations:
        q_ann_counts[a.query_id] += 1
    single_doc_queries = sum(1 for c in q_ann_counts.values() if c < 2)
    if single_doc_queries > 0:
        issues.append(f"有 {single_doc_queries} 个查询只有 1 个标注文档")

    return issues
```

## 2. 特征提取

```python
class LTRFeatureExtractor:
    """LTR 特征提取器。

    包含 15 个特征：查询特征、文档特征、交互特征。
    """

    NAMES = ["query_term_count", "query_log_freq", "query_is_info", "query_is_trans",
             "doc_page_rank", "doc_body_len_log", "doc_freshness", "doc_domain_auth",
             "doc_quality", "title_coverage", "body_coverage", "query_in_title",
             "bm25_score", "title_jaccard", "query_freq_in_body"]

    def extract(self, q: QueryRecord, d: Document) -> np.ndarray:
        """提取单个 (查询, 文档) 对的特征。"""
        qt = set(q.query_text.lower().split())
        tt = set(d.title.lower().split())
        bt = d.body.lower().split()
        bs = set(bt)
        return np.array([
            len(q.query_text.split()), math.log1p(q.frequency),
            1.0 if q.query_type == "informational" else 0.0,
            1.0 if q.query_type == "transactional" else 0.0,
            d.page_rank, math.log1p(len(bt)),
            math.exp(-0.023 * d.publish_time_days_ago),
            d.domain_authority, d.content_quality,
            len(qt & tt) / len(qt) if qt else 0,
            len(qt & bs) / len(qt) if qt else 0,
            1.0 if q.query_text.lower() in d.title.lower() else 0.0,
            self._bm25(qt, bt),
            len(qt & tt) / len(qt | tt) if (qt | tt) else 0,
            sum(defaultdict(int, {t: c for t, c in
                 ((w, bt.count(w)) for w in bt)}).get(t, 0) for t in qt),
        ], dtype=np.float32)

    def extract_batch(self, pairs):
        """批量提取特征。"""
        return np.array([self.extract(q, d) for q, d in pairs])

    def _bm25(self, qt, bt, k1=1.2, b=0.75):
        """计算 BM25 分数。"""
        dl, cnt = len(bt), defaultdict(int)
        for w in bt: cnt[w] += 1
        return sum(math.log(1000/(1+cnt[t])) * (cnt[t]*(k1+1)) /
                   (cnt[t]+k1*(1-b+b*dl/200)) for t in qt if cnt[t] > 0)
```

### 2.1 特征统计分析

```python
def analyze_features(X, feature_names):
    """分析特征的统计分布。"""
    print(f"{'特征名':35s} {'均值':>8s} {'标准差':>8s} {'最小值':>8s} {'最大值':>8s} {'缺失率':>8s}")
    print("-" * 85)
    for i, name in enumerate(feature_names):
        col = X[:, i]
        missing = np.sum(np.isnan(col)) / len(col)
        valid = col[~np.isnan(col)]
        if len(valid) > 0:
            print(f"{name:35s} {np.mean(valid):8.4f} {np.std(valid):8.4f} "
                  f"{np.min(valid):8.4f} {np.max(valid):8.4f} {missing:8.2%}")
```

## 3. 训练数据构建

```python
import lightgbm as lgb


def build_dataset(queries, docs, annotations, extractor, test_ratio=0.3):
    """构建训练和测试数据集。

    按查询划分训练集和测试集，避免数据泄露。
    """
    q_map = {q.query_id: q for q in queries}
    d_map = {d.doc_id: d for d in docs}
    q_anns = defaultdict(list)
    for a in annotations:
        if a.query_id in q_map and a.doc_id in d_map:
            q_anns[a.query_id].append(a)

    qids = list(q_anns.keys())
    random.shuffle(qids)
    split = int(len(qids) * (1 - test_ratio))
    train_qids, test_qids = set(qids[:split]), set(qids[split:])

    def process(qids_set):
        X, y, g, pairs = [], [], [], []
        for qid in qids_set:
            q, anns = q_map[qid], q_anns[qid]
            for a in anns:
                d = d_map[a.doc_id]
                X.append(extractor.extract(q, d))
                y.append(a.relevance)
                pairs.append((q, d))
            g.append(len(anns))
        return np.array(X), np.array(y), g, pairs

    X_tr, y_tr, g_tr, _ = process(train_qids)
    X_te, y_te, g_te, te_pairs = process(test_qids)
    return X_tr, y_tr, g_tr, X_te, y_te, g_te, te_pairs
```

### 3.1 数据泄露检查

```python
def check_data_leakage(train_qids, test_qids):
    """检查训练集和测试集是否存在数据泄露。"""
    overlap = train_qids & test_qids
    if overlap:
        print(f"警告：训练集和测试集有 {len(overlap)} 个查询重叠！")
        return True
    print("数据泄露检查通过：训练集和测试集无重叠查询。")
    return False
```

## 4. 模型训练

```python
def train_model(X_tr, y_tr, g_tr, X_va, y_va, g_va):
    """训练 LambdaMART 模型。"""
    tr_set = lgb.Dataset(X_tr, label=y_tr, group=g_tr)
    va_set = lgb.Dataset(X_va, label=y_va, group=g_va, reference=tr_set)
    params = {"objective": "lambdarank", "metric": "ndcg", "ndcg_eval_at": [5, 10],
              "learning_rate": 0.05, "num_leaves": 31, "min_data_in_leaf": 20,
              "feature_fraction": 0.8, "verbose": -1}
    return lgb.train(params, tr_set, num_boost_round=300, valid_sets=[va_set],
                     callbacks=[lgb.early_stopping(30), lgb.log_evaluation(50)])
```

### 4.1 超参调优

```python
def tune_hyperparameters(X_tr, y_tr, g_tr, X_va, y_va, g_va, n_trials=50):
    """用 Optuna 进行超参调优。"""
    import optuna

    tr_set = lgb.Dataset(X_tr, label=y_tr, group=g_tr)
    va_set = lgb.Dataset(X_va, label=y_va, group=g_va, reference=tr_set)

    def objective(trial):
        params = {
            "objective": "lambdarank", "metric": "ndcg", "ndcg_eval_at": [10],
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
            "num_leaves": trial.suggest_int("num_leaves", 15, 127),
            "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 10, 100),
            "feature_fraction": trial.suggest_float("feature_fraction", 0.5, 1.0),
            "verbose": -1,
        }
        m = lgb.train(params, tr_set, num_boost_round=200, valid_sets=[va_set],
                      callbacks=[lgb.early_stopping(20), lgb.log_evaluation(0)])
        return m.best_score["valid_0"]["ndcg@10"]

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials)
    print(f"最优 NDCG@10: {study.best_value:.4f}")
    print(f"最优参数: {study.best_params}")
    return study.best_params
```

## 5. 评估体系

```python
def evaluate(model, X, y, groups, ks=(1, 3, 5, 10)):
    """评估排序模型，计算多个指标。"""
    preds = model.predict(X)
    metrics = {f"ndcg@{k}": [] for k in ks}
    metrics["mrr"] = []
    offset = 0
    for n in groups:
        p, l = preds[offset:offset+n], y[offset:offset+n]
        order = np.argsort(-p)
        sl = l[order]
        for k in ks:
            dcg = sum((2**r-1)/math.log2(i+2) for i, r in enumerate(sl[:k]))
            idcg = sum((2**r-1)/math.log2(i+2) for i, r in enumerate(sorted(l, reverse=True)[:k]))
            metrics[f"ndcg@{k}"].append(dcg/idcg if idcg > 0 else 0)
        mrr_rank = next((i+1 for i, idx in enumerate(order) if l[idx] >= 2), None)
        metrics["mrr"].append(1/mrr_rank if mrr_rank else 0)
        offset += n
    return {k: np.mean(v) for k, v in metrics.items()}
```

### 5.1 详细评估报告

```python
def detailed_evaluation(model, X, y, groups, feature_names):
    """生成详细的评估报告，包含特征重要性和查询级别分析。"""
    metrics = evaluate(model, X, y, groups)

    print("=" * 60)
    print("排序模型评估报告")
    print("=" * 60)

    print("\n整体指标:")
    for m, v in metrics.items():
        print(f"  {m}: {v:.4f}")

    print("\n特征重要性 Top 10:")
    imp = model.feature_importance(importance_type="gain")
    for rank, i in enumerate(np.argsort(-imp)[:10], 1):
        bar = "█" * int(imp[i] / imp[np.argsort(-imp)[0]] * 30)
        print(f"  {rank:2d}. {feature_names[i]:35s} {imp[i]:8.1f} {bar}")

    # 查询级别分析
    preds = model.predict(X)
    query_ndcg = []
    offset = 0
    for n in groups:
        p = preds[offset:offset+n]
        l = y[offset:offset+n]
        order = np.argsort(-p)
        sl = l[order]
        dcg = sum((2**r-1)/math.log2(i+2) for i, r in enumerate(sl[:5]))
        idcg = sum((2**r-1)/math.log2(i+2) for i, r in enumerate(sorted(l, reverse=True)[:5]))
        query_ndcg.append(dcg/idcg if idcg > 0 else 0)
        offset += n

    print(f"\n查询级别 NDCG@5 分布:")
    print(f"  最小值: {np.min(query_ndcg):.4f}")
    print(f"  25%: {np.percentile(query_ndcg, 25):.4f}")
    print(f"  中位数: {np.median(query_ndcg):.4f}")
    print(f"  75%: {np.percentile(query_ndcg, 75):.4f}")
    print(f"  最大值: {np.max(query_ndcg):.4f}")

    return metrics
```

### 5.3 指标解读

| 指标 | 含义 | 解读 |
|------|------|------|
| NDCG@1 | 第一位结果的质量 | 反映"首条点击率" |
| NDCG@5 | 前 5 位结果的整体质量 | 反映"首屏排序质量" |
| NDCG@10 | 前 10 位结果的整体质量 | 反映"首页排序质量" |
| MRR | 第一个相关结果的排名倒数 | 反映"找到结果的速度" |

## 6. 在线预测服务

```python
class OnlineRanker:
    """在线排序服务。"""

    def __init__(self, model, extractor, docs):
        self.model = model
        self.extractor = extractor
        self.doc_map = {d.doc_id: d for d in docs}

    def rank(self, query, candidate_ids, top_k=10):
        """对候选文档进行排序。

        Args:
            query: 查询记录
            candidate_ids: 候选文档 ID 列表
            top_k: 返回前 top_k 个结果

        Returns:
            按分数降序排列的 (doc_id, score) 列表
        """
        pairs, valid = [], []
        for did in candidate_ids:
            doc = self.doc_map.get(did)
            if doc:
                pairs.append((query, doc))
                valid.append(did)
        if not pairs:
            return []
        scores = self.model.predict(self.extractor.extract_batch(pairs))
        results = sorted(zip(valid, scores), key=lambda x: -x[1])
        return results[:top_k]

    def rank_with_debug(self, query, candidate_ids, top_k=10):
        """带调试信息的排序，输出每个文档的特征值。"""
        pairs, valid = [], []
        for did in candidate_ids:
            doc = self.doc_map.get(did)
            if doc:
                pairs.append((query, doc))
                valid.append(did)
        if not pairs:
            return [], []

        features = self.extractor.extract_batch(pairs)
        scores = self.model.predict(features)

        debug_info = []
        for i, (did, score) in enumerate(zip(valid, scores)):
            doc = self.doc_map[did]
            feat_dict = dict(zip(self.extractor.NAMES, features[i]))
            debug_info.append({
                "doc_id": did,
                "title": doc.title[:30],
                "score": score,
                "features": feat_dict,
            })

        debug_info.sort(key=lambda x: -x["score"])
        return debug_info[:top_k], features
```

## 7. 完整运行

```python
def main():
    """LTR 排序系统完整流程。"""
    print("=" * 50)
    print("LTR 排序系统 - 完整流程")
    print("=" * 50)

    # 1. 数据准备
    docs = build_corpus(500)
    queries = build_queries(100)
    anns = build_annotations(queries, docs, 3000)
    print(f"文档={len(docs)}, 查询={len(queries)}, 标注={len(anns)}")

    # 2. 数据质量检查
    issues = check_data_quality(queries, docs, anns)
    if issues:
        print("数据质量问题:")
        for issue in issues:
            print(f"  - {issue}")

    # 3. 特征提取
    ext = LTRFeatureExtractor()
    X_tr, y_tr, g_tr, X_te, y_te, g_te, te_pairs = build_dataset(queries, docs, anns, ext)
    print(f"训练={X_tr.shape[0]}样本/{len(g_tr)}组, 测试={X_te.shape[0]}样本/{len(g_te)}组")

    # 4. 特征分析
    analyze_features(X_tr, ext.NAMES)

    # 5. 模型训练
    model = train_model(X_tr, y_tr, g_tr, X_te, y_te, g_te)

    # 6. 评估
    metrics = detailed_evaluation(model, X_te, y_te, g_te, ext.NAMES)

    # 7. 在线预测示例
    ranker = OnlineRanker(model, ext, docs)
    demo_q = QueryRecord("demo", "Python 教程", "informational", 5000)
    results = ranker.rank(demo_q, [d.doc_id for d in docs[:20]], 5)
    print(f"\n查询: 'Python 教程' Top 5:")
    for r, (did, s) in enumerate(results, 1):
        print(f"  {r}. [{did}] {ranker.doc_map[did].title[:30]}... ({s:.4f})")

    return model, ranker, metrics


main()
```

## 8. 模型保存与加载

```python
def save_model(model, extractor, prefix="ltr_model"):
    """保存模型和配置。"""
    model.save_model(f"{prefix}.txt")
    import json
    with open(f"{prefix}_config.json", "w") as f:
        json.dump({"feature_names": extractor.NAMES, "n_features": len(extractor.NAMES)}, f)
    print(f"模型已保存: {prefix}.txt")


def load_model(prefix="ltr_model"):
    """加载模型和配置。"""
    model = lgb.Booster(model_file=f"{prefix}.txt")
    print(f"模型已加载")
    return model, LTRFeatureExtractor()
```

### 8.1 模型版本管理

```python
class ModelVersionManager:
    """模型版本管理器。"""

    def __init__(self, base_dir="models"):
        self.base_dir = base_dir
        self.versions = {}

    def save_version(self, model, extractor, version, metrics):
        """保存一个模型版本。"""
        import os, json
        version_dir = os.path.join(self.base_dir, version)
        os.makedirs(version_dir, exist_ok=True)

        model.save_model(os.path.join(version_dir, "model.txt"))
        with open(os.path.join(version_dir, "config.json"), "w") as f:
            json.dump({
                "feature_names": extractor.NAMES,
                "metrics": metrics,
                "timestamp": time.time(),
            }, f)

        self.versions[version] = {"metrics": metrics, "timestamp": time.time()}
        print(f"模型版本 {version} 已保存")

    def load_version(self, version):
        """加载指定版本的模型。"""
        import os
        version_dir = os.path.join(self.base_dir, version)
        model = lgb.Booster(model_file=os.path.join(version_dir, "model.txt"))
        return model

    def list_versions(self):
        """列出所有版本。"""
        for v, info in sorted(self.versions.items()):
            print(f"  {v}: NDCG@10={info['metrics'].get('ndcg@10', 'N/A'):.4f}")
```

## 9. 常见误区

1. **数据泄露**：测试集查询不能出现在训练集，否则评估虚高
2. **特征穿越**：使用线上无法获取的特征，离线好线上差
3. **过度调参**：在测试集上反复调参会过拟合，应划分独立验证集
4. **忽视头部偏差**：标注数据集中在头部查询，长尾效果可能很差
5. **不做数据质量检查**：脏数据会直接影响模型效果
6. **只看平均指标**：平均 NDCG 可能掩盖某些查询类型的严重退化

## 10. 工程建议

1. **数据质量优先**：标注质量比数量更重要
2. **特征工程迭代**：每次新增特征后重新评估，确认带来提升
3. **模型版本管理**：保存模型配置、特征列表、训练数据快照
4. **渐进式上线**：新模型先小流量验证，逐步扩大到全量
5. **持续监控**：线上模型效果会衰退，需定期重训练
6. **建立回滚机制**：新模型效果下降时能快速回滚到上一版本

## 小结

本课完成了 LTR 排序系统的端到端构建：数据层（文档库 + 查询集 + 标注）、特征层（15 维特征）、模型层（LambdaMART）、服务层（在线预测）。这是搜索排序阶段的终点，也是实际工程应用的起点。

## 练习

### 练习一：扩展特征集

在 15 个特征基础上新增至少 5 个特征，重新训练，观察 NDCG 变化。

### 练习二：超参调优

使用 Optuna 对 `num_leaves`、`learning_rate`、`min_data_in_leaf`、`feature_fraction` 进行调优。

### 练习三：增量训练

模拟线上场景：用新数据在已有模型上增量训练（`init_model`），与全量重训练对比。

### 练习四：排序结果可视化

实现一个排序结果可视化工具：给定查询，展示 Top-10 结果的标题、分数、特征值热力图，帮助理解排序决策。

### 练习五：A/B 测试框架

设计一个简单的 A/B 测试框架：将用户随机分组，分别使用旧模型和新模型排序，统计两组的点击率和满意度指标。

---

## 参考答案

### 练习一

**思路**：增加 URL 特征、组合特征和类别匹配特征。

```python
EXTENDED = NAMES + ["url_depth", "url_https", "title_length", "cat_match", "bm25_x_fresh"]

def extract_extended(self, q, d):
    """扩展特征提取，新增 5 个特征。"""
    base = self.extract(q, d)
    qt = set(q.query_text.lower().split())
    ext = [
        d.url.count("/") - 2,
        1.0 if d.url.startswith("https") else 0.0,
        len(d.title.split()),
        1.0 if any(k in q.query_text.lower() for k in
                   {"科技": ["python","编程"], "购物": ["买","推荐"]}.get(d.category, [])) else 0.0,
        self._bm25(qt, d.body.lower().split()) * math.exp(-0.023 * d.publish_time_days_ago),
    ]
    return np.concatenate([base, ext])
```

**要点**：组合特征捕获因子交互，新增后必须重新评估确认有效。不要盲目添加特征——每个新特征都应该有明确的业务含义。

### 练习二

**思路**：用 Optuna 贝叶斯优化，以 NDCG@10 为目标。

```python
import optuna

def objective(trial):
    params = {"objective": "lambdarank", "metric": "ndcg", "ndcg_eval_at": [10],
              "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
              "num_leaves": trial.suggest_int("num_leaves", 15, 127),
              "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 10, 100),
              "feature_fraction": trial.suggest_float("feature_fraction", 0.5, 1.0),
              "verbose": -1}
    m = lgb.train(params, tr_set, num_boost_round=200, valid_sets=[va_set],
                  callbacks=[lgb.early_stopping(20), lgb.log_evaluation(0)])
    return m.best_score["valid_0"]["ndcg@10"]

study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=50)
print(f"最优: {study.best_value:.4f}, 参数: {study.best_params}")
```

**要点**：至少 50 次试验，记录每次参数和结果便于分析敏感性。注意不要在测试集上调参——应该用验证集调参，测试集只用于最终评估。

### 练习三

**思路**：设置 `init_model` 参数从旧模型继续训练，用更小学习率。

```python
def incremental_train(old_model, X_new, y_new, g_new, X_va, y_va, g_va):
    """增量训练：在旧模型基础上用新数据继续训练。"""
    new_set = lgb.Dataset(X_new, label=y_new, group=g_new)
    va_set = lgb.Dataset(X_va, label=y_va, group=g_va, reference=new_set)
    params = {"objective": "lambdarank", "metric": "ndcg", "ndcg_eval_at": [10],
              "learning_rate": 0.02, "num_leaves": 31, "verbose": -1}
    return lgb.train(params, new_set, num_boost_round=100, init_model=old_model,
                     valid_sets=[va_set], callbacks=[lgb.early_stopping(20), lgb.log_evaluation(20)])
```

**要点**：增量训练用更小学习率防止覆盖旧知识，全量重训练通常效果更好但更慢。实际工程中通常每周全量重训练，每天增量更新。

### 练习四

**思路**：用表格展示排序结果和特征值。

```python
def visualize_ranking(ranker, query, candidate_ids, feature_names):
    """可视化排序结果。"""
    debug_results, features = ranker.rank_with_debug(query, candidate_ids, 10)

    print(f"查询: {query.query_text}")
    print("=" * 80)
    for rank, info in enumerate(debug_results, 1):
        print(f"\n#{rank} [{info['doc_id']}] {info['title']}... (分数: {info['score']:.4f})")
        # 显示 Top 5 特征
        sorted_feats = sorted(info["features"].items(), key=lambda x: -abs(x[1]))
        for fname, fval in sorted_feats[:5]:
            bar_len = int(abs(fval) * 10)
            bar = "+" * bar_len if fval > 0 else "-" * bar_len
            print(f"  {fname:30s} = {fval:8.4f}  {bar}")
```

**要点**：可视化工具对调试排序问题至关重要。当用户投诉排序结果时，可以通过可视化快速定位哪个特征导致了异常排序。

### 练习五

**思路**：将用户随机分组，分别使用不同模型排序。

```python
class ABTestFramework:
    """简单的 A/B 测试框架。"""

    def __init__(self):
        self.groups = {}
        self.metrics = defaultdict(lambda: defaultdict(list))

    def assign_group(self, user_id, n_groups=2):
        """将用户随机分配到实验组。"""
        if user_id not in self.groups:
            self.groups[user_id] = hash(user_id) % n_groups
        return self.groups[user_id]

    def record_metric(self, user_id, metric_name, value):
        """记录用户指标。"""
        group = self.groups.get(user_id, 0)
        self.metrics[group][metric_name].append(value)

    def analyze(self):
        """分析实验结果。"""
        print("A/B 测试结果:")
        for group in sorted(self.metrics.keys()):
            print(f"\n  组 {group}:")
            for metric, values in self.metrics[group].items():
                print(f"    {metric}: 均值={np.mean(values):.4f}, 样本数={len(values)}")

    def significance_test(self, metric_name):
        """对指定指标进行显著性检验。"""
        from scipy import stats
        groups = sorted(self.metrics.keys())
        if len(groups) < 2:
            return
        a = self.metrics[groups[0]][metric_name]
        b = self.metrics[groups[1]][metric_name]
        t_stat, p_value = stats.ttest_ind(a, b)
        print(f"\n{metric_name} 显著性检验:")
        print(f"  t-statistic: {t_stat:.4f}")
        print(f"  p-value: {p_value:.4f}")
        print(f"  显著: {'是' if p_value < 0.05 else '否'}")
```

**要点**：A/B 测试是验证排序模型效果的金标准。要注意样本量足够大、实验时间足够长、排除季节性因素。统计显著性（p < 0.05）是判断实验结果可靠性的基本标准。
