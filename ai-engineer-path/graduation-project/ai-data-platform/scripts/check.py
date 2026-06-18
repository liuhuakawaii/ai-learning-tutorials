#!/usr/bin/env python3
"""项目结构验证"""

import os
import sys
from pathlib import Path

def check_structure():
    """检查项目结构"""
    base_dir = Path(__file__).parent.parent
    
    required_files = [
        "backend/main.py",
        "backend/config.py",
        "backend/requirements.txt",
        "backend/agents/orchestrator.py",
        "backend/api/chat.py",
        "backend/api/data.py",
        "backend/api/eval.py",
        "backend/data/seed.py",
        "frontend/package.json",
        "frontend/app/layout.tsx",
        "frontend/app/page.tsx",
        "frontend/app/globals.css",
        "docker-compose.yml",
        "README.md",
    ]
    
    missing = []
    for file in required_files:
        if not (base_dir / file).exists():
            missing.append(file)
    
    if missing:
        print("❌ 缺少以下文件:")
        for f in missing:
            print(f"  - {f}")
        return False
    
    print("✅ 项目结构验证通过！")
    print(f"共检查 {len(required_files)} 个文件")
    return True

def check_python_imports():
    """检查 Python 依赖"""
    try:
        import fastapi
        import uvicorn
        import openai
        import langgraph
        import pandas
        print("✅ Python 依赖检查通过！")
        return True
    except ImportError as e:
        print(f"❌ Python 依赖缺失: {e}")
        print("请运行: pip install -r backend/requirements.txt")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("AI 数据分析平台 - 项目验证")
    print("=" * 50)
    print()
    
    structure_ok = check_structure()
    print()
    
    if structure_ok:
        try:
            imports_ok = check_python_imports()
        except Exception:
            imports_ok = False
        
        if imports_ok:
            print()
            print("🎉 项目验证全部通过！")
            print("运行以下命令启动项目:")
            print("  python -m backend.data.seed")
            print("  python -m uvicorn backend.main:app --reload")
        else:
            print()
            print("⚠️ 项目结构正确，但缺少 Python 依赖")
    else:
        print()
        print("⚠️ 项目结构不完整")
        sys.exit(1)
