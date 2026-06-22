# 第九课：阶段实战 — 博客 API 基础版

## 场景引入

前 8 课你分别学了 Node.js 基础、npm 包管理、模块系统、内置模块、Express 框架、路由与中间件、RESTful API 设计、请求验证与错误处理。但这些都是零散的知识点，就像学了做菜的刀工、火候、调味，但还没做过一道完整的菜。这节课的目标是把所有知识串起来，从零构建一个完整的博客 API——包含用户、文章、评论三个模块的 CRUD，统一的验证和错误处理，以及规范的项目结构。做完这个项目，你就拥有了一个可以拿去面试的后端作品。

## 学习目标

完成本课学习后，你将能够：

1. 将前 8 课所学知识整合到一个完整项目中
2. 按功能模块组织后端项目目录结构
3. 实现用户、文章、评论三个模块的完整 CRUD API
4. 使用 Zod 进行请求验证，使用统一错误处理中间件
5. 设计统一的响应格式
6. 使用 ESLint + Prettier 规范代码风格
7. 使用 curl 测试所有 API 接口

---

## 一、项目概览

### 1.1 我们要构建什么

这是一个 **博客 API 基础版**，包含三个核心模块：

```
博客系统功能：

  用户模块（Users）
    - 注册新用户
    - 查看用户列表
    - 查看用户详情
    - 更新用户信息
    - 删除用户

  文章模块（Posts）
    - 发布新文章
    - 查看文章列表（支持按状态筛选）
    - 查看文章详情
    - 更新文章
    - 删除文章

  评论模块（Comments）
    - 对文章发表评论
    - 查看某篇文章的所有评论
    - 删除评论
```

### 1.2 技术选型

```
技术栈：

  运行时      Node.js
  语言        JavaScript（CommonJS 模块系统）
  框架        Express.js
  验证        Zod
  代码规范    ESLint + Prettier
  数据存储    内存数组（暂不使用数据库）
```

### 1.3 项目目录结构

```
blog-api/
├── package.json
├── .eslintrc.json
├── .prettierrc
├── src/
│   ├── index.js              # 入口文件
│   ├── app.js                # Express 应用配置
│   ├── data/
│   │   └── store.js          # 内存数据存储
│   ├── controllers/
│   │   ├── userController.js
│   │   ├── postController.js
│   │   └── commentController.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── userRoutes.js
│   │   ├── postRoutes.js
│   │   └── commentRoutes.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   ├── logger.js
│   │   └── validate.js
│   ├── validators/
│   │   ├── userValidator.js
│   │   ├── postValidator.js
│   │   └── commentValidator.js
│   └── utils/
│       ├── response.js       # 统一响应格式
│       └── errors.js         # 自定义错误类
```

> **前端开发者注意：** 这个目录结构和你熟悉的 React/Vue 项目很像 —— 按功能分文件夹，每个文件职责单一。`routes` 相当于前端的路由配置，`controllers` 相当于页面/组件的逻辑层，`middleware` 相当于请求拦截器。

---

## 二、项目初始化

### 2.1 创建项目并安装依赖

```bash
# 创建项目目录
mkdir blog-api
cd blog-api

# 初始化 package.json
npm init -y

# 安装生产依赖
npm install express zod

# 安装开发依赖
npm install --save-dev nodemon eslint prettier
```

### 2.2 配置 package.json

编辑 `package.json`，添加启动脚本：

```json
{
  "name": "blog-api",
  "version": "1.0.0",
  "description": "博客 API 基础版 — 阶段实战项目",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write src/"
  },
  "keywords": [],
  "license": "ISC"
}
```

> **脚本说明：**
> - `npm start` — 用 Node 直接运行（生产环境）
> - `npm run dev` — 用 nodemon 自动重启（开发环境，改代码后自动刷新）
> - `npm run lint` — 检查代码规范
> - `npm run format` — 用 Prettier 自动格式化

### 2.3 创建目录结构

```bash
# 创建所有目录
mkdir -p src/data src/controllers src/routes src/middleware src/validators src/utils
```

---

## 三、基础层实现

### 3.1 统一响应工具 (`src/utils/response.js`)

前后端交互需要统一的响应格式，就像前端项目中统一的 API 返回类型一样。

```javascript
// src/utils/response.js

/**
 * 统一成功响应
 * @param {object} res - Express 响应对象
 * @param {*} data - 响应数据
 * @param {number} statusCode - HTTP 状态码
 */
function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
}

/**
 * 统一错误响应
 * @param {object} res - Express 响应对象
 * @param {string} message - 错误消息
 * @param {number} statusCode - HTTP 状态码
 * @param {*} details - 错误详情（如验证错误）
 */
function error(res, message, statusCode = 500, details = null) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      message,
      details,
    },
  });
}

module.exports = { success, error };
```

> **为什么需要统一响应格式？** 前端在调用 API 时，总是需要判断请求是否成功。如果每个接口返回的结构都不一样，前端代码就会充满 `if/else`。统一格式后，前端可以写一个通用的响应处理函数。
>
> ```javascript
> // 前端调用示例（了解即可）
> const res = await fetch('/api/users');
> const json = await res.json();
> if (json.success) {
>   console.log(json.data);    // 成功，使用数据
> } else {
>   console.error(json.error); // 失败，显示错误
> }
> ```

### 3.2 自定义错误类 (`src/utils/errors.js`)

```javascript
// src/utils/errors.js

/**
 * 应用自定义错误基类
 * 继承自 Error，额外包含 statusCode 和 details
 */
class AppError extends Error {
  /**
   * @param {string} message - 错误消息
   * @param {number} statusCode - HTTP 状态码
   * @param {*} details - 额外错误详情
   */
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * 资源不存在错误（404）
 */
class NotFoundError extends AppError {
  constructor(resource = '资源', id = '') {
    const msg = id
      ? `${resource}（ID: ${id}）不存在`
      : `${resource}不存在`;
    super(msg, 404);
  }
}

/**
 * 请求验证错误（400）
 */
class ValidationError extends AppError {
  constructor(details) {
    super('请求数据验证失败', 400, details);
  }
}

/**
 * 关联资源错误（409）
 */
class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
};
```

