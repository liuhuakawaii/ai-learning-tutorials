/**
 * 通用验证工具函数
 */

/** 验证邮箱格式 */
export function isValidEmail(email: string): boolean {
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}

/** 验证 URL 格式 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** 验证密码强度 */
export function checkPasswordStrength(password: string): {
  score: number;
  level: 'weak' | 'medium' | 'strong';
  suggestions: string[];
} {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else suggestions.push('密码至少 8 个字符');

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push('包含大小写字母');

  if (/\d/.test(password)) score++;
  else suggestions.push('包含数字');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else suggestions.push('包含特殊字符');

  const level = score <= 2 ? 'weak' : score <= 3 ? 'medium' : 'strong';

  return { score, level, suggestions };
}

/** 验证手机号（中国大陆） */
export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

/** 验证值不为空 */
export function isNonEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}
