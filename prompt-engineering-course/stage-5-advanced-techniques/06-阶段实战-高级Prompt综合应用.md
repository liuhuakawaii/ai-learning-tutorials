# 06 - 阶段实战：高级 Prompt 综合应用

> **课程定位**：Stage 5 高级技巧 · 第 6 课（综合实战）
> **前置要求**：完成 Stage 5 前 5 课，掌握 Meta-Prompt、Self-Consistency、ToT、ReAct、多模态 Prompt
> **预计时间**：120 分钟

---

## 学习目标

1. 综合运用多种高级 Prompt 技术
2. 构建一个完整的智能 Agent 系统
3. 实现 ToT + ReAct + Self-Consistency 的融合
4. 掌握真实场景下的工程实践
5. 完成一个可运行的综合项目

---

## 1. 技术融合架构

### 1.1 整体架构设计

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    高级 Prompt 综合应用架构                                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   ┌─────────────────────────────────────────────────────────────────────┐  ║
║   │                       用户输入                                      │  ║
║   │                    (文本 + 图片)                                    │  ║
║   └────────────────────────────────┬────────────────────────────────────┘  ║
║                                    │                                       ║
║                                    ▼                                       ║
║   ┌─────────────────────────────────────────────────────────────────────┐  ║
║   │                    任务分析器 (Task Analyzer)                        │  ║
║   │              使用 Meta-Prompt 生成最优策略                           │  ║
║   └────────────────────────────────┬────────────────────────────────────┘  ║
║                                    │                                       ║
║              ┌─────────────────────┼─────────────────────┐                 ║
║              ▼                     ▼                     ▼                 ║
║   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐        ║
║   │  推理任务       │   │  工具任务       │   │  多模态任务     │        ║
║   │  (ToT + SC)     │   │  (ReAct)        │   │  (Vision)       │        ║
║   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘        ║
║            │                     │                     │                   ║
║            └─────────────────────┼─────────────────────┘                   ║
║                                  │                                         ║
║                                  ▼                                         ║
║   ┌─────────────────────────────────────────────────────────────────────┐  ║
║   │                    结果整合器 (Result Integrator)                    │  ║
║   │              使用 Self-Consistency 确保一致性                        │  ║
║   └────────────────────────────────┬────────────────────────────────────┘  ║
║                                    │                                       ║
║                                    ▼                                       ║
║   ┌─────────────────────────────────────────────────────────────────────┐  ║
║   │                       最终输出                                      │  ║
║   └─────────────────────────────────────────────────────────────────────┘  ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 1.2 技术组合策略

| 任务类型 | 推荐组合 | 原因 |
|----------|----------|------|
| 复杂推理 | ToT + Self-Consistency | 多路径探索 + 投票保证准确 |
| 信息查询 | ReAct + 工具调用 | 需要外部数据支持 |
| 多模态分析 | Vision + CoT | 视觉理解 + 结构化推理 |
| 创意生成 | Meta-Prompt + ToT | 自动生成 + 多方案探索 |
| 综合任务 | 全部组合 | 根据子任务动态选择 |

---

## 2. 智能 Agent 核心实现

### 2.1 Agent 主类

