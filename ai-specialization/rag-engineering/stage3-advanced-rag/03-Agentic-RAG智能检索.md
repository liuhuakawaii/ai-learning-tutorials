# 03 - Agentic RAG 智能检索

> Stage 3 Lesson 3 | 前置要求：Lesson 02 完成 | 时长：55 分钟

```
╔══════════════════════════════════════════════════════════════╗
║           Agentic RAG: 让 Agent 来决定怎么检索               ║
║                                                              ║
║    "不是一次检索，而是一个有思考、有策略的检索过程"          ║
╚══════════════════════════════════════════════════════════════╝
```

## 场景引入

用户问"帮我对比 A 方案和 B 方案的优缺点，并给出推荐"。你的 RAG 系统尝试用单次检索来回答，但 A 方案和 B 方案的信息分散在不同文档中，而且"对比"和"推荐"需要多步推理。传统 RAG 是单次检索-单次生成的模式，无法处理这种需要"先分别检索，再综合分析"的复杂任务。Agentic RAG 让 LLM 像一个智能代理一样，自主规划检索策略、分步执行、动态调整，是处理复杂查询的终极方案。

## 🎯 学习目标

完成本课后，你将能够：

1. 理解 Agent 驱动检索的核心思想
2. 使用 LangGraph 构建 Agentic RAG 系统
3. 定义和管理检索工具
4. 实现多步推理和错误恢复机制
5. 对比 Static RAG 与 Agentic RAG 的差异

---

## 1. 从 Static RAG 到 Agentic RAG

### 1.1 Static RAG 的局限

传统 RAG 是一个固定的管道：查询 → 检索 → 生成。这种"一次性"流程存在明显局限：

```
  Static RAG 的问题
  ═════════════════

  用户: "比较 A 公司和 B 公司的营收增长策略"

  Static RAG 流程:
  ┌──────────┐    ┌──────────────────┐    ┌──────────┐
  │ 问题      │───►│ 一次检索          │───►│ 生成答案  │
  └──────────┘    │ 可能只找到 A 公司  │    └──────────┘
                  │ 没有 B 公司的信息  │
                  └──────────────────┘

  问题:
  1. 只执行一次检索，信息可能不完整
  2. 不会根据中间结果调整策略
  3. 检索失败时没有恢复机制
  4. 无法分解复杂问题
```

### 1.2 Agentic RAG 的核心思想

Agentic RAG 将检索过程交给一个 Agent 来管理。Agent 可以：

- **规划**：分解复杂问题为子问题
- **决策**：选择使用哪个检索工具
- **迭代**：根据中间结果调整检索策略
- **恢复**：检索失败时尝试替代方案

```
  Agentic RAG 循环
  ════════════════

                    ┌───────────────────┐
                    │     用户问题       │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
              ┌────►│     Agent 思考     │◄────┐
              │     └─────────┬─────────┘     │
              │               │               │
              │               ▼               │
              │     ┌───────────────────┐     │
              │     │   选择工具/动作    │     │
              │     └─────────┬─────────┘     │
              │               │               │
              │     ┌─────────┼─────────┐     │
              │     │         │         │     │
              │     ▼         ▼         ▼     │
              │  ┌──────┐ ┌──────┐ ┌──────┐  │
              │  │检索工具│ │计算工具│ │推理工具│  │
              │  └──┬───┘ └──┬───┘ └──┬───┘  │
              │     │         │         │     │
              │     └─────────┼─────────┘     │
              │               │               │
              │               ▼               │
              │     ┌───────────────────┐     │
              │     │   评估中间结果     │     │
              │     │   需要继续吗?      │     │
              │     └─────────┬─────────┘     │
              │          Yes  │  No           │
              └───────────────┘       │       │
                                      ▼       │
                            ┌───────────────┐ │
                            │   生成最终答案  │ │
                            └───────────────┘ │
```

---

## 2. LangGraph 基础

### 2.1 什么是 LangGraph？

LangGraph 是 LangChain 生态中的状态图框架，用于构建有状态的 Agent 应用。

