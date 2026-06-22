# 第 9 课：阶段实战 - 完整博客 API

## 场景引入

经过前八个课时的学习，你已经掌握了认证授权、密码加密、JWT 双令牌、RBAC 权限、文件上传、API 文档、日志监控和 Docker 部署等核心技能。但这些知识分散在各个课时中，就像学会了做菜的每一步却还没完整做过一道菜。本课是第三阶段的综合实战——你将把这些碎片化的知识整合成一个完整的、可部署的博客 API 系统。在这个过程中，你会遇到真实项目中的挑战：如何组织代码结构让新人能快速上手？如何让各个模块（认证、文章、评论、上传）协调工作？如何确保系统在生产环境中既安全又高效？

## 学习目标

本课是第三阶段的综合实战，也是整个课程前三阶段的大整合。完成本课后，你将：

1. 拥有一个完整的、可部署的博客 API 系统
2. 掌握分层架构的实际应用
3. 理解如何将各个模块整合成完整项目
4. 能够独立开发类似规模的后端项目

---

## 一、项目完整结构展示

```
blog-api/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD 配置
│
├── prisma/
│   ├── schema.prisma               # 数据库模型定义
│   └── migrations/                 # 数据库迁移文件
│
├── src/
│   ├── config/
│   │   ├── database.ts             # 数据库连接配置
│   │   ├── env.ts                  # 环境变量验证
│   │   ├── logger.ts               # 日志配置
│   │   ├── redis.ts                # Redis 连接配置
│   │   └── swagger.ts              # Swagger 文档配置
│   │
│   ├── middleware/
│   │   ├── auth.ts                 # JWT 认证中间件
│   │   ├── authorize.ts            # RBAC 权限中间件
│   │   ├── cors.ts                 # CORS 跨域配置
│   │   ├── errorHandler.ts         # 全局错误处理
│   │   ├── logger.ts               # 请求日志中间件
│   │   ├── rateLimiter.ts          # 限流中间件
│   │   ├── upload.ts               # 文件上传中间件
│   │   └── validate.ts             # 请求验证中间件
│   │
│   ├── routes/
│   │   ├── index.ts                # 路由聚合
│   │   ├── auth.routes.ts          # 认证路由
│   │   ├── user.routes.ts          # 用户路由
│   │   ├── post.routes.ts          # 文章路由
│   │   ├── category.routes.ts      # 分类路由
│   │   ├── tag.routes.ts           # 标签路由
│   │   ├── comment.routes.ts       # 评论路由
│   │   ├── upload.routes.ts        # 上传路由
│   │   └── stats.routes.ts         # 统计路由
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts      # 认证控制器
│   │   ├── user.controller.ts      # 用户控制器
│   │   ├── post.controller.ts      # 文章控制器
│   │   ├── category.controller.ts  # 分类控制器
│   │   ├── tag.controller.ts       # 标签控制器
│   │   ├── comment.controller.ts   # 评论控制器
│   │   ├── upload.controller.ts    # 上传控制器
│   │   └── stats.controller.ts     # 统计控制器
│   │
│   ├── services/
│   │   ├── auth.service.ts         # 认证服务
│   │   ├── user.service.ts         # 用户服务
│   │   ├── post.service.ts         # 文章服务
│   │   ├── category.service.ts     # 分类服务
│   │   ├── tag.service.ts          # 标签服务
│   │   ├── comment.service.ts      # 评论服务
│   │   ├── upload.service.ts       # 上传服务
│   │   └── stats.service.ts        # 统计服务
│   │
│   ├── utils/
│   │   ├── errors.ts               # 自定义错误类
│   │   ├── helpers.ts              # 通用工具函数
│   │   ├── jwt.ts                  # JWT 工具
│   │   ├── password.ts             # 密码加密工具
│   │   ├── response.ts             # 响应格式化
│   │   └── slug.ts                 # Slug 生成工具
│   │
│   ├── validators/
│   │   ├── auth.validator.ts       # 认证验证规则
│   │   ├── user.validator.ts       # 用户验证规则
│   │   ├── post.validator.ts       # 文章验证规则
│   │   ├── category.validator.ts   # 分类验证规则
│   │   ├── tag.validator.ts        # 标签验证规则
│   │   └── comment.validator.ts    # 评论验证规则
│   │
│   ├── types/
│   │   ├── express.d.ts            # Express 类型扩展
│   │   └── index.ts                # 类型定义
│   │
│   └── index.ts                    # 应用入口
│
├── uploads/                        # 上传文件目录
├── logs/                           # 日志文件目录
│
├── .env.example                    # 环境变量示例
├── .gitignore                      # Git 忽略文件
├── .dockerignore                   # Docker 忽略文件
├── docker-compose.yml              # Docker Compose 配置
├── Dockerfile                      # Docker 镜像构建
├── package.json                    # 项目配置
├── tsconfig.json                   # TypeScript 配置
└── README.md                       # 项目说明
```

---

## 二、完整代码汇总

### 2.1 配置层

#### 2.1.1 环境变量配置 `src/config/env.ts`

```typescript
// src/config/env.ts
// 环境变量验证和配置

import dotenv from 'dotenv';
import { z } from 'zod';

// 加载环境变量
dotenv.config();

// 环境变量验证 Schema
const envSchema = z.object({
  // 服务器配置
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),

  // 数据库配置
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT 配置
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Redis 配置（可选）
  REDIS_URL: z.string().optional(),

  // 日志配置
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // 文件上传配置
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE: z.string().default('5242880').transform(Number),

  // CORS 配置
  CORS_ORIGIN: z.string().default('*'),

  // 限流配置
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),
});

// 验证环境变量
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// 导出配置
export const env = parsed.data;

// 类型定义
export type EnvConfig = z.infer<typeof envSchema>;
```

#### 2.1.2 数据库连接配置 `src/config/database.ts`

```typescript
// src/config/database.ts
// Prisma 数据库连接配置

import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';

// 创建 Prisma 客户端实例
const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

// 连接数据库
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// 断开数据库连接
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

// 优雅关闭
process.on('beforeExit', async () => {
  await disconnectDatabase();
});

export { prisma };
export default prisma;
```

#### 2.1.3 日志配置 `src/config/logger.ts`

```typescript
// src/config/logger.ts
// Winston 日志配置

import winston from 'winston';
import path from 'path';
import { env } from './env';

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 控制台输出格式（开发环境）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// 创建 Logger 实例
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'blog-api' },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// 开发环境添加控制台输出
if (env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

export default logger;
```

#### 2.1.4 Redis 配置 `src/config/redis.ts`

```typescript
// src/config/redis.ts
// Redis 连接配置（可选）

import { createClient, RedisClientType } from 'redis';
import { env } from './env';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;

// 连接 Redis
export async function connectRedis(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) {
    logger.info('⚠️ Redis URL not configured, skipping Redis connection');
    return null;
  }

  try {
    redisClient = createClient({ url: env.REDIS_URL });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.warn('⚠️ Redis connection failed, continuing without cache');
    return null;
  }
}

// 获取 Redis 客户端
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

// 断开 Redis
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    logger.info('Redis disconnected');
  }
}

export default { connectRedis, getRedisClient, disconnectRedis };
```

#### 2.1.5 Swagger 文档配置 `src/config/swagger.ts`

```typescript
// src/config/swagger.ts
// Swagger API 文档配置

import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blog API',
      version: '1.0.0',
      description: '一个完整的博客系统 API，支持用户认证、文章管理、评论系统等功能',
      contact: {
        name: 'API Support',
        email: 'support@blog-api.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Validation failed' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            role: { type: 'string', enum: ['USER', 'ADMIN'] },
            avatar: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            slug: { type: 'string' },
            content: { type: 'string' },
            excerpt: { type: 'string', nullable: true },
            coverImage: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'] },
            viewCount: { type: 'integer' },
            author: { $ref: '#/components/schemas/User' },
            category: { $ref: '#/components/schemas/Category' },
            tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
          },
        },
        Tag: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
          },
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            author: { $ref: '#/components/schemas/User' },
            postId: { type: 'string', format: 'uuid' },
            parentId: { type: 'string', format: 'uuid', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

### 2.2 中间件层

#### 2.2.1 JWT 认证中间件 `src/middleware/auth.ts`

```typescript
// src/middleware/auth.ts
// JWT 认证中间件

