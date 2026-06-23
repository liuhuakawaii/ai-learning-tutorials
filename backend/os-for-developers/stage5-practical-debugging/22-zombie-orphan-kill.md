# 进程问题排查——僵尸进程、孤儿进程、进程被 kill

## 僵尸进程（Zombie）

当子进程退出但父进程没有调用 `wait()` 读取退出状态时，子进程变成僵尸进程。它不占用内存和 CPU，但占用进程表中的一个条目。

```c
// 创建僵尸进程
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

int main() {
    pid_t pid = fork();
    if (pid == 0) {
        // 子进程立即退出
        exit(0);
    }
    // 父进程不调用 wait()，子进程变成僵尸
    printf("子进程 %d 已退出，父进程 %d 不回收\n", pid, getpid());
    sleep(60);  // 等待 60 秒
    return 0;
}
```

```bash
# 编译运行
gcc -o zombie zombie.c
./zombie &

# 查看僵尸进程
ps aux | awk '$8 == "Z"'

# 或者
ps -eo pid,ppid,stat,comm | grep Z
```

输出：

```
PID   PPID  STAT  COMMAND
1234  5678  Z     zombie <defunct>
```

**僵尸进程的危害**：
- 每个僵尸占用一个 PID
- 系统 PID 有限（默认 32768）
- 大量僵尸会导致无法创建新进程

**解决方案**：

```bash
# 1. 杀死父进程（僵尸会被 init 收养并回收）
kill <父进程PID>

# 2. 父进程注册 SIGCHLD 处理函数
```

```c
// 正确的做法：父进程处理 SIGCHLD
#include <signal.h>
#include <sys/wait.h>

void sigchld_handler(int sig) {
    // 循环回收所有已退出的子进程
    while (waitpid(-1, NULL, WNOHANG) > 0);
}

int main() {
    signal(SIGCHLD, sigchld_handler);
    // ... fork 子进程
}
```

## 孤儿进程（Orphan）

父进程先于子进程退出时，子进程变成孤儿进程。Linux 中孤儿进程会被 PID 1（systemd/init）收养。

```c
// 创建孤儿进程
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>

int main() {
    pid_t pid = fork();
    if (pid == 0) {
        // 子进程
        sleep(2);
        printf("子进程: pid=%d, ppid=%d\n", getpid(), getppid());
        // ppid 会变成 1（systemd）
        exit(0);
    }
    // 父进程立即退出
    exit(0);
}
```

```bash
gcc -o orphan orphan.c
./orphan

# 2 秒后看到
# 子进程: pid=1234, ppid=1
```

孤儿进程通常不是问题。systemd 会正确处理它们。

## 进程被 kill

进程被杀最常见的原因：

### 1. OOM Killer

```bash
# 查看 OOM 事件
dmesg | grep -i "oom\|killed process"

# 查看进程的 OOM 分数
cat /proc/<pid>/oom_score
```

### 2. 用户发送信号

```bash
# 查看进程收到的最后信号
cat /proc/<pid>/status | grep SigQ
```

### 3. cgroup 限制

```bash
# 查看 cgroup 的 OOM 事件
journalctl -k | grep -i "oom\|killed"

# 查看容器的 OOM 状态
docker inspect --format='{{.State.OOMKilled}}' <container_id>
```

### 4. systemd 的 OOMPolicy

```bash
# 查看服务的 OOM 策略
systemctl show <service> | grep OOMPolicy
```

## 用 strace 跟踪进程退出

```bash
# 跟踪进程退出相关的系统调用
strace -e trace=exit,exit_group,wait4,kill ./my_program
```

观察：
- `exit()`：进程主动退出
- `exit_group()`：线程组退出（所有线程）
- `wait4()`：父进程等待子进程
- `kill()`：发送信号

## 排查流程

当进程"消失"时：

```bash
# 1. 检查是否是 OOM
dmesg | tail -50

# 2. 检查是否是信号
# 如果进程被 SIGKILL (9) 杀死，可能是 OOM 或用户手动 kill
# 如果进程被 SIGTERM (15) 杀死，可能是 systemd 或脚本

# 3. 检查 cgroup 限制
cat /proc/<pid>/cgroup
# 如果在容器中，检查容器的资源限制

# 4. 检查 systemd 日志
journalctl -u <service> --since "1 hour ago"

# 5. 检查系统日志
grep -i "kill\|oom\|signal" /var/log/syslog
```

## 练习

### 练习一：创建并清理僵尸进程

```bash
# 创建僵尸
./zombie &

# 查看僵尸
ps -eo pid,ppid,stat,comm | grep Z

# 清理僵尸（杀死父进程）
kill <父进程PID>

# 验证僵尸已消失
ps -eo pid,ppid,stat,comm | grep Z
```

### 练习二：用 strace 观察进程退出

```c
// 写一个程序，fork 子进程，子进程调用 exit(42)
// 父进程用 waitpid 获取退出状态
```

```bash
strace -e trace=fork,exit,wait4 ./exit_demo
```

### 练习三：模拟 OOM 并观察

```bash
# 创建内存限制的 cgroup
sudo mkdir /sys/fs/cgroup/oomdemo
echo "50M" | sudo tee /sys/fs/cgroup/oomdemo/memory.max

# 运行吃内存的程序
sudo bash -c 'echo $$ > /sys/fs/cgroup/oomdemo/cgroup.procs; python3 -c "x=bytearray(100*1024*1024)"'

# 观察 OOM 日志
dmesg | tail -20
```

---

## 参考答案

### 练习一

**预期结果**：杀死父进程后，僵尸进程被 systemd 收养并自动回收。

### 练习二

**预期结果**：
- strace 显示 `fork()` 返回子进程 PID
- 子进程调用 `exit(42)`
- 父进程调用 `wait4()` 获取退出状态
- 退出状态中包含退出码 42

### 练习三

**预期结果**：
- dmesg 显示 OOM Killer 日志
- 日志包含被杀进程的 PID、RSS、oom_score
- 容器内的 OOM 不影响宿主机
