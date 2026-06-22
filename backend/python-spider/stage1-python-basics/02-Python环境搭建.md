# 第2课：Python环境搭建

> **课程定位**：从零搭建 Python 开发环境，为后续爬虫开发做好准备
> **前置知识**：第 1 课内容，会基本的命令行操作
> **预计时长**：40 分钟

---

## 场景引入

你已经决定用 Python 写爬虫了，打开终端输入 `python`，结果提示"不是内部或外部命令"。折腾了半小时装好 Python，`pip install requests` 又卡在下载不动。好不容易装好了包，运行脚本报了一堆 import 错误——原来装到了全局环境，和另一个项目的依赖冲突了。环境问题是从前端转 Python 的第一道坎，也是最容易消磨学习热情的一步。这节课我们把环境一次搭好：Python 安装、pip 配置、虚拟环境、VS Code 集成，全部搞定，让后续学习不再被环境问题打断。

---

## 学习目标

完成本课学习后，你将能够：

1. 在自己的电脑上成功安装 Python 3.10 或更高版本
2. 理解 pip 包管理器的作用，并能类比 npm 进行记忆
3. 独立创建和激活 Python 虚拟环境
4. 使用 pip 安装第三方库
5. 编写并运行第一个 Python 脚本

---

## 一、安装 Python

### 1.1 为什么要安装 Python？

作为前端开发者，你电脑上大概率已经有 Node.js 了。Python 和 Node.js 一样，是一个运行环境——JavaScript 代码需要 Node.js 来跑，Python 代码需要 Python 解释器来跑。

```
┌─────────────────────────────────────────────────────────────┐
│                    运行环境类比                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   JavaScript 代码  ──→  Node.js 运行环境  ──→  执行结果     │
│   Python 代码      ──→  Python 运行环境    ──→  执行结果     │
│                                                             │
│   .js 文件         ──→  node script.js                      │
│   .py 文件         ──→  python script.py                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 下载与安装

前往 Python 官方网站下载：**https://www.python.org/downloads/**

建议安装 **Python 3.10 或更高版本**（本课程基于 Python 3.10+ 编写）。

#### Windows 用户

1. 打开下载页面，点击最新的 Python 3.x.x 版本
2. 下载 Windows installer (64-bit)
3. 运行安装程序，**务必勾选 "Add Python to PATH"**（非常重要！）

```
┌─────────────────────────────────────────────────────────────┐
│  Python 3.x.x (64-bit) Setup                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ☑ Install launcher for all users (recommended)             │
│  ☑ Add Python 3.x to PATH    ← 一定要勾选！                │
│                                                             │
│  [ Customize installation ]  [ Install now ]                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

> 如果忘记勾选 PATH，后续命令行输入 `python` 会提示"不是内部或外部命令"。重新运行安装程序勾选即可，或者手动将 Python 安装路径添加到系统环境变量。

4. 点击 "Install now"，等待安装完成

#### macOS 用户

macOS 通常自带 Python，但版本较老。建议通过 Homebrew 安装：

```bash
# 如果没有 Homebrew，先安装它
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Python
brew install python
```

#### Linux 用户

大多数 Linux 发行版自带 Python 3。如果没有或版本太低：

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install python3 python3-pip python3-venv

# Fedora
sudo dnf install python3 python3-pip
```

### 1.3 验证安装

打开终端，输入以下命令：

```bash
# 查看 Python 版本（macOS/Linux 如果不生效，试 python3 --version）
python --version
```

看到类似 `Python 3.12.4` 的输出，说明安装成功。

```
┌─────────────────────────────────────────────────────────────┐
│                    版本号的含义                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Python  3  .  12  .  4                                    │
│           │     │     │                                     │
│           │     │     └── 补丁版本（bug 修复）               │
│           │     └──────── 次版本号（新功能）                  │
│           └────────────── 主版本号（大版本）                  │
│                                                             │
│   本课程要求：主版本 = 3，次版本 >= 10                        │
│   即 Python 3.10、3.11、3.12、3.13 都可以                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、pip 包管理器

