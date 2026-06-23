# 第一阶段：Fragment Shader 基础

掌握 GLSL 的核心语法与坐标系统，学会用 SDF 绘制 2D 形状、设计调色板、使用噪声生成纹理，最终用纯 Shader 创作一幅动态抽象画。

## 课时列表

| 课时 | 标题 |
|------|------|
| 01 | [GLSL 基础——uniform/varying/内置函数、坐标系统](01-glsl-basics.md) |
| 02 | [SDF 形状——圆/矩形/多边形的有符号距离场](02-sdf-shapes.md) |
| 03 | [颜色空间——HSL/HSV、渐变、调色板设计](03-color-spaces.md) |
| 04 | [噪声——Value Noise、Perlin Noise、Simplex Noise](04-noise.md) |
| 05 | [阶段实战：用纯 Shader 画一个动态抽象画](05-dynamic-abstract-art.md) |

## 验收标准

- 能独立编写 GLSL Fragment Shader，理解 uniform/varying/内置函数的作用
- 能用 SDF 绘制任意 2D 形状并进行布尔运算（并集、交集、差集）
- 能用 HSL/HSV 空间设计调色板并实现平滑渐变
- 能使用至少两种噪声算法生成自然纹理
- 完成动态抽象画作品，Shader 可在浏览器中实时运行
