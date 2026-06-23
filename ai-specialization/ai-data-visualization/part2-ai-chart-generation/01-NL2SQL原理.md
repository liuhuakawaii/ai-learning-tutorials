# 01 - NL2SQL 原理：从自然语言到 SQL 的技术栈与挑战

> 让非技术人员用一句话查数据库，背后需要跨越多少道鸿沟？

## 课程信息

| 项目 | 内容 |
|------|------|
| 所属阶段 | Part 2: AI 驱动的图表生成 |
| 前置课程 | Part 1 全部 |
| 预计时长 | 2 小时 |
| 难度等级 | ⭐⭐⭐ |

## 场景引入

假设你是一家电商公司的数据分析师。产品经理走过来说："帮我查一下上个月华东区退货率最高的 10 个品类。"

你打开数据库客户端，思考了一会儿，写下这样一段 SQL：

```sql
SELECT
    c.category_name,
    COUNT(CASE WHEN o.status = 'returned' THEN 1 END) * 1.0 / COUNT(*) AS return_rate
FROM orders o
JOIN products p ON o.product_id = p.product_id
JOIN categories c ON p.category_id = c.category_id
WHERE o.region = '华东'
  AND o.created_at >= '2025-05-01'
  AND o.created_at < '2025-06-01'
GROUP BY c.category_name
ORDER BY return_rate DESC
LIMIT 10;
```

这段 SQL 涉及多表 JOIN、条件过滤、聚合计算、排序和分页——对于一个熟练的分析师来说需要几分钟，对于不懂 SQL 的产品经理来说则完全不可能。

**NL2SQL（Natural Language to SQL）** 的目标就是让机器自动完成这个翻译过程。用户说一句话，系统返回正确的 SQL 并执行。

这听起来像是一个已经解决的问题——毕竟大语言模型这么强。但实际情况远比想象中复杂。本节课会带你理解 NL2SQL 的技术全貌，明白它为什么难，以及当前主流的解决方案。

## 学习目标

完成本节课后，你将能够：

1. 理解 NL2SQL 的定义、应用场景和商业价值
2. 掌握 NL2SQL 技术从规则系统到 LLM 时代的演进脉络
3. 识别 NL2SQL 的三大核心挑战：歧义消解、Schema 理解、复杂查询
4. 了解主流评测基准（Spider、BIRD）及其衡量维度
5. 掌握 Prompt Engineering 在 NL2SQL 中的最佳实践
6. 动手实现一个基于 OpenAI API 的基础 NL2SQL 系统

## 核心概念

### 1. NL2SQL 是什么

NL2SQL 是指将用户的自然语言查询转换为结构化 SQL 语句的技术。它的输入是一段自然语言和一个数据库 Schema，输出是一条可执行的 SQL。

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  自然语言查询     │────▶│  NL2SQL 系统  │────▶│  SQL 语句     │
│ "上月退货率最高"  │     │              │     │ SELECT ...   │
└─────────────────┘     └──────┬───────┘     └──────┬───────┘
                               │                     │
                     ┌─────────▼─────────┐   ┌──────▼───────┐
                     │  数据库 Schema     │   │  查询结果     │
                     │  表/列/关系/样本   │   │  (表格数据)   │
                     └───────────────────┘   └──────────────┘
```

NL2SQL 不是简单的文本替换。它要求系统理解：

- **语言意图**：用户到底想查什么？
- **数据库结构**：哪些表、哪些列、什么关系？
- **语义映射**："退货"对应数据库里的哪个字段？是 `status = 'returned'` 还是 `is_refunded = 1`？
- **逻辑推理**："最高"意味着 `ORDER BY ... DESC LIMIT 1`，"率"意味着需要除法运算。

### 2. 应用场景

NL2SQL 的商业价值在于**降低数据查询的门槛**。以下是几个典型场景：

| 场景 | 描述 | 价值 |
|------|------|------|
| 企业 BI 对话式分析 | 业务人员直接用自然语言提问，系统返回图表 | 减少对数据团队的依赖 |
| 智能客服 | 用户问"我的订单到哪了"，系统查数据库回答 | 提升自助服务率 |
| 数据治理 | 快速探索陌生数据库的内容 | 降低新员工上手成本 |
| 低代码平台 | 在表单/报表设计器中用自然语言配置数据源 | 提升开发效率 |

### 3. 技术演进：四代范式

NL2SQL 不是 LLM 时代才出现的新技术。它经历了四个阶段，每个阶段都代表了对"如何理解语言"这个问题的不同回答。

```
第一代：规则系统 (1970s-2010s)
├── 方法：模式匹配 + 语法规则
├── 代表：PRESTO, LUNAR, CHAT-80
├── 优点：可解释、确定性强
└── 缺点：覆盖范围窄，维护成本高

