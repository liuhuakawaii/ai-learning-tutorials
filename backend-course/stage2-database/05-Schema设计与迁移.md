# 第五课：Schema 设计与迁移

> **课程定位：** 第二阶段 · 数据库 · 第 5 课时
> **前置知识：** Prisma ORM 入门（第四课）
> **预计时长：** 90 分钟

---

## 学习目标

完成本课后，你将能够：

1. 理解数据建模的概念，从需求推导表结构
2. 设计完整的博客平台 Schema
3. 掌握 Prisma 中的关系类型定义（一对一、一对多、多对多）
4. 使用 Prisma Migrate 创建和管理数据库迁移
5. 使用 Prisma Studio 查看和编辑数据

---

## 一、数据建模的概念

### 1.1 从需求到表结构

数据建模是将业务需求转化为数据库表结构的过程。

```
需求分析 → 概念设计 → 逻辑设计 → 物理实现

  博客平台需求                数据模型
  ┌──────────────┐           ┌──────────────┐
  │ 用户注册登录  │──────────→│ User 表      │
  │ 发布文章     │──────────→│ Post 表      │
  │ 文章分类     │──────────→│ Category 表  │
  │ 文章标签     │──────────→│ Tag 表       │
  │ 评论功能     │──────────→│ Comment 表   │
  └──────────────┘           └──────────────┘
```

### 1.2 识别实体和关系

```
实体（Entity）= 需要存储的"东西"
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  用户（User）      → 谁在使用系统？                          │
│  文章（Post）      → 用户创建的内容                          │
│  分类（Category）  → 文章的类别                              │
│  标签（Tag）       → 文章的关键词                            │
│  评论（Comment）   → 用户对文章的反馈                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

关系（Relationship）= 实体之间的联系
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  用户 ──写──→ 文章          （一对多）                       │
│  分类 ──包含──→ 文章        （一对多）                       │
│  文章 ──有──→ 标签          （多对多）                       │
│  文章 ──有──→ 评论          （一对多）                       │
│  用户 ──写──→ 评论          （一对多）                       │
│  评论 ──回复──→ 评论        （自引用，一对多）               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 ER 图（实体关系图）

```
博客平台 ER 图：

┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │       │    Post     │       │  Category   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──┐    │ id (PK)     │       │ id (PK)     │
│ email       │  │    │ title       │    ┌──│ name        │
│ username    │  │    │ content     │    │  │ slug        │
│ password    │  │    │ slug        │    │  │ description │
│ avatar      │  │    │ status      │    │  └─────────────┘
│ bio         │  ├───→│ viewCount   │←───┘
│ role        │  │    │ authorId(FK)│
│ createdAt   │  │    │ categoryId  │
│ updatedAt   │  │    │ createdAt   │
└─────────────┘  │    │ updatedAt   │
                 │    │ publishedAt │
                 │    └─────────────┘
                 │            │
                 │            │    ┌─────────────┐
                 │            │    │     Tag     │
                 │            │    ├─────────────┤
                 │            ├───→│ id (PK)     │
                 │            │    │ name        │
                 │            │    │ slug        │
                 │            │    └─────────────┘
                 │            │
                 │            │    ┌─────────────┐
                 │            │    │  Comment    │
                 │            │    ├─────────────┤
                 │            └───→│ id (PK)     │
                 │                 │ content     │
                 └────────────────→│ authorId(FK)│
                                   │ postId (FK) │
                                   │ parentId(FK)│ ← 自引用
                                   │ createdAt   │
                                   │ updatedAt   │
                                   └─────────────┘
```

---

## 二、博客平台 Schema 设计

### 2.1 User 模型

```prisma
// 用户模型

// 角色枚举
enum Role {
  USER       // 普通用户
  ADMIN      // 管理员
  MODERATOR  // 版主
}

