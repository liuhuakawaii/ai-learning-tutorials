# 第六课：CRUD 操作详解

> **课程定位：** 第二阶段 · 数据库 · 第 6 课时
> **前置知识：** Schema 设计与迁移（第五课）
> **预计时长：** 90 分钟

---

## 学习目标

完成本课后，你将能够：

1. 正确初始化 Prisma Client（单例模式）
2. 使用 Prisma 进行数据的创建（Create）
3. 使用 Prisma 进行数据的查询（Read）
4. 使用 Prisma 进行数据的更新（Update）
5. 使用 Prisma 进行数据的删除（Delete）
6. 掌握选择字段、包含关系、排序、分页
7. 理解事务的使用场景
8. 了解如何执行原始 SQL 查询

---

## 一、Prisma Client 初始化

### 1.1 单例模式

```typescript
// src/prisma/client.ts

import { PrismaClient } from '@prisma/client';

// 全局变量声明（用于开发环境热重载）
declare global {
  var prisma: PrismaClient | undefined;
}

// 创建 Prisma Client 实例
// 开发环境：使用全局变量避免热重载时创建多个连接
// 生产环境：直接创建实例
const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

export default prisma;

// 导出类型供其他模块使用
export type { PrismaClient };
export { Prisma } from '@prisma/client';
```

### 1.2 为什么用单例

```
单例模式解决的问题：

❌ 每次创建新实例：
┌─────────────────────────────────────────────────────────────┐
│ import { PrismaClient } from '@prisma/client';              │
│                                                             │
│ // 每个文件都 new 一个                                       │
│ const prisma1 = new PrismaClient();  // 连接池 1             │
│ const prisma2 = new PrismaClient();  // 连接池 2             │
│ const prisma3 = new PrismaClient();  // 连接池 3             │
│                                                             │
│ // 结果：3 个连接池，浪费数据库连接                          │
│ // PostgreSQL 默认最多 100 个连接                            │
└─────────────────────────────────────────────────────────────┘

✅ 单例模式：
┌─────────────────────────────────────────────────────────────┐
│ // prisma/client.ts                                         │
│ const prisma = new PrismaClient();  // 只创建一个实例        │
│ export default prisma;                                      │
│                                                             │
│ // 所有文件导入同一个实例                                    │
│ import prisma from './prisma/client';  // 使用同一个连接池  │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、创建数据（Create）

### 2.1 create - 创建单条记录

```typescript
import prisma from './prisma/client';

// 创建用户
const user = await prisma.user.create({
  data: {
    email: 'zhangsan@example.com',
    username: 'zhangsan',
    password: 'hashed_password_123',
    bio: '全栈开发者',
    role: 'USER'
  }
});

console.log(user);
// {
//   id: 1,
//   email: 'zhangsan@example.com',
//   username: 'zhangsan',
//   password: 'hashed_password_123',
//   avatar: null,
//   bio: '全栈开发者',
//   role: 'USER',
//   createdAt: 2024-01-15T10:00:00.000Z,
//   updatedAt: 2024-01-15T10:00:00.000Z
// }
```

### 2.2 create - 创建关联记录

```typescript
// 创建用户并同时创建个人资料（一对一）
const userWithProfile = await prisma.user.create({
  data: {
    email: 'lisi@example.com',
    username: 'lisi',
    password: 'hashed_password_456',
    profile: {
      create: {
        phone: '13800138000',
        github: 'https://github.com/lisi',
        website: 'https://lisi.dev'
      }
    }
  },
  include: {
    profile: true  // 返回时包含个人资料
  }
});

console.log(userWithProfile);
// {
//   id: 2,
//   email: 'lisi@example.com',
//   username: 'lisi',
//   ...
//   profile: {
//     id: 1,
//     userId: 2,
//     phone: '13800138000',
//     github: 'https://github.com/lisi',
//     ...
//   }
// }

// 创建文章并关联已有标签（多对多）
const post = await prisma.post.create({
  data: {
    title: 'TypeScript 入门指南',
    content: 'TypeScript 是 JavaScript 的超集...',
    slug: 'typescript-intro',
    status: 'PUBLISHED',
    publishedAt: new Date(),
    authorId: 1,
    categoryId: 1,
    tags: {
      connect: [
        { id: 1 },  // 连接已存在的标签
        { id: 2 }
      ]
    }
  },
  include: {
    tags: true
  }
});

