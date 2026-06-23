# 第一阶段：地形生成

掌握噪声算法在地形生成中的应用——Perlin/Simplex/Worley 噪声、多层叠加高度图、地形特征塑造和侵蚀模拟，生成一个有山有水的地形。

## 课时列表

| 课时 | 标题 |
|------|------|
| 01 | [噪声基础——Perlin/Simplex/Worley 噪声的工程实现](01-noise-basics.md) |
| 02 | [高度图生成——多层噪声叠加、Domain Warping](02-heightmap-generation.md) |
| 03 | [地形特征——山峰、山谷、平原、海岸线的生成](03-terrain-features.md) |
| 04 | [侵蚀模拟——热力侵蚀、水力侵蚀的简化实现](04-erosion-simulation.md) |
| 05 | [阶段实战：生成一个有山有水的地形并渲染](05-terrain-rendering.md) |

## 验收标准

- 能实现 Perlin/Simplex/Worley 三种噪声算法
- 能用多层噪声叠加和 Domain Warping 生成自然高度图
- 能生成山峰、山谷、平原、海岸线等地形特征
- 能实现简化版侵蚀模拟使地形更真实
- 完成地形生成并渲染，地形有明显山体和水体
