# 第七课：阶段实战 — SaaS 工作台 MVP

## 场景引入

你已经完成了三个阶段的学习——App Router 基础、数据认证与数据库、产品工作流——现在需要把所有知识整合成一个可交付的 SaaS 产品 MVP。这个产品需要：Dashboard 展示关键指标、项目列表支持搜索筛选排序分页、团队成员邀请和角色管理、套餐和用量限制、管理后台和审计日志。这不是一个 demo，而是一个用户可以直接注册、创建团队、邀请同事、开始协作的真实产品。你需要在架构设计、功能实现、用户体验和代码质量之间找到平衡，交付一个既完整又可维护的 MVP。

## 学习目标

综合运用第三阶段所学知识，构建一个 SaaS 工作台 MVP，包含：

1. Dashboard 信息架构
2. 搜索、筛选、排序、分页
3. 邀请成员与通知
4. 套餐与用量管理
5. 管理后台与审计日志

---

## 一、项目结构

```
app/
├── layout.tsx
├── page.tsx                     ← 首页
│
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
│
├── (dashboard)/
│   ├── layout.tsx               ← 主布局
│   ├── page.tsx                 ← Dashboard
│   │
│   ├── projects/
│   │   ├── page.tsx             ← 项目列表（带搜索、筛选、分页）
│   │   ├── new/page.tsx
│   │   └── [id]/page.tsx
│   │
│   ├── teams/
│   │   ├── page.tsx
│   │   └── [teamId]/
│   │       ├── page.tsx
│   │       ├── members/page.tsx ← 成员管理（邀请、角色）
│   │       └── settings/
│   │           ├── page.tsx
│   │           ├── billing/page.tsx   ← 套餐管理
│   │           ├── usage/page.tsx     ← 用量统计
│   │           └── audit/page.tsx     ← 审计日志
│   │
│   └── profile/page.tsx
│
├── admin/
│   ├── layout.tsx
│   ├── page.tsx                 ← 管理概览
│   ├── users/page.tsx           ← 用户管理
│   ├── teams/page.tsx           ← 团队管理
│   └── audit/page.tsx           ← 系统审计
│
└── api/
    └── ...
```

---

## 二、数据模型

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  avatar    String?
  password  String
  role      UserRole @default(USER)
  banned    Boolean  @default(false)
  bannedAt  DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ownedTeams   Team[]        @relation("TeamOwner")
  memberships  Membership[]
  createdProjects Project[]  @relation("ProjectCreator")
  auditLogs    AuditLog[]
}

model Team {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner    User         @relation("TeamOwner", fields: [ownerId], references: [id])
  ownerId  String
  members  Membership[]
  projects Project[]
  invitations Invitation[]
  auditLogs AuditLog[]

  subscription Subscription?
  usageRecords UsageRecord[]
}

model Membership {
  id        String   @id @default(cuid())
  role      Role     @default(MEMBER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId String

  @@unique([userId, teamId])
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  status      ProjectStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  team      Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId    String
  creator   User   @relation("ProjectCreator", fields: [creatorId], references: [id])
  creatorId String
}

model Invitation {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  role      Role     @default(MEMBER)
  status    InvitationStatus @default(PENDING)
  expiresAt DateTime
  createdAt DateTime @default(now())

  team      Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId    String
  inviter   User   @relation(fields: [inviterId], references: [id])
  inviterId String

  @@unique([email, teamId])
}

model Subscription {
  id        String   @id @default(cuid())
  status    SubscriptionStatus @default(ACTIVE)
  startDate DateTime @default(now())
  endDate   DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  plan   Plan   @relation(fields: [planId], references: [id])
  planId String
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId String @unique
}

model Plan {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  price       Int
  limits      Json
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  subscriptions Subscription[]
}

model UsageRecord {
  id        String   @id @default(cuid())
  action    String
  quantity  Int      @default(1)
  createdAt DateTime @default(now())

  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId String

  @@index([teamId, action, createdAt])
}

model AuditLog {
  id        String   @id @default(cuid())
  action    String
  resource  String
  resourceId String?
  details   Json?
  ipAddress String?
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id])
  userId String
  team   Team?  @relation(fields: [teamId], references: [id])
  teamId String?

  @@index([userId])
  @@index([teamId])
  @@index([action])
  @@index([createdAt])
}

