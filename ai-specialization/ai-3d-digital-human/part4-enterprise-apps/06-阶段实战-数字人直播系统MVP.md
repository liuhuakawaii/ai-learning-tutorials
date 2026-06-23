# 第26课：阶段实战——数字人直播系统 MVP

## 场景引入

经过前面 25 课的学习，你已经掌握了 3D 数字人渲染、大模型对话、语音合成、弹幕互动、性能优化等所有核心模块。现在是时候把它们组装成一个完整的产品了。

本节课的目标是：**从零构建一个可运行的数字人直播系统 MVP**。一个虚拟主播在直播间里实时与观众互动——观众发送弹幕，数字人看到弹幕后用大模型生成回答，通过语音合成说出回答，3D 数字人的口型与语音同步，整个过程通过 RTMP 推流到直播平台。

这不是 Demo，而是包含完整工程结构的 MVP：Three.js 渲染引擎、LLM 对话引擎、CosyVoice TTS、弹幕 WebSocket 网关、FFmpeg 推流、Docker Compose 部署。

## 学习目标

1. 设计数字人直播系统的完整技术架构
2. 实现 Three.js 数字人渲染引擎（口型同步、表情驱动）
3. 构建 LLM 对话引擎（弹幕过滤、上下文管理、人设一致性）
4. 集成 CosyVoice TTS 和 RTMP 推流
5. 使用 Docker Compose 编排和部署完整系统

## 核心概念

### 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      数字人直播系统架构                           │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ 直播平台  │◄───│  FFmpeg 推流  │◄───│  渲染画布     │          │
│  │ (B站/抖音)│    │  (RTMP)      │    │  (Canvas)    │          │
│  └──────────┘    └──────────────┘    └──────┬───────┘          │
│                                              │                  │
│                                    ┌─────────┴─────────┐        │
│                                    │  Three.js 渲染引擎  │        │
│                                    └─────────┬─────────┘        │
│                                              │                  │
│  ┌──────────┐    ┌──────────────┐    ┌───────┴────────┐        │
│  │ 弹幕网关  │───→│  对话引擎     │───→│  TTS 服务       │        │
│  │ (WS)     │    │  (LLM)       │    │  (CosyVoice)  │        │
│  └──────────┘    └──────────────┘    └────────────────┘        │
│       ▲                                                           │
│  ┌──────────┐    ┌──────────────┐                                │
│  │ 观众弹幕  │───→│  管理后台     │                                │
│  └──────────┘    └──────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

数据流：观众发弹幕 → 弹幕网关 → 对话引擎调用 LLM → TTS 合成语音 → Three.js 渲染口型动画 → FFmpeg 推流到直播平台。

### 口型同步原理

将 TTS 输出的音素序列映射到 3D 模型的 BlendShape 权重：

```
TTS 音素序列: [n] [i] [u] [d] [u] [n]
                │   │   │   │   │   │
                ▼   ▼   ▼   ▼   ▼   ▼
Viseme 映射表:
  ┌──────┬──────────────────────────┐
  │ [n]  │ mouth_narrow: 0.6        │
  │ [i]  │ mouth_smile: 0.4         │
  │ [u]  │ mouth_funnel: 0.8        │
  │ [d]  │ mouth_open: 0.3          │
  │ [a]  │ mouth_wide: 0.7          │
  └──────┴──────────────────────────┘
                │
                ▼
  mesh.morphTargetInfluences[index] = weight
```

CosyVoice 可以输出音素级时间戳（精确到毫秒），每个音素持续 50-150ms，在此期间平滑过渡到对应口型。

### 弹幕互动策略

```
弹幕流入 → 基础过滤(广告/违规) → 意图分类(问题/打招呼/闲聊)
         → 优先级排序(问题>打招呼>闲聊) → 去重合并 → 频率控制(5秒/条)
         → 进入对话引擎
```

## 完整代码示例

### 示例一：数字人渲染引擎（Three.js + 口型同步）

