# 第七课：阶段实战 — 正式上线 Checklist

## 学习目标

综合运用第五阶段所学知识，准备一份完整的上线清单：

1. 环境配置检查
2. 数据库准备
3. 部署流程
4. 监控和告警
5. 应急预案

---

## 一、上线前检查清单

### 1.1 代码检查

```
代码质量：
  □ 所有测试通过
  □ 代码审查完成
  □ 无 console.log 调试代码
  □ 无 TODO/HACK 注释
  □ ESLint 无错误

安全检查：
  □ 依赖无已知漏洞（npm audit）
  □ 无硬编码的密钥
  □ 输入验证完整
  □ 权限检查完整
```

### 1.2 环境配置

```
环境变量：
  □ DATABASE_URL 正确
  □ SESSION_SECRET 已设置（32+ 字符）
  □ NEXT_PUBLIC_URL 正确
  □ SMTP 配置正确
  □ S3/存储配置正确

功能开关：
  □ 生产环境功能开关已配置
  □ 调试功能已关闭
```

### 1.3 数据库

```
迁移：
  □ 所有迁移已创建
  □ 迁移在测试环境验证
  □ 迁移脚本向后兼容

数据：
  □ 种子数据已准备
  □ 管理员账号已创建
  □ 套餐数据已创建

备份：
  □ 数据库备份脚本已配置
  □ 备份已测试恢复
```

---

## 二、部署流程

### 2.1 部署步骤

```bash
# 1. 代码准备
git checkout main
git pull origin main

# 2. 运行测试
npm test
npm run lint

# 3. 构建检查
npm run build

# 4. 部署数据库迁移
npx prisma migrate deploy

# 5. 部署应用
vercel --prod
# 或
docker-compose -f docker-compose.prod.yml up -d

# 6. 健康检查
curl https://yourapp.com/api/health

# 7. 运行种子数据（首次部署）
npx prisma db seed
```

### 2.2 自动化部署

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Health Check
        run: |
          sleep 30
          curl -f https://yourapp.com/api/health
```

---

## 三、监控配置

### 3.1 健康检查端点

```tsx
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
```

### 3.2 错误监控

```tsx
// lib/monitoring.ts
import * as Sentry from '@sentry/nextjs'

export function initMonitoring() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    })
  }
}

export function captureError(error: Error, context?: Record<string, any>) {
  console.error(error)

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context })
  }
}
```

### 3.3 性能监控

```tsx
// app/web-vitals.tsx
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    // 发送到分析服务
    if (process.env.ANALYTICS_URL) {
      fetch(process.env.ANALYTICS_URL, {
        method: 'POST',
        body: JSON.stringify(metric),
      })
    }
  })

  return null
}
```

---

## 四、告警配置

### 4.1 告警规则

```
错误率告警：
  条件：5 分钟内错误率 > 5%
  通知：邮件 + Slack

响应时间告警：
  条件：P95 响应时间 > 3 秒
  通知：邮件

可用性告警：
  条件：健康检查失败 3 次
  通知：电话 + 短信

数据库告警：
  条件：连接池使用率 > 80%
  通知：邮件

磁盘空间告警：
  条件：磁盘使用率 > 90%
  通知：邮件
```

### 4.2 Uptime 监控

```
推荐服务：
  → UptimeRobot（免费）
  → Pingdom
  → StatusCake

配置：
  → 每 5 分钟检查一次
  → 检查 /api/health 端点
  → 失败时发送告警
```

---

## 五、应急预案

### 5.1 常见问题处理

```
问题：数据库连接失败
  1. 检查数据库服务状态
  2. 检查连接字符串
  3. 检查防火墙规则
  4. 重启应用

问题：内存溢出
  1. 检查内存使用情况
  2. 查找内存泄漏
  3. 重启应用
  4. 增加内存限制

问题：高 CPU 使用
  1. 检查进程列表
  2. 查找死循环
  3. 检查是否有爬虫
  4. 启用限流
```

### 5.2 回滚流程

```bash
# 1. 发现问题
# 2. 决定回滚

# 3. 代码回滚
git revert HEAD
git push

# 4. 数据库回滚（如果需要）
npx prisma migrate resolve --rolled-back "migration_name"

# 5. 重新部署
vercel rollback

# 6. 验证恢复
curl https://yourapp.com/api/health

# 7. 通知相关人员
```

---

## 六、上线后检查

### 6.1 功能验证

```
核心功能：
  □ 用户注册/登录正常
  □ 主要功能可用
  □ 表单提交正常
  □ 文件上传正常

支付功能（如果有）：
  □ 支付流程正常
  □ 退款流程正常
  □ 发票生成正常

邮件功能：
  □ 注册邮件发送正常
  □ 通知邮件发送正常
  □ 邮件链接可访问
```

### 6.2 性能验证

```
加载速度：
  □ 首页加载 < 3 秒
  □ API 响应 < 1 秒
  □ 图片加载正常

并发能力：
  □ 支持预期并发用户
  □ 无明显性能下降
```

### 6.3 监控验证

```
监控系统：
  □ 错误监控正常工作
  □ 性能监控正常工作
  □ 告警通知正常发送
  □ 日志记录正常
```

---

## 七、文档更新

### 7.1 更新 README

```markdown
## 部署

### 环境要求
- Node.js 18+
- PostgreSQL 16+
- Docker（可选）

### 环境变量
复制 `.env.example` 到 `.env.local` 并填写：
- `DATABASE_URL`: 数据库连接字符串
- `SESSION_SECRET`: Session 密钥（32+ 字符）
- `NEXT_PUBLIC_URL`: 应用 URL

### 部署步骤
1. 克隆代码
2. 安装依赖：`npm install`
3. 运行迁移：`npx prisma migrate deploy`
4. 构建应用：`npm run build`
5. 启动应用：`npm start`

### Docker 部署
docker-compose up -d
```

### 7.2 创建运维手册

```markdown
## 运维手册

### 日常操作
- 查看日志：`docker-compose logs -f app`
- 重启服务：`docker-compose restart app`
- 查看状态：`docker-compose ps`

### 数据库操作
- 备份：`pg_dump -U user dbname > backup.sql`
- 恢复：`psql -U user dbname < backup.sql`
- 迁移：`npx prisma migrate deploy`

### 故障处理
- 服务不可用：检查健康检查端点
- 数据库连接失败：检查数据库状态
- 内存溢出：重启服务并检查日志
```

---

## 八、验收清单

完成上线后，检查以下内容：

### 基础设施
- [ ] 服务器/平台配置完成
- [ ] 域名和 SSL 配置完成
- [ ] 数据库部署完成
- [ ] 环境变量配置完成

### 应用
- [ ] 代码部署成功
- [ ] 数据库迁移完成
- [ ] 种子数据已创建
- [ ] 健康检查通过

### 监控
- [ ] 错误监控已配置
- [ ] 性能监控已配置
- [ ] 告警已设置
- [ ] 日志已配置

### 文档
- [ ] README 已更新
- [ ] 运维手册已创建
- [ ] API 文档已更新
- [ ] 变更日志已记录

---

## 九、扩展挑战

1. **自动化测试**：添加 E2E 测试
2. **自动化部署**：配置完整的 CI/CD
3. **多环境管理**：开发、测试、生产环境
4. **灾备方案**：多区域部署
5. **成本优化**：资源使用监控和优化
