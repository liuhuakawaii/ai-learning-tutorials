# 01 - WebAssembly 是什么

## 场景引入

你用 JavaScript 写了一个图片编辑器，用户拖动滑块调整亮度时，每个像素都要做浮点运算。当图片尺寸达到 4000×3000 时，滑块变得卡顿——1200 万个像素点的逐像素计算让 JavaScript 引擎力不从心。

这不是 JavaScript 的"错"，而是它的设计取舍：JavaScript 是动态类型、垃圾回收的语言，运行时需要做类型推断、JIT 编译、内存管理。这些机制让 JavaScript 灵活易写，但在密集计算场景下，额外开销会累积成明显的性能瓶颈。

WebAssembly（简称 WASM）就是为了解决这类问题而诞生的。

## 学习目标

- 理解 WebAssembly 的设计目标和它与 JavaScript 的关系
- 掌握 WASM 的执行模型：模块、实例、内存、表
- 了解 WASM 二进制格式的基本结构
- 理解浏览器从加载到执行 WASM 的完整流程
- 学会使用浏览器开发者工具调试 WASM

## WebAssembly 的设计目标

WebAssembly 是 W3C 标准化的二进制指令格式，运行在浏览器的虚拟机中。它的核心设计目标：

1. **接近原生性能** — 使用线性内存、静态类型，无需运行时类型检查
2. **跨平台** — 同一份二进制在所有支持 WASM 的浏览器上行为一致
3. **与 JavaScript 互操作** — 不是替代 JavaScript，而是补充它
4. **安全** — 在沙箱中执行，遵循浏览器的同源策略和权限模型

关键认知：WASM 不是用来替代 JavaScript 的。它处理的是 JavaScript 不擅长的场景——CPU 密集型计算。UI 交互、DOM 操作仍然是 JavaScript 的领地。

## 编译型 vs 解释型：执行模型对比

理解 WASM 需要先理解 JavaScript 的执行方式。

JavaScript 是即时编译（JIT）的：

```
源代码 → 解析器 → AST → 字节码 → JIT 编译 → 机器码
                                         ↑
                                    运行时类型推测
```

JIT 编译器需要在运行时推测变量类型，如果推测错误（去优化），性能会急剧下降。

WASM 则跳过了这个过程：

```
源代码(C/Rust/...) → 编译器 → .wasm 二进制 → 浏览器解码 → 机器码
                                                    ↑
                                               静态类型，无需推测
```

WASM 二进制已经是类型明确的低级指令，浏览器只需解码并生成机器码，省去了类型推测和去优化的开销。

## 执行模型：四个核心概念

WASM 的执行模型由四个概念组成，理解它们是后续所有学习的基础。

### 模块（Module）

模块是 WASM 的编译单元，对应一个 `.wasm` 文件。它是无状态的，类似于一个类的定义——可以被多次实例化。

```javascript
// 加载并编译一个 .wasm 文件
const response = await fetch('math.wasm');
const bytes = await response.arrayBuffer();
const module = await WebAssembly.compile(bytes);
// module 是编译后的模块，可以创建多个实例
```

### 实例（Instance）

实例是模块的运行时实体，包含模块的所有运行状态。每次调用 `WebAssembly.instantiate` 都会创建一个新实例。

```javascript
// 从模块创建实例
const instance = await WebAssembly.instantiate(module, {
  env: { log: (value) => console.log('WASM 输出:', value) }
});
// instance.exports 是实例导出的函数和内存
instance.exports.add(1, 2); // 调用导出函数
```

### 内存（Memory）

WASM 使用线性内存——一块连续的、可动态增长的字节数组。所有数据（整数、浮点数、数组、结构体）都存储在这块内存中。

```javascript
// 创建一个 1 页（64KB）的内存
const memory = new WebAssembly.Memory({ initial: 1, maximum: 10 });
// 内存可以与 WASM 模块共享
const instance = await WebAssembly.instantiate(module, { env: { memory } });
// 从 JavaScript 读写 WASM 内存
const view = new Int32Array(memory.buffer);
view[0] = 42; // 写入
console.log(view[0]); // 读取
```

### 表（Table）

表是一个引用数组，用于存储函数引用。WASM 不能直接存储函数指针，而是通过表间接引用。

```javascript
// 表存储函数引用，用于间接调用
const table = new WebAssembly.Table({ initial: 2, element: 'anyfunc' });
```

为什么需要表？因为 WASM 的线性内存只能存储字节，不能直接存储函数地址。表提供了一种类型安全的方式来实现函数指针、虚函数表等模式。

## 二进制格式结构

