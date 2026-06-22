# Expo 环境搭建

## 场景引入

你刚接手一个 React Native 项目，团队决定使用 Expo 作为开发框架。你需要在自己的电脑上搭建完整的开发环境，让项目能在模拟器和真机上跑起来。听起来简单，但 Node 版本不对、Java 环境缺失、Xcode 配置错误……这些坑几乎每个新手都会踩一遍。这节课我们从零开始，把环境一次性搭对。

## 学习目标

- 理解 Expo 与 bare React Native 的区别和选型依据
- 掌握 Expo CLI 的安装与项目创建
- 配置 iOS/Android 模拟器并运行项目
- 使用 Expo Go 在真机上调试
- 理解项目目录结构各文件的作用
- 掌握热重载原理与常见环境问题排查

---

## 一、为什么选择 Expo

React Native 有两种开发模式：

| 对比维度 | Expo（Managed Workflow） | Bare React Native |
|---------|------------------------|-------------------|
| 初始化速度 | 一条命令，30 秒 | 需要配置 Xcode/Android Studio |
| 原生模块 | 通过 expo install 添加 | 直接 link 原生代码 |
| 构建发布 | EAS Build 云端构建 | 本地构建 |
| OTA 更新 | 内置支持 | 需要第三方方案 |
| 适用场景 | 快速原型、中小型项目 | 深度定制原生能力 |

**Expo 的核心优势**：你不需要安装 Xcode 或 Android Studio 就能开始开发。通过 Expo Go 客户端，扫码即可在真机上预览。

---

## 二、环境准备

### 2.1 Node.js 安装

Expo SDK 52+ 要求 Node.js >= 18。推荐使用 nvm 管理版本：

```bash
# macOS / Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20

# Windows（使用 nvm-windows）
# 下载 https://github.com/coreybutler/nvm-windows/releases
nvm install 20
nvm use 20
```

验证安装：

```bash
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 2.2 Expo CLI 安装

```bash
npm install -g expo-cli
# 或使用 npx（推荐，无需全局安装）
npx expo --version
```

### 2.3 Expo 账号注册

```bash
# 注册账号（用于 EAS Build 和项目管理）
npx expo register

# 登录
npx expo login

# 验证登录状态
npx expo whoami
```

---

## 三、创建第一个项目

### 3.1 使用 create-expo-app

```bash
# 创建项目（使用 TypeScript 模板）
npx create-expo-app@latest my-first-app --template tabs

# 进入项目
cd my-first-app

# 启动开发服务器
npx expo start
```

### 3.2 项目结构解析

```
my-first-app/
├── app/                    # 页面目录（Expo Router 基于文件的路由）
│   ├── (tabs)/             # Tab 导航布局
│   │   ├── index.tsx       # 首页 Tab
│   │   ├── explore.tsx     # 探索 Tab
│   │   └── _layout.tsx     # Tab 布局配置
│   ├── _layout.tsx         # 根布局
│   └── +not-found.tsx      # 404 页面
├── assets/                 # 静态资源（图片、字体）
│   ├── fonts/
│   └── images/
├── components/             # 可复用组件
├── constants/              # 常量定义
├── hooks/                  # 自定义 Hooks
├── app.json                # Expo 配置文件
├── tsconfig.json           # TypeScript 配置
├── package.json            # 依赖管理
└── babel.config.js         # Babel 配置
```

### 3.3 app.json 关键配置

```json
{
  "expo": {
    "name": "my-first-app",
    "slug": "my-first-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "myfirstapp",
    "splash": {
      "image": "./assets/images/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourname.myfirstapp"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourname.myfirstapp"
    },
    "plugins": ["expo-router"]
  }
}
```

---

## 四、模拟器配置

### 4.1 iOS 模拟器（仅 macOS）

```bash
# 1. 安装 Xcode（App Store 搜索 Xcode 安装）
# 2. 安装 Xcode Command Line Tools
xcode-select --install

