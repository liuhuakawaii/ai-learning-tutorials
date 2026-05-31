# 第三课：JavaScript 在服务端

## 学习目标

完成本课学习后，你将能够：

1. 理解浏览器 JS 与 Node.js 的核心区别
2. 掌握 CommonJS 和 ES Modules 两种模块系统
3. 了解 Node.js 特有的全局对象和内置类型
4. 能够使用 process 对象获取运行时信息
5. 理解 Buffer 在处理二进制数据中的作用
6. 掌握路径处理的最佳实践

---

## 一、浏览器 JS vs Node.js 的区别

### 1.1 运行环境对比

```
┌─────────────────────────────────────────────────────────────────────┐
│                         JavaScript 语言                              │
├──────────────────────────────┬──────────────────────────────────────┤
│        浏览器环境             │           Node.js 环境               │
├──────────────────────────────┼──────────────────────────────────────┤
│ 全局对象：window / self       │ 全局对象：global / globalThis        │
│ 有 document（DOM）           │ 没有 document                       │
│ 有 navigator、location       │ 没有 navigator、location             │
│ 有 alert、confirm            │ 没有 alert、confirm                  │
│ 有 localStorage/sessionStorage│ 没有（可以用文件/数据库替代）        │
│ 有 XMLHttpRequest / fetch    │ 有 fetch（v18+），也可用 http 模块    │
│ 模块：ES Modules（import）    │ 模块：CommonJS（require）+ ES Modules│
│ 有 requestAnimationFrame    │ 没有 RAF（没有 UI 渲染）              │
│ 有 Web Workers              │ 有 Worker Threads                    │
│ 没有 fs、http、path          │ 有 fs、http、path 等内置模块         │
│ 不能访问文件系统              │ 可以访问文件系统                      │
│ 运行在用户浏览器中            │ 运行在服务器/本地终端中               │
└──────────────────────────────┴──────────────────────────────────────┘
```

### 1.2 一个直观的对比

```javascript
// ========== 浏览器中的 JavaScript ==========

// 操作 DOM
document.getElementById('app').innerHTML = '<h1>Hello</h1>';

// 使用 Web API
localStorage.setItem('name', '张三');
window.location.href = 'https://example.com';

// 发送请求
fetch('/api/users')
    .then(res => res.json())
    .then(data => console.log(data));

// 全局对象
console.log(window);        // Window 对象
console.log(document);      // Document 对象
console.log(navigator.userAgent);  // 浏览器信息
```

```javascript
// ========== Node.js 中的 JavaScript ==========

// 没有 DOM！
// document.getElementById('app');  // ❌ 报错：document is not defined

// 用文件系统替代 localStorage
const fs = require('fs');
fs.writeFileSync('./data.json', JSON.stringify({ name: '张三' }));

// 用内置模块发送请求
const http = require('http');

// 全局对象
console.log(global);        // global 对象（不是 window）
console.log(process);       // 进程信息
console.log(__dirname);     // 当前文件所在目录
```

---

## 二、CommonJS 模块系统

### 2.1 为什么需要模块

```
没有模块的痛苦：

index.html
  <script src="utils.js"></script>
  <script src="api.js"></script>
  <script src="app.js"></script>

问题：
  - 所有变量都在全局作用域，容易冲突
  - 加载顺序依赖手动管理
  - 无法按需加载
  - 代码组织混乱

模块的解决方案：
  - 每个文件是一个独立的作用域
  - 明确的导入导出机制
  - 按需加载
  - 代码组织清晰
```

### 2.2 CommonJS 基础语法

**CommonJS** 是 Node.js 默认的模块系统。

```javascript
// ========== math.js - 导出模块 ==========

// 方式一：逐个导出（推荐）
function add(a, b) {
    return a + b;
}

function subtract(a, b) {
    return a - b;
}

function multiply(a, b) {
    return a * b;
}

// 可以逐个添加到 module.exports
module.exports.add = add;
module.exports.subtract = subtract;
module.exports.multiply = multiply;

// 方式二：一次性导出
module.exports = {
    add,
    subtract,
    multiply,
    PI: 3.14159
};

// 方式三：简写（exports 是 module.exports 的引用）
exports.add = add;
exports.subtract = subtract;
exports.multiply = multiply;
```

