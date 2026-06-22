const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const required = [
  'app/layout.tsx',
  'app/page.tsx',
  'app/globals.css',
  'app/(auth)/login/page.tsx',
  'app/(auth)/register/page.tsx',
  'app/(auth)/actions.ts',
  'app/(dashboard)/layout.tsx',
  'app/(dashboard)/projects/page.tsx',
  'app/(dashboard)/projects/actions.ts',
  'app/(dashboard)/projects/create-form.tsx',
  'app/(dashboard)/teams/page.tsx',
  'app/(dashboard)/settings/page.tsx',
  'app/admin/audit/page.tsx',
  'middleware.ts',
  'prisma/schema.prisma',
  'prisma/seed.ts',
  'lib/auth.ts',
  'lib/db.ts',
  'lib/session.ts',
  'lib/permissions.ts',
  'lib/utils.ts',
  'lib/validations.ts',
  'package.json',
  'tsconfig.json',
  'next.config.ts',
  'tailwind.config.ts',
  'postcss.config.js',
  '.env.example',
  'docs/permission-matrix.md',
  'docs/security-review.md',
  'reports/stage1-app-router.md',
  'reports/stage2-auth-db.md',
  'reports/stage3-workflows.md',
  'reports/stage4-quality.md',
  'reports/stage5-launch.md',
];

let ok = true;
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) {
  console.error('Missing files:');
  for (const file of missing) console.error(`  - ${file}`);
  ok = false;
}

const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
for (const model of ['User', 'Team', 'TeamMember', 'Project', 'Document', 'AuditLog', 'Plan', 'Subscription']) {
  if (!schema.includes(`model ${model}`)) {
    console.error(`Missing Prisma model: ${model}`);
    ok = false;
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const requiredDeps = ['next', 'react', '@prisma/client', 'iron-session', 'zod', 'bcryptjs'];
for (const dep of requiredDeps) {
  if (!pkg.dependencies?.[dep]) {
    console.error(`Missing dependency: ${dep}`);
    ok = false;
  }
}

if (ok) {
  console.log('Micro SaaS Starter scaffold: all checks passed.');
} else {
  process.exit(1);
}
