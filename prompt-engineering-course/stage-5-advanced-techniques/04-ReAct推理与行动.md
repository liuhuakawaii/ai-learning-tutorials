# 04 - ReAct：推理与行动

> **课程定位**：Stage 5 高级技巧 · 第 4 课
> **前置要求**：完成 Stage 1-4，理解 Chain-of-Thought 和工具调用概念
> **预计时间**：90 分钟

---

## 场景引入

你问 LLM："今天上海的天气怎么样？"它要么编造一个答案，要么告诉你它无法获取实时信息。你问它"帮我算一下这个复杂表达式"，它可能在心算时出错。LLM 的知识是静态的，计算能力也有限。在真实场景中，Agent 需要能够调用外部工具——搜索引擎、计算器、数据库——来获取信息并执行操作，然后根据工具返回的结果继续推理。

---

## 学习目标

1. 理解 ReAct（Reasoning + Acting）的核心思想
2. 掌握 Thought-Action-Observation 循环
3. 实现工具调用（Calculator、Search、Code Execution）
4. 构建完整的 ReAct Agent
5. 对比纯推理和 ReAct 的效果

---

## 1. 什么是 ReAct？

ReAct 是一种将推理（Reasoning）和行动（Acting）结合的框架。核心思想：

> **让 LLM 在推理的同时采取行动，根据行动结果调整推理方向。**

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    ReAct 循环架构                                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   ┌─────────────────────────────────────────────────────────────────────┐  ║
║   │                        ReAct Agent                                  │  ║
║   │                                                                     │  ║
║   │    ┌──────────┐     ┌──────────┐     ┌──────────┐                  │  ║
║   │    │ Thought  │────►│  Action  │────►│Observation│                  │  ║
║   │    │ (推理)   │     │ (行动)   │     │ (观察)   │                  │  ║
║   │    └──────────┘     └──────────┘     └──────────┘                  │  ║
║   │         ▲                                       │                   │  ║
║   │         │                                       │                   │  ║
║   │         └───────────────────────────────────────┘                   │  ║
║   │                         循环直到得出答案                              │  ║
║   └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║   与纯推理的区别：                                                          ║
║   ┌─────────────────────────────────────────────────────────────────────┐  ║
║   │ 纯推理 (CoT): Thought → Thought → Thought → Answer                 │  ║
║   │ ReAct:       Thought → Action → Observation → Thought → ...        │  ║
║   └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║   优势：                                                                    ║
║   - 能获取外部信息（搜索、计算）                                            ║
║   - 能执行实际操作（代码执行、API 调用）                                    ║
║   - 根据反馈调整推理                                                        ║
║   - 可解释性强：推理过程和行动都有记录                                       ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 1.1 ReAct vs 其他方法

| 特性 | CoT | Tool Use | ReAct |
|------|-----|----------|-------|
| 推理能力 | 强 | 弱 | 强 |
| 工具调用 | 无 | 有 | 有 |
| 动态调整 | 无 | 有限 | 强 |
| 可解释性 | 中 | 低 | 高 |
| 适用场景 | 纯推理 | 工具密集 | 复杂任务 |

---

## 2. 工具定义与实现

### 2.1 工具基类

```python
import openai
import json
import math
import subprocess
from typing import Dict, Any, Callable, List, Optional
from abc import ABC, abstractmethod
from dataclasses import dataclass

client = openai.OpenAI()

@dataclass
class ToolResult:
    """工具执行结果"""
    success: bool
    output: str
    error: Optional[str] = None

class Tool(ABC):
    """工具基类"""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    @abstractmethod
    def execute(self, **kwargs) -> ToolResult:
        pass

    @abstractmethod
    def get_parameters_schema(self) -> Dict:
        pass

    def to_function_call(self) -> Dict:
        """转换为 OpenAI Function Calling 格式"""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.get_parameters_schema()
        }
```

### 2.2 计算器工具

