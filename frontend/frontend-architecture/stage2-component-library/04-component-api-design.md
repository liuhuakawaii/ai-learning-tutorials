# 04. 组件开发规范与 API 设计原则

> 好的组件 API 不是设计出来的，是用出来的

## 本课目标

- 建立组件命名规范和文件组织约定
- 掌握 Props 设计的核心原则和常见模式
- 理解受控与非受控组件的设计取舍
- 学会处理组件的状态管理边界

## 命名规范

### 组件命名

组件命名是 API 设计的第一道门。名字选错了，后面怎么设计都别扭。

**原则：名词命名组件，动词命名回调**

```typescript
// 好：组件是名词，回调是动词
<DatePicker onSelect={handleSelect} />
<Dialog onClose={handleClose} />

// 不好：组件带了动词含义
<RenderDialog />
<SelectDate />
```

**原则：布尔 Props 用 `is` 或 `has` 前缀**

```typescript
interface ButtonProps {
  isDisabled: boolean;
  isLoading: boolean;
  hasIcon: boolean;
}
```

这条规则在实际项目中有争议。Ant Design 和 Radix 都不用 `is` 前缀，直接用 `disabled`、`loading`。这取决于团队约定——关键是保持一致，不要一个组件用 `disabled`，另一个用 `isDisabled`。

**原则：回调 Props 用 `on` 前缀**

```typescript
interface TabsProps {
  onChange: (key: string) => void;
  onTabClick: (key: string, event: MouseEvent) => void;
}
```

### 文件组织

一个组件一个目录，相关文件放在一起：

```
components/
├── Button/
│   ├── Button.tsx          # 组件实现
│   ├── Button.types.ts     # 类型定义
│   ├── Button.styles.ts    # 样式（如使用 CSS-in-JS）
│   ├── Button.test.tsx     # 测试
│   ├── Button.stories.tsx  # Storybook 文档
│   └── index.ts            # 导出入口
```

`index.ts` 只做导出，不做逻辑：

```typescript
// Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button.types';
```

这样做的好处是：消费者不需要知道文件内部结构，只需要 `import { Button } from '@/components'`。

## Props 设计原则

### 最少知识原则

使用组件需要知道的信息越少越好。

**反面案例**：

```typescript
interface TableProps {
  // 需要理解 5 个概念才能排序
  sortConfig: {
    key: string;
    direction: 'asc' | 'desc';
    compareFn?: (a: any, b: any) => number;
    priority?: number;
  };
  onSortChange: (config: SortConfig) => void;
}
```

**正面案例**：

```typescript
interface TableProps {
  // 直接告诉组件要排什么、怎么排
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange: (key: string, order: 'asc' | 'desc') => void;
}
```

### Props 应该是声明式的

Props 描述"要什么"，而不是"怎么做"。

```typescript
// 声明式：告诉组件结果
<Button variant="primary" size="large" />

// 命令式：告诉组件过程
<Button
  style={{
    background: '#1890ff',
    color: 'white',
    padding: '12px 24px',
    fontSize: '16px',
  }}
/>
```

当然，`style` 作为逃生舱是必要的。但默认路径应该是声明式的。

### 合理的默认值

好的默认值让组件开箱即用：

```typescript
interface ModalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  // 有合理的默认值
  closeOnOverlayClick?: boolean;   // 默认 true
  closeOnEscape?: boolean;         // 默认 true
  size?: 'small' | 'medium' | 'large'; // 默认 'medium'
}

const Modal: React.FC<ModalProps> = ({
  children,
  isOpen,
  onClose,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  size = 'medium',
}) => {
  // ...
};
```

用户只传必须的 Props，其他用默认值就能正常工作。

### 避免 Props 穿透

当组件需要把 Props 传给内部的原生元素时，用展开运算符：

```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'outlined' | 'elevated';
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'outlined',
  className,
  ...rest
}) => {
  return (
    <div
      className={clsx('card', `card-${variant}`, className)}
      {...rest}
    >
      {children}
    </div>
  );
};
```

这样 `id`、`data-*`、`aria-*`、`onClick` 等属性都能直接传递，不需要逐一声明。

## 受控与非受控

这是 React 组件设计中最容易搞混的概念。

### 受控组件

外部完全控制状态：

```typescript
interface InputProps {
  value: string;
  onChange: (value: string) => void;
}

const Input: React.FC<InputProps> = ({ value, onChange }) => {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

// 使用
const [keyword, setKeyword] = useState('');
<Input value={keyword} onChange={setKeyword} />
```

### 非受控组件

组件自己管理状态：

```typescript
interface InputProps {
  defaultValue?: string;
  onChange?: (value: string) => void;
}

const Input: React.FC<InputProps> = ({ defaultValue = '', onChange }) => {
  const [value, setValue] = useState(defaultValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    onChange?.(e.target.value);
  };

  return <input value={value} onChange={handleChange} />;
};
```

### 同时支持两种模式

实际项目中，好的组件应该同时支持受控和非受控：

