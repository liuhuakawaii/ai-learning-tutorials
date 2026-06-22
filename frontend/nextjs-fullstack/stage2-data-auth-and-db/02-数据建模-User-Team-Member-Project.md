# 第二课：数据建模 — User、Team、Member、Project

## 场景引入

你正在开发一个团队协作工具，需要支持"一个用户可以加入多个团队，每个团队有多个项目，团队成员有不同的角色"。你开始设计数据库：User 表存用户信息，Team 表存团队信息，然后你卡住了——用户和团队是多对多关系，要不要用联合表？团队和项目是一对多，外键放在哪边？成员角色是用枚举还是字符串？如果删除一个团队，它的成员关系和项目应该怎么处理？数据建模是整个应用的地基，设计得好后续开发顺风顺水，设计不好就会陷入无穷无尽的重构。

## 学习目标

完成本课学习后，你将能够：

1. 理解关系型数据库中的关系类型
2. 掌握 Prisma 中的一对多、多对多关系
3. 设计团队协作系统的数据模型
4. 使用 Prisma 的 `include` 和 `select` 查询关联数据
5. 理解级联删除和约束

---

## 一、关系类型

### 1.1 三种基本关系

```
一对一（1:1）
  一个用户有一个个人资料
  User ──── Profile

一对多（1:N）
  一个团队有多个成员
  Team ──── Member

多对多（M:N）
  一个项目可以有多个标签，一个标签可以属于多个项目
  Project ──── Tag
```

### 1.2 生活类比

```
一对一 = 一个人只能有一张身份证
  身份证号 → 人

一对多 = 一个班级有多个学生
  班级 → 学生

多对多 = 一个学生可以选多门课，一门课可以有多个学生
  学生 ↔ 课程
```

---

## 二、设计团队协作模型

### 2.1 需求分析

我们要实现的功能：

- 用户可以创建团队
- 团队可以邀请成员
- 团队可以创建项目
- 成员有不同的角色（owner、admin、member）

### 2.2 模型设计

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 用户模型
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  avatar    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 关系：用户拥有的团队
  ownedTeams Team[] @relation("TeamOwner")
  // 关系：用户作为成员的团队
  memberships Membership[]
  // 关系：用户创建的项目
  projects Project[] @relation("ProjectCreator")
}

// 团队模型
model Team {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 关系：团队所有者
  owner   User   @relation("TeamOwner", fields: [ownerId], references: [id])
  ownerId String

  // 关系：团队成员
  members Membership[]
  // 关系：团队项目
  projects Project[]
}

// 成员关系模型（多对多的中间表）
model Membership {
  id     String @id @default(cuid())
  role   Role   @default(MEMBER)

  // 关系：用户
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String

  // 关系：团队
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 联合唯一约束：一个用户在一个团队中只能有一个角色
  @@unique([userId, teamId])
}

// 项目模型
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 关系：所属团队
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId String

  // 关系：创建者
  creator   User   @relation("ProjectCreator", fields: [creatorId], references: [id])
  creatorId String
}

// 角色枚举
enum Role {
  OWNER
  ADMIN
  MEMBER
}
```

---

## 三、关系详解

### 3.1 一对多关系

```prisma
// Team（一）→ Project（多）
model Team {
  id       String    @id @default(cuid())
  projects Project[]  // 一个团队有多个项目
}

model Project {
  id       String @id @default(cuid())
  team     Team   @relation(fields: [teamId], references: [id])
  teamId   String  // 外键
}
```

### 3.2 多对多关系

```prisma
// 通过中间表实现
model User {
  id          String       @id @default(cuid())
  memberships Membership[] // 一个用户有多个成员关系
}

model Team {
  id        String       @id @default(cuid())
  members   Membership[] // 一个团队有多个成员
}

