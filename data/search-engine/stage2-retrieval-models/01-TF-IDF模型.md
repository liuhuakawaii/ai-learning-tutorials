# TF-IDF 模型与 BM25

## 场景引入

假设你经营一个电商平台，用户搜索"无线蓝牙耳机"时，系统需要从百万商品中找到最相关的商品。最朴素的想法是：把查询词拆成"无线""蓝牙""耳机"三个词，看哪些商品标题或描述里包含这些词。

但问题马上来了——"的""是""有"这些词几乎出现在所有商品中，如果简单计数，这些无意义的词反而会干扰排序。我们需要一种方法，既能奖励"出现次数多"的词，又能惩罚"到处都出现"的词。这就是 TF-IDF 的核心直觉。

## 学习目标

1. 理解词频（TF）和逆文档频率（IDF）的直觉与数学定义
2. 掌握 TF-IDF 的组合公式及其变体
3. 理解 BM25 的核心改进思路及其参数含义
4. 能用 Python 从零实现 TF-IDF 评分和 BM25 评分
5. 了解 TF-IDF 的历史演变和在现代检索系统中的定位

## 历史背景：从手工规则到统计权重

在 TF-IDF 出现之前，早期的信息检索系统（1950s-1960s）依赖手工编写的规则来判断词的重要性。图书馆员和领域专家需要手动标注哪些词是"重要的"，哪些是"噪声"。这种方式成本高、不可扩展、无法适应不同领域。

1972 年，Karen Spärck Jones 正式提出了 IDF（Inverse Document Frequency）的概念，奠定了统计权重的基础。她的核心洞察是：**一个词的信息量与它出现的文档数量成反比**。这个思想源自信息论——罕见事件携带更多信息。TF-IDF 的组合则由 Gerald Salton 和 Christopher Buckley 在 1988 年的综述中系统化，成为信息检索领域的标准方法。

理解这段历史很重要：TF-IDF 不是某个天才的灵光一闪，而是二十多年实践中逐步演化出的最优工程折中——简单、有效、可解释。

## 词频 TF（Term Frequency）

词频衡量一个词在**单个文档**中出现的频率。直觉上，一个词在文档中出现越多，该文档与这个词的相关性越强。

最简单的定义是原始计数：

```
TF(t, d) = 词t在文档d中出现的次数
```

但原始计数有一个问题：长文档天然包含更多词，计数偏高。因此常用归一化版本：

```
TF(t, d) = 词t在文档d中出现的次数 / 文档d的总词数
```

还有一种对数缩放版本，用于抑制高频词的影响：

```
TF(t, d) = log(1 + 词t在文档d中出现的次数)
```

**三种 TF 定义的适用场景：**

| 变体 | 公式 | 适用场景 | 优缺点 |
|------|------|----------|--------|
| 原始计数 | count | 二值检索（出现/不出现） | 简单但偏爱长文档 |
| 归一化 | count/\|d\| | 通用文本检索 | 公平但对高频词无抑制 |
| 对数缩放 | log(1+count) | 长文档、重复词多的场景 | 抑制极端高频，但可能过度压缩 |

下面用 Python 实现这三种 TF 计算方式：

```python
import math
from collections import Counter

def compute_tf(documents: list[list[str]]) -> list[dict[str, float]]:
    """计算每个文档中每个词的三种TF值"""
    results = []
    for doc in documents:
        word_counts = Counter(doc)
        total_words = len(doc)
        tf = {}
        for word, count in word_counts.items():
            raw_tf = count
            normalized_tf = count / total_words
            log_tf = math.log(1 + count)
            tf[word] = {
                "raw": raw_tf,
                "normalized": normalized_tf,
                "log": log_tf,
            }
        results.append(tf)
    return results

corpus = [
    ["无线", "蓝牙", "耳机", "降噪", "蓝牙", "连接"],
    ["有线", "耳机", "音质", "好"],
    ["蓝牙", "音箱", "低音", "蓝牙"],
]

tf_results = compute_tf(corpus)
for i, tf in enumerate(tf_results):
    print(f"文档{i}: {tf['蓝牙']}")
# 文档0: {'raw': 2, 'normalized': 0.333, 'log': 1.099}
# 文档2: {'raw': 2, 'normalized': 0.5, 'log': 1.099}
```

