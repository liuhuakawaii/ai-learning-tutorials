# 第八课：阶段实战——Vue 2 到 Vue 3 的完整迁移

## 场景引入

经过前几课的学习，你已经掌握了 CSS 迁移、模块系统迁移和 TypeScript 渐进式迁移的核心方法。现在我们把这些知识整合起来，完成一个真实的迁移项目：将一个 Vue 2 + JavaScript + Less + CommonJS 的项目，迁移到 Vue 3 + TypeScript + Tailwind CSS + ESM。

```
现状：Vue 2.6 + Options API + JavaScript + Less + CommonJS + Webpack 4 + Element UI + Vuex 3
目标：Vue 3.4 + <script setup> + TypeScript + Tailwind CSS + ESM + Vite 5 + Element Plus + Pinia
```

## 学习目标

1. 制定 Vue 2 到 Vue 3 的完整迁移计划
2. 构建自动化迁移工具链，处理组件、样式、模块的批量转换
3. 将 Options API 组件转换为 Composition API + `<script setup>`
4. 处理 Vuex 到 Pinia 的状态管理迁移

## 核心概念

### 一、迁移工具链架构

```
┌─────────────────────────────────────────────────────────────┐
│                 Vue 2 → Vue 3 迁移工具链                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  vue2-to-vue3-migrator.mjs（主控脚本）                       │
│       │                                                     │
│       ├── 1. 项目分析器 → 扫描文件结构，生成迁移报告          │
│       ├── 2. 组件迁移器 → Options API → Composition API      │
│       ├── 3. 样式迁移器 → Less/Sass → Tailwind CSS           │
│       ├── 4. 模块迁移器 → CommonJS → ESM                     │
│       ├── 5. TypeScript 注入器 → Props/Emits 类型定义         │
│       └── 6. 依赖升级器 → Vuex → Pinia，Element UI → Plus    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 二、项目分析器

迁移的第一步是了解项目现状：

```js
// tools/project-analyzer.mjs
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walkDirectory(dir, filter, results = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry)) {
      walkDirectory(fullPath, filter, results);
    } else if (stat.isFile() && filter(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

function analyzeVueComponent(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return {
    file: filePath,
    usesOptionsAPI: /export\s+default\s*\{/.test(content),
    usesScriptSetup: /<script\s+setup/.test(content),
    hasLessStyles: /<style\s+lang=["']less["']/.test(content),
    usesVuex: /this\.\$store|mapState|mapGetters/.test(content),
    usesMixins: /mixins\s*:/.test(content),
    usesFilters: /\{\{.*\|\s*\w+/.test(content),
    lineCount: content.split('\n').length,
  };
}

function analyzeProject(projectPath) {
  const vueFiles = walkDirectory(projectPath, f => f.endsWith('.vue'));
  const analyses = vueFiles.map(f => analyzeVueComponent(f));
  return {
    summary: { vueFiles: vueFiles.length },
    components: {
      optionsAPI: analyses.filter(c => c.usesOptionsAPI).length,
      scriptSetup: analyses.filter(c => c.usesScriptSetup).length,
    },
    complexity: {
      usesVuex: analyses.filter(c => c.usesVuex).length,
      usesMixins: analyses.filter(c => c.usesMixins).length,
      usesFilters: analyses.filter(c => c.usesFilters).length,
    },
  };
}

const projectPath = process.argv[2] || './src';
const report = analyzeProject(projectPath);
console.log('\n=== Vue 2 → Vue 3 迁移分析报告 ===\n');
console.log(`Vue 组件：${report.summary.vueFiles} 个`);
console.log(`Options API：${report.components.optionsAPI} 个`);
console.log(`使用 Vuex：${report.complexity.usesVuex} 个组件`);
console.log(`使用 Mixins：${report.complexity.usesMixins} 个组件`);
```

### 三、组件迁移器：Options API → Composition API

将 Vue 2 的 Options API 组件转换为 Vue 3 的 `<script setup>` 语法：

```js
// tools/component-migrator.mjs
import { readFileSync, writeFileSync } from 'fs';

const LIFECYCLE_MAP = {
  beforeCreate: null, created: null, beforeMount: 'onBeforeMount', mounted: 'onMounted',
  beforeUpdate: 'onBeforeUpdate', updated: 'onUpdated',
  beforeDestroy: 'onBeforeUnmount', destroyed: 'onUnmounted',
};
const VUE_TO_TS = { 'String': 'string', 'Number': 'number', 'Boolean': 'boolean',
  'Array': 'unknown[]', 'Object': 'Record<string, unknown>' };

function parseComponentOptions(script) {
  const result = { props: null, data: [], computed: [], methods: [], lifecycle: [], imports: [] };
  result.imports = script.match(/^import\s+.+$/gm) || [];
  const pm = script.match(/props\s*:\s*({[\s\S]*?})\s*[,}]/);
  if (pm) result.props = pm[1];
  const dm = script.match(/data\s*\(\s*\)\s*\{\s*return\s*({[\s\S]*?})\s*\}/);
  if (dm) result.data.push(dm[1]);
  const cm = script.match(/computed\s*:\s*({[\s\S]*?})\s*[,}]/);
  if (cm) { let m; const r = /(\w+)\s*\(\s*\)\s*\{([\s\S]*?)\}/g; while ((m = r.exec(cm[1])) !== null) result.computed.push({ name: m[1], body: m[2].trim() }); }
  const mm = script.match(/methods\s*:\s*({[\s\S]*?})\s*[,}]/);
  if (mm) { let m; const r = /(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g; while ((m = r.exec(mm[1])) !== null) result.methods.push({ name: m[1], params: m[2], body: m[3] }); }
  for (const hook of Object.keys(LIFECYCLE_MAP)) {
    const r = new RegExp(`${hook}\\s*\\(\\s*\\)\\s*\\{([\\s\\S]*?)\\}`, 'g');
    const m = r.exec(script);
    if (m) result.lifecycle.push({ name: hook, body: m[1].trim() });
  }
  return result;
}

function generateCompositionScript(parsed) {
  const lines = ['<script setup lang="ts">', "import { ref, computed, watch, onMounted, onUnmounted } from 'vue';"];
  if (parsed.imports.length > 0) lines.push(...parsed.imports);
  lines.push('');
  if (parsed.props) {
    const fields = []; let m; const r = /(\w+)\s*:\s*\{?\s*type\s*:\s*(\w+)/g;
    while ((m = r.exec(parsed.props)) !== null) fields.push(`  ${m[1]}?: ${VUE_TO_TS[m[2]] || 'unknown'}`);
    lines.push(`const props = defineProps<{\n${fields.join('\n')}\n}>();\n`);
  }
  if (parsed.data.length > 0) { let m; const r = /(\w+)\s*:\s*(.+?)$/gm;
    while ((m = r.exec(parsed.data[0])) !== null) lines.push(`const ${m[1]} = ref(${m[2].trim().replace(/,$/, '')});`);
    lines.push(''); }
  for (const c of parsed.computed) { const b = c.body.replace(/this\.\w+/g, m => m.replace('this.', '') + '.value'); lines.push(`const ${c.name} = computed(() => { ${b} });\n`); }
  for (const m of parsed.methods) { const b = m.body.replace(/this\.\$/g, '').replace(/this\.(\w+)/g, '$1'); lines.push(`function ${m.name}(${m.params}) { ${b} }\n`); }
  for (const h of parsed.lifecycle) { if (LIFECYCLE_MAP[h.name]) lines.push(`${LIFECYCLE_MAP[h.name]}(() => { ${h.body} });\n`); }
  lines.push('</script>');
  return lines.join('\n');
}

function migrateComponent(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return;
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  let template = templateMatch ? templateMatch[1] : '';
  template = template.replace(/v-slot:(\w+)="(\w+)"/g, '#$1="$2"')
    .replace(/\{\{\s*(\w+)\s*\|\s*(\w+)\s*\}\}/g, '{{ $2($1) }}')
    .replace(/\s*v-on="\$listeners"/g, '').replace(/\.native/g, '');
  const parsed = parseComponentOptions(scriptMatch[1]);
  const newContent = ['<template>', template, '</template>', '', generateCompositionScript(parsed), '', styleMatch ? styleMatch[0] : ''].join('\n');
  writeFileSync(filePath, newContent);
  console.log(`已迁移：${filePath}`);
}

export { migrateComponent };
```

### 四、Vuex 到 Pinia 的迁移

```js
// tools/vuex-to-pinia-migrator.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function extractMethods(objStr) {
  const methods = [];
  const regex = /(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = regex.exec(objStr)) !== null) methods.push({ name: m[1], params: m[2], body: m[3].trim() });
  return methods;
}

function generatePiniaStore(content, moduleName) {
  const stateMatch = content.match(/state\s*[:=]\s*(\(\)\s*=>\s*)?({[\s\S]*?})\s*[,}]/);
  const gettersMatch = content.match(/getters\s*:\s*({[\s\S]*?})\s*(?=,\s*(mutations|actions)|})/);
  const mutationsMatch = content.match(/mutations\s*:\s*({[\s\S]*?})\s*(?=,\s*actions)/);
  const actionsMatch = content.match(/actions\s*:\s*({[\s\S]*?})\s*$/);

  const lines = ["import { defineStore } from 'pinia';", '',
    `export const use${capitalize(moduleName)}Store = defineStore('${moduleName}', {`];

  lines.push('  state: () => ({');
  if (stateMatch) {
    const regex = /(\w+)\s*:\s*([^,}]+)/g;
    let m;
    while ((m = regex.exec(stateMatch[2])) !== null) lines.push(`    ${m[1]}: ${m[2].trim()},`);
  }
  lines.push('  }),');

  lines.push('  getters: {');
  if (gettersMatch) {
    for (const g of extractMethods(gettersMatch[1])) {
      lines.push(`    ${g.name}() { ${g.body.replace(/state\.(\w+)/g, 'this.$1')} },`);
    }
  }
  lines.push('  },');

  lines.push('  actions: {');
  if (mutationsMatch) {
    for (const m of extractMethods(mutationsMatch[1])) {
      lines.push(`    ${m.name}(${m.params}) { ${m.body.replace(/state\.(\w+)/g, 'this.$1')} },`);
    }
  }
  if (actionsMatch) {
    for (const a of extractMethods(actionsMatch[1])) {
      const body = a.body.replace(/state\.(\w+)/g, 'this.$1').replace(/commit\s*\([^)]+\)/g, '/* 直接调用 mutation */');
      lines.push(`    async ${a.name}(${a.params}) { ${body} },`);
    }
  }
  lines.push('  },', '});');
  return lines.join('\n');
}

