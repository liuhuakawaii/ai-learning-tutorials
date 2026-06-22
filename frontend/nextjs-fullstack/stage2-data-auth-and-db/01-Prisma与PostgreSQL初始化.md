# 第一课：Prisma + PostgreSQL 项目初始化

## 场景引入

你的 Next.js 项目已经有了页面和组件，但数据都写死在代码里。你决定引入数据库来持久化存储数据，于是开始写原生 SQL：`SELECT * FROM users WHERE id = $1`——然后你发现要手动拼接查询字符串、手动解析结果集、手动维护表结构变更，每改一个字段就要写一堆 ALTER TABLE 语句。更痛苦的是，SQL 查询返回的是 `any` 类型，TypeScript 完全帮不上忙，拼错字段名只有运行时才会报错。你需要一个工具，让你用 TypeScript 的方式操作数据库，同时自动管理表结构的版本迁移。

## 学习目标

完成本课学习后，你将能够：

1. 理解 Prisma 是什么以及它解决什么问题
2. 完成 PostgreSQL 数据库的安装和配置
3. 初始化 Prisma 并理解项目结构
4. 编写第一个 Schema 并执行迁移
5. 使用 Prisma Client 进行基本的 CRUD 操作

---

## 一、Prisma 是什么

### 1.1 ORM 的概念

> **ORM（Object-Relational Mapping）是把数据库表映射成代码中的对象的技术。** 你不需要写 SQL，直接用代码操作对象就行。

```
没有 ORM：
  写 SQL → 执行查询 → 手动解析结果 → 转成对象

有 ORM：
  直接调用方法 → 自动转成 SQL → 自动返回对象
```

### 1.2 为什么选择 Prisma

```
TypeScript 生态的 ORM 对比：

Prisma
  ✅ Schema 优先：先定义数据模型，再生成代码
  ✅ 类型安全：自动生成 TypeScript 类型
  ✅ 迁移系统：内置数据库迁移管理
  ✅ 可视化工具：Prisma Studio 查看数据
  ❌ 学习曲线：需要理解 Schema 语法

Drizzle
  ✅ SQL-like API：更接近原生 SQL
  ✅ 轻量级：更小的包体积
  ❌ 迁移系统：相对简单

TypeORM
  ✅ 功能全面：装饰器风格
  ❌ TypeScript 支持：类型推断不如 Prisma
  ❌ 维护活跃度：相对较慢
```

### 1.3 生活类比

```
直接写 SQL = 自己做饭
  - 你要知道每种食材怎么处理
  - 你要掌握火候
  - 你可以完全控制
  - 但很累

用 Prisma = 用智能电饭煲
  - 你告诉它要做什么（定义 Schema）
  - 它帮你处理细节（生成 SQL）
  - 你按按钮就行（调用方法）
  - 但你不能完全控制底层
```

---

## 二、安装 PostgreSQL

### 2.1 方式一：Docker（推荐）

```bash
# 拉取 PostgreSQL 镜像
docker pull postgres:16

# 启动容器
docker run -d \
  --name my-postgres \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=mydb \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:16
```

验证是否运行：

```bash
docker ps | grep my-postgres
```

### 2.2 方式二：本地安装

**macOS：**

```bash
brew install postgresql@16
brew services start postgresql@16
```

**Windows：**

下载安装程序：https://www.postgresql.org/download/windows/

**Ubuntu：**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2.3 创建数据库

```bash
# 使用 Docker
docker exec -it my-postgres psql -U myuser -d mydb

# 或本地安装
psql -U postgres
```

在 psql 中：

```sql
CREATE DATABASE mydb;
CREATE USER myuser WITH PASSWORD 'mypassword';
GRANT ALL PRIVILEGES ON DATABASE mydb TO myuser;
\q
```

---

## 三、初始化 Prisma

### 3.1 安装依赖

```bash
# 在 Next.js 项目中安装
npm install prisma @prisma/client

# 初始化 Prisma
npx prisma init
```

这会创建：

```
prisma/
└── schema.prisma    ← 数据模型定义
.env                 ← 环境变量
```

### 3.2 配置数据库连接

编辑 `.env`：

```env
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb"
```

连接字符串格式：

```
postgresql://用户名:密码@主机:端口/数据库名
```

### 3.3 Prisma Schema 结构

```prisma
// prisma/schema.prisma

// 指定 Prisma Client 的生成器
generator client {
  provider = "prisma-client-js"
}

// 数据源配置
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 数据模型（下一步定义）
```

---

## 四、定义数据模型

### 4.1 第一个模型

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
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 4.2 字段类型映射

```
Prisma 类型      PostgreSQL 类型     TypeScript 类型
────────────────────────────────────────────────────
String          text               string
Int             integer            number
Float           double precision   number
Boolean         boolean            boolean
DateTime        timestamp          Date
Json            jsonb              Prisma.JsonObject
Bytes           bytea              Buffer
```

