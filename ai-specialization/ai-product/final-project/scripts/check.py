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


print("\n🔍 AI 产品完整上线流程 - 项目验证\n")

# ── 1. 项目基础文件 ──
print("📁 项目基础文件：")
check("README.md 存在", file_exists("README.md"))
check("docker-compose.yml 存在", file_exists("docker-compose.yml"))
check(".env.example 存在", file_exists(".env.example"))

# ── 2. 产品文档 ──
print("\n📝 产品文档：")
check("docs/ 目录存在", dir_exists("docs"))
check("需求文档存在", file_exists("docs/requirements.md"))
check("竞品分析存在", file_exists("docs/competitors.md"))
check("原型说明存在", file_exists("docs/prototype.md"))
check("上线复盘存在", file_exists("docs/retrospective.md"))

# ── 3. 前端结构 ──
print("\n📁 前端结构：")
check("frontend/ 目录存在", dir_exists("frontend"))
check("frontend/src/ 目录存在", dir_exists("frontend/src"))

# ── 4. 后端结构 ──
print("\n📁 后端结构：")
check("backend/ 目录存在", dir_exists("backend"))
check("backend/src/ 或 backend/app/ 存在",
      dir_exists("backend/src") or dir_exists("backend/app"))

# ── 5. Prompt 管理 ──
print("\n🤖 AI 工程：")
check("prompts/ 目录存在", dir_exists("prompts"))
check("Prompt 评估用例存在", dir_exists("prompts/eval") or dir_exists("prompts/evaluation"))

# ── 汇总 ──
print("\n" + "─" * 50)
print(f"\n📊 结果：{passed} 通过 / {failed} 失败 / 共 {passed + failed} 项")

if failed > 0:
    print("\n⚠️  部分检查未通过，请根据上述提示修复。\n")
    sys.exit(1)
else:
    print("\n🎉 所有检查通过！项目结构完整。\n")
    sys.exit(0)