第二代：Seq2Seq (2017-2019)
├── 方法：编码器-解码器 + Attention
├── 代表：Seq2SQL, SQLNet, SyntaxSQLNet
├── 优点：端到端学习，泛化能力提升
└── 缺点：训练数据不足时表现差

第三代：预训练模型 (2020-2023)
├── 方法：BERT/T5 + 结构感知
├── 代表：RESDSQL, PICARD, SADGA
├── 优点：利用大规模预训练知识
└── 缺点：对复杂查询仍力不从心

第四代：LLM 范式 (2023-至今)
├── 方法：大模型 + Prompt / 微调
├── 代表：DAIL-SQL, DIN-SQL, SQLCoder, C3SQL
├── 优点：零样本/少样本能力强，理解深度大幅提升
└── 缺点：成本高、延迟大、幻觉问题
```

**范式转换的关键洞察**：前三个阶段本质上都在解决"如何从有限的标注数据中学习 SQL 的语法模式"。第四代范式转换了问题定义——LLM 已经在海量代码和文本中学会了 SQL 语法，真正需要解决的是**如何把用户的意图正确映射到特定数据库的 Schema 上**。

### 4. 核心挑战

#### 挑战一：歧义消解

自然语言天生是模糊的。同一个表达可以对应完全不同的 SQL。

用户说："查一下销量"——这个查询至少有三种理解：

```sql
-- 理解 1：查每个产品的销量
SELECT product_name, SUM(quantity) FROM order_items GROUP BY product_name;

-- 理解 2：查总销量
SELECT SUM(quantity) FROM order_items;

-- 理解 3：查最近的销量趋势
SELECT DATE(created_at), SUM(quantity) FROM order_items GROUP BY DATE(created_at);
```

歧义来源包括：

- **聚合粒度不明确**：用户没说是"总销量"还是"每个产品的销量"
- **时间范围不明确**：没说是"本月"还是"历史全部"
- **指代不明确**：用户说"销售额"，数据库里有 `gross_amount`、`net_amount`、`after_discount` 三个字段
- **隐含条件**：华东区的"华东"可能是 `region_name = '华东'`，也可能是 `province IN ('上海','江苏','浙江',...)`

#### 挑战二：Schema 理解

数据库 Schema 是 NL2SQL 的"地图"。如果系统不理解 Schema，生成的 SQL 一定是错的。

Schema 理解的难点包括：

```
┌─────────────────────────────────────────────────┐
│              Schema 理解的层次                     │
├─────────────────────────────────────────────────┤
│ Level 1: 结构识别                                 │
│   → 有哪些表？哪些列？什么数据类型？                │
│   → 这是基础，但远远不够                           │
├─────────────────────────────────────────────────┤
│ Level 2: 关系理解                                 │
│   → 表之间如何 JOIN？外键是什么？                   │
│   → 多对多关系如何处理？                           │
├─────────────────────────────────────────────────┤
│ Level 3: 语义理解                                 │
│   → 列名的业务含义是什么？                         │
│   → status 列有哪些值？分别代表什么状态？           │
│   → created_at 和 updated_at 哪个代表下单时间？    │
├─────────────────────────────────────────────────┤
│ Level 4: 上下文理解                               │
│   → 哪些列是常用的过滤条件？                       │
│   → 数据分布如何？是否有 NULL？                    │
│   → 业务术语和数据库字段的映射关系                  │
└─────────────────────────────────────────────────┘
```

真实数据库的命名往往不友好：`col_1`、`ext_field_a`、`usr_nm`——这些在 Schema 文档里有含义，但对 NL2SQL 系统来说是天书。

#### 挑战三：复杂查询

简单查询（单表 SELECT + WHERE）的 NL2SQL 准确率已经很高。但真实业务中的查询往往很复杂：

```sql
-- 复杂查询示例：同比分析
WITH current_year AS (
    SELECT category, SUM(amount) AS revenue
    FROM orders
    WHERE YEAR(order_date) = 2025
    GROUP BY category
),
last_year AS (
    SELECT category, SUM(amount) AS revenue
    FROM orders
    WHERE YEAR(order_date) = 2024
    GROUP BY category
)
SELECT
    c.category,
    c.revenue AS revenue_2025,
    l.revenue AS revenue_2024,
    ROUND((c.revenue - l.revenue) / l.revenue * 100, 2) AS yoy_growth
