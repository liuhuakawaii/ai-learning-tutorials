import type { User, Tool, CreateUserInput, CreateToolInput, UpdateUserInput, UpdateToolInput } from '@ts-tool-platform/shared-types';
import { generateId } from '@ts-tool-platform/shared-types';

/**
 * 简易内存数据库
 * 生产环境应替换为 Prisma / Drizzle 等 ORM 连接真实数据库
 */
export class InMemoryDB {
  private users: Map<string, User> = new Map();
  private tools: Map<string, Tool> = new Map();

  // ── 用户操作 ──

  /** 查询所有用户 */
  findAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  /** 按 ID 查询用户 */
  findUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  /** 按邮箱查询用户 */
  findUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }

  /** 创建用户 */
  createUser(input: CreateUserInput): User {
    const now = new Date();
    const user: User = {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  /** 更新用户 */
  updateUser(id: string, input: UpdateUserInput): User | undefined {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated: User = { ...existing, ...input, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  /** 删除用户 */
  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  // ── 工具操作 ──

  /** 查询所有工具 */
  findAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /** 按 ID 查询工具 */
  findToolById(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  /** 按 slug 查询工具 */
  findToolBySlug(slug: string): Tool | undefined {
    return Array.from(this.tools.values()).find((t) => t.slug === slug);
  }

  /** 创建工具 */
  createTool(input: CreateToolInput): Tool {
    const now = new Date();
    const tool: Tool = {
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    this.tools.set(tool.id, tool);
    return tool;
  }

  /** 更新工具 */
  updateTool(id: string, input: UpdateToolInput): Tool | undefined {
    const existing = this.tools.get(id);
    if (!existing) return undefined;
    const updated: Tool = { ...existing, ...input, updatedAt: new Date() };
    this.tools.set(id, updated);
    return updated;
  }

  /** 删除工具 */
  deleteTool(id: string): boolean {
    return this.tools.delete(id);
  }

  /** 清空所有数据（用于测试） */
  clear(): void {
    this.users.clear();
    this.tools.clear();
  }
}

/** 全局数据库实例（单例） */
export const db = new InMemoryDB();
