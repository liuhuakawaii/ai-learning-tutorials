# WebGL 基础渲染管线：GPU 是怎么画三角形的

## 现象

你用 Three.js 画了一个立方体，几行代码就搞定了。但你知道这背后发生了什么吗？GPU 是怎么把一堆顶点坐标变成屏幕上的像素的？

理解渲染管线，是写 Shader 的前提。

## 渲染管线

```
顶点数据（位置、颜色、UV）
    │
    ▼
顶点着色器（Vertex Shader）
  每个顶点执行一次
  负责坐标变换
    │
    ▼
图元装配
  把顶点组装成三角形
    │
    ▼
光栅化
  确定三角形覆盖哪些像素
    │
    ▼
片元着色器（Fragment Shader）
  每个像素执行一次
  负责计算颜色
    │
    ▼
深度测试 + 模板测试 + 混合
    │
    ▼
帧缓冲（屏幕）
```

## 第一个 WebGL 三角形

```javascript
const canvas = document.getElementById('canvas')
const gl = canvas.getContext('webgl2')

// 顶点着色器
const vertexShaderSource = `#version 300 es
  in vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

// 片元着色器
const fragmentShaderSource = `#version 300 es
  precision mediump float;
  out vec4 fragColor;
  void main() {
    fragColor = vec4(1.0, 0.5, 0.2, 1.0); // 橙色
  }
`

// 编译着色器
function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

// 创建程序
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
const program = gl.createProgram()
gl.attachShader(program, vertexShader)
gl.attachShader(program, fragmentShader)
gl.linkProgram(program)
gl.useProgram(program)

// 顶点数据
const positions = new Float32Array([
  0, 0.5,
  -0.5, -0.5,
  0.5, -0.5
])

const buffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

// 设置属性
const posLoc = gl.getAttribLocation(program, 'a_position')
gl.enableVertexAttribArray(posLoc)
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

// 绘制
gl.viewport(0, 0, canvas.width, canvas.height)
gl.clearColor(0, 0, 0, 1)
gl.clear(gl.COLOR_BUFFER_BIT)
gl.drawArrays(gl.TRIANGLES, 0, 3)
```

## 着色器语言 GLSL

```glsl
// 数据类型
float a = 1.0;
vec2 b = vec2(1.0, 2.0);
vec3 c = vec3(1.0, 2.0, 3.0);
vec4 d = vec4(1.0, 2.0, 3.0, 4.0);
mat4 e = mat4(1.0); // 4x4 单位矩阵

// 内置变量
gl_Position  // 顶点着色器输出：裁剪空间坐标
gl_FragCoord // 片元着色器输入：屏幕坐标
gl_PointSize // 点的大小

// 内置函数
float sin(float)
float cos(float)
float length(vec3)
vec3 normalize(vec3)
float dot(vec3, vec3)
vec3 cross(vec3, vec3)
float clamp(float, float, float)
float mix(float, float, float) // 线性插值
```

## Uniform 和 Attribute

```
Attribute：每个顶点不同的数据（位置、颜色、UV）
  → 通过 VBO 传递

Uniform：所有顶点/像素共享的数据（变换矩阵、光照位置）
  → 通过 gl.uniform* 传递
```

```javascript
// 设置 uniform
const matrixLoc = gl.getUniformLocation(program, 'u_matrix')
gl.uniformMatrix4fv(matrixLoc, false, matrix)

// 设置 attribute
const posLoc = gl.getAttribLocation(program, 'a_position')
gl.enableVertexAttribArray(posLoc)
gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0)
```

## 你可能踩的坑

**坑一：着色器编译失败不报错**

`gl.getShaderParameter(shader, gl.COMPILE_STATUS)` 必须检查。编译错误在控制台不明显。

**坑二：attribute 位置不对**

`gl.getAttribLocation` 返回 -1 表示未找到。可能是变量名拼错或被优化掉了。

**坑三：uniform 类型不匹配**

`gl.uniformMatrix4fv` 传了 `vec4` 的 location，不会报错但结果错误。

## 练习

### 练习一：彩色三角形

修改着色器，让三角形三个顶点分别是红、绿、蓝，中间部分自动插值。

### 练习二：旋转动画

用 `requestAnimationFrame` 和 uniform 矩阵实现三角形旋转。

---

## 参考答案

### 练习一

```glsl
// 顶点着色器
in vec2 a_position;
in vec3 a_color;
out vec3 v_color;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_color = a_color;
}

// 片元着色器
precision mediump float;
in vec3 v_color;
out vec4 fragColor;
void main() {
  fragColor = vec4(v_color, 1.0);
}
```

### 练习二

```javascript
let angle = 0
function frame() {
  angle += 0.01
  const c = Math.cos(angle), s = Math.sin(angle)
  const matrix = new Float32Array([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ])
  gl.uniformMatrix4fv(matrixLoc, false, matrix)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  requestAnimationFrame(frame)
}
frame()
```
