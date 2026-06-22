import logging
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class NodeStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class NodeExecution:
    node_id: str
    node_type: str
    status: NodeStatus = NodeStatus.PENDING
    input_data: dict = field(default_factory=dict)
    output_data: dict = field(default_factory=dict)
    error: str | None = None


class WorkflowEngine:
    def __init__(self):
        self.node_handlers: dict[str, callable] = {}

    def register_handler(self, node_type: str, handler: callable):
        self.node_handlers[node_type] = handler

    def _topological_sort(self, nodes: list[dict], edges: list[dict]) -> list[str]:
        adj: dict[str, list[str]] = {n["id"]: [] for n in nodes}
        in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}

        for edge in edges:
            source = edge.get("source", "")
            target = edge.get("target", "")
            if source in adj and target in in_degree:
                adj[source].append(target)
                in_degree[target] += 1

        queue = [node_id for node_id, deg in in_degree.items() if deg == 0]
        order = []

        while queue:
            node_id = queue.pop(0)
            order.append(node_id)
            for neighbor in adj.get(node_id, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(order) != len(nodes):
            raise ValueError("工作流存在循环依赖")

        return order

    async def execute(self, workflow_data: dict) -> dict:
        nodes = workflow_data.get("nodes", [])
        edges = workflow_data.get("edges", [])
        variables = workflow_data.get("variables", {})

        if not nodes:
            return {"status": "empty", "executions": []}

        try:
            execution_order = self._topological_sort(nodes, edges)
        except ValueError as e:
            return {"status": "error", "error": str(e), "executions": []}

        node_map = {n["id"]: n for n in nodes}
        executions: list[NodeExecution] = []
        context: dict = {**variables}

        for node_id in execution_order:
            node = node_map.get(node_id)
            if not node:
                continue

            node_type = node.get("type", "unknown")
            exec_result = NodeExecution(
                node_id=node_id,
                node_type=node_type,
                status=NodeStatus.RUNNING,
                input_data=dict(context),
            )

            handler = self.node_handlers.get(node_type)
            if handler:
                try:
                    output = await handler(node, context)
                    exec_result.output_data = output
                    exec_result.status = NodeStatus.COMPLETED
                    context.update(output)
                except Exception as e:
                    exec_result.status = NodeStatus.FAILED
                    exec_result.error = str(e)
                    logger.error("Node %s failed: %s", node_id, e)
            else:
                exec_result.status = NodeStatus.SKIPPED
                exec_result.output_data = {"message": f"No handler for node type: {node_type}"}

            executions.append(exec_result)

        all_completed = all(e.status in (NodeStatus.COMPLETED, NodeStatus.SKIPPED) for e in executions)
        any_failed = any(e.status == NodeStatus.FAILED for e in executions)

        return {
            "status": "completed" if all_completed else ("failed" if any_failed else "partial"),
            "executions": [
                {
                    "node_id": e.node_id,
                    "node_type": e.node_type,
                    "status": e.status.value,
                    "input_data": e.input_data,
                    "output_data": e.output_data,
                    "error": e.error,
                }
                for e in executions
            ],
            "context": context,
        }
