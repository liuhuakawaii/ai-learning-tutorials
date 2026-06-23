# 07. 组件测试策略

> 测试不是为了覆盖率数字，是为了让你敢于重构

## 本课目标

- 理解组件测试的分层策略
- 掌握 @testing-library 的核心用法
- 学会编写快照测试和视觉回归测试
- 建立组件测试的工程化流程

## 测试金字塔与组件库

组件库的测试策略和业务应用不同。业务应用侧重集成测试和 E2E 测试，组件库侧重单元测试和视觉测试。

```
        /  视觉回归  \        ← 保证视觉一致性
       /  交互测试    \       ← 验证用户行为
      /  单元测试      \      ← 验证逻辑正确性
     /__________________\
```

组件库不需要测"用户能否完成下单流程"，需要测的是：
- 渲染是否正确
- Props 变化是否反映到 DOM
- 事件回调是否正确触发
- 状态变化是否符合预期
- 视觉表现是否一致

## 单元测试：@testing-library

### 核心理念

@testing-library 的设计哲学是：**测试应该像用户一样使用组件**。

不推荐：
```typescript
// 不好：测试实现细节
expect(wrapper.state('isOpen')).toBe(true);
expect(wrapper.find('.modal-content').length).toBe(1);
```

推荐：
```typescript
// 好：测试用户可观察的行为
expect(screen.getByRole('dialog')).toBeInTheDocument();
expect(screen.getByText('确认删除')).toBeInTheDocument();
```

### 安装

```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### 测试渲染

```typescript
// Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies variant class', () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('button--primary');
  });

  it('applies disabled attribute', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### 测试用户交互

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button interactions', () => {
  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
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
});
```

`userEvent.setup()` 创建一个用户实例，模拟真实的鼠标和键盘事件。比 `fireEvent` 更接近真实用户行为。

### 测试异步行为

```typescript
import { render, screen, waitFor } from '@testing-library/react';

describe('AsyncButton', () => {
  it('shows loading state during async operation', async () => {
    const asyncFn = vi.fn().mockResolvedValue(undefined);
    
    render(<Button onClick={asyncFn}>Submit</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    
    // 等待 loading 状态出现
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });
    
    // 等待 loading 结束
    await waitFor(() => {
      expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy', 'true');
    });
  });
});
```

### 测试受控组件

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input (controlled)', () => {
  it('calls onChange with new value', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    
    render(<Input value="" onChange={handleChange} />);
    await user.type(screen.getByRole('textbox'), 'hello');
    
    // 每个字符触发一次 onChange
    expect(handleChange).toHaveBeenCalledTimes(5);
    expect(handleChange).toHaveBeenLastCalledWith('hello');
  });

  it('displays controlled value', () => {
    render(<Input value="controlled" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('controlled');
  });
});
```

## 测试复合组件

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

describe('Tabs', () => {
  it('switches tab on click', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    
    render(
      <Tabs activeKey="tab1" onChange={handleChange}>
        <Tabs.Tab itemKey="tab1">Tab 1</Tabs.Tab>
        <Tabs.Tab itemKey="tab2">Tab 2</Tabs.Tab>
      </Tabs>
    );
    
    await user.click(screen.getByRole('tab', { name: 'Tab 2' }));
    
    expect(handleChange).toHaveBeenCalledWith('tab2');
  });

  it('renders correct aria attributes', () => {
    render(
      <Tabs activeKey="tab1" onChange={() => {}}>
        <Tabs.Tab itemKey="tab1">Tab 1</Tabs.Tab>
        <Tabs.Tab itemKey="tab2">Tab 2</Tabs.Tab>
      </Tabs>
    );
    
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('does not activate disabled tab', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    
    render(
      <Tabs activeKey="tab1" onChange={handleChange}>
        <Tabs.Tab itemKey="tab1">Tab 1</Tabs.Tab>
        <Tabs.Tab itemKey="tab2" disabled>Tab 2</Tabs.Tab>
      </Tabs>
    );
    
    await user.click(screen.getByRole('tab', { name: 'Tab 2' }));
    
    expect(handleChange).not.toHaveBeenCalled();
  });
});
```

## 快照测试

### 什么是快照测试

快照测试记录组件的渲染输出，后续每次运行时对比。如果输出变化，测试失败。

```typescript
import { render } from '@testing-library/react';
import { Button } from './Button';

