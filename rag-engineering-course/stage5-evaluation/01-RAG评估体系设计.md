# Stage 5 · Lesson 1: RAG 评估体系设计

> **时长**: 50 分钟 | **前置**: Stage 4 完成
> **学习目标**:
> 1. 设计端到端的 RAG 评估框架
> 2. 理解组件级指标 vs 系统级指标的区别与联系
> 3. 构建高质量的评估数据集
> 4. 搭建自动化评估流水线

---

## 1. 为什么需要评估体系？

```
┌─────────────────────────────────────────────────────────────┐
│                  没有评估的 RAG 开发                         │
│                                                             │
│   "我觉得检索效果还行" ──► 改了 prompt ──► "好像好了一点"   │
│          │                                                  │
│          ▼                                                  │
│   "用户反馈回答不准" ──► 调了参数 ──► "不知道有没有改善"     │
│          │                                                  │
│          ▼                                                  │
│   "上线后出了问题" ──► 紧急回滚 ──► "问题出在哪不知道"      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  有评估的 RAG 开发                           │
│                                                             │
│   基线评估: Faithfulness=0.72, Recall@5=0.68                │
│          │                                                  │
│          ▼                                                  │
│   改进检索策略 ──► 评估: Recall@5=0.81 (+19%)              │
│          │                                                  │
│          ▼                                                  │
│   优化 Prompt ──► 评估: Faithfulness=0.85 (+18%)           │
│          │                                                  │
│          ▼                                                  │
│   A/B 测试 ──► 统计显著 ──► 灰度发布 ──► 全量上线         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

评估是 RAG 系统迭代的**眼睛**。没有评估，你就是在黑暗中摸索。

---

## 2. 评估框架全景

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RAG 评估框架                                      │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Layer 1: 组件级评估                       │   │
│  │                                                             │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐              │   │
│  │  │ 文档处理  │    │  检索器   │    │  生成器   │              │   │
│  │  │ 评估     │    │  评估     │    │  评估     │              │   │
│  │  │          │    │          │    │          │              │   │
│  │  │•分块质量 │    │•Recall   │    │•忠实度   │              │   │
│  │  │•索引完整 │    │•Precision│    │•相关性   │              │   │
│  │  │•覆盖度   │    │•MRR/NDCG │    │•流畅度   │              │   │
│  │  └──────────┘    └──────────┘    └──────────┘              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Layer 2: 端到端评估                       │   │
│  │                                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │   │
│  │  │  回答质量     │  │  检索质量     │  │  用户体验     │      │   │
│  │  │              │  │              │  │              │      │   │
│  │  │ •Faithfulness│  │ •Context     │  │ •响应时间    │      │   │
│  │  │ •Relevancy   │  │  Precision   │  │ •满意度评分  │      │   │
│  │  │ •Correctness │  │ •Context     │  │ •任务完成率  │      │   │
│  │  │ •Completeness│  │  Recall      │  │ •对话轮次    │      │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Layer 3: 业务指标                         │   │
│  │                                                             │   │
│  │  • 转化率提升    • 用户留存    • 成本效率    • 覆盖率       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 组件级指标 vs 系统级指标

### 3.1 指标分类表

| 维度 | 组件级指标 | 系统级指标 |
|------|-----------|-----------|
| **评估对象** | 单个组件（检索器、生成器等） | 整个 RAG Pipeline |
| **评估粒度** | 细粒度，定位具体问题 | 粗粒度，衡量整体表现 |
| **典型指标** | Recall@K, Precision@K, MRR | Faithfulness, Answer Relevancy |
| **数据需求** | 需要标注的 query-document 对 | 需要 query-answer-reference 三元组 |
| **使用场景** | 开发调试、组件选型 | 上线前验收、版本对比 |
| **响应速度** | 快（单组件测试） | 慢（需要完整 Pipeline） |
| **可解释性** | 高（知道哪个组件有问题） | 中（需要进一步拆解） |
| **与用户体验相关性** | 间接 | 直接 |

### 3.2 组件级指标详解

```python
# 检索质量指标
"""
Recall@K: 前K个检索结果中包含的相关文档比例
Precision@K: 前K个检索结果中相关文档的比例
MRR (Mean Reciprocal Rank): 第一个相关文档排名的倒数
NDCG@K: 考虑排名位置的增益累积
"""
```

### 3.3 系统级指标详解

```python
# 系统级指标
"""
Faithfulness: 回答是否忠实于检索到的上下文（幻觉检测）
Answer Relevancy: 回答与问题的相关程度
Context Precision: 检索上下文的精确度
Context Recall: 检索上下文的召回率
"""
```

---

## 4. 构建评估数据集

评估数据集是评估体系的**基石**。没有高质量的评估数据集，再好的指标也是空中楼阁。

### 4.1 评估数据集的组成

```
┌─────────────────────────────────────────────────────────┐
│                 评估数据集结构                           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Query (用户问题)                                  │   │
│  │ "如何配置 RAGAS 的自定义指标？"                    │   │
│  └──────────────────────┬──────────────────────────┘   │
│                         │                               │
│           ┌─────────────┼─────────────┐                │
│           ▼             ▼             ▼                │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐       │
│  │ Ground Truth │ │ Relevant │ │ Expected     │       │
│  │ Answer       │ │ Documents│ │ Answer       │       │
│  │ (标准答案)    │ │ (相关文档)│ │ (期望回答)    │       │
│  └──────────────┘ └──────────┘ └──────────────┘       │
│                                                         │
│  + Metadata: difficulty, category, source               │
└─────────────────────────────────────────────────────────┘
```

### 4.2 评估数据集构建器

```python
"""
评估数据集构建器
支持多种构建方式: 手动标注、LLM 生成、历史日志挖掘
"""

