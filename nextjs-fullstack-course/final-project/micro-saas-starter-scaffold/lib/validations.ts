import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少 6 位'),
});

export const registerSchema = z.object({
  name: z.string().min(2, '名称至少 2 个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少 6 位'),
});

export const projectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(100),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
});

export const teamSchema = z.object({
  name: z.string().min(2, '团队名称至少 2 个字符').max(50),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