model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique                     // 邮箱，唯一
  username  String    @unique                     // 用户名，唯一
  password  String                                // 密码（哈希值）
  avatar    String?                               // 头像 URL，可选
  bio       String?   @db.Text                    // 个人简介，可选
  role      Role      @default(USER)              // 角色，默认普通用户

  // 关系字段
  profile   Profile?                              // 一对一：个人资料
  posts     Post[]                                 // 一对多：文章
  comments  Comment[]                              // 一对多：评论

  // 时间戳
  createdAt DateTime  @default(now())             // 创建时间
  updatedAt DateTime  @updatedAt                  // 更新时间（自动更新）

  @@map("users")  // 映射到数据库表名
}
```

### 2.2 Profile 模型（一对一）

```prisma
// 个人资料模型（与 User 一对一）

model Profile {
  id      Int     @id @default(autoincrement())
  userId  Int     @unique              // 外键，同时是唯一约束（实现一对一）
  phone   String?                      // 手机号
  website String?                      // 个人网站
  github  String?                      // GitHub 地址
  twitter String?                      // Twitter 地址

  // 关系定义
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("profiles")
}
```

### 2.3 Post 模型

```prisma
// 文章状态枚举
enum PostStatus {
  DRAFT      // 草稿
  PUBLISHED  // 已发布
  ARCHIVED   // 已归档
}

// 文章模型
model Post {
  id          Int         @id @default(autoincrement())
  title       String      @db.VarChar(200)         // 标题，最大200字符
  content     String      @db.Text                 // 内容，不限长度
  slug        String      @unique                  // URL 友好的标识符
  status      PostStatus  @default(DRAFT)          // 状态，默认草稿
  viewCount   Int         @default(0)              // 浏览次数

  // 外键
  authorId    Int                                  // 作者 ID
  categoryId  Int?                                 // 分类 ID，可选

  // 关系
  author      User        @relation(fields: [authorId], references: [id], onDelete: Cascade)
  category    Category?   @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  tags        Tag[]                                // 多对多：标签
  comments    Comment[]                            // 一对多：评论

  // 时间戳
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  publishedAt DateTime?                            // 发布时间，可选

  // 索引
  @@index([authorId])    // 加速按作者查询
  @@index([categoryId])  // 加速按分类查询
  @@index([status])      // 加速按状态查询
  @@index([createdAt])   // 加速按时间排序
  @@map("posts")
}
```

### 2.4 Category 模型

```prisma
// 分类模型
model Category {
  id          Int     @id @default(autoincrement())
  name        String  @unique                     // 分类名称
  slug        String  @unique                     // URL 友好的标识符
  description String? @db.Text                    // 描述，可选

  // 关系
  posts       Post[]                              // 一对多：文章

  @@map("categories")
}
```

### 2.5 Tag 模型

```prisma
// 标签模型
model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique                            // 标签名称
  slug  String @unique                            // URL 友好的标识符

  // 关系
  posts Post[]                                    // 多对多：文章

  @@map("tags")
}
```

### 2.6 Comment 模型（自引用）

```prisma
// 评论模型
model Comment {
  id        Int       @id @default(autoincrement())
  content   String    @db.Text                   // 评论内容

  // 外键
  authorId  Int                                  // 评论作者 ID
  postId    Int                                  // 所属文章 ID
  parentId  Int?                                 // 父评论 ID（用于回复）

  // 关系
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  post      Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  parent    Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[] @relation("CommentReplies")  // 子评论（回复）

  // 时间戳
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // 索引
  @@index([postId])    // 加速按文章查询
  @@index([authorId])  // 加速按作者查询
  @@index([parentId])  // 加速按父评论查询
  @@map("comments")
}
```

---

## 三、关系类型详解

### 3.1 一对一关系

```
一对一：一个用户对应一个个人资料

实现方式：外键加 @unique 约束

User 表                    Profile 表
┌────┬──────────┐         ┌────┬─────────┬────────┐
│ id │ username │         │ id │ userId  │ phone  │
├────┼──────────┤         ├────┼─────────┼────────┤
│ 1  │ zhangsan │←───────→│ 1  │ 1 (UK)  │ 138... │
│ 2  │ lisi     │←───────→│ 2  │ 2 (UK)  │ 139... │
└────┴──────────┘         └────┴─────────┴────────┘
                                    ↑
                              unique 约束
                         （一个用户只能有一个资料）
```

```prisma
// Prisma 中定义一对一关系

model User {
  id      Int      @id @default(autoincrement())
  // ... 其他字段
  profile Profile? // 可选关系（用户可能没有资料）
}

