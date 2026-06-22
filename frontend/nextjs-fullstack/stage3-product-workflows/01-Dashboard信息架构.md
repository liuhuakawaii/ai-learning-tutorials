# 第一课：Dashboard 信息架构

## 场景引入

你的 SaaS 产品已经有了核心功能，但用户打开后看到的是一堆平铺的链接和表格，不知道从哪里开始操作。新用户注册后面对空白的 Dashboard 不知所措，老用户找不到常用功能要点击三四层菜单。产品反馈最多的是"功能太多了，找不到东西"和"页面打开后不知道该做什么"。你需要重新设计 Dashboard 的信息架构——哪些信息放在第一屏、导航怎么分组、统计卡片展示什么指标、空状态如何引导——让用户打开页面就能快速理解系统状态并采取行动。

## 学习目标

完成本课学习后，你将能够：

1. 理解 Dashboard 信息架构的设计原则
2. 设计清晰的导航结构
3. 实现响应式侧边栏
4. 创建统计卡片和数据概览
5. 处理 Dashboard 的加载和空状态

---

## 一、信息架构原则

### 1.1 什么是信息架构

> **信息架构（Information Architecture）是组织和呈现信息的方式，让用户能快速找到他们需要的内容。**

### 1.2 核心原则

```
1. 层级清晰
   重要功能放前面
   次要功能放后面

2. 分组合理
   相关功能放在一起
   用标签或分隔符区分

3. 可发现性
   用户能快速找到功能
   不要隐藏重要操作

4. 一致性
   相同功能用相同方式呈现
   位置和样式保持一致
```

### 1.3 生活类比

```
超市货架布局：

入口 → 促销区（吸引注意力）
     → 日用品区（高频使用）
     → 食品区（主要购物）
     → 收银台（结账）

Dashboard 布局：

导航 → 概览/统计（快速了解状态）
     → 核心功能（主要操作）
     → 设置/管理（低频操作）
```

---

## 二、典型 Dashboard 结构

### 2.1 常见布局模式

```
┌─────────────────────────────────────────┐
│              顶部导航栏                   │
├──────────┬──────────────────────────────┤
│          │                              │
│  侧边栏   │        主内容区              │
│          │                              │
│  - 概览   │   ┌─────────────────────┐   │
│  - 项目   │   │    统计卡片          │   │
│  - 成员   │   └─────────────────────┘   │
│  - 设置   │   ┌─────────────────────┐   │
│          │   │    列表/图表          │   │
│          │   └─────────────────────┘   │
│          │                              │
└──────────┴──────────────────────────────┘
```

### 2.2 导航分类

```
主导航（侧边栏）：
  ├── 概览（Dashboard）
  ├── 项目管理
  │   ├── 项目列表
  │   └── 创建项目
  ├── 团队管理
  │   ├── 成员列表
  │   └── 邀请成员
  └── 设置
      ├── 个人资料
      └── 团队设置

快捷操作（顶部或卡片）：
  ├── 创建项目
  ├── 邀请成员
  └── 上传文件
```

---

## 三、实现响应式侧边栏

### 3.1 基础侧边栏

```tsx
// components/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: '概览', href: '/dashboard', icon: '📊' },
  { name: '项目', href: '/dashboard/projects', icon: '📁' },
  { name: '成员', href: '/dashboard/members', icon: '👥' },
  { name: '设置', href: '/dashboard/settings', icon: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r min-h-screen">
      <nav className="p-4">
        <ul className="space-y-1">
          {navigation.map(item => {
            const isActive = pathname === item.href ||
              pathname.startsWith(item.href + '/')

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
```

### 3.2 响应式侧边栏

```tsx
// components/ResponsiveSidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function ResponsiveSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* 移动端菜单按钮 */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded shadow"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* 遮罩层 */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <nav className="p-4 pt-16 lg:pt-4">
          {/* 导航项 */}
        </nav>
      </aside>
    </>
  )
}
```

---

## 四、统计卡片

### 4.1 基础统计卡片

```tsx
// components/StatCard.tsx
interface StatCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    trend: 'up' | 'down' | 'neutral'
  }
  icon?: string
}

export function StatCard({ title, value, change, icon }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg border">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      {change && (
        <p className={`text-sm mt-2 ${
          change.trend === 'up' ? 'text-green-600' :
          change.trend === 'down' ? 'text-red-600' :
          'text-gray-500'
        }`}>
          {change.trend === 'up' ? '↑' : change.trend === 'down' ? '↓' : '→'}
          {' '}{Math.abs(change.value)}%
        </p>
      )}
    </div>
  )
}
```

### 4.2 在 Dashboard 中使用

