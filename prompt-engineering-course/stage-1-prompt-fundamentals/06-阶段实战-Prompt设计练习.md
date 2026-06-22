# Lesson 6: 阶段实战 - Prompt 设计练习

> **课程定位**：Prompt Engineering 入门课程 · Stage 1 综合实战
> **前置要求**：完成 Lesson 1-5，掌握所有基础 Prompt 技术
> **预计时长**：60 分钟

---

## 场景引入

你已经学了 5 种 Prompt 技术，但面对一个真实需求——比如"做一个代码审查助手"——你仍然不知道该从哪里入手：该用角色型还是指令型？要不要加 Few-shot？CoT 有没有必要？更关键的是，写完之后怎么判断这个 Prompt 好不好？本课就是要把这些孤立的技术串成一套可复用的设计流程，让你拿到任何需求都能系统性地设计、对比和优化 Prompt。

---

## 学习目标

完成本课后，你将能够：

1. 综合运用 5 种基础 Prompt 技术解决实际问题
2. 根据任务特点选择最优的 Prompt 策略组合
3. 设计和实现一个 Prompt 比较工具
4. 使用评估框架系统性地评价 Prompt 质量
5. 独立完成 Prompt 设计挑战

---

## 一、技术回顾与整合

Stage 1 学习了 5 种核心 Prompt 技术：

```
Prompt 技术工具箱:

┌─────────────────────────────────────────────────────────┐
│                                                          │
│  1. Prompt 本质     → 理解 Token、上下文、采样控制         │
│  2. 指令型 Prompt   → SALT 框架 (Specific, Action,       │
│                      Length, Tone)                       │
│  3. 角色型 Prompt   → System/Persona 设计                │
│  4. 少样本 Prompt   → 0-shot, 1-shot, Few-shot           │
│  5. 思维链 Prompt   → Zero-shot CoT, Manual CoT,         │
│                      Self-Consistency                    │
│                                                          │
└─────────────────────────────────────────────────────────┘

技术组合策略:

简单任务: 指令型 (SALT) + 角色型
中等任务: 指令型 + Few-shot
复杂任务: 角色型 + Few-shot + CoT
格式要求: 指令型 + One-shot (格式锚定)
```

---

## 二、综合实战：Prompt 设计挑战

### 挑战 1：智能代码审查助手

```
需求: 设计一个代码审查 Prompt，要求:
1. 能识别安全漏洞、性能问题、代码风格
2. 按严重程度分级 (严重/警告/建议)
3. 提供修复代码
4. 语气专业但建设性

技术组合:
- 角色型: 定义资深审查员角色
- 指令型: SALT 框架约束输出
- Few-shot: 提供审查示例
- CoT: 引导逐步分析
```

### 挑战 2：多语言文档翻译器

```
需求: 设计一个翻译 Prompt，要求:
1. 保持技术术语的准确性
2. 适应目标语言的表达习惯
3. 保持原文的格式结构
4. 对不确定的翻译给出注释

技术组合:
- 角色型: 专业翻译专家
- 指令型: 明确翻译规则
- Few-shot: 提供翻译对照示例
```

### 挑战 3：数据分析报告生成器

```
需求: 设计一个数据分析 Prompt，要求:
1. 从原始数据中提取关键洞察
2. 生成结构化报告
3. 包含数据可视化建议
4. 给出可执行的建议

技术组合:
- 角色型: 数据分析师角色
- 指令型: 报告结构要求
- CoT: 引导分析思路
```

---

## 三、代码实战：Prompt 设计 Playground

### 3.1 完整的 Prompt 比较工具

