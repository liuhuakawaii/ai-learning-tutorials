/**
 * AI 辅助建模模块
 * 将自然语言描述转换为数据模型定义
 */

import { type ModelDefinition, type FieldDefinition, FieldType, RelationType } from '../models/schema';

/** AI 建模配置 */
interface ModelingConfig {
  /** OpenAI API Key */
  apiKey?: string;
  /** 模型名称，默认 gpt-4 */
  model?: string;
  /** API 基础地址（兼容其他 LLM 服务） */
  baseUrl?: string;
}

/**
 * AI 建模助手
 * 将用户的自然语言需求描述解析为结构化的数据模型定义
 */
export class AIModelingAssistant {
  private config: ModelingConfig;

  constructor(config: ModelingConfig = {}) {
    this.config = {
      model: 'gpt-4',
      ...config,
    };
  }

  /**
   * 从自然语言描述生成数据模型
   *
   * @param description 用户的需求描述，如"我需要一个电商系统，有用户、商品和订单"
   * @returns 解析后的模型定义数组
   */
  async generateModels(description: string): Promise<ModelDefinition[]> {
    const prompt = this.buildModelingPrompt(description);

    // 调用 LLM 获取模型定义
    const response = await this.callLLM(prompt);

    // 解析 LLM 返回的 JSON 格式模型定义
    const parsed = this.parseModelResponse(response);

    // 对生成的模型进行验证和修正
    return this.validateAndFixModels(parsed);
  }

  /**
   * 智能字段推荐
   * 根据模型名称和已有的字段，推荐可能需要的字段
   */
  async suggestFields(modelName: string, existingFields: FieldDefinition[]): Promise<FieldDefinition[]> {
    const prompt = `
你是一个数据建模专家。模型名称为 "${modelName}"，已有字段：
${existingFields.map((f) => `- ${f.name} (${f.type}): ${f.displayName}`).join('\n')}

请推荐 3-5 个可能需要的额外字段，以 JSON 数组格式返回：
[{"name": "fieldName", "displayName": "显示名", "type": "text|number|date|boolean|enum", "required": true|false}]
仅返回 JSON，不要其他内容。`;

    const response = await this.callLLM(prompt);
    return this.parseFieldSuggestions(response);
  }

  /**
   * 关系推断
   * 根据模型名称列表自动推断可能的关系
   */
  async inferRelations(modelNames: string[]): Promise<{
    source: string;
    target: string;
    type: RelationType;
    reason: string;
  }[]> {
    const prompt = `
你是一个数据建模专家。现有以下数据模型：${modelNames.join('、')}

请推断这些模型之间可能存在的关联关系，以 JSON 数组格式返回：
[{"source": "模型A", "target": "模型B", "type": "one_to_many|many_to_many|one_to_one", "reason": "推断理由"}]
仅返回 JSON，不要其他内容。`;

    const response = await this.callLLM(prompt);
    try {
      return JSON.parse(this.extractJSON(response));
    } catch {
      return [];
    }
  }

  /**
   * 构建建模提示词
   * 引导 LLM 输出符合规范的模型定义
   */
  private buildModelingPrompt(description: string): string {
    return `
你是一个低代码平台的数据建模专家。请根据用户的描述生成数据模型定义。

用户描述：${description}

请以 JSON 数组格式返回模型定义，每个模型包含：
{
  "name": "模型英文名（PascalCase）",
  "displayName": "中文显示名",
  "description": "模型说明",
  "fields": [
    {
      "name": "字段英文名（camelCase）",
      "displayName": "中文显示名",
      "type": "text|number|date|boolean|enum|email|url|phone|json",
      "required": true/false,
      "description": "字段说明"
    }
  ],
  "relations": [
    {
      "type": "one_to_one|one_to_many|many_to_many",
      "sourceModel": "源模型名",
      "targetModel": "目标模型名",
      "sourceField": "源字段名",
      "targetField": "目标字段名"
    }
  ]
}

注意：
1. 每个模型自动包含 id、createdAt、updatedAt 字段，无需手动添加
2. 关系字段应使用引用模型的 id
3. 枚举类型必须提供 enumValues 数组
4. 根据业务语义合理设置 required 和 unique 属性

仅返回 JSON 数组，不要其他内容。`;
  }

