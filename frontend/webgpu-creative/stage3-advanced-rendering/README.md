# 第三阶段：高级渲染

掌握延迟渲染、全局光照、阴影映射和后处理等高级渲染技术，在 WebGPU 上构建一个带全局光照的实时渲染器。

## 课时列表

| 课时 | 标题 |
|------|------|
| 11 | [延迟渲染——G-Buffer、光照 Pass、多光源](11-deferred-rendering.md) |
| 12 | [全局光照——Screen Space GI、Voxel GI](12-global-illumination.md) |
| 13 | [阴影——Shadow Mapping、Cascaded Shadow Maps](13-shadow-mapping.md) |
| 14 | [后处理——Tone Mapping、Bloom、TAA](14-post-processing.md) |
| 15 | [阶段实战：构建带全局光照的实时渲染器](15-realtime-gi-renderer.md) |

## 验收标准

- 能实现延迟渲染管线（G-Buffer + 光照 Pass）
- 能实现至少一种全局光照方案（Screen Space GI 或 Voxel GI）
- 能实现 Shadow Mapping 并支持多级联阴影
- 能实现 Bloom、Tone Mapping、TAA 等后处理效果
- 完成带全局光照的实时渲染器，支持多光源和后处理
