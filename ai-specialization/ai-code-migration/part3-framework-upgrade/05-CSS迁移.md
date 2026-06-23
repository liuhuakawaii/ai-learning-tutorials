# 第五课：CSS 迁移——从传统样式到现代 CSS 工程

## 场景引入

你接手了一个电商后台管理系统，项目经过三年迭代，CSS 文件已经膨胀到难以维护的地步：

```
src/
├── styles/
│   ├── global.css          (2800 行，包含大量 !important)
│   ├── admin-overrides.css (覆盖第三方组件库样式)
│   ├── variables.less      (Less 变量定义)
│   └── mixins.scss         (Sass 混入)
├── components/
│   ├── UserList.vue        (scoped style + 深度选择器穿透)
│   └── OrderTable.vue      (CSS Modules 命名约定)
└── pages/
    ├── Dashboard.vue       (内联 style 属性拼接)
    └── Settings.vue        (styled-components 风格)
```

这个项目同时使用了 Less、Sass、CSS Modules、内联样式，甚至还有少量 CSS-in-JS。不同开发者在不同时期引入了不同的方案，形成了"样式技术栈碎片化"的典型困境：

- 修改一个按钮颜色需要在 4 个文件中搜索相关样式
- 样式冲突导致 `!important` 泛滥，覆盖链长达 5 层
- 新人入职后需要两周才能理解样式命名约定
- 打包后 CSS 体积 480KB，其中 60% 是未使用的冗余样式

这些问题的本质不是"选错了 CSS 方案"，而是**缺乏统一的样式工程策略**。本课将系统讲解如何将碎片化的 CSS 技术栈迁移到 Tailwind CSS + Design Token 的现代方案，同时处理迁移过程中的真实工程问题。

## 学习目标

1. 分析现有 CSS 技术栈的复杂度，制定合理的迁移策略
2. 将 CSS/Less/Sass 样式转换为 Tailwind CSS 工具类
3. 处理 CSS Modules、CSS-in-JS 等不同方案的迁移路径
4. 建立 Design Token 体系，统一管理颜色、间距、字体等设计变量
5. 使用自动化工具加速 CSS 迁移过程

## 核心概念

### 一、CSS 迁移的整体策略

CSS 迁移不是简单的"把样式替换成 Tailwind 类名"。迁移的核心挑战在于：样式与组件结构紧密耦合，改变样式方案往往意味着同时改变组件的编写方式。

```
┌─────────────────────────────────────────────────────┐
│                CSS 迁移决策树                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  项目样式现状分析                                     │
│       │                                             │
│       ├── 样式方案单一（只有 CSS/Sass）               │
│       │       └── 直接迁移：CSS → Tailwind           │
│       │                                             │
│       ├── 多方案并存（CSS + CSS Modules + CSS-in-JS）│
│       │       └── 分层迁移：先统一方案，再迁移到目标   │
│       │                                             │
│       └── 深度定制（大量全局覆盖、主题系统）           │
│               └── 渐进迁移：新组件用新方案，旧组件逐步 │
│                   替换，用 Design Token 统一变量       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

大多数真实项目属于"多方案并存"或"深度定制"的情况，需要采用渐进式迁移策略。

### 二、Sass/Less 到 Tailwind 的转换

Sass 和 Less 的核心能力包括：变量、嵌套、混入（mixin）、函数。Tailwind CSS 通过工具类和配置系统提供了等价的解决方案。

**变量映射**：

```scss
// 旧代码：Sass 变量
$primary-color: #3b82f6;
$spacing-md: 16px;
$font-size-lg: 18px;

