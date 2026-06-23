# 阶段实战：SaaS 工作台 MVP

## 项目目标

构建 SaaS 工作台 MVP：Dashboard + 搜索/筛选/分页 + 通知系统 + 套餐设计 + 管理后台 + 审计日志。这是一个接近真实产品的完整后台。

## 功能模块

1. **Dashboard**——关键指标 + 趋势图 + 待办
2. **搜索筛选排序分页**——列表页标准能力
3. **通知系统**——站内通知 + 邮件
4. **套餐管理**——Free/Pro/Enterprise
5. **管理后台**——用户管理、数据统计
6. **审计日志**——记录所有关键操作

## Dashboard 实现

```tsx
// app/(admin)/page.tsx
export default async function Dashboard() {
  const [stats, activities, notifications] = await Promise.all([
    getDashboardStats(),
    getRecentActivities(10),
    getUnreadNotifications(),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">工作台</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="总用户" value={stats.totalUsers} change={stats.userGrowth} icon="users" />
        <MetricCard title="活跃项目" value={stats.activeProjects} icon="folder" />
        <MetricCard title="本月收入" value={`¥${stats.monthlyRevenue.toLocaleString()}`} change={stats.revenueGrowth} icon="currency" />
        <MetricCard title="转化率" value={`${stats.conversionRate}%`} icon="chart" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">趋势</h2>
          <TrendChart data={stats.trend} />
        </div>
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold mb-4">最近活动</h2>
          <ActivityList items={activities} />
        </div>
      </div>
    </div>
  )
}
```

## 搜索/筛选/排序/分页

用 URL 参数管理所有状态，支持分享链接和浏览器前进后退：

```tsx
// app/(admin)/projects/page.tsx
export default async function ProjectsPage({ searchParams }) {
  const params = await searchParams
  const page = parseInt(params.page) || 1
  const sort = params.sort || 'createdAt'
  const order = params.order || 'desc'
  const q = params.q || ''
  const status = params.status || ''
  const pageSize = 10

  const { items, total } = await getProjects({ page, sort, order, q, status, pageSize })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">项目管理</h1>
        <Link href="/admin/projects/new" className="btn-primary">创建项目</Link>
      </div>
      <div className="flex gap-4">
        <SearchInput placeholder="搜索项目..." />
        <FilterSelect name="status" options={['全部','进行中','已完成']} />
      </div>
      <DataTable
        columns={[
          { key: 'name', label: '名称', sortable: true },
          { key: 'status', label: '状态', sortable: true },
          { key: 'createdAt', label: '创建时间', sortable: true },
          { key: 'actions', label: '操作' },
        ]}
        data={items}
        currentSort={sort}
        currentOrder={order}
      />
      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  )
}
```

## 通知系统

```typescript
// lib/notifications.ts
export async function createNotification(userId: string, data: {
  type: 'info' | 'warning' | 'success'
  title: string
  message: string
  link?: string
}) {
  await prisma.notification.create({
    data: { userId, ...data, read: false },
  })
  // 可选：发送邮件
  if (data.type === 'warning') {
    await sendEmail(userId, data.title, data.message)
  }
}

export async function getUnreadNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}
```

## 套餐管理

```typescript
// lib/plans.ts
export const PLANS = {
  free: { name: 'Free', price: 0, limits: { projects: 3, members: 5, storage: 100 } },
  pro: { name: 'Pro', price: 99, limits: { projects: 50, members: 20, storage: 10000 } },
  enterprise: { name: 'Enterprise', price: 499, limits: { projects: -1, members: -1, storage: -1 } },
}

export async function checkLimit(userId: string, resource: string) {
  const plan = await getUserPlan(userId)
  const limit = PLANS[plan].limits[resource]
  if (limit === -1) return true // unlimited
  const current = await getResourceCount(userId, resource)
  return current < limit
}
```

## 审计日志

```typescript
// lib/audit.ts
export async function logAction(userId: string, action: string, details: Record<string, any>) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      details: JSON.stringify(details),
      ip: headers().get('x-forwarded-for') || 'unknown',
    },
  })
}

// 在 Server Action 中使用
export async function deleteProject(projectId: string) {
  const user = await requireAuth()
  await prisma.project.delete({ where: { id: projectId } })
  await logAction(user.id, 'project.delete', { projectId })
  revalidatePath('/admin/projects')
}
```

## 练习

### 练习一：完整工作台

实现 Dashboard + 项目列表（搜索/筛选/分页）+ 通知中心。

### 练习二：套餐限制

实现创建项目时检查套餐限制，超出时提示升级。

### 练习三：审计日志页面

实现审计日志列表，支持按操作类型、时间范围筛选。

---

## 参考答案

### 练习一

按本课结构依次实现：Dashboard 指标卡片、项目列表页、通知组件。

### 练习二

```typescript
export async function createProject(formData: FormData) {
  const user = await requireAuth()
  const canCreate = await checkLimit(user.id, 'projects')
  if (!canCreate) return { error: '已达项目数量上限，请升级套餐' }
  // ...创建项目
}
```

### 练习三

```typescript
export default async function AuditLogPage({ searchParams }) {
  const { action, from, to } = await searchParams
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action && { action }),
      ...(from && { createdAt: { gte: new Date(from) } }),
      ...(to && { createdAt: { lte: new Date(to) } }),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  // ...渲染日志列表
}
```