FROM current_year c
JOIN last_year l ON c.category = l.category
ORDER BY yoy_growth DESC;
```

这个查询涉及 CTE（公共表表达式）、多子查询、JOIN、数学运算和排序。要从"对比一下今年和去年的品类销售额增长"这句话生成这条 SQL，需要系统具备多步推理能力。

### 5. 主流评测基准

要衡量 NL2SQL 系统的好坏，需要标准化的评测基准。

#### Spider 基准

Spider 是目前最广泛使用的跨数据库 NL2SQL 评测集：

| 维度 | 说明 |
|------|------|
| 数据量 | 10,181 个问题，200 个数据库 |
| 特点 | 跨数据库泛化（训练集和测试集的数据库不重叠） |
| 难度分级 | Easy / Medium / Hard / Extra Hard |
| 评估方式 | 执行准确率 (EX) 和逻辑准确率 (EM) |

#### BIRD 基准

BIRD（BIg Bench for LaRge-scale Database Grounded Text-to-SQL Evaluation）是 2023 年提出的新基准，更贴近真实场景：

| 维度 | 说明 |
|------|------|
| 数据量 | 12,751 个问题，95 个数据库 |
| 特点 | 数据库规模更大（平均 33 张表），包含脏数据和外部知识 |
| 创新点 | 引入外部知识（如"华东区包含哪些省份"） |
| 评估方式 | 执行准确率 (EX)，基于 SQLite 执行结果对比 |

BIRD 比 Spider 更难的原因在于：真实数据库有脏数据、列名不规范、需要业务知识才能正确查询。

### 6. Prompt Engineering for NL2SQL

在 LLM 时代，NL2SQL 的核心变成了 Prompt 设计。一个好的 NL2SQL Prompt 需要包含哪些要素？

```
┌──────────────────────────────────────────────────────┐
│                 NL2SQL Prompt 结构                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. 任务说明 (System Prompt)                          │
│     "你是一个 SQL 专家，根据用户的自然语言生成 SQL"     │
│                                                      │
│  2. Schema 信息                                      │
│     CREATE TABLE 语句 / 表描述 / 列描述               │
│     → 包含主键、外键、数据类型                         │
│     → 可选：列的枚举值、数据分布                       │
│                                                      │
│  3. Few-shot 示例 (可选但强烈推荐)                    │
│     问题: "..." → SQL: "..."                          │
│     → 3-5 个与目标查询类似的示例                       │
│                                                      │
│  4. 业务规则 / 外部知识                               │
│     "华东区包括：上海、江苏、浙江、安徽、山东"          │
│     "'已发货'状态的 order_status 值为 'shipped'"       │
│                                                      │
│  5. 用户问题                                         │
│     "上个月华东区退货率最高的 10 个品类"               │
│                                                      │
│  6. 输出格式约束                                      │
│     "只输出 SQL，不要解释"                             │
│     "使用 ```sql 代码块包裹"                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**关键技巧：Schema 精简**

不要把整个数据库的 Schema 都塞进 Prompt。一个真实业务数据库可能有上百张表，但一个查询通常只涉及 2-5 张表。把不相关的表放进去会浪费 token、增加干扰。

实践中的做法是先做一个**表选择**步骤：根据用户问题的语义，筛选出最可能相关的表，只把这些表的 Schema 放进 Prompt。

## 代码示例

下面实现一个完整的 NL2SQL 系统。这个系统接受用户的自然语言问题，结合数据库 Schema 信息，调用 OpenAI API 生成 SQL 并执行。

### 环境准备

```bash
pip install openai sqlite3 tabulate
```

### 核心实现

