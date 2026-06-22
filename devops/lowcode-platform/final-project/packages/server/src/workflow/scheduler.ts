/**
 * 工作流调度器
 * 管理工作流的定时触发和事件触发
 */

import { getPrismaClient } from '../models/schema';
import { WorkflowEngine } from './engine';

export class WorkflowScheduler {
  private engine = new WorkflowEngine();
  private prisma = getPrismaClient();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 注册定时触发的工作流
   * @param workflowId 工作流 ID
   * @param cronExpr 简化的定时表达式（如 "every 5m"、"every 1h"）
   */
  scheduleWorkflow(workflowId: string, cronExpr: string): void {
    const intervalMs = this.parseCronExpression(cronExpr);
    if (!intervalMs) {
      throw new Error(`不支持的定时表达式: ${cronExpr}`);
    }

    // 取消已有的调度
    this.cancelSchedule(workflowId);

    const timer = setInterval(async () => {
      try {
        console.log(`[调度器] 触发工作流: ${workflowId}`);
        await this.engine.execute(workflowId);
      } catch (error: any) {
        console.error(`[调度器] 工作流执行失败: ${workflowId}`, error.message);
      }
    }, intervalMs);

    this.scheduledJobs.set(workflowId, timer);
    console.log(`[调度器] 已注册工作流 ${workflowId}，间隔 ${intervalMs}ms`);
  }

  /**
   * 取消工作流调度
   */
  cancelSchedule(workflowId: string): void {
    const timer = this.scheduledJobs.get(workflowId);
    if (timer) {
      clearInterval(timer);
      this.scheduledJobs.delete(workflowId);
    }
  }

  /**
   * 触发事件驱动的工作流
   * 当特定事件发生时（如数据创建、审批通过），自动触发关联的工作流
   */
  async triggerByEvent(event: string, data: Record<string, any>): Promise<void> {
    // 查找所有配置了事件触发的工作流
    const workflows = await this.prisma.workflow.findMany({
      where: { status: 'ACTIVE' },
    });

    for (const workflow of workflows) {
      const nodes = workflow.nodes as any[];
      const triggerNode = nodes.find(
        (n: any) => n.type === 'start' && n.config?.triggerType === 'event' && n.config?.event === event
      );

      if (triggerNode) {
        console.log(`[调度器] 事件 "${event}" 触发工作流: ${workflow.name}`);
        try {
          await this.engine.execute(workflow.id, data);
        } catch (error: any) {
          console.error(`[调度器] 事件触发的工作流执行失败: ${workflow.name}`, error.message);
        }
      }
    }
  }

  /**
   * 解析简化版定时表达式
   * 支持: "every 5m"、"every 1h"、"every 1d"
   */
  private parseCronExpression(expr: string): number | null {
    const match = expr.match(/^every\s+(\d+)(s|m|h|d)$/);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * multipliers[unit];
  }

  /**
   * 销毁调度器，清理所有定时任务
   */
  destroy(): void {
    for (const [id] of this.scheduledJobs) {
      this.cancelSchedule(id);
    }
  }
}
