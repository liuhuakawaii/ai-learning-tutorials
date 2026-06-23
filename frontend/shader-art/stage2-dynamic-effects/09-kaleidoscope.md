# 第 9 课：万花筒与对称——极坐标变换与镜像

万花筒的效果来自重复和镜像。在 Shader 里，把笛卡尔坐标转成极坐标，再对角度取模，就能产生环绕对称。加上径向镜像，就是经典的万花筒。

## 极坐标

极坐标用 `(r, θ)` 表示点的位置——距离原点的长度和角度。

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float r = length(uv);
    float angle = atan(uv.y, uv.x); // [-π, π]

    // 用极坐标驱动颜色
    vec3 col = vec3(0.0);
    col.r = r;
    col.g = angle / 3.14159 * 0.5 + 0.5; // 归一化到 [0, 1]
    col.b = 0.3;

    fragColor = vec4(col, 1.0);
}
```

运行后你会看到：红色从中心向外增长，绿色沿角度变化。这就是极坐标的直观表达。

## 极坐标下的图案

在极坐标下画条纹，结果是同心圆和放射线：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // 径向条纹
    float radial = sin(r * 30.0) * 0.5 + 0.5;

    // 角度条纹
    float angular = sin(angle * 8.0) * 0.5 + 0.5;

    // 叠加
    float pattern = radial * angular;
    vec3 col = vec3(pattern);

    fragColor = vec4(col, 1.0);
}
```

径向条纹是同心圆，角度条纹是放射线。两者相乘产生棋盘状的极坐标网格。

## 对称折叠

对角度做取模运算，把完整的一圈分成 N 份，每份的图案相同：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // 把角度折叠成 6 份
    float N = 6.0;
    float sector = 6.28318 / N;
    angle = mod(angle, sector);        // 取模
    angle = abs(angle - sector * 0.5); // 镜像

    // 从极坐标还原回笛卡尔坐标
    vec2 p = vec2(cos(angle), sin(angle)) * r;

    // 在对称后的坐标系下画图案
    float d = length(p - vec2(0.2, 0.0));
    float pattern = smoothstep(0.05, 0.04, d);

    vec3 col = vec3(0.8, 0.4, 0.6) * pattern;

    fragColor = vec4(col, 1.0);
}
```

`mod(angle, sector)` 让角度在 `[0, sector]` 范围内循环。`abs(angle - sector * 0.5)` 把每个扇区再镜像一次。结果是 12 重对称（6 个扇区 × 每个扇区镜像）。

## 万花筒

把对称技术和动态图案结合起来：

```glsl
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

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // 8 重对称
    float N = 8.0;
    float sector = 6.28318 / N;
    angle = mod(angle + iTime * 0.1, sector);
    angle = abs(angle - sector * 0.5);

    vec2 p = vec2(cos(angle), sin(angle)) * r;

    // 在对称坐标系下生成图案
    float pattern = 0.0;
    pattern += sin(p.x * 10.0 + iTime) * sin(p.y * 10.0 + iTime * 0.7);
    pattern += noise(p * 5.0 + iTime * 0.2);
    pattern *= exp(-r * 2.0); // 中心更亮

    // 调色板着色
    vec3 col = 0.5 + 0.5 * cos(6.28318 * (pattern * 0.5 + vec3(0.0, 0.33, 0.67)));

    fragColor = vec4(col, 1.0);
}
```

`+ iTime * 0.1` 让对称轴缓慢旋转，产生万花筒的旋转效果。`exp(-r * 2.0)` 让中心更亮、边缘更暗，聚焦视觉。

## 径向镜像与花瓣

用 `abs(angle)` 做镜像，配合径向距离，可以画花瓣形状：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // 5 片花瓣
    float petals = 5.0;
    float a = abs(mod(angle, 6.28318 / petals) - 6.28318 / petals * 0.5);

    // 花瓣形状：角度和径向距离共同决定
    float petalShape = smoothstep(0.3, 0.28, r * (1.0 + 0.5 * cos(a * 2.0)));

    // 内部装饰
    float inner = smoothstep(0.15, 0.14, r);
    float ring = smoothstep(0.02, 0.01, abs(r - 0.2));

    vec3 col = vec3(0.0);
    col += vec3(0.9, 0.3, 0.5) * petalShape;
    col += vec3(1.0, 0.8, 0.3) * inner;
    col += vec3(0.6, 0.2, 0.4) * ring;

    fragColor = vec4(col, 1.0);
}
```

`r * (1.0 + 0.5 * cos(a * 2.0))` 让花瓣的半径随角度变化——角度越接近扇区中心（`a = 0`），半径越大，形成向外凸出的花瓣。

## 旋转对称与平移对称的结合

用 `mod` 同时在角度和半径上做重复：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // 角度对称
    float N = 12.0;
    float sector = 6.28318 / N;
    angle = mod(angle, sector);
    angle = abs(angle - sector * 0.5);

    // 半径重复
    float ringWidth = 0.15;
    r = mod(r + iTime * 0.02, ringWidth) - ringWidth * 0.5;

    vec2 p = vec2(cos(angle), sin(angle)) * r;

    // 图案
    float d = length(p);
    float shape = smoothstep(0.04, 0.03, d);

    vec3 col = vec3(0.3, 0.7, 1.0) * shape;
    col += vec3(0.05, 0.05, 0.1);

    fragColor = vec4(col, 1.0);
}
```

`mod(r, ringWidth)` 让半径在每个环内重复。结合角度对称，结果是无限延伸的几何网格。

## 练习

1. 把万花筒的对称数从 8 改成可变（用鼠标 x 位置控制 2~20）。
2. 在花瓣图案里加入动画：花瓣随时间"呼吸"（半径周期变化）。
3. 用极坐标 + 噪声生成一个漩涡星系图案。

## 参考答案

### 练习 1

```glsl
float N = 2.0 + floor(iMouse.x / iResolution.x * 18.0);
```

### 练习 2

```glsl
float breathe = 1.0 + 0.15 * sin(iTime * 2.0);
float petalShape = smoothstep(0.3 * breathe, 0.28 * breathe, r * (1.0 + 0.5 * cos(a * 2.0)));
```

### 练习 3

```glsl
float spiral = sin(angle * 3.0 - r * 15.0 + iTime * 0.5);
float n = noise(vec2(angle * 2.0 + iTime * 0.1, r * 5.0));
float galaxy = spiral * 0.5 + 0.5 + n * 0.3;
galaxy *= exp(-r * 2.5);
vec3 col = mix(vec3(0.05, 0.02, 0.1), vec3(0.8, 0.6, 1.0), galaxy);
```