  /**
   * 调用 LLM 服务
   * 支持 OpenAI API 兼容格式
   */
  private async callLLM(prompt: string): Promise<string> {
    const { apiKey, model, baseUrl } = this.config;

    if (!apiKey) {
      // 未配置 API Key 时返回演示数据
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
            content: '你是一个低代码平台的数据建模助手，擅长将业务需求转化为数据模型。',
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
   * 从 LLM 响应中提取 JSON
   * 处理 LLM 可能返回的 markdown 代码块格式
   */
  private extractJSON(text: string): string {
    // 尝试从 ```json ... ``` 中提取
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // 尝试直接找 JSON 数组或对象
    const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return text.trim();
  }

  /**
   * 解析 LLM 的模型定义响应
   */
  private parseModelResponse(response: string): ModelDefinition[] {
    try {
      const json = this.extractJSON(response);
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      console.error('[AI建模] 解析响应失败:', error);
      return [];
    }
  }

  /**
   * 解析字段推荐响应
   */
  private parseFieldSuggestions(response: string): FieldDefinition[] {
    try {
      const json = this.extractJSON(response);
      const fields = JSON.parse(json);
      return fields.map((f: any) => ({
        name: f.name,
        displayName: f.displayName,
        type: f.type as FieldType,
        required: f.required ?? false,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 验证并修正生成的模型
   * 确保模型定义符合平台规范
   */
  private validateAndFixModels(models: ModelDefinition[]): ModelDefinition[] {
    return models.map((model) => ({
      ...model,
      name: this.toPascalCase(model.name),
      fields: (model.fields || []).map((field) => ({
        ...field,
        name: this.toCamelCase(field.name),
        type: this.normalizeFieldType(field.type),
        required: field.required ?? false,
      })),
      relations: model.relations || [],
    }));
  }

  /**
   * 转换为 PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * 转换为 camelCase
   */
  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  /**
   * 规范化字段类型
   * 将 LLM 返回的各种类型表述映射为标准枚举值
   */
  private normalizeFieldType(type: string): FieldType {
    const mapping: Record<string, FieldType> = {
      text: FieldType.TEXT,
      string: FieldType.TEXT,
      number: FieldType.NUMBER,
      integer: FieldType.NUMBER,
      float: FieldType.NUMBER,
      date: FieldType.DATE,
      datetime: FieldType.DATE,
      boolean: FieldType.BOOLEAN,
      bool: FieldType.BOOLEAN,
      enum: FieldType.ENUM,
      email: FieldType.EMAIL,
      url: FieldType.URL,
      phone: FieldType.PHONE,
      json: FieldType.JSON,
      object: FieldType.JSON,
    };
    return mapping[type.toLowerCase()] || FieldType.TEXT;
  }

  /**
   * 演示模式的响应
   * 未配置 API Key 时返回示例数据
   */
  private getDemoResponse(prompt: string): string {
    if (prompt.includes('推荐')) {
      return JSON.stringify([
        { name: 'status', displayName: '状态', type: 'enum', required: false },
        { name: 'remark', displayName: '备注', type: 'text', required: false },
      ]);
    }

    if (prompt.includes('推断')) {
      return '[]';
    }

    return JSON.stringify([
      {
        name: 'DemoModel',
        displayName: '示例模型',
        description: 'AI 生成的示例模型（演示模式）',
        fields: [
          { name: 'name', displayName: '名称', type: 'text', required: true },
          { name: 'description', displayName: '描述', type: 'text', required: false },
          { name: 'status', displayName: '状态', type: 'enum', required: true, enumValues: ['active', 'inactive'] },
        ],
        relations: [],
      },
    ]);
  }
}
