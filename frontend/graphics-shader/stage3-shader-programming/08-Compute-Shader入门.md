# Compute Shader 入门

## 场景引入

传统渲染管线中，GPU 只能做"画图"的事——顶点变换、光栅化、片元着色。但 GPU 拥有数千个并行计算核心，这些核心能不能用来做通用计算？答案是肯定的。Compute Shader 打破了渲染管线的限制，让 GPU 成为一个通用的并行计算引擎。粒子模拟、物理计算、图像处理、机器学习推理——这些以前只能在 CPU 上做的任务，现在可以在 GPU 上以数百倍的速度完成。

## 学习目标

1. 理解 GPU 并行计算的基本概念（工作组、线程）
2. 掌握 SSBO（Shader Storage Buffer Object）的使用
3. 了解数据同步（barrier）机制
4. 实现一个完整的粒子模拟系统
5. 了解 WebGPU Compute 的基本用法

---

## 一、GPU 并行计算概念

### 1.1 从渲染到计算

```
传统渲染管线：
顶点 → 图元装配 → 光栅化 → 片元 → 帧缓冲
  │                                    │
  └── 数据只能单向流动 ──────────────────┘

Compute Shader：
┌─────────────────────────────────────┐
│           GPU 计算核心              │
│                                     │
│  线程 0 ──→ 读 Buffer ──→ 写 Buffer │
│  线程 1 ──→ 读 Buffer ──→ 写 Buffer │
│  线程 2 ──→ 读 Buffer ──→ 写 Buffer │
│  ...                                │
│  线程 N ──→ 读 Buffer ──→ 写 Buffer │
│                                     │
│  数据可以任意读写，没有管线限制       │
└─────────────────────────────────────┘
```

### 1.2 工作组与线程

```
工作组（Work Group）结构：

Work Group (8, 8, 1) = 64 个线程

  ┌───┬───┬───┬───┬───┬───┬───┬───┐
  │0,0│1,0│2,0│3,0│4,0│5,0│6,0│7,0│  Local ID
  ├───┼───┼───┼───┼───┼───┼───┼───┤
  │0,1│1,1│2,1│3,1│4,1│5,1│6,1│7,1│
  ├───┼───┼───┼───┼───┼───┼───┼───┤
  │...│   │   │   │   │   │   │...│
  ├───┼───┼───┼───┼───┼───┼───┼───┤
  │0,7│1,7│2,7│3,7│4,7│5,7│6,7│7,7│
  └───┴───┴───┴───┴───┴───┴───┴───┘

全局线程数 = WorkGroup 数 × 每个 WorkGroup 的线程数
例如：dispatch(16, 16, 1) × local_size(8, 8, 1)
    = 128 × 128 = 16384 个线程
```

### 1.3 GLSL 中的声明

```glsl
#version 430

// 工作组大小声明（必须是编译时常量）
layout(local_size_x = 8, local_size_y = 8, local_size_z = 1) in;

// 内建变量
// gl_LocalInvocationID    — 本地线程 ID (0~local_size-1)
// gl_WorkGroupID          — 工作组 ID (0~num_work_groups-1)
// gl_GlobalInvocationID   — 全局线程 ID
// gl_LocalInvocationIndex — 本地线程的线性索引

void main() {
    uvec3 globalID = gl_GlobalInvocationID;
    uvec3 localID = gl_LocalInvocationID;
    uvec3 groupID = gl_WorkGroupID;

    // 每个线程处理一个数据元素
    uint index = globalID.x + globalID.y * gl_NumWorkGroups.x * gl_WorkGroupSize.x;
}
```

---

## 二、SSBO（Shader Storage Buffer Object）

### 2.1 什么是 SSBO？

SSBO 是 GPU 可读写的缓冲区，比 Uniform Buffer 更灵活——支持更大的数据量和写操作：

```
Uniform Buffer vs SSBO：

特性              UBO              SSBO
────────────────────────────────────────
最大大小          64KB             几乎无限
可写              否               是
数组支持          固定大小          动态大小
原子操作          否               是
性能              快（缓存）        稍慢（无缓存）
```

### 2.2 GLSL 中使用 SSBO

