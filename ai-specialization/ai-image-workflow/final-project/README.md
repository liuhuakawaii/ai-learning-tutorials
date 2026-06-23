# 品牌风格图像批量生成流水线

基于 ComfyUI + LoRA 的品牌风格图像批量生成流水线。支持工作流可视化配置、批量任务处理、质量控制和资产管理。

## 技术栈

- **前端**：React + TypeScript
- **后端**：FastAPI（Python）
- **图像生成**：ComfyUI + Stable Diffusion
- **任务队列**：Celery + Redis
- **存储**：MinIO / 本地文件系统
- **部署**：Docker Compose

## 快速开始

```bash
# 安装前端依赖
cd frontend && npm install

# 安装后端依赖
cd backend && pip install -r requirements.txt

# 配置环境变量
cp .env.example .env

# 启动 ComfyUI（需要单独安装）
# cd comfyui && python main.py --port 8188

# 启动服务
docker-compose up -d

# 或分别启动
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```

浏览器打开 `http://localhost:5173`。

## 功能说明

| 功能 | 说明 |
|------|------|
| 工作流编辑器 | 节点式编辑 ComfyUI 工作流 |
| 批量任务 | CSV 导入商品信息，并行生成 |
| LoRA 管理 | 上传、切换、版本控制 |
| 质量控制 | 美学评分、NSFW 过滤、一致性检查 |
| 资产管理 | 搜索、筛选、标签、版本历史 |
| API 服务 | RESTful 接口供外部系统调用 |

## 使用流程

1. 配置或导入 ComfyUI 工作流
2. 上传 LoRA 模型（如有）
3. 导入商品 CSV（名称、描述、风格要求）
4. 启动批量生成任务
5. 在质量控制面板审核结果
6. 导出或通过 API 获取图像

## 项目结构

```
├── frontend/               # React + TypeScript
│   └── src/
├── backend/                # FastAPI
│   └── app/
│       ├── api/            # REST API
│       ├── services/       # 工作流、队列、质量、存储
│       └── models/         # 数据模型
├── comfyui/
│   ├── custom_nodes/       # 自定义节点
│   └── workflows/          # 预设工作流
├── docker-compose.yml
├── .env.example
└── scripts/
```

## 验证

```bash
python scripts/check.py
```
