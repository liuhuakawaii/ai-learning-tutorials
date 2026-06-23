# 第 4 课：噪声——Value Noise、Perlin Noise、Simplex Noise

前面的形状都是数学公式直接定义的——圆、矩形、线段。但自然界没有完美的几何体。云、石头、木纹、地形都有随机感但又不是纯随机。

噪声函数就是干这个的：给一个坐标，返回一个"看起来自然"的数值。它和 `random()` 的区别在于——噪声是连续的，相邻坐标的值相差很小；随机是离散的，相邻点之间没有关系。

## 哈希函数：伪随机的基础

Shader 没有 `Math.random()`。要生成随机数，需要自己写哈希函数：

```glsl
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
```

这个函数把二维坐标映射成一个 `[0, 1]` 的伪随机值。`fract` 取小数部分，相当于对 1 取模，用来制造混乱。不同输入给出不同的输出，但输出之间没有连续性。

## Value Noise

最简单的噪声：在整数格点上放随机值，中间用双线性插值平滑。

```glsl
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);     // 格点坐标
    vec2 f = fract(p);     // 格点内的位置 [0,1]

    // 四个角的随机值
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    // 平滑插值（Hermite 插值）
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float n = valueNoise(uv * 5.0);
    vec3 col = vec3(n);

    fragColor = vec4(col, 1.0);
}
```

`u = f * f * (3.0 - 2.0 * f)` 是 Hermite 插值多项式。它比线性插值更平滑——在格点处导数为零，避免了转折处的折痕。

`uv * 5.0` 控制噪声的缩放。乘得越大，噪声越密集（频率越高）。

## 分形噪声（FBM）

单层噪声只有一种尺度的细节。把多层不同频率和振幅的噪声叠加起来，就得到分形噪声（Fractal Brownian Motion）：

```glsl
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 5; i++) {
        value += amplitude * valueNoise(p * frequency);
        amplitude *= 0.5;    // 每层振幅减半
        frequency *= 2.0;    // 每层频率翻倍
    }

    return value;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float n = fbm(uv * 3.0);
    vec3 col = vec3(n);

    fragColor = vec4(col, 1.0);
}
```

每一层叫做一个"octave"（八度）。振幅每次减半、频率每次翻倍——这和音乐里的八度关系一样。层数越多，细节越丰富，但计算量也越大。5-6 层通常够用。

## Perlin Noise

Ken Perlin 在 1983 年提出的噪声算法。和 Value Noise 的区别：Perlin 不在格点放标量值，而是放梯度向量。每个点的噪声值由它到四个角的向量与该角梯度向量的点积插值得到。

```glsl
vec2 grad(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(vec2(p.x * p.y, p.x + p.y)) * 2.0 - 1.0;
}

float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    vec2 a = grad(i);
    vec2 b = grad(i + vec2(1.0, 0.0));
    vec2 c = grad(i + vec2(0.0, 1.0));
    vec2 d = grad(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
        mix(dot(a, f), dot(b, f - vec2(1.0, 0.0)), u.x),
        mix(dot(c, f - vec2(0.0, 1.0)), dot(d, f - vec2(1.0, 1.0)), u.x),
        u.y
    );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float n = perlinNoise(uv * 5.0) * 0.5 + 0.5; // 从 [-1,1] 映射到 [0,1]
    vec3 col = vec3(n);

    fragColor = vec4(col, 1.0);
}
```

Perlin Noise 的输出范围大约是 `[-0.7, 0.7]`，需要 `* 0.5 + 0.5` 映射到 `[0, 1]` 才能正常显示。

Perlin 相比 Value Noise 的优势：不容易出现轴对齐的"方块感"。梯度向量的引入让噪声具有旋转不变性。

## 用噪声做自然纹理

```glsl
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
        value += amplitude * perlinNoise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float n = fbm(uv * 4.0 + iTime * 0.3);

    // 用噪声驱动颜色
    vec3 col = mix(vec3(0.1, 0.2, 0.4), vec3(0.8, 0.9, 1.0), n * 0.5 + 0.5);

    // 叠加云层效果
    float clouds = smoothstep(0.0, 0.5, n * 0.5 + 0.5);
    col = mix(col, vec3(1.0), clouds * 0.6);

    fragColor = vec4(col, 1.0);
}
```

`iTime * 0.3` 让噪声随时间缓慢移动，产生云层飘动的效果。

## domain warping（域扭曲）

把噪声本身作为坐标的偏移量，再算一次噪声——结果会产生漩涡和扭曲：

```glsl
float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * perlinNoise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 第一层扭曲
    vec2 q = vec2(fbm(uv * 3.0), fbm(uv * 3.0 + vec2(5.2, 1.3)));

    // 第二层扭曲
    vec2 r = vec2(fbm(uv * 3.0 + 4.0 * q + vec2(1.7, 9.2)),
                  fbm(uv * 3.0 + 4.0 * q + vec2(8.3, 2.8)));

    float n = fbm(uv * 3.0 + 4.0 * r);

    vec3 col = mix(vec3(0.1, 0.2, 0.5), vec3(0.8, 0.6, 0.3), n * 0.5 + 0.5);

    fragColor = vec4(col, 1.0);
}
```

这是 Inigo Quilez 的经典域扭曲技巧。两次扭曲后产生的图案像大理石纹理或熔岩。

## 练习

1. 修改 FBM 的层数（从 2 到 8），观察细节变化。
2. 用 FBM 生成一个木纹纹理（提示：用噪声值对 `sin(距离)` 做偏移）。
3. 把域扭曲的代码加上时间偏移，让纹理缓慢流动。

## 参考答案

### 练习 1

2 层只有大块的模糊斑块；4 层开始有自然感；8 层细节丰富但性能开销大。通常 5-6 层是性价比最高的。

### 练习 2

```glsl
float dist = length(uv) * 20.0;
float wood = sin(dist + fbm(uv * 5.0) * 5.0) * 0.5 + 0.5;
vec3 col = mix(vec3(0.4, 0.2, 0.1), vec3(0.8, 0.6, 0.3), wood);
```

### 练习 3

在 `q` 和 `r` 的输入中加 `iTime * 0.1`：

```glsl
vec2 q = vec2(fbm(uv * 3.0 + iTime * 0.1), fbm(uv * 3.0 + vec2(5.2, 1.3) + iTime * 0.1));
```
