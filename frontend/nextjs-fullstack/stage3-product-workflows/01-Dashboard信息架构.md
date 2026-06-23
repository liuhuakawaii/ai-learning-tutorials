# Dashboard 信息架构

## 为什么信息架构重要

Dashboard 是用户每天面对的界面。信息架构混乱意味着用户找不到功能、看不清数据、操作路径太长。

好的 Dashboard 信息架构回答三个问题：
1. **现在发生了什么**（概览数据）
2. **我该做什么**（待办、异常、告警）
3. **怎么到达我想去的地方**（导航和快捷操作）

## 布局模式

### 侧边栏布局

最常用的后台布局。侧边栏放导航，主区域放内容。

```tsx
// app/(admin)/layout.tsx
export default function AdminLayout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        <header className="sticky top-0 z-10 bg-white border-b px-6 py-4">
          <Breadcrumb />
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
```

### 顶部导航布局

适合功能较少的 Dashboard，或者需要全宽内容的场景。

## 导航设计

侧边栏导航的原则：

1. **层级不超过 2 层**——超过 2 层用面包屑而不是展开更多
2. **高频操作放顶部**——Dashboard、项目列表、创建按钮
3. **低频操作放底部**——设置、帮助、退出

```tsx
function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">MyApp</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        <NavItem href="/admin" icon="dashboard" label="概览" />
        <NavItem href="/admin/projects" icon="folder" label="项目" />
        <NavItem href="/admin/team" icon="users" label="团队" />
      </nav>
      <div className="p-4 border-t space-y-1">
        <NavItem href="/admin/settings" icon="settings" label="设置" />
      </div>
    </aside>
  )
}
```

## 概览页面数据

Dashboard 首页通常包含：

1. **关键指标卡片**——总用户数、活跃项目、本月收入、增长率
2. **趋势图表**——最近 7 天或 30 天的变化趋势
3. **待办事项**——需要用户处理的事项
4. **最近活动**——团队的最新操作记录

```tsx
export default async function DashboardPage() {
  const [stats, recentActivity] = await Promise.all([
    getStats(),
    getRecentActivity(),
  ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="总用户" value={stats.totalUsers} change={stats.userGrowth} />
        <StatCard label="活跃项目" value={stats.activeProjects} />
        <StatCard label="本月收入" value={`¥${stats.monthlyRevenue}`} change={stats.revenueGrowth} />
        <StatCard label="转化率" value={`${stats.conversionRate}%`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart data={stats.trend} />
        </div>
        <RecentActivityList items={recentActivity} />
      </div>
    </div>
  )
}
```

## 表格设计

列表页的核心是表格。好的表格需要：

1. **列排序**——点击表头排序
2. **筛选**——按状态、类型、时间筛选
3. **搜索**——关键词搜索
4. **分页**——大量数据分页
5. **批量操作**——选择多条记录批量处理

```tsx
export default async function ProjectsPage({ searchParams }) {
  const { page = 1, sort = 'createdAt', order = 'desc', q = '', status = '' } = searchParams
  const projects = await getProjects({ page, sort, order, q, status })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <SearchBar placeholder="搜索项目..." />
        <Link href="/admin/projects/new" className="btn-primary">创建项目</Link>
      </div>
      <FilterBar options={['全部', '进行中', '已完成', '已归档']} />
      <DataTable columns={columns} data={projects.items} />
      <Pagination total={projects.total} page={page} pageSize={10} />
    </div>
  )
}
```

## 状态处理

每个页面都需要处理四种状态：

```tsx
export default async function ProjectDetail({ params }) {
  const project = await getProject(params.id)

  if (!project) notFound()  // 404

  return (
    <div>
      <h1>{project.name}</h1>
      <p>{project.description || '暂无描述'}</p>  {/* 空状态 */}
    </div>
  )
}
```

```tsx
// app/(admin)/projects/[id]/loading.tsx
export default function Loading() {
  return <Skeleton className="h-8 w-48 mb-4" />  // 加载态
}

// app/(admin)/projects/[id]/error.tsx
'use client'
export default function Error({ error, reset }) {
  return (
    <div>
      <p>加载失败: {error.message}</p>
      <button onClick={reset}>重试</button>  // 错误态
    </div>
  )
}
```

## 练习

### 练习一：Dashboard 首页

实现 Dashboard 首页：4 个指标卡片 + 最近活动列表。数据用 Server Component 获取。

### 练习二：响应式侧边栏

实现可折叠的侧边栏：桌面端默认展开，移动端默认收起，点击汉堡按钮切换。

### 练习三：数据表格

实现可排序、可筛选、可分页的数据表格。用 URL 参数管理所有状态。

---

## 参考答案

### 练习一

```tsx
export default async function Dashboard() {
  const stats = await getStats()
  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard label="总用户" value={stats.users} />
      <StatCard label="项目" value={stats.projects} />
      <StatCard label="收入" value={`¥${stats.revenue}`} />
      <StatCard label="转化" value={`${stats.conversion}%`} />
    </div>
  )
}
```

### 练习二

```tsx
'use client'
const [open, setOpen] = useState(true)
return (
  <aside className={`${open ? 'w-64' : 'w-16'} transition-all`}>
    <button onClick={() => setOpen(!open)}>{open ? '←' : '→'}</button>
    {open && <NavFull />}
    {!open && <NavIcons />}
  </aside>
)
```

### 练习三

```tsx
const [sort, setSort] = useState('createdAt')
const [order, setOrder] = useState('desc')
const router = useRouter()

function handleSort(column) {
  const newOrder = sort === column && order === 'asc' ? 'desc' : 'asc'
  router.push(`?sort=${column}&order=${newOrder}`)
}
```
