# 第二课：SQL 入门

## 场景引入

你已经理解了数据库的基本概念——表、行、列、主键、外键。但光有概念还不够，你需要一门语言来和数据库"对话"。就像学了中文语法还不够，你得会开口说话。SQL（Structured Query Language）就是你和关系型数据库沟通的语言。你想创建一张表，用 `CREATE TABLE`；想插入一条数据，用 `INSERT INTO`；想查询满足条件的记录，用 `SELECT ... WHERE`。掌握 SQL，是操作任何关系型数据库的基础技能。

## 学习目标

完成本课后，你将能够：

1. 理解 SQL 是什么以及它的四种分类
2. 使用 CREATE TABLE 创建表，选择合适的数据类型和约束
3. 使用 INSERT INTO 插入数据
4. 使用 SELECT 进行条件查询、排序、分页
5. 使用 UPDATE 和 DELETE 修改和删除数据
6. 使用聚合函数和 GROUP BY 进行数据统计
7. 使用 JOIN 进行多表关联查询
8. 理解子查询的概念

---

## 一、SQL 是什么

### 1.1 基本概念

**SQL（Structured Query Language，结构化查询语言）** 是用来操作关系型数据库的标准语言。

```
SQL 的角色：

  你（开发者）
      │
      │  写 SQL 语句
      ↓
  ┌─────────┐
  │  SQL    │  ← 数据库能听懂的"语言"
  └─────────┘
      │
      ↓
  ┌─────────────┐
  │  数据库     │  ← PostgreSQL / MySQL / SQLite
  │  (存储数据) │
  └─────────────┘
```

> **类比：** 如果数据库是一个外国人，SQL 就是你和他沟通的语言。你用 SQL 告诉数据库"我要什么数据"，数据库用结果回答你。

### 1.2 SQL 和 TypeScript 的对比

```typescript
// TypeScript：操作内存中的数据
const users = [
  { id: 1, name: '张三', age: 25 },
  { id: 2, name: '李四', age: 30 }
];

// 查找年龄大于 25 的用户
const result = users.filter(user => user.age > 25);

// SQL：操作数据库中的数据
// SELECT * FROM users WHERE age > 25;

// 两者做的事情一样，只是操作的对象不同
```

### 1.3 SQL 的四大分类

```
┌──────────┬──────────────────────┬──────────────────────────────┐
│ 分类      │ 全称                  │ 用途                          │
├──────────┼──────────────────────┼──────────────────────────────┤
│ DDL      │ Data Definition      │ 定义数据库结构                │
│          │ Language             │ CREATE, ALTER, DROP           │
├──────────┼──────────────────────┼──────────────────────────────┤
│ DML      │ Data Manipulation    │ 操作数据（增删改）            │
│          │ Language             │ INSERT, UPDATE, DELETE        │
├──────────┼──────────────────────┼──────────────────────────────┤
│ DQL      │ Data Query Language  │ 查询数据                      │
│          │                      │ SELECT                        │
├──────────┼──────────────────────┼──────────────────────────────┤
│ DCL      │ Data Control Language│ 控制权限                      │
│          │                      │ GRANT, REVOKE                 │
└──────────┴──────────────────────┴──────────────────────────────┘
```

---

## 二、DDL：定义数据库结构

### 2.1 数据类型

PostgreSQL 常用数据类型：

```
┌──────────────┬────────────────────────┬──────────────────────────┐
│ 类型          │ 说明                   │ 示例                      │
├──────────────┼────────────────────────┼──────────────────────────┤
│ INTEGER      │ 整数                   │ 42, -1, 0                │
│ BIGINT       │ 大整数                 │ 9999999999               │
│ SERIAL       │ 自增整数（自动生成）   │ 1, 2, 3, 4 ...           │
│ VARCHAR(n)   │ 变长字符串（最大n字符）│ 'hello'                  │
│ TEXT         │ 不限长度的字符串       │ '很长很长的文章内容...'   │
│ BOOLEAN      │ 布尔值                 │ TRUE, FALSE              │
│ TIMESTAMP    │ 日期时间               │ '2024-01-15 10:30:00'    │
│ DATE         │ 日期                   │ '2024-01-15'             │
│ JSON         │ JSON 数据              │ '{"key": "value"}'       │
│ DECIMAL      │ 精确小数               │ 99.99                    │
│ UUID         │ UUID 字符串            │ '550e8400-e29b-41d4...'  │
└──────────────┴────────────────────────┴──────────────────────────┘
```

