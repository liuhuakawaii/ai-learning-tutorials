# 第四阶段 · 第2课：WebSocket 实时通信

## 学习目标

完成本课学习后，你将能够：

1. 理解 HTTP 的局限性和 WebSocket 的优势
2. 掌握 Socket.IO 服务端和客户端的使用
3. 实现房间机制和中间件（认证、权限）
4. 为博客平台添加实时通知、实时评论和在线统计功能
5. 处理断线重连和消息格式设计

---

## 一、HTTP 的局限性

### 1.1 请求-响应模式

HTTP 是**单向**的：只有客户端能主动发起请求，服务器只能被动响应。

```
HTTP 通信模式：

浏览器                          服务器
  │                              │
  │──── GET /messages ──────────►│  客户端发起请求
  │◄─── [消息列表] ──────────────│  服务器返回数据
  │                              │
  │   （服务器想推送新消息？       │
  │    对不起，HTTP 做不到！）     │
  │                              │
  │  用户只能不断刷新页面         │
  │  或者用轮询来"假装"实时       │
```

### 1.2 轮询 vs 长轮询 vs WebSocket

```
方案一：短轮询（Polling）
浏览器反复问服务器："有新消息吗？有新消息吗？"

浏览器        服务器
  │── 有新消息吗？ ──►│  没有
  │◄── 没有 ─────────│
  │                   │
  │── 有新消息吗？ ──►│  没有
  │◄── 没有 ─────────│  ← 浪费大量请求！
  │                   │
  │── 有新消息吗？ ──►│  有！
  │◄── 新消息 ───────│

缺点：99% 的请求都是"没有"，浪费带宽和服务器资源


方案二：长轮询（Long Polling）
浏览器问一次，服务器"hold住"直到有数据

浏览器        服务器
  │── 有新消息吗？ ──►│  等等...
  │                   │  等等...  ← 服务器不返回，一直等
  │                   │  有了！
  │◄── 新消息 ───────│
  │                   │
  │── 有新消息吗？ ──►│  等等...

缺点：每次请求都有 HTTP 开销（头部、握手），延迟仍然存在


方案三：WebSocket
建立连接后，双方可以随时互发消息

浏览器                 服务器
  │── HTTP 升级请求 ───►│  ← 先用 HTTP 握手
  │◄── 101 Switching ──│  ← 升级为 WebSocket
  │                     │
  │◄────── 新消息 ──────│  服务器主动推送
  │────── 回复 ────────►│  客户端随时发送
  │◄────── 新消息 ──────│  服务器再次推送
  │                     │
  │  连接一直保持，双向通信！
```

### 1.3 对比总结

| 特性 | 短轮询 | 长轮询 | WebSocket |
|------|--------|--------|-----------|
| 通信方向 | 客户端 → 服务器 | 客户端 → 服务器 | **双向** |
| 实时性 | 差（取决于轮询间隔） | 中等 | **极好** |
| 服务器压力 | 高（大量无效请求） | 中等 | **低** |
| 带宽消耗 | 高（每次都带 HTTP 头） | 中等 | **低**（帧开销小） |
| 实现复杂度 | 低 | 中等 | 中等 |
| 适用场景 | 低实时性需求 | 中等实时性 | **聊天、通知、实时数据** |

---

## 二、WebSocket 协议简介

### 2.1 什么是 WebSocket？

**WebSocket** 是一种在单个 TCP 连接上进行**全双工通信**的协议。

```
全双工（Full-Duplex）= 双方可以同时互发消息

类比：打电话（全双工）vs 对讲机（半双工）

打电话（WebSocket）：           对讲机（HTTP 轮询）：
  A: 你好                        A: 你好（按发送）
  B: 你好啊                      B: 收到，你也好（按发送）
  A: 今天天气不错                  A: 收到（按发送）
  B: 是啊很暖和                    ... 每次只能一方说话
  （两人同时说话也没问题）
```

### 2.2 WebSocket 连接过程

```
WebSocket 握手（基于 HTTP 升级）：

浏览器                              服务器
  │                                   │
  │── GET /chat HTTP/1.1 ────────────►│
  │   Upgrade: websocket              │
  │   Connection: Upgrade             │
  │   Sec-WebSocket-Key: x3JJ...==    │
  │                                   │
  │◄── HTTP/1.1 101 Switching ────────│
  │    Upgrade: websocket             │  ← 升级成功！
  │    Connection: Upgrade            │
  │    Sec-WebSocket-Accept: HSmr...= │
  │                                   │
  │◄═════════ WebSocket 连接 ════════►│  ← 从此用 WebSocket 通信
  │                                   │
  │◄── [消息帧] ─────────────────────│  服务器主动推送
  │── [消息帧] ─────────────────────►│  客户端发送
```

