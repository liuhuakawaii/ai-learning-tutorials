# 第6课：阶段实战——构建 3D 资产生成 Pipeline

## 场景引入

前 5 课我们分别学习了 3D 表示基础、NeRF、3D Gaussian Splatting、文本驱动 3D 生成、图像驱动 3D 重建。每一项技术都是独立的——你需要手动运行脚本、手动调参、手动导出格式。

现在想象你是创业团队的 CTO，产品是一个"AI 3D 资产生成平台"。用户在网页输入"一把蓝色水晶剑"或上传一张参考图，系统自动完成：文本理解 → 图像生成 → 多视图生成 → 3D 重建 → 纹理优化 → glTF 输出 → 浏览器预览。整个过程需要一个自动化、可配置、可扩展的 Pipeline。

本课将把前 5 课的技术串联成一个完整的端到端系统。我们将构建 6 个模块化组件，通过 YAML 配置驱动，支持批量处理、错误重试、API 接口。

## 学习目标

完成本课学习后，你将能够：

1. 设计一个模块化的 3D 资产生成 Pipeline 架构
2. 使用 YAML 配置系统实现模块可替换
3. 构建包含文本理解、图像生成、3D 重建的完整 Python Pipeline
4. 实现批量处理和任务队列机制
5. 设计 FastAPI 接口，提供上传图像→返回 3D 模型的 API 服务
6. 掌握错误处理、重试策略、质量检查等工程化实践

## 核心概念

### 一、Pipeline 架构总览

```
用户输入（文本 / 图像）
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  Pipeline 总控（orchestrator.py）                          │
│                                                           │
│  M1 文本理解  →  M2 图像生成  →  M3 预处理  →  M4 3D重建  │
│  (LLM)         (SDXL/Flux)    (抠图/缩放)   (TripoSR)    │
│                                                          │
│                            →  M5 后处理  →  M6 导出/Web   │
│                              (减面/法线)    (glTF+Three.js)│
│                                                           │
│  配置：pipeline.yaml  |  日志：结构化 JSON                  │
└──────────────────────────────────────────────────────────┘
```

### 二、模块化设计原则

3D 生成技术迭代极快——今天用 TripoSR，下周可能出更好的模型。如果代码和某个模型强耦合，每次替换都要改大量代码。核心设计原则：**每个环节可替换、可配置**。

```
模块化设计：

              Pipeline 定义（YAML）
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌────────┐    ┌────────┐    ┌────────┐
│ 接口层  │    │ 接口层  │    │ 接口层  │
│Abstract │    │Abstract │    │Abstract │
│Generator│    │Recon3D  │    │Renderer │
└────┬───┘    └────┬───┘    └────┬───┘
  ┌──┴──┐      ┌──┴──┐      ┌──┴──┐
  │SDXL │      │TriPo │      │Three│   ← 具体实现
  │Flux │      │InstM │      │Babyl│   ← 可替换
  └─────┘      └─────┘      └─────┘

配置文件驱动模块选择：
  image_generator: "flux"     # 换模型只改这一行
  reconstructor: "triposr"    # 换重建器只改这一行
```

### 三、配置系统设计

```yaml
# pipeline.yaml
pipeline:
  name: "3d-asset-generator"
  output_dir: "./output"
  log_level: "INFO"

modules:
  text_understanding:
    provider: "openai"
    model: "gpt-4o"
    api_key_env: "OPENAI_API_KEY"

  image_generator:
    provider: "flux"
    model: "flux.1-dev"
    num_inference_steps: 28
    guidance_scale: 3.5
    output_size: [1024, 1024]

  preprocessor:
    remove_background: true
    target_size: [512, 512]

  reconstructor:
    provider: "triposr"
    model_path: "stabilityai/TripoSR"
    mc_resolution: 256

  postprocessor:
    decimate_target: 50000
    recalculate_normals: true

  exporter:
    formats: ["glb", "obj"]

quality_check:
  min_vertices: 1000
  max_vertices: 500000
  watertight_required: false

batch:
  max_concurrent: 4
  retry_count: 3
  retry_delay_seconds: 5
  timeout_seconds: 300
```

