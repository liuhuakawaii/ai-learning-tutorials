# 第三课：PostgreSQL 安装与使用

> **课程定位：** 第二阶段 · 数据库 · 第 3 课时
> **前置知识：** SQL 入门（第二课）
> **预计时长：** 60 分钟

---

## 学习目标

完成本课后，你将能够：

1. 理解为什么选择 PostgreSQL
2. 在 Windows 上安装 PostgreSQL
3. 使用 pgAdmin 图形界面管理数据库
4. 使用 psql 命令行工具执行 SQL
5. 创建数据库、用户并设置权限
6. 理解连接字符串的格式
7. 掌握数据库管理基础操作

---

## 一、为什么选 PostgreSQL

### 1.1 主流关系型数据库对比

```
┌──────────────┬────────────────┬────────────────┬────────────────┐
│ 特性          │ PostgreSQL     │ MySQL          │ SQLite         │
├──────────────┼────────────────┼────────────────┼────────────────┤
│ 定位          │ 企业级全能型   │ Web 应用主流   │ 嵌入式轻量级   │
│ 性能          │ 复杂查询很强   │ 简单查询很快   │ 单机够用       │
│ 功能          │ 最丰富         │ 够用           │ 基础           │
│ JSON 支持     │ 原生且强大     │ 基础支持       │ 有限           │
│ 扩展性        │ 非常强         │ 较好           │ 有限           │
│ 全文搜索      │ 内置支持       │ 需要插件       │ 有限           │
│ 地理数据      │ PostGIS 扩展   │ 基础支持       │ 不支持         │
│ 适用场景      │ 复杂应用       │ Web 应用       │ 移动端/测试    │
│ 学习曲线      │ 中等           │ 较低           │ 低             │
└──────────────┴────────────────┴────────────────┴────────────────┘
```

### 1.2 选择 PostgreSQL 的理由

```
为什么本课程选择 PostgreSQL：
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. 功能最强大                                               │
│     - 原生 JSON/JSONB 支持（前端开发者很熟悉 JSON）          │
│     - 丰富的数据类型（数组、范围、自定义类型）               │
│     - 强大的索引类型（B-tree, Hash, GiST, GIN 等）          │
│                                                             │
│  2. Prisma 完美支持                                          │
│     - Prisma 对 PostgreSQL 的支持最好                        │
│     - 自动生成的客户端类型最完整                             │
│                                                             │
│  3. 行业趋势                                                 │
│     - 越来越多的公司从 MySQL 迁移到 PostgreSQL               │
│     - Stack Overflow 调查：最受喜爱的数据库                  │
│     - Supabase、Neon 等新兴平台都基于 PostgreSQL             │
│                                                             │
│  4. 免费开源                                                  │
│     - 完全免费，没有商业限制                                 │
│     - 社区活跃，文档完善                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、Windows 安装 PostgreSQL

### 2.1 下载安装包

1. 访问 PostgreSQL 官网：https://www.postgresql.org/download/windows/
2. 点击 "Download the installer"
3. 选择最新版本（推荐 16.x 或 15.x）
4. 下载 Windows x86-64 安装包

### 2.2 安装步骤

```
安装向导步骤：

Step 1: 欢迎界面
  └── 点击 Next

Step 2: 选择安装目录
  └── 默认即可: C:\Program Files\PostgreSQL\16

Step 3: 选择组件
  └── ✅ PostgreSQL Server     （核心组件，必选）
      ✅ pgAdmin 4             （图形界面，必选）
      ✅ Stack Builder          （扩展管理，可选）
      ✅ Command Line Tools     （psql 命令行，必选）

Step 4: 数据目录
  └── 默认即可: C:\Program Files\PostgreSQL\16\data

Step 5: 设置密码 ⭐ 重要！
  └── 输入 postgres 超级用户的密码
      建议: postgres123（学习环境用简单密码）
      ⚠️ 请记住这个密码！

Step 6: 端口
  └── 默认: 5432（不要修改）

Step 7: 区域设置
  └── 默认: Default locale

Step 8: 安装
  └── 点击 Next → Install → Finish
```

### 2.3 验证安装

安装完成后，打开命令提示符（CMD）或 PowerShell：

```bash
# 检查 psql 是否可用
psql --version

