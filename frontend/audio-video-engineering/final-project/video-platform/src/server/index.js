const express = require('express');
const path = require('path');
const cors = require('cors');
const http = require('http');

const uploadRoutes = require('./routes/upload');
const streamRoutes = require('./routes/stream');
const { setupSignaling } = require('./services/signaling');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
app.use('/public', express.static(path.join(__dirname, '../../public')));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// API 路由
app.use('/api/upload', uploadRoutes);
app.use('/api/stream', streamRoutes);

// WebRTC 信令服务
setupSignaling(server);

// 启动服务器
server.listen(PORT, () => {
  console.log(`🎬 视频平台服务器已启动: http://localhost:${PORT}`);
  console.log(`📡 WebSocket 信令服务已就绪`);
});

module.exports = { app, server };