### 四、错误处理与重试策略

3D 生成 Pipeline 中，错误不是"可能发生"而是"一定会发生"。GPU OOM、模型加载失败、输入图像异常、网络超时——每个环节都可能出错。

```
错误处理策略：
┌─────────────┬────────────────────┬──────────────────────┐
│ 错误类型     │ 处理策略            │ 示例                  │
├─────────────┼────────────────────┼──────────────────────┤
│ 可恢复错误   │ 指数退避重试        │ OOM → 降分辨率重试    │
│ 不可恢复错误 │ 跳过+记录+通知      │ 输入图像损坏          │
│ 模型错误     │ 切换备用模型        │ TripoSR失败→用Instant │
│ 超时         │ 终止+记录           │ 推理超过5分钟         │
└─────────────┴────────────────────┴──────────────────────┘

重试（指数退避）：第1次失败→等2s | 第2次→等4s | 第3次→标记失败
```

## 代码实战

### 一、模块接口定义

```python
"""Pipeline 模块接口——所有模块必须实现对应的抽象基类"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional
from PIL import Image


@dataclass
class PipelineContext:
    """Pipeline 上下文，在各模块之间传递数据"""
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
    """Pipeline 模块基类"""
    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    def execute(self, ctx: PipelineContext) -> PipelineContext:
        """执行模块逻辑，返回更新后的上下文"""

class TextUnderstandingModule(BaseModule): ...
class ImageGeneratorModule(BaseModule): ...
class PreprocessorModule(BaseModule): ...
class Reconstructor3DModule(BaseModule): ...
class PostprocessorModule(BaseModule): ...
class ExporterModule(BaseModule): ...
```

### 二、核心模块实现