### 2.1 pip 是什么？

如果你用过 npm，那 pip 对你来说非常好理解——它就是 Python 世界的 npm。

```
┌─────────────────────┬───────────────────────────────────────┐
│       npm           │              pip                      │
├─────────────────────┼───────────────────────────────────────┤
│ package.json        │  requirements.txt                     │
│ npm install xxx     │  pip install xxx                      │
│ npm uninstall xxx   │  pip uninstall xxx                    │
│ npm list            │  pip list                             │
│ node_modules/       │  虚拟环境中的 site-packages/          │
│ npm -g install xxx  │  pip install xxx (默认全局)           │
│ npx xxx             │  python -m xxx                        │
└─────────────────────┴───────────────────────────────────────┘
```

### 2.2 验证 pip

```bash
pip --version
# 输出类似：pip 24.0 from .../pip (python 3.12)
```

> 安装 Python 3.10+ 时会自动附带 pip，不需要单独安装。

### 2.3 使用国内镜像（重要！）

pip 默认从国外服务器下载包，速度很慢。配置国内镜像可以大幅提速：

```bash
# 永久配置（推荐）—— 一劳永逸
pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 或者临时使用
pip install requests -i https://pypi.tuna.tsinghua.edu.cn/simple
```

常用镜像源：清华 `pypi.tuna.tsinghua.edu.cn`、阿里云 `mirrors.aliyun.com/pypi`、腾讯云 `mirrors.cloud.tencent.com/pypi`。推荐清华源，稳定且速度快。

---

## 三、虚拟环境

### 3.1 为什么需要虚拟环境？

想象一下这个场景：

```
项目 A 需要 requests 2.28（旧版本）
项目 B 需要 requests 2.31（新版本）

如果都装在全局，只能保留一个版本 → 必然有一个项目跑不起来！
```

这和前端的 `node_modules` 隔离是同一个道理：

```
  Node.js 项目 A/         Python 项目 A/
    ├── package.json        ├── requirements.txt
    └── node_modules/       └── venv/
        ← 独立依赖              └── site-packages/
                                    ← 独立依赖
  每个项目一个独立环境，互不干扰
```

### 3.2 创建与激活虚拟环境

```bash
# 进入项目目录，创建虚拟环境（venv 是约定俗成的名字）
mkdir my-spider-project && cd my-spider-project
python -m venv venv
```

创建后激活它——不同系统的命令不一样：

```bash
# Windows CMD
venv\Scripts\activate.bat

# Windows PowerShell
venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate
```

激活成功后，终端提示符前面会出现 `(venv)` 标志：

```
  激活前：                    激活后：
  ┌────────────────────┐      ┌────────────────────┐
  │ 系统全局 Python 环境│      │ (venv) 虚拟环境     │
  │ D:\my-project>     │  ──→ │ pip install 只装    │
  └────────────────────┘      │ 在 venv 里          │
         │                    │ (venv) D:\my-proj>  │
         │ source venv/       └────────────────────┘
         │   bin/activate
```

退出虚拟环境只需输入：

```bash
deactivate
```

> **Windows PowerShell 报错？** 如果激活时提示"禁止运行脚本"，执行 `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` 即可。

---

## 四、安装第三方库

### 4.1 用 pip 安装包

确保虚拟环境已激活（终端前面有 `(venv)` 标志），然后：

```bash
pip install requests                        # 安装单个包
pip install requests beautifulsoup4 lxml    # 安装多个包
pip install requests==2.31.0                # 安装指定版本
pip list                                    # 查看已安装的包
pip show requests                           # 查看某个包的详细信息
pip uninstall requests                      # 卸载包
pip install --upgrade requests              # 升级包
```

---

## 五、requirements.txt

### 5.1 它就是 Python 的 package.json

