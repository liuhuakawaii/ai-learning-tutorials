# Lesson 02: Git 工作流 — AI 增强的版本控制

> **课程定位**: Stage 4 第 2 课 | **前置**: Lesson 01 | **预计时长**: 75 分钟

## 场景引入

团队项目进入密集开发期，一天几十个 commit 涌入 main 分支。你打开 `git log`，看到的是 "fix"、"update"、"stuff"、"WIP" 这样的提交信息，完全无法追溯每次变更的意图。PR 描述要么空着，要么只写一句"修了个 bug"。合并冲突时，两个同事各改了一处代码，没人说得清各自的真实意图，最后只能手动拼接，结果上线后又出了新 bug。这些问题的根源不是 Git 工具本身，而是团队缺乏规范的版本控制习惯。AI 可以分析 diff 自动生成语义化提交信息、基于 commit 历史生成结构化 PR 描述、甚至帮你理解合并冲突中双方的修改意图。

## 学习目标

1. 掌握用 AI 生成规范的 Git 提交信息
2. 学会用 AI 编写高质量的 PR/MR 描述
3. 理解 AI 辅助的分支管理和命名规范
4. 掌握用 AI 解决 Git 合并冲突
5. 学会用 AI 自动生成 CHANGELOG

---

## 1. 为什么 Git 工作流需要 AI

Git 是开发者的日常工具，但很多团队的 Git 使用并不规范：

```
常见的 Git 问题:

$ git log --oneline
a1b2c3d fix
e4f5g6h update
i7j8k9l stuff
m0n1o2p asdf
q3r4s5t WIP
t6u7v8w final fix
x9y0z1a final fix v2
b2c3d4e really final fix

问题：
✗ 提交信息无意义，无法追溯
✗ PR 描述空洞，审查者无从下手
✗ 分支命名混乱
✗ 合并冲突处理不当
✗ 没有 CHANGELOG
```

### AI 能做什么

| 任务 | 传统方式 | AI 辅助 |
|------|----------|---------|
| 提交信息 | 随意写几个字 | 分析 diff 生成语义化信息 |
| PR 描述 | 留空或写一句话 | 自动生成结构化描述 |
| 分支命名 | `test`, `fix`, `update` | `feat/user-auth`, `fix/null-pointer` |
| 冲突解决 | 手动对比、可能出错 | AI 分析两边意图，建议解决方案 |
| CHANGELOG | 手动整理或跳过 | 从 commit 历史自动生成 |

---

## 2. AI 生成提交信息

### 2.1 Conventional Commits 规范

```
Conventional Commits 格式:

<type>(<scope>): <description>

[optional body]

[optional footer(s)]

类型:
  feat:     新功能
  fix:      Bug 修复
  docs:     文档变更
  style:    代码格式（不影响功能）
  refactor: 重构（既不修复 bug 也不添加功能）
  perf:     性能优化
  test:     测试相关
  chore:    构建过程或辅助工具变更
  ci:       CI 配置变更

示例:
  feat(auth): add JWT refresh token mechanism
  fix(api): handle null assignee in task creation
  docs(readme): update API usage examples
  refactor(service): extract validation logic to middleware
```

### 2.2 AI 生成提交信息的提示词

```
请根据以下 git diff 生成符合 Conventional Commits 规范的提交信息。

规则：
1. 第一行不超过 72 个字符
2. 使用英文
3. type 必须准确反映变更性质
4. scope 使用模块名
5. description 用祈使句，首字母小写
6. 如果变更复杂，在 body 中列出关键改动

git diff 输出:
[粘贴 diff]
```

**实际示例**:

```bash
# 查看当前变更
$ git diff --staged

# 将 diff 喂给 AI
```

**AI 输出**:
```
feat(tasks): add task status transition validation

- Add validStatusTransitions map to enforce allowed state changes
- Reject invalid transitions (e.g., done -> in_progress) with 422 error
- Include transition rules in task status update endpoint response
- Add unit tests for all valid and invalid transitions
```

### 2.3 批量生成提交信息

当有多个文件变更需要拆分提交时：

```
我有以下变更文件，请帮我拆分成多个逻辑提交，
并为每个提交生成 Conventional Commits 格式的信息：

变更文件：
- src/services/auth.ts (新增)
- src/middleware/authenticate.ts (新增)
- src/routes/users.ts (修改)
- src/config/index.ts (修改)
- tests/auth.test.ts (新增)
- package.json (修改 - 添加 jsonwebtoken 依赖)
- .env.example (修改 - 添加 JWT_SECRET)
```