### 3.3 内存数据存储 (`src/data/store.js`)

在真实项目中，数据存在数据库里。这里我们用 **内存数组** 模拟数据库，帮你理解后端对数据的操作逻辑。

```javascript
// src/data/store.js

/**
 * 内存数据存储
 *
 * 这三个数组就是我们的"数据库"。
 * 服务器重启后数据会丢失，这在开发和学习阶段是可接受的。
 * 第二阶段我们会用 PostgreSQL + Prisma 替换这里。
 */

// 用户数据
const users = [
  {
    id: '1',
    name: '张三',
    email: 'zhangsan@example.com',
    bio: '全栈开发者，热爱编程',
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-01T08:00:00.000Z',
  },
  {
    id: '2',
    name: '李四',
    email: 'lisi@example.com',
    bio: '前端工程师，正在学后端',
    createdAt: '2026-05-02T10:30:00.000Z',
    updatedAt: '2026-05-02T10:30:00.000Z',
  },
];

// 文章数据
const posts = [
  {
    id: '1',
    title: 'Node.js 入门指南',
    content: 'Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时...',
    authorId: '1',
    status: 'published',
    tags: ['nodejs', 'javascript'],
    createdAt: '2026-05-03T09:00:00.000Z',
    updatedAt: '2026-05-03T09:00:00.000Z',
  },
  {
    id: '2',
    title: 'Express 路由详解',
    content: 'Express 提供了强大而灵活的路由系统...',
    authorId: '1',
    status: 'published',
    tags: ['express', 'nodejs'],
    createdAt: '2026-05-04T14:00:00.000Z',
    updatedAt: '2026-05-04T14:00:00.000Z',
  },
  {
    id: '3',
    title: 'RESTful API 设计草稿',
    content: '这篇文章正在编写中...',
    authorId: '2',
    status: 'draft',
    tags: ['api', 'rest'],
    createdAt: '2026-05-05T16:00:00.000Z',
    updatedAt: '2026-05-05T16:00:00.000Z',
  },
];

// 评论数据
const comments = [
  { id: '1', postId: '1', authorId: '2', content: '写得很清楚，对我帮助很大！', createdAt: '2026-05-04T10:00:00.000Z' },
  { id: '2', postId: '1', authorId: '1', content: '谢谢支持，后续还会更新更多内容。', createdAt: '2026-05-04T11:30:00.000Z' },
  { id: '3', postId: '2', authorId: '2', content: '中间件那部分能再详细讲讲吗？', createdAt: '2026-05-05T09:00:00.000Z' },
];

// ID 计数器（模拟数据库自增 ID）
let userIdCounter = 3;
let postIdCounter = 4;
let commentIdCounter = 4;

/**
 * 生成新的唯一 ID
 * @param {string} type - 数据类型：'user' | 'post' | 'comment'
 * @returns {string} 新的 ID
 */
function generateId(type) {
  switch (type) {
    case 'user':
      return String(++userIdCounter);
    case 'post':
      return String(++postIdCounter);
    case 'comment':
      return String(++commentIdCounter);
    default:
      throw new Error(`未知的数据类型: ${type}`);
  }
}

module.exports = {
  users,
  posts,
  comments,
  generateId,
};
```

> **关键概念 — 模块级别的变量：** 这里的 `users`、`posts`、`comments` 是数组引用。当 `require` 这个模块时，所有使用者拿到的是同一个引用，因此在一个地方修改数组（push、splice），其他地方也能看到变化。这就是 Node.js 的 **模块缓存机制**。

---

## 四、中间件实现

### 4.1 请求日志中间件 (`src/middleware/logger.js`)

```javascript
// src/middleware/logger.js

/**
 * 请求日志中间件
 * 记录每个请求的方法、路径、状态码和耗时
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  const { method, url } = req;

  // 监听响应的 finish 事件（响应发送完毕后触发）
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const timestamp = new Date().toISOString();

    // 根据状态码选择日志级别标记
    let level = 'INFO';
    if (statusCode >= 400 && statusCode < 500) {
      level = 'WARN';
    } else if (statusCode >= 500) {
      level = 'ERROR';
    }

    console.log(
      `[${timestamp}] ${level} ${method} ${url} → ${statusCode} (${duration}ms)`
    );
  });

  next();
}

module.exports = requestLogger;
```

### 4.2 请求验证中间件 (`src/middleware/validate.js`)

```javascript
// src/middleware/validate.js

const { ValidationError } = require('../utils/errors');

/**
 * 创建 Zod 验证中间件
 *
 * 这是一个 **高阶函数**（Higher-Order Function），
 * 接收一个 Zod schema，返回一个 Express 中间件。
 *
 * 前端类比：就像 Formik 或 react-hook-form 的 schema 验证。
 *
 * @param {object} schema - Zod schema 对象
 * @param {string} source - 验证的数据来源：'body' | 'query' | 'params'
 * @returns {Function} Express 中间件函数
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const dataToValidate = req[source];

    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      // 将 Zod 的错误格式转换为更友好的格式
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      }));

      throw new ValidationError(formattedErrors);
    }

    // 将验证后的数据（可能经过类型转换）放回 req
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
```

### 4.3 统一错误处理中间件 (`src/middleware/errorHandler.js`)

