# Express 到 NestJS 迁移

## 场景引入

你的团队用 Express 搭建了一个后端 API 服务。起初只有五六个路由，一个 `app.js` 文件搞定。两年后，服务膨胀到 40 多个路由、15 个中间件、数据库查询散落在各个路由处理器里。新人入职要花两周才能找到某个业务逻辑的入口，加一个新功能要改三四个文件，单元测试几乎不可能写——因为所有东西都耦合在一起。

Express 的哲学是"不干预你的架构"，这在小项目里是自由，在大项目里是放任。NestJS 在 Express（或 Fastify）之上提供了一套完整的架构规范：模块化组织、依赖注入、装饰器驱动的路由定义、开箱即用的测试支持。迁移的收益不是性能提升，而是**代码的可预测性和可维护性**。

本课讲的是如何把一个 Express 项目系统地迁移到 NestJS，同时保持 API 接口不变，不影响前端调用。

## 学习目标

完成本课学习后，你将能够：

1. 将 Express 中间件转换为 NestJS 中间件或守卫
2. 将路由处理器重构为控制器 + 服务层的标准架构
3. 利用依赖注入解耦业务逻辑
4. 按模块组织代码，替代 Express 中按文件/功能的松散组织
5. 制定渐进式迁移策略，让 Express 和 NestJS 路由共存

## 核心概念

### 一、架构哲学的差异

Express 和 NestJS 的根本区别不在语法，在于对"好架构"的态度。

```
Express 的隐含假设：
  开发者自己决定怎么组织代码
  → 路由、业务逻辑、数据访问可以混在一起
  → 没有强制的分层约束
  → 灵活但容易失控

NestJS 的显式约束：
  框架规定代码的组织方式
  → Controller 处理 HTTP，Service 处理业务，Module 组织边界
  → 依赖注入管理对象生命周期
  → 规范但初期有学习成本
```

Express 项目迁移到 NestJS 的核心工作量不在语法转换，而在于**把散落在路由处理器里的业务逻辑提取到服务层**。这一步做好了，迁移就完成了一大半。

### 二、请求处理管线的映射

Express 和 NestJS 都有中间件概念，但 NestJS 细分了更多层次。

```
请求生命周期映射：

Express:
  Request → Middleware → Route Handler → Response
                      ↓
               (所有逻辑混在一起)

NestJS:
  Request → Middleware → Guard → Interceptor(before)
                → Pipe → Controller → Service
                → Interceptor(after) → Exception Filter → Response
```

| Express 概念 | NestJS 对应 | 适用场景 |
|-------------|------------|---------|
| `app.use(fn)` | Middleware | 通用请求预处理 |
| 自定义认证中间件 | Guard | 身份验证、权限控制 |
| 参数校验中间件 | Pipe | 请求参数转换和验证 |
| 错误处理中间件 | Exception Filter | 统一异常处理 |
| 响应转换中间件 | Interceptor | 响应格式化、日志记录 |

### 三、依赖注入的价值

Express 里常用的模式是"在路由处理器里直接 new 服务对象"或者"用 require 导入单例"。NestJS 的依赖注入让对象的创建和组装由框架管理，带来三个好处：可测试性（轻松 mock 依赖）、可替换性（换实现不改调用方）、生命周期管理（框架控制单例/请求级实例）。

```
Express 中的依赖获取：

  const db = require('./database');        // 全局单例
  const redis = new Redis(config);         // 手动创建

NestJS 中的依赖注入：

  constructor(
    private readonly db: DatabaseService,
    private readonly cache: CacheService,
  ) {}
  // 框架自动注入，构造函数声明需要什么
```

### 四、模块化组织

Express 项目通常按文件类型组织（routes/、middlewares/、models/），NestJS 按业务领域组织模块。

