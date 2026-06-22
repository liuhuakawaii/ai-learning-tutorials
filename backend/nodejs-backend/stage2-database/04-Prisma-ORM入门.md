# 第四课：Prisma ORM 入门

## 场景引入

你已经能在 psql 里熟练地写 SQL 了，但在 Node.js 代码里直接写 SQL 字符串有几个大问题：字符串拼接容易被注入攻击，查询结果没有类型提示（全是 `any`），不同数据库的 SQL 语法还有差异。你想要一种方式，能用 TypeScript 代码操作数据库，有自动补全、有类型检查、还能防止 SQL 注入。这就是 ORM（对象关系映射）做的事情——它是代码和数据库之间的"翻译官"。Prisma 是 TypeScript 生态中最好的 ORM，自动生成类型安全的客户端，Schema 文件就是数据库文档。

## 学习目标

完成本课后，你将能够：

1. 理解什么是 ORM 以及为什么使用它
2. 了解 Prisma 的优势和核心组件
3. 安装和初始化 Prisma
4. 理解 Prisma Schema 文件的结构
5. 使用 prisma generate 生成类型安全的客户端
6. 配置 Prisma 连接 PostgreSQL

---

## 一、什么是 ORM

### 1.1 从 SQL 到代码

在上一课中，我们学习了 SQL。你可能已经发现，直接写 SQL 有几个问题：

```
直接写 SQL 的问题：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. 字符串拼接容易出错                                       │
│     const query = `SELECT * FROM users WHERE id = ${id}`    │
│     ↑ 如果 id 是用户输入，可能被 SQL 注入攻击！             │
│                                                             │
│  2. 没有类型检查                                             │
│     const user = await query('SELECT * FROM users')         │
│     // user 的类型是 any，编辑器无法提示属性                 │
│                                                             │
│  3. SQL 字符串没有语法高亮和自动补全                         │
│     // 写错了也发现不了，运行时才报错                        │
│                                                             │
│  4. 不同数据库的 SQL 语法有差异                              │
│     // 从 MySQL 迁移到 PostgreSQL 需要改 SQL                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 ORM 的定义

**ORM（Object-Relational Mapping，对象关系映射）** 是一种技术，它将数据库中的表映射为代码中的对象，让你可以用面向对象的方式操作数据库。

```
ORM 的角色：翻译官

  你（TypeScript 代码）                     数据库（PostgreSQL）
  ┌─────────────────────┐                  ┌─────────────────────┐
  │                     │                  │                     │
  │  prisma.user.find   │    ┌────────┐    │  SELECT * FROM     │
  │  Many({             │───→│  ORM   │───→│  users WHERE       │
  │    where: {         │    │(翻译官) │    │  status = 'active' │
  │      status: 'active│    └────────┘    │                     │
  │    }                │                  │                     │
  │  })                 │    ┌────────┐    │  { id: 1, ... }    │
  │                     │←───│  ORM   │←───│                     │
  │  // 结果是 User[]   │    │(翻译官) │    │                     │
  │                     │    └────────┘    │                     │
  └─────────────────────┘                  └─────────────────────┘

  你写 TypeScript                        ORM 翻译成 SQL          数据库执行
```

### 1.3 生活类比：翻译官

```
想象你去日本旅游，不会日语：

没有翻译官：
  你 → 比手画脚 → 日本人 → 猜你想表达什么 → 可能理解错误

有翻译官：
  你 → 用中文表达 → 翻译官 → 翻译成日语 → 日本人 → 正确理解

ORM 就是代码和数据库之间的翻译官：
  代码 → TypeScript 对象操作 → ORM → SQL 语句 → 数据库 → 正确执行
```

### 1.4 使用 ORM 的好处

```
┌─────────────────────────────────────────────────────────────┐
│                     ORM 的优势                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 类型安全                                                 │
│     编辑器能自动提示字段名，编译时检查类型错误                │
│                                                             │
│  ✅ 防止 SQL 注入                                            │
│     ORM 自动处理参数化查询，不用手动拼接字符串               │
│                                                             │
│  ✅ 代码更简洁                                               │
│     10 行 SQL → 3 行 ORM 代码                               │
│                                                             │
│  ✅ 自动处理关联查询                                         │
│     不用写复杂的 JOIN，用 include 一行搞定                   │
│                                                             │
│  ✅ 数据库无关                                               │
│     换数据库只需改配置，不用改业务代码                       │
│                                                             │
│  ✅ 迁移管理                                                 │
│     ORM 提供数据库迁移工具，版本控制数据库结构               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 直接 SQL vs ORM 代码对比

