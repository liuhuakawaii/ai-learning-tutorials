# 02. Design Token 体系设计

> 颜色、字体、间距、阴影等 Token 设计，建立设计系统的基础

## 本课目标

- 理解 Design Token 的核心概念
- 掌握 Token 的设计原则
- 学会设计颜色、字体、间距等 Token 体系
- 建立 Token 的管理和维护机制

## 什么是 Design Token

### Design Token 的定义

Design Token 是**设计决策的抽象表示**，它将设计系统中的基础元素（颜色、字体、间距等）转化为可复用的变量。

**Design Token 的特点**：
1. **原子性**：最小的设计单元
2. **可复用性**：可以在不同场景下复用
3. **一致性**：确保设计的一致性
4. **可维护性**：易于维护和更新

### Design Token 的层次

```
Global Token → Alias Token → Component Token
```

**Global Token**：最基础的 Token，直接定义设计决策
```typescript
const globalTokens = {
  blue500: '#1890ff',
  gray100: '#f5f5f5',
  fontSize14: '14px',
  spacing8: '8px',
};
```

**Alias Token**：为 Global Token 提供语义化名称
```typescript
const aliasTokens = {
  colorPrimary: globalTokens.blue500,
  colorBackground: globalTokens.gray100,
  fontSizeBody: globalTokens.fontSize14,
  spacingSmall: globalTokens.spacing8,
};
```

**Component Token**：为特定组件定义 Token
```typescript
const buttonTokens = {
  buttonBackground: aliasTokens.colorPrimary,
  buttonFontSize: aliasTokens.fontSizeBody,
  buttonPadding: aliasTokens.spacingSmall,
};
```

## Design Token 的类型

### 1. 颜色 Token

**基础颜色**：
```typescript
const colors = {
  // 主色
  blue50: '#e6f7ff',
  blue100: '#bae7ff',
  blue200: '#91d5ff',
  blue300: '#69c0ff',
  blue400: '#40a9ff',
  blue500: '#1890ff',
  blue600: '#096dd9',
  blue700: '#0050b3',
  blue800: '#003a8c',
  blue900: '#002766',
  
  // 中性色
  gray50: '#fafafa',
  gray100: '#f5f5f5',
  gray200: '#e8e8e8',
  gray300: '#d9d9d9',
  gray400: '#bfbfbf',
  gray500: '#8c8c8c',
  gray600: '#595959',
  gray700: '#434343',
  gray800: '#262626',
  gray900: '#141414',
  
  // 语义色
  red500: '#ff4d4f',
  green500: '#52c41a',
  yellow500: '#faad14',
  orange500: '#fa8c16',
};
```

**语义化颜色**：
```typescript
const semanticColors = {
  // 品牌色
  colorPrimary: colors.blue500,
  colorPrimaryHover: colors.blue400,
  colorPrimaryActive: colors.blue600,
  
  // 功能色
  colorSuccess: colors.green500,
  colorWarning: colors.yellow500,
  colorError: colors.red500,
  colorInfo: colors.blue500,
  
  // 文本色
  colorText: colors.gray900,
  colorTextSecondary: colors.gray600,
  colorTextDisabled: colors.gray400,
  
  // 背景色
  colorBg: colors.gray50,
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  
  // 边框色
  colorBorder: colors.gray300,
  colorBorderSecondary: colors.gray200,
};
```

### 2. 字体 Token

**字体家族**：
```typescript
const fontFamily = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
};
```

**字体大小**：
```typescript
const fontSize = {
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '38px',
  '5xl': '48px',
};
```

**行高**：
```typescript
const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
};
```

**字重**：
```typescript
const fontWeight = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};
```

### 3. 间距 Token

**基础间距**：
```typescript
const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
};
```

**语义化间距**：
```typescript
const semanticSpacing = {
  spacingXs: spacing[1],    // 4px
  spacingSm: spacing[2],    // 8px
  spacingMd: spacing[4],    // 16px
  spacingLg: spacing[6],    // 24px
  spacingXl: spacing[8],    // 32px
  spacing2xl: spacing[12],  // 48px
};
```

### 4. 阴影 Token

**基础阴影**：
```typescript
const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
};
```

**语义化阴影**：
```typescript
const semanticShadows = {
  shadowSm: shadows.sm,
  shadow: shadows.base,
  shadowMd: shadows.md,
  shadowLg: shadows.lg,
  shadowXl: shadows.xl,
};
```

### 5. 圆角 Token

**基础圆角**：
```typescript
const borderRadius = {
  none: '0px',
  sm: '2px',
  base: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  full: '9999px',
};
```

**语义化圆角**：
```typescript
const semanticBorderRadius = {
  borderRadiusSm: borderRadius.sm,
  borderRadius: borderRadius.base,
  borderRadiusMd: borderRadius.md,
  borderRadiusLg: borderRadius.lg,
  borderRadiusXl: borderRadius.xl,
};
```

### 6. 边框 Token

**基础边框**：
```typescript
const borderWidth = {
  0: '0px',
  1: '1px',
  2: '2px',
  4: '4px',
  8: '8px',
};
```

