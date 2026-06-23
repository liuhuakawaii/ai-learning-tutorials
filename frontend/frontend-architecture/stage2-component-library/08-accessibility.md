# 08. 无障碍访问（a11y）工程化

> 可访问性不是"锦上添花"，是组件库的基本质量标准

## 本课目标

- 理解无障碍访问的核心概念和工程价值
- 掌握 ARIA 属性的正确使用方式
- 学会实现键盘导航和焦点管理
- 建立可访问性的自动化检测流程

## 为什么组件库必须做 a11y

### 商业原因

全球约有 10 亿残障人士。在中国，《无障碍环境建设法》已于 2023 年施行。越来越多的企业要求产品满足 WCAG 2.1 AA 标准。

### 技术原因

a11y 做得好的组件，往往 API 设计也更好。语义化的 HTML、清晰的键盘交互、合理的焦点管理——这些不只是为残障用户设计的，所有用户都会受益。

### 成本原因

在组件库层面做好 a11y，比在每个业务项目中单独处理成本低得多。组件库是"做一次，用千次"的地方。

## 语义化 HTML

### 用正确的 HTML 元素

最简单的 a11y 是用对 HTML 元素：

```html
<!-- 不好：用 div 模拟按钮 -->
<div class="button" onclick="submit()">提交</div>

<!-- 好：用 button -->
<button type="submit">提交</button>
```

`<button>` 自带：
- 键盘可聚焦（Tab）
- 可用 Enter/Space 激活
- 自带 `role="button"`
- 屏幕阅读器正确识别

```html
<!-- 不好：用 div 模拟链接 -->
<div onclick="navigate('/about')">关于我们</div>

<!-- 好：用 a -->
<a href="/about">关于我们</a>
```

### 何时需要 ARIA

当原生 HTML 元素无法表达组件的语义时，才用 ARIA。

```html
<!-- Tab 组件没有原生 HTML 对应 -->
<div role="tablist">
  <button role="tab" aria-selected="true">Tab 1</button>
  <button role="tab" aria-selected="false">Tab 2</button>
</div>
<div role="tabpanel">Content 1</div>
```

**ARIA 的第一条规则**：能用原生 HTML 就不要用 ARIA。

## ARIA 核心属性

### 角色（Role）

```html
<div role="dialog">...</div>
<div role="alert">操作成功</div>
<nav role="navigation">...</div>
<div role="tablist">...</div>
```

### 状态和属性

```html
<!-- 展开/折叠 -->
<button aria-expanded="false">展开详情</button>

<!-- 选中状态 -->
<option aria-selected="true">Apple</option>

<!-- 禁用状态 -->
<button aria-disabled="true">提交</button>

<!-- 忙碌状态 -->
<div aria-busy="true">加载中...</div>

<!-- 关联关系 -->
<label for="email">邮箱</label>
<input id="email" aria-describedby="email-hint" />
<span id="email-hint">请输入企业邮箱</span>
```

### 实际组件中的 ARIA

**Modal 组件**：

```typescript
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <h2 id="modal-title">{title}</h2>
        <div>{children}</div>
        <button onClick={onClose} aria-label="关闭对话框">
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};
```

**Tabs 组件**：

```typescript
const Tab: React.FC<TabProps> = ({ itemKey, disabled, children }) => {
  const { activeKey, onChange } = useTabsContext();
  
  return (
    <button
      role="tab"
      aria-selected={activeKey === itemKey}
      aria-disabled={disabled}
      tabIndex={activeKey === itemKey ? 0 : -1}
      onClick={() => !disabled && onChange(itemKey)}
    >
      {children}
    </button>
  );
};

const TabPanel: React.FC<TabPanelProps> = ({ itemKey, children }) => {
  const { activeKey } = useTabsContext();
  
  if (activeKey !== itemKey) return null;
  
  return (
    <div role="tabpanel" tabIndex={0}>
      {children}
    </div>
  );
};
```

**Alert 组件**：

```typescript
const Alert: React.FC<AlertProps> = ({ type = 'info', children, closable, onClose }) => {
  return (
    <div
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      {children}
      {closable && (
        <button onClick={onClose} aria-label="关闭提示">
          <CloseIcon />
        </button>
      )}
    </div>
  );
};
```