```typescript
// ========== 直接写 SQL ==========

// 查询已发布的文章及作者
const sqlQuery = `
  SELECT
    posts.id,
    posts.title,
    posts.content,
    posts.created_at,
    users.username AS author_name,
    users.avatar AS author_avatar
  FROM posts
  INNER JOIN users ON posts.author_id = users.id
  WHERE posts.status = $1
  ORDER BY posts.created_at DESC
  LIMIT $2 OFFSET $3
`;

const result = await pool.query(sqlQuery, ['PUBLISHED', 10, 0]);
const posts = result.rows;

// 更新文章
const updateQuery = `
  UPDATE posts
  SET title = $1, content = $2, updated_at = NOW()
  WHERE id = $3
  RETURNING *
`;
const updated = await pool.query(updateQuery, ['新标题', '新内容', 1]);


// ========== 使用 Prisma ORM ==========

// 查询已发布的文章及作者
const posts = await prisma.post.findMany({
  where: { status: 'PUBLISHED' },
  include: {
    author: {
      select: { username: true, avatar: true }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 0
});

// 更新文章
const updated = await prisma.post.update({
  where: { id: 1 },
  data: {
    title: '新标题',
    content: '新内容'
  }
});
```

---

## 二、Prisma 简介

### 2.1 为什么选择 Prisma

```
Node.js/TypeScript 生态的 ORM 对比：

┌──────────────┬────────────┬────────────┬────────────┐
│ 特性          │ Prisma     │ TypeORM    │ Sequelize  │
├──────────────┼────────────┼────────────┼────────────┤
│ TypeScript   │ ⭐⭐⭐      │ ⭐⭐        │ ⭐          │
│ 类型安全      │ 自动生成    │ 手动定义   │ 基本没有   │
│ 学习曲线      │ 低          │ 中等        │ 中等       │
│ Schema 定义  │ 专用语法    │ 装饰器      │ 代码定义   │
│ 查询性能      │ 优秀        │ 良好        │ 一般       │
│ 社区活跃度    │ 非常活跃    │ 活跃        │ 成熟       │
│ 文档质量      │ ⭐⭐⭐      │ ⭐⭐        │ ⭐⭐        │
│ 迁移工具      │ 内置且强大  │ 内置        │ 内置       │
│ 数据库支持    │ 多种        │ 多种        │ 多种       │
└──────────────┴────────────┴────────────┴────────────┘
```

### 2.2 选择 Prisma 的理由

```
为什么前端开发者应该选 Prisma：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. TypeScript 一等公民                                      │
│     - 自动生成类型，不用手写 interface                       │
│     - 编辑器自动补全，减少出错                               │
│                                                             │
│  2. Schema 即文档                                            │
│     - .prisma 文件清晰定义数据模型                           │
│     - 比 TypeORM 的装饰器更直观                              │
│                                                             │
│  3. Prisma Studio                                            │
│     - 可视化数据管理工具                                     │
│     - 像操作 Excel 一样操作数据库                            │
│                                                             │
│  4. 查询引擎优化                                             │
│     - 自动生成最优 SQL                                       │
│     - 解决 N+1 查询问题                                     │
│                                                             │
│  5. 生态完善                                                 │
│     - Prisma Accelerate（连接池、缓存）                      │
│     - Prisma Pulse（实时数据同步）                           │
│     - 丰富的社区插件                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、Prisma 三大组件

```
Prisma 的三大核心组件：

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. Prisma Schema（prisma/schema.prisma）                    │
│     ├── 定义数据模型（表结构）                               │
│     ├── 配置数据库连接                                       │
│     └── 指定生成器                                           │
│                                                             │
│  2. Prisma Client（@prisma/client）                          │
│     ├── 自动生成的类型安全客户端                             │
│     ├── 用于在代码中查询数据库                               │
│     └── 根据 Schema 自动生成                                 │
│                                                             │
│  3. Prisma Migrate（prisma migrate）                         │
│     ├── 数据库迁移工具                                       │
│     ├── 将 Schema 变更应用到数据库                           │
│     └── 版本控制数据库结构                                   │
│                                                             │
│  额外工具：                                                  │
│  4. Prisma Studio（prisma studio）                           │
│     └── 可视化数据管理界面                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