it('matches snapshot', () => {
  const { container } = render(<Button variant="primary">Snapshot</Button>);
  expect(container).toMatchSnapshot();
});
```

第一次运行时生成 `.snap` 文件，后续运行时对比。

### 快照测试的问题

快照测试看起来很省事，但有几个严重问题：

1. **脆弱**：任何改动（包括无关的 className 变化）都会导致失败
2. **无意义的失败**：快照 diff 很长，很难判断变化是否正确
3. **更新惯性**：失败后直接 `--update`，失去了测试意义
4. **不测试行为**：只测试渲染结构，不测试交互

### 更好的做法

用快照测试捕获"不应该变"的东西，而不是所有东西：

```typescript
// 测试特定输出，而不是整个 DOM
it('renders correct icon for loading state', () => {
  render(<Button loading>Loading</Button>);
  expect(screen.getByRole('button')).toContainElement(
    screen.getByTestId('spinner-icon')
  );
});

// 测试 class 结构
it('applies correct CSS classes', () => {
  const { container } = render(
    <Button variant="primary" size="large">Button</Button>
  );
  const button = container.firstChild;
  expect(button).toHaveClass('button--primary', 'button--large');
});
```

### 什么时候用快照

- 记录组件的 DOM 结构作为回归检查
- 测试复杂组件的渲染输出（如图表、表格）
- 作为其他测试的补充，不是主要测试手段

## 视觉回归测试

### 原理

视觉回归测试通过截图对比检测视觉变化。每次运行时截取组件截图，与基准图对比，差异超过阈值则失败。

### 工具选择

| 工具 | 特点 | 适用场景 |
|------|------|----------|
| Chromatic | Storybook 官方，云端运行 | 已用 Storybook 的项目 |
| Percy | 支持多框架 | 多框架项目 |
| Playwright | 本地运行，免费 | 预算有限 |
| Loki | Storybook 专用 | 本地运行 |

### 使用 Playwright 做视觉测试

```typescript
// tests/visual/button.spec.ts
import { test, expect } from '@playwright/test';

test('Button visual regression', async ({ page }) => {
  await page.goto('http://localhost:6006/?path=/story/components-button--primary');
  
  // 等待 Storybook 渲染完成
  await page.waitForSelector('#storybook-root');
  
  // 截图对比
  await expect(page.locator('#storybook-root')).toHaveScreenshot('button-primary.png');
});
```

```bash
# 首次运行生成基准图
npx playwright test --update-snapshots

# 后续运行对比
npx playwright test
```

### 视觉测试的覆盖范围

不需要每个 Story 都做视觉测试。重点覆盖：

- 核心组件的基础状态
- 主题切换后的视觉表现
- 不同尺寸的布局
- 边界情况（超长文本、空状态）

```typescript
// 只对关键状态做视觉测试
test.describe('Button visual', () => {
  test('primary variant', async ({ page }) => {
    // ...
  });

  test('all variants side by side', async ({ page }) => {
    // ...
  });

  test('dark theme', async ({ page }) => {
    // ...
  });
});
```

## 测试工具函数

组件库不只有组件，还有工具函数。工具函数用纯单元测试：

```typescript
// utils/classname.ts
export function clsx(
  ...args: Array<string | false | null | undefined | Record<string, boolean>>
): string {
  return args
    .flatMap((arg) => {
      if (!arg) return [];
      if (typeof arg === 'string') return [arg];
      if (typeof arg === 'object') {
        return Object.entries(arg)
          .filter(([, value]) => value)
          .map(([key]) => key);
      }
      return [];
    })
    .join(' ');
}
```

```typescript
// utils/classname.test.ts
import { clsx } from './classname';

