# 05. 主题系统与 CSS-in-JS 方案选型

> 样式方案选错了不会死，但会在每个组件上反复付出代价

## 本课目标

- 理解主题系统的核心设计
- 掌握 CSS 变量、styled-components、emotion、CSS Modules 的实现方式
- 学会根据项目需求选择合适的方案
- 建立主题切换的工程化方案

## 主题系统设计

### 主题是什么

主题不是"换个颜色"。主题是设计 Token 的一套具体取值。切换主题就是切换整套 Token。

```typescript
// light 主题
const lightTheme = {
  colors: {
    primary: '#1890ff',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#141414',
    textSecondary: '#595959',
    border: '#d9d9d9',
  },
  spacing: { sm: '8px', md: '16px', lg: '24px' },
  borderRadius: '6px',
};

// dark 主题
const darkTheme = {
  colors: {
    primary: '#177ddc',
    background: '#141414',
    surface: '#1f1f1f',
    text: '#ffffffd9',
    textSecondary: '#ffffff73',
    border: '#434343',
  },
  spacing: { sm: '8px', md: '16px', lg: '24px' },
  borderRadius: '6px',
};
```

注意 `spacing` 和 `borderRadius` 在两个主题中是一样的——不是所有 Token 都需要变。只有跟视觉风格相关的 Token（颜色、阴影）才需要主题化。

### 主题的层级结构

```
全局主题（Global Theme）
  └── 组件主题（Component Theme）
       └── 实例覆盖（Instance Override）
```

全局主题通过 Provider 注入，组件主题通过组件级 Token 覆盖，实例覆盖通过 Props 或 className 传入。

## CSS 变量方案

### 原理

CSS 变量是浏览器原生的主题方案，运行时切换，无需 JavaScript 重新计算样式。

```css
:root {
  --color-primary: #1890ff;
  --color-bg: #ffffff;
  --color-text: #141414;
}

[data-theme='dark'] {
  --color-primary: #177ddc;
  --color-bg: #141414;
  --color-text: #ffffffd9;
}
```

切换主题只需修改根元素的 `data-theme` 属性：

```typescript
const toggleTheme = (theme: 'light' | 'dark') => {
  document.documentElement.setAttribute('data-theme', theme);
};
```

### 在组件中使用

```css
/* Button.module.css */
.button {
  background: var(--color-primary);
  color: var(--color-text);
  border-radius: var(--border-radius);
}
```

### 优点

- 零运行时开销：样式计算由浏览器完成，不需要 JavaScript 介入
- 跨框架：React、Vue、Svelte 都能用
- 动态性强：可以在运行时添加新的 CSS 变量
- 调试方便：浏览器 DevTools 直接显示变量值

### 缺点

- IE11 不支持（如果还需要兼容的话）
- 无法在服务端渲染时做样式提取
- Token 之间无法有计算关系（需要用 `calc()`）

### 适合场景

- 需要运行时切换主题
- 对性能要求高（避免 CSS-in-JS 的运行时开销）
- 团队对 CSS 比较熟悉

## styled-components 方案

### 基本用法

```typescript
import styled from 'styled-components';

const StyledButton = styled.button<{ $variant: 'primary' | 'secondary' }>`
  background: ${(props) =>
    props.$variant === 'primary'
      ? props.theme.colors.primary
      : props.theme.colors.secondary};
  color: white;
  padding: ${(props) => props.theme.spacing.md};
  border-radius: ${(props) => props.theme.borderRadius};
  border: none;
  cursor: pointer;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
```

### 主题注入

```typescript
import { ThemeProvider } from 'styled-components';

const App = () => (
  <ThemeProvider theme={lightTheme}>
    <Button variant="primary">Click me</Button>
  </ThemeProvider>
);
```

切换主题只需更换 ThemeProvider 的 theme：

```typescript
const [theme, setTheme] = useState(lightTheme);

<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>
```

### 优点

- 开发体验好：直接写 CSS，支持嵌套、变量、函数
- 自动 vendor prefixing
- SSR 支持完善
- 生态丰富

### 缺点

- 运行时开销：每次渲染都要计算样式
- 包体积：styled-components 本身约 12KB gzipped
- 动态样式会导致大量 class 生成

### 适合场景

- React 项目，团队熟悉 CSS-in-JS
- 需要动态样式（根据 Props 变化）
- 对 SSR 有要求

## emotion 方案

### 基本用法

```typescript
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react';

const buttonStyle = (variant: 'primary' | 'secondary') => css`
  background: ${variant === 'primary' ? '#1890ff' : '#595959'};
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;

const Button = ({ variant = 'primary', children }: ButtonProps) => (
  <button css={buttonStyle(variant)}>{children}</button>
);
```

### styled 语法

