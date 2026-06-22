/**
 * AI 对话模块
 * 提供内嵌 ChatBot 能力，支持知识库问答和上下文感知对话
 */

/** 对话配置 */
interface ChatConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 知识库内容 */
  knowledgeBase?: string[];
}

/** 对话消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

/** 对话会话 */
interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AI 对话助手
 * 提供多轮对话、知识库检索和上下文感知能力
 */
export class AIChatAssistant {
  private config: ChatConfig;
  private sessions: Map<string, ChatSession> = new Map();

  constructor(config: ChatConfig = {}) {
    this.config = {
      model: 'gpt-4',
      systemPrompt: '你是一个低代码平台的 AI 助手，可以帮助用户解答关于平台使用、数据管理、页面搭建等问题。',
      ...config,
    };
  }

  /**
   * 创建新的对话会话
   */
  createSession(context: Record<string, any> = {}): string {
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.sessions.set(sessionId, {
      id: sessionId,
      messages: [
        {
          role: 'system',
          content: this.config.systemPrompt || '',
          timestamp: new Date(),
        },
      ],
      context,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return sessionId;
  }

  /**
   * 发送消息并获取 AI 回复
   * @param sessionId 会话 ID
   * @param userMessage 用户消息
   * @returns AI 的回复内容
   */
  async chat(sessionId: string, userMessage: string): Promise<{
    reply: string;
    suggestions?: string[];
    actions?: { type: string; payload: any }[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`对话会话不存在: ${sessionId}`);
    }

    // 添加用户消息
    session.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // 检索知识库获取相关上下文
    const relevantContext = this.searchKnowledgeBase(userMessage);

    // 构建带上下文的提示
    const messages = this.buildMessagesWithContext(session, relevantContext);

    // 调用 LLM
    const response = await this.callLLM(messages);

    // 解析回复（可能包含结构化动作指令）
    const parsed = this.parseResponse(response);

    // 添加助手回复
    session.messages.push({
      role: 'assistant',
      content: parsed.reply,
      timestamp: new Date(),
    });
    session.updatedAt = new Date();

    return parsed;
  }

  /**
   * 获取会话历史
   */
  getSessionHistory(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session?.messages.filter((m) => m.role !== 'system') || [];
  }

  /**
   * 清除会话
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * 更新会话上下文
   * 用于注入当前页面、数据模型等上下文信息
   */
  updateContext(sessionId: string, context: Record<string, any>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.context = { ...session.context, ...context };
    }
  }

  /**
   * 知识库检索
   * 基于关键词匹配从知识库中检索相关内容
   */
  private searchKnowledgeBase(query: string): string[] {
    const knowledgeBase = this.config.knowledgeBase || [];
    if (knowledgeBase.length === 0) return [];

    // 简单的关键词匹配（生产环境应使用向量检索）
    const keywords = query
      .toLowerCase()
      .split(/[\s,，。！？]+/)
      .filter((w) => w.length > 1);

    return knowledgeBase
      .map((doc) => ({
        doc,
        score: keywords.filter((kw) => doc.toLowerCase().includes(kw)).length,
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.doc);
  }

  /**
   * 构建带上下文的消息列表
   * 将知识库检索结果和会话上下文注入消息中
   */
  private buildMessagesWithContext(session: ChatSession, knowledge: string[]): ChatMessage[] {
    const messages = [...session.messages];

    // 注入知识库上下文
    if (knowledge.length > 0) {
      messages.splice(1, 0, {
        role: 'system',
        content: `以下是与用户问题相关的知识库内容：\n\n${knowledge.join('\n\n---\n\n')}`,
      });
    }

    // 注入会话上下文
    if (Object.keys(session.context).length > 0) {
      messages.splice(1, 0, {
        role: 'system',
        content: `当前上下文信息：${JSON.stringify(session.context)}`,
      });
    }

    // 只保留最近 20 条消息以控制 token 用量
    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system').slice(-20);

    return [...systemMessages, ...otherMessages];
  }

  /**
   * 解析 AI 回复
   * 检测回复中是否包含结构化动作指令
   */
  private parseResponse(response: string): {
    reply: string;
    suggestions?: string[];
    actions?: { type: string; payload: any }[];
  } {
    // 尝试从回复中提取 JSON 动作指令
    const actionMatch = response.match(/```actions?\s*([\s\S]*?)```/);
    let actions: { type: string; payload: any }[] | undefined;

    if (actionMatch) {
      try {
        actions = JSON.parse(actionMatch[1].trim());
      } catch {
        // 解析失败，忽略动作
      }
    }

    // 提取建议
    const suggestionMatch = response.match(/```suggestions?\s*([\s\S]*?)```/);
    let suggestions: string[] | undefined;

    if (suggestionMatch) {
      try {
        suggestions = JSON.parse(suggestionMatch[1].trim());
      } catch {
        // 解析失败，忽略建议
      }
    }

    // 清理回复中的结构化标记
    const cleanReply = response
      .replace(/```actions?\s*[\s\S]*?```/g, '')
      .replace(/```suggestions?\s*[\s\S]*?```/g, '')
      .trim();

    return {
      reply: cleanReply || response,
      suggestions,
      actions,
    };
  }

  /**
   * 调用 LLM 服务
   */
  private async callLLM(messages: ChatMessage[]): Promise<string> {
    const { apiKey, model, baseUrl } = this.config;

    if (!apiKey) {
      return this.getDemoResponse(messages);
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
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
      }),
    });

    if (!response.ok) throw new Error(`LLM 调用失败: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * 演示模式回复
   */
  private getDemoResponse(messages: ChatMessage[]): string {
    const lastMessage = messages[messages.length - 1]?.content || '';

    if (lastMessage.includes('帮助') || lastMessage.includes('怎么')) {
      return '我可以帮助您：\n\n1. **创建数据模型** - 告诉我您需要什么业务数据\n2. **搭建页面** - 描述您想要的页面布局\n3. **查询数据** - 用自然语言描述查询需求\n4. **排查问题** - 描述您遇到的问题\n\n请告诉我您需要什么帮助？\n\n```suggestions\n["如何创建数据模型？", "帮我生成一个列表页", "查询本月新增数据"]\n```';
    }

    if (lastMessage.includes('模型') || lastMessage.includes('数据')) {
      return '好的，您可以通过以下方式创建数据模型：\n\n1. 在左侧菜单选择「数据建模」\n2. 点击「新建模型」\n3. 添加字段并设置类型\n\n或者直接告诉我您的业务需求，我可以帮您自动生成模型定义。';
    }

    return '我是低代码平台的 AI 助手（演示模式）。您可以向我咨询平台使用方法、数据建模、页面搭建等问题。\n\n```suggestions\n["平台有哪些功能？", "如何部署到生产环境？", "怎么设置权限？"]\n```';
  }
}
