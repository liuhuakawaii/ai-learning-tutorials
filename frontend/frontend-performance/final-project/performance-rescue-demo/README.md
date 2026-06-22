# Performance Rescue Demo

这是前端性能课程的贯穿式实验项目。项目内置三个版本的同一类商品页面：

- `slow.html`：慢速基线，只用于测量和对照。
- `work.html`：练习页面，初始状态与慢速基线一致，建议在这里完成优化。
- `optimized.html`：优化参考，用于对照思路和结果。
- `monitor.html`：本地指标面板，读取浏览器 `localStorage` 中的 Web Vitals 和交互日志。

## 运行

```bash
pnpm install
pnpm start
```

打开：

- 慢速基线：http://localhost:4173/slow.html
- 练习页面：http://localhost:4173/work.html
- 优化参考：http://localhost:4173/optimized.html
- 本地监控：http://localhost:4173/monitor.html

## 学习流程

1. 第一阶段：审计 `slow.html`，记录 Lighthouse、Performance trace、Network waterfall、LCP 元素、CLS 来源和慢交互。
2. 第二阶段：在 `work.html` 上优化 LCP、CLS、阻塞资源和长任务。
3. 第三阶段：优化搜索、排序、加入购物车和大列表渲染。
4. 第四阶段：减少资源体积，治理第三方脚本，并定义缓存和预算。
5. 第五阶段：采集 Web Vitals，运行 Lighthouse CI，写回归报告。

## 常用命令

```bash
pnpm check
pnpm lhci
```

`pnpm lhci` 会启动本地服务并审计 `slow.html`、`work.html` 和 `optimized.html`。预算断言使用 warning，便于在学习过程中观察差异而不是直接中断。

## 交付物

把每个阶段的报告写在 `reports/`：

- `stage1-audit.md`
- `stage2-loading-before-after.md`
- `stage3-interaction-before-after.md`
- `stage4-assets-budget.md`
- `stage5-monitoring-report.md`
