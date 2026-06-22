# RAG 工程化实战课程

> 从"能用"到"好用"——掌握 RAG 系统的架构设计、性能优化和生产部署

## 适合谁

- 已经做过基础 RAG 但效果不理想的开发者
- 需要在生产环境中部署 RAG 系统的工程师
- 想了解最新 RAG 技术（GraphRAG、Agentic RAG）的技术人员

## 前置要求

- **必修前置**：01-ai-app-course
- **建议前置**：03-llm-eval-course
- **技术基础**：Python 3.12，了解向量数据库基础

## 课程大纲

### Stage 1: RAG 基础回顾与进阶 (6 lessons)

| # | 课程 | 主题 |
|---|------|------|
| 01 | [RAG架构回顾](stage1-rag-fundamentals/01-RAG架构回顾.md) | RAG 核心流程回顾，从 Naive RAG 到 Advanced RAG 的演进 |
| 02 | [文档解析进阶](stage1-rag-fundamentals/02-文档解析进阶-表格与图片.md) | 表格、图片、PDF 等复杂文档的解析策略 |
| 03 | [分块策略深度](stage1-rag-fundamentals/03-分块策略深度.md) | 语义分块、递归分块、文档级分块的工程实践 |
| 04 | [Embedding模型选型](stage1-rag-fundamentals/04-Embedding模型选型.md) | 主流 Embedding 模型对比与选型指南 |
| 05 | [向量数据库对比](stage1-rag-fundamentals/05-向量数据库对比.md) | Milvus、Qdrant、Weaviate、Pinecone 全面对比 |
| 06 | [阶段实战](stage1-rag-fundamentals/06-阶段实战-构建高质量RAG基线.md) | 构建高质量 RAG 基线系统 |

### Stage 2: 检索优化 (6 lessons)

| # | 课程 | 主题 |
|---|------|------|
| 01 | [混合检索](stage2-retrieval-optimization/01-混合检索-向量加关键词.md) | 向量检索 + BM25 关键词检索的融合策略 |
| 02 | [重排序Reranking](stage2-retrieval-optimization/02-重排序Reranking.md) | Cross-Encoder 重排序与 RRF 融合 |
| 03 | [查询改写与扩展](stage2-retrieval-optimization/03-查询改写与扩展.md) | HyDE、Multi-Query、Step-Back 等查询优化技术 |
| 04 | [多路召回策略](stage2-retrieval-optimization/04-多路召回策略.md) | 多路召回架构设计与结果融合 |
| 05 | [检索评估指标](stage2-retrieval-optimization/05-检索评估指标.md) | Recall@K、MRR、NDCG 等检索指标详解 |
| 06 | [阶段实战](stage2-retrieval-optimization/06-阶段实战-检索质量优化.md) | 检索质量优化综合实战 |

### Stage 3: 高级 RAG 架构 (6 lessons)

| # | 课程 | 主题 |
|---|------|------|
| 01 | [Self-RAG](stage3-advanced-rag/01-Self-RAG自适应检索.md) | 自适应检索决策与反思机制 |
| 02 | [GraphRAG](stage3-advanced-rag/02-GraphRAG知识图谱增强.md) | 知识图谱增强的 RAG 架构 |
| 03 | [Agentic RAG](stage3-advanced-rag/03-Agentic-RAG智能检索.md) | Agent 驱动的智能检索系统 |
| 04 | [多模态RAG](stage3-advanced-rag/04-多模态RAG.md) | 图文混合检索与多模态生成 |
| 05 | [层级检索](stage3-advanced-rag/05-层级检索HIERARCHICAL.md) | Hierarchical Retrieval 架构设计 |
| 06 | [阶段实战](stage3-advanced-rag/06-阶段实战-实现Self-RAG.md) | 实现完整的 Self-RAG 系统 |

### Stage 4: RAG 生产化 (6 lessons)

| # | 课程 | 主题 |
|---|------|------|
| 01 | [性能优化](stage4-rag-production/01-RAG系统的性能优化.md) | 延迟优化、吞吐提升、资源管理 |
| 02 | [缓存策略](stage4-rag-production/02-缓存策略.md) | 语义缓存、结果缓存、多级缓存架构 |
| 03 | [流式RAG](stage4-rag-production/03-流式RAG.md) | 流式检索与流式生成的实现 |
| 04 | [安全防御](stage4-rag-production/04-RAG安全-注入防御.md) | Prompt Injection 防御与数据安全 |
| 05 | [可观测性](stage4-rag-production/05-RAG可观测性.md) | 日志、追踪、监控三位一体 |
| 06 | [阶段实战](stage4-rag-production/06-阶段实战-部署生产级RAG.md) | 部署生产级 RAG 系统 |

### Stage 5: RAG 评估与持续优化 (6 lessons)

| # | 课程 | 主题 |
|---|------|------|
| 01 | [评估体系设计](stage5-evaluation/01-RAG评估体系设计.md) | 端到端 RAG 评估框架设计 |
| 02 | [RAGAS实战](stage5-evaluation/02-RAGAS深度实战.md) | RAGAS 框架深度使用与自定义 |
| 03 | [人工评估](stage5-evaluation/03-人工评估与标注.md) | 评估流程设计与标注平台搭建 |
| 04 | [A/B测试](stage5-evaluation/04-A-B测试与灰度发布.md) | RAG 系统的 A/B 测试方法论 |
| 05 | [持续优化](stage5-evaluation/05-持续优化闭环.md) | 数据飞轮与持续改进机制 |
| 06 | [阶段实战](stage5-evaluation/06-阶段实战-RAG评估pipeline.md) | 构建自动化 RAG 评估 Pipeline |

### 最终项目

[Production RAG System](final-project/项目说明.md) — 构建一个完整的生产级 RAG 系统

## 学习建议

1. **按顺序学习**：每个 Stage 建议顺序完成，Stage 间有递进关系
2. **动手实践**：每课都有配套练习，建议全部完成
3. **阶段实战**：每个 Stage 最后一课是综合实战，务必完成
4. **最终项目**：完成所有 Stage 后，用最终项目检验学习成果

## 技术栈

- **Python**: 3.12+
- **LLM 框架**: LangChain, LlamaIndex
- **向量数据库**: Milvus, Qdrant, Weaviate, Pinecone
- **Embedding**: OpenAI, Cohere, BGE, GTE
- **评估**: RAGAS, DeepEval
- **部署**: FastAPI, Docker, Kubernetes
- **监控**: LangSmith, Phoenix, Grafana

## 课程结构

```
rag-engineering-course/
├── README.md                    # 课程总览
├── requirements.txt             # 课程级依赖
├── stage1-rag-fundamentals/     # Stage 1: RAG 基础回顾与进阶
├── stage2-retrieval-optimization/ # Stage 2: 检索优化
├── stage3-advanced-rag/         # Stage 3: 高级 RAG 架构
├── stage4-rag-production/       # Stage 4: RAG 生产化
├── stage5-evaluation/           # Stage 5: RAG 评估与持续优化
└── final-project/               # 最终项目
```
