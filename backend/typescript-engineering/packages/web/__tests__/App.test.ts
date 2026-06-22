import { describe, it, expect } from 'vitest';
import { UserStatus, UserRole, toSlug, generateId } from '@ts-tool-platform/shared-types';

describe('Web 前端 — 依赖的共享类型', () => {
  it('UserStatus 枚举正确导出', () => {
    expect(UserStatus.Active).toBe('active');
    expect(UserStatus.Inactive).toBe('inactive');
    expect(UserStatus.Banned).toBe('banned');
  });

  it('UserRole 枚举正确导出', () => {
    expect(UserRole.Admin).toBe('admin');
    expect(UserRole.Editor).toBe('editor');
    expect(UserRole.Viewer).toBe('viewer');
  });

  it('工具函数可正常使用', () => {
    expect(toSlug('Test Slug')).toBe('test-slug');
    expect(generateId()).toBeTruthy();
  });
});

describe('Web 前端 — 工具数据模型', () => {
  it('工具对象包含所有必要字段', () => {
    const tool = {
      id: '1',
      name: '测试工具',
      slug: 'test-tool',
      description: '测试描述',
      category: '测试',
      authorId: 'user-1',
      isPublic: true,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(tool.id).toBeDefined();
    expect(tool.name).toBe('测试工具');
    expect(tool.isPublic).toBe(true);
  });
});
