# 第1课：WebGL 基础渲染管线

## 场景引入

你打开一个网页，看到一个旋转的 3D 三角形，颜色从红到蓝平滑过渡。这背后发生了什么？浏览器拿到你写的 JavaScript 代码，把顶点数据送到 GPU，GPU 上跑着两段小程序——顶点着色器决定每个点画在哪，片元着色器决定每个像素是什么颜色。这整条从数据到像素的流水线，就是 WebGL 渲染管线。理解它，你才能真正控制 GPU 做什么。

## 学习目标

1. 理解 WebGL 渲染管线的完整流程，从顶点数据到最终像素
2. 掌握顶点着色器和片元着色器的职责与编写方式
3. 学会使用 VBO、VAO、EBO 管理顶点数据
4. 理解 attribute、uniform、varying 三种变量的区别与用法
5. 能够用 WebGL2 + TypeScript 完成一个带自定义着色器的三角形渲染

## 一、渲染管线概览

WebGL 渲染管线是一条固定流程的流水线，你的代码负责准备数据和编写可编程阶段，GPU 按顺序执行：

```
  顶点数据 (JS/TS)
       │
       ▼
  ┌─────────────┐
  │  顶点着色器  │  ← 你写的 GLSL，处理每个顶点
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │  图元装配    │  ← 把顶点组装成三角形
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │  光栅化      │  ← 三角形 → 片元（像素候选）
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │  片元着色器  │  ← 你写的 GLSL，计算每个像素颜色
  └──────┬──────┘
         ▼
  ┌─────────────┐
  │  测试与混合  │  ← 深度测试、模板测试、Alpha 混合
  └──────┬──────┘
         ▼
     帧缓冲 → 屏幕
```

你只能控制两个着色器阶段，其余由 GPU 固定执行。理解这条管线是所有 3D 图形编程的基础。

## 二、着色器语言 GLSL ES

WebGL 使用 GLSL ES（OpenGL Shading Language for Embedded Systems）。着色器程序有固定的入口结构：

```glsl
// 顶点着色器
#version 300 es
precision highp float;

in vec3 aPosition;    // 顶点位置（attribute）
in vec3 aColor;       // 顶点颜色（attribute）
uniform mat4 uMVP;    // 模型-视图-投影矩阵（uniform）
out vec3 vColor;      // 传递给片元着色器（varying）

void main() {
    gl_Position = uMVP * vec4(aPosition, 1.0);
    vColor = aColor;  // 直接传递，光栅化阶段会插值
}
```

```glsl
// 片元着色器
#version 300 es
precision highp float;

in vec3 vColor;       // 从顶点着色器插值而来
out vec4 fragColor;   // 最终输出颜色

void main() {
    fragColor = vec4(vColor, 1.0);
}
```

三种变量的核心区别：

| 变量类型 | 作用域 | 数据来源 | 逐顶点/逐片元 |
|---------|--------|---------|-------------|
| `in` (attribute) | 顶点着色器 | CPU 传入的顶点数据 | 逐顶点 |
| `uniform` | 两个着色器 | CPU 传入的常量 | 全局统一 |
| `out`/`in` (varying) | 顶点→片元 | 顶点着色器输出 | 光栅化自动插值 |

## 三、VBO、VAO 与 EBO

这三个缓冲区对象负责把顶点数据从 CPU 送到 GPU：

```
  CPU 内存                    GPU 显存
  ┌──────────┐              ┌──────────────┐
  │ 顶点数组  │ ──上传──→   │  VBO (缓冲区) │
  └──────────┘              └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │  VAO (顶点数组)│ ← 记录 VBO 的布局
                            └──────┬───────┘
                                   │
                            ┌──────▼───────┐
                            │  EBO (索引缓冲)│ ← 可选，复用顶点
                            └──────────────┘
```

- **VBO（Vertex Buffer Object）**：存储顶点属性数据（位置、颜色、法线等）
- **VAO（Vertex Array Object）**：记录 VBO 的绑定方式和属性布局，切换时只需绑定 VAO
- **EBO（Element Buffer Object）**：存储索引数据，避免重复顶点