function migrateVuexToPinia(storeFilePath, outputDir) {
  const content = readFileSync(storeFilePath, 'utf-8');
  const moduleName = basename(storeFilePath, '.js').replace('-store', '').replace('store', 'index');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `${moduleName}-store.ts`);
  writeFileSync(outputPath, generatePiniaStore(content, moduleName));
  console.log(`已迁移：${storeFilePath} → ${outputPath}`);
}

export { migrateVuexToPinia };
```

### 五、样式迁移集成

```js
// tools/style-migrator.mjs
import { readFileSync, writeFileSync } from 'fs';

const CSS_TO_TAILWIND = {
  'display:\\s*flex': 'flex', 'display:\\s*grid': 'grid', 'display:\\s*none': 'hidden',
  'justify-content:\\s*center': 'justify-center', 'justify-content:\\s*space-between': 'justify-between',
  'align-items:\\s*center': 'items-center', 'text-align:\\s*center': 'text-center',
  'font-weight:\\s*(600|700|bold)': 'font-bold', 'overflow:\\s*hidden': 'overflow-hidden',
  'position:\\s*relative': 'relative', 'position:\\s*absolute': 'absolute',
  'width:\\s*100%': 'w-full', 'height:\\s*100%': 'h-full', 'cursor:\\s*pointer': 'cursor-pointer',
};

