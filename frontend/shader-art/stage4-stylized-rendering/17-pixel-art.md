# 第 17 课：像素艺术——像素化、抖动、调色板限制

像素艺术的美感来自约束：有限的分辨率、有限的颜色。这节课用 Shader 把任何 3D 场景变成像素风格。

## 像素化

把 UV 坐标量化到低分辨率网格：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float pixelSize = 4.0; // 每个"像素"占 4×4 屏幕像素

    vec2 pixelCoord = floor(fragCoord / pixelSize) * pixelSize;
    vec2 uv = (pixelCoord + pixelSize * 0.5 - 0.5 * iResolution.xy) / iResolution.y;

    // 正常渲染逻辑...
    vec3 col = vec3(0.0);

    // 简单的 2D 形状作为演示
    float d = length(uv);
    float circle = smoothstep(0.3, 0.29, d);
    col = mix(vec3(0.1, 0.1, 0.2), vec3(0.9, 0.6, 0.3), circle);

    fragColor = vec4(col, 1.0);
}
```

`floor(fragCoord / pixelSize) * pixelSize` 把坐标对齐到像素网格。`pixelSize = 4` 意味着分辨率降为原来的 1/4。

注意 UV 的重新计算：`pixelCoord + pixelSize * 0.5` 取每个像素块的中心坐标，避免形状偏移。

## 调色板限制

把连续颜色映射到有限的调色板：

```glsl
vec3 nearestPalette(vec3 col, vec3[4] palette) {
    float minDist = 1000.0;
    vec3 nearest = palette[0];
    for (int i = 0; i < 4; i++) {
        float d = distance(col, palette[i]);
        if (d < minDist) {
            minDist = d;
            nearest = palette[i];
        }
    }
    return nearest;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // 像素化
    float pixelSize = 4.0;
    vec2 pixelCoord = floor(fragCoord / pixelSize) * pixelSize;
    vec2 uv = (pixelCoord + pixelSize * 0.5 - 0.5 * iResolution.xy) / iResolution.y;

    // 渲染
    float d = length(uv);
    float gradient = 1.0 - d;
    vec3 col = vec3(0.2, 0.4, 0.8) * gradient;

    // NES 风格调色板
    vec3[4] palette = vec3[4](
        vec3(0.0, 0.0, 0.0),
        vec3(0.5, 0.1, 0.1),
        vec3(0.9, 0.3, 0.2),
        vec3(1.0, 0.8, 0.6)
    );

    col = nearestPalette(col, palette);

    fragColor = vec4(col, 1.0);
}
```

逐像素遍历调色板，找到欧氏距离最近的颜色。4 色调色板是 Game Boy 的典型约束。

## 有序抖动

当调色板颜色太少时，纯色块之间的跳变太生硬。抖动（Dithering）用空间上的点密度模拟中间色——密集的点看起来更亮，稀疏的点看起来更暗。

有序抖动用一个阈值矩阵（Bayer 矩阵）：

```glsl
float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) { return bayer2(a * 0.5) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(a * 0.5) * 0.25 + bayer4(a); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float pixelSize = 2.0;
    vec2 pixelCoord = floor(fragCoord / pixelSize);

    vec2 uv = (pixelCoord * pixelSize + pixelSize * 0.5 - 0.5 * iResolution.xy) / iResolution.y;

    // 渲染
    float d = length(uv);
    float brightness = 1.0 - d * 1.2;

    // 抖动阈值
    float threshold = bayer8(pixelCoord) - 0.5;

    // 量化：加上抖动阈值后再量化
    float levels = 4.0; // 4 级灰度
    float col = floor(brightness * levels + threshold) / levels;

    fragColor = vec4(vec3(col), 1.0);
}
```

`bayer8` 产生 8×8 的 Bayer 矩阵值（`[0, 1]`）。减去 `0.5` 让它在 `[-0.5, 0.5]` 范围内振荡。加到亮度值上后量化——有些像素提前跳到下一档，有些延迟，产生过渡。

## 颜色抖动

抖动也适用于颜色：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float pixelSize = 3.0;
    vec2 pixelCoord = floor(fragCoord / pixelSize);
    vec2 uv = (pixelCoord * pixelSize + pixelSize * 0.5 - 0.5 * iResolution.xy) / iResolution.y;

    // 渲染
    vec3 col = vec3(0.0);
    float d = length(uv);
    col = mix(vec3(0.1, 0.2, 0.5), vec3(0.9, 0.7, 0.3), 1.0 - d);

    // 每个通道独立抖动
    float threshold = bayer8(pixelCoord) - 0.5;
    float levels = 6.0;
    col = floor(col * levels + threshold) / levels;

    fragColor = vec4(col, 1.0);
}
```

