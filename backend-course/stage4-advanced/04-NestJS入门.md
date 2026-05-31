# 第四阶段 · 第4课：NestJS 入门

## 学习目标

完成本课学习后，你将能够：

1. 理解 NestJS 的设计哲学和核心架构
2. 掌握 Module、Controller、Service、Provider 等核心概念
3. 理解依赖注入（DI）的原理和好处
4. 使用 NestJS 重写博客 API 的核心模块
5. 掌握 Pipes、Guards、Interceptors 等高级特性

---

## 一、什么是 NestJS？

### 1.1 一句话定义

**NestJS** 是一个用于构建高效、可靠和可扩展的服务端应用程序的 **Node.js 框架**，使用 **TypeScript** 原生支持，深受 **Angular** 启发。

### 1.2 为什么学 NestJS？

```
Express 的问题：                    NestJS 的解决方案：

❌ 没有统一的项目结构               ✅ 模块化架构（Module）
❌ 业务逻辑和路由混在一起           ✅ Controller + Service 分离
❌ 依赖管理靠手动 import            ✅ 依赖注入（DI）自动管理
❌ 中间件缺乏类型安全               ✅ 装饰器 + TypeScript 原生
❌ 没有内置验证、认证方案           ✅ Guards、Pipes、Interceptors
❌ 大型项目难以维护                 ✅ 企业级架构规范

一句话总结：
Express 是"自由"，给你一块空地自己盖房子
NestJS 是"规范"，给你一套建筑图纸和施工标准
```

### 1.3 NestJS vs Express

```
NestJS 不是 Express 的替代品，而是增强！

┌──────────────────────────────────────────────┐
│                 NestJS 架构                   │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │            装饰器层                       │ │
│  │  @Controller  @Service  @Module         │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │         核心层（DI、生命周期）             │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │         HTTP 层（Express / Fastify）     │ │  ← 可以选 Express 或 Fastify
│  └─────────────────────────────────────────┘ │
│                                              │
└──────────────────────────────────────────────┘

NestJS 底层默认使用 Express，你可以用所有 Express 的中间件
```

---

## 二、核心概念

### 2.1 概念总览

```
NestJS 核心概念关系图：

┌─────────────────────────────────────────────────────┐
│                    Application                       │
│                                                     │
│  ┌───────────────┐  ┌───────────────┐               │
│  │  AppModule     │  │  其他 Module   │               │
│  │  (根模块)      │  │               │               │
│  │               │  │               │               │
│  │ ┌───────────┐ │  │ ┌───────────┐ │               │
│  │ │Controller │ │  │ │Controller │ │  处理请求      │
│  │ └─────┬─────┘ │  │ └─────┬─────┘ │               │
│  │       │       │  │       │       │               │
│  │ ┌─────▼─────┐ │  │ ┌─────▼─────┐ │               │
│  │ │ Service   │ │  │ │ Service   │ │  业务逻辑      │
│  │ └───────────┘ │  │ └───────────┘ │               │
│  │               │  │               │               │
│  │ ┌───────────┐ │  │ ┌───────────┐ │               │
│  │ │ Provider  │ │  │ │ Provider  │ │  可注入的依赖  │
│  │ └───────────┘ │  │ └───────────┘ │               │
│  └───────────────┘  └───────────────┘               │
│                                                     │
│  装饰器（Decorator）：给类/方法/参数添加元数据          │
│  依赖注入（DI）：自动创建和注入依赖对象                │
└─────────────────────────────────────────────────────┘
```

### 2.2 Module（模块）

**Module** 是 NestJS 组织代码的基本单位，就像一个"功能包"。

```
类比：公司的部门

┌─────────────────────────────────────────┐
│              公司 (Application)           │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ 用户部门  │  │ 文章部门  │  │ 认证部门││
│  │ UserModule│  │PostModule│  │AuthMod ││
│  │          │  │          │  │        ││
│  │·用户Controller│·文章Controller│·登录Controller││
│  │·用户Service│  │·文章Service│  │·认证Service││
│  └──────────┘  └──────────┘  └────────┘│
│                                         │
│  每个部门有自己的人员（Controller）        │
│  和业务逻辑（Service），互不干扰          │
└─────────────────────────────────────────┘
```

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [],                          // 导入其他模块
  controllers: [UsersController],       // 注册控制器
  providers: [UsersService],            // 注册服务（Provider）
  exports: [UsersService],              // 导出给其他模块使用
})
export class UsersModule {}
```

### 2.3 Controller（控制器）

**Controller** 负责处理 HTTP 请求，定义路由和响应。

```
Controller 的职责：

  HTTP 请求                  Controller                    响应
  ┌─────────┐              ┌──────────────┐              ┌─────────┐
  │ GET     │─────────────►│ findAll()    │─────────────►│ [文章]   │
  │ /posts  │              │              │              └─────────┘
  └─────────┘              │ GET /posts   │
                           │ → findAll()  │              ┌─────────┐
  ┌─────────┐              │              │─────────────►│ 文章详情  │
  │ GET     │─────────────►│ findOne(id)  │              └─────────┘
  │ /posts/1│              │              │
  └─────────┘              └──────┬───────┘
                                  │
                                  │ 调用 Service 处理业务逻辑
                                  ▼
                           ┌──────────────┐
                           │ PostsService  │
                           │              │
                           │ 查数据库、    │
                           │ 处理业务逻辑  │
                           └──────────────┘

