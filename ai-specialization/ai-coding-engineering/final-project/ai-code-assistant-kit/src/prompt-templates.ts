export interface PromptTemplate {
  name: string;
  description: string;
  scenario: string;
  content: string;
}

const templates: PromptTemplate[] = [
  {
    name: 'api-endpoint',
    description: '创建 RESTful API 端点',
    scenario: '新增 API 路由',
    content: `# 角色
你是一位资深 TypeScript 后端开发工程师。

# 项目上下文
- 框架: Express 4.18+ / Fastify 4.x
- 语言: TypeScript 5.4+ 严格模式
- ORM: Prisma 5.x / Drizzle ORM
- 校验: Zod 3.x

# 任务
为 {resource} 创建 RESTful API 端点。

# 接口要求
- 路径: /api/v1/{resource}
- 方法: GET(列表), GET(详情), POST(创建), PUT(更新), DELETE(删除)
- 分页: ?page=1&pageSize=20
- 排序: ?sortBy=createdAt&order=desc
- 过滤: ?status=active

# 响应格式
成功: { code: 0, data: T, message: "success" }
错误: { code: number, data: null, message: "错误描述" }

# 约束
- 使用 Zod 校验请求参数
- 包含完整的错误处理
- 包含 JSDoc 注释
- 不使用 any 类型
- Controller 不直接操作数据库`,
  },
  {
    name: 'database-schema',
    description: '设计数据库 Schema',
    scenario: '新增数据模型',
    content: `# 角色
你是一位数据库设计专家。

# ORM 规范
- 使用 Prisma Schema Language / Drizzle ORM
- 所有模型必须有 id (UUID/CUID), createdAt, updatedAt
- 使用 enum 定义状态字段
- 关联使用 @relation 显式声明
- 索引使用 @@index

# 任务
为 {business_scenario} 设计数据库模型。

# 要求
- 支持软删除 (deletedAt)
- 包含必要的索引
- 字段类型合理（价格用 Decimal，枚举用 enum）
- 输出 ASCII 关系图
- 包含迁移脚本`,
  },
  {
    name: 'unit-test',
    description: '生成单元测试',
    scenario: '为现有代码编写测试',
    content: `# 角色
你是一位测试驱动开发专家。

# 测试框架
- TypeScript: Vitest + vi.fn() + vi.mock()
- Python: pytest + pytest-cov + unittest.mock

# 被测代码
\`\`\`typescript
{source_code}
\`\`\`

# 测试要求
- 覆盖正常路径（happy path）
- 覆盖边界条件
- 覆盖异常路径（错误输入、空值、越界）
- Mock 外部依赖（数据库、API、文件系统）
- 使用 describe/it 结构组织
- 测试命名: "应该 + 预期行为"

# 输出
- 完整的测试文件
- 包含 import 和 setup
- 每个测试有清晰的注释`,
  },
  {
    name: 'code-refactor',
    description: '重构现有代码',
    scenario: '改善代码质量',
    content: `# 角色
你是一位代码重构专家，精通设计模式和 SOLID 原则。

# 待重构代码
\`\`\`typescript
{source_code}
\`\`\`

# 重构目标
- 提高可读性
- 降低复杂度
- 遵循 SOLID 原则
- 消除代码重复
- 改善命名

# 约束
- 保持外部接口不变（函数签名、返回值）
- 不改变业务逻辑
- 分步骤说明每一步的改动和原因
- 输出重构前后的对比

# 输出格式
1. 问题分析（列出代码坏味道）
2. 重构计划（分步骤）
3. 重构后代码
4. 变更说明`,
  },
  {
    name: 'api-docs',
    description: '生成 API 文档',
    scenario: '为 API 端点生成文档',
    content: `# 角色
你是一位技术文档专家。

# 任务
为以下 API 代码生成完整的 Markdown 文档。

# 源代码
\`\`\`typescript
{source_code}
\`\`\`

# 文档要求
- 接口描述
- HTTP 方法和路径
- 请求参数（Query/Body/Path/Headers）
- 请求示例（curl + JSON）
- 响应格式（成功和失败）
- 响应示例
- 错误码说明
- 认证方式
- 调用限制

# 输出格式
Markdown 格式，可直接用于 Swagger/README`,
  },
  {
    name: 'debug-error',
    description: '调试错误',
    scenario: '排查运行时错误',
    content: `# 角色
你是一位调试专家，擅长分析错误和定位问题根因。

# 错误信息
{error_message}

# 相关代码
\`\`\`typescript
{source_code}
\`\`\`

# 复现步骤
{reproduction_steps}

# 任务
1. 分析错误原因
2. 提出修复方案（按可能性排序）
3. 给出修复后的代码
4. 建议预防措施

# 要求
- 解释错误的根本原因
- 说明为什么之前的代码会出错
- 给出具体的修复代码
- 建议添加的测试用例`,
  },
  {
    name: 'migration',
    description: '代码迁移',
    scenario: '框架/语言迁移',
    content: `# 角色
你是一位代码迁移专家，精通多种框架和语言。

# 迁移任务
从 {source_tech} 迁移到 {target_tech}

# 源代码
\`\`\`typescript
{source_code}
\`\`\`

# 迁移要求
- 保持功能不变
- 使用目标框架的最佳实践
- 更新类型定义
- 处理 API 差异
- 标注需要手动处理的部分

# 输出
1. 迁移计划（影响范围）
2. 迁移后代码
3. 需要安装的新依赖
4. 需要手动处理的部分
5. 回归测试建议`,
  },
  {
    name: 'security-review',
    description: '安全审查',
    scenario: '代码安全审查',
    content: `# 角色
你是一位应用安全专家 (AppSec)，精通 OWASP Top 10。

# 待审查代码
\`\`\`typescript
{source_code}
\`\`\`

# 安全检查项
- SQL 注入
- XSS 攻击
- 认证/授权漏洞
- 敏感数据泄露
- 输入校验不足
- 错误信息暴露
- 依赖安全
- SSRF 风险
- 文件上传漏洞
- 配置安全

# 输出格式
- 风险等级：高/中/低
- 问题描述
- 影响范围
- 修复建议
- 修复代码示例`,
  },
];

export function listTemplates(): PromptTemplate[] {
  return templates.map(({ name, description, scenario }) => ({
    name,
    description,
    scenario,
    content: '',
  }));
}

export function getTemplate(name: string): PromptTemplate | undefined {
  return templates.find((t) => t.name === name);
}

export function getTemplateNames(): string[] {
  return templates.map((t) => t.name);
}
