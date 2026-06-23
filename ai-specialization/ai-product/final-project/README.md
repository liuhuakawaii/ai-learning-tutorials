# AI 产品完整上线流程

完成一个 AI 产品从想法到发布的全流程。包含产品定义、原型设计、技术实现、测试验证和部署上线。

## 技术栈

根据产品方向自行选择，参考项目说明中的技术栈建议。

## 快速开始

```bash
# 安装前端依赖
cd frontend && npm install

# 安装后端依赖
cd backend && pip install -r requirements.txt  # 或 npm install

# 配置环境变量
cp .env.example .env

# 启动
cd backend && uvicorn app.main:app --reload  # 或 npm run dev
cd frontend && npm run dev
```

## 产品文档

| 文档 | 说明 |
|------|------|
| docs/requirements.md | 需求文档：目标用户、痛点、方案 |
| docs/competitors.md | 竞品分析：3+ 竞品对比 |
| docs/prototype.md | 原型说明：线框图/高保真原型 |
| docs/retrospective.md | 上线复盘：决策、问题、改进 |

## 开发流程

1. **定义**：写需求文档和竞品分析
2. **设计**：画原型，确定 MVP 范围
3. **实现**：核心 AI 功能 + 前后端
4. **测试**：功能测试 + AI 输出评估
5. **部署**：线上环境 + 监控
6. **复盘**：总结决策和改进方向

## 项目结构

```
├── docs/                   # 产品文档
│   ├── requirements.md
│   ├── competitors.md
│   ├── prototype.md
│   └── retrospective.md
├── frontend/               # 前端
│   └── src/
├── backend/                # 后端
│   └── src/
├── prompts/                # Prompt 管理
│   ├── v1/
│   └── eval/               # 评估用例（>= 20 个）
├── docker-compose.yml
├── .env.example
└── scripts/
```

## 验证

```bash
python scripts/check.py
```
