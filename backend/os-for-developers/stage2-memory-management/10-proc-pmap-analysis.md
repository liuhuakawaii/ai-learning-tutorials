# 阶段实战：用 /proc 和 pmap 分析一个进程的内存布局

## 目标

通过 `/proc` 文件系统和 `pmap` 工具，深入分析一个真实进程的内存布局。理解虚拟地址空间的各个区域、它们的物理内存占用、以及内存的共享与私有。

## 观察对象

用一个真实的 Node.js 进程作为观察对象（如果你没有 Node.js，用 Python 或任何长时间运行的程序都可以）：

```bash
# 启动一个简单的 Node.js 服务器
cat > /tmp/server.js << 'EOF'
const http = require('http');
const data = Buffer.alloc(50 * 1024 * 1024, 'A');  // 分配 50MB

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello\n');
});

server.listen(3000, () => console.log('Listening on :3000'));
EOF

node /tmp/server.js &
PID=$!
```

## 第一步：pmap 全景

```bash
pmap -x $PID
```

输出：

```
Address           Kbytes   RSS   Dirty Mode  Mapping
0000000000400000    1024   1024       0 r-x-- node
0000000000600000     512    512       0 r---- node
0000000000680000      64     64      64 rw--- node
0000000001234000   65536  65400   65400 rw---   [ anon ]
...
mapped: 2345678K    writeable/private: 789012K    shared: 12345K
```

关键列：
- **Kbytes**：虚拟地址空间大小
- **RSS**：实际占用的物理内存
- **Dirty**：被修改过的页面
- **Mode**：权限（r=read, w=write, x=execute, s=shared, p=private）

最后一行的汇总：
- **writeable/private**：进程私有的可写内存（通常是堆和栈）
- **shared**：与其他进程共享的内存（通常是共享库和共享内存段）

## 第二步：用 /proc/pid/maps 详细分析

```bash
cat /proc/$PID/maps
```

输出格式：

```
地址范围              权限   偏移     设备  inode  路径
00400000-00500000     r-xp   00000000 08:02 12345  /usr/bin/node
00600000-00680000     r--p   00100000 08:02 12345  /usr/bin/node
00680000-00690000     rw-p   00180000 08:02 12345  /usr/bin/node
01234000-04123000     rw-p   00000000 00:00 0      [heap]
7f1234000000-7f1238000000 rw-p 00000000 00:00 0
7f1238000000-7f123c000000 r-xp 00000000 08:02 67890  /lib/x86_64-linux-gnu/libc-2.31.so
7fff12345000-7fff12367000 rw-p 00000000 00:00 0      [stack]
7fff12389000-7fff1238c000 r--p 00000000 00:00 0      [vvar]
7fff1238c000-7fff1238e000 r-xp 00000000 00:00 0      [vdso]
ffffffffff600000-ffffffffff601000 r-xp 00000000 00:00 0  [vsyscall]
```

区域分类：

1. **代码段**（r-xp）：可执行文件和共享库的代码
2. **数据段**（r--p, rw-p）：可执行文件和共享库的数据
3. **堆**（[heap]）：malloc 分配的内存
4. **匿名映射**（rw-p, 无路径）：mmap 分配的内存
5. **栈**（[stack]）：线程栈
6. **vvar/vdso**：内核导出的用户态数据和代码

## 第三步：用 smaps 分析物理内存分布

```bash
cat /proc/$PID/smaps | head -50
```

smaps 比 maps 多了每个区域的详细内存统计：

```
01234000-04123000 rw-p 00000000 00:00 0          [heap]
Size:              262144 kB    # 虚拟大小
Rss:               262000 kB    # 实际占用物理内存
Pss:               262000 kB    # 按比例分摊的物理内存
Shared_Clean:           0 kB    # 共享的干净页面
Shared_Dirty:           0 kB    # 共享的脏页面
Private_Clean:          0 kB    # 私有的干净页面
Private_Dirty:     262000 kB    # 私有的脏页面
Referenced:        262000 kB    # 最近访问过的页面
Anonymous:         262000 kB    # 匿名页面（非文件映射）
Swap:                   0 kB    # 被 swap 出去的大小
```

关键指标：
- **PSS**（Proportional Set Size）：如果多个进程共享一个页面，PSS 按比例分摊。比如两个进程共享一个 4KB 页面，每个进程的 PSS 增加 2KB。
- **Private_Dirty**：只有本进程使用的脏页面，这是进程"真正独占"的内存。

