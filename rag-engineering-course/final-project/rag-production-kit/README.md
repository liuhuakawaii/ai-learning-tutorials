# RAG Production Kit

生产级 RAG 系统开发工具包

## 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 检查环境
python scripts/check.py

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 OPENAI_API_KEY 等

# 4. 运行文档摄入
python src/ingest.py --input data/sample/

# 5. 启动服务
uvicorn src.main:app --reload
```

## 项目结构

```
rag-production-kit/
├── README.md              # 本文件
├── requirements.txt       # Python 依赖
├── .env.example           # 环境变量模板
├── .gitignore
├── scripts/
│   └── check.py          # 环境检查脚本
├── src/
│   ├── ingest.py         # 文档摄入模块
│   ├── retrieve.py       # 检索模块
│   ├── generate.py       # 生成模块
│   └── evaluate.py       # 评估模块
├── data/
│   └── sample/           # 示例文档
├── reports/
│   └── templates/        # 评估报告模板
└── tests/                # 测试目录
```

## 模块说明

### ingest.py - 文档摄入

负责文档的解析、分块、向量化和存储。

```bash
python src/ingest.py --input data/sample/ --strategy recursive --chunk-size 512
```

### retrieve.py - 检索模块

支持向量检索、关键词检索和混合检索。

```bash
python src/retrieve.py --query "什么是 RAG?" --mode hybrid --top-k 5
```

### generate.py - 生成模块

基于检索结果生成答案，支持流式输出。

```bash
python src/generate.py --query "什么是 RAG?" --stream
```

### evaluate.py - 评估模块

自动化评估 RAG 系统质量。

```bash
python src/evaluate.py --dataset data/eval.jsonl --metrics faithfulness,relevancy
```

## API 接口

### 查询接口

```http
POST /query
Content-Type: application/json

{
  "question": "什么是 RAG?",
  "top_k": 5,
  "stream": false
}
```

### 健康检查

```http
GET /health
```

### 指标接口

```http
GET /metrics
```

## 开发指南

### 添加新的检索策略

1. 在 `retrieve.py` 中实现新的检索类
2. 继承 `BaseRetriever` 接口
3. 在配置中注册新策略

### 添加新的 Embedding 模型

1. 在 `ingest.py` 中添加新的 embedding 函数
2. 更新配置中的模型映射

### 运行测试

```bash
pytest tests/ -v --cov=src --cov-report=html
```

## 部署

### Docker

```bash
docker build -t rag-production .
docker run -p 8000:8000 --env-file .env rag-production
```

### Docker Compose

```bash
docker-compose up -d
```

包含服务：
- rag-api: RAG API 服务
- redis: 缓存
- qdrant: 向量数据库
- prometheus: 指标收集
- grafana: 监控看板
