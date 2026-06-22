/**
 * 字符串工具函数
 */

/** 清理多余空白字符 */
export function sanitize(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

/** 截断文本并添加省略号 */
export function truncate(text: string, maxLength: number): string {
  if (maxLength < 0) throw new Error('maxLength 不能为负数');
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  return text.slice(0, maxLength - 3) + '...';
}

/** 高亮搜索关键词 */
export function highlight(text: string, keyword: string): string {
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '**$1**');
}

/** 将文本转换为 URL 友好的 slug */
export function toSlug(text: string): string {
  return sanitize(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 统计文本中的单词数 */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** 检查文本是否包含敏感词（简单示例） */
export function containsSensitiveWords(text: string, words: string[] = []): boolean {
  const lower = text.toLowerCase();
  return words.some(w => lower.includes(w.toLowerCase()));
}