import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { AppError } from '../utils/errors';
import prisma from '../config/database';

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// 认证中间件
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. 从 Header 获取 Token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }

    const token = authHeader.substring(7);

    // 2. 验证 Token
    const decoded = verifyToken(token);

    // 3. 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (user.status === 'BANNED') {
      throw new AppError('User is banned', 403, 'USER_BANNED');
    }

    // 4. 将用户信息附加到请求对象
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    }
  }
};

// 可选认证（不强制要求登录）
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true },
      });

      if (user) {
        req.user = {
          userId: user.id,
          email: user.email,
          role: user.role,
        };
      }
    }

    next();
  } catch (error) {
    // 可选认证失败不报错，继续执行
    next();
  }
};
```

#### 2.2.2 RBAC 权限中间件 `src/middleware/authorize.ts`

```typescript
// src/middleware/authorize.ts
// RBAC 权限控制中间件

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

// 角色类型
type Role = 'USER' | 'ADMIN';

// 角色层级
const roleHierarchy: Record<Role, number> = {
  USER: 1,
  ADMIN: 2,
};

// 角色授权中间件
export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    if (!roles.includes(req.user.role as Role)) {
      throw new AppError(
        'You do not have permission to perform this action',
        403,
        'FORBIDDEN'
      );
    }

    next();
  };
};

// 最低角色要求
export const requireRole = (minRole: Role) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const userRoleLevel = roleHierarchy[req.user.role as Role] || 0;
    const requiredLevel = roleHierarchy[minRole];

    if (userRoleLevel < requiredLevel) {
      throw new AppError(
        'Insufficient permissions',
        403,
        'INSUFFICIENT_PERMISSIONS'
      );
    }

    next();
  };
};

// 资源所有者或管理员
export const ownerOrAdmin = (
  getResourceOwnerId: (req: Request) => Promise<string | null>
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    // 管理员直接通过
    if (req.user.role === 'ADMIN') {
      next();
      return;
    }

    // 检查是否是资源所有者
    const ownerId = await getResourceOwnerId(req);

    if (ownerId !== req.user.userId) {
      throw new AppError(
        'You can only modify your own resources',
        403,
        'NOT_OWNER'
      );
    }

    next();
  };
};
```

#### 2.2.3 全局错误处理 `src/middleware/errorHandler.ts`

```typescript
// src/middleware/errorHandler.ts
// 全局错误处理中间件

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import { logger } from '../config/logger';
import { env } from '../config/env';

// 错误响应接口
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
}

// 全局错误处理中间件
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 记录错误日志
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // 默认错误响应
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // 处理自定义 AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  }
  // 处理 Prisma 错误
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        code = 'DUPLICATE_ENTRY';
        message = `Duplicate value for ${err.meta?.target}`;
        break;
      case 'P2025':
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      case 'P2003':
        statusCode = 400;
        code = 'FOREIGN_KEY_ERROR';
        message = 'Related record not found';
        break;
      default:
        statusCode = 400;
        code = 'DATABASE_ERROR';
        message = 'Database operation failed';
    }
  }
  // 处理 Prisma 验证错误
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid data provided';
  }
  // 处理 JWT 错误
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expired';
  }
  // 处理 Multer 错误
  else if (err.name === 'MulterError') {
    statusCode = 400;
    code = 'UPLOAD_ERROR';
    message = err.message;
  }

  // 构建错误响应
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };

  // 开发环境添加详细信息
  if (env.NODE_ENV === 'development') {
    errorResponse.error.details = details;
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// 404 处理
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};
```

#### 2.2.4 请求日志中间件 `src/middleware/logger.ts`

```typescript
// src/middleware/logger.ts
// 请求日志中间件

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  // 记录响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 400) {
      logger.warn('Request failed', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};
```

#### 2.2.5 CORS 跨域配置 `src/middleware/cors.ts`

```typescript
// src/middleware/cors.ts
// CORS 跨域配置

import cors from 'cors';
import { env } from '../config/env';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // 允许的来源
    const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim());

    // 允许没有 origin 的请求（如移动应用、Postman）
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 小时
};

export const corsMiddleware = cors(corsOptions);
```

#### 2.2.6 限流中间件 `src/middleware/rateLimiter.ts`

```typescript
// src/middleware/rateLimiter.ts
// API 限流中间件

import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// 通用限流
export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 分钟
  max: env.RATE_LIMIT_MAX, // 每个窗口最多 100 次请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 认证接口限流（更严格）
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 最多 5 次尝试
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many login attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 文件上传限流
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 10, // 每小时最多 10 次上传
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMIT',
      message: 'Upload limit exceeded, please try again later',
    },
  },
});
```

#### 2.2.7 文件上传中间件 `src/middleware/upload.ts`

```typescript
// src/middleware/upload.ts
// 文件上传中间件

import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

// 存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// 文件过滤器
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 允许的文件类型
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type', 400, 'INVALID_FILE_TYPE'));
  }
};

// 创建 Multer 实例
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: 5, // 最多 5 个文件
  },
});

// 单文件上传
export const uploadSingle = (fieldName: string) => upload.single(fieldName);

// 多文件上传
export const uploadMultiple = (fieldName: string, maxCount: number = 5) =>
  upload.array(fieldName, maxCount);
```

#### 2.2.8 请求验证中间件 `src/middleware/validate.ts`

```typescript
// src/middleware/validate.ts
// 请求验证中间件

import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../utils/errors';

// 验证中间件工厂函数
export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));

        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
      }
      next(error);
    }
  };
};
```

### 2.3 工具层

#### 2.3.1 自定义错误类 `src/utils/errors.ts`

```typescript
// src/utils/errors.ts
// 自定义错误类

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// 常用错误工厂函数
export class Errors {
  static badRequest(message: string, code?: string, details?: any) {
    return new AppError(message, 400, code || 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized', code?: string) {
    return new AppError(message, 401, code || 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden', code?: string) {
    return new AppError(message, 403, code || 'FORBIDDEN');
  }

  static notFound(message: string = 'Resource not found', code?: string) {
    return new AppError(message, 404, code || 'NOT_FOUND');
  }

  static conflict(message: string, code?: string) {
    return new AppError(message, 409, code || 'CONFLICT');
  }

  static tooMany(message: string = 'Too many requests') {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS');
  }

  static internal(message: string = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}
```

#### 2.3.2 JWT 工具 `src/utils/jwt.ts`

```typescript
// src/utils/jwt.ts
// JWT 工具函数

import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// Token 负载接口
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

// 生成访问 Token
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

// 生成刷新 Token
export function generateRefreshToken(payload: TokenPayload): string {
  const secret = env.JWT_REFRESH_SECRET || env.JWT_SECRET;
  return jwt.sign(payload, secret, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

// 验证访问 Token
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

// 验证刷新 Token
export function verifyRefreshToken(token: string): TokenPayload {
  const secret = env.JWT_REFRESH_SECRET || env.JWT_SECRET;
  return jwt.verify(token, secret) as TokenPayload;
}

// 生成 Token 对
export function generateTokenPair(payload: TokenPayload) {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
```

#### 2.3.3 密码加密工具 `src/utils/password.ts`

```typescript
// src/utils/password.ts
// 密码加密工具

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// 加密密码
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// 验证密码
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 验证密码强度
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

#### 2.3.4 响应格式化 `src/utils/response.ts`

```typescript
// src/utils/response.ts
// 统一响应格式

import { Response } from 'express';

// 成功响应
export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200, message?: string) {
  const response: any = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
}

// 分页响应
export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// 创建成功响应
export function sendCreated<T>(res: Response, data: T, message?: string) {
  return sendSuccess(res, data, 201, message || 'Created successfully');
}

// 删除成功响应
export function sendDeleted(res: Response, message?: string) {
  return res.status(200).json({
    success: true,
    message: message || 'Deleted successfully',
  });
}

// 无内容响应
export function sendNoContent(res: Response) {
  return res.status(204).send();
}
```

#### 2.3.5 Slug 生成工具 `src/utils/slug.ts`

```typescript
// src/utils/slug.ts
// Slug 生成工具

// 生成 Slug
export function generateSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // 替换空格为 -
    .replace(/[^\w\-]+/g, '')    // 移除非单词字符
    .replace(/\-\-+/g, '-')     // 替换多个 - 为单个 -
    .replace(/^-+/, '')          // 移除开头的 -
    .replace(/-+$/, '');         // 移除结尾的 -
}

// 生成唯一 Slug（添加随机后缀）
export function generateUniqueSlug(text: string): string {
  const baseSlug = generateSlug(text);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${baseSlug}-${randomSuffix}`;
}

// 中文转拼音 Slug（简单实现）
export function chineseToSlug(text: string): string {
  // 这里只是简单处理，实际项目可以使用 pinyin 库
  return generateSlug(text);
}
```

#### 2.3.6 通用工具函数 `src/utils/helpers.ts`

```typescript
// src/utils/helpers.ts
// 通用工具函数

// 分页参数处理
export function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// 排序参数处理
export function parseSort(sortBy: string, order: string = 'desc') {
  return {
    [sortBy]: order === 'asc' ? 'asc' : 'desc',
  };
}

// 过滤敏感信息
export function sanitizeUser(user: any) {
  const { password, ...sanitized } = user;
  return sanitized;
}

// 生成随机字符串
export function generateRandomString(length: number = 32): string {
  return require('crypto').randomBytes(length).toString('hex');
}

// 延迟函数
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 检查是否为空对象
export function isEmpty(obj: any): boolean {
  return Object.keys(obj).length === 0;
}

// 深拷贝
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
```

### 2.4 验证层

#### 2.4.1 认证验证规则 `src/validators/auth.validator.ts`

```typescript
// src/validators/auth.validator.ts
// 认证相关验证规则

import { z } from 'zod';

// 注册验证
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(50),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
});

// 登录验证
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

// 刷新 Token 验证
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// 修改密码验证
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
});

// 忘记密码验证
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
  }),
});