```tsx
// app/(dashboard)/page.tsx
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { StatCard } from '@/components/StatCard'

export default async function DashboardPage() {
  const user = await requireAuth()

  // 并行获取统计数据
  const [teamCount, projectCount, memberCount] = await Promise.all([
    prisma.team.count({
      where: { members: { some: { userId: user.id } } }
    }),
    prisma.project.count({
      where: { team: { members: { some: { userId: user.id } } } }
    }),
    prisma.membership.count({
      where: { userId: user.id }
    }),
  ])

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">概览</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="我的团队"
          value={teamCount}
          icon="👥"
        />
        <StatCard
          title="参与项目"
          value={projectCount}
          icon="📁"
        />
        <StatCard
          title="成员身份"
          value={memberCount}
          icon="🎭"
        />
      </div>

      {/* 最近活动 */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-bold mb-4">最近活动</h3>
        {/* ... */}
      </div>
    </div>
  )
}
```

---

## 五、Dashboard 布局

### 5.1 完整的 Dashboard 布局

```tsx
// app/(dashboard)/layout.tsx
import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/Sidebar'
import { logout } from '@/app/(auth)/actions'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">团队管理</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.name}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                登出
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 侧边栏 */}
        <Sidebar />

        {/* 主内容区 */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

---

## 六、加载和空状态

### 6.1 Dashboard 骨架屏

```tsx
// app/(dashboard)/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* 统计卡片骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-lg border">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>

      {/* 内容骨架 */}
      <div className="bg-white p-6 rounded-lg border">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### 6.2 空状态处理

```tsx
// app/(dashboard)/page.tsx
export default async function DashboardPage() {
  const user = await requireAuth()
  const teams = await prisma.team.findMany({
    where: { members: { some: { userId: user.id } } }
  })

  if (teams.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">🚀</span>
        <h3 className="text-lg font-medium mb-2">欢迎使用团队管理</h3>
        <p className="text-gray-500 mb-6">
          创建你的第一个团队开始协作
        </p>
        <Link
          href="/teams/new"
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          创建团队
        </Link>
      </div>
    )
  }

  // 正常显示 Dashboard
}
```

---

## 七、动手练习

### 练习 1：设计导航结构

为一个项目管理工具设计导航：

```
一级导航：
  - 概览
  - 项目
  - 任务
  - 团队
  - 设置

二级导航（项目下）：
  - 所有项目
  - 我的项目
  - 已归档
```

### 练习 2：实现统计卡片

创建以下统计卡片：

1. 总项目数
2. 进行中的任务
3. 团队成员数
4. 本月完成的任务

### 练习 3：实现响应式侧边栏

1. 桌面端显示完整侧边栏
2. 移动端点击按钮展开
3. 点击遮罩层关闭
4. 当前页面高亮

---

## 参考答案

### 练习一：设计导航结构

**思路**：导航设计的核心是信息分组——把功能按使用频率和逻辑关系分组，高频操作放一级导航，低频操作放二级或折叠菜单。项目管理工具的典型分组是：概览（全局状态）、项目和任务（核心操作）、团队（协作）、设置（低频）。

**答案**：

```tsx
// lib/navigation.ts
export interface NavItem {
  name: string
  href: string
  icon: string
  children?: NavItem[]
}

export const mainNavigation: NavItem[] = [
  {
    name: '概览',
    href: '/dashboard',
    icon: '📊',
  },
  {
    name: '项目',
    href: '/dashboard/projects',
    icon: '📁',
    children: [
      { name: '所有项目', href: '/dashboard/projects', icon: '' },
      { name: '我的项目', href: '/dashboard/projects/mine', icon: '' },
      { name: '已归档', href: '/dashboard/projects/archived', icon: '' },
    ],
  },
  {
    name: '任务',
    href: '/dashboard/tasks',
    icon: '✅',
    children: [
      { name: '我负责的', href: '/dashboard/tasks/assigned', icon: '' },
      { name: '我创建的', href: '/dashboard/tasks/created', icon: '' },
      { name: '待审核', href: '/dashboard/tasks/review', icon: '' },
    ],
  },
  {
    name: '团队',
    href: '/dashboard/team',
    icon: '👥',
    children: [
      { name: '成员管理', href: '/dashboard/team/members', icon: '' },
      { name: '邀请成员', href: '/dashboard/team/invite', icon: '' },
    ],
  },
  {
    name: '设置',
    href: '/dashboard/settings',
    icon: '⚙️',
    children: [
      { name: '个人资料', href: '/dashboard/settings/profile', icon: '' },
      { name: '通知设置', href: '/dashboard/settings/notifications', icon: '' },
      { name: '团队设置', href: '/dashboard/settings/team', icon: '' },
    ],
  },
]
```

