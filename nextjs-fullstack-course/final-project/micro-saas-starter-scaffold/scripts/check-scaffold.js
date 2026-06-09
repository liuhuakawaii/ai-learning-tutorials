const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const required = [
  'app/layout.tsx',
  'app/page.tsx',
  'app/(auth)/login/page.tsx',
  'app/(dashboard)/layout.tsx',
  'app/(dashboard)/projects/page.tsx',
  'app/admin/audit/page.tsx',
  'prisma/schema.prisma',
  'lib/permissions.ts',
  'docs/permission-matrix.md',
  'docs/security-review.md',
  'reports/stage1-app-router.md',
  'reports/stage2-auth-db.md',
  'reports/stage3-workflows.md',
  'reports/stage4-quality.md',
  'reports/stage5-launch.md'
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) {
  console.error('Missing files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
for (const model of ['User', 'Team', 'TeamMember', 'Project', 'AuditLog']) {
  if (!schema.includes(`model ${model}`)) throw new Error(`Missing Prisma model ${model}`);
}

console.log('Micro SaaS Starter scaffold files are present.');