一个 `.wasm` 文件由多个段（section）组成，按固定顺序排列：

```
┌──────────────────────────┐
│  魔数 (0x00 61 73 6D)    │  ← "\0asm"
│  版本号 (0x01 00 00 00)  │  ← 版本 1
├──────────────────────────┤
│  Type 段                  │  ← 函数签名定义
│  Import 段                │  ← 从外部导入的函数/内存/表
│  Function 段              │  ← 函数声明（引用 Type 段）
│  Table 段                 │  ← 表定义
│  Memory 段                │  ← 内存定义
│  Global 段                │  ← 全局变量
│  Export 段                │  ← 导出给外部的函数/内存/表
│  Start 段                 │  ← 模块加载时自动执行的函数
│  Code 段                  │  ← 函数体（实际指令）
│  Data 段                  │  ← 初始内存数据
└──────────────────────────┘
```

你可以用 `wasm-objdump`（来自 WABT 工具包）查看任何 `.wasm` 文件的结构：

```bash
# 查看 .wasm 文件的段结构
wasm-objdump -h module.wasm

# 反汇编为 WAT 文本格式
wasm2wat module.wasm -o module.wat
```

## 浏览器执行流程

当你在网页中加载 `.wasm` 文件时，浏览器执行以下步骤：

```javascript
// 1. 获取二进制数据
const response = await fetch('module.wasm');
const bytes = await response.arrayBuffer();

// 2. 编译（可在后台线程并行）
const module = await WebAssembly.compile(bytes);

// 3. 实例化（必须在主线程）
const instance = await WebAssembly.instantiate(module, imports);

// 4. 调用导出函数
const result = instance.exports.processData(42);
```

`WebAssembly.compile` 和 `WebAssembly.instantiate` 都有同步版本，但它们会阻塞主线程，只适合在 Worker 中使用。

**流式编译优化**：如果服务器返回正确的 MIME type（`application/wasm`），浏览器可以在下载的同时编译，减少等待时间：

```javascript
// 流式编译 — 推荐方式
const { instance } = await WebAssembly.instantiateStreaming(
  fetch('module.wasm'),
  imports
);
```

## 开发者工具调试

### Chrome DevTools

Chrome 提供了 WASM 调试支持：

1. 打开 DevTools → Sources 面板
2. 左侧文件树中会出现 `.wasm` 文件
3. 如果有 Source Map，会显示对应的源代码（C/Rust）
4. 可以设置断点、单步执行、查看调用栈

### 使用 Source Map

Emscripten 和 wasm-pack 都支持生成 Source Map，让调试体验接近原生开发：

```bash
# Emscripten 生成 Source Map
emcc input.c -o output.js -gsource-map --source-map-base http://localhost:8080/

# wasm-pack 生成 Source Map
wasm-pack build --dev -- --features wasm-bindgen/enable-debug
```

### 性能分析

Chrome 的 Performance 面板可以记录 WASM 函数的执行时间：

1. 打开 Performance 面板
2. 点击 Record
3. 执行你的 WASM 相关操作
4. 在火焰图中找到 WASM 函数调用

## 常见误区

1. **"WASM 比 JavaScript 快"** — 不准确。WASM 在 CPU 密集型计算上有优势，但对于 I/O 密集型、DOM 操作密集型的任务，JavaScript 可能更合适，因为 WASM 调用 Web API 需要经过 JavaScript 桥接。

2. **"WASM 可以直接操作 DOM"** — 不能。WASM 沙箱中没有 DOM API，操作 DOM 必须通过 JavaScript。这是安全模型的一部分。

3. **"WASM 文件一定比 JavaScript 小"** — 通常不是。WASM 二进制可能比等价的 JavaScript 更大，但它加载后解码更快、执行更可预测。

4. **"所有 Web 项目都应该用 WASM"** — 过度使用。WASM 增加了构建复杂度和调试难度，只在性能确实成为瓶颈时才值得引入。

## 工程建议

- **渐进增强**：先用 JavaScript 实现功能，确认性能瓶颈后再用 WASM 优化热点代码
- **保持胶水代码薄**：WASM 和 JavaScript 之间的调用有开销，尽量减少跨边界调用次数
- **善用流式编译**：始终使用 `WebAssembly.instantiateStreaming` 并配置正确的 MIME type
- **监控文件大小**：WASM 文件越大，编译时间越长，考虑代码分割和懒加载
- **保留 Source Map**：生产环境不发布 Source Map，但开发和测试环境必须有

## 小结

