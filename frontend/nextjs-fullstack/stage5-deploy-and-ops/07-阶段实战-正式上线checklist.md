# 阶段实战：正式上线 Checklist

## 项目目标

把 SaaS 项目从"能跑"变成"能上线"。这节课不是写新功能，而是做上线前的全面检查。

## 上线 Checklist

### 一、环境配置

- [ ] 生产环境变量已配置（Vercel/Docker）
- [ ] 数据库连接字符串正确
- [ ] 密钥已轮换（不是开发环境的密钥）
- [ ] `NEXT_PUBLIC_` 变量已设置
- [ ] CORS 配置正确

### 二、数据库

- [ ] 迁移已在生产数据库执行
- [ ] 种子数据已导入（如需要）
- [ ] 数据库备份策略已配置
- [ ] 连接池大小合理

```bash
# 执行迁移
npx prisma migrate deploy

# 导入种子数据
npx prisma db seed
```

### 三、构建和部署

```bash
# 本地验证构建
npm run build
npm run start

# Vercel 部署
vercel --prod

# Docker 部署
docker build -t myapp .
docker run -p 3000:3000 myapp
```

### 四、性能

- [ ] Lighthouse 分数 > 90
- [ ] 首屏图片用 `priority` 加载
- [ ] 字体已自托管
- [ ] 第三方脚本用 `lazyOnload`
- [ ] Bundle 大小合理（< 200KB gzip）

### 五、安全

- [ ] HTTPS 已启用
- [ ] CSRF 防护已配置
- [ ] XSS 防护（无 `dangerouslySetInnerHTML` 或已消毒）
- [ ] 权限检查覆盖所有写操作
- [ ] 输入验证覆盖所有表单
- [ ] 敏感 API 有速率限制

### 六、监控

- [ ] 错误监控（Sentry）已配置
- [ ] 性能监控已配置
- [ ] 日志收集已配置
- [ ] 告警规则已设置

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'
Sentry.init({ dsn: process.env.SENTRY_DSN })
```

### 七、域名和 SSL

- [ ] 域名已配置
- [ ] SSL 证书已安装
- [ ] 重定向配置（www → 非 www）
- [ ] CDN 已配置

### 八、备份和回滚

- [ ] 数据库自动备份已配置
- [ ] 部署回滚方案已测试
- [ ] 关键数据有导出功能

## Vercel 部署流程

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署到预览环境
vercel

# 4. 部署到生产环境
vercel --prod
```

## Docker 部署流程

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t myapp .
docker run -p 3000:3000 --env-file .env.production myapp
```

## 灰度发布

```typescript
// middleware.ts
import { NextResponse } from 'next/server'

export function middleware(request) {
  const cookie = request.cookies.get('canary')
  if (cookie?.value === 'true') {
    // 路由到新版本
    return NextResponse.rewrite(new URL('/canary' + request.nextUrl.pathname, request.url))
  }
}
```

## 练习

### 练习一：本地构建验证

在本地运行 `npm run build`，修复所有构建警告和错误。

### 练习二：Docker 部署

编写 Dockerfile 和 docker-compose.yml，在本地用 Docker 运行项目。

### 练习三：监控配置

配置 Sentry 错误监控，测试错误是否正确上报。

---

## 参考答案

### 练习一

```bash
npm run build
# 常见问题：
# 1. TypeScript 错误 → 修复类型
# 2. 未使用的导入 → 删除
# 3. 动态导入缺少 ssr: false → 添加
```

### 练习二

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env.production
    depends_on: [db]
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

### 练习三

```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
# 测试：在页面中 throw new Error('test')
# 检查 Sentry Dashboard 是否收到错误
```
