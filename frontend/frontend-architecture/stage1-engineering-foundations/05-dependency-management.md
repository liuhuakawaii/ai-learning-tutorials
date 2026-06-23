# 05. 包间依赖管理与版本策略

> 依赖关系、版本锁定、依赖升级，掌握包间依赖管理的核心能力

## 本课目标

- 理解包间依赖关系的类型和影响
- 掌握版本锁定和依赖升级策略
- 学会处理依赖冲突和版本不一致
- 建立依赖管理的最佳实践

## 包间依赖关系

### 依赖类型

#### 1. 运行时依赖（dependencies）

```json
{
  "dependencies": {
    "lodash": "^4.17.21",
    "@myorg/utils": "workspace:*"
  }
}
```

**特点**：
- 生产环境需要
- 会被打包到最终产物
- 版本范围决定兼容性

#### 2. 开发依赖（devDependencies）

```json
{
  "devDependencies": {
    "typescript": "^5.0.0",
    "jest": "^29.0.0"
  }
}
```

**特点**：
- 只在开发环境使用
- 不会被打包到最终产物
- 版本范围通常更宽松

#### 3. 对等依赖（peerDependencies）

```json
{
  "peerDependencies": {
    "react": ">=16.8.0"
  }
}
```

**特点**：
- 由宿主环境提供
- 不会自动安装
- 版本范围通常较宽

### 依赖关系图

```
packages/utils
    ↓ (依赖)
packages/ui
    ↓ (依赖)
apps/web
```

**依赖关系的影响**：
1. **构建顺序**：被依赖的包需要先构建
2. **版本影响**：上游包版本变化会影响下游包
3. **缓存失效**：上游包修改会导致下游包缓存失效

## 版本范围

### 语义化版本

```
主版本号.次版本号.修订号
MAJOR.MINOR.PATCH
```

**版本号规则**：
- **MAJOR**：不兼容的 API 修改
- **MINOR**：向下兼容的功能性新增
- **PATCH**：向下兼容的问题修正

### 版本范围语法

```json
{
  "dependencies": {
    "lodash": "^4.17.21",    // 兼容 4.17.21 到 <5.0.0
    "react": "~18.2.0",      // 兼容 18.2.0 到 <18.3.0
    "axios": "1.0.0",        // 精确版本
    "typescript": ">=5.0.0"  // 大于等于 5.0.0
  }
}
```

**常用范围**：
- `^1.0.0`：兼容 1.x.x（最常用）
- `~1.0.0`：兼容 1.0.x
- `1.0.0`：精确版本
- `>=1.0.0`：大于等于
- `*`：任何版本

### 版本范围的选择

| 场景 | 推荐范围 | 原因 |
|------|----------|------|
| 应用开发 | `^1.0.0` | 兼容性好，自动获取补丁 |
| 组件库 | `^1.0.0` | 兼容性好，自动获取补丁 |
| 工具库 | `^1.0.0` | 兼容性好，自动获取补丁 |
| 关键依赖 | `~1.0.0` | 更保守，只获取补丁 |
| 锁定版本 | `1.0.0` | 精确控制，避免意外 |

## 版本锁定

### 为什么需要版本锁定

**问题场景**：
```bash
# 开发者 A 安装依赖
pnpm install
# lodash 版本：4.17.21

# 开发者 B 安装依赖
pnpm install
# lodash 版本：4.17.22

# 代码在开发者 A 环境正常，开发者 B 环境异常
```

### lock 文件

pnpm 使用 `pnpm-lock.yaml` 锁定依赖版本：

```yaml
# pnpm-lock.yaml
dependencies:
  lodash:
    specifier: ^4.17.21
    version: 4.17.21
```

**lock 文件的作用**：
1. **锁定版本**：确保所有环境使用相同版本
2. **记录依赖树**：记录完整的依赖关系
3. **加速安装**：避免重复解析依赖

### lock 文件的管理

```bash
# 安装依赖时自动更新 lock 文件
pnpm install

# 更新指定包的版本
pnpm update lodash

# 更新所有包的版本
pnpm update

# 查看过时的依赖
pnpm outdated
```

### lock 文件的提交

**必须提交 lock 文件**：
- 确保团队使用相同版本
- 确保 CI/CD 环境一致
- 避免环境差异导致的问题

**.gitignore 配置**：
```gitignore
# 不要忽略 lock 文件
# pnpm-lock.yaml

# 忽略 node_modules
node_modules
```

## 依赖升级

### 升级策略

#### 1. 自动升级（推荐）

```bash
# 查看可升级的依赖
pnpm outdated

# 升级指定包
pnpm update lodash

# 升级所有包
pnpm update
```

#### 2. 手动升级

```bash
# 升级到指定版本
pnpm add lodash@4.17.22

# 升级到最新版本
pnpm add lodash@latest

# 升级开发依赖
pnpm add -D typescript@5.0.0
```

#### 3. 批量升级

```bash
# 使用 npm-check-updates
npx npm-check-updates -u
pnpm install
```

### 升级注意事项

1. **查看变更日志**：了解版本变化
2. **运行测试**：确保升级后代码正常
3. **逐步升级**：不要一次升级太多包
4. **锁定版本**：升级后更新 lock 文件

## 依赖冲突

### 什么是依赖冲突

```
packages/a 依赖 lodash@^4.17.21
packages/b 依赖 lodash@^4.17.22
packages/c 依赖 lodash@^3.0.0  # 冲突！
```

### 冲突的解决

