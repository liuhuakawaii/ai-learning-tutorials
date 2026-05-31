import { Request, Response } from 'express';
import { userService } from './user.service';
import { sendSuccess, sendPaginated } from '../../utils/response';

export class UserController {
  async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    const { users, total } = await userService.list(page, limit, search);
    sendPaginated(res, users, page, limit, total);
  }

  async getById(req: Request, res: Response) {
    const user = await userService.getById(req.params.id);
    sendSuccess(res, user);
  }

  async delete(req: Request, res: Response) {
    await userService.delete(req.params.id);
    sendSuccess(res, null, '用户已删除');
  }
}

export const userController = new UserController();