```
  LangGraph 核心概念
  ══════════════════

  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │   StateGraph: 有状态的工作流图                   │
  │                                                  │
  │   ┌─────────┐    edge     ┌─────────┐           │
  │   │ Node A  │───────────►│ Node B  │           │
  │   └─────────┘            └─────────┘           │
  │        │                       │                │
  │        │    conditional edge   │                │
  │        └───────────┬───────────┘                │
  │                    ▼                            │
  │              ┌─────────┐                        │
  │              │ Node C  │                        │
  │              └─────────┘                        │
  │                                                  │
  │   State: 在节点之间传递的共享状态                │
  │   Node: 执行具体逻辑的函数                       │
  │   Edge: 节点之间的连接（可带条件）               │
  └──────────────────────────────────────────────────┘
```

### 2.2 LangGraph 基础用法

```python
"""
Agentic RAG 智能检索系统实现
Stage 3 - Lesson 03
"""

import os
from typing import TypedDict, Annotated, Literal
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

os.environ["OPENAI_API_KEY"] = "your-api-key-here"

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")


# ============================================================
# 定义 Agent 状态
# ============================================================

class AgentState(TypedDict):
    """Agent 的共享状态"""
    messages: Annotated[list, add_messages]
    retrieved_docs: list[str]
    intermediate_results: list[str]
    final_answer: str
```

---

## 3. 定义检索工具

### 3.1 工具设计

```python
# ============================================================
# 工具定义
# ============================================================

# 模拟向量数据库
vectorstore = None  # 在实际使用中初始化


def init_vectorstore(docs: list[str]):
    """初始化向量数据库"""
    from langchain_core.documents import Document
    documents = [Document(page_content=doc) for doc in docs]
    global vectorstore
    vectorstore = Chroma.from_documents(documents, embeddings)
    return vectorstore


@tool
def search_documents(query: str) -> str:
    """搜索相关文档。用于查找与查询相关的文档片段。

    Args:
        query: 搜索查询
    """
    if vectorstore is None:
        return "向量数据库未初始化"

    docs = vectorstore.similarity_search(query, k=3)
    if not docs:
        return "未找到相关文档"

    results = []
    for i, doc in enumerate(docs):
        results.append(f"[文档 {i+1}] {doc.page_content}")

    return "\n\n".join(results)


@tool
def search_by_keyword(keyword: str) -> str:
    """通过关键词搜索文档。用于精确匹配特定术语。

    Args:
        keyword: 要搜索的关键词
    """
    if vectorstore is None:
        return "向量数据库未初始化"

    docs = vectorstore.similarity_search(keyword, k=2)
    if not docs:
        return f"未找到包含 '{keyword}' 的文档"

    results = []
    for doc in docs:
        if keyword.lower() in doc.page_content.lower():
            results.append(doc.page_content)

    if not results:
        return f"未找到包含 '{keyword}' 的文档"

    return "\n\n".join(results)


@tool
def summarize_findings(findings: str) -> str:
    """总结已收集的信息。用于整理和概括检索到的内容。

    Args:
        findings: 要总结的发现内容
    """
    prompt = ChatPromptTemplate.from_template(
        "请用 2-3 句话简洁总结以下内容:\n\n{findings}"
    )
    chain = prompt | llm
    result = chain.invoke({"findings": findings})
    return result.content


# 工具列表
tools = [search_documents, search_by_keyword, summarize_findings]
tool_map = {t.name: t for t in tools}
```

---

## 4. 构建 Agentic RAG Agent

### 4.1 Agent 节点逻辑

