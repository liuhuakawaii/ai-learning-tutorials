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

---

## 参考答案

### 练习一：Agent 题——构建一个多模态 Agent

**思路**：用组合模式将视觉、听觉、语音三个独立能力组合成一个协调 Agent，加入意图识别决定调用哪些能力，每种能力有独立的错误处理和降级策略。

**答案**：
```python
import json
from openai import OpenAI

class VisionCapability:
    """视觉能力"""
    def __init__(self):
        self.client = OpenAI()

    def see(self, image_path: str, prompt: str = "请描述你看到的内容") -> dict:
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_path}}
                    ]
                }]
            )
            return {"success": True, "description": response.choices[0].message.content}
        except Exception as e:
            return {"success": False, "error": str(e), "description": "无法识别图片内容"}

class HearingCapability:
    """听觉能力"""
    def __init__(self):
        self._model = None

    def _get_model(self):
        if self._model is None:
            import whisper
            self._model = whisper.load_model("base")
        return self._model

    def listen(self, audio_path: str) -> dict:
        try:
            model = self._get_model()
            result = model.transcribe(audio_path)
            return {"success": True, "transcript": result["text"], "language": result.get("language", "unknown")}
        except Exception as e:
            return {"success": False, "error": str(e), "transcript": ""}

class SpeakingCapability:
    """语音能力"""
    def speak(self, text: str, output_path: str = "reply.mp3") -> dict:
        try:
            import edge_tts
            import asyncio
            asyncio.run(edge_tts.Communicate(text, "zh-CN-XiaoxiaoNeural").save(output_path))
            return {"success": True, "audio_path": output_path}
        except Exception as e:
            return {"success": False, "error": str(e), "audio_path": None}

class MultimodalAgent:
    """多模态 Agent"""

    def __init__(self):
        self.vision = VisionCapability()
        self.hearing = HearingCapability()
        self.speaking = SpeakingCapability()
        self.client = OpenAI()

    def process(self, input_data: dict) -> dict:
        """处理多模态输入"""
        results = {}

        # 意图识别
        intent = self._identify_intent(input_data)
        results["intent"] = intent

        # 按意图调用能力
        if "image" in input_data and intent.get("need_vision", True):
            results["vision"] = self.vision.see(input_data["image"], intent.get("vision_prompt", "请描述图片内容"))

        if "audio" in input_data and intent.get("need_hearing", True):
            results["hearing"] = self.hearing.listen(input_data["audio"])

        # 生成回答
        text_answer = self._generate_answer(results, intent)
        results["text_output"] = text_answer

        # 语音输出
        if intent.get("need_voice_output", input_data.get("voice_output", False)):
            audio_result = self.speaking.speak(text_answer)
            results["audio_output"] = audio_result

        return results

    def _identify_intent(self, input_data: dict) -> dict:
        """识别用户意图"""
        text_hint = input_data.get("text", "")
        prompt = f"""分析用户的多模态输入意图。
输入包含：{", ".join(input_data.keys())}
文本提示：{text_hint}

请以 JSON 输出：
{{"need_vision": true/false, "need_hearing": true/false, "need_voice_output": true/false, "task_type": "描述/问答/翻译/其他", "vision_prompt": "给视觉模型的提示"}}"""

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)

    def _generate_answer(self, context: dict, intent: dict) -> str:
        """生成回答"""
        context_text = json.dumps(
            {k: v for k, v in context.items() if k != "intent"},
            ensure_ascii=False
        )
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"任务类型：{intent.get('task_type', '问答')}\n多模态信息：{context_text}\n请生成回答。"
            }]
        )
        return response.choices[0].message.content

# 使用示例
agent = MultimodalAgent()
result = agent.process({
    "image": "product.jpg",
    "text": "这个产品怎么使用？",
    "voice_output": True
})
print(f"文本回答: {result['text_output']}")
print(f"语音文件: {result.get('audio_output', {}).get('audio_path')}")
```

**要点**：
- 意图识别决定调用哪些能力，避免不必要的处理（如纯文字聊天不需要视觉）
- 每种能力的错误独立处理，Vision 失败不影响 Hearing 和 Speaking
- 常见错误：不做意图识别，每次请求都调用所有能力，浪费资源且增加延迟

### 练习二：视觉题——实现视觉能力

**思路**：实现一个支持多种视觉任务（描述、OCR、物体检测）的视觉能力模块，通过不同的 prompt 模板驱动同一个视觉模型完成不同任务。

