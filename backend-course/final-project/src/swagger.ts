import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '博客平台 API',
      version: '1.0.0',
      description: '一个架构完整的博客平台 RESTful API',
    },
    servers: [
      { url: 'http://localhost:3000', description: '开发服务器' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.ts'], // 扫描所有模块文件中的 JSDoc 注释
};

export default swaggerJsdoc(options);
