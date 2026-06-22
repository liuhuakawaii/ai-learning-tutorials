# 02 Langfuse 快速上手——从 SDK 集成到第一个 Dashboard

> Langfuse 是专为 AI 应用设计的可观测性平台。用好它，你的 AI 应用从此"看得见"。

## 场景引入

你已经知道 AI 应用需要可观测性，但真要落地时发现：用通用的 ELK 栈记日志，Token 消耗和成本信息散落在不同字段里；用 Jaeger 做链路追踪，但 LLM 调用的 input/output 动辄几千 token，直接塞进 span 属性会导致存储暴涨；用 Grafana 看指标，但质量评估分数和幻觉率这些 AI 特有指标没法和传统指标混在一起看。你需要一个专为 LLM 应用设计的可观测性工具——Langfuse 就是为此而生的。

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

## 常见误区

1. **只用 `@observe()` 不设置 `user_id` 和 `session_id`**：没有用户标识的追踪数据在排查问题时毫无用处——你无法知道是哪个用户的哪次会话出了问题。集成时第一件事就是设置用户和会话上下文。

2. **在 Langfuse 中记录过多 Span 层级**：每个工具调用、每次数据库查询都建一个 Span，导致 Trace 树极其深且庞大，反而淹没了关键信息。追踪应该聚焦业务关键路径，不是把每一行代码都 trace 一遍。

3. **把 Langfuse 当日志系统用**：把大段文本、完整文档内容塞进 Span 的 input/output 字段。Langfuse 是追踪平台，不是日志存储。大量数据会拖慢查询性能并推高存储成本。

4. **忽略 Langfuse 的异步特性**：Langfuse SDK 默认异步发送数据，如果在脚本或测试中直接退出进程，可能丢失最后几条 Trace。需要在程序结束前调用 `langfuse.flush()` 确保数据落盘。

## 工程建议

1. **用装饰器而非手动埋点**：优先使用 `@observe()` 装饰器自动追踪，只在需要自定义元数据的少数地方使用手动 `trace.span()`。装饰器方式代码侵入性最低，且能自动捕获异常和耗时。

2. **设置 `generation` 的 `usage` 字段**：Langfuse 会根据 usage 和模型定价自动计算成本，如果不填 usage 字段，成本面板就是空白的。即使 SDK 无法自动提取 token 数，也要手动从 API 响应中读取并传入。

3. **善用 Langfuse 的 Prompt Management**：把 System Prompt 版本化存入 Langfuse，每次 LLM 调用关联 Prompt 版本号。这样当质量突然下降时，能快速排查是否是某次 Prompt 变更导致的回归。

4. **定期清理低价值 Trace**：Langfuse 的 Trace 数据会持续增长，建议设置 30-90 天的数据保留策略。对已分析过的低价值 Trace 定期归档或删除，控制存储成本。

## 小结

```
本课核心要点：

1. Langfuse 核心概念：Trace、Span、Generation、Score
2. 用 @observe() 装饰器自动追踪
3. 集成评估结果到 Langfuse
4. 搭建 Dashboard 监控关键指标

---

**下一课**: [03 调用链路追踪——从用户输入到模型输出的全链路可视化](./03-调用链路追踪.md)
```

---

## 练习

1. **集成题**：将 Langfuse 集成到你的 AI 应用中。

2. **追踪题**：用 Langfuse 追踪一个完整的 RAG 查询链路。

3. **Dashboard 题**：在 Langfuse 中创建一个包含 3 个关键图表的 Dashboard。

---

## 参考答案

### 练习一

**思路**：Langfuse 集成有两种方式——装饰器自动追踪和手动埋点。推荐先用 `@observe()` 装饰器快速集成，再在需要自定义元数据的地方用手动方式补充。关键是设置 `user_id` 和 `session_id`。

**答案**：