// 重置密码验证
export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});
```

#### 2.4.2 文章验证规则 `src/validators/post.validator.ts`

```typescript
// src/validators/post.validator.ts
// 文章相关验证规则

import { z } from 'zod';

// 创建文章验证
export const createPostSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200),
    content: z.string().min(1, 'Content is required'),
    excerpt: z.string().max(500).optional(),
    coverImage: z.string().url().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
    categoryId: z.string().uuid().optional(),
    tagIds: z.array(z.string().uuid()).optional(),
  }),
});

// 更新文章验证
export const updatePostSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid post ID'),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
    excerpt: z.string().max(500).optional(),
    coverImage: z.string().url().optional().nullable(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    categoryId: z.string().uuid().optional().nullable(),
    tagIds: z.array(z.string().uuid()).optional(),
  }),
});

// 查询文章列表验证
export const getPostsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    search: z.string().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    categoryId: z.string().uuid().optional(),
    tagId: z.string().uuid().optional(),
    authorId: z.string().uuid().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'viewCount']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }),
});

// 获取单篇文章验证
export const getPostSchema = z.object({
  params: z.object({
    idOrSlug: z.string().min(1),
  }),
});

// 删除文章验证
export const deletePostSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid post ID'),
  }),
});
```

#### 2.4.3 其他验证器

```typescript
// src/validators/user.validator.ts
import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(50).optional(),
    bio: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

export const getUsersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    search: z.string().optional(),
  }),
});
```

```typescript
// src/validators/category.validator.ts
import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(50),
    description: z.string().max(200).optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid category ID'),
  }),
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(200).optional(),
  }),
});
```

```typescript
// src/validators/tag.validator.ts
import { z } from 'zod';

export const createTagSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(30),
  }),
});

export const updateTagSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid tag ID'),
  }),
  body: z.object({
    name: z.string().min(1).max(30).optional(),
  }),
});
```

```typescript
// src/validators/comment.validator.ts
import { z } from 'zod';

export const createCommentSchema = z.object({
  params: z.object({
    postId: z.string().uuid('Invalid post ID'),
  }),
  body: z.object({
    content: z.string().min(1, 'Content is required').max(1000),
    parentId: z.string().uuid().optional(),
  }),
});

export const updateCommentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid comment ID'),
  }),
  body: z.object({
    content: z.string().min(1).max(1000),
  }),
});
```

### 2.5 类型定义

#### 2.5.1 Express 类型扩展 `src/types/express.d.ts`

```typescript
// src/types/express.d.ts
// Express 类型扩展

import { TokenPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      file?: Express.Multer.File;
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
    }
  }
}
```

#### 2.5.2 通用类型定义 `src/types/index.ts`

```typescript
// src/types/index.ts
// 通用类型定义

// 分页查询参数
export interface PaginationQuery {
  page?: string;
  limit?: string;
}

// 排序参数
export interface SortQuery {
  sortBy?: string;
  order?: 'asc' | 'desc';
}

// 分页响应
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// API 响应
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// 文章查询参数
export interface PostQuery extends PaginationQuery, SortQuery {
  search?: string;
  status?: 'DRAFT' | 'PUBLISHED';
  categoryId?: string;
  tagId?: string;
  authorId?: string;
}

// 用户查询参数
export interface UserQuery extends PaginationQuery {
  role?: string;
  search?: string;
}
```

### 2.6 数据库模型

#### `prisma/schema.prisma`

```prisma
// prisma/schema.prisma
// 数据库模型定义

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 用户模型
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  password  String
  role      Role     @default(USER)
  status    UserStatus @default(ACTIVE)
  avatar    String?
  bio       String?

  // 关联
  posts     Post[]
  comments  Comment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

// 文章模型
model Post {
  id          String      @id @default(uuid())
  title       String
  slug        String      @unique
  content     String
  excerpt     String?
  coverImage  String?
  status      PostStatus  @default(DRAFT)
  viewCount   Int         @default(0)

  // 关联
  author    User       @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId  String
  category  Category?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  categoryId String?
  tags      Tag[]      @relation("PostTags")
  comments  Comment[]

  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  @@index([authorId])
  @@index([categoryId])
  @@index([status])
  @@index([slug])
  @@map("posts")
}

// 分类模型
model Category {
  id          String   @id @default(uuid())
  name        String   @unique
  slug        String   @unique
  description String?

  // 关联
  posts Post[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("categories")
}

// 标签模型
model Tag {
  id   String @id @default(uuid())
  name String @unique
  slug String @unique

  // 关联
  posts Post[] @relation("PostTags")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("tags")
}

// 评论模型
model Comment {
  id        String   @id @default(uuid())
  content   String

  // 关联
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId String
  post     Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId   String

  // 嵌套评论
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  parentId String?
  replies  Comment[] @relation("CommentReplies")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@index([postId])
  @@index([parentId])
  @@map("comments")
}

// 枚举类型
enum Role {
  USER
  ADMIN
}

enum UserStatus {
  ACTIVE
  BANNED
}

enum PostStatus {
  DRAFT
  PUBLISHED
}
```

### 2.7 服务层

#### 2.7.1 认证服务 `src/services/auth.service.ts`

```typescript
// src/services/auth.service.ts
// 认证业务逻辑

import prisma from '../config/database';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import { generateTokenPair, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { Errors } from '../utils/errors';
import { sanitizeUser } from '../utils/helpers';
import { logger } from '../config/logger';

export class AuthService {
  // 用户注册
  async register(data: { name: string; email: string; password: string }) {
    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw Errors.conflict('Email already registered', 'EMAIL_EXISTS');
    }

    // 验证密码强度
    const passwordValidation = validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw Errors.badRequest('Weak password', 'WEAK_PASSWORD', passwordValidation.errors);
    }

    // 加密密码
    const hashedPassword = await hashPassword(data.password);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
      },
    });

    logger.info(`New user registered: ${user.email}`);

    // 生成 Token
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokenPair(tokenPayload);

    return {
      user: sanitizeUser(user),
      ...tokens,
    };
  }

  // 用户登录
  async login(data: { email: string; password: string }) {
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw Errors.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // 检查用户状态
    if (user.status === 'BANNED') {
      throw Errors.forbidden('Account is banned', 'ACCOUNT_BANNED');
    }

    // 验证密码
    const isPasswordValid = await comparePassword(data.password, user.password);

    if (!isPasswordValid) {
      throw Errors.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    logger.info(`User logged in: ${user.email}`);

    // 生成 Token
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokenPair(tokenPayload);

    return {
      user: sanitizeUser(user),
      ...tokens,
    };
  }

  // 刷新 Token
  async refreshToken(refreshToken: string) {
    try {
      // 验证刷新 Token
      const decoded = verifyRefreshToken(refreshToken);

      // 检查用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.status === 'BANNED') {
        throw Errors.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      }

      // 生成新的 Token 对
      const tokenPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      return generateTokenPair(tokenPayload);
    } catch (error) {
      throw Errors.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
  }

  // 修改密码
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // 获取用户
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw Errors.notFound('User not found', 'USER_NOT_FOUND');
    }

    // 验证当前密码
    const isPasswordValid = await comparePassword(currentPassword, user.password);

    if (!isPasswordValid) {
      throw Errors.badRequest('Current password is incorrect', 'INVALID_PASSWORD');
    }

    // 验证新密码强度
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw Errors.badRequest('Weak password', 'WEAK_PASSWORD', passwordValidation.errors);
    }

    // 加密新密码
    const hashedPassword = await hashPassword(newPassword);

    // 更新密码
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.info(`Password changed for user: ${user.email}`);

    return { message: 'Password changed successfully' };
  }

  // 获取当前用户信息
  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
          },
        },
      },
    });

    if (!user) {
      throw Errors.notFound('User not found', 'USER_NOT_FOUND');
    }

    return user;
  }
}