- WebAssembly 是浏览器中的二进制指令格式，设计目标是接近原生性能
- 它与 JavaScript 互补，不是替代关系
- 执行模型包含模块、实例、内存、表四个核心概念
- 二进制格式由魔数、版本号和多个标准段组成
- 浏览器支持流式编译，减少加载等待时间
- 开发者工具提供了 Source Map 调试支持

## 练习

### 练习一：模块与实例

编写一个 JavaScript 程序，使用 `WebAssembly.compile` 编译以下 WAT 模块（需要先转换为二进制），然后创建两个实例，验证它们的状态是独立的：

```wat
(module
  (memory (export "memory") 1)
  (func (export "setValue") (param i32) (param i32)
    local.get 0
    local.get 1
    i32.store)
  (func (export "getValue") (param i32) (result i32)
    local.get 0
    i32.load))
```

### 练习二：线性内存操作

创建一个 WASM 实例，向其线性内存中写入一个整数数组 `[10, 20, 30, 40, 50]`，然后从 JavaScript 中读取并验证这些值。

### 练习三：浏览器调试

使用 Chrome DevTools 加载一个包含调试信息的 WASM 模块，设置断点并观察调用栈。记录你发现的至少 3 个调试功能。

---

## 参考答案

### 练习一

**思路**：每个实例有自己的状态，但共享模块定义。使用 `setValue` 在不同实例的相同地址写入不同值，然后用 `getValue` 读取验证。

```javascript
// 先将 WAT 转换为 wasm 二进制（使用 WABT 工具）
// 命令行: wat2wasm module.wat -o module.wasm

const response = await fetch('module.wasm');
const bytes = await response.arrayBuffer();
const module = await WebAssembly.compile(bytes);

// 创建两个独立实例
const instance1 = await WebAssembly.instantiate(module);
const instance2 = await WebAssembly.instantiate(module);

// 在实例 1 的地址 0 写入 100
instance1.exports.setValue(0, 100);
// 在实例 2 的地址 0 写入 200
instance2.exports.setValue(0, 200);

// 验证状态独立
console.log(instance1.exports.getValue(0)); // 100
console.log(instance2.exports.getValue(0)); // 200
// 两个实例互不影响，证明模块是无状态的，实例是独立的运行时
```

**要点**：
- `WebAssembly.compile` 是无状态的编译操作
- `WebAssembly.instantiate` 创建带独立内存的实例
- 同一模块可以创建任意多个实例

### 练习二

**思路**：WASM 线性内存可以从 JavaScript 通过 `ArrayBuffer` 视图直接读写。注意 WASM 使用小端字节序。

```javascript
const memory = new WebAssembly.Memory({ initial: 1 });
const imports = { env: { memory } };

// 假设模块导出了 memory 并接受 memory 作为导入
const { instance } = await WebAssembly.instantiate(
  await fetch('module.wasm').then(r => r.arrayBuffer()),
  imports
);

const sharedMemory = instance.exports.memory;

// 使用 Int32Array 视图写入数组
const data = [10, 20, 30, 40, 50];
const view = new Int32Array(sharedMemory.buffer, 0, data.length);
for (let i = 0; i < data.length; i++) {
  view[i] = data[i];
}

// 读取并验证
for (let i = 0; i < data.length; i++) {
  console.log(`地址 ${i * 4}: ${view[i]}`);
  // 输出: 地址 0: 10, 地址 4: 20, 地址 8: 30, ...
}
// 注意: 每个 i32 占 4 字节，所以索引 i 对应字节偏移 i * 4
```

**要点**：
- WASM 内存是 `ArrayBuffer`，可以通过 TypedArray 视图访问
- `Int32Array` 的每个元素占 4 字节
- 内存起始偏移为 0，需要确保不与 WASM 模块自身的数据段冲突

### 练习三

**思路**：Chrome DevTools 的 Sources 面板是调试 WASM 的主要入口。

1. **断点设置**：在 Sources 面板中找到 `.wasm` 文件（如果有关联的 `.c` 或 `.rs` 源文件，会显示源码），点击行号设置断点
2. **调用栈查看**：WASM 函数执行暂停时，Call Stack 面板显示 WASM 函数名和参数值
3. **变量检查**：Scope 面板显示当前函数的局部变量（以 `local_0`、`local_1` 命名）
4. **内存检查**：在 Console 中通过 `instance.exports.memory.buffer` 查看线性内存
5. **Performance 面板**：Record 操作后在火焰图中可以看到 WASM 函数的执行耗时，区分 "wasm" 标记的函数

**要点**：
- 没有 Source Map 时，只能看到 `.wasm` 中的函数名，无法看到源码行号
- `--profiling` 编译选项可以保留更多调试信息
- Firefox 的 WASM 调试支持也很完善，路径略有不同
