"""语音处理器。"""
from pathlib import Path


class VoiceRouter:
    def __init__(self, mock: bool = False):
        self.mock = mock

    def transcribe(self, audio_path: str) -> str:
        if self.mock:
            return f"[Mock ASR] 语音转文字: 这是从 {Path(audio_path).name} 识别的内容。"
        raise NotImplementedError("需要接入 Whisper API")

    def synthesize(self, text: str, output_path: str = "output.mp3") -> str:
        if self.mock:
            return f"[Mock TTS] 已生成语音文件: {output_path}"
        raise NotImplementedError("需要接入 TTS API")
