#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STAGES = [
  'stage1-fundamentals',
  'stage2-navigation-and-state',
  'stage3-native-modules',
  'stage4-ai-mobile-integration',
  'stage5-publish-and-grow',
];

const STAGE_LABELS = [
  'Stage 1：Expo 基础',
  'Stage 2：导航与状态',
  'Stage 3：原生模块',
  'Stage 4：AI 移动端集成',
  'Stage 5：发布与增长',
];

let passed = 0;
let failed = 0;
const errors = [];

function check(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.log(`  ❌ ${message}`);
  }
}

// 1. Check main README exists and has course overview
console.log('\n📘 检查课程主 README...');
const readmePath = path.join(ROOT, 'README.md');
check(fs.existsSync(readmePath), 'README.md 存在');
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, 'utf-8');
  check(readme.includes('30 课时') || readme.includes('30课时'), 'README 包含课时数');
  check(readme.includes('React Native'), 'README 包含课程名称');
  check(readme.includes('Stage 1') && readme.includes('Stage 5'), 'README 包含所有阶段');
  check(readme.includes('Expo'), 'README 包含技术栈信息');
}

// 2. Check each stage directory and lessons
STAGES.forEach((stage, i) => {
  console.log(`\n📘 检查 ${STAGE_LABELS[i]}...`);
  const stageDir = path.join(ROOT, stage);

  check(fs.existsSync(stageDir), `${stage} 目录存在`);

  const readmeFile = path.join(stageDir, 'README.md');
  check(fs.existsSync(readmeFile), `${stage}/README.md 存在`);

  const lessonCount = stage === 'stage4-ai-mobile-integration' ? 6 : 6;
  for (let j = 1; j <= 6; j++) {
    const lessonFiles = fs.readdirSync(stageDir).filter(f => f.startsWith(`${String(j).padStart(2, '0')}`));
    check(lessonFiles.length > 0, `课时 ${j} 文件存在`);
    if (lessonFiles.length > 0) {
      const content = fs.readFileSync(path.join(stageDir, lessonFiles[0]), 'utf-8');
      check(content.includes('场景引入'), `${lessonFiles[0]} 包含场景引入`);
      check(content.includes('学习目标'), `${lessonFiles[0]} 包含学习目标`);
      check(content.includes('小结'), `${lessonFiles[0]} 包含小结`);
      check(content.includes('练习'), `${lessonFiles[0]} 包含练习`);
      check(content.includes('参考答案'), `${lessonFiles[0]} 包含参考答案`);
      const lineCount = content.split('\n').length;
      check(lineCount >= 200, `${lessonFiles[0]} 行数 >= 200（实际: ${lineCount}）`);
    }
  }
});

// 3. Check final project files
console.log('\n📘 检查毕业项目...');
const projectFile = path.join(ROOT, 'final-project', '项目说明.md');
check(fs.existsSync(projectFile), '项目说明.md 存在');
if (fs.existsSync(projectFile)) {
  const content = fs.readFileSync(projectFile, 'utf-8');
  check(content.includes('AI'), '项目说明包含 AI 功能描述');
  check(content.includes('Expo'), '项目说明包含技术栈');
}

const checkScript = path.join(ROOT, 'final-project', 'scripts', 'check.cjs');
check(fs.existsSync(checkScript), 'scripts/check.cjs 存在');

const reportsDir = path.join(ROOT, 'final-project', 'reports');
check(fs.existsSync(reportsDir), 'reports/ 目录存在');
if (fs.existsSync(reportsDir)) {
  for (let i = 1; i <= 5; i++) {
    const reportFile = path.join(reportsDir, `stage${i}-report.md`);
    check(fs.existsSync(reportFile), `stage${i}-report.md 存在`);
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\n📊 验证结果：✅ ${passed} 通过  ❌ ${failed} 失败`);
if (failed > 0) {
  console.log('\n失败项目：');
  errors.forEach(e => console.log(`  - ${e}`));
  process.exit(1);
} else {
  console.log('\n🎉 所有检查通过！');
  process.exit(0);
}
