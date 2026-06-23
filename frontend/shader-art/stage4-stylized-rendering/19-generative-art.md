# 第 19 课：生成艺术——算法艺术、参数化设计

生成艺术的核心：你写的不是画面，而是规则。规则运行后产生的画面是你无法完全预料的。这节课探索几种经典的算法艺术手法。

## 网格变形

在规则网格上做数学变形：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 基础网格
    vec2 grid = uv * 10.0;

    // 变形：用 sin 扭曲
    grid.x += sin(grid.y * 0.5 + iTime * 0.3) * 0.5;
    grid.y += sin(grid.x * 0.7 + iTime * 0.2) * 0.3;

    // 取模产生重复
    vec2 cell = fract(grid) - 0.5;

    // 在每个格子里画形状
    float d = length(cell);
    float shape = smoothstep(0.25, 0.24, d);

    // 边缘描边
    float ring = smoothstep(0.01, 0.0, abs(d - 0.25));

    vec3 col = vec3(0.0);
    col += vec3(0.9, 0.5, 0.3) * shape;
    col += vec3(0.2, 0.5, 0.8) * ring;

    fragColor = vec4(col, 1.0);
}
```

`sin(grid.y * 0.5)` 让每一行的偏移量不同，产生波浪变形。两个方向的 `sin` 叠加产生更复杂的扭曲。

## Voronoi 图案

Voronoi 把空间分成区域，每个区域围绕一个最近的"种子点"。自然界中的蜂巢、龟裂、细胞都是 Voronoi 图案。

```glsl
vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float voronoi(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);

    float minDist = 1.0;

    // 检查 3×3 邻域
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 neighbor = vec2(float(i), float(j));
            vec2 point = hash2(n + neighbor);
            point = 0.5 + 0.5 * sin(iTime * 0.5 + 6.28318 * point); // 动态
            vec2 diff = neighbor + point - f;
            float dist = length(diff);
            minDist = min(minDist, dist);
        }
    }

    return minDist;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float v = voronoi(uv * 8.0);

    // 边缘
    float edge = smoothstep(0.05, 0.04, abs(v - 0.05));

    vec3 col = vec3(0.0);
    col += vec3(0.9, 0.7, 0.4) * (1.0 - v * 2.0);
    col += vec3(0.1, 0.3, 0.7) * edge;

    fragColor = vec4(col, 1.0);
}
```

`0.5 + 0.5 * sin(...)` 让种子点在格子内缓慢移动。`minDist` 到最近种子的距离决定了颜色——离种子越近越亮。

## 反向 Voronoi（Worley Noise 的边缘变体）

只画 Voronoi 的边缘，产生蜂巢或裂纹效果：

```glsl
float voronoiEdge(vec2 p) {
    vec2 n = floor(p);
    vec2 f = fract(p);

    float minDist = 1.0;
    float secondDist = 1.0;

    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 neighbor = vec2(float(i), float(j));
            vec2 point = hash2(n + neighbor);
            point = 0.5 + 0.5 * sin(iTime * 0.3 + 6.28318 * point);
            float dist = length(neighbor + point - f);

            if (dist < minDist) {
                secondDist = minDist;
                minDist = dist;
            } else if (dist < secondDist) {
                secondDist = dist;
            }
        }
    }

    return secondDist - minDist; // 边缘处差值最大
}
```

`secondDist - minDist` 在两个 Voronoi 区域交界处最大（边缘），区域内接近 0。

## 参数化螺旋

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // 多层螺旋
    vec3 col = vec3(0.0);
    for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float spiral = sin(angle * (3.0 + fi) - r * (15.0 + fi * 5.0) + iTime * (0.5 + fi * 0.1));
        spiral *= exp(-r * (2.0 + fi * 0.5)); // 中心更浓

        vec3 spiralColor = 0.5 + 0.5 * cos(6.28318 * (fi / 5.0 + vec3(0.0, 0.33, 0.67)));
        col += spiralColor * spiral * 0.15;
    }

    col += vec3(0.05, 0.05, 0.1);

    fragColor = vec4(col, 1.0);
}
```

`sin(angle * N - r * K)` 产生对数螺旋。`N` 控制螺旋臂数量，`K` 控制缠绕密度。

## 递归细分

把空间递归分成小块，每块内做不同的操作：

```glsl
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec3 subdivPattern(vec2 uv, int depth) {
    vec3 col = vec3(0.0);

    for (int d = 0; d < 6; d++) {
        if (d >= depth) break;

        vec2 cell = floor(uv * 2.0);
        float h = hash(cell + float(d) * 100.0);

        // 每个格子随机选择操作
        if (h < 0.25) {
            // 对角线分割
            float diag = step(uv.x - floor(uv.x), uv.y - floor(uv.y));
            col += vec3(0.9, 0.6, 0.3) * diag * (1.0 / float(depth));
        } else if (h < 0.5) {
            // 圆形
            vec2 center = fract(uv) - 0.5;
            col += vec3(0.3, 0.7, 0.9) * smoothstep(0.3, 0.29, length(center)) * (1.0 / float(depth));
        }

        uv = fract(uv) * 2.0; // 缩小到子格子
    }

    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    vec3 col = subdivPattern(uv * 4.0, 5);

    fragColor = vec4(col, 1.0);
}
```

每次循环把 UV 乘以 2 再取 `fract`，相当于进入下一级细分。不同深度可以做不同的图案。

## 生长动画

用噪声和时间控制图案的"生长"过程：

```glsl
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p); p *= 2.0; a *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 生长前沿
    float growth = iTime * 0.2;
    float noise = fbm(uv * 3.0);

    // 在生长范围内显示图案
    float mask = smoothstep(growth - 0.1, growth, noise);

    // 图案内容
    float pattern = sin(uv.x * 20.0) * sin(uv.y * 20.0);
    vec3 col = mix(vec3(0.05, 0.05, 0.1), vec3(0.9, 0.5, 0.3), pattern * mask);

    // 生长边缘发光
    float edge = smoothstep(0.0, 0.05, abs(noise - growth));
    col += vec3(0.3, 0.6, 1.0) * (1.0 - edge) * 0.5;

    fragColor = vec4(col, 1.0);
}
```

`noise(uv * 3.0)` 产生一个空间噪声场。`growth` 随时间增大，`mask` 从噪声值低的区域开始"生长"。边缘处有发光效果。

## 练习

1. 修改 Voronoi 的距离函数：用曼哈顿距离（`abs(x) + abs(y)`）替代欧氏距离。
2. 在螺旋图案里加入径向脉冲（每过一段时间，螺旋向外扩散一次）。
3. 用递归细分实现一个 Mondrian 风格的矩形分割画。

## 参考答案

### 练习 1

```glsl
float dist = abs(diff.x) + abs(diff.y); // 替换 length(diff)
```

曼哈顿距离产生菱形的 Voronoi 区域。

### 练习 2

```glsl
float pulse = sin(r * 10.0 - iTime * 3.0);
pulse *= exp(-abs(pulse) * 5.0); // 只保留脉冲附近的亮线
spiral += pulse * 0.2;
```

### 练习 3

```glsl
// 在递归中用 h 值决定是分割还是填色
if (h < 0.4) {
    // 填色
    vec3[5] mondrianColors = vec3[5](
        vec3(0.9, 0.2, 0.1), vec3(0.1, 0.2, 0.8),
        vec3(0.9, 0.8, 0.1), vec3(0.95), vec3(0.05)
    );
    col = mondrianColors[int(h * 25.0) % 5];
    break; // 停止细分
}
```