import json
import hashlib
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path


@dataclass
class EvalSample:
    """单条评估样本"""
    query: str
    ground_truth_answer: str
    relevant_doc_ids: List[str] = field(default_factory=list)
    relevant_doc_contents: List[str] = field(default_factory=list)
    expected_answer: Optional[str] = None
    difficulty: str = "medium"  # easy, medium, hard
    category: str = "general"
    metadata: Dict[str, Any] = field(default_factory=dict)
    sample_id: str = ""

    def __post_init__(self):
        if not self.sample_id:
            content = f"{self.query}:{self.ground_truth_answer}"
            self.sample_id = hashlib.md5(content.encode()).hexdigest()[:12]
        if not self.expected_answer:
            self.expected_answer = self.ground_truth_answer


class EvalDatasetBuilder:
    """评估数据集构建器"""

    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.samples: List[EvalSample] = []
        self.created_at = datetime.now().isoformat()

    def add_sample(self, sample: EvalSample) -> "EvalDatasetBuilder":
        """添加单条样本（支持链式调用）"""
        self.samples.append(sample)
        return self

    def add_samples(self, samples: List[EvalSample]) -> "EvalDatasetBuilder":
        """批量添加样本"""
        self.samples.extend(samples)
        return self

    def build_from_qa_pairs(
        self,
        qa_pairs: List[Dict[str, str]],
        relevant_docs: Optional[Dict[str, List[str]]] = None
    ) -> "EvalDatasetBuilder":
        """从问答对构建数据集"""
        for pair in qa_pairs:
            query = pair["query"]
            answer = pair["answer"]
            doc_ids = relevant_docs.get(query, []) if relevant_docs else []
            self.samples.append(EvalSample(
                query=query,
                ground_truth_answer=answer,
                relevant_doc_ids=doc_ids,
                difficulty=pair.get("difficulty", "medium"),
                category=pair.get("category", "general"),
            ))
        return self

    def build_from_llm(
        self,
        documents: List[Dict[str, str]],
        llm_client: Any,
        num_questions_per_doc: int = 3,
    ) -> "EvalDatasetBuilder":
        """使用 LLM 从文档自动生成评估数据"""
        prompt_template = """基于以下文档内容，生成 {n} 个高质量的问答对。
要求:
1. 问题应该是用户真实会问的
2. 答案必须完全基于文档内容
3. 包含不同难度级别

文档内容:
{doc_content}

以 JSON 格式输出:
[{{"query": "...", "answer": "...", "difficulty": "easy|medium|hard"}}]
"""
        for doc in documents:
            prompt = prompt_template.format(
                n=num_questions_per_doc,
                doc_content=doc["content"][:3000]
            )
            response = llm_client.generate(prompt)
            try:
                qa_pairs = json.loads(response)
                for pair in qa_pairs:
                    self.samples.append(EvalSample(
                        query=pair["query"],
                        ground_truth_answer=pair["answer"],
                        relevant_doc_ids=[doc.get("id", "")],
                        relevant_doc_contents=[doc["content"]],
                        difficulty=pair.get("difficulty", "medium"),
                    ))
            except json.JSONDecodeError:
                continue
        return self

    def build_from_logs(
        self,
        log_path: str,
        min_rating: int = 4,
    ) -> "EvalDatasetBuilder":
        """从用户反馈日志中挖掘高质量样本"""
        with open(log_path, "r", encoding="utf-8") as f:
            logs = json.load(f)

        for entry in logs:
            if entry.get("user_rating", 0) >= min_rating:
                self.samples.append(EvalSample(
                    query=entry["query"],
                    ground_truth_answer=entry["answer"],
                    relevant_doc_contents=entry.get("contexts", []),
                    metadata={
                        "source": "user_log",
                        "rating": entry["user_rating"],
                        "timestamp": entry.get("timestamp"),
                    },
                ))
        return self

    def split(
        self,
        train_ratio: float = 0.7,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
        seed: int = 42,
    ) -> Dict[str, "EvalDatasetBuilder"]:
        """将数据集拆分为训练/验证/测试集"""
        import random
        random.seed(seed)
        shuffled = self.samples.copy()
        random.shuffle(shuffled)

        n = len(shuffled)
        train_end = int(n * train_ratio)
        val_end = train_end + int(n * val_ratio)

        splits = {}
        for name, start, end in [
            ("train", 0, train_end),
            ("val", train_end, val_end),
            ("test", val_end, n),
        ]:
            builder = EvalDatasetBuilder(f"{self.name}_{name}")
            builder.samples = shuffled[start:end]
            splits[name] = builder
        return splits

    def get_statistics(self) -> Dict[str, Any]:
        """获取数据集统计信息"""
        difficulties = {}
        categories = {}
        for s in self.samples:
            difficulties[s.difficulty] = difficulties.get(s.difficulty, 0) + 1
            categories[s.category] = categories.get(s.category, 0) + 1

        return {
            "total_samples": len(self.samples),
            "difficulty_distribution": difficulties,
            "category_distribution": categories,
            "avg_query_length": sum(len(s.query) for s in self.samples) / max(len(self.samples), 1),
            "avg_answer_length": sum(len(s.ground_truth_answer) for s in self.samples) / max(len(self.samples), 1),
        }

    def save(self, path: str) -> None:
        """保存数据集到 JSON 文件"""
        data = {
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at,
            "statistics": self.get_statistics(),
            "samples": [asdict(s) for s in self.samples],
        }
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, path: str) -> "EvalDatasetBuilder":
        """从 JSON 文件加载数据集"""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        builder = cls(data["name"], data.get("description", ""))
        builder.created_at = data.get("created_at", "")
        for s in data["samples"]:
            builder.samples.append(EvalSample(**s))
        return builder

    def __len__(self):
        return len(self.samples)

    def __repr__(self):
        return f"EvalDatasetBuilder(name='{self.name}', samples={len(self.samples)})"


