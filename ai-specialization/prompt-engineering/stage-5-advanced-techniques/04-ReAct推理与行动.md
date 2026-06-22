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

## 参考答案

### 练习 1

**思路**：基础 ReAct Agent 的核心是实现 Thought-Action-Observation 循环。需要定义好工具（计算器和搜索），在系统提示词中描述工具的用途和调用格式，然后在循环中解析模型输出的 Action、调用对应工具、将结果作为 Observation 反馈给模型，直到模型输出 Final Answer。

**答案**：

```python
import openai
import json
import math
from typing import Dict, List, Optional

client = openai.OpenAI()

class Calculator:
    """计算器工具"""
    name = "calculator"
    description = "执行数学计算。支持基本运算、三角函数、对数。"

    def execute(self, expression: str) -> str:
        try:
            allowed = {"abs": abs, "round": round, "min": min, "max": max, "math": math}
            result = eval(expression, {"__builtins__": {}}, allowed)
            return str(result)
        except Exception as e:
            return f"计算错误: {e}"

class Search:
    """搜索工具"""
    name = "search"
    description = "搜索事实信息。"

    def __init__(self):
        self.db = {
            "python": "Python 由 Guido van Rossum 于 1991 年创建。",
            "地球": "地球是太阳系第三颗行星，赤道半径约 6371 公里。",
            "光速": "光在真空中的速度约为 299,792,458 米/秒。",
        }

    def execute(self, query: str) -> str:
        for key, value in self.db.items():
            if key in query.lower():
                return value
        return f"未找到关于 '{query}' 的信息。"

class BasicReActAgent:
    """基础 ReAct Agent"""

    def __init__(self, model: str = "gpt-4", max_iterations: int = 8):
        self.model = model
        self.max_iterations = max_iterations
        self.tools = {"calculator": Calculator(), "search": Search()}

    def _get_system_prompt(self) -> str:
        tool_desc = "\n".join([f"- {t.name}: {t.description}" for t in self.tools.values()])
        return f"""你是一个能够推理和行动的 AI 助手。

可用工具：
{tool_desc}

回答格式：
Thought: [推理过程]
Action: [工具名称]
Action Input: [输入参数]

得到结果后：
Observation: [工具结果]
Thought: [继续推理]

最终回答时：
Thought: [总结]
Final Answer: [最终答案]

规则：
1. 每次只执行一个 Action
2. 必须等待 Observation 后再继续
3. 最终答案必须基于推理和观察结果"""

    def run(self, question: str) -> Dict:
        messages = [
            {"role": "system", "content": self._get_system_prompt()},
            {"role": "user", "content": question}
        ]
        history = []

        for i in range(self.max_iterations):
            response = client.chat.completions.create(
                model=self.model, messages=messages, temperature=0
            )
            content = response.choices[0].message.content
            messages.append({"role": "assistant", "content": content})
            print(f"\n[迭代 {i+1}] {content}")

            if "Final Answer:" in content:
                answer = content.split("Final Answer:")[-1].strip()
                return {"answer": answer, "iterations": i + 1, "history": history}

            # 解析 Action
            action, action_input = None, None
            for line in content.split("\n"):
                if line.startswith("Action:"):
                    action = line.split(":", 1)[-1].strip()
                elif line.startswith("Action Input:"):
                    action_input = line.split(":", 1)[-1].strip()

            if action and action in self.tools:
                observation = self.tools[action].execute(
                    **({"expression": action_input} if action == "calculator" else {"query": action_input})
                )
                messages.append({"role": "user", "content": f"Observation: {observation}"})
                history.append({"action": action, "input": action_input, "result": observation})

        return {"answer": "达到最大迭代次数", "iterations": self.max_iterations, "history": history}


if __name__ == "__main__":
    agent = BasicReActAgent()
    questions = [
        "圆的半径是 5 厘米，面积是多少？",
        "Python 是谁创建的？",
    ]
    for q in questions:
        print(f"\n{'='*50}\n问题: {q}")
        result = agent.run(q)
        print(f"\n最终答案: {result['answer']}")
```

**要点**：
- 系统提示词中的工具描述必须精确，模型会根据描述决定何时调用哪个工具
- Action Input 的解析需要容错——模型有时不会输出标准 JSON，需要用 fallback 逻辑
- 最大迭代次数是防止无限循环的安全阀，建议设为 8-15

---

### 练习 2

**思路**：为 ReAct Agent 添加自定义工具的关键是实现统一的工具接口。天气查询工具需要定义 name、description、execute 方法和参数 schema。为了让模型正确调用，工具描述要清晰说明输入格式（如城市名），输出要结构化以便模型理解。

**答案**：