**AI 输出**:
```
建议拆分为 3 个提交：

提交 1: feat(config): add JWT configuration and dependencies
  - package.json
  - .env.example
  - src/config/index.ts

提交 2: feat(auth): implement JWT authentication service
  - src/services/auth.ts
  - src/middleware/authenticate.ts

提交 3: feat(users): protect user routes with auth middleware
  - src/routes/users.ts
  - tests/auth.test.ts
```

---

## 3. AI 生成 PR 描述

### 3.1 PR 描述模板

```markdown
## Summary
<!-- 一句话描述这个 PR 做了什么 -->

## Changes
<!-- 列出关键改动 -->

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update

## Testing
<!-- 描述如何测试这些变更 -->

## Screenshots (if applicable)
<!-- 截图或 GIF -->

## Checklist
- [ ] 代码已自我审查
- [ ] 测试已通过
- [ ] 文档已更新
```

### 3.2 AI 生成 PR 描述的提示词

```
请根据以下 Git 历史和 diff 信息，生成一个完整的 PR 描述。

分支信息：feat/task-filters
目标分支：main
提交历史：
[粘贴 git log 输出]

要求：
1. Summary 用一句话概括 PR 目的
2. Changes 列出 3-5 个关键改动点
3. 自动判断 Type of Change
4. 建议测试方案
5. 标注可能的 Breaking Change
```

**AI 输出示例**:

```markdown
## Summary
Add advanced filtering and sorting capabilities to the task list API endpoint.

## Changes
- **Query parameters**: Added `status`, `assigneeId`, `priority`, `sortBy`,
  and `sortOrder` query parameters to `GET /api/tasks`
- **Pagination**: Implemented cursor-based pagination with configurable
  `page` and `pageSize` (max 100)
- **Zod validation**: Added input validation for all query parameters with
  sensible defaults
- **Performance**: Added database indexes on frequently filtered columns
  (`status`, `assignee_id`, `priority`)
- **Tests**: Added 12 unit tests covering filter combinations and edge cases

## Type of Change
- [x] New feature (non-breaking change)

## Testing
1. Run unit tests: `npm test -- --grep "listTasks"`
2. Manual testing:
   - `GET /api/tasks?status=todo&priority=high`
   - `GET /api/tasks?page=2&pageSize=5&sortBy=dueDate&sortOrder=asc`
3. Verify pagination metadata is correct

## Checklist
- [x] Code follows existing patterns
- [x] All tests pass
- [x] API documentation updated
- [x] Database migration included
```

---

## 4. 分支管理

### 4.1 AI 辅助分支命名

```
我需要创建一个分支来实现以下功能：
"给任务添加标签筛选功能，用户可以在查询时按标签过滤"

请建议分支名称，遵循 <type>/<short-description> 格式。
```

**AI 输出**:
```
建议分支名称：feat/task-tag-filtering

备选：
- feat/tag-based-task-filter
- feat/tasks-filter-by-tags
- feature/task-tag-search

推荐第一个，因为它：
1. 遵循 feat/ 前缀
2. 清晰表达了功能（task + tag + filtering）
3. 简短且描述性强
```

### 4.2 分支命名规范

```
分支命名规范:

┌─────────────────────────────────────────────────────┐
│  type/description                                   │
│                                                     │
│  类型:                                              │
│    feat/     新功能                                  │
│    fix/      Bug 修复                               │
│    docs/     文档                                    │
│    refactor/ 重构                                   │
│    test/     测试                                   │
│    chore/    构建/工具                               │
│    hotfix/   紧急修复                               │
│    release/  发布准备                               │
│                                                     │
│  规则:                                              │
│    - 使用小写字母和连字符                            │
│    - 不超过 50 个字符                               │
│    - 不以斜杠结尾                                   │
│    - 包含 issue 编号（如有）                        │
│                                                     │
│  示例:                                              │
│    feat/user-authentication                        │
│    fix/null-pointer-in-task-service                │
│    docs/api-endpoint-examples                      │
│    fix/ISSUE-123/task-creation-validation          │
└─────────────────────────────────────────────────────┘
```

---

## 5. AI 解决合并冲突

### 5.1 冲突解决流程

