# 06 - 阶段实战：部署生产级 Prompt

> **课程定位**：Stage 4 生产级 Prompt 工程 · 第 6 课（阶段总结实战）
> **前置要求**：完成 Stage 4 前 5 课
> **预计时长**：120 分钟

---

## 学习目标

1. 掌握生产级 Prompt 的完整部署流程
2. 实现金丝雀发布（Canary Release）策略
3. 构建自动回滚机制保障线上稳定性
4. 设计事件响应流程处理生产事故
5. 完成端到端的 Prompt 部署系统

---

## 1. 部署管线全景

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    生产级 Prompt 部署管线                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│  │ 开发环境  │───▶│ 测试验证  │───▶│ 预发布   │───▶│ 生产发布  │           │
│  │ Prompt   │    │ 质量检查  │    │ 金丝雀   │    │ 全量推送  │           │
│  │ 编写     │    │ 回归测试  │    │ 灰度测试  │    │          │           │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘           │
│       │              │               │               │                   │
│       ▼              ▼               ▼               ▼                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐           │
│  │ 版本管理  │    │ 自动化   │    │ 流量控制  │    │ 监控告警  │           │
│  │ Git      │    │ CI/CD    │    │ 10%→50%  │    │ 自动回滚  │           │
│  └──────────┘    └──────────┘    │ →100%   │    └──────────┘           │
│                                  └──────────┘                           │
│                                                                          │
│  回滚策略: 质量分下降 > 10% 或 错误率 > 5% → 自动回滚到上一版本           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prompt 版本管理