function migrateVueStyles(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const styleMatch = content.match(/<style([^>]*)>([\s\S]*?)<\/style>/);
  if (!styleMatch || styleMatch[1].includes('tailwind')) return content;

  let styleContent = styleMatch[2].replace(/::v-deep\s+/g, ':deep(');
  const candidates = [];
  const ruleRegex = /\.(\w[\w-]*)\s*\{([^}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(styleContent)) !== null) {
    const classes = [];
    for (const [pattern, tailwind] of Object.entries(CSS_TO_TAILWIND)) {
      if (new RegExp(pattern, 'i').test(match[2])) classes.push(tailwind);
    }
    if (classes.length > 0) candidates.push({ original: match[1], tailwind: classes.join(' ') });
  }

  for (const c of candidates) {
    styleContent = styleContent.replace(new RegExp(`\\.${c.original}\\s*\\{[^}]+\\}`, 'g'), '');
  }

  let newContent = content.replace(styleMatch[0],
    styleContent.trim() ? `<style scoped>\n${styleContent}\n</style>` : '');
  for (const c of candidates) {
    newContent = newContent.replace(
      new RegExp(`class="([^"]*?)\\b${c.original}\\b([^"]*?)"`, 'g'), `class="$1${c.tailwind}$2"`);
  }
  return newContent;
}