### 2.2 CREATE TABLE 详解

```sql
-- 语法结构
CREATE TABLE 表名 (
    列名1 数据类型 约束,
    列名2 数据类型 约束,
    列名3 数据类型 约束,
    ...
);
```

创建用户表：

```sql
-- 创建用户表
CREATE TABLE users (
    id         SERIAL PRIMARY KEY,              -- 自增主键
    username   VARCHAR(50) NOT NULL UNIQUE,     -- 用户名，不能为空，不能重复
    email      VARCHAR(100) NOT NULL UNIQUE,    -- 邮箱，不能为空，不能重复
    password   VARCHAR(255) NOT NULL,           -- 密码，不能为空
    avatar     VARCHAR(500),                    -- 头像 URL，可以为空
    bio        TEXT,                             -- 个人简介，可以为空
    role       VARCHAR(20) DEFAULT 'USER',      -- 角色，默认为 USER
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 创建时间，默认当前时间
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP   -- 更新时间，默认当前时间
);
```

### 2.3 约束详解

约束（Constraint）是数据库用来保证数据完整性的规则：

```sql
-- PRIMARY KEY：主键约束
-- 唯一标识每一行，自动创建索引
id SERIAL PRIMARY KEY

-- NOT NULL：非空约束
-- 该列不能为空
username VARCHAR(50) NOT NULL

-- UNIQUE：唯一约束
-- 该列的值不能重复
email VARCHAR(100) UNIQUE

-- DEFAULT：默认值
-- 插入时如果不指定，使用默认值
role VARCHAR(20) DEFAULT 'USER'
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- CHECK：检查约束
-- 值必须满足某个条件
age INTEGER CHECK (age >= 0 AND age <= 150)
price DECIMAL CHECK (price > 0)

-- FOREIGN KEY：外键约束
-- 值必须在关联表中存在
author_id INTEGER REFERENCES users(id)
```

创建文章表（带外键）：

```sql
-- 创建分类表
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- 创建文章表
CREATE TABLE posts (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(200) NOT NULL,
    content      TEXT NOT NULL,
    slug         VARCHAR(200) NOT NULL UNIQUE,
    status       VARCHAR(20) DEFAULT 'DRAFT',  -- DRAFT 或 PUBLISHED
    author_id    INTEGER NOT NULL REFERENCES users(id),      -- 外键：关联用户
    category_id  INTEGER REFERENCES categories(id),          -- 外键：关联分类（可为空）
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP                              -- 发布时间
);
```

---

## 三、DML：操作数据

### 3.1 INSERT INTO（插入数据）

```sql
-- 插入单条数据
INSERT INTO users (username, email, password, bio)
VALUES ('zhangsan', 'zhang@test.com', 'hashed_password_123', '大家好，我是张三');

-- 插入时指定所有列（除了有默认值的列）
INSERT INTO users (username, email, password, avatar, bio, role)
VALUES ('lisi', 'lisi@test.com', 'hashed_password_456', 'https://example.com/avatar.jpg', '前端开发者', 'ADMIN');

-- 批量插入
INSERT INTO users (username, email, password) VALUES
('wangwu', 'wang@test.com', 'hashed_pass_789'),
('zhaoliu', 'zhao@test.com', 'hashed_pass_abc'),
('sunqi', 'sun@test.com', 'hashed_pass_def');

-- 插入分类数据
INSERT INTO categories (name, slug, description) VALUES
('前端开发', 'frontend', 'HTML/CSS/JavaScript 相关'),
('后端开发', 'backend', 'Node.js/Python/Java 相关'),
('数据库', 'database', 'SQL/NoSQL 相关'),
('DevOps', 'devops', '部署/运维/CI-CD 相关');

-- 插入文章数据
INSERT INTO posts (title, content, slug, status, author_id, category_id, published_at)
VALUES (
    'TypeScript 入门指南',
    'TypeScript 是 JavaScript 的超集...',
    'typescript-intro',
    'PUBLISHED',
    1,   -- author_id = 1（张三）
    1,   -- category_id = 1（前端开发）
    CURRENT_TIMESTAMP
);
```

