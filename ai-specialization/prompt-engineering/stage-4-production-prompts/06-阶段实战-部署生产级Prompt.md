# 阶段实战：部署生产级 Prompt

> Stage 4 · 第 6 课（综合实战）| 前置：完成 01-05 | 预计 60 分钟

---

你的 Prompt 在测试环境效果满分，推到生产环境覆盖所有用户。半小时后客服被打爆——新 Prompt 在真实输入下表现糟糕，错误率 15%。想回滚，旧版本没保存。

这节课构建一个部署系统：版本管理 + 灰度发布 + 自动回滚。

## 你要构建的东西

一个 Python 模块 `prompt_deployer.py`，能：
1. 管理 Prompt 版本（存储、切换、回滚）
2. 灰度发布（先 10% 流量，观察后逐步扩大）
3. 质量监控（检测错误率，触发自动回滚）

约 150 行代码。

## 第一步：版本管理

```python
import json
import hashlib
import time
from pathlib import Path
from dataclasses import dataclass, field

@dataclass
class PromptVersion:
    name: str
    version: str
    content: str
    status: str = "draft"  # draft → staging → canary → production → deprecated
    created_at: float = field(default_factory=time.time)
    hash: str = ""

    def __post_init__(self):
        if not self.hash:
            self.hash = hashlib.sha256(self.content.encode()).hexdigest()[:12]

class VersionStore:
    def __init__(self, directory: str = "prompt_versions"):
        self.dir = Path(directory)
        self.dir.mkdir(exist_ok=True)

    def save(self, version: PromptVersion):
        path = self.dir / f"{version.name}_{version.version}.json"
        path.write_text(json.dumps({
            "name": version.name,
            "version": version.version,
            "content": version.content,
            "status": version.status,
            "created_at": version.created_at,
            "hash": version.hash,
        }, ensure_ascii=False, indent=2), encoding="utf-8")

    def load(self, name: str, version: str) -> PromptVersion:
        path = self.dir / f"{name}_{version}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        return PromptVersion(**data)

    def list_versions(self, name: str) -> list[dict]:
        versions = []
        for f in self.dir.glob(f"{name}_*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            versions.append({"version": data["version"], "status": data["status"], "hash": data["hash"]})
        return sorted(versions, key=lambda v: v["version"])

    def get_active(self, name: str) -> PromptVersion | None:
        for f in self.dir.glob(f"{name}_*.json"):
            data = json.loads(f.read_text(encoding="utf-8"))
            if data["status"] == "production":
                return PromptVersion(**data)
        return None
```

## 第二步：灰度发布

```python
import random

class CanaryDeployer:
    def __init__(self, store: VersionStore):
        self.store = store
        self.canary_ratio: float = 0.0  # 当前灰度比例
        self.canary_version: PromptVersion | None = None
        self.stable_version: PromptVersion | None = None

    def start_canary(self, name: str, new_version: str, ratio: float = 0.1):
        """开始灰度发布，ratio 为灰度流量比例"""
        self.canary_version = self.store.load(name, new_version)
        self.canary_version.status = "canary"
        self.store.save(self.canary_version)

        self.stable_version = self.store.get_active(name)
        self.canary_ratio = ratio
        print(f"灰度开始: {new_version} 占比 {ratio*100:.0f}%")

    def get_prompt(self, name: str) -> str:
        """根据灰度比例返回 Prompt 版本"""
        if self.canary_version and random.random() < self.canary_ratio:
            return self.canary_version.content
        if self.stable_version:
            return self.stable_version.content
        return self.store.get_active(name).content

    def promote_canary(self, name: str):
        """灰度验证通过，提升为生产版本"""
        if self.canary_version:
            self.canary_version.status = "production"
            self.store.save(self.canary_version)
            if self.stable_version:
                self.stable_version.status = "deprecated"
                self.store.save(self.stable_version)
            print(f"灰度提升: {self.canary_version.version} → production")
            self.canary_version = None
            self.canary_ratio = 0.0

    def rollback(self, name: str):
        """回滚到稳定版本"""
        if self.stable_version:
            print(f"回滚: {self.canary_version.version if self.canary_version else '?'} → {self.stable_version.version}")
            self.canary_version = None
            self.canary_ratio = 0.0
```

## 第三步：质量监控

```python
@dataclass
class Metrics:
    total_requests: int = 0
    errors: int = 0
    canary_requests: int = 0
    canary_errors: int = 0

    @property
    def error_rate(self) -> float:
        return self.errors / max(self.total_requests, 1)

    @property
    def canary_error_rate(self) -> float:
        return self.canary_errors / max(self.canary_requests, 1)

class QualityMonitor:
    def __init__(self, deployer: CanaryDeployer, error_threshold: float = 0.05):
        self.deployer = deployer
        self.metrics = Metrics()
        self.threshold = error_threshold

    def record(self, is_canary: bool, is_error: bool):
        self.metrics.total_requests += 1
        if is_error:
            self.metrics.errors += 1
        if is_canary:
            self.metrics.canary_requests += 1
            if is_error:
                self.metrics.canary_errors += 1

    def check_and_act(self, name: str) -> str:
        """检查灰度版本质量，必要时自动回滚"""
        if self.metrics.canary_requests < 10:
            return "数据不足，继续观察"

        if self.metrics.canary_error_rate > self.threshold:
            self.deployer.rollback(name)
            return f"灰度错误率 {self.metrics.canary_error_rate:.1%} 超阈值 {self.threshold:.1%}，已自动回滚"

        if self.metrics.canary_requests >= 100 and self.metrics.canary_error_rate <= self.threshold:
            self.deployer.promote_canary(name)
            return f"灰度验证通过，已提升为生产版本"

        return f"灰度进行中: {self.metrics.canary_requests} 请求, 错误率 {self.metrics.canary_error_rate:.1%}"
```

## 第四步：完整流程演示

```python
# demo_deploy.py
store = VersionStore("prompt_versions")
deployer = CanaryDeployer(store)
monitor = QualityMonitor(deployer, error_threshold=0.05)

# 保存两个版本
v1 = PromptVersion(name="sentiment", version="1.0.0", content="你是情感分析助手，输出JSON...", status="production")
v2 = PromptVersion(name="sentiment", version="1.1.0", content="你是情感分析专家，严格输出JSON格式...")
store.save(v1)
store.save(v2)

# 开始灰度
deployer.start_canary("sentiment", "1.1.0", ratio=0.2)

# 模拟请求
for i in range(50):
    is_canary = random.random() < 0.2
    # 模拟：新版本在某些边缘情况下出错
    is_error = is_canary and random.random() < 0.08
    monitor.record(is_canary, is_error)

# 检查并决策
action = monitor.check_and_act("sentiment")
print(action)
```

## 自查清单

- [ ] 版本存储和加载正常工作
- [ ] 灰度发布按比例分配流量
- [ ] 错误率超阈值时自动回滚
- [ ] 验证通过时自动提升为生产版本
- [ ] 所有版本状态变更都有记录

## 扩展方向

1. 加 Webhook 通知——回滚时发消息到 Slack/钉钉
2. 加金丝雀指标仪表盘——实时查看灰度 vs 稳定版本的对比
3. 加 Prompt diff——灰度前展示新旧版本的差异

这些能力在实际生产环境中是标配。你现在构建的是一个简化版，但核心逻辑和大厂用的是一样的。
