# Lesson 3: 角色型 Prompt

> **课程定位**：Prompt Engineering 入门课程 · Stage 1 第 3 课
> **前置要求**：完成 Lesson 1-2，理解指令型 Prompt
> **预计时长**：50 分钟

---

## 学习目标

完成本课后，你将能够：

1. 理解 Chat API 中 System / User / Assistant 消息的角色分工
2. 掌握角色设计的核心模式：专家、教师、批评者
3. 学会组合 Persona（人格）来增强 Prompt 效果
4. 对比有无角色设定对输出质量的影响
5. 设计适合不同场景的角色 Prompt

---

## 一、Chat API 的消息角色

现代 LLM API 采用多角色消息架构，每种角色有不同作用：

```
Chat API 消息架构:

┌─────────────────────────────────────────────────────────┐
│                      Chat API                            │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  System Message (系统消息)                         │   │
│  │  "你是一位专业的 Python 代码审查员..."              │   │
│  │  作用: 定义模型的行为边界、角色、能力               │   │
│  │  权重: ★★★★★ (最高优先级)                         │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  User Message (用户消息)                           │   │
│  │  "请审查以下代码: def add(a,b)..."                │   │
│  │  作用: 提供具体任务和输入数据                       │   │
│  │  权重: ★★★★☆                                     │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Assistant Message (助手消息)                       │   │
│  │  "这段代码存在以下问题: 1. 缺少类型注解..."        │   │
│  │  作用: 模型的输出，也可用于多轮对话上下文             │   │
│  │  权重: ★★★☆☆                                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘

消息传递流程:
  System → 设定行为框架
  User   → 提供具体任务
  Model  → 基于 System 设定处理 User 请求
  Assistant → 生成符合角色设定的回复
```

---

## 二、角色设计的核心模式

### 2.1 专家模式（Expert）

```
专家模式结构:

┌─────────────────────────────────────────┐
│  专家角色 = 领域 + 经验 + 专业术语        │
│                                         │
│  示例:                                   │
│  "你是一位有 15 年经验的后端架构师，      │
│   擅长高并发系统设计，熟悉微服务架构，     │
│   曾负责日活千万级的电商平台后端。"        │
│                                         │
│  适用场景:                                │
│  - 技术问题解答                           │
│  - 代码审查                              │
│  - 架构设计建议                           │
└─────────────────────────────────────────┘
```

### 2.2 教师模式（Teacher）

```
教师模式结构:

┌─────────────────────────────────────────┐
│  教师角色 = 教学风格 + 学生画像 + 方法论   │
│                                         │
│  示例:                                   │
│  "你是一位耐心的编程教师，你的学生是       │
│   零基础的转行者。用生活中的类比解释       │
│   技术概念，每个概念配一个可运行的示例。"   │
│                                         │
│  适用场景:                                │
│  - 知识讲解                              │
│  - 教程编写                              │
│  - 概念解释                              │
└─────────────────────────────────────────┘
```

### 2.3 批评者模式（Critic）

```
批评者模式结构:

┌─────────────────────────────────────────┐
│  批评者角色 = 审查标准 + 严格程度 + 反馈方式│
│                                         │
│  示例:                                   │
│  "你是一位严格的代码审查者，遵循           │
│   Google 代码规范。指出问题时必须:         │
│   1. 说明违反了哪条规范                    │
│   2. 解释为什么这是问题                   │
│   3. 提供具体的修复建议"                  │
│                                         │
│  适用场景:                                │
│  - 代码审查                              │
│  - 文章润色                              │
│  - 方案评审                              │
└─────────────────────────────────────────┘
```

---

## 三、Persona 组合设计

一个完整的角色 Prompt 可以组合多个维度：

