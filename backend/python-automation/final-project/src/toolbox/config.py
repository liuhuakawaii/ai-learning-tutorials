"""配置管理 - 支持 YAML 配置文件和环境变量覆盖"""

import os
from pathlib import Path

import yaml


def _default_config_path() -> Path:
    """获取默认配置文件路径"""
    return Path(__file__).resolve().parent.parent.parent / "config" / "default.yaml"


def load_config(config_path: str | None = None) -> dict:
    """加载配置文件，支持环境变量覆盖。

    优先级：环境变量（TOOLBOX_ 前缀） > 指定配置文件 > 默认配置文件
    """
    path = Path(config_path) if config_path else _default_config_path()

    config: dict = {}
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}

    # 环境变量覆盖，格式 TOOLBOX_SECTION_KEY
    prefix = "TOOLBOX_"
    for key, value in os.environ.items():
        if not key.startswith(prefix):
            continue
        parts = key[len(prefix):].lower().split("_", 1)
        if len(parts) == 2:
            section, field = parts
            config.setdefault(section, {})[field] = value
        else:
            config[parts[0]] = value

    return config


def get(config: dict, dotted_key: str, default=None):
    """通过点分路径获取嵌套配置值。

    示例: get(config, "web_monitor.timeout", 10)
    """
    keys = dotted_key.split(".")
    node = config
    for k in keys:
        if isinstance(node, dict):
            node = node.get(k)
        else:
            return default
        if node is None:
            return default
    return node