工作流程：
  Schema 定义 → generate 生成 Client → migrate 同步到数据库
       ↑                                        │
       └────────── 修改 Schema ←────────────────┘
```

---

## 四、安装与初始化

### 4.1 项目初始化

```bash
# 创建项目目录
mkdir blog-api
cd blog-api

# 初始化 Node.js 项目
npm init -y

# 安装 TypeScript
npm install -D typescript @types/node ts-node

# 初始化 TypeScript 配置
npx tsc --init
```

### 4.2 安装 Prisma

```bash
# 安装 Prisma CLI（开发依赖）
npm install -D prisma

# 安装 Prisma Client（运行时依赖）
npm install @prisma/client

# 查看 Prisma 版本
npx prisma --version
```

### 4.3 初始化 Prisma

```bash
# 初始化 Prisma（会创建 prisma 目录和 .env 文件）
npx prisma init
```

执行后会生成以下文件：

```
blog-api/
├── node_modules/
├── prisma/
│   └── schema.prisma    ← Prisma Schema 文件
├── .env                 ← 环境变量（数据库连接字符串）
├── package.json
└── tsconfig.json
```

### 4.4 生成的文件内容

**prisma/schema.prisma：**

```prisma
// 这是 Prisma Schema 文件
// 文档：https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**.env：**

```env
# 环境变量文件
# 文档：https://pris.ly/d/prisma-schema

DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
```

---

## 五、Prisma Schema 详解

### 5.1 Schema 文件结构

```prisma
// ========================================
// prisma/schema.prisma
// ========================================

// 1. Generator（生成器）
// 指定要生成的客户端代码
generator client {
  provider = "prisma-client-js"  // 生成 JavaScript 客户端
  // previewFeatures = ["jsonProtocol"]  // 可选的预览功能
}

// 2. Datasource（数据源）
// 配置数据库连接
datasource db {
  provider = "postgresql"        // 数据库类型
  url      = env("DATABASE_URL") // 从环境变量读取连接字符串
}

// 3. Model（模型）
// 定义数据表结构
model User {
  // 字段定义
}
```

### 5.2 Generator 配置

```prisma
generator client {
  provider = "prisma-client-js"
}

// 其他可选的 generator：
// - prisma-client-js：默认，生成 JS/TS 客户端
// - prisma-client-py：Python 客户端（实验性）
// - zod：生成 Zod 验证 schema
// - prisma-json-types-generator：JSON 字段类型

// 使用多个 generator
generator client {
  provider = "prisma-client-js"
}

generator zod {
  provider = "prisma-zod-generator"
}
```

### 5.3 Datasource 配置

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // 可选：直接指定连接参数
  // url      = "postgresql://user:pass@localhost:5432/db"
}

