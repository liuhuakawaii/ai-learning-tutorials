# AI + 3D 生成与数字人

> 从文本/图像到 3D 资产，从静态模型到实时驱动数字人——构建企业级数字人应用的完整能力栈。

## 这门课解决什么问题

2025-2026 年，3D 生成和数字人技术经历了爆发式增长。TripoSR 1 秒生成 3D 模型，Gaussian Splatting 实现实时神经渲染，LivePortrait 让一张照片"活"起来。企业端需求同样暴涨：虚拟主播、数字员工、电商虚拟试穿、在线教育数字教师——这些不再是概念 demo，而是正在上线的商业产品。

但这门课不是教你用 HeyGen 或 D-ID 这类 SaaS 产品点几下按钮。它要解决的是：

- **理解底层原理**：3D Gaussian Splatting、NeRF、面部驱动模型到底怎么工作
- **掌握工程能力**：从模型推理到实时渲染到交互系统，每一环都能自己搭建
- **交付企业级产品**：数字人直播系统、虚拟客服、3D 电商展示，从原型到上线

## 前置要求

- Python 基础，能写推理脚本
- 了解基本的 3D 概念（顶点、面、纹理）者更佳，非必需
- 有 Web 前端基础（HTML/CSS/JS）用于交互式展示

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 3D 生成 | TripoSR / InstantMesh / Wonder3D | 2024-2026 主流 3D 生成模型 |
| 神经渲染 | 3D Gaussian Splatting / NeRF | 实时神经渲染技术 |
| 数字人驱动 | SadTalker / ER-NeRF / LivePortrait | 音频/视频驱动面部动画 |
| 语音合成 | CosyVoice / GPT-SoVITS / Fish Speech | 2025-2026 开源 TTS 一线方案 |
| 3D 引擎 | Three.js / WebGPU | Web 端实时 3D 渲染 |
| 后端 | FastAPI + Python | 推理服务与 API |
| 前端 | Vue 3 / React | 交互式 3D 展示界面 |
| 部署 | Docker + ONNX / TensorRT | 模型优化与服务化部署 |

## 学习路线

```
Part 1              Part 2              Part 3              Part 4
3D 资产生成         数字人核心技术       实时驱动与交互       企业级应用
文本/图像→3D       面部驱动/语音合成    实时渲染/交互控制    直播/客服/电商
    │                   │                   │                   │
    └───────────────────┴───────────────────┴───────────────────┘
                            │
                            ▼
                      毕业项目
                  数字人直播系统
```

## 课程大纲

### Part 1：3D 资产 AI 生成（6 课时）

> 从文本和图像生成 3D 模型，理解 NeRF 和 Gaussian Splatting 的核心原理

1. 3D 生成技术全景——从 Photogrammetry 到 AI 生成的演进
2. NeRF 原理与实践——神经辐射场的数学直觉与工程实现
3. 3D Gaussian Splatting 深度解析——为什么它能实时渲染
4. 文本驱动 3D 生成——Point-E / Shap-E / Tripo3D 的架构与局限
5. 图像驱动 3D 重建——TripoSR / InstantMesh / Wonder3D 实战
6. **阶段实战：构建 3D 资产生成 Pipeline**

### Part 2：数字人核心技术（8 课时）

> 从一张照片到能说话、能动的数字人

7. 数字人技术栈全景——建模、驱动、渲染、交互四层架构
8. 3D 人脸建模——FLAME / 3DMM 参数化模型与 Blendshape
9. 音频驱动面部动画——SadTalker 架构深度解析
10. 视频驱动表情迁移——LivePortrait / face-vid2vid 实战
11. 语音合成（TTS）——CosyVoice / GPT-SoVITS 原理与微调
12. 语音克隆——少样本声音克隆的工程实践
13. 全身动作生成——Audio2Body / MotionDiffuse
14. **阶段实战：从照片到可对话数字人**

### Part 3：实时驱动与交互（6 课时）

> 让数字人能实时响应、能交互

15. 实时渲染架构——WebGPU / Three.js 实时 3D 渲染
16. 实时面部驱动——延迟优化与帧率保障
17. 实时语音交互——ASR + LLM + TTS 的实时 Pipeline
18. 多模态交互设计——语音、手势、表情的融合
19. 数字人对话系统——记忆、情感、个性化
20. **阶段实战：实时交互式数字人**

### Part 4：企业级应用落地（6 课时）

> 真实商业场景的工程化

21. 虚拟主播系统——直播推流、弹幕互动、商品讲解
22. 数字员工——企业客服、培训、会议纪要
23. 3D 电商——虚拟试穿、3D 商品展示、AR 预览
24. 在线教育——数字教师、课件生成、互动教学
25. 性能优化与成本控制——模型量化、推理加速、GPU 调度
26. **阶段实战：数字人直播系统 MVP**

### 毕业项目：数字人直播系统

整合全部所学，构建一个完整的数字人直播系统：
- 数字人形象生成——从照片/文本生成 3D 数字人
- 实时驱动——语音驱动面部动画，延迟 < 200ms
- 对话系统——接入 LLM，支持多轮对话
- 直播推流——RTMP 推流到直播平台
- 弹幕互动——实时读取弹幕并响应
- 运营后台——数据统计、话术管理、商品配置

详见 [项目说明](final-project/项目说明.md)

## 学习建议

1. **先跑通 demo，再理解原理**。3D 生成和数字人的数学门槛较高，先用现成模型跑出效果建立信心
2. **关注推理延迟**。实时数字人对延迟极敏感，每一步优化都要量化
3. **多看开源项目源码**。SadTalker、LivePortrait、Gaussian Splatting 的源码是最好的教材
4. **动手改造模型**。不要只调 API，理解模型输入输出后尝试微调和优化

## 参考资料

- 3D Gaussian Splatting: https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
- TripoSR: https://github.com/VAST-AI-Research/TripoSR
- SadTalker: https://github.com/OpenTalker/SadTalker
- LivePortrait: https://github.com/KwaiVGI/LivePortrait
- CosyVoice: https://github.com/FunAudioLLM/CosyVoice
- GPT-SoVITS: https://github.com/RVC-Boss/GPT-SoVITS
- Three.js: https://threejs.org/
