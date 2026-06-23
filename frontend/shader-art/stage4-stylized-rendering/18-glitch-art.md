# 第 18 课：故障艺术——数据损坏效果、CRT 扫描线

Glitch Art 故意模拟数字信号的错误——图像撕裂、颜色偏移、数据块错位。这些效果在 Shader 里很容易实现，因为它们本质上就是对 UV 坐标和颜色值的数学扰动。

## 水平撕裂

随机选择某些行，把它们的 UV 横向偏移：

```glsl
float hash(float n) { return fract(sin(n) * 43758.5453); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // 撕裂强度（随时间脉冲）
    float strength = smoothstep(0.95, 1.0, sin(iTime * 2.0) * 0.5 + 0.5);

    // 随机行偏移
    float row = floor(uv.y * 200.0);
    float offset = hash(row + floor(iTime * 10.0)) * 0.1 - 0.05;
    uv.x += offset * strength;

    // 渲染
    vec3 col = vec3(0.0);
    float d = length(uv - 0.5);
    col = mix(vec3(0.1, 0.15, 0.3), vec3(0.8, 0.5, 0.2), 1.0 - d * 1.5);

    fragColor = vec4(col, 1.0);
}
```

`strength` 用 `sin` 产生周期性脉冲——大部分时间是正常的，偶尔"故障"一下。

## RGB 通道分离

把 R、G、B 三个通道用不同的 UV 偏移渲染：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    float glitchStrength = smoothstep(0.9, 1.0, sin(iTime * 3.0) * 0.5 + 0.5);

    // 通道偏移
    vec2 offsetR = vec2(0.01, 0.0) * glitchStrength;
    vec2 offsetB = vec2(-0.01, 0.0) * glitchStrength;

    // 渲染（用一个简单的圆形作为示例）
    vec3 col;
    col.r = 1.0 - length(uv + offsetR - 0.5) * 2.0;
    col.g = 1.0 - length(uv - 0.5) * 2.0;
    col.b = 1.0 - length(uv + offsetB - 0.5) * 2.0;

    col = clamp(col, 0.0, 1.0);

    fragColor = vec4(col, 1.0);
}
```

R 通道向右偏移，B 通道向左偏移。偏移量很小时是色差（Chromatic Aberration），大时是明显的故障。

## 数据块错位

把画面分成块，随机选择某些块整体偏移：

```glsl
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // 分块
    float blockSize = 0.05;
    vec2 block = floor(uv / blockSize);

    // 随机选择要偏移的块
    float shouldGlitch = step(0.92, hash(block + floor(iTime * 5.0)));

    // 随机偏移
    vec2 offset = vec2(
        hash(block + 100.0) - 0.5,
        hash(block + 200.0) - 0.5
    ) * 0.1 * shouldGlitch;

    uv += offset;

    // 渲染
    vec3 col = vec3(0.0);
    float d = length(uv - 0.5);
    col = mix(vec3(0.1, 0.15, 0.3), vec3(0.8, 0.5, 0.2), 1.0 - d * 1.5);

    fragColor = vec4(col, 1.0);
}
```

`step(0.92, hash(...))` 有 8% 的概率触发偏移。触发时，整个块的 UV 被平移。

## 扫描线噪声

水平扫描线带随机强度：

```glsl
float scanlineNoise(vec2 uv, float time) {
    float line = fract(uv.y * 200.0 + time * 50.0);
    float noise = hash(vec2(floor(uv.y * 200.0), floor(time * 50.0)));
    return smoothstep(0.4, 0.6, line) * noise;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    vec3 col = vec3(0.0);
    float d = length(uv - 0.5);
    col = mix(vec3(0.1, 0.15, 0.3), vec3(0.8, 0.5, 0.2), 1.0 - d * 1.5);

    // 扫描线
    float scanline = sin(uv.y * iResolution.y * 3.14159) * 0.05 + 0.95;
    col *= scanline;

    // 随机扫描线噪声
    float noise = scanlineNoise(uv, iTime);
    col += vec3(noise * 0.1);

    fragColor = vec4(col, 1.0);
}
```

## VHS 效果

VHS 磁带的特征：色度偏移、时基抖动、磁带纹理：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // 时基抖动：UV 横向微小波动
    uv.x += sin(uv.y * 100.0 + iTime * 20.0) * 0.002;

    // 色度偏移
    float chromaShift = sin(iTime * 7.0) * 0.005;
    vec2 uvR = uv + vec2(chromaShift, 0.0);
    vec2 uvB = uv - vec2(chromaShift, 0.0);

    // 渲染（简单形状）
    vec3 col;
    col.r = 1.0 - length(uvR - 0.5) * 2.0;
    col.g = 1.0 - length(uv - 0.5) * 2.0;
    col.b = 1.0 - length(uvB - 0.5) * 2.0;
    col = clamp(col, 0.0, 1.0);

    // VHS 磁带纹理（水平条纹）
    float tapeNoise = hash(vec2(floor(uv.y * 400.0), floor(iTime * 30.0)));
    col *= 0.9 + 0.1 * tapeNoise;

    // 顶部和底部磁带磨损
    float edgeDist = min(uv.y, 1.0 - uv.y);
    float edgeNoise = hash(vec2(floor(uv.x * 50.0), floor(iTime * 10.0)));
    float damage = smoothstep(0.02, 0.05, edgeDist + edgeNoise * 0.03);
    col *= damage;

    // 整体偏绿（VHS 色偏）
    col = col * vec3(0.95, 1.0, 0.9) + vec3(0.0, 0.02, 0.0);

    fragColor = vec4(col, 1.0);
}
```

