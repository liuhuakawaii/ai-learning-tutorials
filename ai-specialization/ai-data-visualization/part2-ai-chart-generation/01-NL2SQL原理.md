# 01 - NL2SQL 原理

> 让非技术人员用一句话查数据库，背后需要跨越多少道鸿沟？

## 这节课解决什么问题

假设你是一家电商公司的数据分析师。产品经理走过来说："帮我查一下上个月华东区退货率最高的 10 个品类。" 你打开数据库客户端，写下一段涉及多表 JOIN、条件过滤、聚合计算的 SQL。对于熟练的分析师来说需要几分钟，对于不懂 SQL 的产品经理来说则完全不可能。

NL2SQL（Natural Language to SQL）的目标就是让机器自动完成这个翻译过程。用户说一句话，系统返回正确的 SQL 并执行。

这听起来像是一个已经解决的问题——毕竟大语言模型这么强。但实际情况远比想象中复杂。

## NL2SQL 为什么难

NL2SQL 的核心挑战不是"语法转换"，而是三个深层问题：

**歧义消解。** "上个月销售最好的产品"——"最好"是指销量最高还是销售额最高？"上个月"是指自然月还是最近 30 天？这些歧义对人类来说靠上下文就能消解，对机器来说需要额外的规则或对话澄清。

**Schema 理解。** 数据库里有一张表叫 `ods_ord_dt_20240501`，字段名是 `sku_id`、`cat_cd`、`rgn_nm`。模型怎么知道 `cat_cd` 是品类代码、`rgn_nm` 是区域名称？Schema Linking（把自然语言映射到数据库元素）是 NL2SQL 的关键步骤。

**复杂查询。** 单表简单查询容易处理。但真实业务问题往往涉及多表 JOIN、子查询、窗口函数、CASE WHEN 条件逻辑。当前最好的模型在 Spider 基准上的执行准确率也只有 85% 左右，复杂查询的准确率更低。

## 从规则到 LLM 的技术演进

NL2SQL 经历了三个阶段：

```
规则模板时代（2017 以前）
  "查 ... 的 ..." → 正则匹配 → 填充模板 SQL
  优点：可控、确定性强
  缺点：覆盖范围窄，换一种说法就不认识

Seq2Seq 时代（2017-2021）
  自然语言 → 编码器 → 解码器 → SQL token 序列
  代表：SQLNet, TypeSQL, IRNet
  优点：能处理一定范围的表达变体
  缺点：泛化能力弱，对复杂 SQL 支持差

LLM 时代（2022- 现在）
  自然语言 + Schema → Prompt → LLM → SQL
  代表：DAIL-SQL, DIN-SQL, C3SQL
  优点：泛化能力强，零样本/少样本即可工作
  缺点：依赖上下文长度，成本高，幻觉问题
```

当前主流方案是**Prompt Engineering + LLM**，辅以 Schema Linking 和 Self-Correction。

## Prompt Engineering 的关键技巧

给 LLM 写 NL2SQL 的 Prompt 不是随便塞个问题就行。几个关键设计：

**1. Schema 描述要精简但完整。** 不要把整个数据库的 DDL 都塞进去，只包含可能相关的表和字段。给字段加上自然语言注释。

```sql
-- 表: orders (订单表)
--   order_id: 订单ID
--   product_id: 商品ID
--   region: 区域 (华东/华南/华北/西南)
--   status: 状态 (paid/shipped/returned/cancelled)
--   created_at: 创建时间
--   amount: 订单金额
```

**2. 提供 Few-Shot 示例。** 给模型看 2-3 个"问题→SQL"的示例，比空着 Prompt 效果好得多。

**3. 让模型先分析再写 SQL。** 用 Chain-of-Thought 让模型先拆解问题："用户问的是退货率，需要计算 returned 数量 / 总数量，按品类分组，取 Top 10"，然后再生成 SQL。

**4. Self-Correction。** 让模型自己检查生成的 SQL：表名是否正确？字段是否存在？JOIN 条件是否完整？WHERE 子句是否覆盖了所有约束？

## 用 OpenAI API 实现基础 NL2SQL

下面是一个最小可用的 NL2SQL 实现：

```python
import openai

SCHEMA_DESC = """
数据库: ecommerce
表: orders (订单表)
  - order_id INT: 订单ID
  - product_id INT: 商品ID
  - region VARCHAR(20): 区域 (华东/华南/华北/西南)
  - status VARCHAR(20): 状态 (paid/shipped/returned/cancelled)
  - created_at DATETIME: 创建时间
  - amount DECIMAL(10,2): 订单金额

表: products (商品表)
  - product_id INT: 商品ID
  - product_name VARCHAR(100): 商品名称
  - category_id INT: 品类ID

表: categories (品类表)
  - category_id INT: 品类ID
  - category_name VARCHAR(50): 品类名称
"""

FEW_SHOT_EXAMPLES = """
问题: 上个月销售额最高的5个品类
SQL: SELECT c.category_name, SUM(o.amount) AS total
     FROM orders o JOIN products p ON o.product_id = p.product_id
     JOIN categories c ON p.category_id = c.category_id
     WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
       AND o.created_at < DATE_TRUNC('month', CURRENT_DATE)
     GROUP BY c.category_name
     ORDER BY total DESC LIMIT 5;

问题: 华东区有多少订单还没发货
SQL: SELECT COUNT(*) FROM orders
     WHERE region = '华东' AND status = 'paid';
"""

def nl2sql(question: str) -> str:
    prompt = f"""你是一个 SQL 专家。根据以下数据库 Schema 和示例，将用户的自然语言问题转换为 SQL。

{SCHEMA_DESC}

示例：
{FEW_SHOT_EXAMPLES}

问题: {question}
SQL:"""

    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    return response.choices[0].message.content.strip()
```