### 4.3 属性说明

```
@id              主键
@default(...)    默认值
@unique          唯一约束
@map(...)        映射到不同的列名
@@map(...)       映射到不同的表名
@relation(...)   定义关系
@updatedAt       自动更新时间戳
```

---

## 五、执行迁移

### 5.1 创建迁移

```bash
npx prisma migrate dev --name init
```

这个命令会：

1. 根据 Schema 生成 SQL 迁移文件
2. 执行 SQL 创建表
3. 生成 Prisma Client

### 5.2 迁移文件结构

```
prisma/
├── schema.prisma
└── migrations/
    ├── 20240115100000_init/
    │   └── migration.sql    ← 生成的 SQL
    └── migration_lock.toml
```

查看生成的 SQL：

```sql
-- prisma/migrations/20240115100000_init/migration.sql
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
```

### 5.3 重置数据库

```bash
# 删除所有数据，重新执行所有迁移
npx prisma migrate reset
```

---

## 六、使用 Prisma Client

### 6.1 初始化 Client

```tsx
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**为什么要这样做？** Next.js 开发时会热重载，每次都创建新的 Prisma Client 会耗尽数据库连接。这个模式确保只创建一个实例。

### 6.2 CRUD 操作

**创建：**

```tsx
const user = await prisma.user.create({
  data: {
    email: 'zhangsan@example.com',
    name: '张三',
  },
})
// { id: 1, email: 'zhangsan@example.com', name: '张三', ... }
```

**查询：**

```tsx
// 查询单个
const user = await prisma.user.findUnique({
  where: { email: 'zhangsan@example.com' }
})

// 查询多个
const users = await prisma.user.findMany({
  where: { name: { contains: '张' } },
  orderBy: { createdAt: 'desc' },
  take: 10,
})

// 查询第一个
const firstUser = await prisma.user.findFirst({
  where: { name: { not: null } }
})
```

**更新：**

```tsx
const updatedUser = await prisma.user.update({
  where: { id: 1 },
  data: { name: '张三（已更新）' },
})
```

**删除：**

```tsx
await prisma.user.delete({
  where: { id: 1 },
})
```

### 6.3 在 Server Component 中使用

```tsx
// app/users/page.tsx
import { prisma } from '@/lib/prisma'

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          {user.name} - {user.email}
        </li>
      ))}
    </ul>
  )
}
```

---

## 七、Prisma Studio

Prisma 提供了一个可视化工具来查看和编辑数据：

```bash
npx prisma studio
```

打开 http://localhost:5555，你可以：

- 查看所有表和数据
- 创建、编辑、删除记录
- 执行过滤和排序

---

## 八、动手练习

### 练习 1：初始化项目

```bash
# 创建 Next.js 项目
npx create-next-app@latest my-prisma-app --typescript --tailwind --app

# 进入项目
cd my-prisma-app

# 安装 Prisma
npm install prisma @prisma/client
npx prisma init
```

### 练习 2：定义并迁移模型

创建一个 Blog 的数据模型：

```prisma
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}
```

执行迁移：

```bash
npx prisma migrate dev --name add-post-model
```

### 练习 3：编写 CRUD 操作

创建一个 API 路由测试 CRUD：

```tsx
// app/api/test/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  // 创建用户
  const user = await prisma.user.create({
    data: {
      email: `test${Date.now()}@example.com`,
      name: '测试用户',
    }
  })

  // 创建文章
  const post = await prisma.post.create({
    data: {
      title: '测试文章',
      content: '这是测试内容',
      authorId: user.id,
    }
  })

  // 查询
  const usersWithPosts = await prisma.user.findMany({
    include: { posts: true }
  })

  return NextResponse.json(usersWithPosts)
}
```

---

## 参考答案

### 练习 1：初始化项目

**思路**：按照标准流程创建 Next.js 项目，安装 Prisma 依赖并初始化。初始化后会自动生成 `prisma/schema.prisma` 和 `.env` 文件。

**答案**：

```bash
# 1. 创建 Next.js 项目
npx create-next-app@latest my-prisma-app --typescript --tailwind --app --eslint --use-npm

# 2. 进入项目目录
cd my-prisma-app

# 3. 安装 Prisma 相关依赖
npm install prisma @prisma/client

