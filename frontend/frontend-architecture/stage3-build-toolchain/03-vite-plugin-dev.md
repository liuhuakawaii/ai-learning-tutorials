# 03. Vite 插件开发实战

> 钩子机制、自定义插件、常用场景——用插件解决真实工程问题

## 本课目标

- 掌握 Vite 插件的钩子机制和执行顺序
- 能够开发自定义 Vite 插件解决实际问题
- 了解常见场景的插件实现方式

## 什么时候需要写插件

Vite 的配置能力有限，当遇到以下场景时，需要写插件：

- 需要在编译时注入或转换代码
- 需要自定义模块解析逻辑
- 需要修改 HTML 内容
- 需要在 Dev Server 上添加中间件
- 需要自定义 HMR 行为
- 需要集成非标准的文件格式

不要为了"学习"而写插件。先看看社区有没有现成的方案。

## 插件的基本结构

一个 Vite 插件就是一个返回对象的函数：

```typescript
// vite-plugin-logger.ts
import { Plugin } from 'vite';

export default function logger(): Plugin {
  return {
    name: 'vite-plugin-logger',

    // 钩子：在核心插件之前执行
    enforce: 'pre',

    // 钩子：配置 Dev Server
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        next();
      });
    },

    // 钩子：转换代码
    transform(code, id) {
      if (id.endsWith('.ts') && !id.includes('node_modules')) {
        console.log(`Transforming: ${id}`);
      }
      return code;
    },
  };
}
```

使用插件：

```typescript
// vite.config.ts
import logger from './vite-plugin-logger';

export default defineConfig({
  plugins: [logger()],
});
```

## 核心钩子详解

### 1. config — 修改配置

在解析 Vite 配置之前执行，可以修改或返回部分配置：

```typescript
export default function myPlugin(): Plugin {
  return {
    name: 'my-plugin',

    config(config, { command }) {
      // command 是 'serve'（开发）或 'build'（生产）
      if (command === 'build') {
        return {
          build: {
            minify: 'terser',
          },
        };
      }
    },
  };
}
```

### 2. configureServer — 配置 Dev Server

在 Dev Server 创建后执行，可以添加中间件：

```typescript
export default function apiMock(): Plugin {
  return {
    name: 'api-mock',

    configureServer(server) {
      server.middlewares.use('/api/users', (req, res, next) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify([
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ]));
        } else {
          next();
        }
      });
    },
  };
}
```

这个插件在开发环境模拟了 `/api/users` 接口，不需要启动后端服务。

### 3. resolveId — 自定义模块解析

控制模块路径的解析：

```typescript
export default function virtualModules(): Plugin {
  const virtualPrefix = '\0virtual:';

  return {
    name: 'virtual-modules',

    resolveId(source) {
      if (source === 'virtual:config') {
        return virtualPrefix + 'config';
      }
    },

    load(id) {
      if (id === virtualPrefix + 'config') {
        return `export default {
          apiBase: 'http://localhost:3000',
          appName: 'My App',
        }`;
      }
    },
  };
}
```

使用：

```typescript
import config from 'virtual:config';
console.log(config.apiBase); // 'http://localhost:3000'
```

`\0` 前缀是 Rollup 的约定，表示这是一个虚拟模块，不会去文件系统查找。

### 4. transform — 转换代码

这是最常用的钩子，可以对模块代码进行转换：

```typescript
export default function replaceVersion(): Plugin {
  return {
    name: 'replace-version',

    transform(code, id) {
      // 只处理业务代码
      if (id.includes('node_modules')) return;

      // 替换代码中的占位符
      return code
        .replace('__VERSION__', JSON.stringify('1.0.0'))
        .replace('__BUILD_TIME__', JSON.stringify(new Date().toISOString()));
    },
  };
}
```

```typescript
// src/app.ts
console.log(`App v${__VERSION__} built at ${__BUILD_TIME__}`);
// 编译后变成：
// console.log(`App v1.0.0 built at 2024-01-15T10:30:00.000Z`);
```

### 5. transformIndexHtml — 修改 HTML

可以修改 `index.html` 的内容：

```typescript
export default function injectAnalytics(): Plugin {
  return {
    name: 'inject-analytics',

    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `<script>
          window.analytics = { track: (e) => console.log('track:', e) };
        </script>
        </head>`
      );
    },
  };
}
```

也可以返回更结构化的操作：

```typescript
export default function injectAnalytics(): Plugin {
  return {
    name: 'inject-analytics',

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: `window.analytics = { track: (e) => console.log('track:', e) }`,
          injectTo: 'head',
        },
      ];
    },
  };
}
```

### 6. handleHotUpdate — 自定义 HMR

控制哪些文件变化触发 HMR，以及如何更新：

