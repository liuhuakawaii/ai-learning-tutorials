const fs = require('fs');
const path = require('path');

const required = [
  'README.md',
  'package.json',
  'data/raw/jobs.csv',
  'docs/data-source-research.md',
  'docs/data-dictionary.md',
  'scripts/run-etl.js',
  'server.js',
  'public/index.html',
  'reports/stage1-source-report.md',
  'reports/stage2-etl-quality.md',
  'reports/stage3-api-report.md',
  'reports/stage4-dashboard-report.md',
  'reports/stage5-ops-report.md'
];

const root = path.resolve(__dirname, '..');
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length > 0) {
  console.error('Missing files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Market Insight demo files are present.');
