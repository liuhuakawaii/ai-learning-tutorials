# 上下文与表达式

> `${{ github.sha }}`、`${{ env.NODE_ENV }}`、`${{ secrets.API_KEY }}`——这些表达式看起来简单，但它们的作用域、生命周期和求值时机各不相同。搞不清楚这些，就会写出"本地测试没问题但 CI 里拿不到值"的 workflow。

## 表达式的基础语法

GitHub Actions 的表达式用 `${{ }}` 包裹。它支持：

- 字面量：`'hello'`、`42`、`true`
- 上下文访问：`github.sha`、`env.MY_VAR`
- 操作符：`==`、`!=`、`&&`、`||`、`!`
- 函数：`contains()`、`startsWith()`、`format()`、`toJSON()`

```yaml
if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
```

注意：表达式在 YAML 解析之后、workflow 执行之前求值。这意味着你不能在表达式里引用运行时才生成的值（比如某个 Step 的输出），除非通过 `outputs` 机制。

## 核心上下文

### github 上下文

`github` 上下文包含 workflow 的触发信息：

```yaml
github.event_name      # push, pull_request, schedule, ...
github.sha             # 当前 commit SHA
github.ref             # 当前 ref（refs/heads/main, refs/tags/v1.0, ...）
github.repository      # owner/repo
github.actor           # 触发 workflow 的用户名
github.token           # 自动生成的 GITHUB_TOKEN
github.event           # 触发事件的完整 payload
```

`github.event` 是最有用也最容易被忽略的。对于 `pull_request` 事件，`github.event.pull_request.title` 是 PR 标题，`github.event.pull_request.base.ref` 是目标分支。你可以用它来实现精细的条件判断：

```yaml
if: github.event.pull_request.draft == false
```

### env 上下文

`env` 上下文包含环境变量。但要注意：在 `if` 表达式里，`env` 的行为和在 `run` 里不同。

```yaml
steps:
  - run: echo "MY_VAR=hello" >> "$GITHUB_ENV"
  - run: echo "$MY_VAR"          # 这里能拿到 hello
  - if: env.MY_VAR == 'hello'    # 这里拿不到！
    run: echo "matched"
```

为什么？因为 `if` 表达式在 Step 执行前求值，而 `$GITHUB_ENV` 的修改在当前 Step 结束后才生效。这是一个经典的时间差问题。

### secrets 上下文

```yaml
steps:
  - run: echo "Connecting to ${{ secrets.DATABASE_URL }}"
```

`secrets` 的值在日志里会被自动遮蔽为 `***`。但要注意：

1. 如果 secret 的值恰好和某个环境变量或输出的值相同，那个值也会被遮蔽
2. 在 `if` 表达式里不能用 `secrets`——你不能判断一个 secret 是否存在或是否为空
3. 在可重用 workflow 里，secrets 需要显式传递

### runner 上下文

```yaml
runner.os           # Linux, Windows, macOS
runner.arch         # X64, ARM64
runner.temp         # 临时目录路径
runner.tool_cache   # 工具缓存目录路径
```

在跨平台 workflow 里，`runner.os` 经常用来做条件判断：

```yaml
- run: |
    if [ "$RUNNER_OS" = "Windows" ]; then
      choco install jq
    else
      sudo apt-get install -y jq
    fi
```

## 输出机制

Step 之间的数据传递通过两个文件实现：

### $GITHUB_OUTPUT

Step 向后续 Step 传递键值对：

```yaml
- id: get-date
  run: echo "date=$(date +%Y%m%d)" >> "$GITHUB_OUTPUT"

- run: echo "Today is ${{ steps.get-date.outputs.date }}"
```

注意 `id: get-date`——必须给 Step 一个 id，才能在后续 Step 里引用它的输出。

### $GITHUB_ENV

设置环境变量，影响后续所有 Step：

```yaml
- run: echo "NODE_ENV=production" >> "$GITHUB_ENV"

- run: echo "$NODE_ENV"  # 输出 production
```

`$GITHUB_ENV` 的修改只在当前 Step 结束后生效。所以：

```yaml
- run: |
    echo "FOO=bar" >> "$GITHUB_ENV"
    echo "$FOO"  # 空！因为 FOO 还没生效
```

