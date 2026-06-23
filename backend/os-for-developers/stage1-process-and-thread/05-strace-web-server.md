# 阶段实战：用 strace 观察一个 Web 服务器的系统调用

## 目标

这一节不是写代码，而是观察。用 strace 跟踪一个真实的 Web 服务器，看它在内核层面做了什么。通过系统调用序列，理解进程模型、I/O 模型和信号处理。

## 准备工作

用一个最简单的 HTTP 服务器作为观察对象：

```c
// tinyhttpd.c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <sys/wait.h>
#include <signal.h>

void handle_client(int client_fd) {
    char buf[4096];
    read(client_fd, buf, sizeof(buf));

    char response[] = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\nHello, World!";
    write(client_fd, response, strlen(response));
    close(client_fd);
}

void sigchld_handler(int sig) {
    while (waitpid(-1, NULL, WNOHANG) > 0);
}

int main() {
    signal(SIGCHLD, sigchld_handler);

    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons(8080),
        .sin_addr.s_addr = INADDR_ANY
    };
    bind(server_fd, (struct sockaddr *)&addr, sizeof(addr));
    listen(server_fd, 128);

    printf("服务器监听 :8080\n");

    while (1) {
        int client_fd = accept(server_fd, NULL, NULL);
        if (client_fd < 0) continue;

        pid_t pid = fork();
        if (pid == 0) {
            close(server_fd);
            handle_client(client_fd);
            exit(0);
        }
        close(client_fd);
    }
    return 0;
}
```

编译并启动：

```bash
gcc -o tinyhttpd tinyhttpd.c
./tinyhttpd
```

## 第一步：观察服务器启动

在另一个终端，用 strace 跟踪启动过程：

```bash
strace -f -e trace=network,write -o startup.log ./tinyhttpd
```

启动日志中你会看到：

```
socket(AF_INET, SOCK_STREAM, 0)        = 3
setsockopt(3, SOL_SOCKET, SO_REUSEADDR, [1], 4) = 0
bind(3, {sa_family=AF_INET, sin_port=htons(8080), sin_addr=inet_addr("0.0.0.0")}, 16) = 0
listen(3, 128)                          = 0
write(1, "服务器监听 :8080\n", ...)     = ...
```

这四个系统调用就是 TCP 服务器的标准启动流程：`socket` → `bind` → `listen` → `accept`。

## 第二步：观察连接处理

再开一个终端，发送一个 HTTP 请求：

```bash
curl http://localhost:8080/
```

strace 输出中会看到：

```
# 父进程
accept(3, ...)                          = 4
fork()                                  = 12345
close(4)                                = 0

# 子进程（pid 12345）
close(3)                                = 0
read(4, "GET / HTTP/1.1\r\nHost: ..."..., 4096) = ...
write(4, "HTTP/1.1 200 OK\r\n..."..., ...) = ...
close(4)                                = 0
exit(0)                                 = ?

# 父进程
--- SIGCHLD {si_signo=SIGCHLD, si_pid=12345, ...} ---
waitpid(-1, NULL, WNOHANG)             = 12345
```

关键观察：
1. `accept` 返回新的文件描述符（4），专门用于和客户端通信
2. `fork()` 创建子进程处理请求
3. 子进程关闭监听 socket（不需要），父进程关闭连接 socket（不需要）
4. 子进程读取请求、写入响应、关闭连接
5. 子进程退出后，父进程收到 SIGCHLD 信号

## 第三步：观察并发连接

同时发送多个请求：

```bash
# 用 ab 做并发测试
ab -n 100 -c 10 http://localhost:8080/
```

strace 中会看到多个 fork 和 waitpid。注意：
- 每个连接都是一个新的进程
- 进程创建和销毁的开销不小
- 这就是为什么 prefork 或线程池模型更常用

## 第四步：用 strace 分析性能瓶颈

```bash
# 统计系统调用耗时
strace -c -p <pid> -e trace=all &
ab -n 1000 -c 50 http://localhost:8080/
```

strace -c 输出：

```
% time     seconds  usecs/call     calls    errors syscall
------ ----------- ----------- --------- --------- ----------------
 45.23    0.123456         123      1000           write
 30.12    0.082345          82      1000           read
 15.67    0.042890          42      1000           close
  8.98    0.024567          24      1000           fork
```

这个输出告诉你：
- `write` 耗时最多（网络 I/O）
- `fork` 也有不小的开销

## 第五步：用 /proc 观察运行中的进程

```bash
# 查看服务器进程的文件描述符
ls -la /proc/<pid>/fd/

# 查看连接状态
ss -tlnp | grep 8080
cat /proc/<pid>/net/tcp

# 查看进程的内存使用
cat /proc/<pid>/status | grep -E "^(VmRSS|VmSize|Threads)"

# 查看进程的上下文切换
cat /proc/<pid>/stat | awk '{print "voluntary:", $12, "involuntary:", $13}'
```

## 这个模型的问题

这个简单的 fork-per-connection 模型有几个明显问题：

1. **进程创建开销**：每个连接都要 fork，高并发时开销大
2. **内存开销**：每个进程独立的地址空间，即使 COW 也有页表开销
3. **进程数限制**：系统有最大进程数限制
4. **上下文切换**：大量进程导致频繁上下文切换

改进方向：
- prefork：预先 fork 好进程池
- 线程池：用线程代替进程
- 事件驱动：单进程 + epoll（后面的课程会详细讲）

## 练习

### 练习一：用 strace 分析 prefork 模型

修改服务器代码，实现 prefork 模型：启动时 fork N 个子进程，每个子进程循环 accept。用 strace 观察：
1. 子进程如何竞争 accept
2. 惊群问题（thundering herd）是否出现

```bash
strace -f -e trace=accept,write,read -o prefork.log ./prefork_httpd
```

### 练习二：用 ltrace 对比 strace

```bash
# strace 跟踪系统调用
strace -e trace=read,write ./tinyhttpd

# ltrace 跟踪库函数调用
ltrace ./tinyhttpd
```

对比输出，回答：
- `read()` 在 strace 和 ltrace 中的表现有什么不同
- ltrace 能看到哪些 strace 看不到的信息

---

## 参考答案

### 练习一

prefork 模型的关键代码：

```c
for (int i = 0; i < NUM_WORKERS; i++) {
    if (fork() == 0) {
        while (1) {
            int client_fd = accept(server_fd, NULL, NULL);
            handle_client(client_fd);
            close(client_fd);
        }
    }
}
```

**观察结果**：在旧版内核中，多个子进程同时阻塞在 `accept` 上，一个连接到来时可能唤醒所有子进程（惊群）。Linux 3.9+ 引入了 `SO_REUSEPORT`，可以让内核在多个 socket 之间分配连接，避免惊群。

### 练习二

**关键区别**：
- `strace` 跟踪的是系统调用（进入内核的函数）
- `ltrace` 跟踪的是用户态库函数（如 `printf`、`malloc`）
- `read()` 在 strace 中显示为系统调用，在 ltrace 中可能显示为 `__libc_read`
- ltrace 能看到 `printf` 内部调用了 `vfprintf`、`_IO_putc` 等库函数

**ltrace 的局限**：无法跟踪静态链接的程序（没有动态库函数调用），对系统调用的显示不如 strace 详细。