// 创建文章并同时创建新标签
const post2 = await prisma.post.create({
  data: {
    title: 'Prisma 实战',
    content: 'Prisma 是现代化的 ORM...',
    slug: 'prisma-guide',
    authorId: 1,
    tags: {
      create: [
        { name: 'Prisma', slug: 'prisma' },      // 创建新标签
        { name: 'Database', slug: 'database' }
      ]
    }
  },
  include: {
    tags: true
  }
});
```

### 2.3 createMany - 批量创建

```typescript
// 批量创建用户
const result = await prisma.user.createMany({
  data: [
    {
      email: 'user1@example.com',
      username: 'user1',
      password: 'hashed_pass_1'
    },
    {
      email: 'user2@example.com',
      username: 'user2',
      password: 'hashed_pass_2'
    },
    {
      email: 'user3@example.com',
      username: 'user3',
      password: 'hashed_pass_3'
    }
  ],
  skipDuplicates: true  // 跳过重复记录（根据唯一约束）
});

console.log(result);  // { count: 3 }

// 批量创建标签
const tags = await prisma.tag.createMany({
  data: [
    { name: 'JavaScript', slug: 'javascript' },
    { name: 'React', slug: 'react' },
    { name: 'Vue', slug: 'vue' },
    { name: 'Angular', slug: 'angular' },
    { name: 'Node.js', slug: 'nodejs' }
  ]
});

console.log(`创建了 ${tags.count} 个标签`);
```

> **注意：** `createMany` 不支持嵌套创建关联记录，也不返回创建的记录。如果需要返回记录，使用 `create` 或事务。

---

## 三、查询数据（Read）

### 3.1 findUnique - 查询单条记录（根据唯一字段）

```typescript
// 根据 ID 查询
const user = await prisma.user.findUnique({
  where: { id: 1 }
});

// 根据唯一字段查询
const userByEmail = await prisma.user.findUnique({
  where: { email: 'zhangsan@example.com' }
});

const userByUsername = await prisma.user.findUnique({
  where: { username: 'zhangsan' }
});

// 返回值：User | null（找不到时返回 null）
```

### 3.2 findFirst - 查询第一条匹配的记录

```typescript
// findFirst 可以使用非唯一字段作为条件
const publishedPost = await prisma.post.findFirst({
  where: {
    status: 'PUBLISHED',
    authorId: 1
  }
});

// 带排序
const latestPost = await prisma.post.findFirst({
  where: { status: 'PUBLISHED' },
  orderBy: { createdAt: 'desc' }
});

// 返回值：Post | null
```

### 3.3 findMany - 查询多条记录

```typescript
// 查询所有用户
const allUsers = await prisma.user.findMany();
// 返回值：User[]

// 带条件查询
const publishedPosts = await prisma.post.findMany({
  where: {
    status: 'PUBLISHED'
  }
});

// 带排序
const posts = await prisma.post.findMany({
  where: { status: 'PUBLISHED' },
  orderBy: { createdAt: 'desc' }
});

// 带分页
const page1 = await prisma.post.findMany({
  skip: 0,   // 跳过 0 条
  take: 10   // 取 10 条
});

const page2 = await prisma.post.findMany({
  skip: 10,  // 跳过 10 条
  take: 10   // 取 10 条
});
```

### 3.4 查询条件详解

```typescript
// ==================== 相等 ====================
const users = await prisma.user.findMany({
  where: {
    role: 'ADMIN'           // role = 'ADMIN'
  }
});

// ==================== 比较运算 ====================
const posts = await prisma.post.findMany({
  where: {
    viewCount: { gt: 100 }  // view_count > 100
  }
});

// gt   - 大于 (>)
// gte  - 大于等于 (>=)
// lt   - 小于 (<)
// lte  - 小于等于 (<=)
// not  - 不等于 (!=)

const popularPosts = await prisma.post.findMany({
  where: {
    viewCount: {
      gte: 100,   // view_count >= 100
      lte: 10000  // AND view_count <= 10000
    }
  }
});

