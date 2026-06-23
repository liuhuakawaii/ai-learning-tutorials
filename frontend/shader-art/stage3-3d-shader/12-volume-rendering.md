# 第 12 课：体积渲染——云、烟、火的体积效果

前面渲染的都是实心表面。云、烟、火没有明确的表面——它们是"体积"：光穿过介质时被吸收和散射。体积渲染模拟的就是这个过程。

核心思想：沿射线步进，每一步累积颜色和不透明度，直到不透明度饱和或射线穿出体积。

## 基础体积球

先从一个半透明球体开始：

```glsl
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.5));

    vec3 col = vec3(0.0);
    float transmittance = 1.0; // 透射率（1 = 完全透明）

    float stepSize = 0.05;
    float t = 0.0;

    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = sdSphere(p, 1.0);

        if (d < 0.0) { // 在球体内部
            float density = 0.5; // 密度
            float absorption = density * stepSize;

            // 累积颜色（这里用简单的常量颜色）
            vec3 scatterColor = vec3(0.8, 0.4, 0.2);
            col += scatterColor * absorption * transmittance;
            transmittance *= exp(-absorption);
        }

        t += stepSize;
        if (t > 10.0 || transmittance < 0.01) break;
    }

    // 背景
    vec3 bg = vec3(0.05, 0.05, 0.1);
    col += bg * transmittance;

    fragColor = vec4(col, 1.0);
}
```

每一步：
1. 判断当前点是否在体积内（`d < 0`）
2. 计算这一步吸收了多少光（`absorption`）
3. 把散射颜色乘以透射率（之前没被吸收的部分）加到最终颜色
4. 更新透射率：`transmittance *= exp(-absorption)`

`exp(-absorption)` 是 Beer 定律——光穿过介质时指数衰减。

## 用噪声做云

球体太均匀了。用噪声调制密度，产生云的形状：

```glsl
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    return mix(
        mix(mix(hash(i.xy), hash(i.xy + vec2(1.0, 0.0)), u.x),
            mix(hash(i.xy + vec2(0.0, 1.0)), hash(i.xy + vec2(1.0, 1.0)), u.x), u.y),
        mix(mix(hash(i.xy + vec2(0.0, 0.0) + 100.0), hash(i.xy + vec2(1.0, 0.0) + 100.0), u.x),
            mix(hash(i.xy + vec2(0.0, 1.0) + 100.0), hash(i.xy + vec2(1.0, 1.0) + 100.0), u.x), u.y),
        u.z
    );
}

float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.5));

    vec3 col = vec3(0.0);
    float T = 1.0;

    float stepSize = 0.08;
    float t = 0.0;

    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * t;

        // 球形边界
        float sphere = sdSphere(p, 1.2);
        if (sphere > 0.5) { t += 0.5; continue; } // 快速跳过空白区域

        // 用噪声定义密度
        float density = fbm(p * 2.0 + vec3(0.0, 0.0, iTime * 0.2));
        density = smoothstep(0.3, 0.7, density); // 对比度增强
        density *= smoothstep(1.2, 0.8, length(p)); // 边缘衰减

        if (density > 0.01) {
            float absorption = density * stepSize * 2.0;
            vec3 scatterColor = vec3(0.8, 0.85, 0.9);
            col += scatterColor * absorption * T;
            T *= exp(-absorption);
        }

        t += stepSize;
        if (t > 10.0 || T < 0.01) break;
    }

    vec3 bg = 0.5 + 0.5 * cos(6.28318 * (rd.y * 0.5 + vec3(0.0, 0.1, 0.2)));
    col += bg * T;

    fragColor = vec4(col, 1.0);
}
```

`smoothstep(0.3, 0.7, density)` 增加云的对比度——低于 0.3 的密度归零（空隙），高于 0.7 的变密实。`smoothstep(1.2, 0.8, length(p))` 让云的边缘变薄。

## 光线步进（光照体积）

真实的云有光照效果：面向光源的部分更亮。在体积步进中加入光源采样：

