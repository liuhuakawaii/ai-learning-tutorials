# 第 23 课：交互式 Shader——鼠标、触摸、音频输入驱动

静态的 Shader 是死的。加上交互——鼠标、触摸、音频——Shader 才真正活起来。这节课把三种输入源接入 Shader，让视觉效果实时响应用户行为。

## 鼠标输入

最基本的交互：鼠标位置驱动 Shader 参数。

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // 鼠标位置归一化
    vec2 mouse = iMouse.xy / iResolution.xy;

    // 鼠标控制一个光圈的位置
    vec2 lightPos = mouse * 2.0 - 1.0;
    if (iMouse.z <= 0.0) lightPos = vec2(0.0); // 没点击时默认中心

    float dist = length(uv - lightPos);
    float glow = exp(-dist * 5.0);

    // 鼠标 x 控制颜色
    vec3 lightColor = mix(vec3(0.9, 0.3, 0.2), vec3(0.2, 0.5, 0.9), mouse.x);

    vec3 col = vec3(0.02, 0.02, 0.05);
    col += lightColor * glow;

    // 鼠标 y 控制辉光半径
    float radius = 0.1 + mouse.y * 0.4;
    float ring = smoothstep(0.01, 0.0, abs(dist - radius));
    col += lightColor * ring * 0.5;

    fragColor = vec4(col, 1.0);
}
```

## 鼠标轨迹

记录鼠标经过的路径，在 Shader 里产生轨迹效果。用纹理存储历史位置：

```javascript
// JavaScript 端：把鼠标位置写入纹理
const trailData = new Float32Array(256 * 4); // 256 个位置
let trailIndex = 0;

function recordMousePosition(x, y) {
    const i = trailIndex % 256;
    trailData[i * 4] = x;
    trailData[i * 4 + 1] = y;
    trailData[i * 4 + 2] = performance.now();
    trailData[i * 4 + 3] = 1.0;
    trailIndex++;

    // 上传到纹理
    gl.bindTexture(gl.TEXTURE_2D, trailTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 256, 1, 0, gl.RGBA, gl.FLOAT, trailData);
}
```

Shader 端采样轨迹纹理：

```glsl
uniform sampler2D iTrail; // 256×1 的纹理

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    vec3 col = vec3(0.02);

    // 遍历轨迹点
    for (int i = 0; i < 256; i++) {
        vec4 point = texelFetch(iTrail, ivec2(i, 0), 0);
        if (point.w < 0.5) continue;

        vec2 pos = point.xy / iResolution.xy * 2.0 - 1.0;
        float dist = length(uv - pos);

        // 每个点产生一个光圈，越新的越亮
        float age = (iTime - point.z) / 3.0;
        float brightness = max(1.0 - age, 0.0);
        col += vec3(0.3, 0.6, 1.0) * exp(-dist * 15.0) * brightness * 0.1;
    }

    fragColor = vec4(col, 1.0);
}
```

`texelFetch` 直接用整数坐标采样纹理，不做插值。

## 触摸输入

移动端的触摸和鼠标类似，但支持多点触控：

```javascript
// JavaScript 端
const touches = new Float32Array(10 * 4); // 最多 10 个触摸点

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    for (let i = 0; i < e.touches.length && i < 10; i++) {
        const t = e.touches[i];
        touches[i * 4] = t.clientX - rect.left;
        touches[i * 4 + 1] = rect.height - (t.clientY - rect.top);
        touches[i * 4 + 3] = 1.0;
    }
    // 上传到 uniform
    gl.uniform4fv(touchesLoc, touches);
});
```

Shader 端接收多点触控：

```glsl
uniform vec4 u_touches[10]; // xy = 位置, z = 压力, w = 是否活跃

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    vec3 col = vec3(0.02);

    for (int i = 0; i < 10; i++) {
        if (u_touches[i].w < 0.5) continue;

        vec2 pos = (u_touches[i].xy - 0.5 * iResolution.xy) / iResolution.y;
        float dist = length(uv - pos);

        // 每个触摸点产生涟漪
        float ripple = sin(dist * 30.0 - iTime * 5.0) * exp(-dist * 5.0);
        vec3 tColor = 0.5 + 0.5 * cos(6.28318 * (float(i) / 10.0 + vec3(0.0, 0.33, 0.67)));
        col += tColor * ripple * 0.2;
        col += tColor * exp(-dist * 10.0) * 0.3;
    }

    fragColor = vec4(col, 1.0);
}
```

## 音频输入

Web Audio API 的 `AnalyserNode` 提供实时频谱数据。把它传给 Shader 作为纹理：

```javascript
// JavaScript 端
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;

