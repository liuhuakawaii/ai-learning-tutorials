# GLSL 基础语法

## 场景引入

当你第一次打开 Shader 代码，看到 `varying vec3 vNormal;` 这样的声明时，可能会疑惑：这和普通的 C 语言有什么区别？为什么要单独学一门语言来写图形程序？答案在于 GPU 的硬件架构——它拥有数千个并行计算核心，但每个核心的指令集非常精简。GLSL 正是为这种硬件量身定制的语言，它剥离了指针、动态内存等复杂特性，加入了向量、矩阵等图形专用操作。掌握 GLSL 语法，是进入 Shader 编程世界的第一步。

## 学习目标

1. 理解 GLSL 的基本数据类型及其与 GPU 硬件的对应关系
2. 掌握向量和矩阵的操作方式，包括 swizzle 语法
3. 熟练使用常用内建函数进行数学运算
4. 理解精度限定符的作用和适用场景
5. 能够编写符合工程规范的 GLSL 代码

---

## 一、GLSL 的数据类型体系

GLSL 的类型系统围绕 GPU 硬件设计，核心思想是：**一个指令同时处理多个数据**。这与 CPU 编程中逐元素操作的习惯截然不同。

### 1.1 标量类型

```glsl
float a = 1.0;        // 32位浮点数，GPU 最核心的数据类型
int   b = 42;         // 整数，部分 GPU 不原生支持，需转换为 float
bool  c = true;       // 布尔值，通常用于条件分支
```

**关键细节**：GLSL 要求浮点数必须带小数点。`float a = 1;` 在某些驱动上会报错，必须写成 `float a = 1.0;`。

### 1.2 向量类型

向量是 GLSL 最常用的数据类型，GPU 硬件原生支持 2/3/4 分量的向量运算：

```glsl
vec2  uv = vec2(0.5, 0.5);           // 2D 向量，常用于纹理坐标
vec3  pos = vec3(1.0, 2.0, 3.0);     // 3D 向量，用于位置、法线、颜色
vec4  color = vec4(1.0, 0.0, 0.0, 1.0); // 4D 向量，带透明度的颜色

ivec2 size = ivec2(256, 256);        // 整数向量
bvec3 mask = bvec3(true, false, true); // 布尔向量
```

向量的构造方式非常灵活：

```glsl
vec3 a = vec3(1.0, 2.0, 3.0);       // 逐分量赋值
vec3 b = vec3(1.0);                  // 所有分量设为 1.0 → (1.0, 1.0, 1.0)
vec3 c = vec3(vec2(1.0, 2.0), 3.0); // 混合构造
vec3 d = vec3(1.0, vec2(2.0, 3.0)); // 同上
```

### 1.3 矩阵类型

```glsl
mat2 m2 = mat2(1.0, 0.0,            // 2x2 矩阵
               0.0, 1.0);

mat3 m3 = mat3(1.0);                 // 3x3 单位矩阵

mat4 m4 = mat4(1.0);                 // 4x4 单位矩阵，MVP 变换的核心
```

**内存布局**：GLSL 默认使用**列主序**存储。`mat4 m` 中，`m[0]` 是第一列而非第一行。这与数学教材中的行主序习惯相反。

```
mat4 的内存布局（列主序）：

    m[0]    m[1]    m[2]    m[3]
    ↓       ↓       ↓       ↓
┌───────┬───────┬───────┬───────┐
│ m00   │ m10   │ m20   │ m30   │  ← 第一行（索引 [0][0], [1][0], [2][0], [3][0]）
│ m01   │ m11   │ m21   │ m31   │
│ m02   │ m12   │ m22   │ m32   │
│ m03   │ m13   │ m23   │ m33   │
└───────┴───────┴───────┴───────┘

注意：m[0] 是第一列 = (m00, m01, m02, m03)
```

### 1.4 采样器类型

采样器是 GLSL 与纹理交互的桥梁，类型必须与纹理格式匹配：

```glsl
uniform sampler2D uDiffuseMap;       // 2D 纹理
uniform samplerCube uEnvMap;         // 立方体纹理（环境贴图）
uniform sampler3D uVolumeTex;        // 3D 纹理（体积数据）
uniform sampler2DShadow uShadowMap;  // 深度纹理（阴影贴图）

// 使用示例
vec4 texColor = texture2D(uDiffuseMap, vUv);
vec3 envColor = textureCube(uEnvMap, reflectDir).rgb;
```

