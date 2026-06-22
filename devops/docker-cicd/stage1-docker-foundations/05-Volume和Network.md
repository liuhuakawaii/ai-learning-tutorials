# 第五课：数据卷与网络

> **课程定位**：掌握容器的持久化存储和网络通信
> **前置知识**：镜像、容器、Dockerfile（第 1-4 课）
> **预计时长**：40 分钟

---

## 场景引入

你用 Docker 跑了一个 PostgreSQL，往里灌了几个 GB 的测试数据，项目跑得很顺利。某天你需要升级 PostgreSQL 版本，`docker rm` 旧容器、`docker run` 新容器——数据全没了。你开始慌了：容器不是应该很方便吗？数据到底存在哪里？怎么才能让数据在容器重建后还在？更进一步，你的 Node.js 应用怎么连接到数据库容器？

---

## 学习目标

完成本课学习后，你将能够：

1. 理解为什么需要 Volume，掌握两种挂载方式
2. 学会用 Bind Mount 实现开发热更新
3. 理解容器间通信的场景和原理
4. 掌握 Docker 自定义网络

---

## 一、为什么需要 Volume

容器是临时的——容器删除后，里面的数据就没了。

```
问题：

  docker run postgres          ← 启动数据库
  ... 写入了一些数据 ...
  docker rm postgres           ← 容器没了
  ... 数据也没了 ...           ← 💀

  容器的可写层随容器生命周期，
  容器删除，数据丢失。
```

---

## 二、Volume 的两种方式

### 2.1 Named Volume（命名卷）

```
┌──────────────┐
│   容器        │
│  /var/lib/    │
│  postgresql/  │──→ ┌──────────────────┐
│              │    │  Named Volume     │
└──────────────┘    │  (pgdata)         │
                    │  Docker 管理的目录  │
                    └──────────────────┘

特点：
  - Docker 自动管理存储位置
  - 容器删除后数据保留
  - 适合数据库等有状态服务
```

```bash
# 创建命名卷
docker volume create pgdata

# 查看所有卷
docker volume ls

# 使用命名卷运行 PostgreSQL
docker run -d \
  --name postgres \
  -v pgdata:/var/lib/postgresql/data \
  -e POSTGRES_PASSWORD=mysecret \
  postgres:14

# 删除卷
docker volume rm pgdata

# 清理未使用的卷
docker volume prune
```

### 2.2 Bind Mount（绑定挂载）

```
┌──────────────┐
│   容器        │
│  /app/        │──→ ┌──────────────────┐
│              │    │  宿主机目录        │
└──────────────┘    │  /home/user/code/ │
                    └──────────────────┘

特点：
  - 直接映射宿主机的目录
  - 容器和宿主机实时同步
  - 适合开发时挂载源代码
```

```bash
# 使用绑定挂载（开发模式）
docker run -d \
  --name my-app \
  -v $(pwd)/src:/app/src \
  -p 3000:3000 \
  node:18-alpine
```

### 2.3 选择建议

```
┌──────────────────┬──────────────────┬──────────────────┐
│   场景            │   推荐方案        │   原因           │
├──────────────────┼──────────────────┼──────────────────┤
│   数据库数据      │   Named Volume   │   数据安全       │
│   Redis 数据      │   Named Volume   │   数据安全       │
│   文件上传        │   Named Volume   │   数据安全       │
│   源代码（开发）   │   Bind Mount     │   实时同步       │
│   配置文件        │   Bind Mount     │   方便修改       │
│   日志文件        │   Bind Mount     │   方便查看       │
└──────────────────┴──────────────────┴──────────────────┘
```

---

## 三、开发热更新：Bind Mount 实战

### 3.1 问题：改代码容器不感知

```
默认情况下，容器内是独立的文件副本。
你在本地改了代码，容器里不会变。

  本地修改 src/index.js
       ↓
  容器里的 src/index.js 还是旧的 💀

  每次改代码都要重新 docker build？
  那开发体验也太差了。
```

### 3.2 解决：挂载源码目录

```bash
docker run -d \
  -v $(pwd)/src:/app/src \
  -w /app \
  -p 3000:3000 \
  node:18-alpine \
  npm run dev
```

