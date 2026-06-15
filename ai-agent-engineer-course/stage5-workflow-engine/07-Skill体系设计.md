# 07 Skill 体系设计

> Skill 是 AI 能力的封装——让业务人员能配置、能组合、能复用。

## 学习目标

- 设计 4 种 Skill 类型（API、Script、Workflow、MCP）
- 实现 Skill 注册、配置和执行
- 设计 Skill 权限和沙箱

## Skill 分类

| 类型 | 描述 | 示例 |
|------|------|------|
| API Skill | 调用外部 API | 查天气、发邮件 |
| Script Skill | 执行代码脚本 | 数据处理、格式转换 |
| Workflow Skill | 执行子工作流 | 复杂任务编排 |
| MCP Skill | 通过 MCP 协议调用 | 第三方工具 |

## Skill 定义

```python
class SkillType(str, Enum):
    API = "api"
    SCRIPT = "script"
    WORKFLOW = "workflow"
    MCP = "mcp"

class SkillDefinition(BaseModel):
    """Skill 定义"""
    id: str
    name: str
    description: str
    type: SkillType
    version: str = "1.0.0"
    
    # 参数定义
    parameters: dict  # JSON Schema
    
    # 类型特定配置
    config: dict
    
    # 权限
    permissions: list[str] = []
    requires_approval: bool = False
    
    # 元数据
    author: str = ""
    tags: list[str] = []
    icon: str = ""
```

## API Skill

```python
class APISkillRunner:
    """API Skill 执行器"""
    
    async def execute(self, skill: SkillDefinition, params: dict) -> dict:
        config = skill.config
        
        # 构建请求
        url = self._render_template(config["url"], params)
        method = config.get("method", "GET")
        headers = config.get("headers", {})
        body = self._render_template(config.get("body", ""), params) if method != "GET" else None
        
        # 发送请求
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=body if body else None,
                timeout=30,
            )
        
        # 解析响应
        response_template = config.get("response_template", "{{response}}")
        return self._parse_response(response.json(), response_template)
```

## Script Skill

```python
class ScriptSkillRunner:
    """Script Skill 执行器——沙箱执行"""
    
    async def execute(self, skill: SkillDefinition, params: dict) -> dict:
        code = skill.config["code"]
        language = skill.config.get("language", "python")
        
        if language == "python":
            return await self._execute_python(code, params)
        elif language == "javascript":
            return await self._execute_javascript(code, params)
        else:
            raise ValueError(f"Unsupported language: {language}")
    
    async def _execute_python(self, code: str, params: dict) -> dict:
        """沙箱执行 Python 代码"""
        # 使用 subprocess 隔离执行
        import tempfile
        import subprocess
        
        # 写入临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(f"""
import json
import sys

# 输入参数
params = {json.dumps(params)}

# 用户代码
{code}

# 输出结果
if 'result' in locals():
    print(json.dumps(result, ensure_ascii=False))
""")
            script_path = f.name
        
        try:
            # 执行（限制时间和内存）
            result = subprocess.run(
                ["python", script_path],
                capture_output=True,
                text=True,
                timeout=30,
            )
            
            if result.returncode != 0:
                return {"error": result.stderr}
            
            return json.loads(result.stdout)
        finally:
            os.unlink(script_path)
```

## Skill 注册表

```python
class SkillRegistry:
    """Skill 注册表"""
    
    def __init__(self):
        self.skills: dict[str, SkillDefinition] = {}
        self.runners: dict[SkillType, SkillRunner] = {
            SkillType.API: APISkillRunner(),
            SkillType.SCRIPT: ScriptSkillRunner(),
            SkillType.WORKFLOW: WorkflowSkillRunner(),
            SkillType.MCP: MCPSkillRunner(),
        }
    
    def register(self, skill: SkillDefinition):
        self.skills[skill.id] = skill
    
    async def execute(self, skill_id: str, params: dict) -> dict:
        skill = self.skills.get(skill_id)
        if not skill:
            raise ValueError(f"Skill not found: {skill_id}")
        
        runner = self.runners[skill.type]
        return await runner.execute(skill, params)
```

## 练习

### 练习 1：API Skill

实现 API Skill：

1. 支持 GET/POST 请求
2. 支持模板变量替换
3. 支持响应解析

### 练习 2：Skill 市场

实现 Skill 市场页面：

1. Skill 列表（按分类、标签筛选）
2. Skill 详情（参数说明、使用示例）
3. Skill 安装和配置

## 本节要点

- Skill 是 AI 能力的封装单元
- 4 种 Skill 类型覆盖不同场景
- 沙箱执行是 Script Skill 的安全基础
- Skill 让业务人员能自己配置 AI 能力

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| API 调用失败 | URL 模板变量没替换 | 检查模板渲染逻辑 |
| 脚本执行超时 | 代码有死循环 | 设置执行超时 |
| 权限越界 | 沙箱不严格 | 限制可访问的模块和资源 |