```javascript
// ========== app.js - 导入模块 ==========

// 方式一：导入整个模块
const math = require('./math');
console.log(math.add(1, 2));        // 3
console.log(math.subtract(5, 3));   // 2

// 方式二：解构导入
const { add, subtract } = require('./math');
console.log(add(1, 2));             // 3
console.log(subtract(5, 3));        // 2

// 方式三：导入并重命名
const { add: sum, subtract: minus } = require('./math');
console.log(sum(1, 2));             // 3
```

### 2.3 CommonJS 的工作原理

```
require() 做了什么：

const math = require('./math');
           │
           ▼
┌──────────────────────────────────────────────┐
│ 步骤 1：解析路径                                │
│ './math' → '/full/path/to/math.js'            │
│ 会尝试：math.js → math.json → math/index.js   │
└──────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│ 步骤 2：检查缓存                                │
│ 如果这个文件之前加载过，直接返回缓存的结果        │
│ Module._cache = {}                            │
└──────────────────────────────────────────────┘
           │
           ▼（如果没有缓存）
┌──────────────────────────────────────────────┐
│ 步骤 3：编译执行                                │
│ 读取文件内容                                    │
│ 包装成一个函数：                                 │
│ (function(exports, require, module, __filename, __dirname) { │
│   // 你的代码在这里                              │
│ });                                            │
└──────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│ 步骤 4：返回 module.exports                    │
│ 缓存结果，下次 require 直接返回                 │
└──────────────────────────────────────────────┘
```

### 2.4 exports 与 module.exports 的区别

```javascript
// 这是一个常见的坑！

// ========== 情况一：使用 exports 赋值（错误） ==========
// file-a.js
exports = { add, subtract };  // ❌ 这样不行！
// 因为 exports 只是 module.exports 的引用
// 重新赋值 exports 会断开引用关系

// ========== 情况二：使用 module.exports 赋值（正确） ==========
// file-b.js
module.exports = { add, subtract };  // ✅ 正确

// ========== 情况三：给 exports 添加属性（正确） ==========
// file-c.js
exports.add = add;          // ✅ 正确（修改了 exports 指向的对象）
exports.subtract = subtract; // ✅ 正确

// 图解：
// 初始状态：
//   exports ─────────┐
//                    ▼
//   module.exports = {}   ← 它们指向同一个对象
//
// exports.xxx = yyy 时：
//   修改的是同一个对象，没问题
//
// exports = {} 时：
//   exports 指向了新对象，但 module.exports 还指向旧对象
//   require 返回的是 module.exports，所以你添加的东西丢了
```

### 2.5 模块的缓存机制

```javascript
// counter.js
let count = 0;

function increment() {
    count++;
    return count;
}

function getCount() {
    return count;
}

module.exports = { increment, getCount };
```

```javascript
// app.js
const counter1 = require('./counter');
const counter2 = require('./counter');

console.log(counter1.increment());  // 1
console.log(counter1.increment());  // 2
console.log(counter2.increment());  // 3  ← 注意！不是 1

// counter1 和 counter2 是同一个对象！
// require 有缓存，同一个模块只加载一次
console.log(counter1 === counter2);  // true

// 查看缓存
console.log(require.cache);
```

### 2.6 CommonJS 的特点

```
CommonJS 的关键特性：

1. 同步加载
   → require() 是同步的，会阻塞后续代码执行
   → 适合服务器端（文件在本地，读取快）

2. 运行时加载
   → require() 可以在任何地方调用
   → 可以使用变量：const mod = require(variable);

3. 值的拷贝
   → 导入的是值的拷贝，不是引用（对于基本类型）
   → 对于对象，导出的是引用

4. 模块缓存
   → 同一个模块只加载一次
   → 后续 require 返回缓存的结果
```

---

## 三、ES Modules

### 3.1 什么是 ES Modules

**ES Modules（ESM）** 是 JavaScript 的官方模块系统，在 ES2015（ES6）中引入。浏览器和 Node.js 都支持。

### 3.2 在 Node.js 中启用 ES Modules

```json
// 方式一：在 package.json 中设置
{
  "type": "module"
}
```

```bash
# 方式二：使用 .mjs 文件扩展名
# math.mjs（而不是 math.js）
```

### 3.3 ES Modules 语法

```javascript
// ========== math.mjs - 导出 ==========

// 命名导出
export function add(a, b) {
    return a + b;
}

export function subtract(a, b) {
    return a - b;
}

export const PI = 3.14159;

// 默认导出（每个模块只能有一个）
export default class Calculator {
    add(a, b) { return a + b; }
    subtract(a, b) { return a - b; }
}
```

