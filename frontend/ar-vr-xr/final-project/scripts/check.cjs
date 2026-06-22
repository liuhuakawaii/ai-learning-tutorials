const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ROOT = path.resolve(PROJECT_ROOT, '..');

const REQUIRED_LESSONS = [
  'stage1-spatial-computing/01-空间计算概览.md',
  'stage1-spatial-computing/02-3D数学复习.md',
  'stage1-spatial-computing/03-空间UI设计原则.md',
  'stage1-spatial-computing/04-性能要求.md',
  'stage1-spatial-computing/05-开发环境搭建.md',
  'stage1-spatial-computing/06-阶段实战-第一个3D场景.md',
  'stage2-webxr-threejs/01-WebXR-API入门.md',
  'stage2-webxr-threejs/02-AR会话.md',
  'stage2-webxr-threejs/03-VR会话.md',
  'stage2-webxr-threejs/04-Three.js-XR集成.md',
  'stage2-webxr-threejs/05-空间音频.md',
  'stage2-webxr-threejs/06-阶段实战-WebXR产品展示.md',
  'stage3-ar-development/01-图像追踪.md',
  'stage3-ar-development/02-面部追踪.md',
  'stage3-ar-development/03-物体追踪.md',
  'stage3-ar-development/04-GPS-AR.md',
  'stage3-ar-development/05-LiDAR扫描.md',
  'stage3-ar-development/06-阶段实战-AR导航应用.md',
  'stage4-vr-development/01-VR交互设计.md',
  'stage4-vr-development/02-VR移动机制.md',
  'stage4-vr-development/03-VR-UI系统.md',
  'stage4-vr-development/04-VR多人协作.md',
  'stage4-vr-development/05-VR性能优化.md',
  'stage4-vr-development/06-阶段实战-VR协作空间.md',
  'stage5-spatial-apps/01-空间计算与AI.md',
  'stage5-spatial-apps/02-数字孪生.md',
  'stage5-spatial-apps/03-空间计算商业模式.md',
  'stage5-spatial-apps/04-跨平台开发.md',
  'stage5-spatial-apps/05-发布与分发.md',
  'stage5-spatial-apps/06-阶段实战-完整空间应用.md',
];

const REQUIRED_READMES = [
  'README.md',
  'stage1-spatial-computing/README.md',
  'stage2-webxr-threejs/README.md',
  'stage3-ar-development/README.md',
  'stage4-vr-development/README.md',
  'stage5-spatial-apps/README.md',
];

const REQUIRED_SECTIONS = ['场景引入', '学习目标', '常见误区', '工程建议', '小结', '练习', '参考答案'];

let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, ok, detail) {
  if (ok) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function warn(name, detail) {
  console.log(`  \x1b[33m⚠\x1b[0m ${name}${detail ? ' — ' + detail : ''}`);
  warnings++;
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readLines(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return [];
  return fs.readFileSync(full, 'utf-8').split('\n');
}

// 1. Check lesson files exist
console.log('\n\x1b[1m📚 课时文件检查\x1b[0m');
for (const lesson of REQUIRED_LESSONS) {
  check(lesson, fileExists(lesson), '文件不存在');
}

// 2. Check README files
console.log('\n\x1b[1m📖 README 文件检查\x1b[0m');
for (const readme of REQUIRED_READMES) {
  check(readme, fileExists(readme), '文件不存在');
}

// 3. Check lesson content quality
console.log('\n\x1b[1m📝 课时内容检查\x1b[0m');
for (const lesson of REQUIRED_LESSONS) {
  if (!fileExists(lesson)) continue;

  const lines = readLines(lesson);
  const lineCount = lines.length;

  // Check line count
  if (lineCount < 150) {
    warn(lesson, `只有 ${lineCount} 行（建议 200-350 行）`);
  } else if (lineCount > 400) {
    warn(lesson, `有 ${lineCount} 行（建议 200-350 行）`);
  }

  // Check required sections
  const content = lines.join('\n');
  const missingSections = REQUIRED_SECTIONS.filter(
    (s) => !content.includes(`## ${s}`)
  );
  if (missingSections.length > 0) {
    check(
      `${lesson} 章节结构`,
      false,
      `缺少: ${missingSections.join(', ')}`
    );
  } else {
    check(`${lesson} 章节结构`, true);
  }
}

// 4. Check README content
console.log('\n\x1b[1m📋 README 内容检查\x1b[0m');
const rootReadme = readLines('README.md');
const rootContent = rootReadme.join('\n');
check('README 包含课程简介', rootContent.includes('课程简介'));
check('README 包含学习路线', rootContent.includes('学习路线'));
check('README 包含课程大纲', rootContent.includes('课程大纲'));
check('README 包含目录结构', rootContent.includes('目录结构'));

// 5. Check stage READMEs have lesson list
console.log('\n\x1b[1m📂 阶段 README 检查\x1b[0m');
const stageDirs = [
  'stage1-spatial-computing',
  'stage2-webxr-threejs',
  'stage3-ar-development',
  'stage4-vr-development',
  'stage5-spatial-apps',
];
for (const stage of stageDirs) {
  const stageReadme = path.join(stage, 'README.md');
  if (!fileExists(stageReadme)) continue;
  const content = readLines(stageReadme).join('\n');
  check(
    `${stageReadme} 包含课时列表`,
    content.includes('01-') || content.includes('课时') || content.includes('## ')
  );
}

// 6. Check project files
console.log('\n\x1b[1m🔧 项目文件检查\x1b[0m');
check('final-project/项目说明.md', fileExists('final-project/项目说明.md'));
check('final-project/scripts/check.cjs', fileExists('final-project/scripts/check.cjs'));

// Check report templates
const reportTemplates = [
  'final-project/reports/stage1-report.md',
  'final-project/reports/stage2-report.md',
  'final-project/reports/stage3-report.md',
  'final-project/reports/stage4-report.md',
  'final-project/reports/stage5-report.md',
];
for (const report of reportTemplates) {
  check(report, fileExists(report));
}

// Summary
console.log('\n' + '─'.repeat(50));
console.log(
  `\x1b[1m结果: \x1b[32m${passed} 通过\x1b[0m, \x1b[31m${failed} 失败\x1b[0m, \x1b[33m${warnings} 警告\x1b[0m`
);

if (failed > 0) {
  console.log('\n\x1b[31m请修复上述问题后重新检查。\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m所有检查通过！\x1b[0m');
  process.exit(0);
}
