# 第四课：权限模型 — owner、admin、member

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