## 逆文档频率 IDF（Inverse Document Frequency）

IDF 衡量一个词在**整个文档集合**中的稀有程度。一个词出现在越少的文档中，它的区分能力越强。

标准公式：

```
IDF(t) = log(总文档数 / 包含词t的文档数)
```

当某个词出现在所有文档中时，IDF = log(1) = 0，即完全无区分力。当某个词只出现在一个文档中时，IDF 最大。

**IDF 的信息论解释：** IDF 本质上衡量的是一个词携带的"信息量"。根据信息论，事件的信息量 = -log(P)。一个词出现在越少的文档中，它的出现概率越低，信息量越高。IDF 用文档频率的倒数来近似这个概率，再取对数得到信息量。

实际工程中常做平滑处理，避免分母为零：

```
IDF(t) = log((总文档数 + 1) / (包含词t的文档数 + 1)) + 1
```

```python
def compute_idf(documents: list[list[str]]) -> dict[str, float]:
    """计算语料库中每个词的IDF值"""
    num_docs = len(documents)
    df = Counter()  # document frequency
    for doc in documents:
        unique_words = set(doc)
        for word in unique_words:
            df[word] += 1

    idf = {}
    for word, freq in df.items():
        idf[word] = math.log((num_docs + 1) / (freq + 1)) + 1
    return idf

idf = compute_idf(corpus)
for word in ["蓝牙", "耳机", "无线"]:
    print(f"IDF({word}) = {idf[word]:.3f}")
# IDF(蓝牙) = 1.288  （出现在2个文档中）
# IDF(耳机) = 1.000  （出现在2个文档中）
# IDF(无线) = 1.693  （只出现在1个文档中，区分力最强）
```

## TF-IDF 组合

TF-IDF 将两者相乘，得到词对文档的相关性分数：

```
TF-IDF(t, d) = TF(t, d) × IDF(t)
```

一个词的 TF-IDF 高，意味着它在当前文档中频繁出现（TF 高），同时在整个语料库中又比较稀有（IDF 高）。这正是我们想要的：既与查询相关，又有区分度。

**TF-IDF 的直觉类比：** 想象你在一个班级里评价学生的"特殊才能"。如果一个学生会弹钢琴（稀有技能），这很突出；如果一个学生会呼吸（人人都会），这完全不突出。TF-IDF 做的就是同样的事——奖励"频繁且稀有"的特征，惩罚"频繁但普遍"的特征。

```python
def compute_tfidf(documents: list[list[str]]) -> list[dict[str, float]]:
    idf = compute_idf(documents)
    tf_results = compute_tf(documents)
    tfidf_results = []
    for tf in tf_results:
        tfidf = {}
        for word, tf_vals in tf.items():
            tfidf[word] = tf_vals["normalized"] * idf.get(word, 0)
        tfidf_results.append(tfidf)
    return tfidf_results

tfidf = compute_tfidf(corpus)
for i, scores in enumerate(tfidf):
    sorted_words = sorted(scores.items(), key=lambda x: -x[1])
    top3 = sorted_words[:3]
    print(f"文档{i} Top3: {top3}")
```

## 查询与文档的 TF-IDF 匹配

在实际检索中，TF-IDF 不仅用于表示文档，还用于计算查询与文档的相关性。具体做法是：对查询中的每个词，计算它在文档中的 TF-IDF 值，然后求和。

```python
def compute_query_doc_score(query: list[str], doc_idx: int,
                            tf_results: list[dict], idf: dict[str, float]) -> float:
    """计算查询与指定文档的TF-IDF匹配分数"""
    score = 0.0
    doc_tf = tf_results[doc_idx]
    for word in query:
        if word in doc_tf:
            score += doc_tf[word]["normalized"] * idf.get(word, 0)
    return score

query = ["蓝牙", "耳机"]
for i in range(len(corpus)):
    score = compute_query_doc_score(query, i, tf_results, idf)
    print(f"文档{i}: TF-IDF分数={score:.4f}, 内容={''.join(corpus[i])}")
```

## BM25：TF-IDF 的工业级改进

BM25（Best Matching 25）是 1994 年由 Robertson 等人提出的概率检索模型，至今仍是 Elasticsearch、Lucene 的默认排序算法。它对 TF-IDF 做了两个关键改进：