export const authService = new AuthService();
```

#### 2.7.2 文章服务 `src/services/post.service.ts`

```typescript
// src/services/post.service.ts
// 文章业务逻辑

import { Prisma, PostStatus } from '@prisma/client';
import prisma from '../config/database';
import { generateSlug, generateUniqueSlug } from '../utils/slug';
import { parsePagination, parseSort } from '../utils/helpers';
import { Errors } from '../utils/errors';
import { PostQuery } from '../types';

export class PostService {
  // 创建文章
  async create(authorId: string, data: {
    title: string;
    content: string;
    excerpt?: string;
    coverImage?: string;
    status?: PostStatus;
    categoryId?: string;
    tagIds?: string[];
  }) {
    // 生成 Slug
    let slug = generateSlug(data.title);

    // 检查 Slug 是否已存在
    const existingPost = await prisma.post.findUnique({
      where: { slug },
    });

    if (existingPost) {
      slug = generateUniqueSlug(data.title);
    }

    // 生成摘要（如果未提供）
    const excerpt = data.excerpt || data.content.substring(0, 200) + '...';

    // 创建文章
    const post = await prisma.post.create({
      data: {
        title: data.title,
        slug,
        content: data.content,
        excerpt,
        coverImage: data.coverImage,
        status: data.status || 'DRAFT',
        authorId,
        categoryId: data.categoryId,
        tags: data.tagIds ? {
          connect: data.tagIds.map(id => ({ id })),
        } : undefined,
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
        category: true,
        tags: true,
        _count: {
          select: { comments: true },
        },
      },
    });

    return post;
  }

  // 获取文章列表
  async findAll(query: PostQuery) {
    const { page, limit, skip } = parsePagination(query);
    const orderBy = parseSort(query.sortBy || 'createdAt', query.order || 'desc');

    // 构建过滤条件
    const where: Prisma.PostWhereInput = {};

    // 搜索
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // 状态过滤
    if (query.status) {
      where.status = query.status;
    }

    // 分类过滤
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    // 标签过滤
    if (query.tagId) {
      where.tags = {
        some: { id: query.tagId },
      };
    }

    // 作者过滤
    if (query.authorId) {
      where.authorId = query.authorId;
    }

    // 查询
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: { id: true, name: true, avatar: true },
          },
          category: true,
          tags: true,
          _count: {
            select: { comments: true },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return {
      data: posts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 根据 ID 或 Slug 获取文章
  async findByIdOrSlug(idOrSlug: string) {
    // 尝试作为 UUID 查找
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const post = await prisma.post.findUnique({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        author: {
          select: { id: true, name: true, avatar: true, bio: true },
        },
        category: true,
        tags: true,
        comments: {
          where: { parentId: null },
          include: {
            author: {
              select: { id: true, name: true, avatar: true },
            },
            replies: {
              include: {
                author: {
                  select: { id: true, name: true, avatar: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!post) {
      throw Errors.notFound('Post not found', 'POST_NOT_FOUND');
    }

    // 增加阅读量
    await prisma.post.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    });

    return post;
  }

  // 更新文章
  async update(postId: string, userId: string, userRole: string, data: {
    title?: string;
    content?: string;
    excerpt?: string;
    coverImage?: string | null;
    status?: PostStatus;
    categoryId?: string | null;
    tagIds?: string[];
  }) {
    // 获取文章
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw Errors.notFound('Post not found', 'POST_NOT_FOUND');
    }

    // 检查权限（只有作者或管理员可以编辑）
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw Errors.forbidden('You can only edit your own posts', 'NOT_AUTHOR');
    }

    // 更新 Slug（如果标题改变）
    let slug = post.slug;
    if (data.title && data.title !== post.title) {
      slug = generateSlug(data.title);
      const existingPost = await prisma.post.findUnique({
        where: { slug },
      });
      if (existingPost && existingPost.id !== postId) {
        slug = generateUniqueSlug(data.title);
      }
    }

    // 更新文章
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        coverImage: data.coverImage,
        status: data.status,
        categoryId: data.categoryId,
        tags: data.tagIds ? {
          set: data.tagIds.map(id => ({ id })),
        } : undefined,
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
        category: true,
        tags: true,
      },
    });

    return updatedPost;
  }

  // 删除文章
  async delete(postId: string, userId: string, userRole: string) {
    // 获取文章
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw Errors.notFound('Post not found', 'POST_NOT_FOUND');
    }

    // 检查权限
    if (post.authorId !== userId && userRole !== 'ADMIN') {
      throw Errors.forbidden('You can only delete your own posts', 'NOT_AUTHOR');
    }

    // 删除文章
    await prisma.post.delete({
      where: { id: postId },
    });

    return { message: 'Post deleted successfully' };
  }
}

export const postService = new PostService();
```

#### 2.7.3 评论服务 `src/services/comment.service.ts`

```typescript
// src/services/comment.service.ts
// 评论业务逻辑

import prisma from '../config/database';
import { Errors } from '../utils/errors';
import { parsePagination } from '../utils/helpers';

export class CommentService {
  // 创建评论
  async create(userId: string, postId: string, data: {
    content: string;
    parentId?: string;
  }) {
    // 检查文章是否存在
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw Errors.notFound('Post not found', 'POST_NOT_FOUND');
    }

