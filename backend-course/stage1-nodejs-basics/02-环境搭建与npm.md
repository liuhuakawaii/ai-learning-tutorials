# 第二课：环境搭建与 npm

## 学习目标

完成本课学习后，你将能够：

1. 在 Windows 和 Mac 上安装 Node.js
2. 使用 nvm 管理多个 Node.js 版本
3. 理解 npm 的本质和工作原理
4. 掌握 package.json 的每个字段含义
5. 熟练使用常用 npm 命令
6. 理解 npx 的用途和优势

---

## 一、安装 Node.js

### 1.1 官方安装（推荐新手）

#### Windows 安装步骤

```
步骤 1：访问官网
  → https://nodejs.org
  → 选择 LTS（长期支持）版本
  → 点击 Windows Installer (.msi)

步骤 2：运行安装程序
  → 双击下载的 .msi 文件
  → 点击 "Next" 接受许可协议
  → 选择安装路径（建议保持默认）
  → 保持默认组件（会自动安装 npm）
  → 勾选 "Automatically install the necessary tools"
  → 点击 "Install"

步骤 3：验证安装
  → 打开命令提示符（Win + R → cmd → 回车）
  → 输入以下命令：
```

```bash
node -v
# 输出类似：v20.11.0

npm -v
# 输出类似：10.2.4
```

#### Mac 安装步骤

```
方式一：官方安装包（简单）
  → https://nodejs.org
  → 下载 macOS Installer (.pkg)
  → 双击运行，按提示安装

方式二：使用 Homebrew（推荐）
  → 打开终端
  → 运行命令：
```

```bash
# 安装 Homebrew（如果没有的话）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Node.js
brew install node

# 验证
node -v
npm -v
```

### 1.2 使用 nvm 管理版本（推荐）

**nvm（Node Version Manager）** 是 Node.js 的版本管理工具。它允许你在同一台电脑上安装和切换多个 Node.js 版本。

#### 为什么需要 nvm

```
场景：你有两个项目
  项目 A：需要 Node.js 16（旧项目，依赖不支持新版本）
  项目 B：需要 Node.js 20（新项目，用最新特性）

没有 nvm：
  → 只能安装一个版本
  → 切换版本需要卸载重装

有 nvm：
  → 同时安装多个版本
  → 一条命令切换版本
```

#### Windows 安装 nvm-windows

```bash
# Windows 使用 nvm-windows
# 下载地址：https://github.com/coreybutler/nvm-windows/releases
# 下载 nvm-setup.exe 并安装

# 安装后重启终端，验证：
nvm version

# 常用命令：
nvm list                  # 查看已安装的版本
nvm list available        # 查看可安装的版本
nvm install 20            # 安装 Node.js 20.x
nvm install 18            # 安装 Node.js 18.x
nvm use 20               # 切换到 Node.js 20
nvm use 18               # 切换到 Node.js 18
node -v                   # 验证当前版本
```

#### Mac/Linux 安装 nvm

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 重启终端，或运行：
source ~/.bashrc   # 如果用 bash
source ~/.zshrc    # 如果用 zsh

# 验证安装
nvm --version

# 常用命令
nvm install --lts          # 安装最新 LTS 版本
nvm install 20             # 安装 Node.js 20
nvm use 20                 # 切换到 Node.js 20
nvm alias default 20       # 设置默认版本
nvm ls                     # 列出已安装版本
```

### 1.3 验证安装

```bash
# 打开终端，运行以下命令验证

# 检查 Node.js 版本
node -v
# 期望输出：v20.x.x 或 v18.x.x

# 检查 npm 版本
npm -v
# 期望输出：10.x.x 或 9.x.x

# 检查 Node.js 安装路径
which node        # Mac/Linux
where node        # Windows

# 进入 REPL 测试
node
> console.log('Hello Node.js!')
Hello Node.js!
> process.version
'v20.11.0'
> .exit
```

---

## 二、npm 是什么

### 2.1 包管理器的概念

**npm（Node Package Manager）** 是 Node.js 的包管理器。

#### 类比：App Store

```
手机 App Store：
  ├── 你需要一个计算器 → 搜索 → 安装 → 使用
  ├── 你需要一个天气 app → 搜索 → 安装 → 使用
  └── 更新已安装的 app → 一键更新

