# 阶段实战：用 epoll 实现一个简单的 TCP 服务器

## 目标

从零实现一个基于 epoll 的 TCP 回显服务器，理解事件驱动编程的完整流程。

## 完整实现

```c
// epoll_echo.c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/epoll.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define MAX_EVENTS 1024
#define BUF_SIZE 4096

static void set_nonblocking(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);
}

static int create_listenfd(int port) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons(port),
        .sin_addr.s_addr = INADDR_ANY
    };
    bind(fd, (struct sockaddr *)&addr, sizeof(addr));
    listen(fd, 128);
    return fd;
}

static void handle_read(int epfd, int fd) {
    char buf[BUF_SIZE];
    while (1) {
        int n = read(fd, buf, sizeof(buf));
        if (n == -1) {
            if (errno == EAGAIN) break;  // 数据读完
            perror("read");
            break;
        }
        if (n == 0) {
            // 客户端关闭
            epoll_ctl(epfd, EPOLL_CTL_DEL, fd, NULL);
            close(fd);
            printf("客户端 %d 断开\n", fd);
            break;
        }
        // 回显
        int sent = 0;
        while (sent < n) {
            int w = write(fd, buf + sent, n - sent);
            if (w == -1) {
                if (errno == EAGAIN) continue;
                perror("write");
                epoll_ctl(epfd, EPOLL_CTL_DEL, fd, NULL);
                close(fd);
                return;
            }
            sent += w;
        }
    }
}

int main(int argc, char *argv[]) {
    int port = argc > 1 ? atoi(argv[1]) : 8080;
    int listenfd = create_listenfd(port);
    set_nonblocking(listenfd);

    int epfd = epoll_create1(0);

    struct epoll_event ev;
    ev.events = EPOLLIN;
    ev.data.fd = listenfd;
    epoll_ctl(epfd, EPOLL_CTL_ADD, listenfd, &ev);

    struct epoll_event events[MAX_EVENTS];
    printf("服务器监听 :%d\n", port);

    while (1) {
        int nfds = epoll_wait(epfd, events, MAX_EVENTS, -1);
        for (int i = 0; i < nfds; i++) {
            int fd = events[i].data.fd;
            if (fd == listenfd) {
                // 新连接
                struct sockaddr_in client_addr;
                socklen_t len = sizeof(client_addr);
                int client_fd = accept(listenfd, (struct sockaddr *)&client_addr, &len);
                if (client_fd == -1) {
                    perror("accept");
                    continue;
                }
                set_nonblocking(client_fd);
                ev.events = EPOLLIN | EPOLLET;
                ev.data.fd = client_fd;
                epoll_ctl(epfd, EPOLL_CTL_ADD, client_fd, &ev);
                printf("新连接: fd=%d, addr=%s:%d\n",
                       client_fd,
                       inet_ntoa(client_addr.sin_addr),
                       ntohs(client_addr.sin_port));
            } else {
                // 数据到达
                handle_read(epfd, fd);
            }
        }
    }

    close(epfd);
    close(listenfd);
    return 0;
}
```

编译运行：

```bash
gcc -o epoll_echo epoll_echo.c
./epoll_echo 8080
```

## 用 strace 验证

```bash
# 跟踪服务器的系统调用
strace -e trace=epoll_wait,accept,read,write,close,fcntl -f ./epoll_echo 8080 &

# 发送测试请求
echo "hello" | nc localhost 8080
```

观察系统调用序列：

```
epoll_wait(3, {}, 1024, -1)             = 0
# 新连接到来
epoll_wait(3, {{EPOLLIN, {fd=4}}}, 1024, -1) = 1
accept(4, {sa_family=AF_INET, ...}, [16]) = 5
fcntl(5, F_GETFL)                       = 0x2
fcntl(5, F_SETFL, O_RDWR|O_NONBLOCK)   = 0
epoll_ctl(3, EPOLL_CTL_ADD, 5, {EPOLLIN|EPOLLET, {fd=5}}) = 0
# 数据到达
epoll_wait(3, {{EPOLLIN, {fd=5}}}, 1024, -1) = 1
read(5, "hello\n", 4096)                = 6
write(5, "hello\n", 6)                  = 6
read(5, "", 4096)                       = -1 EAGAIN
# 客户端关闭
epoll_wait(3, {{EPOLLIN|EPOLLHUP, {fd=5}}}, 1024, -1) = 1
read(5, "", 4096)                       = 0
epoll_ctl(3, EPOLL_CTL_DEL, 5, NULL)    = 0
close(5)                                = 0
```

## 用 perf 分析性能

```bash
# 压力测试
ab -n 100000 -c 500 http://localhost:8080/ &

# 用 perf 分析
perf top -p <pid>
```

观察热点函数：
- `epoll_wait`：事件等待
- `read`/`write`：数据读写
- `accept`：接受连接

## 用 /proc 观察运行状态

```bash
# 查看打开的文件描述符
ls -la /proc/<pid>/fd/

# 查看连接状态
ss -tnp | grep <pid>

# 查看内存使用
cat /proc/<pid>/status | grep VmRSS

# 查看上下文切换
cat /proc/<pid>/stat | awk '{print "voluntary:", $12, "involuntary:", $13}'
```

## 练习

### 练习一：添加 LT 模式和 ET 模式的切换

修改代码，支持命令行参数选择 LT 或 ET 模式。用 strace 对比两者的系统调用行为：

```bash
./epoll_echo 8080 --lt  # 水平触发
./epoll_echo 8080 --et  # 边缘触发
```

### 练习二：添加连接超时机制

为每个连接添加超时（比如 60 秒无数据则断开）。使用 `epoll_wait` 的超时参数或 timerfd：

```c
// 使用 timerfd
int timerfd = timerfd_create(CLOCK_MONOTONIC, 0);
struct itimerspec timeout = {
    .it_interval = {60, 0},
    .it_value = {60, 0}
};
timerfd_settime(timerfd, 0, &timeout, NULL);
```

### 练习三：用 ab 做压力测试

```bash
# 编译运行
gcc -O2 -o epoll_echo epoll_echo.c
./epoll_echo 8080 &

# 压力测试
ab -n 100000 -c 1000 http://localhost:8080/

# 观察指标
# 1. 每秒请求数（Requests per second）
# 2. 平均延迟（Time per request）
# 3. 失败请求数（Failed requests）
```

---

## 参考答案

### 练习一

LT 模式的区别：
- LT 模式下，如果 `read` 没有读完所有数据，下次 `epoll_wait` 会再次返回该 fd
- ET 模式下，必须循环读取直到 EAGAIN，否则丢失事件

### 练习二

关键代码：

```c
// 为每个连接维护最后活动时间
struct conn_info {
    int fd;
    time_t last_active;
};

// 在事件循环中检查超时
for (int i = 0; i < nfds; i++) {
    if (events[i].data.fd == timerfd) {
        // 检查所有连接的超时
        time_t now = time(NULL);
        for (each connection) {
            if (now - conn->last_active > TIMEOUT) {
                epoll_ctl(epfd, EPOLL_CTL_DEL, conn->fd, NULL);
                close(conn->fd);
            }
        }
    }
}
```

### 练习三

**预期结果**（取决于硬件）：
- 单核 CPU 上，epoll 服务器通常可以处理 50000-100000 QPS
- 延迟通常在亚毫秒级别
- 瓶颈通常在系统调用开销（accept/read/write）或 CPU