---

## 二、Swizzle 操作

Swizzle 是 GLSL 最具特色的语法糖，允许用 `.xyzw`、`.rgba`、`.stpq` 访问向量分量：

```glsl
vec4 color = vec4(1.0, 0.5, 0.2, 1.0);

// 三种等价的访问方式
float r = color.r;      // = color.x = color.s = 1.0
float g = color.g;      // = color.y = color.t = 0.5
float b = color.b;      // = color.z = color.p = 0.2
float a = color.a;      // = color.w = color.q = 1.0

// Swizzle 重排：可以任意组合
vec3 rgb = color.rgb;   // 取前三个分量
vec3 bgr = color.bgr;   // 反转顺序
vec2 rg  = color.rg;    // 取前两个分量
vec4 rrrr = color.rrrr; // 重复分量，结果为 (1.0, 1.0, 1.0, 1.0)

// 实际应用：颜色空间转换中的通道重排
vec3 linearToSRGB(vec3 linear) {
    return pow(linear, vec3(1.0 / 2.2));
}
```

**三种命名风格**：

```
访问风格      适用场景           示例
─────────────────────────────────────────
.xyzw        位置、方向         pos.xyz, dir.xyw
.rgba        颜色              color.rgb, color.a
.stpq        纹理坐标          uv.st, uv.pq
```

> **注意**：三种风格不能混用。`color.rx` 是非法的。

---

## 三、内建函数

GLSL 提供了大量硬件加速的内建函数，这些函数在 GPU 上是单周期或近似单周期操作。

### 3.1 数学函数

```glsl
// 三角函数
float s = sin(angle);           // 正弦，angle 单位为弧度
float c = cos(angle);           // 余弦
float t = tan(angle);           // 正切
float a = asin(value);          // 反正弦
float r = radians(90.0);       // 角度转弧度 → π/2
float d = degrees(3.14159);    // 弧度转角度 → 180.0

// 指数与对数
float p = pow(2.0, 3.0);       // 2^3 = 8.0
float e = exp(1.0);            // e^1 = 2.718...
float l = log(2.718);          // 自然对数
float s = sqrt(4.0);           // 平方根 = 2.0
float i = inversesqrt(4.0);    // 1/sqrt(4) = 0.5
```

### 3.2 插值与平滑函数

这是 Shader 中最常用的函数族，用于实现平滑过渡：

```glsl
// mix: 线性插值，t ∈ [0, 1]
vec3 colorA = vec3(1.0, 0.0, 0.0);  // 红色
vec3 colorB = vec3(0.0, 0.0, 1.0);  // 蓝色
vec3 blended = mix(colorA, colorB, 0.5); // 紫色

// smoothstep: Hermite 插值，边缘柔和
float edge = smoothstep(0.4, 0.6, uv.x);
// uv.x < 0.4 → 0.0
// uv.x > 0.6 → 1.0
// 0.4~0.6 之间 → 平滑过渡

/*
smoothstep 的 S 曲线：

1.0 │                    ●●●●●●
    │                ●●●●
    │            ●●●●
    │        ●●●●
    │    ●●●●
0.0 │●●●●
    └────────────────────────────
    0.0    0.4    0.6    1.0
*/

// step: 阶跃函数，硬边界
float mask = step(0.5, uv.x);  // uv.x < 0.5 → 0.0, >= 0.5 → 1.0

// clamp: 限制范围
float clamped = clamp(value, 0.0, 1.0);  // 等价于 min(max(value, 0.0), 1.0)

// fract: 取小数部分，常用于重复图案
float repeated = fract(uv.x * 10.0);  // 将 [0,1] 映射为 10 个重复周期

// mod: 取模运算
float modResult = mod(5.3, 2.0);  // 1.3
```

### 3.3 向量运算函数

```glsl
vec3 a = vec3(1.0, 2.0, 3.0);
vec3 b = vec3(4.0, 5.0, 6.0);

float len = length(a);           // 向量长度 = sqrt(1+4+9) ≈ 3.74
vec3 n = normalize(a);           // 归一化 → 单位向量
float d = distance(a, b);       // 两点距离
float dp = dot(a, b);           // 点积 = 1*4 + 2*5 + 3*6 = 32
vec3 cp = cross(a, b);          // 叉积 → 垂直于 a 和 b 的向量

// reflect: 反射向量
vec3 incident = normalize(vec3(1.0, -1.0, 0.0));
vec3 normal = vec3(0.0, 1.0, 0.0);
vec3 reflected = reflect(incident, normal);

// refract: 折射向量
float eta = 1.0 / 1.5;  // 空气到玻璃的折射率比
vec3 refracted = refract(incident, normal, eta);
```