```typescript
export default function customHmr(): Plugin {
  return {
    name: 'custom-hmr',

    handleHotUpdate({ file, server, modules }) {
      // 配置文件变化时，重启服务器
      if (file.endsWith('config.json')) {
        server.restart();
        return [];
      }

      // 静态资源变化时，刷新页面
      if (file.endsWith('.png') || file.endsWith('.svg')) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }

      // 其他情况走默认 HMR
    },
  };
}
```

## 实战：开发常用插件

### 实战一：环境信息注入插件

在构建时注入环境信息，方便调试：

```typescript
// vite-plugin-env-info.ts
import { Plugin } from 'vite';
import { execSync } from 'child_process';

export default function envInfo(): Plugin {
  return {
    name: 'vite-plugin-env-info',

    config(_, { mode }) {
      // 获取 git 信息
      let gitHash = 'unknown';
      let gitBranch = 'unknown';
      try {
        gitHash = execSync('git rev-parse --short HEAD').toString().trim();
        gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
      } catch {}

      return {
        define: {
          __GIT_HASH__: JSON.stringify(gitHash),
          __GIT_BRANCH__: JSON.stringify(gitBranch),
          __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
          __BUILD_MODE__: JSON.stringify(mode),
        },
      };
    },
  };
}
```

使用：

```typescript
// vite.config.ts
import envInfo from './vite-plugin-env-info';

export default defineConfig({
  plugins: [envInfo()],
});

// src/app.ts
declare const __GIT_HASH__: string;
declare const __BUILD_TIME__: string;

console.log(`Build: ${__GIT_HASH__} at ${__BUILD_TIME__}`);
```

### 实战二：路由自动生成插件

扫描 `src/pages` 目录，自动生成路由配置：

```typescript
// vite-plugin-file-router.ts
import { Plugin } from 'vite';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

export default function fileRouter(pagesDir = 'src/pages'): Plugin {
  const virtualId = '\0virtual:routes';

  function scanPages(dir: string): string[] {
    const pages: string[] = [];

    function walk(current: string) {
      const entries = readdirSync(current);
      for (const entry of entries) {
        const fullPath = join(current, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.tsx') || entry.endsWith('.vue')) {
          pages.push(fullPath);
        }
      }
    }

    walk(dir);
    return pages;
  }

  function generateRoutes(pages: string[], base: string): string {
    const routes = pages.map((page) => {
      const rel = relative(base, page).replace(/\\/g, '/');
      const path = '/' + rel.replace(/\.(tsx|vue)$/, '').replace(/\/index$/, '');
      return `{
        path: '${path}',
        component: () => import('${page.replace(/\\/g, '/')}'),
      }`;
    });

    return `export default [${routes.join(',')}]`;
  }

  return {
    name: 'vite-plugin-file-router',

    resolveId(source) {
      if (source === 'virtual:routes') {
        return virtualId;
      }
    },

    load(id) {
      if (id === virtualId) {
        const pages = scanPages(pagesDir);
        return generateRoutes(pages, pagesDir);
      }
    },
  };
}
```

使用：

```typescript
// src/router.ts
import routes from 'virtual:routes';
console.log(routes); // 自动生成的路由配置
```

### 实战三：API Mock 插件

支持从 JSON 文件加载 Mock 数据：

```typescript
// vite-plugin-api-mock.ts
import { Plugin, ResolvedConfig } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface MockRoute {
  url: string;
  method: string;
  response: any;
}

export default function apiMock(mockDir = 'mock'): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'vite-plugin-api-mock',

    configResolved(resolved) {
      config = resolved;
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (config.command !== 'serve') return next();
        if (!req.url?.startsWith('/api/')) return next();

        const mockFile = resolve(mockDir, `${req.url.replace('/api/', '')}.json`);
        if (!existsSync(mockFile)) return next();

        const data = JSON.parse(readFileSync(mockFile, 'utf-8'));

        // 延迟 200ms 模拟网络延迟
        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        }, 200);
      });
    },
  };
}
```

目录结构：

```
mock/
  users.json
  orders.json
```

```json
// mock/users.json
{
  "code": 0,
  "data": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
  ]
}
```

```typescript
// src/api.ts
const res = await fetch('/api/users');
const data = await res.json();
// 开发环境自动走 mock，生产环境走真实接口
```

## 插件开发的调试技巧

### 1. 使用 debug 日志

```typescript
import { createLogger } from 'vite';

const log = createLogger('info', { prefix: '[my-plugin]' });

export default function myPlugin(): Plugin {
  return {
    name: 'my-plugin',

    transform(code, id) {
      log.info(`Transforming: ${id}`, { timestamp: true });
      return code;
    },
  };
}
```

### 2. 使用 `this` 上下文

在 Rollup 钩子中，`this` 提供了一些有用的工具：

