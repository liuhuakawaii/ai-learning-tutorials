# VFS 层——虚拟文件系统的统一抽象

## 为什么需要 VFS

Linux 支持几十种文件系统（ext4、xfs、btrfs、nfs、proc、sysfs、tmpfs...）。如果每种文件系统都实现一套自己的系统调用，用户态程序就要针对不同文件系统写不同的代码。

VFS（Virtual File System）解决了这个问题。它在具体文件系统之上抽象出一套统一的接口：`open`、`read`、`write`、`close`、`stat`、`readdir`... 用户态程序不需要关心底层是哪种文件系统。

## VFS 的核心数据结构

VFS 定义了四个关键对象：

**superblock**：代表一个已挂载的文件系统
```c
struct super_block {
    struct list_head s_list;        // 全局链表
    dev_t s_dev;                    // 设备号
    struct file_system_type *s_type; // 文件系统类型
    struct super_operations *s_op;   // 操作函数表
    struct dentry *s_root;          // 根目录项
    ...
};
```

**inode**：代表一个文件（或目录、设备等）
```c
struct inode {
    struct super_block *i_sb;       // 所属的 superblock
    unsigned long i_ino;            // inode 号
    umode_t i_mode;                 // 文件类型和权限
    kuid_t i_uid;                   // 所有者
    kgid_t i_gid;                   // 所属组
    loff_t i_size;                  // 文件大小
    struct inode_operations *i_op;   // inode 操作
    struct file_operations *i_fop;   // 文件操作
    struct address_space *i_mapping; // 页面缓存
    ...
};
```

**dentry**（目录项）：代表一个路径中的一个组成部分
```c
struct dentry {
    struct dentry *d_parent;        // 父目录
    struct qstr d_name;             // 文件名
    struct inode *d_inode;          // 关联的 inode
    struct dentry_operations *d_op;
    ...
};
```

**file**：代表进程打开的一个文件
```c
struct file {
    struct path f_path;             // 路径（包含 dentry 和 vfsmount）
    struct inode *f_inode;          // 关联的 inode
    const struct file_operations *f_op;
    loff_t f_pos;                   // 当前读写位置
    atomic_long_t f_count;          // 引用计数
    ...
};
```

## 一次 open 的完整流程

当用户态调用 `open("/home/user/file.txt", O_RDONLY)` 时：

1. **路径解析**：VFS 从根目录 `/` 开始，逐级查找 `home` → `user` → `file.txt`
2. **dentry 缓存查找**：先在 dcache 中查找，命中则跳过磁盘访问
3. **inode 查找**：通过目录的 inode 和 `lookup` 操作找到目标文件的 inode
4. **权限检查**：检查进程是否有权以指定模式打开文件
5. **创建 file 结构**：分配一个新的 `struct file`，设置 `f_pos = 0`
6. **返回文件描述符**：在进程的文件描述符表中找一个空闲位置，指向 `struct file`

```bash
# 用 strace 观察路径解析
strace -e trace=openat,access,stat,readlink ls /home/user/

# 用 strace 统计 dentry 缓存命中
strace -c ls -la /usr/lib/  # 第一次运行
strace -c ls -la /usr/lib/  # 第二次运行应该更快（缓存命中）
```

## dentry 缓存（dcache）

dentry 缓存是 VFS 中最重要的性能优化之一。它缓存了路径名到 inode 的映射，避免每次都去磁盘查找。

```bash
# 查看 dentry 缓存统计
cat /proc/sys/fs/dentry-state
# 输出：总条目数  未使用  年龄限制  需要回收  ...

# 查看 slab 分配器中的 dentry 缓存
cat /proc/slabinfo | grep dentry
```

## 挂载点和命名空间

文件系统通过 `mount` 挂载到 VFS 的目录树上。每个挂载点是一个 `vfsmount` 结构。

```bash
# 查看挂载信息
mount | head -20
cat /proc/mounts

# 查看文件系统类型统计
cat /proc/filesystems

# 查看挂载的详细信息
findmnt -o TARGET,SOURCE,FSTYPE,OPTIONS
```

Linux 支持 mount namespace，不同进程可以看到不同的挂载树。这是容器隔离的基础：

```bash
# 查看进程的挂载信息
cat /proc/<pid>/mounts
cat /proc/<pid>/mountinfo

# 创建新的 mount namespace（需要 root）
unshare --mount bash
mount -t tmpfs tmpfs /mnt
# 在新 namespace 中挂载的 tmpfs 在宿主机上不可见
```

## proc 和 sysfs：特殊文件系统

proc 和 sysfs 不是磁盘上的文件系统。它们是内核导出信息的接口：

```bash
# proc：进程和内核信息
cat /proc/cpuinfo
cat /proc/meminfo
cat /proc/<pid>/status

# sysfs：设备和驱动信息
ls /sys/class/net/
cat /sys/class/net/eth0/speed
```

这些"文件"在读取时由内核动态生成内容，不占用磁盘空间。

## 练习

### 练习一：观察路径解析过程

```bash
# 用 strace 跟踪一个深层路径的打开过程
strace -e trace=openat,stat,readlink,access ls /usr/share/doc/linux-doc/README 2>&1 | head -30
```

统计：总共多少次系统调用？多少次是 dentry 缓存命中（直接返回，不需要磁盘访问）？

### 练习二：查看文件系统信息

```bash
# 查看根文件系统的类型和选项
findmnt /

# 查看 inode 使用情况
df -i

# 查看块设备和文件系统的关系
lsblk -f
```

---

## 参考答案

### 练习一

**预期结果**：
- 路径解析需要多次 `openat` 和 `stat` 调用
- `/`、`/usr`、`/usr/share` 等目录会被逐级访问
- 如果 dcache 中有缓存，`stat` 会直接返回（不需要磁盘 I/O）
- `readlink` 用于解析符号链接

### 练习二

**关键信息**：
- `findmnt` 显示文件系统类型（ext4/xfs）、挂载选项（rw/ro、noexec 等）
- `df -i` 显示 inode 使用率，inode 耗尽时即使有空间也无法创建新文件
- `lsblk -f` 显示块设备和文件系统的对应关系