```bash
# 汇总所有区域的 PSS
cat /proc/$PID/smaps | grep "^Pss:" | awk '{sum+=$2} END {print "Total PSS:", sum, "kB"}'

# 查看 smaps_rollup（汇总视图）
cat /proc/$PID/smaps_rollup
```

## 第四步：分析内存的实际使用

```bash
# 1. 找出占用内存最多的区域
cat /proc/$PID/smaps | awk '/^[0-9a-f]/{region=$0} /^Pss:/{print $2, region}' | sort -rn | head -10

# 2. 统计匿名内存（堆+mmap）
cat /proc/$PID/smaps | awk '/^Anonymous:/{sum+=$2} END {print "Anonymous memory:", sum, "kB"}'

# 3. 统计文件映射内存
cat /proc/$PID/smaps | awk '/^Anonymous:/{anon=$2} /^Pss:/{pss=$2} /^Pss:/ && anon==0{file_sum+=pss} END {print "File-backed memory:", file_sum, "kB"}'
```

## 第五步：对比 pmap 和 /proc 数据

```bash
# pmap 的汇总
pmap -X $PID | tail -1

# /proc 的汇总
cat /proc/$PID/status | grep -E "^(VmPeak|VmRSS|VmData|VmStk|VmLib)"

# 数值对比
echo "pmap RSS vs /proc RSS"
pmap -X $PID | awk '/total/{print "pmap RSS:", $3, "kB"}'
cat /proc/$PID/status | awk '/VmRSS/{print "/proc RSS:", $2, "kB"}'
```

两者的 RSS 应该接近但不完全相同，因为：
- pmap 统计时进程内存可能在变化
- 统计口径略有不同

## 第六步：观察内存变化

```bash
# 发送请求，观察内存变化
for i in $(seq 1 100); do
    curl -s http://localhost:3000/ > /dev/null
done

# 再次查看
pmap -x $PID | tail -1
cat /proc/$PID/status | grep VmRSS
```

## 练习

### 练习一：分析一个 Java 进程的内存布局

如果你有 Java 环境，启动一个简单的 Java 程序：

```bash
java -Xmx256m -Xms128m -jar myapp.jar &
```

分析：
1. Java 堆在 maps 中对应哪个区域
2. JIT 编译的代码在哪个区域
3. 共享库（.so 文件）占用了多少内存

### 练习二：写一个内存分析脚本

写一个 shell 脚本，输入 PID，输出：
1. 总虚拟内存、RSS、PSS
2. 占用最多的 5 个内存区域
3. 匿名内存 vs 文件映射内存的比例
4. 是否有 swap 使用

---

## 参考答案

### 练习一

**关键观察**：
- Java 堆是一个大的匿名映射区域（rw-p，[anon]），大小接近 `-Xmx` 设置
- JIT 代码在 `[anon:JIT code cache]` 区域
- 共享库在标准的 `.so` 映射中
- JVM 本身占用大量内存用于元空间（Metaspace）、线程栈、代码缓存等

### 练习二

```bash
#!/bin/bash
PID=$1
if [ -z "$PID" ] || [ ! -d "/proc/$PID" ]; then
    echo "Usage: $0 <pid>"
    exit 1
fi

echo "=== 进程 $PID 内存分析 ==="
echo ""

echo "--- 总体信息 ---"
cat /proc/$PID/status | grep -E "^(VmPeak|VmSize|VmRSS|VmData|VmStk|VmLib|VmSwap)"
echo ""

echo "--- PSS 汇总 ---"
cat /proc/$PID/smaps_rollup 2>/dev/null || cat /proc/$PID/smaps | awk '/^Pss:/{sum+=$2} END {print "Pss:", sum, "kB"}'
echo ""

echo "--- 占用最多的 5 个区域 ---"
cat /proc/$PID/smaps | awk '/^[0-9a-f]/{region=$0} /^Pss:/{print $2, region}' | sort -rn | head -5
echo ""

echo "--- 匿名 vs 文件映射 ---"
cat /proc/$PID/smaps | awk '
/^Anonymous:/{anon=$2}
/^Pss:/{pss=$2; total+=pss; if(anon>0) anon_sum+=pss; else file_sum+=pss; anon=0}
END {print "Anonymous:", anon_sum, "kB"; print "File-backed:", file_sum, "kB"; print "Total PSS:", total, "kB"}'
```

**关键教训**：RSS 和 PSS 的区别在容器环境中很重要。多个容器可能共享同一个共享库，RSS 会重复计算，PSS 按比例分摊更准确。
