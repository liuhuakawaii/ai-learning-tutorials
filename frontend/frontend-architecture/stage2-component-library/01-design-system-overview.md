# 01. 设计系统不是 UI Kit

> 从 Token 到组件的心智模型，理解设计系统的本质

## 本课目标

- 理解设计系统的核心概念和价值
- 区分设计系统和 UI Kit
- 建立设计系统的心智模型
- 了解设计系统的组成部分

## 什么是设计系统

### 设计系统的定义

设计系统是一个**完整的、可复用的设计规范和组件库**，用于确保产品设计的一致性和效率。

**设计系统的组成部分**：
1. **Design Token**：设计决策的抽象（颜色、字体、间距等）
2. **组件库**：可复用的 UI 组件
3. **设计模式**：常见问题的解决方案
4. **文档**：使用指南和最佳实践
5. **工具**：开发和设计工具

### 设计系统 vs UI Kit

| 维度 | 设计系统 | UI Kit |
|------|----------|--------|
| 范围 | 完整的设计规范 | 组件集合 |
| Token | 包含 | 不包含 |
| 模式 | 包含 | 不包含 |
| 文档 | 完整文档 | 基本文档 |
| 工具 | 包含 | 不包含 |
| 维护 | 持续维护 | 偶尔更新 |

**UI Kit 的问题**：
1. 缺乏设计规范
2. 组件风格不一致
3. 难以扩展和维护
4. 文档不完整

**设计系统的优势**：
1. 统一的设计语言
2. 组件风格一致
3. 易于扩展和维护
4. 完整的文档和工具

## 设计系统的核心价值

### 1. 提高设计效率

**问题**：设计师每次都要从零开始设计

**解决方案**：
- 提供设计规范和组件库
- 设计师可以快速组合组件
- 减少重复设计工作

### 2. 保证设计一致性

**问题**：不同设计师设计风格不一致

**解决方案**：
- 统一的设计语言
- 统一的 Token 体系
- 统一的组件规范

### 3. 提高开发效率

**问题**：开发者每次都要从零实现组件

**解决方案**：
- 提供可复用的组件库
- 减少重复开发工作
- 提高代码质量

### 4. 降低沟通成本

**问题**：设计师和开发者沟通困难

**解决方案**：
- 统一的设计语言
- 统一的组件规范
- 完整的文档

### 5. 提高产品质量

**问题**：产品质量参差不齐

**解决方案**：
- 统一的设计规范
- 统一的组件实现
- 统一的测试策略

## 设计系统的组成部分

### 1. Design Token

Design Token 是设计系统的基础，它将设计决策抽象为可复用的变量。

**Token 的类型**：
- **颜色**：主色、辅色、中性色、语义色
- **字体**：字体家族、字体大小、行高、字重
- **间距**：内边距、外边距、间距
- **阴影**：阴影大小、阴影颜色
- **圆角**：圆角大小
- **边框**：边框宽度、边框颜色

**Token 的层次**：
```
Global Token → Alias Token → Component Token
```

**示例**：
```typescript
// Global Token
const globalTokens = {
  blue500: '#1890ff',
  gray100: '#f5f5f5',
  fontSize14: '14px',
  spacing8: '8px',
};

// Alias Token
const aliasTokens = {
  colorPrimary: globalTokens.blue500,
  colorBackground: globalTokens.gray100,
  fontSizeBody: globalTokens.fontSize14,
  spacingSmall: globalTokens.spacing8,
};

// Component Token
const buttonTokens = {
  buttonBackground: aliasTokens.colorPrimary,
  buttonFontSize: aliasTokens.fontSizeBody,
  buttonPadding: aliasTokens.spacingSmall,
};
```

### 2. 组件库

组件库是设计系统的核心，它提供了可复用的 UI 组件。

**组件的类型**：
- **基础组件**：Button、Input、Typography
- **布局组件**：Grid、Flex、Space
- **导航组件**：Menu、Breadcrumb、Pagination
- **数据展示**：Table、List、Card
- **数据输入**：Form、Select、DatePicker
- **反馈组件**：Modal、Toast、Alert
- **其他**：Icon、Avatar、Badge

**组件的设计原则**：
1. **可复用**：组件应该可以在不同场景下复用
2. **可扩展**：组件应该易于扩展和定制
3. **可访问**：组件应该支持无障碍访问
4. **可测试**：组件应该易于测试

### 3. 设计模式

设计模式是常见问题的解决方案。

**常见的设计模式**：
- **表单模式**：表单验证、表单布局
- **表格模式**：表格排序、表格筛选
- **导航模式**：面包屑、标签页
- **反馈模式**：加载状态、错误处理
- **空状态模式**：无数据、无结果

**示例**：
```typescript
// 表单模式
const formPattern = {
  layout: 'horizontal',
  labelCol: { span: 6 },
  wrapperCol: { span: 18 },
  validateTrigger: 'onBlur',
};
```

