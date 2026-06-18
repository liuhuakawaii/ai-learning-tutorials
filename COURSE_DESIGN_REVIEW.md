# 课程项目化评估与优化记录

## 评估角度

本仓库的课程不只检查“知识点是否齐全”，还统一用下面这套标准评估：

1. 是否有一个贯穿项目，而不是每章都临时换题。
2. 每个阶段是否有可交付产物，例如报告、代码、测试、部署清单或指标对比。
3. 最终项目是否能运行、能检查，或者至少能用脚本验证核心结构。
4. 讲义、阶段 README、最终项目说明是否互相引用，避免学员找不到项目入口。
5. 技术内容是否过时，尤其是 AI API、Web Vitals、CI/CD、认证和部署部分。
6. 是否有明确验收标准，而不是只说“完成一个项目”。

## 课程处理策略

| 课程 | 原问题 | 优化方式 |
|------|--------|----------|
| `frontend-performance-course` | 有路线但缺少真实 demo | 已补 `performance-rescue-demo`，包含 slow/work/optimized/monitor 和 LHCI |
| `backend-course` | 已有完整项目，但课程入口偏讲义式 | 保留现有可运行 API，补阶段映射和项目验收闭环 |
| `spider-course` | 没有独立 final-project，练习依赖外部站点 | 补离线 fixtures 采集项目，避免网络和合规不确定性 |
| `ai-app-course` | 内容完整但缺少可验证 demo | 补离线 RAG + 引用 + eval project kit，用于练习数据流和评估 |
| `data-product-course` | 最终项目只有说明，没有最小闭环 | 补 CSV → ETL → SQLite → API → Dashboard demo |
| `docker-cicd-course` | 部署课缺少可检查模板 | 补 Production Launch Kit，包含 API、Dockerfile、Compose、CI、脚本和检查器 |
| `nextjs-fullstack-course` | 产品范围大，但缺少统一骨架 | 补 Micro SaaS Starter scaffold，包含路由、Prisma schema、权限矩阵和检查器 |
| `03-llm-eval-course` | 新增课程，补齐 AI 评估能力 | 5 阶段 30 课时，评估对象直接来自 01/02 课程产出 |
| `04-multi-agent-course` | 新增课程，多 Agent 编排进阶 | 5 阶段 30 课时，基于 02 课程的 Agent 基础扩展 |
| `05-mcp-dev-course` | 新增课程，MCP 协议深度开发 | 4 阶段 24 课时，从协议层到生态集成 |
| `06-llm-finetuning-course` | 新增课程，开源模型部署与微调 | 5 阶段 30 课时，LoRA/QLoRA 实战到部署 |
| `07-multimodal-ai-course` | 新增课程，多模态 AI 应用 | 5 阶段 30 课时，视觉/语音/文档/多模态 RAG |
| `graduation-project` | 毕业项目，串联全部 AI 课程 | AI 数据分析平台，多 Agent + MCP + RAG + 评估 |

## 保留风险

- `nextjs-fullstack-course` 当前补的是轻量 scaffold，不是完整可运行 SaaS。它适合做课程骨架和验收锚点，后续可以逐步扩成完整 Next.js app。
- `ai-app-course` 的 project kit 默认离线运行，不直接调用真实模型。这样能稳定练 RAG、引用和评估；接入真实 OpenAI API 可作为后续阶段任务。
- `docker-cicd-course` 的检查器验证文件结构和关键安全点；真实镜像构建仍依赖本机 Docker 环境。
