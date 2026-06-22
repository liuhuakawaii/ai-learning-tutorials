# 01 RAG 评估全景——检索质量与生成质量的分离评估思路

> RAG 系统出问题了——是检索没找对，还是生成答错了？不拆开看，你永远不知道。

## 场景引入

你上线了一个企业知识库问答系统，用户反馈"回答不准确"。你检查了 Prompt，优化了模型参数，但问题依旧。后来发现，根本原因是向量检索召回的文档就不是用户需要的——生成模型拿到的上下文从一开始就是错的。如果不把检索和生成拆开分别评估，你可能永远在错误的方向上优化。

## 学习目标

- 理解 RAG 系统评估的分层架构
- 掌握"检索-生成"分离评估的核心思想
- 建立 RAG 评估的完整指标体系

---

## 一、为什么要分离评估

### 1.1 RAG 的两阶段

```
RAG 系统的工作流程：

用户问题
    │
    ▼
┌──────────────┐
│  检索阶段     │  从知识库中找到相关文档
│  (Retrieval) │
└──────┬───────┘
       │ 检索到的上下文
       ▼
┌──────────────┐
│  生成阶段     │  基于上下文生成回答
│  (Generation)│
└──────┬───────┘
       │
       ▼
    最终回答

问题：如果最终回答不好，问题出在哪？
  - 可能是检索阶段没找到正确的文档
  - 可能是生成阶段找到了但没用好
  - 也可能是两者都有问题
```

### 1.2 分离评估的价值

```
场景对比：

不分离评估：
  用户问："公司的年假政策是什么？"
  系统回答："公司没有明确的年假政策。"
  评估：回答错误 → 0 分
  结论：系统需要优化
  问题：不知道该优化检索还是生成

分离评估：
  检索结果：返回了 3 个文档，但都不是关于年假的
  评估：检索质量差 → 需要优化检索策略
  
  或者：
  检索结果：返回了年假政策文档
  生成回答："公司没有明确的年假政策。"
  评估：生成质量差（幻觉）→ 需要优化生成 Prompt

分离评估让你知道"该修哪里"。
```

---

## 二、RAG 评估的三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG 评估三层架构                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  第一层：检索评估（Retrieval Evaluation）                     │
│  ├── 检索到的文档是否相关？                                   │
│  ├── 相关文档是否都被检索到了？                               │
│  ├── 检索结果的排序是否合理？                                 │
│  └── 核心指标：Precision, Recall, Relevancy, MRR             │
│                                                             │
│  第二层：生成评估（Generation Evaluation）                    │
│  ├── 回答是否忠实于上下文？                                   │
│  ├── 回答是否完整、相关？                                     │
│  ├── 回答是否有幻觉？                                        │
│  └── 核心指标：Faithfulness, Relevancy, Hallucination        │
│                                                             │
│  第三层：端到端评估（End-to-End Evaluation）                  │
│  ├── 用户整体体验如何？                                       │
│  ├── 回答是否解决了用户的问题？                               │
│  ├── 延迟和成本是否可接受？                                   │
│  └── 核心指标：用户满意度, 任务完成率, 延迟, 成本             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、检索评估指标

### 3.1 Context Precision（上下文精确率）

```python
def context_precision(retrieved: list[str], relevant: list[str]) -> float:
    """计算检索精确率
    检索到的文档中，有多少是真正相关的？
    """
    if not retrieved:
        return 0.0
    
    relevant_set = set(relevant)
    true_positives = sum(1 for doc in retrieved if doc in relevant_set)
    
    return true_positives / len(retrieved)

# 示例
retrieved_docs = ["doc1", "doc2", "doc3", "doc4", "doc5"]
relevant_docs = ["doc1", "doc3", "doc6", "doc7"]

precision = context_precision(retrieved_docs, relevant_docs)
# precision = 2/5 = 0.4
```

### 3.2 Context Recall（上下文召回率）

```python
def context_recall(retrieved: list[str], relevant: list[str]) -> float:
    """计算检索召回率
    所有相关文档中，有多少被检索到了？
    """
    if not relevant:
        return 1.0
    
    relevant_set = set(relevant)
    retrieved_set = set(retrieved)
    true_positives = len(retrieved_set & relevant_set)
    
    return true_positives / len(relevant_set)

# 示例
recall = context_recall(retrieved_docs, relevant_docs)
# recall = 2/4 = 0.5
```

