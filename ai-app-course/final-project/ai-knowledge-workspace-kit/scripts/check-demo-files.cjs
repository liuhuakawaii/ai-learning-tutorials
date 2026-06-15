const fs = require('fs');
const path = require('path');

const required = [
  'README.md',
  'package.json',
  'data/docs/product-brief.md',
  'data/docs/operations.md',
  'data/evals.json',
  'src/build-index.mjs',
  'src/ask.mjs',
  'src/eval.mjs',
  'reports/stage1-api-baseline.md',
  'reports/stage2-rag-quality.md',
  'reports/stage3-tool-calls.md',
  'reports/stage4-productization.md',
  'reports/stage5-eval-release.md'
];

const root = path.resolve(__dirname, '..');
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length > 0) {
  console.error('Missing files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log('AI Knowledge Workspace kit files are present.');
