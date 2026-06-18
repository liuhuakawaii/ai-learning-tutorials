# 01 从单 Agent 到多 Agent——为什么需要多个 Agent 协作

> 一个人干不了所有事，一个 Agent 也不行。

## 学习目标

- 理解单 Agent 的局限性
- 掌握多 Agent 协作的核心价值
- 了解多 Agent 系统的典型应用场景

---

## 一、单 Agent 的局限

```
单 Agent 的天花板：

1. 上下文窗口限制
   - 单个 Agent 的上下文有限
   - 复杂任务需要大量上下文
   - 上下文越多，推理越慢、成本越高

2. 专业能力分散
   - 一个 Agent 要掌握所有技能
   - "样样通，样样松"
   - 难以针对特定任务深度优化

3. 错误累积
   - 多步推理中，每步都可能出错
   - 错误会逐步累积
   - 越复杂的任务，失败率越高

4. 可控性差
   - 单 Agent 的行为难以精确控制
   - 高风险操作难以隔离
   - 难以实现细粒度的权限管理
```

---

## 二、多 Agent 的价值

```
多 Agent 协作的核心价值：

1. 专业化分工
   - 每个 Agent 专注一个领域
   - 可以针对特定任务深度优化
   - 提高整体质量

2. 并行处理
   - 多个 Agent 可以并行工作
   - 提高处理效率
   - 降低总延迟

3. 错误隔离
   - 单个 Agent 失败不影响整体
   - 可以针对失败 Agent 单独处理
   - 提高系统鲁棒性

4. 可控性增强
   - 可以对不同 Agent 设置不同权限
   - 可以在关键节点添加人工审批
   - 可以追踪每个 Agent 的行为
```

---

## 三、多 Agent 应用场景

```
典型场景：

1. 研究助手
   - 搜索 Agent：收集信息
   - 分析 Agent：提取洞察
   - 写作 Agent：生成报告
   - 审核 Agent：质量把关

2. 客服系统
   - 路由 Agent：识别问题类型
   - 专业 Agent：处理特定领域
   - 升级 Agent：处理复杂问题
   - 质检 Agent：监控服务质量

3. 数据分析
   - 查询 Agent：生成 SQL
   - 分析 Agent：统计分析
   - 可视化 Agent：生成图表
   - 报告 Agent：生成报告

4. 代码开发
   - 架构 Agent：设计架构
   - 编码 Agent：编写代码
   - 测试 Agent：编写测试
   - 审查 Agent：代码审查
```

---

## 四、第一个多 Agent 示例

```python
class SimpleAgent:
    """简单的 Agent"""
    
    def __init__(self, name: str, role: str, llm):
        self.name = name
        self.role = role
        self.llm = llm
    
    def execute(self, task: str) -> str:
        prompt = f"""你是一个{self.role}。
        
任务：{task}

请完成任务并返回结果。"""
        
        response = self.llm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content

class MultiAgentSystem:
    """简单的多 Agent 系统"""
    
    def __init__(self):
        self.agents = {}
    
    def add_agent(self, agent: SimpleAgent):
        self.agents[agent.name] = agent
    
    def run_pipeline(self, task: str, pipeline: list[str]) -> str:
        """按顺序执行 Agent 流水线"""
        result = task
        
        for agent_name in pipeline:
            agent = self.agents[agent_name]
            print(f"[{agent_name}] 处理中...")
            result = agent.execute(result)
            print(f"[{agent_name}] 完成")
        
        return result

# 使用示例
llm = OpenAI()

system = MultiAgentSystem()
system.add_agent(SimpleAgent("researcher", "研究专家", llm))
system.add_agent(SimpleAgent("analyst", "数据分析师", llm))
system.add_agent(SimpleAgent("writer", "写作专家", llm))

result = system.run_pipeline(
    "分析 2024 年 AI 行业的发展趋势",
    ["researcher", "analyst", "writer"]
)
```

---

## 小结

```
本课核心要点：

1. 单 Agent 有上下文、专业能力、错误累积、可控性等局限
2. 多 Agent 的价值：专业化分工、并行处理、错误隔离、可控性
3. 多 Agent 适用于复杂任务、需要多技能、需要高可靠性的场景
4. 最简单的多 Agent 是流水线模式

下一课：编排模式概览——Supervisor / Sequential / Parallel / Hierarchical。
```

---

## 练习

1. **分析题**：分析你的一个 AI 应用，看是否适合用多 Agent 架构。

2. **设计题**：设计一个多 Agent 研究助手的架构，定义每个 Agent 的职责。

3. **实现题**：实现一个简单的流水线多 Agent 系统。