```python
"""核心 Pipeline 模块实现"""

import io, time, logging
from pathlib import Path
from PIL import Image

logger = logging.getLogger(__name__)


class GPTTextUnderstanding(TextUnderstandingModule):
    """LLM 将用户描述转为结构化 prompt"""
    def execute(self, ctx):
        if ctx.input_text is None:
            return ctx
        from openai import OpenAI
        import json
        client = OpenAI(api_key=self.config.get("api_key"))
        response = client.chat.completions.create(
            model=self.config.get("model", "gpt-4o"),
            messages=[
                {"role": "system", "content": "将描述转为图像生成prompt，输出JSON: {prompt, negative_prompt}"},
                {"role": "user", "content": ctx.input_text},
            ],
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
        ctx.prompt = result.get("prompt", ctx.input_text)
        ctx.metadata["negative_prompt"] = result.get("negative_prompt", "")
        return ctx


class FluxImageGenerator(ImageGeneratorModule):
    """Flux 模型生成图像"""
    def __init__(self, config):
        super().__init__(config)
        self._pipe = None

    def _load(self):
        if self._pipe is None:
            from diffusers import FluxPipeline
            import torch
            self._pipe = FluxPipeline.from_pretrained(
                self.config.get("model", "black-forest-labs/FLUX.1-dev"),
                torch_dtype=torch.bfloat16,
            )
            self._pipe.to("cuda")
        return self._pipe

    def execute(self, ctx):
        if ctx.input_image is not None:
            return ctx
        pipe = self._load()
        image = pipe(
            prompt=ctx.prompt,
            negative_prompt=ctx.metadata.get("negative_prompt", ""),
            num_inference_steps=self.config.get("num_inference_steps", 28),
            guidance_scale=self.config.get("guidance_scale", 3.5),
        ).images[0]
        ctx.generated_image = image
        return ctx


class RembgPreprocessor(PreprocessorModule):
    """背景移除 + 尺寸归一化"""
    def execute(self, ctx):
        import rembg
        source = ctx.input_image or ctx.generated_image
        if source is None:
            ctx.errors.append("预处理: 无输入图像"); return ctx
        if self.config.get("remove_background", True):
            buf = io.BytesIO(); source.save(buf, format="PNG")
            source = Image.open(io.BytesIO(rembg.remove(buf.getvalue()))).convert("RGBA")
        target = tuple(self.config.get("target_size", [512, 512]))
        ctx.preprocessed_image = source.resize(target, Image.LANCZOS)
        return ctx


class TripoSRReconstructor(Reconstructor3DModule):
    """TripoSR 前馈 3D 重建"""
    def __init__(self, config):
        super().__init__(config)
        self._model = None

    def _load(self):
        if self._model is None:
            from tsr.system import TSR
            self._model = TSR.from_pretrained(
                self.config.get("model_path", "stabilityai/TripoSR"),
                config_name="config.yaml", weight_name="model.ckpt",
            )
            self._model.renderer.set_chunk_size(8192)
            self._model.to("cuda").eval()
        return self._model

    def execute(self, ctx):
        import torch, trimesh
        model = self._load()
        image = ctx.preprocessed_image
        if image is None:
            ctx.errors.append("3D重建: 无预处理图像"); return ctx
        if image.mode != "RGBA":
            image = image.convert("RGBA")
        with torch.no_grad():
            codes = model([image], device=model.device)
            meshes = model.extract_mesh(codes, resolution=self.config.get("mc_resolution", 256))
        mesh = meshes[0]
        ctx.mesh_path = str(Path(ctx.metadata["output_dir"]) / "raw_mesh.obj")
        mesh.export(ctx.mesh_path)
        ctx.metadata["vertex_count"] = len(mesh.vertices)
        ctx.metadata["face_count"] = len(mesh.faces)
        return ctx


class TrimeshPostprocessor(PostprocessorModule):
    """网格后处理：减面、法线修复"""
    def execute(self, ctx):
        import trimesh
        if ctx.mesh_path is None:
            ctx.errors.append("后处理: 无网格"); return ctx
        mesh = trimesh.load(ctx.mesh_path, force="mesh")
        if self.config.get("recalculate_normals", True):
            mesh.fix_normals()
        target = self.config.get("decimate_target", 50000)
        if len(mesh.faces) > target:
            mesh = mesh.simplify_quadric_decimation(target)
        out = str(Path(ctx.metadata["output_dir"]) / "processed.obj")
        mesh.export(out)
        ctx.mesh_path = out
        return ctx


class GLTFExporter(ExporterModule):
    """导出 glTF/OBJ"""
    def execute(self, ctx):
        import trimesh
        if ctx.mesh_path is None:
            ctx.errors.append("导出: 无网格"); return ctx
        mesh = trimesh.load(ctx.mesh_path, force="mesh")
        out_dir = Path(ctx.metadata["output_dir"])
        for fmt in self.config.get("formats", ["glb", "obj"]):
            path = out_dir / f"model.{fmt}"
            mesh.export(str(path), file_type=fmt)
            ctx.output_paths[fmt] = str(path)
        return ctx
```

### 三、Pipeline 编排器

