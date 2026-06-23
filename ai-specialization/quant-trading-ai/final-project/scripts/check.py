import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
passed = 0
failed = 0


def check(description: str, condition: bool):
    global passed, failed
    if condition:
        print(f"  ✅ {description}")
        passed += 1
    else:
        print(f"  ❌ {description}")
        failed += 1


def file_exists(rel: str) -> bool:
    return (ROOT / rel).is_file()


def dir_exists(rel: str) -> bool:
    return (ROOT / rel).is_dir()


def file_contains(rel: str, pattern: str) -> bool:
    p = ROOT / rel
    if not p.is_file():
        return False
    content = p.read_text(encoding="utf-8")
    return pattern in content


print("\n🔍 量化回测系统 - 项目验证\n")

# ── 1. 项目基础文件 ──
print("📁 项目基础文件：")
check("README.md 存在", file_exists("README.md"))
check("docker-compose.yml 存在", file_exists("docker-compose.yml"))
check(".env.example 存在", file_exists(".env.example"))

# ── 2. 前端结构 ──
print("\n📁 前端结构：")
check("frontend/ 目录存在", dir_exists("frontend"))
check("frontend/package.json 存在", file_exists("frontend/package.json"))
check("frontend/src/ 目录存在", dir_exists("frontend/src"))

# ── 3. 后端结构 ──
print("\n📁 后端结构：")
check("backend/ 目录存在", dir_exists("backend"))
check("backend/app/ 目录存在", dir_exists("backend/app"))
check("后端 API 路由存在", dir_exists("backend/app/api"))
check("后端服务层存在", dir_exists("backend/app/services"))
check("requirements.txt 存在", file_exists("backend/requirements.txt"))

# ── 4. 核心引擎 ──
print("\n⚙️ 核心引擎：")
check("数据引擎存在",
      dir_exists("backend/app/services/data") or
      dir_exists("backend/app/services/dataengine"))
check("因子引擎存在",
      dir_exists("backend/app/services/factor") or
      dir_exists("backend/app/services/factor_engine"))
check("回测引擎存在",
      dir_exists("backend/app/services/backtest") or
      dir_exists("backend/app/services/backtest_engine"))
check("风控引擎存在",
      dir_exists("backend/app/services/risk") or
      dir_exists("backend/app/services/risk_engine"))

# ── 5. 策略 ──
print("\n📊 策略：")
check("strategies/ 目录存在", dir_exists("strategies"))

# ── 汇总 ──
print("\n" + "─" * 50)
print(f"\n📊 结果：{passed} 通过 / {failed} 失败 / 共 {passed + failed} 项")

if failed > 0:
    print("\n⚠️  部分检查未通过，请根据上述提示修复。\n")
    sys.exit(1)
else:
    print("\n🎉 所有检查通过！项目结构完整。\n")
    sys.exit(0)
