import { describe, it, expect } from 'vitest';
import { sanitize, truncate, highlight, toSlug, wordCount, containsSensitiveWords } from '@/utils/string.js';

describe('字符串工具函数', () => {
  describe('sanitize', () => {
    it('去除首尾空白', () => {
      expect(sanitize('  hello  ')).toBe('hello');
    });

    it('将多个空白压缩为单个空格', () => {
      expect(sanitize('hello   world')).toBe('hello world');
    });

    it('处理制表符和换行符', () => {
      expect(sanitize('hello\t\n  world')).toBe('hello world');
    });

    it('空字符串返回空字符串', () => {
      expect(sanitize('')).toBe('');
    });
  });

  describe('truncate', () => {
    it('短文本不截断', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('超长文本截断并添加省略号', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('精确长度不截断', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });

    it('maxLength 为 3 或更小时直接截取', () => {
      expect(truncate('hello', 3)).toBe('hel');
    });

    it('maxLength 为负数时抛出错误', () => {
      expect(() => truncate('hello', -1)).toThrow('maxLength 不能为负数');
    });
  });

  describe('highlight', () => {
    it('高亮匹配的关键词', () => {
      expect(highlight('hello world', 'world')).toBe('hello **world**');
    });

    it('大小写不敏感匹配', () => {
      expect(highlight('Hello World', 'hello')).toBe('**Hello** World');
    });

    it('空关键词返回原文', () => {
      expect(highlight('hello world', '')).toBe('hello world');
    });

    it('转义特殊字符', () => {
      expect(highlight('price is $100', '$100')).toBe('price is **$100**');
    });
  });

  describe('toSlug', () => {
    it('基本英文转换', () => {
      expect(toSlug('Hello World')).toBe('hello-world');
    });

    it('去除特殊字符', () => {
      expect(toSlug('Hello! @World#')).toBe('hello-world');
    });

    it('保留中文字符', () => {
      expect(toSlug('你好 世界')).toBe('你好-世界');
    });

    it('处理多余连字符', () => {
      expect(toSlug('  hello  -- world  ')).toBe('hello-world');
    });
  });

  describe('wordCount', () => {
    it('统计英文单词数', () => {
      expect(wordCount('hello world')).toBe(2);
    });

    it('空字符串返回 0', () => {
      expect(wordCount('')).toBe(0);
    });

    it('只有空白返回 0', () => {
      expect(wordCount('   ')).toBe(0);
    });

    it('单个单词', () => {
      expect(wordCount('hello')).toBe(1);
    });
  });

  describe('containsSensitiveWords', () => {
    it('包含敏感词返回 true', () => {
      expect(containsSensitiveWords('这是一个spam消息', ['spam'])).toBe(true);
    });

    it('不包含敏感词返回 false', () => {
      expect(containsSensitiveWords('正常消息', ['spam'])).toBe(false);
    });

    it('大小写不敏感', () => {
      expect(containsSensitiveWords('This is SPAM', ['spam'])).toBe(true);
    });

    it('空敏感词列表返回 false', () => {
      expect(containsSensitiveWords('任何文本', [])).toBe(false);
    });
  });
});