// 支持的数据库 provider：
// - postgresql
// - mysql
// - sqlite
// - sqlserver
// - mongodb
// - cockroachdb
```

### 5.4 Model 定义语法

```prisma
// 模型定义示例
model User {
  // 字段名  类型      修饰符
  id        Int       @id @default(autoincrement())
  email     String    @unique
  name      String?
  role      Role      @default(USER)
  posts     Post[]    // 关系字段
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

// 字段类型：
// Int        - 整数
// String     - 字符串
// Boolean    - 布尔值
// DateTime   - 日期时间
// Float      - 浮点数
// Decimal    - 精确小数
// BigInt     - 大整数
// Json       - JSON 数据
// Bytes      - 二进制数据
// Enum       - 枚举类型

// 字段修饰符：
// @id           - 主键
// @default()    - 默认值
// @unique       - 唯一约束
// @map()        - 映射到数据库列名
// @relation()   - 定义关系
// @updatedAt    - 自动更新时间
// @db.Type      - 指定数据库类型
```

### 5.5 完整的博客 Schema

```prisma
// ========================================
// prisma/schema.prisma
// 博客平台数据模型
// ========================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 枚举类型
enum Role {
  USER
  ADMIN
  MODERATOR
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

// 用户模型
model User {
  id        Int         @id @default(autoincrement())
  email     String      @unique
  username  String      @unique
  password  String
  avatar    String?
  bio       String?     @db.Text
  role      Role        @default(USER)
  posts     Post[]      // 一对多：一个用户有多篇文章
  comments  Comment[]   // 一对多：一个用户有多条评论
  profile   Profile?    // 一对一：一个用户有一个个人资料
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@map("users")  // 映射到数据库表名
}

// 个人资料模型（一对一）
model Profile {
  id     Int     @id @default(autoincrement())
  userId Int     @unique
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  phone  String?
  website String?
  github String?

  @@map("profiles")
}

// 文章模型
model Post {
  id          Int         @id @default(autoincrement())
  title       String      @db.VarChar(200)
  content     String      @db.Text
  slug        String      @unique
  status      PostStatus  @default(DRAFT)
  viewCount   Int         @default(0)
  authorId    Int
  author      User        @relation(fields: [authorId], references: [id], onDelete: Cascade)
  categoryId  Int?
  category    Category?   @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  tags        Tag[]       // 多对多
  comments    Comment[]   // 一对多
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  publishedAt DateTime?

  @@index([authorId])   // 索引：加速按作者查询
  @@index([categoryId]) // 索引：加速按分类查询
  @@index([status])     // 索引：加速按状态查询
  @@map("posts")
}

// 分类模型
model Category {
  id          Int     @id @default(autoincrement())
  name        String  @unique
  slug        String  @unique
  description String? @db.Text
  posts       Post[]  // 一对多

  @@map("categories")
}

// 标签模型（多对多）
model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  slug  String @unique
  posts Post[] // 多对多

  @@map("tags")
}

// 评论模型（自引用）
model Comment {
  id        Int       @id @default(autoincrement())
  content   String    @db.Text
  authorId  Int
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  postId    Int
  post      Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  parentId  Int?
  parent    Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[] @relation("CommentReplies")  // 自引用：回复
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([postId])   // 索引：加速按文章查询
  @@index([authorId]) // 索引：加速按作者查询
  @@map("comments")
}
```

### 5.6 Schema 语法要点

```
模型定义要点：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  字段类型映射                                                │
│  ├── Int        → INTEGER                                   │
│  ├── String     → VARCHAR / TEXT                            │
│  ├── Boolean    → BOOLEAN                                   │
│  ├── DateTime   → TIMESTAMP                                 │
│  ├── Float      → DOUBLE PRECISION                          │
│  ├── Decimal    → DECIMAL                                   │
│  └── Json       → JSONB                                     │
│                                                             │
│  数据库特定类型（@db.Type）                                  │
│  ├── @db.Text       → TEXT（不限长度）                       │
│  ├── @db.VarChar(n) → VARCHAR(n)（指定长度）                │
│  └── @db.Integer    → INTEGER                               │
│                                                             │
│  关系定义                                                    │
│  ├── 一对一：@relation(fields: [外键], references: [主键])  │
│  ├── 一对多：模型[] + @relation                              │
│  └── 多对多：隐式（Prisma 自动创建中间表）                   │
│                                                             │
│  @@map("表名")     → 映射到数据库中的表名                   │
│  @map("列名")      → 映射到数据库中的列名                   │
│  @@index([字段])   → 创建索引                               │
│  @@unique([字段])  → 创建联合唯一约束                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、prisma generate 的作用

### 6.1 生成客户端

```bash
# 根据 Schema 生成 Prisma Client
npx prisma generate
```

执行后会生成 `node_modules/.prisma/client` 目录，包含类型安全的客户端代码。

### 6.2 生成的类型

```typescript
// Prisma 会根据 Schema 自动生成 TypeScript 类型

import { PrismaClient, User, Post, Role, PostStatus } from '@prisma/client';

// 自动生成的类型包括：
// - 模型类型：User, Post, Category, Tag, Comment
// - 枚举类型：Role, PostStatus
// - 查询参数类型：UserWhereInput, PostCreateInput, etc.
// - 返回类型：根据查询动态推导

// 使用示例
const user: User = {
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  password: 'hashed_password',
  avatar: null,        // 可选字段可以是 null
  bio: null,
  role: Role.USER,     // 使用枚举
  createdAt: new Date(),
  updatedAt: new Date()
};

// 查询参数类型
const where: UserWhereInput = {
  email: { contains: '@example.com' },
  role: Role.ADMIN
};
```

### 6.3 类型推导的魔力

```typescript
import { Prisma } from '@prisma/client';

// Prisma 可以根据查询动态推导返回类型

// 查询1：只查询用户
const user = await prisma.user.findUnique({
  where: { id: 1 }
});
// user 的类型是：User | null

// 查询2：查询用户及其文章
const userWithPosts = await prisma.user.findUnique({
  where: { id: 1 },
  include: { posts: true }
});
// userWithPosts 的类型是：(User & { posts: Post[] }) | null

// 查询3：只选择特定字段
const userBasic = await prisma.user.findUnique({
  where: { id: 1 },
  select: { id: true, username: true, email: true }
});
// userBasic 的类型是：{ id: number; username: string; email: string } | null

// 使用 Prisma 提供的工具类型
type UserWithPosts = Prisma.UserGetPayload<{
  include: { posts: true }
}>;
// UserWithPosts = User & { posts: Post[] }
```

---

## 七、Prisma Client 初始化

### 7.1 基本初始化

```typescript
// src/prisma/client.ts

import { PrismaClient } from '@prisma/client';

// 创建 Prisma Client 实例
const prisma = new PrismaClient();

// 测试连接
async function main() {
  try {
    // 执行一个简单的查询来测试连接
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('数据库连接成功:', result);
  } catch (error) {
    console.error('数据库连接失败:', error);
  } finally {
    // 关闭连接
    await prisma.$disconnect();
  }
}

main();
```

### 7.2 为什么需要单例模式

```
问题：每次 new PrismaClient() 会创建新的数据库连接池

❌ 错误做法：
// user.service.ts
const prisma = new PrismaClient();  // 连接池 1

// post.service.ts
const prisma = new PrismaClient();  // 连接池 2

// comment.service.ts
const prisma = new PrismaClient();  // 连接池 3

// 结果：3 个连接池，浪费资源，可能超出数据库连接限制

✅ 正确做法：单例模式
// prisma/client.ts
const prisma = new PrismaClient();  // 只创建一个实例
export default prisma;

// 所有文件都导入同一个实例
// user.service.ts
import prisma from './prisma/client';

// post.service.ts
import prisma from './prisma/client';
```

### 7.3 单例模式实现

```typescript
// src/prisma/client.ts

import { PrismaClient } from '@prisma/client';

// PrismaClient 配置选项
const prismaClientOptions: PrismaClientOptions = {
  log: [
    { level: 'query', emit: 'event' },    // 记录 SQL 查询
    { level: 'error', emit: 'stdout' },   // 错误输出到控制台
    { level: 'info', emit: 'stdout' },    // 信息输出到控制台
    { level: 'warn', emit: 'stdout' },    // 警告输出到控制台
  ],
};

// 创建 Prisma Client 实例
const prisma = new PrismaClient(prismaClientOptions);

// 开发环境：记录 SQL 查询
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    console.log('Query: ' + e.query);
    console.log('Duration: ' + e.duration + 'ms');
  });
}

// 优雅关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
export { PrismaClient };
```

### 7.4 在 Express 中使用

```typescript
// src/index.ts

import express from 'express';
import prisma from './prisma/client';

const app = express();
const PORT = 3000;

app.use(express.json());

// 测试数据库连接的路由
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

// 获取所有用户
app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

---

## 八、Prisma Studio 使用

### 8.1 启动 Prisma Studio

```bash
# 启动 Prisma Studio（可视化数据管理工具）
npx prisma studio
```

启动后会自动打开浏览器，地址是 `http://localhost:5555`。

### 8.2 Prisma Studio 功能

```
Prisma Studio 界面：
┌─────────────────────────────────────────────────────────────┐
│  Prisma Studio                                    [刷新]    │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  模型列表    │              数据表格                         │
│              │                                              │
│  📄 User     │  ┌────┬──────────────┬──────────────┐       │
│  📄 Post     │  │ id │ username     │ email        │       │
│  📄 Category │  ├────┼──────────────┼──────────────┤       │
│  📄 Tag      │  │ 1  │ admin        │ admin@...    │       │
│  📄 Comment  │  │ 2  │ zhangsan     │ zhang@...    │       │
│              │  │ 3  │ lisi         │ lisi@...     │       │
│              │  └────┴──────────────┴──────────────┘       │
│              │                                              │
│              │  [添加记录] [删除记录] [筛选] [排序]          │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

### 8.3 Prisma Studio 操作

```
常用操作：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  查看数据                                                    │
│  ├── 点击左侧模型名查看对应表数据                            │
│  ├── 点击列头排序                                           │
│  └── 使用筛选器过滤数据                                     │
│                                                             │
│  添加记录                                                    │
│  ├── 点击 "Add Record" 按钮                                 │
│  ├── 填写字段值                                             │
│  └── 点击 "Save" 保存                                       │
│                                                             │
│  编辑记录                                                    │
│  ├── 点击单元格直接编辑                                     │
│  └── 修改后自动保存                                         │
│                                                             │
│  删除记录                                                    │
│  ├── 选中记录                                               │
│  └── 点击 "Delete" 按钮                                     │
│                                                             │
│  查看关联                                                    │
│  ├── 点击关系字段（如 author）                              │
│  └── 跳转到关联记录                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 九、实操：初始化 Prisma 并连接 PostgreSQL

### 9.1 完整操作步骤

```bash
# ========================================
# 步骤 1：创建项目
# ========================================
mkdir blog-api
cd blog-api

# 初始化项目
npm init -y

# 安装依赖
npm install express @prisma/client
npm install -D prisma typescript @types/node @types/express ts-node

# 初始化 TypeScript
npx tsc --init

# ========================================
# 步骤 2：初始化 Prisma
# ========================================
npx prisma init

# ========================================
# 步骤 3：配置数据库连接
# ========================================
```

**修改 .env 文件：**

```env
# .env
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/blog_db?schema=public"
```

**修改 prisma/schema.prisma：**

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 简单的 User 模型用于测试
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
```

```bash
# ========================================
# 步骤 4：生成 Prisma Client
# ========================================
npx prisma generate

# ========================================
# 步骤 5：创建数据库迁移
# ========================================
npx prisma migrate dev --name init

# ========================================
# 步骤 6：验证
# ========================================
# 启动 Prisma Studio 查看数据
npx prisma studio
```

### 9.2 测试代码

```typescript
// src/test-prisma.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始测试 Prisma...\n');

  // 1. 创建用户
  console.log('1. 创建用户');
  const user1 = await prisma.user.create({
    data: {
      email: 'zhangsan@example.com',
      username: 'zhangsan',
      password: 'hashed_password_123'
    }
  });
  console.log('创建的用户:', user1);

  const user2 = await prisma.user.create({
    data: {
      email: 'lisi@example.com',
      username: 'lisi',
      password: 'hashed_password_456'
    }
  });
  console.log('创建的用户:', user2);

  // 2. 查询所有用户
  console.log('\n2. 查询所有用户');
  const allUsers = await prisma.user.findMany();
  console.log('所有用户:', allUsers);

  // 3. 按条件查询
  console.log('\n3. 按邮箱查询');
  const userByEmail = await prisma.user.findUnique({
    where: { email: 'zhangsan@example.com' }
  });
  console.log('按邮箱查询:', userByEmail);

  // 4. 更新用户
  console.log('\n4. 更新用户');
  const updatedUser = await prisma.user.update({
    where: { id: user1.id },
    data: { username: 'zhangsan_updated' }
  });
  console.log('更新后的用户:', updatedUser);

  // 5. 删除用户
  console.log('\n5. 删除用户');
  await prisma.user.delete({
    where: { id: user2.id }
  });
  console.log('已删除用户 lisi');

  // 6. 验证删除
  console.log('\n6. 验证删除');
  const remainingUsers = await prisma.user.findMany();
  console.log('剩余用户:', remainingUsers);
}

