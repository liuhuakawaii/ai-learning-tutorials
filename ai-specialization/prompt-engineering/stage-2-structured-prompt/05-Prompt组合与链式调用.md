# Prompt 组合与链式调用

> **课程定位**：Stage 2 - 结构化 Prompt 工程 · 第 5 课
> **前置要求**：完成前 4 课，了解函数式编程基础概念
> **预计用时**：55-65 分钟

---

## 场景引入

你要构建一个内容处理系统：先从文章中提取摘要，再从摘要中提取关键词，最后根据关键词生成标题。你最初用一个超长 Prompt 把所有步骤塞在一起，结果模型经常跳过中间步骤直接给标题。拆成三个独立 Prompt 后，每步的准确率都大幅提升，但手动串联太脆弱——前一步输出格式变了，后一步就崩了。你需要的是一套可靠的链式调用框架，把多个 Prompt 编排成一条自动化的 Pipeline。

---

## 学习目标

1. 理解顺序链、并行执行、条件路由三种调用模式
2. 掌握 Pipeline 模式在 Prompt 工程中的应用
3. 学会设计带错误处理和重试的 Prompt 链
4. 构建一个完整的 Prompt Pipeline 引擎

---

## 1. 链式调用架构总览

```
┌──────────────────────────────────────────────────────────────┐
│              Prompt 链式调用架构                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  模式 1: 顺序链 (Sequential Chain)                            │
│  ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐                 │
│  │ P1   │──▶│ P2   │──▶│ P3   │──▶│ P4   │                 │
│  └──────┘   └──────┘   └──────┘   └──────┘                 │
│  输入 ──▶ 处理 ──▶ 分析 ──▶ 输出                               │
│                                                              │
│  模式 2: 并行执行 (Parallel Execution)                         │
│  ┌──────┐                                                    │
│  │ P1   │──┐                                                 │
│  ├──────┤  │    ┌────────┐                                   │
│  │ P2   │──┼───▶│ Merger │──▶ 输出                           │
│  ├──────┤  │    └────────┘                                   │
│  │ P3   │──┘                                                 │
│  └──────┘                                                    │
│                                                              │
│  模式 3: 条件路由 (Conditional Routing)                        │
│              ┌──────┐                                        │
│         ┌───▶│ P2a  │───┐                                    │
│  ┌──────┤    └──────┘   │   ┌──────┐                         │
│  │ P1   │───▶ Router    ├──▶│ P3   │──▶ 输出                 │
│  └──────┤    ┌──────┐   │   └──────┘                         │
│         └───▶│ P2b  │───┘                                    │
│              └──────┘                                        │
│                                                              │
│  模式 4: 循环迭代 (Iterative Loop)                             │
│  ┌──────┐   ┌──────┐   ┌──────┐                             │
│  │ P1   │──▶│ P2   │──▶│Eval  │──┐                          │
│  └──────┘   └──────┘   └──────┘  │                          │
│       ▲                           │ 不满足                    │
│       └───────────────────────────┘                          │
│                           │ 满足                              │
│                           ▼                                  │
│                        输出结果                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 顺序链（Sequential Chain）

顺序链是最基础的模式，前一个 Prompt 的输出作为后一个的输入。

```python
from dataclasses import dataclass, field
from typing import Any, Callable, Optional
from openai import OpenAI
import json


@dataclass
class ChainStep:
    """链步骤定义"""
    name: str
    prompt_template: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.3
    output_key: str = "output"
    pre_process: Optional[Callable] = None
    post_process: Optional[Callable] = None


class SequentialChain:
    """顺序链执行器"""

    def __init__(self, steps: list[ChainStep]):
        self.steps = steps
        self.client = OpenAI()

    def execute(self, initial_input: dict[str, Any]) -> dict[str, Any]:
        """执行顺序链"""
        context = dict(initial_input)

        for i, step in enumerate(self.steps):
            print(f"\n--- Step {i+1}/{len(self.steps)}: {step.name} ---")

            # 预处理
            if step.pre_process:
                context = step.pre_process(context)

            # 渲染 Prompt
            prompt = step.prompt_template.format(**context)
            print(f"Prompt (前100字): {prompt[:100]}...")

            # 调用 LLM
            response = self.client.chat.completions.create(
                model=step.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=step.temperature,
            )
            result = response.choices[0].message.content

            # 后处理
            if step.post_process:
                result = step.post_process(result)

            # 存入上下文
            context[step.output_key] = result
            print(f"Output (前100字): {result[:100]}...")

        return context


