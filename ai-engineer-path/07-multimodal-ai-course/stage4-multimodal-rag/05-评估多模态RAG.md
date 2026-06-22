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