    // 如果是回复，检查父评论是否存在
    if (data.parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: data.parentId },
      });

      if (!parentComment || parentComment.postId !== postId) {
        throw Errors.notFound('Parent comment not found', 'COMMENT_NOT_FOUND');
      }
    }

    // 创建评论
    const comment = await prisma.comment.create({
      data: {
        content: data.content,
        authorId: userId,
        postId,
        parentId: data.parentId,
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return comment;
  }

  // 获取文章评论
  async findByPostId(postId: string, query: { page?: string; limit?: string }) {
    const { page, limit, skip } = parsePagination(query);

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: {
          postId,
          parentId: null, // 只获取顶级评论
        },
        include: {
          author: {
            select: { id: true, name: true, avatar: true },
          },
          replies: {
            include: {
              author: {
                select: { id: true, name: true, avatar: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.comment.count({
        where: { postId, parentId: null },
      }),
    ]);

    return {
      data: comments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 更新评论
  async update(commentId: string, userId: string, content: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw Errors.notFound('Comment not found', 'COMMENT_NOT_FOUND');
    }

    if (comment.authorId !== userId) {
      throw Errors.forbidden('You can only edit your own comments', 'NOT_AUTHOR');
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return updatedComment;
  }

  // 删除评论
  async delete(commentId: string, userId: string, userRole: string) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw Errors.notFound('Comment not found', 'COMMENT_NOT_FOUND');
    }

    if (comment.authorId !== userId && userRole !== 'ADMIN') {
      throw Errors.forbidden('You can only delete your own comments', 'NOT_AUTHOR');
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return { message: 'Comment deleted successfully' };
  }
}

export const commentService = new CommentService();
```

#### 2.7.4 其他服务

```typescript
// src/services/category.service.ts
import prisma from '../config/database';
import { generateSlug } from '../utils/slug';
import { Errors } from '../utils/errors';

export class CategoryService {
  async create(data: { name: string; description?: string }) {
    const slug = generateSlug(data.name);

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      throw Errors.conflict('Category already exists', 'CATEGORY_EXISTS');
    }

    return prisma.category.create({
      data: { ...data, slug },
    });
  }

  async findAll() {
    return prisma.category.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        posts: {
          where: { status: 'PUBLISHED' },
          include: {
            author: { select: { id: true, name: true, avatar: true } },
            tags: true,
          },
        },
      },
    });

    if (!category) {
      throw Errors.notFound('Category not found', 'CATEGORY_NOT_FOUND');
    }

    return category;
  }

  async update(id: string, data: { name?: string; description?: string }) {
    const category = await prisma.category.findUnique({ where: { id } });

    if (!category) {
      throw Errors.notFound('Category not found', 'CATEGORY_NOT_FOUND');
    }

    let slug = category.slug;
    if (data.name && data.name !== category.name) {
      slug = generateSlug(data.name);
    }

    return prisma.category.update({
      where: { id },
      data: { ...data, slug },
    });
  }

  async delete(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    });

    if (!category) {
      throw Errors.notFound('Category not found', 'CATEGORY_NOT_FOUND');
    }

    if (category._count.posts > 0) {
      throw Errors.badRequest('Cannot delete category with posts', 'CATEGORY_HAS_POSTS');
    }

    await prisma.category.delete({ where: { id } });
    return { message: 'Category deleted successfully' };
  }
}

export const categoryService = new CategoryService();
```

```typescript
// src/services/tag.service.ts
import prisma from '../config/database';
import { generateSlug } from '../utils/slug';
import { Errors } from '../utils/errors';

export class TagService {
  async create(data: { name: string }) {
    const slug = generateSlug(data.name);

    const existing = await prisma.tag.findUnique({ where: { slug } });
    if (existing) {
      throw Errors.conflict('Tag already exists', 'TAG_EXISTS');
    }

    return prisma.tag.create({
      data: { ...data, slug },
    });
  }

  async findAll() {
    return prisma.tag.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const tag = await prisma.tag.findUnique({
      where: { slug },
      include: {
        posts: {
          where: { status: 'PUBLISHED' },
          include: {
            author: { select: { id: true, name: true, avatar: true } },
            category: true,
          },
        },
      },
    });

    if (!tag) {
      throw Errors.notFound('Tag not found', 'TAG_NOT_FOUND');
    }

    return tag;
  }

  async update(id: string, data: { name?: string }) {
    const tag = await prisma.tag.findUnique({ where: { id } });

    if (!tag) {
      throw Errors.notFound('Tag not found', 'TAG_NOT_FOUND');
    }

    let slug = tag.slug;
    if (data.name && data.name !== tag.name) {
      slug = generateSlug(data.name);
    }

    return prisma.tag.update({
      where: { id },
      data: { ...data, slug },
    });
  }

  async delete(id: string) {
    const tag = await prisma.tag.findUnique({ where: { id } });

    if (!tag) {
      throw Errors.notFound('Tag not found', 'TAG_NOT_FOUND');
    }

    await prisma.tag.delete({ where: { id } });
    return { message: 'Tag deleted successfully' };
  }
}

export const tagService = new TagService();
```

```typescript
// src/services/user.service.ts
import prisma from '@prisma/client';
import { Errors } from '../utils/errors';
import { sanitizeUser, parsePagination } from '../utils/helpers';

export class UserService {
  async findAll(query: { page?: string; limit?: string; role?: string; search?: string }) {
    const { page, limit, skip } = parsePagination(query);

    const where: any = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          avatar: true,
          createdAt: true,
          _count: {
            select: { posts: true, comments: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: { posts: true, comments: true },
        },
      },
    });

    if (!user) {
      throw Errors.notFound('User not found', 'USER_NOT_FOUND');
    }

    return user;
  }

  async updateProfile(userId: string, data: { name?: string; bio?: string; avatar?: string }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        bio: true,
      },
    });
  }

  async updateRole(userId: string, role: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw Errors.notFound('User not found', 'USER_NOT_FOUND');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async updateStatus(userId: string, status: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw Errors.notFound('User not found', 'USER_NOT_FOUND');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { status: status as any },
      select: { id: true, email: true, name: true, status: true },
    });
  }

  async delete(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw Errors.notFound('User not found', 'USER_NOT_FOUND');
    }

    await prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted successfully' };
  }
}

export const userService = new UserService();
```

```typescript
// src/services/stats.service.ts
import prisma from '../config/database';

export class StatsService {
  async getDashboard() {
    const [
      totalUsers,
      totalPosts,
      totalComments,
      publishedPosts,
      draftPosts,
      recentPosts,
      popularPosts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.comment.count(),
      prisma.post.count({ where: { status: 'PUBLISHED' } }),
      prisma.post.count({ where: { status: 'DRAFT' } }),
      prisma.post.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.post.findMany({
        take: 5,
        where: { status: 'PUBLISHED' },
        orderBy: { viewCount: 'desc' },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
      }),
    ]);

    return {
      totalUsers,
      totalPosts,
      totalComments,
      publishedPosts,
      draftPosts,
      recentPosts,
      popularPosts,
    };
  }

  async getPostStats(postId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        viewCount: true,
        _count: { select: { comments: true } },
      },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    return post;
  }
}

export const statsService = new StatsService();
```

```typescript
// src/services/upload.service.ts
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { Errors } from '../utils/errors';

export class UploadService {
  async uploadFile(file: Express.Multer.File) {
    if (!file) {
      throw Errors.badRequest('No file uploaded', 'NO_FILE');
    }

    return {
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    };
  }

  async uploadMultipleFiles(files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw Errors.badRequest('No files uploaded', 'NO_FILE');
    }

    return files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    }));
  }

  async deleteFile(filename: string) {
    const filepath = path.join(env.UPLOAD_DIR, filename);

    try {
      await fs.access(filepath);
      await fs.unlink(filepath);
      return { message: 'File deleted successfully' };
    } catch (error) {
      throw Errors.notFound('File not found', 'FILE_NOT_FOUND');
    }
  }
}

export const uploadService = new UploadService();
```

### 2.8 控制器层

#### 2.8.1 认证控制器 `src/controllers/auth.controller.ts`

```typescript
// src/controllers/auth.controller.ts
// 认证控制器

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';