```python
from openai import OpenAI
from dataclasses import dataclass, field
from typing import Callable
import json
import time

client = OpenAI()

@dataclass
class PromptVariant:
    name: str
    system_prompt: str
    user_template: str
    description: str

@dataclass
class ComparisonResult:
    variant_name: str
    output: str
    tokens_used: int
    latency: float
    rating: int = 0  # 1-5 评分

class PromptPlayground:
    """Prompt 设计比较工具"""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        self.variants: list[PromptVariant] = []
        self.results: list[ComparisonResult] = []

    def add_variant(self, variant: PromptVariant):
        """添加 Prompt 变体"""
        self.variants.append(variant)

    def run_comparison(self, user_input: str) -> list[ComparisonResult]:
        """运行所有变体的对比"""
        self.results = []

        for variant in self.variants:
            start_time = time.time()

            # 构建用户消息
            user_content = variant.user_template.format(input=user_input)

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": variant.system_prompt},
                    {"role": "user", "content": user_content}
                ],
                temperature=0.3,
                max_tokens=1000
            )

            latency = time.time() - start_time

            result = ComparisonResult(
                variant_name=variant.name,
                output=response.choices[0].message.content,
                tokens_used=response.usage.total_tokens,
                latency=round(latency, 2)
            )
            self.results.append(result)

        return self.results

    def print_comparison(self):
        """打印对比结果"""
        print("\n" + "="*70)
        print("Prompt 对比结果")
        print("="*70)

        for result in self.results:
            print(f"\n【{result.variant_name}】")
            print(f"Token 消耗: {result.tokens_used} | 延迟: {result.latency}s")
            print("-"*50)
            print(result.output[:500])
            if len(result.output) > 500:
                print("... (输出被截断)")
            print()

    def rank_results(self) -> list[tuple[str, float]]:
        """基于 Token 效率和延迟排序"""
        scored = []
        for r in self.results:
            # 简单评分: Token 越少越好，延迟越低越好
            efficiency_score = 1000 / max(r.tokens_used, 1)
            speed_score = 1 / max(r.latency, 0.1)
            total_score = efficiency_score + speed_score
            scored.append((r.variant_name, round(total_score, 2)))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored


# === 实战: 代码审查 Prompt 设计 ===

playground = PromptPlayground()

# 变体 1: 简单指令
playground.add_variant(PromptVariant(
    name="简单指令",
    system_prompt="审查这段代码。",
    user_template="{input}",
    description="最简单的指令"
))

# 变体 2: SALT 框架
playground.add_variant(PromptVariant(
    name="SALT 框架",
    system_prompt="""你是一位资深 Python 开发工程师 (Specific)。

审查维度:
1. 安全性 - SQL 注入、XSS、敏感信息
2. 性能 - 时间复杂度、空间复杂度
3. 可维护性 - 命名、注释、结构

输出格式 (Action):
- 问题等级: [严重/警告/建议]
- 问题描述: 一句话
- 修复代码: 完整代码

长度: 每个问题一段，总计不超过 300 字 (Length)
语调: 专业、建设性 (Tone)""",
    user_template="请审查以下代码:\n{input}",
    description="使用 SALT 框架的完整指令"
))

# 变体 3: 角色 + Few-shot
playground.add_variant(PromptVariant(
    name="角色 + Few-shot",
    system_prompt="""你是一位严格的代码审查专家，遵循 Google Python 规范。

审查示例:
输入: def calc(x,y): return x+y
输出:
- [建议] 命名不规范: 函数名应为 calculate_sum，参数应为 num1, num2
- [建议] 缺少类型注解: def calculate_sum(num1: float, num2: float) -> float
- [建议] 缺少文档字符串

请用相同格式审查代码。""",
    user_template="{input}",
    description="角色设定 + 审查示例"
))

# 变体 4: 角色 + CoT
playground.add_variant(PromptVariant(
    name="角色 + CoT",
    system_prompt="""你是一位资深 Python 架构师。

审查流程 (请按此顺序逐步分析):
1. 先理解代码的整体意图
2. 检查安全性问题 (SQL 注入、XSS 等)
3. 分析性能瓶颈 (时间/空间复杂度)
4. 评估代码质量 (命名、结构、可维护性)
5. 给出优先级排序的修复建议

每个步骤先输出分析，再给出结论。""",
    user_template="请审查以下代码:\n{input}",
    description="角色设定 + 思维链推理"
))

# 运行对比
code_snippet = """
def get_users(ids):
    results = []
    for id in ids:
        query = f"SELECT * FROM users WHERE id = {id}"
        user = db.execute(query)
        if user:
            results.append(user)
    return results
"""

print("=== 代码审查 Prompt 设计对比 ===")
results = playground.run_comparison(code_snippet)
playground.print_comparison()

# 效率排名
print("\n=== 效率排名 ===")
rankings = playground.rank_results()
for rank, (name, score) in enumerate(rankings, 1):
    print(f"{rank}. {name} (综合评分: {score})")
```