# 使用示例
def demo_sequential():
    steps = [
        ChainStep(
            name="需求提取",
            prompt_template="从以下用户反馈中提取核心需求，用逗号分隔：\n\n{feedback}",
            output_key="requirements",
        ),
        ChainStep(
            name="优先级排序",
            prompt_template="对以下需求按优先级排序（P0最高），输出JSON数组：\n\n需求：{requirements}",
            output_key="prioritized",
            post_process=lambda s: json.loads(s) if s else [],
        ),
        ChainStep(
            name="方案设计",
            prompt_template="为以下高优先级需求设计技术方案：\n\n{prioritized}\n\n输出结构化的技术方案。",
            output_key="solution",
        ),
    ]

    chain = SequentialChain(steps)
    result = chain.execute({
        "feedback": "登录页面加载太慢了，搜索功能不好用，希望能支持暗黑模式，注册流程太复杂"
    })

    print("\n=== 最终结果 ===")
    print(f"需求：{result['requirements']}")
    print(f"优先级：{result['prioritized']}")
    print(f"方案：{result['solution']}")
```

---

## 3. 并行执行（Parallel Execution）

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed


class ParallelChain:
    """并行链执行器"""

    def __init__(self, steps: list[ChainStep], merger: ChainStep):
        self.steps = steps
        self.merger = merger
        self.client = OpenAI()

    def _execute_single(self, step: ChainStep, context: dict) -> tuple[str, str]:
        """执行单个步骤"""
        prompt = step.prompt_template.format(**context)
        response = self.client.chat.completions.create(
            model=step.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=step.temperature,
        )
        result = response.choices[0].message.content
        if step.post_process:
            result = step.post_process(result)
        return step.output_key, result

    def execute(self, initial_input: dict[str, Any], max_workers: int = 3) -> dict[str, Any]:
        """并行执行所有步骤，然后合并结果"""
        context = dict(initial_input)
        parallel_results = {}

        # 并行执行
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self._execute_single, step, context): step
                for step in self.steps
            }
            for future in as_completed(futures):
                step = futures[future]
                try:
                    key, value = future.result()
                    parallel_results[key] = value
                    print(f"✅ {step.name} 完成")
                except Exception as e:
                    print(f"❌ {step.name} 失败: {e}")
                    parallel_results[step.output_key] = f"ERROR: {e}"

        # 合并上下文
        context.update(parallel_results)

        # 执行合并步骤
        print(f"\n--- 合并: {self.merger.name} ---")
        merge_prompt = self.merger.prompt_template.format(**context)
        response = self.client.chat.completions.create(
            model=self.merger.model,
            messages=[{"role": "user", "content": merge_prompt}],
            temperature=self.merger.temperature,
        )
        result = response.choices[0].message.content
        if self.merger.post_process:
            result = self.merger.post_process(result)
        context[self.merger.output_key] = result

        return context


def demo_parallel():
    analysis_steps = [
        ChainStep(
            name="技术可行性分析",
            prompt_template="从技术可行性角度分析以下项目：\n\n{project}",
            output_key="tech_analysis",
        ),
        ChainStep(
            name="市场前景分析",
            prompt_template="从市场前景角度分析以下项目：\n\n{project}",
            output_key="market_analysis",
        ),
        ChainStep(
            name="风险评估",
            prompt_template="评估以下项目的主要风险：\n\n{project}",
            output_key="risk_analysis",
        ),
    ]

    merger = ChainStep(
        name="综合报告",
        prompt_template="""基于以下三个维度的分析，撰写一份综合评估报告：

技术分析：{tech_analysis}
市场分析：{market_analysis}
风险评估：{risk_analysis}

输出结构化的综合报告，包含：结论、建议、下一步行动。""",
        output_key="final_report",
    )

    chain = ParallelChain(analysis_steps, merger)
    result = chain.execute({
        "project": "开发一款 AI 驱动的代码审查工具，面向中小团队"
    })

    print("\n=== 最终报告 ===")
    print(result["final_report"])
```

---

## 4. 条件路由（Conditional Routing）

