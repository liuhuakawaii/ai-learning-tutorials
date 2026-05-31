# 第七课：RESTful API 设计

## 学习目标

完成本课学习后，你将能够：

1. 理解 REST 架构风格的核心原则
2. 正确使用 HTTP 方法的语义
3. 设计规范的 URL 结构
4. 使用合适的 HTTP 状态码
5. 设计统一的请求/响应格式
6. 实现分页、排序、过滤功能
7. 设计博客平台的完整 API

---

## 一、什么是 REST

### 1.1 REST 的定义

**REST（Representational State Transfer）** 是一种软件架构风格，由 Roy Fielding 在 2000 年的博士论文中提出。

```
REST 的核心思想：

  资源（Resource）
    → 一切都是资源（用户、文章、评论...）
    → 每个资源有唯一的标识（URL）

  表述（Representation）
    → 资源可以有多种表述形式
    → JSON、XML、HTML...

  状态转移（State Transfer）
    → 通过 HTTP 方法操作资源
    → GET 获取、POST 创建、PUT 更新、DELETE 删除
```

### 1.2 REST 的原则

```
REST 六大原则：

1. 客户端-服务器分离
   前端和后端独立开发、独立部署

2. 无状态
   每个请求包含所有必要信息
   服务器不保存客户端状态

3. 可缓存
   响应可以被缓存，提高性能

4. 统一接口
   使用标准的 HTTP 方法和状态码

5. 分层系统
   客户端不需要知道是否直连服务器

6. 按需代码（可选）
   服务器可以返回可执行代码
```

### 1.3 一个直观的类比

```
REST API 类比：餐厅点餐

  你（客户端）           餐厅（服务器）
     │                      │
     │ GET /menu             │  "给我看看菜单"
     │─────────────────────►│
     │                      │
     │ 200 OK { menu }      │  "这是菜单"
     │◄─────────────────────│
     │                      │
     │ POST /orders          │  "我要一份宫保鸡丁"
     │ { dish: "宫保鸡丁" }  │
     │─────────────────────►│
     │                      │
     │ 201 Created           │  "好的，已下单"
     │ { orderId: 1 }        │
     │◄─────────────────────│
     │                      │
     │ GET /orders/1         │  "我的订单怎么样了？"
     │─────────────────────►│
     │                      │
     │ 200 OK                │  "正在制作中"
     │ { status: "cooking" } │
     │◄─────────────────────│
     │                      │
     │ DELETE /orders/1      │  "我要取消订单"
     │─────────────────────►│
     │                      │
     │ 200 OK                │  "已取消"
     │◄─────────────────────│
```

---

## 二、HTTP 方法语义

### 2.1 五大方法

```
HTTP 方法     语义          幂等性    安全性    用途
────────────────────────────────────────────────────
GET          获取资源        是       是       查询数据
POST         创建资源        否       否       新增数据
PUT          替换资源        是       否       全量更新
PATCH        部分更新        否       否       局部更新
DELETE       删除资源        是       否       删除数据
```

```
幂等性（Idempotent）：
  同一个请求执行多次，结果与执行一次相同

  GET /users/1       → 永远返回用户 1（幂等）
  PUT /users/1       → 多次更新，结果相同（幂等）
  DELETE /users/1    → 多次删除，结果相同（幂等）
  POST /users        → 每次创建新用户（不幂等）
```

### 2.2 各方法详解

```javascript
// ========== GET：获取资源 ==========

// 获取所有用户
GET /api/users
// 响应：{ users: [...], total: 100 }

// 获取单个用户
GET /api/users/1
// 响应：{ id: 1, name: '张三' }

// 获取用户的子资源
GET /api/users/1/posts
// 响应：{ posts: [...] }


// ========== POST：创建资源 ==========

// 创建用户
POST /api/users
// 请求体：{ name: '张三', email: 'zhangsan@example.com' }
// 响应：{ id: 3, name: '张三', email: '...' }


// ========== PUT：替换资源 ==========

// 完整更新用户（所有字段都要传）
PUT /api/users/1
// 请求体：{ name: '张三三', email: 'new@example.com', age: 26 }
// 响应：{ id: 1, name: '张三三', email: '...', age: 26 }


// ========== PATCH：部分更新 ==========

// 部分更新用户（只传要改的字段）
PATCH /api/users/1
// 请求体：{ name: '新名字' }
// 响应：{ id: 1, name: '新名字', email: '...', age: 25 }


// ========== DELETE：删除资源 ==========

// 删除用户
DELETE /api/users/1
// 响应：204 No Content
```