```python
class CalculatorTool(Tool):
    """计算器工具"""

    def __init__(self):
        super().__init__(
            name="calculator",
            description="执行数学计算。支持基本运算、三角函数、对数等。"
        )

    def execute(self, expression: str) -> ToolResult:
        try:
            # 安全的数学表达式求值
            allowed_names = {
                "abs": abs, "round": round,
                "min": min, "max": max,
                "sum": sum, "len": len,
                "int": int, "float": float,
                "math": math
            }
            result = eval(expression, {"__builtins__": {}}, allowed_names)
            return ToolResult(success=True, output=str(result))
        except Exception as e:
            return ToolResult(success=False, output="", error=str(e))

    def get_parameters_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "expression": {
                    "type": "string",
                    "description": "要计算的数学表达式，例如: 2 + 3 * 4"
                }
            },
            "required": ["expression"]
        }
```

### 2.3 搜索工具

```python
class SearchTool(Tool):
    """搜索工具（模拟）"""

    def __init__(self):
        super().__init__(
            name="search",
            description="搜索信息。用于查找事实、定义、最新数据等。"
        )
        # 模拟搜索结果数据库
        self.knowledge_base = {
            "python": "Python 是一种高级编程语言，由 Guido van Rossum 于 1991 年创建。",
            "机器学习": "机器学习是人工智能的一个子领域，它使计算机能够从数据中学习。",
            "深度学习": "深度学习是机器学习的一个子集，使用多层神经网络进行学习。",
            "transformer": "Transformer 是一种基于自注意力机制的神经网络架构，由 Vaswani 等人于 2017 年提出。",
            "gpt": "GPT（Generative Pre-trained Transformer）是 OpenAI 开发的大型语言模型系列。",
        }

    def execute(self, query: str) -> ToolResult:
        query_lower = query.lower()
        results = []

        for key, value in self.knowledge_base.items():
            if key in query_lower or query_lower in key:
                results.append(value)

        if results:
            return ToolResult(
                success=True,
                output="\n".join(results)
            )
        else:
            return ToolResult(
                success=True,
                output=f"未找到关于 '{query}' 的相关信息。"
            )

    def get_parameters_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索查询词"
                }
            },
            "required": ["query"]
        }
```

### 2.4 代码执行工具

```python
class CodeExecutionTool(Tool):
    """代码执行工具"""

    def __init__(self):
        super().__init__(
            name="code_executor",
            description="执行 Python 代码并返回结果。适用于复杂计算、数据处理等。"
        )

    def execute(self, code: str) -> ToolResult:
        try:
            # 创建受限的执行环境——禁止 __builtins__ 中的危险函数
            safe_builtins = {"__builtins__": {}}
            local_vars = {}
            exec(code, safe_builtins, local_vars)

            # 尝试获取最后的表达式结果
            lines = code.strip().split("\n")
            last_line = lines[-1].strip()

            if "=" not in last_line and not last_line.startswith(("print", "def", "class", "if", "for", "while")):
                result = eval(last_line, safe_builtins, local_vars)
                return ToolResult(success=True, output=str(result))
            else:
                # 检查是否有 print 输出
                output = local_vars.get("_output", "代码执行完成")
                return ToolResult(success=True, output=str(output))

        except Exception as e:
            return ToolResult(success=False, output="", error=str(e))

    def get_parameters_schema(self) -> Dict:
        return {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "要执行的 Python 代码"
                }
            },
            "required": ["code"]
        }
```

---

## 3. ReAct Agent 实现

### 3.1 Agent 核心

