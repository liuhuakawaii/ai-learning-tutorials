import { Request, Response } from 'express';
import { authService } from './auth.service';
import { sendSuccess } from '../../utils/response';

export class AuthController {
  async register(req: Request, res: Response) {
    const { email, username, password } = req.body;
    const result = await authService.register(email, username, password);
    sendSuccess(res, result, '注册成功', 201);
  }

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    sendSuccess(res, result, '登录成功');
  }

  async getProfile(req: Request, res: Response) {
    const user = await authService.getProfile(req.user!.id);
    sendSuccess(res, user);
  }

  async updateProfile(req: Request, res: Response) {
    const user = await authService.updateProfile(req.user!.id, req.body);
    sendSuccess(res, user, '更新成功');
  }
}

export const authController = new AuthController();