```typescript
export default function myPlugin(): Plugin {
  return {
    name: 'my-plugin',

    resolveId(source, importer) {
      // 发出警告
      this.warn(`Resolving ${source} from ${importer}`);

      // 发出错误
      // this.error('Something went wrong');

      // 获取模块信息
      const moduleInfo = this.getModuleInfo(importer);
      console.log('Module info:', moduleInfo);
    },
  };
}
```

### 3. 测试插件

```typescript
// test-plugin.ts
import { createServer } from 'vite';
import myPlugin from './vite-plugin-my-plugin';

async function test() {
  const server = await createServer({
    plugins: [myPlugin()],
    server: { port: 3001 },
  });

  await server.listen();
  console.log('Dev server running at http://localhost:3001');
}

test();
```

## 插件发布的注意事项

### 1. 命名规范

```typescript
// 好的命名
'vite-plugin-mock'
'vite-plugin-svg-icons'

// 不好的命名
'my-vite-tool'
'vite-helper'
```

Vite 社区约定：插件名以 `vite-plugin-` 开头，支持 `@scope/vite-plugin-` 格式。

### 2. 兼容性

```typescript
export default function myPlugin(): Plugin {
  return {
    name: 'vite-plugin-my-plugin',

    // 声明支持的 Vite 版本
    // package.json 中的 peerDependencies
    // "vite": ">=4.0.0"

    config(config, { command }) {
      // 检查必要的配置
      if (!config.root) {
        this.warn('No root configured');
      }
    },
  };
}
```

### 3. 性能

```typescript
export default function myPlugin(): Plugin {
  // 缓存计算结果
  const cache = new Map();

  return {
    name: 'vite-plugin-my-plugin',

    transform(code, id) {
      if (cache.has(id)) {
        return cache.get(id);
      }

      // 只处理需要的文件
      if (!id.endsWith('.custom')) return;

      const result = expensiveTransform(code);
      cache.set(id, result);
      return result;
    },
  };
}
```

## 常见误区

### 误区一：所有需求都需要写插件

**错误理解**：遇到任何构建需求都自己写插件

**正确理解**：先看 Vite 配置能否解决，再看社区插件能否满足，最后才考虑自己写。

### 误区二：插件钩子越多越好

**错误理解**：一个插件应该实现尽可能多的钩子

**正确理解**：插件应该只实现必要的钩子。单一职责的插件更容易维护和复用。

### 误区三：忽略 Node.js 环境差异

**错误理解**：插件代码可以在浏览器中运行

**正确理解**：Vite 插件运行在 Node.js 环境中，不能使用浏览器 API。同时要注意 Node.js 版本兼容性。

## 本课小结

1. **插件的核心结构**：name + 钩子函数
2. **常用钩子**：config、configureServer、resolveId、load、transform、transformIndexHtml
3. **虚拟模块**：使用 `\0` 前缀标识虚拟模块
4. **调试技巧**：使用 Vite 的 logger、this 上下文
5. **发布规范**：命名规范、兼容性声明、性能优化

## 练习

### 练习一：开发一个代码统计插件

开发一个 Vite 插件，在构建开始时统计项目中的代码行数（按文件类型分类）。

### 练习二：开发一个自动导入插件

开发一个 Vite 插件，自动为 Vue 组件注入 `import { defineComponent } from 'vue'`（如果文件中使用了 `defineComponent` 但没有导入）。

## 参考答案

### 练习一

```typescript
// vite-plugin-code-stats.ts
import { Plugin } from 'vite';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';

export default function codeStats(dir = 'src'): Plugin {
  return {
    name: 'vite-plugin-code-stats',

    buildStart() {
      const stats: Record<string, number> = {};

      function walk(current: string) {
        const entries = readdirSync(current);
        for (const entry of entries) {
          const fullPath = join(current, entry);
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else {
            const ext = extname(entry) || 'no-ext';
            const content = readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n').length;
            stats[ext] = (stats[ext] || 0) + lines;
          }
        }
      }

      walk(dir);

      console.log('\n📊 Code Statistics:');
      for (const [ext, lines] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${ext}: ${lines} lines`);
      }
      console.log('');
    },
  };
}
```

### 练习二

```typescript
// vite-plugin-auto-define.ts
import { Plugin } from 'vite';

export default function autoDefine(): Plugin {
  return {
    name: 'vite-plugin-auto-define',

    transform(code, id) {
      if (!id.endsWith('.vue') && !id.endsWith('.tsx')) return;
      if (id.includes('node_modules')) return;

      // 检查是否使用了 defineComponent 但没有导入
      const usesDefineComponent = code.includes('defineComponent');
      const importsDefineComponent = code.includes('import') && code.includes('defineComponent');

      if (usesDefineComponent && !importsDefineComponent) {
        return `import { defineComponent } from 'vue';\n${code}`;
      }
    },
  };
}
```

## 下一步

完成本课后，继续学习 [04. Webpack 深度优化](./04-webpack-deep-optimization.md)。
