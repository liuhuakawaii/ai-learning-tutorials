import Redis from 'ioredis';
import { config } from '../config';
import logger from './logger';

const redis = new Redis(config.redis.url, {
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

export default redis;
