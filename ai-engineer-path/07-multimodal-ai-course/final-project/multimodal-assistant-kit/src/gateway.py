"""多模态输入网关：识别输入类型并路由到对应处理器。"""
from routers.text import TextRouter
from routers.vision import VisionRouter
from routers.voice import VoiceRouter
from routers.document import DocumentRouter


class MultimodalGateway:
    def __init__(self, mock: bool = False):
        self.mock = mock
        self.text_router = TextRouter(mock=mock)
        self.vision_router = VisionRouter(mock=mock)
        self.voice_router = VoiceRouter(mock=mock)
        self.document_router = DocumentRouter(mock=mock)

    def process(
        self,
        text: str = None,
        image_path: str = None,
        audio_path: str = None,
        document_path: str = None,
    ) -> dict:
        inputs = []
        if audio_path:
            inputs.append(("voice", self.voice_router.transcribe(audio_path)))
        if image_path:
            inputs.append(("vision", self.vision_router.analyze(image_path)))
        if document_path:
            inputs.append(("document", self.document_router.parse(document_path)))
        if text:
            inputs.append(("text", text))

        combined_text = " ".join([inp[1] for inp in inputs])
        response = self.text_router.generate(combined_text)

        return {
            "text": response,
            "metadata": {
                "input_modalities": [inp[0] for inp in inputs],
                "mock": self.mock,
            },
        }
