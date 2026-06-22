/**
 * 生成唯一 ID（基于时间戳 + 随机数的简易实现）
 * 生产环境建议使用 uuid 或 nanoid
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/** 将字符串转换为 URL 友好的 slug */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** 深拷贝对象（使用 structuredClone，兼容 Node 17+） */
export function deepClone<T>(obj: T): T {
  return structuredClone(obj);
}

/** 类型安全的 Object.keys */
export function typedKeys<T extends object>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

/** 延迟指定毫秒 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 将字节数格式化为人类可读的字符串 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/** 判断值是否为非空（排除 null、undefined、空字符串） */
export function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
