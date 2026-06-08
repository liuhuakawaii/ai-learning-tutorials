# 第二课：数据建模 — User、Team、Member、Project

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
