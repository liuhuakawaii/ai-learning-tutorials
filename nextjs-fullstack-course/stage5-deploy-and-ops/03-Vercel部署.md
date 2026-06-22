# 第三课：Vercel 部署

## 场景引入

你花了两周开发的 SaaS 产品终于要上线了。你租了一台云服务器，安装了 Node.js，配置了 Nginx 反向代理，申请了 SSL 证书，设置了 PM2 进程守护——光是部署环境就折腾了一整天。一周后你推送了一个 bugfix，又要手动 SSH 到服务器拉代码、重新构建、重启服务。某天凌晨服务器内存溢出，你的网站挂了 3 小时才被发现。如果有一个平台能让你 push 代码就自动部署、自带 HTTPS、自动扩缩容，这些痛苦都可以避免。

## 学习目标

完成本课学习后，你将能够：

1. 理解 Vercel 平台的特点
2. 配置项目以部署到 Vercel
3. 设置环境变量和域名
4. 理解部署流程和最佳实践

---

## 一、Vercel 是什么

### 1.1 平台特点

```
Vercel 是 Next.js 的官方部署平台：

✅ 零配置部署
  → 推送代码自动部署
  → 预览部署（PR 自动生成链接）

✅ 全球 CDN
  → 静态资源全球加速
  → 边缘函数支持

✅ 自动 HTTPS
  → 免费 SSL 证书
  → 自动续期

✅ 与 Git 集成
  → GitHub/GitLab/Bitbucket
  → 自动部署
```

### 1.2 生活类比

```
传统部署 = 自己租房子
  → 找房源（选服务器）
  → 签合同（买服务器）
  → 装修（配置环境）
  → 搬家具（部署代码）
  → 自己维护（水电维修）

Vercel = 住精装公寓
  → 直接拎包入住
  → 物业负责维护
  → 按使用量付费
  → 随时可以搬走
```

---

## 二、部署准备

### 2.1 项目配置

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "postinstall": "prisma generate"
  }
}
```

### 2.2 next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 如果使用外部图片
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.example.com',
      },
    ],
  },
}

module.exports = nextConfig
```

### 2.3 环境变量检查

```tsx
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string(),
  SESSION_SECRET: z.string().min(32),
  NEXT_PUBLIC_URL: z.string().url(),
})

export const env = envSchema.parse(process.env)
```

---

## 三、部署步骤

### 3.1 方式一：Git 集成（推荐）

```
1. 将代码推送到 GitHub
2. 登录 Vercel（vercel.com）
3. 点击 "New Project"
4. 选择你的仓库
5. 配置项目设置
6. 点击 "Deploy"
```

### 3.2 方式二：CLI 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 部署到生产环境
vercel --prod
```

---

## 四、环境变量配置

### 4.1 在 Vercel Dashboard 中配置

```
1. 进入项目设置
2. 点击 "Environment Variables"
3. 添加变量：
   - DATABASE_URL
   - SESSION_SECRET
   - NEXT_PUBLIC_URL
4. 选择环境（Production/Preview/Development）
```

### 4.2 通过 CLI 配置

```bash
# 添加环境变量
vercel env add DATABASE_URL

# 查看环境变量
vercel env ls

# 拉取环境变量到本地
vercel env pull .env.local
```

---

## 五、数据库配置

### 5.1 使用 Vercel Postgres

```bash
# 在 Vercel Dashboard 中：
# 1. 进入 Storage 标签
# 2. 创建 Postgres 数据库
# 3. 环境变量会自动添加
```

### 5.2 使用外部数据库

```
推荐的 PostgreSQL 服务：
  → Supabase（免费套餐）
  → Neon（免费套餐）
  → Railway
  → PlanetScale（MySQL）
```

### 5.3 迁移配置

```json
// package.json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build",
    "postinstall": "prisma generate"
  }
}
```

---

## 六、域名配置

### 6.1 添加自定义域名

```
1. 进入项目设置
2. 点击 "Domains"
3. 输入你的域名
4. 配置 DNS：
   - CNAME 记录指向 cname.vercel-dns.com
   - 或 A 记录指向 76.76.21.21
```

### 6.2 HTTPS 自动配置

```
Vercel 自动：
  → 申请 SSL 证书
  → 配置 HTTPS
  → 自动续期
```

---

## 七、预览部署

### 7.1 PR 预览

```
每次创建 Pull Request：
  → Vercel 自动创建预览部署
  → 生成唯一的预览 URL
  → 可以在合并前测试
```

### 7.2 预览环境变量

```
Preview 环境变量：
  → 可以使用不同的数据库
  → 避免影响生产数据
```

---

## 八、性能优化

### 8.1 边缘函数

```tsx
// app/api/hello/route.ts
export const runtime = 'edge'

export async function GET() {
  return new Response('Hello from Edge!')
}
```

### 8.2 ISR 支持

```tsx
// Vercel 支持 ISR
export const revalidate = 60

export default async function Page() {
  const data = await fetchData()
  return <div>{data}</div>
}
```

---

## 九、监控和日志

### 9.1 Vercel Analytics

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### 9.2 查看日志

```
Vercel Dashboard → Project → Logs
  → Function Logs
  → Edge Logs
  → Build Logs
```

---

## 十、动手练习

### 练习 1：部署到 Vercel

1. 将项目推送到 GitHub
2. 在 Vercel 创建项目
3. 配置环境变量
4. 部署并访问

### 练习 2：配置数据库

1. 创建 Vercel Postgres 或外部数据库
2. 运行迁移
3. 添加种子数据

### 练习 3：配置域名

1. 添加自定义域名
2. 配置 DNS
3. 验证 HTTPS

---

## 十一、常见误区

1. **忽略 Prisma 的 `postinstall` 脚本**：Vercel 部署时默认运行 `npm install`，但 Prisma Client 需要在安装后生成。如果 `package.json` 中没有 `"postinstall": "prisma generate"`，部署会报错。

2. **环境变量只配了 Production 环境**：Vercel 有 Production、Preview、Development 三个环境。Preview 部署（PR 自动生成）如果缺少环境变量，会静默失败或使用错误的配置。

3. **把所有东西都塞进 Server Component**：虽然 Server Component 减少了客户端 JS，但需要交互的组件（如表单、弹窗）仍然需要 `'use client'`。过度追求 Server Component 会导致交互功能缺失。

4. **忽略 Vercel 的函数超时限制**：Vercel 的 Serverless Function 在 Hobby 计划下有 10 秒超时限制。长时间运行的任务（如数据导出、批量处理）应该改用 Background Functions 或外部队列。

---

## 十二、工程建议

1. **构建命令中集成数据库迁移**：`"build": "prisma generate && prisma migrate deploy && next build"` 确保每次部署都自动执行迁移。

2. **使用 Vercel 的 Preview 部署做 Code Review**：每个 PR 自动生成预览链接，审查者可以直接在预览环境测试功能，而不是只看代码。

3. **为 Vercel 配置 `vercel.json` 做精细控制**：可以配置重定向、自定义 headers、函数区域、Cron Jobs 等，避免在代码中硬编码平台相关的配置。

4. **使用 Vercel Analytics 监控真实用户性能**：Vercel 内置的 Web Vitals 监控可以收集真实用户的 LCP、INP、CLS 数据，比 Lighthouse 的实验室数据更有参考价值。

---

## 十三、小结

```
本课核心要点：

1. Vercel 是 Next.js 的最佳部署平台
2. Git 集成实现自动部署
3. 环境变量在 Dashboard 中配置
4. 数据库迁移在构建时运行
5. 预览部署方便测试
```

下一课我们将学习 Docker 部署。
