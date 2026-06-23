# 10. 阶段项目：真实项目性能审计与优化

> Chrome DevTools + Lighthouse 完整性能审计实战——把前 9 课学到的方法用起来

## 本课目标

- 综合运用前 9 课所学，对一个真实项目进行完整的性能审计
- 掌握 Chrome DevTools 和 Lighthouse 的高级用法
- 建立系统化的性能审计流程
- 能够输出专业的性能优化报告

## 项目概述

你需要选择一个真实存在的前端项目，完成一次完整的性能审计与优化。

### 项目选择

```
推荐选择（按优先级）：
1. 你自己的项目（最了解代码，优化效果最可验证）
2. 团队中正在开发的项目（有实际价值）
3. 开源项目（方便展示和分享）

不推荐：
1. 纯静态页面（没有优化空间）
2. 过于简单的 demo（学不到东西）
3. 你无法修改代码的项目（无法验证优化效果）

理想的项目特征：
- 有一定复杂度（多个页面、多个组件）
- 有明显的性能问题（Lighthouse 分数 < 80）
- 使用 React 或 Vue
- 有路由、有列表、有图片
```

## 审计流程

### 第一步：基线测量

```
测量环境准备：
1. 关闭浏览器扩展（会干扰测量）
2. 使用 Chrome 无痕模式
3. 清除缓存（或使用 Disable cache 选项）
4. 准备网络限速（Fast 3G / Slow 4G）
5. 准备 CPU 限速（4x slowdown / 6x slowdown）
```

```bash
# 使用 Lighthouse CLI 运行测试
npx lighthouse https://example.com \
  --output=html \
  --output-path=./lighthouse-before.html \
  --chrome-flags="--headless --no-sandbox" \
  --preset=desktop

# 移动端
npx lighthouse https://example.com \
  --output=html \
  --output-path=./lighthouse-mobile-before.html \
  --chrome-flags="--headless --no-sandbox" \
  --preset=mobile
```

```
记录基线数据：

Lighthouse 分数：
  Performance: ___
  Accessibility: ___
  Best Practices: ___
  SEO: ___

Core Web Vitals：
  FCP: ___
  LCP: ___
  TBT: ___
  CLS: ___
  TTFB: ___

资源统计：
  JS 总体积: ___KB (___ 个文件)
  CSS 总体积: ___KB (___ 个文件)
  图片总体积: ___KB (___ 张)
  字体总体积: ___KB (___ 个文件)
  总请求: ___个

截图：
  Lighthouse 报告截图
  Network 面板瀑布图截图
  Performance 面板截图
```

### 第二步：问题分析

使用 Chrome DevTools 深入分析每个问题。

#### Network 面板分析

```
关注点：
1. 请求瀑布图
   - 有没有串行请求？
   - 有没有阻塞渲染的资源？
   - 缓存策略是否正确？

2. 资源体积
   - 最大的 JS/CSS 文件是什么？
   - 有没有未压缩的图片？
   - 有没有不必要的第三方脚本？

3. 请求时序
   - TTFB 是否合理？
   - 关键资源是否尽早加载？
   - 有没有 preload/prefetch？
```

#### Performance 面板分析

```
操作步骤：
1. 打开 Performance 面板
2. 点击 Record
3. 模拟用户操作（滚动、点击、输入）
4. 停止录制
5. 分析结果

关注点：
1. Main 线程活动
   - 有没有长任务（> 50ms）？
   - 长任务是什么代码导致的？
   - 有没有布局抖动？

2. 帧率
   - FPS 是否稳定在 60？
   - 什么操作导致掉帧？

3. 内存
   - 内存使用趋势
   - 有没有内存泄漏？
```

#### React/Vue DevTools 分析

```
React DevTools Profiler：
1. 开始录制
2. 执行交互操作
3. 停止录制
4. 查看火焰图
   - 哪些组件渲染时间最长？
   - 哪些组件不必要地重新渲染？
   - 哪些组件可以优化？

Vue DevTools：
1. 打开 Performance 面板
2. 记录组件渲染
3. 分析渲染次数和时间
```

### 第三步：实施优化

按影响程度排序，逐个实施优化。

