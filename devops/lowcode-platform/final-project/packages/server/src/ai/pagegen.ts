/**
 * AI 页面生成模块
 * 将自然语言需求描述转换为页面组件树
 */

import type { ComponentNode } from '../../../client/src/designer/store';

/** 页面生成配置 */
interface PageGenConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/** 页面生成结果 */
interface PageGenResult {
  /** 生成的组件树 */
  tree: ComponentNode[];
  /** 页面标题 */
  title: string;
  /** 页面路径 */
  path: string;
  /** AI 给出的说明 */
  explanation: string;
}

/**
 * AI 页面生成器
 * 根据用户的自然语言描述自动生成页面结构
 */
export class AIPageGenerator {
  private config: PageGenConfig;

  constructor(config: PageGenConfig = {}) {
    this.config = { model: 'gpt-4', ...config };
  }

  /**
   * 从需求描述生成页面
   *
   * @param description 页面需求描述，如"做一个用户管理页面，有搜索框、用户列表表格和新增按钮"
   * @param pageType 页面类型（dashboard | list | form | detail）
   * @returns 生成的页面组件树
   */
  async generatePage(description: string, pageType?: string): Promise<PageGenResult> {
    const prompt = this.buildPageGenPrompt(description, pageType);
    const response = await this.callLLM(prompt);
    return this.parsePageResponse(response, description);
  }

  /**
   * 布局优化建议
   * 分析现有的组件树，给出布局改进建议
   */
  async suggestLayoutOptimization(tree: ComponentNode[]): Promise<string[]> {
    const prompt = `
你是一个 UI/UX 设计专家。请分析以下页面结构，给出布局优化建议：

\`\`\`json
${JSON.stringify(tree, null, 2)}
\`\`\`

请以 JSON 数组格式返回优化建议，每条建议用中文描述：
["建议1", "建议2", ...]
仅返回 JSON。`;

    const response = await this.callLLM(prompt);
    try {
      return JSON.parse(this.extractJSON(response));
    } catch {
      return ['暂无优化建议'];
    }
  }

  /**
   * 组件推荐
   * 根据业务场景推荐合适的组件
   */
  async recommendComponents(scene: string): Promise<{
    component: string;
    reason: string;
  }[]> {
    const prompt = `
你是一个低代码平台组件专家。场景：${scene}

请推荐适合该场景的组件，以 JSON 数组格式返回：
[{"component": "组件名", "reason": "推荐理由"}]

可用组件：Button、Input、Select、DatePicker、Switch、Container、Grid、Card、Tabs、Divider、Table、List、Tree、Form、Chart
仅返回 JSON。`;

    const response = await this.callLLM(prompt);
    try {
      return JSON.parse(this.extractJSON(response));
    } catch {
      return [];
    }
  }

  /**
   * 构建页面生成提示词
   */
  private buildPageGenPrompt(description: string, pageType?: string): string {
    return `
你是一个低代码平台的页面生成专家。请根据用户描述生成页面结构。

用户描述：${description}
${pageType ? `页面类型：${pageType}` : ''}

可用组件类型：
- Button: 按钮（props: type, size, disabled, loading, children）
- Input: 输入框（props: placeholder, disabled, allowClear, maxLength）
- Select: 选择器（props: placeholder, options, multiple）
- DatePicker: 日期选择（props: placeholder, format）
- Container: 容器（props: direction, gap, align）- 可包含子组件
- Grid: 栅格（props: columns, gutter）- 可包含子组件
- Card: 卡片（props: title, bordered）- 可包含子组件
- Tabs: 标签页（props: items, defaultActiveKey）
- Divider: 分割线
- Table: 表格（props: columns, dataSource, pagination, bordered）
- List: 列表（props: dataSource, itemLayout）
- Tree: 树形（props: treeData, showLine）
- Form: 表单（props: layout）- 可包含子组件
- Chart: 图表（props: type, data, xField, yField）

请生成一个合理的页面组件树，返回 JSON 格式：
{
  "title": "页面标题",
  "path": "/page-path",
  "explanation": "页面说明",
  "tree": [
    {
      "id": "node-1",
      "type": "Container",
      "props": { "direction": "vertical", "gap": 16 },
      "children": [...]
    }
  ]
}

注意：
1. 组件树要合理嵌套，Container/Card/Grid/Form 作为容器可包含子组件
2. 给每个组件设置合理的默认属性
3. 表格要定义 columns 和示例数据
4. 表单要包含合理的表单项
5. id 使用 "node-数字" 格式

仅返回 JSON。`;
  }

  /**
   * 调用 LLM 服务
   */
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
          {
            role: 'system',
            content: '你是一个低代码平台的页面生成助手，擅长将需求描述转换为页面组件树。',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM 调用失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * 解析页面生成响应
   */
  private parsePageResponse(response: string, description: string): PageGenResult {
    try {
      const json = this.extractJSON(response);
      const parsed = JSON.parse(json);
      return {
        tree: Array.isArray(parsed.tree) ? parsed.tree : [],
        title: parsed.title || '生成的页面',
        path: parsed.path || '/generated-page',
        explanation: parsed.explanation || '根据需求自动生成的页面',
      };
    } catch {
      return {
        tree: this.getDemoTree(),
        title: '示例页面',
        path: '/demo',
        explanation: '（演示模式）未能解析 AI 响应，已生成示例页面',
      };
    }
  }

  private extractJSON(text: string): string {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) return codeBlockMatch[1].trim();
    const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) return jsonMatch[0];
    return text.trim();
  }

  /**
   * 演示模式生成的示例组件树
   */
  private getDemoTree(): ComponentNode[] {
    return [
      {
        id: 'node-1',
        type: 'Container',
        props: { direction: 'vertical', gap: 16 },
        children: [
          {
            id: 'node-2',
            type: 'Card',
            props: { title: '搜索条件' },
            children: [
              {
                id: 'node-3',
                type: 'Container',
                props: { direction: 'horizontal', gap: 12 },
                children: [
                  { id: 'node-4', type: 'Input', props: { placeholder: '请输入关键词' } },
                  { id: 'node-5', type: 'Select', props: { placeholder: '选择状态' } },
                  { id: 'node-6', type: 'Button', props: { type: 'primary', children: '搜索' } },
                ],
              },
            ],
          },
          {
            id: 'node-7',
            type: 'Card',
            props: { title: '数据列表' },
            children: [
              {
                id: 'node-8',
                type: 'Table',
                props: {
                  columns: [
                    { title: '名称', dataIndex: 'name' },
                    { title: '状态', dataIndex: 'status' },
                    { title: '创建时间', dataIndex: 'createdAt' },
                  ],
                  dataSource: [],
                  pagination: true,
                },
              },
            ],
          },
        ],
      },
    ];
  }

  private getDemoResponse(prompt: string): string {
    if (prompt.includes('优化建议')) {
      return '["建议在搜索区域和表格之间增加间距以提升视觉层次感", "表格建议添加行操作列以支持编辑和删除操作"]';
    }
    if (prompt.includes('推荐')) {
      return '[{"component":"Table","reason":"适合展示列表数据"},{"component":"Form","reason":"适合数据录入"}]';
    }
    return JSON.stringify({
      title: 'AI 生成的页面',
      path: '/ai-generated',
      explanation: '演示模式下生成的示例页面结构',
      tree: this.getDemoTree(),
    });
  }
}
