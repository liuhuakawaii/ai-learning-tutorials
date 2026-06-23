# 10. 阶段项目：设计并实现 Button 组件

> 一个 Button 组件的完整生命周期，从 Token 到发布

## 本课目标

- 综合运用前 9 课的知识
- 完成一个生产级 Button 组件的全流程
- 建立组件从设计到发布的完整工程链路
- 体验真实的组件库开发流程

## 项目概述

本课的任务是设计并实现一个生产级的 Button 组件。这不是一个简单的 demo，而是一个可以放进真实组件库的组件。

**验收标准**：
- 支持多种 variant（primary、secondary、danger、ghost）
- 支持多种 size（small、medium、large）
- 支持 loading、disabled 状态
- 支持 icon（前置、后置）
- 支持主题切换
- 完整的 Storybook 文档
- 完整的单元测试
- 通过 axe 可访问性检测
- 成功打包为 ESM + CJS 格式

## 第一步：Token 设计

Button 组件的 Token 来自设计系统，但需要定义组件级 Token：

```typescript
// tokens/button.ts
export interface ButtonTokens {
  // 基础
  fontFamily: string;
  fontWeight: string;
  borderRadius: string;
  transition: string;

  // 尺寸
  sm: {
    height: string;
    paddingX: string;
    paddingY: string;
    fontSize: string;
  };
  md: {
    height: string;
    paddingX: string;
    paddingY: string;
    fontSize: string;
  };
  lg: {
    height: string;
    paddingX: string;
    paddingY: string;
    fontSize: string;
  };

  // 变体
  primary: {
    bg: string;
    bgHover: string;
    bgActive: string;
    color: string;
    border: string;
  };
  secondary: {
    bg: string;
    bgHover: string;
    bgActive: string;
    color: string;
    border: string;
  };
  danger: {
    bg: string;
    bgHover: string;
    bgActive: string;
    color: string;
    border: string;
  };
  ghost: {
    bg: string;
    bgHover: string;
    bgActive: string;
    color: string;
    border: string;
  };
}

export const lightButtonTokens: ButtonTokens = {
  fontFamily: 'inherit',
  fontWeight: '500',
  borderRadius: '6px',
  transition: 'all 0.2s ease',

  sm: {
    height: '28px',
    paddingX: '12px',
    paddingY: '4px',
    fontSize: '14px',
  },
  md: {
    height: '36px',
    paddingX: '16px',
    paddingY: '8px',
    fontSize: '14px',
  },
  lg: {
    height: '44px',
    paddingX: '24px',
    paddingY: '12px',
    fontSize: '16px',
  },

  primary: {
    bg: '#1890ff',
    bgHover: '#40a9ff',
    bgActive: '#096dd9',
    color: '#ffffff',
    border: '#1890ff',
  },
  secondary: {
    bg: '#ffffff',
    bgHover: '#f5f5f5',
    bgActive: '#e8e8e8',
    color: '#141414',
    border: '#d9d9d9',
  },
  danger: {
    bg: '#ff4d4f',
    bgHover: '#ff7875',
    bgActive: '#d9363e',
    color: '#ffffff',
    border: '#ff4d4f',
  },
  ghost: {
    bg: 'transparent',
    bgHover: 'rgba(0, 0, 0, 0.06)',
    bgActive: 'rgba(0, 0, 0, 0.1)',
    color: '#141414',
    border: 'transparent',
  },
};

export const darkButtonTokens: ButtonTokens = {
  fontFamily: 'inherit',
  fontWeight: '500',
  borderRadius: '6px',
  transition: 'all 0.2s ease',

  sm: {
    height: '28px',
    paddingX: '12px',
    paddingY: '4px',
    fontSize: '14px',
  },
  md: {
    height: '36px',
    paddingX: '16px',
    paddingY: '8px',
    fontSize: '14px',
  },
  lg: {
    height: '44px',
    paddingX: '24px',
    paddingY: '12px',
    fontSize: '16px',
  },

  primary: {
    bg: '#177ddc',
    bgHover: '#1890ff',
    bgActive: '#1565a8',
    color: '#ffffff',
    border: '#177ddc',
  },
  secondary: {
    bg: '#1f1f1f',
    bgHover: '#2a2a2a',
    bgActive: '#333333',
    color: '#ffffffd9',
    border: '#434343',
  },
  danger: {
    bg: '#d32f2f',
    bgHover: '#e53935',
    bgActive: '#b71c1c',
    color: '#ffffff',
    border: '#d32f2f',
  },
  ghost: {
    bg: 'transparent',
    bgHover: 'rgba(255, 255, 255, 0.08)',
    bgActive: 'rgba(255, 255, 255, 0.12)',
    color: '#ffffffd9',
    border: 'transparent',
  },
};
```

