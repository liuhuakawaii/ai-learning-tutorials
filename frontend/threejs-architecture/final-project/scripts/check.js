const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', 'three-editor')

const REQUIRED_FILES = [
  'src/core/scene-graph.ts',
  'src/core/selection.ts',
  'src/core/transform.ts',
  'src/core/history.ts',
  'src/core/serialization.ts',
  'src/components/Viewport.tsx',
  'src/components/SceneTree.tsx',
  'src/components/Properties.tsx',
  'package.json',
  'README.md',
]

const REQUIRED_DIRS = [
  'src/core',
  'src/components',
  'src/store',
  'src/geometries',
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

console.log('🔍 3D 编辑器 — 结构验证\n')

if (!fs.existsSync(root)) {
  console.log('❌ 项目目录不存在:', root)
  console.log('\n请先创建项目：')
  console.log('  mkdir three-editor && cd three-editor && npm init -y')
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
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  check('依赖包含 three', !!deps.three)
  check('package.json 有 scripts 字段', !!pkg.scripts)
}

console.log(`\n📊 结果：${passed} 通过，${failed} 失败`)
if (failed > 0) process.exit(1)
