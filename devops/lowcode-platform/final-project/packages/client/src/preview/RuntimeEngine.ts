/**
 * 页面运行时引擎
 * 负责页面运行时的数据加载、事件处理和状态管理
 */

export class RuntimeEngine {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = '/api') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * 调用 API 接口
   * 支持 GET、POST、PUT、DELETE 方法
   */
  async callApi(
    endpoint: string,
    method: string = 'GET',
    body?: Record<string, any>
  ): Promise<any> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiBaseUrl}${endpoint}`;

    const options: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // 附加认证 token
    const token = this.getAuthToken();
    if (token) {
      (options.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    if (body && method.toUpperCase() !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 在沙箱中执行用户自定义脚本
   * 提供状态读写能力
   */
  executeScript(
    script: string,
    state: Record<string, any>,
    setState: (updater: (prev: Record<string, any>) => void) => void
  ): any {
    // 提供安全的上下文变量
    const context = {
      state,
      setState: (key: string, value: any) => {
        setState((prev) => ({ ...prev, [key]: value }));
      },
      console: {
        log: (...args: any[]) => console.log('[页面脚本]', ...args),
        error: (...args: any[]) => console.error('[页面脚本]', ...args),
      },
    };

    try {
      const fn = new Function('ctx', `with(ctx) { ${script} }`);
      return fn(context);
    } catch (error) {
      console.error('[页面脚本] 执行错误:', error);
      throw error;
    }
  }

  /**
   * 加载数据模型的数据
   */
  async loadModelData(
    modelName: string,
    options: {
      page?: number;
      pageSize?: number;
      filters?: Record<string, any>;
      sort?: { field: string; order: 'asc' | 'desc' };
    } = {}
  ): Promise<any> {
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('pageSize', String(options.pageSize));
    if (options.sort) params.set('sort', JSON.stringify(options.sort));
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        params.set(key, String(value));
      }
    }

    const query = params.toString();
    return this.callApi(`/data/${modelName}${query ? `?${query}` : ''}`);
  }

  /**
   * 保存表单数据到指定模型
   */
  async saveFormData(modelName: string, data: Record<string, any>): Promise<any> {
    return this.callApi(`/data/${modelName}`, 'POST', data);
  }

  /**
   * 获取本地存储的认证 token
   */
  private getAuthToken(): string | null {
    try {
      return localStorage.getItem('lowcode_token');
    } catch {
      return null;
    }
  }
}
