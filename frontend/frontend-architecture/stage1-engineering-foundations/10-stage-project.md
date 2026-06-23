# 10. 阶段项目：搭建 Monorepo 项目骨架

> 综合运用本阶段知识，搭建一个完整的 Monorepo 项目

## 本课目标

- 综合运用 Monorepo 相关知识
- 搭建一个完整的项目骨架
- 配置构建、测试、发布流程
- 建立工程化规范

## 项目需求

搭建一个包含以下结构的 Monorepo 项目：

```
my-monorepo/
├── packages/
│   ├── ui/           # 组件库
│   ├── utils/        # 工具函数
│   └── config/       # 配置包
├── apps/
│   ├── docs/         # 文档站点
│   └── playground/   # 演示应用
└── tools/
    └── scripts/      # 构建脚本
```

### 功能要求

1. **组件库（ui）**
   - Button 组件
   - Input 组件
   - 单元测试
   - Storybook 文档

2. **工具函数（utils）**
   - 数学函数
   - 字符串函数
   - 单元测试

3. **配置包（config）**
   - ESLint 配置
   - Prettier 配置
   - TypeScript 配置

4. **文档站点（docs）**
   - 使用 VitePress
   - 展示组件库文档

5. **演示应用（playground）**
   - 使用 React
   - 演示组件库使用

## 实现步骤

### 第一步：初始化项目

```bash
# 创建项目目录
mkdir my-monorepo
cd my-monorepo

# 初始化 package.json
pnpm init

# 创建目录结构
mkdir -p packages/ui
mkdir -p packages/utils
mkdir -p packages/config
mkdir -p apps/docs
mkdir -p apps/playground
mkdir -p tools/scripts
```

### 第二步：配置 pnpm workspace

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
```

```ini
# .npmrc
shamefully-hoist=false
strict-peer-dependencies=true
```

### 第三步：配置根目录 package.json

```json
{
  "name": "@myorg/monorepo",
  "private": true,
  "packageManager": "pnpm@8.6.0",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "scripts": {
    "prepare": "husky install",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev",
    "clean": "turbo run clean",
    "changeset": "changeset",
    "version": "changeset version",
    "publish": "changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.26.0",
    "@commitlint/cli": "^17.0.0",
    "@commitlint/config-conventional": "^17.0.0",
    "husky": "^8.0.0",
    "lint-staged": "^13.0.0",
    "turbo": "^1.10.0",
    "typescript": "^5.0.0"
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

### 第四步：配置 Turborepo

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx"],
      "outputMode": "full"
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**/*.ts", "test/**/*.ts"],
      "outputMode": "errors-only"
    },
    "lint": {
      "outputs": [],
      "outputMode": "full"
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 第五步：配置 Git Hooks

```bash
# 安装 husky
npx husky install

# 添加 pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"

# 添加 commit-msg hook
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'perf',
        'ci',
        'revert',
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
};
```

### 第六步：配置 changesets

```bash
pnpm changeset init
```

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@myorg/docs", "@myorg/playground"]
}
```

### 第七步：创建配置包

```json
// packages/config/package.json
{
  "name": "@myorg/config",
  "version": "1.0.0",
  "main": "./src/index.js",
  "files": [
    "src"
  ]
}
```

```javascript
// packages/config/src/eslint.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
```

```javascript
// packages/config/src/prettier.js
module.exports = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
};
```

```json
// packages/config/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 第八步：创建工具函数库

```json
// packages/utils/package.json
{
  "name": "@myorg/utils",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "@myorg/config": "workspace:*",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

```typescript
// packages/utils/src/math.ts
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}
```

```typescript
// packages/utils/src/string.ts
export function toUpperCase(str: string): string {
  return str.toUpperCase();
}

export function toLowerCase(str: string): string {
  return str.toLowerCase();
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
```

```typescript
// packages/utils/src/index.ts
export * from './math';
export * from './string';
```

```javascript
// packages/utils/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
};
```

```typescript
// packages/utils/src/math.test.ts
import { add, subtract, multiply, divide } from './math';

describe('math', () => {
  test('add', () => {
    expect(add(1, 2)).toBe(3);
  });

  test('subtract', () => {
    expect(subtract(5, 3)).toBe(2);
  });

  test('multiply', () => {
    expect(multiply(2, 3)).toBe(6);
  });

  test('divide', () => {
    expect(divide(6, 2)).toBe(3);
  });

  test('divide by zero', () => {
    expect(() => divide(1, 0)).toThrow('Division by zero');
  });
});
```

### 第九步：创建组件库

```json
// packages/ui/package.json
{
  "name": "@myorg/ui",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src --ext .ts,.tsx",
    "clean": "rm -rf dist",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "dependencies": {
    "@myorg/utils": "workspace:*"
  },
  "devDependencies": {
    "@myorg/config": "workspace:*",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "@storybook/react": "^7.0.0",
    "@storybook/react-vite": "^7.0.0",
    "@storybook/addon-essentials": "^7.0.0"
  },
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0"
  }
}
```

```typescript
// packages/ui/src/Button.tsx
import React from 'react';

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
}) => {
  const baseStyles = 'px-4 py-2 rounded font-medium transition-colors';
  const variantStyles = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };
  const sizeStyles = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
