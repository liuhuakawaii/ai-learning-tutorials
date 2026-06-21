# Prompt Engineering 深度实战课程

> **从试一试到工程化**

一门系统化的 Prompt Engineering 实战课程，带你从零散的提示词技巧走向可测试、可优化、可监控的工程化 Prompt 体系。

---

## 适合谁

- 希望系统掌握 Prompt Engineering 的开发者和产品经理
- 已经在用 LLM 但想提升输出质量和稳定性的团队
- 想要构建 AI 应用但不知道如何管理 Prompt 的工程师
- 对大模型应用开发感兴趣的技术学习者

## 前置要求

- **Python 基础**：熟悉 Python 语法、函数、类、模块
- **API 调用经验**：了解 REST API 和 Python HTTP 请求
- **LLM 基础概念**：了解 ChatGPT / Claude 等大模型的基本使用
- **开发环境**：Python 3.10+，能运行 pip install 和脚本

## 学习路线

### Stage 1：Prompt 基础与思维模型（6 课时）

> 掌握 Prompt 的核心概念和设计思维

| # | 课程 | 核心内容 |
|---|------|----------|
| 01 | [Prompt 的本质](./stage-1-prompt-fundamentals/01-Prompt的本质.md) | Prompt 的定义、工作原理、设计原则 |
| 02 | [指令型 Prompt](./stage-1-prompt-fundamentals/02-指令型Prompt.md) | 直接指令、步骤拆解、动词选择 |
| 03 | [角色型 Prompt](./stage-1-prompt-fundamentals/03-角色型Prompt.md) | 角色设定、风格控制、System Prompt |
| 04 | [少样本 Prompt](./stage-1-prompt-fundamentals/04-少样本Prompt.md) | Few-shot 学习、示例选择策略 |
| 05 | [思维链 Prompt](./stage-1-prompt-fundamentals/05-思维链Prompt.md) | Chain-of-Thought、推理增强 |
| 06 | [阶段实战：Prompt 设计练习](./stage-1-prompt-fundamentals/06-阶段实战-Prompt设计练习.md) | 综合运用前 5 课技巧 |

### Stage 2：结构化 Prompt 工程（6 课时）

> 学会用模板和结构化方法管理 Prompt

| # | 课程 | 核心内容 |
|---|------|----------|
| 01 | [Prompt 模板设计](./stage-2-structured-prompt/01-Prompt模板设计.md) | 模板语法、变量抽取、复用 |
| 02 | [变量注入与动态 Prompt](./stage-2-structured-prompt/02-变量注入与动态Prompt.md) | 动态内容注入、条件分支 |
| 03 | [输出格式控制](./stage-2-structured-prompt/03-输出格式控制.md) | JSON/XML/Markdown 输出约束 |
| 04 | [约束与边界设定](./stage-2-structured-prompt/04-约束与边界设定.md) | 安全约束、长度限制、内容边界 |
| 05 | [Prompt 组合与链式调用](./stage-2-structured-prompt/05-Prompt组合与链式调用.md) | 多 Prompt 协作、管道模式 |
| 06 | [阶段实战：构建 Prompt 模板库](./stage-2-structured-prompt/06-阶段实战-构建Prompt模板库.md) | 建立可复用的 Prompt 体系 |

### Stage 3：Prompt 测试与优化（6 课时）

> 让 Prompt 像代码一样可测试、可优化

| # | 课程 | 核心内容 |
|---|------|----------|
| 01 | [Prompt 测试方法论](./stage-3-testing-optimization/01-Prompt测试方法论.md) | 测试用例设计、回归测试 |
| 02 | [评估指标设计](./stage-3-testing-optimization/02-评估指标设计.md) | 准确率、相关性、一致性指标 |
| 03 | [A/B 测试框架](./stage-3-testing-optimization/03-A-B测试框架.md) | Prompt 对比实验设计 |
| 04 | [Prompt 版本管理](./stage-3-testing-optimization/04-Prompt版本管理.md) | 版本号、变更日志、回滚 |
| 05 | [回归测试与 CI 集成](./stage-3-testing-optimization/05-回归测试与CI集成.md) | 自动化测试 pipeline |
| 06 | [阶段实战：建立 Prompt 测试 pipeline](./stage-3-testing-optimization/06-阶段实战-建立Prompt测试pipeline.md) | 完整测试体系建设 |

