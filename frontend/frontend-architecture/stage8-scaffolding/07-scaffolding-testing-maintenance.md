# 07. 脚手架测试与维护

> 脚手架的输出是代码文件，测试和维护策略应该围绕"生成代码的正确性"来设计

## 本课目标

- 掌握脚手架测试的核心策略
- 实现 E2E 测试和快照测试
- 建立版本升级和迁移机制
- 制定脚手架的维护规范

## 从一个真实场景说起

假设你在用一个脚手架工具，遇到了这些问题：

1. **测试困难**：脚手架生成的是文件，不是函数返回值，传统测试方法不适用
2. **版本升级**：脚手架升级后，已生成的项目不兼容
3. **维护成本**：模板文件太多，修改一个地方要改很多文件
4. **文档缺失**：不知道每个配置项的含义，不敢随便改

这些问题的根源是**测试和维护策略不完善**。

好的测试和维护策略应该：
- 验证生成文件的正确性
- 支持版本升级和迁移
- 降低维护成本
- 提供清晰的文档

## 测试策略

### 测试金字塔

```
        E2E 测试
       /        \
    集成测试
   /            \
  单元测试
```

对于脚手架，测试重点是：
- **E2E 测试**：验证完整生成流程
- **快照测试**：验证生成文件的内容
- **单元测试**：验证工具函数

### E2E 测试

```javascript
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

describe('脚手架 E2E 测试', () => {
  let tempDir;

  beforeEach(() => {
    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
  });

  afterEach(() => {
    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('应该成功创建 React 项目', () => {
    const projectName = 'test-react-app';
    const projectPath = path.join(tempDir, projectName);

    // 执行创建命令
    execSync(
      `node bin/my-cli.js create ${projectName} --template react --typescript`,
      { cwd: tempDir, stdio: 'pipe' }
    );

    // 验证目录结构
    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'tsconfig.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'src'))).toBe(true);

    // 验证 package.json 内容
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')
    );
    expect(packageJson.name).toBe(projectName);
    expect(packageJson.dependencies.react).toBeDefined();
    expect(packageJson.devDependencies.typescript).toBeDefined();
  });

  it('应该成功创建 Vue 项目', () => {
    const projectName = 'test-vue-app';
    const projectPath = path.join(tempDir, projectName);

    execSync(
      `node bin/my-cli.js create ${projectName} --template vue`,
      { cwd: tempDir, stdio: 'pipe' }
    );

    expect(fs.existsSync(projectPath)).toBe(true);
    expect(fs.existsSync(path.join(projectPath, 'src'))).toBe(true);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')
    );
    expect(packageJson.dependencies.vue).toBeDefined();
  });

  it('应该在目录已存在时给出错误提示', () => {
    const projectName = 'existing-app';
    const projectPath = path.join(tempDir, projectName);

    // 创建目录
    fs.mkdirSync(projectPath);

    // 执行创建命令
    expect(() => {
      execSync(
        `node bin/my-cli.js create ${projectName}`,
        { cwd: tempDir, stdio: 'pipe' }
      );
    }).toThrow();
  });
});
```

### 快照测试

```javascript
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

describe('快照测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-snapshot-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('package.json 应该匹配快照', () => {
    const projectName = 'snapshot-test';
    const projectPath = path.join(tempDir, projectName);

    execSync(
      `node bin/my-cli.js create ${projectName} --template react`,
      { cwd: tempDir, stdio: 'pipe' }
    );

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')
    );

    // 忽略版本号
    delete packageJson.version;
    Object.values(packageJson.dependencies || {}).forEach(dep => {
      dep.version = 'x.x.x';
    });
    Object.values(packageJson.devDependencies || {}).forEach(dep => {
      dep.version = 'x.x.x';
    });

    expect(packageJson).toMatchSnapshot();
  });

  it('tsconfig.json 应该匹配快照', () => {
    const projectName = 'snapshot-test';
    const projectPath = path.join(tempDir, projectName);

    execSync(
      `node bin/my-cli.js create ${projectName} --template react --typescript`,
      { cwd: tempDir, stdio: 'pipe' }
    );

    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(projectPath, 'tsconfig.json'), 'utf-8')
    );

    expect(tsconfig).toMatchSnapshot();
  });

  it('index.tsx 应该匹配快照', () => {
    const projectName = 'snapshot-test';
    const projectPath = path.join(tempDir, projectName);

    execSync(
      `node bin/my-cli.js create ${projectName} --template react --typescript`,
      { cwd: tempDir, stdio: 'pipe' }
    );

    const indexTsx = fs.readFileSync(
      path.join(projectPath, 'src/index.tsx'),
      'utf-8'
    );

    expect(indexTsx).toMatchSnapshot();
  });
});
```