npm（代码的 App Store）：
  ├── 你需要日期处理 → npm install dayjs → 使用
  ├── 你需要 HTTP 请求 → npm install axios → 使用
  └── 更新依赖包 → npm update
```

### 2.2 npm 的组成

```
npm 包含三个部分：

1. npm Registry（注册中心）
   → 一个巨大的在线数据库，存储了数百万个开源包
   → 地址：https://registry.npmjs.org
   → 类比：App Store 的服务器

2. npm CLI（命令行工具）
   → 你在终端使用的 npm 命令
   → npm install、npm run 等
   → 类比：App Store 应用本身

3. npm Website（网站）
   → https://www.npmjs.com
   → 搜索和浏览包
   → 类比：App Store 的网页版
```

### 2.3 你已经用过 npm 了

```bash
# 作为前端开发者，这些命令你一定用过：

npm install            # 安装项目依赖
npm install react      # 安装 React
npm run dev            # 启动开发服务器
npm run build          # 构建生产版本

# 现在，让我们深入理解它们背后的原理
```

---

## 三、package.json 详解

### 3.1 什么是 package.json

**package.json** 是 Node.js 项目的"身份证"，它记录了项目的所有元信息。

```bash
# 创建一个新的 package.json
mkdir my-blog-api
cd my-blog-api
npm init

# 或者使用默认值快速创建
npm init -y
```

### 3.2 package.json 的每个字段

```json
{
  "name": "my-blog-api",
  "version": "1.0.0",
  "description": "一个博客平台的后端 API",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest"
  },
  "keywords": ["blog", "api", "nodejs", "express"],
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.6.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.7.0"
  }
}
```

### 3.3 字段详解

```
字段               含义                              类比
─────────────────────────────────────────────────────────────────
name              包名（在 npm 上的唯一标识）          App 的名称
version           版本号（遵循语义化版本）              App 版本号
description       项目描述                            App 的简介
main              入口文件（被 require 时的入口）       App 的启动页
scripts           自定义命令                           App 的快捷操作
keywords          关键词（便于搜索）                    App 的标签
author            作者信息                             App 开发者
license           开源许可证                           使用条款
dependencies      生产依赖                             App 运行必需的库
devDependencies   开发依赖（只在开发时需要）             开发工具（不打包到生产）
engines           要求的 Node.js 版本                   App 要求的系统版本
```

### 3.4 语义化版本（SemVer）

```
版本号格式：主版本.次版本.补丁版本
           MAJOR.MINOR.PATCH

  1.0.0  →  初始版本
  1.0.1  →  修复了一个 bug（补丁）
  1.1.0  →  添加了新功能（次版本，向后兼容）
  2.0.0  →  有破坏性更新（主版本）

版本范围符号：
  ^1.0.0  →  允许 1.x.x 的最新版本（推荐）
  ~1.0.0  →  允许 1.0.x 的最新版本
  1.0.0   →  锁定精确版本
  >=1.0.0 →  大于等于 1.0.0
  *       →  最新版本

示例：
  "express": "^4.18.2"
  → 可以安装 4.18.2、4.18.3、4.19.0、4.99.99
  → 不能安装 5.0.0（主版本变了，可能有破坏性更新）
```

---

## 四、npm install 的工作原理

### 4.1 执行 npm install 时发生了什么

```
你输入 npm install
        │
        ▼
┌──────────────────────────────────────────────┐
│ 步骤 1：读取 package.json                      │
│ → 找到 dependencies 和 devDependencies         │
└──────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────┐
│ 步骤 2：检查 package-lock.json                 │
│ → 如果存在，使用锁定的版本                      │
│ → 如果不存在，从 registry 获取最新兼容版本       │
└──────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────┐
│ 步骤 3：解析依赖树                              │
│ → A 依赖 B 和 C                                │
│ → B 依赖 D                                     │
│ → C 也依赖 D（可能不同版本）                    │
│ → 构建完整的依赖树                              │
└──────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────┐
│ 步骤 4：下载包                                  │
│ → 从 npm registry 下载压缩包                    │
│ → 解压到 node_modules 目录                      │
└──────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────┐
│ 步骤 5：生成/更新 package-lock.json             │
│ → 记录所有包的精确版本                          │
│ → 确保团队成员安装完全相同的依赖                 │
└──────────────────────────────────────────────┘
```

### 4.2 node_modules 目录

```
node_modules 是什么：
  → 所有依赖包安装的位置
  → 每个包都是一个文件夹
  → 包的依赖也会安装在这里（嵌套或扁平化）

