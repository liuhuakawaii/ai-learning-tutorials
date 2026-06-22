import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('邮箱格式不正确'),
    username: z.string().min(2, '用户名至少 2 个字符').max(20, '用户名最多 20 个字符'),
    password: z.string().min(6, '密码至少 6 个字符').max(50, '密码最多 50 个字符'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('邮箱格式不正确'),
    password: z.string().min(1, '请输入密码'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    username: z.string().min(2).max(20).optional(),
    bio: z.string().max(500).optional(),
    avatar: z.string().url().optional(),
  }),
});