```python
# ============================================================
# Agent 节点
# ============================================================

SYSTEM_PROMPT = """你是一个智能检索助手。你可以使用以下工具来帮助回答问题:

1. search_documents: 语义搜索相关文档
2. search_by_keyword: 关键词精确搜索
3. summarize_findings: 总结已收集的信息

工作流程:
1. 首先分析用户问题，确定需要检索什么
2. 使用搜索工具收集相关信息
3. 如果信息不足，尝试不同的搜索策略
4. 当收集到足够信息后，给出最终答案

重要:
- 如果第一次搜索结果不理想，尝试换一种搜索方式
- 可以多次搜索来收集完整信息
- 最终答案要基于检索到的内容"""


def agent_node(state: AgentState) -> AgentState:
    """Agent 决策节点"""
    messages = state["messages"]

    # 添加系统提示
    if not messages or not isinstance(messages[0], SystemMessage):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages

    # 调用 LLM（绑定工具）
    llm_with_tools = llm.bind_tools(tools)
    response = llm_with_tools.invoke(messages)

    return {
        "messages": [response],
    }


def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """判断是否需要继续使用工具"""
    last_message = state["messages"][-1]

    # 如果 LLM 调用了工具，继续执行
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"

    # 否则结束
    return "end"
```

### 4.2 构建状态图

```python
# ============================================================
# 构建 Agentic RAG 图
# ============================================================

def build_agentic_rag_graph():
    """构建 Agentic RAG 状态图"""

    # 创建状态图
    workflow = StateGraph(AgentState)

    # 添加节点
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", ToolNode(tools))

    # 设置入口
    workflow.set_entry_point("agent")

    # 添加条件边
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "end": END,
        },
    )

    # 工具执行后回到 Agent
    workflow.add_edge("tools", "agent")

    # 编译图
    app = workflow.compile()

    return app


# ============================================================
# 运行 Agentic RAG
# ============================================================

def run_agentic_rag(question: str, docs: list[str] = None) -> str:
    """运行 Agentic RAG"""
    # 初始化向量数据库
    if docs:
        init_vectorstore(docs)

    # 构建图
    graph = build_agentic_rag_graph()

    # 运行
    result = graph.invoke({
        "messages": [HumanMessage(content=question)],
        "retrieved_docs": [],
        "intermediate_results": [],
        "final_answer": "",
    })

    # 提取最终答案
    final_message = result["messages"][-1]
    return final_message.content
```

---

## 5. 多步推理实现

### 5.1 问题分解

```python
# ============================================================
# 多步推理：问题分解
# ============================================================

DECOMPOSE_PROMPT = ChatPromptTemplate.from_template(
    """你是一个问题分解专家。请将以下复杂问题分解为 2-4 个简单的子问题，
每个子问题都可以独立检索回答。

原始问题: {question}

请以 JSON 格式输出:
{{
    "sub_questions": ["子问题1", "子问题2", ...],
    "reasoning": "分解理由"
}}"""
)


def decompose_question(question: str) -> list[str]:
    """将复杂问题分解为子问题"""
    chain = DECOMPOSE_PROMPT | llm
    result = chain.invoke({"question": question})

    import json
    try:
        data = json.loads(result.content)
        return data.get("sub_questions", [question])
    except json.JSONDecodeError:
        return [question]


class MultiStepRAG:
    """多步推理 RAG"""

    def __init__(self, retriever, llm):
        self.retriever = retriever
        self.llm = llm

    def run(self, question: str) -> str:
        """运行多步推理"""
        # Step 1: 分解问题
        sub_questions = decompose_question(question)
        print(f"📋 分解为 {len(sub_questions)} 个子问题:")
        for i, sq in enumerate(sub_questions):
            print(f"  {i+1}. {sq}")

        # Step 2: 逐个检索子问题
        sub_answers = []
        for sq in sub_questions:
            docs = self.retriever.invoke(sq)
            context = "\n".join([d.page_content for d in docs])

            answer_prompt = ChatPromptTemplate.from_template(
                "基于以下信息回答问题:\n{context}\n\n问题: {question}"
            )
            chain = answer_prompt | self.llm
            answer = chain.invoke({
                "context": context,
                "question": sq,
            })
            sub_answers.append({
                "question": sq,
                "answer": answer.content,
                "sources": [d.page_content[:100] for d in docs],
            })

        # Step 3: 综合子答案生成最终答案
        synthesis_context = "\n\n".join([
            f"问题: {sa['question']}\n答案: {sa['answer']}"
            for sa in sub_answers
        ])

        synthesis_prompt = ChatPromptTemplate.from_template(
            """你是一个信息综合专家。请根据以下子问题的答案，回答原始问题。

子问题和答案:
{context}

原始问题: {question}

请给出完整、准确的最终答案:"""
        )

        chain = synthesis_prompt | self.llm
        final = chain.invoke({
            "context": synthesis_context,
            "question": question,
        })

        return final.content
```

