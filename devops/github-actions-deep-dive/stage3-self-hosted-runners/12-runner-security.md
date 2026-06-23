# Runner 安全

> 自托管 Runner 给了你控制权，也把安全责任交给了你。GitHub 托管 Runner 每次都是全新 VM，用完就销毁。自托管 Runner 是持久化的——上一个 Job 的残留可能影响下一个 Job。

## 核心风险

### 风险一：Job 之间的隔离

GitHub 托管 Runner 每次都是干净的 VM。自托管 Runner 不是。如果 Runner 被复用，前一个 Job 的文件、进程、环境变量可能残留。

**缓解措施**：

1. **用容器隔离**：每个 Job 在独立的容器里运行（第 13 课讲 ARC）
2. **用完即弃**：每次 Job 结束后销毁 Runner，启动新的
3. **清理脚本**：Job 前后执行清理

```yaml
steps:
  - name: Cleanup
    if: always()
    run: |
      rm -rf $GITHUB_WORKSPACE/*
      docker system prune -af
```

### 风险二：恶意代码执行

PR 来自外部贡献者时，`pull_request` 事件会在你的 Runner 上执行代码。恶意 PR 可以：
- 读取 Runner 上的文件（包括之前的 Job 残留）
- 访问 Runner 所在网络的其他服务
- 消耗 Runner 资源（挖矿）
- 篡改 Runner 环境

**缓解措施**：

1. **只允许特定事件**：

```yaml
jobs:
  build:
    if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository
```

这确保只有本仓库的 PR（不是 fork 的 PR）才在自托管 Runner 上运行。Fork 的 PR 在托管 Runner 上运行。

2. **限制 Runner 的网络访问**：
   - Runner 只能访问必要的服务
   - 不能访问内网其他服务
   - 用网络策略（Security Group、Network Policy）隔离

3. **最小权限**：
   - Runner 进程用非 root 用户运行
   - 不在 Runner 上存储敏感信息
   - 用临时 token，不用长期 token

### 风险三：Secret 泄露

自托管 Runner 上的 Secret 可能通过以下方式泄露：
- Job 日志不小心打印了 Secret
- 测试代码把 Secret 写入文件
- 恶意 Step 把 Secret 发送到外部服务

**缓解措施**：

1. **日志遮蔽**：GitHub 会自动遮蔽已注册的 Secret 值，但动态生成的值不会被遮蔽
2. **环境隔离**：生产 Secret 只在特定环境的 Job 中可用
3. **审计日志**：监控 Runner 上的网络请求和文件访问

## 权限最小化

### Runner 用户

不要用 root 运行 Runner：

```bash
# 创建专用用户
sudo useradd -m actions-runner
sudo usermod -aG docker actions-runner

# 用这个用户运行 Runner
sudo -u actions-runner ./run.sh
```

### 文件权限

Runner 安装目录应该是 Runner 用户拥有的：

```bash
sudo chown -R actions-runner:actions-runner /opt/actions-runner
```

工作目录也应该限制权限：

```bash
sudo mkdir -p /opt/runner-work
sudo chown actions-runner:actions-runner /opt/runner-work
```

### Docker 权限

如果 Job 需要 Docker，把 Runner 用户加入 `docker` 组：

```bash
sudo usermod -aG docker actions-runner
```

但注意：`docker` 组的用户有 root 等效权限（可以挂载宿主机文件系统）。如果这是个问题，考虑用 rootless Docker 或 Podman。

## 网络隔离

### 基本原则

Runner 应该在隔离的网络环境中：
- 只能出站到 GitHub（`github.com`、`api.github.com`、`*.actions.githubusercontent.com`）
- 只能访问 CI 需要的服务（Docker 镜像仓库、npm 镜像等）
- 不能访问生产数据库、内部管理后台等敏感服务

### 实现方式

**Security Group / Firewall**：