```glsl
#version 430
layout(local_size_x = 256) in;

// 只读 SSBO
layout(std430, binding = 0) readonly buffer InputData {
    float inputData[];
};

// 可读写 SSBO
layout(std430, binding = 1) buffer OutputData {
    float outputData[];
};

// 结构化数据
struct Particle {
    vec4 position;  // xyz = 位置, w = 质量
    vec4 velocity;  // xyz = 速度, w = 生命周期
};

layout(std430, binding = 2) buffer ParticleBuffer {
    Particle particles[];
};

void main() {
    uint id = gl_GlobalInvocationID.x;

    // 读取输入
    float value = inputData[id];

    // 计算
    float result = value * value + sin(value);

    // 写入输出
    outputData[id] = result;
}
```

### 2.3 TypeScript 端创建 SSBO

```typescript
// 原生 WebGL2
const data = new Float32Array(1024);
for (let i = 0; i < 1024; i++) {
    data[i] = Math.random();
}

// 创建 SSBO
const ssbo = gl.createBuffer();
gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, ssbo);
gl.bufferData(gl.SHADER_STORAGE_BUFFER, data, gl.DYNAMIC_COPY);

// 绑定到绑定点
gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, ssbo);

// 分配工作组并执行
gl.dispatchCompute(4, 1, 1);  // 4 个工作组 × 256 线程 = 1024 线程
gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);

// 读取结果
gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, ssbo);
const result = new Float32Array(1024);
gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, result);
```

**Three.js 中使用**：

```typescript
import * as THREE from 'three';

// 创建 StorageBuffer
const buffer = new THREE.StorageBufferAttribute(1024, 1);

// 在 ShaderMaterial 中使用
const material = new THREE.ShaderMaterial({
    computeShader: computeShaderSource,
    uniforms: {},
});

// 使用 ComputeShader（Three.js r159+）
const computeNode = new THREE.ComputeShader(material, {
    workgroupSize: [256, 1, 1],
    count: 1024,
});
```

---

## 三、数据同步（Barrier）

### 3.1 为什么需要同步？

GPU 的线程并行执行，不同工作组之间的执行顺序不确定。如果一个线程需要读取另一个线程写入的数据，必须确保写入已经完成：

```
没有同步的危险：

线程 A (工作组 0)          线程 B (工作组 1)
  │                          │
  ├─ 写入 buffer[1]          │
  │                          ├─ 读取 buffer[1] ← 可能读到旧值！
  │  （写入可能还没完成）      │
  ▼                          ▼

使用 barrier 后：

线程 A                      线程 B
  │                          │
  ├─ 写入 buffer[1]          │
  │                          │
  ├─ memoryBarrier()  ←─── 等待写入完成
  │                          │
  │                          ├─ 读取 buffer[1] ← 保证读到新值
  ▼                          ▼
```

### 3.2 Barrier 类型

```glsl
// 全局内存屏障（所有线程可见）
memoryBarrier();

// SSBO 屏障（只对 SSBO 有效）
memoryBarrierBuffer();

// 工作组内屏障（同一工作组内的线程同步）
barrier();

// 纹理屏障
memoryBarrierImage();

// 原子计数器屏障
memoryBarrierAtomicCounter();
```

### 3.3 使用示例

```glsl
#version 430
layout(local_size_x = 256) in;

layout(std430, binding = 0) buffer Data {
    float data[];
};

shared float localData[256];  // 工作组共享内存

void main() {
    uint id = gl_LocalInvocationID.x;
    uint globalID = gl_GlobalInvocationID.x;

    // 读取全局数据到共享内存
    localData[id] = data[globalID];

    // 同步：确保所有线程都读取完毕
    barrier();

    // 使用共享内存进行计算（例如前缀和）
    for (uint stride = 1; stride < 256; stride *= 2) {
        if (id >= stride) {
            localData[id] += localData[id - stride];
        }
        barrier();  // 每轮计算后同步
    }

    // 写回全局内存
    data[globalID] = localData[id];
}
```

---

## 四、粒子模拟示例

### 4.1 Compute Shader 版粒子系统

