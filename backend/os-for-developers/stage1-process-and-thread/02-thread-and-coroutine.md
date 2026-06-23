# 线程与协程——用户态调度 vs 内核态调度的取舍

## 为什么需要线程

一个进程内的多个任务如果完全串行执行，遇到 I/O 就只能等。线程提供了一种在同一个进程内实现并发的方式：共享内存空间，各自有独立的栈和寄存器状态。

但"并发"和"并行"不是一回事。并发是逻辑上的交替执行，并行是物理上的同时执行。单核 CPU 上的多线程只能并发，多核 CPU 上才能并行。

## Linux 线程的内核实现

Linux 没有独立的"线程"数据结构。线程在内核中就是一个普通的 `task_struct`，和进程用同一套调度机制。区别在于线程之间共享某些资源：

```c
// clone() 的 flags 决定共享哪些资源
clone(thread_func, stack, CLONE_VM | CLONE_FS | CLONE_FILES | CLONE_SIGHAND, arg);
```

| Flag | 含义 |
|------|------|
| CLONE_VM | 共享内存空间（mm_struct） |
| CLONE_FS | 共享文件系统信息 |
| CLONE_FILES | 共享文件描述符表 |
| CLONE_SIGHAND | 共享信号处理函数 |
| CLONE_THREAD | 同一线程组（共享 tgid） |

`pthread_create()` 底层就是调用 `clone()`，带上这些 flag。

用 `/proc` 可以看到线程：

```bash
# 查看进程的所有线程
ls /proc/<pid>/task/

# 每个线程都有自己的 status
cat /proc/<pid>/task/<tid>/status
```

## 线程切换的开销

线程切换比进程切换轻量，但也不是零成本。一次线程切换涉及：

1. 保存当前线程的寄存器状态（内核态完成）
2. 切换内核栈
3. 恢复目标线程的寄存器状态
4. 可能的 TLB 刷新（同一进程内通常不需要）

关键区别：线程切换不需要切换页表（因为共享 `mm_struct`），所以不需要刷新整个 TLB。这比进程切换快很多。

用 strace 可以观察线程创建：

```c
#include <stdio.h>
#include <pthread.h>

void *thread_func(void *arg) {
    printf("线程 %ld 运行中\n", (long)arg);
    return NULL;
}

int main() {
    pthread_t threads[3];
    for (long i = 0; i < 3; i++) {
        pthread_create(&threads[i], NULL, thread_func, (void *)i);
    }
    for (int i = 0; i < 3; i++) {
        pthread_join(threads[i], NULL);
    }
    return 0;
}
```

```bash
# 跟踪线程相关的系统调用
strace -e trace=clone,futex ./thread_demo
```

你会看到 `clone()` 调用（创建线程）和 `futex()` 调用（线程同步）。

## 协程：用户态的调度

线程的切换需要陷入内核，这个开销在某些场景下太高了。协程把调度权拿到用户态，切换成本极低——只需要保存和恢复几个寄存器。

协程的核心思想：在一个线程内，通过协作式调度（主动让出 CPU）实现多个任务的交替执行。

```c
// 协程切换的本质：保存/恢复寄存器 + 切换栈
// 伪代码
void coroutine_switch(coro_t *from, coro_t *to) {
    // 保存 from 的寄存器状态
    setjmp(from->context);
    // 恢复 to 的寄存器状态
    longjmp(to->context, 1);
}
```

协程切换的开销大约是线程切换的 1/10 到 1/100，因为：
- 不需要陷入内核
- 不需要切换内核栈
- 不需要内核调度器介入

## 三种调度模型的对比

| 维度 | 进程 | 线程 | 协程 |
|------|------|------|------|
| 调度方 | 内核 | 内核 | 用户态运行时 |
| 切换开销 | 高（TLB 刷新） | 中（内核栈切换） | 低（寄存器切换） |
| 内存隔离 | 独立地址空间 | 共享地址空间 | 共享地址空间 |
| 并行能力 | 可以并行 | 可以并行 | 单线程内不能并行 |
| 同步原语 | IPC（管道、信号量） | 互斥锁、条件变量 | 无锁（协作式） |
| 典型场景 | 隔离、安全边界 | CPU 密集型并发 | I/O 密集型高并发 |