export { migrateVueStyles };
```

### 六、主控迁移脚本

```js
// tools/vue2-to-vue3-migrator.mjs
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { migrateComponent } from './component-migrator.mjs';
import { migrateVueStyles } from './style-migrator.mjs';
import { migrateVuexToPinia } from './vuex-to-pinia-migrator.mjs';

class VueMigrator {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.srcPath = join(projectPath, 'src');
    this.backupPath = join(projectPath, '.migration-backup');
    this.report = { errors: [], warnings: [] };
  }

  walkFiles(filter) {
    const results = [];
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory() && !['node_modules', '.git', 'dist', '.migration-backup'].includes(entry)) walk(fullPath);
        else if (stat.isFile() && filter(entry)) results.push(fullPath);
      }
    };
    walk(this.projectPath);
    return results;
  }

  async run() {
    const steps = [
      ['项目分析', () => { console.log(`Vue 组件：${this.walkFiles(f => f.endsWith('.vue')).length} 个`); }],
      ['依赖升级', () => this.upgradeDependencies()],
      ['模块迁移', () => this.migrateModules()],
      ['组件迁移', () => this.migrateComponents()],
      ['样式迁移', () => this.migrateStyles()],
      ['Store 迁移', () => {
        for (const f of this.walkFiles(f => f.includes('store') && f.endsWith('.js'))) {
          try { migrateVuexToPinia(f, join(this.srcPath, 'stores')); }
          catch (e) { this.report.warnings.push(`Store 迁移失败：${f}`); }
        }
      }],
      ['TypeScript 配置', () => this.setupTypeScript()],
      ['验证', () => this.verify()],
    ];
    console.log('=== Vue 2 → Vue 3 迁移工具 ===\n');
    for (const [name, fn] of steps) {
      console.log(`\n--- ${name} ---`);
      try { await fn(); } catch (e) { this.report.errors.push(`${name}: ${e.message}`); }
    }
    console.log(`\n=== 完成。错误：${this.report.errors.length}，警告：${this.report.warnings.length} ===`);
  }

  async upgradeDependencies() {
    const pkgPath = join(this.projectPath, 'package.json');
    if (!existsSync(pkgPath)) throw new Error('未找到 package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    for (const dep of ['vuex', '@vue/cli-service', 'vue-template-compiler', 'element-ui']) {
      delete pkg.dependencies?.[dep]; delete pkg.devDependencies?.[dep];
    }
    Object.assign(pkg.dependencies || (pkg.dependencies = {}), {
      'vue': '^3.4.0', 'vue-router': '^4.3.0', 'pinia': '^2.1.0', 'element-plus': '^2.7.0',
    });
    Object.assign(pkg.devDependencies || (pkg.devDependencies = {}), {
      'vite': '^5.4.0', '@vitejs/plugin-vue': '^5.0.0', 'typescript': '^5.5.0',
      'vue-tsc': '^2.0.0', 'tailwindcss': '^3.4.0', 'postcss': '^8.4.0', 'autoprefixer': '^10.4.0',
    });
    pkg.type = 'module';
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('package.json 已更新');
  }

  async migrateModules() {
    const jsFiles = this.walkFiles(f => f.endsWith('.js') && !f.includes('node_modules'));
    let count = 0;
    for (const filePath of jsFiles) {
      let content = readFileSync(filePath, 'utf-8');
      const original = content;
      content = content.replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, (_, n, p) => `import ${n} from '${p}';`);
      content = content.replace(/const\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g, (_, n, p) => `import { ${n.trim()} } from '${p}';`);
      content = content.replace(/module\.exports\s*=\s*\{([^}]+)\};?/g, (_, n) => n.split(',').map(x => `export { ${x.trim()} };`).join('\n'));
      if (content !== original) { writeFileSync(filePath.replace(/\.js$/, '.mjs'), content); count++; }
    }
    console.log(`模块迁移：${count} 个文件`);
  }

  async migrateComponents() {
    const vueFiles = this.walkFiles(f => f.endsWith('.vue'));
    let count = 0;
    for (const filePath of vueFiles) {
      try {
        const backupPath = join(this.backupPath, relative(this.projectPath, filePath));
        mkdirSync(dirname(backupPath), { recursive: true });
        writeFileSync(backupPath, readFileSync(filePath, 'utf-8'));
        migrateComponent(filePath); count++;
      } catch (e) { this.report.warnings.push(`组件迁移失败：${filePath}`); }
    }
    console.log(`组件迁移：${count}/${vueFiles.length} 个`);
  }

  async migrateStyles() {
    let count = 0;
    for (const filePath of this.walkFiles(f => f.endsWith('.vue'))) {
      const content = readFileSync(filePath, 'utf-8');
      const newContent = migrateVueStyles(filePath);
      if (newContent !== content) { writeFileSync(filePath, newContent); count++; }
    }
    console.log(`样式迁移：${count} 个文件`);
  }

  async setupTypeScript() {
    writeFileSync(join(this.projectPath, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
        strict: false, allowJs: true, checkJs: false, jsx: 'preserve',
        resolveJsonModule: true, isolatedModules: true, esModuleInterop: true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'], skipLibCheck: true, noEmit: true,
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue', 'src/**/*.mjs'],
      exclude: ['node_modules', 'dist'],
    }, null, 2));
    writeFileSync(join(this.projectPath, 'vite.config.ts'), `import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\nimport { resolve } from 'path';\nexport default defineConfig({ plugins: [vue()], resolve: { alias: { '@': resolve(__dirname, 'src') } } });\n`);
    writeFileSync(join(this.projectPath, 'tailwind.config.js'), `/** @type {import('tailwindcss').Config} */\nexport default { content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] };\n`);
    writeFileSync(join(this.projectPath, 'postcss.config.js'), `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`);
    const typesDir = join(this.srcPath, 'types');
    if (!existsSync(typesDir)) mkdirSync(typesDir, { recursive: true });
    writeFileSync(join(typesDir, 'env.d.ts'), `/// <reference types="vite/client" />\ndeclare module '*.vue' { import type { DefineComponent } from 'vue'; const component: DefineComponent<object, object, unknown>; export default component; }\n`);
    console.log('TypeScript 配置已生成');
  }

  async verify() {
    for (const file of ['package.json', 'tsconfig.json', 'vite.config.ts', 'tailwind.config.js']) {
      console.log(`${existsSync(join(this.projectPath, file)) ? '✓' : '✗'} ${file}`);
    }
    for (const filePath of this.walkFiles(f => f.endsWith('.vue'))) {
      const content = readFileSync(filePath, 'utf-8');
      if (/this\.\$emit/.test(content)) this.report.warnings.push(`${filePath}: this.$emit 应改为 defineEmits`);
      if (/beforeDestroy/.test(content)) this.report.warnings.push(`${filePath}: beforeDestroy 应改为 onBeforeUnmount`);
    }
    console.log(`检查完成。警告：${this.report.warnings.length} 个`);
  }
}

