# 第 15 课：阶段实战——用 Ray Marching 构建 3D 场景浏览器

把前三课的技术组合起来：实心物体 + 地形 + 体积雾 + 反射 + 阴影 + 摄像机漫游。目标是一个可以用鼠标浏览的完整 3D 场景。

## 场景布局

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

mat2 rot2(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
        v += a * noise(p); p *= 2.0; a *= 0.5;
    }
    return v;
}

float terrainH(vec2 p) { return fbm(p * 0.3) * 1.5 - 0.5; }

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
    // 地形
    float terrain = p.y - terrainH(p.xz);

    // 中央球
    vec3 sp = p - vec3(0.0, 0.5, 0.0);
    float sphere = sdSphere(sp, 0.6);

    // 旋转的环
    vec3 tp = p - vec3(2.0, 0.8, 1.0);
    tp.xz = rot2(iTime * 0.3) * tp.xz;
    float torus = sdTorus(tp, vec2(0.5, 0.1));

    // 方块阵列
    vec3 bp = p - vec3(-2.0, 0.3, 0.5);
    bp.xz = rot2(0.3) * bp.xz;
    bp.y -= sin(iTime * 0.5) * 0.2;
    float box1 = sdBox(bp, vec3(0.3, 0.6, 0.3));

    // 第二个球
    float sphere2 = sdSphere(p - vec3(1.5, 1.0, -1.5), 0.4);

    float scene = min(terrain, min(sphere, min(torus, min(box1, sphere2))));

    return scene;
}
```

## 摄像机

鼠标拖拽控制视角，WASD 控制移动：

```glsl
vec3 getCamera(vec2 uv, vec3 ro, vec3 target) {
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    return normalize(forward * 1.5 + right * uv.x + up * uv.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // 鼠标控制
    vec2 m = iMouse.xy / iResolution.xy;
    if (iMouse.z <= 0.0) m = vec2(0.5, 0.5);

    float yaw = (m.x - 0.5) * 6.0;
    float pitch = (m.y - 0.5) * 2.0;

    vec3 ro = vec3(0.0, 2.0, -5.0);

    // 摄像机旋转
    vec3 rd = getCamera(uv, ro, ro + vec3(0.0, 0.0, 1.0));
    rd.xz = rot2(yaw) * rd.xz;
    rd.yz = rot2(pitch) * rd.yz;

    // ... 着色逻辑 ...
}
```

## 完整着色管线

```glsl
vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

float calcShadow(vec3 ro, vec3 rd) {
    float res = 1.0;
    float t = 0.02;
    for (int i = 0; i < 32; i++) {
        float d = map(ro + rd * t);
        if (d < 0.001) return 0.0;
        res = min(res, 8.0 * d / t);
        t += d;
        if (t > 10.0) break;
    }
    return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float w = 1.0;
    for (int i = 0; i < 5; i++) {
        float d = map(p + n * (0.01 + 0.12 * float(i)));
        occ += (0.01 + 0.12 * float(i) - d) * w;
        w *= 0.7;
    }
    return 1.0 - clamp(3.0 * occ, 0.0, 1.0);
}

// 主着色
if (t < 100.0) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);

    vec3 lightDir = normalize(vec3(0.8, 0.6, -0.4));
    float diff = max(dot(n, lightDir), 0.0);
    float shadow = calcShadow(p + n * 0.01, lightDir);
    float ao = calcAO(p, n);

    // 材质区分
    float h = terrainH(p.xz);
    vec3 matColor;
    if (length(p - vec3(0.0, 0.5, 0.0)) < 0.65) {
        matColor = vec3(0.9, 0.3, 0.2); // 球：红色
    } else if (p.y - h < 0.01) {
        // 地形材质
        float slope = 1.0 - n.y;
        vec3 grass = vec3(0.2, 0.45, 0.15);
        vec3 rock = vec3(0.4, 0.35, 0.3);
        matColor = mix(grass, rock, smoothstep(0.3, 0.7, slope));
        if (h < -0.3) matColor = vec3(0.1, 0.2, 0.4); // 水
    } else {
        matColor = vec3(0.7, 0.6, 0.5);
    }

    col = matColor * (diff * shadow * 0.8 + 0.15) * ao;
    col += vec3(0.2, 0.3, 0.5) * ao * 0.2; // 天光
}

// 雾
float fog = 1.0 - exp(-t * 0.015);
vec3 fogColor = 0.5 + 0.5 * cos(6.28318 * (rd.y * 0.3 + vec3(0.0, 0.1, 0.2)));
col = mix(col, fogColor, fog);
```

## 性能注意事项

- 100 步 Ray March + 32 步阴影 + 5 步 AO = 每像素 137 次 `map` 调用
- `map` 越复杂，帧率越低
- 优化：先用大步长探测，命中后再用小步长精确定位
- 简化场景：远处物体可以合并 SDF

## 练习

1. 加入水面反射：在地形下方的水面处做一次反射射线追踪。
2. 实现一个传送门效果：两个 Torus 之间互相看到对方的场景。
3. 用 `iTime` 做一个日出动画：光源角度和颜色随时间变化。

## 参考答案

### 练习 1

```glsl
if (p.y < terrainH(p.xz) + 0.01 && terrainH(p.xz) < -0.3) {
    // 水面命中
    vec3 wn = vec3(0.0, 1.0, 0.0);
    vec3 reflDir = reflect(rd, wn);
    vec3 reflCol = castAndShade(p + wn * 0.01, reflDir);
    float F = pow(1.0 - max(dot(-rd, wn), 0.0), 3.0);
    col = mix(vec3(0.05, 0.1, 0.2), reflCol, F * 0.8);
}
```

### 练习 2

需要在 `map` 中记录"当前在哪个物体内"，通过材质 ID 区分。传送门效果需要在着色时改变射线方向，指向另一个入口的位置。

### 练习 3

```glsl
float sunAngle = iTime * 0.1;
vec3 lightDir = normalize(vec3(cos(sunAngle), sin(sunAngle), -0.3));
vec3 sunColor = mix(vec3(1.0, 0.4, 0.1), vec3(1.0, 0.95, 0.9), smoothstep(0.0, 0.3, lightDir.y));
```