# 输出示例：
# psql (PostgreSQL) 16.2
```

如果提示找不到命令，需要将 PostgreSQL 的 bin 目录添加到 PATH 环境变量：

```
添加 PATH 环境变量：

1. 右键"此电脑" → 属性 → 高级系统设置
2. 点击"环境变量"
3. 在"系统变量"中找到 Path，点击"编辑"
4. 点击"新建"，添加：
   C:\Program Files\PostgreSQL\16\bin
5. 确定 → 确定 → 确定
6. 重新打开命令提示符
```

---

## 三、pgAdmin 图形界面使用

### 3.1 启动 pgAdmin

```
启动方式：
  开始菜单 → pgAdmin 4

首次启动：
  1. pgAdmin 会在浏览器中打开（它是一个 Web 应用）
  2. 设置主密码（Master Password）
  3. 左侧会自动显示 PostgreSQL 16 服务器
  4. 右键点击服务器 → Connect → 输入安装时设置的密码
```

### 3.2 pgAdmin 基本操作

```
pgAdmin 界面布局：
┌─────────────────────────────────────────────────────────────┐
│  菜单栏                                                      │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  对象浏览器  │              查询工具 / 数据查看              │
│  (左侧)      │              (右侧主区域)                     │
│              │                                              │
│  📁 Servers  │  ┌────────────────────────────────────────┐  │
│   └─ 📁 Post │  │  SQL 编辑器 / 数据表格 / 属性面板      │  │
│      └─ 📁 D │  │                                        │  │
│         └─ 📁│  │                                        │  │
│            ├─│  │                                        │  │
│            ├─│  │                                        │  │
│            └─│  └────────────────────────────────────────┘  │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│  状态栏                                                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 常用操作

```
创建数据库：
  1. 右键 Databases → Create → Database
  2. 输入数据库名称：blog_db
  3. 点击 Save

查看表结构：
  1. 展开数据库 → Schemas → public → Tables
  2. 右键表 → Properties 可查看/修改结构

执行 SQL：
  1. 右键数据库 → Query Tool
  2. 在编辑器中输入 SQL 语句
  3. 点击执行按钮（▶）或按 F5

查看数据：
  1. 右键表 → View/Edit Data → All Rows
  2. 可以直接在表格中编辑数据
```

---

## 四、psql 命令行工具

**psql** 是 PostgreSQL 自带的命令行客户端，功能强大，是后端开发者的常用工具。

### 4.1 连接数据库

```bash
# 基本连接
psql -U postgres

# 指定主机和端口（本地默认可以省略）
psql -U postgres -h localhost -p 5432

# 连接到指定数据库
psql -U postgres -d blog_db

# 完整的连接命令
psql -U postgres -h localhost -p 5432 -d blog_db
```

连接成功后会看到：

```
psql (16.2)
WARNING: Console code page (936) differs from Windows code page (1252)
         8-bit characters might not work correctly. See psql reference
         page "Notes for Windows users" for details.
Type "help" for help.

postgres=#
```

### 4.2 psql 常用元命令

元命令以 `\` 开头，是 psql 特有的命令：

```
┌──────────────┬────────────────────────────────────────────┐
│ 命令          │ 说明                                        │
├──────────────┼────────────────────────────────────────────┤
│ \l           │ 列出所有数据库                               │
│ \c dbname    │ 切换到指定数据库                             │
│ \dt          │ 列出当前数据库的所有表                       │
│ \d tablename │ 查看表结构                                   │
│ \du          │ 列出所有用户                                 │
│ \dn          │ 列出所有 schema                              │
│ \di          │ 列出所有索引                                 │
│ \dv          │ 列出所有视图                                 │
│ \df          │ 列出所有函数                                 │
│ \x           │ 切换扩展显示模式（适合宽表）                 │
│ \timing      │ 开启/关闭查询计时                            │
│ \q           │ 退出 psql                                    │
│ \?           │ 显示所有元命令的帮助                         │
│ \h           │ 显示 SQL 命令的帮助                          │
│ \i filename  │ 执行 SQL 文件                                │
│ \conninfo    │ 显示当前连接信息                             │
└──────────────┴────────────────────────────────────────────┘
```

### 4.3 psql 实操演示

```sql
-- 连接到 PostgreSQL
-- $ psql -U postgres