```python
import openai
import json
import math
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod

client = openai.OpenAI()

class TaskType(Enum):
    REASONING = "reasoning"
    TOOL_USE = "tool_use"
    MULTIMODAL = "multimodal"
    CREATIVE = "creative"
    GENERAL = "general"

@dataclass
class AgentConfig:
    """Agent 配置"""
    model: str = "gpt-4"
    vision_model: str = "gpt-4o"
    max_iterations: int = 10
    num_consistency_paths: int = 3
    tot_breadth: int = 2
    tot_depth: int = 3
    temperature: float = 0.7
    verbose: bool = True

class Tool(ABC):
    """工具基类"""

    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    @abstractmethod
    def execute(self, **kwargs) -> str:
        pass

    def to_schema(self) -> Dict:
        return {
            "name": self.name,
            "description": self.description
        }


class CalculatorTool(Tool):
    """计算器工具"""

    def __init__(self):
        super().__init__(
            name="calculator",
            description="执行数学计算"
        )

    def execute(self, expression: str, **kwargs) -> str:
        try:
            allowed_names = {
                "abs": abs, "round": round,
                "min": min, "max": max,
                "math": math
            }
            result = eval(expression, {"__builtins__": {}}, allowed_names)
            return str(result)
        except Exception as e:
            return f"计算错误: {str(e)}"


class SearchTool(Tool):
    """搜索工具"""

    def __init__(self):
        super().__init__(
            name="search",
            description="搜索信息"
        )
        self.knowledge = {
            "python": "Python 是一种高级编程语言，由 Guido van Rossum 于 1991 年创建。",
            "ai": "人工智能（AI）是计算机科学的一个分支，致力于创建能够模拟人类智能的系统。",
            "machine_learning": "机器学习是 AI 的子领域，使计算机能够从数据中学习而无需显式编程。",
        }

    def execute(self, query: str, **kwargs) -> str:
        query_lower = query.lower()
        for key, value in self.knowledge.items():
            if key in query_lower:
                return value
        return f"未找到关于 '{query}' 的信息"


class CodeExecutionTool(Tool):
    """代码执行工具"""

    def __init__(self):
        super().__init__(
            name="code_executor",
            description="执行 Python 代码"
        )

    def execute(self, code: str, **kwargs) -> str:
        try:
            local_vars = {}
            exec(code, {"__builtins__": __builtins__}, local_vars)
            return "代码执行完成"
        except Exception as e:
            return f"执行错误: {str(e)}"


class IntelligentAgent:
    """智能 Agent - 综合多种高级技术"""

    def __init__(self, config: AgentConfig = None):
        self.config = config or AgentConfig()
        self.tools = {}
        self.conversation_history = []

        # 注册默认工具
        self.register_tool(CalculatorTool())
        self.register_tool(SearchTool())
        self.register_tool(CodeExecutionTool())

    def register_tool(self, tool: Tool):
        """注册工具"""
        self.tools[tool.name] = tool

    def _classify_task(self, user_input: str) -> TaskType:
        """任务分类 - 使用 Meta-Prompt"""
        response = client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": "你是任务分类专家。"},
                {"role": "user", "content": f"""
请将以下任务分类到最合适的技术：

任务：{user_input}

可选分类：
1. reasoning - 需要复杂逻辑推理（数学、规划、策略）
2. tool_use - 需要外部工具（计算、搜索、代码执行）
3. multimodal - 涉及图片或多模态内容
4. creative - 创意生成（写作、设计、头脑风暴）
5. general - 一般问答

请只输出分类名称。"""}
            ],
            temperature=0
        )

        category = response.choices[0].message.content.strip().lower()

        try:
            return TaskType(category)
        except ValueError:
            return TaskType.GENERAL

    def _solve_with_self_consistency(
        self,
        question: str,
        num_paths: int = 3
    ) -> Dict:
        """使用 Self-Consistency 求解"""
        paths = []
        answers = []

        for i in range(num_paths):
            response = client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "请一步步推理，最后给出答案。格式：推理过程：...\n最终答案：..."},
                    {"role": "user", "content": question}
                ],
                temperature=self.config.temperature
            )

            content = response.choices[0].message.content
            paths.append(content)

            # 提取答案
            if "最终答案：" in content:
                answer = content.split("最终答案：")[-1].strip()
            else:
                answer = content.split("\n")[-1].strip()
            answers.append(answer)

        # 多数投票
        from collections import Counter
        counter = Counter(answers)
        most_common = counter.most_common(1)[0]

        return {
            "answer": most_common[0],
            "confidence": most_common[1] / num_paths,
            "paths": paths
        }

    def _solve_with_tot(
        self,
        question: str,
        breadth: int = 2,
        depth: int = 3
    ) -> Dict:
        """使用 Tree of Thoughts 求解"""
        # 分解问题
        decompose_response = client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": "你是问题分解专家。"},
                {"role": "user", "content": f"""
请将以下问题分解为 {depth} 个推理步骤：

问题：{question}

输出格式：
步骤1: [描述]
步骤2: [描述]
步骤3: [描述]"""}
            ],
            temperature=0
        )

        steps = []
        for line in decompose_response.choices[0].message.content.split("\n"):
            if line.startswith("步骤"):
                steps.append(line.split(":", 1)[-1].strip())

        # BFS 搜索
        best_path = []
        current_candidates = [""]

        for step in steps:
            next_candidates = []

            for candidate in current_candidates:
                # 生成多个思路
                gen_response = client.chat.completions.create(
                    model=self.config.model,
                    messages=[
                        {"role": "system", "content": "请为当前步骤生成多个思路。"},
                        {"role": "user", "content": f"""
问题：{question}
当前步骤：{step}
之前的推理：{candidate}

请生成 {breadth} 个不同的思路，每个用 "思路X:" 开头。"""}
                    ],
                    temperature=0.8
                )

                thoughts = []
                for line in gen_response.choices[0].message.content.split("\n"):
                    if line.startswith("思路"):
                        thoughts.append(line.split(":", 1)[-1].strip())

                # 评估每个思路
                for thought in thoughts[:breadth]:
                    eval_response = client.chat.completions.create(
                        model=self.config.model,
                        messages=[
                            {"role": "system", "content": "请评估思路质量，输出 0-1 分数。"},
                            {"role": "user", "content": f"问题：{question}\n思路：{thought}\n请输出分数："}
                        ],
                        temperature=0
                    )

                    try:
                        score = float(eval_response.choices[0].message.content.strip())
                    except:
                        score = 0.5

                    next_candidates.append({
                        "path": f"{candidate} -> {thought}",
                        "score": score
                    })

            # 保留 Top-K
            next_candidates.sort(key=lambda x: x["score"], reverse=True)
            current_candidates = [c["path"] for c in next_candidates[:breadth]]

        best_path = current_candidates[0] if current_candidates else ""

        return {
            "answer": best_path,
            "steps": steps,
            "candidates_explored": breadth * depth
        }

    def _solve_with_react(self, question: str) -> Dict:
        """使用 ReAct 求解"""
        tool_descriptions = "\n".join([
            f"- {t.name}: {t.description}" for t in self.tools.values()
        ])

        messages = [
            {"role": "system", "content": f"""
你是一个能够推理和行动的 AI。

可用工具：
{tool_descriptions}

格式：
Thought: [推理]
Action: [工具名]
Action Input: [输入，JSON格式]

得到结果后：
Observation: [结果]
Thought: [继续推理]

最终回答时：
Thought: [总结]
Final Answer: [答案]"""},
            {"role": "user", "content": question}
        ]

        history = []
        final_answer = None

        for iteration in range(self.config.max_iterations):
            response = client.chat.completions.create(
                model=self.config.model,
                messages=messages,
                temperature=0
            )

            assistant_msg = response.choices[0].message.content
            messages.append({"role": "assistant", "content": assistant_msg})

            # 检查最终答案
            if "Final Answer:" in assistant_msg:
                final_answer = assistant_msg.split("Final Answer:")[-1].strip()
                break

            # 解析并执行 Action
            if "Action:" in assistant_msg:
                lines = assistant_msg.split("\n")
                action = None
                action_input = {}

                for line in lines:
                    if line.startswith("Action:"):
                        action = line.split(":", 1)[-1].strip()
                    elif line.startswith("Action Input:"):
                        input_str = line.split(":", 1)[-1].strip()
                        try:
                            action_input = json.loads(input_str)
                        except:
                            action_input = {"expression": input_str}

                if action and action in self.tools:
                    result = self.tools[action].execute(**action_input)
                    messages.append({
                        "role": "user",
                        "content": f"Observation: {result}"
                    })
                    history.append({
                        "action": action,
                        "input": action_input,
                        "result": result
                    })

        return {
            "answer": final_answer,
            "iterations": len(history),
            "history": history
        }

    def run(self, user_input: str, image_path: str = None) -> Dict:
        """运行 Agent"""
        if self.config.verbose:
            print(f"\n{'='*60}")
            print(f"用户输入: {user_input}")
            if image_path:
                print(f"图片: {image_path}")
            print(f"{'='*60}")

        # 多模态处理
        if image_path:
            return self._handle_multimodal(user_input, image_path)

        # 任务分类
        task_type = self._classify_task(user_input)
        if self.config.verbose:
            print(f"任务类型: {task_type.value}")

        # 根据任务类型选择策略
        if task_type == TaskType.REASONING:
            # 使用 ToT + Self-Consistency
            if self.config.verbose:
                print("使用 Tree of Thoughts + Self-Consistency...")

            tot_result = self._solve_with_tot(user_input)
            sc_result = self._solve_with_self_consistency(user_input)

            return {
                "task_type": task_type.value,
                "strategy": "ToT + Self-Consistency",
                "tot_result": tot_result,
                "sc_result": sc_result,
                "final_answer": sc_result["answer"]
            }

        elif task_type == TaskType.TOOL_USE:
            # 使用 ReAct
            if self.config.verbose:
                print("使用 ReAct...")

            react_result = self._solve_with_react(user_input)

            return {
                "task_type": task_type.value,
                "strategy": "ReAct",
                "result": react_result,
                "final_answer": react_result["answer"]
            }

        elif task_type == TaskType.CREATIVE:
            # 使用 Meta-Prompt + ToT
            if self.config.verbose:
                print("使用 Meta-Prompt + ToT...")

            # 生成多个创意方案
            responses = []
            for i in range(3):
                response = client.chat.completions.create(
                    model=self.config.model,
                    messages=[
                        {"role": "system", "content": "你是一个创意专家。"},
                        {"role": "user", "content": user_input}
                    ],
                    temperature=0.9
                )
                responses.append(response.choices[0].message.content)

            return {
                "task_type": task_type.value,
                "strategy": "Meta-Prompt + Creative Sampling",
                "options": responses,
                "final_answer": responses[0]
            }

        else:
            # 一般问答
            if self.config.verbose:
                print("使用标准问答...")

            response = client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "你是一个有帮助的 AI 助手。"},
                    {"role": "user", "content": user_input}
                ],
                temperature=self.config.temperature
            )

            return {
                "task_type": task_type.value,
                "strategy": "Standard QA",
                "final_answer": response.choices[0].message.content
            }

    def _handle_multimodal(self, text: str, image_path: str) -> Dict:
        """处理多模态输入"""
        import base64

        with open(image_path, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")

        response = client.chat.completions.create(
            model=self.config.vision_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": text},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=1500
        )

        return {
            "task_type": "multimodal",
            "strategy": "Vision Model",
            "final_answer": response.choices[0].message.content
        }
```