### 3.3 Context Relevancy（上下文相关性）

```python
def context_relevancy(question: str, contexts: list[str], client) -> float:
    """用 LLM 评估检索到的上下文与问题的相关程度"""
    
    scores = []
    for ctx in contexts:
        prompt = f"""请评估以下文档与问题的相关程度。

问题：{question}
文档：{ctx}

评分（1-5）：
1 分：完全不相关
2 分：略微相关
3 分：部分相关
4 分：高度相关
5 分：完全相关

请只输出数字。"""
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        scores.append(int(response.choices[0].message.content.strip()))
    
    return sum(scores) / len(scores) / 5.0  # 归一化到 0-1
```

### 3.4 MRR（Mean Reciprocal Rank）

```python
def mean_reciprocal_rank(queries_results: list[list[str]], queries_relevant: list[list[str]]) -> float:
    """计算平均倒数排名
    第一个相关文档出现在第几位？
    """
    rr_sum = 0.0
    
    for results, relevant in zip(queries_results, queries_relevant):
        relevant_set = set(relevant)
        for rank, doc in enumerate(results, 1):
            if doc in relevant_set:
                rr_sum += 1.0 / rank
                break
    
    return rr_sum / len(queries_results)

# 示例
# 查询 1：第一个相关文档在第 2 位 → RR = 1/2 = 0.5
# 查询 2：第一个相关文档在第 1 位 → RR = 1/1 = 1.0
# MRR = (0.5 + 1.0) / 2 = 0.75
```

---

## 四、生成评估指标

### 4.1 Faithfulness（忠实度）

```python
def faithfulness_eval(contexts: list[str], answer: str, client) -> dict:
    """评估回答是否忠实于上下文"""
    
    context_text = "\n".join(contexts)
    
    prompt = f"""请评估以下回答是否忠实于给定的参考资料。

参考资料：
{context_text}

回答：
{answer}

请将回答拆解为多个声明（claims），检查每个声明是否能在参考资料中找到依据。

请以 JSON 格式输出：
{{"total_claims": <数量>, "supported_claims": <有依据的数量>, "faithfulness_score": <0-1>, "unsupported": ["无依据的声明1", "无依据的声明2"]}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)
```

### 4.2 Answer Relevancy（回答相关性）

```python
def answer_relevancy_eval(question: str, answer: str, client) -> dict:
    """评估回答与问题的相关程度"""
    
    prompt = f"""请评估以下回答与问题的相关程度。

问题：{question}
回答：{answer}

评估维度：
1. 回答是否直接回应了问题？
2. 回答是否包含无关信息？
3. 回答是否遗漏了问题的关键方面？

请以 JSON 格式输出：
{{"relevancy_score": <0-1>, "missing_aspects": ["遗漏的方面"], "irrelevant_info": ["无关信息"], "reasoning": "理由"}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)
```

### 4.3 Hallucination Detection（幻觉检测）

```python
def hallucination_detection(contexts: list[str], answer: str, client) -> dict:
    """检测回答中的幻觉"""
    
    context_text = "\n".join(contexts)
    
    prompt = f"""请检测以下回答中的幻觉（编造的信息）。

参考资料：
{context_text}

回答：
{answer}

请检查：
1. 回答中的事实声明是否能在参考资料中找到依据
2. 是否有编造的数据、日期、数字
3. 是否有无中生有的信息

请以 JSON 格式输出：
{{"has_hallucination": <true/false>, "hallucination_score": <0-1, 0=无幻觉>, "hallucinated_facts": ["幻觉1", "幻觉2"], "reasoning": "理由"}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)
```

---

## 五、端到端评估

### 5.1 综合评估函数