```
优化清单（按优先级排序）：

网络层优化：
□ 检查并优化 HTTP 缓存策略
□ 配置资源预加载（preload 关键资源）
□ 配置预连接（preconnect 第三方源）
□ 启用 Brotli/Gzip 压缩
□ 优化第三方脚本加载

资源优化：
□ 图片格式转换（JPEG/PNG → WebP/AVIF）
□ 图片尺寸优化（响应式图片）
□ 图片懒加载（非首屏图片）
□ 字体子集化
□ 字体预加载

代码优化：
□ 代码分割（路由级分割）
□ 懒加载非首屏组件
□ 第三方库按需引入
□ Tree Shaking 检查
□ 移除未使用的代码

渲染优化：
□ 减少不必要的组件重渲染
□ 虚拟列表（大列表）
□ 避免强制同步布局
□ 使用 transform 代替 left/top 做动画
□ 合理使用 will-change

框架优化：
□ React.memo / useMemo / useCallback
□ Vue computed / v-memo
□ 避免在渲染中创建新对象/函数
□ 优化 Context/Store 更新范围
```

```
每个优化的记录格式：

优化项：[名称]
问题描述：[具体问题是什么]
优化方案：[怎么改]
代码改动：[改了哪些文件]
Before 数据：[优化前的指标]
After 数据：[优化后的指标]
效果：[改善了多少]
副作用：[有没有引入新问题]
```

### 第四步：验证和报告

```
验证步骤：
1. 重新运行 Lighthouse（相同条件）
2. 对比 before/after 数据
3. 在不同网络条件下测试
4. 在不同设备上测试
5. 检查有没有引入新问题（回归测试）

性能预算配置：
1. 基于优化后的指标设定预算
2. 配置 Lighthouse CI（如果项目使用 CI/CD）
3. 配置 Bundle 体积检查
```

## 输出要求

### 性能优化报告

```markdown
# 性能优化报告

## 1. 项目概况
- 项目名称：xxx
- 技术栈：React/Vue + xxx
- 页面数量：xxx
- 优化日期：xxx

## 2. 基线数据
### Lighthouse 分数
| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| Performance | 55 | 87 | +32 |
| FCP | 2.1s | 1.2s | -43% |
| LCP | 4.8s | 1.9s | -60% |
| TBT | 680ms | 180ms | -74% |
| CLS | 0.25 | 0.05 | -80% |

### 资源统计
| 类型 | 优化前 | 优化后 | 减少 |
|------|--------|--------|------|
| JS | 800KB | 280KB | -65% |
| CSS | 120KB | 45KB | -63% |
| 图片 | 2.5MB | 600KB | -76% |
| 请求数 | 45 | 22 | -51% |

## 3. 问题分析
### 问题一：LCP 元素是未优化的 Hero 图片
- LCP 元素：<img class="hero">
- 图片大小：800KB JPEG
- 没有 preload
- 没有使用现代格式

### 问题二：...

## 4. 优化方案
### 优化一：Hero 图片优化
- 转换为 WebP 格式（800KB → 200KB）
- 添加 preload（<link rel="preload">）
- 提供响应式图片（srcset + sizes）
- 效果：LCP 从 4.8s 降到 1.9s

### 优化二：...

## 5. 性能预算配置
[配置内容]

## 6. 后续建议
[进一步优化的方向]
```

### 验收标准

```
必须满足：
□ 提供完整的 Lighthouse before/after 报告
□ Lighthouse Performance 分数提升 ≥ 15 分
□ LCP 改善 ≥ 30%
□ 至少实施 5 项不同类型的优化
□ 每项优化都有 before/after 数据对比
□ 提供性能预算配置
□ 提供完整的优化报告

加分项：
□ 配置了 Lighthouse CI
□ 配置了 RUM 监控（web-vitals）
□ 在不同设备和网络条件下测试
□ 优化了运行时性能（不仅仅是加载性能）
□ 考虑了无障碍和 SEO
```

## Chrome DevTools 高级技巧

### Performance 面板深度分析

```
录制步骤：
1. 打开 Chrome DevTools → Performance 面板
2. 点击左上角的 Record 按钮（或 Ctrl+E）
3. 执行你要分析的操作（页面加载、点击、滚动）
4. 点击 Stop 录制

分析要点：
1. Main 线程火焰图
   - 每个横条代表一个任务
   - 红色三角形表示长任务（> 50ms）
   - 点击可以查看调用栈

2. 帧率（FPS）图表
   - 绿色区域表示 60fps
   - 红色区域表示掉帧
   - 掉帧处就是用户感知卡顿的地方

3. Network 时间线
   - 查看请求的时序关系
   - 红色线表示 DOMContentLoaded
   - 蓝色线表示 Load 事件

4. Timings 标记
   - LCP、FCP 等关键指标的时间点
   - 可以添加自定义标记
```

### Memory 面板分析