```
参数说明：

  ┌──────────────────────┬──────────────────────────────────┐
  │  参数                 │  作用                            │
  ├──────────────────────┼──────────────────────────────────┤
  │  -v $(pwd)/src:/app  │  把本地 src 映射到容器 /app/src  │
  │  -w /app             │  设置容器工作目录                 │
  │  -p 3000:3000        │  端口映射，浏览器能访问           │
  └──────────────────────┴──────────────────────────────────┘
```

### 3.3 为什么能热更新

```
Bind Mount 让本地目录和容器目录实时同步：

  本地 src/index.js  ←──实时同步──→  容器 /app/src/index.js

  你改了文件 → 容器里立刻看到变化
  Vite / Webpack 的 HMR（热模块替换）正常工作
  体验和不用 Docker 完全一样
```

### 3.4 注意事项

```
1. 只有 Bind Mount 能热更新，Named Volume 不行
   - Named Volume 是 Docker 管理的存储，不是映射本地目录
   - Bind Mount 直接映射本地目录，所以能实时同步

2. node_modules 不要挂载
   - 本地是 Windows/macOS，容器是 Linux
   - 原生模块（如 bcrypt）编译结果不同
   - 让容器内自己 npm install

3. macOS/Windows 性能略差
   - 文件系统转换有开销
   - 大项目可能比 Linux 慢
   - Docker Desktop 有 caching 优化选项
```

---

## 四、为什么需要容器间通信

### 4.1 单容器不够用

每个容器通常只跑**一个服务**（Docker 的最佳实践），但项目往往需要多个服务协作：

```
┌─────────────────────────────────────────┐
│           你的应用                        │
│                                          │
│  前端容器（nginx）                        │
│       │ 请求 API                         │
│       ▼                                  │
│  后端容器（Node.js）                      │
│       │ 读写数据                          │
│       ▼                                  │
│  数据库容器（PostgreSQL / Redis）         │
└─────────────────────────────────────────┘

三个容器各自独立，但前端要调后端接口，
后端要查数据库——这就是通信。
```

### 4.2 两种通信方式

```
┌─────────────────────────────────────────────────────────────┐
│  类型          │  方向           │  配置            │  场景  │
├────────────────┼─────────────────┼──────────────────┼────────┤
│  容器间通信     │  容器 ↔ 容器    │  Docker 网络     │  API→DB│
│                │                 │  + 服务名        │        │
├────────────────┼─────────────────┼──────────────────┼────────┤
│  外部访问       │  宿主机 → 容器  │  -p 端口映射     │ 浏览器 │
│                │                 │                  │ →前端  │
└─────────────────────────────────────────────────────────────┘

关键区别：
  容器间通信用服务名当域名，不需要 -p 端口映射
  外部访问需要 -p 映射端口到宿主机
```

### 4.3 实际场景

| 场景 | 容器A | 容器B | 通信方式 |
|------|-------|-------|---------|
| 前后端分离 | nginx | Node.js | 容器网络 |
| 后端 + 数据库 | Node.js | MySQL | 容器网络 |
| 后端 + 缓存 | Node.js | Redis | 容器网络 |
| 微服务架构 | 服务A | 服务B | 容器网络 |
| 用户访问 | 浏览器 | nginx | 端口映射 |

---

## 五、Docker 网络

### 5.1 默认网络的问题

```
默认网络（bridge）：

  ┌─────────────────────────────────────────┐
  │           默认 bridge 网络               │
  │                                          │
  │  ┌────────┐  ┌────────┐  ┌────────┐    │
  │  │ app    │  │postgres│  │ redis  │    │
  │  │ 172.17 │  │ 172.17 │  │ 172.17 │    │
  │  │ .0.2   │  │ .0.3   │  │ .0.4   │    │
  │  └────────┘  └────────┘  └────────┘    │
  └─────────────────────────────────────────┘

  问题：
  - 容器 IP 是动态分配的，重启后会变
  - 只能用 IP 访问，不能用容器名
  - 所有容器都在同一个网络，不安全
```

### 5.2 自定义网络

```
自定义网络的优势：

  ┌─────────────────────────────────────────┐
  │           app-network                    │
  │                                          │
  │  ┌────────┐  ┌────────┐  ┌────────┐    │
  │  │ app    │  │postgres│  │ redis  │    │
  │  │        │  │        │  │        │    │
  │  └────────┘  └────────┘  └────────┘    │
  │      │           │           │          │
  │      └───────────┼───────────┘          │
  │                  │                       │
  │         可以用容器名互相访问               │
  │         app → postgres:5432              │
  │         app → redis:6379                 │
  └─────────────────────────────────────────┘
```