```javascript
// src/middleware/errorHandler.js

const { AppError } = require('../utils/errors');
const response = require('../utils/response');

/**
 * 全局错误处理中间件
 *
 * Express 规定：错误处理中间件必须有 4 个参数 (err, req, res, next)。
 * 当任何路由或中间件调用 next(err) 或抛出异常时，会跳过后续中间件，
 * 直接进入这个错误处理函数。
 *
 * @param {Error} err - 错误对象
 * @param {object} req - Express 请求对象
 * @param {object} res - Express 响应对象
 * @param {Function} next - 下一个中间件（必须声明，即使不使用）
 */
function errorHandler(err, req, res, next) {
  // 如果是我们定义的 AppError，使用其状态码和消息
  if (err instanceof AppError) {
    return response.error(res, err.message, err.statusCode, err.details);
  }

  // Zod 原生错误（未被 validate 中间件捕获的情况）
  if (err.name === 'ZodError') {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.') || 'root',
      message: issue.message,
    }));
    return response.error(res, '请求数据验证失败', 400, formattedErrors);
  }

  // JSON 解析错误（请求体不是合法 JSON）
  if (err.type === 'entity.parse.failed') {
    return response.error(res, '请求体不是合法的 JSON 格式', 400);
  }

  // 未知错误 — 打印详细信息到控制台，但不暴露给客户端
  console.error('未预期的错误:', err);
  return response.error(res, '服务器内部错误', 500);
}

module.exports = errorHandler;
```

---

## 五、验证规则定义

### 5.1 用户验证器 (`src/validators/userValidator.js`)

```javascript
// src/validators/userValidator.js
const { z } = require('zod');

// 创建用户的验证规则
const createUser = z.object({
  name: z.string({ required_error: '姓名为必填项' }).min(2, '姓名至少 2 个字符').max(50),
  email: z.string({ required_error: '邮箱为必填项' }).email('邮箱格式不正确'),
  bio: z.string().max(200).optional(),
});

// 更新用户（所有字段可选，但至少提供一个）
const updateUser = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  bio: z.string().max(200).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '至少需要提供一个要更新的字段',
});

const userId = z.object({ id: z.string().min(1, '用户 ID 不能为空') });

module.exports = { createUser, updateUser, userId };
```

### 5.2 文章验证器 (`src/validators/postValidator.js`)

```javascript
// src/validators/postValidator.js
const { z } = require('zod');

const statusEnum = z.enum(['draft', 'published'], {
  errorMap: () => ({ message: '状态只能是 draft 或 published' }),
});

// 创建文章
const createPost = z.object({
  title: z.string({ required_error: '标题为必填项' }).min(1, '标题不能为空').max(200),
  content: z.string({ required_error: '内容为必填项' }).min(1, '内容不能为空'),
  authorId: z.string({ required_error: '作者 ID 为必填项' }).min(1),
  status: statusEnum.optional().default('draft'),
  tags: z.array(z.string().min(1)).max(10).optional().default([]),
});

// 更新文章（所有字段可选，但至少提供一个）
const updatePost = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  status: statusEnum.optional(),
  tags: z.array(z.string().min(1)).max(10).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '至少需要提供一个要更新的字段',
});

// 查询参数（文章列表筛选）
const postQuery = z.object({
  status: statusEnum.optional(),
  authorId: z.string().optional(),
});

const postId = z.object({ id: z.string().min(1, '文章 ID 不能为空') });

module.exports = { createPost, updatePost, postQuery, postId };
```

### 5.3 评论验证器 (`src/validators/commentValidator.js`)

```javascript
// src/validators/commentValidator.js
const { z } = require('zod');

const createComment = z.object({
  authorId: z.string({ required_error: '作者 ID 为必填项' }).min(1),
  content: z.string({ required_error: '评论内容为必填项' }).min(1).max(1000),
});

const postIdParam = z.object({
  postId: z.string().min(1, '文章 ID 不能为空'),
});

const commentIdParam = z.object({
  postId: z.string().min(1, '文章 ID 不能为空'),
  commentId: z.string().min(1, '评论 ID 不能为空'),
});

module.exports = { createComment, postIdParam, commentIdParam };
```

---

## 六、控制器实现

**控制器（Controller）** 是处理业务逻辑的地方。每个路由对应一个控制器函数，它负责：
1. 从请求中提取数据
2. 执行业务逻辑（操作数据）
3. 返回响应

> **前端类比：** 控制器就像是前端的 event handler，只不过处理的是 HTTP 请求而不是点击事件。

### 6.1 用户控制器 (`src/controllers/userController.js`)

```javascript
// src/controllers/userController.js

const store = require('../data/store');
const { generateId } = require('../data/store');
const { NotFoundError, ConflictError } = require('../utils/errors');
const response = require('../utils/response');

/** GET /api/users — 获取所有用户 */
function getUsers(req, res) {
  return response.success(res, store.users.map((u) => ({ ...u })));
}

/** GET /api/users/:id — 获取单个用户 */
function getUserById(req, res) {
  const user = store.users.find((u) => u.id === req.params.id);
  if (!user) { throw new NotFoundError('用户', req.params.id); }
  return response.success(res, { ...user });
}

/** POST /api/users — 创建用户 */
function createUser(req, res) {
  const { name, email, bio } = req.body;
  if (store.users.find((u) => u.email === email)) {
    throw new ConflictError('该邮箱已被注册');
  }

  const now = new Date().toISOString();
  const newUser = {
    id: generateId('user'), name, email, bio: bio || '',
    createdAt: now, updatedAt: now,
  };
  store.users.push(newUser);
  return response.success(res, newUser, 201);
}

/** PUT /api/users/:id — 更新用户 */
function updateUser(req, res) {
  const { id } = req.params;
  const updates = req.body;
  const userIndex = store.users.findIndex((u) => u.id === id);
  if (userIndex === -1) { throw new NotFoundError('用户', id); }

  if (updates.email) {
    const conflict = store.users.find((u) => u.email === updates.email && u.id !== id);
    if (conflict) { throw new ConflictError('该邮箱已被其他用户使用'); }
  }

  store.users[userIndex] = {
    ...store.users[userIndex], ...updates,
    id, updatedAt: new Date().toISOString(),
  };
  return response.success(res, store.users[userIndex]);
}

/** DELETE /api/users/:id — 删除用户 */
function deleteUser(req, res) {
  const { id } = req.params;
  const userIndex = store.users.findIndex((u) => u.id === id);
  if (userIndex === -1) { throw new NotFoundError('用户', id); }

  if (store.posts.some((p) => p.authorId === id)) {
    throw new ConflictError('该用户下还有文章，请先删除相关文章');
  }

  const deletedUser = store.users.splice(userIndex, 1)[0];
  return response.success(res, { message: `用户「${deletedUser.name}」已删除` });
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
```

