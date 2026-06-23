# TF-IDF 模型与 BM25

用户搜索"无线蓝牙耳机"，系统需要从百万商品中找到最相关的。"的""是""有"这些词几乎出现在所有商品中，如果简单计数，这些无意义的词反而会干扰排序。我们需要一种方法：奖励"出现次数多"的词，同时惩罚"到处都出现"的词。

这就是 TF-IDF 的核心直觉。BM25 在此基础上做了工业级改进，至今仍是 Elasticsearch 的默认排序算法。

## TF：词在文档内出现的频率

一个词在文档中出现越多，该文档与这个词的相关性越强。三种变体：

| 变体 | 公式 | 适用场景 |
|------|------|----------|
| 原始计数 | count | 二值检索 |
| 归一化 | count / 文档总词数 | 通用文本检索 |
| 对数缩放 | log(1 + count) | 长文档、重复词多的场景 |

```python
import math
from collections import Counter

def compute_tf(documents: list[list[str]]) -> list[dict[str, float]]:
    results = []
    for doc in documents:
        word_counts = Counter(doc)
        total_words = len(doc)
        tf = {}
        for word, count in word_counts.items():
            tf[word] = {
                "raw": count,
                "normalized": count / total_words,
                "log": math.log(1 + count),
            }
        results.append(tf)
    return results
```

## IDF：词在整个语料库中的稀有程度

一个词出现在越少的文档中，它的区分能力越强。IDF 本质上衡量的是一个词携带的"信息量"——根据信息论，罕见事件携带更多信息。

```python
def compute_idf(documents: list[list[str]]) -> dict[str, float]:
    num_docs = len(documents)
    df = Counter()
    for doc in documents:
        for word in set(doc):
            df[word] += 1
    return {word: math.log((num_docs + 1) / (freq + 1)) + 1
            for word, freq in df.items()}
```

IDF 值取决于你索引的文档集合，不同语料库计算出的 IDF 完全不同。换领域时必须重新计算。

## 实验：TF-IDF 组合效果

```python
corpus = [
    ["无线", "蓝牙", "耳机", "降噪", "蓝牙", "连接"],
    ["有线", "耳机", "音质", "好"],
    ["蓝牙", "音箱", "低音", "蓝牙"],
]

idf = compute_idf(corpus)
tf_results = compute_tf(corpus)

for word in ["蓝牙", "耳机", "无线"]:
    print(f"IDF({word}) = {idf[word]:.3f}")
# IDF(蓝牙) = 1.288  出现在2个文档中
# IDF(耳机) = 1.000  出现在2个文档中
# IDF(无线) = 1.693  只出现在1个文档中，区分力最强
```

TF-IDF 高意味着：在当前文档中频繁出现（TF 高），同时在整个语料库中比较稀有（IDF 高）。这正是我们想要的——既与查询相关，又有区分度。

## BM25：TF-IDF 的工业级改进

BM25（1994 年，Robertson 等人）对 TF-IDF 做了两个关键改进：

**改进一：词频饱和。** 一个词出现 10 次和 100 次的差异不应是 10 倍。想象你读一篇关于"蓝牙"的文章——第一次看到，确信文章和蓝牙相关；到第十次和第十一次之间，信心几乎不会变化。这就是饱和：边际收益递减。

**改进二：文档长度归一化。** 长文档天然包含更多词，BM25 通过参数 `b` 控制文档长度的惩罚力度。