model Profile {
  id     Int  @id @default(autoincrement())
  userId Int  @unique  // 外键 + 唯一约束 = 一对一
  user   User @relation(fields: [userId], references: [id])
}
```

### 3.2 一对多关系

```
一对多：一个用户有多篇文章

User 表                    Post 表
┌────┬──────────┐         ┌────┬──────────┬─────────┐
│ id │ username │         │ id │ title    │ authorId│
├────┼──────────┤         ├────┼──────────┼─────────┤
│ 1  │ zhangsan │←─┬─────→│ 1  │ TS入门   │ 1       │
│ 2  │ lisi     │  │      │ 2  │ Node教程  │ 1       │
└────┴──────────┘  │      │ 3  │ React    │ 2       │
                   │      └────┴──────────┴─────────┘
                   │
                   └── 一个用户可以有多篇文章
                       一篇文章只能有一个作者
```

```prisma
// Prisma 中定义一对多关系

model User {
  id    Int    @id @default(autoincrement())
  // ... 其他字段
  posts Post[] // "多"的一方用数组表示
}

model Post {
  id       Int  @id @default(autoincrement())
  authorId Int  // 外键在"多"的一方
  author   User @relation(fields: [authorId], references: [id])
}
```

### 3.3 多对多关系

```
多对多：一篇文章有多个标签，一个标签属于多篇文章

Post 表              PostTag（中间表）         Tag 表
┌────┐              ┌─────────┬────────┐     ┌────┐
│ id │              │ postId  │ tagId  │     │ id │
├────┤              ├─────────┼────────┤     ├────┤
│ 1  │─────────────→│ 1       │ 1      │←────│ 1  │
│ 2  │────────┬────→│ 1       │ 2      │     │ 2  │
└────┘        │     │ 2       │ 1      │     │ 3  │
              │     │ 2       │ 3      │     └────┘
              │     └─────────┴────────┘
              │
              └── 多对多需要中间表连接
```

```prisma
// Prisma 中定义多对多关系（隐式中间表）

model Post {
  id   Int   @id @default(autoincrement())
  // ... 其他字段
  tags Tag[] // 多对多
}

model Tag {
  id    Int    @id @default(autoincrement())
  // ... 其他字段
  posts Post[] // 多对多
}

// Prisma 会自动创建中间表 _PostToTag
// 包含 A 和 B 两个字段，分别是两个表的外键
```

### 3.4 自引用关系

```
自引用：评论可以回复其他评论

Comment 表
┌────┬────────────┬──────────┐
│ id │ content    │ parentId │
├────┼────────────┼──────────┤
│ 1  │ 好文！     │ NULL     │ ← 顶级评论
│ 2  │ 收藏了     │ NULL     │ ← 顶级评论
│ 3  │ 能详细讲吗？│ NULL     │ ← 顶级评论
│ 4  │ 好的，后续写│ 3        │ ← 回复评论3
│ 5  │ 同问       │ 3        │ ← 回复评论3
│ 6  │ 谢谢回复   │ 4        │ ← 回复评论4
└────┴────────────┴──────────┘

评论关系树：
  评论1: 好文！
  评论2: 收藏了
  评论3: 能详细讲吗？
    └── 评论4: 好的，后续写
        └── 评论6: 谢谢回复
    └── 评论5: 同问
```

```prisma
// Prisma 中定义自引用关系