### 6.2 文章控制器 (`src/controllers/postController.js`)

```javascript
// src/controllers/postController.js

const store = require('../data/store');
const { generateId } = require('../data/store');
const { NotFoundError } = require('../utils/errors');
const response = require('../utils/response');

/** GET /api/posts — 获取文章列表（支持按 status、authorId 筛选） */
function getPosts(req, res) {
  const { status, authorId } = req.query;
  let posts = store.posts.map((post) => ({ ...post }));

  if (status) { posts = posts.filter((p) => p.status === status); }
  if (authorId) { posts = posts.filter((p) => p.authorId === authorId); }

  // 按创建时间倒序，补充作者信息
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const enrichedPosts = posts.map((post) => {
    const author = store.users.find((u) => u.id === post.authorId);
    return { ...post, author: author ? { id: author.id, name: author.name } : null };
  });

  return response.success(res, enrichedPosts);
}

/** GET /api/posts/:id — 获取单篇文章 */
function getPostById(req, res) {
  const post = store.posts.find((p) => p.id === req.params.id);
  if (!post) { throw new NotFoundError('文章', req.params.id); }

  const author = store.users.find((u) => u.id === post.authorId);
  return response.success(res, {
    ...post,
    author: author ? { id: author.id, name: author.name } : null,
  });
}

/** POST /api/posts — 创建文章 */
function createPost(req, res) {
  const { title, content, authorId, status, tags } = req.body;
  if (!store.users.find((u) => u.id === authorId)) {
    throw new NotFoundError('用户（作者）', authorId);
  }

  const now = new Date().toISOString();
  const newPost = {
    id: generateId('post'), title, content, authorId,
    status: status || 'draft', tags: tags || [],
    createdAt: now, updatedAt: now,
  };
  store.posts.push(newPost);
  return response.success(res, newPost, 201);
}

/** PUT /api/posts/:id — 更新文章 */
function updatePost(req, res) {
  const { id } = req.params;
  const postIndex = store.posts.findIndex((p) => p.id === id);
  if (postIndex === -1) { throw new NotFoundError('文章', id); }

  store.posts[postIndex] = {
    ...store.posts[postIndex], ...req.body,
    id,
    authorId: store.posts[postIndex].authorId, // 作者不可修改
    updatedAt: new Date().toISOString(),
  };
  return response.success(res, store.posts[postIndex]);
}

/** DELETE /api/posts/:id — 删除文章（同时删除该文章下的所有评论） */
function deletePost(req, res) {
  const { id } = req.params;
  const postIndex = store.posts.findIndex((p) => p.id === id);
  if (postIndex === -1) { throw new NotFoundError('文章', id); }

  const deletedCommentsCount = store.comments.filter((c) => c.postId === id).length;
  store.comments = store.comments.filter((c) => c.postId !== id);
  const deletedPost = store.posts.splice(postIndex, 1)[0];

  return response.success(res, {
    message: `文章「${deletedPost.title}」已删除`,
    deletedCommentsCount,
  });
}

module.exports = {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
};
```

### 6.3 评论控制器 (`src/controllers/commentController.js`)

```javascript
// src/controllers/commentController.js

const store = require('../data/store');
const { generateId } = require('../data/store');
const { NotFoundError } = require('../utils/errors');
const response = require('../utils/response');

/** GET /api/posts/:postId/comments — 获取文章的所有评论 */
function getCommentsByPostId(req, res) {
  const { postId } = req.params;
  if (!store.posts.find((p) => p.id === postId)) {
    throw new NotFoundError('文章', postId);
  }

  const comments = store.comments
    .filter((c) => c.postId === postId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const enrichedComments = comments.map((comment) => {
    const author = store.users.find((u) => u.id === comment.authorId);
    return { ...comment, author: author ? { id: author.id, name: author.name } : null };
  });

  return response.success(res, enrichedComments);
}

/** POST /api/posts/:postId/comments — 创建评论 */
function createComment(req, res) {
  const { postId } = req.params;
  const { authorId, content } = req.body;

  if (!store.posts.find((p) => p.id === postId)) {
    throw new NotFoundError('文章', postId);
  }
  const author = store.users.find((u) => u.id === authorId);
  if (!author) { throw new NotFoundError('用户（评论者）', authorId); }

  const newComment = {
    id: generateId('comment'), postId, authorId, content,
    createdAt: new Date().toISOString(),
  };
  store.comments.push(newComment);

  return response.success(res, {
    ...newComment, author: { id: author.id, name: author.name },
  }, 201);
}

/** DELETE /api/posts/:postId/comments/:commentId — 删除评论 */
function deleteComment(req, res) {
  const { postId, commentId } = req.params;

  if (!store.posts.find((p) => p.id === postId)) {
    throw new NotFoundError('文章', postId);
  }
  const commentIndex = store.comments.findIndex(
    (c) => c.id === commentId && c.postId === postId
  );
  if (commentIndex === -1) { throw new NotFoundError('评论', commentId); }

  store.comments.splice(commentIndex, 1);
  return response.success(res, { message: '评论已删除' });
}

module.exports = {
  getCommentsByPostId,
  createComment,
  deleteComment,
};
```

---

## 七、路由实现

### 7.1 用户路由 (`src/routes/userRoutes.js`)

```javascript
// src/routes/userRoutes.js
const { Router } = require('express');
const userController = require('../controllers/userController');
const validate = require('../middleware/validate');
const v = require('../validators/userValidator');

const router = Router();

router.get('/', userController.getUsers);
router.get('/:id', validate(v.userId, 'params'), userController.getUserById);
router.post('/', validate(v.createUser), userController.createUser);
router.put('/:id', validate(v.userId, 'params'), validate(v.updateUser), userController.updateUser);
router.delete('/:id', validate(v.userId, 'params'), userController.deleteUser);

module.exports = router;
```

### 7.2 文章路由 (`src/routes/postRoutes.js`)

