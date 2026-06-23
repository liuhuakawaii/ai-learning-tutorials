# 进程间通信——管道、共享内存、消息队列、Socket

## 为什么进程之间不能直接通信

进程有独立的地址空间。进程 A 的指针 0x7fff1234 指向的内存，在进程 B 看来可能是完全不同的数据（或者根本不可访问）。这是操作系统的保护机制，防止一个进程搞崩另一个。

所以进程间通信（IPC）必须通过内核提供的机制。每次 IPC 都涉及至少一次内核态切换，这是 IPC 的基本开销。

## 管道：最简单的 IPC

管道是 Unix 最古老的 IPC 机制。`pipe()` 系统调用创建一对文件描述符：一个读端，一个写端。

```c
#include <stdio.h>
#include <unistd.h>
#include <string.h>

int main() {
    int pipefd[2];
    pipe(pipefd);

    pid_t pid = fork();
    if (pid == 0) {
        close(pipefd[0]);  // 关闭读端
        const char *msg = "hello from child";
        write(pipefd[1], msg, strlen(msg) + 1);
        close(pipefd[1]);
    } else {
        close(pipefd[1]);  // 关闭写端
        char buf[100];
        read(pipefd[0], buf, sizeof(buf));
        printf("父进程收到: %s\n", buf);
        close(pipefd[0]);
    }
    return 0;
}
```

管道的特点：
- 单向通信（半双工）
- 只能用于有亲缘关系的进程（父子进程）
- 内核中有缓冲区（默认 64KB），满了写阻塞，空了读阻塞
- 数据是字节流，没有消息边界

用 strace 可以看到管道的系统调用：

```bash
strace -e trace=read,write,pipe ./pipe_demo
```

## 命名管道（FIFO）

普通管道只能用于父子进程。命名管道（FIFO）通过文件系统路径实现无亲缘关系进程的通信：

```bash
# 创建 FIFO
mkfifo /tmp/myfifo

# 终端 1：写入
echo "hello" > /tmp/myfifo

# 终端 2：读取
cat /tmp/myfifo
```

FIFO 在文件系统上有路径名，但数据不写入磁盘，只在内核缓冲区中传递。

## 共享内存：最快的 IPC

共享内存是最快的 IPC 方式，因为数据不需要在内核和用户空间之间复制。多个进程映射同一块物理内存，直接读写。

```c
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <unistd.h>
#include <string.h>

int main() {
    // 创建匿名共享内存
    void *shm = mmap(NULL, 4096, PROT_READ | PROT_WRITE,
                     MAP_SHARED | MAP_ANONYMOUS, -1, 0);

    pid_t pid = fork();
    if (pid == 0) {
        strcpy((char *)shm, "hello from child via shared memory");
        exit(0);
    } else {
        wait(NULL);
        printf("父进程读到: %s\n", (char *)shm);
        munmap(shm, 4096);
    }
    return 0;
}
```

共享内存的问题是同步。多个进程同时读写会导致数据竞争。通常需要配合信号量或互斥锁：

```c
// POSIX 共享内存 + 信号量
#include <semaphore.h>

typedef struct {
    sem_t sem;
    char data[1024];
} shared_data_t;

// 用 shm_open 创建命名共享内存
int fd = shm_open("/myshm", O_CREAT | O_RDWR, 0666);
ftruncate(fd, sizeof(shared_data_t));
shared_data_t *ptr = mmap(NULL, sizeof(shared_data_t), PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
```

```bash
# 查看系统中的共享内存
ipcs -m

# 删除共享内存
ipcrm -m <shmid>
```

## System V 消息队列

消息队列是有消息边界的 IPC。发送方和接收方以消息为单位，而不是字节流。