```typescript
import styled from '@emotion/styled';

const StyledButton = styled.button<{ variant: 'primary' | 'secondary' }>`
  background: ${(props) =>
    props.variant === 'primary'
      ? props.theme.colors.primary
      : props.theme.colors.secondary};
  color: white;
  padding: 8px 16px;
`;
```

### emotion vs styled-components

| 维度 | emotion | styled-components |
|------|---------|-------------------|
| 包体积 | 更小（~7KB） | 稍大（~12KB） |
| 性能 | 略好 | 略差 |
| API 灵活性 | 更灵活（css prop） | 更固定（styled） |
| 生态 | 较小 | 更大 |
| 框架支持 | React 为主 | React 为主 |

两者差异不大。如果你已经在用 styled-components，没有必要换。如果新项目，emotion 的 css prop 在某些场景下更灵活。

## CSS Modules 方案

### 基本用法

```typescript
// Button.module.css
.button {
  background: var(--color-primary);
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.button--secondary {
  background: var(--color-secondary);
}

.button--large {
  padding: 12px 24px;
  font-size: 16px;
}
```

```typescript
// Button.tsx
import styles from './Button.module.css';
import clsx from 'clsx';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'medium' | 'large';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  children,
}) => {
  return (
    <button
      className={clsx(
        styles.button,
        variant === 'secondary' && styles['button--secondary'],
        size === 'large' && styles['button--large']
      )}
    >
      {children}
    </button>
  );
};
```

### 与 CSS 变量结合

CSS Modules + CSS 变量是一个被低估的组合：

```css
/* theme.css */
:root {
  --button-bg: var(--color-primary);
  --button-color: white;
  --button-padding: 8px 16px;
}

[data-theme='dark'] {
  --button-bg: var(--color-primary-dark);
}
```

```css
/* Button.module.css */
.button {
  background: var(--button-bg);
  color: var(--button-color);
  padding: var(--button-padding);
}
```

这样 CSS Modules 负责组件结构样式，CSS 变量负责主题化，职责清晰。

### 优点

- 零运行时：样式在构建时处理
- 原生 CSS：学习成本低
- 作用域隔离：自动生成唯一类名
- 兼容性好：所有构建工具都支持

### 缺点

- 动态样式不灵活：需要手动切换类名
- 没有嵌套（除非配合 PostCSS 插件）
- 主题化需要额外方案（CSS 变量或构建时替换）

### 适合场景

- 不需要复杂的动态样式
- 团队偏好原生 CSS
- 对性能和包体积敏感
- 与其他 CSS 工具链（PostCSS、Tailwind）配合

## 方案对比

| 维度 | CSS 变量 | styled-components | emotion | CSS Modules |
|------|----------|-------------------|---------|-------------|
| 运行时开销 | 无 | 有 | 有 | 无 |
| 包体积影响 | 无 | ~12KB | ~7KB | 无 |
| 动态样式 | 弱 | 强 | 强 | 弱 |
| 学习成本 | 低 | 中 | 中 | 低 |
| 主题切换 | 原生支持 | 需要 Provider | 需要 Provider | 需要 CSS 变量 |
| SSR 支持 | 需要手动处理 | 完善 | 完善 | 完善 |
| TypeScript | 类型弱 | 类型强 | 类型强 | 类型弱 |

## 实战：实现一个主题系统

### 方案选择：CSS 变量 + Context

这个方案零运行时样式开销，同时通过 React Context 提供类型安全的主题访问。

### 步骤一：定义 Token 类型

```typescript
// types/theme.ts
export interface ThemeTokens {
  colors: {
    primary: string;
    primaryHover: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: string;
  fontFamily: string;
  fontSize: {
    sm: string;
    base: string;
    lg: string;
  };
}
```

### 步骤二：定义主题

```typescript
// themes/light.ts
import { ThemeTokens } from '../types/theme';

export const lightTheme: ThemeTokens = {
  colors: {
    primary: '#1890ff',
    primaryHover: '#40a9ff',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: '#141414',
    textSecondary: '#595959',
    border: '#d9d9d9',
    error: '#ff4d4f',
    success: '#52c41a',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: '6px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: {
    sm: '14px',
    base: '16px',
    lg: '18px',
  },
};
```

### 步骤三：将 Token 转为 CSS 变量

```typescript
// utils/token-to-css.ts
import { ThemeTokens } from '../types/theme';

function flattenTokens(
  obj: Record<string, any>,
  prefix = ''
): Record<string, string> {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const cssVar = prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'object' && value !== null) {
      Object.assign(acc, flattenTokens(value, cssVar));
    } else {
      acc[`--${cssVar}`] = value;
    }
    return acc;
  }, {} as Record<string, string>);
}

export function tokensToCssVars(theme: ThemeTokens): Record<string, string> {
  return flattenTokens(theme);
}
```

