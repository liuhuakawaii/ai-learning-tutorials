# React Native 移动端开发（30 课时）

> 基于 Expo 的跨平台移动应用开发课程，从基础到 AI 集成，最终完成可发布的完整 App。

## 课程定位

本课程面向有 React 基础的开发者，系统学习 React Native 移动端开发。课程以 Expo 为核心工具链，涵盖 UI 构建、导航管理、原生能力、AI 集成、应用发布五大模块，最终完成一个具备 AI 能力的移动端应用。

## 前置要求

- 熟悉 React（Hooks、组件化、状态管理）
- 了解 TypeScript 基础
- 有基本的命令行操作经验

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React Native + Expo SDK 52 |
| 导航 | Expo Router v4 |
| 状态管理 | Zustand + TanStack React Query |
| 动画 | React Native Reanimated 3 |
| 网络 | Axios + React Query |
| 本地存储 | MMKV + SQLite |
| AI | OpenAI API + expo-speech + on-device ML |
| 发布 | EAS Build + EAS Update |
| 监控 | Sentry |

## 目录结构

```
react-native-course/
├── README.md                          # 课程总览
├── stage1-fundamentals/               # Stage 1：Expo 基础（6 课时）
│   ├── README.md
│   ├── 01-Expo环境搭建.md
│   ├── 02-核心组件与样式.md
│   ├── 03-导航系统.md
│   ├── 04-状态管理.md
│   ├── 05-网络请求.md
│   └── 06-阶段实战-新闻阅读App.md
├── stage2-navigation-and-state/       # Stage 2：导航与状态（6 课时）
│   ├── README.md
│   ├── 01-深度导航配置.md
│   ├── 02-手势与动画.md
│   ├── 03-表单与输入.md
│   ├── 04-本地存储.md
│   ├── 05-推送通知.md
│   └── 06-阶段实战-任务管理App.md
├── stage3-native-modules/             # Stage 3：原生模块（6 课时）
│   ├── README.md
│   ├── 01-原生模块原理.md
│   ├── 02-Camera与图片.md
│   ├── 03-地图与定位.md
│   ├── 04-蓝牙与NFC.md
│   ├── 05-生物识别.md
│   └── 06-阶段实战-签到App.md
├── stage4-ai-mobile-integration/      # Stage 4：AI 移动端集成（6 课时）
│   ├── README.md
│   ├── 01-移动端AI推理.md
│   ├── 02-语音交互.md
│   ├── 03-图像识别.md
│   ├── 04-实时AI对话.md
│   ├── 05-离线AI能力.md
│   └── 06-阶段实战-AI助手App.md
├── stage5-publish-and-grow/           # Stage 5：发布与增长（6 课时）
│   ├── README.md
│   ├── 01-应用图标与启动屏.md
│   ├── 02-App-Store发布.md
│   ├── 03-OTA热更新.md
│   ├── 04-崩溃监控.md
│   ├── 05-性能优化.md
│   └── 06-阶段实战-正式发布.md
└── final-project/                     # 毕业项目
    ├── 项目说明.md
    ├── scripts/
    │   └── check.cjs
    └── reports/
        ├── stage1-report.md
        ├── stage2-report.md
        ├── stage3-report.md
        ├── stage4-report.md
        └── stage5-report.md
```

## 学习路线

```
Stage 1 ──→ Stage 2 ──→ Stage 3 ──→ Stage 4 ──→ Stage 5
Expo基础    导航与状态    原生模块    AI集成     发布与增长
  │           │           │           │           │
  ▼           ▼           ▼           ▼           ▼
新闻App    任务管理App   签到App    AI助手App   正式发布
```

## 课程项目

每阶段实战产出一个独立模块，最终合并为 **AI 智能助手 App**：

- Stage 1：新闻聚合阅读模块
- Stage 2：任务管理与提醒模块
- Stage 3：地理签到与生物识别模块
- Stage 4：AI 对话与图像识别模块
- Stage 5：应用发布与运维监控

## 环境要求

```bash
# Node.js 18+
node --version

# 安装 Expo CLI
npx create-expo-app@latest

# iOS 模拟器（macOS）
xcode-select --install

# Android 模拟器
# 安装 Android Studio，配置 AVD

# 真机调试
# 安装 Expo Go App
```