### 3.2 Prompt 评估框架

```python
from openai import OpenAI
from dataclasses import dataclass
import json

client = OpenAI()

@dataclass
class EvaluationCriteria:
    name: str
    description: str
    weight: float  # 权重 0-1

@dataclass
class EvaluationResult:
    criteria_name: str
    score: int  # 1-5
    reasoning: str

class PromptEvaluator:
    """Prompt 输出质量评估器"""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        self.criteria: list[EvaluationCriteria] = []
        self._register_default_criteria()

    def _register_default_criteria(self):
        """注册默认评估标准"""
        self.criteria = [
            EvaluationCriteria(
                name="准确性",
                description="输出内容是否事实正确，无明显错误",
                weight=0.3
            ),
            EvaluationCriteria(
                name="完整性",
                description="是否覆盖了所有要求的方面",
                weight=0.25
            ),
            EvaluationCriteria(
                name="格式规范",
                description="输出格式是否符合要求，结构是否清晰",
                weight=0.2
            ),
            EvaluationCriteria(
                name="实用性",
                description="输出是否可以直接使用或具有参考价值",
                weight=0.15
            ),
            EvaluationCriteria(
                name="简洁性",
                description="是否用最少的文字表达了完整的意思，无冗余",
                weight=0.1
            ),
        ]

    def evaluate(
        self,
        output: str,
        task_description: str,
        expected_format: str = ""
    ) -> dict:
        """评估 Prompt 输出质量"""
        results = []
        total_score = 0.0

        for criteria in self.criteria:
            eval_prompt = f"""请评估以下输出的质量。

评估维度: {criteria.name} - {criteria.description}
任务描述: {task_description}
期望格式: {expected_format if expected_format else '无特定要求'}

待评估输出:
{output}

请按以下 JSON 格式输出:
{{"score": 1-5的整数, "reasoning": "评分理由"}}

评分标准:
1分: 完全不符合要求
2分: 大部分不符合
3分: 基本符合但有明显不足
4分: 良好，只有小问题
5分: 优秀，完全符合要求"""

            response = client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": eval_prompt}],
                temperature=0.0,
                max_tokens=200
            )

            raw = response.choices[0].message.content
            try:
                parsed = json.loads(raw)
                score = parsed.get("score", 3)
                reasoning = parsed.get("reasoning", "")
            except json.JSONDecodeError:
                score = 3
                reasoning = "无法解析评估结果"

            results.append(EvaluationResult(
                criteria_name=criteria.name,
                score=score,
                reasoning=reasoning
            ))

            total_score += score * criteria.weight

        return {
            "total_score": round(total_score, 2),
            "max_possible_score": 5.0,
            "percentage": round(total_score / 5.0 * 100, 1),
            "details": [
                {
                    "criteria": r.criteria_name,
                    "score": r.score,
                    "weight": next(c.weight for c in self.criteria if c.name == r.criteria_name),
                    "reasoning": r.reasoning
                }
                for r in results
            ]
        }

    def compare_outputs(
        self,
        outputs: dict[str, str],
        task_description: str,
        expected_format: str = ""
    ) -> dict:
        """对比多个输出的质量"""
        comparisons = {}

        for name, output in outputs.items():
            evaluation = self.evaluate(output, task_description, expected_format)
            comparisons[name] = evaluation

        # 按总分排序
        ranked = sorted(
            comparisons.items(),
            key=lambda x: x[1]["total_score"],
            reverse=True
        )

        return {
            "rankings": [(name, eval_result["total_score"]) for name, eval_result in ranked],
            "detailed": comparisons
        }


# 使用示例
evaluator = PromptEvaluator()

# 模拟不同 Prompt 的输出
outputs = {
    "简单指令": """这段代码有问题。查询不安全，应该用参数化查询。性能也不好，循环查询数据库。建议优化。""",
    
    "SALT 框架": """## 代码审查报告

### 1. [严重] SQL 注入漏洞
**问题**: 第 4 行使用 f-string 直接拼接 SQL，存在注入风险。
**修复**: 使用参数化查询
```python
query = "SELECT * FROM users WHERE id = %s"
user = db.execute(query, (id,))
```

### 2. [警告] N+1 查询问题
**问题**: 循环中逐个查询数据库，性能差。
**修复**: 使用 IN 查询批量获取
```python
placeholders = ','.join(['%s'] * len(ids))
query = f"SELECT * FROM users WHERE id IN ({placeholders})"
users = db.execute(query, ids)
```

### 3. [建议] 命名规范
**问题**: `ids` 和 `id` 过于简短，建议使用更具描述性的命名。""",
    
    "角色 + CoT": """## 逐步审查分析

### 步骤 1: 理解代码意图
这段代码根据 ID 列表批量查询用户信息。意图明确，但实现存在严重问题。

### 步骤 2: 安全性检查 ⚠️
发现 **SQL 注入漏洞**: f-string 直接插入用户输入到 SQL 语句。
这是最严重的问题，必须优先修复。

### 步骤 3: 性能分析 ⚠️
N+1 查询模式: 循环中每次迭代都执行数据库查询。
假设有 100 个 ID，就会执行 100 次查询。

### 步骤 4: 代码质量评估
- 命名: `get_users` 可以，但 `ids`/`id` 不够清晰
- 结构: 函数职责单一，符合单一职责原则
- 缺少: 类型注解、文档字符串、错误处理

### 步骤 5: 修复建议 (按优先级)

1. **[严重] 修复 SQL 注入**
```python
def get_users(ids: list[int]) -> list[dict]:
    placeholders = ','.join(['%s'] * len(ids))
    query = f"SELECT * FROM users WHERE id IN ({placeholders})"
    return db.execute(query, ids)
