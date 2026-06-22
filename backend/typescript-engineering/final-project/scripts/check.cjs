const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(ROOT, '..');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;
const errors = [];

function check(description, condition) {
  if (condition) {
    console.log(`  ${GREEN}✓${RESET} ${description}`);
    passed++;
  } else {
    console.log(`  ${RED}✗${RESET} ${description}`);
    failed++;
    errors.push(description);
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function dirExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// ── 1. 根目录配置文件 ──

console.log(`\n${BOLD}=== 根目录配置文件 ===${RESET}`);

const rootFiles = ['tsconfig.json', 'turbo.json', 'pnpm-workspace.yaml', 'vitest.config.ts', 'package.json'];
rootFiles.forEach((f) => {
  check(`根目录存在 ${f}`, fileExists(path.join(PROJECT_ROOT, f)));
});

// ── 2. 子包目录结构 ──

console.log(`\n${BOLD}=== 子包目录 ===${RESET}`);

const packages = ['shared-types', 'api', 'web', 'cli', 'config'];
const packagesDir = path.join(PROJECT_ROOT, 'packages');

check('packages 目录存在', dirExists(packagesDir));

packages.forEach((pkg) => {
  const pkgDir = path.join(packagesDir, pkg);
  check(`packages/${pkg} 目录存在`, dirExists(pkgDir));
});

// ── 3. 子包 package.json 与 name 字段 ──

console.log(`\n${BOLD}=== 子包 package.json ===${RESET}`);

packages.forEach((pkg) => {
  const pkgJsonPath = path.join(packagesDir, pkg, 'package.json');
  const pkgJson = readJSON(pkgJsonPath);
  check(`packages/${pkg}/package.json 存在且可解析`, pkgJson !== null);
  if (pkgJson) {
    check(`packages/${pkg} name 为 @ts-tool-platform/${pkg}`, pkgJson.name === `@ts-tool-platform/${pkg}`);
  }
});

// ── 4. 子包 tsconfig.json ──

console.log(`\n${BOLD}=== 子包 TypeScript 配置 ===${RESET}`);

packages.forEach((pkg) => {
  check(`packages/${pkg}/tsconfig.json 存在`, fileExists(path.join(packagesDir, pkg, 'tsconfig.json')));
});

// ── 5. 子包 src 目录 ──

console.log(`\n${BOLD}=== 子包源码目录 ===${RESET}`);

packages.forEach((pkg) => {
  check(`packages/${pkg}/src 目录存在`, dirExists(path.join(packagesDir, pkg, 'src')));
});

// ── 6. 子包入口文件 ──

console.log(`\n${BOLD}=== 子包入口文件 ===${RESET}`);

const entryFiles = {
  'shared-types': 'src/index.ts',
  api: 'src/index.ts',
  web: 'src/App.tsx',
  cli: 'src/index.ts',
  config: 'src/index.ts',
};

Object.entries(entryFiles).forEach(([pkg, entry]) => {
  check(`packages/${pkg}/${entry} 存在`, fileExists(path.join(packagesDir, pkg, entry)));
});

// ── 7. 测试文件 ──

console.log(`\n${BOLD}=== 测试文件 ===${RESET}`);

packages.forEach((pkg) => {
  const testDir = path.join(packagesDir, pkg, '__tests__');
  if (dirExists(testDir)) {
    const testFiles = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'));
    check(`packages/${pkg}/__tests__ 包含测试文件 (找到 ${testFiles.length} 个)`, testFiles.length > 0);
  } else {
    check(`packages/${pkg}/__tests__ 目录存在`, false);
  }
});

// ── 8. 类型定义文件（shared-types）──

console.log(`\n${BOLD}=== 类型定义文件 ===${RESET}`);

const sharedTypesSrc = path.join(packagesDir, 'shared-types', 'src');
const typeDirs = ['models', 'api', 'utils'];

typeDirs.forEach((dir) => {
  check(`packages/shared-types/src/${dir} 目录存在`, dirExists(path.join(sharedTypesSrc, dir)));
});

// ── 9. API 路由与数据库 ──

console.log(`\n${BOLD}=== API 包结构 ===${RESET}`);

const apiDirs = ['routers', 'db', 'middleware'];
apiDirs.forEach((dir) => {
  check(`packages/api/src/${dir} 目录存在`, dirExists(path.join(packagesDir, 'api', 'src', dir)));
});

// ── 10. CLI 命令目录 ──

console.log(`\n${BOLD}=== CLI 包结构 ===${RESET}`);

check('packages/cli/src/commands 目录存在', dirExists(path.join(packagesDir, 'cli', 'src', 'commands')));

// ── 11. 阶段报告 ──

console.log(`\n${BOLD}=== 阶段报告 ===${RESET}`);

for (let i = 1; i <= 5; i++) {
  check(`reports/stage${i}-report.md 存在`, fileExists(path.join(ROOT, 'reports', `stage${i}-report.md`)));
}

// ── 汇总 ──

console.log(`\n${'='.repeat(40)}`);
console.log(`${BOLD}检查结果汇总${RESET}`);
console.log(`  ${GREEN}通过: ${passed}${RESET}`);
console.log(`  ${RED}失败: ${failed}${RESET}`);
console.log(`  总计: ${passed + failed}`);

if (failed > 0) {
  console.log(`\n${RED}${BOLD}未通过的检查项:${RESET}`);
  errors.forEach((e) => console.log(`  ${RED}• ${e}${RESET}`));
  console.log('');
  process.exit(1);
} else {
  console.log(`\n${GREEN}${BOLD}所有检查通过！项目结构完整。${RESET}\n`);
  process.exit(0);
}
