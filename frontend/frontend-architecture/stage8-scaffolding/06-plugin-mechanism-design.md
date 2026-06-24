# 06. 插件机制设计

> 插件机制不是"给脚手架加功能"，而是"让脚手架成为可扩展的平台"

## 本课目标

- 理解插件机制的核心价值
- 设计插件接口和钩子系统
- 实现插件的加载、执行和沙箱
- 构建完整的插件生态系统

## 从一个真实场景说起

假设你在用一个脚手架工具，遇到了这些问题：

1. **功能定制**：脚手架没有你需要的功能，但你又不想 fork 整个项目
2. **团队扩展**：不同团队需要不同的功能，但脚手架核心应该保持稳定
3. **第三方集成**：想集成 ESLint、Prettier、Husky 等工具，但不想硬编码
4. **版本升级**：想升级某个功能，但不想影响其他功能

这些问题的根源是**脚手架不够灵活**。

插件机制就是解决这些问题的钥匙。它让脚手架从"一个工具"变成"一个平台"。

## 插件机制的核心概念

### 插件是什么

插件是一个独立的模块，可以在脚手架的特定时机执行特定操作。

```javascript
// 一个简单的插件
module.exports = {
  name: 'eslint-plugin',
  description: '添加 ESLint 配置',
  
  // 钩子：在创建项目前执行
  beforeCreate: (context) => {
    console.log('正在配置 ESLint...');
  },
  
  // 钩子：在创建项目后执行
  afterCreate: (context) => {
    // 复制 ESLint 配置文件
    context.copyTemplate('eslint/.eslintrc.js', '.eslintrc.js');
    context.copyTemplate('eslint/.eslintignore', '.eslintignore');
    
    // 安装依赖
    context.installDependencies(['eslint', 'eslint-plugin-react']);
  }
};
```

### 钩子系统

钩子是插件执行的时机点。脚手架在特定时刻触发钩子，插件注册的回调函数就会被执行。

```javascript
// 脚手架核心
class Scaffold {
  constructor() {
    this.hooks = {
      beforeCreate: [],
      afterCreate: [],
      beforeGenerate: [],
      afterGenerate: [],
      beforeDestroy: [],
      afterDestroy: []
    };
  }

  // 注册钩子
  on(hookName, callback) {
    if (this.hooks[hookName]) {
      this.hooks[hookName].push(callback);
    }
  }

  // 触发钩子
  async emit(hookName, context) {
    if (this.hooks[hookName]) {
      for (const callback of this.hooks[hookName]) {
        await callback(context);
      }
    }
  }

  // 创建项目
  async create(projectName, options) {
    const context = {
      projectName,
      options,
      // 提供一些工具方法
      copyTemplate: (from, to) => { /* ... */ },
      installDependencies: (deps) => { /* ... */ }
    };

    // 触发钩子
    await this.emit('beforeCreate', context);

    // 执行创建逻辑
    await this.doCreate(context);

    // 触发钩子
    await this.emit('afterCreate', context);
  }
}
```

### 插件接口

插件接口定义了插件必须实现的方法和可以访问的 API。

```javascript
// 插件接口定义
class PluginInterface {
  constructor(scaffold) {
    this.scaffold = scaffold;
  }

  // 复制模板文件
  copyTemplate(from, to) {
    this.scaffold.copyTemplate(from, to);
  }

  // 安装依赖
  installDependencies(deps) {
    this.scaffold.installDependencies(deps);
  }

  // 执行命令
  exec(command) {
    return this.scaffold.exec(command);
  }

  // 读取配置
  getConfig(key) {
    return this.scaffold.getConfig(key);
  }

  // 写入配置
  setConfig(key, value) {
    this.scaffold.setConfig(key, value);
  }
}
```

## 插件加载系统

### 插件发现

