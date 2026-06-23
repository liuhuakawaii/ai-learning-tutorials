# jQuery 到 React 迁移

## 场景引入

你接手了一个运营了五年的电商平台前端项目。整个项目用 jQuery 写成，超过 80 个页面，累计 12 万行 JS 代码。每次改需求都要在十几个文件里搜索 DOM 操作，改一个下拉联动逻辑牵扯三个事件监听器和两个全局变量。产品经理说要加一个实时搜索过滤功能，你看了看现有的 `$(document).ready()` 里嵌套了七层的回调，默默叹了口气。

这不是个例。根据 2025 年 State of JS 调查，仍有 21% 的项目在使用 jQuery，其中大部分面临维护困难。React 以声明式 UI、组件化架构和成熟的生态成为最常见的迁移目标。但迁移不是重写——你不能把业务停三个月从零开始。本课讲的是如何在保持业务连续性的前提下，系统地把 jQuery 项目迁移到 React。

## 学习目标

完成本课学习后，你将能够：

1. 将 jQuery 的事件处理模式转换为 React 的合成事件系统
2. 将命令式 DOM 操作转换为声明式的状态驱动渲染
3. 将 jQuery AJAX 调用迁移到 fetch + react-query 的数据获取模式
4. 将 jQuery 插件封装为 React 组件或替换为 React 生态方案
5. 制定微前端架构下的渐进式迁移策略

## 核心概念

### 一、事件处理的转换

jQuery 和 React 处理事件的哲学完全不同。jQuery 是"找到元素，绑定事件"，React 是"描述 UI，声明事件"。

```
jQuery 模式：
  document ready → find DOM element → attach event listener → manipulate DOM

React 模式：
  render → declare event handler in JSX → React manages event binding/unbinding
```

**jQuery 的事件模型**依赖于直接操作 DOM 节点。你用选择器找到元素，然后在上面绑定回调。这种方式在小项目里直观，但在大项目里会导致事件绑定分散在各处，难以追踪数据流向。

**React 的合成事件**（SyntheticEvent）在组件层面声明事件处理器。组件卸载时自动解绑，不需要手动管理生命周期。更重要的是，事件处理器和渲染逻辑在同一个组件里，数据流向一目了然。

### 二、从 DOM 操作到状态管理

这是迁移中最核心的思维转变。jQuery 通过直接修改 DOM 来反映变化，React 通过修改状态来触发重新渲染。

```
jQuery 思维：
  用户点击 → 找到元素 → 添加/移除 class → 修改 display 属性 → 更新文本

React 思维：
  用户点击 → 更新 state → React 自动重新渲染 → UI 反映新状态
```

### 三、AJAX 到数据获取层

jQuery 时代用 `$.ajax`、`$.get`、`$.post`。现代 React 用 fetch API 配合 react-query（TanStack Query）管理服务端状态，包括缓存、重试、乐观更新等。

### 四、jQuery 插件的归宿

jQuery 生态有大量插件（日期选择器、轮播图、富文本编辑器等）。迁移时有三种策略：直接替换为 React 组件库、用 useRef 封装 jQuery 插件、或者用 Web Component 作为桥接层。

### 五、微前端渐进迁移

对于大型项目，不可能一次性迁移。微前端允许 jQuery 和 React 共存，按模块逐步替换。

```
微前端迁移架构：

┌─────────────────────────────────────────────┐
│              主应用容器 (qiankun/Module Federation)        │
├──────────────┬──────────────┬───────────────┤
│  jQuery 子应用   │  React 子应用    │  jQuery 子应用      │
│  (商品列表)      │  (订单中心)      │  (用户设置)         │
│  待迁移          │  已迁移          │  待迁移             │
└──────────────┴──────────────┴───────────────┘
       ↓                                    ↓
   逐步迁移到 React                      逐步迁移到 React
```

## 完整代码示例

### 示例一：事件处理迁移

**迁移前：jQuery 事件绑定**