```
合并冲突解决流程:

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ 检测冲突  │────▶│ 分析冲突  │────▶│ AI 建议   │────▶│ 人工确认  │
│ git merge │     │ 理解双方  │     │ 解决方案  │     │ 应用修改  │
└──────────┘     │ 意图     │     └──────────┘     └──────────┘
                  └──────────┘
```

### 5.2 AI 冲突解决提示词

```
我遇到了 Git 合并冲突。请分析冲突内容，理解双方的修改意图，
然后给出解决方案。

冲突文件: src/services/taskService.ts

<<<<<<< HEAD (当前分支 - feat/pagination)
  async listTasks(filters: ListTasksFilters) {
    const { page = 1, pageSize = 20, status, assigneeId } = filters;
    const offset = (page - 1) * pageSize;

    let query = db.select().from(tasks);

    if (status) {
      query = query.where(eq(tasks.status, status));
    }
    if (assigneeId) {
      query = query.where(eq(tasks.assigneeId, assigneeId));
    }

    const data = await query.limit(pageSize).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(tasks);

    return { data, pagination: { page, pageSize, total } };
=======
  async listTasks(filters: TaskFilters) {
    const { status, assigneeId, priority, sortBy = 'createdAt' } = filters;

    let query = db.select().from(tasks);

    if (status) query = query.where(eq(tasks.status, status));
    if (assigneeId) query = query.where(eq(tasks.assigneeId, assigneeId));
    if (priority) query = query.where(eq(tasks.priority, priority));

    const data = await query.orderBy(tasks[sortBy]);
    return { data };
>>>>>>> feat/sorting (传入分支 - feat/sorting)
  }
```

**AI 分析与建议**:

```
分析：
- 当前分支 (feat/pagination): 添加了分页功能（page, pageSize, offset）
- 传入分支 (feat/sorting): 添加了优先级筛选和排序功能

两个分支的功能互不冲突，应该合并两边的功能。

解决方案：
```typescript
async listTasks(filters: TaskFilters) {
  const {
    page = 1,
    pageSize = 20,
    status,
    assigneeId,
    priority,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;
  const offset = (page - 1) * pageSize;

  let query = db.select().from(tasks);

  if (status) query = query.where(eq(tasks.status, status));
  if (assigneeId) query = query.where(eq(tasks.assigneeId, assigneeId));
  if (priority) query = query.where(eq(tasks.priority, priority));

  const countQuery = db.select({ total: count() }).from(tasks);
  if (status) countQuery.where(eq(tasks.status, status));
  // ... 复用相同筛选条件

  const data = await query
    .orderBy(sortOrder === 'desc' ? desc(tasks[sortBy]) : tasks[sortBy])
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await countQuery;

  return {
    data,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}
```
```

---

## 6. AI 生成 CHANGELOG

### 6.1 从 Git 历史生成 CHANGELOG

```
请根据以下 Git 提交历史，生成 CHANGELOG 内容。

格式遵循 Keep a Changelog：
## [版本号] - 日期
### Added / Changed / Deprecated / Removed / Fixed / Security

Git 历史:
[粘贴 git log 输出]
```

**AI 输出**:

```markdown
## [1.2.0] - 2025-01-15

### Added
- Task filtering by status, assignee, and priority
- Pagination support with configurable page size
- Task sorting by creation date, due date, and priority
- JWT authentication with refresh token mechanism
- Project progress statistics endpoint

### Changed
- Improved API response format with consistent pagination metadata
- Updated error responses to include request ID for debugging

### Fixed
- Fixed task creation accepting past due dates
- Fixed null pointer when task has no assignee

### Security
- Added rate limiting to authentication endpoints
- Implemented input sanitization for task descriptions

## [1.1.0] - 2025-01-01

### Added
- Task assignment to users
- Task status updates (todo/in_progress/done)
- Basic task CRUD operations

## [1.0.0] - 2024-12-15

### Added
- Initial project setup
- Database schema and migrations
- Basic Express.js server with TypeScript
```

### 6.2 自动化 CHANGELOG 生成脚本

```typescript
// scripts/generate-changelog.ts
import { execSync } from 'child_process';

interface Commit {
  hash: string;
  type: string;
  scope: string;
  description: string;
  body: string;
  breaking: boolean;
}

function parseCommit(line: string): Commit | null {
  const match = line.match(/^(\w+)\s+(\w+)(?:\((\w+)\))?:\s+(.+)$/);
  if (!match) return null;

  return {
    hash: match[1],
    type: match[2],
    scope: match[3] || '',
    description: match[4],
    body: '',
    breaking: line.includes('BREAKING CHANGE') || line.includes('!:'),
  };
}

function generateChangelog(commits: Commit[]): string {
  const groups: Record<string, Commit[]> = {
    'Added': commits.filter(c => c.type === 'feat'),
    'Fixed': commits.filter(c => c.type === 'fix'),
    'Changed': commits.filter(c => c.type === 'refactor'),
    'Documentation': commits.filter(c => c.type === 'docs'),
    'Security': commits.filter(c => c.type === 'security'),
  };

  let changelog = '';
  for (const [section, items] of Object.entries(groups)) {
    if (items.length > 0) {
      changelog += `### ${section}\n`;
      items.forEach(c => {
        const scope = c.scope ? `**${c.scope}:** ` : '';
        changelog += `- ${scope}${c.description}\n`;
      });
      changelog += '\n';
    }
  }

  return changelog;
}

