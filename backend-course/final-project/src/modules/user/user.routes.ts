import { Router, type Router as ExpressRouter } from 'express';
import { userController } from './user.controller';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { userListSchema, userIdSchema } from './user.schema';

const router: ExpressRouter = Router();

// 所有用户路由需要管理员权限
router.use(authMiddleware, requireRole('ADMIN'));

router.get('/', validate(userListSchema), userController.list);
router.get('/:id', validate(userIdSchema), userController.getById);
router.delete('/:id', validate(userIdSchema), userController.delete);

export default router;