```python
class ReActAgent:
    """ReAct Agent"""

    def __init__(
        self,
        model: str = "gpt-4",
        tools: List[Tool] = None,
        max_iterations: int = 10,
        verbose: bool = True
    ):
        self.model = model
        self.tools = {tool.name: tool for tool in (tools or [])}
        self.max_iterations = max_iterations
        self.verbose = verbose

    def _get_system_prompt(self) -> str:
        """生成系统提示词"""
        tool_descriptions = "\n".join([
            f"- {tool.name}: {tool.description}"
            for tool in self.tools.values()
        ])

        return f"""你是一个能够推理和行动的 AI 助手。

可用工具：
{tool_descriptions}

回答问题时，请遵循以下格式：
Thought: [你的推理过程，分析当前情况，决定下一步行动]
Action: [工具名称]
Action Input: [工具输入参数，JSON 格式]

当你得到工具结果后，继续推理：
Observation: [工具返回的结果]
Thought: [基于观察结果的进一步推理]

当你能够回答问题时：
Thought: [总结推理过程，准备给出最终答案]
Final Answer: [最终答案]

重要规则：
1. 每次只执行一个 Action
2. 必须等待 Observation 后再继续推理
3. 如果工具调用失败，分析原因并尝试其他方法
4. 最终答案必须基于你的推理和观察结果
"""

    def _parse_action(self, text: str) -> Optional[Dict]:
        """解析 Action"""
        lines = text.strip().split("\n")
        action = None
        action_input = None

        for line in lines:
            if line.startswith("Action:"):
                action = line.split(":", 1)[-1].strip()
            elif line.startswith("Action Input:"):
                input_str = line.split(":", 1)[-1].strip()
                try:
                    action_input = json.loads(input_str)
                except json.JSONDecodeError:
                    # 如果不是 JSON，直接作为字符串
                    action_input = {"query": input_str} if "search" in (action or "") else {"expression": input_str}

        if action and action_input:
            return {"action": action, "input": action_input}
        return None

    def _execute_action(self, action_name: str, action_input: Dict) -> str:
        """执行工具动作"""
        if action_name not in self.tools:
            return f"错误：工具 '{action_name}' 不存在"

        tool = self.tools[action_name]
        result = tool.execute(**action_input)

        if result.success:
            return result.output
        else:
            return f"工具执行错误: {result.error}"

    def _check_final_answer(self, text: str) -> Optional[str]:
        """检查是否有最终答案"""
        if "Final Answer:" in text:
            return text.split("Final Answer:", 1)[-1].strip()
        return None

    def run(self, question: str) -> Dict:
        """运行 ReAct 循环"""
        messages = [
            {"role": "system", "content": self._get_system_prompt()},
            {"role": "user", "content": question}
        ]

        history = []
        final_answer = None

        for iteration in range(self.max_iterations):
            if self.verbose:
                print(f"\n{'='*60}")
                print(f"迭代 {iteration + 1}/{self.max_iterations}")
                print(f"{'='*60}")

            # 调用模型
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0
            )

            assistant_message = response.choices[0].message.content
            messages.append({"role": "assistant", "content": assistant_message})

            if self.verbose:
                print(f"\nAssistant:\n{assistant_message}")

            # 检查是否有最终答案
            final_answer = self._check_final_answer(assistant_message)
            if final_answer:
                if self.verbose:
                    print(f"\n✓ 找到最终答案")
                break

            # 解析并执行 Action
            action_info = self._parse_action(assistant_message)
            if action_info:
                action_name = action_info["action"]
                action_input = action_info["input"]

                if self.verbose:
                    print(f"\n执行工具: {action_name}")
                    print(f"输入: {json.dumps(action_input, ensure_ascii=False)}")

                # 执行工具
                observation = self._execute_action(action_name, action_input)

                if self.verbose:
                    print(f"观察结果: {observation}")

                # 记录历史
                history.append({
                    "iteration": iteration + 1,
                    "thought": assistant_message,
                    "action": action_name,
                    "action_input": action_input,
                    "observation": observation
                })

                # 将观察结果添加到消息
                messages.append({
                    "role": "user",
                    "content": f"Observation: {observation}"
                })
            else:
                if self.verbose:
                    print("\n⚠ 未检测到 Action，尝试继续...")

        return {
            "question": question,
            "answer": final_answer,
            "iterations": len(history),
            "history": history
        }
```

