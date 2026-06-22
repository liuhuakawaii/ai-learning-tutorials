# 03 - WASM 与 JavaScript 互操作

## 场景引入

你用 C 写好了一个图像处理算法并编译成了 `.wasm` 文件。现在需要在 Web 页面中调用它——传入 Canvas 的像素数据，让 WASM 处理后显示结果。

问题：WASM 没有 DOM API，不知道什么是 Canvas，甚至不知道什么是 JavaScript 对象。它只认识数字和线性内存。两种完全不同的运行时如何协作？

## 学习目标

- 理解 WASM 的导入导出机制
- 掌握 WASM 与 JavaScript 共享内存的方式
- 了解胶水代码的生成原理和作用
- 理解类型映射规则和函数调用开销
- 掌握错误处理和异步场景的处理方式

## 导入导出机制

WASM 通过"导入"获取外部能力，通过"导出"暴露自身能力。它不能主动访问任何外部资源，一切都通过显式导入获得。

```javascript
const imports = {
  env: {
    log: (value) => console.log('WASM 输出:', value),
    memory: new WebAssembly.Memory({ initial: 1 })
  }
};

const { instance } = await WebAssembly.instantiateStreaming(
  fetch('module.wasm'), imports
);
instance.exports.calculate(10, 20);
```

对应 WAT：

```wat
(module
  (import "env" "log" (func $log (param i32)))
  (import "env" "memory" (memory 1))
  (func (export "calculate") (param $a i32) (param $b i32) (result i32)
    local.get $a local.get $b i32.add call $log
    local.get $a local.get $b i32.mul)
)
```

导入对象键名结构是 `模块名.成员名`。`import "env" "log"` 对应 `imports.env.log`。

## 内存共享

JavaScript 和 WASM 通过 `ArrayBuffer` 共享线性内存，零拷贝。

```javascript
// 方式 1：WASM 导出内存
const memory = instance.exports.memory;

// 方式 2：JavaScript 创建内存导入给 WASM
const memory = new WebAssembly.Memory({ initial: 2, maximum: 10 });

// 用 TypedArray 视图读写
const i32View = new Int32Array(memory.buffer);
const u8View = new Uint8Array(memory.buffer);
```

### 传递复杂数据

WASM 只接受数值类型。传递字符串、数组需要手动编排：

```javascript
function passString(instance, str) {
  const encoded = new TextEncoder().encode(str);
  const ptr = instance.exports.malloc(encoded.length + 1);
  const memory = new Uint8Array(instance.exports.memory.buffer);
  memory.set(encoded, ptr);
  memory[ptr + encoded.length] = 0; // null 终止符
  return ptr;
}

function readString(instance, ptr) {
  const memory = new Uint8Array(instance.exports.memory.buffer);
  let end = ptr;
  while (memory[end] !== 0) end++;
  return new TextDecoder().decode(memory.subarray(ptr, end));
}
```

**关键**：每次 `memory.grow` 后 `ArrayBuffer` 会分离（detached），必须重新创建视图。

## 胶水代码（Glue Code）

胶水代码连接 WASM 和 JavaScript，处理类型转换、内存编排、错误传播。工具链自动生成。

```javascript
// Emscripten 生成的简化胶水代码
var Module = {
  stringToUTF8(str, outPtr, maxBytes) {
    var HEAPU8 = new Uint8Array(Module.HEAP8.buffer);
    for (var i = 0; i < str.length; i++) {
      HEAPU8[outPtr + i] = str.charCodeAt(i);
    }
    HEAPU8[outPtr + i] = 0;
  },
  UTF8ToString(ptr) {
    var HEAPU8 = new Uint8Array(Module.HEAP8.buffer);
    var str = '';
    while (HEAPU8[ptr] !== 0) str += String.fromCharCode(HEAPU8[ptr++]);
    return str;
  }
};
```

## 类型映射

| WASM 类型 | JavaScript 类型 | 注意事项 |
|-----------|----------------|----------|
| `i32` | `Number` | 范围: -2³¹ ~ 2³¹-1 |
| `i64` | `BigInt` | Number 无法精确表示所有 i64 |
| `f32` | `Number` | 精度损失：JS 所有数值都是 f64 |
| `f64` | `Number` | 精确对应 |

## 函数调用开销

JavaScript ↔ WASM 跨边界调用有固定开销（约 100 纳秒），高频调用会累积。

```javascript
// 差：每次像素都跨边界调用
for (let i = 0; i < pixels.length; i++) {
  pixels[i] = instance.exports.processPixel(pixels[i]);
}

// 好：批量处理，一次调用
memory.set(pixels, inputPtr);
instance.exports.processBatch(inputPtr, pixels.length);
```

**经验法则**：批量传入数据 → WASM 内部完成所有计算 → 批量传回。

## 错误处理

WASM 没有异常机制，常见模式：

