# 阶段实战：数字人直播系统MVP

经过25课，你掌握了3D渲染、大模型对话、语音合成、弹幕互动、性能优化。现在把它们组装成完整产品。

目标：虚拟主播在直播间实时与观众互动——观众发弹幕，数字人用LLM生成回答，TTS说出回答，3D口型同步，RTMP推流到直播平台。

## 系统架构

```
弹幕网关(WS) → 对话引擎(LLM) → TTS服务(CosyVoice)
                                    ↓
直播平台(B站/抖音) ← FFmpeg推流(RTMP) ← 渲染画布(Canvas) ← Three.js渲染引擎
                                    ↑
                              口型同步(BlendShape)
```

数据流：弹幕→过滤→LLM生成→TTS合成→音素时间戳→BlendShape权重→Three.js渲染→FFmpeg推流。

## 口型同步

TTS输出音素序列，每个音素映射到BlendShape权重，持续50-150ms平滑过渡：

```
音素 [n] [i] [u] [d] [a]
      ↓   ↓   ↓   ↓   ↓
mouth_narrow:0.6 | mouth_smile:0.4 | mouth_funnel:0.8 | mouth_open:0.3 | mouth_wide:0.7
      ↓
mesh.morphTargetInfluences[index] = weight
```

## 数字人渲染引擎

```typescript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const VISEME_MAP: Record<string, { blendShape: string; weight: number }> = {
  sil: { blendShape: 'mouthClose', weight: 0.0 },
  PP:  { blendShape: 'mouthPucker', weight: 0.8 },
  aa:  { blendShape: 'mouthWide', weight: 0.8 },
  oh:  { blendShape: 'mouthRound', weight: 0.7 },
  ih:  { blendShape: 'mouthSmile', weight: 0.4 },
};

interface VisemeKeyframe { timeMs: number; viseme: string; weight: number; }

class DigitalHumanRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private model: THREE.Group | null = null;
  private morphTargets = new Map<string, number>();
  private visemeQueue: VisemeKeyframe[] = [];
  private isPlaying = false;
  private startTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 0.1, 1000);
    this.camera.position.set(0, 1.4, 2.5); this.camera.lookAt(0, 1.2, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(1, 2, 3);
    this.scene.add(dir);
  }

  async loadModel(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(url, (gltf) => {
        this.model = gltf.scene; this.scene.add(this.model);
        this.model.traverse((child: any) => {
          if (child.morphTargetDictionary) {
            Object.entries(child.morphTargetDictionary).forEach(([name, idx]) => {
              this.morphTargets.set(name, idx as number);
            });
          }
        });
        resolve();
      }, undefined, reject);
    });
  }

  playViseme(keyframes: VisemeKeyframe[]) {
    this.visemeQueue = [...keyframes]; this.isPlaying = true; this.startTime = performance.now();
  }

  private updateViseme() {
    if (!this.isPlaying || !this.model) return;
    const elapsed = performance.now() - this.startTime;
    let current: VisemeKeyframe | null = null;
    for (const kf of this.visemeQueue) { if (kf.timeMs <= elapsed) current = kf; }
    if (!current) return;
    const mapping = VISEME_MAP[current.viseme];
    if (mapping && this.morphTargets.has(mapping.blendShape)) {
      const idx = this.morphTargets.get(mapping.blendShape)!;
      this.model.traverse((child: any) => {
        if (child.morphTargetInfluences) child.morphTargetInfluences[idx] = current!.weight;
      });
    }
    const last = this.visemeQueue[this.visemeQueue.length - 1];
    if (elapsed > last.timeMs + 200) {
      this.isPlaying = false;
      this.model.traverse((child: any) => {
        if (child.morphTargetInfluences) {
          for (let i = 0; i < child.morphTargetInfluences.length; i++) child.morphTargetInfluences[i] *= 0.9;
        }
      });
    }
  }

  render() {
    this.updateViseme();
    this.renderer.render(this.scene, this.camera);
  }

  startLoop() { const animate = () => { requestAnimationFrame(animate); this.render(); }; animate(); }
}
```

## 对话引擎