# ============================================================
# 使用示例
# ============================================================

if __name__ == "__main__":
    # 方式1: 手动构建
    builder = EvalDatasetBuilder(
        name="ragas_eval_v1",
        description="RAG 系统评估数据集 v1"
    )

    builder.add_sample(EvalSample(
        query="什么是 RAG？",
        ground_truth_answer="RAG (Retrieval-Augmented Generation) 是一种结合检索和生成的 AI 框架。",
        relevant_doc_contents=["RAG 是一种结合检索和生成的技术..."],
        difficulty="easy",
        category="concept",
    ))

    # 方式2: 从问答对构建
    qa_pairs = [
        {"query": "如何优化检索？", "answer": "可以使用混合检索、重排序等策略", "difficulty": "medium"},
        {"query": "什么是向量数据库？", "answer": "向量数据库专门用于存储和检索高维向量", "difficulty": "easy"},
    ]
    builder.build_from_qa_pairs(qa_pairs)

    # 统计信息
    stats = builder.get_statistics()
    print(f"数据集统计: {json.dumps(stats, indent=2, ensure_ascii=False)}")

    # 拆分数据集
    splits = builder.split()
    print(f"训练集: {len(splits['train'])}, 验证集: {len(splits['val'])}, 测试集: {len(splits['test'])}")

    # 保存
    builder.save("eval_dataset.json")
    print("数据集已保存到 eval_dataset.json")
