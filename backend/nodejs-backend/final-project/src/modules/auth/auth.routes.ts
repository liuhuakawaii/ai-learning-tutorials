import { Router, type Router as ExpressRouter } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { registerSchema, loginSchema, updateProfileSchema } from './auth.schema';
import { authLimiter } from '../../middleware/rateLimiter';

const router: ExpressRouter = Router();

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.get('/me', authMiddleware, authController.getProfile);
router.put('/me', authMiddleware, validate(updateProfileSchema), authController.updateProfile);

export default router;
