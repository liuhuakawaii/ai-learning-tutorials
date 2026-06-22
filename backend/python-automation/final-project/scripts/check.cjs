const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const SRC = path.join(BASE, 'src', 'toolbox');
const TESTS = path.join(BASE, 'tests');
const CONFIG = path.join(BASE, 'config');

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function fileExists(p) {
  return fs.existsSync(p);
}

function dirHasFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(ext));
}

// 1. 项目结构检查
check(
  'pyproject.toml 存在',
  fileExists(path.join(BASE, 'pyproject.toml')),
  '项目根目录应包含 pyproject.toml'
);

check(
  'README.md 存在',
  fileExists(path.join(BASE, 'README.md')),
  '项目根目录应包含 README.md'
);

check(
  '默认配置文件存在',
  fileExists(path.join(CONFIG, 'default.yaml')),
  'config/ 目录应包含 default.yaml'
);

// 2. 源码结构检查
check(
  'src/toolbox/__init__.py 存在',
  fileExists(path.join(SRC, '__init__.py')),
  'src/toolbox/ 应包含 __init__.py'
);

check(
  'CLI 入口存在',
  fileExists(path.join(SRC, 'cli.py')),
  'src/toolbox/ 应包含 cli.py（CLI 入口）'
);

check(
  '配置管理模块存在',
  fileExists(path.join(SRC, 'config.py')),
  'src/toolbox/ 应包含 config.py（配置管理）'
);

check(
  '日志模块存在',
  fileExists(path.join(SRC, 'logger.py')),
  'src/toolbox/ 应包含 logger.py（日志配置）'
);

// 3. 功能模块检查
const modules = [
  { dir: 'file_ops', files: ['__init__.py', 'rename.py', 'organize.py', 'cleaner.py'] },
  { dir: 'web_monitor', files: ['__init__.py', 'scraper.py', 'detector.py', 'notifier.py'] },
  { dir: 'sys_inspect', files: ['__init__.py', 'monitor.py', 'checker.py', 'reporter.py'] },
  { dir: 'report', files: ['__init__.py', 'excel.py', 'pdf.py', 'mailer.py'] },
];

for (const mod of modules) {
  const modDir = path.join(SRC, mod.dir);
  for (const f of mod.files) {
    check(
      `${mod.dir}/${f} 存在`,
      fileExists(path.join(modDir, f)),
      `src/toolbox/${mod.dir}/ 应包含 ${f}`
    );
  }
}

// 4. 测试文件检查
const testFiles = dirHasFiles(TESTS, '.py');
check(
  '测试目录包含文件',
  testFiles.length > 0,
  `tests/ 目录应包含 .py 测试文件，当前找到 ${testFiles.length} 个`
);

check(
  'conftest.py 存在',
  fileExists(path.join(TESTS, 'conftest.py')),
  'tests/ 应包含 conftest.py'
);

check(
  '至少 4 个测试文件',
  testFiles.filter(f => f.startsWith('test_')).length >= 4,
  '应至少有 4 个测试文件（每个模块一个）'
);

// 5. 代码质量检查
function hasImport(filePath, moduleName) {
  if (!fileExists(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes(`import ${moduleName}`) || content.includes(`from ${moduleName}`);
}

function hasPattern(filePath, pattern) {
  if (!fileExists(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes(pattern);
}

check(
  'CLI 使用 click',
  hasImport(path.join(SRC, 'cli.py'), 'click'),
  'cli.py 应导入 click 模块'
);

check(
  '配置管理使用 YAML',
  hasImport(path.join(SRC, 'config.py'), 'yaml') || hasImport(path.join(SRC, 'config.py'), 'toml'),
  'config.py 应导入 yaml 或 toml 模块'
);

check(
  '日志模块使用 logging',
  hasImport(path.join(SRC, 'logger.py'), 'logging'),
  'logger.py 应导入 logging 模块'
);

// 6. 报告模板检查
const reportsDir = path.join(BASE, 'reports');
const reportTemplates = dirHasFiles(reportsDir, '.md');
check(
  '报告模板存在',
  reportTemplates.length >= 5,
  `reports/ 目录应至少包含 5 个 .md 报告模板，当前找到 ${reportTemplates.length} 个`
);

// 输出结果
console.log('\n========================================');
console.log('  Python 自动化工具箱 - 项目检查');
console.log('========================================\n');

let passed = 0;
let failed = 0;

for (const c of checks) {
  const status = c.ok ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}  ${c.name}`);
  if (!c.ok) {
    console.log(`       → ${c.detail}`);
    failed++;
  } else {
    passed++;
  }
}

console.log('\n----------------------------------------');
console.log(`总计: ${checks.length} 项检查`);
console.log(`通过: ${passed} 项`);
console.log(`未通过: ${failed} 项`);
console.log(`通过率: ${Math.round(passed / checks.length * 100)}%`);
console.log('----------------------------------------\n');

if (failed > 0) {
  console.log('⚠️  部分检查未通过，请根据提示完善项目。\n');
  process.exit(1);
} else {
  console.log('🎉 所有检查通过！项目结构完整。\n');
  process.exit(0);
}
