# 阶段实战：构建 LTR 排序系统

前五课我们分别学习了排序基础、Learning-to-Rank、特征工程、点击模型和个性化排序。这节课把它们整合成一个端到端的 LTR 排序系统：从原始数据出发，完成特征提取、模型训练、在线预测和效果评估的全流程。

## 数据准备

LTR 系统需要三类数据：文档库、查询集和标注数据。

```python
import random, math, time
import numpy as np
from dataclasses import dataclass
from collections import defaultdict

random.seed(42)
np.random.seed(42)


@dataclass
class Document:
    doc_id: str
    title: str
    body: str
    url: str
    page_rank: float
    publish_time_days_ago: float
    domain_authority: float
    content_quality: float
    category: str


@dataclass
class QueryRecord:
    query_id: str
    query_text: str
    query_type: str
    frequency: int


@dataclass
class Annotation:
    query_id: str
    doc_id: str
    relevance: int  # 0-4


def build_corpus(n=500):
    categories = ["科技", "购物", "美食", "旅行", "健康"]
    templates = {
        "科技": [("Python 编程入门教程", "Python 是一门简洁优雅的编程语言..."),
                 ("机器学习实战指南", "本文从实际案例出发讲解核心算法...")],
        "购物": [("蓝牙耳机推荐 2024", "经过实测对比以下几款性价比最高..."),
                 ("机械键盘选购指南", "不同轴体手感差异很大...")],
        "美食": [("红烧肉的家常做法", "选五花肉切块先煸炒上色再慢炖...")],
    }
    docs = []
    for i in range(n):
        cat = random.choice(categories)
        t_list = templates.get(cat, templates["科技"])
        title, body = random.choice(t_list)
        docs.append(Document(f"doc_{i}", f"{title}({i})", body,
                             f"https://example.com/{cat}/{i}",
                             random.uniform(1, 9), random.uniform(0, 365),
                             random.uniform(3, 9), random.uniform(0.3, 1.0), cat))
    return docs


def build_queries(n=100):
    pool = [("Python 教程", "informational"), ("机器学习入门", "informational"),
            ("买蓝牙耳机", "transactional"), ("红烧肉做法", "informational")]
    return [QueryRecord(f"q_{i}", *random.choice(pool), random.randint(10, 10000))
            for i in range(n)]


def build_annotations(queries, docs, n=3000):
    anns = []
    for _ in range(n):
        q, d = random.choice(queries), random.choice(docs)
        overlap = len(set(q.query_text.lower().split()) &
                      set(d.title.lower().split()))
        rel = {0: random.choice([0,0,0,1]), 1: random.choice([1,2,3]),
               2: random.choice([3,4])}.get(min(overlap, 2), 0)
        if d.content_quality > 0.8:
            rel = min(rel + 1, 4)
        anns.append(Annotation(q.query_id, d.doc_id, rel))
    return anns
```

### 数据质量检查

```python
def check_data_quality(queries, docs, annotations):
    issues = []
    rel_dist = defaultdict(int)
    for a in annotations:
        rel_dist[a.relevance] += 1
    total = len(annotations)
    if rel_dist[0] / total > 0.8:
        issues.append(f"标注严重不均衡：{rel_dist[0]/total:.1%} 标签为 0")
    annotated_queries = set(a.query_id for a in annotations)
    uncovered = set(q.query_id for q in queries) - annotated_queries
    if uncovered:
        issues.append(f"有 {len(uncovered)} 个查询没有标注数据")
    return issues
```

## 特征提取

15 维特征覆盖查询特征、文档特征和交互特征：

