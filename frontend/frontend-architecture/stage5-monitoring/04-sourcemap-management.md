# 04. Source Map 管理与错误还原

> Source Map 上传、错误堆栈解析、sourcemap 安全——让生产环境的错误不再是一堆乱码

## 本课目标

- 理解 Source Map 的工作原理和文件格式
- 掌握生产环境 Source Map 的管理策略
- 实现错误堆栈的自动化还原
- 理解 Source Map 的安全风险和应对措施
- 能为团队设计 Source Map 的完整工作流

## 生产环境的错误堆栈长什么样

用户反馈了一个错误，你打开监控后台看到：

```
TypeError: Cannot read properties of undefined (reading 'name')
    at a (https://cdn.example.com/static/js/main.f7a8b9c2.js:1:1847)
    at o (https://cdn.example.com/static/js/main.f7a8b9c2.js:1:23456)
    at ko (https://cdn.example.com/static/js/vendor.e5d6c3a1.js:2:89123)
    at Ji (https://cdn.example.com/static/js/vendor.e5d6c3a1.js:2:45678)
```

变量名是 `a`、`o`，文件只有一行，列号是四位数。这是经过压缩和打包后的代码，根本看不出错误发生在哪个组件、哪个函数。

这就是没有 Source Map 还原的结果。

## Source Map 是什么

Source Map 是一个映射文件，记录了**压缩后代码的位置**到**原始源码位置**的对应关系。

```
编译/打包过程：
  源码 (UserCard.tsx:15)
    → TypeScript 编译 (UserCard.js:18)
    → Webpack 打包 (main.js:1234)
    → Terser 压缩 (main.min.js:1:2847)

Source Map 记录的就是这条链的反向映射：
  main.min.js:1:2847 → main.js:1234 → UserCard.js:18 → UserCard.tsx:15
```

### Source Map 文件格式

一个 `.map` 文件是 JSON 格式，核心字段：

```json
{
  "version": 3,
  "file": "main.min.js",
  "sources": [
    "webpack:///./src/components/UserCard.tsx",
    "webpack:///./src/utils/format.ts",
    "webpack:///./src/index.tsx"
  ],
  "sourcesContent": [
    "import { format } from '../utils/format';\n\nexport function UserCard({ user }) {\n  return <div>{format(user.name)}</div>;\n}",
    "export function format(str) {\n  return str.trim();\n}",
    "import { UserCard } from './components/UserCard';\n..."
  ],
  "names": ["UserCard", "user", "name", "format"],
  "mappings": "AAAA,SAASA,EAAWC,GAAM,CACrB,OAAOA..."
}
```

关键字段：
- **sources**：原始文件路径列表
- **sourcesContent**：原始文件内容（可选，有的话可以不依赖源码就能还原）
- **names**：原始变量名列表
- **mappings**：位置映射的核心数据，用 VLQ 编码压缩

### VLQ 编码（了解即可）

`mappings` 字段用 Base64 VLQ 编码存储位置映射。每个位置映射包含 1、4 或 5 个字段：

```
字段含义：[生成代码列号, 源文件索引, 源码行号, 源码列号, 名称索引]
```

你不需要手动解析 VLQ，有现成的库来做这件事。

## 生产环境 Source Map 的管理难题

### 核心矛盾

你需要 Source Map 来还原错误，但你不想把 Source Map 发给用户。

原因：
1. **代码安全**：Source Map 包含完整源码，竞争对手可以直接看到你的实现
2. **文件体积**：Source Map 文件通常比压缩后的代码还大
3. **带宽成本**：用户不需要 Source Map，发送它是浪费

### 方案一：不上传 Source Map

```javascript
// webpack.config.js
module.exports = {
  devtool: 'source-map', // 生成 Source Map
  // 但部署时把 .map 文件删除或不上传到 CDN
};
```

后果：监控系统无法还原错误堆栈。

### 方案二：Source Map 只保留在服务端

这是最常见的生产方案：

```
构建流程：
  1. webpack 生成 .map 文件
  2. CI/CD 上传 .map 文件到监控平台（Sentry 等）
  3. 部署时只上传 .js 文件到 CDN（不包含 .map）

错误还原流程：
  1. 浏览器上报压缩后的错误堆栈
  2. 监控平台拿到堆栈
  3. 用上传的 .map 文件还原为原始位置
  4. 展示原始文件名、行号、列号、源码
```

```javascript
// webpack.config.js
const SentryWebpackPlugin = require('@sentry/webpack-plugin');

module.exports = {
  devtool: 'source-map',
  plugins: [
    new SentryWebpackPlugin({
      org: 'your-org',
      project: 'your-project',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      include: './dist',
      ignore: ['node_modules'],
    }),
  ],
};
```

