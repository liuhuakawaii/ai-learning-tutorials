# 沉浸式 3D 交互网站

> Apple、Nike、Porsche 的产品展示页是怎么做的？

## 适合谁

- 想构建视觉冲击力强的品牌官网、产品展示页、数字营销页面
- 会用 Three.js 做基本 3D，但不知道怎么和滚动、动画、后处理联动
- 想从"能做 3D"升级到"能做沉浸式体验"

## 学完能做什么

- 构建滚动驱动的 3D 叙事页面（相机沿路径飞行、模型变形、光影变化）
- 实现 GPU 粒子系统和流体模拟
- 设计 PBR 材质、实时环境反射、程序化纹理
- 搭建后处理链（Bloom/Glitch/景深/运动模糊）
- 将 3D 与 HTML/CSS 混合排版，构建完整的沉浸式网站

## 学习路线

### 第一阶段：滚动驱动的 3D 叙事

1. Scroll-Driven Animation——GSAP ScrollTrigger + Three.js 联动原理
2. 相机动画——沿路径飞行、焦点切换、平滑过渡
3. 模型变形——Morph Targets、顶点动画、过渡效果
4. 光影变化——随滚动改变光照、环境、色调
5. 阶段实战：构建 Apple 风格产品滚动展示页

### 第二阶段：粒子与流体

6. GPU 粒子系统——Transform Feedback、100 万粒子实时渲染
7. 流体模拟——WebGPU Compute Shader 实现 2D/3D 流体
8. 粒子交互——鼠标跟随、力场、粒子流
9. 粒子到模型——粒子聚合/扩散动画
10. 阶段实战：构建全屏粒子交互体验

### 第三阶段：光线与材质

11. 实时光线追踪——WebGPU Ray Tracing、降噪、混合渲染
12. 物理材质——PBR 深度、各向异性、次表面散射
13. 程序化纹理——噪声/分形生成材质（大理石/木纹/地形）
14. 环境光——IBL、反射探针、动态天空
15. 阶段实战：构建实时产品配置器

### 第四阶段：后处理与视觉特效

16. Bloom/Glitch/Chromatic Aberration——后处理链设计
17. 景深与运动模糊——模拟电影镜头效果
18. 风格化渲染——卡通渲染/像素化/故障艺术
19. 画面合成——3D 与 HTML/CSS 混合排版
20. 阶段实战：构建视觉特效展示站

### 第五阶段：完整沉浸式项目

21. 3D 音频可视化——Web Audio + Three.js 联动
22. 交互式 3D 故事——多场景切换、转场动画
23. 多人 3D 空间——WebSocket 实时同步相机位置
24. 性能优化——LOD、实例化、GPU Profiling、移动端适配
25. 阶段实战：构建完整沉浸式 3D 品牌官网

## 验收标准

- 能构建一个滚动驱动的 3D 叙事页面
- 能实现 10 万+ 粒子的 GPU 粒子系统
- 能设计 PBR 材质和环境光照
- 能搭建包含 Bloom/景深/运动模糊的后处理链
- 能将 3D 场景与 HTML/CSS 混合排版

## 参考资源

- Apple 产品页：https://www.apple.com/iphone-16-pro/
- Three.js Journey：https://threejs-journey.com/
- Codrops：https://tympanus.net/codrops/
- Bruno Simon 的作品集：https://bruno-simon.com/