### $GITHUB_PATH

往 PATH 里添加目录：

```yaml
- run: |
    echo "$HOME/.local/bin" >> "$GITHUB_PATH"

- run: my-tool --version  # 现在能找到 my-tool 了
```

## 条件表达式的求值时机

这是最容易出错的地方。`if` 表达式在 Step 或 Job 开始前求值，不是在运行时求值。

```yaml
steps:
  - id: check
    run: echo "should_deploy=true" >> "$GITHUB_OUTPUT"

  - if: steps.check.outputs.should_deploy == 'true'  # ✓ 正确
    run: echo "Deploying"

  - if: env.MY_VAR == 'hello'  # ✗ 可能不对，取决于 MY_VAR 什么时候设置的
    run: echo "Hello"
```

对于 `env`，只有在 workflow 文件顶部定义的、或者通过 `env` 关键字在 Job/Step 级别静态定义的，才能在 `if` 表达式里使用。通过 `$GITHUB_ENV` 动态设置的，在下一个 Step 的 `if` 里才能用。

## 一个真实的上下文问题

有人写了这样的 workflow：

```yaml
- name: Get PR title
  if: github.event_name == 'pull_request'
  run: echo "PR title: ${{ github.event.pull_request.title }}"

- name: Check if WIP
  if: contains(github.event.pull_request.title, 'WIP')
  run: echo "This is a WIP PR"
```

第一个 Step 能正确打印 PR 标题。但第二个 Step 的 `if` 在 `push` 事件下会报错吗？

不会。`contains()` 在第二个参数是 `null`（`github.event.pull_request` 在 push 事件下不存在）时返回 `false`，而不是报错。所以这个 workflow 在 push 事件下，两个 Step 都会被跳过，不会报错。

但如果你写的是：

```yaml
- if: github.event.pull_request.title == 'WIP'
```

在 push 事件下，`github.event.pull_request.title` 是 `null`，`null == 'WIP'` 是 `false`，也不会报错。但如果你用 `!=`：

```yaml
- if: github.event.pull_request.title != 'WIP'
```

`null != 'WIP'` 是 `true`，这个 Step 会在 push 事件下意外执行。用 `contains()` 更安全。

## 练习

### 练习一：上下文侦探

写一个 workflow，在 `pull_request` 事件触发时，打印以下信息：
1. PR 编号
2. PR 标题
3. PR 的源分支和目标分支
4. PR 是否是 draft
5. 触发 PR 的用户名

用 `${{ github.event.pull_request.* }}` 来获取这些信息。

### 练习二：输出传递

写一个有两个 Job 的 workflow：
1. 第一个 Job 生成一个随机数，通过 `outputs` 传给第二个 Job
2. 第二个 Job 接收这个随机数，判断它是奇数还是偶数

---

## 参考答案

### 练习一

```yaml
name: PR Info
on:
  pull_request:

jobs:
  pr-info:
    runs-on: ubuntu-latest
    steps:
      - name: Print PR details
        run: |
          echo "PR #${{ github.event.pull_request.number }}"
          echo "Title: ${{ github.event.pull_request.title }}"
          echo "Head: ${{ github.event.pull_request.head.ref }}"
          echo "Base: ${{ github.event.pull_request.base.ref }}"
          echo "Draft: ${{ github.event.pull_request.draft }}"
          echo "Author: ${{ github.event.pull_request.user.login }}"
```

### 练习二

```yaml
name: Output Passing
on:
  push:

jobs:
  generate:
    runs-on: ubuntu-latest
    outputs:
      number: ${{ steps.random.outputs.number }}
    steps:
      - id: random
        run: echo "number=$((RANDOM))" >> "$GITHUB_OUTPUT"

  check:
    needs: generate
    runs-on: ubuntu-latest
    steps:
      - name: Check odd/even
        run: |
          NUM=${{ needs.generate.outputs.number }}
          if [ $((NUM % 2)) -eq 0 ]; then
            echo "$NUM is even"
          else
            echo "$NUM is odd"
          fi
```

**注意**：`outputs` 的声明必须在 Job 级别，指向某个 Step 的输出。`$((RANDOM))` 是 bash 内置的随机数生成器。