// ==================== 包含（IN） ====================
const admins = await prisma.user.findMany({
  where: {
    role: { in: ['ADMIN', 'MODERATOR'] }  // role IN ('ADMIN', 'MODERATOR')
  }
});

const notAdmins = await prisma.user.findMany({
  where: {
    role: { notIn: ['ADMIN'] }  // role NOT IN ('ADMIN')
  }
});

// ==================== 模糊查询（LIKE） ====================
const postsByTitle = await prisma.post.findMany({
  where: {
    title: { contains: 'TypeScript' }  // title LIKE '%TypeScript%'
  }
});

const postsStartsWith = await prisma.post.findMany({
  where: {
    title: { startsWith: 'Type' }  // title LIKE 'Type%'
  }
});

const postsEndsWith = await prisma.post.findMany({
  where: {
    title: { endsWith: '指南' }  // title LIKE '%指南'
  }
});

// 忽略大小写
const postsIgnoreCase = await prisma.post.findMany({
  where: {
    title: { contains: 'typescript', mode: 'insensitive' }
  }
});

// ==================== NULL 检查 ====================
const postsWithoutCategory = await prisma.post.findMany({
  where: {
    categoryId: null  // category_id IS NULL
  }
});

const postsWithCategory = await prisma.post.findMany({
  where: {
    categoryId: { not: null }  // category_id IS NOT NULL
  }
});

// ==================== 逻辑运算 ====================
// AND（默认）
const posts = await prisma.post.findMany({
  where: {
    status: 'PUBLISHED',      // 条件1 AND 条件2
    authorId: 1
  }
});

// 显式 AND
const posts = await prisma.post.findMany({
  where: {
    AND: [
      { status: 'PUBLISHED' },
      { viewCount: { gt: 100 } }
    ]
  }
});

// OR
const posts = await prisma.post.findMany({
  where: {
    OR: [
      { status: 'PUBLISHED' },
      { viewCount: { gt: 1000 } }
    ]
  }
});

// NOT
const posts = await prisma.post.findMany({
  where: {
    NOT: {
      status: 'ARCHIVED'
    }
  }
});

// 复杂条件组合
const posts = await prisma.post.findMany({
  where: {
    AND: [
      { status: 'PUBLISHED' },
      {
        OR: [
          { title: { contains: 'TypeScript' } },
          { title: { contains: 'React' } }
        ]
      }
    ]
  }
});
// 等价于：
// WHERE status = 'PUBLISHED'
//   AND (title LIKE '%TypeScript%' OR title LIKE '%React%')
```

### 3.5 条件速查表

```
Prisma 查询条件速查表：
┌──────────────────┬────────────────────────────────────────┐
│ 条件              │ 等价 SQL                               │
├──────────────────┼────────────────────────────────────────┤
│ { field: value } │ field = value                          │
│ { gt: value }    │ field > value                          │
│ { gte: value }   │ field >= value                         │
│ { lt: value }    │ field < value                          │
│ { lte: value }   │ field <= value                         │
│ { not: value }   │ field != value                         │
│ { in: [...] }    │ field IN (...)                         │
│ { notIn: [...] } │ field NOT IN (...)                     │
│ { contains: s }  │ field LIKE '%s%'                       │
│ { startsWith: s }│ field LIKE 's%'                        │
│ { endsWith: s }  │ field LIKE '%s'                        │
│ { mode: 'insensitive' } │ 忽略大小写                      │
│ null             │ field IS NULL                          │
│ { not: null }    │ field IS NOT NULL                      │
└──────────────────┴────────────────────────────────────────┘
```

---

## 四、更新数据（Update）

### 4.1 update - 更新单条记录

```typescript
// 根据 ID 更新
const updatedUser = await prisma.user.update({
  where: { id: 1 },
  data: {
    bio: '更新后的个人简介',
    avatar: 'https://example.com/new-avatar.jpg'
  }
});

// 根据唯一字段更新
const updated = await prisma.user.update({
  where: { email: 'zhangsan@example.com' },
  data: { role: 'ADMIN' }
});

