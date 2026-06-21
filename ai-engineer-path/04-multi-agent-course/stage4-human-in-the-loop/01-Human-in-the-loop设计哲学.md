# 01 Human-in-the-loop 设计哲学——什么环节需要人类介入

> 不是所有决策都该交给 AI。Human-in-the-loop 让人类在关键节点把关。

## 学习目标

- 理解 Human-in-the-loop 的设计哲学
- 掌握需要人类介入的场景判断
- 学会设计人机协作流程

---

## 一、为什么需要人类介入

```
需要人类介入的场景：

1. 高风险操作
   - 删除数据
   - 发送消息
   - 支付操作
   - 权限变更

2. 关键决策
   - 业务策略选择
   - 人事决策
   - 财务决策

3. 不确定情况
   - AI 置信度低
   - 多个方案难以抉择
   - 需要领域专家判断

4. 合规要求
   - 法律法规要求人工审核
   - 行业规范要求人工确认
   - 公司政策要求人工审批
```

---

## 二、介入模式

```
介入模式：

1. 审批模式（Approval）
   Agent 提出方案 → 人类审批 → 执行
   适用于：高风险操作

2. 确认模式（Confirmation）
   Agent 准备执行 → 人类确认 → 执行
   适用于：关键步骤

3. 选择模式（Selection）
   Agent 提供选项 → 人类选择 → 执行
   适用于：多方案决策

4. 修改模式（Modification）
   Agent 生成结果 → 人类修改 → 使用
   适用于：需要人工调整的输出

5. 监督模式（Oversight）
   Agent 持续执行 → 人类监督 → 必要时介入
   适用于：长时间运行任务
```

---

## 三、实现框架

```python
class HumanInTheLoop:
    """Human-in-the-loop 框架"""
    
    def __init__(self):
        self.pending_approvals = {}
        self.approval_history = []
    
    def request_approval(self, action: dict, context: dict) -> str:
        """请求人类审批"""
        request_id = str(uuid.uuid4())
        
        self.pending_approvals[request_id] = {
            "action": action,
            "context": context,
            "status": "pending",
            "created_at": datetime.now().isoformat()
        }
        
        return request_id
    
    def approve(self, request_id: str, feedback: str = None):
        """批准"""
        if request_id in self.pending_approvals:
            self.pending_approvals[request_id]["status"] = "approved"
            self.pending_approvals[request_id]["feedback"] = feedback
            self.approval_history.append(self.pending_approvals[request_id])
    
    def reject(self, request_id: str, reason: str):
        """拒绝"""
        if request_id in self.pending_approvals:
            self.pending_approvals[request_id]["status"] = "rejected"
            self.pending_approvals[request_id]["reason"] = reason
            self.approval_history.append(self.pending_approvals[request_id])
    
    def check_approval(self, request_id: str) -> str:
        """检查审批状态"""
        return self.pending_approvals.get(request_id, {}).get("status", "unknown")
```

---

## 四、设计原则

```
Human-in-the-loop 设计原则：

1. 最小介入原则
   - 只在必要时请求人类介入
   - 避免过度打扰用户

2. 清晰上下文
   - 提供足够的决策信息
   - 让人类能快速判断

3. 异步支持
   - 支持长时间等待
   - 不阻塞其他任务

4. 可追溯
   - 记录所有审批历史
   - 支持审计和复盘

5. 降级策略
   - 人类不响应时的处理
   - 超时后的默认行为
```

---

## 小结

```
本课核心要点：

1. Human-in-the-loop 在高风险、关键决策、不确定情况时介入
2. 介入模式：审批、确认、选择、修改、监督
3. 设计原则：最小介入、清晰上下异步、可追溯、降级
4. 实现框架支持请求、审批、拒绝、状态检查

---

**下一课**: [审批节点实现——在 LangGraph 中添加人工审批 gate](./02-审批节点实现.md)
```

---

## 练习

1. **场景题**：列出你的应用中需要人类介入的 3 个场景。

2. **实现题**：实现一个简单的审批框架。

3. **设计题**：设计一个人机协作流程。