```
┌─────────────────────┬─────────────────────┐
│     package.json    │  requirements.txt   │
├─────────────────────┼─────────────────────┤
│ {                   │  requests==2.31.0   │
│   "dependencies": { │  beautifulsoup4==   │
│     "axios": "^1.x" │    4.12.3          │
│   }                 │  lxml==5.2.2        │
│ }                   │  pandas==2.2.2      │
└─────────────────────┴─────────────────────┘
```

### 5.2 生成与使用

```bash
# 导出当前环境的所有依赖
pip freeze > requirements.txt

# 别人拿到你的项目后，一条命令装好所有依赖（类似 npm install）
pip install -r requirements.txt
```

> **重要提醒**：一定要把 `venv/` 目录加到 `.gitignore` 文件中，不要提交到 Git 仓库。这和 `node_modules/` 不能提交是同一个道理。

### 5.3 项目交接流程

你：`python -m venv venv` → 激活 → `pip install xxx` → `pip freeze > requirements.txt` → 提交代码（venv 加到 .gitignore）

同事：`git clone` → `python -m venv venv` → 激活 → `pip install -r requirements.txt` → 开始开发

---

## 六、IDE 推荐：VS Code + Python 扩展

作为前端开发者，你大概率已经在用 VS Code 了，不需要换编辑器。

### 6.1 安装 Python 扩展

1. 按 `Ctrl+Shift+X`（macOS: `Cmd+Shift+X`）打开扩展面板
2. 搜索 "Python"，安装 Microsoft 官方的 Python 扩展
3. 同时安装推荐的 Pylance（智能补全）和 Python Debugger（调试支持）

### 6.2 选择 Python 解释器

1. 按 `Ctrl+Shift+P`（macOS: `Cmd+Shift+P`）打开命令面板
2. 输入 "Python: Select Interpreter"
3. 选择虚拟环境中的 Python（路径包含 `venv` 的那个）

```
┌─────────────────────────────────────────────────────────────┐
│  Select Interpreter                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  > Python 3.12.4 64-bit ('venv': venv)   ← 选这个          │
│    Python 3.12.4 64-bit (global)                            │
│    Python 3.10.12 64-bit                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

选择后，VS Code 底部状态栏会显示当前的 Python 版本和环境名称。

---

## 七、第一个 Python 脚本

### 7.1 编写 Hello World

创建一个文件叫 `hello.py`，输入以下内容：

```python
# 这是我的第一个 Python 脚本
# 在 Python 中，# 开头的行是注释，和 JavaScript 的 // 一样

print("Hello, World!")  # 输出一段文字

# 试试输出中文
print("你好，爬虫世界！")

# 做一点简单的计算
price = 99.9
quantity = 3
total = price * quantity
print(f"总价：{total} 元")  # f-string 格式化，类似 JS 的模板字符串
```

### 7.2 运行脚本

确保虚拟环境已激活，在终端中执行：

```bash
python hello.py
```

输出：

```
Hello, World!
你好，爬虫世界！
总价：299.7 元
```

运行方式有两种：命令行执行 `python hello.py`（推荐），或者在 VS Code 中点击右上角 ▶ 按钮 / 按 F5。

### 7.3 Python 交互模式

除了运行 `.py` 文件，Python 还有交互模式（类似 Node.js 的 REPL）——终端输入 `python` 即可进入，`exit()` 退出：

```python
>>> 1 + 1
2
>>> "hello" * 3
'hellohellohello'
```

---

## 八、常见问题排查

| 问题 | 原因 | 解决方案 |
|---|---|---|
| "python 不是内部或外部命令" | Python 没有添加到系统 PATH | 重新安装并勾选 "Add to PATH" |
| pip install 超时 | 默认源在国外 | 配置国内镜像（见第二节） |
| PowerShell 激活虚拟环境报错 | 执行策略限制 | `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| VS Code 找不到解释器 | 没有选择正确的解释器 | Ctrl+Shift+P → "Python: Select Interpreter" → 选 venv 中的 Python |

---

## 动手练习

### 练习一：环境验证