```glsl
#version 430
layout(local_size_x = 256) in;

struct Particle {
    vec4 position;   // xyz = 位置, w = 质量
    vec4 velocity;   // xyz = 速度, w = 生命周期
    vec4 color;      // rgba = 颜色
};

layout(std430, binding = 0) buffer ParticleBuffer {
    Particle particles[];
};

uniform float uDeltaTime;
uniform float uTime;
uniform vec3 uGravity;
uniform vec3 uMousePos;
uniform float uMouseForce;

void main() {
    uint id = gl_GlobalInvocationID.x;
    if (id >= particles.length()) return;

    Particle p = particles[id];

    // 重力
    vec3 force = uGravity * p.position.w;

    // 鼠标吸引力
    vec3 toMouse = uMousePos - p.position.xyz;
    float dist = length(toMouse);
    if (dist > 0.1) {
        force += normalize(toMouse) * uMouseForce / (dist * dist);
    }

    // 阻尼
    force -= p.velocity.xyz * 0.1;

    // 更新速度
    p.velocity.xyz += force * uDeltaTime;

    // 更新位置
    p.position.xyz += p.velocity.xyz * uDeltaTime;

    // 生命周期衰减
    p.velocity.w -= uDeltaTime;

    // 重生
    if (p.velocity.w <= 0.0) {
        p.position.xyz = vec3(
            sin(float(id) * 0.1) * 5.0,
            10.0,
            cos(float(id) * 0.1) * 5.0
        );
        p.velocity.xyz = vec3(0.0, -2.0, 0.0);
        p.velocity.w = 3.0 + fract(sin(float(id) * 12.9898) * 43758.5453) * 4.0;
    }

    // 边界反弹
    if (p.position.y < 0.0) {
        p.position.y = 0.0;
        p.velocity.y *= -0.6;
    }

    particles[id] = p;
}
```

### 4.2 渲染 Shader

```glsl
// 粒子渲染顶点着色器
attribute vec3 aPosition;  // 粒子位置
attribute vec4 aColor;     // 粒子颜色

uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uPointSize;

varying vec4 vColor;

void main() {
    vec4 viewPos = uViewMatrix * vec4(aPosition, 1.0);
    gl_Position = uProjectionMatrix * viewPos;

    // 点大小随距离衰减
    gl_PointSize = uPointSize / -viewPos.z;

    vColor = aColor;
}

// 粒子渲染片元着色器
precision mediump float;

varying vec4 vColor;

void main() {
    // 圆形粒子
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    // 柔和边缘
    float alpha = smoothstep(0.5, 0.3, dist);
    gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
}
```

### 4.3 TypeScript 端集成

```typescript
class ParticleSystem {
    private gl: WebGL2RenderingContext;
    private computeProgram: WebGLProgram;
    private renderProgram: WebGLProgram;
    private particleBuffer: WebGLBuffer;
    private particleCount: number;

    constructor(gl: WebGL2RenderingContext, count: number) {
        this.gl = gl;
        this.particleCount = count;

        // 创建粒子数据
        const data = new Float32Array(count * 12); // 3 个 vec4
        for (let i = 0; i < count; i++) {
            const offset = i * 12;
            data[offset] = Math.random() * 10 - 5;      // position.x
            data[offset + 1] = Math.random() * 10;       // position.y
            data[offset + 2] = Math.random() * 10 - 5;   // position.z
            data[offset + 3] = 1.0;                       // mass
            data[offset + 8] = 1.0;                       // color.r
            data[offset + 9] = 0.5;                       // color.g
            data[offset + 10] = 0.2;                      // color.b
            data[offset + 11] = 1.0;                      // color.a
        }

        // 创建 SSBO
        this.particleBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, this.particleBuffer);
        gl.bufferData(gl.SHADER_STORAGE_BUFFER, data, gl.DYNAMIC_COPY);
    }

    update(deltaTime: number, time: number) {
        const gl = this.gl;
        gl.useProgram(this.computeProgram);

        // 设置 Uniform
        gl.uniform1f(gl.getUniformLocation(this.computeProgram, 'uDeltaTime'), deltaTime);
        gl.uniform1f(gl.getUniformLocation(this.computeProgram, 'uTime'), time);

        // 绑定 SSBO
        gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, this.particleBuffer);

        // 执行计算
        const workgroups = Math.ceil(this.particleCount / 256);
        gl.dispatchCompute(workgroups, 1, 1);
        gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);
    }

    render(camera: { viewMatrix: Float32Array, projMatrix: Float32Array }) {
        const gl = this.gl;
        gl.useProgram(this.renderProgram);

        // 绑定粒子数据为顶点属性
        gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 48, 0);  // position
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 48, 32); // color

        // 绘制
        gl.drawArrays(gl.POINTS, 0, this.particleCount);
    }
}
```

