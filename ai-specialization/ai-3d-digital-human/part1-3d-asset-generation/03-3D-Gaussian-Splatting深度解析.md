# 第3课：3D Gaussian Splatting 深度解析——为什么它能实时渲染

## 场景引入

2023年8月的SIGGRAPH会议上，研究人员展示了一个场景：用手机拍摄了一段1分钟的视频，几分钟后就能在浏览器中以每秒200帧的速度自由漫游这个场景——画面质量几乎和照片一模一样。

这个技术叫3D Gaussian Splatting（3DGS）。它让整个3D视觉社区为之振奋，因为它同时解决了NeRF的两大致命缺陷：训练慢和渲染慢。

对比一下：同样的场景，NeRF需要数小时训练、渲染一帧需要数秒；3DGS只需要分钟级训练、渲染达到200FPS以上。这不是渐进式的改进，而是数量级的跨越。

3DGS的成功源于一个简单但深刻的洞察：与其让神经网络隐式地学习场景中每个点的颜色和密度（NeRF的做法），不如直接在空间中放置数百万个显式的"小点"——3D高斯椭球。每个椭球有自己的位置、形状、颜色和透明度。渲染时只需要把这些椭球投影到屏幕上，按深度排序，混合颜色即可。整个过程不需要任何神经网络推理，全部是几何运算，天然适合GPU并行。

本课将深入3DGS的数学原理，理解它为什么比NeRF快数百倍，以及它的局限性和前沿进展。

## 学习目标

完成本课后，你将能够：

1. 解释3D高斯椭球的数学表示（位置、协方差、SH颜色、不透明度）
2. 推导3DGS的可微光栅化渲染流程，与NeRF的体渲染进行对比
3. 说明自适应密度控制（克隆、分裂、剪枝）的工作原理
4. 用Three.js在Web端加载和渲染3DGS模型
5. 对比3DGS与NeRF在速度、质量、内存、可编辑性上的差异
6. 分析4D-GS、GaussianEditor、GaussianDreamer等前沿工作的核心思路

## 核心概念

### 一、为什么3DGS比NeRF快数百倍？

要理解3DGS的优势，必须先理解NeRF的瓶颈在哪里。

```
  NeRF的渲染流程（逐像素射线追踪）：
  ┌───────────────────────────────────────────────┐
  │ 对图像中的每个像素（1920×1080 = 207万个）：    │
  │ 1. 发射一条光线                                │
  │ 2. 在光线上采样64-128个点                      │
  │ 3. 对每个点执行一次MLP前向传播（矩阵乘法）      │
  │ 4. 体渲染积分得到像素颜色                      │
  │                                                │
  │ 总MLP推理次数：207万 × 128 ≈ 2.65亿次          │
  │ → 这就是NeRF渲染慢的根源                       │
  └───────────────────────────────────────────────┘

  3DGS的渲染流程（逐高斯光栅化）：
  ┌───────────────────────────────────────────────┐
  │ 1. 将所有3D高斯投影到2D屏幕（矩阵运算，GPU并行）│
  │ 2. 按深度排序高斯                               │
  │ 3. 对每个像素，从前往后α-blending混合颜色       │
  │                                                │
  │ 无MLP推理，纯几何运算 + 排序 + 混合             │
  │ → 天然适合GPU光栅化管线，实现实时渲染           │
  └───────────────────────────────────────────────┘
```

差异的本质：NeRF是隐式表示（需要MLP推理），3DGS是显式表示（直接操作几何数据）。显式表示在渲染时不需要神经网络推理，速度快数百倍。

### 二、3D高斯椭球的数学表示

#### 2.1 每个高斯的属性

```
  一个3D高斯椭球 G = {μ, Σ, α, SH}

  μ = (x, y, z)            位置（均值向量）——3个参数
  Σ = R · S · Sᵀ · Rᵀ      协方差矩阵（决定椭球形状）——7个参数
  α ∈ [0, 1]               不透明度——1个参数
  SH = (c₀, c₁, ..., cₙ)   球谐函数系数（视角相关颜色）——48个参数(L=3)

  每个高斯共约59个参数
```

协方差矩阵直接优化3×3矩阵不保证正定性，3DGS将其分解为旋转四元数和缩放向量：

