# 09. 架构演进策略 —— 渐进式迁移、技术债管理、架构决策记录（ADR）

> 架构不是一次性设计，而是持续演进的过程——学会在变化中保持系统健康

## 本课目标

- 理解架构演进的本质：在变化中保持系统健康
- 掌握渐进式迁移的策略和技巧
- 学会识别、量化和管理技术债
- 掌握架构决策记录（ADR）的方法
- 建立架构评审的实践

## 架构演进的本质

软件架构不是一次性设计好的，而是在业务发展、技术变化、团队成长的过程中持续演进的。

```
架构演进的驱动力：

1. 业务变化
   - 用户量增长：从 1000 到 100 万
   - 功能增多：从 5 个页面到 50 个页面
   - 业务复杂度提升：简单 CRUD 到复杂业务逻辑

2. 技术变化
   - 新框架出现：jQuery → React → Next.js
   - 浏览器能力增强：ES6+、Web Components、WebAssembly
   - 构建工具升级：Webpack → Vite

3. 团队变化
   - 团队规模扩大：3 人 → 30 人
   - 人员流动：核心开发者离职
   - 技术能力提升：团队学习了新的最佳实践

4. 问题暴露
   - 性能瓶颈：页面越来越慢
   - 维护成本：改一个功能要改 10 个地方
   - 开发效率：新人要 2 周才能上手
```

### 架构演进的阶段

```
阶段 1：MVP（0-3 个月）
  目标：快速验证业务假设
  架构：简单直接，能跑就行
  技术：React + useState + fetch
  债务：允许快速迭代产生的债务

阶段 2：增长期（3-12 个月）
  目标：功能完善，用户体验提升
  架构：引入状态管理、代码分割、基础规范
  技术：Zustand + React Query + ESLint
  债务：开始识别和记录技术债

阶段 3：成熟期（1-3 年）
  目标：维护成本可控，开发效率稳定
  架构：模块化、Monorepo、设计系统
  技术：Nx/Turborepo + 组件库 + 微前端
  债务：定期偿还技术债

阶段 4：平台期（3 年以上）
  目标：渐进式演进，避免大规模重写
  架构：模块替换、渐进式重构
  技术：ADR 记录 + 渐进式迁移策略
  债务：技术债成为常态管理
```

## 渐进式迁移

渐进式迁移的核心思想是：**不一次性重写，而是逐步替换**。

### 策略一：绞杀者模式（Strangler Fig Pattern）

```
绞杀者模式的灵感来自热带雨林中的绞杀榕：
绞杀榕在宿主树的周围生长，逐渐取代宿主树，
最终宿主树死亡，绞杀榕成为新的树。

在软件中的应用：
1. 在老系统旁边构建新系统
2. 新功能用新系统开发
3. 老功能逐步迁移到新系统
4. 最终老系统被完全替代
```

```typescript
// 实现方式：路由层的渐进式迁移

// 阶段 1：新老系统共存，通过路由区分
const routes = [
  // 老系统（jQuery + JSP）
  { path: '/legacy/*', handler: legacyApp },
  // 新系统（React）
  { path: '/dashboard', handler: reactApp },
  { path: '/settings', handler: reactApp },
];

// 阶段 2：更多页面迁移到新系统
const routes = [
  { path: '/legacy/*', handler: legacyApp },  // 老系统范围缩小
  { path: '/dashboard', handler: reactApp },
  { path: '/settings', handler: reactApp },
  { path: '/users', handler: reactApp },      // 新增迁移
  { path: '/orders', handler: reactApp },     // 新增迁移
];

// 阶段 3：老系统只剩少量页面
const routes = [
  { path: '/legacy/reports', handler: legacyApp },  // 只剩报表
  { path: '/*', handler: reactApp },                 // 其他都是新系统
];

// 阶段 4：完全迁移
const routes = [
  { path: '/*', handler: reactApp },
];
```

### 策略二：特性开关（Feature Flags）

```typescript
// 使用特性开关控制新旧功能的切换
const featureFlags = {
  'new-user-list': true,      // 新的用户列表组件
  'new-order-flow': false,    // 新的订单流程（还在开发）
  'dark-mode': true,          // 暗色模式
  'new-dashboard': 'beta',    // 新仪表盘（仅 beta 用户）
};

// 在代码中使用
function UserList() {
  const isNewListEnabled = useFeatureFlag('new-user-list');

  if (isNewListEnabled) {
    return <NewUserList />;
  }
  return <OldUserList />;
}

// 渐进式发布
function Dashboard() {
  const dashboardVersion = useFeatureFlag('new-dashboard');

  switch (dashboardVersion) {
    case 'beta':
      return <BetaDashboard />;
    case true:
      return <NewDashboard />;
    default:
      return <OldDashboard />;
  }
}
```