```
内存泄漏检测：
1. 打开 Memory 面板
2. 选择 Heap Snapshot
3. 执行操作（如打开/关闭弹窗）
4. 拍摄快照
5. 再次执行操作
6. 拍摄第二个快照
7. 对比两个快照，查看新增的对象

常见内存泄漏：
  - 事件监听器未移除
  - 定时器未清除
  - 闭包持有大对象
  - DOM 引用未释放
  - 全局变量累积
```

### Network 面板高级功能

```
1. 右键点击列头 → 选择 Priority 查看请求优先级
2. 使用 Throttle 模拟不同网络条件
3. 使用 Overrides 持久化本地修改
4. 导出 HAR 文件用于分享和分析
5. 使用 Initiator 列查看请求的触发链
```

## 常见优化案例

### 案例一：电商首页

```
问题：
  Lighthouse Performance: 45
  LCP: 6.8s (Hero banner)
  TBT: 890ms (大 JS bundle)
  CLS: 0.32 (动态广告位)

优化：
  1. Banner 图片 → WebP + preload
     LCP: 6.8s → 2.1s
  2. JS 代码分割 → 路由级分割
     TBT: 890ms → 220ms
  3. 广告位预留高度
     CLS: 0.32 → 0.05
  4. 第三方脚本延迟加载
     总 JS: 800KB → 350KB
  5. 图片懒加载
     首屏资源: 3.5MB → 800KB

结果：
  Lighthouse Performance: 45 → 88
```

### 案例二：管理后台

```
问题：
  页面切换卡顿
  大表格渲染慢
  内存占用持续增长

优化：
  1. 路由级代码分割
     首屏 JS: 1.2MB → 300KB
  2. 大表格虚拟滚动
     渲染时间: 2000ms → 50ms
  3. 修复内存泄漏（事件监听器未清理）
     内存占用: 持续增长 → 稳定
  4. 使用 React.memo 优化列表项
     列表滚动帧率: 30fps → 60fps

结果：
  首屏加载时间: 4s → 1.5s
  页面切换时间: 800ms → 200ms
  列表滚动: 60fps 稳定
```

## 案例三：内容型网站（博客/文档）

```
问题：
  Lighthouse Performance: 65
  FCP: 2.5s（渲染阻塞 CSS）
  LCP: 3.2s（首屏大图 + 字体加载慢）
  CLS: 0.18（图片无尺寸 + 字体替换）

优化：
  1. 关键 CSS 内联 + 非关键 CSS 异步加载
     FCP: 2.5s → 1.2s
  2. 首屏图片 WebP + preload
     LCP: 3.2s → 1.5s
  3. 字体子集化 + preload + font-display: swap
     字体加载时间: 800ms → 200ms
  4. 所有 <img> 添加 width/height
     CLS: 0.18 → 0.02
  5. 启用 Brotli 压缩
     总资源体积减少 20%

结果：
  Lighthouse Performance: 65 → 96
  所有 Core Web Vitals 达到 Good 标准
```

## 案例四：SPA 管理后台

```
问题：
  首屏白屏时间长（3.5s）
  大表格（5000 行）渲染卡顿
  内存持续增长

优化：
  1. 路由级代码分割 + 骨架屏
     首屏 JS: 1.5MB → 400KB
     白屏时间: 3.5s → 1.2s
  2. 大表格虚拟滚动
     渲染时间: 3000ms → 80ms
  3. 修复内存泄漏（WebSocket 未断开、事件监听器未清理）
     内存占用: 持续增长 → 稳定在 150MB

结果：
  首屏加载: 3.5s → 1.2s
  内存占用: 稳定
```

## 案例五：SaaS Dashboard

```
问题：
  Lighthouse Performance: 52
  多个图表库同时加载（ECharts + D3 + Chart.js）
  首屏加载了所有 Dashboard 组件（即使用户只看其中一个）
  第三方 SDK 占 40% 的 JS 体积

优化：
  1. 图表库统一为一个（ECharts），按需引入模块
     图表 JS: 800KB → 250KB
  2. Dashboard 组件按 Tab 懒加载
     首屏 JS: 1.2MB → 450KB
  3. 第三方 SDK（分析、客服、A/B 测试）延迟加载
     首屏 JS 再减 200KB
  4. API 响应启用协商缓存 + 前端 SWR 缓存
     重复访问 TTFB: 500ms → 50ms

结果：
  Lighthouse Performance: 52 → 91
  首屏 JS: 1.2MB → 250KB
  重复访问加载时间: 2s → 0.5s
```

## 性能优化的常见陷阱