## 四、完整代码：渲染一个彩色三角形

```typescript
// triangle.ts — WebGL2 渲染彩色三角形
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;
if (!gl) throw new Error("WebGL2 不被支持");

// 顶点着色器源码
const vsSource = `#version 300 es
precision highp float;
in vec2 aPosition;
in vec3 aColor;
uniform float uTime;
out vec3 vColor;

void main() {
    // 简单的顶点动画：随时间轻微摆动
    float offset = sin(uTime + aPosition.x * 3.0) * 0.05;
    gl_Position = vec4(aPosition.x, aPosition.y + offset, 0.0, 1.0);
    vColor = aColor;
}`;

// 片元着色器源码
const fsSource = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;

void main() {
    fragColor = vec4(vColor, 1.0);
}`;

// 编译着色器
function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`着色器编译失败: ${info}`);
    }
    return shader;
}

// 链接着色器程序
function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
    const vsShader = compileShader(gl, gl.VERTEX_SHADER, vs);
    const fsShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
    const program = gl.createProgram()!;
    gl.attachShader(program, vsShader);
    gl.attachShader(program, fsShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        throw new Error(`程序链接失败: ${info}`);
    }
    gl.deleteShader(vsShader);
    gl.deleteShader(fsShader);
    return program;
}

const program = createProgram(gl, vsSource, fsSource);

// 顶点数据：位置 (x, y) + 颜色 (r, g, b)
const vertices = new Float32Array([
    // 位置         // 颜色
     0.0,  0.5,    1.0, 0.0, 0.0,  // 顶部 - 红色
    -0.5, -0.5,    0.0, 1.0, 0.0,  // 左下 - 绿色
     0.5, -0.5,    0.0, 0.0, 1.0,  // 右下 - 蓝色
]);

// 创建并配置 VAO
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

// 创建 VBO 并上传数据
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// 获取属性位置
const posLoc = gl.getAttribLocation(program, "aPosition");
const colorLoc = gl.getAttribLocation(program, "aColor");

// 配置位置属性：stride=20 (5个float×4字节), offset=0
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 20, 0);

// 配置颜色属性：stride=20, offset=8 (跳过2个float)
gl.enableVertexAttribArray(colorLoc);
gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 20, 8);

gl.bindVertexArray(null); // 解绑 VAO

// 获取 uniform 位置
const timeLoc = gl.getUniformLocation(program, "uTime");

// 渲染循环
function render(time: number): void {
    const seconds = time * 0.001;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.1, 0.1, 0.15, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniform1f(timeLoc, seconds);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3); // 画3个顶点组成一个三角形
    gl.bindVertexArray(null);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
```

## 五、gl.drawArrays 与 gl.drawElements

两者是 WebGL 绘制图元的两个核心方法：

```typescript
// drawArrays：按顺序依次使用顶点
gl.drawArrays(gl.TRIANGLES, 0, 3);
// 参数：图元类型、起始索引、顶点数量

// drawElements：通过索引数组复用顶点
const indices = new Uint16Array([0, 1, 2]);
const ebo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 0);
// 参数：图元类型、索引数量、索引类型、偏移量
```

索引绘制的优势：一个正方形有 4 个顶点，用 `drawArrays` 需要 6 个顶点（两个三角形各 3 个），用 `drawElements` 只需 4 个顶点 + 6 个索引。

## 六、着色器编译与链接流程

```
  GLSL 源码字符串
       │
       ▼
  gl.createShader()     ← 创建着色器对象
       │
  gl.shaderSource()     ← 传入源码
       │
  gl.compileShader()    ← 编译为 GPU 字节码
       │
       ├── 失败 → gl.getShaderInfoLog() 获取错误
       │
  gl.createProgram()    ← 创建程序对象
       │
  gl.attachShader()     ← 附加顶点 + 片元着色器
       │
  gl.linkProgram()      ← 链接为可执行程序
       │
       ├── 失败 → gl.getProgramInfoLog() 获取错误
       │
  gl.useProgram()       ← 激活程序