```

2. **[警告] 添加错误处理**
```python
def get_users(ids: list[int]) -> list[dict]:
    try:
        # ... 查询逻辑
    except DatabaseError as e:
        logger.error(f"查询用户失败: {e}")
        return []
```

3. **[建议] 添加文档字符串**
```python
def get_users(ids: list[int]) -> list[dict]:
    \"\"\"根据 ID 列表批量查询用户信息。
    
    Args:
        ids: 用户 ID 列表
        
    Returns:
        用户信息字典列表
    \"\"\"
```"""
}

task_desc = "审查 Python 代码，识别安全漏洞、性能问题和代码质量问题"
expected_fmt = "按严重程度分级，每个问题包含描述和修复代码"

print("=== Prompt 输出质量评估 ===\n")
result = evaluator.compare_outputs(outputs, task_desc, expected_fmt)

print("排名:")
for rank, (name, score) in enumerate(result["rankings"], 1):
    print(f"  {rank}. {name} (得分: {score}/5.0)")

print("\n详细评估:")
for name, eval_data in result["detailed"].items():
    print(f"\n【{name}】总分: {eval_data['total_score']}/5.0 ({eval_data['percentage']}%)")
    for detail in eval_data["details"]:
        print(f"  - {detail['criteria']}: {detail['score']}/5 (权重{detail['weight']})")
        print(f"    {detail['reasoning']}")
```

### 3.3 场景化 Prompt 设计练习

