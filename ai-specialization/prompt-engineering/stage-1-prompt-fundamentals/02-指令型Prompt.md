# Lesson 2: 指令型 Prompt

> **课程定位**：Prompt Engineering 入门课程 · Stage 1 第 2 课
> **前置要求**：完成 Lesson 1，理解 Prompt 的本质
> **预计时长**：50 分钟

---

## 场景引入

你的产品经理发来一句话："帮我写个分析报告。"你把这句话原封不动丢给 GPT，结果返回了一篇泛泛而谈的长文，既没有数据支撑，也没有明确结论。你反复追加"写得具体一点""用数据说话"，来回五六轮才勉强得到想要的结果。根本原因在于：指令太模糊。指令型 Prompt 的核心不是"说了什么"，而是"说得够不够精确"——一个合格的指令应该让模型第一次就理解你要什么、怎么做、输出什么格式。

---

## 学习目标

完成本课后，你将能够：

1. 掌握指令型 Prompt 的核心原则：清晰、具体、可执行
2. 运用 SALT 框架设计高质量指令
3. 区分模糊指令与精确指令的效果差异
4. 理解指令顺序对输出质量的影响
5. 批量测试和优化指令表达

---

## 一、什么是指令型 Prompt

指令型 Prompt 是最直接、最常用的 Prompt 模式。你直接告诉模型**要做什么**，就像给一个高效的助手下达任务。

```
指令型 Prompt 的本质:

┌─────────────────────────────────────────┐
│            你的指令 (Prompt)             │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │ 做什么  │ │ 怎么做  │ │ 输出要求  │ │
│  │ (Action)│ │(Method) │ │ (Format)  │ │
│  └─────────┘ └─────────┘ └───────────┘ │
│                                         │
└──────────────────┬──────────────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │   LLM 执行并生成     │
        └─────────────────────┘

好的指令 = 明确的行动 + 清晰的约束 + 期望的格式
```

---

## 二、模糊 vs 精确：指令的光谱

```
指令精确度光谱:

非常模糊                                              非常精确
   │                                                      │
   ▼                                                      ▼
"帮我写点东西"  "写篇文章"  "写一篇关于AI的文章"  "写一篇800字关于GPT-4在医疗领域应用的科普文章，面向非技术读者，包含3个实际案例"
   │              │              │                              │
   ▼              ▼              ▼                              ▼
 毫无方向      太过宽泛      有主题无约束              完整的任务定义
```

**具体案例对比**：

| 维度 | 模糊指令 | 精确指令 |
|------|---------|---------|
| 目标 | "帮我处理数据" | "将 CSV 文件中的用户数据按年龄分组，统计每组平均消费金额" |
| 格式 | "给我一些结果" | "输出 Markdown 表格，包含列：年龄段、人数、平均消费、占比" |
| 约束 | "写得专业一点" | "使用金融行业术语，避免口语化表达" |
| 长度 | "详细说说" | "每个要点控制在 2-3 句话，总长度 300 字以内" |

---

## 三、SALT 框架

SALT 是设计高质量指令型 Prompt 的系统框架：

```
SALT 框架:

┌──────────────────────────────────────────────────┐
│                                                  │
│  S - Specific    (具体的)                         │
│      明确指出要做什么，避免歧义                     │
│                                                  │
│  A - Action      (行动导向)                       │
│      使用明确的动作动词开头                        │
│                                                  │
│  L - Length       (长度控制)                       │
│      指定期望的输出长度或范围                      │
│                                                  │
│  T - Tone        (语调风格)                       │
│      定义输出的语言风格和正式程度                   │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 3.1 Specific（具体）

```
❌ 不具体: "分析一下这个数据"
✅ 具体:   "分析 2024 年 Q1 的销售数据，找出销量下降超过 20% 的产品，
           并按下降幅度排序"

❌ 不具体: "帮我改改这段代码"
✅ 具体:   "重构这段代码，将重复的数据库查询逻辑提取为独立函数，
           并添加类型注解"
