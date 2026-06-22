# AGENTS.md

## 项目简介

AI 生成的系统化学习教程合集，面向已有前端基础的学习者，涵盖后端、爬虫、AI 应用、性能工程、部署等方向。仓库包含一条完整的 **AI 工程师学习路径**（7 门课程 + 毕业项目，共 231 课时）以及多门基础技能和工程实践课程，共 **18 门课程、596 课时**。

## 技术栈

- **课程内容**：Markdown（中文），每课 300-700+ 行
- **final-project 代码**：TypeScript/Node.js、Python、Vue3、Next.js、FastAPI、Scrapy 等
- **验证脚本**：`check.py` / `check.js` / `check.cjs`（每个 final-project 都有）
- **部分课程有**：Docker（Dockerfile + docker-compose）、CI/CD（GitHub Actions）

## 目录结构

```
ai-learning-tutorials/
├── ai-engineer-path/              # AI 工程师学习路径（主线路）
│   ├── 01-ai-app-course/          # AI 应用开发基础（35 课时）
│   ├── 02-ai-agent-engineer-course/  # AI Agent 全栈工程师（52 课时）
│   ├── 03-llm-eval-course/        # LLM 评估与可观测性（30 课时）
│   ├── 04-multi-agent-course/     # 多 Agent 编排（30 课时）
│   ├── 05-mcp-dev-course/         # MCP 协议深度开发（24 课时）
│   ├── 06-llm-finetuning-course/  # 开源模型部署与微调（30 课时）
│   ├── 07-multimodal-ai-course/   # 多模态 AI 应用（30 课时）
│   └── graduation-project/        # 毕业项目：AI 数据分析平台
├── backend-course/                # 全栈后端开发（32 课时）
├── nextjs-fullstack-course/       # Next.js 全栈产品（35 课时）
├── frontend-performance-course/   # 前端性能工程（35 课时）
├── docker-cicd-course/            # Docker 与 CI/CD（35 课时）
├── data-product-course/           # 数据产品化（35 课时）
├── spider-course/                 # Python 爬虫（34 课时）
├── ai-coding-engineering-course/  # AI 编程工程（34 课时）
├── prompt-engineering-course/     # Prompt Engineering 深度课（30 课时）
├── ai-security-course/            # AI 安全与对抗（30 课时）
├── rag-engineering-course/        # RAG 工程化（30 课时）
├── README.md                      # 课程总览与状态表
└── COURSE_DESIGN_REVIEW.md        # 课程项目化评估记录
```

### 单门课程内部结构

```
xx-course/
├── README.md                      # 课程大纲与学习路线
├── stage1-xxx/                    # 阶段目录
│   ├── README.md                  # 阶段概述
│   ├── 01-xxx.md                  # 课时文件（中文 Markdown）
│   └── requirements.txt           # 阶段依赖（如有）
├── stage2-xxx/
│   └── ...
└── final-project/
    ├── 项目说明.md                 # 项目说明文档
    ├── scripts/                   # 验证脚本（check.py/js/cjs）
    ├── reports/                   # 阶段报告
    └── <project-name>/            # 实际代码目录
```

## 常用命令

```bash
# 运行某门课的 final-project 验证脚本
cd ai-engineer-path/02-ai-agent-engineer-course/final-project
python scripts/check.py

cd backend-course/final-project
node scripts/check.js

# 验证离线 RAG 项目（01-ai-app-course）
cd ai-engineer-path/01-ai-app-course/final-project/ai-knowledge-workspace-kit
npm run check
npm run ingest
npm run ask
npm run eval

# 验证前端性能 demo
cd frontend-performance-course/final-project/performance-rescue-demo
node scripts/check-demo-files.js
```

## ⚠️ 关键规则：每次更新后必须同步 README.md

**这是本项目最重要的约定。** 任何时候对课程内容进行以下操作，都必须同步更新 `README.md` 中对应的状态表：

1. **新增课程**：在 README.md 对应分类表中添加新行
2. **修改课程状态**（如从规划中变为已完成）：更新状态列
3. **删除课程**：从 README.md 中移除对应行
4. **修改课时数**：更新课时列
5. **调整课程分类**：在正确的表格中添加/删除行

README.md 中有 4 张表格，按分类对应：
- **AI 工程师学习路径** → `ai-engineer-path/` 下的课程
- **基础技能课程** → `backend-course`、`nextjs-fullstack-course`、`frontend-performance-course`
- **工程实践课程** → `docker-cicd-course`、`data-product-course`、`spider-course`
- **专项进阶课程** → `ai-coding-engineering-course`、`prompt-engineering-course`、`ai-security-course`、`rag-engineering-course`

## 课程内容编写规范

### 一、内容定位

