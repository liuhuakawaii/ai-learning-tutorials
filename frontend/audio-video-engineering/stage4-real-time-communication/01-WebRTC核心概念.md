# WebRTC 核心概念

## 场景引入

你打开 Google Meet，点击"新建会议"，把链接发给同事。同事点击链接后，你们的视频画面几乎瞬间出现在彼此的屏幕上——声音清晰、画面流畅，中间没有任何插件安装。

这一切是怎么发生的？两个浏览器之间是如何建立起一条实时音视频通道的？

浏览器分别在不同的网络环境中，中间隔着 NAT、防火墙、运营商的层层障碍。WebRTC 的核心工作就是：**让两个浏览器在任意网络条件下，都能找到彼此，并建立一条加密的实时通信通道**。

这一课我们从架构层面理解 WebRTC 的设计原理，搞清楚信令、ICE、STUN、TURN、DTLS 各自的角色，建立完整的认知地图。

## 学习目标

1. 理解 WebRTC 的整体架构，区分媒体平面和信令平面
2. 掌握信令机制：SDP offer/answer 模型
3. 理解 ICE 框架如何解决 NAT 穿透问题
4. 了解 STUN/TURN 服务器的职责和区别
5. 理解 DTLS/SRTP 如何保障传输安全

## WebRTC 架构概览

WebRTC 的架构分为两个平面：

```
┌─────────────────────────────────────────────────┐
│                   应用层                         │
│         你的 JavaScript / 前端代码               │
├────────────────────┬────────────────────────────┤
│    信令平面        │        媒体平面             │
│  (Signaling)       │      (Media Plane)          │
│                    │                             │
│  SDP 交换          │   音频: Opus / G.711       │
│  ICE candidate     │   视频: VP8 / VP9 / H.264  │
│  房间管理          │   数据: SCTP / DataChannel  │
│                    │                             │
│  传输: WebSocket   │   传输: SRTP (加密)        │
│  或 HTTP           │        DTLS (密钥交换)     │
└────────────────────┴────────────────────────────┘
```

**媒体平面**负责音视频数据的采集、编码、传输、解码和渲染。所有数据都经过 DTLS/SRTP 加密，直接在浏览器之间传输。

**信令平面**负责"协调"工作——谁要和谁通话、用什么编解码器、网络地址是什么。WebRTC 标准**不规定**信令协议，由开发者自行选择（通常用 WebSocket）。

这两个平面使用不同的传输通道：信令走服务器中转，媒体尽可能走点对点。

## 信令机制：SDP Offer/Answer

WebRTC 使用 SDP（Session Description Protocol）来描述媒体会话。两个浏览器通过 offer/answer 模型协商媒体参数。

### SDP 的本质

SDP 是一段纯文本，描述了：

```
v=0                          // SDP 版本
o=- 4611731400461173140 2 IN IP4 127.0.0.1
s=-                          // 会话名称
t=0 0                        // 时间信息

m=audio 9 UDP/TLS/RTP/SAVPF 111  // 音频媒体行
a=rtpmap:111 opus/48000/2        // 编解码器: Opus
a=fmtp:111 minptime=10           // Opus 参数
a=sendrecv                       // 双向发送接收

m=video 9 UDP/TLS/RTP/SAVPF 96  // 视频媒体行
a=rtpmap:96 VP8/90000            // 编解码器: VP8
a=rtcp-fb:96 nack               // 反馈机制
```

### Offer/Answer 交互流程

```javascript
// === 发起方（Caller）===
const pc1 = new RTCPeerConnection(config);

// 1. 获取本地媒体流
const stream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});
stream.getTracks().forEach(track => pc1.addTrack(track, stream));

// 2. 创建 Offer
const offer = await pc1.createOffer();
// offer.sdp 包含 SDP 文本

// 3. 设置本地描述
await pc1.setLocalDescription(offer);

// 4. 通过信令服务器发送给对方
signalingServer.send({ type: 'offer', sdp: offer.sdp });


// === 接收方（Callee）===
const pc2 = new RTCPeerConnection(config);

// 5. 收到 Offer，设置远程描述
await pc2.setRemoteDescription({ type: 'offer', sdp: receivedOffer.sdp });

// 6. 获取本地媒体流并添加
const stream2 = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
stream2.getTracks().forEach(track => pc2.addTrack(track, stream2));

// 7. 创建 Answer
const answer = await pc2.createAnswer();

// 8. 设置本地描述
await pc2.setLocalDescription(answer);

// 9. 通过信令服务器发回
signalingServer.send({ type: 'answer', sdp: answer.sdp });


// === 发起方收到 Answer ===
// 10. 设置远程描述
await pc1.setRemoteDescription({ type: 'answer', sdp: receivedAnswer.sdp });
```

