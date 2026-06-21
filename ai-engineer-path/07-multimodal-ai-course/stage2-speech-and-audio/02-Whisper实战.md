# 第 2 课：Whisper 实战——本地部署 Whisper 实现高质量语音转文字

> **课程定位**：掌握 Whisper 的安装、使用和优化，搭建本地 ASR 服务
> **前置知识**：第 1 课的语音识别概览
> **预计时长**：45 分钟

---

## 学习目标

完成本课学习后，你将能够：

1. 安装并运行 Whisper，完成语音转文字
2. 根据场景选择合适的模型大小
3. 处理长音频和生成带时间戳的字幕
4. 对比本地 Whisper 和 API 调用的优劣

---

## 一、安装

```bash
# 方式 1：pip 安装（推荐）
pip install openai-whisper

# 方式 2：从源码安装
git clone https://github.com/openai/whisper.git
cd whisper
pip install -e .

# 依赖：需要 ffmpeg
# macOS: brew install ffmpeg
# Ubuntu: sudo apt install ffmpeg
# Windows: 下载 ffmpeg 并添加到 PATH

# 验证安装
python -c "import whisper; print(whisper.__version__)"
```

---

## 二、基本使用

```python
import whisper

# 加载模型（首次运行会自动下载）
model = whisper.load_model("base")

# 识别音频文件
result = model.transcribe("audio.mp3")

# 输出结果
print(result["text"])

# 详细信息
print(f"语言: {result['language']}")
print(f"分段数: {len(result['segments'])}")
```

---

## 三、模型选择指南

```
┌──────────┬──────────┬──────────┬──────────┬──────────────────────┐
│  模型     │  参数量   │  速度     │  准确率   │  适用场景             │
├──────────┼──────────┼──────────┼──────────┼──────────────────────┤
│  tiny    │  39M     │  ~32x    │  一般     │  实时转写、低延迟场景  │
│  base    │  74M     │  ~16x    │  好       │  日常使用、快速原型    │
│  small   │  244M    │  ~6x     │  很好     │  质量优先、中等延迟    │
│  medium  │  769M    │  ~2x     │  优秀     │  高质量需求            │
│  large   │  1550M   │  1x      │  最好     │  最高质量、不急        │
└──────────┴──────────┴──────────┴──────────┴──────────────────────┘

速度倍数含义：
  tiny 32x = 处理 1 分钟音频只需 2 秒
  large 1x = 处理 1 分钟音频需要 1 分钟

选择建议：
  开发调试 → tiny 或 base（快）
  生产环境 → small 或 medium（质量好）
  最终输出 → large（质量最好）
  实时转写 → tiny（延迟最低）
```

---

## 四、参数配置详解

```python
result = model.transcribe(
    "audio.mp3",

    # 基础参数
    language="zh",              # 指定语言（不指定会自动检测）
    task="transcribe",          # "transcribe" 转写原文 | "translate" 翻译成英文

    # 输出控制
    verbose=True,               # 打印进度
    word_timestamps=True,       # 单词级时间戳

    # 质量控制
    temperature=0.0,            # 0 = 确定性输出，>0 = 随机性
    compression_ratio_threshold=2.4,  # 压缩比阈值
    no_speech_threshold=0.6,    # 无语音阈值

    # 分段控制
    condition_on_previous_text=True,  # 基于前文生成（提高连贯性）
    initial_prompt="以下是普通话的句子。",  # 提示语言风格
)
```

---

## 五、长音频处理

```python
import whisper
import numpy as np

def transcribe_long_audio(audio_path: str, model_name: str = "base", chunk_seconds: int = 30) -> dict:
    """处理长音频：自动分段并拼接结果。"""
    model = whisper.load_model(model_name)

    # 加载完整音频
    audio = whisper.load_audio(audio_path)
    audio_duration = len(audio) / whisper.audio.SAMPLE_RATE
    print(f"音频时长: {audio_duration:.1f} 秒")

    # 分段处理
    chunk_samples = chunk_seconds * whisper.audio.SAMPLE_RATE
    all_segments = []

    for i, start in enumerate(range(0, len(audio), chunk_samples)):
        chunk = audio[start:start + chunk_samples]
        chunk_duration = len(chunk) / whisper.audio.SAMPLE_RATE

        # pad 到 30 秒（Whisper 要求）
        chunk = whisper.pad_or_trim(chunk)

        # 生成 mel 频谱
        mel = whisper.log_mel_spectrogram(chunk).to(model.device)

        # 检测语言
        _, probs = model.detect_language(mel)
        lang = max(probs, key=probs.get)

        # 解码
        options = whisper.DecodingOptions(language=lang, fp16=False)
        result = whisper.decode(model, mel, options)

        # 计算时间偏移
        offset = start / whisper.audio.SAMPLE_RATE

        all_segments.append({
            "start": offset,
            "end": offset + chunk_duration,
            "text": result.text.strip(),
            "language": lang,
        })

        print(f"  分段 {i+1}: {offset:.1f}s - {offset + chunk_duration:.1f}s")

    return {
        "text": " ".join(s["text"] for s in all_segments),
        "segments": all_segments,
        "duration": audio_duration,
    }
```