`aria-live="polite"` 表示屏幕阅读器在当前语音结束后播报；`aria-live="assertive"` 表示立即打断播报。错误信息用 `assertive`，普通信息用 `polite`。

## 键盘导航

### 基本规则

| 按键 | 行为 |
|------|------|
| Tab | 在可聚焦元素间移动焦点 |
| Shift+Tab | 反向移动焦点 |
| Enter/Space | 激活按钮、链接 |
| Arrow Keys | 在一组相关元素间移动（如 Tab、Menu） |
| Escape | 关闭弹窗、取消操作 |
| Home/End | 跳到列表首/尾 |

### 焦点管理

**焦点陷阱（Focus Trap）**：

Modal 打开时，焦点应该限制在 Modal 内部：

```typescript
function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // 自动聚焦第一个元素
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  return containerRef;
}
```

**焦点恢复**：

Modal 关闭后，焦点应该回到触发元素：

```typescript
function useFocusRestore() {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const saveFocus = () => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  };

  const restoreFocus = () => {
    previousFocusRef.current?.focus();
  };

  return { saveFocus, restoreFocus };
}

// 使用
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  const { saveFocus, restoreFocus } = useFocusRestore();
  const containerRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (isOpen) {
      saveFocus();
    } else {
      restoreFocus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {children}
    </div>
  );
};
```

### Roving TabIndex

在一组元素（如 Tab、Radio Group）中，只有一个元素的 `tabIndex` 为 0，其余为 -1。用方向键在元素间移动焦点：

```typescript
const TabList: React.FC<TabListProps> = ({ children }) => {
  const { activeKey, tabs, onChange } = useTabsContext();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex((tab) => tab.key === activeKey);
    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    onChange(tabs[nextIndex].key);
    // 移动焦点到新的 tab
    tabs[nextIndex].ref.current?.focus();
  };

  return (
    <div role="tablist" onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
};
```

每个 Tab 的 `tabIndex` 根据是否活跃设置：

```typescript
const Tab: React.FC<TabProps> = ({ itemKey, children }) => {
  const { activeKey } = useTabsContext();
  
  return (
    <button
      role="tab"
      aria-selected={activeKey === itemKey}
      tabIndex={activeKey === itemKey ? 0 : -1}
    >
      {children}
    </button>
  );
};
```

这样用户 Tab 进入 TabList 时只聚焦活跃的 Tab，然后用方向键切换。

## 屏幕阅读器适配

### 可见但对屏幕阅读器隐藏

```html
<!-- 视觉上隐藏，屏幕阅读器可读 -->
<span className="sr-only">搜索</span>

<!-- CSS */
<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
```

### 对屏幕阅读器隐藏但视觉可见

```html
<!-- 装饰性图标，屏幕阅读器不需要 -->
<span aria-hidden="true">🔍</span>
```

### 动态内容通知

```typescript
// 通知屏幕阅读器内容变化
const Toast: React.FC<ToastProps> = ({ message, type }) => {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
};
```

`aria-atomic="true"` 表示播报整个区域的内容，而不仅仅是变化的部分。

## 自动化检测

### eslint-plugin-jsx-a11y

在代码层面检查可访问性问题：

```bash
npm install -D eslint-plugin-jsx-a11y
```

```json
// .eslintrc.json
{
  "plugins": ["jsx-a11y"],
  "extends": [
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    "jsx-a11y/click-events-have-key-events": "error",
    "jsx-a11y/no-static-element-interactions": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-proptypes": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/img-redundant-alt": "error",
    "jsx-a11y/label-has-associated-control": "error"
  }
}
```

### axe-core 运行时检测

```bash
npm install -D @axe-core/react
```

```typescript
// 开发环境启用 axe
if (process.env.NODE_ENV === 'development') {
  import('@axe-core/react').then((axe) => {
    axe.default(React, ReactDOM, 1000);
  });
}
```

axe 会在控制台输出可访问性违规信息。

### Storybook a11y 插件