---

## 6. 错误恢复机制

### 6.1 带重试的检索

```python
# ============================================================
# 错误恢复
# ============================================================

class ResilientRetriever:
    """带错误恢复的检索器"""

    def __init__(self, primary_retriever, fallback_retrievers: list):
        self.primary = primary_retriever
        self.fallbacks = fallback_retrievers
        self.max_retries = 3

    def retrieve(self, query: str) -> list:
        """检索并自动恢复"""
        # 尝试主检索器
        try:
            results = self.primary.invoke(query)
            if results:
                return results
        except Exception as e:
            print(f"⚠️ 主检索失败: {e}")

        # 尝试备选检索器
        for i, fallback in enumerate(self.fallbacks):
            try:
                print(f"🔄 尝试备选检索器 {i+1}...")
                results = fallback.invoke(query)
                if results:
                    return results
            except Exception as e:
                print(f"⚠️ 备选检索器 {i+1} 失败: {e}")

        # 所有检索器都失败，尝试查询改写
        return self._retrieve_with_rewrite(query)

    def _retrieve_with_rewrite(self, query: str) -> list:
        """通过查询改写重试检索"""
        rewrite_prompt = ChatPromptTemplate.from_template(
            "请将以下查询改写为更简洁的搜索查询:\n{query}"
        )
        chain = rewrite_prompt | llm
        rewritten = chain.invoke({"query": query})

        try:
            return self.primary.invoke(rewritten.content)
        except Exception:
            return []
```

### 6.2 状态图中的错误处理

```python
def agent_node_with_recovery(state: AgentState) -> AgentState:
    """带错误恢复的 Agent 节点"""
    messages = state["messages"]

    # 检查是否有错误记录
    errors = state.get("intermediate_results", [])
    error_context = ""
    if any("错误" in r or "失败" in r for r in errors):
        error_context = "\n\n注意: 之前的检索尝试失败了，请尝试不同的策略。"

    messages_with_context = messages + [
        SystemMessage(content=f"当前状态: {error_context}")
    ]

    llm_with_tools = llm.bind_tools(tools)
    response = llm_with_tools.invoke(messages_with_context)

    return {
        "messages": [response],
    }


def tool_node_with_recovery(state: AgentState) -> AgentState:
    """带错误恢复的工具执行节点"""
    last_message = state["messages"][-1]
    results = []

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]

        try:
            if tool_name in tool_map:
                result = tool_map[tool_name].invoke(tool_args)
                results.append({
                    "tool_call_id": tool_call["id"],
                    "output": result,
                })
            else:
                results.append({
                    "tool_call_id": tool_call["id"],
                    "output": f"未知工具: {tool_name}",
                })
        except Exception as e:
            results.append({
                "tool_call_id": tool_call["id"],
                "output": f"工具执行错误: {str(e)}",
            })
            # 记录错误到中间结果
            state["intermediate_results"].append(f"工具 {tool_name} 失败: {e}")

    from langchain_core.messages import ToolMessage
    tool_messages = [
        ToolMessage(
            content=str(r["output"]),
            tool_call_id=r["tool_call_id"],
        )
        for r in results
    ]

    return {"messages": tool_messages}
```

---

## 7. 完整 Agentic RAG 系统