```python
"""
prompt_version_manager.py
Prompt 版本管理系统
"""

import json
import hashlib
import time
from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum


class PromptStatus(Enum):
    DRAFT = "draft"
    TESTING = "testing"
    STAGING = "staging"
    CANARY = "canary"       # 金丝雀发布中
    PRODUCTION = "production"
    DEPRECATED = "deprecated"
    ROLLED_BACK = "rolled_back"


@dataclass
class PromptVersion:
    """Prompt 版本"""
    version_id: str
    prompt_name: str
    version_number: str
    content: str
    system_prompt: str
    status: PromptStatus
    created_at: float
    created_by: str
    hash: str = ""
    metadata: Dict = field(default_factory=dict)
    test_results: Dict = field(default_factory=dict)
    deployment_history: List[Dict] = field(default_factory=list)

    def __post_init__(self):
        if not self.hash:
            self.hash = self._compute_hash()

    def _compute_hash(self) -> str:
        content = f"{self.system_prompt}|{self.content}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]


class PromptVersionManager:
    """Prompt 版本管理器"""

    def __init__(self, storage_path: str = ".prompt_versions"):
        self.storage_path = storage_path
        self._versions: Dict[str, List[PromptVersion]] = {}
        self._active: Dict[str, PromptVersion] = {}

    def create_version(self, prompt_name: str, version_number: str,
                       content: str, system_prompt: str,
                       created_by: str = "system",
                       metadata: Dict = None) -> PromptVersion:
        """创建新版本"""
        version_id = f"{prompt_name}@{version_number}"

        version = PromptVersion(
            version_id=version_id,
            prompt_name=prompt_name,
            version_number=version_number,
            content=content,
            system_prompt=system_prompt,
            status=PromptStatus.DRAFT,
            created_at=time.time(),
            created_by=created_by,
            metadata=metadata or {},
        )

        if prompt_name not in self._versions:
            self._versions[prompt_name] = []
        self._versions[prompt_name].append(version)

        return version

    def get_version(self, prompt_name: str,
                    version_number: str) -> Optional[PromptVersion]:
        """获取指定版本"""
        for v in self._versions.get(prompt_name, []):
            if v.version_number == version_number:
                return v
        return None

    def get_active(self, prompt_name: str) -> Optional[PromptVersion]:
        """获取当前活跃版本"""
        return self._active.get(prompt_name)

    def get_all_versions(self, prompt_name: str) -> List[PromptVersion]:
        """获取所有版本"""
        return self._versions.get(prompt_name, [])

    def promote(self, prompt_name: str, version_number: str,
                target_status: PromptStatus) -> bool:
        """提升版本状态"""
        version = self.get_version(prompt_name, version_number)
        if not version:
            return False

        valid_transitions = {
            PromptStatus.DRAFT: [PromptStatus.TESTING],
            PromptStatus.TESTING: [PromptStatus.STAGING, PromptStatus.DRAFT],
            PromptStatus.STAGING: [PromptStatus.CANARY, PromptStatus.TESTING],
            PromptStatus.CANARY: [PromptStatus.PRODUCTION, PromptStatus.ROLLED_BACK],
            PromptStatus.PRODUCTION: [PromptStatus.DEPRECATED],
        }

        allowed = valid_transitions.get(version.status, [])
        if target_status not in allowed:
            return False

        old_status = version.status
        version.status = target_status
        version.deployment_history.append({
            "from": old_status.value,
            "to": target_status.value,
            "timestamp": time.time(),
        })

        if target_status == PromptStatus.PRODUCTION:
            # 将旧的 production 版本降级
            old_active = self._active.get(prompt_name)
            if old_active:
                old_active.status = PromptStatus.DEPRECATED
            self._active[prompt_name] = version

        return True

    def rollback(self, prompt_name: str) -> Optional[PromptVersion]:
        """回滚到上一个 production 版本"""
        versions = self._versions.get(prompt_name, [])
        production_versions = [
            v for v in versions
            if PromptStatus.PRODUCTION in [
                h["to"] for h in v.deployment_history
            ] or v.status == PromptStatus.DEPRECATED
        ]

        if not production_versions:
            return None

        # 找到最近的上一个版本
        current = self._active.get(prompt_name)
        if current:
            production_versions = [
                v for v in production_versions
                if v.version_id != current.version_id
            ]

        if not production_versions:
            return None

        target = production_versions[-1]

        # 标记当前版本回滚
        if current:
            current.status = PromptStatus.ROLLED_BACK
            current.deployment_history.append({
                "from": "production",
                "to": "rolled_back",
                "timestamp": time.time(),
                "reason": "auto_rollback",
            })

        # 激活旧版本
        target.status = PromptStatus.PRODUCTION
        target.deployment_history.append({
            "from": "deprecated",
            "to": "production",
            "timestamp": time.time(),
            "reason": "rollback",
        })
        self._active[prompt_name] = target

        return target

    def list_active(self) -> Dict[str, Dict]:
        """列出所有活跃版本"""
        return {
            name: {
                "version": v.version_number,
                "hash": v.hash,
                "status": v.status.value,
                "created_at": v.created_at,
            }
            for name, v in self._active.items()
        }

    def export_version(self, prompt_name: str, version_number: str) -> Dict:
        """导出版本为可序列化格式"""
        version = self.get_version(prompt_name, version_number)
        if not version:
            return {}
        return asdict(version)


# 使用示例
if __name__ == "__main__":
    manager = PromptVersionManager()

    # 创建版本
    v1 = manager.create_version(
        prompt_name="customer_service",
        version_number="1.0.0",
        content="请回答用户的客服问题",
        system_prompt="你是一个专业的客服助手",
        created_by="dev_team",
    )
    print(f"创建 v1: {v1.version_id}, hash: {v1.hash}")

    v2 = manager.create_version(
        prompt_name="customer_service",
        version_number="1.1.0",
        content="请用专业且友好的语气回答用户的客服问题，必要时提供解决方案",
        system_prompt="你是一个专业的客服助手，始终保持礼貌和耐心",
        created_by="dev_team",
    )
    print(f"创建 v2: {v2.version_id}, hash: {v2.hash}")

    # 版本提升流程
    manager.promote("customer_service", "1.0.0", PromptStatus.TESTING)
    manager.promote("customer_service", "1.0.0", PromptStatus.STAGING)
    manager.promote("customer_service", "1.0.0", PromptStatus.CANARY)
    manager.promote("customer_service", "1.0.0", PromptStatus.PRODUCTION)

    active = manager.get_active("customer_service")
    print(f"当前活跃版本: {active.version_number}")

    # 新版本上线
    manager.promote("customer_service", "1.1.0", PromptStatus.TESTING)
    manager.promote("customer_service", "1.1.0", PromptStatus.STAGING)
    manager.promote("customer_service", "1.1.0", PromptStatus.CANARY)
    manager.promote("customer_service", "1.1.0", PromptStatus.PRODUCTION)

    print(f"新活跃版本: {manager.get_active('customer_service').version_number}")

    # 回滚
    rolled_back = manager.rollback("customer_service")
    if rolled_back:
        print(f"回滚到: {rolled_back.version_number}")
```

