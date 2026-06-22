const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const required = [
  'docker-compose.yml',
  'nginx.conf',
  '.env.example',
  'scripts/backup.sh',
  'scripts/deploy.sh',
  'scripts/health-check.sh',
  'reports/stage1-n8n-foundations.md',
  'reports/stage2-advanced-workflows.md',
  'reports/stage3-ai-workflows.md',
  'reports/stage4-integrations.md',
  'reports/stage5-enterprise-automation.md'
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) {
  console.error('Missing files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

if (!compose.includes('n8n')) {
  throw new Error('docker-compose.yml should include n8n service.');
}
if (!compose.includes('postgres')) {
  throw new Error('docker-compose.yml should include postgres service.');
}
if (!compose.includes('redis')) {
  throw new Error('docker-compose.yml should include redis service.');
}
if (!compose.includes('healthcheck')) {
  throw new Error('docker-compose.yml should include healthcheck.');
}
if (!envExample.includes('N8N_ENCRYPTION_KEY')) {
  throw new Error('.env.example should include N8N_ENCRYPTION_KEY.');
}

const reportsDir = path.join(root, 'reports');
const reports = fs.readdirSync(reportsDir);
if (reports.length < 5) {
  throw new Error('reports/ should contain at least 5 stage reports.');
}

console.log('Automation Hub files are present and valid.');
console.log(`- docker-compose.yml: includes n8n, postgres, redis, healthcheck`);
console.log(`- .env.example: includes N8N_ENCRYPTION_KEY`);
console.log(`- reports/: ${reports.length} report(s) found`);