```
Persona 组合公式:

Persona = 身份 + 能力 + 风格 + 约束 + 目标

┌────────────────────────────────────────────────────┐
│                                                    │
│  身份: "你是一位..."                                │
│    ├── 专业背景 (领域专家)                          │
│    ├── 经验级别 (资深/初级)                         │
│    └── 组织角色 (CTO/技术作家/产品经理)             │
│                                                    │
│  能力: "你擅长..."                                  │
│    ├── 核心技能                                    │
│    ├── 工具熟练度                                   │
│    └── 知识范围                                    │
│                                                    │
│  风格: "你的回答风格是..."                          │
│    ├── 语言风格 (正式/通俗)                        │
│    ├── 详细程度 (简洁/详尽)                        │
│    └── 结构偏好 (列表/散文/代码优先)               │
│                                                    │
│  约束: "请注意..."                                  │
│    ├── 不做什么                                    │
│    ├── 必须做什么                                  │
│    └── 边界条件                                    │
│                                                    │
│  目标: "你的目标是帮助用户..."                      │
│    ├── 最终效果                                    │
│    └── 用户体验                                    │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Persona 组合示例**：

```python
# 示例: 技术博客作者的完整 Persona
system_prompt = """
身份：你是一位有 10 年经验的全栈工程师，同时也是技术博客作者，
      在 Medium 上有 5 万粉丝。

能力：精通 React、Node.js、Python，擅长将复杂技术概念用
      通俗语言解释清楚。

风格：
- 用对话式语气写作，像在和读者聊天
- 每篇文章开头用一个真实故事或场景引入
- 代码示例优先，理论解释为辅
- 使用类比帮助理解抽象概念

约束：
- 不使用过于学术化的术语，必要时必须解释
- 每个代码示例必须可直接运行
- 不要假设读者已有特定框架的使用经验

目标：帮助中级开发者突破技术瓶颈，写出更优雅的代码。
"""
```

---

## 四、角色设计对比表

| 场景 | 推荐角色 | 关键设定 | 避免 |
|------|---------|---------|------|
| 代码审查 | 资深工程师 + 严格审查者 | 具体的规范标准 | 过于宽容或过于苛刻 |
| 技术教程 | 耐心教师 + 实战派 | 类比、示例、步骤 | 假设读者已懂前置知识 |
| 创意写作 | 创意作家 + 风格模仿 | 文风、情感基调 | 过多技术约束限制创意 |
| 数据分析 | 数据分析师 + 业务理解 | 分析框架、输出格式 | 纯技术视角忽视业务 |
| 客服回复 | 专业客服 + 同理心 | 语气、解决方案 | 机械式回复、推诿 |
| 法律咨询 | 法律顾问 + 谨慎 | 免责声明、引用法条 | 给出确定性法律建议 |

---

## 五、代码实战

### 5.1 实现角色 Prompt 系统

```python
from openai import OpenAI
from dataclasses import dataclass

client = OpenAI()

@dataclass
class RolePrompt:
    name: str
    system_prompt: str
    description: str

class RoleBasedAssistant:
    """基于角色的 Prompt 系统"""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        self.roles: dict[str, RolePrompt] = {}
        self._register_default_roles()

    def _register_default_roles(self):
        """注册默认角色"""
        self.register_role(RolePrompt(
            name="code_reviewer",
            system_prompt="""你是一位资深 Python 开发工程师，有 15 年后端开发经验。
你审查代码时遵循以下原则:
1. 安全性第一 - 检查 SQL 注入、XSS、敏感信息泄露
2. 性能优化 - 识别 O(n²) 或更高的时间复杂度
3. 可维护性 - 函数长度、命名规范、注释质量
4. Pythonic - 遵循 PEP 8 和 Python 最佳实践

输出格式:
- 问题等级: [严重/警告/建议]
- 问题描述: 一句话说明
- 具体位置: 文件名:行号
- 修复建议: 提供修改后的代码""",
            description="严格的代码审查专家"
        ))

        self.register_role(RolePrompt(
            name="teacher",
            system_prompt="""你是一位耐心的 Python 编程教师，专门教零基础学生。

教学原则:
1. 用生活中的类比解释技术概念
2. 每个概念都配一个可运行的代码示例
3. 先给简单例子，再逐步增加复杂度
4. 鼓励学生动手实践，不要只看不练
5. 承认错误是学习的一部分

语调: 亲切、鼓励、有耐心
避免: 使用未解释的专业术语""",
            description="耐心的编程教师"
        ))

        self.register_role(RolePrompt(
            name="tech_writer",
            system_prompt="""你是一位技术文档专家，擅长编写清晰、专业的技术文档。

写作原则:
1. 使用主动语态，避免被动语态
2. 每个段落只表达一个核心观点
3. 代码示例前后必须有说明文字
4. 使用一致的术语，首次出现时给出定义
5. 文档结构: 概述 → 快速开始 → 详细说明 → API 参考 → 常见问题

语调: 专业但不冰冷，简洁但不简略""",
            description="技术文档写作专家"
        ))

    def register_role(self, role: RolePrompt):
        """注册新角色"""
        self.roles[role.name] = role

    def chat(self, role_name: str, user_message: str) -> str:
        """使用指定角色进行对话"""
        role = self.roles.get(role_name)
        if not role:
            raise ValueError(f"角色 '{role_name}' 未注册。可用角色: {list(self.roles.keys())}")

        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": role.system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        return response.choices[0].message.content


# 使用示例
assistant = RoleBasedAssistant()

code_snippet = """
def login(username, password):
    query = f"SELECT * FROM users WHERE name='{username}' AND pwd='{password}'"
    result = db.execute(query)
    if result:
        return generate_token(result)
    return None
"""

# 使用代码审查角色
print("=== 代码审查专家 ===")
print(assistant.chat("code_reviewer", f"请审查这段代码:\n{code_snippet}"))

