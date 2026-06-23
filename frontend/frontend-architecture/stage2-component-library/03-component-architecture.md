# 03. 组件库架构设计

> 分层、组合、扩展，建立组件库的架构设计思维

## 本课目标

- 理解组件库的架构设计原则
- 掌握组件的分层设计
- 学会组件的组合和扩展设计
- 建立组件库的架构设计思维

## 组件库的架构设计

### 分层架构

```
Design Token
    ↓
基础组件（Primitive）
    ↓
复合组件（Composite）
    ↓
业务组件（Business）
    ↓
页面模板（Template）
```

**各层的职责**：

1. **Design Token**：设计决策的抽象
   - 颜色、字体、间距、阴影等
   - 不包含业务逻辑

2. **基础组件（Primitive）**：最小可复用单元
   - Button、Input、Typography
   - 不包含业务逻辑
   - 高度可复用

3. **复合组件（Composite）**：多个基础组件的组合
   - Form、Table、Card
   - 可能包含业务逻辑
   - 中等复用性

4. **业务组件（Business）**：特定业务场景的组件
   - UserCard、OrderList
   - 包含业务逻辑
   - 低复用性

5. **页面模板（Template）**：完整页面的模板
   - LoginTemplate、DashboardTemplate
   - 包含完整业务逻辑
   - 最低复用性

### 组件的分层设计

**基础组件**：
```typescript
// Button 组件
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
```

**复合组件**：
```typescript
// SearchInput 组件（复合组件）
interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  placeholder = 'Search...',
}) => {
  const [value, setValue] = useState('');

  const handleSearch = () => {
    onSearch(value);
  };

  return (
    <div className="search-input">
      <Input
        value={value}
        onChange={setValue}
        placeholder={placeholder}
      />
      <Button onClick={handleSearch}>Search</Button>
    </div>
  );
};
```

**业务组件**：
```typescript
// UserCard 组件（业务组件）
interface UserCardProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
  };
  onEdit?: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {
  return (
    <Card>
      <Avatar src={user.avatar} />
      <Typography.Title level={3}>{user.name}</Typography.Title>
      <Typography.Text>{user.email}</Typography.Text>
      {onEdit && (
        <Button onClick={() => onEdit(user.id)}>Edit</Button>
      )}
    </Card>
  );
};
```

## 组件的设计原则

### 1. 单一职责原则

一个组件应该只做一件事。

**正确示例**：
```typescript
// Button 组件只负责按钮的渲染和交互
const Button: React.FC<ButtonProps> = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>;
};
```

**错误示例**：
```typescript
// Button 组件同时负责按钮和表单验证
const Button: React.FC<ButtonProps> = ({ children, onClick, validate }) => {
  const handleClick = () => {
    if (validate && !validate()) {
      return;
    }
    onClick?.();
  };

  return <button onClick={handleClick}>{children}</button>;
};
```

### 2. 开闭原则

对扩展开放，对修改关闭。

**正确示例**：
```typescript
// 通过 props 扩展组件
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  // ... 其他属性
}

const Button: React.FC<ButtonProps> = ({ variant = 'primary', ...props }) => {
  return <button className={`btn-${variant}`} {...props} />;
};
```

**错误示例**：
```typescript
// 通过修改代码扩展组件
const Button: React.FC<ButtonProps> = ({ type, ...props }) => {
  if (type === 'primary') {
    return <button className="btn-primary" {...props} />;
  } else if (type === 'secondary') {
    return <button className="btn-secondary" {...props} />;
  }
  // ... 需要修改代码添加新类型
};
```

### 3. 依赖倒置原则

依赖抽象，不依赖具体实现。

**正确示例**：
```typescript
// 依赖抽象的 Icon 组件
interface IconProps {
  name: string;
  size?: number;
}

const Icon: React.FC<IconProps> = ({ name, size = 16 }) => {
  return <i className={`icon-${name}`} style={{ fontSize: size }} />;
};

// 使用
<Icon name="search" size={20} />
```

**错误示例**：
```typescript
// 依赖具体的图标库
import { SearchIcon } from 'react-icons/fa';

const SearchButton: React.FC = () => {
  return (
    <button>
      <SearchIcon size={20} />
    </button>
  );
};
```

### 4. 接口隔离原则

接口应该小而专一。

**正确示例**：
```typescript
// 分离不同的接口
interface ButtonBaseProps {
  children: React.ReactNode;
  onClick?: () => void;
}

interface ButtonVariantProps {
  variant?: 'primary' | 'secondary' | 'danger';
}

interface ButtonSizeProps {
  size?: 'small' | 'medium' | 'large';
}

type ButtonProps = ButtonBaseProps & ButtonVariantProps & ButtonSizeProps;
```

**错误示例**：
```typescript
// 一个大而全的接口
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  // ... 很多属性
}
```

## 组件的组合设计

### 组件组合模式