```python
class BM25:
    def __init__(self, corpus: list[list[str]], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.corpus = corpus
        self.doc_count = len(corpus)
        self.avgdl = sum(len(doc) for doc in corpus) / self.doc_count
        self.doc_lens = [len(doc) for doc in corpus]
        self.tf_per_doc = []
        self.doc_freqs = Counter()
        for doc in corpus:
            tf = Counter(doc)
            self.tf_per_doc.append(tf)
            for word in set(doc):
                self.doc_freqs[word] += 1

    def _idf(self, word: str) -> float:
        df = self.doc_freqs.get(word, 0)
        return math.log((self.doc_count - df + 0.5) / (df + 0.5) + 1)

    def _score_doc(self, query: list[str], doc_idx: int) -> float:
        score = 0.0
        tf = self.tf_per_doc[doc_idx]
        dl = self.doc_lens[doc_idx]
        for word in query:
            if word not in tf:
                continue
            tf_val = tf[word]
            idf_val = self._idf(word)
            num = tf_val * (self.k1 + 1)
            den = tf_val + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
            score += idf_val * (num / den)
        return score

    def search(self, query: list[str], top_k: int = 3) -> list[tuple[int, float]]:
        scores = [(i, self._score_doc(query, i)) for i in range(self.doc_count)]
        scores.sort(key=lambda x: -x[1])
        return scores[:top_k]
```

## 实验：BM25 参数敏感性

k1 控制词频饱和速度，b 控制文档长度惩罚力度。默认值 1.2/0.75 是良好的起点，但特定领域需要调整。

```python
def parameter_sweep(corpus, query, k1_values, b_values):
    for k1 in k1_values:
        for b in b_values:
            bm25 = BM25(corpus, k1=k1, b=b)
            results = bm25.search(list(query), top_k=len(corpus))
            ranking = [idx for idx, _ in results]
            print(f"k1={k1:.1f}, b={b:.2f}: 排序={ranking}")

product_corpus = [
    ["无线", "蓝牙", "耳机", "降噪", "蓝牙", "连接", "稳定", "蓝牙"],
    ["有线", "耳机", "音质", "清晰", "佩戴", "舒适"],
    ["蓝牙", "音箱", "低音", "震撼", "蓝牙", "连接"],
    ["降噪", "耳机", "头戴式", "蓝牙", "无线", "降噪", "效果", "好"],
]
parameter_sweep(product_corpus, ["蓝牙", "耳机"],
                k1_values=[0.5, 1.0, 1.5, 2.0],
                b_values=[0.0, 0.3, 0.75, 1.0])
```

观察：k1 越大词频影响越大，b 越大越惩罚长文档。短文本语料建议 k1=1.0~1.2, b=0.3~0.5。

## BM25 的 IDF 变体

不同实现采用不同的 IDF 公式：

```python
def idf_variants(N: int, df: int) -> dict[str, float]:
    return {
        "standard": math.log((N - df + 0.5) / (df + 0.5) + 1),      # Lucene/ES
        "probabilistic": math.log((N - df) / df) if df < N else 0,    # 原始 Robertson
        "smooth": math.log(1 + (N - df + 0.5) / (df + 0.5)),
        "normalized": math.log((N + 1) / (df + 1)),
    }
```

标准版（Lucene/ES 使用）在 df 接近 N 时仍然为正，概率版可能出现负值。

## 常见误区

**误以为 TF-IDF 需要复杂的库。** 核心公式仅需加减乘除和对数，从零实现不到 50 行。理解原理比调库更重要。

**直接用原始计数作为 TF。** 不做归一化会导致长文档天然占优。

**把 BM25 当作"过时的方法"。** BM25 在关键词匹配场景下依然极其有效，是很多混合检索系统的基础组件。在现代检索系统中，BM25 常作为第一阶段的召回，后续由更复杂的模型做精排。

**中文不分词直接用 TF-IDF。** 逐字切分会损失大量语义信息，必须使用分词工具预处理。

## 工程建议

- 预计算 IDF 并缓存：IDF 只依赖语料库全局统计，索引阶段计算一次，查询时直接查表
- 生产环境优先用 BM25：Elasticsearch、Whoosh 等搜索引擎内置 BM25，不必自己实现
- BM25 参数要基于评估数据调优：准备一组标注好的查询-文档对，用 NDCG 等指标自动搜索最优 k1 和 b

## 练习

### 练习一：BM25 vs TF-IDF 排序对比

