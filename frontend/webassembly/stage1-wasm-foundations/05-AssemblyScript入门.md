# 05 - AssemblyScript 入门

## 场景引入

你是前端开发者，熟悉 TypeScript，想用 WASM 优化性能。但 Emscripten 需要 C/C++ 工具链，wasm-pack 需要学 Rust——你只是想快速把一个计算密集的函数用 WASM 跑起来。

AssemblyScript 提供了另一条路径：看起来像 TypeScript，但编译目标是 WASM。你不需要离开 JavaScript 生态，就能写出接近原生性能的代码。

## 学习目标

- 理解 AssemblyScript 与 TypeScript 的核心区别
- 掌握基本类型和内存模型
- 了解 managed 和 unmanaged 内存管理的区别
- 学会使用装饰器控制编译行为
- 掌握与 JavaScript 的集成方式

## AssemblyScript vs TypeScript

```typescript
// TypeScript — 动态类型，GC，运行在 JS 引擎
function add(a: number, b: number): number {
  return a + b; // number 是统一数值类型
}

// AssemblyScript — 静态类型，编译为 WASM
function add(a: i32, b: i32): i32 {
  return a + b; // 必须用 i32/f64 等具体类型
}
```

| 特性 | TypeScript | AssemblyScript |
|------|-----------|---------------|
| 类型系统 | 结构化，渐进式 | 名义类型，严格静态 |
| 数值类型 | 统一 `number` | `i32`/`f64` 等 |
| 内存管理 | 垃圾回收 | GC 可选，默认手动 |
| 运行环境 | JS 引擎 | WASM 虚拟机 |
| null 处理 | 可选链 | 严格可空类型 |

## 基本类型

```typescript
// 整数
let a: i32 = 42;       // 32 位有符号
let b: u32 = 42;       // 32 位无符号
let c: i64 = 100;      // 64 位有符号
let d: u8 = 255;       // 8 位无符号

// 浮点
let x: f32 = 3.14;     // 32 位（精度低）
let y: f64 = 3.14159;  // 64 位（推荐）

// 布尔和字符串
let flag: bool = true;  // 注意：bool 不是 boolean
let str: string = "hello";

// 类型转换必须显式
let a: i32 = 42;
let b: f64 = <f64>a;       // i32 → f64
let c: i32 = <i32>3.14;    // f64 → i32（截断）
// let d: f64 = a;          // 错误！隐式转换不允许
```

## 内存管理

### Managed 模式（默认）

GC 管理内存，类似 JavaScript：

```typescript
class Point {
  constructor(public x: f64, public y: f64) {}
  distanceTo(other: Point): f64 {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Mathf.sqrt(<f32>(dx * dx + dy * dy));
  }
}
// 对象会被 GC 自动回收
```

### Unmanaged 模式

手动管理内存，性能更高：

```typescript
@unmanaged
class Vec3 {
  x: f32 = 0;
  y: f32 = 0;
  z: f32 = 0;
}

// 直接分配内存
const ptr = memory.allocate(count * sizeof<Vec3>());
```

## 装饰器

AssemblyScript 独有的编译控制装饰器：

```typescript
@external("env", "console_log")    // 声明外部导入
declare function consoleLog(value: i32): void

@inline                             // 建议内联
function clamp(v: i32, min: i32, max: i32): i32 {
  return v < min ? min : (v > max ? max : v);
}

@final                              // 禁止继承
class MathUtils { }

@lazy                               // 延迟初始化全局变量
let cached: f64 = 0;
```

## 编译配置

```bash
mkdir my-assembly && cd my-assembly
npm init -y
npm install assemblyscript
npx asinit .
```

```json
// asconfig.json
{
  "entries": ["./assembly/index.ts"],
  "options": {
    "optimize": true,
    "runtime": "incremental",
    "exportRuntime": true
  }
}
```

```bash
npx asc assembly/index.ts --outFile build/module.wasm --optimize
```

## 与 JavaScript 集成

