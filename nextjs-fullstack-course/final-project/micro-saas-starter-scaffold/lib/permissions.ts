export type Role = 'owner' | 'admin' | 'member';
export type Action = 'team:update' | 'project:create' | 'project:delete' | 'billing:update';

const matrix: Record<Role, Action[]> = {
  owner: ['team:update', 'project:create', 'project:delete', 'billing:update'],
  admin: ['team:update', 'project:create', 'project:delete'],
  member: ['project:create']
};

export function can(role: Role, action: Action) {
  return matrix[role].includes(action);
}