```python
"""弹幕过滤 → 意图分类 → LLM生成 → 人设一致性"""
import asyncio, re, time, random
from dataclasses import dataclass
from enum import Enum

class IntentType(Enum):
    QUESTION = "question"; GREETING = "greeting"; CHITCHAT = "chitchat"; AD = "ad"

@dataclass
class DanmakuMessage:
    user_id: str; username: str; content: str; timestamp: float

class DanmakuFilter:
    AD_PATTERNS = [r"加微信", r"http[s]?://", r"\.com"]
    def filter(self, msg: DanmakuMessage):
        content = msg.content.strip()
        if len(content) < 2: return None
        for p in self.AD_PATTERNS:
            if re.search(p, content, re.IGNORECASE): return None
        intent = self._classify(content)
        return {"msg": msg, "intent": intent, "priority": {"question": 5, "greeting": 3}.get(intent, 1)}
    def _classify(self, content):
        if any(m in content for m in ["吗", "？", "?", "怎么"]): return IntentType.QUESTION
        if any(m in content.lower() for m in ["你好", "hi"]): return IntentType.GREETING
        return IntentType.CHITCHAT

class StreamDialogueEngine:
    def __init__(self, persona_name, system_prompt, greeting_templates, catchphrases):
        self.persona = persona_name; self.system_prompt = system_prompt
        self.greeting_templates = greeting_templates; self.catchphrases = catchphrases
        self.filter = DanmakuFilter(); self.history = []
        self.queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.reply_interval = 5.0; self.last_reply_time = 0.0
        self.recent: dict[str, float] = {}

    async def receive(self, msg: DanmakuMessage):
        processed = self.filter.filter(msg)
        if not processed: return
        key = processed["msg"].content.lower().strip()
        now = time.time()
        if key in self.recent and now - self.recent[key] < 30: return
        self.recent[key] = now
        await self.queue.put((-processed["priority"], now, processed))

    async def reply_loop(self):
        while True:
            try: _, _, processed = await asyncio.wait_for(self.queue.get(), timeout=1.0)
            except asyncio.TimeoutError: continue
            if time.time() - self.last_reply_time < self.reply_interval: continue
            reply = self._generate(processed)
            if reply: self.last_reply_time = time.time(); yield reply

    def _generate(self, processed):
        msg = processed["msg"]; intent = processed["intent"]
        if intent == IntentType.GREETING:
            return random.choice(self.greeting_templates).format(username=msg.username)
        # 模拟LLM（实际调用API）
        return f"关于「{msg.content[:20]}」，{random.choice(self.catchphrases)}"
```

## RTMP推流

```python
"""Canvas帧捕获 → FFmpeg编码 → 推流到直播平台"""
import subprocess, time
from dataclasses import dataclass

@dataclass
class StreamConfig:
    rtmp_url: str; stream_key: str
    width: int = 1080; height: int = 1920; fps: int = 30
    video_bitrate: str = "2500k"; audio_bitrate: str = "128k"

class RTMPStreamService:
    def __init__(self, config: StreamConfig):
        self.config = config; self.process = None; self.frame_count = 0; self.start_time = 0.0

    def start(self):
        cmd = ["ffmpeg", "-y",
            "-f", "rawvideo", "-vcodec", "rawvideo", "-pix_fmt", "rgba",
            "-s", f"{self.config.width}x{self.config.height}", "-r", str(self.config.fps),
            "-i", "pipe:0",
            "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
            "-b:v", self.config.video_bitrate, "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", self.config.audio_bitrate,
            "-f", "flv", f"{self.config.rtmp_url}/{self.config.stream_key}"]
        self.process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        self.start_time = time.time()

    def send_frame(self, frame_data: bytes):
        if self.process:
            try: self.process.stdin.write(frame_data); self.frame_count += 1
            except BrokenPipeError: pass

    def stats(self):
        elapsed = time.time() - self.start_time if self.start_time else 0
        return {"frames": self.frame_count, "fps": round(self.frame_count / max(elapsed, 1), 1)}
```

## 练习

### 练习一：音素级口型同步

从CosyVoice TTS输出中提取音素时间戳，转为`VisemeKeyframe`数组。支持中英文混合：中文韵母映射到viseme（a→aa, o→oh, e→E），英文用SAMPA音素集。

### 练习二：问答互动游戏

设计`QuizGame`类：主播出题（LLM生成选择题），观众弹幕回答（归一化处理"选B"/"B"），统计答案分布公布结果。同一用户多次回答只保留最后一次。

---

## 参考答案

### 练习一

```typescript
const CN_VOWEL_MAP: Record<string, string> = {
  a: 'aa', o: 'oh', e: 'E', i: 'ih', u: 'ou',
  ai: 'aa', ei: 'E', ao: 'oh', ou: 'oh',
};

function generateVisemeKeyframes(phonemes: { phoneme: string; startMs: number; endMs: number }[]) {
  const kf: VisemeKeyframe[] = [];
  for (const p of phonemes) {
    const viseme = CN_VOWEL_MAP[p.phoneme] || 'sil';
    kf.push({ timeMs: p.startMs, viseme, weight: 0.8 });
    const dur = p.endMs - p.startMs;
    if (dur > 80) kf.push({ timeMs: p.startMs + dur * 0.5, viseme, weight: 0.6 });
    kf.push({ timeMs: p.endMs, viseme: 'sil', weight: 0.0 });
  }
  return kf;
}
```