```python
import openai
import json
from typing import Dict, List

client = openai.OpenAI()

class WeatherTool:
    """天气查询工具（模拟数据）"""
    name = "weather"
    description = "查询指定城市的天气信息。输入城市名称，返回当前天气状况、温度和建议。"

    def __init__(self):
        self.weather_data = {
            "北京": {"天气": "晴", "温度": "28°C", "湿度": "45%", "建议": "适合户外活动，注意防晒"},
            "上海": {"天气": "多云", "温度": "26°C", "湿度": "65%", "建议": "天气舒适，适合出行"},
            "广州": {"天气": "小雨", "温度": "30°C", "湿度": "80%", "建议": "记得带伞，注意防潮"},
            "深圳": {"天气": "阴", "温度": "29°C", "湿度": "70%", "建议": "天气闷热，注意补水"},
        }

    def execute(self, city: str) -> str:
        weather = self.weather_data.get(city)
        if weather:
            return json.dumps(weather, ensure_ascii=False)
        return json.dumps({"错误": f"未找到 '{city}' 的天气数据"}, ensure_ascii=False)

class TranslatorTool:
    """翻译工具（模拟）"""
    name = "translator"
    description = "将中文翻译为英文，或将英文翻译为中文。"

    def execute(self, text: str, target_language: str = "en") -> str:
        mock_translations = {
            "你好": "Hello",
            "天气": "weather",
            "人工智能": "Artificial Intelligence",
            "hello": "你好",
            "machine learning": "机器学习",
        }
        result = mock_translations.get(text.lower(), f"[翻译结果: {text}]")
        return result

class ImageGeneratorTool:
    """图片生成工具（模拟）"""
    name = "image_generator"
    description = "根据文字描述生成图片。输入英文描述，返回图片 URL。"

    def execute(self, description: str) -> str:
        return f"图片已生成。描述: {description}。URL: https://example.com/generated/{hash(description) % 10000}.png"

class ExtendedReActAgent:
    """支持自定义工具的 ReAct Agent"""

    def __init__(self, model: str = "gpt-4", max_iterations: int = 8):
        self.model = model
        self.max_iterations = max_iterations
        self.tools = {}

    def register_tool(self, tool):
        self.tools[tool.name] = tool

    def _get_system_prompt(self) -> str:
        tool_desc = "\n".join([f"- {t.name}: {t.description}" for t in self.tools.values()])
        return f"""你是一个能够推理和行动的 AI 助手。

可用工具：
{tool_desc}

格式：
Thought: [推理]
Action: [工具名]
Action Input: [输入，JSON 格式如 {{"city": "北京"}}]

得到结果后：
Observation: [结果]
Thought: [继续推理]

最终回答时：
Final Answer: [答案]"""

    def run(self, question: str) -> Dict:
        messages = [
            {"role": "system", "content": self._get_system_prompt()},
            {"role": "user", "content": question}
        ]
        history = []

        for i in range(self.max_iterations):
            response = client.chat.completions.create(
                model=self.model, messages=messages, temperature=0
            )
            content = response.choices[0].message.content
            messages.append({"role": "assistant", "content": content})

            if "Final Answer:" in content:
                return {"answer": content.split("Final Answer:")[-1].strip(), "history": history}

            # 解析 Action
            action, action_input = None, {}
            for line in content.split("\n"):
                if line.startswith("Action:"):
                    action = line.split(":", 1)[-1].strip()
                elif line.startswith("Action Input:"):
                    try:
                        action_input = json.loads(line.split(":", 1)[-1].strip())
                    except:
                        action_input = {"query": line.split(":", 1)[-1].strip()}

            if action and action in self.tools:
                result = self.tools[action].execute(**action_input)
                messages.append({"role": "user", "content": f"Observation: {result}"})
                history.append({"action": action, "result": result})

        return {"answer": "达到最大迭代次数", "history": history}


if __name__ == "__main__":
    agent = ExtendedReActAgent()
    agent.register_tool(WeatherTool())
    agent.register_tool(TranslatorTool())
    agent.register_tool(ImageGeneratorTool())

    result = agent.run("今天北京天气怎么样？适合出门吗？")
    print(f"答案: {result['answer']}")
```

**要点**：
- 工具的 description 是模型决定是否调用它的唯一依据，必须清晰说明功能和输入格式
- Action Input 应使用 JSON 格式，方便结构化解析和参数传递
- 模拟工具在生产环境中应替换为真实 API 调用，但接口设计保持一致

---

### 练习 3

**思路**：带记忆的 ReAct Agent 需要在每轮对话前后维护两个层次的记忆：短期记忆（最近 N 轮对话的摘要）和长期记忆（从对话中提取的关键事实）。验证方法是进行多轮对话，在后续轮次中引用之前提到的信息，检查 Agent 是否能正确回忆。