---

## 3. 金丝雀发布系统

```python
"""
canary_deployer.py
金丝雀发布系统 - 渐进式发布
"""

import time
import random
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum


class CanaryPhase(Enum):
    PREPARING = "preparing"
    PHASE_1 = "phase_1_10pct"    # 10% 流量
    PHASE_2 = "phase_2_25pct"    # 25% 流量
    PHASE_3 = "phase_3_50pct"    # 50% 流量
    PHASE_4 = "phase_4_100pct"   # 100% 流量
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


@dataclass
class CanaryConfig:
    """金丝雀配置"""
    phases: List[Dict] = field(default_factory=lambda: [
        {"name": "phase_1", "traffic_pct": 10, "duration_minutes": 5,
         "min_requests": 20},
        {"name": "phase_2", "traffic_pct": 25, "duration_minutes": 10,
         "min_requests": 50},
        {"name": "phase_3", "traffic_pct": 50, "duration_minutes": 15,
         "min_requests": 100},
        {"name": "phase_4", "traffic_pct": 100, "duration_minutes": 30,
         "min_requests": 200},
    ])
    rollback_thresholds: Dict = field(default_factory=lambda: {
        "error_rate_pct": 5.0,
        "quality_score_drop": 0.10,
        "latency_increase_pct": 50.0,
    })
    check_interval_seconds: int = 60


@dataclass
class CanaryMetrics:
    """金丝雀阶段指标"""
    phase: str
    requests: int = 0
    errors: int = 0
    total_latency_ms: float = 0.0
    quality_scores: List[float] = field(default_factory=list)
    started_at: float = 0.0

    @property
    def error_rate(self) -> float:
        return (self.errors / self.requests * 100) if self.requests > 0 else 0

    @property
    def avg_latency(self) -> float:
        return (self.total_latency_ms / self.requests) if self.requests > 0 else 0

    @property
    def avg_quality(self) -> float:
        return sum(self.quality_scores) / len(self.quality_scores) if self.quality_scores else 0


class CanaryDeployer:
    """金丝雀发布器"""

    def __init__(self, config: CanaryConfig = None):
        self.config = config or CanaryConfig()
        self._deployments: Dict[str, Dict] = {}
        self._on_phase_change: Optional[Callable] = None
        self._on_rollback: Optional[Callable] = None

    def on_phase_change(self, callback: Callable):
        self._on_phase_change = callback

    def on_rollback(self, callback: Callable):
        self._on_rollback = callback

    def start_canary(self, deployment_id: str, prompt_name: str,
                     new_version: str, baseline_version: str):
        """开始金丝雀发布"""
        self._deployments[deployment_id] = {
            "prompt_name": prompt_name,
            "new_version": new_version,
            "baseline_version": baseline_version,
            "phase": CanaryPhase.PREPARING,
            "phase_index": 0,
            "metrics": {},
            "started_at": time.time(),
            "decisions": [],
        }

        self._advance_phase(deployment_id)

    def route_request(self, deployment_id: str,
                      request_id: str) -> str:
        """路由请求到新版本或基线版本"""
        deployment = self._deployments.get(deployment_id)
        if not deployment:
            return "baseline"

        phase = deployment["phase"]
        if phase in (CanaryPhase.COMPLETED, CanaryPhase.ROLLED_BACK):
            return "new" if phase == CanaryPhase.COMPLETED else "baseline"

        phase_config = self.config.phases[deployment["phase_index"]]
        traffic_pct = phase_config["traffic_pct"]

        if random.random() * 100 < traffic_pct:
            self._record_request(deployment_id, "new")
            return "new"
        else:
            self._record_request(deployment_id, "baseline")
            return "baseline"

    def record_result(self, deployment_id: str, version_type: str,
                      latency_ms: float, success: bool,
                      quality_score: float = 0.0):
        """记录请求结果"""
        deployment = self._deployments.get(deployment_id)
        if not deployment:
            return

        metrics_key = f"{deployment['phase'].value}_{version_type}"
        if metrics_key not in deployment["metrics"]:
            deployment["metrics"][metrics_key] = CanaryMetrics(
                phase=deployment["phase"].value,
                started_at=time.time(),
            )

        m = deployment["metrics"][metrics_key]
        m.requests += 1
        if not success:
            m.errors += 1
        m.total_latency_ms += latency_ms
        if quality_score > 0:
            m.quality_scores.append(quality_score)

    def _record_request(self, deployment_id: str, version_type: str):
        deployment = self._deployments[deployment_id]
        phase = deployment["phase"]
        key = f"{phase.value}_{version_type}"

    def check_health(self, deployment_id: str) -> Dict:
        """检查金丝雀健康状态"""
        deployment = self._deployments.get(deployment_id)
        if not deployment:
            return {"error": "deployment not found"}

        phase = deployment["phase"]
        phase_config = self.config.phases[deployment["phase_index"]]

        new_key = f"{phase.value}_new"
        baseline_key = f"{phase.value}_baseline"

        new_metrics = deployment["metrics"].get(new_key, CanaryMetrics(phase=phase.value))
        baseline_metrics = deployment["metrics"].get(baseline_key, CanaryMetrics(phase=phase.value))

        thresholds = self.config.rollback_thresholds
        issues = []

        # 检查错误率
        if new_metrics.error_rate > thresholds["error_rate_pct"]:
            issues.append(f"错误率过高: {new_metrics.error_rate:.1f}%")

        # 检查质量分
        if baseline_metrics.avg_quality > 0:
            quality_drop = baseline_metrics.avg_quality - new_metrics.avg_quality
            if quality_drop > thresholds["quality_score_drop"]:
                issues.append(f"质量分下降: {quality_drop:.3f}")

        # 检查延迟
        if baseline_metrics.avg_latency > 0:
            latency_increase = (
                (new_metrics.avg_latency - baseline_metrics.avg_latency)
                / baseline_metrics.avg_latency * 100
            )
            if latency_increase > thresholds["latency_increase_pct"]:
                issues.append(f"延迟增加: {latency_increase:.1f}%")

        health = {
            "deployment_id": deployment_id,
            "phase": phase.value,
            "new_version_metrics": {
                "requests": new_metrics.requests,
                "error_rate": f"{new_metrics.error_rate:.1f}%",
                "avg_latency": f"{new_metrics.avg_latency:.1f}ms",
                "avg_quality": f"{new_metrics.avg_quality:.3f}",
            },
            "baseline_metrics": {
                "requests": baseline_metrics.requests,
                "error_rate": f"{baseline_metrics.error_rate:.1f}%",
                "avg_latency": f"{baseline_metrics.avg_latency:.1f}ms",
                "avg_quality": f"{baseline_metrics.avg_quality:.3f}",
            },
            "healthy": len(issues) == 0,
            "issues": issues,
            "can_advance": (
                len(issues) == 0 and
                new_metrics.requests >= phase_config["min_requests"]
            ),
        }

        return health

    def advance_or_rollback(self, deployment_id: str) -> str:
        """根据健康状态推进或回滚"""
        health = self.check_health(deployment_id)
        deployment = self._deployments[deployment_id]

        if not health["healthy"]:
            deployment["phase"] = CanaryPhase.ROLLED_BACK
            if self._on_rollback:
                self._on_rollback(deployment_id, health["issues"])
            return "rolled_back"

        if health["can_advance"]:
            return self._advance_phase(deployment_id)

        return "waiting"

    def _advance_phase(self, deployment_id: str) -> str:
        """推进到下一阶段"""
        deployment = self._deployments[deployment_id]
        next_index = deployment["phase_index"] + 1

        if next_index >= len(self.config.phases):
            deployment["phase"] = CanaryPhase.COMPLETED
            return "completed"

        deployment["phase_index"] = next_index
        phase_name = self.config.phases[next_index]["name"]
        deployment["phase"] = CanaryPhase(f"phase_{next_index + 1}")

        if self._on_phase_change:
            self._on_phase_change(deployment_id, phase_name)

        return phase_name

    def get_deployment_status(self, deployment_id: str) -> Dict:
        """获取部署状态"""
        d = self._deployments.get(deployment_id)
        if not d:
            return {"error": "not found"}
        return {
            "deployment_id": deployment_id,
            "prompt_name": d["prompt_name"],
            "new_version": d["new_version"],
            "phase": d["phase"].value,
            "elapsed_minutes": (time.time() - d["started_at"]) / 60,
        }


# 使用示例
if __name__ == "__main__":
    deployer = CanaryDeployer()

    deployer.on_phase_change(lambda did, phase: print(f"  → 阶段切换: {phase}"))
    deployer.on_rollback(lambda did, issues: print(f"  ✗ 回滚: {issues}"))

    deployer.start_canary(
        deployment_id="deploy-001",
        prompt_name="customer_service",
        new_version="2.0.0",
        baseline_version="1.9.0",
    )

    # 模拟流量
    for i in range(50):
        version = deployer.route_request("deploy-001", f"req-{i}")
        latency = random.uniform(200, 800) if version == "new" else random.uniform(200, 600)
        success = random.random() > 0.02
        quality = random.uniform(0.7, 0.95)

        deployer.record_result("deploy-001", version, latency, success, quality)

    health = deployer.check_health("deploy-001")
    print(f"\n健康检查: {json.dumps(health, indent=2, ensure_ascii=False)}")

    status = deployer.get_deployment_status("deploy-001")
    print(f"\n部署状态: {json.dumps(status, indent=2)}")
```