关键点：`setLocalDescription` 和 `setRemoteDescription` 是配对操作，必须按顺序完成。在 setLocalDescription 之后，ICE 才会开始收集候选地址。

## ICE 框架：解决 NAT 穿透

ICE（Interactive Connectivity Establishment）是 WebRTC 解决网络连通性的核心机制。浏览器运行在一个可能有 NAT、防火墙的网络环境中，ICE 的任务是**找到一条可用的传输路径**。

### 候选地址类型

ICE 会收集三种候选地址：

```
┌──────────────┬─────────────────────────────────────┐
│ 类型          │ 说明                                │
├──────────────┼─────────────────────────────────────┤
│ Host         │ 本机的 IP 地址（局域网内直接通信）   │
│ Server-reflexive │ 经过 NAT 后的公网地址           │
│ Relay        │ TURN 服务器分配的中继地址            │
└──────────────┴─────────────────────────────────────┘
```

**Host 候选**是机器的真实 IP（如 192.168.1.100），用于局域网内的直连。

**Server-reflexive 候选**（srflx）是通过 STUN 服务器获取的公网映射地址。NAT 会为内网设备分配一个公网 IP:Port，STUN 服务器告诉你"从外网看你的地址是什么"。

**Relay 候选**（relay）是 TURN 服务器分配的中继地址。当两个浏览器无法直连时（对称 NAT），数据通过 TURN 服务器转发。

### ICE 候选收集过程

```javascript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turn.example.com:3478',
      username: 'user123',
      credential: 'pass456'
    }
  ]
});

// 监听 ICE 候选事件
pc.onicecandidate = (event) => {
  if (event.candidate) {
    // 收集到一个新的候选地址
    const candidate = event.candidate;
    console.log(`类型: ${candidate.type}, 地址: ${candidate.address}:${candidate.port}`);
    // 通过信令服务器发送给对方
    signalingServer.send({
      type: 'candidate',
      candidate: candidate.toJSON()
    });
  } else {
    // ICE 收集完成（所有候选都已收集）
    console.log('ICE 收集完成');
  }
};

// 对方收到候选后添加
function onRemoteCandidate(candidateData) {
  const candidate = new RTCIceCandidate(candidateData);
  pc.addIceCandidate(candidate);
}
```

### ICE 连通性检查

收集完候选地址后，ICE 会对所有候选对（local candidate + remote candidate）进行连通性检查：

```
候选对优先级：
1. Host ↔ Host （局域网直连，最快）
2. Host ↔ srflx （一端有 NAT）
3. srflx ↔ srflx （两端都有 NAT，但可穿透）
4. relay ↔ 任意 （TURN 中继，最可靠但延迟最高）
```

ICE 会优先尝试高优先级的候选对，找到第一个成功的就使用。这就是为什么局域网内的 WebRTC 延迟极低（直接 Host ↔ Host），而跨 NAT 通信可能走 TURN 中继。

## STUN 与 TURN 服务器

### STUN 服务器

STUN（Session Traversal Utilities for NAT）服务器的工作非常简单：告诉客户端"你从公网看起来是什么地址"。

```
浏览器 ──"我从哪来？"──→ STUN 服务器
浏览器 ←──"你的公网地址是 203.0.113.5:12345"── STUN 服务器
```

STUN 服务器轻量、无状态，Google 提供了免费的 `stun:stun.l.google.com:19302`。但 STUN 对**对称 NAT**（Symmetric NAT）无效——对称 NAT 对不同目标分配不同的映射端口，STUN 获取的端口在与对方通信时不可用。

### TURN 服务器

TURN（Traversal Using Relays around NAT）服务器是最后的保障：当直连失败时，TURN 服务器充当中继，转发所有媒体数据。

```
浏览器A ──→ TURN 服务器 ──→ 浏览器B
浏览器B ──→ TURN 服务器 ──→ 浏览器A
```

TURN 的代价：

```
┌────────────────┬──────────────┬──────────────┐
│ 指标            │ 直连（P2P）  │ TURN 中继    │
├────────────────┼──────────────┼──────────────┤
│ 延迟            │ 最低         │ 增加 50-200ms│
│ 带宽成本        │ 无额外       │ 需付费       │
│ 服务器负载      │ 无           │ 高           │
│ 穿透成功率      │ ~85%         │ ~99%         │
└────────────────┴──────────────┴──────────────┘
```

