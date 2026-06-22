# 02 Skill 权限控制

> 不是所有人都能用所有 Skill——权限控制是企业安全的基础。

## 场景引入

公司新入职的实习生在测试环境误触了"数据库清理"Skill，直接删掉了三个月的对话数据。事后复盘发现，所有用户默认拥有全部 Skill 的执行权限，高危操作没有任何审批流程。你需要一套细粒度的 Skill 权限控制机制，让不同角色只能使用自己被授权的能力。

## 学习目标

- 实现 Skill 级别的权限控制
- 设计 Skill 审批流
- 实现沙箱执行

## Skill 权限模型

```python
class SkillPermission(BaseModel):
    skill_id: str
    allowed_roles: list[str]        # 允许使用的角色
    allowed_users: list[str]        # 允许使用的用户（白名单）
    requires_approval: bool = False # 是否需要审批
    max_calls_per_day: int = 100    # 每日调用上限
    allowed_time_range: str | None = None  # 允许调用的时间范围
```

## 审批流

```python
class SkillApprovalFlow:
    async def check_and_request(self, user_id: str, skill_id: str) -> dict:
        # 检查权限
        has_permission = await self._check_permission(user_id, skill_id)
        
        if has_permission:
            return {"allowed": True}
        
        # 检查是否需要审批
        skill = await self._get_skill(skill_id)
        if skill.requires_approval:
            # 创建审批请求
            approval = await self._create_approval_request(user_id, skill_id)
            return {"allowed": False, "approval_id": approval["id"], "status": "pending"}
        
        return {"allowed": False, "reason": "no_permission"}
```

## 沙箱执行

```python
class SandboxExecutor:
    """沙箱执行器——限制资源访问"""
    
    def __init__(self):
        self.max_execution_time = 30  # 秒
        self.max_memory = 256 * 1024 * 1024  # 256MB
        self.allowed_modules = {"json", "math", "datetime", "re", "collections"}
    
    async def execute(self, code: str, params: dict) -> dict:
        """在沙箱中执行代码"""
        # 构建受限环境
        restricted_code = self._build_restricted_code(code, params)
        
        # 使用 subprocess 隔离执行
        result = subprocess.run(
            ["python", "-c", restricted_code],
            capture_output=True,
            text=True,
            timeout=self.max_execution_time,
        )
        
        if result.returncode != 0:
            return {"error": result.stderr}
        
        return json.loads(result.stdout)
    
    def _build_restricted_code(self, code: str, params: dict) -> str:
        return f"""
import sys
import json

# 禁止危险操作
import builtins
original_import = builtins.__import__
def restricted_import(name, *args, **kwargs):
    if name not in {self.allowed_modules}:
        raise ImportError(f"Module '{{name}}' is not allowed in sandbox")
    return original_import(name, *args, **kwargs)
builtins.__import__ = restricted_import

# 禁止文件操作
builtins.open = lambda *a, **k: (_ for _ in ()).throw(PermissionError("File operations not allowed"))

params = {json.dumps(params)}
{code}
"""
```

## 练习

### 练习 1：Skill 权限

实现 Skill 权限控制：

1. 基于角色的 Skill 访问控制
2. Skill 调用频率限制
3. 审批请求和处理

### 练习 2：沙箱执行

实现代码沙箱：

1. 限制可导入的模块
2. 限制执行时间
3. 限制文件访问

---

## 参考答案

### 练习 1

**思路**：Skill 权限控制的核心是在 `SkillRegistry.execute` 统一入口处做三层检查：角色权限、调用频率、审批状态。频率限制用 Redis 滑动窗口实现，审批请求走标准的暂停-恢复流程。关键是要在统一入口拦截，不能依赖各处自行检查。

**答案**：

