# 04 - Emscripten 工具链

## 场景引入

你的团队有一个成熟的 C 语言数学库，包含几万行优化过的线性代数代码。现在需要在 Web 端使用。两个选择：用 JavaScript 重写（工作量大、易出 bug），或者将 C 代码编译为 WASM 直接在浏览器运行。

Emscripten 就是第二个选择的工具——基于 LLVM 的完整 C/C++ → WASM 编译工具链。

## 学习目标

- 掌握 Emscripten 的安装和配置
- 理解 C/C++ → WASM 的编译流程
- 学会使用链接选项控制导出和内存
- 了解文件系统模拟和优化选项
- 掌握将输出集成到现有 JavaScript 项目的方法

## 安装配置

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh  # macOS/Linux
# emsdk_env.bat        # Windows

emcc --version  # 验证安装
```

核心命令：`emcc`（C 编译器）、`em++`（C++ 编译器）。

## 编译流程

```
源文件(.c/.cpp)
    ↓
Clang 前端 (语法分析、类型检查)
    ↓
LLVM IR (中间表示)
    ↓
LLVM 后端 (优化、WASM 代码生成)
    ↓
.wasm 文件 + .js 胶水代码
```

### 最简单的编译

```c
// math_utils.c
#include <emscripten/emscripten.h>
#include <math.h>

EMSCRIPTEN_KEEPALIVE
double calculate_distance(double x1, double y1, double x2, double y2) {
    double dx = x2 - x1;
    double dy = y2 - y1;
    return sqrt(dx * dx + dy * dy);
}

EMSCRIPTEN_KEEPALIVE
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}
```

```bash
emcc math_utils.c -o math_utils.js \
  -s EXPORTED_FUNCTIONS='["_calculate_distance","_factorial","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]'
```

生成 `math_utils.wasm` + `math_utils.js`。

### 在网页中使用

```html
<script src="math_utils.js"></script>
<script>
Module.onRuntimeInitialized = function() {
  // ccall：一次调用
  const dist = Module.ccall('calculate_distance', 'number',
    ['number','number','number','number'], [0, 0, 3, 4]);
  console.log('距离:', dist); // 5

  // cwrap：创建可复用函数引用
  const factorial = Module.cwrap('factorial', 'number', ['number']);
  console.log('10! =', factorial(10)); // 3628800
};
</script>
```

## 链接选项详解

### EXPORTED_FUNCTIONS

控制哪些函数被导出，函数名前加下划线 `_`：

```bash
emcc input.c -o output.js \
  -s EXPORTED_FUNCTIONS='["_myFunc","_malloc","_free"]'
```

`_malloc` 和 `_free` 需显式导出才能从 JavaScript 使用。

### EXPORTED_RUNTIME_METHODS

| 方法 | 作用 |
|------|------|
| `ccall` | 直接调用 C 函数，自动处理类型转换 |
| `cwrap` | 创建可复用的包装函数 |
| `UTF8ToString` | WASM 内存 C 字符串 → JS 字符串 |
| `stringToUTF8` | JS 字符串 → WASM 内存 |

### MODULARIZE

包装为工厂函数，避免全局污染：

```bash
emcc input.c -o output.js -s MODULARIZE=1 -s EXPORT_NAME='createMyModule'
```

```javascript
import createMyModule from './output.js';
const module = await createMyModule();
```

### WASM=0

兼容不支持 WASM 的旧浏览器，输出 asm.js：

```bash
emcc input.c -o output.js -s WASM=0
```

## 文件系统模拟

C 代码使用 `fopen`/`fread` 等文件 I/O 时，Emscripten 在内存中模拟文件系统：

```bash
emcc main.c -o main.js --preload-file assets/  # 预加载目录
emcc main.c -o main.js --embed-file config.json # 嵌入文件
```

```javascript
// JS 侧也可以操作虚拟文件系统
Module.FS.writeFile('/output.txt', 'Hello');
const content = Module.FS.readFile('/output.txt', { encoding: 'utf8' });
```

## 优化选项

| 选项 | 作用 | 适用场景 |
|------|------|----------|
| `-O0` | 无优化，保留调试信息 | 开发调试 |
| `-O2` | 标准优化 | 生产环境推荐 |
| `-O3` | 激进优化 | 性能敏感 |
| `-Oz` | 极致压缩体积 | 移动端/弱网 |

```bash
emcc input.c -o output.js -O0 -g    # 开发
emcc input.c -o output.js -O2       # 生产
emcc input.c -o output.js -O3 -flto # 极致性能
```

## 与现有项目集成

### Vite 项目

```javascript
// vite.config.js
export default {
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  optimizeDeps: { exclude: ['my-wasm-module'] }
};
```

```javascript
// src/wasm.js
import createModule from './wasm/math_utils.js';
let moduleInstance = null;