model Membership {
  id     String @id @default(cuid())
  user   User   @relation(fields: [userId], references: [id])
  userId String
  team   Team   @relation(fields: [teamId], references: [id])
  teamId String

  @@unique([userId, teamId]) // 联合唯一
}
```

### 3.3 级联删除

```prisma
model Membership {
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
}
```

`onDelete` 选项：

```
Cascade      删除父记录时，同时删除子记录
Restrict     如果有子记录，不允许删除父记录
SetNull      删除父记录时，子记录的外键设为 null
NoAction     类似 Restrict，但延迟检查
```

---

## 四、执行迁移

```bash
npx prisma migrate dev --name add-team-models
```

查看生成的 SQL：

```sql
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");
CREATE UNIQUE INDEX "Membership_userId_teamId_key" ON "Membership"("userId", "teamId");
```

---

## 五、查询关联数据

### 5.1 使用 include

```tsx
// 查询团队及其成员
const team = await prisma.team.findUnique({
  where: { slug: 'my-team' },
  include: {
    owner: true,
    members: {
      include: {
        user: true,
      }
    },
    projects: true,
  }
})

// 结果结构：
// {
//   id: '...',
//   name: 'My Team',
//   slug: 'my-team',
//   owner: { id: '...', name: '张三', ... },
//   members: [
//     {
//       id: '...',
//       role: 'OWNER',
//       user: { id: '...', name: '张三', ... }
//     },
//     {
//       id: '...',
//       role: 'MEMBER',
//       user: { id: '...', name: '李四', ... }
//     }
//   ],
//   projects: [...]
// }
```

### 5.2 使用 select

```tsx
// 只查询需要的字段
const team = await prisma.team.findUnique({
  where: { id: teamId },
  select: {
    id: true,
    name: true,
    members: {
      select: {
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    }
  }
})
```

### 5.3 嵌套查询

```tsx
// 查询用户所属的所有团队及其项目
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    memberships: {
      include: {
        team: {
          include: {
            projects: true,
          }
        }
      }
    }
  }
})
```

---

## 六、写入关联数据

### 6.1 创建团队并添加成员

```tsx
// 创建团队时自动添加创建者为 OWNER
const team = await prisma.team.create({
  data: {
    name: '我的团队',
    slug: 'my-team',
    owner: { connect: { id: userId } },
    members: {
      create: {
        userId: userId,
        role: 'OWNER',
      }
    }
  },
  include: {
    members: true,
  }
})
```

### 6.2 邀请成员

```tsx
// 添加新成员
const membership = await prisma.membership.create({
  data: {
    userId: inviteeId,
    teamId: teamId,
    role: 'MEMBER',
  }
})
```

### 6.3 更新成员角色

```tsx
const updated = await prisma.membership.update({
  where: {
    userId_teamId: {
      userId: memberId,
      teamId: teamId,
    }
  },
  data: {
    role: 'ADMIN',
  }
})
```

---

## 七、在 Server Actions 中使用

```tsx
// app/teams/actions.ts
'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createTeam(formData: FormData) {
  const name = formData.get('name') as string
  const userId = await getCurrentUserId()

  // 生成 slug
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  // 检查 slug 唯一性
  const existing = await prisma.team.findUnique({
    where: { slug }
  })

  if (existing) {
    return { error: '团队名称已存在' }
  }

  // 创建团队
  const team = await prisma.team.create({
    data: {
      name,
      slug,
      owner: { connect: { id: userId } },
      members: {
        create: {
          userId,
          role: 'OWNER',
        }
      }
    }
  })

  revalidatePath('/teams')
  return { success: true, teamId: team.id }
}