这个实现能处理简单查询，但距离生产级系统还有几个差距：

- 没有 Schema Linking（可能生成不存在的表名/字段名）
- 没有 SQL 校验（可能生成语法错误的 SQL）
- 没有执行结果校验（可能 SQL 能执行但结果不对）
- 没有安全防护（可能生成 DROP TABLE 之类的危险语句）

这些是后续课程要解决的问题。

## NL2SQL 的评估基准

怎么衡量一个 NL2SQL 系统好不好？两个主流基准：

**Spider**：跨域 NL2SQL 基准，包含 200 个数据库、10,000+ 个问题。测试模型在未见过的数据库上的泛化能力。评估指标是执行准确率（Execution Accuracy）——生成的 SQL 执行结果是否正确。

**BIRD**：比 Spider 更接近真实场景，包含脏数据、大表名、需要外部知识的查询。比如"查询VIP客户的订单"——模型需要知道 VIP 客户的定义在另一个配置表里。

当前 SOTA 在 Spider 上约 87% 执行准确率，在 BIRD 上约 73%。这意味着每 4 个真实查询就有 1 个可能出错——NL2SQL 还远没有"解决"。

## 练习

### 练习一：实现基础 NL2SQL Pipeline

用 OpenAI API 实现一个 NL2SQL 函数，要求：

1. 接收自然语言问题和数据库 Schema 描述
2. 包含 2 个 Few-Shot 示例
3. 返回生成的 SQL
4. 添加基本的安全检查：只允许 SELECT 语句，拒绝 DROP/DELETE/UPDATE/INSERT

```python
def nl2sql_safe(question: str, schema: str, examples: str) -> str:
    """安全的 NL2SQL：生成 SQL 并做基本安全检查"""
    # 你的实现
    pass
```

### 练习二：SQL 执行校验

在练习一的基础上，添加一个 `validate_sql` 函数：

```python
def validate_sql(sql: str, db_connection) -> dict:
    """校验 SQL 的语法和执行结果"""
    # 检查 1: SQL 语法是否正确（用 EXPLAIN）
    # 检查 2: 返回结果是否为空
    # 检查 3: 返回结果行数是否合理（比如不超过 10000 行）
    # 返回 { valid: bool, error: str | None, row_count: int }
    pass
```

---

## 参考答案

### 练习一

```python
import openai
import re

FORBIDDEN_KEYWORDS = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'CREATE']

def nl2sql_safe(question: str, schema: str, examples: str) -> str:
    prompt = f"""你是 SQL 专家。根据 Schema 和示例，将自然语言问题转换为 SQL。只输出 SQL，不要解释。

{schema}

示例：
{examples}

问题: {question}
SQL:"""

    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    sql = response.choices[0].message.content.strip()

    # 去掉可能的 markdown 代码块标记
    sql = re.sub(r'^```sql?\s*', '', sql, flags=re.MULTILINE)
    sql = re.sub(r'```\s*$', '', sql, flags=re.MULTILINE)
    sql = sql.strip()

    # 安全检查：只允许 SELECT
    first_keyword = sql.split()[0].upper() if sql else ''
    if first_keyword != 'SELECT':
        raise ValueError(f"安全拦截：只允许 SELECT 语句，实际以 '{first_keyword}' 开头")

    for keyword in FORBIDDEN_KEYWORDS:
        if re.search(rf'\b{keyword}\b', sql, re.IGNORECASE):
            raise ValueError(f"安全拦截：SQL 中包含危险关键词 '{keyword}'")

    return sql
```

**常见错误**：
- 没有去掉 markdown 代码块标记（LLM 常输出 ` ```sql ... ``` `），导致 SQL 执行报错
- 安全检查只看首词，但 SQL 注入可以在 SELECT 后面嵌套子查询做坏事
- `temperature` 设太高，导致同一个问题每次生成不同的 SQL

### 练习二

```python
def validate_sql(sql: str, db_connection) -> dict:
    result = {"valid": False, "error": None, "row_count": 0}
    cursor = db_connection.cursor()

    try:
        # 用 EXPLAIN 检查语法（不实际执行）
        cursor.execute(f"EXPLAIN {sql}")
        result["valid"] = True
    except Exception as e:
        result["error"] = f"语法错误: {str(e)}"
        return result

    try:
        cursor.execute(sql)
        rows = cursor.fetchall()
        result["row_count"] = len(rows)

        if len(rows) == 0:
            result["error"] = "查询结果为空，可能是条件过严或 SQL 逻辑有误"
        elif len(rows) > 10000:
            result["error"] = f"结果行数过多 ({len(rows)})，建议添加 LIMIT 或细化条件"
    except Exception as e:
        result["error"] = f"执行错误: {str(e)}"

    return result
```

**常见错误**：
- 直接执行 SQL 而不是先用 EXPLAIN 检查语法，恶意 SQL 可能已经造成破坏
- 没有处理数据库连接超时的情况
- `row_count` 检查的阈值写死，不同场景应该有不同的合理上限