```javascript
// src/routes/postRoutes.js
const { Router } = require('express');
const postController = require('../controllers/postController');
const validate = require('../middleware/validate');
const v = require('../validators/postValidator');

const router = Router();

router.get('/', validate(v.postQuery, 'query'), postController.getPosts);
router.get('/:id', validate(v.postId, 'params'), postController.getPostById);
router.post('/', validate(v.createPost), postController.createPost);
router.put('/:id', validate(v.postId, 'params'), validate(v.updatePost), postController.updatePost);
router.delete('/:id', validate(v.postId, 'params'), postController.deletePost);

module.exports = router;
```

### 7.3 评论路由 (`src/routes/commentRoutes.js`)

```javascript
// src/routes/commentRoutes.js
const { Router } = require('express');
const commentController = require('../controllers/commentController');
const validate = require('../middleware/validate');
const v = require('../validators/commentValidator');

const router = Router({ mergeParams: true });
// mergeParams: true 允许子路由访问父路由的参数（如 postId）

router.get('/', validate(v.postIdParam, 'params'), commentController.getCommentsByPostId);
router.post('/', validate(v.postIdParam, 'params'), validate(v.createComment), commentController.createComment);
router.delete('/:commentId', validate(v.commentIdParam, 'params'), commentController.deleteComment);

module.exports = router;
```

### 7.4 路由总入口 (`src/routes/index.js`)

```javascript
// src/routes/index.js

const { Router } = require('express');
const userRoutes = require('./userRoutes');
const postRoutes = require('./postRoutes');
const commentRoutes = require('./commentRoutes');
const response = require('../utils/response');

const router = Router();

// 健康检查接口 — 用于监控服务是否正常运行
router.get('/health', (req, res) => {
  return response.success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 挂载各模块路由
router.use('/users', userRoutes);
router.use('/posts', postRoutes);

// 评论是文章的子资源，嵌套在文章路由下
// 这符合 RESTful 规范：评论依附于文章存在
router.use('/posts/:postId/comments', commentRoutes);

module.exports = router;
```

> **RESTful 设计 — 子资源路由：** 评论（Comments）是文章（Posts）的子资源。URL 设计为 `/api/posts/:postId/comments` 而不是 `/api/comments`，因为它表达了"某篇文章的评论"这个语义。

---

## 八、应用组装与启动

### 8.1 Express 应用配置 (`src/app.js`)

```javascript
// src/app.js

const express = require('express');
const routes = require('./routes');
const requestLogger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./utils/errors');

// 创建 Express 应用实例
const app = express();

// ============ 全局中间件 ============

// 请求日志（放在最前面，确保所有请求都被记录）
app.use(requestLogger);

// 解析 JSON 请求体
// 前端类比：类似 axios 默认会设置 Content-Type: application/json
app.use(express.json());

// 解析 URL 编码的请求体（表单数据）
app.use(express.urlencoded({ extended: true }));

// ============ 路由 ============

// 所有 API 路由以 /api 为前缀
app.use('/api', routes);

// 404 处理 — 所有未匹配的路由都会进入这里
app.use((req, res, next) => {
  next(new NotFoundError(`路径 ${req.method} ${req.url}`));
});

// ============ 错误处理 ============

// 全局错误处理中间件（必须放在所有路由之后）
app.use(errorHandler);

module.exports = app;
```

> **中间件顺序很重要！** Express 的中间件按照 `app.use()` 的注册顺序依次执行。错误处理中间件必须放在最后，因为它是"兜底"的。

### 8.2 启动入口 (`src/index.js`)

```javascript
// src/index.js

const app = require('./app');

// 从环境变量读取端口，默认 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`  博客 API 服务已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  环境: ${process.env.NODE_ENV || 'development'}`);
  console.log('========================================');
  console.log('');
  console.log('主要接口:');
  console.log(`  健康检查: GET  /api/health`);
  console.log(`  用户:     CRUD /api/users`);
  console.log(`  文章:     CRUD /api/posts`);
  console.log(`  评论:     CRUD /api/posts/:postId/comments`);
  console.log('');
});
```

---

## 九、ESLint + Prettier 配置

### 9.1 ESLint 配置 (`.eslintrc.json`)

```json
{
  "env": {
    "node": true,
    "commonjs": true,
    "es2021": true,
    "jest": true
  },
  "parserOptions": {
    "ecmaVersion": "latest"
  },
  "rules": {
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_|^next$" }],
    "no-console": "off",
    "prefer-const": "error",
    "no-var": "error",
    "eqeqeq": ["error", "always"],
    "curly": ["error", "all"],
    "no-throw-literal": "error"
  }
}
```

### 9.2 Prettier 配置 (`.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

### 9.3 ESLint 与 Prettier 协作

```bash
# 检查代码规范
npm run lint

# 自动修复 lint 错误
npm run lint:fix

# 用 Prettier 格式化所有文件
npm run format
```

> **ESLint vs Prettier 的分工：**
> - **ESLint** 负责 **代码质量**（如 `no-var`、`eqeqeq`、`no-unused-vars`）
> - **Prettier** 负责 **代码格式**（如缩进、引号、分号、换行）
> - 两者不冲突，配合使用效果最佳

---

## 十、测试 API 接口

启动服务器后，打开一个新的终端，使用 **curl** 命令测试每一个接口。

> **curl 是什么？** 它是一个命令行 HTTP 客户端，就像 Postman 的命令行版本。在后端开发中非常常用，因为可以直接在终端测试，不需要打开浏览器或 GUI 工具。

### 10.1 健康检查

```bash
# 检查服务是否正常运行
curl http://localhost:3000/api/health
```

**预期响应：**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-05-31T08:00:00.000Z",
    "uptime": 1.234
  },
  "error": null
}
```

### 10.2 用户接口测试

```bash
# ========== 获取所有用户 ==========
curl http://localhost:3000/api/users

# ========== 获取单个用户 ==========
curl http://localhost:3000/api/users/1

# ========== 创建用户 ==========
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "王五", "email": "wangwu@example.com", "bio": "后端学习者"}'

# ========== 更新用户 ==========
curl -X PUT http://localhost:3000/api/users/3 \
  -H "Content-Type: application/json" \
  -d '{"bio": "全栈开发工程师"}'

