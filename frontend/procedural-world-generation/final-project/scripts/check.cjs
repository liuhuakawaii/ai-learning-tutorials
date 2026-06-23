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

console.log("\n🔍 程序化世界生成器 - 项目验证\n");

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

// ── 3. 世界生成 ──
console.log("\n🌍 世界生成：");
check("src/world/ 目录存在", dirExists("src/world"));
check("Chunk.ts 存在", fileExists("src/world/Chunk.ts"));
check("ChunkManager.ts 存在", fileExists("src/world/ChunkManager.ts") || fileExists("src/world/World.ts"));
check("Biome.ts 存在（生物群落）", fileExists("src/world/Biome.ts"));
check("Terrain.ts 存在（地形）", fileExists("src/world/Terrain.ts"));
check("Vegetation.ts 存在（植被）", fileExists("src/world/Vegetation.ts"));
check("Water.ts 存在（水体）", fileExists("src/world/Water.ts") || fileExists("src/world/WaterSystem.ts"));

// ── 4. 噪声系统 ──
console.log("\n🌀 噪声系统：");
check("src/noise/ 目录存在", dirExists("src/noise"));
check("SimplexNoise 或 Perlin 噪声存在",
  fileExists("src/noise/SimplexNoise.ts") || fileExists("src/noise/Perlin.ts") || fileExists("src/noise/Noise.ts")
);
check("FBM 存在", fileExists("src/noise/FBM.ts") || fileContains("src/noise/SimplexNoise.ts", /fbm|FBM|fractal/));

// ── 5. 着色器 ──
console.log("\n✨ 着色器：");
check("渲染目录存在", dirExists("src/rendering") || dirExists("src/shaders"));

// ── 6. 玩家控制 ──
console.log("\n🎮 玩家控制：");
check("player 目录存在", dirExists("src/player"));
check("Player.ts 存在", fileExists("src/player/Player.ts"));
check("Camera.ts 存在", fileExists("src/player/Camera.ts"));
check("Minimap.ts 存在（小地图）", fileExists("src/player/Minimap.ts"));

// ── 7. Worker ──
console.log("\n⚡ Web Worker：");
check("workers 目录存在", dirExists("src/workers"));

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