---

## 3. 完整使用示例

### 3.1 基础使用

```python
if __name__ == "__main__":
    # 创建 Agent
    config = AgentConfig(
        model="gpt-4",
        vision_model="gpt-4o",
        max_iterations=10,
        num_consistency_paths=3,
        tot_breadth=2,
        tot_depth=3,
        verbose=True
    )

    agent = IntelligentAgent(config)

    # 测试不同类型的任务
    test_cases = [
        # 推理任务
        "一个商店打 8 折促销，原价 200 元的商品，先涨价 25% 再打 8 折，实际价格是多少？",

        # 工具使用任务
        "请帮我计算 (15 * 23 + 45) / 7 的结果",

        # 创意任务
        "请为一款智能手表写一段吸引人的产品描述",

        # 一般问答
        "Python 和 JavaScript 有什么区别？"
    ]

    for question in test_cases:
        print(f"\n\n{'#'*60}")
        result = agent.run(question)

        print(f"\n任务类型: {result.get('task_type')}")
        print(f"使用策略: {result.get('strategy')}")
        print(f"最终答案: {result.get('final_answer')}")
```

### 3.2 多模态使用

```python
def demo_multimodal():
    """多模态使用示例"""
    agent = IntelligentAgent()

    # 图片分析
    result = agent.run(
        user_input="请详细描述这张图片的内容，并分析其中的数据趋势",
        image_path="path/to/chart.png"
    )

    print(f"分析结果: {result['final_answer']}")


def demo_batch_processing():
    """批量处理示例"""
    agent = IntelligentAgent()

    questions = [
        "计算斐波那契数列第 10 个数",
        "什么是深度学习？",
        "写一首关于春天的诗"
    ]

    results = []
    for q in questions:
        result = agent.run(q)
        results.append({
            "question": q,
            "answer": result["final_answer"],
            "strategy": result["strategy"]
        })

    # 打印汇总
    print("\n" + "="*60)
    print("批量处理结果汇总")
    print("="*60)
    for r in results:
        print(f"\n问题: {r['question']}")
        print(f"策略: {r['strategy']}")
        print(f"答案: {r['answer'][:100]}...")
```

