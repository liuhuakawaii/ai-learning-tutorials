# 05 - Bug 定位

> 用 AI 从错误日志出发，缩小问题范围，快速找到根因。

---

## 课程定位

```
Stage 3: 测试与重构
  ├── 01 AI 生成单元测试
  ├── 02 测试覆盖率优化
  ├── 03 AI 辅助 Code Review
  ├── 04 代码重构
  ├── 05 Bug 定位  ◄── 你在这里
  ├── 06 性能优化
  └── 07 阶段实战：补全测试
```

## 前置要求

- 完成 03-AI辅助CodeReview
- 熟悉 TypeScript / Python 错误处理
- 了解基本的调试技巧（断点、日志）

## 预计时长

50 分钟

---

## 学习目标

完成本课后，你将能够：

1. 用 AI 分析错误日志和堆栈信息
2. 构建根因假设并用代码验证
3. 掌握二分法定位 Bug 的系统方法
4. 用 AI 生成复现 Bug 的最小测试用例
5. 建立从症状到根因的完整排查流程

---

## 1. Bug 定位流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Bug 定位五步法                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│  │ 1. 收集   │ ──→ │ 2. 缩小   │ ──→ │ 3. 假设   │            │
│  │ 症状信息  │     │ 范围      │     │ 根因      │            │
│  └──────────┘     └──────────┘     └──────────┘            │
│       │                │                │                   │
│       ▼                ▼                ▼                   │
│  错误消息          Git bisect       可能的原因列表          │
│  堆栈跟踪          二分法排查       按可能性排序             │
│  复现步骤          日志定位                                  │
│                                                             │
│  ┌──────────┐     ┌──────────┐                              │
│  │ 4. 验证   │ ──→ │ 5. 修复   │                              │
│  │ 假设      │     │ 并测试    │                              │
│  └──────────┘     └──────────┘                              │
│       │                │                                    │
│       ▼                ▼                                    │
│  写最小测试用例     修复代码 + 回归测试                       │
│  确认复现           防止再次出现                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. AI 分析错误日志

### 2.1 Prompt 模板：分析堆栈跟踪

```
请分析以下错误信息，帮我定位 Bug 根因。

错误信息：
[粘贴完整错误信息和堆栈跟踪]

相关代码：
[粘贴错误指向的代码]

请提供：
1. 错误的直接原因
2. 可能的根本原因（按可能性排序）
3. 需要检查的代码位置
4. 建议的验证方法
```

### 2.2 实战：分析 TypeError

**错误日志：**

```
TypeError: Cannot read properties of undefined (reading 'map')
    at renderUserList (src/components/UserList.tsx:25:18)
    at processQueue (node_modules/react-dom/cjs/react-dom.development.js:2681:13)
    at commitWork (node_modules/react-dom/cjs/react-dom.development.js:2654:7)
```

**相关代码：**

```typescript
// src/components/UserList.tsx

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserListProps {
  users?: User[];  // ← 可选属性
}

function UserList({ users }: UserListProps) {
  return (
    <ul>
      {users.map((user) => (  // ← 第 25 行，users 可能是 undefined
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

**AI 分析结果：**

```
错误分析报告：

🔴 直接原因
   users 为 undefined 时调用了 .map()
   位置: src/components/UserList.tsx:25

🔍 根本原因
   1. UserListProps 中 users 是可选属性 (users?: User[])
   2. 组件未处理 users 为 undefined 的情况
   3. 父组件可能未传递 users 属性

📋 验证方法
   1. 检查父组件调用 <UserList /> 时是否传了 users
   2. 检查 API 返回的数据结构是否正确
   3. 检查是否有条件渲染导致 users 未初始化

🔧 修复建议
   1. 组件内添加默认值: { users = [] }
   2. 或添加条件渲染: {users?.map(...)}
   3. 建议同时修复父组件的数据传递