```javascript
// 模式一：返回错误码
const errorCode = instance.exports.parse(ptr, len);
if (errorCode !== 0) throw new Error(`错误码: ${errorCode}`);

// 模式二：通过导入函数报告错误
const imports = {
  env: {
    set_error: (code, msgPtr, msgLen) => {
      lastError = { code, message: readStringFromMemory(msgPtr, msgLen) };
    }
  }
};
```

## 异步加载

```javascript
// 推荐：流式编译
const { instance } = await WebAssembly.instantiateStreaming(
  fetch('module.wasm'), imports
);

// Worker 中避免主线程阻塞
const worker = new Worker('wasm-worker.js');
worker.postMessage({ type: 'load', url: 'module.wasm' });
```

## 常见误区

1. **"导入对象可以传递任意 JS 值"** — 不行，参数和返回值只能是数值类型。
2. **"内存增长后之前的 TypedArray 还能用"** — 不能，必须重新创建视图。
3. **"WASM 调用 JS 没有开销"** — 有开销，约 100 纳秒/次，高频调用需批量处理。
4. **"i64 在 JS 中就是 Number"** — 不是，i64 映射为 `BigInt`。

## 工程建议

- 批量传数据，减少跨边界调用
- 使用工具生成胶水代码，不要手写
- 始终在调用前获取最新 `memory.buffer`
- 使用 `instantiateStreaming` 并配置正确 MIME type
- 避免在边界传递 i64，考虑拆分为两个 i32

## 小结

- WASM 通过导入/导出与外部交互，一切外部能力通过导入获得
- JavaScript 和 WASM 通过 `ArrayBuffer` 共享线性内存，零拷贝
- 复杂数据需手动编排内存传递
- 工具链自动生成胶水代码处理类型转换
- 函数调用有固定开销，应减少跨边界调用频率

## 练习

### 练习一：字符串处理

编写 WAT 模块导出 `toUpper(ptr, len)`，将小写字母转为大写。在 JavaScript 中传递字符串并读取结果。

### 练习二：批量像素处理

编写 WAT 模块导出 `brightness(ptr, count, amount)`，对 RGBA 像素的 R/G/B 分量调整亮度并 clamp。

---

## 参考答案

### 练习一

**思路**：小写 a-z (97-122) 减 32 转为大写 A-Z (65-90)。

```wat
(module
  (memory (export "memory") 1)
  (func $toUpper (export "toUpper") (param $ptr i32) (param $len i32)
    (local $i i32)
    block $break loop $continue
      local.get $i local.get $len i32.ge_s br_if $break
      local.get $ptr local.get $i i32.add
      local.tee $i
      i32.load8_u
      local.tee $i
      i32.const 97 i32.ge_s
      if
        local.get $i i32.const 122 i32.le_s
        if
          local.get $ptr local.get $i i32.add
          local.get $i i32.const 32 i32.sub
          i32.store8
        end
      end
      local.get $i i32.const 1 i32.add local.set $i
      br $continue
    end end)
)
```

**要点**：ASCII 转换只需算术运算。只处理 ASCII (0-127)，Unicode 需要更复杂逻辑。

### 练习二

**思路**：RGBA 每 4 字节一组，逐像素读取 R/G/B 加 amount 后 clamp 到 0-255。

```wat
(module
  (memory (export "memory") 10)
  (func $brightness (export "brightness")
    (param $ptr i32) (param $count i32) (param $amount i32)
    (local $end i32) (local $i i32) (local $v i32)
    local.get $ptr local.get $count i32.const 4 i32.mul i32.add local.set $end
    local.get $ptr local.set $i
    block $break loop $continue
      local.get $i local.get $end i32.ge_u br_if $break
      ;; 处理 R
      local.get $i i32.load8_u local.get $amount i32.add
      local.tee $v
      i32.const 0 local.get $v i32.const 0 i32.gt_s select
      local.tee $v
      i32.const 255 local.get $v i32.const 255 i32.lt_s select
      local.get $i i32.store8
      ;; 处理 G
      local.get $i i32.load8_u offset=1 local.get $amount i32.add
      local.tee $v
      i32.const 0 local.get $v i32.const 0 i32.gt_s select
      local.tee $v
      i32.const 255 local.get $v i32.const 255 i32.lt_s select
      local.get $i i32.store8 offset=1
      ;; 处理 B
      local.get $i i32.load8_u offset=2 local.get $amount i32.add
      local.tee $v
      i32.const 0 local.get $v i32.const 0 i32.gt_s select
      local.tee $v
      i32.const 255 local.get $v i32.const 255 i32.lt_s select
      local.get $i i32.store8 offset=2
      ;; 跳过 A
      local.get $i i32.const 4 i32.add local.set $i
      br $continue
    end end)
)
```

**要点**：`select` 是 WASM 版三元表达式。clamp 需两步：≥ 0 再 ≤ 255。A 通道不参与亮度调整。