### 3.2 使用示例

```python
if __name__ == "__main__":
    # 创建工具
    calculator = CalculatorTool()
    search = SearchTool()
    code_executor = CodeExecutionTool()

    # 创建 Agent
    agent = ReActAgent(
        model="gpt-4",
        tools=[calculator, search, code_executor],
        max_iterations=10,
        verbose=True
    )

    # 测试问题
    questions = [
        "如果一个圆的半径是 5 厘米，它的面积是多少？",
        "Python 是谁创建的？创建于哪一年？",
        "计算 1 到 100 的和，并解释计算方法。"
    ]

    for question in questions:
        print(f"\n\n{'#'*60}")
        print(f"问题: {question}")
        print(f"{'#'*60}")

        result = agent.run(question)

        print(f"\n最终答案: {result['answer']}")
        print(f"迭代次数: {result['iterations']}")
```

---

## 4. 带记忆的 ReAct Agent

### 4.1 短期记忆与长期记忆

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    带记忆的 ReAct Agent                                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   ┌─────────────────────────────────────────────────────────────────────┐  ║
║   │                       Memory System                                 │  ║
║   │                                                                     │  ║
║   │   ┌────────────────┐     ┌────────────────┐                        │  ║
║   │   │  短期记忆      │     │  长期记忆      │                        │  ║
║   │   │  (对话历史)    │     │  (知识库)      │                        │  ║
║   │   └───────┬────────┘     └───────┬────────┘                        │  ║
║   │           │                      │                                  │  ║
║   │           ▼                      ▼                                  │  ║
║   │   ┌─────────────────────────────────────────────────────────────┐  │  ║
║   │   │                     ReAct Agent                              │  │  ║
║   │   │                                                             │  │  ║
║   │   │   Thought → Action → Observation → Thought → ...           │  │  ║
║   │   │                                                             │  │  ║
║   │   └─────────────────────────────────────────────────────────────┘  │  ║
║   │                                                                     │  ║
║   └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
║   记忆更新策略：                                                            ║
║   - 短期记忆：保留最近 N 轮对话                                             ║
║   - 长期记忆：提取关键信息存入知识库                                         ║
║   - 上下文窗口：动态调整以适应 Token 限制                                   ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 4.2 实现带记忆的 Agent

```python
class Memory:
    """记忆系统"""

    def __init__(self, short_term_limit: int = 10):
        self.short_term = []  # 短期记忆（对话历史）
        self.long_term = {}   # 长期记忆（知识库）
        self.short_term_limit = short_term_limit

    def add_short_term(self, entry: Dict):
        """添加短期记忆"""
        self.short_term.append(entry)
        # 保持短期记忆在限制内
        if len(self.short_term) > self.short_term_limit:
            self.short_term.pop(0)

    def add_long_term(self, key: str, value: str):
        """添加长期记忆"""
        self.long_term[key] = value

    def get_context(self) -> str:
        """获取上下文"""
        context = ""

        # 短期记忆
        if self.short_term:
            context += "## 最近对话历史\n"
            for entry in self.short_term[-5:]:  # 最近 5 条
                context += f"- {entry.get('role', 'unknown')}: {entry.get('content', '')[:100]}\n"

        # 长期记忆
        if self.long_term:
            context += "\n## 已知信息\n"
            for key, value in self.long_term.items():
                context += f"- {key}: {value}\n"

        return context

    def extract_key_info(self, text: str) -> Dict[str, str]:
        """从文本中提取关键信息（简化版）"""
        # 实际应用中可以使用 NLP 技术提取
        info = {}

        # 简单的关键词提取
        keywords = ["Python", "机器学习", "深度学习", "GPT", "Transformer"]
        for keyword in keywords:
            if keyword.lower() in text.lower():
                info[keyword] = f"提到了 {keyword}"

        return info


class ReActAgentWithMemory(ReActAgent):
    """带记忆的 ReAct Agent"""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.memory = Memory()

    def run(self, question: str) -> Dict:
        """运行带记忆的 ReAct 循环"""
        # 获取记忆上下文
        memory_context = self.memory.get_context()

        # 构建带记忆的用户消息
        user_message = question
        if memory_context:
            user_message = f"""
{memory_context}

当前问题：{question}
"""

        # 运行 ReAct 循环
        result = super().run(user_message)

        # 更新记忆
        self.memory.add_short_term({
            "role": "user",
            "content": question
        })
        self.memory.add_short_term({
            "role": "assistant",
            "content": result.get("answer", "")
        })

        # 提取关键信息存入长期记忆
        if result.get("answer"):
            key_info = self.memory.extract_key_info(result["answer"])
            for key, value in key_info.items():
                self.memory.add_long_term(key, value)

        return result
```

