# SDF 与 Ray Marching

## 场景引入

传统的 3D 渲染依赖三角形网格——用成千上万个小三角形逼近曲面。但有一种完全不同的渲染方式：直接用数学公式描述形状，然后用光线步进（Ray Marching）找到光线与形状的交点。这就是 SDF（Signed Distance Field，有符号距离场）与 Ray Marching 技术。它不需要任何几何数据，纯粹靠数学运算就能渲染出复杂的 3D 场景，是 Shader 编程中最具魅力的技术之一。

## 学习目标

1. 理解 SDF 的数学定义和基本形状的 SDF 公式
2. 掌握 SDF 的布尔运算（并集、交集、差集、平滑操作）
3. 理解 Ray Marching 的步进算法原理
4. 学会使用有限差分法计算法线和实现 AO

---

## 一、SDF 基本形状

### 1.1 什么是 SDF？

SDF 是一个函数，输入空间中的任意点，输出该点到最近表面的距离。**负值**表示点在形状内部，**正值**表示在外部。

```
SDF 的几何含义：

           外部 (d > 0)
              │
    ┌─────────┼─────────┐
    │         │         │
    │    ●────┼────●    │  ● = 采样点
    │    │    │    │    │  d = 到表面的距离
    │    │    │    │    │
    │    │  表面 │    │    │  表面 (d = 0)
    │    │  (d=0)  │    │
    │    ●────┼────●    │
    │         │         │
    └─────────┼─────────┘
              │
           内部 (d < 0)
```

### 1.2 基本形状的 SDF 公式

```glsl
// 球体：到原点的距离减去半径
float sdSphere(vec3 p, float radius) {
    return length(p) - radius;
}

// 盒子：到盒子表面的有符号距离
float sdBox(vec3 p, vec3 halfSize) {
    vec3 q = abs(p) - halfSize;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// 圆环（Torus）
float sdTorus(vec3 p, vec2 t) {
    // t.x = 大半径，t.y = 小半径
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

// 无限圆柱
float sdCylinder(vec3 p, float r) {
    return length(p.xz) - r;
}

// 胶囊（Capsule）
float sdCapsule(vec3 p, float h, float r) {
    p.y -= clamp(p.y, 0.0, h);
    return length(p) - r;
}

// 圆锥
float sdCone(vec3 p, vec2 c) {
    // c = (cos(angle), sin(angle))
    vec2 q = vec2(length(p.xz), -p.y);
    float d = dot(q, c);
    return max(d, 0.0);
}
```

**SDF 形状图解**：

```
球体 sdSphere              盒子 sdBox              圆环 sdTorus

      ╭───╮                ┌───────┐              ╭───────╮
    ╭─┤   ├─╮            ╭─┤       ├─╮          ╭─┤       ├─╮
   │  │   │  │          │  │       │  │        │  │  ╭─╮  │  │
   │  │ ● │  │          │  │   ●   │  │        │  │  │ │  │  │
   │  │   │  │          │  │       │  │        │  │  ╰─╯  │  │
    ╰─┤   ├─╯            ╰─┤       ├─╯          ╰─┤       ├─╯
      ╰───╯                └───────┘              ╰───────╯

p 到中心距离 - r          p 到表面的              大圆到小圆
                          有符号距离              的有符号距离
```

---

## 二、SDF 布尔运算

### 2.1 基本布尔操作

```glsl
// 并集（Union）：取两个形状的最小距离
float opUnion(float d1, float d2) {
    return min(d1, d2);
}

// 交集（Intersection）：取两个形状的最大距离
float opIntersection(float d1, float d2) {
    return max(d1, d2);
}

// 差集（Subtraction）：从 d1 中减去 d2
float opSubtraction(float d1, float d2) {
    return max(d1, -d2);
}
```

**布尔运算图解**：

```
并集 (Union)              交集 (Intersection)       差集 (Subtraction)

  ┌───┐ ┌───┐            ┌───┐ ┌───┐             ┌───┐ ┌───┐
  │ A │ │ B │            │ A │ │ B │             │ A │ │ B │
  │   ├─┤   │            │   ├─┤   │             │   ├─┤   │
  │   │█│   │            │   │█│   │             │   │▓│   │
  │   ├─┤   │            │   ├─┤   │             │   ├─┤   │
  └───┘ └───┘            └───┘ └───┘             └───┘ └───┘
  A ∪ B (填充区域)        A ∩ B (重叠部分)         A - B (A 减去 B)
```

