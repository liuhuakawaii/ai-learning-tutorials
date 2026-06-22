# 05 评估多模态 RAG——多模态场景下的评估指标与方法

> 多模态 RAG 的评估比纯文本 RAG 更复杂。

## 场景引入

你的多模态 RAG 系统已经上线一个月，产品经理问你："系统效果怎么样？准确率多少？"你发现这个问题比想象中难回答——纯文本 RAG 可以用 BLEU、ROUGE 等自动指标评估，但多模态场景下图片理解的质量怎么量化？图文回答的准确性怎么定义？用户说"回答不对"到底是检索错了还是生成错了？多模态 RAG 的评估需要一套全新的方法论。

## 学习目标

- 掌握多模态 RAG 的评估方法
- 理解多模态评估的特殊挑战
- 学会设计多模态评估指标

---

## 一、评估挑战

```
多模态 RAG 评估挑战：

1. 跨模态匹配
   - 图文匹配度难以量化
   - 需要人工判断

2. 视觉理解
   - 图片内容理解主观性强
   - 不同人可能有不同理解

3. 生成质量
   - 图文混排的回答难以评估
   - 需要综合考虑文本和图片
```

---

## 二、评估指标

```
多模态 RAG 评估指标：

1. 检索指标
   - 图文匹配准确率
   - 跨模态检索召回率
   - 排序质量

2. 生成指标
   - 回答准确性
   - 图文一致性
   - 完整性

3. 用户体验
   - 响应时间
   - 回答可读性
   - 视觉呈现
```

---

## 三、自动评估

```python
def evaluate_multimodal_answer(question: str, answer: str, references: list) -> dict:
    """评估多模态回答"""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": f"""请评估以下多模态问答的质量。

问题：{question}
回答：{answer}
参考信息：{json.dumps(references, ensure_ascii=False)}

评估维度：
1. 准确性（1-5）
2. 完整性（1-5）
3. 图文一致性（1-5）

请以 JSON 格式输出。"""
        }],
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)
```

---

## 四、人工评估

```python
def create_human_eval_dataset(rag: MultimodalRAG, questions: list) -> list:
    """创建人工评估数据集"""
    eval_data = []
    
    for question in questions:
        result = rag.ask(question)
        eval_data.append({
            "question": question,
            "answer": result["answer"],
            "sources": result["sources"],
            "human_score": None  # 待人工评分
        })
    
    return eval_data
```

---

## 五、评估报告

```python
def generate_eval_report(eval_results: list) -> str:
    """生成评估报告"""
    avg_accuracy = sum(r["accuracy"] for r in eval_results) / len(eval_results)
    avg_completeness = sum(r["completeness"] for r in eval_results) / len(eval_results)
    avg_consistency = sum(r["consistency"] for r in eval_results) / len(eval_results)
    
    report = f"""# 多模态 RAG 评估报告

## 评估指标
- 准确性：{avg_accuracy:.2f}/5
- 完完整性：{avg_completeness:.2f}/5
- 图文一致性：{avg_consistency:.2f}/5

## 分析
- 整体表现：{'优秀' if avg_accuracy > 4 else '良好' if avg_accuracy > 3 else '需要改进'}
- 主要优势：图文一致性得分最高
- 改进空间：准确性有待提升
"""
    return report
```

---

## 常见误区

1. **只做自动评估不做人工评估**：自动指标（如 LLM-as-Judge）有偏差，关键场景必须结合人工评估，两者互补而非替代。
2. **评估数据集太小**：只用 10 个问题评估得出的结论不可靠，至少需要 50-100 个覆盖典型场景的测试用例。
3. **不区分检索质量和生成质量**：回答不准确可能是检索没找到相关内容，也可能是生成时理解错误，需要分别评估才能定位问题。
4. **评估只做一次不做持续监控**：系统上线后文档会更新、用户查询模式会变化，需要定期重新评估。

## 工程建议

