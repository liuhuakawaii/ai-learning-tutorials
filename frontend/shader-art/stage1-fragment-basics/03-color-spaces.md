# 第 3 课：颜色空间与调色板设计

Shader 默认用 RGB 表示颜色，但 RGB 不是人脑理解颜色的方式。你想"偏暖一点""饱和度低一些"，用 RGB 很难直接操作。这节课解决的是：如何用直觉控制颜色，以及如何设计好看的调色板。

## HSV 颜色空间

HSV 代表色相（Hue）、饱和度（Saturation）、明度（Value）。它的优势是把"颜色是什么"和"颜色有多亮"分开了。

- H：0~360 度，表示色相环上的位置（红 → 橙 → 黄 → 绿 → 青 → 蓝 → 紫 → 红）
- S：0~1，0 是灰色，1 是纯色
- V：0~1，0 是黑色，1 是最亮

Shadertoy 没有内置 HSV 转换函数，需要自己写：

```glsl
vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
```

这个公式基于色相环上的三个 120 度扇区，通过 `fract` 循环、`abs` 镜像和 `clamp` 截断来拼出六段颜色过渡。不需要理解每一行的推导——记住它能用就行。

## 用 HSV 画色相环

```glsl
vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float angle = atan(uv.y, uv.x); // [-π, π]
    float hue = angle / 6.28318 + 0.5; // 归一化到 [0, 1]
    float dist = length(uv);

    // 外环：色相随角度变化
    float ring = smoothstep(0.35, 0.34, dist) - smoothstep(0.25, 0.24, dist);
    vec3 col = hsv2rgb(vec3(hue, 1.0, 1.0)) * ring;

    // 中心：灰度
    float center = smoothstep(0.15, 0.14, dist);
    col += vec3(0.5) * center;

    fragColor = vec4(col, 1.0);
}
```

`atan(y, x)` 返回点的角度，范围 `[-π, π]`。加 `0.5` 再除以 `2π` 把它映射到 `[0, 1]` 作为色相值。

## 调色板公式

Inigo Quilez 提出了一个优雅的调色板公式：`a + b * cos(2π * (c*t + d))`。

四个参数控制颜色的四个维度：
- `a`：亮度中心
- `b`：颜色振幅（对比度）
- `c`：色相偏移速率
- `d`：初始色相

```glsl
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 一组经典调色板参数
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.0, 0.33, 0.67);

    vec3 col = palette(uv.x + 0.5, a, b, c, d);

    fragColor = vec4(col, 1.0);
}
```

`d = (0.0, 0.33, 0.67)` 是关键参数——三个通道的相位差各 1/3，正好对应色相环上的三个 120 度间隔。改变 `d` 就是改变调色板的整体色系。

## 多组调色板对比

```glsl
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);

    // 四组不同的 d 参数，分成四行
    vec3 col;
    float row = floor((uv.y + 0.5) * 4.0);
    float t = uv.x + 0.5;

    if (row < 1.0) {
        col = palette(t, a, b, c, vec3(0.0, 0.33, 0.67)); // 经典
    } else if (row < 2.0) {
        col = palette(t, a, b, c, vec3(0.0, 0.10, 0.20)); // 暖色系
    } else if (row < 3.0) {
        col = palette(t, a, b, c, vec3(0.3, 0.20, 0.20)); // 冷紫
    } else {
        col = palette(t, a, b, c, vec3(0.8, 0.50, 0.25)); // 日落
    }

    fragColor = vec4(col, 1.0);
}
```

## 距离场着色

SDF 值本身可以驱动颜色变化。离形状中心越近，颜色越深：

```glsl
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float d = sdCircle(uv, 0.35);

    // 内部用 SDF 值做渐变
    float glow = exp(-3.0 * max(d, 0.0));      // 外部辉光
    float inner = 1.0 - smoothstep(-0.35, 0.0, d); // 内部渐变

    vec3 col = vec3(0.0);
    col += vec3(0.1, 0.4, 0.8) * glow;
    col += vec3(0.9, 0.8, 0.5) * inner;

    fragColor = vec4(col, 1.0);
}
```

`exp(-3.0 * max(d, 0.0))` 在外部空间产生指数衰减的辉光。`max(d, 0.0)` 保证内部（负值）不参与辉光计算。这种手法在 UI 设计和 Logo 渲染中非常常见。

## gamma 校正

显示器的亮度响应不是线性的——输入值 0.5 实际显示的亮度大约是 0.218（约为 0.5 的 2.2 次方）。如果不在 Shader 里做 gamma 校正，颜色混合会偏暗。

最简单的做法是输出前做一次幂运算：

```glsl
col = pow(col, vec3(1.0 / 2.2)); // 线性 → sRGB
```

Shadertoy 默认已经做了这个转换（在输出设置里可以切换），所以通常不需要手动加。但如果你把 Shader 移植到 Three.js 或其他环境，记得加上。

## 练习

1. 用调色板公式生成一个颜色随角度变化的色相环（而不是线性渐变）。
2. 修改调色板参数 `b`，观察颜色对比度的变化。
3. 用 SDF + `exp` 画一个有辉光效果的矩形。

## 参考答案

### 练习 1

```glsl
vec3 palette(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float angle = atan(uv.y, uv.x);
    float hue = angle / 6.28318 + 0.5;
    float dist = length(uv);

    float ring = smoothstep(0.4, 0.39, dist) - smoothstep(0.25, 0.24, dist);
    vec3 col = palette(hue) * ring;

    fragColor = vec4(col, 1.0);
}
```

### 练习 2

当 `b = vec3(0.2)` 时颜色偏灰（振幅小）；当 `b = vec3(0.8)` 时颜色鲜艳（振幅大）。`b = vec3(0.0)` 时全部是灰色（纯振幅为零）。

### 练习 3

```glsl
float d = sdBox(uv, vec2(0.3, 0.2));
float glow = exp(-8.0 * max(d, 0.0));
vec3 col = vec3(0.3, 0.6, 1.0) * glow;
```