> **注意：** 在 SQL 中，字符串用**单引号** `' '` 包裹，不是双引号。

### 3.2 SELECT 查询（重点！）

SELECT 是最常用的 SQL 语句，用于从数据库中查询数据。

```sql
-- 查询所有列
SELECT * FROM users;

-- 查询指定列
SELECT username, email FROM users;

-- 条件查询（WHERE）
SELECT * FROM users WHERE role = 'ADMIN';

-- 多条件查询
SELECT * FROM users
WHERE role = 'ADMIN' AND created_at > '2024-01-01';

SELECT * FROM users
WHERE role = 'ADMIN' OR role = 'MODERATOR';

-- 比较运算符
SELECT * FROM posts WHERE id > 5;
SELECT * FROM posts WHERE id >= 10;
SELECT * FROM posts WHERE id < 100;
SELECT * FROM posts WHERE id <= 50;
SELECT * FROM posts WHERE id <> 1;    -- 不等于

-- IN 操作符（匹配多个值）
SELECT * FROM posts WHERE status IN ('DRAFT', 'PUBLISHED');

-- BETWEEN（范围查询）
SELECT * FROM posts
WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';

-- LIKE（模糊查询）
-- % 匹配任意多个字符，_ 匹配一个字符
SELECT * FROM posts WHERE title LIKE '%TypeScript%';   -- 标题包含 TypeScript
SELECT * FROM posts WHERE title LIKE 'Type%';          -- 标题以 Type 开头
SELECT * FROM posts WHERE title LIKE '%入门';          -- 标题以 入门 结尾

-- IS NULL / IS NOT NULL
SELECT * FROM posts WHERE category_id IS NULL;
SELECT * FROM users WHERE avatar IS NOT NULL;

-- NOT（取反）
SELECT * FROM posts WHERE status != 'DRAFT';
SELECT * FROM posts WHERE NOT status = 'DRAFT';
```

### 3.3 ORDER BY（排序）

```sql
-- 按创建时间降序（最新的在前）
SELECT * FROM posts ORDER BY created_at DESC;

-- 按创建时间升序（最旧的在前）
SELECT * FROM posts ORDER BY created_at ASC;

-- 多字段排序（先按状态排序，再按创建时间排序）
SELECT * FROM posts ORDER BY status ASC, created_at DESC;

-- 按多个条件排序
SELECT * FROM posts
WHERE status = 'PUBLISHED'
ORDER BY published_at DESC, title ASC;
```

### 3.4 LIMIT 和 OFFSET（分页）

```sql
-- LIMIT：限制返回的记录数
SELECT * FROM posts LIMIT 10;  -- 只返回前 10 条

-- OFFSET：跳过前面的记录
SELECT * FROM posts LIMIT 10 OFFSET 0;   -- 第 1 页（跳过 0 条，取 10 条）
SELECT * FROM posts LIMIT 10 OFFSET 10;  -- 第 2 页（跳过 10 条，取 10 条）
SELECT * FROM posts LIMIT 10 OFFSET 20;  -- 第 3 页（跳过 20 条，取 10 条）

-- 通用公式：LIMIT pageSize OFFSET (page - 1) * pageSize
-- 第 1 页：LIMIT 10 OFFSET 0
-- 第 2 页：LIMIT 10 OFFSET 10
-- 第 3 页：LIMIT 10 OFFSET 20
```

### 3.5 UPDATE（更新数据）

```sql
-- 更新单条记录
UPDATE users
SET bio = '全栈开发者，热爱编程'
WHERE id = 1;

-- 更新多个字段
UPDATE posts
SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP
WHERE id = 3;

-- 批量更新
UPDATE posts
SET status = 'ARCHIVED'
WHERE created_at < '2023-01-01';

-- 使用表达式更新
UPDATE posts
SET title = CONCAT(title, ' [已归档]')
WHERE status = 'ARCHIVED';
```

### 3.6 DELETE（删除数据）

