# 第七课：TypeScript 渐进式迁移——在不中断业务的前提下引入类型系统

## 场景引入

你维护着一个拥有 300+ 个 JavaScript 文件的中后台系统。项目运行稳定，但随着团队扩张到 8 人，类型相关的 bug 越来越频繁：

```js
function renderUserList(users) {
  return users.map(user => `
    <div class="user-card">
      <h3>${user.name}</h3>
      <span>${user.department.name}</span>  <!-- department 可能为 null -->
    </div>
  `).join('');
}
```

这类问题每周都在发生。团队讨论后决定引入 TypeScript，但面对 300 个文件的迁移量，没有人能停下来两周专门做这件事。

渐进式迁移的核心思想是：**TypeScript 编译器天然支持 JavaScript 文件**。你可以先让 JS 和 TS 文件共存，逐步将 JS 文件转换为 TS 文件，期间两种文件可以互相引用。

## 学习目标

1. 理解 TypeScript 渐进式迁移的原理和优势
2. 配置 `tsconfig.json` 支持 JS/TS 混合项目
3. 使用 JSDoc 作为迁移桥梁，逐步添加类型注解
4. 处理未类型化第三方库的类型声明
5. 制定实际可行的迁移路线图

## 核心概念

### 一、为什么选择渐进式迁移

```
┌─────────────────────────────────────────────────────────────┐
│            一次性迁移 vs 渐进式迁移                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  一次性迁移：                                                │
│  ┌───────────────────────────────────────────┐             │
│  │ 第1-2周：停止业务开发                       │             │
│  │ 第3-4周：重写所有文件为 .ts                 │             │
│  │ 第5-6周：修复所有类型错误                    │             │
│  │ 第7周：  测试、回归                          │             │
│  │                                           │             │
│  │ 风险：高  成本：高  收益：一次性获得          │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  渐进式迁移：                                                │
│  ┌───────────────────────────────────────────┐             │
│  │ 第1周：  配置 TypeScript，JS/TS 共存       │             │
│  │ 第2-3周：迁移核心工具库（utils/）           │             │
│  │ 第4-6周：迁移数据层（services/）            │             │
│  │ 第7-10周：迁移页面组件（pages/）            │             │
│  │ 持续：新代码必须用 TypeScript               │             │
│  │                                           │             │
│  │ 风险：低  成本：分散  收益：逐步获得          │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  关键：JS 和 TS 文件可以互相引用                              │
│  ┌───────────────────────────────────────────┐             │
│  │  import { formatDate } from                │             │
│  │    './utils/date-helpers.js';  ← JS 文件   │             │
│  │  import { validateUser } from              │             │
│  │    './validators/user.ts';    ← TS 文件   │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

渐进式迁移可行的底层原因是 TypeScript 编译器的 `allowJs` 选项——启用后，TypeScript 会将 `.js` 文件也纳入编译范围，通过类型推断自动推导变量类型。

### 二、tsconfig.json 配置

混合项目的 `tsconfig.json` 配置是迁移的基础：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowJs": true,
    "checkJs": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true,
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

随着迁移推进，逐步开启严格检查：

```json
// 阶段一：初始配置（JS/TS 共存）
{ "allowJs": true, "checkJs": false, "strict": false }

// 阶段二：核心模块迁移完成后
{ "allowJs": true, "checkJs": true, "noImplicitAny": true, "strict": false }

// 阶段三：大部分文件迁移完成后
{ "allowJs": false, "strict": true, "strictNullChecks": true }
```

### 三、JSDoc 作为迁移桥梁

TypeScript 编译器能识别 JSDoc 注释中的类型信息，将其作为类型推断的依据。这意味着你可以在不改文件扩展名的情况下，通过添加 JSDoc 注释来获得类型检查的好处。

```js
// src/services/order-service.js（未迁移的 JS 文件）

/**
 * @typedef {Object} CreateOrderData
 * @property {string} customerId - 客户 ID
 * @property {Array<{sku: string, quantity: number, price: number}>} items - 订单商品
 * @property {string} [couponCode] - 优惠券代码（可选）
 */