const projectPath = process.argv[2] || '.';
new VueMigrator(projectPath).run().catch(console.error);
```

### 七、使用方式

```bash
# 运行迁移工具
node tools/vue2-to-vue3-migrator.mjs ./my-vue2-project

# 安装新依赖并验证
cd my-vue2-project
npm install
npx vue-tsc --noEmit
npx vite
```

## 常见误区

**误区一：期望工具能处理所有情况**

自动化迁移工具能处理 80% 的常规情况，但 Mixins 的处理、复杂的 Vuex 模块嵌套、第三方组件库的 API 变化等都需要开发者手动调整。

**误区二：迁移后不验证功能**

语法正确不等于功能正确。迁移完成后必须运行完整的功能测试，重点检查表单提交、列表分页、权限控制等核心流程。

**误区三：一次性迁移所有文件**

即使有自动化工具，也建议按模块逐步迁移：先迁移工具函数和基础组件，验证通过后再迁移业务页面。

## 小结与练习

### 小结

1. 项目分析器扫描项目现状，为迁移决策提供数据支撑
2. 组件迁移器将 Options API 转换为 `<script setup>`
3. 样式迁移器处理 Less/Sass 到 Tailwind 的转换
4. 模块迁移器将 CommonJS 转换为 ESM
5. Vuex 到 Pinia 的迁移需要处理 state、getters、mutations、actions 的语法差异

### 练习一：组件迁移实践

将以下 Vue 2 Options API 组件迁移到 Vue 3 `<script setup>`：

```vue
<template>
  <div class="user-search">
    <input v-model="keyword" placeholder="搜索用户" @input="handleSearch" />
    <ul v-if="results.length">
      <li v-for="user in results" :key="user.id" @click="selectUser(user)">{{ user.name }} - {{ user.email }}</li>
    </ul>
    <p v-else-if="searching">搜索中...</p>
  </div>