```python
class LTRFeatureExtractor:
    NAMES = [
        "query_term_count", "query_log_freq", "query_is_info", "query_is_trans",
        "doc_page_rank", "doc_body_len_log", "doc_freshness", "doc_domain_auth",
        "doc_quality", "title_coverage", "body_coverage", "query_in_title",
        "bm25_score", "title_jaccard", "query_freq_in_body",
    ]

    def extract(self, q: QueryRecord, d: Document) -> np.ndarray:
        qt = set(q.query_text.lower().split())
        tt = set(d.title.lower().split())
        bt = d.body.lower().split()
        bs = set(bt)
        return np.array([
            len(q.query_text.split()),
            math.log1p(q.frequency),
            1.0 if q.query_type == "informational" else 0.0,
            1.0 if q.query_type == "transactional" else 0.0,
            d.page_rank,
            math.log1p(len(bt)),
            math.exp(-0.023 * d.publish_time_days_ago),
            d.domain_authority,
            d.content_quality,
            len(qt & tt) / len(qt) if qt else 0,
            len(qt & bs) / len(qt) if qt else 0,
            1.0 if q.query_text.lower() in d.title.lower() else 0.0,
            self._bm25(qt, bt),
            len(qt & tt) / len(qt | tt) if (qt | tt) else 0,
            sum(bt.count(t) for t in qt),
        ], dtype=np.float32)

    def extract_batch(self, pairs):
        return np.array([self.extract(q, d) for q, d in pairs])

    def _bm25(self, qt, bt, k1=1.2, b=0.75):
        dl, cnt = len(bt), defaultdict(int)
        for w in bt:
            cnt[w] += 1
        return sum(math.log(1000/(1+cnt[t])) * (cnt[t]*(k1+1)) /
                   (cnt[t]+k1*(1-b+b*dl/200)) for t in qt if cnt[t] > 0)
```

## 训练数据构建

按查询划分训练集和测试集，避免数据泄露——同一查询的标注不能同时出现在训练集和测试集。

```python
import lightgbm as lgb


def build_dataset(queries, docs, annotations, extractor, test_ratio=0.3):
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
        X, y, g = [], [], []
        for qid in qids_set:
            q, anns = q_map[qid], q_anns[qid]
            for a in anns:
                d = d_map[a.doc_id]
                X.append(extractor.extract(q, d))
                y.append(a.relevance)
            g.append(len(anns))
        return np.array(X), np.array(y), g

    X_tr, y_tr, g_tr = process(train_qids)
    X_te, y_te, g_te = process(test_qids)
    return X_tr, y_tr, g_tr, X_te, y_te, g_te
```

## 模型训练

LambdaMART 是 LTR 最常用的算法，基于梯度提升树，直接优化 NDCG。

```python
def train_model(X_tr, y_tr, g_tr, X_va, y_va, g_va):
    tr_set = lgb.Dataset(X_tr, label=y_tr, group=g_tr)
    va_set = lgb.Dataset(X_va, label=y_va, group=g_va, reference=tr_set)
    params = {
        "objective": "lambdarank", "metric": "ndcg",
        "ndcg_eval_at": [5, 10], "learning_rate": 0.05,
        "num_leaves": 31, "min_data_in_leaf": 20,
        "feature_fraction": 0.8, "verbose": -1,
    }
    return lgb.train(params, tr_set, num_boost_round=300,
                     valid_sets=[va_set],
                     callbacks=[lgb.early_stopping(30), lgb.log_evaluation(50)])
```

## 评估体系

```python
def evaluate(model, X, y, groups, ks=(1, 3, 5, 10)):
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
            idcg = sum((2**r-1)/math.log2(i+2)
                       for i, r in enumerate(sorted(l, reverse=True)[:k]))
            metrics[f"ndcg@{k}"].append(dcg/idcg if idcg > 0 else 0)
        mrr_rank = next((i+1 for i, idx in enumerate(order) if l[idx] >= 2), None)
        metrics["mrr"].append(1/mrr_rank if mrr_rank else 0)
        offset += n
    return {k: np.mean(v) for k, v in metrics.items()}
```

### 特征重要性分析

```python
def print_feature_importance(model, feature_names):
    imp = model.feature_importance(importance_type="gain")
    for rank, i in enumerate(np.argsort(-imp)[:10], 1):
        bar = "█" * int(imp[i] / imp[np.argsort(-imp)[0]] * 30)
        print(f"  {rank:2d}. {feature_names[i]:35s} {imp[i]:8.1f} {bar}")
```

## 在线预测

```python
class OnlineRanker:
    def __init__(self, model, extractor, docs):
        self.model = model
        self.extractor = extractor
        self.doc_map = {d.doc_id: d for d in docs}

    def rank(self, query, candidate_ids, top_k=10):
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
```

