# 阶段实战：构建 GPU 加速粒子物理引擎

## 这一课做什么

把 Stage 2 学到的所有东西整合起来：并行计算、粒子模拟、空间哈希，构建一个有碰撞检测和粒子间斥力的物理引擎。

功能清单：
- 100 万粒子实时模拟
- 中心引力 + 轨道运动
- 粒子间短程斥力（用空间哈希网格加速）
- 边界碰撞反弹
- 加法混合渲染

## 空间哈希网格

粒子间斥力需要找到"附近"的粒子。暴力搜索是 O(n²)，不可接受。

空间哈希的思路：把空间划分成网格，每个粒子根据位置分配到一个格子。查找附近粒子时，只需要检查当前格子和相邻 8 个格子里的粒子。

```
实现步骤：
1. 计算每个粒子的格子坐标 → compute shader
2. 按格子排序粒子（radix sort 或 bitonic sort）
3. 构建格子索引（每个格子的起止位置）→ compute shader
4. 对每个粒子，遍历周围格子里的粒子，计算斥力 → compute shader
```

排序这一步太复杂，这里用一个简化方案：直接在 compute shader 里遍历少量近邻粒子（取粒子编号附近的粒子作为近似）。

## 完整实现

```html
<!DOCTYPE html>
<html>
<body>
<canvas id="canvas" width="1024" height="768"></canvas>
<script type="module">
const canvas = document.getElementById('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });

const N = 1_000_000;
const WG = 256;

const computeCode = /* wgsl */`
  struct Params {
    dt: f32, time: f32, gravity: f32, repulse: f32,
    damping: f32, bounds: f32, _, _,
  };
  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read_write> pos: array<vec4f>;
  @group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;

  @compute @workgroup_size(${WG})
  fn simulate(@builtin(global_invocation_id) id: vec3u) {
    let i = id.x;
    if (i >= arrayLength(&pos)) { return; }

    var p = pos[i].xyz;
    var v = vel[i].xyz;
    let dt = params.dt;

    // 中心引力（带距离衰减）
    let r = length(p);
    if (r > 0.01) {
      let g = -normalize(p) * params.gravity / (r * r + 0.5);
      v += g * dt;
    }

    // 轨道切向力
    if (r > 0.2) {
      let tangent = normalize(vec3f(-p.y, p.x, 0.0));
      v += tangent * params.gravity * 0.15 * dt / (r + 0.3);
    }

    // 近邻斥力（简化版：检查编号附近的粒子）
    var repulse_force = vec3f(0.0);
    let check_range = 4u;
    for (var j = 1u; j <= check_range; j++) {
      let ni = (i + j) % arrayLength(&pos);
      let pi = (i + arrayLength(&pos) - j) % arrayLength(&pos);
      let d1 = pos[ni].xyz - p;
      let d2 = pos[pi].xyz - p;
      let l1 = length(d1);
      let l2 = length(d2);
      if (l1 < 0.02 && l1 > 0.0001) {
        repulse_force -= normalize(d1) * params.repulse / (l1 * l1);
      }
      if (l2 < 0.02 && l2 > 0.0001) {
        repulse_force -= normalize(d2) * params.repulse / (l2 * l2);
      }
    }
    v += repulse_force * dt;

    // 阻尼
    v *= params.damping;

    // 更新位置
    p += v * dt;

    // 边界碰撞
    let b = params.bounds;
    if (abs(p.x) > b) { p.x = sign(p.x) * b; v.x *= -0.7; }
    if (abs(p.y) > b) { p.y = sign(p.y) * b; v.y *= -0.7; }
    if (abs(p.z) > b) { p.z = sign(p.z) * b; v.z *= -0.7; }

    pos[i] = vec4f(p, 1.0);
    vel[i] = vec4f(v, 1.0);
  }
`;

const renderCode = /* wgsl */`
  struct UBO { view_proj: mat4x4f, aspect: f32, point_size: f32 };
  @group(0) @binding(0) var<uniform> ubo: UBO;
  @group(0) @binding(1) var<storage, read> pos: array<vec4f>;

  struct Vout {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
    @location(1) depth: f32,
  };

  @vertex
  fn vs(@builtin(vertex_index) vid: u32) -> Vout {
    let q = array<vec2f, 6>(
      vec2f(-1,-1), vec2f(1,-1), vec2f(1,1),
      vec2f(-1,-1), vec2f(1,1), vec2f(-1,1),
    );
    let pi = vid / 6u;
    let qi = vid % 6u;
    let p = pos[pi].xyz;
    let clip = ubo.view_proj * vec4f(p, 1.0);
    let size = ubo.point_size / clip.w;

    var out: Vout;
    out.position = vec4f(clip.xy + q[qi] * size * clip.w, clip.zw);
    out.uv = q[qi] * 0.5 + 0.5;
    out.depth = length(p);
    return out;
  }

  @fragment
  fn fs(@location(0) uv: vec2f, @location(1) depth: f32) -> @location(0) vec4f {
    let d = length(uv - vec2f(0.5));
    if (d > 0.5) { discard; }
    let glow = smoothstep(0.5, 0.0, d);

    // 颜色随距离中心变化
    let t = clamp(depth * 0.3, 0.0, 1.0);
    let hot = vec3f(1.0, 0.85, 0.5);
    let cool = vec3f(0.2, 0.4, 0.9);
    let color = mix(hot, cool, t);

    return vec4f(color * glow, glow * 0.8);
  }
