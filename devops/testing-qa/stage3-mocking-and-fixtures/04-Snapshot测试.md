# Snapshot 测试

## 场景引入

你在测试一个配置对象的生成函数，返回值有 30 个字段。写断言写到手酸——每个字段都要 `expect(result.xxx).toBe(...)`。同事说："用快照测试啊，一行搞定。"你试了一下，果然：`expect(result).toMatchSnapshot()`。天下太平。

三个月后，你改了一个字段名，快照失败了。你运行 `vitest -u` 更新快照，CI 全绿。但你没注意到——另一个字段的值也变了，那是 bug，不是预期变更。快照更新掩盖了问题。

快照测试是一把双刃剑：用对场景省时省力，用错场景变成"绿色的谎言"。本课讲清什么时候用、怎么用、怎么管。

## 学习目标

- 理解快照测试的工作原理
- 掌握正确和错误的使用场景
- 学会内联快照与文件快照的选择
- 建立快照审查和治理流程

## 快照测试的工作原理

第一次运行时，Vitest 将断言值序列化为文本，保存到 `.snap` 文件。后续运行时，将新的结果与保存的快照对比：

```typescript
// utils/format-config.test.ts
import { describe, it, expect } from 'vitest'
import { formatAppConfig } from './format-config'

describe('formatAppConfig', () => {
  it('生成正确的应用配置', () => {
    const config = formatAppConfig({ env: 'production', version: '2.1.0' })

    // 第一次运行：创建快照文件
    // 后续运行：与快照文件对比
    expect(config).toMatchSnapshot()
  })
})
```

生成的快照文件（`__snapshots__/format-config.test.ts.snap`）：

```typescript
// Vitest Snapshot v1
exports[`formatAppConfig > 生成正确的应用配置 1`] = `
{
  "appName": "MyApp",
  "environment": "production",
  "version": "2.1.0",
  "apiBaseUrl": "https://api.myapp.com",
  "features": {
    "darkMode": true,
    "notifications": true,
    "betaFeatures": false,
  },
  "cache": {
    "ttl": 3600,
    "maxSize": 1000,
  },
}
`
```

**更新快照**：

```bash
# 更新所有快照
npx vitest -u

# 只更新特定文件的快照
npx vitest path/to/test.test.ts -u
```

## 正确的使用场景

### 1. 大型配置对象

测试配置生成时，字段多且结构稳定，快照比逐字段断言更高效：

```typescript
// ✅ 适合快照：配置对象结构稳定，字段多
it('默认配置正确', () => {
  const config = createDefaultConfig()
  expect(config).toMatchSnapshot()
})
```

### 2. 序列化/格式化结果

测试序列化输出时，快照能完整保存输出格式：

```typescript
// ✅ 适合快照：序列化格式的完整验证
it('JSON 序列化输出格式', () => {
  const report = generateReport(testData)
  const serialized = serializeReport(report)
  expect(serialized).toMatchSnapshot()
})

it('CSV 导出格式', () => {
  const csv = exportToCSV(orders)
  expect(csv).toMatchSnapshot()
})
```

### 3. 错误消息格式

验证错误消息包含正确的上下文信息：

```typescript
// ✅ 适合快照：错误消息格式验证
it('校验错误消息包含字段名', () => {
  const errors = validateUserForm({ email: '', name: 'a' })
  expect(errors).toMatchSnapshot()
})
```

## 错误的使用场景

### 1. UI 组件渲染

快照测试 UI 组件是最常见的误用——组件的渲染结果极其庞大且频繁变化：

```typescript
// ❌ 不适合快照：渲染结果太大，任何样式改动都会失败
it('渲染用户卡片', () => {
  const { container } = render(<UserCard user={mockUser} />)
  expect(container).toMatchSnapshot()  // 生成 200 行 HTML
})

// ✅ 更好：测试具体的行为和输出
it('显示用户名和邮箱', () => {
  render(<UserCard user={mockUser} />)
  expect(screen.getByText('张三')).toBeInTheDocument()
  expect(screen.getByText('zhangsan@test.com')).toBeInTheDocument()
})
```