.user-card {
  color: $primary-color;
  padding: $spacing-md;
  font-size: $font-size-lg;
}
```

```js
// 新代码：Tailwind 配置中的 Design Token
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: { primary: '#3b82f6' },
      spacing: { md: '16px' },
      fontSize: { lg: '18px' },
    },
  },
};
```

```html
<!-- 新代码：组件中使用 Tailwind 工具类 -->
<div class="text-primary p-md text-lg">用户卡片内容</div>
```

**嵌套转换**：

```scss
// 旧代码：Sass 嵌套
.order-list {
  background: #fff;
  .order-item {
    border-bottom: 1px solid #e5e7eb;
    padding: 12px 16px;
    &:hover { background: #f9fafb; }
    .order-item__title { font-weight: 600; color: #111827; }
  }
}
```

```html
<!-- 新代码：Tailwind 工具类（HTML 结构即样式结构） -->
<div class="bg-white">
  <div class="border-b border-gray-200 px-4 py-3 hover:bg-gray-50">
    <h3 class="font-semibold text-gray-900">订单标题</h3>
  </div>
</div>
```

嵌套是 Sass 中最容易产生深层选择器链的功能。迁移到 Tailwind 后，样式的层级关系直接体现在 HTML 结构中，消除了深层嵌套带来的特异性问题。

**混入（Mixin）转换**：

```scss
// 旧代码：Sass mixin
@mixin flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}
.search-box { @include flex-center; gap: 8px; }
```

```html
<!-- 新代码：Tailwind 工具类 -->
<div class="flex items-center justify-center gap-2">搜索内容</div>
```

对于确实需要复用的样式组合，可以封装为组件或使用 Tailwind 的 `@apply` 指令作为过渡。

### 三、CSS Modules 迁移策略

CSS Modules 的核心思想是"局部作用域"——每个 CSS 文件的类名自动添加哈希后缀，避免全局冲突。Tailwind CSS 通过工具类天然具备局部性。

```css
/* 旧代码：UserCard.module.css */
.card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
.card__header { display: flex; justify-content: space-between; margin-bottom: 16px; }
.card__title { font-size: 18px; font-weight: 600; color: #111827; }
```

```jsx
// 旧代码：UserCard.jsx
import styles from './UserCard.module.css';
function UserCard({ user }) {
  return (
    <div className={styles.card}>
      <div className={styles.card__header}>
        <h2 className={styles.card__title}>{user.name}</h2>
      </div>
    </div>
  );
}
```

```jsx
// 新代码：UserCard.jsx（使用 Tailwind）
function UserCard({ user }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{user.name}</h2>
      </div>
    </div>
  );
}
```

迁移 CSS Modules 时，关键是把样式文件中的每个类名映射到对应的 Tailwind 工具类组合。

### 四、Design Token 迁移

Design Token 是连接设计与开发的桥梁。在迁移过程中，需要将分散在各处的颜色值、间距、字体等硬编码值统一提取为 Token。

```
┌──────────────────────────────────────────────────────┐
│              Design Token 层级结构                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  第一层：全局 Token（Primitive Token）                 │
│  ┌─────────────────────────────────────────────┐     │
│  │ blue-500: #3b82f6                           │     │
│  │ gray-100: #f3f4f6                           │     │
│  │ spacing-4: 1rem                             │     │
│  └─────────────────────────────────────────────┘     │
│           ↓ 映射                                      │
│  第二层：语义 Token（Semantic Token）                  │
│  ┌─────────────────────────────────────────────┐     │
│  │ color-primary: {blue-500}                   │     │
│  │ color-surface: {gray-100}                   │     │
│  │ spacing-card-padding: {spacing-4}           │     │
│  └─────────────────────────────────────────────┘     │
│           ↓ 使用                                      │
│  第三层：组件 Token（Component Token）                 │
│  ┌─────────────────────────────────────────────┐     │
│  │ button-primary-bg: {color-primary}          │     │
│  │ card-padding: {spacing-card-padding}        │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

在 Tailwind 配置中建立 Token 映射：

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#3b82f6', 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },
        surface: { DEFAULT: '#ffffff', secondary: '#f9fafb', tertiary: '#f3f4f6' },
        text: { primary: '#111827', secondary: '#6b7280', disabled: '#9ca3af' },
      },
      spacing: { 'card': '1.5rem', 'section': '2rem' },
      fontSize: {
        'heading-1': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        'body': ['0.875rem', { lineHeight: '1.25rem' }],
      },
      borderRadius: { 'card': '0.75rem', 'button': '0.5rem' },
      boxShadow: { 'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1)' },
    },
  },
};
```

### 五、全局样式处理

项目中的全局样式通常包含 CSS Reset、排版基线、工具类等。迁移到 Tailwind 后，全局样式只需要保留必要的基础层：

```css
/* 新代码：globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body { @apply font-sans text-text-primary antialiased; }
  a { @apply text-primary transition-colors hover:text-primary-600; }
}

@layer components {
  .btn { @apply inline-flex items-center rounded-button px-4 py-2 text-sm font-medium transition-colors; }
  .btn-primary { @apply bg-primary text-white hover:bg-primary-600; }
  .btn-danger { @apply bg-red-500 text-white hover:bg-red-600; }
}
```

`@layer` 指令确保 Tailwind 的工具类优先级高于基础层和组件层，避免了传统 CSS 中常见的特异性冲突问题。

### 六、自动化 CSS 迁移工具

手动转换大量 CSS 类名效率低下，我们可以利用自动化工具加速迁移过程：

| 工具 | 用途 | 适用场景 |
|------|------|----------|
| css-to-tailwind | CSS 属性 → Tailwind 类名映射 | 批量转换样式块 |
| Windi CSS Analyzer | 扫描项目生成 Tailwind 配置 | 初始化配置 |
| headwind | VS Code 扩展，自动排序类名 | 开发阶段 |
| prettier-plugin-tailwindcss | 自动格式化类名顺序 | 提交前格式化 |

下面是一个自定义的 CSS 类提取脚本：

```js
// scripts/css-migration-analyzer.mjs
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const CSS_CLASS_REGEX = /\.([a-zA-Z_][\w-]*)\s*\{/g;
const HTML_CLASS_REGEX = /class(?:Name)?=["']([^"']+)["']/g;

function scanDirectory(dirPath, extensions) {
  const files = [];
  function walk(currentPath) {
    for (const entry of readdirSync(currentPath)) {
      const fullPath = join(currentPath, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory() && entry !== 'node_modules' && entry !== '.git') {
        walk(fullPath);
      } else if (stat.isFile() && extensions.includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  }
  walk(dirPath);
  return files;
}

function extractCssClasses(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const classes = new Set();
  let match;
  while ((match = CSS_CLASS_REGEX.exec(content)) !== null) classes.add(match[1]);
  return { file: filePath, classes: [...classes] };
}

function extractHtmlClasses(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const classUsage = [];
  let match;
  while ((match = HTML_CLASS_REGEX.exec(content)) !== null) {
    classUsage.push({ file: filePath, classes: match[1].split(/\s+/).filter(Boolean) });
  }
  return classUsage;
}

function analyzeProject(projectPath) {
  const cssFiles = scanDirectory(projectPath, ['.css', '.less', '.scss']);
  const componentFiles = scanDirectory(projectPath, ['.vue', '.jsx', '.tsx']);

  const cssClassMap = new Map();
  for (const file of cssFiles) {
    const { classes } = extractCssClasses(file);
    for (const cls of classes) {
      if (!cssClassMap.has(cls)) cssClassMap.set(cls, []);
      cssClassMap.get(cls).push(file);
    }
  }

  const htmlUsage = componentFiles.flatMap(f => extractHtmlClasses(f));
  const usedClassNames = new Set(htmlUsage.flatMap(u => u.classes));
  const unusedClasses = [...cssClassMap]
    .filter(([cls]) => !usedClassNames.has(cls))
    .map(([cls, files]) => ({ className: cls, definedIn: files }));

  return {
    totalCssFiles: cssFiles.length,
    totalComponentFiles: componentFiles.length,
    totalCssClasses: cssClassMap.size,
    unusedClasses: unusedClasses.length,
    unusedClassDetails: unusedClasses.slice(0, 20),
  };
}

const projectPath = process.argv[2] || './src';
const report = analyzeProject(projectPath);

console.log('=== CSS 迁移分析报告 ===');
console.log(`CSS 文件数量：${report.totalCssFiles}`);
console.log(`组件文件数量：${report.totalComponentFiles}`);
console.log(`CSS 类名总数：${report.totalCssClasses}`);
console.log(`疑似未使用类名：${report.unusedClasses}`);
console.log('\n未使用类名示例：');
for (const item of report.unusedClassDetails) {
  console.log(`  .${item.className} → ${item.definedIn.join(', ')}`);
}
```

## 常见误区

**误区一：把所有 CSS 一次性重写为 Tailwind**

很多团队在迁移时追求"一步到位"，试图在一个迭代内把所有样式文件替换为 Tailwind 工具类。这种做法在大型项目中风险极高——你无法在短时间内验证所有样式的正确性，很可能引入大量视觉回归问题。正确做法是采用"新旧共存"策略：新组件直接使用 Tailwind，旧组件在需要修改时逐步迁移。

**误区二：忽略 Tailwind 的配置，直接使用默认值**

Tailwind 的默认主题是一套通用设计系统，直接使用会导致迁移后的视觉效果与原设计不一致。比如 Tailwind 默认的蓝色是 `#3b82f6`，而你的项目可能使用 `#1890ff`。正确做法是先提取项目的 Design Token，在 `tailwind.config.js` 中覆盖默认值。

**误区三：在 Tailwind 中大量使用 `@apply`**

`@apply` 是过渡工具，不是最终形态。如果一个组件中有大量 `@apply`，说明你只是把 CSS 类名换了个写法。正确做法是将常用的样式组合封装为可复用组件（如 `Button`、`Card`），而不是用 `@apply` 创建新的 CSS 类。

## 小结与练习

### 小结

1. CSS 迁移需要根据项目现状选择策略——单一方案可直接迁移，多方案并存需要分层处理
2. Sass/Less 的变量、嵌套、mixin 可以分别映射到 Tailwind 配置、HTML 结构、组件封装
3. CSS Modules 迁移到 Tailwind 后，局部作用域由组件结构天然保证
4. Design Token 是迁移的基础设施，建立 Token → Tailwind 配置的映射关系
5. 全局样式需要分层处理：base 层、components 层、utilities 层
6. 自动化工具可以加速迁移，但不能替代人工审查

### 练习一：Sass 变量迁移

将以下 Sass 变量和样式迁移到 Tailwind 配置和工具类：

```scss
$success-color: #52c41a;
$warning-color: #faad14;
$error-color: #ff4d4f;

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 14px;
  border: 1px solid #d9d9d9;

  &.status-success {
    color: $success-color;
    background: lighten($success-color, 40%);
    border-color: $success-color;
  }

  &.status-warning {
    color: $warning-color;
    background: lighten($warning-color, 35%);
    border-color: $warning-color;
  }
}
```

### 练习二：CSS Modules 组件迁移

将以下 CSS Modules 组件迁移到 Tailwind：

```css
/* DataTable.module.css */
.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th { background: #fafafa; font-weight: 600; text-align: left; padding: 12px 16px; border-bottom: 2px solid #e5e7eb; }
.table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; }
.table tr:hover td { background: #f9fafb; }
```

---

## 参考答案

### 练习一

**思路**：首先在 `tailwind.config.js` 中定义语义 Token，然后将 Sass 选择器转换为组件中使用的 Tailwind 工具类。`lighten()` 函数需要手动计算对应的浅色值，或者直接使用 Tailwind 内置的颜色调色板。

**答案**：

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        success: { DEFAULT: '#52c41a', 50: '#f6ffed', 500: '#52c41a' },
        warning: { DEFAULT: '#faad14', 50: '#fffbe6', 500: '#faad14' },
        error: { DEFAULT: '#ff4d4f', 50: '#fff2f0', 500: '#ff4d4f' },
      },
    },
  },
};
```

```html
<span class="inline-flex items-center rounded-full border px-3 py-1 text-sm text-success bg-success-50 border-success">
  成功状态
</span>
<span class="inline-flex items-center rounded-full border px-3 py-1 text-sm text-warning bg-warning-50 border-warning">
  警告状态
</span>
```

**要点**：Sass 的 `lighten()` 需要手动计算或使用 Tailwind 内置调色板的 50 色阶；`border-radius: 9999px` 对应 `rounded-full`；语义命名比具体色值更有意义。

### 练习二

**思路**：CSS Modules 的每个类名直接映射到 Tailwind 工具类。表格的 `th`、`td`、`tr:hover` 样式分别对应不同的工具类组合。

**答案**：

```jsx
function DataTable({ columns, rows }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.key} className="border-b-2 border-gray-200 bg-gray-50 px-4 py-3 text-left font-semibold">
              {col.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.id} className="group">
            {columns.map(col => (
              <td key={col.key} className="border-b border-gray-100 px-4 py-3 group-hover:bg-gray-50">
                {row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**要点**：`border-collapse` 是 Tailwind 内置工具类；`group` + `group-hover:` 实现行 hover 效果；如果表格样式会复用，应封装为组件而非提取为 CSS 类。
