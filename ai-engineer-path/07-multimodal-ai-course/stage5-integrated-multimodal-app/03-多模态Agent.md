# 03 多模态 Agent——让 Agent 具备视觉和听觉能力

> 多模态 Agent 能看、能听、能说，是 AI 助手的终极形态。

## 场景引入

你要构建一个"看得到、听得到、说得出"的 AI 助手：用户可以对着摄像头展示一张产品图片问"这个怎么用？"，也可以录一段语音问问题，助手用语音回答。这需要 Agent 具备三种模态能力——视觉（图片理解）、听觉（语音识别）、语音（语音合成），并能根据用户意图自动组合这些能力。多模态 Agent 不是简单地把三个能力堆在一起，而是要设计一个能理解意图、选择工具、协调执行的智能体。

## 学习目标

- 掌握多模态 Agent 的设计方法
- 理解视觉和听觉能力的集成
- 学会构建多模态 Agent

---

## 一、Agent 架构

```
多模态 Agent：

用户输入 → 输入处理 → 任务理解 → 工具调用 → 结果生成 → 输出
  │          │          │          │          │        │
  ▼          ▼          ▼          ▼          ▼        ▼
文本/图片   预处理    理解意图   调用工具   生成回答  文本/语音
```

---

## 二、视觉能力

```python
class VisionAgent:
    """视觉 Agent"""
    
    def __init__(self):
        self.client = OpenAI()
    
    def see(self, image_path: str) -> str:
        """看图片"""
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "请描述你看到的内容"},
                    {"type": "image_url", "image_url": {"url": image_path}}
                ]
            }]
        )
        return response.choices[0].message.content
```

---

## 三、听觉能力

```python
class HearingAgent:
    """听觉 Agent"""
    
    def __init__(self):
        self.asr = whisper.load_model("base")
    
    def listen(self, audio_path: str) -> str:
        """听音频"""
        result = self.asr.transcribe(audio_path)
        return result["text"]
```

---

## 四、语音能力

```python
class SpeakingAgent:
    """语音 Agent"""
    
    def speak(self, text: str) -> str:
        """说话"""
        asyncio.run(edge_tts.Communicate(text, "zh-CN-XiaoxiaoNeural").save("reply.mp3"))
        return "reply.mp3"
```

---

## 五、多模态 Agent

```python
class MultimodalAgent:
    """多模态 Agent"""
    
    def __init__(self):
        self.vision = VisionAgent()
        self.hearing = HearingAgent()
        self.speaking = SpeakingAgent()
        self.client = OpenAI()
    
    def process(self, input_data: dict) -> dict:
        """处理多模态输入"""
        results = {}
        
        # 处理图片
        if "image" in input_data:
            results["vision"] = self.vision.see(input_data["image"])
        
        # 处理音频
        if "audio" in input_data:
            results["hearing"] = self.hearing.listen(input_data["audio"])
        
        # 生成回答
        answer = self._generate_answer(results)
        
        # 语音输出
        if input_data.get("voice_output"):
            audio = self.speaking.speak(answer)
            results["audio_output"] = audio
        
        results["text_output"] = answer
        
        return results
    
    def _generate_answer(self, context: dict) -> str:
        """生成回答"""
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"基于以下多模态信息回答：{json.dumps(context, ensure_ascii=False)}"
            }]
        )
        return response.choices[0].message.content
```

---

## 六、使用示例

```python
agent = MultimodalAgent()

result = agent.process({
    "image": "photo.jpg",
    "audio": "question.mp3",
    "voice_output": True
})

print(result["text_output"])
```

---

## 常见误区

1. **把所有模态能力都塞进一个 Agent**：一个 Agent 同时处理视觉、听觉、语音会导致代码臃肿、职责不清，应该用组合模式让每个模态能力独立。
2. **不做意图识别就调用能力**：用户可能只想文字聊天不需要语音输出，不做意图识别会浪费资源且体验差。
3. **忽略错误恢复**：某个模态能力失败（如 ASR 识别错误）会导致整个任务失败，需要做降级和重试策略。
4. **不做上下文管理**：多模态对话的上下文包含图片、语音、文字，管理复杂度远高于纯文本，需要专门的上下文管理策略。

## 工程建议

1. **用组合模式设计 Agent**：VisionAgent、HearingAgent、SpeakingAgent 各自独立，MultimodalAgent 作为协调者组合使用。
2. **做意图识别和能力路由**：分析用户输入的模态类型和意图，只调用必要的能力，避免不必要的处理。
3. **每种能力做独立的错误处理**：ASR 失败返回"没听清"、Vision 失败返回"看不清"、TTS 失败降级为文字，互不影响。
4. **实现对话状态机**：管理多模态对话的状态流转（输入中 → 处理中 → 输出中），支持中断和恢复。

## 小结

```
本课核心要点：

1. 多模态 Agent 集成视觉、听觉、语音能力
2. 视觉能力：图片理解
3. 听觉能力：语音识别
4. 语音能力：语音合成

---

**下一课**: [04 流式多模态输出——图文混排、语音流式输出的前端渲染](./04-流式多模态输出.md)
```

---

## 练习

1. **Agent 题**：构建一个多模态 Agent。

2. **视觉题**：实现视觉能力。

3. **听觉题**：实现听觉能力。