// 使用表达式更新（Prisma 不直接支持，需要 $executeRaw）
// 例如：view_count = view_count + 1
await prisma.$executeRaw`
  UPDATE posts SET view_count = view_count + 1 WHERE id = ${postId}
`;
```

### 4.2 updateMany - 批量更新

```typescript
// 更新所有匹配的记录
const result = await prisma.post.updateMany({
  where: {
    status: 'DRAFT',
    createdAt: {
      lt: new Date('2023-01-01')
    }
  },
  data: {
    status: 'ARCHIVED'
  }
});

console.log(`更新了 ${result.count} 篇文章`);
```

### 4.3 upsert - 更新或创建

```typescript
// 如果存在则更新，不存在则创建
const user = await prisma.user.upsert({
  where: {
    email: 'newuser@example.com'  // 查找条件
  },
  update: {
    // 存在时更新这些字段
    bio: '更新后的简介',
    lastLoginAt: new Date()
  },
  create: {
    // 不存在时创建
    email: 'newuser@example.com',
    username: 'newuser',
    password: 'hashed_password',
    bio: '新用户'
  }
});

// 实际应用场景：用户登录时更新或创建记录
async function upsertUser(email: string, data: any) {
  return prisma.user.upsert({
    where: { email },
    update: {
      lastLoginAt: new Date(),
      loginCount: { increment: 1 }  // 原子递增
    },
    create: {
      email,
      username: data.username,
      password: data.password
    }
  });
}
```

---

## 五、删除数据（Delete）

### 5.1 delete - 删除单条记录

```typescript
// 根据 ID 删除
const deletedUser = await prisma.user.delete({
  where: { id: 1 }
});

// 根据唯一字段删除
await prisma.user.delete({
  where: { email: 'user@example.com' }
});

// 注意：如果记录不存在，会抛出异常
// 使用 deleteOrThrow 或 try-catch 处理
```

### 5.2 deleteMany - 批量删除

```typescript
// 删除所有草稿文章
const result = await prisma.post.deleteMany({
  where: {
    status: 'DRAFT',
    createdAt: {
      lt: new Date('2023-01-01')
    }
  }
});

console.log(`删除了 ${result.count} 篇文章`);

// 删除所有记录（清空表）
await prisma.comment.deleteMany();  // 先删评论（有外键依赖）
await prisma.post.deleteMany();     // 再删文章
await prisma.user.deleteMany();     // 最后删用户
```

---

## 六、选择字段与包含关系

### 6.1 select - 选择特定字段

```typescript
// 只查询部分字段
const users = await prisma.user.findMany({
  select: {
    id: true,
    username: true,
    email: true
    // password 不会返回
  }
});
// 返回类型：{ id: number; username: string; email: string }[]

// 查询用户及其文章数量
const usersWithCount = await prisma.user.findMany({
  select: {
    id: true,
    username: true,
    _count: {
      select: {
        posts: true,
        comments: true
      }
    }
  }
});
// 返回类型：{ id: number; username: string; _count: { posts: number; comments: number } }[]
```

### 6.2 include - 包含关联记录

```typescript
// 查询用户及其所有文章
const userWithPosts = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    posts: true
  }
});
// 返回类型：User & { posts: Post[] }

// 查询文章及其作者和标签
const postWithRelations = await prisma.post.findUnique({
  where: { id: 1 },
  include: {
    author: {
      select: {
        id: true,
        username: true,
        avatar: true
      }
    },
    tags: true,
    category: true,
    comments: {
      include: {
        author: {
          select: { id: true, username: true }
        }
      }
    }
  }
});

// 多层嵌套 include
const postWithNested = await prisma.post.findUnique({
  where: { id: 1 },
  include: {
    author: {
      include: {
        profile: true  // 文章 → 作者 → 个人资料
      }
    },
    comments: {
      include: {
        author: true,
        replies: {        // 评论 → 回复 → 回复的作者
          include: {
            author: true
          }
        }
      }
    }
  }
});
```

### 6.3 select vs include 的区别

```
select 和 include 的区别：