```javascript
// jQuery 版本：商品筛选器
$(document).ready(function () {
  var currentCategory = 'all';
  var currentSort = 'default';

  // 分类按钮点击
  $('.category-btn').on('click', function () {
    $('.category-btn').removeClass('active');
    $(this).addClass('active');
    currentCategory = $(this).data('category');
    loadProducts(currentCategory, currentSort);
  });

  // 排序下拉变更
  $('#sort-select').on('change', function () {
    currentSort = $(this).val();
    loadProducts(currentCategory, currentSort);
  });

  // 商品卡片点击（事件委托）
  $('#product-list').on('click', '.product-card', function () {
    var productId = $(this).data('id');
    window.location.href = '/product/' + productId;
  });

  function loadProducts(category, sort) {
    $('#product-list').html('<div class="loading">加载中...</div>');
    $.ajax({
      url: '/api/products',
      data: { category: category, sort: sort },
      success: function (products) {
        var html = '';
        products.forEach(function (product) {
          html += '<div class="product-card" data-id="' + product.id + '">';
          html += '<h3>' + product.name + '</h3>';
          html += '<span class="price">¥' + product.price + '</span>';
          html += '</div>';
        });
        $('#product-list').html(html);
      },
      error: function () {
        $('#product-list').html('<div class="error">加载失败，请重试</div>');
      }
    });
  }

  loadProducts('all', 'default');
});
```

**迁移后：React 函数组件 + react-query**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  price: number;
}

async function fetchProducts(category: string, sort: string): Promise<Product[]> {
  const params = new URLSearchParams({ category, sort });
  const response = await fetch(`/api/products?${params}`);
  if (!response.ok) {
    throw new Error('商品加载失败');
  }
  return response.json();
}

const CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: 'electronics', label: '数码' },
  { value: 'clothing', label: '服饰' },
  { value: 'food', label: '食品' },
];