```typescript
// assembly/index.ts
export function fibonacci(n: i32): i32 {
  if (n <= 1) return n;
  let a: i32 = 0, b: i32 = 1;
  for (let i: i32 = 2; i <= n; i++) {
    const temp = a + b; a = b; b = temp;
  }
  return b;
}

export function processArray(data: Float64Array): f64 {
  let sum: f64 = 0;
  for (let i: i32 = 0; i < data.length; i++) {
    sum += data[i];
  }
  return sum / <f64>data.length;
}
```

```bash
npx asc assembly/index.ts --outFile build/module.wasm --exportRuntime
```

```javascript
const { instance } = await WebAssembly.instantiateStreaming(fetch('build/module.wasm'));
console.log(instance.exports.fibonacci(10)); // 55
```

## 常见误区

1. **"AssemblyScript 就是 TypeScript 子集"** — 语法相似但类型系统、内存模型、运行时都有本质区别。
2. **"可以用 JS 标准库"** — 不能，需要使用 AssemblyScript 自己的版本。
3. **"GC 开销可以忽略"** — 性能敏感场景中 GC 暂停可能是瓶颈，用 `@unmanaged` 避免。

## 工程建议

- 先用 AssemblyScript 实现一个纯计算函数验证工具链
- 用 `i32`/`f64` 等具体类型，不要依赖隐式转换
- 热路径避免频繁创建对象，使用 `@unmanaged`
- 小函数用 `@inline` 减少调用开销
- 用 `asconfig.json` 集中管理编译配置

## 小结

- AssemblyScript 是类 TypeScript 语言，编译目标是 WASM
- 使用 WASM 原生类型（i32/f64/bool），没有统一的 `number`
- 支持 managed（GC）和 unmanaged（手动）两种内存模式
- 装饰器控制编译行为：@external、@inline、@unmanaged
- `npx asc` 编译，输出 `.wasm` 和 `.d.ts`

## 练习

### 练习一：素数判断

用 AssemblyScript 实现 `isPrime(n: i32): bool`，编译并在 JS 中测试。

### 练习二：数组排序

用 AssemblyScript 实现 `sortArray(arr: Int32Array): void`，选择排序，原地排序。

---

## 参考答案

### 练习一

**思路**：检查 2 到 √n 之间是否有因子。用 `Mathf.sqrt` 计算平方根。

```typescript
// assembly/prime.ts
export function isPrime(n: i32): bool {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  const limit = <i32>Mathf.sqrt(<f32>n);
  for (let i: i32 = 3; i <= limit; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}
```

```bash
npx asc assembly/prime.ts --outFile build/prime.wasm --optimize
```

```javascript
const { instance } = await WebAssembly.instantiateStreaming(fetch('build/prime.wasm'));
console.log(instance.exports.isPrime(17)); // 1
console.log(instance.exports.isPrime(4));  // 0
```

**要点**：WASM 中 `bool` 返回值在 JS 中是 0 或 1。先排除偶数再只检查奇数。

### 练习二

**思路**：选择排序每次找最小值放到前面。`Int32Array` 是 TypedArray，AssemblyScript 原生支持。

```typescript
// assembly/sort.ts
export function sortArray(arr: Int32Array): void {
  const len = arr.length;
  for (let i: i32 = 0; i < len - 1; i++) {
    let minIdx = i;
    for (let j: i32 = i + 1; j < len; j++) {
      if (arr[j] < arr[minIdx]) minIdx = j;
    }
    if (minIdx !== i) {
      const temp = arr[i];
      arr[i] = arr[minIdx];
      arr[minIdx] = temp;
    }
  }
}
```

```javascript
const data = new Int32Array([64, 25, 12, 22, 11, 90, 1, 55]);
instance.exports.sortArray(data);
console.log(Array.from(data)); // [1, 11, 12, 22, 25, 55, 64, 90]
```

**要点**：原地排序避免额外内存分配。选择排序 O(n²)，小数据量适用。