-- 查看所有数据库
postgres=# \l
-- 输出：
--                                  List of databases
--    Name    |  Owner   | Encoding |          Collate           |    Ctype
-- ----------+----------+----------+----------------------------+------------
--  postgres  | postgres | UTF8     | Chinese (Simplified)_China | UTF8
--  template0 | postgres | UTF8     | Chinese (Simplified)_China | UTF8
--  template1 | postgres | UTF8     | Chinese (Simplified)_China | UTF8

-- 创建数据库
postgres=# CREATE DATABASE blog_db;
-- 输出：CREATE DATABASE

-- 切换到 blog_db
postgres=# \c blog_db
-- 输出：You are now connected to database "blog_db" as user "postgres".

-- 查看当前数据库中的表
blog_db=# \dt
-- 输出：Did not find any relations.

-- 执行 SQL 文件（后面会创建）
blog_db=# \i /path/to/schema.sql

-- 查看表结构
blog_db=# \d users
-- 输出：
--                 Table "public.users"
--    Column   |          Type          | Modifiers
-- ----------+------------------------+---------------------------
--  id        | integer                | not null default nextval(...)
--  username  | character varying(50)  | not null
--  email     | character varying(100) | not null
--  ...

-- 开启计时
blog_db=# \timing
-- 输出：Timing is on.

-- 执行查询并查看耗时
blog_db=# SELECT COUNT(*) FROM posts;
--  count
-- -------
--      6
-- (1 row)
-- Time: 2.345 ms

-- 退出
blog_db=# \q
```

---

## 五、创建数据库和用户

### 5.1 创建数据库

```sql
-- 创建数据库
CREATE DATABASE blog_db;

-- 指定编码创建（推荐）
CREATE DATABASE blog_db
    WITH ENCODING 'UTF8'
    LC_COLLATE 'Chinese (Simplified)_China.936'
    LC_CTYPE 'Chinese (Simplified)_China.936'
    TEMPLATE template0;

-- 删除数据库（危险操作！）
DROP DATABASE blog_db;

-- 删除后再创建（重建数据库）
DROP DATABASE IF EXISTS blog_db;
CREATE DATABASE blog_db;
```

### 5.2 创建用户

```sql
-- 创建用户（带密码）
CREATE USER blog_user WITH PASSWORD 'blog_password_123';

-- 创建超级用户（拥有所有权限，仅用于开发环境）
CREATE USER blog_admin WITH PASSWORD 'admin_password_123' SUPERUSER;

-- 修改用户密码
ALTER USER blog_user PASSWORD 'new_password_456';

-- 删除用户
DROP USER blog_user;
```

### 5.3 权限管理

```sql
-- 授予数据库连接权限
GRANT CONNECT ON DATABASE blog_db TO blog_user;

-- 切换到 blog_db 数据库
\c blog_db

-- 授予 schema 使用权限
GRANT USAGE ON SCHEMA public TO blog_user;

-- 授予所有表的查询权限
GRANT SELECT ON ALL TABLES IN SCHEMA public TO blog_user;

-- 授予所有表的所有权限（开发环境）
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO blog_user;

-- 授予序列使用权限（用于自增 ID）
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO blog_user;

-- 授予未来创建的表的权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO blog_user;

-- 查看用户权限
\du blog_user
```

### 5.4 生产环境权限最佳实践

```sql
-- 生产环境应该创建不同权限的用户：

-- 1. 只读用户（用于报表查询）
CREATE USER readonly_user WITH PASSWORD 'readonly_pass';
GRANT CONNECT ON DATABASE blog_db TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- 2. 读写用户（用于应用）
CREATE USER app_user WITH PASSWORD 'app_pass';
GRANT CONNECT ON DATABASE blog_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 3. 管理员用户（用于维护）
CREATE USER admin_user WITH PASSWORD 'admin_pass' CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE blog_db TO admin_user;
```

---

## 六、连接字符串

### 6.1 连接字符串格式

```
PostgreSQL 连接字符串格式：

postgresql://username:password@host:port/database

各部分说明：
┌──────────────┬──────────────────────────────────────────┐
│ 部分          │ 说明                                      │
├──────────────┼──────────────────────────────────────────┤
│ postgresql   │ 协议名（也可以用 postgres）               │
│ username     │ 用户名                                    │
│ password     │ 密码                                      │
│ host         │ 主机地址（本地用 localhost）               │
│ port         │ 端口号（默认 5432）                       │
│ database     │ 数据库名                                  │
└──────────────┴──────────────────────────────────────────┘

