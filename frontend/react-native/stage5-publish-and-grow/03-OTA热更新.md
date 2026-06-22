# OTA 热更新

## 场景引入

应用上架后发现严重 UI 错误或需要紧急更新文案。传统流程：修复 → 提交新版本 → 等审核 1-3 天 → 用户手动更新，整个周期长达一周。使用 OTA 热更新，可以在几分钟内将修复推送到所有用户设备，无需应用商店审核。Expo 通过 EAS Update 提供完整解决方案。

## 学习目标

1. 配置 EAS Update 并理解 channel 与 runtime version 的关系
2. 掌握热更新的发布流程和版本回滚策略
3. 理解增量更新原理并制定生产环境最佳实践

## EAS Update 配置

```bash
npx expo install expo-updates
eas update:configure
```

```jsonc
// app.json
{
  "expo": {
    "updates": { "url": "https://u.expo.dev/your-project-id" },
    "runtimeVersion": { "policy": "appVersion" }
  }
}
```

### eas.json channel 配置

```jsonc
{
  "build": {
    "development": { "channel": "development", "developmentClient": true },
    "preview": { "channel": "preview", "distribution": "internal" },
    "production": { "channel": "production", "autoIncrement": true }
  }
}
```

## Channel 与 Runtime Version

### Channel（渠道）

Channel 是热更新的分发通道，决定哪些用户收到更新：

- `development`：开发团队内部测试
- `preview`：预览测试（内测用户）
- `production`：正式用户

**关键规则**：Channel 与构建绑定，一个构建只能属于一个 channel。

### Runtime Version（运行时版本）

决定更新的兼容性，只有 runtime version 匹配时更新才会被应用：

```jsonc
{
  "runtimeVersion": {
    "policy": "appVersion"        // 使用 version 字段
    // "fingerprintExpo"          // 基于原生依赖哈希（推荐）
    // "nativeVersion"            // 使用 buildNumber / versionCode
  }
}
```

当原生代码变化时 runtime version 改变，旧构建不会收到不兼容的更新。

## 热更新发布流程

```bash
# 发布到 production channel
eas update --channel production --message "修复登录页面崩溃"

# 发布到 preview channel 测试
eas update --channel preview --message "测试新首页布局"

# 指定分支发布
eas update --branch main --message "v1.2.0 新增搜索功能"
```

### 更新管理器封装

```typescript
// services/UpdateManager.ts
import * as Updates from 'expo-updates';
import { AppState, AppStateStatus, Alert } from 'react-native';

interface Options {
  checkInterval?: number;
  autoApply?: boolean;
}

export class UpdateManager {
  private interval: number;
  private autoApply: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sub: any;

  constructor(opts: Options = {}) {
    this.interval = opts.checkInterval ?? 300_000;
    this.autoApply = opts.autoApply ?? false;
  }

  start(): void {
    this.check();
    this.timer = setInterval(() => this.check(), this.interval);
    this.sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') this.check();
    });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.sub?.remove();
  }

  private async check(): Promise<void> {
    if (__DEV__) return;
    try {
      const { isAvailable } = await Updates.checkForUpdateAsync();
      if (!isAvailable) return;

      const { isNew } = await Updates.fetchUpdateAsync();
      if (!isNew) return;

      if (this.autoApply) {
        await Updates.reloadAsync();
      } else {
        Alert.alert('发现新版本', '新版本已下载，重启后生效。', [
          { text: '稍后', style: 'cancel' },
          { text: '重启', onPress: () => Updates.reloadAsync() },
        ]);
      }
    } catch (e) {
      console.warn('[UpdateManager]', e);
    }
  }
}
```

使用示例：

```typescript
// App.tsx
import { UpdateManager } from './services/UpdateManager';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    const manager = new UpdateManager({ checkInterval: 180_000, autoApply: false });
    manager.start();
    return () => manager.stop();
  }, []);
  return <RootNavigator />;
}
```

## 版本回滚策略

EAS Update 不支持真正的「撤回」。回滚实际上是发布一个新更新，内容与旧版本相同。

```bash
# 查看所有已发布的更新
eas update:list --branch production

# 回滚到指定更新（发布内容相同的更新）
eas update --branch production --republish --group <update-group-id>
```

## 增量更新原理

EAS Update 使用 diff 算法减少更新包大小：

1. 客户端报告当前 updateId
2. 服务器对比差异，只发送变更部分
3. 客户端应用差异更新

优化策略：将大型图片/视频放在远程服务器，避免打包到更新包中；使用 Code Splitting 减少初始 bundle 大小。

