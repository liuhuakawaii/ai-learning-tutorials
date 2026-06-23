# 第 25 课：阶段实战——构建在线 Shader 创作工具

把前面四课的技术组合起来，构建一个功能完整的在线 Shader 创作工具。目标：支持实时预览、参数调节、多 Pass 渲染、导出功能。

## 架构设计

```
┌─────────────────────────────────────┐
│            在线 Shader 工具           │
├──────────┬──────────────────────────┤
│  代码编辑  │      实时预览 Canvas       │
│  区域     │                          │
│          │                          │
│          ├──────────────────────────┤
│          │      参数面板 (slider)     │
├──────────┴──────────────────────────┤
│  工具栏：播放/暂停 | 导出 | 示例 | 帮助 │
└─────────────────────────────────────┘
```

技术栈：纯 HTML + CSS + JavaScript + WebGL。不需要框架。

## 核心模块

### Shader 编译器

```javascript
class ShaderCompiler {
    constructor(gl) {
        this.gl = gl;
    }

    wrapUserShader(userCode, uniforms = []) {
        const uniformDecl = uniforms.map(u => {
            if (u.type === 'float') return `uniform float ${u.name};`;
            if (u.type === 'vec2') return `uniform vec2 ${u.name};`;
            if (u.type === 'vec3') return `uniform vec3 ${u.name};`;
            if (u.type === 'vec4') return `uniform vec4 ${u.name};`;
            if (u.type === 'sampler2D') return `uniform sampler2D ${u.name};`;
            return '';
        }).join('\n');

        return `
precision highp float;
uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;
${uniformDecl}

${userCode}

void main() {
    vec4 color;
    mainImage(color, gl_FragCoord.xy);
    gl_FragColor = color;
}`;
    }

    compile(fragSource) {
        const gl = this.gl;

        const vertShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertShader, `
            attribute vec2 position;
            void main() { gl_Position = vec4(position, 0.0, 1.0); }
        `);
        gl.compileShader(vertShader);

        const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragShader, fragSource);
        gl.compileShader(fragShader);

        if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(fragShader);
            gl.deleteShader(vertShader);
            gl.deleteShader(fragShader);
            return { error };
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertShader);
        gl.attachShader(program, fragShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            return { error: gl.getProgramInfoLog(program) };
        }

        return { program };
    }
}
```

### 渲染器

```javascript
class ShaderRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
        this.program = null;
        this.uniforms = {};
        this.startTime = performance.now();
        this.mouse = [0, 0, 0, 0];
        this.paused = false;
        this.timeOffset = 0;

        this.setupGeometry();
        this.setupEvents();
    }

    setupGeometry() {
        const gl = this.gl;
        const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    }

    setupEvents() {
        this.canvas.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse[0] = e.clientX - rect.left;
            this.mouse[1] = rect.height - (e.clientY - rect.top);
        });

        this.canvas.addEventListener('mousedown', e => {
            this.mouse[2] = this.mouse[0];
            this.mouse[3] = this.mouse[1];
        });

        this.canvas.addEventListener('mouseup', () => {
            this.mouse[2] = 0;
        });
    }

    setProgram(program) {
        this.program = program;
        this.uniforms = {};
    }

    getTime() {
        if (this.paused) return this.timeOffset;
        return (performance.now() - this.startTime) / 1000 + this.timeOffset;
    }

    render() {
        const gl = this.gl;
        if (!this.program) return;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.useProgram(this.program);

        const posLoc = gl.getAttribLocation(this.program, 'position');
        gl.enableVertexAttribArray(posLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // 内置 uniform
        gl.uniform1f(gl.getUniformLocation(this.program, 'iTime'), this.getTime());
        gl.uniform3f(gl.getUniformLocation(this.program, 'iResolution'),
            this.canvas.width, this.canvas.height, 1);
        gl.uniform4fv(gl.getUniformLocation(this.program, 'iMouse'), this.mouse);

        // 用户自定义 uniform
        for (const [name, { type, value }] of Object.entries(this.uniforms)) {
            const loc = gl.getUniformLocation(this.program, name);
            if (!loc) continue;
            if (type === 'float') gl.uniform1f(loc, value);
            if (type === 'vec2') gl.uniform2fv(loc, value);
            if (type === 'vec3') gl.uniform3fv(loc, value);
            if (type === 'vec4') gl.uniform4fv(loc, value);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    exportPNG() {
        return this.canvas.toDataURL('image/png');
    }

    exportResolution(width, height) {
        // 临时调整分辨率渲染一帧
        const oldW = this.canvas.width;
        const oldH = this.canvas.height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.render();
        const data = this.canvas.toDataURL('image/png');
        this.canvas.width = oldW;
        this.canvas.height = oldH;
        return data;
    }
}
```

