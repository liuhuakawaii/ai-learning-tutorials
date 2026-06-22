import winston from 'winston';
import path from 'path';
import { config } from '../config';

const { combine, timestamp, json, colorize, printf } = winston.format;

// 开发环境用彩色格式化输出
const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

// 生产环境用 JSON 格式（方便日志分析）
const prodFormat = combine(timestamp(), json());

const logger = winston.createLogger({
  level: config.log.level,
  format: config.nodeEnv === 'development' ? devFormat : prodFormat,
  transports: [
    // 控制台输出
    new winston.transports.Console(),
    // 错误日志写入文件
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 所有日志写入文件
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

export default logger;
