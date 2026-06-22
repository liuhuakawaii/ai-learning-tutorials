const WebSocket = require('ws');

/**
 * WebRTC 信令服务
 * 负责在对等端之间转发 SDP 和 ICE 候选
 *
 * 信令流程：
 * 1. 客户端连接 WebSocket，发送 join 消息加入房间
 * 2. 服务端广播 peer-join 通知房间内其他成员
 * 3. 客户端通过 relay 消息交换 SDP offer/answer 和 ICE 候选
 * 4. 客户端断开时，服务端广播 peer-leave
 */
function setupSignaling(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/signal' });

  // 房间管理：roomId -> Set<WebSocket>
  const rooms = new Map();

  wss.on('connection', (ws) => {
    let currentRoom = null;
    let peerId = null;

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: '消息格式错误' }));
        return;
      }

      switch (msg.type) {
        case 'join':
          handleJoin(ws, msg);
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          handleRelay(ws, msg);
          break;

        case 'chat':
          handleChat(ws, msg);
          break;

        case 'leave':
          handleLeave(ws);
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: `未知消息类型: ${msg.type}` }));
      }
    });

    ws.on('close', () => {
      handleLeave(ws);
    });

    function handleJoin(ws, msg) {
      const { roomId, name } = msg;

      if (!roomId) {
        ws.send(JSON.stringify({ type: 'error', message: '缺少 roomId' }));
        return;
      }

      // 离开之前的房间
      if (currentRoom) {
        handleLeave(ws);
      }

      // 加入新房间
      currentRoom = roomId;
      peerId = name || `peer_${Date.now()}`;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }

      const room = rooms.get(roomId);

      // 通知新成员已有对等端
      const existingPeers = [];
      for (const client of room) {
        if (client.readyState === WebSocket.OPEN) {
          existingPeers.push(client.peerId);
          client.send(JSON.stringify({
            type: 'peer-join',
            peerId,
            roomId
          }));
        }
      }

      room.add(ws);
      ws.peerId = peerId;
      ws.currentRoom = roomId;

      ws.send(JSON.stringify({
        type: 'joined',
        peerId,
        roomId,
        peers: existingPeers
      }));

      console.log(`📡 ${peerId} 加入房间 ${roomId}（当前 ${room.size} 人）`);
    }

    function handleRelay(ws, msg) {
      if (!currentRoom) {
        ws.send(JSON.stringify({ type: 'error', message: '未加入任何房间' }));
        return;
      }

      const room = rooms.get(currentRoom);
      if (!room) return;

      // 转发给目标对等端
      const { targetPeer } = msg;
      for (const client of room) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          if (!targetPeer || client.peerId === targetPeer) {
            client.send(JSON.stringify({
              ...msg,
              fromPeer: peerId
            }));
          }
        }
      }
    }

    function handleChat(ws, msg) {
      if (!currentRoom) return;

      const room = rooms.get(currentRoom);
      if (!room) return;

      // 广播聊天消息
      for (const client of room) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'chat',
            fromPeer: peerId,
            message: msg.message,
            timestamp: Date.now()
          }));
        }
      }
    }

    function handleLeave(ws) {
      if (!currentRoom) return;

      const room = rooms.get(currentRoom);
      if (room) {
        room.delete(ws);

        // 通知其他成员
        for (const client of room) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'peer-leave',
              peerId
            }));
          }
        }

        // 空房间自动清理
        if (room.size === 0) {
          rooms.delete(currentRoom);
        }
      }

      console.log(`📡 ${peerId} 离开房间 ${currentRoom}`);
      currentRoom = null;
    }
  });

  console.log('📡 WebSocket 信令服务已初始化');
  return wss;
}

module.exports = { setupSignaling };