## 完整运行

```python
def main():
    docs = build_corpus(500)
    queries = build_queries(100)
    anns = build_annotations(queries, docs, 3000)
    print(f"文档={len(docs)}, 查询={len(queries)}, 标注={len(anns)}")

    issues = check_data_quality(queries, docs, anns)
    for issue in issues:
        print(f"  质量问题: {issue}")

    ext = LTRFeatureExtractor()
    X_tr, y_tr, g_tr, X_te, y_te, g_te = build_dataset(queries, docs, anns, ext)

    model = train_model(X_tr, y_tr, g_tr, X_te, y_te, g_te)
    metrics = evaluate(model, X_te, y_te, g_te)
    print(f"\n评估指标: {metrics}")

    print("\n特征重要性 Top 10:")
    print_feature_importance(model, ext.NAMES)

    ranker = OnlineRanker(model, ext, docs)
    demo_q = QueryRecord("demo", "Python 教程", "informational", 5000)
    results = ranker.rank(demo_q, [d.doc_id for d in docs[:20]], 5)
    print(f"\n查询 'Python 教程' Top 5:")
    for r, (did, s) in enumerate(results, 1):
        print(f"  {r}. {ranker.doc_map[did].title[:30]}... ({s:.4f})")

main()
```

## 常见误区

**数据泄露。** 测试集查询不能出现在训练集，否则评估虚高。

**特征穿越。** 使用线上无法获取的特征（如未来的点击数据），离线好线上差。

**过度调参。** 在测试集上反复调参会过拟合，应划分独立验证集。

**只看平均指标。** 平均 NDCG 可能掩盖某些查询类型的严重退化。

## 工程建议

- 数据质量优先：标注质量比数量更重要
- 特征工程迭代：每次新增特征后重新评估，确认带来提升
- 渐进式上线：新模型先小流量验证，逐步扩大到全量
- 持续监控：线上模型效果会衰退，需定期重训练

## 练习

### 练习一：扩展特征集

在 15 个特征基础上新增至少 5 个特征（如 URL 深度、标题长度、类别匹配），重新训练，观察 NDCG 变化。

### 练习二：超参调优

使用 Optuna 对 `num_leaves`、`learning_rate`、`min_data_in_leaf` 进行调优，以 NDCG@10 为目标。

```python
import optuna

def objective(trial):
    params = {
        "objective": "lambdarank", "metric": "ndcg", "ndcg_eval_at": [10],
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
        "num_leaves": trial.suggest_int("num_leaves", 15, 127),
        "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 10, 100),
        "verbose": -1,
    }
    m = lgb.train(params, tr_set, num_boost_round=200, valid_sets=[va_set],
                  callbacks=[lgb.early_stopping(20), lgb.log_evaluation(0)])
    return m.best_score["valid_0"]["ndcg@10"]

study = optuna.create_study(direction="maximize")
study.optimize(objective, n_trials=50)
```

### 练习三：增量训练

模拟线上场景：用新数据在已有模型上增量训练（`init_model` 参数），与全量重训练对比。

## 参考答案

### 练习一

```python
EXTENDED_NAMES = LTRFeatureExtractor.NAMES + [
    "url_depth", "url_https", "title_length", "cat_match", "bm25_x_fresh"
]

def extract_extended(self, q, d):
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

组合特征捕获因子交互，新增后必须重新评估确认有效。

### 练习三

```python
def incremental_train(old_model, X_new, y_new, g_new, X_va, y_va, g_va):
    new_set = lgb.Dataset(X_new, label=y_new, group=g_new)
    va_set = lgb.Dataset(X_va, label=y_va, group=g_va, reference=new_set)
    params = {"objective": "lambdarank", "metric": "ndcg", "ndcg_eval_at": [10],
              "learning_rate": 0.02, "num_leaves": 31, "verbose": -1}
    return lgb.train(params, new_set, num_boost_round=100, init_model=old_model,
                     valid_sets=[va_set],
                     callbacks=[lgb.early_stopping(20), lgb.log_evaluation(20)])
```

增量训练用更小学习率防止覆盖旧知识。实际工程中通常每周全量重训练，每天增量更新。
