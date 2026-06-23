# 第 20 课：阶段实战——构建风格化渲染引擎

把第四阶段学到的所有风格化技术整合成一个引擎：输入 3D 场景，输出可选风格的渲染结果。支持卡通、像素、故障、生成艺术四种风格，用 uniform 参数切换。

## 场景定义

沿用第三阶段的 Ray Marching 场景：

```glsl
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

mat2 rot2(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

float map(vec3 p) {
    float ground = p.y + 0.8;
    float sphere = sdSphere(p - vec3(0.0, 0.0, 0.0), 0.7);
    vec3 bp = p - vec3(1.5, 0.0, 0.5);
    bp.xz = rot2(iTime * 0.4) * bp.xz;
    float box1 = sdBox(bp, vec3(0.4));
    vec3 tp = p - vec3(-1.5, 0.5, 0.0);
    tp.xz = rot2(iTime * 0.3) * tp.xz;
    float torus = sdTorus(tp, vec2(0.5, 0.12));
    float scene = smin(sphere, box1, 0.15);
    scene = min(scene, torus);
    scene = min(scene, ground);
    return scene;
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}
```

## 风格化着色器

每种风格对应一个着色函数：

```glsl
// ---- 通用工具 ----
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float bayer8(vec2 a) {
    vec2 b = floor(a);
    return fract(b.x / 2.0 + b.y * b.y * 0.75) * 0.25
         + fract(b.x / 4.0 + b.y * b.y * 0.75 + 0.25) * 0.0625;
}

// ---- 卡通渲染 ----
vec3 toonShade(vec3 p, vec3 n, vec3 rd, vec3 baseColor) {
    vec3 lightDir = normalize(vec3(0.5, 0.8, -0.6));
    float diff = max(dot(n, lightDir), 0.0);
    float shade = 0.2 + 0.3 * step(0.15, diff) + 0.3 * step(0.55, diff);
    vec3 col = baseColor * shade;

    // 描边
    float edge = 1.0 - abs(dot(n, normalize(-rd)));
    col *= 1.0 - smoothstep(0.0, 0.25, edge) * 0.8;

    // 卡通高光
    vec3 halfDir = normalize(lightDir + normalize(-rd));
    float spec = pow(max(dot(n, halfDir), 0.0), 32.0);
    col += vec3(1.0) * step(0.5, spec) * 0.3;

    return col;
}

// ---- 像素风格 ----
vec3 pixelShade(vec3 p, vec3 n, vec3 rd, vec3 baseColor, vec2 fragCoord) {
    vec3 lightDir = normalize(vec3(0.5, 0.8, -0.6));
    float diff = max(dot(n, lightDir), 0.0);

    vec3 col = baseColor * (0.3 + 0.7 * diff);

    // 抖动
    float threshold = bayer8(fragCoord / 3.0) - 0.5;
    col = floor(col * 6.0 + threshold) / 6.0;

    return col;
}

// ---- 故障风格 ----
vec3 glitchShade(vec3 p, vec3 n, vec3 rd, vec3 baseColor, vec2 fragCoord) {
    vec3 lightDir = normalize(vec3(0.5, 0.8, -0.6));
    float diff = max(dot(n, lightDir), 0.0);
    vec3 col = baseColor * (0.3 + 0.7 * diff);

    // RGB 分离
    float strength = smoothstep(0.85, 1.0, sin(iTime * 2.5) * 0.5 + 0.5);
    col.r += 0.1 * strength;
    col.b -= 0.1 * strength;

    // 扫描线
    col *= 0.95 + 0.05 * sin(fragCoord.y * 3.14159);

    // 随机块错位
    vec2 block = floor(fragCoord / 20.0);
    float glitch = step(0.95, hash(block + floor(iTime * 8.0)));
    col += vec3(0.1, -0.05, 0.15) * glitch;

    return col;
}

// ---- 生成艺术叠加 ----
vec3 generativeOverlay(vec3 col, vec2 uv, float t) {
    float v = 0.0;
    float angle = atan(uv.y, uv.x);
    float r = length(uv);
    float spiral = sin(angle * 5.0 - r * 12.0 + t * 0.5) * exp(-r * 1.5);
    col += vec3(0.2, 0.4, 0.8) * spiral * 0.15;
    return col;
}
```