```python
import os
from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context
from openai import OpenAI


# 1. 初始化 Langfuse 客户端
langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host="https://cloud.langfuse.com",
)

client = OpenAI()


# 2. 用装饰器自动追踪 LLM 调用
@observe(as_type="generation")
def call_llm(prompt: str, model: str = "gpt-4o") -> str:
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    # Langfuse 自动捕获 input/output/model/tokens/latency
    return response.choices[0].message.content


# 3. 追踪完整业务流程
@observe()
def rag_query(question: str, user_id: str) -> dict:
    # 设置用户信息（关键！）
    langfuse_context.update_current_trace(
        user_id=user_id,
        session_id=f"session_{user_id}",
        metadata={"feature": "rag_query"},
    )

    # RAG 检索
    contexts = retrieve_contexts(question)

    # LLM 生成
    prompt = f"基于以下信息回答：\n{chr(10).join(contexts)}\n\n问题：{question}"
    answer = call_llm(prompt)

    return {"answer": answer, "contexts": contexts}


def retrieve_contexts(query: str) -> list[str]:
    # 模拟检索
    return ["RAG 是检索增强生成的缩写...", "RAG 结合了检索和生成两种能力..."]


# 4. 使用
result = rag_query("什么是 RAG？", user_id="user_123")
print(result["answer"])

# 5. 确保数据落盘
langfuse.flush()
```

**要点**：
- 集成后第一件事是设置 `user_id`，否则追踪数据在排查问题时无法关联到具体用户
- `langfuse.flush()` 在脚本/测试中必须调用，否则进程退出时会丢失最后几条 Trace
- 常见错误：只集成 `@observe()` 但不设置 `user_id` 和 `session_id`，导致追踪数据只有技术信息没有业务上下文

### 练习二

**思路**：RAG 查询链路包含查询重写、向量检索、重排序、上下文组装、LLM 生成、后处理等步骤。每一步用 `@observe()` 装饰器追踪，Langfuse 会自动构建 Trace 树。

**答案**：

```python
from langfuse.decorators import observe, langfuse_context
from openai import OpenAI

client = OpenAI()


@observe(as_type="generation")
def rewrite_query(original_query: str) -> str:
    """查询重写"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "将用户问题改写为更适合搜索的形式，只输出改写后的查询"},
            {"role": "user", "content": original_query},
        ],
    )
    return response.choices[0].message.content


@observe()
def vector_search(query: str, top_k: int = 10) -> list[dict]:
    """向量搜索"""
    # 模拟向量数据库查询
    return [
        {"content": f"文档片段 {i}", "score": 0.9 - i * 0.05, "source": f"doc_{i}.md"}
        for i in range(top_k)
    ]


@observe()
def rerank(query: str, documents: list[dict], top_k: int = 5) -> list[dict]:
    """重排序"""
    # 模拟重排序
    return sorted(documents, key=lambda d: d["score"], reverse=True)[:top_k]


@observe(as_type="generation")
def generate_answer(question: str, contexts: list[str]) -> str:
    """LLM 生成回答"""
    context_text = "\n".join(f"[{i+1}] {c}" for i, c in enumerate(contexts))
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "基于参考资料回答，标注引用来源"},
            {"role": "user", "content": f"参考资料：\n{context_text}\n\n问题：{question}"},
        ],
    )
    return response.choices[0].message.content


@observe()
def full_rag_pipeline(question: str, user_id: str) -> dict:
    """完整的 RAG 查询链路"""
    langfuse_context.update_current_trace(
        user_id=user_id,
        metadata={"pipeline": "full_rag"},
    )

    # 1. 查询重写
    rewritten = rewrite_query(question)

    # 2. 向量检索
    search_results = vector_search(rewritten, top_k=10)

    # 3. 重排序
    ranked = rerank(question, search_results, top_k=5)

    # 4. 生成回答
    contexts = [d["content"] for d in ranked]
    answer = generate_answer(question, contexts)

    # 5. 记录评估分数
    langfuse_context.score_current_trace(
        name="quality",
        value=4,
        comment="回答准确，引用了正确的来源",
    )

    return {
        "answer": answer,
        "sources": [d["source"] for d in ranked],
        "steps": {
            "rewritten_query": rewritten,
            "retrieved_count": len(search_results),
            "reranked_count": len(ranked),
        },
    }


# 运行
result = full_rag_pipeline("RAG 的工作原理是什么？", "user_456")
print(f"回答: {result['answer']}")
print(f"来源: {result['sources']}")
```