---

## 4. 事件响应系统

```python
"""
incident_response.py
生产事件响应系统
"""

import time
import json
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum


class IncidentSeverity(Enum):
    P4_LOW = "P4"
    P3_MEDIUM = "P3"
    P2_HIGH = "P2"
    P1_CRITICAL = "P1"


class IncidentStatus(Enum):
    DETECTED = "detected"
    INVESTIGATING = "investigating"
    MITIGATING = "mitigating"
    RESOLVED = "resolved"
    POSTMORTEM = "postmortem"


@dataclass
class Incident:
    """生产事件"""
    incident_id: str
    title: str
    severity: IncidentSeverity
    status: IncidentStatus
    detected_at: float
    prompt_name: str
    description: str
    timeline: List[Dict] = field(default_factory=list)
    resolved_at: Optional[float] = None
    root_cause: str = ""
    action_items: List[str] = field(default_factory=list)

    @property
    def duration_minutes(self) -> Optional[float]:
        if self.resolved_at:
            return (self.resolved_at - self.detected_at) / 60
        return (time.time() - self.detected_at) / 60


@dataclass
class ResponseAction:
    """响应动作"""
    name: str
    description: str
    auto_execute: bool
    handler: Optional[Callable] = None


class IncidentResponseSystem:
    """事件响应系统"""

    def __init__(self, version_manager=None, deployer=None):
        self.version_manager = version_manager
        self.deployer = deployer
        self._incidents: Dict[str, Incident] = {}
        self._response_playbooks: Dict[str, List[ResponseAction]] = {}
        self._notification_handlers: List[Callable] = []

        self._register_default_playbooks()

    def _register_default_playbooks(self):
        """注册默认响应手册"""
        self._response_playbooks["high_error_rate"] = [
            ResponseAction(
                name="auto_rollback",
                description="自动回滚到上一稳定版本",
                auto_execute=True,
                handler=self._auto_rollback,
            ),
            ResponseAction(
                name="notify_oncall",
                description="通知值班工程师",
                auto_execute=True,
            ),
            ResponseAction(
                name="disable_prompt",
                description="临时禁用问题 Prompt",
                auto_execute=False,
            ),
        ]

        self._response_playbooks["quality_degradation"] = [
            ResponseAction(
                name="canary_pause",
                description="暂停金丝雀发布",
                auto_execute=True,
                handler=self._pause_canary,
            ),
            ResponseAction(
                name="notify_team",
                description="通知 Prompt 团队",
                auto_execute=True,
            ),
        ]

    def create_incident(self, title: str, severity: IncidentSeverity,
                        prompt_name: str, description: str,
                        playbook: str = "high_error_rate") -> Incident:
        """创建事件"""
        incident_id = f"INC-{int(time.time())}"

        incident = Incident(
            incident_id=incident_id,
            title=title,
            severity=severity,
            status=IncidentStatus.DETECTED,
            detected_at=time.time(),
            prompt_name=prompt_name,
            description=description,
        )
        incident.timeline.append({
            "time": time.time(),
            "action": "事件检测",
            "detail": description,
        })

        self._incidents[incident_id] = incident

        # 执行响应手册
        if playbook in self._response_playbooks:
            self._execute_playbook(incident_id, playbook)

        return incident

    def _execute_playbook(self, incident_id: str, playbook_name: str):
        """执行响应手册"""
        incident = self._incidents[incident_id]
        playbook = self._response_playbooks.get(playbook_name, [])

        incident.status = IncidentStatus.INVESTIGATING
        incident.timeline.append({
            "time": time.time(),
            "action": "开始响应",
            "detail": f"执行手册: {playbook_name}",
        })

        for action in playbook:
            if action.auto_execute and action.handler:
                try:
                    result = action.handler(incident)
                    incident.timeline.append({
                        "time": time.time(),
                        "action": action.name,
                        "detail": f"自动执行: {result}",
                    })
                except Exception as e:
                    incident.timeline.append({
                        "time": time.time(),
                        "action": action.name,
                        "detail": f"执行失败: {str(e)}",
                    })

    def _auto_rollback(self, incident: Incident) -> str:
        """自动回滚"""
        if self.version_manager:
            rolled = self.version_manager.rollback(incident.prompt_name)
            if rolled:
                incident.status = IncidentStatus.MITIGATING
                return f"已回滚到 {rolled.version_number}"
        return "回滚失败: 无可用版本"

    def _pause_canary(self, incident: Incident) -> str:
        """暂停金丝雀"""
        return "金丝雀已暂停"

    def resolve_incident(self, incident_id: str, root_cause: str,
                         action_items: List[str] = None):
        """解决事件"""
        incident = self._incidents[incident_id]
        incident.status = IncidentStatus.RESOLVED
        incident.resolved_at = time.time()
        incident.root_cause = root_cause
        incident.action_items = action_items or []
        incident.timeline.append({
            "time": time.time(),
            "action": "事件解决",
            "detail": f"根因: {root_cause}",
        })

    def generate_postmortem(self, incident_id: str) -> str:
        """生成事后复盘报告"""
        incident = self._incidents[incident_id]
        report = []
        report.append(f"# 事件复盘: {incident.incident_id}")
        report.append(f"## 基本信息")
        report.append(f"- 标题: {incident.title}")
        report.append(f"- 严重级别: {incident.severity.value}")
        report.append(f"- 影响 Prompt: {incident.prompt_name}")
        report.append(f"- 持续时间: {incident.duration_minutes:.1f} 分钟")
        report.append(f"## 根因分析")
        report.append(f"{incident.root_cause}")
        report.append(f"## 事件时间线")
        for entry in incident.timeline:
            t = time.strftime("%H:%M:%S", time.localtime(entry["time"]))
            report.append(f"- [{t}] {entry['action']}: {entry['detail']}")
        report.append(f"## 改进项")
        for item in incident.action_items:
            report.append(f"- {item}")
        return "\n".join(report)

    def get_active_incidents(self) -> List[Incident]:
        """获取活跃事件"""
        return [
            i for i in self._incidents.values()
            if i.status not in (IncidentStatus.RESOLVED, IncidentStatus.POSTMORTEM)
        ]

    def stats(self) -> Dict:
        """事件统计"""
        all_incidents = list(self._incidents.values())
        return {
            "total": len(all_incidents),
            "active": len(self.get_active_incidents()),
            "by_severity": {
                s.value: sum(1 for i in all_incidents if i.severity == s)
                for s in IncidentSeverity
            },
        }


# 使用示例
if __name__ == "__main__":
    from prompt_version_manager import PromptVersionManager

    vm = PromptVersionManager()
    vm.create_version("customer_service", "1.0.0",
                      "v1 content", "v1 system")
    vm.create_version("customer_service", "2.0.0",
                      "v2 content", "v2 system")
    vm.promote("customer_service", "1.0.0",
               __import__('prompt_version_manager', fromlist=['PromptStatus']).PromptStatus.PRODUCTION)

    irs = IncidentResponseSystem(version_manager=vm)

    incident = irs.create_incident(
        title="客服 Prompt 错误率突增",
        severity=IncidentSeverity.P2_HIGH,
        prompt_name="customer_service",
        description="错误率从 1% 上升到 8%，影响大量用户",
    )

    print(f"事件ID: {incident.incident_id}")
    print(f"状态: {incident.status.value}")
    print(f"时间线: {len(incident.timeline)} 条")

    irs.resolve_incident(
        incident.incident_id,
        root_cause="新版 Prompt 的格式要求导致模型输出解析失败",
        action_items=[
            "增加 JSON 输出的容错解析",
            "金丝雀阶段增加格式检查",
        ],
    )

    postmortem = irs.generate_postmortem(incident.incident_id)
    print(f"\n{postmortem}")
```