---

## 五、WebGPU Compute 对比

### 5.1 WebGPU 的优势

```
WebGL2 Compute vs WebGPU Compute：

特性              WebGL2 Compute    WebGPU Compute
────────────────────────────────────────────────
API 复杂度        高               低
类型安全          无               有（WGSL 类型系统）
工作组大小限制     有限              更灵活
共享内存           有限              更大
原子操作           基础              更丰富
错误检查           运行时             编译时
浏览器支持         Chrome            Chrome, Firefox, Safari
```

### 5.2 WebGPU Compute 示例

```wgsl
// WGSL (WebGPU Shading Language)
@group(0) @binding(0)
var<storage, read> inputData: array<f32>;

@group(0) @binding(1)
var<storage, read_write> outputData: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let id = globalId.x;
    if (id >= arrayLength(&inputData)) {
        return;
    }

    let value = inputData[id];
    outputData[id] = value * value + sin(value);
}
```

```typescript
// WebGPU Compute 调用
async function runCompute() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter!.requestDevice();

    // 创建 Buffer
    const inputBuffer = device.createBuffer({
        size: 1024 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const outputBuffer = device.createBuffer({
        size: 1024 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // 创建 Bind Group
    const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: inputBuffer } },
            { binding: 1, resource: { buffer: outputBuffer } },
        ],
    });

    // 创建 Compute Pipeline
    const computePipeline = device.createComputePipeline({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({
                code: computeShaderSource,
            }),
            entryPoint: 'main',
        },
    });

    // 执行
    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(4, 1, 1);  // 4 个工作组
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);
}
```

---

## 常见误区

1. **忘记 Memory Barrier**：写入 SSBO 后必须调用 `memoryBarrier()` 或 `gl.memoryBarrier()`，否则后续读取可能看到旧数据。

2. **工作组大小不是越大越好**：每个 GPU 有最优的工作组大小（通常是 64 或 128 的倍数）。过大的工作组会占用太多共享内存，降低并行度。

3. **SSBO 的写冲突**：多个线程同时写入同一个 SSBO 位置会导致未定义行为。需要使用原子操作或确保每个线程写入不同的位置。

4. **Compute Shader 不是万能的**：对于小数据量或简单计算，CPU 的开销（数据传输、Shader 编译）可能超过 GPU 计算的收益。

---

## 工程建议

1. **合理选择工作组大小**：通常是 64、128、256、512。选择能被总线程数整除的值，避免线程浪费。

2. **最小化数据传输**：尽量在 GPU 端完成所有计算，只在必要时读回 CPU。数据传输是最大的性能瓶颈。

3. **使用 Shared Memory**：对于需要频繁访问相邻数据的算法（如矩阵乘法、前缀和），使用工作组共享内存可以大幅提高性能。

4. **Profile 工具**：使用 Spector.js、WebGPU Inspector 等工具分析 Compute Shader 的执行时间和内存使用。

---

## 小结

Compute Shader 打破了传统渲染管线的限制，让 GPU 成为通用的并行计算引擎。本课讲解了工作组与线程的概念、SSBO 的使用、数据同步机制，并通过粒子模拟示例展示了完整的 Compute Shader 工作流。最后对比了 WebGL2 Compute 和 WebGPU Compute 的差异。掌握 Compute Shader 后，你就能利用 GPU 的并行能力加速各种计算任务。

## 练习

1. 实现一个基于 Compute Shader 的图像模糊：使用工作组共享内存优化邻域采样。

2. 编写一个前缀和（Prefix Sum）的 Compute Shader 实现，理解工作组内和工作组间的同步。

3. 实现一个 N-body 引力模拟：每个粒子受所有其他粒子的引力作用，使用 Compute Shader 并行计算。

