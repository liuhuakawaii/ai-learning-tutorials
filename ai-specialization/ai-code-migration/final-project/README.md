# 遗留系统迁移工具链

完整的代码迁移工具，包含代码分析、迁移规划、自动转换、测试生成和进度看板。支持 jQuery→React、Vue2→Vue3 等迁移场景。

## 技术栈

- **前端**：React + TypeScript
- **后端**：Node.js + Fastify
- **AST**：Babel + jscodeshift + ts-morph
- **AI**：LLM API（DeepSeek / GPT）
- **测试**：Vitest + Playwright
- **部署**：Docker Compose

## 快速开始

```bash
# 安装前端依赖
cd frontend && npm install

# 安装后端依赖
cd backend && npm install

# 配置环境变量
cp .env.example .env

# 启动
docker-compose up -d

# 或分别启动
cd backend && npm run dev
cd frontend && npm run dev
```

浏览器打开 `http://localhost:5173`。

## 功能模块

| 模块 | 说明 |
|------|------|
| 代码分析器 | AST 解析、依赖图谱、调用链路、复杂度评估 |
| 迁移规划器 | AI 评估难度、自动分组、工作量估算 |
| 自动转换器 | AST 级转换 + LLM 辅助翻译 |
| 测试生成器 | 自动生成等价性测试 |
| 进度看板 | 迁移进度、质量指标、风险预警 |

## 使用流程

1. 上传或指向待迁移项目
2. 分析器扫描代码结构和依赖
3. 规划器生成迁移计划
4. 逐模块执行自动转换
5. 生成测试用例验证正确性
6. 在看板中跟踪进度

## 项目结构

```
├── frontend/               # React + TypeScript
│   └── src/
├── backend/                # Node.js + Fastify
│   └── src/
│       ├── analyzer/       # 代码分析器
│       ├── planner/        # 迁移规划器
│       ├── converter/      # 自动转换器
│       ├── tester/         # 测试生成器
│       └── api/            # REST API
├── transformers/           # AST 转换规则
│   ├── jquery-to-react/
│   ├── vue2-to-vue3/
│   └── cjs-to-esm/
├── docker-compose.yml
├── .env.example
└── scripts/
```

## 验证

```bash
python scripts/check.py
```