Controller 不应该包含业务逻辑，只负责：
1. 接收请求参数
2. 调用 Service
3. 返回响应
```

```typescript
// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')  // 路由前缀：/users
export class UsersController {
  // 构造函数注入 UsersService（依赖注入！）
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users
   * 获取用户列表
   */
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  /**
   * GET /users/:id
   * 获取单个用户
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  /**
   * POST /users
   * 创建用户
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)  // 返回 201
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  /**
   * PUT /users/:id
   * 更新用户
   */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * DELETE /users/:id
   * 删除用户
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)  // 返回 204
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

### 2.4 Service（服务）

**Service** 负责业务逻辑，是应用的核心。

```typescript
// src/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()  // 标记为可注入的 Provider
export class UsersService {
  // 通过构造函数注入 PrismaService
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取用户列表
   */
  async findAll(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取单个用户
   */
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: {
          select: { posts: true, comments: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`用户 ID ${id} 不存在`);
    }

    return user;
  }

  /**
   * 创建用户
   */
  async create(dto: CreateUserDto) {
    // 检查邮箱是否已存在
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('该邮箱已注册');
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * 更新用户
   */
  async update(id: number, dto: UpdateUserDto) {
    // 先检查用户是否存在
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        avatar: dto.avatar,
        bio: dto.bio,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * 删除用户
   */
  async remove(id: number) {
    await this.findOne(id); // 确保存在
    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * 根据邮箱查找用户（认证用）
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}
```

---

## 三、依赖注入（DI）

### 3.1 什么是依赖注入？

```
没有依赖注入（手动管理依赖）：

class UsersController {
  private usersService: UsersService;
  
  constructor() {
    // 自己创建依赖（耦合！）
    const prisma = new PrismaService();
    this.usersService = new UsersService(prisma);
  }
}

问题：
1. UsersController 直接依赖 UsersService 的构造函数
2. 如果 UsersService 的依赖变了，所有用到它的地方都要改
3. 难以测试（无法替换为 mock）


有依赖注入（框架自动管理）：

class UsersController {
  // 只需声明需要什么，NestJS 自动创建并注入
  constructor(private readonly usersService: UsersService) {}
}

NestJS 在背后做的事：
1. 创建 PrismaService 实例
2. 创建 UsersService 实例（把 PrismaService 传给它）
3. 创建 UsersController 实例（把 UsersService 传给它）
```

### 3.2 生活类比：外卖 vs 自己做饭

```
自己做饭（没有 DI）：
┌─────────────────────────────────────────┐
│  你想吃番茄炒蛋：                         │
│                                         │
│  1. 去超市买番茄、鸡蛋、油、盐             │  ← 自己找所有依赖
│  2. 回家洗菜、切菜                        │  ← 自己初始化
│  3. 开火、炒菜                            │  ← 自己组装
│  4. 盛盘、上桌                            │
│                                         │
│  累！而且每次想吃都要重复这些步骤          │
└─────────────────────────────────────────┘

点外卖（有 DI）：
┌─────────────────────────────────────────┐
│  你想吃番茄炒蛋：                         │
│                                         │
│  1. 打开 APP，点"番茄炒蛋"               │  ← 声明依赖
│  2. 等外卖送到                           │  ← 框架处理一切
│                                         │
│  你只需要声明"我要什么"，                  │
│  不需要关心"怎么做"和"食材从哪来"          │
└─────────────────────────────────────────┘
```

### 3.3 DI 实现原理