---

## 三、Socket.IO 库

### 3.1 为什么用 Socket.IO？

原生 WebSocket 有一些痛点，Socket.IO 帮你解决：

```
原生 WebSocket 痛点：             Socket.IO 解决方案：

❌ 不支持自动重连               ✅ 自动重连 + 指数退避
❌ 没有房间/频道概念             ✅ 内置房间机制
❌ 不支持广播                   ✅ 轻松广播给所有/部分客户端
❌ 断线检测不灵敏               ✅ 心跳检测 + 连接状态管理
❌ 消息需要自己序列化           ✅ 自动 JSON 序列化
❌ 旧浏览器不支持 WebSocket     ✅ 自动降级（轮询等方案）
```

### 3.2 安装

```bash
# 服务端
npm install socket.io

# 客户端（如果用 Node.js 做客户端）
npm install socket.io-client

# TypeScript 类型（Socket.IO 内置类型，一般不需要额外安装）
```

---

## 四、服务端实现

### 4.1 搭建 Socket.IO 服务器

```typescript
// src/lib/socket.ts
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

// 定义 Socket 数据类型
interface SocketData {
  userId: number;
  username: string;
}

// 定义客户端到服务器的事件
interface ClientToServerEvents {
  'join:room': (roomId: string) => void;
  'leave:room': (roomId: string) => void;
  'comment:create': (data: { postId: number; content: string }) => void;
  'typing:start': (data: { postId: number }) => void;
  'typing:stop': (data: { postId: number }) => void;
}

// 定义服务器到客户端的事件
interface ServerToClientEvents {
  'post:created': (data: { postId: number; title: string; author: string }) => void;
  'comment:created': (data: { postId: number; comment: any }) => void;
  'user:online': (data: { userId: number; username: string }) => void;
  'user:offline': (data: { userId: number }) => void;
  'typing:update': (data: { postId: number; userId: number; username: string; isTyping: boolean }) => void;
  'stats:online': (count: number) => void;
  'error': (message: string) => void;
}

let io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

/**
 * 初始化 Socket.IO 服务器
 */
export function initSocket(httpServer: HttpServer): Server {
  io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // 连接超时
    connectTimeout: 10000,
    // 心跳间隔
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // ==================== 认证中间件 ====================
  // 每个客户端连接前都会经过这里
  io.use((socket, next) => {
    try {
      // 从 handshake 的 auth 或 query 中获取 token
      const token = socket.handshake.auth.token
        || socket.handshake.query.token as string;

      if (!token) {
        return next(new Error('未提供认证令牌'));
      }

      // 验证 JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: number;
        username: string;
      };

      // 将用户信息存到 socket.data 中（后续可直接使用）
      socket.data = {
        userId: decoded.userId,
        username: decoded.username,
      };

      next();
    } catch (error) {
      next(new Error('认证失败：令牌无效或已过期'));
    }
  });

  // ==================== 连接事件 ====================
  io.on('connection', (socket) => {
    const { userId, username } = socket.data;
    console.log(`✅ 用户连接: ${username} (ID: ${userId}), Socket: ${socket.id}`);

    // 广播用户上线
    socket.broadcast.emit('user:online', { userId, username });

    // 广播当前在线人数
    broadcastOnlineCount();

    // ==================== 事件监听 ====================

    // 加入房间
    socket.on('join:room', (roomId: string) => {
      socket.join(roomId);
      console.log(`📌 ${username} 加入房间: ${roomId}`);
    });

    // 离开房间
    socket.on('leave:room', (roomId: string) => {
      socket.leave(roomId);
      console.log(`📤 ${username} 离开房间: ${roomId}`);
    });

    // 创建评论（实时）
    socket.on('comment:create', async (data) => {
      try {
        const { postId, content } = data;

        // 这里可以调用数据库保存评论（为简洁省略）
        const comment = {
          id: Date.now(),
          postId,
          content,
          userId,
          username,
          createdAt: new Date().toISOString(),
        };

        // 广播给该文章房间内的所有人
        io.to(`post:${postId}`).emit('comment:created', {
          postId,
          comment,
        });

        console.log(`💬 ${username} 在文章 ${postId} 发表评论`);
      } catch (error) {
        socket.emit('error', '评论发送失败');
      }
    });

    // 正在输入
    socket.on('typing:start', (data) => {
      socket.to(`post:${data.postId}`).emit('typing:update', {
        postId: data.postId,
        userId,
        username,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(`post:${data.postId}`).emit('typing:update', {
        postId: data.postId,
        userId,
        username,
        isTyping: false,
      });
    });

    // ==================== 断开连接 ====================
    socket.on('disconnect', (reason) => {
      console.log(`❌ 用户断开: ${username}, 原因: ${reason}`);
      socket.broadcast.emit('user:offline', { userId });
      broadcastOnlineCount();
    });
  });

  console.log('🔌 Socket.IO 服务器已初始化');
  return io;
}

/**
 * 广播在线人数
 */
async function broadcastOnlineCount() {
  if (!io) return;
  const sockets = await io.fetchSockets();
  io.emit('stats:online', sockets.length);
}

/**
 * 获取 Socket.IO 实例（供其他模块使用）
 */
export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO 尚未初始化，请先调用 initSocket()');
  }
  return io;
}

export { io };
```