### 方案三：条件性提供 Source Map

只对特定 IP 或带认证的请求返回 Source Map：

```nginx
# nginx 配置
location ~ \.map$ {
  # 只允许内网 IP 访问
  allow 10.0.0.0/8;
  allow 172.16.0.0/12;
  deny all;
}
```

或者在构建时生成两个版本：

```bash
# 构建脚本
npm run build
# 上传 .map 到监控平台
node scripts/upload-sourcemap.js
# 删除本地 .map 文件
rm -rf dist/**/*.map
# 部署到 CDN
aws s3 sync dist/ s3://cdn-bucket/
```

## Source Map 上传与版本管理

### 关键原则：Source Map 必须和代码版本对应

```
版本 v1.2.0 的 main.js → 必须用 v1.2.0 的 main.js.map 来还原
```

如果版本不匹配，还原出来的行号和列号都是错的，比没有还原更误导人。

### 上传时机

```javascript
// scripts/upload-sourcemap.js
const { createReadStream } = require('fs');
const { resolve } = require('path');
const glob = require('glob');

async function uploadSourceMaps() {
  const version = process.env.GIT_COMMIT_SHA || process.env.npm_package_version;
  const mapFiles = glob.sync('dist/**/*.map');
  
  console.log(`Uploading ${mapFiles.length} source maps for version ${version}`);
  
  for (const mapFile of mapFiles) {
    const jsFile = mapFile.replace('.map', '');
    
    await fetch('https://monitoring.example.com/api/sourcemap/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MONITORING_AUTH_TOKEN}`,
        'Content-Type': 'multipart/form-data',
      },
      body: createFormData({
        version,
        jsFile: jsFile.replace('dist/', ''),
        mapFile: createReadStream(resolve(mapFile)),
      }),
    });
  }
  
  console.log('Source maps uploaded successfully');
}
```

### 版本标识

推荐使用 Git commit hash 作为版本标识：

```javascript
// build 时注入版本号
const webpack = require('webpack');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.APP_VERSION': JSON.stringify(
        process.env.GIT_COMMIT_SHA || 'local-dev'
      ),
    }),
  ],
};

// 上报错误时携带版本号
function reportError(error) {
  fetch('/api/errors', {
    body: JSON.stringify({
      ...error,
      version: process.env.APP_VERSION, // 关键：和 Source Map 版本对应
    }),
  });
}
```

## 错误堆栈解析与还原

### 使用 source-map 库还原

```javascript
const { SourceMapConsumer } = require('source-map');
const fs = require('fs');

