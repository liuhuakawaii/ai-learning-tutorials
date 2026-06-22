# 03 - AI 辅助 Code Review

> 用 AI 系统性地发现 Bug、安全漏洞、代码异味和性能问题。

---

## 课程定位

```
Stage 3: 测试与重构
  ├── 01 AI 生成单元测试
  ├── 02 测试覆盖率优化
  ├── 03 AI 辅助 Code Review  ◄── 你在这里
  ├── 04 代码重构
  ├── 05 Bug 定位
  ├── 06 性能优化
  └── 07 阶段实战：补全测试
```

## 前置要求

- 完成 01-AI生成单元测试
- 熟悉 TypeScript / Python 代码
- 了解基本的安全概念（SQL 注入、XSS）

## 预计时长

50 分钟

---

## 场景引入

团队每周的 Code Review 会议上，资深工程师总能指出你没注意到的问题："这里有 SQL 注入风险"、"这个循环里嵌套了 4 层 if，读起来太痛苦"、"用户余额检查和扣减不是原子操作，并发下单会出问题"。你很佩服，但自己看代码时就是发现不了这些问题。AI 能不能帮你系统性地扫描代码，像经验丰富的工程师一样找出 Bug、安全漏洞和代码异味？这一课就来建立一套 AI 辅助 Code Review 的完整工作流。

## 学习目标

完成本课后，你将能够：

1. 用 AI 审查代码发现潜在 Bug 和逻辑错误
2. 识别常见的安全漏洞（注入、XSS、敏感信息泄露）
3. 发现代码异味和可维护性问题
4. 使用结构化的 Prompt 提升 Code Review 质量
5. 建立团队级 AI Code Review 工作流

---

## 1. AI Code Review 流程

```
┌─────────────────────────────────────────────────────────────┐
│                  AI Code Review 流程                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ 1. 准备   │──→│ 2. 审查   │──→│ 3. 汇总   │              │
│  │ 代码差异  │    │ AI 分析   │    │ 人工筛选  │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       │               │               │                    │
│       ▼               ▼               ▼                    │
│  git diff 或     多维度扫描      生成 Review 报告           │
│  完整文件        (Bug/安全/      标记优先级                 │
│                  性能/风格)                                │
│                                                             │
│  ┌──────────┐    ┌──────────┐                              │
│  │ 4. 修复   │──→│ 5. 验证   │                              │
│  │ 逐项处理  │    │ 测试确认  │                              │
│  └──────────┘    └──────────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Bug 发现

### 2.1 常见 Bug 类型

```
┌──────────────────────────────────────────────────────────────┐
│                   常见 Bug 类型                               │
├──────────────┬───────────────────────────────────────────────┤
│ 竞态条件     │ 并发操作导致数据不一致                         │
│ 空值引用     │ 未检查 null/undefined 就访问属性               │
│ 类型错误     │ 隐式类型转换导致意外行为                       │
│ 边界溢出     │ 数组越界、整数溢出、精度丢失                   │
│ 逻辑反转     │ if 条件写反、return 值搞混                     │
│ 资源泄漏     │ 未关闭连接、未清理定时器                       │
│ 死循环       │ 循环条件永远为真                               │
└──────────────┴───────────────────────────────────────────────┘
```

### 2.2 Prompt：Bug 审查

```
请审查以下代码，专注于发现潜在的 Bug。

审查维度：
1. 空值/undefined 处理是否完整
2. 边界条件是否正确处理
3. 异步操作是否有竞态风险
4. 资源是否正确释放
5. 逻辑条件是否正确

对每个发现的 Bug，请说明：
- Bug 位置（行号）
- Bug 类型
- 复现条件
- 修复建议

代码：
[粘贴代码]
```

### 2.3 实战：发现隐藏 Bug

**待审查代码：**

```typescript
// src/services/order.ts