### 4.2 在 Express 中集成 Socket.IO

```typescript
// src/app.ts
import express from 'express';
import { createServer } from 'http';
import { initSocket } from './lib/socket';
import postRoutes from './routes/post.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// 创建 HTTP 服务器
const httpServer = createServer(app);

// 初始化 Socket.IO
const io = initSocket(httpServer);

app.use(express.json());
app.use('/api/posts', postRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动 HTTP 服务器（不是 app.listen，而是 httpServer.listen）
httpServer.listen(PORT, () => {
  console.log(`🚀 服务器已启动: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket 地址: ws://localhost:${PORT}`);
});

export { app, httpServer, io };
```

### 4.3 房间机制详解

```
房间（Room）是 Socket.IO 的核心概念

类比：微信群聊

┌─────────────────────────────────────────────┐
│                Socket.IO 服务器              │
│                                             │
│  ┌─────────────┐  ┌─────────────┐           │
│  │  房间:post:1 │  │  房间:post:2 │           │
│  │             │  │             │           │
│  │  · 用户A    │  │  · 用户A    │           │
│  │  · 用户B    │  │  · 用户C    │           │
│  │  · 用户D    │  │  · 用户D    │           │
│  └─────────────┘  └─────────────┘           │
│                                             │
│  向房间 post:1 广播消息                       │
│  → 只有用户 A、B、D 收到                      │
│  → 用户 C 不会收到（他不在这个房间）           │
└─────────────────────────────────────────────┘
```

**使用场景：**

```typescript
// 客户端加入"文章房间"，接收该文章的实时评论
socket.emit('join:room', `post:${postId}`);

// 服务端向该房间广播
io.to(`post:${postId}`).emit('comment:created', newComment);

