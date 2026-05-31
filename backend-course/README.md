# 从零到一：前端开发者的全栈后端实战课程

> 以「博客平台 API」为实战项目，从 Node.js 基础到商业级后端服务的完整学习路径

## 适合谁

- 有 JavaScript/TypeScript 基础的前端开发者
- 想转型全栈但不知从何入手
- 做过前端项目，想给自己的项目加上后端

## 学完能做什么

- 独立设计并开发一套完整的 RESTful API
- 使用 Node.js + Express + PostgreSQL 构建后端服务
- 实现用户认证、权限管理、文件上传等企业级功能
- 将项目部署上线，对外提供服务

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js |
| 框架 | Express.js |
| 语言 | TypeScript |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 认证 | JWT + bcrypt |
| 文档 | Swagger/OpenAPI |
| 部署 | Docker + Railway |

## 学习路线图

```
┌─────────────────────────────────────────────────────────────┐
│                    全栈后端学习路线                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  第一阶段：Node.js 基础（2-4 周）                            │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐  │
│  │01│→│02│→│03│→│04│→│05│→│06│→│07│→│08│→│09│  │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘  │
│  认识   环境  JS在  内置  Express路由  REST 请求  阶段      │
│  Node  搭建  服务端 模块  入门  中间件 API  验证  实战      │
│                                                             │
│  第二阶段：数据库（2-4 周）                                   │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│  │01│→│02│→│03│→│04│→│05│→│06│→│07│→│08│       │
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘       │
│  数据库  SQL   PG   Prisma Schema CRUD  关联  阶段        │
│  概念   入门  安装  入门  设计  操作  查询  实战           │
│                                                             │
│  第三阶段：认证与实战（2-4 周）                               │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐│
│  │01│→│02│→│03│→│04│→│05│→│06│→│07│→│08│→│09││
│  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘│
│  认证   密码  登录  权限  文件  API   日志  部署  完整     │
│  概念   加密  注册  RBAC 上传  文档  监控  上线  实战     │
│                                                             │
│  第四阶段：进阶（按需学习）                                   │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                           │
│  │01│ │02│ │03│ │04│ │05│                           │
│  └───┘ └───┘ └───┘ └───┘ └───┘                           │
│  Redis  WebSocket 消息队列 NestJS  性能                    │
│  缓存   实时通信  异步处理  框架   优化                      │
│                                                             │
│  最终项目：商业级博客平台 API                                 │
│  ┌──────────────────────────────────────┐                   │
│  │ 用户系统 │ 文章系统 │ 评论系统 │ 权限管理 │              │
│  │ 标签分类 │ 搜索筛选 │ 数据统计 │ 文件上传 │              │
│  └──────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## 课程目录

### 第一阶段：Node.js 基础

1. [认识 Node.js](stage1-nodejs-basics/01-认识Nodejs.md) — 是什么、为什么、怎么工作
2. [环境搭建与 npm](stage1-nodejs-basics/02-环境搭建与npm.md) — 安装 Node.js、包管理器
3. [JavaScript 在服务端](stage1-nodejs-basics/03-JavaScript在服务端.md) — 与浏览器 JS 的区别
4. [内置模块详解](stage1-nodejs-basics/04-内置模块详解.md) — fs、path、http、events
5. [Express 入门](stage1-nodejs-basics/05-Express入门.md) — 第一个 Web 服务器
6. [路由与中间件](stage1-nodejs-basics/06-路由与中间件.md) — Express 核心机制
7. [RESTful API 设计](stage1-nodejs-basics/07-RESTful-API设计.md) — API 设计规范
8. [请求验证与错误处理](stage1-nodejs-basics/08-请求验证与错误处理.md) — 健壮性保障
9. [阶段实战：博客 API 基础版](stage1-nodejs-basics/09-阶段实战-博客API基础版.md) — 综合练习

### 第二阶段：数据库

1. [数据库基础概念](stage2-database/01-数据库基础概念.md) — 关系型 vs 非关系型
2. [SQL 入门](stage2-database/02-SQL入门.md) — 增删改查语法
3. [PostgreSQL 安装与使用](stage2-database/03-PostgreSQL安装与使用.md) — 数据库实操
4. [Prisma ORM 入门](stage2-database/04-Prisma-ORM入门.md) — 用 TypeScript 操作数据库
5. [Schema 设计与迁移](stage2-database/05-Schema设计与迁移.md) — 数据建模
6. [CRUD 操作详解](stage2-database/06-CRUD操作详解.md) — 完整数据库操作
7. [关联查询与分页](stage2-database/07-关联查询与分页.md) — 复杂查询
8. [阶段实战：博客数据层](stage2-database/08-阶段实战-博客数据层.md) — 综合练习

### 第三阶段：认证与实战

1. [认证与授权概念](stage3-auth-and-practice/01-认证与授权概念.md) — 理论基础
2. [密码加密与 JWT](stage3-auth-and-practice/02-密码加密与JWT.md) — 安全基础
3. [登录注册完整流程](stage3-auth-and-practice/03-登录注册完整流程.md) — 实现认证
4. [权限中间件与 RBAC](stage3-auth-and-practice/04-权限中间件与RBAC.md) — 角色权限
5. [文件上传](stage3-auth-and-practice/05-文件上传.md) — 处理二进制数据
6. [API 文档与测试](stage3-auth-and-practice/06-API文档与测试.md) — Swagger + 测试
7. [日志与监控](stage3-auth-and-practice/07-日志与监控.md) — 生产环境可观测性
8. [部署上线](stage3-auth-and-practice/08-部署上线.md) — Docker + 云部署
9. [阶段实战：完整博客 API](stage3-auth-and-practice/09-阶段实战-完整博客API.md) — 综合练习
10. [Docker 完全指南](stage3-auth-and-practice/10-Docker完全指南.md) — 从零掌握容器化

### 第四阶段：进阶

1. [缓存与 Redis](stage4-advanced/01-缓存与Redis.md) — 性能优化
2. [WebSocket 实时通信](stage4-advanced/02-WebSocket实时通信.md) — 实时功能
3. [消息队列](stage4-advanced/03-消息队列.md) — 异步处理
4. [NestJS 入门](stage4-advanced/04-NestJS入门.md) — 企业级框架
5. [性能优化与安全加固](stage4-advanced/05-性能优化与安全加固.md) — 生产级质量

### 最终项目

- [项目说明](final-project/项目说明.md)

## 学习建议

1. **按顺序学习**：每个课时都建立在前一个的基础上
2. **动手敲代码**：不要复制粘贴，亲手敲每一行代码
3. **完成练习**：每个课时末尾的练习是巩固知识的关键
4. **阶段实战必做**：每阶段末尾的实战是检验学习成果的最佳方式
5. **遇到问题先思考**：报错信息是最好的老师，先尝试自己解决
