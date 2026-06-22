"""RAG Production Kit - Environment Check Script

运行此脚本检查开发环境是否满足要求。
"""

import sys
import subprocess
import importlib
from pathlib import Path


def check_python_version():
    """检查 Python 版本"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 12):
        print(f"[FAIL] Python {version.major}.{version.minor} (需要 3.12+)")
        return False
    print(f"[OK] Python {version.major}.{version.minor}.{version.micro}")
    return True


def check_package(package_name: str, min_version: str = None) -> bool:
    """检查包是否安装"""
    try:
        mod = importlib.import_module(package_name)
        version = getattr(mod, "__version__", "unknown")
        print(f"[OK] {package_name} ({version})")
        return True
    except ImportError:
        print(f"[FAIL] {package_name} 未安装")
        return False


def check_env_vars():
    """检查环境变量"""
    from pathlib import Path
    env_file = Path(__file__).parent.parent / ".env"
    if not env_file.exists():
        print("[WARN] .env 文件不存在，请复制 .env.example 并填写配置")
        return False

    from dotenv import load_dotenv
    load_dotenv(env_file)

    import os
    required_vars = ["OPENAI_API_KEY"]
    all_ok = True
    for var in required_vars:
        if os.getenv(var):
            print(f"[OK] 环境变量 {var} 已设置")
        else:
            print(f"[WARN] 环境变量 {var} 未设置")
            all_ok = False
    return all_ok


def check_directories():
    """检查目录结构"""
    base = Path(__file__).parent.parent
    required_dirs = ["src", "data", "reports", "scripts"]
    all_ok = True
    for d in required_dirs:
        path = base / d
        if path.exists():
            print(f"[OK] 目录 {d}/ 存在")
        else:
            print(f"[FAIL] 目录 {d}/ 不存在")
            all_ok = False
    return all_ok


def main():
    """运行所有检查"""
    print("=" * 50)
    print("RAG Production Kit - 环境检查")
    print("=" * 50)

    results = []

    # Python 版本
    print("\n[Python 版本]")
    results.append(check_python_version())

    # 核心依赖
    print("\n[核心依赖]")
    core_packages = [
        "langchain",
        "openai",
        "fastapi",
        "pydantic",
        "qdrant_client",
        "redis",
        "ragas",
    ]
    for pkg in core_packages:
        results.append(check_package(pkg))

    # 环境变量
    print("\n[环境变量]")
    results.append(check_env_vars())

    # 目录结构
    print("\n[目录结构]")
    results.append(check_directories())

    # 总结
    print("\n" + "=" * 50)
    passed = sum(results)
    total = len(results)
    if all(results):
        print(f"全部通过 ({passed}/{total})")
        print("环境就绪，可以开始开发！")
    else:
        print(f"部分检查未通过 ({passed}/{total})")
        print("请根据上述提示修复问题。")
    print("=" * 50)

    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