### 2.3 PUT vs PATCH 的区别

```
PUT：完整替换
  请求前：{ id: 1, name: '张三', age: 25, email: 'a@b.com' }
  PUT /api/users/1 { name: '新名字' }
  请求后：{ id: 1, name: '新名字' }  ← age 和 email 没了！

PATCH：部分更新
  请求前：{ id: 1, name: '张三', age: 25, email: 'a@b.com' }
  PATCH /api/users/1 { name: '新名字' }
  请求后：{ id: 1, name: '新名字', age: 25, email: 'a@b.com' }  ← 只改了 name
```

---

## 三、URL 设计规范

### 3.1 基本规则

```
URL 设计规范：

✅ 使用名词，不用动词
  /api/users          ✅ 获取用户列表
  /api/getUsers       ❌ 不要用动词

✅ 使用复数形式
  /api/users          ✅
  /api/user           ❌

✅ 使用小写字母和连字符
  /api/user-profiles  ✅
  /api/userProfiles   ❌（驼峰）
  /api/user_profiles  ❌（下划线）

✅ 层级表示关系
  /api/users/1/posts           用户 1 的文章
  /api/users/1/posts/5         用户 1 的文章 5
  /api/users/1/posts/5/comments 用户 1 的文章 5 的评论

✅ 避免过深的嵌套（最多 3 层）
  /api/users/1/posts/5/comments/3    ✅ 可以接受
  /api/users/1/posts/5/comments/3/replies/7  ❌ 太深了
```

### 3.2 URL 模式

```
标准 CRUD URL 模式：

  GET    /api/resources          获取列表
  POST   /api/resources          创建资源
  GET    /api/resources/:id      获取单个
  PUT    /api/resources/:id      完整更新
  PATCH  /api/resources/:id      部分更新
  DELETE /api/resources/:id      删除资源

示例（文章）：
  GET    /api/posts              获取文章列表
  POST   /api/posts              创建文章
  GET    /api/posts/1            获取文章 1
  PUT    /api/posts/1            更新文章 1
  DELETE /api/posts/1            删除文章 1

嵌套资源：
  GET    /api/users/1/posts      用户 1 的文章列表
  POST   /api/users/1/posts      为用户 1 创建文章
```

---

## 四、状态码规范

### 4.1 状态码分类

```
HTTP 状态码分类：

  1xx：信息性状态码（很少使用）
  2xx：成功
  3xx：重定向
  4xx：客户端错误
  5xx：服务器错误
```

### 4.2 常用状态码

```
状态码    含义                使用场景
──────────────────────────────────────────────────────────
200      OK                  GET 请求成功、PUT/PATCH/DELETE 成功
201      Created             POST 创建资源成功
204      No Content          DELETE 成功，无需返回内容

301      Moved Permanently   资源永久移动到新 URL
302      Found               资源临时移动
304      Not Modified        资源未修改，使用缓存

400      Bad Request         请求参数错误
401      Unauthorized        未认证（需要登录）
403      Forbidden           已认证但权限不足
404      Not Found           资源不存在
405      Method Not Allowed  HTTP 方法不支持
409      Conflict            资源冲突（如重复创建）
422      Unprocessable Entity 语义错误（验证失败）
429      Too Many Requests   请求过于频繁

500      Internal Server Error 服务器内部错误
502      Bad Gateway         网关错误
503      Service Unavailable 服务不可用
```