### 开源 TURN 服务器部署

coturn 是最常用的开源 TURN/STUN 服务器：

```bash
# Docker 部署
docker run -d --network=host \
  -e DETECT_EXTERNAL_IP=yes \
  -e DETECT_RELAY_IP=yes \
  coturn/coturn \
  -n \
  --realm=turn.example.com \
  --user=myuser:mypassword \
  --lt-cred-mech \
  --fingerprint \
  --listening-port=3478 \
  --tls-listening-port=5349 \
  --min-port=49152 \
  --max-port=65535
```

生产环境 TURN 配置示例：

```javascript
const config = {
  iceServers: [
    {
      urls: [
        'stun:stun1.example.com:3478',
        'stun:stun2.example.com:3478'
      ]
    },
    {
      urls: [
        'turn:turn1.example.com:3478?transport=udp',
        'turn:turn1.example.com:3478?transport=tcp',
        'turns:turn1.example.com:5349?transport=tcp'
      ],
      username: 'dynamic-user',
      credential: 'dynamic-password'
    }
  ],
  iceTransportPolicy: 'all'  // 'relay' 表示仅使用 TURN
};
```

## DTLS/SRTP 加密

WebRTC 所有通信都是加密的，这不是可选项，而是强制要求。

### 加密分层

```
┌─────────────────────────────────────┐
│          应用数据                    │
├─────────────────────────────────────┤
│  SRTP (Secure Real-time Transport)  │  ← 音视频数据加密
│  加密算法: AES-128-CM               │
├─────────────────────────────────────┤
│  DTLS (Datagram TLS)                │  ← 密钥交换
│  类似 TLS，但运行在 UDP 上           │
├─────────────────────────────────────┤
│  UDP                                │
└─────────────────────────────────────┘
```

**DTLS**在连接建立阶段完成密钥交换（类似 HTTPS 的 TLS 握手），协商出对称加密密钥。DTLS 的证书自动生成，不需要 CA 签发。

**SRTP**使用 DTLS 协商出的密钥，对每一个 RTP 包进行加密。接收方用同样的密钥解密。密钥轮换定期自动进行。

```javascript
// DTLS 是自动完成的，开发者无需手动配置
// 但你可以检查加密状态
pc.getStats().then(stats => {
  stats.forEach(report => {
    if (report.type === 'transport') {
      console.log('DTLS 状态:', report.dtlsState);
      // 'new' | 'connecting' | 'connected' | 'closed'
    }
  });
});
```

### 证书指纹验证

SDP 中包含 DTLS 证书的指纹，用于防中间人攻击：

```
a=fingerprint:sha-256 4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B:19:E5:7C:AB
```

双方在信令阶段交换指纹，DTLS 握手时验证对方证书是否匹配。这依赖于信令通道的安全性——如果信令被篡改，攻击者可以替换指纹。

## 完整连接建立流程

```
浏览器 A                     信令服务器                    浏览器 B
   │                              │                           │
   │─── 创建 Offer ─────────────→│←──────────────────────────│
   │                              │                           │
   │←─ ICE candidates ──────────→│←── ICE candidates ───────→│
   │                              │                           │
   │    STUN 查询                 │                    STUN 查询
   │    ↓                         │                         ↓
   │    获取公网地址               │                  获取公网地址
   │                              │                           │
   │─── Offer + candidates ─────→│─── 转发给 B ─────────────→│
   │                              │                           │
   │                              │←── Answer + candidates ───│
   │←── 转发给 A ────────────────│                           │
   │                              │                           │
   │←────────── ICE 连通性检查（候选对排序尝试）──────────────→│
   │                              │                           │
   │←────────── DTLS 握手（密钥交换）────────────────────────→│
   │                              │                           │
   │←────────── SRTP 加密媒体流 ─────────────────────────────→│
   │                              │                           │
```

## 常见误区

### 误区一：WebRTC 是点对点的，不需要服务器

WebRTC 的**媒体传输**可以走点对点，但**连接建立**绝对需要服务器：
- 信令服务器：交换 SDP 和 ICE 候选
- STUN 服务器：获取公网地址
- TURN 服务器：NAT 穿透失败时的中继

没有任何服务器参与的 WebRTC 连接，只能在同一个局域网内工作。

### 误区二：STUN 服务器可以解决所有 NAT 问题

