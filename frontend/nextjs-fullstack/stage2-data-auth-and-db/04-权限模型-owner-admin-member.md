# 第四课：权限模型 — owner、admin、member

## 场景引入

你的团队协作工具已经能登录了，但问题随之而来：任何登录用户都能删除团队、修改其他人的角色、删除别人的项目。一个刚加入团队的普通成员，点了一下"删除团队"按钮，整个团队连同所有项目和成员关系全部消失了。你需要一套权限系统来控制"谁能做什么"——Owner 可以做任何事，Admin 可以管理成员但不能删除团队，Member 只能操作自己创建的内容。这不是前端隐藏按钮就能解决的，必须在服务端每一个写操作前都做权限校验。

## 学习目标

完成本课学习后，你将能够：

1. 理解 RBAC（基于角色的访问控制）模型
2. 设计清晰的权限层级
3. 实现权限检查的工具函数
4. 在 Server Actions 中应用权限校验
5. 在 UI 中根据权限显示/隐藏元素

---

## 一、RBAC 模型

### 1.1 什么是 RBAC

> **RBAC（Role-Based Access Control）是一种根据用户角色来控制访问权限的模型。**

```
用户 ──→ 角色 ──→ 权限

张三 ──→ Owner  ──→ 创建项目、删除项目、管理成员、删除团队
李四 ──→ Admin  ──→ 创建项目、删除项目、管理成员
王五 ──→ Member ──→ 创建项目、查看项目
```

### 1.2 生活类比

```
公司组织架构：

CEO（Owner）
  → 可以做任何事情
  → 可以解散公司

部门经理（Admin）
  → 可以管理本部门
  → 可以招聘和辞退员工

普通员工（Member）
  → 可以完成分配的任务
  → 不能管理其他人
```

---

## 二、定义权限

### 2.1 角色与权限映射

```tsx
// lib/permissions.ts

export const Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const

export type Role = (typeof Role)[keyof typeof Role]

// 权限定义
export const permissions = {
  // 团队权限
  team: {
    update: [Role.OWNER, Role.ADMIN],
    delete: [Role.OWNER],
    manageBilling: [Role.OWNER],
  },
  // 成员权限
  member: {
    invite: [Role.OWNER, Role.ADMIN],
    remove: [Role.OWNER, Role.ADMIN],
    updateRole: [Role.OWNER],
  },
  // 项目权限
  project: {
    create: [Role.OWNER, Role.ADMIN, Role.MEMBER],
    update: [Role.OWNER, Role.ADMIN, Role.MEMBER], // 创建者也可以更新
    delete: [Role.OWNER, Role.ADMIN],
  },
} as const

// 检查角色是否有权限
export function hasPermission(
  role: Role,
  resource: keyof typeof permissions,
  action: string
): boolean {
  const resourcePermissions = permissions[resource]
  if (!resourcePermissions) return false

  const allowedRoles = (resourcePermissions as any)[action]
  if (!allowedRoles) return false

  return allowedRoles.includes(role)
}
```

### 2.2 简化的权限检查

```tsx
// 更简单的写法
export function canUpdateTeam(role: Role): boolean {
  return role === Role.OWNER || role === Role.ADMIN
}

export function canDeleteTeam(role: Role): boolean {
  return role === Role.OWNER
}

export function canManageMembers(role: Role): boolean {
  return role === Role.OWNER || role === Role.ADMIN
}

export function canCreateProject(role: Role): boolean {
  return true // 所有成员都可以创建
}

export function canDeleteProject(role: Role): boolean {
  return role === Role.OWNER || role === Role.ADMIN
}
```

---

## 三、获取用户角色