```python
@dataclass
class Route:
    """路由规则"""
    condition: Callable[[dict], bool]
    target_step: ChainStep
    description: str = ""


class ConditionalRouter:
    """条件路由器"""

    def __init__(self, classifier_step: ChainStep, routes: list[Route], default: ChainStep):
        self.classifier = classifier_step
        self.routes = routes
        self.default = default
        self.client = OpenAI()

    def _classify(self, context: dict) -> str:
        """执行分类步骤"""
        prompt = self.classifier.prompt_template.format(**context)
        response = self.client.chat.completions.create(
            model=self.classifier.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        return response.choices[0].message.content.strip()

    def _route(self, classification: str, context: dict) -> ChainStep:
        """根据分类结果选择路由"""
        context["classification"] = classification
        for route in self.routes:
            if route.condition(context):
                print(f"🔀 路由命中: {route.description}")
                return route.target_step
        print("🔀 使用默认路由")
        return self.default

    def execute(self, initial_input: dict[str, Any]) -> dict[str, Any]:
        """执行条件路由"""
        context = dict(initial_input)

        # 分类
        classification = self._classify(context)
        print(f"📋 分类结果: {classification}")

        # 路由
        target_step = self._route(classification, context)

        # 执行目标步骤
        prompt = target_step.prompt_template.format(**context)
        response = self.client.chat.completions.create(
            model=target_step.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=target_step.temperature,
        )
        result = response.choices[0].message.content
        if target_step.post_process:
            result = target_step.post_process(result)
        context[target_step.output_key] = result

        return context


def demo_conditional():
    classifier = ChainStep(
        name="意图分类",
        prompt_template="""判断以下用户消息的意图类别，只输出类别名称：

类别：bug_report | feature_request | billing_question | general

用户消息：{message}""",
    )

    routes = [
        Route(
            condition=lambda ctx: "bug" in ctx.get("classification", "").lower(),
            target_step=ChainStep(
                name="Bug 处理",
                prompt_template="用户报告了一个 Bug：{message}\n\n请收集必要信息并提供排查步骤。",
                output_key="response",
            ),
            description="Bug 报告路由",
        ),
        Route(
            condition=lambda ctx: "feature" in ctx.get("classification", "").lower(),
            target_step=ChainStep(
                name="功能需求处理",
                prompt_template="用户提出了功能需求：{message}\n\n请评估需求合理性并给出反馈。",
                output_key="response",
            ),
            description="功能需求路由",
        ),
        Route(
            condition=lambda ctx: "billing" in ctx.get("classification", "").lower(),
            target_step=ChainStep(
                name="账单处理",
                prompt_template="用户有账单问题：{message}\n\n请引导用户查看账单详情或联系财务。",
                output_key="response",
            ),
            description="账单问题路由",
        ),
    ]

    default = ChainStep(
        name="通用回复",
        prompt_template="用户说：{message}\n\n请友好地回复并询问是否需要其他帮助。",
        output_key="response",
    )

    router = ConditionalRouter(classifier, routes, default)

    test_messages = [
        "登录页面一直报 500 错误，急！",
        "能不能加一个批量导出功能？",
        "我的月费为什么被多扣了？",
    ]

    for msg in test_messages:
        print(f"\n{'='*50}")
        print(f"用户：{msg}")
        result = router.execute({"message": msg})
        print(f"回复：{result['response']}")
```

---

## 5. 迭代优化链（Iterative Refinement）

```python
class IterativeChain:
    """迭代优化链：输出不满足条件时自动重试优化"""

    def __init__(
        self,
        generator: ChainStep,
        evaluator: ChainStep,
        max_iterations: int = 3,
    ):
        self.generator = generator
        self.evaluator = evaluator
        self.max_iterations = max_iterations
        self.client = OpenAI()

    def _call_llm(self, step: ChainStep, context: dict) -> str:
        prompt = step.prompt_template.format(**context)
        response = self.client.chat.completions.create(
            model=step.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=step.temperature,
        )
        return response.choices[0].message.content

    def execute(self, initial_input: dict[str, Any]) -> dict[str, Any]:
        context = dict(initial_input)

        for iteration in range(self.max_iterations):
            print(f"\n--- 迭代 {iteration + 1}/{self.max_iterations} ---")

            # 生成
            output = self._call_llm(self.generator, context)
            context[self.generator.output_key] = output
            print(f"生成内容 (前100字): {output[:100]}...")

            # 评估
            context["draft"] = output
            evaluation = self._call_llm(self.evaluator, context)
            context["evaluation"] = evaluation
            print(f"评估结果: {evaluation[:100]}...")

            # 检查是否通过
            if "PASS" in evaluation.upper() or "通过" in evaluation:
                print(f"✅ 第 {iteration + 1} 次迭代通过评估")
                context["iterations"] = iteration + 1
                return context

            # 将评估反馈加入上下文，进行下一轮优化
            context["feedback"] = evaluation
            context["previous_draft"] = output

        print(f"⚠️ 达到最大迭代次数 {self.max_iterations}，返回最后一次结果")
        context["iterations"] = self.max_iterations
        return context


def demo_iterative():
    generator = ChainStep(
        name="文案生成",
        prompt_template="""请撰写一段产品文案。

产品：{product}
{feedback_section}

要求：简洁有力，突出卖点，不超过100字。""",
        output_key="draft",
        temperature=0.8,
    )

    evaluator = ChainStep(
        name="文案评审",
        prompt_template="""请评审以下产品文案：

文案：{draft}
产品：{product}

评审标准：
1. 是否简洁有力（不超过100字）
2. 是否突出核心卖点
3. 是否有吸引力

如果通过，回复 "PASS" 并简述理由。
如果不通过，回复 "FAIL" 并给出具体修改建议。""",
        output_key="evaluation",
        temperature=0,
    )

    chain = IterativeChain(generator, evaluator, max_iterations=3)
    result = chain.execute({
        "product": "AI 代码审查助手 - 自动发现代码中的 Bug 和安全漏洞",
        "feedback_section": "",
    })

    print(f"\n=== 最终文案（迭代 {result['iterations']} 次）===")
    print(result["draft"])
```