```python
from openai import OpenAI
from dataclasses import dataclass
import json

client = OpenAI()

@dataclass
class DesignChallenge:
    name: str
    description: str
    requirements: list[str]
    difficulty: str  # easy, medium, hard
    suggested_techniques: list[str]

class PromptDesignWorkshop:
    """Prompt 设计练习工作坊"""

    def __init__(self):
        self.challenges: list[DesignChallenge] = []
        self._register_challenges()

    def _register_challenges(self):
        """注册设计挑战"""
        self.challenges = [
            DesignChallenge(
                name="技术文档生成器",
                description="为一个开源项目生成 API 文档",
                requirements=[
                    "包含端点描述、参数说明、返回值",
                    "提供 curl 和 Python 示例",
                    "包含错误码说明",
                    "输出 Markdown 格式"
                ],
                difficulty="medium",
                suggested_techniques=["角色型", "指令型", "Few-shot"]
            ),
            DesignChallenge(
                name="SQL 查询优化顾问",
                description="分析慢查询并提供优化建议",
                requirements=[
                    "解释查询执行计划",
                    "识别性能瓶颈",
                    "提供优化后的 SQL",
                    "预估性能提升"
                ],
                difficulty="hard",
                suggested_techniques=["角色型", "CoT", "Few-shot"]
            ),
            DesignChallenge(
                name="代码翻译器",
                description="将 Python 代码翻译为 JavaScript",
                requirements=[
                    "保持功能一致性",
                    "使用目标语言的惯用写法",
                    "处理语言特性差异",
                    "添加必要的注释"
                ],
                difficulty="medium",
                suggested_techniques=["角色型", "指令型", "Few-shot"]
            ),
            DesignChallenge(
                name="Bug 报告分析器",
                description="分析用户提交的 Bug 报告，提取关键信息",
                requirements=[
                    "提取复现步骤",
                    "识别环境信息",
                    "分类 Bug 严重程度",
                    "建议可能的原因"
                ],
                difficulty="easy",
                suggested_techniques=["角色型", "指令型", "CoT"]
            ),
            DesignChallenge(
                name="面试题生成器",
                description="根据职位要求生成技术面试题",
                requirements=[
                    "覆盖不同难度级别",
                    "包含理论和实践题",
                    "提供参考答案",
                    "标注考察的知识点"
                ],
                difficulty="medium",
                suggested_techniques=["角色型", "指令型", "Few-shot"]
            ),
        ]

    def get_challenge(self, index: int) -> DesignChallenge:
        """获取指定挑战"""
        if 0 <= index < len(self.challenges):
            return self.challenges[index]
        raise IndexError("挑战索引超出范围")

    def list_challenges(self) -> None:
        """列出所有挑战"""
        print("\n=== Prompt 设计挑战列表 ===\n")
        for i, challenge in enumerate(self.challenges):
            print(f"{i+1}. [{challenge.difficulty.upper()}] {challenge.name}")
            print(f"   {challenge.description}")
            print(f"   推荐技术: {', '.join(challenge.suggested_techniques)}")
            print()

    def evaluate_design(
        self,
        challenge: DesignChallenge,
        designed_prompt: str,
        test_input: str
    ) -> dict:
        """评估设计的 Prompt"""
        # 用设计的 Prompt 生成输出
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": designed_prompt},
                {"role": "user", "content": test_input}
            ],
            temperature=0.3,
            max_tokens=1000
        )

        output = response.choices[0].message.content

        # 检查是否满足需求
        eval_prompt = f"""评估以下输出是否满足需求。

需求:
{chr(10).join(f'- {r}' for r in challenge.requirements)}

输出:
{output}

对每个需求，判断是否满足 (是/否)，并简要说明。
最后给出总体评分 (1-5)。

输出 JSON 格式:
{{"requirements_met": [{{"requirement": "...", "met": true/false, "note": "..."}}], "overall_score": 1-5}}"""

        eval_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": eval_prompt}],
            temperature=0.0,
            max_tokens=500
        )

        try:
            evaluation = json.loads(eval_response.choices[0].message.content)
        except json.JSONDecodeError:
            evaluation = {"error": "无法解析评估结果"}

        return {
            "output": output,
            "evaluation": evaluation,
            "tokens_used": response.usage.total_tokens
        }


# 使用示例
workshop = PromptDesignWorkshop()
workshop.list_challenges()

# 选择一个挑战并设计 Prompt
challenge = workshop.get_challenge(0)  # 技术文档生成器

print(f"\n=== 挑战: {challenge.name} ===")
print(f"描述: {challenge.description}")
print(f"需求:")
for req in challenge.requirements:
    print(f"  - {req}")

# 示例设计的 Prompt
designed_prompt = """你是一位资深的技术文档工程师，擅长编写清晰、专业的 API 文档。

文档结构要求:
1. 端点概述 - 一句话说明用途
2. 请求方法和路径
3. 参数说明 - 表格格式，包含参数名、类型、必填、说明
4. 返回值 - JSON 示例和字段说明
5. 错误码 - 表格格式
6. 使用示例 - curl 和 Python requests 示例

写作规范:
- 使用主动语态
- 每个参数必须有示例值
- 代码块使用正确的语法高亮标记
- 输出 Markdown 格式"""

test_input = "请为以下 API 生成文档: GET /api/users/{user_id} - 获取指定用户的详细信息，支持 include=posts,comments 参数"

result = workshop.evaluate_design(challenge, designed_prompt, test_input)

print(f"\n=== 测试结果 ===")
print(f"输出预览:\n{result['output'][:500]}...")
print(f"\n评估结果:")
print(json.dumps(result['evaluation'], ensure_ascii=False, indent=2))
```