### 2.2 平滑布尔操作

硬边布尔运算会产生尖锐的接缝，平滑版本通过混合距离实现圆滑过渡：

```glsl
// 平滑并集
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// 平滑交集
float opSmoothIntersection(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
}

// 平滑差集
float opSmoothSubtraction(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d1, -d2, h) + k * h * (1.0 - h);
}
```

**平滑效果对比**：

```
硬边并集                    平滑并集 (k=0.2)

  ┌───┐ ┌───┐              ╭───╮ ╭───╮
  │   ├─┤   │              │   ╰─╯   │
  │   │█│   │              │   ╭─╮   │
  │   ├─┤   │              │   ╰─╯   │
  └───┘ └───┘              ╰───╯ ╰───╯
  尖锐接缝                   圆滑过渡
```

---

## 三、Ray Marching 原理

### 3.1 核心算法

Ray Marching 是从相机发射光线，沿光线方向步进，直到找到与表面的交点：

```
Ray Marching 步进过程：

相机位置
    ◉
    │╲
    │ ╲ 光线方向
    │  ╲
    │   ●─── 步进 1：d1 = 3.2（安全距离）
    │    ╲
    │     ●─── 步进 2：d2 = 1.8
    │      ╲
    │       ●─── 步进 3：d3 = 0.5（接近表面）
    │        ╲
    │         ●─── 步进 4：d4 = 0.01（命中！）
    │          ╲
    │           │ 表面
    └───────────┴──────────────────

每次步进距离 = 当前点到最近表面的 SDF 值
这样保证不会穿过表面（因为 SDF 是到表面的最小距离）
```

### 3.2 基础实现

```glsl
// 场景 SDF
float sceneSDF(vec3 p) {
    float sphere = sdSphere(p - vec3(0.0, 0.0, -3.0), 1.0);
    float box = sdBox(p - vec3(2.0, 0.0, -4.0), vec3(0.8));
    float torus = sdTorus(p - vec3(-2.0, 0.0, -3.5), vec2(1.0, 0.3));
    return min(sphere, min(box, torus));
}

// Ray Marching
float rayMarch(vec3 ro, vec3 rd, float maxDist, int maxSteps) {
    float t = 0.0;  // 当前步进距离

    for (int i = 0; i < maxSteps; i++) {
        vec3 p = ro + rd * t;  // 当前采样点
        float d = sceneSDF(p);  // 到最近表面的距离

        if (d < 0.001) {
            // 命中表面
            return t;
        }

        t += d;  // 步进 SDF 距离

        if (t > maxDist) {
            // 超过最大距离，未命中
            break;
        }
    }

    return -1.0;  // 未命中
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

    // 相机设置
    vec3 ro = vec3(0.0, 0.0, 0.0);  // 相机位置
    vec3 rd = normalize(vec3(uv, -1.0));  // 光线方向

    // 步进
    float t = rayMarch(ro, rd, 50.0, 100);

    vec3 color;
    if (t > 0.0) {
        // 命中：计算光照
        vec3 p = ro + rd * t;
        vec3 normal = calculateNormal(p);
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        float diff = max(dot(normal, lightDir), 0.0);
        color = vec3(0.8, 0.3, 0.2) * (0.2 + 0.8 * diff);
    } else {
        // 未命中：背景色
        color = vec3(0.1, 0.1, 0.15);
    }

    gl_FragColor = vec4(color, 1.0);
}
```

---

## 四、法线计算（有限差分）

### 4.1 原理

SDF 没有显式的法线数据，但可以通过**有限差分法**近似计算梯度，梯度方向就是法线方向：

```
有限差分法计算法线：

在点 P 附近采样 6 个点（±x, ±y, ±z），计算梯度：

     P+dx
       ●
       │
  P-dx ●─● P    gradient = (SDF(P+dx) - SDF(P-dx),
       │              SDF(P+dy) - SDF(P-dy),
       ●              SDF(P+dz) - SDF(P-dz))
     P-dy

  normal = normalize(gradient)
```