```typescript
/**
 * 数字人直播渲染引擎
 * Three.js + BlendShape 口型同步 + 表情驱动
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface VisemeMapping {
  phoneme: string;
  blendShapeName: string;
  weight: number;
}

const VISEME_MAP: VisemeMapping[] = [
  { phoneme: 'sil', blendShapeName: 'mouthClose', weight: 0.0 },
  { phoneme: 'PP', blendShapeName: 'mouthPucker', weight: 0.8 },
  { phoneme: 'FF', blendShapeName: 'mouthFunnel', weight: 0.6 },
  { phoneme: 'aa', blendShapeName: 'mouthWide', weight: 0.8 },
  { phoneme: 'oh', blendShapeName: 'mouthRound', weight: 0.7 },
  { phoneme: 'ih', blendShapeName: 'mouthSmile', weight: 0.4 },
];

interface VisemeKeyframe {
  timeMs: number;
  viseme: string;
  weight: number;
}

class DigitalHumanRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private model: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private morphTargets: Map<string, number> = new Map();
  private visemeQueue: VisemeKeyframe[] = [];
  private isPlaying = false;
  private startTime = 0;
  private clock = new THREE.Clock();

  constructor(private canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, canvas.width / canvas.height, 0.1, 1000);
    this.camera.position.set(0, 1.4, 2.5);
    this.camera.lookAt(0, 1.2, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 2, 3);
    this.scene.add(dirLight);
  }

  async loadModel(url: string): Promise<void> {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(url, (gltf) => {
        this.model = gltf.scene;
        this.scene.add(this.model);

        this.model.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.morphTargetDictionary) {
            Object.entries(child.morphTargetDictionary).forEach(([name, idx]) => {
              this.morphTargets.set(name, idx as number);
            });
          }
        });

        if (gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);
          this.mixer.clipAction(gltf.animations[0]).play();
        }
        resolve();
      }, undefined, reject);
    });
  }

  playVisemeSequence(keyframes: VisemeKeyframe[]): void {
    this.visemeQueue = [...keyframes];
    this.isPlaying = true;
    this.startTime = performance.now();
  }

  private updateViseme(): void {
    if (!this.isPlaying || !this.model) return;
    const elapsed = performance.now() - this.startTime;

    let current: VisemeKeyframe | null = null;
    for (const kf of this.visemeQueue) {
      if (kf.timeMs <= elapsed) current = kf;
    }
    if (!current) return;

    const mapping = VISEME_MAP.find(v => v.viseme === current!.viseme);
    if (mapping && this.morphTargets.has(mapping.blendShapeName)) {
      const idx = this.morphTargets.get(mapping.blendShapeName)!;
      this.model.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.morphTargetInfluences) {
          child.morphTargetInfluences[idx] = current!.weight;
        }
      });
    }

    const last = this.visemeQueue[this.visemeQueue.length - 1];
    if (elapsed > last.timeMs + 200) {
      this.isPlaying = false;
      this.model.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.morphTargetInfluences) {
          for (let i = 0; i < child.morphTargetInfluences.length; i++) {
            child.morphTargetInfluences[i] *= 0.9;
          }
        }
      });
    }
  }

  render(): void {
    const delta = this.clock.getDelta();
    if (this.mixer) this.mixer.update(delta);
    this.updateViseme();
    this.renderer.render(this.scene, this.camera);
  }

  startRenderLoop(): void {
    const animate = () => { requestAnimationFrame(animate); this.render(); };
    animate();
  }

  getCanvasStream(fps = 30): MediaStream {
    return this.canvas.captureStream(fps);
  }
}

export { DigitalHumanRenderer };
export type { VisemeKeyframe };
```

### 示例二：直播对话引擎（弹幕过滤 + LLM 生成）

