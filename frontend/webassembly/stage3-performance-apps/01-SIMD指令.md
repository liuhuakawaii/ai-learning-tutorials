# SIMD 指令加速

## 什么是 SIMD

SIMD（Single Instruction, Multiple Data）——一条指令同时处理多个数据。

普通计算：
```
a[0] + b[0] → c[0]
a[1] + b[1] → c[1]
a[2] + b[2] → c[2]
a[3] + b[3] → c[3]
// 4 次加法指令
```

SIMD 计算：
```
[a[0], a[1], a[2], a[3]] + [b[0], b[1], b[2], b[3]] → [c[0], c[1], c[2], c[3]]
// 1 次加法指令，同时处理 4 个数据
```

128 位 SIMD 寄存器可以同时处理：
- 4 个 32 位浮点数
- 2 个 64 位浮点数
- 4 个 32 位整数

## WASM SIMD

WASM 的 SIMD 是 128 位向量运算。可以用编译器自动向量化，也可以手写 SIMD intrinsics。

### 自动向量化

编译器会自动将循环中的标量运算转换为 SIMD：

```rust
// Rust — 编译器会自动向量化这个循环
pub fn add_arrays(a: &[f32], b: &[f32], c: &mut [f32]) {
    for i in 0..a.len() {
        c[i] = a[i] + b[i];
    }
}
```

用 `wasm32` 目标编译时加 `-C target-feature=+simd128`：

```bash
rustc --target wasm32-unknown-unknown -C target-feature=+simd128 -O
```

### 手写 SIMD

用 `std::arch::wasm32` 模块：

```rust
use std::arch::wasm32::*;

pub unsafe fn add_arrays_simd(a: &[f32], b: &[f32], c: &mut [f32]) {
    let chunks = a.len() / 4;
    for i in 0..chunks {
        let offset = i * 4;
        let va = v128_load(a.as_ptr().add(offset) as *const v128);
        let vb = v128_load(b.as_ptr().add(offset) as *const v128);
        let vc = f32x4_add(va, vb);
        v128_store(c.as_mut_ptr().add(offset) as *mut v128, vc);
    }
    // 处理剩余元素
    for i in (chunks * 4)..a.len() {
        c[i] = a[i] + b[i];
    }
}
```

## 性能对比

| 操作 | 标量 | SIMD | 加速比 |
|------|------|------|--------|
| 数组加法 (1M) | 2.1ms | 0.6ms | 3.5× |
| 矩阵乘法 (512×512) | 180ms | 55ms | 3.3× |
| 图像灰度 (1920×1080) | 3ms | 0.9ms | 3.3× |

实际加速比取决于数据量和计算复杂度。小数据量（< 1000 元素）SIMD 的优势不明显。

## SIMD 适用场景

- 图像处理（逐像素计算）
- 音频处理（逐采样点计算）
- 矩阵运算（机器学习推理）
- 物理模拟（粒子系统）
- 数据分析（批量数值计算）

## 练习

### 练习一：向量点积

用 SIMD 实现两个 float 数组的点积运算，与标量版本对比性能。

### 练习二：图像亮度

用 SIMD 实现图像亮度调整，每个通道加一个常量后 clamp 到 0-255。

### 练习三：基准测试

编写基准测试，对比标量和 SIMD 在不同数据规模下的性能。

---

## 参考答案

### 练习一

```rust
use std::arch::wasm32::*;

pub unsafe fn dot_product_simd(a: &[f32], b: &[f32]) -> f32 {
    let chunks = a.len() / 4;
    let mut sum = f32x4_splat(0.0);
    for i in 0..chunks {
        let offset = i * 4;
        let va = v128_load(a.as_ptr().add(offset) as *const v128);
        let vb = v128_load(b.as_ptr().add(offset) as *const v128);
        sum = f32x4_add(sum, f32x4_mul(va, vb));
    }
    // 水平求和
    let arr: [f32; 4] = std::mem::transmute(sum);
    let mut result = arr[0] + arr[1] + arr[2] + arr[3];
    for i in (chunks * 4)..a.len() {
        result += a[i] * b[i];
    }
    result
}
```

### 练习二

```rust
pub unsafe fn brightness_simd(pixels: &mut [u8], amount: i32) {
    let amount_vec = i32x4_splat(amount);
    let zero = i32x4_splat(0);
    let max = i32x4_splat(255);

    for chunk in pixels.chunks_exact_mut(4) {
        let px = v128_load(chunk.as_ptr() as *const v128);
        // 提取 R/G/B，加 amount，clamp
        // ... SIMD 操作
    }
}
```