**答案**：
```python
from enum import Enum
from typing import Optional

class VisionTask(Enum):
    DESCRIBE = "describe"
    OCR = "ocr"
    OBJECT_DETECT = "object_detect"
    COMPARE = "compare"

class AdvancedVisionCapability:
    """高级视觉能力"""

    PROMPTS = {
        VisionTask.DESCRIBE: "请详细描述这张图片的内容，包括主要物体、颜色、布局和场景。",
        VisionTask.OCR: "请识别并提取图片中的所有文字内容，保持原始排版格式。",
        VisionTask.OBJECT_DETECT: "请列出图片中所有可识别的物体，标注位置和类别。",
        VisionTask.COMPARE: "请对比这两张图片的异同点。"
    }

    def __init__(self):
        self.client = OpenAI()

    def analyze(self, image_path: str, task: VisionTask = VisionTask.DESCRIBE, custom_prompt: str = None) -> dict:
        """执行视觉分析"""
        prompt = custom_prompt or self.PROMPTS[task]
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image_path}}
        ]

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": content}]
            )
            return {
                "success": True,
                "task": task.value,
                "result": response.choices[0].message.content
            }
        except Exception as e:
            return {"success": False, "task": task.value, "error": str(e)}

    def compare_images(self, image_path_1: str, image_path_2: str) -> dict:
        """对比两张图片"""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": self.PROMPTS[VisionTask.COMPARE]},
                        {"type": "image_url", "image_url": {"url": image_path_1}},
                        {"type": "image_url", "image_url": {"url": image_path_2}}
                    ]
                }]
            )
            return {"success": True, "comparison": response.choices[0].message.content}
        except Exception as e:
            return {"success": False, "error": str(e)}

# 使用示例
vision = AdvancedVisionCapability()

desc = vision.analyze("product.jpg", VisionTask.DESCRIBE)
print(f"描述: {desc['result']}")

ocr = vision.analyze("document_scan.jpg", VisionTask.OCR)
print(f"文字: {ocr['result']}")

diff = vision.compare_images("before.jpg", "after.jpg")
print(f"对比: {diff['comparison']}")
```

**要点**：
- 不同视觉任务通过不同的 prompt 模板驱动，复用同一个视觉模型
- 图片对比需要在一条消息中传入多张图片
- 常见错误：OCR 任务没有提示保持排版格式，导致提取的文字结构丢失

### 练习三：听觉题——实现听觉能力

**思路**：实现一个支持实时转写、说话人分离和音频预处理的听觉能力模块，处理真实场景中的噪音音频。

**答案**：
```python
class AdvancedHearingCapability:
    """高级听觉能力"""

    def __init__(self, model_size: str = "base"):
        import whisper
        self.model = whisper.load_model(model_size)
        self.client = OpenAI()

    def transcribe(self, audio_path: str, language: str = None) -> dict:
        """转写音频"""
        try:
            options = {}
            if language:
                options["language"] = language
            result = self.model.transcribe(audio_path, **options)
            return {
                "success": True,
                "text": result["text"],
                "language": result.get("language", "unknown"),
                "segments": result.get("segments", []),
                "duration": result.get("duration", 0)
            }
        except Exception as e:
            return {"success": False, "error": str(e), "text": ""}

    def transcribe_with_timestamps(self, audio_path: str) -> list:
        """带时间戳的转写"""
        result = self.model.transcribe(audio_path)
        timestamps = []
        for seg in result.get("segments", []):
            timestamps.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"]
            })
        return timestamps

    def summarize_audio(self, audio_path: str) -> dict:
        """音频内容摘要"""
        transcribe_result = self.transcribe(audio_path)
        if not transcribe_result["success"]:
            return transcribe_result

        transcript = transcribe_result["text"]
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"请对以下音频转写内容进行摘要，提取关键信息：\n\n{transcript}"
            }]
        )
        return {
            "success": True,
            "transcript": transcript,
            "summary": response.choices[0].message.content,
            "duration": transcribe_result["duration"]
        }

    def extract_keywords(self, audio_path: str, top_n: int = 5) -> list:
        """提取音频关键词"""
        result = self.transcribe(audio_path)
        if not result["success"]:
            return []

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"从以下文本中提取 {top_n} 个关键词，以 JSON 数组格式输出：\n\n{result['text']}"
            }],
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
        return data.get("keywords", [])

# 使用示例
hearing = AdvancedHearingCapability(model_size="base")

result = hearing.transcribe("meeting.mp3")
print(f"转写: {result['text'][:100]}...")

timestamps = hearing.transcribe_with_timestamps("meeting.mp3")
for ts in timestamps[:3]:
    print(f"  [{ts['start']:.1f}s - {ts['end']:.1f}s] {ts['text']}")

summary = hearing.summarize_audio("meeting.mp3")
print(f"摘要: {summary['summary']}")

keywords = hearing.extract_keywords("meeting.mp3")
print(f"关键词: {keywords}")
```

**要点**：
- Whisper 模型大小影响准确率和速度，base 适合实时场景，large 适合离线转写
- 带时间戳的转写对字幕和音频检索非常重要
- 常见错误：不指定 language 参数，中英混合音频的转写质量会很差
