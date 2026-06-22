# 第七课：阶段实战——生产发布 Checklist

> **课程定位**：综合运用第五阶段所有知识，建立生产发布清单
> **前置知识**：第五阶段全部课程（第 1-6 课）
> **预计时长**：60 分钟

---

## 场景引入

经过整个课程的学习，你已经掌握了 Docker、Compose、CI/CD、云部署、生产可靠性的全部知识。现在是时候把它们整合成一个完整的生产发布体系了：一份可以反复执行的发布清单、一套自动化的发布脚本、一份详细的运维文档。这是你从"能部署"到"能运维"的最后一课。

---

## 学习目标

完成本课后，你将拥有一个完整的生产发布 checklist 和运维文档。

---

## 一、发布前检查清单

### 1.1 代码质量

```
□ 所有测试通过
□ 代码检查（lint）通过
□ 构建成功
□ 无安全漏洞（镜像扫描）
□ 依赖已更新到最新稳定版
```

### 1.2 配置检查

```
□ 环境变量配置正确
□ 数据库连接字符串正确
□ 密钥已更新（如果需要）
□ .env 文件已配置
□ docker-compose.prod.yml 正确
```

### 1.3 基础设施

```
□ 服务器资源充足（CPU、内存、磁盘）
□ 数据库已备份
□ DNS 配置正确
□ SSL 证书有效
□ 防火墙规则正确
```

---

## 二、发布流程

### 2.1 标准发布流程

```bash
#!/bin/bash
# scripts/release.sh

set -e

echo "=== 生产发布流程 ==="

# 1. 代码检查
echo "1. 运行测试..."
npm test

# 2. 构建镜像
echo "2. 构建镜像..."
docker compose -f docker-compose.prod.yml build

# 3. 备份数据库
echo "3. 备份数据库..."
bash scripts/backup-db.sh

# 4. 运行迁移
echo "4. 运行数据库迁移..."
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# 5. 部署
echo "5. 部署新版本..."
docker compose -f docker-compose.prod.yml up -d

# 6. 健康检查
echo "6. 等待健康检查..."
sleep 30
curl -f https://my-app.com/health || {
    echo "Health check failed! Rolling back..."
    bash scripts/rollback.sh
    exit 1
}

echo "=== 发布完成 ==="
```

### 2.2 回滚流程

```bash
#!/bin/bash
# scripts/rollback.sh

set -e

PREVIOUS_VERSION=${1:-$(git describe --tags --abbrev=0 HEAD~1)}

echo "=== 回滚到版本: $PREVIOUS_VERSION ==="

# 1. 恢复代码
git checkout "$PREVIOUS_VERSION"

# 2. 重新部署
docker compose -f docker-compose.prod.yml up -d --build

# 3. 健康检查
sleep 15
curl -f https://my-app.com/health || {
    echo "Rollback failed! Manual intervention required."
    exit 1
}

echo "=== 回滚完成 ==="
```

---

## 三、运维文档

### 3.1 常用命令

```bash
# 查看服务状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f

# 重启服务
docker compose -f docker-compose.prod.yml restart app

# 进入容器
docker compose -f docker-compose.prod.yml exec app sh

# 查看资源使用
docker stats
```

### 3.2 故障排查

```bash
# 服务不可用
1. 检查容器状态：docker compose ps
2. 查看日志：docker compose logs app
3. 检查健康检查：curl http://localhost:3000/health
4. 检查资源使用：docker stats

# 数据库连接失败
1. 检查 PostgreSQL 容器：docker compose ps postgres
2. 查看数据库日志：docker compose logs postgres
3. 测试连接：docker compose exec postgres psql -U postgres

# 内存不足
1. 检查内存使用：free -h
2. 查看容器内存：docker stats
3. 调整资源限制
```

### 3.3 监控告警