// 用 AI 分析提交历史并生成更智能的 CHANGELOG
async function aiEnhancedChangelog(gitLog: string): Promise<string> {
  const prompt = `
    分析以下 Git 提交历史，生成 Keep a Changelog 格式的 CHANGELOG。
    对每个提交进行智能分组和描述优化：

    ${gitLog}
  `;
  // 调用 AI API...
  return prompt;
}
```

---

## 7. AI 辅助 Code Review

### 7.1 PR 审查提示词

```
请审查以下 PR 的代码变更。关注：

1. 潜在的 Bug
2. 安全问题
3. 性能问题
4. 代码风格一致性
5. 测试覆盖率

对每个问题，给出：
- 严重程度（Critical / Warning / Suggestion）
- 具体位置（文件名:行号）
- 问题描述
- 修复建议

代码变更:
[粘贴 git diff 或 PR 内容]
```

**AI 审查输出示例**:

```markdown
## Code Review Summary

### Critical Issues

**[C1]** `src/services/taskService.ts:45` - SQL Injection Risk
```typescript
// 问题代码
const query = `SELECT * FROM tasks WHERE title LIKE '%${search}%'`;
```
**修复**: 使用参数化查询
```typescript
const query = `SELECT * FROM tasks WHERE title LIKE $1`;
const result = await db.query(query, [`%${search}%`]);
```

### Warnings

**[W1]** `src/routes/tasks.ts:23` - Missing Error Handling
`createTask` 没有处理数据库唯一约束冲突（如重复标题）。

**[W2]** `src/services/taskService.ts:78` - N+1 Query Potential
`listTasks` 中对每个任务查询 assignee 信息，应使用 JOIN。

### Suggestions

**[S1]** `src/config/index.ts:5` - Environment Validation
建议使用 Zod 验证环境变量，确保类型安全。

