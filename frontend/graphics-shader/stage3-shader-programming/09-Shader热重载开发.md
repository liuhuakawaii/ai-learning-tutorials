# Shader 热重载开发

## 场景引入

写 Shader 和写普通代码最大的区别在于：Shader 的效果只有运行时才能看到。每次修改都要重新编译、刷新页面、重新设置场景，这个循环可能需要 10-30 秒。当你要调整一个颜色值、修改一个阈值、调试一个光照公式时，这种低效的开发流程会严重拖慢迭代速度。Shader 热重载技术让你在保存文件的瞬间就能看到效果变化，将迭代周期从分钟级缩短到秒级。掌握高效的 Shader 开发工作流，是提升生产力的关键。

## 学习目标

1. 理解 Shader 热重载的实现原理
2. 搭建高效的 Shader 开发工作流
3. 掌握 Spector.js 等调试工具的使用
4. 学会 Shader 错误定位和性能分析技巧

---

## 一、热重载原理

### 1.1 基本流程

```
Shader 热重载流程：

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  文件监听    │────→│  重新编译    │────→│  替换 Shader │
│  (chokidar)  │     │  (gl.       │     │  (更新       │
│             │     │   compileShader) │    │   material)  │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
      ▼                   ▼                   ▼
  检测到文件变化      编译新 Shader       下一帧使用新 Shader
  读取新代码          检查错误            视觉效果更新
```

### 1.2 实现方案

```typescript
// 方案 1：基于 Vite 的热重载
// vite.config.ts
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
    plugins: [
        glsl({
            include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
        }),
    ],
});

// 使用：Shader 文件修改后自动触发 HMR
import vertexShader from './shaders/vertex.glsl';
import fragmentShader from './shaders/fragment.glsl';

// Vite HMR 会自动重新加载模块
if (import.meta.hot) {
    import.meta.hot.accept(
        ['./shaders/vertex.glsl', './shaders/fragment.glsl'],
        ([newVert, newFrag]) => {
            // 更新 Shader 材质
            material.vertexShader = newVert;
            material.fragmentShader = newFrag;
            material.needsUpdate = true;
        }
    );
}
```

```typescript
// 方案 2：自定义热重载
class ShaderHotReloader {
    private gl: WebGL2RenderingContext;
    private program: WebGLProgram | null = null;
    private lastModified: Map<string, number> = new Map();

    constructor(private gl: WebGL2RenderingContext) {}

    async checkForUpdates(vertexPath: string, fragmentPath: string): Promise<boolean> {
        const vertResp = await fetch(vertexPath + '?t=' + Date.now());
        const fragResp = await fetch(fragmentPath + '?t=' + Date.now());

        const vertSource = await vertResp.text();
        const fragSource = await fragResp.text();

        // 检查是否有变化
        const vertHash = this.hashCode(vertSource);
        const fragHash = this.hashCode(fragSource);

        if (vertHash !== this.lastModified.get(vertexPath) ||
            fragHash !== this.lastModified.get(fragmentPath)) {

            this.lastModified.set(vertexPath, vertHash);
            this.lastModified.set(fragmentPath, fragHash);

            // 重新编译
            return this.recompile(vertSource, fragSource);
        }

        return false;
    }

    private recompile(vertSource: string, fragSource: string): boolean {
        const gl = this.gl;

        try {
            const vertShader = gl.createShader(gl.VERTEX_SHADER)!;
            gl.shaderSource(vertShader, vertSource);
            gl.compileShader(vertShader);

            if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
                console.error('Vertex shader error:', gl.getShaderInfoLog(vertShader));
                gl.deleteShader(vertShader);
                return false;
            }

            const fragShader = gl.createShader(gl.FRAGMENT_SHADER)!;
            gl.shaderSource(fragShader, fragSource);
            gl.compileShader(fragShader);

            if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
                console.error('Fragment shader error:', gl.getShaderInfoLog(fragShader));
                gl.deleteShader(fragShader);
                gl.deleteShader(vertShader);
                return false;
            }

            const newProgram = gl.createProgram()!;
            gl.attachShader(newProgram, vertShader);
            gl.attachShader(newProgram, fragShader);
            gl.linkProgram(newProgram);

            if (!gl.getProgramParameter(newProgram, gl.LINK_STATUS)) {
                console.error('Program link error:', gl.getProgramInfoLog(newProgram));
                gl.deleteProgram(newProgram);
                return false;
            }

            // 替换旧程序
            if (this.program) {
                gl.deleteProgram(this.program);
            }
            this.program = newProgram;

            gl.deleteShader(vertShader);
            gl.deleteShader(fragShader);

            console.log('Shader recompiled successfully');
            return true;

        } catch (e) {
            console.error('Recompile failed:', e);
            return false;
        }
    }

    private hashCode(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }
}
```

