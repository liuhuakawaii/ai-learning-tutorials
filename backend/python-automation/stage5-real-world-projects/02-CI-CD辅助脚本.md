# CI/CD 辅助脚本

## 场景引入

项目准备部署到服务器。手动流程：SSH 登录 → 拉代码 → 装依赖 → 重启服务。每次发版都重复，而且经常忘步骤——上次忘了运行数据库迁移，导致线上报错。

CI/CD 辅助脚本的目标是**把构建、测试、部署自动化**，让每次发布可重复、可追溯、可回滚。

## 学习目标

- 掌握构建脚本的编写（版本号管理、编译打包）
- 学会通过 SSH 和 Docker 实现自动化部署
- 理解回滚机制的实现方式
- 了解 GitHub Actions 的基本配置

## 版本号管理

语义化版本号格式为 `MAJOR.MINOR.PATCH`：

```python
# version_manager.py
import json, subprocess
from pathlib import Path
from datetime import datetime

VERSION_FILE = Path("version.json")


def load_version() -> dict:
    if VERSION_FILE.exists():
        return json.loads(VERSION_FILE.read_text(encoding="utf-8"))
    return {"major": 0, "minor": 1, "patch": 0}


def save_version(v: dict):
    VERSION_FILE.write_text(json.dumps(v, indent=2), encoding="utf-8")


def bump(v: dict, level: str) -> dict:
    v["patch" if level == "patch" else level] += 1
    if level == "major":
        v["minor"] = v["patch"] = 0
    elif level == "minor":
        v["patch"] = 0
    return v


def to_string(v: dict) -> str:
    return f"{v['major']}.{v['minor']}.{v['patch']}"


def get_git_hash() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, check=True
        ).stdout.strip()
    except Exception:
        return "unknown"


if __name__ == "__main__":
    import sys
    level = sys.argv[1] if len(sys.argv) > 1 else "patch"
    v = bump(load_version(), level)
    save_version(v)
    print(f"版本更新: {to_string(v)}")
```

## 构建脚本

```python
# build.py
import subprocess, shutil, zipfile
from pathlib import Path
from datetime import datetime
from version_manager import load_version, to_string

def clean():
    for d in [Path("build"), Path("dist")]:
        if d.exists(): shutil.rmtree(d)
        d.mkdir(parents=True)

def run_tests() -> bool:
    return subprocess.run(["python", "-m", "pytest", "tests/", "-v"]).returncode == 0

def create_package() -> Path:
    version = to_string(load_version())
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = Path("dist") / f"myproject-{version}-{ts}.zip"
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in Path("src").rglob("*"):
            if f.is_file() and f.suffix != ".pyc":
                zf.write(f, f.relative_to(Path("src").parent))
    print(f"✓ 发布包: {path}")
    return path

def build(skip_tests=False):
    clean()
    if not skip_tests and not run_tests(): print("✗ 测试失败"); return False
    create_package(); print("✓ 构建完成"); return True
```

## SSH 远程部署

```python
# deploy_ssh.py
import subprocess, sys
from pathlib import Path

CONFIG = {"host": "deploy@example.com", "port": 22,
          "remote_path": "/opt/myproject", "service": "myproject"}

def run_ssh(cmd: str):
    full = ["ssh", "-p", str(CONFIG["port"]), CONFIG["host"], cmd]
    print(f"  → {cmd}")
    r = subprocess.run(full, capture_output=True, text=True)
    if r.returncode != 0: print(f"  ✗ {r.stderr}"); sys.exit(1)
    return r

def deploy(package: Path):
    remote, svc = CONFIG["remote_path"], CONFIG["service"]
    print("备份当前版本...")
    run_ssh(f"cd {remote} && cp -r current backup_$(date +%Y%m%d%H%M%S)")
    print("上传...")
    subprocess.run(["scp", "-P", str(CONFIG["port"]),
                    str(package), f"{CONFIG['host']}:{remote}/"], check=True)
    run_ssh(f"cd {remote} && unzip -o {package.name} -d current")
    run_ssh(f"cd {remote}/current && venv/bin/pip install -r requirements.txt")
    run_ssh(f"sudo systemctl restart {svc}")
    result = run_ssh(f"systemctl is-active {svc}")
    if result.stdout.strip() == "active": print("✓ 部署成功")
    else: print("✗ 服务未正常启动"); sys.exit(1)
```

## Docker 部署

```python
# deploy_docker.py
import subprocess
from version_manager import load_version, to_string

IMAGE, CONTAINER = "myproject", "myproject-app"

def deploy():
    version = to_string(load_version())
    tag = f"{IMAGE}:{version}"
    subprocess.run(["docker", "build", "-t", tag, "-t", f"{IMAGE}:latest", "."], check=True)
    subprocess.run(["docker", "stop", CONTAINER], capture_output=True)
    subprocess.run(["docker", "rm", CONTAINER], capture_output=True)
    subprocess.run(["docker", "run", "-d", "--name", CONTAINER,
                    "--restart", "unless-stopped", "-p", "8000:8000", tag], check=True)
    print(f"✓ 容器已启动: {tag}")
```

## 回滚脚本

