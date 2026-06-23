# 第11课：语音合成（TTS）——CosyVoice / GPT-SoVITS 原理与微调

## 场景引入

想象你在开发一个虚拟客服数字人。用户打字提问，数字人需要"开口说话"来回答。如果只是机械地播放预制音频，用户体验会非常割裂——语调生硬、停顿不自然、遇到新词就卡壳。现代 TTS（Text-to-Speech）技术已经能生成接近真人的语音，但选错方案、用错参数，效果可能还不如十年前的合成语音。

这节课我们从工程实践出发，搞清楚 TTS 的核心架构、主流开源方案的差异，以及如何用 CosyVoice 和 GPT-SoVITS 快速搭建一个能用的语音合成服务。

## 学习目标

完成本课学习后，你将能够：

1. 理解 TTS 技术从拼接合成到端到端神经网络的演进脉络
2. 掌握现代 TTS Pipeline 的四个核心阶段及其工程意义
3. 对比主流开源 TTS 方案（CosyVoice、ChatTTS、Fish Speech、GPT-SoVITS、Bark）的适用场景
4. 使用 CosyVoice 和 ChatTTS 搭建可用的语音合成服务
5. 避免 TTS 集成中的常见工程陷阱

---

## 1. TTS 技术演进

### 1.1 三代 TTS 架构

TTS 技术经历了三个主要阶段，每个阶段解决了前一阶段的核心痛点：

```
┌─────────────────────────────────────────────────────────────┐
│                    TTS 技术演进时间线                         │
├──────────┬──────────────┬───────────────┬───────────────────┤
│  第一代   │   第二代      │   第三代       │   第四代（当前）   │
│ 拼接合成  │ 参数合成      │ 端到端合成     │ 大模型+端到端     │
├──────────┼──────────────┼───────────────┼───────────────────┤
│ 1990s    │ 2000s        │ 2017-2022     │ 2023-2026         │
│ 波形拼接  │ HMM/DNN      │ Tacotron      │ CosyVoice        │
│ 机械感强  │ 统计参数      │ FastSpeech    │ ChatTTS          │
│ 需大量录音│ 声码器依赖    │ VITS          │ Bark/GPT-SoVITS  │
└──────────┴──────────────┴───────────────┴───────────────────┘
```

**第一代：拼接合成（Concatenative Synthesis）**

原理简单粗暴——预先录制大量语音片段，合成时从中挑选合适的片段拼接起来。优点是音质高（因为是真实录音），缺点是需要海量录音数据，且拼接处容易出现不自然的断裂感。

**第二代：参数合成（Parametric Synthesis）**

用统计模型（HMM、DNN）预测声学参数（基频、频谱包络等），再通过声码器（如 STRAIGHT、WORLD）还原波形。数据需求大幅降低，但音质明显不如拼接合成，听起来有"机器味"。

**第三代：端到端合成（End-to-End Synthesis）**

2017 年 Tacotron 的出现标志着 TTS 进入端到端时代。模型直接从文本生成梅尔频谱图，再由声码器转为波形。FastSpeech 2 和 VITS 进一步提升了速度和音质。这一代方案至今仍是工业界主力。

**第四代：大模型驱动（LLM-based TTS）**

2023 年以来，随着大语言模型的发展，TTS 开始借鉴 LLM 的思路——用 token 表示语音、用 Transformer 建模长距离依赖、支持 in-context learning 实现零样本语音克隆。CosyVoice、ChatTTS、Bark 等方案代表了这一方向。

### 1.2 为什么端到端成为主流

端到端方案取代前两代，核心原因有三个：

1. **音质飞跃**：直接学习文本到波形的映射，避免了中间表示的信息损失
2. **工程简化**：不需要手工设计声学特征，Pipeline 更短
3. **可扩展性**：模型架构统一，容易通过增大数据和参数量提升效果

但这并不意味着端到端就是银弹。在资源受限的场景（嵌入式设备、实时交互），轻量级参数合成方案仍有价值。

---

## 2. 现代 TTS Pipeline 架构

### 2.1 四阶段 Pipeline

现代 TTS 系统虽然号称"端到端"，但在工程部署时通常仍分为四个阶段：

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│  文本输入  │───→│  文本前端     │───→│  声学模型     │───→│  声码器   │
│          │    │              │    │              │    │          │
│ "你好世界" │    │ 拼音+韵律标注 │    │ 梅尔频谱生成  │    │ 波形还原  │
└──────────┘    └──────────────┘    └──────────────┘    └──────────┘
     │                │                   │                   │
     ▼                ▼                   ▼                   ▼
  纯文本         语言学特征          中间表示            最终音频