### 4.2 实现

```glsl
vec3 calculateNormal(vec3 p) {
    float eps = 0.001;
    vec2 h = vec2(eps, 0.0);

    return normalize(vec3(
        sceneSDF(p + h.xyy) - sceneSDF(p - h.xyy),  // ∂SDF/∂x
        sceneSDF(p + h.yxy) - sceneSDF(p - h.yxy),  // ∂SDF/∂y
        sceneSDF(p + h.yyx) - sceneSDF(p - h.yyx)   // ∂SDF/∂z
    ));
}
```

**法线可视化**：

```glsl
// 将法线映射到颜色
vec3 normalColor = calculateNormal(p) * 0.5 + 0.5;
gl_FragColor = vec4(normalColor, 1.0);

// 法线方向 → 颜色映射：
// +X → 红色    -X → 青色
// +Y → 绿色    -Y → 品红
// +Z → 蓝色    -Z → 黄色
```

---

## 五、环境光遮蔽（AO）

### 5.1 原理

AO 近似计算表面点被周围几何体遮挡的程度，增加视觉深度：

```
AO 原理：

在表面点 P 沿法线方向采样多个点，
如果附近的 SDF 值较小，说明被遮挡：

     法线方向
        ↑
        │
    ●───●───●  采样点（SDF 值小 → 被遮挡）
        │
        │
    ────●────  表面点 P
        │
    ═══════════ 表面

AO = 1.0 - Σ (半径 - SDF) / 半径 × 衰减
```

### 5.2 实现

```glsl
float calculateAO(vec3 p, vec3 normal) {
    float ao = 0.0;
    float scale = 1.0;

    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i);  // 采样距离
        float d = sceneSDF(p + normal * h);
        ao += (h - d) * scale;
        scale *= 0.7;  // 衰减系数
    }

    return 1.0 - clamp(ao, 0.0, 1.0);
}

// 使用示例
float ao = calculateAO(p, normal);
color *= ao;  // AO 作为亮度乘数
```

**AO 效果对比**：

```
无 AO                           有 AO

┌─────────────────┐            ┌─────────────────┐
│                 │            │░░░              │
│   ┌─────┐      │            │░░┌─────┐      │
│   │     │      │            │░░│▓▓▓▓▓│      │
│   │     │      │            │░░│▓▓▓▓▓│      │
│   └─────┘      │            │░░└─────┘      │
│                 │            │░░░              │
└─────────────────┘            └─────────────────┘
平坦无层次                      接缝处有阴影，更有深度
```

---

## 六、完整 Ray Marching 示例

```glsl
precision highp float;

uniform vec2 uResolution;
uniform float uTime;

// SDF 基本形状
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// 平滑并集
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

// 场景
float sceneSDF(vec3 p) {
    // 旋转动画
    float angle = uTime * 0.5;
    float s = sin(angle), c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);

    vec3 p1 = p - vec3(0.0, 0.0, -3.0);
    p1.xz = rot * p1.xz;
    float sphere = sdSphere(p1, 0.8);

    vec3 p2 = p - vec3(0.0, 0.0, -3.0);
    p2.yz = rot * p2.yz;
    float box = sdBox(p2, vec3(0.6));

    return opSmoothUnion(sphere, box, 0.3);
}

// 法线计算
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy),
        sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy),
        sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)
    ));
}

// AO
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float weight = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i);
        occ += (h - sceneSDF(p + n * h)) * weight;
        weight *= 0.7;
    }
    return 1.0 - clamp(occ, 0.0, 1.0);
}

// Soft Shadow
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;

    for (int i = 0; i < 32; i++) {
        float h = sceneSDF(ro + rd * t);
        if (h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += clamp(h, 0.01, 0.2);
        if (t > maxt) break;
    }

    return clamp(res, 0.0, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

    vec3 ro = vec3(0.0);
    vec3 rd = normalize(vec3(uv, -1.0));

    // Ray March
    float t = 0.0;
    bool hit = false;
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = sceneSDF(p);
        if (d < 0.0001) { hit = true; break; }
        t += d;
        if (t > 50.0) break;
    }

    vec3 color;
    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        // 光照
        vec3 lightDir = normalize(vec3(0.8, 0.6, -0.5));
        float diff = max(dot(n, lightDir), 0.0);
        float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);

        // 阴影和 AO
        float shadow = softShadow(p + n * 0.01, lightDir, 0.01, 10.0, 8.0);
        float ao = calcAO(p, n);

        // 最终颜色
        vec3 albedo = vec3(0.7, 0.3, 0.2);
        color = albedo * (0.1 + diff * shadow) * ao + vec3(0.3) * spec;
    } else {
        // 天空
        color = vec3(0.4, 0.6, 0.9) - 0.3 * rd.y;
    }

    // Gamma 校正
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
}
```

