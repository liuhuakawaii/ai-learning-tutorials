# 06. 组件文档与 Storybook 实践

> 文档不是写完代码后补的，是写代码前设计 API 的工具

## 本课目标

- 理解文档驱动开发的理念
- 掌握 Storybook 的核心用法
- 学会编写交互式组件文档
- 建立组件文档的工程化流程

## 文档驱动开发

### 为什么先写文档

大多数团队的流程是：写组件 → 写 demo → 补文档。结果是文档永远落后于代码，或者干脆没有文档。

文档驱动开发（Documentation-Driven Development）的思路反过来：先写 Story，再写组件。

**好处**：

1. Story 就是组件的使用示例，写 Story 的过程就是设计 API 的过程
2. 每个 Story 都是一个可独立运行的测试用例
3. 设计师、产品经理可以直接在 Storybook 中预览组件
4. 新人上手时，Storybook 比源码更容易理解组件用法

### Story 与测试的关系

Story 不是测试，但它比大多数单元测试更有价值。一个 Story 展示了组件在特定场景下的完整行为——包括视觉、交互和边界情况。好的 Story 可以替代大部分手动测试。

## Storybook 基础

### 安装

```bash
npx storybook@latest init
```

这会自动检测项目框架（React/Vue/Svelte），安装对应依赖，生成配置文件。

### Story 文件结构

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   ├── Button.stories.tsx   # Story 文件
│   │   └── index.ts
```

Story 文件与组件文件放在同一目录，命名约定是 `*.stories.tsx`。

### 编写第一个 Story

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

// 基础 Story
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

// 另一个 Story
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

// 禁用状态
export const Disabled: Story = {
  args: {
    variant: 'primary',
    disabled: true,
    children: 'Disabled Button',
  },
};
```

`tags: ['autodocs']` 让 Storybook 自动生成 API 文档页面，读取组件的 TypeScript 类型和 JSDoc 注释。

## Args 与 Controls

### Args 是什么

Args 就是组件的 Props。在 Storybook 中，Args 可以通过 UI 控件实时修改。

```typescript
export const Playground: Story = {
  args: {
    variant: 'primary',
    size: 'medium',
    disabled: false,
    loading: false,
    children: 'Click me',
  },
};
```

在 Storybook 的 Controls 面板中，你可以直接修改这些值，实时看到效果。

### 自定义 Controls

默认情况下，Storybook 会根据 TypeScript 类型自动生成 Controls。但有些类型需要手动配置：

```typescript
const meta: Meta<typeof Button> = {
  component: Button,
  argTypes: {
    // 枚举类型用 radio 控件
    variant: {
      control: 'radio',
      options: ['primary', 'secondary', 'danger'],
    },
    // 数字类型用 range 控件
    size: {
      control: { type: 'range', min: 12, max: 24 },
    },
    // 回调函数用 action 记录调用
    onClick: { action: 'clicked' },
    // 不需要 Controls 的 Props
    className: { table: { disable: true } },
  },
};
```

### 使用 Actions

Actions 记录组件的事件回调，方便调试：

```typescript
import { fn } from '@storybook/test';

export const WithClickHandler: Story = {
  args: {
    children: 'Click me',
    onClick: fn(), // 点击后在 Actions 面板显示日志
  },
};
```

## 组织 Stories

### 按状态组织

```typescript
// Button.stories.tsx
export const Default: Story = {
  args: { children: 'Default' },
};

export const Primary: Story = {
  args: { variant: 'primary', children: 'Primary' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondary' },
};

export const Loading: Story = {
  args: { loading: true, children: 'Loading' },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Disabled' },
};

export const WithIcon: Story = {
  args: {
    children: 'Search',
    icon: <SearchIcon />,
  },
};
```

### 按场景组织

有些组件需要展示复杂场景，不只是单个状态：

```typescript
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Button size="small">Small</Button>
      <Button size="medium">Medium</Button>
      <Button size="large">Large</Button>
    </div>
  ),
};
```

