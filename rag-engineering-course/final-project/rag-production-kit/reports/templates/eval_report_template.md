# 评估报告模板

## 概览

- **评估日期**: {{date}}
- **数据集**: {{dataset_name}}
- **样本数量**: {{sample_count}}
- **评估指标**: {{metrics}}

## 评估结果

| 指标 | 分数 | 基线 | 变化 |
|------|------|------|------|
| Faithfulness | {{faithfulness}} | - | - |
| Answer Relevancy | {{answer_relevancy}} | - | - |
| Context Precision | {{context_precision}} | - | - |
| Context Recall | {{context_recall}} | - | - |

## 检索质量

| 指标 | 分数 |
|------|------|
| Recall@5 | {{recall_5}} |
| MRR | {{mrr}} |
| NDCG@5 | {{ndcg_5}} |

## 性能指标

| 指标 | 数值 |
|------|------|
| P50 延迟 | {{p50_latency}} |
| P95 延迟 | {{p95_latency}} |
| P99 延迟 | {{p99_latency}} |
| 吞吐量 (QPS) | {{qps}} |

## 问题分析

### 低分样本分析

{{low_score_analysis}}

### 改进建议

{{improvement_suggestions}}

## 结论

{{conclusion}}
