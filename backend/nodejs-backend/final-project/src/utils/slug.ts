/**
 * 生成 URL 友好的 slug
 * 例如: "Hello World!" -> "hello-world"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // 移除特殊字符
    .replace(/[\s_]+/g, '-') // 空格和下划线替换为连字符
    .replace(/-+/g, '-') // 合并多个连字符
    .replace(/^-+|-+$/g, ''); // 移除首尾连字符
}

/**
 * 生成唯一 slug（追加随机后缀）
 */
export function generateUniqueSlug(text: string): string {
  const base = generateSlug(text);
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}
