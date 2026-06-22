/**
 * RBAC（基于角色的访问控制）权限管理
 * 实现角色定义、权限分配、权限校验的完整链路
 */

import { getPrismaClient } from '../models/schema';

/** 权限定义 */
export interface Permission {
  /** 资源类型（如 model、page、workflow） */
  resource: string;
  /** 操作类型（create、read、update、delete） */
  action: string;
  /** 是否允许 */
  allowed: boolean;
}

/** 角色定义 */
export interface Role {
  /** 角色名称 */
  name: string;
  /** 角色显示名 */
  displayName: string;
  /** 权限列表 */
  permissions: Permission[];
}

/**
 * 内置角色定义
 * ADMIN: 超级管理员，拥有所有权限
 * USER: 普通用户，拥有基本的 CRUD 权限
 * GUEST: 访客，只有只读权限
 */
const BUILTIN_ROLES: Role[] = [
  {
    name: 'ADMIN',
    displayName: '管理员',
    permissions: [
      { resource: 'model', action: 'create', allowed: true },
      { resource: 'model', action: 'read', allowed: true },
      { resource: 'model', action: 'update', allowed: true },
      { resource: 'model', action: 'delete', allowed: true },
      { resource: 'page', action: 'create', allowed: true },
      { resource: 'page', action: 'read', allowed: true },
      { resource: 'page', action: 'update', allowed: true },
      { resource: 'page', action: 'delete', allowed: true },
      { resource: 'workflow', action: 'create', allowed: true },
      { resource: 'workflow', action: 'read', allowed: true },
      { resource: 'workflow', action: 'update', allowed: true },
      { resource: 'workflow', action: 'delete', allowed: true },
      { resource: 'workflow', action: 'execute', allowed: true },
      { resource: 'user', action: 'create', allowed: true },
      { resource: 'user', action: 'read', allowed: true },
      { resource: 'user', action: 'update', allowed: true },
      { resource: 'user', action: 'delete', allowed: true },
      { resource: 'settings', action: 'read', allowed: true },
      { resource: 'settings', action: 'update', allowed: true },
      { resource: 'audit', action: 'read', allowed: true },
    ],
  },
  {
    name: 'USER',
    displayName: '普通用户',
    permissions: [
      { resource: 'model', action: 'create', allowed: true },
      { resource: 'model', action: 'read', allowed: true },
      { resource: 'model', action: 'update', allowed: true },
      { resource: 'page', action: 'create', allowed: true },
      { resource: 'page', action: 'read', allowed: true },
      { resource: 'page', action: 'update', allowed: true },
      { resource: 'workflow', action: 'read', allowed: true },
      { resource: 'workflow', action: 'execute', allowed: true },
      { resource: 'user', action: 'read', allowed: true },
    ],
  },
  {
    name: 'GUEST',
    displayName: '访客',
    permissions: [
      { resource: 'model', action: 'read', allowed: true },
      { resource: 'page', action: 'read', allowed: true },
      { resource: 'workflow', action: 'read', allowed: true },
    ],
  },
];

/**
 * RBAC 权限管理器
 * 提供角色管理和权限校验能力
 */
export class RBACManager {
  private prisma = getPrismaClient();
  private customRoles: Map<string, Role> = new Map();

  constructor() {
    // 加载内置角色
    for (const role of BUILTIN_ROLES) {
      this.customRoles.set(role.name, role);
    }
  }

  /**
   * 检查用户是否有指定权限
   * @param roleName 用户角色名
   * @param resource 资源类型
   * @param action 操作类型
   */
  hasPermission(roleName: string, resource: string, action: string): boolean {
    const role = this.customRoles.get(roleName);
    if (!role) return false;

    const permission = role.permissions.find(
      (p) => p.resource === resource && p.action === action
    );

    return permission?.allowed ?? false;
  }

  /**
   * 检查用户对指定资源实例的访问权限
   * 支持数据行级权限控制：用户只能访问自己创建的数据或被明确授权的数据
   */
  async checkRowLevelAccess(
    userId: string,
    resource: string,
    resourceId: string,
    action: string
  ): Promise<boolean> {
    // 管理员跳过行级权限检查
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'ADMIN') return true;

    // 基本权限检查
    if (!this.hasPermission(user?.role || 'GUEST', resource, action)) {
      return false;
    }

    // 行级权限：检查数据记录的创建者
    if (resource === 'data') {
      const record = await this.prisma.dataRecord.findUnique({
        where: { id: resourceId },
      });

      if (!record) return false;

      // 只有创建者可以修改/删除自己的数据
      const data = record.data as any;
      if (['update', 'delete'].includes(action) && data.__createdBy !== userId) {
        return false;
      }
    }

    return true;
  }

  /**
   * 添加自定义角色
   */
  addRole(role: Role): void {
    this.customRoles.set(role.name, role);
  }

  /**
   * 获取角色权限列表
   */
  getRolePermissions(roleName: string): Permission[] {
    return this.customRoles.get(roleName)?.permissions || [];
  }

  /**
   * 获取所有角色列表
   */
  listRoles(): Role[] {
    return Array.from(this.customRoles.values());
  }

  /**
   * 检查数据行归属
   * 用于限制用户只能操作自己创建的数据
   */
  async filterByOwnership(
    userId: string,
    roleName: string,
    records: any[]
  ): Promise<any[]> {
    // 管理员看到所有数据
    if (roleName === 'ADMIN') return records;

    // 普通用户只能看到自己创建的数据
    return records.filter((record) => {
      const data = record.data || {};
      return data.__createdBy === userId;
    });
  }
}