---

## 二、开发工作流搭建

### 2.1 项目结构

```
shader-project/
├── src/
│   ├── shaders/
│   │   ├── vertex.glsl          # 顶点着色器
│   │   ├── fragment.glsl        # 片元着色器
│   │   ├── common.glsl          # 公共函数库
│   │   └── noise.glsl           # 噪声函数库
│   ├── app.ts                   # 应用入口
│   └── shader-manager.ts        # Shader 管理器
├── package.json
└── vite.config.ts
```

### 2.2 Shader 管理器

```typescript
class ShaderManager {
    private shaders: Map<string, WebGLShader> = new Map();
    private programs: Map<string, WebGLProgram> = new Map();
    private lastSources: Map<string, string> = new Map();

    constructor(private gl: WebGL2RenderingContext) {}

    // 加载并编译 Shader
    async loadShader(name: string, path: string, type: number): Promise<WebGLShader | null> {
        const response = await fetch(path);
        const source = await response.text();

        const shader = this.gl.createShader(type)!;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            console.error(`Shader ${name} compile error:`, error);
            this.gl.deleteShader(shader);
            return null;
        }

        this.shaders.set(name, shader);
        this.lastSources.set(name, source);
        return shader;
    }

    // 创建程序
    createProgram(name: string, vertName: string, fragName: string): WebGLProgram | null {
        const vertShader = this.shaders.get(vertName);
        const fragShader = this.shaders.get(fragName);

        if (!vertShader || !fragShader) {
            console.error('Missing shader for program:', name);
            return null;
        }

        const program = this.gl.createProgram()!;
        this.gl.attachShader(program, vertShader);
        this.gl.attachShader(program, fragShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
            return null;
        }

        this.programs.set(name, program);
        return program;
    }

    // 热重载检查
    async checkHotReload(): Promise<boolean> {
        let reloaded = false;

        for (const [name, shader] of this.shaders) {
            const path = `/src/shaders/${name}.glsl`;
            const response = await fetch(path + '?t=' + Date.now());
            const newSource = await response.text();

            if (newSource !== this.lastSources.get(name)) {
                console.log(`Shader ${name} changed, recompiling...`);
                const type = this.gl.getShaderParameter(shader, this.gl.SHADER_TYPE);
                const newShader = await this.loadShader(name, path, type);

                if (newShader) {
                    // 更新所有使用该 Shader 的程序
                    for (const [progName, program] of this.programs) {
                        this.gl.deleteProgram(program);
                        // 重新创建程序
                        // ...
                    }
                    reloaded = true;
                }
            }
        }

        return reloaded;
    }
}
```

### 2.3 开发服务器配置

```typescript
// 开发服务器：监听 Shader 文件变化
import { createServer } from 'vite';
import chokidar from 'chokidar';

const watcher = chokidar.watch('src/shaders/**/*.{glsl,vert,frag}', {
    ignoreInitial: true,
});

watcher.on('change', (path) => {
    console.log(`Shader file changed: ${path}`);
    // 通知客户端热重载
    // Vite 的 HMR 会自动处理
});
```

---

## 三、Spector.js 调试

### 3.1 什么是 Spector.js？

Spector.js 是一个 WebGL 调试工具，可以捕获和分析每一帧的 WebGL 调用：

```
Spector.js 功能：

┌─────────────────────────────────────────┐
│  帧捕获                                  │
│  ┌─────────────────────────────────────┐│
│  │ 1. drawArrays(TRIANGLES, 0, 36)    ││
│  │ 2. bindTexture(TEXTURE_2D, tex1)   ││
│  │ 3. uniformMatrix4fv(loc, false, m) ││
│  │ 4. drawArrays(TRIANGLES, 0, 36)    ││
│  │ ...                                ││
│  └─────────────────────────────────────┘│
│                                         │
│  每个调用的详细信息：                      │
│  - 参数值                                │
│  - 纹理内容预览                           │
│  - Shader 源码                           │
│  - 状态快照                              │
└─────────────────────────────────────────┘
```

