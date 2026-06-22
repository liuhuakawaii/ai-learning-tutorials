/** 代码审查问题 */
export interface ReviewIssue {
  /** 行号 */
  line: number;
  /** 严重程度 */
  severity: 'error' | 'warning' | 'info';
  /** 问题类别 */
  category: string;
  /** 问题描述 */
  message: string;
  /** 修复建议 */
  suggestion?: string;
}

/** 代码审查报告 */
export interface ReviewReport {
  /** 文件名 */
  file: string;
  /** 审查摘要 */
  summary: string;
  /** 质量评分 */
  score: number;
  /** 问题列表 */
  issues: ReviewIssue[];
  /** 检查时间 */
  checkedAt: string;
}

const patterns: Array<{
  regex: RegExp;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  suggestion: string;
}> = [
  {
    regex: /\bany\b/g,
    severity: 'warning',
    category: 'type-safety',
    message: '使用了 any 类型，建议使用具体类型或 unknown',
    suggestion: '使用 unknown 替代 any，或定义具体接口类型',
  },
  {
    regex: /console\.(log|warn|error|info)\(/g,
    severity: 'info',
    category: 'logging',
    message: '使用了 console 输出，生产代码建议使用 logger',
    suggestion: '替换为结构化日志库（如 winston、pino）',
  },
  {
    regex: /eval\(/g,
    severity: 'error',
    category: 'security',
    message: '使用了 eval()，存在代码注入风险',
    suggestion: '避免使用 eval，考虑使用 Function 构造函数或 JSON.parse',
  },
  {
    regex: /password.*=.*['"]/gi,
    severity: 'error',
    category: 'security',
    message: '疑似硬编码密码',
    suggestion: '使用环境变量或密钥管理服务存储敏感信息',
  },
  {
    regex: /secret.*=.*['"]/gi,
    severity: 'error',
    category: 'security',
    message: '疑似硬编码密钥',
    suggestion: '使用环境变量存储密钥',
  },
  {
    regex: /TODO|FIXME|HACK|XXX/gi,
    severity: 'info',
    category: 'maintenance',
    message: '存在待处理的代码标记',
    suggestion: '在合并前处理这些标记，或转为 Issue 跟踪',
  },
  {
    regex: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g,
    severity: 'warning',
    category: 'error-handling',
    message: '空的 catch 块，错误被静默吞没',
    suggestion: '至少记录错误日志，或重新抛出',
  },
  {
    regex: /setTimeout\([^,]+,\s*0\)/g,
    severity: 'info',
    category: 'performance',
    message: '使用了 setTimeout(fn, 0)，考虑使用 setImmediate 或 queueMicrotask',
    suggestion: '根据场景选择 queueMicrotask 或 requestAnimationFrame',
  },
  {
    regex: /require\(/g,
    severity: 'info',
    category: 'module-system',
    message: '使用了 require()，ESM 项目建议使用 import',
    suggestion: '使用动态 import() 或改为 ESM 语法',
  },
  {
    regex: /==(?!=)/g,
    severity: 'warning',
    category: 'best-practice',
    message: '使用了宽松相等 (==)，建议使用严格相等 (===)',
    suggestion: '将 == 替换为 ===',
  },
];

export function reviewCode(code: string, fileName: string): ReviewReport {
  const lines = code.split('\n');
  const issues: ReviewIssue[] = [];

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(line);
      if (match) {
        issues.push({
          line: lineNum,
          severity: pattern.severity,
          category: pattern.category,
          message: pattern.message,
          suggestion: pattern.suggestion,
        });
      }
    }
  });

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const score = Math.max(0, 100 - errorCount * 15 - warningCount * 5);

  const summary = [
    `文件: ${fileName}`,
    `总行数: ${lines.length}`,
    `评分: ${score}/100`,
    `问题: ${errorCount} 个错误, ${warningCount} 个警告, ${issues.length - errorCount - warningCount} 个提示`,
  ].join(' | ');

  return {
    file: fileName,
    summary,
    score,
    issues,
    checkedAt: new Date().toISOString(),
  };
}
