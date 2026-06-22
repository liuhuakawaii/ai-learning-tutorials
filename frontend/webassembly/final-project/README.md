# WASM 多媒体处理平台

基于 WebAssembly 的浏览器端多媒体处理平台，使用 Vue3 + TypeScript 构建前端界面，Rust 编写高性能 Wasm 模块，通过 Web Worker 实现多线程并行处理。

## 功能模块

| 模块 | 说明 | 技术 |
|------|------|------|
| 图像处理 | 灰度化、模糊、锐化、边缘检测 | Rust + wasm-bindgen + Canvas API |
| 音频处理 | 波形可视化、音量调节、裁剪 | Rust + Web Audio API + SharedArrayBuffer |
| 文件压缩 | ZIP/GZIP 压缩与解压 | Rust miniz_oxide |
| 性能面板 | 实时处理速度、内存占用、线程状态 | Performance API |

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite
- **Wasm**：Rust + wasm-bindgen + wasm-pack
- **多线程**：Web Worker + SharedArrayBuffer + Atomics
- **测试**：Vitest + wasm-pack test

## 快速开始

```bash
# 安装依赖
npm install

# 编译 Wasm 模块（需要安装 wasm-pack）
npm run build:wasm

# 启动开发服务器
npm run dev

# 运行测试
npm run test

# 构建生产版本
npm run build
```

## 项目结构

```
├── src/                          # 前端源码
│   ├── main.ts                   # 应用入口
│   ├── App.vue                   # 根组件
│   ├── components/               # UI 组件
│   ├── workers/                  # Web Worker 线程池
│   ├── wasm/                     # Wasm 模块封装
│   ├── utils/                    # 工具函数
│   └── types/                    # TypeScript 类型定义
├── crates/                       # Rust Wasm 模块
│   ├── image-processor/          # 图像处理
│   ├── audio-processor/          # 音频处理
│   └── file-compressor/          # 文件压缩
├── tests/                        # 前端测试
├── scripts/                      # 验证脚本
└── reports/                      # 阶段报告
```

## 浏览器兼容性

- Chrome 57+（完整支持，含 SharedArrayBuffer）
- Firefox 79+
- Safari 15+
- Edge 79+

> 注意：SharedArrayBuffer 需要 HTTPS 环境和正确的 COOP/COEP 响应头。

## 验证

```bash
node scripts/check.cjs
```