async function processOrder(userId: string, items: CartItem[]) {
  const user = await db.user.findUnique({ where: { id: userId } });
  const balance = user.balance;

  let total = 0;
  for (const item of items) {
    const product = await db.product.findUnique({ where: { id: item.productId } });
    total += product.price * item.quantity;
  }

  if (balance >= total) {
    await db.user.update({
      where: { id: userId },
      data: { balance: balance - total },
    });

    for (const item of items) {
      await db.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    await db.order.create({
      data: { userId, items, total, status: 'completed' },
    });

    return { success: true, orderId: '...' };
  }

  return { success: false, error: '余额不足' };
}
```

**AI 发现的 Bug：**

```
审查报告：

🔴 Bug 1 (严重): 竞态条件 - 余额检查与扣减非原子操作
   位置: L8-L17
   问题: 并发下单时，两个请求可能同时读取到足够余额，都通过检查
   复现: 用户同时发起两个订单请求，余额只够一个
   修复: 使用数据库事务 + 乐观锁

🔴 Bug 2 (严重): 未检查用户是否存在
   位置: L4
   问题: findUnique 可能返回 null，访问 null.balance 会崩溃
   复现: 传入不存在的 userId
   修复: 添加 null 检查

🟡 Bug 3 (中等): 库存检查缺失
   位置: L12-L14
   问题: 只扣减库存，未检查库存是否充足
   复现: 购买数量超过库存时，库存变为负数
   修复: 在扣减前检查 stock >= quantity

🟡 Bug 4 (中等): 顺序查询性能问题
   位置: L9-L11
   问题: 在循环中逐个查询商品，N 个商品执行 N 次查询
   修复: 使用 Promise.all 或 IN 查询批量获取
```

**修复后的代码：**

```typescript
async function processOrder(userId: string, items: CartItem[]) {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: '用户不存在' };
    }

    const productIds = items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let total = 0;
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return { success: false, error: `商品 ${item.productId} 不存在` };
      }
      if (product.stock < item.quantity) {
        return { success: false, error: `商品 ${product.name} 库存不足` };
      }
      total += product.price * item.quantity;
    }

    if (user.balance < total) {
      return { success: false, error: '余额不足' };
    }

    await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: total } },
    });

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const order = await tx.order.create({
      data: { userId, items, total, status: 'completed' },
    });

    return { success: true, orderId: order.id };
  });
}
```

---

## 3. 安全漏洞检测

### 3.1 常见安全漏洞

```
┌──────────────────────────────────────────────────────────────┐
│                   OWASP Top 10 常见漏洞                      │
├──────────────┬───────────────────────────────────────────────┤
│ SQL 注入     │ 拼接 SQL 语句                                 │
│ XSS          │ 未转义用户输入直接渲染                         │
│ CSRF         │ 缺少请求验证令牌                               │
│ 敏感信息泄露 │ 日志/错误信息暴露密码、Token                   │
│ 越权访问     │ 未验证资源所有权                               │
│ 硬编码密钥   │ 密码、API Key 写在代码里                       │
│ 不安全反序列化│ 直接反序列化用户输入                           │
└──────────────┴───────────────────────────────────────────────┘
```

### 3.2 Prompt：安全审查

```
请对以下代码进行安全审查。

重点检查：
1. SQL 注入风险（字符串拼接 SQL）
2. XSS 风险（未转义的用户输入）
3. 敏感信息泄露（日志、错误响应）
4. 认证/授权缺失
5. 硬编码密钥
6. 不安全的依赖使用

对每个漏洞请说明：
- 漏洞类型和严重程度（高/中/低）
- 攻击方式
- 修复代码

代码：
[粘贴代码]
```

### 3.3 安全漏洞示例

**存在漏洞的代码：**

```typescript
// ❌ 多个安全问题
app.get('/users', async (req, res) => {
  const { search, role } = req.query;

  // SQL 注入
  const users = await db.query(
    `SELECT * FROM users WHERE name LIKE '%${search}%' AND role = '${role}'`
  );

  // 敏感信息泄露
  res.json(users);
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.user.findUnique({ where: { email } });

  if (user.password === password) {  // 明文密码比较
    console.log(`Login success: ${email}, password: ${password}`);  // 日志泄露
    res.json({ token: jwt.sign({ id: user.id }, 'hardcoded-secret') });  // 硬编码密钥
  }
});
```

**AI 安全审查报告：**

```
安全审查报告：