```
Express 典型结构：                    NestJS 典型结构：
  src/                                src/
  ├── routes/                         ├── users/
  │   ├── users.js                    │   ├── users.module.ts
  │   ├── orders.js                   │   ├── users.controller.ts
  │   └── products.js                 │   ├── users.service.ts
  ├── middlewares/                     │   ├── dto/
  │   ├── auth.js                     │   │   ├── create-user.dto.ts
  │   └── validator.js                │   │   └── user-response.dto.ts
  ├── models/                         │   └── entities/
  │   ├── User.js                     │       └── user.entity.ts
  │   └── Order.js                    ├── orders/
  └── utils/                          │   ├── orders.module.ts
      └── helpers.js                  │   ├── orders.controller.ts
                                      │   └── orders.service.ts
                                      ├── common/
                                      │   ├── guards/
                                      │   ├── interceptors/
                                      │   └── filters/
                                      └── app.module.ts
```

## 完整代码示例

### 示例一：路由处理器到控制器 + 服务层

**迁移前：Express 用户管理路由**

```javascript
// routes/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const { authMiddleware } = require('../middlewares/auth');
const { validateBody } = require('../middlewares/validator');

// 获取用户列表
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, role } = req.query;
    const filter = {};
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select('-password')
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({
      data: users,
      pagination: { page: Number(page), pageSize: Number(pageSize), total },
    });
  } catch (error) {
    next(error);
  }
});

// 获取单个用户
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

// 创建用户
router.post(
  '/',
  authMiddleware,
  validateBody({
    username: { type: 'string', minLength: 3, maxLength: 20 },
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 },
    role: { type: 'string', enum: ['user', 'admin', 'editor'] },
  }),
  async (req, res, next) => {
    try {
      const { username, email, password, role } = req.body;

      // 检查重复
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });
      if (existingUser) {
        return res.status(409).json({
          message: existingUser.email === email ? '邮箱已注册' : '用户名已存在',
        });
      }

      // 密码加密
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await User.create({
        username,
        email,
        password: hashedPassword,
        role: role || 'user',
      });

      // 生成 token
      const token = jwt.sign(
        { sub: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        data: { id: user._id, username: user.username, email: user.email },
        token,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 更新用户
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { username, email, role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username, email, role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

// 删除用户
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

**迁移后：NestJS 控制器 + 服务 + DTO**

```typescript
// users/dto/list-users.dto.ts
import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListUsersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number = 20;

  @IsOptional() @IsString() @IsIn(['user', 'admin', 'editor'])
  role?: string;
}
```

```typescript
// users/dto/create-user.dto.ts
import { IsString, IsEmail, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsString() @MinLength(3) @MaxLength(20)
  username: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(8)
  password: string;

  @IsOptional() @IsString() @IsIn(['user', 'admin', 'editor'])
  role?: string = 'user';
}
```

```typescript
// users/dto/update-user.dto.ts
import { IsString, IsEmail, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(20)
  username?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @IsIn(['user', 'admin', 'editor'])
  role?: string;
}
```

```typescript
// users/users.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAll(query: ListUsersDto) {
    const { page = 1, pageSize = 20, role } = query;
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      data: users,
      pagination: { page, pageSize, total },
    };
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) throw new NotFoundException('用户不存在');
    return { data: user };
  }

  async create(dto: CreateUserDto) {
    const existingUser = await this.userModel.findOne({
      $or: [{ email: dto.email }, { username: dto.username }],
    }).exec();

    if (existingUser) {
      throw new ConflictException(
        existingUser.email === dto.email ? '邮箱已注册' : '用户名已存在',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.create({
      ...dto,
      password: hashedPassword,
    });

    return {
      data: { id: user._id, username: user.username, email: user.email },
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .select('-password')
      .exec();

    if (!user) throw new NotFoundException('用户不存在');
    return { data: user };
  }

  async remove(id: string) {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) throw new NotFoundException('用户不存在');
  }
}
```

```typescript
// users/users.controller.ts
import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: ListUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
```

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

**迁移要点分析：**

Express 版本里，路由处理器同时负责参数解析、业务逻辑、数据库操作、错误处理。NestJS 版本把这些职责拆分到不同层次：

- `Controller`：解析 HTTP 请求参数，调用服务，返回响应
- `Service`：纯业务逻辑，不关心 HTTP 细节
- `DTO`：声明和验证输入数据结构
- `Module`：声明这个功能模块需要的所有依赖

### 示例二：中间件到守卫和拦截器

**迁移前：Express 认证中间件**

```javascript
// middlewares/auth.js
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '令牌已过期' });
    }
    return res.status(401).json({ message: '无效的认证令牌' });
  }
}