# ========== 删除用户 ==========
curl -X DELETE http://localhost:3000/api/users/3

# ========== 测试验证错误 — 邮箱格式不正确 ==========
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "测试", "email": "invalid-email"}'

# ========== 测试验证错误 — 缺少必填字段 ==========
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'

# ========== 测试 404 — 用户不存在 ==========
curl http://localhost:3000/api/users/999

# ========== 测试 409 — 邮箱冲突 ==========
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "重复", "email": "zhangsan@example.com"}'
```

### 10.3 文章接口测试

```bash
# 获取所有文章
curl http://localhost:3000/api/posts

# 按状态筛选（published / draft）
curl "http://localhost:3000/api/posts?status=published"

# 按作者筛选 + 组合筛选
curl "http://localhost:3000/api/posts?authorId=1"
curl "http://localhost:3000/api/posts?status=published&authorId=1"

# 获取单篇文章
curl http://localhost:3000/api/posts/1

# 创建文章（默认草稿）
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "我的第一篇博客", "content": "这是我用 API 创建的第一篇文章！", "authorId": "2", "tags": ["blog", "first"]}'

# 创建文章（直接发布）
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "Express 中间件深入理解", "content": "中间件是 Express 的核心概念...", "authorId": "1", "status": "published", "tags": ["express"]}'

# 更新文章（草稿改为发布）
curl -X PUT http://localhost:3000/api/posts/3 \
  -H "Content-Type: application/json" \
  -d '{"status": "published", "title": "RESTful API 设计最佳实践"}'

# 删除文章
curl -X DELETE http://localhost:3000/api/posts/4

# 测试错误情况
curl http://localhost:3000/api/posts/999               # 404
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "", "content": "有内容", "authorId": "1"}'  # 验证失败
```

### 10.4 评论接口测试

```bash
# 获取文章 1 的所有评论
curl http://localhost:3000/api/posts/1/comments

# 给文章 2 发表评论
curl -X POST http://localhost:3000/api/posts/2/comments \
  -H "Content-Type: application/json" \
  -d '{"authorId": "2", "content": "这篇文章太棒了！"}'

# 删除评论
curl -X DELETE http://localhost:3000/api/posts/1/comments/1

# 测试错误情况
curl http://localhost:3000/api/posts/999/comments      # 文章不存在
curl -X DELETE http://localhost:3000/api/posts/1/comments/999  # 评论不存在
curl -X POST http://localhost:3000/api/posts/1/comments \
  -H "Content-Type: application/json" \
  -d '{"authorId": "2", "content": ""}'                 # 验证失败
```

### 10.5 错误处理测试

```bash
# 访问不存在的路由 → 404
curl http://localhost:3000/api/unknown

# 请求体不是合法 JSON → 400
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d 'this is not json'
```

---

## 十一、完整请求流程

理解一个 HTTP 请求从客户端到响应的完整流程：

```
客户端请求
    │
    ▼
① requestLogger    记录请求开始时间
② express.json()   解析 JSON 请求体
③ 路由匹配          匹配 HTTP 方法 + URL 路径
④ validate 中间件   Zod 验证请求数据
    │                  ├── 验证失败 → 抛出 ValidationError
⑤ Controller       执行业务逻辑，操作内存数据
    │                  ├── 业务错误 → 抛出 AppError
⑥ response 成功响应  返回 { success: true, data, error: null }
⑦ finish 事件       记录响应状态码和耗时
    │
    ▼ (如果任何步骤出错)
⑧ errorHandler     全局错误处理中间件
    │   AppError         → 使用其状态码和消息
    │   ZodError         → 400 + 验证详情
    │   JSON 解析错误    → 400
    │   未知错误         → 500
    ▼
客户端收到响应
```

---

## 十二、动手练习

### 练习 1：添加分页功能

当前的文章列表和用户列表会返回所有数据。请为它们添加分页功能。

**提示：**
- 使用查询参数 `page`（页码，默认 1）和 `limit`（每页条数，默认 10）
- 响应中除了数据列表，还要包含分页信息

```javascript
// 预期响应格式
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 练习 2：添加文章搜索功能

为文章列表添加关键词搜索功能。

**要求：**
- 查询参数 `q` 表示搜索关键词
- 在文章标题和内容中搜索（不区分大小写）
- 和现有的 status、authorId 筛选可以组合使用

```bash
# 预期使用方式
curl "http://localhost:3000/api/posts?q=nodejs&status=published"
```

### 练习 3：添加文章统计接口

创建一个新的接口 `GET /api/stats`，返回博客系统的统计数据。

```javascript
// 预期响应
{
  "success": true,
  "data": {
    "totalUsers": 3,
    "totalPosts": 5,
    "totalComments": 10,
    "publishedPosts": 3,
    "draftPosts": 2,
    "latestPost": {
      "id": "5",
      "title": "最新文章标题",
      "createdAt": "2026-05-31T10:00:00.000Z"
    }
  }
}
```

### 练习 4：添加输入清理（Sanitization）

在验证中间件之后，添加一个清理中间件：
- 去除字符串字段的首尾空格（`trim`）
- 将邮箱转为小写

**提示：** 可以创建一个新的中间件 `src/middleware/sanitize.js`，或者直接在控制器中处理。

---

## 参考答案

### 练习 1：添加分页功能

**思路**：在路由处理函数中从 `req.query` 提取 `page` 和 `limit`，计算偏移量后对数据切片。响应中同时返回数据列表和分页元信息，让前端知道总页数和是否有下一页。

**答案**：

