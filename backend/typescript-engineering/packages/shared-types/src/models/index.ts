/** 用户状态枚举 */
export enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Banned = 'banned',
}

/** 用户角色枚举 */
export enum UserRole {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
}

/** 用户模型 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建用户时的输入参数（排除自动生成的字段） */
export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;

/** 更新用户时的输入参数（所有字段可选） */
export type UpdateUserInput = Partial<CreateUserInput>;

/** 工具模型 */
export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  authorId: string;
  isPublic: boolean;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建工具时的输入参数 */
export type CreateToolInput = Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>;

/** 更新工具时的输入参数 */
export type UpdateToolInput = Partial<CreateToolInput>;

/** 分页查询参数 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** 排序方向 */
export type SortDirection = 'asc' | 'desc';

/** 排序参数 */
export interface SortParams {
  field: string;
  direction: SortDirection;
}

/** 列表查询参数（组合分页与排序） */
export interface ListQueryParams extends PaginationParams {
  sort?: SortParams;
  search?: string;
}