/**
 * @param {CreateOrderData} orderData
 * @returns {Promise<{orderId: string, totalAmount: number, status: string}>}
 */
async function createOrder(orderData) {
  const { customerId, items, couponCode } = orderData;
  const totalAmount = items.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );
  const order = {
    orderId: generateOrderId(),
    customerId,
    items,
    totalAmount,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await saveOrder(order);
  return order;
}
```

JSDoc 类型注解的常用语法：

```js
/** @param {string} name - 字符串类型 */
/** @param {number} age - 数字类型 */
/** @param {string[]} tags - 字符串数组 */
/** @param {{lat: number, lng: number}} location - 对象类型 */
/** @param {'admin' | 'user' | 'guest'} role - 联合类型 */
/** @param {(id: string) => User} getUser - 函数类型 */
/** @typedef {import('./types').User} User - 类型导入 */
```

### 四、处理第三方库的类型

**情况一：库自带类型声明**——安装 `@types` 包：

```bash
npm install --save-dev @types/express @types/lodash @types/node
```

**情况二：库没有类型声明**——在 `src/types` 目录下创建声明文件：

```typescript
// src/types/some-old-library.d.ts
declare module 'some-old-library' {
  interface ConfigOptions {
    baseUrl: string;
    timeout?: number;
  }
  export function createClient(config: ConfigOptions): {
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
  };
}
```

**情况三：为内部 JS 模块声明临时类型**：

```typescript
// src/types/internal-modules.d.ts
declare module '@/utils/request' {
  export function get<T>(url: string, params?: Record<string, unknown>): Promise<T>;
  export function post<T>(url: string, data?: unknown): Promise<T>;
}
```

### 五、自动类型推断

TypeScript 的类型推断能力是渐进式迁移的重要支撑：

```typescript
// 从初始值推断
const userName = '张三';           // string
const tags = ['vip', 'active'];    // string[]

// 从返回值推断
function calculateTotal(price: number, quantity: number) {
  return price * quantity;  // 返回类型自动推断为 number
}

// 从条件推断类型收窄
function processValue(value: string | number) {
  if (typeof value === 'string') {
    return value.toUpperCase();  // value 收窄为 string
  }
  return value.toFixed(2);  // value 收窄为 number
}

// 从泛型推断
function firstElement<T>(arr: T[]): T | undefined {
  return arr[0];
}
const num = firstElement([1, 2, 3]);  // number | undefined
```

利用类型推断，你可以先给函数参数添加类型注解，返回值让 TypeScript 自动推断。

### 六、迁移优先级策略

```
┌─────────────────────────────────────────────────────────────┐
│              迁移优先级：从底层到顶层                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  优先级 1：类型定义和常量                                     │
│  ┌───────────────────────────────────────────┐             │
│  │ src/types/     → 类型定义文件               │             │
│  │ src/constants/ → 常量和枚举                 │             │
│  │ 原因：被广泛引用，类型化后其他文件自动获得    │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  优先级 2：工具函数库                                        │
│  ┌───────────────────────────────────────────┐             │
│  │ src/utils/       → 通用工具函数             │             │
│  │ src/validators/  → 数据验证                 │             │
│  │ 原因：接口简单，类型化收益高，迁移成本低     │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  优先级 3：数据层和服务层                                     │
│  ┌───────────────────────────────────────────┐             │
│  │ src/services/    → 业务服务                 │             │
│  │ src/api/         → API 接口定义             │             │
│  │ 原因：数据层是 bug 高发区，类型化后收益大    │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
│  优先级 4：页面组件（最后迁移）                               │
│  ┌───────────────────────────────────────────┐             │
│  │ src/pages/       → 页面组件                 │             │
│  │ 原因：变更频繁，等底层稳定后再迁移更安全     │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 七、迁移实战：从 JS 到 TS 的完整流程

**第一步：原始 JavaScript 代码**

