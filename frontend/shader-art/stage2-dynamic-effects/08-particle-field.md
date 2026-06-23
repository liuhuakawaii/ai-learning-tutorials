# 第 8 课：粒子场——基于 Shader 的粒子系统

传统粒子系统在 CPU 上更新每个粒子的位置，然后逐个绘制。Shader 的做法完全不同：每个像素独立决定自己的颜色，通过数学模拟"如果这里有粒子会是什么样"。

这种方式没有粒子数量限制，可以渲染百万级粒子的效果。

## 格子粒子

最简单的思路：把空间分成格子，每个格子中心放一个粒子。

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float gridSize = 20.0;
    vec2 gridUV = uv * gridSize;
    vec2 cellID = floor(gridUV);
    vec2 cellPos = fract(gridUV) - 0.5; // 格子内坐标，中心为原点

    // 每个格子一个粒子，放在中心
    float d = length(cellPos);
    float particle = smoothstep(0.15, 0.1, d);

    vec3 col = vec3(particle);

    fragColor = vec4(col, 1.0);
}
```

`floor(gridUV)` 给每个格子一个唯一的 ID。`fract(gridUV)` 是点在格子内的相对坐标。这样每个格子独立计算自己的粒子。

## 让粒子运动

每个格子的粒子可以用 `cellID` 作为种子，算出不同的偏移量：

```glsl
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float gridSize = 15.0;
    vec2 gridUV = uv * gridSize;
    vec2 cellID = floor(gridUV);
    vec2 cellPos = fract(gridUV) - 0.5;

    // 每个格子的粒子有自己的运动轨迹
    float speed = 0.5 + hash(cellID) * 0.5;
    float angle = hash(cellID + 100.0) * 6.28318;
    vec2 velocity = vec2(cos(angle), sin(angle)) * speed;

    // 当前帧的粒子位置
    vec2 particlePos = cellPos - velocity * iTime;
    particlePos = fract(particlePos + 0.5) - 0.5; // 环绕格子

    float d = length(particlePos);
    float particle = smoothstep(0.12, 0.04, d);

    vec3 col = vec3(0.3, 0.6, 1.0) * particle;

    fragColor = vec4(col, 1.0);
}
```

`fract(particlePos + 0.5) - 0.5` 让粒子移出格子边界时从另一侧出现，产生连续运动的效果。

## 发光粒子

把粒子从"硬圆"变成"软光点"：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 col = vec3(0.0);

    // 多层粒子，每层不同密度和速度
    for (int layer = 0; layer < 3; layer++) {
        float fi = float(layer);
        float gridSize = 8.0 + fi * 5.0;
        vec2 gridUV = uv * gridSize;
        vec2 cellID = floor(gridUV);
        vec2 cellPos = fract(gridUV) - 0.5;

        float speed = 0.3 + hash(cellID + fi * 100.0) * 0.4;
        float angle = hash(cellID + fi * 200.0) * 6.28318;
        vec2 vel = vec2(cos(angle), sin(angle)) * speed;

        vec2 pp = cellPos - vel * iTime;
        pp = fract(pp + 0.5) - 0.5;

        float d = length(pp);

        // 发光效果：用 exp 而不是 smoothstep
        float glow = exp(-d * 20.0 / (1.0 + fi * 0.5));
        vec3 particleColor = 0.5 + 0.5 * cos(6.28318 * (hash(cellID) + vec3(0.0, 0.33, 0.67)));

        col += particleColor * glow * (0.5 / (1.0 + fi));
    }

    // 背景暗角
    col += vec3(0.02, 0.02, 0.05);

    fragColor = vec4(col, 1.0);
}
```

`exp(-d * k)` 产生指数衰减的辉光，比 `smoothstep` 更自然。三层粒子叠加，每层密度递增、亮度递减，产生深度感。

## 流场粒子

用噪声定义一个"流场"，粒子沿流场方向运动：

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

// 流场方向：噪声驱动的旋涡
vec2 flowField(vec2 p) {
    float angle = noise(p * 3.0) * 6.28318 + noise(p * 1.5 + 100.0) * 3.0;
    return vec2(cos(angle), sin(angle));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 col = vec3(0.0);
    float gridSize = 30.0;
    vec2 gridUV = uv * gridSize;
    vec2 cellID = floor(gridUV);
    vec2 cellPos = fract(gridUV) - 0.5;

    // 粒子初始位置（格子内的随机偏移）
    vec2 initPos = vec2(hash(cellID), hash(cellID + 50.0)) - 0.5;

    // 用流场做几帧积分（Euler 方法）
    vec2 p = initPos + cellID / gridSize;
    float dt = 0.003;
    for (int step = 0; step < 10; step++) {
        p += flowField(p) * dt;
    }

    // 当前帧偏移
    vec2 offset = (p - cellID / gridSize) * gridSize - cellPos;

    // 粒子形状：拉长的椭圆，沿运动方向
    vec2 flowDir = flowField(p);
    vec2 localOffset = cellPos - initPos + offset;
    float along = dot(localOffset, flowDir);
    float across = dot(localOffset, vec2(-flowDir.y, flowDir.x));
    float d = length(vec2(along * 0.3, across));

    float particle = smoothstep(0.08, 0.02, d);
    col += vec3(0.4, 0.7, 1.0) * particle * 0.6;

    col += vec3(0.01, 0.01, 0.03);

    fragColor = vec4(col, 1.0);
}
```

粒子被拉长成椭圆形，长轴方向沿流场方向。`along * 0.3` 压缩了沿运动方向的分量，让粒子看起来像流星或流线。

## 练习

1. 把发光粒子的颜色改成暖色系（橙/红/黄），营造火焰感。
2. 给流场粒子加上尾迹（提示：在粒子运动方向的后方叠加更暗的圆）。
3. 用鼠标位置作为引力中心，让粒子被吸引过去。

## 参考答案

### 练习 1

```glsl
vec3 particleColor = 0.5 + 0.5 * cos(6.28318 * (hash(cellID) + vec3(0.0, 0.1, 0.35)));
```

把 `d` 偏移从 `(0.0, 0.33, 0.67)` 改成 `(0.0, 0.1, 0.35)`，色相集中在暖色区域。

### 练习 2

在主粒子后面叠加 2-3 个更暗、更小的圆：

```glsl
for (int tail = 1; tail <= 3; tail++) {
    vec2 tailPos = pp + vel * float(tail) * 0.02;
    tailPos = fract(tailPos + 0.5) - 0.5;
    float td = length(tailPos);
    col += vec3(0.2, 0.4, 0.8) * exp(-td * 25.0) * (0.3 / float(tail));
}
```

### 练习 3

在流场方向上叠加一个指向鼠标的力：

```glsl
vec2 mousePos = (iMouse.xy / iResolution.xy - 0.5) * 2.0;
vec2 toMouse = normalize(mousePos - p);
vec2 force = flowField(p) + toMouse * 2.0; // 引力权重为 2.0
p += force * dt;
```