```glsl
float lightMarch(vec3 p) {
    vec3 lightDir = normalize(vec3(1.0, 1.0, -0.5));
    float T = 1.0;
    float stepSize = 0.15;

    for (int i = 0; i < 16; i++) {
        p += lightDir * stepSize;
        float density = fbm(p * 2.0 + vec3(0.0, 0.0, iTime * 0.2));
        density = smoothstep(0.3, 0.7, density);
        density *= smoothstep(1.2, 0.8, length(p));
        T *= exp(-density * stepSize * 3.0);
    }

    return T;
}

// 在主循环中使用：
if (density > 0.01) {
    float light = lightMarch(p); // 光穿过多少云才到这里
    vec3 scatterColor = vec3(0.9, 0.9, 1.0) * light;
    float absorption = density * stepSize * 2.0;
    col += scatterColor * absorption * T;
    T *= exp(-absorption);
}
```

对每个体积采样点，从该点向光源方向再步进一段，计算光穿过多少云才到达这个点。面向光源的表面更亮，背光面更暗。

## 火焰效果

火的密度分布：底部密、顶部稀疏；中心热（亮）、边缘冷却（暗）：

```glsl
float flame(vec3 p) {
    // 圆锥形约束
    float r = length(p.xz);
    float h = p.y;
    float cone = smoothstep(0.5, -0.5, h) * 0.5 - r;

    // 噪声扰动
    float n = fbm(p * 3.0 + vec3(0.0, -iTime * 2.0, 0.0));

    // 密度
    float density = max(cone + n * 0.3, 0.0);
    density *= smoothstep(-0.8, -0.2, h); // 底部截断
    density *= smoothstep(1.0, 0.3, h);   // 顶部衰减

    return density;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0, 0.0, -2.5);
    vec3 rd = normalize(vec3(uv, 1.5));

    vec3 col = vec3(0.0);
    float T = 1.0;
    float stepSize = 0.04;

    for (int i = 0; i < 80; i++) {
        vec3 p = ro + rd * t;
        p.y -= 0.2; // 火焰中心偏移

        float density = flame(p);

        if (density > 0.01) {
            // 火焰颜色：底部白黄、顶部红橘
            float temp = smoothstep(-0.3, 0.3, p.y);
            vec3 fireColor = mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 0.3, 0.05), temp);
            fireColor = mix(fireColor, vec3(0.3, 0.05, 0.01), temp * temp);

            float absorption = density * stepSize * 3.0;
            col += fireColor * absorption * T * 2.0;
            T *= exp(-absorption);
        }

        t += stepSize;
        if (t > 10.0 || T < 0.01) break;
    }

    fragColor = vec4(col, 1.0);
}
```

火焰颜色用温度梯度控制：靠近底部（热）是白色→黄色，向上冷却变成橘色→红色→暗红。`* 2.0` 是亮度增益——火焰本身是发光体。

## 步进优化

体积渲染最耗性能。几个常用优化：

```glsl
// 1. 空跳过：步进到体积边界再开始精细步进
float tEnter = t;
float tExit = t;
// 计算射线和包围球的交点...

// 2. 自适应步进：密度低的地方用大步长
stepSize = mix(0.2, 0.04, density);

// 3. 早终止：透射率过低时停止
if (T < 0.01) break;
```

## 练习

1. 把云的噪声加上时间偏移，让云缓慢漂移。
2. 实现一个多层火焰：底部蓝色（最热）、中间黄白、顶部红色。
3. 把体积渲染和上节课的 Ray Marching 结合：实心物体 + 体积雾。

## 参考答案

### 练习 1

```glsl
float density = fbm(p * 2.0 + vec3(iTime * 0.1, iTime * 0.05, iTime * 0.08));
```

### 练习 2

```glsl
vec3 fireColor = mix(vec3(0.2, 0.4, 1.0), vec3(1.0, 0.95, 0.8), smoothstep(-0.3, -0.1, p.y));
fireColor = mix(fireColor, vec3(1.0, 0.3, 0.05), smoothstep(-0.1, 0.2, p.y));
fireColor = mix(fireColor, vec3(0.4, 0.02, 0.0), smoothstep(0.2, 0.5, p.y));
```

### 练习 3

在 Ray Marching 循环中，对每一步同时检查实心物体和体积密度。先渲染实心物体，再在剩余空间里累积体积。