# 使用教师角色
print("\n=== 编程教师 ===")
print(assistant.chat("teacher", "请解释什么是 SQL 注入，以及如何防范？"))

# 使用技术文档角色
print("\n=== 技术文档专家 ===")
print(assistant.chat("tech_writer", "请为这个登录函数编写 API 文档。"))
```

### 5.2 对比有无角色的效果

```python
from openai import OpenAI

client = OpenAI()

def compare_with_without_role(
    question: str,
    role_prompt: str,
    model: str = "gpt-4o-mini"
) -> dict[str, str]:
    """对比有无角色设定的输出差异"""

    # 无角色设定
    response_no_role = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "user", "content": question}
        ],
        temperature=0.3,
        max_tokens=500
    )

    # 有角色设定
    response_with_role = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": role_prompt},
            {"role": "user", "content": question}
        ],
        temperature=0.3,
        max_tokens=500
    )

    return {
        "no_role": response_no_role.choices[0].message.content,
        "with_role": response_with_role.choices[0].message.content
    }

# 测试场景
question = "如何优化一个慢查询？"

role_prompt = """你是一位有 10 年经验的 DBA（数据库管理员），
擅长 MySQL 性能优化。

回答要求:
1. 先分析可能的原因（按可能性排序）
2. 每个原因给出具体的优化方案
3. 提供可执行的 SQL 命令或配置修改
4. 说明优化的预期效果

语调: 专业、实战导向，多用"在生产环境中...""""

results = compare_with_without_role(question, role_prompt)

print("无角色设定:")
print(results["no_role"])
print("\n" + "="*60 + "\n")
print("有角色设定 (DBA 专家):")
print(results["with_role"])
```

### 5.3 多角色对话系统

```python
from openai import OpenAI

client = OpenAI()

class MultiRoleDiscussion:
    """多角色讨论系统 - 模拟团队讨论"""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        self.roles = {
            "pm": {
                "name": "产品经理",
                "system": """你是一位经验丰富的产品经理。
关注点: 用户需求、商业价值、优先级、ROI
讨论风格: 提出问题、权衡利弊、关注可落地性
避免: 过于技术化的实现细节"""
            },
            "architect": {
                "name": "架构师",
                "system": """你是一位资深系统架构师。
关注点: 系统可扩展性、技术选型、性能瓶颈、维护成本
讨论风格: 从技术角度分析方案可行性
避免: 忽视业务需求和时间约束"""
            },
            "developer": {
                "name": "开发者",
                "system": """你是一位务实的高级开发者。
关注点: 实现复杂度、开发工期、代码质量、测试覆盖
讨论风格: 给出具体的实现方案和时间估算
避免: 过度设计、追求完美而忽视交付"""
            }
        }

    def discuss(self, topic: str, turns: int = 3) -> list[dict]:
        """模拟多角色讨论"""
    discussion_history = []

    # 初始话题
    messages = [{"role": "user", "content": f"团队讨论话题: {topic}\n\n请各位从自己的角色出发发表看法。"}]

    for turn in range(turns):
        for role_key, role_info in self.roles.items():
            role_messages = [
                {"role": "system", "content": role_info["system"]},
                *messages
            ]

            response = client.chat.completions.create(
                model=self.model,
                messages=role_messages,
                temperature=0.5,
                max_tokens=300
            )

            opinion = response.choices[0].message.content
            discussion_history.append({
                "turn": turn + 1,
                "role": role_info["name"],
                "opinion": opinion
            })

            # 将发言加入上下文
            messages.append({
                "role": "assistant",
                "content": f"[{role_info['name']}]: {opinion}"
            })

    return discussion_history


# 使用示例
discussion = MultiRoleDiscussion()
results = discussion.discuss(
    "我们要不要把单体应用拆分为微服务？目前日活 10 万，预计明年增长到 50 万。",
    turns=2
)

for item in results:
    print(f"\n{'='*50}")
    print(f"第 {item['turn']} 轮 - {item['role']}:")
    print(f"{'='*50}")
    print(item["opinion"])
```

### 5.4 角色 Prompt 的 A/B 测试框架

```python
from openai import OpenAI
from dataclasses import dataclass, field
import json
import time

client = OpenAI()

@dataclass
class ABTestResult:
    test_name: str
    variant_a: str
    variant_b: str
    input_text: str
    output_a: str
    output_b: str
    tokens_a: int
    tokens_b: int
    latency_a: float
    latency_b: float

