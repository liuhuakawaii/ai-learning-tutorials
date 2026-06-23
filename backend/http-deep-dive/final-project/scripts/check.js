const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', 'http-debug-tool')

const REQUIRED_FILES = [
  'src/proxy/index.ts',
  'src/proxy/cert-manager.ts',
  'src/replay/index.ts',
  'src/replay/diff.ts',
  'src/cache-tester/index.ts',
  'src/cors-checker/index.ts',
  'src/cors-checker/analyzer.ts',
  'src/performance/index.ts',
  'src/storage/index.ts',
  'package.json',
  'README.md',
]

const REQUIRED_DIRS = [
  'src/proxy',
  'src/replay',
  'src/cache-tester',
  'src/cors-checker',
  'src/performance',
  'src/storage',
  'tests',
]

let passed = 0
let failed = 0

function check(desc, condition) {
  if (condition) {
    console.log(`  ✅ ${desc}`)
    passed++
  } else {
    console.log(`  ❌ ${desc}`)
    failed++
  }
}

function fileExists(rel) {
  return fs.existsSync(path.join(root, rel))
}

function dirExists(rel) {
  const p = path.join(root, rel)
  return fs.existsSync(p) && fs.statSync(p).isDirectory()
}

console.log('🔍 HTTP 调试工具 — 结构验证\n')

if (!fs.existsSync(root)) {
  console.log('❌ 项目目录不存在:', root)
  console.log('\n请先创建项目：')
  console.log('  mkdir http-debug-tool && cd http-debug-tool && npm init -y')
  process.exit(1)
}

console.log('📁 目录结构：')
REQUIRED_DIRS.forEach((d) => check(`目录 ${d} 存在`, dirExists(d)))

console.log('\n📄 必需文件：')
REQUIRED_FILES.forEach((f) => check(`文件 ${f} 存在`, fileExists(f)))

console.log('\n📦 依赖检查：')
const pkgPath = path.join(root, 'package.json')
if (fileExists('package.json')) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  check('package.json 有 name 字段', !!pkg.name)
  check('package.json 有 scripts 字段', !!pkg.scripts)
}

console.log(`\n📊 结果：${passed} 通过，${failed} 失败`)
if (failed > 0) process.exit(1)