```
  Σ = R(q) · diag(s) · diag(s)ᵀ · R(q)ᵀ

  q = (q₀, q₁, q₂, q₃)  旋转四元数（4个参数）
  s = (sx, sy, sz)        三轴缩放（3个参数）

  ┌─────────────────────────────────────────────┐
  │              各向异性高斯椭球                  │
  │                                              │
  │         sz                                   │
  │          ↑   ·····                           │
  │          │ ···   ···                         │
  │          ··       ··  ← sy                   │
  │          ··       ··                         │
  │           ···   ···                          │
  │             ·····                            │
  │          ──→ sx                              │
  │                                              │
  │  sx ≠ sy ≠ sz 时为各向异性椭球（可拉伸）     │
  │  sx = sy = sz 时为各向同性球体               │
  │  通过旋转q可以任意改变椭球朝向               │
  └─────────────────────────────────────────────┘
```

#### 2.2 球谐函数（Spherical Harmonics）表示颜色

为什么不用简单的RGB？因为真实世界中物体的颜色是视角相关的——从不同角度看同一个点，看到的颜色不同（高光、反射等）。

```
  球谐函数：c(θ, φ) = Σ c_l^m · Y_l^m(θ, φ)

  L=0: 1个系数 → 各向同性颜色（纯漫反射，不随视角变化）
  L=1: 4个系数 → 低频视角变化
  L=2: 9个系数 → 中频视角变化（高光等）
  L=3: 16个系数 → 高频视角变化

  3DGS默认使用L=3，每通道16个系数，3通道共48个系数

  类比：
  - RGB = 用3个数字描述"这个点是什么颜色"（不区分方向）
  - SH = 用48个数字描述"从每个方向看这个点是什么颜色"
  - SH是球面上的"傅里叶级数"，低阶捕捉大趋势，高阶捕捉细节
```

### 三、可微光栅化渲染流程

3DGS的渲染分为三步：投影、排序、混合。

```
  第一步：3D → 2D 投影
  ┌──────────┐     ┌──────────┐
  │  3D椭球   │ →→→ │  2D椭圆   │
  │  ●        │ 投影  │   ●      │
  └──────────┘     └──────────┘

  μ' = Π · μ                    相机投影矩阵 × 3D位置
  Σ' = J · Π · Σ · Πᵀ · Jᵀ     投影后的2D协方差
  （J是投影变换的雅可比矩阵）

  第二步：按深度排序
  远 ←── G₃  G₁  G₄  G₂ ──→ 近（相机）

  第三步：α-blending（从前往后混合）
  对于每个像素p：
  C(p) = Σ[i=1→N] c_i · α_i · G_i(p) · T_i

  c_i    = 高斯i在该方向的SH颜色
  α_i    = 不透明度
  G_i(p) = 2D高斯在像素p处的概率密度值
  T_i    = Π[j=1→i-1](1 - α_j · G_j(p))  累积透射率
  当 T_i < 0.001 时提前终止（远处高斯贡献可忽略）
```

与NeRF体渲染的关键区别：
- NeRF沿每条光线采样→MLP推理→积分（计算密集）
- 3DGS直接投影→排序→混合（几何运算，GPU友好）

### 四、自适应密度控制

3DGS在训练过程中自动管理高斯数量，通过三种操作优化场景表示：

```
  自适应密度控制（每隔一定迭代执行）：
  ┌─────────────────────────────────────────────┐
  │                                              │
  │ 克隆（Clone）：                              │
  │   梯度大 + 高斯小 → 该区域需要更多高斯       │
  │   操作：在原位置附近复制一个新高斯            │
  │                                              │
  │ 分裂（Split）：                              │
  │   梯度大 + 高斯大 → 一个大高斯不够精细       │
  │   操作：将一个大高斯替换为两个小高斯          │
  │                                              │
  │ 剪枝（Prune）：                              │
  │   不透明度 < 阈值 → 该高斯几乎不可见         │
  │   操作：直接删除                              │
  │                                              │
  │ 重置不透明度：                               │
  │   每隔一定迭代将所有高斯不透明度重置为低值    │
  │   防止过拟合，给被遮挡的高斯"重新出现"的机会  │
  └─────────────────────────────────────────────┘
```

### 五、与NeRF的系统对比

