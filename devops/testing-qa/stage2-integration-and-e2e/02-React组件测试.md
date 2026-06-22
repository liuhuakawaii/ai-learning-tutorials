# React 组件测试

## 场景引入

你写了搜索组件的测试：`expect(wrapper.find('.search-input').props().value).toBe('hello')`。两周后重构把类名改成了 `search-field`，测试挂了。但功能没变——用户依然能搜索。

问题出在测试绑定了实现细节。Testing Library 的哲学：**测试用户行为，而不是实现。**

## 学习目标

- 理解 Testing Library 设计哲学
- 使用 render、fireEvent、userEvent 测试组件
- 掌握表单提交、异步加载、条件渲染测试
- 学会用 Provider 包装测试组件

---

## 基础测试：render 和 screen

```typescript
// src/components/Greeting.tsx
export function Greeting({ name }: { name: string }) {
  return <div><h1>你好，{name}！</h1><p>欢迎使用</p></div>
}

// tests/Greeting.test.tsx
import { render, screen } from '@testing-library/react'
import { Greeting } from '../src/components/Greeting'

describe('Greeting', () => {
  it('显示问候语', () => {
    render(<Greeting name="张三" />)
    expect(screen.getByRole('heading', { name: /你好，张三/ })).toBeInTheDocument()
    expect(screen.getByText('欢迎使用')).toBeInTheDocument()
  })
})
```

优先用 `getByRole`（语义角色），其次 `getByText`，最后 `getByTestId`。

---

## 测试用户交互

```typescript
// src/components/Toggle.tsx
export function Toggle() {
  const [isOn, setIsOn] = useState(false)
  return (
    <div>
      <button onClick={() => setIsOn(!isOn)}>{isOn ? '已开启' : '已关闭'}</button>
      {isOn && <p>功能已激活</p>}
    </div>
  )
}

// tests/Toggle.test.tsx
import userEvent from '@testing-library/user-event'

describe('Toggle', () => {
  it('点击切换状态', async () => {
    const user = userEvent.setup()
    render(<Toggle />)
    expect(screen.getByRole('button', { name: '已关闭' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '已关闭' }))
    expect(screen.getByRole('button', { name: '已开启' })).toBeInTheDocument()
    expect(screen.getByText('功能已激活')).toBeInTheDocument()
  })
})
```

`userEvent` 比 `fireEvent` 更接近真实用户——触发完整事件序列（focus → keydown → keypress → keyup → click）。

---

## 测试表单提交

```typescript
// src/components/LoginForm.tsx
export function LoginForm({ onSubmit }: { onSubmit: (c: { email: string; password: string }) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('请填写所有字段'); return }
    setLoading(true)
    try { await onSubmit({ email, password }) }
    catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">邮箱</label>
      <input id="email" value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="password">密码</label>
      <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={loading}>{loading ? '登录中...' : '登录'}</button>
    </form>
  )
}
```

```typescript
// tests/LoginForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('LoginForm', () => {
  it('空表单提交显示错误', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSubmit={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(screen.getByRole('alert')).toHaveTextContent('请填写所有字段')
  })

  it('填写后提交成功', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    render(<LoginForm onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText('邮箱'), 'test@example.com')
    await user.type(screen.getByLabelText('密码'), 'pass123')
    await user.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com', password: 'pass123' })
    })
  })

  it('提交失败显示错误', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn().mockRejectedValue(new Error('账号或密码错误'))
    render(<LoginForm onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText('邮箱'), 'test@example.com')
    await user.type(screen.getByLabelText('密码'), 'wrong')
    await user.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('账号或密码错误')
    })
  })
})
```

---

## 测试异步加载

```typescript
// src/components/UserList.tsx
export function UserList({ fetchUsers }: { fetchUsers: () => Promise<{ id: number; name: string }[]> }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    fetchUsers().then(setUsers).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [fetchUsers])
  if (loading) return <p>加载中...</p>
  if (error) return <p role="alert">加载失败：{error}</p>
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
}

// tests/UserList.test.tsx
describe('UserList', () => {
  it('加载成功显示列表', async () => {
    const fetchUsers = jest.fn().mockResolvedValue([{ id: 1, name: '张三' }])
    render(<UserList fetchUsers={fetchUsers} />)
    expect(screen.getByText('加载中...')).toBeInTheDocument()
    expect(await screen.findByText('张三')).toBeInTheDocument()
    expect(screen.queryByText('加载中...')).not.toBeInTheDocument()
  })

  it('加载失败显示错误', async () => {
    const fetchUsers = jest.fn().mockRejectedValue(new Error('网络错误'))
    render(<UserList fetchUsers={fetchUsers} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('加载失败：网络错误')
  })
})
```

`findByText` 是异步的，会等待元素出现（默认 1000ms）。

---