```python
"""
数字人直播对话引擎
弹幕过滤 → 意图分类 → LLM 生成 → 人设一致性维护
"""

import asyncio
import re
import time
import random
from dataclasses import dataclass, field
from typing import Optional, AsyncGenerator
from enum import Enum


class IntentType(Enum):
    QUESTION = "question"
    GREETING = "greeting"
    CHITCHAT = "chitchat"
    IRRELEVANT = "irrelevant"
    AD = "ad"


@dataclass
class DanmakuMessage:
    user_id: str
    username: str
    content: str
    timestamp: float


@dataclass
class ProcessedDanmaku:
    original: DanmakuMessage
    intent: IntentType
    priority: int
    filtered_content: str
    should_reply: bool


@dataclass
class StreamerPersona:
    name: str
    system_prompt: str
    greeting_templates: list[str]
    catchphrases: list[str]


class DanmakuFilter:
    AD_PATTERNS = [r"加微信", r"私聊", r"http[s]?://", r"\.com", r"扫码"]

    def filter(self, danmaku: DanmakuMessage) -> ProcessedDanmaku:
        content = danmaku.content.strip()
        if len(content) < 2:
            return ProcessedDanmaku(danmaku, IntentType.IRRELEVANT, 0, "", False)

        for p in self.AD_PATTERNS:
            if re.search(p, content, re.IGNORECASE):
                return ProcessedDanmaku(danmaku, IntentType.AD, 0, "", False)

        intent = self._classify(content)
        priority = {"question": 5, "greeting": 3, "chitchat": 2}.get(intent.value, 1)
        return ProcessedDanmaku(danmaku, intent, priority, content, True)

    def _classify(self, content: str) -> IntentType:
        if any(m in content for m in ["吗", "？", "?", "怎么", "为什么", "什么"]):
            return IntentType.QUESTION
        if any(m in content.lower() for m in ["你好", "嗨", "hi", "hello"]):
            return IntentType.GREETING
        return IntentType.CHITCHAT


class StreamDialogueEngine:
    """直播对话引擎"""

    def __init__(self, persona: StreamerPersona):
        self.persona = persona
        self.filter = DanmakuFilter()
        self.history: list[dict] = [{"role": "system", "content": persona.system_prompt}]
        self.queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.reply_interval = 5.0
        self.last_reply_time = 0.0
        self.is_streaming = False
        self.recent_questions: dict[str, float] = {}

    async def start(self):
        self.is_streaming = True
        asyncio.create_task(self._reply_loop())

    async def stop(self):
        self.is_streaming = False

    async def receive_danmaku(self, danmaku: DanmakuMessage):
        processed = self.filter.filter(danmaku)
        if not processed.should_reply:
            return

        content_key = processed.filtered_content.lower().strip()
        now = time.time()
        if content_key in self.recent_questions and now - self.recent_questions[content_key] < 30:
            return
        self.recent_questions[content_key] = now
        await self.queue.put((-processed.priority, now, processed))

    async def _reply_loop(self):
        while self.is_streaming:
            try:
                priority, ts, processed = await asyncio.wait_for(self.queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            if time.time() - self.last_reply_time < self.reply_interval:
                continue

            reply = await self._generate_reply(processed)
            if reply:
                self.last_reply_time = time.time()
                yield {
                    "danmaku_user": processed.original.username,
                    "danmaku_content": processed.filtered_content,
                    "reply_text": reply,
                    "intent": processed.intent.value,
                }

    async def _generate_reply(self, processed: ProcessedDanmaku) -> Optional[str]:
        if processed.intent == IntentType.GREETING:
            return random.choice(self.persona.greeting_templates).format(
                username=processed.original.username
            )

        self.history.append({"role": "user", "content": processed.filtered_content})
        if len(self.history) > 21:
            self.history = [self.history[0]] + self.history[-20:]

        # 模拟 LLM 流式输出（实际项目中调用 vLLM API）
        reply = f"关于「{processed.filtered_content}」，{random.choice(self.persona.catchphrases)}"
        self.history.append({"role": "assistant", "content": reply})
        return reply


def create_default_persona() -> StreamerPersona:
    return StreamerPersona(
        name="小智",
        system_prompt=(
            "你是一位名叫小智的科技主播，正在做 AI 知识科普直播。"
            "性格友善幽默，回答简洁（2-3句话），保持人设一致性。"
        ),
        greeting_templates=[
            "欢迎 {username} 来到直播间！",
            "{username} 来啦，坐好听课哦！",
        ],
        catchphrases=["这个知识点很实用哦", "大家记一下", "这个面试经常考"],
    )


# 使用示例
async def demo():
    engine = StreamDialogueEngine(create_default_persona())
    await engine.start()

    for dm in [
        DanmakuMessage("u1", "小明", "你好小智！", time.time()),
        DanmakuMessage("u2", "小红", "AI是什么？", time.time()),
        DanmakuMessage("u3", "路人甲", "加微信xxx", time.time()),
    ]:
        print(f"[{dm.username}]: {dm.content}")
        await engine.receive_danmaku(dm)

    await asyncio.sleep(3)
    await engine.stop()

asyncio.run(demo())
```