### 使用 decorators

Decorators 为 Story 提供上下文环境：

```typescript
const meta: Meta<typeof Button> = {
  component: Button,
  decorators: [
    (Story) => (
      <div style={{ padding: '24px', background: '#f5f5f5' }}>
        <Story />
      </div>
    ),
  ],
};
```

需要主题的组件：

```typescript
export const WithTheme: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={darkTheme}>
        <Story />
      </ThemeProvider>
    ),
  ],
};
```

## 交互式测试

Storybook 支持在 Story 中编写交互测试，使用 `play` 函数：

```typescript
import { expect, userEvent, within } from '@storybook/test';

export const ClickInteraction: Story = {
  args: {
    children: 'Click me',
    onClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /click me/i });
    
    await userEvent.click(button);
    
    // 验证 onClick 被调用
    await expect(args.onClick).toHaveBeenCalled();
  },
};

export const DisabledClick: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
    onClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /disabled/i });
    
    await userEvent.click(button);
    
    // 验证 disabled 时 onClick 不被调用
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
```

这些交互测试会在 Storybook UI 中可视化运行，也可以在 CI 中通过 `test-storybook` 命令自动执行。

## MDX 文档

Storybook 支持 MDX 格式，可以混合 Markdown 和 JSX：

```mdx
{/* Button.mdx */}
import { Meta, Story, Canvas, ArgsTable } from '@storybook/blocks';
import { Button } from './Button';

<Meta title="Components/Button" />

# Button

按钮是最基础的交互组件。

## 何时使用

- 触发操作或事件
- 提交表单
- 打开对话框
- 切换状态

## 基础用法

<Canvas>
  <Story id="components-button--primary" />
</Canvas>

## 变体

<Canvas>
  <Story id="components-button--all-variants" />
</Canvas>

## Props

<ArgsTable of={Button} />

## 最佳实践

1. 按钮文案要简洁，动词开头
2. 主操作用 Primary，次要操作用 Secondary
3. 破坏性操作用 Danger
4. 每个区域最多一个 Primary Button
```

MDX 适合写"指南型"文档，而 Stories 适合写"参考型"文档。两者配合使用。

## 文档自动化

### autodocs

`tags: ['autodocs']` 会自动生成 API 文档，读取：

- TypeScript 类型定义
- JSDoc 注释
- 默认值
- Props 描述

```typescript
interface ButtonProps {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'danger';
  /** 按钮尺寸 */
  size?: 'small' | 'medium' | 'large';
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** 按钮内容 */
  children: React.ReactNode;
}

/**
 * 基础按钮组件，用于触发操作。
 *
 * @example
 * <Button variant="primary" onClick={handleClick}>
 *   提交
 * </Button>
 */
export const Button: React.FC<ButtonProps> = ({ ... }) => { ... };
```

这些注释会直接出现在 Storybook 的文档页面中。

### CI 集成

在 CI 中构建 Storybook 并部署：

```yaml
# .github/workflows/storybook.yml
name: Storybook
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build-storybook
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./storybook-static
```

## 实战：为组件库搭建 Storybook

### 项目结构

```
packages/ui/
├── .storybook/
│   ├── main.ts           # Storybook 配置
│   ├── preview.ts        # 全局参数
│   └── manager.ts        # UI 定制
├── src/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.stories.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### Storybook 配置

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

export default config;
```

### 全局参数

```typescript
// .storybook/preview.ts
import type { Preview } from '@storybook/react';
import { ThemeProvider } from '../src/ThemeProvider';
import { lightTheme } from '../src/themes/light';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={lightTheme}>
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#141414' },
      ],
    },
  },
};

export default preview;
```

### Button 组件的完整 Story

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { fn } from '@storybook/test';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'radio',
      options: ['primary', 'secondary', 'danger'],
    },
    size: {
      control: 'radio',
      options: ['small', 'medium', 'large'],
    },
    onClick: { action: 'clicked' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Danger Button',
  },
};

