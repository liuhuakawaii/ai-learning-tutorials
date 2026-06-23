const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function check(description, condition) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ ${description}`);
    failed++;
  }
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function dirExists(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) && fs.statSync(p).isDirectory();
}

function fileContains(rel, pattern) {
  if (!fileExists(rel)) return false;
  const content = fs.readFileSync(path.join(ROOT, rel), "utf-8");
  return typeof pattern === "string"
    ? content.includes(pattern)
    : pattern.test(content);
}

function countDirs(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return 0;
  return fs.readdirSync(p).filter((f) => {
    const fp = path.join(p, f);
    return fs.statSync(fp).isDirectory();
  }).length;
}

console.log("\n🔍 生成艺术系列 - 项目验证\n");

// ── 1. 项目基础文件 ──
console.log("📁 项目基础文件：");
check("README.md 存在", fileExists("README.md"));
check("package.json 存在", fileExists("package.json"));
check("vite.config.ts 存在", fileExists("vite.config.ts"));
check("tsconfig.json 存在", fileExists("tsconfig.json"));

// ── 2. 前端源码结构 ──
console.log("\n📁 源码结构：");
check("src/ 目录存在", dirExists("src"));
check("src/main.ts 存在", fileExists("src/main.ts"));
check("src/artworks/ 目录存在", dirExists("src/artworks"));
check("src/core/ 目录存在", dirExists("src/core"));

// ── 3. 算法作品数量 ──
console.log("\n🎨 算法作品：");
const artworkCount = countDirs("src/artworks");
check(`至少 5 个算法作品目录（当前: ${artworkCount}）`, artworkCount >= 5);

// ── 4. 核心模块 ──
console.log("\n🔧 核心模块：");
check("导出模块存在", fileExists("src/core/exporter.ts"));
check("随机数模块存在", fileExists("src/core/random.ts"));
check("Canvas 管理存在", fileExists("src/core/canvas.ts") || fileExists("src/core/gui.ts"));

// ── 5. 画廊 ──
console.log("\n🖼️ 画廊：");
check("画廊组件存在", dirExists("src/gallery") || fileExists("src/gallery/Gallery.ts"));

// ── 6. 类型定义 ──
console.log("\n📐 类型：");
check("types 目录存在", dirExists("src/types"));

// ── 汇总 ──
console.log("\n" + "─".repeat(50));
console.log(`\n📊 结果：${passed} 通过 / ${failed} 失败 / 共 ${passed + failed} 项`);

if (failed > 0) {
  console.log("\n⚠️  部分检查未通过，请根据上述提示修复。\n");
  process.exit(1);
} else {
  console.log("\n🎉 所有检查通过！项目结构完整。\n");
  process.exit(0);
}
