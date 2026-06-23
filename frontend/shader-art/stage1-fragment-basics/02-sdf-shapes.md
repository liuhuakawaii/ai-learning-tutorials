# 第 2 课：形状绘制——SDF 有符号距离场

上节课用 `smoothstep` 和坐标比较画了简单分界线。但如果你要画一个圆、一个矩形、甚至做布尔运算，靠坐标比较会越来越复杂。

SDF（Signed Distance Field）是 Shader 画形状的标准方式。Inigo Quilez 在 [iquilezles.org/articles/distfunctions2d](https://iquilezles.org/articles/distfunctions2d/) 整理了几乎所有 2D SDF 公式，强烈建议收藏。

## SDF 是什么

SDF 给平面上每个点返回一个数值：该点到形状边界的距离。符号表示点在形状内部还是外部：

- **负值**：点在形状内部
- **零**：点在形状边界上
- **正值**：点在形状外部

有了这个数值，画形状就变成了一步操作：把 SDF 值通过 `smoothstep` 映射成颜色。

## 画一个圆

```glsl
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float d = sdCircle(uv, 0.3);

    float mask = smoothstep(0.005, -0.005, d);

    vec3 col = mix(vec3(0.15, 0.15, 0.25), vec3(0.9, 0.6, 0.3), mask);

    fragColor = vec4(col, 1.0);
}
```

注意 `smoothstep` 的参数顺序：`(0.005, -0.005, d)` 是**反的**。当 `d = -0.3`（圆心附近）时，`d` 比两个边界都小，`smoothstep` 返回 1；当 `d = 0.3`（远处）时，返回 0。反向 `smoothstep` 的意思是：距离越小（越靠近形状），输出越亮。

`length(uv)` 计算的是 `uv` 到原点的距离。减去半径 `r` 就是到圆边界的距离。

## 画一个矩形

```glsl
float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float d = sdBox(uv, vec2(0.3, 0.2));

    float mask = smoothstep(0.005, -0.005, d);

    vec3 col = mix(vec3(0.1, 0.1, 0.2), vec3(0.3, 0.8, 0.5), mask);

    fragColor = vec4(col, 1.0);
}
```

`sdBox` 的公式看起来复杂，但逻辑很清晰：

1. `abs(p) - b`：把点对称到第一象限，减去矩形半尺寸。结果为负说明在矩形范围内。
2. `max(d, 0.0)`：外部点取到边界的距离向量，内部点归零。
3. `length(...)`：外部点的距离。
4. `+ min(max(d.x, d.y), 0.0)`：修正内部点的距离，保证 SDF 在内部为负。

## 布尔运算

SDF 最大的优势：形状之间的布尔运算只需要对距离值做 `min` / `max`。

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float dCircle = sdCircle(uv, 0.25);
    float dBox = sdBox(uv, vec2(0.2, 0.15));

    // 并集：取两个距离的最小值
    float dUnion = min(dCircle, dBox);

    // 交集：取两个距离的最大值
    float dIntersect = max(dCircle, dBox);

    // 差集：B 的补集与 A 的交集
    float dSubtract = max(dCircle, -dBox);

    // 用 uv.x 选择显示哪个
    float d;
    if (uv.x < -0.4) {
        d = dUnion;
    } else if (uv.x < 0.0) {
        d = dIntersect;
    } else if (uv.x < 0.4) {
        d = dSubtract;
    } else {
        d = dCircle;
    }

    float mask = smoothstep(0.005, -0.005, d);
    vec3 col = mix(vec3(0.1, 0.1, 0.2), vec3(0.9, 0.7, 0.3), mask);

    fragColor = vec4(col, 1.0);
}
```

并集、交集、差集——三个经典布尔操作，全部靠 `min` 和 `max` 完成。这就是 SDF 的核心优势。

## 画一条线段

线段的 SDF 不是画一个细长的矩形，而是直接算点到线段的距离：

```glsl
float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float d = sdSegment(uv, vec2(-0.3, -0.2), vec2(0.3, 0.2));

    float mask = smoothstep(0.008, -0.008, d);
    vec3 col = mix(vec3(0.1), vec3(1.0, 0.8, 0.2), mask);

    fragColor = vec4(col, 1.0);
}
```

`clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)` 计算的是点 p 在线段 ab 上的投影比例，限制在 `[0, 1]` 保证不超出线段两端。

## 形状变换

移动形状：把坐标减去目标位置。旋转形状：用旋转矩阵变换坐标。

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 旋转 45 度
    float angle = 3.14159 / 4.0;
    float s = sin(angle);
    float c = cos(angle);
    uv = mat2(c, -s, s, c) * uv;

    // 平移到 (0.1, 0.1)
    uv -= vec2(0.1, 0.1);

    float d = sdBox(uv, vec2(0.2, 0.1));
    float mask = smoothstep(0.005, -0.005, d);

    vec3 col = mix(vec3(0.1), vec3(0.6, 0.3, 0.8), mask);

    fragColor = vec4(col, 1.0);
}
```

记住：移动形状是减去位置（坐标向相反方向移动）。先旋转再平移，形状就会在旋转后的位置出现。

## 用距离做描边

SDF 值本身就是到边界的距离，所以描边只需要判断"在边界附近"：

```glsl
float ring = abs(sdCircle(uv, 0.25)) - 0.02;
float mask = smoothstep(0.005, -0.005, ring);
```

`abs(sdCircle(...))` 把内部负值翻转为正值，整个空间变成"到边界的绝对距离"。减去 `0.005` 意味着只有距边界 0.02 以内的区域才会亮，形成一个圆环。

## 练习

1. 画一个带描边的圆环：外圆半径 0.3，描边宽度 0.02。
2. 用布尔运算画一个月牙形（两个圆的差集）。
3. 画一个十字形（两个矩形的并集）。

## 参考答案

### 练习 1

```glsl
float d = abs(sdCircle(uv, 0.3)) - 0.02;
float mask = smoothstep(0.005, -0.005, d);
```

### 练习 2

```glsl
float d1 = sdCircle(uv, 0.3);
float d2 = sdCircle(uv - vec2(0.15, 0.0), 0.25);
float moon = max(d1, -d2); // 大圆减去偏移的小圆
float mask = smoothstep(0.005, -0.005, moon);
```

### 练习 3

```glsl
float d1 = sdBox(uv, vec2(0.08, 0.3));
float d2 = sdBox(uv, vec2(0.3, 0.08));
float cross = min(d1, d2); // 两个矩形取并集
float mask = smoothstep(0.005, -0.005, cross);
```