```python
def build_resilient_agentic_rag():
    """构建带错误恢复的 Agentic RAG"""

    workflow = StateGraph(AgentState)

    # 使用带恢复的节点
    workflow.add_node("agent", agent_node_with_recovery)
    workflow.add_node("tools", tool_node_with_recovery)

    workflow.set_entry_point("agent")

    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", "end": END},
    )

    workflow.add_edge("tools", "agent")

    return workflow.compile()


# 使用示例
def main():
    """Agentic RAG 演示"""
    # 示例文档
    docs = [
        "Python 是一种高级编程语言，广泛用于机器学习和数据科学。",
        "TensorFlow 和 PyTorch 是最流行的深度学习框架。",
        "RAG 技术结合了检索和生成，提高了 LLM 的回答准确性。",
        "LangChain 是一个用于构建 LLM 应用的框架。",
        "向量数据库如 Chroma、Pinecone 用于存储和检索嵌入向量。",
        "知识图谱可以增强 RAG 系统的关系推理能力。",
    ]

    # 初始化向量数据库
    init_vectorstore(docs)

    # 运行
    questions = [
        "什么是 RAG？它有什么优势？",
        "比较 TensorFlow 和 PyTorch 的特点",
        "如何构建一个完整的 RAG 系统？",
    ]

    for q in questions:
        print(f"\n{'='*60}")
        print(f"问题: {q}")
        print("="*60)

        answer = run_agentic_rag(q)
        print(f"\n答案: {answer}")


if __name__ == "__main__":
    main()
```

---

## 8. 对比分析

### Static RAG vs Agentic RAG

| 维度 | Static RAG | Agentic RAG |
|------|-----------|-------------|
| **检索策略** | 固定一次 | 动态多次 |
| **工具使用** | 无 | 多工具选择 |
| **错误处理** | 无 | 自动恢复 |
| **问题分解** | 无 | 自动分解 |
| **实现复杂度** | ⭐ 低 | ⭐⭐⭐ 高 |
| **延迟** | 低（固定） | 较高（多次调用） |
| **答案质量** | 中等 | 高（信息更完整） |
| **适用场景** | 简单问答 | 复杂推理 |
| **可控性** | 高 | 中等（Agent 自主决策） |
| **成本** | 低 | 较高（多次 LLM 调用） |

---

## 9. 常见误区

### ❌ 错误 1：Agent 陷入无限循环

```python
# ❌ 错误：没有最大迭代限制
def agent_loop(state):
    while True:
        state = agent_node(state)
        if should_continue(state) == "end":
            break
    return state

# ✅ 正确：设置最大迭代次数
def agent_loop(state, max_iterations=10):
    for i in range(max_iterations):
        state = agent_node(state)
        if should_continue(state) == "end":
            break
    else:
        # 达到最大迭代，强制结束
        state["messages"].append(
            AIMessage(content="达到最大迭代次数，基于已有信息生成答案。")
        )
    return state
```

### ❌ 错误 2：工具定义缺少文档字符串

```python
# ❌ 错误：工具没有描述
@tool
def search(q: str) -> str:
    return vectorstore.search(q)

# ✅ 正确：详细描述工具用途和参数
@tool
def search_documents(query: str) -> str:
    """搜索相关文档。用于查找与查询相关的文档片段。

    Args:
        query: 搜索查询，应简洁明了
    """
    docs = vectorstore.similarity_search(query, k=3)
    return "\n".join([d.page_content for d in docs])
```

### ❌ 错误 3：忽略状态的不可变性

```python
# ❌ 错误：直接修改状态
def bad_node(state):
    state["messages"].append(new_message)  # 直接修改
    return state

# ✅ 正确：返回新状态
def good_node(state):
    return {
        "messages": state["messages"] + [new_message],
    }
```

---

## 工程建议

1. **限制 Agent 的最大推理步数**：没有步数限制的 Agent 可能陷入无限循环。建议设置最大 5-7 步的推理限制，超过后用当前最佳结果返回，并记录日志供后续分析。
2. **每一步都要有明确的退出条件**：Agent 在每一步都应该判断是否已经收集到足够的信息。如果第三步检索的结果已经能完整回答问题，就不需要继续第四步。
3. **用小模型做规划，大模型做生成**：Agent 的规划步骤（决定下一步做什么）可以用成本较低的小模型，最终的答案生成用高质量大模型，平衡效果和成本。
4. **Agent 的中间结果要持久化**：多步推理过程中每一步的检索结果和推理结论都应该记录下来。这不仅是调试的需要，也可以作为答案引用的来源。

---

## 📝 本课小结

