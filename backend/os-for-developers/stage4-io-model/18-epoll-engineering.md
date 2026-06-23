# epoll 的工程实现——ET vs LT、惊群问题、io_uring

## LT 还是 ET

水平触发（LT）和边缘触发（ET）的选择不只是性能问题，更是可靠性问题。

**LT 的行为**：
- fd 有数据可读 → `epoll_wait` 返回
- 你读了一部分，还剩一部分 → 下次 `epoll_wait` 继续返回
- 编程简单：不读完也没关系

**ET 的行为**：
- fd 有数据可读 → `epoll_wait` 返回一次
- 你读了一部分，还剩一部分 → 下次 `epoll_wait` 不再返回（除非有新数据到达）
- 必须用非阻塞 fd，循环读取直到 EAGAIN

```c
// ET 模式的正确读取方式
void et_read(int epfd, int fd) {
    char buf[4096];
    while (1) {
        int n = read(fd, buf, sizeof(buf));
        if (n == -1) {
            if (errno == EAGAIN) {
                // 数据读完了
                break;
            }
            perror("read");
            break;
        } else if (n == 0) {
            // 对端关闭
            close(fd);
            break;
        }
        // 处理数据
        process_data(buf, n);
    }
}
```

**建议**：除非你能确保一次性读完所有数据，否则用 LT。ET 的性能优势在大多数场景下可以忽略（`epoll_wait` 的开销很小），但 ET 的 bug 更难调试。

```bash
# 用 strace 观察 LT 和 ET 的行为差异
strace -e trace=epoll_wait,read ./lt_server
strace -e trace=epoll_wait,read ./et_server
```

## 惊群问题（Thundering Herd）

当多个线程同时阻塞在 `epoll_wait` 上，一个事件到来时，所有线程都被唤醒，但只有一个能处理事件。其他线程白白醒来又重新睡眠——这就是惊群。

```c
// 多线程 epoll 服务器（有惊群问题）
void *worker(void *arg) {
    int epfd = *(int *)arg;
    struct epoll_event events[100];
    while (1) {
        int nfds = epoll_wait(epfd, events, 100, -1);
        for (int i = 0; i < nfds; i++) {
            handle_event(events[i].data.fd);
        }
    }
}

// 主线程
int epfd = epoll_create1(0);
for (int i = 0; i < num_threads; i++) {
    pthread_create(&threads[i], NULL, worker, &epfd);
}
```

Linux 3.9+ 引入了 `EPOLLEXCLUSIVE` 和 `SO_REUSEPORT` 来解决惊群：

### 方案一：EPOLLEXCLUSIVE

```c
struct epoll_event ev;
ev.events = EPOLLIN | EPOLLEXCLUSIVE;
ev.data.fd = listenfd;
epoll_ctl(epfd, EPOLL_CTL_ADD, listenfd, &ev);
```

`EPOLLEXCLUSIVE` 确保只有一个线程被唤醒。

### 方案二：SO_REUSEPORT

```c
int opt = 1;
setsockopt(listenfd, SOL_SOCKET, SO_REUSEPORT, &opt, sizeof(opt));

// 每个线程创建自己的 socket，绑定同一个端口
// 内核在多个 socket 之间负载均衡连接
```

```bash
# 用 strace 观察惊群
strace -e trace=epoll_wait,accept -f ./thundering_herd_server &

# 发送一个连接请求
echo "hello" | nc localhost 8080

# 观察：是否多个线程都被唤醒
```

## epoll 的内核实现

epoll 在内核中维护了两个数据结构：

1. **红黑树**：存储所有注册的 fd（O(log n) 的增删改查）
2. **就绪链表**：存储就绪的 fd（O(1) 的插入和取出）

当 `epoll_ctl(ADD)` 时，fd 被插入红黑树，并注册一个回调函数。当 fd 就绪时，回调函数将 fd 加入就绪链表。`epoll_wait` 只需要检查就绪链表是否为空。