## 像素排序（Pixel Sorting）

Glitch Art 的经典手法：把某些行的像素按亮度排序，产生拉丝效果。Shader 里无法真正排序，但可以用噪声值做近似：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // 基础渲染
    vec3 col = vec3(0.0);
    float d = length(uv - 0.5);
    col = mix(vec3(0.1, 0.15, 0.3), vec3(0.8, 0.5, 0.2), 1.0 - d * 1.5);

    // 像素排序模拟
    float brightness = dot(col, vec3(0.299, 0.587, 0.114));
    float sortMask = step(0.5, hash(floor(uv.y * 100.0) + floor(iTime * 3.0)));

    // 在被选中的行里，根据亮度拉伸 UV
    uv.x += (brightness - 0.5) * 0.1 * sortMask;

    // 重新渲染
    col = vec3(0.0);
    d = length(uv - 0.5);
    col = mix(vec3(0.1, 0.15, 0.3), vec3(0.8, 0.5, 0.2), 1.0 - d * 1.5);

    fragColor = vec4(col, 1.0);
}
```

`(brightness - 0.5) * 0.1` 让亮的像素向右拉、暗的像素向左拉，产生像素排序的拉丝感。

## 练习

1. 给故障效果加一个"触发概率"：大部分时间正常，随机时间点爆发。
2. 实现一个静态干扰效果（雪花屏），用纯噪声。
3. 把 RGB 分离和块错位组合成一个统一的故障系统。

## 参考答案

### 练习 1

```glsl
// 用时间的随机性控制触发
float triggerTime = floor(iTime * 2.0);
float trigger = step(0.7, hash(triggerTime)); // 30% 概率触发
float duration = hash(triggerTime + 100.0) * 0.5; // 持续时间随机
float intensity = trigger * smoothstep(0.0, 0.1, mod(iTime, 1.0 / 2.0))
                         * smoothstep(duration, duration - 0.1, mod(iTime, 1.0 / 2.0));
```

### 练习 2

```glsl
float noise = hash(fragCoord + iTime * 1000.0);
vec3 col = vec3(noise);
// 加上闪烁
col *= 0.5 + 0.5 * hash(floor(iTime * 60.0));
```

### 练习 3

在同一个 shader 里用多个触发条件控制不同效果的强度，它们可以独立触发也可以同时触发。
