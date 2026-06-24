# 02. CLI 工具开发

> 好的 CLI 工具应该像一位耐心的向导，而不是一台冷漠的机器

## 本课目标

- 掌握 Commander.js 构建 CLI 工具
- 使用 Inquirer.js 实现交互式问答
- 使用 Ora 提供友好的进度反馈
- 构建一个完整的 CLI 工具原型

## 从一个真实场景说起

你有没有用过这样的 CLI 工具：

```bash
# 体验很差的 CLI
$ my-cli create my-app
Error: Missing required option: --template
$ my-cli create my-app --template react
Error: Missing required option: --typescript
$ my-cli create my-app --template react --typescript
Error: Missing required option: --eslint
# ... 需要记住所有参数
```

```bash
# 体验很好的 CLI
$ my-cli create my-app
? 选择技术栈：(使用箭头键)
> React + TypeScript
  Vue + TypeScript
  Node.js + TypeScript
? 是否需要 ESLint？(Y/n) Y
? 是否需要 Prettier？(Y/n) Y
正在创建项目...
✓ 项目创建成功！
cd my-app && npm run dev
```

CLI 工具的体验直接影响用户对脚手架的第一印象。

## Commander.js：构建 CLI 骨架

Commander.js 是最流行的 Node.js CLI 框架，提供了命令定义、参数解析、帮助信息等功能。

### 基础用法

```bash
npm install commander
```

```javascript
#!/usr/bin/env node
const { program } = require('commander');

program
  .name('my-cli')
  .description('企业级脚手架工具')
  .version('1.0.0');

program
  .command('create <project-name>')
  .description('创建新项目')
  .action((projectName) => {
    console.log(`创建项目：${projectName}`);
  });

program.parse();
```

### 参数和选项

```javascript
program
  .command('create <project-name>')
  .description('创建新项目')
  .option('-t, --template <template>', '选择模板', 'react')
  .option('--typescript', '使用 TypeScript')
  .option('--eslint', '添加 ESLint')
  .action((projectName, options) => {
    console.log(`项目名称：${projectName}`);
    console.log(`模板：${options.template}`);
    console.log(`TypeScript：${options.typescript}`);
    console.log(`ESLint：${options.eslint}`);
  });
```

### 命令分组

```javascript
const createCommand = program
  .command('create')
  .description('创建相关命令');

createCommand
  .command('component <name>')
  .description('创建组件')
  .action((name) => {
    console.log(`创建组件：${name}`);
  });

createCommand
  .command('page <name>')
  .description('创建页面')
  .action((name) => {
    console.log(`创建页面：${name}`);
  });
```

### 选项验证

```javascript
program
  .command('create <project-name>')
  .option('-t, --template <template>', '选择模板')
  .action((projectName, options) => {
    const validTemplates = ['react', 'vue', 'node'];
    if (!validTemplates.includes(options.template)) {
      console.error(`无效模板：${options.template}`);
      console.error(`可用模板：${validTemplates.join(', ')}`);
      process.exit(1);
    }
  });
```

## Inquirer.js：交互式问答

Inquirer.js 提供了丰富的交互式问答组件，让 CLI 工具更友好。

### 基础用法

```bash
npm install inquirer
```

```javascript
const inquirer = require('inquirer');

async function prompt() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: '项目名称：',
      validate: (input) => {
        if (input.trim() === '') {
          return '项目名称不能为空';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'template',
      message: '选择模板：',
      choices: [
        { name: 'React + TypeScript', value: 'react-ts' },
        { name: 'Vue + TypeScript', value: 'vue-ts' },
        { name: 'Node.js + TypeScript', value: 'node-ts' }
      ]
    }
  ]);

  return answers;
}
```

### 问题类型

#### 输入框（input）

```javascript
{
  type: 'input',
  name: 'username',
  message: '用户名：',
  default: 'admin',
  validate: (input) => input.length > 0 || '用户名不能为空'
}
```

#### 列表选择（list）

```javascript
{
  type: 'list',
  name: 'framework',
  message: '选择框架：',
  choices: ['React', 'Vue', 'Angular'],
  default: 'React'
}
```

#### 复选框（checkbox）

```javascript
{
  type: 'checkbox',
  name: 'features',
  message: '选择功能：',
  choices: [
    { name: 'TypeScript', value: 'typescript', checked: true },
    { name: 'ESLint', value: 'eslint' },
    { name: 'Prettier', value: 'prettier' },
    { name: 'Storybook', value: 'storybook' }
  ]
}
```

#### 确认框（confirm）

```javascript
{
  type: 'confirm',
  name: 'useGit',
  message: '初始化 Git？',
  default: true
}
```

#### 密码输入（password）

```javascript
{
  type: 'password',
  name: 'token',
  message: '输入 Token：',
  mask: '*'
}
```

### 高级用法

#### 条件问题

```javascript
const answers = await inquirer.prompt([
  {
    type: 'confirm',
    name: 'useDatabase',
    message: '使用数据库？'
  },
  {
    type: 'list',
    name: 'database',
    message: '选择数据库：',
    choices: ['MySQL', 'PostgreSQL', 'MongoDB'],
    when: (answers) => answers.useDatabase
  }
]);
```