1. **建立分层评估体系**：检索层评估（召回率、准确率）、生成层评估（准确性、完整性、图文一致性）、用户体验层评估（满意度、响应时间）。
2. **用 LLM-as-Judge 做初筛**：用 GPT-4o 自动评估回答质量，人工只复核低分和边界案例，大幅降低人工评估成本。
3. **建立 bad case 库**：收集评估中发现的错误案例，分类标注原因（检索失败/生成错误/图文不一致），针对性优化。
4. **做持续的线上监控**：统计无结果率、用户反馈差评率、平均响应时间等指标，设置告警阈值。

## 小结

```
本课核心要点：

1. 多模态 RAG 评估比纯文本更复杂
2. 评估指标：检索、生成、用户体验
3. 自动评估和人工评估结合
4. 生成评估报告分析结果

---

**下一课**: [06 阶段实战——构建一个多模态知识库](./06-阶段实战-多模态知识库.md)
```

---

## 练习

1. **评估题**：评估多模态 RAG 系统。

2. **指标题**：设计多模态评估指标。

3. **报告题**：生成评估报告。

---

## 参考答案

### 练习一：评估题——评估多模态 RAG 系统

**思路**：构建覆盖多种场景的测试集，分别从检索层和生成层进行自动评估 + 人工抽样验证，形成完整的评估流程。

**答案**：
```python
import json
from openai import OpenAI

class MultimodalRAGEvaluator:
    """多模态 RAG 评估器"""

    def __init__(self, rag_system):
        self.rag = rag_system
        self.client = OpenAI()

    def auto_evaluate(self, test_cases: list) -> list:
        """自动评估（LLM-as-Judge）"""
        results = []

        for case in test_cases:
            answer = self.rag.ask(case["question"])

            eval_response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{
                    "role": "user",
                    "content": f"""请评估以下多模态问答的质量。

问题：{case["question"]}
回答：{answer["answer"]}
参考信息：{json.dumps(case.get("references", []), ensure_ascii=False)}
参考答案：{case.get("reference_answer", "无")}

请从以下维度评分（1-5分）：
1. 准确性：回答是否事实正确
2. 完整性：是否覆盖了问题的所有方面
3. 图文一致性：图片引用是否与文本描述一致

请以 JSON 格式输出：{{"accuracy": N, "completeness": N, "consistency": N, "issues": ["问题1", ...]}}"""
                }],
                response_format={"type": "json_object"}
            )

            eval_result = json.loads(eval_response.choices[0].message.content)
            eval_result["question"] = case["question"]
            eval_result["answer"] = answer["answer"]
            eval_result["sources_count"] = len(answer.get("sources", []))
            results.append(eval_result)

        return results

    def human_eval_template(self, test_cases: list) -> list:
        """生成人工评估模板"""
        template = []
        for i, case in enumerate(test_cases):
            answer = self.rag.ask(case["question"])
            template.append({
                "id": i + 1,
                "question": case["question"],
                "answer": answer["answer"],
                "sources": answer.get("sources", []),
                "scores": {
                    "accuracy": None,
                    "completeness": None,
                    "consistency": None
                },
                "comments": ""
            })
        return template

    def create_test_dataset(self, questions_file: str) -> list:
        """从文件加载测试数据"""
        with open(questions_file, "r", encoding="utf-8") as f:
            questions = json.load(f)
        return questions

# 使用示例
evaluator = MultimodalRAGEvaluator(rag)

test_cases = [
    {
        "question": "这款产品的安装步骤是什么？",
        "reference_answer": "按照说明书第三章：步骤一打开包装...",
        "references": ["产品说明书第三章"]
    },
    {
        "question": "产品外观有什么特点？",
        "reference_answer": "产品采用流线型设计...",
        "references": ["产品宣传图"]
    }
]

auto_results = evaluator.auto_evaluate(test_cases)
for r in auto_results:
    print(f"问题: {r['question']}")
    print(f"  准确性: {r['accuracy']}/5, 完整性: {r['completeness']}/5, 一致性: {r['consistency']}/5")
```

**要点**：
- LLM-as-Judge 适合大规模初筛，但存在自我偏好偏差（LLM 倾向给同类模型更高分）
- 人工评估模板应该包含预填的自动评分，人工只需确认或修正，提高效率
- 常见错误：用被评估的同一模型做 Judge，会导致评估结果偏高

