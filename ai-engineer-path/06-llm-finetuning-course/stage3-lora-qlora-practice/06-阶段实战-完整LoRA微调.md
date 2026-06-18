# 06 阶段实战——用领域数据完成一次完整的 LoRA 微调并对比效果

> 把前 5 课学到的知识整合成一个完整的微调实验。

## 学习目标

- 完成一次完整的 LoRA 微调实验
- 对比微调前后的效果
- 输出微调报告

---

## 一、实验设计

```
实验设计：

1. 任务：领域问答
2. 数据：医疗问答数据集（1000 条）
3. 模型：Qwen2.5-7B
4. 方法：QLoRA
5. 评估：准确率、相关性、流畅度
```

---

## 二、完整流程

```python
def run_finetuning_experiment():
    """运行微调实验"""
    
    # 1. 加载数据
    dataset = load_dataset("json", data_files="medical_qa.json")
    
    # 2. 加载模型
    model, tokenizer = load_model_with_qlora("Qwen/Qwen2.5-7B")
    
    # 3. 训练
    trainer = train_model(model, tokenizer, dataset)
    
    # 4. 评估
    results = evaluate_model(trainer.model, tokenizer)
    
    # 5. 对比
    baseline_results = evaluate_baseline()
    
    return {
        "finetuned": results,
        "baseline": baseline_results,
        "improvement": calculate_improvement(results, baseline_results)
    }
```

---

## 三、评估对比

```python
def evaluate_model(model, tokenizer) -> dict:
    """评估模型"""
    test_cases = load_test_cases()
    
    results = {
        "accuracy": 0,
        "relevancy": 0,
        "fluency": 0
    }
    
    for case in test_cases:
        answer = generate_answer(model, tokenizer, case["question"])
        
        # 评估
        results["accuracy"] += check_accuracy(answer, case["reference"])
        results["relevancy"] += check_relevancy(answer, case["question"])
        results["fluency"] += check_fluency(answer)
    
    # 计算平均值
    for key in results:
        results[key] /= len(test_cases)
    
    return results
```

---

## 四、实验报告

```python
def generate_experiment_report(results: dict) -> str:
    """生成实验报告"""
    report = f"""# 微调实验报告

## 实验配置
- 模型：Qwen2.5-7B
- 方法：QLoRA
- 数据量：1000 条
- 训练轮数：3

## 评估结果

| 指标 | 基线 | 微调后 | 提升 |
|------|------|--------|------|
| 准确率 | {results['baseline']['accuracy']:.2%} | {results['finetuned']['accuracy']:.2%} | {results['improvement']['accuracy']:+.2%} |
| 相关性 | {results['baseline']['relevancy']:.2%} | {results['finetuned']['relevancy']:.2%} | {results['improvement']['relevancy']:+.2%} |
| 流畅度 | {results['baseline']['fluency']:.2%} | {results['finetuned']['fluency']:.2%} | {results['improvement']['fluency']:+.2%} |

## 结论
微调后模型在领域问答任务上有显著提升。
"""
    return report
```

---

## 五、运行实验

```bash
# 运行微调
python finetune.py

# 运行评估
python evaluate.py

# 生成报告
python report.py
```

---

## 小结

```
本课核心要点：

1. 完整的微调实验流程
2. 评估指标：准确率、相关性、流畅度
3. 对比微调前后的效果
4. 生成实验报告

阶段总结：
  你已经掌握了 LoRA/QLoRA 微调的完整流程。
  下一阶段，我们将学习训练 Pipeline。
```

---

## 作业

1. **完成实战**：运行完整的微调实验。

2. **评估题**：对微调模型进行全面评估。

3. **报告题**：生成详细的实验报告。