```python
"""
nl2sql_demo.py - 基于 OpenAI API 的 NL2SQL 系统

功能：
1. 读取 SQLite 数据库的 Schema 信息
2. 根据用户自然语言问题生成 SQL
3. 执行 SQL 并格式化输出结果

使用方式：
    python nl2sql_demo.py
"""

import os
import sqlite3
import json
from openai import OpenAI

# ============================================================
# 第一部分：数据库 Schema 提取
# ============================================================

def extract_schema(db_path: str) -> str:
    """
    从 SQLite 数据库中提取 Schema 信息，生成 CREATE TABLE 语句。
    
    为什么不用 SHOW CREATE TABLE？
    因为 SQLite 没有这个命令，需要从 sqlite_master 中读取建表语句，
    再补充索引和外键信息。
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取所有用户表
    cursor.execute("""
        SELECT name, sql 
        FROM sqlite_master 
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    """)
    tables = cursor.fetchall()
    
    schema_parts = []
    for table_name, create_sql in tables:
        if create_sql:
            schema_parts.append(create_sql + ";")
            
            # 补充采样数据，帮助模型理解列的含义
            cursor.execute(f"SELECT * FROM [{table_name}] LIMIT 3")
            rows = cursor.fetchall()
            if rows:
                col_names = [desc[0] for desc in cursor.description]
                sample_lines = [f"-- {table_name} 样本数据:"]
                sample_lines.append(f"-- 列: {', '.join(col_names)}")
                for row in rows:
                    sample_lines.append(f"-- {row}")
                schema_parts.append("\n".join(sample_lines))
    
    conn.close()
    return "\n\n".join(schema_parts)


# ============================================================
# 第二部分：Prompt 构建
# ============================================================

def build_nl2sql_prompt(
    user_question: str,
    schema_info: str,
    business_rules: list[str] | None = None,
    few_shot_examples: list[dict] | None = None
) -> list[dict]:
    """
    构建 NL2SQL 的 Prompt 消息列表。
    
    设计思路：
    - System Prompt 定义角色和输出格式
    - Schema 信息提供数据库结构上下文
    - 业务规则处理隐含知识（如区域划分、状态枚举）
    - Few-shot 示例帮助模型理解查询模式
    """
    system_prompt = """你是一个资深的 SQL 专家。你的任务是根据用户的自然语言问题和数据库结构，生成正确的 SQL 查询。

规则：
1. 只输出 SQL 语句，不要输出任何解释
2. 使用标准 SQL 语法（兼容 SQLite）
3. 如果问题不明确，选择最合理的解释并生成 SQL
4. 注意处理 NULL 值和边界情况
5. 使用 JOIN 时明确指定 JOIN 条件
6. 日期函数使用 SQLite 的 strftime 格式"""

    messages = [{"role": "system", "content": system_prompt}]
    
    # 添加 Schema 信息
    messages.append({
        "role": "user",
        "content": f"以下是数据库结构：\n\n```sql\n{schema_info}\n```"
    })
    messages.append({
        "role": "assistant",
        "content": "我已了解数据库结构。请告诉我你想查询什么。"
    })
    
    # 添加业务规则
    if business_rules:
        rules_text = "\n".join(f"- {rule}" for rule in business_rules)
        messages.append({
            "role": "user",
            "content": f"以下是业务规则，请在生成 SQL 时参考：\n{rules_text}"
        })
        messages.append({
            "role": "assistant",
            "content": "好的，我会在生成 SQL 时考虑这些业务规则。"
        })
    
    # 添加 Few-shot 示例
    if few_shot_examples:
        for example in few_shot_examples:
            messages.append({
                "role": "user",
                "content": example["question"]
            })
            messages.append({
                "role": "assistant",
                "content": f"```sql\n{example['sql']}\n```"
            })
    
    # 添加用户问题
    messages.append({
        "role": "user",
        "content": user_question
    })
    
    return messages


# ============================================================
# 第三部分：SQL 生成与执行
# ============================================================

def generate_sql(
    client: OpenAI,
    messages: list[dict],
    model: str = "gpt-4o"
) -> str:
    """
    调用 OpenAI API 生成 SQL。
    
    参数说明：
    - temperature 设为 0：SQL 生成需要确定性，不需要创意
    - max_tokens 设为 1024：大多数 SQL 查询不会超过这个长度
    """
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0,
        max_tokens=1024
    )
    
    raw_output = response.choices[0].message.content
    
    # 提取 SQL：优先从 ```sql 代码块中提取
    if "```sql" in raw_output:
        sql = raw_output.split("```sql")[1].split("```")[0].strip()
    elif "```" in raw_output:
        sql = raw_output.split("```")[1].split("```")[0].strip()
    else:
        sql = raw_output.strip()
    
    return sql


