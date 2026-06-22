const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', 'ai-reader');

const REQUIRED_FILES = [
  'manifest.json',
  'background/service-worker.js',
  'content/content.js',
  'popup/popup.html',
  'popup/popup.js'
];

const OPTIONAL_FILES = [
  'popup/popup.css',
  'README.md'
];

const REQUIRED_PERMISSIONS = ['activeTab', 'storage'];

let passed = 0;
let failed = 0;
let warnings = 0;

function check(condition, message, isWarning = false) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else if (isWarning) {
    console.log(`  ⚠️  ${message}`);
    warnings++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function fileExists(filePath) {
  return fs.existsSync(path.join(PROJECT_ROOT, filePath));
}

function readJSON(filePath) {
  try {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, filePath), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

console.log('\n🔍 AI 阅读助手扩展 - 项目验证\n');

// 1. 检查必需文件
console.log('📁 文件结构检查:');
REQUIRED_FILES.forEach(file => {
  check(fileExists(file), `必需文件存在: ${file}`);
});

OPTIONAL_FILES.forEach(file => {
  check(fileExists(file), `可选文件存在: ${file}`, true);
});

// 2. 检查 manifest.json
console.log('\n📋 Manifest 检查:');
const manifest = readJSON('manifest.json');

if (manifest) {
  check(manifest.manifest_version === 3, 'manifest_version 为 3');
  check(typeof manifest.name === 'string' && manifest.name.length > 0, 'name 字段存在且非空');
  check(typeof manifest.version === 'string', 'version 字段存在');
  check(typeof manifest.description === 'string', 'description 字段存在');

  // 检查权限
  const permissions = manifest.permissions || [];
  REQUIRED_PERMISSIONS.forEach(perm => {
    check(permissions.includes(perm), `权限 ${perm} 已声明`);
  });

  // 检查 background
  check(
    manifest.background && (manifest.background.service_worker || manifest.background.scripts),
    'background 配置存在'
  );

  // 检查 content_scripts
  check(
    Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0,
    'content_scripts 配置存在'
  );

  // 检查 action/popup
  check(
    manifest.action && manifest.action.default_popup,
    'popup 配置存在'
  );
} else {
  console.log('  ❌ manifest.json 无法解析');
  failed++;
}

// 3. 检查关键功能实现
console.log('\n⚙️  功能实现检查:');

if (fileExists('content/content.js')) {
  const content = fs.readFileSync(path.join(PROJECT_ROOT, 'content/content.js'), 'utf-8');
  check(content.includes('Readability') || content.includes('readability') || content.includes('extract') || content.includes('querySelector'), '内容提取实现');
  check(content.includes('onMessage') || content.includes('chrome.runtime') || content.includes('addEventListener'), '消息监听存在');
}

if (fileExists('popup/popup.js')) {
  const popup = fs.readFileSync(path.join(PROJECT_ROOT, 'popup/popup.js'), 'utf-8');
  check(popup.includes('chrome.tabs') || popup.includes('browser.tabs') || popup.includes('chrome.runtime'), '标签页 API 使用');
  check(popup.includes('sendMessage') || popup.includes('onMessage') || popup.includes('addEventListener'), '消息通信实现');
}

if (fileExists('background/service-worker.js')) {
  const bg = fs.readFileSync(path.join(PROJECT_ROOT, 'background/service-worker.js'), 'utf-8');
  check(bg.includes('onMessage') || bg.includes('onInstalled') || bg.includes('addEventListener'), '事件监听实现');
  check(bg.includes('chrome.storage') || bg.includes('browser.storage') || bg.includes('storage'), '存储 API 使用');
}

// 4. 代码质量检查
console.log('\n📝 代码质量检查:');

const jsFiles = ['background/service-worker.js', 'popup/popup.js', 'content/content.js'];
jsFiles.forEach(file => {
  if (fileExists(file)) {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf-8');
    check(!content.includes('eval('), `${file} 不使用 eval`);
    check(content.length > 100, `${file} 有足够的代码量`);
  }
});

// 5. 检查资源
console.log('\n🎨 资源检查:');
check(fileExists('popup/popup.html'), 'popup.html 存在');
check(fileExists('popup/popup.css'), 'popup.css 存在', true);

// 结果汇总
console.log('\n' + '='.repeat(50));
console.log(`\n📊 验证结果:`);
console.log(`  ✅ 通过: ${passed}`);
console.log(`  ❌ 失败: ${failed}`);
console.log(`  ⚠️  警告: ${warnings}`);

if (failed === 0) {
  console.log('\n🎉 恭喜！项目验证通过！');
} else {
  console.log('\n⚠️  项目还有问题需要修复。');
}

console.log('');
process.exit(failed > 0 ? 1 : 0);


