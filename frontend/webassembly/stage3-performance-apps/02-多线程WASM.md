# 02 - 多线程 WASM：并行计算架构

## 场景引入

假设你正在处理一张 4K 图片（3840×2160），需要对每个像素执行复杂的数学变换。单线程处理需要遍历约 800 万个像素，即使使用 SIMD 加速，计算量依然庞大。

现代 CPU 通常有 4-8 个核心，但 JavaScript 是单线程的。如何充分利用多核 CPU？答案是 Web Workers + SharedArrayBuffer，让 WASM 模块在多个线程中并行执行。

本课将讲解如何在浏览器中实现多线程 WASM 应用，包括线程间数据共享、同步机制和性能优化。

## 学习目标

- 理解 Web Workers 与 WASM 的结合方式
- 掌握 SharedArrayBuffer 的内存共享机制
- 学会使用 Atomics 进行线程同步
- 能够实现一个简单的线程池
- 了解多线程应用的竞态条件和同步问题

## Web Workers 与 WASM

### 基本架构

```
主线程
├── 创建 SharedArrayBuffer（共享内存）
├── 加载 WASM 模块
└── 启动 Worker 线程
    ├── Worker 1 → 接收共享内存 → 调用 WASM 函数
    ├── Worker 2 → 接收共享内存 → 调用 WASM 函数
    └── Worker N → 接收共享内存 → 调用 WASM 函数
```

主线程和 Worker 线程通过 SharedArrayBuffer 共享同一块内存，避免了数据复制的开销。

### SharedArrayBuffer 基础

SharedArrayBuffer 是 JavaScript 中唯一允许在多个线程间共享内存的机制。与普通的 ArrayBuffer 不同，它可以被 transfer 给多个 Worker，所有 Worker 访问的是同一块物理内存。

```javascript
// main.js — 主线程
const sharedMemory = new WebAssembly.Memory({
    initial: 256,    // 初始 256 页（每页 64KB，共 16MB）
    maximum: 1024,   // 最大 1024 页（64MB）
    shared: true     // 关键：启用共享内存
});

// 创建 Worker 并传递共享内存
const worker = new Worker('worker.js');
worker.postMessage({
    memory: sharedMemory,
    // 其他初始化数据...
});
```

> **注意**：SharedArrayBuffer 需要特定的 HTTP 头才能使用（详见 CORS 头部要求章节）。

### Worker 线程加载 WASM

```javascript
// worker.js — Worker 线程
self.onmessage = async (event) => {
    const { memory, wasmBytes } = event.data;

    // 在 Worker 中编译和实例化 WASM 模块
    const module = await WebAssembly.instantiate(wasmBytes, {
        env: { memory }
    });

    const instance = module.instance;

    // 调用 WASM 函数处理数据
    instance.exports.process_chunk(startIndex, endIndex);

    // 通知主线程处理完成
    self.postMessage({ done: true, startIndex, endIndex });
};
```

## Atomics 操作

### 为什么需要 Atomics

当多个线程同时读写共享内存时，会出现竞态条件。Atomics 提供了一组原子操作，确保操作的完整性。

```javascript
// 非原子操作的问题
let counter = 0;
// 线程 A 读取 counter（值为 0）
// 线程 B 读取 counter（值为 0）
// 线程 A 写入 counter = 1
// 线程 B 写入 counter = 1
// 结果：counter = 1，但预期应该是 2

// 原子操作的正确性
const sharedArray = new Int32Array(sharedBuffer);
// 线程 A：Atomics.add(sharedArray, 0, 1) — 原子读-改-写
// 线程 B：Atomics.add(sharedArray, 0, 1) — 原子读-改-写
// 结果：counter = 2 ✓
```

### 常用 Atomics 操作

```javascript
const shared = new Int32Array(sharedBuffer);

// 原子读写
Atomics.store(shared, index, value);     // 原子写入
Atomics.load(shared, index);             // 原子读取

// 原子读-改-写
Atomics.add(shared, index, value);       // 原子加法，返回旧值
Atomics.sub(shared, index, value);       // 原子减法，返回旧值
Atomics.and(shared, index, value);       // 原子按位与
Atomics.or(shared, index, value);        // 原子按位或
Atomics.xor(shared, index, value);       // 原子按位异或
Atomics.compareExchange(shared, index, expected, replacement); // CAS

// 线程同步
Atomics.wait(shared, index, expectedValue);     // 阻塞等待
Atomics.notify(shared, index, count);            // 唤醒等待的线程
```