```javascript
const fs = require('fs');
const path = require('path');

class PluginLoader {
  constructor(scaffold) {
    this.scaffold = scaffold;
    this.plugins = [];
    this.pluginDirs = [
      path.join(__dirname, 'plugins'),  // 内置插件
      path.join(process.cwd(), '.my-cli/plugins'),  // 项目插件
      path.join(require('os').homedir(), '.my-cli/plugins')  // 用户插件
    ];
  }

  // 加载所有插件
  async loadAll() {
    for (const dir of this.pluginDirs) {
      if (fs.existsSync(dir)) {
        await this.loadFromDir(dir);
      }
    }
  }

  // 从目录加载插件
  async loadFromDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const pluginPath = path.join(dir, file);
        await this.loadPlugin(pluginPath);
      }
    }
  }

  // 加载单个插件
  async loadPlugin(pluginPath) {
    try {
      const plugin = require(pluginPath);
      
      // 验证插件格式
      if (!this.validatePlugin(plugin)) {
        console.error(`插件格式无效：${pluginPath}`);
        return;
      }

      // 初始化插件
      const context = new PluginInterface(this.scaffold);
      if (plugin.init) {
        await plugin.init(context);
      }

      // 注册钩子
      if (plugin.hooks) {
        Object.keys(plugin.hooks).forEach(hookName => {
          this.scaffold.on(hookName, plugin.hooks[hookName]);
        });
      }

      this.plugins.push(plugin);
      console.log(`已加载插件：${plugin.name || pluginPath}`);
    } catch (error) {
      console.error(`加载插件失败：${pluginPath}`, error);
    }
  }

  // 验证插件格式
  validatePlugin(plugin) {
    if (!plugin || typeof plugin !== 'object') {
      return false;
    }

    // 至少要有 name 或 hooks
    if (!plugin.name && !plugin.hooks) {
      return false;
    }

    // hooks 必须是对象
    if (plugin.hooks && typeof plugin.hooks !== 'object') {
      return false;
    }

    return true;
  }
}

module.exports = PluginLoader;
```

### 插件配置

```javascript
// .myclirc
{
  "plugins": [
    "eslint-plugin",
    "prettier-plugin",
    "@my-team/storybook-plugin"
  ],
  "pluginOptions": {
    "eslint-plugin": {
      "config": "recommended"
    },
    "prettier-plugin": {
      "semi": true,
      "singleQuote": true
    }
  }
}
```

```javascript
class PluginManager {
  constructor(scaffold) {
    this.scaffold = scaffold;
    this.loader = new PluginLoader(scaffold);
  }

  // 加载配置的插件
  async loadConfiguredPlugins() {
    const config = this.scaffold.getConfig();
    const pluginNames = config.plugins || [];

    for (const pluginName of pluginNames) {
      const pluginOptions = config.pluginOptions?.[pluginName] || {};
      await this.loadPluginByName(pluginName, pluginOptions);
    }
  }

  // 根据名称加载插件
  async loadPluginByName(name, options) {
    // 尝试内置插件
    const builtinPath = path.join(__dirname, 'plugins', `${name}.js`);
    if (fs.existsSync(builtinPath)) {
      await this.loader.loadPlugin(builtinPath);
      return;
    }

    // 尝试 node_modules
    try {
      const pluginPath = require.resolve(name);
      await this.loader.loadPlugin(pluginPath);
      return;
    } catch (error) {
      // 插件不存在
    }

    console.error(`插件不存在：${name}`);
  }

  // 列出已安装的插件
  list() {
    return this.loader.plugins.map(p => ({
      name: p.name,
      description: p.description,
      version: p.version
    }));
  }
}

module.exports = PluginManager;
```

## 插件沙箱

### 安全执行环境

插件沙箱确保插件只能访问允许的 API，防止恶意插件破坏系统。

```javascript
const vm = require('vm');

class PluginSandbox {
  constructor(scaffold) {
    this.scaffold = scaffold;
    this.allowedAPIs = [
      'copyTemplate',
      'installDependencies',
      'exec',
      'getConfig',
      'setConfig'
    ];
  }

  // 在沙箱中执行插件
  async execute(pluginCode, context) {
    const sandbox = this.createSandbox(context);
    
    try {
      const script = new vm.Script(pluginCode, {
        filename: 'plugin.js'
      });

      const contextObj = vm.createContext(sandbox);
      script.runInContext(contextObj);

      return sandbox.exports;
    } catch (error) {
      console.error('插件执行失败：', error);
      throw error;
    }
  }

  // 创建沙箱环境
  createSandbox(context) {
    const sandbox = {
      exports: {},
      console: {
        log: console.log,
        error: console.error,
        warn: console.warn
      },
      // 只暴露允许的 API
      scaffold: {}
    };

    // 只暴露允许的方法
    this.allowedAPIs.forEach(api => {
      if (typeof this.scaffold[api] === 'function') {
        sandbox.scaffold[api] = this.scaffold[api].bind(this.scaffold);
      }
    });

    return sandbox;
  }
}

module.exports = PluginSandbox;
```

