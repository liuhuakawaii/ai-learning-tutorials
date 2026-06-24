# 05. 配置管理与预设系统

> 配置管理不是"保存一个 JSON 文件"，而是"让不同用户在不同场景下都能高效使用脚手架"

## 本课目标

- 理解配置管理的核心挑战
- 设计分层配置系统（全局/项目/用户）
- 实现预设系统的完整流程
- 掌握配置校验和迁移策略

## 从一个真实场景说起

假设你在用一个脚手架工具，遇到了这些问题：

1. **配置丢失**：每次创建新项目都要重新配置 ESLint、Prettier
2. **团队冲突**：团队成员的配置不一致，代码风格混乱
3. **环境差异**：开发环境和生产环境的配置不同，导致问题
4. **版本升级**：脚手架升级后，旧项目的配置不兼容

这些问题的根源是**配置管理不完善**。

好的配置管理系统应该：
- 支持多层级配置（全局/项目/用户）
- 支持预设配置（一键应用团队规范）
- 支持配置校验（防止无效配置）
- 支持配置迁移（版本升级时自动更新）

## 配置层级设计

### 三层配置模型

```
全局配置 (~/.myclirc)
    ↓
项目配置 (.myclirc)
    ↓
用户配置 (环境变量/命令行参数)
```

**优先级**：用户配置 > 项目配置 > 全局配置

### 配置文件格式

```json
{
  "$schema": "https://my-cli.com/schema.json",
  "template": "react-ts",
  "features": {
    "typescript": true,
    "eslint": true,
    "prettier": true,
    "storybook": false
  },
  "paths": {
    "src": "src",
    "components": "src/components",
    "pages": "src/pages"
  },
  "plugins": [],
  "presets": ["standard"]
}
```

### 配置加载顺序

```javascript
const path = require('path');
const fs = require('fs');

function loadConfig(projectDir) {
  const config = {
    template: 'react',
    features: {
      typescript: true,
      eslint: true,
      prettier: true
    }
  };

  // 1. 加载全局配置
  const globalConfigPath = path.join(
    require('os').homedir(),
    '.myclirc'
  );
  if (fs.existsSync(globalConfigPath)) {
    const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));
    mergeConfig(config, globalConfig);
  }

  // 2. 加载项目配置
  const projectConfigPath = path.join(projectDir, '.myclirc');
  if (fs.existsSync(projectConfigPath)) {
    const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
    mergeConfig(config, projectConfig);
  }

  // 3. 加载环境变量配置
  const envConfig = loadEnvConfig();
  mergeConfig(config, envConfig);

  // 4. 加载命令行参数配置
  const cliConfig = loadCliConfig();
  mergeConfig(config, cliConfig);

  return config;
}

function mergeConfig(base, override) {
  Object.keys(override).forEach(key => {
    if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      base[key] = base[key] || {};
      mergeConfig(base[key], override[key]);
    } else {
      base[key] = override[key];
    }
  });
}
```

## 预设系统设计

### 预设是什么

预设是一组预定义的配置组合，代表团队或个人的工程规范。

```json
{
  "name": "standard",
  "description": "标准 React + TypeScript 配置",
  "template": "react-ts",
  "features": {
    "typescript": true,
    "eslint": true,
    "prettier": true,
    "husky": true,
    "lint-staged": true
  },
  "config": {
    "eslint": {
      "extends": ["eslint:recommended", "plugin:react/recommended"],
      "rules": {
        "no-console": "warn"
      }
    },
    "prettier": {
      "semi": true,
      "singleQuote": true,
      "trailingComma": "es5"
    }
  }
}
```

### 预设存储位置

```
~/.my-cli/
├── presets/
│   ├── standard.json
│   ├── minimal.json
│   └── enterprise.json
└── config.json
```

### 预设操作

