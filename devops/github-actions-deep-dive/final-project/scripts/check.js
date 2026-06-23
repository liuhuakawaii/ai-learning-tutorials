const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', 'cicd-pipeline')

const REQUIRED_FILES = [
  '.github/workflows/lint.yml',
  '.github/workflows/test.yml',
  '.github/workflows/build.yml',
  '.github/workflows/security.yml',
  '.github/workflows/deploy.yml',
  'Dockerfile',
  'package.json',
  'README.md',
]

const REQUIRED_DIRS = [
  '.github',
  '.github/workflows',
  'src',
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

function fileContains(rel, text) {
  if (!fileExists(rel)) return false
  return fs.readFileSync(path.join(root, rel), 'utf-8').includes(text)
}

console.log('🔍 CI/CD 流水线 — 结构验证\n')

if (!fs.existsSync(root)) {
  console.log('❌ 项目目录不存在:', root)
  console.log('\n请先创建项目：')
  console.log('  mkdir cicd-pipeline && cd cicd-pipeline && npm init -y')
  process.exit(1)
}

console.log('📁 目录结构：')
REQUIRED_DIRS.forEach((d) => check(`目录 ${d} 存在`, dirExists(d)))

console.log('\n📄 必需文件：')
REQUIRED_FILES.forEach((f) => check(`文件 ${f} 存在`, fileExists(f)))

console.log('\n🔧 工作流内容检查：')
check('lint.yml 包含 on.push 或 on.pull_request', fileContains('.github/workflows/lint.yml', 'on:'))
check('test.yml 包含 matrix 策略', fileContains('.github/workflows/test.yml', 'matrix'))
check('build.yml 包含 docker 相关步骤', fileContains('.github/workflows/build.yml', 'docker'))
check('security.yml 包含扫描步骤', fileContains('.github/workflows/security.yml', 'scan') || fileContains('.github/workflows/security.yml', 'trivy') || fileContains('.github/workflows/security.yml', 'codeql'))
check('deploy.yml 包含 environment 配置', fileContains('.github/workflows/deploy.yml', 'environment'))

console.log('\n📦 项目文件：')
check('Dockerfile 存在', fileExists('Dockerfile'))

console.log('\n📦 依赖检查：')
const pkgPath = path.join(root, 'package.json')
if (fileExists('package.json')) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  check('package.json 有 name 字段', !!pkg.name)
  check('package.json 有 scripts 字段', !!pkg.scripts)
}

console.log(`\n📊 结果：${passed} 通过，${failed} 失败`)
if (failed > 0) process.exit(1)