**改进一：词频饱和**

TF-IDF 中 TF 是线性增长的，但实际场景中，一个词出现 10 次和 100 次的差异不应是 10 倍。BM25 用一个饱和函数替代线性 TF：

```
TF_component = (TF × (k1 + 1)) / (TF + k1 × (1 - b + b × dl/avgdl))
```

其中 `k1` 控制饱和速度，通常取 1.2~2.0。k1 越大，词频增长越不容易饱和。

**词频饱和的直觉：** 想象你读一篇关于"蓝牙"的文章。第一次看到"蓝牙"，你确信文章和蓝牙相关。第二次看到，信心增加。但到第十次和第十一次之间，信心几乎不会变化——你已经确定了。这就是饱和：边际收益递减。

**改进二：文档长度归一化**

长文档天然包含更多词，BM25 通过参数 `b` 控制文档长度的惩罚力度。`b` 取值 0~1，默认 0.75。`b=1` 时完全按长度归一化，`b=0` 时完全不考虑长度。

完整的 BM25 公式：

```
BM25(q, d) = Σ IDF(t) × (TF(t,d) × (k1 + 1)) / (TF(t,d) + k1 × (1 - b + b × dl/avgdl))
```

```python
class BM25:
    def __init__(self, corpus: list[list[str]], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus = corpus
        self.doc_count = len(corpus)
        self.avgdl = sum(len(doc) for doc in corpus) / self.doc_count
        self.doc_freqs = Counter()
        self.doc_lens = [len(doc) for doc in corpus]
        self.tf_per_doc = []

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
            numerator = tf_val * (self.k1 + 1)
            denominator = tf_val + self.k1 * (1 - self.b + self.b * dl / self.avgdl)
            score += idf_val * (numerator / denominator)
        return score

    def search(self, query: list[str], top_k: int = 3) -> list[tuple[int, float]]:
        scores = [(i, self._score_doc(query, i)) for i in range(self.doc_count)]
        scores.sort(key=lambda x: -x[1])
        return scores[:top_k]

bm25 = BM25(corpus)
query = ["蓝牙", "耳机"]
results = bm25.search(query)
for doc_idx, score in results:
    print(f"文档{doc_idx}: BM25分数={score:.3f}, 内容={''.join(corpus[doc_idx])}")
```

## BM25 参数详解与调优

BM25 的两个参数 k1 和 b 对检索效果有显著影响，理解它们的行为是调优的关键。

**k1（词频饱和参数）：**
- k1 = 0：词频完全不参与评分，退化为纯 IDF 排序
- k1 = 1.2：默认值，词频快速饱和，适合短文本
- k1 = 2.0：词频增长较慢饱和，适合长文档或专业领域
- k1 > 3.0：实际场景中很少使用，词频影响过大

**b（文档长度归一化参数）：**
- b = 0：完全不考虑文档长度差异
- b = 0.75：默认值，适度惩罚长文档
- b = 1.0：完全按长度归一化，短文档有明显优势

```python
def bm25_parameter_sweep(corpus, query, k1_values, b_values):
    """网格搜索 BM25 参数，输出排序变化"""
    query_tokens = list(query)
    for k1 in k1_values:
        for b in b_values:
            bm25 = BM25(corpus, k1=k1, b=b)
            results = bm25.search(query_tokens, top_k=len(corpus))
            ranking = [idx for idx, _ in results]
            print(f"k1={k1:.1f}, b={b:.2f}: 排序={ranking}")

# 示例：在电商商品语料上测试
product_corpus = [
    ["无线", "蓝牙", "耳机", "降噪", "蓝牙", "连接", "稳定", "蓝牙"],
    ["有线", "耳机", "音质", "清晰", "佩戴", "舒适"],
    ["蓝牙", "音箱", "低音", "震撼", "蓝牙", "连接"],
    ["无线", "充电", "手机", "快充", "方便"],
    ["降噪", "耳机", "头戴式", "蓝牙", "无线", "降噪", "效果", "好"],
]
bm25_parameter_sweep(product_corpus, "蓝牙耳机",
                     k1_values=[0.5, 1.0, 1.5, 2.0],
                     b_values=[0.0, 0.3, 0.75, 1.0])
```

