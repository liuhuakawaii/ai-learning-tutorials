import { z } from 'zod';

// Todo 项的验证 schema
export const TodoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过 200 字符'),
  completed: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateTodoSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过 200 字符'),
});

export const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  completed: z.boolean().optional(),
});

export type Todo = z.infer<typeof TodoSchema>;
export type CreateTodoInput = z.infer<typeof CreateTodoSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;
