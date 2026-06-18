# 从零到一：多模态 AI 应用实战课程

> 突破纯文本边界，掌握图像、语音、文档等多模态 AI 能力的工程实践

## 适合谁

- 想让 AI 应用处理图片、语音、视频而不只是文本的开发者
- 需要构建文档理解、图像分析、语音交互等场景产品的团队
- 学完了前面几门 AI 课程、想扩展能力边界的技术人员
- 对多模态大模型（GPT-4o / Claude Vision / Gemini）感兴趣的产品工程师

## 学完能做什么

- 用多模态大模型实现图像理解、OCR、图表分析等视觉能力
- 搭建语音交互 pipeline：语音识别（ASR）+ 语音合成（TTS）
- 处理复杂文档（PDF / Word / 扫描件）的结构化提取
- 构建多模态 RAG：图文混合检索与跨模态问答
- 开发一个支持文本 + 图片 + 语音 + 文档输入的多模态 AI 应用

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | Python 3.12 / TypeScript |
| 视觉 API | GPT-4o / Claude Vision / Gemini Pro Vision |
| 图像生成 | DALL-E 3 / Stable Diffusion |
| ASR | Whisper / Azure Speech / SenseVoice |
| TTS | OpenAI TTS / Edge-TTS / Coqui TTS |
| 文档处理 | Unstructured / Docling / Marker |
| 向量检索 | CLIP / ColPali（图文向量化） |
| 框架 | FastAPI + Next.js |
| 部署 | Docker + Docker Compose |

## 学习路线

### 第 1 阶段：视觉与图像（6 课时）

> 让 AI 看懂图片

1. 多模态模型概览 — GPT-4o / Claude Vision / Gemini 的能力对比
2. 图像理解实战 — 用 Vision API 实现图片描述、分类、信息提取
3. OCR 与文档图片 — 从图片中提取文字和表格
4. 图表理解 — 让 AI 解读柱状图、折线图、流程图
5. 图像生成 — DALL-E 3 / Stable Diffusion 的集成与 Prompt 工程
6. 阶段实战：构建一个商品图片智能分析系统（提取信息 + 生成描述）

### 第 2 阶段：语音与音频（6 课时）

> 让 AI 听懂和开口说话

1. 语音识别概览 — Whisper / SenseVoice / Azure ASR 的选型
2. Whisper 实战 — 本地部署 Whisper 实现高质量语音转文字
3. 语音合成 — OpenAI TTS / Edge-TTS 的集成与音色选择
4. 实时语音交互 — 构建一个语音对话的 AI 助手原型
5. 音频分析 — 会议录音摘要、情感分析、说话人分离
6. 阶段实战：构建一个语音驱动的 AI 助手（ASR → LLM → TTS）

### 第 3 阶段：文档理解（6 课时）

> 让 AI 处理复杂的非结构化文档

1. 文档处理概览 — PDF / Word / 扫描件 / 表格的处理挑战
2. 文档解析 — Unstructured / Docling 的文档拆分与结构化
3. 表格提取 — 从 PDF 和图片中提取结构化表格数据
4. 长文档处理 — 大文档的分块策略与上下文管理
5. 文档问答 — 基于文档内容的智能问答系统
6. 阶段实战：构建一个合同/发票智能解析系统

### 第 4 阶段：多模态 RAG（6 课时）

> 实现图文混合的检索增强生成

1. 多模态 Embedding — CLIP / ColPali 的图文向量化原理
2. 图文混合索引 — 将图片和文本存储到同一个向量空间
3. 跨模态检索 — 用文字搜图片、用图片搜文字
4. 多模态 RAG Pipeline — 图文混合检索 + 多模态 LLM 生成
5. 评估多模态 RAG — 多模态场景下的评估指标与方法（复用 03 课程）
6. 阶段实战：构建一个多模态知识库（支持图片 + 文本混合检索问答）

### 第 5 阶段：多模态应用整合（6 课时）

> 将所有模态能力整合成一个完整的应用

1. 多模态架构设计 — 统一输入层 / 模态路由 / 融合推理
2. 输入处理网关 — 统一处理文本、图片、语音、文档的输入
3. 多模态 Agent — 让 Agent 具备视觉和听觉能力（复用 02 课程）
4. 流式多模态输出 — 图文混排、语音流式输出的前端渲染
5. 性能与成本 — 多模态调用的 Token 计算、延迟优化、缓存策略
6. 阶段实战：构建一个支持文本 + 图片 + 语音 + 文档的全能 AI 助手

### 最终项目

详见 [final-project/项目说明.md](./final-project/项目说明.md)

构建一个多模态 AI 知识助手：支持文本问答、图片分析、语音交互、文档解析，集成多模态 RAG 和可观测性系统。

## 学习建议

1. **先学完 01 和 02 课程**：本课程的多模态 RAG 和 Agent 部分依赖前序课程基础
2. **API 成本注意**：多模态 API（尤其图片和视频）的费用远高于纯文本，做好预算
3. **从具体场景出发**：不要泛泛学"多模态"，选一个实际场景（如文档解析、商品分析）深入
4. **结合 03 课程做评估**：多模态输出的质量更难评估，需要专门的评估方法
5. **关注延迟**：图片和语音处理的延迟比文本高很多，需要异步和流式处理

## 参考官方文档

- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)
- [Claude Vision](https://docs.anthropic.com/en/docs/build-with-claude/vision)
- [Whisper](https://platform.openai.com/docs/guides/speech-to-text)
- [CLIP](https://openai.com/research/clip)
- [Unstructured](https://docs.unstructured.io/)
- [Stable Diffusion](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)
