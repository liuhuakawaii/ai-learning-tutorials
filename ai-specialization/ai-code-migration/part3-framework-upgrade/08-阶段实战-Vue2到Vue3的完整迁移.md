# 08 - 阶段实战：Vue 2 到 Vue 3 的完整迁移

> **课程定位**：Part 3 综合实战，构建完整的 Vue 2 → Vue 3 迁移工具链。
>
> **前置要求**：了解 Vue 2 Options API 和 Vue 3 Composition API
>
> **预计时长**：2 小时

---

你要将 Vue 2 + JavaScript + Less + CommonJS 项目迁移到 Vue 3 + TypeScript + Tailwind CSS + ESM。从 Options API 到 `<script setup>`，从 Vuex 到 Pinia，从 Webpack 到 Vite，每一步都有 breaking change。

---

## 迁移工具链

```
主控脚本 → 项目分析器 → 组件迁移器 (Options→Composition) → 模块迁移器 (CJS→ESM) → Store迁移器 (Vuex→Pinia) → TypeScript配置
```

---

## 项目分析器

```js
// tools/project-analyzer.mjs
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function walkDir(dir, filter, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry), stat = statSync(full);
    if (stat.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry)) walkDir(full, filter, results);
    else if (stat.isFile() && filter(entry)) results.push(full);
  }
  return results;
}

function analyzeVue(filePath) {
  const c = readFileSync(filePath, 'utf-8');
  return {
    file: filePath, usesOptionsAPI: /export\s+default\s*\{/.test(c), usesVuex: /this\.\$store|mapState/.test(c),
    usesMixins: /mixins\s*:/.test(c), usesFilters: /\{\{.*\|\s*\w+/.test(c), lines: c.split('\n').length,
  };
}

const projectPath = process.argv[2] || './src';
const vueFiles = walkDir(projectPath, f => f.endsWith('.vue'));
const analyses = vueFiles.map(f => analyzeVue(f));
console.log(`Vue 组件：${vueFiles.length} 个，Options API：${analyses.filter(a => a.usesOptionsAPI).length} 个，Vuex：${analyses.filter(a => a.usesVuex).length} 个`);
```

---

## 组件迁移器

```js
// tools/component-migrator.mjs
import { readFileSync, writeFileSync } from 'fs';

const LIFECYCLE_MAP = { beforeCreate: null, created: null, beforeMount: 'onBeforeMount', mounted: 'onMounted', beforeUpdate: 'onBeforeUpdate', updated: 'onUpdated', beforeDestroy: 'onBeforeUnmount', destroyed: 'onUnmounted' };
const VUE_TO_TS = { 'String': 'string', 'Number': 'number', 'Boolean': 'boolean', 'Array': 'unknown[]', 'Object': 'Record<string, unknown>' };

function parseOptions(script) {
  const r = { props: null, data: [], computed: [], methods: [], lifecycle: [], imports: script.match(/^import\s+.+$/gm) || [] };
  const pm = script.match(/props\s*:\s*({[\s\S]*?})\s*[,}]/); if (pm) r.props = pm[1];
  const dm = script.match(/data\s*\(\s*\)\s*\{\s*return\s*({[\s\S]*?})\s*\}/); if (dm) r.data.push(dm[1]);
  const cm = script.match(/computed\s*:\s*({[\s\S]*?})\s*[,}]/);
  if (cm) { let m; const re = /(\w+)\s*\(\s*\)\s*\{([\s\S]*?)\}/g; while ((m = re.exec(cm[1]))) r.computed.push({ name: m[1], body: m[2].trim() }); }
  const mm = script.match(/methods\s*:\s*({[\s\S]*?})\s*[,}]/);
  if (mm) { let m; const re = /(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g; while ((m = re.exec(mm[1]))) r.methods.push({ name: m[1], params: m[2], body: m[3] }); }
  for (const hook of Object.keys(LIFECYCLE_MAP)) { const re = new RegExp(`${hook}\\s*\\(\\s*\\)\\s*\\{([\\s\\S]*?)\\}`, 'g'); const m = re.exec(script); if (m) r.lifecycle.push({ name: hook, body: m[1].trim() }); }
  return r;
}

function generateComposition(parsed) {
  const lines = ['<script setup lang="ts">', "import { ref, computed, onMounted, onUnmounted } from 'vue';"];
  if (parsed.imports.length) lines.push(...parsed.imports);
  lines.push('');
  if (parsed.props) {
    const fields = []; let m; const re = /(\w+)\s*:\s*\{?\s*type\s*:\s*(\w+)/g;
    while ((m = re.exec(parsed.props))) fields.push(`  ${m[1]}?: ${VUE_TO_TS[m[2]] || 'unknown'}`);
    lines.push(`const props = defineProps<{\n${fields.join('\n')}\n}>();\n`);
  }
  if (parsed.data.length) { let m; const re = /(\w+)\s*:\s*(.+?)$/gm; while ((m = re.exec(parsed.data[0]))) lines.push(`const ${m[1]} = ref(${m[2].trim().replace(/,$/, '')});`); lines.push(''); }
  for (const c of parsed.computed) lines.push(`const ${c.name} = computed(() => { ${c.body.replace(/this\.\w+/g, m => m.replace('this.', '') + '.value')} });`);
  for (const m of parsed.methods) lines.push(`function ${m.name}(${m.params}) { ${m.body.replace(/this\.\$/g, '').replace(/this\.(\w+)/g, '$1')} }`);
  for (const h of parsed.lifecycle) if (LIFECYCLE_MAP[h.name]) lines.push(`${LIFECYCLE_MAP[h.name]}(() => { ${h.body} });`);
  lines.push('</script>');
  return lines.join('\n');
}

function migrateComponent(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (!scriptMatch) return;
  const template = (content.match(/<template>([\s\S]*?)<\/template>/)?.[1] || '')
    .replace(/v-slot:(\w+)="(\w+)"/g, '#$1="$2"').replace(/\{\{\s*(\w+)\s*\|\s*(\w+)\s*\}\}/g, '{{ $2($1) }}').replace(/\.native/g, '');
  const style = content.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[0] || '';
  writeFileSync(filePath, `<template>\n${template}\n</template>\n\n${generateComposition(parseOptions(scriptMatch[1]))}\n\n${style}`);
  console.log(`已迁移：${filePath}`);
}

export { migrateComponent };
```