```javascript
// ========== app.mjs - 导入 ==========

// 导入命名导出
import { add, subtract, PI } from './math.mjs';
console.log(add(1, 2));

// 导入默认导出
import Calculator from './math.mjs';
const calc = new Calculator();

// 导入全部
import * as math from './math.mjs';
console.log(math.add(1, 2));

// 重命名导入
import { add as sum } from './math.mjs';
console.log(sum(1, 2));

// 动态导入（异步）
const module = await import('./math.mjs');
console.log(module.add(1, 2));
```

### 3.4 CommonJS vs ES Modules 对比

```
特性                  CommonJS (CJS)           ES Modules (ESM)
──────────────────────────────────────────────────────────────────
语法                   require/module.exports    import/export
加载方式               同步                      异步
启用方式               默认支持                   需要 "type": "module" 或 .mjs
this 指向              当前模块                   undefined
值类型                 值的拷贝                   活的引用（只读）
动态导入               可以（require 可在任意位置） 需要 await import()
循环依赖               支持（可能得到部分结果）     支持（有更好的处理）
Tree Shaking           不支持                     支持（静态分析）
```

### 3.5 两种模块的互操作

```javascript
// 在 ES Module 中导入 CommonJS 模块
// app.mjs
import express from 'express';  // ✅ 可以直接导入 CJS 模块
const app = express();

// 在 CommonJS 中导入 ES Module
// app.js
// ❌ 不能直接 require ES Module
// const { add } = require('./math.mjs');  // 报错！

// ✅ 需要使用动态 import()
async function loadModule() {
    const { add } = await import('./math.mjs');
    console.log(add(1, 2));
}
loadModule();
```

### 3.6 课程使用 CommonJS 的原因

```
本课程使用 CommonJS，原因：

1. Express 生态系统主要基于 CommonJS
2. 大多数 Node.js 教程和文档使用 CommonJS
3. require() 是同步的，代码更直观
4. 不需要额外配置

未来趋势：
  ES Modules 是标准，新项目越来越多使用 ESM
  但 CommonJS 短期内不会消失
```

---

## 四、全局对象 global

### 4.1 global 是什么

```javascript
// 在浏览器中：
console.log(window);         // 全局对象是 window
console.log(window.Math);    // Math 是 window 的属性
console.log(window.Array);   // Array 也是

// 在 Node.js 中：
console.log(global);         // 全局对象是 global
console.log(global.Math);    // Math 也是 global 的属性
console.log(global.Array);   // Array 也是

// globalThis（ES2020）：统一的全局对象访问方式
// 浏览器中：globalThis === window
// Node.js 中：globalThis === global
console.log(globalThis);
```

### 4.2 全局变量 vs 模块变量

```javascript
// ========== 全局变量 ==========

// 在 global 上挂载属性（不推荐）
global.myVar = 'hello';
console.log(global.myVar);  // 'hello'

// 在任何文件都能访问
// other-file.js
console.log(global.myVar);  // 'hello'

// 但是！模块内的变量不是全局的
// file-a.js
const secret = '123456';  // 这是模块私有的

// file-b.js
// console.log(secret);  // ❌ 报错：secret is not defined
```

### 4.3 特殊的全局变量

```javascript
// 这些看起来像全局变量，但实际上不是 global 的属性

console.log(__dirname);     // 当前文件所在目录
console.log(__filename);    // 当前文件的完整路径
console.log(module);        // 当前模块对象
console.log(require);       // require 函数
console.log(exports);       // exports 对象

// 它们是模块包装函数的参数，不是全局变量
console.log(global.__dirname);  // undefined（不是 global 的属性）
```

---

## 五、process 对象

### 5.1 process 是什么

**process** 是 Node.js 中最常用的全局对象之一，它提供了当前 Node.js 进程的信息和控制能力。

### 5.2 环境变量

```javascript
// ========== 环境变量 ==========

// 获取单个环境变量
console.log(process.env.NODE_ENV);     // 'development' 或 undefined
console.log(process.env.PATH);         // 系统 PATH
console.log(process.env.HOME);         // 用户主目录（Mac/Linux）
console.log(process.env.USERPROFILE);  // 用户主目录（Windows）

// 设置环境变量（仅当前进程）
process.env.NODE_ENV = 'production';

// 查看所有环境变量
console.log(process.env);

// 常见用途：根据环境切换配置
const config = {
    port: process.env.PORT || 3000,
    dbUrl: process.env.DB_URL || 'mongodb://localhost/blog',
    isDev: process.env.NODE_ENV !== 'production'
};
```

