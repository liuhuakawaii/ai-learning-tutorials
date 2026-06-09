# 第7课：阶段实战——Dashboard 交互优化

> **课程定位**：综合运用 React/Next.js 性能优化知识，优化一个 Dashboard 页面
> **前置知识**：React 渲染机制、状态设计、memo、虚拟滚动、Next.js 优化
> **预计时长**：60 分钟

---

## 学习目标

1. 识别 Dashboard 中的性能瓶颈
2. 优化筛选和搜索交互的响应速度
3. 优化大表格的渲染性能
4. 减少不必要的重渲染
5. 记录优化前后的数据对比

---

## 一、实战页面

本阶段讲的是 React / Next 性能，但课程内置 demo 用原生 JavaScript 复现同类瓶颈，便于直接观察 DOM 数量、主线程长任务和输入延迟。默认练习页：

```text
frontend-performance-course/final-project/performance-rescue-demo/work.html
```

你要优化搜索、排序、加入购物车和大列表渲染，并在报告里说明如果迁移到 React / Next，应如何用状态下沉、memo、useMemo、虚拟滚动和 Server Components 处理。

一个典型的 SaaS Dashboard，也会包含以下同类功能：

```
┌──────────────────────────────────────────────────────────────┐
│                    Dashboard 功能结构                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Header: 搜索框 + 用户菜单 + 通知                   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌──────────┐  ┌──────────────────────────────────────┐      │
│  │          │  │  Stats Cards: 4 个统计卡片            │      │
│  │ Sidebar  │  ├──────────────────────────────────────┤      │
│  │          │  │  Filters: 日期范围 + 类别 + 状态     │      │
│  │ 导航菜单 │  ├──────────────────────────────────────┤      │
│  │          │  │  Table: 1000+ 行数据表格              │      │
│  │          │  │  - 可排序                             │      │
│  │          │  │  - 可筛选                             │      │
│  │          │  │  - 可分页                             │      │
│  │          │  ├──────────────────────────────────────┤      │
│  │          │  │  Chart: 数据图表                      │      │
│  └──────────┘  └──────────────────────────────────────┘      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

包含的性能问题：

```
┌──────────────────────────────────────────────────────────────┐
│                    性能问题清单                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  渲染问题：                                                   │
│  □ 所有状态在顶层 → 任何变化都导致全页面渲染                  │
│  □ 搜索输入没有防抖 → 每次按键都触发过滤                      │
│  □ 表格每次渲染所有行 → 1000+ DOM 节点                        │
│  □ 图表组件没有 memo → 筛选时也被带动渲染                     │
│                                                              │
│  数据问题：                                                   │
│  □ 筛选在客户端进行 → 大数组每次重新计算                      │
│  □ 没有缓存 → 切换标签页重新获取                              │
│                                                              │
│  交互问题：                                                   │
│  □ 排序触发长任务 → 大数组排序阻塞主线程                      │
│  □ 筛选没有批处理 → 连续筛选触发多次渲染                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、性能诊断

### 2.1 Profiler 录制

```
操作步骤：
1. 打开 React DevTools Profiler
2. 录制以下操作：
   a. 在搜索框输入字符
   b. 切换筛选条件
   c. 点击表头排序
   d. 滚动表格
3. 查看 Flamegraph，找出：
   - 哪些组件不必要地渲染了
   - 每次渲染的耗时
   - 渲染的原因
```

### 2.2 基线数据

```
┌──────────────────────────────────────────────────────────────┐
│                    基线数据（优化前）                          │
├─────────────────────┬────────────────────────────────────────┤
│ 操作                 │ 响应时间                               │
├─────────────────────┼────────────────────────────────────────┤
│ 搜索输入（每个字符） │ 350ms                                 │
│ 切换筛选条件         │ 500ms                                 │
│ 排序                 │ 800ms                                 │
│ 滚动表格             │ 掉帧明显                              │
│ 渲染组件数           │ 全页面 50+ 组件                       │
└─────────────────────┴────────────────────────────────────────┘
```

---

## 三、优化步骤

### 步骤 1：状态下沉

```jsx
// ❌ 之前：所有状态在 Dashboard 顶层
function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // 所有子组件都因为这些状态变化而渲染
  return (
    <div>
      <Header query={searchQuery} onSearch={setSearchQuery} />
      <StatsCards data={stats} />
      <Filters
        dateRange={dateRange} onDateChange={setDateRange}
        category={category} onCategoryChange={setCategory}
        status={status} onStatusChange={setStatus}
      />
      <DataTable
        data={filteredData}
        sortField={sortField} sortOrder={sortOrder}
        onSort={handleSort}
      />
      <DataChart data={chartData} />
    </div>
  );
}

// ✅ 之后：状态下沉到各自需要的组件
function Dashboard() {
  return (
    <div>
      <Header />
      <StatsCards />
      <FiltersPanel />
      <DataTableSection />
      <ChartSection />
    </div>
  );
}

function Header() {
  const [query, setQuery] = useState('');
  // 只有 Header 渲染
  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}

function FiltersPanel() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  // 只有 FiltersPanel 渲染
}
```

### 步骤 2：搜索防抖

```jsx
function SearchInput() {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // 防抖：300ms 后才更新实际搜索值
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // debouncedQuery 变化时才触发搜索
  useEffect(() => {
    if (debouncedQuery) {
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery]);

  return (
    <input
      value={inputValue}
      onChange={e => setInputValue(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

### 步骤 3：表格虚拟滚动

```jsx
import { FixedSizeList } from 'react-window';

