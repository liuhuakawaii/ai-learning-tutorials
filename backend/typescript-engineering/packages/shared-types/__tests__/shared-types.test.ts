import { describe, it, expect } from 'vitest';
import {
  UserStatus,
  UserRole,
  createSuccessResponse,
  createErrorResponse,
  generateId,
  toSlug,
  formatBytes,
  isNonEmpty,
  typedKeys,
} from '../src/index';

describe('共享类型 — 模型枚举', () => {
  it('UserStatus 包含三个状态', () => {
    expect(Object.values(UserStatus)).toHaveLength(3);
    expect(UserStatus.Active).toBe('active');
  });

  it('UserRole 包含三个角色', () => {
    expect(Object.values(UserRole)).toHaveLength(3);
    expect(UserRole.Admin).toBe('admin');
  });
});

describe('共享类型 — API 响应构造', () => {
  it('createSuccessResponse 生成正确结构', () => {
    const res = createSuccessResponse({ id: '1', name: 'test' });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: '1', name: 'test' });
    expect(res.error).toBeUndefined();
  });

  it('createSuccessResponse 支持分页元数据', () => {
    const res = createSuccessResponse([1, 2], { page: 1, pageSize: 10, total: 2, totalPages: 1 });
    expect(res.meta?.total).toBe(2);
  });

  it('createErrorResponse 生成正确错误结构', () => {
    const res = createErrorResponse('NOT_FOUND', '资源不存在');
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('NOT_FOUND');
    expect(res.error?.message).toBe('资源不存在');
  });
});

describe('共享类型 — 工具函数', () => {
  it('generateId 返回非空字符串', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generateId 每次生成不同值', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('toSlug 正确转换中英文混合字符串', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
    expect(toSlug('  Multiple   Spaces  ')).toBe('multiple-spaces');
    expect(toSlug('special!@#chars')).toBe('specialchars');
  });

  it('formatBytes 正确格式化字节数', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
  });

  it('isNonEmpty 正确判断非空值', () => {
    expect(isNonEmpty('hello')).toBe(true);
    expect(isNonEmpty('')).toBe(false);
    expect(isNonEmpty('   ')).toBe(false);
    expect(isNonEmpty(null)).toBe(false);
    expect(isNonEmpty(undefined)).toBe(false);
    expect(isNonEmpty(123)).toBe(false);
  });

  it('typedKeys 返回对象的键数组', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const keys = typedKeys(obj);
    expect(keys).toHaveLength(3);
    expect(keys).toContain('a');
    expect(keys).toContain('b');
    expect(keys).toContain('c');
  });
});