```typescript
interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

const Input: React.FC<InputProps> = ({
  value: controlledValue,
  defaultValue = '',
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  return <input value={value} onChange={handleChange} />;
};
```

**判断逻辑**：如果传了 `value`，就是受控模式；没传，就是非受控模式。

这种模式在 React 原生表单元素中普遍存在。但有一个常见错误——在非受控模式下传了 `value` 又想改内部状态，这会导致状态不同步。组件需要明确选择一条路径。

### 什么时候用受控，什么时候用非受控

| 场景 | 推荐模式 | 原因 |
|------|----------|------|
| 表单联动 | 受控 | 需要外部协调多个字段 |
| 简单表单 | 非受控 | 减少状态管理开销 |
| 需要即时验证 | 受控 | 每次输入都要处理 |
| 搜索框防抖 | 非受控 | 内部处理更简洁 |
| 需要 ref 取值 | 非受控 | 直接通过 ref 读取 |

## 复合组件模式

当多个组件需要共享状态时，复合组件模式比 Props 传递更优雅。

### 问题：Props 层层传递

```typescript
// 不好：状态需要逐层传递
<Tabs activeKey={key} onChange={setKey}>
  <Tabs.Tab key="info" title="基本信息" disabled={false} />
  <Tabs.Tab key="settings" title="设置" disabled={true} />
  <Tabs.Tab key="logs" title="日志" disabled={false} />
</Tabs>
```

### 方案：Context 共享状态

```typescript
const TabsContext = React.createContext<{
  activeKey: string;
  onChange: (key: string) => void;
} | null>(null);

const Tabs: React.FC<TabsProps> & {
  Tab: React.FC<TabProps>;
} = ({ children, activeKey, onChange }) => {
  return (
    <TabsContext.Provider value={{ activeKey, onChange }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
};

const Tab: React.FC<TabProps> = ({ children, disabled, ...props }) => {
  const { activeKey, onChange } = useTabsContext();
  const isActive = activeKey === props.itemKey;
  
  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && onChange(props.itemKey)}
    >
      {children}
    </button>
  );
};

Tabs.Tab = Tab;
```

### 使用 Compound Components

```typescript
<Tabs activeKey={currentTab} onChange={setCurrentTab}>
  <Tabs.Tab itemKey="info">基本信息</Tabs.Tab>
  <Tabs.Tab itemKey="settings">设置</Tabs.Tab>
  <Tabs.Tab itemKey="logs">日志</Tabs.Tab>
</Tabs>
```

复合组件的好处：Tab 不需要知道其他 Tab 的状态，也不需要父组件逐个传递 Props。Context 处理了共享逻辑。

## 组件的 children 设计

### 基本模式

```typescript
interface AlertProps {
  children: React.ReactNode;
  type: 'info' | 'warning' | 'error' | 'success';
}
```

`React.ReactNode` 是最宽泛的类型，适合大多数场景。

### 更精确的约束

有时候需要限制 children 的类型：

```typescript
interface RadioGroupProps {
  children: React.ReactElement<RadioProps> | React.ReactElement<RadioProps>[];
}

// 只接受 Radio 作为 children
<RadioGroup value={selected} onChange={setSelected}>
  <Radio value="apple">Apple</Radio>
  <Radio value="banana">Banana</Radio>
</RadioGroup>
```

### Render Props

当组件需要把内部状态暴露给消费者时：

```typescript
interface DropdownProps {
  children: (props: {
    isOpen: boolean;
    toggle: () => void;
    ref: React.RefObject<HTMLDivElement>;
  }) => React.ReactNode;
}

const Dropdown: React.FC<DropdownProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return <>{children({ isOpen, toggle: () => setIsOpen(!isOpen), ref })}</>;
};

// 使用
<Dropdown>
  {({ isOpen, toggle, ref }) => (
    <div ref={ref}>
      <button onClick={toggle}>Menu</button>
      {isOpen && <div className="dropdown-menu">...</div>}
    </div>
  )}
</Dropdown>
```

Render Props 在 hooks 时代用得少了，但在需要动态决定渲染内容的场景下仍然有用。

## TypeScript 类型设计

### 泛型组件

```typescript
interface SelectProps<T> {
  options: T[];
  value?: T;
  onChange?: (value: T) => void;
  getLabel: (option: T) => string;
  getKey: (option: T) => string;
}

function Select<T>({ options, value, onChange, getLabel, getKey }: SelectProps<T>) {
  return (
    <select
      value={value ? getKey(value) : undefined}
      onChange={(e) => {
        const selected = options.find((o) => getKey(o) === e.target.value);
        if (selected) onChange?.(selected);
      }}
    >
      {options.map((option) => (
        <option key={getKey(option)} value={getKey(option)}>
          {getLabel(option)}
        </option>
      ))}
    </select>
  );
}

// 使用：类型安全
interface User {
  id: string;
  name: string;
}

<Select<User>
  options={users}
  value={selectedUser}
  onChange={setSelectedUser}
  getLabel={(u) => u.name}
  getKey={(u) => u.id}
/>
```

### Discriminated Unions