### 单元测试

```javascript
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('工具函数单元测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('copyTemplate', () => {
    it('应该正确复制模板文件', () => {
      const source = path.join(tempDir, 'source');
      const target = path.join(tempDir, 'target');

      // 创建源文件
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(path.join(source, 'file.txt'), 'hello');

      // 执行复制
      copyTemplate(source, target);

      // 验证结果
      expect(fs.existsSync(path.join(target, 'file.txt'))).toBe(true);
      expect(
        fs.readFileSync(path.join(target, 'file.txt'), 'utf-8')
      ).toBe('hello');
    });

    it('应该替换模板变量', () => {
      const source = path.join(tempDir, 'source');
      const target = path.join(tempDir, 'target');

      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(
        path.join(source, 'file.txt'),
        'Hello {{name}}!'
      );

      copyTemplate(source, target, { name: 'World' });

      expect(
        fs.readFileSync(path.join(target, 'file.txt'), 'utf-8')
      ).toBe('Hello World!');
    });
  });

  describe('validateProjectName', () => {
    it('应该接受有效的项目名称', () => {
      expect(validateProjectName('my-app')).toBe(true);
      expect(validateProjectName('myApp')).toBe(true);
      expect(validateProjectName('my_app')).toBe(true);
      expect(validateProjectName('my-app-123')).toBe(true);
    });

    it('应该拒绝无效的项目名称', () => {
      expect(validateProjectName('')).toBe(false);
      expect(validateProjectName('123-app')).toBe(false);
      expect(validateProjectName('-app')).toBe(false);
      expect(validateProjectName('my app')).toBe(false);
      expect(validateProjectName('my@pp')).toBe(false);
    });
  });

  describe('mergeConfig', () => {
    it('应该正确合并配置', () => {
      const base = {
        a: 1,
        b: { c: 2, d: 3 },
        e: [1, 2]
      };

      const override = {
        b: { c: 4 },
        e: [3, 4],
        f: 5
      };

      const result = mergeConfig(base, override);

      expect(result).toEqual({
        a: 1,
        b: { c: 4, d: 3 },
        e: [3, 4],
        f: 5
      });
    });
  });
});
```

## 快照测试深入

### Jest 快照配置

```javascript
// jest.config.js
module.exports = {
  testMatch: ['**/__tests__/**/*.test.js'],
  snapshotSerializers: [],
  // 自定义快照序列化
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true
  }
};
```

### 快照更新策略

```bash
# 更新所有快照
npx jest --updateSnapshot

# 更新特定测试的快照
npx jest --updateSnapshot --testNamePattern="package.json"

# 交互式更新
npx jest --updateSnapshot --interactive
```

### 快照文件管理

```
__tests__/
├── snapshots/
│   ├── E2E 测试应该成功创建 React 项目.snap
│   ├── package.json 应该匹配快照.snap
│   └── tsconfig.json 应该匹配快照.snap
└── *.test.js
```

## 版本升级策略

### 版本号规范

```json
{
  "name": "my-cli",
  "version": "1.2.3"
}
```

- **主版本号（1）**：不兼容的 API 修改
- **次版本号（2）**：向下兼容的功能性新增
- **修订号（3）**：向下兼容的问题修正

### 变更日志

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added
- 添加 Storybook 插件支持
- 添加 `--dry-run` 参数

### Changed
- 优化项目创建速度
- 改进错误提示信息

### Fixed
- 修复 TypeScript 模板中的类型错误
- 修复 Windows 路径兼容问题

## [1.1.0] - 2024-01-01

### Added
- 添加 Vue 模板支持
- 添加配置校验功能

### Fixed
- 修复 ESLint 配置问题
```

### 迁移脚本

```javascript
const fs = require('fs');
const path = require('path');

class MigrationRunner {
  constructor(configPath) {
    this.configPath = configPath;
    this.migrations = this.loadMigrations();
  }

  loadMigrations() {
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      return [];
    }

    return fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.js'))
      .sort()
      .map(f => require(path.join(migrationsDir, f)));
  }

  async run(currentVersion, targetVersion) {
    const pendingMigrations = this.migrations.filter(m => {
      return (
        this.compareVersions(m.version, currentVersion) > 0 &&
        this.compareVersions(m.version, targetVersion) <= 0
      );
    });

    for (const migration of pendingMigrations) {
      console.log(`执行迁移：${migration.version}`);
      await migration.up(this.configPath);
      console.log(`迁移完成：${migration.version}`);
    }
  }

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  }
}

