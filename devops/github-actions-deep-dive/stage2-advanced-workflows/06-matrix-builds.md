# 矩阵构建

> "我的代码在 Node 20 上跑得好好的，用户用 Node 18 就报错了。" 矩阵构建就是为了解决这个问题——一次配置，多版本、多平台并行测试。

## 矩阵构建的基础

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

这个配置会创建 3 个并行 Job，分别用 Node.js 18、20、22 运行测试。每个 Job 独立运行，互不影响。

`matrix` 的本质是一个笛卡尔积。如果你定义了两个维度：

```yaml
strategy:
  matrix:
    node-version: [18, 20]
    os: [ubuntu-latest, windows-latest]
```

会生成 4 个 Job：`(18, ubuntu)`, `(18, windows)`, `(20, ubuntu)`, `(20, windows)`。

## 多平台测试

跨平台是矩阵构建最常见的用途：

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [18, 20]
```

6 个 Job 会同时运行。但要注意：macOS Runner 的成本是 Linux 的 10 倍。如果 macOS 不是主要目标平台，可以只测一个版本：

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node-version: [18, 20]
    include:
      - os: macos-latest
        node-version: 20
```

`include` 会额外添加组合。这样总共 5 个 Job：Linux 和 Windows 各两个版本，macOS 只测 Node 20。

## include 和 exclude

### include：添加额外组合

```yaml
strategy:
  matrix:
    node-version: [18, 20]
    os: [ubuntu-latest]
    include:
      - node-version: 20
        os: ubuntu-latest
        experimental: true
```

`include` 可以给现有组合添加额外变量，也可以添加全新的组合。上面的例子里，`(20, ubuntu)` 组合会多一个 `matrix.experimental` 变量。

### exclude：排除特定组合

```yaml
strategy:
  matrix:
    node-version: [18, 20]
    os: [ubuntu-latest, windows-latest]
    exclude:
      - node-version: 18
        os: windows-latest
```

这会排除 `(18, windows)` 组合，剩下 3 个 Job。

### 动态矩阵

矩阵值可以从上一个 Job 的输出动态生成：

```yaml
jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - id: set-matrix
        run: |
          echo 'matrix={"node-version":[18,20],"os":["ubuntu-latest","windows-latest"]}' >> "$GITHUB_OUTPUT"

  test:
    needs: prepare
    runs-on: ${{ matrix.os }}
    strategy:
      matrix: ${{ fromJSON(needs.prepare.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci && npm test
```

`fromJSON()` 把 JSON 字符串解析成对象。这在需要根据仓库内容（比如哪些包有测试）动态决定矩阵时很有用。

## fail-fast 和 max-parallel

### fail-fast

```yaml
strategy:
  fail-fast: true
  matrix:
    node-version: [18, 20, 22]
```

`fail-fast: true`（默认值）表示：如果任何一个矩阵 Job 失败，立即取消所有其他正在运行的 Job。

这在开发阶段很有用——失败了就别浪费时间跑其他版本了。但在发布前的 CI 里，你可能想看到所有版本的结果：

```yaml
strategy:
  fail-fast: false
```

### max-parallel

```yaml
strategy:
  max-parallel: 2
  matrix:
    node-version: [18, 20, 22, 24]
```

限制同时运行的 Job 数量为 2。4 个 Job 会分两批执行。这在 Runner 数量有限或者想减少并发压力时有用。

## 矩阵变量的使用

矩阵变量在 Step 里通过 `${{ matrix.* }}` 访问：

```yaml
strategy:
  matrix:
    node-version: [18, 20]
    os: [ubuntu-latest, windows-latest]
steps:
  - run: echo "Running on ${{ matrix.os }} with Node ${{ matrix.node-version }}"
```

矩阵变量可以用在 `runs-on`、`uses` 的 `with`、`env`、`if` 等任何接受表达式的地方。

### 条件执行与矩阵

```yaml
steps:
  - run: npm test
    if: matrix.os != 'windows-latest'
```

跳过特定平台的某些 Step。但要注意：被跳过的 Step 在 GitHub UI 里显示为灰色（skipped），不是绿色（success）。如果你的 Job 依赖这个 Step 的结果，需要处理这种情况。

## 一个真实的矩阵问题

某项目在 macOS 上测试失败，错误是 `Error: EMFILE: too many open files`。原因是 macOS 默认的文件描述符限制比 Linux 低。

解决方案有两种：
1. 在 macOS Runner 上提高限制
2. 在测试配置里限制并发数

```yaml
steps:
  - name: Increase file limit (macOS)
    if: runner.os == 'macOS'
    run: echo "ulimit -n 65536" >> ~/.bashrc

  - run: npm test
```

这类问题只有矩阵构建才能发现。

## 练习

### 练习一：设计一个完整的矩阵策略

为一个 Python 项目设计矩阵构建，要求：
1. 测试 Python 3.9、3.10、3.11、3.12
2. 在 Ubuntu 和 Windows 上测试
3. Python 3.12 在 Windows 上有一个已知的兼容性问题，暂时跳过
4. 如果任何一个 Job 失败，不要取消其他 Job（看全貌）
5. 最多同时运行 3 个 Job

---

## 参考答案

```yaml
name: Python Matrix CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      max-parallel: 3
      matrix:
        python-version: ['3.9', '3.10', '3.11', '3.12']
        os: [ubuntu-latest, windows-latest]
        exclude:
          - python-version: '3.12'
            os: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'
      - run: pip install -r requirements.txt
      - run: pytest
```

**要点**：
- Python 版本用字符串 `'3.10'` 而不是数字 `3.10`，因为 `3.10` 会被解析成 `3.1`
- `exclude` 排除了 `(3.12, windows)` 组合
- `fail-fast: false` 保证所有组合都跑完
- `max-parallel: 3` 控制并发

**常见错误**：
- 用数字写 Python 版本，导致 `3.10` 变成 `3.1`
- 忘记 `fail-fast: false`，一个失败就全取消了
- `max-parallel` 设太小，CI 时间变很长
