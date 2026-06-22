const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLATFORM_DIR = path.join(ROOT, 'video-platform');
const REPORTS_DIR = path.join(ROOT, 'reports');

const checks = [];
let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  checks.push({ name, condition, detail });
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`);
  }
}

function fileExists(relPath) {
  return fs.existsSync(path.join(PLATFORM_DIR, relPath));
}

function dirExists(relPath) {
  const full = path.join(PLATFORM_DIR, relPath);
  return fs.existsSync(full) && fs.statSync(full).isDirectory();
}

console.log('\n🎬 音视频工程 - 毕业项目验证\n');
console.log('='.repeat(50));

// --- 项目结构 ---
console.log('\n📁 项目结构');
check('项目根目录存在', fs.existsSync(PLATFORM_DIR));
check('package.json 存在', fileExists('package.json'));
check('src/server 目录存在', dirExists('src/server'));
check('src/client 目录存在', dirExists('src/client'));
check('public 目录存在', dirExists('public'));

// --- 服务器端 ---
console.log('\n🖥️  服务器端');
check('服务入口文件存在', fileExists('src/server/index.ts') || fileExists('src/server/index.js'));
check('路由目录存在', dirExists('src/server/routes'));
check('服务目录存在', dirExists('src/server/services'));

// 检查路由文件
const routesDir = path.join(PLATFORM_DIR, 'src/server/routes');
if (fs.existsSync(routesDir)) {
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  check('至少有 1 个路由文件', routeFiles.length >= 1, `找到 ${routeFiles.length} 个`);
}

// --- 前端 ---
console.log('\n🌐 前端');
check('入口 HTML 存在', fileExists('src/client/index.html'));
check('应用入口存在', fileExists('src/client/app.ts') || fileExists('src/client/app.js'));

const componentsDir = path.join(PLATFORM_DIR, 'src/client/components');
if (fs.existsSync(componentsDir)) {
  const componentFiles = fs.readdirSync(componentsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.tsx') || f.endsWith('.jsx'));
  check('至少有 2 个组件', componentFiles.length >= 2, `找到 ${componentFiles.length} 个`);
}

// --- 核心功能检查 ---
console.log('\n⚙️  核心功能');

// 检查是否有上传相关代码
const serverSrc = path.join(PLATFORM_DIR, 'src/server');
let hasUpload = false;
let hasTranscode = false;
let hasHls = false;
let hasWebRTC = false;

if (fs.existsSync(serverSrc)) {
  const allServerFiles = getAllFiles(serverSrc);
  const content = allServerFiles.map(f => {
    try { return fs.readFileSync(f, 'utf-8'); } catch { return ''; }
  }).join('\n');

  hasUpload = /upload|multer|multipart/i.test(content);
  hasTranscode = /ffmpeg|transcode|transcode/i.test(content);
  hasHls = /hls|m3u8|\.ts/i.test(content);
  hasWebRTC = /webrtc|RTCPeerConnection|signaling|signal/i.test(content);
}

check('包含上传功能代码', hasUpload);
check('包含转码功能代码', hasTranscode);
check('包含 HLS 相关代码', hasHls);
check('包含 WebRTC 相关代码', hasWebRTC);

// --- 前端功能检查 ---
const clientSrc = path.join(PLATFORM_DIR, 'src/client');
let hasPlayer = false;
let hasControls = false;
let hasChat = false;

if (fs.existsSync(clientSrc)) {
  const allClientFiles = getAllFiles(clientSrc);
  const content = allClientFiles.map(f => {
    try { return fs.readFileSync(f, 'utf-8'); } catch { return ''; }
  }).join('\n');

  hasPlayer = /video.*player|hls\.js|Hls|playback/i.test(content);
  hasControls = /play.*pause|volume|fullscreen|progress/i.test(content);
  hasChat = /chat|message|DataChannel|datachannel/i.test(content);
}

check('包含播放器代码', hasPlayer);
check('包含播放控制 UI', hasControls);
check('包含聊天功能代码', hasChat);

// --- 阶段报告 ---
console.log('\n📊 阶段报告');
check('报告目录存在', fs.existsSync(REPORTS_DIR));
for (let i = 1; i <= 5; i++) {
  const reportPath = path.join(REPORTS_DIR, `stage${i}-report.md`);
  check(`Stage ${i} 报告存在`, fs.existsSync(reportPath));
}

// --- 总结 ---
console.log('\n' + '='.repeat(50));
console.log(`\n📋 结果：${passed} 通过 / ${failed} 未通过 / 共 ${checks.length} 项`);

if (failed === 0) {
  console.log('\n🎉 恭喜！所有检查通过！项目完成度优秀。');
} else if (failed <= 3) {
  console.log('\n⚠️  项目基本完成，还有少量检查未通过，请完善。');
} else {
  console.log('\n📝 项目尚未完成，请继续开发。');
}

console.log('');

function getAllFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }
  return files;
}