```
  Agentic RAG 核心要点
  ════════════════════

  ┌─────────────────────────────────────────────────────┐
  │  1. Agentic RAG 让 Agent 管理检索过程               │
  │     → 动态决策、多步推理、自适应策略                │
  │                                                     │
  │  2. LangGraph 实现有状态的工作流                    │
  │     → StateGraph + Node + Edge                     │
  │                                                     │
  │  3. 工具系统扩展 Agent 能力                         │
  │     → 语义搜索、关键词搜索、摘要等                  │
  │                                                     │
  │  4. 问题分解处理复杂查询                            │
  │     → 子问题独立检索，最终综合                      │
  │                                                     │
  │  5. 错误恢复确保系统鲁棒性                          │
  │     → 备选检索器、查询改写、重试机制                │
  └─────────────────────────────────────────────────────┘
```

---

## 🏋️ 练习题

### 练习 1：添加新工具（基础）

为 Agentic RAG 添加一个 `compare_entities` 工具，用于对比两个实体的属性。

**要求**：
- 工具接受两个实体名称
- 从向量数据库中检索相关信息
- 生成对比表格

### 练习 2：实现 Plan-and-Execute（进阶）

实现一个 Plan-and-Execute 模式的 Agent：
- 先制定完整计划（列出所有子步骤）
- 然后按计划逐步执行
- 执行过程中可以修改计划

### 练习 3：多 Agent 协作（挑战）

构建一个多 Agent 系统，包含：
- **Researcher Agent**：负责检索信息
- **Analyst Agent**：负责分析和推理
- **Writer Agent**：负责生成最终答案

三个 Agent 通过共享状态协作完成任务。

---

> 📌 **下一课**：[04 - 多模态 RAG](./04-多模态RAG.md) — 处理图文混合数据

---

## 参考答案

### 练习 1：添加新工具（基础）

**思路**：用 `@tool` 装饰器定义 `compare_entities` 工具，接受两个实体名称，从向量数据库中分别检索两者的相关信息，再用 LLM 生成结构化的对比表格。

**答案**：

```python
from langchain_core.tools import tool


@tool
def compare_entities(entity_a: str, entity_b: str) -> str:
    """对比两个实体的属性。输入两个实体名称，输出结构化的对比表格。

    Args:
        entity_a: 第一个实体名称
        entity_b: 第二个实体名称
    """
    # 分别检索两个实体的信息
    docs_a = vectorstore.similarity_search(entity_a, k=3)
    docs_b = vectorstore.similarity_search(entity_b, k=3)

    context_a = "\n".join([d.page_content for d in docs_a])
    context_b = "\n".join([d.page_content for d in docs_b])

    prompt = ChatPromptTemplate.from_template(
        """根据以下信息，生成 {entity_a} 和 {entity_b} 的对比表格。

{entity_a} 的信息:
{context_a}

{entity_b} 的信息:
{context_b}

请用 Markdown 表格格式输出对比结果，包含以下列：维度、{entity_a}、{entity_b}。
至少对比 5 个维度。"""
    )
    chain = prompt | llm
    result = chain.invoke({
        "entity_a": entity_a,
        "entity_b": entity_b,
        "context_a": context_a,
        "context_b": context_b,
    })
    return result.content


# 更新工具列表
tools = [search_documents, search_by_keyword, summarize_findings, compare_entities]
tool_map = {t.name: t for t in tools}
```

**要点**：
- 工具的 docstring 非常重要，LLM 根据描述决定何时调用该工具，描述不清会导致调用时机错误
- 对比表格至少 5 个维度才能体现结构化对比的价值，过少则与普通回答无异
- 两个实体的信息应分开检索，避免混合后语义干扰导致检索结果不精准

---

### 练习 2：实现 Plan-and-Execute（进阶）

**思路**：将 Agent 分为 Planner 和 Executor 两个角色。Planner 先将问题分解为有序步骤列表，Executor 按步骤逐一执行，每步执行后检查是否需要调整后续计划。

**答案**：