4. 对比 Compute Shader 和 CPU 计算的性能：分别在 GPU 和 CPU 上执行相同的计算任务，记录时间差异。

---

## 参考答案

### 练习一

**思路**：基于 Compute Shader 的图像模糊核心是：将图像数据加载到 SSBO 中，每个线程负责一个像素，使用工作组共享内存（shared memory）缓存邻域数据，减少全局内存访问。先水平模糊，再垂直模糊（分离式）。

**答案**：
```glsl
// 图像模糊 Compute Shader
#version 430
layout(local_size_x = 16, local_size_y = 16) in;

layout(std430, binding = 0) readonly buffer InputImage {
    vec4 inputPixels[];
};

layout(std430, binding = 1) buffer OutputImage {
    vec4 outputPixels[];
};

uniform int uImageWidth;
uniform int uImageHeight;
uniform int uBlurRadius;
uniform bool uHorizontal;  // true = 水平模糊，false = 垂直模糊

// 工作组共享内存（缓存邻域数据）
shared vec4 tile[16 + 32];  // local_size + 2 * max_radius

void main() {
    ivec2 coord = ivec2(gl_GlobalInvocationID.xy);
    int index = coord.y * uImageWidth + coord.x;
    int localIndex = int(gl_LocalInvocationIndex);

    // 确定读取方向
    ivec2 dir = uHorizontal ? ivec2(1, 0) : ivec2(0, 1);

    // 将邻域数据加载到共享内存
    int tileStart = int(gl_WorkGroupID.x) * 16 - uBlurRadius;
    for (int i = 0; i < 16 + 2 * uBlurRadius; i++) {
        ivec2 sampleCoord = coord + dir * (i - int(gl_LocalInvocationIndex) - uBlurRadius);
        sampleCoord = clamp(sampleCoord, ivec2(0), ivec2(uImageWidth - 1, uImageHeight - 1));
        int sampleIndex = sampleCoord.y * uImageWidth + sampleCoord.x;
        tile[i] = inputPixels[sampleIndex];
    }

    // 同步工作组内线程
    barrier();

    // 高斯模糊
    vec4 result = vec4(0.0);
    float totalWeight = 0.0;

    for (int i = -uBlurRadius; i <= uBlurRadius; i++) {
        float weight = exp(-float(i * i) / (2.0 * float(uBlurRadius * uBlurRadius)));
        int tileIndex = int(gl_LocalInvocationIndex) + uBlurRadius + i;
        result += tile[tileIndex] * weight;
        totalWeight += weight;
    }

    outputPixels[index] = result / totalWeight;
}
```

```typescript
// TypeScript 端调用
const blurProgram = createComputeProgram(gl, blurShaderSource);

gl.useProgram(blurProgram);

// 设置 Uniform
gl.uniform1i(gl.getUniformLocation(blurProgram, 'uImageWidth'), width);
gl.uniform1i(gl.getUniformLocation(blurProgram, 'uImageHeight'), height);
gl.uniform1i(gl.getUniformLocation(blurProgram, 'uBlurRadius'), 5);
gl.uniform1i(gl.getUniformLocation(blurProgram, 'uHorizontal'), 1);

// 绑定 SSBO
gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, inputBuffer);
gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, outputBuffer);

// 调度计算
gl.dispatchCompute(Math.ceil(width / 16), Math.ceil(height / 16), 1);
gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);
```

**要点**：
- 共享内存 `tile` 缓存工作组内所有线程需要的邻域数据，避免重复从全局内存读取
- `barrier()` 确保所有线程都完成共享内存的写入后才开始读取
- 分离式模糊将 O(r²) 的 2D 卷积降低为 O(2r) 的两次 1D 卷积
- 工作组大小 16×16 = 256 线程，是 GPU 上常用的配置

---

### 练习二

**思路**：前缀和（Prefix Sum / Scan）是并行计算的基础算法。核心思想是：在工作组内使用上扫（up-sweep）和下扫（down-sweep）两阶段完成前缀和，工作组间通过额外的 pass 处理跨工作组的累加。