STUN 只能处理锥形 NAT（Cone NAT）。对于对称 NAT（Symmetric NAT），STUN 获取的端口无法复用，必须使用 TURN 中继。实际网络环境中，约 10-15% 的用户处于对称 NAT 后面。

### 误区三：SDP 是 WebRTC 的协议

SDP 只是会话描述格式，不是协议。WebRTC 不规定信令协议——你可以用 WebSocket、HTTP、甚至手动复制粘贴 SDP（就像早期的 demo 做的那样）。SDP 的内容描述了编解码器、网络地址、传输参数，但如何传递它由开发者决定。

### 误区四：WebRTC 的安全性依赖于应用层

WebRTC 强制使用 DTLS/SRTP 加密，不支持明文传输。即使开发者什么都不配置，数据也是加密的。安全性是内置的，不是可选的。

## 工程建议

1. **生产环境必须部署 TURN 服务器**。STUN 穿透成功率约 85%，剩余 15% 的用户会连接失败。coturn 是成熟方案，按需付费的 TURN 服务（如 Twilio、Xirsys）也是好选择。

2. **ICE 候选收集需要时间**。在 setLocalDescription 之后到 onicecandidate 回调结束，可能需要数百毫秒到数秒。不要在收集完成前就判断连接失败。

3. **SDP 协商要处理不支持的编解码器**。两端可能支持不同的编解码器集合，SDP 协商会自动处理。但如果你想优先使用某个编解码器，需要在 SDP 中修改 m= 行的顺序或使用 `setCodecPreferences`。

4. **信令通道要安全**。DTLS 指纹通过信令交换，信令被劫持就意味着中间人攻击可能成功。信令服务器必须使用 WSS（WebSocket Secure）。

5. **监控 ICE 连接状态**。`RTCPeerConnection` 提供多个状态事件：

```javascript
pc.oniceconnectionstatechange = () => {
  switch (pc.iceConnectionState) {
    case 'checking':
      console.log('正在检查候选对...');
      break;
    case 'connected':
      console.log('ICE 连接已建立');
      break;
    case 'disconnected':
      console.log('ICE 连接断开，可能恢复');
      break;
    case 'failed':
      console.log('ICE 连接失败，需要重启 ICE');
      pc.restartIce();
      break;
  }
};
```

## 小结

WebRTC 连接建立涉及多个组件的协作：

- **信令平面**：通过 WebSocket 等通道交换 SDP 和 ICE 候选
- **ICE 框架**：收集候选地址（Host/srflx/relay），进行连通性检查，找到可用路径
- **STUN/TURN**：解决 NAT 穿透，STUN 获取公网地址，TURN 提供中继保底
- **DTLS/SRTP**：强制加密，DTLS 交换密钥，SRTP 加密媒体流

理解这些组件的职责和交互顺序，是掌握 WebRTC 开发的基础。接下来的课程中，我们将基于这些概念，实现具体的通信功能。

## 练习

### 练习一：实现 SDP 交换

假设你有一个 WebSocket 信令服务器，请编写完整的 SDP offer/answer 交换代码，包括：
1. 创建 PeerConnection
2. 获取本地媒体
3. 创建并发送 Offer
4. 接收并处理 Answer
5. 处理 ICE 候选交换

### 练习二：STUN 服务器测试

编写一个函数，使用 WebRTC 的 STUN 能力检测当前浏览器的 NAT 类型：
1. 收集所有 ICE 候选
2. 分析候选类型（host/srflx/relay）
3. 根据候选组合判断 NAT 类型

---

## 参考答案

### 练习一

**思路**：使用两个 PeerConnection 模拟 A 和 B，通过一个共享对象模拟信令服务器。关键是理解 offer/answer 的时序和 ICE 候选的异步收集。

**答案**：

