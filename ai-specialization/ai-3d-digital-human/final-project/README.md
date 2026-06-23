# 可对话数字人 Demo

基于 3D 模型 + 语音 + LLM 的可对话数字人演示系统。支持从照片生成数字人、语音驱动口型、实时对话。

## 技术栈

- **前端**：Vue 3 + Three.js
- **后端**：FastAPI（Python）
- **数字人**：SadTalker / LivePortrait
- **语音**：CosyVoice / GPT-SoVITS
- **对话**：OpenAI API / 国产 LLM
- **部署**：Docker Compose

## 快速开始

```bash
# 安装前端依赖
cd frontend && npm install

# 安装后端依赖
cd backend && pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API Key

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
| 形象生成 | 上传照片 → 3D 数字人模型 |
| 语音驱动 | 音频驱动口型同步，延迟 < 200ms |
| 实时对话 | 输入文字 → LLM 回复 → TTS → 数字人说话 |
| 声音克隆 | 5 分钟样本 → 克隆声线 |
| 多轮记忆 | 对话上下文保持 |

## 项目结构

```
├── frontend/               # Vue 3 前端
│   └── src/
│       ├── components/     # 数字人预览、对话框
│       ├── views/          # 主页面
│       └── services/       # API 调用
├── backend/                # FastAPI 后端
│   └── app/
│       ├── api/            # REST API
│       └── services/       # 数字人、TTS、对话引擎
├── models/                 # AI 模型文件
├── docker-compose.yml
├── .env.example
└── scripts/
```

## 验证

```bash
python scripts/check.py
```
