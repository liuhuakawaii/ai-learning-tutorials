# 08. 阶段项目：开发一个企业级脚手架工具

> 把前面学到的所有知识整合起来，开发一个完整的、可投入生产使用的脚手架工具

## 本课目标

- 综合运用前 7 课的知识
- 开发一个完整的企业级脚手架工具
- 实现项目创建、代码生成、插件管理等核心功能
- 编写测试、文档，确保工具质量

## 项目概述

### 项目名称

`my-cli` - 企业级前端脚手架工具

### 核心功能

1. **创建项目**：`my-cli create <project-name>`
   - 支持选择模板（React/Vue/Node.js）
   - 支持选择功能（TypeScript/ESLint/Prettier 等）
   - 支持选择预设配置
   - 自动安装依赖
   - 初始化 Git

2. **生成代码**：`my-cli generate <type> <name>`
   - 生成组件
   - 生成页面
   - 生成自定义 Hook

3. **管理插件**：`my-cli plugin <command>`
   - 列出已安装插件
   - 安装插件
   - 卸载插件

4. **管理预设**：`my-cli preset <command>`
   - 列出可用预设
   - 应用预设
   - 创建预设

### 技术栈

- **CLI 框架**：Commander.js
- **交互问答**：Inquirer.js
- **进度反馈**：Ora
- **模板引擎**：EJS
- **测试框架**：Jest

## 项目结构

```
my-cli/
├── package.json
├── bin/
│   └── my-cli.js
├── src/
│   ├── commands/
│   │   ├── create.js
│   │   ├── generate.js
│   │   ├── plugin.js
│   │   └── preset.js
│   ├── plugins/
│   │   ├── eslint-plugin.js
│   │   ├── prettier-plugin.js
│   │   ├── typescript-plugin.js
│   │   └── storybook-plugin.js
│   ├── templates/
│   │   ├── react/
│   │   ├── vue/
│   │   └── node/
│   ├── utils/
│   │   ├── config.js
│   │   ├── file.js
│   │   ├── logger.js
│   │   └── validator.js
│   └── index.js
├── __tests__/
│   ├── e2e/
│   ├── unit/
│   └── snapshots/
├── docs/
│   ├── README.md
│   ├── COMMANDS.md
│   └── PLUGINS.md
└── README.md
```

## 实现步骤

### 第一步：初始化项目

```bash
mkdir my-cli
cd my-cli
npm init -y
npm install commander inquirer ora ejs
npm install -D jest @types/jest
```

### 第二步：创建入口文件

```javascript
#!/usr/bin/env node
const { program } = require('commander');
const pkg = require('../package.json');

program
  .name('my-cli')
  .description('企业级前端脚手架工具')
  .version(pkg.version);

// 注册命令
require('../src/commands/create')(program);
require('../src/commands/generate')(program);
require('../src/commands/plugin')(program);
require('../src/commands/preset')(program);

program.parse();
```

### 第三步：实现创建命令

```javascript
// src/commands/create.js
const inquirer = require('inquirer');
const ora = require('ora');
const path = require('path');
const fs = require('fs');

module.exports = function(program) {
  program
    .command('create <project-name>')
    .description('创建新项目')
    .option('-t, --template <template>', '选择模板', 'react')
    .option('--typescript', '使用 TypeScript')
    .option('--eslint', '添加 ESLint')
    .option('--prettier', '添加 Prettier')
    .action(async (projectName, options) => {
      // 验证项目名称
      if (!validateProjectName(projectName)) {
        console.error('无效的项目名称');
        process.exit(1);
      }

      // 检查目录是否已存在
      const projectPath = path.join(process.cwd(), projectName);
      if (fs.existsSync(projectPath)) {
        console.error(`目录 ${projectName} 已存在`);
        process.exit(1);
      }

      // 如果没有提供命令行参数，进行交互式问答
      let answers;
      if (!options.template) {
        answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'template',
            message: '选择模板：',
            choices: [
              { name: 'React + TypeScript', value: 'react' },
              { name: 'Vue + TypeScript', value: 'vue' },
              { name: 'Node.js + TypeScript', value: 'node' }
            ]
          },
          {
            type: 'checkbox',
            name: 'features',
            message: '选择功能：',
            choices: [
              { name: 'TypeScript', value: 'typescript', checked: true },
              { name: 'ESLint', value: 'eslint', checked: true },
              { name: 'Prettier', value: 'prettier', checked: true },
              { name: 'Husky', value: 'husky' },
              { name: 'Storybook', value: 'storybook' }
            ]
          },
          {
            type: 'confirm',
            name: 'useGit',
            message: '初始化 Git？',
            default: true
          }
        ]);
      } else {
        answers = {
          template: options.template,
          features: {
            typescript: options.typescript || true,
            eslint: options.eslint || true,
            prettier: options.prettier || true
          },
          useGit: true
        };
      }

      // 创建项目
      const spinner = ora('正在创建项目...').start();

      try {
        // 创建目录
        fs.mkdirSync(projectPath, { recursive: true });

        // 复制模板
        const templateDir = path.join(__dirname, '../../templates', answers.template);
        await copyTemplate(templateDir, projectPath, {
          projectName,
          features: answers.features
        });

        // 安装依赖
        spinner.text = '正在安装依赖...';
        await installDependencies(projectPath);

        // 初始化 Git
        if (answers.useGit) {
          spinner.text = '正在初始化 Git...';
          await initGit(projectPath);
        }

        spinner.succeed('项目创建成功！');

        console.log('\n下一步：');
        console.log(`  cd ${projectName}`);
        console.log('  npm run dev');

      } catch (error) {
        spinner.fail('项目创建失败');
        console.error(error);
        process.exit(1);
      }
    });
};
```