---

## 6. 代码实战：Pipeline 引擎

### 6.1 完整 Pipeline 引擎

```python
from enum import Enum
from typing import Union


class StepType(Enum):
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    CONDITIONAL = "conditional"
    ITERATIVE = "iterative"


@dataclass
class PipelineConfig:
    """Pipeline 配置"""
    name: str
    description: str
    steps: list[dict]
    error_handling: str = "stop"  # stop | skip | retry
    max_retries: int = 3
    timeout: int = 60


class PipelineEngine:
    """Prompt Pipeline 引擎"""

    def __init__(self):
        self.client = OpenAI()
        self._step_registry: dict[str, Callable] = {}
        self._middleware: list[Callable] = []

    def register_step(self, name: str, handler: Callable):
        """注册步骤处理器"""
        self._step_registry[name] = handler

    def add_middleware(self, middleware: Callable):
        """添加中间件"""
        self._middleware.append(middleware)

    def _execute_with_retry(
        self,
        step_name: str,
        handler: Callable,
        context: dict,
        max_retries: int = 3,
    ) -> Any:
        """带重试的执行"""
        last_error = None
        for attempt in range(max_retries):
            try:
                result = handler(context)
                return result
            except Exception as e:
                last_error = e
                print(f"⚠️ {step_name} 第 {attempt+1} 次失败: {e}")
                if attempt < max_retries - 1:
                    context["_retry_feedback"] = str(e)

        raise RuntimeError(f"{step_name} 重试 {max_retries} 次后仍失败: {last_error}")

    def run(self, config: PipelineConfig, initial_input: dict) -> dict:
        """执行 Pipeline"""
        context = dict(initial_input)
        context["_pipeline_name"] = config.name

        print(f"🚀 启动 Pipeline: {config.name}")

        for i, step_config in enumerate(config.steps):
            step_name = step_config.get("name", f"step_{i}")
            step_type = step_config.get("type", "sequential")
            handler_name = step_config.get("handler")

            print(f"\n{'='*40}")
            print(f"Step {i+1}: {step_name} (type={step_type})")

            # 执行中间件
            for mw in self._middleware:
                context = mw(step_name, context)

            handler = self._step_registry.get(handler_name)
            if not handler:
                print(f"❌ 未找到处理器: {handler_name}")
                if config.error_handling == "stop":
                    raise ValueError(f"Handler '{handler_name}' not found")
                continue

            try:
                result = self._execute_with_retry(
                    step_name, handler, context, config.max_retries
                )
                if isinstance(result, dict):
                    context.update(result)
                else:
                    context[f"{step_name}_output"] = result
            except Exception as e:
                print(f"❌ {step_name} 最终失败: {e}")
                if config.error_handling == "stop":
                    raise
                context[f"{step_name}_error"] = str(e)

        print(f"\n✅ Pipeline 完成: {config.name}")
        return context


# 中间件示例：日志记录
def logging_middleware(step_name: str, context: dict) -> dict:
    """日志中间件"""
    keys = [k for k in context.keys() if not k.startswith("_")]
    print(f"  📝 [{step_name}] 上下文 keys: {keys}")
    return context


# 中间件示例：Token 预估
def token_middleware(step_name: str, context: dict) -> dict:
    """Token 预估中间件"""
    total_chars = sum(len(str(v)) for v in context.values())
    estimated_tokens = total_chars // 2  # 粗略估计
    print(f"  📊 [{step_name}] 预估 tokens: ~{estimated_tokens}")
    return context
```

