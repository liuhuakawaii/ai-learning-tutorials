import { describe, it, expect } from 'vitest';
import { isValidEmail, isValidUrl, checkPasswordStrength, isValidPhone, isNonEmpty } from '@/utils/validate.js';

describe('验证工具函数', () => {
  describe('isValidEmail', () => {
    it('有效的邮箱地址', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('带子域名的邮箱', () => {
      expect(isValidEmail('user@mail.example.com')).toBe(true);
    });

    it('缺少 @ 符号', () => {
      expect(isValidEmail('userexample.com')).toBe(false);
    });

    it('缺少域名', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    it('空字符串', () => {
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('有效的 HTTPS URL', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('有效的 HTTP URL', () => {
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('无效的 URL', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
    });

    it('空字符串', () => {
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('checkPasswordStrength', () => {
    it('弱密码：短且无复杂度', () => {
      const result = checkPasswordStrength('123');
      expect(result.level).toBe('weak');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('中等密码：8 位含大小写和数字', () => {
      const result = checkPasswordStrength('Abc12345');
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('强密码：12 位含大小写、数字和特殊字符', () => {
      const result = checkPasswordStrength('Abc12345!@#$');
      expect(result.level).toBe('strong');
      expect(result.suggestions).toHaveLength(0);
    });

    it('建议列表包含缺失的要素', () => {
      const result = checkPasswordStrength('abcdefgh');
      expect(result.suggestions).toContain('包含数字');
      expect(result.suggestions).toContain('包含特殊字符');
    });
  });

  describe('isValidPhone', () => {
    it('有效的手机号', () => {
      expect(isValidPhone('13800138000')).toBe(true);
    });

    it('无效的手机号（太短）', () => {
      expect(isValidPhone('1380013')).toBe(false);
    });

    it('无效的手机号（错误开头）', () => {
      expect(isValidPhone('12345678901')).toBe(false);
    });

    it('空字符串', () => {
      expect(isValidPhone('')).toBe(false);
    });
  });

  describe('isNonEmpty', () => {
    it('非空字符串', () => {
      expect(isNonEmpty('hello')).toBe(true);
    });

    it('空字符串', () => {
      expect(isNonEmpty('')).toBe(false);
    });

    it('只有空白', () => {
      expect(isNonEmpty('   ')).toBe(false);
    });

    it('null', () => {
      expect(isNonEmpty(null)).toBe(false);
    });

    it('undefined', () => {
      expect(isNonEmpty(undefined)).toBe(false);
    });

    it('非空数组', () => {
      expect(isNonEmpty([1, 2, 3])).toBe(true);
    });

    it('空数组', () => {
      expect(isNonEmpty([])).toBe(false);
    });

    it('非空对象', () => {
      expect(isNonEmpty({ a: 1 })).toBe(true);
    });

    it('空对象', () => {
      expect(isNonEmpty({})).toBe(false);
    });
  });
});
