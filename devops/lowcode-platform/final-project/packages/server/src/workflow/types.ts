/**
 * 工作流类型定义
 * 定义了工作流引擎的核心数据结构
 */

/** 节点类型枚举 */
export enum NodeType {
  START = 'start',         // 开始节点
  END = 'end',             // 结束节点
  TASK = 'task',           // 任务节点（执行具体操作）
  APPROVAL = 'approval',   // 审批节点
  CONDITION = 'condition', // 条件分支节点
  PARALLEL = 'parallel',   // 并行网关节点
  NOTIFY = 'notify',       // 通知节点
  SCRIPT = 'script',       // 脚本执行节点
  DELAY = 'delay',         // 延时节点
}

/** 工作流节点定义 */
export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

/** 工作流边定义（连接线） */
export interface WorkflowEdge {
  id: string;
  source: string;  // 源节点 ID
  target: string;  // 目标节点 ID
  label?: string;  // 边标签（用于条件分支显示条件表达式）
  condition?: string; // 条件表达式
}

/** 工作流定义 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, any>;
}

/** 执行上下文 */
export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  variables: Record<string, any>;
  currentNodeId: string | null;
  status: ExecutionStatus;
  logs: ExecutionLog[];
  startedAt: Date;
  finishedAt?: Date;
}

/** 执行状态 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_APPROVAL = 'waiting_approval',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** 执行日志 */
export interface ExecutionLog {
  timestamp: Date;
  nodeId: string;
  nodeName: string;
  action: string;
  details?: any;
  error?: string;
}

/** 审批任务 */
export interface ApprovalTask {
  id: string;
  executionId: string;
  nodeId: string;
  assignees: string[];
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  createdAt: Date;
  resolvedAt?: Date;
}