model SystemSetting {
  id    String @id @default(cuid())
  key   String @unique
  value String
}

enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}

enum Role {
  OWNER
  ADMIN
  MEMBER
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
  DELETED
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

enum SubscriptionStatus {
  ACTIVE
  CANCELED
  PAST_DUE
}
```

---

## 三、核心功能实现

### 3.1 Dashboard 统计

```tsx
// app/(dashboard)/page.tsx
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { StatCard } from '@/components/StatCard'
import { getTeamPlan, getTeamUsage } from '@/lib/subscription'

export default async function DashboardPage() {
  const user = await requireAuth()

  const teams = await prisma.team.findMany({
    where: { members: { some: { userId: user.id } } },
    include: {
      _count: { select: { projects: true, members: true } }
    }
  })

  // 获取主要团队的用量
  const primaryTeam = teams[0]
  let usage = null
  let plan = null

  if (primaryTeam) {
    [usage, plan] = await Promise.all([
      getTeamUsage(primaryTeam.id),
      getTeamPlan(primaryTeam.id)
    ])
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">欢迎回来，{user.name}</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="我的团队"
          value={teams.length}
          icon="👥"
        />
        <StatCard
          title="参与项目"
          value={teams.reduce((sum, t) => sum + t._count.projects, 0)}
          icon="📁"
        />
        <StatCard
          title="本月 API 调用"
          value={usage?.apiCalls || 0}
          icon="🔌"
        />
        <StatCard
          title="当前套餐"
          value={plan?.name || '免费版'}
          icon="💎"
        />
      </div>

      {/* 最近团队 */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="font-bold mb-4">我的团队</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teams.map(team => (
            <a
              key={team.id}
              href={`/teams/${team.id}`}
              className="p-4 border rounded hover:shadow-md transition-shadow"
            >
              <h4 className="font-medium">{team.name}</h4>
              <p className="text-sm text-gray-500">
                {team._count.members} 成员 · {team._count.projects} 项目
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### 3.2 项目列表（带搜索筛选分页）

```tsx
// app/(dashboard)/projects/page.tsx
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { SearchBar } from '@/components/SearchBar'
import { FilterBar } from '@/components/FilterBar'
import { SortSelect } from '@/components/SortSelect'
import { Pagination } from '@/components/Pagination'
import { EmptyState } from '@/components/EmptyState'
import { canCreateProject } from '@/lib/limits'
import { UpgradePrompt } from '@/components/UpgradePrompt'

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    teamId?: string
    sort?: string
    page?: string
  }>
}) {
  const user = await requireAuth()
  const { q, status, teamId, sort, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr || '1'))
  const pageSize = 10

  // 获取用户的团队
  const teams = await prisma.team.findMany({
    where: { members: { some: { userId: user.id } } },
    select: { id: true, name: true }
  })

  const teamIds = teams.map(t => t.id)

  // 构建查询条件
  const where = {
    teamId: { in: teamIds },
    ...(teamId ? { teamId } : {}),
    ...(status ? { status } : {}),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ]
    } : {})
  }

  // 排序
  const orderBy = sort === 'name'
    ? { name: 'asc' as const }
    : { createdAt: 'desc' as const }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        team: { select: { name: true } }
      }
    }),
    prisma.project.count({ where })
  ])

  const totalPages = Math.ceil(total / pageSize)

  // 检查是否可以创建项目
  const primaryTeam = teams[0]
  const limitCheck = primaryTeam ? await canCreateProject(primaryTeam.id) : null

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">项目列表</h2>
        {limitCheck?.allowed !== false ? (
          <a
            href="/projects/new"
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            创建项目
          </a>
        ) : (
          <UpgradePrompt
            teamId={primaryTeam!.id}
            feature="项目数量"
            current={limitCheck!.current}
            limit={limitCheck!.limit}
          />
        )}
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <SearchBar placeholder="搜索项目..." />
        </div>
        <FilterBar
          filters={[
            {
              name: 'status',
              label: '状态',
              options: [
                { label: '进行中', value: 'ACTIVE' },
                { label: '已归档', value: 'ARCHIVED' },
              ]
            },
            {
              name: 'teamId',
              label: '团队',
              options: teams.map(t => ({
                label: t.name,
                value: t.id
              }))
            }
          ]}
        />
        <SortSelect
          options={[
            { label: '最新创建', value: 'newest' },
            { label: '按名称', value: 'name' },
          ]}
        />
      </div>

      {/* 结果统计 */}
      <p className="text-sm text-gray-500 mb-4">共 {total} 个项目</p>

      {/* 项目列表 */}
      {projects.length === 0 ? (
        <EmptyState
          icon="📁"
          title="没有找到项目"
          description={q ? '试试其他搜索词' : '创建你的第一个项目'}
          action={
            <a href="/projects/new" className="px-4 py-2 bg-blue-500 text-white rounded">
              创建项目
            </a>
          }
        />
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <a
              key={project.id}
              href={`/projects/${project.id}`}
              className="block p-4 bg-white border rounded hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{project.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {project.description || '暂无描述'}
                  </p>
                </div>
                <span className="text-sm text-gray-400">
                  {project.team.name}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                创建于 {new Date(project.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </a>
          ))}
        </div>
      )}

      <Pagination totalPages={totalPages} currentPage={page} />
    </div>
  )
}
```

## 常见误区

1. **"先把所有功能做完再优化"**：MVP 的核心是"最小可行"，不是"完美"。先确保核心流程（注册→创建团队→邀请成员→创建项目）能跑通，再逐步添加搜索、套餐、审计等高级功能。
2. **"所有数据都在一个查询中获取"**：Dashboard 需要统计卡片、最近团队、用量信息等多个数据源。用 `Promise.all` 并行查询，不要在一个巨大的 `include` 中获取所有关联数据。
3. **"管理后台可以直接复用用户端的组件"**：管理后台的数据结构和交互模式与用户端不同（如用户列表需要显示角色、注册时间、操作按钮），应该有独立的表格和操作组件。
4. **"不需要处理错误状态"**：每个页面都要处理加载、错误、空数据三种状态。一个没有错误处理的页面在数据库查询失败时会直接白屏。

## 工程建议

1. **从 Prisma schema 开始**：先定义完整的数据模型（User、Team、Membership、Project、Invitation、Subscription、Plan、UsageRecord、AuditLog），确保所有关系和约束正确，再写业务逻辑。
2. **核心流程优先于高级功能**：先实现注册→登录→创建团队→邀请成员→创建项目这条主流程，确保用户能完成核心操作，再逐步添加搜索、套餐、审计等功能。
3. **每个页面都处理四种状态**：加载中（骨架屏）、加载成功（正常内容）、加载失败（错误提示+重试按钮）、无数据（空状态引导）。用 `loading.tsx`、`error.tsx` 和条件渲染覆盖所有场景。
4. **验收清单是最终的质量门禁**：按照课程提供的验收清单逐项检查，确保每个功能模块（Dashboard、搜索筛选、邀请通知、套餐用量、管理后台、审计日志）都经过完整测试。

---

## 四、验收清单

完成项目后，检查以下内容：

### Dashboard
- [ ] 显示团队数、项目数、成员数统计
- [ ] 显示最近活动
- [ ] 空状态引导用户创建团队

### 搜索筛选排序分页
- [ ] 项目列表支持搜索
- [ ] 支持按状态筛选
- [ ] 支持按团队筛选
- [ ] 支持排序
- [ ] 分页正常工作

### 邀请与通知
- [ ] 可以邀请成员
- [ ] 邀请链接可访问
- [ ] 可以接受邀请
- [ ] 邮件发送正常

### 套餐与用量
- [ ] 显示当前套餐
- [ ] 显示用量统计
- [ ] 超额时显示升级提示
- [ ] 可以升级套餐

### 管理后台
- [ ] 管理员可以访问
- [ ] 用户列表带搜索
- [ ] 可以修改用户角色
- [ ] 操作有审计日志

### 审计日志
- [ ] 关键操作有记录
- [ ] 可以查看日志列表
- [ ] 支持筛选

---

## 五、扩展挑战

1. **实时通知**：使用 WebSocket 实现实时通知
2. **数据导出**：支持导出项目和成员数据
3. **API 文档**：生成 API 文档
4. **多语言**：支持中英文切换
5. **深色模式**：支持主题切换
