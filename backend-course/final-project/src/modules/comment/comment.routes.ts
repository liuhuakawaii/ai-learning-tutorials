import { Router, type Router as ExpressRouter } from 'express';
import { commentController } from './comment.controller';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createCommentSchema, updateCommentSchema, commentIdSchema, commentListSchema } from './comment.schema';

const router: ExpressRouter = Router({ mergeParams: true });

// 获取文章评论（公开）
router.get('/', validate(commentListSchema), commentController.listByPost);

// 需要登录
router.post('/', authMiddleware, validate(createCommentSchema), commentController.create);
router.put('/:id', authMiddleware, validate(updateCommentSchema), commentController.update);
router.delete('/:id', authMiddleware, validate(commentIdSchema), commentController.delete);

export default router;