```sql
-- 删除单条记录
DELETE FROM posts WHERE id = 5;

-- 删除满足条件的记录
DELETE FROM posts WHERE status = 'DRAFT' AND created_at < '2023-01-01';

-- 删除所有记录（危险操作！）
DELETE FROM posts;  -- 清空表，但保留表结构

-- 删除表（更危险！）
DROP TABLE posts;  -- 删除表和所有数据
```

> **警告：** DELETE 不带 WHERE 条件会删除所有数据！执行删除操作前一定要确认 WHERE 条件。

---

## 四、聚合函数与 GROUP BY

### 4.1 聚合函数

聚合函数对一组值进行计算，返回单个值：

```sql
-- COUNT：计数
SELECT COUNT(*) FROM posts;                    -- 总文章数
SELECT COUNT(*) FROM posts WHERE status = 'PUBLISHED';  -- 已发布文章数

-- SUM：求和
SELECT SUM(view_count) FROM posts;             -- 总浏览量

-- AVG：平均值
SELECT AVG(view_count) FROM posts;             -- 平均浏览量

-- MAX / MIN：最大/最小值
SELECT MAX(view_count) FROM posts;             -- 最高浏览量
SELECT MIN(view_count) FROM posts;             -- 最低浏览量

-- 组合使用
SELECT
    COUNT(*) AS total_posts,
    SUM(view_count) AS total_views,
    AVG(view_count) AS avg_views,
    MAX(view_count) AS max_views,
    MIN(view_count) AS min_views
FROM posts;
```

### 4.2 GROUP BY（分组查询）

```sql
-- 按状态分组，统计每种状态的文章数
SELECT status, COUNT(*) AS count
FROM posts
GROUP BY status;

-- 结果示例：
-- status    | count
-- ----------+------
-- DRAFT     | 5
-- PUBLISHED | 12
-- ARCHIVED  | 3

-- 按作者分组，统计每个作者的文章数
SELECT author_id, COUNT(*) AS post_count
FROM posts
GROUP BY author_id
ORDER BY post_count DESC;

-- 按分类分组，统计每个分类的平均浏览量
SELECT category_id, AVG(view_count) AS avg_views
FROM posts
WHERE status = 'PUBLISHED'
GROUP BY category_id
HAVING AVG(view_count) > 100;  -- HAVING：过滤分组结果
```

> **WHERE vs HAVING：**
> - `WHERE`：在分组**之前**过滤行
> - `HAVING`：在分组**之后**过滤组

```
执行顺序：
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT

1. FROM posts          -- 从表中取数据
2. WHERE status = ...  -- 先过滤
3. GROUP BY author_id  -- 再分组
4. HAVING COUNT(*) > 5 -- 过滤分组
5. SELECT ...          -- 选择列
6. ORDER BY ...        -- 排序
7. LIMIT ...           -- 分页
```

---

## 五、JOIN 查询（关联查询）

### 5.1 为什么需要 JOIN

当我们需要从多张表中获取关联数据时，就需要 JOIN。

```
需求：查询文章及其作者信息

posts 表：
┌────┬──────────────┬─────────┐
│ id │ title        │ user_id │
├────┼──────────────┼─────────┤
│ 1  │ TS入门       │ 1       │
│ 2  │ React实践    │ 2       │
└────┴──────────────┴─────────┘

users 表：
┌────┬──────────┐
│ id │ username │
├────┼──────────┤
│ 1  │ zhangsan │
│ 2  │ lisi     │
└────┴──────────┘

期望结果：
┌────┬──────────────┬──────────┐
│ id │ title        │ username │
├────┼──────────────┼──────────┤
│ 1  │ TS入门       │ zhangsan │
│ 2  │ React实践    │ lisi     │
└────┴──────────────┴──────────┘
```

### 5.2 INNER JOIN（内连接）

只返回两表中都匹配的记录：

```sql
-- INNER JOIN：只返回匹配的记录
SELECT posts.id, posts.title, users.username
FROM posts
INNER JOIN users ON posts.author_id = users.id;

-- 图解：
-- posts         users
-- ┌────┐        ┌────┐
-- │ 1  │────────│ 1  │  ← 匹配，返回
-- │ 2  │────────│ 2  │  ← 匹配，返回
-- │ 3  │        └────┘  ← 无匹配，不返回
-- └────┘
```