```

---

## 5. 指标计算框架

```python
"""
RAG 评估指标计算框架
支持组件级和系统级指标的统一计算
"""

import numpy as np
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import time


@dataclass
class EvalResult:
    """评估结果"""
    metric_name: str
    value: float
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = time.strftime("%Y-%m-%d %H:%M:%S")


class BaseMetric(ABC):
    """指标基类"""

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        pass

    @abstractmethod
    def compute(self, **kwargs) -> EvalResult:
        pass


class RecallAtK(BaseMetric):
    """Recall@K: 前K个结果中相关文档的召回率"""

    def __init__(self, k: int = 5):
        self.k = k

    @property
    def name(self) -> str:
        return f"Recall@{self.k}"

    @property
    def description(self) -> str:
        return f"前{self.k}个检索结果中包含的相关文档比例"

    def compute(
        self,
        retrieved_ids: List[List[str]],
        relevant_ids: List[List[str]],
    ) -> EvalResult:
        recalls = []
        for ret, rel in zip(retrieved_ids, relevant_ids):
            ret_set = set(ret[:self.k])
            rel_set = set(rel)
            if not rel_set:
                recalls.append(1.0)
                continue
            hit = len(ret_set & rel_set)
            recalls.append(hit / len(rel_set))

        avg_recall = np.mean(recalls)
        return EvalResult(
            metric_name=self.name,
            value=float(avg_recall),
            details={"per_query": recalls, "k": self.k},
        )


class PrecisionAtK(BaseMetric):
    """Precision@K: 前K个结果中相关文档的比例"""

    def __init__(self, k: int = 5):
        self.k = k

    @property
    def name(self) -> str:
        return f"Precision@{self.k}"

    @property
    def description(self) -> str:
        return f"前{self.k}个检索结果中相关文档的比例"

    def compute(
        self,
        retrieved_ids: List[List[str]],
        relevant_ids: List[List[str]],
    ) -> EvalResult:
        precisions = []
        for ret, rel in zip(retrieved_ids, relevant_ids):
            ret_set = set(ret[:self.k])
            rel_set = set(rel)
            if not ret_set:
                precisions.append(0.0)
                continue
            hit = len(ret_set & rel_set)
            precisions.append(hit / len(ret_set))

        avg_precision = np.mean(precisions)
        return EvalResult(
            metric_name=self.name,
            value=float(avg_precision),
            details={"per_query": precisions, "k": self.k},
        )


class MeanReciprocalRank(BaseMetric):
    """MRR: 第一个相关文档排名的倒数均值"""

    @property
    def name(self) -> str:
        return "MRR"

    @property
    def description(self) -> str:
        return "第一个相关文档排名的倒数均值"

    def compute(
        self,
        retrieved_ids: List[List[str]],
        relevant_ids: List[List[str]],
    ) -> EvalResult:
        rr_list = []
        for ret, rel in zip(retrieved_ids, relevant_ids):
            rel_set = set(rel)
            rr = 0.0
            for i, doc_id in enumerate(ret):
                if doc_id in rel_set:
                    rr = 1.0 / (i + 1)
                    break
            rr_list.append(rr)

        mrr = np.mean(rr_list)
        return EvalResult(
            metric_name=self.name,
            value=float(mrr),
            details={"per_query": rr_list},
        )