```tsx
// lib/auth.ts
import { prisma } from './prisma'
import { getSession } from './session'
import { Role } from './permissions'

export async function getUserRole(teamId: string): Promise<Role | null> {
  const session = await getSession()

  if (!session.userId) {
    return null
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: session.userId,
        teamId,
      }
    }
  })

  return membership?.role as Role || null
}

export async function requireTeamRole(teamId: string): Promise<{
  userId: string
  role: Role
}> {
  const session = await getSession()

  if (!session.userId) {
    redirect('/login')
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: session.userId,
        teamId,
      }
    }
  })

  if (!membership) {
    redirect('/dashboard')
  }

  return {
    userId: session.userId,
    role: membership.role as Role,
  }
}
```

---

## 四、权限检查中间件

### 4.1 创建权限检查函数

```tsx
// lib/permissions.ts
import { redirect } from 'next/navigation'

export async function requirePermission(
  teamId: string,
  resource: string,
  action: string
) {
  const { role } = await requireTeamRole(teamId)

  if (!hasPermission(role, resource, action)) {
    throw new Error('没有权限执行此操作')
  }

  return role
}
```

### 4.2 在 Server Actions 中使用

```tsx
// app/teams/[teamId]/actions.ts
'use server'

import { requirePermission } from '@/lib/permissions'

export async function updateTeam(teamId: string, formData: FormData) {
  // 检查权限
  await requirePermission(teamId, 'team', 'update')

  const name = formData.get('name') as string

  await prisma.team.update({
    where: { id: teamId },
    data: { name }
  })

  revalidatePath(`/teams/${teamId}`)
}

export async function deleteTeam(teamId: string) {
  // 检查权限
  await requirePermission(teamId, 'team', 'delete')

  await prisma.team.delete({
    where: { id: teamId }
  })

  revalidatePath('/teams')
  redirect('/teams')
}

export async function inviteMember(teamId: string, email: string) {
  // 检查权限
  await requirePermission(teamId, 'member', 'invite')

  // ... 邀请逻辑
}

export async function removeMember(teamId: string, userId: string) {
  // 检查权限
  await requirePermission(teamId, 'member', 'remove')

  // 不能移除自己
  const session = await getSession()
  if (session.userId === userId) {
    return { error: '不能移除自己，请使用退出团队功能' }
  }

  // 不能移除 Owner
  const membership = await prisma.membership.findUnique({
    where: { userId_teamId: { userId, teamId } }
  })

  if (membership?.role === 'OWNER') {
    return { error: '不能移除团队所有者' }
  }

  await prisma.membership.delete({
    where: { userId_teamId: { userId, teamId } }
  })

  revalidatePath(`/teams/${teamId}`)
}
```

---

## 五、UI 权限控制

### 5.1 权限包装组件

```tsx
// components/PermissionGate.tsx
import { ReactNode } from 'react'

interface PermissionGateProps {
  allowed: boolean
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGate({
  allowed,
  fallback = null,
  children
}: PermissionGateProps) {
  if (!allowed) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
```

### 5.2 在页面中使用

```tsx
// app/teams/[teamId]/page.tsx
import { getUserRole } from '@/lib/auth'
import { canManageMembers, canDeleteTeam } from '@/lib/permissions'
import { PermissionGate } from '@/components/PermissionGate'

export default async function TeamPage({
  params
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  const role = await getUserRole(teamId)
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: { user: true }
      }
    }
  })

  return (
    <div>
      <h1>{team.name}</h1>

      {/* 只有 Admin 和 Owner 看到邀请按钮 */}
      <PermissionGate allowed={canManageMembers(role)}>
        <a href={`/teams/${teamId}/invite`}>邀请成员</a>
      </PermissionGate>

      {/* 只有 Owner 看到删除按钮 */}
      <PermissionGate allowed={canDeleteTeam(role)}>
        <DeleteTeamButton teamId={teamId} />
      </PermissionGate>

      {/* 成员列表 */}
      <ul>
        {team.members.map(member => (
          <li key={member.id}>
            {member.user.name} - {member.role}
            {/* 只有 Admin 和 Owner 看到移除按钮 */}
            <PermissionGate allowed={canManageMembers(role) && member.role !== 'OWNER'}>
              <RemoveMemberButton teamId={teamId} userId={member.userId} />
            </PermissionGate>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### 5.3 客户端权限检查

```tsx
// components/TeamActions.tsx
'use client'

