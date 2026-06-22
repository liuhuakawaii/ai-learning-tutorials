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

console.log("\n🔍 WASM 多媒体处理平台 - 项目验证\n");

// ── 1. 项目基础文件 ──
console.log("📁 项目基础文件：");
check("README.md 存在", fileExists("README.md"));
check("package.json 存在", fileExists("package.json"));
check("vite.config.ts 存在", fileExists("vite.config.ts"));
check("tsconfig.json 存在", fileExists("tsconfig.json"));

// ── 2. 前端源码结构 ──
console.log("\n📁 前端源码结构：");
check("src/ 目录存在", dirExists("src"));
check("src/main.ts 存在", fileExists("src/main.ts"));
check("src/App.vue 或 src/App.tsx 存在", fileExists("src/App.vue") || fileExists("src/App.tsx"));
check("src/components/ 目录存在", dirExists("src/components"));
check("src/workers/ 目录存在", dirExists("src/workers"));
check("src/wasm/ 目录存在", dirExists("src/wasm"));
check("src/types/ 目录存在", dirExists("src/types"));

// ── 3. 组件文件 ──
console.log("\n📁 UI 组件：");
check("图像处理组件存在", fileExists("src/components/ImageProcessor.vue") || fileExists("src/components/ImageProcessor.tsx"));
check("音频处理组件存在", fileExists("src/components/AudioProcessor.vue") || fileExists("src/components/AudioProcessor.tsx"));
check("文件压缩组件存在", fileExists("src/components/FileCompressor.vue") || fileExists("src/components/FileCompressor.tsx"));
check("性能面板组件存在", fileExists("src/components/PerformancePanel.vue") || fileExists("src/components/PerformancePanel.tsx"));

// ── 4. Rust Wasm 模块 ──
console.log("\n📁 Rust Wasm 模块：");
check("crates/ 目录存在", dirExists("crates"));
check("crates/image-processor/ 存在", dirExists("crates/image-processor"));
check("image-processor Cargo.toml 存在", fileExists("crates/image-processor/Cargo.toml"));
check("image-processor lib.rs 存在", fileExists("crates/image-processor/src/lib.rs"));
check("audio-processor 模块存在", dirExists("crates/audio-processor"));
check("file-compressor 模块存在", dirExists("crates/file-compressor"));

// ── 5. Rust 代码模式检查 ──
console.log("\n🔍 Rust 代码模式：");
check(
  "image-processor 使用 wasm-bindgen",
  fileContains("crates/image-processor/Cargo.toml", "wasm-bindgen")
);
check(
  "image-processor 导出函数",
  fileContains("crates/image-processor/src/lib.rs", "#[wasm_bindgen]")
);
check(
  "image-processor 使用 web-sys 或 js-sys",
  fileContains("crates/image-processor/Cargo.toml", /web-sys|js-sys/)
);

// ── 6. Worker 相关代码 ──
console.log("\n🔍 Worker 与多线程：");
check(
  "Worker 池实现存在",
  fileExists("src/workers/worker-pool.ts")
);
check(
  "Worker 池使用 SharedArrayBuffer 或 Worker",
  fileContains("src/workers/worker-pool.ts", /Worker|SharedArrayBuffer/)
);
check(
  "有 Worker 创建逻辑",
  fileContains("src/workers/worker-pool.ts", /new Worker|createWorker/)
);

// ── 7. Wasm 集成代码 ──
console.log("\n🔍 Wasm 集成：");
check(
  "有 Wasm 模块封装",
  fileExists("src/wasm/image-processor.ts")
);
check(
  "封装代码导入 Wasm",
  fileContains("src/wasm/image-processor.ts", /wasm|import.*init|import.*processor/)
);

// ── 8. 测试文件 ──
console.log("\n📁 测试文件：");
check(
  "Wasm 模块测试存在",
  fileExists("crates/image-processor/tests/web.rs") || fileExists("crates/image-processor/tests/integration.rs")
);
check(
  "前端测试或基准测试存在",
  fileExists("tests/benchmark.test.ts") || fileExists("src/utils/benchmark.ts")
);

// ── 9. 报告文件 ──
console.log("\n📁 阶段报告：");
for (let i = 1; i <= 5; i++) {
  check(
    `stage${i}-report.md 存在`,
    fileExists(`reports/stage${i}-report.md`)
  );
}

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
