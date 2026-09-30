import Redis from 'ioredis';
import { config } from '../config';

const redisConnection = config.redis.url
  ? new Redis(config.redis.url, { maxRetriesPerRequest: null })
  : new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: null,
    });

export default redisConnection;