export class AuthController {
  // 注册
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      sendCreated(res, result, 'Registration successful');
    } catch (error) {
      next(error);
    }
  }

  // 登录
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      sendSuccess(res, result, 200, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  // 刷新 Token
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // 获取当前用户
  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getCurrentUser(req.user!.userId);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  // 修改密码
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(
        req.user!.userId,
        currentPassword,
        newPassword
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
```

#### 2.8.2 文章控制器 `src/controllers/post.controller.ts`

```typescript
// src/controllers/post.controller.ts
// 文章控制器

import { Request, Response, NextFunction } from 'express';
import { postService } from '../services/post.service';
import { sendSuccess, sendCreated, sendDeleted, sendPaginated } from '../utils/response';

export class PostController {
  // 创建文章
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await postService.create(req.user!.userId, req.body);
      sendCreated(res, post, 'Post created successfully');
    } catch (error) {
      next(error);
    }
  }

  // 获取文章列表
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await postService.findAll(req.query as any);
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit);
    } catch (error) {
      next(error);
    }
  }

  // 获取单篇文章
  async findByIdOrSlug(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await postService.findByIdOrSlug(req.params.idOrSlug);
      sendSuccess(res, post);
    } catch (error) {
      next(error);
    }
  }

  // 更新文章
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await postService.update(
        req.params.id,
        req.user!.userId,
        req.user!.role,
        req.body
      );
      sendSuccess(res, post, 'Post updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // 删除文章
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await postService.delete(
        req.params.id,
        req.user!.userId,
        req.user!.role
      );
      sendDeleted(res, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const postController = new PostController();
```

#### 2.8.3 其他控制器

```typescript
// src/controllers/comment.controller.ts
import { Request, Response, NextFunction } from 'express';
import { commentService } from '../services/comment.service';
import { sendSuccess, sendCreated, sendDeleted, sendPaginated } from '../utils/response';

export class CommentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const comment = await commentService.create(
        req.user!.userId,
        req.params.postId,
        req.body
      );
      sendCreated(res, comment, 'Comment created successfully');
    } catch (error) {
      next(error);
    }
  }

  async findByPostId(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await commentService.findByPostId(req.params.postId, req.query as any);
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const comment = await commentService.update(
        req.params.id,
        req.user!.userId,
        req.body.content
      );
      sendSuccess(res, comment, 'Comment updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await commentService.delete(
        req.params.id,
        req.user!.userId,
        req.user!.role
      );
      sendDeleted(res, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const commentController = new CommentController();
```

```typescript
// src/controllers/category.controller.ts
import { Request, Response, NextFunction } from 'express';
import { categoryService } from '../services/category.service';
import { sendSuccess, sendCreated, sendDeleted } from '../utils/response';

export class CategoryController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoryService.create(req.body);
      sendCreated(res, category);
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await categoryService.findAll();
      sendSuccess(res, categories);
    } catch (error) {
      next(error);
    }
  }

  async findBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoryService.findBySlug(req.params.slug);
      sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoryService.update(req.params.id, req.body);
      sendSuccess(res, category);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await categoryService.delete(req.params.id);
      sendDeleted(res, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const categoryController = new CategoryController();
```

```typescript
// src/controllers/tag.controller.ts
import { Request, Response, NextFunction } from 'express';
import { tagService } from '../services/tag.service';
import { sendSuccess, sendCreated, sendDeleted } from '../utils/response';

export class TagController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const tag = await tagService.create(req.body);
      sendCreated(res, tag);
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const tags = await tagService.findAll();
      sendSuccess(res, tags);
    } catch (error) {
      next(error);
    }
  }

  async findBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const tag = await tagService.findBySlug(req.params.slug);
      sendSuccess(res, tag);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const tag = await tagService.update(req.params.id, req.body);
      sendSuccess(res, tag);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tagService.delete(req.params.id);
      sendDeleted(res, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const tagController = new TagController();
```

```typescript
// src/controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { sendSuccess, sendDeleted, sendPaginated } from '../utils/response';

export class UserController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await userService.findAll(req.query as any);
      sendPaginated(res, result.data, result.pagination.total, result.pagination.page, result.pagination.limit);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.findById(req.params.id);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.updateProfile(req.user!.userId, req.body);
      sendSuccess(res, user, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.updateRole(req.params.id, req.body.role);
      sendSuccess(res, user, 'User role updated');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.updateStatus(req.params.id, req.body.status);
      sendSuccess(res, user, 'User status updated');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await userService.delete(req.params.id);
      sendDeleted(res, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
```

```typescript
// src/controllers/upload.controller.ts
import { Request, Response, NextFunction } from 'express';
import { uploadService } from '../services/upload.service';
import { sendSuccess, sendCreated } from '../utils/response';

export class UploadController {
  async uploadSingle(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await uploadService.uploadFile(req.file!);
      sendCreated(res, result, 'File uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async uploadMultiple(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await uploadService.uploadMultipleFiles(req.files as Express.Multer.File[]);
      sendCreated(res, result, 'Files uploaded successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await uploadService.deleteFile(req.params.filename);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();
```

```typescript
// src/controllers/stats.controller.ts
import { Request, Response, NextFunction } from 'express';
import { statsService } from '../services/stats.service';
import { sendSuccess } from '../utils/response';

export class StatsController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await statsService.getDashboard();
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getPostStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await statsService.getPostStats(req.params.postId);
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
}

export const statsController = new StatsController();
```

### 2.9 路由层

#### 2.9.1 认证路由 `src/routes/auth.routes.ts`

```typescript
// src/routes/auth.routes.ts
// 认证路由

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../validators/auth.validator';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Email already exists
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  authController.register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  authController.login
);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 */
router.post(
  '/refresh-token',
  validate(refreshTokenSchema),
  authController.refreshToken
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/me',
  authenticate,
  authController.getCurrentUser
);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Change password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.put(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);

export default router;
```

#### 2.9.2 文章路由 `src/routes/post.routes.ts`

```typescript
// src/routes/post.routes.ts
// 文章路由

import { Router } from 'express';
import { postController } from '../controllers/post.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createPostSchema,
  updatePostSchema,
  getPostsSchema,
  getPostSchema,
  deletePostSchema,
} from '../validators/post.validator';

const router = Router();

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get all posts
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: tagId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of posts
 */
router.get(
  '/',
  optionalAuth,
  validate(getPostsSchema),
  postController.findAll
);

/**
 * @swagger
 * /api/posts/{idOrSlug}:
 *   get:
 *     summary: Get post by ID or slug
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: idOrSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post details
 *       404:
 *         description: Post not found
 */
router.get(
  '/:idOrSlug',
  optionalAuth,
  validate(getPostSchema),
  postController.findByIdOrSlug
);

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Post'
 *     responses:
 *       201:
 *         description: Post created successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authenticate,
  validate(createPostSchema),
  postController.create
);

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: Update a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Post'
 *     responses:
 *       200:
 *         description: Post updated successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 */
router.put(
  '/:id',
  authenticate,
  validate(updatePostSchema),
  postController.update
);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 */
router.delete(
  '/:id',
  authenticate,
  validate(deletePostSchema),
  postController.delete
);

export default router;
```

#### 2.9.3 其他路由

```typescript
// src/routes/comment.routes.ts
import { Router } from 'express';
import { commentController } from '../controllers/comment.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createCommentSchema, updateCommentSchema } from '../validators/comment.validator';

const router = Router();

router.get('/:postId/comments', commentController.findByPostId);
router.post('/:postId/comments', authenticate, validate(createCommentSchema), commentController.create);
router.put('/comments/:id', authenticate, validate(updateCommentSchema), commentController.update);
router.delete('/comments/:id', authenticate, commentController.delete);

export default router;
```

```typescript
// src/routes/category.routes.ts
import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createCategorySchema, updateCategorySchema } from '../validators/category.validator';

const router = Router();

router.get('/', categoryController.findAll);
router.get('/:slug', categoryController.findBySlug);
router.post('/', authenticate, authorize('ADMIN'), validate(createCategorySchema), categoryController.create);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateCategorySchema), categoryController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), categoryController.delete);

export default router;
```

```typescript
// src/routes/tag.routes.ts
import { Router } from 'express';
import { tagController } from '../controllers/tag.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createTagSchema, updateTagSchema } from '../validators/tag.validator';

const router = Router();

router.get('/', tagController.findAll);
router.get('/:slug', tagController.findBySlug);
router.post('/', authenticate, authorize('ADMIN'), validate(createTagSchema), tagController.create);
router.put('/:id', authenticate, authorize('ADMIN'), validate(updateTagSchema), tagController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), tagController.delete);

export default router;
```

```typescript
// src/routes/user.routes.ts
import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { updateProfileSchema, getUserSchema, getUsersSchema } from '../validators/user.validator';

const router = Router();

router.get('/', authenticate, authorize('ADMIN'), validate(getUsersSchema), userController.findAll);
router.get('/:id', authenticate, validate(getUserSchema), userController.findById);
router.put('/profile', authenticate, validate(updateProfileSchema), userController.updateProfile);
router.put('/:id/role', authenticate, authorize('ADMIN'), userController.updateRole);
router.put('/:id/status', authenticate, authorize('ADMIN'), userController.updateStatus);
router.delete('/:id', authenticate, authorize('ADMIN'), userController.delete);

