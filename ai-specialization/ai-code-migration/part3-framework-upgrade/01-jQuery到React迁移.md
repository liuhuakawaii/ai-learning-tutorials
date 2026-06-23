# 01 - jQuery 到 React 迁移

> **课程定位**：Part 3 核心框架迁移课，从真实 jQuery 项目出发。
>
> **前置要求**：了解 jQuery 和 React 基础
>
> **预计时长**：2 小时

---

你接手了一个运营五年的电商平台前端。80 多个页面、12 万行 jQuery。每次改需求都要在十几个文件里搜索 DOM 操作，改一个下拉联动逻辑牵扯三个事件监听器和两个全局变量。

迁移不是重写——你不能把业务停三个月从零开始。

---

## 核心思维转变

```
jQuery 模式：document ready → find DOM → attach event → manipulate DOM
React 模式：render → declare handler in JSX → React manages lifecycle
```

最核心的转变：从**直接修改 DOM**到**状态驱动渲染**。jQuery 用 `$.addClass` 操作 DOM，React 用 `setState` 触发重渲染。

---

## 示例一：商品筛选器

**jQuery 版本**

```javascript
$(document).ready(function () {
  var currentCategory = 'all';
  var currentSort = 'default';

  $('.category-btn').on('click', function () {
    $('.category-btn').removeClass('active');
    $(this).addClass('active');
    currentCategory = $(this).data('category');
    loadProducts(currentCategory, currentSort);
  });

  $('#sort-select').on('change', function () {
    currentSort = $(this).val();
    loadProducts(currentCategory, currentSort);
  });

  function loadProducts(category, sort) {
    $('#product-list').html('<div class="loading">加载中...</div>');
    $.ajax({
      url: '/api/products', data: { category, sort },
      success: function (products) {
        var html = '';
        products.forEach(function (p) { html += '<div class="product-card" data-id="' + p.id + '"><h3>' + p.name + '</h3><span>¥' + p.price + '</span></div>'; });
        $('#product-list').html(html);
      },
      error: function () { $('#product-list').html('<div class="error">加载失败</div>'); }
    });
  }
  loadProducts('all', 'default');
});
```

**React 版本**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface Product { id: string; name: string; price: number; }

async function fetchProducts(category: string, sort: string): Promise<Product[]> {
  const res = await fetch(`/api/products?${new URLSearchParams({ category, sort })}`);
  if (!res.ok) throw new Error('加载失败');
  return res.json();
}

export function ProductFilter() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortOption, setSortOption] = useState('default');
  const navigate = useNavigate();

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products', activeCategory, sortOption],
    queryFn: () => fetchProducts(activeCategory, sortOption),
  });

  return (
    <div className="product-filter">
      <nav>
        {['all', 'electronics', 'clothing'].map((cat) => (
          <button key={cat} className={activeCategory === cat ? 'active' : ''} onClick={() => setActiveCategory(cat)}>{cat}</button>
        ))}
      </nav>
      <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
        <option value="default">默认排序</option>
        <option value="price-asc">价格低→高</option>
      </select>
      <div className="product-list">
        {isLoading && <div>加载中...</div>}
        {error && <div>加载失败</div>}
        {products?.map((p) => (
          <div key={p.id} className="product-card" onClick={() => navigate(`/product/${p.id}`)}>
            <h3>{p.name}</h3><span>¥{p.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

| 维度 | jQuery | React |
|------|--------|-------|
| 状态 | 全局变量 | `useState` |
| 事件 | `.on()` 手动绑定 | JSX `onClick` |
| DOM 更新 | `$.html()` 拼接字符串 | 条件渲染 + `.map()` |
| 数据获取 | `$.ajax` | `useQuery` 自动缓存/重试 |

---

## 示例二：jQuery 插件桥接

迁移时不能一步替换所有插件，用 `useRef` 过渡：

```tsx
import { useEffect, useRef } from 'react';

export function LegacyDatePicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    const $input = window.$(inputRef.current);
    $input.datepicker({ dateFormat: 'yy-mm-dd', onSelect: (dateText: string) => onChange(dateText) });
    $input.datepicker('setDate', value);
    return () => { $input.datepicker('destroy'); };
  }, []);

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) window.$(inputRef.current).datepicker('setDate', value);
  }, [value]);

  return <input ref={inputRef} type="text" />;
}
```

后续可将内部替换为 `react-datepicker`，外部 API 不变。

---

## 微前端渐进迁移

用 qiankun 实现 jQuery 和 React 共存：

```typescript
import { registerMicroApps, start } from 'qiankun';

registerMicroApps([
  { name: 'legacy-order', entry: '//localhost:8081', container: '#subapp-container', activeRule: '/order' },
  { name: 'react-product', entry: '//localhost:8082', container: '#subapp-container', activeRule: '/product' },
]);
start({ sandbox: { strictStyleIsolation: true } });
```

jQuery 子应用改造：导出 `bootstrap`/`mount`/`unmount` 生命周期，`unmount` 中清理事件绑定和 DOM。

---

## 常见误区

**"迁移就是换选择器"** — 本质是从命令式 DOM 操作转为声明式状态驱动。迁移后还有 `ref.current.style.display = 'none'` 说明没完成思维转换。

**"一次性全部重写"** — 按模块逐步迁移，先低频独立模块积累经验。

**"迁移后性能一定更好"** — 迁移的主要收益是可维护性和开发效率，不是性能。

**"所有插件立刻替换"** — 高频核心插件优先替换，低频用 `useRef` 封装过渡。

---

## 练习

### 练习一：待办事项迁移

将 jQuery 待办列表迁移到 React：全局变量 `todos` → `useState`，事件委托 → 直接绑定，`renderTodos()` → React 自动渲染。

### 练习二：sortable 插件封装

用 `useRef` 将 jQuery `sortable` 封装为 `DragSortList` 组件，接收 `items` 和 `onReorder`，清理函数中 `sortable('destroy')` 防止内存泄漏。

---

## 参考答案

### 练习一

```tsx
import { useState, useCallback } from 'react';

export function TodoList() {
  const [todos, setTodos] = useState<{ id: number; text: string; done: boolean }[]>([]);
  const [input, setInput] = useState('');
  const handleAdd = useCallback(() => { if (!input.trim()) return; setTodos(p => [...p, { id: Date.now(), text: input.trim(), done: false }]); setInput(''); }, [input]);
  const handleToggle = useCallback((id: number) => { setTodos(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t)); }, []);
  const handleDelete = useCallback((id: number) => { setTodos(p => p.filter(t => t.id !== id)); }, []);

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
      <button onClick={handleAdd}>添加</button>
      <ul>{todos.map(t => <li key={t.id} className={t.done ? 'done' : ''}><span>{t.text}</span><button onClick={() => handleToggle(t.id)}>{t.done ? '撤销' : '完成'}</button><button onClick={() => handleDelete(t.id)}>删除</button></li>)}</ul>
    </div>
  );
}
```

### 练习二

```tsx
import { useEffect, useRef } from 'react';

export function DragSortList({ items, onReorder }: { items: string[]; onReorder: (items: string[]) => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!listRef.current) return;
    const $list = window.$(listRef.current);
    $list.sortable({ update: () => onReorder($list.sortable('toArray', { attribute: 'data-value' })) });
    return () => { $list.sortable('destroy'); };
  }, [onReorder]);
  useEffect(() => { if (listRef.current) window.$(listRef.current).sortable('refresh'); }, [items]);
  return <ul ref={listRef}>{items.map(item => <li key={item} data-value={item}>{item}</li>)}</ul>;
}
```