```bash
# 创建自定义网络
docker network create app-network

# 将容器加入网络
docker run -d --name postgres --network app-network postgres:14
docker run -d --name app --network app-network my-app

# 在同一网络中，容器可以用名称互相访问
docker exec -it app ping postgres

# 查看网络详情
docker network inspect app-network

# 删除网络
docker network rm app-network
```

### 5.3 网络隔离

```
自定义网络实现隔离：

  ┌─────────────────────────────────────────┐
  │  frontend 网络                           │
  │  ┌────────┐  ┌────────┐                │
  │  │  app   │  │  nginx  │                │
  │  └────────┘  └────────┘                │
  │       │                                  │
  │  ─────┼────── backend 网络 ─────────── │
  │       │                                  │
  │  ┌────────┐  ┌────────┐                │
  │  │  app   │  │postgres│                │
  │  └────────┘  └────────┘                │
  └─────────────────────────────────────────┘

  nginx 只能访问 app，不能直接访问 postgres
  app 可以访问 postgres
  实现了安全隔离
```

---

## 六、动手练习

### 练习一：Volume 持久化

```bash
# 1. 创建一个命名卷
docker volume create test-data

# 2. 运行 Redis 并挂载卷
docker run -d --name test-redis -v test-data:/data redis:7

# 3. 写入数据
docker exec -it test-redis redis-cli SET mykey "hello"

# 4. 删除容器
docker rm -f test-redis

# 5. 重新创建容器，验证数据是否还在
docker run -d --name test-redis-new -v test-data:/data redis:7
docker exec -it test-redis-new redis-cli GET mykey
# 应该输出 "hello"
```

### 练习二：Bind Mount 热更新

```bash
# 1. 创建一个简单的 Node.js 项目
mkdir bind-test && cd bind-test
echo 'const http = require("http");
http.createServer((req, res) => {
  res.end("Version 1");
}).listen(3000);' > index.js

# 2. 用 Bind Mount 运行
docker run -d -v $(pwd):/app -w /app -p 3000:3000 node:18-alpine node index.js

# 3. 访问
curl http://localhost:3000  # Version 1

# 4. 修改本地文件
# 把 "Version 1" 改成 "Version 2"

# 5. 重启容器，验证变化
docker restart <container-id>
curl http://localhost:3000  # Version 2
```

### 练习三：网络通信

```bash
# 1. 创建自定义网络
docker network create demo-net

# 2. 启动 Redis 容器
docker run -d --name redis --network demo-net redis:7

# 3. 启动临时容器测试连通性
docker run --rm --network demo-net node:18-alpine \
  sh -c "ping -c 2 redis"

# 4. 清理
docker rm -f redis
docker network rm demo-net
```

---

## 参考答案

### 练习一

**思路**：通过实际操作验证 Named Volume 的持久化特性——删除容器后重新挂载同一卷，数据应该还在。

**答案**：

```bash
# 1. 创建命名卷
docker volume create test-data

# 2. 运行 Redis 并挂载卷
docker run -d --name test-redis -v test-data:/data redis:7

# 3. 写入数据
docker exec -it test-redis redis-cli SET mykey "hello"
# 输出：OK

# 4. 验证数据已写入
docker exec -it test-redis redis-cli GET mykey
# 输出："hello"

# 5. 删除容器
docker rm -f test-redis

# 6. 重新创建容器，挂载同一个卷
docker run -d --name test-redis-new -v test-data:/data redis:7

# 7. 验证数据是否还在
docker exec -it test-redis-new redis-cli GET mykey
# 输出："hello" — 数据保留了！
```

**要点**：
- Named Volume 的生命周期独立于容器，容器删除后卷还在
- 重新创建容器时挂载同一个卷名，数据自动恢复
- 这就是为什么数据库必须用 Named Volume——容器可以随时重建，数据不丢失
- 用 `docker volume ls` 查看所有卷，`docker volume rm` 删除卷

### 练习二

**思路**：用 Bind Mount 把本地目录映射到容器，修改本地文件后重启容器验证变化。

**答案**：