```

```typescript
// packages/ui/src/index.ts
export * from './Button';
```

```javascript
// packages/ui/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.tsx'],
};
```

```typescript
// packages/ui/src/Button.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  test('renders correctly', () => {
    const { getByText } = render(<Button>Click me</Button>);
    expect(getByText('Click me')).toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const onClick = jest.fn();
    const { getByText } = render(<Button onClick={onClick}>Click me</Button>);
    fireEvent.click(getByText('Click me'));
    expect(onClick).toHaveBeenCalled();
  });

  test('is disabled when disabled prop is true', () => {
    const onClick = jest.fn();
    const { getByText } = render(
      <Button onClick={onClick} disabled>
        Click me
      </Button>
    );
    fireEvent.click(getByText('Click me'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

### 第十步：创建演示应用

```json
// apps/playground/package.json
{
  "name": "@myorg/playground",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/utils": "workspace:*",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@myorg/config": "workspace:*",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.0.0"
  }
}
```

```typescript
// apps/playground/src/App.tsx
import React from 'react';
import { Button } from '@myorg/ui';
import { add, toUpperCase } from '@myorg/utils';

function App() {
  const result = add(1, 2);
  const text = toUpperCase('hello');

  return (
    <div>
      <h1>Playground</h1>
      <p>1 + 2 = {result}</p>
      <p>"hello" = {text}</p>
      <Button variant="primary" size="medium">
        Click me
      </Button>
    </div>
  );
}

export default App;
```

```typescript
// apps/playground/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### 第十一步：创建检查脚本

```javascript
// tools/scripts/check.js
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 Checking project structure...\n');

// 检查必要文件
const requiredFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  '.npmrc',
  '.editorconfig',
  '.nvmrc',
  'commitlint.config.js',
];

requiredFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    console.log(`✓ ${file} exists`);
  } else {
    console.error(`✗ ${file} not found`);
    process.exit(1);
  }
});

// 检查必要目录
const requiredDirs = [
  'packages/utils',
  'packages/ui',
  'packages/config',
  'apps/playground',
];

requiredDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    console.log(`✓ ${dir} exists`);
  } else {
    console.error(`✗ ${dir} not found`);
    process.exit(1);
  }
});

// 检查 package.json 配置
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

if (packageJson.packageManager) {
  console.log(`✓ packageManager: ${packageJson.packageManager}`);
} else {
  console.error('✗ packageManager not configured');
  process.exit(1);
}

if (packageJson.engines) {
  console.log(`✓ engines configured`);
} else {
  console.error('✗ engines not configured');
  process.exit(1);
}

console.log('\n✅ All checks passed!');
```

```json
// 根目录 package.json 添加脚本
{
  "scripts": {
    "check": "node tools/scripts/check.js"
  }
}
```

## 验收标准

### 1. 项目结构

```bash
pnpm check

# 输出：
# ✓ package.json exists
# ✓ pnpm-workspace.yaml exists
# ✓ turbo.json exists
# ✓ .npmrc exists
# ✓ .editorconfig exists
# ✓ .nvmrc exists
# ✓ commitlint.config.js exists
# ✓ packages/utils exists
# ✓ packages/ui exists
# ✓ packages/config exists
# ✓ apps/playground exists
# ✓ packageManager: pnpm@8.6.0
# ✓ engines configured
# 
# ✅ All checks passed!
```

### 2. 构建验证

```bash
pnpm build

# 输出：
# @myorg/utils:build: ✓
# @myorg/ui:build: ✓
# @myorg/playground:build: ✓
```

### 3. 测试验证

```bash
pnpm test

# 输出：
# @myorg/utils:test: ✓
# @myorg/ui:test: ✓
```

### 4. 代码检查

```bash
pnpm lint

# 输出：
# @myorg/utils:lint: ✓
# @myorg/ui:lint: ✓
# @myorg/playground:lint: ✓
```

## 常见问题

### Q: 如何添加新的包？

A: 在 `packages/` 或 `apps/` 目录下创建新目录，配置 `package.json`，使用 `workspace:*` 引用其他包。

### Q: 如何发布包？

A: 使用 `pnpm changeset` 添加变更，`pnpm changeset version` 更新版本，`pnpm changeset publish` 发布。

### Q: 如何调试构建问题？

A: 使用 `turbo run build --graph` 查看依赖关系，使用 `turbo run build --filter=@myorg/utils` 单独构建。

## 本课小结

本课我们综合运用 Monorepo 相关知识，搭建了一个完整的项目骨架：

1. **项目结构**：packages、apps、tools 目录
2. **构建工具**：Turborepo 构建编排
3. **代码规范**：ESLint、Prettier、commitlint
4. **版本管理**：changesets 版本发布
5. **质量保证**：单元测试、代码检查

## 下一步

完成本阶段后，继续学习 [stage2：组件库与设计系统](../stage2-component-library/README.md)。