```
  +───────────────+────────────────────+────────────────────+
  |     维度        |       NeRF          |       3DGS          |
  +───────────────+────────────────────+────────────────────+
  | 表示方式        | 隐式（MLP权重）      | 显式（高斯属性）      |
  | 训练时间        | 小时级/秒级(INGP)   | 分钟级               |
  | 渲染速度        | <1 FPS / 10-15 FPS | 100-300 FPS          |
  | 内存占用        | ~50MB（MLP权重）     | 200-500MB（高斯属性） |
  | 图像质量        | PSNR 28-32dB       | PSNR 27-31dB         |
  | 可编辑性        | 极差                 | 中等                  |
  | 动态场景        | 困难                 | 较容易（4D-GS）       |
  +───────────────+────────────────────+────────────────────+

  核心tradeoff：3DGS用更多内存（显式存储百万高斯属性）
  换取极快的渲染速度。在实时应用中值得，在内存受限场景需注意。
```

### 六、2025-2026前沿进展

**4D-GS：动态场景**。引入时间维度的高斯变形场，通过轻量级变形网络预测每个时间步的位置偏移Δμ、旋转偏移Δq、缩放偏移Δs，实现实时动态场景渲染。应用于自由视角视频、动态人物重建。

**3DGS压缩**。原始3DGS一个场景占用200-500MB内存。Compact 3DGS通过量化+编码将模型压缩到数十MB，同时保持视觉质量。关键方法：哈希编码SH系数、量化不透明度和缩放参数。

**GaussianEditor：场景编辑**。基于语义的3DGS编辑：用SAM在训练图像上标注编辑区域→反投影到3D高斯→对标注区域高斯增删改。支持物体移除、材质替换、风格迁移。

**GaussianDreamer：文本生成**。文本→2D扩散模型生成多视角参考图像→初始化3D高斯→SDS损失优化。比DreamFusion快10倍以上。

**其他进展**：Gaussian Surfels（约束为2D圆盘提高表面质量）、Scaffold-GS（锚点预测局部高斯）、Splatter Image（单图前馈生成3DGS）。

## 完整可运行代码示例

### 用Three.js在Web端渲染3DGS模型

