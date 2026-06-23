# 工件与缓存

> `actions/cache` 和 `actions/upload-artifact` 看起来都是"存东西"，但它们的用途、行为和成本完全不同。用错了，要么 CI 慢得要死，要么账单莫名其妙变高。

## 缓存：加速重复构建

### 为什么需要缓存

每次 workflow 运行，Runner 都是全新的。`npm ci` 要重新下载所有依赖，`pip install` 要重新编译所有包。如果依赖没变，这些工作完全是浪费时间。

缓存的作用是：把上次下载的依赖存起来，下次直接用。

### actions/cache 的工作原理

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: npm-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      npm-${{ runner.os }}-
```

这个配置做了三件事：

1. **保存路径**：`~/.npm` 是 npm 的缓存目录
2. **缓存 key**：用 `package-lock.json` 的哈希值生成。文件不变，key 不变，缓存命中
3. **降级 key**：如果精确匹配失败，用前缀 `npm-Linux-` 搜索最近的缓存

缓存的生命周期：
- 缓存 key 唯一匹配：直接使用
- 缓存 key 不匹配但 restore-keys 匹配：使用最近的匹配缓存（只读）
- 都不匹配：跳过缓存，workflow 结束后如果 key 存在则保存

### 缓存的陷阱

**陷阱 1：缓存不会更新**

如果 key 是 `npm-Linux-abc123`，即使你 `npm ci` 安装了新版本的包，缓存里的内容也不会更新。因为缓存是 immutable 的——同一个 key 只能写一次。

解决方案：key 必须包含变化因素。用 `hashFiles('**/package-lock.json')` 就是因为 lockfile 变了，依赖才变。

**陷阱 2：缓存有大小限制**

每个仓库的缓存总大小是 10GB。超出后，GitHub 会按 LRU（最近最少使用）策略清理旧缓存。

**陷阱 3：缓存是仓库级的**

同一仓库的不同分支共享缓存。`main` 分支保存的缓存，`feature` 分支也能用。这通常是好事，但要注意 key 的命名不要冲突。

### setup-node 的内置缓存

`actions/setup-node` 自带缓存功能：

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

`cache: 'npm'` 会自动缓存 npm 的全局缓存目录，key 基于 `package-lock.json` 的哈希。对于大多数项目，这比手动配置 `actions/cache` 更方便。

类似地，`actions/setup-python`、`actions/setup-go` 等也有内置缓存。

## 工件：跨 Job 传递文件

### 工件和缓存的区别

| | 缓存 | 工件 |
|---|---|---|
| 用途 | 加速构建 | 传递产物 |
| 生命周期 | 可以跨 workflow run | 绑定到单个 workflow run |
| 大小限制 | 10GB/仓库 | 可配置 |
| 访问方式 | 同一仓库的 workflow | API 下载、UI 下载 |
| 典型场景 | node_modules、pip 缓存 | 构建产物、测试报告、日志 |

### 上传和下载

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
          retention-days: 7

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-output
          path: dist/
      - run: ./deploy.sh
```

`retention-days` 控制工件保留时间，默认 90 天。对于临时构建产物，设短一些可以节省存储成本。

### 工件的常见用法

**测试报告**：

```yaml
- name: Run tests
  if: always()
  run: npm test -- --reporter=junit --output-file=test-results.xml

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: test-results.xml
```

`if: always()` 确保即使测试失败也能上传报告。没有这个，测试失败时 Step 会被跳过。

**多个工件**：

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: frontend-build
    path: apps/frontend/dist/

- uses: actions/upload-artifact@v4
  with:
    name: backend-build
    path: apps/backend/dist/
```

下载时可以按名称下载，或者一次性下载所有：

```yaml
- uses: actions/download-artifact@v4
  with:
    pattern: '*-build'
    merge-multiple: true
    path: all-builds/
```

## 缓存策略实战

### npm 项目

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
- run: npm ci
```

`npm ci` 会先检查本地缓存，有就直接用，没有就下载。配合 `setup-node` 的内置缓存，这是最简单的方案。

### pip 项目

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: 'pip'
- run: pip install -r requirements.txt
```

### Docker 构建

Docker 层缓存是另一个话题（第 22 课会深入），但基本思路：

```yaml
- uses: docker/build-push-action@v5
  with:
    context: .
    push: false
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`type=gha` 使用 GitHub Actions 的缓存后端来存储 Docker 层。

## 成本意识

工件存储是有成本的。GitHub Free 计划包含 500MB 的工件存储和一定的分钟数。超出后按量计费。

几个省钱的建议：
1. `retention-days` 设短一些，7 天通常够了
2. 只上传需要的文件，不要上传整个 `node_modules`
3. 缓存是免费的，尽量用缓存代替工件来传递依赖
4. 定期检查仓库的 Actions 用量页面

## 练习

### 练习一：缓存对比实验

写一个 workflow，包含两个 Job：
1. **无缓存 Job**：checkout 后直接 `npm ci`，记录耗时
2. **有缓存 Job**：使用 `setup-node` 的内置缓存，记录耗时

两个 Job 都用同一个 `package.json`（可以自己创建一个有若干依赖的项目）。对比两次的 `npm ci` 耗时。

提示：用 `time npm ci` 记录耗时，或者用 `::group::` 和 `::endgroup::` 来折叠输出。

---

## 参考答案

### 练习一

```yaml
name: Cache Comparison
on:
  push:

jobs:
  without-cache:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install without cache
        run: time npm ci

  with-cache:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install with cache
        run: time npm ci
```

**预期结果**：
- 第一次运行：两个 Job 耗时相近（缓存还没有）
- 第二次运行：`with-cache` Job 的 `npm ci` 会显著更快，因为命中了缓存
- `time` 命令会输出 `real`（实际耗时）、`user`（用户态耗时）、`sys`（内核态耗时），关注 `real` 即可

**扩展**：可以在 `with-cache` Job 里加一个 Step 来验证缓存是否命中：

```yaml
- name: Check cache
  run: |
    if [ -d ~/.npm/_cacache ]; then
      echo "Cache directory exists"
      du -sh ~/.npm
    fi
```