```

### 3.2 Action（行动导向）

常用动作动词及其适用场景：

| 动词 | 适用场景 | 示例 |
|------|---------|------|
| 总结/概括 | 信息压缩 | "总结这篇文章的 3 个核心观点" |
| 分析 | 深度理解 | "分析这段代码的时间复杂度" |
| 比较 | 对比评估 | "比较 React 和 Vue 的状态管理方案" |
| 生成 | 内容创作 | "生成 5 个 API 端点的单元测试" |
| 重构 | 代码优化 | "重构这个函数，遵循单一职责原则" |
| 解释 | 知识传递 | "用非技术人员能理解的语言解释 Docker" |
| 列举 | 信息枚举 | "列举 3 种常见的缓存失效策略" |
| 转换 | 格式变化 | "将这个 JSON 转换为 TypeScript 接口定义" |

### 3.3 Length（长度控制）

```
长度控制技巧:

精确控制:  "用 3 个要点回答，每个要点 1-2 句话"
范围控制:  "输出 200-300 字"
结构控制:  "每个部分不超过 100 字，共 3 个部分"
比例控制:  "分析占 60%，建议占 40%"
```

### 3.4 Tone（语调风格）

```
语调光谱:

学术正式    专业严谨    中性客观    通俗易懂    轻松随意
   │           │           │           │           │
   ▼           ▼           ▼           ▼           ▼
"论文语气"  "技术文档"  "新闻报道"  "科普文章"  "朋友聊天"
```

**完整的 SALT 示例**：

```
普通指令:
"帮我写一封邮件"

SALT 优化后:
"写一封邮件给供应商 (Specific)，
 催促上周订购的办公用品尽快发货 (Action)，
 控制在 150 字以内 (Length)，
 语气礼貌但表达紧迫感 (Tone)。"
```

---

## 四、指令顺序的影响

LLM 对指令的处理存在**位置效应**：开头和结尾的指令权重更高。

```
位置效应示意图:

Prompt 权重分布:
█▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓█
↑                                                    ↑
开头指令                                           结尾指令
权重较高                                           权重较高

中间指令可能被"稀释"

推荐的指令结构:
┌─────────────────────────────────────┐
│ 1. 角色定义 (如果需要)               │  ← 高权重
│ 2. 核心任务指令                      │
│ 3. 具体约束和要求                    │
│ 4. 输出格式要求                      │
│ 5. 重点强调 (可重复关键约束)          │  ← 高权重
└─────────────────────────────────────┘
```

**指令顺序实验**：

```python
# 顺序 A: 格式要求在前，内容要求在后
prompt_a = """请用 JSON 格式输出。
分析以下文本的情感倾向。
文本："{text}"
输出字段包括：sentiment, confidence, reasoning"""

# 顺序 B: 内容要求在前，格式要求在后
prompt_b = """分析以下文本的情感倾向。
文本："{text}"
请用 JSON 格式输出，字段包括：sentiment, confidence, reasoning"""

# 通常 prompt_b 的效果更好，因为格式要求紧接在输出之前
```

---

## 五、代码实战

### 5.1 模糊 vs 精确指令对比

```python
from openai import OpenAI

client = OpenAI()

def test_instruction(prompt: str, task_input: str, label: str) -> str:
    """测试指令效果"""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": task_input}
        ],
        temperature=0.3,
        max_tokens=500
    )
    result = response.choices[0].message.content
    print(f"\n{'='*60}")
    print(f"[{label}]")
    print(f"{'='*60}")
    print(f"指令 Prompt:\n{prompt}\n")
    print(f"输出:\n{result}")
    return result

# 测试场景: 代码审查
task_input = """
def get_user(id):
    user = db.query("SELECT * FROM users WHERE id = " + id)
    if user:
        return user
    return None
"""

# 模糊指令
vague = "审查这段代码。"

# 精确指令 (SALT 框架)
precise = """你是一位资深 Python 开发工程师。请审查以下代码 (Specific)。

审查维度:
1. 安全性 - 是否存在注入风险
2. 最佳实践 - 是否符合 PEP 8
3. 错误处理 - 异常情况是否覆盖

对每个问题 (Action):
- 指出具体行号
- 说明问题原因
- 提供修复代码

输出格式 (Length): 每个问题一个段落，总计不超过 300 字
语调 (Tone): 专业、建设性，不要过度批评"""

