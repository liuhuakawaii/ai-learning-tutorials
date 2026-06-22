# 第五课：构建 Docker 镜像

> **课程定位**：在 CI 中自动构建 Docker 镜像
> **前置知识**：GitHub Actions 基础、Dockerfile（前几课）
> **预计时长**：30 分钟

---

## 场景引入

你本地 `docker build` 构建镜像只要 30 秒，但在 GitHub Actions 里要 5 分钟——因为 CI 环境没有缓存，每次都要从头构建。更头疼的是，你用的是 M1 MacBook（arm64），但 CI 跑在 x86 服务器上，构建出来的镜像在服务器上跑不了。怎么解决缓存和跨平台的问题？

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

## 常见误区

- **"CI 里直接 docker build 就行了"**：直接用 `docker build` 没有缓存，每次从头构建。应该用 Docker Buildx + GHA 缓存后端，复用之前的构建层。
- **"latest 标签就是最新版"**：`latest` 只是默认标签，不代表最新。应该用语义化版本（`v1.2.3`）或 Git SHA 作为标签，方便追溯和回滚。
- **"多平台构建很复杂"**：Docker Buildx + QEMU 让多平台构建变得简单，只需要 `platforms: linux/amd64,linux/arm64` 一行配置。
- **"Docker Hub 和 GHCR 差不多"**：GHCR（GitHub Container Registry）和 GitHub 仓库无缝集成，用 `GITHUB_TOKEN` 就能认证，不需要额外配置 Secrets。公开仓库的 GHCR 也免费。

---

## 工程建议

- **用 `docker/build-push-action` 而不是手动 `docker build`**：官方 Action 支持缓存、多平台、自动标签，比手写命令更可靠。
- **用 `docker/metadata-action` 自动生成标签**：根据分支名、标签、Git SHA 自动生成镜像标签，减少手动配置错误。
- **构建时 `push: false` 用于测试**：PR 时只构建不推送，验证 Dockerfile 是否正确，合并到 main 后再推送。
- **配置 Docker Hub Access Token**：不要用密码登录 Docker Hub，用 Personal Access Token，权限更细、更安全。

---

## 小结

1. **Docker Buildx**：提供缓存和多平台构建支持
2. **docker/build-push-action**：官方推荐的构建 Action
3. **镜像标签**：使用 docker/metadata-action 自动生成
4. **缓存**：`cache-from: type=gha` 使用 GitHub Actions 缓存

---

## 下一课预告

下一课我们将学习推送镜像到 Registry 并触发部署。

---

## 参考答案

### 练习一

**思路**：使用 Docker Buildx 配合 GitHub Actions 缓存后端来构建镜像。通过 `docker/setup-buildx-action` 设置 Buildx，再用 `docker/build-push-action` 构建，启用 GHA 缓存加速重复构建。

**答案**：

```yaml
name: Docker Build

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: my-app:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**要点**：
- `docker/setup-buildx-action@v3` 是使用 Buildx 缓存的前提，必须先设置
- `push: false` 表示只构建不推送，适合 PR 阶段验证 Dockerfile 是否正确
- `cache-from: type=gha` 从 GitHub Actions 缓存读取之前的构建层
- `cache-to: type=gha,mode=max` 将所有构建层写入缓存（`mode=max` 缓存所有层，不只是最终层）
- `${{ github.sha }}` 用 Git commit SHA 作为镜像标签，方便追溯

### 练习二

**思路**：在练习一的基础上，添加 GHCR 登录步骤并启用推送。需要声明 `permissions: packages: write` 权限，使用 `GITHUB_TOKEN` 认证。

**答案**：

```yaml
name: Build and Push to GHCR

on:
  push:
    branches: [main]
    tags: ['v*']

permissions:
  contents: read
  packages: write

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**要点**：
- `permissions: packages: write` 是推送到 GHCR 的必要权限，不声明会导致推送失败
- `${{ secrets.GITHUB_TOKEN }}` 是 GitHub 自动提供的，无需手动配置 Secrets
- `${{ github.actor }}` 是触发 workflow 的用户名，`${{ github.repository }}` 是仓库名（格式：`owner/repo`）
- 使用 `docker/metadata-action` 自动生成标签，避免手动拼接出错
- 推送到 GHCR 后，可以在仓库的 Packages 标签页看到镜像
