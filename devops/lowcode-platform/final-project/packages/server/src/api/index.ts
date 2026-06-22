/**
 * 自动 REST API 生成器
 * 根据数据模型定义自动生成标准 CRUD API 路由
 */

import { Router, type Request, type Response } from 'express';
import { ModelManager, RecordManager } from '../models';
import { authMiddleware, type AuthRequest } from '../auth/middleware';

const router = Router();
const modelManager = new ModelManager();
const recordManager = new RecordManager();

/**
 * 注册模型管理 API
 * 提供模型的增删改查能力
 */
export function registerModelRoutes(app: Router) {
  const modelRouter = Router();

  // 获取模型列表
  modelRouter.get('/', async (req: AuthRequest, res: Response) => {
    try {
      const models = await modelManager.listModels(req.user?.tenantId);
      res.json({ success: true, data: models });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // 获取单个模型
  modelRouter.get('/:id', async (req: Request, res: Response) => {
    try {
      const model = await modelManager.getModel(req.params.id);
      if (!model) {
        return res.status(404).json({ success: false, message: '模型不存在' });
      }
      res.json({ success: true, data: model });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // 创建模型
  modelRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const model = await modelManager.createModel(req.body, req.user?.tenantId);
      res.status(201).json({ success: true, data: model });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // 更新模型
  modelRouter.put('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const model = await modelManager.updateModel(req.params.id, req.body);
      res.json({ success: true, data: model });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // 删除模型
  modelRouter.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      await modelManager.deleteModel(req.params.id);
      res.json({ success: true, message: '删除成功' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.use('/api/models', modelRouter);
}

/**
 * 根据模型定义动态生成数据 CRUD API
 * 这是低代码平台的核心能力：根据用户定义的模型自动暴露 REST 接口
 */
export function registerDynamicDataRoutes(app: Router) {
  const dataRouter = Router();

  // 动态获取模型名参数的数据记录
  dataRouter.get('/:modelName', async (req: AuthRequest, res: Response) => {
    try {
      const { modelName } = req.params;
      const { page, pageSize, sort, ...filters } = req.query;

      const model = await modelManager.getModelByName(modelName, req.user?.tenantId);
      if (!model) {
        return res.status(404).json({ success: false, message: `模型 "${modelName}" 不存在` });
      }

      const result = await recordManager.queryRecords(model.id, {
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        filters: filters as Record<string, unknown>,
        sort: sort ? JSON.parse(sort as string) : undefined,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // 创建数据记录
  dataRouter.post('/:modelName', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { modelName } = req.params;
      const model = await modelManager.getModelByName(modelName, req.user?.tenantId);
      if (!model) {
        return res.status(404).json({ success: false, message: `模型 "${modelName}" 不存在` });
      }

      const record = await recordManager.createRecord(model.id, req.body);
      res.status(201).json({ success: true, data: record });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // 批量创建数据记录
  dataRouter.post('/:modelName/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { modelName } = req.params;
      const model = await modelManager.getModelByName(modelName, req.user?.tenantId);
      if (!model) {
        return res.status(404).json({ success: false, message: `模型 "${modelName}" 不存在` });
      }

      const result = await recordManager.createRecords(model.id, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // 更新数据记录
  dataRouter.put('/:modelName/:recordId', authMiddleware, async (req: Request, res: Response) => {
    try {
      const record = await recordManager.updateRecord(req.params.recordId, req.body);
      res.json({ success: true, data: record });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // 删除数据记录
  dataRouter.delete('/:modelName/:recordId', authMiddleware, async (req: Request, res: Response) => {
    try {
      await recordManager.deleteRecord(req.params.recordId);
      res.json({ success: true, message: '删除成功' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.use('/api/data', dataRouter);
}

/**
 * 注册所有 API 路由
 */
export function registerAllRoutes(app: Router) {
  registerModelRoutes(app);
  registerDynamicDataRoutes(app);
}

export { router as apiRouter };