┌─────────────┬─────────────────────────────────────────────┐
│ select      │ 选择要返回的字段                            │
│             │ - 只返回指定的字段                          │
│             │ - 类型是手动指定的字段组合                  │
├─────────────┼─────────────────────────────────────────────┤
│ include     │ 包含关联记录                                │
│             │ - 返回所有字段 + 指定的关联                 │
│             │ - 类型是模型 + 关联记录                     │
└─────────────┴─────────────────────────────────────────────┘

// select 示例
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    username: true,
    email: true
  }
});
// 类型：{ id: number; username: string; email: string } | null

// include 示例
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: {
    posts: true
  }
});
// 类型：(User & { posts: Post[] }) | null

// 不能同时使用 select 和 include（除了 _count）
```

---

## 七、排序与分页

### 7.1 orderBy - 排序

```typescript
// 单字段排序
const posts = await prisma.post.findMany({
  orderBy: { createdAt: 'desc' }  // 降序
});

const posts = await prisma.post.findMany({
  orderBy: { createdAt: 'asc' }   // 升序
});

// 多字段排序
const posts = await prisma.post.findMany({
  orderBy: [
    { status: 'asc' },        // 先按状态升序
    { createdAt: 'desc' }     // 再按创建时间降序
  ]
});

// 按关联字段排序
const posts = await prisma.post.findMany({
  orderBy: {
    author: { username: 'asc' }  // 按作者用户名排序
  }
});

// 按计算字段排序（如文章数量）
const users = await prisma.user.findMany({
  orderBy: {
    posts: { _count: 'desc' }  // 按文章数量降序
  }
});
```

### 7.2 skip + take - 分页

```typescript
// 基本分页
const page1 = await prisma.post.findMany({
  skip: 0,   // 跳过 0 条
  take: 10   // 取 10 条
});
// 第 1 页

const page2 = await prisma.post.findMany({
  skip: 10,  // 跳过 10 条
  take: 10   // 取 10 条
});
// 第 2 页

const page3 = await prisma.post.findMany({
  skip: 20,  // 跳过 20 条
  take: 10   // 取 10 条
});
// 第 3 页

// 通用分页公式
async function getPosts(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.post.count()  // 获取总数
  ]);

  return {
    data: posts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
}

// 使用
const result = await getPosts(2, 10);
console.log(result);
// {
//   data: [...],
//   pagination: {
//     page: 2,
//     pageSize: 10,
//     total: 50,
//     totalPages: 5
//   }
// }
```

---

## 八、事务（Transaction）

### 8.1 为什么需要事务

```
事务保证多个操作要么全部成功，要么全部失败。

场景：转账
  张三给李四转 100 元

  步骤 1：张三账户扣除 100 元  ✓
  步骤 2：李四账户增加 100 元  ✓

  如果步骤 1 成功但步骤 2 失败：
  - 张三的钱没了
  - 李四没收到钱
  - 数据不一致！

  使用事务：
  - 要么两个步骤都成功（提交）
  - 要么两个步骤都失败（回滚）
```

### 8.2 交互式事务

```typescript
// 使用 $transaction 进行交互式事务
const result = await prisma.$transaction(async (tx) => {
  // 在事务中执行多个操作
  const user = await tx.user.create({
    data: {
      email: 'newuser@example.com',
      username: 'newuser',
      password: 'hashed_password'
    }
  });

  const profile = await tx.profile.create({
    data: {
      userId: user.id,
      phone: '13800138000'
    }
  });

  // 如果任何操作失败，所有操作都会回滚
  return { user, profile };
});

// 实际场景：创建文章并关联标签
async function createPostWithTags(postData: any, tagIds: number[]) {
  return prisma.$transaction(async (tx) => {
    // 1. 创建文章
    const post = await tx.post.create({
      data: {
        title: postData.title,
        content: postData.content,
        slug: postData.slug,
        authorId: postData.authorId,
        categoryId: postData.categoryId
      }
    });

    // 2. 关联标签
    await tx.post.update({
      where: { id: post.id },
      data: {
        tags: {
          connect: tagIds.map(id => ({ id }))
        }
      }
    });

    // 3. 更新用户的文章计数（如果有的话）
    await tx.user.update({
      where: { id: postData.authorId },
      data: {
        postCount: { increment: 1 }
      }
    });

    return post;
  });
}
```

### 8.3 批量操作事务

```typescript
// 使用 $transaction 进行批量操作（性能更好）
const [user1, user2, user3] = await prisma.$transaction([
  prisma.user.create({
    data: {
      email: 'user1@example.com',
      username: 'user1',
      password: 'pass1'
    }
  }),
  prisma.user.create({
    data: {
      email: 'user2@example.com',
      username: 'user2',
      password: 'pass2'
    }
  }),
  prisma.user.create({
    data: {
      email: 'user3@example.com',
      username: 'user3',
      password: 'pass3'
    }
  })
]);

