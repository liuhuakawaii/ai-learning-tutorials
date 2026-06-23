# 第 10 课：阶段实战——实时 Shader 音乐可视化

这节课用前五课的技巧构建一个音乐可视化器：波形、频谱、粒子、对称效果全用 Fragment Shader 实现。

Shadertoy 支持音频输入（`iChannel0` 绑定麦克风或音频文件），但为了通用性，我们先用数学模拟音频数据，最后再对接真实音频。

## 音频数据的模拟

真实音频 FFT 数据是一个频谱数组，低频在左、高频在右。Shadertoy 通过纹理采样提供这个数据。我们先用噪声模拟：

```glsl
float fakeBass(float t) {
    return 0.5 + 0.5 * sin(t * 3.0) * sin(t * 7.0);
}

float fakeMid(float t) {
    return 0.5 + 0.5 * sin(t * 13.0) * sin(t * 5.0 + 1.0);
}

float fakeTreble(float t) {
    return 0.5 + 0.5 * sin(t * 23.0) * sin(t * 11.0 + 2.0);
}
```

三个频率段：低音（bass）控制大的脉动，中音（mid）控制中等尺度的细节，高音（treble）控制高频闪烁。

## 频谱柱状图

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float t = iTime;

    // 模拟 32 个频段
    float bar = 0.0;
    float numBars = 32.0;
    float barIndex = floor((uv.x + 0.5) * numBars);
    float barWidth = 1.0 / numBars;
    float barX = (uv.x + 0.5) * numBars - barIndex;

    // 每个频段的"能量"
    float freq = barIndex / numBars;
    float energy = 0.5 + 0.5 * sin(freq * 20.0 + t * 5.0) * sin(freq * 7.0 + t * 2.0);
    energy *= 0.6 + 0.4 * sin(t * 3.0 + freq * 10.0);

    // 柱状图
    float barHeight = energy * 0.8;
    float barMask = step(uv.y + 0.4, barHeight);
    barMask *= step(0.05, barX) * step(barX, 0.95); // 柱间间距

    // 颜色
    vec3 col = vec3(0.0);
    vec3 barColor = 0.5 + 0.5 * cos(6.28318 * (freq + vec3(0.0, 0.33, 0.67)));
    col += barColor * barMask;

    // 顶部高光
    float top = smoothstep(0.02, 0.0, abs(uv.y + 0.4 - barHeight));
    col += vec3(1.0) * top * 0.5 * step(0.0, barHeight - 0.01);

    fragColor = vec4(col, 1.0);
}
```

`step(a, b)` 当 `b ≥ a` 时返回 1，否则返回 0。两个 `step` 相乘在柱子两侧留出间距。

## 波形显示

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 模拟波形数据
    float wave = 0.0;
    wave += sin(uv.x * 20.0 + iTime * 5.0) * 0.3;
    wave += sin(uv.x * 35.0 + iTime * 7.0) * 0.15;
    wave += sin(uv.x * 50.0 + iTime * 11.0) * 0.08;
    wave *= 0.5 + 0.5 * sin(iTime * 2.0);

    // 波形线
    float d = abs(uv.y - wave);
    float line = smoothstep(0.015, 0.005, d);

    // 波形填充
    float fill = smoothstep(0.0, -0.01, uv.y - wave) * 0.15;

    // 颜色
    vec3 col = vec3(0.02, 0.02, 0.05);
    col += vec3(0.2, 0.6, 1.0) * line;
    col += vec3(0.1, 0.3, 0.6) * fill;

    // 发光效果
    col += vec3(0.1, 0.3, 0.6) * exp(-d * 50.0) * 0.3;

    fragColor = vec4(col, 1.0);
}
```

三层叠加：线本身（`line`）、线下方的半透明填充（`fill`）、线周围的辉光（`exp`）。

## 粒子随音乐脉动

```glsl
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float t = iTime;
    vec3 col = vec3(0.0);

    // 音乐脉动
    float pulse = 0.5 + 0.5 * sin(t * 4.0) * sin(t * 7.0);

    float gridSize = 20.0;
    vec2 gridUV = uv * gridSize;
    vec2 cellID = floor(gridUV);
    vec2 cellPos = fract(gridUV) - 0.5;

    // 每个粒子的随机属性
    float speed = 0.3 + hash(cellID) * 0.5;
    float angle = hash(cellID + 100.0) * 6.28318;
    vec2 vel = vec2(cos(angle), sin(angle)) * speed;

    // 粒子位置，受音乐脉动影响
    vec2 pp = cellPos - vel * t * (0.5 + pulse * 0.5);
    pp = fract(pp + 0.5) - 0.5;

    float d = length(pp);

    // 粒子大小随音乐变化
    float size = 0.08 + pulse * 0.06;
    float particle = smoothstep(size, size * 0.3, d);

    // 颜色随脉动变化
    vec3 pColor = 0.5 + 0.5 * cos(6.28318 * (hash(cellID) + pulse * 0.3 + vec3(0.0, 0.33, 0.67)));

    col += pColor * particle * (0.5 + pulse * 0.5);

    // 低频脉动的背景光圈
    float centerGlow = exp(-length(uv) * (3.0 - pulse * 1.5)) * pulse * 0.2;
    col += vec3(0.2, 0.1, 0.3) * centerGlow;

    fragColor = vec4(col, 1.0);
}
```