class RoleABTester:
    """角色 Prompt A/B 测试框架"""

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        self.results: list[ABTestResult] = []

    def run_test(
        self,
        test_name: str,
        role_a: str,
        role_b: str,
        user_input: str
    ) -> ABTestResult:
        """运行一次 A/B 测试"""
        outputs = {}
        tokens = {}
        latencies = {}

        for label, role in [("A", role_a), ("B", role_b)]:
            start = time.time()
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": role},
                    {"role": "user", "content": user_input}
                ],
                temperature=0.3,
                max_tokens=500
            )
            elapsed = time.time() - start

            outputs[label] = response.choices[0].message.content
            tokens[label] = response.usage.total_tokens
            latencies[label] = round(elapsed, 2)

        result = ABTestResult(
            test_name=test_name,
            variant_a=role_a[:50] + "...",
            variant_b=role_b[:50] + "...",
            input_text=user_input,
            output_a=outputs["A"],
            output_b=outputs["B"],
            tokens_a=tokens["A"],
            tokens_b=tokens["B"],
            latency_a=latencies["A"],
            latency_b=latencies["B"]
        )
        self.results.append(result)
        return result

    def print_comparison(self, result: ABTestResult):
        """打印对比结果"""
        print(f"\n测试: {result.test_name}")
        print(f"{'='*60}")
        print(f"[变体 A] ({result.tokens_a} tokens, {result.latency_a}s)")
        print(result.output_a[:300])
        print(f"\n[变体 B] ({result.tokens_b} tokens, {result.latency_b}s)")
        print(result.output_b[:300])


# 运行测试
tester = RoleABTester()

result = tester.run_test(
    test_name="代码解释风格对比",
    role_a="你是一位简洁的高级工程师，用最少的话说清楚问题。",
    role_b="你是一位耐心的教师，用类比和例子详细解释每个概念。",
    user_input="解释 Python 的 GIL（全局解释器锁）是什么？"
)

tester.print_comparison(result)
```

---

## 六、常见错误

### 错误 1：角色设定与任务不匹配
```
❌ "你是一位诗人。请分析这段代码的性能瓶颈。"
   → 角色与任务完全不相关

✅ "你是一位性能优化工程师。请分析这段代码的性能瓶颈。"
```

### 错误 2：角色约束过多导致输出受限
```
❌ System Prompt 包含 20 条约束规则
   → 模型可能忽略部分规则或输出变得不自然

✅ 保留 3-5 条核心约束，其他通过示例暗示
```

### 错误 3：忽略角色的一致性
```
❌ 第一轮: "你是严格的代码审查者"
   第二轮: "帮我写段轻松的代码注释"
   → 角色与请求矛盾

✅ 保持角色一致，或明确切换角色
```

### 错误 4：角色设定过于模糊
```
❌ "你是一个有帮助的助手"
   → 几乎等于没有角色设定

✅ "你是一位有 10 年经验的 Python 后端工程师，
    擅长 FastAPI 和 PostgreSQL，
    回答问题时总是先给代码再解释"
```

---

## 七、总结

```
角色 Prompt 设计要点:

┌─────────────────────────────────────┐
│          角色设计金字塔              │
│                                      │
│              ┌──────┐                │
│              │ 目标 │                │
│              └──┬───┘                │
│           ┌─────┴─────┐              │
│           │  约束规则  │              │
│           └─────┬─────┘              │
│         ┌───────┴───────┐            │
│         │  风格与语调    │            │
│         └───────┬───────┘            │
│       ┌─────────┴─────────┐          │
│       │  能力与专业背景    │          │
│       └─────────┬─────────┘          │
│     ┌───────────┴───────────┐        │
│     │     基础身份定义       │        │
│     └───────────────────────┘        │
└─────────────────────────────────────┘
```

**核心要点**：
1. System Message 定义行为框架，User Message 提供具体任务
2. 角色 = 身份 + 能力 + 风格 + 约束 + 目标
3. 专家、教师、批评者是最常用的三种角色模式
4. 角色设定应与任务匹配，约束要适度
5. 多角色系统可以模拟团队讨论，获得更全面的视角

---

## 练习

### 练习 1：角色设计
为以下场景设计完整的角色 Prompt：
1. 一个专门帮用户写 SQL 查询的助手
2. 一个代码重构顾问
3. 一个技术面试模拟器（模拟面试官）

每个角色至少包含：身份、能力、风格、约束、目标。

### 练习 2：A/B 测试
选择一个任务（如"解释递归"），设计 3 种不同的角色：
1. 严格的教授风格
2. 亲切的朋友风格
3. 幽默的段子手风格

用 API 测试并对比输出，分析哪种角色最适合这个任务。

### 练习 3：多角色系统
设计一个"产品评审会"系统，包含以下角色：
- 产品经理（关注需求和价值）
- 设计师（关注用户体验）
- 工程师（关注技术可行性）
- QA（关注质量和边界情况）

用一个产品功能需求测试这个系统，记录各角色的观点。


---

**下一课**: [少样本 Prompt](./04-少样本Prompt.md)
