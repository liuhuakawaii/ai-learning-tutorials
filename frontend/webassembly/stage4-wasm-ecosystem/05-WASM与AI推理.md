# 05 - WASM 与 AI 推理：浏览器端的智能计算

## 场景引入

你的团队开发了一款图片编辑应用，需要在浏览器端实现实时人像分割。如果每张图片都上传到服务器推理，延迟高、消耗带宽，还涉及用户隐私。如果能在浏览器端直接运行 AI 模型，这些问题都能解决。但 JavaScript 的计算性能不足以支撑神经网络推理。

WASM 提供了完美方案：用 C++/Rust 编写的推理引擎编译为 WASM，在浏览器中以接近原生的速度执行。本课将介绍 ONNX Runtime Web、TensorFlow.js WASM 后端，以及模型优化和实际应用。

## 学习目标

- 理解浏览器端 AI 推理的需求和挑战
- 掌握 ONNX Runtime Web 的集成和使用
- 了解模型格式转换和量化优化
- 理解 WebGPU 与 WASM 的协作方式
- 能够实现实时图像分类应用

## 浏览器端 AI 推理需求

**低延迟**：无需网络往返，适合实时应用。**隐私保护**：数据不离开设备。**离线可用**：模型下载后无需网络。**降低服务器成本**：计算分散到用户设备。

挑战：浏览器计算能力有限、模型体积需控制、JavaScript 数值计算性能不足、WebGPU 支持不一致。

## ONNX Runtime Web

ONNX Runtime Web 是微软官方的浏览器端推理引擎，支持 WASM SIMD 和多线程。

```typescript
import * as ort from 'onnxruntime-web';

// 配置 WASM 后端
ort.env.wasm.numThreads = navigator.hardwareConcurrency;
ort.env.wasm.simd = true;

async function classifyImage(imageFile: File): Promise<{ classId: number; confidence: number }> {
  // 加载模型
  const session = await ort.InferenceSession.create('./mobilenetv2.onnx', {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  // 预处理图像
  const image = await loadImage(imageFile);
  const inputSize = 224;
  const inputData = preprocessImage(image, inputSize);
  const inputTensor = new ort.Tensor('float32', inputData, [1, 3, inputSize, inputSize]);

  // 推理
  const results = await session.run({ input: inputTensor });
  const output = results[session.outputNames[0]].data as Float32Array;

  // Softmax 获取概率
  const maxVal = Math.max(...output);
  const exps = output.map(v => Math.exp(v - maxVal));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map(v => v / sumExp);

  let maxProb = 0, maxIdx = 0;
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > maxProb) { maxProb = probs[i]; maxIdx = i; }
  }

  return { classId: maxIdx, confidence: maxProb };
}

function preprocessImage(image: HTMLImageElement, size: number): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const floatData = new Float32Array(3 * size * size);

  // 转 CHW 格式 + ImageNet 标准化
  for (let i = 0; i < size * size; i++) {
    floatData[i] = (data[i * 4] / 255 - 0.485) / 0.229;
    floatData[size * size + i] = (data[i * 4 + 1] / 255 - 0.456) / 0.224;
    floatData[2 * size * size + i] = (data[i * 4 + 2] / 255 - 0.406) / 0.225;
  }

  return floatData;
}
```

## TensorFlow.js WASM 后端

```typescript
import '@tensorflow/tfjs-backend-wasm';
import * as tf from '@tensorflow/tfjs';

async function initTfWasm() {
  await tf.setBackend('wasm');
  await tf.ready();
  console.log('后端:', tf.getBackend());
}

async function detectObjects(imageElement: HTMLImageElement) {
  const model = await tf.loadGraphModel(
    'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1',
    { fromTFHub: true }
  );

  const tensor = tf.browser.fromPixels(imageElement)
    .resizeBilinear([300, 300])
    .expandDims(0)
    .toFloat()
    .div(127.5)
    .sub(1);

  const predictions = model.predict(tensor) as tf.Tensor[];
  const boxes = await predictions[0].data();
  const scores = await predictions[1].data();

  tf.dispose([tensor, ...predictions]);
  return { boxes, scores };
}
```

## 模型格式转换

### PyTorch 到 ONNX

```python
import torch
import torchvision

model = torchvision.models.mobilenet_v2(pretrained=True)
model.eval()
dummy_input = torch.randn(1, 3, 224, 224)

torch.onnx.export(
    model, dummy_input, "mobilenet_v2.onnx",
    opset_version=13,
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
)
```