# 4. 初始化 Prisma
npx prisma init
```

初始化完成后，编辑 `.env` 配置数据库连接：

```env
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb"
```

**要点**：
- `@prisma/client` 是运行时依赖，`prisma` 是开发依赖（CLI 工具），两者都需要安装
- `npx prisma init` 会创建 `prisma/schema.prisma` 和 `.env`，不会覆盖已有的 `.env` 文件
- 连接字符串中的用户名、密码、数据库名要和 PostgreSQL 实际配置一致

### 练习 2：定义并迁移模型

**思路**：在 `schema.prisma` 中定义 User 和 Post 模型，使用 `@relation` 建立一对多关系。User 是"一"端，Post 是"多"端，Post 通过 `authorId` 外键关联 User。

**答案**：

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
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

执行迁移：

```bash
npx prisma migrate dev --name add-post-model
```

同时在 `lib/prisma.ts` 中创建全局单例：

```tsx
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**要点**：
- `author` 和 `authorId` 必须同时存在：`author` 定义关系，`authorId` 是实际的外键列
- `posts Post[]` 在 User 模型中定义反向关系，不需要外键
- 迁移前确保 PostgreSQL 已启动且数据库已创建

### 练习 3：编写 CRUD 操作

**思路**：创建一个 API 路由，依次演示创建、查询、更新、删除操作。使用 `include` 查询关联数据，使用 `select` 控制返回字段。

**答案**：

```tsx
// app/api/test/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  // 1. 创建用户
  const user = await prisma.user.create({
    data: {
      email: `test${Date.now()}@example.com`,
      name: '测试用户',
    },
  })

  // 2. 创建文章
  const post = await prisma.post.create({
    data: {
      title: '我的第一篇文章',
      content: '这是文章内容，Prisma 真好用',
      authorId: user.id,
    },
  })

  // 3. 查询用户及其文章
  const userWithPosts = await prisma.user.findUnique({
    where: { id: user.id },
    include: { posts: true },
  })

  // 4. 更新文章
  const updatedPost = await prisma.post.update({
    where: { id: post.id },
    data: { published: true },
  })

  // 5. 查询已发布文章
  const publishedPosts = await prisma.post.findMany({
    where: { published: true },
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  // 6. 删除文章
  await prisma.post.delete({
    where: { id: post.id },
  })

  // 7. 删除用户
  await prisma.user.delete({
    where: { id: user.id },
  })

  return NextResponse.json({
    createdUser: user,
    createdPost: post,
    userWithPosts,
    updatedPost,
    publishedPosts,
    message: 'CRUD 操作全部完成',
  })
}
```

访问 `http://localhost:3000/api/test` 即可测试。注意每次访问都会创建新数据，测试完后可以在 Prisma Studio 中清理。

**要点**：
- `include: { posts: true }` 会返回用户的所有关联文章
- `select` 可以精确控制返回的字段，避免返回敏感信息如密码
- 删除操作会按照外键约束执行，如果有 `onDelete: Cascade`，删除用户会同时删除其文章

---

## 常见误区

1. **"Prisma Client 可以在 Client Component 中使用"**：Prisma Client 需要连接数据库，只能在服务端（Server Component、Server Action、API Route）中使用。在 Client Component 中调用会报错。
2. **"每次使用都 new PrismaClient()"**：Next.js 开发模式下热重载会反复执行模块代码，每次都创建新的 Prisma Client 实例会耗尽数据库连接池。必须使用全局单例模式。
3. **"Schema 改了直接部署就行"**：修改 `schema.prisma` 后必须运行 `npx prisma migrate dev` 生成迁移文件并应用到数据库。直接部署会导致代码和数据库结构不一致。
4. **"Docker 容器重启数据就丢了"**：使用 Docker 运行 PostgreSQL 时，如果没有挂载 volume（`-v postgres_data:/var/lib/postgresql/data`），容器重启后数据确实会丢失。

## 工程建议

1. **始终使用全局单例模式初始化 Prisma Client**：在 `lib/prisma.ts` 中用 `globalThis` 缓存实例，避免开发环境连接耗尽。这是 Next.js + Prisma 的标准模式。
2. **迁移文件要提交到 Git**：`prisma/migrations/` 目录下的文件应该纳入版本控制，这样团队成员和 CI/CD 环境可以用 `npx prisma migrate deploy` 重放迁移。
3. **善用 Prisma Studio 调试数据**：`npx prisma studio` 可以在浏览器中查看、编辑数据库记录，比写 SQL 查询更高效，尤其适合开发阶段的数据验证。
4. **`@default(autoincrement())` vs `@default(cuid())`**：自增 ID 简单但可预测（安全风险），`cuid()` 生成的 ID 不可预测且适合分布式系统。生产环境推荐使用 `cuid()` 或 `uuid()`。

## 九、小结

```
本课核心要点：

1. Prisma 是 TypeScript 生态的 ORM，Schema 优先，类型安全
2. Docker 是运行 PostgreSQL 最简单的方式
3. prisma/schema.prisma 定义数据模型
4. npx prisma migrate dev 执行迁移
5. Prisma Client 提供类型安全的 CRUD 操作
6. 在 Next.js 中使用全局单例模式避免连接耗尽
```

下一课我们将学习更复杂的数据建模：关系、索引和约束。
