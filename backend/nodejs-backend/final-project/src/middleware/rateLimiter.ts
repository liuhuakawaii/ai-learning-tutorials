import rateLimit from 'express-rate-limit';

/**
 * 通用 API 限流：每 15 分钟最多 100 次请求
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 登录接口限流：每 15 分钟最多 5 次尝试
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: '登录尝试过多，请 15 分钟后再试' },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