### 4.3 状态码使用示例

```javascript
// GET /api/users - 获取用户列表
router.get('/', (req, res) => {
    res.status(200).json({ users: [] });
});

// POST /api/users - 创建用户
router.post('/', (req, res) => {
    // 创建成功
    res.status(201).json({ id: 3, name: '张三' });
});

// GET /api/users/:id - 获取用户
router.get('/:id', (req, res) => {
    const user = findUser(req.params.id);

    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }

    res.status(200).json(user);
});

// PUT /api/users/:id - 更新用户
router.put('/:id', (req, res) => {
    const user = findUser(req.params.id);

    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }

    res.status(200).json(updatedUser);
});

// DELETE /api/users/:id - 删除用户
router.delete('/:id', (req, res) => {
    const user = findUser(req.params.id);

    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }

    res.status(204).send();  // 204 不返回内容
});
```

---

## 五、请求与响应格式

### 5.1 统一响应格式

```javascript
// 推荐的统一响应格式

// 成功响应
{
    "success": true,
    "data": { ... },           // 或 [...]
    "meta": {
        "page": 1,
        "limit": 10,
        "total": 100
    }
}

// 错误响应
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "验证失败",
        "details": [
            { "field": "email", "message": "邮箱格式不正确" }
        ]
    }
}
```

### 5.2 实现统一响应

```javascript
// utils/response.js

/**
 * 成功响应
 */
function success(res, data, meta = null) {
    const response = {
        success: true,
        data
    };

    if (meta) {
        response.meta = meta;
    }

    return res.status(200).json(response);
}

/**
 * 创建成功响应
 */
function created(res, data) {
    return res.status(201).json({
        success: true,
        data
    });
}

/**
 * 删除成功响应
 */
function deleted(res) {
    return res.status(204).send();
}

/**
 * 错误响应
 */
function error(res, status, code, message, details = null) {
    const response = {
        success: false,
        error: {
            code,
            message
        }
    };

    if (details) {
        response.error.details = details;
    }

    return res.status(status).json(response);
}

module.exports = { success, created, deleted, error };
```

### 5.3 使用统一响应

```javascript
const { success, created, deleted, error } = require('../utils/response');

// 获取用户列表
router.get('/', (req, res) => {
    const users = store.users;
    return success(res, users, { total: users.length });
});

// 创建用户
router.post('/', (req, res) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return error(res, 400, 'VALIDATION_ERROR', '姓名和邮箱为必填项');
    }

    const user = { id: store.nextId.users++, name, email };
    store.users.push(user);
    return created(res, user);
});

// 删除用户
router.delete('/:id', (req, res) => {
    const index = store.users.findIndex(u => u.id === parseInt(req.params.id));

    if (index === -1) {
        return error(res, 404, 'NOT_FOUND', '用户不存在');
    }

    store.users.splice(index, 1);
    return deleted(res);
});
```

---

## 六、分页、排序、过滤

### 6.1 分页

```javascript
// URL 格式
GET /api/posts?page=1&limit=10

// 实现
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const posts = store.posts.slice(offset, offset + limit);
    const total = store.posts.length;

    res.json({
        success: true,
        data: posts,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
        }
    });
});

// 响应示例
{
    "success": true,
    "data": [...],
    "meta": {
        "page": 1,
        "limit": 10,
        "total": 25,
        "totalPages": 3,
        "hasNext": true,
        "hasPrev": false
    }
}
```

### 6.2 排序

```javascript
// URL 格式
GET /api/posts?sort=createdAt&order=desc
GET /api/posts?sort=-createdAt        // - 表示降序
GET /api/posts?sort=createdAt,title   // 多字段排序

// 实现
router.get('/', (req, res) => {
    let posts = [...store.posts];

    // 排序
    const sortField = req.query.sort || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    // 支持 - 前缀表示降序
    const field = sortField.startsWith('-') ? sortField.slice(1) : sortField;
    const order = sortField.startsWith('-') ? -1 : sortOrder;

    posts.sort((a, b) => {
        if (a[field] < b[field]) return -1 * order;
        if (a[field] > b[field]) return 1 * order;
        return 0;
    });

    res.json({ success: true, data: posts });
});
```

