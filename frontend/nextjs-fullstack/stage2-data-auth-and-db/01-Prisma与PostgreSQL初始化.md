# Prisma 与 PostgreSQL 初始化

## 数据库选型

应用需要持久化存储。选项有 SQLite（文件数据库）、PostgreSQL（关系型）、MongoDB（文档型）。

本课选 PostgreSQL + Prisma：
- PostgreSQL 成熟稳定，支持 JSON、全文搜索、地理数据
- Prisma 是 TypeScript 优先的 ORM，类型安全，迁移工具好用

## 初始化步骤

### 1. 安装依赖

```bash
npm install prisma @prisma/client
npx prisma init
```

这会创建 `prisma/schema.prisma` 和 `.env` 文件。

### 2. 配置数据库连接

```env
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

本地开发可以用 Docker 启动 PostgreSQL：

```bash
docker run --name mydb -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mydb -p 5432:5432 -d postgres:16
```

### 3. 定义数据模型

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
  role      Role     @default(MEMBER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  projects  ProjectMember[]
}

model Project {
  id        String   @id @default(cuid())
  name      String
  description String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members   ProjectMember[]
}

model ProjectMember {
  id        String   @id @default(cuid())
  userId    String
  projectId String
  role      Role     @default(MEMBER)
  user      User     @relation(fields: [userId], references: [id])
  project   Project  @relation(fields: [projectId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, projectId])
}

enum Role {
  OWNER
  ADMIN
  MEMBER
}
```

### 4. 运行迁移

```bash
npx prisma migrate dev --name init
```

这会：
1. 生成 SQL 迁移文件
2. 执行迁移
3. 生成 Prisma Client 类型

### 5. 初始化 Prisma Client

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

开发环境下 Next.js 热重载会创建多个 Prisma Client 实例，用全局变量缓存避免连接池耗尽。

## 基本 CRUD

```typescript
// 创建
const user = await prisma.user.create({
  data: { email: 'alice@example.com', name: 'Alice' },
})

// 查询
const users = await prisma.user.findMany({
  where: { role: 'ADMIN' },
  include: { projects: true },
})

// 更新
await prisma.user.update({
  where: { id: user.id },
  data: { name: 'Alice Updated' },
})

// 删除
await prisma.user.delete({ where: { id: user.id } })
```

## 关系查询

```typescript
// 给用户添加项目角色
await prisma.projectMember.create({
  data: {
    userId: user.id,
    projectId: project.id,
    role: 'ADMIN',
  },
})

// 查询项目及其成员
const project = await prisma.project.findUnique({
  where: { id: projectId },
  include: {
    members: {
      include: { user: true },
    },
  },
})
```

## Prisma Studio

可视化查看和编辑数据：

```bash
npx prisma studio
```

打开 http://localhost:5555，可以浏览所有表、筛选数据、编辑记录。

## 练习

### 练习一：初始化数据库

用 Docker 启动 PostgreSQL，运行 `prisma migrate dev`，用 Prisma Studio 查看表结构。

### 练习二：种子数据

创建 `prisma/seed.ts`，写入 3 个用户 + 2 个项目 + 项目成员关系。配置 `package.json` 的 `prisma.seed` 字段。

### 练习三：查询练习

写一个函数 `getProjectMembers(projectId)` 返回项目成员列表（包含用户信息），按加入时间排序。

---

## 参考答案

### 练习一

```bash
docker run --name mydb -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mydb -p 5432:5432 -d postgres:16
npx prisma migrate dev --name init
npx prisma studio
```

### 练习二

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const alice = await prisma.user.create({ data: { email: 'alice@example.com', name: 'Alice', role: 'OWNER' } })
  const bob = await prisma.user.create({ data: { email: 'bob@example.com', name: 'Bob' } })
  const project = await prisma.project.create({ data: { name: 'My Project', description: '测试项目' } })
  await prisma.projectMember.create({ data: { userId: alice.id, projectId: project.id, role: 'OWNER' } })
  await prisma.projectMember.create({ data: { userId: bob.id, projectId: project.id, role: 'MEMBER' } })
}
main().finally(() => prisma.$disconnect())
```

```json
// package.json
{ "prisma": { "seed": "npx tsx prisma/seed.ts" } }
```

### 练习三

```typescript
async function getProjectMembers(projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })
}
```