#### 表单验证

```javascript
const answers = await inquirer.prompt([
  {
    type: 'input',
    name: 'email',
    message: '邮箱：',
    validate: (input) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(input) || '请输入有效的邮箱地址';
    }
  }
]);
```

#### 自定义提示符

```javascript
const prompt = inquirer.createPromptModule();
const answer = await prompt({
  type: 'input',
  name: 'value',
  message: '输入值：',
  prefix: '👉'
});
```

## Ora：进度反馈

Ora 提供了优雅的加载动画，让 CLI 工具更专业。

### 基础用法

```bash
npm install ora
```

```javascript
const ora = require('ora');

const spinner = ora('正在创建项目...').start();

// 模拟异步操作
setTimeout(() => {
  spinner.succeed('项目创建成功！');
}, 2000);
```

### 不同状态

```javascript
const spinner = ora('加载中...').start();

// 成功
spinner.succeed('完成！');

// 失败
spinner.fail('失败！');

// 警告
spinner.warn('警告！');

// 信息
spinner.info('信息！');

// 停止（不改变状态）
spinner.stop();
```

### 自定义样式

```javascript
const spinner = ora({
  text: '加载中...',
  spinner: 'dots',
  color: 'cyan'
}).start();
```

### 动态更新

```javascript
const spinner = ora('加载中...').start();

let progress = 0;
const interval = setInterval(() => {
  progress += 10;
  spinner.text = `加载中... ${progress}%`;
  
  if (progress >= 100) {
    clearInterval(interval);
    spinner.succeed('加载完成！');
  }
}, 100);
```

## 构建完整的 CLI 工具

让我们构建一个完整的脚手架 CLI 工具。

### 项目结构

```
my-cli/
├── package.json
├── bin/
│   └── my-cli.js
├── src/
│   ├── commands/
│   │   ├── create.js
│   │   ├── generate.js
│   │   └── add.js
│   ├── prompts/
│   │   └── create.js
│   └── utils/
│       ├── logger.js
│       └── validator.js
└── templates/
    ├── react/
    ├── vue/
    └── node/
```

### 入口文件

```javascript
#!/usr/bin/env node
const { program } = require('commander');
const createCommand = require('../src/commands/create');
const generateCommand = require('../src/commands/generate');
const addCommand = require('../src/commands/add');

program
  .name('my-cli')
  .description('企业级脚手架工具')
  .version('1.0.0');

program
  .command('create <project-name>')
  .description('创建新项目')
  .action(createCommand);

program
  .command('generate <type> <name>')
  .description('生成代码')
  .action(generateCommand);

program
  .command('add <plugin>')
  .description('添加插件')
  .action(addCommand);

program.parse();
```

### 创建命令

```javascript
const inquirer = require('inquirer');
const ora = require('ora');
const path = require('path');
const fs = require('fs');

async function createCommand(projectName) {
  // 1. 验证项目名称
  if (!projectName || projectName.trim() === '') {
    console.error('项目名称不能为空');
    process.exit(1);
  }

  // 2. 检查目录是否已存在
  const projectPath = path.join(process.cwd(), projectName);
  if (fs.existsSync(projectPath)) {
    console.error(`目录 ${projectName} 已存在`);
    process.exit(1);
  }

  // 3. 交互式问答
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: '选择模板：',
      choices: [
        { name: 'React + TypeScript', value: 'react-ts' },
        { name: 'Vue + TypeScript', value: 'vue-ts' },
        { name: 'Node.js + TypeScript', value: 'node-ts' }
      ]
    },
    {
      type: 'checkbox',
      name: 'features',
      message: '选择功能：',
      choices: [
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

  // 4. 创建项目
  const spinner = ora('正在创建项目...').start();

  try {
    // 创建目录
    fs.mkdirSync(projectPath, { recursive: true });

    // 复制模板文件
    const templatePath = path.join(__dirname, '../../templates', answers.template);
    copyTemplate(templatePath, projectPath, {
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
    
    // 提示用户
    console.log('\n下一步：');
    console.log(`  cd ${projectName}`);
    console.log('  npm run dev');
    
  } catch (error) {
    spinner.fail('项目创建失败');
    console.error(error);
    process.exit(1);
  }
}

module.exports = createCommand;
```

### 工具函数

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 复制模板
function copyTemplate(source, target, variables) {
  const files = fs.readdirSync(source);
  
  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyTemplate(sourcePath, targetPath, variables);
    } else {
      let content = fs.readFileSync(sourcePath, 'utf-8');
      
      // 替换变量
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, variables[key]);
      });
      
      fs.writeFileSync(targetPath, content);
    }
  });
}

// 安装依赖
function installDependencies(projectPath) {
  execSync('npm install', {
    cwd: projectPath,
    stdio: 'inherit'
  });
}