---

## Vuex → Pinia 迁移器

```js
// tools/vuex-to-pinia-migrator.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

function extractMethods(str) { const r = []; const re = /(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g; let m; while ((m = re.exec(str))) r.push({ name: m[1], params: m[2], body: m[3].trim() }); return r; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function generatePinia(content, moduleName) {
  const stateM = content.match(/state\s*[:=]\s*(\(\)\s*=>\s*)?({[\s\S]*?})\s*[,}]/);
  const gettersM = content.match(/getters\s*:\s*({[\s\S]*?})\s*(?=,\s*(mutations|actions)|})/);
  const mutationsM = content.match(/mutations\s*:\s*({[\s\S]*?})\s*(?=,\s*actions)/);
  const actionsM = content.match(/actions\s*:\s*({[\s\S]*?})\s*$/);

  const lines = ["import { defineStore } from 'pinia';", '', `export const use${cap(moduleName)}Store = defineStore('${moduleName}', {`, '  state: () => ({'];
  if (stateM) { const re = /(\w+)\s*:\s*([^,}]+)/g; let m; while ((m = re.exec(stateM[2]))) lines.push(`    ${m[1]}: ${m[2].trim()},`); }
  lines.push('  }),', '  getters: {');
  if (gettersM) for (const g of extractMethods(gettersM[1])) lines.push(`    ${g.name}() { ${g.body.replace(/state\.(\w+)/g, 'this.$1')} },`);
  lines.push('  },', '  actions: {');
  if (mutationsM) for (const m of extractMethods(mutationsM[1])) lines.push(`    ${m.name}(${m.params}) { ${m.body.replace(/state\.(\w+)/g, 'this.$1')} },`);
  if (actionsM) for (const a of extractMethods(actionsM[1])) lines.push(`    async ${a.name}(${a.params}) { ${a.body.replace(/state\.(\w+)/g, 'this.$1').replace(/commit\s*\([^)]+\)/g, '/* 直接调用 */')} },`);
  lines.push('  },', '});');
  return lines.join('\n');
}

function migrateVuexToPinia(storeFile, outputDir) {
  const moduleName = basename(storeFile, '.js').replace('-store', '').replace('store', 'index');
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, `${moduleName}-store.ts`), generatePinia(readFileSync(storeFile, 'utf-8'), moduleName));
  console.log(`已迁移：${storeFile}`);
}

export { migrateVuexToPinia };
```

---

## 主控脚本

```js
// tools/vue2-to-vue3-migrator.mjs
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { migrateComponent } from './component-migrator.mjs';
import { migrateVuexToPinia } from './vuex-to-pinia-migrator.mjs';

function walkFiles(root, filter) {
  const results = [];
  (function walk(dir) { for (const e of readdirSync(dir)) { const f = join(dir, e), s = statSync(f); if (s.isDirectory() && !['node_modules','.git','dist'].includes(e)) walk(f); else if (s.isFile() && filter(e)) results.push(f); } })(root);
  return results;
}

const projectPath = process.argv[2] || '.';
const srcPath = join(projectPath, 'src');
const report = { errors: [], warnings: [] };

console.log('=== Vue 2 → Vue 3 迁移工具 ===\n');

// 1. 分析
console.log(`--- 项目分析 ---\nVue 组件：${walkFiles(projectPath, f => f.endsWith('.vue')).length} 个`);

// 2. 依赖升级
console.log('\n--- 依赖升级 ---');
const pkgPath = join(projectPath, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  for (const dep of ['vuex', '@vue/cli-service', 'vue-template-compiler', 'element-ui']) { delete pkg.dependencies?.[dep]; delete pkg.devDependencies?.[dep]; }
  Object.assign(pkg.dependencies || (pkg.dependencies = {}), { 'vue': '^3.4.0', 'pinia': '^2.1.0', 'element-plus': '^2.7.0' });
  Object.assign(pkg.devDependencies || (pkg.devDependencies = {}), { 'vite': '^5.4.0', '@vitejs/plugin-vue': '^5.0.0', 'typescript': '^5.5.0', 'tailwindcss': '^3.4.0' });
  pkg.type = 'module';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  console.log('package.json 已更新');
}

// 3. 模块迁移 CJS → ESM
console.log('\n--- 模块迁移 ---');
let modCount = 0;
for (const f of walkFiles(projectPath, f => f.endsWith('.js') && !f.includes('node_modules'))) {
  let c = readFileSync(f, 'utf-8'); const orig = c;
  c = c.replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, (_, n, p) => `import ${n} from '${p}';`);
  c = c.replace(/const\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g, (_, n, p) => `import { ${n.trim()} } from '${p}';`);
  if (c !== orig) { writeFileSync(f.replace(/\.js$/, '.mjs'), c); modCount++; }
}
console.log(`模块迁移：${modCount} 个文件`);

// 4. 组件迁移
console.log('\n--- 组件迁移 ---');
let compCount = 0;
const backupDir = join(projectPath, '.migration-backup');
for (const f of walkFiles(projectPath, f => f.endsWith('.vue'))) {
  try {
    const bp = join(backupDir, relative(projectPath, f)); mkdirSync(dirname(bp), { recursive: true }); writeFileSync(bp, readFileSync(f, 'utf-8'));
    migrateComponent(f); compCount++;
  } catch (e) { report.warnings.push(`组件迁移失败：${f}`); }
}
console.log(`组件迁移：${compCount} 个`);

// 5. Store 迁移
console.log('\n--- Store 迁移 ---');
for (const f of walkFiles(projectPath, f => f.includes('store') && f.endsWith('.js'))) {
  try { migrateVuexToPinia(f, join(srcPath, 'stores')); } catch { report.warnings.push(`Store 迁移失败：${f}`); }
}

// 6. TypeScript 配置
console.log('\n--- TypeScript 配置 ---');
writeFileSync(join(projectPath, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', strict: false, allowJs: true, jsx: 'preserve', resolveJsonModule: true, isolatedModules: true, paths: { '@/*': ['./src/*'] } }, include: ['src/**/*'] }, null, 2));
console.log('tsconfig.json 已生成');

console.log(`\n=== 完成。警告：${report.warnings.length} ===`);
```

---

## 练习

### 练习一：组件迁移

将以下 Vue 2 组件迁移到 `<script setup>`：`data` → `ref`，`props` → `defineProps`，`$emit` → `defineEmits`，`beforeDestroy` → `onBeforeUnmount`，`searchTimer` 声明为普通变量（不需要响应式）。

### 练习二：Store 迁移

将 Vuex store 迁移为 Pinia：`commit('CLEAR_CART')` → 直接调用 `clearCart()`，Composition API 风格 `defineStore`，添加 TypeScript 接口。

---

## 参考答案

### 练习一

```vue
<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { searchUsers } from '@/api/user';

interface User { id: string; name: string; email: string; }
const props = defineProps<{ departmentId: string; limit?: number }>();
const emit = defineEmits<{ select: [user: User] }>();
const keyword = ref(''); const results = ref<User[]>([]); const searching = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

function handleSearch() { if (timer) clearTimeout(timer); timer = setTimeout(async () => { if (!keyword.value.trim()) { results.value = []; return; } searching.value = true; try { results.value = await searchUsers({ keyword: keyword.value, departmentId: props.departmentId, limit: props.limit ?? 10 }); } finally { searching.value = false; } }, 300); }
function selectUser(user: User) { emit('select', user); keyword.value = ''; results.value = []; }
onBeforeUnmount(() => { if (timer) clearTimeout(timer); });
</script>
```

### 练习二

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface CartItem { id: string; name: string; price: number; quantity: number; }

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([]);
  const loading = ref(false);
  const cartTotal = computed(() => items.value.reduce((sum, i) => sum + i.price * i.quantity, 0));
  function addItem(product: Omit<CartItem, 'quantity'>) { const ex = items.value.find(i => i.id === product.id); if (ex) ex.quantity++; else items.value.push({ ...product, quantity: 1 }); }
  function clearCart() { items.value = []; }
  async function checkout() { loading.value = true; try { clearCart(); } finally { loading.value = false; } }
  return { items, loading, cartTotal, addItem, clearCart, checkout };
});
```