```python
from typing import TypedDict
from langgraph.graph import StateGraph, END


class PlanState(TypedDict):
    question: str
    plan: list[str]
    current_step: int
    step_results: list[str]
    final_answer: str


def planner_node(state: PlanState) -> PlanState:
    """制定执行计划"""
    prompt = ChatPromptTemplate.from_template(
        """你是一个任务规划器。将以下问题分解为 2-5 个有序的执行步骤。

问题: {question}

请以 JSON 格式输出:
{{"steps": ["步骤1", "步骤2", ...]}}"""
    )
    chain = prompt | llm
    import json
    result = chain.invoke({"question": state["question"]}).content
    try:
        data = json.loads(result)
        steps = data.get("steps", [state["question"]])
    except json.JSONDecodeError:
        steps = [state["question"]]

    return {
        **state,
        "plan": steps,
        "current_step": 0,
        "step_results": [],
    }


def executor_node(state: PlanState) -> PlanState:
    """执行当前步骤"""
    step_idx = state["current_step"]
    step_desc = state["plan"][step_idx]

    # 用已有结果作为上下文
    prior_context = "\n".join([
        f"步骤 {i+1} 结果: {r}" for i, r in enumerate(state["step_results"])
    ])

    prompt = ChatPromptTemplate.from_template(
        """你是一个任务执行器。请执行以下步骤。

原始问题: {question}
已完成的步骤:
{prior_context}

当前步骤 ({step_idx}/{total}): {step_desc}

请给出执行结果，简洁明了。"""
    )
    chain = prompt | llm
    result = chain.invoke({
        "question": state["question"],
        "prior_context": prior_context or "无",
        "step_idx": step_idx + 1,
        "total": len(state["plan"]),
        "step_desc": step_desc,
    }).content

    return {
        **state,
        "step_results": state["step_results"] + [result],
        "current_step": step_idx + 1,
    }


def replanner_node(state: PlanState) -> PlanState:
    """检查是否需要调整计划"""
    if state["current_step"] >= len(state["plan"]):
        return state

    # 检查当前结果是否已足够回答问题
    check_prompt = ChatPromptTemplate.from_template(
        """根据已完成的步骤，判断是否需要继续。

原始问题: {question}
已完成结果:
{results}

剩余计划: {remaining}

请回答:
- "done": 已有足够信息，可以生成最终答案
- "continue": 需要继续执行
- JSON {{"new_steps": [...]}}: 需要修改后续计划"""
    )
    chain = check_prompt | llm
    results_text = "\n".join(state["step_results"])
    remaining = state["plan"][state["current_step"]:]
    result = chain.invoke({
        "question": state["question"],
        "results": results_text,
        "remaining": str(remaining),
    }).content.strip()

    if "done" in result.lower():
        return {**state, "current_step": len(state["plan"])}
    return state


def synthesizer_node(state: PlanState) -> PlanState:
    """综合所有步骤结果生成最终答案"""
    results_text = "\n\n".join([
        f"步骤 {i+1}: {state['plan'][i]}\n结果: {r}"
        for i, r in enumerate(state["step_results"])
    ])
    prompt = ChatPromptTemplate.from_template(
        """根据以下各步骤的结果，回答原始问题。

问题: {question}

执行过程:
{results}

请给出完整、准确的最终答案:"""
    )
    chain = prompt | llm
    answer = chain.invoke({
        "question": state["question"],
        "results": results_text,
    }).content

    return {**state, "final_answer": answer}


def should_continue_plan(state: PlanState) -> str:
    if state["current_step"] >= len(state["plan"]):
        return "synthesize"
    return "replan"


# 构建 Plan-and-Execute 图
workflow = StateGraph(PlanState)
workflow.add_node("planner", planner_node)
workflow.add_node("executor", executor_node)
workflow.add_node("replanner", replanner_node)
workflow.add_node("synthesizer", synthesizer_node)

workflow.set_entry_point("planner")
workflow.add_edge("planner", "executor")
workflow.add_conditional_edges("executor", should_continue_plan, {
    "replan": "replanner",
    "synthesize": "synthesizer",
})
workflow.add_edge("replanner", "executor")
workflow.add_edge("synthesizer", END)

app = workflow.compile()

# 使用
result = app.invoke({"question": "比较 Python 和 Go 在 Web 开发中的优劣", "plan": [], "current_step": 0, "step_results": [], "final_answer": ""})
print(result["final_answer"])
```