```

**关键点**：编译失败通常是语法错误，链接失败通常是两个着色器的变量不匹配（比如顶点着色器输出了 `out vec3 vColor`，但片元着色器里写成了 `in vec4 vColor`）。

## 七、WebGL2 与 WebGL1 的区别

本课程使用 WebGL2，相比 WebGL1 有重要改进：

```typescript
// WebGL1：使用 attribute/varying 关键字
// WebGL2：使用 in/out 关键字（GLSL ES 3.0）

// WebGL2 新增特性
gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 100); // 实例化渲染
gl.createVertexArray();                             // 原生 VAO 支持
// 支持 3D 纹理、多重渲染目标（MRT）、统一缓冲对象（UBO）
```

## 常见误区

**1. 认为着色器是 JavaScript 代码**
着色器是运行在 GPU 上的 GLSL 程序，和 JavaScript 运行在不同的处理器上。两者的通信只能通过 `attribute`/`uniform`/`varying` 和纹理。

**2. 忘记调用 gl.useProgram 就设置 uniform**
`gl.uniform*` 设置的是当前激活程序的 uniform 值。如果没先调用 `gl.useProgram(program)`，设置会静默失败。

**3. stride 和 offset 计算错误**
stride 是每个顶点所有属性的总字节数，不是单个属性的。如果位置是 2 个 float、颜色是 3 个 float，stride 就是 `5 * 4 = 20`，颜色的 offset 是 `2 * 4 = 8`。

**4. 以为编译成功着色器就一定正确**
着色器编译只是语法检查，不能保证逻辑正确。颜色算错了、坐标系搞反了，编译照样通过。

## 工程建议

**1. 封装着色器编译工具函数**
在实际项目中，着色器源码通常从文件加载或使用模板字符串。封装一个带错误处理的编译函数是基本功，上面代码中的 `compileShader` 和 `createProgram` 就是标准写法。

**2. 使用 VAO 管理顶点状态**
WebGL1 中 VAO 是可选扩展，WebGL2 中是核心功能。每个网格的顶点布局应该对应一个 VAO，渲染时切换 VAO 比逐个设置属性高效得多。

**3. 优先使用 drawElements 节省显存**
当顶点被多个三角形共享时（如一个立方体只有 8 个顶点），索引绘制能大幅减少数据量。这是 3D 引擎的标配做法。

**4. 着色器代码用模板字符串或外部文件管理**
小型项目可以用 TypeScript 模板字符串，大型项目建议用 `.glsl` 文件配合构建工具加载，便于语法高亮和复用。

## 小结

本课从零搭建了 WebGL2 渲染管线的完整认知：顶点数据经 VBO 上传到 GPU，VAO 记录属性布局，顶点着色器处理每个顶点的位置变换，光栅化阶段将三角形转化为片元，片元着色器计算最终颜色。我们还区分了 `attribute`（逐顶点）、`uniform`（全局）、`varying`（插值传递）三种变量的用途。理解这条管线后，后续所有光照、材质、特效的知识都建立在这个基础之上。

## 练习

**练习 1**：修改三角形示例，改为绘制一个正方形（两个三角形），使用 `drawElements` 和 EBO 进行索引绘制。

**练习 2**：给片元着色器添加一个 `uniform float uAlpha`，通过 JavaScript 动态修改透明度值，实现三角形淡入淡出效果。

**练习 3**：尝试在顶点着色器中加入一个 `uniform mat4 uRotation` 矩阵，用 JavaScript 计算旋转矩阵传入，让三角形绕 Z 轴旋转。

---

## 参考答案

### 练习一

**思路**：正方形由两个三角形组成，需要 4 个顶点和 6 个索引（每个三角形 3 个索引）。使用 EBO 索引绘制可以复用顶点，避免重复定义共享顶点的数据。

**答案**：

```typescript
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;
if (!gl) throw new Error("WebGL2 不被支持");