## 线程池实现

### Rust 端：工作函数

```rust
// src/lib.rs
use wasm_bindgen::prelude::*;
use std::arch::wasm32::*;

/// 处理数据块：每个线程调用此函数处理自己的数据范围
#[wasm_bindgen]
pub fn process_chunk(data: &mut [f32], start: usize, end: usize, factor: f32) {
    for i in start..end {
        // 示例：对每个元素执行复杂计算
        data[i] = (data[i] * factor).sin().abs();
    }
}

/// SIMD 优化版本的块处理
#[wasm_bindgen]
pub fn process_chunk_simd(data: &mut [f32], start: usize, end: usize, factor: f32) {
    let simd_end = start + ((end - start) / 4) * 4;

    unsafe {
        let factor_vec = f32x4_splat(factor);
        for i in (start..simd_end).step_by(4) {
            let v = v128_load(data.as_ptr().add(i) as *const v128);
            let scaled = f32x4_mul(v, factor_vec);
            // 注意：sin/abs 等复杂函数需要逐元素计算或用多项式近似
            // 这里简化处理
            let mut temp = [0.0f32; 4];
            v128_store(temp.as_mut_ptr() as *mut v128, scaled);
            for j in 0..4 {
                temp[j] = temp[j].sin().abs();
            }
            v128_store(data.as_ptr().add(i) as *mut v128,
                       v128_load(temp.as_ptr() as *const v128));
        }
    }

    // 处理尾部
    for i in simd_end..end {
        data[i] = (data[i] * factor).sin().abs();
    }
}
```

### JavaScript 端：线程池

```javascript
// thread-pool.js
class ThreadPool {
    constructor(workerScript, numThreads) {
        this.workers = [];
        this.taskQueue = [];
        this.numThreads = numThreads;
        this.busyFlags = new Int32Array(new SharedArrayBuffer(numThreads * 4));

        // 创建 Worker 线程
        for (let i = 0; i < numThreads; i++) {
            const worker = new Worker(workerScript);
            worker.threadId = i;
            worker.onmessage = (e) => this._onWorkerDone(worker, e);
            this.workers.push(worker);
        }
    }

    // 分发任务到空闲的 Worker
    dispatch(task) {
        const idleWorker = this.workers.find((w, i) =>
            Atomics.load(this.busyFlags, i) === 0
        );

        if (idleWorker) {
            this._execute(idleWorker, task);
        } else {
            this.taskQueue.push(task);
        }
    }

    _execute(worker, task) {
        Atomics.store(this.busyFlags, worker.threadId, 1);
        worker.postMessage(task);
    }

    _onWorkerDone(worker, event) {
        Atomics.store(this.busyFlags, worker.threadId, 0);

        if (this.taskQueue.length > 0) {
            const nextTask = this.taskQueue.shift();
            this._execute(worker, nextTask);
        }

        if (event.data.callback) {
            event.data.callback(event.data.result);
        }
    }

    terminate() {
        this.workers.forEach(w => w.terminate());
    }
}

// 使用示例
const pool = new ThreadPool('worker.js', navigator.hardwareConcurrency || 4);

// 分发并行任务
function parallelProcess(data, factor) {
    const chunkSize = Math.ceil(data.length / pool.numThreads);
    const promises = [];

    for (let i = 0; i < pool.numThreads; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, data.length);

        promises.push(new Promise((resolve) => {
            pool.dispatch({
                type: 'process',
                data, start, end, factor,
                callback: resolve
            });
        }));
    }

    return Promise.all(promises);
}
```

## 数据并行：图像处理示例

### 并行灰度化

