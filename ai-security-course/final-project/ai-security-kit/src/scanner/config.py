"""配置管理"""

from typing import Dict, Optional
from pathlib import Path
import json
import yaml

DEFAULT_CONFIG = {
    "scan": {
        "code_extensions": [".py", ".js", ".ts", ".java"],
        "config_extensions": [".json", ".yaml", ".yml", ".env"],
        "ignore_patterns": ["__pycache__", "node_modules", ".git"]
    },
    "detectors": {
        "code": {
            "enabled": True,
            "rules": ["hardcoded_secrets", "unsafe_prompt", "missing_validation"]
        },
        "config": {
            "enabled": True,
            "rules": ["api_keys", "permissions", "encryption"]
        },
        "runtime": {
            "enabled": False,
            "target_url": None
        }
    },
    "report": {
        "format": "html",
        "output_dir": "./reports"
    }
}


class ConfigManager:
    """配置管理器"""

    def __init__(self, config_path: Optional[str] = None):
        self.config = DEFAULT_CONFIG.copy()
        if config_path:
            self.load(config_path)

    def load(self, path: str):
        """加载配置"""
        path = Path(path)
        if not path.exists():
            return

        with open(path, "r", encoding="utf-8") as f:
            if path.suffix in [".yaml", ".yml"]:
                user_config = yaml.safe_load(f)
            else:
                user_config = json.load(f)

        self._merge_config(self.config, user_config)

    def _merge_config(self, base: Dict, override: Dict):
        """合并配置"""
        for key, value in override.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._merge_config(base[key], value)
            else:
                base[key] = value

    def get(self, key: str, default=None):
        """获取配置值"""
        keys = key.split(".")
        value = self.config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value
