# 进程是什么——从 fork() 看进程创建的内核实现

## 一个让人困惑的问题

很多开发者第一次看到 `fork()` 的文档时，反应都是：这个函数调用一次，返回两次？是的。而且两次返回值不同。这不是文档写错了，而是理解进程的关键入口。

```c
#include <stdio.h>
#include <unistd.h>

int main() {
    pid_t pid = fork();
    if (pid == 0) {
        printf("子进程: pid=%d, ppid=%d\n", getpid(), getppid());
    } else if (pid > 0) {
        printf("父进程: pid=%d, 子进程 pid=%d\n", getpid(), pid);
    } else {
        perror("fork failed");
    }
    return 0;
}
```

编译运行，你会看到两行输出。程序只写了一份，但执行了两次——一次在父进程，一次在子进程。

## fork() 到底做了什么

从内核角度看，`fork()` 做了这几件事：

1. 分配一个新的 `task_struct`（进程描述符）
2. 复制父进程的内存空间（页表复制，物理页通过 COW 共享）
3. 复制父进程的文件描述符表
4. 复制父进程的信号处理设置
5. 设置子进程的返回值为 0，父进程的返回值为子进程 PID
6. 将子进程加入调度队列

注意第 2 步：不是复制物理内存，而是复制页表。这就是 Copy-on-Write（写时复制）。子进程和父进程最初共享同一份物理页面，只有当某一方尝试写入时，内核才会真正复制那一页。

用 `/proc` 可以验证 COW 的效果：

```bash
# 先写一个不断 fork 的程序，然后观察
cat /proc/<pid>/smaps | grep -A 2 "Private_Dirty"
```

`Private_Dirty` 表示被修改过的私有页面。刚 fork 时，子进程的这个值接近 0，随着写入操作才会增长。

## 进程在内核里长什么样

每个进程在内核中是一个 `task_struct` 结构体，里面包含：

- **进程标识**：pid, tgid, uid, gid
- **状态**：RUNNING, SLEEPING, STOPPED, ZOMBIE
- **内存映射**：`mm_struct` 指向虚拟内存区域（VMA）链表
- **文件系统信息**：`fs_struct` 包含当前目录、根目录
- **打开的文件**：`files_struct` 包含文件描述符表
- **信号**：`signal_struct`、信号掩码、pending 信号
- **调度信息**：优先级、调度类、CPU 亲和性

用 `/proc` 可以直接读到这些信息：

```bash
# 查看进程状态
cat /proc/<pid>/status

# 查看进程打开的文件
ls -la /proc/<pid>/fd/

# 查看进程的内存映射
cat /proc/<pid>/maps

# 查看进程的命令行参数
cat /proc/<pid>/cmdline | tr '\0' ' '
```

## 进程状态与生命周期

进程不是只有"运行"和"不运行"两种状态。Linux 内核定义了这些状态：

| 状态 | 标志 | 含义 |
|------|------|------|
| Running | R | 正在 CPU 上运行，或在运行队列中等待 |
| Sleeping (interruptible) | S | 等待事件，可以被信号唤醒 |
| Sleeping (uninterruptible) | D | 等待 I/O 完成，不能被信号唤醒 |
| Stopped | T | 被信号停止（如 SIGSTOP） |
| Zombie | Z | 进程已退出，但父进程还没读取退出状态 |

D 状态在排查问题时特别重要。如果你发现大量进程处于 D 状态，通常是磁盘 I/O 卡住了。

```bash
# 统计各状态进程数量
ps aux | awk '{print $8}' | sort | uniq -c

# 查找 D 状态进程
ps aux | awk '$8 ~ /D/'
```

## execl() 和 fork() 的配合

实际使用中，`fork()` 几乎总是和 `exec` 系列函数配合使用。`fork()` 创建子进程，`exec()` 在子进程中替换为新程序：

```c
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

int main() {
    pid_t pid = fork();
    if (pid == 0) {
        // 子进程：替换为 ls 命令
        execl("/bin/ls", "ls", "-la", NULL);
        perror("execl failed");  // 只有 exec 失败才会执行到这里
        _exit(1);
    } else if (pid > 0) {
        // 父进程：等待子进程结束
        int status;
        waitpid(pid, &status, 0);
        if (WIFEXITED(status)) {
            printf("子进程退出码: %d\n", WEXITSTATUS(status));
        }
    }
    return 0;
}
```

`exec()` 调用不会创建新进程，而是用新程序的代码、数据替换当前进程的地址空间。PID 不变，但进程的内容完全换了。

用 strace 可以看到这个过程：

```bash
strace -f -e trace=process ./myprogram
```

你会看到 `fork()` 或 `clone()` 系统调用，紧接着是 `execve()` 系统调用。

## 容器和进程的关系

理解了进程的内核结构，就容易理解容器了。容器本质上是一组进程，加上：

- **namespace**：隔离进程看到的资源（PID、网络、文件系统、用户等）
- **cgroup**：限制进程能使用的资源（CPU、内存、I/O 带宽）

容器里的进程和宿主机上的进程在内核看来没有本质区别，都是一样的 `task_struct`。容器只是让进程看到的世界变小了。

```bash
# 查看进程所属的 namespace
ls -la /proc/<pid>/ns/

# 查看进程的 cgroup
cat /proc/<pid>/cgroup
```

## 练习

### 练习一：观察 fork 的 COW 行为

写一个 C 程序，fork 之后：
1. 父进程和子进程分别打印自己的 RSS（Resident Set Size）
2. 子进程向一块大数组写入数据
3. 再次打印 RSS，观察变化

提示：读取 `/proc/self/statm` 获取 RSS。

### 练习二：用 strace 跟踪进程创建

用 strace 跟踪 `ls` 命令的执行，回答：
1. `ls` 是通过哪个系统调用创建的
2. `ls` 执行了哪些 `execve` 调用
3. `ls` 在退出前做了什么

```bash
strace -f -o ls_trace.log ls -la
cat ls_trace.log | grep -E "(fork|clone|execve|exit)"
```

---

## 参考答案

### 练习一

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>

long get_rss_kb() {
    FILE *f = fopen("/proc/self/statm", "r");
    if (!f) return -1;
    long pages;
    fscanf(f, "%*ld %ld", &pages);  // 第二个字段是 RSS（页数）
    fclose(f);
    return pages * 4;  // 每页 4KB
}

int main() {
    printf("fork 前 RSS: %ld KB\n", get_rss_kb());

    pid_t pid = fork();
    if (pid == 0) {
        // 子进程
        printf("子进程 fork 后 RSS: %ld KB\n", get_rss_kb());

        // 写入大数组触发 COW
        char *buf = malloc(10 * 1024 * 1024);
        memset(buf, 'A', 10 * 1024 * 1024);
        printf("子进程写入后 RSS: %ld KB\n", get_rss_kb());

        free(buf);
        exit(0);
    } else {
        wait(NULL);
        printf("父进程最终 RSS: %ld KB\n", get_rss_kb());
    }
    return 0;
}
```

**预期结果**：子进程在 `memset` 后 RSS 会显著增长，因为写操作触发了 COW，内核为子进程分配了独立的物理页面。

### 练习二

关键输出：
- `clone()` 或 `vfork()` 用于创建子进程（`ls` 本身是 shell fork 出来的）
- `execve("/bin/ls", ["ls", "-la"], ...)` 替换进程映像
- 退出前会调用 `close()` 关闭文件描述符，最后调用 `exit_group()`

**常见错误**：混淆 `fork` 和 `exec` 的职责。`fork` 负责复制进程，`exec` 负责替换程序。shell 执行命令时两者都用。