---

## 4. 性能优化

### 4.1 缓存机制

```python
import hashlib
from functools import lru_cache

class CachedAgent(IntelligentAgent):
    """带缓存的 Agent"""

    def __init__(self, config: AgentConfig = None):
        super().__init__(config)
        self.cache = {}

    def _get_cache_key(self, messages: List[Dict]) -> str:
        """生成缓存键"""
        content = json.dumps(messages, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()

    def _call_model(self, messages: List[Dict], **kwargs) -> str:
        """带缓存的模型调用"""
        cache_key = self._get_cache_key(messages)

        if cache_key in self.cache:
            if self.config.verbose:
                print("  [缓存命中]")
            return self.cache[cache_key]

        response = client.chat.completions.create(
            model=kwargs.get("model", self.config.model),
            messages=messages,
            temperature=kwargs.get("temperature", self.config.temperature)
        )

        result = response.choices[0].message.content
        self.cache[cache_key] = result

        return result
```

### 4.2 异步处理

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class AsyncAgent(IntelligentAgent):
    """异步 Agent"""

    def __init__(self, config: AgentConfig = None):
        super().__init__(config)
        self.executor = ThreadPoolExecutor(max_workers=3)

    async def run_async(self, user_input: str) -> Dict:
        """异步运行"""
        loop = asyncio.get_event_loop()

        # 在线程池中执行
        result = await loop.run_in_executor(
            self.executor,
            self.run,
            user_input
        )

        return result

    async def batch_run_async(self, questions: List[str]) -> List[Dict]:
        """异步批量运行"""
        tasks = [self.run_async(q) for q in questions]
        results = await asyncio.gather(*tasks)
        return results