---

## 四、Prompt 设计评估量规

```
Prompt 质量评估量规 (Rubric):

┌─────────────┬───────────────────────────────────────────────────┐
│ 维度         │ 评估标准                                          │
├─────────────┼───────────────────────────────────────────────────┤
│ 清晰度       │ 5分: 指令无歧义，模型一次理解                      │
│ (Clarity)    │ 3分: 基本清晰，偶有误解                           │
│              │ 1分: 模糊不清，频繁误解                            │
├─────────────┼───────────────────────────────────────────────────┤
│ 完整性       │ 5分: 覆盖所有需求，无遗漏                          │
│(Completeness)│ 3分: 覆盖主要需求，有小遗漏                        │
│              │ 1分: 大量需求未覆盖                                │
├─────────────┼───────────────────────────────────────────────────┤
│ 效率         │ 5分: Token 使用最优，无冗余                        │
│ (Efficiency) │ 3分: Token 使用合理，略有冗余                      │
│              │ 1分: Token 浪费严重                                │
├─────────────┼───────────────────────────────────────────────────┤
│ 鲁棒性       │ 5分: 各种输入都能产生高质量输出                    │
│ (Robustness) │ 3分: 大部分输入表现良好                            │
│              │ 1分: 输入稍有变化就输出质量下降                    │
├─────────────┼───────────────────────────────────────────────────┤
│ 可维护性     │ 5分: 结构清晰，易于修改和扩展                      │
│(Maintainability)│ 3分: 基本可维护                              │
│              │ 1分: 难以理解和修改                                │
└─────────────┴───────────────────────────────────────────────────┘

总分 = Σ (维度分数 × 权重)
权重: 清晰度 30%, 完整性 25%, 效率 20%, 鲁棒性 15%, 可维护性 10%
```

---

## 五、综合练习

### 练习 1：端到端 Prompt 设计
选择以下场景之一，完成完整的 Prompt 设计：

**场景 A: 智能客服系统**
- 需求: 处理用户关于产品的问题、投诉、退换货
- 要求: 保持友好语气，提供准确信息，无法解决时转人工
- 评估: 测试 10 个不同类型的用户输入

**场景 B: 代码生成助手**
- 需求: 根据自然语言描述生成 Python 代码
- 要求: 代码可运行，有注释，遵循 PEP 8
- 评估: 测试 5 个不同复杂度的代码需求

**场景 C: 内容摘要工具**
- 需求: 将长文章压缩为指定长度的摘要
- 要求: 保留关键信息，可调节详细程度
- 评估: 测试 3 种不同长度的文章

设计步骤：
1. 分析需求，确定技术组合
2. 编写 Prompt 初版
3. 用 3-5 个测试用例验证
4. 根据结果迭代优化
5. 记录优化过程和最终版本

