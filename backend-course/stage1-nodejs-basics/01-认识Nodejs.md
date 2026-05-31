# 第一课：认识 Node.js

## 学习目标

完成本课学习后，你将能够：

1. 理解 Node.js 的本质以及它与浏览器 JavaScript 的关系
2. 了解 V8 引擎的工作原理
3. 掌握事件驱动、非阻塞 I/O 模型的核心思想
4. 知道 Node.js 的典型应用场景
5. 理解单线程模型以及为什么它能处理高并发

---

## 一、Node.js 是什么

### 1.1 一句话定义

> **Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境，让 JavaScript 可以在浏览器之外运行。**

作为前端开发者，你每天都在写 JavaScript。但你有没有想过：JavaScript 只能运行在浏览器里吗？

答案是：**不是的。**

### 1.2 一个生活类比

想象一下你是一位厨师（JavaScript 开发者）：

```
浏览器 = 你家里的厨房
  - 你只能在这里做饭
  - 厨房自带锅碗瓢盆（DOM、BOM、Web API）
  - 做好的菜只能给家里人吃（用户浏览器）

Node.js = 街边的餐车
  - 你可以在外面做饭了！
  - 餐车有自己的工具（文件系统、网络、进程等）
  - 可以为更多人服务（服务器端、命令行工具等）
```

**关键理解：** 语言还是同一个 JavaScript，只是运行环境变了。就像同一个厨师，在家做饭和在餐车做饭，用的厨具不同，能做的事情也不同。

### 1.3 浏览器 JS vs Node.js 对比

```
┌─────────────────────────────────────────────────────────────────┐
│                        JavaScript 语言                          │
├────────────────────────────┬────────────────────────────────────┤
│      浏览器环境             │          Node.js 环境              │
├────────────────────────────┼────────────────────────────────────┤
│ 运行在用户的浏览器中         │ 运行在服务器（或本地电脑）上        │
│ 全局对象：window            │ 全局对象：global                   │
│ 可操作 DOM、BOM             │ 没有 DOM、BOM                     │
│ 可用 Web API (fetch等)      │ 有 fs、http、path 等内置模块       │
│ 主要用于：页面交互、UI渲染    │ 主要用于：服务器、API、工具开发     │
│ 模块系统：ES Modules 为主    │ 模块系统：CommonJS + ES Modules    │
│ 由浏览器厂商实现(Chrome/FF等) │ 由 Node.js 社区维护               │
└────────────────────────────┴────────────────────────────────────┘
```

### 1.4 历史背景

Node.js 由 **Ryan Dahl** 于 2009 年创建。他当时的想法很简单：

> "JavaScript 已经有了一个非常快的引擎（V8），为什么只让它在浏览器里跑呢？"

在此之前，JavaScript 被困在浏览器这个"笼子"里。Node.js 的出现，让 JavaScript "解放"了——它可以操作文件、创建服务器、连接数据库、执行系统命令。

---

## 二、V8 引擎的工作原理

### 2.1 什么是 V8

**V8** 是 Google 开发的高性能 JavaScript 引擎，最初为 Chrome 浏览器设计。Node.js 之所以选择 V8，是因为它是当时（也是现在）最快的 JS 引擎之一。

你写的每一行 JavaScript 代码，最终都要经过 V8 的"加工"才能被计算机执行。

### 2.2 V8 的执行流程

```
你写的 JavaScript 代码
        │
        ▼
┌──────────────────┐
│   词法分析        │  将代码拆分成一个个 Token（词法单元）
│   (Tokenize)     │  例: const x = 10 → [const] [x] [=] [10]
└──────────────────┘
        │
        ▼
┌──────────────────┐
│   语法分析        │  将 Token 组成 AST（抽象语法树）
│   (Parse)        │  理解代码的结构和含义
└──────────────────┘
        │
        ▼
┌──────────────────┐
│   字节码生成       │  将 AST 编译成字节码
│   (Ignition)     │  字节码是介于源码和机器码之间的中间表示
└──────────────────┘
        │
        ▼
┌──────────────────┐
│   JIT 优化编译    │  对热点代码（频繁执行的代码）进行优化
│   (TurboFan)     │  将字节码编译成高效的机器码
└──────────────────┘
        │
        ▼
    计算机执行
```

### 2.3 用生活类比理解 JIT

**JIT（Just-In-Time）编译** 是 V8 的核心优化策略：

