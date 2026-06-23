# Shader 艺术与创意编码

> 用代码画画——每节课产出一个视觉作品。

## 适合谁

- 想用代码创造视觉艺术，但不知道从哪开始
- 看 Shadertoy 上的作品觉得很酷，但自己写不出来
- 想理解 Shader 的底层原理，不只是抄模板

## 学完能做什么

- 用 GLSL Fragment Shader 绘制任意形状、生成动态效果
- 用 Ray Marching 渲染 3D 场景（不使用三角形）
- 实现流体、噪声、分形等程序化效果
- 构建风格化渲染（卡通/像素化/故障艺术）
- 构建一个在线 Shader 创作工具

## 学习路线

### 第一阶段：Fragment Shader 基础

1. GLSL 基础——uniform/varying/内置函数、坐标系统
2. 形状绘制——圆/矩形/多边形的 SDF（有符号距离场）
3. 颜色空间——HSL/HSV、渐变、调色板设计
4. 噪声——Value Noise、Perlin Noise、Simplex Noise
5. 阶段实战：用纯 Shader 画一个动态抽象画

### 第二阶段：动态效果

6. 分形——Mandelbrot/Julia 集、分形噪声
7. 波浪——正弦波叠加、FFT、水面模拟
8. 粒子场——基于 Shader 的粒子系统
9. 万花筒/对称——极坐标变换、镜像效果
10. 阶段实战：构建实时 Shader 可视化音乐播放器

### 第三阶段：3D Shader

11. Ray Marching——用 Shader 渲染 3D 场景（不使用三角形）
12. 体积渲染——云/烟/火的体积效果
13. 光线追踪——纯 Shader 实现反射/折射/软阴影
14. 程序化地形——噪声 + 位移 + 法线生成
15. 阶段实战：用 Ray Marching 构建 3D 场景浏览器

### 第四阶段：风格化渲染

16. 卡通渲染——描边/色阶/高光的 NPR 技术
17. 像素艺术——像素化/抖动/调色板限制
18. 故障艺术——数据损坏效果、CRT 扫描线
19. 生成艺术——算法艺术、参数化设计
20. 阶段实战：构建风格化渲染引擎

### 第五阶段：实时创意工具

21. Shader 编辑器——实时预览、热重载、参数面板
22. Shadertoy 移植——从 Shadertoy 到 Three.js/WebGPU
23. 交互式 Shader——鼠标/触摸/音频输入驱动
24. Shader 动画——时间轴控制、关键帧、缓动函数
25. 阶段实战：构建在线 Shader 创作工具

## 验收标准

- 能用 SDF 绘制任意 2D 形状并做布尔运算
- 能用 Ray Marching 渲染一个带反射和阴影的 3D 场景
- 能实现噪声/分形/流体等程序化效果
- 能实现卡通渲染/故障艺术等风格化效果
- 能构建一个支持实时预览的 Shader 编辑器

## 参考资源

- Shadertoy：https://www.shadertoy.com/
- The Book of Shaders：https://thebookofshaders.com/
- Inigo Quilez 的文章：https://iquilezles.org/
- GLSL Sandbox：https://glslsandbox.com/