```typescript
// NestJS 内部的 DI 容器工作原理（简化版）

// 1. 元数据存储（由装饰器生成）
const providers = new Map<string, any>();

// 2. 当使用 @Injectable() 装饰器时
// TypeScript 的 reflect-metadata 会记录类的依赖信息
// UsersService 的元数据：dependencies = [PrismaService]
// UsersController 的元数据：dependencies = [UsersService]

// 3. NestJS 启动时的解析过程
function resolveDependencies() {
  // 创建 PrismaService（没有依赖，直接创建）
  const prisma = new PrismaService();
  providers.set('PrismaService', prisma);

  // 创建 UsersService（依赖 PrismaService，自动注入）
  const usersService = new UsersService(prisma);
  providers.set('UsersService', usersService);

  // 创建 UsersController（依赖 UsersService，自动注入）
  const usersController = new UsersController(usersService);
  providers.set('UsersController', usersController);
}
```

---

## 四、创建 NestJS 项目

### 4.1 安装 CLI

```bash
# 安装 NestJS CLI
npm install -g @nestjs/cli

# 创建新项目
nest new blog-api --package-manager npm

# 进入项目
cd blog-api

# 启动开发服务器
npm run start:dev
```

### 4.2 项目结构

```
blog-api/
├── src/
│   ├── app.module.ts          # 根模块
│   ├── app.controller.ts      # 根控制器
│   ├── app.service.ts         # 根服务
│   ├── main.ts                # 入口文件
│   │
│   ├── users/                 # 用户模块
│   │   ├── dto/               # 数据传输对象（验证用）
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   └── users.service.ts
│   │
│   ├── posts/                 # 文章模块
│   │   ├── dto/
│   │   ├── posts.module.ts
│   │   ├── posts.controller.ts
│   │   └── posts.service.ts
│   │
│   ├── auth/                  # 认证模块
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   └── strategies/
│   │       └── jwt.strategy.ts
│   │
│   ├── prisma/                # Prisma 模块
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   │
│   └── common/                # 公共模块
│       ├── decorators/
│       ├── filters/
│       ├── guards/
│       └── interceptors/
│
├── prisma/                    # Prisma 配置
│   ├── schema.prisma
│   └── migrations/
│
├── package.json
├── tsconfig.json
└── nest-cli.json
```

### 4.3 入口文件

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局前缀
  app.setGlobalPrefix('api');

  // 全局验证管道（自动验证 DTO）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // 自动去除未定义的属性
      forbidNonWhitelisted: true, // 有未定义属性时报错
      transform: true,          // 自动转换类型
      transformOptions: {
        enableImplicitConversion: true, // 隐式类型转换
      },
    })
  );

  // CORS
  app.enableCors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 博客 API 已启动: http://localhost:${port}`);
}

bootstrap();
```

---

## 五、用 NestJS 重写博客 API

### 5.1 Prisma 模块

```typescript
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()  // 全局模块，所有模块都可以注入 PrismaService
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * 模块初始化时连接数据库
   */
  async onModuleInit() {
    await this.$connect();
    console.log('✅ 数据库已连接');
  }

  /**
   * 模块销毁时断开连接
   */
  async onModuleDestroy() {
    await this.$disconnect();
    console.log('❌ 数据库已断开');
  }
}
```

### 5.2 UsersModule（完整）

```typescript
// src/users/dto/create-user.dto.ts
import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;
}
```

```typescript
// src/users/dto/update-user.dto.ts
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
```

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // 导出给 AuthModule 使用
})
export class UsersModule {}
```

```typescript
// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.usersService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)  // 需要登录
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

```typescript
// src/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return { users, total, page, limit };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        createdAt: true,
        _count: { select: { posts: true, comments: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`用户 ID ${id} 不存在`);
    }

    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('该邮箱已注册');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id); // 确保存在

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
```

### 5.3 PostsModule（完整）

```typescript
// src/posts/dto/create-post.dto.ts
import { IsString, IsOptional, MinLength, MaxLength, IsArray } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