课程面向有一定基础、希望真正掌握工程实践的开发者。内容不追求 PPT 式罗列概念，而是围绕真实问题、真实项目和真实决策展开。

**每节课必须回答三个问题：**

1. 这个技术为什么存在？
2. 它解决了什么真实问题？
3. 在项目中应该如何正确使用？

### 二、课程结构

**基本格式：**
- 语言：中文
- 格式：Markdown，每课时独立文件，命名 `01-标题.md`
- 每个 stage 目录下有 `README.md` 作为阶段概述
- 每个 final-project 必须包含：
  - 验证脚本（`scripts/check.*`）
  - 阶段报告（`reports/` 目录）
  - 项目说明文档（`项目说明.md`）

**每篇课程默认结构：**

1. **场景引入** — 从真实问题出发，引出本课主题
2. **问题拆解** — 把大问题拆成可理解的子问题
3. **核心概念** — 在问题上下文中讲解关键概念
4. **代码示例** — 用完整可运行代码演示解决方案
5. **项目实践** — 将知识应用到课程项目中
6. **常见误区** — 指出容易犯的错误和错误理解
7. **工程建议** — 给出生产环境的实际建议
8. **小结与练习** — 总结要点，布置动手练习

**示例：** 讲状态管理，不要一上来罗列 useState、useReducer、Zustand。应该先展示一个真实问题（商品筛选页面里筛选条件、分页、排序、URL 参数互相影响），再一步步拆解哪些状态属于局部、哪些进 URL、哪些放全局 store。

### 三、写作风格

1. **用工程问题驱动内容**，不用 API 清单驱动内容
2. **先讲为什么，再讲是什么，最后讲怎么做**
3. 每个关键概念都必须配真实代码或具体场景
4. **禁止跳步表达**：不使用"显而易见""很简单""大家都知道"
5. **禁止空泛结论**：不写"这样可以提高性能"，必须说明提高在哪里、代价是什么
6. **禁止 PPT 式短句堆叠**：正文要有推理过程，不能只罗列要点
7. 不追求炫技，代码优先可读、可维护、可运行
8. **遇到 tradeoff 必须讲清利弊**：说明适用场景和不适用场景

> **有深度的核心是：讲清楚上下文，讲清楚取舍。** 不是把内容写得难，而是把真实工程里的判断讲透。

### 四、代码示例规范

1. **示例必须完整可运行**，不能只有伪代码或代码片段
2. 关键代码要解释**设计原因**，而不是逐行翻译语法
3. 示例应从简单版本**逐步演进**到工程版本
4. 不允许为了演示 API 写脱离业务的 demo
5. **示例命名必须有业务语义**：禁止 foo、bar、data、item 等无意义名称
6. 如果代码存在简化，必须明确说明简化了什么
7. 不使用 `useMemo` 等优化手段时，要解释为什么当前不需要

**反例：**
```js
const data = useMemo(() => list.filter(item => item.active), [list])
```

**正例：**
```js
const visibleTasks = tasks.filter(task => task.status === activeStatus)
// 这里暂不使用 useMemo，因为筛选逻辑轻量。
// 当任务列表规模较大或筛选逻辑昂贵时，才需要缓存计算结果。
```

### 五、项目型课程结构

带项目的课程，每个模块都应围绕一个**递进项目**展开，每节课推动项目向真实工程形态演进。例如：

```
第 1 章：搭建基础页面结构
第 2 章：任务列表与状态建模
第 3 章：筛选、排序、搜索
第 4 章：表单校验与错误提示
第 5 章：接口请求与 loading 状态
第 6 章：乐观更新与失败回滚
第 7 章：权限控制
第 8 章：性能优化
第 9 章：测试与重构
```

每节都有真实上下文，读者能看到代码如何从简单变复杂。

### 六、准确性规范

1. 涉及官方 API、框架行为、版本差异时，**必须以官方文档为准**
2. 不确定的说法不能写成绝对结论
3. 性能优化类结论**必须说明前提条件**
4. 安全、部署、兼容性相关内容**必须注明环境和版本**
5. 示例代码必须经过运行或类型检查
6. 术语必须前后一致

**反例：** "useMemo 可以避免重复渲染" — 不准确

**正例：** "useMemo 缓存的是计算结果，不会直接阻止组件重新渲染。它适合缓存昂贵计算，或者稳定传给子组件的引用。" — 准确且有上下文

> **一句话总结：课程应该像"资深工程师带新人做项目"，而不是"讲师念知识点"。**

## Git 提交规范

- 使用中文 commit message
- 前缀：`feat:`（新功能/新课程）、`fix:`（修复）、`docs:`（文档更新）
- 示例：`feat: 新增spider课程`、`docs: 更新课程状态为已完成`
