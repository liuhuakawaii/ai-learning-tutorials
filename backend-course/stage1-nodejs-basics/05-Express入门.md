# 第五课：Express 入门

## 场景引入

上一课你用 `http` 模块手写了一个服务器，处理路由要写一堆 `if-else`，解析请求体要手动监听 `data` 和 `end` 事件，返回 JSON 还要自己设置 `Content-Type`。写了 200 行代码，才实现了一个最简单的 CRUD API。而你的同事用 Express 只写了 30 行就完成了同样的功能，代码还更清晰。Express 是 Node.js 生态中最流行的 Web 框架，它的路由系统和中间件机制让你专注于业务逻辑，而不是重复造轮子。

## 学习目标

完成本课学习后，你将能够：

1. 理解为什么需要 Web 框架
2. 掌握 Express.js 的基本使用方法
3. 创建 RESTful API 路由
4. 理解 req 和 res 对象的常用属性和方法
5. 初步了解中间件的概念

---

## 一、为什么需要框架

### 1.1 手写 vs 框架对比

上一课我们用 http 模块手写了一个服务器，让我们回顾一下痛苦之处：

```javascript
// ========== 手写 HTTP 服务器（痛苦版） ==========
const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method;
    const path = parsedUrl.pathname;

    // 路由处理 - 又长又乱
    if (method === 'GET' && path === '/api/users') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ users: [] }));
    } else if (method === 'GET' && path.match(/^\/api\/users\/\d+$/)) {
        const id = path.split('/').pop();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id }));
    } else if (method === 'POST' && path === '/api/users') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const user = JSON.parse(body);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(user));
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    }
});

server.listen(3000);

// 问题：
// 1. 路由处理冗长，难以维护
// 2. 没有统一的错误处理
// 3. 解析请求体需要手动处理
// 4. 没有中间件机制
// 5. 代码重复多
```

```javascript
// ========== 使用 Express（优雅版） ==========
const express = require('express');
const app = express();

// 自动解析 JSON 请求体
app.use(express.json());

// 路由 - 清晰简洁
app.get('/api/users', (req, res) => {
    res.json({ users: [] });
});

app.get('/api/users/:id', (req, res) => {
    res.json({ id: req.params.id });
});

app.post('/api/users', (req, res) => {
    res.status(201).json(req.body);
});

// 统一的 404 处理
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

app.listen(3000);

// 优势：
// 1. 路由清晰，一目了然
// 2. 内置错误处理
// 3. 自动解析请求体
// 4. 丰富的中间件生态
// 5. 代码量少，可读性强
```

### 1.2 框架帮你做了什么

```
Express 帮你处理的事情：

  ┌─────────────────────────────────────────────────┐
  │  请求进入                                         │
  │      │                                           │
  │      ▼                                           │
  │  ┌──────────┐  解析 URL、查询参数、路径参数        │
  │  │ URL 解析  │                                    │
  │  └──────────┘                                    │
  │      │                                           │
  │      ▼                                           │
  │  ┌──────────┐  解析 JSON、URL-encoded、FormData   │
  │  │ Body 解析 │                                    │
  │  └──────────┘                                    │
  │      │                                           │
  │      ▼                                           │
  │  ┌──────────┐  根据 method + path 找到处理函数     │
  │  │ 路由匹配  │                                    │
  │  └──────────┘                                    │
  │      │                                           │
  │      ▼                                           │
  │  ┌──────────┐  按顺序执行中间件                    │
  │  │ 中间件链  │                                    │
  │  └──────────┘                                    │
  │      │                                           │
  │      ▼                                           │
  │  ┌──────────┐  res.json() / res.send() 等        │
  │  │ 发送响应  │                                    │
  │  └──────────┘                                    │
  └─────────────────────────────────────────────────┘
```

---

## 二、Express.js 简介

### 2.1 什么是 Express

**Express.js** 是 Node.js 最流行的 Web 框架，它提供了：
- 简洁的路由系统
- 强大的中间件机制
- 丰富的 HTTP 工具方法
- 灵活的模板引擎支持

### 2.2 Express 的设计哲学