### 参数管理器

```javascript
class ParamManager {
    constructor() {
        this.params = [];
    }

    parseUniforms(code) {
        const regex = /uniform\s+(float|vec2|vec3|vec4)\s+(\w+)\s*;\s*\/\/\s*(.+)/g;
        this.params = [];
        let match;

        while ((match = regex.exec(code)) !== null) {
            const type = match[1];
            const name = match[2];
            const meta = this.parseMeta(match[3]);

            if (meta) {
                this.params.push({ type, name, ...meta });
            }
        }

        return this.params;
    }

    parseMeta(metaStr) {
        // range min,max
        const rangeMatch = metaStr.match(/range\s+([\d.-]+)\s*,\s*([\d.-]+)/);
        if (rangeMatch) {
            return {
                control: 'range',
                min: parseFloat(rangeMatch[1]),
                max: parseFloat(rangeMatch[2]),
                default: (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2
            };
        }

        // color
        if (metaStr.includes('color')) {
            return { control: 'color', default: [1.0, 1.0, 1.0] };
        }

        return null;
    }

    buildPanel(container, onChange) {
        container.innerHTML = '';

        this.params.forEach(param => {
            const wrapper = document.createElement('div');
            wrapper.className = 'param-row';

            const label = document.createElement('label');
            label.textContent = param.name;

            if (param.control === 'range') {
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = param.min;
                slider.max = param.max;
                slider.step = (param.max - param.min) / 200;
                slider.value = param.default;

                const valueSpan = document.createElement('span');
                valueSpan.textContent = param.default.toFixed(2);

                slider.addEventListener('input', () => {
                    const val = parseFloat(slider.value);
                    valueSpan.textContent = val.toFixed(2);
                    onChange(param.name, param.type, val);
                });

                wrapper.appendChild(label);
                wrapper.appendChild(slider);
                wrapper.appendChild(valueSpan);
            }

            container.appendChild(wrapper);
        });
    }
}
```

## 示例代码库

内置几个示例 Shader，让用户快速体验：

```javascript
const examples = {
    '渐变': `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv, 0.5, 1.0);
}`,

    '动态噪声': `
uniform float u_speed; // range 0.0, 2.0
uniform float u_scale; // range 1.0, 20.0

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy * u_scale;
    float n = hash(floor(uv) + floor(iTime * u_speed));
    fragColor = vec4(vec3(n), 1.0);
}`,

    '旋涡星系': `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float r = length(uv);
    float angle = atan(uv.y, uv.x);
    float spiral = sin(angle * 3.0 - r * 15.0 + iTime * 0.5);
    spiral *= exp(-r * 2.5);
    vec3 col = mix(vec3(0.05, 0.02, 0.1), vec3(0.8, 0.6, 1.0), spiral * 0.5 + 0.5);
    fragColor = vec4(col, 1.0);
}`
};
```

## 导出功能

### PNG 导出

```javascript
document.getElementById('export-png').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'shader.png';
    link.href = renderer.exportPNG();
    link.click();
});
```

### GIF 导出