---

## 常见误区

1. **步进距离不能超过 SDF 值**：如果步进距离大于 SDF 值，光线会穿过表面。这是 Ray Marching 的基本保证，但使用近似 SDF（如平滑布尔操作）时可能失效。

2. **法线精度问题**：有限差分法的 `eps` 值太大会导致法线模糊，太小会产生噪点。通常 `0.001` 是一个合理的起点。

3. **性能瓶颈**：Ray Marching 的性能主要取决于两个因素：步进次数和每次步进的 SDF 计算复杂度。减少场景复杂度和限制最大步进次数是关键优化手段。

4. **距离场的不精确性**：平滑布尔操作会改变距离场的值，使其不再是精确的距离。这可能导致步进时错过表面或步进过多。

---

## 工程建议

1. **限制最大步进次数**：根据场景复杂度设置合理的最大步进次数（通常 64-128 次）。超过限制就返回背景色。

2. **使用包围体加速**：先用简单的包围体（球、盒）判断光线是否可能命中场景，避免在远离场景的区域浪费步进次数。

3. **自适应步进精度**：在远处可以使用较大的 `eps`（如 0.01），在近处使用较小的 `eps`（如 0.0001）。

4. **预计算距离场纹理**：对于静态场景，可以将 SDF 预计算为 3D 纹理，通过采样获取距离值，大幅提高性能。

---

## 小结

SDF 与 Ray Marching 提供了一种完全不同于传统光栅化的渲染方式。通过数学公式定义形状，用步进算法找到光线交点，再通过有限差分计算法线和 AO，就能渲染出高质量的 3D 场景。这种技术在 Shader 艺术、程序化生成、实时渲染等领域有广泛应用。

## 练习

1. 实现一个完整的 Ray Marching 场景：包含球体、盒子、圆环三种基本形状，使用平滑布尔操作组合。

2. 为 Ray Marching 场景添加软阴影：使用 `softShadow` 函数，调整参数观察阴影边缘的柔和度变化。

3. 实现一个旋转的 Mandelbulb（3D Mandelbrot 集合），使用迭代的 SDF 公式。

4. 优化 Ray Marching 性能：实现包围体加速和自适应步进，对比优化前后的帧率。

---

## 参考答案

### 练习一

**思路**：完整的 Ray Marching 场景需要定义三种基本 SDF（球体、盒子、圆环），然后用平滑布尔操作（smooth union/intersection/subtraction）组合它们。平滑操作用 `smin`/`smax` 替代 `min`/`max`，在交界处产生圆滑过渡。