### 6.3 过滤

```javascript
// URL 格式
GET /api/posts?tag=nodejs
GET /api/posts?authorId=1&status=published
GET /api/posts?minDate=2024-01-01&maxDate=2024-12-31

// 实现
router.get('/', (req, res) => {
    let posts = [...store.posts];

    // 按标签过滤
    if (req.query.tag) {
        posts = posts.filter(p => p.tags.includes(req.query.tag));
    }

    // 按作者过滤
    if (req.query.authorId) {
        posts = posts.filter(p => p.authorId === parseInt(req.query.authorId));
    }

    // 按状态过滤
    if (req.query.status) {
        posts = posts.filter(p => p.status === req.query.status);
    }

    // 按日期范围过滤
    if (req.query.minDate) {
        posts = posts.filter(p => p.createdAt >= req.query.minDate);
    }
    if (req.query.maxDate) {
        posts = posts.filter(p => p.createdAt <= req.query.maxDate);
    }

    // 搜索
    if (req.query.search) {
        const keyword = req.query.search.toLowerCase();
        posts = posts.filter(p =>
            p.title.toLowerCase().includes(keyword) ||
            p.content.toLowerCase().includes(keyword)
        );
    }

    res.json({ success: true, data: posts, total: posts.length });
});
```

---

## 七、API 版本控制

### 7.1 为什么需要版本控制

```
场景：你的 API 被很多客户端使用

  v1: GET /api/users → 返回 { users: [...] }
  v2: GET /api/users → 返回 { data: [...], meta: {...} }

  如果直接改 v1，旧客户端会崩溃！

  解决方案：
  v1: GET /api/v1/users → 保持旧格式
  v2: GET /api/v2/users → 使用新格式
```

### 7.2 实现版本控制

```javascript
// 方式一：URL 路径版本（推荐）
app.use('/api/v1', require('./routes/v1'));
app.use('/api/v2', require('./routes/v2'));

// 方式二：请求头版本
// Accept: application/vnd.api.v1+json
app.use((req, res, next) => {
    const accept = req.get('Accept') || '';
    const version = accept.match(/vnd\.api\.v(\d+)/);
    req.apiVersion = version ? parseInt(version[1]) : 1;
    next();
});

// 方式三：查询参数版本
// GET /api/users?version=1
```

---

## 八、实战：设计博客 API

### 8.1 完整 API 路由表

```
博客平台 API 路由表

基础路径：/api/v1

==================== 用户相关 ====================

GET    /api/v1/users              获取用户列表
POST   /api/v1/users              创建用户
GET    /api/v1/users/:id          获取用户详情
PUT    /api/v1/users/:id          更新用户
DELETE /api/v1/users/:id          删除用户

GET    /api/v1/users/:id/posts    获取用户的文章

==================== 文章相关 ====================

GET    /api/v1/posts              获取文章列表
POST   /api/v1/posts              创建文章
GET    /api/v1/posts/:id          获取文章详情
PUT    /api/v1/posts/:id          更新文章
DELETE /api/v1/posts/:id          删除文章

GET    /api/v1/posts/:id/comments 获取文章的评论

==================== 评论相关 ====================

GET    /api/v1/comments           获取评论列表
POST   /api/v1/comments           创建评论
GET    /api/v1/comments/:id       获取评论详情
DELETE /api/v1/comments/:id       删除评论

==================== 认证相关 ====================

POST   /api/v1/auth/register      用户注册
POST   /api/v1/auth/login         用户登录
POST   /api/v1/auth/logout        用户登出
GET    /api/v1/auth/profile       获取当前用户信息

==================== 统计相关 ====================

GET    /api/v1/stats              获取统计数据
```

### 8.2 完整实现