```
类比：翻译一本书

逐行翻译（解释执行）：
  - 翻译一句，读一句，再翻译下一句
  - 启动快，但速度慢
  - 相当于 Ignition（字节码解释器）

整段翻译（JIT 编译）：
  - 发现某一段话被反复阅读
  - 干脆把这一段翻译好，以后直接读翻译版
  - 相当于 TurboFan（优化编译器）
```

**实际意义：** 这就是为什么 Node.js 的性能可以接近 C/C++ 级别——V8 会把你的 JavaScript 代码"热编译"成高效的机器码。

### 2.4 前端开发者已经用过 V8 了

实际上，你每天都在和 V8 打交道：

- **Chrome DevTools** 里运行的 JavaScript 就是 V8 在执行
- **Create React App / Vite** 的开发服务器就是 Node.js 进程
- **npm install** 的背后也是 Node.js（也就是 V8）在运行

---

## 三、事件驱动与非阻塞 I/O

这是 Node.js 最核心的设计思想，也是它能高效处理大量并发请求的关键。

### 3.1 先理解什么是 I/O

**I/O（Input/Output）** 就是输入输出操作：

- 读取文件 = 磁盘 I/O
- 查询数据库 = 数据库 I/O
- 调用远程 API = 网络 I/O
- 读取用户输入 = 标准输入 I/O

**关键事实：** I/O 操作非常慢（相对 CPU 而言）。

```
速度对比（近似值）：

CPU 执行一条指令：     1 纳秒
内存访问：            100 纳秒
SSD 磁盘读取：    100,000 纳秒（0.1 毫秒）
网络请求：     10,000,000 纳秒（10 毫秒）

磁盘比 CPU 慢 10 万倍
网络比 CPU 慢 1000 万倍
```

### 3.2 阻塞 vs 非阻塞

#### 类比：餐厅服务员

**阻塞模型（传统模式）：**
```
服务员 A 接待顾客 1：
  1. 顾客点菜 → 服务员在旁边等（阻塞）
  2. 厨师做菜 → 服务员继续等（阻塞）
  3. 菜做好了 → 服务员端给顾客
  4. 才能去接待顾客 2

问题：如果同时来了 100 个顾客，需要 100 个服务员！
```

**非阻塞模型（Node.js 模式）：**
```
服务员（单线程）接待所有顾客：
  1. 顾客 1 点菜 → 服务员记下订单，交给厨房，立刻去接待顾客 2
  2. 顾客 2 点菜 → 服务员记下订单，交给厨房，立刻去接待顾客 3
  3. 厨房喊"菜好了" → 服务员把菜端给顾客 1
  4. 继续处理其他事情...

优势：一个服务员就能处理很多顾客！
```

### 3.3 代码对比

**阻塞式（同步）代码：**
```javascript
// ❌ 阻塞式：读取文件时，程序会"卡住"等待
const fs = require('fs');

console.log('开始');
const data = fs.readFileSync('./data.txt', 'utf-8');  // 卡住，等文件读完
console.log('文件内容:', data);
console.log('结束');

// 输出顺序：
// 开始
// 文件内容: ...
// 结束
// （中间会等待，如果文件很大，程序会"卡"很久）
```

**非阻塞式（异步）代码：**
```javascript
// ✅ 非阻塞式：读取文件时，程序继续往下执行
const fs = require('fs');

console.log('开始');
fs.readFile('./data.txt', 'utf-8', (err, data) => {
    // 这个回调函数会在文件读取完成后才执行
    console.log('文件内容:', data);
});
console.log('结束');

// 输出顺序：
// 开始
// 结束           ← 注意！先输出了"结束"
// 文件内容: ...   ← 文件读完后才执行
```

### 3.4 事件驱动模型图解

```
┌──────────────────────────────────────────────────────────┐
│                    Node.js 运行时                         │
│                                                          │
│  ┌─────────────┐                                         │
│  │   单线程     │  ← 你的 JavaScript 代码在这里执行        │
│  │  (主线程)    │                                         │
│  └──────┬──────┘                                         │
│         │                                                │
│         │ 发起 I/O 请求                                   │
│         ▼                                                │
│  ┌─────────────┐    ┌──────────────────────────────────┐ │
│  │  事件循环    │◄───│         事件队列                   │ │
│  │(Event Loop) │    │  [完成的I/O回调] [定时器回调] ...   │ │
│  └──────┬──────┘    └──────────────────────────────────┘ │
│         │                                                │
│         │ 委托给                                          │
│         ▼                                                │
│  ┌─────────────┐                                         │
│  │  线程池      │  ← libuv 提供的后台线程                 │
│  │ (工作线程)   │     处理文件 I/O、DNS 查询等             │
│  │ 线程1 线程2  │                                         │
│  │ 线程3 线程4  │                                         │
│  └─────────────┘                                         │
└──────────────────────────────────────────────────────────┘
```