# 使用示例
async def demo_async():
    agent = AsyncAgent()

    questions = [
        "问题1",
        "问题2",
        "问题3"
    ]

    results = await agent.batch_run_async(questions)

    for q, r in zip(questions, results):
        print(f"问题: {q}")
        print(f"答案: {r['final_answer'][:100]}...")
```

---

## 5. 真实场景案例

### 5.1 智能客服系统

```python
class CustomerServiceAgent:
    """智能客服 Agent"""

    def __init__(self):
        self.agent = IntelligentAgent(AgentConfig(
            model="gpt-4",
            verbose=False
        ))

        # 注册客服工具
        self.agent.register_tool(OrderLookupTool())
        self.agent.register_tool(RefundTool())
        self.agent.register_tool(FAQTool())

    def handle_customer_query(self, query: str) -> str:
        """处理客户查询"""
        # 添加客服上下文
        context = """你是一个专业的客服代表。
        - 保持友好和专业
        - 如果需要查询订单，请使用 order_lookup 工具
        - 如果客户要求退款，请使用 refund 工具
        - 常见问题请参考 FAQ"""

        full_query = f"{context}\n\n客户问题：{query}"

        result = self.agent.run(full_query)
        return result["final_answer"]


class OrderLookupTool(Tool):
    """订单查询工具"""

    def __init__(self):
        super().__init__(
            name="order_lookup",
            description="查询订单状态"
        )
        self.orders = {
            "ORD001": {"status": "已发货", "tracking": "SF123456"},
            "ORD002": {"status": "待发货", "tracking": ""},
        }

    def execute(self, order_id: str, **kwargs) -> str:
        order = self.orders.get(order_id)
        if order:
            return json.dumps(order, ensure_ascii=False)
        return "订单不存在"


class RefundTool(Tool):
    """退款工具"""

    def __init__(self):
        super().__init__(
            name="refund",
            description="处理退款请求"
        )

    def execute(self, order_id: str, reason: str, **kwargs) -> str:
        return f"退款申请已提交，订单号：{order_id}，原因：{reason}，预计 3-5 个工作日到账。"


class FAQTool(Tool):
    """FAQ 工具"""

    def __init__(self):
        super().__init__(
            name="faq",
            description="查询常见问题"
        )
        self.faqs = {
            "发货": "我们通常在下单后 24 小时内发货。",
            "退货": "7 天内无理由退货，商品需保持原包装。",
            "支付": "支持支付宝、微信、银行卡支付。"
        }

    def execute(self, keyword: str, **kwargs) -> str:
        for key, value in self.faqs.items():
            if key in keyword:
                return value
        return "未找到相关 FAQ"
