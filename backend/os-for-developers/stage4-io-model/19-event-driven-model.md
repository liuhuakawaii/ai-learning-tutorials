# 事件驱动模型——Node.js/libuv、Nginx 的 I/O 模型

## 事件驱动的本质

事件驱动不是一种新技术，而是一种编程范式：不主动去检查状态，而是注册回调，等事件发生时被通知。

```
传统模型：
while (true) {
    if (fd 有数据) {  // 主动检查
        处理数据;
    }
}

事件驱动模型：
注册回调(fd, 处理数据);  // 被动等待
进入事件循环;
// 事件发生时，回调被调用
```

## Node.js 的 I/O 模型

Node.js 单线程处理所有 I/O，底层由 libuv 实现。libuv 在不同平台使用不同的 I/O 多路复用机制：
- Linux：epoll
- macOS：kqueue
- Windows：IOCP

```javascript
// Node.js 的 I/O 是非阻塞的
const fs = require('fs');

// 这个 read 不会阻塞主线程
fs.readFile('/tmp/file.txt', (err, data) => {
    console.log(data.toString());
});

console.log('这行先执行');
```

用 strace 观察 Node.js：

```bash
cat > /tmp/node_io.js << 'EOF'
const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
    fs.readFile('/tmp/file.txt', (err, data) => {
        res.writeHead(200);
        res.end(data);
    });
});

server.listen(3000);
EOF

strace -e trace=epoll_wait,read,write,openat -f node /tmp/node_io.js
```

你会看到：
- 主线程在 `epoll_wait` 上等待
- 有请求到来时，`epoll_wait` 返回
- 文件 I/O 通过线程池处理（libuv 默认 4 个线程）

## libuv 的架构

libuv 的事件循环是 Node.js 的心脏。每个 tick 的流程：

```
1. 执行到期的定时器回调
2. 执行待处理的 I/O 回调
3. 执行 idle 回调
4. 执行 prepare 回调
5. 轮询 I/O（epoll_wait）
6. 执行 check 回调
7. 执行 close 回调
8. 如果还有活跃的句柄，回到步骤 1
```

```bash
# 用 strace 观察事件循环的系统调用
strace -e trace=epoll_wait,timerfd_settime,read -f node /tmp/node_io.js 2>&1 | head -50
```

## Nginx 的 I/O 模型

Nginx 使用 master-worker 架构，每个 worker 进程运行一个事件循环：

```
master 进程
  ├── worker 进程 1（事件循环）
  ├── worker 进程 2（事件循环）
  └── worker 进程 3（事件循环）
```

每个 worker 进程：
1. 调用 `epoll_wait` 等待事件
2. 处理连接请求（accept）
3. 读取请求数据
4. 处理请求（可能涉及 upstream 连接）
5. 发送响应
6. 回到步骤 1

```bash
# 查看 Nginx 的 worker 进程
ps aux | grep nginx

# 用 strace 观察 worker 进程
strace -e trace=epoll_wait,accept,read,write -p <nginx_worker_pid>
```

Nginx 的关键设计：
- **非阻塞 + 事件驱动**：单个 worker 可以处理数千个连接
- **SO_REUSEPORT**：多个 worker 共享监听端口
- **sendfile**：直接从文件发送到 socket，不经过用户空间

```bash
# 查看 Nginx 是否使用 sendfile
strace -e trace=sendfile -p <nginx_worker_pid>

# 查看 Nginx 的连接状态
ss -tnp | grep nginx
```

## 事件驱动 vs 多线程

| 维度 | 事件驱动 | 多线程 |
|------|----------|--------|
| 线程数 | 少（通常 1 个 I/O 线程） | 多（每个连接一个线程） |
| 上下文切换 | 少 | 多 |
| CPU 利用率 | 适合 I/O 密集型 | 适合 CPU 密集型 |
| 编程复杂度 | 回调地狱 | 竞态条件 |
| 调试难度 | 高（异步调用栈） | 中（线程模型成熟） |

**关键区别**：事件驱动不是不用线程，而是把线程数控制得很少。Node.js 用 1 个主线程 + 4 个 I/O 线程。Nginx 的每个 worker 是一个进程。

## 用 strace 对比 Node.js 和 Nginx

```bash
# Node.js
strace -e trace=epoll_wait,read,write,openat -f node /tmp/node_server.js 2>&1 | head -50

# Nginx
strace -e trace=epoll_wait,accept,read,write -p <nginx_pid> 2>&1 | head -50
```

关键差异：
- Node.js 的文件 I/O 经过线程池（看到 `futex` 系统调用）
- Nginx 的文件 I/O 可能直接在 worker 进程中（sendfile 不经过用户空间）

## 实战：用 strace 诊断 Node.js 性能问题

场景：Node.js 服务响应变慢。

```bash
# 1. 观察系统调用耗时
strace -c -p <node_pid> -e trace=all &
# 发送一些请求，然后 Ctrl+C

# 2. 分析耗时最长的系统调用
# 如果 futex 占比高 → 线程池争用
# 如果 epoll_wait 占比高 → 没有 I/O 事件，可能是上游服务慢
# 如果 read/write 占比高 → I/O 本身慢

# 3. 用 --prof 分析 JavaScript 层
node --prof /tmp/node_server.js
node --prof-process isolate-*.log > profile.txt
```

## 练习

### 练习一：用 strace 观察 Node.js 的线程池

```bash
strace -e trace=futex,epoll_wait,read,write -f node -e "
const http = require('http');
const fs = require('fs');
const server = http.createServer((req, res) => {
    fs.readFile('/etc/passwd', (err, data) => {
        res.writeHead(200);
        res.end('ok');
    });
});
server.listen(3000);
" &
```

发送请求后观察：`futex` 系统调用对应线程池的工作。

### 练习二：对比事件驱动和多线程服务器的系统调用

```bash
# 事件驱动（epoll）
strace -c -e trace=epoll_wait,accept,read,write ./epoll_server &

# 多线程
strace -c -e trace=accept,read,write,clone,futex ./threadpool_server &

# 分别发送 1000 个请求
ab -n 1000 -c 100 http://localhost:8080/
```

---

## 参考答案

### 练习一

**预期结果**：
- 主线程在 `epoll_wait` 上等待连接
- 每个文件读取请求会触发 `futex` 调用（通知线程池）
- libuv 默认 4 个线程处理文件 I/O
- 如果并发文件读取超过 4 个，会看到 `futex` 等待

### 练习二

**预期结果**：
- 事件驱动版本：少量系统调用（主要是 epoll_wait）
- 多线程版本：大量的 `clone`（创建线程）和 `futex`（同步）
- 事件驱动版本的上下文切换更少