const vsSource = `#version 300 es
precision highp float;
in vec2 aPosition;
in vec3 aColor;
out vec3 vColor;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vColor = aColor;
}`;

const fsSource = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;

void main() {
    fragColor = vec4(vColor, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`着色器编译失败: ${info}`);
    }
    return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
    const vsShader = compileShader(gl, gl.VERTEX_SHADER, vs);
    const fsShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
    const program = gl.createProgram()!;
    gl.attachShader(program, vsShader);
    gl.attachShader(program, fsShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        throw new Error(`程序链接失败: ${info}`);
    }
    gl.deleteShader(vsShader);
    gl.deleteShader(fsShader);
    return program;
}

const program = createProgram(gl, vsSource, fsSource);

// 4 个顶点：左上、右上、左下、右下
const vertices = new Float32Array([
    // 位置          // 颜色
    -0.5,  0.5,    1.0, 0.0, 0.0,  // 左上 - 红
     0.5,  0.5,    0.0, 1.0, 0.0,  // 右上 - 绿
    -0.5, -0.5,    0.0, 0.0, 1.0,  // 左下 - 蓝
     0.5, -0.5,    1.0, 1.0, 0.0,  // 右下 - 黄
]);

// 索引数据：两个三角形组成正方形
const indices = new Uint16Array([
    0, 1, 2,  // 第一个三角形：左上、右上、左下
    1, 3, 2,  // 第二个三角形：右上、右下、左下
]);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

// 创建 VBO
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// 创建 EBO
const ebo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

const posLoc = gl.getAttribLocation(program, "aPosition");
const colorLoc = gl.getAttribLocation(program, "aColor");

gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 20, 0);

gl.enableVertexAttribArray(colorLoc);
gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 20, 8);

gl.bindVertexArray(null);

// 渲染
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);

gl.useProgram(program);
gl.bindVertexArray(vao);
// 使用 drawElements 进行索引绘制
gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
```

**要点**：
- 正方形需要 4 个顶点而非 6 个，通过 EBO 索引复用共享顶点
- `drawElements` 的第二个参数是索引数量（6），不是顶点数量
- `EBO` 必须在 VAO 绑定状态下绑定，这样 VAO 会记录 EBO 的绑定关系
- 索引数据类型用 `Uint16Array`（最多 65536 个顶点），超大网格用 `Uint32Array`

---

### 练习二

**思路**：在片元着色器中添加 `uniform float uAlpha`，用它替换硬编码的透明度值 1.0。JavaScript 端通过 `getUniformLocation` 获取位置，用 `uniform1f` 传入随时间变化的值实现淡入淡出。

**答案**：

```typescript
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;
if (!gl) throw new Error("WebGL2 不被支持");

const vsSource = `#version 300 es
precision highp float;
in vec2 aPosition;
in vec3 aColor;
out vec3 vColor;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vColor = aColor;
}`;