## BM25 的 IDF 变体

BM25 中使用的 IDF 公式也有多种变体，不同实现采用不同的版本：

```python
def idf_variants(N: int, df: int) -> dict[str, float]:
    """BM25 中常用的 IDF 变体"""
    return {
        "standard": math.log((N - df + 0.5) / (df + 0.5) + 1),       # Lucene/Elasticsearch
        "probabilistic": math.log((N - df) / df) if df < N else 0,    # 原始 Robertson
        "smooth": math.log(1 + (N - df + 0.5) / (df + 0.5)),         # 平滑版
        "normalized": math.log((N + 1) / (df + 1)),                   # sklearn 风格
    }

# 对比：当 df 接近 N 时，不同 IDF 的行为差异
for df in [1, 5, 10, 50, 100, 500]:
    idfs = idf_variants(1000, df)
    print(f"df={df:3d}: {', '.join(f'{k}={v:.3f}' for k, v in idfs.items())}")
```

## 常见误区

1. **误以为 TF-IDF 需要复杂的库**：核心公式仅需加减乘除和对数，从零实现不到 50 行代码。理解原理比调库更重要。

2. **忽略 IDF 的语料库依赖**：IDF 值取决于你索引的文档集合，不同语料库计算出的 IDF 完全不同。换领域时必须重新计算。

3. **直接用原始计数作为 TF**：不做归一化会导致长文档天然占优，结果偏差严重。

4. **BM25 的 k1 和 b 不需要调参**：默认值在大多数场景下表现不错，但特定领域（如短文本搜索、长文档检索）需要针对性调整。

5. **把 BM25 当作"过时的方法"**：BM25 在关键词匹配场景下依然极其有效，是很多混合检索系统的基础组件。

6. **忽略停用词处理**：虽然 IDF 能自然降低停用词的权重，但在小语料库中，停用词的 IDF 可能不够低，仍会干扰排序。建议在预处理阶段移除停用词。

7. **中文不分词直接用 TF-IDF**：中文没有天然的词边界，逐字切分会损失大量语义信息。必须使用分词工具（如 jieba）进行预处理。

8. **过度依赖 TF-IDF 而忽略字段权重**：在电商场景中，标题中的词比描述中的词更重要。应该对不同字段使用不同的权重系数，而不是统一计算 TF-IDF。

## 工程建议

1. **预计算 IDF 并缓存**：IDF 只依赖语料库全局统计，索引阶段计算一次，查询时直接查表。

2. **生产环境优先用 BM25**：Elasticsearch、Whoosh 等搜索引擎内置 BM25，除非有特殊需求，否则不必自己实现。

3. **BM25 参数要基于评估数据调优**：准备一组标注好的查询-文档对，用 NDCG 等指标自动搜索最优 k1 和 b。

4. **增量更新 IDF**：当新文档加入索引时，受影响词的 IDF 需要重新计算。大型系统通常采用定期批量更新策略，而非实时更新。

5. **结合倒排索引**：TF-IDF/BM25 的实际检索依赖倒排索引结构。索引阶段将每个词关联到包含它的文档列表及其 TF 值，查询时只需遍历包含查询词的文档，而非扫描全部文档。

6. **多字段加权**：电商场景中，标题、品牌、类目、描述的权重应不同。常见做法是 `score = w_title × BM25_title + w_brand × BM25_brand + ...`，权重通过 A/B 测试确定。

## 小结

- TF 衡量词在文档内的频率，IDF 衡量词在整个语料库中的稀有度，两者相乘得到 TF-IDF。
- BM25 在 TF-IDF 基础上引入词频饱和与文档长度归一化，是工业级关键词检索的标准算法。
- k1 控制词频饱和速度，b 控制文档长度惩罚力度，默认值 1.2/0.75 是良好的起点。
- 理解 TF-IDF 和 BM25 的数学原理，是从"调库工程师"到"检索工程师"的第一步。
- 在现代检索系统中，BM25 常作为第一阶段的召回（retrieval），后续由更复杂的模型做精排（reranking）。

## 练习

### 练习一：实现 IDF 的不同变体