```javascript
const fs = require('fs');
const path = require('path');

class PresetManager {
  constructor() {
    this.presetsDir = path.join(
      require('os').homedir(),
      '.my-cli',
      'presets'
    );
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(this.presetsDir)) {
      fs.mkdirSync(this.presetsDir, { recursive: true });
    }
  }

  // 列出所有预设
  list() {
    const files = fs.readdirSync(this.presetsDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const content = JSON.parse(
          fs.readFileSync(path.join(this.presetsDir, f), 'utf-8')
        );
        return {
          name: path.basename(f, '.json'),
          description: content.description || ''
        };
      });
  }

  // 获取预设
  get(name) {
    const presetPath = path.join(this.presetsDir, `${name}.json`);
    if (!fs.existsSync(presetPath)) {
      throw new Error(`预设 ${name} 不存在`);
    }
    return JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
  }

  // 创建预设
  create(name, config) {
    const presetPath = path.join(this.presetsDir, `${name}.json`);
    if (fs.existsSync(presetPath)) {
      throw new Error(`预设 ${name} 已存在`);
    }
    fs.writeFileSync(presetPath, JSON.stringify(config, null, 2));
  }

  // 更新预设
  update(name, config) {
    const presetPath = path.join(this.presetsDir, `${name}.json`);
    if (!fs.existsSync(presetPath)) {
      throw new Error(`预设 ${name} 不存在`);
    }
    fs.writeFileSync(presetPath, JSON.stringify(config, null, 2));
  }

  // 删除预设
  delete(name) {
    const presetPath = path.join(this.presetsDir, `${name}.json`);
    if (!fs.existsSync(presetPath)) {
      throw new Error(`预设 ${name} 不存在`);
    }
    fs.unlinkSync(presetPath);
  }

  // 应用预设到配置
  apply(presetName, config) {
    const preset = this.get(presetName);
    return mergeConfig(config, preset);
  }
}

module.exports = PresetManager;
```

### 预设命令行接口

```javascript
const { program } = require('commander');
const PresetManager = require('./preset-manager');
const inquirer = require('inquirer');

const presetManager = new PresetManager();

program
  .command('preset')
  .description('预设管理')
  .addCommand(
    program
      .command('list')
      .description('列出所有预设')
      .action(() => {
        const presets = presetManager.list();
        console.log('可用预设：');
        presets.forEach(p => {
          console.log(`  ${p.name}: ${p.description}`);
        });
      })
  )
  .addCommand(
    program
      .command('use <name>')
      .description('应用预设')
      .action((name) => {
        const preset = presetManager.get(name);
        console.log(`应用预设：${preset.name}`);
        console.log(`描述：${preset.description}`);
        // 应用预设到当前项目
      })
  )
  .addCommand(
    program
      .command('create')
      .description('创建预设')
      .action(async () => {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: '预设名称：'
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
              'TypeScript',
              'ESLint',
              'Prettier',
              'Husky',
              'Storybook'
            ]
          }
        ]);

        const preset = {
          name: answers.name,
          description: answers.description,
          features: answers.features.reduce((acc, f) => {
            acc[f.toLowerCase()] = true;
            return acc;
          }, {})
        };

        presetManager.create(answers.name, preset);
        console.log(`预设 ${answers.name} 创建成功！`);
      })
  );
```

## 远程预设