**语义化边框**：
```typescript
const semanticBorder = {
  borderWidth: borderWidth[1],
  borderWidthSm: borderWidth[0],
  borderWidthLg: borderWidth[2],
};
```

## Design Token 的设计原则

### 1. 原子性原则

Token 应该是最小的设计单元，不应该包含业务逻辑。

**正确示例**：
```typescript
const tokens = {
  colorPrimary: '#1890ff',
  fontSizeBase: '14px',
  spacingMd: '16px',
};
```

**错误示例**：
```typescript
const tokens = {
  buttonColor: '#1890ff',  // 包含业务逻辑
  inputFontSize: '14px',   // 包含业务逻辑
};
```

### 2. 语义化原则

Token 应该有清晰的语义，便于理解和使用。

**正确示例**：
```typescript
const tokens = {
  colorPrimary: '#1890ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
};
```

**错误示例**：
```typescript
const tokens = {
  color1: '#1890ff',
  color2: '#52c41a',
  color3: '#faad14',
};
```

### 3. 一致性原则

Token 应该在整个系统中保持一致。

**正确示例**：
```typescript
const tokens = {
  spacingSm: '8px',
  spacingMd: '16px',
  spacingLg: '24px',
};
```

**错误示例**：
```typescript
const tokens = {
  spacingSm: '8px',
  spacingMd: '15px',  // 不一致
  spacingLg: '24px',
};
```

### 4. 可扩展原则

Token 应该易于扩展，支持新的设计需求。

**正确示例**：
```typescript
const tokens = {
  colorPrimary: '#1890ff',
  colorPrimaryHover: '#40a9ff',
  colorPrimaryActive: '#096dd9',
};
```

**错误示例**：
```typescript
const tokens = {
  colorPrimary: '#1890ff',
  // 缺少 hover 和 active 状态
};
```

## Design Token 的实现

### TypeScript 实现

```typescript
// tokens/colors.ts
export const colors = {
  blue50: '#e6f7ff',
  blue100: '#bae7ff',
  blue200: '#91d5ff',
  blue300: '#69c0ff',
  blue400: '#40a9ff',
  blue500: '#1890ff',
  blue600: '#096dd9',
  blue700: '#0050b3',
  blue800: '#003a8c',
  blue900: '#002766',
};

// tokens/semantic.ts
export const semanticColors = {
  colorPrimary: colors.blue500,
  colorPrimaryHover: colors.blue400,
  colorPrimaryActive: colors.blue600,
};

// tokens/index.ts
export const tokens = {
  colors: semanticColors,
  // ... 其他 Token
};
```

### CSS 变量实现

```css
:root {
  /* 颜色 */
  --color-primary: #1890ff;
  --color-primary-hover: #40a9ff;
  --color-primary-active: #096dd9;
  
  /* 字体 */
  --font-family-sans: -apple-system, BlinkMacSystemFont, sans-serif;
  --font-size-base: 14px;
  
  /* 间距 */
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* 阴影 */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  
  /* 圆角 */
  --border-radius: 4px;
  --border-radius-lg: 8px;
}
```

### JSON 实现

```json
{
  "color": {
    "primary": {
      "value": "#1890ff",
      "type": "color"
    },
    "primary-hover": {
      "value": "#40a9ff",
      "type": "color"
    }
  },
  "font": {
    "size": {
      "base": {
        "value": "14px",
        "type": "fontSizes"
      }
    }
  },
  "spacing": {
    "sm": {
      "value": "8px",
      "type": "spacing"
    }
  }
}
```

## Design Token 的管理

### Token 管理工具

1. **Style Dictionary**：Amazon 开源的 Token 管理工具
2. **Theo**：Salesforce 开源的 Token 管理工具
3. **Token Studio**：Figma 插件，用于管理 Token

### Style Dictionary 示例

```javascript
// config.js
module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/css/',
      files: [
        {
          destination: 'variables.css',
          format: 'css/variables',
        },
      ],
    },
    js: {
      transformGroup: 'js',
      buildPath: 'build/js/',
      files: [
        {
          destination: 'tokens.js',
          format: 'javascript/module',
        },
      ],
    },
  },
};
```

### Token 的版本管理

```json
{
  "name": "@myorg/tokens",
  "version": "1.0.0",
  "main": "./dist/tokens.js",
  "types": "./dist/tokens.d.ts",
  "files": [
    "dist"
  ]
}
```

## 实战：设计 Token 体系

### 项目结构

```
packages/tokens/
├── src/
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   ├── shadows.ts
│   ├── borders.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### 颜色 Token

```typescript
// src/colors.ts
export const colors = {
  // 主色
  blue50: '#e6f7ff',
  blue100: '#bae7ff',
  blue200: '#91d5ff',
  blue300: '#69c0ff',
  blue400: '#40a9ff',
  blue500: '#1890ff',
  blue600: '#096dd9',
  blue700: '#0050b3',
  blue800: '#003a8c',
  blue900: '#002766',
  
  // 中性色
  gray50: '#fafafa',
  gray100: '#f5f5f5',
  gray200: '#e8e8e8',
  gray300: '#d9d9d9',
  gray400: '#bfbfbf',
  gray500: '#8c8c8c',
  gray600: '#595959',
  gray700: '#434343',
  gray800: '#262626',
  gray900: '#141414',
  
  // 功能色
  red500: '#ff4d4f',
  green500: '#52c41a',
  yellow500: '#faad14',
  orange500: '#fa8c16',
};

