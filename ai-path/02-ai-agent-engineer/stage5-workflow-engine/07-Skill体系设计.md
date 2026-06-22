# 07 Skill 体系设计

> Skill 是 AI 能力的封装——让业务人员能配置、能组合、能复用。

## 场景引入

你的 AI 平台已经接入了十几个工具：查天气、发邮件、调用内部 API、执行数据处理脚本……每个工具的调用方式都不一样，有的是 REST API，有的是 gRPC，有的要执行 Python 脚本。如果不做抽象，工具调用的逻辑散落在各处，新增一个工具就要改一堆代码。你需要一套统一的 Skill 体系，让工具变成可注册、可配置、可复用的能力单元。

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

---

## 参考答案

### 练习 1

**思路**：API Skill 的核心是将 HTTP 请求模板化——URL、Header、Body 都支持变量占位符，执行时从参数中替换。响应解析同样用模板，从 JSON 响应中提取需要的字段。关键是用 `httpx.AsyncClient` 做异步请求，支持超时和错误处理。

**答案**：

```python
import httpx
import re
import json
from typing import Any

class APISkillRunner:
    """API Skill 执行器"""

    def __init__(self, default_timeout: float = 30.0):
        self.default_timeout = default_timeout

    async def execute(self, skill_config: dict, params: dict) -> dict:
        url = self._render_template(skill_config["url"], params)
        method = skill_config.get("method", "GET").upper()
        headers = self._render_dict(skill_config.get("headers", {}), params)
        timeout = skill_config.get("timeout", self.default_timeout)

        # 构建请求体（仅非 GET 请求）
        body = None
        if method != "GET" and "body" in skill_config:
            body = self._render_template(skill_config["body"], params)
            if isinstance(body, str):
                try:
                    body = json.loads(body)
                except json.JSONDecodeError:
                    pass

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=body,
            )
            response.raise_for_status()

        # 解析响应
        response_data = response.json()
        result = self._extract_response(response_data, skill_config.get("response_mapping", {}))

        return {
            "status_code": response.status_code,
            "data": result,
            "raw": response_data,
        }

    def _render_template(self, template: str, params: dict) -> str:
        """渲染模板字符串，将 {{var}} 替换为参数值"""
        def replacer(match):
            key = match.group(1).strip()
            value = params.get(key)
            if value is None:
                raise ValueError(f"缺少必需参数: {key}")
            return str(value)

        return re.sub(r"\{\{(.+?)\}\}", replacer, template)

    def _render_dict(self, template_dict: dict, params: dict) -> dict:
        """渲染字典中所有模板值"""
        rendered = {}
        for key, value in template_dict.items():
            if isinstance(value, str):
                rendered[key] = self._render_template(value, params)
            else:
                rendered[key] = value
        return rendered

    def _extract_response(self, data: Any, mapping: dict) -> Any:
        """根据映射规则从响应中提取数据"""
        if not mapping:
            return data

        result = {}
        for output_key, path in mapping.items():
            # 支持简单的点号路径: "data.items[0].name"
            value = data
            for part in re.split(r"\.(?![^\[]*\])", path):
                bracket_match = re.match(r"(.+?)\[(\d+)\]$", part)
                if bracket_match:
                    key, idx = bracket_match.groups()
                    value = value[key][int(idx)]
                else:
                    value = value[part]
            result[output_key] = value

        return result


# --- 验证 ---
async def main():
    runner = APISkillRunner()

    # 模拟配置
    weather_skill = {
        "url": "https://api.weather.com/v1/current?city={{city}}&key={{api_key}}",
        "method": "GET",
        "headers": {
            "Authorization": "Bearer {{api_key}}",
            "Accept": "application/json",
        },
        "response_mapping": {
            "temperature": "data.temperature",
            "description": "data.weather_desc",
        },
    }

    # 模板渲染测试
    rendered_url = runner._render_template(weather_skill["url"], {"city": "Beijing", "api_key": "test123"})
    assert rendered_url == "https://api.weather.com/v1/current?city=Beijing&key=test123"
    print(f"URL 渲染: {rendered_url}")

    # 缺少参数测试
    try:
        runner._render_template(weather_skill["url"], {"city": "Beijing"})
        print("ERROR: 应该抛出缺少参数异常")
    except ValueError as e:
        print(f"正确检测到缺少参数: {e}")

    print("所有测试通过")

import asyncio
asyncio.run(main())
```

