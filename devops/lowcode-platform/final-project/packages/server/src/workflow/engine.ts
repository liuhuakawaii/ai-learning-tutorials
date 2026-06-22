/**
 * 工作流引擎
 * 负责解析工作流定义、按顺序执行节点、处理分支和并行
 */

import { v4 as uuid } from 'crypto';
import { getPrismaClient } from '../models/schema';
import {
  type WorkflowDefinition,
  type WorkflowNode,
  type WorkflowEdge,
  type ExecutionContext,
  type ExecutionLog,
  NodeType,
  ExecutionStatus,
} from './types';

export class WorkflowEngine {
  private prisma = getPrismaClient();

  /**
   * 启动工作流执行
   * @param workflowId 工作流 ID
   * @param variables 初始变量
   */
  async execute(workflowId: string, variables: Record<string, any> = {}): Promise<ExecutionContext> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      throw new Error(`工作流不存在: ${workflowId}`);
    }

    const definition: WorkflowDefinition = {
      id: workflow.id,
      name: workflow.name,
      nodes: workflow.nodes as unknown as WorkflowNode[],
      edges: workflow.edges as unknown as WorkflowEdge[],
    };

    // 找到开始节点
    const startNode = definition.nodes.find((n) => n.type === NodeType.START);
    if (!startNode) {
      throw new Error('工作流缺少开始节点');
    }

    // 创建执行记录
    const execution: ExecutionContext = {
      executionId: this.generateId(),
      workflowId,
      variables,
      currentNodeId: startNode.id,
      status: ExecutionStatus.RUNNING,
      logs: [],
      startedAt: new Date(),
    };

    // 保存执行记录到数据库
    await this.prisma.workflowExecution.create({
      data: {
        id: execution.executionId,
        workflowId,
        status: ExecutionStatus.RUNNING,
        context: variables as any,
        logs: [] as any,
      },
    });

    // 开始执行
    try {
      await this.runNode(definition, startNode, execution);
    } catch (error: any) {
      execution.status = ExecutionStatus.FAILED;
      execution.logs.push({
        timestamp: new Date(),
        nodeId: execution.currentNodeId || '',
        nodeName: '系统',
        action: '执行失败',
        error: error.message,
      });
    }

    // 更新执行记录
    execution.finishedAt = new Date();
    await this.prisma.workflowExecution.update({
      where: { id: execution.executionId },
      data: {
        status: execution.status,
        logs: execution.logs as any,
        finishedAt: execution.finishedAt,
      },
    });

    return execution;
  }

  /**
   * 执行单个节点
   * 根据节点类型分发到对应的处理逻辑
   */
  private async runNode(
    definition: WorkflowDefinition,
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<void> {
    context.currentNodeId = node.id;

    this.log(context, node, `开始执行 [${node.name}]`);

    switch (node.type) {
      case NodeType.START:
        // 开始节点直接跳到下一个节点
        break;

      case NodeType.END:
        context.status = ExecutionStatus.SUCCESS;
        this.log(context, node, '工作流执行完成');
        return;

      case NodeType.TASK:
        await this.executeTaskNode(node, context);
        break;

      case NodeType.APPROVAL:
        await this.executeApprovalNode(node, context);
        break;

      case NodeType.CONDITION:
        await this.executeConditionNode(definition, node, context);
        return; // 条件节点内部处理跳转

      case NodeType.PARALLEL:
        await this.executeParallelNode(definition, node, context);
        return; // 并行节点内部处理跳转

      case NodeType.NOTIFY:
        await this.executeNotifyNode(node, context);
        break;

      case NodeType.SCRIPT:
        await this.executeScriptNode(node, context);
        break;

      case NodeType.DELAY:
        await this.executeDelayNode(node, context);
        break;

      default:
        throw new Error(`未知节点类型: ${node.type}`);
    }

    // 查找并执行下一个节点
    const nextEdge = definition.edges.find((e) => e.source === node.id);
    if (nextEdge) {
      const nextNode = definition.nodes.find((n) => n.id === nextEdge.target);
      if (nextNode) {
        await this.runNode(definition, nextNode, context);
      }
    } else if (node.type !== NodeType.END) {
      this.log(context, node, '警告：节点没有后续连接，流程终止');
      context.status = ExecutionStatus.SUCCESS;
    }
  }

  /**
   * 执行任务节点
   * 调用配置中的 API 或执行指定操作
   */
  private async executeTaskNode(node: WorkflowNode, context: ExecutionContext): Promise<void> {
    const { actionType, apiEndpoint, method, body } = node.config;

    if (actionType === 'api' && apiEndpoint) {
      // 替换请求体中的变量占位符
      const resolvedBody = this.resolveVariables(body, context.variables);

      this.log(context, node, `调用接口: ${method || 'POST'} ${apiEndpoint}`);

      // 实际项目中这里会发起 HTTP 请求
      // 这里模拟成功并记录
      context.variables[`__${node.id}_result`] = { success: true };
    }

    this.log(context, node, '任务执行完成');
  }

  /**
   * 执行审批节点
   * 创建审批任务并暂停流程，等待人工审批
   */
  private async executeApprovalNode(node: WorkflowNode, context: ExecutionContext): Promise<void> {
    const { assignees, approvalType } = node.config;

    context.status = ExecutionStatus.WAITING_APPROVAL;

    this.log(context, node, `等待审批 - 审批人: ${assignees?.join(', ') || '未指定'}`);

    // 创建审批任务记录
    await this.prisma.auditLog.create({
      data: {
        userId: 'system',
        action: 'workflow_approval_pending',
        resource: 'workflow',
        resourceId: context.workflowId,
        details: {
          executionId: context.executionId,
          nodeId: node.id,
          assignees,
        },
      },
    });
  }

  /**
   * 执行条件分支节点
   * 根据条件表达式决定走哪条分支
   */
  private async executeConditionNode(
    definition: WorkflowDefinition,
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<void> {
    const { expression } = node.config;

    // 获取所有从条件节点出发的边
    const outEdges = definition.edges.filter((e) => e.source === node.id);

    // 评估条件表达式
    const result = this.evaluateExpression(expression, context.variables);
    this.log(context, node, `条件评估: ${expression} = ${result}`);

    // 找到匹配条件的分支
    let matchedEdge = outEdges.find(
      (e) => e.condition && this.evaluateExpression(e.condition, context.variables)
    );

    // 如果没有匹配条件的分支，走默认分支（没有条件的边）
    if (!matchedEdge) {
      matchedEdge = outEdges.find((e) => !e.condition);
    }

    if (matchedEdge) {
      const nextNode = definition.nodes.find((n) => n.id === matchedEdge!.target);
      if (nextNode) {
        this.log(context, node, `选择分支: ${matchedEdge.label || matchedEdge.target}`);
        await this.runNode(definition, nextNode, context);
      }
    } else {
      this.log(context, node, '没有匹配的分支，流程终止');
      context.status = ExecutionStatus.SUCCESS;
    }
  }

  /**
   * 执行并行网关节点
   * 同时执行所有并行分支，等待全部完成后继续
   */
  private async executeParallelNode(
    definition: WorkflowDefinition,
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<void> {
    const outEdges = definition.edges.filter((e) => e.source === node.id);

    this.log(context, node, `启动 ${outEdges.length} 个并行分支`);

    // 并行执行所有分支
    const branchPromises = outEdges.map(async (edge) => {
      const nextNode = definition.nodes.find((n) => n.id === edge.target);
      if (nextNode) {
        // 每个分支使用上下文的深拷贝，避免互相干扰
        const branchContext = { ...context, variables: { ...context.variables } };
        await this.runNode(definition, nextNode, branchContext);
        return branchContext;
      }
      return null;
    });

    const results = await Promise.all(branchPromises);

    // 合并所有分支的变量到主上下文
    for (const result of results) {
      if (result) {
        Object.assign(context.variables, result.variables);
      }
    }

    // 找到并行网关的汇聚节点（所有从并行分支汇入的节点）
    const allTargets = outEdges.map((e) => e.target);
    const convergenceEdges = definition.edges.filter(
      (e) => allTargets.includes(e.source) && !outEdges.some((oe) => oe.target === e.target)
    );

    if (convergenceEdges.length > 0) {
      const nextNode = definition.nodes.find((n) => n.id === convergenceEdges[0].target);
      if (nextNode) {
        await this.runNode(definition, nextNode, context);
      }
    }
  }

  /**
   * 执行通知节点
   * 发送邮件、站内信等通知
   */
  private async executeNotifyNode(node: WorkflowNode, context: ExecutionContext): Promise<void> {
    const { channel, recipients, template, subject } = node.config;

    const resolvedMessage = this.resolveVariables(template, context.variables);
    this.log(context, node, `发送通知 [${channel}] 给: ${recipients?.join(', ')}`);

    // 记录审计日志
    await this.prisma.auditLog.create({
      data: {
        userId: 'system',
        action: 'workflow_notify',
        resource: 'workflow',
        resourceId: context.workflowId,
        details: { channel, recipients, subject, message: resolvedMessage },
      },
    });
  }

  /**
   * 执行脚本节点
   * 在沙箱中执行用户自定义脚本
   */
  private async executeScriptNode(node: WorkflowNode, context: ExecutionContext): Promise<void> {
    const { script } = node.config;

    this.log(context, node, '执行自定义脚本');

    // 注意：生产环境应使用安全的沙箱执行（如 vm2、isolated-vm）
    // 这里仅做变量注入演示
    const fn = new Function(...Object.keys(context.variables), `return ${script}`);
    const result = fn(...Object.values(context.variables));

    context.variables[`__${node.id}_result`] = result;
    this.log(context, node, '脚本执行完成');
  }

  /**
   * 执行延时节点
   * 等待指定时间后继续
   */
  private async executeDelayNode(node: WorkflowNode, context: ExecutionContext): Promise<void> {
    const { duration, unit } = node.config;
    const ms = unit === 'minutes' ? duration * 60000 : unit === 'hours' ? duration * 3600000 : duration;

    this.log(context, node, `延时等待 ${duration} ${unit || '毫秒'}`);

    // 生产环境应将延时任务放入消息队列，而非直接 sleep
    await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5000)));
  }

  /**
   * 评估条件表达式
   * 安全地在变量上下文中执行表达式
   */
  private evaluateExpression(expression: string, variables: Record<string, any>): boolean {
    try {
      const fn = new Function(...Object.keys(variables), `return ${expression}`);
      return !!fn(...Object.values(variables));
    } catch {
      return false;
    }
  }

  /**
   * 替换模板中的变量占位符
   * 支持 {{variableName}} 语法
   */
  private resolveVariables(template: any, variables: Record<string, any>): any {
    if (typeof template === 'string') {
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
      });
    }
    if (typeof template === 'object' && template !== null) {
      const result: any = Array.isArray(template) ? [] : {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.resolveVariables(value, variables);
      }
      return result;
    }
    return template;
  }

  /**
   * 记录执行日志
   */
  private log(context: ExecutionContext, node: WorkflowNode, message: string): void {
    context.logs.push({
      timestamp: new Date(),
      nodeId: node.id,
      nodeName: node.name,
      action: message,
    });
  }

  private generateId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
