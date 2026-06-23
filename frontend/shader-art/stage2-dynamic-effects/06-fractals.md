# 第 6 课：分形——Mandelbrot 集与 Julia 集

分形是一种自相似结构：放大后看到的图案和整体相似。Mandelbrot 集可能是最著名的分形图案——一个由简单迭代公式生成的无穷复杂图形。

这节课用 Fragment Shader 实时渲染 Mandelbrot 和 Julia 集。

## Mandelbrot 集的数学

对于复平面上的点 c，迭代计算：

```
z(0) = 0
z(n+1) = z(n)^2 + c
```

如果 `|z|` 始终不发散（不超过某个阈值），点 c 属于 Mandelbrot 集。

在 Shader 里，复数乘法用 `vec2` 表示：`(a + bi) * (c + di) = (ac - bd, ad + bc)`。

## 基础 Mandelbrot

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 映射到 Mandelbrot 集感兴趣的区域
    vec2 c = uv * 3.0 + vec2(-0.5, 0.0);

    vec2 z = vec2(0.0);
    float iter = 0.0;
    const int MAX_ITER = 100;

    for (int i = 0; i < MAX_ITER; i++) {
        // z = z^2 + c（复数乘法）
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (dot(z, z) > 4.0) break; // |z| > 2 发散
        iter += 1.0;
    }

    // 归一化迭代次数
    float t = iter / float(MAX_ITER);

    // 用调色板着色
    vec3 col = 0.5 + 0.5 * cos(3.0 + t * 15.0 + vec3(0.0, 0.6, 1.0));
    if (iter >= float(MAX_ITER)) col = vec3(0.0); // 集内为黑色

    fragColor = vec4(col, 1.0);
}
```

`dot(z, z) > 4.0` 等价于 `|z|^2 > 4`，即 `|z| > 2`。用 `dot` 比 `length` 省一次开方运算。

迭代次数 `iter` 决定了颜色——逃逸越早的点，颜色越亮。集内的点（永不发散）设为黑色。

## 平滑迭代计数

离散的迭代次数会导致明显的色带（color banding）。用连续的平滑计数消除它：

```glsl
// 在循环中把 z 的模长记录下来
for (int i = 0; i < MAX_ITER; i++) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 4.0) break;
    iter += 1.0;
}

// 平滑修正
if (iter < float(MAX_ITER)) {
    float log_zn = log(dot(z, z)) / 2.0; // log(|z|)
    float nu = log(log_zn / log(2.0)) / log(2.0);
    iter = iter + 1.0 - nu;
}

float t = iter / float(MAX_ITER);
```

这个修正利用了逃逸速度和迭代次数之间的对数关系，让颜色过渡变得连续平滑。

## Julia 集

Mandelbrot 的每个点 c 从 `z = 0` 开始迭代。Julia 集反过来：固定一个 c 值，让 z 取平面上每个点。

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec2 z = uv * 2.5;
    vec2 c = vec2(-0.7, 0.27015); // 固定的 Julia 参数

    float iter = 0.0;
    const int MAX_ITER = 100;

    for (int i = 0; i < MAX_ITER; i++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (dot(z, z) > 4.0) break;
        iter += 1.0;
    }

    float t = iter / float(MAX_ITER);
    vec3 col = 0.5 + 0.5 * cos(6.28318 * (t * 3.0 + vec3(0.0, 0.1, 0.2)));
    if (iter >= float(MAX_ITER)) col = vec3(0.0);

    fragColor = vec4(col, 1.0);
}
```

不同的 `c` 值产生完全不同的 Julia 集图案。经典参数：
- `(-0.7, 0.27015)`：兔形
- `(-0.8, 0.156)`：树枝状
- `(0.355, 0.355)`：螺旋
- `(-0.4, 0.6)`：树突

## 用鼠标交互切换 Julia 参数

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 鼠标位置映射到 Julia 参数
    vec2 c;
    if (iMouse.z > 0.0) {
        c = (iMouse.xy / iResolution.xy - 0.5) * 2.0;
    } else {
        c = vec2(-0.7, 0.27015);
    }

    vec2 z = uv * 2.5;
    float iter = 0.0;
    const int MAX_ITER = 100;

    for (int i = 0; i < MAX_ITER; i++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (dot(z, z) > 4.0) break;
        iter += 1.0;
    }

    float t = iter / float(MAX_ITER);
    vec3 col = 0.5 + 0.5 * cos(6.28318 * (t * 3.0 + vec3(0.0, 0.1, 0.2)));
    if (iter >= float(MAX_ITER)) col = vec3(0.0);

    fragColor = vec4(col, 1.0);
}
```

点击画面后拖动鼠标，Julia 集的形状会实时变化。你会发现：某些区域是连通的（类似 Mandelbrot 集的形状），另一些区域是碎裂的尘埃。这正是 Mandelbrot 集和 Julia 集的深层关系——Mandelbrot 集是 Julia 集的"地图"。

## 燃烧船分形

另一个有趣的分形，公式略有不同：

```glsl
z = vec2(abs(z.x), abs(z.y)); // 取绝对值
z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
```

`abs` 的引入打破了对称性，产生类似燃烧船的图案。试把 Mandelbrot 代码里的循环体替换成这两行，`c` 的映射改成 `uv * 3.0 + vec2(-1.5, -1.5)`。

## 练习

1. 把 Mandelbrot 的缩放级别提高 100 倍（缩小 `uv * 0.03`），观察自相似性。
2. 用时间 `iTime` 动态改变 Julia 参数 `c`，让 Julia 集"呼吸"。
3. 实现 Burning Ship 分形。

## 参考答案

### 练习 1

```glsl
vec2 c = uv * 0.03 + vec2(-1.75, 0.01);
```

放大后你会看到更小的 Mandelbrot 集副本，结构和整体自相似。如果要走得更深，需要增加 `MAX_ITER`，否则细节会被截断。

### 练习 2

```glsl
vec2 c = vec2(
    -0.7 + 0.1 * sin(iTime * 0.3),
    0.27 + 0.1 * cos(iTime * 0.5)
);
```

c 值在 Mandelbrot 集边缘附近移动时，Julia 集会从连通变为碎裂再变回连通。

### 练习 3

在循环内替换为：
```glsl
z = vec2(abs(z.x), abs(z.y));
z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
```
