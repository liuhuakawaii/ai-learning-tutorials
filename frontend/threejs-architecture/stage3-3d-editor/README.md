# 第三阶段：3D 编辑器架构

## 阶段目标

理解 3D 编辑器的核心架构（选择/变换/撤销/序列化/插件系统），能构建一个简化版 3D 编辑器。

## 课时列表

1. [选择与变换——Raycasting、Gizmo 实现、TransformControls 原理](11-selection-transform.md)
2. [撤销/重做——Command 模式、操作历史、序列化](12-undo-redo.md)
3. [场景序列化——JSON/GLTF 导出、自定义格式设计](13-scene-serialization.md)
4. [插件系统——事件总线、扩展注册、生命周期管理](14-plugin-system.md)
5. [阶段实战：构建简化版 3D 编辑器](15-build-editor.md)

## 验收标准

- 能用 Raycasting 实现 3D 物体选择并用 TransformControls 实现变换操作
- 能用 Command 模式实现撤销/重做功能
- 能将场景序列化为 JSON 或 GLTF 格式并反序列化加载
- 能设计事件总线和插件注册机制支持编辑器扩展