### 练习 2：Prompt 优化挑战
给你一个"质量不佳"的 Prompt，要求在 3 次迭代内优化到评估分数 4.0 以上。

初始 Prompt:
```
"帮我分析数据。"
```

任务: 分析销售数据并生成月度报告
评估标准: 使用上述评估量规

### 练习 3：技术组合实验
针对同一任务，设计 5 个不同技术组合的 Prompt：
1. 纯指令型
2. 指令型 + 角色型
3. 指令型 + Few-shot
4. 角色型 + CoT
5. 全组合 (角色 + Few-shot + CoT)

对比输出质量和 Token 消耗，分析最优组合。

---

## 六、Stage 1 总结

```
Stage 1 知识体系:

┌─────────────────────────────────────────────────────────┐
│                    Prompt 基础                           │
│                                                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │  Token    │  │  Context  │  │ Temperature│           │
│  │  分词     │  │  Window   │  │  采样控制   │           │
│  └───────────┘  └───────────┘  └───────────┘           │
│                         │                                │
│                         ▼                                │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │  指令型   │  │  角色型   │  │  少样本    │           │
│  │  SALT     │  │  Persona  │  │  Few-shot  │           │
│  └───────────┘  └───────────┘  └───────────┘           │
│                         │                                │
│                         ▼                                │
│              ┌─────────────────┐                        │
│              │    思维链 CoT    │                        │
│              │  推理 → 答案     │                        │
│              └─────────────────┘                        │
│                         │                                │
│                         ▼                                │
│              ┌─────────────────┐                        │
│              │    综合实战      │                        │
│              │  组合 + 评估     │                        │
│              └─────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

**进入 Stage 2 的准备**：
- 你已掌握 5 种基础 Prompt 技术
- 你了解如何组合使用这些技术
- 你有了评估 Prompt 质量的框架
- Stage 2 将学习高级技术：Prompt 链、自适应 Prompt、Prompt 调优等

---

## 七、常见误区

| 错误类型 | 表现 | 解决方案 |
|---------|------|---------|
| 技术选择不当 | 简单任务用 CoT | 根据任务复杂度选择技术 |
| 过度设计 | Prompt 过长过复杂 | 遵循 KISS 原则 |
| 忽视评估 | 只看输出不评估 | 使用评估量规系统评估 |
| 缺乏迭代 | 写一次就用 | 至少 3 次迭代优化 |
| 忽视成本 | 不关注 Token 消耗 | 平衡质量和成本 |
| 格式不一致 | 示例格式混乱 | 统一输入输出格式 |
| 缺少边界处理 | 未考虑异常输入 | 添加兜底指令 |

---

## 八、工程建议

1. **先定评估标准再写 Prompt**：在动手设计之前，明确"好输出"的 3-5 个评估维度（准确率、格式、Token 效率等），用评估量规驱动迭代。
2. **从最简单的 Prompt 开始**：先用最简单的指令跑通流程，确认基本功能后再逐步叠加角色、Few-shot、CoT 等技术。
3. **每次只改一个变量**：优化 Prompt 时，每次只修改一个要素（角色、示例数量、指令措辞等），否则无法定位哪个改动带来了效果提升。
4. **保留 Prompt 版本历史**：用 Git 或版本管理工具记录每次修改，方便回退和对比不同版本的效果。

---

## 九、课后挑战

### 挑战 A: Prompt Golf
目标: 用最少的 Token 实现指定功能。
规则: 功能完整度必须达到 90% 以上。
评分: Token 数越少，分数越高。

### 挑战 B: Prompt Robustness
目标: 设计一个能处理各种异常输入的 Prompt。
测试: 故意输入错误、模糊、矛盾的内容。
评分: 异常处理能力越强，分数越高。

### 挑战 C: Prompt Composition
目标: 设计 3 个可复用的 Prompt 组件，能灵活组合。
要求: 每个组件独立可用，组合后效果更好。
评分: 组件复用性和组合效果。