完成以下步骤，确认环境搭建成功：

1. 打开终端，运行 `python --version`，记录你的 Python 版本
2. 运行 `pip --version`，确认 pip 可用
3. 创建一个虚拟环境并激活它
4. 在虚拟环境中运行 `pip list`，查看默认安装了哪些包

将你的输出结果截图或复制粘贴保存。

### 练习二：安装与导入

在虚拟环境中完成以下操作：

1. 使用 pip 安装 `requests` 库
2. 创建一个新文件 `test_import.py`，内容如下：

```python
# 测试 requests 库是否安装成功
import requests

# 查看 requests 的版本
print(f"requests 版本：{requests.__version__}")

# 发送一个简单的 GET 请求
response = requests.get("https://httpbin.org/get")
print(f"状态码：{response.status_code}")
print("安装成功！")
```

3. 运行这个脚本，确认没有报错
4. 执行 `pip freeze > requirements.txt`，查看生成的文件内容

### 练习三：对比记忆

填写下面的对照表，加深 npm 和 pip 的对应关系记忆：

| npm 命令 | 对应的 pip 命令 | 作用 |
|---|---|---|
| `npm install axios` | ? | 安装一个包 |
| `npm uninstall axios` | ? | 卸载一个包 |
| `npm list` | ? | 列出所有已安装的包 |
| `package.json` | ? | 记录项目依赖 |
| `npm install` | ? | 从依赖文件安装所有包 |
| `node_modules/` | ? | 存放依赖的目录 |

---

## 常见误区

- **"装好 Python 就完事了"**：安装 Python 只是第一步。如果不配置国内镜像源，pip 下载会慢到怀疑人生；如果不创建虚拟环境，迟早会遇到依赖冲突。环境搭建是一个完整的流程，不能只做一半。
- **"虚拟环境太麻烦，全局安装就行"**：这是新手最容易踩的坑。今天你装 requests 2.28 没问题，明天另一个项目需要 requests 2.31，两个版本冲突，两个项目都跑不起来。虚拟环境不是麻烦，是保险。
- **"pip 下载慢是网络问题，忍忍就好"**：默认源在国外，国内访问速度极不稳定。配置清华镜像源只需要一条命令，一劳永逸，没必要每次都忍受龟速下载。
- **"macOS 自带 Python，直接用就行"**：macOS 自带的是 Python 2.x（或较老的 Python 3.x），版本太旧，很多新特性不支持。建议用 Homebrew 安装最新版 Python 3.10+。

---

## 工程建议

- **环境搭建一次到位**：安装 Python → 配置国内镜像源 → 安装 VS Code Python 扩展 → 配置虚拟环境模板。把这些基础工作做好，后面写代码时就不需要反复折腾环境问题。
- **养成虚拟环境的习惯**：每个 Python 项目都从 `python -m venv venv` 开始，就像每个 Node.js 项目都有独立的 `node_modules` 一样。这不是可选项，是必选项。
- **用 `requirements.txt` 管理依赖**：每次 `pip install` 新包后，及时执行 `pip freeze > requirements.txt` 更新依赖清单。这样其他人拿到你的项目时，一条命令就能装好所有依赖。
- **把 `venv/` 加入 `.gitignore`**：虚拟环境目录不应该提交到 Git 仓库，就像 `node_modules/` 不能提交一样。这是 Python 项目的基本规范。

---

## 小结

本课的核心要点：

1. **安装 Python**：前往 python.org 下载 3.10+ 版本，Windows 用户务必勾选 "Add to PATH"
2. **pip 包管理器**：Python 世界的 npm，用于安装、卸载、管理第三方库
3. **国内镜像**：配置清华镜像源，解决 pip 下载慢的问题
4. **虚拟环境**：`python -m venv venv` 创建，`source venv/bin/activate` 激活——每个项目独立隔离
5. **requirements.txt**：等同于 `package.json`，用 `pip freeze > requirements.txt` 生成
6. **VS Code + Python 扩展**：前端开发者的最佳 Python IDE 选择
7. **运行 Python**：`python script.py` 运行文件，`python` 进入交互模式