function DataTable({ data }) {
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // useMemo 缓存排序结果
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortField, sortOrder]);

  const Row = memo(({ index, style }) => {
    const item = sortedData[index];
    return (
      <div style={style} className="table-row">
        <span>{item.name}</span>
        <span>{item.date}</span>
        <span>{item.amount}</span>
        <span className={`status-${item.status}`}>{item.status}</span>
      </div>
    );
  });

  return (
    <div>
      <TableHeader sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
      <FixedSizeList
        height={500}
        itemCount={sortedData.length}
        itemSize={48}
        width="100%"
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}
```

### 步骤 4：memo 图表组件

```jsx
const DataChart = memo(function DataChart({ data, dateRange }) {
  // 图表渲染成本高，只有数据真正变化时才重渲染
  return (
    <div className="chart-container">
      {/* 图表渲染逻辑 */}
    </div>
  );
});

// 父组件传递数据时用 useMemo
function ChartSection() {
  const rawData = useData();

  const chartData = useMemo(() => {
    return rawData.map(item => ({
      date: item.date,
      value: item.amount,
    }));
  }, [rawData]);

  return <DataChart data={chartData} />;
}
```

### 步骤 5：筛选逻辑优化

```jsx
function useFilteredData() {
  const rawData = useData();
  const filters = useFilters();

  // useMemo 缓存筛选结果
  const filteredData = useMemo(() => {
    let result = rawData;

    if (filters.category !== 'all') {
      result = result.filter(item => item.category === filters.category);
    }

    if (filters.status !== 'all') {
      result = result.filter(item => item.status === filters.status);
    }

    if (filters.dateRange.start) {
      result = result.filter(item => item.date >= filters.dateRange.start);
    }

    if (filters.dateRange.end) {
      result = result.filter(item => item.date <= filters.dateRange.end);
    }

    return result;
  }, [rawData, filters]);

  return filteredData;
}
```

### 步骤 6：Server Components 优化

```jsx
// 统计卡片：数据不常变化，用 Server Component + 缓存
async function StatsCards() {
  const stats = await fetch('/api/stats', {
    next: { revalidate: 300 }  // 5 分钟缓存
  });

  return (
    <div className="stats-grid">
      <StatCard title="Total Revenue" value={stats.revenue} />
      <StatCard title="Orders" value={stats.orders} />
      <StatCard title="Customers" value={stats.customers} />
      <StatCard title="Conversion" value={stats.conversion} />
    </div>
  );
}

// 表格和筛选：需要交互，用 Client Component
'use client';
function DataTableSection() {
  // 交互逻辑...
}
```

---

## 四、优化效果

```
┌──────────────────────────────────────────────────────────────┐
│                    优化前后对比                               │
├─────────────────────┬───────────┬───────────┬────────────────┤
│ 操作                 │ 优化前     │ 优化后     │ 改善           │
├─────────────────────┼───────────┼───────────┼────────────────┤
│ 搜索输入（每个字符） │ 350ms     │ < 16ms    │ ↓ 95%          │
│ 切换筛选条件         │ 500ms     │ 50ms      │ ↓ 90%          │
│ 排序                 │ 800ms     │ 100ms     │ ↓ 87%          │
│ 滚动表格             │ 掉帧      │ 流畅      │ ✓              │
│ 渲染组件数           │ 50+       │ 5-8       │ ↓ 85%          │
│ 图表重渲染           │ 每次筛选   │ 仅数据变化 │ ↓ 90%          │
└─────────────────────┴───────────┴───────────┴────────────────┘
```

---

## 五、优化总结

```
┌──────────────────────────────────────────────────────────────┐
│                    优化手段 → 解决的问题                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  状态下沉 → 隔离渲染范围                                      │
│  ├─ 搜索状态独立 → 输入不影响表格和图表                       │
│  ├─ 筛选状态独立 → 筛选不影响 Header                         │
│                                                              │
│  防抖 → 减少无效计算                                          │
│  ├─ 搜索 300ms 防抖 → 减少 90% 的过滤操作                    │
│                                                              │
│  虚拟滚动 → 减少 DOM 节点                                     │
│  ├─ 1000 行只渲染 15 行 → DOM 节点减少 98%                   │
│                                                              │
│  memo + useMemo → 避免不必要渲染                              │
│  ├─ 图表组件 memo → 筛选时图表不重渲染                        │
│  ├─ 排序结果 useMemo → 避免重复排序                           │
│                                                              │
│  Server Components → 减少客户端 JS                            │
│  ├─ 统计卡片服务端渲染 → 0 客户端 JS                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 动手挑战

### 挑战一：独立诊断

1. 拿到 Dashboard 代码后，独立用 Profiler 诊断
2. 列出所有性能问题
3. 制定优化方案并实施

### 挑战二：进一步优化

1. 把排序操作移到 Web Worker
2. 实现表格列的拖拽排序
3. 添加数据导出功能（避免阻塞主线程）

### 挑战三：监控集成

1. 添加 Web Vitals 监控
2. 追踪搜索、筛选、排序的响应时间
3. 建立性能基准测试

---

## 小结

1. **先诊断**：用 Profiler 找到真正的瓶颈
2. **状态下沉**：把状态放到需要它的最低层级
3. **防抖**：搜索、筛选等用户输入需要防抖
4. **虚拟滚动**：大列表必须用虚拟滚动
5. **memo**：昂贵组件用 memo，配合 useMemo/useCallback
6. **Server Components**：不需要交互的部分用服务端渲染

---

## 阶段回顾

第三阶段你学到了：

- React 渲染机制和触发原因
- 状态设计如何影响渲染范围
- memo、useMemo、useCallback 的正确使用
- 大列表的虚拟滚动方案
- Next.js 图片、字体、路由和缓存优化
- Server Components 的性能优势

**下一步**：进入第四阶段，学习资源、缓存与网络优化。