### 5.3 LEFT JOIN（左连接）

返回左表的所有记录，即使右表没有匹配：

```sql
-- LEFT JOIN：返回左表的所有记录
SELECT posts.id, posts.title, users.username
FROM posts
LEFT JOIN users ON posts.author_id = users.id;

-- 图解：
-- posts         users
-- ┌────┐        ┌────┐
-- │ 1  │────────│ 1  │  ← 匹配，返回 (1, TS入门, zhangsan)
-- │ 2  │────────│ 2  │  ← 匹配，返回 (2, React, lisi)
-- │ 3  │        └────┘  ← 无匹配，仍返回 (3, Node教程, NULL)
-- └────┘

-- 常用场景：查询所有文章，包括没有分类的文章
SELECT posts.title, categories.name
FROM posts
LEFT JOIN categories ON posts.category_id = categories.id;
```

### 5.4 RIGHT JOIN（右连接）

返回右表的所有记录，即使左表没有匹配：

```sql
-- RIGHT JOIN：返回右表的所有记录
SELECT posts.title, categories.name
FROM posts
RIGHT JOIN categories ON posts.category_id = categories.id;

-- 图解：
-- posts         categories
-- ┌────┐        ┌────┐
-- │ 1  │────────│ 1  │  ← 匹配，返回
-- │ 2  │        │ 2  │  ← 无匹配，仍返回 (NULL, DevOps)
-- └────┘        └────┘
```

### 5.5 三种 JOIN 对比

```
┌─────────────┬──────────────────────────────────────────────┐
│ JOIN 类型    │ 说明                                          │
├─────────────┼──────────────────────────────────────────────┤
│ INNER JOIN  │ 只返回两表都匹配的记录（交集）                │
│ LEFT JOIN   │ 返回左表所有记录 + 右表匹配的记录             │
│ RIGHT JOIN  │ 返回右表所有记录 + 左表匹配的记录             │
│ FULL JOIN   │ 返回两表所有记录（较少使用）                  │
└─────────────┴──────────────────────────────────────────────┘

图示：
  A INNER JOIN B    A LEFT JOIN B     A RIGHT JOIN B    A FULL JOIN B
    ┌───┬───┐        ┌───┬───┐         ┌───┬───┐        ┌───┬───┐
    │   │///│        │///│///│         │   │///│        │///│///│
    │   │///│        │///│///│         │   │///│        │///│///│
    ├───┼───┤        ├───┼───┤         ├───┼───┤        ├───┼───┤
    │   │///│        │///│///│         │   │///│        │///│///│
    └───┴───┘        └───┴───┘         └───┴───┘        └───┴───┘
     只有交集          A 全部 + 交集     B 全部 + 交集     A 和 B 全部
```

### 5.6 多表 JOIN

```sql
-- 查询文章、作者、分类（三表关联）
SELECT
    posts.title,
    posts.status,
    users.username AS author_name,
    categories.name AS category_name,
    posts.created_at
FROM posts
INNER JOIN users ON posts.author_id = users.id
LEFT JOIN categories ON posts.category_id = categories.id
WHERE posts.status = 'PUBLISHED'
ORDER BY posts.created_at DESC
LIMIT 10;
```

### 5.7 表别名

```sql
-- 使用别名简化查询
SELECT
    p.title,
    p.status,
    u.username AS author,
    c.name AS category
FROM posts p
INNER JOIN users u ON p.author_id = u.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.status = 'PUBLISHED'
ORDER BY p.created_at DESC;
```

---

## 六、子查询（嵌套查询）

子查询是嵌套在其他查询中的查询：

```sql
-- 子查询作为条件
-- 查询发布了文章的用户
SELECT * FROM users
WHERE id IN (
    SELECT DISTINCT author_id FROM posts WHERE status = 'PUBLISHED'
);

-- 子查询作为派生表
-- 查询每个作者的最新文章
SELECT u.username, latest_posts.title, latest_posts.created_at
FROM users u
INNER JOIN (
    SELECT author_id, title, created_at,
           ROW_NUMBER() OVER (PARTITION BY author_id ORDER BY created_at DESC) AS rn
    FROM posts
) latest_posts ON u.id = latest_posts.author_id AND latest_posts.rn = 1;

-- EXISTS 子查询
-- 查询有评论的文章
SELECT * FROM posts p
WHERE EXISTS (
    SELECT 1 FROM comments c WHERE c.post_id = p.id
);
```