### 3.2 使用方法

```typescript
// 引入 Spector.js
import 'spectorjs';

// 初始化
const spector = new SPECTOR.Spector();
spector.displayUI();  // 显示调试 UI

// 或者通过浏览器扩展
// Chrome 商店搜索 "Spector.js"

// 程序化控制
spector.startCapture(canvas);  // 开始捕获
// ... 渲染几帧 ...
spector.stopCapture();         // 停止捕获
```

### 3.3 常见调试场景

```typescript
// 场景 1：检查 Shader 编译错误
function checkShaderCompile(gl: WebGL2RenderingContext, shader: WebGLShader): boolean {
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        console.error('Shader compile error:', error);

        // 解析错误行号
        const lines = error?.split('\n') || [];
        for (const line of lines) {
            const match = line.match(/ERROR: (\d+):(\d+)/);
            if (match) {
                console.error(`Line ${match[2]}: ${line}`);
            }
        }
        return false;
    }
    return true;
}

// 场景 2：检查 Uniform 值
function debugUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
    const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uniformCount; i++) {
        const info = gl.getActiveUniform(program, i);
        const location = gl.getUniformLocation(program, info!.name);
        console.log(`Uniform: ${info!.name}, size: ${info!.size}, type: ${info!.type}`);
    }
}
```

---

## 四、Shader 错误定位技巧

### 4.1 错误信息解析

```
典型的 Shader 错误信息：

ERROR: 0:15: 'gl_Position' : undeclared identifier
ERROR: 0:23: ')' : syntax error
ERROR: 0:45: 'texture2D' : no matching overloaded function found

解读：
- 0:15 → 第 0 个 Shader（顶点着色器）的第 15 行
- 0:23 → 第 0 个 Shader 的第 23 行
- 0:45 → 第 0 个 Shader 的第 45 行

注意：行号可能因预处理（#include、#define）而不准确
```

### 4.2 颜色编码调试法

当 Shader 没有错误但效果不对时，可以通过输出调试颜色来定位问题：

```glsl
// 调试技巧：将中间变量映射为颜色输出

// 1. 可视化 UV 坐标
gl_FragColor = vec4(vUv, 0.0, 1.0);  // 红=U, 绿=V

// 2. 可视化法线
gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);  // 映射到 [0,1]

// 3. 可视化深度
float depth = gl_FragCoord.z;
gl_FragColor = vec4(vec3(depth), 1.0);

// 4. 可视化布尔条件
bool condition = dot(normal, lightDir) > 0.0;
gl_FragColor = condition ? vec4(1,0,0,1) : vec4(0,0,1,1);  // 红=真, 蓝=假

// 5. 可视化数值范围
float value = someCalculation();
gl_FragColor = vec4(
    value < 0.0 ? vec3(1,0,0) :   // 负数=红色
    value < 0.5 ? vec3(0,1,0) :   // 小值=绿色
    vec3(0,0,1),                   // 大值=蓝色
    1.0
);

// 6. 标记特定区域
if (gl_FragCoord.x < 100.0) {
    gl_FragColor = vec4(1,0,0,1);  // 左侧 100 像素标记为红色
    return;
}
```

### 4.3 常见错误模式

```glsl
// 错误 1：精度问题
// 症状：移动端出现条纹或闪烁
// 解决：使用 highp 用于 UV 和位置计算
precision mediump float;
highp vec2 uv = vUv;  // 使用 highp

// 错误 2：未初始化变量
// 症状：渲染结果随机闪烁
vec3 color;  // 未初始化
if (condition) {
    color = vec3(1.0);
}
// color 可能是未定义的！
vec3 color = vec3(0.0);  // 正确：初始化默认值
if (condition) {
    color = vec3(1.0);
}

// 错误 3：整数除法
// 症状：结果总是 0
float result = 1 / 2;     // 整数除法 = 0
float result = 1.0 / 2.0; // 浮点除法 = 0.5

// 错误 4：纹理坐标翻转
// 症状：图片上下颠倒
vec2 uv = vec2(vUv.x, 1.0 - vUv.y);  // 翻转 Y 轴
```

---

## 五、性能瓶颈分析

### 5.1 Overdraw 分析