```typescript
// src/posts/dto/update-post.dto.ts
import { IsString, IsOptional, MaxLength, IsArray } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

```typescript
// src/posts/posts.module.ts
import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
```

```typescript
// src/posts/posts.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * GET /posts
   * 获取文章列表
   */
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tag') tag?: string,
  ) {
    return this.postsService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      tag,
    });
  }

  /**
   * GET /posts/:id
   * 获取文章详情
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  /**
   * POST /posts
   * 创建文章（需要登录）
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createPostDto: CreatePostDto, @Request() req: any) {
    return this.postsService.create(createPostDto, req.user.userId);
  }

  /**
   * PUT /posts/:id
   * 更新文章（需要登录 + 是作者本人）
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req: any,
  ) {
    return this.postsService.update(id, updatePostDto, req.user.userId);
  }

  /**
   * DELETE /posts/:id
   * 删除文章
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.postsService.remove(id, req.user.userId);
  }
}
```

```typescript
// src/posts/posts.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: { page: number; limit: number; tag?: string }) {
    const { page, limit, tag } = params;
    const skip = (page - 1) * limit;

    const where = tag
      ? { tags: { some: { name: tag } } }
      : {};

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          tags: true,
          _count: { select: { comments: true, likes: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return { posts, total, page, limit };
  }

  async findOne(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        tags: true,
        comments: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        _count: { select: { comments: true, likes: true } },
      },
    });

    if (!post) {
      throw new NotFoundException(`文章 ID ${id} 不存在`);
    }

    return post;
  }

  async create(dto: CreatePostDto, authorId: number) {
    return this.prisma.post.create({
      data: {
        title: dto.title,
        content: dto.content,
        summary: dto.summary,
        author: { connect: { id: authorId } },
        tags: dto.tags
          ? {
              connectOrCreate: dto.tags.map((name) => ({
                where: { name },
                create: { name },
              })),
            }
          : undefined,
      },
      include: {
        author: { select: { id: true, name: true } },
        tags: true,
      },
    });
  }

  async update(id: number, dto: UpdatePostDto, userId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      throw new NotFoundException(`文章 ID ${id} 不存在`);
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('只能编辑自己的文章');
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        summary: dto.summary,
        tags: dto.tags
          ? {
              set: [], // 先清空
              connectOrCreate: dto.tags.map((name) => ({
                where: { name },
                create: { name },
              })),
            }
          : undefined,
      },
      include: { author: { select: { id: true, name: true } }, tags: true },
    });
  }

  async remove(id: number, userId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      throw new NotFoundException(`文章 ID ${id} 不存在`);
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('只能删除自己的文章');
    }

    await this.prisma.post.delete({ where: { id } });
  }
}
```

### 5.4 AuthModule（Guard 认证守卫）

```typescript
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

```typescript
// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 验证用户（登录时调用）
   */
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    return user;
  }

  /**
   * 登录（返回 JWT Token）
   */
  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    };
  }

  /**
   * 注册
   */
  async register(data: { name: string; email: string; password: string }) {
    const user = await this.usersService.create(data);

    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }
}
```

```typescript
// src/auth/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
```

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  /**
   * 验证 Token 后调用，返回值会挂到 request.user 上
   */
  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  }
}
```

```typescript
// src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('请先登录');
    }
    return user;
  }
}
```

### 5.5 根模块

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,    // 数据库
    UsersModule,     // 用户模块
    PostsModule,      // 文章模块
    AuthModule,       // 认证模块
  ],
})
export class AppModule {}
```

---

## 六、Pipes、Guards、Interceptors

### 6.1 执行顺序

```
请求处理流程：

HTTP Request
    │
    ▼
┌──────────────────┐
│   Interceptor    │  ← 1. 前置逻辑（日志、计时）
│   (before)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│     Guard        │  ← 2. 权限检查（认证、角色）
│                  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│     Pipe         │  ← 3. 参数验证和转换
│                  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Controller     │  ← 4. 处理请求
│   → Service      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Interceptor    │  ← 5. 后置逻辑（响应转换）
│   (after)        │
└────────┬─────────┘
         │
         ▼
HTTP Response
```

### 6.2 Pipes（管道）—— 验证与转换

```typescript
// src/common/pipes/parse-post-id.pipe.ts
import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 自定义 Pipe：验证文章 ID 是否存在
 *
 * 使用方式：@Param('id', ParsePostIdPipe) id: number
 */
@Injectable()
export class ParsePostIdPipe implements PipeTransform<string, Promise<number>> {
  constructor(private readonly prisma: PrismaService) {}

  async transform(value: string): Promise<number> {
    const id = parseInt(value, 10);

    if (isNaN(id) || id <= 0) {
      throw new BadRequestException('文章 ID 必须是正整数');
    }

    // 检查文章是否存在
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!post) {
      throw new BadRequestException(`文章 ID ${id} 不存在`);
    }

    return id;
  }
}
```

### 6.3 Guards（守卫）—— 权限控制

```typescript
// src/auth/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// 角色枚举
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
}

// 自定义装饰器：设置所需角色
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 获取路由所需的角色
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(), // 方法级别
      context.getClass(),   // 类级别
    ]);

    // 如果没有设置角色要求，允许访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 获取当前用户
    const { user } = context.switchToHttp().getRequest();

    // 检查用户是否有所需角色
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}

