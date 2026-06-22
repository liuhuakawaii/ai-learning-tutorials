const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const TESTS = path.join(ROOT, 'tests');
const REPORTS = path.join(ROOT, 'reports');

let passed = 0;
let failed = 0;
const errors = [];

function check(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.log(`  ✗ ${message}`);
  }
}

function fileExists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function dirHasFiles(dir, pattern) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return false;
  const files = fs.readdirSync(fullDir, { recursive: true });
  const regex = new RegExp(pattern);
  return files.some(f => regex.test(f));
}

function countFiles(dir, pattern) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) return 0;
  const files = fs.readdirSync(fullDir, { recursive: true });
  const regex = new RegExp(pattern);
  return files.filter(f => regex.test(f)).length;
}

console.log('\n========================================');
console.log('  测试与质量保障 - 毕业项目验证');
console.log('========================================\n');

// --- 阶段1：单元测试 ---
console.log('阶段1：单元测试');
check(fileExists('tests/unit'), 'tests/unit 目录存在');
check(dirHasFiles('tests/unit', '\\.test\\.(ts|tsx|js)$'), '存在单元测试文件');
check(countFiles('tests/unit', '\\.test\\.(ts|tsx|js)$') >= 3, '至少 3 个单元测试文件');
check(fileExists('vitest.config.ts'), 'vitest.config.ts 配置文件存在');

// --- 阶段2：集成与 E2E ---
console.log('\n阶段2：集成与 E2E');
check(fileExists('tests/integration'), 'tests/integration 目录存在');
check(dirHasFiles('tests/integration', '\\.test\\.(ts|tsx|js)$'), '存在集成测试文件');
check(fileExists('tests/e2e'), 'tests/e2e 目录存在');
check(dirHasFiles('tests/e2e', '\\.test\\.(ts|tsx|js|spec)$'), '存在 E2E 测试文件');
check(fileExists('playwright.config.ts'), 'playwright.config.ts 配置文件存在');

// --- 阶段3：Mock 与 Fixture ---
console.log('\n阶段3：Mock 与 Fixture');
check(fileExists('tests/fixtures'), 'tests/fixtures 目录存在');
check(fileExists('tests/mocks'), 'tests/mocks 目录存在');
check(dirHasFiles('tests/mocks', '\\.(ts|js)$'), '存在 Mock 配置文件');
check(dirHasFiles('tests/fixtures', '\\.(ts|js)$'), '存在 Fixture 文件');

// --- 阶段4：覆盖率与变异测试 ---
console.log('\n阶段4：覆盖率与变异测试');
check(fileExists('vitest.config.ts'), 'Vitest 配置文件存在');
try {
  const vitestConfig = fs.readFileSync(path.join(ROOT, 'vitest.config.ts'), 'utf-8');
  check(vitestConfig.includes('coverage'), 'Vitest 配置包含覆盖率设置');
} catch {
  check(false, 'Vitest 配置文件可读取');
}

// --- 阶段5：CI 测试策略 ---
console.log('\n阶段5：CI 测试策略');
check(fileExists('.github/workflows'), '.github/workflows 目录存在');
check(dirHasFiles('.github/workflows', '\\.yml$'), '存在 GitHub Actions 工作流文件');

// --- 报告检查 ---
console.log('\n阶段报告');
const stageNames = ['stage1-report.md', 'stage2-report.md', 'stage3-report.md', 'stage4-report.md', 'stage5-report.md'];
for (const name of stageNames) {
  check(fileExists(`reports/${name}`), `${name} 存在`);
}

// --- 配置文件检查 ---
console.log('\n配置文件');
check(fileExists('package.json'), 'package.json 存在');
check(fileExists('tsconfig.json'), 'tsconfig.json 存在');

// --- 汇总 ---
console.log('\n========================================');
console.log(`  结果：${passed} 通过 / ${failed} 失败`);
console.log('========================================');

if (failed > 0) {
  console.log('\n失败项：');
  errors.forEach(e => console.log(`  - ${e}`));
  process.exit(1);
} else {
  console.log('\n🎉 所有检查通过！项目完成。');
  process.exit(0);
}