### 示例三：RTMP 推流与 Docker Compose 部署

```python
"""
RTMP 推流服务
从 Canvas 捕获视频流推送到直播平台
"""

import subprocess
import json
import time
from dataclasses import dataclass
from typing import Optional


@dataclass
class StreamConfig:
    rtmp_url: str
    stream_key: str
    width: int = 1080
    height: int = 1920
    fps: int = 30
    video_bitrate: str = "2500k"
    audio_bitrate: str = "128k"


class RTMPStreamService:
    def __init__(self, config: StreamConfig):
        self.config = config
        self.process: Optional[subprocess.Popen] = None
        self.is_streaming = False
        self.frame_count = 0
        self.start_time = 0.0

    def build_ffmpeg_command(self) -> list[str]:
        output = f"{self.config.rtmp_url}/{self.config.stream_key}"
        return [
            "ffmpeg",
            "-f", "rawvideo", "-vcodec", "rawvideo", "-pix_fmt", "rgba",
            "-s", f"{self.config.width}x{self.config.height}",
            "-r", str(self.config.fps), "-i", "pipe:0",
            "-f", "s16le", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1",
            "-i", "pipe:1",
            "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
            "-b:v", self.config.video_bitrate,
            "-pix_fmt", "yuv420p", "-g", str(self.config.fps * 2),
            "-c:a", "aac", "-b:a", self.config.audio_bitrate,
            "-f", "flv", output,
        ]

    def start(self):
        cmd = self.build_ffmpeg_command()
        self.process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.is_streaming = True
        self.start_time = time.time()

    def send_video_frame(self, frame_data: bytes):
        if self.is_streaming and self.process:
            try:
                self.process.stdin.write(frame_data)
                self.process.stdin.flush()
                self.frame_count += 1
            except BrokenPipeError:
                self.is_streaming = False

    def get_stats(self) -> dict:
        elapsed = time.time() - self.start_time if self.start_time else 0
        return {
            "is_streaming": self.is_streaming,
            "frames": self.frame_count,
            "elapsed": round(elapsed, 1),
            "fps": round(self.frame_count / max(elapsed, 1), 1),
        }

    def stop(self):
        self.is_streaming = False
        if self.process:
            self.process.stdin.close()
            self.process.wait(timeout=5)


config = StreamConfig(
    rtmp_url="rtmp://live-push.bilivideo.com/live-bvc",
    stream_key="your_stream_key_here",
)
service = RTMPStreamService(config)
print("FFmpeg 推流命令:")
print(" \\\n  ".join(service.build_ffmpeg_command()))
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  vllm:
    image: vllm/vllm-openai:latest
    runtime: nvidia
    command: >
      --model Qwen/Qwen2.5-7B-Instruct
      --tensor-parallel-size 1
      --max-model-len 4096
      --gpu-memory-utilization 0.85
      --enable-streaming --port 8000
    ports: ["8000:8000"]
    volumes: [model-cache:/root/.cache/huggingface]
    deploy:
      resources:
        reservations:
          devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]

  cosyvoice:
    build: {context: ./services/cosyvoice, dockerfile: Dockerfile}
    ports: ["8001:8001"]
    environment:
      - MODEL_PATH=/models/CosyVoice2-0.5B
      - DEVICE=cuda
    volumes: [cosyvoice-models:/models]
    deploy:
      resources:
        reservations:
          devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]

  danmaku-gateway:
    build: {context: ./services/danmaku-gateway, dockerfile: Dockerfile}
    ports: ["8002:8002"]
    environment:
      - REDIS_URL=redis://redis:6379
      - LLM_URL=http://vllm:8000
      - TTS_URL=http://cosyvoice:8001
    depends_on: [redis, vllm, cosyvoice]

  renderer:
    build: {context: ./services/renderer, dockerfile: Dockerfile}
    ports: ["3000:3000"]
    environment:
      - DANMAKU_WS=ws://danmaku-gateway:8002
      - TTS_API=http://cosyvoice:8001
    depends_on: [danmaku-gateway]

  streamer:
    build: {context: ./services/streamer, dockerfile: Dockerfile}
    environment:
      - RENDERER_URL=http://renderer:3000
      - RTMP_URL=${RTMP_URL}
      - STREAM_KEY=${STREAM_KEY}
    depends_on: [renderer]

  admin:
    build: {context: ./services/admin, dockerfile: Dockerfile}
    ports: ["3001:3001"]
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/digital_human
    depends_on: [postgres, danmaku-gateway]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis-data:/data]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: digital_human
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes: [postgres-data:/var/lib/postgresql/data]

volumes:
  model-cache:
  cosyvoice-models:
  redis-data:
  postgres-data:
```