```python
class RAGEvaluator:
    """RAG 系统完整评估器"""
    
    def __init__(self, client):
        self.client = client
    
    def evaluate_single(
        self,
        question: str,
        answer: str,
        contexts: list[str],
        reference: str = None
    ) -> dict:
        """评估单个 RAG 结果"""
        
        results = {
            "question": question,
            "answer": answer,
            "retrieval": {},
            "generation": {},
            "e2e": {}
        }
        
        # 检索评估
        if reference:
            results["retrieval"]["relevancy"] = context_relevancy(
                question, contexts, self.client
            )
        
        # 生成评估
        results["generation"]["faithfulness"] = faithfulness_eval(
            contexts, answer, self.client
        )
        results["generation"]["relevancy"] = answer_relevancy_eval(
            question, answer, self.client
        )
        results["generation"]["hallucination"] = hallucination_detection(
            contexts, answer, self.client
        )
        
        # 综合评分
        gen_scores = [
            results["generation"]["faithfulness"].get("faithfulness_score", 0),
            results["generation"]["relevancy"].get("relevancy_score", 0),
            1 - results["generation"]["hallucination"].get("hallucination_score", 0)
        ]
        results["e2e"]["overall_score"] = sum(gen_scores) / len(gen_scores)
        
        return results
    
    def batch_evaluate(self, dataset: list[dict]) -> list[dict]:
        """批量评估"""
        results = []
        for i, item in enumerate(dataset):
            print(f"评估 {i+1}/{len(dataset)}: {item['question'][:30]}...")
            result = self.evaluate_single(
                question=item["question"],
                answer=item.get("answer", ""),
                contexts=item.get("contexts", []),
                reference=item.get("reference")
            )
            results.append(result)
        return results
```

---

## 六、评估结果的解读

### 6.1 问题诊断矩阵

```
诊断决策树：

整体评分低
│
├── 检索评分低
│   ├── Precision 低 → 检索到了很多不相关的文档
│   │   └── 优化：调整检索策略、增加过滤
│   │
│   └── Recall 低 → 很多相关文档没检索到
│       └── 优化：增加检索数量、优化 embedding
│
└── 检索评分高，生成评分低
    ├── Faithfulness 低 → 回答不忠实于上下文
    │   └── 优化：Prompt 中强调"基于参考资料回答"
    │
    ├── Relevancy 低 → 回答不切题
    │   └── 优化：Prompt 中明确问题要求
    │
    └── Hallucination 高 → 有幻觉
        └── 优化：Prompt 中强调"不要编造信息"
```

---

## 常见误区

1. **只看端到端分数，不拆分检索和生成**：整体回答质量差可能有多种原因，不拆开看就无法定位瓶颈，优化方向完全错误。

2. **评估数据集太小或太简单**：用 5 个简单问题评估说"系统没问题"，上线后才发现复杂查询全面崩溃。评估集要覆盖边界情况。

3. **混淆检索评估和生成评估的指标**：用 Faithfulness 来判断检索质量，或者用 Precision 来判断生成质量——指标用错位置会导致错误结论。

4. **忽略评估指标之间的冲突**：高 Recall 低 Precision 意味着检索了大量文档，可能提升生成质量但增加成本和延迟，需要找到平衡点。

## 工程建议

1. **先跑基线再优化**：在做任何改动之前，先用当前系统跑一遍完整评估，建立基线数据。后续所有优化都要和基线对比。

2. **评估数据集要分级**：按问题难度（简单/中等/复杂）和类型（事实查询/多跳推理/摘要）分别统计指标，而不是只看平均分。

3. **建立问题诊断矩阵**：根据检索和生成指标的不同组合，制定标准化的优化策略，避免每次都是"凭感觉"调参。

4. **自动化评估流程**：把评估脚本集成到 CI/CD 中，每次 Prompt 或模型变更后自动运行，防止质量回退。

## 小结

```
本课核心要点：

1. RAG 评估要分离检索和生成两个阶段
2. 检索指标：Precision, Recall, Relevancy, MRR
3. 生成指标：Faithfulness, Relevancy, Hallucination
4. 分离评估能帮你定位"该修哪里"
5. 端到端评估反映用户体验，但不能指导优化方向

---

**下一课**: [02 检索评估指标——Context Precision / Recall / Relevancy 的计算](./02-检索评估指标.md)
```

---

## 练习

1. **诊断题**：你的 RAG 系统 Precision=0.8, Recall=0.3, Faithfulness=0.9。问题出在哪？如何优化？

2. **实现题**：实现一个 `context_relevancy` 函数，用 LLM 评估每个检索片段与问题的相关性。

3. **分析题**：为什么 MRR 比简单的 Precision 更能反映检索质量？