// 角色检查中间件工厂
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole };
```

**迁移后：NestJS 守卫 + 装饰器**

```typescript
// common/guards/auth.guard.ts
import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('未提供认证令牌');
    }

    try {
      const payload = this.jwtService.verify(token);
      (request as any).user = { id: payload.sub, role: payload.role };
      return true;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('令牌已过期');
      }
      throw new UnauthorizedException('无效的认证令牌');
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

```typescript
// common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // 没有角色要求，放行
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}
```

```typescript
// common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// 在控制器中使用
@Controller('admin/users')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  // 只有 admin 角色才能访问
}
```

**关键改进：**
- 守卫是声明式的，通过装饰器组合使用
- 角色检查通过元数据驱动，不需要工厂函数
- `AuthGuard` 自动注入 `JwtService`，测试时可以轻松 mock

### 示例三：错误处理中间件到异常过滤器

**迁移前：Express 全局错误处理**

```javascript
// middlewares/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err);

  // Mongoose 验证错误
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: '数据验证失败', errors: messages });
  }

  // Mongoose 重复键错误
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ message: `${field} 已存在` });
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: '无效的认证令牌' });
  }

  // 自定义业务错误
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // 未知错误
  res.status(500).json({ message: '服务器内部错误' });
}

module.exports = errorHandler;
```

**迁移后：NestJS 异常过滤器**

```typescript
// common/filters/global-exception.filter.ts
import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException,
  HttpStatus, Logger,
} from '@nestjs/common';
import { MongoError } from 'mongodb';
import { Response, Request } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let errors: string[] | undefined;

    // NestJS 内置的 HttpException（NotFoundException、BadRequestException 等）
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || exception.message;
    }
    // Mongoose/MongoDB 重复键错误
    else if (exception instanceof MongoError && (exception as any).code === 11000) {
      status = HttpStatus.CONFLICT;
      const field = Object.keys((exception as any).keyValue)[0];
      message = `${field} 已存在`;
    }
    // Mongoose 验证错误
    else if ((exception as any)?.name === 'ValidationError') {
      status = HttpStatus.BAD_REQUEST;
      message = '数据验证失败';
      errors = Object.values((exception as any).errors).map(
        (e: any) => e.message,
      );
    }

    this.logger.error(
      `${request.method} ${request.path} ${status}: ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json({
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  }
}
```

```typescript
// main.ts 中注册全局过滤器
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(3000);
}
bootstrap();
```

### 示例四：渐进式迁移策略

对于大型项目，可以利用 NestJS 兼容原生 Express 中间件的特性实现渐进迁移。

```typescript
// main.ts — NestJS 应用中挂载遗留 Express 路由
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from './app.module';
import legacyUserRoutes from './legacy/routes/users';
import legacyOrderRoutes from './legacy/routes/orders';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 挂载遗留 Express 路由（未迁移的模块）
  const legacyApp = express();
  legacyApp.use('/api/v1/users', legacyUserRoutes);
  legacyApp.use('/api/v1/orders', legacyOrderRoutes);

  // NestJS 处理已迁移的路由，遗留路由作为 fallback
  app.use(legacyApp);

  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(3000);
}
bootstrap();
```

**迁移计划示意：**

```
第一阶段（第 1-2 周）：搭建 NestJS 骨架
  ├── 创建 NestJS 项目
  ├── 配置数据库连接
  ├── 实现全局过滤器和守卫
  └── 挂载遗留 Express 路由（保持全部 API 可用）