// 使用示例：
// @Roles(Role.ADMIN)
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Get('admin/users')
// getAllUsers() { ... }
```

### 6.4 Interceptors（拦截器）—— 日志与响应转换

```typescript
// src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * 日志拦截器
 * 记录每个请求的处理时间和状态
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();
          this.logger.log(
            `${method} ${url} ${response.statusCode} - ${duration}ms`
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} ${error.status || 500} - ${duration}ms - ${error.message}`
          );
        },
      }),
    );
  }
}
```

```typescript
// src/common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 响应转换拦截器
 * 统一响应格式
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'success',
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

// 使用：在 main.ts 中全局注册
// app.useGlobalInterceptors(new TransformInterceptor());
```

---

## 七、动手练习

### 练习 1：CommentsModule

```typescript
// TODO: 创建评论模块
// 1. CommentsModule（Module + Controller + Service）
// 2. CRUD 操作：创建、获取、删除评论
// 3. 支持嵌套评论（parentId）
// 4. 只有评论作者才能删除自己的评论
// 5. 使用 DTO 验证输入

// 文件结构：
// src/comments/
// ├── dto/
// │   ├── create-comment.dto.ts
// │   └── query-comment.dto.ts
// ├── comments.module.ts
// ├── comments.controller.ts
// └── comments.service.ts
```

### 练习 2：自定义装饰器

```typescript
// TODO: 创建以下自定义装饰器
// 1. @CurrentUser() - 获取当前登录用户
// 2. @Pagination() - 解析分页参数
// 3. @ApiDoc() - 添加 Swagger 文档注解

// 示例：@CurrentUser() 的实现
// import { createParamDecorator, ExecutionContext } from '@nestjs/common';
//
// export const CurrentUser = createParamDecorator(
//   (data: string, ctx: ExecutionContext) => {
//     const request = ctx.switchToHttp().getRequest();
//     const user = request.user;
//     return data ? user?.[data] : user;
//   },
// );

// 使用：
// @Get('profile')
// @UseGuards(JwtAuthGuard)
// getProfile(@CurrentUser() user: any) { return user; }
//
// @Get('profile/email')
// @UseGuards(JwtAuthGuard)
// getEmail(@CurrentUser('email') email: string) { return email; }
```

### 练习 3：全局异常过滤器

```typescript
// TODO: 创建全局异常过滤器
// 1. 捕获所有未处理的异常
// 2. 统一错误响应格式
// 3. 区分已知错误（HttpException）和未知错误
// 4. 未知错误记录详细日志（但不暴露给客户端）
// 5. Prisma 错误特殊处理（如唯一约束冲突）

// 提示：
// import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
//
// @Catch()
// export class AllExceptionsFilter implements ExceptionFilter {
//   catch(exception: unknown, host: ArgumentsHost) {
//     // ...
//   }
// }
```

---

## 小结

本课我们学习了：

1. **NestJS 是什么**：企业级 Node.js 框架，TypeScript 原生，模块化架构
2. **Module（模块）**：组织代码的基本单位，每个功能一个模块
3. **Controller（控制器）**：处理 HTTP 请求，定义路由，调用 Service
4. **Service（服务）**：业务逻辑所在，通过依赖注入获取其他服务
5. **依赖注入（DI）**：框架自动创建和管理依赖，解耦代码
6. **DTO**：数据传输对象，配合 class-validator 做输入验证
7. **Guard（守卫）**：权限控制，如 JWT 认证、角色检查
8. **Pipe（管道）**：参数验证和转换
9. **Interceptor（拦截器）**：前置/后置逻辑，如日志、响应格式化

**核心架构图：**

```
NestJS 请求处理完整流程：

HTTP Request
    │
    ▼
┌──────────────────────┐
│   Interceptor (日志)  │  记录请求开始时间
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Guard (认证)        │  验证 JWT Token
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Pipe (验证)         │  验证 DTO、转换参数
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Controller          │  接收请求，调用 Service
│       │               │
│       ▼               │
│   Service             │  业务逻辑，操作数据库
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Interceptor (转换)  │  统一响应格式
└──────────┬───────────┘
           │
           ▼
HTTP Response
```

**最佳实践：**
- Controller 只做路由分发，业务逻辑放 Service
- 使用 DTO 验证所有输入，不要信任客户端数据
- 敏感操作用 Guard 保护，不要在每个方法里手动检查
- 利用 DI 解耦模块，方便测试和维护
- 遵循 NestJS 的模块化规范，一个功能一个模块

下一课我们将学习 **性能优化与安全加固**，让你的博客 API 达到生产级别。
