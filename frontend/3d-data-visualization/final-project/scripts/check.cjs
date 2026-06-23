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

console.log("\n🔍 3D 数据大屏 - 项目验证\n");

// ── 1. 项目基础文件 ──
console.log("📁 项目基础文件：");
check("README.md 存在", fileExists("README.md"));
check("package.json 存在", fileExists("package.json"));
check("vite.config.ts 存在", fileExists("vite.config.ts"));
check("tsconfig.json 存在", fileExists("tsconfig.json"));

// ── 2. 源码结构 ──
console.log("\n📁 源码结构：");
check("src/ 目录存在", dirExists("src"));
check("src/main.ts 存在", fileExists("src/main.ts"));
check("src/scenes/ 目录存在", dirExists("src/scenes"));

// ── 3. 3D 场景 ──
console.log("\n🌍 3D 场景：");
check("地球场景存在", fileExists("src/scenes/Globe.ts"));
check("网络拓扑场景存在", fileExists("src/scenes/NetworkGraph.ts") || fileExists("src/scenes/Network.ts"));
check("时序数据场景存在", fileExists("src/scenes/TimeSeries3D.ts") || fileExists("src/scenes/TimeSeries.ts"));
check("场景管理器存在", fileExists("src/scenes/SceneManager.ts") || fileExists("src/scenes/Manager.ts"));

// ── 4. 着色器 ──
console.log("\n✨ 着色器：");
check("shaders 目录存在", dirExists("src/shaders") || dirExists("public/shaders"));

// ── 5. 数据文件 ──
console.log("\n📊 数据文件：");
check("data 目录存在", dirExists("src/data") || dirExists("public/data"));

// ── 6. Three.js 使用 ──
console.log("\n🔧 Three.js 集成：");
check("package.json 包含 three.js",
  fileContains("package.json", /three/)
);
check("场景文件使用 Three.js",
  fileContains("src/scenes/Globe.ts", /three|THREE|Scene|Camera|Renderer/) ||
  fileContains("src/scenes/NetworkGraph.ts", /three|THREE|Scene/)
);

// ── 7. 工具函数 ──
console.log("\n🛠️ 工具：");
check("utils 目录存在", dirExists("src/utils"));
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