```

**阶段一：文本前端（Text Frontend）**

将原始文本转换为语言学特征序列。中文场景需要处理：

- **分词**：区分"南京市长江大桥"的正确切分
- **多音字消歧**："银行"读 háng 还是 xíng
- **韵律预测**：哪里该停顿、哪里该重读
- **数字/日期归一化**："2026年3月15日"→"二零二六年三月十五日"

这一步的质量直接影响最终合成效果。很多 TTS 系统听起来不自然，问题不在模型，而在文本前端处理不当。

**阶段二：声学模型（Acoustic Model）**

将语言学特征转换为声学表示（通常是梅尔频谱图）。主流架构：

- **FastSpeech 2**：非自回归，速度快，适合实时场景
- **VITS**：端到端，直接从文本到波形，音质高
- **StyleTTS 2**：基于风格扩散模型，表现力强
- **Transformer-based**：如 CosyVoice 的 LLM 模块

**阶段三：声码器（Vocoder）**

将梅尔频谱图转换为最终的音频波形。主流声码器：

- **HiFi-GAN**：高质量、快速推理，工业界首选
- **Vocos**：2024 年新方案，速度更快
- **UnivNet**：通用声码器，跨说话人效果稳定

**阶段四：后处理**

包括降噪、音量归一化、格式转换等工程处理。

### 2.2 为什么理解 Pipeline 很重要

很多开发者把 TTS 当黑盒用，遇到问题就换方案。但实际工程中，理解 Pipeline 能帮你精准定位问题：

- 合成的语音听起来有"滋滋"声？可能是声码器的问题
- 某些词读音错误？大概率是文本前端的问题
- 语调太平淡？需要调整声学模型的风格控制

---

## 3. 主流开源 TTS 方案对比

### 3.1 方案概览

2024-2025 年，开源 TTS 生态快速迭代，以下五个方案最具代表性：

```
┌─────────────┬───────────┬──────────┬──────────┬────────────┬───────────┐
│   方案       │ 架构类型   │ 中文效果  │ 推理速度  │ 语音克隆    │ 社区活跃度 │
├─────────────┼───────────┼──────────┼──────────┼────────────┼───────────┤
│ CosyVoice   │ LLM+流匹配 │ ★★★★★  │ ★★★★    │ 零样本克隆  │ ★★★★★   │
│ ChatTTS     │ LLM-based │ ★★★★   │ ★★★★★  │ 不支持      │ ★★★★★   │
│ Fish Speech │ VQGAN+LLM │ ★★★★   │ ★★★★    │ 零样本克隆  │ ★★★★    │
│ GPT-SoVITS  │ SoVITS    │ ★★★★★  │ ★★★    │ 少样本微调  │ ★★★★★   │
│ Bark        │ GPT-style │ ★★★    │ ★★      │ 不支持      │ ★★★     │
└─────────────┴───────────┴──────────┴──────────┴────────────┴───────────┘
```

### 3.2 CosyVoice

阿里通义实验室出品，2024 年开源后迅速成为中文 TTS 标杆。

**核心特点**：
- 基于 LLM 的文本到语义 token 生成 + 流匹配声码器
- 支持零样本语音克隆（仅需 3 秒参考音频）
- 支持跨语言合成（中英日韩粤）
- 提供 CosyVoice 2 版本，支持流式输出

**适用场景**：需要高质量中文合成、需要语音克隆的数字人项目

### 3.3 ChatTTS

2024 年爆火的对话式 TTS，以极其自然的对话感著称。

**核心特点**：
- 专为对话场景优化，支持笑声、停顿等副语言特征
- 通过 token 控制韵律，可精细调节语速、语调
- 推理速度极快，适合实时对话
- 不支持语音克隆，音色固定

**适用场景**：对话式数字人、实时语音交互、对音色定制要求不高的场景

### 3.4 Fish Speech

基于 VQGAN + LLM 架构，兼顾质量和速度。

**核心特点**：
- 语音量化方案先进，压缩率高
- 支持零样本语音克隆
- 多语言支持好
- 社区活跃，更新频繁

### 3.5 GPT-SoVITS

结合 GPT 和 SoVITS 的少样本微调方案。

**核心特点**：
- 仅需 1 分钟训练数据即可微调出高质量音色
- 微调后的音色还原度极高
- 训练和推理 Pipeline 完善
- 适合需要固定音色的项目

### 3.6 Bark

Suno 出品的 GPT-style TTS，创意性强但中文支持较弱。

**核心特点**：
- 支持生成笑声、叹息、音乐等非语音音频
- 多语言支持（但中文效果一般）
- 适合创意场景，不适合生产环境的中文数字人

### 3.7 方案选择决策树

```
需要中文 TTS？
├── 是
│   ├── 需要语音克隆？
│   │   ├── 是 → CosyVoice / Fish Speech
│   │   │   ├── 需要流式输出？→ CosyVoice 2
│   │   │   └── 需要少样本微调？→ GPT-SoVITS
│   │   └── 否
│   │       ├── 对话场景？→ ChatTTS
│   │       └── 通用场景？→ CosyVoice
│   └── 需要副语言特征（笑声等）？→ ChatTTS / Bark
└── 否（英文为主）
    ├── 需要语音克隆？→ Fish Speech / ElevenLabs
    └── 创意场景？→ Bark