第二阶段（第 3-4 周）：迁移核心模块
  ├── 用户模块 → NestJS Controller + Service
  ├── 认证模块 → NestJS Guard
  └── 移除对应的遗留 Express 路由

第三阶段（第 5-8 周）：逐步迁移剩余模块
  ├── 每周迁移 1-2 个模块
  ├── 每次迁移后运行 API 契约测试
  └── 最终移除所有遗留代码

第四阶段（第 9-10 周）：完善
  ├── 添加 Swagger 文档
  ├── 补充单元测试和集成测试
  └── 优化性能和监控
```

## 常见误区

### 误区一：迁移就是把 Express 语法换成 NestJS 装饰器

如果只是给路由加了 `@Get()`、`@Post()` 装饰器，但业务逻辑仍然写在控制器里，那只是换了一层皮。真正的迁移是**把业务逻辑从路由处理器中提取到服务层**，让控制器只做请求解析和响应返回。

### 误区二：必须一次性迁移所有路由

NestJS 本身构建在 Express 之上，可以直接挂载 Express 中间件和路由。利用这个特性，可以让已迁移的路由走 NestJS 管线，未迁移的路由继续走 Express，按模块逐步推进。

### 误区三：过度使用装饰器和高级特性

NestJS 提供了大量装饰器（自定义装饰器、参数装饰器、元数据反射等），但迁移初期不需要全部用上。先用最基本的 `@Controller`、`@Get`、`@Injectable`，等团队熟悉了再逐步引入守卫、拦截器、管道等高级特性。

### 误区四：忽略测试的价值

Express 项目难写测试是迁移的重要动因之一。迁移到 NestJS 后，应该在迁移每个模块时同步补充测试。NestJS 的 `Test.createTestingModule` 可以轻松创建隔离的测试环境，mock 任意依赖。如果迁移完还是不写测试，架构优势就浪费了一半。

### 误区五：DTO 可以省略

有人觉得 DTO（Data Transfer Object）是多余的样板代码。实际上 DTO 是 NestJS 架构的重要组成部分：它用装饰器声明输入数据的约束，由 `ValidationPipe` 自动执行校验，免去了手动写验证逻辑的负担。同时 DTO 还充当了接口文档的角色。

## 小结与练习

### 小结

本课围绕 Express 到 NestJS 的迁移，覆盖了五个核心方面：

1. **路由到控制器**：路由处理器拆分为 Controller（HTTP 层）+ Service（业务层），职责清晰
2. **中间件到守卫/拦截器**：Express 的线性中间件管线升级为 NestJS 的多层请求处理管线
3. **错误处理**：集中式错误中间件替换为类型化的异常过滤器
4. **依赖注入**：手动 require/ new 替换为构造函数注入，提升可测试性
5. **渐进迁移**：利用 NestJS 兼容 Express 的特性，按模块逐步迁移

### 练习

#### 练习一：服务层提取

将以下 Express 路由处理器重构为 NestJS 的 Controller + Service 结构：

```javascript
// Express: 订单查询路由
router.get('/orders', authMiddleware, async (req, res, next) => {
  try {
    const { status, startDate, endDate, page = 1, pageSize = 20 } = req.query;
    const filter = { userId: req.user.id };

    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(filter)
      .populate('items.product', 'name price')
      .skip((page - 1) * pageSize)
      .limit(Number(pageSize))
      .sort({ createdAt: -1 });

    const total = await Order.countDocuments(filter);

    res.json({ data: orders, pagination: { page: Number(page), pageSize: Number(pageSize), total } });
  } catch (error) {
    next(error);
  }
});
```

#### 练习二：单元测试编写

为上面迁移后的 `OrdersService` 编写单元测试，要求：
- mock `OrderModel`
- 测试正常查询、带筛选条件查询、分页参数处理
- 使用 NestJS 的 `Test.createTestingModule`

---

## 参考答案

### 练习一

**思路**：将查询参数解析提取为 DTO，将业务逻辑移入 Service，Controller 只做胶水工作。筛选条件构建逻辑是业务规则，应该在 Service 中。

**答案**：

```typescript
// orders/dto/list-orders.dto.ts
import { IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListOrdersDto {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number = 20;
}
```

```typescript
// orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { ListOrdersDto } from './dto/list-orders.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  async findByUser(userId: string, query: ListOrdersDto) {
    const { status, startDate, endDate, page = 1, pageSize = 20 } = query;

    const filter: Record<string, any> = { userId };

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .populate('items.product', 'name price')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .sort({ createdAt: -1 })
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return {
      data: orders,
      pagination: { page, pageSize, total },
    };
  }
}
```

```typescript
// orders/orders.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ListOrdersDto } from './dto/list-orders.dto';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: ListOrdersDto) {
    return this.ordersService.findByUser(req.user.id, query);
  }
}
```

**要点**：
- `filter` 构建逻辑在 Service 中，Controller 不需要知道数据库查询细节
- DTO 用装饰器声明验证规则，替代手动校验
- `@Req()` 只用于获取认证用户信息，业务参数全部通过 DTO

### 练习二

**思路**：用 `Test.createTestingModule` 创建测试模块，mock `getModelToken` 提供的 Model，验证 Service 的业务逻辑是否正确构建了查询条件和分页。

**答案**：

```typescript
// orders/orders.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';

