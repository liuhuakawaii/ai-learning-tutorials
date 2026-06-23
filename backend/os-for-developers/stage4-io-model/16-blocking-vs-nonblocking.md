# 阻塞 vs 非阻塞 I/O——系统调用层面的区别

## 一个让人困惑的问题

很多开发者分不清"阻塞 I/O"和"非阻塞 I/O"。它们的区别不在于数据是否准备好，而在于当数据没准备好时，系统调用是等还是不等。

## 阻塞 I/O

默认情况下，socket 和文件描述符是阻塞模式。当进程调用 `read()` 读取一个空的 socket 时：

1. 进程进入内核态
2. 内核发现 socket 接收缓冲区为空
3. 进程被标记为 SLEEPING，放入等待队列
4. 内核调度其他进程运行
5. 数据到达后，内核唤醒进程
6. 进程从 `read()` 返回，拿到数据

```c
// 阻塞读取
char buf[1024];
int n = read(sockfd, buf, sizeof(buf));
// 如果缓冲区为空，进程在这里阻塞，直到数据到达
printf("收到 %d 字节\n", n);
```

用 strace 观察：

```bash
strace -e trace=read ./blocking_server
```

如果客户端没有发送数据，`read` 系统调用会一直卡着不返回。

## 非阻塞 I/O

通过 `fcntl` 设置 `O_NONBLOCK` 标志，`read()` 在数据没准备好时立即返回 -1，errno 设为 `EAGAIN`。

```c
#include <fcntl.h>
#include <errno.h>

// 设置非阻塞
int flags = fcntl(sockfd, F_GETFL, 0);
fcntl(sockfd, F_SETFL, flags | O_NONBLOCK);

char buf[1024];
int n = read(sockfd, buf, sizeof(buf));
if (n == -1 && errno == EAGAIN) {
    // 数据没准备好，可以去做别的事
    printf("数据还没到\n");
} else if (n > 0) {
    printf("收到 %d 字节\n", n);
}
```

非阻塞 I/O 的问题是：进程需要不断轮询（polling），检查数据是否准备好。这会浪费 CPU。

## 两者的对比

```
阻塞 I/O：
进程 ─── read() ─── [等待] ─── [数据到达] ─── read() 返回

非阻塞 I/O：
进程 ─── read() ─── [EAGAIN] ─── [做别的事] ─── read() ─── [EAGAIN] ─── ...
```

| 维度 | 阻塞 I/O | 非阻塞 I/O |
|------|----------|-----------|
| 数据没就绪时 | 进程睡眠 | 立即返回 EAGAIN |
| CPU 利用率 | 高（不浪费在轮询上） | 低（需要不断轮询） |
| 编程复杂度 | 简单 | 复杂（需要循环检查） |
| 适用场景 | 单连接、低并发 | 配合 I/O 多路复用 |

## 实际的 I/O 模型演进

单独使用阻塞或非阻塞 I/O 都有问题：
- 阻塞 I/O：一个连接一个线程/进程，高并发时开销大
- 非阻塞 I/O：轮询浪费 CPU

解决方案是 I/O 多路复用（select/poll/epoll），它结合了两者的优点：
- 用一个线程监控多个文件描述符
- 当有数据就绪时才去读取（非阻塞）
- 没有数据就绪时线程睡眠（不浪费 CPU）

```bash
# 观察一个典型的 I/O 多路复用程序
strace -e trace=epoll_wait,read,write ./epoll_server
```

## 用 strace 对比阻塞和非阻塞行为

写一个简单的 echo 服务器，分别用阻塞和非阻塞模式：

```c
// 阻塞版本
void blocking_echo(int client_fd) {
    char buf[1024];
    int n;
    while ((n = read(client_fd, buf, sizeof(buf))) > 0) {
        write(client_fd, buf, n);
    }
}
```

```bash
# 跟踪阻塞版本
strace -e trace=read,write,accept ./blocking_echo &
telnet localhost 8080
# 输入一些文字，观察 strace 输出
```

```c
// 非阻塞版本（需要配合 epoll）
void nonblocking_echo(int client_fd) {
    char buf[1024];
    int n = read(client_fd, buf, sizeof(buf));
    if (n > 0) {
        write(client_fd, buf, n);
    } else if (n == -1 && errno == EAGAIN) {
        // 数据没准备好，等 epoll 通知
    }
}
```

```bash
# 跟踪非阻塞版本
strace -e trace=epoll_wait,read,write,accept ./epoll_echo &
```

关键差异：
- 阻塞版本：`read` 可能长时间不返回
- 非阻塞版本：`read` 立即返回，配合 `epoll_wait` 等待就绪事件

## socket 缓冲区

每个 socket 有两个缓冲区：发送缓冲区和接收缓冲区。

```bash
# 查看 socket 缓冲区大小
cat /proc/sys/net/core/rmem_default  # 接收缓冲区默认大小
cat /proc/sys/net/core/wmem_default  # 发送缓冲区默认大小
cat /proc/sys/net/core/rmem_max      # 接收缓冲区最大大小
cat /proc/sys/net/core/wmem_max      # 发送缓冲区最大大小

# 查看 TCP 缓冲区
cat /proc/sys/net/ipv4/tcp_rmem      # min default max
cat /proc/sys/net/ipv4/tcp_wmem      # min default max
```

```bash
# 查看当前连接的缓冲区使用
ss -tnmp | grep <pid>
```

当接收缓冲区满时：
- 阻塞模式：`read` 阻塞
- 非阻塞模式：`read` 返回 EAGAIN

当发送缓冲区满时：
- 阻塞模式：`write` 阻塞
- 非阻塞模式：`write` 返回 EAGAIN

## 练习

### 练习一：用 strace 观察阻塞行为

写一个简单的 TCP 服务器，用阻塞 `accept` 和 `read`。用 strace 跟踪：
1. 无连接时 `accept` 的行为
2. 连接建立但无数据时 `read` 的行为
3. 客户端发送数据后 `read` 的返回

```bash
strace -e trace=accept,read,write -o trace.log ./blocking_server &
./test_client
```

### 练习二：设置非阻塞并观察 EAGAIN

```c
// 创建一个非阻塞 socket，尝试读取
// 观察 read 返回 -1 且 errno = EAGAIN
```

```bash
strace -e trace=read ./nonblocking_test
```

---

## 参考答案

### 练习一

**预期结果**：
- 无连接时 `accept` 阻塞不返回
- 连接建立但无数据时 `read` 阻塞不返回
- 客户端发送数据后 `read` 立即返回，值为数据长度

### 练习二

**预期结果**：
- strace 显示 `read(3, ..., 1024) = -1 EAGAIN (Resource temporarily unavailable)`
- 程序不会卡住，可以继续执行其他逻辑

**关键教训**：非阻塞 I/O 单独使用时需要轮询，效率低。实际开发中总是配合 I/O 多路复用使用。
