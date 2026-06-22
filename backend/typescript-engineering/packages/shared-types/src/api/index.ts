/** API 统一响应结构 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/** API 错误结构 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** 分页响应元数据 */
export interface ResponseMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** 分页列表响应 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: ResponseMeta;
}

/** HTTP 请求方法 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** API 路由定义 */
export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: string;
  middleware?: string[];
}

/** 请求上下文（用于中间件传递数据） */
export interface RequestContext {
  userId?: string;
  userRole?: string;
  requestId: string;
  timestamp: Date;
}

/** 创建成功响应的辅助函数 */
export function createSuccessResponse<T>(data: T, meta?: ResponseMeta): ApiResponse<T> {
  return { success: true, data, meta };
}

/** 创建错误响应的辅助函数 */
export function createErrorResponse(code: string, message: string, details?: Record<string, unknown>): ApiResponse {
  return { success: false, error: { code, message, details } };
}