```
Express 的设计哲学：极简、灵活、可扩展

  核心很小 → 只提供最基本的功能
  中间件机制 → 通过中间件扩展功能
  不强制约定 → 项目结构完全由你决定

类比：
  Express 像乐高积木的基础板
  中间件像各种乐高积木块
  你可以自由组合出任何形状
```

---

## 三、安装与初始化

### 3.1 安装 Express

```bash
# 在项目目录下
npm install express

# 查看安装的版本
npm list express
```

### 3.2 第一个 Express 应用

```javascript
// src/index.js
const express = require('express');

// 创建 Express 应用
const app = express();

// 定义路由
app.get('/', (req, res) => {
    res.send('Hello Express!');
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Express 服务器运行在 http://localhost:${PORT}`);
});
```

```bash
# 运行
node src/index.js

# 测试
curl http://localhost:3000
# 输出：Hello Express!
```

---

## 四、HTTP 方法与路由

### 4.1 RESTful 路由

```javascript
const express = require('express');
const app = express();

// 解析 JSON 请求体
app.use(express.json());

// ========== GET 请求 ==========

// 获取所有用户
app.get('/api/users', (req, res) => {
    res.json({
        users: [
            { id: 1, name: '张三', email: 'zhangsan@example.com' },
            { id: 2, name: '李四', email: 'lisi@example.com' }
        ]
    });
});

// 获取单个用户（路径参数）
app.get('/api/users/:id', (req, res) => {
    const { id } = req.params;
    res.json({
        user: { id: parseInt(id), name: '用户' + id }
    });
});

// ========== POST 请求 ==========

// 创建用户
app.post('/api/users', (req, res) => {
    const { name, email } = req.body;

    // 简单验证
    if (!name || !email) {
        return res.status(400).json({
            error: '姓名和邮箱为必填项'
        });
    }

    // 创建用户（模拟）
    const newUser = {
        id: 3,
        name,
        email,
        createdAt: new Date().toISOString()
    };

    res.status(201).json({
        message: '用户创建成功',
        user: newUser
    });
});

// ========== PUT 请求 ==========

// 更新用户（完整替换）
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, email } = req.body;

    res.json({
        message: `用户 ${id} 更新成功`,
        user: { id: parseInt(id), name, email }
    });
});

// ========== PATCH 请求 ==========

// 部分更新用户
app.patch('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    res.json({
        message: `用户 ${id} 部分更新成功`,
        updates
    });
});

// ========== DELETE 请求 ==========

// 删除用户
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;

    res.json({
        message: `用户 ${id} 删除成功`
    });
});

// 启动服务器
app.listen(3000, () => {
    console.log('服务器运行在 http://localhost:3000');
});
```

### 4.2 测试路由

```bash
# GET 请求
curl http://localhost:3000/api/users
curl http://localhost:3000/api/users/1

# POST 请求
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"王五","email":"wangwu@example.com"}'

# PUT 请求
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"张三三","email":"zhangsansan@example.com"}'

# PATCH 请求
curl -X PATCH http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"新名字"}'

# DELETE 请求
curl -X DELETE http://localhost:3000/api/users/1
```

---

## 五、req 对象详解

### 5.1 请求属性

```javascript
app.get('/api/debug', (req, res) => {
    res.json({
        // 请求方法
        method: req.method,           // 'GET', 'POST', etc.

        // URL 相关
        url: req.url,                 // '/api/debug?foo=bar'
        path: req.path,               // '/api/debug'
        originalUrl: req.originalUrl, // '/api/debug?foo=bar'
        baseUrl: req.baseUrl,         // '' (路由挂载点)
        hostname: req.hostname,       // 'localhost'
        ip: req.ip,                   // '127.0.0.1'

        // 路径参数（:id 这种）
        params: req.params,           // { id: '123' }

        // 查询参数（?key=value）
        query: req.query,             // { foo: 'bar' }

        // 请求体（需要中间件解析）
        body: req.body,               // POST/PUT 的数据

        // 请求头
        headers: req.headers,         // 所有请求头
        get: req.get.bind(req),       // req.get('Content-Type')

        // 协议
        protocol: req.protocol,       // 'http' 或 'https'
        secure: req.secure,           // true 如果是 HTTPS

        // 内容类型
        is: req.is.bind(req),         // req.is('json')
    });
});
```

### 5.2 路径参数（req.params）

```javascript
// 路径参数用 : 标记
app.get('/api/users/:id', (req, res) => {
    console.log(req.params);  // { id: '123' }
    console.log(req.params.id);  // '123'
    res.json({ userId: req.params.id });
});