#### 方案一：统一版本

```json
// packages/c/package.json
{
  "dependencies": {
    "lodash": "^4.17.21"  // 升级到 4.x
  }
}
```

#### 方案二：使用 resolutions

```json
// 根目录 package.json
{
  "resolutions": {
    "lodash": "^4.17.21"
  }
}
```

#### 方案三：使用 pnpm overrides

```json
// 根目录 package.json
{
  "pnpm": {
    "overrides": {
      "lodash": "^4.17.21"
    }
  }
}
```

### 冲突的预防

1. **统一版本**：在根目录定义依赖版本
2. **定期升级**：定期更新依赖，避免版本差异过大
3. **版本检查**：使用工具检查依赖版本一致性

## 依赖分析

### 查看依赖树

```bash
# 查看所有依赖
pnpm list

# 查看指定包的依赖
pnpm list --filter @myorg/utils

# 查看依赖树
pnpm list --depth=3

# 查看过时的依赖
pnpm outdated
```

### 依赖关系图

```bash
# 使用 Turborepo 查看依赖关系
turbo run build --graph

# 输出依赖关系图
packages/utils
packages/ui -> packages/utils
apps/web -> packages/utils, packages/ui
```

### 依赖审计

```bash
# 检查安全漏洞
pnpm audit

# 修复漏洞
pnpm audit fix
```

## 最佳实践

### 1. 统一依赖版本

```json
// 根目录 package.json
{
  "devDependencies": {
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```

### 2. 使用 workspace 协议

```json
{
  "dependencies": {
    "@myorg/utils": "workspace:*",
    "@myorg/ui": "workspace:^1.0.0"
  }
}
```

### 3. 定期升级依赖

```bash
# 每周检查过时的依赖
pnpm outdated

# 每月升级依赖
pnpm update
```

### 4. 使用 pnpm overrides

```json
{
  "pnpm": {
    "overrides": {
      "lodash": "^4.17.21"
    }
  }
}
```

### 5. 提交 lock 文件

```gitignore
# 不要忽略 lock 文件
# pnpm-lock.yaml
```

## 实战：依赖管理

### 项目结构

```
my-monorepo/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── packages/
│   ├── utils/
│   │   ├── package.json
│   │   └── src/
│   └── ui/
│       ├── package.json
│       └── src/
└── apps/
    └── web/
        ├── package.json
        └── src/
```

### 配置文件

```json
// 根目录 package.json
{
  "name": "@myorg/monorepo",
  "private": true,
  "devDependencies": {
    "typescript": "^5.0.0",
    "jest": "^29.0.0"
  },
  "pnpm": {
    "overrides": {
      "lodash": "^4.17.21"
    }
  }
}
```

```json
// packages/utils/package.json
{
  "name": "@myorg/utils",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "^4.17.21"
  }
}
```

```json
// apps/web/package.json
{
  "name": "@myorg/web",
  "version": "1.0.0",
  "dependencies": {
    "@myorg/utils": "workspace:*",
    "@myorg/ui": "workspace:*"
  }
}
```

### 使用示例

```bash
# 安装依赖
pnpm install

# 查看依赖树
pnpm list

# 查看过时的依赖
pnpm outdated

# 升级依赖
pnpm update

# 检查安全漏洞
pnpm audit
```

## 常见问题

### Q: 如何解决依赖冲突？

A: 使用 pnpm overrides 统一版本，或升级到兼容版本。

### Q: 如何查看依赖树？

A: 使用 `pnpm list` 或 `pnpm list --depth=3`。

### Q: 如何升级依赖？

A: 使用 `pnpm update` 升级所有依赖，或 `pnpm add lodash@latest` 升级指定依赖。

### Q: 如何检查安全漏洞？

A: 使用 `pnpm audit` 检查安全漏洞，使用 `pnpm audit fix` 修复漏洞。

## 本课小结

本课我们掌握了包间依赖管理的核心能力：

1. **依赖类型**：运行时依赖、开发依赖、对等依赖
2. **版本范围**：语义化版本、版本范围语法
3. **版本锁定**：lock 文件的作用和管理
4. **依赖升级**：升级策略和注意事项
5. **依赖冲突**：冲突的原因和解决方案

## 练习

### 练习一：管理依赖版本

为一个 Monorepo 项目配置依赖管理：
- 统一 TypeScript 版本
- 配置 pnpm overrides
- 提交 lock 文件

### 练习二：解决依赖冲突

分析以下依赖冲突并解决：
```
packages/a 依赖 lodash@^4.17.21
packages/b 依赖 lodash@^4.17.22
packages/c 依赖 lodash@^3.0.0
```

## 参考答案

### 练习一

**根目录 package.json**：
```json
{
  "devDependencies": {
    "typescript": "^5.0.0"
  },
  "pnpm": {
    "overrides": {
      "typescript": "^5.0.0"
    }
  }
}
```

**.gitignore**：
```gitignore
# 不要忽略 lock 文件
# pnpm-lock.yaml

# 忽略 node_modules
node_modules
```

### 练习二

**解决方案**：
```json
// 根目录 package.json
{
  "pnpm": {
    "overrides": {
      "lodash": "^4.17.21"
    }
  }
}
```

**原因**：使用 pnpm overrides 统一 lodash 版本为 ^4.17.21，兼容 packages/a 和 packages/b，需要升级 packages/c 的依赖。

## 下一步

完成本课后，继续学习 [06. changesets 版本管理与发布流程](./06-changesets.md)。