标准 IDF 公式为 `log(N/df)`，请实现以下三种变体，并比较它们在稀有词和常见词上的差异：
1. 概率 IDF：`log((N - df) / df)`
2. 平滑 IDF：`log(1 + N / df)`
3. 增强 IDF：`log(1 + max_df / df)`，其中 max_df 是最大文档频率

### 练习二：BM25 参数敏感性实验

使用上面的 BM25 实现，对同一组查询测试不同 k1（0.5, 1.0, 1.2, 1.5, 2.0）和 b（0.0, 0.3, 0.75, 1.0）的组合，观察排序结果的变化。哪种参数组合对短文本语料更友好？

### 练习三：构建迷你搜索引擎

给定 10 篇中文新闻标题，实现一个基于 BM25 的迷你搜索引擎：支持索引构建、查询输入、返回 Top-5 结果。要求输出每条结果的 BM25 分数。

### 练习四：BM25 与 TF-IDF 排序对比

在同一语料库上，分别用 TF-IDF 和 BM25 对同一组查询进行排序，统计两种方法排序结果的 Kendall Tau 距离。分析在什么情况下两者排序一致，什么情况下差异明显。

### 练习五：字段加权 BM25

实现一个支持多字段加权的 BM25 检索系统。给定商品的标题、品牌、描述三个字段，分别计算 BM25 分数，然后用加权和作为最终分数。通过实验确定最优权重组合。

---

## 参考答案

### 练习一

**思路**：三种 IDF 变体的核心区别在于对常见词的惩罚力度不同。概率 IDF 在 df 接近 N 时会变成负数，需要特殊处理。

**答案**：
```python
import math
from collections import Counter

def compute_idf_variants(documents: list[list[str]]) -> dict[str, dict[str, float]]:
    num_docs = len(documents)
    df = Counter()
    for doc in documents:
        for word in set(doc):
            df[word] += 1
    max_df = max(df.values()) if df else 1

    idf_variants = {}
    for word, freq in df.items():
        idf_variants[word] = {
            "standard": math.log(num_docs / freq),
            "probabilistic": max(0, math.log((num_docs - freq) / freq)) if freq < num_docs else 0,
            "smooth": math.log(1 + num_docs / freq),
            "enhanced": math.log(1 + max_df / freq),
        }
    return idf_variants
```

**要点**：
- 概率 IDF 对高频词可能出现负值，需用 max(0, ...) 截断
- 平滑 IDF 最温和，永远不会为零
- 增强 IDF 以最高文档频率为基准，相对排名更稳定

### 练习二

**思路**：控制变量法，先固定 b=0.75 测试不同 k1，再固定 k1=1.2 测试不同 b。

**答案**：
```python
test_corpus = [["机器","学习","入门"],["深度","学习","神经"],["机器","学习","算法"],["自然","语言","处理"]]
test_query = ["机器", "学习"]

for k1 in [0.5, 1.0, 1.5, 2.0]:
    bm25 = BM25(test_corpus, k1=k1, b=0.75)
    print(f"k1={k1}: {[(r[0], round(r[1],2)) for r in bm25.search(test_query, 3)]}")
for b in [0.0, 0.3, 0.75, 1.0]:
    bm25 = BM25(test_corpus, k1=1.2, b=b)
    print(f"b={b}: {[(r[0], round(r[1],2)) for r in bm25.search(test_query, 3)]}")
```

**要点**：k1 越大词频影响越大，b 越大越惩罚长文档。短文本语料建议 k1=1.0~1.2, b=0.3~0.5。

### 练习三

**思路**：将索引构建和查询分开。索引阶段预计算 IDF、文档频率、文档长度；查询阶段直接调用 BM25 计算分数。

**答案**：
```python
class MiniSearchEngine:
    def __init__(self, k1=1.5, b=0.75):
        self.bm25 = None
        self.raw_docs = []
        self.k1, self.b = k1, b

    def index(self, docs: list[str]):
        self.raw_docs = docs
        self.bm25 = BM25([list(doc) for doc in docs], k1=self.k1, b=self.b)

    def search(self, query: str, top_k=5) -> list[tuple[str, float]]:
        results = self.bm25.search(list(query), top_k=top_k)
        return [(self.raw_docs[idx], round(score, 3)) for idx, score in results]

# news = ["国内生产总值同比增长百分之五", "央行宣布降准降息释放流动性", ...]
# engine = MiniSearchEngine(); engine.index(news)
# for doc, score in engine.search("人工智能模型"): print(f"[{score}] {doc}")
```

