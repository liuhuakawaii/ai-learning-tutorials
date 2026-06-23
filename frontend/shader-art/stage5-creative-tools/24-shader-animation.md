# 第 24 课：Shader 动画——时间轴控制、关键帧、缓动函数

Shadertoy 的 `iTime` 是从打开页面开始的连续时间。但真实的动画需要时间轴控制：播放/暂停、跳转、循环、关键帧、缓动。这节课构建一套 Shader 动画系统。

## 时间轴基础

```javascript
class Timeline {
    constructor() {
        this.time = 0;
        this.speed = 1;
        this.playing = true;
        this.loopStart = 0;
        this.loopEnd = 10;
        this.loop = true;
    }

    update(deltaTime) {
        if (!this.playing) return;
        this.time += deltaTime * this.speed;
        if (this.loop && this.time >= this.loopEnd) {
            this.time = this.loopStart + (this.time - this.loopEnd);
        }
    }

    seek(time) {
        this.time = Math.max(0, time);
    }

    pause() { this.playing = false; }
    play() { this.playing = true; }
}

// 传给 Shader
material.uniforms.iTime.value = timeline.time;
```

## 缓动函数

动画的灵魂不是匀速运动，而是缓动。以下是 GLSL 实现的常用缓动函数：

```glsl
// ---- 基础缓动 ----

// 二次方
float easeInQuad(float t) { return t * t; }
float easeOutQuad(float t) { return t * (2.0 - t); }
float easeInOutQuad(float t) {
    return t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t;
}

// 三次方
float easeInCubic(float t) { return t * t * t; }
float easeOutCubic(float t) { float t1 = t - 1.0; return t1 * t1 * t1 + 1.0; }

// 弹性
float easeOutElastic(float t) {
    if (t == 0.0 || t == 1.0) return t;
    return pow(2.0, -10.0 * t) * sin((t - 0.075) * 6.28318 / 0.3) + 1.0;
}

// 弹跳
float easeOutBounce(float t) {
    if (t < 1.0 / 2.75) {
        return 7.5625 * t * t;
    } else if (t < 2.0 / 2.75) {
        t -= 1.5 / 2.75;
        return 7.5625 * t * t + 0.75;
    } else if (t < 2.5 / 2.75) {
        t -= 2.25 / 2.75;
        return 7.5625 * t * t + 0.9375;
    } else {
        t -= 2.625 / 2.75;
        return 7.5625 * t * t + 0.984375;
    }
}

// 回弹
float easeOutBack(float t) {
    float s = 1.70158;
    t -= 1.0;
    return t * t * ((s + 1.0) * t + s) + 1.0;
}
```

## 关键帧系统

关键帧定义了"在什么时间，值是多少"，中间用缓动函数插值：

```glsl
struct Keyframe {
    float time;
    float value;
    float easing; // 0=linear, 1=quad, 2=cubic, 3=elastic
};

float evalKeyframes(float t) {
    // 定义关键帧序列
    float times[4] = float[4](0.0, 1.0, 2.5, 4.0);
    float values[4] = float[4](0.0, 1.0, 0.3, 0.0);

    // 找到当前所在的关键帧区间
    for (int i = 0; i < 3; i++) {
        if (t >= times[i] && t < times[i + 1]) {
            float localT = (t - times[i]) / (times[i + 1] - times[i]);
            localT = easeInOutQuad(localT); // 可以换成任何缓动函数
            return mix(values[i], values[i + 1], localT);
        }
    }
    return values[3]; // 最后一个关键帧
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float t = mod(iTime, 4.0); // 4 秒循环
    float animValue = evalKeyframes(t);

    // 用动画值控制圆的大小
    float radius = 0.1 + animValue * 0.3;
    float d = length(uv);
    float circle = smoothstep(radius, radius - 0.01, d);

    // 颜色也随动画变化
    vec3 col = mix(vec3(0.1, 0.15, 0.3), vec3(0.9, 0.4, 0.2), animValue) * circle;

    fragColor = vec4(col, 1.0);
}
```

## 多属性动画

一个物体通常有多个属性需要动画。用结构体管理：

```glsl
struct AnimState {
    float scale;
    float rotation;
    vec3 position;
    vec3 color;
};

AnimState evalAnimation(float t) {
    AnimState state;

    // 缩放：0-1 秒从 0 弹到 1
    state.scale = easeOutBack(clamp(t / 1.0, 0.0, 1.0));

    // 旋转：1-3 秒转一圈
    float rotT = clamp((t - 1.0) / 2.0, 0.0, 1.0);
    state.rotation = easeInOutCubic(rotT) * 6.28318;

    // 位置：3-4 秒从原点移动到右边
    float posT = clamp((t - 3.0) / 1.0, 0.0, 1.0);
    state.position = vec3(easeOutCubic(posT) * 1.5, 0.0, 0.0);

    // 颜色：全程渐变
    state.color = mix(vec3(0.9, 0.3, 0.2), vec3(0.2, 0.5, 0.9), t / 4.0);

    return state;
}
```