**关键点：**
- **主线程**（你的 JS 代码）是单线程的
- **I/O 操作**被委托给 libuv 的线程池（后台线程）
- I/O 完成后，回调函数被放入**事件队列**
- **事件循环**不断检查队列，有任务就执行

---

## 四、事件循环详解

**事件循环（Event Loop）** 是 Node.js 的心脏，理解它就理解了 Node.js 为什么能"单线程高并发"。

### 4.1 事件循环的执行阶段

```
   ┌───────────────────────────┐
┌─>│         timers             │  ← 执行 setTimeout、setInterval 的回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks      │  ← 执行系统级回调（如 TCP 错误）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare        │  ← 内部使用
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │         poll               │  ← 获取新的 I/O 事件
│  │  （最重要的阶段）            │    执行 I/O 相关的回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │         check              │  ← 执行 setImmediate 的回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     close callbacks        │  ← 执行关闭事件的回调
│  └─────────────┬─────────────┘
│                │
└────────────────┘  循环继续...
```

### 4.2 一个完整的例子

```javascript
// 演示事件循环的执行顺序
const fs = require('fs');

console.log('1. 同步代码 - 开始');

setTimeout(() => {
    console.log('2. setTimeout 回调（宏任务）');
}, 0);

setImmediate(() => {
    console.log('3. setImmediate 回调');
});

fs.readFile(__filename, () => {
    console.log('4. I/O 回调（文件读取完成）');

    setTimeout(() => {
        console.log('5. I/O 内部的 setTimeout');
    }, 0);

    setImmediate(() => {
        console.log('6. I/O 内部的 setImmediate');
    });
});

process.nextTick(() => {
    console.log('7. process.nextTick（微任务）');
});

Promise.resolve().then(() => {
    console.log('8. Promise 回调（微任务）');
});

console.log('9. 同步代码 - 结束');

// 可能的输出顺序：
// 1. 同步代码 - 开始
// 9. 同步代码 - 结束
// 7. process.nextTick（微任务）
// 8. Promise 回调（微任务）
// 2. setTimeout 回调（宏任务）
// 3. setImmediate 回调
// 4. I/O 回调（文件读取完成）
// 5. I/O 内部的 setTimeout
// 6. I/O 内部的 setImmediate
```

### 4.3 宏任务与微任务

```
执行优先级：

  同步代码（最先执行）
       │
       ▼
  微任务（Microtask）
  ├── process.nextTick  ← 优先级最高
  └── Promise.then/catch
       │
       ▼
  宏任务（Macrotask）
  ├── setTimeout / setInterval
  ├── setImmediate
  └── I/O 回调

规则：
1. 同步代码全部执行完
2. 清空所有微任务队列
3. 执行一个宏任务
4. 再清空所有微任务
5. 重复 3-4
```

### 4.4 前端开发者请注意

如果你熟悉浏览器的事件循环，以下是关键区别：

```
浏览器事件循环：                Node.js 事件循环：
  - 宏任务队列                   - 6 个阶段的事件循环
  - 微任务队列                   - 微任务在每个阶段之间执行
  - requestAnimationFrame       - 没有 RAF（没有 UI）
  - 渲染步骤                     - 没有渲染
```

---

## 五、Node.js 的应用场景

### 5.1 Web API / 后端服务

这是 Node.js 最常见的用途——构建 RESTful API 或 GraphQL API。

```
前端 (React/Vue)          后端 (Node.js)           数据库
┌──────────────┐         ┌──────────────┐        ┌──────────┐
│              │  HTTP   │  Express     │  SQL   │          │
│  用户界面    │◄───────►│  REST API    │◄──────►│ MongoDB  │
│              │  请求   │              │  查询  │ MySQL    │
└──────────────┘         └──────────────┘        └──────────┘
```

### 5.2 实时应用

Node.js 天然适合实时场景（聊天、协作编辑、推送通知）：

```javascript
// 使用 Socket.io 实现实时聊天（示例）
const { Server } = require('socket.io');
const io = new Server(3000);

io.on('connection', (socket) => {
    console.log('用户已连接');

    socket.on('chat message', (msg) => {
        // 广播给所有连接的客户端
        io.emit('chat message', msg);
    });

    socket.on('disconnect', () => {
        console.log('用户已断开');
    });
});
```