export function ProductFilter() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortOption, setSortOption] = useState('default');
  const navigate = useNavigate();

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products', activeCategory, sortOption],
    queryFn: () => fetchProducts(activeCategory, sortOption),
    staleTime: 30_000,
  });

  function handleProductClick(productId: string) {
    navigate(`/product/${productId}`);
  }

  return (
    <div className="product-filter">
      <nav className="category-bar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            className={`category-btn ${activeCategory === cat.value ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </nav>

      <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
        <option value="default">默认排序</option>
        <option value="price-asc">价格从低到高</option>
        <option value="price-desc">价格从高到低</option>
        <option value="sales">销量优先</option>
      </select>

      <div className="product-list">
        {isLoading && <div className="loading">加载中...</div>}
        {error && <div className="error">加载失败，请重试</div>}
        {products?.map((product) => (
          <div
            key={product.id}
            className="product-card"
            onClick={() => handleProductClick(product.id)}
          >
            <h3>{product.name}</h3>
            <span className="price">¥{product.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**关键差异分析：**

| 维度 | jQuery 版本 | React 版本 |
|------|-----------|-----------|
| 状态存储 | 全局变量 `currentCategory` | `useState` 组件状态 |
| 事件绑定 | `.on('click', ...)` 手动绑定 | JSX 中声明 `onClick` |
| 事件委托 | `$('#product-list').on('click', '.product-card', ...)` | 直接绑定在每个元素上（React 自动优化） |
| DOM 更新 | `$.html()` 手动拼接字符串 | 条件渲染 + `.map()` |
| 数据获取 | `$.ajax` 手动管理 | `useQuery` 自动缓存/重试 |
| 加载/错误状态 | 手动切换 DOM 内容 | 状态驱动条件渲染 |

### 示例二：DOM 操作到条件渲染

**迁移前：jQuery 模态框和表单验证**

```javascript
// jQuery 版本：用户注册弹窗
$(document).ready(function () {
  // 打开弹窗
  $('#open-register').on('click', function () {
    $('#register-modal').show();
    $('#overlay').addClass('visible');
    $('body').addClass('modal-open');
  });

  // 关闭弹窗
  $('#close-register, #overlay').on('click', function () {
    $('#register-modal').hide();
    $('#overlay').removeClass('visible');
    $('body').removeClass('modal-open');
    clearErrors();
  });

  // 表单验证
  $('#register-form').on('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var username = $('#username').val().trim();
    var email = $('#email').val().trim();
    var password = $('#password').val();
    var confirmPassword = $('#confirm-password').val();
    var isValid = true;

    if (username.length < 3) {
      showError('username', '用户名至少 3 个字符');
      isValid = false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('email', '请输入有效的邮箱地址');
      isValid = false;
    }

    if (password.length < 8) {
      showError('password', '密码至少 8 位');
      isValid = false;
    }

    if (password !== confirmPassword) {
      showError('confirm-password', '两次密码不一致');
      isValid = false;
    }

    if (isValid) {
      submitRegistration(username, email, password);
    }
  });

  function showError(field, message) {
    $('#' + field).addClass('input-error');
    $('#' + field + '-error').text(message).show();
  }

  function clearErrors() {
    $('.input-error').removeClass('input-error');
    $('.field-error').text('').hide();
  }

  function submitRegistration(username, email, password) {
    $('#submit-btn').prop('disabled', true).text('提交中...');
    $.ajax({
      url: '/api/register',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ username, email, password }),
      success: function () {
        $('#register-modal').hide();
        $('#overlay').removeClass('visible');
        $('body').removeClass('modal-open');
        showToast('注册成功！');
      },
      error: function (xhr) {
        var msg = xhr.responseJSON?.message || '注册失败';
        showError('username', msg);
      },
      complete: function () {
        $('#submit-btn').prop('disabled', false).text('注册');
      }
    });
  }
});
```

**迁移后：React 组件 + 自定义 Hook**

```tsx
import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function validateForm(form: RegisterForm): FormErrors {
  const errors: FormErrors = {};

  if (form.username.trim().length < 3) {
    errors.username = '用户名至少 3 个字符';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = '请输入有效的邮箱地址';
  }

  if (form.password.length < 8) {
    errors.password = '密码至少 8 位';
  }

  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = '两次密码不一致';
  }

  return errors;
}

async function submitRegistration(data: Omit<RegisterForm, 'confirmPassword'>) {
  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.message || '注册失败');
  }
  return response.json();
}

export function RegisterModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<RegisterForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const registerMutation = useMutation({
    mutationFn: submitRegistration,
    onSuccess: () => {
      onClose();
    },
  });

  const updateField = useCallback(
    (field: keyof RegisterForm, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      // 用户输入时清除该字段的错误
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validateForm(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length === 0) {
      registerMutation.mutate({
        username: form.username,
        email: form.email,
        password: form.password,
      });
    }
  }

  return (
    <>
      <div className="overlay visible" onClick={onClose} />
      <div className="modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h2>用户注册</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="reg-username">用户名</label>
            <input
              id="reg-username"
              value={form.username}
              onChange={(e) => updateField('username', e.target.value)}
              className={errors.username ? 'input-error' : ''}
            />
            {errors.username && <span className="field-error">{errors.username}</span>}
          </div>

          <div className="field">
            <label htmlFor="reg-email">邮箱</label>
            <input
              id="reg-email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              className={errors.email ? 'input-error' : ''}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="field">
            <label htmlFor="reg-password">密码</label>
            <input
              id="reg-password"
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              className={errors.password ? 'input-error' : ''}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div className="field">
            <label htmlFor="reg-confirm">确认密码</label>
            <input
              id="reg-confirm"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              className={errors.confirmPassword ? 'input-error' : ''}
            />
            {errors.confirmPassword && (
              <span className="field-error">{errors.confirmPassword}</span>
            )}
          </div>

          {registerMutation.isError && (
            <div className="server-error">{registerMutation.error.message}</div>
          )}

          <button type="submit" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? '提交中...' : '注册'}
          </button>
        </form>
      </div>
    </>
  );
}
```

### 示例三：jQuery 插件封装为 React 组件

很多 jQuery 项目依赖插件，比如日期选择器。迁移时不能一步到位替换所有插件，需要用 `useRef` 桥接。

**封装 jQuery 日期选择器为 React 组件**

```tsx
import { useEffect, useRef } from 'react';

// 假设项目中使用了 jquery-ui 的 datepicker
// 迁移策略：先封装，后续替换为 react-datepicker
interface LegacyDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
}

export function LegacyDatePicker({
  value,
  onChange,
  minDate,
  maxDate,
}: LegacyDatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    const $input = window.$(inputRef.current);

    $input.datepicker({
      dateFormat: 'yy-mm-dd',
      minDate: minDate || null,
      maxDate: maxDate || null,
      onSelect: (dateText: string) => {
        onChange(dateText);
      },
    });

    $input.datepicker('setDate', value);

    // 清理：组件卸载时销毁插件实例
    return () => {
      $input.datepicker('destroy');
    };
  }, []); // 只初始化一次

  // 当外部 value 变化时同步
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      window.$(inputRef.current).datepicker('setDate', value);
    }
  }, [value]);

  return <input ref={inputRef} type="text" className="legacy-datepicker" />;
}

// 使用示例
export function OrderSearchForm() {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-12-31');

  return (
    <div className="order-search">
      <label>起始日期</label>
      <LegacyDatePicker value={startDate} onChange={setStartDate} />
      <label>结束日期</label>
      <LegacyDatePicker value={endDate} onChange={setEndDate} maxDate="2025-12-31" />
    </div>
  );
}
```

封装完成后，后续可以将 `LegacyDatePicker` 内部替换为 `react-datepicker`，外部 API 不变，调用方无需修改。

### 示例四：微前端渐进迁移

使用 qiankun 实现 jQuery 和 React 共存。

**主应用注册子应用**

```typescript
// main-app/src/index.ts
import { registerMicroApps, start, setDefaultMountApp } from 'qiankun';

registerMicroApps([
  {
    name: 'legacy-order',
    entry: '//localhost:8081',  // jQuery 老项目
    container: '#subapp-container',
    activeRule: '/order',
  },
  {
    name: 'react-product',
    entry: '//localhost:8082',  // React 新项目
    container: '#subapp-container',
    activeRule: '/product',
  },
]);

setDefaultMountApp('/order');
start({ sandbox: { strictStyleIsolation: true } });
```

**jQuery 子应用改造为 qiankun 生命周期**

```javascript
// legacy-order/src/public-path.js
if (window.__POWERED_BY_QIANKUN__) {
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}

// legacy-order/src/index.js
let appInstance = null;

export async function bootstrap() {
  console.log('jQuery 子应用启动');
}

export async function mount(props) {
  console.log('jQuery 子应用挂载', props);
  // 初始化 jQuery 应用
  appInstance = initOrderApp(props.container);
}

export async function unmount() {
  console.log('jQuery 子应用卸载');
  // 清理 jQuery 事件绑定和 DOM
  if (appInstance) {
    appInstance.destroy();
    appInstance = null;
  }
}

function initOrderApp(container) {
  const $root = container
    ? window.$(container).find('#order-app')
    : window.$('#order-app');

  // 原有的 jQuery 初始化逻辑
  initOrderList($root);
  initOrderFilter($root);
  initOrderDetail($root);

  return {
    destroy() {
      $root.off(); // 解绑所有事件
      $root.empty(); // 清空 DOM
    },
  };
}
```

## 常见误区

### 误区一：迁移就是把 `$('selector')` 换成 `document.querySelector`

很多人把 React 当成"带 JSX 的 jQuery"，只是换了选择器，思维还是命令式的。迁移的本质是**从命令式 DOM 操作转为声明式状态驱动**。如果迁移后你的代码里还有 `document.getElementById` 或 `ref.current.style.display = 'none'`，说明还没有真正完成思维转换。

### 误区二：一次性全部重写

对于有实际用户的项目，一次性重写风险极高。正确做法是按路由/模块逐步迁移，用微前端或模块联邦实现共存。先把低频、独立的模块迁移过来积累经验，再攻克核心业务模块。

### 误区三：迁移后性能一定更好

React 的虚拟 DOM 在大量节点更新时有开销。如果你的页面是简单的表单提交 + 静态展示，jQuery 的直接 DOM 操作反而更快。迁移的主要收益是**可维护性和开发效率**，不是性能。如果性能是首要目标，先做性能分析再决定。

### 误区四：所有 jQuery 插件都要立刻替换

项目里用了 20 个 jQuery 插件，不可能全部一次性替换。策略是：高频使用的核心插件（如表格、日期选择器）优先替换为 React 组件库，低频插件用 `useRef` 封装过渡，极低频的第三方嵌入可以保留原样。

### 误区五：忽略全局状态的迁移

jQuery 项目里大量使用全局变量和 `window` 对象传递状态。迁移时需要识别这些隐式的全局状态，逐步收敛到 React 的 Context、zustand 或 redux 中。可以用 `window.__LEGACY_STATE__` 作为过渡桥接，让新旧模块都能访问共享状态。

## 小结与练习

### 小结

本课围绕 jQuery 到 React 的迁移，从五个核心维度展开：

1. **事件处理**：从手动绑定/解绑转为 JSX 声明式事件，React 自动管理生命周期
2. **DOM 操作**：从命令式 `$.addClass`/`$.show` 转为状态驱动的条件渲染
3. **数据获取**：从 `$.ajax` 转为 fetch + react-query，获得自动缓存和重试
4. **插件迁移**：用 `useRef` 桥接 jQuery 插件，逐步替换为 React 生态
5. **迁移策略**：用微前端实现新旧共存，按模块渐进迁移

迁移的核心不是代码层面的语法替换，而是从"操作 DOM"到"描述 UI"的思维转变。

### 练习

#### 练习一：事件处理迁移

将以下 jQuery 代码迁移为 React 组件：

```javascript
// 一个简单的待办事项列表，支持添加、删除、标记完成
$(document).ready(function () {
  var todos = [];

  $('#add-todo').on('click', function () {
    var text = $('#todo-input').val().trim();
    if (text) {
      todos.push({ id: Date.now(), text: text, done: false });
      renderTodos();
      $('#todo-input').val('');
    }
  });

  $('#todo-list').on('click', '.toggle-btn', function () {
    var id = $(this).closest('li').data('id');
    todos = todos.map(function (t) {
      return t.id === id ? Object.assign({}, t, { done: !t.done }) : t;
    });
    renderTodos();
  });

  $('#todo-list').on('click', '.delete-btn', function () {
    var id = $(this).closest('li').data('id');
    todos = todos.filter(function (t) { return t.id !== id; });
    renderTodos();
  });

  function renderTodos() {
    var html = '';
    todos.forEach(function (todo) {
      html += '<li data-id="' + todo.id + '" class="' + (todo.done ? 'done' : '') + '">';
      html += '<span>' + todo.text + '</span>';
      html += '<button class="toggle-btn">' + (todo.done ? '撤销' : '完成') + '</button>';
      html += '<button class="delete-btn">删除</button>';
      html += '</li>';
    });
    $('#todo-list').html(html);
  }
});
```

#### 练习二：jQuery 插件封装

假设项目中使用了 jQuery 的 `sortable` 插件实现拖拽排序列表，请用 `useRef` 将其封装为 `DragSortList` React 组件，要求：
- 接收 `items` 数组和 `onReorder` 回调作为 props
- 组件卸载时正确清理插件实例
- 支持外部更新 items 后同步到插件

---

## 参考答案

### 练习一

**思路**：将全局变量 `todos` 提升为 `useState`，将事件委托改为直接绑定，将 `renderTodos` 函数消除（由 React 自动完成），用 `useCallback` 稳定回调引用。

**答案**：

```tsx
import { useState, useCallback } from 'react';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');

  const handleAdd = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    setTodos((prev) => [...prev, { id: Date.now(), text, done: false }]);
    setInputValue('');
  }, [inputValue]);

  const handleToggle = useCallback((id: number) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  }, []);

  const handleDelete = useCallback((id: number) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }, []);

  return (
    <div className="todo-app">
      <div className="todo-input-bar">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="输入待办事项"
        />
        <button onClick={handleAdd}>添加</button>
      </div>
      <ul className="todo-list">
        {todos.map((todo) => (
          <li key={todo.id} className={todo.done ? 'done' : ''}>
            <span>{todo.text}</span>
            <button onClick={() => handleToggle(todo.id)}>
              {todo.done ? '撤销' : '完成'}
            </button>
            <button onClick={() => handleDelete(todo.id)}>删除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**要点**：
- `handleAdd` 依赖 `inputValue`，用 `useCallback` 确保引用稳定
- `handleToggle` 和 `handleDelete` 无外部依赖，可以用空依赖数组
- 用 `key={todo.id}` 替代 jQuery 的事件委托，React 自动处理列表更新
- 删除了所有手动 DOM 操作，状态变化自动反映到 UI

### 练习二

**思路**：用 `useRef` 获取 DOM 引用，在 `useEffect` 中初始化插件，用 `useEffect` 同步外部数据变化，返回的清理函数负责销毁插件。

**答案**：

```tsx
import { useEffect, useRef } from 'react';

interface DragSortListProps {
  items: string[];
  onReorder: (newItems: string[]) => void;
}

export function DragSortList({ items, onReorder }: DragSortListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // 初始化 sortable 插件
  useEffect(() => {
    if (!listRef.current) return;

    const $list = window.$(listRef.current);

    $list.sortable({
      update: (_event: Event, ui: { item: JQuery }) => {
        const newOrder = $list.sortable('toArray', { attribute: 'data-value' });
        onReorder(newOrder);
      },
    });

    return () => {
      $list.sortable('destroy');
    };
  }, [onReorder]);

  // 外部 items 变化时同步到 DOM（避免插件状态和 React 状态不一致）
  useEffect(() => {
    if (!listRef.current) return;
    const $list = window.$(listRef.current);
    $list.sortable('refresh');
  }, [items]);

  return (
    <ul ref={listRef} className="drag-sort-list">
      {items.map((item, index) => (
        <li key={item} data-value={item} className="drag-sort-item">
          {item}
        </li>
      ))}
    </ul>
  );
}
```

**要点**：
- `useRef` 桥接 jQuery 插件和 React 的 DOM 管理
- 清理函数中调用 `sortable('destroy')` 防止内存泄漏
- `onReorder` 放在 `useEffect` 依赖中，如果调用方没有用 `useCallback` 包裹会导致重新初始化（可以在组件内用 ref 缓存回调来规避）
- 外部 items 变化时用 `refresh` 同步插件状态，不重新初始化
