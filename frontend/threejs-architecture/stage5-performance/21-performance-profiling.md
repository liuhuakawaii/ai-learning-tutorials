# 性能分析——Spector.js、WebGL 调试、GPU Profiler

## "卡"是什么意思

用户说"卡"，可能是帧率低（GPU 画不动），也可能是操作延迟（CPU 忙不过来），还可能是内存不够（纹理爆了）。没有数据就优化是盲目的。

性能分析的第一步：量化问题。

## 帧率与帧时间

帧率（FPS）是最直观的指标，但不是最好的。60fps = 16.67ms/帧，30fps = 33.33ms/帧。但 FPS 和时间不是线性关系——从 60fps 降到 30fps 是 16.67ms 的差距，从 30fps 降到 15fps 也是 16.67ms 的差距，但体感完全不同。

```ts
class FPSCounter {
    private frames = 0;
    private lastTime = performance.now();
    private fps = 0;

    update() {
        this.frames++;
        const now = performance.now();
        if (now - this.lastTime >= 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastTime = now;
        }
    }

    getFPS() { return this.fps; }
}
```

更精确的做法是用 `renderer.info`：

```ts
const info = renderer.info;
console.log('Draw calls:', info.render.calls);
console.log('Triangles:', info.render.triangles);
console.log('Geometries:', info.memory.geometries);
console.log('Textures:', info.memory.textures);
console.log('Programs:', info.programs?.length);
```

## Spector.js：WebGL 调试利器

Spector.js 是 Babylon.js 团队开发的 WebGL 调试工具。它可以录制一帧的所有 WebGL 调用，让你逐个检查。

### 安装

```html
<script src="https://spector.babylonjs.com/spector.bundle.js"></script>
```

或 npm：

```ts
import SPECTOR from 'spectorjs';
const spector = new SPECTOR.Spector();
spector.displayUI(); // 显示录制按钮
```

### 录制一帧

```ts
spector.captureCanvas(renderer.domElement);
// 或者只录制下一帧
spector.startCapture(renderer.domElement, 1);
```

### 录制结果

Spector.js 会显示：

1. **每帧的 WebGL 调用列表**：clear、bindBuffer、bindTexture、useProgram、drawElements 等
2. **每次调用的参数**：绑定了哪个 buffer、哪个纹理、哪个 shader
3. **每个 draw call 的状态快照**：当前绑定的所有状态

这比 Chrome DevTools 的 WebGL 信息详细得多。

### 常见发现

- **重复的 useProgram 调用**：说明材质切换频繁
- **重复的 bindTexture 调用**：说明纹理没有共享
- **过多的 draw call**：需要合并几何体或用 InstancedMesh
- **大的纹理上传**：纹理太大或格式不对

## Chrome DevTools 的 Performance 面板

录制 10 秒的运行数据，可以得到：

- **Main 线程**：JavaScript 执行时间
- **GPU**：渲染时间（如果有 GPU profiling 标记）
- **Frames**：每帧的渲染时间

关键指标：

- 长任务（>16ms）：导致掉帧
- Layout / Style Recalculation：DOM 操作开销
- GC（垃圾回收）：临时对象过多

## Three.js 的 renderer.info

```ts
function logPerformance() {
    const info = renderer.info;
    const output = [
        `FPS: ${fpsCounter.getFPS()}`,
        `Draw Calls: ${info.render.calls}`,
        `Triangles: ${info.render.triangles}`,
        `Points: ${info.render.points}`,
        `Lines: ${info.render.lines}`,
        `Geometries: ${info.memory.geometries}`,
        `Textures: ${info.memory.textures}`,
        `Shader Programs: ${info.programs?.length || 'N/A'}`
    ].join('\n');

    document.getElementById('stats')!.textContent = output;
}
```

## WebGL 调试扩展

浏览器扩展 **WebGL Inspector** 可以检查 WebGL 状态：

- 当前绑定的 framebuffer
- 当前使用的 shader program
- 所有纹理的内容
- 所有 buffer 的内容

## GPU Profiler

NVIDIA Nsight、AMD Radeon GPU Profiler、Intel GPA 可以分析 GPU 端的性能：

- **Vertex Shader 耗时**：顶点处理
- **Fragment Shader 耗时**：像素处理（通常是瓶颈）
- **Overdraw**：同一个像素被画了多少次
- **带宽使用**：纹理读写量

这些工具需要本地安装，不能在浏览器里用。

## 性能分析的流程

```
1. 量化问题
   ├── FPS 低于目标吗？
   ├── 帧时间超过 16ms 吗？
   └── 内存持续增长吗？

2. 定位瓶颈
   ├── CPU bound？（JS 执行时间长）
   │   ├── 场景图遍历？
   ├── GPU bound？（渲染时间长）
   │   ├── draw call 太多？
   │   ├── 三角形太多？
   │   ├── 纹理太大？
   │   └── shader 太复杂？
   └── 内存 bound？
       ├── 几何体太多？
       ├── 纹理太多？
       └── 有泄漏？

3. 针对性优化
   └── （下一节课讲）
```

## 练习

### 练习一：renderer.info 分析

创建一个包含 500 个物体的场景，用 `renderer.info` 记录：

1. draw call 数量
2. 三角形数量
3. geometry 数量
4. texture 数量

然后用 InstancedMesh 合并同类物体，对比数据变化。

### 练习二：Spector.js 录制

安装 Spector.js，录制一个包含 10 个物体的场景的一帧。分析：

1. 总共有多少次 WebGL 调用？
2. useProgram 被调用了多少次？
3. drawElements 被调用了多少次？

### 练习三：Chrome DevTools 分析

用 Chrome DevTools 的 Performance 面板录制一个 3D 场景 5 秒。找出：

1. 最长的 JavaScript 任务
2. 每帧的平均渲染时间
3. 是否有 GC 峰值

---

## 参考答案

### 练习一

合并前：500 draw calls，500 geometries（每个物体一个）
合并后（InstancedMesh）：5 draw calls（5 种物体），5 geometries

三角形数量不变，但 draw call 减少 100 倍。

### 练习二

10 个物体的典型数据：

- 总调用：约 200-300 次
- useProgram：10 次（如果材质各不相同）
- drawElements：10 次

如果所有物体共享材质，useProgram 降到 1 次。

### 练习三

在 Performance 面板中：

1. 看 Main 线程的长条（最长任务）
2. 看 Frames 部分的每帧时间
3. 看是否有 GC 的灰色条（垃圾回收）
