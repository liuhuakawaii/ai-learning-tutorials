# 02 - WASM 文本格式（WAT）

## 场景引入

你打开一个 `.wasm` 二进制文件，看到的全是十六进制字节——`0x41 0x2A 0x6A`——完全无法理解。你需要一种人类可读的方式来编写和理解 WASM 模块。

WAT（WebAssembly Text Format）就是 `.wasm` 的人类可读版本，使用 S-expression 语法，与二进制格式一一对应。理解 WAT 是调试 WASM、理解编译器输出和手写优化模块的基础。

## 学习目标

- 掌握 WAT 的 S-expression 语法结构
- 理解 WASM 指令集：算术、控制流、内存操作
- 掌握 WASM 的类型系统和函数签名
- 理解线性内存模型：堆、栈、数据段
- 能够手写完整的 WAT 模块并编译运行

## S-expression 基础

WAT 使用 S-expression，所有代码写在括号中，操作符在前，操作数在后。

```wat
;; 最简单的函数：返回常量
(func (result i32)
  i32.const 42)    ;; 将 42 压入栈

;; 带参数的加法
(func $add (param $a i32) (param $b i32) (result i32)
  local.get $a     ;; 将参数 a 压入栈
  local.get $b     ;; 将参数 b 压入栈
  i32.add)         ;; 弹出两个值，相加，结果压入栈
```

WASM 是基于栈的虚拟机：指令从栈上弹出操作数，计算结果压回栈。

## 模块结构

```wat
(module
  (type $binary_op (func (param i32 i32) (result i32)))  ;; 类型声明
  (import "env" "print" (func $print (param i32)))        ;; 导入
  (memory (export "memory") 1 10)                         ;; 内存：初始1页，最大10页
  (global $counter (mut i32) (i32.const 0))               ;; 全局变量

  (func $add (export "add") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add)

  (data (i32.const 0) "Hello, WASM!")  ;; 数据段初始化
)
```

## 指令集

### 算术指令

```wat
;; 整数算术 (i32)
i32.const 10
i32.const 3
i32.add             ;; 10 + 3 = 13
i32.sub             ;; 13 - 3 = 10
i32.mul             ;; 10 * 3 = 30
i32.div_s           ;; 有符号除法

;; 浮点运算 (f64)
f64.const 3.14
f64.const 2.0
f64.mul             ;; 6.28

;; 位运算
i32.and   ;; 按位与
i32.or    ;; 按位或
i32.shl   ;; 左移
```

### 比较与控制流

```wat
;; 比较
i32.const 5
i32.const 3
i32.gt_s            ;; 5 > 3 → 1 (true)

;; if-else
(func $abs (param $x i32) (result i32)
  local.get $x
  i32.const 0
  i32.ge_s
  if (result i32)
    local.get $x
  else
    i32.const 0
    local.get $x
    i32.sub)

;; 循环：计算 1 到 n 的和
(func $sum (param $n i32) (result i32)
  (local $i i32) (local $total i32)
  i32.const 1 local.set $i
  i32.const 0 local.set $total
  block $break
    loop $continue
      local.get $i local.get $n i32.gt_s
      br_if $break
      local.get $total local.get $i i32.add local.set $total
      local.get $i i32.const 1 i32.add local.set $i
      br $continue
    end
  end
  local.get $total)
```

`block`/`loop`/`br`/`br_if` 是 WASM 控制流原语。`br` 跳转到标签，`br_if` 条件跳转。

### 内存操作

```wat
i32.const 0
i32.load             ;; 从地址 0 加载 i32

i32.const 100
i32.load offset=4    ;; 从地址 104 加载

i32.const 0
i32.const 42
i32.store            ;; 在地址 0 存储 42

i32.load8_u          ;; 加载 1 字节，零扩展
i32.store8           ;; 存储低 8 位
```

## 内存模型

WASM 线性内存是一块连续字节数组，从地址 0 开始：

```
地址:  0                    64KB
       ┌─────────────────────┬──────────────────
       │  数据段/栈/堆        │  memory.grow 扩展
       └─────────────────────┴──────────────────
```

```wat
(module
  (memory (export "memory") 1)
  (data (i32.const 0) "Hello")          ;; 字符串写入数据段
  (data (i32.const 100) "\2A\00\00\00") ;; 整数 42 (小端序)
)
```

`memory.grow` 动态扩展内存，返回旧页数（失败返回 -1）。