export const Small: Story = {
  args: {
    size: 'small',
    children: 'Small',
  },
};

export const Large: Story = {
  args: {
    size: 'large',
    children: 'Large',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

export const ClickTest: Story = {
  args: {
    children: 'Click me',
    onClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /click me/i });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const DisabledClickTest: Story = {
  args: {
    disabled: true,
    children: 'Cannot click',
    onClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /cannot click/i });
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
```

## 常见误区

### 误区一：Story 只是 demo

Story 不只是 demo，它是组件的活文档、测试用例和设计规范。每个 Story 都应该有明确的目的——展示某种状态、验证某种交互、说明某种用法。

### 误区二：所有组件都要 Story

工具函数、纯逻辑 hook、内部辅助组件不需要 Story。Story 应该覆盖消费者会使用的组件。

### 误区三：Story 写完就不管了

Story 需要和组件一起维护。组件 API 变了，Story 必须同步更新。CI 中应该运行 Storybook 的交互测试。

## 本课小结

1. **文档驱动开发**：先写 Story，再写组件，Story 就是 API 设计工具
2. **Args + Controls**：让组件的每个 Props 都能实时调整
3. **交互测试**：`play` 函数让 Story 不只是静态展示
4. **MDX 文档**：混合 Markdown 和 JSX，写指南型文档
5. **autodocs**：从 TypeScript 类型自动生成 API 文档

## 练习

### 练习一：为 Input 组件编写 Stories

为一个 Input 组件编写完整的 Stories，覆盖：
- 基础用法
- 受控和非受控模式
- 带清除按钮
- 带前缀/后缀
- 错误状态
- 禁用状态

### 练习二：编写交互测试

为上述 Input 组件编写 `play` 函数，测试：
- 输入文字后 value 变化
- 点击清除按钮后 value 清空
- 禁用状态无法输入

## 参考答案

### 练习一

```typescript
// Input.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
    onClear: { action: 'cleared' },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: '请输入',
  },
};

export const WithValue: Story = {
  args: {
    value: '已输入的内容',
    onChange: () => {},
  },
};

export const WithClearButton: Story = {
  args: {
    value: '可清除',
    allowClear: true,
    onChange: () => {},
    onClear: () => {},
  },
};

export const WithPrefix: Story = {
  args: {
    prefix: '🔍',
    placeholder: '搜索',
  },
};

export const WithSuffix: Story = {
  args: {
    suffix: '¥',
    placeholder: '请输入金额',
  },
};

export const Error: Story = {
  args: {
    value: '错误的内容',
    error: '格式不正确',
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    value: '不可编辑',
    disabled: true,
  },
};
```

### 练习二

```typescript
import { expect, userEvent, within } from '@storybook/test';
import { fn } from '@storybook/test';

export const TypingTest: Story = {
  args: {
    placeholder: '请输入',
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText('请输入');
    
    await userEvent.type(input, 'hello');
    
    // 验证 onChange 被调用了 5 次（每个字符一次）
    await expect(args.onChange).toHaveBeenCalledTimes(5);
  },
};

export const ClearTest: Story = {
  args: {
    value: '要清除的内容',
    allowClear: true,
    onChange: fn(),
    onClear: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const clearButton = canvas.getByRole('button', { name: /清除/i });
    
    await userEvent.click(clearButton);
    
    await expect(args.onClear).toHaveBeenCalledOnce();
  },
};

export const DisabledTypingTest: Story = {
  args: {
    value: '不可编辑',
    disabled: true,
    onChange: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByDisplayValue('不可编辑');
    
    await userEvent.type(input, 'new value');
    
    // disabled 时 onChange 不应被调用
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
```

## 下一步

完成本课后，继续学习 [07. 组件测试策略](./07-testing-strategy.md)。