```
┌─────────────────────────────────────────────────────────────┐
│               环境搭建完成后的项目结构                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  my-spider-project/                                         │
│  ├── venv/                  (虚拟环境，不提交到 Git)          │
│  ├── .gitignore             (忽略 venv/ 等文件)              │
│  ├── requirements.txt       (项目依赖清单)                   │
│  ├── hello.py               (你的第一个脚本)                 │
│  └── ...                    (后续课程的代码)                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 下一课预告

环境搭好了，下一课我们将正式开始学习 Python 基础语法——变量、数据类型、条件判断、循环……如果你有 JavaScript 基础，会发现很多概念都是相通的，学起来会非常快。

---

## 参考答案

### 练习一

**思路**：按步骤逐一验证，确保 Python、pip、虚拟环境都正常工作。

**答案**：

```
# 1. Python 版本
$ python --version
Python 3.12.4

# 2. pip 版本
$ pip --version
pip 24.0 from C:\Users\...\pip (python 3.12)

# 3. 创建并激活虚拟环境
$ python -m venv venv
$ venv\Scripts\activate.bat    # Windows CMD
(venv) D:\my-spider-project>

# 4. 查看虚拟环境中的包
(venv) $ pip list
Package    Version
---------- -------
pip        24.0
setuptools 69.5.1
```

**要点**：
- `python --version` 输出的主版本必须是 3，次版本建议 10+
- 虚拟环境激活后终端前会出现 `(venv)` 标志
- 虚拟环境刚创建时只预装了 `pip` 和 `setuptools`，没有其他包
- 如果 PowerShell 激活报错，先执行 `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### 练习二

**思路**：实际操作 pip 安装、编写测试脚本、生成依赖文件，走完一个完整的依赖管理流程。

**答案**：

```python
# test_import.py 的内容
import requests

print(f"requests 版本：{requests.__version__}")

response = requests.get("https://httpbin.org/get")
print(f"状态码：{response.status_code}")
print("安装成功！")
```

```
# 运行结果
$ python test_import.py
requests 版本：2.31.0
状态码：200
安装成功！

# 生成依赖文件
$ pip freeze > requirements.txt
$ cat requirements.txt
certifi==2024.2.2
charset-normalizer==3.3.2
idna==3.7
requests==2.31.0
urllib3==2.2.1
```

**要点**：
- `pip install requests` 必须在虚拟环境激活状态下执行
- `requests.__version__` 用双下划线（`__version__`），不是单下划线
- `pip freeze > requirements.txt` 会导出所有依赖（包括 requests 自身的子依赖）
- 如果 `requests.get()` 报网络错误，可能是网络问题，不影响安装成功的判断

### 练习三

**思路**：将 npm 命令逐一对应到 pip 命令，理解两个包管理器的设计思路差异。

**答案**：

| npm 命令 | 对应的 pip 命令 | 作用 |
|---|---|---|
| `npm install axios` | `pip install requests` | 安装一个包 |
| `npm uninstall axios` | `pip uninstall requests` | 卸载一个包 |
| `npm list` | `pip list` | 列出所有已安装的包 |
| `package.json` | `requirements.txt` | 记录项目依赖 |
| `npm install` | `pip install -r requirements.txt` | 从依赖文件安装所有包 |
| `node_modules/` | `venv/lib/site-packages/` (或 `venv\Lib\site-packages\`) | 存放依赖的目录 |

**要点**：
- npm 的 `package.json` 可以指定版本范围（`^1.0.0`），而 `requirements.txt` 通常锁定精确版本（`==1.0.0`）
- `pip freeze` 导出的格式就是 `requirements.txt` 的格式，可以直接用
- `node_modules/` 在项目根目录，Python 的依赖在虚拟环境的 `site-packages/` 目录中
- 两者的核心理念一致：每个项目独立管理自己的依赖