### 3.4 纹理采样函数

```glsl
// 2D 纹理采样
vec4 texColor = texture2D(uTexture, vUv);

// 带 LOD（细节层级）的采样
vec4 texLOD = texture2DLod(uTexture, vUv, 2.0);

// 偏导数采样（自动计算 mipmap 层级）
vec4 texGrad = texture2DGrad(uTexture, vUv, dFdx(vUv), dFdy(vUv));

// 立方体纹理采样
vec3 envColor = textureCube(uEnvMap, reflectDir).rgb;
```

---

## 四、精度限定符

精度限定符是 GLSL 针对移动 GPU 的优化手段，直接影响变量的存储空间和计算精度：

```glsl
highp   vec4 position;    // 高精度：32位浮点，用于位置、变换矩阵
mediump vec3 normal;      // 中精度：16位浮点，用于法线、颜色
lowp    vec4 color;       // 低精度：8位或10位，用于颜色、布尔标志
```

### 精度对照表

```
限定符      浮点范围              精度         适用场景
──────────────────────────────────────────────────────
highp      ±2^62, 最小 2^-16    2^-16        位置、UV 坐标、矩阵
mediump    ±2^14, 最小 2^-10    2^-10        法线、颜色、方向向量
lowp       ±2, 最小 2^-8       2^-8         颜色分量、布尔标志
```

### 默认精度声明

在片元着色器中，`float` 没有默认精度，必须手动声明：

```glsl
// 片元着色器头部必须声明默认精度
precision mediump float;

// 之后的 float 变量默认为 mediump
vec3 normal = vNormal;       // mediump
highp vec2 uv = vUv;        // 显式指定为 highp
```

**工程建议**：

- 顶点着色器默认 `highp`，通常不需要修改
- 片元着色器默认声明 `precision mediump float;`
- UV 坐标和位置计算使用 `highp`，避免纹理闪烁
- 颜色相关计算使用 `mediump` 或 `lowp` 即可

---

## 五、类型转换与隐式转换规则

GLSL **不支持隐式类型转换**，这是与 C 语言最大的区别之一：

```glsl
float a = 1.0;
int b = 2;

// 错误！int 不能隐式转为 float
// float c = a + b;

// 正确做法：显式转换
float c = a + float(b);    // 3.0
int d = int(a) + b;        // 3

// 向量与标量的运算：标量自动扩展为同维度向量
vec3 color = vec3(1.0, 0.5, 0.2);
vec3 brighter = color + 0.3;        // 等价于 color + vec3(0.3)
vec3 scaled = color * 2.0;          // 等价于 color * vec3(2.0)

// 向量间的运算：逐分量计算
vec3 a = vec3(1.0, 2.0, 3.0);
vec3 b = vec3(4.0, 5.0, 6.0);
vec3 c = a * b;  // (4.0, 10.0, 18.0)，不是点积！
```

**常见陷阱**：

```glsl
// 陷阱 1：整数除法
float result = 1.0 / 2;   // 错误：int 字面量
float result = 1.0 / 2.0; // 正确：0.5

// 陷阱 2：赋值类型不匹配
vec3 color = vec3(1.0);
float brightness = color;  // 错误：不能将 vec3 赋给 float
float brightness = color.r; // 正确

// 陷阱 3：比较运算的精度问题
float a = 0.1 + 0.2;
if (a == 0.3) { }          // 可能不成立！
if (abs(a - 0.3) < 0.001) { } // 正确做法
```

---

## 六、控制流与函数

### 6.1 条件语句

```glsl
// if-else 与 CPU 代码基本一致
if (brightness > 0.5) {
    color = vec3(1.0);
} else {
    color = vec3(0.0);
}

// 三元运算符（推荐用于简单条件）
vec3 finalColor = useTexture ? texColor : vec3(1.0);

// step 实现无分支条件（性能更好）
float mask = step(0.5, brightness);
vec3 finalColor = mix(vec3(0.0), vec3(1.0), mask);
```

### 6.2 循环