### 6.2 注册处理器

```python
def create_pipeline_handlers(client: OpenAI) -> dict[str, Callable]:
    """创建 Pipeline 处理器"""

    def summarize(context: dict) -> str:
        """文本摘要"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"请对以下内容生成一段200字以内的摘要：\n\n{context['text']}"
            }],
            temperature=0.3,
        )
        return response.choices[0].message.content

    def extract_keywords(context: dict) -> list[str]:
        """关键词提取"""
        text = context.get("text", "")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"从以下文本中提取5-10个关键词，用JSON数组格式输出：\n\n{text}"
            }],
            temperature=0,
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
        return data.get("keywords", data) if isinstance(data, dict) else data

    def generate_title(context: dict) -> str:
        """标题生成"""
        summary = context.get("summarize_output", "")
        keywords = context.get("extract_keywords_output", [])
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"基于以下摘要和关键词，生成一个吸引人的标题：\n\n摘要：{summary}\n关键词：{', '.join(keywords) if isinstance(keywords, list) else keywords}"
            }],
            temperature=0.7,
        )
        return response.choices[0].message.content

    return {
        "summarize": summarize,
        "extract_keywords": extract_keywords,
        "generate_title": generate_title,
    }
```

### 6.3 完整运行示例

```python
def demo_pipeline():
    client = OpenAI()
    engine = PipelineEngine()

    # 注册处理器
    handlers = create_pipeline_handlers(client)
    for name, handler in handlers.items():
        engine.register_step(name, handler)

    # 添加中间件
    engine.add_middleware(logging_middleware)
    engine.add_middleware(token_middleware)

    # 配置 Pipeline
    config = PipelineConfig(
        name="内容处理流水线",
        description="摘要 → 关键词提取 → 标题生成",
        steps=[
            {"name": "摘要", "handler": "summarize"},
            {"name": "关键词", "handler": "extract_keywords"},
            {"name": "标题", "handler": "generate_title"},
        ],
        error_handling="retry",
        max_retries=2,
    )

    # 执行
    result = engine.run(config, {
        "text": """
        Prompt Engineering 是一门设计和优化 Prompt 的技术学科。
        随着大语言模型的普及，Prompt Engineering 变得越来越重要。
        好的 Prompt 能显著提升 AI 的输出质量。
        本文介绍了 Prompt 模板设计、变量注入、输出格式控制等核心技术。
        """
    })

    print("\n=== Pipeline 结果 ===")
    print(f"摘要：{result.get('summarize_output', 'N/A')}")
    print(f"关键词：{result.get('extract_keywords_output', 'N/A')}")
    print(f"标题：{result.get('generate_title_output', 'N/A')}")


if __name__ == "__main__":
    demo_pipeline()
```

---

## 7. 对比表：链式模式选择

| 模式 | 执行方式 | 适用场景 | 复杂度 | 性能 |
|------|---------|---------|--------|------|
| 顺序链 | 串行 | 有依赖的多步骤任务 | 低 | 低 |
| 并行链 | 并发 | 独立的多维度分析 | 中 | 高 |
| 条件路由 | 分支 | 输入类型多样的场景 | 中 | 中 |
| 迭代链 | 循环 | 需要质量优化的任务 | 高 | 低 |
| Pipeline | 混合 | 复杂的企业级流程 | 高 | 可配置 |

---

## 8. 常见误区

### ❌ 错误 1：上下文无限膨胀

```python
# 错误：每步都把完整输出塞入上下文
context["step1_full"] = very_long_output  # 5000 tokens
context["step2_full"] = another_long_output  # 5000 tokens
# 第 3 步时上下文已 10000+ tokens

# 正确：只传递必要信息
context["step1_summary"] = summarize(very_long_output, max_tokens=200)
```

### ❌ 错误 2：无错误处理

```python
# 错误：任何步骤失败整个链崩溃
result = chain.execute(input)

# 正确：每步都有错误处理
try:
    result = chain.execute(input)
except ChainStepError as e:
    partial_result = e.context  # 保存已完成步骤的结果
    handle_failure(partial_result)
```

### ❌ 错误 3：硬编码链路

```python
# 错误：链路写死在代码里
result = step1(input)
result = step2(result)
result = step3(result)

# 正确：链路可配置
config = load_pipeline_config("pipeline.yaml")
engine.run(config, input)
```

---

## 9. 工程建议