---

## 六、字幕生成

```python
def generate_srt(audio_path: str, output_path: str, model_name: str = "base"):
    """生成 SRT 字幕文件。"""
    model = whisper.load_model(model_name)
    result = model.transcribe(audio_path, word_timestamps=True)

    with open(output_path, "w", encoding="utf-8") as f:
        for i, segment in enumerate(result["segments"], 1):
            start = format_timestamp(segment["start"])
            end = format_timestamp(segment["end"])
            text = segment["text"].strip()
            f.write(f"{i}\n{start} --> {end}\n{text}\n\n")

    print(f"字幕已保存: {output_path}")
    print(f"共 {len(result['segments'])} 条字幕")


def format_timestamp(seconds: float) -> str:
    """将秒数转换为 SRT 时间格式 (HH:MM:SS,mmm)。"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def generate_vtt(audio_path: str, output_path: str, model_name: str = "base"):
    """生成 WebVTT 字幕文件（Web 标准格式）。"""
    model = whisper.load_model(model_name)
    result = model.transcribe(audio_path, word_timestamps=True)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        for i, segment in enumerate(result["segments"], 1):
            start = format_vtt_timestamp(segment["start"])
            end = format_vtt_timestamp(segment["end"])
            text = segment["text"].strip()
            f.write(f"{i}\n{start} --> {end}\n{text}\n\n")

    print(f"字幕已保存: {output_path}")


def format_vtt_timestamp(seconds: float) -> str:
    """WebVTT 时间格式 (HH:MM:SS.mmm)。"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
```

---

## 七、本地 Whisper vs API 调用

```
┌─────────────────┬──────────────────┬──────────────────┐
│  维度            │  本地 Whisper     │  Whisper API     │
├─────────────────┼──────────────────┼──────────────────┤
│  成本            │  免费（用自己 GPU）│  $0.006/分钟     │
│  隐私            │  数据不离开本地   │  数据上传到云端   │
│  速度            │  取决于 GPU       │  取决于网络       │
│  质量            │  取决于模型大小   │  始终用 large     │
│  部署复杂度      │  需要 GPU 环境    │  一行代码         │
│  离线使用        │  ✓ 支持          │  ✗ 不支持        │
│  自定义          │  ✓ 可微调        │  ✗ 不可微调      │
└─────────────────┴──────────────────┴──────────────────┘

选择建议：
  数据敏感 / 离线场景 / 大量音频 → 本地 Whisper
  快速原型 / 小量音频 / 无 GPU → Whisper API
```

---

## 八、常见问题

```
问题 1：安装后 import 报错
  错误：ModuleNotFoundError: No module named 'whisper'
  解决：pip install openai-whisper（不是 pip install whisper）

问题 2：识别中文效果差
  原因：模型太小（tiny/base 对中文支持有限）
  解决：用 medium 或 large 模型；指定 language="zh"

问题 3：长音频识别不连贯
  原因：分段切割破坏了语句完整性
  解决：使用 condition_on_previous_text=True；设置 initial_prompt

问题 4：GPU 内存不足
  解决：用更小的模型；或者用 CPU 模式（很慢但可用）
  model = whisper.load_model("base", device="cpu")

问题 5：音频格式不支持
  解决：先用 ffmpeg 转换格式
  ffmpeg -i input.m4a output.mp3
```

---

## 小结

```
本课核心要点：

1. Whisper 安装：pip install openai-whisper + ffmpeg
2. 模型选择：tiny（快）→ base（日常）→ small/medium（质量）→ large（最佳）
3. 长音频处理：分段 + pad + 拼接
4. 字幕生成：SRT / VTT 格式，带时间戳
5. 本地 vs API：隐私/成本/离线用本地，快速原型用 API

---

**下一课**: [03 语音合成——OpenAI TTS / Edge-TTS 的集成与音色选择](./03-语音合成.md)
```

---

## 练习

1. **基础题**：安装 Whisper 并用 base 模型转写一段你录制的音频（30 秒以内），检查识别准确率。

2. **对比题**：分别用 tiny、base、small 模型转写同一段中文音频，对比识别质量和耗时。

3. **字幕题**：用 Whisper 生成一个视频的 SRT 字幕文件，用播放器加载验证时间戳是否准确。