```python
"""Pipeline 编排器：加载配置、组装模块、执行、错误重试"""

import uuid, time, yaml, logging, concurrent.futures
from typing import Optional
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

MODULE_REGISTRY = {
    "text_understanding": {"openai": GPTTextUnderstanding},
    "image_generator":    {"flux": FluxImageGenerator},
    "preprocessor":       {"rembg": RembgPreprocessor},
    "reconstructor":      {"triposr": TripoSRReconstructor},
    "postprocessor":      {"trimesh": TrimeshPostprocessor},
    "exporter":           {"gltf": GLTFExporter},
}

PIPELINE_STAGES = ["text_understanding", "image_generator", "preprocessor",
                   "reconstructor", "postprocessor", "exporter"]


class Pipeline:
    def __init__(self, config_path: str = "pipeline.yaml"):
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)
        self.modules = {}
        self._init_modules()

    def _init_modules(self):
        for stage in PIPELINE_STAGES:
            cfg = self.config.get("modules", {}).get(stage, {})
            provider = cfg.get("provider", "default")
            cls = MODULE_REGISTRY.get(stage, {}).get(provider)
            if cls:
                self.modules[stage] = cls(cfg)
                logger.info(f"初始化: {stage} → {cls.__name__}")

    def run(self, input_text=None, input_image=None, image_path=None) -> PipelineContext:
        """执行完整 Pipeline"""
        task_id = uuid.uuid4().hex[:8]
        out_dir = Path(self.config["pipeline"]["output_dir"]) / task_id
        out_dir.mkdir(parents=True, exist_ok=True)

        if image_path and input_image is None:
            input_image = Image.open(image_path).convert("RGB")

        ctx = PipelineContext(task_id=task_id, input_text=input_text,
                              input_image=input_image, metadata={"output_dir": str(out_dir)})

        batch_cfg = self.config.get("batch", {})
        max_retries = batch_cfg.get("retry_count", 3)
        retry_delay = batch_cfg.get("retry_delay_seconds", 2)

        logger.info(f"=== Pipeline 开始: {task_id} ===")
        start = time.time()

        for stage in PIPELINE_STAGES:
            module = self.modules.get(stage)
            if not module:
                continue
            if stage == "text_understanding" and ctx.input_text is None:
                continue
            if stage == "image_generator" and ctx.input_image is not None:
                continue

            for attempt in range(max_retries + 1):
                try:
                    ctx = module.execute(ctx)
                    break
                except Exception as e:
                    if attempt < max_retries:
                        wait = retry_delay * (2 ** attempt)
                        logger.warning(f"[{task_id}] {stage} 失败: {e}, {wait}s后重试")
                        time.sleep(wait)
                    else:
                        ctx.errors.append(f"{stage} 最终失败: {e}")

            if ctx.errors and stage in ("reconstructor", "preprocessor"):
                logger.error(f"[{task_id}] Pipeline 因 {stage} 终止")
                break

        elapsed = time.time() - start
        ctx.metadata["elapsed_seconds"] = elapsed
        logger.info(f"=== 结束: {task_id} | {elapsed:.1f}s | 错误: {len(ctx.errors)} ===")
        return ctx

    def run_batch(self, tasks: list) -> list:
        """批量执行"""
        max_workers = self.config.get("batch", {}).get("max_concurrent", 2)
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
            futures = {ex.submit(self.run, t.get("text"), image_path=t.get("image_path")): i
                       for i, t in enumerate(tasks)}
            for f in concurrent.futures.as_completed(futures):
                idx = futures[f]
                try:
                    results.append({"index": idx, "ctx": f.result(), "status": "success"})
                except Exception as e:
                    results.append({"index": idx, "error": str(e), "status": "failed"})
        logger.info(f"批量完成: {sum(1 for r in results if r['status']=='success')}/{len(tasks)}")
        return results
```

### 四、FastAPI 接口服务

```python
"""FastAPI 接口：上传图片→返回3D模型。运行: uvicorn api_server:app --port 8000"""

import io, uuid, asyncio
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

class TaskResult(BaseModel):
    task_id: str; status: str; model_url: Optional[str] = None
    error: Optional[str] = None; metadata: dict = {}

task_store: dict[str, TaskResult] = {}
pipeline_instance = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline_instance; pipeline_instance = Pipeline("pipeline.yaml"); yield

app = FastAPI(title="3D Asset Generator", lifespan=lifespan)
app.mount("/outputs", StaticFiles(directory="output"), name="outputs")

@app.post("/api/generate")
async def generate_from_text(prompt: str = Form(...)):
    task_id = uuid.uuid4().hex[:8]
    try:
        ctx = await asyncio.to_thread(pipeline_instance.run, input_text=prompt)
        result = TaskResult(task_id=task_id, status="completed",
            model_url=f"/outputs/{ctx.task_id}/model.glb",
            metadata={"elapsed": ctx.metadata.get("elapsed_seconds")})
    except Exception as e:
        raise HTTPException(500, str(e))
    task_store[task_id] = result; return result

@app.post("/api/upload")
async def generate_from_image(file: UploadFile = File(...)):
    from PIL import Image
    image = Image.open(io.BytesIO(await file.read())).convert("RGB")
    task_id = uuid.uuid4().hex[:8]
    try:
        ctx = await asyncio.to_thread(pipeline_instance.run, input_image=image)
        result = TaskResult(task_id=task_id, status="completed",
            model_url=f"/outputs/{ctx.task_id}/model.glb",
            metadata={"vertices": ctx.metadata.get("vertex_count"), "faces": ctx.metadata.get("face_count")})
    except Exception as e:
        raise HTTPException(500, str(e))
    task_store[task_id] = result; return result

@app.get("/api/task/{task_id}")
async def get_status(task_id: str):
    if task_id not in task_store: raise HTTPException(404, "任务不存在")
    return task_store[task_id]
```

