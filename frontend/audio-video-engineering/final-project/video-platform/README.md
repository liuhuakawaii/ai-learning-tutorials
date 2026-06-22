# 在线视频平台 - 音视频工程毕业项目

## 项目简介

本项目是一个功能完整的在线视频平台，综合运用音视频工程课程所学技术，涵盖视频播放、音频录制、HLS 流媒体、WebRTC 实时通信等核心模块。

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript（无框架依赖）
- **后端**：Node.js + Express
- **流媒体**：HLS 自适应码率
- **实时通信**：WebRTC + WebSocket 信令
- **音频处理**：Web Audio API + MediaRecorder

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务器
npm start

# 访问 http://localhost:3000
```

## 项目结构

```
video-platform/
├── package.json
├── README.md
├── public/                    # 静态资源
├── src/
│   ├── server/                # 后端服务
│   │   ├── index.js           # 服务器入口
│   │   ├── routes/            # API 路由
│   │   │   ├── upload.js      # 视频上传路由
│   │   │   └── stream.js      # 流媒体路由
│   │   ├── services/          # 业务逻辑
│   │   │   ├── transcode.js   # FFmpeg 转码服务
│   │   │   └── signaling.js   # WebRTC 信令服务
│   │   └── utils/             # 工具函数
│   │       └── file-utils.js  # 文件操作工具
│   └── client/                # 前端应用
│       ├── index.html         # 入口页面
│       ├── app.js             # 应用入口
│       ├── components/        # UI 组件
│       │   ├── video-player.js    # 视频播放器
│       │   ├── audio-recorder.js  # 音频录制器
│       │   ├── hls-player.js      # HLS 播放器
│       │   └── video-chat.js      # WebRTC 视频通话
│       └── utils/             # 前端工具
│           └── media-utils.js # 媒体工具函数
```

## 功能模块

### 1. 视频播放器
- 自定义播放控件（播放/暂停、进度、音量、全屏）
- 倍速播放
- 键盘快捷键支持

### 2. 音频录制
- 基于 Web Audio API 的音频采集
- 实时音量可视化
- 录音回放与下载

### 3. HLS 流媒体
- HLS 自适应码率播放
- 画质切换
- 基于 hls.js 的兼容性处理

### 4. WebRTC 视频通话
- 点对点视频通话
- 实时聊天（DataChannel）
- 屏幕共享

## 验证

```bash
node scripts/check.cjs
```