```rust
// src/lib.rs
#[wasm_bindgen]
pub fn grayscale_chunk(
    pixels: &mut [u8],
    start: usize,
    end: usize
) {
    // 每 4 个字节为一个像素（RGBA）
    let pixel_start = (start / 4) * 4;
    let pixel_end = ((end + 3) / 4) * 4;

    for i in (pixel_start..pixel_end).step_by(4) {
        let r = pixels[i] as f32;
        let g = pixels[i + 1] as f32;
        let b = pixels[i + 2] as f32;

        // 加权灰度公式
        let gray = (0.299 * r + 0.587 * g + 0.114 * b) as u8;

        pixels[i] = gray;
        pixels[i + 1] = gray;
        pixels[i + 2] = gray;
        // Alpha 通道不变
    }
}
```

### 并行矩阵乘法

```rust
// src/lib.rs
#[wasm_bindgen]
pub fn matrix_multiply_chunk(
    a: &[f32],
    b: &[f32],
    c: &mut [f32],
    rows: usize,
    cols: usize,
    inner: usize,
    row_start: usize,
    row_end: usize
) {
    for i in row_start..row_end {
        for j in 0..cols {
            let mut sum = 0.0;
            for k in 0..inner {
                sum += a[i * inner + k] * b[k * cols + j];
            }
            c[i * cols + j] = sum;
        }
    }
}
```

## 竞态条件与同步

### 常见竞态条件

```javascript
// 错误示例：多个线程同时写入同一位置
// 线程 A：result[0] = valueA
// 线程 B：result[0] = valueB
// 最终结果不确定

// 正确做法：每个线程写入不同的内存区域
const chunkSize = Math.ceil(data.length / numThreads);
const threadId = /* 当前线程 ID */;
const start = threadId * chunkSize;
const end = Math.min(start + chunkSize, data.length);
// 只写入 [start, end) 范围
```

### 使用 Atomics 同步

```javascript
// barrier 实现：等待所有线程到达同步点
class Barrier {
    constructor(numThreads) {
        this.numThreads = numThreads;
        this.count = new Int32Array(new SharedArrayBuffer(4));
        this.generation = new Int32Array(new SharedArrayBuffer(4));
    }

    wait() {
        const gen = Atomics.load(this.generation, 0);
        const arrived = Atomics.add(this.count, 0, 1) + 1;

        if (arrived === this.numThreads) {
            // 最后到达的线程重置计数器并推进代数
            Atomics.store(this.count, 0, 0);
            Atomics.add(this.generation, 0, 1);
            Atomics.notify(this.generation, 0);
        } else {
            // 等待代数变化
            while (Atomics.load(this.generation, 0) === gen) {
                Atomics.wait(this.generation, 0, gen);
            }
        }
    }
}
```

## postMessage vs SharedMemory 性能对比

```javascript
// 方式一：postMessage 传递数据（会复制）
const data = new Float32Array(1_000_000);
const start1 = performance.now();
worker.postMessage(data.buffer); // 复制 4MB 数据
const time1 = performance.now() - start1;

// 方式二：SharedArrayBuffer 共享数据（零复制）
const shared = new SharedArrayBuffer(4_000_000);
const sharedData = new Float32Array(shared);
const start2 = performance.now();
worker.postMessage({ shared }); // 只传递引用
const time2 = performance.now() - start2;

console.log(`postMessage: ${time1.toFixed(2)}ms`);
console.log(`SharedArrayBuffer: ${time2.toFixed(2)}ms`);
// 对于大数据集，SharedArrayBuffer 通常快 10-100 倍
```

## CORS 头部要求

SharedArrayBuffer 的使用需要以下 HTTP 头部：

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### 开发服务器配置

```javascript
// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

    const headers = {
        'Content-Type': getContentType(filePath),
        // 关键头部：启用 SharedArrayBuffer
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
    };

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            res.writeHead(200, headers);
            res.end(data);
        }
    });
});

server.listen(8080, () => {
    console.log('服务器运行在 http://localhost:8080');
});
```

## 常见误区

**1. 认为 SharedArrayBuffer 是"免费"的**

虽然 SharedArrayBuffer 避免了数据复制，但它引入了同步开销。Atomics 操作比普通内存访问慢，线程等待也会消耗 CPU。对于小数据集，postMessage 可能更简单高效。