```glsl
// for 循环：循环次数必须是编译时常量
for (int i = 0; i < 10; i++) {
    sum += texture2D(uTexture, uv + float(i) * offset).rgb;
}

// while 循环（较少使用）
int i = 0;
while (i < 10) {
    sum += data[i];
    i++;
}
```

### 6.3 自定义函数

```glsl
// 前向声明（可选）
vec3 linearToSRGB(vec3 linear);

// 函数定义
vec3 linearToSRGB(vec3 linear) {
    return pow(linear, vec3(1.0 / 2.2));
}

// in/out/inout 参数修饰符
void swap(inout float a, inout float b) {
    float temp = a;
    a = b;
    b = temp;
}
```

---

## 常见误区

1. **整数字面量陷阱**：`float a = 1;` 在某些驱动上会报错。所有浮点数字面量必须带小数点：`float a = 1.0;`

2. **向量乘法不是点积**：`vec3 * vec3` 是逐分量相乘，不是点积。要计算点积必须显式调用 `dot(a, b)`。

3. **精度限定符不是可选的**：在移动端，不声明精度会导致编译失败。即使在桌面端，也建议显式声明以养成好习惯。

4. **mat4 索引是列不是行**：`mat4 m; m[0]` 取的是第一列，不是第一行。构造旋转矩阵时要特别注意。

---

## 工程建议

1. **统一精度策略**：在整个项目的公共头文件中声明默认精度，避免每个 Shader 重复编写。位置和 UV 用 `highp`，颜色和法线用 `mediump`。

2. **善用 swizzle 简化代码**：`color.rgb = mix(colorA, colorB, t);` 比逐分量赋值更清晰高效。

3. **优先使用内建函数**：`smoothstep`、`mix`、`clamp` 等函数在 GPU 上有硬件加速，比手写等价逻辑更快。

4. **避免动态分支**：GPU 的执行模型是 warp/wavefront 级别的 SIMD，分支会导致部分线程空转。可以用 `step`、`mix` 等函数替代简单条件判断。

---

## 小结

本课介绍了 GLSL 的核心语法要素：数据类型体系（标量、向量、矩阵、采样器）、swizzle 操作、常用内建函数、精度限定符、类型转换规则和控制流。这些是编写任何 Shader 的基础。理解 GLSL 与 CPU 语言的本质差异——面向并行计算的设计、硬件友好的类型系统、无隐式转换的严格类型——是写出高效 Shader 代码的前提。

## 练习

1. 编写一个 GLSL 函数，将 RGB 颜色转换为 HSV 颜色空间，再转换回来。要求使用 swizzle 操作简化代码。

2. 实现一个 `palette` 函数，输入 `t ∈ [0, 1]`，返回一个平滑过渡的彩虹色。提示：使用 `mix` 和多个颜色锚点。

3. 用 `step` 和 `smoothstep` 实现一个圆形遮罩：给定中心点和半径，返回平滑边缘的圆形区域。对比两种方式的视觉差异。

4. 编写一个函数，将 `mat4` 的第 N 列提取为 `vec4`，并解释为什么 `m[0]` 取到的是列向量而不是行向量。

---

## 参考答案

### 练习一

**思路**：RGB 转 HSV 的核心是找出最大分量和最小分量的差（delta），然后根据哪个分量最大来计算色相。HSV 转 RGB 则是通过色相区间确定基础颜色，再用饱和度和明度混合。swizzle 操作可以简化分量访问。

**答案**：
```glsl
// RGB → HSV
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    // 用 swizzle 比较分量，step 代替 if-else
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// HSV → RGB
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    // abs(fract(...) * 6.0 - K.www) 构造出一个从 0→1→1→0 的三角波
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec3 color = vec3(1.0, 0.0, 0.0);
    vec3 hsv = rgb2hsv(color);
    vec3 rgb = hsv2rgb(hsv);
    gl_FragColor = vec4(rgb, 1.0);
}
```

**要点**：
- 使用 `step` 和 `mix` 替代 `if-else`，避免 GPU 上的分支开销
- 加入 `1.0e-10` 的 epsilon 防止除以零
- swizzle（如 `c.bg`、`p.yzx`）让分量重排代码更紧凑

---

### 练习二

**思路**：彩虹色对应 HSV 中色相从 0 到 1 的遍历。可以定义 3-4 个颜色锚点，用 `mix` 在它们之间根据 `t` 进行插值。关键是要用 `smoothstep` 或分段 `mix` 让过渡平滑。