## 可视化缓动曲线

理解缓动最好的方式是画出来：

```glsl
float easeOutBack(float t) {
    float s = 1.70158;
    t -= 1.0;
    return t * t * ((s + 1.0) * t + s) + 1.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // 坐标系
    vec3 col = vec3(0.05);

    // 网格
    vec2 grid = abs(fract(uv * 5.0) - 0.5);
    float gridLine = smoothstep(0.02, 0.0, min(grid.x, grid.y));
    col += vec3(0.1) * gridLine;

    // 坐标轴
    float axisX = smoothstep(0.01, 0.0, abs(uv.y));
    float axisY = smoothstep(0.01, 0.0, abs(uv.x - (-0.4)));
    col += vec3(0.3) * max(axisX, axisY);

    // 缓动曲线
    float x = uv.x + 0.4; // 映射到 [0, 0.8]
    if (x >= 0.0 && x <= 0.8) {
        float t = x / 0.8;
        float y = easeOutBack(t) * 0.8 - 0.4;

        float curveDist = abs(uv.y - y);
        float curve = smoothstep(0.015, 0.005, curveDist);
        col = mix(col, vec3(0.9, 0.4, 0.2), curve);

        // 当前时间点标记
        float playhead = mod(iTime / 4.0, 1.0);
        float phDist = abs(x - playhead * 0.8);
        if (phDist < 0.008) {
            float phY = easeOutBack(playhead) * 0.8 - 0.4;
            float dotDist = length(uv - vec2(playhead * 0.8 - 0.4, phY));
            col += vec3(1.0, 0.8, 0.2) * smoothstep(0.03, 0.01, dotDist);
        }
    }

    fragColor = vec4(col, 1.0);
}
```

## 时间重映射

用噪声调制时间流速——某些时刻快、某些时刻慢：

```glsl
float remapTime(float t) {
    // 噪声驱动的时间扭曲
    float warp = noise(vec2(t * 0.5, 0.0));
    return t + warp * 2.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float t = remapTime(iTime);
    float wave = sin(uv.x * 10.0 + t * 2.0) * 0.1;

    float d = abs(uv.y - wave);
    float line = smoothstep(0.02, 0.005, d);

    vec3 col = vec3(0.02) + vec3(0.3, 0.6, 1.0) * line;

    fragColor = vec4(col, 1.0);
}
```

## 序列动画

把时间分成多个阶段，每个阶段播放不同的动画：

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float t = mod(iTime, 12.0); // 12 秒循环
    vec3 col = vec3(0.02);

    if (t < 3.0) {
        // 阶段 1：渐入
        float phase = easeOutCubic(t / 3.0);
        float d = length(uv);
        float circle = smoothstep(0.3 * phase, 0.29 * phase, d);
        col += vec3(0.9, 0.3, 0.2) * circle;
    } else if (t < 6.0) {
        // 阶段 2：旋转
        float phase = easeInOutQuad((t - 3.0) / 3.0);
        float angle = phase * 6.28318;
        vec2 ruv = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * uv;
        float d = sdBox(ruv, vec2(0.2, 0.1));
        col += vec3(0.2, 0.6, 0.9) * smoothstep(0.01, 0.0, d);
    } else if (t < 9.0) {
        // 阶段 3：分裂
        float phase = easeOutBack((t - 6.0) / 3.0);
        float offset = phase * 0.3;
        float d1 = length(uv - vec2(-offset, 0.0));
        float d2 = length(uv - vec2(offset, 0.0));
        col += vec3(0.9, 0.7, 0.2) * smoothstep(0.12, 0.11, d1);
        col += vec3(0.3, 0.8, 0.4) * smoothstep(0.12, 0.11, d2);
    } else {
        // 阶段 4：消散
        float phase = easeInQuad((t - 9.0) / 3.0);
        float n = noise(uv * 5.0 + iTime);
        col += vec3(0.8, 0.5, 0.3) * (1.0 - phase) * step(0.3, n);
    }

    fragColor = vec4(col, 1.0);
}
```

## 练习

1. 用缓动函数实现一个"弹跳球"动画：球从高处落下，每次弹跳高度递减。
2. 实现一个可交互的时间轴：鼠标 x 位置控制播放进度。
3. 用关键帧系统做一个 Logo 出现动画：缩放 + 旋转 + 透明度。

## 参考答案

### 练习 1

```glsl
float t = mod(iTime, 2.0);
float bounce = abs(sin(t * 3.14159));
bounce *= exp(-t * 1.5); // 每次弹跳递减
float y = bounce * 0.5;
```

### 练习 2

```javascript
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const progress = (e.clientX - rect.left) / rect.width;
    timeline.seek(progress * timeline.loopEnd);
});
```

### 练习 3

```glsl
float scale = easeOutBack(clamp(t / 0.5, 0.0, 1.0));
float rot = easeOutCubic(clamp((t - 0.3) / 0.5, 0.0, 1.0)) * 3.14159;
float alpha = smoothstep(0.0, 0.3, t);
```
