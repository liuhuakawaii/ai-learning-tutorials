# 执行环境：GitHub 托管 Runner

> 你的 workflow 在本地跑得好好的，推上去就挂了。大概率是执行环境的差异。这一课搞清楚 GitHub 托管 Runner 到底给你准备了什么，以及它没给你准备什么。

## Runner 上到底有什么

GitHub 托管 Runner 是一台临时虚拟机。每次 workflow 运行时，GitHub 从镜像池里分配一台全新的 VM，跑完就销毁。

关键事实：
- Ubuntu Runner 基于 Ubuntu 22.04 或 24.04
- macOS Runner 基于 macOS 14 (Sonoma) 或 macOS 15
- Windows Runner 基于 Windows Server 2022
- 每次运行都是全新环境，上一次运行的所有修改都会丢失

### 预装软件

GitHub 维护了每个 Runner 镜像的软件清单。以 `ubuntu-latest` 为例，预装了：

- **语言运行时**：Node.js、Python、Ruby、Go、Java、.NET、Rust
- **构建工具**：CMake、Gradle、Maven
- **容器工具**：Docker、Docker Compose、kubectl、Helm
- **CLI 工具**：aws-cli、gcloud、az-cli、gh

完整的软件列表在 [github.com/actions/runner-images](https://github.com/actions/runner-images) 的 `images/` 目录下。每个镜像都有一个 `InstalledSoftware.md` 文件，列出了所有预装软件及其版本。

### 为什么这很重要

因为预装软件的版本不是你能控制的。`ubuntu-latest` 上的 Node.js 版本可能从 18 变成 20，Python 可能从 3.10 变成 3.11。如果你的 workflow 依赖特定版本，必须显式安装：

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20.11.0'
```

不指定版本，就是把稳定性交给 GitHub 的更新节奏。

## 文件系统布局

Runner 上有几个关键路径：

```
/home/runner/
├── work/
│   └── <repo-name>/          # $GITHUB_WORKSPACE，checkout 的代码在这里
│       └── ...
├── actions-runner/            # Runner 程序本身
└── .cache/                    # 各种缓存
```

`$GITHUB_WORKSPACE` 是 checkout 后代码所在的目录，也是 `run` Step 的默认工作目录。但注意：`actions/checkout` 默认会把代码 clone 到这个目录，如果目录已存在（理论上不会，因为每次都是新 VM），会清空它。

### 临时目录

`$RUNNER_TEMP` 是一个临时目录，workflow 结束后会被清理。适合存放临时文件：

```yaml
- run: |
    curl -o "$RUNNER_TEMP/tool.tar.gz" https://example.com/tool.tar.gz
    tar -xzf "$RUNNER_TEMP/tool.tar.gz" -C /usr/local/bin/
```

### 磁盘空间

Ubuntu Runner 大约有 14GB 可用空间。macOS 和 Windows 会更少。如果你的 workflow 需要大量磁盘空间（比如 Docker 构建），可能会遇到空间不足的问题。

查看可用空间：

```yaml
- run: df -h /
```

## 环境变量

Runner 预设了一系列环境变量：

```bash
GITHUB_WORKSPACE=/home/runner/work/my-repo/my-repo
GITHUB_REPOSITORY=owner/my-repo
GITHUB_REF=refs/heads/main
GITHUB_SHA=abc123...
GITHUB_ACTOR=username
GITHUB_TOKEN=ghp_...          # 自动注入的 token
RUNNER_OS=Linux
RUNNER_TEMP=/home/runner/work/_temp
```

这些变量在每个 Step 里都可以直接使用。但要注意：`GITHUB_TOKEN` 的权限是受限的，默认只有仓库的读权限和写 issues/PR 的权限。

### 自定义环境变量

你可以在 workflow 级别、Job 级别、Step 级别设置环境变量：

```yaml
env:
  NODE_ENV: production          # workflow 级别

jobs:
  build:
    env:
      BUILD_TYPE: release       # Job 级别
    steps:
      - env:
          STEP_VAR: hello       # Step 级别
        run: echo "$NODE_ENV $BUILD_TYPE $STEP_VAR"
```

作用域从窄到宽：Step > Job > workflow。同名变量，窄作用域覆盖宽作用域。

## Shell 行为差异

不同操作系统上，`run` Step 的默认 Shell 不同：

| OS | 默认 Shell | 登录 Shell |
|---|---|---|
| Ubuntu | bash --noprofile --norc -e -o pipefail {0} | bash --noprofile --norc -eo pipefail {0} |
| macOS | bash --noprofile --norc -eo pipefail {0} | bash --l --noprofile --norc -eo pipefail {0} |
| Windows | pwsh -command ". '{0}'" | N/A |

注意 `-e` 参数：bash 遇到非零退出码会立即退出。这意味着：

```yaml
- run: |
    echo "This runs"
    false
    echo "This does NOT run"
```

第二行 `false` 返回非零退出码，整个 Step 立即失败。如果你希望忽略某个命令的错误：

```yaml
- run: |
    echo "This runs"
    false || true
    echo "This also runs"
```

或者用 `continue-on-error: true` 让整个 Step 不影响 Job 结果。

## 一个真实的环境问题

某团队的 CI 突然开始失败，错误是 `Cannot find module 'sharp'`。排查发现：

1. `package.json` 里 `sharp` 是 `dependencies`，不是 `devDependencies`
2. CI 用的是 `npm ci`，只安装 `dependencies` 和 `devDependencies`
3. `sharp` 是一个原生模块，需要编译
4. GitHub 更新了 `ubuntu-latest` 镜像，底层 Node.js 版本从 18 变成了 20
5. `sharp` 的预编译二进制文件和新的 Node.js 版本不兼容

解决方案：在 `setup-node` 时固定 Node.js 版本，并确保 `sharp` 的版本兼容。

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20.11.0'
    cache: 'npm'
- run: npm ci
```

## 练习

### 练习一：诊断环境差异

写一个 workflow，让它打印出以下信息：
1. 操作系统版本
2. Node.js 版本（如果有）
3. 磁盘可用空间
4. `$GITHUB_WORKSPACE` 的内容
5. 所有以 `GITHUB_` 开头的环境变量

这个 workflow 应该在 `push` 到任意分支时触发。

---

## 参考答案

### 练习一

```yaml
name: Environment Debug
on:
  push:

jobs:
  debug:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: OS version
        run: cat /etc/os-release

      - name: Node.js version
        run: node --version

      - name: Disk space
        run: df -h /

      - name: Workspace contents
        run: ls -la "$GITHUB_WORKSPACE"

      - name: GitHub env vars
        run: env | grep '^GITHUB_' | sort
```

**要点**：
- 需要 `actions/checkout` 才能看到 workspace 内容
- `env | grep` 过滤出相关变量
- `node --version` 不需要 `setup-node`，因为 Runner 预装了 Node.js
- 用 `cat /etc/os-release` 而不是 `uname -a`，因为前者信息更丰富