// 多个路径参数
app.get('/api/users/:userId/posts/:postId', (req, res) => {
    console.log(req.params);
    // { userId: '1', postId: '5' }
    res.json({
        userId: req.params.userId,
        postId: req.params.postId
    });
});

// 正则表达式参数
app.get('/api/files/:filename([a-z0-9]+)', (req, res) => {
    // 只匹配小写字母和数字
    res.json({ filename: req.params.filename });
});

// 可选参数
app.get('/api/users/:id?', (req, res) => {
    // ? 表示可选
    if (req.params.id) {
        res.json({ userId: req.params.id });
    } else {
        res.json({ message: '获取所有用户' });
    }
});
```

### 5.3 查询参数（req.query）

```javascript
// 查询参数是 URL 中 ? 后面的部分
// GET /api/users?page=1&limit=10&sort=name&order=asc

app.get('/api/users', (req, res) => {
    console.log(req.query);
    // {
    //   page: '1',
    //   limit: '10',
    //   sort: 'name',
    //   order: 'asc'
    // }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'id';
    const order = req.query.order || 'asc';

    res.json({
        page,
        limit,
        sort,
        order,
        users: []
    });
});

// 数组查询参数
// GET /api/users?ids=1,2,3
app.get('/api/users', (req, res) => {
    const ids = req.query.ids ? req.query.ids.split(',') : [];
    res.json({ ids });
});

// GET /api/users?ids[]=1&ids[]=2&ids[]=3
app.get('/api/users', (req, res) => {
    const ids = req.query.ids || [];
    // Express 自动解析为数组
    res.json({ ids });
});
```

### 5.4 请求体（req.body）

```javascript
// 需要中间件解析请求体
app.use(express.json());  // 解析 JSON
app.use(express.urlencoded({ extended: true }));  // 解析 URL-encoded

app.post('/api/users', (req, res) => {
    console.log(req.body);
    // { name: '张三', email: 'zhangsan@example.com' }

    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: '姓名和邮箱为必填项' });
    }

    res.status(201).json({ name, email });
});
```

---

## 六、res 对象详解

### 6.1 发送响应

```javascript
// ========== 发送文本 ==========
app.get('/text', (req, res) => {
    res.send('Hello World');
});

// ========== 发送 JSON ==========
app.get('/json', (req, res) => {
    res.json({ message: 'Hello', data: [1, 2, 3] });
});

