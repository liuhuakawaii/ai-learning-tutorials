const fs = require('fs');
const path = require('path');

const required = [
  'slow.html',
  'work.html',
  'optimized.html',
  'monitor.html',
  'src/slow.js',
  'src/work.js',
  'src/optimized.js',
  'src/vitals.js',
  'styles/slow.css',
  'styles/work.css',
  'styles/optimized.css',
  'assets/hero-optimized.jpg',
  'third-party/analytics.js',
  'reports/stage1-audit.md',
  'reports/stage2-loading-before-after.md',
  'reports/stage3-interaction-before-after.md',
  'reports/stage4-assets-budget.md',
  'reports/stage5-monitoring-report.md'
];

const missing = required.filter((file) => !fs.existsSync(path.join(__dirname, '..', file)));

if (missing.length > 0) {
  console.error('Missing files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Performance Rescue demo files are present.');