import { Role } from '@/lib/permissions'

interface TeamActionsProps {
  role: Role
  teamId: string
}

export function TeamActions({ role, teamId }: TeamActionsProps) {
  return (
    <div>
      {canUpdateTeam(role) && (
        <a href={`/teams/${teamId}/edit`}>编辑团队</a>
      )}

      {canManageMembers(role) && (
        <a href={`/teams/${teamId}/members`}>管理成员</a>
      )}

      {canDeleteTeam(role) && (
        <DeleteTeamButton teamId={teamId} />
      )}
    </div>
  )
}
```

---

## 六、项目级权限

### 6.1 项目创建者权限

```tsx
// 检查是否是项目创建者
export async function isProjectCreator(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { creatorId: true }
  })

  return project?.creatorId === userId
}

// 检查项目操作权限
export async function canUpdateProject(
  projectId: string,
  teamId: string,
  userId: string
): Promise<boolean> {
  const role = await getUserRole(teamId)

  // Admin 和 Owner 可以更新任何项目
  if (role === Role.OWNER || role === Role.ADMIN) {
    return true
  }

  // Member 只能更新自己创建的项目
  return isProjectCreator(projectId, userId)
}
```

### 6.2 在 Server Action 中使用

```tsx
export async function updateProject(
  projectId: string,
  formData: FormData
) {
  const session = await getSession()
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  })

  if (!project) {
    return { error: '项目不存在' }
  }

  const canUpdate = await canUpdateProject(
    projectId,
    project.teamId,
    session.userId
  )

  if (!canUpdate) {
    return { error: '没有权限编辑此项目' }
  }

  // 更新项目...
}
```

---

## 七、完整的权限系统

```tsx
// lib/permissions.ts
import { getSession } from './session'
import { prisma } from './prisma'

export const Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const

export type Role = (typeof Role)[keyof typeof Role]

// 角色层级（数字越大权限越高）
const roleHierarchy: Record<Role, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
}

// 检查角色是否足够高
export function hasMinimumRole(userRole: Role, minimumRole: Role): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[minimumRole]
}

// 获取用户在团队中的角色
export async function getTeamRole(teamId: string): Promise<Role | null> {
  const session = await getSession()
  if (!session.userId) return null

  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: session.userId,
        teamId,
      }
    }
  })

  return membership?.role as Role || null
}

// 要求特定角色
export async function requireTeamRole(teamId: string, minimumRole: Role) {
  const role = await getTeamRole(teamId)

  if (!role) {
    throw new Error('你不是团队成员')
  }

  if (!hasMinimumRole(role, minimumRole)) {
    throw new Error('权限不足')
  }

  return role
}

// 权限检查封装
export async function withTeamPermission<T>(
  teamId: string,
  minimumRole: Role,
  callback: () => Promise<T>
): Promise<T> {
  await requireTeamRole(teamId, minimumRole)
  return callback()
}
```

---

## 八、动手练习

### 练习 1：实现角色管理

创建一个页面，允许 Owner 和 Admin 管理成员角色：

1. 显示成员列表和当前角色
2. 允许 Owner 更改任何人的角色
3. 允许 Admin 更改 Member 的角色
4. 不允许降低自己的角色

### 练习 2：实现项目权限

1. 任何成员都可以创建项目
2. 只有创建者、Admin 和 Owner 可以编辑项目
3. 只有 Admin 和 Owner 可以删除项目
4. 在 UI 中正确显示/隐藏操作按钮

### 练习 3：实现权限审计日志

记录所有权限变更操作：

```tsx
await prisma.auditLog.create({
  data: {
    action: 'UPDATE_ROLE',
    userId: session.userId,
    targetId: memberId,
    teamId,
    details: {
      oldRole: 'MEMBER',
      newRole: 'ADMIN',
    }
  }
})
```

---

## 参考答案

### 练习 1：实现角色管理

**思路**：创建一个角色管理页面，显示成员列表和当前角色，提供角色选择下拉框。Owner 可以更改任何人（除了自己）的角色，Admin 可以更改 Member 的角色。在 Server Action 中做权限校验。

**答案**：

```tsx
// app/teams/[teamId]/members/page.tsx
import { prisma } from '@/lib/prisma'
import { getUserRole } from '@/lib/auth'
import { Role } from '@/lib/permissions'
import { PermissionGate } from '@/components/PermissionGate'
import { RoleSelect } from './RoleSelect'