**答案**：
```glsl
// 前缀和 Compute Shader
#version 430
layout(local_size_x = 256) in;

layout(std430, binding = 0) buffer Data {
    float data[];
};

layout(std430, binding = 1) buffer Sums {
    float sums[];  // 每个工作组的总和
};

shared float sharedData[256];

void main() {
    uint tid = gl_LocalInvocationIndex;
    uint gid = gl_GlobalInvocationID.x;

    // 加载数据到共享内存
    sharedData[tid] = data[gid];
    barrier();

    // 上扫（Up-Sweep / Reduce）
    for (uint stride = 1; stride < 256; stride *= 2) {
        uint index = (tid + 1) * stride * 2 - 1;
        if (index < 256) {
            sharedData[index] += sharedData[index - stride];
        }
        barrier();
    }

    // 保存工作组总和
    if (tid == 0) {
        sums[gl_WorkGroupID.x] = sharedData[255];
        sharedData[255] = 0.0;  // 清零最后一个元素
    }
    barrier();

    // 下扫（Down-Sweep）
    for (uint stride = 128; stride >= 1; stride /= 2) {
        uint index = (tid + 1) * stride * 2 - 1;
        if (index < 256) {
            float temp = sharedData[index - stride];
            sharedData[index - stride] = sharedData[index];
            sharedData[index] += temp;
        }
        barrier();
    }

    // 写回结果
    data[gid] = sharedData[tid];
}
```

```typescript
// TypeScript 端：多 pass 前缀和
async function prefixSum(gl: WebGL2RenderingContext, data: Float32Array) {
    const n = data.length;
    const workGroupSize = 256;
    const numGroups = Math.ceil(n / workGroupSize);

    // Pass 1: 工作组内前缀和
    gl.dispatchCompute(numGroups, 1, 1);
    gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);

    // Pass 2: 对工作组总和做前缀和（递归或 CPU 处理）
    const sums = new Float32Array(numGroups);
    gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, sumsBuffer);
    gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, sums);

    // CPU 端计算工作组总和的前缀和
    for (let i = 1; i < numGroups; i++) {
        sums[i] += sums[i - 1];
    }

    // Pass 3: 将工作组偏移加回每个元素
    gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, sumsBuffer);
    gl.bufferSubData(gl.SHADER_STORAGE_BUFFER, 0, sums);
    gl.dispatchCompute(numGroups, 1, 1);
    gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);
}
```

**要点**：
- 上扫阶段：每个线程将其左侧 `stride` 位置的值累加到自身，步长倍增
- 下扫阶段：从最大步长开始，将上一步的累加结果向下传递
- `barrier()` 在每一步之后同步，确保所有线程看到最新的共享内存值
- 工作组间的前缀和需要额外的 pass，可以递归处理或在 CPU 端完成

---

### 练习三

**思路**：N-body 引力模拟的核心是：每个粒子受所有其他粒子的引力作用。GPU 上用 Compute Shader 并行计算每个粒子受到的合力，然后更新速度和位置。关键优化是用共享内存缓存工作组内的粒子位置，减少全局内存访问。

**答案**：
```glsl
// N-body Compute Shader
#version 430
layout(local_size_x = 256) in;

struct Particle {
    vec4 position;  // xyz = 位置，w = 质量
    vec4 velocity;  // xyz = 速度，w = 未使用
};

layout(std430, binding = 0) buffer Particles {
    Particle particles[];
};

uniform float uDeltaTime;
uniform float uGravity;
uniform float uSoftening;  // 软化因子，防止除零
uniform int uParticleCount;

shared vec4 sharedPositions[256];  // 共享内存缓存位置

void main() {
    uint gid = gl_GlobalInvocationID.x;
    uint lid = gl_LocalInvocationIndex;

    if (gid >= uParticleCount) return;

    vec3 myPos = particles[gid].position.xyz;
    float myMass = particles[gid].position.w;
    vec3 force = vec3(0.0);

    // 遍历所有工作组
    uint numGroups = (uParticleCount + 255) / 256;
    for (uint g = 0; g < numGroups; g++) {
        // 将当前工作组的数据加载到共享内存
        uint loadIndex = g * 256 + lid;
        if (loadIndex < uParticleCount) {
            sharedPositions[lid] = particles[loadIndex].position;
        } else {
            sharedPositions[lid] = vec4(0.0);
        }
        barrier();

        // 计算与当前工作组内所有粒子的引力
        for (uint j = 0; j < 256; j++) {
            vec3 otherPos = sharedPositions[j].xyz;
            float otherMass = sharedPositions[j].w;

            vec3 dir = otherPos - myPos;
            float distSq = dot(dir, dir) + uSoftening * uSoftening;
            float dist = sqrt(distSq);

            // F = G * m1 * m2 / r^2
            if (dist > uSoftening) {
                force += dir * (uGravity * otherMass / (distSq * dist));
            }
        }
        barrier();
    }

    // 更新速度和位置（Verlet 积分）
    vec3 velocity = particles[gid].velocity.xyz;
    velocity += force * uDeltaTime;

    // 速度衰减（模拟阻力）
    velocity *= 0.999;

    particles[gid].velocity.xyz = velocity;
    particles[gid].position.xyz = myPos + velocity * uDeltaTime;
}
```