**要点**：
- URL、Header、Body 都要支持模板变量替换，用 `{{var_name}}` 格式统一处理
- 响应解析用点号路径映射（如 `data.items[0].name`），比写复杂的 JSONPath 更易用
- 常见错误：模板变量缺少参数时静默返回空字符串而不是报错——应该明确抛异常，否则请求会发到错误的 URL

### 练习 2

**思路**：Skill 市场的前端是标准的列表-详情-操作三件套。后端需要支持分类/标签筛选、关键字搜索、分页。详情页展示参数 Schema（自动生成表单）、使用示例和安装状态。安装操作要校验权限和依赖。

**答案**：

```vue
<!-- SkillMarket.vue -->
<template>
  <div class="skill-market">
    <!-- 搜索和筛选 -->
    <div class="market-filters">
      <n-input
        v-model:value="searchKeyword"
        placeholder="搜索 Skill..."
        clearable
        @update:value="handleSearch"
      >
        <template #prefix><n-icon :component="SearchIcon" /></template>
      </n-input>

      <n-space>
        <n-select
          v-model:value="selectedType"
          placeholder="类型筛选"
          :options="typeOptions"
          clearable
          @update:value="fetchSkills"
        />
        <n-select
          v-model:value="selectedTags"
          placeholder="标签筛选"
          multiple
          :options="tagOptions"
          clearable
          @update:value="fetchSkills"
        />
      </n-space>
    </div>

    <!-- Skill 列表 -->
    <n-grid :cols="3" :x-gap="16" :y-gap="16">
      <n-gi v-for="skill in skills" :key="skill.id">
        <n-card :title="skill.name" hoverable @click="showDetail(skill)">
          <template #header-extra>
            <n-tag :type="typeTagMap[skill.type]" size="small">{{ skill.type }}</n-tag>
          </template>
          <p>{{ skill.description }}</p>
          <n-space>
            <n-tag v-for="tag in skill.tags" :key="tag" size="small" type="info">{{ tag }}</n-tag>
          </n-space>
          <template #footer>
            <n-space justify="space-between">
              <span>作者: {{ skill.author }}</span>
              <span>v{{ skill.version }}</span>
            </n-space>
          </template>
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 分页 -->
    <n-pagination
      v-model:page="currentPage"
      :page-count="totalPages"
      @update:page="fetchSkills"
    />

    <!-- Skill 详情弹窗 -->
    <n-modal v-model:show="detailVisible" title="Skill 详情" style="width: 700px">
      <div v-if="currentSkill">
        <n-descriptions :column="2" bordered>
          <n-descriptions-item label="名称">{{ currentSkill.name }}</n-descriptions-item>
          <n-descriptions-item label="类型">{{ currentSkill.type }}</n-descriptions-item>
          <n-descriptions-item label="版本">v{{ currentSkill.version }}</n-descriptions-item>
          <n-descriptions-item label="作者">{{ currentSkill.author }}</n-descriptions-item>
        </n-descriptions>

        <n-divider>参数说明</n-divider>
        <n-data-table
          :columns="paramColumns"
          :data="paramList"
          :bordered="false"
        />

        <n-divider>使用示例</n-divider>
        <n-code :code="currentSkill.example || '暂无示例'" language="json" />

        <n-divider />
        <n-space justify="end">
          <n-button
            v-if="!isInstalled(currentSkill.id)"
            type="primary"
            @click="handleInstall(currentSkill)"
          >
            安装
          </n-button>
          <n-button v-else type="warning" @click="handleUninstall(currentSkill)">
            卸载
          </n-button>
        </n-space>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NInput, NSelect, NGrid, NCard, NTag, NModal, NDataTable } from 'naive-ui'

const searchKeyword = ref('')
const selectedType = ref(null)
const selectedTags = ref([])
const currentPage = ref(1)
const totalPages = ref(1)
const skills = ref([])
const installedIds = ref(new Set())
const detailVisible = ref(false)
const currentSkill = ref(null)

const typeOptions = [
  { label: 'API', value: 'api' },
  { label: 'Script', value: 'script' },
  { label: 'Workflow', value: 'workflow' },
  { label: 'MCP', value: 'mcp' },
]

const typeTagMap = { api: 'success', script: 'warning', workflow: 'info', mcp: 'error' }

const paramColumns = [
  { title: '参数名', key: 'name' },
  { title: '类型', key: 'type' },
  { title: '必填', key: 'required', render: (row) => row.required ? '是' : '否' },
  { title: '说明', key: 'description' },
]

const paramList = computed(() => {
  if (!currentSkill.value?.parameters?.properties) return []
  const props = currentSkill.value.parameters.properties
  const required = currentSkill.value.parameters.required || []
  return Object.entries(props).map(([name, schema]: [string, any]) => ({
    name,
    type: schema.type,
    required: required.includes(name),
    description: schema.description || '',
  }))
})

async function fetchSkills() {
  const params = new URLSearchParams({
    page: String(currentPage.value),
    keyword: searchKeyword.value,
  })
  if (selectedType.value) params.set('type', selectedType.value)
  if (selectedTags.value.length) params.set('tags', selectedTags.value.join(','))

  const res = await fetch(`/api/v1/skills?${params}`)
  const data = await res.json()
  skills.value = data.items
  totalPages.value = data.total_pages
}

function handleSearch() {
  currentPage.value = 1
  fetchSkills()
}

function showDetail(skill) {
  currentSkill.value = skill
  detailVisible.value = true
}

function isInstalled(skillId) {
  return installedIds.value.has(skillId)
}

async function handleInstall(skill) {
  await fetch(`/api/v1/skills/${skill.id}/install`, { method: 'POST' })
  installedIds.value.add(skill.id)
}

async function handleUninstall(skill) {
  await fetch(`/api/v1/skills/${skill.id}/uninstall`, { method: 'POST' })
  installedIds.value.delete(skill.id)
}

onMounted(fetchSkills)
</script>
```

