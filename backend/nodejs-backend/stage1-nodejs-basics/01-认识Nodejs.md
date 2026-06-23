# 认识 Node.js

你在浏览器里写了很久的 JavaScript，但 `npm install`、`node app.js`、Vite 的开发服务器——这些都在终端里跑 JavaScript。它怎么离开浏览器的？离开之后能做什么？

## 从 V8 说起

浏览器里 JavaScript 能跑，核心靠的是 V8 引擎——Chrome 团队用 C++ 写的 JS 解释器。Node.js 做的事情很简单：把 V8 从浏览器里拆出来，单独装进一个程序，再给它接上操作系统的能力。

```
浏览器环境                          Node.js 环境
┌──────────────────┐              ┌──────────────────┐
│  你的 JS 代码     │              │  你的 JS 代码     │
├──────────────────┤              ├──────────────────┤
│  V8 引擎          │              │  V8 引擎          │
├──────────────────┤              ├──────────────────┤
│  Web API          │              │  C++ 绑定         │
│  (DOM, fetch,     │              │  (fs, net,        │
│   setTimeout...)  │              │   http, crypto...) │
├──────────────────┤              ├──────────────────┤
│  浏览器            │              │  操作系统          │
└──────────────────┘              └──────────────────┘
```

两边跑的是同一种语言，但能调用的东西不一样。浏览器里你能操作 DOM、发 fetch 请求；Node.js 里你能读写文件、起 HTTP 服务、连数据库。

## 非阻塞 I/O：为什么单线程也能处理高并发

这是 Node.js 最反直觉的地方——它只有一个线程，却能同时处理成千上万个请求。

关键在于：Node.js 在等 I/O（网络请求、文件读写、数据库查询）的时候，不会傻等。它把等待的任务丢给底层的 libuv 线程池，自己继续处理下一个请求。等 I/O 完成了，回调函数会被放进事件循环里执行。

```js
const fs = require('fs')

console.log('A: 准备读文件')

fs.readFile('./data.txt', 'utf-8', (err, data) => {
  // 文件读完才会执行
  console.log('C: 文件内容', data.length, '字节')
})

console.log('B: 不等文件，继续干别的')
// 输出顺序：A → B → C
```

这段代码里，`readFile` 是非阻塞的。调用它之后，Node.js 不会停在那等文件读完，而是继续执行 `console.log('B')`。文件读完后，回调函数才会被执行。

这就是事件循环的核心思想：**不等，先干别的，完成了再通知我**。

```
事件循环简化模型：

  ┌───────────────────────────┐
  │         事件循环            │
  │                           │
  │   ┌───┐                   │
  │   │ 1 │ 检查定时器          │
  │   └─┬─┘                   │
  │     ▼                     │
  │   ┌───┐                   │
  │   │ 2 │ 检查 I/O 回调       │
  │   └─┬─┘                   │
  │     ▼                     │
  │   ┌───┐                   │
  │   │ 3 │ 检查 setImmediate  │
  │   └─┬─┘                   │
  │     ▼                     │
  │   ┌───┐                   │
  │   │ 4 │ 等待新的事件        │
  │   └─┬─┘                   │
  │     │                     │
  │     └── 循环 ─────────────┘
  └───────────────────────────┘
```

这个模型适合 I/O 密集型场景（Web 服务器、API 网关、实时应用），不适合 CPU 密集型计算（视频编码、大量数学运算）。如果某个回调函数里做了大量 CPU 计算，整个事件循环会被阻塞，其他请求都得等。

## Node.js 能做什么

```
适合的场景：
  Web API 服务器 —— 大量并发连接，每个请求主要是 I/O
  实时应用 —— 聊天、协作编辑、通知推送（WebSocket）
  命令行工具 —— 脚手架、构建工具、自动化脚本
  微服务 —— 轻量、启动快、适合容器化

不太适合的场景：
  视频转码、图像处理等 CPU 密集任务
  需要精确内存控制的系统级编程
```

你已经在用很多 Node.js 写的工具了：Webpack、Vite、ESLint、TypeScript 编译器、npm 本身——它们都是 Node.js 程序。

## 体验一下

确认你已经安装了 Node.js（如果没有，下一课会讲安装）：

```bash
# 查看版本
node -v

# 直接运行一段 JS
node -e "console.log(process.version, process.platform)"

# 启动一个最简单的 HTTP 服务器
node -e "
const http = require('http');
const server = http.createServer((req, res) => {
  res.end('Hello from Node.js');
});
server.listen(3000, () => console.log('http://localhost:3000'));
"
```

访问 `http://localhost:3000`，你会看到 "Hello from Node.js"。这四行代码就是一个完整的 Web 服务器——没有 Apache，没有 Nginx，JavaScript 自己就能监听端口、处理请求。

## 关于"单线程"的常见误解

**误解：Node.js 只能用一个 CPU 核心。**

实际上，Node.js 的 JS 执行是单线程的，但底层的 I/O 操作由 libuv 的线程池处理（默认 4 个线程）。而且在生产环境中，你可以用 Cluster 模块或 PM2 启动多个进程，充分利用多核 CPU。

**误解：单线程意味着不能并发。**

并发不等于并行。Node.js 的事件循环让它能高效地在多个请求之间切换——当一个请求在等数据库返回时，另一个请求可以被处理。只是同一时刻确实只有一段 JS 代码在执行。

## 练习

### 练习一：观察非阻塞行为

创建一个文件 `async-demo.js`，要求：

1. 用 `setTimeout` 模拟一个耗时 2 秒的操作
2. 在 setTimeout 之后立即打印 "继续执行"
3. 观察输出顺序，确认 "继续执行" 不会等 2 秒

### 练习二：手动搭建 HTTP 服务器

创建 `my-server.js`，要求：

1. 用 `http.createServer` 创建服务器
2. 根据请求路径返回不同内容：`/` 返回 "首页"，`/about` 返回 "关于"，其他返回 404
3. 监听 3000 端口并用浏览器访问验证

## 参考答案

### 练习一

```js
// async-demo.js
console.log('开始')

setTimeout(() => {
  console.log('2 秒后执行的回调')
}, 2000)

console.log('继续执行')
// 输出：开始 → 继续执行 → (等 2 秒) → 2 秒后执行的回调
```

### 练习二

```js
// my-server.js
const http = require('http')

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')

  if (req.url === '/') {
    res.end('首页')
  } else if (req.url === '/about') {
    res.end('关于')
  } else {
    res.statusCode = 404
    res.end('404 Not Found')
  }
})

server.listen(3000, () => {
  console.log('服务器运行在 http://localhost:3000')
})
```