**1. 组件嵌套**：
```typescript
<Card>
  <Card.Header>
    <Typography.Title>Card Title</Typography.Title>
  </Card.Header>
  <Card.Body>
    <Typography.Text>Card content</Typography.Text>
  </Card.Body>
  <Card.Footer>
    <Button>Action</Button>
  </Card.Footer>
</Card>
```

**2. 组件组合**：
```typescript
const SearchForm: React.FC = () => {
  return (
    <Form>
      <Form.Item label="Search">
        <Input placeholder="Enter search term" />
      </Form.Item>
      <Form.Item>
        <Button type="primary">Search</Button>
      </Form.Item>
    </Form>
  );
};
```

**3. 组件继承**：
```typescript
const PrimaryButton: React.FC<ButtonProps> = (props) => {
  return <Button variant="primary" {...props} />;
};
```

### 组件嵌套设计

**Card 组件示例**：
```typescript
// Card 组件
interface CardProps {
  children: React.ReactNode;
}

interface CardHeaderProps {
  children: React.ReactNode;
}

interface CardBodyProps {
  children: React.ReactNode;
}

interface CardFooterProps {
  children: React.ReactNode;
}

const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>;
  Body: React.FC<CardBodyProps>;
  Footer: React.FC<CardFooterProps>;
} = ({ children }) => {
  return <div className="card">{children}</div>;
};

Card.Header = ({ children }) => {
  return <div className="card-header">{children}</div>;
};

Card.Body = ({ children }) => {
  return <div className="card-body">{children}</div>;
};

Card.Footer = ({ children }) => {
  return <div className="card-footer">{children}</div>;
};
```

**使用示例**：
```typescript
<Card>
  <Card.Header>
    <Typography.Title>Card Title</Typography.Title>
  </Card.Header>
  <Card.Body>
    <Typography.Text>Card content</Typography.Text>
  </Card.Body>
  <Card.Footer>
    <Button>Action</Button>
  </Card.Footer>
</Card>
```

### 组件组合设计

**Form 组件示例**：
```typescript
// Form 组件
interface FormProps {
  children: React.ReactNode;
  onSubmit?: (values: Record<string, any>) => void;
}

interface FormItemProps {
  label: string;
  children: React.ReactNode;
}

const Form: React.FC<FormProps> & {
  Item: React.FC<FormItemProps>;
} = ({ children, onSubmit }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({});
  };

  return (
    <form onSubmit={handleSubmit}>
      {children}
    </form>
  );
};

Form.Item = ({ label, children }) => {
  return (
    <div className="form-item">
      <label>{label}</label>
      {children}
    </div>
  );
};
```

**使用示例**：
```typescript
<Form onSubmit={handleSubmit}>
  <Form.Item label="Username">
    <Input placeholder="Enter username" />
  </Form.Item>
  <Form.Item label="Password">
    <Input type="password" placeholder="Enter password" />
  </Form.Item>
  <Form.Item>
    <Button type="primary">Submit</Button>
  </Form.Item>
</Form>
```

## 组件的扩展设计

### Props 扩展

**基础 Props**：
```typescript
interface ButtonBaseProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}
```

**扩展 Props**：
```typescript
interface ButtonVariantProps {
  variant?: 'primary' | 'secondary' | 'danger';
}

interface ButtonSizeProps {
  size?: 'small' | 'medium' | 'large';
}

interface ButtonIconProps {
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

type ButtonProps = ButtonBaseProps &
  ButtonVariantProps &
  ButtonSizeProps &
  ButtonIconProps;
```

### 样式扩展

**className 扩展**：
```typescript
interface ButtonProps {
  className?: string;
  style?: React.CSSProperties;
  // ... 其他属性
}

const Button: React.FC<ButtonProps> = ({
  className,
  style,
  ...props
}) => {
  return (
    <button
      className={classNames('btn', className)}
      style={style}
      {...props}
    />
  );
};
```

**styled-components 扩展**：
```typescript
import styled from 'styled-components';

const StyledButton = styled.button`
  background: ${(props) => props.theme.colors.primary};
  color: white;
  padding: ${(props) => props.theme.spacing.md};
`;

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({ children, ...props }) => {
  return <StyledButton {...props}>{children}</StyledButton>;
};
```

### 行为扩展

**事件扩展**：
```typescript
interface ButtonProps {
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  // ... 其他事件
}

const Button: React.FC<ButtonProps> = ({ onClick, ...props }) => {
  return <button onClick={onClick} {...props} />;
};
```

**Ref 扩展**：
```typescript
interface ButtonProps {
  ref?: React.Ref<HTMLButtonElement>;
  // ... 其他属性
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, ...props }, ref) => {
    return (
      <button ref={ref} {...props}>
        {children}
      </button>
    );
  }
);
```

## 组件的状态管理

### 内部状态

```typescript
interface CounterProps {
  initialCount?: number;
}

const Counter: React.FC<CounterProps> = ({ initialCount = 0 }) => {
  const [count, setCount] = useState(initialCount);

  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
};
```