---

## 5. 部署检查清单

```
┌────────────────────────────────────────────────────────────┐
│              生产部署检查清单                                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  发布前:                                                   │
│  □ Prompt 版本已创建并记录 hash                            │
│  □ 自动化测试全部通过                                      │
│  □ 质量评分不低于基线 90%                                  │
│  □ 安全扫描无高危问题                                      │
│  □ 回滚方案已验证可用                                      │
│                                                            │
│  金丝雀阶段:                                               │
│  □ 10% 流量运行 5 分钟，指标正常                           │
│  □ 25% 流量运行 10 分钟，指标正常                          │
│  □ 50% 流量运行 15 分钟，指标正常                          │
│  □ 100% 流量运行 30 分钟，指标正常                         │
│                                                            │
│  发布后:                                                   │
│  □ 监控告警已配置                                          │
│  □ 值班人员已通知                                          │
│  □ 文档已更新                                              │
│  □ 旧版本保留 7 天                                          │
└────────────────────────────────────────────────────────────┘
```

---

## 6. 部署策略对照表

| 策略 | 流量切换 | 风险 | 回滚速度 | 适用场景 |
|------|---------|------|---------|---------|
| 全量发布 | 0→100% | 高 | 慢 | 紧急修复 |
| 金丝雀 | 10→25→50→100% | 低 | 快 | 常规发布 |
| 蓝绿部署 | 瞬间切换 | 中 | 瞬间 | 有冗余资源 |
| A/B 测试 | 按用户分组 | 低 | 快 | 效果验证 |

