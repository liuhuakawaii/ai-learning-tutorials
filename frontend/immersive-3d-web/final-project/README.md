# 沉浸式 3D 品牌官网

> 沉浸式 3D Web 课程毕业项目：滚动叙事驱动的沉浸式品牌体验网站。

## 快速开始

```bash
cd brand-3d
npm install
npm run dev
# 打开 http://localhost:3000，滚动页面体验
```

## 本地检查

```bash
node scripts/check.js
```

## 项目结构

```
brand-3d/
├── src/
│   ├── sections/          # 滚动叙事场景
│   │   ├── Hero.tsx       # 首屏场景
│   │   ├── Story.tsx      # 品牌故事
│   │   ├── Product.tsx    # 产品展示
│   │   └── Contact.tsx    # 联系场景
│   ├── effects/
│   │   ├── particles.ts   # 粒子系统
│   │   ├── postprocessing.ts # 后处理
│   │   └── audio.ts       # 音画同步
│   ├── components/
│   │   ├── Canvas3D.tsx   # 3D 画布
│   │   ├── Loader.tsx     # 加载进度
│   │   └── ScrollProgress.tsx
│   ├── shaders/           # 自定义着色器
│   └── App.tsx
├── public/
│   ├── models/            # 3D 模型
│   └── textures/          # 纹理贴图
├── scripts/
│   └── check.js
├── reports/
│   └── final-report.md
├── package.json
└── README.md
```

## 课程阶段映射

| 阶段 | 能力 | 对应代码 |
|------|------|----------|
| 阶段一 | ScrollTrigger 驱动场景切换 | `src/sections/` |
| 阶段二 | 粒子系统与自定义着色器 | `src/effects/particles.ts` |
| 阶段三 | 后处理管线与视觉效果 | `src/effects/postprocessing.ts` |
| 阶段四 | Web Audio API 与可视化 | `src/effects/audio.ts` |
| 阶段五 | 加载优化与移动端适配 | `src/components/Loader.tsx` |

## 验收建议

1. 打开页面，滚动到底部，确认 4 个场景依次展示
2. 观察场景过渡是否有平滑的摄像机动画
3. 移动鼠标到粒子区域，确认粒子有扰动反应
4. 确认 Bloom 辉光效果在高亮区域可见
5. 在手机浏览器中打开，确认能正常滚动和查看
