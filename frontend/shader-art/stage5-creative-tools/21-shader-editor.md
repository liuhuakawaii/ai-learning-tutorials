# 第 21 课：Shader 编辑器——实时预览、热重载、参数面板

Shadertoy 是最好的在线 Shader 编辑器之一，但它是黑盒——你没法嵌入自己的项目，也没法自定义参数面板。这节课从零构建一个 Shader 编辑器的核心功能。

## 架构

一个最小 Shader 编辑器需要这些模块：

- **代码编辑区**：文本框，用户写 GLSL 代码
- **预览区**：Canvas + WebGL，实时渲染
- **编译管线**：把用户代码包装成完整的 Shader 程序，编译并捕获错误
- **Uniform 注入**：自动注入时间、分辨率、鼠标等内置变量
- **参数面板**：slider 控制用户自定义的 uniform

## WebGL 基础设置

```html
<canvas id="canvas" width="800" height="600"></canvas>
<textarea id="code" rows="20" cols="60">
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv, 0.5, 1.0);
}
</textarea>
<div id="error" style="color:red"></div>
```

## Shader 编译与错误捕获

```javascript
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');
const errorDiv = document.getElementById('error');

const vertexShaderSource = `
attribute vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}`;

// Shader 包装器：把用户代码嵌入完整框架
function wrapFragmentShader(userCode) {
    return `
precision mediump float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;

${userCode}

void main() {
    vec4 color;
    mainImage(color, gl_FragCoord.xy);
    gl_FragColor = color;
}`;
}

function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        return { error };
    }
    return { shader };
}

function createProgram(fragSource) {
    const { shader: vs, error: vsErr } = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    if (vsErr) return { error: vsErr };

    const wrappedFrag = wrapFragmentShader(fragSource);
    const { shader: fs, error: fsErr } = compileShader(wrappedFrag, gl.FRAGMENT_SHADER);
    if (fsErr) {
        // 解析行号：减去包装器的行数
        const offset = 8; // wrapFragmentShader 中用户代码前的行数
        const adjusted = fsErr.replace(/(\d+):/g, (_, line) => {
            return (parseInt(line) - offset) + ':';
        });
        return { error: adjusted };
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return { error: gl.getProgramInfoLog(program) };
    }

    return { program };
}
```

`wrapFragmentShader` 把用户的 `mainImage` 函数包装成完整的 GLSL 程序，自动注入 uniform 声明和 `main()` 调用。错误行号需要减去包装器的行数，让用户看到的行号和编辑器一致。

## 渲染循环

```javascript
let currentProgram = null;
let startTime = performance.now();
let mousePos = [0, 0, 0, 0];

// 创建全屏四边形
const vertices = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

function render() {
    const time = (performance.now() - startTime) / 1000.0;

    gl.viewport(0, 0, canvas.width, canvas.height);

    if (currentProgram) {
        gl.useProgram(currentProgram);

        const posLoc = gl.getAttribLocation(currentProgram, 'position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // 注入内置 uniform
        const iTime = gl.getUniformLocation(currentProgram, 'iTime');
        const iRes = gl.getUniformLocation(currentProgram, 'iResolution');
        const iMouse = gl.getUniformLocation(currentProgram, 'iMouse');

        gl.uniform1f(iTime, time);
        gl.uniform2f(iRes, canvas.width, canvas.height);
        gl.uniform4fv(iMouse, mousePos);

        // 注入用户自定义 uniform
        // ...（见下文）

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    requestAnimationFrame(render);
}
```

## 热重载

用户每次修改代码时重新编译：

```javascript
const codeEditor = document.getElementById('code');
let debounceTimer = null;

codeEditor.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const source = codeEditor.value;
        const result = createProgram(source);

        if (result.error) {
            errorDiv.textContent = result.error;
        } else {
            errorDiv.textContent = '';
            currentProgram = result.program;
        }
    }, 300); // 300ms 防抖
});
```

300ms 防抖避免每打一个字就编译一次。

## 鼠标交互

```javascript
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos[0] = e.clientX - rect.left;
    mousePos[1] = rect.height - (e.clientY - rect.top); // 翻转 y
});

canvas.addEventListener('mousedown', (e) => {
    mousePos[2] = mousePos[0];
    mousePos[3] = mousePos[1];
});

canvas.addEventListener('mouseup', () => {
    mousePos[2] = 0;
    mousePos[3] = 0;
});
```

Shadertoy 的 `iMouse` 约定：xy 是当前鼠标位置，zw 是按下时的位置。松开时 z 归零。

## 参数面板

自动扫描用户 Shader 中的 `uniform float u_xxx` 声明，为每个生成 slider：

```javascript
function extractUniforms(source) {
    const regex = /uniform\s+float\s+(u_\w+)\s*;\s*\/\/\s*range\s*([\d.]+)\s*,\s*([\d.]+)/g;
    const uniforms = [];
    let match;
    while ((match = regex.exec(source)) !== null) {
        uniforms.push({
            name: match[1],
            min: parseFloat(match[2]),
            max: parseFloat(match[3])
        });
    }
    return uniforms;
}

function buildParamPanel(uniforms) {
    const panel = document.getElementById('params');
    panel.innerHTML = '';

    uniforms.forEach(u => {
        const label = document.createElement('label');
        label.textContent = u.name;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = u.min;
        slider.max = u.max;
        slider.step = (u.max - u.min) / 100;
        slider.value = (u.min + u.max) / 2;

        const value = document.createElement('span');
        value.textContent = slider.value;

        slider.addEventListener('input', () => {
            value.textContent = slider.value;
        });

        panel.appendChild(label);
        panel.appendChild(slider);
        panel.appendChild(value);
        panel.appendChild(document.createElement('br'));
    });

    return uniforms.map(u => {
        const slider = panel.querySelector(`input[type="range"]`);
        return { ...u, element: slider };
    });
}
```

用户在 Shader 里这样声明：

```glsl
uniform float u_speed; // range 0.0, 2.0
uniform float u_radius; // range 0.1, 1.0
```

编辑器自动解析注释里的 range 信息，生成对应的 slider。

## 错误行号映射

编译错误里的行号包含包装器的行数。减去偏移量让用户看到正确的行号：

```javascript
function mapErrorLine(errorLine, wrapperLineOffset) {
    return errorLine - wrapperLineOffset;
}
```

更完善的实现会用 source map 或在包装器里加 `#line` 指令。

## 练习

1. 加入纹理支持：允许用户上传图片作为 `iChannel0`。
2. 实现代码片段模板：点击按钮插入常用的噪声/SDF 函数。
3. 加入帧率显示和性能监控。

## 参考答案

### 练习 1

```javascript
function loadTexture(url) {
    const texture = gl.createTexture();
    const img = new Image();
    img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    };
    img.src = url;
    return texture;
}

// 渲染时绑定
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.uniform1i(gl.getUniformLocation(program, 'iChannel0'), 0);
```

### 练习 2

```javascript
const snippets = {
    'Noise': `float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}`,
    'SDF Circle': `float sdCircle(vec2 p, float r) {
    return length(p) - r;
}`
};
// 按钮点击时插入到编辑器光标位置
```

### 练习 3

```javascript
let frameCount = 0;
let lastFPSTime = performance.now();
let fps = 0;

function render() {
    frameCount++;
    const now = performance.now();
    if (now - lastFPSTime > 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFPSTime = now;
        document.getElementById('fps').textContent = fps + ' FPS';
    }
    // ... rest of render
}
```