# 3. 打开 Xcode，同意许可协议
sudo xcodebuild -license accept

# 4. 启动模拟器
open -a Simulator

# 5. 在 Expo 中运行
npx expo start
# 按 i 键在 iOS 模拟器中打开
```

### 4.2 Android 模拟器

```bash
# 1. 安装 Android Studio
# 下载地址：https://developer.android.com/studio

# 2. 打开 Android Studio → More Actions → Virtual Device Manager
# 3. 创建虚拟设备：
#    - 选择 Pixel 7 或类似设备
#    - 选择系统镜像（推荐 API 34）
#    - 完成创建并启动模拟器

# 4. 在 Expo 中运行
npx expo start
# 按 a 键在 Android 模拟器中打开
```

### 4.3 模拟器快捷键

| 操作 | iOS 模拟器 | Android 模拟器 |
|------|-----------|---------------|
| 摇晃设备 | Cmd+D | Cmd+M (macOS) / Ctrl+M (Windows) |
| 重新加载 | Cmd+R | R R（连按两次） |
| 开发者菜单 | Cmd+D | Cmd+D / Ctrl+D |

---

## 五、真机调试（Expo Go）

这是最快的真机调试方式，无需 USB 连接。

```bash
# 1. 手机安装 Expo Go
# iOS: App Store 搜索 "Expo Go"
# Android: Google Play 搜索 "Expo Go"

# 2. 确保手机和电脑在同一 WiFi 网络下

# 3. 启动开发服务器
npx expo start

# 4. 使用方式：
#    - iOS: 用系统相机扫描终端中的二维码
#    - Android: 在 Expo Go 应用内扫码
```

**注意事项**：
- 如果 WiFi 不可用，使用 `npx expo start --tunnel` 通过隧道连接
- Expo Go 不支持自定义原生模块，需要 Development Build

---

## 六、开发服务器与热重载

启动开发服务器后，终端会显示：

```
› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press j │ open debugger
› Press r │ reload app
› Press m │ toggle menu

› Press ? │ show all commands
```

### 热重载原理

Metro Bundler 是 React Native 的打包工具，它会：

1. 监听文件变化（文件系统 Watcher）
2. 增量编译变更的模块（而非全量打包）
3. 通过 WebSocket 推送更新到设备
4. React Fast Refresh 接管组件状态恢复

```typescript
// 保存文件后，只有这个组件会重新渲染
// 其他组件的状态会被保留
export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24 }}>计数: {count}</Text>
      <Button title="加一" onPress={() => setCount(c => c + 1)} />
    </View>
  );
}
```

---

## 七、常见环境问题排查

### 问题 1：Metro 启动失败 — 端口被占用

```bash
# 查看占用 8081 端口的进程
# macOS / Linux
lsof -i :8081
kill -9 <PID>

# Windows
netstat -ano | findstr :8081
taskkill /PID <PID> /F

# 或者换一个端口启动
npx expo start --port 8082
```

### 问题 2：Android 模拟器无法连接开发服务器

```bash
# Android 模拟器使用 10.0.2.2 访问宿主机
# Expo 通常自动处理，如果不行手动设置：
adb reverse tcp:8081 tcp:8081
```

### 问题 3：依赖版本冲突

```bash
# 清除缓存重新安装
rm -rf node_modules
npm cache clean --force
npm install