```javascript
// 信令模拟器（实际项目中替换为 WebSocket）
class SignalingChannel {
  constructor() {
    this.handlers = {};
  }
  on(type, handler) {
    this.handlers[type] = handler;
  }
  send(message) {
    // 模拟异步传输
    setTimeout(() => {
      if (this.peerHandler) {
        this.peerHandler(message);
      }
    }, 50);
  }
  connect(other) {
    this.peerHandler = (msg) => other.handlers[msg.type]?.(msg);
    other.peerHandler = (msg) => this.handlers[msg.type]?.(msg);
  }
}

// ICE 服务器配置
const config = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

async function setupCall() {
  // 创建信令通道
  const signalA = new SignalingChannel();
  const signalB = new SignalingChannel();
  signalA.connect(signalB);

  // 创建 PeerConnection
  const pcA = new RTCPeerConnection(config);
  const pcB = new RTCPeerConnection(config);

  // 获取 A 的本地媒体
  const streamA = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  streamA.getTracks().forEach(track => pcA.addTrack(track, streamA));

  // ICE 候选交换
  pcA.onicecandidate = (e) => {
    if (e.candidate) {
      signalA.send({ type: 'candidate', candidate: e.candidate.toJSON() });
    }
  };
  pcB.onicecandidate = (e) => {
    if (e.candidate) {
      signalB.send({ type: 'candidate', candidate: e.candidate.toJSON() });
    }
  };

  signalB.on('candidate', async (msg) => {
    await pcA.addIceCandidate(new RTCIceCandidate(msg.candidate));
  });
  signalA.on('candidate', async (msg) => {
    await pcB.addIceCandidate(new RTCIceCandidate(msg.candidate));
  });

  // 创建 Offer
  const offer = await pcA.createOffer();
  await pcA.setLocalDescription(offer);

  // 发送 Offer 给 B
  signalA.send({ type: 'offer', sdp: offer.sdp });

  // B 收到 Offer
  signalB.on('offer', async (msg) => {
    await pcB.setRemoteDescription({ type: 'offer', sdp: msg.sdp });

    // 获取 B 的本地媒体
    const streamB = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    streamB.getTracks().forEach(track => pcB.addTrack(track, streamB));

    // 创建 Answer
    const answer = await pcB.createAnswer();
    await pcB.setLocalDescription(answer);

    // 发送 Answer 给 A
    signalB.send({ type: 'answer', sdp: answer.sdp });
  });

  // A 收到 Answer
  signalA.on('answer', async (msg) => {
    await pcA.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
    console.log('信令交换完成，等待 ICE 连通性检查...');
  });

  // 监听连接建立
  pcA.onconnectionstatechange = () => {
    console.log('A 连接状态:', pcA.connectionState);
  };
  pcB.onconnectionstatechange = () => {
    console.log('B 连接状态:', pcB.connectionState);
  };
}

setupCall().catch(console.error);
```

**要点**：
- `setLocalDescription` 会触发 ICE 候选收集
- ICE 候选通过 `onicecandidate` 异步产生，必须在信令中转发
- Offer/Answer 和 ICE 候选是独立传输的，顺序不重要
- 实际项目中用 WebSocket 替代模拟信令

### 练习二

**思路**：利用 STUN 收集 srflx 候选，通过分析候选类型的组合来判断 NAT 类型。如果只有 host 候选说明没有 NAT，有 host + srflx 说明是锥形 NAT，只有 srflx 且和 host 不同网段可能是对称 NAT。

**答案**：

```javascript
async function detectNATType() {
  return new Promise((resolve) => {
    const candidates = [];
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);

    // 创建数据通道触发 ICE 收集
    pc.createDataChannel('nat-detect');

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        candidates.push(event.candidate);
      } else {
        // ICE 收集完成
        analyzeCandidates(candidates);
      }
    };

    // 设置超时保护
    setTimeout(() => {
      analyzeCandidates(candidates);
    }, 5000);

    function analyzeCandidates(cands) {
      const types = {
        host: cands.filter(c => c.type === 'host'),
        srflx: cands.filter(c => c.type === 'srflx'),
        relay: cands.filter(c => c.type === 'relay')
      };

      let natType;
      if (types.host.length > 0 && types.srflx.length === 0) {
        natType = 'NO_NAT';
      } else if (types.host.length > 0 && types.srflx.length > 0) {
        natType = 'CONE_NAT';
      } else if (types.srflx.length > 1) {
        const uniquePorts = new Set(types.srflx.map(c => c.port));
        natType = uniquePorts.size > 1 ? 'SYMMETRIC_NAT' : 'CONE_NAT';
      } else {
        natType = 'UNKNOWN';
      }

      pc.close();
      resolve({
        type: natType,
        candidates: {
          host: types.host.length,
          srflx: types.srflx.length,
          relay: types.relay.length
        },
        details: types
      });
    }

    // 启动 ICE 收集
    pc.createOffer().then(offer => pc.setLocalDescription(offer));
  });
}

// 使用
detectNATType().then(result => {
  console.log('NAT 类型:', result.type);
  console.log('候选统计:', result.candidates);
});
```

**要点**：
- NAT 类型检测需要多个 STUN 服务器提高准确性
- 对称 NAT 的判断依赖于端口差异，单一 STUN 服务器不够可靠
- 生产环境建议直接部署 TURN，而不是过度依赖 NAT 类型检测
