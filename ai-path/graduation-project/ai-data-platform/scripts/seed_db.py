#!/usr/bin/env python3
"""初始化数据库"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.data.seed import init_database

if __name__ == "__main__":
    init_database()
    print("数据库初始化完成！")