**要点**：
- 中文需要分词，这里简化为逐字切分，实际应使用 jieba 等分词工具
- 索引阶段做预计算，查询阶段只需做 BM25 评分，保证查询延迟低

### 练习四

**思路**：分别实现 TF-IDF 排序和 BM25 排序，然后计算两个排序之间的 Kendall Tau 距离。Kendall Tau 距离衡量两个排列之间的不一致程度。

**答案**：
```python
from itertools import combinations

def kendall_tau_distance(ranking_a: list[int], ranking_b: list[int]) -> int:
    """计算两个排序之间的 Kendall Tau 距离"""
    n = len(ranking_a)
    pos_a = {idx: i for i, idx in enumerate(ranking_a)}
    pos_b = {idx: i for i, idx in enumerate(ranking_b)}
    distance = 0
    for i, j in combinations(range(n), 2):
        a_order = (pos_a[i] - pos_a[j]) * (pos_b[i] - pos_b[j])
        if a_order < 0:
            distance += 1
    return distance

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
                self.tf_results[i].get(w, {}).get("normalized", 0) * self.idf.get(w, 0)
                for w in query
            )
            scores.append((i, score))
        scores.sort(key=lambda x: -x[1])
        return [idx for idx, _ in scores]

tfidf_ranker = TFIDFRanker(corpus)
bm25_ranker = BM25(corpus)
query = ["蓝牙", "耳机"]

tfidf_order = tfidf_ranker.rank(query)
bm25_order = [idx for idx, _ in bm25_ranker.search(query, len(corpus))]
tau = kendall_tau_distance(tfidf_order, bm25_order)
print(f"TF-IDF排序: {tfidf_order}")
print(f"BM25排序: {bm25_order}")
print(f"Kendall Tau距离: {tau}")
```

**要点**：
- Kendall Tau 距离越大，两种方法的排序差异越大
- 在短文本语料上，两者排序通常比较一致
- 在长文档语料上，BM25 的文档长度归一化会导致排序明显不同
- k1 和 b 越接近极端值，BM25 与 TF-IDF 的差异越大

### 练习五

**思路**：对每个字段分别建立 BM25 索引，查询时分别计算分数，然后加权求和。

**答案**：
```python
class FieldWeightedBM25:
    def __init__(self, k1=1.5, b=0.75):
        self.k1 = k1
        self.b = b
        self.field_models = {}

    def index(self, field_docs: dict[str, list[str]]):
        """field_docs: {"title": [doc1, doc2, ...], "brand": [...], "description": [...]}"""
        for field_name, docs in field_docs.items():
            tokenized = [list(doc) for doc in docs]
            self.field_models[field_name] = BM25(tokenized, k1=self.k1, b=self.b)

    def search(self, query: str, weights: dict[str, float], top_k=5) -> list[tuple[int, float]]:
        query_tokens = list(query)
        doc_count = len(next(iter(self.field_models.values())).corpus)
        final_scores = []
        for doc_idx in range(doc_count):
            score = 0.0
            for field_name, model in self.field_models.items():
                field_score = model._score_doc(query_tokens, doc_idx)
                score += weights.get(field_name, 0) * field_score
            final_scores.append((doc_idx, score))
        final_scores.sort(key=lambda x: -x[1])
        return final_scores[:top_k]

# 用法示例：
# fw = FieldWeightedBM25()
# fw.index({
#     "title":       [list("无线蓝牙耳机降噪"), list("有线耳机音质好")],
#     "brand":       [list("索尼"), list("森海塞尔")],
#     "description": [list("高品质降噪蓝牙连接稳定"), list("专业级音质佩戴舒适")],
# })
# results = fw.search("蓝牙耳机", {"title": 0.5, "brand": 0.2, "description": 0.3})
```

**要点**：
- 标题权重通常最高（0.4~0.6），因为它最能反映商品核心属性
- 品牌权重根据业务需求调整，品牌搜索场景下应提高
- 描述权重适中（0.2~0.3），提供补充信息
- 权重的最优值需要通过 A/B 测试或离线评估确定
