const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const required = [
  'Dockerfile.api',
  '.dockerignore',
  'docker-compose.yml',
  'docker-compose.prod.yml',
  '.github/workflows/ci.yml',
  'scripts/deploy.sh',
  'scripts/backup-db.sh',
  'scripts/rollback.sh',
  '.env.example',
  'api/server.js',
  'reports/stage1-container.md',
  'reports/stage2-compose.md',
  'reports/stage3-ci.md',
  'reports/stage4-deploy.md',
  'reports/stage5-reliability.md'
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) {
  console.error('Missing files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile.api'), 'utf8');
const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');

if (!dockerfile.includes('USER app')) throw new Error('Dockerfile.api should run as non-root user.');
if (!compose.includes('healthcheck:')) throw new Error('docker-compose.yml should include healthcheck.');
if (!compose.includes('volumes:')) throw new Error('docker-compose.yml should include persistent volumes.');

console.log('Production Launch Kit files are present.');
