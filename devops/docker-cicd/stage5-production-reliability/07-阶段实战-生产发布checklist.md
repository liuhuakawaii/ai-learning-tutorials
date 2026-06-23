# 阶段实战：生产发布 Checklist

> 前置知识：第五阶段全部课程（第 1-6 课）

## 你要做什么

把整个课程学到的东西整合成一个可反复执行的发布体系：

1. 一份发布前检查清单
2. 一套自动化发布脚本
3. 一份故障回滚预案

这不是一个练习——这是你每次上线前要过一遍的东西。

## 发布前检查清单

### 代码质量

```
□ 所有测试通过                          npm test
□ Lint 无报错                           npm run lint
□ 构建成功                              npm run build
□ 无高危安全漏洞                         npm audit --audit-level=high
□ Docker 镜像扫描通过                    docker scout cves <image>
```

### 容器配置

```
□ 使用非 root 用户                       docker run --rm <image> whoami
□ 使用多阶段构建                         检查 Dockerfile 有多个 FROM
□ .dockerignore 排除了 .env 和 node_modules
□ 有 HEALTHCHECK 指令
□ 镜像体积合理（< 200MB）
□ 没有硬编码的密钥                       docker history <image> | grep -i secret
```

### 环境与配置

```
□ 生产环境变量已配置（通过 .env 或 secrets 管理）
□ 数据库迁移已执行                       npm run db:migrate
□ 数据库备份已创建                       ./scripts/backup-db.sh
□ DNS 已配置                            dig yourdomain.com
□ HTTPS 证书有效                         openssl s_client -connect yourdomain.com:443
```

### 监控与回滚

```
□ 健康检查端点正常                        curl https://yourdomain.com/health
□ 日志收集正常                           docker compose logs --tail 10 api
□ 上一个版本的镜像还在                    docker images | grep <previous-tag>
□ 回滚脚本已测试                         ./scripts/rollback.sh v1.0.0
```

## 发布脚本

```bash
#!/bin/bash
# scripts/release.sh
set -e

VERSION=$1
if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh v1.2.3"
  exit 1
fi

echo "=== Release $VERSION ==="

# 1. 预检
echo "[1/6] Running pre-checks..."
npm test
npm run lint
npm run build
npm audit --audit-level=high

# 2. 构建镜像
echo "[2/6] Building Docker image..."
docker build -t myapp:$VERSION .
docker images myapp:$VERSION

# 3. 推送镜像
echo "[3/6] Pushing to registry..."
docker tag myapp:$VERSION ghcr.io/myorg/myapp:$VERSION
docker push ghcr.io/myorg/myapp:$VERSION

# 4. 备份数据库
echo "[4/6] Backing up database..."
ssh deploy@server "/opt/myapp/scripts/backup-db.sh"

# 5. 部署
echo "[5/6] Deploying..."
ssh deploy@server "cd /opt/myapp && TAG=$VERSION docker compose pull && TAG=$VERSION docker compose up -d"

# 6. 验证
echo "[6/6] Verifying deployment..."
sleep 15
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Deployment successful!"
else
  echo "❌ Health check failed (HTTP $HTTP_CODE), rolling back..."
  ssh deploy@server "cd /opt/myapp && TAG=$PREVIOUS_TAG docker compose up -d"
  exit 1
fi
```

## 回滚预案

```bash
#!/bin/bash
# scripts/rollback.sh
set -e

PREVIOUS_TAG=$1
if [ -z "$PREVIOUS_TAG" ]; then
  echo "Usage: ./scripts/rollback.sh v1.0.0"
  exit 1
fi

echo "=== Rolling back to $PREVIOUS_TAG ==="

# 1. 拉取上一个版本的镜像
docker pull ghcr.io/myorg/myapp:$PREVIOUS_TAG

# 2. 切换到上一个版本
TAG=$PREVIOUS_TAG docker compose up -d

# 3. 验证
sleep 10
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Rollback successful!"
else
  echo "❌ Rollback also failed! Manual intervention needed."
  exit 1
fi
```

回滚预案的几个关键原则：

**永远保留上一个版本的镜像。** 不要 `docker image prune` 把旧镜像删了。镜像占的空间很小，但回滚时找不到旧镜像的代价很大。

**回滚脚本要提前测试。** 不要等到出问题了才发现回滚脚本不能用。每次发布后，用 staging 环境跑一遍回滚脚本验证。

**数据库迁移要考虑回滚。** 如果新版本改了数据库 schema，回滚时 schema 可能不兼容旧代码。发布前确保有 `down` 迁移脚本。

