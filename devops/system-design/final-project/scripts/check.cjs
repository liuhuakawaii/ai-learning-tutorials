#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PHASES = ['phase1-requirements', 'phase2-database', 'phase3-distributed', 'phase4-microservice', 'phase5-optimization'];
const REPORTS = ['stage1-report.md', 'stage2-report.md', 'stage3-report.md', 'stage4-report.md', 'stage5-report.md'];
const MIN_LINES = 200;
const REQUIRED_SECTIONS = ['场景引入', '学习目标', '常见误区', '工程建议', '小结', '练习', '参考答案'];
const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠ WARN\x1b[0m';

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
let warnedChecks = 0;

function log(status, msg) {
  console.log(`  ${status} ${msg}`);
  totalChecks++;
  if (status === PASS) passedChecks++;
  else if (status === FAIL) failedChecks++;
  else if (status === WARN) warnedChecks++;
}

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function dirExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function hasSection(filePath, sectionName) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const regex = new RegExp(`^#+\\s*.*${sectionName}`, 'm');
    return regex.test(content);
  } catch {
    return false;
  }
}

function checkDirectoryStructure() {
  console.log('\n\x1b[36m=== 目录结构检查 ===\x1b[0m');

  PHASES.forEach(phase => {
    const phasePath = path.join(ROOT, phase);
    if (dirExists(phasePath)) {
      log(PASS, `阶段目录存在: ${phase}/`);
    } else {
      log(FAIL, `阶段目录缺失: ${phase}/`);
    }
  });

  const reportsPath = path.join(ROOT, 'reports');
  if (dirExists(reportsPath)) {
    log(PASS, '报告目录存在: reports/');
  } else {
    log(FAIL, '报告目录缺失: reports/');
  }

  const scriptsPath = path.join(ROOT, 'scripts');
  if (dirExists(scriptsPath)) {
    log(PASS, '脚本目录存在: scripts/');
  } else {
    log(FAIL, '脚本目录缺失: scripts/');
  }
}

function checkProjectDoc() {
  console.log('\n\x1b[36m=== 项目文档检查 ===\x1b[0m');
  const docPath = path.join(ROOT, '项目说明.md');
  if (fileExists(docPath)) {
    const lines = countLines(docPath);
    log(PASS, `项目说明.md 存在 (${lines} 行)`);
    if (lines < MIN_LINES) {
      log(WARN, `项目说明.md 行数不足 ${MIN_LINES} 行`);
    }
  } else {
    log(FAIL, '项目说明.md 缺失');
  }
}

function checkReportTemplates() {
  console.log('\n\x1b[36m=== 报告模板检查 ===\x1b[0m');
  REPORTS.forEach(report => {
    const reportPath = path.join(ROOT, 'reports', report);
    if (fileExists(reportPath)) {
      const lines = countLines(reportPath);
      log(PASS, `${report} 存在 (${lines} 行)`);
      if (lines < 50) {
        log(WARN, `${report} 内容过少，可能未填写`);
      }
    } else {
      log(FAIL, `${report} 缺失`);
    }
  });
}

function checkLessonFiles() {
  console.log('\n\x1b[36m=== 课程文件检查 ===\x1b[0m');
  const courseDir = path.resolve(ROOT, '..');
  if (!dirExists(courseDir)) {
    log(WARN, '课程根目录不存在，跳过课程文件检查');
    return;
  }

  const mdFiles = [];
  function findMdFiles(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'final-project') {
          findMdFiles(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md') && /^\d{2}-/.test(entry.name)) {
          mdFiles.push(fullPath);
        }
      });
    } catch {}
  }
  findMdFiles(courseDir);

  if (mdFiles.length === 0) {
    log(WARN, '未找到课程文件（xx-*.md），跳过课程内容检查');
    return;
  }

  log(PASS, `找到 ${mdFiles.length} 个课程文件`);

  let checkedCount = 0;
  mdFiles.forEach(filePath => {
    const relPath = path.relative(ROOT, filePath);
    let allSectionsFound = true;
    REQUIRED_SECTIONS.forEach(section => {
      if (!hasSection(filePath, section)) {
        allSectionsFound = false;
      }
    });

    if (allSectionsFound) {
      log(PASS, `${relPath} 包含所有必要章节`);
    } else {
      const missing = REQUIRED_SECTIONS.filter(s => !hasSection(filePath, s));
      log(FAIL, `${relPath} 缺少章节: ${missing.join(', ')}`);
    }

    const lines = countLines(filePath);
    if (lines < MIN_LINES) {
      log(WARN, `${relPath} 仅 ${lines} 行（要求 >= ${MIN_LINES}）`);
    }

    checkedCount++;
    if (checkedCount >= 10) {
      log(WARN, `已检查 10 个文件，剩余 ${mdFiles.length - checkedCount} 个未检查`);
      return;
    }
  });
}

function checkValidationScripts() {
  console.log('\n\x1b[36m=== 验证脚本检查 ===\x1b[0m');
  PHASES.forEach(phase => {
    const checkPath = path.join(ROOT, phase, 'scripts', 'check.cjs');
    const checkJsPath = path.join(ROOT, phase, 'scripts', 'check.js');
    const checkPyPath = path.join(ROOT, phase, 'scripts', 'check.py');

    if (fileExists(checkPath) || fileExists(checkJsPath) || fileExists(checkPyPath)) {
      log(PASS, `${phase}/scripts/ 包含验证脚本`);
    } else {
      log(WARN, `${phase}/scripts/ 未找到验证脚本（可选）`);
    }
  });
}

function printSummary() {
  console.log('\n\x1b[36m=== 检查结果汇总 ===\x1b[0m');
  console.log(`  总检查项: ${totalChecks}`);
  console.log(`  ${PASS}: ${passedChecks}`);
  console.log(`  ${FAIL}: ${failedChecks}`);
  console.log(`  ${WARN}: ${warnedChecks}`);

  console.log('\n' + '='.repeat(40));
  if (failedChecks === 0) {
    console.log('\x1b[32m🎉 所有必要检查项通过！\x1b[0m');
  } else {
    console.log(`\x1b[31m❌ 存在 ${failedChecks} 个失败项，请修复后重新检查。\x1b[0m`);
  }
  console.log('');
  process.exit(failedChecks > 0 ? 1 : 0);
}

console.log('\x1b[1m\x1b[36m========================================\x1b[0m');
console.log('\x1b[1m\x1b[36m  系统设计课程 - 毕业项目检查工具  \x1b[0m');
console.log('\x1b[1m\x1b[36m========================================\x1b[0m');
console.log(`  项目路径: ${ROOT}`);

checkDirectoryStructure();
checkProjectDoc();
checkReportTemplates();
checkLessonFiles();
checkValidationScripts();
printSummary();
