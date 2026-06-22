# App Store 发布

## 场景引入

图标和启动屏配置好后，下一步是将应用发布到应用商店。第一次提交时常见问题：iOS 签名证书搞不清、Google Play 的 AAB 格式要求、审核被拒后不知如何修改。发布流程涉及签名、构建、提交、审核多个环节，每个环节都可能踩坑。本节课完整走通 EAS Build 到应用上架的全流程。

## 学习目标

1. 配置 EAS Build 并为 iOS 和 Android 生成发布构建
2. 完成 iOS App Store 和 Google Play 的应用提交
3. 识别并规避常见审核拒绝原因
4. 制定 ASO 优化策略和版本号管理方案

## EAS Build 配置

```bash
npm install -g eas-cli
eas login
eas build:configure
```

### eas.json 配置

```jsonc
{
  "cli": { "version": ">= 7.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "http://localhost:3000" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://staging-api.example.com" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_API_URL": "https://api.example.com" },
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "your-id@example.com", "ascAppId": "1234567890", "appleTeamId": "ABCDE12345" },
      "android": { "serviceAccountKeyPath": "./google-play-key.json", "track": "production" }
    }
  }
}
```

### iOS 签名配置

```bash
# 让 EAS 管理证书（推荐）
eas credentials
# 选择 iOS → Production → 自动生成新证书
```

### 构建命令

```bash
eas build --profile development --platform ios    # 开发构建
eas build --profile preview --platform all        # 预览构建
eas build --profile production --platform all     # 生产构建
```

## iOS App Store 提交

### 第一步：App Store Connect 创建应用

1. 登录 App Store Connect → 我的 App → 新建 App
2. 填写应用名称、Bundle ID、SKU
3. 填写描述、关键词、截图

### 第二步：提交构建

```bash
eas submit --platform ios --profile production
```

### 第三步：TestFlight 测试后提交审核

```typescript
// app.json iOS 配置
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "用于扫描二维码",
        "NSPhotoLibraryUsageDescription": "用于选择头像"
      },
      "supportsTablet": true
    }
  }
}
```

## Google Play 提交

```jsonc
// app.json Android 配置
{
  "expo": {
    "android": {
      "package": "com.yourcompany.yourapp",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1a1a2e"
      }
    }
  }
}
```

Google Play 要求新应用必须使用 AAB（Android App Bundle）格式。

```bash
eas build --profile production --platform android
eas submit --platform android --profile production
```

## 审核常见拒绝原因

### iOS Top 5

| 拒绝原因 | 规避方法 |
|---------|---------|
| 崩溃和 Bug | 发布前真机充分测试 |
| 元数据不符 | 截图反映最新版本 |
| 隐私政策缺失 | 提供隐私政策链接 |
| 功能过于简单 | 确保足够功能价值 |
| 缺少 Sign in with Apple | 集成 `expo-apple-authentication` |

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';

function LoginScreen() {
  return (
    <View>
      <GoogleSignInButton />
      {/* Apple 审核要求：有第三方登录就必须有 Apple 登录 */}
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={8}
        style={{ width: '100%', height: 48 }}
        onPress={handleAppleSignIn}
      />
    </View>
  );
}
```

### Android Top 3

| 拒绝原因 | 规避方法 |
|---------|---------|
| 权限滥用 | 只申请实际使用的权限 |
| 内容分级不符 | 填写准确的分级问卷 |
| 隐私政策缺失 | 提供可访问的隐私政策 URL |

## ASO 优化策略

1. **应用名称**：包含核心关键词，如「AI 学习助手 - 智能个性化学习」
2. **副标题**（iOS）：补充关键词，如「AI 驱动的高效学习工具」
3. **关键词字段**：逗号分隔，避免重复，覆盖长尾词
4. **截图**：前两张最关键，展示核心功能和价值主张
5. **描述**：前三行展示核心价值，使用 bullet points

## 版本号管理

```
主版本.次版本.修订号 (MAJOR.MINOR.PATCH)
  1   .  2  .  3
```

```typescript
// scripts/bump-version.ts
import fs from 'fs';
import path from 'path';

type BumpType = 'major' | 'minor' | 'patch';

function bumpVersion(type: BumpType): void {
  const appJsonPath = path.resolve(__dirname, '../app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  const [major, minor, patch] = appJson.expo.version.split('.').map(Number);

  let newVersion: string;
  switch (type) {
    case 'major': newVersion = `${major + 1}.0.0`; break;
    case 'minor': newVersion = `${major}.${minor + 1}.0`; break;
    case 'patch': newVersion = `${major}.${minor}.${patch + 1}`; break;
  }

  appJson.expo.version = newVersion;
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log(`版本号: ${appJson.expo.version} → ${newVersion}`);
}

const type = process.argv[2] as BumpType;
if (!['major', 'minor', 'patch'].includes(type)) {
  console.error('用法: npx ts-node bump-version.ts <major|minor|patch>');
  process.exit(1);
}
bumpVersion(type);
```

## 常见误区

1. **忘记配置隐私政策**：iOS 和 Android 都要求，否则审核被拒
2. **使用开发证书提交生产构建**：必须使用 Distribution 证书
3. **版本号不递增**：每次提交必须递增，否则构建失败
4. **忽略 TestFlight 测试**：直接提交可能导致线上崩溃才发现问题
5. **截图尺寸不对**：各商店对截图尺寸有严格要求

## 工程建议

1. **使用 EAS 管理签名证书**：避免手动管理的复杂性
2. **设置分阶段发布**：Google Play 支持按比例发布
3. **维护审核检查清单**：每次提交前逐项检查
4. **版本号与 Git tag 同步**：便于追溯
5. **ASO 定期优化**：根据数据调整关键词和描述

## 小结

本节课走通了 EAS Build 配置、iOS App Store 和 Google Play 提交流程。核心要点：使用 EAS CLI 管理构建和提交，理解审核要求，建立版本号管理和 ASO 策略。下一节课学习 OTA 热更新。

## 练习

### 练习一：配置 EAS Build

为项目配置 `eas.json`，包含 development、preview、production 三个环境，配置不同 API 地址和分发方式。

### 练习二：编写版本号管理脚本

编写脚本支持命令行 bump 版本号（major/minor/patch），同时更新 `app.json` 中的 version。

---

## 参考答案

### 练习一

```jsonc
{
  "cli": { "version": ">= 7.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "http://localhost:3000" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://staging-api.example.com" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "EXPO_PUBLIC_API_URL": "https://api.example.com" },
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

**要点**：`development` 使用 `developmentClient`；`production` 使用 `autoIncrement` 自动递增构建号。

### 练习二

```typescript
import fs from 'fs';
import path from 'path';

type BumpType = 'major' | 'minor' | 'patch';

function bump(type: BumpType): void {
  const p = path.resolve(__dirname, '../app.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const parts = j.expo.version.split('.').map(Number);

  switch (type) {
    case 'major': parts[0]++; parts[1] = 0; parts[2] = 0; break;
    case 'minor': parts[1]++; parts[2] = 0; break;
    case 'patch': parts[2]++; break;
  }

  j.expo.version = parts.join('.');
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log(`版本更新: → ${j.expo.version}`);
}

const arg = process.argv[2] as BumpType;
if (!['major', 'minor', 'patch'].includes(arg)) {
  console.error('用法: npx ts-node bump-version.ts <major|minor|patch>');
  process.exit(1);
}
bump(arg);
```

**要点**：major 递增时 minor/patch 重置；minor 递增时 patch 重置。