```bash
# 在命令行设置环境变量

# Mac/Linux
NODE_ENV=production node app.js
PORT=8080 node app.js

# Windows CMD
set NODE_ENV=production && node app.js

# Windows PowerShell
$env:NODE_ENV="production"; node app.js

# 使用 .env 文件（推荐用 dotenv 包）
# .env
# NODE_ENV=development
# PORT=3000
# DB_URL=mongodb://localhost/blog
```

### 5.3 命令行参数

```javascript
// ========== 命令行参数 ==========

// process.argv 是一个数组
// 运行：node app.js hello world --name=张三
console.log(process.argv);
// [
//   '/usr/local/bin/node',    // [0] Node.js 可执行文件路径
//   '/path/to/app.js',        // [1] 脚本文件路径
//   'hello',                  // [2] 第一个参数
//   'world',                  // [3] 第二个参数
//   '--name=张三'             // [4] 第四个参数
// ]

// 获取有用的参数（跳过前两个）
const args = process.argv.slice(2);
console.log(args);  // ['hello', 'world', '--name=张三']

// 解析参数（简单实现）
function parseArgs(args) {
    const result = {};
    args.forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            result[key] = value || true;
        } else {
            result._ = result._ || [];
            result._.push(arg);
        }
    });
    return result;
}

console.log(parseArgs(args));
// { _: ['hello', 'world'], name: '张三' }
```

### 5.4 进程信息

```javascript
// ========== 进程信息 ==========

// 进程 ID
console.log('PID:', process.pid);

// 进程运行时间（秒）
console.log('运行时间:', process.uptime(), '秒');

// 内存使用情况
const mem = process.memoryUsage();
console.log('内存使用:');
console.log('  RSS:', (mem.rss / 1024 / 1024).toFixed(2), 'MB');       // 总内存
console.log('  Heap Used:', (mem.heapUsed / 1024 / 1024).toFixed(2), 'MB'); // 堆已用
console.log('  Heap Total:', (mem.heapTotal / 1024 / 1024).toFixed(2), 'MB'); // 堆总量

// 工作目录
console.log('工作目录:', process.cwd());

// Node.js 版本
console.log('Node 版本:', process.version);
console.log('V8 版本:', process.versions.v8);

// 平台信息
console.log('平台:', process.platform);   // 'win32', 'darwin', 'linux'
console.log('架构:', process.arch);       // 'x64', 'arm64'
```

### 5.5 进程退出

```javascript
// ========== 进程控制 ==========

// 正常退出
process.exit(0);   // 0 表示成功

// 异常退出
process.exit(1);   // 非 0 表示失败

// 监听退出事件
process.on('exit', (code) => {
    console.log(`进程退出，退出码: ${code}`);
});

// 监听未捕获的异常
process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
    process.exit(1);
});

// 监听未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
});

// 优雅退出（收到 SIGTERM 信号时）
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，优雅退出...');
    // 关闭服务器、数据库连接等
    server.close(() => {
        process.exit(0);
    });
});
```

---

## 六、Buffer 类

### 6.1 什么是 Buffer

**Buffer** 是 Node.js 中用于处理二进制数据的类。在前端开发中很少接触二进制数据，但在后端开发中非常常见。

```
为什么需要 Buffer？

场景：读取一张图片
  图片不是文本，不能用字符串表示
  图片是二进制数据（0 和 1 的序列）
  Buffer 就是用来存储这种二进制数据的

类比：
  字符串 = "Hello"           → 人类能读懂
  Buffer = <Buffer 48 65 6c> → 计算机存储的格式
```

### 6.2 创建 Buffer

```javascript
// ========== 创建 Buffer ==========

// 方式一：从字符串创建
const buf1 = Buffer.from('Hello');
console.log(buf1);          // <Buffer 48 65 6c 6c 6f>
console.log(buf1.toString()); // 'Hello'

// 指定编码
const buf2 = Buffer.from('你好', 'utf-8');
console.log(buf2);          // <Buffer e4 bd a0 e5 a5 bd>
console.log(buf2.toString('utf-8'));  // '你好'

// 方式二：创建指定大小的 Buffer
const buf3 = Buffer.alloc(10);  // 创建 10 字节的 Buffer，用 0 填充
console.log(buf3);          // <Buffer 00 00 00 00 00 00 00 00 00 00>

// 方式三：从数组创建
const buf4 = Buffer.from([72, 101, 108, 108, 111]);
console.log(buf4.toString()); // 'Hello'（ASCII 码）

// 方式四：创建未初始化的 Buffer（更快，但可能包含旧数据）
const buf5 = Buffer.allocUnsafe(10);
console.log(buf5);  // 内容不确定
```