</template>
<script>
import { searchUsers } from '@/api/user';
export default {
  props: { departmentId: { type: String, required: true }, limit: { type: Number, default: 10 } },
  data() { return { keyword: '', results: [], searching: false, searchTimer: null }; },
  methods: {
    handleSearch() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(async () => {
        if (!this.keyword.trim()) { this.results = []; return; }
        this.searching = true;
        try { this.results = await searchUsers({ keyword: this.keyword, departmentId: this.departmentId, limit: this.limit }); }
        finally { this.searching = false; }
      }, 300);
    },
    selectUser(user) { this.$emit('select', user); this.keyword = ''; this.results = []; },
  },
  beforeDestroy() { clearTimeout(this.searchTimer); },
};
</script>
```

### 练习二：Store 迁移实践

将以下 Vuex store 迁移为 Pinia：

```js
const state = () => ({ items: [], couponCode: null, loading: false });
const getters = {
  cartItemCount(state) { return state.items.reduce((sum, i) => sum + i.quantity, 0); },
  cartTotal(state) { return state.items.reduce((sum, i) => sum + i.price * i.quantity, 0); },
};
const mutations = {
  ADD_ITEM(state, product) { const ex = state.items.find(i => i.id === product.id); if (ex) ex.quantity++; else state.items.push({ ...product, quantity: 1 }); },
  REMOVE_ITEM(state, id) { state.items = state.items.filter(i => i.id !== id); },
  CLEAR_CART(state) { state.items = []; state.couponCode = null; },
};
const actions = {
  async checkout({ state, commit }) { state.loading = true; try { await api.createOrder({ items: state.items }); commit('CLEAR_CART'); } finally { state.loading = false; } },
};
export default { namespaced: true, state, getters, mutations, actions };
```

---

## 参考答案

### 练习一

**思路**：`data` → `ref`，`props` → `defineProps`，`$emit` → `defineEmits`，`methods` → 普通函数，`beforeDestroy` → `onBeforeUnmount`。

**答案**：

```vue
<template>
  <div class="user-search">
    <input v-model="keyword" placeholder="搜索用户" @input="handleSearch" />
    <ul v-if="results.length">
      <li v-for="user in results" :key="user.id" @click="selectUser(user)">
        {{ user.name }} - {{ user.email }}
      </li>
    </ul>
    <p v-else-if="searching">搜索中...</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { searchUsers } from '@/api/user';