这就是为什么 epoll 在大量连接但少量活跃时效率极高——它只处理就绪的 fd。

## io_uring：下一代异步 I/O

io_uring 是 Linux 5.1 引入的异步 I/O 接口，解决了 epoll + read/write 的一个根本问题：每次 I/O 都需要一次系统调用。

io_uring 的核心：共享内存的提交队列（SQ）和完成队列（CQ）。

```
用户态                          内核态
┌──────────┐    提交 I/O      ┌──────────┐
│  SQ 环形  │ ──────────────→ │  内核处理 │
│   队列    │                  │   I/O    │
└──────────┘                  └────┬─────┘
       ↑                           │
       │         完成通知           │
┌──────┴─────┐ ←──────────────────┘
│  CQ 环形   │
│   队列     │
└────────────┘
```

优势：
- **减少系统调用**：批量提交 I/O 请求，不需要每次都 syscall
- **零拷贝**：SQ 和 CQ 通过 mmap 共享内存
- **真正的异步**：提交后不等待，完成后从 CQ 读取结果

```c
// io_uring 示例（简化版）
#include <liburing.h>

struct io_uring ring;
io_uring_queue_init(256, &ring, 0);

// 提交读请求
struct io_uring_sqe *sqe = io_uring_get_sqe(&ring);
io_uring_prep_read(sqe, fd, buf, size, 0);
io_uring_submit(&ring);

// 等待完成
struct io_uring_cqe *cqe;
io_uring_wait_cqe(&ring, &cqe);
int result = cqe->res;
io_uring_cqe_seen(&ring, cqe);
```

```bash
# 检查内核是否支持 io_uring
cat /proc/version | grep -E "5\.[1-9]|5\.[1-9][0-9]|[6-9]\."
```

## epoll vs io_uring

| 维度 | epoll + read/write | io_uring |
|------|-------------------|----------|
| 系统调用次数 | 每次 I/O 一次 | 批量提交 |
| 异步程度 | 半同步（read 阻塞） | 完全异步 |
| 文件 I/O | 不支持（只支持网络 fd） | 支持 |
| 内核版本要求 | 2.6+ | 5.1+ |
| 编程复杂度 | 中等 | 较高 |

io_uring 是未来，但 epoll 在当前生产环境中仍然是主流。

## 练习

### 练习一：实现一个 ET 模式的回显服务器

```c
// 要求：
// 1. 使用 epoll ET 模式
// 2. 非阻塞 socket
// 3. 循环读取直到 EAGAIN
// 4. 处理 partial write
```

用 strace 验证 ET 的行为：只在数据到达时通知一次。

### 练习二：用 strace 观察 SO_REUSEPORT

```bash
# 启动多个进程监听同一端口
./reuseport_server 8080 &
./reuseport_server 8080 &

# 发送多个连接
for i in $(seq 1 100); do
    echo "hello" | nc localhost 8080 &
done

# 用 strace 观察连接分布
strace -e trace=accept -p <pid1> &
strace -e trace=accept -p <pid2> &
```

---

## 参考答案

### 练习一

关键代码：

```c
void set_nonblocking(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);
}

void handle_read(int fd) {
    char buf[4096];
    while (1) {
        int n = read(fd, buf, sizeof(buf));
        if (n == -1) {
            if (errno == EAGAIN) break;
            perror("read");
            close(fd);
            break;
        }
        if (n == 0) {
            close(fd);
            break;
        }
        // 处理 partial write
        int sent = 0;
        while (sent < n) {
            int w = write(fd, buf + sent, n - sent);
            if (w == -1) {
                if (errno == EAGAIN) continue;
                close(fd);
                return;
            }
            sent += w;
        }
    }
}
```

### 练习二

**预期结果**：连接大致均匀分布在两个进程上。内核用 hash 算法将每个连接分配给一个 socket，避免了惊群问题。