**2. 忽略内存对齐和缓存行**

现代 CPU 的缓存行通常为 64 字节。如果两个线程频繁写入同一个缓存行中的不同变量，会产生"伪共享"（false sharing），导致性能下降。解决方案是让每个线程独占一个缓存行。

**3. 过度使用 Atomics.wait**

Atomics.wait 是阻塞操作，会暂停当前线程。在 Worker 中使用它不会阻塞主线程，但会浪费 CPU 资源。应该优先使用消息传递而非忙等待。

**4. 忘记处理 Worker 错误**

Worker 中的错误不会冒泡到主线程。必须在 Worker 中添加 onerror 处理器，并在主线程中监听 worker.onerror。

## 工程建议

1. **合理设置线程数**：通常等于 `navigator.hardwareConcurrency`（CPU 核心数）。线程数过多会导致上下文切换开销
2. **任务粒度适中**：每个线程处理的数据量太小，调度开销会抵消并行收益；太大则负载不均衡
3. **使用 Transferable 对象**：如果必须用 postMessage，传递 ArrayBuffer 的所有权而非复制
4. **测试兼容性**：SharedArrayBuffer 在 Safari 中的支持有限（iOS 不支持），需要回退方案
5. **监控内存使用**：共享内存不会被垃圾回收，需要手动管理生命周期

## 小结

多线程 WASM 通过 Web Workers + SharedArrayBuffer 实现真正的并行计算：

- SharedArrayBuffer 允许多个线程访问同一块内存
- Atomics 提供原子操作和线程同步原语
- 线程池可以复用 Worker，避免频繁创建/销毁的开销
- 需要特定的 HTTP 头部才能启用 SharedArrayBuffer
- 竞态条件是多线程编程的核心挑战

## 练习

### 练习一：并行数组求和

实现一个并行数组求和函数，使用多个 Worker 线程对一个大数组的不同部分求和，最后在主线程合并结果。

### 练习二：生产者-消费者模式

实现一个生产者-消费者队列，使用 SharedArrayBuffer 和 Atomics 实现线程安全的环形缓冲区。

### 练习三：性能对比

对比单线程和多线程版本的图像灰度化性能，记录不同线程数（1、2、4、8）下的处理时间。

---

## 参考答案

### 练习一

**思路**：将数组分成 N 块，每个 Worker 计算一块的部分和，主线程用 Atomics 收集结果。

```rust
// src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn partial_sum(data: &[f32], start: usize, end: usize) -> f32 {
    let mut sum = 0.0;
    for i in start..end {
        sum += data[i];
    }
    sum
}
```

```javascript
// main.js
async function parallelSum(data) {
    const numThreads = navigator.hardwareConcurrency || 4;
    const chunkSize = Math.ceil(data.length / numThreads);

    // 用于存储各线程的部分和
    const results = new Float64Array(numThreads);
    const sharedResults = new SharedArrayBuffer(numThreads * 8);
    const sharedView = new Float64Array(sharedResults);

    const promises = [];
    for (let i = 0; i < numThreads; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, data.length);

        promises.push(new Promise((resolve) => {
            const worker = new Worker('sum-worker.js');
            worker.postMessage({
                data: data.slice(start, end), // 实际生产中应传 SharedArrayBuffer
                threadId: i,
                start: 0,
                end: end - start,
                sharedResults
            });
            worker.onmessage = (e) => {
                sharedView[e.data.threadId] = e.data.sum;
                resolve();
            };
        }));
    }

    await Promise.all(promises);

    // 合并结果
    let total = 0;
    for (let i = 0; i < numThreads; i++) {
        total += sharedView[i];
    }
    return total;
}
```

```javascript
// sum-worker.js
self.onmessage = async (e) => {
    const { data, threadId, start, end, sharedResults } = e.data;

    // 加载 WASM 模块
    const module = await WebAssembly.instantiate(wasmBytes, imports);
    const sum = module.instance.exports.partial_sum(data, start, end);

    // 写入共享结果
    const view = new Float64Array(sharedResults);
    Atomics.store(view, threadId * 8 / 4, sum); // 注意对齐

    self.postMessage({ threadId, sum });
};
```