interface User { id: string; name: string; email: string; }
const props = defineProps<{ departmentId: string; limit?: number }>();
const emit = defineEmits<{ select: [user: User] }>();

const keyword = ref('');
const results = ref<User[]>([]);
const searching = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    if (!keyword.value.trim()) { results.value = []; return; }
    searching.value = true;
    try { results.value = await searchUsers({ keyword: keyword.value, departmentId: props.departmentId, limit: props.limit ?? 10 }); }
    finally { searching.value = false; }
  }, 300);
}

function selectUser(user: User) { emit('select', user); keyword.value = ''; results.value = []; }
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer); });
</script>
```

**要点**：`searchTimer` 不需要响应式，声明为普通变量；`this.$emit` 替换为 `defineEmits`；`this.keyword` 替换为 `keyword.value`；`beforeDestroy` 替换为 `onBeforeUnmount`。

### 练习二

**思路**：使用 Composition API 风格的 `defineStore`，`state` → `ref`，`getters` → `computed`，`mutations`/`actions` → 普通函数。

**答案**：

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface CartItem { id: string; name: string; price: number; quantity: number; }

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([]);
  const couponCode = ref<string | null>(null);
  const loading = ref(false);

  const cartItemCount = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0));
  const cartTotal = computed(() => items.value.reduce((sum, item) => sum + item.price * item.quantity, 0));

  function addItem(product: Omit<CartItem, 'quantity'>) {
    const existing = items.value.find(item => item.id === product.id);
    if (existing) existing.quantity++; else items.value.push({ ...product, quantity: 1 });
  }
  function removeItem(id: string) { items.value = items.value.filter(item => item.id !== id); }
  function clearCart() { items.value = []; couponCode.value = null; }
  async function checkout() {
    loading.value = true;
    try { clearCart(); } finally { loading.value = false; }
  }

  return { items, couponCode, loading, cartItemCount, cartTotal, addItem, removeItem, clearCart, checkout };
});
```

**要点**：使用 setup 函数形式的 `defineStore`；`commit('CLEAR_CART')` 替换为直接调用 `clearCart()`；所有类型添加了 TypeScript 接口。

### 练习二

**思路**：使用 Composition API 风格的 `defineStore`，`state` → `ref`，`getters` → `computed`，`mutations`/`actions` → 普通函数。

**答案**：

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface CartItem { id: string; name: string; price: number; quantity: number; }

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([]);
  const couponCode = ref<string | null>(null);
  const loading = ref(false);

  const cartItemCount = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0));
  const cartTotal = computed(() => items.value.reduce((sum, item) => sum + item.price * item.quantity, 0));

  function addItem(product: Omit<CartItem, 'quantity'>) {
    const existing = items.value.find(item => item.id === product.id);
    if (existing) existing.quantity++; else items.value.push({ ...product, quantity: 1 });
  }
  function removeItem(id: string) { items.value = items.value.filter(item => item.id !== id); }
  function clearCart() { items.value = []; couponCode.value = null; }
  async function checkout() {
    loading.value = true;
    try { clearCart(); } finally { loading.value = false; }
  }

  return { items, couponCode, loading, cartItemCount, cartTotal, addItem, removeItem, clearCart, checkout };
});
```

**要点**：使用 setup 函数形式的 `defineStore`；`commit('CLEAR_CART')` 替换为直接调用 `clearCart()`；所有类型添加了 TypeScript 接口。