// 连接音频源
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
    });

const freqData = new Uint8Array(128);

function updateAudioTexture() {
    analyser.getByteFrequencyData(freqData);

    gl.bindTexture(gl.TEXTURE_2D, audioTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 128, 1, 0,
                  gl.LUMINANCE, gl.UNSIGNED_BYTE, freqData);

    requestAnimationFrame(updateAudioTexture);
}
```

Shader 端采样频谱：

```glsl
uniform sampler2D iAudio; // 128×1 纹理，值域 [0, 1]

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // 用角度采样频谱（放射状频谱显示）
    float freqIndex = (angle / 6.28318 + 0.5);
    float freq = texture(iAudio, vec2(freqIndex, 0.5)).r;

    // 频谱控制半径
    float shape = 0.3 + freq * 0.5;
    float ring = smoothstep(0.02, 0.0, abs(r - shape));

    // 低频脉动
    float bass = texture(iAudio, vec2(0.05, 0.5)).r;
    float pulse = exp(-r * (3.0 - bass * 2.0)) * bass;

    vec3 col = vec3(0.02, 0.02, 0.05);
    vec3 ringColor = 0.5 + 0.5 * cos(6.28318 * (freqIndex + vec3(0.0, 0.33, 0.67)));
    col += ringColor * ring;
    col += vec3(0.4, 0.2, 0.6) * pulse;

    fragColor = vec4(col, 1.0);
}
```

频谱数据被编码成 128×1 的灰度纹理。低频在左侧，高频在右侧。用角度采样产生放射状频谱可视化。

## 音频波形

频谱是频率域的，波形是时间域的：

```glsl
uniform sampler2D iWaveform; // 128×1 纹理

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // 采样波形
    float waveIndex = uv.x + 0.5;
    float wave = texture(iWaveform, vec2(waveIndex, 0.5)).r * 2.0 - 1.0;

    // 波形线
    float d = abs(uv.y - wave * 0.3);
    float line = smoothstep(0.015, 0.005, d);

    // 辉光
    float glow = exp(-d * 40.0) * 0.3;

    vec3 col = vec3(0.02, 0.02, 0.05);
    col += vec3(0.3, 0.7, 1.0) * line;
    col += vec3(0.2, 0.5, 0.8) * glow;

    fragColor = vec4(col, 1.0);
}
```

## 组合多种输入

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    // 鼠标
    vec2 mouse = iMouse.xy / iResolution.xy;

    // 音频
    float bass = texture(iAudio, vec2(0.05, 0.5)).r;
    float mid = texture(iAudio, vec2(0.3, 0.5)).r;

    // 极坐标
    float r = length(uv);
    float angle = atan(uv.y, uv.x);

    // 基础旋涡
    float spiral = sin(angle * 5.0 - r * 15.0 + iTime * 0.5 + bass * 3.0);
    spiral *= exp(-r * 2.0);

    // 鼠标控制扭曲中心
    vec2 offset = (mouse - 0.5) * 0.3;
    float warp = sin(length(uv - offset) * 20.0 - iTime * 3.0);
    warp *= exp(-length(uv - offset) * 5.0) * mid;

    vec3 col = vec3(0.02);
    col += vec3(0.8, 0.4, 0.2) * (spiral * 0.5 + 0.5) * 0.3;
    col += vec3(0.2, 0.6, 1.0) * warp * 0.4;
    col += vec3(0.9, 0.7, 0.3) * bass * exp(-r * 3.0) * 0.2;

    fragColor = vec4(col, 1.0);
}
```

三种输入各司其职：
- **鼠标**：控制视觉焦点和扭曲中心
- **音频低频（bass）**：控制脉动和旋涡速度
- **音频中频（mid）**：控制扭曲强度

## 练习

1. 实现一个鼠标绘图工具：鼠标经过的地方留下颜色，颜色随时间衰减。
2. 用音频频谱驱动粒子速度（参考第 8 课的粒子场）。
3. 实现一个触摸驱动的流体模拟效果（提示：用触摸点作为速度场的注入源）。

## 参考答案

### 练习 1

用帧缓冲存储上一帧的绘制结果，每帧在鼠标位置叠加一个圆形，同时整体乘以衰减因子。

### 练习 2

```glsl
float freq = texture(iAudio, vec2(hash(cellID), 0.5)).r;
vec2 vel = vec2(cos(angle), sin(angle)) * speed * (0.3 + freq * 1.5);
```

### 练习 3

用两个帧缓冲交替存储速度场。每帧把触摸点附近的区域注入速度，然后用对流方程更新整个场。
