# 第一阶段：App Router 报告

## 场景引入

项目启动的第一步是搭建应用骨架。你需要决定哪些页面用路由组（Route Groups）组织、哪些组件放服务端、哪些放客户端，以及如何处理加载和错误状态。这些架构决策将影响后续所有阶段的开发效率和用户体验。

- 路由结构：`(auth)` 组路由（login/register）+ `(dashboard)` 组路由（projects/teams/settings）+ `admin` 路由
- Server Components：Dashboard layout、Projects page、Teams page、Settings page、Audit page 均为 Server Component
- Client Components：CreateProjectForm（需 useState 管理弹窗状态）
- loading/error/empty 状态：项目列表空态提示、表单校验错误提示、权限不足重定向

## 常见误区

1. **所有页面都用 `'use client'`**：Dashboard 的列表页、详情页等纯展示页面应该用 Server Component，只有需要交互（表单、弹窗、实时更新）的组件才标记为客户端组件。

2. **路由组命名不规范**：`(auth)` 和 `(dashboard)` 这样的语义化命名让路由结构一目了然，避免用 `(group1)`、`(group2)` 这种无意义命名。

3. **loading 状态只显示"加载中..."文字**：应该使用骨架屏（Skeleton）模拟页面结构，减少布局跳动和感知等待时间。

4. **错误页面没有提供重试操作**：error.tsx 应该展示友好的错误信息，并提供"重试"按钮，而不是只显示一个白屏或技术性错误信息。

## 工程建议

1. **Server Component 优先原则**：默认使用 Server Component，只在需要 `useState`、`useEffect`、事件处理等交互时才标记为 `'use client'`。

2. **每个路由组共享一个 layout.tsx**：`(dashboard)` 组的侧边栏导航放在 layout 中，避免每个页面重复编写。

3. **空态页面提供引导操作**：项目列表为空时，不要只显示"暂无数据"，应该展示一个"创建第一个项目"的按钮。

4. **用 `error.tsx` 的 `reset()` 函数实现自动重试**：Next.js 的 error boundary 提供 `reset()` 函数，调用后会重新渲染路由段。