```bash
# 1. 创建项目目录和文件
mkdir bind-test && cd bind-test
echo 'const http = require("http");
http.createServer((req, res) => {
  res.end("Version 1");
}).listen(3000);' > index.js

# 2. 用 Bind Mount 运行
docker run -d --name bind-app -v $(pwd):/app -w /app -p 3000:3000 node:18-alpine node index.js

# 3. 访问验证
curl http://localhost:3000
# 输出：Version 1

# 4. 修改本地文件
# 把 index.js 中的 "Version 1" 改成 "Version 2"

# 5. 重启容器（因为是普通 node 进程，需要重启才能加载新代码）
docker restart bind-app

# 6. 验证变化
curl http://localhost:3000
# 输出：Version 2 — 本地修改生效了！
```

**要点**：
- Bind Mount 让本地目录和容器目录实时同步，修改本地文件容器内立刻可见
- 对于使用 nodemon、Vite HMR 等工具的项目，不需要重启容器就能热更新
- `$(pwd)` 是当前目录的绝对路径，Windows 下可以用 `${PWD}` 或完整路径
- 如果用 Express 等框架配合 nodemon，代码修改后会自动重启，体验和本地开发一样

### 练习三

**思路**：创建自定义网络，把容器加入同一网络，验证容器间可以通过容器名互相访问。

**答案**：

```bash
# 1. 创建自定义网络
docker network create demo-net

# 2. 启动 Redis 容器，加入网络
docker run -d --name redis --network demo-net redis:7

# 3. 启动临时容器测试连通性
docker run --rm --network demo-net node:18-alpine \
  sh -c "ping -c 2 redis"
# 输出：PING redis (172.x.x.x): 56 data bytes
#       64 bytes from 172.x.x.x: seq=0 ttl=64 time=0.xxx ms
# 连通了！可以用容器名 redis 访问

# 4. 测试端口连通（用 wget 测试 Redis）
docker run --rm --network demo-net node:18-alpine \
  sh -c "wget -qO- http://redis:6379 || echo 'Redis 不支持 HTTP，但网络是通的'"

# 5. 清理
docker rm -f redis
docker network rm demo-net
```

**要点**：
- 自定义网络中的容器可以用容器名互相访问（如 `redis:6379`）
- 默认 bridge 网络不支持容器名访问，只能用 IP（重启后 IP 会变）
- 容器间通信不需要 `-p` 端口映射，`-p` 是让宿主机访问容器用的
- 实际项目中，应用代码里数据库连接地址写容器名（如 `postgres://user:pass@postgres:5432/db`）

---

## 常见误区

- **"容器重启数据就没了"**：容器重启（`docker restart`）数据不会丢，数据在容器的可写层。只有 `docker rm` 删除容器后，可写层的数据才会丢失。用 Volume 持久化就能解决。
- **"Bind Mount 和 Named Volume 一样"**：Bind Mount 直接映射宿主机目录，适合开发时挂载源码；Named Volume 由 Docker 管理，适合数据库等有状态服务。两者用途不同，不能混用。
- **"容器间通信用 localhost"**：每个容器有自己的网络命名空间，`localhost` 指向容器自身。容器间通信应该用 Docker 网络 + 服务名（如 `postgres:5432`）。
- **"端口映射是容器间通信的方式"**：`-p` 端口映射是让宿主机访问容器的方式，不是容器之间通信用的。容器间通信通过 Docker 自定义网络实现。

---

## 工程建议

- **数据库必须用 Named Volume**：任何有状态服务（数据库、缓存、文件存储）都应该挂载 Named Volume，不要把数据存在容器可写层。
- **开发时用 Bind Mount 挂载源码**：配合 nodemon、Vite HMR 等工具，实现代码热更新，开发体验和不用 Docker 一样。
- **为不同环境创建不同的网络**：开发、测试、生产环境用不同的 Docker 网络，避免意外的跨环境通信。
- **node_modules 不要 Bind Mount**：本地是 macOS/Windows，容器是 Linux，原生模块编译结果不同。让容器内自己 `npm install`，或用 Named Volume 缓存 node_modules。

---

## 小结

1. **Named Volume**：数据库等有状态服务的持久化首选，容器删除后数据保留
2. **Bind Mount**：开发环境挂载源码，实现代码热更新
3. **容器间通信**：每个容器跑一个服务，通过 Docker 网络 + 服务名互相访问
4. **自定义网络**：支持容器名访问（替代 IP），实现网络隔离
5. **两种通信**：容器间用网络，外部访问用端口映射

---

## 下一课预告

下一课我们将学习镜像安全基础——如何让镜像更安全、以非 root 用户运行容器。
