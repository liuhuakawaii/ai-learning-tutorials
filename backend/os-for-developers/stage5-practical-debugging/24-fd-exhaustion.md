# 文件描述符问题——fd 耗尽、too many open files

## 一个真实的故障

线上服务报错：`Too many open files`。新连接无法建立，现有连接也开始出问题。

这个错误不是"文件打开太多"，而是文件描述符用完了。文件描述符不仅用于文件，还用于 socket、管道、设备等。

## 文件描述符的限制

```bash
# 查看当前用户的限制
ulimit -n

# 查看系统级别的限制
cat /proc/sys/fs/file-max

# 查看当前已分配的文件描述符
cat /proc/sys/fs/file-nr
# 输出：已分配  未使用  最大值
```

每个进程有独立的文件描述符表，大小由 `ulimit -n` 限制（默认通常 1024）。

```bash
# 查看进程打开的文件描述符数量
ls /proc/<pid>/fd/ | wc -l

# 查看进程的文件描述符限制
cat /proc/<pid>/limits | grep "open files"
```

## 哪些东西占用文件描述符

```bash
# 查看进程打开的所有文件描述符
ls -la /proc/<pid>/fd/

# 按类型统计
ls -la /proc/<pid>/fd/ | awk '{print $NF}' | grep -oE '\[.*\]|socket.*|pipe|/.*' | sort | uniq -c | sort -rn
```

常见占用 fd 的东西：
- 普通文件
- socket（TCP/Unix）
- 管道（pipe）
- eventfd（epoll/timerfd/signalfd）
- 目录（opendir）

## 排查 fd 耗尽

### 第一步：确认是 fd 耗尽

```bash
# 检查系统日志
dmesg | grep -i "too many open files"
journalctl | grep -i "too many open files"

# 检查进程的 fd 使用
ls /proc/<pid>/fd/ | wc -l
```

### 第二步：找到占用 fd 最多的进程

```bash
# 列出所有进程的 fd 数量
for pid in /proc/[0-9]*; do
    count=$(ls $pid/fd 2>/dev/null | wc -l)
    name=$(cat $pid/comm 2>/dev/null)
    echo "$count $name $(basename $pid)"
done | sort -rn | head -10
```

### 第三步：分析 fd 的组成

```bash
# 查看具体是哪些类型的 fd
ls -la /proc/<pid>/fd/ | head -50

# 统计 socket 类型
ls -la /proc/<pid>/fd/ | grep socket | wc -l

# 统计管道类型
ls -la /proc/<pid>/fd/ | grep pipe | wc -l

# 查看 socket 的状态
ss -tnp | grep <pid> | awk '{print $1}' | sort | uniq -c
```

### 第四步：找到泄漏的 fd

fd 泄漏的常见原因：
1. 打开文件后没有 close
2. socket 连接后没有关闭
3. 错误处理路径中忘记关闭 fd
4. 循环中重复打开 fd

```c
// 典型的 fd 泄漏
void handle_request(int client_fd) {
    int file_fd = open("/tmp/data", O_RDONLY);
    if (file_fd < 0) {
        // 错误：没有 close(client_fd)
        return -1;
    }
    // ... 处理请求
    close(file_fd);
    // 忘记 close(client_fd)
}
```

用 strace 追踪 fd 泄漏：

```bash
# 追踪 open/close 系统调用
strace -e trace=open,openat,close,socket,accept -o fd_trace.log -f ./my_program

# 分析：找出 open 但没有对应 close 的 fd
grep -E "^(open|openat|socket|accept)" fd_trace.log | awk -F'[= ]' '{print $NF}' > opened.txt
grep "^close" fd_trace.log | awk -F'[= ]' '{print $NF}' > closed.txt
comm -23 <(sort -n opened.txt) <(sort -n closed.txt)
```

## 提高 fd 限制

```bash
# 临时提高（当前 shell 生效）
ulimit -n 65535

# 永久提高（需要修改配置文件）
# /etc/security/limits.conf
# * soft nofile 65535
# * hard nofile 65535

# systemd 服务
# 在 [Service] 中添加
# LimitNOFILE=65535

# 系统级别
echo 65535 | sudo tee /proc/sys/fs/file-max
```

## 实战案例：Nginx 的 fd 使用

```bash
# 查看 Nginx 的 fd 使用
ls -la /proc/$(pidof nginx | awk '{print $1}')/fd/ | wc -l

# 查看连接数
ss -tnp | grep nginx | wc -l

# 每个连接占用一个 fd
# worker_connections 配置不能超过 ulimit -n
```

## 练习

### 练习一：模拟 fd 耗尽

```c
// fd_exhaust.c
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>

int main() {
    int count = 0;
    while (1) {
        int fd = open("/dev/null", O_RDONLY);
        if (fd < 0) {
            printf("fd 耗尽，打开了 %d 个文件描述符\n", count);
            printf("errno: %d (%s)\n", errno, "Too many open files");
            break;
        }
        count++;
    }
    return 0;
}
```

```bash
# 降低限制后运行
ulimit -n 100
./fd_exhaust
```

### 练习二：用 strace 追踪 fd 泄漏

```bash
# 追踪程序的 fd 操作
strace -e trace=open,openat,close,socket,accept,shutdown -f ./my_program 2>&1 | tee fd_trace.log

# 统计 open 和 close 的数量
echo "Open calls: $(grep -c 'open' fd_trace.log)"
echo "Close calls: $(grep -c 'close' fd_trace.log)"
```

---

## 参考答案

### 练习一

**预期结果**：程序在打开约 100 个 fd 后报错（因为 ulimit 设为 100）。实际可用的 fd 数比 ulimit 少 3（stdin/stdout/stderr 已占用）。

### 练习二

**关键分析**：
- 如果 `open` 调用次数远多于 `close`，说明有 fd 泄漏
- 用 `strace -f` 跟踪子进程，确保所有线程/进程都被追踪
- 关注错误处理路径——很多泄漏发生在错误分支中忘记 close