在同一语料库上，分别用 TF-IDF 和 BM25 对同一组查询排序，计算两个排序之间的 Kendall Tau 距离。

```python
from itertools import combinations

def kendall_tau(ranking_a: list[int], ranking_b: list[int]) -> int:
    pos_a = {idx: i for i, idx in enumerate(ranking_a)}
    pos_b = {idx: i for i, idx in enumerate(ranking_b)}
    distance = 0
    for i, j in combinations(range(len(ranking_a)), 2):
        if (pos_a[i] - pos_a[j]) * (pos_b[i] - pos_b[j]) < 0:
            distance += 1
    return distance

# 你的任务：分别用 TF-IDF 和 BM25 排序，计算 tau 距离
```

### 练习二：构建迷你搜索引擎

给定 10 篇中文新闻标题，实现一个基于 BM25 的迷你搜索引擎：支持索引构建、查询输入、返回 Top-5 结果，输出每条结果的 BM25 分数。

### 练习三：字段加权 BM25

实现一个支持多字段加权的 BM25 检索系统。给定商品的标题、品牌、描述三个字段，分别计算 BM25 分数，然后用加权和作为最终分数。

```python
class FieldWeightedBM25:
    def __init__(self, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.field_models = {}

    def index(self, field_docs: dict[str, list[str]]):
        for field_name, docs in field_docs.items():
            self.field_models[field_name] = BM25([list(d) for d in docs],
                                                  k1=self.k1, b=self.b)

    def search(self, query: str, weights: dict[str, float],
               top_k=5) -> list[tuple[int, float]]:
        # 你的实现：对每个字段分别计算分数，加权求和
        ...
```

## 参考答案

### 练习一

```python
class TFIDFRanker:
    def __init__(self, corpus: list[list[str]]):
        self.corpus = corpus
        self.doc_count = len(corpus)
        self.idf = compute_idf(corpus)
        self.tf_results = compute_tf(corpus)

    def rank(self, query: list[str]) -> list[int]:
        scores = []
        for i in range(self.doc_count):
            score = sum(
                self.tf_results[i].get(w, {}).get("normalized", 0)
                * self.idf.get(w, 0) for w in query)
            scores.append((i, score))
        scores.sort(key=lambda x: -x[1])
        return [idx for idx, _ in scores]

# 使用
corpus = [["无线","蓝牙","耳机"],["有线","耳机","音质"],["蓝牙","音箱","低音"]]
tfidf_ranker = TFIDFRanker(corpus)
bm25_ranker = BM25(corpus)
query = ["蓝牙", "耳机"]

tfidf_order = tfidf_ranker.rank(query)
bm25_order = [idx for idx, _ in bm25_ranker.search(query, len(corpus))]
tau = kendall_tau(tfidf_order, bm25_order)
print(f"TF-IDF: {tfidf_order}, BM25: {bm25_order}, tau={tau}")
```

### 练习三

```python
class FieldWeightedBM25:
    def __init__(self, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.field_models = {}

    def index(self, field_docs: dict[str, list[str]]):
        for field_name, docs in field_docs.items():
            self.field_models[field_name] = BM25([list(d) for d in docs],
                                                  k1=self.k1, b=self.b)

    def search(self, query: str, weights: dict[str, float],
               top_k=5) -> list[tuple[int, float]]:
        query_tokens = list(query)
        doc_count = len(next(iter(self.field_models.values())).corpus)
        final_scores = []
        for doc_idx in range(doc_count):
            score = sum(
                weights.get(name, 0) * model._score_doc(query_tokens, doc_idx)
                for name, model in self.field_models.items())
            final_scores.append((doc_idx, score))
        final_scores.sort(key=lambda x: -x[1])
        return final_scores[:top_k]
```

标题权重通常最高（0.4~0.6），品牌在品牌搜索场景下应提高，描述权重适中（0.2~0.3）。最优值需要通过 A/B 测试确定。
