# 第二课：VPS 基础

> **课程定位**：学会初始化和配置一台 Linux 服务器
> **前置知识**：基本的命令行操作
> **预计时长**：30 分钟

---

## 学习目标

1. 创建并连接 VPS
2. 完成服务器初始化配置
3. 安装 Docker 和 Docker Compose
4. 配置基本安全设置

---

## 一、创建 VPS

```
推荐配置（DigitalOcean 示例）：

  镜像：Ubuntu 22.04 LTS
  规格：$6/月（1 CPU, 1GB RAM, 25GB SSD）
  地区：选择离目标用户近的区域
  认证：SSH Key（推荐）或密码
```

---

## 二、服务器初始化

### 2.1 连接服务器

```bash
# 使用 SSH 连接
ssh root@your-server-ip

# 或者使用 SSH Key
ssh -i ~/.ssh/id_rsa root@your-server-ip
```

### 2.2 系统更新

```bash
# 更新系统
apt update && apt upgrade -y

# 安装常用工具
apt install -y curl wget git vim ufw
```

### 2.3 创建普通用户

```bash
# 创建用户
adduser deploy

# 添加到 sudo 组
usermod -aG sudo deploy

# 配置 SSH Key
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2.4 禁用 root 登录

```bash
# 编辑 SSH 配置
vim /etc/ssh/sshd_config

# 修改以下配置：
PermitRootLogin no
PasswordAuthentication no

# 重启 SSH
systemctl restart sshd
```

### 2.5 配置防火墙

```bash
# 启用 UFW
ufw default deny incoming
ufw default allow outgoing

# 允许 SSH
ufw allow ssh

# 允许 HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# 启用防火墙
ufw enable

# 查看状态
ufw status
```

---

## 三、安装 Docker

### 3.1 安装 Docker

```bash
# 安装依赖
apt install -y ca-certificates curl gnupg

# 添加 Docker GPG Key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# 添加仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 将用户添加到 docker 组
usermod -aG docker deploy

# 验证安装
docker --version
docker compose version
```

### 3.2 配置 Docker

```bash
# 创建 Docker 配置目录
mkdir -p /etc/docker

# 配置日志和存储驱动
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# 重启 Docker
systemctl restart docker
```

---

## 四、项目部署目录

```bash
# 创建项目目录
mkdir -p /opt/my-app
chown deploy:deploy /opt/my-app

# 切换到 deploy 用户
su - deploy
```

---

## 五、验证

```bash
# 验证 Docker
docker run hello-world

# 验证 Docker Compose
docker compose version

# 验证用户权限
docker ps
```

---

## 六、常用运维命令

```bash
# 系统信息
uname -a
df -h
free -h
top

# 服务管理
systemctl status docker
systemctl restart docker

# Docker
docker ps
docker images
docker stats
```

---

## 小结

1. **初始化**：更新系统、创建用户、配置 SSH
2. **安全**：禁用 root 登录、配置防火墙、使用 SSH Key
3. **Docker**：官方源安装、配置日志限制
4. **目录**：/opt/my-app 作为项目目录

---

## 下一课预告

下一课我们将学习 Nginx 反向代理——如何把域名指向容器服务。