my-blog-api/
├── package.json
├── package-lock.json
├── index.js
└── node_modules/          ← 不要手动修改！
    ├── express/
    │   ├── package.json
    │   ├── index.js
    │   └── node_modules/  ← express 的依赖
    │       ├── body-parser/
    │       └── ...
    ├── lodash/
    ├── axios/
    └── ...                ← 可能有几百个文件夹

⚠️ 重要提示：
  - node_modules 可能非常大（几百 MB）
  - 永远不要提交到 Git
  - 在 .gitignore 中添加 node_modules
```

### 4.3 package-lock.json

```
package-lock.json 的作用：

没有 lock 文件（问题）：
  开发者 A：npm install → express@4.18.2
  开发者 B：npm install → express@4.18.5（几天后，新版本发布了）
  → 两人的依赖版本不一致！可能导致 bug

有 lock 文件（解决）：
  开发者 A：npm install → express@4.18.2 → 记录到 lock 文件
  开发者 B：npm install → 读取 lock 文件 → express@4.18.2
  → 两人的依赖版本完全一致！

建议：
  - lock 文件一定要提交到 Git
  - 生产环境部署时使用 npm ci（而不是 npm install）
```

### 4.4 依赖类型

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.6.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.7.0",
    "eslint": "^8.50.0"
  }
}
```

```
dependencies vs devDependencies：

dependencies（生产依赖）：
  → 项目运行时需要的包
  → 例：express（Web 框架）、mongoose（数据库驱动）
  → 部署到服务器时必须安装
  → npm install --production 只安装这类

devDependencies（开发依赖）：
  → 只在开发时需要的包
  → 例：nodemon（自动重启）、jest（测试框架）、eslint（代码检查）
  → 部署到服务器时不需要
  → npm install 会安装所有依赖

如何区分：
  → 这个包在生产环境运行时需要吗？
  → 是 → dependencies
  → 否（只是开发工具）→ devDependencies
```

---

## 五、常用 npm 命令

### 5.1 项目初始化

```bash
# 交互式初始化（会问你一系列问题）
npm init

# 使用默认值快速初始化
npm init -y

# 初始化后的目录结构
my-project/
├── package.json    ← 这就是 npm init 的产物
└── node_modules/   ← 还没有，需要 npm install
```

### 5.2 安装依赖

```bash
# 安装单个包（添加到 dependencies）
npm install express
npm i express              # 简写

# 安装单个包（添加到 devDependencies）
npm install nodemon --save-dev
npm i nodemon -D           # 简写

# 安装指定版本
npm install express@4.18.2

# 安装所有依赖（根据 package.json）
npm install
npm i                      # 简写

# 全局安装（不推荐，除非是 CLI 工具）
npm install -g nodemon
```

### 5.3 卸载依赖

```bash
# 卸载包
npm uninstall express
npm rm express             # 简写
npm un express             # 简写

# 卸载全局包
npm uninstall -g nodemon
```

### 5.4 更新依赖

```bash
# 查看过期的包
npm outdated

# 更新到最新兼容版本
npm update

# 更新单个包
npm update express

# 更新到最新版本（可能有破坏性更新）
npm install express@latest
```

### 5.5 运行脚本

```bash
# package.json 中定义的 scripts
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest",
    "lint": "eslint src/"
  }
}

# 运行脚本
npm run start      # 运行 "start" 脚本
npm start          # start 是特殊命令，可以省略 run
npm run dev        # 运行 "dev" 脚本
npm test           # test 也是特殊命令
npm run lint       # 运行 "lint" 脚本
npm run build      # 运行 "build" 脚本

# 列出所有可用脚本
npm run
```

