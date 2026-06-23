# WebRTC 核心概念：浏览器之间怎么直接传音视频

## 现象

你用 Zoom 开视频会议，视频几乎没有延迟。但如果你自己用 WebSocket 传视频帧，延迟高得离谱而且卡顿严重。

WebRTC 就是为实时音视频设计的浏览器 API。它不是"用 HTTP 传视频"——它用了一套完全不同的网络协议栈。

## WebRTC 的三个核心问题

```
1. 如何建立连接？→ 信令（Signaling）
2. 如何穿透 NAT？→ ICE / STUN / TURN
3. 如何保证质量？→ 拥塞控制 + 自适应码率
```

## 信令：交换连接信息

WebRTC 的 P2P 连接需要交换两种信息：

```
SDP（Session Description Protocol）
  描述媒体能力：支持什么编码、什么分辨率、什么帧率
  由 offer 方创建，answer 方回复

ICE Candidate（网络候选地址）
  描述可达的网络地址：本地 IP、公网 IP、TURN 中继地址
  双方互相交换
```

```typescript
// 创建 offer
const pc = new RTCPeerConnection()
const offer = await pc.createOffer()
await pc.setLocalDescription(offer)

// 通过信令服务器发送给对方
signaling.send({ type: 'offer', sdp: offer.sdp })

// 对方收到后创建 answer
await pc.setRemoteDescription(offer)
const answer = await pc.createAnswer()
await pc.setLocalDescription(answer)
signaling.send({ type: 'answer', sdp: answer.sdp })
```

信令服务器（WebSocket）只在连接建立阶段使用。连接建立后，音视频数据直接 P2P 传输。

## ICE / STUN / TURN

NAT 穿透是 WebRTC 最难的部分：

```
ICE（Interactive Connectivity Establishment）
  框架，尝试所有可能的连接方式

STUN（Session Traversal Utilities for NAT）
  帮你发现公网 IP 和端口
  大多数情况下够用
  免费，Google 有公共 STUN 服务器

TURN（Traversal Using Relays around NAT）
  当 P2P 失败时做中继
  所有数据经过 TURN 服务器转发
  带宽成本高，但保证连接成功
```

```typescript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
})

// ICE 候选收集
pc.onicecandidate = (e) => {
  if (e.candidate) {
    signaling.send({ type: 'candidate', candidate: e.candidate })
  }
}
```

## 添加媒体流

```typescript
// 获取摄像头和麦克风
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: 1280, height: 720, frameRate: 30 },
  audio: { echoCancellation: true, noiseSuppression: true }
})

// 添加到连接
stream.getTracks().forEach(track => {
  pc.addTrack(track, stream)
})

// 远程流
pc.ontrack = (e) => {
  remoteVideo.srcObject = e.streams[0]
}
```

## 数据通道

除了音视频，WebRTC 还可以传任意数据：

```typescript
// 创建数据通道
const channel = pc.createDataChannel('chat', {
  ordered: true // 保证顺序
})

channel.onopen = () => console.log('数据通道已打开')
channel.onmessage = (e) => console.log('收到消息:', e.data)

channel.send('Hello WebRTC!')

// 对端接收
pc.ondatachannel = (e) => {
  e.channel.onmessage = (msg) => console.log(msg.data)
}
```

## 连接状态监控

```typescript
pc.onconnectionstatechange = () => {
  console.log('连接状态:', pc.connectionState)
  // new → connecting → connected → disconnected → failed → closed
}

pc.oniceconnectionstatechange = () => {
  console.log('ICE 状态:', pc.iceConnectionState)
}

pc.onicegatheringstatechange = () => {
  console.log('ICE 收集状态:', pc.iceGatheringState)
}
```

## 你可能踩的坑

**坑一：信令服务器不是 WebRTC 的一部分**

WebRTC 标准不包含信令。你需要自己搭建 WebSocket 服务器来交换 SDP 和 ICE 候选。

**坑二：只用 STUN 在企业网络中失败**

企业防火墙通常阻止 UDP。必须有 TURN 服务器做 TCP 中继。

**坑三：addTrack 的顺序很重要**

`addTrack` 的顺序决定了 SSRC 映射。如果 offer 和 answer 的 track 顺序不一致，会导致音视频对调。

## 练习

### 练习一：本地回环测试

不使用信令服务器，创建两个 RTCPeerConnection 对象，在同一页面内完成 offer/answer 交换，实现本地视频回环。

### 练习二：连接质量监控

在 WebRTC 连接建立后，每秒调用 `pc.getStats()` 获取音频和视频的丢包率、抖动、码率，显示在面板上。

---

## 参考答案

### 练习一

```typescript
async function localLoopback() {
  const pc1 = new RTCPeerConnection()
  const pc2 = new RTCPeerConnection()

  const stream = await navigator.mediaDevices.getUserMedia({ video: true })
  stream.getTracks().forEach(t => pc1.addTrack(t, stream))

  pc2.ontrack = (e) => {
    document.getElementById('remote')!.srcObject = e.streams[0]
  }

  // 本地交换
  const offer = await pc1.createOffer()
  await pc1.setLocalDescription(offer)
  await pc2.setRemoteDescription(offer)

  const answer = await pc2.createAnswer()
  await pc2.setLocalDescription(answer)
  await pc1.setRemoteDescription(answer)

  // 交换 ICE 候选
  pc1.onicecandidate = (e) => e.candidate && pc2.addIceCandidate(e.candidate)
  pc2.onicecandidate = (e) => e.candidate && pc1.addIceCandidate(e.candidate)
}
```

### 练习二

```typescript
async function monitorQuality(pc) {
  setInterval(async () => {
    const stats = await pc.getStats()
    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        console.log({
          packetsLost: report.packetsLost,
          jitter: report.jitter,
          bytesReceived: report.bytesReceived,
          frameRate: report.framesPerSecond
        })
      }
    })
  }, 1000)
}
```
