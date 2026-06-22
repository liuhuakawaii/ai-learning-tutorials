export type Role = 'owner' | 'admin' | 'member';
export type Action =
  | 'team:update'
  | 'team:delete'
  | 'member:invite'
  | 'member:remove'
  | 'project:create'
  | 'project:update'
  | 'project:delete'
  | 'document:create'
  | 'document:delete'
  | 'billing:update'
  | 'audit:read';

const matrix: Record<Role, Action[]> = {
  owner: [
    'team:update', 'team:delete', 'member:invite', 'member:remove',
    'project:create', 'project:update', 'project:delete',
    'document:create', 'document:delete',
    'billing:update', 'audit:read',
  ],
  admin: [
    'team:update', 'member:invite', 'member:remove',
    'project:create', 'project:update', 'project:delete',
    'document:create', 'document:delete',
    'audit:read',
  ],
  member: [
    'project:create', 'project:update',
    'document:create', 'document:delete',
  ],
};

export function can(role: Role, action: Action): boolean {
  return matrix[role]?.includes(action) ?? false;
}

export function requirePermission(role: Role, action: Action) {
  if (!can(role, action)) {
    throw new Error(`Permission denied: ${role} cannot ${action}`);
  }
}
