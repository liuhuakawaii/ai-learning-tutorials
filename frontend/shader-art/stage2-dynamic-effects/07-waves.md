# 第 7 课：波浪——正弦波叠加与水面模拟

正弦波是最基础的周期函数，但把几个不同频率、方向、相位的正弦波叠加起来，就能模拟水面、旗布、沙丘等自然现象。这节课从单一正弦波开始，逐步构建一个实时水面。

## 单一正弦波

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float wave = sin(uv.x * 10.0 + iTime);
    float mask = smoothstep(wave - 0.02, wave + 0.02, uv.y);

    vec3 col = mix(vec3(0.1, 0.2, 0.5), vec3(0.8, 0.9, 1.0), mask);

    fragColor = vec4(col, 1.0);
}
```

`sin(x * 10.0 + iTime)` 产生一个频率为 10、随时间向左移动的正弦波。`smoothstep` 把波形变成一条带宽度的曲线——波形上方亮，下方暗。

## 叠加多个波

单个正弦波太规则了。叠加不同频率、方向、速度的波会产生复杂的干涉图案：

```glsl
float wave(vec2 p, vec2 dir, float freq, float speed) {
    return sin(dot(p, dir) * freq + iTime * speed);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float h = 0.0;
    h += wave(uv, vec2(1.0, 0.0), 8.0, 1.0) * 0.5;
    h += wave(uv, vec2(0.7, 0.7), 12.0, 1.3) * 0.3;
    h += wave(uv, vec2(-0.3, 1.0), 15.0, 0.8) * 0.15;
    h += wave(uv, vec2(1.0, -0.5), 20.0, 1.5) * 0.05;

    float mask = smoothstep(h - 0.02, h + 0.02, uv.y);
    vec3 col = mix(vec3(0.05, 0.1, 0.3), vec3(0.7, 0.85, 1.0), mask);

    fragColor = vec4(col, 1.0);
}
```

`dir` 是波的传播方向。`dot(p, dir)` 把二维坐标投影到传播方向上，变成一维问题。频率越高、振幅越小的波产生细节，频率低的波控制整体形状。

## 用波做水面高度场

把叠加的波值当作"水面高度"，用来驱动颜色和法线：

```glsl
float wave(vec2 p, vec2 dir, float freq, float speed) {
    return sin(dot(p, dir) * freq + iTime * speed);
}

float waterHeight(vec2 p) {
    float h = 0.0;
    h += wave(p, vec2(1.0, 0.0), 6.0, 0.8) * 0.5;
    h += wave(p, vec2(0.7, 0.7), 10.0, 1.0) * 0.25;
    h += wave(p, vec2(-0.3, 1.0), 14.0, 0.6) * 0.15;
    h += wave(p, vec2(0.5, -0.8), 18.0, 1.2) * 0.1;
    return h;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float h = waterHeight(uv);

    // 用有限差分估算梯度（法线）
    float eps = 0.001;
    float hx = waterHeight(uv + vec2(eps, 0.0)) - waterHeight(uv - vec2(eps, 0.0));
    float hy = waterHeight(uv + vec2(0.0, eps)) - waterHeight(uv - vec2(0.0, eps));

    // 简单光照：假设光从左上方来
    vec3 lightDir = normalize(vec3(-1.0, 1.0, 1.0));
    vec3 normal = normalize(vec3(-hx, -hy, 0.5));
    float diffuse = max(dot(normal, lightDir), 0.0);

    // 水面颜色
    vec3 deepColor = vec3(0.02, 0.05, 0.15);
    vec3 shallowColor = vec3(0.1, 0.3, 0.5);
    vec3 col = mix(deepColor, shallowColor, h * 0.5 + 0.5);

    // 叠加光照
    col += vec3(0.3, 0.5, 0.7) * diffuse;

    // 高光
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 64.0);
    col += vec3(1.0, 0.95, 0.8) * spec * 0.5;

    fragColor = vec4(col, 1.0);
}
```

**有限差分法**：在微小偏移 `eps` 处重新计算高度值，差值除以 `2*eps` 就是梯度。梯度的方向就是法线方向。

**Phong 光照模型**：漫反射（`diffuse`）加上高光（`spec`），是实时渲染中最常用的光照模型。

## Gerstner 波

正弦波的峰是圆的，真实水面的波峰更尖。Gerstner 波修正了这个问题——波形的尖峰更接近真实海浪：

```glsl
vec2 gerstnerWave(vec2 p, vec2 dir, float steepness, float wavelength, float speed) {
    float k = 6.28318 / wavelength;
    float c = speed;
    float f = k * (dot(dir, p) - c * iTime);
    float a = steepness / k;

    return vec2(dir.x * a * cos(f), dir.y * a * cos(f));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec2 p = uv;
    p += gerstnerWave(uv, vec2(1.0, 0.0), 0.25, 0.5, 0.8);
    p += gerstnerWave(uv, vec2(0.7, 0.7), 0.25, 0.3, 1.0);
    p += gerstnerWave(uv, vec2(-0.3, 1.0), 0.15, 0.4, 0.6);

    float h = p.y - uv.y;
    float mask = smoothstep(-0.01, 0.01, h);

    vec3 col = mix(vec3(0.05, 0.1, 0.25), vec3(0.6, 0.8, 1.0), mask);

    fragColor = vec4(col, 1.0);
}
```

Gerstner 波不是修改高度，而是修改顶点位置。`steepness` 控制波峰的尖锐程度，`wavelength` 控制波长。

## 涟漪效果

一个点源产生的同心圆波纹：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec2 center = vec2(0.0);
    float dist = length(uv - center);

    float ripple = sin(dist * 30.0 - iTime * 3.0);
    ripple *= exp(-dist * 3.0); // 越远越弱

    vec3 col = vec3(0.1, 0.2, 0.4);
    col += vec3(0.3, 0.5, 0.8) * ripple * 0.5;

    fragColor = vec4(col, 1.0);
}
```

`sin(dist * 30.0 - iTime * 3.0)` 产生从中心向外扩散的同心圆。`exp(-dist * 3.0)` 让远处的波纹衰减为零。

## 练习

1. 给水面加上 Fresnel 效果（越靠近视线边缘，反射越强）。
2. 把涟漪的中心点跟随鼠标移动。
3. 叠加两个不同中心的涟漪，观察干涉图案。

## 参考答案

### 练习 1

```glsl
float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
vec3 reflColor = vec3(0.5, 0.7, 0.9);
col = mix(col, reflColor, fresnel * 0.5);
```

### 练习 2

```glsl
vec2 center = (iMouse.xy / iResolution.xy - 0.5) * 2.0;
if (iMouse.z <= 0.0) center = vec2(0.0); // 没点击时默认中心
```

### 练习 3

```glsl
float d1 = length(uv - vec2(-0.2, 0.0));
float d2 = length(uv - vec2(0.2, 0.0));
float r1 = sin(d1 * 30.0 - iTime * 3.0) * exp(-d1 * 3.0);
float r2 = sin(d2 * 30.0 - iTime * 3.0) * exp(-d2 * 3.0);
float ripple = r1 + r2; // 线性叠加
```