describe('OrdersService', () => {
  let service: OrdersService;
  let mockOrderModel: any;

  beforeEach(async () => {
    // 创建 mock 的 OrderModel
    const mockExec = jest.fn().mockResolvedValue([]);
    const mockSort = jest.fn().mockReturnValue({ exec: mockExec });
    const mockLimit = jest.fn().mockReturnValue({ sort: mockSort });
    const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockPopulate = jest.fn().mockReturnValue({ skip: mockSkip });
    const mockFind = jest.fn().mockReturnValue({ populate: mockPopulate });
    const mockCountExec = jest.fn().mockResolvedValue(0);
    const mockCountDocuments = jest.fn().mockReturnValue({ exec: mockCountExec });

    mockOrderModel = {
      find: mockFind,
      countDocuments: mockCountDocuments,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('应使用默认分页参数查询订单', async () => {
    await service.findByUser('user-123', {});

    expect(mockOrderModel.find).toHaveBeenCalledWith({ userId: 'user-123' });
    expect(mockOrderModel.countDocuments).toHaveBeenCalledWith({ userId: 'user-123' });
  });

  it('应正确构建状态筛选条件', async () => {
    await service.findByUser('user-123', { status: 'shipped' });

    expect(mockOrderModel.find).toHaveBeenCalledWith({
      userId: 'user-123',
      status: 'shipped',
    });
  });

  it('应正确构建日期范围筛选条件', async () => {
    await service.findByUser('user-123', {
      startDate: '2025-01-01',
      endDate: '2025-06-30',
    });

    const calledFilter = mockOrderModel.find.mock.calls[0][0];
    expect(calledFilter.userId).toBe('user-123');
    expect(calledFilter.createdAt.$gte).toEqual(new Date('2025-01-01'));
    expect(calledFilter.createdAt.$lte).toEqual(new Date('2025-06-30'));
  });

  it('应正确传递分页参数', async () => {
    await service.findByUser('user-123', { page: 3, pageSize: 10 });

    const mockPopulate = mockOrderModel.find().populate;
    const mockSkip = mockPopulate().skip;
    expect(mockSkip).toHaveBeenCalledWith(20); // (3-1) * 10
    expect(mockSkip().limit).toHaveBeenCalledWith(10);
  });
});
```

**要点**：
- 通过链式 mock 模拟 Mongoose 的查询链
- 每个测试用例验证一个具体的业务规则
- `mockOrderModel` 完全替代了真实数据库，测试运行速度快
- 如果后续 Service 逻辑变化（比如加了缓存），只需修改 mock 对应的方法