## 测试 Context Provider

```typescript
// src/context/ThemeContext.tsx
const ThemeContext = createContext<{ theme: string; toggleTheme: () => void } | null>(null)
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(p => p === 'light' ? 'dark' : 'light') }}>
      {children}
    </ThemeContext.Provider>
  )
}
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}

// src/components/ThemeToggle.tsx
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return <button onClick={toggleTheme}>当前主题：{theme === 'light' ? '浅色' : '深色'}</button>
}

// tests/ThemeToggle.test.tsx
function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe('ThemeToggle', () => {
  it('显示浅色主题', () => {
    renderWithTheme(<ThemeToggle />)
    expect(screen.getByRole('button', { name: /浅色/ })).toBeInTheDocument()
  })

  it('点击切换为深色', async () => {
    const user = userEvent.setup()
    renderWithTheme(<ThemeToggle />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('button', { name: /深色/ })).toBeInTheDocument()
  })
})
```

封装 `renderWithTheme` 避免重复写 Provider 包装。

---

## 常见误区

1. **测试实现细节**：断言 state 值、className、内部节点。只断言用户可见行为。
2. **手动用 `act` 包装**：Testing Library 内部已处理，出现警告通常是异步未 `await`。
3. **忘记等待异步更新**：用 `waitFor` 或 `findBy` 等待异步渲染。
4. **全局 mock 一切**：通过 props 注入依赖优于 mock 全局函数。

---

## 工程建议

- 测试文件和组件文件同目录
- 为常用 Provider 创建自定义 `render` 函数
- 优先 `userEvent` 而非 `fireEvent`
- `screen.debug()` 打印当前 DOM 帮助调试
- 按用户故事组织测试

---

## 小结

- Testing Library 核心是测试用户行为而非实现
- `getByRole` 和 `getByText` 是最常用查询
- `userEvent` 模拟完整用户交互序列
- `findBy*` 处理异步内容，`waitFor` 等待状态变化
- Provider 包装函数统一处理 Context 依赖

---

## 练习

### 练习一：计数器测试
为 Counter 组件编写测试：显示初始值、点击增加、点击减少、禁止减少到负数。

### 练习二：搜索组件测试
为搜索组件编写测试：输入关键词 → 显示"搜索中..." → 显示结果列表。

### 练习三：受控表单测试
为多字段表单编写测试：必填校验、格式校验、提交成功后的状态变化。

---

## 参考答案

### 练习一

```typescript
function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial)
  return (
    <div>
      <p>当前计数：{count}</p>
      <button onClick={() => setCount(c => c + 1)}>增加</button>
      <button onClick={() => setCount(c => Math.max(0, c - 1))} disabled={count === 0}>减少</button>
    </div>
  )
}

describe('Counter', () => {
  it('显示初始值', () => { render(<Counter initial={5} />); expect(screen.getByText('当前计数：5')).toBeInTheDocument() })
  it('点击增加', async () => { const u = userEvent.setup(); render(<Counter />); await u.click(screen.getByRole('button', { name: '增加' })); expect(screen.getByText('当前计数：1')).toBeInTheDocument() })
  it('减少禁用', () => { render(<Counter />); expect(screen.getByRole('button', { name: '减少' })).toBeDisabled() })
})
```

### 练习二

```typescript
function SearchBox({ onSearch }: { onSearch: (q: string) => Promise<string[]> }) {
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  return (
    <div>
      <input placeholder="搜索" onKeyDown={async e => {
        if (e.key === 'Enter') { setLoading(true); setResults(await onSearch((e.target as HTMLInputElement).value)); setLoading(false) }
      }} />
      {loading && <p>搜索中...</p>}
      <ul>{results.map(r => <li key={r}>{r}</li>)}</ul>
    </div>
  )
}

describe('SearchBox', () => {
  it('搜索后显示结果', async () => {
    const user = userEvent.setup()
    render(<SearchBox onSearch={jest.fn().mockResolvedValue(['结果1', '结果2'])} />)
    await user.type(screen.getByPlaceholderText('搜索'), 'React{Enter}')
    expect(screen.getByText('搜索中...')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('结果1')).toBeInTheDocument())
    expect(screen.queryByText('搜索中...')).not.toBeInTheDocument()
  })
})
```

### 练习三

```typescript
describe('ContactForm', () => {
  it('空字段显示必填提示', async () => {
    const user = userEvent.setup(); render(<ContactForm onSubmit={jest.fn()} />)
    await user.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByText('姓名不能为空')).toBeInTheDocument()
  })

  it('提交成功', async () => {
    const user = userEvent.setup(); const onSubmit = jest.fn().mockResolvedValue(undefined)
    render(<ContactForm onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText('姓名'), '张三')
    await user.type(screen.getByLabelText('邮箱'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: '提交' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })
})
```