# 重置 Metro 缓存
npx expo start --clear
```

### 问题 4：iOS 构建失败

```bash
# 清除 Xcode 构建缓存
cd ios && xcodebuild clean && cd ..
# 或使用 Expo 的清理命令
npx expo prebuild --clean
```

---

## 常见误区

1. **直接全局安装 expo 包**：应该使用 `npx expo` 而非全局安装 `expo-cli`（已废弃）
2. **忽略 Node 版本**：Node 16 已不再受支持，必须 18+
3. **在 Expo Go 中使用原生模块**：Expo Go 只包含 Expo 官方模块，自定义原生代码需要 Development Build
4. **不区分开发依赖和生产依赖**：`@types/*` 包应该放在 `devDependencies`
5. **模拟器内存不足**：Android 模拟器默认内存较小，建议在 AVD 设置中分配 2GB+

---

## 工程建议

1. **使用 nvm 管理 Node 版本**：在项目根目录创建 `.nvmrc` 文件锁定版本
2. **优先使用 npx 而非全局安装**：避免版本不一致问题
3. **尽早注册 Expo 账号**：后续 EAS Build、推送通知都需要账号
4. **开发阶段用 Expo Go，测试阶段用 Development Build**：两者定位不同
5. **配置 .gitignore**：Expo 项目自动生成，确认 `node_modules`、`.expo` 等目录已忽略
6. **团队统一开发工具版本**：在 `package.json` 的 `engines` 字段中约束 Node 版本

---

## 小结

这节课我们从零搭建了 Expo 开发环境，理解了 Expo 与 bare React Native 的区别，学会了用 Expo Go 进行真机调试。核心要点：

- Expo 让你无需配置原生开发环境就能开始 React Native 开发
- `npx create-expo-app` 是创建项目的标准方式
- Expo Go 是最快的真机预览方案，Development Build 用于需要原生模块的场景
- Metro Bundler 的热重载机制基于文件监听和增量编译

---

## 练习

### 练习一：环境验证

在你的电脑上完成以下操作并截图：
1. 安装 Node.js 20 并验证版本
2. 创建一个 Expo 项目并成功启动开发服务器
3. 在模拟器或 Expo Go 中看到默认页面

### 练习二：项目结构探索

创建一个新项目后，回答以下问题：
1. `app/_layout.tsx` 的作用是什么？
2. `app.json` 中的 `scheme` 字段有什么用？
3. 删除 `app/(tabs)/_layout.tsx` 后会发生什么？

### 练习三：热重载验证

修改 `app/(tabs)/index.tsx` 中的文本内容，观察：
1. 保存后页面是否自动更新？
2. 如果在页面上有计数器状态，修改文本后计数器状态是否保留？

---

## 参考答案

### 练习一

**思路**：按照课程中的步骤依次执行，重点关注命令输出是否与预期一致。

**答案**：
```bash
# 验证 Node 版本
node --version
# 输出: v20.x.x

# 创建项目
npx create-expo-app@latest exercise-app --template tabs
cd exercise-app

# 启动开发服务器
npx expo start
# 终端会显示二维码和操作提示
```

**要点**：
- 如果 `node --version` 报错，说明 nvm 未正确配置
- 首次启动可能需要较长时间下载依赖

### 练习二

**思路**：通过阅读文件内容和实际修改来理解各文件的作用。

**答案**：
1. `app/_layout.tsx` 是根布局组件，定义了所有页面共享的布局结构，通常包含 `<Stack>` 或 `<Slot>` 组件用于渲染子路由。
2. `scheme` 是 Deep Linking 的协议标识，用于从外部链接（如 `myfirstapp://page`）直接跳转到应用内页面。
3. 删除 `app/(tabs)/_layout.tsx` 后，Tab 导航会失效，`(tabs)` 目录下的页面将无法通过底部标签栏切换，可能会报布局错误。

**要点**：
- Expo Router 基于文件系统，文件名即路由路径
- `_layout.tsx` 是特殊文件名，用于定义布局而非页面

### 练习三

**思路**：理解 React Fast Refresh 的行为——它会保留组件状态但更新 UI。

**答案**：
1. 保存文件后，页面会在毫秒级内自动更新，无需手动刷新。终端会显示 `iOS Bundled` 或类似提示。
2. 计数器状态会被保留。Fast Refresh 只会重新执行受影响组件的渲染函数，不会重置 `useState` 的值。但如果修改了组件的导出方式（如从 default 改为 named export），状态会丢失，因为 React 无法追踪组件身份。

**要点**：
- Fast Refresh 区分"组件编辑"和"非组件编辑"
- 状态保留的前提是组件身份未变