```python
import uuid
from datetime import datetime, timezone
from enum import Enum

class SkillPermission(BaseModel):
    skill_id: str
    allowed_roles: list[str] = []
    allowed_users: list[str] = []
    requires_approval: bool = False
    max_calls_per_day: int = 100
    max_calls_per_minute: int = 10

class SkillAccessController:
    """Skill 权限控制器"""

    def __init__(self, db, redis):
        self.db = db
        self.redis = redis

    async def check_access(self, user_id: str, skill_id: str) -> dict:
        """统一的 Skill 访问权限检查"""
        user = await self.db.get("users", user_id)
        skill = await self.db.get("skills", skill_id)
        if not skill:
            return {"allowed": False, "reason": "skill_not_found"}

        permission = await self._get_permission(skill_id)

        # 1. 角色检查
        if permission.allowed_roles and user["role"] not in permission.allowed_roles:
            # 2. 用户白名单检查
            if permission.allowed_users and user_id not in permission.allowed_users:
                return {"allowed": False, "reason": "no_permission", "requires_approval": permission.requires_approval}

        # 3. 频率限制检查
        rate_ok = await self._check_rate_limit(user_id, skill_id, permission)
        if not rate_ok:
            return {"allowed": False, "reason": "rate_limited"}

        # 4. 审批检查
        if permission.requires_approval:
            approved = await self._check_pending_approval(user_id, skill_id)
            if not approved:
                return {"allowed": False, "reason": "approval_required"}

        return {"allowed": True}

    async def _get_permission(self, skill_id: str) -> SkillPermission:
        row = await self.db.query("skill_permissions", skill_id=skill_id)
        if row:
            return SkillPermission(**row)
        return SkillPermission(skill_id=skill_id)

    async def _check_rate_limit(self, user_id: str, skill_id: str, perm: SkillPermission) -> bool:
        """滑动窗口频率限制"""
        # 每分钟限制
        minute_key = f"skill_rate:{user_id}:{skill_id}:minute"
        minute_count = await self.redis.incr(minute_key)
        if minute_count == 1:
            await self.redis.expire(minute_key, 60)
        if minute_count > perm.max_calls_per_minute:
            return False

        # 每日限制
        day_key = f"skill_rate:{user_id}:{skill_id}:day"
        day_count = await self.redis.incr(day_key)
        if day_count == 1:
            await self.redis.expire(day_key, 86400)
        if day_count > perm.max_calls_per_day:
            return False

        return True

    async def _check_pending_approval(self, user_id: str, skill_id: str) -> bool:
        """检查是否已有有效的审批记录"""
        approval = await self.db.query(
            "skill_approvals",
            user_id=user_id,
            skill_id=skill_id,
            status="approved",
        )
        return approval is not None


class SkillRegistryWithPermission:
    """带权限检查的 Skill 注册表"""

    def __init__(self, access_controller: SkillAccessController):
        self.access_controller = access_controller
        self.skills: dict = {}
        self.runners: dict = {}

    async def execute(self, user_id: str, skill_id: str, params: dict) -> dict:
        # 统一入口：必须在这里做权限检查
        access = await self.access_controller.check_access(user_id, skill_id)
        if not access["allowed"]:
            if access.get("requires_approval"):
                approval = await self._create_approval(user_id, skill_id)
                raise ApprovalRequiredError(approval["id"])
            raise PermissionError(f"访问被拒绝: {access['reason']}")

        # 记录调用
        await self._log_invocation(user_id, skill_id)

        skill = self.skills[skill_id]
        runner = self.runners[skill["type"]]
        return await runner.execute(skill, params)

    async def _create_approval(self, user_id: str, skill_id: str) -> dict:
        approval = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "skill_id": skill_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await self.db.insert("skill_approvals", approval)
        return approval

    async def _log_invocation(self, user_id: str, skill_id: str):
        await self.db.insert("skill_invocations", {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "skill_id": skill_id,
            "invoked_at": datetime.now(timezone.utc).isoformat(),
        })
```

**要点**：
- 权限检查必须在 `SkillRegistry.execute` 统一入口处做，不能依赖各个 Skill 自行检查——遗漏一个就是安全漏洞
- 频率限制要用滑动窗口，分"每分钟"和"每日"两层——每分钟防突发，每日防滥用
- 常见错误：只做角色检查不做频率限制——有权限的用户也可能通过脚本批量调用打垮系统

### 练习 2

**思路**：沙箱执行的核心是用 `subprocess` 创建独立进程，在进程内通过 hook `__import__` 和 `builtins` 限制可访问的模块和文件操作。生产环境更推荐用 Docker 容器隔离，但 subprocess + builtins hook 对于轻量级场景已经足够。

**答案**：