用 `gif.js` 库录制多帧：

```javascript
async function exportGIF(duration, fps) {
    const gif = new GIF({ workers: 2, quality: 10 });
    const frameInterval = 1000 / fps;
    const totalFrames = Math.ceil(duration * fps);

    for (let i = 0; i < totalFrames; i++) {
        renderer.timeOffset = i / fps;
        renderer.render();
        gif.addFrame(renderer.canvas, { copy: true, delay: frameInterval });
    }

    gif.on('finished', blob => {
        const link = document.createElement('a');
        link.download = 'shader.gif';
        link.href = URL.createObjectURL(blob);
        link.click();
    });

    gif.render();
}
```

### Shader 代码导出

```javascript
function exportAsThreeJSMaterial(shaderCode, uniforms) {
    return `
const material = new THREE.ShaderMaterial({
    uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3() },
        ${uniforms.map(u => `${u.name}: { value: ${JSON.stringify(u.default)} }`).join(',\n        ')}
    },
    fragmentShader: \`
        precision highp float;
        uniform float iTime;
        uniform vec3 iResolution;
        ${uniforms.map(u => `uniform ${u.type} ${u.name};`).join('\n        ')}

        ${shaderCode}
    \`
});`;
}
```

## 分享功能

把 Shader 代码编码到 URL 里：

```javascript
function encodeShaderToURL(code) {
    const encoded = btoa(unescape(encodeURIComponent(code)));
    return `${window.location.origin}${window.location.pathname}?shader=${encoded}`;
}

function loadShaderFromURL() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('shader');
    if (encoded) {
        return decodeURIComponent(escape(atob(encoded)));
    }
    return null;
}
```

`btoa` / `atob` 做 Base64 编码。`unescape(encodeURIComponent(...))` 处理中文和特殊字符。

## 键盘快捷键

```javascript
document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
        // Ctrl+Enter：重新编译
        compileAndRun();
    }
    if (e.key === ' ') {
        // 空格：播放/暂停
        renderer.paused = !renderer.paused;
    }
    if (e.ctrlKey && e.key === 's') {
        // Ctrl+S：保存到 localStorage
        e.preventDefault();
        saveToLocalStorage();
    }
});
```

## 最终清单

这个工具应该支持：

- [x] 代码编辑 + 实时预览
- [x] 编译错误显示（行号映射）
- [x] 自动 uniform 注入（iTime, iResolution, iMouse）
- [x] 用户自定义参数面板
- [x] 播放/暂停
- [x] 示例代码库
- [x] PNG 导出
- [x] URL 分享
- [x] 快捷键

可选扩展：
- 多 Pass 渲染（帧缓冲）
- 纹理上传
- GIF 录制
- Three.js 代码导出
- 音频输入

## 练习

1. 加入多 Pass 支持：用户代码可以定义 `mainImage` 和 `mainImage2`，第一个 Pass 的输出作为第二个 Pass 的纹理输入。
2. 实现代码自动补全：输入 `sd` 时弹出 SDF 函数列表。
3. 加入一个"性能视图"：用热力图显示每个像素的 ray march 步数。

## 参考答案

### 练习 1

```javascript
// 创建两个帧缓冲
const fb1 = createFramebuffer();
const fb2 = createFramebuffer();

// 渲染循环
// Pass 1: 渲染到 fb1
gl.bindFramebuffer(gl.FRAMEBUFFER, fb1);
// ... 用 program1 渲染 ...

// Pass 2: 读取 fb1 的纹理，渲染到屏幕
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, fb1.texture);
gl.uniform1i(gl.getUniformLocation(program2, 'iChannel0'), 0);
// ... 用 program2 渲染 ...
```

### 练习 2

在编辑器的 `input` 事件中检测光标前的单词，匹配预定义的函数名列表，弹出补全面板。

### 练习 3

在 Ray Marching 循环中记录步数，输出到一个额外的 float 纹理，再用热力图着色显示。