### 5.6 查看信息

```bash
# 查看包的信息
npm info express
npm view express

# 查看已安装的包
npm list                # 当前项目的依赖
npm list --depth=0      # 只显示直接依赖
npm list -g             # 全局安装的包

# 查看包的安装路径
npm root
npm root -g
```

### 5.7 清理缓存

```bash
# 查看缓存大小
npm cache ls

# 清理缓存（遇到安装问题时可以尝试）
npm cache clean --force
```

---

## 六、npx 的用途

### 6.1 npx 是什么

**npx** 是 npm 5.2+ 自带的包执行工具，它可以执行 npm 包中的命令，而不需要全局安装。

### 6.2 没有 npx 的世界

```bash
# 以前，要使用 create-react-app，需要先全局安装
npm install -g create-react-app    # 全局安装
create-react-app my-app            # 然后才能使用

# 问题：
# 1. 全局安装占用空间
# 2. 不同项目可能需要不同版本
# 3. 容易忘记更新
```

### 6.3 有了 npx

```bash
# 现在，可以直接用 npx 执行
npx create-react-app my-app

# npx 做了什么：
# 1. 临时下载 create-react-app
# 2. 执行它
# 3. 执行完后删除（或缓存）

# 优势：
# - 不需要全局安装
# - 每次执行都是最新版本
# - 不占用全局空间
```

### 6.4 npx 的常见用途

```bash
# 创建项目
npx create-react-app my-app
npx create-next-app my-app
npx create-vite my-app --template react

# 运行一次性命令
npx eslint src/          # 临时运行 ESLint
npx jest                 # 临时运行 Jest
npx prettier --write .   # 临时运行 Prettier

# 使用特定版本的包
npx node@16 -v           # 用 Node.js 16 运行
npx typescript@4 tsc     # 用 TypeScript 4 编译

# 执行本地安装的包
# 如果项目本地安装了 eslint，可以直接：
npx eslint src/
# 而不需要 ./node_modules/.bin/eslint src/
```

### 6.5 npx vs npm

```
npm：
  → 管理包（安装、卸载、更新）
  → 运行 package.json 中的脚本
  → npm install、npm run、npm publish

npx：
  → 执行包中的命令
  → 不需要安装就能使用
  → npx create-react-app、npx eslint

记忆口诀：
  npm 管理包，npx 用包
```

---

## 七、实战：初始化博客 API 项目

让我们把学到的知识付诸实践，初始化我们的博客 API 项目。

### 7.1 创建项目

```bash
# 创建项目目录
mkdir blog-api
cd blog-api

# 初始化 package.json
npm init -y
```

### 7.2 修改 package.json

```json
{
  "name": "blog-api",
  "version": "1.0.0",
  "description": "博客平台后端 API - 课程实战项目",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["blog", "api", "nodejs", "express"],
  "author": "Your Name",
  "license": "MIT"
}
```

### 7.3 安装依赖

```bash
# 安装生产依赖
npm install express

# 安装开发依赖
npm install nodemon -D
```

### 7.4 创建项目结构

```bash
# 创建目录
mkdir src
mkdir src/routes
mkdir src/controllers
mkdir src/middleware

# 创建入口文件
touch src/index.js
```

### 7.5 编写第一个文件

```javascript
// src/index.js
const express = require('express');

const app = express();
const PORT = 3000;

// 中间件：解析 JSON 请求体
app.use(express.json());

// 测试路由
app.get('/', (req, res) => {
    res.json({
        message: '博客 API 服务已启动！',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
});
```

### 7.6 配置 nodemon

创建 `nodemon.json`：

```json
{
  "watch": ["src"],
  "ext": "js,json",
  "ignore": ["node_modules"],
  "delay": "1000"
}
```

### 7.7 运行项目

```bash
# 开发模式（自动重启）
npm run dev

# 你应该看到：
# [nodemon] starting `node src/index.js`
# 服务器运行在 http://localhost:3000
# 环境: development

# 测试：在浏览器访问 http://localhost:3000
# 或者用 curl：
curl http://localhost:3000
# 输出：{"message":"博客 API 服务已启动！","version":"1.0.0","timestamp":"..."}
```