## CRT 效果

CRT 显示器有扫描线和像素间隙：

```glsl
vec3 crtEffect(vec3 col, vec2 fragCoord) {
    // 扫描线
    float scanline = sin(fragCoord.y * 3.14159) * 0.1 + 0.9;
    col *= scanline;

    // 像素间隙
    vec2 pixel = fract(fragCoord / 2.0);
    float gap = smoothstep(0.0, 0.1, pixel.x) * smoothstep(0.0, 0.1, pixel.y);
    col *= 0.8 + 0.2 * gap;

    // 边缘暗角
    vec2 uv = fragCoord / iResolution.xy - 0.5;
    col *= 1.0 - dot(uv, uv) * 0.5;

    // 色彩偏移（RGB 子像素）
    col.r *= smoothstep(0.0, 0.3, pixel.x);
    col.b *= smoothstep(1.0, 0.7, pixel.x);

    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // 先渲染场景
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float d = length(uv);
    vec3 col = mix(vec3(0.1, 0.15, 0.3), vec3(0.8, 0.5, 0.2), 1.0 - d * 1.5);

    // 应用 CRT 效果
    col = crtEffect(col, fragCoord);

    fragColor = vec4(col, 1.0);
}
```

扫描线用 `sin(y * π)` 产生——每隔一个像素明暗交替。RGB 子像素偏移模拟了 CRT 的彩色磷光条纹。

## 像素化 + 抖动 + 调色板限制组合

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // 1. 像素化
    float pixelSize = 3.0;
    vec2 pixelCoord = floor(fragCoord / pixelSize);

    // 2. 渲染
    vec2 uv = (pixelCoord * pixelSize + pixelSize * 0.5 - 0.5 * iResolution.xy) / iResolution.y;
    vec3 col = vec3(0.0);
    float d = length(uv);
    float angle = atan(uv.y, uv.x);
    col = mix(vec3(0.1, 0.15, 0.3), vec3(0.9, 0.6, 0.2), 1.0 - d * 1.2);
    col += vec3(0.3, 0.1, 0.4) * (sin(angle * 5.0 + iTime) * 0.5 + 0.5) * 0.3;

    // 3. 有序抖动
    float threshold = bayer8(pixelCoord) - 0.5;

    // 4. 调色板限制（每通道 4 级 = 64 色）
    float levels = 4.0;
    col = floor(col * levels + threshold) / levels;

    // 5. CRT 效果
    col = crtEffect(col, fragCoord);

    fragColor = vec4(col, 1.0);
}
```

## 练习

1. 实现一个 Game Boy 4 色绿色调色板。
2. 把 CRT 效果改成带弯曲的 CRT 屏幕（桶形畸变）。
3. 实现 Floyd-Steinberg 抖动的近似版本（误差扩散到相邻像素）。

## 参考答案

### 练习 1

```glsl
vec3[4] gameboyPalette = vec3[4](
    vec3(0.06, 0.22, 0.06),
    vec3(0.19, 0.38, 0.19),
    vec3(0.55, 0.67, 0.06),
    vec3(0.76, 0.82, 0.44)
);
```

### 练习 2

```glsl
vec2 barrelDistort(vec2 uv) {
    vec2 cc = uv - 0.5;
    float dist = dot(cc, cc);
    return uv + cc * dist * 0.15; // 桶形畸变
}

// 在 CRT 效果之前
vec2 crtUV = barrelDistort(fragCoord / iResolution.xy);
vec2 crtCoord = crtUV * iResolution.xy;
```

### 练习 3

Floyd-Steinberg 需要前一行的误差值。在 Shader 里做不到真正的逐像素依赖，但可以用纹理存储误差。近似做法：把右、下、右下三个方向的误差各扩散一小部分。