### 第四步：实现生成命令

```javascript
// src/commands/generate.js
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs');

module.exports = function(program) {
  program
    .command('generate <type> <name>')
    .alias('g')
    .description('生成代码')
    .action(async (type, name) => {
      // 验证类型
      const validTypes = ['component', 'page', 'hook'];
      if (!validTypes.includes(type)) {
        console.error(`无效的类型：${type}`);
        console.error(`可用类型：${validTypes.join(', ')}`);
        process.exit(1);
      }

      // 验证名称
      if (!name || name.trim() === '') {
        console.error('名称不能为空');
        process.exit(1);
      }

      // 根据类型生成代码
      switch (type) {
        case 'component':
          await generateComponent(name);
          break;
        case 'page':
          await generatePage(name);
          break;
        case 'hook':
          await generateHook(name);
          break;
      }

      console.log(`✓ ${type} ${name} 生成成功！`);
    });
};

async function generateComponent(name) {
  const targetDir = path.join(process.cwd(), 'src/components', name);
  fs.mkdirSync(targetDir, { recursive: true });

  // 生成组件文件
  const componentContent = `import React from 'react';

interface ${name}Props {
  // 定义 props
}

export const ${name}: React.FC<${name}Props> = (props) => {
  return (
    <div>
      ${name}
    </div>
  );
};

export default ${name};
`;
  fs.writeFileSync(path.join(targetDir, `${name}.tsx`), componentContent);

  // 生成 index 文件
  const indexContent = `export { default as ${name} } from './${name}';
export type { ${name}Props } from './${name}';
`;
  fs.writeFileSync(path.join(targetDir, 'index.ts'), indexContent);
}

async function generatePage(name) {
  const targetDir = path.join(process.cwd(), 'src/pages', name);
  fs.mkdirSync(targetDir, { recursive: true });

  // 生成页面文件
  const pageContent = `import React from 'react';

const ${name}Page: React.FC = () => {
  return (
    <div>
      <h1>${name}</h1>
    </div>
  );
};

export default ${name}Page;
`;
  fs.writeFileSync(path.join(targetDir, `${name}Page.tsx`), pageContent);

  // 生成 index 文件
  const indexContent = `export { default as ${name}Page } from './${name}Page';
`;
  fs.writeFileSync(path.join(targetDir, 'index.ts'), indexContent);
}

async function generateHook(name) {
  const targetDir = path.join(process.cwd(), 'src/hooks');
  fs.mkdirSync(targetDir, { recursive: true });

  // 生成 Hook 文件
  const hookContent = `import { useState, useEffect } from 'react';

export function ${name}() {
  const [state, setState] = useState(null);

  useEffect(() => {
    // 实现 Hook 逻辑
  }, []);

  return state;
}
`;
  fs.writeFileSync(path.join(targetDir, `${name}.ts`), hookContent);
}
```

### 第五步：实现插件命令

