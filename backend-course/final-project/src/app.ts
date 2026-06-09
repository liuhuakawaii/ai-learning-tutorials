import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import logger from './lib/logger';

const app: Express = express();

// ============ 安全中间件 ============
app.use(helmet()); // 设置安全 HTTP 头
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? ['https://yourdomain.com'] // 生产环境精确配置
    : '*', // 开发环境允许所有
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============ 请求解析 ============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============ 日志 ============
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.http(message.trim()) },
}));

// ============ 限流 ============
app.use('/api', apiLimiter);

// ============ 静态文件 ============
app.use('/uploads', express.static(path.join(process.cwd(), config.upload.dir)));

// ============ Swagger 文档 ============
// swagger-jsdoc 配置在 swagger.ts 中
try {
  const swaggerSpec = require('./swagger').default;
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
} catch {
  logger.warn('Swagger not configured, skipping /api-docs');
}

// ============ 健康检查 ============
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============ API 路由 ============
app.use('/api', routes);

// ============ 404 处理 ============
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: '接口不存在' },
  });
});

// ============ 全局错误处理 ============
app.use(errorHandler);

// ============ 启动服务器 ============
app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`API: http://localhost:${config.port}/api`);
  logger.info(`Swagger: http://localhost:${config.port}/api-docs`);
  logger.info(`Health: http://localhost:${config.port}/health`);
});

export default app;