### 5.3 CLI 工具

很多你常用的前端工具都是 Node.js 写的：

```
你每天用的工具：         它们都是 Node.js 应用：

  npm install           → npm 是 Node.js 写的
  npx create-react-app  → CRA 脚手架
  vite dev              → Vite 开发服务器
  eslint src/           → ESLint 代码检查
  prettier --write      → Prettier 代码格式化
  webpack               → Webpack 打包工具
```

### 5.4 微服务

```
┌─────────────────────────────────────────────────┐
│                 微服务架构                        │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ 用户服务  │  │ 文章服务  │  │ 评论服务  │      │
│  │ (Node.js)│  │ (Node.js)│  │ (Node.js)│      │
│  └──────────┘  └──────────┘  └──────────┘      │
│       ▲              ▲              ▲            │
│       └──────────────┼──────────────┘            │
│                      │                           │
│              API Gateway                         │
└─────────────────────────────────────────────────┘
```

### 5.5 前端工具链

```
开发流程中 Node.js 的角色：

  代码编写 → ESLint 检查 → Prettier 格式化 → Webpack/Vite 打包
       │          │              │                    │
       └──────────┴──────────────┴────────────────────┘
                    全部运行在 Node.js 上！
```

---

## 六、Node.js 与前端框架的关系

### 6.1 澄清一个常见误解

```
❌ 错误理解：Node.js 是前端框架

✅ 正确理解：
   - React、Vue、Angular = 前端框架/库（运行在浏览器）
   - Node.js = 后端运行时环境（运行在服务器）
   - 前端框架的开发工具链依赖 Node.js，但框架本身运行在浏览器
```

### 6.2 它们如何协作

```
开发阶段：
  ┌──────────────────────────────────────────────┐
  │  你的电脑（开发环境）                           │
  │                                               │
  │  Node.js 进程                                  │
  │  ├── 运行 Vite/Webpack 开发服务器              │
  │  ├── 热更新（HMR）                             │
  │  ├── 编译 JSX/TS → 浏览器能识别的 JS           │
  │  └── 代理 API 请求到后端                       │
  └──────────────────────────────────────────────┘

生产阶段：
  ┌────────────┐        ┌────────────┐
  │  CDN/服务器  │        │   服务器    │
  │  静态文件    │  HTTP  │  Node.js   │
  │  (React打包)│◄─────►│  Express   │
  │  index.html │        │  API 服务  │
  └────────────┘        └────────────┘
    前端代码                后端代码
```

---

## 七、单线程模型详解

### 7.1 为什么选择单线程

传统服务器（如 Java、PHP）通常为每个请求分配一个线程：

```
传统多线程模型：

  请求 1 ──→ [线程 1] ──→ 处理 ──→ 返回
  请求 2 ──→ [线程 2] ──→ 处理 ──→ 返回
  请求 3 ──→ [线程 3] ──→ 处理 ──→ 返回
  ...
  请求 N ──→ [线程 N] ──→ 处理 ──→ 返回

问题：
  - 每个线程占用内存（线程栈通常 1-2MB）
  - 线程切换有开销（上下文切换）
  - 1000 个并发 = 1000 个线程 = 大量内存
```

Node.js 的单线程模型：

```
Node.js 模型：

  请求 1 ──┐
  请求 2 ──┤
  请求 3 ──┼──→ [单线程] ──→ 事件循环 ──→ 处理 ──→ 返回
  ...    ──┤      │
  请求 N ──┘      │ 委托 I/O
                   ▼
              [线程池]
```

### 7.2 单线程为什么能高并发

```
关键认知：大多数 Web 请求的时间花在 I/O 上，不是 CPU 计算上

一个典型的 API 请求：
  1. 接收请求        ← 网络 I/O（慢）
  2. 解析 JSON       ← CPU（快）
  3. 查询数据库       ← 数据库 I/O（慢）
  4. 处理数据         ← CPU（快）
  5. 发送响应        ← 网络 I/O（慢）

CPU 占用时间：~1%
I/O 等待时间：~99%

所以：单线程完全够用！
  - 线程在等待 I/O 时，可以去处理其他请求
  - I/O 完成后，通过事件循环回来继续处理
```

### 7.3 单线程的限制

```javascript
// ❌ CPU 密集型任务会阻塞主线程
function heavyComputation() {
    let result = 0;
    for (let i = 0; i < 10000000000; i++) {
        result += Math.sqrt(i);
    }
    return result;
}

console.log('开始计算');
const result = heavyComputation();  // 这会阻塞！其他请求全部等待
console.log('计算完成:', result);
console.log('这行代码很久才能执行到');
```