```js
// src/services/user-service.js
const { db } = require('../database');
const { hashPassword } = require('../utils/crypto');

async function createUser(userData) {
  const { name, email, password, role } = userData;
  if (!name || !email || !password) {
    throw new Error('姓名、邮箱和密码为必填项');
  }
  const hashedPassword = await hashPassword(password);
  const user = await db.users.create({
    name, email, password: hashedPassword,
    role: role || 'user',
    createdAt: new Date(),
  });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

module.exports = { createUser };
```

**第二步：添加 JSDoc 类型注解（过渡阶段）**

```js
// src/services/user-service.js（添加 JSDoc）
const { db } = require('../database');
const { hashPassword } = require('../utils/crypto');

/**
 * @param {{name: string, email: string, password: string, role?: string}} userData
 * @returns {Promise<{id: string, name: string, email: string, role: string}>}
 */
async function createUser(userData) {
  // ...实现不变
}

module.exports = { createUser };
```

**第三步：转换为 TypeScript**

```typescript
// src/services/user-service.ts
import { db } from '../database';
import { hashPassword } from '../utils/crypto';

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'user' | 'moderator';
}

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function createUser(userData: CreateUserData): Promise<UserSummary> {
  const { name, email, password, role } = userData;
  if (!name || !email || !password) {
    throw new Error('姓名、邮箱和密码为必填项');
  }
  const hashedPassword = await hashPassword(password);
  const user = await db.users.create({
    name, email, password: hashedPassword,
    role: role || 'user',
    createdAt: new Date(),
  });
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
```

### 八、自动化迁移脚本

```js
// scripts/js-to-ts-migration.mjs
import { readFileSync, writeFileSync, existsSync } from 'fs';

function convertRequireToImport(content) {
  content = content.replace(
    /const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g,
    (_, name, path) => `import ${name} from '${path}';`
  );
  content = content.replace(
    /const\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g,
    (_, names, path) => `import { ${names.trim()} } from '${path}';`
  );
  return content;
}

function convertExportsToTS(content) {
  content = content.replace(
    /module\.exports\s*=\s*\{([^}]+)\};?/g,
    (_, names) => {
      const exportNames = names.split(',').map(n => n.trim()).filter(Boolean);
      return exportNames.map(n => `export { ${n} };`).join('\n');
    }
  );
  content = content.replace(/module\.exports\.(\w+)\s*=/g, (_, name) => `export const ${name} =`);
  return content;
}

function migrateFile(jsFilePath) {
  const content = readFileSync(jsFilePath, 'utf-8');
  let tsContent = content;
  tsContent = convertRequireToImport(tsContent);
  tsContent = convertExportsToTS(tsContent);

  const tsFilePath = jsFilePath.replace(/\.js$/, '.ts');
  if (existsSync(tsFilePath)) { console.warn(`跳过：${tsFilePath} 已存在`); return; }

  writeFileSync(tsFilePath, tsContent);
  console.log(`已转换：${jsFilePath} → ${tsFilePath}`);
}

const targetFile = process.argv[2];
if (!targetFile) { console.error('用法: node js-to-ts-migration.mjs <文件路径>'); process.exit(1); }
migrateFile(targetFile);
```

## 常见误区

**误区一：迁移时追求 100% 类型覆盖**

在迁移初期，不需要也不可能做到所有代码都有完整的类型注解。先让项目能在 TypeScript 编译器下运行起来，然后逐步收紧类型检查。`noImplicitAny: false` 是你的朋友，不是敌人。

**误区二：把所有类型都定义为 `any`**

有些开发者为了快速消除类型错误，到处使用 `as any`。这完全违背了引入 TypeScript 的初衷。如果确实不确定类型，用 `unknown` 代替 `any`，然后在使用时通过类型守卫收窄。

**误区三：忽略 `strictNullChecks`**

`strictNullChecks` 是 TypeScript 最有价值的安全检查之一。很多运行时错误（`Cannot read property 'x' of undefined`）都可以通过开启 `strictNullChecks` 在编译时发现。建议在迁移中期就开启这个选项。

## 小结与练习

### 小结