### Stage 4：生产级 Prompt（6 课时）

> 将 Prompt 搬上生产环境

| # | 课程 | 核心内容 |
|---|------|----------|
| 01 | [Prompt 安全：注入防御](./stage-4-production-prompts/01-Prompt安全-注入防御.md) | 注入攻击识别与防御 |
| 02 | [Prompt 性能优化](./stage-4-production-prompts/02-Prompt性能优化.md) | Token 精简、延迟优化 |
| 03 | [多模型适配](./stage-4-production-prompts/03-多模型适配.md) | 模型切换、参数映射 |
| 04 | [Prompt 缓存与复用](./stage-4-production-prompts/04-Prompt缓存与复用.md) | 结果缓存、模板复用 |
| 05 | [Prompt 监控与告警](./stage-4-production-prompts/05-Prompt监控与告警.md) | 日志、指标、异常告警 |
| 06 | [阶段实战：部署生产级 Prompt](./stage-4-production-prompts/06-阶段实战-部署生产级Prompt.md) | 完整生产部署流程 |

### Stage 5：高级 Prompt 技巧（6 课时）

> 掌握前沿 Prompt 技术

| # | 课程 | 核心内容 |
|---|------|----------|
| 01 | [元 Prompt：Prompt 生成 Prompt](./stage-5-advanced-techniques/01-元Prompt-Prompt生成Prompt.md) | 自动 Prompt 优化 |
| 02 | [自洽性与多数投票](./stage-5-advanced-techniques/02-自洽性与多数投票.md) | Self-Consistency、投票机制 |
| 03 | [树形思维 ToT](./stage-5-advanced-techniques/03-树形思维ToT.md) | Tree of Thoughts 推理 |
| 04 | [ReAct 推理与行动](./stage-5-advanced-techniques/04-ReAct推理与行动.md) | 推理+行动的 Agent 模式 |
| 05 | [多模态 Prompt](./stage-5-advanced-techniques/05-多模态Prompt.md) | 图片/音频/视频 Prompt |
| 06 | [阶段实战：高级 Prompt 综合应用](./stage-5-advanced-techniques/06-阶段实战-高级Prompt综合应用.md) | 综合运用所有高级技巧 |

---

## 学习建议

1. **按顺序学习**：每个 Stage 的课程有递进关系，建议按序完成
2. **动手实操**：每课都有配套代码和练习，务必亲自运行和修改
3. **记录 Prompt 日志**：每次实验都记录输入、输出和心得，形成自己的 Prompt 知识库
4. **参与讨论**：遇到问题多交流，Prompt Engineering 需要实践和反馈

## 环境准备

```bash
# 克隆仓库
git clone <repo-url>
cd ai-learning-tutorials/prompt-engineering-course

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置 API Key
cp .env.example .env
# 编辑 .env 填入你的 API Key
```

### 环境变量配置

创建 `.env` 文件：

```bash
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
DEFAULT_MODEL=gpt-4o
LOG_LEVEL=INFO
```

---

## 课程结构

```
prompt-engineering-course/
├── README.md                          # 本文件
├── requirements.txt                   # 全局依赖
├── stage-1-prompt-fundamentals/       # Stage 1: Prompt 基础
├── stage-2-structured-prompt/         # Stage 2: 结构化提示词
├── stage-3-testing-optimization/      # Stage 3: 测试与优化
├── stage-4-production-prompts/        # Stage 4: 生产级 Prompt
├── stage-5-advanced-techniques/       # Stage 5: 高级技巧
└── final-project/                     # 综合项目
```

---

> 学完这门课，你写的不再是提示词，而是 **Prompt 工程**。