**要点**：
- 每个线程计算自己负责的部分和，避免写入冲突
- 使用 SharedArrayBuffer 传递结果比 postMessage 更高效
- 注意 Float64Array 的索引计算（每个元素 8 字节）

### 练习二

**思路**：用 SharedArrayBuffer 实现环形缓冲区，head 和 tail 指针用 Atomics 操作保护。

```javascript
// ring-buffer.js
class SharedRingBuffer {
    constructor(capacity) {
        // 布局：[capacity][head][tail][data...]
        this.buffer = new SharedArrayBuffer(12 + capacity * 4);
        this.header = new Int32Array(this.buffer, 0, 3);
        this.data = new Int32Array(this.buffer, 12, capacity);
        this.capacity = capacity;

        Atomics.store(this.header, 0, capacity);
        Atomics.store(this.header, 1, 0); // head
        Atomics.store(this.header, 2, 0); // tail
    }

    // 生产者：入队
    enqueue(value) {
        while (true) {
            const head = Atomics.load(this.header, 1);
            const tail = Atomics.load(this.header, 2);
            const nextHead = (head + 1) % this.capacity;

            if (nextHead === tail) {
                // 队列满，等待消费者
                Atomics.wait(this.header, 2, tail);
                continue;
            }

            if (Atomics.compareExchange(this.header, 1, head, nextHead) === head) {
                Atomics.store(this.data, head, value);
                Atomics.notify(this.header, 2, 1); // 唤醒消费者
                return true;
            }
            // CAS 失败，重试
        }
    }

    // 消费者：出队
    dequeue() {
        while (true) {
            const head = Atomics.load(this.header, 1);
            const tail = Atomics.load(this.header, 2);

            if (tail === head) {
                // 队列空，等待生产者
                Atomics.wait(this.header, 1, head);
                continue;
            }

            const value = Atomics.load(this.data, tail);
            const nextTail = (tail + 1) % this.capacity;

            if (Atomics.compareExchange(this.header, 2, tail, nextTail) === tail) {
                Atomics.notify(this.header, 1, 1); // 唤醒生产者
                return value;
            }
            // CAS 失败，重试
        }
    }
}
```

**要点**：
- CAS（Compare-And-Swap）是实现无锁数据结构的基础
- 环形缓冲区需要一个额外的槽位来区分满和空
- Atomics.wait/notify 实现了高效的线程间通信

### 练习三

**思路**：用不同线程数运行灰度化任务，记录处理时间并计算加速比。

```javascript
async function benchmarkGrayscale() {
    const width = 1920;
    const height = 1080;
    const pixels = new Uint8Array(width * height * 4);

    // 填充随机像素数据
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] = Math.floor(Math.random() * 256);
    }

    const threadCounts = [1, 2, 4, 8];
    const results = [];

    for (const numThreads of threadCounts) {
        const shared = new SharedArrayBuffer(pixels.length);
        const sharedPixels = new Uint8Array(shared);
        sharedPixels.set(pixels);

        const chunkSize = Math.ceil(pixels.length / numThreads);
        const startTime = performance.now();

        const promises = [];
        for (let i = 0; i < numThreads; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, pixels.length);

            promises.push(new Promise((resolve) => {
                const worker = new Worker('grayscale-worker.js');
                worker.postMessage({ shared, start, end });
                worker.onmessage = () => resolve();
            }));
        }

        await Promise.all(promises);
        const elapsed = performance.now() - startTime;

        results.push({ threads: numThreads, time: elapsed });
        console.log(`${numThreads} 线程: ${elapsed.toFixed(2)}ms`);
    }

    // 计算加速比
    const baseline = results[0].time;
    for (const r of results) {
        r.speedup = baseline / r.time;
        console.log(`${r.threads} 线程加速比: ${r.speedup.toFixed(2)}x`);
    }

    return results;
}
```

**要点**：
- 理想情况下，4 线程应有接近 4 倍的加速
- 实际加速比受内存带宽、线程调度和负载均衡影响
- 8 线程可能不如 4 线程快（如果 CPU 只有 4 核）