```javascript
// src/routes/posts.js（修改 GET / 路由）
const express = require('express');
const router = express.Router();

const posts = [
    { id: '1', title: '第一篇文章', content: '内容...', status: 'published', authorId: '1', createdAt: '2026-05-01T10:00:00.000Z' },
    { id: '2', title: '第二篇文章', content: '内容...', status: 'draft', authorId: '2', createdAt: '2026-05-02T10:00:00.000Z' },
    { id: '3', title: '第三篇文章', content: '内容...', status: 'published', authorId: '1', createdAt: '2026-05-03T10:00:00.000Z' },
];

router.get('/', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const { status, authorId } = req.query;

    let filtered = [...posts];

    if (status) {
        filtered = filtered.filter(p => p.status === status);
    }
    if (authorId) {
        filtered = filtered.filter(p => p.authorId === authorId);
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit);

    res.json({
        success: true,
        data: {
            items,
            pagination: {
                page: safePage,
                limit,
                total,
                totalPages,
                hasNext: safePage < totalPages,
                hasPrev: safePage > 1,
            },
        },
    });
});

// 用户列表也添加分页
router.get('/users', (req, res) => {
    const users = require('../data/users');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

    const total = users.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * limit;
    const items = users.slice(startIndex, startIndex + limit);

    res.json({
        success: true,
        data: {
            items,
            pagination: { page: safePage, limit, total, totalPages },
        },
    });
});

module.exports = router;
```

**要点**：
- `page` 和 `limit` 用 `Math.max(1, ...)` 防止负数和 0，`limit` 用 `Math.min(100, ...)` 限制上限
- 先筛选再分页，分页参数反映筛选后的总数
- `safePage` 自动修正超出范围的页码，避免返回空数据
- 前端可以用 `hasNext` 判断是否显示"加载更多"按钮

### 练习 2：添加文章搜索功能

**思路**：在文章列表路由中增加 `q` 查询参数，对标题和内容做不区分大小写的包含检查。搜索和现有的 status、authorId 筛选可以串联使用，先筛选再搜索。

**答案**：

```javascript
// 在 GET / 路由中添加搜索逻辑
router.get('/', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const { status, authorId, q } = req.query;

    let filtered = [...posts];

    if (status) {
        filtered = filtered.filter(p => p.status === status);
    }
    if (authorId) {
        filtered = filtered.filter(p => p.authorId === authorId);
    }
    if (q) {
        const keyword = q.toLowerCase();
        filtered = filtered.filter(p =>
            p.title.toLowerCase().includes(keyword) ||
            p.content.toLowerCase().includes(keyword)
        );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit);

    res.json({
        success: true,
        data: {
            items,
            pagination: {
                page: safePage,
                limit,
                total,
                totalPages,
                hasNext: safePage < totalPages,
                hasPrev: safePage > 1,
            },
        },
    });
});
```

```bash
# 测试
curl "http://localhost:3000/api/posts?q=nodejs&status=published"
# 返回标题或内容中包含 "nodejs" 的已发布文章
```

**要点**：
- `q` 参数做 `toLowerCase()` 后用 `includes` 匹配，实现不区分大小写搜索
- 搜索和筛选条件可以自由组合，每个条件独立 `filter`
- 生产环境中大量数据应使用数据库的全文索引（如 PostgreSQL 的 `tsvector`），而非内存遍历

### 练习 3：添加文章统计接口

**思路**：统计接口需要聚合多个数据源（用户数、文章数、评论数），计算分类统计（已发布/草稿），并获取最新文章。在内存数据模式下直接遍历计算即可。

**答案**：

```javascript
// src/routes/stats.js
const express = require('express');
const router = express.Router();

// 假设数据从模块导入
const users = require('../data/users');
const posts = require('../data/posts');
const comments = require('../data/comments');

router.get('/', (req, res) => {
    const totalUsers = users.length;
    const totalPosts = posts.length;
    const totalComments = comments.length;
    const publishedPosts = posts.filter(p => p.status === 'published').length;
    const draftPosts = posts.filter(p => p.status === 'draft').length;

    const sortedPosts = [...posts].sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );
    const latestPost = sortedPosts[0]
        ? { id: sortedPosts[0].id, title: sortedPosts[0].title, createdAt: sortedPosts[0].createdAt }
        : null;

    res.json({
        success: true,
        data: {
            totalUsers,
            totalPosts,
            totalComments,
            publishedPosts,
            draftPosts,
            latestPost,
        },
    });
});

module.exports = router;
```

```javascript
// app.js 中注册
const statsRouter = require('./routes/stats');
app.use('/api/stats', statsRouter);
```

```bash
# 测试
curl http://localhost:3000/api/stats
# 返回统计数据
```

**要点**：
- 统计接口是只读的，使用 GET 方法
- `latestPost` 只返回必要字段（id、title、createdAt），不返回完整内容
- 排序用 `new Date(b.createdAt) - new Date(a.createdAt)` 做时间降序
- 生产环境中应使用数据库的聚合查询（`COUNT`、`MAX`）而非内存遍历

### 练习 4：添加输入清理（Sanitization）

**思路**：清理和验证是两个不同的步骤——验证拒绝不合法输入，清理将合法输入标准化（如去除空格、统一大小写）。清理中间件应在验证之后执行，确保清理后的数据仍然符合验证规则。

**答案**：

```javascript
// src/middleware/sanitize.js
function sanitizeBody(fields) {
    return (req, res, next) => {
        if (!req.body || typeof req.body !== 'object') {
            return next();
        }

        for (const field of fields) {
            if (typeof req.body[field] === 'string') {
                req.body[field] = req.body[field].trim();
            }
        }

        if (typeof req.body.email === 'string') {
            req.body.email = req.body.email.toLowerCase().trim();
        }

        next();
    };
}

function sanitizeSearch(req, res, next) {
    if (typeof req.query.q === 'string') {
        req.query.q = req.query.q.trim();
    }
    if (typeof req.query.search === 'string') {
        req.query.search = req.query.search.trim();
    }
    next();
}

module.exports = { sanitizeBody, sanitizeSearch };
```

```javascript
// src/routes/users.js 中使用
const { sanitizeBody } = require('../middleware/sanitize');
const { validate } = require('../middleware/validate');

router.post('/',
    validate(createUserSchema),
    sanitizeBody(['username', 'email']),
    (req, res) => {
        const { username, email, password } = req.body;
        // email 已被转为小写并 trim，username 已被 trim
        const newUser = { id: String(users.length + 1), username, email };
        users.push(newUser);
        res.status(201).json({ success: true, data: newUser });
    }
);
```