async function resolveStack(minifiedStack, mapFilePath) {
  const rawSourceMap = JSON.parse(fs.readFileSync(mapFilePath, 'utf-8'));
  const consumer = await new SourceMapConsumer(rawSourceMap);
  
  const lines = minifiedStack.split('\n');
  const resolved = lines.map(line => {
    // 解析 "at functionName (file:line:col)" 格式
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?/);
    if (!match) return line;
    
    const [, functionName, file, lineNum, colNum] = match;
    const pos = consumer.originalPositionFor({
      line: parseInt(lineNum, 10),
      column: parseInt(colNum, 10),
    });
    
    if (pos.source) {
      const sourceContent = consumer.sourceContentFor(pos.source);
      const sourceLine = sourceContent?.split('\n')[pos.line - 1]?.trim();
      
      return `  at ${pos.name || functionName} (${pos.source}:${pos.line}:${pos.column})`
        + (sourceLine ? `\n    → ${sourceLine}` : '');
    }
    
    return line;
  });
  
  consumer.destroy();
  return resolved.join('\n');
}
```

### 解析前：压缩后的堆栈

```
TypeError: Cannot read properties of undefined (reading 'name')
    at a (https://cdn.example.com/static/js/main.f7a8b9c2.js:1:1847)
    at o (https://cdn.example.com/static/js/main.f7a8b9c2.js:1:23456)
    at ko (https://cdn.example.com/static/js/vendor.e5d6c3a1.js:2:89123)
```

### 解析后：还原的堆栈

```
TypeError: Cannot read properties of undefined (reading 'name')
  at UserCard (src/components/UserCard.tsx:15:23)
    → return <div>{user.name}</div>
  at renderWithHooks (node_modules/react-dom/cjs/react-dom.development.js:14985:18)
  at mountIndeterminateComponent (node_modules/react-dom/cjs/react-dom.development.js:17868:13)
```

现在你立刻知道：错误发生在 `UserCard` 组件的第 15 行，`user` 是 `undefined`。

### 服务端还原 vs 客户端还原

**服务端还原（推荐）**：
- Source Map 只存在服务端
- 不增加客户端体积
- 安全性高
- 需要后端服务支持

**客户端还原**：
- Source Map 需要暴露给客户端
- 增加网络请求和内存开销
- 有安全风险
- 适合开发环境

## Source Map 安全

### 风险一：源码泄露

Source Map 文件包含完整的源码（如果配置了 `sourcesContent`）。

```javascript
// 如果 .map 文件被公开访问
// 竞争对手可以直接看到你的业务逻辑
GET https://cdn.example.com/static/js/main.js.map

// 返回的 JSON 包含所有源文件内容
{
  "sources": ["./src/components/PaymentForm.tsx", ...],
  "sourcesContent": ["// 你的完整源码...", ...]
}
```

### 风险二：调试信息泄露

Source Map 可能暴露：
- 内部 API 端点
- 环境变量值
- 注释中的敏感信息
- 文件路径结构

### 安全措施

```javascript
// 构建配置：移除敏感信息
module.exports = {
  devtool: 'source-map',
  plugins: [
    new webpack.SourceMapDevToolPlugin({
      // 不包含源文件内容（需要源码服务器来还原）
      noSources: true,
      // 或者只在 CI 环境包含源码内容
      // sourcesContent: process.env.CI === 'true',
    }),
  ],
};
```

```nginx
# 确保 .map 文件不在 CDN 上
location ~ \.map$ {
  return 404;
}
```

```javascript
// CI 流程：Source Map 上传后删除
// scripts/build-and-deploy.sh
npm run build
node scripts/upload-sourcemap.js
find dist -name "*.map" -delete
aws s3 sync dist/ s3://production-cdn/
```

### 不包含源码内容的 Source Map

```javascript
// webpack 配置
module.exports = {
  devtool: 'hidden-source-map', // 不在 .js 文件中添加 //# sourceMappingURL 注释
  plugins: [
    new webpack.SourceMapDevToolPlugin({
      noSources: true, // 不包含源码内容
      filename: '[file].map',
    }),
  ],
};
```

这种配置下，`.map` 文件只包含位置映射，不包含源码。还原错误时需要一个"源码服务"来提供原始文件：

```javascript
// 源码服务：根据 Git 版本返回源码
async function getSourceFile(version, filePath) {
  // 从 Git 仓库中获取指定版本的文件
  return await gitShow(version, filePath);
}
```

## 常见的 Source Map 配置

### Webpack

```javascript
// 开发环境：完整的 Source Map，速度优先
module.exports = {
  devtool: 'eval-cheap-module-source-map',
};

// 生产环境：独立的 .map 文件
module.exports = {
  devtool: 'hidden-source-map', // 不在 JS 文件中添加引用
};
```

各选项对比：

| 选项 | 构建速度 | 重建速度 | 质量 | 生产适用 |
|------|---------|---------|------|---------|
| eval | 最快 | 最快 | 差 | 否 |
| cheap-source-map | 快 | - | 行级 | 否 |
| source-map | 慢 | - | 完整 | 是 |
| hidden-source-map | 慢 | - | 完整 | 是 |
| nosources-source-map | 慢 | - | 无源码 | 是 |

### Vite

```javascript
// vite.config.ts
export default {
  build: {
    sourcemap: true, // 生成 .map 文件
    // 或 'hidden' 不在 JS 中添加引用
  },
};
```

### TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "sourceMap": true,        // 生成 .map 文件
    "inlineSources": false,   // 不在 .map 中内联源码
    "sourceRoot": "/src/"     // 源码根路径
  }
}
```

## 实现自动化 Source Map 工作流

### 完整的 CI/CD 流程

```yaml
# .github/workflows/deploy.yml
jobs:
  build-and-deploy:
    steps:
      - name: Build
        run: npm run build
        env:
          GIT_COMMIT_SHA: ${{ github.sha }}
      
      - name: Upload Source Maps
        run: node scripts/upload-sourcemap.js
        env:
          GIT_COMMIT_SHA: ${{ github.sha }}
          MONITORING_AUTH_TOKEN: ${{ secrets.MONITORING_AUTH_TOKEN }}
      
      - name: Remove Source Maps from dist
        run: find dist -name "*.map" -delete
      
      - name: Deploy to CDN
        run: aws s3 sync dist/ s3://production-cdn/
```

### 版本清理策略

```javascript
// 定期清理旧版本的 Source Map
async function cleanupOldSourceMaps() {
  // 只保留最近 30 个版本的 Source Map
  const versions = await fetchVersions();
  const toDelete = versions.slice(30);
  
  for (const version of toDelete) {
    await deleteVersion(version);
  }
}
```

## 常见误区

### 误区一：开发环境也需要 Source Map 上传

**错误理解**：所有环境的 Source Map 都要上传到监控平台

**正确理解**：开发环境用 webpack-dev-server 的 Source Map 就够了。只有生产环境和预发布环境需要上传 Source Map 到监控平台。

### 误区二：Source Map 文件可以长期保留

**错误理解**：Source Map 上传后就不用管了

**正确理解**：Source Map 需要和代码版本对应。如果你删除了旧版本的 Source Map，旧版本产生的错误就无法还原。需要制定保留策略（比如保留最近 30 个版本）。

### 误区三：有 Source Map 就不需要错误消息了

**错误理解**：Source Map 能还原所有信息，错误消息不重要

**正确理解**：Source Map 只还原位置信息（文件、行号、列号、函数名）。业务上下文（用户 ID、请求参数、操作路径）需要在上报时额外携带。

## 本课小结

1. **Source Map 的作用**：将压缩/打包后的代码位置映射回原始源码位置
2. **管理策略**：构建时生成，CI 上传到监控平台，部署时不包含 .map 文件
3. **版本对应**：Source Map 必须和代码版本严格对应
4. **安全措施**：noSources、hidden-source-map、删除 CDN 上的 .map 文件
5. **自动化**：构建 → 上传 Source Map → 删除 .map → 部署

## 练习

### 练习一：Source Map 配置审查

检查你当前项目的构建配置，回答：
- 用了哪种 `devtool` 选项？
- 生产环境的 `.map` 文件是否上传到了 CDN？
- 如果有监控平台，Source Map 是否正确上传？
- `.map` 文件中是否包含源码内容（`sourcesContent`）？

### 练习二：实现 Source Map 上传脚本

为你的项目编写一个 Source Map 上传脚本，要求：
- 读取构建输出目录中的所有 `.map` 文件
- 使用 Git commit hash 作为版本标识
- 上传到一个模拟的 API 端点
- 上传完成后删除本地 `.map` 文件

## 参考答案

### 练习一

典型的 Create React App 项目分析：

```
devtool: 'source-map'（CRA 默认配置）

问题：
- 生产 build 包含 .map 文件在 build/ 目录
- 如果直接部署 build/ 目录，.map 文件会被上传到 CDN
- Source Map 中包含完整的 sourcesContent（源码）

修复方案：
1. 修改构建脚本，上传 .map 到监控平台后删除
2. 或使用 hidden-source-map 不在 JS 中添加引用
3. 部署脚本中排除 .map 文件
```

### 练习二

```javascript
// scripts/upload-sourcemap.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = 'dist';
const API_URL = process.env.MONITORING_API_URL || 'https://monitor.example.com';
const AUTH_TOKEN = process.env.MONITORING_AUTH_TOKEN;

async function uploadSourceMaps() {
  if (!AUTH_TOKEN) {
    console.error('MONITORING_AUTH_TOKEN is required');
    process.exit(1);
  }

  const version = execSync('git rev-parse HEAD').toString().trim();
  console.log(`Version: ${version}`);

  const mapFiles = findMapFiles(DIST_DIR);
  console.log(`Found ${mapFiles.length} source map files`);

  for (const mapFile of mapFiles) {
    const jsFileName = mapFile
      .replace(DIST_DIR + '/', '')
      .replace('.map', '');
    
    console.log(`Uploading: ${jsFileName}`);
    
    const formData = new FormData();
    formData.append('version', version);
    formData.append('file', jsFileName);
    formData.append('sourcemap', fs.createReadStream(mapFile));

    const response = await fetch(`${API_URL}/api/sourcemap/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
      body: formData,
    });

    if (!response.ok) {
      console.error(`Failed to upload ${jsFileName}: ${response.status}`);
    }
  }

  // 删除本地 .map 文件
  for (const mapFile of mapFiles) {
    fs.unlinkSync(mapFile);
    console.log(`Deleted: ${mapFile}`);
  }

  console.log('Done');
}

function findMapFiles(dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findMapFiles(fullPath));
    } else if (item.name.endsWith('.map')) {
      results.push(fullPath);
    }
  }
  
  return results;
}

uploadSourceMaps().catch(console.error);
```

## 下一步

完成本课后，继续学习 [05. 性能指标采集](./05-performance-metrics.md)。