## 生产环境最佳实践

```typescript
// config/updateStrategy.ts
export const UPDATE_STRATEGY = {
  development: { autoCheck: false, autoApply: false },
  preview: { autoCheck: true, autoApply: true, interval: 60_000 },
  production: { autoCheck: true, autoApply: false, interval: 300_000, prompt: true },
} as const;
```

1. **不要在热更新中修改原生代码**：原生变更必须走商店审核
2. **保持 runtime version 兼容性**：修改原生依赖时递增版本号
3. **先在 preview channel 验证**：再推送到 production
4. **监控更新成功率**：关注下载失败率和崩溃率
5. **控制更新包大小**：包越大下载失败率越高

## 常见误区

1. **热更新能改任何东西**：只能更新 JS Bundle 和资源，原生代码必须走商店
2. **Channel 设置错误**：构建时绑定的 channel 决定能收到哪些更新
3. **忽略 runtime version**：不匹配时更新不被应用，这是安全保障
4. **频繁发布小更新**：过于频繁消耗用户流量，应合并后统一发布
5. **不测试就直接推生产**：所有更新应先在 preview 验证

## 工程建议

1. **使用 fingerprintExpo 策略**：自动处理原生依赖变化
2. **建立更新发布 SOP**：preview 验证 → 灰度发布 → 全量发布
3. **在应用中显示更新状态**：让用户知道当前版本和可用更新
4. **监控更新后崩溃率**：崩溃率上升立即回滚
5. **更新文案要清晰**：`--message` 描述内容，便于团队追溯

## 小结

本节课学习了 EAS Update 的完整配置和使用。核心要点：Channel 控制分发范围，Runtime Version 保障兼容性，增量更新减少流量。生产环境先在 preview 验证再推 production，配合回滚策略保障稳定性。

## 练习

### 练习一：配置 EAS Update

配置三个 channel（development/preview/production），实现启动时自动检查更新并提示重启。

### 练习二：封装 UpdateManager

实现 `UpdateManager` 类，支持配置检查间隔、自动应用开关、更新回调，前台恢复时自动检查。

---

## 参考答案

### 练习一

```jsonc
// eas.json
{
  "build": {
    "development": { "channel": "development" },
    "preview": { "channel": "preview" },
    "production": { "channel": "production", "autoIncrement": true }
  }
}
```

```typescript
// hooks/useOTAUpdate.ts
import { useEffect } from 'react';
import * as Updates from 'expo-updates';
import { Alert, AppState } from 'react-native';

export function useOTAUpdate() {
  async function check() {
    if (__DEV__) return;
    try {
      const { isAvailable } = await Updates.checkForUpdateAsync();
      if (!isAvailable) return;
      const { isNew } = await Updates.fetchUpdateAsync();
      if (isNew) {
        Alert.alert('更新可用', '重启后生效。', [
          { text: '稍后', style: 'cancel' },
          { text: '重启', onPress: () => Updates.reloadAsync() },
        ]);
      }
    } catch (e) { console.warn('更新检查失败:', e); }
  }

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, []);
}
```

**要点**：`__DEV__` 环境跳过；前台恢复时重新检查；用户可选择立即重启或稍后。

### 练习二

```typescript
import * as Updates from 'expo-updates';
import { AppState, AppStateStatus, Alert } from 'react-native';

interface Opts { intervalMs?: number; autoApply?: boolean; }

export class UpdateManager {
  private interval: number;
  private autoApply: boolean;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sub: any;

  constructor(opts: Opts = {}) {
    this.interval = opts.intervalMs ?? 300_000;
    this.autoApply = opts.autoApply ?? false;
  }

  start(): void {
    this.check();
    this.timer = setInterval(() => this.check(), this.interval);
    this.sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') this.check();
    });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.sub?.remove();
  }

  private async check(): Promise<void> {
    if (__DEV__) return;
    try {
      const { isAvailable } = await Updates.checkForUpdateAsync();
      if (!isAvailable) return;
      const { isNew } = await Updates.fetchUpdateAsync();
      if (!isNew) return;
      if (this.autoApply) {
        await Updates.reloadAsync();
      } else {
        Alert.alert('更新可用', '新版本已下载，是否重启？', [
          { text: '稍后', style: 'cancel' },
          { text: '重启', onPress: () => Updates.reloadAsync() },
        ]);
      }
    } catch (e) { console.warn('[UpdateManager]', e); }
  }
}
```

**要点**：生产环境用 `autoApply: false`；`start()`/`stop()` 配对避免内存泄漏。