def execute_sql(db_path: str, sql: str) -> tuple[list[str], list[tuple]]:
    """
    执行 SQL 查询并返回结果。
    
    安全说明：
    - 这是一个演示系统，生产环境必须做 SQL 注入防护
    - 建议使用只读连接，避免误操作
    - 对查询结果设置行数限制，防止内存溢出
    """
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA query_only = ON")  # 只读模式
    cursor = conn.cursor()
    
    # 添加 LIMIT 保护（如果用户没指定的话）
    if "LIMIT" not in sql.upper() and sql.strip().upper().startswith("SELECT"):
        sql = sql.rstrip(";") + " LIMIT 100;"
    
    cursor.execute(sql)
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    
    conn.close()
    return columns, rows


# ============================================================
# 第四部分：组装完整流程
# ============================================================

class NL2SQLSystem:
    """
    NL2SQL 系统的完整封装。
    
    使用方式：
        system = NL2SQLSystem(
            db_path="ecommerce.db",
            openai_api_key="sk-..."
        )
        result = system.query("上个月销量最高的产品是什么？")
    """
    
    def __init__(
        self,
        db_path: str,
        openai_api_key: str | None = None,
        model: str = "gpt-4o"
    ):
        self.db_path = db_path
        self.model = model
        self.client = OpenAI(
            api_key=openai_api_key or os.getenv("OPENAI_API_KEY")
        )
        
        # 启动时提取 Schema，避免重复读取
        self.schema_info = extract_schema(db_path)
        
        # 默认的业务规则（可根据具体项目定制）
        self.business_rules = []
        
        # 默认的 Few-shot 示例
        self.few_shot_examples = []
    
    def add_business_rule(self, rule: str):
        """添加业务规则，帮助模型理解隐含知识。"""
        self.business_rules.append(rule)
    
    def add_few_shot_example(self, question: str, sql: str):
        """添加 Few-shot 示例，提升生成准确率。"""
        self.few_shot_examples.append({
            "question": question,
            "sql": sql
        })
    
    def query(self, user_question: str) -> dict:
        """
        完整的 NL2SQL 流程：问题 → Prompt → SQL → 执行 → 结果
        """
        # 步骤 1：构建 Prompt
        messages = build_nl2sql_prompt(
            user_question=user_question,
            schema_info=self.schema_info,
            business_rules=self.business_rules,
            few_shot_examples=self.few_shot_examples
        )
        
        # 步骤 2：生成 SQL
        sql = generate_sql(
            client=self.client,
            messages=messages,
            model=self.model
        )
        
        # 步骤 3：执行 SQL
        try:
            columns, rows = execute_sql(self.db_path, sql)
            return {
                "question": user_question,
                "sql": sql,
                "columns": columns,
                "rows": rows,
                "error": None
            }
        except Exception as e:
            return {
                "question": user_question,
                "sql": sql,
                "columns": [],
                "rows": [],
                "error": str(e)
            }
    
    def pretty_print(self, result: dict):
        """格式化输出查询结果。"""
        print(f"\n{'='*60}")
        print(f"问题: {result['question']}")
        print(f"{'='*60}")
        print(f"生成的 SQL:\n{result['sql']}")
        print(f"{'-'*60}")
        
        if result["error"]:
            print(f"执行错误: {result['error']}")
        elif result["rows"]:
            # 使用 tabulate 格式化表格
            try:
                from tabulate import tabulate
                print(tabulate(
                    result["rows"],
                    headers=result["columns"],
                    tablefmt="grid"
                ))
            except ImportError:
                # 降级处理：简单打印
                print(" | ".join(result["columns"]))
                print("-" * 40)
                for row in result["rows"]:
                    print(" | ".join(str(v) for v in row))
            print(f"共 {len(result['rows'])} 条记录")
        else:
            print("查询结果为空")


# ============================================================
# 第五部分：演示运行
# ============================================================