```python
# rollback.py
import subprocess, sys

HOST = "deploy@example.com"
REMOTE = "/opt/myproject"


def rollback():
    backups = subprocess.run(
        ["ssh", HOST, f"ls -d {REMOTE}/backup_*"],
        capture_output=True, text=True
    ).stdout.strip().split("\n")

    if not backups or not backups[0]:
        print("没有可用备份"); sys.exit(1)

    latest = sorted(backups, reverse=True)[0]
    print(f"回滚到: {latest}")

    subprocess.run(["ssh", HOST,
        f"cd {REMOTE} && rm -rf current && cp -r {latest} current && "
        f"sudo systemctl restart myproject"
    ], check=True)
    print("✓ 回滚完成")
```

## GitHub Actions 集成

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: pytest tests/ -v --cov=src

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        env:
          SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_KEY" > ~/.ssh/id_rsa && chmod 600 ~/.ssh/id_rsa
          python scripts/build.py
          python scripts/deploy_ssh.py dist/*.zip
```

## 常见误区

1. **硬编码密码**：敏感信息应通过环境变量或 secrets 管理
2. **没有回滚机制**：部署失败无法快速恢复
3. **跳过测试直接部署**：图省事把 bug 推到生产环境
4. **脚本无错误处理**：某步失败继续执行，导致半成品状态
5. **无日志记录**：出问题后无法追溯

## 工程建议

- 部署脚本必须有错误处理，任何步骤失败都应立即停止
- 使用环境变量管理配置，同一套脚本适配多环境
- 保留部署日志和构建产物，方便问题排查
- 生产环境部署设置人工审批环节

## 小结

本课学习了 CI/CD 辅助脚本的编写：版本号管理、构建打包、SSH/Docker 部署、回滚机制和 GitHub Actions 集成。自动化部署的核心是**可重复、可追溯、可回滚**。

## 练习

### 练习一：版本号管理

扩展 `version_manager.py`：支持预发布版本号（如 `1.0.0-alpha.1`），从 Git tag 读取版本号，生成 CHANGELOG 条目。

### 练习二：部署脚本

编写部署脚本：支持配置文件指定服务器、部署前自动测试、部署后 HTTP 健康检查、失败自动回滚。

---

## 参考答案

### 练习一

**思路**：增加 `prerelease` 字段，通过 `git describe` 读取 tag。

```python
import subprocess, json, yaml, requests, sys
from pathlib import Path
from datetime import datetime

def to_string(v: dict) -> str:
    base = f"{v['major']}.{v['minor']}.{v['patch']}"
    pre = v.get("prerelease")
    return f"{base}-{pre}" if pre else base

def bump_prerelease(v: dict, label="alpha") -> dict:
    current = v.get("prerelease", "")
    if current and current.startswith(label):
        parts = current.rsplit(".", 1)
        n = int(parts[1]) + 1 if len(parts) == 2 and parts[1].isdigit() else 1
        v["prerelease"] = f"{label}.{n}"
    else:
        v["prerelease"] = f"{label}.1"
    return v

def read_version_from_tag() -> str:
    try:
        r = subprocess.run(["git", "describe", "--tags", "--abbrev=0"],
                           capture_output=True, text=True, check=True)
        return r.stdout.strip().lstrip("v")
    except Exception: return None

def generate_changelog(v: dict) -> str:
    entry = f"## {to_string(v)} ({datetime.now():%Y-%m-%d})\n\n"
    try:
        r = subprocess.run(["git", "log", "--oneline", "HEAD~10..HEAD"],
                           capture_output=True, text=True, check=True)
        for line in r.stdout.strip().split("\n"):
            if line: entry += f"- {line}\n"
    except Exception: entry += "- (无法获取提交记录)\n"
    return entry
```

**要点**：预发布用 `label.N` 格式递增，Git tag 以 `v` 开头需去掉。

### 练习二

**思路**：YAML 配置服务器信息，requests 做健康检查，失败时回滚。

```python
def load_config(path="deploy.yaml") -> dict:
    with open(path, encoding="utf-8") as f: return yaml.safe_load(f)

def health_check(url: str, retries=5) -> bool:
    for i in range(retries):
        try:
            if requests.get(url, timeout=10).status_code == 200: return True
        except requests.RequestException: pass
    return False

def rollback(host: str, remote: str, svc: str):
    subprocess.run(["ssh", host,
        f"cd {remote} && rm -rf current && mv $(ls -d backup_* | tail -1) current && "
        f"sudo systemctl restart {svc}"], check=True)
    print("✓ 回滚完成")


def main(config_path: str, package: str):
    cfg = load_config(config_path)
    host, remote, svc = cfg["host"], cfg["remote_path"], cfg["service_name"]

    if subprocess.run(cfg.get("test_command", "pytest").split()).returncode != 0:
        print("✗ 测试失败"); sys.exit(1)

    subprocess.run(["ssh", host, f"cd {remote} && cp -r current backup_$(date +%Y%m%d%H%M%S)"], check=True)
    subprocess.run(["scp", package, f"{host}:{remote}/"], check=True)
    subprocess.run(["ssh", host, f"cd {remote} && unzip -o {package} -d current"], check=True)
    subprocess.run(["ssh", host, f"sudo systemctl restart {svc}"], check=True)

    if not health_check(cfg["health_url"]):
        print("✗ 健康检查失败，回滚")
        rollback(host, remote, svc)
        sys.exit(1)
    print("✓ 部署成功")
```

**要点**：健康检查带重试，任何阶段失败都考虑回滚路径。