### 2. 频繁变化的数据

```typescript
// ❌ 不适合快照：时间戳每次不同
it('记录创建时间', () => {
  const record = createRecord({ name: 'test' })
  expect(record).toMatchSnapshot()  // createdAt 每次测试都不同
})
```

### 3. 依赖外部状态的结果

```typescript
// ❌ 不适合快照：结果依赖数据库状态
it('查询用户列表', async () => {
  const users = await fetchUsers()
  expect(users).toMatchSnapshot()  // 数据库变化就会失败
})
```

## 内联快照 vs 文件快照

### 文件快照（默认）

```typescript
// 保存到 __snapshots__/*.snap 文件
expect(result).toMatchSnapshot()
```

**优点**：快照文件独立管理，不污染测试代码。
**缺点**：快照文件容易被忽略审查，悄悄更新。

### 内联快照

```typescript
// 直接写在测试文件中
expect(result).toMatchInlineSnapshot(`
  {
    "name": "张三",
    "email": "zhangsan@test.com",
    "role": "admin",
  }
`)
```

**优点**：快照就在测试代码旁边，review 时无法忽略。
**缺点**：长快照会让测试文件变得很长。

**选择建议**：

| 场景 | 推荐方式 |
|------|----------|
| 快照内容 < 20 行 | 内联快照 |
| 快照内容 > 20 行 | 文件快照 |
| 需要严格 code review | 内联快照 |
| 快照会被自动更新 | 文件快照 |

## 快照审查流程

快照最大的问题不是"容易失败"，而是"失败了就直接更新"。必须建立审查流程：

### 1. CI 中禁止自动更新

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npx vitest --no-update-snapshot
  # 不带 -u 参数，快照不匹配时直接失败
```

### 2. PR 中审查快照变更

```bash
# 查看快照变更
git diff __snapshots__/

# 审查清单：
# - 变更是预期的功能改动吗？
# - 变更的字段是否与本次 PR 相关？
# - 有没有意外的字段值变化？
```

### 3. 快照变更必须有理由

```markdown
<!-- PR 描述中 -->
## 快照变更

- `format-config.test.ts.snap`: 更新了 `apiBaseUrl` 从 v1 到 v2 — 预期变更
- `validate-form.test.ts.snap`: 新增手机号校验错误消息 — 新功能
```

## 快照膨胀的治理

快照文件越来越大是常见问题。治理方法：

### 1. 选择性快照

不要对整个对象做快照，只快照关键部分：

```typescript
// ❌ 快照整个响应（可能有 100 个字段）
expect(apiResponse).toMatchSnapshot()

// ✅ 只快照关心的部分
expect(apiResponse.data.users).toMatchSnapshot()
expect(apiResponse.pagination).toMatchSnapshot()
```

### 2. 属性快照

```typescript
// 使用 toMatchObject 只验证结构，不验证值
expect(config).toMatchObject({
  environment: 'production',
  features: expect.objectContaining({
    darkMode: true,
  }),
})
```

### 3. 定期清理

```bash
# 删除所有快照，重新生成
rm -rf __snapshots__
npx vitest
```

### 4. 断言具体属性

```typescript
// 对于结构稳定的对象，用具体断言替代快照
expect(config.environment).toBe('production')
expect(config.features.darkMode).toBe(true)
expect(config.cache.ttl).toBe(3600)
```

## 自定义快照序列化

控制快照的输出格式，排除不稳定的字段：

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    snapshotSerializers: ['./serializers/date-serializer.ts'],
  },
})
```

```typescript
// serializers/date-serializer.ts
export default {
  test: (val: unknown) => val instanceof Date,
  serialize: (val: Date) => `Date(${val.getFullYear()}-${val.getMonth() + 1}-${val.getDate()})`,
}
```

## 常见误区