```

**修复代码：**

```typescript
// 方案 1：默认值（推荐）
function UserList({ users = [] }: UserListProps) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// 方案 2：可选链 + 条件渲染
function UserList({ users }: UserListProps) {
  if (!users?.length) {
    return <div>暂无用户</div>;
  }

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

---

## 3. 二分法定位

### 3.1 二分法原理

```
二分法定位 Bug：

假设 Bug 在最近 10 次提交中的某一次引入

  commit 1  ─  正常  ─┐
  commit 2  ─  正常  ─┤
  commit 3  ─  正常  ─┤── 范围 1（正常）
  commit 4  ─  正常  ─┤
  commit 5  ─  正常  ─┘
  commit 6  ─  异常  ─┐
  commit 7  ─  异常  ─┤── 范围 2（异常）
  commit 8  ─  异常  ─┤
  commit 9  ─  异常  ─┤
  commit 10 ─  异常  ─┘

步骤：
1. checkout commit 5 → 测试 → 正常
2. checkout commit 7 → 测试 → 异常
3. Bug 在 commit 6 或 7 引入
4. 查看这两个 commit 的变更
```

### 3.2 Git Bisect 命令

```bash
# 自动二分查找
git bisect start
git bisect bad HEAD          # 当前版本有 Bug
git bisect good v1.0.0       # 某个正常版本

# Git 会自动 checkout 中间的 commit
# 你只需要测试并标记：
git bisect good    # 这个版本正常
git bisect bad     # 这个版本有 Bug

# 重复直到找到引入 Bug 的 commit

# 结束 bisect
git bisect reset
```

### 3.3 AI 辅助 Git Bisect

```
Prompt：
我的项目在最近的提交中引入了一个 Bug。
Bug 表现是：[描述症状]
正常行为是：[描述期望行为]

请帮我：
1. 确定 git bisect 的起始 good 和 bad commit
2. 生成用于自动测试的脚本
3. 分析可能引入 Bug 的 commit 类型
```

---

## 4. 常见 Bug 模式

### 4.1 Bug 模式分类

```
┌──────────────────────────────────────────────────────────────┐
│                    常见 Bug 模式                              │
├──────────────┬───────────────────────────────────────────────┤
│ 空值访问     │ user.address.city → user?.address?.city       │
├──────────────┼───────────────────────────────────────────────┤
│ 类型转换     │ "123" + 1 = "1231" vs parseInt("123") + 1     │
├──────────────┼───────────────────────────────────────────────┤
│ 异步竞态     │ 两个请求同时修改同一数据                       │
├──────────────┼───────────────────────────────────────────────┤
│ 边界溢出     │ 数组 arr[-1] 或 arr[arr.length]               │
├──────────────┼───────────────────────────────────────────────┤
│ 浮点精度     │ 0.1 + 0.2 !== 0.3                            │
├──────────────┼───────────────────────────────────────────────┤
│ 时区问题     │ Date 在不同环境解析结果不同                     │
├──────────────┼───────────────────────────────────────────────┤
│ 编码问题     │ 中文在 URL/JSON 中编码不一致                    │
├──────────────┼───────────────────────────────────────────────┤
│ 内存泄漏     │ 事件监听器未移除、闭包持有大对象                 │
└──────────────┴───────────────────────────────────────────────┘
```

### 4.2 AI Prompt：模式匹配

```
我的代码出现了以下症状：
- [症状描述]
- 发生频率：[总是/偶发/特定条件下]
- 最近变更：[最近改了什么]

请根据常见 Bug 模式，列出最可能的 3 个根因假设，
并为每个假设提供验证方法。
```

---

## 5. 最小复现用例

### 5.1 为什么需要最小复现

```
最小复现用例的价值：

  复杂环境                    最小复现
  ┌─────────────────┐        ┌─────────────────┐
  │ 100 个文件       │        │ 1 个测试文件     │
  │ 数据库连接       │   →    │ 无外部依赖       │
  │ 网络请求         │        │ 纯函数调用       │
  │ 用户交互         │        │ 直接触发         │
  │ 不确定的时序     │        │ 确定性结果       │
  └─────────────────┘        └─────────────────┘

  调试时间：30 min            调试时间：5 min
```

### 5.2 AI 生成最小复现

```
Prompt：
请为以下 Bug 生成最小复现测试用例。

Bug 描述：[描述]
错误信息：[粘贴错误]
相关代码：[粘贴代码]

要求：
1. 测试用例可以独立运行（无外部依赖）
2. 使用 Jest / pytest 断言
3. 测试名称描述 Bug 行为
4. 包含注释说明为什么会触发 Bug
```

### 5.3 实战：生成最小复现

**Bug 描述：** 日期解析在 Safari 中失败

```typescript
// ❌ Bug 代码
function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

// Chrome: 正常
parseDate('2024-01-15 10:30:00');  // → Date 对象

// Safari: Invalid Date
parseDate('2024-01-15 10:30:00');  // → Invalid Date
```

**AI 生成的最小复现测试：**

```typescript
describe('parseDate Safari 兼容性 Bug', () => {
  // Safari 不支持 "YYYY-MM-DD HH:mm:ss" 格式
  // 只支持 "YYYY-MM-DDTHH:mm:ss" 或 "YYYY/MM/DD HH:mm:ss"

  it('ISO 格式带 T 分隔符在所有浏览器正常', () => {
    const date = parseDate('2024-01-15T10:30:00');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // 0-indexed
    expect(date.getDate()).toBe(15);
  });

  it('空格分隔格式在 Safari 中失败（Bug 复现）', () => {
    const date = parseDate('2024-01-15 10:30:00');
    // 在 Safari 中会返回 Invalid Date
    expect(date.toString()).not.toBe('Invalid Date');
  });

  it('斜杠分隔格式兼容所有浏览器', () => {
    const date = parseDate('2024/01/15 10:30:00');
    expect(date.getFullYear()).toBe(2024);
  });
});

// 修复方案
function parseDateFixed(dateStr: string): Date {
  // 统一转换为 ISO 格式
  const normalized = dateStr.replace(' ', 'T');
  return new Date(normalized);
}
```

---

## 6. 异步 Bug 排查

### 6.1 常见异步 Bug

```typescript
// Bug 1: 忘记 await
async function getUser(id: string) {
  const user = db.user.findUnique({ where: { id } }); // 忘记 await
  return user; // 返回 Promise 而不是 User
}

// Bug 2: 未处理 Promise 拒绝
function riskyOperation() {
  fetch('https://api.example.com'); // 未 catch，未 await
  // 网络错误时 UnhandledPromiseRejection
}

// Bug 3: 竞态条件
let latestData: Data | null = null;

async function fetchData(query: string) {
  const response = await fetch(`/api/search?q=${query}`);
  latestData = await response.json(); // 后发请求可能先返回
  render(latestData);
}

// Bug 4: 闭包中的过期变量
for (var i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 100); // 全部输出 5
}
```

### 6.2 AI Prompt：异步 Bug 分析

```
以下代码有异步相关的 Bug，请分析：
1. 是否有未 await 的异步调用
2. 是否有竞态条件
3. 是否有未处理的 Promise 拒绝
4. 闭包是否捕获了过期变量

代码：
[粘贴代码]
```

---

## 7. 对比表：Bug 定位方法

| 方法 | 适用场景 | 效率 | 难度 |
|------|---------|------|------|
| 日志分析 | 有完整错误日志 | 高 | 低 |
| 二分法 | 不知哪个 commit 引入 | 高 | 低 |
| 断点调试 | 可复现的逻辑错误 | 中 | 中 |
| AI 分析 | 复杂错误信息 | 高 | 低 |
| 最小复现 | 需要隔离问题 | 高 | 中 |
| Git blame | 查找谁改过这行 | 低 | 低 |

---

## 常见错误

### 错误 1：只看错误消息不看堆栈

```bash
# ❌ 只看到 "TypeError: Cannot read properties of undefined"
# 然后到处加 null 检查

# ✅ 看堆栈跟踪，找到具体哪一行、哪个变量是 undefined
# 定位到根因而不是到处打补丁
```

### 错误 2：修改代码不写测试

```bash
# ❌ 找到 Bug 后直接改，没写测试
# 下次同一个 Bug 可能再次出现

# ✅ 先写一个复现 Bug 的测试
# 测试失败 → 修复 → 测试通过
# 这个测试就是回归测试，防止 Bug 再次出现
```

### 错误 3：忽略环境差异

```bash
# ❌ "我本地是好的"
# 可能是 Node 版本、OS、浏览器差异导致

# ✅ 检查环境差异：
# - Node/Python 版本
# - 操作系统（路径分隔符、文件名大小写）
# - 浏览器（Date 解析、API 支持）
# - 环境变量
```

---

## 总结

```
本课要点回顾：

  ✅ Bug 定位五步法：收集→缩小→假设→验证→修复
  ✅ AI 分析堆栈跟踪和错误日志
  ✅ Git bisect 二分法定位引入 Bug 的 commit
  ✅ 常见 Bug 模式：空值、类型、竞态、边界、时区
  ✅ 最小复现用例的生成方法
  ✅ 异步 Bug 的排查要点
```

## 下一课预告

> **[06 - 性能优化](./06-性能优化.md)**
>
> Bug 修完了，代码能正常工作了。
> 但"能工作"和"工作得好"是两回事。
> 下一课我们将学习用 AI 识别和修复性能瓶颈。

---

## 练习

### 练习 1：分析错误日志

分析以下错误，找出根因并提供修复方案：

```
TypeError: Converting circular structure to JSON
    --> starting at object with constructor 'Object'
    |     property 'parent' -> object with constructor 'Object'
    --- property 'child' closes the circle
    at JSON.stringify (<anonymous>)
    at serialize (src/utils/serializer.ts:15:20)
    at sendResponse (src/middleware/response.ts:32:15)
```

### 练习 2：修复异步 Bug

找出并修复以下代码中的异步 Bug：

```typescript
async function loadDashboard(userId: string) {
  let user, orders, notifications;

  db.user.findUnique({ where: { id: userId } }).then(u => user = u);
  db.order.findMany({ where: { userId } }).then(o => orders = o);
  db.notification.findMany({ where: { userId } }).then(n => notifications = n);

  return { user, orders, notifications };
}
```

### 练习 3：生成最小复现

为以下 Bug 生成最小复现测试用例：

**Bug：** `sortBy([{name: 'a', value: 1}, {name: 'b', value: 1}])` 在值相同时不能保持原始顺序（不稳定排序）。