```
陷阱一：过度优化
  症状：代码充满了 memo、useCallback、useMemo
  问题：可读性下降，维护成本增加
  建议：只优化测量出的瓶颈，不要凭预感优化

陷阱二：优化了错误的东西
  症状：Lighthouse 分数提升了，但用户体验没有改善
  问题：优化了 Lighthouse 关注的指标，但不是用户感知的瓶颈
  建议：关注 Core Web Vitals，而不是 Lighthouse 总分

陷阱三：只优化一次
  症状：优化后性能很好，三个月后又变差了
  问题：没有建立持续监控和预算机制
  建议：配置 Lighthouse CI + RUM 监控 + 性能预算

陷阱四：忽略了第三方脚本
  症状：自己的代码优化得很好，但页面仍然慢
  问题：第三方脚本（分析、广告、客服）占了 50% 的加载时间
  建议：审计所有第三方脚本，延迟加载非关键脚本

陷阱五：没有在真实设备上测试
  症状：开发环境很快，用户反馈很慢
  问题：只在高端设备上测试，没有考虑低端设备
  建议：用 Chrome DevTools 模拟低端设备，采集 RUM 数据

陷阱六：忽略 CLS（布局跳动）
  症状：页面加载时内容不断跳动
  问题：图片无尺寸、动态内容无预留空间、字体替换
  建议：所有媒体元素指定宽高、动态内容预留空间、字体 metrics 调整

陷阱七：过度依赖 CDN
  症状：CDN 配置了但性能没有明显改善
  问题：CDN 只减少了网络距离，不解决资源体积和请求数问题
  建议：CDN 是基础设施优化，还需要配合资源优化和代码优化
```

## 本课小结

```
性能审计的核心流程：

1. 测量 → 建立基线数据
2. 分析 → 找到真正的瓶颈
3. 优化 → 逐个解决问题
4. 验证 → 确认效果，没有回归

关键原则：
  - 没有数据就没有结论
  - 优化瓶颈，不是最容易改的点
  - 一次一个变量
  - 优化后必须验证
  - 建立预算防止退化

最终目标不是 Lighthouse 100 分，
而是让用户在任何设备、任何网络条件下都能获得良好的体验。
```

## 练习

### 完成项目审计

选择一个真实项目，按照上述流程完成性能审计。

提交内容：
1. Lighthouse before/after 报告（HTML 文件）
2. 优化报告（Markdown 格式）
3. 性能预算配置文件
4. 代码改动的 git diff 或 PR 链接

### 反思问题

在完成项目后，回答以下问题：

1. 你发现的最大瓶颈是什么？它是怎么影响用户体验的？
2. 哪个优化的效果最明显？为什么？
3. 有没有你尝试了但效果不明显的优化？为什么？
4. 如果只能做一个优化，你会选哪个？为什么？
5. 这个项目还需要进一步优化吗？瓶颈在哪里？

---

## 参考：审计检查清单

```markdown
## 加载性能检查清单

### 网络层
- [ ] HTML 使用协商缓存（no-cache）
- [ ] 静态资源使用长期缓存（max-age=1y + hash 文件名）
- [ ] API 响应缓存策略正确
- [ ] 启用 Brotli/Gzip 压缩
- [ ] 使用 CDN
- [ ] 预连接关键第三方源（preconnect）
- [ ] 预加载 LCP 资源（preload）

### 资源
- [ ] 图片使用现代格式（WebP/AVIF）
- [ ] 图片使用响应式（srcset + sizes）
- [ ] 非首屏图片使用懒加载
- [ ] LCP 图片没有使用懒加载
- [ ] 字体使用 woff2 格式
- [ ] 字体子集化（只加载需要的字符）
- [ ] 关键字体使用 preload
- [ ] font-display: swap 或 optional

### 代码
- [ ] 路由级代码分割
- [ ] 第三方库按需引入
- [ ] Tree Shaking 生效
- [ ] 没有未使用的代码
- [ ] Bundle 体积在预算内

## 运行时性能检查清单

### 渲染
- [ ] 没有强制同步布局
- [ ] 动画使用 transform/opacity
- [ ] 长列表使用虚拟滚动
- [ ] 没有不必要的重排

### 框架
- [ ] 避免不必要的组件重渲染
- [ ] 大型组件使用 memo
- [ ] 计算密集型操作使用 useMemo
- [ ] 作为 prop 传递的函数使用 useCallback

### 内存
- [ ] 事件监听器在组件卸载时清理
- [ ] 定时器在组件卸载时清理
- [ ] 没有闭包导致的内存泄漏
```

## 下一步

完成本阶段后，继续学习 [stage7：架构模式与状态管理](../stage7-architecture-patterns/README.md)。