module.exports = MigrationRunner;
```

### 迁移文件示例

```javascript
// migrations/1.0.0-to-1.1.0.js
module.exports = {
  version: '1.1.0',
  description: '添加 Vue 模板支持',

  async up(configPath) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // 添加 Vue 模板支持
    config.templates = config.templates || {};
    config.templates.vue = {
      enabled: true,
      features: ['typescript', 'eslint', 'prettier']
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  },

  async down(configPath) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // 移除 Vue 模板支持
    delete config.templates?.vue;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
};
```

## 维护规范

### 代码组织

```
my-cli/
├── bin/                    # 入口文件
├── src/
│   ├── commands/           # 命令实现
│   ├── plugins/            # 插件
│   ├── templates/          # 模板文件
│   ├── utils/              # 工具函数
│   └── index.js            # 主入口
├── __tests__/              # 测试文件
│   ├── e2e/                # E2E 测试
│   ├── unit/               # 单元测试
│   └── snapshots/          # 快照文件
├── docs/                   # 文档
├── migrations/             # 迁移脚本
├── package.json
└── README.md
```

### 文档规范

```markdown
# my-cli

## 安装

```bash
npm install -g my-cli
```

## 使用

### 创建项目

```bash
my-cli create my-app
```

### 生成组件

```bash
my-cli generate component MyComponent
```

## 配置

### 配置文件

- 全局配置：`~/.myclirc`
- 项目配置：`.myclirc`

### 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| template | string | 'react' | 项目模板 |
| features.typescript | boolean | true | 是否启用 TypeScript |
| features.eslint | boolean | true | 是否启用 ESLint |

## 插件

### 内置插件

- eslint-plugin：ESLint 配置
- prettier-plugin：Prettier 配置
- storybook-plugin：Storybook 配置

### 自定义插件

参考 [插件开发指南](./docs/plugin-development.md)。

## 版本升级

参考 [迁移指南](./docs/migration.md)。
```

### 贡献指南

```markdown
# 贡献指南

## 开发环境

```bash
git clone https://github.com/user/my-cli.git
cd my-cli
npm install
npm link
```

## 开发流程

1. 创建分支：`git checkout -b feature/xxx`
2. 编写代码
3. 编写测试
4. 运行测试：`npm test`
5. 提交代码：`git commit -m "feat: 添加 xxx 功能"`
6. 创建 PR

## 代码规范

- 使用 ESLint 检查代码
- 使用 Prettier 格式化代码
- 遵循 Conventional Commits 规范

## 测试要求

- 新功能必须有测试覆盖
- Bug 修复必须有回归测试
- 快照测试必须更新
```

## 维护最佳实践

### 1. 自动化发布

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - run: npm ci
      
      - run: npm test
      
      - run: npm run build
      
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 2. 依赖更新

```yaml
# .github/workflows/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

### 3. 问题模板

```markdown
<!-- .github/ISSUE_TEMPLATE/bug_report.md -->
---
name: Bug 报告
about: 报告一个 bug
title: '[Bug] '
labels: bug
---

## 描述

简要描述 bug。

## 复现步骤

1. 运行 '...'
2. 选择 '...'
3. 看到错误 '...'

## 期望行为

描述期望的行为。

## 实际行为

描述实际的行为。

## 环境信息

- OS: [例如 macOS 13.0]
- Node.js 版本: [例如 18.12.0]
- my-cli 版本: [例如 1.2.0]

## 附加信息

添加任何其他上下文信息。
```

### 4. 版本发布检查清单

```markdown
## 版本发布检查清单

### 发布前

- [ ] 所有测试通过
- [ ] 代码已合并到 main 分支
- [ ] 版本号已更新
- [ ] 变更日志已更新
- [ ] 文档已更新

### 发布中

- [ ] 创建 Git tag
- [ ] 推送到 npm
- [ ] 创建 GitHub Release

### 发布后

- [ ] 验证安装正常
- [ ] 验证功能正常
- [ ] 通知团队成员
```

## 本课小结

本课我们学习了脚手架测试与维护：

1. **测试策略**：E2E 测试、快照测试、单元测试
2. **快照测试**：验证生成文件的内容
3. **版本升级**：版本号规范、变更日志、迁移脚本
4. **维护规范**：代码组织、文档规范、贡献指南
5. **最佳实践**：自动化发布、依赖更新、问题模板

## 练习

### 练习一：编写 E2E 测试

为脚手架编写完整的 E2E 测试：
- 测试创建 React 项目
- 测试创建 Vue 项目
- 测试错误情况

### 练习二：制定维护规范

为你的脚手架制定维护规范：
- 代码组织规范
- 文档规范
- 贡献指南

## 参考答案

### 练习一