**要点**：
- 清理和验证是两步：先验证格式，再清理标准化。顺序不能反——如果先 trim 再验证，可能导致验证通过但原始数据含空格
- `sanitizeBody` 接收需要 trim 的字段列表，不盲目清理所有字段（避免破坏密码中的空格）
- 邮箱统一转小写是因为邮箱本身不区分大小写，标准化后便于去重和查询
- 查询参数的清理用独立中间件 `sanitizeSearch`，和请求体清理分开

---

## 常见误区

1. **把所有逻辑写在路由文件里**：路由函数应该只做三件事——提取参数、调用服务、返回响应。业务逻辑（如验证作者是否存在、检查邮箱重复）应该在 Service 层处理。
2. **数据存储用全局变量而不是模块变量**：用 `let users = []` 作为全局变量时，如果被多个文件修改，容易产生不可预期的副作用。应该用模块导出的数组引用，利用 Node.js 的模块缓存机制保证数据一致性。
3. **删除资源时不检查关联关系**：删除用户前应该检查该用户是否还有文章，删除文章前应该删除其下的评论。不处理关联关系会导致"孤儿数据"。
4. **不使用 ESLint 和 Prettier**：多人协作时，没有代码规范约束会导致风格混乱。ESLint 负责代码质量，Prettier 负责代码格式，两者配合使用。

## 工程建议

1. **遵循 MVC 分层架构**：Routes 处理路由映射，Controllers 处理请求/响应，Services 处理业务逻辑，Data 层处理数据存储。每层职责单一，便于测试和维护。
2. **使用 .gitignore 排除 node_modules 和 .env**：node_modules 可以通过 npm install 重建，.env 包含数据库密码等敏感信息，两者都不应该提交到 Git。
3. **用 curl 或 Postman 测试每个接口**：写完一个接口就测试一个，不要等全部写完再测。发现问题越早，修复成本越低。
4. **为每个模块编写验证规则**：用户、文章、评论各有不同的验证需求，用 Zod schema 独立定义，通过验证中间件统一应用到路由上。

## 十三、小结

### 本课用到的知识回顾

这节实战课用到了前 8 课的所有核心知识点：

```
课程        本课中的应用
─────────────────────────────────────────────────────
第一课      理解服务端 JavaScript 运行环境，使用 Node.js 运行项目
Node.js

第二课      npm init 初始化项目，npm install 安装依赖
npm         scripts 自定义命令（dev, lint, format）

第三课      CommonJS 模块系统（require / module.exports）
服务端 JS   process 对象（process.env.PORT, process.uptime()）

第四课      （本课主要使用第三方模块，但理解了模块系统的工作方式）
内置模块

第五课      创建 Express 应用实例，app.use() 注册中间件
Express     app.listen() 启动服务器，req.body / req.params / req.query

第六课      express.Router() 实现路由模块化
路由与      路由参数（:id, :postId），中间件链
中间件      错误处理中间件（4 参数），next() / next(err)

第七课      使用名词、复数形式，正确使用 HTTP 方法
RESTful     合理使用状态码（200/201/400/404/409）
            子资源路由设计（/posts/:id/comments）

第八课      Zod schema 定义验证规则，safeParse 安全验证
验证与      自定义错误类（AppError, NotFoundError 等）
错误处理    统一错误处理中间件，统一响应格式
```

### 项目文件清单

以下是完整的项目文件清单，确认你的项目包含所有文件：

```
blog-api/
├── .eslintrc.json                    # ESLint 配置
├── .prettierrc                       # Prettier 配置
├── package.json                      # 项目配置和依赖
├── src/
│   ├── index.js                      # 入口文件
│   ├── app.js                        # Express 应用配置
│   ├── data/
│   │   └── store.js                  # 内存数据存储
│   ├── controllers/
│   │   ├── userController.js         # 用户业务逻辑
│   │   ├── postController.js         # 文章业务逻辑
│   │   └── commentController.js      # 评论业务逻辑
│   ├── routes/
│   │   ├── index.js                  # 路由总入口
│   │   ├── userRoutes.js             # 用户路由
│   │   ├── postRoutes.js             # 文章路由
│   │   └── commentRoutes.js          # 评论路由
│   ├── middleware/
│   │   ├── errorHandler.js           # 全局错误处理
│   │   ├── logger.js                 # 请求日志
│   │   └── validate.js               # Zod 验证中间件
│   ├── validators/
│   │   ├── userValidator.js          # 用户验证规则
│   │   ├── postValidator.js          # 文章验证规则
│   │   └── commentValidator.js       # 评论验证规则
│   └── utils/
│       ├── response.js               # 统一响应格式
│       └── errors.js                 # 自定义错误类
```

### 当前版本的局限性

这个版本使用 **内存数组** 存储数据，存在以下问题：

1. **数据不持久化** — 服务器重启后所有数据丢失
2. **无法支持复杂查询** — 模糊搜索、聚合统计等需要手动遍历数组
3. **不支持并发** — 多个请求同时修改数组可能导致数据不一致
4. **内存有限** — 数据量大时会占用大量内存
5. **无法建立真正的关联关系** — 我们手动用 authorId / postId 模拟外键

### 下一阶段预告

第二阶段我们将引入 **PostgreSQL 数据库** 和 **Prisma ORM**，届时会：

1. 用 PostgreSQL 替换内存数组，数据持久化存储
2. 使用 Prisma Client 用 TypeScript 操作数据库
3. 使用外键、关系查询和分页实现真正的数据关联
4. 添加用户认证（JWT）
5. 文件上传（文章配图、用户头像）
6. 部署到云服务器

> **给前端开发者的建议：** 这个项目虽然简单，但它是你理解后端开发的完整闭环。从请求进入到响应返回，每一步你都亲手实现了。当你在第二阶段使用数据库时，你会发现只是把内存数组操作替换成了 `prisma.user.create()`、`prisma.post.findMany()` 这类数据库调用，整体架构完全不变。这就是分层架构的好处 —— 每一层都可以独立替换。