**[S2]** `tests/tasks.test.ts:34` - Test Isolation
测试之间共享数据库状态，建议每个测试使用事务回滚。
```

---

## 8. 常见误区

### ❌ 错误 1：不看 AI 生成的提交信息直接提交
AI 可能误解 diff 内容。**始终审查后再提交**。

### ❌ 错误 2：让 AI 解决冲突但不验证代码逻辑
AI 的冲突解决建议可能引入新问题。**解决后必须运行测试**。

### ❌ 错误 3：所有变更放在一个提交里
即使 AI 能为大 diff 生成信息，也应该**拆分为逻辑独立的小提交**。

### ❌ 错误 4：PR 描述完全照搬 AI 输出
AI 不了解项目的业务背景。**补充业务上下文和动机**。

### ❌ 错误 5：忽略 AI 审查中的 Critical 级别问题
AI 审查发现的安全和 Bug 问题需要优先处理。

---

## 9. 工程建议

1. **提交粒度要小且有意义**：每个提交应该是一个逻辑独立的变更——一个功能点、一个 Bug 修复或一次重构。即使 AI 能为大 diff 生成提交信息，小粒度的提交也让 Code Review 和 `git bisect` 排查问题更高效。

2. **建立团队的提交信息规范并配置校验**：使用 `commitlint` 等工具强制执行 Conventional Commits 规范，让 AI 生成的提交信息有统一的格式约束。这样 CHANGELOG 自动生成才能可靠工作。

3. **PR 描述要补充业务上下文**：AI 生成的 PR 描述通常只覆盖技术变更，缺少业务背景。在 AI 输出的基础上，补充"为什么要做这个变更"、"解决了什么用户问题"、"有哪些已知限制"等业务信息，让审查者能快速理解 PR 的价值。

4. **合并冲突解决后必须运行测试**：AI 的冲突解决方案可能在语法上正确但逻辑上有问题。解决冲突后，除了运行全量测试，还要重点测试冲突涉及的功能路径。

---

## 10. 总结

本课学习了 AI 增强的 Git 工作流：

1. **提交信息** — AI 分析 diff 生成 Conventional Commits 格式信息
2. **PR 描述** — AI 基于 commit 历史生成结构化 PR 描述
3. **分支命名** — AI 建议语义化的分支名称
4. **冲突解决** — AI 分析双方意图，建议合并方案
5. **CHANGELOG** — AI 从 commit 历史自动生成发布日志
6. **Code Review** — AI 辅助代码审查，发现潜在问题

**核心原则**: AI 处理格式和模板，人负责内容和决策。

> **下一课预告**: [Lesson 03: 文档自动化](./03-文档自动化.md) — 学习如何用 AI 自动生成和维护项目文档。

---

## 11. 动手练习

### 练习 1：提交信息生成（20 分钟）
在你当前的项目中，创建 5 个不同的代码变更（可以是小修改），然后：
1. 手动写提交信息
2. 用 AI 生成提交信息
3. 对比两者的质量，记录 AI 哪些地方写得更好

### 练习 2：PR 描述生成（25 分钟）
创建一个分支，做 3-5 个相关提交，然后：
1. 让 AI 生成 PR 描述
2. 人工审查并补充业务上下文
3. 提交 PR 让同事评价描述质量

### 练习 3：CHANGELOG 生成（30 分钟）
获取你项目最近 20 个 commit 的历史，然后：
1. 手动整理 CHANGELOG（计时）
2. 用 AI 生成 CHANGELOG（计时）
3. 对比两者质量，记录效率提升

---

## 参考答案

### 练习 1：提交信息生成（20 分钟）

**思路**：手动写提交信息容易过于简短或模糊，AI 分析 diff 后能生成包含变更范围、具体内容和影响的结构化信息。关键是对比两者的信息量差异。

**答案**：

```markdown
## 对比记录

### 变更 1：修复任务创建时的日期验证

**手动提交信息**：
fix: 修复日期 bug

**AI 生成的提交信息**：
fix(tasks): reject past due dates in task creation

- Add date validation in createTask service to compare against today
- Return 400 with clear error message when due date is in the past
- Add unit tests for past date, today, and future date scenarios

**AI 优势**：说明了具体做了什么验证、返回什么状态码、测试覆盖了什么

### 变更 2：给任务列表添加分页功能

**手动提交信息**：
feat: 添加分页

**AI 生成的提交信息**：
feat(tasks): add pagination to task list endpoint

- Accept `page` and `pageSize` query parameters on GET /api/tasks
- Default to page 1, pageSize 20, max pageSize 100
- Return pagination metadata (total, totalPages) in response
- Add Zod validation for pagination parameters

**AI 优势**：包含了参数默认值、限制条件和验证方式

### 变更 3：重构错误处理中间件

**手动提交信息**：
refactor: 重构错误处理

**AI 生成的提交信息**：
refactor(middleware): centralize error handling with AppError class

- Extract AppError class with statusCode and message properties
- Replace scattered try-catch blocks with centralized errorHandler middleware
- Map AppError to appropriate HTTP responses, unknown errors to 500

**AI 优势**：说明了重构的方式（提取类、集中处理）和具体变化

### 变更 4：更新 README 的环境变量说明

**手动提交信息**：
docs: 更新 README

**AI 生成的提交信息**：
docs(readme): add JWT_SECRET and REFRESH_EXPIRES_IN to env var table

**AI 优势**：精确指出更新了什么内容

### 变更 5：升级 Drizzle ORM 版本

**手动提交信息**：
chore: 升级依赖

**AI 生成的提交信息**：
chore(deps): upgrade drizzle-orm from 0.28.0 to 0.29.0

- Update drizzle-orm and drizzle-kit to 0.29.0
- Adjust schema syntax for breaking change in index definition