### 从 Git 仓库加载预设

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function loadRemotePreset(presetUrl) {
  const tempDir = path.join(os.tmpdir(), 'my-cli-presets');
  
  try {
    // 克隆仓库
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    execSync(`git clone ${presetUrl} ${tempDir}`, {
      stdio: 'ignore'
    });
    
    // 读取预设配置
    const configPath = path.join(tempDir, 'preset.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('预设配置文件不存在');
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config;
  } finally {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// 使用示例
const preset = await loadRemotePreset(
  'https://github.com/my-team/presets.git'
);
```

### 从 npm 包加载预设

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function loadNpmPreset(presetName) {
  const tempDir = path.join(os.tmpdir(), 'my-cli-presets');
  
  try {
    // 安装包
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    execSync(`npm install ${presetName}`, {
      cwd: tempDir,
      stdio: 'ignore'
    });
    
    // 读取预设配置
    const configPath = path.join(tempDir, 'node_modules', presetName, 'preset.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('预设配置文件不存在');
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config;
  } finally {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
```

## 配置校验

### 使用 JSON Schema 校验

```javascript
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv();
addFormats(ajv);

const configSchema = {
  type: 'object',
  properties: {
    template: {
      type: 'string',
      enum: ['react', 'vue', 'node']
    },
    features: {
      type: 'object',
      properties: {
        typescript: { type: 'boolean' },
        eslint: { type: 'boolean' },
        prettier: { type: 'boolean' }
      },
      additionalProperties: false
    },
    paths: {
      type: 'object',
      properties: {
        src: { type: 'string' },
        components: { type: 'string' },
        pages: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  required: ['template'],
  additionalProperties: false
};

function validateConfig(config) {
  const validate = ajv.compile(configSchema);
  const valid = validate(config);
  
  if (!valid) {
    const errors = validate.errors.map(e => {
      return `${e.instancePath} ${e.message}`;
    });
    throw new Error(`配置校验失败：\n${errors.join('\n')}`);
  }
  
  return true;
}

// 使用示例
try {
  validateConfig({
    template: 'react',
    features: {
      typescript: true
    }
  });
  console.log('配置校验通过');
} catch (error) {
  console.error(error.message);
}
```

### 自定义校验规则

```javascript
function validateProjectName(name) {
  if (!name || name.trim() === '') {
    return '项目名称不能为空';
  }
  
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return '项目名称必须以字母开头，只能包含字母、数字、下划线和连字符';
  }
  
  if (name.length > 50) {
    return '项目名称不能超过 50 个字符';
  }
  
  return true;
}

function validateTemplate(template) {
  const validTemplates = ['react', 'vue', 'node'];
  if (!validTemplates.includes(template)) {
    return `无效的模板：${template}，可用模板：${validTemplates.join(', ')}`;
  }
  return true;
}

function validateFeatures(features) {
  const validFeatures = ['typescript', 'eslint', 'prettier', 'husky', 'storybook'];
  const invalidFeatures = Object.keys(features).filter(
    f => !validFeatures.includes(f)
  );
  
  if (invalidFeatures.length > 0) {
    return `无效的功能：${invalidFeatures.join(', ')}`;
  }
  
  return true;
}
```

## 配置迁移

### 版本迁移策略

```javascript
const fs = require('fs');
const path = require('path');

class ConfigMigrator {
  constructor(configPath) {
    this.configPath = configPath;
    this.migrations = [
      {
        version: '1.0.0',
        migrate: (config) => {
          // 旧版本配置转换
          if (config.useTypescript !== undefined) {
            config.features = config.features || {};
            config.features.typescript = config.useTypescript;
            delete config.useTypescript;
          }
          return config;
        }
      },
      {
        version: '2.0.0',
        migrate: (config) => {
          // 重构配置结构
          if (config.eslint) {
            config.features = config.features || {};
            config.features.eslint = true;
            delete config.eslint;
          }
          return config;
        }
      }
    ];
  }

  migrate() {
    if (!fs.existsSync(this.configPath)) {
      return null;
    }

    let config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
    let currentVersion = config.version || '1.0.0';

    for (const migration of this.migrations) {
      if (this.compareVersions(migration.version, currentVersion) > 0) {
        console.log(`迁移配置到版本 ${migration.version}...`);
        config = migration.migrate(config);
        config.version = migration.version;
        currentVersion = migration.version;
      }
    }

    // 保存迁移后的配置
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    console.log(`配置已迁移到版本 ${currentVersion}`);

    return config;
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

module.exports = ConfigMigrator;
```

### 配置备份与恢复

```javascript
const fs = require('fs');
const path = require('path');

class ConfigBackup {
  constructor(configPath) {
    this.configPath = configPath;
    this.backupDir = path.join(
      path.dirname(configPath),
      '.backups'
    );
  }

  backup() {
    if (!fs.existsSync(this.configPath)) {
      return;
    }

    // 创建备份目录
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    // 生成备份文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(
      this.backupDir,
      `config-${timestamp}.json`
    );

    // 复制配置文件
    fs.copyFileSync(this.configPath, backupPath);
    console.log(`配置已备份到：${backupPath}`);

    // 清理旧备份（保留最近 5 个）
    this.cleanOldBackups(5);

    return backupPath;
  }

  restore(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`备份文件不存在：${backupPath}`);
    }

    // 恢复配置
    fs.copyFileSync(backupPath, this.configPath);
    console.log(`配置已从 ${backupPath} 恢复`);
  }

  cleanOldBackups(keepCount) {
    if (!fs.existsSync(this.backupDir)) {
      return;
    }

    const backups = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith('config-'))
      .sort()
      .reverse();

    // 删除多余的备份
    backups.slice(keepCount).forEach(f => {
      fs.unlinkSync(path.join(this.backupDir, f));
    });
  }
}

module.exports = ConfigBackup;
```

## 配置共享

### 团队配置共享

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TeamConfig {
  constructor(teamConfigUrl) {
    this.teamConfigUrl = teamConfigUrl;
    this.localConfigPath = path.join(process.cwd(), '.myclirc');
  }

  async sync() {
    console.log('正在同步团队配置...');

    try {
      // 从远程拉取配置
      const tempDir = path.join(require('os').tmpdir(), 'team-config');
      execSync(`git clone ${this.teamConfigUrl} ${tempDir}`, {
        stdio: 'ignore'
      });

      const remoteConfigPath = path.join(tempDir, 'config.json');
      if (!fs.existsSync(remoteConfigPath)) {
        throw new Error('团队配置文件不存在');
      }

      const remoteConfig = JSON.parse(
        fs.readFileSync(remoteConfigPath, 'utf-8')
      );

      // 合并配置
      let localConfig = {};
      if (fs.existsSync(this.localConfigPath)) {
        localConfig = JSON.parse(
          fs.readFileSync(this.localConfigPath, 'utf-8')
        );
      }

      const mergedConfig = this.mergeConfigs(localConfig, remoteConfig);

      // 保存配置
      fs.writeFileSync(
        this.localConfigPath,
        JSON.stringify(mergedConfig, null, 2)
      );

      console.log('团队配置同步完成！');
    } catch (error) {
      console.error('同步失败：', error.message);
      throw error;
    } finally {
      // 清理临时目录
      const tempDir = path.join(require('os').tmpdir(), 'team-config');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  }

  mergeConfigs(local, remote) {
    const merged = { ...local };

    // 远程配置覆盖本地配置
    Object.keys(remote).forEach(key => {
      if (typeof remote[key] === 'object' && !Array.isArray(remote[key])) {
        merged[key] = this.mergeConfigs(merged[key] || {}, remote[key]);
      } else {
        merged[key] = remote[key];
      }
    });

    return merged;
  }
}

module.exports = TeamConfig;
```

## 配置管理最佳实践

### 1. 提供合理的默认值

```javascript
const defaultConfig = {
  template: 'react',
  features: {
    typescript: true,
    eslint: true,
    prettier: true
  },
  paths: {
    src: 'src',
    components: 'src/components',
    pages: 'src/pages'
  }
};
```

### 2. 支持配置继承

```json
{
  "extends": "@my-team/preset-standard",
  "features": {
    "storybook": true
  }
}
```

### 3. 提供配置可视化

```javascript
function printConfig(config) {
  console.log('当前配置：');
  console.log(JSON.stringify(config, null, 2));
}

function diffConfigs(config1, config2) {
  const diff = {};
  
  Object.keys(config1).forEach(key => {
    if (JSON.stringify(config1[key]) !== JSON.stringify(config2[key])) {
      diff[key] = {
        from: config1[key],
        to: config2[key]
      };
    }
  });
  
  return diff;
}
```

### 4. 支持配置导入导出

```javascript
function exportConfig(config, exportPath) {
  fs.writeFileSync(exportPath, JSON.stringify(config, null, 2));
  console.log(`配置已导出到：${exportPath}`);
}

function importConfig(importPath) {
  if (!fs.existsSync(importPath)) {
    throw new Error(`配置文件不存在：${importPath}`);
  }
  
  const config = JSON.parse(fs.readFileSync(importPath, 'utf-8'));
  console.log(`配置已从 ${importPath} 导入`);
  return config;
}
```

## 本课小结

本课我们学习了配置管理与预设系统：

1. **配置层级**：全局/项目/用户三层配置模型
2. **预设系统**：预定义配置组合，一键应用团队规范
3. **远程预设**：从 Git 仓库或 npm 包加载预设
4. **配置校验**：使用 JSON Schema 和自定义规则校验配置
5. **配置迁移**：版本升级时自动更新配置
6. **配置共享**：团队配置同步和共享

## 练习

### 练习一：实现配置校验

为脚手架配置实现完整的校验系统：
- 使用 JSON Schema 校验配置结构
- 实现自定义校验规则
- 提供清晰的错误信息

### 练习二：实现预设系统

实现一个完整的预设系统：
- 创建、更新、删除预设
- 列出可用预设
- 应用预设到项目

## 参考答案

### 练习一

```javascript
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv();
addFormats(ajv);

const configSchema = {
  type: 'object',
  properties: {
    template: {
      type: 'string',
      enum: ['react', 'vue', 'node']
    },
    features: {
      type: 'object',
      properties: {
        typescript: { type: 'boolean' },
        eslint: { type: 'boolean' },
        prettier: { type: 'boolean' },
        husky: { type: 'boolean' },
        storybook: { type: 'boolean' }
      },
      additionalProperties: false
    },
    paths: {
      type: 'object',
      properties: {
        src: { type: 'string' },
        components: { type: 'string' },
        pages: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  required: ['template'],
  additionalProperties: false
};

function validateConfig(config) {
  const validate = ajv.compile(configSchema);
  const valid = validate(config);
  
  if (!valid) {
    const errors = validate.errors.map(e => {
      let message = e.instancePath;
      if (e.keyword === 'enum') {
        message += ` 必须是 ${e.params.allowedValues.join(', ')} 之一`;
      } else if (e.keyword === 'type') {
        message += ` 必须是 ${e.params.type}`;
      } else {
        message += ` ${e.message}`;
      }
      return message;
    });
    throw new Error(`配置校验失败：\n${errors.join('\n')}`);
  }
  
  return true;
}

// 自定义校验
function validateProjectName(name) {
  if (!name || name.trim() === '') {
    return '项目名称不能为空';
  }
  
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    return '项目名称必须以字母开头，只能包含字母、数字、下划线和连字符';
  }
  
  if (name.length > 50) {
    return '项目名称不能超过 50 个字符';
  }
  
  return true;
}

function validateTemplate(template) {
  const validTemplates = ['react', 'vue', 'node'];
  if (!validTemplates.includes(template)) {
    return `无效的模板：${template}，可用模板：${validTemplates.join(', ')}`;
  }
  return true;
}

function validateFeatures(features) {
  const validFeatures = ['typescript', 'eslint', 'prettier', 'husky', 'storybook'];
  const invalidFeatures = Object.keys(features).filter(
    f => !validFeatures.includes(f)
  );
  
  if (invalidFeatures.length > 0) {
    return `无效的功能：${invalidFeatures.join(', ')}`;
  }
  
  return true;
}
```

### 练习二

```javascript
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

class PresetManager {
  constructor() {
    this.presetsDir = path.join(
      require('os').homedir(),
      '.my-cli',
      'presets'
    );
    this.ensureDir();
  }

  ensureDir() {
    if (!fs.existsSync(this.presetsDir)) {
      fs.mkdirSync(this.presetsDir, { recursive: true });
    }
  }

  list() {
    const files = fs.readdirSync(this.presetsDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const content = JSON.parse(
          fs.readFileSync(path.join(this.presetsDir, f), 'utf-8')
        );
        return {
          name: path.basename(f, '.json'),
          description: content.description || ''
        };
      });
  }

  get(name) {
    const presetPath = path.join(this.presetsDir, `${name}.json`);
    if (!fs.existsSync(presetPath)) {
      throw new Error(`预设 ${name} 不存在`);
    }
    return JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
  }

  create(name, config) {
    const presetPath = path.join(this.presetsDir, `${name}.json`);
    if (fs.existsSync(presetPath)) {
      throw new Error(`预设 ${name} 已存在`);
    }
    fs.writeFileSync(presetPath, JSON.stringify(config, null, 2));
  }

  update(name, config) {
    const presetPath = path.join(this.presetsDir, `${name}.json`);
    if (!fs.existsSync(presetPath)) {
      throw new Error(`预设 ${name} 不存在`);
    }
    fs.writeFileSync(presetPath, JSON.stringify(config, null, 2));
  }

  delete(name) {
    const presetPath = path.join(this.presetsDir, `${name}.json`);
    if (!fs.existsSync(presetPath)) {
      throw new Error(`预设 ${name} 不存在`);
    }
    fs.unlinkSync(presetPath);
  }

  apply(presetName, config) {
    const preset = this.get(presetName);
    return this.mergeConfigs(config, preset);
  }

  mergeConfigs(base, override) {
    const merged = { ...base };
    
    Object.keys(override).forEach(key => {
      if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
        merged[key] = this.mergeConfigs(merged[key] || {}, override[key]);
      } else {
        merged[key] = override[key];
      }
    });
    
    return merged;
  }
}

module.exports = PresetManager;
```

## 下一步

完成本课后，继续学习 [06. 插件机制设计](./06-plugin-mechanism-design.md)。