**答案**：
```glsl
// Ray Marching 组合场景
precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uCameraPos;

// 基本 SDF
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

// 平滑并集
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// 平滑差集
float smax(float a, float b, float k) {
    float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) + k * h * (1.0 - h);
}

// 场景 SDF
float map(vec3 p) {
    // 球体
    float sphere = sdSphere(p - vec3(-1.5, 0.0, 0.0), 1.0);

    // 盒子
    float box = sdBox(p - vec3(1.5, 0.0, 0.0), vec3(0.7));

    // 圆环
    float torus = sdTorus(p - vec3(0.0, 0.0, 0.0), vec2(1.0, 0.3));

    // 平滑布尔操作组合
    float result = smin(sphere, box, 0.5);       // 球体和盒子平滑合并
    result = smin(result, torus, 0.3);            // 再与圆环平滑合并

    return result;
}

// 法线计算（有限差分法）
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

// 软阴影
float softShadow(vec3 ro, vec3 rd, float tmin, float tmax, float k) {
    float res = 1.0;
    float t = tmin;
    for (int i = 0; i < 64; i++) {
        float h = map(ro + rd * t);
        res = min(res, k * h / t);
        t += clamp(h, 0.01, 0.1);
        if (h < 0.001 || t > tmax) break;
    }
    return clamp(res, 0.0, 1.0);
}

// AO
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float weight = 1.0;
    for (int i = 0; i < 5; i++) {
        float dist = 0.01 + 0.12 * float(i);
        float h = map(p + n * dist);
        occ += (dist - h) * weight;
        weight *= 0.7;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

    // 相机设置
    vec3 ro = uCameraPos;
    vec3 target = vec3(0.0);
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 rd = normalize(forward + uv.x * right + uv.y * up);

    // Ray Marching
    float t = 0.0;
    float dist;
    for (int i = 0; i < 128; i++) {
        vec3 p = ro + rd * t;
        dist = map(p);
        if (dist < 0.001 || t > 50.0) break;
        t += dist;
    }

    vec3 color = vec3(0.1, 0.1, 0.15);  // 背景色

    if (dist < 0.001) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        // 光照
        vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
        float diffuse = max(dot(n, lightDir), 0.0);
        float shadow = softShadow(p + n * 0.01, lightDir, 0.01, 10.0, 16.0);
        float ao = calcAO(p, n);

        vec3 baseColor = vec3(0.6, 0.7, 0.8);
        color = baseColor * (0.1 + diffuse * shadow * 0.8) * ao;
    }

    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- `smin` 的 `k` 参数控制平滑程度，`k` 越大过渡越圆滑
- 有限差分法计算法线需要调用 6 次 `map`，是 Ray Marching 的性能瓶颈之一
- `clamp(h, 0.01, 0.1)` 限制步进距离下界，防止在表面附近步进过慢

---

### 练习二

**思路**：软阴影的核心思想是：沿光线方向步进时，不仅检查是否命中物体，还记录每一步到最近表面的距离与步进距离的比值。这个比值的最小值就是阴影的强度——距离表面越近，阴影越深。

**答案**：
```glsl
// 软阴影函数
float softShadow(vec3 ro, vec3 rd, float tmin, float tmax, float k) {
    float res = 1.0;
    float t = tmin;
    float ph = 1e10;  // 上一步的距离

    for (int i = 0; i < 64; i++) {
        float h = map(ro + rd * t);

        // 使用上一步和当前步的距离来避免自阴影
        float y = h * h / (2.0 * ph);
        float d = sqrt(h * h - y * y);
        res = min(res, k * d / max(0.0, t - y));

        ph = h;
        t += h;

        if (res < 0.001 || t > tmax) break;
    }

    return clamp(res, 0.0, 1.0);
}

// 使用示例
void main() {
    // ... Ray Marching 找到交点 p 和法线 n ...

    vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));

    // k 参数控制阴影柔和度
    // k = 2  → 硬阴影
    // k = 8  → 中等柔和
    // k = 32 → 非常柔和
    float shadow = softShadow(p + n * 0.01, lightDir, 0.01, 10.0, 16.0);

    vec3 color = baseColor * (ambient + diffuse * shadow);
}
```

**要点**：
- `k` 参数是阴影柔和度的控制旋钮：`k` 越大阴影越硬，`k` 越小阴影越柔和
- `ph * h * h / (2.0 * ph)` 是避免自阴影的技巧（Inigo Quilez 提出）
- `tmin` 应略大于 0（如 0.01），避免表面自相交
- 性能：软阴影的循环次数和主 Ray Marching 相当，是最昂贵的阴影方案

---

### 练习三

**思路**：Mandelbulb 是 3D 版本的 Mandelbrot 集合，通过将 2D 的复数迭代扩展到 3D 球坐标来实现。核心是在迭代中用球坐标变换放大半径和旋转角度，如果半径发散（超过某个阈值），则点不在集合内。

**答案**：
```glsl
// Mandelbulb SDF
precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uCameraPos;