## Go 的 goroutine 和调度器

Go 的 goroutine 是一种特殊的协程，由 Go 运行时调度。Go 1.14 之后采用基于信号的抢占式调度，解决了早期版本中长时间运行的 goroutine 会阻塞其他 goroutine 的问题。

Go 调度器采用 GMP 模型：
- **G**（Goroutine）：用户态的执行单元
- **M**（Machine）：操作系统线程
- **P**（Processor）：逻辑处理器，持有本地运行队列

```bash
# 查看 Go 程序的 goroutine 数量
curl http://localhost:6060/debug/pprof/goroutine?debug=1

# 用 GOMAXPROCS 控制 P 的数量
GOMAXPROCS=4 ./my_go_program
```

## 什么时候用什么

选择进程、线程还是协程，取决于你的场景：

- **需要隔离**：用进程（或容器）。Web 服务器每个请求一个进程太重，但 Nginx 的 worker 进程模型是合理的。
- **CPU 密集型**：用线程。多线程可以利用多核。
- **I/O 密集型高并发**：用协程。一个线程跑成千上万个协程，每个协程处理一个连接。
- **混合场景**：多线程 + 每线程多协程。Go 的 GMP 模型就是这个思路。

不要盲目追求协程。如果你的并发量不大（几百个连接），线程完全够用，而且调试更简单。

## 练习

### 练习一：测量线程切换开销

写一个 C 程序，创建两个线程，通过管道互相传递令牌，测量每秒能传递多少次。这就是线程切换的基准。

### 练习二：观察线程的栈空间

写一个程序创建多个线程，每个线程打印自己的栈地址范围（读取 `/proc/self/maps`）。观察：
1. 每个线程的栈大小是否相同
2. 栈的增长方向

```bash
# 编译时指定栈大小
gcc -pthread -o thread_stack thread_stack.c
ulimit -s  # 查看默认栈大小（KB）
```

---

## 参考答案

### 练习一

```c
#include <stdio.h>
#include <pthread.h>
#include <sys/time.h>

int pipe_fd[2];
volatile int count = 0;

void *sender(void *arg) {
    char buf = 'x';
    for (int i = 0; i < 1000000; i++) {
        write(pipe_fd[1], &buf, 1);
        read(pipe_fd[0], &buf, 1);
    }
    return NULL;
}

int main() {
    pipe(pipe_fd);
    struct timeval start, end;
    gettimeofday(&start, NULL);

    pthread_t t;
    pthread_create(&t, NULL, sender, NULL);

    char buf = 'y';
    for (int i = 0; i < 1000000; i++) {
        read(pipe_fd[0], &buf, 1);
        write(pipe_fd[1], &buf, 1);
    }
    pthread_join(t, NULL);

    gettimeofday(&end, NULL);
    double elapsed = (end.tv_sec - start.tv_sec) + (end.tv_usec - start.tv_usec) / 1e6;
    printf("100 万次上下文切换耗时: %.3f 秒\n", elapsed);
    printf("每次切换约: %.0f 纳秒\n", elapsed / 2000000 * 1e9);
    return 0;
}
```

**预期结果**：在普通 Linux 机器上，每次线程切换大约 1-5 微秒。

### 练习二

```c
#include <stdio.h>
#include <pthread.h>
#include <unistd.h>

void *thread_func(void *arg) {
    int stack_var;
    printf("线程 %ld: 栈变量地址 %p\n", (long)arg, &stack_var);
    sleep(10);  // 保持线程存活以便观察
    return NULL;
}

int main() {
    pthread_t threads[3];
    for (long i = 0; i < 3; i++) {
        pthread_create(&threads[i], NULL, thread_func, (void *)i);
    }
    printf("主线程: 查看 /proc/%d/maps 中的 [stack] 区域\n", getpid());
    sleep(15);
    return 0;
}
```

**预期结果**：每个线程的栈地址不同，栈大小通常默认 8MB（可通过 `ulimit -s` 或 `pthread_attr_setstacksize` 调整）。栈从高地址向低地址增长。
