#!/usr/bin/env node

/**
 * 毕业项目验证脚本
 * 检查创意动效作品集网站的完整性
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(ROOT, '..');

let passed = 0;
let failed = 0;
let warnings = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

function warn(condition, message) {
  if (!condition) {
    console.log(`  ⚠ ${message}`);
    warnings++;
  }
}

function fileExists(...segments) {
  return fs.existsSync(path.join(...segments));
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function findFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findFiles(fullPath, ext));
    } else if (item.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

console.log('\n🎨 创意动效作品集网站 - 验证脚本\n');

// ========== 基础检查 ==========
console.log('📁 基础检查');

const possibleProjectDirs = ['my-portfolio', 'portfolio', 'app', 'src'];
let projectDir = null;

for (const dir of possibleProjectDirs) {
  if (fileExists(PROJECT_ROOT, dir)) {
    projectDir = path.join(PROJECT_ROOT, dir);
    break;
  }
}

if (!projectDir) {
  projectDir = PROJECT_ROOT;
}

check(fileExists(projectDir, 'package.json'), 'package.json 存在');

const pkg = readJSON(path.join(projectDir, 'package.json'));
if (pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  check(deps['gsap'] || deps['@gsap/react'], '包含 GSAP 依赖');
  warn(deps['three'] || deps['@types/three'], '包含 Three.js 依赖（推荐）');
  warn(deps['vite'] || deps['next'] || deps['nuxt'], '包含构建工具（推荐）');
}

// 检查页面文件
const pagePatterns = ['index.html', 'src/App.tsx', 'src/App.jsx', 'src/App.vue', 'pages/index.tsx', 'pages/index.vue'];
const hasPage = pagePatterns.some(p => fileExists(projectDir, p));
check(hasPage, '存在入口页面文件');

// ========== 动效检查 ==========
console.log('\n🎬 动效检查');

const srcDir = path.join(projectDir, 'src');
const allJSFiles = [
  ...findFiles(srcDir, '.tsx'),
  ...findFiles(srcDir, '.jsx'),
  ...findFiles(srcDir, '.ts'),
  ...findFiles(srcDir, '.js'),
  ...findFiles(srcDir, '.vue'),
  ...findFiles(srcDir, '.css'),
  ...findFiles(srcDir, '.scss'),
];

let allContent = '';
for (const file of allJSFiles) {
  allContent += fs.readFileSync(file, 'utf-8') + '\n';
}

const animationTypes = [
  { name: 'CSS Transition', pattern: /transition\s*:/ },
  { name: 'CSS @keyframes', pattern: /@keyframes/ },
  { name: 'GSAP tween', pattern: /gsap\.(to|from|fromTo|timeline)/ },
  { name: 'ScrollTrigger', pattern: /ScrollTrigger/ },
  { name: 'requestAnimationFrame', pattern: /requestAnimationFrame/ },
  { name: 'Three.js 动画', pattern: /(AnimationMixer|gsap\.to.*three|useFrame)/ },
  { name: 'Web Animations API', pattern: /\.animate\(/ },
  { name: 'Canvas 动画', pattern: /(getContext.*2d|CanvasRenderingContext2D)/ },
];

let foundTypes = 0;
for (const type of animationTypes) {
  if (type.pattern.test(allContent)) {
    foundTypes++;
    console.log(`  ✓ 包含 ${type.name}`);
  }
}
check(foundTypes >= 5, `包含至少 5 种动画类型（当前 ${foundTypes} 种）`);

check(/gsap\.timeline|tl\.(to|from|fromTo)/, '使用 GSAP Timeline');
check(/ScrollTrigger/, '使用 ScrollTrigger');

// 性能降级检查
const hasDegradation = /prefers-reduced-motion|matchMedia|isMobile|isLowEnd|navigator\.hardwareConcurrency/.test(allContent);
check(hasDegradation, '存在性能降级逻辑');

// ========== 质量检查 ==========
console.log('\n🔍 质量检查');

const consoleLogCount = (allContent.match(/console\.log\(/g) || []).length;
check(consoleLogCount === 0, `无 console.log 残留（当前 ${consoleLogCount} 处）`);

// 检查是否有大图片
const imageFiles = [
  ...findFiles(projectDir, '.png'),
  ...findFiles(projectDir, '.jpg'),
  ...findFiles(projectDir, '.jpeg'),
];

let largeImages = 0;
for (const img of imageFiles) {
  const stats = fs.statSync(img);
  if (stats.size > 500 * 1024) {
    largeImages++;
  }
}
warn(largeImages === 0, `发现 ${largeImages} 张超过 500KB 的图片，建议压缩`);

// ========== 结果汇总 ==========
console.log('\n' + '='.repeat(40));
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${failed}`);
console.log(`⚠️  警告: ${warnings}`);
console.log('='.repeat(40));

if (failed > 0) {
  console.log('\n💔 验证未通过，请修复上述问题后重试。');
  process.exit(1);
} else {
  console.log('\n🎉 恭喜！所有验证通过！');
  process.exit(0);
}