## 类型系统

| 类型 | 说明 | 用途 |
|------|------|------|
| `i32` | 32 位整数 | 整数运算、地址 |
| `i64` | 64 位整数 | 大整数 |
| `f32` | 32 位浮点 | 图形计算 |
| `f64` | 64 位浮点 | 科学计算 |

WASM 支持多返回值：

```wat
(func $divmod (param $a i32) (param $b i32) (result i32 i32)
  local.get $a local.get $b i32.div_s
  local.get $a local.get $b i32.rem_s)
```

## 完整示例：字符串长度

```wat
(module
  (memory (export "memory") 1)
  (data (i32.const 0) "Hello, WebAssembly!\00")

  (func $strlen (export "strlen") (param $ptr i32) (result i32)
    (local $len i32)
    i32.const 0 local.set $len
    block $break
      loop $continue
        local.get $ptr local.get $len i32.add
        i32.load8_u
        i32.eqz br_if $break
        local.get $len i32.const 1 i32.add local.set $len
        br $continue
      end
    end
    local.get $len)
)
```

```bash
wat2wasm string.wat -o string.wasm
```

```javascript
const { instance } = await WebAssembly.instantiateStreaming(fetch('string.wasm'));
console.log('长度:', instance.exports.strlen(0)); // 19
```

## 常见误区

1. **"WAT 就是 WASM"** — WAT 是文本表示，需要 `wat2wasm` 转为二进制才能运行。
2. **"WASM 的栈和 C 的调用栈一样"** — 不同。WASM 操作数栈是虚拟机概念，C 调用栈存储局部变量和返回地址。
3. **"内存增长是免费的"** — 不是。`memory.grow` 可能触发内存分配和数据拷贝。

## 工程建议

- 用 `wasm2wat` 反汇编查看编译器输出，帮助理解生成的指令
- 不要手写复杂 WAT，复杂逻辑用 C/Rust/AssemblyScript 编写
- 关注内存对齐，对齐的访问性能更好
- 用 `wasm-validate` 检查 WAT 语法和类型错误

## 小结

- WAT 使用 S-expression 语法，与 WASM 二进制一一对应
- 基于栈的虚拟机，指令从栈弹出操作数、结果压回栈
- 控制流通过 block/loop/br/br_if 实现
- 线性内存是连续字节数组，支持数据段初始化和动态增长

## 练习

### 练习一：斐波那契数列

用 WAT 编写递归版 `fib(n)`，测试 `fib(10)` 是否返回 55。

### 练习二：数组求和

用 WAT 编写函数，接受内存起始地址和元素个数，对 i32 数组求和。

---

## 参考答案

### 练习一

**思路**：递归斐波那契用 `if-else` 处理基本情况，用 `call $fib` 自调用。

```wat
(module
  (func $fib (export "fib") (param $n i32) (result i32)
    local.get $n i32.const 1 i32.le_s
    if (result i32)
      local.get $n
    else
      local.get $n i32.const 1 i32.sub call $fib
      local.get $n i32.const 2 i32.sub call $fib
      i32.add
    end)
)
```

```javascript
console.log(instance.exports.fib(10)); // 55
```

**要点**：递归函数 `call $fib` 调用自身，每次递归创建新栈帧。时间复杂度 O(2^n)，实际项目应使用迭代版。

### 练习二

**思路**：数组元素连续存储，每个 i32 占 4 字节，地址偏移每次加 4。

```wat
(module
  (memory (export "memory") 1)
  (func $arraySum (export "arraySum") (param $ptr i32) (param $count i32) (result i32)
    (local $sum i32) (local $i i32)
    i32.const 0 local.set $sum
    i32.const 0 local.set $i
    block $break loop $continue
      local.get $i local.get $count i32.ge_s br_if $break
      local.get $sum
      local.get $ptr local.get $i i32.const 4 i32.mul i32.add i32.load
      i32.add local.set $sum
      local.get $i i32.const 1 i32.add local.set $i
      br $continue
    end end
    local.get $sum)
)
```

```javascript
const memory = new Int32Array(instance.exports.memory.buffer);
[10, 20, 30, 40, 50].forEach((v, i) => memory[i] = v);
console.log(instance.exports.arraySum(0, 5)); // 150
```

**要点**：`ptr + i * 4` 计算元素地址，`i32.load` 加载 4 字节。注意 `count * 4` 不能超过内存页大小。