**要点**：
- 每个子步骤都用 `@observe()` 装饰，Langfuse 会自动构建父子关系的 Trace 树
- 查询重写和 LLM 生成用 `as_type="generation"` 标记，Langfuse 会自动记录 Token 消耗和成本
- 常见错误：只追踪了 LLM 调用，没有追踪检索和重排序，导致检索质量差时无法定位问题

### 练习三

**思路**：Dashboard 应包含三个关键图表——质量趋势图（监控质量变化）、延迟分布图（发现性能瓶颈）、成本趋势图（控制预算）。每个图表都要有阈值线作为参考。

**答案**：

```python
# Langfuse Dashboard 配置方案（概念实现）

DASHBOARD_CONFIG = {
    "name": "AI 应用质量监控 Dashboard",
    "charts": [
        {
            "name": "质量评分趋势",
            "type": "line",
            "data_source": "scores",
            "metric": "quality",
            "aggregation": "daily_average",
            "time_range": "7d",
            "threshold_line": 0.75,
            "description": "每日平均质量评分，低于 0.75 触发告警",
        },
        {
            "name": "P50/P95 延迟分布",
            "type": "multi_line",
            "data_source": "traces",
            "metrics": ["latency_p50", "latency_p95"],
            "aggregation": "hourly_percentile",
            "time_range": "24h",
            "threshold_line": 5.0,
            "description": "延迟分位数趋势，P95 超过 5 秒需要优化",
        },
        {
            "name": "日成本趋势",
            "type": "bar",
            "data_source": "generations",
            "metric": "total_cost",
            "aggregation": "daily_sum",
            "time_range": "30d",
            "threshold_line": 100,
            "description": "每日 API 成本，超过 $100 触发告警",
        },
    ],
    "alerts": [
        {
            "name": "质量下降",
            "condition": "avg(quality_score, 1h) < 0.7",
            "severity": "high",
            "channel": "slack",
        },
        {
            "name": "延迟飙升",
            "condition": "p95(latency, 1h) > 8",
            "severity": "medium",
            "channel": "slack",
        },
        {
            "name": "成本异常",
            "condition": "sum(cost, 1d) > 80",
            "severity": "medium",
            "channel": "email",
        },
    ],
}


def setup_langfuse_dashboard():
    """在 Langfuse 中配置 Dashboard 的步骤"""
    steps = """
    1. 登录 Langfuse 控制台
    2. 进入 Analytics → Dashboard
    3. 添加图表：
       a. 质量趋势图：选择 Scores → 按天聚合 → 添加阈值线 0.75
       b. 延迟分布图：选择 Traces → latency → P50/P95 分位数
       c. 成本趋势图：选择 Generations → cost → 按天求和
    4. 配置告警规则：
       a. 质量 < 0.7 时发送 Slack 通知
       b. P95 延迟 > 5s 时发送 Slack 通知
       c. 日成本 > $80 时发送邮件
    5. 设置 Dashboard 自动刷新间隔为 5 分钟
    """
    print(steps)


setup_langfuse_dashboard()
```

**要点**：
- Dashboard 的三个图表覆盖质量、性能、成本三个维度，缺一不可
- 每个图表都要有阈值线，否则看到数字变化却不知道是否需要行动
- 常见错误：堆了 10 个图表但没有告警规则，导致 Dashboard 只是"好看"而无法驱动运维行动
