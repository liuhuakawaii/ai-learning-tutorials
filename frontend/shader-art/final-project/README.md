# 在线 Shader 创作工具

> Shader 艺术课程毕业项目：支持实时预览、参数调节、导出的在线 GLSL 编辑器。

## 快速开始

```bash
cd shader-lab
npm install
npm run dev
# 打开 http://localhost:5173
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Enter | 重新编译 Shader |
| Space | 暂停/恢复时间 |
| R | 重置时间 |
| F | 全屏预览 |
| Ctrl+S | 保存当前 Shader |
| Ctrl+E | 导出 PNG |

## 本地检查

```bash
node scripts/check.js
```

## 项目结构

```
shader-lab/
├── src/
│   ├── editor/            # 代码编辑器
│   │   ├── ShaderEditor.tsx
│   │   └── glsl-language.ts
│   ├── controls/          # 参数调节面板
│   │   ├── UniformPanel.tsx
│   │   ├── FloatSlider.tsx
│   │   └── ColorPicker.tsx
│   ├── shaders/           # 内置 Shader 库
│   │   ├── sdf.glsl
│   │   ├── fractal.glsl
│   │   ├── noise.glsl
│   │   ├── lighting.glsl
│   │   └── postprocess.glsl
│   ├── export/            # 导出功能
│   │   ├── png-export.ts
│   │   └── video-record.ts
│   ├── renderer/          # WebGL 渲染器
│   │   ├── ShaderProgram.ts
│   │   └── MultiPass.ts
│   └── App.tsx
├── scripts/
│   └── check.js
├── tests/
├── reports/
│   └── final-report.md
├── package.json
└── README.md
```

## 课程阶段映射

| 阶段 | 能力 | 对应代码 |
|------|------|----------|
| 阶段一 | GLSL 编译与实时渲染 | `src/editor/` + `src/renderer/` |
| 阶段二 | Uniform 参数与 UI 绑定 | `src/controls/` |
| 阶段三 | SDF、噪声、光照等着色器技术 | `src/shaders/` |
| 阶段四 | Canvas 导出与 MediaRecorder | `src/export/` |
| 阶段五 | 多 Pass 渲染与交互 | `src/renderer/MultiPass.ts` |

## 验收建议

1. 打开编辑器，确认 GLSL 语法高亮正常
2. 修改 fragment shader 中的颜色，确认预览实时更新
3. 故意写一个有语法错误的 Shader，确认错误提示正确
4. 点击一个内置 Shader 模板，确认加载后能正常渲染
5. 导出一张 PNG 图片，确认文件能正常打开