model Comment {
  id       Int       @id @default(autoincrement())
  content  String    @db.Text
  parentId Int?      // 父评论 ID，NULL 表示顶级评论

  // 自引用关系需要命名
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies  Comment[] @relation("CommentReplies")
}
```

---

## 四、字段属性详解

### 4.1 常用字段属性

```prisma
model Example {
  // @id：主键
  id Int @id

  // @default()：默认值
  status String @default("DRAFT")
  count  Int    @default(0)
  createdAt DateTime @default(now())  // 默认当前时间

  // @unique：唯一约束
  email String @unique

  // @relation()：关系定义
  author   User @relation(fields: [authorId], references: [id])
  authorId Int

  // @map()：映射到不同的列名
  firstName String @map("first_name")  // 数据库中是 first_name

  // @updatedAt：自动更新时间
  updatedAt DateTime @updatedAt

  // @db.Type：指定数据库类型
  content String @db.Text           // TEXT 类型
  title   String @db.VarChar(200)   // VARCHAR(200)
  price   Decimal @db.Decimal(10,2) // DECIMAL(10,2)
}
```

### 4.2 @@ 模型级属性

```prisma
model Post {
  id Int @id @default(autoincrement())
  // ... 字段定义

  // @@map()：映射到不同的表名
  @@map("posts")

  // @@index()：创建索引
  @@index([authorId])
  @@index([categoryId, status])  // 复合索引

  // @@unique()：复合唯一约束
  @@unique([authorId, slug])  // 同一作者的文章 slug 不能重复

  // @@id()：复合主键
  // @@id([postId, tagId])
}
```

### 4.3 onDelete 级联行为

```prisma
// 当关联记录被删除时的行为

model Post {
  authorId Int
  author   User @relation(
    fields: [authorId],
    references: [id],
    onDelete: Cascade  // 删除用户时，同时删除其所有文章
  )

  categoryId Int?
  category   Category? @relation(
    fields: [categoryId],
    references: [id],
    onDelete: SetNull  // 删除分类时，文章的分类设为 NULL
  )
}

// 可选的 onDelete 行为：
// Cascade    - 级联删除（删除关联记录）
// SetNull    - 设为 NULL（外键必须可选）
// Restrict   - 限制删除（如果有引用，不允许删除）
// NoAction   - 无操作（类似 Restrict）
// SetDefault - 设为默认值
```

---

## 五、完整 Schema 代码

```prisma
// ========================================
// prisma/schema.prisma
// 博客平台完整数据模型
// ========================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== 枚举类型 ====================

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

// ==================== 用户相关 ====================

model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  username  String    @unique
  password  String
  avatar    String?
  bio       String?   @db.Text
  role      Role      @default(USER)

  profile   Profile?
  posts     Post[]
  comments  Comment[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@map("users")
}

model Profile {
  id      Int     @id @default(autoincrement())
  userId  Int     @unique
  phone   String?
  website String?
  github  String?
  twitter String?

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("profiles")
}

// ==================== 文章相关 ====================

model Post {
  id          Int         @id @default(autoincrement())
  title       String      @db.VarChar(200)
  content     String      @db.Text
  slug        String      @unique
  status      PostStatus  @default(DRAFT)
  viewCount   Int         @default(0)

  authorId    Int
  categoryId  Int?

  author      User        @relation(fields: [authorId], references: [id], onDelete: Cascade)
  category    Category?   @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  tags        Tag[]
  comments    Comment[]

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  publishedAt DateTime?

  @@index([authorId])
  @@index([categoryId])
  @@index([status])
  @@index([createdAt])
  @@map("posts")
}

model Category {
  id          Int     @id @default(autoincrement())
  name        String  @unique
  slug        String  @unique
  description String? @db.Text

  posts       Post[]

  @@map("categories")
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String @unique
  slug  String @unique

  posts Post[]

  @@map("tags")
}

// ==================== 评论相关 ====================

model Comment {
  id        Int       @id @default(autoincrement())
  content   String    @db.Text

  authorId  Int
  postId    Int
  parentId  Int?

  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  post      Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  parent    Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[] @relation("CommentReplies")

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([postId])
  @@index([authorId])
  @@index([parentId])
  @@map("comments")
}
```

---

## 六、数据库迁移

### 6.1 什么是迁移

```
数据库迁移（Migration）= 数据库结构的版本控制

就像 Git 管理代码版本一样，迁移管理数据库结构的变更：

版本历史：
  v1 - 初始创建（users, posts, categories, tags, comments）
  v2 - 给 posts 表添加 view_count 字段
  v3 - 给 users 表添加 phone 字段
  v4 - 创建索引

┌─────────────────────────────────────────────────────────────┐
│  迁移的好处：                                                │
│                                                             │
│  ✅ 版本控制：记录数据库结构的每次变更                       │
│  ✅ 可回滚：如果出问题，可以回到之前的版本                   │
│  ✅ 团队协作：其他人可以同步数据库结构                       │
│  ✅ 环境一致：开发、测试、生产环境的数据库结构保持一致       │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Prisma Migrate 命令