```bash
npm install -D @storybook/addon-a11y
```

```typescript
// .storybook/main.ts
const config: StorybookConfig = {
  addons: ['@storybook/addon-a11y'],
};
```

在 Storybook 中，每个 Story 都会自动运行 axe 检查，结果显示在 A11y 面板中。

### CI 集成

```typescript
// 在测试中集成 axe
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Button a11y', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no violations when disabled', async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## 常见组件的 a11y 清单

### Button

```typescript
const Button: React.FC<ButtonProps> = ({
  children,
  disabled,
  loading,
  icon,
  ...props
}) => {
  return (
    <button
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <Spinner aria-hidden="true" />}
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
};
```

### Input

```typescript
const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  required,
  ...props
}) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={
          [error && errorId, hint && hintId].filter(Boolean).join(' ') ||
          undefined
        }
        {...props}
      />
      {hint && <span id={hintId}>{hint}</span>}
      {error && (
        <span id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
```

### Dialog / Modal

```typescript
const Dialog: React.FC<DialogProps> = ({ title, children, onClose }) => {
  const titleId = useId();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
      <button onClick={onClose} aria-label="关闭">
        <CloseIcon aria-hidden="true" />
      </button>
    </div>
  );
};
```

## 常见误区

### 误区一：a11y 只是加 aria 属性

ARIA 只是 a11y 的一部分。语义化 HTML、键盘导航、焦点管理、颜色对比度、屏幕阅读器适配——这些都是 a11y 的内容。

### 误区二：a11y 等视觉完成后再做

a11y 应该从组件设计阶段就开始。键盘交互、焦点管理、ARIA 结构——这些是 API 设计的一部分，不是后期"加"上去的。

### 误区三：自动化工具能发现所有问题

axe 能发现约 30% 的可访问性问题。键盘可用性、屏幕阅读器体验、交互逻辑——这些需要人工测试。

## 本课小结

1. **语义化 HTML 是基础**：能用原生元素就不用 ARIA
2. **ARIA 补充语义**：role、aria-selected、aria-expanded 等
3. **键盘导航是必须的**：Tab、Arrow Keys、Escape、Enter
4. **焦点管理**：焦点陷阱、焦点恢复、Roving TabIndex
5. **自动化检测**：eslint-plugin-jsx-a11y + axe + CI 集成

## 练习

### 练习一：为 Dropdown 组件添加 a11y

为一个 Dropdown 组件添加完整的 ARIA 属性和键盘导航：
- `role="menu"` 和 `role="menuitem"`
- 上下方向键导航
- Enter 选择
- Escape 关闭
- 焦点管理

### 练习二：运行 axe 检测

在 Storybook 中为任意组件运行 axe 检测，修复发现的可访问性问题。

## 参考答案

### 练习一

```typescript
const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const menuRef = useRef<HTMLUListElement>(null);
  const triggerId = useId();

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setActiveIndex(0);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) {
          onSelect(items[activeIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
    }
  };

  // 焦点自动移到活跃项
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && menuRef.current) {
      const menuItems = menuRef.current.querySelectorAll('[role="menuitem"]');
      (menuItems[activeIndex] as HTMLElement)?.focus();
    }
  }, [isOpen, activeIndex]);

  return (
    <div>
      <button
        id={triggerId}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${triggerId}-menu` : undefined}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
      >
        {trigger}
      </button>
      
      {isOpen && (
        <ul
          id={`${triggerId}-menu`}
          ref={menuRef}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, index) => (
            <li
              key={item.value}
              role="menuitem"
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={() => {
                onSelect(item.value);
                setIsOpen(false);
              }}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

### 练习二

```typescript
// Button.a11y.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from './Button';

expect.extend(toHaveNoViolations);

describe('Button accessibility', () => {
  it('has no violations in default state', async () => {
    const { container } = render(<Button>Click me</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when disabled', async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations with icon', async () => {
    const { container } = render(
      <Button icon={<span aria-hidden="true">+</span>}>Add item</Button>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

## 下一步

完成本课后，继续学习 [09. 组件库打包与发布](./09-packaging-and-publishing.md)。