```python
import subprocess
import tempfile
import json
import os
from pathlib import Path

class SandboxExecutor:
    """代码沙箱执行器"""

    def __init__(self):
        self.max_execution_time = 30  # 秒
        self.max_output_bytes = 1024 * 1024  # 1MB
        self.allowed_modules = {
            "json", "math", "datetime", "re", "collections",
            "itertools", "functools", "string", "decimal", "fractions",
        }
        self.blocked_builtins = {"open", "exec", "eval", "compile", "globals", "locals", "breakpoint"}

    async def execute(self, code: str, params: dict, language: str = "python") -> dict:
        if language == "python":
            return await self._execute_python(code, params)
        raise ValueError(f"不支持的语言: {language}")

    async def _execute_python(self, code: str, params: dict) -> dict:
        # 构建受限代码
        sandbox_code = self._build_sandbox_code(code, params)

        # 写入临时文件
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(sandbox_code)
            script_path = f.name

        try:
            result = subprocess.run(
                ["python", script_path],
                capture_output=True,
                text=True,
                timeout=self.max_execution_time,
                env={"PATH": os.environ.get("PATH", ""), "PYTHONIOENCODING": "utf-8"},
            )

            if result.returncode != 0:
                return {"success": False, "error": self._sanitize_error(result.stderr)}

            stdout = result.stdout[:self.max_output_bytes]
            return {"success": True, "output": json.loads(stdout)}
        except subprocess.TimeoutExpired:
            return {"success": False, "error": f"执行超时（>{self.max_execution_time}s）"}
        except json.JSONDecodeError:
            return {"success": False, "error": "输出不是有效的 JSON"}
        finally:
            os.unlink(script_path)

    def _build_sandbox_code(self, code: str, params: dict) -> str:
        return f'''
import sys
import json
import builtins

# --- 模块白名单 ---
_original_import = builtins.__import__
_allowed_modules = {self.allowed_modules}
_blocked_builtins = {self.blocked_builtins}

def _restricted_import(name, *args, **kwargs):
    top_level = name.split(".")[0]
    if top_level not in _allowed_modules:
        raise ImportError(f"沙箱禁止导入模块: {{name}}")
    return _original_import(name, *args, **kwargs)

builtins.__import__ = _restricted_import

# --- 禁用危险内置函数 ---
for _name in _blocked_builtins:
    if hasattr(builtins, _name):
        setattr(builtins, _name, None)

# --- 禁用文件操作 ---
builtins.open = lambda *a, **k: (_ for _ in ()).throw(PermissionError("沙箱禁止文件操作"))

# --- 输入参数 ---
params = {json.dumps(params, ensure_ascii=False)}

# --- 用户代码 ---
try:
    {code}
except Exception as e:
    print(json.dumps({{"success": False, "error": str(e)}}, ensure_ascii=False))
    sys.exit(0)

# --- 输出结果 ---
if "result" in locals():
    print(json.dumps(result, ensure_ascii=False, default=str))
else:
    print(json.dumps({{"success": True, "message": "代码执行完成但未定义 result 变量"}}, ensure_ascii=False))
'''

    def _sanitize_error(self, stderr: str) -> str:
        """清理错误信息，移除文件路径等敏感信息"""
        lines = stderr.strip().split("\n")
        sanitized = []
        for line in lines:
            if "File" in line and "tmp" in line.lower():
                continue
            sanitized.append(line)
        return "\n".join(sanitized[-3:])  # 只保留最后 3 行
```

**要点**：
- `__import__` hook 只检查顶层模块名（`name.split(".")[0]`），否则 `import json.decoder` 会被误拦
- 必须同时禁用 `open`、`exec`、`eval`、`compile`——只禁 `open` 不够，用户可以用 `exec` 读文件
- 常见错误：沙箱代码里用 `os.system` 或 `subprocess` 做限制——这些模块本身应该在白名单之外，但如果白名单配错了就会失效。生产环境推荐 Docker 容器隔离

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| 权限检查遗漏 | 没统一入口 | 在 SkillRegistry.execute 中统一检查 |
| 沙箱逃逸 | 限制不够严格 | 用 Docker 容器隔离 |
| 审批流卡住 | 没超时机制 | 设置审批超时自动拒绝 |

## 工程建议

Skill 权限配置建议存储在数据库中而非代码里，方便运营人员通过后台动态调整，无需重新部署。沙箱执行在生产环境推荐使用 Docker 容器而非 Python 内置的 import 限制，前者隔离性更强、逃逸风险更低。审批流要设置超时自动拒绝，避免用户无限期等待。对于高频调用的 Skill，除了每日上限外还应加入每分钟限流，防止脚本批量调用打垮系统。

## 本节要点

- Skill 权限要细粒度——谁能用什么 Skill、什么时候用、用多少次
- 审批流是高风险 Skill 的安全阀
- 沙箱执行防止恶意代码破坏系统