粒子的速度和大小都受 `pulse` 驱动，音乐激烈时粒子运动更快、更大。

## 完整可视化器

把三个效果用极坐标变换和对称组合起来：

```glsl
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    float t = iTime;

    float bass = 0.5 + 0.5 * sin(t * 3.0) * sin(t * 7.0);
    float mid = 0.5 + 0.5 * sin(t * 13.0) * sin(t * 5.0 + 1.0);

    vec3 col = vec3(0.02, 0.01, 0.04);

    // 中央：低音脉动的圆
    float r = length(uv);
    float pulseCircle = smoothstep(0.3 + bass * 0.15, 0.29 + bass * 0.15, r);
    col += vec3(0.6, 0.2, 0.4) * pulseCircle * bass;

    // 辉光
    col += vec3(0.4, 0.1, 0.3) * exp(-r * (4.0 - bass * 2.0)) * bass * 0.3;

    // 放射线（极坐标对称）
    float angle = atan(uv.y, uv.x);
    float N = 12.0;
    float sector = 6.28318 / N;
    float rayAngle = mod(angle, sector) - sector * 0.5;
    float ray = exp(-abs(rayAngle) * 8.0 / (1.0 + mid));
    col += vec3(0.2, 0.4, 0.8) * ray * 0.15 * (1.0 - smoothstep(0.1, 0.6, r));

    // 粒子层
    float gridSize = 25.0;
    vec2 gridUV = uv * gridSize;
    vec2 cellID = floor(gridUV);
    vec2 cellPos = fract(gridUV) - 0.5;

    float speed = 0.4 + hash(cellID) * 0.6;
    float a = hash(cellID + 100.0) * 6.28318;
    vec2 vel = vec2(cos(a), sin(a)) * speed;
    vec2 pp = cellPos - vel * t * (0.3 + bass * 0.4);
    pp = fract(pp + 0.5) - 0.5;
    float d = length(pp);
    float particle = smoothstep(0.1 + bass * 0.05, 0.02, d);
    vec3 pCol = 0.5 + 0.5 * cos(6.28318 * (hash(cellID) + bass * 0.3 + vec3(0.0, 0.33, 0.67)));
    col += pCol * particle * 0.4;

    // 暗角
    col *= 1.0 - 0.4 * dot(uv, uv);

    fragColor = vec4(col, 1.0);
}
```

## 接入真实音频

Shadertoy 支持通过 `iChannel0` 采样音频频谱：

```glsl
float bass = texture(iChannel0, vec2(0.05, 0.25)).x;   // 低频
float mid = texture(iChannel0, vec2(0.3, 0.25)).x;     // 中频
float treble = texture(iChannel0, vec2(0.8, 0.25)).x;  // 高频
```

纹理的 x 坐标对应频率（0 = 最低频，1 = 最高频），y 固定 `0.25` 取频谱数据。把这三个值替换上面代码里的模拟函数就行。

## 练习

1. 加入一个"节拍检测"逻辑：当 `bass` 突然变大时，产生一次屏幕闪烁。
2. 把放射线改成螺旋线（在角度里加半径偏移）。
3. 用 `treble` 控制粒子的颜色饱和度——高频越强，颜色越鲜艳。

## 参考答案

### 练习 1

```glsl
// 用帧间差分模拟节拍检测
float beatStrength = max(bass - 0.7, 0.0) * 3.0; // bass 超过阈值时触发
col += vec3(0.3) * beatStrength;
```

### 练习 2

```glsl
float spiralAngle = angle + r * 5.0; // 半径越大，偏转越多
float rayAngle = mod(spiralAngle, sector) - sector * 0.5;
```

### 练习 3

```glsl
float treble = 0.5 + 0.5 * sin(t * 23.0) * sin(t * 11.0 + 2.0);
vec3 pCol = 0.5 + 0.5 * cos(6.28318 * (hash(cellID) + vec3(0.0, 0.33, 0.67)));
pCol = mix(vec3(dot(pCol, vec3(0.33))), pCol, treble); // 低频时变灰，高频时全彩
```