test_instruction(vague, task_input, "模糊指令")
test_instruction(precise, task_input, "精确指令 (SALT)")
```

### 5.2 批量测试不同指令风格

```python
from openai import OpenAI
from dataclasses import dataclass

client = OpenAI()

@dataclass
class InstructionStyle:
    name: str
    system_prompt: str
    description: str

def batch_test_instruction_styles(
    styles: list[InstructionStyle],
    user_input: str,
    model: str = "gpt-4o-mini"
) -> dict[str, str]:
    """批量测试不同指令风格"""
    results = {}

    for style in styles:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": style.system_prompt},
                {"role": "user", "content": user_input}
            ],
            temperature=0.3,
            max_tokens=300
        )
        results[style.name] = response.choices[0].message.content

    return results

# 定义不同的指令风格
styles = [
    InstructionStyle(
        name="极简指令",
        system_prompt="回答用户的问题。",
        description="最简单的指令，无任何约束"
    ),
    InstructionStyle(
        name="角色 + 指令",
        system_prompt="你是一位经验丰富的 Python 教师。用简单易懂的语言解释概念，"
                      "每个概念配一个代码示例。",
        description="添加角色和基本要求"
    ),
    InstructionStyle(
        name="SALT 完整指令",
        system_prompt="""你是一位 Python 高级讲师，擅长将复杂概念简化 (Specific)。

任务: 回答用户的 Python 问题 (Action)。

要求:
1. 先用一句话概括核心概念
2. 给出一个简洁的代码示例
3. 列出 2 个常见误区

输出长度: 150-200 字 (Length)
语调: 亲切、鼓励性的教学语气 (Tone)""",
        description="完整的 SALT 框架指令"
    ),
]

# 测试
user_question = "Python 的装饰器是什么？"
results = batch_test_instruction_styles(styles, user_question)

for name, output in results.items():
    print(f"\n{'='*50}")
    print(f"风格: {name}")
    print(f"{'='*50}")
    print(output)
```

### 5.3 指令顺序实验

```python
from openai import OpenAI

client = OpenAI()

def test_instruction_order(text: str) -> None:
    """测试指令顺序对输出的影响"""

    # 顺序 1: 任务 → 格式 → 约束
    prompt_1 = """分析以下评论的情感。
输出 JSON 格式，包含 sentiment 和 score 字段。
score 范围 -1 到 1，只输出 JSON 不要其他内容。"""

    # 顺序 2: 约束 → 任务 → 格式
    prompt_2 = """只输出 JSON，不要任何解释文字。
分析以下评论的情感。
输出格式：{"sentiment": "positive/negative/neutral", "score": 数值}"""

    # 顺序 3: 任务 → 约束 → 格式 (推荐)
    prompt_3 = """分析以下评论的情感倾向。
score 范围 -1 到 1，只输出 JSON。
输出格式：{"sentiment": "positive/negative/neutral", "score": 数值}"""

    prompts = [
        ("顺序1: 任务→格式→约束", prompt_1),
        ("顺序2: 约束→任务→格式", prompt_2),
        ("顺序3: 任务→约束→格式", prompt_3),
    ]

    for name, prompt in prompts:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.0,
            max_tokens=100
        )
        output = response.choices[0].message.content
        print(f"\n{name}:")
        print(f"  输出: {output}")

# 测试
test_instruction_order("这个产品真的太好用了，强烈推荐！")
```

### 5.4 构建指令模板系统

```python
from string import Template

class InstructionBuilder:
    """指令型 Prompt 构建器"""

    def __init__(self):
        self.role = ""
        self.task = ""
        self.constraints = []
        self.output_format = ""
        self.tone = ""
        self.length = ""

    def set_role(self, role: str) -> "InstructionBuilder":
        self.role = role
        return self

    def set_task(self, task: str) -> "InstructionBuilder":
        self.task = task
        return self

    def add_constraint(self, constraint: str) -> "InstructionBuilder":
        self.constraints.append(constraint)
        return self

    def set_output_format(self, fmt: str) -> "InstructionBuilder":
        self.output_format = fmt
        return self

    def set_tone(self, tone: str) -> "InstructionBuilder":
        self.tone = tone
        return self

    def set_length(self, length: str) -> "InstructionBuilder":
        self.length = length
        return self

    def build(self) -> str:
        parts = []
        if self.role:
            parts.append(f"你是{self.role}。")
        if self.task:
            parts.append(f"任务：{self.task}")
        if self.constraints:
            constraints_str = "\n".join(f"- {c}" for c in self.constraints)
            parts.append(f"要求：\n{constraints_str}")
        if self.length:
            parts.append(f"长度：{self.length}")
        if self.tone:
            parts.append(f"语调：{self.tone}")
        if self.output_format:
            parts.append(f"输出格式：{self.output_format}")
        return "\n\n".join(parts)