export async function inviteMember(teamId: string, email: string) {
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    return { error: '用户不存在' }
  }

  // 检查是否已是成员
  const existing = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId,
      }
    }
  })

  if (existing) {
    return { error: '该用户已是团队成员' }
  }

  await prisma.membership.create({
    data: {
      userId: user.id,
      teamId,
      role: 'MEMBER',
    }
  })

  revalidatePath(`/teams/${teamId}`)
  return { success: true }
}
```

---

## 八、动手练习

### 练习 1：完善数据模型

在现有基础上添加：

```prisma
model Task {
  id          String    @id @default(cuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority  @default(MEDIUM)
  assignee    User?     @relation(fields: [assigneeId], references: [id])
  assigneeId  String?
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

### 练习 2：编写查询函数

```tsx
// 查询团队的所有任务
async function getTeamTasks(teamId: string) {
  return prisma.task.findMany({
    where: {
      project: {
        teamId,
      }
    },
    include: {
      assignee: {
        select: { id: true, name: true, email: true }
      },
      project: {
        select: { id: true, name: true }
      }
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' }
    ]
  })
}

// 查询用户被分配的任务
async function getUserTasks(userId: string) {
  return prisma.task.findMany({
    where: { assigneeId: userId },
    include: {
      project: {
        select: { id: true, name: true }
      }
    }
  })
}
```

### 练习 3：实现成员管理

编写以下 Server Actions：

1. `removeMember(teamId, userId)` — 移除成员
2. `updateMemberRole(teamId, userId, role)` — 更新角色
3. `leaveTeam(teamId)` — 退出团队

---

## 参考答案

### 练习 1：完善数据模型

**思路**：在现有 Schema 基础上添加 Task 模型，关联到 Project 和 User（可选的负责人）。使用枚举定义任务状态和优先级。

**答案**：

```prisma
// 在 prisma/schema.prisma 中添加

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  assignee    User?      @relation(fields: [assigneeId], references: [id])
  assigneeId  String?
  project     Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId   String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

同时在 Project 模型中添加反向关系：

```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  team      Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId    String

  creator   User   @relation("ProjectCreator", fields: [creatorId], references: [id])
  creatorId String

  tasks     Task[] // 添加反向关系
}
```

在 User 模型中添加：

```prisma
model User {
  // ... 已有字段
  assignedTasks Task[] // 添加反向关系
}
```

执行迁移：

```bash
npx prisma migrate dev --name add-task-model
```

**要点**：
- `assignee` 是可选的（`User?`），因为任务创建时可能还没有分配负责人
- `onDelete: Cascade` 意味着删除项目时会同时删除其所有任务
- 枚举类型在 PostgreSQL 中会创建为独立的类型，可以在多个字段中复用

### 练习 2：编写查询函数

**思路**：查询团队的所有任务需要通过 Project 的 `teamId` 反向查找。查询用户的任务则直接用 `assigneeId` 过滤。使用 `include` 和 `select` 控制返回的关联数据。

**答案**：

```tsx
// lib/queries.ts
import { prisma } from './prisma'

export async function getTeamTasks(teamId: string) {
  return prisma.task.findMany({
    where: {
      project: {
        teamId,
      },
    },
    include: {
      assignee: {
        select: { id: true, name: true, email: true },
      },
      project: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getUserTasks(userId: string) {
  return prisma.task.findMany({
    where: { assigneeId: userId },
    include: {
      project: {
        select: { id: true, name: true, teamId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getProjectTasks(projectId: string) {
  return prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: {
        select: { id: true, name: true },
      },
    },
    orderBy: [
      { status: 'asc' },
      { priority: 'desc' },
    ],
  })
}
```

**要点**：
- `where: { project: { teamId } }` 是嵌套过滤，通过关联模型的字段进行查询
- `orderBy` 支持多字段排序，优先级高的排前面，同优先级按创建时间倒序
- `select` 比 `include` 更精确，只返回需要的字段，减少数据传输量

### 练习 3：实现成员管理

**思路**：三个 Server Action 都需要权限检查。`removeMember` 要防止移除自己和 Owner；`updateMemberRole` 要防止 Owner 降级自己；`leaveTeam` 是用户主动退出，不需要权限检查但要防止 Owner 退出。

**答案**：

```tsx
// app/teams/[teamId]/actions.ts
'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function removeMember(teamId: string, userId: string) {
  const session = await getSession()
  if (!session.userId) {
    return { error: '请先登录' }
  }

  // 检查操作者权限
  const operatorMembership = await prisma.membership.findUnique({
    where: {
      userId_teamId: { userId: session.userId, teamId },
    },
  })

  if (!operatorMembership || operatorMembership.role === 'MEMBER') {
    return { error: '没有权限移除成员' }
  }

  // 不能移除自己
  if (session.userId === userId) {
    return { error: '不能移除自己，请使用退出团队功能' }
  }

  // 不能移除 Owner
  const targetMembership = await prisma.membership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  })

  if (targetMembership?.role === 'OWNER') {
    return { error: '不能移除团队所有者' }
  }

  await prisma.membership.delete({
    where: { userId_teamId: { userId, teamId } },
  })

  revalidatePath(`/teams/${teamId}`)
  return { success: true }
}

export async function updateMemberRole(
  teamId: string,
  userId: string,
  newRole: 'ADMIN' | 'MEMBER'
) {
  const session = await getSession()
  if (!session.userId) {
    return { error: '请先登录' }
  }

  const operatorMembership = await prisma.membership.findUnique({
    where: {
      userId_teamId: { userId: session.userId, teamId },
    },
  })

  // 只有 Owner 可以更改角色
  if (operatorMembership?.role !== 'OWNER') {
    return { error: '只有 Owner 可以更改成员角色' }
  }

  // 不能更改自己的角色
  if (session.userId === userId) {
    return { error: '不能更改自己的角色' }
  }

  await prisma.membership.update({
    where: { userId_teamId: { userId, teamId } },
    data: { role: newRole },
  })

  revalidatePath(`/teams/${teamId}`)
  return { success: true }
}

export async function leaveTeam(teamId: string) {
  const session = await getSession()
  if (!session.userId) {
    return { error: '请先登录' }
  }

  // Owner 不能退出团队
  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: { userId: session.userId, teamId },
    },
  })

  if (membership?.role === 'OWNER') {
    return { error: 'Owner 不能退出团队，请先转让所有权或删除团队' }
  }

  await prisma.membership.delete({
    where: {
      userId_teamId: { userId: session.userId, teamId },
    },
  })

  revalidatePath('/teams')
  return { success: true }
}
```

**要点**：
- `removeMember` 和 `updateMemberRole` 都需要检查操作者的权限，不能只依赖前端隐藏按钮
- Owner 不能退出团队，必须先转让所有权或删除团队，这是业务规则的防护
- 使用联合唯一键 `userId_teamId` 定位成员记录，避免误操作

---

## 常见误区

1. **"多对多关系用隐式联合表就行"**：Prisma 支持隐式多对多（不需要手动定义中间表），但如果你需要在关系上附加额外字段（如角色、加入时间），就必须用显式的 Membership 模型。
2. **"级联删除用 Cascade 就对了"**：Cascade 意味着删除父记录时所有子记录都会被删除。删除一个团队会同时删除所有成员关系和项目——这可能不是你想要的。某些场景下 `Restrict`（阻止删除）或 `SetNull`（外键置空）更安全。
3. **"用 include 查所有关联数据"**：`include` 会查询所有关联字段，如果关联数据很多（如一个团队有 1000 个项目），会导致查询变慢。生产环境中应该用 `select` 只查询需要的字段。
4. **"联合唯一约束不需要"**：`@@unique([userId, teamId])` 确保一个用户在一个团队中只有一个成员记录。没有这个约束，同一个用户可能被重复添加到同一个团队。

## 工程建议

1. **先画 ER 图再写 Schema**：在动手写 `schema.prisma` 之前，先在纸上或工具中画出实体关系图，理清实体之间的关系类型和 cardinality，避免返工。
2. **用 `cuid()` 作为主键**：相比自增 ID，`cuid()` 生成的 ID 不可预测、适合分布式系统、可以在客户端生成（减少一次数据库往返）。
3. **查询时用 `select` 控制返回字段**：不要用 `include` 返回所有关联数据，明确列出需要的字段。这不仅减少数据传输量，还能避免意外暴露敏感字段（如密码哈希）。
4. **在 Server Action 中做写入关联数据**：创建团队时自动添加创建者为 OWNER，这种业务逻辑应该封装在 Server Action 中，而不是分散在多个地方。

## 九、小结

```
本课核心要点：

1. 三种关系：一对一、一对多、多对多
2. 多对多关系通过中间表实现
3. onDelete: Cascade 实现级联删除
4. include 查询关联数据，select 选择特定字段
5. @@unique([userId, teamId]) 实现联合唯一约束
6. 团队协作系统的核心：User、Team、Membership、Project
```

下一课我们将学习登录注册和 Session 管理。