```javascript
// src/routes/v1/index.js
const express = require('express');
const router = express.Router();

router.use('/users', require('./users'));
router.use('/posts', require('./posts'));
router.use('/comments', require('./comments'));
router.use('/auth', require('./auth'));
router.use('/stats', require('./stats'));

module.exports = router;
```

```javascript
// src/routes/v1/users.js
const express = require('express');
const router = express.Router();
const store = require('../../data/store');
const { success, created, deleted, error } = require('../../utils/response');

// 获取用户列表
router.get('/', (req, res) => {
    const { page = 1, limit = 10, search, role } = req.query;
    let users = [...store.users];

    // 过滤
    if (search) {
        const keyword = search.toLowerCase();
        users = users.filter(u =>
            u.name.toLowerCase().includes(keyword) ||
            u.email.toLowerCase().includes(keyword)
        );
    }

    if (role) {
        users = users.filter(u => u.role === role);
    }

    // 分页
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const paginated = users.slice(offset, offset + limitNum);

    // 移除敏感信息
    const safeUsers = paginated.map(({ password, ...user }) => user);

    return success(res, safeUsers, {
        page: pageNum,
        limit: limitNum,
        total: users.length,
        totalPages: Math.ceil(users.length / limitNum)
    });
});

// 获取单个用户
router.get('/:id', (req, res) => {
    const user = store.users.find(u => u.id === parseInt(req.params.id));

    if (!user) {
        return error(res, 404, 'NOT_FOUND', '用户不存在');
    }

    const { password, ...safeUser } = user;
    return success(res, safeUser);
});

// 创建用户
router.post('/', (req, res) => {
    const { name, email, password } = req.body;

    // 验证
    const errors = [];
    if (!name || name.trim() === '') errors.push('姓名为必填项');
    if (!email || !email.includes('@')) errors.push('请提供有效的邮箱');
    if (!password || password.length < 6) errors.push('密码至少 6 个字符');

    if (errors.length > 0) {
        return error(res, 422, 'VALIDATION_ERROR', '验证失败', errors);
    }

    // 检查邮箱是否已存在
    if (store.users.some(u => u.email === email)) {
        return error(res, 409, 'CONFLICT', '邮箱已被注册');
    }

    const user = {
        id: store.nextId.users++,
        name,
        email,
        role: 'user',
        createdAt: new Date().toISOString()
    };

    store.users.push(user);
    return created(res, user);
});

// 更新用户
router.put('/:id', (req, res) => {
    const index = store.users.findIndex(u => u.id === parseInt(req.params.id));

    if (index === -1) {
        return error(res, 404, 'NOT_FOUND', '用户不存在');
    }

    const { name, email, role } = req.body;

    store.users[index] = {
        ...store.users[index],
        name: name || store.users[index].name,
        email: email || store.users[index].email,
        role: role || store.users[index].role,
        updatedAt: new Date().toISOString()
    };

    const { password, ...safeUser } = store.users[index];
    return success(res, safeUser);
});

// 删除用户
router.delete('/:id', (req, res) => {
    const index = store.users.findIndex(u => u.id === parseInt(req.params.id));

    if (index === -1) {
        return error(res, 404, 'NOT_FOUND', '用户不存在');
    }

    store.users.splice(index, 1);
    return deleted(res);
});

// 获取用户的文章
router.get('/:id/posts', (req, res) => {
    const userId = parseInt(req.params.id);
    const user = store.users.find(u => u.id === userId);

    if (!user) {
        return error(res, 404, 'NOT_FOUND', '用户不存在');
    }

    const posts = store.posts.filter(p => p.authorId === userId);
    return success(res, posts);
});

module.exports = router;
```