## 第二步：类型设计

```typescript
// Button.types.ts
import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** 按钮变体 */
  variant?: ButtonVariant;
  /** 按钮尺寸 */
  size?: ButtonSize;
  /** 是否加载中 */
  loading?: boolean;
  /** 左侧图标 */
  icon?: React.ReactNode;
  /** 右侧图标 */
  iconRight?: React.ReactNode;
  /** 是否为块级按钮 */
  block?: boolean;
  /** 按钮类型 */
  htmlType?: 'button' | 'submit' | 'reset';
}
```

注意 `htmlType` 而不是 `type`——因为 `type` 在 HTML button 中有原生含义（button/submit/reset），而 React 的 `type` 可能跟 TypeScript 的工具类型冲突。用 `htmlType` 更清晰。

## 第三步：组件实现

```typescript
// Button.tsx
import React, { forwardRef } from 'react';
import { clsx } from '../../utils/clsx';
import { ButtonProps } from './Button.types';
import styles from './Button.module.css';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'medium',
      loading = false,
      disabled = false,
      icon,
      iconRight,
      block = false,
      htmlType = 'button',
      className,
      children,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={htmlType}
        className={clsx(
          styles.button,
          styles[variant],
          styles[size],
          block && styles.block,
          loading && styles.loading,
          className
        )}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...rest}
      >
        {loading && (
          <span className={styles.spinner} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="31.4 31.4" />
            </svg>
          </span>
        )}
        {!loading && icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        {children && <span>{children}</span>}
        {!loading && iconRight && (
          <span className={styles.iconRight} aria-hidden="true">
            {iconRight}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

## 第四步：样式实现

```css
/* Button.module.css */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--button-border-radius, 6px);
  font-family: inherit;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  user-select: none;
  outline: none;
}