## 故障排查 SOP

当生产环境出问题时，按这个顺序排查：

```bash
# 1. 确认问题范围
curl -I https://yourdomain.com/health    # API 是否响应？
curl -I https://yourdomain.com           # 前端是否响应？

# 2. 查看容器状态
docker compose ps                         # 哪个容器不健康？

# 3. 查看日志
docker compose logs --tail 50 api         # 最近 50 行日志
docker compose logs --since 5m api        # 最近 5 分钟的日志

# 4. 检查资源
docker stats --no-stream                  # CPU 和内存使用
df -h                                     # 磁盘空间
free -h                                   # 系统内存

# 5. 检查数据库
docker compose exec db psql -U postgres myapp -c "SELECT 1"
docker compose exec db psql -U postgres myapp -c "SELECT pg_database_size('myapp')"

# 6. 决定：修复还是回滚？
# 能快速修复 → 修复
# 不能 → 立即回滚，再排查
```

## 练习

### 练习一：完善发布脚本

在 `scripts/release.sh` 中添加：发布前自动创建 git tag，发布成功后自动创建 GitHub Release。使用 `gh` CLI。

### 练习二：数据库迁移安全

写一个 `scripts/migrate-safe.sh`，实现：备份数据库 → 执行迁移 → 验证迁移 → 如果验证失败自动回滚迁移。

### 练习三：灰度发布

用 Nginx 的 `upstream` 模块实现简单的灰度发布：90% 流量到旧版本，10% 到新版本。写一个 `scripts/canary.sh` 脚本，逐步调整流量比例（10% → 50% → 100%），每步之间观察 5 分钟。

---

## 参考答案

### 练习一

```bash
# 在 release.sh 的验证成功后添加：

# 7. 创建 git tag
echo "[7/7] Creating git tag..."
git tag $VERSION
git push origin $VERSION

# 8. 创建 GitHub Release
gh release create $VERSION \
  --title "Release $VERSION" \
  --notes "Automated release via script"
```

### 练习二

```bash
#!/bin/bash
# scripts/migrate-safe.sh
set -e

echo "=== Safe Database Migration ==="

# 1. 备份
echo "[1/4] Creating backup..."
./scripts/backup-db.sh
BACKUP_FILE=$(ls -t /opt/myapp/backups/*.sql.gz | head -1)

# 2. 执行迁移
echo "[2/4] Running migration..."
npm run db:migrate

# 3. 验证
echo "[3/4] Verifying..."
npm run db:migrate:status
# 检查关键表是否存在
docker compose exec db psql -U postgres myapp -c "\dt" | grep -q "users" || {
  echo "Verification failed, rolling back migration..."
  npm run db:migrate:down
  echo "Restoring from backup: $BACKUP_FILE"
  gunzip < $BACKUP_FILE | docker compose exec -T db psql -U postgres myapp
  exit 1
}

echo "[4/4] Migration successful!"
```

### 练习三

```nginx
# nginx/conf.d/canary.conf
upstream backend {
    server api-old:3000 weight=9;   # 90% 流量
    server api-new:3000 weight=1;   # 10% 流量
}
```

```bash
#!/bin/bash
# scripts/canary.sh

STEPS=("1" "5" "10")
OLD_SERVICE="api-old"
NEW_SERVICE="api-new"

for weight in "${STEPS[@]}"; do
  OLD_WEIGHT=$((10 - $weight))
  echo "Traffic: old=$OLD_WEIGHT/10, new=$weight/10"

  # 更新 nginx 配置
  sed -i "s/server api-old:3000 weight=.*/server api-old:3000 weight=$OLD_WEIGHT;/" nginx/conf.d/canary.conf
  sed -i "s/server api-new:3000 weight=.*/server api-new:3000 weight=$weight;/" nginx/conf.d/canary.conf

  docker compose restart nginx

  echo "Observing for 5 minutes..."
  sleep 300

  # 检查新版本的错误率
  ERROR_RATE=$(docker compose logs --since 5m $NEW_SERVICE 2>&1 | grep -c "ERROR" || true)
  if [ "$ERROR_RATE" -gt 10 ]; then
    echo "Too many errors ($ERROR_RATE), rolling back to old version"
    sed -i "s/server api-old:3000 weight=.*/server api-old:3000 weight=10;/" nginx/conf.d/canary.conf
    sed -i "s/server api-new:3000 weight=.*/server api-new:3000 weight=0;/" nginx/conf.d/canary.conf
    docker compose restart nginx
    exit 1
  fi
done

echo "✅ Canary deployment complete, all traffic on new version"
```