### 插件隔离

```javascript
class PluginIsolator {
  constructor() {
    this.contexts = new Map();
  }

  // 为每个插件创建独立上下文
  createContext(pluginName) {
    const context = {
      name: pluginName,
      data: {},
      // 有限的共享状态
      shared: {}
    };

    this.contexts.set(pluginName, context);
    return context;
  }

  // 获取插件上下文
  getContext(pluginName) {
    return this.contexts.get(pluginName);
  }

  // 清理插件上下文
  cleanup(pluginName) {
    this.contexts.delete(pluginName);
  }

  // 清理所有上下文
  cleanupAll() {
    this.contexts.clear();
  }
}

module.exports = PluginIsolator;
```

## 内置插件实现

### ESLint 插件

```javascript
// plugins/eslint-plugin.js
module.exports = {
  name: 'eslint-plugin',
  description: '添加 ESLint 配置',
  version: '1.0.0',

  hooks: {
    afterCreate: async (context) => {
      console.log('正在配置 ESLint...');

      // 复制配置文件
      context.copyTemplate('eslint/.eslintrc.js', '.eslintrc.js');
      context.copyTemplate('eslint/.eslintignore', '.eslintignore');

      // 安装依赖
      await context.installDependencies([
        'eslint',
        'eslint-plugin-react',
        'eslint-plugin-react-hooks',
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/parser'
      ]);

      console.log('ESLint 配置完成！');
    }
  }
};
```

### Prettier 插件

```javascript
// plugins/prettier-plugin.js
module.exports = {
  name: 'prettier-plugin',
  description: '添加 Prettier 配置',
  version: '1.0.0',

  hooks: {
    afterCreate: async (context) => {
      console.log('正在配置 Prettier...');

      // 复制配置文件
      context.copyTemplate('prettier/.prettierrc', '.prettierrc');
      context.copyTemplate('prettier/.prettierignore', '.prettierignore');

      // 安装依赖
      await context.installDependencies([
        'prettier',
        'eslint-config-prettier',
        'eslint-plugin-prettier'
      ]);

      console.log('Prettier 配置完成！');
    }
  }
};
```

### Storybook 插件

```javascript
// plugins/storybook-plugin.js
module.exports = {
  name: 'storybook-plugin',
  description: '添加 Storybook 配置',
  version: '1.0.0',

  hooks: {
    afterCreate: async (context) => {
      console.log('正在配置 Storybook...');

      // 复制配置文件
      context.copyTemplate('storybook/.storybook/main.js', '.storybook/main.js');
      context.copyTemplate('storybook/.storybook/preview.js', '.storybook/preview.js');

      // 安装依赖
      await context.installDependencies([
        '@storybook/react',
        '@storybook/addon-essentials',
        '@storybook/addon-interactions',
        '@storybook/addon-links'
      ]);

      console.log('Storybook 配置完成！');
    }
  }
};
```

## 插件开发指南

### 插件结构

```
my-plugin/
├── package.json
├── index.js
├── templates/
│   ├── .eslintrc.js
│   └── .eslintignore
└── README.md
```

### 插件模板

```javascript
// my-plugin/index.js
module.exports = {
  name: 'my-plugin',
  description: '我的插件',
  version: '1.0.0',

  // 初始化
  init: async (context) => {
    // 插件初始化逻辑
  },

  // 钩子
  hooks: {
    beforeCreate: async (context) => {
      // 创建前逻辑
    },
    afterCreate: async (context) => {
      // 创建后逻辑
    },
    beforeGenerate: async (context) => {
      // 生成前逻辑
    },
    afterGenerate: async (context) => {
      // 生成后逻辑
    }
  },

  // 自定义命令
  commands: {
    myCommand: {
      description: '我的命令',
      action: async (context, options) => {
        // 命令逻辑
      }
    }
  }
};
```

### 插件测试

