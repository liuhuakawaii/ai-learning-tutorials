#!/usr/bin/env node

/**
 * 低代码平台毕业项目验证脚本
 * 用法：node scripts/check.cjs [--stage N]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STAGES = [1, 2, 3, 4, 5];

function fileExists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function dirHasFiles(dir, ext) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return false;
  const files = fs.readdirSync(full, { recursive: true });
  return files.some(f => f.endsWith(ext));
}

function checkStage1() {
  console.log('\n=== 阶段一：数据建模与 API 生成 ===');
  const checks = [
    { name: '数据模型定义文件', ok: fileExists('packages/server/src/models'), desc: '应包含数据模型定义' },
    { name: 'API 自动生成模块', ok: fileExists('packages/server/src/api'), desc: '应包含自动生成的 REST API' },
    { name: '数据库配置', ok: fileExists('packages/server/src/models/schema.ts') || fileExists('packages/server/prisma/schema.prisma'), desc: '应包含数据库 schema 定义' },
    { name: '后端 package.json', ok: fileExists('packages/server/package.json'), desc: '应包含后端依赖配置' },
    { name: '模型验证', ok: dirHasFiles('packages/server/src/models', '.ts'), desc: 'models 目录应包含 TypeScript 文件' },
  ];
  return checks;
}

function checkStage2() {
  console.log('\n=== 阶段二：页面搭建与工作流 ===');
  const checks = [
    { name: '页面设计器', ok: fileExists('packages/client/src/designer'), desc: '应包含可视化设计器' },
    { name: '组件库', ok: fileExists('packages/client/src/components'), desc: '应包含组件库' },
    { name: '工作流引擎', ok: fileExists('packages/server/src/workflow'), desc: '应包含工作流引擎' },
    { name: '前端 package.json', ok: fileExists('packages/client/package.json'), desc: '应包含前端依赖配置' },
    { name: '页面预览', ok: fileExists('packages/client/src/preview'), desc: '应包含页面预览模块' },
  ];
  return checks;
}

function checkStage3() {
  console.log('\n=== 阶段三：AI 集成 ===');
  const checks = [
    { name: 'AI 模块', ok: fileExists('packages/server/src/ai'), desc: '应包含 AI 能力模块' },
    { name: 'AI 建模', ok: fileExists('packages/server/src/ai/modeling.ts') || fileExists('packages/server/src/ai/modeling'), desc: '应包含 AI 辅助建模' },
    { name: 'AI 页面生成', ok: fileExists('packages/server/src/ai/pagegen.ts') || fileExists('packages/server/src/ai/pagegen'), desc: '应包含 AI 页面生成' },
    { name: 'AI 数据处理', ok: fileExists('packages/server/src/ai/data.ts') || fileExists('packages/server/src/ai/data'), desc: '应包含 AI 数据处理' },
    { name: 'AI 对话', ok: fileExists('packages/server/src/ai/chat.ts') || fileExists('packages/server/src/ai/chat'), desc: '应包含 AI 对话模块' },
  ];
  return checks;
}

function checkStage4() {
  console.log('\n=== 阶段四：组件体系 ===');
  const checks = [
    { name: '组件包', ok: fileExists('packages/components'), desc: '应包含自定义组件包' },
    { name: '图表组件', ok: fileExists('packages/components/charts'), desc: '应包含图表组件' },
    { name: '编辑器组件', ok: fileExists('packages/components/editors'), desc: '应包含编辑器组件' },
    { name: '集成组件', ok: fileExists('packages/components/integrations'), desc: '应包含第三方集成组件' },
    { name: '组件规范', ok: dirHasFiles('packages/components', '.ts') || dirHasFiles('packages/components', '.tsx'), desc: '组件目录应包含代码文件' },
  ];
  return checks;
}

function checkStage5() {
  console.log('\n=== 阶段五：企业级部署 ===');
  const checks = [
    { name: 'Docker 配置', ok: fileExists('docker/docker-compose.yml'), desc: '应包含 docker-compose.yml' },
    { name: 'Server Dockerfile', ok: fileExists('docker/Dockerfile.server'), desc: '应包含后端 Dockerfile' },
    { name: 'Client Dockerfile', ok: fileExists('docker/Dockerfile.client'), desc: '应包含前端 Dockerfile' },
    { name: '认证模块', ok: fileExists('packages/server/src/auth'), desc: '应包含认证模块' },
    { name: '审计日志', ok: fileExists('packages/server/src/audit.ts') || fileExists('packages/server/src/audit'), desc: '应包含审计日志模块' },
  ];
  return checks;
}

function runChecks(stageNum) {
  const stageChecks = {
    1: checkStage1,
    2: checkStage2,
    3: checkStage3,
    4: checkStage4,
    5: checkStage5,
  };

  const checkFn = stageChecks[stageNum];
  if (!checkFn) {
    console.error(`未知阶段: ${stageNum}`);
    return false;
  }

  const checks = checkFn();
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    if (check.ok) {
      console.log(`  ✅ ${check.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${check.name} - ${check.desc}`);
      failed++;
    }
  }

  console.log(`\n  通过: ${passed}/${checks.length}`);
  return failed === 0;
}

function main() {
  const args = process.argv.slice(2);
  const stageArg = args.indexOf('--stage');
  let stages = STAGES;

  if (stageArg !== -1 && args[stageArg + 1]) {
    const s = parseInt(args[stageArg + 1], 10);
    if (STAGES.includes(s)) {
      stages = [s];
    } else {
      console.error(`无效的阶段号: ${s}，可选: ${STAGES.join(', ')}`);
      process.exit(1);
    }
  }

  console.log('低代码平台毕业项目验证');
  console.log('='.repeat(40));

  let allPassed = true;
  for (const stage of stages) {
    if (!runChecks(stage)) {
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(40));
  if (allPassed) {
    console.log('🎉 所有检查通过！');
  } else {
    console.log('⚠️  部分检查未通过，请根据提示补充相关文件。');
    process.exit(1);
  }
}

main();