```

---

## 4. CosyVoice 实战

### 4.1 环境搭建

```bash
# 克隆仓库
git clone https://github.com/FunAudioLLM/CosyVoice.git
cd CosyVoice

# 创建虚拟环境
conda create -n cosyvoice python=3.10 -y
conda activate cosyvoice

# 安装依赖
pip install -r requirements.txt

# 下载预训练模型（约 3GB）
python -c "
from modelscope import snapshot_download
snapshot_download('iic/CosyVoice-300M', local_dir='pretrained_models/CosyVoice-300M')
"
```

### 4.2 基础合成示例

```python
import sys
sys.path.append('third_party/Matcha-TTS')
from cosyvoice.cosyvoice import CosyVoice
from cosyvoice.utils.file_utils import load_wav
import torchaudio

cosyvoice = CosyVoice('pretrained_models/CosyVoice-300M')

# 基础 TTS：指定预设音色
for i, j in enumerate(cosyvoice.inference_sft(
    '你好，欢迎使用数字人语音合成系统。今天天气不错，我们一起去散步吧。',
    '中文女',
    speed=1.0
)):
    torchaudio.save(f'output_sft_{i}.wav', j['tts_audio'], 22050)

print("合成完成：output_sft_0.wav")
```

### 4.3 零样本语音克隆

```python
import sys
sys.path.append('third_party/Matcha-TTS')
from cosyvoice.cosyvoice import CosyVoice
from cosyvoice.utils.file_utils import load_wav
import torchaudio

cosyvoice = CosyVoice('pretrained_models/CosyVoice-300M')

# 加载参考音频（3-10秒，采样率16kHz）
prompt_speech = load_wav('reference_voice.wav', 16000)

# 零样本克隆合成
for i, j in enumerate(cosyvoice.inference_zero_shot(
    '你好，我是你的专属数字人助手，很高兴为你服务。',
    '参考音频中的文本内容，用于提取音色特征。',
    prompt_speech,
    speed=1.0
)):
    torchaudio.save(f'output_clone_{i}.wav', j['tts_audio'], 22050)

print("克隆合成完成：output_clone_0.wav")
```

### 4.4 搭建 FastAPI 服务

```python
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import io
import torchaudio
import sys

sys.path.append('third_party/Matcha-TTS')
from cosyvoice.cosyvoice import CosyVoice
from cosyvoice.utils.file_utils import load_wav

app = FastAPI()
model = CosyVoice('pretrained_models/CosyVoice-300M')


@app.post("/tts/sft")
async def tts_sft(
    text: str = Form(...),
    speaker: str = Form("中文女"),
    speed: float = Form(1.0)
):
    """预设音色合成接口"""
    audio_buffer = io.BytesIO()
    for result in model.inference_sft(text, speaker, speed=speed):
        torchaudio.save(audio_buffer, result['tts_audio'], 22050, format="wav")
    audio_buffer.seek(0)
    return StreamingResponse(audio_buffer, media_type="audio/wav")