// Mandelbulb 距离估计
float mandelbulb(vec3 pos) {
    vec3 z = pos;
    float dr = 1.0;   // 距离导数
    float r = 0.0;     // 当前半径
    float power = 8.0; // 幂次（可调）

    for (int i = 0; i < 12; i++) {
        r = length(z);
        if (r > 2.0) break;

        // 球坐标变换
        float theta = acos(z.z / r);
        float phi = atan(z.y, z.x);
        dr = pow(r, power - 1.0) * power * dr + 1.0;

        // 伸缩和旋转
        float zr = pow(r, power);
        theta = theta * power;
        phi = phi * power;

        // 转回笛卡尔坐标
        z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
        z += pos;  // 加上原始坐标（类似 Mandelbrot 的 z = z^2 + c）
    }

    // 距离估计公式
    return 0.5 * log(r) * r / dr;
}

// 旋转矩阵（使 Mandelbulb 缓慢旋转）
mat3 rotateY(float angle) {
    float c = cos(angle), s = sin(angle);
    return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}

float map(vec3 p) {
    p = rotateY(uTime * 0.3) * p;
    return mandelbulb(p);
}

// 法线计算
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

    vec3 ro = uCameraPos;
    vec3 rd = normalize(vec3(uv, 2.0));

    float t = 0.0;
    for (int i = 0; i < 128; i++) {
        float d = map(ro + rd * t);
        if (d < 0.001 || t > 20.0) break;
        t += d;
    }

    vec3 color = vec3(0.05);

    if (t < 20.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));

        float diffuse = max(dot(n, lightDir), 0.0);
        float ao = 0.5 + 0.5 * n.y;  // 简化 AO

        color = vec3(0.8, 0.4, 0.2) * (0.2 + diffuse * 0.8) * ao;
    }

    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- `power` 参数控制 Mandelbulb 的复杂度：`power = 8` 是经典形态，`power = 2` 类似球体
- 距离估计公式 `0.5 * log(r) * r / dr` 来自 Hubbard-Douady 潜在理论
- 12 次迭代通常足够，更多迭代会增加细节但降低性能
- 旋转矩阵在 `map` 中应用，使整个 Mandelbulb 旋转

---

### 练习四

**思路**：Ray Marching 性能优化的核心是减少 `map` 调用次数。包围体加速先用简单形状（球/盒）判断光线是否有可能命中场景，跳过远处的空旷区域。自适应步进在远处用大步长、近处用小步长。

**答案**：
```glsl
// 优化版 Ray Marching
precision mediump float;

// 1. 包围体加速
float boundingSphere(vec3 ro, vec3 rd, vec3 center, float radius) {
    vec3 oc = ro - center;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - radius * radius;
    float discriminant = b * b - c;
    if (discriminant < 0.0) return -1.0;  // 未命中，跳过场景
    return -b - sqrt(discriminant);        // 返回最近交点
}

// 2. 自适应步进
float adaptiveStep(float dist, float t) {
    // 远处用大步长，近处用小步长
    float eps = mix(0.001, 0.01, smoothstep(0.0, 10.0, t));
    return max(dist, eps);
}

// 3. 带优化的主循环
float rayMarch(vec3 ro, vec3 rd) {
    // 先用包围球检测
    float tNear = boundingSphere(ro, rd, vec3(0.0), 3.0);
    if (tNear < 0.0) return -1.0;  // 未命中包围体，直接返回

    float t = max(tNear, 0.0);
    int steps = 0;

    for (int i = 0; i < 128; i++) {
        vec3 p = ro + rd * t;
        float dist = map(p);
        steps++;

        if (dist < 0.001) break;
        if (t > 50.0) break;

        // 自适应步进
        t += adaptiveStep(dist, t);
    }

    return t < 50.0 ? t : -1.0;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
    vec3 ro = uCameraPos;
    vec3 rd = normalize(vec3(uv, 2.0));

    float t = rayMarch(ro, rd);

    vec3 color = vec3(0.1);
    if (t > 0.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 lightDir = normalize(vec3(1.0, 1.0, 0.5));
        float diffuse = max(dot(n, lightDir), 0.0);
        color = vec3(0.6, 0.7, 0.8) * (0.2 + diffuse * 0.8);
    }

    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- 包围体加速的效果取决于场景的稀疏程度：场景越稀疏，跳过的光线越多
- 自适应步进的 `smoothstep` 使远处步长从 0.001 平滑过渡到 0.01，减少 50%+ 的步进次数
- 实际项目中还可以用 hierarchical depth buffer、temporal reprojection 等更高级的优化
