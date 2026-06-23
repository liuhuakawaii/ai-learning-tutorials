# 01 Docker 容器化

> "在我机器上能跑"是开发最大的谎言——Docker 让所有机器都一样。

你的 AI Agent 平台在本地跑得好好的，部署到服务器却报错：Python 版本不对、系统库缺失、环境变量没传。同事克隆代码又遇到不同问题，排查半天是操作系统差异。容器化的核心价值：把应用和运行环境打包成不可变的单元，确保从开发到生产行为一致。

## 多阶段构建

镜像大小直接影响部署速度和存储成本。不用多阶段构建的 Python 镜像轻松超过 1GB，用了之后可以压到 200MB 以内。

```dockerfile
# backend/Dockerfile
# --- 构建阶段：安装依赖 ---
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- 运行阶段：只复制产物 ---
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /install /usr/local
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

RUN useradd -m -r appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

构建阶段包含 pip、gcc 等工具，运行阶段只复制编译好的依赖。镜像从 1GB+ 缩到 ~150MB。

前端同理：

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Node.js 只在构建阶段出现，运行阶段只有 Nginx + 静态文件。

## COPY 顺序与构建缓存

Docker 按层缓存。COPY 顺序决定了缓存命中率：

```dockerfile
# 好：先 COPY 依赖文件，依赖不变时命中缓存
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app/ ./app/  # 代码变了只重建这层

# 差：先 COPY 代码，代码一改依赖全部重装
COPY . .
RUN pip install -r requirements.txt
```

依赖文件（requirements.txt、package.json）变更频率低，放前面。源码变更频率高，放最后。

## .dockerignore

没有 .dockerignore，`.git`（可能几百 MB）、`node_modules`、`.env` 都会被打包进镜像：

```
# .dockerignore
.git
node_modules
__pycache__
*.pyc
.env
.env.*
dist
build
.pytest_cache
*.md
!README.md
```

## 安全实践

1. **非 root 运行**：`RUN useradd -m -r appuser && USER appuser`
2. **不存密钥**：密钥通过环境变量注入，不要 COPY .env
3. **定期扫描**：用 Trivy 或 Docker Scout 扫描基础镜像漏洞

```bash
# 扫描镜像漏洞
docker scout cves myrepo/backend:latest
trivy image myrepo/backend:latest --severity HIGH,CRITICAL
```

发现高危漏洞时，优先升级基础镜像版本，其次在 Dockerfile 中 `apt-get upgrade`。

## 练习

### 练习 1：构建后端镜像

1. 写后端多阶段 Dockerfile
2. 构建并检查镜像大小：`docker images | grep backend`
3. 目标 < 200MB

### 练习 2：构建前端镜像

1. 写前端多阶段 Dockerfile
2. 配置 Nginx（SPA fallback、API 代理）
3. 验证前端在容器中正常运行

### 练习 3：安全扫描

1. 用 Trivy 扫描后端和前端镜像
2. 修复 HIGH/CRITICAL 级别漏洞
3. 写一个 GitHub Actions workflow，每次构建后自动扫描

## 关键判断

- **多阶段构建不是可选的。** 生产环境镜像必须用多阶段构建，1GB 的镜像和 150MB 的镜像在部署速度和存储成本上差距巨大。
- **COPY 顺序直接影响开发体验。** 代码改一行就要重装所有依赖，等待时间从 5 秒变成 5 分钟。
- **安全扫描要集成到 CI。** 漏洞库每天更新，旧镜像也可能被发现新漏洞——必须持续扫描。
