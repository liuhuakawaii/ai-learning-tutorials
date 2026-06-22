# 06 - 阶段实战 - 完整 WASM 应用

## 场景引入

你已经学完了前五课的所有技能。现在把它们整合成毕业项目——"WASM 多媒体处理平台"。用户上传图片、音频和数据文件，用 WASM 核心进行高性能处理，并可视化结果。这一课教你如何把 WASM 模块集成到完整前端应用中，包括项目架构、构建部署、测试策略和文档发布。

## 学习目标

- 掌握 WASM 模块与 Vue3/React 的集成架构
- 学会设计可复用的 WASM 模块接口
- 掌握 WASM 应用的测试策略
- 学会构建与部署的完整流程

## 项目架构

```
wasm-multimedia-platform/
├── src/
│   ├── wasm-core/src/           # Rust WASM 核心
│   │   ├── lib.rs               # 入口（Platform 结构体）
│   │   ├── image/mod.rs         # 图像处理
│   │   ├── audio/mod.rs         # 音频处理
│   │   └── data/mod.rs          # 数据处理
│   └── web/src/                 # 前端（Vue3）
│       ├── composables/useWasm.ts
│       ├── components/
│       └── workers/image.worker.ts
├── tests/
├── scripts/build.sh
└── docs/
```

## WASM 核心模块

```rust
use wasm_bindgen::prelude::*;
mod image; mod audio; mod data;

#[wasm_bindgen]
pub struct Platform { image_engine: image::ImageEngine, audio_engine: audio::AudioEngine, data_engine: data::DataEngine }

#[wasm_bindgen]
impl Platform {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        console_error_panic_hook::set_once();
        Platform { image_engine: image::ImageEngine::new(), audio_engine: audio::AudioEngine::new(), data_engine: data::DataEngine::new() }
    }
    pub fn load_image(&mut self, data: &[u8], w: u32, h: u32) { self.image_engine.load(data, w, h); }
    pub fn apply_filter(&mut self, f: &str, p: &str) -> bool { self.image_engine.apply_filter(f, p) }
    pub fn get_image_data(&self) -> Vec<u8> { self.image_engine.get_pixels() }
    pub fn image_width(&self) -> u32 { self.image_engine.width() }
    pub fn image_height(&self) -> u32 { self.image_engine.height() }
    pub fn load_audio(&mut self, s: &[f32], r: u32) { self.audio_engine.load(s, r); }
    pub fn apply_audio_effect(&mut self, e: &str, p: &str) -> bool { self.audio_engine.apply_effect(e, p) }
    pub fn get_audio_samples(&self) -> Vec<f32> { self.audio_engine.get_samples() }
    pub fn load_dataset(&mut self, d: &[f64], c: u32) { self.data_engine.load(d, c); }
    pub fn aggregate(&self, c: u32, m: &str) -> f64 { self.data_engine.aggregate(c, m) }
}
```

## 图像处理模块

```rust
pub struct ImageEngine { pixels: Vec<u8>, width: u32, height: u32, history: Vec<Vec<u8>> }

impl ImageEngine {
    pub fn new() -> Self { ImageEngine { pixels: vec![], width: 0, height: 0, history: vec![] } }
    pub fn load(&mut self, data: &[u8], w: u32, h: u32) {
        self.width = w; self.height = h; self.pixels = data.to_vec();
        self.history.clear(); self.history.push(self.pixels.clone());
    }
    pub fn apply_filter(&mut self, filter: &str, params: &str) -> bool {
        self.history.push(self.pixels.clone());
        if self.history.len() > 20 { self.history.remove(0); }
        match filter {
            "brightness" => { let v: f32 = params.parse().unwrap_or(0.0); self.apply_brightness(v); true }
            "contrast" => { let v: f32 = params.parse().unwrap_or(1.0); self.apply_contrast(v); true }
            "grayscale" => { self.apply_grayscale(); true }
            _ => false,
        }
    }
    pub fn get_pixels(&self) -> Vec<u8> { self.pixels.clone() }
    pub fn width(&self) -> u32 { self.width }
    pub fn height(&self) -> u32 { self.height }

    fn apply_brightness(&mut self, v: f32) {
        for p in self.pixels.chunks_exact_mut(4) {
            p[0] = (p[0] as f32 + v).clamp(0.0, 255.0) as u8;
            p[1] = (p[1] as f32 + v).clamp(0.0, 255.0) as u8;
            p[2] = (p[2] as f32 + v).clamp(0.0, 255.0) as u8;
        }
    }
    fn apply_contrast(&mut self, f: f32) {
        for p in self.pixels.chunks_exact_mut(4) {
            p[0] = ((p[0] as f32 - 128.0) * f + 128.0).clamp(0.0, 255.0) as u8;
            p[1] = ((p[1] as f32 - 128.0) * f + 128.0).clamp(0.0, 255.0) as u8;
            p[2] = ((p[2] as f32 - 128.0) * f + 128.0).clamp(0.0, 255.0) as u8;
        }
    }
    fn apply_grayscale(&mut self) {
        for p in self.pixels.chunks_exact_mut(4) {
            let g = (0.2126 * p[0] as f32 + 0.7152 * p[1] as f32 + 0.0722 * p[2] as f32) as u8;
            p[0] = g; p[1] = g; p[2] = g;
        }
    }
}
```

