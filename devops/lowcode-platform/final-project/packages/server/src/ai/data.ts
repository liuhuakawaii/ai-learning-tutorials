/**
 * AI 数据处理模块
 * 提供自然语言查询转换、智能数据清洗和分析报告生成能力
 */

import { getPrismaClient } from '../models/schema';

/** 数据处理配置 */
interface DataAIConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/**
 * AI 数据处理助手
 * 将自然语言转换为数据库查询，并提供数据清洗和分析能力
 */
export class AIDataAssistant {
  private config: DataAIConfig;

  constructor(config: DataAIConfig = {}) {
    this.config = { model: 'gpt-4', ...config };
  }

  /**
   * 自然语言查询转 SQL
   * 用户用自然语言描述查询需求，AI 转换为 SQL 语句
   */
  async nlToSQL(nlQuery: string, tableSchemas: string): Promise<{
    sql: string;
    explanation: string;
    warnings: string[];
  }> {
    const prompt = `
你是一个数据库查询专家。请将用户的自然语言查询转换为 PostgreSQL SQL 语句。

数据库表结构：
${tableSchemas}

用户查询：${nlQuery}

请返回 JSON 格式：
{
  "sql": "SELECT ... FROM ... WHERE ...",
  "explanation": "查询说明",
  "warnings": ["需要注意的事项"]
}
注意：
1. 使用 PostgreSQL 语法
2. 表名和字段名使用双引号
3. 不要使用 DROP、DELETE、TRUNCATE、ALTER 等破坏性操作
4. 如果查询条件模糊，给出最合理的解释
仅返回 JSON。`;

    const response = await this.callLLM(prompt);
    try {
      return JSON.parse(this.extractJSON(response));
    } catch {
      return {
        sql: `-- AI 未能生成有效 SQL，请检查查询描述\n-- 原始查询: ${nlQuery}`,
        explanation: '无法解析查询，请尝试更明确的描述',
        warnings: ['SQL 生成失败'],
      };
    }
  }

  /**
   * 自然语言查询转 API 调用
   * 将自然语言转换为平台 API 的调用参数
   */
  async nlToAPI(nlQuery: string, models: string[]): Promise<{
    endpoint: string;
    method: string;
    params: Record<string, any>;
    explanation: string;
  }> {
    const prompt = `
你是一个低代码平台 API 专家。将用户的自然语言查询转换为 API 调用。

可用数据模型：${models.join('、')}

用户查询：${nlQuery}

请返回 JSON 格式：
{
  "endpoint": "/api/data/模型名",
  "method": "GET|POST|PUT|DELETE",
  "params": { "page": 1, "pageSize": 20, "filters": {} },
  "explanation": "调用说明"
}
仅返回 JSON。`;

    const response = await this.callLLM(prompt);
    try {
      return JSON.parse(this.extractJSON(response));
    } catch {
      return {
        endpoint: '/api/data/',
        method: 'GET',
        params: {},
        explanation: '无法解析查询意图',
      };
    }
  }

  /**
   * 智能数据清洗
   * 识别数据质量问题并提供修复建议
   */
  async analyzeDataQuality(data: Record<string, any>[], modelName: string): Promise<{
    issues: { type: string; field: string; count: number; suggestion: string }[];
    summary: string;
    cleanedData?: Record<string, any>[];
  }> {
    // 数据质量统计
    const issues: { type: string; field: string; count: number; suggestion: string }[] = [];

    if (data.length === 0) {
      return { issues: [], summary: '数据为空，无需清洗' };
    }

    // 获取所有字段名
    const fields = Object.keys(data[0]);

    for (const field of fields) {
      // 检查空值
      const nullCount = data.filter(
        (row) => row[field] === null || row[field] === undefined || row[field] === ''
      ).length;
      if (nullCount > 0) {
        issues.push({
          type: 'missing_value',
          field,
          count: nullCount,
          suggestion: `字段 "${field}" 有 ${nullCount} 条空值记录，建议设置默认值或要求必填`,
        });
      }

      // 检查文本字段的格式一致性
      const textValues = data
        .filter((row) => typeof row[field] === 'string' && row[field])
        .map((row) => row[field]);

      if (textValues.length > 0) {
        // 检查前后空格
        const trimmedDiff = textValues.filter((v) => v !== v.trim()).length;
        if (trimmedDiff > 0) {
          issues.push({
            type: 'whitespace',
            field,
            count: trimmedDiff,
            suggestion: `字段 "${field}" 有 ${trimmedDiff} 条记录包含前后空格`,
          });
        }
      }
    }

    // 生成摘要
    const totalIssues = issues.reduce((sum, i) => sum + i.count, 0);
    const summary =
      totalIssues === 0
        ? '数据质量良好，未发现明显问题'
        : `共发现 ${issues.length} 类问题，涉及 ${totalIssues} 条数据记录`;

    return { issues, summary };
  }

