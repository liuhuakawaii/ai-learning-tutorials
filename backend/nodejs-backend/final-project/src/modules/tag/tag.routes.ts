import { Router, type Router as ExpressRouter } from 'express';
import { tagController } from './tag.controller';
import { authMiddleware } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { createTagSchema, tagIdSchema } from './tag.schema';

const router: ExpressRouter = Router();

router.get('/', tagController.list);
router.get('/popular', tagController.popular);
router.post('/', authMiddleware, validate(createTagSchema), tagController.create);
router.delete('/:id', authMiddleware, requireRole('ADMIN'), validate(tagIdSchema), tagController.delete);

export default router;