```javascript
// src/routes/v1/posts.js
const express = require('express');
const router = express.Router();
const store = require('../../data/store');
const { success, created, deleted, error } = require('../../utils/response');

// 获取文章列表
router.get('/', (req, res) => {
    const { page = 1, limit = 10, tag, authorId, status, search, sort = '-createdAt' } = req.query;
    let posts = [...store.posts];

    // 过滤
    if (tag) {
        posts = posts.filter(p => p.tags.includes(tag));
    }
    if (authorId) {
        posts = posts.filter(p => p.authorId === parseInt(authorId));
    }
    if (status) {
        posts = posts.filter(p => p.status === status);
    }
    if (search) {
        const keyword = search.toLowerCase();
        posts = posts.filter(p =>
            p.title.toLowerCase().includes(keyword) ||
            p.content.toLowerCase().includes(keyword)
        );
    }

    // 排序
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;
    posts.sort((a, b) => {
        if (a[sortField] < b[sortField]) return -1 * sortOrder;
        if (a[sortField] > b[sortField]) return 1 * sortOrder;
        return 0;
    });

    // 分页
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    const paginated = posts.slice(offset, offset + limitNum);

    return success(res, paginated, {
        page: pageNum,
        limit: limitNum,
        total: posts.length,
        totalPages: Math.ceil(posts.length / limitNum)
    });
});

// 获取单篇文章
router.get('/:id', (req, res) => {
    const post = store.posts.find(p => p.id === parseInt(req.params.id));

    if (!post) {
        return error(res, 404, 'NOT_FOUND', '文章不存在');
    }

    // 获取作者信息
    const author = store.users.find(u => u.id === post.authorId);
    const comments = store.comments.filter(c => c.postId === post.id);

    return success(res, {
        ...post,
        author: author ? { id: author.id, name: author.name } : null,
        comments
    });
});

// 创建文章
router.post('/', (req, res) => {
    const { title, content, authorId, tags = [], status = 'draft' } = req.body;

    const errors = [];
    if (!title || title.trim() === '') errors.push('标题为必填项');
    if (!content || content.trim() === '') errors.push('内容为必填项');
    if (!authorId) errors.push('作者为必填项');

    if (errors.length > 0) {
        return error(res, 422, 'VALIDATION_ERROR', '验证失败', errors);
    }

    const now = new Date().toISOString();
    const post = {
        id: store.nextId.posts++,
        title,
        content,
        authorId: parseInt(authorId),
        tags,
        status,
        createdAt: now,
        updatedAt: now
    };

    store.posts.push(post);
    return created(res, post);
});

// 更新文章
router.put('/:id', (req, res) => {
    const index = store.posts.findIndex(p => p.id === parseInt(req.params.id));

    if (index === -1) {
        return error(res, 404, 'NOT_FOUND', '文章不存在');
    }

    const { title, content, tags, status } = req.body;

    store.posts[index] = {
        ...store.posts[index],
        title: title || store.posts[index].title,
        content: content || store.posts[index].content,
        tags: tags || store.posts[index].tags,
        status: status || store.posts[index].status,
        updatedAt: new Date().toISOString()
    };

    return success(res, store.posts[index]);
});

// 删除文章
router.delete('/:id', (req, res) => {
    const index = store.posts.findIndex(p => p.id === parseInt(req.params.id));

    if (index === -1) {
        return error(res, 404, 'NOT_FOUND', '文章不存在');
    }

    // 同时删除文章的评论
    const postId = store.posts[index].id;
    store.comments = store.comments.filter(c => c.postId !== postId);

    store.posts.splice(index, 1);
    return deleted(res);
});

// 获取文章的评论
router.get('/:id/comments', (req, res) => {
    const postId = parseInt(req.params.id);
    const post = store.posts.find(p => p.id === postId);

    if (!post) {
        return error(res, 404, 'NOT_FOUND', '文章不存在');
    }

    const comments = store.comments.filter(c => c.postId === postId);
    return success(res, comments);
});

module.exports = router;
```