1. **每步只传递必要信息**：链式调用中，前一步的完整输出可能有数千 Token，只把摘要或关键字段传给下一步，避免上下文无限膨胀。
2. **每步都要有错误处理**：单步失败不应导致整个链崩溃，用 try-catch 包裹每步执行，保存已完成步骤的部分结果。
3. **链路配置化而非硬编码**：将 Pipeline 的步骤定义放在 YAML/JSON 配置文件中，方便调整顺序、增减步骤，无需改代码。
4. **迭代链限制最大重试次数**：自动优化循环必须设置上限（建议 ≤ 3），防止模型在"生成-评估"之间无限循环。

---

## 10. 总结

- 链式调用是构建复杂 AI 应用的核心模式
- 不同模式适用于不同场景，选择合适的模式至关重要
- Pipeline 引擎提供了统一的编排、错误处理和监控能力
- 注意上下文管理和错误恢复，避免级联失败

---

## 练习

### 练习 1：翻译润色链
构建一个两步顺序链：
1. Step 1：将中文翻译为英文
2. Step 2：润色英文翻译，使其更地道自然

比较直接翻译和链式翻译的质量差异。

### 练习 2：多模型路由
实现一个条件路由器，根据任务复杂度自动选择模型：
- 简单问题 → gpt-4o-mini
- 中等问题 → gpt-4o
- 复杂推理 → 使用 CoT（Chain-of-Thought）+ gpt-4o

### 练习 3：质量优化循环
实现一个迭代链，自动优化生成的邮件：
1. 生成邮件初稿
2. 评估邮件的专业性、礼貌度、简洁度
3. 根据评估反馈修改
4. 循环直到评估通过或达到最大迭代次数

---

## 参考答案

### 练习 1：翻译润色链

**思路**：构建两步顺序链——第一步用低 temperature 做忠实翻译，第二步用稍高 temperature 做地道润色。对比时，让同一个模型直接翻译（单步），与链式结果并排比较用词自然度和句式流畅度。

**答案**：

```python
from dataclasses import dataclass
from typing import Any, Optional, Callable
from openai import OpenAI


@dataclass
class ChainStep:
    name: str
    prompt_template: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.3
    output_key: str = "output"
    post_process: Optional[Callable] = None


class SequentialChain:
    def __init__(self, steps: list[ChainStep]):
        self.steps = steps
        self.client = OpenAI()

    def execute(self, initial_input: dict[str, Any]) -> dict[str, Any]:
        context = dict(initial_input)
        for step in self.steps:
            prompt = step.prompt_template.format(**context)
            response = self.client.chat.completions.create(
                model=step.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=step.temperature,
            )
            result = response.choices[0].message.content
            if step.post_process:
                result = step.post_process(result)
            context[step.output_key] = result
        return context


def build_translation_chain() -> SequentialChain:
    """构建翻译润色链"""
    steps = [
        ChainStep(
            name="直译",
            prompt_template="请将以下中文翻译为英文，要求忠实原文含义，不要意译：\n\n{chinese_text}",
            output_key="raw_translation",
            temperature=0.2,
        ),
        ChainStep(
            name="润色",
            prompt_template="""请润色以下英文翻译，使其读起来像母语者写的自然英文：

原文翻译：{raw_translation}

要求：
1. 保持原意不变
2. 使用更地道的表达和句式
3. 调整语气使其自然流畅

只输出润色后的英文，不要解释。""",
            output_key="polished_translation",
            temperature=0.6,
        ),
    ]
    return SequentialChain(steps)


def compare_direct_vs_chain(chinese_text: str):
    """对比直接翻译和链式翻译"""
    client = OpenAI()

    # 直接翻译
    direct_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"请将以下中文翻译为英文：\n\n{chinese_text}"}],
        temperature=0.3,
    )
    direct_result = direct_response.choices[0].message.content

    # 链式翻译
    chain = build_translation_chain()
    chain_result = chain.execute({"chinese_text": chinese_text})

    print("=== 直接翻译 ===")
    print(direct_result)
    print("\n=== 链式翻译（直译 → 润色）===")
    print(chain_result["polished_translation"])

    return direct_result, chain_result["polished_translation"]


# 测试
test_text = "这个项目的上线日期一拖再拖，团队士气低落，客户也越来越不耐烦了。"
compare_direct_vs_chain(test_text)
```

**要点**：
- 第一步用低 temperature（0.2）保证翻译忠实，第二步用较高 temperature（0.6）允许语言灵活度
- 链式翻译的优势在于每步职责单一，模型注意力更集中，翻译质量通常优于单步完成
- 缺点是两次 API 调用增加了延迟和成本，适合对质量要求高的场景

