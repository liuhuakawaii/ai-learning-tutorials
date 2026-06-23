# 第三阶段：3D Shader

从 2D 进入 3D，用 Ray Marching 技术在纯 Fragment Shader 中渲染三维场景，包括体积效果、光线追踪和程序化地形生成。

## 课时列表

| 课时 | 标题 |
|------|------|
| 11 | [Ray Marching——用 Shader 渲染 3D 场景（不使用三角形）](11-ray-marching.md) |
| 12 | [体积渲染——云/烟/火的体积效果](12-volume-rendering.md) |
| 13 | [光线追踪——纯 Shader 实现反射/折射/软阴影](13-ray-tracing.md) |
| 14 | [程序化地形——噪声 + 位移 + 法线生成](14-procedural-terrain.md) |
| 15 | [阶段实战：用 Ray Marching 构建 3D 场景浏览器](15-3d-scene-browser.md) |

## 验收标准

- 能用 Ray Marching 渲染带反射和阴影的 3D 场景
- 能实现体积渲染效果（云、烟、火）
- 能用噪声生成程序化地形并计算法线
- 理解光线追踪在纯 Shader 中的实现原理
- 完成 3D 场景浏览器，支持鼠标交互查看场景