def create_demo_database(db_path: str):
    """创建一个演示用的电商数据库。"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 创建表结构
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS categories (
            category_id INTEGER PRIMARY KEY,
            category_name TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS products (
            product_id INTEGER PRIMARY KEY,
            product_name TEXT NOT NULL,
            category_id INTEGER,
            price REAL,
            FOREIGN KEY (category_id) REFERENCES categories(category_id)
        );
        
        CREATE TABLE IF NOT EXISTS orders (
            order_id INTEGER PRIMARY KEY,
            product_id INTEGER,
            quantity INTEGER,
            amount REAL,
            region TEXT,
            status TEXT,
            order_date TEXT,
            FOREIGN KEY (product_id) REFERENCES products(product_id)
        );
        
        -- 插入演示数据
        INSERT OR IGNORE INTO categories VALUES
            (1, '电子产品'), (2, '服装'), (3, '食品'),
            (4, '家居'), (5, '图书');
        
        INSERT OR IGNORE INTO products VALUES
            (101, 'iPhone 16', 1, 6999),
            (102, 'MacBook Pro', 1, 14999),
            (103, 'AirPods Pro', 1, 1899),
            (201, '羽绒服', 2, 599),
            (202, '运动鞋', 2, 399),
            (301, '有机牛奶', 3, 89),
            (302, '进口巧克力', 3, 128),
            (401, '智能台灯', 4, 249),
            (402, '乳胶枕', 4, 199),
            (501, '深入理解计算机系统', 5, 139);
        
        INSERT OR IGNORE INTO orders VALUES
            (1, 101, 2, 13998, '华东', 'completed', '2025-05-15'),
            (2, 102, 1, 14999, '华南', 'completed', '2025-05-20'),
            (3, 201, 3, 1797, '华东', 'returned', '2025-05-18'),
            (4, 301, 10, 890, '华北', 'completed', '2025-06-01'),
            (5, 103, 5, 9495, '华东', 'completed', '2025-06-05'),
            (6, 202, 2, 798, '华南', 'shipped', '2025-06-10'),
            (7, 401, 1, 249, '华北', 'completed', '2025-06-12'),
            (8, 501, 4, 556, '华东', 'completed', '2025-06-15'),
            (9, 302, 6, 768, '华南', 'returned', '2025-06-18'),
            (10, 102, 1, 14999, '华东', 'completed', '2025-06-20');
    """)
    
    conn.commit()
    conn.close()


def main():
    """主函数：演示 NL2SQL 系统的完整使用流程。"""
    db_path = "demo_ecommerce.db"
    
    # 创建演示数据库
    create_demo_database(db_path)
    print("演示数据库已创建。")
    
    # 初始化 NL2SQL 系统
    system = NL2SQLSystem(
        db_path=db_path,
        model="gpt-4o"
    )
    
    # 添加业务规则
    system.add_business_rule(
        "华东区包括：上海、江苏、浙江、安徽、山东、福建、江西"
    )
    system.add_business_rule(
        "订单状态枚举：pending(待付款), paid(已付款), shipped(已发货), "
        "completed(已完成), returned(已退货), cancelled(已取消)"
    )
    
    # 添加 Few-shot 示例
    system.add_few_shot_example(
        question="每个品类有多少个产品？",
        sql="""SELECT c.category_name, COUNT(p.product_id) AS product_count
FROM categories c
LEFT JOIN products p ON c.category_id = p.category_id
GROUP BY c.category_name;"""
    )
    
    # 测试多个自然语言问题
    test_questions = [
        "华东区的订单总金额是多少？",
        "哪个产品的销量最高？",
        "退货的订单有哪些？",
        "本月每个品类的销售额排名",
    ]
    
    for question in test_questions:
        result = system.query(question)
        system.pretty_print(result)


if __name__ == "__main__":
    main()