### 4. 文档

文档是设计系统的重要组成部分。

**文档的类型**：
- **设计规范**：设计原则、Token 规范
- **组件文档**：组件 API、使用示例
- **设计模式**：常见问题的解决方案
- **最佳实践**：开发和设计的最佳实践

**文档的工具**：
- **Storybook**：交互式组件文档
- **Docusaurus**：静态文档站点
- **VitePress**：Vue 驱动的文档站点

### 5. 工具

工具是设计系统的辅助部分。

**工具的类型**：
- **设计工具**：Figma、Sketch
- **开发工具**：CLI、脚手架
- **测试工具**：单元测试、视觉回归测试
- **发布工具**：版本管理、自动发布

## 设计系统的架构

### 分层架构

```
Design Token
    ↓
基础组件
    ↓
复合组件
    ↓
页面模板
```

**各层的职责**：
1. **Design Token**：设计决策的抽象
2. **基础组件**：最小可复用单元
3. **复合组件**：多个基础组件的组合
4. **页面模板**：完整页面的模板

### 组件架构

```
组件
├── Props：组件的属性
├── State：组件的状态
├── Context：组件的上下文
├── Ref：组件的引用
└── Children：组件的子元素
```

**组件的设计原则**：
1. **单一职责**：一个组件只做一件事
2. **开闭原则**：对扩展开放，对修改关闭
3. **依赖倒置**：依赖抽象，不依赖具体实现
4. **接口隔离**：接口应该小而专一

## 实战：分析优秀设计系统

### Ant Design

**特点**：
- 完整的 Token 体系
- 丰富的组件库
- 完整的文档
- 良好的可访问性

**Token 体系**：
```typescript
const antdTokens = {
  colorPrimary: '#1890ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  fontSize: 14,
  borderRadius: 6,
};
```

### Material UI

**特点**：
- 基于 Material Design
- 灵活的主题系统
- 丰富的组件库
- 良好的 TypeScript 支持

**Token 体系**：
```typescript
const materialTokens = {
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#9c27b0' },
  },
  typography: {
    fontSize: 14,
    fontFamily: 'Roboto',
  },
  spacing: 8,
};
```

## 常见误区

### 误区一：设计系统就是 UI Kit

**错误理解**：设计系统就是一堆组件的集合

**正确理解**：设计系统是包含 Token、组件、模式、文档的完整体系

### 误区二：设计系统是一次性的

**错误理解**：设计系统搭建完就完成了

**正确理解**：设计系统需要持续维护和更新

### 误区三：设计系统只属于设计师

**错误理解**：设计系统是设计师的事

**正确理解**：设计系统需要设计师和开发者共同维护

### 误区四：设计系统会限制创造力

**错误理解**：设计系统会限制设计师的创造力

**正确理解**：设计系统提供基础，让设计师专注于创新

## 本课小结

本课我们理解了设计系统的核心概念：

1. **设计系统是完整的体系**，不是简单的 UI Kit
2. **Design Token 是基础**，它将设计决策抽象为可复用的变量
3. **组件库是核心**，提供可复用的 UI 组件
4. **设计模式是补充**，提供常见问题的解决方案
5. **文档和工具是保障**，确保设计系统的可用性

## 练习

### 练习一：分析设计系统

分析一个你熟悉的设计系统（如 Ant Design、Material UI），列出它的组成部分。

### 练习二：设计 Token 体系

为一个简单的项目设计 Token 体系，包括颜色、字体、间距等。

## 参考答案

### 练习一

**Ant Design 的组成部分**：
1. **Design Token**：颜色、字体、间距、阴影等
2. **组件库**：Button、Input、Table、Form 等
3. **设计模式**：表单、表格、导航等
4. **文档**：组件文档、设计规范、最佳实践
5. **工具**：Ant Design Pro、Ant Design Icons

### 练习二

**Token 体系设计**：
```typescript
const tokens = {
  // 颜色
  colorPrimary: '#1890ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorText: '#000000d9',
  colorBg: '#ffffff',
  
  // 字体
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: 14,
  fontSizeH1: 38,
  fontSizeH2: 30,
  fontSizeH3: 24,
  
  // 间距
  spacingXs: 4,
  spacingSm: 8,
  spacingMd: 16,
  spacingLg: 24,
  spacingXl: 32,
  
  // 圆角
  borderRadius: 6,
  borderRadiusSm: 4,
  borderRadiusLg: 8,
  
  // 阴影
  shadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  shadowSm: '0 1px 4px rgba(0, 0, 0, 0.1)',
  shadowLg: '0 4px 16px rgba(0, 0, 0, 0.2)',
};
```

## 下一步

完成本课后，继续学习 [02. Design Token 体系设计](./02-design-tokens.md)。