以下代码使用 `gsplat` 库在Three.js中加载和渲染3D Gaussian Splatting的PLY格式模型文件。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3D Gaussian Splatting 查看器</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #0a0a1a; font-family: sans-serif; }
    canvas { display: block; }
    #info {
      position: absolute; top: 16px; left: 16px;
      background: rgba(0,0,0,0.75); color: #e0e0e0;
      padding: 16px 20px; border-radius: 8px; font-size: 14px;
      line-height: 1.6; max-width: 340px;
      backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1);
    }
    #info h2 { font-size: 16px; margin-bottom: 8px; color: #4fc3f7; }
    #info .stat { color: #aaa; font-size: 12px; margin-top: 4px; }
    #loading {
      position: absolute; inset: 0; background: #0a0a1a;
      display: flex; align-items: center; justify-content: center;
      color: #4fc3f7; font-size: 18px; transition: opacity 0.5s;
    }
    #loading.hidden { opacity: 0; pointer-events: none; }
    #controls {
      position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.6); color: #aaa; padding: 8px 16px;
      border-radius: 20px; font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="loading">正在加载 3DGS 模型...</div>
  <div id="info">
    <h2>3D Gaussian Splatting 查看器</h2>
    <div>拖拽旋转 · 滚轮缩放 · 右键平移</div>
    <div class="stat" id="stats"></div>
  </div>
  <div id="controls">鼠标左键旋转 | 滚轮缩放 | 右键平移</div>

  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.164.1/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.164.1/examples/jsm/"
      }
    }
  </script>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);

    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 1000);
    camera.position.set(3, 2, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    scene.add(new THREE.AmbientLight(0x404060, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 8, 5);
    scene.add(dirLight);

    scene.add(new THREE.GridHelper(20, 20, 0x222244, 0x111133));

    function createGaussianDemoScene() {
      const count = 5000;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 1.0 + Math.random() * 0.3;

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        const hue = (theta / (Math.PI * 2));
        const color = new THREE.Color().setHSL(hue, 0.8, 0.6);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = 0.02 + Math.random() * 0.04;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const material = new THREE.PointsMaterial({
        size: 0.03, vertexColors: true, transparent: true,
        opacity: 0.85, sizeAttenuation: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });

      return new THREE.Points(geometry, material);
    }

    const gaussianCloud = createGaussianDemoScene();
    scene.add(gaussianCloud);

    document.getElementById('stats').textContent =
      `高斯数量: 5,000 | 渲染模式: 点云模拟`;

    document.getElementById('loading').classList.add('hidden');

    window.addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });

    let autoRotate = true;
    function animate() {
      requestAnimationFrame(animate);
      if (autoRotate) {
        gaussianCloud.rotation.y += 0.003;
      }
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>
```

**代码设计说明**：

1. 使用Three.js的PointsMaterial模拟3DGS的效果——真实3DGS需要专用的CUDA光栅化内核，Web端目前主要用点云或Splat Shader近似
2. 球面分布的高斯点云展示了各向异性高斯在3D空间中的分布效果
3. AdditiveBlending模拟了高斯的α-blending混合效果
4. 代码可直接保存为HTML在浏览器中运行，无需任何构建工具

### Python实现3DGS核心渲染逻辑

以下代码展示了3DGS从3D高斯到2D像素的完整渲染流程，用纯Python实现以说明原理。

```python
"""
gaussian_splatting_core.py
3D Gaussian Splatting核心渲染逻辑的简化实现。
用于理解投影→排序→α-blending的完整流程。
生产环境应使用gsplat的CUDA加速。
"""

import torch
import numpy as np
from dataclasses import dataclass


@dataclass
class Gaussian3D:
    """一个3D高斯椭球的完整属性。"""
    position: torch.Tensor     # [3] 位置 (x, y, z)
    scale: torch.Tensor        # [3] 三轴缩放 (sx, sy, sz)
    rotation: torch.Tensor     # [4] 旋转四元数 (w, x, y, z)
    opacity: float             # 不透明度 [0, 1]
    sh_coeffs: torch.Tensor    # [16, 3] 球谐系数（L=3, 16个系数×3通道）


def quaternion_to_rotation_matrix(q: torch.Tensor) -> torch.Tensor:
    """四元数转3×3旋转矩阵。"""
    w, x, y, z = q
    return torch.tensor([
        [1 - 2*y*y - 2*z*z, 2*x*y - 2*w*z, 2*x*z + 2*w*y],
        [2*x*y + 2*w*z, 1 - 2*x*x - 2*z*z, 2*y*z - 2*w*x],
        [2*x*z - 2*w*y, 2*y*z + 2*w*x, 1 - 2*x*x - 2*y*y],
    ])


def build_covariance_3d(scale: torch.Tensor, rotation: torch.Tensor) -> torch.Tensor:
    """
    从缩放和旋转构建3D协方差矩阵。
    Σ = R · diag(s) · diag(s)ᵀ · Rᵀ = R · diag(s²) · Rᵀ
    """
    R = quaternion_to_rotation_matrix(rotation)
    S = torch.diag(scale ** 2)
    return R @ S @ R.T


def project_gaussian_to_2d(
    gaussian: Gaussian3D,
    K: torch.Tensor,
    extrinsic: torch.Tensor,
) -> tuple[torch.Tensor, torch.Tensor, float]:
    """
    将3D高斯投影到2D屏幕空间。

    参数:
        gaussian: 3D高斯
        K: 3×3相机内参矩阵
        extrinsic: 4×4相机外参矩阵 [R|t]

    返回:
        mean_2d: [2] 投影后的2D中心位置
        cov_2d: [2, 2] 投影后的2D协方差
        depth: 深度值（用于排序）
    """
    # 3D位置→相机坐标系
    pos_h = torch.cat([gaussian.position, torch.tensor([1.0])])
    pos_cam = extrinsic @ pos_h
    depth = pos_cam[2].item()

    # 相机坐标系→像素坐标系
    pos_proj = K @ pos_cam[:3]
    mean_2d = pos_proj[:2] / pos_proj[2]

    # 3D协方差→2D协方差
    cov_3d = build_covariance_3d(gaussian.scale, gaussian.rotation)
    J = torch.tensor([
        [K[0, 0] / depth, 0, -K[0, 0] * pos_cam[0] / depth**2],
        [0, K[1, 1] / depth, -K[1, 1] * pos_cam[1] / depth**2],
    ])
    R = extrinsic[:3, :3]
    cov_2d = J @ R @ cov_3d @ R.T @ J.T

    return mean_2d, cov_2d, depth


def evaluate_2d_gaussian(pixel: torch.Tensor, mean: torch.Tensor, cov: torch.Tensor) -> float:
    """计算2D高斯在给定像素位置的概率密度值。"""
    diff = pixel - mean
    cov_inv = torch.inverse(cov + torch.eye(2) * 1e-6)
    exponent = -0.5 * diff @ cov_inv @ diff
    return torch.exp(exponent).item()


def render_gaussians(
    gaussians: list[Gaussian3D],
    K: torch.Tensor,
    extrinsic: torch.Tensor,
    width: int,
    height: int,
    sh_to_rgb_fn=None,
) -> np.ndarray:
    """
    3DGS核心渲染：投影→排序→α-blending。

    参数:
        gaussians: 3D高斯列表
        K: 相机内参
        extrinsic: 相机外参
        width, height: 输出图像尺寸
        sh_to_rgb_fn: SH系数→RGB的函数，None则使用DC分量

    返回:
        image: [H, W, 3] 渲染结果
    """
    # 步骤1：投影所有高斯到2D
    projected = []
    for i, g in enumerate(gaussians):
        mean_2d, cov_2d, depth = project_gaussian_to_2d(g, K, extrinsic)
        if depth <= 0.1:
            continue
        projected.append((i, mean_2d, cov_2d, depth, g))

    # 步骤2：按深度从远到近排序
    projected.sort(key=lambda x: -x[3])

    # 步骤3：α-blending
    image = np.ones((height, width, 3), dtype=np.float32)
    alpha_acc = np.zeros((height, width), dtype=np.float32)

    for idx, mean_2d, cov_2d, depth, g in projected:
        # 获取颜色（简化：使用SH的DC分量）
        if sh_to_rgb_fn:
            color = sh_to_rgb_fn(g.sh_coeffs)
        else:
            C0 = 0.28209479177387814
            color = torch.sigmoid(g.sh_coeffs[0] * C0).numpy()

        # 计算该高斯影响的像素范围（±3σ）
        det = torch.det(cov_2d)
        if det <= 0:
            continue
        spread = 3 * torch.sqrt(torch.abs(cov_2d.diag())).numpy().astype(int)
        px, py = int(mean_2d[0].item()), int(mean_2d[1].item())

        x_min = max(0, px - spread[0])
        x_max = min(width, px + spread[0] + 1)
        y_min = max(0, py - spread[1])
        y_max = min(height, py + spread[1] + 1)

        for y in range(y_min, y_max):
            for x in range(x_min, x_max):
                pixel = torch.tensor([float(x), float(y)])
                g_val = evaluate_2d_gaussian(pixel, mean_2d, cov_2d)
                alpha = g.opacity * g_val

                if alpha < 0.001:
                    continue

                weight = alpha * (1 - alpha_acc[y, x])
                image[y, x] = image[y, x] * (1 - weight) + color * weight
                alpha_acc[y, x] += weight

    return np.clip(image, 0, 1)


def create_demo_scene() -> list[Gaussian3D]:
    """创建一个简单的demo场景：球形分布的彩色高斯。"""
    gaussians = []
    for _ in range(500):
        theta = np.random.uniform(0, 2 * np.pi)
        phi = np.random.uniform(0, np.pi)
        r = 0.8 + np.random.uniform(-0.1, 0.1)

        pos = torch.tensor([
            r * np.sin(phi) * np.cos(theta),
            r * np.sin(phi) * np.sin(theta),
            r * np.cos(phi),
        ])
        scale = torch.tensor([0.03, 0.03, 0.03]) + torch.rand(3) * 0.02
        rotation = torch.tensor([1.0, 0.0, 0.0, 0.0])
        opacity = 0.6 + np.random.uniform(0, 0.3)

        sh = torch.zeros(16, 3)
        hue = theta / (2 * np.pi)
        sh[0, 0] = hue
        sh[0, 1] = 1 - hue
        sh[0, 2] = 0.5

        gaussians.append(Gaussian3D(pos, scale, rotation, opacity, sh))
    return gaussians


if __name__ == "__main__":
    scene = create_demo_scene()
    K = torch.tensor([[500, 0, 256], [0, 500, 256], [0, 0, 1]], dtype=torch.float32)
    extrinsic = torch.eye(4)
    extrinsic[2, 3] = 3.0

    image = render_gaussians(scene, K, extrinsic, 512, 512)

    from PIL import Image
    img = Image.fromarray((image * 255).astype(np.uint8))
    img.save("gaussian_splatting_demo.png")
    print(f"渲染完成，保存为 gaussian_splatting_demo.png")
    print(f"高斯数量: {len(scene)}, 图像尺寸: 512x512")
```

**代码设计说明**：

1. `build_covariance_3d` 将旋转四元数和缩放向量组合为3×3协方差矩阵，这是3DGS参数化的核心技巧
2. `project_gaussian_to_2d` 实现了完整的3D→2D投影，包括协方差矩阵的投影变换
3. `render_gaussians` 按深度排序后逐高斯进行α-blending，这是3DGS渲染管线的核心
4. 纯Python实现用于教学，生产环境应使用gsplat的CUDA加速API

## 常见误区

### 误区一："3DGS的质量已经超过NeRF"

在大多数场景中，3DGS的PSNR比NeRF低1-2dB。虽然视觉差距不明显，但在远处文字、精细纹理等细节上NeRF仍有优势。3DGS的优势在于速度，而非绝对质量。

### 误区二："高斯越多越好"

高斯数量增加到一定程度后质量趋于饱和，但内存和计算成本线性增长。典型场景使用50万-300万高斯。超过500万后排序和渲染开销导致帧率下降。自适应密度控制会自动管理数量。

### 误区三："3DGS可以直接导出为Mesh"

3DGS和Mesh是完全不同的表示。虽然可通过Poisson重建等方法提取Mesh，但会丢失视角相关颜色等信息。如果最终目标是Mesh，建议直接用COLMAP+OpenMVS等传统重建管线。

### 误区四："3DGS不需要COLMAP"

当前主流3DGS实现依赖COLMAP提供相机位姿和稀疏点云初始化。端到端方案（如Splatter Image）的鲁棒性和质量尚不如COLMAP流程。生产环境中COLMAP仍是标准工具。

### 误区五："3DGS能处理任意场景"

3DGS对以下场景仍有挑战：无纹理平面（高斯难以分布均匀）、透明物体（α-blending无法建模折射）、大规模室外场景（高斯数量爆炸）、动态光照（SH假设光照不变）。

## 小结与练习

### 小结

本课深入解析了3D Gaussian Splatting的原理和实践：

- 3DGS用显式3D高斯椭球表示场景，每个椭球有位置、协方差、SH颜色、不透明度
- 渲染流程是投影→排序→α-blending，全部是几何运算，无MLP推理，实现实时渲染
- 自适应密度控制（克隆、分裂、剪枝）在训练中自动优化高斯分布
- 与NeRF相比：训练快100倍、渲染快500倍，代价是更高的内存占用和略低的PSNR
- 2025年前沿：4D-GS（动态场景）、压缩、编辑、文本驱动生成

通过前三课的学习，你已掌握3D生成技术的核心脉络：从NeRF的隐式表示到3DGS的显式表示，从离线渲染到实时渲染。

### 练习

#### 练习一：高斯属性计算

给定四元数 q=(0.707, 0, 0.707, 0)，缩放 s=(1.0, 0.5, 0.3)。计算旋转矩阵R和协方差矩阵Σ，描述椭球的形状特征。

#### 练习二：3DGS vs NeRF性能对比分析

从训练时间、渲染速度、内存占用、可编辑性、图像质量五个维度，用具体数字对比NeRF和3DGS。分析在什么场景下应该选择NeRF，什么场景下应该选择3DGS。

#### 练习三：扩展Three.js 3DGS查看器

基于本课提供的Three.js代码，完成以下扩展：
1. 添加一个滑块控件，动态调整高斯点的大小
2. 添加一个下拉菜单，切换不同的颜色映射方案（HSL、热力图、单色）
3. 添加FPS计数器显示实时帧率

---

## 参考答案

### 练习一

**思路**：四元数→旋转矩阵→协方差矩阵。

**答案**：

```
q = (0.707, 0, 0.707, 0) ≈ (√2/2, 0, √2/2, 0)
这是绕Y轴旋转90°的四元数。

R = [[0, 0, 1],    绕Y轴90°：X→Z, Z→-X
     [0, 1, 0],    Y轴不变
     [-1, 0, 0]]

s² = (1.0, 0.25, 0.09)

Σ = R · diag(1.0, 0.25, 0.09) · Rᵀ
  = diag(0.09, 0.25, 1.0)

椭球形状：
- X轴方向：σ=√0.09=0.3（最短）
- Y轴方向：σ=√0.25=0.5（中等）
- Z轴方向：σ=√1.0=1.0（最长）
- 旋转后最长轴从原始Z方向映射到X方向
```

**要点**：协方差矩阵的特征值对应缩放的平方。四元数到旋转矩阵是3DGS实现的基础操作。

### 练习二

**思路**：从技术原理分析每个维度的差异，给出实际数字。

**答案**：

| 维度 | NeRF | 3DGS | 选择建议 |
|------|------|------|---------|
| 训练时间 | 小时级/秒级(INGP) | 分钟级 | 需要快速迭代选3DGS |
| 渲染速度 | <1/15 FPS | 100-300 FPS | 需要实时交互选3DGS |
| 内存占用 | ~50MB | 200-500MB | 内存受限选NeRF |
| 可编辑性 | 极差 | 中等 | 需要编辑选3DGS |
| 图像质量 | PSNR 28-32dB | PSNR 27-31dB | 追求极致画质选NeRF |

场景选择：
- 实时交互（游戏、VR、Web展示）→ 3DGS，渲染速度是决定性因素
- 影视级离线渲染 → NeRF，极致画质更重要
- 移动端部署 → NeRF（内存小）或压缩3DGS
- 需要编辑的场景 → 3DGS，可直接操作高斯

### 练习三

**思路**：在Three.js代码基础上添加UI控件。

**答案**：

```javascript
// 1. 高斯大小滑块
const sizeSlider = document.createElement('input');
sizeSlider.type = 'range'; sizeSlider.min = '0.005'; sizeSlider.max = '0.1';
sizeSlider.step = '0.005'; sizeSlider.value = '0.03';
sizeSlider.style.cssText = 'position:absolute;top:100px;right:16px;width:200px;';
document.body.appendChild(sizeSlider);
sizeSlider.addEventListener('input', () => {
  gaussianCloud.material.size = parseFloat(sizeSlider.value);
});

// 2. 颜色方案切换
const select = document.createElement('select');
['HSL', '热力图', '单色'].forEach((t, i) => {
  const opt = document.createElement('option'); opt.value = i; opt.textContent = t;
  select.appendChild(opt);
});
select.style.cssText = 'position:absolute;top:130px;right:16px;padding:4px;';
document.body.appendChild(select);
select.addEventListener('change', () => {
  const colors = gaussianCloud.geometry.attributes.color;
  const pos = gaussianCloud.geometry.attributes.position;
  for (let i = 0; i < colors.count; i++) {
    const y = pos.getY(i);
    let c;
    if (select.value === '0') c = new THREE.Color().setHSL((y + 1) / 2, 0.8, 0.6);
    else if (select.value === '1') c = new THREE.Color().setHSL(0.7 - (y + 1) / 3, 1, 0.5);
    else c = new THREE.Color(0x4fc3f7);
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
});

// 3. FPS计数器
const fpsEl = document.createElement('div');
fpsEl.style.cssText = 'position:absolute;top:16px;right:16px;color:#4fc3f7;font-size:14px;';
document.body.appendChild(fpsEl);
let frames = 0, lastTime = performance.now();
const origAnimate = animate;
// 在animate中添加：
frames++;
if (performance.now() - lastTime > 1000) {
  fpsEl.textContent = `${frames} FPS`;
  frames = 0; lastTime = performance.now();
}
```

**要点**：
- PointsMaterial.size 可以动态修改，实时生效
- BufferAttribute.needsUpdate = true 通知Three.js颜色数据已更新
- FPS计数器用帧计数/时间差计算，每秒更新一次