### INT8 量化

```python
from onnxruntime.quantization import quantize_dynamic, QuantType

quantize_dynamic(
    model_input="mobilenet_v2.onnx",
    model_output="mobilenet_v2_int8.onnx",
    weight_type=QuantType.QInt8,
)
# 体积减小 ~75%，推理加速 2-4 倍，精度损失通常 1-2%
```

## WebGPU 与 WASM 协作

WebGPU 提供浏览器端 GPU 计算能力，与 WASM 配合实现高性能推理：

```typescript
async function gpuInference(inputData: Float32Array): Promise<Float32Array> {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();

  const inputBuffer = device.createBuffer({
    size: inputData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(inputBuffer.getMappedRange()).set(inputData);
  inputBuffer.unmap();

  // 创建计算管线、绑定组、调度计算...
  // WebGPU 的并行计算能力特别适合矩阵运算密集的推理任务

  return new Float32Array(1000);
}
```

## 性能优化策略

**模型优化**：INT8 量化（体积减小 75%）、算子融合（Conv+BN+ReLU 合并）、模型剪枝、知识蒸馏。

**运行时优化**：WASM SIMD 加速、SharedArrayBuffer 多线程、模型预加载、输入缓存。

## 实际应用：实时视频推理

```typescript
class RealtimeDetector {
  private session: ort.InferenceSession | null = null;

  async init(modelPath: string) {
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'],
    });
  }

  async detect(videoFrame: HTMLVideoElement, canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(videoFrame, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const inputData = this.preprocess(imageData, 640);
    const inputTensor = new ort.Tensor('float32', inputData, [1, 3, 640, 640]);

    const start = performance.now();
    const results = await this.session!.run({ images: inputTensor });
    const inferenceTime = performance.now() - start;

    const detections = this.parseResults(results);
    this.drawDetections(ctx, detections, inferenceTime);
  }

  private preprocess(imageData: ImageData, size: number): Float32Array {
    // 缩放 + 归一化 + CHW 转换
    return new Float32Array(3 * size * size);
  }

  private parseResults(results: any) { return []; }

  private drawDetections(ctx: CanvasRenderingContext2D, detections: any[], time: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 10, 200, 30);
    ctx.fillStyle = '#0f0';
    ctx.font = '14px monospace';
    ctx.fillText(`推理: ${time.toFixed(1)}ms`, 20, 30);
  }
}
```

## 常见误区

### 误区一：WASM 推理速度等于原生

WASM 比 JavaScript 快很多，但与原生相比仍有 10-30% 差距。特别是涉及大量内存操作的任务，线性内存模型会带来额外开销。

### 误区二：所有模型都适合浏览器端运行

大型模型不适合浏览器。浏览器内存有限（通常 2-4GB），推荐使用 MobileNet、EfficientNet-Lite 等轻量模型。

### 误区三：量化不会影响精度

INT8 量化会引入精度损失，对细粒度分类影响较大。必须在目标数据集上验证。

### 误区四：WebGPU 已经完全可用

WebGPU 在 2023 年才开始在 Chrome 中支持，Firefox 和 Safari 仍在开发中。需要兼容性回退方案。

## 工程建议

1. **模型选择**：优先 MobileNet、EfficientNet-Lite 等轻量模型
2. **量化优先**：生产环境务必使用 INT8 量化
3. **Worker 隔离**：推理放在 Web Worker 中执行，避免阻塞 UI
4. **渐进式加载**：先加载轻量模型提供快速反馈，再加载更精确模型
5. **精度验证**：量化后必须在目标数据上验证精度

## 小结

- **ONNX Runtime Web** 是最成熟的浏览器端推理引擎
- **TensorFlow.js WASM 后端**提供简单易用的 API
- **模型格式转换**：PyTorch → ONNX → 量化 ONNX 是标准流程
- **WebGPU** 为 GPU 加速推理提供新可能
- **性能优化**：量化、算子融合、SIMD、多线程是关键手段

## 练习

### 练习一：ONNX Runtime Web 图像分类

创建网页，使用 ONNX Runtime Web 加载 MobileNet 模型，用户上传图片后显示 Top-5 分类结果和推理耗时。

### 练习二：模型量化对比