### 6.3 Buffer 操作

```javascript
// ========== Buffer 操作 ==========

const buf = Buffer.from('Hello World');

// 获取长度（字节数）
console.log(buf.length);  // 11

// 访问单个字节
console.log(buf[0]);       // 72（'H' 的 ASCII 码）
console.log(buf[1]);       // 101（'e' 的 ASCII 码）

// 修改字节
buf[0] = 104;  // 104 是 'h' 的 ASCII 码
console.log(buf.toString());  // 'hello World'

// 切片（共享内存，不复制）
const slice = buf.slice(0, 5);
console.log(slice.toString());  // 'hello'

// 复制
const copy = Buffer.alloc(buf.length);
buf.copy(copy);
console.log(copy.toString());  // 'hello World'

// 拼接
const buf1 = Buffer.from('Hello ');
const buf2 = Buffer.from('World');
const combined = Buffer.concat([buf1, buf2]);
console.log(combined.toString());  // 'Hello World'

// 比较
console.log(buf1.equals(buf2));  // false
```

### 6.4 Buffer 与编码

```javascript
// ========== 编码转换 ==========

// UTF-8（默认，最常用）
const utf8 = Buffer.from('你好世界', 'utf-8');
console.log(utf8);                // <Buffer e4 bd a0 e5 a5 bd ...>
console.log(utf8.length);         // 12（每个中文字符 3 字节）
console.log(utf8.toString('utf-8'));  // '你好世界'

// Base64（常用于数据传输）
const base64 = Buffer.from('Hello').toString('base64');
console.log(base64);              // 'SGVsbG8='
const decoded = Buffer.from(base64, 'base64').toString('utf-8');
console.log(decoded);             // 'Hello'

// Hex（十六进制）
const hex = Buffer.from('Hello').toString('hex');
console.log(hex);                 // '48656c6c6f'
const fromHex = Buffer.from('48656c6c6f', 'hex');
console.log(fromHex.toString());  // 'Hello'

// ASCII
const ascii = Buffer.from('Hello', 'ascii');
console.log(ascii.toString('ascii'));  // 'Hello'
```

### 6.5 实际应用场景

```javascript
// ========== 实际应用 ==========

// 场景一：读取图片文件
const fs = require('fs');
const imageData = fs.readFileSync('./photo.jpg');  // 返回 Buffer
console.log('图片大小:', imageData.length, '字节');

// 场景二：处理网络数据
const http = require('http');
http.get('http://example.com', (res) => {
    const chunks = [];
    res.on('data', (chunk) => {
        chunks.push(chunk);  // chunk 是 Buffer
    });
    res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        console.log(body);
    });
});

// 场景三：Base64 编码（常用于图片上传）
const imageBuffer = fs.readFileSync('./photo.jpg');
const base64Image = imageBuffer.toString('base64');
const dataUri = `data:image/jpeg;base64,${base64Image}`;
// 可以直接在 <img src="dataUri"> 中使用

// 场景四：计算文件哈希
const crypto = require('crypto');
const fileBuffer = fs.readFileSync('./data.txt');
const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
console.log('文件哈希:', hash);
```

---

## 七、__dirname 和 __filename

### 7.1 它们是什么

```javascript
// __dirname：当前文件所在目录的绝对路径
console.log(__dirname);
// 输出：/Users/yourname/projects/blog-api/src

// __filename：当前文件的绝对路径
console.log(__filename);
// 输出：/Users/yourname/projects/blog-api/src/app.js
```

### 7.2 路径处理的常见坑

```javascript
// ❌ 错误：使用字符串拼接路径
const configPath = __dirname + '/config.json';
// Windows 问题：路径分隔符是 \，不是 /
// 结果可能是：C:\Users\name\src/config.json（混合分隔符）

// ❌ 错误：使用相对路径
const configPath = './config.json';
// 相对于 process.cwd()，不是当前文件！
// 如果从其他目录运行 node /path/to/app.js，路径就错了

// ✅ 正确：使用 path 模块
const path = require('path');
const configPath = path.join(__dirname, 'config.json');
// 结果：/Users/yourname/projects/blog-api/src/config.json
// 自动处理分隔符，跨平台兼容
```