// 批量读取
const [users, posts, categories] = await prisma.$transaction([
  prisma.user.findMany(),
  prisma.post.findMany(),
  prisma.category.findMany()
]);
```

---

## 九、原始 SQL 查询

### 9.1 $queryRaw - 查询原始 SQL

```typescript
// 使用 $queryRaw 执行原始 SQL 查询
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE role = 'ADMIN'
`;

// 带参数的查询（防注入）
const userId = 1;
const user = await prisma.$queryRaw`
  SELECT * FROM users WHERE id = ${userId}
`;

// 复杂查询
const stats = await prisma.$queryRaw`
  SELECT
    u.username,
    COUNT(p.id) AS post_count,
    SUM(p.view_count) AS total_views
  FROM users u
  LEFT JOIN posts p ON u.id = p.author_id
  GROUP BY u.id, u.username
  ORDER BY post_count DESC
`;
```

### 9.2 $executeRaw - 执行原始 SQL

```typescript
// 使用 $executeRaw 执行 INSERT/UPDATE/DELETE
const result = await prisma.$executeRaw`
  UPDATE posts
  SET view_count = view_count + 1
  WHERE id = ${postId}
`;

// 批量更新
await prisma.$executeRaw`
  UPDATE posts
  SET status = 'ARCHIVED'
  WHERE created_at < '2023-01-01' AND status = 'DRAFT'
`;
```

### 9.3 使用原始 SQL 的场景

```
什么时候使用原始 SQL：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ✅ 复杂的聚合查询                                           │
│     - Prisma 不支持某些 SQL 函数                             │
│     - 需要窗口函数、CTE 等高级特性                          │
│                                                             │
│  ✅ 性能优化                                                 │
│     - Prisma 生成的 SQL 不够优化                            │
│     - 需要使用特定的索引 hint                               │
│                                                             │
│  ✅ 数据库特有功能                                           │
│     - PostgreSQL 的 JSON 操作                               │
│     - 全文搜索                                              │
│     - 地理查询                                              │
│                                                             │
│  ❌ 不推荐的场景                                             │
│     - 简单的 CRUD 操作（用 Prisma 更安全）                  │
│     - 需要类型安全的查询                                    │
│     - 需要跨数据库兼容                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 十、TypeScript 类型推导

### 10.1 Prisma 生成的类型

```typescript
import { User, Post, Prisma } from '@prisma/client';

// 模型类型
const user: User = {
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  password: 'hashed',
  avatar: null,
  bio: null,
  role: 'USER',
  createdAt: new Date(),
  updatedAt: new Date()
};

// 查询参数类型
const where: Prisma.UserWhereInput = {
  email: { contains: '@example.com' },
  role: 'ADMIN'
};

const data: Prisma.UserUpdateInput = {
  bio: '新简介',
  role: 'ADMIN'
};
```

### 10.2 使用 Prisma 工具类型

```typescript
import { Prisma } from '@prisma/client';

// 根据查询推导类型
type UserWithPosts = Prisma.UserGetPayload<{
  include: { posts: true }
}>;

type PostWithAuthor = Prisma.PostGetPayload<{
  include: {
    author: {
      select: { id: true; username: true }
    }
  }
}>;

// 使用示例
async function getUserWithPosts(id: number): Promise<UserWithPosts | null> {
  return prisma.user.findUnique({
    where: { id },
    include: { posts: true }
  });
}

// 函数返回类型自动推导
async function getPost(id: number) {
  return prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, username: true, avatar: true }
      },
      tags: true,
      _count: {
        select: { comments: true }
      }
    }
  });
}

