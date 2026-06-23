# 阶段实战：构建3D资产生成Pipeline

前5课分别讲了3D表示、NeRF、3DGS、文本驱动生成、图像驱动重建。每项技术都是独立的——手动运行脚本、手动调参、手动导出格式。

现在把它们串成一个Pipeline：用户在网页输入"一把蓝色水晶剑"或上传一张参考图，系统自动完成 文本理解→图像生成→多视图生成→3D重建→纹理优化→glTF输出。整个过程需要模块化、可配置、可扩展。

## 架构设计

```
用户输入（文本/图像）
       │
       ▼
  M1 文本理解 → M2 图像生成 → M3 预处理 → M4 3D重建 → M5 后处理 → M6 导出
  (LLM)        (SDXL/Flux)    (抠图)      (TripoSR)    (减面)      (glTF)

  配置：pipeline.yaml  |  每个模块可替换
```

核心设计原则：**每个环节可替换**。3D生成技术迭代极快，今天用TripoSR，下周可能出更好的模型。代码和某个模型强耦合，每次替换都要改大量代码。

## 配置驱动的模块注册

```yaml
# pipeline.yaml
modules:
  text_understanding:
    provider: "openai"
    model: "gpt-4o"
  image_generator:
    provider: "flux"
    num_inference_steps: 28
  preprocessor:
    remove_background: true
    target_size: [512, 512]
  reconstructor:
    provider: "triposr"
    mc_resolution: 256
  postprocessor:
    decimate_target: 50000
  exporter:
    formats: ["glb", "obj"]

batch:
  max_concurrent: 4
  retry_count: 3
```

换模型只改`provider`一行，不碰代码。

## 模块接口与核心实现

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from PIL import Image

@dataclass
class PipelineContext:
    task_id: str
    input_text: Optional[str] = None
    input_image: Optional[Image.Image] = None
    prompt: Optional[str] = None
    generated_image: Optional[Image.Image] = None
    preprocessed_image: Optional[Image.Image] = None
    mesh_path: Optional[str] = None
    output_paths: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)
    errors: list = field(default_factory=list)

class BaseModule(ABC):
    def __init__(self, config: dict): self.config = config
    @abstractmethod
    def execute(self, ctx: PipelineContext) -> PipelineContext: ...
```

各模块实现（展示关键逻辑，省略import）：

```python
class GPTTextUnderstanding(BaseModule):
    """LLM将用户描述转为图像生成prompt"""
    def execute(self, ctx):
        if ctx.input_text is None: return ctx
        from openai import OpenAI
        client = OpenAI(api_key=self.config.get("api_key"))
        resp = client.chat.completions.create(
            model=self.config.get("model", "gpt-4o"),
            messages=[
                {"role": "system", "content": "将描述转为图像生成prompt，输出JSON: {prompt, negative_prompt}"},
                {"role": "user", "content": ctx.input_text}],
            response_format={"type": "json_object"})
        import json
        result = json.loads(resp.choices[0].message.content)
        ctx.prompt = result.get("prompt", ctx.input_text)
        return ctx

class FluxImageGenerator(BaseModule):
    """Flux生成图像"""
    def __init__(self, config):
        super().__init__(config); self._pipe = None
    def _load(self):
        if self._pipe is None:
            from diffusers import FluxPipeline; import torch
            self._pipe = FluxPipeline.from_pretrained(
                self.config.get("model", "black-forest-labs/FLUX.1-dev"),
                torch_dtype=torch.bfloat16).to("cuda")
        return self._pipe
    def execute(self, ctx):
        if ctx.input_image is not None: return ctx
        ctx.generated_image = self._load()(
            prompt=ctx.prompt,
            num_inference_steps=self.config.get("num_inference_steps", 28),
            guidance_scale=self.config.get("guidance_scale", 3.5)).images[0]
        return ctx

class TripoSRReconstructor(BaseModule):
    """TripoSR前馈3D重建"""
    def __init__(self, config):
        super().__init__(config); self._model = None
    def execute(self, ctx):
        import torch, trimesh; from pathlib import Path
        if self._model is None:
            from tsr.system import TSR
            self._model = TSR.from_pretrained("stabilityai/TripoSR",
                config_name="config.yaml", weight_name="model.ckpt")
            self._model.renderer.set_chunk_size(8192)
            self._model.to("cuda").eval()
        image = ctx.preprocessed_image or ctx.input_image
        if image is None: ctx.errors.append("无输入图像"); return ctx
        with torch.no_grad():
            codes = self._model([image.convert("RGBA")], device=self._model.device)
            meshes = self._model.extract_mesh(codes, resolution=self.config.get("mc_resolution", 256))
        ctx.mesh_path = str(Path(ctx.metadata["output_dir"]) / "raw.obj")
        meshes[0].export(ctx.mesh_path)
        ctx.metadata["vertex_count"] = len(meshes[0].vertices)
        return ctx
```

## Pipeline编排器

```python
import uuid, time, yaml, logging, concurrent.futures