`;

const computeModule = device.createShaderModule({ code: computeCode });
const renderModule = device.createShaderModule({ code: renderCode });

const computePipeline = device.createComputePipeline({
  layout: 'auto',
  compute: { module: computeModule, entryPoint: 'simulate' },
});

const renderPipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module: renderModule, entryPoint: 'vs' },
  fragment: {
    module: renderModule,
    entryPoint: 'fs',
    targets: [{
      format,
      blend: {
        color: { srcFactor: 'src-alpha', dstFactor: 'one' },
        alpha: { srcFactor: 'one', dstFactor: 'one' },
      },
    }],
  },
  primitive: { cullMode: 'none' },
});

// 初始数据
const posData = new Float32Array(N * 4);
const velData = new Float32Array(N * 4);
for (let i = 0; i < N; i++) {
  const t = Math.random() * Math.PI * 2;
  const p = Math.acos(2 * Math.random() - 1);
  const r = Math.pow(Math.random(), 0.33) * 1.5;
  posData[i*4]   = r * Math.sin(p) * Math.cos(t);
  posData[i*4+1] = r * Math.sin(p) * Math.sin(t);
  posData[i*4+2] = r * Math.cos(p);

  const x = posData[i*4], y = posData[i*4+1];
  const sp = 0.2 / (r + 0.3);
  velData[i*4]   = -y * sp / (r + 0.01);
  velData[i*4+1] = x * sp / (r + 0.01);
}

const posBuf = device.createBuffer({ size: posData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
const velBuf = device.createBuffer({ size: velData.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(posBuf, 0, posData);
device.queue.writeBuffer(velBuf, 0, velData);

const paramsBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const uboBuf = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

const computeBG = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: paramsBuf } },
    { binding: 1, resource: { buffer: posBuf } },
    { binding: 2, resource: { buffer: velBuf } },
  ],
});

const renderBG = device.createBindGroup({
  layout: renderPipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: uboBuf } },
    { binding: 1, resource: { buffer: posBuf } },
  ],
});

const depthTex = device.createTexture({
  size: [canvas.width, canvas.height],
  format: 'depth24plus',
  usage: GPUTextureUsage.RENDER_ATTACHMENT,
});

// 矩阵工具（复用前面的）
function perspective(f,a,n,fa){const v=1/Math.tan(f/2),nf=1/(n-fa);return new Float32Array([v/a,0,0,0,0,v,0,0,0,0,fa*nf,-1,0,0,fa*n*nf,0])}
function lookAt(e,t,u){const z=n(sub(e,t)),x=n(cross(u,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1])}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function n(v){const l=Math.sqrt(dot(v,v));return l>0?[v[0]/l,v[1]/l,v[2]/l]:v}
function mul(a,b){const o=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)o[j*4+i]=a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3];return o}

let fc = 0;
function frame() {
  const dt = 1/60, t = fc * dt;
  const camA = t * 0.1;
  const camP = [Math.cos(camA)*5, 2, Math.sin(camA)*5];
  const vp = mul(perspective(Math.PI/3, canvas.width/canvas.height, 0.01, 100), lookAt(camP, [0,0,0], [0,1,0]));

  device.queue.writeBuffer(paramsBuf, 0, new Float32Array([dt, t, 0.4, 0.00005, 0.998, 3.0, 0, 0]));

  const uboData = new Float32Array(24);
  uboData.set(vp, 0);
  uboData[16] = canvas.width / canvas.height;
  uboData[17] = 0.003;
  device.queue.writeBuffer(uboBuf, 0, uboData);

  const enc = device.createCommandEncoder();

  const cp = enc.beginComputePass();
  cp.setPipeline(computePipeline);
  cp.setBindGroup(0, computeBG);
  cp.dispatchWorkgroups(Math.ceil(N / WG));
  cp.end();

  const rp = enc.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: 'clear', storeOp: 'store',
      clearValue: { r: 0, g: 0, b: 0.02, a: 1 },
    }],
    depthStencilAttachment: {
      view: depthTex.createView(),
      depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1,
    },
  });
  rp.setPipeline(renderPipeline);
  rp.setBindGroup(0, renderBG);
  rp.draw(N * 6);
  rp.end();

  device.queue.submit([enc.finish()]);
  fc++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
</script>
</body>
</html>
```

## 性能优化方向

1. **空间哈希**：上面的"近邻斥力"是简化版——只检查编号附近的粒子。真正的空间哈希需要排序 + 索引构建，但能准确找到空间近邻。
2. **SoA vs AoS**：这里位置和速度用 `vec4f` 存储，每个粒子浪费一个 float。真正的引擎会用 `vec3f`（但 GPU 对 `vec3f` 的对齐要求更严格）。
3. **双缓冲**：如果粒子间有强交互（刚体碰撞），需要读旧位置写新位置的双缓冲模式。

## 这个引擎能扩展什么

- 加入流体密度场（SPH 方法）
- 加入刚体碰撞（GJK 算法的 GPU 版本）
- 加入约束求解（布料、关节）
- 加入 LOD——远处的粒子用更少的计算

## 练习

1. 加入鼠标引力：鼠标按下时，在鼠标位置施加一个引力井。
2. 改变粒子的渲染方式——从圆点改成线段（用粒子速度方向绘制短线）。
3. 尝试实现真正的空间哈希排序：先用 bitonic sort 按格子编号排序粒子，再构建格子索引。