# 使用示例
builder = InstructionBuilder()
prompt = (
    builder
    .set_role("资深数据分析师")
    .set_task("分析用户行为数据，找出关键趋势")
    .add_constraint("使用具体数字支撑结论")
    .add_constraint("对比环比和同比数据")
    .add_constraint("指出异常值并解释可能原因")
    .set_length("每个趋势 2-3 句话，共 5 个趋势")
    .set_tone("专业、数据驱动、客观")
    .set_output_format("Markdown 列表，每个趋势包含标题和分析")
    .build()
)

print(prompt)
# 输出:
# 你是资深数据分析师。
#
# 任务：分析用户行为数据，找出关键趋势
#
# 要求：
# - 使用具体数字支撑结论
# - 对比环比和同比数据
# - 指出异常值并解释可能原因
#
# 长度：每个趋势 2-3 句话，共 5 个趋势
#
# 语调：专业、数据驱动、客观
#
# 输出格式：Markdown 列表，每个趋势包含标题和分析
```

---

## 六、常见误区

### 错误 1：指令过于笼统
```
❌ "帮我优化这段代码"
✅ "重构这段代码：
   1. 将嵌套 if-else 改为早返回模式
   2. 提取重复的验证逻辑为独立函数
   3. 添加类型注解"
```

### 错误 2：指令互相矛盾
```
❌ "详细解释每个概念，控制在 50 字以内"
   → 详细 vs 50 字 冲突

✅ "用一句话概括每个概念的核心含义，控制在 50 字以内"
```

### 错误 3：缺少输出格式约束
```
❌ "分析这段数据"
   → 模型可能返回散文、表格、列表等任意格式

✅ "分析这段数据，以 Markdown 表格输出，
   列：指标名称、当前值、变化趋势、建议行动"
```

### 错误 4：一次塞入过多指令
```
❌ 一个 Prompt 中包含 15 条不同要求
   → 模型可能忽略部分要求

✅ 将任务拆分为多个步骤，分步执行
   或使用编号列表，明确优先级
```

---

## 七、工程建议

1. **用 SALT 框架做自检**：每次写完 Prompt 后，逐项检查是否包含 Specific、Action、Length、Tone 四要素，缺失的补上。
2. **把格式要求放在最后**：模型对紧接在输出之前的指令更敏感，将输出格式要求放在 Prompt 末尾可以显著提升格式遵从率。
3. **为关键指令编号**：当一个 Prompt 包含多条要求时，用编号列表明确优先级，避免模型遗漏中间条目。
4. **建立指令模板库**：将反复使用的指令模式抽象为模板，用 `{变量}` 标记可替换部分，减少重复劳动和风格不一致。

---

## 八、总结

```
指令型 Prompt 设计流程:

┌──────────────┐
│  明确目标     │  → 我要模型做什么？
└──────┬───────┘
       ▼
┌──────────────┐
│  应用 SALT   │  → 具体、行动、长度、语调
└──────┬───────┘
       ▼
┌──────────────┐
│  组织顺序     │  → 重要信息在前，格式在后
└──────┬───────┘
       ▼
┌──────────────┐
│  测试迭代     │  → 对比不同版本的效果
└──────┬───────┘
       ▼