```bash
# 创建并应用迁移（开发环境）
npx prisma migrate dev --name init

# 命令执行流程：
# 1. 检测 Schema 变更
# 2. 生成 SQL 迁移文件
# 3. 执行 SQL 到数据库
# 4. 重新生成 Prisma Client

# 应用待执行的迁移（生产环境）
npx prisma migrate deploy

# 重置数据库（删除所有数据，重新应用所有迁移）
npx prisma migrate reset

# 查看迁移状态
npx prisma migrate status
```

### 6.3 迁移文件结构

```
prisma/
├── schema.prisma
└── migrations/
    ├── 20240115100000_init/
    │   └── migration.sql
    ├── 20240120150000_add_view_count/
    │   └── migration.sql
    └── migration_lock.toml
```

**迁移文件示例（migration.sql）：**

```sql
-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "avatar" VARCHAR(500),
    "bio" TEXT,
    "role" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "author_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");
CREATE INDEX "posts_author_id_idx" ON "posts"("author_id");
CREATE INDEX "posts_category_id_idx" ON "posts"("category_id");
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "posts" ADD CONSTRAINT "posts_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
```

### 6.4 执行迁移

```bash
# ========================================
# 步骤 1：确保数据库存在
# ========================================
psql -U postgres -c "CREATE DATABASE blog_db;"

# ========================================
# 步骤 2：配置 .env
# ========================================
# .env
# DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/blog_db?schema=public"

# ========================================
# 步骤 3：执行迁移
# ========================================
npx prisma migrate dev --name init

# 输出示例：
# Environment variables loaded from .env
# Prisma schema loaded from prisma/schema.prisma
# Datasource "db": PostgreSQL database "blog_db", schema "public" at "localhost:5432"
#
# Applying migration `20240115100000_init`
#
# The following migration(s) have been created and applied from new schema changes:
#
# migrations/
#   └─ 20240115100000_init/
#     └─ migration.sql
#
# Your database is now in sync with your schema.
#
# ✔ Generated Prisma Client (v5.x.x) to ./node_modules/@prisma/client in 150ms

# ========================================
# 步骤 4：验证
# ========================================
npx prisma studio
```

### 6.5 修改 Schema 后的迁移

```bash
# 当你修改了 Schema（比如添加字段），需要创建新的迁移

# 示例：给 User 添加 phone 字段
# 1. 修改 schema.prisma
# 2. 执行迁移
npx prisma migrate dev --name add_phone_to_user

# Prisma 会：
# 1. 检测到 User 模型新增了 phone 字段
# 2. 生成 SQL：ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(20);
# 3. 执行 SQL
# 4. 重新生成 Prisma Client
```

---

## 七、Prisma Studio 使用

### 7.1 启动和基本操作

```bash
# 启动 Prisma Studio
npx prisma studio

# 会自动打开浏览器 http://localhost:5555
```

### 7.2 数据管理操作

```
在 Prisma Studio 中：

查看数据：
  1. 点击左侧的模型名（如 User）
  2. 右侧会显示该表的所有记录
  3. 可以点击列头排序

添加记录：
  1. 点击 "Add Record" 按钮
  2. 填写字段值
  3. 关系字段会显示下拉选择
  4. 点击 "Save" 保存

编辑记录：
  1. 直接点击单元格编辑
  2. 修改后自动保存

删除记录：
  1. 选中记录（勾选复选框）
  2. 点击 "Delete" 按钮
  3. 确认删除

筛选数据：
  1. 点击 "Filter" 按钮
  2. 选择字段和条件
  3. 输入值
```

---

## 八、实操：编写完整 Schema 并执行迁移

### 8.1 完整操作流程