class NDCGAtK(BaseMetric):
    """NDCG@K: 归一化折扣累积增益"""

    def __init__(self, k: int = 5):
        self.k = k

    @property
    def name(self) -> str:
        return f"NDCG@{self.k}"

    @property
    def description(self) -> str:
        return f"考虑排名位置的归一化折扣累积增益 (K={self.k})"

    def _dcg(self, relevances: List[float]) -> float:
        return sum(rel / np.log2(i + 2) for i, rel in enumerate(relevances[:self.k]))

    def compute(
        self,
        retrieved_ids: List[List[str]],
        relevant_ids: List[List[str]],
        relevance_scores: Optional[List[List[float]]] = None,
    ) -> EvalResult:
        ndcg_list = []
        for i, (ret, rel) in enumerate(zip(retrieved_ids, relevant_ids)):
            rel_set = set(rel)
            if relevance_scores and i < len(relevance_scores):
                gains = relevance_scores[i][:self.k]
            else:
                gains = [1.0 if rid in rel_set else 0.0 for rid in ret[:self.k]]

            dcg = self._dcg(gains)
            ideal_gains = sorted(gains, reverse=True)
            idcg = self._dcg(ideal_gains)
            ndcg = dcg / idcg if idcg > 0 else 0.0
            ndcg_list.append(ndcg)

        return EvalResult(
            metric_name=self.name,
            value=float(np.mean(ndcg_list)),
            details={"per_query": ndcg_list, "k": self.k},
        )


class AnswerRelevancy(BaseMetric):
    """回答相关性: 通过 LLM 评估回答与问题的相关程度"""

    def __init__(self, llm_client: Any = None):
        self.llm_client = llm_client

    @property
    def name(self) -> str:
        return "AnswerRelevancy"

    @property
    def description(self) -> str:
        return "回答与问题的相关程度 (0-1)"

    def compute(
        self,
        queries: List[str],
        answers: List[str],
    ) -> EvalResult:
        scores = []
        for query, answer in zip(queries, answers):
            if self.llm_client:
                score = self._llm_score(query, answer)
            else:
                score = self._heuristic_score(query, answer)
            scores.append(score)

        return EvalResult(
            metric_name=self.name,
            value=float(np.mean(scores)),
            details={"per_query": scores},
        )

    def _heuristic_score(self, query: str, answer: str) -> float:
        """启发式评分（作为 LLM 的降级方案）"""
        query_words = set(query.lower().split())
        answer_words = set(answer.lower().split())
        overlap = len(query_words & answer_words)
        return min(overlap / max(len(query_words), 1), 1.0)

    def _llm_score(self, query: str, answer: str) -> float:
        """LLM 评分"""
        prompt = f"""Rate the relevance of the answer to the question on a scale of 0-1.

Question: {query}
Answer: {answer}

Return only a float number between 0 and 1:"""
        try:
            response = self.llm_client.generate(prompt)
            return float(response.strip())
        except (ValueError, AttributeError):
            return self._heuristic_score(query, answer)


class MetricRegistry:
    """指标注册表"""

    def __init__(self):
        self._metrics: Dict[str, BaseMetric] = {}

    def register(self, metric: BaseMetric) -> None:
        self._metrics[metric.name] = metric

    def get(self, name: str) -> Optional[BaseMetric]:
        return self._metrics.get(name)

    def list_metrics(self) -> List[str]:
        return list(self._metrics.keys())

    def compute_all(self, **kwargs) -> Dict[str, EvalResult]:
        """计算所有已注册的指标"""
        results = {}
        for name, metric in self._metrics.items():
            try:
                results[name] = metric.compute(**kwargs)
            except Exception as e:
                results[name] = EvalResult(
                    metric_name=name,
                    value=0.0,
                    details={"error": str(e)},
                )
        return results


# ============================================================
# 使用示例
# ============================================================