### 五、质量检查与使用示例

```python
"""质量检查 + 使用示例"""

import trimesh
from pathlib import Path

class QualityChecker:
    def __init__(self, config): self.config = config
    def check(self, mesh_path):
        mesh = trimesh.load(mesh_path, force="mesh")
        checks = []
        v = len(mesh.vertices)
        checks.append({"name": "顶点", "passed": 1000 <= v <= 500000, "detail": str(v)})
        checks.append({"name": "面数", "passed": 500 <= len(mesh.faces) <= 1000000, "detail": str(len(mesh.faces))})
        size_mb = Path(mesh_path).stat().st_size / (1024*1024)
        checks.append({"name": "大小", "passed": size_mb <= 50, "detail": f"{size_mb:.1f}MB"})
        return {"passed": all(c["passed"] for c in checks), "checks": checks}

def check_and_report(mesh_path, config):
    r = QualityChecker(config).check(mesh_path)
    print(f"\n质量检查: {mesh_path}")
    for c in r["checks"]: print(f"  {'✓' if c['passed'] else '✗'} {c['name']}: {c['detail']}")
    return r["passed"]

# 使用示例
pipeline = Pipeline("pipeline.yaml")
ctx = pipeline.run(input_text="一把蓝色水晶魔法剑")
print(f"输出: {ctx.output_paths}, 耗时: {ctx.metadata.get('elapsed_seconds', 0):.1f}s")

ctx2 = pipeline.run(image_path="product_photo.jpg")
results = pipeline.run_batch([{"text": "魔法剑"}, {"image_path": "chair.jpg"}])
```

## 常见误区

### 1. 模块之间过度耦合

**误区：** "所有代码写在一个大函数里，反正流程是固定的。"

**纠正：** 3D 生成技术迭代极快，三个月前的最佳模型可能已被超越。定义清晰的模块接口（BaseModule + PipelineContext），更换模型时只需实现新模块并修改配置文件。

### 2. 忽视错误处理和重试

**误区：** "模型推理应该不会出错。"

**纠正：** GPU OOM、输入图像质量差、网络超时、模型加载失败——每个环节都可能出错。Pipeline 需要三级错误处理：可恢复错误自动重试（指数退避）、不可恢复错误记录并跳过、严重错误终止任务。

### 3. 不做质量检查就输出

**误区：** "模型跑完了就直接返回给用户。"

**纠正：** AI 生成的 3D 模型质量波动很大。QualityChecker 验证顶点数、面数、文件大小、流形性，不满足条件的模型应标记为"需人工审核"。

### 4. 批量处理不做并发控制

**误区：** "批量任务全部并发执行，速度最快。"

**纠正：** GPU 显存有限，同时加载多个模型实例容易 OOM。通过 `max_concurrent` 控制并发数，通过模型复用（全局加载一次）平衡速度和资源。

### 5. 配置硬编码在代码里

**误区：** "模型路径、参数直接写在 Python 文件里就行。"

**纠正：** Pipeline 需要在不同环境（开发机、GPU 服务器、CI/CD）中运行。YAML 配置文件将环境参数与代码分离，敏感信息用环境变量管理。

## 小结

本课构建了一个完整的 3D 资产生成 Pipeline：

- **模块接口**：BaseModule + PipelineContext，实现模块可替换
- **6 个功能模块**：文本理解、图像生成、预处理、3D 重建、后处理、导出
- **编排器**：配置驱动、错误重试、批量处理
- **FastAPI 接口**：文本/图像输入 → REST API → 3D 模型 URL
- **质量检查**：多维度验证，确保输出满足工程要求