**要点**：
- Planner 和 Executor 分离的好处是：计划可以被人类审核或修改后再执行，适合需要可控性的生产场景
- Replanner 节点允许动态调整计划，避免初始计划不合理时浪费后续步骤的计算资源
- 每步执行时将之前步骤的结果作为上下文传递，确保后续步骤能利用已有信息

---

### 练习 3：多 Agent 协作（挑战）

**思路**：用 LangGraph 构建三个 Agent 节点（Researcher、Analyst、Writer），通过共享状态传递信息。Researcher 负责检索，Analyst 负责分析和推理，Writer 负责生成最终答案，按顺序执行。

**答案**：

```python
from typing import TypedDict
from langgraph.graph import StateGraph, END


class MultiAgentState(TypedDict):
    question: str
    research_results: str
    analysis: str
    final_answer: str


def researcher_agent(state: MultiAgentState) -> MultiAgentState:
    """Researcher Agent：负责检索信息"""
    question = state["question"]

    # 执行多次检索，收集全面信息
    docs = vectorstore.similarity_search(question, k=5)
    context = "\n".join([d.page_content for d in docs])

    # 用 LLM 组织检索结果
    prompt = ChatPromptTemplate.from_template(
        """你是一个信息检索专家。根据以下检索到的文档，整理出与问题相关的关键信息。

问题: {question}

检索到的文档:
{context}

请整理出:
1. 与问题直接相关的核心事实
2. 可能有用的背景信息
3. 信息来源（文档片段编号）

输出格式为结构化的研究笔记。"""
    )
    chain = prompt | llm
    research = chain.invoke({"question": question, "context": context}).content

    return {**state, "research_results": research}


def analyst_agent(state: MultiAgentState) -> MultiAgentState:
    """Analyst Agent：负责分析和推理"""
    prompt = ChatPromptTemplate.from_template(
        """你是一个分析专家。根据以下研究结果，对问题进行深入分析。

问题: {question}

研究结果:
{research}

请进行以下分析:
1. 关键事实的逻辑关系
2. 可能的推理结论
3. 信息的可靠性评估
4. 存在的不确定性和局限性

输出结构化的分析报告。"""
    )
    chain = prompt | llm
    analysis = chain.invoke({
        "question": state["question"],
        "research": state["research_results"],
    }).content

    return {**state, "analysis": analysis}


def writer_agent(state: MultiAgentState) -> MultiAgentState:
    """Writer Agent：负责生成最终答案"""
    prompt = ChatPromptTemplate.from_template(
        """你是一个写作专家。根据以下研究结果和分析报告，生成高质量的最终答案。

问题: {question}

研究结果:
{research}

分析报告:
{analysis}

要求:
1. 答案要准确、完整、有条理
2. 用通俗易懂的语言表达
3. 如有不确定之处，明确标注
4. 适当引用来源"""
    )
    chain = prompt | llm
    answer = chain.invoke({
        "question": state["question"],
        "research": state["research_results"],
        "analysis": state["analysis"],
    }).content

    return {**state, "final_answer": answer}


# 构建多 Agent 协作图
workflow = StateGraph(MultiAgentState)
workflow.add_node("researcher", researcher_agent)
workflow.add_node("analyst", analyst_agent)
workflow.add_node("writer", writer_agent)

workflow.set_entry_point("researcher")
workflow.add_edge("researcher", "analyst")
workflow.add_edge("analyst", "writer")
workflow.add_edge("writer", END)

app = workflow.compile()

# 使用
result = app.invoke({
    "question": "RAG 技术的优势和局限性是什么？",
    "research_results": "",
    "analysis": "",
    "final_answer": "",
})
print(result["final_answer"])
```

**要点**：
- 三个 Agent 通过共享状态协作，每个 Agent 只关注自己的职责，降低了单个 Agent 的 prompt 复杂度
- Researcher 不应直接生成答案，只整理事实；Analyst 不应生成最终答案，只做推理分析，职责分离是关键
- 如果需要循环迭代（如 Writer 认为信息不足退回 Researcher），可在 Writer 后加条件边实现
