# 01 RAG 第一性原理

> RAG 不是"给模型加个搜索"——是让 AI 从"凭记忆回答"变成"查资料回答"。

## 场景引入

你负责的客服机器人上线后频繁"编造"产品信息——用户问"星辰科技的专业版多少钱"，模型自信地回答了一个不存在的价格。产品经理要求回答必须引用官方文档原文，用户才能信任。你需要一种机制，让模型在回答前先查阅真实资料，而不是凭训练时的记忆胡说。

## 学习目标

- 理解 RAG 的本质和解决的问题
- 掌握 RAG 架构的核心组件
- 理解 RAG 与微调的适用场景
- 设计企业级 RAG 系统的架构

## 前置要求

- 已完成阶段 1-2，理解 LLM API 和对话系统
- 了解向量和相似度的基本概念

## 为什么需要 RAG

大模型有两个致命缺陷：

1. **知识截止**：训练数据有截止日期，不知道最新信息
2. **幻觉**：不确定时会编造看似合理的答案

RAG（Retrieval-Augmented Generation）的核心思想：**先检索，再生成**。

```
用户问题 → 检索相关文档 → 把文档 + 问题一起给 LLM → LLM 基于文档生成回答
```

### RAG vs 微调

| 维度 | RAG | 微调 |
|------|-----|------|
| 知识更新 | 更新文档即可 | 需要重新训练 |
| 成本 | 低（只需要向量数据库） | 高（GPU、数据标注） |
| 可解释性 | 高（能引用原文） | 低（黑盒） |
| 适用场景 | 知识问答、文档检索 | 风格调整、特定任务 |
| 数据安全 | 数据留在本地 | 数据可能泄露到模型 |

**结论**：企业知识库问答首选 RAG，只有在需要调整模型行为风格时才考虑微调。

## RAG 架构

```
┌─────────────────────────────────────────────────┐
│                  RAG Pipeline                    │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ 文档处理  │ →  │ 向量存储  │ →  │ 检索生成  │  │
│  │ Pipeline  │    │ Database  │    │ Pipeline  │  │
│  └──────────┘    └──────────┘    └──────────┘  │
│                                                  │
│  1. 解析文档      2. 存储向量     3. 检索相关    │
│  3. 切分文本      4. 建立索引     4. 组装 Prompt │
│  5. 生成 Embedding                5. 调用 LLM   │
└─────────────────────────────────────────────────┘
```

### 核心组件

1. **文档加载器**：解析 PDF/Word/网页等格式
2. **文本切分器**：将长文档切成小块
3. **Embedding 模型**：将文本转为向量
4. **向量数据库**：存储和检索向量
5. **检索器**：根据问题检索相关文档
6. **生成器**：基于检索结果生成回答

## RAG 质量评估

```python
class RAGEvaluator:
    """RAG 质量评估"""
    
    async def evaluate(self, test_cases: list[dict]) -> dict:
        results = []
        for case in test_cases:
            # 检索相关文档
            retrieved = await self.retriever.search(case["question"], top_k=5)
            
            # 生成回答
            answer = await self.generator.generate(case["question"], retrieved)
            
            # 评估
            results.append({
                "question": case["question"],
                "retrieval_score": self._eval_retrieval(retrieved, case["relevant_docs"]),
                "answer_score": self._eval_answer(answer, case["expected_answer"]),
                "faithfulness": self._eval_faithfulness(answer, retrieved),
            })
        
        return {
            "avg_retrieval_score": sum(r["retrieval_score"] for r in results) / len(results),
            "avg_answer_score": sum(r["answer_score"] for r in results) / len(results),
            "avg_faithfulness": sum(r["faithfulness"] for r in results) / len(results),
        }
    
    def _eval_faithfulness(self, answer: str, contexts: list[str]) -> float:
        """评估回答的忠实度——回答是否基于检索到的文档"""
        # 简单实现：检查回答中的关键信息是否出现在上下文中
        # 生产环境应该用 LLM 做更精确的评估
        ...
```

## 练习

### 练习 1：RAG vs 直接回答

对比同一个问题在有 RAG 和没有 RAG 时的回答质量：

1. 准备 10 个关于"星辰科技产品"的问题
2. 不用 RAG，直接问 LLM（它会编造）
3. 用 RAG，先检索产品文档再问 LLM
4. 对比回答的准确性和可靠性

### 练习 2：架构设计

为你熟悉的业务场景设计 RAG 架构：

1. 数据源是什么？（文档、数据库、网页）
2. 怎么切分文本？
3. 用什么 Embedding 模型？
4. 怎么评估检索质量？

---

## 参考答案

### 练习 1

**思路**：通过对比实验直观感受 RAG 的价值。核心是构造一个 LLM 无法凭训练数据正确回答的领域（如虚构的"星辰科技产品"），然后用 RAG 注入真实文档，对比两者的准确性和可靠性。

**答案**：

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()