### 练习二：指标题——设计多模态评估指标

**思路**：针对多模态 RAG 的特殊性，设计分层指标体系：检索层、生成层、用户体验层，每层有具体的量化指标。

**答案**：
```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class RetrievalMetrics:
    """检索层指标"""
    precision_at_k: float    # Top-K 中相关结果的比例
    recall_at_k: float       # 相关结果被检索到的比例
    mrr: float               # 第一个相关结果的排名倒数
    ndcg_at_k: float         # 归一化折损累积增益（考虑排序质量）
    cross_modal_accuracy: float  # 跨模态匹配准确率

@dataclass
class GenerationMetrics:
    """生成层指标"""
    accuracy: float          # 事实准确性（1-5）
    completeness: float      # 回答完整性（1-5）
    image_text_consistency: float  # 图文一致性（1-5）
    hallucination_rate: float      # 幻觉率（生成了检索内容中没有的信息）
    citation_accuracy: float       # 引用准确率（引用来源是否正确）

@dataclass
class UserExperienceMetrics:
    """用户体验层指标"""
    avg_response_time: float  # 平均响应时间（秒）
    first_token_time: float   # 首 token 时间（流式场景）
    user_satisfaction: float  # 用户满意度（1-5）
    no_result_rate: float     # 无结果率（检索为空的比例）

class MultimodalMetricCalculator:
    """多模态指标计算器"""

    def calculate_ndcg(self, relevance_scores: list, k: int = 5) -> float:
        """计算 NDCG@K"""
        import math

        dcg = sum(
            (2 ** rel - 1) / math.log2(i + 2)
            for i, rel in enumerate(relevance_scores[:k])
        )
        ideal = sorted(relevance_scores, reverse=True)[:k]
        idcg = sum(
            (2 ** rel - 1) / math.log2(i + 2)
            for i, rel in enumerate(ideal)
        )
        return dcg / idcg if idcg > 0 else 0

    def detect_hallucination(self, answer: str, sources: list) -> float:
        """检测幻觉率"""
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""请分析以下回答中有多少信息是检索来源中没有的（即幻觉）。

回答：{answer}
检索来源：{json.dumps(sources, ensure_ascii=False)}

请以 JSON 输出：{{"hallucination_ratio": 0.0-1.0, "hallucinated_claims": ["声明1", ...]}}"""
            }],
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        return result.get("hallucination_ratio", 0)

    def evaluate_cross_modal(self, test_pairs: list) -> float:
        """评估跨模态匹配准确率"""
        correct = 0
        total = len(test_pairs)

        for pair in test_pairs:
            results = self.rag.index.search(
                get_text_embedding(pair["query"]),
                top_k=1,
                modality="image"
            )
            if results["ids"][0] and results["ids"][0][0] == pair["expected_image_id"]:
                correct += 1

        return correct / total if total > 0 else 0

# 使用示例
calculator = MultimodalMetricCalculator()
ndcg = calculator.calculate_ndcg([3, 2, 3, 0, 1, 2], k=5)
print(f"NDCG@5: {ndcg:.4f}")
```

**要点**：
- NDCG 比 Precision 更能反映排序质量——排在前面的结果权重更高
- 幻觉率是多模态 RAG 特有的指标，需要单独检测
- 常见错误：只用准确率一个指标评估，忽略了排序质量、幻觉率和用户体验

### 练习三：报告题——生成评估报告

**思路**：汇总各层评估指标，生成结构化的评估报告，包含指标数据、趋势分析和改进建议。