```
Overdraw（过度绘制）：

屏幕上的每个像素可能被多次绘制。
Overdraw 率 = 实际绘制次数 / 像素数

理想情况：1.0（每个像素只绘制一次）
可接受：2.0-3.0
问题严重：>4.0

分析方法：
1. 使用 Spector.js 查看 Draw Call 顺序
2. 使用浏览器 DevTools 的 Performance 面板
3. 可视化 Overdraw（将绘制次数映射为颜色）
```

### 5.2 带宽分析

```typescript
// 带宽计算公式：
// 带宽 = 纹理大小 × 采样次数 × 帧率

// 示例：
// 1024x1024 RGBA 纹理 = 4MB
// 每帧采样 100 万次
// 60 FPS
// 带宽 = 4MB × 1M × 60 = 240 GB/s（远超显存带宽）

// 优化策略：
// 1. 使用压缩纹理（ASTC、ETC2、BC7）
// 2. 减少纹理尺寸
// 3. 使用 mipmap
// 4. 合并纹理通道
```

### 5.3 性能优化检查清单

```typescript
// 性能优化检查清单
const performanceChecklist = {
    // 1. Shader 编译
    shaderCompilation: [
        '是否使用了 Shader 缓存？',
        '是否预编译了所有 Shader？',
        '是否避免了运行时 Shader 切换？',
    ],

    // 2. Draw Call
    drawCalls: [
        '是否合并了相同材质的物体？',
        '是否使用了实例化渲染？',
        '是否使用了纹理图集？',
    ],

    // 3. 纹理
    textures: [
        '是否使用了压缩纹理？',
        '是否启用了 mipmap？',
        '是否避免了不必要的纹理上传？',
    ],

    // 4. Shader 复杂度
    shaderComplexity: [
        '是否避免了动态分支？',
        '是否减少了纹理采样次数？',
        '是否使用了适当的精度？',
    ],
};
```

---

## 六、Printf 调试法

### 6.1 颜色编码输出

```glsl
// 将调试信息编码到颜色中

// 编码浮点数到颜色
vec3 encodeFloat(float f) {
    // 将 [0, 1] 映射到 RGB
    return vec3(
        fract(f * 256.0),
        fract(f * 65536.0),
        fract(f * 16777216.0)
    );
}

// 从颜色解码浮点数
float decodeFloat(vec3 c) {
    return c.r / 256.0 + c.g / 65536.0 + c.b / 16777216.0;
}

// 使用示例
float debugValue = someComplexCalculation();
gl_FragColor = vec4(encodeFloat(debugValue), 1.0);
// 在 CPU 端读取像素值并解码
```

### 6.2 可视化调试面板

```glsl
// 在屏幕角落显示调试信息
uniform float uDebugValue1;
uniform float uDebugValue2;
uniform vec3 uDebugColor;

void main() {
    vec4 color = mainEffect();

    // 调试面板区域
    if (gl_FragCoord.x < 200.0 && gl_FragCoord.y < 100.0) {
        // 背景
        color = vec4(0.0, 0.0, 0.0, 0.8);

        // 显示调试值
        float y = gl_FragCoord.y / 100.0;
        if (y > 0.66) {
            color.rgb = vec3(uDebugValue1);  // 值 1
        } else if (y > 0.33) {
            color.rgb = vec3(uDebugValue2);  // 值 2
        } else {
            color.rgb = uDebugColor;         // 调试颜色
        }
    }

    gl_FragColor = color;
}
```

---

## 常见误区

1. **热重载不等于实时编辑**：热重载只是在文件保存时重新编译，不是在编辑器中实时预览。真正的实时编辑需要更复杂的工具链。

2. **过度依赖可视化调试**：颜色编码调试只能看到一个像素的值，无法看到整个场景的全局状态。复杂问题还是需要 Spector.js。

3. **忽略移动端性能**：桌面端 60fps 的 Shader 在移动端可能只有 10fps。开发时应始终在目标设备上测试。

4. **调试代码残留**：调试用的颜色输出、条件判断等代码应在发布前清理干净。

---

## 工程建议

1. **建立 Shader 工具库**：将常用的噪声函数、光照模型、后处理效果等封装为可复用的模块，避免重复编写。

2. **使用版本控制**：Shader 文件应纳入版本控制，方便回溯和对比修改。

3. **自动化测试**：编写视觉回归测试，自动对比渲染结果与参考图片，发现意外的视觉变化。