// 返回类型自动推导为：
// {
//   id: number;
//   title: string;
//   content: string;
//   slug: string;
//   status: PostStatus;
//   author: { id: number; username: string; avatar: string | null };
//   tags: Tag[];
//   _count: { comments: number };
//   ...
// } | null
```

---

## 十一、为博客模型编写完整 CRUD 服务

### 11.1 UserService

```typescript
// src/services/user.service.ts

import prisma from '../prisma/client';
import { Prisma, User, Role } from '@prisma/client';

export class UserService {
  // 创建用户
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  // 根据 ID 查询
  async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id }
    });
  }

  // 根据邮箱查询
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email }
    });
  }

  // 根据用户名查询
  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username }
    });
  }

  // 查询用户列表
  async findMany(options?: {
    role?: Role;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { role, search, page = 1, pageSize = 10 } = options || {};

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          createdAt: true,
          _count: {
            select: { posts: true, comments: true }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    return {
      data: users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  // 更新用户
  async update(id: number, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data
    });
  }

  // 删除用户
  async delete(id: number): Promise<User> {
    return prisma.user.delete({
      where: { id }
    });
  }
}

export default new UserService();
```

### 11.2 PostService

```typescript
// src/services/post.service.ts

import prisma from '../prisma/client';
import { Prisma, Post, PostStatus } from '@prisma/client';

export class PostService {
  // 创建文章
  async create(data: Prisma.PostCreateInput): Promise<Post> {
    return prisma.post.create({
      data,
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        category: true,
        tags: true
      }
    });
  }

  // 根据 ID 查询
  async findById(id: number) {
    return prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, username: true, avatar: true, bio: true }
        },
        category: true,
        tags: true,
        comments: {
          where: { parentId: null },  // 只查顶级评论
          include: {
            author: { select: { id: true, username: true, avatar: true } },
            replies: {
              include: {
                author: { select: { id: true, username: true, avatar: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { comments: true } }
      }
    });
  }

  // 根据 slug 查询
  async findBySlug(slug: string) {
    return prisma.post.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        category: true,
        tags: true,
        _count: { select: { comments: true } }
      }
    });
  }

  // 查询文章列表（带筛选和分页）
  async findMany(options?: {
    status?: PostStatus;
    authorId?: number;
    categoryId?: number;
    tagSlug?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    orderBy?: 'createdAt' | 'viewCount' | 'title';
    order?: 'asc' | 'desc';
  }) {
    const {
      status,
      authorId,
      categoryId,
      tagSlug,
      search,
      page = 1,
      pageSize = 10,
      orderBy = 'createdAt',
      order = 'desc'
    } = options || {};

    const where: Prisma.PostWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tagSlug) {
      where.tags = { some: { slug: tagSlug } };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [orderBy]: order },
        include: {
          author: { select: { id: true, username: true, avatar: true } },
          category: true,
          tags: true,
          _count: { select: { comments: true } }
        }
      }),
      prisma.post.count({ where })
    ]);

    return {
      data: posts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    };
  }

  // 更新文章
  async update(id: number, data: Prisma.PostUpdateInput): Promise<Post> {
    return prisma.post.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, username: true } },
        category: true,
        tags: true
      }
    });
  }

  // 更新浏览次数
  async incrementViewCount(id: number): Promise<void> {
    await prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } }
    });
  }

  // 删除文章
  async delete(id: number): Promise<Post> {
    return prisma.post.delete({ where: { id } });
  }
}

export default new PostService();
```

### 11.3 CategoryService

```typescript
// src/services/category.service.ts

import prisma from '../prisma/client';
import { Prisma, Category } from '@prisma/client';

export class CategoryService {
  async create(data: Prisma.CategoryCreateInput): Promise<Category> {
    return prisma.category.create({ data });
  }

