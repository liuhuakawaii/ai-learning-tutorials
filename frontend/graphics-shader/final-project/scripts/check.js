const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', 'shader-showcase')

const REQUIRED_FILES = [
  'src/shaders/sdf-2d/fragment.glsl',
  'src/shaders/sdf-2d/config.ts',
  'src/shaders/ray-marching/fragment.glsl',
  'src/shaders/ray-marching/config.ts',
  'src/shaders/fractal/fragment.glsl',
  'src/shaders/noise/fragment.glsl',
  'src/shaders/lighting/fragment.glsl',
  'src/components/ShaderCanvas.tsx',
  'src/components/ControlPanel.tsx',
  'src/components/ShaderGrid.tsx',
  'src/renderer/index.ts',
  'src/App.tsx',
  'package.json',
  'README.md',
]

const REQUIRED_DIRS = [
  'src/shaders/sdf-2d',
  'src/shaders/ray-marching',
  'src/shaders/fractal',
  'src/shaders/noise',
  'src/shaders/lighting',
  'src/components',
  'src/renderer',
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

console.log('🔍 Shader 特效展示站 — 结构验证\n')

if (!fs.existsSync(root)) {
  console.log('❌ 项目目录不存在:', root)
  console.log('\n请先创建项目：')
  console.log('  mkdir shader-showcase && cd shader-showcase && npm init -y')
  process.exit(1)
}

console.log('📁 目录结构：')
REQUIRED_DIRS.forEach((d) => check(`目录 ${d} 存在`, dirExists(d)))

console.log('\n📄 必需文件：')
REQUIRED_FILES.forEach((f) => check(`文件 ${f} 存在`, fileExists(f)))

console.log('\n🎨 Shader 文件统计：')
const shaderDirs = ['sdf-2d', 'ray-marching', 'fractal', 'noise', 'lighting']
let shaderCount = 0
shaderDirs.forEach((d) => {
  const fragPath = path.join(root, `src/shaders/${d}/fragment.glsl`)
  if (fs.existsSync(fragPath)) shaderCount++
})
check(`至少 5 个 Shader 效果（当前 ${shaderCount} 个）`, shaderCount >= 5)

console.log('\n📦 依赖检查：')
const pkgPath = path.join(root, 'package.json')
if (fileExists('package.json')) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  check('package.json 有 name 字段', !!pkg.name)
  check('package.json 有 scripts 字段', !!pkg.scripts)
}

console.log(`\n📊 结果：${passed} 通过，${failed} 失败`)
if (failed > 0) process.exit(1)