```bash
# 健康检查脚本
# scripts/health-check.sh
#!/bin/bash

check() {
    response=$(curl -s -o /dev/null -w "%{http_code}" "$1" 2>/dev/null)
    if [ "$response" != "200" ]; then
        echo "ALERT: $2 returned HTTP $response"
        # 发送告警
    fi
}

check "https://my-app.com/health" "App"
```

---

## 四、备份策略

```
备份策略：

  数据库：
  ├── 频率：每天凌晨 2 点
  ├── 保留：7 天
  ├── 存储：本地 + 异地（S3/OSS）
  └── 脚本：scripts/backup-db.sh

  配置文件：
  ├── 频率：每次变更
  ├── 存储：Git
  └── 包含：docker-compose.yml、nginx 配置、.env.example

  验证：
  ├── 每月测试恢复
  └── 记录恢复步骤和时间
```

---

## 五、安全检查

```
定期安全检查：

  每周：
  □ 检查系统更新
  □ 检查 Docker 镜像更新
  □ 查看异常日志

  每月：
  □ 扫描镜像漏洞
  □ 审查访问日志
  □ 测试备份恢复
  □ 审查用户权限

  每季度：
  □ 更新 SSL 证书（如果不是自动续期）
  □ 审查安全策略
  □ 更新应急联系人
```

---

## 六、应急响应

```
应急响应流程：

  1. 发现问题
     ├── 监控告警
     ├── 用户反馈
     └── 主动发现

  2. 评估影响
     ├── 影响范围
     ├── 影响程度
     └── 是否需要立即处理

  3. 处理问题
     ├── 紧急：立即回滚
     ├── 严重：尽快修复
     └── 一般：计划修复

  4. 恢复服务
     ├── 验证修复
     ├── 通知用户
     └── 记录过程

  5. 事后复盘
     ├── 分析原因
     ├── 改进措施
     └── 更新文档
```

---

## 七、验收清单

```
阶段五验收标准：

  ✅ 服务异常能自动重启
     restart: unless-stopped 配置正确

  ✅ 发布失败能回滚
     回滚脚本可用，测试过

  ✅ 资源占用可观察
     docker stats 正常，有监控

  ✅ 有故障处理手册
     运维文档完整，团队知晓
```

---

## 常见误区

- **"发布 checklist 太形式化了"**：每次发布都可能遗漏关键步骤（备份、迁移、健康检查）。清单化能确保每次发布流程一致，不依赖记忆。
- **"回滚脚本等出问题再写"**：出问题时时间紧迫，临时写的脚本可能有 bug。回滚脚本应该在第一次部署时就准备好并测试过。
- **"运维文档写一次就够了"**：运维文档需要随着系统变化持续更新。每次故障排查后都应该更新文档，记录新的问题和解决方案。
- **"监控告警配置好就不用管了"**：告警阈值需要根据实际运行情况调整。太敏感会导致告警疲劳，太迟钝会漏掉真正的问题。

---

## 工程建议

- **发布流程脚本化**：`scripts/release.sh` 包含测试、构建、备份、迁移、部署、健康检查的完整流程。一条命令执行，减少人为失误。
- **健康检查失败自动回滚**：部署后健康检查失败，自动执行 `scripts/rollback.sh`。不要等人工判断，时间就是损失。
- **运维文档放在项目仓库中**：`docs/ops.md` 记录常用命令、故障排查、备份策略、监控配置。和代码一起维护，不会过时。
- **建立应急响应流程**：P0 问题怎么处理、谁负责、通知谁、回滚还是修复。不要在紧急情况下才讨论流程。

---

## 小结

本课综合运用了第五阶段的所有知识：

1. **健康检查**：应用健康检查端点、Docker HEALTHCHECK
2. **重启策略**：unless-stopped、tini init 进程
3. **资源限制**：CPU、内存限制
4. **灰度发布**：Nginx 权重路由
5. **监控告警**：四个黄金信号、告警策略
6. **安全基线**：镜像安全、密钥管理、漏洞扫描

你现在已经拥有一个完整的生产发布 checklist 和运维文档。恭喜你完成了整个 Docker + CI/CD + 云部署实战课程！