**要点**：
- 共享内存缓存工作组内所有粒子的位置，每次 barrier 后切换到下一个工作组
- 软化因子 `uSoftening` 防止粒子距离极近时引力趋于无穷（数值稳定性）
- Verlet 积分比 Euler 积分更稳定，适合长时间模拟
- `uParticleCount` 不一定是 256 的倍数，需要边界检查

---

### 练习四

**思路**：性能对比需要在 GPU（Compute Shader）和 CPU 上执行相同的计算任务，记录各自的时间。选择的任务应有足够的并行度（如矩阵运算、粒子模拟），以体现 GPU 的优势。使用 `performance.now()` 或 WebGL timer query 精确计时。

**答案**：
```typescript
// GPU vs CPU 性能对比
async function benchmarkGPU(gl: WebGL2RenderingContext, particleCount: number) {
    // GPU 计时（使用 WebGL timer query）
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const query = gl.createQuery()!;

    gl.beginQuery(ext.TIME_ELAPSED_EXT, query);

    // 调度 Compute Shader
    gl.dispatchCompute(Math.ceil(particleCount / 256), 1, 1);
    gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);

    gl.endQuery(ext.TIME_ELAPSED_EXT);

    // 等待结果
    let available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
    while (!available) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
    }
    const gpuTime = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;  // 纳秒 → 毫秒
    gl.deleteQuery(query);

    return gpuTime;
}

function benchmarkCPU(particleCount: number) {
    const positions = new Float32Array(particleCount * 4);
    const velocities = new Float32Array(particleCount * 4);
    const gravity = 0.001;
    const deltaTime = 0.016;

    const start = performance.now();

    for (let i = 0; i < particleCount; i++) {
        let fx = 0, fy = 0, fz = 0;
        const ix = positions[i * 4], iy = positions[i * 4 + 1], iz = positions[i * 4 + 2];

        for (let j = 0; j < particleCount; j++) {
            const dx = positions[j * 4] - ix;
            const dy = positions[j * 4 + 1] - iy;
            const dz = positions[j * 4 + 2] - iz;
            const distSq = dx * dx + dy * dy + dz * dz + 0.01;
            const dist = Math.sqrt(distSq);
            const force = gravity * positions[j * 4 + 3] / (distSq * dist);
            fx += dx * force;
            fy += dy * force;
            fz += dz * force;
        }

        velocities[i * 4] += fx * deltaTime;
        velocities[i * 4 + 1] += fy * deltaTime;
        velocities[i * 4 + 2] += fz * deltaTime;
    }

    const cpuTime = performance.now() - start;
    return cpuTime;
}

// 运行对比
const particleCount = 8192;
const gpuTime = await benchmarkGPU(gl, particleCount);
const cpuTime = benchmarkCPU(particleCount);
console.log(`GPU: ${gpuTime.toFixed(2)}ms, CPU: ${cpuTime.toFixed(2)}ms`);
```

**要点**：
- N-body 的计算复杂度是 O(n²)，粒子数量越大 GPU 优势越明显
- 8192 个粒子：CPU 可能需要 100ms+，GPU 通常 < 1ms
- WebGL timer query 是精确测量 GPU 时间的标准方式，避免 CPU-GPU 同步开销
- 数据传输（CPU → GPU → CPU）是 GPU 计算的主要瓶颈之一
