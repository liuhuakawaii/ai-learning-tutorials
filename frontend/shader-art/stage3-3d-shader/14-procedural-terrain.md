# 第 14 课：程序化地形——噪声 + 位移 + 法线生成

用噪声生成地形是 Shader 3D 最实用的技能之一。核心思路：把平坦的地面 SDF 加上噪声偏移，就变成了高低起伏的地形。法线用有限差分从噪声梯度计算。

## 基础地形

```glsl
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
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

float terrainHeight(vec2 p) {
    return fbm(p * 0.5) * 2.0 - 1.0;
}

float map(vec3 p) {
    float h = terrainHeight(p.xz);
    return p.y - h; // 射线在地形上方时为正，下方为负
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 3.0, -5.0);
    vec3 rd = normalize(vec3(uv, 1.5));
    rd.yz = rot2(-0.3) * rd.yz; // 稍微向下看

    float t = 0.0;
    for (int i = 0; i < 150; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001) break;
        if (t > 100.0) break;
        t += d;
    }

    vec3 col = vec3(0.02, 0.02, 0.04);

    if (t < 100.0) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);

        vec3 lightDir = normalize(vec3(0.8, 0.5, -0.3));
        float diff = max(dot(n, lightDir), 0.0);
        float ao = calcAO(p, n);

        // 根据高度着色
        float h = terrainHeight(p.xz);
        vec3 terrainColor;
        if (h < -0.3) {
            terrainColor = vec3(0.1, 0.2, 0.5); // 水
        } else if (h < 0.0) {
            terrainColor = vec3(0.2, 0.5, 0.2); // 草
        } else if (h < 0.3) {
            terrainColor = vec3(0.4, 0.35, 0.25); // 泥土
        } else {
            terrainColor = vec3(0.8, 0.8, 0.85); // 雪
        }

        col = terrainColor * (diff * 0.8 + 0.2) * ao;
    }

    fragColor = vec4(col, 1.0);
}
```

`p.y - h` 是地形 SDF：当射线在地形上方时为正（继续步进），当射线穿过地形时为负（命中）。

## 坡度着色

平坦的区域是草地，陡峭的区域应该露出岩石：

```glsl
vec3 n = calcNormal(p);
float slope = 1.0 - n.y; // n.y = 1 时完全平坦，n.y = 0 时垂直

vec3 grassColor = vec3(0.2, 0.5, 0.2);
vec3 rockColor = vec3(0.4, 0.35, 0.3);

vec3 terrainColor = mix(grassColor, rockColor, smoothstep(0.3, 0.7, slope));
```

`n.y` 是法线的垂直分量。越平坦，`n.y` 越接近 1。

## 雾效

远处的物体应该被大气散射模糊。用射线距离做雾：

```glsl
float fog = 1.0 - exp(-t * 0.02);
vec3 fogColor = vec3(0.6, 0.7, 0.85);
col = mix(col, fogColor, fog);
```

`exp(-t * 0.02)` 随距离指数衰减，`0.02` 控制雾的浓度。

## 地形法线的快速计算

对地形做有限差分时，只需要在 XZ 平面上采样两次（不需要完整 6 次 `map`）：

```glsl
vec3 terrainNormal(vec2 p) {
    float eps = 0.01;
    float h = terrainHeight(p);
    float hx = terrainHeight(p + vec2(eps, 0.0));
    float hz = terrainHeight(p + vec2(0.0, eps));
    return normalize(vec3(h - hx, eps, h - hz));
}
```

这比通用的 `calcNormal` 快一倍，因为地形的法线完全由高度场决定。

## 水面反射

在地形下方加一个水面平面，用反射向量采样天空：

```glsl
float waterPlane(vec3 ro, vec3 rd) {
    // 水面在 y = -0.3
    return (-0.3 - ro.y) / rd.y;
}

// 在主射线未命中地形时检查水面
if (t >= 100.0) {
    float wt = waterPlane(ro, rd);
    if (wt > 0.0 && wt < 100.0) {
        vec3 wp = ro + rd * wt;
        vec3 wn = vec3(0.0, 1.0, 0.0);

        // 反射天空
        vec3 reflDir = reflect(rd, wn);
        vec3 reflCol = 0.5 + 0.5 * cos(6.28318 * (reflDir.y * 0.5 + vec3(0.0, 0.1, 0.2)));

        // Fresnel
        float F = pow(1.0 - max(dot(-rd, wn), 0.0), 3.0);
        col = mix(vec3(0.05, 0.1, 0.2), reflCol, F);
    }
}
```

## 植被散布

在平坦区域随机"种"一些树：

```glsl
float tree(vec3 p, vec2 treePos) {
    vec3 tp = p - vec3(treePos.x, terrainHeight(treePos), treePos.y);
    float trunk = sdCylinder(tp - vec3(0.0, 0.3, 0.0), 0.05, 0.3);
    float crown = sdSphere(tp - vec3(0.0, 0.8, 0.0), 0.25);
    return min(trunk, crown);
}

float map(vec3 p) {
    float d = p.y - terrainHeight(p.xz);

    // 在格点上放树
    vec2 grid = floor(p.xz * 2.0);
    if (hash(grid) > 0.5) { // 50% 概率有树
        vec2 treePos = (grid + vec2(hash(grid + 10.0), hash(grid + 20.0))) / 2.0;
        float slope = 1.0 - terrainNormal(treePos).y;
        if (slope < 0.3) { // 只在平坦处种树
            d = min(d, tree(p, treePos));
        }
    }

    return d;
}
```

## 练习

1. 给地形加一条河流：噪声定义河流路径，在路径处强制降低高度。
2. 实现日落光照：光源颜色从白色逐渐变橘红，天空渐变。
3. 用 `smooth min` 让树干和树冠之间有平滑过渡。

## 参考答案

### 练习 1

```glsl
float terrainHeight(vec2 p) {
    float h = fbm(p * 0.5) * 2.0 - 1.0;
    // 河流路径
    float riverPath = abs(p.x + sin(p.z * 0.5) * 2.0);
    float river = smoothstep(0.8, 0.3, riverPath);
    h = mix(h, -0.5, river); // 河流处强制降低
    return h;
}
```

### 练习 2

```glsl
vec3 sunDir = normalize(vec3(0.8, 0.15, -0.3)); // 低角度
vec3 sunColor = mix(vec3(1.0, 0.9, 0.8), vec3(1.0, 0.4, 0.1), 1.0 - sunDir.y);
float diff = max(dot(n, sunDir), 0.0);
col = terrainColor * diff * sunColor;
```

### 练习 3

```glsl
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float tree(vec3 p, vec2 treePos) {
    // ...
    return smin(trunk, crown, 0.1);
}
```