```javascript
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

describe('脚手架 E2E 测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('创建项目', () => {
    it('应该成功创建 React 项目', () => {
      const projectName = 'test-react';
      const projectPath = path.join(tempDir, projectName);

      execSync(
        `node bin/my-cli.js create ${projectName} --template react`,
        { cwd: tempDir, stdio: 'pipe' }
      );

      expect(fs.existsSync(projectPath)).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src'))).toBe(true);

      const packageJson = JSON.parse(
        fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')
      );
      expect(packageJson.name).toBe(projectName);
      expect(packageJson.dependencies.react).toBeDefined();
    });

    it('应该成功创建 Vue 项目', () => {
      const projectName = 'test-vue';
      const projectPath = path.join(tempDir, projectName);

      execSync(
        `node bin/my-cli.js create ${projectName} --template vue`,
        { cwd: tempDir, stdio: 'pipe' }
      );

      expect(fs.existsSync(projectPath)).toBe(true);
      expect(fs.existsSync(path.join(projectPath, 'src'))).toBe(true);

      const packageJson = JSON.parse(
        fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')
      );
      expect(packageJson.dependencies.vue).toBeDefined();
    });

    it('应该成功创建 TypeScript 项目', () => {
      const projectName = 'test-ts';
      const projectPath = path.join(tempDir, projectName);

      execSync(
        `node bin/my-cli.js create ${projectName} --template react --typescript`,
        { cwd: tempDir, stdio: 'pipe' }
      );

      expect(fs.existsSync(path.join(projectPath, 'tsconfig.json'))).toBe(true);

      const packageJson = JSON.parse(
        fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')
      );
      expect(packageJson.devDependencies.typescript).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该在目录已存在时给出错误', () => {
      const projectName = 'existing';
      const projectPath = path.join(tempDir, projectName);

      fs.mkdirSync(projectPath);

      expect(() => {
        execSync(
          `node bin/my-cli.js create ${projectName}`,
          { cwd: tempDir, stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('应该在无效模板时给出错误', () => {
      expect(() => {
        execSync(
          `node bin/my-cli.js create test --template invalid`,
          { cwd: tempDir, stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('应该在项目名称无效时给出错误', () => {
      expect(() => {
        execSync(
          `node bin/my-cli.js create "123-invalid"`,
          { cwd: tempDir, stdio: 'pipe' }
        );
      }).toThrow();
    });
  });

  describe('生成命令', () => {
    let projectPath;

    beforeEach(() => {
      const projectName = 'gen-test';
      projectPath = path.join(tempDir, projectName);

      execSync(
        `node bin/my-cli.js create ${projectName} --template react`,
        { cwd: tempDir, stdio: 'pipe' }
      );
    });

    it('应该成功生成组件', () => {
      execSync(
        `node bin/my-cli.js generate component Button`,
        { cwd: projectPath, stdio: 'pipe' }
      );

      expect(
        fs.existsSync(path.join(projectPath, 'src/components/Button.tsx'))
      ).toBe(true);
    });

    it('应该成功生成页面', () => {
      execSync(
        `node bin/my-cli.js generate page Home`,
        { cwd: projectPath, stdio: 'pipe' }
      );

      expect(
        fs.existsSync(path.join(projectPath, 'src/pages/Home.tsx'))
      ).toBe(true);
    });
  });
});
```

### 练习二

```markdown
# 脚手架维护规范

## 代码组织

```
my-cli/
├── bin/                    # CLI 入口
├── src/
│   ├── commands/           # 命令实现
│   ├── plugins/            # 内置插件
│   ├── templates/          # 模板文件
│   ├── utils/              # 工具函数
│   └── index.js            # 主入口
├── __tests__/              # 测试
│   ├── e2e/                # E2E 测试
│   ├── unit/               # 单元测试
│   └── snapshots/          # 快照
├── docs/                   # 文档
├── migrations/             # 迁移脚本
└── package.json
```

## 提交规范

使用 Conventional Commits：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式（不影响功能）
- `refactor:` 重构
- `test:` 测试
- `chore:` 构建/工具

## 分支规范

- `main`: 稳定分支
- `develop`: 开发分支
- `feature/*`: 功能分支
- `fix/*`: 修复分支
- `release/*`: 发布分支

## 发布流程

1. 更新版本号
2. 更新 CHANGELOG.md
3. 运行测试
4. 创建 Git tag
5. 推送到 npm
6. 创建 GitHub Release

## 文档维护

- README.md：项目介绍和快速开始
- CONTRIBUTING.md：贡献指南
- CHANGELOG.md：版本变更日志
- docs/：详细文档
```

## 下一步

完成本课后，继续学习 [08. 阶段项目：开发一个企业级脚手架工具](./08-stage-project.md)。