```javascript
// my-plugin/__tests__/index.test.js
const plugin = require('../index');
const { createMockContext } = require('@my-cli/test-utils');

describe('my-plugin', () => {
  let context;

  beforeEach(() => {
    context = createMockContext();
  });

  it('should have correct name', () => {
    expect(plugin.name).toBe('my-plugin');
  });

  it('should copy template files', async () => {
    await plugin.hooks.afterCreate(context);
    
    expect(context.copyTemplate).toHaveBeenCalledWith(
      'template/.eslintrc.js',
      '.eslintrc.js'
    );
  });

  it('should install dependencies', async () => {
    await plugin.hooks.afterCreate(context);
    
    expect(context.installDependencies).toHaveBeenCalledWith(
      expect.arrayContaining(['eslint'])
    );
  });
});
```

## 插件生态系统

### 插件市场

```javascript
class PluginMarket {
  constructor() {
    this.registry = 'https://registry.npmjs.org';
  }

  // 搜索插件
  async search(keyword) {
    const response = await fetch(
      `${this.registry}/-/v1/search?text=${keyword}`
    );
    const data = await response.json();
    
    return data.objects
      .filter(obj => obj.package.keywords?.includes('my-cli-plugin'))
      .map(obj => ({
        name: obj.package.name,
        description: obj.package.description,
        version: obj.package.version,
        author: obj.package.author?.name
      }));
  }

  // 获取插件详情
  async getDetails(name) {
    const response = await fetch(`${this.registry}/${name}`);
    const data = await response.json();
    
    return {
      name: data.name,
      description: data.description,
      version: data['dist-tags'].latest,
      author: data.author?.name,
      repository: data.repository?.url,
      keywords: data.keywords
    };
  }

  // 安装插件
  async install(name) {
    const { execSync } = require('child_process');
    execSync(`npm install ${name}`, { stdio: 'inherit' });
  }
}

module.exports = PluginMarket;
```

### 插件文档

```javascript
// 生成插件文档
function generatePluginDocs(plugins) {
  let docs = '# 插件列表\n\n';
  
  plugins.forEach(plugin => {
    docs += `## ${plugin.name}\n\n`;
    docs += `**描述**：${plugin.description}\n\n`;
    docs += `**版本**：${plugin.version}\n\n`;
    docs += `**钩子**：\n`;
    
    if (plugin.hooks) {
      Object.keys(plugin.hooks).forEach(hook => {
        docs += `- ${hook}\n`;
      });
    }
    
    docs += '\n---\n\n';
  });
  
  return docs;
}
```

## 插件机制最佳实践

### 1. 保持接口稳定

```javascript
// 版本兼容性
class PluginInterface {
  constructor(scaffold, version = '1.0.0') {
    this.scaffold = scaffold;
    this.version = version;
  }

  // 提供兼容性方法
  copyTemplate(from, to) {
    if (this.version >= '2.0.0') {
      return this.scaffold.copyTemplateV2(from, to);
    }
    return this.scaffold.copyTemplate(from, to);
  }
}
```

### 2. 提供清晰的错误信息

```javascript
// 插件执行错误
class PluginError extends Error {
  constructor(pluginName, message) {
    super(`插件 ${pluginName} 执行失败：${message}`);
    this.pluginName = pluginName;
  }
}

// 使用
try {
  await plugin.hooks.afterCreate(context);
} catch (error) {
  if (error instanceof PluginError) {
    console.error(error.message);
  } else {
    console.error(`插件执行异常：${error.message}`);
  }
}
```

### 3. 支持插件依赖

```javascript
// 插件依赖声明
module.exports = {
  name: 'my-plugin',
  dependencies: ['eslint-plugin'],  // 依赖其他插件
  peerDependencies: {
    '@my-cli/core': '>=1.0.0'  // 对端依赖
  },
  hooks: {
    afterCreate: async (context) => {
      // 确保依赖插件已加载
      const eslintPlugin = context.getPlugin('eslint-plugin');
      if (!eslintPlugin) {
        throw new Error('需要先安装 eslint-plugin');
      }
    }
  }
};
```

### 4. 提供插件开发工具

```javascript
// 插件开发工具
class PluginDevTools {
  // 测试插件
  static async test(pluginPath) {
    const plugin = require(pluginPath);
    const context = createMockContext();
    
    // 测试所有钩子
    for (const hook of Object.keys(plugin.hooks || {})) {
      console.log(`测试钩子：${hook}`);
      await plugin.hooks[hook](context);
    }
    
    console.log('测试通过！');
  }