```python
# 后端 API
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/v1/skills")

@router.get("")
async def list_skills(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str = "",
    type: str = "",
    tags: str = "",  # 逗号分隔
):
    """Skill 市场列表，支持搜索和筛选"""
    query = db.query("skills")
    if keyword:
        query = query.where("name ILIKE :kw OR description ILIKE :kw", kw=f"%{keyword}%")
    if type:
        query = query.where("type = :type", type=type)
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        query = query.where("tags && :tags", tags=tag_list)

    total = await query.count()
    items = await query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "total_pages": (total + page_size - 1) // page_size}

@router.post("/{skill_id}/install")
async def install_skill(skill_id: str, user_id: str = Depends(get_current_user)):
    """安装 Skill 到用户工作区"""
    skill = await db.get("skills", skill_id)
    if not skill:
        raise HTTPException(404, "Skill 不存在")

    # 检查是否已安装
    existing = await db.query(
        "user_skills", user_id=user_id, skill_id=skill_id
    )
    if existing:
        raise HTTPException(400, "已安装该 Skill")

    await db.insert("user_skills", {
        "user_id": user_id,
        "skill_id": skill_id,
        "installed_version": skill["version"],
        "config": {},
    })
    return {"ok": True, "message": f"已安装 {skill['name']}"}
```

**要点**：
- Skill 参数用 JSON Schema 定义，前端根据 schema 自动生成表格和表单，避免手写
- 列表筛选要支持多维度组合（类型 + 标签 + 关键字），后端用 `ILIKE` 和数组包含操作
- 常见错误：安装 Skill 时没有检查版本兼容性——如果工作流绑定了 Skill v1.0，自动升级到 v2.0 可能破坏已有工作流

## 常见误区

| 错误 | 原因 | 解决 |
|------|------|------|
| API 调用失败 | URL 模板变量没替换 | 检查模板渲染逻辑 |
| 脚本执行超时 | 代码有死循环 | 设置执行超时 |
| 权限越界 | 沙箱不严格 | 限制可访问的模块和资源 |

## 工程建议

- Skill 参数定义要用 JSON Schema，方便前端自动生成配置表单和后端做参数校验
- Script Skill 必须用沙箱隔离执行，限制可访问的模块、文件系统和网络资源
- 每个 Skill 要有独立的版本号，工作流绑定 Skill 版本，避免 Skill 升级导致已有工作流出错
- Skill 执行要有完善的日志和监控，记录调用次数、成功率、耗时，方便排查和优化

## 本节要点