```c
#include <stdio.h>
#include <sys/msg.h>
#include <string.h>

struct msgbuf {
    long mtype;
    char mtext[256];
};

int main() {
    // 创建消息队列
    int msqid = msgget(IPC_PRIVATE, 0666 | IPC_CREAT);

    // 发送消息
    struct msgbuf msg;
    msg.mtype = 1;
    strcpy(msg.mtext, "hello via message queue");
    msgsnd(msqid, &msg, strlen(msg.mtext) + 1, 0);

    // 接收消息
    msgrcv(msqid, &msg, sizeof(msg.mtext), 1, 0);
    printf("收到: %s\n", msg.mtext);

    // 删除消息队列
    msgctl(msqid, IPC_RMID, NULL);
    return 0;
}
```

```bash
# 查看系统中的消息队列
ipcs -q
```

消息队列的优点是有消息边界，支持按类型接收。缺点是内核缓冲区有大小限制，数据需要在内核和用户空间之间复制。

## Unix Domain Socket

Unix Domain Socket 是最通用的 IPC 方式。它使用文件系统路径作为地址，支持双向通信、多对多连接，可以传递文件描述符和进程凭证。

```c
// 服务端
#include <stdio.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

int main() {
    int fd = socket(AF_UNIX, SOCK_STREAM, 0);
    struct sockaddr_un addr;
    addr.sun_family = AF_UNIX;
    strcpy(addr.sun_path, "/tmp/mysocket");

    unlink("/tmp/mysocket");
    bind(fd, (struct sockaddr *)&addr, sizeof(addr));
    listen(fd, 5);

    int client = accept(fd, NULL, NULL);
    char buf[100];
    read(client, buf, sizeof(buf));
    printf("收到: %s\n", buf);
    write(client, "world", 6);

    close(client);
    close(fd);
    unlink("/tmp/mysocket");
    return 0;
}
```

Unix Domain Socket 的性能比 TCP Socket 好很多，因为不需要经过网络协议栈。

## IPC 方式的选择

| 方式 | 速度 | 消息边界 | 多对多 | 跨机器 | 传递 fd |
|------|------|----------|--------|--------|---------|
| 管道 | 中 | 无 | 1:1 | 否 | 否 |
| 共享内存 | 最快 | 无 | N:N | 否 | 否 |
| 消息队列 | 中 | 有 | N:N | 否 | 否 |
| Unix Socket | 快 | 有 | N:N | 否 | 是 |
| TCP Socket | 慢 | 有 | N:N | 是 | 否 |

实际选择：
- 父子进程简单通信 → 管道
- 大量数据共享 → 共享内存 + 信号量
- 微服务间通信 → TCP Socket 或 gRPC
- 同机进程间高性能通信 → Unix Domain Socket

## 练习

### 练习一：用管道实现进程间计数器

创建两个子进程，一个负责递增计数器（共享内存中的 int），另一个负责读取并打印。用管道协调两个子进程的节奏——读取进程每收到一个管道消息就打印一次当前值。

### 练习二：用 ipcs 观察系统 IPC 资源

```bash
# 查看当前系统的 IPC 资源使用情况
ipcs -a

# 创建一个共享内存段，再观察
# 用 ipcrm 清理
```

---

## 参考答案

### 练习一

```c
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <unistd.h>

int main() {
    int *counter = mmap(NULL, sizeof(int), PROT_READ | PROT_WRITE,
                        MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    *counter = 0;

    int notify_fd[2];
    pipe(notify_fd);

    // 子进程 1：递增
    if (fork() == 0) {
        close(notify_fd[0]);
        for (int i = 0; i < 10; i++) {
            (*counter)++;
            write(notify_fd[1], "x", 1);
            usleep(100000);
        }
        close(notify_fd[1]);
        exit(0);
    }

    // 子进程 2：读取
    if (fork() == 0) {
        close(notify_fd[1]);
        char buf;
        while (read(notify_fd[0], &buf, 1) > 0) {
            printf("计数器值: %d\n", *counter);
        }
        close(notify_fd[0]);
        exit(0);
    }

    close(notify_fd[0]);
    close(notify_fd[1]);
    while (wait(NULL) > 0);
    munmap(counter, sizeof(int));
    return 0;
}
```

**常见错误**：不关闭不用的管道端，导致 read 永远阻塞（写端没全部关闭，read 不返回 0）。