.button:focus-visible {
  box-shadow: 0 0 0 2px #1890ff40;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

/* Variants */
.primary {
  background: var(--button-primary-bg, #1890ff);
  color: var(--button-primary-color, #ffffff);
  border-color: var(--button-primary-border, #1890ff);
}

.primary:hover:not(:disabled) {
  background: var(--button-primary-bg-hover, #40a9ff);
}

.primary:active:not(:disabled) {
  background: var(--button-primary-bg-active, #096dd9);
}

.secondary {
  background: var(--button-secondary-bg, #ffffff);
  color: var(--button-secondary-color, #141414);
  border-color: var(--button-secondary-border, #d9d9d9);
}

.secondary:hover:not(:disabled) {
  background: var(--button-secondary-bg-hover, #f5f5f5);
}

.secondary:active:not(:disabled) {
  background: var(--button-secondary-bg-active, #e8e8e8);
}

.danger {
  background: var(--button-danger-bg, #ff4d4f);
  color: var(--button-danger-color, #ffffff);
  border-color: var(--button-danger-border, #ff4d4f);
}

.danger:hover:not(:disabled) {
  background: var(--button-danger-bg-hover, #ff7875);
}

.danger:active:not(:disabled) {
  background: var(--button-danger-bg-active, #d9363e);
}

.ghost {
  background: transparent;
  color: var(--button-ghost-color, #141414);
  border-color: transparent;
}

.ghost:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.06);
}

.ghost:active:not(:disabled) {
  background: rgba(0, 0, 0, 0.1);
}

/* Sizes */
.small {
  height: 28px;
  padding: 4px 12px;
  font-size: 14px;
}

.medium {
  height: 36px;
  padding: 8px 16px;
  font-size: 14px;
}

.large {
  height: 44px;
  padding: 12px 24px;
  font-size: 16px;
}

/* Block */
.block {
  display: flex;
  width: 100%;
}

/* Loading */
.loading {
  position: relative;
  color: transparent;
}

.loading .spinner {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner svg {
  width: 1em;
  height: 1em;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Icon */
.icon,
.iconRight {
  display: inline-flex;
  align-items: center;
  font-size: 1.1em;
}
```

## 第五步：主题支持

```typescript
// Button.theme.ts
import { lightButtonTokens, darkButtonTokens, ButtonTokens } from './tokens/button';

function tokensToCssVars(tokens: ButtonTokens): Record<string, string> {
  return {
    '--button-border-radius': tokens.borderRadius,
    '--button-primary-bg': tokens.primary.bg,
    '--button-primary-bg-hover': tokens.primary.bgHover,
    '--button-primary-bg-active': tokens.primary.bgActive,
    '--button-primary-color': tokens.primary.color,
    '--button-primary-border': tokens.primary.border,
    '--button-secondary-bg': tokens.secondary.bg,
    '--button-secondary-bg-hover': tokens.secondary.bgHover,
    '--button-secondary-bg-active': tokens.secondary.bgActive,
    '--button-secondary-color': tokens.secondary.color,
    '--button-secondary-border': tokens.secondary.border,
    '--button-danger-bg': tokens.danger.bg,
    '--button-danger-bg-hover': tokens.danger.bgHover,
    '--button-danger-bg-active': tokens.danger.bgActive,
    '--button-danger-color': tokens.danger.color,
    '--button-danger-border': tokens.danger.border,
    '--button-ghost-color': tokens.ghost.color,
  };
}

export function applyButtonTheme(
  element: HTMLElement,
  theme: 'light' | 'dark'
) {
  const tokens = theme === 'light' ? lightButtonTokens : darkButtonTokens;
  const vars = tokensToCssVars(tokens);
  Object.entries(vars).forEach(([key, value]) => {
    element.style.setProperty(key, value);
  });
}
```

## 第六步：Storybook 文档

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
      options: ['primary', 'secondary', 'danger', 'ghost'],
    },
    size: {
      control: 'radio',
      options: ['small', 'medium', 'large'],
    },
    onClick: { action: 'clicked' },
  },
  args: {
    children: 'Button',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
  },
};

export const Small: Story = {
  args: { size: 'small' },
};

export const Medium: Story = {
  args: { size: 'medium' },
};

export const Large: Story = {
  args: { size: 'large' },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Block: Story = {
  args: { block: true },
  decorators: [
    (Story) => (
      <div style={{ width: '300px' }}>
        <Story />
      </div>
    ),
  ],
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
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

export const LoadingClickTest: Story = {
  args: {
    loading: true,
    children: 'Submit',
    onClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const KeyboardTest: Story = {
  args: {
    children: 'Press Enter',
    onClick: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /press enter/i });
    button.focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
```

## 第七步：单元测试

```typescript
// Button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from './Button';

expect.extend(toHaveNoViolations);

describe('Button', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('applies variant class', () => {
      render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('primary');
    });

    it('applies size class', () => {
      render(<Button size="large">Large</Button>);
      expect(screen.getByRole('button')).toHaveClass('large');
    });

    it('applies block class', () => {
      render(<Button block>Block</Button>);
      expect(screen.getByRole('button')).toHaveClass('block');
    });

    it('sets htmlType', () => {
      render(<Button htmlType="submit">Submit</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('defaults to button type', () => {
      render(<Button>Default</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(<Button onClick={handleClick}>Click</Button>);
      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);
      await user.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(<Button loading onClick={handleClick}>Loading</Button>);
      await user.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('can be activated with Enter key', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(<Button onClick={handleClick}>Enter</Button>);
      screen.getByRole('button').focus();
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it('can be activated with Space key', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      render(<Button onClick={handleClick}>Space</Button>);
      screen.getByRole('button').focus();
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledOnce();
    });
  });

  describe('loading state', () => {
    it('shows spinner when loading', () => {
      render(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('hides icon when loading', () => {
      render(
        <Button loading icon={<span data-testid="icon">+</span>}>
          Loading
        </Button>
      );
      expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has no violations', async () => {
      const { container } = render(<Button>Accessible</Button>);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no violations when disabled', async () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no violations when loading', async () => {
      const { container } = render(<Button loading>Loading</Button>);
      expect(await axe(container)).toHaveNoViolations();
    });

    it('sets aria-disabled when disabled', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    });

    it('sets aria-busy when loading', () => {
      render(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to button element', () => {
      const ref = { current: null };
      render(<Button ref={ref}>Ref</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });
});
```

## 第八步：打包配置

```typescript
// rollup.config.ts
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
  ],
  external: (id) => /^react(-dom)?(\/.*)?$/.test(id),
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.build.json',
      declaration: true,
      declarationDir: 'dist/types',
    }),
    postcss({
      extract: 'styles.css',
      minimize: true,
      modules: {
        generateScopedName: '[name]__[local]___[hash:base64:5]',
      },
    }),
  ],
};
```

```json
// package.json
{
  "name": "@myorg/ui",
  "version": "0.1.0",
  "main": "./dist/index.cjs.js",
  "module": "./dist/index.esm.js",
  "types": "./dist/types/index.d.ts",
  "files": ["dist"],
  "sideEffects": ["*.css"],
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "scripts": {
    "build": "rollup -c",
    "test": "vitest run",
    "test:a11y": "vitest run --reporter=verbose",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "lint": "eslint src --ext .ts,.tsx"
  }
}
```

## 项目验收

完成以上步骤后，运行以下命令验证：

```bash
# 代码检查
npm run lint

# 单元测试
npm run test

# 构建
npm run build

# Storybook
npm run storybook
```

### 验收清单

- [ ] 组件支持 primary、secondary、danger、ghost 四种变体
- [ ] 组件支持 small、medium、large 三种尺寸
- [ ] 组件支持 loading 状态（显示 spinner，阻止点击）
- [ ] 组件支持 disabled 状态（降低透明度，阻止点击）
- [ ] 组件支持 icon 和 iconRight
- [ ] 组件支持 block 模式
- [ ] 组件支持 ref 转发
- [ ] 组件支持主题切换（light/dark）
- [ ] Storybook 文档完整，包含交互测试
- [ ] 单元测试通过，覆盖主要场景
- [ ] axe 检测无违规
- [ ] `npm run build` 成功，产出 ESM + CJS + 类型声明
- [ ] `sideEffects` 正确配置

## 扩展挑战

完成基本要求后，可以继续挑战：

1. **添加 Loading Button**：点击后自动进入 loading 状态，异步操作完成后恢复
2. **添加 Button Group**：一组按钮，支持合并圆角
3. **添加 Icon Button**：只有图标没有文字的圆形按钮
4. **添加 Confirm Button**：点击后需要二次确认的危险操作按钮
5. **添加动画**：hover、active、focus 的过渡动画

## 本课小结

这个项目把前 9 课的知识串在一起：

1. **Token 设计**（02 课）→ 定义组件级 Token
2. **组件架构**（03 课）→ 类型设计、ref 转发、组合模式
3. **API 设计**（04 课）→ Props 设计、受控/非受控
4. **主题系统**（05 课）→ CSS 变量实现主题切换
5. **Storybook**（06 课）→ 交互式文档和交互测试
6. **测试策略**（07 课）→ 单元测试和 axe 检测
7. **a11y**（08 课）→ ARIA 属性和键盘支持
8. **打包发布**（09 课）→ Rollup 打包和 npm 发布

一个 Button 组件看起来简单，但它包含了组件库开发的所有核心问题。做好一个 Button，就能做好所有组件。

## 下一步

完成本阶段后，继续学习 [stage3：构建工具链深度](../stage3-build-toolchain/README.md)。
