# 第 13 课：光线追踪——纯 Shader 实现反射、折射、软阴影

Ray Marching 擅长渲染 SDF 定义的几何体。这节课给它加上光学效果：反射（镜面）、折射（玻璃）、色散（棱镜分光）。

## 反射

反射射线：入射方向沿法线翻转。

```glsl
vec3 reflect(vec3 I, vec3 N) {
    return I - 2.0 * dot(N, I) * N;
}
```

GLSL 内置了 `reflect` 函数，但理解公式很重要：`I - 2(N·I)N`。

```glsl
float sdSphere(vec3 p, float r) { return length(p) - r; }
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float map(vec3 p) {
    float sphere = sdSphere(p - vec3(0.0, 0.0, 0.0), 0.6);
    float ground = p.y + 1.0;
    return min(sphere, ground);
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

vec3 castRay(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001) break;
        if (t > 50.0) break;
        t += d;
    }
    return ro + rd * t;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 1.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.5));
    rd.xz = rot2(iTime * 0.15) * rd.xz;

    vec3 col = vec3(0.02, 0.02, 0.04);
    vec3 atten = vec3(1.0); // 衰减因子

    // 主射线
    vec3 p = castRay(ro, rd);
    float t = length(p - ro);

    if (t < 50.0) {
        vec3 n = calcNormal(p);
        vec3 lightDir = normalize(vec3(1.0, 1.5, -1.0));
        float diff = max(dot(n, lightDir), 0.0);
        col = vec3(0.8, 0.5, 0.3) * diff;

        // 反射
        rd = reflect(rd, n);
        atten *= vec3(0.3); // 反射衰减
        ro = p + n * 0.01;

        // 反射射线
        p = castRay(ro, rd);
        t = length(p - ro);
        if (t < 50.0) {
            n = calcNormal(p);
            diff = max(dot(n, lightDir), 0.0);
            col += vec3(0.6, 0.8, 0.9) * diff * atten;
        }
    }

    fragColor = vec4(col, 1.0);
}
```

`atten` 是衰减因子——每反射一次，颜色衰减一次。这就是为什么镜子不是纯白的：每次反射都损失一些能量。

## 折射

Snell 定律描述光从一种介质进入另一种介质时方向的变化：

```glsl
vec3 refract(vec3 I, vec3 N, float eta) {
    float k = 1.0 - eta * eta * (1.0 - dot(N, I) * dot(N, I));
    if (k < 0.0) return vec3(0.0); // 全内反射
    return eta * I - (eta * dot(N, I) + sqrt(k)) * N;
}
```

`eta` 是折射率比（入射介质 / 折射介质）。空气到玻璃约为 `1.0 / 1.5 ≈ 0.667`。

```glsl
// 在着色逻辑中
if (hitSphere) {
    // 进入球体
    vec3 refrDir = refract(rd, n, 1.0 / 1.5);
    if (length(refrDir) > 0.001) { // 非全内反射
        vec3 refrRo = p - n * 0.02;
        vec3 refrP = castRay(refrRo, refrDir);

        // 穿出球体
        vec3 n2 = calcNormal(refrP);
        vec3 refrDir2 = refract(refrDir, -n2, 1.5);
        if (length(refrDir2) > 0.001) {
            vec3 exitP = castRay(refrP + n2 * 0.01, refrDir2);
            float exitT = length(exitP - refrP);
            if (exitT < 50.0) {
                vec3 exitN = calcNormal(exitP);
                float diff = max(dot(exitN, lightDir), 0.0);
                col = vec3(0.9, 0.95, 1.0) * diff;
            }
        }
    }
}
```

折射需要两次：进入物体一次，穿出一次。第二次折射的法线要取反（`-n2`），因为光线是从内部向外射出。

## 色散

不同波长（颜色）的光折射率不同。把 RGB 三个通道分别用不同的折射率计算：