4. **性能预算**：为每个 Shader 设置性能预算（如最大纹理采样次数、最大指令数），超出时发出警告。

---

## 小结

高效的 Shader 开发工作流是提升生产力的关键。本课讲解了热重载的实现原理、Spector.js 等调试工具的使用、错误定位技巧、性能分析方法和 Printf 调试法。掌握这些工具和技巧后，你就能快速迭代 Shader 代码，高效定位和解决问题。

## 练习

1. 搭建一个基于 Vite 的 Shader 热重载开发环境，实现文件保存后自动刷新。

2. 使用 Spector.js 分析一个 Three.js 场景的 WebGL 调用，找出性能瓶颈。

3. 实现一个 Shader 调试工具：在屏幕角落显示多个 Uniform 值的实时图表。

4. 编写一个 Overdraw 可视化 Shader：将每个像素的绘制次数映射为颜色。

---

## 参考答案

### 练习一

**思路**：基于 Vite 的 Shader 热重载核心是利用 Vite 的 HMR（Hot Module Replacement）机制，配合 `vite-plugin-glsl` 插件将 GLSL 文件作为模块导入。当 Shader 文件修改时，Vite 自动触发 HMR 回调，在回调中重新编译 Shader 并更新材质。

**答案**：
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
    plugins: [
        glsl({
            include: ['**/*.glsl', '**/*.vert', '**/*.frag', '**/*.wgsl'],
            defaultExtension: 'glsl',
        }),
    ],
    server: {
        port: 3000,
        open: true,
    },
});
```

```typescript
// src/main.ts
import * as THREE from 'three';
import vertexShader from './shaders/vertex.glsl';
import fragmentShader from './shaders/fragment.glsl';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
});

const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(mesh);

// 热重载回调
if (import.meta.hot) {
    import.meta.hot.accept(
        ['./shaders/vertex.glsl', './shaders/fragment.glsl'],
        ([newVert, newFrag]) => {
            if (newVert && newFrag) {
                material.vertexShader = newVert;
                material.fragmentShader = newFrag;
                material.needsUpdate = true;
                console.log('[HMR] Shader updated');
            }
        }
    );
}

