# 05 Agent 状态机

> Agent 不是"一次性调用"——是有生命周期、能暂停、能恢复的长期运行实体。

## 学习目标

- 设计 Agent 的完整生命周期
- 实现状态持久化和断点恢复
- 支持人工确认和暂停/恢复

## Agent 生命周期

```
CREATED → RUNNING → WAITING_FOR_HUMAN → RUNNING → COMPLETED
                    ↓
                 TIMEOUT → FAILED
                    
任何状态 → CANCELLED
```

```python
from enum import Enum
from datetime import datetime

class AgentState(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    WAITING_FOR_TOOL = "waiting_for_tool"
    WAITING_FOR_HUMAN = "waiting_for_human"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class AgentExecution:
    """Agent 执行实例"""
    
    def __init__(self, agent_id: str, task: str):
        self.id = str(uuid.uuid4())
        self.agent_id = agent_id
        self.task = task
        self.state = AgentState.CREATED
        self.messages: list[dict] = []
        self.tool_calls: list[dict] = []
        self.result: str | None = None
        self.error: str | None = None
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.checkpoint: dict | None = None  # 断点信息
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "task": self.task,
            "state": self.state.value,
            "messages": self.messages,
            "tool_calls": self.tool_calls,
            "result": self.result,
            "error": self.error,
            "checkpoint": self.checkpoint,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
```

## 状态持久化

```python
class AgentStateManager:
    """Agent 状态管理器"""
    
    def __init__(self, db: AsyncSession, redis: redis.Redis):
        self.db = db
        self.redis = redis
    
    async def save(self, execution: AgentExecution):
        """保存执行状态"""
        # Redis 缓存（快速读取）
        await self.redis.set(
            f"agent_exec:{execution.id}",
            json.dumps(execution.to_dict(), ensure_ascii=False),
            ex=3600 * 24,  # 24 小时过期
        )
        
        # 数据库持久化
        await self.db.execute(
            text("""
                INSERT INTO agent_executions (id, agent_id, task, state, messages, checkpoint)
                VALUES (:id, :agent_id, :task, :state, :messages, :checkpoint)
                ON CONFLICT (id) DO UPDATE SET
                    state = :state,
                    messages = :messages,
                    checkpoint = :checkpoint,
                    updated_at = now()
            """),
            {
                "id": execution.id,
                "agent_id": execution.agent_id,
                "task": execution.task,
                "state": execution.state.value,
                "messages": json.dumps(execution.messages, ensure_ascii=False),
                "checkpoint": json.dumps(execution.checkpoint, ensure_ascii=False),
            },
        )
    
    async def load(self, execution_id: str) -> AgentExecution | None:
        """加载执行状态"""
        # 先查 Redis
        cached = await self.redis.get(f"agent_exec:{execution_id}")
        if cached:
            data = json.loads(cached)
            return self._from_dict(data)
        
        # 再查数据库
        result = await self.db.execute(
            text("SELECT * FROM agent_executions WHERE id = :id"),
            {"id": execution_id},
        )
        row = result.first()
        if row:
            return self._from_row(row)
        
        return None
```

## 断点恢复

```python
class ResumableAgent:
    """可恢复的 Agent"""
    
    async def run(self, execution: AgentExecution) -> AgentExecution:
        """运行 Agent，支持断点恢复"""
        execution.state = AgentState.RUNNING
        await self.state_manager.save(execution)
        
        try:
            # 从上次断点恢复
            if execution.checkpoint:
                messages = execution.checkpoint["messages"]
                step = execution.checkpoint["step"]
            else:
                messages = [{"role": "system", "content": self.system_prompt},
                           {"role": "user", "content": execution.task}]
                step = 0
            
            for i in range(step, self.max_steps):
                response = await self.llm.chat(messages, tools=self.tools)
                
                if response.tool_calls:
                    # 需要人工确认的工具
                    for tc in response.tool_calls:
                        if self._needs_confirmation(tc.function.name):
                            # 暂停，等待人工确认
                            execution.state = AgentState.WAITING_FOR_HUMAN
                            execution.checkpoint = {
                                "messages": messages,
                                "step": i,
                                "pending_tool_call": tc.model_dump(),
                            }
                            await self.state_manager.save(execution)
                            return execution
                    
                    # 执行工具
                    for tc in response.tool_calls:
                        result = await self._execute_tool(tc)
                        messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
                        execution.tool_calls.append({
                            "tool": tc.function.name,
                            "args": json.loads(tc.function.arguments),
                            "result": result,
                        })
                else:
                    execution.result = response.content
                    execution.state = AgentState.COMPLETED
                    break
                
                # 保存断点
                execution.checkpoint = {"messages": messages, "step": i + 1}
                await self.state_manager.save(execution)
        
        except Exception as e:
            execution.state = AgentState.FAILED
            execution.error = str(e)
        
        await self.state_manager.save(execution)
        return execution
```

## 人工确认

```python
async def resume_with_human_approval(
    self,
    execution_id: str,
    approved: bool,
    modified_args: dict | None = None,
) -> AgentExecution:
    """人工确认后恢复执行"""
    execution = await self.state_manager.load(execution_id)
    
    if not approved:
        execution.state = AgentState.CANCELLED
        await self.state_manager.save(execution)
        return execution
    
    # 使用修改后的参数执行工具
    pending = execution.checkpoint["pending_tool_call"]
    if modified_args:
        pending["function"]["arguments"] = json.dumps(modified_args)
    
    result = await self._execute_tool_from_dict(pending)
    execution.messages.append({
        "role": "tool",
        "tool_call_id": pending["id"],
        "content": result,
    })
    
    execution.state = AgentState.RUNNING
    execution.checkpoint = None
    await self.state_manager.save(execution)
    
    # 继续执行
    return await self.run(execution)
```

## 练习

### 练习 1：状态机

实现完整的 Agent 状态机：

1. 状态转换逻辑
2. 状态持久化（Redis + 数据库）
3. 断点恢复

### 练习 2：人工确认

实现人工确认流程：

1. Agent 遇到高风险操作时暂停
2. 前端展示待确认的工具调用
3. 用户确认/拒绝后恢复执行

## 本节要点

- Agent 是有生命周期的长期运行实体
- 状态持久化让 Agent 能在系统重启后恢复
- 人工确认是高风险操作的安全阀
- 断点恢复避免重复执行已完成的步骤

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 状态丢失 | 没持久化到数据库 | Redis + 数据库双重持久化 |
| 恢复后重复执行 | 没记录执行步骤 | 用 checkpoint 记录当前步骤 |
| 人工确认超时 | 没有超时机制 | 设置确认超时时间 |