export const semanticColors = {
  // 品牌色
  colorPrimary: colors.blue500,
  colorPrimaryHover: colors.blue400,
  colorPrimaryActive: colors.blue600,
  colorPrimaryBg: colors.blue50,
  
  // 功能色
  colorSuccess: colors.green500,
  colorSuccessBg: '#f6ffed',
  colorWarning: colors.yellow500,
  colorWarningBg: '#fffbe6',
  colorError: colors.red500,
  colorErrorBg: '#fff2f0',
  colorInfo: colors.blue500,
  colorInfoBg: colors.blue50,
  
  // 文本色
  colorText: colors.gray900,
  colorTextSecondary: colors.gray600,
  colorTextTertiary: colors.gray400,
  colorTextDisabled: colors.gray300,
  
  // 背景色
  colorBg: colors.gray50,
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBgLayout: colors.gray50,
  
  // 边框色
  colorBorder: colors.gray300,
  colorBorderSecondary: colors.gray200,
};
```

### 字体 Token

```typescript
// src/typography.ts
export const fontFamily = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
};

export const fontSize = {
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '38px',
  '5xl': '48px',
};

export const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
};

export const fontWeight = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

export const semanticTypography = {
  fontFamily: fontFamily.sans,
  fontSize: fontSize.base,
  fontSizeSm: fontSize.sm,
  fontSizeLg: fontSize.lg,
  fontSizeH1: fontSize['4xl'],
  fontSizeH2: fontSize['3xl'],
  fontSizeH3: fontSize['2xl'],
  lineHeight: lineHeight.normal,
  fontWeight: fontWeight.normal,
  fontWeightMedium: fontWeight.medium,
  fontWeightSemibold: fontWeight.semibold,
  fontWeightBold: fontWeight.bold,
};
```

### 间距 Token

```typescript
// src/spacing.ts
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
};

export const semanticSpacing = {
  spacingXs: spacing[1],
  spacingSm: spacing[2],
  spacingMd: spacing[4],
  spacingLg: spacing[6],
  spacingXl: spacing[8],
  spacing2xl: spacing[12],
};
```

### 导出 Token

```typescript
// src/index.ts
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './shadows';
export * from './borders';

export const tokens = {
  colors: semanticColors,
  typography: semanticTypography,
  spacing: semanticSpacing,
  // ... 其他 Token
};
```

## 常见问题

### Q: Design Token 和 CSS 变量有什么区别？

A: Design Token 是设计决策的抽象，CSS 变量是实现方式。Design Token 可以用 CSS 变量、TypeScript 变量等多种方式实现。

### Q: 如何管理 Design Token？

A: 使用 Style Dictionary、Theo 等工具管理 Token，支持多平台输出。

### Q: 如何处理主题切换？

A: 使用 CSS 变量或 TypeScript 变量，通过切换 Token 实现主题切换。

## 本课小结

本课我们掌握了 Design Token 体系设计：

1. **Design Token 的定义**：设计决策的抽象表示
2. **Token 的层次**：Global Token → Alias Token → Component Token
3. **Token 的类型**：颜色、字体、间距、阴影、圆角、边框
4. **Token 的设计原则**：原子性、语义化、一致性、可扩展
5. **Token 的实现**：TypeScript、CSS 变量、JSON

## 练习

### 练习一：设计颜色 Token

为一个项目设计颜色 Token，包括：
- 基础颜色（主色、中性色、功能色）
- 语义化颜色（品牌色、功能色、文本色、背景色、边框色）

### 练习二：设计完整的 Token 体系

为一个项目设计完整的 Token 体系，包括：
- 颜色 Token
- 字体 Token
- 间距 Token
- 阴影 Token
- 圆角 Token
- 边框 Token

## 参考答案

### 练习一

**颜色 Token 设计**：
```typescript
const colors = {
  // 基础颜色
  blue500: '#1890ff',
  gray100: '#f5f5f5',
  red500: '#ff4d4f',
  green500: '#52c41a',
  
  // 语义化颜色
  colorPrimary: colors.blue500,
  colorSuccess: colors.green500,
  colorError: colors.red500,
  colorText: colors.gray900,
  colorBg: colors.gray50,
};
```

### 练习二

**完整的 Token 体系**：
```typescript
const tokens = {
  colors: semanticColors,
  typography: semanticTypography,
  spacing: semanticSpacing,
  shadows: semanticShadows,
  borders: semanticBorders,
};
```

## 下一步

完成本课后，继续学习 [03. 组件库架构设计](./03-component-architecture.md)。