这个 Pipeline 是一个起点——你可以替换任何模块（如 TripoSR→InstantMesh）、增加新模块（自动 UV、PBR 材质）、或扩展 API（WebSocket 实时进度）。

## 练习

### 练习一：添加 SDXL 图像生成模块

**题目**：为 Pipeline 添加 `SDXLImageGenerator`，使用 Stable Diffusion XL 作为图像生成后端。实现 `ImageGeneratorModule` 接口，配置中可通过 `provider: "sdxl"` 切换。

**思路**：参考 FluxImageGenerator，将 FluxPipeline 替换为 StableDiffusionXLPipeline。SDXL 的 guidance_scale 推荐 7-9（Flux 用 3-4）。

**答案**：

```python
from diffusers import StableDiffusionXLPipeline
import torch

class SDXLImageGenerator(ImageGeneratorModule):
    def __init__(self, config): super().__init__(config); self._pipe = None
    def _load(self):
        if self._pipe is None:
            self._pipe = StableDiffusionXLPipeline.from_pretrained(
                self.config.get("model", "stabilityai/stable-diffusion-xl-base-1.0"),
                torch_dtype=torch.float16, variant="fp16").to("cuda")
        return self._pipe
    def execute(self, ctx):
        if ctx.input_image is not None: return ctx
        image = self._load()(prompt=ctx.prompt, num_inference_steps=self.config.get("num_inference_steps", 50),
            guidance_scale=self.config.get("guidance_scale", 7.5)).images[0]
        ctx.generated_image = image; return ctx
```

**要点**：SDXL 用 float16（Flux 用 bfloat16）；注册后配置改 `provider: "sdxl"` 即可切换。

### 练习二：实现模块降级策略

**题目**：修改 Pipeline 编排器，当主模块（TripoSR）失败后自动切换备用模块（InstantMesh）。通过配置文件的 `fallback` 字段控制降级链。

**思路**：配置增加 `fallback` 字段；Pipeline 执行时捕获异常后查找 fallback 模块。

**答案**：

```yaml
modules:
  reconstructor:
    provider: "triposr"
    fallback: "instantmesh"
```

```python
def run_stage_with_fallback(self, stage_name, ctx):
    cfg = self.config["modules"].get(stage_name, {})
    provider, fallback = cfg.get("provider"), cfg.get("fallback")
    module = self.modules.get(stage_name)
    if module:
        try: return module.execute(ctx)
        except Exception as e:
            logger.warning(f"{provider} 失败: {e}")
    if fallback:
        fb_cls = MODULE_REGISTRY.get(stage_name, {}).get(fallback)
        if fb_cls: return fb_cls(cfg).execute(ctx)
    raise RuntimeError(f"{stage_name} 所有模块均失败")
```

**要点**：降级事件应记录日志并上报监控；fallback 链可递归（A→B→C）但注意总超时；降级模块质量可能较低，需在输出中标记。

### 练习三：设计 LRU 模型缓存

**题目**：当前 Pipeline 每次运行都重新加载模型。设计 LRU 模型缓存：首次加载后缓存在内存，后续复用。支持最大缓存数限制和淘汰策略。

**思路**：用 `OrderedDict` 实现 LRU，以模型路径为 key，淘汰时释放 GPU 显存。

**答案**：

```python
from collections import OrderedDict
import threading

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
                _, old = self._cache.popitem(last=False)
                import gc, torch; del old; gc.collect(); torch.cuda.empty_cache()
            self._cache[key] = model

# 在 TripoSRReconstructor._load() 中先查缓存，未命中再加载
```

**要点**：淘汰时必须 `torch.cuda.empty_cache()` 释放显存；缓存大小按 GPU 显存设置（通常 1-3 个模型）；线程安全是必须的——批量处理时多线程并发访问。

---

**Files touched**: `D:\CODE\personal-project\ai-learning-tutorials\ai-specialization\ai-3d-digital-human\part1-3d-asset-generation\06-阶段实战-构建3D资产生成Pipeline.md`
**Findings worth promoting**: (none)