```javascript
// src/commands/plugin.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = function(program) {
  program
    .command('plugin')
    .description('插件管理')
    .command('list')
    .description('列出已安装插件')
    .action(() => {
      const configPath = path.join(process.cwd(), '.myclirc');
      if (!fs.existsSync(configPath)) {
        console.log('未找到配置文件');
        return;
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const plugins = config.plugins || [];

      console.log('已安装插件：');
      if (plugins.length === 0) {
        console.log('  暂无插件');
      } else {
        plugins.forEach(plugin => {
          console.log(`  - ${plugin}`);
        });
      }
    });

  program
    .command('plugin install <name>')
    .description('安装插件')
    .action(async (name) => {
      console.log(`正在安装插件：${name}`);

      try {
        // 安装 npm 包
        execSync(`npm install ${name}`, { stdio: 'inherit' });

        // 更新配置文件
        const configPath = path.join(process.cwd(), '.myclirc');
        let config = {};
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }

        config.plugins = config.plugins || [];
        if (!config.plugins.includes(name)) {
          config.plugins.push(name);
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

        console.log(`插件 ${name} 安装成功！`);
      } catch (error) {
        console.error(`插件安装失败：${error.message}`);
        process.exit(1);
      }
    });

  program
    .command('plugin uninstall <name>')
    .description('卸载插件')
    .action(async (name) => {
      console.log(`正在卸载插件：${name}`);

      try {
        // 卸载 npm 包
        execSync(`npm uninstall ${name}`, { stdio: 'inherit' });

        // 更新配置文件
        const configPath = path.join(process.cwd(), '.myclirc');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          config.plugins = (config.plugins || []).filter(p => p !== name);
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }

        console.log(`插件 ${name} 卸载成功！`);
      } catch (error) {
        console.error(`插件卸载失败：${error.message}`);
        process.exit(1);
      }
    });
};
```

### 第六步：实现预设命令

```javascript
// src/commands/preset.js
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = function(program) {
  const presetsDir = path.join(os.homedir(), '.my-cli', 'presets');

  // 确保预设目录存在
  if (!fs.existsSync(presetsDir)) {
    fs.mkdirSync(presetsDir, { recursive: true });
  }

  program
    .command('preset')
    .description('预设管理')
    .command('list')
    .description('列出可用预设')
    .action(() => {
      const files = fs.readdirSync(presetsDir);
      const presets = files
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const content = JSON.parse(
            fs.readFileSync(path.join(presetsDir, f), 'utf-8')
          );
          return {
            name: path.basename(f, '.json'),
            description: content.description || ''
          };
        });

      console.log('可用预设：');
      if (presets.length === 0) {
        console.log('  暂无预设');
      } else {
        presets.forEach(preset => {
          console.log(`  ${preset.name}: ${preset.description}`);
        });
      }
    });

  program
    .command('preset use <name>')
    .description('应用预设')
    .action((name) => {
      const presetPath = path.join(presetsDir, `${name}.json`);
      if (!fs.existsSync(presetPath)) {
        console.error(`预设 ${name} 不存在`);
        process.exit(1);
      }

      const preset = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));

      // 应用预设到当前项目
      const configPath = path.join(process.cwd(), '.myclirc');
      let config = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }

      // 合并配置
      config = mergeConfig(config, preset);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      console.log(`预设 ${name} 应用成功！`);
    });

  program
    .command('preset create')
    .description('创建预设')
    .action(async () => {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '预设名称：',
          validate: (input) => {
            if (!input || input.trim() === '') {
              return '预设名称不能为空';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'description',
          message: '预设描述：'
        },
        {
          type: 'checkbox',
          name: 'features',
          message: '选择功能：',
          choices: [
            { name: 'TypeScript', value: 'typescript', checked: true },
            { name: 'ESLint', value: 'eslint', checked: true },
            { name: 'Prettier', value: 'prettier', checked: true },
            { name: 'Husky', value: 'husky' },
            { name: 'Storybook', value: 'storybook' }
          ]
        }
      ]);

      const preset = {
        name: answers.name,
        description: answers.description,
        features: answers.features.reduce((acc, f) => {
          acc[f] = true;
          return acc;
        }, {})
      };

      const presetPath = path.join(presetsDir, `${answers.name}.json`);
      fs.writeFileSync(presetPath, JSON.stringify(preset, null, 2));

      console.log(`预设 ${answers.name} 创建成功！`);
    });
};

function mergeConfig(base, override) {
  const merged = { ...base };

  Object.keys(override).forEach(key => {
    if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      merged[key] = mergeConfig(merged[key] || {}, override[key]);
    } else {
      merged[key] = override[key];
    }
  });

  return merged;
}
```

### 第七步：实现工具函数

```javascript
// src/utils/validator.js
function validateProjectName(name) {
  if (!name || name.trim() === '') {
    return false;
  }

  // 只允许字母、数字、下划线和连字符，且以字母开头
  return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name);
}

module.exports = { validateProjectName };
```