---

## 7. 常见错误

### ❌ 错误 1：跳过金丝雀直接全量发布

```python
# 错误：直接将新版本推到 100% 流量
deployer.start_canary(deployment_id, traffic_pct=100)

# 正确：渐进式发布
phases = [10, 25, 50, 100]
for pct in phases:
    deployer.set_traffic(pct)
    monitor_for(duration_minutes=10)
    if not healthy():
        rollback()
        break
```

### ❌ 错误 2：没有保留旧版本

```python
# 错误：新版本上线后立即删除旧版本
delete_version(old_version)

# 正确：保留至少 7 天
schedule_deletion(old_version, after_days=7)
```

### ❌ 错误 3：告警阈值设置过松

```python
# 错误：错误率 50% 才告警
alert_threshold = {"error_rate": 50}

# 正确：合理的告警阈值
alert_threshold = {"error_rate": 5, "quality_drop": 10}
```

---

## 总结

生产级 Prompt 部署的核心是**安全渐进**：通过版本管理保证可追溯，通过金丝雀发布控制风险，通过自动回滚快速恢复，通过事件响应系统化处理问题。整个流程的目标是让 Prompt 变更像代码部署一样安全可控。

---

## 练习

### 练习 1：完整部署流水线
整合本课所有组件，实现一个 `DeploymentPipeline` 类，串联版本管理、测试、金丝雀、监控、回滚的完整流程。

### 练习 2：自动回滚优化
实现一个 `SmartRollback`，不仅回滚到上一版本，还能分析失败原因并建议修复方向。

### 练习 3：部署报告生成器
实现一个 `DeploymentReporter`，在每次部署完成后自动生成包含指标对比、质量变化、成本影响的部署报告。