---

## 七、实操：创建博客数据库表并执行 CRUD

### 7.1 完整建表语句

```sql
-- ========================================
-- 博客平台数据库表结构
-- ========================================

-- 1. 用户表
CREATE TABLE users (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(50) NOT NULL UNIQUE,
    email      VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    avatar     VARCHAR(500),
    bio        TEXT,
    role       VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'MODERATOR')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 分类表
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- 3. 标签表
CREATE TABLE tags (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
);

-- 4. 文章表
CREATE TABLE posts (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(200) NOT NULL,
    content      TEXT NOT NULL,
    slug         VARCHAR(200) NOT NULL UNIQUE,
    status       VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
    view_count   INTEGER DEFAULT 0,
    author_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);

-- 5. 文章-标签关联表（多对多）
CREATE TABLE post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)  -- 联合主键，防止重复关联
);

-- 6. 评论表
CREATE TABLE comments (
    id         SERIAL PRIMARY KEY,
    content    TEXT NOT NULL,
    author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,  -- 自引用，支持回复
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引（加速查询）
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_category_id ON posts(category_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);
```

### 7.2 插入测试数据

```sql
-- 插入用户
INSERT INTO users (username, email, password, bio, role) VALUES
('zhangsan', 'zhang@test.com', 'hashed_pass_1', '全栈开发者', 'ADMIN'),
('lisi', 'lisi@test.com', 'hashed_pass_2', '前端工程师', 'USER'),
('wangwu', 'wang@test.com', 'hashed_pass_3', '后端架构师', 'USER'),
('zhaoliu', 'zhao@test.com', 'hashed_pass_4', 'UI设计师', 'MODERATOR');

-- 插入分类
INSERT INTO categories (name, slug, description) VALUES
('前端开发', 'frontend', 'HTML/CSS/JavaScript/TypeScript 相关技术'),
('后端开发', 'backend', 'Node.js/Express/数据库 相关技术'),
('DevOps', 'devops', '部署、运维、CI/CD 相关技术'),
('职业发展', 'career', '程序员成长与职业规划');

-- 插入标签
INSERT INTO tags (name, slug) VALUES
('TypeScript', 'typescript'),
('React', 'react'),
('Node.js', 'nodejs'),
('PostgreSQL', 'postgresql'),
('Express', 'express'),
('JavaScript', 'javascript'),
('CSS', 'css'),
('Git', 'git');

-- 插入文章
INSERT INTO posts (title, content, slug, status, author_id, category_id, published_at) VALUES
('TypeScript 入门完全指南', 'TypeScript 是 JavaScript 的超集...', 'typescript-intro', 'PUBLISHED', 1, 1, '2024-01-15 10:00:00'),
('React Hooks 最佳实践', 'React Hooks 改变了我们写组件的方式...', 'react-hooks-best-practices', 'PUBLISHED', 2, 1, '2024-02-20 14:00:00'),
('Node.js 性能优化技巧', '本文介绍 10 个 Node.js 性能优化技巧...', 'nodejs-performance-tips', 'PUBLISHED', 3, 2, '2024-03-10 09:00:00'),
('Express 中间件详解', '中间件是 Express 的核心概念...', 'express-middleware', 'DRAFT', 1, 2, NULL),
('CSS Grid 布局实战', 'CSS Grid 是强大的布局工具...', 'css-grid-layout', 'PUBLISHED', 4, 1, '2024-03-15 16:00:00'),
('Git 工作流最佳实践', '本文介绍几种常见的 Git 工作流...', 'git-workflow', 'DRAFT', 2, 3, NULL);

-- 插入文章-标签关联
INSERT INTO post_tags (post_id, tag_id) VALUES
(1, 1), (1, 6),          -- TypeScript文章: TypeScript, JavaScript
(2, 2), (2, 6),          -- React文章: React, JavaScript
(3, 3), (3, 5),          -- Node.js文章: Node.js, Express
(4, 3), (4, 5),          -- Express文章: Node.js, Express
(5, 7),                  -- CSS文章: CSS
(6, 8);                  -- Git文章: Git

-- 插入评论
INSERT INTO comments (content, author_id, post_id, parent_id) VALUES
('写得很好，收藏了！', 2, 1, NULL),
('感谢分享，对我帮助很大', 3, 1, NULL),
('能详细讲讲泛型吗？', 4, 1, NULL),
('好的，后续会专门写一篇泛型的文章', 1, 1, 3),  -- 回复第3条评论
('React Hooks 确实很方便', 1, 2, NULL),
('Node.js 性能优化很实用', 2, 3, NULL);
```

