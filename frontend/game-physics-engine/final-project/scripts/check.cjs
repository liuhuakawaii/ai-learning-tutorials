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

console.log("\n🔍 2D 物理引擎 - 项目验证\n");

// ── 1. 项目基础文件 ──
console.log("📁 项目基础文件：");
check("README.md 存在", fileExists("README.md"));
check("package.json 存在", fileExists("package.json"));
check("vite.config.ts 存在", fileExists("vite.config.ts"));
check("tsconfig.json 存在", fileExists("tsconfig.json"));

// ── 2. 数学库 ──
console.log("\n📐 数学库：");
check("src/math/ 目录存在", dirExists("src/math"));
check("Vec2.ts 存在", fileExists("src/math/Vec2.ts"));
check("Mat2x2.ts 存在", fileExists("src/math/Mat2x2.ts") || fileExists("src/math/utils.ts"));
check("Vec2 包含向量运算", fileContains("src/math/Vec2.ts", /add|subtract|dot|cross|normalize/));

// ── 3. 物理引擎核心 ──
console.log("\n⚙️ 物理引擎核心：");
check("src/physics/ 目录存在", dirExists("src/physics"));
check("Body.ts 存在（刚体）", fileExists("src/physics/Body.ts"));
check("World.ts 存在（物理世界）", fileExists("src/physics/World.ts"));
check("Collision.ts 存在（碰撞检测）", fileExists("src/physics/Collision.ts") || fileExists("src/physics/CollisionDetection.ts"));
check("Shape.ts 存在（形状）", fileExists("src/physics/Shape.ts") || dirExists("src/physics/shapes"));
check("Solver.ts 存在（约束求解）", fileExists("src/physics/Solver.ts"));
check("Joint.ts 或约束文件存在", fileExists("src/physics/Joint.ts") || fileExists("src/physics/Constraint.ts"));

// ── 4. 碰撞相关 ──
console.log("\n💥 碰撞系统：");
check("碰撞检测包含 SAT 或圆形检测",
  fileContains("src/physics/Collision.ts", /SAT|circleVsCircle|circleVsPolygon|detectCollision/) ||
  fileContains("src/physics/Shape.ts", /SAT|circleVs/)
);
check("接触信息存在", fileExists("src/physics/Contact.ts") || fileContains("src/physics/Collision.ts", /Contact|penetration|normal/));

// ── 5. 调试渲染 ──
console.log("\n🖥️ 调试渲染：");
check("src/debug/ 目录存在", dirExists("src/debug"));
check("调试渲染器存在", fileExists("src/debug/Renderer.ts") || fileExists("src/debug/DebugRenderer.ts"));

// ── 6. 演示场景 ──
console.log("\n🎬 演示场景：");
check("src/demos/ 目录存在", dirExists("src/demos"));

// ── 7. 测试 ──
console.log("\n🧪 测试：");
check("tests/ 目录存在", dirExists("tests"));

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