# 模拟产品文档（RAG 检索到的内容）
PRODUCT_DOCS = [
    "星辰科技专业版定价为 299 元/月，支持最多 50 个用户，包含高级分析功能。",
    "星辰科技基础版定价为 99 元/月，支持最多 10 个用户，包含基础功能。",
    "星辰科技企业版定价为 999 元/月，不限用户数，包含全部功能和专属客服。",
    "星辰科技于 2023 年 6 月成立，总部位于深圳。",
    "星辰科技产品支持微信支付、支付宝和银行转账三种付款方式。",
]

QUESTIONS = [
    "星辰科技专业版多少钱？",
    "星辰科技支持哪些付款方式？",
    "星辰科技是什么时候成立的？",
    "企业版最多支持多少用户？",
    "基础版和专业版有什么区别？",
    "星辰科技有免费试用吗？",
    "星辰科技的总部在哪里？",
    "专业版包含哪些功能？",
    "可以按年付费吗？",
    "企业版有专属客服吗？",
]


async def ask_without_rag(question: str) -> str:
    """不用 RAG，直接问 LLM"""
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "你是星辰科技的产品客服，请回答用户问题。"},
            {"role": "user", "content": question},
        ],
        temperature=0,
    )
    return response.choices[0].message.content


async def ask_with_rag(question: str, docs: list[str]) -> str:
    """用 RAG，先检索再回答"""
    context = "\n".join(f"[{i+1}] {doc}" for i, doc in enumerate(docs))
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"你是星辰科技的产品客服。请基于以下参考资料回答，不要编造信息。\n\n参考资料：\n{context}"},
            {"role": "user", "content": question},
        ],
        temperature=0,
    )
    return response.choices[0].message.content


async def main():
    print("=" * 60)
    for q in QUESTIONS:
        print(f"\n问题：{q}")
        no_rag = await ask_without_rag(q)
        with_rag = await ask_with_rag(q, PRODUCT_DOCS)
        print(f"  无 RAG：{no_rag[:100]}...")
        print(f"  有 RAG：{with_rag[:100]}...")
        print("-" * 40)


asyncio.run(main())
```

**要点**：
- 无 RAG 时 LLM 会编造价格、功能等信息，因为"星辰科技"不在训练数据中
- 有 RAG 时 LLM 基于真实文档回答，准确性大幅提升
- 常见错误：认为 RAG 万能——如果检索不到相关文档，LLM 仍可能编造；需要配合置信度评估
- 对比时重点关注两类错误：编造信息（幻觉）和遗漏信息（检索不到）

### 练习 2

**思路**：以"企业内部知识库问答"为场景，从数据源、切分策略、Embedding 模型、评估体系四个维度设计完整架构。

**答案**：

以"企业 HR 政策问答系统"为例：

1. **数据源**：
   - PDF：员工手册、劳动合同模板
   - Word：各 department 的 SOP 文档
   - 网页：公司内网的政策页面
   - 数据库：员工 FAQ 表

2. **切分策略**：
   - 递归切分，chunk_size=500 字符，overlap=50 字符
   - 表格和 FAQ 作为整体 chunk，不按字符切分
   - 每个 chunk 附加元数据：来源文件、章节标题、更新时间

3. **Embedding 模型**：
   - 首选 `text-embedding-3-small`（性价比高，中文支持好）
   - 如果有隐私要求（数据不能出公司），用 `BGE-M3` 本地部署

4. **评估体系**：
   - 准备 50 个测试问题+标准答案
   - 检索评估：Recall@5（前 5 个结果是否包含正确答案）
   - 生成评估：答案准确率、引用覆盖率
   - 自动化：每次调整策略后跑评估集，对比指标变化

**要点**：
- 数据源决定了切分策略——混合格式需要不同解析器
- 中文场景 Embedding 模型选型很重要，通用英文模型对中文效果可能不佳
- 常见错误：没有评估体系就上线，靠"感觉"判断质量；应该用数据驱动优化

## 工程建议

- 先用小规模数据验证 RAG 流程是否跑通，再扩展到全量文档，避免一开始就陷入性能优化的泥潭
- RAG 和微调不是二选一——先用 RAG 解决知识问题，如果模型输出风格不符合需求再叠加微调
- 建立自动化评估流水线，每次调整切分策略或 Embedding 模型后自动跑评估集，用数据驱动优化
- 生产环境中向量库和主数据库要做读写分离，检索请求不应影响业务写入性能

## 本节要点

- RAG = Retrieval + Augmented + Generation，核心是"先查资料再回答"
- RAG 比微调更适合企业知识库场景：成本低、更新快、可解释
- RAG 质量取决于三个环节：文档处理、检索质量、生成质量
- 评估是持续优化的基础，必须建立评估体系

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| 检索不到相关内容 | 切分粒度太大或太小 | 调整 chunk size |
| 回答不引用文档 | Prompt 没要求引用 | 在 System Prompt 中强调 |
| 检索延迟太高 | 向量索引没优化 | 用 HNSW 索引 |
| 回答质量不稳定 | 没有评估体系 | 建立自动化评估 |