### 7.3 查询练习

```sql
-- 练习1：查询所有已发布的文章及其作者
SELECT
    p.id,
    p.title,
    p.status,
    u.username AS author,
    p.published_at
FROM posts p
INNER JOIN users u ON p.author_id = u.id
WHERE p.status = 'PUBLISHED'
ORDER BY p.published_at DESC;

-- 练习2：查询每个分类的文章数量
SELECT
    c.name AS category,
    COUNT(p.id) AS post_count
FROM categories c
LEFT JOIN posts p ON c.id = p.category_id
GROUP BY c.id, c.name
ORDER BY post_count DESC;

-- 练习3：查询每个作者的文章数量（只显示写了2篇以上的）
SELECT
    u.username,
    COUNT(p.id) AS post_count
FROM users u
INNER JOIN posts p ON u.id = p.author_id
GROUP BY u.id, u.username
HAVING COUNT(p.id) >= 2
ORDER BY post_count DESC;

-- 练习4：查询文章及其标签（多对多查询）
SELECT
    p.title,
    STRING_AGG(t.name, ', ') AS tags  -- 将多个标签合并为一个字符串
FROM posts p
INNER JOIN post_tags pt ON p.id = pt.post_id
INNER JOIN tags t ON pt.tag_id = t.id
GROUP BY p.id, p.title;

-- 练习5：查询某篇文章的所有评论（包括回复关系）
SELECT
    c.id,
    c.content,
    u.username AS author,
    c.parent_id,
    c.created_at
FROM comments c
INNER JOIN users u ON c.author_id = u.id
WHERE c.post_id = 1
ORDER BY c.created_at ASC;

-- 练习6：查询没有评论的文章
SELECT p.id, p.title
FROM posts p
WHERE NOT EXISTS (
    SELECT 1 FROM comments c WHERE c.post_id = p.id
);

-- 练习7：查询每个标签被使用的次数
SELECT
    t.name AS tag,
    COUNT(pt.post_id) AS usage_count
FROM tags t
LEFT JOIN post_tags pt ON t.id = pt.tag_id
GROUP BY t.id, t.name
ORDER BY usage_count DESC;

-- 练习8：分页查询文章（第1页，每页3条）
SELECT
    p.id,
    p.title,
    p.status,
    u.username AS author
FROM posts p
INNER JOIN users u ON p.author_id = u.id
ORDER BY p.created_at DESC
LIMIT 3 OFFSET 0;

-- 练习9：分页查询文章（第2页，每页3条）
SELECT
    p.id,
    p.title,
    p.status,
    u.username AS author
FROM posts p
INNER JOIN users u ON p.author_id = u.id
ORDER BY p.created_at DESC
LIMIT 3 OFFSET 3;

-- 练习10：更新文章状态
UPDATE posts
SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
WHERE id = 4;

-- 练习11：删除某篇文章的评论
DELETE FROM comments WHERE post_id = 6;

-- 练习12：删除文章（会级联删除关联的评论和标签关系）
DELETE FROM posts WHERE id = 6;
```

---

## 八、SQL 速查表

