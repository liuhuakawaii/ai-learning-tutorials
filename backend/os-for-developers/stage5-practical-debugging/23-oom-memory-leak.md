# 内存问题排查——OOM、内存泄漏、swap 使用过高

## 三个常见的内存问题

1. **OOM**：系统内存不足，OOM Killer 杀进程
2. **内存泄漏**：进程内存持续增长，最终可能触发 OOM
3. **swap 过高**：大量内存被换出到磁盘，性能急剧下降

## 排查 OOM

```bash
# 检查是否发生过 OOM
dmesg | grep -i "oom\|killed process"

# 查看当前内存状态
free -h
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree"

# 查看哪些进程占用了最多内存
ps aux --sort=-%mem | head -10

# 查看 cgroup 的内存限制
cat /sys/fs/cgroup/memory.max 2>/dev/null
```

## 排查内存泄漏

内存泄漏的典型表现：进程的 RSS 或 VMS 持续增长，不回落。

### 方法一：用 /proc 监控

```bash
# 持续监控进程的内存
while true; do
    echo "$(date): $(cat /proc/<pid>/status | grep VmRSS)"
    sleep 5
done
```

### 方法二：用 pmap 分析内存分布

```bash
# 查看内存区域
pmap -x <pid> | tail -1

# 对比两次快照
pmap -x <pid> > /tmp/pmap1.txt
sleep 60
pmap -x <pid> > /tmp/pmap2.txt
diff /tmp/pmap1.txt /tmp/pmap2.txt
```

### 方法三：用 valgrind 检测

```bash
# 安装 valgrind
sudo apt install valgrind

# 运行程序并检测内存泄漏
valgrind --leak-check=full --show-leak-kinds=all ./my_program

# 输出示例
# ==1234== 1,024 bytes in 1 blocks are definitely lost in loss record 1 of 1
# ==1234==    at 0x4C2AB80: malloc (in /usr/lib/valgrind/vgpreload_memcheck-amd64-linux.so)
# ==1234==    by 0x4005F7: main (test.c:10)
```

valgrind 的输出：
- **definitely lost**：确定泄漏的内存
- **indirectly lost**：因主内存泄漏而间接丢失的（如链表节点）
- **possibly lost**：可能是泄漏
- **still reachable**：程序结束时仍可访问（不算泄漏，但可能是设计问题）

### 方法四：用 jemalloc 分析

```bash
# 用 jemalloc 运行程序
LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so MALLOC_CONF=prof:true ./my_program

# 分析堆内存
jeprof --svg ./my_program jeprof.*.heap > profile.svg
```

## 排查 swap 过高

```bash
# 查看 swap 使用
free -h
swapon --show

# 查看哪些进程在使用 swap
for pid in /proc/[0-9]*; do
    swap=$(awk '/VmSwap/{print $2}' $pid/status 2>/dev/null)
    if [ "$swap" -gt 0 ] 2>/dev/null; then
        name=$(cat $pid/comm 2>/dev/null)
        echo "$swap kB  $name ($(basename $pid))"
    fi
done | sort -rn | head -10
```

**swap 过高的原因**：
1. 物理内存不足
2. swappiness 设置过高
3. 某个进程内存泄漏

```bash
# 查看 swappiness
cat /proc/sys/vm/swappiness

# 降低 swappiness（更倾向用物理内存）
echo 10 | sudo tee /proc/sys/vm/swappiness
```

## 内存泄漏的常见原因

### C/C++

```c
// 1. malloc 后没有 free
char *buf = malloc(1024);
// 忘记 free(buf)

// 2. 重复 malloc 覆盖指针
char *buf = malloc(1024);
buf = malloc(2048);  // 第一次分配的内存泄漏

// 3. 循环引用（使用引用计数时）
```

### Java

```java
// 1. 静态集合持续增长
static List<byte[]> cache = new ArrayList<>();
void process() {
    cache.add(new byte[1024 * 1024]);  // 永远不清理
}

// 2. 未关闭的资源
Connection conn = dataSource.getConnection();
// 忘记 conn.close()
```

### Node.js

```javascript
// 1. 闭包引用大对象
function createHandler() {
    const data = Buffer.alloc(10 * 1024 * 1024);
    return function handler() {
        // data 被闭包引用，无法回收
    };
}

// 2. 事件监听器未移除
emitter.on('data', handler);
// 忘记 emitter.removeListener('data', handler)
```

## 用 /proc 分析内存分布

```bash
# 查看进程的详细内存分布
cat /proc/<pid>/smaps | awk '
/^[0-9a-f]/{region=$0}
/^Pss:/{pss=$2; total+=pss; print pss, region}
END {print "Total PSS:", total, "kB"}
' | sort -rn | head -10
```

## 练习

### 练习一：用 valgrind 检测内存泄漏

```c
// leaky.c
#include <stdlib.h>

int main() {
    for (int i = 0; i < 100; i++) {
        char *buf = malloc(1024);
        // 故意不 free
    }
    return 0;
}
```

```bash
gcc -g -o leaky leaky.c
valgrind --leak-check=full ./leaky
```

### 练习二：写一个内存监控脚本

```bash
#!/bin/bash
# 每 10 秒检查一次，当 RSS 超过阈值时告警
PID=$1
THRESHOLD=1048576  # 1GB in kB

while true; do
    rss=$(awk '/VmRSS/{print $2}' /proc/$PID/status)
    if [ "$rss" -gt "$THRESHOLD" ]; then
        echo "WARNING: PID $PID RSS is ${rss}kB"
        pmap -x $PID | tail -1
    fi
    sleep 10
done
```

---

## 参考答案

### 练习一

**预期结果**：valgrind 报告 100 个 definitely lost 的块，每个 1024 字节。输出会显示泄漏发生的代码位置。

### 练习二

**关键点**：
- 监控 `VmRSS` 而不是 `VmSize`（VmSize 包含未使用的虚拟内存）
- 用 `pmap` 分析内存增长的区域（堆、栈、匿名映射）
- 如果堆内存持续增长，可能是 malloc 泄漏
- 如果匿名映射持续增长，可能是 mmap 泄漏