```javascript
// src/utils/file.js
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

function copyTemplate(source, target, variables = {}) {
  const items = fs.readdirSync(source);

  items.forEach(item => {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);

    if (fs.statSync(sourcePath).isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyTemplate(sourcePath, targetPath, variables);
    } else if (item.endsWith('.ejs')) {
      // 处理 EJS 模板
      const content = fs.readFileSync(sourcePath, 'utf-8');
      const rendered = ejs.render(content, variables);
      fs.writeFileSync(targetPath.replace('.ejs', ''), rendered);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

async function installDependencies(projectPath) {
  const { execSync } = require('child_process');
  execSync('npm install', {
    cwd: projectPath,
    stdio: 'inherit'
  });
}

async function initGit(projectPath) {
  const { execSync } = require('child_process');
  execSync('git init', {
    cwd: projectPath,
    stdio: 'inherit'
  });
  execSync('git add .', {
    cwd: projectPath,
    stdio: 'inherit'
  });
  execSync('git commit -m "Initial commit"', {
    cwd: projectPath,
    stdio: 'inherit'
  });
}

module.exports = {
  copyTemplate,
  installDependencies,
  initGit
};
```

### 第八步：编写测试

```javascript
// __tests__/unit/validator.test.js
const { validateProjectName } = require('../../src/utils/validator');

describe('validateProjectName', () => {
  it('应该接受有效的项目名称', () => {
    expect(validateProjectName('my-app')).toBe(true);
    expect(validateProjectName('myApp')).toBe(true);
    expect(validateProjectName('my_app')).toBe(true);
    expect(validateProjectName('my-app-123')).toBe(true);
    expect(validateProjectName('App')).toBe(true);
  });

  it('应该拒绝无效的项目名称', () => {
    expect(validateProjectName('')).toBe(false);
    expect(validateProjectName(' ')).toBe(false);
    expect(validateProjectName('123-app')).toBe(false);
    expect(validateProjectName('-app')).toBe(false);
    expect(validateProjectName('_app')).toBe(false);
    expect(validateProjectName('my app')).toBe(false);
    expect(validateProjectName('my@pp')).toBe(false);
  });
});
```

```javascript
// __tests__/e2e/create.test.js
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

describe('create 命令 E2E 测试', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-cli-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

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
});
```

### 第九步：编写文档

```markdown
# my-cli

企业级前端脚手架工具。

## 安装

```bash
npm install -g my-cli
```

## 使用

### 创建项目

```bash
# 交互式创建
my-cli create my-app

# 指定模板
my-cli create my-app --template react

# 指定选项
my-cli create my-app --template react --typescript --eslint
```

### 生成代码

```bash
# 生成组件
my-cli generate component Button

# 生成页面
my-cli generate page Home

# 生成 Hook
my-cli generate hook useAuth
```

### 管理插件

```bash
# 列出已安装插件
my-cli plugin list

# 安装插件
my-cli plugin install @my-cli/storybook-plugin

# 卸载插件
my-cli plugin uninstall @my-cli/storybook-plugin
```

### 管理预设

```bash
# 列出可用预设
my-cli preset list

# 应用预设
my-cli preset use standard

# 创建预设
my-cli preset create
```

## 配置

配置文件支持：

- 全局配置：`~/.myclirc`
- 项目配置：`.myclirc`

```json
{
  "template": "react",
  "features": {
    "typescript": true,
    "eslint": true,
    "prettier": true
  },
  "plugins": [],
  "presets": ["standard"]
}
```

## 插件

### 内置插件

- `eslint-plugin`：ESLint 配置
- `prettier-plugin`：Prettier 配置
- `typescript-plugin`：TypeScript 配置
- `storybook-plugin`：Storybook 配置

### 开发插件

参考 [插件开发指南](./docs/PLUGINS.md)。

## 许可证

MIT
```

## 验收标准

### 功能验收

- [ ] `my-cli create my-app` 能正常创建项目
- [ ] 项目可直接运行（`npm run dev`）
- [ ] `my-cli generate component Button` 能正确生成组件
- [ ] `my-cli generate page Home` 能正确生成页面
- [ ] `my-cli plugin list` 能列出已安装插件
- [ ] `my-cli preset list` 能列出可用预设
- [ ] 切换预设后，生成的代码风格发生变化

### 质量验收

- [ ] 核心功能有单元测试覆盖
- [ ] 有完整的 E2E 测试
- [ ] 有清晰的文档
- [ ] 错误提示友好
- [ ] 支持命令行参数和交互式问答

## 下一步

完成本项目后，继续学习 [stage9：CI/CD 与发布体系](../stage9-cicd/README.md)。