  async findById(id: number) {
    return prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { posts: true } }
      }
    });
  }

  async findBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
      include: {
        _count: { select: { posts: true } }
      }
    });
  }

  async findMany() {
    return prisma.category.findMany({
      include: {
        _count: { select: { posts: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  async update(id: number, data: Prisma.CategoryUpdateInput): Promise<Category> {
    return prisma.category.update({ where: { id }, data });
  }

  async delete(id: number): Promise<Category> {
    return prisma.category.delete({ where: { id } });
  }
}

export default new CategoryService();
```

### 11.4 CommentService

```typescript
// src/services/comment.service.ts

import prisma from '../prisma/client';
import { Prisma, Comment } from '@prisma/client';

export class CommentService {
  async create(data: Prisma.CommentCreateInput): Promise<Comment> {
    return prisma.comment.create({
      data,
      include: {
        author: { select: { id: true, username: true, avatar: true } }
      }
    });
  }

  async findById(id: number) {
    return prisma.comment.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        post: { select: { id: true, title: true, slug: true } },
        replies: {
          include: {
            author: { select: { id: true, username: true, avatar: true } }
          }
        }
      }
    });
  }

  async findByPostId(postId: number) {
    return prisma.comment.findMany({
      where: {
        postId,
        parentId: null  // 只查顶级评论
      },
      include: {
        author: { select: { id: true, username: true, avatar: true } },
        replies: {
          include: {
            author: { select: { id: true, username: true, avatar: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: number, data: Prisma.CommentUpdateInput): Promise<Comment> {
    return prisma.comment.update({ where: { id }, data });
  }

  async delete(id: number): Promise<Comment> {
    return prisma.comment.delete({ where: { id } });
  }
}

export default new CommentService();
```

### 11.5 TagService

```typescript
// src/services/tag.service.ts

import prisma from '../prisma/client';
import { Prisma, Tag } from '@prisma/client';

export class TagService {
  async create(data: Prisma.TagCreateInput): Promise<Tag> {
    return prisma.tag.create({ data });
  }

  async findById(id: number) {
    return prisma.tag.findUnique({
      where: { id },
      include: {
        _count: { select: { posts: true } }
      }
    });
  }

  async findBySlug(slug: string) {
    return prisma.tag.findUnique({
      where: { slug },
      include: {
        _count: { select: { posts: true } }
      }
    });
  }

  async findMany(options?: { popular?: boolean; limit?: number }) {
    const { popular, limit } = options || {};

    return prisma.tag.findMany({
      include: {
        _count: { select: { posts: true } }
      },
      orderBy: popular
        ? { posts: { _count: 'desc' } }
        : { name: 'asc' },
      take: limit
    });
  }

  async update(id: number, data: Prisma.TagUpdateInput): Promise<Tag> {
    return prisma.tag.update({ where: { id }, data });
  }

  async delete(id: number): Promise<Tag> {
    return prisma.tag.delete({ where: { id } });
  }
}

export default new TagService();
```

---

## 十二、小结

```
本课要点回顾：
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. Prisma Client 应使用单例模式                        │
│     - 全局变量避免热重载创建多个实例                    │
│                                                         │
│  2. 创建数据                                            │
│     - create：创建单条记录                              │
│     - createMany：批量创建                              │
│     - 嵌套创建关联记录                                  │
│                                                         │
│  3. 查询数据                                            │
│     - findUnique：根据唯一字段查询                      │
│     - findFirst：查询第一条匹配记录                     │
│     - findMany：查询多条记录                            │
│     - 条件：比较、IN、模糊查询、NULL、逻辑运算         │
│                                                         │
│  4. 更新数据                                            │
│     - update：更新单条记录                              │
│     - updateMany：批量更新                              │
│     - upsert：更新或创建                                │
│                                                         │
│  5. 删除数据                                            │
│     - delete：删除单条记录                              │
│     - deleteMany：批量删除                              │
│                                                         │
│  6. select 选择字段，include 包含关联                   │
│                                                         │
│  7. orderBy 排序，skip+take 分页                        │
│                                                         │
│  8. 事务保证多个操作的原子性                            │
│                                                         │
│  9. $queryRaw 执行原始 SQL 查询                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 下一课预告

下一课我们将学习 **关联查询与分页**——深入探讨嵌套查询、关联过滤、游标分页、聚合查询等高级用法。

---

> **学习建议：** CRUD 是数据库操作的基础，建议多练习。尝试为每个模型编写完整的 CRUD 服务，熟悉 Prisma 的 API。
