/**
 * 审计日志模块
 * 记录所有关键操作，支持查询、导出和告警
 */

import { getPrismaClient } from './models/schema';

/** 审计日志级别 */
export enum AuditLevel {
  INFO = 'info',       // 普通操作（查看、查询）
  WARNING = 'warning', // 敏感操作（修改配置、删除数据）
  CRITICAL = 'critical', // 高危操作（权限变更、数据导出）
}

/** 审计日志条目 */
export interface AuditEntry {
  /** 操作用户 ID */
  userId: string;
  /** 操作类型 */
  action: string;
  /** 资源类型 */
  resource: string;
  /** 资源 ID */
  resourceId?: string;
  /** 操作详情 */
  details?: Record<string, any>;
  /** 客户端 IP */
  ip?: string;
  /** User-Agent */
  userAgent?: string;
  /** 日志级别 */
  level?: AuditLevel;
}

/**
 * 审计日志服务
 * 记录平台所有关键操作，满足企业合规要求
 */
export class AuditService {
  private prisma = getPrismaClient();

  /**
   * 记录审计日志
   * @param entry 审计日志条目
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          details: {
            ...entry.details,
            level: entry.level || AuditLevel.INFO,
            userAgent: entry.userAgent,
          } as any,
          ip: entry.ip,
        },
      });
    } catch (error) {
      // 审计日志写入失败不应阻断业务流程
      console.error('[审计日志] 写入失败:', error);
    }
  }

  /**
   * 查询审计日志
   * 支持按时间范围、用户、资源类型、操作类型筛选
   */
  async query(options: {
    userId?: string;
    resource?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    level?: AuditLevel;
    page?: number;
    pageSize?: number;
  }) {
    const { userId, resource, action, startDate, endDate, page = 1, pageSize = 50 } = options;

    const where: any = {};
    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取操作统计
   * 按操作类型和资源类型统计操作次数
   */
  async getStats(options: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'action' | 'resource' | 'user';
  }) {
    const { startDate, endDate, groupBy = 'action' } = options;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      select: {
        action: true,
        resource: true,
        userId: true,
      },
    });

    // 按指定维度统计
    const stats: Record<string, number> = {};
    for (const log of logs) {
      const key = groupBy === 'action' ? log.action
        : groupBy === 'resource' ? log.resource
        : log.userId;
      stats[key] = (stats[key] || 0) + 1;
    }

    return Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({ key, count }));
  }

  /**
   * 导出审计日志
   * 将查询结果导出为 CSV 格式
   */
  async exportCSV(options: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
  }): Promise<string> {
    const { logs } = await this.query({
      ...options,
      pageSize: 10000,
    });

    const headers = ['时间', '用户', '操作', '资源', '资源ID', 'IP', '详情'];
    const rows = logs.map((log) => [
      new Date(log.createdAt).toLocaleString('zh-CN'),
      (log as any).user?.name || log.userId,
      log.action,
      log.resource,
      log.resourceId || '',
      log.ip || '',
      JSON.stringify(log.details),
    ]);

    // 生成 CSV
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // 添加 BOM 头确保 Excel 正确识别中文
    return '\uFEFF' + csv;
  }

  /**
   * 清理过期日志
   * 删除超过指定天数的审计日志
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}

/**
 * 审计日志 Express 中间件
 * 自动记录所有写操作（POST/PUT/DELETE）
 */
export function auditMiddleware(auditService: AuditService) {
  return async (req: any, res: any, next: any) => {
    // 仅记录写操作
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return next();
    }

    // 在响应完成后记录日志
    const originalSend = res.send;
    res.send = function (body: any) {
      res.send = originalSend;

      // 异步记录审计日志
      const userId = req.user?.userId || 'anonymous';
      const resource = req.path.split('/')[2] || 'unknown'; // 从路径提取资源类型

      auditService.log({
        userId,
        action: `${req.method} ${req.path}`,
        resource,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          requestBody: req.method !== 'DELETE' ? req.body : undefined,
        },
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        level: req.method === 'DELETE' ? AuditLevel.WARNING : AuditLevel.INFO,
      }).catch(() => {});

      return originalSend.call(this, body);
    };

    next();
  };
}
