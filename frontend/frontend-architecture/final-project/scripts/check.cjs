#!/usr/bin/env node

/**
 * 毕业项目验证脚本
 * 验证企业级前端基建平台的完整性
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 检查项
const checks = [
  {
    name: 'Monorepo 结构',
    check: () => {
      const required = [
        'package.json',
        'pnpm-workspace.yaml',
        'apps',
        'packages'
      ];
      return required.every(p => fs.existsSync(path.join(ROOT_DIR, p)));
    }
  },
  {
    name: '组件库目录',
    check: () => {
      const uiDir = path.join(ROOT_DIR, 'packages', 'ui');
      return fs.existsSync(uiDir);
    }
  },
  {
    name: '脚手架工具目录',
    check: () => {
      const cliDir = path.join(ROOT_DIR, 'packages', 'cli');
      return fs.existsSync(cliDir);
    }
  },
  {
    name: '配置包目录',
    check: () => {
      const configDir = path.join(ROOT_DIR, 'packages', 'config');
      return fs.existsSync(configDir);
    }
  },
  {
    name: '监控 SDK 目录',
    check: () => {
      const monitoringDir = path.join(ROOT_DIR, 'packages', 'monitoring');
      return fs.existsSync(monitoringDir);
    }
  },
  {
    name: 'CI/CD 配置',
    check: () => {
      const ciDir = path.join(ROOT_DIR, '.github', 'workflows');
      return fs.existsSync(ciDir);
    }
  }
];

// 运行检查
let passed = 0;
let failed = 0;

console.log('\n检查企业级前端基建平台...\n');

checks.forEach(({ name, check }) => {
  try {
    if (check()) {
      log('green', `✓ ${name}`);
      passed++;
    } else {
      log('red', `✗ ${name}`);
      failed++;
    }
  } catch (error) {
    log('red', `✗ ${name} (错误: ${error.message})`);
    failed++;
  }
});

console.log('\n--- 结果 ---');
console.log(`通过: ${passed}, 失败: ${failed}\n`);

if (failed > 0) {
  log('yellow', '提示: 请根据 README.md 完善项目结构');
  process.exit(1);
} else {
  log('green', '所有检查通过!');
  process.exit(0);
}