### 7.8 完整的项目结构

```
blog-api/
├── package.json           ← 项目配置
├── package-lock.json      ← 依赖锁定（自动生成）
├── nodemon.json           ← nodemon 配置
├── .gitignore             ← Git 忽略文件
├── node_modules/          ← 依赖包（自动生成，不要提交到 Git）
└── src/
    ├── index.js           ← 入口文件
    ├── routes/            ← 路由文件（后续课程创建）
    ├── controllers/       ← 控制器（后续课程创建）
    └── middleware/        ← 中间件（后续课程创建）
```

### 7.9 创建 .gitignore

```
# .gitignore
node_modules/
.env
*.log
.DS_Store
dist/
coverage/
```

---

## 八、npm 配置与镜像

### 8.1 使用国内镜像（如果你在国内）

```bash
# 查看当前 registry
npm config get registry

# 设置淘宝镜像
npm config set registry https://registry.npmmirror.com

# 恢复默认
npm config set registry https://registry.npmjs.org

# 或者使用 nrm（registry 管理工具）
npm install -g nrm
nrm ls                    # 列出所有镜像
nrm use taobao            # 切换到淘宝镜像
nrm use npm               # 切换回官方镜像
```

### 8.2 .npmrc 文件

```bash
# 项目级配置文件 .npmrc
# 放在项目根目录

# 设置镜像
registry=https://registry.npmmirror.com

# 设置私有 registry（企业开发常用）
# @mycompany:registry=https://npm.mycompany.com
```

---

## 九、动手练习

### 练习 1：创建并理解 package.json

```bash
# 1. 创建一个新目录
mkdir my-npm-practice
cd my-npm-practice

# 2. 初始化 package.json
npm init

# 3. 回答以下问题（npm 会问你）：
#    - name: 项目名称
#    - version: 版本号
#    - description: 描述
#    - entry point: 入口文件
#    - test command: 测试命令
#    - git repository: Git 仓库
#    - keywords: 关键词
#    - author: 作者
#    - license: 许可证

# 4. 查看生成的 package.json
cat package.json

# 5. 安装一个包
npm install lodash

# 6. 观察变化
cat package.json       # 看 dependencies
ls node_modules/       # 看安装了什么
cat package-lock.json  # 看锁定文件
```

### 练习 2：npm scripts

```javascript
// 创建 index.js
console.log('Hello from npm scripts!');
console.log('当前时间:', new Date().toLocaleString());
console.log('Node.js 版本:', process.version);
```

```json
// package.json 中添加 scripts
{
  "scripts": {
    "start": "node index.js",
    "greet": "node -e \"console.log('你好，npm！')\"",
    "info": "node -e \"console.log(process.env)\""
  }
}
```

```bash
npm run start
npm run greet
npm run info
```

### 练习 3：使用 npx

```bash
# 使用 npx 创建一个 React 项目（不需要全局安装 create-react-app）
npx create-react-app my-react-app

# 使用 npx 运行一次性脚本
npx cowsay "Hello Node.js!"

# 查看某个包的信息
npx npm-info express
```

---

## 十、小结

```
本课核心知识点：

✅ Node.js 安装（官方安装包 / nvm 版本管理）
✅ npm = Node.js 的包管理器，类似"代码的 App Store"
✅ package.json 是项目的"身份证"，记录元信息和依赖
✅ 语义化版本：主版本.次版本.补丁版本
✅ npm install 会下载依赖到 node_modules，生成 package-lock.json
✅ dependencies 是生产依赖，devDependencies 是开发依赖
✅ npm scripts 可以定义自定义命令
✅ npx 可以执行包命令而不需要全局安装
✅ 使用国内镜像加速下载

实战成果：
  我们已经初始化了博客 API 项目，安装了 Express 和 nodemon。

下一课预告：
  我们将深入学习 JavaScript 在服务端的表现——模块系统、全局对象、Buffer 等。
```

---

> **给前端开发者的话：** npm 你已经很熟悉了，但作为后端开发者，你需要更深入地理解它。记住：package.json 是项目的灵魂，node_modules 是它的身体，package-lock.json 是它的记忆。三者缺一不可。