main()
  .catch((error) => {
    console.error('错误:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

运行测试：

```bash
# 使用 ts-node 运行
npx ts-node src/test-prisma.ts

# 预期输出：
# 开始测试 Prisma...
#
# 1. 创建用户
# 创建的用户: { id: 1, email: 'zhangsan@example.com', username: 'zhangsan', ... }
# 创建的用户: { id: 2, email: 'lisi@example.com', username: 'lisi', ... }
#
# 2. 查询所有用户
# 所有用户: [{ id: 1, ... }, { id: 2, ... }]
#
# 3. 按邮箱查询
# 按邮箱查询: { id: 1, email: 'zhangsan@example.com', ... }
#
# 4. 更新用户
# 更新后的用户: { id: 1, username: 'zhangsan_updated', ... }
#
# 5. 删除用户
# 已删除用户 lisi
#
# 6. 验证删除
# 剩余用户: [{ id: 1, username: 'zhangsan_updated', ... }]
```

---

## 十、常用 Prisma CLI 命令

```
Prisma CLI 命令速查表：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  prisma init                                                │
│  └── 初始化 Prisma，生成 schema.prisma 和 .env              │
│                                                             │
│  prisma generate                                            │
│  └── 根据 Schema 生成 Prisma Client                         │
│                                                             │
│  prisma migrate dev --name <name>                           │
│  └── 创建并应用数据库迁移（开发环境）                        │
│                                                             │
│  prisma migrate deploy                                      │
│  └── 应用待执行的迁移（生产环境）                            │
│                                                             │
│  prisma migrate reset                                       │
│  └── 重置数据库（删除所有数据，重新应用迁移）                │
│                                                             │
│  prisma db push                                             │
│  └── 直接同步 Schema 到数据库（不创建迁移文件）              │
│                                                             │
│  prisma studio                                              │
│  └── 打开 Prisma Studio 可视化工具                          │
│                                                             │
│  prisma db seed                                             │
│  └── 执行种子脚本（填充测试数据）                           │
│                                                             │
│  prisma format                                              │
│  └── 格式化 Schema 文件                                     │
│                                                             │
│  prisma validate                                            │
│  └── 验证 Schema 文件                                       │
│                                                             │
│  prisma introspect                                          │
│  └── 从现有数据库生成 Schema（逆向工程）                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 常见误区

1. **每次使用都 new PrismaClient()**：每个 PrismaClient 实例都会创建一个数据库连接池，多次实例化会耗尽连接数。应该用单例模式，整个应用只创建一个实例。
2. **把 .env 文件提交到 Git**：`.env` 包含数据库密码等敏感信息，应该加入 `.gitignore`。提交模板文件 `.env.example`（不含真实密码）供团队参考。
3. **修改 Schema 后忘记执行 prisma generate**：修改 `schema.prisma` 后，需要执行 `npx prisma generate` 重新生成 Prisma Client，否则新的字段和模型在代码中不可用。
4. **混淆 prisma migrate dev 和 prisma db push**：`migrate dev` 创建可版本控制的迁移文件，适合生产环境；`db push` 直接同步 Schema 到数据库但不生成迁移文件，适合快速原型开发。

## 工程建议

1. **Schema 文件即文档**：在每个 model 和字段上方写注释，说明业务含义。Prisma Schema 比 SQL DDL 更易读，是团队理解数据模型的最佳参考。
2. **用 Prisma Studio 快速查看和编辑数据**：执行 `npx prisma studio` 打开可视化界面，像操作 Excel 一样操作数据库，比写 SQL 更直观。
3. **开发环境开启查询日志**：在 PrismaClient 配置中设置 `log: ['query']`，可以看到 Prisma 生成的 SQL，帮你理解 ORM 的工作方式和排查性能问题。
4. **先用简单模型跑通整个流程**：不要一上来就设计完整的博客 Schema。先用一个 User 模型完成 init → generate → migrate → 查询的完整流程，再逐步扩展。

## 十一、小结

```
本课要点回顾：
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. ORM 是代码和数据库之间的"翻译官"                     │
│     - 将表映射为对象                                    │
│     - 类型安全、防止注入、代码简洁                       │
│                                                         │
│  2. Prisma 是 TypeScript 生态最好的 ORM                 │
│     - 自动生成类型                                      │
│     - Schema 即文档                                     │
│     - Prisma Studio 可视化管理                          │
│                                                         │
│  3. Prisma 三大组件                                      │
│     - Schema：定义数据模型                              │
│     - Client：生成的类型安全客户端                      │
│     - Migrate：数据库迁移工具                           │
│                                                         │
│  4. 初始化流程                                           │
│     npm install prisma @prisma/client                   │
│     npx prisma init                                     │
│     配置 .env 的 DATABASE_URL                           │
│     编写 schema.prisma                                  │
│     npx prisma generate                                 │
│                                                         │
│  5. Prisma Client 应该使用单例模式                      │
│     - 避免创建多个连接池                                │
│     - 统一管理连接生命周期                              │
│                                                         │
│  6. prisma migrate dev 用于创建迁移                     │
│     - 将 Schema 变更同步到数据库                        │
│     - 生成可版本控制的迁移文件                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 下一课预告

下一课我们将学习 **Schema 设计与迁移**——为博客平台设计完整的数据模型，包括用户、文章、分类、标签、评论，并使用 Prisma Migrate 将模型同步到数据库。

---

> **学习建议：** 建议动手完成本课的实操部分，先用简单的 User 模型跑通整个流程，再在下一课扩展完整的博客 Schema。