// 片元着色器：新增 uAlpha uniform
const fsSource = `#version 300 es
precision highp float;
in vec3 vColor;
uniform float uAlpha;
out vec4 fragColor;

void main() {
    fragColor = vec4(vColor, uAlpha);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`着色器编译失败: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
    const vsShader = compileShader(gl, gl.VERTEX_SHADER, vs);
    const fsShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
    const program = gl.createProgram()!;
    gl.attachShader(program, vsShader);
    gl.attachShader(program, fsShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`程序链接失败: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
}

const program = createProgram(gl, vsSource, fsSource);

const vertices = new Float32Array([
     0.0,  0.5,    1.0, 0.0, 0.0,
    -0.5, -0.5,    0.0, 1.0, 0.0,
     0.5, -0.5,    0.0, 0.0, 1.0,
]);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const posLoc = gl.getAttribLocation(program, "aPosition");
const colorLoc = gl.getAttribLocation(program, "aColor");

gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 20, 0);
gl.enableVertexAttribArray(colorLoc);
gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 20, 8);

gl.bindVertexArray(null);

// 获取 uAlpha 的 uniform 位置
const alphaLoc = gl.getUniformLocation(program, "uAlpha");

// 开启混合以支持透明度
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

const startTime = performance.now();

function render(): void {
    requestAnimationFrame(render);

    const elapsed = (performance.now() - startTime) / 1000;
    // 用正弦函数生成 0~1 之间的淡入淡出值
    const alpha = (Math.sin(elapsed * 2.0) + 1.0) / 2.0;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniform1f(alphaLoc, alpha);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

render();
```

**要点**：
- `uniform` 变量在着色器中声明后，JavaScript 端通过 `getUniformLocation` 获取位置
- 必须开启 `gl.BLEND` 并设置混合函数，否则透明度不会生效
- `gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)` 是标准的 Alpha 混合模式
- `uniform1f` 传入单个浮点数，每帧调用即可更新值

---

### 练习三

**思路**：在顶点着色器中添加 `uniform mat4 uRotation`，用 JavaScript 构建绕 Z 轴旋转的 4×4 矩阵，每帧更新角度并传入着色器。旋转矩阵的公式基于三角函数构建。

**答案**：

```typescript
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const gl = canvas.getContext("webgl2")!;
if (!gl) throw new Error("WebGL2 不被支持");

// 顶点着色器：用 uRotation 矩阵变换顶点位置
const vsSource = `#version 300 es
precision highp float;
in vec2 aPosition;
in vec3 aColor;
uniform mat4 uRotation;
out vec3 vColor;

void main() {
    gl_Position = uRotation * vec4(aPosition, 0.0, 1.0);
    vColor = aColor;
}`;

const fsSource = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;

void main() {
    fragColor = vec4(vColor, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`着色器编译失败: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
    const vsShader = compileShader(gl, gl.VERTEX_SHADER, vs);
    const fsShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
    const program = gl.createProgram()!;
    gl.attachShader(program, vsShader);
    gl.attachShader(program, fsShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`程序链接失败: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
}

const program = createProgram(gl, vsSource, fsSource);

const vertices = new Float32Array([
     0.0,  0.5,    1.0, 0.0, 0.0,
    -0.5, -0.5,    0.0, 1.0, 0.0,
     0.5, -0.5,    0.0, 0.0, 1.0,
]);

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const posLoc = gl.getAttribLocation(program, "aPosition");
const colorLoc = gl.getAttribLocation(program, "aColor");

gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 20, 0);
gl.enableVertexAttribArray(colorLoc);
gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 20, 8);

gl.bindVertexArray(null);

const rotationLoc = gl.getUniformLocation(program, "uRotation");

// 构建绕 Z 轴旋转的 4x4 矩阵
function buildRotationZ(angle: number): Float32Array {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // WebGL 使用列主序存储
    return new Float32Array([
         c,  s, 0, 0,
        -s,  c, 0, 0,
         0,  0, 1, 0,
         0,  0, 0, 1,
    ]);
}

const startTime = performance.now();

function render(): void {
    requestAnimationFrame(render);

    const elapsed = (performance.now() - startTime) / 1000;
    const angle = elapsed * 1.0; // 每秒旋转 1 弧度

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniformMatrix4fv(rotationLoc, false, buildRotationZ(angle));

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}

render();
```

**要点**：
- `uniformMatrix4fv` 的第二个参数 `false` 表示不转置（WebGL 要求列主序，与 OpenGL 一致）
- 绕 Z 轴旋转矩阵中，Z 和 W 分量不变，只有 X 和 Y 根据角度做三角函数变换
- 矩阵是列主序存储：`[cos, sin, 0, 0, -sin, cos, 0, 0, ...]`，第一列是 `[cos, sin, 0, 0]`
- 实际项目中推荐使用 gl-matrix 库的 `mat4.rotateZ()` 避免手算矩阵出错