### 7.3 path 模块基础

```javascript
const path = require('path');

// 路径拼接（推荐）
const filePath = path.join(__dirname, 'data', 'users.json');
console.log(filePath);
// /Users/you/project/src/data/users.json

// 路径解析
const fullPath = '/Users/you/project/src/app.js';
console.log(path.dirname(fullPath));   // '/Users/you/project/src'
console.log(path.basename(fullPath));  // 'app.js'
console.log(path.extname(fullPath));   // '.js'

// 解析绝对路径
console.log(path.resolve('data', 'users.json'));
// /Users/you/project/data/users.json（基于 cwd）

// 规范化路径
console.log(path.normalize('/Users/you/../you/./project'));
// /Users/you/project
```

### 7.4 ES Modules 中的替代方案

```javascript
// ES Modules 中没有 __dirname 和 __filename
// 需要自己构造：

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(__dirname);
console.log(__filename);
```

---

## 八、实战：命令行工具

让我们综合运用所学知识，创建一个实用的命令行工具。

### 8.1 需求

创建一个命令行工具，功能：
1. 统计文件的行数、单词数、字节数
2. 支持命令行参数
3. 输出格式化的结果

### 8.2 完整代码

```javascript
// src/cli/wc.js
// 一个类似 Unix wc 命令的工具

const fs = require('fs');
const path = require('path');

// ========== 工具函数 ==========

/**
 * 统计文件信息
 * @param {string} filePath 文件路径
 * @returns {object} 统计结果
 */
function countFileStats(filePath) {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
    }

    // 读取文件
    const content = fs.readFileSync(filePath, 'utf-8');

    // 统计
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const bytes = Buffer.byteLength(content, 'utf-8');
    const chars = content.length;

    return {
        file: path.basename(filePath),
        lines,
        words,
        chars,
        bytes
    };
}

/**
 * 格式化输出
 * @param {object} stats 统计结果
 * @param {object} options 选项
 */
function formatOutput(stats, options) {
    const parts = [];

    if (options.lines) parts.push(`${stats.lines}\t行`);
    if (options.words) parts.push(`${stats.words}\t单词`);
    if (options.chars) parts.push(`${stats.chars}\t字符`);
    if (options.bytes) parts.push(`${stats.bytes}\t字节`);

    // 如果没有指定选项，显示所有
    if (parts.length === 0) {
        parts.push(`${stats.lines}\t行`);
        parts.push(`${stats.words}\t单词`);
        parts.push(`${stats.bytes}\t字节`);
    }

    parts.push(stats.file);
    return parts.join(' ');
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log(`
文件统计工具 (wc)

用法: node wc.js [选项] <文件路径>

选项:
  -l, --lines    只显示行数
  -w, --words    只显示单词数
  -c, --bytes    只显示字节数
  -m, --chars    只显示字符数
  -h, --help     显示帮助信息

示例:
  node wc.js README.md
  node wc.js -l README.md
  node wc.js -l -w README.md
    `);
}

/**
 * 解析命令行参数
 * @param {string[]} args 参数数组
 * @returns {object} 解析结果
 */
function parseArgs(args) {
    const result = {
        options: {
            lines: false,
            words: false,
            chars: false,
            bytes: false
        },
        files: []
    };

    args.forEach(arg => {
        switch (arg) {
            case '-l':
            case '--lines':
                result.options.lines = true;
                break;
            case '-w':
            case '--words':
                result.options.words = true;
                break;
            case '-c':
            case '--bytes':
                result.options.bytes = true;
                break;
            case '-m':
            case '--chars':
                result.options.chars = true;
                break;
            case '-h':
            case '--help':
                showHelp();
                process.exit(0);
            default:
                if (!arg.startsWith('-')) {
                    result.files.push(arg);
                }
                break;
        }
    });

    return result;
}

// ========== 主程序 ==========

function main() {
    // 获取命令行参数（跳过 node 和脚本路径）
    const args = process.argv.slice(2);

    // 没有参数时显示帮助
    if (args.length === 0) {
        showHelp();
        process.exit(1);
    }

    // 解析参数
    const { options, files } = parseArgs(args);

    // 检查是否指定了文件
    if (files.length === 0) {
        console.error('错误: 请指定文件路径');
        process.exit(1);
    }

    // 处理每个文件
    const allStats = [];
    files.forEach(file => {
        try {
            const filePath = path.resolve(file);
            const stats = countFileStats(filePath);
            allStats.push(stats);
            console.log(formatOutput(stats, options));
        } catch (err) {
            console.error(`错误: ${err.message}`);
        }
    });

    // 如果有多个文件，显示总计
    if (allStats.length > 1) {
        const total = {
            file: '总计',
            lines: allStats.reduce((sum, s) => sum + s.lines, 0),
            words: allStats.reduce((sum, s) => sum + s.words, 0),
            chars: allStats.reduce((sum, s) => sum + s.chars, 0),
            bytes: allStats.reduce((sum, s) => sum + s.bytes, 0)
        };
        console.log(formatOutput(total, options));
    }
}

// 运行主程序
main();
```

