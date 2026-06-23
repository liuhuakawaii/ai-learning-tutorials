# 性能分析报告

> 性能分析课程毕业项目：为一个真实 Web 项目完成完整的性能分析与优化报告。

## 快速开始

### 1. 选择分析目标

选择一个 Web 项目进行分析。推荐：

```bash
# 方式一：使用 Next.js 示例项目
npx create-next-app@latest perf-test-app
cd perf-test-app
npm run build
npm start

# 方式二：使用 Vue 示例项目
npm create vue@latest perf-test-app
cd perf-test-app
npm install
npm run dev
```

### 2. 安装 web-vitals

```bash
cd perf-test-app
npm install web-vitals
```

在入口文件中添加：

```ts
import { onCLS, onFID, onLCP, onINP } from 'web-vitals'

onCLS(console.log)
onFID(console.log)
onLCP(console.log)
onINP(console.log)
```

### 3. 按阶段完成分析报告

按照 `reports/` 目录下的 5 个阶段报告模板逐项完成。

## 本地检查

```bash
node scripts/check.js
```

## 项目结构

```
perf-analysis/
├── reports/
│   ├── stage1-performance.md    # Performance 面板分析
│   ├── stage2-memory.md         # Memory 面板分析
│   ├── stage3-lighthouse.md     # Lighthouse 审计
│   ├── stage4-web-vitals.md     # Web Vitals 实测
│   ├── stage5-optimization.md   # 优化方案与前后对比
│   └── screenshots/             # 分析截图
├── scripts/
│   └── check.js
└── README.md
```

## 课程阶段映射

| 阶段 | 能力 | 对应报告 |
|------|------|----------|
| 阶段一 | Performance 面板与火焰图 | `reports/stage1-performance.md` |
| 阶段二 | Memory 面板与堆快照 | `reports/stage2-memory.md` |
| 阶段三 | Lighthouse 审计与指标 | `reports/stage3-lighthouse.md` |
| 阶段四 | Web Vitals 实测与对比 | `reports/stage4-web-vitals.md` |
| 阶段五 | 优化策略与效果验证 | `reports/stage5-optimization.md` |

## 验收建议

1. 确认每个报告都有 Chrome DevTools 截图
2. 确认火焰图中有明确标注的性能问题
3. 确认 Lighthouse 报告包含各项指标得分
4. 确认优化前后有量化的数据对比
5. 运行 `node scripts/check.js` 确认所有报告文件存在