export default router;
```

```typescript
// src/routes/upload.routes.ts
import { Router } from 'express';
import { uploadController } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth';
import { uploadSingle, uploadMultiple } from '../middleware/upload';
import { uploadLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/single', authenticate, uploadLimiter, uploadSingle('file'), uploadController.uploadSingle);
router.post('/multiple', authenticate, uploadLimiter, uploadMultiple('files', 5), uploadController.uploadMultiple);
router.delete('/:filename', authenticate, uploadController.deleteFile);

export default router;
```

```typescript
// src/routes/stats.routes.ts
import { Router } from 'express';
import { statsController } from '../controllers/stats.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = Router();

router.get('/dashboard', authenticate, authorize('ADMIN'), statsController.getDashboard);
router.get('/posts/:postId', authenticate, statsController.getPostStats);

export default router;
```

#### 2.9.4 路由聚合 `src/routes/index.ts`

```typescript
// src/routes/index.ts
// 路由聚合

import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import postRoutes from './post.routes';
import categoryRoutes from './category.routes';
import tagRoutes from './tag.routes';
import commentRoutes from './comment.routes';
import uploadRoutes from './upload.routes';
import statsRoutes from './stats.routes';

const router = Router();

// 注册路由
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
router.use('/categories', categoryRoutes);
router.use('/tags', tagRoutes);
router.use('/posts', commentRoutes); // 评论嵌套在文章下
router.use('/upload', uploadRoutes);
router.use('/stats', statsRoutes);

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Blog API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

### 2.10 应用入口

#### `src/index.ts`

```typescript
// src/index.ts
// 应用入口

import express from 'express';
import path from 'path';
import swaggerUi from 'swagger-ui-express';

// 配置
import { env } from './config/env';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { logger } from './config/logger';
import { swaggerSpec } from './config/swagger';

// 中间件
import { corsMiddleware } from './middleware/cors';
import { requestLogger } from './middleware/logger';
import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// 路由
import routes from './routes';

// 创建 Express 应用
const app = express();

// ===== 中间件配置 =====

// CORS 跨域
app.use(corsMiddleware);

// 请求日志
app.use(requestLogger);

// 限流
app.use(generalLimiter);

// 解析请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '..', env.UPLOAD_DIR)));

// ===== API 文档 =====
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Blog API Documentation',
}));

// ===== 路由 =====
app.use('/api', routes);

// ===== 错误处理 =====
app.use(notFoundHandler);
app.use(errorHandler);

// ===== 启动服务器 =====
async function startServer() {
  try {
    // 连接数据库
    await connectDatabase();
    logger.info('Database connected');

    // 连接 Redis（可选）
    await connectRedis();

    // 启动服务器
    app.listen(env.PORT, () => {
      logger.info(`
🚀 Blog API Server is running!
📡 Port: ${env.PORT}
🌍 Environment: ${env.NODE_ENV}
📚 API Docs: http://localhost:${env.PORT}/api-docs
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 启动应用
startServer();

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
```

### 2.11 配置文件

#### `package.json`

```json
{
  "name": "blog-api",
  "version": "1.0.0",
  "description": "A complete blog API built with Express, TypeScript, Prisma and PostgreSQL",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "prisma:seed": "ts-node prisma/seed.ts",
    "lint": "eslint src --ext .ts",
    "test": "jest",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "redis": "^4.6.10",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^5.0.0",
    "uuid": "^9.0.0",
    "winston": "^3.11.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.10.0",
    "@types/swagger-jsdoc": "^6.0.4",
    "@types/swagger-ui-express": "^4.1.6",
    "@types/uuid": "^9.0.7",
    "jest": "^29.7.0",
    "prisma": "^5.0.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.2"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

#### `.env.example`

```bash
# .env.example - Environment variables template

# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/blog_db?schema=public

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-token-secret-min-32-chars
JWT_REFRESH_EXPIRES_IN=30d

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=debug

# File Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

#### `.gitignore`

```gitignore
# Dependencies
node_modules/

# Environment
.env
.env.local
.env.production

# Build output
dist/

# Logs
logs/
*.log

# Uploads
uploads/*
!uploads/.gitkeep

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Test
coverage/

# Docker
docker-compose.override.yml
```

---

## 三、功能清单

本项目实现了以下完整功能：

### 用户管理
- [x] 用户注册（邮箱验证、密码强度检查）
- [x] 用户登录（JWT Token）
- [x] Token 刷新机制
- [x] 个人资料查看和修改
- [x] 头像上传
- [x] 修改密码
- [x] 管理员：用户列表、修改角色、封禁用户

### 文章管理
- [x] 文章 CRUD（创建、读取、更新、删除）
- [x] 草稿/发布状态
- [x] 自动生成 Slug
- [x] 文章分类
- [x] 文章标签（多对多）
- [x] 封面图片
- [x] 阅读量统计
- [x] 按关键词、分类、标签、作者筛选
- [x] 分页和排序

### 评论系统
- [x] 评论 CRUD
- [x] 嵌套评论（回复）
- [x] 按文章获取评论树

### 其他功能
- [x] 文件上传（单文件、多文件）
- [x] Swagger API 文档
- [x] 完整的错误处理
- [x] 请求日志记录
- [x] API 限流
- [x] CORS 跨域配置
- [x] 统计仪表盘（管理员）
- [x] 健康检查端点

---

## 四、如何启动和测试

### 4.1 使用 Docker Compose 启动

```bash
# 1. 克隆项目
git clone <your-repo-url>
cd blog-api

# 2. 复制环境变量文件
cp .env.example .env

# 3. 修改 .env 文件中的配置
# 至少修改 JWT_SECRET 为一个安全的随机字符串

# 4. 使用 Docker Compose 启动所有服务
docker-compose up -d

# 5. 查看服务状态
docker-compose ps

# 6. 查看日志
docker-compose logs -f app

# 7. 访问 API 文档
# 浏览器打开 http://localhost:3000/api-docs
```

### 4.2 本地开发启动

```bash
# 1. 安装依赖
npm install

# 2. 生成 Prisma Client
npx prisma generate

# 3. 运行数据库迁移
npx prisma migrate dev

# 4. 启动开发服务器
npm run dev

# 5. 访问 API 文档
# 浏览器打开 http://localhost:3000/api-docs
```

### 4.3 测试 API

```bash
# ===== 认证相关 =====

# 注册用户
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "Password123"
  }'

# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'
# 响应会返回 accessToken，保存下来用于后续请求

# 获取当前用户信息
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# ===== 分类相关 =====

# 创建分类（需要管理员权限）
curl -X POST http://localhost:3000/api/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Technology",
    "description": "Tech related posts"
  }'

# 获取所有分类
curl http://localhost:3000/api/categories

# ===== 标签相关 =====

# 创建标签（需要管理员权限）
curl -X POST http://localhost:3000/api/tags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"name": "JavaScript"}'

curl -X POST http://localhost:3000/api/tags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"name": "TypeScript"}'

# 获取所有标签
curl http://localhost:3000/api/tags

# ===== 文章相关 =====

# 创建文章
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "Getting Started with TypeScript",
    "content": "TypeScript is a typed superset of JavaScript...",
    "excerpt": "Learn the basics of TypeScript",
    "status": "PUBLISHED",
    "categoryId": "CATEGORY_ID",
    "tagIds": ["TAG_ID_1", "TAG_ID_2"]
  }'

# 获取文章列表
curl http://localhost:3000/api/posts

# 带筛选条件获取文章
curl "http://localhost:3000/api/posts?search=typescript&status=PUBLISHED&page=1&limit=10"

# 获取单篇文章（通过 ID 或 Slug）
curl http://localhost:3000/api/posts/getting-started-with-typescript

# 更新文章
curl -X PUT http://localhost:3000/api/posts/POST_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "Updated Title",
    "status": "PUBLISHED"
  }'

# 删除文章
curl -X DELETE http://localhost:3000/api/posts/POST_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# ===== 评论相关 =====

# 创建评论
curl -X POST http://localhost:3000/api/posts/POST_ID/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "content": "Great article!"
  }'

# 创建回复
curl -X POST http://localhost:3000/api/posts/POST_ID/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "content": "Thanks!",
    "parentId": "COMMENT_ID"
  }'

# 获取文章评论
curl http://localhost:3000/api/posts/POST_ID/comments

# ===== 文件上传 =====

# 上传单个文件
curl -X POST http://localhost:3000/api/upload/single \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@/path/to/image.jpg"

# 上传多个文件
curl -X POST http://localhost:3000/api/upload/multiple \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.jpg"

# ===== 管理员功能 =====

# 获取所有用户（需要管理员权限）
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 修改用户角色
curl -X PUT http://localhost:3000/api/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"role": "ADMIN"}'

# 封禁用户
curl -X PUT http://localhost:3000/api/users/USER_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"status": "BANNED"}'

# 获取统计仪表盘
curl http://localhost:3000/api/stats/dashboard \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# ===== 健康检查 =====
curl http://localhost:3000/api/health
```

### 4.4 使用 Prisma Studio 查看数据

```bash
# 启动 Prisma Studio（图形化数据库管理工具）
npx prisma studio

# 浏览器会自动打开 http://localhost:5555
```

---

## 五、项目总结与第四阶段预告

### 5.1 项目总结

恭喜你完成了博客 API 系统的开发！通过这个项目，你已经掌握了：

**第一阶段 - Node.js 基础**
- Node.js 和 Express 框架的核心概念
- TypeScript 在后端项目中的应用
- RESTful API 设计原则
- 中间件机制

**第二阶段 - 数据库**
- PostgreSQL 关系型数据库
- Prisma ORM 的使用
- 数据库建模和关系设计
- 数据库迁移

**第三阶段 - 认证与实践**
- 用户认证和 JWT
- 密码加密和安全
- RBAC 权限控制
- 文件上传
- API 文档（Swagger）
- 日志和监控
- 部署上线

### 5.2 项目架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Blog API 架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   客户端 (Client)                                           │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Browser / Mobile App / Postman                     │   │
│   └─────────────────────────┬───────────────────────────┘   │
│                              │                              │
│                              ↓ HTTP Request                 │
│                                                             │
│   Express 应用                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ┌─────────────────────────────────────────────┐    │   │
│   │  │           中间件层 (Middleware)                │    │   │
│   │  │  CORS → Logger → RateLimit → Auth → Validate│    │   │
│   │  └─────────────────────────┬───────────────────┘    │   │
│   │                             │                        │   │
│   │  ┌─────────────────────────↓───────────────────┐    │   │
│   │  │           路由层 (Routes)                     │    │   │
│   │  │  /auth  /users  /posts  /comments  /upload  │    │   │
│   │  └─────────────────────────┬───────────────────┘    │   │
│   │                             │                        │   │
│   │  ┌─────────────────────────↓───────────────────┐    │   │
│   │  │           控制器层 (Controllers)              │    │   │
│   │  │  接收请求 → 调用服务 → 返回响应              │    │   │
│   │  └─────────────────────────┬───────────────────┘    │   │
│   │                             │                        │   │
│   │  ┌─────────────────────────↓───────────────────┐    │   │
│   │  │           服务层 (Services)                   │    │   │
│   │  │  业务逻辑 → 数据处理 → 规则验证              │    │   │
│   │  └─────────────────────────┬───────────────────┘    │   │
│   │                             │                        │   │
│   │  ┌─────────────────────────↓───────────────────┐    │   │
│   │  │           工具层 (Utils)                      │    │   │
│   │  │  JWT  Password  Response  Slug  Helpers     │    │   │
│   │  └─────────────────────────┬───────────────────┘    │   │
│   └─────────────────────────────┼───────────────────────┘   │
│                                 │                            │
│                                 ↓                            │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              数据层 (Data Layer)                      │   │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│   │  │ Prisma   │  │ PostgreSQL│  │  Redis   │          │   │
│   │  │  ORM     │→ │  数据库   │  │  缓存    │          │   │
│   │  └──────────┘  └──────────┘  └──────────┘          │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 第四阶段预告

在第四阶段，我们将学习更高级的后端技术：

**第 10 课：缓存策略**
- Redis 缓存深入
- 缓存策略（Cache-Aside、Write-Through）
- 缓存失效和更新

**第 11 课：消息队列**
- 异步处理
- Bull Queue
- 任务调度

**第 12 课：微服务基础**
- 微服务架构概念
- 服务间通信
- API Gateway

**第 13 课：性能优化**
- 数据库查询优化
- N+1 问题
- 索引优化
- 连接池

**第 14 课：测试**
- 单元测试
- 集成测试
- 测试覆盖率

**第 15 课：安全加固**
- SQL 注入防护
- XSS 防护
- CSRF 防护
- 安全头部

**第 16 课：监控与运维**
- APM 工具
- 健康检查
- 告警系统
- 日志分析

### 5.4 持续学习建议

1. **阅读官方文档**：Express、Prisma、PostgreSQL 官方文档是最好的学习资源
2. **参与开源项目**：在 GitHub 上参与后端项目，学习最佳实践
3. **构建个人项目**：尝试独立开发一个完整的后端系统
4. **学习系统设计**：了解大型系统的架构设计原则
5. **关注安全**：时刻关注 Web 安全的最新动态

---

## 练习

### 练习 1：功能扩展
1. 为文章添加「点赞」功能
2. 实现文章收藏功能
3. 添加用户关注系统

### 练习 2：性能优化
1. 为常用查询添加 Redis 缓存
2. 优化 N+1 查询问题
3. 添加数据库索引

### 练习 3：测试
1. 编写单元测试（Jest）
2. 编写集成测试
3. 达到 80% 以上的测试覆盖率

### 练习 4：部署
1. 将项目部署到 Railway
2. 配置自定义域名
3. 设置 CI/CD 自动部署

---

## 常见误区

1. **代码结构混乱没有分层**：所有逻辑写在一个文件里，路由定义、业务逻辑、数据库操作混在一起。项目超过 1000 行后就无法维护。必须遵循 Controller → Service → Repository 的分层架构。

2. **环境变量不做启动时验证**：代码中到处用 `process.env.JWT_SECRET`，但运行时才发现没配置，报错信息模糊难定位。应该在应用启动时用 Zod 验证所有必需的环境变量，缺失则直接拒绝启动。

3. **错误处理不统一**：每个 Controller 各自写 try-catch，错误响应格式不一致（有的返回 `{ error }`，有的返回 `{ message }`）。应该用全局错误处理中间件 + 自定义错误类统一处理。

4. **不写验证器直接信任客户端输入**：直接用 `req.body` 操作数据库，导致类型错误、空值、SQL 注入等问题。所有外部输入都必须经过 Zod 或 class-validator 验证。

---

## 工程建议

1. **项目结构要自解释**：新人看目录结构就能知道每个文件的职责（`controllers/` 处理请求、`services/` 处理业务、`validators/` 做验证、`middleware/` 做中间件）。不需要读代码就能理解架构。

2. **统一响应格式贯穿所有接口**：`{ success: true, data: T, message: string }` 和 `{ success: false, error: { code, message } }` 两种格式覆盖所有场景。前端只需要判断 `success` 字段。

3. **把验证器和路由放在一起看**：`validate(registerSchema)` 中间件放在路由定义中，看路由就知道需要什么参数、什么格式。不需要打开 Controller 代码。

4. **用 Prisma 的 `select` 控制返回字段**：永远不要返回密码字段。在 Service 层用 `select: { id: true, email: true, name: true }` 明确指定返回哪些字段，比在后面用 `delete user.password` 安全得多。

---

## 小结

本课我们完成了一个完整的博客 API 系统，整合了前三阶段学习的所有知识：

- **分层架构**：配置层 → 中间件层 → 路由层 → 控制器层 → 服务层 → 数据层
- **完整功能**：用户认证、文章管理、评论系统、文件上传、统计分析
- **工程实践**：错误处理、日志记录、API 文档、安全防护、Docker 部署

这个项目可以作为你未来开发其他后端项目的基础模板。继续学习第四阶段的高级内容，你将成为一名全栈开发者！