if __name__ == "__main__":
    # 注册指标
    registry = MetricRegistry()
    registry.register(RecallAtK(k=3))
    registry.register(RecallAtK(k=5))
    registry.register(PrecisionAtK(k=5))
    registry.register(MeanReciprocalRank())
    registry.register(NDCGAtK(k=5))

    # 模拟数据
    retrieved = [
        ["doc1", "doc2", "doc3", "doc4", "doc5"],
        ["doc2", "doc4", "doc1", "doc6", "doc7"],
        ["doc3", "doc1", "doc5", "doc8", "doc9"],
    ]
    relevant = [
        ["doc1", "doc3"],
        ["doc2", "doc5"],
        ["doc1", "doc3", "doc5"],
    ]

    # 计算指标
    results = registry.compute_all(
        retrieved_ids=retrieved,
        relevant_ids=relevant,
    )

    print("=" * 50)
    print("RAG 评估结果")
    print("=" * 50)
    for name, result in results.items():
        print(f"  {name}: {result.value:.4f}")
    print("=" * 50)
```

---

## 6. 自动化评估流水线

```python
"""
自动化评估流水线
将评估数据集构建、RAG 执行、指标计算、报告生成串联为 Pipeline
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class EvalReport:
    """评估报告"""
    run_id: str
    timestamp: str
    dataset_name: str
    dataset_size: int
    metrics: Dict[str, float] = field(default_factory=dict)
    per_sample_results: List[Dict] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    duration_seconds: float = 0.0


class AutomatedEvalPipeline:
    """自动化评估流水线"""

    def __init__(
        self,
        rag_system: Any,
        metrics: List[Any],
        output_dir: str = "eval_results",
    ):
        self.rag = rag_system
        self.metrics = metrics
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._history: List[EvalReport] = []

    def run(
        self,
        eval_dataset: List[Dict],
        run_name: str = "",
        metadata: Optional[Dict] = None,
    ) -> EvalReport:
        """执行完整评估流水线"""
        start_time = time.time()
        run_id = f"run_{int(start_time)}"

        print(f"[Pipeline] 开始评估: {run_id}")
        print(f"[Pipeline] 数据集大小: {len(eval_dataset)}")

        # Step 1: 执行 RAG
        print("[Pipeline] Step 1/3: 执行 RAG 推理...")
        rag_outputs = self._run_rag(eval_dataset)

        # Step 2: 计算指标
        print("[Pipeline] Step 2/3: 计算评估指标...")
        metric_results = self._compute_metrics(eval_dataset, rag_outputs)

        # Step 3: 生成报告
        print("[Pipeline] Step 3/3: 生成评估报告...")
        duration = time.time() - start_time
        report = EvalReport(
            run_id=run_id,
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
            dataset_name=run_name or "eval_dataset",
            dataset_size=len(eval_dataset),
            metrics={name: r.value for name, r in metric_results.items()},
            per_sample_results=self._build_per_sample(eval_dataset, rag_outputs, metric_results),
            metadata=metadata or {},
            duration_seconds=duration,
        )

        self._save_report(report)
        self._history.append(report)

        # 打印结果
        print("\n" + "=" * 50)
        print(f"评估完成: {run_id}")
        print(f"耗时: {duration:.1f}s")
        print("-" * 50)
        for name, value in report.metrics.items():
            print(f"  {name}: {value:.4f}")
        print("=" * 50)

        return report

    def _run_rag(self, dataset: List[Dict]) -> List[Dict]:
        """执行 RAG 系统获取结果"""
        outputs = []
        for sample in dataset:
            try:
                result = self.rag.query(sample["query"])
                outputs.append({
                    "answer": result.get("answer", ""),
                    "contexts": result.get("contexts", []),
                    "retrieved_ids": result.get("retrieved_ids", []),
                })
            except Exception as e:
                outputs.append({
                    "answer": "",
                    "contexts": [],
                    "retrieved_ids": [],
                    "error": str(e),
                })
        return outputs

    def _compute_metrics(
        self,
        dataset: List[Dict],
        rag_outputs: List[Dict],
    ) -> Dict[str, Any]:
        """计算所有指标"""
        results = {}
        for metric in self.metrics:
            try:
                if hasattr(metric, "compute"):
                    result = metric.compute(
                        queries=[s["query"] for s in dataset],
                        answers=[o["answer"] for o in rag_outputs],
                        retrieved_ids=[o.get("retrieved_ids", []) for o in rag_outputs],
                        relevant_ids=[s.get("relevant_doc_ids", []) for s in dataset],
                        contexts=[o.get("contexts", []) for o in rag_outputs],
                        ground_truths=[s.get("ground_truth_answer", "") for s in dataset],
                    )
                    results[metric.name] = result
            except Exception as e:
                print(f"[Warning] 指标 {metric.name} 计算失败: {e}")
        return results

    def _build_per_sample(self, dataset, outputs, metrics) -> List[Dict]:
        """构建每条样本的详细结果"""
        per_sample = []
        for i, (sample, output) in enumerate(zip(dataset, outputs)):
            per_sample.append({
                "index": i,
                "query": sample["query"],
                "expected": sample.get("ground_truth_answer", ""),
                "actual": output["answer"],
                "error": output.get("error"),
            })
        return per_sample

    def _save_report(self, report: EvalReport) -> None:
        """保存评估报告"""
        path = self.output_dir / f"{report.run_id}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(report), f, ensure_ascii=False, indent=2)
        print(f"[Pipeline] 报告已保存: {path}")

    def compare_runs(self, run_ids: List[str]) -> Dict[str, Any]:
        """对比多次评估结果"""
        comparison = {}
        for run_id in run_ids:
            path = self.output_dir / f"{run_id}.json"
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    report = json.load(f)
                    comparison[run_id] = report.get("metrics", {})
        return comparison

    def get_trend(self, metric_name: str) -> List[Dict]:
        """获取指标趋势"""
        trend = []
        for report in self._history:
            if metric_name in report.metrics:
                trend.append({
                    "run_id": report.run_id,
                    "timestamp": report.timestamp,
                    "value": report.metrics[metric_name],
                })
        return trend
```

---

## 7. 常见错误

```
┌─────────────────────────────────────────────────────────────────┐
│                       常见错误                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ❌ 错误1: 评估数据集太小 (< 50 条)                              │
│     ✅ 正确: 至少 100-200 条，覆盖不同场景和难度                  │
│                                                                 │
│  ❌ 错误2: 只看单一指标                                          │
│     ✅ 正确: 综合多个指标，高 Recall 低 Precision 也要警惕        │
│                                                                 │
│  ❌ 错误3: 评估数据集和训练数据混用                               │
│     ✅ 正确: 严格分离，评估数据集应独立于开发过程                  │
│                                                                 │
│  ❌ 错误4: 忽略评估数据集的质量                                   │
│     ✅ 正确: 定期审核评估数据集，确保答案准确、问题多样            │
│                                                                 │
│  ❌ 错误5: 只做离线评估，不做在线评估                             │
│     ✅ 正确: 离线评估 + 在线 A/B 测试结合                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 总结

```
┌─────────────────────────────────────────────────────────┐
│                   本课核心要点                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 评估体系分三层: 组件级 → 系统级 → 业务级            │
│  2. 组件级指标用于调试定位，系统级指标用于验收决策       │
│  3. 评估数据集是基石: 手动 + LLM + 日志三种构建方式     │
│  4. 指标计算框架要可扩展、可注册、支持批量计算           │
│  5. 自动化 Pipeline 将评估变成日常习惯而非偶尔行为       │
│                                                         │
│  核心公式:                                              │
│  RAG 质量 = f(检索质量, 生成质量, 上下文质量)           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 9. 练习

### 练习 1: 构建评估数据集 (基础)
为你自己的 RAG 系统构建一个包含 50 条样本的评估数据集。要求:
- 至少覆盖 3 个不同类别
- 至少包含 easy/medium/hard 三种难度
- 使用 `EvalDatasetBuilder` 保存为 JSON

### 练习 2: 实现自定义指标 (进阶)
实现一个 `AnswerCompleteness` 指标，评估回答的完整性:
- 输入: query, answer, ground_truth_answer
- 计算 ground_truth_answer 中的关键信息在 answer 中的覆盖率
- 注册到 `MetricRegistry` 并测试

### 练习 3: 端到端评估 (综合)
搭建一个完整的评估流水线:
1. 构建评估数据集 (≥100 条)
2. 接入你的真实 RAG 系统
3. 计算至少 5 个指标
4. 生成评估报告并分析结果
5. 根据结果提出至少 3 个具体的优化建议

---

**下一课**: [02-RAGAS 深度实战](./02-RAGAS深度实战.md)