function animate() {
    material.uniforms.uTime.value = performance.now() / 1000;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();
```

```glsl
// src/shaders/fragment.glsl（用于测试热重载）
precision mediump float;

uniform float uTime;

varying vec2 vUv;

void main() {
    // 修改这个颜色，保存后应立即看到变化
    vec3 color = vec3(vUv.x, vUv.y, sin(uTime) * 0.5 + 0.5);
    gl_FragColor = vec4(color, 1.0);
}
```

**要点**：
- `vite-plugin-glsl` 将 GLSL 文件作为 ES 模块导入，支持 `#include` 指令
- `material.needsUpdate = true` 触发 Three.js 重新编译 Shader
- 如果编译错误，Vite 会在浏览器控制台显示错误信息，并在 overlay 中高亮
- 保持 Shader 文件的模块化，便于 HMR 按文件粒度更新

---

### 练习二

**思路**：Spector.js 是 WebGL 调试工具，可以捕获一帧的所有 GL 调用并可视化分析。关键步骤：注入 Spector.js → 捕获帧 → 分析 draw call 数量、状态切换、纹理使用、Shader 编译等瓶颈。

**答案**：
```typescript
// 方式一：通过 CDN 引入 Spector.js
// 在 HTML 中添加：
// <script src="https://cdn.jsdelivr.net/npm/spectorjs@0.9.30/dist/spector.bundle.js"></script>

// 方式二：npm 安装
// npm install spectorjs

import * as SPECTOR from 'spectorjs';

const spector = new SPECTOR.Spector();
spector.displayUI();  // 显示 UI 控件

// 监听捕获事件
spector.onCapture.add((capture) => {
    console.log('Capture:', capture);

    // 分析结果
    const commands = capture.commands;
    const drawCalls = commands.filter(cmd =>
        cmd.name === 'drawArrays' || cmd.name === 'drawElements'
    );

    console.log(`Draw calls: ${drawCalls.length}`);
    console.log(`Total commands: ${commands.length}`);

    // 找出状态切换
    const stateChanges = commands.filter(cmd =>
        cmd.name.startsWith('bind') || cmd.name.startsWith('use')
    );
    console.log(`State changes: ${stateChanges.length}`);
});

// 捕获当前帧
spector.captureCanvas(renderer.domElement);
```

```typescript
// 性能分析最佳实践
function analyzePerformance(renderer: THREE.WebGLRenderer) {
    const info = renderer.info;

    // Three.js 内置的渲染统计
    console.log('=== 渲染统计 ===');
    console.log(`Draw calls: ${info.render.calls}`);
    console.log(`Triangles: ${info.render.triangles}`);
    console.log(`Points: ${info.render.points}`);
    console.log(`Lines: ${info.render.lines}`);

    // 纹理统计
    console.log(`Textures: ${info.memory.textures}`);
    console.log(`Geometries: ${info.memory.geometries}`);

    // Shader 编译
    console.log(`Shader programs: ${info.programs?.length ?? 0}`);

    // 每帧重置
    info.reset();
}
```

**要点**：
- Spector.js 可以捕获完整的 GL 调用序列，包括参数和状态
- 常见瓶颈：过多的 draw call（>100）、频繁的状态切换、未压缩的纹理
- Three.js 的 `renderer.info` 提供快速的渲染统计，适合实时监控
- 捕获时应选择典型的帧（非加载帧），避免误导性的分析结果

---

### 练习三

**思路**：Shader 调试工具的核心是：将多个 Uniform 值实时可视化为屏幕角落的小图表。使用独立的渲染 Pass 或叠加层，在片元着色器中读取 Uniform 值并绘制折线图/条形图。

**答案**：
```glsl
// Uniform 实时图表 - 片元着色器
precision mediump float;

uniform float uTime;
uniform float uValues[8];       // 最多 8 个要监控的值
uniform float uHistory[64];     // 历史记录（8 个值 × 8 帧）
uniform vec2 uResolution;
uniform int uValueCount;

varying vec2 vUv;

// 绘制单个图表
float drawGraph(vec2 uv, int valueIndex, float yOffset) {
    // 图表区域
    vec2 graphPos = vec2(0.02, yOffset);
    vec2 graphSize = vec2(0.25, 0.08);

    vec2 localUv = (uv - graphPos) / graphSize;

    // 边界检查
    if (localUv.x < 0.0 || localUv.x > 1.0 || localUv.y < 0.0 || localUv.y > 1.0) {
        return 0.0;
    }

    // 绘制背景
    float bg = 0.3;

    // 绘制历史曲线
    float curve = 0.0;
    for (int i = 0; i < 8; i++) {
        float x = float(i) / 7.0;
        float value = uHistory[valueIndex * 8 + i];
        float y = value;  // 假设值已在 [0,1] 范围

        // 点到线段的距离
        if (i < 7) {
            float nextX = float(i + 1) / 7.0;
            float nextValue = uHistory[valueIndex * 8 + i + 1];
            float nextY = nextValue;

            vec2 p = localUv;
            vec2 a = vec2(x, y);
            vec2 b = vec2(nextX, nextY);
            vec2 ab = b - a;
            float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
            float dist = length(p - (a + t * ab));
            curve = max(curve, smoothstep(0.02, 0.0, dist));
        }
    }

    // 颜色
    vec3 color = vec3(bg);
    color = mix(color, vec3(0.0, 1.0, 0.5), curve);

    return 1.0;
}

void main() {
    vec2 uv = vUv;
    vec3 color = vec3(0.0);

    // 背景透明
    float mask = 0.0;

    // 绘制每个图表
    for (int i = 0; i < 8; i++) {
        if (i >= uValueCount) break;
        float yOffset = 0.02 + float(i) * 0.09;
        float m = drawGraph(uv, i, yOffset);
        mask = max(mask, m);
    }

    color = vec3(0.1, 0.1, 0.15) * mask;
    gl_FragColor = vec4(color, mask * 0.8);
}
```

```typescript
// TypeScript 端更新图表数据
class UniformMonitor {
    private history: Float32Array = new Float32Array(64);  // 8 values × 8 frames
    private frameIndex: number = 0;

    update(material: THREE.ShaderMaterial, values: number[]) {
        // 更新当前帧的历史记录
        for (let i = 0; i < values.length; i++) {
            this.history[i * 8 + this.frameIndex] = values[i];
        }
        this.frameIndex = (this.frameIndex + 1) % 8;

        // 上传到 Shader
        material.uniforms.uHistory.value = this.history;
        material.uniforms.uValueCount.value = values.length;
    }
}

// 使用示例
const monitor = new UniformMonitor();
function animate() {
    monitor.update(debugMaterial, [
        performance.now() / 1000 % 1.0,           // uTime (mod 1)
        Math.sin(performance.now() / 500) * 0.5 + 0.5,  // sin 波
        renderer.info.render.calls / 100,           // draw calls
        renderer.info.render.triangles / 10000,     // triangles
    ]);
}
```

**要点**：
- 使用环形缓冲区存储历史数据，避免每帧分配新内存
- 图表使用 UV 坐标系，独立于场景渲染，可以叠加在任何画面上
- 归一化显示值（映射到 [0,1]）使不同量纲的值可以在同一个图表中对比
- 可以扩展为条形图、数字显示、颜色编码等多种可视化形式

---

### 练习四

**思路**：Overdraw 可视化的核心是利用模板缓冲或加法混合（additive blending）统计每个像素被绘制了多少次。每次绘制时将像素值加 1，最终将次数映射为颜色（0 次 = 黑色，1 次 = 绿色，多次 = 红色）。

**答案**：
```glsl
// Overdraw 可视化 - 片元着色器
precision mediump float;

varying vec2 vUv;

void main() {
    // 每次绘制输出一个固定的小值
    // 使用加法混合，最终值 = 绘制次数 × step
    gl_FragColor = vec4(0.2, 0.2, 0.2, 1.0);
}
```

```typescript
// TypeScript 端实现 Overdraw 可视化
function enableOverdrawVisualization(renderer: THREE.WebGLRenderer) {
    // 1. 创建专用的渲染目标
    const overdrawTarget = new THREE.WebGLRenderTarget(
        window.innerWidth, window.innerHeight,
        {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
        }
    );

    // 2. 创建 Overdraw 材质（使用加法混合）
    const overdrawMaterial = new THREE.ShaderMaterial({
        vertexShader: `
            attribute vec3 aPosition;
            void main() {
                gl_Position = vec4(aPosition, 1.0);
            }
        `,
        fragmentShader: `
            precision mediump float;
            void main() {
                gl_FragColor = vec4(0.05, 0.05, 0.05, 1.0);
            }
        `,
        blending: THREE.AdditiveBlending,  // 关键：加法混合
        depthTest: false,
        depthWrite: false,
    });

    // 3. 渲染 Overdraw 图
    function renderOverdraw(scene: THREE.Scene, camera: THREE.Camera) {
        // 用纯黑清除
        renderer.setClearColor(0x000000);
        renderer.setRenderTarget(overdrawTarget);
        renderer.clear();

        // 遍历场景中的所有 mesh，替换为 overdraw 材质
        const originalMaterials = new Map();
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                originalMaterials.set(child, child.material);
                child.material = overdrawMaterial;
            }
        });

        renderer.render(scene, camera);

        // 恢复原始材质
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = originalMaterials.get(child);
            }
        });

        renderer.setRenderTarget(null);
    }

    // 4. 将 Overdraw 结果映射为颜色
    const displayMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uOverdrawTexture: { value: overdrawTarget.texture },
        },
        fragmentShader: `
            precision mediump float;
            uniform sampler2D uOverdrawTexture;
            varying vec2 vUv;

            void main() {
                float overdraw = texture2D(uOverdrawTexture, vUv).r;
                // 映射为颜色：黑(0) → 绿(1) → 黄(2) → 红(3+)
                vec3 color;
                if (overdraw < 0.06) {
                    color = vec3(0.0, 0.0, 0.0);  // 未绘制
                } else if (overdraw < 0.12) {
                    color = vec3(0.0, 0.8, 0.0);  // 1 次
                } else if (overdraw < 0.18) {
                    color = vec3(0.8, 0.8, 0.0);  // 2 次
                } else {
                    color = vec3(0.8, 0.0, 0.0);  // 3+ 次
                }
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
    });
}
```

**要点**：
- 加法混合是统计 Overdraw 的核心：每次绘制累加一个固定值，最终值反映绘制次数
- 颜色映射：黑色 = 未绘制（0 次），绿色 = 正常（1 次），黄色 = 轻度过绘（2 次），红色 = 严重过绘（3+ 次）
- Overdraw 可视化会禁用深度测试和写入，确保所有片元都被绘制
- 实际优化目标：将 Overdraw 率控制在 1.5 以下（平均每个像素被绘制 1.5 次）
