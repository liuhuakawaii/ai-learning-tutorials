# 02 Skill 权限控制

> 不是所有人都能用所有 Skill——权限控制是企业安全的基础。

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

params = {json.dumps(code)}
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

## 本节要点

- Skill 权限要细粒度——谁能用什么 Skill、什么时候用、用多少次
- 审批流是高风险 Skill 的安全阀
- 沙箱执行防止恶意代码破坏系统

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 权限检查遗漏 | 没统一入口 | 在 SkillRegistry.execute 中统一检查 |
| 沙箱逃逸 | 限制不够严格 | 用 Docker 容器隔离 |
| 审批流卡住 | 没超时机制 | 设置审批超时自动拒绝 |
