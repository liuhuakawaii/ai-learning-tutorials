# 第 16 课：卡通渲染——描边、色阶、高光的 NPR 技术

NPR（Non-Photorealistic Rendering）追求的不是真实，而是风格。卡通渲染（Toon / Cel Shading）的核心特征：硬边色块、明确的描边、简化的高光。

## 色阶化

标准光照产生连续渐变。卡通渲染把它离散化——用 `step` 把光照值分成几档：

```glsl
float sdSphere(vec3 p, float r) { return length(p) - r; }

float map(vec3 p) { return sdSphere(p, 0.8); }

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -2.5);
    vec3 rd = normalize(vec3(uv, 1.5));

    float t = 0.0;
    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001) break;
        if (t > 20.0) break;
        t += d;
    }

    vec3 col = vec3(0.0);

    if (t < 20.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 lightDir = normalize(vec3(0.5, 0.8, -0.6));
        float diff = max(dot(n, lightDir), 0.0);

        // 色阶化：3 档
        float shade = smoothstep(0.0, 0.01, diff) * 0.5
                    + smoothstep(0.4, 0.41, diff) * 0.3
                    + smoothstep(0.8, 0.81, diff) * 0.2;

        vec3 baseColor = vec3(0.9, 0.5, 0.3);
        col = baseColor * (0.2 + shade);
    }

    fragColor = vec4(col, 1.0);
}
```

每个 `smoothstep` 产生一个阶梯——从 0 跳到 0.5、再跳到 0.3、再跳到 0.2。叠加后就是三档明暗。

更简洁的做法是直接量化：

```glsl
float shade = floor(diff * 4.0) / 4.0;
```

把 `[0, 1]` 分成 4 个等间距的阶梯。

## 描边

### 方法一：法线 × 视线

当法线和视线接近垂直时（`dot(n, v) ≈ 0`），说明在物体边缘——这就是描边的位置：

```glsl
float edge = 1.0 - abs(dot(n, normalize(-rd)));
float outline = smoothstep(0.0, 0.15, edge);
col *= outline; // 边缘变暗
```

`-rd` 是从表面指向摄像机的方向。`abs` 保证无论法线朝哪边都能检测到边缘。

### 方法二：SDF 描边（后处理）

用相邻像素的 SDF 值差异检测边缘：

```glsl
// 在 Ray March 循环之后
float t2 = 0.0;
for (int i = 0; i < 80; i++) {
    vec3 p2 = ro + rd * t2;
    float d = map(p2);
    if (d < 0.001) break;
    if (t2 > 20.0) break;
    t2 += d;
}

// 检查相邻像素的深度差异
vec2 eps = vec2(0.002, 0.0);
float tL = 0.0, tR = 0.0, tU = 0.0, tD = 0.0;
// 对四个方向分别做 ray march...
// 深度差异大 = 边缘
```

这个方法成本高（每像素要多次 ray march）。更实用的做法是用后处理 pass。

### 方法三：SDF 距离阈值

最简单的描边——在 SDF 值恰好在某个范围内时变暗：

```glsl
float d = map(p);
// 物体表面附近的一个薄层
float outline = smoothstep(0.01, 0.015, d) - smoothstep(0.015, 0.02, d);
col = mix(col, vec3(0.0), outline);
```

## 卡通高光

真实高光用 `pow(spec, shininess)` 产生平滑过渡。卡通高光用 `step` 切出硬边：

```glsl
vec3 halfDir = normalize(lightDir + normalize(-rd));
float spec = pow(max(dot(n, halfDir), 0.0), 32.0);
float toonSpec = step(0.5, spec); // 硬边阈值
col += vec3(1.0) * toonSpec * 0.5;
```

## 完整卡通渲染

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -2.5);
    vec3 rd = normalize(vec3(uv, 1.5));

    float t = 0.0;
    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001) break;
        if (t > 20.0) break;
        t += d;
    }

    vec3 col = vec3(0.9, 0.85, 0.8); // 背景

    if (t < 20.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 v = normalize(-rd);
        vec3 lightDir = normalize(vec3(0.5, 0.8, -0.6));

        // 漫反射色阶
        float diff = max(dot(n, lightDir), 0.0);
        float shade = 0.2 + 0.3 * step(0.1, diff) + 0.3 * step(0.5, diff);

        vec3 baseColor = vec3(0.9, 0.4, 0.3);
        col = baseColor * shade;

        // 描边
        float edge = 1.0 - abs(dot(n, v));
        float outline = smoothstep(0.0, 0.2, edge);
        col *= 1.0 - outline * 0.8;

        // 卡通高光
        vec3 halfDir = normalize(lightDir + v);
        float spec = pow(max(dot(n, halfDir), 0.0), 32.0);
        col += vec3(1.0) * step(0.5, spec) * 0.4;

        // 阴影
        float shadow = 1.0;
        vec3 sp = p + n * 0.01;
        float st = 0.02;
        for (int i = 0; i < 24; i++) {
            float sd = map(sp + lightDir * st);
            if (sd < 0.001) { shadow = 0.0; break; }
            st += sd;
            if (st > 10.0) break;
        }
        col *= 0.3 + 0.7 * shadow;
    }

    fragColor = vec4(col, 1.0);
}
```

## Rim Light（边缘光）

物体轮廓边缘加一圈亮光，增加立体感：

```glsl
float rim = 1.0 - max(dot(n, v), 0.0);
rim = smoothstep(0.4, 0.8, rim);
col += vec3(0.3, 0.5, 0.8) * rim * 0.5;
```

## 练习

1. 把 3 档色阶改成 5 档，观察区别。
2. 给描边加一个可调宽度参数。
3. 实现双色卡通渲染：亮面用暖色，暗面用冷色（不是暗色）。

## 参考答案

### 练习 1

```glsl
float shade = floor(diff * 5.0) / 5.0;
```

5 档比 3 档过渡更细腻，但仍然有明显的色块分界。档数越多越接近真实光照。

### 练习 2

```glsl
float outlineWidth = 0.2; // 可调
float edge = 1.0 - abs(dot(n, v));
float outline = smoothstep(0.0, outlineWidth, edge);
```

### 练习 3

```glsl
vec3 warmColor = vec3(0.9, 0.5, 0.3);
vec3 coolColor = vec3(0.3, 0.4, 0.7);
float shade = step(0.3, diff);
vec3 baseColor = mix(coolColor, warmColor, shade);
```