```bash
# ========================================
# 如果已有项目，先重置
# ========================================
# 删除旧的迁移文件
rm -rf prisma/migrations

# 重置数据库
npx prisma migrate reset --force

# ========================================
# 创建完整的 Schema
# ========================================
# 将上面的完整 Schema 代码复制到 prisma/schema.prisma

# ========================================
# 验证 Schema
# ========================================
npx prisma validate

# 格式化 Schema
npx prisma format

# ========================================
# 生成 Prisma Client
# ========================================
npx prisma generate

# ========================================
# 创建迁移
# ========================================
npx prisma migrate dev --name init

# ========================================
# 验证数据库结构
# ========================================
psql -U postgres -d blog_db -c "\dt"

# 应该看到：
#           List of relations
#  Schema |   Name    | Type  |  Owner
# --------+-----------+-------+----------
#  public | categories| table | postgres
#  public | comments  | table | postgres
#  public | posts     | table | postgres
#  public | profiles  | table | postgres
#  public | tags      | table | postgres
#  public | users     | table | postgres
#  public | _PostToTag| table | postgres
```

### 8.2 插入种子数据

```typescript
// prisma/seed.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始填充种子数据...\n');

  // 清理现有数据
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  console.log('已清理现有数据');

  // 创建用户
  const admin = await prisma.user.create({
    data: {
      email: 'admin@blog.com',
      username: 'admin',
      password: 'hashed_admin_password',
      role: 'ADMIN',
      bio: '博客管理员',
      profile: {
        create: {
          website: 'https://admin.blog.com',
          github: 'https://github.com/admin'
        }
      }
    }
  });

  const zhangsan = await prisma.user.create({
    data: {
      email: 'zhangsan@blog.com',
      username: 'zhangsan',
      password: 'hashed_zhang_password',
      bio: '全栈开发者，热爱 TypeScript',
      profile: {
        create: {
          github: 'https://github.com/zhangsan',
          twitter: 'https://twitter.com/zhangsan'
        }
      }
    }
  });

  const lisi = await prisma.user.create({
    data: {
      email: 'lisi@blog.com',
      username: 'lisi',
      password: 'hashed_li_password',
      bio: '前端工程师，React 爱好者'
    }
  });

  console.log('已创建用户');

  // 创建分类
  const frontend = await prisma.category.create({
    data: {
      name: '前端开发',
      slug: 'frontend',
      description: 'HTML/CSS/JavaScript/TypeScript 相关技术'
    }
  });

  const backend = await prisma.category.create({
    data: {
      name: '后端开发',
      slug: 'backend',
      description: 'Node.js/Express/数据库 相关技术'
    }
  });

  const devops = await prisma.category.create({
    data: {
      name: 'DevOps',
      slug: 'devops',
      description: '部署、运维、CI/CD 相关技术'
    }
  });

  console.log('已创建分类');

  // 创建标签
  const typescript = await prisma.tag.create({
    data: { name: 'TypeScript', slug: 'typescript' }
  });

  const react = await prisma.tag.create({
    data: { name: 'React', slug: 'react' }
  });

  const nodejs = await prisma.tag.create({
    data: { name: 'Node.js', slug: 'nodejs' }
  });

  const prisma_tag = await prisma.tag.create({
    data: { name: 'Prisma', slug: 'prisma' }
  });

  const postgresql = await prisma.tag.create({
    data: { name: 'PostgreSQL', slug: 'postgresql' }
  });

  const express = await prisma.tag.create({
    data: { name: 'Express', slug: 'express' }
  });

  console.log('已创建标签');

  // 创建文章
  const post1 = await prisma.post.create({
    data: {
      title: 'TypeScript 入门完全指南',
      content: 'TypeScript 是 JavaScript 的超集，添加了静态类型系统...',
      slug: 'typescript-intro',
      status: 'PUBLISHED',
      viewCount: 1200,
      authorId: admin.id,
      categoryId: frontend.id,
      publishedAt: new Date('2024-01-15'),
      tags: {
        connect: [{ id: typescript.id }, { id: react.id }]
      }
    }
  });

  const post2 = await prisma.post.create({
    data: {
      title: 'Prisma ORM 实战教程',
      content: 'Prisma 是现代化的 Node.js 和 TypeScript ORM...',
      slug: 'prisma-orm-guide',
      status: 'PUBLISHED',
      viewCount: 800,
      authorId: zhangsan.id,
      categoryId: backend.id,
      publishedAt: new Date('2024-02-20'),
      tags: {
        connect: [{ id: prisma_tag.id }, { id: postgresql.id }, { id: nodejs.id }]
      }
    }
  });

  const post3 = await prisma.post.create({
    data: {
      title: 'Express + TypeScript 项目搭建',
      content: '本文介绍如何从零搭建一个 Express + TypeScript 项目...',
      slug: 'express-typescript-setup',
      status: 'DRAFT',
      authorId: admin.id,
      categoryId: backend.id,
      tags: {
        connect: [{ id: typescript.id }, { id: express.id }, { id: nodejs.id }]
      }
    }
  });

  const post4 = await prisma.post.create({
    data: {
      title: 'React Hooks 最佳实践',
      content: 'React Hooks 改变了我们编写组件的方式...',
      slug: 'react-hooks-best-practices',
      status: 'PUBLISHED',
      viewCount: 2500,
      authorId: lisi.id,
      categoryId: frontend.id,
      publishedAt: new Date('2024-03-10'),
      tags: {
        connect: [{ id: react.id }]
      }
    }
  });

  console.log('已创建文章');

  // 创建评论
  await prisma.comment.create({
    data: {
      content: '写得很好，收藏了！',
      authorId: zhangsan.id,
      postId: post1.id
    }
  });

  await prisma.comment.create({
    data: {
      content: '感谢分享，对我帮助很大',
      authorId: lisi.id,
      postId: post1.id
    }
  });

  const comment3 = await prisma.comment.create({
    data: {
      content: '能详细讲讲泛型吗？',
      authorId: lisi.id,
      postId: post1.id
    }
  });

  await prisma.comment.create({
    data: {
      content: '好的，后续会专门写一篇泛型的文章',
      authorId: admin.id,
      postId: post1.id,
      parentId: comment3.id  // 回复评论3
    }
  });

  await prisma.comment.create({
    data: {
      content: 'Prisma 确实比 TypeORM 好用',
      authorId: admin.id,
      postId: post2.id
    }
  });

  console.log('已创建评论');

  // 统计
  const stats = {
    users: await prisma.user.count(),
    posts: await prisma.post.count(),
    categories: await prisma.category.count(),
    tags: await prisma.tag.count(),
    comments: await prisma.comment.count()
  };

  console.log('\n种子数据统计:');
  console.log(`  用户: ${stats.users}`);
  console.log(`  文章: ${stats.posts}`);
  console.log(`  分类: ${stats.categories}`);
  console.log(`  标签: ${stats.tags}`);
  console.log(`  评论: ${stats.comments}`);
}

main()
  .catch((error) => {
    console.error('种子数据填充失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**package.json 添加 seed 脚本：**

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

**执行种子脚本：**

```bash
npx prisma db seed
```

---

## 九、小结

```
本课要点回顾：
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. 数据建模是从需求推导表结构的过程                     │
│     - 识别实体（User, Post, Comment...）                │
│     - 识别关系（一对一、一对多、多对多）                 │
│                                                         │
│  2. 博客平台的核心模型                                   │
│     - User：用户信息                                    │
│     - Profile：个人资料（一对一）                       │
│     - Post：文章                                        │
│     - Category：分类                                    │
│     - Tag：标签（多对多）                               │
│     - Comment：评论（自引用）                           │
│                                                         │
│  3. Prisma 关系定义                                      │
│     - 一对一：外键 + @unique                            │
│     - 一对多：外键 + 数组                               │
│     - 多对多：两个数组，Prisma 自动创建中间表           │
│     - 自引用：同一模型的 @relation                      │
│                                                         │
│  4. 迁移是数据库结构的版本控制                           │
│     - npx prisma migrate dev 创建迁移                   │
│     - 迁移文件保存在 prisma/migrations/                 │
│                                                         │
│  5. Prisma Studio 是可视化数据管理工具                   │
│     - 查看、添加、编辑、删除数据                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 下一课预告

下一课我们将学习 **CRUD 操作详解**——使用 Prisma Client 进行数据的增删改查，包括查询条件、选择字段、排序分页等操作。

---

> **学习建议：** 数据库设计是后端开发的核心技能。建议多练习，尝试为不同的业务场景设计 Schema。