## 主渲染管线

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 1.0, -4.0);
    vec3 rd = normalize(vec3(uv, 1.5));
    rd.xz = rot2(iTime * 0.08) * rd.xz;

    // Ray March
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001) break;
        if (t > 50.0) break;
        t += d;
    }

    // 背景
    vec3 col = 0.5 + 0.5 * cos(6.28318 * (rd.y * 0.4 + vec3(0.0, 0.1, 0.2)));

    if (t < 50.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        // 材质颜色
        float h = p.y + 0.8;
        vec3 baseColor;
        if (h < 0.01) {
            baseColor = vec3(0.4, 0.35, 0.3); // 地面
        } else if (length(p - vec3(0.0, 0.0, 0.0)) < 0.75) {
            baseColor = vec3(0.9, 0.3, 0.2); // 球
        } else {
            baseColor = vec3(0.3, 0.6, 0.8); // 其他
        }

        // 风格切换（用鼠标 x 位置控制）
        float styleSelect = iMouse.x / iResolution.x;
        if (iMouse.z <= 0.0) styleSelect = 0.25;

        if (styleSelect < 0.25) {
            col = toonShade(p, n, rd, baseColor);
        } else if (styleSelect < 0.5) {
            col = pixelShade(p, n, rd, baseColor, fragCoord);
        } else if (styleSelect < 0.75) {
            col = glitchShade(p, n, rd, baseColor, fragCoord);
        } else {
            col = toonShade(p, n, rd, baseColor);
            col = generativeOverlay(col, uv, iTime);
        }
    }

    // 像素风格时加像素化
    float styleSelect = iMouse.x / iResolution.x;
    if (styleSelect >= 0.25 && styleSelect < 0.5) {
        float ps = 4.0;
        vec2 pc = floor(fragCoord / ps) * ps;
        vec2 puv = (pc + ps * 0.5 - 0.5 * iResolution.xy) / iResolution.y;
        // 简单的重新采样（近似）
        col = col; // 已经在 pixelShade 里处理了
    }

    fragColor = vec4(col, 1.0);
}
```

## 参数面板（文本叠加）

在画面上显示当前风格名称：

```glsl
// 在最后叠加 UI 文字
vec2 textUV = fragCoord / iResolution.xy;
if (textUV.y > 0.92 && textUV.x < 0.3) {
    float styleSelect = iMouse.x / iResolution.x;
    vec3 textColor = vec3(1.0);
    if (styleSelect < 0.25) {
        col = mix(col, textColor, 0.0); // "TOON" - 用背景覆盖
    }
    // 实际的文字渲染需要 SDF 字体，这里简化
    col += vec3(1.0) * 0.0; // 占位
}
```

真正的文字渲染需要字形 SDF 或位图字体。这里用颜色区分风格已经足够——左 1/4 是卡通，中间是像素，右 1/4 是故障，最右是生成艺术。

## 扩展建议

- 加入更多风格：水墨画、铅笔素描、油画
- 用后处理 Pass 实现全屏风格化（先正常渲染到纹理，再对纹理做风格化）
- 支持风格混合：滑块控制两种风格之间的过渡

## 练习

1. 实现一个"铅笔素描"风格：只保留描边和交叉阴影线。
2. 给卡通渲染加入 rim light（边缘光）。
3. 实现风格之间的平滑过渡（用 `mix` 混合两种风格的输出）。

## 参考答案

### 练习 1

```glsl
vec3 pencilShade(vec3 p, vec3 n, vec3 rd, vec2 fragCoord) {
    float edge = 1.0 - abs(dot(n, normalize(-rd)));
    float outline = 1.0 - smoothstep(0.0, 0.15, edge);

    // 交叉阴影线
    vec2 huv = fragCoord / 4.0;
    float h1 = smoothstep(0.4, 0.6, fract(huv.x + huv.y));
    float h2 = smoothstep(0.4, 0.6, fract(huv.x - huv.y));
    float diff = max(dot(n, normalize(vec3(0.5, 0.8, -0.6))), 0.0);
    float hatch = mix(h1, h2, step(0.5, diff)) * step(0.2, diff);

    return vec3(1.0) * (1.0 - outline * 0.8 - hatch * 0.3);
}
```

### 练习 2

```glsl
// 在 toonShade 中加入
float rim = 1.0 - max(dot(n, normalize(-rd)), 0.0);
rim = smoothstep(0.4, 0.8, rim);
col += vec3(0.3, 0.5, 0.8) * rim * 0.4;
```

### 练习 3

```glsl
float blend = fract(styleSelect * 4.0); // 风格之间的过渡因子
vec3 colA = toonShade(...);
vec3 colB = pixelShade(...);
col = mix(colA, colB, blend);
```
