# AI 图像编辑与生成工作流

> 从理解 Diffusion 原理到掌握 ComfyUI 工作流，再到构建企业级图像自动化生产流水线。

## 这门课解决什么问题

AI 图像生成已经从"能生成一张好看的图"进化到"能批量生产符合商业标准的图像资产"。Stable Diffusion 3、FLUX.1 的图像质量已经达到商业可用水平，ComfyUI 让复杂的图像处理流程变成可视化的节点编排。但企业要的不是一张张手动生成的图——他们需要的是：

- 一套可复用的图像生产工作流，设计师能配置、能调整
- 一套模型训练能力，能用自己的品牌风格微调模型
- 一套批量生产系统，一次处理 1000 张商品图
- 一套质量控制流程，自动检测不合格图像

这门课从 Diffusion 的数学原理讲起，但不纠缠公式——重点是让你理解"为什么这样设计"，然后用 ComfyUI 搭建从简单到复杂的图像工作流，最终构建企业级图像自动化平台。

## 前置要求

- Python 基础
- 了解基本的图像处理概念（像素、分辨率、色彩空间）
- 有使用过 AI 图像生成工具（Midjourney / SD WebUI）的经验更佳

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 基础模型 | Stable Diffusion 3 / FLUX.1 / SDXL | 2024-2026 主流文生图模型 |
| 工作流引擎 | ComfyUI | 节点式图像处理工作流 |
| 微调训练 | kohya-ss / LoRA / DreamBooth | 模型微调工具链 |
| 控制网络 | ControlNet / IP-Adapter / InstantID | 精确控制图像生成 |
| 图像增强 | Real-ESRGAN / GFPGAN / CodeFormer | 超分辨率与人脸修复 |
| 后端 | FastAPI + Celery | 异步任务队列 |
| 存储 | MinIO + PostgreSQL | 图像资产与元数据管理 |
| 部署 | Docker + TensorRT | 模型优化与服务化 |

## 学习路线

```
Part 1              Part 2              Part 3              Part 4
Diffusion 原理      ComfyUI 精通        模型训练与微调      企业级图像生产
数学直觉/噪声/采样  节点/工作流/自定义   LoRA/DreamBooth     批量/质量/自动化
    │                   │                   │                   │
    └───────────────────┴───────────────────┴───────────────────┘
                            │
                            ▼
                      毕业项目
                电商图像自动化平台
```

## 课程大纲

### Part 1：Diffusion 原理与工程实践（6 课时）

> 理解 AI 图像生成的底层原理，不是背公式，而是建立工程直觉

1. 从 GAN 到 Diffusion——图像生成技术的演进与选型
2. Diffusion 的数学直觉——前向加噪与反向去噪的可视化理解
3. Stable Diffusion 架构解析——UNet / DiT / VAE / Text Encoder 各自职责
4. 采样器工程——Euler / DPM-Solver / UniPC 的速度与质量权衡
5. Prompt 工程进阶——权重、负提示词、分步提示、风格控制
6. **阶段实战：从零实现一个简化版 Diffusion 推理引擎**

### Part 2：ComfyUI 工作流精通（8 课时）

> 掌握节点式图像处理工作流，从简单到复杂

7. ComfyUI 核心概念——节点、连接、执行图、缓存机制
8. 基础文生图工作流——搭建第一个可运行的工作流
9. 图生图与 Inpainting——局部重绘、扩展、风格迁移
10. ControlNet 深度实战——深度图、边缘、姿态、法线精确控制
11. IP-Adapter 与 InstantID——图像驱动的角色一致性
12. 高清修复与超分——Tiled Diffusion + ADetailer + Real-ESRGAN
13. 自定义节点开发——Python 编写 ComfyUI 自定义节点
14. **阶段实战：电商商品图批量处理工作流**

### Part 3：模型训练与微调（6 课时）

> 用企业自己的数据训练专属模型

15. 训练数据准备——采集、清洗、标注、增强的完整流程
16. LoRA 训练实战——理解 LoRA 原理，用 kohya-ss 训练品牌风格 LoRA
17. DreamBooth 与 Textual Inversion——少量样本的角色/IP 微调
18. SDXL / SD3 微调——新架构的训练差异与最佳实践
19. 训练评估与优化——loss 曲线分析、过拟合检测、超参调优
20. **阶段实战：训练品牌风格 LoRA 并集成到工作流**

### Part 4：企业级图像生产流水线（8 课时）

> 从手动生成到自动化批量生产

21. 批量生产架构——任务队列、并发控制、GPU 调度
22. 质量控制系统——美学评分、人脸检测、NSFW 过滤、一致性检查
23. 图像资产管理系统——元数据、版本控制、搜索、权限
24. API 服务化——RESTful API、Webhook、SDK 封装
25. 产品图自动化——白底图、场景图、模特图的自动化生成
26. 营销素材自动化——Banner、海报、社交媒体图的批量生成
27. 设计系统集成——与 Figma / Adobe 的工作流集成
28. **阶段实战：电商图像自动化平台 MVP**

### 毕业项目：电商图像自动化平台

整合全部所学，构建一个完整的电商图像自动化平台：
- 工作流编辑器——可视化配置图像处理流程
- 模型管理——LoRA 模型的上传、切换、版本控制
- 批量任务——CSV/Excel 导入商品信息，批量生成商品图
- 质量审核——自动评分 + 人工审核的工作流
- 资产库——生成图像的搜索、下载、复用
- API 接口——供外部系统调用的 RESTful API

详见 [项目说明](final-project/项目说明.md)

## 学习建议

1. **ComfyUI 是核心**。花大量时间在 ComfyUI 上，它是连接原理和工程的桥梁
2. **理解每个节点的输入输出**。不要只拖节点，要理解每个节点在做什么
3. **训练自己的 LoRA**。这是从"用工具"到"造工具"的分水岭
4. **关注生成质量的量化**。不要只用眼睛看，学习用 CLIP Score、FID 等指标评估

## 参考资料

- Stable Diffusion 3: https://stability.ai/news/stable-diffusion-3
- FLUX.1: https://github.com/black-forest-labs/flux
- ComfyUI: https://github.com/comfyanonymous/ComfyUI
- kohya-ss: https://github.com/kohya-ss/sd-scripts
- ControlNet: https://github.com/lllyasviel/ControlNet
- IP-Adapter: https://github.com/tencent-ailab/IP-Adapter
