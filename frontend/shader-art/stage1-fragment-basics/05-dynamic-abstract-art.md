# 第 5 课：阶段实战——用纯 Shader 画动态抽象画

前四课学了坐标系统、SDF 形状、颜色空间和噪声。这节课把这些组合起来，用纯 Fragment Shader 创作一幅随时间变化的抽象画。

目标不是复制某张图，而是练习用数学控制视觉。

## 设计思路

一幅动态抽象画通常包含这些元素：
- 几个形状层叠加
- 颜色随时间缓慢变化
- 形状的大小、位置、旋转随时间波动
- 用噪声打破完美对称
- 用混合模式（叠加、屏幕混合）增加层次感

## 屏幕混合模式

Photoshop 里的"滤色"模式在 Shader 里的实现：

```glsl
vec3 screen(vec3 a, vec3 b) {
    return 1.0 - (1.0 - a) * (1.0 - b);
}
```

它让两层亮的部分叠加后更亮，暗的部分互相透明。适合做光效叠加。

## 完整代码

```glsl
// ---- 噪声工具 ----
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

// ---- SDF 工具 ----
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// ---- 调色板 ----
vec3 palette(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

// ---- 混合模式 ----
vec3 screen(vec3 a, vec3 b) {
    return 1.0 - (1.0 - a) * (1.0 - b);
}

// ---- 旋转矩阵 ----
mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;

    // 背景：缓慢流动的噪声
    float bg = fbm(uv * 2.0 + t * 0.05);
    vec3 col = palette(bg + t * 0.02) * 0.3;

    // 第一层：缓慢旋转的大圆环
    vec2 p1 = rot(t * 0.2) * uv;
    float ring1 = abs(sdCircle(p1, 0.35)) - 0.03;
    float m1 = smoothstep(0.01, -0.01, ring1);
    vec3 c1 = palette(t * 0.1) * m1;
    col = screen(col, c1);

    // 第二层：三个小圆做圆周运动
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float angle = t * 0.5 + fi * 2.094; // 2π/3 ≈ 2.094
        vec2 center = vec2(cos(angle), sin(angle)) * 0.2;
        vec2 p2 = uv - center;
        p2 = rot(-t * 0.8) * p2;
        float d2 = sdCircle(p2, 0.08);
        float m2 = smoothstep(0.005, -0.005, d2);
        vec3 c2 = palette(fi / 3.0 + t * 0.15) * m2;
        col = screen(col, c2 * 0.7);
    }

    // 第三层：旋转的矩形，尺寸随噪声变化
    vec2 p3 = rot(t * 0.3 + 0.5) * uv;
    float sizeOffset = fbm(vec2(t * 0.2, 0.0)) * 0.1;
    float d3 = sdBox(p3, vec2(0.2 + sizeOffset, 0.12));
    float m3 = smoothstep(0.01, -0.01, d3);
    vec3 c3 = palette(0.6 + t * 0.08) * m3;
    col = screen(col, c3 * 0.5);

    // 第四层：用噪声扭曲的圆，增加有机感
    vec2 p4 = uv;
    float angle4 = atan(p4.y, p4.x);
    float dist4 = length(p4);
    float warp = fbm(vec2(angle4 * 2.0 + t * 0.3, dist4 * 3.0));
    float d4 = sdCircle(p4, 0.15 + warp * 0.08);
    float m4 = smoothstep(0.02, -0.02, d4);
    vec3 c4 = palette(0.3 + t * 0.05) * m4;
    col = screen(col, c4 * 0.6);

    // 边缘暗角
    float vignette = 1.0 - 0.4 * dot(uv, uv);
    col *= vignette;

    // gamma 校正
    col = pow(col, vec3(0.9));

    fragColor = vec4(col, 1.0);
}
```

## 逐层分析

**背景层**：用 FBM 生成缓慢变化的噪声纹理，再通过调色板公式映射成颜色。乘以 `0.3` 让背景保持低调。

**大圆环**：`abs(sdCircle(...)) - 0.03` 把圆形变成圆环。`rot(t * 0.2) * uv` 让坐标系缓慢旋转，圆环本身不需要动——旋转坐标等于旋转形状。

**三个小圆**：用 `for` 循环生成三个沿圆周运动的小圆。`fi * 2.094` 是 `2π/3`，让三个圆均匀分布。每个小圆又在做反向旋转（`rot(-t * 0.8)`），产生有趣的运动叠加。

**矩形层**：尺寸受噪声控制（`sizeOffset`），产生"呼吸"效果。

**扭曲圆**：在极坐标下用噪声扭曲半径，产生有机的、不规则的形状。

**暗角**：`dot(uv, uv)` 是到画面中心的距离平方，用它做边缘衰减，让视线自然聚焦中心。

## 调参技巧

- **改变速度**：把所有 `t * 0.x` 的系数调大或调小。`0.05` 很慢，`1.0` 很快。
- **改变配色**：修改 `palette()` 里的 `vec3(0.0, 0.33, 0.67)` 参数。
- **增加层数**：复制任意一层，改 `palette()` 的偏移参数，新层就会用不同的颜色。
- **改变混合模式**：把 `screen` 换成 `max`（变亮混合）或 `a + b`（加法混合，可能过曝）。

## 练习

1. 加入第五层：用 SDF 描边画一个不断变形的三角形（提示：用三个线段的 SDF 取并集）。
2. 把背景层的调色板从冷色系改成暖色系。
3. 在矩形层上加一个"辉光"效果：矩形外部用 `exp` 产生指数衰减。

## 参考答案

### 练习 1

```glsl
float sdTriangle(vec2 p, float size) {
    float k = sqrt(3.0);
    p.x = abs(p.x) - size;
    p.y = p.y + size / k;
    if (p.x + k * p.y > 0.0) {
        p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    }
    p.x -= clamp(p.x, -2.0 * size, 0.0);
    return -length(p) * sign(p.y);
}

// 在 mainImage 中加入：
vec2 p5 = rot(t * 0.15) * uv;
float tri = abs(sdTriangle(p5, 0.2)) - 0.008;
float m5 = smoothstep(0.01, -0.01, tri);
vec3 c5 = palette(0.8 + t * 0.1) * m5;
col = screen(col, c5 * 0.5);
```

### 练习 2

把 `palette(bg + t * 0.02)` 改成 `palette(bg + t * 0.02 + 0.5)`——偏移 0.5 会让色相旋转 180 度，冷色变暖色。

### 练习 3

```glsl
float glow = exp(-10.0 * max(d3, 0.0));
vec3 c3glow = palette(0.6 + t * 0.08) * glow * 0.3;
col += c3glow;
```
