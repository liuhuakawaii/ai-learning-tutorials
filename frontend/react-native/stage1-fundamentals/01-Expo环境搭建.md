# Expo 环境搭建

## 从一个坑说起

"我 npm install 了，npm run start 了，模拟器打开了，然后……红屏。"

React Native 环境搭建的问题不在于步骤复杂，而在于出错时的排查路径不清晰。Node 版本不对、Java 环境缺失、Xcode 配置错误、端口被占用——每个坑都长得很像，但解法完全不同。

这节课的目标不是"照着做一遍"，而是让你理解每个组件的作用，出问题时知道往哪看。

## Expo vs Bare React Native

| 维度 | Expo | Bare RN |
|------|------|---------|
| 初始化 | 一条命令 30 秒 | 配置 Xcode/Android Studio |
| 原生模块 | `expo install` 添加 | 直接 link |
| 构建发布 | EAS Build 云端 | 本地构建 |
| OTA 更新 | 内置 | 需要第三方 |
| 适用 | 快速原型、中小型项目 | 深度定制原生能力 |

**核心优势**：不需要安装 Xcode 或 Android Studio 就能开发。Expo Go 扫码即预览。

## 环境搭建

### Node.js

Expo SDK 52+ 要求 Node >= 18。用 nvm 管理版本：

```bash
# 安装 nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 安装并使用 Node 20
nvm install 20
nvm use 20

# 验证
node --version  # v20.x.x
```

Windows 用 [nvm-windows](https://github.com/coreybutler/nvm-windows)。

### 创建项目

```bash
npx create-expo-app@latest my-app --template tabs
cd my-app
npx expo start
```

### 项目结构

```
my-app/
├── app/                    # 页面目录（Expo Router 文件路由）
│   ├── (tabs)/             # Tab 导航
│   │   ├── index.tsx       # 首页 Tab
│   │   └── _layout.tsx     # Tab 布局
│   ├── _layout.tsx         # 根布局
│   └── +not-found.tsx      # 404
├── assets/                 # 图片、字体
├── components/             # 可复用组件
├── hooks/                  # 自定义 Hooks
├── app.json                # Expo 配置
└── tsconfig.json
```

## 模拟器

### iOS（仅 macOS）

```bash
xcode-select --install
sudo xcodebuild -license accept
open -a Simulator
# Expo 中按 i 打开
```

### Android

```bash
# 安装 Android Studio
# More Actions → Virtual Device Manager → 创建 Pixel 7 + API 34
# Expo 中按 a 打开
```

## 真机调试（Expo Go）

最快的真机调试方式：

```bash
npx expo start
# iOS: 系统相机扫二维码
# Android: Expo Go 应用内扫码
```

WiFi 不通时用隧道：`npx expo start --tunnel`

## 热重载原理

Metro Bundler 监听文件变化 → 增量编译 → WebSocket 推送 → React Fast Refresh 接管。

Fast Refresh 会保留组件状态，但修改导出方式时状态会丢失（React 无法追踪组件身份）。

## 常见问题排查

### 端口被占

```bash
# macOS/Linux
lsof -i :8081
kill -9 <PID>

# Windows
netstat -ano | findstr :8081
taskkill /PID <PID> /F

# 或换端口
npx expo start --port 8082
```

### Android 模拟器连不上

```bash
adb reverse tcp:8081 tcp:8081
```

### 依赖冲突

```bash
rm -rf node_modules
npm cache clean --force
npm install
npx expo start --clear
```

## 练习

### 练习一：环境验证

创建 Expo 项目，在模拟器或 Expo Go 中看到默认页面。

### 练习二：项目结构

回答：`app/_layout.tsx` 的作用？`app.json` 中 `scheme` 字段的用途？删除 `app/(tabs)/_layout.tsx` 会怎样？

### 练习三：热重载

修改页面文本，保存后观察是否自动更新。页面上有计数器状态，修改文本后状态是否保留？

---

## 参考答案

### 练习一

```bash
npx create-expo-app@latest exercise --template tabs
cd exercise
npx expo start
# 按 i/a 或扫码
```

### 练习二

1. `app/_layout.tsx` 是根布局，定义所有页面共享的布局结构
2. `scheme` 是 Deep Linking 协议标识，用于外部链接跳转
3. 删除 `(tabs)/_layout.tsx` 后 Tab 导航失效，可能报布局错误

### 练习三

保存后毫秒级自动更新。计数器状态保留——Fast Refresh 只重新执行渲染函数，不重置 `useState`。
