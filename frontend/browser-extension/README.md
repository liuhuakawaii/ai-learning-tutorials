# 浏览器扩展开发

> 从零构建 Chrome/Firefox/Edge 浏览器扩展，掌握 Manifest V3、AI 集成、跨浏览器兼容与商业化运营。

## 课程定位

- **难度**：中级 → 高级
- **面向**：有 JavaScript/TypeScript 基础的前端开发者
- **课时**：30 课时（5 阶段 × 6 课时）
- **实战项目**：AI 阅读助手扩展（贯穿全课程）

## 学习路线

```
阶段 1：扩展基础（6 课时）
  ├── 理解扩展架构与 Manifest V3
  ├── 开发第一个扩展
  ├── 掌握 Content Script 注入与 DOM 操作
  ├── Background Service Worker 事件驱动模型
  ├── 三方消息通信机制
  └── 实战：网页高亮标注工具

阶段 2：高级 API（6 课时）
  ├── 存储 API（local/sync/session）
  ├── 网络拦截与请求修改
  ├── 标签页与窗口管理
  ├── 右键菜单与系统通知
  ├── 侧边栏与 DevTools 面板
  └── 实战：API 聚合面板

阶段 3：AI 浏览器扩展（6 课时）
  ├── 页面内容提取与清洗
  ├── LLM API 集成与流式输出
  ├── 划词翻译与全页翻译
  ├── 写作助手与语法检查
  ├── 语义搜索与知识图谱
  └── 实战：AI 阅读助手

阶段 4：扩展生态（6 课时）
  ├── 多浏览器兼容适配
  ├── 安全模型与代码审计
  ├── 性能优化策略
  ├── 自动化测试方案
  ├── 主流扩展框架（WXT/Plasmo/CRXJS）
  └── 实战：跨浏览器扩展

阶段 5：变现与增长（6 课时）
  ├── Chrome 应用商店上架与 ASO
  ├── 付费模式设计
  ├── 用户增长策略
  ├── 数据分析与留存优化
  ├── 规模化运营
  └── 实战：扩展商业化方案
```

## 课程结构

每课时包含：
- 场景引入：从真实问题出发
- 核心概念与代码示例
- 常见误区与工程建议
- 练习题与参考答案

每阶段末尾有实战项目，将该阶段知识综合运用。

## 前置要求

- JavaScript/TypeScript 基础
- HTML/CSS DOM 操作经验
- 基本的异步编程（Promise/async-await）
- 了解 HTTP 协议基础

## 技术栈

| 技术 | 用途 |
|------|------|
| Manifest V3 | 扩展配置规范 |
| TypeScript | 扩展开发语言 |
| Chrome Extensions API | 核心 API |
| WebExtensions API | 跨浏览器兼容 |
| WXT / Plasmo | 扩展开发框架 |
| Puppeteer | 自动化测试 |
| OpenAI / Claude API | AI 能力集成 |

## 目录结构

```
browser-extension/
├── README.md
├── stage1-extension-fundamentals/    # 扩展基础
│   ├── README.md
│   └── 01~06 课时
├── stage2-advanced-apis/             # 高级 API
│   ├── README.md
│   └── 01~06 课时
├── stage3-ai-extensions/             # AI 浏览器扩展
│   ├── README.md
│   └── 01~06 课时
├── stage4-extension-ecosystem/       # 扩展生态
│   ├── README.md
│   └── 01~06 课时
├── stage5-monetization/              # 变现与增长
│   ├── README.md
│   └── 01~06 课时
└── final-project/                    # 毕业项目
    ├── 项目说明.md
    ├── scripts/check.cjs
    └── reports/
```
