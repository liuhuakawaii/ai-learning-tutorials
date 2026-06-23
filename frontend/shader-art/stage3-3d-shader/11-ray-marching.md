# 第 11 课：Ray Marching——用 Shader 渲染 3D 场景

传统 3D 渲染用三角形网格描述物体。Ray Marching 完全不同：从摄像机向每个像素发射射线，沿射线方向"步进"，每一步计算到场景中最近物体的距离，直到距离足够小（碰到物体）或超出最大距离。

这种方法不需要三角形、不需要顶点缓冲，整个场景用 SDF 描述。代价是性能——每条射线可能要步进几十到上百次。

## 核心算法

```glsl
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float map(vec3 p) {
    return sdSphere(p, 0.5);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 射线
    vec3 ro = vec3(0.0, 0.0, -3.0); // 射线起点（摄像机）
    vec3 rd = normalize(vec3(uv, 1.5)); // 射线方向

    // Ray March
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t; // 当前步进位置
        float d = map(p);     // 到最近物体的距离
        if (d < 0.001) break; // 碰到了
        if (t > 20.0) break;  // 太远了
        t += d;               // 步进距离 = 安全距离
    }

    // 着色
    vec3 col = vec3(0.0);
    if (t < 20.0) {
        vec3 p = ro + rd * t;
        // 简单法线：对 SDF 做有限差分
        vec3 eps = vec3(0.001, 0.0, 0.0);
        vec3 n = normalize(vec3(
            map(p + eps.xyy) - map(p - eps.xyy),
            map(p + eps.yxy) - map(p - eps.yxy),
            map(p + eps.yyx) - map(p - eps.yyx)
        ));
        // 简单光照
        vec3 lightDir = normalize(vec3(1.0, 1.0, -1.0));
        float diff = max(dot(n, lightDir), 0.0);
        float amb = 0.15;
        col = vec3(0.8, 0.4, 0.3) * (diff + amb);
    }

    fragColor = vec4(col, 1.0);
}
```

关键在 `t += d`：SDF 保证了在距离 `d` 范围内不会碰到任何物体，所以步进 `d` 是安全的。这就是"Sphere Tracing"——每一步都走到当前能走的最大安全距离。

## 法线计算

SDF 的梯度方向就是表面法线。用有限差分在三个轴上各采样两次（共 6 次 `map` 调用）：

```glsl
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}
```

偏移量 `0.001` 是经验值。太大会不精确，太小会有数值误差。

## 多物体场景

```glsl
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float map(vec3 p) {
    float sphere = sdSphere(p - vec3(0.0, 0.0, 0.0), 0.5);
    float box1 = sdBox(p - vec3(1.2, 0.0, 0.0), vec3(0.35));
    float box2 = sdBox(p - vec3(-1.2, 0.0, 0.0), vec3(0.4, 0.2, 0.3));

    float d = min(sphere, box1);
    d = min(d, box2);
    return d;
}
```

`min` 取并集——和 2D SDF 一样的逻辑。

## 旋转与平移

移动物体：减去位置。旋转物体：旋转坐标。

```glsl
mat2 rot2(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

float map(vec3 p) {
    // 球体
    float sphere = sdSphere(p - vec3(0.0, 0.0, 0.0), 0.5);

    // 旋转的盒子
    vec3 bp1 = p - vec3(1.2, 0.0, 0.0);
    bp1.xz = rot2(iTime * 0.5) * bp1.xz;
    float box1 = sdBox(bp1, vec3(0.35));

    // 绕 Y 轴旋转的薄板
    vec3 bp2 = p - vec3(-1.2, 0.0, 0.0);
    bp2.xz = rot2(iTime * 0.3) * bp2.xz;
    bp2.yz = rot2(0.5) * bp2.yz;
    float box2 = sdBox(bp2, vec3(0.4, 0.05, 0.3));

    return min(sphere, min(box1, box2));
}
```