export async function initWasm() {
  if (!moduleInstance) moduleInstance = await createModule();
  return moduleInstance;
}
```

### Next.js 项目

```javascript
// next.config.js
module.exports = {
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  }
};
```

## 常见误区

1. **"编译后不需要胶水代码"** — 胶水代码负责初始化运行时、类型转换等，必须一起加载。
2. **"EXPORTED_FUNCTIONS 不重要"** — 未导出的函数会被删除。导出名前必须加下划线。
3. **"-O3 一定比 -O2 快"** — 不一定。-O3 激进优化可能增加体积，反而因缓存不友好变慢。

## 工程建议

- 始终加 `-s MODULARIZE=1` 避免全局污染
- 只导出需要的函数，列表越短 WASM 越小
- 开发用 `-O0 -g`，生产用 `-O2`
- 服务器必须返回 `application/wasm` MIME type
- 启用 `ALLOW_MEMORY_GROWTH` 除非确定内存用量

## 小结

- Emscripten 基于 LLVM，将 C/C++ 编译为 WASM + JS 胶水代码
- `emcc` 是核心命令，`EXPORTED_FUNCTIONS` 控制导出
- 文件系统模拟让 C 的文件 I/O 在浏览器中工作
- -O2 是生产环境推荐优化级别
- MODULARIZE 选项让输出适合模块化项目

## 练习

### 练习一：编译基础

将以下 C 代码编译为 WASM 并在浏览器调用：

```c
#include <emscripten/emscripten.h>
EMSCRIPTEN_KEEPALIVE
int fibonacci(int n) {
    if (n <= 1) return n;
    int a = 0, b = 1;
    for (int i = 2; i <= n; i++) {
        int temp = a + b; a = b; b = temp;
    }
    return b;
}
```

### 练习二：编译优化对比

用 `-O0`、`-O2`、`-Oz` 编译同一个文件，比较 `.wasm` 文件大小和执行性能。

---

## 参考答案

### 练习一

**思路**：使用 `cwrap` 创建可复用函数引用。

```c
// fib.c
#include <emscripten/emscripten.h>
EMSCRIPTEN_KEEPALIVE
int fibonacci(int n) {
    if (n <= 1) return n;
    int a = 0, b = 1;
    for (int i = 2; i <= n; i++) { int temp = a + b; a = b; b = temp; }
    return b;
}
```

```bash
emcc fib.c -o fib.js -O2 \
  -s EXPORTED_FUNCTIONS='["_fibonacci","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap"]'
```

```javascript
Module.onRuntimeInitialized = function() {
  const fib = Module.cwrap('fibonacci', 'number', ['number']);
  console.log(fib(10)); // 55
  console.log(fib(20)); // 6765
};
```

**要点**：`cwrap` 返回可复用的 JS 函数。`onRuntimeInitialized` 确保初始化完成后再调用。

### 练习二

**思路**：用计算密集函数编译三个版本，对比大小和耗时。

```c
// bench.c
#include <emscripten/emscripten.h>
#include <math.h>
EMSCRIPTEN_KEEPALIVE
double compute(int iterations) {
    double sum = 0;
    for (int i = 0; i < iterations; i++) sum += sin((double)i) * cos((double)i);
    return sum;
}
```

```bash
emcc bench.c -o bench_O0.js -O0
emcc bench.c -o bench_O2.js -O2
emcc bench.c -o bench_Oz.js -Oz
```

```javascript
for (const level of ['O0', 'O2', 'Oz']) {
  const resp = await fetch(`bench_${level}.wasm`);
  const { instance } = await WebAssembly.instantiate(await resp.arrayBuffer());
  const start = performance.now();
  instance.exports.compute(10000000);
  console.log(`${level}: ${resp.headers.get('content-length')}B, ${(performance.now()-start).toFixed(2)}ms`);
}
```

**要点**：-O0 最大最慢，-O2 性能体积平衡最佳，-Oz 最小但可能牺牲部分性能。实际差异取决于代码特征。