```

### 代码设计要点

上面的代码有几个值得思考的设计决策：

**为什么把 Schema 提取独立成函数？** 因为 Schema 信息在运行期间不会变化，提取一次后可以缓存复用。同时，独立的函数方便测试和替换——如果你要用 MySQL 或 PostgreSQL，只需要重写这一个函数。

**为什么 temperature 设为 0？** SQL 生成是确定性任务。同一个问题和 Schema 应该总是生成相同的 SQL。temperature > 0 会引入随机性，导致每次生成不同的 SQL，这在生产环境是不可接受的。

**为什么添加 LIMIT 保护？** 这是防止用户问"查一下所有订单"时返回百万行数据，导致内存溢出。在生产环境中，还应该设置查询超时和结果行数上限。

## 常见误区

### 误区一：把整个数据库 Schema 塞进 Prompt

很多人觉得 Schema 信息越全越好。实际上，一个真实业务数据库可能有 200+ 张表，全部放进 Prompt 会消耗大量 token，还会干扰模型的判断。

**正确做法**：先做表选择（Table Selection），只保留与问题相关的 3-5 张表的 Schema。

### 误区二：忽略业务规则

数据库字段名是技术命名，用户说的是业务语言。比如用户说"VIP 客户"，数据库里是 `customer_level = 'premium'`；用户说"华东区"，数据库里可能是 `region_code = 'HD'`。

**正确做法**：维护一份业务术语到数据库字段的映射表，作为 Prompt 的一部分。

### 误区三：只关注逻辑准确率，忽略执行准确率

逻辑准确率（EM）要求生成的 SQL 和标准答案完全一致（通常用抽象语法树比较）。但现实中，同一个查询可以有多种等价的 SQL 写法。执行准确率（EX）只看最终结果是否一致，更贴近实际需求。

**正确做法**：以 EX 为主要优化目标，EM 作为参考。

### 误区四：认为 NL2SQL 能完全替代 SQL

NL2SQL 适合查询类操作（SELECT）。对于数据修改（INSERT/UPDATE/DELETE）、DDL 操作（CREATE/ALTER）、复杂的数据管道，NL2SQL 的可靠性和安全性都达不到生产要求。

**正确做法**：NL2SQL 定位为查询辅助工具，而不是 SQL 的替代品。

## 小结与练习

### 小结

本节课我们学习了：

1. **NL2SQL 的本质**：不只是文本到 SQL 的翻译，而是需要理解语言意图、数据库结构和业务知识的复杂推理过程
2. **技术演进**：从规则系统到 LLM，NL2SQL 的核心瓶颈从"语法学习"转向了"语义理解"
3. **三大挑战**：歧义消解、Schema 理解、复杂查询——这三个问题至今没有完全解决
4. **评测基准**：Spider 侧重跨数据库泛化，BIRD 侧重真实场景复杂度
5. **Prompt 设计**：好的 NL2SQL Prompt 需要 Schema 信息、业务规则和 Few-shot 示例的配合

### 练习

#### 练习一：扩展业务规则

当前系统只添加了"华东区"和"订单状态"两条业务规则。请为以下场景添加业务规则：

1. "利润率"指的是 `(售价 - 成本) / 售价 * 100`，数据库里没有直接的利润率字段
2. "大客户"指的是累计消费超过 10 万元的客户
3. "滞销品"指的是最近 90 天没有订单的产品

#### 练习二：实现 Schema 精简

当前系统把整个数据库的 Schema 都放进了 Prompt。请实现一个 `select_relevant_tables` 函数，根据用户问题的关键词，只选择相关的表。例如：

- 用户问"退货率"→ 只选 `orders` 表（包含 status 列）
- 用户问"品类销售额"→ 选 `orders`、`products`、`categories` 三张表

提示：可以用简单的关键词匹配，也可以用 Embedding 相似度。

#### 练习三：错误处理与重试

当前系统在 SQL 执行失败时只返回错误信息。请实现一个重试机制：

1. 如果 SQL 执行报错，把错误信息反馈给模型
2. 让模型修正 SQL 并重试
3. 最多重试 3 次

---

## 参考答案

### 练习一

**思路**：业务规则的本质是告诉模型"用户说的 X 在数据库里对应 Y"。规则的格式应该是声明式的，便于模型理解。

**答案**：

```python
system.add_business_rule(
    "利润率的计算方式：(products.price - products.cost) / products.price * 100。"
    "数据库中 products 表有 price 和 cost 字段。"
)
system.add_business_rule(
    "大客户定义：累计消费金额超过 100000 的客户。"
    "可以通过 SELECT customer_id FROM orders GROUP BY customer_id "
    "HAVING SUM(amount) > 100000 来识别。"
)
system.add_business_rule(
    "滞销品定义：最近 90 天内没有订单记录的产品。"
    "可以通过 products.product_id NOT IN "
    "(SELECT product_id FROM orders WHERE order_date >= date('now', '-90 days')) 来判断。"
)
```

**要点**：
- 业务规则要具体到数据库字段名和计算公式
- 给出参考 SQL 片段可以帮助模型更好地理解
- 规则之间不能有歧义或矛盾

### 练习二

**思路**：最简单的方法是关键词匹配——从用户问题中提取关键词，然后匹配表名和列名。更高级的方法是用 Embedding 计算语义相似度。

**答案**：

```python
import re