## 常见误区

### 误区一：把所有逻辑塞进一个服务

渲染、对话、TTS、推流写在一个进程里，任何模块 bug 都会让整个系统崩溃，且无法独立扩展瓶颈模块。它们物理上需要不同的 GPU，天然适合微服务拆分。

### 误区二：忽略弹幕风暴

直播间弹幕量可能暴增到数百条/秒。必须有队列缓冲、频率控制、优先级排序、去重合并。弹幕风暴时应优雅降级——回复变少但不崩溃。

### 误区三：RTMP 推流地址泄露

推流地址和密钥是核心凭证，不能硬编码在前端或公开配置中。应通过环境变量注入，管理后台只展示脱敏地址。

## 小结与练习

### 小结

1. **Three.js 渲染引擎**：3D 模型加载、BlendShape 口型同步、表情驱动
2. **对话引擎**：弹幕过滤、意图分类、LLM 对话生成、人设一致性
3. **RTMP 推流**：Canvas 帧捕获、FFmpeg 编码、直播平台推流
4. **Docker Compose**：多服务编排、GPU 资源分配、环境变量管理

### 练习

### 练习一：实现 TTS 音素级口型同步

从 CosyVoice 的 TTS 输出中提取音素时间戳，转换为 `VisemeKeyframe` 数组。要求支持中英文混合文本的音素映射。

### 练习二：构建弹幕互动问答游戏

为对话引擎添加互动问答功能：主播出题（AI 生成选择题），观众弹幕回答，系统统计答案分布并公布结果。设计 `QuizGame` 类。

### 练习三：设计直播数据看板

设计实时数据看板后端接口：在线人数、弹幕频率曲线、情绪分布、热门问题排行。使用 WebSocket 推送实时更新。

---

## 参考答案

### 练习一

**思路**：将中文韵母和英文 SAMPA 音素分别映射到 Viseme 集。每个音素生成 2-3 个关键帧（张嘴→保持→闭嘴），保证过渡平滑。

```typescript
const CHINESE_VOWEL_TO_VISEME: Record<string, string> = {
  'a': 'aa', 'o': 'oh', 'e': 'E', 'i': 'ih', 'u': 'ou',
  'ai': 'aa', 'ei': 'E', 'ao': 'oh', 'ou': 'oh',
  'an': 'aa', 'en': 'E', 'ang': 'aa', 'eng': 'E',
};

interface PhonemeTimestamp {
  phoneme: string;
  startMs: number;
  endMs: number;
}

function generateVisemeKeyframes(phonemes: PhonemeTimestamp[]): VisemeKeyframe[] {
  const keyframes: VisemeKeyframe[] = [];
  for (const p of phonemes) {
    const viseme = CHINESE_VOWEL_TO_VISEME[p.phoneme] || 'sil';
    keyframes.push({ timeMs: p.startMs, viseme, weight: 0.8 });
    const duration = p.endMs - p.startMs;
    if (duration > 80) {
      keyframes.push({ timeMs: p.startMs + duration * 0.5, viseme, weight: 0.6 });
    }
    keyframes.push({ timeMs: p.endMs, viseme: 'sil', weight: 0.0 });
  }
  return keyframes;
}

// 使用
const phonemes: PhonemeTimestamp[] = [
  { phoneme: 'n', startMs: 0, endMs: 60 },
  { phoneme: 'i', startMs: 60, endMs: 150 },
  { phoneme: 'u', startMs: 150, endMs: 250 },
];
console.log(generateVisemeKeyframes(phonemes));
```

### 练习二

**思路**：`QuizGame` 管理出题→收集→统计→公布四个阶段。答案归一化处理各种输入方式，同一用户多次回答只保留最后一次。

