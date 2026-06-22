const fs = require("fs");
const path = require("path");

const REQUIRED = [
  "src/db-server/index.ts",
  "src/api-server/index.ts",
  "src/fs-server/index.ts",
  "src/shared/auth.ts",
  "scripts/check.cjs",
  "package.json",
  "tsconfig.json",
  "reports/stage1-protocol.md",
  "reports/stage2-server-dev.md",
  "reports/stage3-advanced.md",
  "reports/stage4-integration.md",
];

const root = path.resolve(__dirname, "..");
const missing = REQUIRED.filter((f) => !fs.existsSync(path.join(root, f)));

if (missing.length > 0) {
  missing.forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log("  ✓ mcp-tool-suite 结构验证通过");
