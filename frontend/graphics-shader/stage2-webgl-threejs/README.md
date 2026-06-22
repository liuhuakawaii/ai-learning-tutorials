# Stage 2：WebGL 与 Three.js

从 WebGL 的底层渲染管线入手，理解 GPU 是如何把顶点数据变成像素的；然后切换到 Three.js，在更高抽象层高效搭建 3D 场景。本阶段是"会用 Three.js"和"理解 Three.js"的分水岭。

## 课时列表

| 序号 | 文件 | 主题 |
|------|------|------|
| 01 | WebGL 渲染管线概述.md | GPU 渲染流程、顶点处理→光栅化→片元输出的完整链路 |
| 02 | 第一个 WebGL 三角形.md | Canvas 初始化、Shader 编译链接、drawArrays 调用 |
| 03 | 缓冲区与属性.md | VBO/VAO、顶点属性布局、索引缓冲区 |
| 04 | Three.js 核心概念与场景搭建.md | Scene/Camera/Renderer 三角、坐标系、渲染循环 |
| 05 | 几何体与材质.md | 内置几何体、BufferGeometry、MeshStandardMaterial 等材质类型 |
| 06 | 光照系统.md | 环境光/方向光/点光/聚光灯、阴影原理与配置 |
| 07 | 相机与控制器.md | PerspectiveCamera/OrthographicCamera、OrbitControls、FlyControls |
| 08 | 模型加载（glTF/FBX/OBJ）.md | GLTFLoader、模型优化、DRACO 压缩 |
| 09 | 动画系统.md | AnimationMixer、关键帧动画、骨骼动画基础 |
| 10 | Three.js 性能优化.md | 实例化渲染、LOD、视锥裁剪、纹理压缩 |
| 11 | React Three Fiber 入门.md | 声明式 3D 开发、useFrame/useThree Hooks |
| 12 | React Three Fiber 进阶模式.md | 自定义组件、Drei 工具库、与 React 状态管理集成 |

## 学习目标

- 理解 WebGL 渲染管线各阶段的作用，能手写一个最小 WebGL 程序
- 掌握 Three.js 的 Scene/Camera/Renderer 核心三件套
- 能加载外部 3D 模型并正确配置材质、光照和阴影
- 实现相机控制与基础动画
- 了解性能优化手段：实例化渲染、LOD、纹理压缩
- 能用 React Three Fiber 以声明式方式构建 3D 场景

## 阶段交付物

- **WebGL 基础 Demo**：手写 WebGL 三角形 + 立方体旋转（不依赖框架）
- **Three.js 场景项目**：搭建一个包含模型加载、光照、阴影、相机控制的完整场景
- **R3F 入门项目**：用 React Three Fiber 重构上述场景，对比两种开发模式
- **验证通过**：运行 `npm run check` 通过 Stage 2 的场景搭建验证