@app.post("/tts/clone")
async def tts_clone(
    text: str = Form(...),
    reference_audio: UploadFile = File(...),
    reference_text: str = Form(""),
    speed: float = Form(1.0)
):
    """零样本语音克隆接口"""
    audio_bytes = await reference_audio.read()
    audio_buffer = io.BytesIO(audio_bytes)
    waveform, sample_rate = torchaudio.load(audio_buffer)
    if sample_rate != 16000:
        waveform = torchaudio.transforms.Resample(sample_rate, 16000)(waveform)

    output_buffer = io.BytesIO()
    for result in model.inference_zero_shot(text, reference_text, waveform, speed=speed):
        torchaudio.save(output_buffer, result['tts_audio'], 22050, format="wav")
    output_buffer.seek(0)
    return StreamingResponse(output_buffer, media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

---

## 5. ChatTTS 实战

### 5.1 安装与基础使用

```bash
pip install chattts torch torchaudio
```

```python
import ChatTTS
import torch
import torchaudio

chat = ChatTTS.Chat()
chat.load(compile=False)

# 基础合成
texts = [
    "你好，我是数字人小助手。有什么可以帮你的吗？",
    "今天天气真不错，适合出去走走。",
]

# 生成随机 speaker embedding
torch.manual_seed(42)
rand_spk = chat.sample_random_speaker()

params_infer = ChatTTS.Chat.InferCodeParams(
    spk_emb=rand_spk,
    temperature=0.3,
    top_P=0.7,
    top_K=20,
)

params_refine = ChatTTS.Chat.RefineTextParams(
    prompt='[oral_2][laugh_0][break_6]',
)

wavs = chat.infer(
    texts,
    params_infer_code=params_infer,
    params_refine_text=params_refine,
    use_decoder=True,
)

for i, wav in enumerate(wavs):
    torchaudio.save(f'chattts_output_{i}.wav', torch.from_numpy(wav).unsqueeze(0), 24000)
    print(f"保存：chattts_output_{i}.wav")
```

### 5.2 ChatTTS 韵律控制

ChatTTS 的核心优势在于通过特殊 token 控制韵律：

```python
import ChatTTS
import torch
import torchaudio

chat = ChatTTS.Chat()
chat.load(compile=False)

torch.manual_seed(123)
rand_spk = chat.sample_random_speaker()

# 不同韵律风格的文本
style_examples = {
    "自然对话": "[oral_2][laugh_0][break_4]你好啊，最近怎么样？",
    "带笑声": "[oral_4][laugh_2][break_4]这个笑话太好笑了，哈哈哈！",
    "严肃正式": "[oral_0][laugh_0][break_2]各位同事，今天的会议很重要。",
    "停顿强调": "[oral_1][laugh_0][break_8]请注意，[break_4]这个决定将影响所有人。",
}

for style_name, text in style_examples.items():
    params_infer = ChatTTS.Chat.InferCodeParams(
        spk_emb=rand_spk,
        temperature=0.3,
        top_P=0.7,
        top_K=20,
    )

    wavs = chat.infer(
        [text],
        params_infer_code=params_infer,
        skip_refine=True,
    )

    filename = f'chattts_{style_name}.wav'
    torchaudio.save(filename, torch.from_numpy(wavs[0]).unsqueeze(0), 24000)
    print(f"风格 [{style_name}] 合成完成：{filename}")
```

### 5.3 ChatTTS 服务化

```python
from fastapi import FastAPI, Form
from fastapi.responses import StreamingResponse
import ChatTTS
import torch
import torchaudio
import io
import numpy as np

app = FastAPI()

chat = ChatTTS.Chat()
chat.load(compile=False)

# 预设多个音色
speaker_cache = {}
for seed in range(10):
    torch.manual_seed(seed * 100 + 42)
    speaker_cache[f"speaker_{seed}"] = chat.sample_random_speaker()


@app.post("/tts")
async def tts_endpoint(
    text: str = Form(...),
    speaker_id: str = Form("speaker_0"),
    temperature: float = Form(0.3),
    oral_level: int = Form(2),
    laugh_level: int = Form(0),
    break_level: int = Form(4),
):
    spk_emb = speaker_cache.get(speaker_id, speaker_cache["speaker_0"])

    params_infer = ChatTTS.Chat.InferCodeParams(
        spk_emb=spk_emb,
        temperature=temperature,
        top_P=0.7,
        top_K=20,
    )

    styled_text = f"[oral_{oral_level}][laugh_{laugh_level}][break_{break_level}]{text}"

    wavs = chat.infer(
        [styled_text],
        params_infer_code=params_infer,
        skip_refine=True,
    )

    audio_tensor = torch.from_numpy(wavs[0]).unsqueeze(0)
    buffer = io.BytesIO()
    torchaudio.save(buffer, audio_tensor, 24000, format="wav")
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
```

---

## 6. 工程实践建议

### 6.1 性能优化

TTS 服务的延迟直接影响数字人的实时对话体验。几个关键优化点：

**模型量化**：将 FP32 模型量化为 FP16 或 INT8，推理速度提升 1.5-2 倍

```python
# CosyVoice FP16 推理
model = CosyVoice('pretrained_models/CosyVoice-300M')
model.model = model.model.half()  # 转为 FP16
```

**流式合成**：对于长文本，分句合成并流式返回，减少首包延迟

```python
import re

def split_text_for_streaming(text: str, max_chars: int = 50) -> list[str]:
    """按标点和长度分句，适合流式合成"""
    sentences = re.split(r'([。！？；\n])', text)
    chunks = []
    current = ""
    for i, seg in enumerate(sentences):
        current += seg
        if len(current) >= max_chars or seg in "。！？；\n":
            if current.strip():
                chunks.append(current.strip())
            current = ""
    if current.strip():
        chunks.append(current.strip())
    return chunks
```

**GPU 复用**：多个 TTS 实例共享 GPU，通过请求队列调度

### 6.2 音频格式选择

不同场景对音频格式的要求不同：

| 场景 | 采样率 | 格式 | 码率 | 说明 |
|------|--------|------|------|------|
| 实时对话 | 16kHz | PCM/WAV | 256kbps | 低延迟优先 |
| 离线生成 | 22.05kHz | WAV/MP3 | 320kbps | 质量优先 |
| Web 播放 | 24kHz | MP3/OGG | 128kbps | 体积优先 |
| 存档 | 44.1kHz | FLAC | 可变 | 无损存储 |

### 6.3 错误处理

TTS 服务常见的工程问题及应对策略：

```python
import asyncio
from functools import wraps

class TTSErrorHandler:
    @staticmethod
    async def synthesize_with_retry(model, text, max_retries=3):
        for attempt in range(max_retries):
            try:
                # 文本预处理：去除特殊字符
                cleaned = text.replace('\x00', '').strip()
                if not cleaned:
                    return generate_silence(1.0)  # 1秒静音

                result = model.inference_sft(cleaned, '中文女')
                return result

            except torch.cuda.OutOfMemoryError:
                torch.cuda.empty_cache()
                if attempt == max_retries - 1:
                    # 降级到 CPU 推理
                    model = model.cpu()
                    return model.inference_sft(cleaned, '中文女')
                await asyncio.sleep(0.5)

            except Exception as e:
                if attempt == max_retries - 1:
                    raise TTSException(f"合成失败：{str(e)}")
                await asyncio.sleep(0.2)
```

---

## 常见误区

### 误区一：TTS 效果只取决于模型

很多开发者花大量时间对比模型，却忽略了文本前端的重要性。一个典型的例子：

```
输入："2024年GDP增长5.2%"
错误处理："二零二四年GDP增长五点二百分号"  ← "GDP" 和 "%" 处理不当
正确处理："二零二四年 GDP 增长百分之五点二"
```

文本前端的归一化质量对最终效果的影响，有时比模型本身更大。

### 误区二：采样率越高音质越好

TTS 模型的训练采样率是固定的（CosyVoice 22.05kHz、ChatTTS 24kHz）。强行上采样到 44.1kHz 不会提升音质，只会增大文件体积。应该在模型输出采样率基础上做格式转换。

### 误区三：零样本克隆可以完美复刻任何人

零样本克隆的效果受参考音频质量影响很大。回声大、噪音多、语速过快的参考音频，克隆效果会大打折扣。最佳实践是提供 5-10 秒、安静环境、正常语速的参考音频。

### 误区四：温度参数越低越稳定

ChatTTS 的 temperature 参数控制生成的随机性。设为 0 会导致语音极度单调、缺乏自然感。一般建议 0.2-0.5 之间，需要根据实际效果微调。

---

## 小结

本课我们系统学习了 TTS 技术的核心知识：

1. **技术演进**：从拼接合成到大模型驱动，TTS 经历了四代架构演进
2. **Pipeline 理解**：文本前端、声学模型、声码器、后处理四个阶段各有职责
3. **方案选择**：CosyVoice 适合需要克隆的场景，ChatTTS 适合对话场景，GPT-SoVITS 适合固定音色微调
4. **工程实践**：流式合成、音频格式、错误处理是生产部署的关键

下一课我们将深入语音克隆技术，学习如何用少量音频数据复刻任意人的声音。

---

## 练习

### 练习一：方案选型

你正在为一个在线教育平台开发数字人助教，需要：
- 合成中文课程讲解内容
- 支持偶尔的英文术语朗读
- 需要固定一个亲切的女声音色
- 需要实时合成（延迟 < 500ms）

请从 CosyVoice、ChatTTS、Fish Speech、GPT-SoVITS 中选择最合适的方案，并说明理由。

### 练习二：CosyVoice 服务搭建

基于本课的 CosyVoice FastAPI 示例，扩展一个 `/tts/stream` 接口，实现：
- 接收长文本输入
- 自动分句
- 以 chunked WAV 格式流式返回音频
- 每个 chunk 对应一个句子

### 练习三：ChatTTS 韵律调优

使用 ChatTTS 合成以下文本，尝试不同的 oral/laugh/break 参数组合，找到最自然的版本：

```
各位观众大家好！今天我们来聊聊人工智能的最新进展。[停顿]这个话题最近非常火，很多人都在讨论。
```

---

## 参考答案

### 练习一

**思路**：分析需求的关键约束——中文为主、固定音色、实时性要求高、偶尔英文。

**答案**：

推荐 **CosyVoice** 或 **GPT-SoVITS**，具体取决于是否需要微调：

- **CosyVoice**（首选）：中文效果优秀，支持跨语言（中英混合），有预设音色可直接使用，推理速度快满足 500ms 要求。如果预设音色不够亲切，可以用 3 秒参考音频做零样本克隆。
- **GPT-SoVITS**（备选）：如果对音色有极高要求，可以用 1 分钟音频微调出完美音色。但微调后推理稍慢，需要评估延迟是否达标。

不推荐 ChatTTS（不支持固定音色、不支持英文）和 Fish Speech（英文支持好但中文效果略逊于 CosyVoice）。

**要点**：
- 固定音色 + 中文优先 → CosyVoice 预设或零样本
- 实时性要求 → 关注首包延迟，建议流式合成
- 中英混合 → CosyVoice 的跨语言能力更适合

### 练习二

**思路**：在基础 FastAPI 服务上增加分句逻辑和流式返回。

**答案**：

```python
from fastapi import FastAPI, Form
from fastapi.responses import StreamingResponse
import io
import re
import torchaudio
import sys

sys.path.append('third_party/Matcha-TTS')
from cosyvoice.cosyvoice import CosyVoice

app = FastAPI()
model = CosyVoice('pretrained_models/CosyVoice-300M')


def split_sentences(text: str, max_chars: int = 50) -> list[str]:
    sentences = re.split(r'([。！？；\n])', text)
    chunks, current = [], ""
    for seg in sentences:
        current += seg
        if len(current) >= max_chars or seg in "。！？；\n":
            if current.strip():
                chunks.append(current.strip())
            current = ""
    if current.strip():
        chunks.append(current.strip())
    return chunks


async def audio_chunk_generator(text: str, speaker: str, speed: float):
    sentences = split_sentences(text)
    for sentence in sentences:
        for result in model.inference_sft(sentence, speaker, speed=speed):
            buffer = io.BytesIO()
            torchaudio.save(buffer, result['tts_audio'], 22050, format="wav")
            buffer.seek(0)
            yield buffer.read()


@app.post("/tts/stream")
async def tts_stream(
    text: str = Form(...),
    speaker: str = Form("中文女"),
    speed: float = Form(1.0)
):
    return StreamingResponse(
        audio_chunk_generator(text, speaker, speed),
        media_type="audio/wav"
    )
```

**要点**：
- 分句逻辑需要处理中文标点和长度限制
- 流式返回减少首包延迟
- 每个 chunk 是独立的 WAV，客户端需要拼接或顺序播放

### 练习三

**思路**：ChatTTS 的 oral 控制口语化程度，laugh 控制笑声，break 控制停顿时长。

**答案**：

推荐参数组合：

```python
# 自然讲解风格
styled_text = "[oral_2][laugh_0][break_6]各位观众大家好！今天我们来聊聊人工智能的最新进展。[break_4]这个话题最近非常火，很多人都在讨论。"

# 参数说明：
# oral_2：中等口语化，适合讲解场景
# laugh_0：不加笑声，保持专业
# break_6：主句间适度停顿
# break_4：话题转折处稍短停顿
```

**要点**：
- 讲解场景不宜太口语化（oral_3-4 会显得随意）
- 不应加笑声（laugh_0），除非是轻松的科普风格
- 停顿（break）值越大停顿越长，8-12 适合长停顿，2-4 适合短停顿
- 建议多次生成对比，选择最自然的版本