// 离开房间（用户离开文章页面时）
socket.emit('leave:room', `post:${postId}`);
```

---

## 五、客户端实现

### 5.1 纯 HTML + JS 测试页面

创建一个完整的测试页面，用于调试 WebSocket 功能：

```html
<!-- public/socket-test.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>博客实时通信测试</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    h1 { color: #333; margin-bottom: 20px; }

    .card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .card h2 {
      color: #555;
      font-size: 16px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #eee;
    }

    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
    }

    .status.connected { background: #d4edda; color: #155724; }
    .status.disconnected { background: #f8d7da; color: #721c24; }

    .stats { font-size: 24px; font-weight: bold; color: #007bff; }

    input, textarea, button {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 10px;
    }

    button {
      background: #007bff;
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    }

    button:hover { background: #0056b3; }
    button:disabled { background: #ccc; cursor: not-allowed; }

    .btn-danger { background: #dc3545; }
    .btn-danger:hover { background: #c82333; }
    .btn-success { background: #28a745; }
    .btn-success:hover { background: #218838; }

    #messages {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #eee;
      border-radius: 8px;
      padding: 10px;
      background: #fafafa;
    }

    .message {
      padding: 8px 12px;
      margin-bottom: 8px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.5;
    }

    .message.system { background: #e9ecef; color: #666; }
    .message.comment { background: #d1ecf1; color: #0c5460; }
    .message.notification { background: #fff3cd; color: #856404; }

    .typing-indicator {
      font-style: italic;
      color: #999;
      font-size: 13px;
      min-height: 20px;
      margin-top: 5px;
    }

    .flex { display: flex; gap: 10px; }
    .flex > * { flex: 1; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔌 博客实时通信测试</h1>

    <!-- 连接状态 -->
    <div class="card">
      <h2>连接状态</h2>
      <p>
        状态：<span id="status" class="status disconnected">未连接</span>
      </p>
      <p style="margin-top: 10px;">
        在线用户：<span id="online-count" class="stats">0</span> 人
      </p>
      <div class="flex" style="margin-top: 15px;">
        <div>
          <input type="text" id="token-input" placeholder="输入 JWT Token" value="your-test-token">
        </div>
        <div style="flex: 0 0 auto; display: flex; align-items: center;">
          <button onclick="connectSocket()" id="btn-connect">连接</button>
          <button onclick="disconnectSocket()" id="btn-disconnect" class="btn-danger" style="margin-left: 10px;">断开</button>
        </div>
      </div>
    </div>

    <!-- 房间管理 -->
    <div class="card">
      <h2>文章房间</h2>
      <div class="flex">
        <input type="number" id="post-id" placeholder="文章 ID" value="1">
        <button onclick="joinRoom()" class="btn-success">加入房间</button>
        <button onclick="leaveRoom()" class="btn-danger">离开房间</button>
      </div>
    </div>

    <!-- 发送评论 -->
    <div class="card">
      <h2>发送评论</h2>
      <textarea id="comment-input" placeholder="输入评论内容..." rows="3"></textarea>
      <button onclick="sendComment()">发送评论</button>
      <div class="typing-indicator" id="typing-indicator"></div>
    </div>

    <!-- 消息日志 -->
    <div class="card">
      <h2>消息日志</h2>
      <div id="messages"></div>
      <button onclick="clearMessages()" style="margin-top: 10px; background: #6c757d;">清空日志</button>
    </div>
  </div>

  <!-- Socket.IO 客户端（CDN） -->
  <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>

  <script>
    let socket = null;
    let typingTimeout = null;

    // ==================== 连接管理 ====================

    function connectSocket() {
      const token = document.getElementById('token-input').value;

      if (socket && socket.connected) {
        log('已经连接，请先断开', 'system');
        return;
      }

      // 创建连接
      socket = io('http://localhost:3000', {
        auth: { token },
        // 自动重连
        reconnection: true,
        reconnectionDelay: 1000,      // 重连间隔
        reconnectionDelayMax: 5000,   // 最大重连间隔
        reconnectionAttempts: 10,     // 最大重连次数
      });

      // ==================== 连接事件 ====================

      socket.on('connect', () => {
        log(`✅ 已连接，Socket ID: ${socket.id}`, 'system');
        updateStatus(true);
      });

      socket.on('disconnect', (reason) => {
        log(`❌ 断开连接: ${reason}`, 'system');
        updateStatus(false);
      });

      socket.on('connect_error', (error) => {
        log(`⚠️ 连接失败: ${error.message}`, 'system');
      });

      // 重连事件
      socket.io.on('reconnect_attempt', (attempt) => {
        log(`🔄 尝试重连 (${attempt})...`, 'system');
      });

      socket.io.on('reconnect', () => {
        log('✅ 重连成功', 'system');
      });

      socket.io.on('reconnect_failed', () => {
        log('❌ 重连失败，已达到最大重试次数', 'system');
      });

      // ==================== 业务事件 ====================

      // 新文章通知
      socket.on('post:created', (data) => {
        log(`📝 新文章: 《${data.title}》 by ${data.author}`, 'notification');
      });

      // 实时评论
      socket.on('comment:created', (data) => {
        log(`💬 评论 [文章${data.postId}]: ${data.comment.username}: ${data.comment.content}`, 'comment');
      });

      // 用户上线/下线
      socket.on('user:online', (data) => {
        log(`🟢 ${data.username} 上线了`, 'system');
      });

      socket.on('user:offline', (data) => {
        log(`🔴 用户 ${data.userId} 下线了`, 'system');
      });

      // 在线人数
      socket.on('stats:online', (count) => {
        document.getElementById('online-count').textContent = count;
      });

      // 输入状态
      socket.on('typing:update', (data) => {
        const indicator = document.getElementById('typing-indicator');
        if (data.isTyping) {
          indicator.textContent = `${data.username} 正在输入...`;
        } else {
          indicator.textContent = '';
        }
      });

      // 错误
      socket.on('error', (message) => {
        log(`❌ 错误: ${message}`, 'system');
      });
    }

    function disconnectSocket() {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    }

    // ==================== 房间操作 ====================

    function joinRoom() {
      const postId = document.getElementById('post-id').value;
      if (!socket || !socket.connected) {
        log('请先连接服务器', 'system');
        return;
      }
      socket.emit('join:room', `post:${postId}`);
      log(`📌 加入文章 ${postId} 的房间`, 'system');
    }

    function leaveRoom() {
      const postId = document.getElementById('post-id').value;
      if (!socket || !socket.connected) return;
      socket.emit('leave:room', `post:${postId}`);
      log(`📤 离开文章 ${postId} 的房间`, 'system');
    }

    // ==================== 评论操作 ====================

    function sendComment() {
      const postId = parseInt(document.getElementById('post-id').value);
      const content = document.getElementById('comment-input').value.trim();

      if (!content) {
        log('请输入评论内容', 'system');
        return;
      }

      if (!socket || !socket.connected) {
        log('请先连接服务器', 'system');
        return;
      }

      socket.emit('comment:create', { postId, content });
      document.getElementById('comment-input').value = '';
      log(`📤 发送评论: ${content}`, 'comment');
    }

    // 输入状态（防抖）
    document.getElementById('comment-input').addEventListener('input', () => {
      if (!socket || !socket.connected) return;

      const postId = parseInt(document.getElementById('post-id').value);
      socket.emit('typing:start', { postId });

      // 防抖：停止输入 2 秒后发送 stop
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit('typing:stop', { postId });
      }, 2000);
    });

    // ==================== UI 工具函数 ====================

    function updateStatus(connected) {
      const statusEl = document.getElementById('status');
      statusEl.textContent = connected ? '已连接' : '未连接';
      statusEl.className = `status ${connected ? 'connected' : 'disconnected'}`;
      document.getElementById('btn-connect').disabled = connected;
      document.getElementById('btn-disconnect').disabled = !connected;
    }

    function log(message, type = 'system') {
      const messagesEl = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = `message ${type}`;
      const time = new Date().toLocaleTimeString();
      div.textContent = `[${time}] ${message}`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function clearMessages() {
      document.getElementById('messages').innerHTML = '';
    }
  </script>
</body>
</html>
```

---

## 六、博客实时功能

### 6.1 新文章通知

当作者发布新文章时，通知所有在线用户：

```typescript
// src/services/post.service.ts
import { PrismaClient } from '@prisma/client';
import { getIO } from '../lib/socket';

const prisma = new PrismaClient();

/**
 * 创建文章（带实时通知）
 */
export async function createPost(data: {
  title: string;
  content: string;
  authorId: number;
  tags?: string[];
}): Promise<any> {
  // 1. 保存到数据库
  const post = await prisma.post.create({
    data: {
      title: data.title,
      content: data.content,
      author: { connect: { id: data.authorId } },
      tags: data.tags
        ? { connectOrCreate: data.tags.map(name => ({
            where: { name },
            create: { name },
          }))}
        : undefined,
    },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      tags: true,
    },
  });

  // 2. 通过 Socket.IO 通知所有在线用户
  const io = getIO();
  io.emit('post:created', {
    postId: post.id,
    title: post.title,
    author: post.author.name,
  });

  console.log(`📢 新文章通知已发送: 《${post.title}》`);

  return post;
}
```

### 6.2 实时评论

评论发送后立即推送给正在阅读该文章的用户：

```typescript
// src/services/comment.service.ts
import { PrismaClient } from '@prisma/client';
import { getIO } from '../lib/socket';

const prisma = new PrismaClient();

/**
 * 创建评论（带实时推送）
 */
export async function createComment(data: {
  postId: number;
  userId: number;
  content: string;
  parentId?: number; // 回复某条评论
}): Promise<any> {
  // 1. 保存到数据库
  const comment = await prisma.comment.create({
    data: {
      content: data.content,
      post: { connect: { id: data.postId } },
      user: { connect: { id: data.userId } },
      parent: data.parentId
        ? { connect: { id: data.parentId } }
        : undefined,
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

  // 2. 推送给正在阅读该文章的用户
  const io = getIO();
  io.to(`post:${data.postId}`).emit('comment:created', {
    postId: data.postId,
    comment: {
      id: comment.id,
      content: comment.content,
      userId: comment.user.id,
      username: comment.user.name,
      avatar: comment.user.avatar,
      parentId: data.parentId || null,
      createdAt: comment.createdAt.toISOString(),
    },
  });

  console.log(`💬 评论已推送到文章 ${data.postId} 的房间`);

  return comment;
}
```

### 6.3 在线用户统计

```typescript
// src/services/stats.service.ts
import { getIO } from '../lib/socket';
import redis from '../lib/redis';

/**
 * 获取当前在线用户详情
 */
export async function getOnlineUsers(): Promise<{
  count: number;
  users: Array<{ userId: number; socketId: string }>;
}> {
  const io = getIO();
  const sockets = await io.fetchSockets();

  const users = sockets.map(s => ({
    userId: s.data.userId,
    username: s.data.username,
    socketId: s.id,
  }));

  return {
    count: users.length,
    users,
  };
}

/**
 * 获取历史在线峰值（用 Redis 记录）
 */
export async function getOnlinePeak(): Promise<number> {
  const peak = await redis.get('stats:online:peak');
  return peak ? parseInt(peak) : 0;
}

/**
 * 更新在线峰值（在连接事件中调用）
 */
export async function updateOnlinePeak(currentCount: number): Promise<void> {
  const peak = await getOnlinePeak();
  if (currentCount > peak) {
    await redis.set('stats:online:peak', currentCount.toString());
    console.log(`🏆 新的在线峰值: ${currentCount} 人`);
  }
}
```

### 6.4 统计路由

```typescript
// src/routes/stats.routes.ts
import { Router, Request, Response } from 'express';
import { getOnlineUsers, getOnlinePeak } from '../services/stats.service';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /api/stats/online
 * 获取当前在线用户
 */
router.get('/online', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = await getOnlineUsers();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: '获取在线统计失败' });
  }
});

/**
 * GET /api/stats/peak
 * 获取在线峰值
 */
router.get('/peak', async (req: Request, res: Response) => {
  try {
    const peak = await getOnlinePeak();
    res.json({ peak });
  } catch (error) {
    res.status(500).json({ error: '获取在线峰值失败' });
  }
});

export default router;
```

---

## 七、消息格式设计

### 7.1 统一消息格式

```typescript
// src/types/socket-events.ts

/**
 * Socket 消息统一格式
 *
 * 设计原则：
 * 1. type 字段标识消息类型（便于客户端分发处理）
 * 2. data 字段携带数据
 * 3. timestamp 记录时间
 * 4. meta 携带元信息（如房间、来源等）
 */
export interface SocketMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: string;   // ISO 8601 格式
  meta?: {
    roomId?: string;
    senderId?: number;
    senderName?: string;
  };
}

// ==================== 事件类型定义 ====================

// 文章相关事件
export interface PostCreatedEvent {
  postId: number;
  title: string;
  summary: string;
  author: { id: number; name: string; avatar: string };
  createdAt: string;
}

export interface PostUpdatedEvent {
  postId: number;
  title: string;
  updatedAt: string;
}

// 评论相关事件
export interface CommentCreatedEvent {
  postId: number;
  comment: {
    id: number;
    content: string;
    userId: number;
    username: string;
    avatar: string;
    parentId: number | null;
    createdAt: string;
  };
}

// 用户状态事件
export interface UserStatusEvent {
  userId: number;
  username: string;
  status: 'online' | 'offline';
}

// 输入状态事件
export interface TypingEvent {
  postId: number;
  userId: number;
  username: string;
  isTyping: boolean;
}

// 在线统计事件
export interface OnlineStatsEvent {
  count: number;
  users?: Array<{ userId: number; username: string }>;
}

// 通知事件
export interface NotificationEvent {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'system';
  title: string;
  message: string;
  link?: string;         // 点击跳转链接
  createdAt: string;
}
```

### 7.2 事件类型枚举

```typescript
// src/types/socket-events.ts (续)

/**
 * 事件类型枚举
 * 集中管理所有事件名称，避免字符串拼写错误
 */
export const SOCKET_EVENTS = {
  // 客户端 → 服务器
  CLIENT: {
    JOIN_ROOM: 'join:room',
    LEAVE_ROOM: 'leave:room',
    COMMENT_CREATE: 'comment:create',
    COMMENT_REPLY: 'comment:reply',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',
    NOTIFICATION_READ: 'notification:read',
  },

  // 服务器 → 客户端
  SERVER: {
    POST_CREATED: 'post:created',
    POST_UPDATED: 'post:updated',
    COMMENT_CREATED: 'comment:created',
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
    TYPING_UPDATE: 'typing:update',
    ONLINE_STATS: 'stats:online',
    NOTIFICATION: 'notification:new',
    ERROR: 'error',
  },
} as const;
```

---

## 八、断线重连处理

### 8.1 服务端：记录离线消息

当用户离线时，缓存发给他的消息，上线后补发：

```typescript
// src/lib/socket-messages.ts
import redis from './redis';

const MESSAGE_TTL = 3600 * 24; // 离线消息保留 24 小时
const MAX_MESSAGES = 100;       // 每个用户最多缓存 100 条

/**
 * 缓存离线消息
 * 当用户不在线时，将消息存入 Redis 列表
 */
export async function cacheOfflineMessage(
  userId: number,
  message: any
): Promise<void> {
  const key = `offline:messages:${userId}`;

  // 用 LPUSH 从左边推入（最新的在前面）
  await redis.lpush(key, JSON.stringify(message));

  // 限制列表长度
  await redis.ltrim(key, 0, MAX_MESSAGES - 1);

  // 设置过期时间
  await redis.expire(key, MESSAGE_TTL);

  console.log(`📦 缓存离线消息给用户 ${userId}`);
}

/**
 * 获取并清除离线消息
 * 用户上线时调用
 */
export async function getAndClearOfflineMessages(
  userId: number
): Promise<any[]> {
  const key = `offline:messages:${userId}`;

  // 获取所有消息
  const messages = await redis.lrange(key, 0, -1);

  // 清除缓存
  if (messages.length > 0) {
    await redis.del(key);
    console.log(`📬 为用户 ${userId} 补发 ${messages.length} 条离线消息`);
  }

  // 反转顺序（从旧到新）
  return messages.reverse().map(msg => JSON.parse(msg));
}
```

### 8.2 在连接事件中补发消息

```typescript
// 在 io.on('connection') 中添加
io.on('connection', async (socket) => {
  const { userId, username } = socket.data;

  // ... 其他代码 ...

  // 补发离线消息
  const offlineMessages = await getAndClearOfflineMessages(userId);
  for (const message of offlineMessages) {
    socket.emit('notification:new', message);
  }

  if (offlineMessages.length > 0) {
    console.log(`📬 为 ${username} 补发了 ${offlineMessages.length} 条消息`);
  }
});
```

### 8.3 客户端重连策略

```typescript
// 前端代码示例（TypeScript + socket.io-client）

import { io, Socket } from 'socket.io-client';

interface ReconnectOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

class SocketManager {
  private socket: Socket | null = null;
  private retryCount = 0;
  private options: ReconnectOptions = {
    maxRetries: 10,
    baseDelay: 1000,
    maxDelay: 30000,
  };

  connect(token: string) {
    this.socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: this.options.baseDelay,
      reconnectionDelayMax: this.options.maxDelay,
      reconnectionAttempts: this.options.maxRetries,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket 连接成功');
      this.retryCount = 0;

      // 连接成功后，重新加入之前的房间
      this.rejoinRooms();
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`❌ Socket 断开: ${reason}`);

      // 如果是服务器主动断开，不自动重连
      if (reason === 'io server disconnect') {
        console.log('服务器主动断开，不自动重连');
      }
    });

    // 使用指数退避重连
    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.retryCount = attempt;
      const delay = Math.min(
        this.options.baseDelay * Math.pow(2, attempt),
        this.options.maxDelay
      );
      console.log(`🔄 第 ${attempt} 次重连，等待 ${delay}ms...`);
    });

    this.socket.io.on('reconnect', (attempt) => {
      console.log(`✅ 第 ${attempt} 次重连成功`);
    });

    this.socket.io.on('reconnect_failed', () => {
      console.log('❌ 重连失败，请刷新页面');
      // 可以在这里显示一个重连失败的 UI
    });
  }

  // 记录已加入的房间，重连后自动重新加入
  private joinedRooms = new Set<string>();

  joinRoom(roomId: string) {
    this.socket?.emit('join:room', roomId);
    this.joinedRooms.add(roomId);
  }

  leaveRoom(roomId: string) {
    this.socket?.emit('leave:room', roomId);
    this.joinedRooms.delete(roomId);
  }

  private rejoinRooms() {
    for (const roomId of this.joinedRooms) {
      this.socket?.emit('join:room', roomId);
      console.log(`📌 重新加入房间: ${roomId}`);
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.joinedRooms.clear();
  }
}

export const socketManager = new SocketManager();
```

---

## 九、完整实战：评论路由

```typescript
// src/routes/comment.routes.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getIO } from '../lib/socket';
import { authMiddleware } from '../middleware/auth';
import { rateLimiters } from '../middleware/rate-limiter';
import { cache } from '../lib/cache';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/posts/:postId/comments
 * 创建评论（数据库 + 实时推送 + 缓存清除）
 */
router.post(
  '/posts/:postId/comments',
  authMiddleware,
  rateLimiters.createComment,
  async (req: Request, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      const { content, parentId } = req.body;
      const userId = req.session.userId;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: '评论内容不能为空' });
      }

      if (content.length > 2000) {
        return res.status(400).json({ error: '评论内容不能超过 2000 字' });
      }

      // 1. 保存到数据库
      const comment = await prisma.comment.create({
        data: {
          content: content.trim(),
          post: { connect: { id: postId } },
          user: { connect: { id: userId } },
          parent: parentId ? { connect: { id: parentId } } : undefined,
        },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
        },
      });

      // 2. 实时推送给该文章房间内的用户
      const io = getIO();
      io.to(`post:${postId}`).emit('comment:created', {
        postId,
        comment: {
          id: comment.id,
          content: comment.content,
          userId: comment.user.id,
          username: comment.user.name,
          avatar: comment.user.avatar,
          parentId: parentId || null,
          createdAt: comment.createdAt.toISOString(),
        },
      });

      // 3. 清除文章详情缓存（评论数变了）
      await cache.del(`post:${postId}`);

      // 4. 如果是回复某条评论，通知被回复的用户
      if (parentId) {
        const parentComment = await prisma.comment.findUnique({
          where: { id: parentId },
          select: { userId: true },
        });

        if (parentComment && parentComment.userId !== userId) {
          // 通知被回复的用户（如果在线）
          const sockets = await io.fetchSockets();
          const targetSocket = sockets.find(
            s => s.data.userId === parentComment.userId
          );

          if (targetSocket) {
            targetSocket.emit('notification:new', {
              id: `reply-${comment.id}`,
              type: 'comment',
              title: '收到新回复',
              message: `${comment.user.name} 回复了你的评论`,
              link: `/posts/${postId}#comment-${comment.id}`,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      res.status(201).json(comment);
    } catch (error) {
      console.error('创建评论失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  }
);

/**
 * GET /api/posts/:postId/comments
 * 获取文章评论列表（带缓存）
 */
router.get('/posts/:postId/comments', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const cacheKey = `comments:post:${postId}:${page}:${limit}`;

    // 查缓存
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 查数据库
    const skip = (page - 1) * limit;
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { postId, parentId: null }, // 只查顶级评论
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          replies: {
            take: 5,
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, name: true, avatar: true } },
            },
          },
          _count: { select: { replies: true } },
        },
      }),
      prisma.comment.count({ where: { postId, parentId: null } }),
    ]);

    const result = { comments, total, page, limit };

    // 写入缓存（评论列表缓存 2 分钟）
    await cache.set(cacheKey, result, 120);

    res.json(result);
  } catch (error) {
    console.error('获取评论失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
```

---

## 十、动手练习

### 练习 1：私信功能

实现用户之间的实时私信：

```typescript
// TODO: 实现以下功能
// 1. 用户 A 向用户 B 发送私信
// 2. 如果 B 在线，实时推送
// 3. 如果 B 离线，缓存离线消息
// 4. B 上线时补发离线消息
// 5. 支持查看历史私信（REST API）

// 提示：
// 使用 "私聊房间" 的概念：每个用户有一个以 userId 命名的房间
// 发送时：io.to(`user:${targetUserId}`).emit('message:private', data)
```

### 练习 2：文章点赞实时通知

```typescript
// TODO: 实现以下功能
// 1. 用户点赞文章时，实时通知文章作者
// 2. 使用 Redis Set 记录每篇文章的点赞用户
// 3. 防止重复点赞
// 4. 显示实时点赞数

// 提示：
// Redis 命令：SADD, SISMEMBER, SCARD
// 点赞键：post:{id}:likes
```

### 练习 3：在线状态管理

```typescript
// TODO: 实现以下功能
// 1. 维护用户的在线状态（在线/离线/离开/忙碌）
// 2. 心跳检测（30 秒无响应标记为离线）
// 3. 提供查询用户在线状态的 REST API
// 4. 好友上线时收到通知

// 提示：
// 使用 Redis Hash 存储：HSET user:status {userId} "online"
// 心跳：客户端每 10 秒发送一次 ping，服务端记录最后心跳时间
```

---

## 小结

本课我们学习了：

1. **HTTP 的局限性**：请求-响应模式无法实现服务器主动推送
2. **WebSocket 协议**：全双工通信，一次握手后双向实时通信
3. **Socket.IO 库**：封装了 WebSocket，提供自动重连、房间、广播等功能
4. **房间机制**：类似群聊，可以向特定房间的用户广播消息
5. **认证中间件**：在握手阶段验证 JWT，将用户信息存入 socket.data
6. **实时功能**：新文章通知、实时评论、在线统计、输入状态
7. **断线重连**：客户端指数退避重连，服务端缓存离线消息并补发

**核心概念回顾：**

```
Socket.IO 通信模型：

客户端 (浏览器)              服务器
    │                         │
    │── emit('event', data) ──►│   客户端发送事件
    │                         │
    │◄── emit('event', data) ──│   服务器发送事件（单播）
    │                         │
    │◄── broadcast.emit() ────│   广播给所有其他人
    │                         │
    │◄── io.to(room).emit() ──│   广播给房间内的人
```

**最佳实践：**
- 事件名称集中管理（用常量或枚举）
- 消息格式统一（type + data + timestamp）
- 敏感操作需要在中间件中验证权限
- 离线消息要有 TTL，避免无限积累
- 心跳检测要及时发现异常断开

下一课我们将学习 **消息队列**，用异步任务处理来提升系统的响应速度和可靠性。