用联合类型表达"选了 A 就不需要 B"的约束：

```typescript
type InputProps =
  | {
      type: 'text';
      value: string;
      onChange: (value: string) => void;
      maxLength?: number;
    }
  | {
      type: 'number';
      value: number;
      onChange: (value: number) => void;
      min?: number;
      max?: number;
      step?: number;
    };
```

这样当 `type` 是 `'number'` 时，TypeScript 不会让你传 `maxLength`。

## 常见误区

### 误区一：Props 越多越灵活

Props 多不代表灵活。20 个 Props 的组件，使用者需要理解所有组合才能正确使用。大多数 Props 应该有合理默认值，使用者只关心差异部分。

### 误区二：所有组件都要受控

不需要。简单的 `Tooltip`、`Collapse` 这类交互简单的组件，非受控模式就够了。强制受控反而增加了使用成本。

### 误区三：children 可以传任何东西

`React.ReactNode` 很灵活，但不是所有场景都该用。如果 children 必须是特定类型的组件，用更精确的类型约束能在编译时发现问题。

## 本课小结

1. **命名要一致**：组件用名词，回调用 `on` 前缀，布尔值用 `is`/`has`（或不加，但统一）
2. **Props 要声明式**：描述"要什么"而非"怎么做"，提供合理默认值
3. **受控非受控要共存**：通过 `value` 是否传入判断模式
4. **复合组件优于 Props 穿透**：Context 共享状态比逐层传递更干净
5. **类型约束要精确**：泛型、Discriminated Unions 让 API 在编译时就安全

## 练习

### 练习一：设计一个 SearchInput 组件的 API

要求：
- 支持受控和非受控模式
- 支持防抖（不需要手写，说明 API 怎么设计）
- 支持清空按钮
- 支持 loading 状态

### 练习二：重构 Props 设计

以下组件的 Props 设计有什么问题？如何改进？

```typescript
interface UserCardProps {
  userName: string;
  userAvatar: string;
  userEmail: string;
  userRole: string;
  isOnline: boolean;
  showEmail: boolean;
  showRole: boolean;
  showOnlineStatus: boolean;
  onUserNameClick: () => void;
  onUserAvatarClick: () => void;
  onUserEmailClick: () => void;
}
```

## 参考答案

### 练习一

```typescript
interface SearchInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  debounceMs?: number;        // 默认 300
  allowClear?: boolean;       // 默认 false
  isLoading?: boolean;        // 默认 false
  placeholder?: string;       // 默认 '搜索'
}

const SearchInput: React.FC<SearchInputProps> = ({
  value: controlledValue,
  defaultValue = '',
  onChange,
  onSearch,
  debounceMs = 300,
  allowClear = false,
  isLoading = false,
  placeholder = '搜索',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const debouncedSearch = useCallback(
    debounce((keyword: string) => {
      onSearch?.(keyword);
    }, debounceMs),
    [onSearch, debounceMs]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
    debouncedSearch(newValue);
  };

  const handleClear = () => {
    if (!isControlled) {
      setInternalValue('');
    }
    onChange?.('');
    onSearch?.('');
  };

  return (
    <div className="search-input">
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
      />
      {isLoading && <Spinner size="small" />}
      {allowClear && value && (
        <button onClick={handleClear} aria-label="清空">
          <CloseIcon />
        </button>
      )}
    </div>
  );
};
```

**设计决策**：
- `debounceMs` 有默认值，使用者不需要了解防抖实现
- `onSearch` 是防抖后的回调，`onChange` 是即时回调——区分了"打字"和"搜索"两个意图
- 清空按钮通过 `allowClear` 控制，不需要时默认隐藏

### 练习二

**问题分析**：

1. `userName`、`userAvatar`、`userEmail`、`userRole` 应该合并为一个 `user` 对象
2. `showEmail`、`showRole`、`showOnlineStatus` 用一个 `visibleFields` 更简洁
3. 三个 `onClick` 回调应该统一为 `onFieldClick` 或用 render props

**改进后**：

```typescript
interface User {
  name: string;
  avatar: string;
  email: string;
  role: string;
  isOnline: boolean;
}

interface UserCardProps {
  user: User;
  visibleFields?: Array<'email' | 'role' | 'onlineStatus'>;
  onFieldClick?: (field: string, user: User) => void;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  visibleFields = ['email', 'role', 'onlineStatus'],
  onFieldClick,
}) => {
  return (
    <div className="user-card">
      <img src={user.avatar} alt={user.name} />
      <h3 onClick={() => onFieldClick?.('name', user)}>{user.name}</h3>
      {visibleFields.includes('email') && (
        <p onClick={() => onFieldClick?.('email', user)}>{user.email}</p>
      )}
      {visibleFields.includes('role') && <span>{user.role}</span>}
      {visibleFields.includes('onlineStatus') && (
        <span className={user.isOnline ? 'online' : 'offline'} />
      )}
    </div>
  );
};
```

## 下一步

完成本课后，继续学习 [05. 主题系统与 CSS-in-JS 方案选型](./05-theme-and-css-in-js.md)。