### 策略三：适配器模式

```typescript
// 使用适配器模式让新老代码共存
// 老系统的 API 格式
interface OldUser {
  user_id: number;
  user_name: string;
  user_email: string;
  create_time: string;
}

// 新系统的 API 格式
interface NewUser {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

// 适配器：让老系统的数据能在新系统中使用
function adaptOldUser(old: OldUser): NewUser {
  return {
    id: old.user_id,
    name: old.user_name,
    email: old.user_email,
    createdAt: new Date(old.create_time),
  };
}

// 适配器：让新系统的数据能在老系统中使用
function adaptNewUser(newUser: NewUser): OldUser {
  return {
    user_id: newUser.id,
    user_name: newUser.name,
    user_email: newUser.email,
    create_time: newUser.createdAt.toISOString(),
  };
}

// 使用适配器的渐进式迁移
function UserService() {
  // 阶段 1：使用老 API，通过适配器转换
  async function getUser(id: number): Promise<NewUser> {
    const oldUser = await legacyApi.getUser(id);
    return adaptOldUser(oldUser);
  }

  // 阶段 2：切换到新 API
  async function getUser(id: number): Promise<NewUser> {
    return newApi.getUser(id);
  }
}
```

## 技术债管理

### 什么是技术债

```
技术债是"为了短期快速交付而做出的权宜之计，会在未来增加维护成本"。

类比：
  借钱 → 现在有钱花，但要付利息
  技术债 → 现在快速交付，但要付维护成本

技术债的类型：
1. 故意的技术债
   "我们知道这样做不好，但先上线再说"
   → 有计划的债务，通常有明确的偿还时间

2. 无意的技术债
   "当时不知道有更好的做法"
   → 随着知识增长才发现的问题

3. 架构技术债
   "当时的设计不适合现在的规模"
   → 业务增长导致的架构不匹配

4. 代码技术债
   "这段代码没人敢动"
   → 缺乏测试、文档、规范导致的代码腐化
```

### 技术债的识别

```typescript
// 技术债的信号：

// 1. 修改成本高
// "改一个功能要改 10 个地方"
// "改这行代码不知道会影响什么"

// 2. 开发效率低
// "新人要 2 周才能上手"
// "写一个简单的功能要花很长时间"

// 3. 质量问题频发
// "经常出现 bug"
// "测试覆盖不足"

// 4. 性能下降
// "页面越来越慢"
// "打包时间越来越长"
```

### 技术债的量化

```typescript
// 技术债量化维度：

interface TechDebt {
  id: string;
  title: string;
  description: string;
  // 影响范围
  scope: 'component' | 'module' | 'system';
  // 严重程度
  severity: 'low' | 'medium' | 'high' | 'critical';
  // 修复成本
  effort: 'hours' | 'days' | 'weeks';
  // 利息：每次修改相关代码时额外花费的时间
  interest: number; // 每次额外花费的小时数
  // 频率：多久会遇到一次
  frequency: 'daily' | 'weekly' | 'monthly' | 'rarely';
  // 优先级计算
  priority: number; // severity * interest * frequency
}

// 优先级计算示例
function calculatePriority(debt: TechDebt): number {
  const severityScore = { low: 1, medium: 2, high: 4, critical: 8 }[debt.severity];
  const frequencyScore = { daily: 30, weekly: 4, monthly: 1, rarely: 0.25 }[debt.frequency];

  return severityScore * debt.interest * frequencyScore;
}

// 示例：
const debts: TechDebt[] = [
  {
    id: '1',
    title: '用户组件没有类型定义',
    scope: 'component',
    severity: 'low',
    effort: 'hours',
    interest: 0.5,
    frequency: 'weekly',
    priority: 1 * 0.5 * 4, // = 2
  },
  {
    id: '2',
    title: '全局状态管理混乱',
    scope: 'system',
    severity: 'high',
    effort: 'weeks',
    interest: 4,
    frequency: 'daily',
    priority: 4 * 4 * 30, // = 480
  },
];
```

### 技术债的偿还策略