**AI 优势**：包含版本号和 breaking change 说明
```

**要点**：
- AI 生成的提交信息包含三个关键信息：做了什么（what）、怎么做的（how）、影响什么（scope），而手动写的通常只有 what
- Conventional Commits 的 scope 字段（如 `tasks`、`middleware`）帮助快速定位变更模块，AI 能自动从文件路径推断
- 养成让 AI 生成、人工审查的习惯，比完全手写或完全依赖 AI 都更好

---

### 练习 2：PR 描述生成（25 分钟）

**思路**：让 AI 基于 commit 历史生成 PR 描述的技术部分，人工补充业务背景和动机。关键是区分"AI 擅长的"和"人必须补充的"。

**答案**：

```markdown
## AI 生成的 PR 描述（初始版本）

### Summary
Add task filtering, sorting, and pagination capabilities to the task list API.

### Changes
- Added `status`, `priority`, `assigneeId` query parameters for filtering
- Implemented `sortBy` and `sortOrder` parameters for custom sorting
- Added pagination with `page` and `pageSize` (max 100)
- Added Zod validation for all query parameters
- Added database indexes on `status`, `assignee_id`, `priority` columns
- Added 12 unit tests for filter combinations and edge cases

### Type of Change
- [x] New feature (non-breaking change)

### Testing
- Unit tests: `npm test -- --grep "listTasks"`
- Manual: `GET /api/tasks?status=todo&priority=high&page=1&pageSize=5`

## 人工补充的业务上下文

### Motivation（AI 无法知道的部分）
- 产品反馈：用户在任务超过 50 个后无法快速找到特定任务
- 客户要求：项目经理需要按优先级排序查看高优任务
- 数据量预估：当前最大项目有 200+ 任务，分页是刚需

### Known Limitations
- `sortBy` 暂不支持自定义字段（如 `dueDate`），后续迭代补充
- 筛选条件之间是 AND 关系，暂不支持 OR 查询
- 分页使用 offset 方式，超大偏移量可能有性能问题，后续考虑 cursor 分页
```

**要点**：
- AI 擅长生成技术变更清单（改了什么文件、加了什么参数），但不理解业务动机（为什么要做、解决什么用户问题）
- PR 描述的高质量标准是：审查者看完描述就能判断"这个 PR 值不值得合入"，不需要读代码
- 补充 Known Limitations 是专业做法，表明你思考过边界情况而不是假装完美

---

### 练习 3：CHANGELOG 生成（30 分钟）

**思路**：手动整理 CHANGELOG 需要逐条阅读 commit 并分类，AI 可以自动完成这个过程。对比两者的时间和质量差异。

**答案**：

```markdown
## 效率对比

### 手动整理（耗时 ~25 分钟）
需要逐个阅读 20 条 commit，判断类型，手动复制描述，调整措辞。

### AI 生成（耗时 ~3 分钟）
将 git log 粘贴给 AI，自动生成分组后的 CHANGELOG。

### 时间节省：87%

## AI 生成的 CHANGELOG 示例

## [1.3.0] - 2025-01-20

### Added
- **tasks**: task filtering by status, priority, and assignee
- **tasks**: pagination support with configurable page size
- **tasks**: sorting by creation date, due date, and priority
- **auth**: JWT authentication with refresh token mechanism
- **stats**: project progress statistics endpoint

### Changed
- **db**: add indexes on tasks.status, tasks.assignee_id, tasks.priority
- **api**: standardize error response format with request ID

### Fixed
- **tasks**: reject past due dates in task creation
- **tasks**: handle null assignee without 500 error

### Security
- **auth**: add rate limiting to login endpoint
- **input**: sanitize task description to prevent XSS

## 质量对比

| 维度 | 手动 | AI 生成 |
|------|------|---------|
| 分类准确性 | 高（人工判断） | 高（基于 type 前缀） |
| 描述完整性 | 中（容易遗漏细节） | 高（分析 diff 内容） |
| 格式一致性 | 低（手写容易不统一） | 高（模板化输出） |
| Breaking Change 标注 | 容易遗漏 | 自动检测 `!` 标记 |
```

**要点**：
- CHANGELOG 自动生成的前提是团队遵守 Conventional Commits 规范，否则 AI 无法准确分类
- AI 生成的 CHANGELOG 需要人工审查一次，确保没有把内部重构细节暴露给用户（CHANGELOG 的读者是用户，不是开发者）
- 建议在 CI/CD 流程中集成 CHANGELOG 自动生成，每次发版时自动从上个 tag 以来的 commit 生成
