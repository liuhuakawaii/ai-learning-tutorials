# 第 1 课：GLSL 基础与坐标系统

写 Shader 的第一步不是画东西，而是搞清楚你在哪。

Fragment Shader 逐像素执行。每个像素拿到一个归一化的坐标（通常叫 `gl_FragCoord`），Shader 要做的就是算出这个像素该是什么颜色。整个过程就像一台复印机：你给它一个规则，它对每个像素执行同一个规则。

## 运行环境

本课程所有代码都可以直接粘贴到 [Shadertoy](https://www.shadertoy.com/new) 中运行。Shadertoy 自动提供以下内置 uniform：

- `iResolution`：画布尺寸，`vec3(width, height, 1.0)`
- `iTime`：运行时间（秒），`float`
- `iMouse`：鼠标位置，`vec4(x, y, 按下时x, 按下时y)`

你不需要声明它们，直接用就行。

## 坐标系

Shadertoy 的 `gl_FragCoord.xy` 原点在左下角，单位是像素。但做 Shader 时几乎没人直接用像素坐标，原因很简单：不同分辨率下结果不一样。

第一步：把坐标归一化到 `[0, 1]`：

```glsl
vec2 uv = gl_FragCoord.xy / iResolution.xy;
```

但归一化坐标有个问题——x 和 y 的范围一样是 `[0, 1]`，但画布通常不是正方形。这意味着 `(1.0, 1.0)` 不在画面中心，画出来的圆会变成椭圆。

第二步：修正宽高比，让坐标中心在画面正中间：

```glsl
vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
```

这段代码做了三件事：
1. `gl_FragCoord.xy - 0.5 * iResolution.xy`：把原点移到画面中心，坐标范围变成 `[-w/2, w/2] × [-h/2, h/2]`
2. 除以 `iResolution.y`：让 y 的范围变成 `[-0.5, 0.5]`，x 的范围取决于宽高比
3. 结果：屏幕短边长度恒为 1.0，长边由宽高比决定

这是 Shader 里最常用的坐标变换。后面所有课程都基于这个坐标系。

## 第一个 Shader：画一个色块

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 col = vec3(0.0);

    // 画面左侧 1/3 区域涂红
    if (uv.x < -0.2) {
        col = vec3(1.0, 0.0, 0.0);
    }

    fragColor = vec4(col, 1.0);
}
```

运行后你会看到：画面左侧红色，其余黑色。

`vec3(0.0)` 等价于 `vec3(0.0, 0.0, 0.0)`，是 GLSL 的构造函数简写。`vec3(1.0, 0.0, 0.0)` 是红色。

## 用 mix 做渐变

`if` 在 Shader 里不是常用手段。Shader 更习惯用数学函数做平滑过渡。`mix(a, b, t)` 在 a 和 b 之间按 t 做线性插值：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // uv.x 范围约 [-0.5, 0.5]（取决于宽高比）
    // clamp 到 [0, 1] 作为混合因子
    float t = clamp(uv.x + 0.5, 0.0, 1.0);

    vec3 leftColor = vec3(0.1, 0.2, 0.8);   // 蓝
    vec3 rightColor = vec3(0.9, 0.3, 0.2);  // 橘红

    vec3 col = mix(leftColor, rightColor, t);

    fragColor = vec4(col, 1.0);
}
```

`clamp(x, min, max)` 把 x 限制在 `[min, max]` 范围内。超出范围的部分会被"截断"到边界值。

## smoothstep：平滑阶梯

`smoothstep(edge0, edge1, x)` 产生一个 S 形曲线：当 `x ≤ edge0` 时返回 0，当 `x ≥ edge1` 时返回 1，中间部分是平滑过渡。

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float edge = smoothstep(-0.01, 0.01, uv.x);

    vec3 col = mix(vec3(0.1, 0.1, 0.3), vec3(0.9, 0.8, 0.6), edge);

    fragColor = vec4(col, 1.0);
}
```

过渡区间只有 0.02（从 -0.01 到 0.01），所以看起来几乎是一条锐利的分界线，但边缘有 2 个像素左右的抗锯齿。这就是 Shader 画形状的基本手法：用数学函数定义边界，用 `smoothstep` 产生平滑边缘。

## 颜色输出

`fragColor` 是 `vec4`，四个分量分别是 R、G、B、A（透明度）。Shadertoy 忽略 Alpha，直接输出 `1.0` 就行。

颜色值范围 `[0, 1]`。超过 1.0 的值会被截断到 1.0（clamp）。这意味着你可以先算再 clamp，不用担心溢出：

```glsl
vec3 col = vec3(uv.x * 3.0); // 可能超过 1.0
col = clamp(col, 0.0, 1.0);  // 安全输出
```

## 几个值得注意的事

- **没有变量声明的关键字限制**：`float`、`int`、`vec2`、`vec3`、`vec4`、`mat2`、`mat3`、`mat4`、`sampler2D` 是常用的。
- **函数必须声明在调用之前**（或提前声明原型）。`mainImage` 是 Shadertoy 的入口，普通 GLSL 程序用 `main()`。
- **精度声明**：Three.js 需要在 shader 开头加 `precision mediump float;`。Shadertoy 自动处理了。
- **所有浮点数都写小数点**：`0` 要写成 `0.0`，`1` 要写成 `1.0`。某些驱动对整数和浮点的隐式转换不友好。

## 练习

1. 修改渐变代码，让渐变方向从上到下（而不是从左到右）。
2. 用 `smoothstep` 画一个竖直的条纹：中间亮、两边暗，条纹宽度约为画面宽度的 1/5。
3. 尝试用 `sin(uv.x * 10.0)` 作为 `mix` 的因子，观察结果。思考为什么会变成多条条纹。

## 参考答案

### 练习 1

把 `uv.x` 换成 `uv.y`：

```glsl
float t = clamp(uv.y + 0.5, 0.0, 1.0);
vec3 col = mix(vec3(0.1, 0.2, 0.8), vec3(0.9, 0.3, 0.2), t);
```

### 练习 2

```glsl
float stripe = smoothstep(0.0, 0.02, abs(uv.x) - 0.1);
vec3 col = mix(vec3(1.0), vec3(0.0), stripe);
```

`abs(uv.x) - 0.1` 在 `|x| < 0.1` 时为负，`smoothstep` 把它变成 0（亮）；`|x| > 0.12` 时变成 1（暗）。过渡区间 0.02 产生柔边。

### 练习 3

`sin(uv.x * 10.0)` 在 `[-1, 1]` 之间振荡，随着 x 变化穿过零点多次。每次过零，`mix` 的因子从小于 0.5 跳到大于 0.5，产生明暗交替。乘以 10 意味着一个屏幕宽度内大约有 `10 / (2π) ≈ 1.6` 个完整周期，所以你会看到大约 3 条亮带。