```glsl
vec3 refractR = refract(rd, n, 1.0 / 1.48); // 红光
vec3 refractG = refract(rd, n, 1.0 / 1.50); // 绿光
vec3 refractB = refract(rd, n, 1.0 / 1.52); // 蓝光

// 分别追踪三条射线...
col.r = castAndShade(ro, refractR);
col.g = castAndShade(ro, refractG);
col.b = castAndShade(ro, refractB);
```

三条射线走不同方向，在穿出物体后落在不同位置——这就是棱镜分光。

## Fresnel 效果

物体表面同时反射和折射，比例取决于观察角度。正对时折射为主，掠射时反射为主：

```glsl
float fresnel(vec3 I, vec3 N, float eta) {
    float cosI = -dot(N, I);
    float sinT2 = eta * eta * (1.0 - cosI * cosI);
    if (sinT2 > 1.0) return 1.0; // 全内反射
    float cosT = sqrt(1.0 - sinT2);
    float rOrth = (eta * cosI - cosT) / (eta * cosI + cosT);
    float rPar = (cosI - eta * cosT) / (cosI + eta * cosT);
    return (rOrth * rOrth + rPar * rPar) * 0.5;
}
```

Schlick 近似更常用：

```glsl
float schlick(float cosTheta, float eta) {
    float r0 = (1.0 - eta) / (1.0 + eta);
    r0 = r0 * r0;
    return r0 + (1.0 - r0) * pow(1.0 - cosTheta, 5.0);
}
```

在着色时用 Fresnel 系数混合反射和折射：

```glsl
float F = schlick(max(dot(-rd, n), 0.0), 1.5);
vec3 reflColor = /* 反射计算 */;
vec3 refrColor = /* 折射计算 */;
col = mix(refrColor, reflColor, F);
```

## 多次反射

用循环替代手动嵌套，支持多次反弹：

```glsl
vec3 ro = cameraPos;
vec3 rd = rayDir;
vec3 col = vec3(0.0);
vec3 atten = vec3(1.0);

for (int bounce = 0; bounce < 4; bounce++) {
    vec3 p = castRay(ro, rd);
    float t = length(p - ro);
    if (t >= 50.0) {
        col += atten * skyColor(rd);
        break;
    }

    vec3 n = calcNormal(p);
    vec3 lightDir = normalize(vec3(1.0, 1.5, -1.0));
    float diff = max(dot(n, lightDir), 0.0);
    col += atten * vec3(0.8, 0.5, 0.3) * diff;

    // 下一条射线
    rd = reflect(rd, n);
    atten *= 0.3;
    ro = p + n * 0.01;
}
```

## 练习

1. 渲染一个玻璃球：先 Fresnel 混合反射折射，再在折射路径上加色散。
2. 给地面加一个棋盘格纹理（用 `floor` 对 xz 坐标取模）。
3. 实现金属材质：高反射率 + 反射颜色偏金属色（金色、铜色）。

## 参考答案

### 练习 1

```glsl
float F = schlick(max(dot(-rd, n), 0.0), 1.5);

// 反射
vec3 reflDir = reflect(rd, n);
vec3 reflCol = shadeReflection(ro, reflDir);

// 折射 + 色散
vec3 refrCol = vec3(0.0);
float etaR = 1.0 / 1.48;
float etaG = 1.0 / 1.50;
float etaB = 1.0 / 1.52;
refrCol.r = shadeRefraction(ro, rd, n, etaR);
refrCol.g = shadeRefraction(ro, rd, n, etaG);
refrCol.b = shadeRefraction(ro, rd, n, etaB);

col = mix(refrCol, reflCol, F);
```

### 练习 2

```glsl
// 在地面着色时
float checker = mod(floor(p.x) + floor(p.z), 2.0);
vec3 groundColor = mix(vec3(0.3), vec3(0.8), checker);
```

### 练习 3

```glsl
// 金属：反射颜色偏金属色，几乎不折射
vec3 metalColor = vec3(1.0, 0.85, 0.6); // 金色
rd = reflect(rd, n);
atten *= metalColor * 0.8; // 金属反射率高但有颜色
```
