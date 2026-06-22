#!/usr/bin/env node

/**
 * 搜索引擎工程 - 毕业项目验证脚本
 * 验证项目结构、代码完整性和基本功能
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJECT_DIR = path.join(ROOT, 'search-engine');

let passed = 0;
let failed = 0;
let warnings = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function warn(condition, message) {
  if (!condition) {
    console.log(`  ⚠️  ${message}`);
    warnings++;
  }
}

function fileExists(filePath) {
  return fs.existsSync(path.join(PROJECT_DIR, filePath));
}

function fileContains(filePath, text) {
  if (!fileExists(filePath)) return false;
  const content = fs.readFileSync(path.join(PROJECT_DIR, filePath), 'utf-8');
  return content.includes(text);
}

function dirExists(dirPath) {
  return fs.existsSync(path.join(PROJECT_DIR, dirPath)) &&
    fs.statSync(path.join(PROJECT_DIR, dirPath)).isDirectory();
}

console.log('\n🔍 搜索引擎工程 - 毕业项目验证\n');
console.log('='.repeat(50));

// ==================== 阶段一：索引基础 ====================
console.log('\n📋 阶段一：索引基础');
console.log('-'.repeat(40));

check(dirExists('core'), 'core/ 目录存在');
check(fileExists('core/tokenizer.py'), '分词器模块存在');
check(fileExists('core/indexer.py'), '索引器模块存在');
check(fileContains('core/tokenizer.py', 'class', ), '分词器包含类定义');
check(fileContains('core/indexer.py', 'class'), '索引器包含类定义');

const tokenizerContent = fileExists('core/tokenizer.py') ?
  fs.readFileSync(path.join(PROJECT_DIR, 'core/tokenizer.py'), 'utf-8') : '';
check(tokenizerContent.includes('def tokenize') || tokenizerContent.includes('def cut'),
  '分词器包含分词方法');

const indexerContent = fileExists('core/indexer.py') ?
  fs.readFileSync(path.join(PROJECT_DIR, 'core/indexer.py'), 'utf-8') : '';
check(indexerContent.includes('inverted') || indexerContent.includes('posting') ||
  indexerContent.includes('index'), '索引器包含倒排索引相关实现');

// ==================== 阶段二：检索模型 ====================
console.log('\n📋 阶段二：检索模型');
console.log('-'.repeat(40));

check(dirExists('models'), 'models/ 目录存在');
check(fileExists('models/bm25.py'), 'BM25 模块存在');
check(fileExists('models/vector_search.py'), '向量检索模块存在');
check(fileContains('models/bm25.py', 'k1'), 'BM25 包含 k1 参数');
check(fileContains('models/bm25.py', 'b'), 'BM25 包含 b 参数');

const retrieverContent = fileExists('core/retriever.py') ?
  fs.readFileSync(path.join(PROJECT_DIR, 'core/retriever.py'), 'utf-8') : '';
warn(retrieverContent.includes('hybrid') || retrieverContent.includes('mix'),
  '检索器支持混合检索（建议）');

// ==================== 阶段三：排序与学习 ====================
console.log('\n📋 阶段三：排序与学习');
console.log('-'.repeat(40));

check(fileExists('core/ranker.py'), '排序器模块存在');
check(fileExists('models/ltr.py'), 'LTR 模块存在');

const rankerContent = fileExists('core/ranker.py') ?
  fs.readFileSync(path.join(PROJECT_DIR, 'core/ranker.py'), 'utf-8') : '';
check(rankerContent.includes('class') || rankerContent.includes('def'),
  '排序器包含类或函数定义');

warn(fileExists('models/reranker.py'), '重排序模块存在（建议）');

// ==================== 阶段四：分布式搜索 ====================
console.log('\n📋 阶段四：分布式搜索');
console.log('-'.repeat(40));

check(dirExists('services'), 'services/ 目录存在');
check(fileExists('services/search_service.py'), '搜索服务模块存在');
check(fileExists('services/index_service.py'), '索引服务模块存在');

const searchService = fileExists('services/search_service.py') ?
  fs.readFileSync(path.join(PROJECT_DIR, 'services/search_service.py'), 'utf-8') : '';
warn(searchService.includes('elasticsearch') || searchService.includes('es_client'),
  '搜索服务使用 Elasticsearch（建议）');

// ==================== 阶段五：真实搜索场景 ====================
console.log('\n📋 阶段五：真实搜索场景');
console.log('-'.repeat(40));

check(dirExists('api'), 'api/ 目录存在');
check(fileExists('api/main.py'), 'FastAPI 入口存在');
check(fileExists('api/routes.py'), '路由定义存在');
check(fileExists('services/suggest_service.py'), '建议服务模块存在');

const mainContent = fileExists('api/main.py') ?
  fs.readFileSync(path.join(PROJECT_DIR, 'api/main.py'), 'utf-8') : '';
check(mainContent.includes('FastAPI') || mainContent.includes('fastapi'),
  '入口文件使用 FastAPI');

// ==================== 配置与测试 ====================
console.log('\n📋 配置与测试');
console.log('-'.repeat(40));

check(dirExists('config'), 'config/ 目录存在');
check(fileExists('config/settings.py'), '配置文件存在');
check(dirExists('tests'), 'tests/ 目录存在');
check(fileExists('requirements.txt'), 'requirements.txt 存在');

const testFiles = ['test_tokenizer.py', 'test_indexer.py', 'test_retriever.py', 'test_ranker.py'];
testFiles.forEach(f => {
  check(fileExists(`tests/${f}`), `测试文件 ${f} 存在`);
});

// ==================== 阶段报告 ====================
console.log('\n📋 阶段报告');
console.log('-'.repeat(40));

const reportDir = path.join(ROOT, 'reports');
for (let i = 1; i <= 5; i++) {
  const reportFile = path.join(reportDir, `stage${i}-report.md`);
  const exists = fs.existsSync(reportFile);
  if (exists) {
    const content = fs.readFileSync(reportFile, 'utf-8');
    const hasContent = content.length > 100;
    check(hasContent, `阶段${i}报告已填写`);
  } else {
    check(false, `阶段${i}报告文件存在`);
  }
}

// ==================== 汇总 ====================
console.log('\n' + '='.repeat(50));
console.log(`\n📊 验证结果汇总`);
console.log(`  ✅ 通过: ${passed}`);
console.log(`  ❌ 失败: ${failed}`);
console.log(`  ⚠️  警告: ${warnings}`);
console.log(`  📁 项目目录: ${PROJECT_DIR}`);

if (failed > 0) {
  console.log('\n💡 请修复上述失败项后重新验证。');
  process.exit(1);
} else {
  console.log('\n🎉 恭喜！所有验证项通过！');
  process.exit(0);
}
