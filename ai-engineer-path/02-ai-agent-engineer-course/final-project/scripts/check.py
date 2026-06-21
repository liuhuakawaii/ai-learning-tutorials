"""验证 ai-agent-platform 项目结构。"""
import sys
from pathlib import Path

REQUIRED_FILES = [
    "backend/app/main.py",
    "backend/app/agent/engine.py",
    "backend/app/rag/pipeline.py",
    "backend/app/workflow/engine.py",
    "backend/app/api/v1/chat.py",
    "backend/app/api/v1/agents.py",
    "backend/app/api/v1/knowledge.py",
    "backend/app/api/v1/workflows.py",
    "backend/app/api/v1/skills.py",
    "backend/app/api/v1/auth.py",
    "backend/app/core/config.py",
    "backend/app/core/database.py",
    "backend/app/core/security.py",
    "backend/requirements.txt",
    "backend/Dockerfile",
    "frontend/package.json",
    "frontend/src/main.ts",
    "frontend/src/App.vue",
    "frontend/src/views/Chat.vue",
    "frontend/src/views/Agents.vue",
    "frontend/src/views/Knowledge.vue",
    "frontend/src/views/Workflows.vue",
    "frontend/src/views/Skills.vue",
    "docker-compose.yml",
    ".env.example",
    "README.md",
]

def main():
    root = Path(__file__).resolve().parent.parent / "ai-agent-platform"
    errors = []
    for rel in REQUIRED_FILES:
        if not (root / rel).exists():
            errors.append(f"缺失: {rel}")

    if errors:
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)
    print("  ✓ ai-agent-platform 结构验证通过")
    sys.exit(0)

if __name__ == "__main__":
    main()