**答案**：
```glsl
// 方案一：基于 HSV 的彩虹色（推荐）
vec3 palette(float t) {
    return hsv2rgb(vec3(t, 0.8, 1.0));
}

// 方案二：使用 mix 和颜色锚点的彩虹色
vec3 paletteWithAnchors(float t) {
    vec3 red    = vec3(1.0, 0.0, 0.0);
    vec3 yellow = vec3(1.0, 1.0, 0.0);
    vec3 green  = vec3(0.0, 1.0, 0.0);
    vec3 cyan   = vec3(0.0, 1.0, 1.0);
    vec3 blue   = vec3(0.0, 0.0, 1.0);

    float segment = t * 4.0;
    if (segment < 1.0) return mix(red, yellow, segment);
    if (segment < 2.0) return mix(yellow, green, segment - 1.0);
    if (segment < 3.0) return mix(green, cyan, segment - 2.0);
    return mix(cyan, blue, segment - 3.0);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec3 color = palette(uv.x);
    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- 方案一更简洁高效，直接利用 HSV 色相环
- 方案二更灵活，可以自定义任意颜色锚点和过渡方式
- 锚点间距相同时，`t * 4.0` 将 [0,1] 映射到 4 个区间

---

### 练习三

**思路**：圆形遮罩的核心是计算片元到圆心的距离，然后与半径比较。`step` 产生硬边缘，`smoothstep` 产生柔和过渡。对比两者可以清晰看到抗锯齿的重要性。

**答案**：
```glsl
precision mediump float;

uniform vec2 uCenter;     // 圆心坐标（像素坐标系）
uniform float uRadius;    // 半径（像素单位）
uniform vec2 uResolution;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 center = uCenter / uResolution;

    float dist = length(uv - center);

    // 方式一：step 硬边缘
    // float mask = step(dist, uRadius / uResolution.x);

    // 方式二：smoothstep 柔和边缘（推荐）
    float edgeWidth = 0.005;  // 边缘过渡宽度
    float mask = smoothstep(uRadius / uResolution.x + edgeWidth,
                            uRadius / uResolution.x - edgeWidth,
                            dist);

    vec3 color = vec3(1.0, 0.4, 0.2) * mask;
    gl_FragColor = vec4(color, mask);
}
```

**要点**：
- `smoothstep(edge0, edge1, x)` 中 edge0 > edge1 时产生反向映射，用于"内部为 1、外部为 0"
- `edgeWidth` 控制边缘柔和程度，值越大过渡越宽，锯齿越不明显
- 实际项目中几乎总是用 `smoothstep`，因为 `step` 在非轴对齐边缘会产生明显锯齿

---

### 练习四

**思路**：GLSL 使用列主序存储，`m[i]` 直接返回第 i 列的 `vec4`。因此提取第 N 列只需 `m[N]`。但很多人误以为 `m[0]` 取的是行向量，需要从内存布局角度解释。

**答案**：
```glsl
// 提取 mat4 的第 N 列
vec4 getColumn(mat4 m, int n) {
    // GLSL 的 mat4 本质上是 4 个 vec4，m[0]~m[3] 就是 4 个列向量
    if (n == 0) return m[0];
    if (n == 1) return m[1];
    if (n == 2) return m[2];
    if (n == 3) return m[3];
    return vec4(0.0);
}

// 实际使用中，直接用 m[n] 即可
void main() {
    mat4 m = mat4(
        1.0, 2.0, 3.0, 4.0,    // 第 0 列
        5.0, 6.0, 7.0, 8.0,    // 第 1 列
        9.0, 10.0, 11.0, 12.0, // 第 2 列
        13.0, 14.0, 15.0, 16.0 // 第 3 列
    );

    vec4 col0 = m[0];  // (1.0, 2.0, 3.0, 4.0)
    vec4 col1 = m[1];  // (5.0, 6.0, 7.0, 8.0)

    // 也可以用双索引访问单个元素：m[列][行]
    float element = m[1][2];  // 第 1 列第 2 行 = 7.0
}
```

**要点**：
- GLSL 的 `mat4 m` 在内存中按列主序排列，`m[0]` 是第一列 `(m00, m01, m02, m03)`
- 这与 C/C++ 的二维数组 `m[0]` 取第一行的习惯相反
- 双索引 `m[col][row]` 访问单个元素，先列后行
- 这个设计与 OpenGL 的 `glUniformMatrix4fv` 的 `transpose` 参数相关：GL 默认列主序，传 `false` 即可