## Vue3 集成

```typescript
// composables/useWasm.ts
import { ref, onMounted, shallowRef } from 'vue';

export function useWasm() {
  const wasm = shallowRef<any>(null);
  const isLoading = ref(true);
  onMounted(async () => {
    try { const { Platform } = await import('../../pkg/wasm_core'); wasm.value = new Platform(); }
    catch (e) { console.error('WASM 加载失败:', e); }
    finally { isLoading.value = false; }
  });
  return { wasm, isLoading };
}

// composables/useImageEditor.ts
import { ref, watch } from 'vue';

export function useImageEditor(wasm: any) {
  const params = ref({ brightness: 0, contrast: 1.0, grayscale: false });

  async function loadImage(file: File) {
    const img = new Image(); img.src = URL.createObjectURL(file);
    await new Promise(r => img.onload = r);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height);
    wasm.value.load_image(data.data, img.width, img.height);
  }

  function applyFilters() {
    const p = params.value;
    wasm.value.apply_filter('brightness', String(p.brightness));
    wasm.value.apply_filter('contrast', String(p.contrast));
    if (p.grayscale) wasm.value.apply_filter('grayscale', '');
    const pixels = wasm.value.get_image_data();
    const canvas = document.querySelector('#output') as HTMLCanvasElement;
    canvas.width = wasm.value.image_width(); canvas.height = wasm.value.image_height();
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), canvas.width, canvas.height), 0, 0);
  }

  watch(params, applyFilters, { deep: true });
  return { loadImage, params };
}
```

## Worker 线程处理

```typescript
// workers/image.worker.ts
let platform: any = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data;
  if (type === 'init') {
    const { Platform } = await import('../../pkg/wasm_core');
    platform = new Platform();
    self.postMessage({ type: 'ready' });
  } else if (type === 'applyFilter') {
    const t = performance.now();
    platform.apply_filter(payload.filterType, payload.params);
    const pixels = platform.get_image_data();
    self.postMessage({
      type: 'filtered', data: pixels.buffer,
      w: platform.image_width(), h: platform.image_height(),
      elapsed: performance.now() - t,
    }, [pixels.buffer]); // Transferable 避免拷贝
  }
};
```

## 测试策略

```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_brightness() {
        let mut e = ImageEngine::new(); e.load(&[100, 150, 200, 255], 1, 1);
        e.apply_filter("brightness", "50");
        let r = e.get_pixels(); assert_eq!(r[0], 150);
    }
    #[test]
    fn test_grayscale() {
        let mut e = ImageEngine::new(); e.load(&[255, 0, 0, 255], 1, 1);
        e.apply_filter("grayscale", "");
        let r = e.get_pixels(); assert_eq!(r[0], (0.2126 * 255.0) as u8);
    }
}
```

```typescript
// Playwright 集成测试
import { test, expect } from '@playwright/test';
test('WASM 加载成功', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-wasm]')?.textContent === 'ready');
});
```

## 构建与部署

```bash
#!/bin/bash
set -e
cd src/wasm-core && wasm-pack build --target web --release --out-dir ../../src/web/pkg
cd ../../src/web && npm run build
for f in dist/pkg/*.wasm; do wasm-opt -Oz "$f" -o "$f"; gzip -k -9 "$f"; done
echo "构建完成"; ls -lh dist/pkg/*.wasm
```

## 性能监控

```typescript
// composables/usePerformanceMonitor.ts
import { ref } from 'vue';

export function usePerformanceMonitor() {
  const entries = ref<{ op: string; ms: number }[]>([]);

  function record(op: string, ms: number) {
    entries.value.push({ op, ms });
    if (entries.value.length > 100) entries.value.shift();
  }

  const avg = () => entries.value.reduce((s, e) => s + e.ms, 0) / entries.value.length;

  return { entries, record, avg };
}
```

