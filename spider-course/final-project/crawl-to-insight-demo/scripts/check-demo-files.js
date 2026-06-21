const fs = require('fs');
const path = require('path');

const required = [
  'README.md',
  'package.json',
  'requirements.txt',
  'fixtures/page-1.html',
  'fixtures/page-2.html',
  'scripts/crawl-fixtures.js',
  'scripts/crawl_playwright.py',
  'scripts/books_spider.py',
  'reports/stage2-static-crawl.md',
  'reports/stage4-scrapy-plan.md',
  'reports/stage5-compliance.md'
];

const root = path.resolve(__dirname, '..');
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length > 0) {
  console.error('Missing files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Crawl To Insight demo files are present.');