---

### 练习 2：多模型路由

**思路**：先用分类器判断问题复杂度，再根据分类结果路由到不同模型。简单问题直接用 gpt-4o-mini 省成本，复杂推理问题注入 CoT 指令再调 gpt-4o。关键是分类器要轻量（用小模型 + 低 temperature），避免路由本身成为瓶颈。

**答案**：

```python
from dataclasses import dataclass
from typing import Any, Callable, Optional
from openai import OpenAI
import json


@dataclass
class ChainStep:
    name: str
    prompt_template: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.3
    output_key: str = "output"
    post_process: Optional[Callable] = None


@dataclass
class Route:
    condition: Callable[[dict], bool]
    target_step: ChainStep
    description: str = ""


class ConditionalRouter:
    def __init__(self, classifier_step: ChainStep, routes: list[Route], default: ChainStep):
        self.classifier = classifier_step
        self.routes = routes
        self.default = default
        self.client = OpenAI()

    def _classify(self, context: dict) -> str:
        prompt = self.classifier.prompt_template.format(**context)
        response = self.client.chat.completions.create(
            model=self.classifier.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        return response.choices[0].message.content.strip()

    def execute(self, initial_input: dict[str, Any]) -> dict[str, Any]:
        context = dict(initial_input)
        classification = self._classify(context)
        context["complexity"] = classification
        print(f"复杂度分类: {classification}")

        # 路由选择
        for route in self.routes:
            if route.condition(context):
                target = route.target_step
                print(f"路由命中: {route.description} → 模型: {target.model}")
                break
        else:
            target = self.default
            print(f"使用默认路由 → 模型: {target.model}")

        # 执行
        prompt = target.prompt_template.format(**context)
        response = self.client.chat.completions.create(
            model=target.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=target.temperature,
        )
        result = response.choices[0].message.content
        context[target.output_key] = result
        return context


def build_model_router() -> ConditionalRouter:
    """构建多模型路由器"""
    classifier = ChainStep(
        name="复杂度分类",
        prompt_template="""判断以下问题的复杂度，只输出一个词：simple | medium | complex

判断标准：
- simple：事实查询、定义解释、简单计算（如"Python 是什么"、"1+1等于几"）
- medium：需要一定分析的问题（如"对比 React 和 Vue 的优缺点"）
- complex：需要多步推理、数学证明、代码架构设计（如"设计一个分布式锁方案"）

问题：{question}""",
        model="gpt-4o-mini",
    )

    routes = [
        Route(
            condition=lambda ctx: "simple" in ctx.get("complexity", "").lower(),
            target_step=ChainStep(
                name="简单回答",
                prompt_template="请简洁回答：{question}",
                model="gpt-4o-mini",
                temperature=0.3,
                output_key="answer",
            ),
            description="简单问题 → gpt-4o-mini",
        ),
        Route(
            condition=lambda ctx: "medium" in ctx.get("complexity", "").lower(),
            target_step=ChainStep(
                name="中等回答",
                prompt_template="请详细回答以下问题，分点论述：{question}",
                model="gpt-4o",
                temperature=0.5,
                output_key="answer",
            ),
            description="中等问题 → gpt-4o",
        ),
        Route(
            condition=lambda ctx: "complex" in ctx.get("complexity", "").lower(),
            target_step=ChainStep(
                name="复杂推理",
                prompt_template="""请用 Chain-of-Thought 方法回答以下问题：

问题：{question}

要求：
1. 先列出已知条件和约束
2. 分步骤推理，每步写出推理过程
3. 最后给出结论

请一步步思考。""",
                model="gpt-4o",
                temperature=0.3,
                output_key="answer",
            ),
            description="复杂推理 → CoT + gpt-4o",
        ),
    ]

    default = ChainStep(
        name="默认回答",
        prompt_template="请回答：{question}",
        model="gpt-4o-mini",
        output_key="answer",
    )

    return ConditionalRouter(classifier, routes, default)


# 测试
router = build_model_router()

test_questions = [
    "Python 的 list 和 tuple 有什么区别？",
    "对比微服务和单体架构的优缺点",
    "设计一个支持百万级并发的短链接服务",
]

for q in test_questions:
    print(f"\n{'='*50}")
    print(f"问题: {q}")
    result = router.execute({"question": q})
    print(f"回答: {result['answer'][:200]}...")
```

