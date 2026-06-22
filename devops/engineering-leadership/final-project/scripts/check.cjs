#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORTS = path.join(__dirname, '..', 'reports');
const STAGES = [
  'stage1-management-transition',
  'stage2-team-building',
  'stage3-technical-strategy',
  'stage4-execution-delivery',
  'stage5-career-growth',
];

const STAGE_LESSONS = {
  'stage1-management-transition': [
    '01-从IC到Manager.md',
    '02-一对一会议.md',
    '03-任务分配.md',
    '04-技术决策.md',
    '05-向上管理.md',
    '06-阶段实战-新经理90天计划.md',
  ],
  'stage2-team-building': [
    '01-招聘与面试.md',
    '02-团队文化.md',
    '03-绩效管理.md',
    '04-人才培养.md',
    '05-团队扩展.md',
    '06-阶段实战-团队建设方案.md',
  ],
  'stage3-technical-strategy': [
    '01-技术愿景.md',
    '02-技术债务管理.md',
    '03-架构治理.md',
    '04-技术选型.md',
    '05-创新管理.md',
    '06-阶段实战-技术战略规划.md',
  ],
  'stage4-execution-delivery': [
    '01-敏捷实践.md',
    '02-项目管理.md',
    '03-发布管理.md',
    '04-质量保障.md',
    '05-跨团队协作.md',
    '06-阶段实战-大型项目交付.md',
  ],
  'stage5-career-growth': [
    '01-技术影响力.md',
    '02-高管沟通.md',
    '03-组织设计.md',
    '04-工程文化.md',
    '05-职业路径.md',
    '06-阶段实战-个人领导力发展计划.md',
  ],
};

const REPORT_FILES = [
  'report-1-90天计划.md',
  'report-2-团队建设方案.md',
  'report-3-技术战略规划.md',
  'report-4-大型项目交付方案.md',
  'report-5-个人领导力发展计划.md',
];

const REQUIRED_SECTIONS = ['场景引入', '学习目标', '常见误区', '工程建议', '小结', '练习', '参考答案'];

let errors = 0;
let warnings = 0;
let passed = 0;

function check(label, ok, msg) {
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}: ${msg}`);
    errors++;
  }
}

function warn(label, msg) {
  console.log(`  ⚠️  ${label}: ${msg}`);
  warnings++;
}

// Check course README
console.log('\n📋 检查课程 README.md');
const readmePath = path.join(ROOT, 'README.md');
check('README.md 存在', fs.existsSync(readmePath));
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, 'utf-8');
  check('README 包含课程名称', readme.includes('工程管理与技术领导力'));
  check('README 包含30课时', readme.includes('30'));
}

// Check stage READMEs and lessons
for (const stage of STAGES) {
  console.log(`\n📋 检查 ${stage}`);
  const stagePath = path.join(ROOT, stage);

  check('阶段目录存在', fs.existsSync(stagePath));

  const stageReadme = path.join(stagePath, 'README.md');
  check('阶段 README 存在', fs.existsSync(stageReadme));

  const lessons = STAGE_LESSONS[stage];
  for (const lesson of lessons) {
    const lessonPath = path.join(stagePath, lesson);
    const label = lesson.replace('.md', '');

    if (!fs.existsSync(lessonPath)) {
      check(`${label} 文件存在`, false, '文件不存在');
      continue;
    }

    check(`${label} 文件存在`, true);

    const content = fs.readFileSync(lessonPath, 'utf-8');
    const lines = content.split('\n').length;

    if (lines >= 200) {
      check(`${label} 行数 >= 200`, true);
    } else {
      check(`${label} 行数 >= 200`, false, `仅 ${lines} 行，需要至少 200 行`);
    }

    if (lines > 350) {
      warn(`${label}`, `${lines} 行，超过 350 行建议上限`);
    }

    for (const section of REQUIRED_SECTIONS) {
      check(`${label} 包含「## ${section}」`, content.includes(`## ${section}`));
    }
  }
}

// Check final project
console.log('\n📋 检查毕业项目');
const projDesc = path.join(ROOT, 'final-project', '项目说明.md');
check('项目说明.md 存在', fs.existsSync(projDesc));

const checkScript = path.join(ROOT, 'final-project', 'scripts', 'check.cjs');
check('check.cjs 存在', fs.existsSync(checkScript));

// Check reports
console.log('\n📋 检查报告模板');
if (!fs.existsSync(REPORTS)) {
  check('reports 目录存在', false, '目录不存在');
} else {
  check('reports 目录存在', true);
  for (const report of REPORT_FILES) {
    const rp = path.join(REPORTS, report);
    check(`${report} 存在`, fs.existsSync(rp));
  }
}

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`✅ 通过: ${passed}`);
console.log(`❌ 失败: ${errors}`);
console.log(`⚠️  警告: ${warnings}`);

if (errors > 0) {
  console.log('\n🔴 验证未通过，请修复上述问题后重新运行。');
  process.exit(1);
} else {
  console.log('\n🟢 全部验证通过！课程结构完整。');
  process.exit(0);
}