### 8.3 使用示例

```bash
# 创建测试文件
echo "Hello World\nThis is a test file\nNode.js is awesome" > test.txt

# 运行工具
node src/cli/wc.js test.txt
# 输出：3	行	6	单词	52	字节	test.txt

# 只显示行数
node src/cli/wc.js -l test.txt
# 输出：3	行	test.txt

# 统计多个文件
node src/cli/wc.js test.txt README.md

# 显示帮助
node src/cli/wc.js --help
```

---

## 九、动手练习

### 练习 1：理解模块系统

```javascript
// 创建两个文件，理解模块的作用域

// counter.js
let count = 0;
exports.increment = function() { return ++count; };
exports.getCount = function() { return count; };

// app.js
const c1 = require('./counter');
const c2 = require('./counter');

console.log(c1.increment());  // ?
console.log(c1.increment());  // ?
console.log(c2.increment());  // ?
console.log(c2.getCount());   // ?

// 问题：c1 和 c2 是同一个对象吗？为什么？
```

### 练习 2：使用 process 对象

```javascript
// 创建 info.js，输出以下信息：
// - 当前 Node.js 版本
// - 当前工作目录
// - 操作系统平台
// - CPU 架构
// - 内存使用情况
// - 运行时间
// - 所有命令行参数
```

### 练习 3：Buffer 编码转换

```javascript
// 创建 encode.js，实现以下功能：
// 1. 将字符串转为 Base64
// 2. 将 Base64 转回字符串
// 3. 将字符串转为 Hex
// 4. 计算字符串的字节长度（中文和英文的区别）

// 提示：
// Buffer.from('你好').length  // 6（UTF-8 中，每个中文字符 3 字节）
// Buffer.from('hi').length    // 2
// '你好'.length               // 2（字符数，不是字节数）
```

### 练习 4：路径处理

```javascript
// 创建 path-demo.js，实现以下功能：
// 1. 获取当前文件的目录名和文件名
// 2. 拼接出 config 目录下的 settings.json 路径
// 3. 解析一个路径，提取文件名、扩展名、目录名
// 4. 比较 path.join 和 path.resolve 的区别
```

---

## 十、小结

```
本课核心知识点：

✅ 浏览器 JS 与 Node.js 的核心区别（全局对象、DOM、模块系统）
✅ CommonJS 模块系统（require/module.exports，同步加载）
✅ ES Modules（import/export，异步加载，需要配置）
✅ 全局对象 global（与 window 的区别）
✅ process 对象（环境变量、命令行参数、进程信息、退出控制）
✅ Buffer 类（处理二进制数据，编码转换）
✅ __dirname 和 __filename（路径处理的常见坑）
✅ path 模块（跨平台的路径处理）

关键记忆点：
  - CommonJS 是 Node.js 的默认模块系统
  - require 是同步的，有缓存机制
  - module.exports 才是真正的导出对象
  - 永远用 path.join 处理路径，不要用字符串拼接
  - Buffer 用于处理二进制数据（图片、文件、网络数据）

下一课预告：
  我们将深入学习 Node.js 的内置模块：fs、path、http、events、url、os。
```

---

> **给前端开发者的话：** 你在浏览器中写的每一行 JavaScript，背后都有模块系统在支撑——import/export、webpack 的模块打包、React 的组件系统。现在你理解了 Node.js 的模块系统，你会发现很多前端工具的设计思路原来如此相似。