**答案**：
```python
from datetime import datetime

class EvalReportGenerator:
    """评估报告生成器"""

    def __init__(self, rag_system):
        self.rag = rag_system
        self.client = OpenAI()

    def generate_report(self, eval_results: dict) -> str:
        """生成评估报告"""
        retrieval = eval_results.get("retrieval", {})
        generation = eval_results.get("generation", {})
        ux = eval_results.get("user_experience", {})

        # 评级
        def grade(score, thresholds=(4, 3)):
            if score >= thresholds[0]:
                return "优秀"
            elif score >= thresholds[1]:
                return "良好"
            return "需要改进"

        report = f"""# 多模态 RAG 评估报告

生成时间：{datetime.now().strftime("%Y-%m-%d %H:%M")}
测试用例数：{eval_results.get("test_count", 0)}

## 一、检索层指标
| 指标 | 数值 | 评级 |
|------|------|------|
| Precision@5 | {retrieval.get("precision_at_k", 0):.2f} | {grade(retrieval.get("precision_at_k", 0))} |
| Recall@5 | {retrieval.get("recall_at_k", 0):.2f} | {grade(retrieval.get("recall_at_k", 0))} |
| MRR | {retrieval.get("mrr", 0):.2f} | {grade(retrieval.get("mrr", 0))} |
| 跨模态准确率 | {retrieval.get("cross_modal_accuracy", 0):.2f} | {grade(retrieval.get("cross_modal_accuracy", 0))} |

## 二、生成层指标
| 指标 | 数值 | 评级 |
|------|------|------|
| 准确性 | {generation.get("accuracy", 0):.2f}/5 | {grade(generation.get("accuracy", 0))} |
| 完整性 | {generation.get("completeness", 0):.2f}/5 | {grade(generation.get("completeness", 0))} |
| 图文一致性 | {generation.get("consistency", 0):.2f}/5 | {grade(generation.get("consistency", 0))} |
| 幻觉率 | {generation.get("hallucination_rate", 0):.2%} | {"低" if generation.get("hallucination_rate", 0) < 0.1 else "中" if generation.get("hallucination_rate", 0) < 0.2 else "高"} |

## 三、用户体验指标
| 指标 | 数值 | 评级 |
|------|------|------|
| 平均响应时间 | {ux.get("avg_response_time", 0):.1f}s | {"优秀" if ux.get("avg_response_time", 0) < 3 else "良好" if ux.get("avg_response_time", 0) < 5 else "需要改进"} |
| 首 Token 时间 | {ux.get("first_token_time", 0):.1f}s | {"优秀" if ux.get("first_token_time", 0) < 1 else "良好" if ux.get("first_token_time", 0) < 2 else "需要改进"} |
| 无结果率 | {ux.get("no_result_rate", 0):.2%} | {"低" if ux.get("no_result_rate", 0) < 0.05 else "需要改进"} |

## 四、改进建议
{self._generate_suggestions(eval_results)}
"""
        return report

    def _generate_suggestions(self, eval_results: dict) -> str:
        """基于评估结果生成改进建议"""
        suggestions = []
        retrieval = eval_results.get("retrieval", {})
        generation = eval_results.get("generation", {})

        if retrieval.get("recall_at_k", 0) < 0.7:
            suggestions.append("- 检索召回率偏低，建议增加 Top-K 数量或优化 Embedding 模型")
        if generation.get("hallucination_rate", 0) > 0.15:
            suggestions.append("- 幻觉率较高，建议优化 Prompt 明确要求"仅基于提供的信息回答"")
        if generation.get("consistency", 0) < 3.5:
            suggestions.append("- 图文一致性较低，建议检查图片引用是否正确关联")

        return "\n".join(suggestions) if suggestions else "- 各项指标表现良好，继续保持"

# 使用示例
generator = EvalReportGenerator(rag)
eval_results = {
    "test_count": 50,
    "retrieval": {"precision_at_k": 0.75, "recall_at_k": 0.68, "mrr": 0.82, "cross_modal_accuracy": 0.71},
    "generation": {"accuracy": 4.1, "completeness": 3.8, "consistency": 3.5, "hallucination_rate": 0.12},
    "user_experience": {"avg_response_time": 3.2, "first_token_time": 0.8, "no_result_rate": 0.03}
}
report = generator.generate_report(eval_results)
print(report)
```

**要点**：
- 报告应包含指标数值 + 评级 + 改进建议三个层次，缺一不可
- 改进建议应基于具体指标数据自动生成，而不是泛泛而谈
- 常见错误：报告只有数据没有分析，读者看完不知道该改进什么
