# 02 Whisper 实战——本地部署 Whisper 实现高质量语音转文字

> Whisper 是最流行的开源语音识别模型。

## 学习目标

- 掌握 Whisper 的安装和使用
- 理解 Whisper 的模型和参数
- 学会优化 Whisper 的识别效果

---

## 一、安装 Whisper

```bash
pip install openai-whisper
```

---

## 二、基本使用

```python
import whisper

# 加载模型
model = whisper.load_model("base")

# 识别
result = model.transcribe("audio.mp3")

print(result["text"])
```

---

## 三、模型选择

```
模型选择：

| 模型 | 参数量 | 速度 | 准确率 | 适用场景 |
|------|--------|------|--------|----------|
| tiny | 39M | 最快 | 一般 | 实时转写 |
| base | 74M | 快 | 好 | 日常使用 |
| small | 244M | 中等 | 很好 | 质量优先 |
| medium | 769M | 慢 | 优秀 | 高质量需求 |
| large | 1550M | 最慢 | 最好 | 最高质量 |
```

---

## 四、参数配置

```python
result = model.transcribe(
    "audio.mp3",
    language="zh",           # 指定语言
    task="transcribe",       # 任务类型：transcribe 或 translate
    verbose=True,            # 显示进度
    word_timestamps=True     # 单词级时间戳
)
```

---

## 五、长音频处理

```python
def transcribe_long_audio(audio_path: str, chunk_duration: int = 300) -> str:
    """处理长音频"""
    # 加载音频
    audio = whisper.load_audio(audio_path)
    
    # 分块处理
    chunks = []
    for i in range(0, len(audio), chunk_duration * 16000):
        chunk = audio[i:i + chunk_duration * 16000]
        result = model.transcribe(chunk)
        chunks.append(result["text"])
    
    return " ".join(chunks)
```

---

## 六、字幕生成

```python
def generate_subtitles(audio_path: str, output_path: str):
    """生成字幕"""
    result = model.transcribe(audio_path, word_timestamps=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        for segment in result["segments"]:
            start = format_time(segment["start"])
            end = format_time(segment["end"])
            text = segment["text"]
            f.write(f"{start} --> {end}\n{text}\n\n")
```

---

## 小结

```
本课核心要点：

1. Whisper 是最流行的开源语音识别模型
2. 支持多种模型大小，平衡速度和准确率
3. 支持长音频处理和字幕生成
4. 本地部署，无需联网

下一课：语音合成——OpenAI TTS / Edge-TTS 的集成与音色选择。
```

---

## 练习

1. **安装题**：安装并运行 Whisper。

2. **识别题**：识别一段音频。

3. **字幕题**：生成一个字幕文件。