export default async function MembersPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  const currentRole = await getUserRole(teamId)

  const members = await prisma.membership.findMany({
    where: { teamId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">成员管理</h1>
      <ul className="space-y-4">
        {members.map((member) => {
          const canEdit =
            (currentRole === Role.OWNER && member.role !== Role.OWNER) ||
            (currentRole === Role.ADMIN && member.role === Role.MEMBER)

          return (
            <li key={member.id} className="flex items-center justify-between p-4 border rounded">
              <div>
                <span className="font-medium">{member.user.name}</span>
                <span className="text-gray-500 ml-2">{member.user.email}</span>
                <span className="ml-2 px-2 py-1 text-xs bg-gray-100 rounded">{member.role}</span>
              </div>
              <PermissionGate allowed={canEdit}>
                <RoleSelect teamId={teamId} userId={member.userId} currentRole={member.role} />
              </PermissionGate>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

```tsx
// app/teams/[teamId]/members/RoleSelect.tsx
'use client'

import { useTransition } from 'react'
import { updateMemberRole } from '../actions'

interface RoleSelectProps {
  teamId: string
  userId: string
  currentRole: string
}

export function RoleSelect({ teamId, userId, currentRole }: RoleSelectProps) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as 'ADMIN' | 'MEMBER'
    startTransition(async () => {
      await updateMemberRole(teamId, userId, newRole)
    })
  }

  return (
    <select
      value={currentRole}
      onChange={handleChange}
      disabled={isPending}
      className="px-2 py-1 border rounded disabled:opacity-50"
    >
      <option value="MEMBER">Member</option>
      <option value="ADMIN">Admin</option>
    </select>
  )
}
```

```tsx
// app/teams/[teamId]/actions.ts 中的 updateMemberRole
'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function updateMemberRole(
  teamId: string,
  userId: string,
  newRole: 'ADMIN' | 'MEMBER'
) {
  const session = await getSession()
  if (!session.userId) return { error: '请先登录' }

  const operatorMembership = await prisma.membership.findUnique({
    where: { userId_teamId: { userId: session.userId, teamId } },
  })

  if (operatorMembership?.role !== 'OWNER') {
    return { error: '只有 Owner 可以更改角色' }
  }

  if (session.userId === userId) {
    return { error: '不能更改自己的角色' }
  }

  await prisma.membership.update({
    where: { userId_teamId: { userId, teamId } },
    data: { role: newRole },
  })

  revalidatePath(`/teams/${teamId}/members`)
  return { success: true }
}
```

**要点**：
- 权限判断逻辑：Owner 可以改任何人（除了自己），Admin 只能改 Member
- `useTransition` 让角色变更操作不阻塞 UI，提升用户体验
- 服务端必须独立校验权限，不能信任前端传来的参数

### 练习 2：实现项目权限

**思路**：项目权限结合了团队角色和创建者身份。Admin/Owner 可以编辑和删除任何项目，Member 只能编辑自己创建的项目。在 Server Action 和 UI 中分别做权限校验。

**答案**：

```tsx
// lib/permissions.ts 中添加项目权限函数
import { prisma } from './prisma'
import { getSession } from './session'

export async function canUpdateProject(
  projectId: string,
  teamId: string
): Promise<boolean> {
  const session = await getSession()
  if (!session.userId) return false

  const role = await getTeamRole(teamId)
  if (role === Role.OWNER || role === Role.ADMIN) return true

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { creatorId: true },
  })

  return project?.creatorId === session.userId
}

export async function canDeleteProject(teamId: string): Promise<boolean> {
  const role = await getTeamRole(teamId)
  return role === Role.OWNER || role === Role.ADMIN
}
```

```tsx
// app/teams/[teamId]/projects/[projectId]/page.tsx
import { prisma } from '@/lib/prisma'
import { canUpdateProject, canDeleteProject } from '@/lib/permissions'
import { PermissionGate } from '@/components/PermissionGate'
import { DeleteProjectButton } from './DeleteProjectButton'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ teamId: string; projectId: string }>
}) {
  const { teamId, projectId } = await params

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      creator: { select: { id: true, name: true } },
    },
  })

  if (!project) {
    return <div className="p-6">项目不存在</div>
  }

  const editable = await canUpdateProject(projectId, teamId)
  const deletable = await canDeleteProject(teamId)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{project.name}</h1>
      <p className="text-gray-600 mb-4">{project.description || '暂无描述'}</p>
      <p className="text-sm text-gray-500 mb-6">创建者：{project.creator.name}</p>

      <div className="flex gap-4">
        <PermissionGate allowed={editable}>
          <a href={`/teams/${teamId}/projects/${projectId}/edit`} className="px-4 py-2 bg-blue-500 text-white rounded">
            编辑项目
          </a>
        </PermissionGate>
        <PermissionGate allowed={deletable}>
          <DeleteProjectButton teamId={teamId} projectId={projectId} />
        </PermissionGate>
      </div>
    </div>
  )
}
```

```tsx
// app/teams/[teamId]/projects/[projectId]/DeleteProjectButton.tsx
'use client'

import { deleteProject } from './actions'

export function DeleteProjectButton({ teamId, projectId }: { teamId: string; projectId: string }) {
  return (
    <button
      onClick={async () => {
        if (confirm('确定删除此项目？')) {
          await deleteProject(projectId)
        }
      }}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
    >
      删除项目
    </button>
  )
}
```

**要点**：
- `canUpdateProject` 结合了团队角色和创建者身份两种权限判断
- 删除按钮只对 Admin 和 Owner 可见，但服务端仍然会二次校验
- 前端的 `confirm` 弹窗是防止误操作的体验优化，不是安全措施

### 练习 3：实现权限审计日志

**思路**：创建 AuditLog 模型记录所有敏感操作，在每个权限变更的 Server Action 中写入日志。日志需要记录操作者、操作类型、目标对象和变更详情。

**答案**：

```prisma
// prisma/schema.prisma 中添加
model AuditLog {
  id        String   @id @default(cuid())
  action    String
  userId    String
  targetId  String?
  teamId    String
  details   Json?
  createdAt DateTime @default(now())

  user   User @relation(fields: [userId], references: [id])
  team   Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
}
```

在 User 和 Team 模型中添加反向关系：

```prisma
model User {
  // ... 已有字段
  auditLogs AuditLog[]
}

model Team {
  // ... 已有字段
  auditLogs AuditLog[]
}
```

执行迁移：

```bash
npx prisma migrate dev --name add-audit-log
```

创建审计日志工具函数：

```tsx
// lib/audit.ts
import { prisma } from './prisma'

export async function createAuditLog({
  action,
  userId,
  targetId,
  teamId,
  details,
}: {
  action: string
  userId: string
  targetId?: string
  teamId: string
  details?: Record<string, unknown>
}) {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      targetId,
      teamId,
      details: details ?? undefined,
    },
  })
}
```

在权限变更操作中记录日志：

```tsx
// app/teams/[teamId]/actions.ts
import { createAuditLog } from '@/lib/audit'

export async function updateMemberRole(
  teamId: string,
  userId: string,
  newRole: 'ADMIN' | 'MEMBER'
) {
  // ... 权限检查代码省略

  const oldMembership = await prisma.membership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  })

  await prisma.membership.update({
    where: { userId_teamId: { userId, teamId } },
    data: { role: newRole },
  })

  await createAuditLog({
    action: 'UPDATE_ROLE',
    userId: session.userId,
    targetId: userId,
    teamId,
    details: {
      oldRole: oldMembership?.role,
      newRole,
    },
  })

  revalidatePath(`/teams/${teamId}/members`)
  return { success: true }
}

export async function removeMember(teamId: string, userId: string) {
  // ... 权限检查代码省略

  await prisma.membership.delete({
    where: { userId_teamId: { userId, teamId } },
  })

  await createAuditLog({
    action: 'REMOVE_MEMBER',
    userId: session.userId,
    targetId: userId,
    teamId,
  })

  revalidatePath(`/teams/${teamId}`)
  return { success: true }
}
```

查询审计日志：

```tsx
// lib/queries.ts
export async function getTeamAuditLogs(teamId: string) {
  return prisma.auditLog.findMany({
    where: { teamId },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}
```

**要点**：
- `details` 使用 `Json` 类型存储任意变更详情，灵活性高
- 审计日志应该是异步写入且不阻塞主流程，但为了简化示例这里用了同步写入
- 生产环境中审计日志通常不允许删除，`onDelete: Cascade` 只在团队删除时清理

---

## 常见误区

1. **"前端隐藏按钮就等于权限控制"**：隐藏按钮只是 UI 层面的优化，用户可以通过浏览器开发者工具或直接调用 API 绕过。所有权限检查必须在服务端执行。
2. **"Owner 可以做任何事所以不需要检查"**：即使是 Owner，某些操作也需要检查——比如 Owner 不能移除自己（应该用"退出团队"功能），Owner 不能降低自己的角色。
3. **"权限检查只在页面入口做一次"**：权限应该在每个写操作的 Server Action 中独立检查，不能假设"用户能进入这个页面就有权限执行所有操作"。同一个页面上，Admin 能看到删除按钮但 Member 不能。
4. **"角色用字符串比较就行"**：用 `role === 'ADMIN'` 散落在代码各处，改起来容易遗漏。应该定义 `hasMinimumRole(userRole, minimumRole)` 函数，用层级数字比较权限。

## 工程建议

1. **用 `withTeamPermission` 封装权限检查**：把权限检查和业务逻辑封装在一起，`await withTeamPermission(teamId, Role.ADMIN, async () => { ... })`，避免在每个 Server Action 中重复写检查逻辑。
2. **权限变更要记录审计日志**：角色升降级、成员移除、团队删除等敏感操作，必须记录谁在什么时候做了什么。这是事后追溯和安全审计的基础。
3. **UI 权限用 `PermissionGate` 组件**：`<PermissionGate allowed={canManageMembers(role)}>` 统一控制按钮的显示和隐藏，避免在模板中到处写 `role === 'OWNER' && ...`。
4. **项目级权限要同时考虑团队角色和创建者身份**：Admin 可以编辑任何项目，但 Member 只能编辑自己创建的项目。这种组合权限需要用 `canUpdateProject(projectId, teamId, userId)` 函数统一判断。

## 九、小结

```
本课核心要点：

1. RBAC 模型：用户 → 角色 → 权限
2. 三种角色：Owner（全部权限）、Admin（管理权限）、Member（基本权限）
3. 权限检查要在服务端执行，不能只依赖前端
4. 使用 PermissionGate 组件控制 UI 显示
5. 项目级权限：团队角色 + 创建者身份
6. 所有权限变更都应该记录审计日志
```

下一课我们将学习表单验证：Zod schema 与错误展示。
