import { setupServer } from 'msw/node';
import { handlers } from './handlers.js';

// 创建 MSW 模拟服务器实例
export const server = setupServer(...handlers);