┌──────────────┐
│  固化模板     │  → 可复用的指令模板
└──────────────┘
```

**核心要点**：
1. 精确的指令比模糊的指令产生更好的输出
2. SALT 框架确保指令的完整性和可执行性
3. 指令顺序影响模型对不同要求的重视程度
4. 好的指令应该像给新员工布置任务一样清晰

---

## 练习

### 练习 1：SALT 改造
将以下 3 条模糊指令改造为符合 SALT 框架的精确指令：
1. "帮我写个报告"
2. "解释一下机器学习"
3. "优化我的简历"

对每条指令，写出改造前后的 Prompt，并用 API 测试效果差异。

### 练习 2：指令顺序实验
针对"文本分类"任务，设计 3 种不同的指令顺序：
1. 任务 → 格式 → 约束
2. 约束 → 任务 → 格式
3. 格式 → 约束 → 任务

用相同的输入测试，记录哪种顺序的输出最符合预期。

### 练习 3：指令模板库
为以下场景设计可复用的指令模板：
- 代码审查模板
- 文章摘要模板
- 数据分析模板
- 翻译模板

每个模板应包含 SALT 四要素，并支持变量插值（用 `{变量名}` 标记可替换部分）。


---

## 参考答案

### 练习 1：SALT 改造

**思路**：将模糊指令按照 SALT 框架的四个维度（Specific、Action、Length、Tone）逐一补充，使指令从"说了一个方向"变成"定义了完整任务"。

**答案**：

```python
from openai import OpenAI

client = OpenAI()

# 改造前后的 Prompt 对比
transformations = [
    {
        "vague": "帮我写个报告",
        "precise": """你是一位资深数据分析师 (Specific)。
任务：撰写一份关于 2024 年 Q1 用户增长的分析报告 (Action)。
报告结构：概述 → 关键指标 → 趋势分析 → 行动建议，每个部分 100-150 字 (Length)。
语调：专业、数据驱动、客观 (Tone)。""",
        "input": "用户数据：新增用户 12 万，环比增长 15%，留存率 42%"
    },
    {
        "vague": "解释一下机器学习",
        "precise": """你是一位科普作家，擅长用生活类比解释技术概念 (Specific)。
任务：用非技术人员能理解的语言解释机器学习 (Action)。
结构：先用一句话概括，再用一个生活类比，最后举一个日常应用例子，共 150 字以内 (Length)。
语调：轻松、亲切、避免术语 (Tone)。""",
        "input": ""
    },
    {
        "vague": "优化我的简历",
        "precise": """你是一位有 10 年经验的招聘顾问 (Specific)。
任务：审查并优化以下简历，重点改进：1) 用量化数据替代模糊描述 2) 突出与目标岗位匹配的技能 3) 精简冗余内容 (Action)。
输出：修改后的简历文本，附带每处修改的原因说明，总长度不超过原文的 80% (Length)。
语调：专业、直接、建设性 (Tone)。""",
        "input": "简历：3年Python开发经验，做过一些数据分析项目，熟悉常用工具"
    }
]

for t in transformations:
    print(f"\n{'='*60}")
    print(f"模糊指令: {t['vague']}")
    print(f"SALT 改造:\n{t['precise']}")
    # 实际调用 API 对比效果
    user_msg = t["input"] or t["vague"].replace("帮我", "请帮我")
    for label, prompt in [("模糊版", t["vague"]), ("SALT版", t["precise"])]:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_msg}
            ],
            temperature=0.3,
            max_tokens=300
        )
        print(f"\n[{label} 输出]:")
        print(response.choices[0].message.content[:200])
```

**要点**：
- SALT 改造的核心是把"模糊意图"变成"可执行的任务定义"
- 每个维度缺失都会导致输出不确定性增加：缺 Specific 模型猜不透你要什么，缺 Action 不知道做什么，缺 Length 长度不可控，缺 Tone 风格不稳定
- 改造后的指令 Token 消耗会增加，但通常能减少来回修改的轮次，总成本反而更低

---

### 练习 2：指令顺序实验

**思路**：模型对紧接在输出之前的指令最敏感（位置效应）。通过对比三种顺序，验证格式要求放在最后是否效果最好。

**答案**：

```python
from openai import OpenAI

client = OpenAI()

test_input = "这家餐厅的菜品味道一般，服务态度也很差，但是价格很便宜。"

# 顺序 1: 任务 → 格式 → 约束
prompt_1 = """分析以下文本的情感倾向。
输出 JSON 格式，包含 sentiment 和 score 字段。
score 范围 -1 到 1，只输出 JSON 不要其他内容。"""