describe('clsx', () => {
  it('joins strings', () => {
    expect(clsx('a', 'b', 'c')).toBe('a b c');
  });

  it('filters falsy values', () => {
    expect(clsx('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('handles object syntax', () => {
    expect(clsx({ active: true, disabled: false })).toBe('active');
  });

  it('handles mixed arguments', () => {
    expect(clsx('base', { active: true, disabled: false }, 'extra')).toBe(
      'base active extra'
    );
  });
});
```

## 测试覆盖率

### 什么需要覆盖

- 组件的每个 Props 变体
- 交互行为（点击、输入、键盘操作）
- 状态变化（受控/非受控、loading、disabled）
- 边界情况（空值、极端值）

### 什么不需要覆盖

- 第三方库的行为
- 纯样式（用视觉测试覆盖）
- 浏览器原生行为

### 覆盖率配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/components/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.stories.{ts,tsx}',
        'src/**/*.test.{ts,tsx}',
        'src/**/index.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
```

覆盖率设 80% 比 100% 更实际。100% 覆盖率意味着你要为一些永远不会发生的场景写测试。

## 实战：测试一个 Modal 组件

```typescript
// Modal.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders when isOpen is true', () => {
    render(
      <Modal isOpen onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();
    
    render(
      <Modal isOpen onClose={handleClose}>
        <p>Modal content</p>
      </Modal>
    );
    
    // 点击 overlay（dialog 元素本身）
    await user.click(screen.getByRole('dialog'));
    
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it('does not close on overlay click when closeOnOverlayClick is false', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();
    
    render(
      <Modal isOpen onClose={handleClose} closeOnOverlayClick={false}>
        <p>Modal content</p>
      </Modal>
    );
    
    await user.click(screen.getByRole('dialog'));
    
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('closes on Escape key', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();
    
    render(
      <Modal isOpen onClose={handleClose}>
        <p>Modal content</p>
      </Modal>
    );
    
    await user.keyboard('{Escape}');
    
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it('traps focus inside modal', async () => {
    const user = userEvent.setup();
    
    render(
      <Modal isOpen onClose={() => {}}>
        <button>First</button>
        <button>Second</button>
      </Modal>
    );
    
    // Tab 循环应该在 Modal 内
    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    
    await user.tab();
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus();
    
    await user.tab();
    // 回到第一个
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });
});
```

## 常见误区

### 误区一：追求 100% 覆盖率

覆盖率是手段，不是目标。80% 的覆盖率 + 有价值的测试用例 > 100% 的覆盖率 + 大量无意义的测试。

### 误区二：测试实现细节

测试应该关注用户可观察的行为，而不是内部实现。`useState` 被调用了几次、内部变量是什么值——这些都不该测。

### 误区三：快照测试替代所有测试

快照测试只能发现"变化了"，不能告诉你"变化是否正确"。它应该作为补充，不是主要手段。

## 本课小结

1. **测试用户行为**：用 @testing-library 模拟真实用户操作
2. **快照测试要慎用**：适合捕获结构性变化，不适合作为主要手段
3. **视觉回归测试**：用截图对比保证视觉一致性
4. **覆盖率要务实**：80% 覆盖率 + 有价值用例 > 100% 覆盖率 + 无意义用例
5. **测试金字塔**：单元测试为基础，视觉测试保证一致性

## 练习

### 练习一：测试 Select 组件

为一个 Select 组件编写测试用例，覆盖：
- 渲染选项列表
- 选择选项后关闭下拉
- 键盘导航（上/下箭头、Enter 选择、Escape 关闭）
- disabled 状态

### 练习二：测试 Tooltip 组件

为一个 Tooltip 组件编写测试用例，覆盖：
- hover 时显示
- mouse leave 时隐藏
- 延迟显示/隐藏
- 自定义位置

## 参考答案

### 练习一

```typescript
// Select.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const options = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
];

describe('Select', () => {
  it('renders placeholder', () => {
    render(<Select options={options} placeholder="Choose fruit" />);
    expect(screen.getByText('Choose fruit')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(<Select options={options} />);
    
    await user.click(screen.getByRole('combobox'));
    
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('selects option and closes dropdown', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Select options={options} onChange={handleChange} />);
    
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Banana' }));
    
    expect(handleChange).toHaveBeenCalledWith('banana');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('navigates with keyboard', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<Select options={options} onChange={handleChange} />);
    
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    
    expect(handleChange).toHaveBeenCalledWith('banana');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Select options={options} />);
    
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<Select options={options} disabled />);
    
    await user.click(screen.getByRole('combobox'));
    
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
```

### 练习二

```typescript
// Tooltip.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('shows on hover', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    await user.hover(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });
  });

  it('hides on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );
    
    await user.hover(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByText('Tooltip text')).toBeInTheDocument();
    });
    
    await user.unhover(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.queryByText('Tooltip text')).not.toBeInTheDocument();
    });
  });

  it('respects delay prop', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Delayed" delay={500}>
        <button>Hover me</button>
      </Tooltip>
    );
    
    await user.hover(screen.getByRole('button'));
    
    // 100ms 后应该还没显示
    await waitFor(() => {
      expect(screen.queryByText('Delayed')).not.toBeInTheDocument();
    }, { timeout: 100 });
    
    // 600ms 后应该显示
    await waitFor(() => {
      expect(screen.getByText('Delayed')).toBeInTheDocument();
    }, { timeout: 600 });
  });
});
```

## 下一步

完成本课后，继续学习 [08. 无障碍访问（a11y）工程化](./08-accessibility.md)。
