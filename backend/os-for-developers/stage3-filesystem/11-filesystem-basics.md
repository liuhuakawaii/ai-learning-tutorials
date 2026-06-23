# 文件系统基础——inode、硬链接、软链接、文件描述符

## 文件名不是文件

一个让人困惑的事实：文件名不是文件本身。文件名是目录中的一个条目，指向一个 inode。inode 才是文件的元数据容器，包含权限、大小、时间戳、数据块位置等信息。

```bash
# 查看文件的 inode
ls -i /etc/passwd

# 查看 inode 的详细信息
stat /etc/passwd
```

```
  File: /etc/passwd
  Size: 2345       Blocks: 8          IO Block: 4096   regular file
Device: 802h/2050d Inode: 1234567     Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
```

**Links: 1** 表示这个 inode 只有一个硬链接（即只有一个文件名指向它）。

## 硬链接与软链接

**硬链接**是多个文件名指向同一个 inode。删除一个硬链接不影响其他链接，只有当所有链接都被删除且没有进程打开该文件时，inode 和数据块才会被释放。

```bash
# 创建硬链接
ln /etc/passwd /tmp/passwd_hard
ls -i /etc/passwd /tmp/passwd_hard  # inode 相同

# 硬链接不能跨文件系统
# 硬链接不能链接目录（防止循环）
```

**软链接**（符号链接）是一个独立的文件，内容是目标文件的路径。它有自己的 inode，可以跨文件系统，可以链接目录。

```bash
# 创建软链接
ln -s /etc/passwd /tmp/passwd_soft
ls -la /tmp/passwd_soft  # 显示 -> /etc/passwd

# 软链接有自己的 inode
ls -i /etc/passwd /tmp/passwd_soft  # inode 不同
```

关键区别：

| 特性 | 硬链接 | 软链接 |
|------|--------|--------|
| inode | 共享 | 独立 |
| 跨文件系统 | 否 | 是 |
| 链接目录 | 否 | 是 |
| 原文件删除后 | 仍可访问 | 断链（dangling） |
| 大小 | 0（不占额外空间） | 路径长度 |

## 文件描述符

文件描述符（fd）是进程访问文件的句柄。每个进程有一个文件描述符表，存储在内核的 `files_struct` 中。

```bash
# 查看进程打开的文件描述符
ls -la /proc/<pid>/fd/

# 查看文件描述符的详细信息
cat /proc/<pid>/fdinfo/0  # 标准输入
```

标准文件描述符：
- 0：stdin（标准输入）
- 1：stdout（标准输出）
- 2：stderr（标准错误）

文件描述符指向内核中的 `struct file`，它包含：
- 文件的偏移量（当前读写位置）
- 文件的访问模式
- 指向 inode 的指针

```bash
# 查看系统级别的文件描述符使用
cat /proc/sys/fs/file-nr
# 输出：已分配  未使用  最大值
```

## 用 strace 观察文件操作

```c
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>
#include <string.h>

int main() {
    // 创建文件
    int fd = open("/tmp/testfile", O_WRONLY | O_CREAT | O_TRUNC, 0644);
    write(fd, "hello\n", 6);
    close(fd);

    // 读取文件
    fd = open("/tmp/testfile", O_RDONLY);
    char buf[100];
    int n = read(fd, buf, sizeof(buf));
    buf[n] = 0;
    printf("读到: %s", buf);
    close(fd);

    return 0;
}
```

```bash
strace -e trace=open,openat,read,write,close ./file_demo
```

输出：

```
openat(AT_FDCWD, "/tmp/testfile", O_WRONLY|O_CREAT|O_TRUNC, 0644) = 3
write(3, "hello\n", 6)                 = 6
close(3)                                = 0
openat(AT_FDCWD, "/tmp/testfile", O_RDONLY) = 3
read(3, "hello\n", 100)                = 6
write(1, "读到: hello\n", 15)          = 15
close(3)                                = 0
```

注意 `openat` 返回的文件描述符是 3（0、1、2 已被标准流占用）。

## 文件系统的层次结构

Linux 文件系统有几层抽象：

```
用户态程序
    ↓ 系统调用（open/read/write/close）
VFS（虚拟文件系统）
    ↓ 统一接口
具体文件系统（ext4/xfs/btrfs）
    ↓ 块 I/O
块设备驱动
    ↓
磁盘/SSD
```

VFS 层是关键。它让所有文件系统都暴露相同的接口。你可以用 `open()` 打开 ext4 上的文件，也可以打开 NFS 上的文件，程序不需要知道底层是什么文件系统。

## 练习

### 练习一：理解硬链接和软链接

```bash
# 1. 创建一个文件
echo "hello" > /tmp/original.txt

# 2. 创建硬链接和软链接
ln /tmp/original.txt /tmp/hard.txt
ln -s /tmp/original.txt /tmp/soft.txt

# 3. 查看 inode
ls -i /tmp/original.txt /tmp/hard.txt /tmp/soft.txt

# 4. 删除原文件
rm /tmp/original.txt

# 5. 检查链接是否有效
cat /tmp/hard.txt
cat /tmp/soft.txt
```

### 练习二：用 strace 观察 cp 命令

```bash
strace -e trace=open,openat,read,write,mmap cp /tmp/largefile /tmp/copy
```

分析：
1. cp 使用了哪些系统调用
2. 是否使用了 mmap
3. 缓冲区大小是多少

---

## 参考答案

### 练习一

**预期结果**：
- `original.txt` 和 `hard.txt` 有相同的 inode
- `soft.txt` 有自己的 inode
- 删除原文件后，`hard.txt` 仍可读取（数据还在），`soft.txt` 报错（断链）

### 练习二

**预期结果**：
- cp 使用 `openat` 打开源文件和目标文件
- 使用 `read/write` 复制数据
- 现代 cp 可能使用 `copy_file_range()` 系统调用（3.18+），避免用户空间拷贝
- 缓冲区通常 128KB 或更大
- 对于大文件，cp 可能使用 `mmap` 或 `sendfile` 来优化
