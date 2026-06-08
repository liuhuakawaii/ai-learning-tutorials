# 第五课：构建 Docker 镜像

> **课程定位**：在 CI 中自动构建 Docker 镜像
> **前置知识**：GitHub Actions 基础、Dockerfile（前几课）
> **预计时长**：30 分钟

---

## 学习目标

1. 在 GitHub Actions 中构建 Docker 镜像
2. 使用 Docker Buildx 和缓存
3. 理解多平台构建
4. 掌握镜像标签策略

---

## 一、基本构建

```yaml
name: Build Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t my-app:${{ github.sha }} .
      
      - name: Verify image
        run: docker images my-app
```

---

## 二、使用 Docker Buildx

### 2.1 为什么用 Buildx

```
Buildx 的优势：

  ✅ 构建缓存：可以使用 GitHub Actions 缓存
  ✅ 多平台构建：同时构建 amd64 和 arm64
  ✅ 更好的输出：详细的构建日志
  ✅ 高级特性：构建参数、秘密挂载等
```

### 2.2 完整配置

```yaml
name: Build Docker Image

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # 设置 Docker Buildx
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      # 构建并推送（不推送时 push: false）
      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: my-app:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## 三、构建并推送到 Registry

### 3.1 推送到 Docker Hub

```yaml
name: Build and Push

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # 登录 Docker Hub
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      
      # 设置 Buildx
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      # 构建并推送
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            myuser/my-app:latest
            myuser/my-app:${{ github.ref_name }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 3.2 推送到 GitHub Container Registry

```yaml
- name: Login to GHCR
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ghcr.io/${{ github.repository }}:${{ github.ref_name }}
```

---

## 四、镜像标签策略

```yaml
- name: Docker meta
  id: meta
  uses: docker/metadata-action@v5
  with:
    images: myuser/my-app
    tags: |
      # 分支名
      type=ref,event=branch
      # PR 编号
      type=ref,event=pr
      # 语义化版本
      type=semver,pattern={{version}}
      type=semver,pattern={{major}}.{{minor}}
      # Git SHA
      type=sha

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    tags: ${{ steps.meta.outputs.tags }}
```

```
标签结果示例：

  推送标签 v1.2.3：
    myuser/my-app:v1.2.3
    myuser/my-app:1.2
    myuser/my-app:sha-abc1234

  推送到 main 分支：
    myuser/my-app:main
    myuser/my-app:sha-abc1234
```

---

## 五、多平台构建

```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    platforms: linux/amd64,linux/arm64
    tags: myuser/my-app:latest
```

---

## 六、设置 Secrets

```
在 GitHub 仓库中设置 Secrets：

  1. 进入仓库 Settings → Secrets and variables → Actions
  2. 点击 "New repository secret"
  3. 添加：
     - DOCKERHUB_USERNAME：Docker Hub 用户名
     - DOCKERHUB_TOKEN：Docker Hub Access Token

  注意：使用 Access Token，不要用密码
```

---

## 七、动手练习

### 练习一：构建镜像

```yaml
name: Docker Build

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: my-app:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 练习二：推送到 GHCR

```yaml
# 设置 GITHUB_TOKEN 权限
permissions:
  packages: write

# 登录并推送到 ghcr.io
```

---

## 小结

1. **Docker Buildx**：提供缓存和多平台构建支持
2. **docker/build-push-action**：官方推荐的构建 Action
3. **镜像标签**：使用 docker/metadata-action 自动生成
4. **缓存**：`cache-from: type=gha` 使用 GitHub Actions 缓存

---

## 下一课预告

下一课我们将学习推送镜像到 Registry 并触发部署。
