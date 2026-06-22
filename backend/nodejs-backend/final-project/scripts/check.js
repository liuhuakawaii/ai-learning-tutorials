/**
 * 验证 blog-api 项目的目录结构和必需文件。
 *
 * 用法: node scripts/check.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const REQUIRED_FILES = [
  "src/app.ts",
  "src/config/index.ts",
  "src/routes/index.ts",
  "src/modules/auth/auth.routes.ts",
  "src/modules/auth/auth.service.ts",
  "src/modules/auth/auth.controller.ts",
  "src/modules/auth/auth.schema.ts",
  "src/modules/user/user.routes.ts",
  "src/modules/user/user.service.ts",
  "src/modules/user/user.controller.ts",
  "src/modules/post/post.routes.ts",
  "src/modules/post/post.service.ts",
  "src/modules/post/post.controller.ts",
  "src/modules/post/post.schema.ts",
  "src/modules/comment/comment.routes.ts",
  "src/modules/comment/comment.service.ts",
  "src/modules/comment/comment.controller.ts",
  "src/modules/comment/comment.schema.ts",
  "src/modules/category/category.routes.ts",
  "src/modules/category/category.service.ts",
  "src/modules/category/category.controller.ts",
  "src/modules/category/category.schema.ts",
  "src/modules/tag/tag.routes.ts",
  "src/modules/tag/tag.service.ts",
  "src/modules/tag/tag.controller.ts",
  "src/modules/tag/tag.schema.ts",
  "src/middleware/auth.ts",
  "src/middleware/role.ts",
  "src/middleware/validate.ts",
  "src/middleware/errorHandler.ts",
  "src/middleware/rateLimiter.ts",
  "src/middleware/upload.ts",
  "src/lib/prisma.ts",
  "src/lib/redis.ts",
  "src/lib/logger.ts",
  "src/utils/slug.ts",
  "src/utils/response.ts",
  "src/utils/errors.ts",
  "prisma/schema.prisma",
  "docker-compose.yml",
  "Dockerfile",
  "tsconfig.json",
  "package.json",
  ".env.example",
];

const FORBIDDEN_FILES = [".env", "logs/combined.log", "logs/error.log"];

let errors = [];
let warnings = [];

// 检查必需文件
for (const rel of REQUIRED_FILES) {
  if (!fs.existsSync(path.join(root, rel))) {
    errors.push(`缺失: ${rel}`);
  }
}

// 检查不应提交的文件
for (const rel of FORBIDDEN_FILES) {
  if (fs.existsSync(path.join(root, rel))) {
    warnings.push(`警告: ${rel} 不应提交到仓库（已在 .gitignore 中）`);
  }
}

// 检查 Prisma schema 中的模型
const schemaPath = path.join(root, "prisma", "schema.prisma");
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf-8");
  const requiredModels = ["User", "Post", "Comment", "Category", "Tag"];
  for (const model of requiredModels) {
    if (!schema.includes(`model ${model}`)) {
      errors.push(`Prisma schema 缺少模型: ${model}`);
    }
  }
}

// 输出结果
if (errors.length > 0) {
  errors.forEach((e) => console.log(`  ✗ ${e}`));
}
if (warnings.length > 0) {
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}
if (errors.length === 0) {
  console.log("  ✓ blog-api 结构验证通过");
  process.exit(0);
} else {
  process.exit(1);
}
