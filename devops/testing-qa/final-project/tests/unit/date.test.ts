import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, relativeTime, isToday, getCurrentTimestamp, generateId } from '@/utils/date.js';

describe('日期工具函数', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCurrentTimestamp', () => {
    it('返回当前时间的 ISO 字符串', () => {
      const result = getCurrentTimestamp();
      expect(result).toBe('2024-06-15T12:00:00.000Z');
    });
  });

  describe('generateId', () => {
    it('返回 UUID 格式的字符串', () => {
      const id = generateId();
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('每次调用返回不同的 ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('formatDate', () => {
    it('正确格式化日期为中文格式', () => {
      const result = formatDate('2024-06-15T08:30:00.000Z');
      expect(result).toContain('2024');
      expect(result).toContain('06');
      expect(result).toContain('15');
    });
  });

  describe('relativeTime', () => {
    it('刚刚的事件显示秒数', () => {
      const result = relativeTime('2024-06-15T11:59:30.000Z');
      expect(result).toBe('30 秒前');
    });

    it('几分钟前的事件正确显示', () => {
      const result = relativeTime('2024-06-15T11:55:00.000Z');
      expect(result).toBe('5 分钟前');
    });

    it('几小时前的事件正确显示', () => {
      const result = relativeTime('2024-06-15T09:00:00.000Z');
      expect(result).toBe('3 小时前');
    });

    it('几天前的事件正确显示', () => {
      const result = relativeTime('2024-06-10T12:00:00.000Z');
      expect(result).toBe('5 天前');
    });

    it('未来的日期显示刚刚', () => {
      const result = relativeTime('2024-06-15T13:00:00.000Z');
      expect(result).toBe('刚刚');
    });

    it('超过 30 天的事件回退到格式化日期', () => {
      const result = relativeTime('2024-04-01T12:00:00.000Z');
      expect(result).toContain('2024');
    });
  });

  describe('isToday', () => {
    it('今天的日期返回 true', () => {
      expect(isToday('2024-06-15T15:00:00.000Z')).toBe(true);
    });

    it('昨天的日期返回 false', () => {
      expect(isToday('2024-06-14T12:00:00.000Z')).toBe(false);
    });

    it('明天的日期返回 false', () => {
      expect(isToday('2024-06-16T12:00:00.000Z')).toBe(false);
    });
  });
});