### 步骤四：创建 ThemeProvider

```typescript
// ThemeProvider.tsx
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { ThemeTokens } from './types/theme';
import { tokensToCssVars } from './utils/token-to-css';

const ThemeContext = createContext<ThemeTokens | null>(null);

interface ThemeProviderProps {
  theme: ThemeTokens;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  theme,
  children,
}) => {
  useEffect(() => {
    const cssVars = tokensToCssVars(theme);
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    return () => {
      Object.keys(cssVars).forEach((key) => {
        root.style.removeProperty(key);
      });
    };
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export function useTheme(): ThemeTokens {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return theme;
}
```

### 步骤五：在组件中使用

```css
/* Button.module.css */
.button {
  font-family: var(--fontFamily);
  font-size: var(--fontSize-base);
  border-radius: var(--borderRadius);
  border: 1px solid var(--colors-border);
  cursor: pointer;
}

.primary {
  background: var(--colors-primary);
  color: white;
}

.primary:hover {
  background: var(--colors-primaryHover);
}
```

```typescript
// Button.tsx
import styles from './Button.module.css';
import { useTheme } from './ThemeProvider';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  ...props
}) => {
  // useTheme 在这里提供 TypeScript 类型支持
  // 实际样式通过 CSS 变量生效
  const theme = useTheme();

  return (
    <button
      className={`${styles.button} ${styles[variant]}`}
      {...props}
    >
      {children}
    </button>
  );
};
```

### 步骤六：切换主题

```typescript
// App.tsx
import { useState } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { lightTheme } from './themes/light';
import { darkTheme } from './themes/dark';

const App = () => {
  const [theme, setTheme] = useState(lightTheme);

  const toggleTheme = () => {
    setTheme((prev) => (prev === lightTheme ? darkTheme : lightTheme));
  };

  return (
    <ThemeProvider theme={theme}>
      <button onClick={toggleTheme}>切换主题</button>
      <Button variant="primary">Click me</Button>
    </ThemeProvider>
  );
};
```

## 常见误区

### 误区一：所有样式都要主题化

间距、字体大小这些跟品牌无关的 Token，通常不需要随主题变化。只主题化颜色、阴影这类视觉属性。

### 误区二：CSS-in-JS 一定比 CSS 慢

在大多数应用中，CSS-in-JS 的运行时开销可以忽略不计。除非你在做每秒 60 帧的动画或者渲染上千行表格，否则性能差异不会成为瓶颈。

### 误区三：主题切换必须即时生效

如果主题是在用户设置中选择的，切换时短暂闪烁（FOUC）是可接受的。把主题偏好存到 localStorage，下次加载时直接应用，比运行时切换更重要。

## 本课小结

1. **主题是 Token 的一套取值**，不是简单的颜色切换
2. **CSS 变量**是最轻量的方案，零运行时，适合大多数场景
3. **styled-components / emotion** 提供更好的开发体验，但有运行时开销
4. **CSS Modules + CSS 变量**是被低估的组合，兼顾性能和主题化
5. **方案选择取决于项目需求**，没有绝对最优

## 练习

### 练习一：实现 dark 主题

基于本课的 ThemeProvider 实现，创建一个 dark 主题，并实现主题切换功能。

### 练习二：组件级主题覆盖

设计一个机制，让单个组件可以覆盖全局主题。例如，某个 Button 使用特殊的颜色，而不影响其他组件。

## 参考答案

### 练习一

```typescript
// themes/dark.ts
import { ThemeTokens } from '../types/theme';

export const darkTheme: ThemeTokens = {
  colors: {
    primary: '#177ddc',
    primaryHover: '#1890ff',
    background: '#141414',
    surface: '#1f1f1f',
    text: '#ffffffd9',
    textSecondary: '#ffffff73',
    border: '#434343',
    error: '#ff4d4f',
    success: '#52c41a',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: '6px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: {
    sm: '14px',
    base: '16px',
    lg: '18px',
  },
};
```

### 练习二

```typescript
// 在组件 Props 中支持 theme override
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  themeOverride?: Partial<ThemeTokens['colors']>;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  themeOverride,
  children,
}) => {
  const style = themeOverride
    ? Object.entries(themeOverride).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [`--colors-${key}`]: value,
        }),
        {}
      )
    : undefined;

  return (
    <button
      className={`${styles.button} ${styles[variant]}`}
      style={style as React.CSSProperties}
    >
      {children}
    </button>
  );
};

// 使用：这个 Button 的 primary 颜色是紫色，不影响其他组件
<Button variant="primary" themeOverride={{ primary: '#722ed1' }}>
  Purple Button
</Button>
```

## 下一步

完成本课后，继续学习 [06. 组件文档与 Storybook 实践](./06-storybook.md)。