**解决方案：**
```javascript
// ✅ 使用 Worker Threads 处理 CPU 密集型任务
const { Worker, isMainThread, parentPort } = require('worker_threads');

if (isMainThread) {
    // 主线程
    const worker = new Worker(__filename);
    worker.on('message', (result) => {
        console.log('计算结果:', result);
    });
} else {
    // 工作线程
    let result = 0;
    for (let i = 0; i < 10000000000; i++) {
        result += Math.sqrt(i);
    }
    parentPort.postMessage(result);
}
```

### 7.4 前端开发者应该注意的

```
作为前端开发者，你可能习惯了：

  浏览器主线程 + Web Worker
  ↓ 类似于
  Node.js 主线程 + Worker Threads

区别：
  浏览器：Web Worker 用于不阻塞 UI
  Node.js：Worker Threads 用于不阻塞事件循环
```

---

## 八、Node.js 的版本与发布周期

```
Node.js 版本命名：

  v18.0.0
  │ │ │
  │ │ └── 补丁版本（bug 修复）
  │ └──── 次版本（新功能，向后兼容）
  └────── 主版本（可能有破坏性更新）

版本类型：
  - LTS（Long Term Support）= 长期支持版本，推荐生产使用
  - Current = 最新版本，包含最新特性

版本选择建议：
  - 学习/开发：最新 LTS 版本（如 v20 LTS 或 v22 LTS）
  - 生产环境：LTS 版本
  - 本课程使用：v18+ 或 v20+
```

---

## 九、动手练习

### 练习 1：验证你的环境

```bash
# 在终端中运行以下命令
node -v        # 查看 Node.js 版本
node           # 进入 Node.js REPL（交互式环境）

# 在 REPL 中输入：
> 1 + 1
> console.log('Hello Node.js!')
> process.version
> process.platform
> .exit        # 退出 REPL
```

### 练习 2：体验异步

创建文件 `async-demo.js`：

```javascript
// async-demo.js
const fs = require('fs');

console.log('--- 同步读取 ---');
const start1 = Date.now();
const data1 = fs.readFileSync('./01-认识Nodejs.md', 'utf-8');
console.log(`同步读取耗时: ${Date.now() - start1}ms`);
console.log(`文件大小: ${data1.length} 字符`);

console.log('\n--- 异步读取 ---');
const start2 = Date.now();
fs.readFile('./01-认识Nodejs.md', 'utf-8', (err, data2) => {
    console.log(`异步读取耗时: ${Date.now() - start2}ms`);
    console.log(`文件大小: ${data2.length} 字符`);
});

console.log('这行在异步读取之前输出！');

// 运行：node async-demo.js
// 观察输出顺序，理解同步和异步的区别
```

### 练习 3：观察事件循环

创建文件 `event-loop-demo.js`：

```javascript
// event-loop-demo.js
console.log('1: 同步 - 脚本开始');

setTimeout(() => {
    console.log('2: 宏任务 - setTimeout 0ms');
}, 0);

Promise.resolve().then(() => {
    console.log('3: 微任务 - Promise.then');
}).then(() => {
    console.log('4: 微任务 - Promise 链式调用');
});

process.nextTick(() => {
    console.log('5: 微任务 - nextTick');
});

console.log('6: 同步 - 脚本结束');

// 运行：node event-loop-demo.js
// 预测输出顺序，然后运行验证
```

---

## 十、小结

```
本课核心知识点：

✅ Node.js = V8 引擎 + 内置模块（fs、http、net 等）
✅ 让 JavaScript 从浏览器"解放"出来，可以在服务器端运行
✅ V8 引擎通过 JIT 编译实现高性能
✅ 事件驱动、非阻塞 I/O 是 Node.js 的核心设计思想
✅ 单线程 + 事件循环 + 线程池 = 高并发处理能力
✅ 主要应用场景：Web API、实时应用、CLI 工具、微服务
✅ CPU 密集型任务需要使用 Worker Threads
✅ Node.js 是后端运行时，不是前端框架

下一课预告：
  我们将安装 Node.js，配置开发环境，学习 npm 包管理器。
```

---

> **给前端开发者的话：** 学习 Node.js 不是让你"转后端"，而是让你成为全栈能力更强的前端工程师。理解服务端的工作方式，能帮你写出更好的前端代码——你会知道 API 是怎么工作的、数据是怎么流转的、错误是怎么产生的。这是你成为高级前端工程师的必经之路。