```javascript
// src/routes/v1/comments.js
const express = require('express');
const router = express.Router();
const store = require('../../data/store');
const { success, created, deleted, error } = require('../../utils/response');

// 获取评论列表
router.get('/', (req, res) => {
    const { postId, authorId } = req.query;
    let comments = [...store.comments];

    if (postId) {
        comments = comments.filter(c => c.postId === parseInt(postId));
    }
    if (authorId) {
        comments = comments.filter(c => c.authorId === parseInt(authorId));
    }

    return success(res, comments);
});

// 创建评论
router.post('/', (req, res) => {
    const { postId, authorId, content } = req.body;

    const errors = [];
    if (!postId) errors.push('文章ID为必填项');
    if (!authorId) errors.push('作者ID为必填项');
    if (!content || content.trim() === '') errors.push('评论内容为必填项');

    if (errors.length > 0) {
        return error(res, 422, 'VALIDATION_ERROR', '验证失败', errors);
    }

    // 检查文章是否存在
    const post = store.posts.find(p => p.id === parseInt(postId));
    if (!post) {
        return error(res, 404, 'NOT_FOUND', '文章不存在');
    }

    const comment = {
        id: store.nextId.comments++,
        postId: parseInt(postId),
        authorId: parseInt(authorId),
        content,
        createdAt: new Date().toISOString()
    };

    store.comments.push(comment);
    return created(res, comment);
});

// 删除评论
router.delete('/:id', (req, res) => {
    const index = store.comments.findIndex(c => c.id === parseInt(req.params.id));

    if (index === -1) {
        return error(res, 404, 'NOT_FOUND', '评论不存在');
    }

    store.comments.splice(index, 1);
    return deleted(res);
});

module.exports = router;
```

```javascript
// src/routes/v1/stats.js
const express = require('express');
const router = express.Router();
const store = require('../../data/store');
const { success } = require('../../utils/response');

router.get('/', (req, res) => {
    const tagCount = {};
    store.posts.forEach(post => {
        post.tags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
    });

    return success(res, {
        totalUsers: store.users.length,
        totalPosts: store.posts.length,
        totalComments: store.comments.length,
        tagStats: tagCount,
        recentPosts: store.posts.slice(-5).reverse()
    });
});

module.exports = router;
```

---

## 九、动手练习

### 练习 1：设计 API

```
为以下场景设计 API 路由表：

1. 电商平台
   - 商品管理
   - 订单管理
   - 用户管理
   - 购物车

2. 社交媒体
   - 用户
   - 帖子
   - 评论
   - 点赞
   - 关注
```

### 练习 2：实现分页

```javascript
// 实现一个通用的分页函数
function paginate(array, page = 1, limit = 10) {
    // 你的代码
}
```

### 练习 3：实现过滤

```javascript
// 实现一个通用的过滤函数
function filterData(data, filters) {
    // 支持：
    // - 等值过滤：{ status: 'published' }
    // - 范围过滤：{ minAge: 18, maxAge: 30 }
    // - 模糊搜索：{ search: '关键词' }
}
```

---

## 十、小结

```
本课核心知识点：

✅ REST 是一种架构风格，核心是资源和统一接口
✅ HTTP 方法语义：GET 获取、POST 创建、PUT 替换、PATCH 部分更新、DELETE 删除
✅ URL 设计：名词、复数、层级关系、小写连字符
✅ 状态码：2xx 成功、4xx 客户端错误、5xx 服务器错误
✅ 统一响应格式：成功 { success, data, meta }、失败 { success, error }
✅ 分页：page + limit，返回 total 和 totalPages
✅ 排序：sort 字段 + order 方向
✅ 过滤：查询参数映射到过滤条件
✅ API 版本控制：/api/v1/...

关键记忆点：
  - 永远使用名词，不要用动词
  - GET 幂等且安全，POST 不幂等
  - 201 表示创建成功，204 表示无内容返回
  - 400 是客户端错误，500 是服务器错误

下一课预告：
  我们将学习请求验证和错误处理，让 API 更加健壮。
```

---

> **给前端开发者的话：** 作为前端，你每天都在调用 API。现在你理解了 API 是怎么设计的，下次遇到不规范的 API 你就知道问题在哪里了。而且，当你自己设计 API 时，你会知道什么样的 API 对前端最友好。