```python
import asyncio
import re
import time
from dataclasses import dataclass
from enum import Enum
from collections import Counter


class GamePhase(Enum):
    IDLE = "idle"
    COLLECTING = "collecting"
    REVEALING = "revealing"


@dataclass
class QuizQuestion:
    question: str
    options: dict[str, str]
    correct_answer: str
    explanation: str


class QuizGame:
    def __init__(self):
        self.phase = GamePhase.IDLE
        self.question: QuizQuestion | None = None
        self.answers: dict[str, str] = {}  # user_id -> answer
        self.start_time = 0.0
        self.time_limit = 30

    def start_question(self) -> dict:
        self.question = QuizQuestion(
            question="Transformer 模型的核心机制是什么？",
            options={"A": "卷积网络", "B": "自注意力机制", "C": "循环网络", "D": "最大池化"},
            correct_answer="B",
            explanation="Transformer 的核心是自注意力机制（Self-Attention）。",
        )
        self.answers = {}
        self.start_time = time.time()
        self.phase = GamePhase.COLLECTING
        return {"question": self.question.question, "options": self.question.options}

    def submit_answer(self, user_id: str, raw: str) -> bool:
        if self.phase != GamePhase.COLLECTING:
            return False
        normalized = self._normalize(raw)
        if normalized:
            self.answers[user_id] = normalized
            return True
        return False

    def _normalize(self, raw: str) -> str | None:
        raw = raw.strip().upper()
        if raw in "ABCD" and len(raw) == 1:
            return raw
        m = re.search(r'[选是]?\s*([A-D])', raw)
        return m.group(1) if m else None

    def reveal(self) -> dict:
        self.phase = GamePhase.REVEALING
        dist = Counter(self.answers.values())
        correct = sum(1 for a in self.answers.values() if a == self.question.correct_answer)
        total = len(self.answers)
        return {
            "correct_answer": self.question.correct_answer,
            "distribution": dict(dist),
            "correct_rate": f"{correct / max(total, 1) * 100:.1f}%",
            "explanation": self.question.explanation,
        }


game = QuizGame()
game.start_question()
game.submit_answer("u1", "B")
game.submit_answer("u2", "A")
game.submit_answer("u3", "选B")
game.submit_answer("u1", "C")  # 改答案
print(game.reveal())
```

### 练习三

**思路**：WebSocket 每秒推送快照，弹幕频率用 60 秒滑动窗口，情绪分析用关键词匹配（生产环境用分类模型）。

```python
import asyncio
import time
from collections import deque, Counter
from dataclasses import dataclass
from fastapi import FastAPI, WebSocket

app = FastAPI()


class StreamDashboard:
    def __init__(self):
        self.online: set = set()
        self.danmaku_buffer: deque = deque(maxlen=1000)
        self.response_times: deque = deque(maxlen=100)

    def record_danmaku(self, content: str, user_id: str, intent: str):
        self.danmaku_buffer.append({"content": content, "user_id": user_id,
                                     "intent": intent, "timestamp": time.time()})

    def snapshot(self) -> dict:
        now = time.time()
        recent = [d for d in self.danmaku_buffer if now - d["timestamp"] < 60]
        positive = ["好", "棒", "赞", "666"]
        negative = ["差", "烂", "无聊"]
        pos = sum(1 for d in recent if any(w in d["content"] for w in positive))
        neg = sum(1 for d in recent if any(w in d["content"] for w in negative))
        neu = len(recent) - pos - neg
        total = max(len(recent), 1)
        return {
            "online": len(self.online),
            "danmaku_per_min": len(recent),
            "sentiment": {"positive": round(pos/total*100, 1),
                          "neutral": round(neu/total*100, 1),
                          "negative": round(neg/total*100, 1)},
            "avg_response_ms": round(sum(self.response_times) / max(len(self.response_times), 1), 1),
        }


dashboard = StreamDashboard()


@app.websocket("/ws/dashboard")
async def ws_dashboard(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            await ws.send_json({"type": "snapshot", "data": dashboard.snapshot()})
            await asyncio.sleep(1)
    except Exception:
        pass
```

**要点**：
- WebSocket 每秒推送一次快照，前端无需轮询
- 弹幕频率用 60 秒滑动窗口，避免瞬时峰值误导
- 情绪分析关键词匹配适合 MVP，生产环境替换为分类模型