## 常见误区

1. **把所有逻辑都放进 WASM** — DOM 操作、事件处理留在 JS，WASM 只负责计算
2. **不处理加载失败** — 必须有 JS 回退方案
3. **在主线程处理大文件** — 必须用 Worker
4. **忽略 TypeScript 类型** — wasm-bindgen 生成的类型定义是接口契约

## 工程建议

1. **WASM 接口要稳定** — 变更走版本管理
2. **Worker + Transferable** — 大数据用 Transferable 避免拷贝
3. **渐进增强** — 检测 WASM 支持，不支持时降级到纯 JS
4. **CI/CD 集成 wasm-pack** — 自动构建和测试
5. **文档从 Rust docstring 生成** — 文档即代码

## 小结

WASM 模块是计算引擎，前端框架负责 UI，Worker 隔离计算线程。三者通过清晰接口协作。测试覆盖 Rust 单元测试、浏览器集成测试、性能基准三个维度。

## 练习

### 练习一：添加音频模块

扩展 Platform，实现音量调节、淡入淡出、反转效果。

### 练习二：撤销/重做系统

用命令模式实现多级撤销/重做，支持 Ctrl+Z / Ctrl+Y。

### 练习三：性能对比面板

左右对比纯 JS 和 WASM 滤镜的执行耗时。

---

## 参考答案

### 练习一

```rust
pub struct AudioEngine { samples: Vec<f32>, sample_rate: u32 }

impl AudioEngine {
    pub fn new() -> Self { AudioEngine { samples: vec![], sample_rate: 44100 } }
    pub fn load(&mut self, data: &[f32], rate: u32) { self.samples = data.to_vec(); self.sample_rate = rate; }
    pub fn apply_effect(&mut self, effect: &str, params: &str) -> bool {
        match effect {
            "volume" => { let v: f32 = params.parse().unwrap_or(1.0); self.samples.iter_mut().for_each(|s| *s *= v); true }
            "fade_in" => {
                let n = (params.parse::<f32>().unwrap_or(1.0) * self.sample_rate as f32) as usize;
                for (i, s) in self.samples.iter_mut().enumerate() { *s *= (i as f32 / n as f32).min(1.0); } true
            }
            "reverse" => { self.samples.reverse(); true }
            _ => false,
        }
    }
    pub fn get_samples(&self) -> Vec<f32> { self.samples.clone() }
}
```

**要点**：音频效果是逐样本操作，比图像的逐像素更简单。

### 练习二

```typescript
export function useHistory(maxSize = 30) {
  const undoStack = ref<Uint8Array[]>([]);
  const redoStack = ref<Uint8Array[]>([]);

  function push(pixels: Uint8Array) {
    undoStack.value.push(new Uint8Array(pixels));
    redoStack.value = [];
    if (undoStack.value.length > maxSize) undoStack.value.shift();
  }

  function undo(): Uint8Array | null {
    const entry = undoStack.value.pop();
    if (entry) { redoStack.value.push(entry); return undoStack.value.at(-1) ?? null; }
    return null;
  }

  function redo(): Uint8Array | null {
    const entry = redoStack.value.pop();
    if (entry) { undoStack.value.push(entry); return entry; }
    return null;
  }

  return { undoStack, redoStack, push, undo, redo };
}
```

**要点**：保存 Uint8Array 拷贝而非引用。

### 练习三

```typescript
import { ref } from 'vue';

export function useBenchmark() {
  const jsTime = ref(0), wasmTime = ref(0), speedup = ref(0);

  async function run(width: number, height: number) {
    const pixels = new Uint8Array(width * height * 4);
    crypto.getRandomValues(pixels);

    const jsP = new Uint8Array(pixels);
    const t1 = performance.now();
    for (let i = 0; i < jsP.length; i += 4) {
      jsP[i] = Math.min(255, jsP[i] + 50); jsP[i+1] = Math.min(255, jsP[i+1] + 50); jsP[i+2] = Math.min(255, jsP[i+2] + 50);
    }
    jsTime.value = performance.now() - t1;

    const { Platform } = await import('../../pkg/wasm_core');
    const p = new Platform(); p.load_image(pixels, width, height);
    const t2 = performance.now();
    p.apply_filter('brightness', '50');
    wasmTime.value = performance.now() - t2;
    speedup.value = jsTime.value / wasmTime.value;
  }
  return { jsTime, wasmTime, speedup, run };
}
```

**要点**：确保 JS 和 WASM 处理相同数据，测试条件一致。
