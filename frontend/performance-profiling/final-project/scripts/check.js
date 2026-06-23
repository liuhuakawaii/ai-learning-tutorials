const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

const REQUIRED_REPORTS = [
  'reports/stage1-performance.md',
  'reports/stage2-memory.md',
  'reports/stage3-lighthouse.md',
  'reports/stage4-web-vitals.md',
  'reports/stage5-optimization.md',
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

function fileContains(rel, text) {
  if (!fileExists(rel)) return false
  return fs.readFileSync(path.join(root, rel), 'utf-8').includes(text)
}

console.log('🔍 性能分析报告 — 结构验证\n')

console.log('📄 阶段报告：')
REQUIRED_REPORTS.forEach((f) => check(`报告 ${f} 存在`, fileExists(f)))

console.log('\n📝 报告内容检查：')
check('stage1 包含 Performance 关键词', fileContains('reports/stage1-performance.md', 'Performance'))
check('stage2 包含 Memory 或 Heap 关键词', fileContains('reports/stage2-memory.md', 'Memory') || fileContains('reports/stage2-memory.md', 'Heap'))
check('stage3 包含 Lighthouse 关键词', fileContains('reports/stage3-lighthouse.md', 'Lighthouse'))
check('stage4 包含 Web Vitals 或 LCP 关键词', fileContains('reports/stage4-web-vitals.md', 'LCP') || fileContains('reports/stage4-web-vitals.md', 'Vitals'))
check('stage5 包含优化方案或对比', fileContains('reports/stage5-optimization.md', '优化'))

console.log('\n📁 截图目录：')
check('reports/screenshots/ 目录存在', fs.existsSync(path.join(root, 'reports/screenshots')) && fs.statSync(path.join(root, 'reports/screenshots')).isDirectory())

console.log(`\n📊 结果：${passed} 通过，${failed} 失败`)
if (failed > 0) process.exit(1)