```
┌─────────────────────────────────────────────────────────────┐
│                    SQL 速查表                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DDL（定义结构）                                             │
│  ├── CREATE TABLE 表名 (列定义...)                          │
│  ├── ALTER TABLE 表名 ADD 列名 类型                         │
│  └── DROP TABLE 表名                                        │
│                                                             │
│  DML（操作数据）                                             │
│  ├── INSERT INTO 表名 (列...) VALUES (值...)                │
│  ├── UPDATE 表名 SET 列=值 WHERE 条件                       │
│  └── DELETE FROM 表名 WHERE 条件                            │
│                                                             │
│  DQL（查询数据）                                             │
│  ├── SELECT 列 FROM 表                                      │
│  ├── WHERE 条件                                             │
│  ├── ORDER BY 列 ASC/DESC                                   │
│  ├── LIMIT n OFFSET m                                       │
│  ├── JOIN 表 ON 条件                                        │
│  ├── GROUP BY 列                                            │
│  ├── HAVING 条件                                            │
│  └── 聚合函数: COUNT, SUM, AVG, MAX, MIN                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 常见误区

1. **DELETE 不带 WHERE 条件**：`DELETE FROM posts` 会删除表中的所有数据！每次执行删除操作前，务必确认 WHERE 条件是否正确。建议先用 `SELECT` 验证条件，再执行 DELETE。
2. **用双引号包裹字符串**：SQL 标准中字符串用单引号（`'hello'`），双引号用于标识符（表名、列名）。`WHERE name = "张三"` 在某些数据库中会报错。
3. **混淆 WHERE 和 HAVING**：WHERE 在分组之前过滤行，HAVING 在分组之后过滤组。`WHERE COUNT(*) > 5` 是语法错误，应该用 `HAVING COUNT(*) > 5`。
4. **忘记 GROUP BY 的列必须出现在 SELECT 中**：使用 GROUP BY 时，SELECT 中的非聚合字段必须出现在 GROUP BY 子句中，否则结果不确定。

## 工程建议

1. **先用 SELECT 验证再执行 UPDATE/DELETE**：在修改或删除数据前，先用相同的 WHERE 条件执行 SELECT，确认影响的行数和内容是否符合预期。
2. **使用参数化查询防止 SQL 注入**：不要用字符串拼接 SQL（`WHERE id = ${id}`），使用参数化查询（`WHERE id = $1`）可以防止 SQL 注入攻击。
3. **为常用查询字段创建索引**：WHERE、ORDER BY、JOIN 中频繁使用的字段应该创建索引，查询性能可以提升几十甚至几百倍。
4. **用 EXPLAIN 分析查询计划**：PostgreSQL 的 `EXPLAIN ANALYZE` 可以显示查询的执行计划和耗时，帮你发现全表扫描等性能问题。

## 九、小结

```
本课要点回顾：
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. SQL 是操作关系型数据库的标准语言                      │
│                                                         │
│  2. SQL 分为四类：                                       │
│     - DDL：CREATE TABLE 等定义结构                       │
│     - DML：INSERT / UPDATE / DELETE 操作数据             │
│     - DQL：SELECT 查询数据                               │
│     - DCL：GRANT / REVOKE 控制权限                       │
│                                                         │
│  3. 创建表时需要选择合适的数据类型和约束                  │
│     - PRIMARY KEY：主键                                  │
│     - NOT NULL：非空                                     │
│     - UNIQUE：唯一                                       │
│     - DEFAULT：默认值                                    │
│     - FOREIGN KEY：外键                                  │
│                                                         │
│  4. SELECT 是最常用的语句                                │
│     - WHERE 过滤 → ORDER BY 排序 → LIMIT/OFFSET 分页    │
│                                                         │
│  5. 聚合函数 + GROUP BY 用于数据统计                     │
│                                                         │
│  6. JOIN 用于多表关联查询                                │
│     - INNER JOIN：只返回匹配的记录                       │
│     - LEFT JOIN：返回左表所有记录                        │
│                                                         │
│  7. 子查询是嵌套在其他查询中的查询                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 下一课预告

下一课我们将学习 **PostgreSQL 安装与使用**——在你的电脑上搭建真实的数据库环境，用 pgAdmin 图形界面和 psql 命令行工具来操作数据库。

---

> **学习建议：** SQL 是后端开发的基础技能，建议多练习。可以在 [SQLBolt](https://sqlbolt.com/) 或 [LeetCode SQL](https://leetcode.cn/problemset/database/) 上做在线练习。
