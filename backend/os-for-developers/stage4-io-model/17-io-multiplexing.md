# I/O 多路复用——select/poll/epoll 的演进

## 为什么需要 I/O 多路复用

一个 Web 服务器需要同时处理成千上万个连接。每个连接可能随时有数据到达，但大部分时间是空闲的。

如果用阻塞 I/O，一个线程只能处理一个连接：
```
线程 1 ─── read(conn1) ─── [阻塞等待]
线程 2 ─── read(conn2) ─── [阻塞等待]
...
线程 N ─── read(connN) ─── [阻塞等待]
```

如果用非阻塞 I/O 轮询，浪费 CPU：
```
while (true) {
    for (fd : all_fds) {
        read(fd, buf, size);  // 如果没数据返回 EAGAIN
    }
}
```

I/O 多路复用让一个线程同时监控多个文件描述符，只在有数据就绪时才去读取。

## select

`select` 是最早的 I/O 多路复用接口（1983 年，BSD）。

```c
#include <sys/select.h>

fd_set readfds;
FD_ZERO(&readfds);
FD_SET(sockfd1, &readfds);
FD_SET(sockfd2, &readfds);

int maxfd = sockfd2 + 1;
struct timeval timeout = {5, 0};  // 5 秒超时

int ready = select(maxfd, &readfds, NULL, NULL, &timeout);
if (ready > 0) {
    for (int fd = 0; fd < maxfd; fd++) {
        if (FD_ISSET(fd, &readfds)) {
            // fd 有数据可读
            char buf[1024];
            int n = read(fd, buf, sizeof(buf));
        }
    }
}
```

select 的问题：

1. **fd_set 大小限制**：默认 FD_SETSIZE = 1024，不能监控超过 1024 个文件描述符
2. **每次调用都要复制整个 fd_set**：从用户空间复制到内核空间
3. **返回后需要遍历所有 fd**：O(n) 的时间复杂度
4. **内核实现**：每次调用都要遍历所有 fd 检查状态

```bash
# 用 strace 观察 select
strace -e trace=select ./select_server
```

## poll

`poll` 解决了 select 的 fd 数量限制：

```c
#include <poll.h>

struct pollfd fds[2];
fds[0].fd = sockfd1;
fds[0].events = POLLIN;
fds[1].fd = sockfd2;
fds[1].events = POLLIN;

int ready = poll(fds, 2, 5000);  // 5 秒超时
if (ready > 0) {
    for (int i = 0; i < 2; i++) {
        if (fds[i].revents & POLLIN) {
            char buf[1024];
            int n = read(fds[i].fd, buf, sizeof(buf));
        }
    }
}
```

poll 的改进：
- 没有 fd 数量限制（用数组代替位图）
- 事件和返回分离（events 和 revents）

poll 的问题：
- 仍然需要每次调用都复制整个数组
- 仍然需要遍历所有 fd
- 时间复杂度仍然是 O(n)

```bash
strace -e trace=poll ./poll_server
```

## epoll

epoll 是 Linux 特有的 I/O 多路复用机制（2.6 内核引入），解决了 select/poll 的性能问题。

核心思想：用一个 epoll 实例管理所有 fd，fd 注册一次，多次等待。

```c
#include <sys/epoll.h>

// 创建 epoll 实例
int epfd = epoll_create1(0);

// 注册感兴趣的 fd
struct epoll_event ev;
ev.events = EPOLLIN;
ev.data.fd = sockfd1;
epoll_ctl(epfd, EPOLL_CTL_ADD, sockfd1, &ev);

ev.data.fd = sockfd2;
epoll_ctl(epfd, EPOLL_CTL_ADD, sockfd2, &ev);

// 等待事件
struct epoll_event events[100];
int nfds = epoll_wait(epfd, events, 100, 5000);
for (int i = 0; i < nfds; i++) {
    char buf[1024];
    int n = read(events[i].data.fd, buf, sizeof(buf));
}
```

epoll 的优势：
- **fd 注册一次**：不需要每次调用都复制
- **事件驱动**：只返回就绪的 fd，不需要遍历所有 fd
- **O(1) 的就绪通知**：内核用回调机制，当 fd 就绪时加入就绪链表

```bash
strace -e trace=epoll_create,epoll_ctl,epoll_wait ./epoll_server
```

## 三种方式的性能对比

| 维度 | select | poll | epoll |
|------|--------|------|-------|
| 最大 fd 数 | 1024 | 无限制 | 无限制 |
| fd 复制 | 每次调用 | 每次调用 | 注册一次 |
| 就绪通知 | 遍历所有 fd | 遍历所有 fd | 只返回就绪 fd |
| 时间复杂度 | O(n) | O(n) | O(1) |
| 触发模式 | 水平触发 | 水平触发 | LT/ET |

当连接数少（< 100）时，三者性能差异不大。当连接数多（> 1000）时，epoll 优势明显。

## 水平触发 vs 边缘触发

epoll 支持两种触发模式：

**水平触发（LT，默认）**：
- 只要 fd 可读/可写，每次 `epoll_wait` 都会返回
- 编程简单，但可能重复通知

**边缘触发（ET）**：
- 只在 fd 状态变化时通知一次
- 必须用非阻塞 fd，并一次性读完所有数据
- 性能更好，但编程更复杂

```c
// 边缘触发
ev.events = EPOLLIN | EPOLLET;
epoll_ctl(epfd, EPOLL_CTL_ADD, sockfd, &ev);
```

```bash
# 用 strace 观察触发模式的差异
strace -e trace=epoll_wait,read ./lt_server &
strace -e trace=epoll_wait,read ./et_server &
```

## 练习

### 练习一：用 strace 对比 select 和 epoll

分别用 select 和 epoll 实现一个简单的回显服务器，用 strace 对比系统调用行为：

```bash
strace -e trace=select,read,write ./select_echo &
strace -e trace=epoll_wait,epoll_ctl,read,write ./epoll_echo &
```

### 练习二：观察 epoll 的就绪通知

```bash
# 启动 epoll 服务器
./epoll_server &

# 用多个客户端连接
for i in $(seq 1 10); do
    echo "hello $i" | nc localhost 8080 &
done

# 用 strace 观察 epoll_wait 返回的事件数
strace -e trace=epoll_wait -p <pid>
```

---

## 参考答案

### 练习一

**预期结果**：
- select 版本：每次有新连接或数据，都调用 `select` 传递完整的 fd 集合
- epoll 版本：`epoll_ctl` 只在连接建立/断开时调用，`epoll_wait` 不传递 fd 集合

### 练习二

**预期结果**：
- 水平触发模式：如果一个 fd 有数据未读完，下次 `epoll_wait` 会再次返回该 fd
- 边缘触发模式：`epoll_wait` 只在数据刚到达时返回一次，之后不再通知（除非有新数据）