```
策略 1：预留时间
  每个迭代预留 20% 的时间处理技术债
  例如：2 周迭代，预留 2 天处理技术债

策略 2：顺带修复
  修改相关代码时，顺带修复附近的技术债
  "路过时清理"

策略 3：专项清理
  定期（每季度）安排专项技术债清理
  集中处理积累的技术债

策略 4：新项目重构
  开发新功能时，用新的架构重写相关模块
  利用新功能的需求来驱动重构
```

## 架构决策记录（ADR）

ADR（Architecture Decision Record）是记录架构决策的轻量级文档。

### ADR 模板

```markdown
# ADR-001：选择 Zustand 作为全局状态管理方案

## 状态
已接受

## 日期
2024-01-15

## 背景
项目需要在多个组件间共享用户信息、主题设置和购物车状态。
当前使用 React Context + useReducer，但存在以下问题：
1. Context 更新会导致所有消费者重新渲染
2. 异步操作需要手动管理 loading 和 error 状态
3. 没有 DevTools 支持，调试困难

## 决策
选择 Zustand 作为全局状态管理方案。

## 方案对比
| 方案 | 优点 | 缺点 |
|------|------|------|
| Redux Toolkit | DevTools 强大、中间件丰富 | 样板代码多、学习成本高 |
| Zustand | API 简洁、无样板、性能好 | DevTools 不如 Redux |
| Jotai | 原子化状态、性能好 | 概念新、社区小 |
| 继续 Context | 无额外依赖 | 性能问题、调试困难 |

## 后果
### 正面
- 状态逻辑集中，易于理解和调试
- 组件按需订阅，避免不必要的渲染
- 团队学习成本低

### 负面
- 需要约定 store 的组织方式
- 没有内置的异步处理（需要自己写 async/await）
- 可能需要额外的 DevTools 配置

### 风险
- 如果状态复杂度增长，可能需要拆分多个 store
- 需要制定团队规范，避免 store 混乱

## 相关决策
- ADR-002：服务端状态使用 React Query
- ADR-003：表单状态使用 React Hook Form
```

### ADR 的最佳实践

```
1. 记录"为什么"而不是"是什么"
   不要写"我们使用了 Zustand"
   要写"我们选择 Zustand 是因为..."

2. 记录被拒绝的方案
   说明为什么没选其他方案，以及什么情况下要重新评估

3. 记录决策的后果
   包括正面和负面的后果

4. 保持简洁
   ADR 不需要很长，一两页就够

5. 及时记录
   决策做出后尽快记录，不要等到遗忘

6. 允许修订
   当情况变化时，可以创建新的 ADR 来推翻旧的决策
```

### ADR 工具

```typescript
// ADR 文件结构
// docs/adr/
//   001-use-zustand-for-state-management.md
//   002-use-react-query-for-server-state.md
//   003-use-vite-for-build-tool.md
//   ...

// 使用 adr-tools 管理
// npm install -g adr-tools

// 创建新的 ADR
// adr new "选择 Zustand 作为全局状态管理方案"

// 列出所有 ADR
// adr list

// 生成 ADR 索引
// adr generate toc
```

## 架构评审

```typescript
// 架构评审的检查清单：

const architectureReviewChecklist = {
  // 1. 技术选型
  technology: [
    '技术选型是否有明确的理由？',
    '是否考虑了团队的技术能力？',
    '是否有足够的社区支持？',
    '是否有长期维护计划？',
  ],

  // 2. 代码结构
  structure: [
    '模块边界是否清晰？',
    '依赖关系是否合理？',
    '是否有循环依赖？',
    '代码是否易于理解？',
  ],

  // 3. 可扩展性
  scalability: [
    '架构是否支持业务增长？',
    '是否有性能瓶颈？',
    '是否支持水平扩展？',
    '是否有降级方案？',
  ],

  // 4. 可维护性
  maintainability: [
    '是否有足够的测试覆盖？',
    '是否有清晰的文档？',
    '是否有代码规范？',
    '是否有持续集成？',
  ],
};
```

## 练习

### 练习一：识别技术债

分析以下代码，识别其中的技术债：