// ========== 发送状态码 ==========
app.get('/not-found', (req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// ========== 设置响应头 ==========
app.get('/headers', (req, res) => {
    res.set('X-Custom-Header', 'value');
    res.set('Cache-Control', 'no-cache');
    res.json({ message: '查看响应头' });
});

// ========== 链式调用 ==========
app.get('/chain', (req, res) => {
    res
        .status(200)
        .set('X-Powered-By', 'Express')
        .json({ message: '链式调用' });
});

// ========== 发送文件 ==========
app.get('/file', (req, res) => {
    res.sendFile('/path/to/file.html');
});

// ========== 重定向 ==========
app.get('/old-path', (req, res) => {
    res.redirect('/new-path');
});

// ========== 下载文件 ==========
app.get('/download', (req, res) => {
    res.download('/path/to/file.pdf', 'report.pdf');
});
```

### 6.2 常用响应方法

```
res.send(body)       发送响应（自动设置 Content-Type）
res.json(obj)        发送 JSON 响应
res.status(code)     设置状态码
res.set(name, val)   设置响应头
res.get(name)        获取响应头
res.redirect(url)    重定向
res.sendFile(path)   发送文件
res.download(path)   下载文件
res.render(view)     渲染模板（需要模板引擎）
res.end()            结束响应（不发送数据）
res.write(chunk)     写入数据块（流式响应）
```

---

## 七、中间件初体验

### 7.1 什么是中间件

```
中间件（Middleware）是 Express 的核心概念：

类比：工厂流水线

  原料 → [清洗] → [切割] → [烹饪] → [装盘] → 成品

  请求 → [日志] → [认证] → [路由处理] → [错误处理] → 响应

每个中间件做一件事：
  - 日志中间件：记录请求信息
  - 认证中间件：检查用户身份
  - 路由处理：返回数据
  - 错误处理：统一处理错误
```

### 7.2 app.use() 是什么

```javascript
const express = require('express');
const app = express();

// app.use() 注册一个中间件
// 它会在每个请求到达路由处理函数之前执行

// 中间件函数签名
// (req, res, next) => { ... }
// next() 表示"继续执行下一个中间件"

// ========== 日志中间件 ==========
app.use((req, res, next) => {
    const start = Date.now();
    console.log(`→ ${req.method} ${req.url}`);

    // 监听响应结束事件
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`← ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
    });

    next();  // 继续执行下一个中间件
});

// ========== JSON 解析中间件 ==========
app.use(express.json());

// ========== 路由处理 ==========
app.get('/api/users', (req, res) => {
    res.json({ users: [] });
});

app.listen(3000);
```

### 7.3 中间件执行顺序

```javascript
const express = require('express');
const app = express();

// 中间件 1：最先执行
app.use((req, res, next) => {
    console.log('中间件 1 - 开始');
    next();
    console.log('中间件 1 - 结束');
});

// 中间件 2：第二个执行
app.use((req, res, next) => {
    console.log('中间件 2 - 开始');
    next();
    console.log('中间件 2 - 结束');
});

// 路由处理
app.get('/', (req, res) => {
    console.log('路由处理');
    res.send('Hello');
});

// 中间件 3：最后执行（如果没有 next）
app.use((req, res, next) => {
    console.log('中间件 3 - 这里不会执行，因为路由已经发送了响应');
});

// 输出顺序：
// 中间件 1 - 开始
// 中间件 2 - 开始
// 路由处理
// 中间件 2 - 结束
// 中间件 1 - 结束
```

### 7.4 内置中间件

```javascript
const express = require('express');
const app = express();

// 解析 JSON 请求体
app.use(express.json());

// 解析 URL-encoded 请求体（表单数据）
app.use(express.urlencoded({ extended: true }));

// 提供静态文件服务
app.use(express.static('public'));

// 提供静态文件服务（带路径前缀）
app.use('/static', express.static('public'));
// 访问 /static/style.css 实际读取 public/style.css
```

---

## 八、实战：创建博客 API

### 8.1 完整代码

```javascript
// src/blog-api.js
const express = require('express');
const app = express();

// ========== 中间件 ==========

// 解析 JSON
app.use(express.json());

// 请求日志
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

// CORS（跨域支持）
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 预检请求
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// ========== 模拟数据库 ==========

let posts = [
    {
        id: 1,
        title: 'Node.js 入门指南',
        content: 'Node.js 是一个基于 V8 引擎的 JavaScript 运行时...',
        author: '张三',
        tags: ['nodejs', 'javascript', 'backend'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z'
    },
    {
        id: 2,
        title: 'Express 框架详解',
        content: 'Express 是 Node.js 最流行的 Web 框架...',
        author: '李四',
        tags: ['express', 'nodejs', 'api'],
        createdAt: '2024-01-16T14:30:00Z',
        updatedAt: '2024-01-16T14:30:00Z'
    }
];

let nextId = 3;

// ========== 路由 ==========

// 首页
app.get('/', (req, res) => {
    res.json({
        name: '博客 API',
        version: '1.0.0',
        endpoints: {
            posts: '/api/posts',
            users: '/api/users'
        }
    });
});

// ---------- 文章 CRUD ----------

// 获取文章列表
app.get('/api/posts', (req, res) => {
    const { page = 1, limit = 10, tag, author } = req.query;

    let filteredPosts = [...posts];

    // 按标签筛选
    if (tag) {
        filteredPosts = filteredPosts.filter(p =>
            p.tags.includes(tag)
        );
    }

    // 按作者筛选
    if (author) {
        filteredPosts = filteredPosts.filter(p =>
            p.author === author
        );
    }

    // 分页
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

    res.json({
        data: paginatedPosts,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: filteredPosts.length,
            totalPages: Math.ceil(filteredPosts.length / parseInt(limit))
        }
    });
});

// 获取单篇文章
app.get('/api/posts/:id', (req, res) => {
    const post = posts.find(p => p.id === parseInt(req.params.id));

    if (!post) {
        return res.status(404).json({
            error: '文章不存在',
            code: 'POST_NOT_FOUND'
        });
    }

    res.json({ data: post });
});

// 创建文章
app.post('/api/posts', (req, res) => {
    const { title, content, author, tags = [] } = req.body;

    // 验证
    const errors = [];
    if (!title) errors.push('标题为必填项');
    if (!content) errors.push('内容为必填项');
    if (!author) errors.push('作者为必填项');

    if (errors.length > 0) {
        return res.status(400).json({
            error: '验证失败',
            details: errors
        });
    }

    const now = new Date().toISOString();
    const newPost = {
        id: nextId++,
        title,
        content,
        author,
        tags,
        createdAt: now,
        updatedAt: now
    };

    posts.push(newPost);

    res.status(201).json({
        message: '文章创建成功',
        data: newPost
    });
});

// 更新文章
app.put('/api/posts/:id', (req, res) => {
    const postIndex = posts.findIndex(p => p.id === parseInt(req.params.id));

    if (postIndex === -1) {
        return res.status(404).json({
            error: '文章不存在'
        });
    }

    const { title, content, author, tags } = req.body;

    // 更新文章
    posts[postIndex] = {
        ...posts[postIndex],
        title: title || posts[postIndex].title,
        content: content || posts[postIndex].content,
        author: author || posts[postIndex].author,
        tags: tags || posts[postIndex].tags,
        updatedAt: new Date().toISOString()
    };

    res.json({
        message: '文章更新成功',
        data: posts[postIndex]
    });
});

// 删除文章
app.delete('/api/posts/:id', (req, res) => {
    const postIndex = posts.findIndex(p => p.id === parseInt(req.params.id));

    if (postIndex === -1) {
        return res.status(404).json({
            error: '文章不存在'
        });
    }

    const deletedPost = posts.splice(postIndex, 1)[0];

    res.json({
        message: '文章删除成功',
        data: deletedPost
    });
});

// ---------- 统计接口 ----------

app.get('/api/stats', (req, res) => {
    const tagCount = {};
    posts.forEach(post => {
        post.tags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1;
        });
    });

    res.json({
        totalPosts: posts.length,
        tagStats: tagCount,
        authors: [...new Set(posts.map(p => p.author))]
    });
});

// ========== 错误处理 ==========

// 404 处理
app.use((req, res) => {
    res.status(404).json({
        error: '路由不存在',
        path: req.url
    });
});

// 全局错误处理
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ========== 启动服务器 ==========

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`博客 API 运行在 http://localhost:${PORT}`);
    console.log('');
    console.log('可用接口:');
    console.log('  GET    /                     - API 信息');
    console.log('  GET    /api/posts             - 文章列表');
    console.log('  GET    /api/posts/:id         - 文章详情');
    console.log('  POST   /api/posts             - 创建文章');
    console.log('  PUT    /api/posts/:id         - 更新文章');
    console.log('  DELETE /api/posts/:id         - 删除文章');
    console.log('  GET    /api/stats             - 统计信息');
});
```

### 8.2 测试 API

```bash
# 启动服务器
node src/blog-api.js

# 获取 API 信息
curl http://localhost:3000/

# 获取文章列表
curl http://localhost:3000/api/posts

# 带分页和筛选
curl "http://localhost:3000/api/posts?page=1&limit=1&tag=nodejs"

# 获取单篇文章
curl http://localhost:3000/api/posts/1

# 创建文章
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "新文章",
    "content": "这是一篇新文章的内容...",
    "author": "王五",
    "tags": ["test", "demo"]
  }'

# 更新文章
curl -X PUT http://localhost:3000/api/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "更新后的标题"}'

# 删除文章
curl -X DELETE http://localhost:3000/api/posts/3

# 获取统计
curl http://localhost:3000/api/stats
```

---

## 九、动手练习

### 练习 1：基础路由

```javascript
// 创建一个 Express 应用，实现：
// 1. GET / 返回欢迎信息
// 2. GET /about 返回关于信息
// 3. GET /time 返回当前时间
// 4. GET /random 返回 1-100 的随机数
// 5. GET /greet?name=xxx 返回问候语
```

### 练习 2：待办事项 API

```javascript
// 创建一个待办事项 API：
// 1. GET /api/todos - 获取所有待办
// 2. POST /api/todos - 创建待办
// 3. PUT /api/todos/:id - 更新待办
// 4. DELETE /api/todos/:id - 删除待办

// 数据结构：
// { id, title, completed: false, createdAt }
```

### 练习 3：计算器 API

```javascript
// 创建一个计算器 API：
// GET /api/calc/add?a=1&b=2 → { result: 3 }
// GET /api/calc/sub?a=5&b=3 → { result: 2 }
// GET /api/calc/mul?a=2&b=4 → { result: 8 }
// GET /api/calc/div?a=10&b=2 → { result: 5 }
```

---

## 常见误区

1. **忘记调用 next() 导致请求挂起**：中间件函数必须调用 `next()` 将控制权传递给下一个中间件，或者调用 `res.send()` 等方法结束响应。两者都不做，请求会一直挂起直到超时。
2. **在路由之后注册 body 解析中间件**：`express.json()` 必须在路由之前注册，否则 `req.body` 为 `undefined`。中间件按注册顺序执行，解析请求体必须在路由处理之前完成。
3. **把所有路由写在一个文件里**：当 API 越来越多时，单文件会膨胀到几千行。应该用 `express.Router()` 将路由按模块拆分到不同文件。
4. **不处理异步路由中的错误**：Express 不会自动捕获 async 函数中的错误。如果异步路由抛出异常，服务器会崩溃。需要用 try-catch 包裹或使用 `express-async-errors` 库。

## 工程建议

1. **将 app.js 和 index.js 分离**：`app.js` 负责创建 Express 应用、注册中间件和路由；`index.js` 只负责调用 `app.listen()`。这样方便在测试中导入 app 而不启动服务器。
2. **使用 res.status().json() 而非 res.send()**：`res.json()` 会自动设置 `Content-Type: application/json` 并序列化对象，`res.send()` 在传入对象时虽然也能工作，但语义不够明确。
3. **路由处理函数保持简短**：路由函数应该只做三件事——提取参数、调用服务层、返回响应。业务逻辑放在 Service 层，数据访问放在 Repository 层。
4. **开发环境使用 nodemon 自动重启**：安装 nodemon 并配置 `npm run dev` 脚本，修改代码后自动重启服务器，避免手动停止再启动的麻烦。

## 十、小结

```
本课核心知识点：

✅ Express 是 Node.js 最流行的 Web 框架
✅ 路由：app.get/post/put/patch/delete
✅ req 对象：params、query、body、headers
✅ res 对象：json()、send()、status()、redirect()
✅ 中间件：app.use() 注册，next() 传递控制权
✅ 内置中间件：express.json()、express.static()

关键记忆点：
  - Express 极简、灵活，通过中间件扩展功能
  - 路由参数用 :id，查询参数用 req.query
  - res.json() 自动设置 Content-Type 为 application/json
  - 中间件按注册顺序执行
  - next() 将控制权传递给下一个中间件

下一课预告：
  我们将深入学习路由模块化和中间件的高级用法。
```

---

> **给前端开发者的话：** Express 的路由系统就像 React Router——都是将 URL 映射到处理函数。不同的是，React Router 在浏览器端渲染组件，Express 在服务器端返回数据。理解了这个类比，你会发现后端路由其实很亲切。