用 Python 将同一模型导出为 FP32 和 INT8 版本，对比文件大小和推理耗时。

### 练习三：实时视频推理

使用摄像头捕获视频流，实时进行目标检测，绘制检测框，显示 FPS。

---

## 参考答案

### 练习一

**思路**：ONNX Runtime Web 加载模型，Canvas 提取图片像素，推理后展示结果。

**答案**：

```typescript
import * as ort from 'onnxruntime-web';

async function classify(file: File) {
  const session = await ort.InferenceSession.create('./mobilenetv2.onnx');
  const img = await loadImage(file);
  const input = preprocessImage(img, 224);
  const tensor = new ort.Tensor('float32', input, [1, 3, 224, 224]);

  const start = performance.now();
  const results = await session.run({ input: tensor });
  const time = performance.now() - start;

  const output = results[session.outputNames[0]].data as Float32Array;
  const top5 = getTopK(output, 5);

  return { top5, inferenceTime: time };
}

function getTopK(data: Float32Array, k: number) {
  const maxVal = Math.max(...data);
  const exps = data.map(v => Math.exp(v - maxVal));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = new Float32Array(exps.map(v => v / sum));

  const indices = Array.from(probs.keys());
  indices.sort((a, b) => probs[b] - probs[a]);
  return indices.slice(0, k).map(i => ({ classId: i, prob: probs[i] }));
}
```

**要点**：ImageNet 标准化参数（mean=[0.485,0.456,0.406]，std=[0.229,0.224,0.225]）。

### 练习二

**思路**：onnxruntime.quantization 进行 INT8 量化，对比文件大小和推理时间。

**答案**：

```python
from onnxruntime.quantization import quantize_dynamic, QuantType
import onnxruntime as ort
import numpy as np
import time, os

# 量化
quantize_dynamic("mobilenet_v2.onnx", "mobilenet_v2_int8.onnx", QuantType.QInt8)

fp32_size = os.path.getsize("mobilenet_v2.onnx") / 1024 / 1024
int8_size = os.path.getsize("mobilenet_v2_int8.onnx") / 1024 / 1024
print(f"FP32: {fp32_size:.1f}MB, INT8: {int8_size:.1f}MB, 缩小: {(1-int8_size/fp32_size)*100:.0f}%")

# 对比推理时间
input_data = np.random.randn(1, 3, 224, 224).astype(np.float32)
for name, path in [("FP32", "mobilenet_v2.onnx"), ("INT8", "mobilenet_v2_int8.onnx")]:
    session = ort.InferenceSession(path)
    session.run(None, {"input": input_data})  # 预热
    times = []
    for _ in range(100):
        start = time.perf_counter()
        session.run(None, {"input": input_data})
        times.append(time.perf_counter() - start)
    print(f"{name}: {np.mean(times)*1000:.2f}ms")
```

**要点**：预热运行排除首次编译影响，100 次迭代取平均值。

### 练习三

**思路**：getUserMedia 获取摄像头流，逐帧推理绘制检测结果。

**答案**：

```typescript
import * as ort from 'onnxruntime-web';

class RealtimeDetector {
  private session: ort.InferenceSession | null = null;
  private fps = 0;
  private frameCount = 0;
  private lastTime = performance.now();

  async init(modelPath: string) {
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'],
    });
  }

  async start(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    await video.play();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d')!;
    const detect = async () => {
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 预处理 + 推理
      const input = this.preprocess(imageData, 640);
      const tensor = new ort.Tensor('float32', input, [1, 3, 640, 640]);
      const start = performance.now();
      const results = await this.session!.run({ images: tensor });
      const inferenceTime = performance.now() - start;

      // 更新 FPS
      this.frameCount++;
      if (performance.now() - this.lastTime >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastTime = performance.now();
      }

      // 绘制统计
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(10, 10, 220, 50);
      ctx.fillStyle = '#0f0';
      ctx.font = '14px monospace';
      ctx.fillText(`FPS: ${this.fps}`, 20, 32);
      ctx.fillText(`推理: ${inferenceTime.toFixed(1)}ms`, 20, 52);

      requestAnimationFrame(detect);
    };
    requestAnimationFrame(detect);
  }

  private preprocess(imageData: ImageData, size: number): Float32Array {
    return new Float32Array(3 * size * size);
  }
}
```

**要点**：`requestAnimationFrame` 配合逐帧推理实现实时检测。