**要点**：
- 分类器用 gpt-4o-mini + temperature=0 保证路由判断快速且稳定
- CoT 指令只在 complex 路由中注入，避免简单问题被不必要地拉长
- 实际生产中可在路由层加入缓存：相同问题直接返回缓存结果，节省 API 调用

---

### 练习 3：质量优化循环

**思路**：用迭代链实现"生成 → 评估 → 反馈 → 修改"循环。评估器从专业性、礼貌度、简洁度三个维度打分，任一维度不达标则将具体反馈传回生成器。设置最大迭代次数防止无限循环。

**答案**：

```python
from dataclasses import dataclass
from typing import Any, Optional, Callable
from openai import OpenAI
import json


@dataclass
class ChainStep:
    name: str
    prompt_template: str
    model: str = "gpt-4o-mini"
    temperature: float = 0.3
    output_key: str = "output"


class IterativeChain:
    def __init__(self, generator: ChainStep, evaluator: ChainStep, max_iterations: int = 3):
        self.generator = generator
        self.evaluator = evaluator
        self.max_iterations = max_iterations
        self.client = OpenAI()

    def _call_llm(self, step: ChainStep, context: dict) -> str:
        prompt = step.prompt_template.format(**context)
        response = self.client.chat.completions.create(
            model=step.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=step.temperature,
        )
        return response.choices[0].message.content

    def execute(self, initial_input: dict[str, Any]) -> dict[str, Any]:
        context = dict(initial_input)

        for iteration in range(self.max_iterations):
            print(f"\n--- 迭代 {iteration + 1}/{self.max_iterations} ---")

            # 生成邮件
            if iteration == 0:
                context["feedback_section"] = ""
            else:
                context["feedback_section"] = f"上一版的问题：{context.get('feedback', '')}\n请根据反馈修改。"

            output = self._call_llm(self.generator, context)
            context[self.generator.output_key] = output
            context["draft"] = output
            print(f"邮件草稿:\n{output[:200]}...")

            # 评估
            evaluation = self._call_llm(self.evaluator, context)
            context["evaluation"] = evaluation
            print(f"评估结果:\n{evaluation[:200]}...")

            # 检查是否通过
            if "PASS" in evaluation.upper() or "通过" in evaluation:
                print(f"✅ 第 {iteration + 1} 次迭代通过评估")
                context["iterations"] = iteration + 1
                return context

            # 提取反馈用于下一轮
            context["feedback"] = evaluation
            context["previous_draft"] = output

        print(f"⚠️ 达到最大迭代次数 {self.max_iterations}")
        context["iterations"] = self.max_iterations
        return context


def build_email_optimization_chain() -> IterativeChain:
    """构建邮件优化迭代链"""
    generator = ChainStep(
        name="邮件生成",
        prompt_template="""请撰写一封{purpose}邮件。

收件人：{recipient}
目的：{purpose}
{feedback_section}

要求：
- 专业但不生硬
- 礼貌且简洁
- 结构清晰（问候、正文、结尾）

只输出邮件正文。""",
        output_key="draft",
        temperature=0.7,
    )

    evaluator = ChainStep(
        name="邮件评审",
        prompt_template="""请评审以下邮件草稿：

---
{draft}
---

请从三个维度打分（1-10）并给出具体改进建议：

1. **专业性**：用词是否专业、结构是否清晰
2. **礼貌度**：语气是否得体、是否有冒犯性表达
3. **简洁度**：是否冗余、能否更精炼

输出格式：
- 专业性：X/10 - 说明
- 礼貌度：X/10 - 说明
- 简洁度：X/10 - 说明
- 总评：PASS 或 FAIL
- 具体修改建议：（如 FAIL）""",
        output_key="evaluation",
        temperature=0,
    )

    return IterativeChain(generator, evaluator, max_iterations=3)


# 测试
chain = build_email_optimization_chain()
result = chain.execute({
    "recipient": "王总监",
    "purpose": "项目延期通知及后续计划",
})

print(f"\n{'='*50}")
print(f"最终邮件（迭代 {result['iterations']} 次）：")
print(result["draft"])
```

**要点**：
- 生成器 temperature 设为 0.7 保证每轮有变化空间，评估器设为 0 保证评判稳定
- 评估器输出结构化评分，便于程序判断 PASS/FAIL，也方便将具体维度的不足反馈给生成器
- 最大迭代次数建议 ≤ 3，超过 3 轮通常意味着 Prompt 或评估标准本身需要调整


---

**下一课**: [阶段实战：构建 Prompt 模板库](./06-阶段实战-构建Prompt模板库.md)