// 初始化 Git
function initGit(projectPath) {
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

## CLI 工具的最佳实践

### 1. 提供清晰的帮助信息

```javascript
program
  .name('my-cli')
  .description('企业级脚手架工具')
  .version('1.0.0')
  .addHelpText('after', `
    
示例：
  $ my-cli create my-app          创建 React 项目
  $ my-cli generate component Button  生成组件
  $ my-cli add eslint             添加 ESLint 配置
  `);
```

### 2. 处理所有错误情况

```javascript
async function createCommand(projectName) {
  try {
    // ... 业务逻辑
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.error('目录已存在');
    } else if (error.code === 'ENOENT') {
      console.error('模板文件不存在');
    } else {
      console.error('未知错误：', error.message);
    }
    process.exit(1);
  }
}
```

### 3. 提供进度反馈

```javascript
const spinner = ora('正在创建项目...').start();

try {
  spinner.text = '正在复制模板...';
  await copyTemplate();
  
  spinner.text = '正在安装依赖...';
  await installDependencies();
  
  spinner.succeed('项目创建成功！');
} catch (error) {
  spinner.fail('项目创建失败');
  throw error;
}
```

### 4. 支持配置文件

```javascript
const configPath = path.join(process.cwd(), '.myclirc');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  // 使用配置
}
```

### 5. 支持命令行参数

```javascript
program
  .command('create <project-name>')
  .option('-t, --template <template>', '选择模板')
  .option('--typescript', '使用 TypeScript')
  .option('--eslint', '添加 ESLint')
  .action(async (projectName, options) => {
    // 如果提供了命令行参数，跳过交互式问答
    if (options.template) {
      await createProject(projectName, options);
    } else {
      // 交互式问答
      const answers = await prompt();
      await createProject(projectName, answers);
    }
  });
```

## 调试 CLI 工具

### 使用 console.log

```javascript
// 临时调试
console.log('变量值：', variable);

// 使用 --verbose 参数
if (program.opts().verbose) {
  console.log('详细信息：', data);
}
```

### 使用 Node.js 调试器

```bash
# 启动调试模式
node --inspect bin/my-cli.js create my-app

# 或使用 --inspect-brk 在第一行暂停
node --inspect-brk bin/my-cli.js create my-app
```

### 使用 VS Code 调试

创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/bin/my-cli.js",
      "args": ["create", "my-app"],
      "console": "integratedTerminal"
    }
  ]
}
```

## 本课小结

本课我们学习了 CLI 工具开发的核心技术：

1. **Commander.js**：构建 CLI 骨架，处理命令和参数
2. **Inquirer.js**：实现交互式问答，提升用户体验
3. **Ora**：提供优雅的进度反馈，让 CLI 更专业
4. **最佳实践**：清晰的帮助信息、错误处理、进度反馈、配置文件支持

## 练习

### 练习一：完善 CLI 工具

为上面的 CLI 工具添加以下功能：
- 添加 `--verbose` 参数，显示详细日志
- 添加 `--dry-run` 参数，模拟执行但不实际创建文件
- 添加 `--force` 参数，强制覆盖已存在的目录

### 练习二：创建代码生成器

创建一个简单的代码生成器，支持：
- `my-cli generate component <name>`：生成组件文件
- `my-cli generate page <name>`：生成页面文件
- `my-cli generate hook <name>`：生成自定义 Hook 文件

## 参考答案

### 练习一

```javascript
program
  .command('create <project-name>')
  .option('-t, --template <template>', '选择模板')
  .option('--typescript', '使用 TypeScript')
  .option('--eslint', '添加 ESLint')
  .option('--verbose', '显示详细日志')
  .option('--dry-run', '模拟执行')
  .option('--force', '强制覆盖')
  .action(async (projectName, options) => {
    if (options.verbose) {
      console.log('选项：', options);
    }
    
    if (options.force) {
      // 强制覆盖
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    
    if (options.dryRun) {
      console.log('模拟执行，不实际创建文件');
      // 只打印要执行的操作
      return;
    }
    
    // 实际执行
    await createProject(projectName, options);
  });
```

### 练习二

```javascript
const fs = require('fs');
const path = require('path');

async function generateCommand(type, name) {
  const templates = {
    component: `import React from 'react';

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
`,
    page: `import React from 'react';

const ${name}Page: React.FC = () => {
  return (
    <div>
      <h1>${name}</h1>
    </div>
  );
};

export default ${name}Page;
`,
    hook: `import { useState, useEffect } from 'react';

export function use${name}() {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    // 实现 Hook 逻辑
  }, []);
  
  return state;
}
`
  };

  if (!templates[type]) {
    console.error(`未知类型：${type}`);
    console.error('可用类型：component, page, hook');
    process.exit(1);
  }

  const template = templates[type];
  const targetDir = type === 'component' ? 'src/components' : 
                    type === 'page' ? 'src/pages' : 'src/hooks';
  
  const targetPath = path.join(process.cwd(), targetDir, `${name}.tsx`);
  
  if (fs.existsSync(targetPath)) {
    console.error(`文件已存在：${targetPath}`);
    process.exit(1);
  }
  
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, template);
  
  console.log(`✓ 已创建：${targetPath}`);
}

module.exports = generateCommand;
```

## 下一步

完成本课后，继续学习 [03. 模板引擎与项目生成](./03-template-engine-project-generation.md)。