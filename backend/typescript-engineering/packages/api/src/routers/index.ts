import type { ApiResponse, PaginatedResponse, CreateUserInput, UpdateUserInput, CreateToolInput, UpdateToolInput } from '@ts-tool-platform/shared-types';
import { createSuccessResponse, createErrorResponse } from '@ts-tool-platform/shared-types';
import { db } from '../db/index';
import type { User, Tool } from '@ts-tool-platform/shared-types';

/** 路由处理器函数类型 */
type RouteHandler = (params: Record<string, string>, body?: unknown) => Promise<ApiResponse>;

/**
 * 用户路由处理器
 * 提供用户的 CRUD 操作
 */
export const userRoutes: Record<string, RouteHandler> = {
  /** 获取用户列表，支持分页 */
  async list(params) {
    const page = Number(params.page ?? '1');
    const pageSize = Number(params.pageSize ?? '10');
    const allUsers = db.findAllUsers();
    const total = allUsers.length;
    const start = (page - 1) * pageSize;
    const items = allUsers.slice(start, start + pageSize);
    return createSuccessResponse(items, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  },

  /** 按 ID 获取单个用户 */
  async getById(params) {
    const user = db.findUserById(params.id);
    if (!user) return createErrorResponse('NOT_FOUND', `用户 ${params.id} 不存在`);
    return createSuccessResponse(user);
  },

  /** 创建新用户 */
  async create(_params, body) {
    const input = body as CreateUserInput;
    if (!input.email || !input.name) {
      return createErrorResponse('VALIDATION_ERROR', '邮箱和名称为必填字段');
    }
    const existing = db.findUserByEmail(input.email);
    if (existing) {
      return createErrorResponse('CONFLICT', `邮箱 ${input.email} 已被使用`);
    }
    const user = db.createUser(input);
    return createSuccessResponse(user);
  },

  /** 更新用户信息 */
  async update(params, body) {
    const input = body as UpdateUserInput;
    const user = db.updateUser(params.id, input);
    if (!user) return createErrorResponse('NOT_FOUND', `用户 ${params.id} 不存在`);
    return createSuccessResponse(user);
  },

  /** 删除用户 */
  async delete(params) {
    const deleted = db.deleteUser(params.id);
    if (!deleted) return createErrorResponse('NOT_FOUND', `用户 ${params.id} 不存在`);
    return createSuccessResponse({ deleted: true });
  },
};

/**
 * 工具路由处理器
 * 提供工具的 CRUD 操作
 */
export const toolRoutes: Record<string, RouteHandler> = {
  /** 获取工具列表，支持分页 */
  async list(params) {
    const page = Number(params.page ?? '1');
    const pageSize = Number(params.pageSize ?? '10');
    const allTools = db.findAllTools();
    const total = allTools.length;
    const start = (page - 1) * pageSize;
    const items = allTools.slice(start, start + pageSize);
    return createSuccessResponse(items, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  },

  /** 按 ID 获取单个工具 */
  async getById(params) {
    const tool = db.findToolById(params.id);
    if (!tool) return createErrorResponse('NOT_FOUND', `工具 ${params.id} 不存在`);
    return createSuccessResponse(tool);
  },

  /** 按 slug 获取单个工具 */
  async getBySlug(params) {
    const tool = db.findToolBySlug(params.slug);
    if (!tool) return createErrorResponse('NOT_FOUND', `工具 ${params.slug} 不存在`);
    return createSuccessResponse(tool);
  },

  /** 创建新工具 */
  async create(_params, body) {
    const input = body as CreateToolInput;
    if (!input.name || !input.slug) {
      return createErrorResponse('VALIDATION_ERROR', '名称和 slug 为必填字段');
    }
    const tool = db.createTool(input);
    return createSuccessResponse(tool);
  },

  /** 更新工具信息 */
  async update(params, body) {
    const input = body as UpdateToolInput;
    const tool = db.updateTool(params.id, input);
    if (!tool) return createErrorResponse('NOT_FOUND', `工具 ${params.id} 不存在`);
    return createSuccessResponse(tool);
  },

  /** 删除工具 */
  async delete(params) {
    const deleted = db.deleteTool(params.id);
    if (!deleted) return createErrorResponse('NOT_FOUND', `工具 ${params.id} 不存在`);
    return createSuccessResponse({ deleted: true });
  },
};