```bash
# 只允许出站到 GitHub 和镜像仓库
iptables -A OUTPUT -d github.com -j ACCEPT
iptables -A OUTPUT -d api.github.com -j ACCEPT
iptables -A OUTPUT -d ghcr.io -j ACCEPT
iptables -A OUTPUT -d registry.npmjs.org -j ACCEPT
iptables -A OUTPUT -j DROP
```

**VPC / 子网隔离**：

Runner 在独立的子网里，通过 NAT 访问互联网，通过 VPC Peering 访问必要的内部服务。

## 镜像管理

如果用 Docker 运行 Runner，镜像管理很重要：

### 固定版本

```dockerfile
FROM ubuntu:22.04

# 安装特定版本的 Runner
ARG RUNNER_VERSION=2.311.0
RUN curl -o actions-runner.tar.gz -L \
    https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz \
    && tar xzf actions-runner.tar.gz \
    && rm actions-runner.tar.gz

# 安装固定版本的工具
RUN apt-get update && apt-get install -y \
    nodejs=18.* \
    python3=3.10.* \
    && rm -rf /var/lib/apt/lists/*
```

### 定期更新

- Runner 版本：关注 GitHub 的更新公告，定期更新
- 基础镜像：定期重建，获取安全补丁
- 工具版本：根据项目需要更新

### 镜像扫描

```bash
# 用 Trivy 扫描镜像漏洞
trivy image my-runner:latest
```

## 审计和监控

### Runner 活动日志

GitHub 提供 Runner 的使用情况：
- 仓库 Settings → Actions → Runners：查看 Runner 状态和最近的 Job
- 组织 Settings → Actions → Runners：查看所有 Runner

### 系统级监控

```bash
# 监控 Runner 进程
systemctl status actions.runner.*.service

# 监控资源使用
htop
iotop
```

### 异常检测

关注以下信号：
- Runner 突然变慢（可能是挖矿）
- 异常的网络连接（可能是数据外泄）
- 磁盘空间异常增长（可能是日志暴涨或恶意文件）
- Runner 频繁重启（可能是内存不足或进程崩溃）

## 练习

### 练习一：安全审计清单

为一个自托管 Runner 制作安全审计清单。覆盖以下方面：
1. Runner 安装和配置
2. 用户和权限
3. 网络和防火墙
4. Secret 管理
5. 监控和日志
6. 更新和补丁

---

## 参考答案

### 安全审计清单

**安装和配置**：
- [ ] Runner 用非 root 用户运行
- [ ] Runner 安装目录权限正确（仅 Runner 用户可写）
- [ ] Runner 作为系统服务运行，自动重启
- [ ] Runner 版本不是太旧（6 个月内）
- [ ] 工作目录在独立分区，有大小限制

**用户和权限**：
- [ ] Runner 用户没有 sudo 权限
- [ ] Docker 组的成员只有 Runner 用户
- [ ] 没有在 Runner 上存储长期凭证
- [ ] Job 使用最小必要的 GitHub Token 权限

**网络和防火墙**：
- [ ] Runner 只能出站到 GitHub 和必要的服务
- [ ] Runner 不能直接访问生产数据库
- [ ] Runner 在隔离的子网/安全组中
- [ ] 有网络流量监控

**Secret 管理**：
- [ ] Secret 不在 Runner 环境变量中硬编码
- [ ] 生产 Secret 只在保护环境中可用
- [ ] 有 Secret 轮换机制
- [ ] 监控 Secret 的使用模式

**监控和日志**：
- [ ] Runner 进程有健康检查
- [ ] 系统资源（CPU/内存/磁盘）有监控
- [ ] 异常网络连接有告警
- [ ] Job 日志保留足够长的时间

**更新和补丁**：
- [ ] 基础 OS 定期更新安全补丁
- [ ] Runner 版本定期更新
- [ ] 预装工具定期更新
- [ ] 有更新后的回归测试流程