---

## 5. 并行工具调用

### 5.1 并行执行优化

```python
import concurrent.futures

class ParallelReActAgent(ReActAgent):
    """支持并行工具调用的 ReAct Agent"""

    def _execute_actions_parallel(self, actions: List[Dict]) -> List[str]:
        """并行执行多个工具动作"""
        results = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = []
            for action_info in actions:
                future = executor.submit(
                    self._execute_action,
                    action_info["action"],
                    action_info["input"]
                )
                futures.append(future)

            for future in concurrent.futures.as_completed(futures):
                results.append(future.result())

        return results

    def _parse_multiple_actions(self, text: str) -> List[Dict]:
        """解析多个并行 Action"""
        actions = []
        lines = text.strip().split("\n")

        current_action = None
        current_input = None

        for line in lines:
            if line.startswith("Action:"):
                if current_action and current_input:
                    actions.append({
                        "action": current_action,
                        "input": current_input
                    })
                current_action = line.split(":", 1)[-1].strip()
                current_input = None
            elif line.startswith("Action Input:"):
                input_str = line.split(":", 1)[-1].strip()
                try:
                    current_input = json.loads(input_str)
                except json.JSONDecodeError:
                    current_input = {"query": input_str}

        # 添加最后一个 Action
        if current_action and current_input:
            actions.append({
                "action": current_action,
                "input": current_input
            })

        return actions
```

---

## 6. 常见误区

| 错误 | 正确做法 |
|------|----------|
| 工具描述不清晰 | 提供详细的工具说明和参数格式 |
| 不处理工具错误 | 捕获异常并返回有意义的错误信息 |
| 无限循环 | 设置最大迭代次数 |
| 忽略观察结果 | 将观察结果完整传递给模型 |
| 不验证工具输出 | 对工具输出进行合理性检查 |

---

## 7. 工程建议

1. 工具描述要尽可能详细和精确，模型对工具的理解直接影响调用准确率
2. 每个工具调用都必须有错误处理和超时机制，避免单个工具故障导致整个 Agent 卡死
3. 设置合理的最大迭代次数（建议 8-15），并监控循环次数防止无限循环
4. 对工具输出进行合理性校验，防止模型基于错误的工具结果做出错误推理

---

## 8. 本节小结

ReAct 是构建智能 Agent 的核心框架：

1. **推理与行动结合**：Thought-Action-Observation 循环
2. **工具调用**：Calculator、Search、Code Execution 等
3. **记忆系统**：短期记忆和长期记忆
4. **并行优化**：同时执行多个工具调用
5. **错误处理**：优雅处理工具调用失败

---

## 练习

### 练习 1：基础 ReAct Agent
实现一个 ReAct Agent，能够使用计算器和搜索工具回答问题。

### 练习 2：自定义工具
为 ReAct Agent 添加一个"天气查询"工具（可以使用模拟数据）。

### 练习 3：带记忆的对话
使用带记忆的 ReAct Agent 进行多轮对话，验证记忆效果。

---

> **下一课**：[05 - 多模态 Prompt](./05-多模态Prompt.md)
