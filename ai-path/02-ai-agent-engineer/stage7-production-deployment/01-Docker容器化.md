# 01 Docker 容器化

> "在我机器上能跑"是开发最大的谎言——Docker 让所有机器都一样。

## 场景引入

你的 AI Agent 平台在本地开发环境跑得好好的，部署到服务器却报错：Python 版本不对、系统库缺失、环境变量没传。同事克隆代码后又遇到不同的问题，排查半天发现是操作系统差异导致的。容器化的核心价值就是把应用和它的运行环境打包成一个不可变的单元，确保从开发到生产每个环节行为一致。

## 学习目标

- 编写多阶段 Dockerfile 优化镜像大小
- 理解 Docker 安全最佳实践
- 实现前后端容器化

## 后端 Dockerfile

```dockerfile
# backend/Dockerfile
# 多阶段构建
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

# 只复制安装好的依赖
COPY --from=builder /install /usr/local

# 复制应用代码
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# 非 root 用户运行
RUN useradd -m appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 前端 Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Docker 安全最佳实践

1. **用 slim/alpine 基础镜像**
2. **非 root 用户运行**
3. **不要安装不需要的包**
4. **定期扫描漏洞**
5. **不要在镜像中存储密钥**

## 练习

### 练习 1：镜像构建

1. 编写后端多阶段 Dockerfile
2. 编写前端多阶段 Dockerfile
3. 优化镜像大小（目标 < 200MB）

### 练习 2：安全扫描

1. 用 `docker scout` 扫描镜像漏洞
2. 修复高危漏洞
3. 配置自动化扫描

---

## 参考答案

### 练习 1

**思路**：多阶段构建的核心是把"构建阶段"和"运行阶段"分开——构建阶段包含编译器、开发依赖等工具，运行阶段只复制编译产物。这样镜像体积可以从 1GB+ 缩减到 200MB 以内。`.dockerignore` 和 COPY 顺序是优化构建缓存的关键。

**答案**：

```dockerfile
# backend/Dockerfile
# --- 构建阶段 ---
FROM python:3.12-slim AS builder

WORKDIR /app

# 先复制依赖文件（利用 Docker 缓存层）
COPY requirements.txt .

# 安装依赖到独立前缀目录
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- 运行阶段 ---
FROM python:3.12-slim

WORKDIR /app

# 只复制安装好的依赖（不带 pip、setuptools 等构建工具）
COPY --from=builder /install /usr/local

# 复制应用代码（变更频率最高，放最后）
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# 非 root 用户运行
RUN useradd -m -r appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# frontend/Dockerfile
# --- 构建阶段 ---
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件
COPY package.json package-lock.json ./
RUN npm ci --production=false

# 复制源码并构建
COPY . .
RUN npm run build

# --- 运行阶段 ---
FROM nginx:1.25-alpine

# 只复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 非 root 运行（nginx 镜像默认已配置）
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

```
# .dockerignore
.git
.gitignore
node_modules
__pycache__
*.pyc
.env
.env.*
!.env.example
dist
build
.pytest_cache
.mypy_cache
coverage
*.md
!README.md
docker-compose*.yml
Dockerfile*
.dockerignore
```

**要点**：
- COPY 顺序很重要：先 COPY `requirements.txt` / `package.json`，再 COPY 源码——依赖不变时 Docker 会复用缓存层，大幅加速构建
- `.dockerignore` 不能省略——没有它 `.git`（可能几百 MB）和 `node_modules` 会被打包进镜像
- 常见错误：在运行阶段保留了构建工具（pip、gcc、node），镜像体积从 200MB 膨胀到 1GB+

### 练习 2

**思路**：安全扫描要集成到 CI/CD 流水线中，每次构建后自动扫描。扫描发现高危漏洞时修复方式有两种：升级基础镜像版本，或在 Dockerfile 中显式升级系统包。扫描结果要记录并跟踪。

**答案**：

```bash
# 1. 用 Docker Scout 扫描镜像漏洞
docker scout cves myrepo/backend:latest
docker scout cves myrepo/frontend:latest

# 2. 用 Trivy 扫描（更详细的报告）
trivy image myrepo/backend:latest --severity HIGH,CRITICAL
trivy image myrepo/frontend:latest --severity HIGH,CRITICAL

# 3. 查看扫描建议
docker scout recommendations myrepo/backend:latest
```

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build backend image
        run: docker build -t backend:${{ github.sha }} ./backend

      - name: Build frontend image
        run: docker build -t frontend:${{ github.sha }} ./frontend

      - name: Run Trivy scan (backend)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: backend:${{ github.sha }}
          format: table
          severity: HIGH,CRITICAL
          exit-code: 1  # 发现高危漏洞时 CI 失败

      - name: Run Trivy scan (frontend)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: frontend:${{ github.sha }}
          format: table
          severity: HIGH,CRITICAL
          exit-code: 1

      - name: Upload scan results
        uses: actions/upload-artifact@v4
        with:
          name: trivy-results
          path: trivy-*.json
```

修复高危漏洞的 Dockerfile 示例：

```dockerfile
# 修复 Python 基础镜像漏洞
FROM python:3.12-slim

# 升级系统包修复已知 CVE
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 后续构建步骤...
```

**要点**：
- 扫描要集成到 CI 中，发现 HIGH/CRITICAL 漏洞时 pipeline 直接失败——不能让有已知高危漏洞的镜像部署到生产
- 修复漏洞优先升级基础镜像版本（如 `python:3.12-slim` → `python:3.12.4-slim`），其次才是在 Dockerfile 中 `apt-get upgrade`
- 常见错误：只在本地手动扫描一次就完了——漏洞库每天更新，必须持续扫描，旧镜像也可能被发现新漏洞

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| 镜像太大 | 没用多阶段构建 | 分离构建和运行阶段 |
| 构建缓存失效 | COPY 顺序不对 | 先 COPY 依赖文件，再 COPY 代码 |
| 权限问题 | 用 root 运行 | 创建非 root 用户 |

## 工程建议

生产环境镜像务必使用多阶段构建，将构建工具和运行时分离，镜像体积可从 1GB+ 缩减到 200MB 以内。始终用非 root 用户运行容器进程，并定期用 `docker scout` 或 Trivy 扫描基础镜像漏洞。`.dockerignore` 文件不可省略，避免将 `.git`、`node_modules`、`.env` 等敏感文件打包进镜像。

## 本节要点

- 多阶段构建减小镜像大小
- 非 root 用户运行提升安全性
- .dockerignore 排除不需要的文件