🔴 高危: SQL 注入
   位置: L6-7
   攻击: ?search='; DROP TABLE users; --&role=admin
   修复: 使用参数化查询

🔴 高危: 明文密码存储/比较
   位置: L15
   攻击: 数据库泄露后密码直接可见
   修复: 使用 bcrypt 哈希比较

🔴 高危: 硬编码 JWT 密钥
   位置: L17
   攻击: 密钥泄露后可伪造任意 Token
   修复: 使用环境变量

🟡 中危: 敏感信息日志输出
   位置: L16
   问题: 密码被记录到日志文件
   修复: 移除密码日志

🟡 中危: 用户数据未脱敏
   位置: L9
   问题: 返回了密码哈希等敏感字段
   修复: 使用 select 排除敏感字段
```

**修复后的代码：**

```typescript
// ✅ 安全版本
import bcrypt from 'bcrypt';

app.get('/users', async (req, res) => {
  const { search, role } = req.query;

  const users = await db.user.findMany({
    where: {
      name: { contains: String(search || ''), mode: 'insensitive' },
      ...(role && { role: String(role) as Role }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  res.json(users);
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  });
  res.json({ token });
});
```

---

## 4. 代码异味检测

### 4.1 常见代码异味

```
┌──────────────────────────────────────────────────────────────┐
│                   代码异味 (Code Smells)                      │
├──────────────┬───────────────────────────────────────────────┤
│ 长函数       │ 函数超过 50 行，职责过多                       │
│ 魔法数字     │ 硬编码的数字/字符串，缺乏语义                  │
│ 重复代码     │ 相同/相似代码出现在多处                        │
│ 过深嵌套     │ if/for 嵌套超过 3 层                           │
│ 过多参数     │ 函数参数超过 4 个                              │
│ 全局可变状态 │ 共享的可变变量                                 │
│ 注释代码     │ 大段被注释掉的代码                             │
│ 过长类       │ 单个类职责过多                                 │
└──────────────┴───────────────────────────────────────────────┘
```

### 4.2 Prompt：代码异味检测

```
请检测以下代码中的代码异味 (Code Smells)。

检测维度：
1. 函数长度（超过 50 行）
2. 参数数量（超过 4 个）
3. 嵌套深度（超过 3 层）
4. 魔法数字/字符串
5. 重复代码模式
6. 职责过多

对每个异味请说明：
- 异味类型
- 位置
- 影响
- 重构建议

代码：
[粘贴代码]
```

### 4.3 代码异味示例

**有异味的代码：**

```typescript
// ❌ 多种代码异味
function processUserData(user: any, config: any, db: any, logger: any, cache: any) {
  // 魔法数字
  if (user.age < 18) {
    return { error: 'too young' };
  }

  if (user.name.length > 100) {
    return { error: 'name too long' };
  }

  // 过深嵌套
  if (user.role === 'admin') {
    if (user.permissions) {
      if (user.permissions.includes('write')) {
        if (user.status === 'active') {
          // 业务逻辑...
          const result = db.query('...');
          if (result) {
            for (const item of result) {
              if (item.status === 'pending') {
                // 更多逻辑...
              }
            }
          }
        }
      }
    }
  }

  // 重复代码
  const formattedName = user.name.trim().toLowerCase();
  const formattedEmail = user.email.trim().toLowerCase();
  const formattedPhone = user.phone.trim().toLowerCase();

  logger.info('Processing: ' + user.id + ' ' + user.name + ' ' + user.email);
}
```

**AI 重构建议：**

```
代码异味审查报告：

🟡 异味 1: 参数过多 (5 个参数)
   位置: L1
   建议: 封装为依赖对象或使用依赖注入

🟡 异味 2: 魔法数字
   位置: L3 (18), L7 (100)
   建议: 提取为命名常量

🔴 异味 3: 过深嵌套 (4 层)
   位置: L11-23
   建议: 使用 early return 模式减少嵌套

🟡 异味 4: 重复代码
   位置: L26-28
   建议: 提取为 normalize() 函数

🟡 异味 5: 字符串拼接
   位置: L30
   建议: 使用模板字符串或结构化日志
```

---

## 5. 结构化 Review 报告

### 5.1 报告模板

```markdown
## Code Review 报告

**审查文件**: src/services/order.ts
**审查日期**: 2024-01-15
**审查人**: AI + [你的名字]

### 严重问题 (必须修复)

| # | 类型 | 位置 | 描述 | 修复建议 |
|---|------|------|------|---------|
| 1 | Bug | L8 | 竞态条件 | 使用事务 |
| 2 | 安全 | L15 | SQL 注入 | 参数化查询 |

### 中等问题 (建议修复)

| # | 类型 | 位置 | 描述 | 修复建议 |
|---|------|------|------|---------|
| 3 | 性能 | L10 | N+1 查询 | 批量查询 |
| 4 | 可维护 | L25 | 魔法数字 | 提取常量 |

### 轻微问题 (可选修复)

| # | 类型 | 位置 | 描述 | 修复建议 |
|---|------|------|------|---------|
| 5 | 风格 | L30 | 字符串拼接 | 模板字符串 |

### 统计

- 🔴 严重: 2
- 🟡 中等: 2
- 🟢 轻微: 1
```

---

## 6. AI Code Review 工作流集成

### 6.1 GitHub Actions 集成

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Get diff
        id: diff
        run: |
          git diff origin/main...HEAD > diff.txt
          echo "diff<<EOF" >> $GITHUB_OUTPUT
          cat diff.txt >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: AI Review
        uses: anthropics/claude-code-action@v1
        with:
          prompt: |
            请审查以下代码变更，重点关注：
            1. 潜在 Bug
            2. 安全漏洞
            3. 性能问题
            
            代码变更：
            ${{ steps.diff.outputs.diff }}
```

### 6.2 本地 Review 脚本

```bash
#!/bin/bash
# scripts/ai-review.sh

# 获取未提交的变更
DIFF=$(git diff)

if [ -z "$DIFF" ]; then
  echo "没有未提交的变更"
  exit 0
fi

# 使用 AI 审查
echo "$DIFF" | ai-review --focus "bugs,security,performance"
```

---

## 7. 对比表：人工 Review vs AI Review

| 维度 | 人工 Review | AI Review |
|------|------------|----------|
| 速度 | 慢（每 PR 15-30 min） | 快（每 PR 1-3 min） |
| 一致性 | 因人而异 | 始终一致 |
| 安全漏洞 | 依赖经验 | 系统性扫描 |
| 业务逻辑 | 理解深刻 | 理解有限 |
| 代码风格 | 主观性强 | 可配置规则 |
| 最佳实践 | AI 预筛 + 人工终审 |

---

## 常见误区

### 错误 1：完全依赖 AI Review 结果

```bash
# ❌ AI 说没问题就直接合并
# AI 可能遗漏业务逻辑错误、上下文相关的 Bug

# ✅ AI Review 是辅助，不是替代
# 人工必须审查业务逻辑和架构设计
```

### 错误 2：Review Prompt 太笼统

```
# ❌ 太笼统的 Prompt
"帮我看看这段代码有什么问题"

# ✅ 结构化的 Prompt
"请从以下维度审查代码：
1. 空值处理完整性
2. 异步竞态风险
3. SQL 注入漏洞
4. 边界条件处理
对每个发现说明：位置、类型、复现条件、修复方案"
```

### 错误 3：忽略低优先级问题

```
# ❌ "只是风格问题，不影响功能"
# 代码异味积累会导致维护成本指数增长

# ✅ 小问题及时修复
# 用 AI 批量修复风格问题，人工专注逻辑问题
```

---

## 工程建议

1. **分维度审查而非一次性扫描**：将 Review 拆分为 Bug、安全、性能、风格四个维度分别进行，每次给 AI 一个明确的审查焦点，比"帮我看看有什么问题"效果好数倍。
2. **建立团队 Review Checklist**：将高频发现的问题（如 SQL 注入、空值检查、竞态条件）沉淀为团队级 Checklist，每次 Review 前让 AI 按 Checklist 逐项检查，确保一致性。
3. **AI 预筛 + 人工终审的分层流程**：让 AI 先扫描 PR 生成问题清单，人工只需聚焦于业务逻辑和架构设计，安全和风格类问题交给 AI 自动化处理。
4. **Review 结果结构化归档**：每次 Review 的发现（问题类型、位置、修复方案）用统一模板记录，积累为团队知识库，新成员可以通过历史 Review 快速学习常见陷阱。

---

## 总结

```
本课要点回顾：

  ✅ AI Code Review 流程：准备→审查→汇总→修复→验证
  ✅ Bug 发现：竞态、空值、类型、边界、资源泄漏
  ✅ 安全审查：SQL 注入、XSS、敏感信息泄露
  ✅ 代码异味：长函数、魔法数字、过深嵌套
  ✅ 结构化 Review 报告模板
  ✅ AI + 人工 Review 结合的最佳实践
```

## 下一课预告

> **[04 - 代码重构](./04-代码重构.md)**
>
> Code Review 发现了问题，下一步就是重构。
> 下一课我们将学习用 AI 辅助重构代码，应用 SOLID 原则和设计模式，
> 把烂代码变成可维护的高质量代码。

---

## 练习

### 练习 1：审查真实代码

选取你项目中的一个文件（100-200 行），用本课的 Prompt 模板进行 AI Code Review，生成结构化报告。

### 练习 2：安全漏洞扫描

审查以下代码，找出所有安全漏洞：

```typescript
app.post('/api/transfer', async (req, res) => {
  const { from, to, amount } = req.body;
  const sql = `UPDATE accounts SET balance = balance - ${amount} WHERE id = '${from}'`;
  await db.query(sql);
  const sql2 = `UPDATE accounts SET balance = balance + ${amount} WHERE id = '${to}'`;
  await db.query(sql2);
  res.json({ success: true });
});
```

### 练习 3：代码异味重构

审查并重构以下代码，消除所有代码异味：

```typescript
function doEverything(a: any, b: any, c: any, d: any, e: any) {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        if (d > 0) {
          return a + b + c + d + e;
        }
      }
    }
  }
  return 0;
}
```

---

## 参考答案

### 练习 1：审查真实代码

**思路**：使用课程中的结构化 Review 模板，分 Bug、安全、性能、代码异味四个维度审查。输出标准化的 Review 报告，按严重程度分类。

**答案**：

以课程中的 `processOrder` 函数为示例，生成结构化 Review 报告：

```markdown
## Code Review 报告

**审查文件**: src/services/order.ts
**审查日期**: 2024-01-15

### 严重问题 (必须修复)

| # | 类型 | 位置 | 描述 | 修复建议 |
|---|------|------|------|---------|
| 1 | Bug | L8 | 余额检查与扣减非原子操作，并发下单可能超扣 | 使用数据库事务 |
| 2 | Bug | L4 | 未检查 findUnique 返回 null，访问 null.balance 崩溃 | 添加 null 检查 |
| 3 | Bug | L12 | 未检查库存是否充足，库存可能变为负数 | 扣减前检查 stock >= quantity |

### 中等问题 (建议修复)

| # | 类型 | 位置 | 描述 | 修复建议 |
|---|------|------|------|---------|
| 4 | 性能 | L9-11 | 循环中逐个查询商品，N 个商品 N 次查询 | 使用 findMany + IN 查询 |

### 统计
- 严重: 3
- 中等: 1
```

**要点**：
- Review 报告要结构化：类型、位置、描述、修复建议缺一不可
- 按严重程度分级，严重问题必须修复才能合并
- 并发问题和空值检查是最常见的隐藏 Bug

---

### 练习 2：安全漏洞扫描

**思路**：逐行检查 `/api/transfer` 路由，从 SQL 注入、认证授权、输入校验、事务安全四个维度分析。

**答案**：

```
安全审查报告：

🔴 高危: SQL 注入（2 处）
   位置: L3-4
   攻击: body.amount = "1; DROP TABLE accounts; --"
   说明: amount 和 from/to 直接拼接进 SQL，攻击者可注入任意 SQL
   修复: 使用参数化查询或 ORM

🔴 高危: 缺少身份认证
   位置: 整个路由
   问题: 未验证请求者身份，任何人都能发起转账
   修复: 添加认证中间件，验证 JWT token

🔴 高危: 缺少权限校验
   位置: L3
   问题: 未验证 from 账户是否属于当前用户
   修复: 比对 token.userId === from

🔴 高危: 缺少事务保护
   位置: L3-6
   问题: 两条 UPDATE 不在事务中，第一条成功第二条失败时资金丢失
   修复: 使用数据库事务包裹两条 UPDATE

🟡 中危: 缺少余额校验
   位置: L3
   问题: 未检查 from 账户余额是否足够，余额可能变为负数
   修复: 在扣减前检查 balance >= amount

🟡 中危: 缺少输入校验
   位置: L1
   问题: 未校验 amount 是否为正数、from/to 是否为有效 ID
   修复: 添加 Zod schema 校验

🟡 中危: 缺少转账金额上限
   位置: L3
   问题: 未限制单次转账金额，可能导致大额资金风险
   修复: 添加最大转账金额限制
```

**修复后的安全版本：**

```typescript
app.post('/api/transfer', authenticate, async (req, res) => {
  const schema = z.object({
    to: z.string().uuid(),
    amount: z.number().positive().max(100000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { to, amount } = parsed.data;
  const from = req.user.id; // 从认证 token 获取

  await db.$transaction(async (tx) => {
    const fromAccount = await tx.account.findUnique({ where: { id: from } });
    if (!fromAccount || fromAccount.balance < amount) {
      throw new AppError(400, '余额不足');
    }

    await tx.account.update({
      where: { id: from },
      data: { balance: { decrement: amount } },
    });
    await tx.account.update({
      where: { id: to },
      data: { balance: { increment: amount } },
    });
  });

  res.json({ success: true });
});
```

**要点**：
- 字符串拼接 SQL 是最高优先级的安全漏洞
- 资金操作必须有事务保护和余额校验
- 身份认证 + 权限校验是 API 安全的基础

---

### 练习 3：代码异味重构

**思路**：`doEverything` 函数有 5 个代码异味：参数过多（5 个 any）、嵌套过深（4 层）、函数名无语义、魔法数字（> 0）、缺少类型。逐一消除。

**答案**：

**原代码的问题分析：**

```
代码异味审查报告：

🟡 异味 1: 参数过多 (5 个参数)
   位置: L1
   建议: 封装为配置对象

🟡 异味 2: 类型全是 any
   位置: L1
   建议: 定义具体类型

🔴 异味 3: 过深嵌套 (4 层)
   位置: L2-8
   建议: 使用卫语句/早返回

🟡 异味 4: 函数名无语义
   位置: L1
   doEverything 不说明做什么

🟡 异味 5: 魔法数字 > 0
   位置: L2-5
   建议: 提取为命名常量
```

**重构后的代码：**

```typescript
interface CalculationInput {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
}

const MIN_POSITIVE = 0;

function sumPositiveValues(input: CalculationInput): number {
  const { a, b, c, d, e } = input;

  if (a <= MIN_POSITIVE) return 0;
  if (b <= MIN_POSITIVE) return 0;
  if (c <= MIN_POSITIVE) return 0;
  if (d <= MIN_POSITIVE) return 0;

  return a + b + c + d + e;
}
```

**重构说明：**

1. **参数过多** → 封装为 `CalculationInput` 接口，一个参数替代五个
2. **类型全是 any** → 定义具体类型，全部为 `number`
3. **过深嵌套** → 用卫语句（early return）替代 4 层 if 嵌套
4. **函数名无语义** → `doEverything` 改为 `sumPositiveValues`
5. **魔法数字** → `0` 提取为 `MIN_POSITIVE` 常量

**要点**：
- 卫语句是消除嵌套最简单有效的手法——不符合条件就提前返回
- 参数超过 3 个时，封装为对象更易扩展和维护
- 重构前后行为完全一致：所有参数都大于 0 时返回总和，否则返回 0
