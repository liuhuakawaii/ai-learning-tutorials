# WebAssembly 是什么

## 从一个性能问题说起

你用 JavaScript 写了一个图片编辑器。用户拖动滑块调整亮度时，每个像素都要做浮点运算。图片 4000×3000 = 1200 万像素，滑块变得卡顿。

这不是 JavaScript 的"错"，而是它的设计取舍：动态类型、垃圾回收、JIT 编译。这些机制让 JS 灵活易写，但在密集计算场景下，额外开销会累积成性能瓶颈。

WebAssembly（WASM）就是为这类问题而生。

## WASM 是什么

W3C 标准化的二进制指令格式，运行在浏览器虚拟机中。核心设计目标：

1. **接近原生性能** — 线性内存、静态类型，无运行时类型检查
2. **跨平台** — 同一二进制在所有支持 WASM 的浏览器上行为一致
3. **与 JavaScript 互操作** — 不替代 JS，补充它
4. **安全** — 沙箱执行，遵循同源策略

关键认知：**WASM 不是用来替代 JavaScript 的**。它处理 JS 不擅长的场景——CPU 密集型计算。UI 交互、DOM 操作仍然是 JS 的领地。

## 执行模型对比

JavaScript 是 JIT 编译：

```
源代码 → 解析器 → AST → 字节码 → JIT 编译 → 机器码
                                    ↑
                               运行时类型推测
```

WASM 跳过了类型推测：

```
源代码(C/Rust) → 编译器 → .wasm 二进制 → 浏览器解码 → 机器码
                                              ↑
                                         静态类型，无需推测
```

## 四个核心概念

### 模块（Module）

编译单元，对应一个 `.wasm` 文件。无状态，可多次实例化。

```javascript
const response = await fetch('math.wasm')
const bytes = await response.arrayBuffer()
const module = await WebAssembly.compile(bytes)
```

### 实例（Instance）

模块的运行时实体，包含所有运行状态。

```javascript
const instance = await WebAssembly.instantiate(module, {
  env: { log: (v) => console.log(v) }
})
instance.exports.add(1, 2)
```

### 内存（Memory）

连续的、可增长的字节数组。所有数据都存储在这里。

```javascript
const memory = new WebAssembly.Memory({ initial: 1, maximum: 10 })
const view = new Int32Array(memory.buffer)
view[0] = 42
```

### 表（Table）

函数引用数组。WASM 不能直接存函数指针，通过表间接引用。

## 加载和执行

```javascript
// 推荐：流式编译
const { instance } = await WebAssembly.instantiateStreaming(
  fetch('module.wasm'),
  { env: { memory } }
)

// 调用导出函数
const result = instance.exports.processData(42)
```

`instantiateStreaming` 在下载的同时编译，减少等待时间。需要服务器返回 `application/wasm` MIME type。

## WASM 能做什么、不能做什么

| 能做 | 不能做 |
|------|--------|
| 图像处理（逐像素计算） | 直接操作 DOM |
| 音视频编解码 | 调用 Web API |
| 物理引擎 | 替代 JavaScript |
| 密码学计算 | 自动管理 DOM 事件 |
| 数据压缩/解压 | |

WASM 操作 DOM 必须通过 JavaScript 桥接。

## 调试

Chrome DevTools → Sources 面板可以看到 `.wasm` 文件。有 Source Map 时显示对应源码（C/Rust）。

```bash
# Emscripten 生成 Source Map
emcc input.c -o output.js -gsource-map

# wasm-pack 生成 Source Map
wasm-pack build --dev
```

## 常见误区

1. **"WASM 一定比 JS 快"** — 只在 CPU 密集型计算上有优势，I/O 和 DOM 操作 JS 更合适
2. **"WASM 可以直接操作 DOM"** — 不能，必须通过 JS 桥接
3. **"所有项目都应该用 WASM"** — 过度使用增加构建复杂度和调试难度

## 练习

### 练习一：模块与实例

用 `WebAssembly.compile` 编译一个 WAT 模块，创建两个实例，验证状态独立。

### 练习二：线性内存操作

向 WASM 内存写入 `[10, 20, 30, 40, 50]`，从 JS 读取验证。

### 练习三：浏览器调试

用 Chrome DevTools 加载 WASM 模块，设置断点观察调用栈。

---

## 参考答案

### 练习一

```javascript
const response = await fetch('module.wasm')
const bytes = await response.arrayBuffer()
const module = await WebAssembly.compile(bytes)

const instance1 = await WebAssembly.instantiate(module)
const instance2 = await WebAssembly.instantiate(module)

instance1.exports.setValue(0, 100)
instance2.exports.setValue(0, 200)

console.log(instance1.exports.getValue(0)) // 100
console.log(instance2.exports.getValue(0)) // 200
// 状态独立
```

### 练习二

```javascript
const memory = new WebAssembly.Memory({ initial: 1 })
const instance = await WebAssembly.instantiate(module, { env: { memory } })

const data = [10, 20, 30, 40, 50]
const view = new Int32Array(memory.buffer, 0, data.length)
for (let i = 0; i < data.length; i++) view[i] = data[i]

for (let i = 0; i < data.length; i++) {
  console.log(`地址 ${i * 4}: ${view[i]}`)
}
```

### 练习三

Chrome DevTools → Sources → 找到 `.wasm` 文件 → 点击行号设断点 → 执行调用 → 查看 Scope 面板的局部变量。