  /**
   * 生成数据分析报告
   * 根据数据生成自然语言的分析报告
   */
  async generateReport(
    data: Record<string, any>[],
    modelName: string,
    reportType: 'summary' | 'trend' | 'comparison' = 'summary'
  ): Promise<{
    title: string;
    content: string;
    highlights: string[];
    charts: { type: string; config: any }[];
  }> {
    // 基础统计信息
    const stats = this.computeBasicStats(data);

    const prompt = `
你是一个数据分析师。请根据以下数据统计信息生成分析报告。

数据模型：${modelName}
报告类型：${reportType}
数据量：${data.length} 条
统计摘要：${JSON.stringify(stats, null, 2)}

请返回 JSON 格式：
{
  "title": "报告标题",
  "content": "报告正文（支持 Markdown）",
  "highlights": ["关键发现1", "关键发现2"],
  "charts": [{"type": "line|bar|pie", "config": {}}]
}
仅返回 JSON。`;

    const response = await this.callLLM(prompt);
    try {
      return JSON.parse(this.extractJSON(response));
    } catch {
      return {
        title: `${modelName} 数据分析报告`,
        content: `## 数据概览\n\n共 ${data.length} 条记录，${Object.keys(stats).length} 个字段。\n\n${JSON.stringify(stats, null, 2)}`,
        highlights: [`共 ${data.length} 条记录`],
        charts: [],
      };
    }
  }

  /**
   * 计算基础统计数据
   */
  private computeBasicStats(data: Record<string, any>[]): Record<string, any> {
    if (data.length === 0) return {};

    const stats: Record<string, any> = {};
    const fields = Object.keys(data[0]);

    for (const field of fields) {
      const values = data.map((row) => row[field]).filter((v) => v !== null && v !== undefined);
      const fieldStats: any = {
        total: data.length,
        filled: values.length,
        empty: data.length - values.length,
      };

      // 数值字段统计
      const numValues = values.filter((v) => typeof v === 'number');
      if (numValues.length > 0) {
        fieldStats.min = Math.min(...numValues);
        fieldStats.max = Math.max(...numValues);
        fieldStats.avg = (numValues.reduce((a, b) => a + b, 0) / numValues.length).toFixed(2);
      }

      // 文本字段统计
      const strValues = values.filter((v) => typeof v === 'string');
      if (strValues.length > 0) {
        const uniqueValues = new Set(strValues);
        fieldStats.uniqueCount = uniqueValues.size;
        if (uniqueValues.size <= 10) {
          fieldStats.topValues = Array.from(uniqueValues).slice(0, 5);
        }
      }

      stats[field] = fieldStats;
    }

    return stats;
  }

  private async callLLM(prompt: string): Promise<string> {
    const { apiKey, model, baseUrl } = this.config;

    if (!apiKey) {
      return this.getDemoResponse(prompt);
    }

    const url = `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4',
        messages: [
          { role: 'system', content: '你是一个数据分析和查询专家。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) throw new Error(`LLM 调用失败: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  private extractJSON(text: string): string {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();
    const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) return jsonMatch[0];
    return text.trim();
  }

  private getDemoResponse(prompt: string): string {
    if (prompt.includes('SQL')) {
      return JSON.stringify({
        sql: 'SELECT * FROM "DemoModel" WHERE "status" = \'active\' ORDER BY "createdAt" DESC LIMIT 20',
        explanation: '查询状态为活跃的记录，按创建时间倒序，限制 20 条',
        warnings: ['演示模式下生成的是示例 SQL'],
      });
    }
    if (prompt.includes('API')) {
      return JSON.stringify({
        endpoint: '/api/data/DemoModel',
        method: 'GET',
        params: { page: 1, pageSize: 20, filters: { status: 'active' } },
        explanation: '查询活跃状态的记录',
      });
    }
    if (prompt.includes('报告')) {
      return JSON.stringify({
        title: '数据分析报告（演示）',
        content: '## 概览\n\n这是演示模式下生成的分析报告。',
        highlights: ['这是演示数据'],
        charts: [],
      });
    }
    return '{}';
  }
}