**答案**：

```python
import openai
import json
from typing import Dict, List

client = openai.OpenAI()

class SimpleMemory:
    """简单记忆系统"""

    def __init__(self, short_term_limit: int = 10):
        self.short_term: List[Dict] = []
        self.long_term: Dict[str, str] = {}
        self.short_term_limit = short_term_limit

    def add_short_term(self, role: str, content: str):
        self.short_term.append({"role": role, "content": content})
        if len(self.short_term) > self.short_term_limit:
            self.short_term.pop(0)

    def add_long_term(self, key: str, value: str):
        self.long_term[key] = value

    def get_context(self) -> str:
        context = ""
        if self.short_term:
            context += "## 最近对话\n"
            for entry in self.short_term[-6:]:
                context += f"- {entry['role']}: {entry['content'][:80]}\n"
        if self.long_term:
            context += "\n## 已知信息\n"
            for k, v in self.long_term.items():
                context += f"- {k}: {v}\n"
        return context

    def extract_facts(self, text: str) -> Dict[str, str]:
        """从文本中提取关键事实"""
        facts = {}
        if "我叫" in text or "我的名字" in text:
            for keyword in ["我叫", "我的名字是"]:
                if keyword in text:
                    name = text.split(keyword)[-1].split("，")[0].split("。")[0].strip()
                    facts["用户姓名"] = name
        if "喜欢" in text:
            facts["用户偏好"] = text.split("喜欢")[-1].split("。")[0].strip()
        return facts

class MemoryReActAgent:
    """带记忆的 ReAct Agent"""

    def __init__(self, model: str = "gpt-4", max_iterations: int = 8):
        self.model = model
        self.max_iterations = max_iterations
        self.memory = SimpleMemory()
        self.tools = {
            "calculator": type("Calc", (), {
                "name": "calculator",
                "description": "执行数学计算",
                "execute": lambda self, expression: str(eval(expression, {"__builtins__": {}}, {}))
            })(),
        }

    def chat(self, user_input: str) -> str:
        """单轮对话"""
        memory_context = self.memory.get_context()

        messages = [
            {"role": "system", "content": f"""你是一个有记忆的 AI 助手。你能记住之前的对话内容。

{memory_context}

格式：
Thought: [推理]
Action: [工具名]
Action Input: [输入]

或直接回答：
Thought: [总结]
Final Answer: [答案]"""},
            {"role": "user", "content": user_input}
        ]

        # 更新短期记忆
        self.memory.add_short_term("user", user_input)

        for i in range(self.max_iterations):
            response = client.chat.completions.create(
                model=self.model, messages=messages, temperature=0
            )
            content = response.choices[0].message.content
            messages.append({"role": "assistant", "content": content})

            if "Final Answer:" in content:
                answer = content.split("Final Answer:")[-1].strip()
                self.memory.add_short_term("assistant", answer)

                # 提取关键信息存入长期记忆
                facts = self.memory.extract_facts(user_input + " " + answer)
                for k, v in facts.items():
                    self.memory.add_long_term(k, v)

                return answer

            # 工具调用
            action, action_input = None, {}
            for line in content.split("\n"):
                if line.startswith("Action:"):
                    action = line.split(":", 1)[-1].strip()
                elif line.startswith("Action Input:"):
                    action_input = {"expression": line.split(":", 1)[-1].strip()}

            if action and action in self.tools:
                result = self.tools[action].execute(**action_input)
                messages.append({"role": "user", "content": f"Observation: {result}"})

        return "达到最大迭代次数"

    def multi_turn_chat(self, conversations: List[str]) -> List[str]:
        """多轮对话"""
        responses = []
        for msg in conversations:
            response = self.chat(msg)
            responses.append(response)
            print(f"用户: {msg}")
            print(f"助手: {response}\n")
        return responses


if __name__ == "__main__":
    agent = MemoryReActAgent()

    conversations = [
        "你好，我叫小明，我喜欢机器学习。",
        "帮我算一下 42 * 37 + 15 等于多少？",
        "你还记得我叫什么名字吗？我喜欢什么？",
        "刚才那个计算结果是多少来着？",
    ]

    agent.multi_turn_chat(conversations)
```

**要点**：
- 短期记忆保留最近 N 轮对话原文，长期记忆存储提取的关键事实——两者互补
- 事实提取可以用简单的关键词匹配（如本例），生产环境建议用 LLM 做结构化信息抽取
- 验证记忆效果时，至少要覆盖三种场景：引用用户名字（长期记忆）、引用上一轮结果（短期记忆）、引用多轮前的信息

---

> **下一课**：[05 - 多模态 Prompt](./05-多模态Prompt.md)
