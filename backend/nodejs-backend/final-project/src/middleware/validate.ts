import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * 请求验证中间件：使用 Zod 验证请求数据
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        throw new (require('../utils/errors').AppError)(
          `参数验证失败: ${messages.join('; ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }
      next(err);
    }
  };
}