  // 调试插件
  static async debug(pluginPath) {
    const plugin = require(pluginPath);
    const context = createDebugContext();
    
    // 添加调试日志
    const originalCopy = context.copyTemplate;
    context.copyTemplate = (...args) => {
      console.log('copyTemplate:', args);
      return originalCopy(...args);
    };
    
    // 执行插件
    for (const hook of Object.keys(plugin.hooks || {})) {
      console.log(`\n执行钩子：${hook}`);
      await plugin.hooks[hook](context);
    }
  }
}

module.exports = PluginDevTools;
```

## 本课小结

本课我们学习了插件机制设计：

1. **核心概念**：插件、钩子系统、插件接口
2. **插件加载**：发现、加载、配置
3. **插件沙箱**：安全执行、插件隔离
4. **内置插件**：ESLint、Prettier、Storybook
5. **插件开发**：结构、模板、测试
6. **插件生态**：市场、文档、开发工具

## 练习

### 练习一：实现一个插件

实现一个 TypeScript 插件，支持：
- 复制 tsconfig.json 模板
- 安装 TypeScript 相关依赖
- 配置 TypeScript 编译选项

### 练习二：实现插件管理命令

实现以下插件管理命令：
- `my-cli plugin list`：列出已安装插件
- `my-cli plugin install <name>`：安装插件
- `my-cli plugin uninstall <name>`：卸载插件

## 参考答案

### 练习一

```javascript
// plugins/typescript-plugin.js
module.exports = {
  name: 'typescript-plugin',
  description: '添加 TypeScript 配置',
  version: '1.0.0',

  hooks: {
    afterCreate: async (context) => {
      console.log('正在配置 TypeScript...');

      // 复制配置文件
      context.copyTemplate('typescript/tsconfig.json', 'tsconfig.json');
      context.copyTemplate('typescript/tsconfig.node.json', 'tsconfig.node.json');

      // 安装依赖
      await context.installDependencies([
        'typescript',
        '@types/react',
        '@types/react-dom',
        'vite-plugin-checker'
      ]);

      // 更新 package.json
      const packageJson = context.readJson('package.json');
      packageJson.scripts = {
        ...packageJson.scripts,
        'type-check': 'tsc --noEmit',
        'type-watch': 'tsc --noEmit --watch'
      };
      context.writeJson('package.json', packageJson);

      console.log('TypeScript 配置完成！');
    }
  }
};
```

### 练习二

```javascript
// commands/plugin.js
const { program } = require('commander');
const PluginManager = require('../plugin-manager');
const PluginMarket = require('../plugin-market');

const pluginManager = new PluginManager();
const pluginMarket = new PluginMarket();

program
  .command('plugin')
  .description('插件管理')
  .addCommand(
    program
      .command('list')
      .description('列出已安装插件')
      .action(() => {
        const plugins = pluginManager.list();
        console.log('已安装插件：');
        plugins.forEach(p => {
          console.log(`  ${p.name} - ${p.description} (${p.version})`);
        });
      })
  )
  .addCommand(
    program
      .command('install <name>')
      .description('安装插件')
      .action(async (name) => {
        console.log(`正在安装插件：${name}`);
        await pluginMarket.install(name);
        console.log('安装完成！');
      })
  )
  .addCommand(
    program
      .command('uninstall <name>')
      .description('卸载插件')
      .action(async (name) => {
        console.log(`正在卸载插件：${name}`);
        const { execSync } = require('child_process');
        execSync(`npm uninstall ${name}`, { stdio: 'inherit' });
        console.log('卸载完成！');
      })
  )
  .addCommand(
    program
      .command('search <keyword>')
      .description('搜索插件')
      .action(async (keyword) => {
        const plugins = await pluginMarket.search(keyword);
        console.log('搜索结果：');
        plugins.forEach(p => {
          console.log(`  ${p.name} - ${p.description}`);
        });
      })
  );
```

## 下一步

完成本课后，继续学习 [07. 脚手架测试与维护](./07-scaffolding-testing-maintenance.md)。