```typescript
// 用户管理模块
function UserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users?page=${page}&search=${search}`)
      .then(res => res.json())
      .then(data => {
        setUsers(data.list);
        setTotal(data.total);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [page, search]);

  // 删除用户
  const deleteUser = async (id) => {
    if (window.confirm('确定删除？')) {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      // 重新获取列表
      fetch(`/api/users?page=${page}&search=${search}`)
        .then(res => res.json())
        .then(data => {
          setUsers(data.list);
          setTotal(data.total);
        });
    }
  };

  // 更新用户
  const updateUser = async (id, data) => {
    await fetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    // 重新获取列表
    fetch(`/api/users?page=${page}&search=${search}`)
      .then(res => res.json())
      .then(data => {
        setUsers(data.list);
        setTotal(data.total);
      });
  };

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {loading ? <div>加载中...</div> : (
        <table>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <button onClick={() => deleteUser(user.id)}>删除</button>
                <button onClick={() => updateUser(user.id, { name: '新名字' })}>更新</button>
              </td>
            </tr>
          ))}
        </table>
      )}
      {error && <div>错误：{error.message}</div>}
      <div>
        <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>上一页</button>
        <span>第 {page} 页</span>
        <button onClick={() => setPage(p => p + 1)}>下一页</button>
      </div>
    </div>
  );
}
```

### 练习二：编写 ADR

为以下决策编写一份 ADR：
- 背景：团队在讨论使用 Next.js 还是 Vite + React Router 来构建新的营销网站
- 需要考虑：SEO、开发体验、部署方式、团队熟悉度

---

## 参考答案

### 练习一

```
技术债识别：

1. 数据获取逻辑重复
   问题：deleteUser 和 updateUser 中重复了获取列表的代码
   影响：每次修改接口逻辑需要改多处
   修复：提取公共的 fetchUsers 函数，或使用 React Query

2. 没有使用 React Query/SWR
   问题：手动管理 loading/error，没有缓存，没有自动刷新
   影响：代码重复，用户体验差（切换页面时闪烁）
   修复：引入 React Query

3. 没有错误处理
   问题：catch 中只设置 error，没有用户友好的错误提示
   影响：用户看到原始错误信息
   修复：添加 toast 通知，区分不同类型的错误

4. 没有加载状态
   问题：删除和更新操作没有 loading 状态
   影响：用户不知道操作是否在进行中
   修复：为每个操作添加 loading 状态

5. 没有确认操作的反馈
   问题：删除和更新后没有成功提示
   影响：用户不确定操作是否成功
   修复：添加成功提示

6. 硬编码的 API 路径
   问题：API 路径直接写在组件中
   影响：修改 API 地址需要改多处
   修复：提取到配置文件或 API 服务层

7. 没有 TypeScript
   问题：user 的类型不明确
   影响：容易出现运行时错误
   修复：添加 TypeScript 类型定义

8. 表格没有 key
   问题：虽然用了 user.id 作为 key，但没有处理 id 不存在的情况
   影响：可能出现 React key 警告
   修复：确保 id 唯一且存在
```

### 练习二

```markdown
# ADR-001：选择 Next.js 构建营销网站

## 状态
已接受

## 日期
2024-01-15

## 背景
公司需要构建一个新的营销网站，主要需求：
- 需要良好的 SEO（搜索引擎优化）
- 内容由市场团队维护，需要 CMS 集成
- 需要支持多语言
- 需要快速上线（2 周内）

团队技术栈：React + TypeScript，有 Next.js 经验，无 Vite + React Router 经验。

## 决策
选择 Next.js 作为框架。

## 方案对比

| 方案 | SEO | 开发体验 | 部署方式 | 团队熟悉度 |
|------|-----|----------|----------|------------|
| Next.js | 好（SSR/SSG） | 好 | Vercel/自托管 | 高 |
| Vite + React Router | 需额外配置 SSR | 好 | 静态托管 | 低 |
| Gatsby | 好（SSG） | 一般 | 静态托管 | 无 |

## 后果

### 正面
- SSR/SSG 开箱即用，SEO 友好
- 团队有经验，上手快
- Vercel 部署简单，CI/CD 集成好
- 文件系统路由，开发效率高

### 负面
- 需要 Vercel 或自托管（静态托管不支持 SSR）
- 构建时间可能较长（页面多时）
- 某些功能需要学习 Next.js 特有的 API

### 风险
- 如果后续需要复杂的客户端交互，可能需要调整架构
- 依赖 Vercel 的话，可能有 vendor lock-in

## 相关决策
- ADR-002：使用 MDX 作为内容管理方案
- ADR-003：使用 next-intl 实现多语言
```

## 下一步

完成本课后，继续学习 [10. 阶段项目：设计一个微前端架构方案](./10-stage-project.md)。