def select_relevant_tables(
    user_question: str,
    schema_info: str,
    max_tables: int = 5
) -> str:
    """
    根据用户问题选择相关的数据库表。
    
    策略：
    1. 从 Schema 中提取所有表名和列名
    2. 计算每个表与用户问题的相关性得分
    3. 返回得分最高的几张表的 Schema
    """
    # 提取表名
    table_pattern = r'CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)'
    tables = re.findall(table_pattern, schema_info, re.IGNORECASE)
    
    # 为每个表计算相关性得分
    question_lower = user_question.lower()
    table_scores = {}
    
    for table_name in tables:
        score = 0
        
        # 表名匹配（直接包含）
        if table_name.lower() in question_lower:
            score += 10
        
        # 表名的语义拆分匹配（如 order_items → order, item）
        name_parts = re.findall(r'[a-z]+', table_name.lower())
        for part in name_parts:
            if part in question_lower:
                score += 3
        
        # 列名匹配（从 CREATE TABLE 语句中提取列名）
        create_pattern = rf'CREATE TABLE.*?{table_name}.*?\((.*?)\);'
        match = re.search(create_pattern, schema_info, re.IGNORECASE | re.DOTALL)
        if match:
            col_defs = match.group(1)
            col_names = re.findall(r'(\w+)\s+(?:INTEGER|TEXT|REAL|VARCHAR|INT|DATE)',
                                   col_defs, re.IGNORECASE)
            for col in col_names:
                if col.lower() in question_lower:
                    score += 2
        
        table_scores[table_name] = score
    
    # 选择得分最高的表
    sorted_tables = sorted(
        table_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )
    relevant_tables = [t[0] for t in sorted_tables[:max_tables] if t[1] > 0]
    
    # 如果没有匹配到任何表，返回所有表（兜底策略）
    if not relevant_tables:
        return schema_info
    
    # 提取相关表的 Schema
    parts = []
    for table_name in relevant_tables:
        pattern = rf'(CREATE TABLE.*?{table_name}.*?;.*?)(?=CREATE TABLE|\Z)'
        match = re.search(pattern, schema_info, re.IGNORECASE | re.DOTALL)
        if match:
            parts.append(match.group(1).strip())
    
    return "\n\n".join(parts)
```

**要点**：
- 兜底策略很重要——如果关键词匹配全部失败，返回全部 Schema 比返回空好
- 表名的语义拆分能处理 `order_items` 这样的复合命名
- 生产环境中建议用 Embedding 替代关键词匹配，效果更好

### 练习三

**思路**：把错误信息反馈给模型，让它"看到"自己的错误并修正。这是 LLM 自我纠错的基本模式。

**答案**：

```python
def query_with_retry(
    self,
    user_question: str,
    max_retries: int = 3
) -> dict:
    """带重试机制的 NL2SQL 查询。"""
    messages = build_nl2sql_prompt(
        user_question=user_question,
        schema_info=self.schema_info,
        business_rules=self.business_rules,
        few_shot_examples=self.few_shot_examples
    )
    
    for attempt in range(max_retries):
        # 生成 SQL
        sql = generate_sql(
            client=self.client,
            messages=messages,
            model=self.model
        )
        
        # 尝试执行
        try:
            columns, rows = execute_sql(self.db_path, sql)
            return {
                "question": user_question,
                "sql": sql,
                "columns": columns,
                "rows": rows,
                "error": None,
                "attempts": attempt + 1
            }
        except Exception as e:
            error_msg = str(e)
            
            if attempt < max_retries - 1:
                # 把错误信息反馈给模型，请求修正
                messages.append({"role": "assistant", "content": f"```sql\n{sql}\n```"})
                messages.append({
                    "role": "user",
                    "content": f"SQL 执行报错：{error_msg}\n请修正 SQL 并重新生成。"
                })
            else:
                return {
                    "question": user_question,
                    "sql": sql,
                    "columns": [],
                    "rows": [],
                    "error": f"重试 {max_retries} 次后仍然失败: {error_msg}",
                    "attempts": max_retries
                }

# 绑定到类上
NL2SQLSystem.query_with_retry = query_with_retry
```

**要点**：
- 把原始错误信息原样反馈给模型，不要做人为的错误分类
- 每次重试都要保留完整的对话历史，让模型能看到之前的错误
- 设置最大重试次数，避免无限循环
- 生产环境中，重试 3 次仍然失败应该触发告警，而不是静默失败