示例：
  postgresql://postgres:postgres123@localhost:5432/blog_db
  postgres://blog_user:blog_pass@localhost:5432/blog_db
```

### 6.2 在 TypeScript/Node.js 中使用

```typescript
// 连接字符串通常放在环境变量中

// .env 文件
// DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/blog_db"

// 在代码中读取
const databaseUrl = process.env.DATABASE_URL;

// 使用 pg 库连接
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: databaseUrl,
});

// 测试连接
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('数据库连接成功:', result.rows[0]);
    client.release();
  } catch (error) {
    console.error('数据库连接失败:', error);
  }
}

testConnection();
```

### 6.3 连接字符串中的特殊字符

```typescript
// 如果密码中包含特殊字符，需要进行 URL 编码
// 特殊字符：@ : / ? # [ ] ! $ & ' ( ) * + , ; =

// 例如密码是 p@ss:word/123
// 需要编码为：p%40ss%3Aword%2F123

import { encodeURI } from 'node:querystring';

const password = 'p@ss:word/123';
const encodedPassword = encodeURIComponent(password);
const url = `postgresql://user:${encodedPassword}@localhost:5432/blog_db`;

// 或者使用连接参数对象
const config = {
  user: 'blog_user',
  password: 'p@ss:word/123',  // 不需要编码
  host: 'localhost',
  port: 5432,
  database: 'blog_db',
};
```

---

## 七、数据库管理基础

### 7.1 查看数据库信息

```sql
-- 查看数据库大小
SELECT pg_size_pretty(pg_database_size('blog_db'));

-- 查看所有数据库及大小
SELECT
    datname AS database_name,
    pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
ORDER BY pg_database_size(datname) DESC;

-- 查看表大小
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public';

-- 查看表的行数（快速估算）
SELECT
    relname AS table_name,
    reltuples AS estimated_rows
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY reltuples DESC;

-- 精确统计行数
SELECT COUNT(*) FROM posts;
```

### 7.2 备份与恢复

```bash
# 使用 pg_dump 备份数据库

# 备份为 SQL 文件
pg_dump -U postgres -d blog_db -f blog_db_backup.sql

# 备份为压缩文件（推荐）
pg_dump -U postgres -d blog_db -Fc -f blog_db_backup.dump

# 备份为自定义格式（可选择性恢复）
pg_dump -U postgres -d blog_db -Fp -f blog_db_plain.sql

# 只备份表结构
pg_dump -U postgres -d blog_db --schema-only -f blog_db_schema.sql

# 只备份数据
pg_dump -U postgres -d blog_db --data-only -f blog_db_data.sql

# 备份特定表
pg_dump -U postgres -d blog_db -t posts -f posts_backup.sql
```

```bash
# 使用 psql/pg_restore 恢复数据库

# 从 SQL 文件恢复
psql -U postgres -d blog_db -f blog_db_backup.sql

# 从压缩文件恢复
pg_restore -U postgres -d blog_db blog_db_backup.dump

# 创建新数据库再恢复
createdb -U postgres blog_db_restored
pg_restore -U postgres -d blog_db_restored blog_db_backup.dump
```

### 7.3 常用管理操作

```sql
-- 查看当前活动连接
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query
FROM pg_stat_activity
WHERE datname = 'blog_db';

-- 终止连接
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'blog_db' AND pid <> pg_backend_pid();

-- 查看正在执行的查询
SELECT
    pid,
    now() - query_start AS duration,
    query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- 查看表的索引
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'posts';

-- 查看表的约束
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'posts'::regclass;
```

---

## 八、实操：创建 blog_db 数据库

### 8.1 完整操作流程

```sql
-- ========================================
-- 步骤 1：连接到 PostgreSQL
-- ========================================
-- 打开命令提示符，执行：
-- psql -U postgres

-- ========================================
-- 步骤 2：创建数据库
-- ========================================
CREATE DATABASE blog_db
    WITH ENCODING 'UTF8';

-- ========================================
-- 步骤 3：创建应用用户
-- ========================================
CREATE USER blog_app WITH PASSWORD 'blog_app_2024';

-- ========================================
-- 步骤 4：授权
-- ========================================
-- 授予数据库权限
GRANT ALL PRIVILEGES ON DATABASE blog_db TO blog_app;

