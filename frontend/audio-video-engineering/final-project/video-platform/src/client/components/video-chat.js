/**
 * WebRTC 视频通话组件
 *
 * 实现点对点视频通话，包含：
 * - WebSocket 信令连接
 * - SDP offer/answer 交换
 * - ICE 候选收集与转发
 * - 实时文字聊天（DataChannel）
 * - 屏幕共享
 *
 * WebRTC 通信流程：
 * 1. 双方通过信令服务器（WebSocket）交换房间信息
 * 2. 发起方创建 RTCPeerConnection，生成 SDP offer
 * 3. 通过信令服务器转发 offer/answer 和 ICE 候选
 * 4. ICE 候选收集完成后，P2P 连接建立
 * 5. 音视频数据直接在对等端之间传输
 */
export class VideoChat {
  constructor(container) {
    this.container = container;
    this.ws = null;
    this.peerConnection = null;
    this.dataChannel = null;
    this.localStream = null;
    this.peerId = null;
    this.roomId = null;
    this.isConnected = false;

    this.render();
    this.bindEvents();
  }

  /**
   * 渲染 UI
   */
  render() {
    this.container.innerHTML = `
      <div class="card">
        <!-- 连接控制 -->
        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center;">
          <input id="room-id-input" type="text" placeholder="输入房间号"
            style="background: #222; border: 1px solid #444; color: #fff; padding: 10px 16px;
            border-radius: 6px; font-size: 14px; flex: 1; min-width: 200px;">
          <input id="peer-name-input" type="text" placeholder="您的昵称（可选）"
            style="background: #222; border: 1px solid #444; color: #fff; padding: 10px 16px;
            border-radius: 6px; font-size: 14px; width: 180px;">
          <button id="btn-join-room"
            style="background: #ff4757; border: none; color: #fff; padding: 10px 24px;
            border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;">
            加入房间
          </button>
          <button id="btn-leave-room" disabled
            style="background: #333; border: none; color: #888; padding: 10px 24px;
            border-radius: 6px; cursor: pointer; font-size: 14px;">
            离开房间
          </button>
        </div>

        <p id="connection-status" style="color: #888; margin-bottom: 16px; font-size: 14px;">
          未连接
        </p>

        <!-- 视频区域 -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <p style="font-size: 13px; color: #888; margin-bottom: 4px;">本地视频</p>
            <video id="local-video" autoplay muted playsinline
              style="width: 100%; background: #111; border-radius: 8px; aspect-ratio: 16/9;"></video>
          </div>
          <div>
            <p style="font-size: 13px; color: #888; margin-bottom: 4px;">远程视频</p>
            <video id="remote-video" autoplay playsinline
              style="width: 100%; background: #111; border-radius: 8px; aspect-ratio: 16/9;"></video>
          </div>
        </div>

        <!-- 通话控制 -->
        <div style="display: flex; gap: 12px; margin-top: 16px; justify-content: center;">
          <button id="btn-toggle-video" disabled
            style="background: #222; border: 1px solid #444; color: #ccc; padding: 10px 20px;
            border-radius: 8px; cursor: pointer; font-size: 14px;">
            📹 关闭摄像头
          </button>
          <button id="btn-toggle-audio" disabled
            style="background: #222; border: 1px solid #444; color: #ccc; padding: 10px 20px;
            border-radius: 8px; cursor: pointer; font-size: 14px;">
            🎤 静音
          </button>
          <button id="btn-share-screen" disabled
            style="background: #222; border: 1px solid #444; color: #ccc; padding: 10px 20px;
            border-radius: 8px; cursor: pointer; font-size: 14px;">
            🖥 屏幕共享
          </button>
        </div>
      </div>

      <!-- 实时聊天 -->
      <div class="card" style="margin-top: 16px;">
        <h3>实时聊天</h3>
        <p style="color: #888; margin-bottom: 12px; font-size: 13px;">
          通过 WebRTC DataChannel 实现的点对点文字消息，不经过服务器
        </p>
        <div id="chat-messages" style="height: 200px; overflow-y: auto; background: #111;
          border-radius: 8px; padding: 12px; margin-bottom: 12px; border: 1px solid #333;">
          <p style="color: #666; font-size: 13px; text-align: center;">加入房间后开始聊天</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <input id="chat-input" type="text" placeholder="输入消息..." disabled
            style="flex: 1; background: #222; border: 1px solid #444; color: #fff; padding: 10px 16px;
            border-radius: 6px; font-size: 14px;">
          <button id="btn-send-chat" disabled
            style="background: #ff4757; border: none; color: #fff; padding: 10px 20px;
            border-radius: 6px; cursor: pointer; font-size: 14px;">
            发送
          </button>
        </div>
      </div>

      <!-- 技术说明 -->
      <div class="card" style="margin-top: 16px;">
        <h3>WebRTC 通信流程</h3>
        <div style="color: #ccc; line-height: 1.8; font-size: 14px; margin-top: 8px;">
          <p>1. 双方通过 WebSocket 信令服务器加入同一房间</p>
          <p>2. 发起方创建 RTCPeerConnection，生成 SDP Offer</p>
          <p>3. 信令服务器转发 Offer/Answer 和 ICE 候选</p>
          <p>4. ICE 协商完成后，建立 P2P 直连</p>
          <p>5. 音视频数据直接在两端传输，无需经过服务器</p>
        </div>
      </div>
    `;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    this.container.querySelector('#btn-join-room').addEventListener('click', () => this.joinRoom());
    this.container.querySelector('#btn-leave-room').addEventListener('click', () => this.leaveRoom());
    this.container.querySelector('#btn-toggle-video').addEventListener('click', () => this.toggleVideo());
    this.container.querySelector('#btn-toggle-audio').addEventListener('click', () => this.toggleAudio());
    this.container.querySelector('#btn-share-screen').addEventListener('click', () => this.shareScreen());
    this.container.querySelector('#btn-send-chat').addEventListener('click', () => this.sendChatMessage());

    this.container.querySelector('#chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendChatMessage();
    });
  }

  /**
   * 加入房间
   */
  async joinRoom() {
    const roomIdInput = this.container.querySelector('#room-id-input');
    const nameInput = this.container.querySelector('#peer-name-input');

    this.roomId = roomIdInput.value.trim();
    if (!this.roomId) {
      this.updateStatus('请输入房间号', '#ff4757');
      return;
    }

    try {
      // 获取本地媒体流
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      this.container.querySelector('#local-video').srcObject = this.localStream;

      // 连接 WebSocket 信令服务器
      this.connectSignaling(nameInput.value.trim() || undefined);

      // 更新 UI
      this.updateButtonStates(true);
      this.updateStatus('正在连接...', '#ffa502');

    } catch (err) {
      this.updateStatus(`无法访问摄像头/麦克风: ${err.message}`, '#ff4757');
    }
  }

  /**
   * 连接信令服务器
   */
  connectSignaling(name) {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${protocol}://${location.host}/ws/signal`);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        type: 'join',
        roomId: this.roomId,
        name
      }));
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleSignalingMessage(msg);
    };

    this.ws.onclose = () => {
      this.updateStatus('信令连接断开', '#ff4757');
    };

    this.ws.onerror = () => {
      this.updateStatus('信令连接失败', '#ff4757');
    };
  }

  /**
   * 处理信令消息
   */
  async handleSignalingMessage(msg) {
    switch (msg.type) {
      case 'joined':
        this.peerId = msg.peerId;
        this.updateStatus(`已加入房间 ${this.roomId}（等待其他参与者）`, '#2ed573');
        this.addChatMessage('系统', `您已加入房间 ${this.roomId}`, '#888');

        // 如果已有其他对等端，主动发起连接
        if (msg.peers && msg.peers.length > 0) {
          this.createPeerConnection();
          await this.createOffer();
        }
        break;

      case 'peer-join':
        this.addChatMessage('系统', `${msg.peerId} 加入了房间`, '#2ed573');
        // 新成员加入，主动发起连接
        this.createPeerConnection();
        await this.createOffer();
        break;

      case 'offer':
        this.createPeerConnection();
        await this.handleOffer(msg);
        break;

      case 'answer':
        await this.handleAnswer(msg);
        break;

      case 'ice-candidate':
        await this.handleIceCandidate(msg);
        break;

      case 'peer-leave':
        this.addChatMessage('系统', `${msg.peerId} 离开了房间`, '#ff4757');
        this.closePeerConnection();
        break;

      case 'chat':
        this.addChatMessage(msg.fromPeer, msg.message, '#ccc');
        break;

      case 'error':
        this.updateStatus(`错误: ${msg.message}`, '#ff4757');
        break;
    }
  }

  /**
   * 创建 RTCPeerConnection
   */
  createPeerConnection() {
    if (this.peerConnection) {
      this.closePeerConnection();
    }

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(config);

    // 添加本地轨道
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // ICE 候选收集
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.ws.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          targetPeer: this.targetPeer
        }));
      }
    };

    // 接收远程流
    this.peerConnection.ontrack = (event) => {
      const remoteVideo = this.container.querySelector('#remote-video');
      if (event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    // 连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      if (state === 'connected') {
        this.isConnected = true;
        this.updateStatus('已建立 P2P 连接', '#2ed573');
      } else if (state === 'disconnected' || state === 'failed') {
        this.isConnected = false;
        this.updateStatus('P2P 连接断开', '#ff4757');
      }
    };

    // 创建 DataChannel（用于文字聊天）
    this.dataChannel = this.peerConnection.createDataChannel('chat', {
      ordered: true
    });

    this.dataChannel.onopen = () => {
      this.container.querySelector('#chat-input').disabled = false;
      this.container.querySelector('#btn-send-chat').disabled = false;
    };

    this.dataChannel.onmessage = (event) => {
      this.addChatMessage('对方', event.data, '#ccc');
    };

    this.dataChannel.onclose = () => {
      this.container.querySelector('#chat-input').disabled = true;
      this.container.querySelector('#btn-send-chat').disabled = true;
    };

    // 接收远程 DataChannel
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onmessage = (e) => {
        this.addChatMessage('对方', e.data, '#ccc');
      };
    };
  }

  /**
   * 创建 SDP Offer
   */
  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.ws.send(JSON.stringify({
        type: 'offer',
        sdp: offer.sdp,
        targetPeer: this.targetPeer
      }));
    } catch (err) {
      console.error('创建 Offer 失败:', err);
    }
  }

  /**
   * 处理 SDP Offer
   */
  async handleOffer(msg) {
    try {
      this.targetPeer = msg.fromPeer;
      await this.peerConnection.setRemoteDescription({
        type: 'offer',
        sdp: msg.sdp
      });

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.ws.send(JSON.stringify({
        type: 'answer',
        sdp: answer.sdp,
        targetPeer: msg.fromPeer
      }));
    } catch (err) {
      console.error('处理 Offer 失败:', err);
    }
  }

  /**
   * 处理 SDP Answer
   */
  async handleAnswer(msg) {
    try {
      await this.peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: msg.sdp
      });
    } catch (err) {
      console.error('处理 Answer 失败:', err);
    }
  }

  /**
   * 处理 ICE 候选
   */
  async handleIceCandidate(msg) {
    try {
      await this.peerConnection.addIceCandidate(msg.candidate);
    } catch (err) {
      console.error('添加 ICE 候选失败:', err);
    }
  }

  /**
   * 发送聊天消息
   */
  sendChatMessage() {
    const input = this.container.querySelector('#chat-input');
    const message = input.value.trim();

    if (!message || !this.dataChannel || this.dataChannel.readyState !== 'open') return;

    this.dataChannel.send(message);
    this.addChatMessage('我', message, '#2ed573');
    input.value = '';
  }

  /**
   * 添加聊天消息到界面
   */
  addChatMessage(sender, message, color) {
    const chatMessages = this.container.querySelector('#chat-messages');
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom: 8px; font-size: 13px;';
    div.innerHTML = `<span style="color: ${color}; font-weight: 600;">${sender}：</span>${message}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * 切换摄像头
   */
  toggleVideo() {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const btn = this.container.querySelector('#btn-toggle-video');
      btn.textContent = videoTrack.enabled ? '📹 关闭摄像头' : '📹 开启摄像头';
    }
  }

  /**
   * 切换麦克风
   */
  toggleAudio() {
    if (!this.localStream) return;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const btn = this.container.querySelector('#btn-toggle-audio');
      btn.textContent = audioTrack.enabled ? '🎤 静音' : '🎤 取消静音';
    }
  }

  /**
   * 屏幕共享
   */
  async shareScreen() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      // 替换视频轨道
      const sender = this.peerConnection.getSenders().find(s =>
        s.track && s.track.kind === 'video'
      );

      if (sender) {
        await sender.replaceTrack(screenTrack);
      }

      this.container.querySelector('#local-video').srcObject = screenStream;

      // 停止共享时恢复摄像头
      screenTrack.onended = async () => {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
        this.container.querySelector('#local-video').srcObject = this.localStream;
      };

    } catch (err) {
      console.warn('屏幕共享取消或失败:', err.message);
    }
  }

  /**
   * 离开房间
   */
  leaveRoom() {
    this.closePeerConnection();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.ws) {
      this.ws.send(JSON.stringify({ type: 'leave' }));
      this.ws.close();
      this.ws = null;
    }

    this.container.querySelector('#local-video').srcObject = null;
    this.container.querySelector('#remote-video').srcObject = null;

    this.updateButtonStates(false);
    this.updateStatus('未连接', '#888');
  }

  /**
   * 关闭 P2P 连接
   */
  closePeerConnection() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isConnected = false;
  }

  /**
   * 更新状态文本
   */
  updateStatus(text, color) {
    const el = this.container.querySelector('#connection-status');
    el.textContent = text;
    el.style.color = color;
  }

  /**
   * 更新按钮状态
   */
  updateButtonStates(inRoom) {
    this.container.querySelector('#btn-join-room').disabled = inRoom;
    this.container.querySelector('#btn-leave-room').disabled = !inRoom;
    this.container.querySelector('#btn-toggle-video').disabled = !inRoom;
    this.container.querySelector('#btn-toggle-audio').disabled = !inRoom;
    this.container.querySelector('#btn-share-screen').disabled = !inRoom;

    this.container.querySelector('#room-id-input').disabled = inRoom;
    this.container.querySelector('#peer-name-input').disabled = inRoom;
  }
}
