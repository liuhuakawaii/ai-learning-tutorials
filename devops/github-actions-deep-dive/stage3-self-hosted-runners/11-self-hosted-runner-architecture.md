# 自托管 Runner 架构

> GitHub 托管 Runner 方便，但有硬性限制：资源固定、无法访问内网、macOS 成本高。当你的 CI 需要更多控制时，就该考虑自托管 Runner。

## 为什么需要自托管 Runner

几个典型场景：
- **内网访问**：CI 需要访问公司内网的数据库、私有镜像仓库、VPN 才能到达的服务
- **硬件需求**：编译大型项目需要更多 CPU/内存，或者需要 GPU
- **成本控制**：macOS 托管 Runner 每分钟 10 美分，自建 Mac mini 长期更划算
- **合规要求**：代码不能在 GitHub 的基础设施上运行
- **特殊环境**：需要特定操作系统、特定硬件、特定网络配置

## 架构概述

```
GitHub.com
    ↕ (长连接，HTTPS)
Runner Listener (你的机器上)
    ↕
Runner Agent
    ↕
Job (checkout 代码、执行 Step)
```

Runner 和 GitHub 之间通过 HTTPS 长连接通信。Runner 主动连接 GitHub，不需要入站端口。这意味着：
- 不需要在防火墙上开入站端口
- 需要出站 HTTPS 访问 `github.com` 和 `api.github.com`
- 如果用代理，需要配置代理环境变量

## 安装和注册

### 手动安装

```bash
# 创建目录
mkdir actions-runner && cd actions-runner

# 下载 Runner 包
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# 解压
tar xzf actions-runner-linux-x64-2.311.0.tar.gz

# 配置（仓库级）
./config.sh --url https://github.com/owner/repo \
  --token YOUR_TOKEN \
  --labels self-hosted,linux,x64

# 运行
./run.sh
```

Token 从仓库 Settings → Actions → Runners → New self-hosted runner 获取。Token 有效期 1 小时。

### 组织级 Runner

```bash
./config.sh --url https://github.com/my-org \
  --token YOUR_TOKEN \
  --labels self-hosted,linux,x64 \
  --runnergroup production
```

组织级 Runner 可以被组织内所有仓库共享。通过 Runner Group 控制访问权限。

### 作为系统服务运行

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

`svc.sh` 把 Runner 注册为 systemd 服务（Linux）或 launchd 服务（macOS）。这样机器重启后 Runner 会自动启动。

## 标签系统

标签是自托管 Runner 最重要的配置之一。Workflow 通过标签选择 Runner：

```yaml
jobs:
  build:
    runs-on: [self-hosted, linux, x64, gpu]
```

GitHub 提供的默认标签：`self-hosted`、`linux`/`windows`/`macos`、`x64`/`arm64`。你可以添加自定义标签：`gpu`、`high-memory`、`production`、`east-us`。

标签的匹配逻辑是 AND——Runner 必须拥有所有指定的标签。所以 `[self-hosted, linux, gpu]` 只匹配同时有这三个标签的 Runner。

### 标签设计建议

- 按硬件能力：`gpu`、`high-memory`、`nvme`
- 按环境：`production`、`staging`、`internal`
- 按地理位置：`us-east`、`eu-west`
- 按用途：`docker-builder`、`test-runner`

不要用版本号作标签——版本会变，标签应该描述能力而不是状态。

## Runner 的工作目录

Runner 每次执行 Job 时：
1. 创建临时工作目录：`_work/<repo-name>/<repo-name>`
2. `actions/checkout` 把代码 clone 到这个目录
3. Job 结束后，清理工作目录

默认工作目录在 Runner 安装目录下的 `_work/`。可以通过环境变量修改：

```bash
export RUNNER_WORKDIR=/opt/actions-runner-work
./run.sh
```

### 磁盘空间管理

自托管 Runner 不像托管 Runner 那样每次都是全新 VM。长期运行的 Runner 会积累：
- 旧的 checkout 目录（如果清理失败）
- Docker 镜像（如果用了 Docker 构建）
- 缓存文件
- 日志

需要定期清理：

```bash
# 清理 Docker
docker system prune -af

# 清理旧的 checkout
rm -rf /opt/actions-runner/_work/*/*/
```

## 多 Runner 管理

一台机器可以运行多个 Runner 实例，只要它们的工作目录不同：

```bash
# Runner 1
./config.sh --url ... --token ... --name runner-1 --work /tmp/runner-1

# Runner 2
./config.sh --url ... --token ... --name runner-2 --work /tmp/runner-2
```

但更推荐的方式是用容器化（第 13 课会讲 ARC）或者配置管理工具（Ansible、Terraform）来管理多台 Runner。

## 监控和日志

### Runner 日志

Runner 的日志在安装目录的 `_diag/` 目录下：

```bash
tail -f _diag/Runner_*.log
```

### Job 日志

每个 Job 的详细日志也会写入 `_diag/`。如果 Job 异常终止（比如机器重启），这些日志是排查问题的唯一线索。

### 健康检查

```bash
# 检查 Runner 进程
ps aux | grep Runner.Listener

# 检查 Runner 状态（需要 Runner 正在运行）
./run.sh --check
```

## 练习

### 练习一：规划 Runner 集群

为以下场景设计 Runner 集群方案：

- 3 个 Node.js 微服务，日常 CI 需要 4 核 8GB
- 1 个 Go 服务，编译需要 8 核 16GB
- 1 个 Python ML 项目，需要 GPU
- 所有服务都需要访问内网的私有 npm 镜像和 Docker 镜像仓库

回答：
1. 需要几种类型的 Runner？
2. 标签怎么设计？
3. Runner Group 怎么划分？
4. 大概需要多少台机器？

---

## 参考答案

### 练习一

**Runner 类型**：

| 类型 | 标签 | 硬件 | 数量 |
|---|---|---|---|
| 通用 CI | `self-hosted, linux, x64, general` | 4 核 8GB | 2-3 台 |
| Go 编译 | `self-hosted, linux, x64, build-heavy` | 8 核 16GB | 1 台 |
| ML 训练 | `self-hosted, linux, x64, gpu` | 4 核 16GB + GPU | 1 台 |

**Runner Group**：
- `ci`：包含通用 CI 和 Go 编译 Runner，所有仓库可用
- `ml`：只包含 GPU Runner，只有 ML 项目仓库可用
- `production`：包含通用 CI Runner，用于生产环境部署

**Workflow 配置**：

```yaml
# Node.js 服务
runs-on: [self-hosted, linux, x64, general]

# Go 服务
runs-on: [self-hosted, linux, x64, build-heavy]

# Python ML 项目
runs-on: [self-hosted, linux, x64, gpu]
```

**网络**：所有 Runner 在同一个 VPC 内，能访问私有镜像仓库。通过 VPN 或专线连接 GitHub。