```tsx
// components/NavSidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { mainNavigation, type NavItem } from '@/lib/navigation'

function NavItemComponent({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname()
  const isActive = pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
  const hasChildren = item.children && item.children.length > 0
  const [expanded, setExpanded] = useState(isActive)

  return (
    <li>
      <div className="flex items-center">
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 mr-1 text-gray-400 hover:text-gray-600"
          >
            {expanded ? '▾' : '▸'}
          </button>
        )}
        <Link
          href={item.href}
          className={`flex-1 flex items-center gap-3 px-3 py-2 rounded text-sm ${
            isActive
              ? 'bg-blue-50 text-blue-600 font-medium'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${(depth + 1) * 12}px` }}
        >
          {item.icon && <span>{item.icon}</span>}
          <span>{item.name}</span>
        </Link>
      </div>

      {hasChildren && expanded && (
        <ul className="mt-1 space-y-1">
          {item.children!.map(child => (
            <NavItemComponent key={child.href} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function NavSidebar() {
  return (
    <aside className="w-64 bg-white border-r min-h-screen">
      <div className="p-4 border-b">
        <h2 className="text-lg font-bold">项目管理</h2>
      </div>
      <nav className="p-4">
        <ul className="space-y-1">
          {mainNavigation.map(item => (
            <NavItemComponent key={item.href} item={item} />
          ))}
        </ul>
      </nav>
    </aside>
  )
}
```

**要点**：
- 导航数据和组件分离，`navigation.ts` 可以在侧边栏、移动端菜单、面包屑等多处复用
- 用 `usePathname` 判断当前激活项，支持前缀匹配（`/dashboard/projects` 匹配 `/dashboard/projects/archived`）
- 子导航默认展开当前激活的分组，收起不相关的分组，减少视觉干扰
- 概览页 `/dashboard` 的匹配要特殊处理，避免 `/dashboard/settings` 也匹配上

### 练习二：实现统计卡片

**思路**：统计卡片展示关键业务指标，数据应该用 `Promise.all` 并行查询以减少等待时间。卡片组件要支持趋势对比（比上个月增长/下降了多少），以及加载时的骨架屏状态。

**答案**：

```tsx
// components/StatCard.tsx
interface StatCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    trend: 'up' | 'down' | 'neutral'
    label?: string
  }
  icon?: string
  loading?: boolean
}

export function StatCard({ title, value, change, icon, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg border hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        {icon && <span className="text-3xl">{icon}</span>}
      </div>
      {change && (
        <div className="mt-3 flex items-center gap-1">
          <span className={`text-sm font-medium ${
            change.trend === 'up' ? 'text-green-600' :
            change.trend === 'down' ? 'text-red-600' :
            'text-gray-500'
          }`}>
            {change.trend === 'up' ? '↑' : change.trend === 'down' ? '↓' : '→'}
            {' '}{Math.abs(change.value)}%
          </span>
          <span className="text-xs text-gray-400">{change.label || '较上月'}</span>
        </div>
      )}
    </div>
  )
}
```

```tsx
// app/(dashboard)/page.tsx
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { StatCard } from '@/components/StatCard'

export default async function DashboardPage() {
  const user = await requireAuth()

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [
    totalProjects,
    activeTasks,
    teamMembers,
    completedThisMonth,
    completedLastMonth,
  ] = await Promise.all([
    prisma.project.count({
      where: { team: { members: { some: { userId: user.id } } } },
    }),
    prisma.task.count({
      where: {
        project: { team: { members: { some: { userId: user.id } } } },
        status: { in: ['TODO', 'IN_PROGRESS'] },
      },
    }),
    prisma.membership.count({
      where: { userId: user.id },
    }),
    prisma.task.count({
      where: {
        project: { team: { members: { some: { userId: user.id } } } },
        status: 'DONE',
        completedAt: { gte: thisMonthStart },
      },
    }),
    prisma.task.count({
      where: {
        project: { team: { members: { some: { userId: user.id } } } },
        status: 'DONE',
        completedAt: { gte: lastMonthStart, lt: thisMonthStart },
      },
    }),
  ])

  const completionChange = completedLastMonth > 0
    ? Math.round(((completedThisMonth - completedLastMonth) / completedLastMonth) * 100)
    : completedThisMonth > 0 ? 100 : 0

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">概览</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="总项目数"
          value={totalProjects}
          icon="📁"
        />
        <StatCard
          title="进行中的任务"
          value={activeTasks}
          icon="📋"
        />
        <StatCard
          title="团队成员"
          value={teamMembers}
          icon="👥"
        />
        <StatCard
          title="本月完成"
          value={completedThisMonth}
          icon="✅"
          change={{
            value: Math.abs(completionChange),
            trend: completionChange >= 0 ? 'up' : 'down',
          }}
        />
      </div>

      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-bold mb-4">最近活动</h3>
        <p className="text-gray-500 text-sm">暂无最近活动</p>
      </div>
    </div>
  )
}
```

**要点**：
- `Promise.all` 并行执行 5 个 count 查询，总耗时取最长的那个，而非串行累加
- 趋势对比需要同时查本月和上月数据，计算百分比变化
- 组件支持 `loading` 状态，显示骨架屏，避免页面加载时的布局跳动
- 响应式网格：手机 1 列、平板 2 列、桌面 4 列

### 练习三：实现响应式侧边栏

**思路**：响应式侧边栏的核心是桌面端始终显示、移动端通过按钮展开/收起。用 CSS 的 `translate-x` 做滑入动画，配合遮罩层点击关闭。关键是处理好 z-index 层级（按钮 > 遮罩 > 侧边栏 > 内容），以及关闭时的动画过渡。

**答案**：

```tsx
// components/ResponsiveSidebar.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { mainNavigation } from '@/lib/navigation'

export function ResponsiveSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded shadow-md hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? '关闭菜单' : '打开菜单'}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          {isOpen ? (
            <path d="M4 4L16 16M16 4L4 16" />
          ) : (
            <>
              <path d="M3 5H17" />
              <path d="M3 10H17" />
              <path d="M3 15H17" />
            </>
          )}
        </svg>
      </button>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 pt-16 lg:pt-4 border-b">
          <h2 className="text-lg font-bold">项目管理</h2>
        </div>
        <nav className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 60px)' }}>
          <ul className="space-y-1">
            {mainNavigation.map(item => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-sm ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
```

```tsx
// app/(dashboard)/layout.tsx
import { requireAuth } from '@/lib/auth'
import { ResponsiveSidebar } from '@/components/ResponsiveSidebar'
import { UserNav } from '@/components/UserNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 lg:pl-72">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">团队管理</h1>
          <UserNav />
        </div>
      </header>

      <div className="flex">
        <ResponsiveSidebar />
        <main className="flex-1 p-6 lg:pl-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**要点**：
- 路由变化时自动关闭移动端侧边栏（`useEffect` 监听 `pathname`）
- 打开侧边栏时 `document.body.style.overflow = 'hidden'` 防止背景滚动
- SVG 图标内联渲染，避免外部依赖，hamburger ↔ close 图标切换
- `duration-200 ease-in-out` 的动画时长不要太长，200ms 是移动端菜单的最佳过渡时间

---

## 常见误区

1. **"Dashboard 要展示所有信息"**：信息过载会让用户找不到重点。Dashboard 应该只展示用户当前最需要的信息（关键指标、待办事项、最近活动），详情放在子页面中。
2. **"侧边栏导航用 `<a>` 标签就行"**：用 Next.js 的 `<Link>` 组件可以实现客户端导航和预取，避免整页刷新。`<a>` 标签会导致完全的页面重载。
3. **"统计卡片越多越好"**：3-4 个关键指标就够了（团队数、项目数、成员数）。太多卡片反而让用户不知道看哪个，增加认知负担。
4. **"移动端不需要考虑侧边栏"**：Dashboard 的主要用户确实以桌面端为主，但移动端也需要能基本使用。侧边栏应该可以收起，或者在移动端变成抽屉式菜单。

## 工程建议

1. **统计卡片用 `Promise.all` 并行查询**：多个 count 查询可以并行执行，总耗时取最长的那个。不要串行执行 `count` 查询。
2. **用 `usePathname` 高亮当前导航项**：侧边栏的每个导航项应该根据当前 URL 自动高亮，给用户明确的位置感知。
3. **骨架屏要模拟真实布局**：Dashboard 的骨架屏应该和实际页面结构一致——统计卡片的数量、最近活动列表的行数——这样加载完成后不会出现布局跳动。
4. **空状态要有明确的行动引导**：新用户看到"还没有团队"时，应该有一个醒目的"创建团队"按钮，而不是一段说明文字。

## 八、小结

```
本课核心要点：

1. 信息架构的核心：层级清晰、分组合理、可发现、一致
2. 典型布局：顶部导航 + 侧边栏 + 主内容区
3. 侧边栏要支持响应式，移动端可收起
4. 统计卡片提供快速概览，显示关键指标
5. 处理好加载和空状态，引导用户操作
```

下一课我们将学习搜索、筛选、排序和分页。