1. **快照失败就直接更新**：这是最大的反模式，等于跳过了测试
2. **快照包含动态数据**：时间戳、随机 ID 等每次运行都不同的数据
3. **一个测试一个巨型快照**：应该拆分为多个小快照，分别验证不同部分
4. **快照替代所有断言**：快照适合验证结构，具体业务逻辑仍需明确断言

## 工程建议

1. **快照测试占比不超过 20%**：大部分测试应该用明确的断言
2. **内联快照优先**：代码审查时更容易发现异常变更
3. **在 PR 模板中添加快照审查提醒**
4. **新项目的快照从零开始**：不要从旧项目复制快照文件
5. **对快照命名，不要依赖默认编号**：

```typescript
// ✅ 有描述性的名称
expect(config).toMatchSnapshot('production-config-with-dark-mode')

// ❌ 默认编号难以理解
expect(config).toMatchSnapshot()
```

## 小结

快照测试的本质是"把当前结果当作未来对比的基准"。它适合结构稳定、字段多、序列化输出等场景。不适合 UI 组件渲染、频繁变化的数据、依赖外部状态的结果。核心纪律：**快照变更必须被审查，不能无脑更新**。

## 练习

### 练习一：判断快照适用性

以下场景是否适合使用快照测试？说明原因：
- A. 测试一个 REST API 返回的 JSON 响应（字段固定，结构稳定）
- B. 测试 React 组件的完整 DOM 渲染结果
- C. 测试一个函数生成的随机 token（每次不同）
- D. 测试 CSV 导出功能的输出格式

### 练习二：选择性快照

有一个 `generateInvoice` 函数，返回包含用户信息、商品列表、价格计算、时间戳的发票对象。请写出测试，使用选择性快照避免时间戳干扰，只验证商品列表和价格计算部分。

---

## 参考答案

### 练习一

**思路**：判断标准是"输出是否稳定、是否需要验证完整结构"。

**答案**：
- A. 适合。字段固定、结构稳定，快照能高效验证完整响应格式。
- B. 不适合。DOM 渲染结果庞大且频繁变化，应该测试具体行为（文本、交互）。
- C. 不适合。随机值每次不同，快照必然失败。应该用 `expect(token).toHaveLength(32)` 之类的断言。
- D. 适合。CSV 格式稳定，快照能验证分隔符、表头、数据行的完整格式。

**要点**：快照的适用条件是"输出稳定 + 需要验证完整结构"。两个条件缺一不可。

### 练习二

**思路**：拆分验证对象，对稳定部分用快照，对不稳定部分用具体断言或排除。

**答案**：

```typescript
// invoice.test.ts
import { describe, it, expect } from 'vitest'
import { generateInvoice } from './invoice'

describe('generateInvoice', () => {
  it('商品列表和价格计算正确', () => {
    const items = [
      { name: '商品A', quantity: 2, unitPrice: 100 },
      { name: '商品B', quantity: 1, unitPrice: 200 },
    ]

    const invoice = generateInvoice({
      userId: 'user-1',
      items,
      discount: 0.1,
    })

    // 只快照商品列表部分
    expect(invoice.items).toMatchInlineSnapshot(`
      [
        {
          "name": "商品A",
          "quantity": 2,
          "unitPrice": 100,
          "subtotal": 200,
        },
        {
          "name": "商品B",
          "quantity": 1,
          "unitPrice": 200,
          "subtotal": 200,
        },
      ]
    `)

    // 只快照价格计算部分
    expect(invoice.pricing).toMatchInlineSnapshot(`
      {
        "subtotal": 400,
        "discount": 40,
        "tax": 36,
        "total": 396,
      }
    `)

    // 时间戳用具体断言验证格式，不快照
    expect(invoice.issuedAt).toBeDefined()
    expect(new Date(invoice.issuedAt).getTime()).not.toBeNaN()
  })
})
```

**要点**：把大对象拆分为多个小快照，分别验证；不稳定字段（如时间戳）用具体断言而非快照。
