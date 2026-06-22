# Python 脚本环境

## 场景引入

你在自己电脑上写了一个 Python 脚本，跑得好好的。发给同事，同事说跑不了——"ModuleNotFoundError: No module named 'requests'"。你让他 `pip install requests`，他说装了，但还是报错。折腾半天发现：他系统里有 Python 3.8 和 3.11 两个版本，pip 装到了 3.8，脚本用 3.11 跑的。

这是 Python 环境管理的经典问题。本课让你建立一套规范的环境管理习惯，避免"在我电脑上能跑"的尴尬。

## 学习目标

- 理解为什么需要虚拟环境
- 掌握 venv、pip、poetry 的基本用法
- 学会编写跨平台兼容的脚本
- 理解 shebang 行的作用

### 一、虚拟环境

Python 默认把所有包装到一个全局目录里。如果两个项目依赖同一个包的不同版本，就会冲突。虚拟环境为每个项目创建独立的 Python 目录，有自己的 `pip` 和 `site-packages`。

```bash
# 创建虚拟环境
python -m venv .venv

# 激活（Windows）
.venv\Scripts\activate

# 激活（macOS/Linux）
source .venv/bin/activate

# 激活后，pip 安装的包只在当前环境中
pip install requests
pip list

# 退出虚拟环境
deactivate
```

虚拟环境目录通常命名为 `.venv`，大多数工具（VS Code、PyCharm、poetry）都默认识别这个名称。

### 二、依赖管理

#### pip + requirements.txt

最基础的方案。安装包后导出依赖列表：

```bash
pip install requests click pyyaml
pip freeze > requirements.txt
pip install -r requirements.txt
```

问题：`pip freeze` 导出所有包（包括间接依赖），没有锁版本哈希。

#### poetry（推荐）

Poetry 提供完整的项目管理能力：

```bash
pip install poetry
poetry new my-script        # 创建新项目
poetry add requests click   # 添加依赖
poetry install              # 安装所有依赖
poetry run python script.py # 运行脚本
```

`pyproject.toml` 示例：

```toml
[tool.poetry]
name = "my-automation-script"
version = "0.1.0"
description = "批量文件处理脚本"
authors = ["Your Name <you@example.com>"]

[tool.poetry.dependencies]
python = "^3.10"
requests = "^2.31"
click = "^8.1"

[tool.poetry.scripts]
my-tool = "my_script.cli:main"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

| 特性 | pip + requirements.txt | poetry |
|------|----------------------|--------|
| 学习成本 | 低 | 中 |
| 锁文件 | 无 | 有 |
| 虚拟环境管理 | 手动 | 自动 |
| 推荐场景 | 简单脚本 | 正式项目 |

### 三、shebang 行

Unix/macOS 系统中，脚本第一行指定解释器路径：

```python
#!/usr/bin/env python3
"""可以直接执行的脚本。"""
import sys

def main():
    print(f"Python 版本: {sys.version}")
    print(f"脚本参数: {sys.argv[1:]}")

if __name__ == "__main__":
    main()
```

`#!/usr/bin/env python3` 比 `#!/usr/bin/python3` 更灵活，因为它在 PATH 中查找 Python，适配不同系统的安装路径。

```bash
chmod +x script.py  # 添加执行权限（Unix）
./script.py          # 直接运行
```

### 四、跨平台兼容

路径处理是最容易出问题的地方。`pathlib` 自动处理跨平台差异：

```python
from pathlib import Path
import sys

# 创建路径（自动使用正确的分隔符）
config_dir = Path.home() / ".config" / "my-app"
data_file = Path("data") / "processed" / "result.csv"

# 常用操作
print(config_dir.exists())       # 是否存在
print(data_file.suffix)          # 扩展名: .csv
print(data_file.stem)            # 文件名: result
print(data_file.parent)          # 父目录

# 遍历目录
for py_file in Path(".").glob("**/*.py"):
    print(py_file)

# 读写文件
config_file = Path("config.yaml")
config_file.write_text("key: value\n", encoding="utf-8")
content = config_file.read_text(encoding="utf-8")
```

根据操作系统执行不同逻辑：

```python
import subprocess

def open_file(filepath: str):
    """用系统默认程序打开文件。"""
    if sys.platform == "win32":
        subprocess.run(["start", filepath], shell=True)
    elif sys.platform == "darwin":
        subprocess.run(["open", filepath])
    else:
        subprocess.run(["xdg-open", filepath])

def get_config_dir() -> str:
    """获取跨平台的配置目录。"""
    app = "my-app"
    if sys.platform == "win32":
        return str(Path.home() / "AppData" / "Local" / app)
    elif sys.platform == "darwin":
        return str(Path.home() / "Library" / "Application Support" / app)
    else:
        return str(Path.home() / ".config" / app)
```

### 五、项目结构

```
my-automation/
├── pyproject.toml
├── README.md
├── .env              # 环境变量（不提交到 git）
├── .gitignore        # 忽略 .venv/、__pycache__/ 等
├── src/
│   └── my_tool/
│       ├── __init__.py
│       ├── cli.py
│       └── utils.py
└── tests/
```

## 常见误区

**误区一：全局安装依赖** — 不同项目的依赖互相冲突，甚至破坏系统 Python。

**误区二：把虚拟环境提交到 Git** — `.venv` 包含大量二进制文件，应该提交 `requirements.txt` 或 `pyproject.toml`。

**误区三：用 `sudo pip install`** — 可能覆盖系统 Python 的包，导致系统工具崩溃。

**误区四：忽略 Python 版本** — 在 `pyproject.toml` 中明确指定 `python = "^3.10"`。

## 工程建议

1. 每个项目一个虚拟环境，即使是只有 3 个文件的脚本
2. 用 poetry 管理正式项目的依赖
3. 用 `pathlib` 代替 `os.path`
4. 始终用 `#!/usr/bin/env python3`
5. 不要把 `.venv` 和 `.env` 提交到 Git

## 小结

- 虚拟环境是 Python 项目管理的基础设施
- `pip + requirements.txt` 适合简单场景，`poetry` 适合正式项目
- shebang 行 `#!/usr/bin/env python3` 让脚本可以直接执行
- `pathlib` 是处理跨平台路径的标准方案

## 练习

### 练习一：虚拟环境操作

创建一个虚拟环境，安装 `requests` 和 `click`，导出 `requirements.txt`，然后在另一个目录中重建这个环境。

### 练习二：跨平台路径

写一个函数 `get_log_dir()`，返回跨平台的日志目录路径（Windows/macOS/Linux）。

---

## 参考答案

### 练习一

**答案**：

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install requests click
pip freeze > requirements.txt

mkdir ../another-project && cd ../another-project
python -m venv .venv
source .venv/bin/activate
pip install -r ../original-project/requirements.txt
```

**要点**：`pip freeze` 会包含间接依赖，这是正常的——`requirements.txt` 的作用是完整复现环境。

### 练习二

**答案**：

```python
import sys
from pathlib import Path

def get_log_dir() -> Path:
    app_name = "my-app"
    if sys.platform == "win32":
        log_dir = Path.home() / "AppData" / "Local" / app_name / "logs"
    elif sys.platform == "darwin":
        log_dir = Path.home() / "Library" / "Logs" / app_name
    else:
        log_dir = Path.home() / ".local" / "log" / app_name

    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir
```

**要点**：`mkdir(parents=True, exist_ok=True)` 确保目录存在，类似 `mkdir -p`。