1. 渐进式迁移的核心是 `allowJs: true`，让 JS 和 TS 文件共存
2. JSDoc 注释可以作为迁移桥梁，在不改扩展名的情况下获得类型检查
3. `tsconfig.json` 的严格检查选项应该逐步开启，而不是一步到位
4. 第三方库的类型可以通过 `@types` 包、社区声明或自定义 `.d.ts` 文件处理
5. TypeScript 的类型推断能自动推导很多类型，减少手动注解工作
6. 迁移优先级：类型定义 → 工具库 → 数据层 → 页面组件
7. `any` 是迁移的敌人，`unknown` 是迁移的朋友

### 练习一：JSDoc 类型标注

为以下 JavaScript 函数添加完整的 JSDoc 类型注解：

```js
function paginateQuery(query, options) {
  const { page = 1, pageSize = 20, sortBy, sortOrder = 'asc' } = options || {};
  const offset = (page - 1) * pageSize;
  let results = db.query(query);
  if (sortBy) {
    results = results.sort((a, b) => {
      if (sortOrder === 'asc') return a[sortBy] > b[sortBy] ? 1 : -1;
      return a[sortBy] < b[sortBy] ? 1 : -1;
    });
  }
  return {
    data: results.slice(offset, offset + pageSize),
    pagination: { page, pageSize, total: results.length, totalPages: Math.ceil(results.length / pageSize) },
  };
}
```

### 练习二：模块迁移

将以下 CommonJS 模块转换为 TypeScript，并添加完整的类型定义：

```js
// src/utils/sort-helpers.js
function sortByField(arr, fieldName, order = 'asc') {
  return [...arr].sort((a, b) => {
    if (a[fieldName] < b[fieldName]) return order === 'asc' ? -1 : 1;
    if (a[fieldName] > b[fieldName]) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

function groupBy(arr, keyFn) {
  return arr.reduce((groups, item) => {
    const key = typeof keyFn === 'function' ? keyFn(item) : item[keyFn];
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}

module.exports = { sortByField, groupBy };
```

---

## 参考答案

### 练习一

**思路**：为 `query` 参数定义字符串类型，`options` 参数定义为可选的配置对象，返回值包含 `data` 数组和 `pagination` 分页信息。

**答案**：

```js
/**
 * @typedef {Object} PaginationOptions
 * @property {number} [page=1] - 页码
 * @property {number} [pageSize=20] - 每页条数
 * @property {string} [sortBy] - 排序字段
 * @property {'asc' | 'desc'} [sortOrder='asc'] - 排序方向
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {Record<string, unknown>[]} data - 数据列表
 * @property {{page: number, pageSize: number, total: number, totalPages: number}} pagination
 */

/**
 * @param {string} query
 * @param {PaginationOptions} [options]
 * @returns {PaginatedResponse}
 */
function paginateQuery(query, options) {
  // ...实现不变
}
```

**要点**：`@typedef` 可以定义复杂的对象类型；可选参数用 `[paramName]` 语法；返回值类型拆分为独立的 typedef 提高可读性。

### 练习二

**思路**：使用泛型让函数适用于任意类型的数组，`keyFn` 参数支持字符串和函数两种形式。

**答案**：

```typescript
// src/utils/sort-helpers.ts

type SortOrder = 'asc' | 'desc';

export function sortByField<T extends Record<string, unknown>>(
  arr: T[], fieldName: keyof T, order: SortOrder = 'asc'
): T[] {
  return [...arr].sort((a, b) => {
    if (a[fieldName] < b[fieldName]) return order === 'asc' ? -1 : 1;
    if (a[fieldName] > b[fieldName]) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

export function groupBy<T>(
  arr: T[], keyFn: keyof T | ((item: T) => string)
): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((groups, item) => {
    const key = typeof keyFn === 'function' ? keyFn(item) : String(item[keyFn]);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
}
```

**要点**：`T extends Record<string, unknown>` 约束泛型必须是对象类型；`keyof T` 确保字段名只能是数组元素的属性名；`reduce<Record<string, T[]>>` 为 reduce 指定泛型参数。
