import { describe, it, expect, beforeEach } from 'vitest';
import { db, userRoutes, toolRoutes, createContext, runMiddleware, requestLogger, authGuard } from '../src/index';
import { UserStatus, UserRole } from '@ts-tool-platform/shared-types';

describe('数据库层', () => {
  beforeEach(() => {
    db.clear();
  });

  it('创建并查询用户', () => {
    const user = db.createUser({
      email: 'test@example.com',
      name: '测试用户',
      role: UserRole.Viewer,
      status: UserStatus.Active,
    });
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');

    const found = db.findUserById(user.id);
    expect(found?.name).toBe('测试用户');
  });

  it('按邮箱查找用户', () => {
    db.createUser({ email: 'a@b.com', name: 'A', role: UserRole.Viewer, status: UserStatus.Active });
    expect(db.findUserByEmail('a@b.com')?.name).toBe('A');
    expect(db.findUserByEmail('x@y.com')).toBeUndefined();
  });

  it('更新用户', () => {
    const user = db.createUser({ email: 'u@test.com', name: 'U', role: UserRole.Viewer, status: UserStatus.Active });
    const updated = db.updateUser(user.id, { name: 'Updated' });
    expect(updated?.name).toBe('Updated');
  });

  it('删除用户', () => {
    const user = db.createUser({ email: 'd@t.com', name: 'D', role: UserRole.Viewer, status: UserStatus.Active });
    expect(db.deleteUser(user.id)).toBe(true);
    expect(db.findUserById(user.id)).toBeUndefined();
  });

  it('创建并查询工具', () => {
    const tool = db.createTool({
      name: 'JSON 格式化',
      slug: 'json-formatter',
      description: '格式化 JSON 数据',
      category: '开发工具',
      authorId: 'user-1',
      isPublic: true,
      version: '1.0.0',
    });
    expect(tool.id).toBeDefined();
    expect(db.findToolBySlug('json-formatter')?.name).toBe('JSON 格式化');
  });
});

describe('路由层', () => {
  beforeEach(() => {
    db.clear();
  });

  it('用户列表路由返回分页结果', async () => {
    // 预填充数据
    for (let i = 0; i < 15; i++) {
      db.createUser({ email: `u${i}@t.com`, name: `U${i}`, role: UserRole.Viewer, status: UserStatus.Active });
    }
    const res = await userRoutes.list({ page: '1', pageSize: '10' });
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as unknown[]).length).toBe(10);
    expect(res.meta?.total).toBe(15);
    expect(res.meta?.totalPages).toBe(2);
  });

  it('创建用户路由校验必填字段', async () => {
    const res = await userRoutes.create({}, { email: '', name: '' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('VALIDATION_ERROR');
  });

  it('创建用户路由成功', async () => {
    const res = await userRoutes.create({}, {
      email: 'new@t.com',
      name: '新用户',
      role: UserRole.Editor,
      status: UserStatus.Active,
    });
    expect(res.success).toBe(true);
    expect((res.data as { email: string }).email).toBe('new@t.com');
  });

  it('创建工具路由成功', async () => {
    const res = await toolRoutes.create({}, {
      name: 'Base64 编码',
      slug: 'base64',
      description: 'Base64 编解码',
      category: '编码工具',
      authorId: 'user-1',
      isPublic: true,
      version: '1.0.0',
    });
    expect(res.success).toBe(true);
  });
});

describe('中间件', () => {
  it('请求上下文包含必要字段', () => {
    const ctx = createContext('user-1', 'admin');
    expect(ctx.userId).toBe('user-1');
    expect(ctx.userRole).toBe('admin');
    expect(ctx.requestId).toBeDefined();
    expect(ctx.timestamp).toBeInstanceOf(Date);
  });

  it('中间件管道按顺序执行', async () => {
    const order: number[] = [];
    const m1 = async (_ctx: unknown, next: () => Promise<void>) => { order.push(1); await next(); };
    const m2 = async (_ctx: unknown, next: () => Promise<void>) => { order.push(2); await next(); };
    const ctx = createContext();
    await runMiddleware([m1 as any, m2 as any], ctx);
    expect(order).toEqual([1, 2]);
  });

  it('authGuard 在无用户时抛出错误', async () => {
    const ctx = createContext();
    await expect(runMiddleware([authGuard], ctx)).rejects.toThrow('认证失败');
  });

  it('authGuard 在有用户时正常通过', async () => {
    const ctx = createContext('user-1', 'admin');
    let passed = false;
    const markPass = async (_ctx: unknown, next: () => Promise<void>) => { passed = true; await next(); };
    await runMiddleware([authGuard, markPass as any], ctx);
    expect(passed).toBe(true);
  });
});