### 外部状态

```typescript
interface CounterProps {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

const Counter: React.FC<CounterProps> = ({
  count,
  onIncrement,
  onDecrement,
}) => {
  return (
    <div>
      <button onClick={onDecrement}>-</button>
      <span>{count}</span>
      <button onClick={onIncrement}>+</button>
    </div>
  );
};
```

### 混合状态

```typescript
interface CounterProps {
  defaultCount?: number;
  count?: number;
  onCountChange?: (count: number) => void;
}

const Counter: React.FC<CounterProps> = ({
  defaultCount = 0,
  count: controlledCount,
  onCountChange,
}) => {
  const [internalCount, setInternalCount] = useState(defaultCount);
  const count = controlledCount ?? internalCount;

  const setCount = (newCount: number) => {
    if (controlledCount === undefined) {
      setInternalCount(newCount);
    }
    onCountChange?.(newCount);
  };

  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
};
```

## 实战：设计组件库架构

### 项目结构

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── Button.stories.tsx
│   │   │   └── index.ts
│   │   ├── Input/
│   │   │   ├── Input.tsx
│   │   │   ├── Input.test.tsx
│   │   │   ├── Input.stories.tsx
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useTheme.ts
│   │   └── index.ts
│   ├── styles/
│   │   ├── theme.ts
│   │   └── index.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

### 组件实现

```typescript
// src/components/Button/Button.tsx
import React from 'react';
import { useTheme } from '../../hooks';
import { ButtonProps } from './types';

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  className,
  style,
  ...props
}) => {
  const theme = useTheme();

  const baseStyles = {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius,
    fontSize: theme.typography.fontSize,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };

  const variantStyles = {
    primary: {
      background: theme.colors.primary,
      color: 'white',
    },
    secondary: {
      background: theme.colors.secondary,
      color: 'white',
    },
    danger: {
      background: theme.colors.error,
      color: 'white',
    },
  };

  const sizeStyles = {
    small: { padding: theme.spacing.sm },
    medium: { padding: theme.spacing.md },
    large: { padding: theme.spacing.lg },
  };

  return (
    <button
      style={{
        ...baseStyles,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      disabled={disabled}
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
};
```

### 类型定义

```typescript
// src/components/Button/types.ts
export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
```

### 导出

```typescript
// src/components/Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './types';
```

```typescript
// src/components/index.ts
export * from './Button';
export * from './Input';
```

```typescript
// src/index.ts
export * from './components';
export * from './hooks';
export * from './styles';
```

## 常见问题

### Q: 如何设计组件的 Props？

A: 遵循单一职责原则，每个 Prop 只负责一个功能。使用 TypeScript 类型定义，提供清晰的接口。

### Q: 如何处理组件的状态？

A: 根据组件的使用场景选择状态管理方式。简单组件使用内部状态，复杂组件使用外部状态或混合状态。

### Q: 如何扩展组件？

A: 通过 Props 扩展、样式扩展、行为扩展等方式扩展组件。遵循开闭原则，对扩展开放，对修改关闭。

## 本课小结

本课我们掌握了组件库架构设计：

1. **分层架构**：Design Token → 基础组件 → 复合组件 → 业务组件 → 页面模板
2. **设计原则**：单一职责、开闭原则、依赖倒置、接口隔离
3. **组合设计**：组件嵌套、组件组合、组件继承
4. **扩展设计**：Props 扩展、样式扩展、行为扩展
5. **状态管理**：内部状态、外部状态、混合状态

## 练习

### 练习一：设计组件架构

为一个表单组件设计架构，包括：
- Form 组件
- FormItem 组件
- Input 组件
- Button 组件

### 练习二：实现组件组合

实现一个 SearchForm 组件，组合使用 Form、Input、Button 组件。

## 参考答案

### 练习一

**组件架构设计**：
```typescript
// Form 组件
interface FormProps {
  children: React.ReactNode;
  onSubmit?: (values: Record<string, any>) => void;
}

// FormItem 组件
interface FormItemProps {
  label: string;
  children: React.ReactNode;
}

// Input 组件
interface InputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

// Button 组件
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'primary' | 'secondary';
}
```

### 练习二

**SearchForm 组件实现**：
```typescript
const SearchForm: React.FC = () => {
  const [keyword, setKeyword] = useState('');

  const handleSearch = () => {
    console.log('Searching for:', keyword);
  };

  return (
    <Form onSubmit={handleSearch}>
      <Form.Item label="Keyword">
        <Input
          value={keyword}
          onChange={setKeyword}
          placeholder="Enter keyword"
        />
      </Form.Item>
      <Form.Item>
        <Button type="primary" onClick={handleSearch}>
          Search
        </Button>
      </Form.Item>
    </Form>
  );
};
```

## 下一步

完成本课后，继续学习 [04. 组件开发规范与 API 设计原则](./04-component-api-design.md)。
