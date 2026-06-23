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


print("\n🔍 品牌风格图像批量生成流水线 - 项目验证\n")

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
check("前端组件目录存在", dir_exists("frontend/src/components"))
check("前端页面目录存在", dir_exists("frontend/src/pages"))

# ── 3. 后端结构 ──
print("\n📁 后端结构：")
check("backend/ 目录存在", dir_exists("backend"))
check("backend/app/ 目录存在", dir_exists("backend/app"))
check("后端 API 路由存在", dir_exists("backend/app/api"))
check("后端服务层存在", dir_exists("backend/app/services"))
check("requirements.txt 存在", file_exists("backend/requirements.txt"))

# ── 4. 核心服务 ──
print("\n🔧 核心服务：")
check("工作流引擎存在",
      dir_exists("backend/app/services/workflow"))
check("任务队列存在",
      dir_exists("backend/app/services/queue") or
      dir_exists("backend/app/services/task"))
check("质量控制存在",
      dir_exists("backend/app/services/quality") or
      dir_exists("backend/app/services/qc"))
check("资产存储存在",
      dir_exists("backend/app/services/storage") or
      dir_exists("backend/app/services/asset"))

# ── 5. ComfyUI 相关 ──
print("\n🎨 ComfyUI：")
check("comfyui/ 目录存在", dir_exists("comfyui"))
check("预设工作流存在", dir_exists("comfyui/workflows") or dir_exists("comfyui/workflow"))

# ── 汇总 ──
print("\n" + "─" * 50)
print(f"\n📊 结果：{passed} 通过 / {failed} 失败 / 共 {passed + failed} 项")

if failed > 0:
    print("\n⚠️  部分检查未通过，请根据上述提示修复。\n")
    sys.exit(1)
else:
    print("\n🎉 所有检查通过！项目结构完整。\n")
    sys.exit(0)