logger = logging.getLogger(__name__)
MODULE_REGISTRY = {
    "text_understanding": {"openai": GPTTextUnderstanding},
    "image_generator":    {"flux": FluxImageGenerator},
    "reconstructor":      {"triposr": TripoSRReconstructor},
}
PIPELINE_STAGES = ["text_understanding", "image_generator", "preprocessor",
                   "reconstructor", "postprocessor", "exporter"]

class Pipeline:
    def __init__(self, config_path="pipeline.yaml"):
        with open(config_path, encoding="utf-8") as f: self.config = yaml.safe_load(f)
        self.modules = {}
        for stage in PIPELINE_STAGES:
            cfg = self.config.get("modules", {}).get(stage, {})
            cls = MODULE_REGISTRY.get(stage, {}).get(cfg.get("provider"))
            if cls: self.modules[stage] = cls(cfg)

    def run(self, input_text=None, input_image=None):
        from pathlib import Path
        task_id = uuid.uuid4().hex[:8]
        out_dir = Path(self.config.get("pipeline", {}).get("output_dir", "./output")) / task_id
        out_dir.mkdir(parents=True, exist_ok=True)
        ctx = PipelineContext(task_id=task_id, input_text=input_text,
                              input_image=input_image, metadata={"output_dir": str(out_dir)})
        max_retries = self.config.get("batch", {}).get("retry_count", 3)

        logger.info(f"Pipeline开始: {task_id}")
        for stage in PIPELINE_STAGES:
            module = self.modules.get(stage)
            if not module: continue
            for attempt in range(max_retries + 1):
                try: ctx = module.execute(ctx); break
                except Exception as e:
                    if attempt < max_retries: time.sleep(2 * (2 ** attempt))
                    else: ctx.errors.append(f"{stage}失败: {e}")
            if ctx.errors and stage in ("reconstructor",): break
        return ctx
```

错误处理策略：可恢复错误（OOM）→指数退避重试；不可恢复错误→跳过记录；模型错误→切换备用模型。

## 质量检查

```python
import trimesh

def check_quality(mesh_path):
    mesh = trimesh.load(mesh_path, force="mesh")
    v, f = len(mesh.vertices), len(mesh.faces)
    size_mb = Path(mesh_path).stat().st_size / (1024*1024)
    checks = [
        ("顶点数", 1000 <= v <= 500000, str(v)),
        ("面数", 500 <= f <= 1000000, str(f)),
        ("文件大小", size_mb <= 50, f"{size_mb:.1f}MB"),
    ]
    for name, passed, detail in checks:
        print(f"  {'✓' if passed else '✗'} {name}: {detail}")
    return all(c[1] for c in checks)
```

## 练习

### 练习一：添加SDXL后端

为Pipeline添加`SDXLImageGenerator`，实现`BaseModule`接口，配置中`provider: "sdxl"`即可切换。SDXL的`guidance_scale`推荐7-9（Flux用3-4），用`float16`（Flux用`bfloat16`）。

### 练习二：模型缓存

当前Pipeline每次运行都重新加载模型。用`OrderedDict`实现LRU缓存：首次加载后缓存，后续复用。淘汰时释放GPU显存（`torch.cuda.empty_cache()`）。线程安全是必须的。

### 练习三：降级策略

修改编排器，当TripoSR失败后自动切换备用模块。配置增加`fallback`字段：

```yaml
modules:
  reconstructor:
    provider: "triposr"
    fallback: "instantmesh"
```

---

## 参考答案

### 练习一

```python
from diffusers import StableDiffusionXLPipeline; import torch

class SDXLImageGenerator(BaseModule):
    def __init__(self, config): super().__init__(config); self._pipe = None
    def _load(self):
        if self._pipe is None:
            self._pipe = StableDiffusionXLPipeline.from_pretrained(
                self.config.get("model", "stabilityai/stable-diffusion-xl-base-1.0"),
                torch_dtype=torch.float16, variant="fp16").to("cuda")
        return self._pipe
    def execute(self, ctx):
        if ctx.input_image is not None: return ctx
        ctx.generated_image = self._load()(
            prompt=ctx.prompt,
            num_inference_steps=self.config.get("num_inference_steps", 50),
            guidance_scale=self.config.get("guidance_scale", 7.5)).images[0]
        return ctx
```

### 练习二

```python
from collections import OrderedDict; import threading, gc, torch

class ModelCache:
    def __init__(self, max_size=2):
        self.max_size = max_size; self._cache = OrderedDict(); self._lock = threading.Lock()
    def get(self, key):
        with self._lock:
            if key in self._cache: self._cache.move_to_end(key); return self._cache[key]
        return None
    def put(self, key, model):
        with self._lock:
            if key in self._cache: self._cache.move_to_end(key); return
            if len(self._cache) >= self.max_size:
                _, old = self._cache.popitem(last=False); del old; gc.collect(); torch.cuda.empty_cache()
            self._cache[key] = model
```