`bp.xz = rot2(angle) * bp.xz` 绕 Y 轴旋转。`bp.yz = rot2(angle) * bp.yz` 绕 X 轴旋转。

## 摄像机控制

用鼠标控制观察角度：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 鼠标控制
    vec2 m = iMouse.xy / iResolution.xy;
    if (iMouse.z <= 0.0) m = vec2(0.5, 0.5);

    float yaw = (m.x - 0.5) * 6.0;   // 左右旋转
    float pitch = (m.y - 0.5) * 3.0;  // 上下旋转

    vec3 ro = vec3(0.0, 0.0, -3.0);

    // 旋转摄像机
    vec3 rd = normalize(vec3(uv, 1.5));
    rd.xz = rot2(yaw) * rd.xz;
    rd.yz = rot2(pitch) * rd.yz;

    // ... ray march 和着色 ...
}
```

## 软阴影

阴影射线：从着色点向光源方向步进，如果途中碰到物体，该点在阴影中。

```glsl
float calcShadow(vec3 ro, vec3 rd, float mint, float maxt) {
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 32; i++) {
        float d = map(ro + rd * t);
        if (d < 0.001) return 0.0; // 完全阴影
        res = min(res, 8.0 * d / t); // 软阴影
        t += d;
        if (t > maxt) break;
    }
    return clamp(res, 0.0, 1.0);
}
```

`8.0 * d / t` 是 Inigo Quilez 的软阴影公式。当 `d` 很小（接近遮挡物）但 `t` 很大（离光源还远）时，阴影变软。

## AO（环境光遮蔽）

表面凹陷处应该更暗。用 SDF 值估算遮蔽程度：

```glsl
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float weight = 1.0;
    for (int i = 0; i < 5; i++) {
        float dist = 0.01 + 0.12 * float(i);
        float d = map(p + n * dist);
        occ += (dist - d) * weight;
        weight *= 0.7;
    }
    return 1.0 - clamp(3.0 * occ, 0.0, 1.0);
}
```

在法线方向上多次采样。如果 SDF 值小于采样距离（说明附近有其他物体遮挡），遮蔽值增加。

## 完整着色框架

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 1.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.5));
    rd.xz = rot2(iTime * 0.1) * rd.xz;

    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001) break;
        if (t > 50.0) break;
        t += d;
    }

    vec3 col = vec3(0.02, 0.02, 0.04);

    if (t < 50.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        vec3 lightDir = normalize(vec3(0.8, 0.6, -0.5));
        float diff = max(dot(n, lightDir), 0.0);
        float shadow = calcShadow(p + n * 0.01, lightDir, 0.01, 10.0);
        float ao = calcAO(p, n);

        col = vec3(0.8, 0.5, 0.3) * diff * shadow * ao;
        col += vec3(0.1, 0.15, 0.2) * ao; // 天光
    }

    fragColor = vec4(col, 1.0);
}
```

## 练习

1. 在场景中加一个地面平面（SDF：`p.y + 1.0`）。
2. 用 `smooth min`（`-log(exp(-k*a)+exp(-k*b))/k`）替代 `min`，让物体之间产生粘连效果。
3. 给球体加一个位移（`sin(p.x*5.0)*0.05`），让它看起来像一个表面有起伏的行星。

## 参考答案

### 练习 1

```glsl
float ground = p.y + 1.0; // y = -1 处的平面
d = min(d, ground);
```

### 练习 2

```glsl
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
    float sphere = sdSphere(p, 0.5);
    float box1 = sdBox(p - vec3(1.0, 0.0, 0.0), vec3(0.35));
    return smin(sphere, box1, 0.2); // 0.2 是粘连半径
}
```

### 练习 3

```glsl
float map(vec3 p) {
    float sphere = sdSphere(p, 0.5);
    sphere += sin(p.x * 5.0) * sin(p.y * 5.0) * sin(p.z * 5.0) * 0.05;
    return sphere;
}
```