-- 切换到 blog_db
\c blog_db

-- 授予 schema 权限
GRANT ALL ON SCHEMA public TO blog_app;

-- ========================================
-- 步骤 5：创建表结构
-- ========================================
-- 用户表
CREATE TABLE users (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(50) NOT NULL UNIQUE,
    email      VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    avatar     VARCHAR(500),
    bio        TEXT,
    role       VARCHAR(20) DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 分类表
CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,
    slug        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- 标签表
CREATE TABLE tags (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
);

-- 文章表
CREATE TABLE posts (
    id           SERIAL PRIMARY KEY,
    title        VARCHAR(200) NOT NULL,
    content      TEXT NOT NULL,
    slug         VARCHAR(200) NOT NULL UNIQUE,
    status       VARCHAR(20) DEFAULT 'DRAFT',
    view_count   INTEGER DEFAULT 0,
    author_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);

-- 文章-标签关联表
CREATE TABLE post_tags (
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- 评论表
CREATE TABLE comments (
    id         SERIAL PRIMARY KEY,
    content    TEXT NOT NULL,
    author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_id  INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 步骤 6：创建索引
-- ========================================
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_author ON comments(author_id);

-- ========================================
-- 步骤 7：授予表权限给应用用户
-- ========================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO blog_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO blog_app;

-- ========================================
-- 步骤 8：插入测试数据
-- ========================================
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@blog.com', 'hashed_admin_pass', 'ADMIN'),
('zhangsan', 'zhang@blog.com', 'hashed_zhang_pass', 'USER'),
('lisi', 'lisi@blog.com', 'hashed_li_pass', 'USER');

INSERT INTO categories (name, slug, description) VALUES
('前端开发', 'frontend', '前端技术文章'),
('后端开发', 'backend', '后端技术文章'),
('数据库', 'database', '数据库技术文章');

INSERT INTO tags (name, slug) VALUES
('TypeScript', 'typescript'),
('React', 'react'),
('Node.js', 'nodejs'),
('PostgreSQL', 'postgresql'),
('Prisma', 'prisma');

INSERT INTO posts (title, content, slug, status, author_id, category_id, published_at) VALUES
('TypeScript 入门指南', 'TypeScript 是 JavaScript 的超集...', 'typescript-intro', 'PUBLISHED', 1, 1, NOW()),
('Prisma ORM 实战', 'Prisma 是现代化的 ORM 工具...', 'prisma-orm-guide', 'PUBLISHED', 2, 3, NOW()),
('Express + TypeScript 项目搭建', '本文介绍如何搭建...', 'express-typescript-setup', 'DRAFT', 1, 2, NULL);

INSERT INTO post_tags (post_id, tag_id) VALUES
(1, 1), (2, 5), (2, 4), (3, 1), (3, 3);

INSERT INTO comments (content, author_id, post_id, parent_id) VALUES
('写得很好！', 2, 1, NULL),
('收藏了', 3, 1, NULL),
('感谢分享', 1, 2, NULL);

-- ========================================
-- 步骤 9：验证数据
-- ========================================
SELECT 'Users' AS table_name, COUNT(*) AS count FROM users
UNION ALL
SELECT 'Categories', COUNT(*) FROM categories
UNION ALL
SELECT 'Tags', COUNT(*) FROM tags
UNION ALL
SELECT 'Posts', COUNT(*) FROM posts
UNION ALL
SELECT 'Comments', COUNT(*) FROM comments;

-- 输出示例：
--  table_name | count
-- ------------+-------
--  Users      |     3
--  Categories |     3
--  Tags       |     5
--  Posts      |     3
--  Comments   |     3
```

### 8.2 连接测试

```typescript
// test-connection.ts
// 需要先安装：npm install pg @types/pg

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://blog_app:blog_app_2024@localhost:5432/blog_db',
});

async function testConnection() {
  try {
    // 测试基本连接
    const client = await pool.connect();
    console.log('✅ 数据库连接成功！');

    // 测试查询
    const result = await client.query('SELECT NOW() AS current_time');
    console.log('⏰ 当前时间:', result.rows[0].current_time);

    // 测试表数据
    const usersResult = await client.query('SELECT id, username, email FROM users');
    console.log('👥 用户列表:');
    usersResult.rows.forEach(user => {
      console.log(`   - ${user.username} (${user.email})`);
    });

    // 测试关联查询
    const postsResult = await client.query(`
      SELECT
        p.title,
        u.username AS author,
        c.name AS category
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
    `);
    console.log('📝 文章列表:');
    postsResult.rows.forEach(post => {
      console.log(`   - ${post.title} (作者: ${post.author}, 分类: ${post.category || '无'})`);
    });

    client.release();
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
  } finally {
    await pool.end();
  }
}

testConnection();
```

运行测试：

```bash
# 安装依赖
npm install pg @types/pg

# 编译并运行
npx ts-node test-connection.ts

# 预期输出：
# ✅ 数据库连接成功！
# ⏰ 当前时间: 2024-01-15T10:30:00.000Z
# 👥 用户列表:
#    - admin (admin@blog.com)
#    - zhangsan (zhang@blog.com)
#    - lisi (lisi@blog.com)
# 📝 文章列表:
#    - TypeScript 入门指南 (作者: admin, 分类: 前端开发)
#    - Prisma ORM 实战 (作者: zhangsan, 分类: 数据库)
#    - Express + TypeScript 项目搭建 (作者: admin, 分类: 后端开发)
```

---

## 九、常见问题排查

```
问题 1：连接被拒绝
┌─────────────────────────────────────────────────────────────┐
│ 错误：connection refused                                     │
│ 原因：PostgreSQL 服务未启动                                  │
│ 解决：                                                       │
│   Windows: services.msc → 找到 postgresql 服务 → 启动       │
│   或者命令行：net start postgresql-x64-16                    │
└─────────────────────────────────────────────────────────────┘

问题 2：密码认证失败
┌─────────────────────────────────────────────────────────────┐
│ 错误：password authentication failed                         │
│ 原因：密码错误或用户不存在                                   │
│ 解决：                                                       │
│   1. 检查密码是否正确                                        │
│   2. 检查 pg_hba.conf 中的认证方式                           │
│   3. 重置密码：ALTER USER postgres PASSWORD 'new_password';  │
└─────────────────────────────────────────────────────────────┘

问题 3：数据库不存在
┌─────────────────────────────────────────────────────────────┐
│ 错误：database "xxx" does not exist                          │
│ 原因：指定的数据库不存在                                     │
│ 解决：先创建数据库 CREATE DATABASE xxx;                      │
└─────────────────────────────────────────────────────────────┘

问题 4：权限不足
┌─────────────────────────────────────────────────────────────┐
│ 错误：permission denied                                      │
│ 原因：用户没有相应权限                                       │
│ 解决：GRANT 相应权限给用户                                   │
└─────────────────────────────────────────────────────────────┘

问题 5：端口被占用
┌─────────────────────────────────────────────────────────────┐
│ 错误：address already in use                                 │
│ 原因：5432 端口被其他程序占用                                │
│ 解决：                                                       │
│   1. 查找占用端口的程序：netstat -ano | findstr 5432        │
│   2. 关闭占用程序，或修改 PostgreSQL 端口                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 十、小结

```
本课要点回顾：
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. PostgreSQL 是功能最强大的开源关系型数据库            │
│                                                         │
│  2. Windows 安装步骤：                                   │
│     下载安装包 → 运行安装程序 → 设置密码 → 完成         │
│                                                         │
│  3. pgAdmin 是 PostgreSQL 的图形管理工具                 │
│     - 创建/管理数据库                                   │
│     - 执行 SQL 查询                                     │
│     - 查看和编辑数据                                    │
│                                                         │
│  4. psql 是命令行客户端                                  │
│     - \l 列出数据库                                     │
│     - \dt 列出表                                        │
│     - \d 表名 查看表结构                                │
│     - \q 退出                                           │
│                                                         │
│  5. 连接字符串格式：                                     │
│     postgresql://user:password@host:port/database        │
│                                                         │
│  6. 使用 pg_dump 备份，pg_restore 恢复                   │
│                                                         │
│  7. 生产环境应创建不同权限级别的用户                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 下一课预告

下一课我们将学习 **Prisma ORM 入门**——用 TypeScript 代码来操作数据库，告别手写 SQL 的日子。你将学会 Prisma 的安装、配置和基本使用。

---

> **学习建议：** 建议在本地安装 PostgreSQL 并完成本课的实操练习。亲手操作一遍比看十遍文档更有用。