```

### 5.2 研究助手系统

```python
class ResearchAssistant:
    """研究助手 Agent"""

    def __init__(self):
        self.agent = IntelligentAgent(AgentConfig(
            model="gpt-4",
            tot_breadth=3,
            tot_depth=4,
            num_consistency_paths=5,
            verbose=True
        ))

    def research_topic(self, topic: str) -> Dict:
        """研究某个主题"""
        # 使用 Meta-Prompt 生成研究计划
        plan_prompt = f"""
请为以下主题制定研究计划：

主题：{topic}

研究计划应包含：
1. 背景概述
2. 关键问题
3. 研究方法
4. 预期成果
"""

        plan_result = self.agent.run(plan_prompt)

        # 使用 ToT 深入分析
        analysis_prompt = f"""
基于以下研究计划，深入分析主题：

主题：{topic}
研究计划：{plan_result['final_answer']}

请从多个角度分析，给出深入见解。
"""

        analysis_result = self.agent.run(analysis_prompt)

        # 使用 Self-Consistency 验证结论
        verification_prompt = f"""
请验证以下研究结论的可靠性：

主题：{topic}
分析结论：{analysis_result['final_answer']}

请从以下角度验证：
1. 逻辑一致性
2. 证据支持度
3. 潜在偏见
"""

        verification_result = self.agent.run(verification_prompt)

        return {
            "topic": topic,
            "research_plan": plan_result["final_answer"],
            "analysis": analysis_result["final_answer"],
            "verification": verification_result["final_answer"]
        }


# 使用示例
if __name__ == "__main__":
    assistant = ResearchAssistant()
    result = assistant.research_topic("大型语言模型的未来发展趋势")

    print("\n" + "="*60)
    print("研究报告")
    print("="*60)
    print(f"\n主题: {result['topic']}")
    print(f"\n研究计划:\n{result['research_plan']}")
    print(f"\n深入分析:\n{result['analysis']}")
    print(f"\n验证结论:\n{result['verification']}")
```

---

## 6. 常见错误与最佳实践

### 6.1 常见错误

| 错误 | 正确做法 |
|------|----------|
| 滥用高级技术 | 简单任务用简单方法 |
| 忽略成本控制 | 设置合理的迭代次数和采样数 |
| 不做任务分类 | 先分类再选择策略 |
| 缺少错误处理 | 每个工具调用都要 try-catch |
| 不做结果验证 | 使用 Self-Consistency 验证关键结论 |

### 6.2 最佳实践

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                       最佳实践清单                                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   1. 任务分类优先                                                            ║
║      - 先判断任务类型，再选择技术栈                                          ║
║      - 不要对所有任务都用最复杂的方法                                        ║
║                                                                            ║
║   2. 渐进式复杂度                                                            ║
║      - 从简单方法开始                                                        ║
║      - 如果效果不好，再尝试更复杂的方法                                      ║
║                                                                            ║
║   3. 成本意识                                                                ║
║      - 追踪 Token 使用量                                                     ║
║      - 设置预算上限                                                          ║
║      - 使用缓存减少重复调用                                                  ║
║                                                                            ║
║   4. 可观测性                                                                ║
║      - 记录每步推理过程                                                      ║
║      - 保存中间结果                                                          ║
║      - 方便调试和复现                                                        ║
║                                                                            ║
║   5. 持续优化                                                                ║
║      - 收集用户反馈                                                          ║
║      - 分析失败案例                                                          ║
║      - 迭代改进 Prompt                                                       ║
║                                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 7. 本节小结

本课综合运用了 Stage 5 的所有高级技术：

1. **Meta-Prompt**：自动生成最优策略和 Prompt
2. **Self-Consistency**：多路径采样保证答案可靠性
3. **Tree of Thoughts**：复杂推理的树形搜索
4. **ReAct**：工具调用和行动执行
5. **多模态**：图片理解和视觉推理

关键要点：
- 根据任务类型选择合适的技术组合
- 渐进式增加复杂度
- 注重成本控制和性能优化
- 保持良好的可观测性

---

## 练习

### 练习 1：任务分类器
实现一个更精确的任务分类器，能够识别 10 种以上的任务类型。

### 练习 2：自定义工具
为 IntelligentAgent 添加 3 个自定义工具（如天气查询、翻译、图片生成）。

### 练习 3：完整项目
使用 IntelligentAgent 构建一个"智能研究助手"，能够：
1. 搜索相关信息
2. 分析数据
3. 生成研究报告
4. 回答相关问题

---

> **恭喜完成 Stage 5！** 你已掌握 Prompt Engineering 的高级技巧。
>
> **下一步**：[Final Project](../final-project/项目说明.md) - 完成最终项目，整合所有知识
