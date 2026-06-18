# 02 Langfuse 快速上手——从 SDK 集成到第一个 Dashboard

> Langfuse 是专为 AI 应用设计的可观测性平台。用好它，你的 AI 应用从此"看得见"。

## 学习目标

- 掌握 Langfuse 的核心概念和 API
- 学会集成 Langfuse 到你的 AI 应用
- 搭建第一个监控 Dashboard

---

## 一、Langfuse 简介

### 1.1 安装与配置

```bash
pip install langfuse
```

```python
from langfuse import Langfuse

langfuse = Langfuse(
    public_key="pk-...",
    secret_key="sk-...",
    host="https://cloud.langfuse.com"  # 或自部署地址
)
```

### 1.2 核心概念

```
Langfuse 的数据模型：

Trace（追踪）
  ├── 一个完整的用户请求链路
  ├── 包含多个 Span
  └── 记录开始时间、结束时间、元数据

Span（跨度）
  ├── Trace 中的一个操作
  ├── 可以嵌套（Span 包含子 Span）
  └── 记录操作名称、输入输出、耗时

Generation（生成）
  ├── 特殊类型的 Span
  ├── 专门用于记录 LLM 调用
  └── 记录模型、Token 消耗、成本

Score（评分）
  ├── 对 Trace 或 Span 的评估
  ├── 支持数值评分和分类评分
  └── 用于质量监控
```

---

## 二、基础集成

### 2.1 追踪 LLM 调用

```python
from langfuse.decorators import observe

@observe()
def call_llm(prompt: str, model: str = "gpt-4o") -> str:
    """带追踪的 LLM 调用"""
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )
    
    # Langfuse 自动记录：
    # - 输入（prompt）
    # - 输出（response）
    # - 模型名称
    # - Token 消耗
    # - 延迟
    
    return response.choices[0].message.content

@observe()
def rag_query(question: str) -> str:
    """带追踪的 RAG 查询"""
    # 1. 检索
    contexts = retrieve_contexts(question)
    
    # 2. 生成
    prompt = f"基于以下信息回答：\n{contexts}\n\n问题：{question}"
    answer = call_llm(prompt)
    
    return answer
```

### 2.2 手动追踪

```python
def manual_trace_example():
    """手动追踪示例"""
    
    # 创建 Trace
    trace = langfuse.trace(
        name="user-query",
        input={"question": "什么是 RAG？"},
        metadata={"user_id": "user_123"}
    )
    
    # 创建 Span
    retrieval_span = trace.span(
        name="retrieval",
        input={"query": "什么是 RAG？"}
    )
    
    # 执行检索
    contexts = retrieve_contexts("什么是 RAG？")
    retrieval_span.end(output={"contexts": contexts})
    
    # 创建 Generation
    generation = trace.generation(
        name="llm-call",
        model="gpt-4o",
        input={"prompt": f"基于以下信息回答：{contexts}"}
    )
    
    # 执行 LLM 调用
    answer = call_llm(f"基于以下信息回答：{contexts}")
    
    generation.end(
        output={"answer": answer},
        usage={"input": 500, "output": 200}
    )
    
    # 添加评分
    trace.score(
        name="quality",
        value=4,
        comment="回答准确且完整"
    )
    
    trace.end(output={"answer": answer})
```

---

## 三、评估集成

### 3.1 自动评估评分

```python
from langfuse.decorators import observe, langfuse_context

@observe()
def evaluate_and_score(question: str, answer: str, contexts: list[str]):
    """评估并记录评分"""
    
    # 运行评估
    eval_result = faithfulness_eval(contexts, answer, client)
    
    # 记录评分到 Langfuse
    langfuse_context.score_current_trace(
        name="faithfulness",
        value=eval_result["faithfulness_score"]
    )
    
    return eval_result
```

---

## 四、Dashboard 配置

### 4.1 关键图表

```
推荐的 Dashboard 图表：

1. 请求量趋势
   - 按小时/天统计请求数
   - 及时发现流量异常

2. 延迟分布
   - P50、P95、P99 延迟
   - 识别性能瓶颈

3. Token 消耗
   - 按模型统计 Token 数
   - 监控成本趋势

4. 成本统计
   - 日/周/月成本
   - 按功能模块统计

5. 质量评分
   - 平均质量分趋势
   - 低分案例统计

6. 错误率
   - 按错误类型统计
   - 错误趋势监控
```

---

## 小结

```
本课核心要点：

1. Langfuse 核心概念：Trace、Span、Generation、Score
2. 用 @observe() 装饰器自动追踪
3. 集成评估结果到 Langfuse
4. 搭建 Dashboard 监控关键指标

下一课：调用链路追踪——从用户输入到模型输出的全链路可视化。
```

---

## 练习

1. **集成题**：将 Langfuse 集成到你的 AI 应用中。

2. **追踪题**：用 Langfuse 追踪一个完整的 RAG 查询链路。

3. **Dashboard 题**：在 Langfuse 中创建一个包含 3 个关键图表的 Dashboard。