# 顺序 2: 约束 → 任务 → 格式
prompt_2 = """只输出 JSON，不要任何解释文字。
分析以下文本的情感倾向。
输出格式：{"sentiment": "positive/negative/neutral", "score": 数值}"""

# 顺序 3: 任务 → 约束 → 格式 (推荐)
prompt_3 = """分析以下文本的情感倾向。
score 范围 -1 到 1。
只输出 JSON，格式：{"sentiment": "positive/negative/neutral", "score": 数值}"""

for name, prompt in [("任务→格式→约束", prompt_1), ("约束→任务→格式", prompt_2), ("任务→约束→格式", prompt_3)]:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": test_input}
        ],
        temperature=0.0,
        max_tokens=100
    )
    output = response.choices[0].message.content
    print(f"\n{name}:")
    print(f"  输出: {output}")
    # 检查是否为纯 JSON
    is_json = output.strip().startswith("{")
    print(f"  是否纯 JSON: {'是' if is_json else '否'}")
```

**预期结论**：
- 顺序 3（任务→约束→格式）通常输出最符合预期，因为格式要求紧接在输出之前
- 顺序 2（约束→任务→格式）约束在开头可能被后续内容"稀释"
- 实际差异可能较小，但在批量调用中格式遵从率的微小提升会累积为显著收益

**要点**：
- 核心任务放在 Prompt 开头，格式要求放在最后
- 约束条件放在中间，用编号列表明确优先级
- 关键指令可以重复强调（开头提一次，结尾再提一次）

---

### 练习 3：指令模板库

**思路**：将常用场景的指令抽象为模板，用 `{变量}` 标记可替换部分，实现"一次设计、多次复用"。

**答案**：

```python
from string import Template

templates = {
    "code_review": Template("""你是一位资深 $language 开发工程师 (Specific)。
审查以下代码，从以下维度检查 (Action):
1. 安全性 - 是否存在注入、泄露等风险
2. 性能 - 是否有明显的性能问题
3. 可维护性 - 命名、结构、注释是否规范
4. 最佳实践 - 是否符合 $language 编码规范

对每个问题：指出行号、说明原因、提供修复代码。
输出长度：每个问题一个段落，总计不超过 $max_length 字 (Length)。
语调：专业、建设性 (Tone)。"""),

    "article_summary": Template("""你是一位专业的 $field 领域编辑 (Specific)。
任务：总结以下文章的核心内容 (Action)。
输出结构：
1. 一句话概括（30 字以内）
2. 3-5 个关键要点（每个要点 1-2 句话）
3. 对 $audience 的启示（1-2 句话）
总长度控制在 $max_length 字以内 (Length)。
语调：$tone (Tone)。"""),

    "data_analysis": Template("""你是一位 $industry 行业的数据分析师 (Specific)。
任务：分析以下数据，找出 $focus (Action)。
输出要求：
- 使用 Markdown 表格展示关键指标
- 每个发现附带数据支撑
- 最后给出 $num_suggestions 条可执行建议
总长度 $max_length 字以内 (Length)。
语调：客观、数据驱动 (Tone)。"""),

    "translation": Template("""你是一位专业的 $source_to_target 翻译 (Specific)。
任务：将以下 $source 语文本翻译为 $target 语 (Action)。
要求：
- 保持原文的 $style 风格
- 专业术语使用 $domain 领域的标准译法
- 输出仅包含译文，不加解释 (Length)。
语调：与原文一致 (Tone)。"""),
}

# 使用示例
print(templates["code_review"].substitute(
    language="Python",
    max_length=300
))

print("\n" + "="*60 + "\n")

print(templates["article_summary"].substitute(
    field="人工智能",
    audience="产品经理",
    max_length=200,
    tone="专业但通俗易懂"
))
```

**要点**：
- 模板的核心价值是"标准化 + 可复用"，避免每次从零写指令
- 变量应放在影响任务定义的关键位置（领域、受众、长度、风格）
- 模板库应随使用反馈持续迭代，记录每个模板在实际场景中的效果评分
- 不要过度模板化——简单任务直接写指令更高效

---

**下一课**: [角色型 Prompt](./03-角色型Prompt.md)
